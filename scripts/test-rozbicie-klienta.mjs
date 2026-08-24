/**
 * ROZBICIE CENY DLA KLIENTA — materiał, prace kamieniarskie, suma.
 *
 *   node --test scripts/test-rozbicie-klienta.mjs
 *
 * Decyzja Dawida (21.08.2026): klient nie ma widzieć pojedynczych pozycji
 * (pomiar Prolinerem, wycięcie pod zlew, otwory, montaż) — tylko cenę
 * materiału, cenę prac i podsumowanie. Pełne rozbicie zostaje w mailu
 * firmowym i w edytorze właściciela.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { wycen } from '../src/engine/wycena.js';
import { ROBOCIZNA, OPCJE, PLYTA_STANDARD } from '../src/firms/_domyslne.js';
import { zastosujUstawienia } from '../src/app/ustawienia.js';
import {
  rozbicieDlaKlienta,
  opisPrac,
  ETYKIETA_MATERIALU,
  ETYKIETA_PRAC,
} from '../src/app/pozycje-klienta.js';

const firma = {
  slug: 'test',
  nazwa: 'Test',
  typ: 'konglomerat kwarcowy',
  aktywna: true,
  trybCeny: 'katalog',
  cenyUslug: 'brutto',
  plyta: { ...PLYTA_STANDARD },
  robocizna: ROBOCIZNA,
  opcje: OPCJE,
  dekory: { Testowy: { 20: 800 } },
};
zastosujUstawienia([firma], {});

const licz = (opcje = {}) =>
  wycen(firma, {
    dekor: 'Testowy',
    grubosc: '20',
    odcinki: [{ gl: 60, dl: 300 }],
    opcje: { zlew: 'podblat', plyta: 'nakladana', otwory: 2, pomieszczenie: 'kuchnia', ...opcje },
  });

/* ─────────────────────────────── dwie kwoty zamiast listy */

test('wycena rozkłada się na materiał i prace — nic nie ginie po drodze', () => {
  const w = licz();
  const r = rozbicieDlaKlienta(w.pozycje, { odbiorWlasny: w.odbiorWlasny });

  assert.ok(r.material > 0 && r.prace > 0);
  assert.ok(Math.abs(r.material - w.materialBrutto) < 0.01);
  assert.ok(Math.abs(r.prace - w.uslugiBrutto) < 0.01);
  assert.ok(Math.abs(r.razem - (w.materialBrutto + w.uslugiBrutto)) < 0.01, 'suma się zgadza');
});

test('prace zawierają WSZYSTKIE usługi, także pomiar Prolinerem', () => {
  const w = licz();
  const r = rozbicieDlaKlienta(w.pozycje, {});
  const pomiar = w.pozycje.find((p) => p.nazwa.includes('Proliner'));
  assert.ok(pomiar.brutto > 0, 'scenariusz musi zawierać pomiar');
  // Kwota pomiaru siedzi w sumie prac — zwijamy widok, nie cennik.
  assert.ok(r.prace >= pomiar.brutto);
});

test('opis prac nie wymienia pojedynczych czynności do wykreślenia', () => {
  for (const odbior of [false, true]) {
    const opis = opisPrac(odbior);
    assert.doesNotMatch(opis, /Proliner/i, 'pomiar nie może być osobną pozycją dla klienta');
    assert.doesNotMatch(opis, /zlew/i);
    assert.doesNotMatch(opis, /otw[oó]r/i);
    assert.doesNotMatch(opis, /\d/, 'żadnych kwot ani stawek');
  }
});

test('przy odbiorze własnym opis nie obiecuje montażu ani pomiaru', () => {
  assert.match(opisPrac(true), /odbioru/);
  assert.doesNotMatch(opisPrac(true), /montaż|transport/i);
  assert.match(opisPrac(false), /montaż/i);
});

test('etykiety są takie, jak prosił Dawid', () => {
  assert.equal(ETYKIETA_MATERIALU, 'Materiał');
  assert.equal(ETYKIETA_PRAC, 'Prace kamieniarskie');
});

/* ───────────────────────── zamrożona oferta (strona /oferta) */

test('oferta bez pola „grupa" też dzieli się poprawnie', () => {
  // Zamrożona oferta ma materiał jako pierwszą pozycję i żadnych grup.
  const oferta = [
    { nazwa: 'Avant Quartz — Dijon', detal: '1 płyta · 5,2 m²', brutto: 4000 },
    { nazwa: 'Pomiar cyfrowy Proliner', detal: '', brutto: 878 },
    { nazwa: 'Transport i montaż', detal: '1,8 m²', brutto: 1633, gratis: true },
  ];
  const r = rozbicieDlaKlienta(oferta, {});
  assert.equal(r.material, 4000);
  assert.equal(r.prace, 878 + 1633);
  assert.equal(r.razem, 6511);
  assert.equal(r.materialOpis, '1 płyta · 5,2 m²');
});

test('gratisy zostają widoczne — to argument, nie pozycja do wycięcia', () => {
  const r = rozbicieDlaKlienta(
    [
      { nazwa: 'Materiał', brutto: 4000 },
      { nazwa: 'Transport i montaż u klienta', brutto: 0, gratis: true },
      { nazwa: 'Otwory w blacie', brutto: 263 },
    ],
    {}
  );
  assert.deepEqual(r.gratisy, ['Transport i montaż u klienta']);
});

test('pusta albo dziwna lista nie wywraca rozbicia', () => {
  const puste = rozbicieDlaKlienta([], {});
  assert.deepEqual([puste.material, puste.prace, puste.razem], [0, 0, 0]);
  assert.deepEqual(rozbicieDlaKlienta(null, {}).gratisy, []);
});

test('materiał „do ustalenia" przechodzi do widoku', () => {
  const r = rozbicieDlaKlienta(
    [{ grupa: 'materiał', nazwa: 'Kamień', brutto: 0, materialDoUstalenia: true }],
    {}
  );
  assert.equal(r.doUstalenia, true);
});

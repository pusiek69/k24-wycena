/**
 * STAWKI ZAKŁADU EDYTOWALNE Z PANELU + obróbka 200 zł/m².
 *
 *   node --test scripts/test-stawki.mjs
 *
 * Decyzje Dawida z 21.08.2026:
 *   • obróbka blatu kosztuje 200 zł/m² (do tej pory była „w cenie", 0 zł),
 *   • kamień naturalny nie ma już osobnego dodatku 300 zł/m² — płaci tę
 *     samą stawkę obróbki co reszta,
 *   • wszystkie stawki naszej pracy da się zmienić w panelu; bez ustawień
 *     w bazie kalkulator liczy wartościami domyślnymi z kodu.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { wycen } from '../src/engine/wycena.js';
import { ROBOCIZNA, OPCJE, PLYTA_STANDARD } from '../src/firms/_domyslne.js';
import { DOMYSLNE, PARAMETRY, scalUstawienia, zastosujUstawienia } from '../src/app/ustawienia.js';
import { bezCenJednostkowych } from '../src/app/oferta-detal.js';

const nowaFirma = () => ({
  slug: 'test',
  nazwa: 'Test',
  typ: 'konglomerat kwarcowy',
  aktywna: true,
  trybCeny: 'katalog',
  cenyUslug: 'brutto',
  plyta: { ...PLYTA_STANDARD },
  robocizna: ROBOCIZNA,
  opcje: OPCJE,
  obrobkaNaturalnaZaM2: 0,
  dekory: { Testowy: { 20: 800 } },
});

const KUCHNIA = [{ gl: 60, dl: 300 }]; // 1,8 m² blatu
const OPCJE_BAZOWE = { zlew: 'podblat', plyta: 'nakladana', otwory: 2, pomieszczenie: 'kuchnia' };

const licz = (firma, opcje = {}) =>
  wycen(firma, { dekor: 'Testowy', grubosc: '20', odcinki: KUCHNIA, opcje: { ...OPCJE_BAZOWE, ...opcje } });
const pozycja = (w, fraza) => w.pozycje.find((p) => p.nazwa.includes(fraza));
// Stawki są brutto przy 23%, a wycena z montażem idzie po 8%.
const naStawke = (brutto) => (brutto / 1.23) * 1.08;

/* ─────────────────────────────────── obróbka 200 zł/m² */

test('obróbka blatu kosztuje domyślnie 200 zł/m² powierzchni blatu', () => {
  const firma = nowaFirma();
  zastosujUstawienia([firma], {});

  const w = licz(firma);
  const obrobka = pozycja(w, 'Docięcie, polerowanie');
  assert.ok(obrobka, 'pozycja obróbki musi być na liście');
  assert.equal(obrobka.wCenie, false, 'to już nie jest świadczenie „w cenie"');
  // 1,8 m² × 200 zł brutto@23 → po stawce 8%.
  assert.ok(Math.abs(obrobka.brutto - naStawke(200) * 1.8) < 0.01, `${obrobka.brutto}`);
  assert.equal(obrobka.detal, '1,8 m²');
});

test('zerowa stawka wraca do trybu „w cenie" — pozycja zostaje, kwoty nie ma', () => {
  const firma = nowaFirma();
  zastosujUstawienia([firma], { obrobkaZaM2: 0 });

  const obrobka = pozycja(licz(firma), 'Docięcie, polerowanie');
  assert.ok(obrobka);
  assert.equal(obrobka.wCenie, true);
  assert.equal(obrobka.brutto, 0);
});

test('kamień naturalny nie ma już dodatku 300 zł/m² — domyślnie 0', () => {
  assert.equal(DOMYSLNE.obrobkaNaturalnaZaM2, 0);
  const firma = { ...nowaFirma(), obrobkaNaturalnaZaM2: 300 };
  zastosujUstawienia([firma], {});
  assert.equal(firma.obrobkaNaturalnaZaM2, 0);
  assert.equal(pozycja(licz(firma), 'Obróbka kamienia naturalnego'), undefined);
});

test('dodatek naturalny da się przywrócić z panelu', () => {
  const firma = { ...nowaFirma(), obrobkaNaturalnaZaM2: 0 };
  zastosujUstawienia([firma], { obrobkaNaturalnaZaM2: 120 });
  const dodatek = pozycja(licz(firma), 'Obróbka kamienia naturalnego');
  assert.ok(dodatek);
  assert.ok(Math.abs(dodatek.brutto - naStawke(120) * 1.8) < 0.01);
});

/* ────────────────────────── stawki z panelu wchodzą do wyceny */

test('zmiana stawek w panelu zmienia kwoty pozycji', () => {
  const firma = nowaFirma();
  zastosujUstawienia([firma], {
    montazBaza: 1000,
    montazZaM2: 100,
    pomiar: 500,
    zlewPodblatowy: 400,
    plytaNakladana: 100,
    otwor: 50,
  });
  const w = licz(firma);

  assert.ok(Math.abs(pozycja(w, 'Pomiar cyfrowy').brutto - naStawke(500)) < 0.01);
  assert.ok(Math.abs(pozycja(w, 'Transport i montaż').brutto - naStawke(1000 + 100 * 1.8)) < 0.01);
  assert.ok(Math.abs(pozycja(w, 'zlewu podblatowego').brutto - naStawke(400)) < 0.01);
  assert.ok(Math.abs(pozycja(w, 'płytę nakładaną').brutto - naStawke(100)) < 0.01);
  assert.ok(Math.abs(pozycja(w, 'Otwory w blacie').brutto - naStawke(50) * 2) < 0.01);
});

test('zlew nablatowy liczy się jako część podblatowego, także po zmianie', () => {
  const firma = nowaFirma();
  zastosujUstawienia([firma], { zlewPodblatowy: 800, udzialNablatowego: 0.25 });
  const w = licz(firma, { zlew: 'nablat' });
  assert.ok(Math.abs(pozycja(w, 'zlew nablatowy').brutto - naStawke(200)) < 0.01);
});

test('bez ustawień w bazie liczy się wartościami domyślnymi', () => {
  const zBazy = nowaFirma();
  const zDomyslnymi = nowaFirma();
  zastosujUstawienia([zBazy], {});
  zastosujUstawienia([zDomyslnymi], DOMYSLNE);
  assert.equal(licz(zBazy).razemZaokr, licz(zDomyslnymi).razemZaokr);
});

test('śmieci z formularza nie psują stawek', () => {
  const u = scalUstawienia({ montazBaza: 'abc', otwor: -50, nieznanyKlucz: 999, pomiar: '750' });
  assert.equal(u.montazBaza, DOMYSLNE.montazBaza, 'tekst → domyślna');
  assert.equal(u.otwor, DOMYSLNE.otwor, 'ujemna → domyślna');
  assert.equal(u.pomiar, 750, 'liczba w tekście przechodzi');
  assert.equal(u.nieznanyKlucz, undefined, 'nieznany klucz odrzucony');
});

test('firmy nie współdzielą stawek po nałożeniu ustawień', () => {
  const a = nowaFirma();
  const b = nowaFirma();
  zastosujUstawienia([a], { otwor: 10 });
  zastosujUstawienia([b], { otwor: 900 });
  assert.ok(Math.abs(pozycja(licz(a), 'Otwory w blacie').brutto - naStawke(10) * 2) < 0.01);
  assert.ok(Math.abs(pozycja(licz(b), 'Otwory w blacie').brutto - naStawke(900) * 2) < 0.01);
});

test('lista parametrów panelu zgadza się z wartościami domyślnymi', () => {
  assert.equal(PARAMETRY.length, Object.keys(DOMYSLNE).length);
  for (const p of PARAMETRY) {
    assert.ok(p.label && p.jednostka, `${p.klucz} bez opisu`);
    assert.equal(DOMYSLNE[p.klucz], p.domyslnie);
  }
});

/* ──────────────────── oferty Dawida bez cen jednostkowych */

test('detal pozycji traci stawkę, zostaje sama ilość', () => {
  assert.equal(bezCenJednostkowych('2 szt. × 150 zł'), '2 szt.');
  assert.equal(bezCenJednostkowych('5,2 m² × 60 zł'), '5,2 m²');
  assert.equal(bezCenJednostkowych('3 m.b. × 90 zł'), '3 m.b.');
  assert.equal(bezCenJednostkowych('1,8 m²'), '1,8 m²', 'sama ilość zostaje');
  assert.equal(bezCenJednostkowych('1 płyta · 5,2 m² materiału'), '1 płyta · 5,2 m² materiału');
});

test('detal, który jest samą kwotą, znika w całości', () => {
  assert.equal(bezCenJednostkowych('baza 1500 zł + 1,8 m² × 200 zł'), '');
  assert.equal(bezCenJednostkowych('1000 zł raz na zlecenie'), '');
  assert.equal(bezCenJednostkowych(''), '');
  assert.equal(bezCenJednostkowych(undefined), '');
});

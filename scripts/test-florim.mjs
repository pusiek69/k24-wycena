/**
 * FLORIM STONE — gres wielkoformatowy z cennika dostawcy (12.09.2025).
 *
 *   node --test scripts/test-florim.mjs
 *
 * Zasady ustalone z Dawidem (19.08.2026):
 *   • jedyna grubość to 12 mm, płyta 320 × 160 cm, tylko całe płyty,
 *   • ceny z cennika są NETTO i mają wliczoną marżę 30% — wchodzą jeden
 *     do jednego, VAT dolicza silnik wg wariantu,
 *   • bez promocji i dat wygaśnięcia — ceny stałe.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { wycen } from '../src/engine/wycena.js';
import { ROBOCIZNA, OPCJE, VAT_MONTAZ, VAT_TOWAR } from '../src/firms/_domyslne.js';

const KATALOG = JSON.parse(
  fs.readFileSync(new URL('../src/generated/florim-stone.dekory.json', import.meta.url), 'utf8')
);

const FIRMA = {
  slug: 'florim-stone',
  nazwa: 'Florim Stone',
  typ: 'spiek / gres wielkoformatowy',
  aktywna: true,
  trybCeny: 'katalog',
  cenyUslug: 'brutto',
  plyta: { w: 320, h: 160, polowkaDozwolona: false },
  narzutOdpad: 0.1,
  gruboscDomyslna: '12',
  robocizna: ROBOCIZNA,
  opcje: OPCJE,
  dekory: KATALOG.dekory,
};

const KUCHNIA = [{ gl: 60, dl: 300 }];
const OPCJE_BAZOWE = { zlew: 'podblat', plyta: 'nakladana', otwory: 2, pomieszczenie: 'kuchnia' };

const licz = (dekor, opcje = {}) =>
  wycen(FIRMA, { dekor, grubosc: '12', odcinki: KUCHNIA, opcje: { ...OPCJE_BAZOWE, ...opcje } });
const material = (w) => w.pozycje.find((p) => p.grupa === 'materiał');
const nettoM2 = (w) => material(w).brutto / (1 + w.stawkaVat) / w.m2Platne;

/* ─────────────────────────────────────────── dane z cennika */

test('cennik ma 73 dekory, każdy tylko w 12 mm', () => {
  const wpisy = Object.entries(KATALOG.dekory);
  assert.equal(wpisy.length, 73);
  for (const [nazwa, grubosci] of wpisy) {
    assert.deepEqual(Object.keys(grubosci), ['12'], nazwa);
  }
});

test('nazwy trzymają format „KOLEKCJA — DEKOR wykończenie"', () => {
  const kolekcje = new Set();
  for (const nazwa of Object.keys(KATALOG.dekory)) {
    assert.match(nazwa, / — /, nazwa);
    kolekcje.add(nazwa.split(' — ')[0]);
  }
  assert.deepEqual([...kolekcje].sort(), ['Cement', 'Color', 'Marble', 'Metal', 'Stone']);
});

test('w nazwach nie zostały podkreślniki z cennika', () => {
  for (const nazwa of Object.keys(KATALOG.dekory)) assert.doesNotMatch(nazwa, /_/, nazwa);
  assert.ok(KATALOG.dekory['Stone — Stone 01 mat'], 'Stone_01 → Stone 01');
  assert.ok(KATALOG.dekory['Stone — Plimatech 01 White mat'], 'Plimatech_01_White');
});

test('skrót „mat/let" rozwinięty do „mat/leather"', () => {
  const nazwy = Object.keys(KATALOG.dekory);
  assert.equal(nazwy.filter((n) => n.endsWith('mat/let')).length, 0);
  assert.ok(nazwy.filter((n) => n.endsWith('mat/leather')).length >= 8);
});

/* ─────────────────────────────────── ceny: netto z cennika */

test('dekor liczy się dokładnie z ceny z cennika', () => {
  for (const [dekor, cena] of [
    ['Marble — Statuario poler', 1150],
    ['Color — White mat', 940],
    ['Stone — Gris mat', 1000],
    ['Cement — Dark Gray velvet', 940],
  ]) {
    const w = licz(dekor);
    assert.equal(w.ok, true, w.blad);
    assert.ok(Math.abs(nettoM2(w) - cena) < 0.01, `${dekor}: ${nettoM2(w)} ≠ ${cena}`);
  }
});

test('ceny są NETTO — VAT dolicza silnik wg wariantu', () => {
  const zMontazem = licz('Marble — Statuario poler');
  const odbior = licz('Marble — Statuario poler', { dostawa: 'odbior' });
  assert.equal(zMontazem.stawkaVat, VAT_MONTAZ);
  assert.equal(odbior.stawkaVat, VAT_TOWAR);
  // Ta sama cena netto, dwie stawki. Gdyby cennik potraktować jak brutto
  // (konwencja Interstone), materiał wyszedłby o 23% niżej.
  const netto = (w) => material(w).brutto / (1 + w.stawkaVat);
  assert.ok(Math.abs(netto(zMontazem) - netto(odbior)) < 0.01);
  assert.ok(Math.abs(material(zMontazem).brutto / material(odbior).brutto - 1.08 / 1.23) < 0.001);
});

test('poler jest droższy od matu o różnicę z cennika', () => {
  const mat = licz('Marble — Statuario mat');
  const poler = licz('Marble — Statuario poler');
  assert.ok(Math.abs(nettoM2(poler) - nettoM2(mat) - 100) < 0.01, 'różnica 1150 − 1050');
});

/* ──────────────────────────── kupujemy całe płyty 320 × 160 */

test('płyty tylko całe, format 320 × 160 cm', () => {
  const w = licz('Color — White mat');
  // Blat 0,6 × 3 m = 1,8 m², płyta ma 5,12 m² — płacimy za całą.
  assert.ok(Math.abs(w.pak.m2Kupione - 5.12) < 0.01, `m² kupione ${w.pak.m2Kupione}`);
  assert.ok(!w.pak.polowka, 'połówek dostawca nie sprzedaje');
});

/* ──────────────────────────────── bez promocji i bez 20 mm */

test('firma nie ma kampanii promocyjnych, kupuje całe płyty', async () => {
  const { wczytajSilnik } = await import('./lib/silnik.mjs');
  const { FIRMY } = await wczytajSilnik();
  const firma = FIRMY.find((f) => f.slug === 'florim-stone');
  assert.ok(firma, 'firma musi być widoczna w kreatorze');
  assert.equal(firma.promocje, undefined, 'ceny stałe — nie ma czego wygaszać');
  assert.equal(firma.plyta.polowkaDozwolona, false);
  assert.equal(firma.gruboscDomyslna, '12');
  assert.equal(Object.keys(firma.dekory).length, 73);
});

test('pytanie o 20 mm spada na jedyną grubość z cennika', () => {
  // Konsultant może podać grubość z przyzwyczajenia. Zamiast odmawiać,
  // silnik liczy dwunastkę — jedyną, jaką dostawca ma w tym cenniku.
  const w20 = wycen(FIRMA, {
    dekor: 'Marble — Statuario poler',
    grubosc: '20',
    odcinki: KUCHNIA,
    opcje: OPCJE_BAZOWE,
  });
  assert.equal(w20.ok, true);
  assert.equal(w20.grubosc, '12');
  assert.equal(w20.razemZaokr, licz('Marble — Statuario poler').razemZaokr);
});

/* ────────────────────────────── obróbka i montaż bez zmian */

test('obróbka, wycięcia i montaż liczą się jak przy innych spiekach', () => {
  const nazwy = licz('Marble — Statuario poler').pozycje.map((p) => p.nazwa);
  assert.ok(nazwy.some((n) => n.includes('Docięcie, polerowanie')));
  assert.ok(nazwy.some((n) => n.includes('Transport i montaż')));
  assert.ok(nazwy.some((n) => n.includes('Pomiar cyfrowy Proliner')));
  assert.ok(nazwy.some((n) => n.includes('zlewu podblatowego')));
  // Gres, nie kamień naturalny — bez dodatku za obróbkę.
  assert.equal(nazwy.find((n) => n.includes('Obróbka kamienia naturalnego')), undefined);
});

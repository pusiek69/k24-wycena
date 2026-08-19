/**
 * LAMINAM — spiek wielkoformatowy z cennika dostawcy (13.07.2026).
 *
 *   node --test scripts/test-laminam.mjs
 *
 * Zasady ustalone z Dawidem:
 *   • tylko grubości blatowe 12 i 20 mm, płyta 162 × 324 cm, całe płyty,
 *   • ceny z cennika są NETTO i mają już wliczoną marżę — wchodzą jeden
 *     do jednego, VAT dolicza silnik wg wariantu,
 *   • ceny z gwiazdką to promocja do 31.12.2026; wzory, które mają WYŁĄCZNIE
 *     cenę promocyjną, po tej dacie przestają być wyceniane automatycznie.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { wycen } from '../src/engine/wycena.js';
import { dekoryZKampaniami } from '../src/firms/_promocje.js';
import { VAT_MONTAZ, VAT_TOWAR, ROBOCIZNA, OPCJE } from '../src/firms/_domyslne.js';

const czytaj = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
const KATALOG = czytaj('../src/generated/laminam.dekory.json');
const PROMOCJE = czytaj('../src/generated/laminam.promocje.json');
const KAMPANIA = PROMOCJE.kampanie[0];

const W_PROMOCJI = '2026-08-19';
const PO_PROMOCJI = '2027-01-01';

/** Firma zbudowana jak w src/firms/laminam.js, ale z jawną datą. */
const firmaNaDzien = (dzien) => ({
  slug: 'laminam',
  nazwa: 'Laminam',
  typ: 'spiek / gres wielkoformatowy',
  aktywna: true,
  trybCeny: 'katalog',
  cenyUslug: 'brutto',
  plyta: { w: 324, h: 162, polowkaDozwolona: false },
  narzutOdpad: 0.1,
  pomijGrubosci: ['3', '5', '6'],
  robocizna: ROBOCIZNA,
  opcje: OPCJE,
  promocje: PROMOCJE.kampanie,
  dekory: dekoryZKampaniami(KATALOG.dekory, PROMOCJE.kampanie, dzien),
});

const KUCHNIA = [{ gl: 60, dl: 300 }];
const OPCJE_BAZOWE = { zlew: 'podblat', plyta: 'nakladana', otwory: 1, pomieszczenie: 'kuchnia' };

const licz = (dekor, grubosc, dzien) =>
  wycen(firmaNaDzien(dzien), { dekor, grubosc, odcinki: KUCHNIA, opcje: OPCJE_BAZOWE }, dzien);
const material = (w) => w.pozycje.find((p) => p.grupa === 'materiał');

/* ─────────────────────────────────────────── dane z cennika */

test('cennik ma 87 dekorów regularnych, a promocja 36 pozycji', () => {
  assert.equal(Object.keys(KATALOG.dekory).length, 87);
  assert.equal(Object.keys(KAMPANIA.ceny).length, 36);
  assert.equal(KAMPANIA.do, '2026-12-31');
});

test('w cenniku są wyłącznie grubości 12 i 20 mm', () => {
  const grubosci = new Set();
  for (const wpis of Object.values(KATALOG.dekory)) Object.keys(wpis).forEach((g) => grubosci.add(g));
  for (const klucz of Object.keys(KAMPANIA.ceny)) grubosci.add(klucz.slice(klucz.lastIndexOf('||') + 2));
  assert.deepEqual([...grubosci].sort(), ['12', '20']);
});

test('w trakcie promocji widać 108 dekorów, po niej 87', () => {
  assert.equal(Object.keys(firmaNaDzien(W_PROMOCJI).dekory).length, 108);
  assert.equal(Object.keys(firmaNaDzien(PO_PROMOCJI).dekory).length, 87);
});

/* ─────────────────────────────────── ceny: netto z cennika */

test('dekor regularny liczy się z ceny z cennika', () => {
  // CALCE — BIANCO Strutturato, 20 mm: 1329 zł/m² netto.
  const w = licz('CALCE — BIANCO Strutturato', '20', W_PROMOCJI);
  assert.equal(w.ok, true, w.blad);
  const nettoM2 = material(w).brutto / (1 + w.stawkaVat) / w.m2Platne;
  assert.ok(Math.abs(nettoM2 - 1329) < 0.01, `netto/m2 = ${nettoM2}`);
});

test('dekor promocyjny liczy się z ceny promocyjnej', () => {
  // FOKOS — SALE Naturale, 12 mm: 782 zł/m² netto (gwiazdka w cenniku).
  const w = licz('FOKOS — SALE Naturale', '12', W_PROMOCJI);
  assert.equal(w.ok, true, w.blad);
  const nettoM2 = material(w).brutto / (1 + w.stawkaVat) / w.m2Platne;
  assert.ok(Math.abs(nettoM2 - 782) < 0.01, `netto/m2 = ${nettoM2}`);
});

test('ceny są NETTO — VAT dolicza silnik wg wariantu', () => {
  const zMontazem = licz('CALCE — BIANCO Strutturato', '20', W_PROMOCJI);
  const odbior = wycen(
    firmaNaDzien(W_PROMOCJI),
    {
      dekor: 'CALCE — BIANCO Strutturato',
      grubosc: '20',
      odcinki: KUCHNIA,
      opcje: { ...OPCJE_BAZOWE, dostawa: 'odbior' },
    },
    W_PROMOCJI
  );
  assert.equal(zMontazem.stawkaVat, VAT_MONTAZ);
  assert.equal(odbior.stawkaVat, VAT_TOWAR);
  // Ta sama cena netto, dwie różne kwoty brutto. Gdyby cennik potraktować
  // jak brutto (konwencja Interstone), materiał wyszedłby o 23% niżej.
  const netto = (w) => material(w).brutto / (1 + w.stawkaVat);
  assert.ok(Math.abs(netto(zMontazem) - netto(odbior)) < 0.01);
  assert.ok(Math.abs(material(zMontazem).brutto / material(odbior).brutto - 1.08 / 1.23) < 0.001);
});

/* ──────────────────────────── kupujemy całe płyty 162 × 324 */

test('płyty tylko całe, format 324 x 162 cm', () => {
  const w = licz('CALCE — BIANCO Strutturato', '20', W_PROMOCJI);
  // Blat 0,6 × 3 m = 1,8 m², a płyta ma ponad 5 m² — płacimy za całą.
  assert.ok(w.pak.m2Kupione > 5, `m2 kupione ${w.pak.m2Kupione}`);
  assert.ok(!w.pak.polowka, 'połówek dostawca nie sprzedaje');
});

/* ────────────────────── wygaśnięcie promocji 31.12.2026 */

test('dekor TYLKO promocyjny znika z listy po promocji', () => {
  const przed = firmaNaDzien(W_PROMOCJI).dekory;
  const po = firmaNaDzien(PO_PROMOCJI).dekory;
  assert.ok(przed['FOKOS — SALE Naturale'], 'w promocji ma być');
  assert.equal(po['FOKOS — SALE Naturale'], undefined, 'po promocji ma zniknąć');
});

test('zapytanie o wygasły dekor daje wycenę indywidualną', () => {
  const w = licz('FOKOS — SALE Naturale', '12', PO_PROMOCJI);
  assert.equal(w.ok, false);
  assert.equal(w.wycenaIndywidualna, true);
  assert.match(w.blad, /promocyjn/i);
  assert.doesNotMatch(w.blad, /Nie znam dekoru/);
});

test('lista zbudowana w promocji nie liczy po starej cenie w 2027', () => {
  // Karta otwarta w grudniu, wycena klikana w styczniu: lista dekorów jest
  // ta sprzed wygaśnięcia, ale cena promocyjna ma zapisaną datę końca.
  const firmaZeStarejListy = firmaNaDzien(W_PROMOCJI);
  const w = wycen(
    firmaZeStarejListy,
    { dekor: 'FOKOS — SALE Naturale', grubosc: '12', odcinki: KUCHNIA, opcje: OPCJE_BAZOWE },
    PO_PROMOCJI
  );
  assert.equal(w.ok, false);
  assert.equal(w.wycenaIndywidualna, true);
});

test('w tym cenniku gwiazdka obejmuje cały wiersz — nie ma mieszanek', () => {
  // Ani jeden dekor nie ma jednej grubości promocyjnej, a drugiej regularnej:
  // 21 wzorów jest w całości promocyjnych, 87 w całości regularnych.
  for (const klucz of Object.keys(KAMPANIA.ceny)) {
    const nazwa = klucz.slice(0, klucz.lastIndexOf('||'));
    assert.equal(KATALOG.dekory[nazwa], undefined, `${nazwa} jest i tu, i tam`);
  }
  const promocyjne = new Set(
    Object.keys(KAMPANIA.ceny).map((k) => k.slice(0, k.lastIndexOf('||')))
  );
  assert.equal(promocyjne.size, 21);
});

test('gdyby dekor miał promocyjną 12 i regularną 20, po promocji zostaje sama 20', () => {
  // W cenniku z 13.07.2026 taki przypadek nie występuje, ale w kolejnym może —
  // sprawdzamy sam mechanizm, żeby wtedy nie zniknął cały wzór.
  const kampania = {
    nazwa: 'test',
    od: '2026-01-01',
    do: '2026-12-31',
    ceny: { 'MIESZANY — Wzór||12': 700 },
  };
  const dekory = { 'MIESZANY — Wzór': { 20: 1200 } };
  assert.deepEqual(Object.keys(dekoryZKampaniami(dekory, [kampania], W_PROMOCJI)['MIESZANY — Wzór']).sort(), [
    '12',
    '20',
  ]);
  assert.deepEqual(Object.keys(dekoryZKampaniami(dekory, [kampania], PO_PROMOCJI)['MIESZANY — Wzór']), ['20']);
});

/* ────────────────────────────── obróbka i montaż bez zmian */

test('obróbka, wycięcia i montaż liczą się jak przy innych spiekach', () => {
  const w = licz('CALCE — BIANCO Strutturato', '20', W_PROMOCJI);
  const nazwy = w.pozycje.map((p) => p.nazwa);
  assert.ok(nazwy.some((n) => n.includes('Docięcie, polerowanie')));
  assert.ok(nazwy.some((n) => n.includes('Transport i montaż')));
  assert.ok(nazwy.some((n) => n.includes('Pomiar cyfrowy Proliner')));
  assert.ok(nazwy.some((n) => n.includes('zlewu podblatowego')));
  // Laminam to spiek, nie kamień naturalny — bez dodatku za obróbkę.
  assert.equal(nazwy.find((n) => n.includes('Obróbka kamienia naturalnego')), undefined);
});

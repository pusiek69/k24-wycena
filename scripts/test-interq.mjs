/**
 * INTERQ — konglomerat kwarcowy (kwarco-granity), cennik z 20.08.2026
 * w DWÓCH częściach.
 *
 *   node --test scripts/test-interq.mjs
 *
 * Zasady ustalone z Dawidem:
 *   • część 1 (katalog dostawcy): cena klienta = detal × 1,35, zaokrąglona
 *     do pełnych złotych; ceny detaliczne nie wychodzą poza pricing/zrodla,
 *   • część 2 (dekory NA STANIE W POLSCE): ceny wchodzą WPROST, bez
 *     przeliczania — to inna podstawa cenowa, stąd bywają niższe,
 *   • konwencja netto/VAT jak Laminam/Florim: katalog trzyma netto,
 *     VAT dolicza silnik wg wariantu,
 *   • grubości 20 i 30 mm (trzydziestka tylko przy wzorach ze stanu),
 *     płyta 160 × 320 cm, połówki dozwolone (jak Avant i Caesarstone).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { wycen } from '../src/engine/wycena.js';
import { ROBOCIZNA, OPCJE, VAT_MONTAZ, VAT_TOWAR, PLYTA_STANDARD } from '../src/firms/_domyslne.js';

const KATALOG = JSON.parse(
  fs.readFileSync(new URL('../src/generated/interq.dekory.json', import.meta.url), 'utf8')
);

const FIRMA = {
  slug: 'interq',
  nazwa: 'InterQ',
  typ: 'konglomerat kwarcowy',
  aktywna: true,
  trybCeny: 'katalog',
  cenyUslug: 'brutto',
  plyta: { ...PLYTA_STANDARD },
  narzutOdpad: 0.1,
  gruboscDomyslna: '20',
  robocizna: ROBOCIZNA,
  opcje: OPCJE,
  dekory: KATALOG.dekory,
};

const KUCHNIA = [{ gl: 60, dl: 300 }];
const OPCJE_BAZOWE = { zlew: 'podblat', plyta: 'nakladana', otwory: 2, pomieszczenie: 'kuchnia' };

const licz = (dekor, opcje = {}) =>
  wycen(FIRMA, { dekor, grubosc: '20', odcinki: KUCHNIA, opcje: { ...OPCJE_BAZOWE, ...opcje } });
const material = (w) => w.pozycje.find((p) => p.grupa === 'materiał');
const nettoM2 = (w) => material(w).brutto / (1 + w.stawkaVat) / w.m2Platne;

/* ─────────────────────────────────────────── dane z cennika */

test('cennik ma 39 dekorów w grubościach 20 i 30 mm', () => {
  const wpisy = Object.entries(KATALOG.dekory);
  assert.equal(wpisy.length, 39, 'część 1 (22) + część 2 (18) − wspólny Angel White');
  for (const [nazwa, grubosci] of wpisy) {
    for (const g of Object.keys(grubosci)) assert.ok(['20', '30'].includes(g), `${nazwa}: ${g} mm`);
  }
});

test('Angel White Polished łączy obie części: 20 mm z katalogu, 30 mm ze stanu', () => {
  assert.deepEqual(KATALOG.dekory['Angel White Polished'], { 20: 988, 30: 588 });
});

test('część 2 (stan w Polsce) wchodzi wprost, bez ×1,35', () => {
  for (const [dekor, grubosc, cena] of [
    ['Harmony Polished', '20', 701],
    ['Harmony Brushed', '20', 724],
    ['Carrara Grigio Polished', '20', 468],
    ['Night Shadow Polished', '20', 817],
    ['Botticino Polished', '20', 552],
    ['Marquina Polished', '20', 571],
    ['Neve Brushed', '20', 730],
    ['Angel White Polished', '30', 588],
  ]) {
    assert.equal(KATALOG.dekory[dekor][grubosc], cena, dekor);
  }
});

test('wykończenie jest częścią nazwy — Marfil i Taj Mahal w dwóch wersjach', () => {
  assert.ok(KATALOG.dekory['Marfil Polished']);
  assert.ok(KATALOG.dekory['Marfil Brushed']);
  assert.ok(KATALOG.dekory['Taj Mahal Polished']);
  assert.ok(KATALOG.dekory['Taj Mahal Brushed']);
  assert.notEqual(KATALOG.dekory['Marfil Polished']['20'], KATALOG.dekory['Marfil Brushed']['20']);
});

/* ───────────────────────── przelicznik ×1,35 z zaokrągleniem */

test('cena klienta = detal × 1,35, zaokrąglona do złotówki', () => {
  // Pary (dekor, cena detaliczna dostawcy) — kontrola na próbce cennika.
  for (const [dekor, detal] of [
    ['Taj Mahal Polished', 1319], // 1780,65 → 1781 (przykład Dawida)
    ['Taj Mahal Brushed', 1442], //  1946,70 → 1947
    ['Angel White Polished', 732], // 988,20 → 988
    ['Almond Milk Polished', 838], // 1131,30 → 1131
    ['Patagonia Polished', 1280], // 1728
    ['Venatino Polished', 838],
  ]) {
    assert.equal(KATALOG.dekory[dekor]['20'], Math.round(detal * 1.35), dekor);
  }
});

test('ceny detaliczne z części 1 nie przechodzą 1:1 do plików klienta', () => {
  // Dotyczy WYŁĄCZNIE części katalogowej (×1,35). Część 2 celowo wchodzi
  // wprost, więc sprawdzamy tylko kwoty detaliczne z części 1.
  const koncowe = new Set(
    Object.values(KATALOG.dekory).flatMap((g) => Object.values(g))
  );
  for (const detal of [732, 816, 829, 958, 1010, 1169, 1280, 1319, 1442]) {
    assert.ok(!koncowe.has(detal), `detal ${detal} zł widoczny w generated`);
  }
});

test('grubość 30 mm liczy się z ceny ze stanu', () => {
  const w = wycen(FIRMA, {
    dekor: 'Angel White Polished',
    grubosc: '30',
    odcinki: KUCHNIA,
    opcje: OPCJE_BAZOWE,
  });
  assert.equal(w.ok, true, w.blad);
  assert.equal(w.grubosc, '30');
  assert.ok(Math.abs(nettoM2(w) - 588) < 0.01, `netto/m2 = ${nettoM2(w)}`);
});

/* ─────────────────────────────────── ceny: netto z katalogu */

test('Taj Mahal Polished liczy się z 1781 zł/m² netto', () => {
  const w = licz('Taj Mahal Polished');
  assert.equal(w.ok, true, w.blad);
  assert.ok(Math.abs(nettoM2(w) - 1781) < 0.01, `netto/m2 = ${nettoM2(w)}`);
});

test('ceny są NETTO — VAT dolicza silnik wg wariantu', () => {
  const zMontazem = licz('Taj Mahal Polished');
  const odbior = licz('Taj Mahal Polished', { dostawa: 'odbior' });
  assert.equal(zMontazem.stawkaVat, VAT_MONTAZ);
  assert.equal(odbior.stawkaVat, VAT_TOWAR);
  const netto = (w) => material(w).brutto / (1 + w.stawkaVat);
  assert.ok(Math.abs(netto(zMontazem) - netto(odbior)) < 0.01);
  assert.ok(Math.abs(material(zMontazem).brutto / material(odbior).brutto - 1.08 / 1.23) < 0.001);
});

/* ─────────────────────── płyta 160 × 320, połówki dozwolone */

test('krótki blat schodzi z połówki płyty', () => {
  const w = licz('Taj Mahal Polished');
  // Blat 0,6 × 3 m = 1,8 m² → połówka płyty 2,56 m², nie cała 5,12 m².
  assert.ok(w.pak.polowka, 'połówka ma być dozwolona jak przy Avant/Caesarstone');
  assert.ok(Math.abs(w.pak.m2Kupione - 2.56) < 0.01, `m² kupione ${w.pak.m2Kupione}`);
});

test('pytanie o 12 mm spada na jedyną dwudziestkę', () => {
  const w = wycen(FIRMA, {
    dekor: 'Taj Mahal Polished',
    grubosc: '12',
    odcinki: KUCHNIA,
    opcje: OPCJE_BAZOWE,
  });
  assert.equal(w.ok, true);
  assert.equal(w.grubosc, '20');
});

/* ────────────────────────────── obróbka i montaż bez zmian */

test('obróbka, wycięcia i montaż liczą się jak przy innych konglomeratach', () => {
  const nazwy = licz('Taj Mahal Polished').pozycje.map((p) => p.nazwa);
  assert.ok(nazwy.some((n) => n.includes('Docięcie, polerowanie')));
  assert.ok(nazwy.some((n) => n.includes('Transport i montaż')));
  assert.ok(nazwy.some((n) => n.includes('Pomiar cyfrowy Proliner')));
  assert.ok(nazwy.some((n) => n.includes('zlewu podblatowego')));
  // Konglomerat, nie kamień naturalny — bez dodatku za obróbkę.
  assert.equal(nazwy.find((n) => n.includes('Obróbka kamienia naturalnego')), undefined);
});

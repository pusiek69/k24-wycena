/**
 * Dodatek za obróbkę kamienia naturalnego — 300 zł za m² blatu.
 *
 *   node --test scripts/test-dodatek-naturalny.mjs
 *
 * Kamień naturalny obrabia się dłużej i z większym ryzykiem niż konglomerat:
 * rysunek trzeba dobrać, twardość bywa nierówna, przy cięciu zdarzają się
 * pęknięcia. Konglomeratów i spieków to NIE dotyczy.
 *
 * Historia stawki (wszystko 2026): 10% wartości płyt → 100 zł/m² → usunięty
 * → 300 zł/m² od 17.08. Podstawą są metry ELEMENTÓW blatu, spójnie z montażem.
 *
 * Stawka jest zapisana brutto przy 23%, więc przy sprzedaży z montażem (8%)
 * schodzi do 300 ÷ 1,23 × 1,08 za metr.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { wycen } from '../src/engine/wycena.js';
import { VAT_MONTAZ, VAT_TOWAR } from '../src/firms/_domyslne.js';

const STAWKA = 300; // brutto przy 23%
const nettoStawki = (bruttoDwadziesciaTrzy) => bruttoDwadziesciaTrzy / 1.23;

/* Minimalne konfiguracje firm — bez importu cenników, żeby test był
   niezależny od tego, co akurat jest w katalogu. */
const ROBOCIZNA = [
  { id: 'obrobka', label: 'Obróbka', cena: 350, per: 'mb' },
  { id: 'montaz', label: 'Montaż', cena: 150, per: 'mb' },
];

const NATURALNY = {
  slug: 'test-naturalny',
  nazwa: 'Kamień naturalny',
  typ: 'granit · marmur · kwarcyt',
  aktywna: true,
  trybCeny: 'reczna',
  cenaRecznaJest: 'brutto',
  rozliczenieMaterialu: 'plyty',
  cenyUslug: 'brutto',
  plyta: { w: 300, h: 180, polowkaDozwolona: false },
  robocizna: ROBOCIZNA,
  opcje: [],
  obrobkaNaturalnaZaM2: STAWKA,
};

const KONGLOMERAT = {
  ...NATURALNY,
  slug: 'test-konglomerat',
  nazwa: 'Konglomerat',
  typ: 'konglomerat kwarcowy',
  trybCeny: 'katalog',
  dekory: { Testowy: { 20: 800 } },
  obrobkaNaturalnaZaM2: 0,
};

const LAZIENKA = [{ gl: 60, dl: 120 }];
const KUCHNIA = [{ gl: 60, dl: 300 }];

const licz = (odcinki, dodatkowe = {}) =>
  wycen(NATURALNY, { odcinki, opcje: {}, cenaRecznaM2: 1000, ...dodatkowe });
const dodatek = (w) => w.pozycje.find((p) => p.nazwa === 'Obróbka kamienia naturalnego');

/* ────────────────────────────────────────────── kamień naturalny: dolicza */

test('kamień naturalny dostaje 300 zł za m² blatu', () => {
  const w = licz(LAZIENKA);
  const d = dodatek(w);
  assert.ok(d, 'brak pozycji z dodatkiem');
  assert.equal(d.grupa, 'usługi', 'dodatek musi wejść w produkcję i montaż');
  const oczekiwane = nettoStawki(STAWKA) * (1 + VAT_MONTAZ) * w.pak.m2Blatu;
  assert.ok(Math.abs(d.brutto - oczekiwane) < 0.01, `${d.brutto} ≠ ${oczekiwane}`);
});

test('liczymy od elementów blatu, nie od kupionej płyty', () => {
  const w = licz(LAZIENKA);
  // Płyta 300×180 na blat 60×120 — odpadu jest wielokrotnie więcej niż blatu.
  assert.ok(w.pak.m2Kupione > w.pak.m2Blatu * 2, 'test bez sensu, gdyby metraże były zbliżone');
  const naM2 = dodatek(w).brutto / w.pak.m2Blatu;
  assert.ok(Math.abs(naM2 - nettoStawki(STAWKA) * (1 + VAT_MONTAZ)) < 0.01);
});

test('dodatek rośnie liniowo z powierzchnią blatu', () => {
  const mala = licz(LAZIENKA);
  const duza = licz(KUCHNIA);
  const naM2 = (w) => dodatek(w).brutto / w.pak.m2Blatu;
  assert.ok(dodatek(duza).brutto > dodatek(mala).brutto);
  assert.ok(Math.abs(naM2(mala) - naM2(duza)) < 0.01, 'stawka ma być płaska');
});

test('dodatek NIE zależy od ceny kamienia — to praca, nie narzut', () => {
  const tani = licz(LAZIENKA, { cenaRecznaM2: 500 });
  const drogi = licz(LAZIENKA, { cenaRecznaM2: 1900 });
  assert.ok(Math.abs(dodatek(tani).brutto - dodatek(drogi).brutto) < 0.01);
});

test('stawka schodzi do właściwego VAT-u wariantu', () => {
  const zMontazem = licz(LAZIENKA, { opcje: { dostawa: 'montaz' } });
  const odbior = licz(LAZIENKA, { opcje: { dostawa: 'odbior' } });
  const naM2 = (w) => dodatek(w).brutto / w.pak.m2Blatu;
  assert.ok(Math.abs(naM2(zMontazem) - nettoStawki(STAWKA) * (1 + VAT_MONTAZ)) < 0.01);
  assert.ok(Math.abs(naM2(odbior) - nettoStawki(STAWKA) * (1 + VAT_TOWAR)) < 0.01);
  // Przy 23% kwota wraca do stawki wpisanej w konfiguracji.
  assert.ok(Math.abs(naM2(odbior) - STAWKA) < 0.01);
});

/* ─────────────────────────────────────── konglomerat i spiek: NIE dolicza */

test('konglomerat nie dostaje dodatku', () => {
  const w = wycen(KONGLOMERAT, { dekor: 'Testowy', grubosc: '20', odcinki: LAZIENKA, opcje: {} });
  assert.equal(dodatek(w), undefined);
});

test('firma bez ustawionej stawki nic nie dolicza', () => {
  const bezStawki = { ...NATURALNY, obrobkaNaturalnaZaM2: undefined };
  const w = wycen(bezStawki, { odcinki: LAZIENKA, opcje: {}, cenaRecznaM2: 1000 });
  assert.equal(dodatek(w), undefined);
});

/* ────────────────────────── co widzi klient, a co widzi firma */

test('klient widzi metraż, ale nie stawkę', () => {
  const d = dodatek(licz(LAZIENKA));
  assert.match(d.detal, /m²/);
  assert.doesNotMatch(d.detal, /zł/, 'kwoty w detalu klienta być nie może');
});

test('mail firmowy dostaje stawkę i podstawę', () => {
  const d = dodatek(licz(LAZIENKA));
  assert.match(d.detalFirmowy, /m² × 300 zł/);
  assert.match(d.detalFirmowy, /stawki brutto 23%, wycena po 8%/);
});

test('karta klienta nadal ma tylko dwie grupy kwot', () => {
  const w = licz(LAZIENKA);
  assert.deepEqual([...new Set(w.pozycje.map((p) => p.grupa))].sort(), ['materiał', 'usługi']);
  const suma = w.pozycje.reduce((a, p) => a + p.brutto, 0);
  assert.ok(Math.abs(suma - (w.materialBrutto + w.uslugiBrutto)) < 0.01);
});

test('dodatek podnosi wycenę dokładnie o swoją kwotę', () => {
  const bez = wycen(
    { ...NATURALNY, obrobkaNaturalnaZaM2: 0 },
    { odcinki: LAZIENKA, opcje: {}, cenaRecznaM2: 1000 }
  );
  const z = licz(LAZIENKA);
  assert.ok(Math.abs(z.razem - bez.razem - dodatek(z).brutto) < 0.01);
});

test('bez wybranej płyty dodatek i tak się liczy — praca jest znana', () => {
  const w = wycen(NATURALNY, { odcinki: LAZIENKA, opcje: {} });
  assert.ok(dodatek(w), 'materiał bywa „do ustalenia", robocizna nie');
});

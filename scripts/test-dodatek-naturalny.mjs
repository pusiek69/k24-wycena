/**
 * Dodatek za obróbkę kamienia naturalnego — 100 zł za m² blatu.
 *
 *   node --test scripts/test-dodatek-naturalny.mjs
 *
 * Zgłoszenie Dawida (sierpień 2026): przy małych zleceniach łazienkowych
 * wycena kamienia naturalnego wychodziła poniżej ceny rynkowej, bo robocizna
 * liczona od metra bieżącego nie pokrywa przygotowania płyty.
 *
 * Pierwotnie dodatek liczył się jako 10% wartości płyt. Od sierpnia 2026
 * jest to stawka od metra — dodatek pokrywa PRACĘ, a ta nie rośnie z ceną
 * kamienia. Metry bierzemy z elementów blatu, spójnie z montażem.
 *
 * Testy pilnują trzech rzeczy naraz:
 *   • dodatek jest doliczany kamieniowi naturalnemu i NIE jest konglomeratom,
 *   • wchodzi w grupę „usługi", więc na karcie klienta ląduje w jednej kwocie
 *     „produkcja i montaż", a nie jako osobna cena,
 *   • stawka jest widoczna tylko w polu dla firmy.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { wycen } from '../src/engine/wycena.js';

const ZA_M2 = 100;

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
  vat: 0.23,
  cenyUslug: 'brutto',
  plyta: { w: 300, h: 180, polowkaDozwolona: false },
  robocizna: ROBOCIZNA,
  opcje: [],
  obrobkaNaturalnaZaM2: ZA_M2,
};

const KONGLOMERAT = {
  ...NATURALNY,
  slug: 'test-konglomerat',
  nazwa: 'Konglomerat',
  typ: 'konglomerat kwarcowy',
  trybCeny: 'katalog',
  rozliczenieMaterialu: 'plyty',
  dekory: { Testowy: { 20: 800 } },
  obrobkaNaturalnaZaM2: 0,
};

/** Blat łazienkowy — mały, czyli dokładnie ten przypadek, o który poszło. */
const LAZIENKA = [{ gl: 60, dl: 120 }];
const KUCHNIA = [{ gl: 60, dl: 300 }];

const dodatek = (w) => w.pozycje.find((p) => p.nazwa === 'Obróbka kamienia naturalnego');

/* ────────────────────────────────────────────── kamień naturalny: dolicza */

test('kamień naturalny dostaje 100 zł za m² blatu', () => {
  const w = wycen(NATURALNY, { odcinki: LAZIENKA, opcje: {}, cenaRecznaM2: 1000 });
  const d = dodatek(w);
  assert.ok(d, 'brak pozycji z dodatkiem');
  assert.equal(d.grupa, 'usługi', 'dodatek musi wejść w produkcję i montaż');
  assert.ok(
    Math.abs(d.brutto - ZA_M2 * w.pak.m2Blatu) < 0.01,
    `dodatek ${d.brutto} ≠ ${ZA_M2} × ${w.pak.m2Blatu} m²`
  );
});

test('liczymy od elementów blatu, nie od kupionej płyty', () => {
  const w = wycen(NATURALNY, { odcinki: LAZIENKA, opcje: {}, cenaRecznaM2: 1000 });
  // Płyta 300×180 na blat 60×120 — odpadu jest wielokrotnie więcej niż blatu.
  assert.ok(w.pak.m2Kupione > w.pak.m2Blatu * 2, 'test bez sensu, gdyby metraże były zbliżone');
  assert.ok(Math.abs(dodatek(w).brutto - ZA_M2 * w.pak.m2Blatu) < 0.01);
});

test('stawka jest widoczna tylko dla firmy, nie dla klienta', () => {
  const w = wycen(NATURALNY, { odcinki: LAZIENKA, opcje: {}, cenaRecznaM2: 1000 });
  const d = dodatek(w);
  assert.equal(d.detal, undefined, 'klient nie może zobaczyć stawki w detalu');
  assert.match(d.detalFirmowy, /m² × 100 zł/);
});

test('dodatek NIE zależy od ceny kamienia — to praca, nie narzut', () => {
  const tani = wycen(NATURALNY, { odcinki: LAZIENKA, opcje: {}, cenaRecznaM2: 500 });
  const drogi = wycen(NATURALNY, { odcinki: LAZIENKA, opcje: {}, cenaRecznaM2: 1500 });
  assert.ok(
    Math.abs(dodatek(tani).brutto - dodatek(drogi).brutto) < 0.01,
    'marmur za 1500 nie tnie się trzy razy dłużej niż ten za 500'
  );
});

test('dodatek rośnie liniowo z powierzchnią blatu', () => {
  const mala = wycen(NATURALNY, { odcinki: LAZIENKA, opcje: {}, cenaRecznaM2: 1000 });
  const duza = wycen(NATURALNY, { odcinki: KUCHNIA, opcje: {}, cenaRecznaM2: 1000 });
  const naM2 = (w) => dodatek(w).brutto / w.pak.m2Blatu;
  assert.ok(dodatek(duza).brutto > dodatek(mala).brutto);
  assert.ok(Math.abs(naM2(mala) - naM2(duza)) < 0.01, 'stawka ma być płaska');
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

test('dodatek liczy się także przed wyborem konkretnej płyty', () => {
  // Kamień naturalny bez wybranej płyty — materiał jest „do ustalenia", ale
  // robocizna nie: blat i tak trzeba dociąć i wypolerować. Przy poprzedniej
  // formule (procent od materiału) nie było od czego liczyć i dodatek znikał.
  const w = wycen(NATURALNY, { odcinki: LAZIENKA, opcje: {} });
  const d = dodatek(w);
  assert.ok(d, 'praca jest znana, nawet gdy cena płyty jeszcze nie');
  assert.ok(Math.abs(d.brutto - ZA_M2 * w.pak.m2Blatu) < 0.01);
});

/* ──────────────────────────────────── karta klienta: nadal dwie kwoty */

test('karta klienta widzi dwie sumy, dodatek siedzi w usługach', () => {
  const w = wycen(NATURALNY, { odcinki: LAZIENKA, opcje: {}, cenaRecznaM2: 1000 });

  const grupy = new Set(w.pozycje.map((p) => p.grupa));
  assert.deepEqual([...grupy].sort(), ['materiał', 'usługi'], 'żadnej trzeciej grupy na karcie');

  const suma = w.pozycje.reduce((a, p) => a + p.brutto, 0);
  assert.ok(Math.abs(suma - (w.materialBrutto + w.uslugiBrutto)) < 0.01);
  assert.ok(
    Math.abs(w.uslugiBrutto - w.pozycje.filter((p) => p.grupa === 'usługi').reduce((a, p) => a + p.brutto, 0)) < 0.01,
    'dodatek musi być policzony w sumie usług'
  );
});

test('dodatek podnosi wycenę dokładnie o swoją kwotę', () => {
  const bez = wycen({ ...NATURALNY, obrobkaNaturalnaZaM2: 0 }, { odcinki: LAZIENKA, opcje: {}, cenaRecznaM2: 1000 });
  const z = wycen(NATURALNY, { odcinki: LAZIENKA, opcje: {}, cenaRecznaM2: 1000 });
  assert.ok(Math.abs(z.razem - bez.razem - dodatek(z).brutto) < 0.01);
});

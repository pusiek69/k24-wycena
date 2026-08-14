/**
 * Dodatek za obróbkę kamienia naturalnego — 10% wartości płyt.
 *
 *   node --test scripts/test-dodatek-naturalny.mjs
 *
 * Zgłoszenie Dawida (sierpień 2026): przy małych zleceniach łazienkowych
 * wycena kamienia naturalnego wychodziła poniżej ceny rynkowej, bo robocizna
 * liczona od metra bieżącego nie pokrywa przygotowania płyty.
 *
 * Testy pilnują trzech rzeczy naraz:
 *   • dodatek jest doliczany kamieniowi naturalnemu i NIE jest konglomeratom,
 *   • wchodzi w grupę „usługi", więc na karcie klienta ląduje w jednej kwocie
 *     „produkcja i montaż", a nie jako osobna cena,
 *   • stawka (10%) jest widoczna tylko w polu dla firmy.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { wycen } from '../src/engine/wycena.js';

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
  dodatekObrobkiNaturalnej: 0.1,
};

const KONGLOMERAT = {
  ...NATURALNY,
  slug: 'test-konglomerat',
  nazwa: 'Konglomerat',
  typ: 'konglomerat kwarcowy',
  trybCeny: 'katalog',
  rozliczenieMaterialu: 'plyty',
  dekory: { Testowy: { 20: 800 } },
  dodatekObrobkiNaturalnej: 0,
};

/** Blat łazienkowy — mały, czyli dokładnie ten przypadek, o który poszło. */
const LAZIENKA = [{ gl: 60, dl: 120 }];
const KUCHNIA = [{ gl: 60, dl: 300 }];

const dodatek = (w) => w.pozycje.find((p) => p.nazwa === 'Obróbka kamienia naturalnego');
const material = (w) => w.pozycje.filter((p) => p.grupa === 'materiał').reduce((a, p) => a + p.brutto, 0);

/* ────────────────────────────────────────────── kamień naturalny: dolicza */

test('kamień naturalny dostaje 10% wartości płyt', () => {
  const w = wycen(NATURALNY, { odcinki: LAZIENKA, opcje: {}, cenaRecznaM2: 1000 });
  const d = dodatek(w);
  assert.ok(d, 'brak pozycji z dodatkiem');
  assert.equal(d.grupa, 'usługi', 'dodatek musi wejść w produkcję i montaż');
  assert.ok(
    Math.abs(d.brutto - material(w) * 0.1) < 0.01,
    `dodatek ${d.brutto} ≠ 10% z ${material(w)}`
  );
});

test('stawka jest widoczna tylko dla firmy, nie dla klienta', () => {
  const w = wycen(NATURALNY, { odcinki: LAZIENKA, opcje: {}, cenaRecznaM2: 1000 });
  const d = dodatek(w);
  assert.equal(d.detal, undefined, 'klient nie może zobaczyć stawki w detalu');
  assert.match(d.detalFirmowy, /10% wartości płyt/);
});

test('dodatek rośnie razem z wartością płyty', () => {
  const tani = wycen(NATURALNY, { odcinki: LAZIENKA, opcje: {}, cenaRecznaM2: 500 });
  const drogi = wycen(NATURALNY, { odcinki: LAZIENKA, opcje: {}, cenaRecznaM2: 1500 });
  assert.ok(dodatek(drogi).brutto > dodatek(tani).brutto * 2.5);
});

test('przy małym blacie dodatek waży więcej niż przy dużym', () => {
  const mala = wycen(NATURALNY, { odcinki: LAZIENKA, opcje: {}, cenaRecznaM2: 1000 });
  const duza = wycen(NATURALNY, { odcinki: KUCHNIA, opcje: {}, cenaRecznaM2: 1000 });
  const udzial = (w) => dodatek(w).brutto / w.razem;
  assert.ok(
    udzial(mala) > udzial(duza),
    'o to właśnie chodziło: przy łazience robocizna od mb nie wystarcza'
  );
});

/* ─────────────────────────────────────── konglomerat i spiek: NIE dolicza */

test('konglomerat nie dostaje dodatku', () => {
  const w = wycen(KONGLOMERAT, { dekor: 'Testowy', grubosc: '20', odcinki: LAZIENKA, opcje: {} });
  assert.equal(dodatek(w), undefined);
});

test('firma bez ustawionej stawki nic nie dolicza', () => {
  const bezStawki = { ...NATURALNY, dodatekObrobkiNaturalnej: undefined };
  const w = wycen(bezStawki, { odcinki: LAZIENKA, opcje: {}, cenaRecznaM2: 1000 });
  assert.equal(dodatek(w), undefined);
});

test('bez podanej ceny płyty nie ma z czego liczyć dodatku', () => {
  // Kamień naturalny bez wybranej płyty — materiał „do ustalenia".
  const w = wycen(NATURALNY, { odcinki: LAZIENKA, opcje: {} });
  assert.equal(dodatek(w), undefined, 'nie wolno doliczać procentu od nieznanej kwoty');
});

/* ──────────────────────────────────── karta klienta: nadal dwie kwoty */

test('karta klienta widzi dwie sumy, dodatek siedzi w usługach', () => {
  const w = wycen(NATURALNY, { odcinki: LAZIENKA, opcje: {}, cenaRecznaM2: 1000 });

  const grupy = new Set(w.pozycje.map((p) => p.grupa));
  assert.deepEqual([...grupy].sort(), ['materiał', 'usługi'], 'żadnej trzeciej grupy na karcie');

  const suma = w.pozycje.reduce((a, p) => a + p.brutto, 0);
  assert.ok(Math.abs(suma - (w.materialBrutto + w.uslugiBrutto)) < 0.01);
  assert.ok(
    Math.abs(w.uslugiBrutto - (w.pozycje.filter((p) => p.grupa === 'usługi').reduce((a, p) => a + p.brutto, 0))) < 0.01,
    'dodatek musi być policzony w sumie usług'
  );
});

test('dodatek podnosi wycenę dokładnie o swoją kwotę', () => {
  const bez = wycen({ ...NATURALNY, dodatekObrobkiNaturalnej: 0 }, { odcinki: LAZIENKA, opcje: {}, cenaRecznaM2: 1000 });
  const z = wycen(NATURALNY, { odcinki: LAZIENKA, opcje: {}, cenaRecznaM2: 1000 });
  assert.ok(Math.abs(z.razem - bez.razem - dodatek(z).brutto) < 0.01);
});

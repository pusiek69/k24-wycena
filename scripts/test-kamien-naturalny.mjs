/**
 * Kamień naturalny liczy się tak samo jak każdy inny materiał.
 *
 *   node --test scripts/test-kamien-naturalny.mjs
 *
 * W sierpniu 2026 doliczaliśmy do niego dodatek za trudność obróbki —
 * najpierw 10% wartości płyt, potem 100 zł za m² blatu. Dawid usunął go
 * całkowicie 17.08.2026: żadnego narzutu ponad materiał i standardowe
 * pozycje (obróbka od metra bieżącego, wycięcia, otwory, montaż).
 *
 * Te testy są po to, żeby narzut nie wrócił bokiem — ani jako pole
 * w konfiguracji firmy, ani jako osobna pozycja w wycenie.
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
  cenyUslug: 'netto',
  plyta: { w: 300, h: 180, polowkaDozwolona: false },
  robocizna: ROBOCIZNA,
  opcje: [],
};

const KONGLOMERAT = {
  ...NATURALNY,
  slug: 'test-konglomerat',
  nazwa: 'Konglomerat',
  typ: 'konglomerat kwarcowy',
  trybCeny: 'katalog',
  dekory: { Testowy: { 20: 800 } },
};

/** Blat łazienkowy — mały, czyli przypadek, o który kiedyś poszło. */
const LAZIENKA = [{ gl: 60, dl: 120 }];
const KUCHNIA = [{ gl: 60, dl: 300 }];

const licz = (odcinki, cenaRecznaM2 = 1000) =>
  wycen(NATURALNY, { odcinki, opcje: {}, cenaRecznaM2 });
const nazwy = (w) => w.pozycje.map((p) => p.nazwa);

/* ─────────────────────────────────────────── żadnego dodatku za obróbkę */

test('w wycenie nie ma pozycji „Obróbka kamienia naturalnego"', () => {
  for (const odcinki of [LAZIENKA, KUCHNIA]) {
    assert.equal(
      licz(odcinki).pozycje.find((p) => /obróbk\w* kamienia|dodatek/i.test(p.nazwa)),
      undefined
    );
  }
});

test('wycena to dokładnie materiał plus standardowe pozycje', () => {
  const w = licz(LAZIENKA);
  assert.equal(w.pozycje.filter((p) => p.grupa === 'materiał').length, 1);
  assert.deepEqual(
    nazwy(w).filter((n) => n === 'Obróbka' || n === 'Montaż'),
    ['Obróbka', 'Montaż'],
    'obie standardowe pozycje robocizny'
  );
  assert.equal(w.pozycje.length, 3, 'materiał + obróbka + montaż, nic więcej');
  const suma = w.pozycje.reduce((a, p) => a + p.brutto, 0);
  assert.ok(Math.abs(suma - w.razem) < 0.01, 'nic nie dochodzi poza pozycjami');
});

test('stare pola konfiguracji nic już nie robią', () => {
  const zeStarymi = {
    ...NATURALNY,
    obrobkaNaturalnaZaM2: 100, // stawka od metra (druga wersja dodatku)
    dodatekObrobkiNaturalnej: 0.1, // procent od materiału (pierwsza wersja)
  };
  const bez = licz(LAZIENKA);
  const ze = wycen(zeStarymi, { odcinki: LAZIENKA, opcje: {}, cenaRecznaM2: 1000 });
  assert.ok(
    Math.abs(ze.razem - bez.razem) < 0.01,
    'pole zostawione w konfiguracji nie może wskrzesić dodatku'
  );
});

test('kamień naturalny i konglomerat liczą usługi tak samo', () => {
  const nat = licz(LAZIENKA);
  const kon = wycen(KONGLOMERAT, { dekor: 'Testowy', grubosc: '20', odcinki: LAZIENKA, opcje: {} });
  assert.ok(
    Math.abs(nat.uslugiBrutto - kon.uslugiBrutto) < 0.01,
    'różnica może być tylko w materiale, nie w robociźnie'
  );
});

test('cena kamienia nie wpływa na koszt usług', () => {
  const tani = licz(LAZIENKA, 500);
  const drogi = licz(LAZIENKA, 1900);
  assert.ok(drogi.materialBrutto > tani.materialBrutto, 'materiał ma się różnić');
  assert.ok(Math.abs(drogi.uslugiBrutto - tani.uslugiBrutto) < 0.01, 'usługi już nie');
});

/* ──────────────────────────────────── karta klienta: nadal dwie kwoty */

test('karta klienta widzi dwie sumy i nic poza nimi', () => {
  const w = licz(LAZIENKA);

  const grupy = new Set(w.pozycje.map((p) => p.grupa));
  assert.deepEqual([...grupy].sort(), ['materiał', 'usługi'], 'żadnej trzeciej grupy na karcie');

  const suma = w.pozycje.reduce((a, p) => a + p.brutto, 0);
  assert.ok(Math.abs(suma - (w.materialBrutto + w.uslugiBrutto)) < 0.01);
});

test('bez wybranej płyty wycena nadal się liczy', () => {
  // Materiał „do ustalenia", ale robocizna jest znana — i nic do niej
  // nie doklejamy, bo dodatku już nie ma.
  const w = wycen(NATURALNY, { odcinki: LAZIENKA, opcje: {} });
  assert.equal(w.pozycje.find((p) => /obróbk\w* kamienia/i.test(p.nazwa)), undefined);
});

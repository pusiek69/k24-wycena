/**
 * Pomiar cyfrowy Prolinerem — 1000 zł, tylko przy blatach kuchennych.
 *
 *   node --test scripts/test-pomiar-proliner.mjs
 *
 * Blat kuchenny jest łączony, wchodzi między ściany i musi trafić w zabudowę
 * co do milimetra. Blat łazienkowy to zwykle jeden prostokąt pod umywalkę —
 * pomiaru Prolinerem tam nie robimy i nie doliczamy (decyzja Dawida,
 * 17.08.2026).
 *
 * Kwota jest zapisana jako brutto przy 23%, więc przy sprzedaży z montażem
 * (8%) schodzi do 1000 ÷ 1,23 × 1,08.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { wycen } from '../src/engine/wycena.js';
import { opcjeZParametrow, opcjeZeSzczegolow } from '../src/app/parametry.js';
import { ROBOCIZNA, OPCJE, VAT_MONTAZ } from '../src/firms/_domyslne.js';

const STAWKA = 1000; // brutto przy 23%
const nettoStawki = (bruttoDwadziesciaTrzy) => bruttoDwadziesciaTrzy / 1.23;

const FIRMA = {
  slug: 'test',
  nazwa: 'Test',
  typ: 'konglomerat kwarcowy',
  aktywna: true,
  trybCeny: 'katalog',
  cenyUslug: 'brutto',
  plyta: { w: 320, h: 160, polowkaDozwolona: true },
  robocizna: ROBOCIZNA,
  opcje: OPCJE,
  dekory: { Testowy: { 20: 800 } },
};

const KUCHNIA = [{ gl: 60, dl: 300 }, { gl: 60, dl: 130 }];
const LAZIENKA = [{ gl: 60, dl: 120 }];

const licz = (odcinki, params) =>
  wycen(FIRMA, { dekor: 'Testowy', grubosc: '20', odcinki, opcje: opcjeZParametrow(params) });
const pomiar = (w) => w.pozycje.find((p) => /Proliner/i.test(p.nazwa));

/* ────────────────────────────────────────────── kuchnia płaci */

test('kuchnia dostaje pozycję pomiaru', () => {
  const w = licz(KUCHNIA, { pomieszczenie: 'kuchnia', otwory: 1 });
  const p = pomiar(w);
  assert.ok(p, 'brak pozycji pomiaru');
  assert.equal(p.grupa, 'usługi', 'ma wejść w produkcję i montaż');
  assert.match(p.nazwa, /Pomiar cyfrowy Proliner/);
});

test('pomiar to 1000 zł brutto 23%, przeliczone stawką wariantu', () => {
  const w = licz(KUCHNIA, { pomieszczenie: 'kuchnia', otwory: 1 });
  const oczekiwane = nettoStawki(STAWKA) * (1 + VAT_MONTAZ);
  assert.ok(Math.abs(pomiar(w).brutto - oczekiwane) < 0.01, `${pomiar(w).brutto} ≠ ${oczekiwane}`);
});

test('pomiar naliczany RAZ, niezależnie od liczby odcinków', () => {
  const jeden = licz([{ gl: 60, dl: 300 }], { pomieszczenie: 'kuchnia', otwory: 1 });
  const trzy = licz(
    [{ gl: 60, dl: 200 }, { gl: 60, dl: 150 }, { gl: 90, dl: 120 }],
    { pomieszczenie: 'kuchnia', otwory: 1 }
  );
  assert.equal(trzy.pozycje.filter((p) => /Proliner/i.test(p.nazwa)).length, 1);
  assert.ok(Math.abs(pomiar(jeden).brutto - pomiar(trzy).brutto) < 0.01);
});

test('pomiar nie zależy od metrażu ani ceny materiału', () => {
  const mala = licz(LAZIENKA, { pomieszczenie: 'kuchnia', otwory: 1 });
  const duza = licz([{ gl: 60, dl: 400 }, { gl: 60, dl: 320 }], { pomieszczenie: 'kuchnia', otwory: 1 });
  assert.ok(Math.abs(pomiar(mala).brutto - pomiar(duza).brutto) < 0.01);
});

/* ────────────────────────────────────────── łazienka nie płaci */

test('łazienka nie dostaje pozycji pomiaru', () => {
  for (const dodatkowe of [{}, { odbior_wlasny: true }]) {
    const w = licz(LAZIENKA, { pomieszczenie: 'lazienka', otwory: 1, ...dodatkowe });
    assert.equal(pomiar(w), undefined, JSON.stringify(dodatkowe));
  }
});

test('ta sama łazienka wyceniona jak kuchnia jest droższa dokładnie o pomiar', () => {
  const jakLazienka = licz(LAZIENKA, { pomieszczenie: 'lazienka', otwory: 1 });
  const jakKuchnia = licz(LAZIENKA, { pomieszczenie: 'kuchnia', otwory: 1 });
  // Kuchnia ma jeszcze wycięcie pod płytę grzewczą — odejmujemy je,
  // żeby zostało samo porównanie pomiaru.
  const plytaGrzewcza = jakKuchnia.pozycje.find((p) => /płyt[ęy] nakładan/i.test(p.nazwa)).brutto;
  const roznica = jakKuchnia.razem - jakLazienka.razem - plytaGrzewcza;
  assert.ok(Math.abs(roznica - pomiar(jakKuchnia).brutto) < 0.01, `różnica ${roznica}`);
});

test('kreator bez konsultanta trzyma tę samą zasadę', () => {
  const zKreatora = (pomieszczenie) =>
    wycen(FIRMA, {
      dekor: 'Testowy',
      grubosc: '20',
      odcinki: LAZIENKA,
      opcje: opcjeZeSzczegolow({ otwory: 1 }, pomieszczenie),
    });
  assert.ok(pomiar(zKreatora('kuchnia')));
  assert.equal(pomiar(zKreatora('lazienka')), undefined);
});

test('brak podanego pomieszczenia znaczy kuchnia — pomiar doliczony', () => {
  const w = licz(KUCHNIA, { otwory: 1 });
  assert.ok(pomiar(w), 'domyślnie liczymy jak kuchnię');
});

/* ─────────────────────── co widzi klient, a co widzi firma */

test('klient nie widzi kwoty pomiaru w detalu pozycji', () => {
  const p = pomiar(licz(KUCHNIA, { pomieszczenie: 'kuchnia', otwory: 1 }));
  assert.doesNotMatch(String(p.detal || ''), /zł/);
});

test('karta klienta nadal ma tylko dwie grupy kwot', () => {
  const w = licz(KUCHNIA, { pomieszczenie: 'kuchnia', otwory: 1 });
  assert.deepEqual([...new Set(w.pozycje.map((p) => p.grupa))].sort(), ['materiał', 'usługi']);
  const suma = w.pozycje.reduce((a, p) => a + p.brutto, 0);
  assert.ok(Math.abs(suma - (w.materialBrutto + w.uslugiBrutto)) < 0.01);
});

test('rozbicie firmowe mówi „raz na zlecenie", nie „1 m²"', () => {
  const p = pomiar(licz(KUCHNIA, { pomieszczenie: 'kuchnia', otwory: 1 }));
  assert.match(p.detalFirmowy, /1000 zł raz na zlecenie/);
  assert.doesNotMatch(p.detalFirmowy, /m²/, 'pomiar nie jest liczony od metra');
});

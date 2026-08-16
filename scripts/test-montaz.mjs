/**
 * Montaż: baza 1500 zł raz na zamówienie + 200 zł/m² powierzchni elementów.
 *
 *   node --test scripts/test-montaz.mjs
 *
 * Wcześniej było 150 zł od metra bieżącego. Zmiana wynikła z tego, że koszt
 * wyjazdu nie rośnie proporcjonalnie do długości blatu — ekipa jedzie tak samo
 * po blat łazienkowy, jak po kuchnię (zgłoszenie Dawida, sierpień 2026).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { wycen } from '../src/engine/wycena.js';
import { ROBOCIZNA, OPCJE, VAT } from '../src/firms/_domyslne.js';

const BAZA = 1500;
const ZA_M2 = 200;

const FIRMA = {
  slug: 'test',
  nazwa: 'Test',
  typ: 'konglomerat kwarcowy',
  aktywna: true,
  trybCeny: 'katalog',
  vat: VAT,
  cenyUslug: 'brutto',
  plyta: { w: 320, h: 160, polowkaDozwolona: true },
  robocizna: ROBOCIZNA,
  opcje: OPCJE,
  dekory: { Testowy: { 20: 800 } },
};

const licz = (odcinki, opcje = {}) =>
  wycen(FIRMA, { dekor: 'Testowy', grubosc: '20', odcinki, opcje });
const montaz = (w) => w.pozycje.find((p) => p.nazwa.startsWith('Transport i montaż'));
const oczekiwany = (m2) => BAZA + ZA_M2 * m2;

/* ─────────────────────────────────────────────────────────── sama formuła */

test('montaż to baza plus stawka od powierzchni elementów', () => {
  const w = licz([{ gl: 60, dl: 300 }]);
  const m2 = w.pak.m2Blatu;
  assert.ok(Math.abs(m2 - 1.8) < 0.001, `powierzchnia blatu ${m2}`);
  assert.ok(Math.abs(montaz(w).brutto - oczekiwany(1.8)) < 0.01);
});

test('liczy od powierzchni ELEMENTÓW, nie od zużytej płyty', () => {
  // Blat 0,72 m² wycina się z połówki płyty 320 × 160, czyli z 2,56 m².
  // Montaż ma zależeć od blatu, nie od tego, ile materiału trzeba kupić.
  const w = licz([{ gl: 60, dl: 120 }]);
  assert.ok(
    w.pak.m2Kupione > w.pak.m2Blatu * 3,
    `kupujemy dużo więcej niż blat: ${w.pak.m2Kupione} vs ${w.pak.m2Blatu}`
  );
  assert.ok(Math.abs(montaz(w).brutto - oczekiwany(0.72)) < 0.01);
});

/* ────────────────────────────────────── baza raz, niezależnie od elementów */

test('baza naliczana RAZ przy wielu elementach', () => {
  const jeden = licz([{ gl: 60, dl: 300 }]);
  const trzy = licz([{ gl: 60, dl: 100 }, { gl: 60, dl: 100 }, { gl: 60, dl: 100 }]);
  assert.ok(Math.abs(jeden.pak.m2Blatu - trzy.pak.m2Blatu) < 0.001, 'ta sama powierzchnia');
  assert.ok(
    Math.abs(montaz(jeden).brutto - montaz(trzy).brutto) < 0.01,
    'trzy odcinki nie mogą oznaczać trzech baz'
  );
});

test('w całej wycenie jest dokładnie jedna pozycja montażu', () => {
  const w = licz([{ gl: 60, dl: 200 }, { gl: 60, dl: 150 }, { gl: 90, dl: 120 }]);
  assert.equal(w.pozycje.filter((p) => p.nazwa.startsWith('Transport i montaż')).length, 1);
});

/* ─────────────────────────────────────────────── zachowanie wg wielkości */

test('przy małym zleceniu montaż waży więcej niż przy dużym', () => {
  const mala = licz([{ gl: 60, dl: 120 }]);
  const duza = licz([{ gl: 60, dl: 400 }, { gl: 60, dl: 320 }]);
  const udzial = (w) => montaz(w).brutto / w.razem;
  assert.ok(udzial(mala) > udzial(duza));
});

test('głębszy blat płaci więcej za ten sam metr bieżący', () => {
  const plytki = licz([{ gl: 30, dl: 200 }]);
  const gleboki = licz([{ gl: 90, dl: 200 }]);
  assert.ok(montaz(gleboki).brutto > montaz(plytki).brutto, 'stawka jest od m², nie od m.b.');
});

/* ───────────────────────────────────────────────── ścieżka metrażowa */

test('metrażówka też dostaje bazę i stawkę od blatu', () => {
  const naturalny = {
    ...FIRMA,
    typ: 'granit · marmur · kwarcyt',
    trybCeny: 'reczna',
    cenaRecznaJest: 'brutto',
    rozliczenieMaterialu: 'metraz',
    narzutOdpad: 0.15,
    dodatekObrobkiNaturalnej: 0.1,
  };
  const w = wycen(naturalny, { odcinki: [{ gl: 55, dl: 90 }], opcje: {}, cenaRecznaM2: 1200 });
  assert.ok(Math.abs(montaz(w).brutto - oczekiwany(w.pak.m2Blatu)) < 0.01);
  // Metraż płatny jest większy od blatu (narzut na odpad) — montaż go ignoruje.
  assert.ok(w.m2Platne > w.pak.m2Blatu);
});

/* ────────────────────────────────── co widzi klient, a co widzi firma */

test('klient nie widzi stawki montażu, firma widzi rozbicie', () => {
  const w = licz([{ gl: 60, dl: 300 }]);
  const m = montaz(w);
  assert.doesNotMatch(m.detal, /zł/, 'w detalu dla klienta nie może być kwoty');
  assert.match(m.detal, /m²/, 'ilość zostaje');
  assert.match(m.detalFirmowy, /baza 1 ?500 zł \+ .* m² × 200 zł/);
});

test('karta klienta nadal ma tylko dwie grupy kwot', () => {
  const w = licz([{ gl: 60, dl: 300 }], { zlew: 'podblat', plyta: 'nakladana', otwory: 2 });
  assert.deepEqual([...new Set(w.pozycje.map((p) => p.grupa))].sort(), ['materiał', 'usługi']);
  const suma = w.pozycje.reduce((a, p) => a + p.brutto, 0);
  assert.ok(Math.abs(suma - (w.materialBrutto + w.uslugiBrutto)) < 0.01);
});

test('montaż wchodzi w usługi, nie w materiał', () => {
  const w = licz([{ gl: 60, dl: 300 }]);
  assert.equal(montaz(w).grupa, 'usługi');
});

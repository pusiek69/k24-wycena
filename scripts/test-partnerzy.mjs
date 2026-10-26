/**
 * PROGRAM PARTNERSKI — MVP (zlecenie Dawida, 26.10.2026).
 *
 *   node --test scripts/test-partnerzy.mjs
 *
 * Spec: docs/specs/2026-10-26-program-partnerski-design.md.
 * Decyzje wiążące: 15% pierwsze wygrane zlecenie partnera → 10% kolejne →
 * 15% Premium; prowizja od CAŁOŚCI netto (po rabacie — kwota, którą klient
 * realnie płaci); stawki NIEJAWNE publicznie; wszystko konfigurowalne
 * w panelu; przypisanie klienta 365 dni (konfigurowalne).
 *
 * Tu: czyste reguły (etap 1) + testy po źródle frontu i strony (etapy 3/5).
 * Drogę przez prawdziwego workera (przypisanie leada, /partner, panel)
 * pilnuje scripts/test-worker-smoke.mjs.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  KONFIG_DOMYSLNA,
  KLUCZE_KONFIGU,
  stawkaProwizji,
  prowizja,
  nettoZlecenia,
  kodWazny,
  poprawnyKod,
} from '../worker/partnerzy.js';

const zrodlo = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/* ══════════════════════════ etap 1: reguły prowizji ══════════════════════ */

test('STAWKA: 15% pierwsze, 10% kolejne, Premium zawsze 15%', () => {
  const k = KONFIG_DOMYSLNA;
  assert.equal(stawkaProwizji({ premium: false, pierwsze: true, konfig: k }), 15);
  assert.equal(stawkaProwizji({ premium: false, pierwsze: false, konfig: k }), 10);
  assert.equal(stawkaProwizji({ premium: true, pierwsze: true, konfig: k }), 15);
  assert.equal(stawkaProwizji({ premium: true, pierwsze: false, konfig: k }), 15);
});

test('STAWKA: konfiguracja z panelu nadpisuje domyślne — to jest furtka Dawida', () => {
  const k = { ...KONFIG_DOMYSLNA, procPierwsze: 12, procKolejne: 7, procPremium: 20 };
  assert.equal(stawkaProwizji({ premium: false, pierwsze: true, konfig: k }), 12);
  assert.equal(stawkaProwizji({ premium: false, pierwsze: false, konfig: k }), 7);
  assert.equal(stawkaProwizji({ premium: true, pierwsze: false, konfig: k }), 20);
});

test('KONFIG: domyślne dokładnie wg decyzji (15/10/15, całość, 365 dni)', () => {
  assert.deepEqual(KONFIG_DOMYSLNA, {
    procPierwsze: 15,
    procKolejne: 10,
    procPremium: 15,
    podstawa: 0,
    dni: 365,
  });
  // Klucze w bazie ustawień — z prefiksem `partner`, żeby dało się je
  // ODFILTROWAĆ z publicznego /ustawienia (stawki są niejawne).
  assert.deepEqual(Object.values(KLUCZE_KONFIGU).sort(), [
    'partnerDniPrzypisania',
    'partnerPodstawa',
    'partnerProcKolejne',
    'partnerProcPierwsze',
    'partnerProcPremium',
  ]);
  for (const klucz of Object.values(KLUCZE_KONFIGU))
    assert.match(klucz, /^partner/, `klucz ${klucz} bez prefiksu partner — wycieknie publicznie`);
});

test('NETTO: liczone z ostatniej wyceny po stawce VAT z oferty', () => {
  assert.deepEqual(nettoZlecenia({ razem: 12960, stawkaVat: 0.08 }, 0), {
    netto: 12000,
    zPodgladu: false,
  });
  assert.deepEqual(nettoZlecenia({ razem: 12300, stawkaVat: 0.23 }, 0), {
    netto: 10000,
    zPodgladu: false,
  });
});

test('NETTO: po rabacie, nie przed — klient tyle realnie płaci (decyzja Dawida)', () => {
  const w = nettoZlecenia({ razem: 10800, razemPrzed: 12960, stawkaVat: 0.08 }, 0);
  assert.equal(w.netto, 10000, 'prowizja ma iść od kwoty po rabacie');
});

test('NETTO: bez wyceny — kwota karty / 1,08 i flaga „sprawdź podstawę"', () => {
  assert.deepEqual(nettoZlecenia(null, 10800), { netto: 10000, zPodgladu: true });
  assert.deepEqual(nettoZlecenia({ cokolwiek: 1 }, 10800), { netto: 10000, zPodgladu: true });
  assert.deepEqual(nettoZlecenia(null, 0), { netto: 0, zPodgladu: true });
});

test('PROWIZJA: co do złotówki, pół złotego w górę', () => {
  assert.equal(prowizja(10000, 15), 1500);
  assert.equal(prowizja(3333, 10), 333); // 333,30 → 333
  assert.equal(prowizja(10003, 15), 1500); // 1500,45 → 1500
  assert.equal(prowizja(10010, 15), 1502); // 1501,50 → 1502
  assert.equal(prowizja(0, 15), 0);
});

test('WAŻNOŚĆ KODU: 365 dni domyślnie, granice co do dnia', () => {
  const teraz = Date.UTC(2026, 9, 26);
  const d = 86400000;
  assert.equal(kodWazny({ od: teraz - 364 * d, teraz, dni: 365 }), true);
  assert.equal(kodWazny({ od: teraz - 365 * d, teraz, dni: 365 }), true, 'równo 365 dni jeszcze działa');
  assert.equal(kodWazny({ od: teraz - 366 * d, teraz, dni: 365 }), false);
});

test('WAŻNOŚĆ KODU: konfigurowalny okres — 30 dni tnie po 30 dniach', () => {
  const teraz = Date.UTC(2026, 9, 26);
  const d = 86400000;
  assert.equal(kodWazny({ od: teraz - 29 * d, teraz, dni: 30 }), true);
  assert.equal(kodWazny({ od: teraz - 31 * d, teraz, dni: 30 }), false);
});

test('WAŻNOŚĆ KODU: śmieci nie przechodzą', () => {
  const teraz = Date.now();
  assert.equal(kodWazny({ od: 0, teraz, dni: 365 }), false);
  assert.equal(kodWazny({ od: NaN, teraz, dni: 365 }), false);
  assert.equal(kodWazny({ od: 'wczoraj', teraz, dni: 365 }), false);
});

test('KOD PARTNERA: małe litery, cyfry, myślnik, 3–24 znaki', () => {
  assert.equal(poprawnyKod('kowalski'), true);
  assert.equal(poprawnyKod('meble-anna-24'), true);
  assert.equal(poprawnyKod('ab'), false);
  assert.equal(poprawnyKod('a'.repeat(25)), false);
  assert.equal(poprawnyKod('Kowalski'), false);
  assert.equal(poprawnyKod('ko d'), false);
  assert.equal(poprawnyKod('ko!d'), false);
  assert.equal(poprawnyKod(42), false);
  assert.equal(poprawnyKod(null), false);
});

/* ══════════════ etap 3: kod partnerski w przeglądarce klienta ════════════ */

const { zapamietajPartnera, partnerDoLeada } = await import('../src/app/partner.js');

/** Atrapa localStorage — testy biegają w gołym node. */
function atrapaStorage(poczatek = {}) {
  const dane = { ...poczatek };
  return {
    getItem: (k) => (k in dane ? dane[k] : null),
    setItem: (k, v) => {
      dane[k] = String(v);
    },
    removeItem: (k) => {
      delete dane[k];
    },
    _dane: dane,
  };
}

test('LINK ?p=KOD zapisuje kod z datą wejścia', () => {
  const st = atrapaStorage();
  zapamietajPartnera({ search: '?p=kowalski&utm_source=fb', storage: st, teraz: 1000 });
  assert.deepEqual(JSON.parse(st._dane['k24h-partner']), { kod: 'kowalski', od: 1000 });
});

test('PIERWSZY KOD WYGRYWA — drugi partner nie podbiera klienta', () => {
  const st = atrapaStorage();
  zapamietajPartnera({ search: '?p=kowalski', storage: st, teraz: 1000 });
  zapamietajPartnera({ search: '?p=nowak', storage: st, teraz: 2000 });
  assert.equal(JSON.parse(st._dane['k24h-partner']).kod, 'kowalski');
});

test('kod ze śmieciami nie zapisuje się wcale', () => {
  const st = atrapaStorage();
  for (const s of ['?p=AB', '?p=a', '?p=ko%20d', '?p=' + 'x'.repeat(30), '?q=kowalski', ''])
    zapamietajPartnera({ search: s, storage: st, teraz: 1000 });
  assert.equal(st._dane['k24h-partner'], undefined);
});

test('wpis starszy niż 400 dni jest sprzątany i nowy kod może wejść', () => {
  const d = 86400000;
  const st = atrapaStorage({ 'k24h-partner': JSON.stringify({ kod: 'stary', od: 0 }) });
  zapamietajPartnera({ search: '?p=nowak', storage: st, teraz: 401 * d });
  assert.equal(JSON.parse(st._dane['k24h-partner']).kod, 'nowak', 'przeterminowany wpis miał ustąpić');
});

test('partnerDoLeada oddaje {kod, od} albo null — o ważności decyduje SERWER', () => {
  const st = atrapaStorage({ 'k24h-partner': JSON.stringify({ kod: 'kowalski', od: 1000 }) });
  assert.deepEqual(partnerDoLeada({ storage: st, teraz: 2000 }), { kod: 'kowalski', od: 1000 });
  assert.equal(partnerDoLeada({ storage: atrapaStorage(), teraz: 2000 }), null);
  // Zepsuty wpis (ręczna edycja storage) nie wywraca bramki.
  const zepsuty = atrapaStorage({ 'k24h-partner': '{nie-json' });
  assert.equal(partnerDoLeada({ storage: zepsuty, teraz: 2000 }), null);
});

test('PODŁĄCZENIE (wzorzec 30.08: funkcja bez podłączenia to połowa roboty)', () => {
  assert.match(zrodlo('src/main.js'), /zapamietajPartnera\(\)/, 'main.js nie łapie ?p= przy wejściu');
  assert.match(zrodlo('src/app/bramka.js'), /partner: partnerDoLeada\(\)/, 'bramka nie dokleja partnera do leada');
});

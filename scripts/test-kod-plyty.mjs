/**
 * Kamień naturalny WYŁĄCZNIE ze wskazaną płytą.
 *
 *   node --test scripts/test-kod-plyty.mjs
 *
 * Każdy blok kamienia naturalnego ma własną cenę, wymiar i dostępność —
 * różnica między blokami tego samego wzoru sięga kilkuset złotych za m².
 * Wycena „z metra", bez wskazania płyty, wychodziła przez to systematycznie
 * poniżej realnej ceny. Od 17.08.2026 bez kodu płyty nie liczymy nic.
 *
 * Konglomeratów i spieków to NIE dotyczy — te mają cennik katalogowy.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { wycen } from '../src/engine/wycena.js';
import { ROBOCIZNA, OPCJE } from '../src/firms/_domyslne.js';
import { normalizujKod, znajdzPoKodzie, wygladaJakKod } from '../worker/magazyn.js';
import { wariantZPlyty } from '../src/app/plyta-kod.js';

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
  opcje: OPCJE,
  wymagaKoduPlyty: true,
};

const KONGLOMERAT = {
  ...NATURALNY,
  slug: 'test-konglomerat',
  nazwa: 'Konglomerat',
  typ: 'konglomerat kwarcowy',
  trybCeny: 'katalog',
  dekory: { Testowy: { 20: 800 } },
  wymagaKoduPlyty: false,
};

const ODCINKI = [{ gl: 60, dl: 120 }];
const OPCJE_BAZOWE = { zlew: 'podblat', plyta: 'brak', otwory: 1, dostawa: 'montaz' };
const KOD = 'STON000334-84224';

const liczNaturalny = (dodatkowe = {}) =>
  wycen(NATURALNY, { odcinki: ODCINKI, opcje: OPCJE_BAZOWE, cenaRecznaM2: 1400, ...dodatkowe });

/* ───────────────────────────────────────── bez kodu nie ma wyceny */

test('kamień naturalny bez kodu płyty nie przechodzi do wyceny', () => {
  const w = liczNaturalny();
  assert.equal(w.ok, false);
  assert.equal(w.brakKoduPlyty, true, 'front po tym pozna, że ma pokazać wybór płyty');
});

test('komunikat mówi wprost, czego brakuje', () => {
  const w = liczNaturalny();
  assert.match(w.blad, /kod/i);
  assert.match(w.blad, /płyt/i);
});

test('sama cena z metra nie wystarczy — to była właśnie zabijana ścieżka', () => {
  const w = liczNaturalny({ cenaRecznaM2: 1400, kodPlyty: '' });
  assert.equal(w.ok, false);
});

/* ─────────────────────────────────────── z kodem liczy jak dotąd */

test('z kodem wycena przechodzi i liczy całe płyty', () => {
  const w = liczNaturalny({ kodPlyty: KOD });
  assert.equal(w.ok, true);
  // Blat 0,72 m² z płyty 300×180 — płacimy za całą płytę, nie za metraż.
  assert.ok(w.pak.m2Kupione > w.pak.m2Blatu * 5, `m² kupione ${w.pak.m2Kupione}`);
  assert.ok(w.materialBrutto > 0);
});

test('kod trafia do wyniku i na pozycję materiału', () => {
  const w = liczNaturalny({ kodPlyty: KOD, dekor: 'Kwarcyt' });
  assert.equal(w.kodPlyty, KOD);
  const material = w.pozycje.find((p) => p.grupa === 'materiał');
  assert.match(material.nazwa, new RegExp(KOD));
});

test('bez kodu przy konglomeracie nic się nie zmienia', () => {
  const w = wycen(KONGLOMERAT, {
    dekor: 'Testowy',
    grubosc: '20',
    odcinki: ODCINKI,
    opcje: OPCJE_BAZOWE,
  });
  assert.equal(w.ok, true);
  assert.equal(w.kodPlyty, null);
});

test('spiek i konglomerat z Interstone też liczą się bez kodu', () => {
  // InterQ i Laminam sprzedaje się z katalogu — wymóg dotyczy tylko naturali.
  const interQ = { ...NATURALNY, wymagaKoduPlyty: false };
  assert.equal(wycen(interQ, { odcinki: ODCINKI, opcje: OPCJE_BAZOWE, cenaRecznaM2: 900 }).ok, true);
});

/* ──────────────────────────────────────────── format i szukanie kodu */

test('kod normalizuje się niezależnie od zapisu klienta', () => {
  for (const zapis of [
    'STON000334 - 84224',
    'ston000334-84224',
    ' STON000334  -  84224 ',
    'STON000334–84224', // półpauza zamiast dywizu
  ]) {
    assert.equal(normalizujKod(zapis), KOD, `zapis: ${zapis}`);
  }
});

test('to, co nie jest kodem, odpada', () => {
  for (const zly of ['', null, 'calacatta', 'STON334-1', '000334-84224', 'STONE000334-84224']) {
    assert.equal(normalizujKod(zly), '', `zapis: ${JSON.stringify(zly)}`);
    assert.equal(wygladaJakKod(zly), false);
  }
});

/* ──────────────── surowa płyta z magazynu → wariant dla wyceny */

test('płyta z magazynu dostaje wymiar dłuższym bokiem naprzód', () => {
  // `/magazyn` oddaje `formatCm: {wys, szer}` — wys bywa krótszym bokiem.
  // Pomylona orientacja to pomylona liczba płyt w pakowaniu.
  const w = wariantZPlyty({ kod: KOD, nazwa: 'CALACATTA', formatCm: { wys: 195, szer: 343 } });
  assert.deepEqual(w.plytaCm, { dl: 343, gl: 195 });
  assert.equal(w.kod, KOD, 'reszta danych płyty zostaje');
});

test('płyta bez formatu nie przechodzi dalej', () => {
  assert.equal(wariantZPlyty({ kod: KOD, nazwa: 'X' }), null);
  assert.equal(wariantZPlyty(null), null);
});

test('szukanie płyty po kodzie ignoruje różnice zapisu', () => {
  const plyty = [
    { kod: 'STON000111 - 11111', nazwa: 'A', dostepneM2: 5 },
    { kod: 'STON000334 - 84224', nazwa: 'B', dostepneM2: 12 },
  ];
  assert.equal(znajdzPoKodzie(plyty, 'ston000334-84224')?.nazwa, 'B');
  assert.equal(znajdzPoKodzie(plyty, 'STON000999-00000'), null);
  assert.equal(znajdzPoKodzie(plyty, 'byle co'), null);
});

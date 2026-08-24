/**
 * PACIFIC — konglomerat kwarcowy na płycie 348 × 201 cm.
 *
 *   node --test scripts/test-pacific.mjs
 *
 * Cennik od Dawida (25.08.2026). Trzy rzeczy, które muszą się zgadzać:
 *   • cena dla klienta = cena ZAKUPOWA BRUTTO × 1,30 (przez netto),
 *   • sprzedaż tylko pełnymi płytami — bez połówek,
 *   • Matt/Suede tylko przy wzorach z gwiazdki, z ceną z cennika dostawcy.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { wczytajSilnik } from './lib/silnik.mjs';

const { wycen, FIRMY, DOMYSLNE, zastosujUstawienia } = await wczytajSilnik();
const pacific = FIRMY.find((f) => f.slug === 'pacific');

const ODCINKI = [{ gl: 60, dl: 300 }];
const OPCJE = { pomieszczenie: 'kuchnia', otwory: 1 };

/* ───────────────────────────────────────────── cennik i przelicznik */

test('Pacific jest w kalkulatorze', () => {
  assert.ok(pacific, 'brak firmy pacific');
  assert.equal(pacific.typ, 'konglomerat kwarcowy');
});

test('cennik ma komplet 33 dekorów', () => {
  assert.equal(Object.keys(pacific.dekory).length, 33);
});

test('każdy dekor ma wyłącznie grubość 20 mm', () => {
  for (const [nazwa, gr] of Object.entries(pacific.dekory)) {
    assert.deepEqual(Object.keys(gr), ['20'], `${nazwa}: nieoczekiwane grubości`);
  }
});

test('cena klienta = zakupowa brutto × 1,30 (sprowadzona do netto)', () => {
  // Alchemy: 880 zł brutto zakupu → 930 netto dla klienta.
  // Sprawdzenie w drugą stronę: 930 × 1,23 = 1144 = 880 × 1,30.
  assert.equal(pacific.dekory['Alchemy']['20'], 930);
  assert.equal(Math.round(930 * 1.23), Math.round(880 * 1.3));
});

test('przelicznik działa też na skrajnych cenach z cennika', () => {
  // Echo White 478 (najtańszy) i Ashford 888 (najdroższy).
  assert.equal(pacific.dekory['Echo White']['20'], Math.round(478 * (1.3 / 1.23)));
  assert.equal(pacific.dekory['Ashford']['20'], Math.round(888 * (1.3 / 1.23)));
});

test('w cenniku dla klienta nie ma cen zakupowych', () => {
  const ceny = Object.values(pacific.dekory).map((g) => g['20']);
  for (const zakupowa of [880, 827, 637, 478, 486, 544, 688, 641, 888, 123]) {
    assert.ok(!ceny.includes(zakupowa), `cena zakupowa ${zakupowa} wyciekła do cennika klienta`);
  }
});

/* ─────────────────────────────────────────────────── format płyty */

test('płyta 348 × 201 cm — największy format w kalkulatorze', () => {
  assert.equal(pacific.plyta.w, 348);
  assert.equal(pacific.plyta.h, 201);
  const wieksze = FIRMY.filter((f) => (f.plyta?.w ?? 0) > 348);
  assert.equal(wieksze.length, 0, 'ktoś ma szerszą płytę — sprawdź opis');
});

test('SPRZEDAŻ TYLKO PEŁNYMI PŁYTAMI — bez połówek (decyzja Dawida)', () => {
  assert.equal(pacific.plyta.polowkaDozwolona, false);
});

test('blat 3,4 m mieści się na jednej płycie Pacifica', () => {
  // Na standardowych 320 cm trzeba by go łączyć — to jest sens tego formatu.
  const w = wycen(pacific, { dekor: 'Alchemy', grubosc: '20', odcinki: [{ gl: 60, dl: 340 }], opcje: OPCJE });
  assert.equal(w.ok, true, w.blad);
  assert.equal(w.pak.plytyPelne, 1, 'blat 340 cm powinien wejść z jednej płyty');
});

/* ──────────────────────────────────── wykończenie Matt / Suede */

const opcjaMat = () => pacific.opcje.find((o) => o.id === 'mat');

test('dopłata Matt/Suede liczona z cennika dostawcy: 123 brutto → 130 netto', () => {
  assert.equal(opcjaMat().cena, 130);
  assert.equal(Math.round(130 * 1.23), Math.round(123 * 1.3));
});

test('Matt/Suede dostępne przy 27 z 33 wzorów', () => {
  assert.equal(opcjaMat().tylkoDekory.length, 27);
});

test('wzory bez gwiazdki nie mają Matt/Suede', () => {
  for (const bez of ['Arya', 'Ashford', 'Cappucino', 'Dazzle', 'Hazel Gold', 'Tokyo']) {
    assert.ok(!opcjaMat().tylkoDekory.includes(bez), `${bez} nie powinien mieć Matt/Suede`);
  }
});

test('wzory z gwiazdką mają Matt/Suede', () => {
  for (const z of ['Alchemy', 'Echo White', 'Venus Glow', 'Silken']) {
    assert.ok(opcjaMat().tylkoDekory.includes(z), `${z} powinien mieć Matt/Suede`);
  }
});

test('dopłata NIE nalicza się przy wzorze bez tego wykończenia', () => {
  const zMatem = { ...OPCJE, mat: true };
  const bez = wycen(pacific, { dekor: 'Arya', grubosc: '20', odcinki: ODCINKI, opcje: zMatem });
  const zGwiazdka = wycen(pacific, { dekor: 'Aspen Aura', grubosc: '20', odcinki: ODCINKI, opcje: zMatem });

  // Arya i Aspen Aura mają tę samą cenę materiału (827 zakupowo), więc
  // różnica w sumie może brać się wyłącznie z dopłaty za wykończenie.
  assert.equal(pacific.dekory['Arya']['20'], pacific.dekory['Aspen Aura']['20']);
  assert.ok(zGwiazdka.razem > bez.razem, 'dopłata za Matt/Suede nie została naliczona');

  const pozycjeAryi = bez.pozycje.map((p) => p.nazwa).join(' | ');
  assert.doesNotMatch(pozycjeAryi, /Matt|Suede/, 'wzór bez gwiazdki dostał dopłatę');
});

test('stawka „mat" z panelu NIE nadpisuje dopłaty z cennika dostawcy', () => {
  // Panel ma własną stawkę za powierzchnię matową (60 zł). Gdyby nadpisała
  // cenę Pacifica, sprzedawalibyśmy wykończenie poniżej kosztu zakupu.
  const kopia = JSON.parse(JSON.stringify(FIRMY.map((f) => ({ ...f }))));
  zastosujUstawienia(kopia, { ...DOMYSLNE, mat: 60 });
  const p = kopia.find((f) => f.slug === 'pacific');
  assert.equal(p.opcje.find((o) => o.id === 'mat').cena, 130, 'stawka z panelu skasowała cenę z cennika');
});

test('u pozostałych firm stawka „mat" z panelu nadal działa', () => {
  const kopia = JSON.parse(JSON.stringify(FIRMY.map((f) => ({ ...f }))));
  zastosujUstawienia(kopia, { ...DOMYSLNE, mat: 77 });
  const inna = kopia.find((f) => f.slug === 'technistone');
  assert.equal(inna.opcje.find((o) => o.id === 'mat').cena, 77);
});

/* ──────────────────────────────────────────────── wycena end-to-end */

test('wycena na Pacificu liczy się i daje sensowną kwotę', () => {
  const w = wycen(pacific, { dekor: 'Alchemy', grubosc: '20', odcinki: ODCINKI, opcje: OPCJE });
  assert.equal(w.ok, true, w.blad);
  assert.ok(w.razem > 0);
  assert.equal(w.dekor, 'Alchemy');
});

test('kupujemy pełne płyty — metraż płatny nie schodzi poniżej płyty', () => {
  const w = wycen(pacific, { dekor: 'Echo White', grubosc: '20', odcinki: [{ gl: 60, dl: 100 }], opcje: OPCJE });
  assert.equal(w.ok, true, w.blad);
  const m2Plyty = (348 * 201) / 10000;
  assert.ok(w.pak.m2Kupione >= m2Plyty - 0.01, 'mały blat i tak wymaga całej płyty');
});

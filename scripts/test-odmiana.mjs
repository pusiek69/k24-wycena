/**
 * ODMIANA LICZEBNIKÓW NA STRONACH.
 *
 *   node --test scripts/test-odmiana.mjs
 *
 * Liczby wzorów aktualizują się automatycznie z cenników, więc forma
 * słowa musi iść za liczbą. Bez tego przy podbiciu 24 → 30 na stronie
 * zostałoby „30 dekory" — błąd językowy na wizytówce firmy.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { odmiana, FORMY, zOdmiana, doPelnejSetki } from './lib/odmiana.mjs';

const dekor = (n) => odmiana(n, FORMY.dekor);

test('jeden dekor', () => {
  assert.equal(dekor(1), 'dekor');
});

test('2–4 to „dekory"', () => {
  for (const n of [2, 3, 4]) assert.equal(dekor(n), 'dekory', `${n}`);
});

test('5–21 to „dekorów"', () => {
  for (const n of [5, 9, 10, 11, 15, 20, 21]) assert.equal(dekor(n), 'dekorów', `${n}`);
});

test('nastki 12–14 to WYJĄTEK — „dekorów", nie „dekory"', () => {
  // Końcówka 2/3/4, ale forma jak przy „wiele". To najczęstszy błąd
  // w automatycznie sklejanych tekstach.
  for (const n of [12, 13, 14]) assert.equal(dekor(n), 'dekorów', `${n}`);
});

test('22–24, 32–34 wracają do „dekory"', () => {
  for (const n of [22, 23, 24, 32, 33, 34, 62, 103, 104]) {
    assert.equal(dekor(n), 'dekory', `${n}`);
  }
});

test('112–114 znów są wyjątkiem', () => {
  for (const n of [112, 113, 114]) assert.equal(dekor(n), 'dekorów', `${n}`);
});

test('realne liczby z cenników odmieniają się poprawnie', () => {
  // Te wartości naprawdę trafiają na strony.
  assert.equal(zOdmiana(62, 'dekor'), '62 dekory');   // Avant Quartz
  assert.equal(zOdmiana(30, 'dekor'), '30 dekorów');  // Caesarstone
  assert.equal(zOdmiana(66, 'dekor'), '66 dekorów');  // Technistone
  assert.equal(zOdmiana(49, 'dekor'), '49 dekorów');  // Keralini
  assert.equal(zOdmiana(129, 'dekor'), '129 dekorów'); // Marazzi
  assert.equal(zOdmiana(158, 'wzor'), '158 wzorów');   // trzy konglomeraty
  assert.equal(zOdmiana(178, 'wzor'), '178 wzorów');   // dwa spieki
});

test('„wzór" odmienia się tak samo jak „dekor"', () => {
  assert.equal(odmiana(1, FORMY.wzor), 'wzór');
  assert.equal(odmiana(2, FORMY.wzor), 'wzory');
  assert.equal(odmiana(13, FORMY.wzor), 'wzorów');
  assert.equal(odmiana(22, FORMY.wzor), 'wzory');
});

test('zero i śmieci nie wywracają odmiany', () => {
  assert.equal(dekor(0), 'dekorów');
  assert.equal(dekor(null), 'dekorów');
  assert.equal(dekor('abc'), 'dekorów');
});

/* ────────────────────────── hasło „Ponad N wzorów" */

test('zaokrąglenie w DÓŁ do pełnej setki', () => {
  assert.equal(doPelnejSetki(734), 700);
  assert.equal(doPelnejSetki(700), 700);
  assert.equal(doPelnejSetki(699), 600);
});

test('nigdy nie zaokrągla w górę — hasło ma zostać prawdziwe', () => {
  // „Ponad 800" przy 734 wzorach byłoby nieprawdą na stronie firmy.
  for (const n of [734, 799, 750]) {
    assert.ok(doPelnejSetki(n) <= n, `${n} → ${doPelnejSetki(n)}`);
  }
});

test('mało wzorów nie daje ujemnej ani dziwnej setki', () => {
  assert.equal(doPelnejSetki(42), 0);
  assert.equal(doPelnejSetki(0), 0);
});

/**
 * WIDEŁKI CENY PRZED FORMULARZEM (flow 4/4, decyzja Dawida 9/14.10.2026).
 *
 *   node --test scripts/test-widelki.mjs
 *
 * Zasada „kwota po kontakcie" zostaje — ale klient widzi PRZED formularzem
 * uczciwe widełki „orientacyjnie od–do", żeby wiedział, czy w ogóle jest
 * w swoim budżecie. Dokładna kwota i zestawienie nadal po zostawieniu
 * kontaktu; formularz i wysyłka leada nietknięte.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { widelkiWyceny, tekstWidelek } from '../src/app/widelki.js';

const zrodlo = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('±5% zaokrąglone do pełnych setek, w dół i w górę', () => {
  // 7250 → 6887,5 i 7612,5 → 6800 i 7700.
  assert.deepEqual(widelkiWyceny(7250), { od: 6800, do: 7700 });
});

test('widełki nigdy nie zdradzają dokładnej kwoty', () => {
  for (const kwota of [1000, 4321, 7250, 12345, 99999]) {
    const { od, do: doo } = widelkiWyceny(kwota);
    assert.ok(od < kwota, `od (${od}) ma być PONIŻEJ kwoty ${kwota}`);
    assert.ok(doo > kwota, `do (${doo}) ma być POWYŻEJ kwoty ${kwota}`);
    assert.equal(od % 100, 0);
    assert.equal(doo % 100, 0);
  }
});

test('mała kwota nie składa się do zera ani do ujemnych', () => {
  const { od, do: doo } = widelkiWyceny(150);
  assert.ok(od >= 0);
  assert.ok(doo > od);
});

test('brak kwoty = brak widełek (karta bez wyceny nic nie obiecuje)', () => {
  assert.equal(widelkiWyceny(0), null);
  assert.equal(widelkiWyceny(undefined), null);
  assert.equal(widelkiWyceny(NaN), null);
});

test('tekst po polsku, z nbsp w kwotach i słowem „orientacyjnie"', () => {
  const t = tekstWidelek(7250);
  assert.match(t, /[Oo]rientacyjnie/);
  assert.match(t, /6 800/);
  assert.match(t, /7 700/);
  assert.match(t, /brutto/);
});

test('bramka naprawdę pokazuje widełki nad formularzem (podłączenie)', () => {
  const bramka = zrodlo('src/app/bramka.js');
  assert.match(bramka, /tekstWidelek\(/);
  assert.match(bramka, /bramka-widelki/);
});

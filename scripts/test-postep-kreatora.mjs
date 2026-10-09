/**
 * WSKAŹNIK POSTĘPU W ŚCIEŻCE KLIKANEJ (pkt 1 raportu designowego, 9.10.2026).
 *
 *   node --test scripts/test-postep-kreatora.mjs
 *
 * Klient nie wie, ile pytań przed nim — a to realnie 4–5 kroków. Licznik
 * poprawia to jednym zdaniem w nagłówku karty, ale TYLKO w ścieżce klikanej:
 * w rozmowie swobodnej kroki nie są liniowe i licznik by kłamał (wariant
 * bezpieczny z raportu).
 *
 * Silnik wyceny i lejek leadów tego nie dotykają — to sam nagłówek karty.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { postep, KROKI, ILE_KROKOW } from '../src/app/kroki-postep.js';

test('Ścieżka klikana ma sześć kroków w ustalonej kolejności', () => {
  assert.deepEqual(
    KROKI.map((k) => k.id),
    ['pomieszczenie', 'rodzaj', 'material', 'dekor', 'wymiary', 'szczegoly']
  );
  assert.equal(ILE_KROKOW, 6);
});

test('postep numeruje krok i podaje etykietę „KROK X Z 5”', () => {
  assert.deepEqual(postep('pomieszczenie'), { numer: 1, ile: 6, etykieta: 'KROK 1 Z 6', udzial: 17 });
  assert.equal(postep('dekor').numer, 4);
  assert.equal(postep('szczegoly').etykieta, 'KROK 6 Z 6');
  assert.equal(postep('szczegoly').udzial, 100);
});

test('krok spoza ścieżki klikanej nie dostaje licznika', () => {
  /*
   * Wyprzedaż płyt, wyszukiwarka kamienia naturalnego i karta wybranej
   * płyty wchodzą w dowolnym momencie rozmowy. Licznik „KROK 2 z 5”
   * w takim miejscu kłamałby klientowi w żywe oczy.
   */
  assert.equal(postep('wyprzedaz'), null);
  assert.equal(postep(undefined), null);
  assert.equal(postep('czego-takiego-nie-ma'), null);
});

test('pomocnicy ścieżki klikanej przekazują swój krok do ramki', () => {
  const zrodlo = fs.readFileSync(new URL('../src/app/pomocnicy.js', import.meta.url), 'utf8');
  for (const [funkcja, krok] of [
    ['pomocnikPomieszczenie', 'pomieszczenie'],
    ['pomocnikRodzaj', 'rodzaj'],
    ['pomocnikMaterial', 'material'],
    ['pomocnikDekor', 'dekor'],
    ['pomocnikWymiary', 'wymiary'],
    ['pomocnikSzczegoly', 'szczegoly'],
  ]) {
    const od = zrodlo.indexOf(`export function ${funkcja}`);
    assert.ok(od > 0, `brak ${funkcja}`);
    const ciało = zrodlo.slice(od, zrodlo.indexOf('\nexport function', od + 10));
    assert.match(ciało, new RegExp(`krok: '${krok}'`), `${funkcja} nie przekazuje kroku '${krok}'`);
  }
});

test('ramka rysuje licznik i pasek tylko wtedy, gdy krok jest znany', () => {
  const zrodlo = fs.readFileSync(new URL('../src/app/pomocnicy.js', import.meta.url), 'utf8');
  const od = zrodlo.indexOf('function ramka(');
  const ciało = zrodlo.slice(od, od + 900);
  assert.match(ciało, /postep\(/, 'ramka nie pyta o postęp');
  assert.match(ciało, /pom-krok/, 'brak elementu licznika');
  assert.match(ciało, /pom-pasek/, 'brak paska postępu');
  assert.match(ciało, /\?|&&/, 'licznik musi być warunkowy — bez kroku nie rysujemy nic');
});

test('rozmowa swobodna nie dostaje licznika', () => {
  const czat = fs.readFileSync(new URL('../src/app/czat.js', import.meta.url), 'utf8');
  assert.ok(!czat.includes('kroki-postep'), 'czat nie ma prawa liczyć kroków');
});

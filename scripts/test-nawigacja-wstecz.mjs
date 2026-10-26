/**
 * NAWIGACJA WSTECZ W DRZEWKU MATERIAŁU — ROZMOWA (zlecenie Dawida 26.10.2026).
 *
 *   node --test scripts/test-nawigacja-wstecz.mjs
 *
 * Klient po wejściu w „konglomerat → Avant" ma wrócić do listy marek albo
 * kategorii BEZ zaczynania wyceny od nowa; wpisane wymiary zostają.
 * Kreator awaryjny (kroki.js) ma własne „← Wstecz" od dawna — ten test
 * pilnuje ścieżki ROZMOWY. Testy po źródle (wzorzec z 30.08: funkcja bez
 * podłączenia to połowa roboty), bo maszyna stanów żyje w domknięciu.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const zrodlo = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const czat = zrodlo('src/app/czat.js');
const pom = zrodlo('src/app/pomocnicy.js');

test('czat zna krok wstecz z marki/dekoru: material:wstecz czyści TYLKO materiał i dekor', () => {
  const blok = czat.match(/material:wstecz[\s\S]{0,700}?return;/);
  assert.ok(blok, 'brak obsługi material:wstecz w czat.js');
  assert.match(blok[0], /stan\.material = null/);
  assert.match(blok[0], /stan\.dekor = null/);
  // Kamień naturalny: wskazana płyta nie może zostać po zmianie kolekcji.
  assert.match(blok[0], /stan\.kodPlyty = null/);
  // SEDNO ZLECENIA: wymiary i szczegóły zostają.
  assert.ok(!/stan\.wymiary\s*=/.test(blok[0]), 'material:wstecz nie ma prawa kasować wymiarów');
  assert.ok(!/stan\.odcinki\s*=/.test(blok[0]), 'material:wstecz nie ma prawa kasować odcinków');
  assert.ok(!/stan\.szczegoly\s*=/.test(blok[0]), 'material:wstecz nie ma prawa kasować szczegółów');
});

test('czat zna powrót z kategorii do pomieszczenia i kasuje tam tylko pomieszczenie', () => {
  const blok = czat.match(/pomieszczenie:wstecz[\s\S]{0,400}?return;/);
  assert.ok(blok, 'brak obsługi pomieszczenie:wstecz w czat.js');
  assert.match(blok[0], /stan\.pomieszczenie = null/);
  assert.ok(!/stan\.wymiary\s*=/.test(blok[0]));
});

test('rodzaj:wstecz (istniejący) dalej czyści materiał — regresja', () => {
  assert.match(czat, /rodzaj === 'wstecz'[\s\S]{0,200}stan\.material = null/);
});

test('każdy poziom drzewka ma przycisk wstecz w pomocniku', () => {
  // dekor → inne kolekcje (dotyczy też listy płyt wyprzedaży)
  assert.match(pom, /material:wstecz/, 'pomocnicy nie wysyłają material:wstecz');
  assert.match(pom, /← Inne kolekcje/, 'brak przycisku „← Inne kolekcje" przy dekorach');
  // rodzaj (kategoria) → pomieszczenie
  assert.match(pom, /pomieszczenie:wstecz/, 'pomocnicy nie wysyłają pomieszczenie:wstecz');
  // marka → rodzaj (istniejące — regresja)
  assert.match(pom, /rodzaj:wstecz/);
  // kamień naturalny (wyszukiwarka płyt) też ma wyjście wstecz
  assert.match(pom, /pomocnikKamien[\s\S]{0,4000}(rodzaj|material):wstecz/, 'pomocnikKamien bez drogi powrotu');
});

test('wymiary i szczegóły mają dyskretne „zmień materiał" bez restartu', () => {
  assert.match(pom, /pomocnikWymiary[\s\S]{0,4500}material:wstecz/, 'pomocnikWymiary bez „zmień materiał"');
  assert.match(pom, /pomocnikSzczegoly[\s\S]{0,6000}material:wstecz/, 'pomocnikSzczegoly bez „zmień materiał"');
  assert.match(pom, /Zmień materiał/);
});

test('wiadomość przy zmianie materiału mówi modelowi, że wymiary zostają', () => {
  assert.match(pom, /wymiary zostają/i, 'komunikat ma uprzedzać, że wymiarów nie podajemy od nowa');
});

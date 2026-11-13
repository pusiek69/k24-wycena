/**
 * SZYBKIE ODPOWIEDZI W WIADOMOŚCI DO KLIENTA (zlecenie Dawida, 13.11.2026).
 *
 *   node --test scripts/test-szybkie-odpowiedzi.mjs
 *
 * Przy wysyłce oferty, nad polem „Wiadomość od Ciebie": rządek przycisków-
 * szablonów. Klik DOKLEJA zaakceptowaną przez Dawida treść do pola
 * (pusty wiersz odstępu), wszystko edytowalne, limit znaków pilnowany.
 * Treści zaakceptowane 13.11.2026 „tak pasuje" — test pilnuje ich
 * co do znaku, żeby nikt ich po cichu nie przeredagował.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SZYBKIE_ODPOWIEDZI, doklejSzablon } from '../src/app/szybkie-odpowiedzi.js';

const zrodlo = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('SZEŚĆ szablonów, treści dokładnie jak zaakceptował Dawid', () => {
  assert.equal(SZYBKIE_ODPOWIEDZI.length, 6);
  const tresci = Object.fromEntries(SZYBKIE_ODPOWIEDZI.map((s) => [s.id, s.tresc]));
  assert.equal(
    tresci.podziekowanie,
    'Dziękuję za złożenie zapytania i zaufanie. Przygotowałem wycenę osobiście — wszystkie pozycje znajdą Państwo w rozbiciu poniżej.'
  );
  assert.equal(
    tresci.pytania,
    'Czy mają Państwo pytania dotyczące wyceny? Chętnie wyjaśnię każdą pozycję albo przygotuję wariant w innym materiale — często różnice w cenie potrafią pozytywnie zaskoczyć.'
  );
  assert.equal(
    tresci.etap,
    'Na jakim etapie jest Państwa kuchnia? Jeśli znany jest już termin montażu mebli, chętnie zarezerwuję pomiar i montaż blatu tak, aby wszystko zagrało z harmonogramem — kuchnia nie będzie czekać bez blatu.'
  );
  assert.equal(
    tresci.proliner,
    'Zapraszam na bezpłatny, niezobowiązujący pomiar urządzeniem Proliner — to cyfrowy pomiar co do milimetra, dzięki któremu blat pasuje idealnie, bez szablonów i poprawek. Pomiar do niczego nie zobowiązuje, a daje pewną cenę końcową.'
  );
  assert.equal(
    tresci.kontakt,
    'W razie jakichkolwiek pytań proszę śmiało dzwonić: 796 991 128 (pon.–pt. 8:00–18:00) — odbieram osobiście. Można też po prostu odpisać na tę wiadomość.'
  );
  assert.equal(
    tresci.aktualizacja,
    'Zgodnie z naszą rozmową przygotowałem zaktualizowaną wycenę — zmiany widoczne są w rozbiciu poniżej. Proszę dać znać, czy ta wersja odpowiada Państwa oczekiwaniom.'
  );
  // Każdy ma krótką etykietę na przycisk.
  for (const s of SZYBKIE_ODPOWIEDZI) assert.ok(s.etykieta && s.etykieta.length <= 22, `etykieta: ${s.etykieta}`);
});

test('DOKLEJANIE: do pustego pola — sam szablon', () => {
  assert.equal(doklejSzablon('', 'Tekst A.', 2000), 'Tekst A.');
  assert.equal(doklejSzablon('   ', 'Tekst A.', 2000), 'Tekst A.');
});

test('DOKLEJANIE: do istniejącego tekstu — pusty wiersz odstępu, wpisane zostaje', () => {
  assert.equal(doklejSzablon('Dzień dobry,', 'Tekst A.', 2000), 'Dzień dobry,\n\nTekst A.');
  // Końcowe entery Dawida nie mnożą się w trzy puste wiersze.
  assert.equal(doklejSzablon('Dzień dobry,\n\n\n', 'Tekst A.', 2000), 'Dzień dobry,\n\nTekst A.');
  // Łączenie kilku szablonów po kolei.
  const dwa = doklejSzablon(doklejSzablon('', 'A.', 2000), 'B.', 2000);
  assert.equal(dwa, 'A.\n\nB.');
});

test('LIMIT ZNAKÓW: szablon, który nie mieści się w całości, NIE jest ucinany w pół zdania', () => {
  const pelne = 'x'.repeat(1990);
  const wynik = doklejSzablon(pelne, 'Szablon dłuższy niż zostało miejsca.', 2000);
  assert.equal(wynik, null, 'nie mieści się — zwracamy null, pole zostaje bez zmian');
  // Mieści się co do znaku — wchodzi.
  const naStyk = 'y'.repeat(2000 - 2 - 4);
  assert.equal(doklejSzablon(naStyk, 'abcd', 2000).length, 2000);
});

test('PODŁĄCZENIE w edytorze: przyciski nad polem wiadomości, wspólny limit', () => {
  const ed = zrodlo('src/app/oferta-dawida.js');
  assert.match(ed, /from '\.\/szybkie-odpowiedzi\.js'/, 'edytor nie importuje szablonów');
  assert.match(ed, /SZYBKIE_ODPOWIEDZI\.map/, 'brak rządka przycisków');
  assert.match(ed, /doklejSzablon\(pole\.value, [\s\S]{0,40}MAKS_WIADOMOSCI\)/, 'doklejanie bez limitu znaków');
  assert.match(ed, /Szybkie odpowiedzi/, 'brak nagłówka sekcji');
  // Po wstawieniu stan musi dostać nową wartość — inaczej podgląd jej nie zobaczy.
  assert.match(ed, /stan\.wiadomosc = pole\.value;[\s\S]{0,200}szybkie/i);
  const css = zrodlo('src/style.css');
  assert.match(css, /\.od-szybkie/, 'brak stylu rządka');
  assert.match(css, /\.od-szybkie[^}]*\}[\s\S]{0,400}min-height:\s*4[0-9]px/, 'przyciski bez dotykowej wysokości');
});

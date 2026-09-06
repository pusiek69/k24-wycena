/**
 * POMIAR LEJKA — czy w ogóle widzimy, co się dzieje na stronie.
 *
 *   node --test scripts/test-pomiar-lejka.mjs
 *
 * Powód powstania (06.09.2026): Dawid zgłosił „nikt się nie odzywa
 * z wyceną". Aplikacja działała bez zarzutu — end-to-end na produkcji
 * przeszedł, worker zero błędów — ale NIE DAŁO SIĘ ODPOWIEDZIEĆ na pytanie,
 * czy ludzie przestali wchodzić, czy wchodzą i nie wysyłają. GA4 nie było
 * skonfigurowane wcale, a nawet gdyby było, ładowało się dopiero po
 * kliknięciu w baner ciasteczek — czyli mijało większość ruchu.
 *
 * Te testy pilnują, żeby ta ślepota nie wróciła.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const zrodlo = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/* ────────────────────────────────────────────────── lejek jest kompletny */

test('KAŻDY etap lejka ma swoje zdarzenie', () => {
  /*
   * Bez któregokolwiek z nich nie da się powiedzieć, GDZIE klient odpadł.
   * `bramka_pokazana` vs `lead_wyslany` to jedyna para, która odróżnia
   * „nie ma ruchu" od „formularz odstrasza".
   */
  const bramka = zrodlo('src/app/bramka.js');
  assert.match(bramka, /zdarzenie\('bramka_pokazana'/, 'nie wiadomo, ilu doszło do formularza');
  assert.match(bramka, /konwersjaLead\(/, 'nie wiadomo, ilu wysłało');

  const wizard = zrodlo('src/app/wizard.js');
  assert.match(wizard, /zdarzenie\('wycena_start'/, 'brak wejścia w kreator');
  assert.match(wizard, /zdarzenie\('wycena_dekor'/, 'brak wyboru dekoru');
});

test('KONWERSJA odpala się dopiero po udanej wysyłce', () => {
  /*
   * `konwersjaLead` musi siedzieć w `odsloniecie()` — ekranie, który
   * pokazuje się PO odpowiedzi serwera. Gdyby wisiała na kliknięciu
   * przycisku, Google i Meta liczyłyby też zgłoszenia, które się nie udały,
   * i kampania uczyłaby się na nieprawdziwych danych.
   */
  const bramka = zrodlo('src/app/bramka.js');
  const i = bramka.indexOf('function odsloniecie');
  assert.ok(i > 0, 'nie ma ekranu po wysyłce');
  const blok = bramka.slice(i, bramka.indexOf('function wybor', i));
  assert.match(blok, /konwersjaLead\(/, 'konwersja nie jest przypięta do udanej wysyłki');
});

test('lead_wyslany trafia do Google I do Mety', () => {
  const z = zrodlo('src/analytics/zdarzenia.js');
  assert.match(z, /zdarzenie\('lead_wyslany'/, 'brak zdarzenia głównego');
  assert.match(z, /POMIAR\.konwersjaLead/, 'brak etykiety konwersji Google Ads');
  assert.match(z, /fbq\('track', 'Lead'/, 'Meta nie dostaje standardowego zdarzenia Lead');
  // Wartość zgłoszenia — bez niej Ads nie umie licytować pod marżę.
  assert.match(z, /currency: 'PLN'/, 'konwersja bez kwoty');
});

/* ──────────────────────────────────────────── GA4 widzi CAŁY ruch */

test('⚠ GA4 startuje OD RAZU, nie dopiero po kliknięciu w baner', () => {
  /*
   * Najważniejszy test w tym pliku.
   *
   * Consent Mode v2 jest po to, żeby tag mógł wystartować przy domyślnym
   * `denied` i wysyłać zagregowany, bezciasteczkowy ping. Gdyby GA4
   * konfigurowało się dopiero w `zaladujSkrypty()` — wołanym po wyborze
   * w banerze — cały ruch osób, które banera nie dotknęły, nie istniałby
   * w statystykach. Tak było do 06.09.2026 i dlatego przy ciszy w leadach
   * nie było czym się posłużyć.
   */
  const z = zrodlo('src/analytics/zgody.js');

  const i = z.indexOf('export function inicjujZgody');
  const koniec = z.indexOf('function odczytajWybor', i);
  const start = z.slice(i, koniec);

  assert.match(start, /wlaczGa4\(\)/, 'GA4 nie startuje przy wejściu na stronę');

  const przedBanerem = start.indexOf('wlaczGa4()');
  const banerem = start.indexOf('pokazBaner()');
  assert.ok(
    przedBanerem > 0 && przedBanerem < banerem,
    'GA4 włącza się dopiero po banerze — większość ruchu przepadnie'
  );

  // ...i nie drugi raz po zgodzie, bo to podwójne odsłony.
  const j = z.indexOf('function zaladujSkrypty');
  const skrypty = z.slice(j, z.indexOf('function wlaczGa4', j));
  assert.doesNotMatch(skrypty, /gtag\('config', POMIAR\.ga4/, 'GA4 konfigurowane dwa razy');
});

test('domyślne zgody stoją w <head> PRZED tagiem — inaczej ping nie pójdzie', () => {
  const html = zrodlo('index.html');
  const domyslne = html.indexOf("gtag('consent', 'default'");
  const tag = html.indexOf('googletagmanager.com/gtag/js');
  assert.ok(domyslne > 0, 'brak domyślnych zgód');
  assert.ok(domyslne < tag, 'tag startuje przed ustawieniem zgód — Consent Mode nie zadziała');
});

test('META ładuje się dopiero po pełnej zgodzie', () => {
  // Meta nie ma Consent Mode: albo piksel jest, albo go nie ma.
  // Załadowanie go przed zgodą byłoby zwyczajnie niezgodne z RODO.
  const z = zrodlo('src/analytics/zgody.js');
  assert.match(
    z,
    /POMIAR\.metaPixel && odczytajWybor\(\) === 'wszystkie'/,
    'piksel Meta ładuje się bez pełnej zgody'
  );
});

/* ─────────────────────────────────────────────────────── konfiguracja */

test('config trzyma WSZYSTKIE identyfikatory w jednym miejscu', () => {
  const c = zrodlo('src/analytics/config.js');
  for (const klucz of ['ga4', 'googleAds', 'konwersjaLead', 'konwersjaTelefon', 'metaPixel']) {
    assert.match(c, new RegExp(`\\b${klucz}:`), `brak pola ${klucz} w POMIAR`);
  }
});

test('pusty identyfikator NIE ładuje niczego', () => {
  /*
   * Strona bez wklejonych numerów ma nie zostawiać ciasteczek i nie
   * pokazywać banera — inaczej pytamy o zgodę na coś, czego nie ma.
   */
  const c = zrodlo('src/analytics/config.js');
  assert.match(c, /return Boolean\(POMIAR\.ga4 \|\| POMIAR\.googleAds \|\| POMIAR\.metaPixel\)/);

  const z = zrodlo('src/analytics/zgody.js');
  assert.match(z, /if \(ga4Wlaczone \|\| !POMIAR\.ga4\) return;/, 'puste GA4 i tak woła gtag');
});

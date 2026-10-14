/**
 * WYBÓR PO KOLORZE ZAMIAST PO MARCE (flow 2/4, zlecenie 9/14.10.2026).
 *
 *   node --test scripts/test-dekory-koloru.mjs
 *
 * Klient-laik nie zna Technistone od Caesarstone — zna „jasny z żyłą".
 * `dekoryFirmWKolorze` przecina cenniki WSZYSTKICH firm danego rodzaju
 * i oddaje wzory w zadanym kolorze, z marką w roli podpisu, nie bramki.
 *
 * Firmy wchodzą parametrem (nie z `firms/index.js`), bo tamten moduł
 * używa `import.meta.glob` Vite'a — goły node by się wyłożył, a funkcja
 * i tak potrzebuje tylko `{slug, nazwa, dekory}`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { dekoryFirmWKolorze } from '../src/app/kolory-dekorow.js';

const zrodlo = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const FIRMY = [
  {
    slug: 'technistone',
    nazwa: 'Technistone',
    dekory: { 'Brilliant White': { 20: 1 }, 'Brilliant Black': { 20: 1 }, Dijon: { 20: 1 } },
  },
  {
    slug: 'avant',
    nazwa: 'Avant Quartz',
    dekory: { 'Arctic White': { 20: 1 } },
  },
];

test('zbiera wzory w kolorze ze WSZYSTKICH firm i sortuje alfabetycznie', () => {
  const biale = dekoryFirmWKolorze(FIRMY, 'biel');
  assert.deepEqual(
    biale.map((p) => [p.dekor, p.firmaSlug]),
    [
      ['Arctic White', 'avant'],
      ['Brilliant White', 'technistone'],
    ]
  );
  // Marka jedzie z pozycją — na przycisku stanie w drugiej linii.
  assert.equal(biale[0].firmaNazwa, 'Avant Quartz');
});

test('inny kolor nie przecieka; nazwa bez koloru nie zgaduje', () => {
  assert.deepEqual(
    dekoryFirmWKolorze(FIRMY, 'antracyt').map((p) => p.dekor),
    ['Brilliant Black']
  );
  // „Dijon" nie wie, jakiego jest koloru — trafia tylko do 'nieznany'.
  assert.deepEqual(
    dekoryFirmWKolorze(FIRMY, 'nieznany').map((p) => p.dekor),
    ['Dijon']
  );
});

test('firma bez cennika dekorów nie wysypuje funkcji', () => {
  const zPusta = [...FIRMY, { slug: 'reczna', nazwa: 'Ręczna', dekory: undefined }];
  assert.equal(dekoryFirmWKolorze(zPusta, 'biel').length, 2);
});

/*
 * PODŁĄCZENIE, nie tylko funkcja (lekcja z 30.08.2026: pięć usterek
 * z zielonymi testami, bo nikt nie wołał przetestowanego kodu).
 * Sprawdzamy po źródle, że ścieżka klikana naprawdę przechodzi przez
 * nowe ogniwa: czat zna `kolor:` i wariant obiektowy, pomocnik materiału
 * przyjmuje kolor i woła przekrój po kolorze.
 */
test('czat.js obsługuje krok koloru i wybór {material, dekor} naraz', () => {
  const czat = zrodlo('src/app/czat.js');
  assert.match(czat, /startsWith\('kolor:'\)/);
  assert.match(czat, /wartosc\.material && wartosc\.dekor/);
  assert.match(czat, /pomocnikMaterial\(wybrano, stan\.rodzaj, stan\.kolor\)/);
  // Powrót do rodzaju kasuje też wybrany kolor — inaczej klient po
  // zmianie rodzaju lądowałby od razu w starym kolorze.
  assert.match(czat, /stan\.rodzaj = null;\s*stan\.material = null;\s*stan\.kolor = null;/);
});

test('pomocnikMaterial rozgałęzia się po kolorze i woła przekrój', () => {
  const pom = zrodlo('src/app/pomocnicy.js');
  assert.match(pom, /pomocnikMaterial\(wyslij, rodzaj, kolor = null\)/);
  assert.match(pom, /dekoryFirmWKolorze\(firmyZDekorami\(rodzaj\), kolorTag\)/);
  assert.match(pom, /'kolor:wszystkie'/);
  // Lista przekrojowa to krok „Wzór" w liczniku — numeracja zostaje uczciwa.
  assert.match(pom, /krok: 'dekor' \}/);
});

test('liczebnosciKolorow mówi, które kafle kolorów w ogóle pokazać', () => {
  const ile = dekoryFirmWKolorze.liczebnosci(FIRMY);
  assert.equal(ile.get('biel'), 2);
  assert.equal(ile.get('antracyt'), 1);
  assert.equal(ile.get('nieznany'), 1);
  assert.ok(!ile.has('drewno'), 'pusty kolor nie dostaje wpisu');
});

/**
 * PORADNIK O KONGLOMERACIE + SEO WYPRZEDAŻY (zlecenie Dawida, 01.09.2026).
 *
 *   node --test scripts/test-konglomeraty.mjs
 *
 * Analiza przed napisaniem: `docs/analiza-konglomeraty.md`.
 *
 * Czego pilnujemy — po kolei tego, co naprawdę mogło pójść źle:
 *   • kwoty i liczby wzorów zgadzają się z jednym źródłem prawdy,
 *   • KANIBALIZACJA jest zlikwidowana, a nie przeniesiona gdzie indziej,
 *   • strona pod 301 nie jest jednocześnie budowana i w sitemapie,
 *   • dane strukturalne nie obiecują płyt, których nie ma.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const zrodlo = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const PORADNIK = 'blaty-z-konglomeratu-kwarcowego-poradnik.html';
const KOLEKCJE = 'blaty-z-konglomeratu.html';
const KWOTY = JSON.parse(zrodlo('scripts/lib/ceny-tresc.json')).kwoty;

const { wczytajSilnik } = await import('./lib/silnik.mjs');
const { FIRMY } = await wczytajSilnik();
const ile = (s) => Object.keys(FIRMY.find((f) => f.slug === s)?.dekory || {}).length;
const WZOROW = ['technistone', 'avant-quartz', 'interq', 'pacific', 'caesarstone']
  .reduce((a, s) => a + ile(s), 0);

/* ───────────────────────────────────────────────── poradnik istnieje i żyje */

test('poradnik jest zbudowany i ma objętość filaru', () => {
  const t = zrodlo(PORADNIK);
  const goly = t
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, ' ');
  const slow = goly.split(/\s+/).filter(Boolean).length;
  // Najmocniejszy konkurent w top10 ma ~3000 słów. Poniżej 1500 nie ma
  // sensu w ogóle startować — to była jedna z przyczyn zera kliknięć.
  assert.ok(slow > 1500, `poradnik ma tylko ${slow} słów`);
});

test('KWOTY w poradniku pochodzą z jednego źródła prawdy', () => {
  const t = zrodlo(PORADNIK);
  const spacja = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  for (const [klucz, wartosc] of Object.entries(KWOTY)) {
    if (!/^konglomerat/.test(klucz)) continue;
    assert.ok(
      t.includes(spacja(wartosc)),
      `poradnik nie zawiera kwoty ${klucz} = ${wartosc}`
    );
  }
});

test('liczba wzorów zgadza się z cennikiem — wszystkie PIĘĆ marek', () => {
  /*
   * ⚠ Do 01.09.2026 serwis mówił „158 wzorów", licząc trzy marki z pięciu.
   * InterQ i Pacific nie istniały w treści, choć od dawna są w kalkulatorze.
   * Ten sam błąd naprawiliśmy 30.08 po stronie spieków.
   */
  const t = zrodlo(PORADNIK);
  assert.ok(t.includes(String(WZOROW)), `poradnik nie podaje ${WZOROW} wzorów`);
  for (const marka of ['Technistone', 'Avant Quartz', 'InterQ', 'Pacific', 'Caesarstone']) {
    assert.ok(t.includes(marka), `poradnik nie wymienia marki ${marka}`);
  }
  const gen = zrodlo('scripts/ceny-tresc.mjs');
  assert.match(gen, /'interq'/, 'generator cen wciąż nie zna InterQ');
  assert.match(gen, /'pacific'/, 'generator cen wciąż nie zna Pacific');
});

test('poradnik ma tabelę, FAQ i oba schematy', () => {
  const t = zrodlo(PORADNIK);
  assert.match(t, /<table class="zestawienie">/, 'brak tabeli porównawczej');
  assert.match(t, /id="faq"/, 'brak sekcji FAQ');
  assert.match(t, /"@type": "Article"/, 'brak schematu Article');
  assert.match(t, /"@type": "FAQPage"/, 'brak schematu FAQPage');
  assert.match(t, /"@type": "BreadcrumbList"/, 'brak okruszków w schemacie');
});

test('FAQ w treści i w schemacie mówią TO SAMO', () => {
  // Rozjazd między tym, co czyta człowiek, a tym, co dostaje Google,
  // to dokładnie ta rzecz, za którą leci kara ręczna.
  const t = zrodlo(PORADNIK);
  const wSchemacie = [...t.matchAll(/"@type": "Question",\s*\n\s*"name": "([^"]+)"/g)].map((m) => m[1]);
  assert.ok(wSchemacie.length >= 6, `w schemacie tylko ${wSchemacie.length} pytań`);
  for (const p of wSchemacie) {
    // W HTML-u pytania stoją jako <h3>; encje HTML mogą się różnić, więc
    // porównujemy po fragmencie bez znaków specjalnych.
    const fragment = p.replace(/[?]/g, '').slice(0, 40);
    assert.ok(t.includes(fragment), `pytanie ze schematu nie istnieje w treści: ${p}`);
  }
});

/* ────────────────────────────────────── kanibalizacja: sedno tego zlecenia */

test('NIE MA dwóch stron walczących o tę samą frazę', () => {
  /*
   * Poradnik bierze intencję „cena i wady", strona kolekcji — „wzory".
   * Gdyby obie miały „ceny" w tytule, sam bym stworzył problem, który
   * to zlecenie ma zlikwidować.
   */
  const tytul = (p) => /<title>([^<]*)<\/title>/.exec(zrodlo(p))[1];
  const poradnik = tytul(PORADNIK);
  const kolekcje = tytul(KOLEKCJE);

  assert.match(poradnik, /ceny, wady i zalety/i, `tytuł poradnika: ${poradnik}`);
  assert.doesNotMatch(kolekcje, /cen[ay]/i, `strona kolekcji wciąż celuje w cenę: ${kolekcje}`);
  assert.match(kolekcje, /kolekcje i wzory/i, `strona kolekcji nieprzecelowana: ${kolekcje}`);
  assert.notEqual(poradnik, kolekcje);
});

test('strona kolekcji linkuje do poradnika i odwrotnie', () => {
  assert.match(
    zrodlo(KOLEKCJE),
    /blaty-z-konglomeratu-kwarcowego-poradnik/,
    'kolekcje nie linkują do poradnika'
  );
  assert.match(
    zrodlo(PORADNIK),
    /href="\/blaty-z-konglomeratu"/,
    'poradnik nie linkuje do kolekcji'
  );
});

test('trzecia strona o cenie jest PRZEKIEROWANA, a nie zostawiona', () => {
  /*
   * `/baza-wiedzy/cena-blatu-z-konglomeratu` miał dokładnie tę samą intencję
   * co poradnik i był od niego trzy razy krótszy. Zostawiony konkurowałby
   * z nim o tę samą frazę.
   *
   * Trzy warunki muszą zachodzić RAZEM, inaczej przekierowanie nie zadziała:
   * jest reguła 301, strona NIE jest budowana i NIE ma jej w sitemapie.
   */
  const netlify = zrodlo('netlify.toml');
  assert.match(
    netlify,
    /from = "\/baza-wiedzy\/cena-blatu-z-konglomeratu"[\s\S]{0,120}status = 301/,
    'brak przekierowania 301'
  );
  assert.match(
    netlify,
    /to = "\/blaty-z-konglomeratu-kwarcowego-poradnik"/,
    'przekierowanie nie celuje w poradnik'
  );

  const vite = zrodlo('vite.config.js');
  assert.doesNotMatch(
    vite,
    /baza_wiedzy_cena_blatu_z_konglomeratu:/,
    'strona pod 301 wciąż jest budowana — Netlify odda plik zamiast przekierowania'
  );

  const mapa = zrodlo('public/sitemap.xml');
  assert.doesNotMatch(mapa, /cena-blatu-z-konglomeratu/, 'strona pod 301 wciąż w sitemapie');
});

test('poradnik jest zbudowany i wpisany do sitemapy', () => {
  const vite = zrodlo('vite.config.js');
  assert.match(vite, /blaty-z-konglomeratu-kwarcowego-poradnik\.html/, 'poradnik nie wchodzi do buildu');
  const mapa = zrodlo('public/sitemap.xml');
  assert.match(mapa, /blaty-z-konglomeratu-kwarcowego-poradnik<\/loc>/, 'poradnika nie ma w sitemapie');
  const netlify = zrodlo('netlify.toml');
  assert.match(
    netlify,
    /from = "\/blaty-z-konglomeratu-kwarcowego-poradnik\.html"[\s\S]{0,120}status = 301/,
    'brak 301 z wersji z .html'
  );
});

test('poradnik ma zaplecze linkujące', () => {
  // Sam filar bez linków wewnętrznych to strona-sierota.
  for (const p of ['baza-wiedzy/konglomerat-kwarcowy.html', 'blaty-kuchenne-tarnobrzeg.html',
                   'czesto-zadawane-pytania.html']) {
    assert.match(
      zrodlo(p),
      /blaty-z-konglomeratu-kwarcowego-poradnik/,
      `${p} nie linkuje do poradnika`
    );
  }
});

/* ─────────────────────────────────────────────────────── SEO wyprzedaży */

test('strona wyprzedaży celuje we frazy zakupowe', () => {
  const t = zrodlo('wyprzedaz-plyt.html');
  const tytul = /<title>([^<]*)<\/title>/.exec(t)[1];
  assert.match(tytul, /wyprzeda/i, `tytuł bez „wyprzedaż": ${tytul}`);
  assert.match(tytul, /outlet/i, `tytuł bez „outlet": ${tytul}`);
  // Tytuł dłuższy niż ~60 znaków Google i tak utnie w wynikach.
  assert.ok(tytul.length <= 65, `tytuł ma ${tytul.length} znaków: ${tytul}`);
  assert.match(t, /"@type": "OfferCatalog"/, 'brak katalogu ofert w schemacie');
});

test('opisy meta mieszczą się w tym, co Google pokazuje', () => {
  for (const p of [PORADNIK, KOLEKCJE, 'wyprzedaz-plyt.html']) {
    const opis = /name="description" content="([^"]*)"/.exec(zrodlo(p))[1];
    assert.ok(opis.length >= 80, `${p}: opis ma tylko ${opis.length} znaków`);
    assert.ok(opis.length <= 175, `${p}: opis ma ${opis.length} znaków — Google utnie`);
  }
});

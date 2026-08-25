/**
 * STRONY MIAST I ICH FAQ.
 *
 *   node --test scripts/test-miasta.mjs
 *
 * Zlecenie Dawida (25.08.2026): pięć nowych miast + realne FAQ.
 * Najważniejsze, czego pilnujemy: odpowiedzi muszą być PRAWDZIWE
 * (kwoty z tego samego źródła co strony) i UCZCIWE przy miastach
 * spoza promienia bezpłatnego pomiaru.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MIASTA, NOWE, wgSluga } from './lib/miasta.mjs';
import { pytaniaMiasta, schemaFaq } from './lib/faq-miasta.mjs';

const pamiec = JSON.parse(fs.readFileSync(new URL('./lib/ceny-tresc.json', import.meta.url), 'utf8'));
const KWOTY = pamiec.kwoty;
const WZOROW = pamiec.liczby.wszystkieWzory;

test('każde miasto ma komplet odmian — nie zgadujemy ich z końcówki', () => {
  for (const m of MIASTA) {
    for (const pole of ['nazwa', 'wMiescie', 'doMiasta', 'slug']) {
      assert.ok(m[pole], `${m.slug}: brakuje ${pole}`);
    }
  }
});

test('odmiany nietypowych nazw są poprawne', () => {
  assert.equal(wgSluga('nowa-deba').wMiescie, 'Nowej Dębie');
  assert.equal(wgSluga('stalowa-wola').wMiescie, 'Stalowej Woli');
  assert.equal(wgSluga('ostrowiec-swietokrzyski').wMiescie, 'Ostrowcu Świętokrzyskim');
  assert.equal(wgSluga('kielce').wMiescie, 'Kielcach');
  assert.equal(wgSluga('lublin').doMiasta, 'Lublina');
});

test('nowe miasta mają swoje strony', () => {
  for (const m of NOWE) {
    const plik = new URL(`../blaty-kuchenne-${m.slug}.html`, import.meta.url);
    assert.ok(fs.existsSync(plik), `brak strony dla ${m.nazwa}`);
  }
});

test('każda strona miasta ma FAQ z siedmioma pytaniami', () => {
  for (const [i, m] of MIASTA.entries()) {
    assert.equal(pytaniaMiasta(m, KWOTY, WZOROW, i).length, 7, m.slug);
  }
});

test('kwoty w odpowiedziach są TE SAME co na stronach', () => {
  const p = pytaniaMiasta(MIASTA[0], KWOTY, WZOROW, 0);
  const cena = p[0].odpowiedz;
  assert.match(cena, new RegExp(String(KWOTY.konglomeratProste).replace(/(\d)(?=\d{3})/, '$1 ')));
  assert.match(cena, new RegExp(String(KWOTY.spiekProste).replace(/(\d)(?=\d{3})/, '$1 ')));
});

test('MIASTA DALEKIE mówią wprost, że pomiar nie jest bezpłatny bez warunków', () => {
  // Uczciwość wobec klienta: obiecywanie darmowego dojazdu 130 km
  // byłoby obietnicą, której nie chcemy składać.
  for (const m of MIASTA.filter((x) => x.daleko)) {
    const dojazd = pytaniaMiasta(m, KWOTY, WZOROW, 0)[1].odpowiedz;
    assert.match(dojazd, /poza promieniem|ustalamy indywidualnie/, m.slug);
    assert.doesNotMatch(dojazd, /pomiar Prolinerem wykonujemy bezpłatnie/, m.slug);
  }
});

test('miasta w promieniu mają bezpłatny pomiar wprost napisany', () => {
  for (const m of MIASTA.filter((x) => !x.daleko)) {
    const dojazd = pytaniaMiasta(m, KWOTY, WZOROW, 0)[1].odpowiedz;
    assert.match(dojazd, /bezpłatnie/, m.slug);
  }
});

test('pytania niosą nazwę miasta — nie są bezimienną kopią', () => {
  for (const [i, m] of MIASTA.entries()) {
    const p = pytaniaMiasta(m, KWOTY, WZOROW, i);
    assert.ok(p.some((x) => x.pytanie.includes(m.wMiescie) || x.pytanie.includes(m.doMiasta)), m.slug);
  }
});

test('pytanie z rotacji różnicuje strony', () => {
  const ostatnie = MIASTA.map((m, i) => pytaniaMiasta(m, KWOTY, WZOROW, i).at(-1).pytanie);
  assert.ok(new Set(ostatnie).size >= 4, 'za mało zróżnicowania między miastami');
});

test('schema FAQPage jest poprawnym JSON-em', () => {
  const s = schemaFaq(pytaniaMiasta(MIASTA[0], KWOTY, WZOROW, 0));
  const json = s.replace(/^[\s\S]*?<script type="application\/ld\+json">/, '').replace(/<\/script>[\s\S]*$/, '');
  const d = JSON.parse(json);
  assert.equal(d['@type'], 'FAQPage');
  assert.equal(d.mainEntity.length, 7);
  assert.equal(d.mainEntity[0]['@type'], 'Question');
});

test('cudzysłowy w treści nie rozwalają schemy', () => {
  const s = schemaFaq([{ pytanie: 'Czy "to" działa?', odpowiedz: 'Tak — <b>działa</b> & jak trzeba.' }]);
  const json = s.replace(/^[\s\S]*?<script type="application\/ld\+json">/, '').replace(/<\/script>[\s\S]*$/, '');
  assert.doesNotThrow(() => JSON.parse(json));
});

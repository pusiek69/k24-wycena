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

/* ─────────────────────────────── Kraków i „miasto + okolice" (27.08.2026) */

const stronaMiasta = (slug) =>
  fs.readFileSync(new URL(`../blaty-kuchenne-${slug}.html`, import.meta.url), 'utf8');

/** Wyciąga wszystkie bloki JSON-LD ze strony i parsuje je. */
const blokiLd = (html) =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) =>
    JSON.parse(m[1])
  );

test('Kraków jest w rejestrze z poprawną odmianą', () => {
  const k = wgSluga('krakow');
  assert.equal(k.wMiescie, 'Krakowie');
  assert.equal(k.doMiasta, 'Krakowa');
  assert.ok(k.daleko, 'Kraków to 170 km — musi być oznaczony jako daleki');
});

test('tytuł i opis Krakowa mieszczą się w tym, co Google pokazuje', () => {
  const k = wgSluga('krakow');
  assert.ok(k.tytul.length <= 60, `tytuł ma ${k.tytul.length} znaków`);
  assert.ok(k.opis.length <= 160, `opis ma ${k.opis.length} znaków`);
  // Frazy, pod które ta strona powstała.
  assert.match(k.tytul, /blaty kuchenne Kraków/i);
  assert.match(k.opis, /blaty granitowe/i);
});

test('okoliczne miejscowości są W TREŚCI strony Krakowa, nie na osobnych stronach', () => {
  const html = stronaMiasta('krakow');
  for (const gmina of wgSluga('krakow').okolice) {
    assert.ok(html.includes(gmina), `brak ${gmina} w treści`);
    assert.ok(
      !fs.existsSync(new URL(`../blaty-kuchenne-${gmina.toLowerCase()}.html`, import.meta.url)),
      `powstała cienka strona dla ${gmina} — miała być jedna mocna strona Krakowa`
    );
  }
});

test('okolice Krakowa są też w areaServed usługi', () => {
  const graf = blokiLd(stronaMiasta('krakow')).find((b) => b['@graph']);
  const usluga = graf['@graph'].find((w) => w['@type'] === 'Service');
  const nazwy = usluga.areaServed.map((a) => a.name);
  assert.ok(nazwy.includes('Kraków'));
  assert.ok(nazwy.includes('Wieliczka') && nazwy.includes('Niepołomice'));
});

test('STRONY DALEKICH MIAST nigdzie nie obiecują bezpłatnego pomiaru', () => {
  /*
   * Regresja, którą ten test ma łapać: strona Krakowa mówi w akapicie
   * „to dalej niż promień, w którym pomiar wykonujemy bezpłatnie",
   * a dwie ramki niżej wzorzec (miasto bliskie) obiecywał „pomiar
   * u Państwa bezpłatny". Klient miałby czarno na białym dwie
   * sprzeczne obietnice na jednej stronie.
   */
  const OBIETNICE = [
    'pomiar u Państwa bezpłatny',
    'umówimy bezpłatny pomiar',
    'Ostateczna cena po bezpłatnym pomiarze',
    'po bezpłatnym pomiarze',
  ];
  for (const m of MIASTA.filter((x) => x.daleko)) {
    const html = stronaMiasta(m.slug);
    for (const zdanie of OBIETNICE) {
      assert.ok(!html.includes(zdanie), `${m.slug}: „${zdanie}" na stronie miasta poza promieniem`);
    }
    // ...ale sama informacja, że promień istnieje, ma zostać.
    assert.match(html, /poza promieniem|dalej niż promień/, m.slug);
  }
});

test('KAŻDA strona miasta ma pełne dane strukturalne, nie samo FAQ', () => {
  /*
   * Regresja z 25.08.2026, naprawiona 27.08: łapczywy wzorzec generatora
   * FAQ (`[^]*?` biegnące przez DWA bloki JSON-LD) zjadał `@graph`
   * z firmą, usługą, ceną i okruszkami na WSZYSTKICH stronach miast.
   * Z zewnątrz nie było tego widać — strony wyglądały tak samo.
   */
  for (const m of MIASTA) {
    const bloki = blokiLd(stronaMiasta(m.slug));
    assert.equal(bloki.length, 2, `${m.slug}: oczekujemy grafu ORAZ FAQPage`);

    const graf = bloki.find((b) => b['@graph']);
    assert.ok(graf, `${m.slug}: brak @graph`);
    const typy = graf['@graph'].map((w) => w['@type']);
    for (const typ of ['HomeAndConstructionBusiness', 'WebPage', 'BreadcrumbList', 'Service']) {
      assert.ok(typy.includes(typ), `${m.slug}: brak ${typ}`);
    }

    assert.ok(
      bloki.some((b) => b['@type'] === 'FAQPage'),
      `${m.slug}: brak FAQPage`
    );
  }
});

test('graf miasta wskazuje na TO miasto, nie na wzorzec', () => {
  for (const m of MIASTA) {
    const graf = blokiLd(stronaMiasta(m.slug)).find((b) => b['@graph']);
    const strona = graf['@graph'].find((w) => w['@type'] === 'WebPage');
    const okruszki = graf['@graph'].find((w) => w['@type'] === 'BreadcrumbList');
    assert.equal(strona.url, `https://kam24h.pl/blaty-kuchenne-${m.slug}`, m.slug);
    assert.equal(okruszki.itemListElement[1].name, m.nazwa, m.slug);
  }
});

test('cena „od" w danych strukturalnych zgadza się z cennikiem', () => {
  for (const m of MIASTA) {
    const graf = blokiLd(stronaMiasta(m.slug)).find((b) => b['@graph']);
    const usluga = graf['@graph'].find((w) => w['@type'] === 'Service');
    assert.equal(usluga.offers.lowPrice, String(Math.round(KWOTY.konglomeratProste)), m.slug);
  }
});

test('Kraków jest wpięty w budowanie, przekierowania i sitemapę', () => {
  const czytaj = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  assert.match(czytaj('vite.config.js'), /blaty-kuchenne-krakow\.html/);
  assert.match(czytaj('netlify.toml'), /from = "\/blaty-kuchenne-krakow\.html"/);
  assert.match(czytaj('public/sitemap.xml'), /blaty-kuchenne-krakow</);
});

test('linkowanie miasto ↔ materiał działa w obie strony', () => {
  const html = stronaMiasta('krakow');
  for (const strona of ['blaty-z-konglomeratu', 'blaty-ze-spieku', 'blaty-granitowe']) {
    assert.ok(html.includes(`/${strona}`), `Kraków nie linkuje do /${strona}`);
    assert.ok(
      fs.readFileSync(new URL(`../${strona}.html`, import.meta.url), 'utf8')
        .includes('/blaty-kuchenne-krakow'),
      `/${strona} nie linkuje z powrotem do Krakowa`
    );
  }
});

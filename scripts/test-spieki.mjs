/**
 * PORADNIK O SPIEKACH.
 *
 *   node --test scripts/test-spieki.mjs
 *
 * Zlecenie Dawida (30.08.2026): wejść do top10 na frazy spiekowe, które robią
 * ~300 wyświetleń na trzy tygodnie i zero kliknięć. Analiza: `docs/analiza-spieki.md`.
 *
 * Czego pilnują te testy — w kolejności ważności:
 *   1. KWOTY I LICZBY WZORÓW zgadzają się z cennikiem. Poradnik żyje z tego,
 *      że podaje prawdziwe pieniądze; rozjazd z cennikiem czyni z niego
 *      dokładnie to, czym przegrywa konkurencja.
 *   2. ZERO CEN ZAKUPOWYCH — to strona publiczna.
 *   3. Kanibalizacja jest naprawiona: trzy stare strony linkują do filaru.
 *   4. Struktura pod frazy z Search Console i poprawne dane strukturalne.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const czytaj = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const PORADNIK = 'blaty-ze-spieku-kwarcowego-poradnik.html';
const html = czytaj(PORADNIK);
const KWOTY = JSON.parse(czytaj('scripts/lib/ceny-tresc.json')).kwoty;

/** Tekst strony bez znaczników — do sprawdzania treści, nie HTML-a. */
const tekst = html
  .replace(/<script[\s\S]*?<\/script>/g, ' ')
  .replace(/<[^>]*>/g, ' ')
  .replace(/\s+/g, ' ');

/** „5550" → „5 550" — tak kwoty wyglądają w treści. */
const zl = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

const ile = (marka) =>
  Object.keys(JSON.parse(czytaj(`src/generated/${marka}.dekory.json`)).dekory || {}).length;

/* ═════════════════════════════════════════ 1. kwoty z jednego źródła */

test('kwoty w poradniku pochodzą z ceny-tresc.json, nie z palca', () => {
  for (const [klucz, opis] of [
    ['spiekProste', 'blat 60 × 300 cm ze spieku'],
    ['spiekL', 'kuchnia w L ze spieku'],
    ['konglomeratProste', 'blat z konglomeratu (do porównania)'],
  ]) {
    assert.ok(
      tekst.includes(zl(KWOTY[klucz])),
      `brak kwoty ${zl(KWOTY[klucz])} zł (${opis}) — poradnik rozjechał się z cennikiem`
    );
  }
  // Zakres ceny materiału za m².
  assert.ok(
    tekst.includes(`${zl(KWOTY.spiekM2Od)}–${zl(KWOTY.spiekM2Do)}`),
    `brak zakresu ${zl(KWOTY.spiekM2Od)}–${zl(KWOTY.spiekM2Do)} zł/m²`
  );
});

test('poradnik nie podaje ŻADNEJ kwoty spoza cennika', () => {
  /*
   * Wyłapuje liczby wyglądające na kwotę („5 550 zł"), których nie ma
   * w `ceny-tresc.json`. Bez tego ktoś dopisałby kiedyś „od 4 900 zł"
   * w akapicie i nikt by tego nie złapał, bo to zwykły tekst.
   */
  const dozwolone = new Set(Object.values(KWOTY).map((k) => zl(k)));
  const znalezione = [...tekst.matchAll(/(\d[\d  ]{2,})\s*zł/g)].map((m) => m[1].trim());
  const obce = [...new Set(znalezione)].filter((k) => !dozwolone.has(k.replace(/\s+/g, ' ')));
  assert.deepEqual(obce, [], `kwoty spoza cennika: ${obce.join(', ')}`);
});

test('liczby wzorów zgadzają się z cennikami wszystkich pięciu marek', () => {
  const marki = {
    'Atlas Plan': ile('atlas-plan'),
    Marazzi: ile('marazzi'),
    Laminam: ile('laminam'),
    'Florim Stone': ile('florim-stone'),
    Keralini: ile('keralini'),
  };
  for (const [nazwa, n] of Object.entries(marki)) {
    assert.ok(
      new RegExp(`${nazwa}[^.]{0,20}${n}`).test(tekst),
      `${nazwa}: w treści brakuje liczby ${n} dekorów`
    );
  }
  const razem = Object.values(marki).reduce((a, b) => a + b, 0);
  assert.ok(tekst.includes(String(razem)), `brak sumy ${razem} wzorów`);
});

/* ═════════════════════════════════════════ 2. tajemnica handlowa */

test('poradnik nie zdradza cen zakupowych ani marż', () => {
  assert.doesNotMatch(html, /zakupow|marż|narzut|rabat handlow/i);
  // „rabat" jest w serwisie zablokowany — w treści klienckiej piszemy „upust".
  assert.doesNotMatch(tekst, /\brabat/i, 'w treści klienckiej piszemy „upust", nie „rabat"');
});

/* ═════════════════════════════ 3. koniec kanibalizacji (główna przyczyna) */

test('trzy stare strony o spiekach linkują DO poradnika', () => {
  /*
   * To była główna przyczyna zera kliknięć: trzy cienkie strony (403, 309
   * i 605 słów) celowały w tę samą intencję i rozcieńczały sygnał.
   * Teraz poradnik jest filarem, a tamte są jego zapleczem.
   */
  for (const strona of [
    'blaty-ze-spieku.html',
    'baza-wiedzy/spiek-kwarcowy.html',
    'baza-wiedzy/spiek-kwarcowy-wady-i-zalety.html',
  ]) {
    assert.match(
      czytaj(strona),
      /href="\/blaty-ze-spieku-kwarcowego-poradnik"/,
      `${strona} nie linkuje do poradnika`
    );
  }
});

test('poradnik odsyła po szczegóły do stron zaplecza i do kalkulatora', () => {
  for (const cel of [
    '/blaty-ze-spieku',
    '/blaty-z-konglomeratu',
    '/blaty-granitowe',
    '/baza-wiedzy/pielegnacja-i-impregnacja',
    '/#kreator',
  ]) {
    assert.ok(html.includes(`href="${cel}"`), `poradnik nie linkuje do ${cel}`);
  }
});

test('poradnik linkuje do miast — bliskich i dalekich', () => {
  for (const m of ['tarnobrzeg', 'rzeszow', 'kielce', 'lublin', 'krakow']) {
    assert.ok(html.includes(`/blaty-kuchenne-${m}"`), `brak linku do miasta: ${m}`);
  }
});

/* ═════════════════════════════════════ 4. struktura pod frazy z GSC */

test('tytuł i opis mieszczą się w tym, co Google pokazuje', () => {
  const tytul = html.match(/<title>([^<]*)<\/title>/)[1];
  const opis = html.match(/name="description" content="([^"]*)"/)[1];
  assert.ok(tytul.length <= 60, `tytuł ma ${tytul.length} znaków: ${tytul}`);
  assert.ok(opis.length <= 160, `opis ma ${opis.length} znaków`);
});

test('frazy z Search Console są w tytule, H1 i nagłówkach', () => {
  // Dokładne frazy, które robią wyświetlenia bez kliknięć.
  const tytul = html.match(/<title>([^<]*)<\/title>/)[1].toLowerCase();
  assert.match(tytul, /blaty ze spieku kwarcowego/);

  const h1 = html.match(/<h1>([\s\S]*?)<\/h1>/)[1].replace(/<[^>]*>/g, ' ').toLowerCase();
  assert.match(h1, /spieku\s+kwarcowego/);

  const naglowki = [...html.matchAll(/<h2[^>]*>([^<]*)<\/h2>/g)].map((m) => m[1].toLowerCase());
  assert.ok(
    naglowki.some((n) => n.includes('ile kosztuje blat ze spieku')),
    'brak nagłówka pod frazę cenową — to najsłabszy punkt konkurencji'
  );
  assert.ok(naglowki.some((n) => n.includes('wady')), 'brak nagłówka o wadach');
});

test('poradnik jest dłuższy niż strony, które zastępuje', () => {
  const slow = tekst.split(' ').filter(Boolean).length;
  // Konkurencja w top10 ma 1800–2500 słów; trzy nasze stare strony razem 1317.
  assert.ok(slow >= 1500, `poradnik ma ${slow} słów — za mało na tę konkurencję`);
});

test('są obie tabele i osiem pytań FAQ', () => {
  assert.equal((html.match(/<table class="zestawienie">/g) || []).length, 2);
  assert.equal((html.match(/class="faq-poz"/g) || []).length, 8);
});

test('sekcja wad jest konkretna, nie odfajkowana', () => {
  // Uczciwa lista wad buduje zaufanie i rankuje na „wady spieków kwarcowych".
  const wady = tekst.slice(tekst.indexOf('Wady spieku'), tekst.indexOf('Grubość płyty'));
  assert.ok(wady.length > 900, `sekcja wad ma ${wady.length} znaków — za krótka`);
  for (const slowo of ['kruchy', 'podkle', 'obróbka']) {
    assert.ok(wady.toLowerCase().includes(slowo), `sekcja wad nie mówi o: ${slowo}`);
  }
});

/* ═════════════════════════════════════════ 5. dane strukturalne */

test('dane strukturalne: Article + FAQPage, obie poprawnym JSON-em', () => {
  const bloki = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
    (m) => JSON.parse(m[1])
  );
  assert.equal(bloki.length, 2, 'oczekujemy dwóch bloków: artykułu i FAQ');

  const graf = bloki.find((b) => b['@graph']);
  assert.ok(graf, 'brak grafu z artykułem');
  const artykul = graf['@graph'].find((w) => w['@type'] === 'Article');
  assert.ok(artykul, 'brak Article');
  assert.equal(artykul.author.name, 'Dawid Ząbek');
  assert.ok(graf['@graph'].some((w) => w['@type'] === 'BreadcrumbList'));

  const faq = bloki.find((b) => b['@type'] === 'FAQPage');
  assert.ok(faq, 'brak FAQPage');
  assert.equal(faq.mainEntity.length, 8);
});

test('pytania w schemie są TE SAME co widoczne na stronie', () => {
  // Schema opisująca coś, czego na stronie nie ma, to powód do kary od Google.
  const faq = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((m) => JSON.parse(m[1]))
    .find((b) => b['@type'] === 'FAQPage');

  const widoczne = [...html.matchAll(/<div class="faq-poz">\s*<h3>([^<]*)<\/h3>/g)].map((m) => m[1]);
  assert.deepEqual(
    faq.mainEntity.map((q) => q.name).sort(),
    widoczne.sort(),
    'pytania w schemie rozjechały się z tymi na stronie'
  );
});

/* ═════════════════════════════════════════ 6. wpięcie w serwis */

test('poradnik jest wpięty w budowanie, przekierowania, sitemapę i stopkę', () => {
  assert.match(czytaj('vite.config.js'), /blaty-ze-spieku-kwarcowego-poradnik\.html/);
  assert.match(czytaj('netlify.toml'), /from = "\/blaty-ze-spieku-kwarcowego-poradnik\.html"/);
  assert.match(czytaj('public/sitemap.xml'), /blaty-ze-spieku-kwarcowego-poradnik</);
  // Stopka: link z innych stron i „tu jesteś" na własnej.
  assert.match(czytaj('blaty-ze-spieku.html'), /href="\/blaty-ze-spieku-kwarcowego-poradnik"/);
  assert.match(html, /<span class="foot-tu">Poradnik: spieki<\/span>/);
});

test('poradnik nie udaje, że mamy zdjęcia realizacji ze spieku', () => {
  /*
   * W galerii jest 43 realizacje: granit, kwarcyt, konglomerat — ANI JEDNEGO
   * spieku. Dopóki Dawid nie sfotografuje montażu, poradnik nie może
   * pokazywać „naszych realizacji ze spieku”. Podłożenie pod to zdjęcia
   * granitu byłoby wprowadzaniem klienta w błąd na stronie, która ma
   * budować zaufanie.
   */
  const galeria = JSON.parse(czytaj('src/generated/realizacje.json'));
  const lista = Array.isArray(galeria) ? galeria : galeria.realizacje || [];
  const spieki = lista.filter((r) => /spiek|gres/i.test(`${r.rodzaj} ${r.material}`));

  if (!spieki.length) {
    assert.doesNotMatch(
      html,
      /<img[^>]+\/realizacje\//,
      'poradnik pokazuje zdjęcia z galerii, choć nie ma tam ani jednej realizacji ze spieku'
    );
  }
});

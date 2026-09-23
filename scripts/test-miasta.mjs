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
import { blokCen, blokRealizacji, blokZasiegu, blokSasiadow } from './lib/bloki-miast.mjs';

const pamiec = JSON.parse(fs.readFileSync(new URL('./lib/ceny-tresc.json', import.meta.url), 'utf8'));
const KWOTY = pamiec.kwoty;
const WZOROW = pamiec.liczby.wszystkieWzory;
const REALIZACJE = JSON.parse(
  fs.readFileSync(new URL('../src/generated/realizacje.json', import.meta.url), 'utf8')
);
/** 5500 → „5 500" — tak samo jak w blokach i w FAQ. */
const zlSpacja = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

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

test('każda strona miasta ma komplet pytań — siedem plus własne', () => {
  /*
   * Siedem pytań to podstawa wspólna dla wszystkich miast (sześć stałych
   * i jedno z rotacji). Miasto priorytetowe może dołożyć własne przez
   * `pytaniaWlasne` w lib/miasta.mjs — wtedy ma ich więcej i tak ma być.
   */
  for (const [i, m] of MIASTA.entries()) {
    const oczekiwane = 7 + (m.pytaniaWlasne || []).length;
    assert.equal(pytaniaMiasta(m, KWOTY, WZOROW, i).length, oczekiwane, m.slug);
  }
});

test('WŁASNE pytania miasta nie powtarzają się na innych stronach', () => {
  /*
   * Sens `pytaniaWlasne` jest taki, żeby strona miasta NIE była kopią
   * pozostałych. Gdyby te same pytania weszły wszędzie, nie różnicowałyby
   * niczego — a przy piętnastu bliźniaczych stronach to jedyne, co je
   * odróżnia poza nazwą i kilometrami.
   */
  const wlasne = new Map();
  for (const [i, m] of MIASTA.entries()) {
    for (const p of pytaniaMiasta(m, KWOTY, WZOROW, i)) {
      if (!(m.pytaniaWlasne || []).some((x) => x.pytanie === p.pytanie)) continue;
      assert.ok(!wlasne.has(p.pytanie), `„${p.pytanie}" jest na dwóch stronach`);
      wlasne.set(p.pytanie, m.slug);
    }
  }
});

test('MIELEC — priorytet Dawida — ma najbogatszą stronę ze wszystkich miast', () => {
  /*
   * Zlecenie z 06.09.2026: „zależy mi na miastach […] mielec (na tym
   * najbardziej)". Ten test pilnuje, żeby Mielec przy kolejnej zmianie
   * nie zsunął się z powrotem do wspólnego wzorca.
   */
  const m = MIASTA.find((x) => x.slug === 'mielec');
  assert.ok(m, 'brak Mielca w rejestrze');
  assert.ok(m.tytul?.includes('Mielec'), 'Mielec bez własnego tytułu');
  assert.ok(m.opis?.includes('Mielec'), 'Mielec bez własnego opisu');
  assert.ok((m.okolice || []).length >= 5, 'Mielec bez listy okolicznych gmin');
  assert.ok((m.pytaniaWlasne || []).length >= 2, 'Mielec bez własnych pytań');

  const i = MIASTA.indexOf(m);
  const ile = (x) => pytaniaMiasta(x, KWOTY, WZOROW, MIASTA.indexOf(x)).length;
  const najwiecej = Math.max(...MIASTA.map(ile));
  assert.equal(pytaniaMiasta(m, KWOTY, WZOROW, i).length, najwiecej, 'inne miasto ma więcej pytań');
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
  assert.equal(d.mainEntity.length, 7 + (MIASTA[0].pytaniaWlasne || []).length);
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

test('KAŻDY własny tytuł i opis mieści się w tym, co Google pokazuje', () => {
  /*
   * Do 06.09.2026 ta reguła obowiązywała tylko Kraków — jedyne miasto,
   * które miało wtedy własne pola. Przy dokładaniu kolejnych (Mielec,
   * Tarnobrzeg, Sandomierz, Rzeszów, Staszów) dwa od razu wyszły za długie,
   * więc limit dotyczy teraz wszystkich. Za długi tytuł Google ucina
   * w połowie zdania i traci się to, co miało zachęcić do kliknięcia.
   */
  for (const m of MIASTA) {
    if (m.tytul) assert.ok(m.tytul.length <= 60, `${m.slug}: tytuł ma ${m.tytul.length} znaków`);
    if (m.opis) assert.ok(m.opis.length <= 160, `${m.slug}: opis ma ${m.opis.length} znaków`);
    // Nazwa miasta musi być w tytule — bez niej strona nie konkuruje o frazę lokalną.
    if (m.tytul) assert.ok(m.tytul.includes(m.nazwa), `${m.slug}: tytuł bez nazwy miasta`);
  }
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

/* ═══════════════ BLOKI DOŁOŻONE PO ANALIZIE KONKURENCJI (06.09.2026) ══════
   IGNIKOM pokazywał na stronie miasta ceny „od", zdjęcia realizacji,
   dzielnice i linki do sąsiednich miast — my żadnej z tych rzeczy nie
   mieliśmy. Te testy pilnują, żeby nie zniknęły przy kolejnym generowaniu
   i — co ważniejsze — żeby nie zaczęły kłamać o cenach. */

test('CENNIK na stronie miasta rozdziela płytę od gotowego blatu', () => {
  /*
   * ⚠ Najważniejszy test w tej grupie. `konglomeratM2Od` to cena SAMEJ
   * PŁYTY. Podpisanie jej jako „blat od 505 zł/m²" byłoby wprowadzaniem
   * klienta w błąd — do blatu dochodzi obróbka, pomiar, transport i montaż,
   * czyli w praktyce kilka tysięcy złotych. Tabela musi więc nazywać obie
   * kwoty wprost i osobno.
   */
  const html = blokCen(wgSluga('mielec'), KWOTY, pamiec.liczby);
  assert.match(html, /Sama płyta/, 'brak kolumny z ceną materiału');
  assert.match(html, /Gotowy blat z montażem/, 'brak kolumny z ceną gotowego blatu');
  assert.match(html, new RegExp(`od ${String(KWOTY.konglomeratM2Od)} zł/m²`), 'zła cena m² konglomeratu');
  assert.match(html, new RegExp(`od ${zlSpacja(KWOTY.konglomeratProste)} zł`), 'zła cena gotowego blatu');
  assert.match(html, /obróbkę,\s*\n?\s*wycięcie pod zlew i płytę grzewczą, transport i montaż/,
    'nie napisano, co obejmuje cena gotowego blatu');
});

test('CENNIK nie wymyśla ceny „od" dla kamienia naturalnego', () => {
  /*
   * Kamienia naturalnego nie da się uczciwie podać „od X zł/m²" — liczy się
   * go z konkretnej płyty ze stanu magazynowego. Konkurencja taką liczbę
   * podaje; my wolimy powiedzieć prawdę niż dopisać kwotę, której nikt nie
   * obroni przy telefonie.
   */
  const html = blokCen(wgSluga('mielec'), KWOTY, pamiec.liczby);
  const wiersz = html.slice(html.indexOf('Kamień naturalny'));
  assert.doesNotMatch(wiersz.slice(0, 400), /od \d+ zł\/m²/, 'wymyślona cena „od" dla kamienia naturalnego');
  assert.match(wiersz, /Wycena z konkretnej płyty/);
});

test('CENNIK linkuje do wyprzedaży i do kalkulatora', () => {
  // Dwie nasze przewagi nad konkurencją: prawdziwy kalkulator i płyty
  // z placu w niższej cenie. Na stronie miasta muszą być widoczne.
  const html = blokCen(wgSluga('mielec'), KWOTY, pamiec.liczby);
  assert.match(html, /href="\/wyprzedaz-plyt"/, 'brak linku do wyprzedaży');
  assert.match(html, /href="\/#kreator"/, 'brak linku do kalkulatora');
});

test('REALIZACJE — każde miasto pokazuje INNY komplet zdjęć', () => {
  /*
   * Piętnaście stron z tym samym kompletem zdjęć wygląda dla Google jak
   * jedna strona powielona piętnaście razy. Przesunięcie o numer miasta
   * ma dawać różne trójki.
   */
  const komplety = MIASTA.map((m, i) =>
    (blokRealizacji(m, REALIZACJE, i).match(/\/realizacje\/([a-z0-9-]+)-mini\.webp/g) || []).join('|')
  );
  assert.equal(new Set(komplety).size, komplety.length, 'dwa miasta mają ten sam komplet zdjęć');
  for (const k of komplety) assert.equal(k.split('|').length, 3, 'miasto bez trzech zdjęć');
});

test('REALIZACJE nie twierdzą, że zdjęcie jest z TEGO miasta', () => {
  /*
   * Nie wiemy, gdzie stoi która kuchnia. Podpis „nasza realizacja w Mielcu"
   * pod zdjęciem z innego miasta byłby zwykłym kłamstwem — a takie rzeczy
   * wracają, kiedy klient zapyta o adres.
   */
  for (const [i, m] of MIASTA.entries()) {
    const html = blokRealizacji(m, REALIZACJE, i);
    const podpisy = html.match(/alt="[^"]*"|<figcaption>[\s\S]*?<\/figcaption>/g) || [];
    for (const p of podpisy) {
      assert.ok(!p.includes(m.nazwa) && !p.includes(m.wMiescie),
        `${m.slug}: podpis sugeruje, że zdjęcie jest z tego miasta — ${p.slice(0, 70)}`);
    }
  }
});

test('REALIZACJE wskazują na pliki, które naprawdę istnieją', () => {
  const html = blokRealizacji(wgSluga('mielec'), REALIZACJE, MIASTA.indexOf(wgSluga('mielec')));
  for (const plik of html.match(/\/realizacje\/[a-z0-9.-]+/g) || []) {
    assert.ok(fs.existsSync(new URL(`../public${plik}`, import.meta.url)), `brak pliku ${plik}`);
  }
});

test('DZIELNICE i okoliczne gminy są w treści miast priorytetowych', () => {
  // Ktoś szukający „blaty kuchenne Smoczka" ma trafić na stronę Mielca.
  for (const slug of ['mielec', 'tarnobrzeg', 'sandomierz', 'rzeszow']) {
    const m = wgSluga(slug);
    assert.ok((m.dzielnice || []).length >= 5, `${slug}: brak dzielnic`);
    const html = blokZasiegu(m);
    for (const d of m.dzielnice) assert.ok(html.includes(d), `${slug}: brak „${d}" w treści`);
    for (const o of m.okolice || []) assert.ok(html.includes(o), `${slug}: brak „${o}" w treści`);
  }
});

test('SĄSIEDZI linkują do innych miast, nigdy do siebie', () => {
  for (const m of MIASTA) {
    const html = blokSasiadow(m, MIASTA);
    assert.ok(!html.includes(`/blaty-kuchenne-${m.slug}"`), `${m.slug} linkuje sam do siebie`);
    const linki = html.match(/\/blaty-kuchenne-[a-z-]+/g) || [];
    // 4 z automatu (albo z ręcznej listy) + ewentualne jawnie dopięte linki zwrotne.
    const oczekiwane = m.sasiedzi?.length ?? 4 + (m.dodatkowiSasiedzi?.length ?? 0);
    assert.ok(linki.length >= 4, `${m.slug}: ma ${linki.length} linków, minimum to 4`);
    assert.ok(linki.length <= oczekiwane, `${m.slug}: ma ${linki.length} linków, więcej niż ${oczekiwane}`);
    assert.equal(new Set(linki).size, linki.length, `${m.slug}: powtórzony link`);
  }
});

/*
 * MIELEC — sąsiedzi GEOGRAFICZNI, nie „tak samo daleko od Tarnobrzega"
 * (13.09.2026). Automat dobierał Opatów, Staszów, Nisko i Sandomierz,
 * bo leżą ~45 km od zakładu, tak jak Mielec — tyle że 60–90 km od samego
 * Mielca. Ten test nie pozwoli wrócić do tamtej listy.
 */
test('MIELEC linkuje do realnych sąsiadów, z odległością liczoną od Mielca', () => {
  const html = blokSasiadow(wgSluga('mielec'), MIASTA);
  const pary = [...html.matchAll(/blaty-kuchenne-([a-z-]+)">[^<]*<\/a>\s*<span class="drobne">([^<]*)/g)]
    .map(([, slug, opis]) => [slug, opis]);

  assert.deepEqual(
    pary.map(([slug]) => slug),
    ['nowa-deba', 'debica', 'tarnobrzeg', 'stalowa-wola'],
    'Mielec: zła lista sąsiadów'
  );
  for (const [slug, opis] of pary) {
    assert.match(opis, /km od Mielca$/, `Mielec → ${slug}: odległość nie jest liczona od Mielca („${opis}")`);
  }
  for (const daleko of ['opatow', 'staszow', 'nisko', 'sandomierz']) {
    assert.ok(!html.includes(`/blaty-kuchenne-${daleko}"`), `Mielec znów linkuje do odległego: ${daleko}`);
  }
});

test('LINKI ZWROTNE do Mielca stoją na stronach Tarnobrzega i Stalowej Woli', () => {
  for (const slug of ['tarnobrzeg', 'stalowa-wola']) {
    const html = blokSasiadow(wgSluga(slug), MIASTA);
    assert.ok(html.includes('href="/blaty-kuchenne-mielec"'), `${slug}: brak linku do Mielca`);
    // …i ten sam link jest w zbudowanym pliku, nie tylko w generatorze.
    const plik = fs.readFileSync(new URL(`../blaty-kuchenne-${slug}.html`, import.meta.url), 'utf8');
    assert.ok(plik.includes('href="/blaty-kuchenne-mielec"'), `${slug}.html: link do Mielca nie trafił do strony`);
  }
});

test('SĄSIEDZI: literówka w slugu wywala build, zamiast gubić link po cichu', () => {
  const zepsute = { ...wgSluga('mielec'), sasiedzi: [{ slug: 'miasto-ktorego-nie-ma', km: 10 }] };
  assert.throws(() => blokSasiadow(zepsute, MIASTA), /nie ma miasta/);
});

test('SĄSIEDZI: link do Tarnobrzega nie mówi „0 km od zakładu w Tarnobrzegu"', () => {
  for (const m of MIASTA) {
    assert.ok(!blokSasiadow(m, MIASTA).includes('>0 km od'), `${m.slug}: „0 km od naszego zakładu"`);
  }
});

/*
 * IDEMPOTENTNOŚĆ generatora (13.09.2026). Każde `npm run miasta` dokładało
 * dwie puste linie do każdej strony, a sitemapa brała z tego świeże daty.
 * Pilnujemy tu skutku: w zbudowanej stronie przed blokiem stoi dokładnie
 * JEDNA pusta linia, a nie narastający stos.
 */
test('GENERATOR jest idempotentny — przed blokiem miasta nie narastają puste linie', () => {
  for (const m of MIASTA) {
    const t = fs
      .readFileSync(new URL(`../blaty-kuchenne-${m.slug}.html`, import.meta.url), 'utf8')
      .replace(/\r\n/g, '\n');
    const i = t.indexOf('<!-- BLOKI:MIASTO');
    assert.ok(i > 0, `${m.slug}: brak bloku miasta`);
    const przed = t.slice(0, i).match(/\s*$/)[0];
    assert.equal(przed, '\n\n      ', `${m.slug}: przed blokiem nagromadziły się puste linie`);
  }
});

test('KAŻDA strona miasta niesie wszystkie cztery bloki', () => {
  for (const m of MIASTA) {
    const t = fs.readFileSync(new URL(`../blaty-kuchenne-${m.slug}.html`, import.meta.url), 'utf8');
    assert.match(t, /Ile kosztuje blat kamienny w /, `${m.slug}: brak cennika`);
    assert.match(t, /Nasze blaty — zdjęcia z montaży/, `${m.slug}: brak realizacji`);
    assert.match(t, /Blaty kamienne w sąsiednich miastach/, `${m.slug}: brak linków do sąsiadów`);
    // Stary znacznik z pierwszej wersji nie ma prawa zostać obok nowego.
    assert.ok(!t.includes('<!-- OKOLICE:MIASTO'), `${m.slug}: został stary blok OKOLICE`);
    assert.equal((t.match(/<!-- BLOKI:MIASTO/g) || []).length, 1, `${m.slug}: zdublowany blok`);
  }
});

/* ════════ linkowanie ze STRONY GŁÓWNEJ (propozycja SEO, 22–23.09.2026) ════ */

test('STRONA GŁÓWNA linkuje do stron miast, a Mielec idzie pierwszy', () => {
  /*
   * „/" to najmocniejsza strona serwisu i do 23.09.2026 linkowała tylko
   * do Tarnobrzega — reszta miast wisiała w zdaniu o dojazdach jako goły
   * tekst. Mielec (priorytet Dawida, w GSC drugi tydzień z zerem wyświetleń)
   * dostaje pełną frazę „blaty kuchenne Mielec", bo to jest to zapytanie,
   * na które ma się pokazywać.
   */
  const glowna = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const zdanie = glowna.match(/Dojeżdżamy na bezpłatny pomiar[\s\S]*?<\/p>/);
  assert.ok(zdanie, 'zdanie o dojazdach zniknęło ze strony głównej');

  assert.match(zdanie[0], /<a href="\/blaty-kuchenne-mielec">blaty kuchenne Mielec<\/a>/);
  for (const slug of ['sandomierz', 'stalowa-wola', 'nisko', 'nowa-deba', 'rzeszow'])
    assert.match(zdanie[0], new RegExp(`href="/blaty-kuchenne-${slug}"`), `brak linku: ${slug}`);

  // Mielec przed pozostałymi — to była cała rzecz w tej zmianie.
  assert.ok(
    zdanie[0].indexOf('blaty-kuchenne-mielec') < zdanie[0].indexOf('blaty-kuchenne-sandomierz'),
    'Mielec nie stoi na początku listy'
  );

  // Stopka: obok Tarnobrzega.
  assert.match(glowna, /<a href="\/blaty-kuchenne-mielec">Blaty kuchenne Mielec<\/a>/);
});

test('STRONA GŁÓWNA nie linkuje miast, które nie mają swojej strony', () => {
  /*
   * Kolbuszowa i Połaniec są w zdaniu o dojazdach, ale stron nie mają.
   * Link do nieistniejącej strony to 404 na najmocniejszej stronie serwisu —
   * i dokładnie ten rodzaj błędu, którego nie widać przy pisaniu.
   */
  const glowna = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const slug of ['kolbuszowa', 'polaniec'])
    assert.ok(!glowna.includes(`/blaty-kuchenne-${slug}`), `link do nieistniejącej strony: ${slug}`);

  // A każdy link do miasta, który JEST, musi mieć swój plik.
  for (const m of glowna.matchAll(/href="\/blaty-kuchenne-([a-z-]+)"/g))
    assert.ok(
      fs.existsSync(new URL(`../blaty-kuchenne-${m[1]}.html`, import.meta.url)),
      `strona główna linkuje do nieistniejącej strony: ${m[1]}`
    );
});

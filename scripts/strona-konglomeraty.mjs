/**
 * PORADNIK O KONGLOMERACIE — generator strony.
 *
 *   npm run konglomeraty
 *   npm run konglomeraty -- --sprawdz     (nic nie zapisuje, mówi czy aktualna)
 *
 * Zlecenie Dawida (01.09.2026): wejść do top10 na frazy konglomeratowe, które
 * robią ~96 wyświetleń i ZERO kliknięć („blaty z konglomeratu cena" 49,
 * „blat z konglomeratu" 47, pozycje 20–40).
 * Analiza przed napisaniem: `docs/analiza-konglomeraty.md`.
 *
 * ⚠ RÓŻNICA WOBEC SPIEKÓW, KTÓRA ZMIENIA PLAN.
 * Przy spiekach o te same frazy biły się TRZY cienkie strony i poradnik był
 * przede wszystkim scaleniem. Tutaj audyt wszystkich stron pokazał JEDNĄ
 * stronę konglomeratową — więc gdyby po prostu dołożyć drugą o tej samej
 * intencji, sam bym tę kanibalizację stworzył. Dlatego razem z poradnikiem
 * PRZECELOWUJEMY `/blaty-z-konglomeratu` na intencję „wzory i kolekcje"
 * (patrz `przecelujKolekcje()` niżej).
 *
 * DLACZEGO GENERATOR, A NIE RĘCZNY HTML: poradnik żyje z konkretnych kwot
 * i liczby wzorów. Wpisane ręcznie zaczęłyby kłamać przy pierwszej zmianie
 * cennika i nikt by tego nie zauważył. Wszystko wchodzi z jednego źródła:
 *
 *   • kwoty  ← scripts/lib/ceny-tresc.json (to samo, co reszta serwisu)
 *   • wzory  ← rejestr firm z silnika (policzone, nie przepisane)
 *
 * Ramę strony (head, zgody, nagłówek, stopka, skrypty) bierzemy ZE WZORCA,
 * żeby nie rozjechała się z resztą serwisu przy pierwszej zmianie w stopce.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tresc, schema, zl } from './lib/tresc-konglomeraty.mjs';
import { wczytajSilnik } from './lib/silnik.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tylkoSprawdz = process.argv.includes('--sprawdz');

const WZORZEC = path.join(ROOT, 'blaty-lazienkowe.html');
const CEL = path.join(ROOT, 'blaty-z-konglomeratu-kwarcowego-poradnik.html');
const ADRES = 'https://kam24h.pl/blaty-z-konglomeratu-kwarcowego-poradnik';

/* ─────────────────────────────────────────────────── dane z jednego źródła */

const KWOTY = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'scripts', 'lib', 'ceny-tresc.json'), 'utf8')
).kwoty;

const FIRMY = (await wczytajSilnik()).FIRMY;

/**
 * Ile dekorów ma marka — z REJESTRU, nie z pliku `*.dekory.json`.
 * Rejestr uwzględnia wzory dostępne tylko na czas kampanii dostawcy,
 * a klient może je wybrać w kalkulatorze, więc taką liczbę ma widzieć.
 */
const ile = (slug) => {
  const f = FIRMY.find((x) => x.slug === slug);
  return f ? Object.keys(f.dekory || {}).length : 0;
};

/*
 * WSZYSTKIE PIĘĆ marek konglomeratu z cennika.
 *
 * ⚠ To celowo szersza lista niż `KONGLOMERATY_NA_STRONIE` w ceny-tresc.mjs,
 * która do 01.09.2026 znała tylko trzy (Avant Quartz, Caesarstone, Technistone)
 * → 158 wzorów w treści, przy 230 w cennikach. Dokładnie ten sam błąd
 * naprawiliśmy 30.08 po stronie spieków. Poradnik wymienia wszystkie marki
 * z nazwy, więc musi podawać ich prawdziwą sumę.
 */
const WZORY = {
  technistone: ile('technistone'),
  avant: ile('avant-quartz'),
  interq: ile('interq'),
  pacific: ile('pacific'),
  caesarstone: ile('caesarstone'),
};
WZORY.razem = Object.values(WZORY).reduce((a, b) => a + b, 0);

/*
 * ILE MAMY WŁASNYCH ZDJĘĆ BLATÓW Z KONGLOMERATU.
 *
 * ⚠ Analiza (sekcja 6) zakładała, że nie mamy żadnych — przez analogię
 * do spieków, gdzie naprawdę jest zero. To było błędne: w galerii jest
 * ich dziewięć, opisanych z nazwy wzoru. To atut, którego nie ma żaden
 * artykuł w top10 — wszystkie ilustrują się zdjęciami stockowymi.
 *
 * Liczymy z pliku galerii, a nie wpisujemy — po sprzedaniu albo dołożeniu
 * realizacji liczba na stronie ma się zmienić sama.
 */
const REALIZACJE = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src', 'generated', 'realizacje.json'), 'utf8')
);
WZORY.realizacje = (Array.isArray(REALIZACJE) ? REALIZACJE : REALIZACJE.realizacje || [])
  .filter((r) => /konglomerat|quartz|technistone|caesarstone/i.test(r.material || '')).length;

// Do tabeli porównawczej — liczba wzorów spieku liczona tak samo.
WZORY.spieki = ['keralini', 'marazzi', 'atlas-plan', 'laminam', 'florim-stone']
  .reduce((a, s) => a + ile(s), 0);

/* ────────────────────────────────────────────────────────── head i teksty */

const TYTUL = 'Blaty z konglomeratu kwarcowego — ceny, wady i zalety';

// Do 160 znaków — dłuższy Google i tak utnie w wynikach.
const OPIS =
  `Blat z konglomeratu od ${zl(KWOTY.konglomeratProste)} zł (60 × 300 cm). Rozbicie ceny, ` +
  'uczciwe wady, porównanie ze spiekiem i granitem. Poradnik kamieniarza.';

/* ───────────────────────────────────────────────────────────── budowanie */

function zbuduj() {
  // Repo ma pomieszane CRLF i LF — wzorce po znaku nowej linii by w nie nie trafiły.
  let t = fs.readFileSync(WZORZEC, 'utf8').replace(/\r\n/g, '\n');

  const podmiany = [
    ['<title>Blaty łazienkowe z kamienia — który materiał wybrać</title>', `<title>${TYTUL}</title>`],
    ['blaty-lazienkowe', 'blaty-z-konglomeratu-kwarcowego-poradnik'],
    [
      '<meta property="og:title" content="Blaty łazienkowe z kamienia — co się sprawdza" />',
      '<meta property="og:title" content="Blaty z konglomeratu kwarcowego — ceny i wady" />',
    ],
    [
      '<h1>Blaty<br><em>łazienkowe.</em></h1>',
      '<h1>Blaty z konglomeratu<br><em>kwarcowego.</em></h1>',
    ],
    /*
     * Stopka: wzorzec niesie „tu jesteś" przy SOBIE. Bez odwrócenia klient
     * miałby na poradniku wyszarzone, nieklikalne „Blaty łazienkowe" —
     * dokładnie ten błąd wyszedł 30.08 na stronie wyprzedaży.
     */
    ['<span class="foot-tu">Blaty łazienkowe</span>',
     '<a href="/blaty-lazienkowe">Blaty łazienkowe</a>'],
    // ...i odwrotnie: na WŁASNEJ stronie nie linkujemy sami do siebie.
    ['<a href="/blaty-z-konglomeratu-kwarcowego-poradnik">Poradnik: konglomerat</a>',
     '<span class="foot-tu">Poradnik: konglomerat</span>'],
  ];

  for (const [z, na] of podmiany) {
    if (!t.includes(z)) throw new Error(`Wzorzec nie zawiera fragmentu: ${z.slice(0, 60)}`);
    t = t.split(z).join(na);
  }

  t = t.replace(/(name="description" content=")[^"]*(")/, `$1${OPIS}$2`);
  t = t.replace(/(property="og:description" content=")[^"]*(")/, `$1${OPIS}$2`);
  t = t.replace(
    /<p class="sub">[\s\S]*?<\/p>/,
    '<p class="sub">Ile naprawdę kosztuje, z czego składa się cena, jakie ma wady ' +
      'i kiedy przegrywa ze spiekiem — z warsztatu, w którym te płyty tniemy od 2014 roku.</p>'
  );

  // Dane strukturalne wzorca (artykuł o łazienkach) zamieniamy na własne.
  const reLd = /  <script type="application\/ld\+json">[^]*?\n  <\/script>/;
  if (!reLd.test(t)) throw new Error('Wzorzec nie ma bloku danych strukturalnych.');
  t = t.replace(reLd, schema(KWOTY, WZORY, { tytul: TYTUL, opis: OPIS, adres: ADRES }));

  const reMain = /  <main id="tresc"[^]*?\n  <\/main>/;
  if (!reMain.test(t)) throw new Error('Wzorzec nie ma sekcji <main>.');
  t = t.replace(reMain, tresc(KWOTY, WZORY));

  return t;
}

/* ──────────────────────────── przecelowanie strony kolekcji (anty-kanibalizacja) */

const KOLEKCJE = path.join(ROOT, 'blaty-z-konglomeratu.html');

/**
 * `/blaty-z-konglomeratu` przestaje walczyć o „cenę", a zaczyna o „wzory
 * i kolekcje" — frazę, na którą i tak jest lepiej przygotowana, bo ma listę
 * kolekcji z linkami do katalogów producentów.
 *
 * Bez tego kroku serwis miałby DWIE strony z niemal identycznym tytułem
 * („…konglomeratu kwarcowego — ceny…") i sam bym stworzył problem, który
 * przy spiekach musieliśmy rozwiązywać.
 *
 * Adres i treść strony zostają nietknięte — zmieniamy wyłącznie sygnały
 * (tytuł, opis, og:title) i dokładamy link do poradnika.
 */
function przecelujKolekcje() {
  if (!fs.existsSync(KOLEKCJE)) return 0;

  const surowy = fs.readFileSync(KOLEKCJE);
  const crlf = surowy.includes('\r\n');
  let t = surowy.toString('utf8').replace(/\r\n/g, '\n');
  const przed = t;

  const NOWY_TYTUL = 'Blaty kwarcowe — kolekcje i wzory konglomeratu';
  const NOWY_OPIS =
    `${WZORY.razem} wzorów konglomeratu w pięciu kolekcjach: Technistone, Avant Quartz, ` +
    'InterQ, Pacific, Caesarstone. Katalogi wzorów i wycena online.';

  t = t.replace(/<title>[^<]*<\/title>/, `<title>${NOWY_TYTUL}</title>`);
  t = t.replace(/(name="description" content=")[^"]*(")/, `$1${NOWY_OPIS}$2`);
  t = t.replace(/(property="og:description" content=")[^"]*(")/, `$1${NOWY_OPIS}$2`);
  t = t.replace(
    /(<meta property="og:title" content=")[^"]*(")/,
    '$1Blaty kwarcowe — kolekcje i wzory$2'
  );

  // Link do poradnika — jeśli jeszcze go nie ma.
  if (!t.includes('/blaty-z-konglomeratu-kwarcowego-poradnik')) {
    const link =
      '<p class="cta-linia">Szukasz cen i wad? ' +
      '<a href="/blaty-z-konglomeratu-kwarcowego-poradnik">Pełny poradnik o konglomeracie</a> ' +
      '— rozbicie ceny, uczciwe wady, porównanie ze spiekiem i granitem, FAQ.</p>';
    t = t.replace(/(\n  <\/main>)/, `\n    ${link}$1`);
  }

  if (t === przed) return 0;
  if (!tylkoSprawdz) fs.writeFileSync(KOLEKCJE, crlf ? t.replace(/\n/g, '\r\n') : t, 'utf8');
  console.log(`  ${tylkoSprawdz ? '≠' : '✓'} blaty-z-konglomeratu.html → przecelowana na „kolekcje i wzory"`);
  return 1;
}

/* ─────────────────── linkowanie ZE stron konglomeratowych DO poradnika */

const ZAPLECZE = [
  // Strona o samym materiale ZOSTAJE — ma inną intencję niż filar
  // („z czego to jest zrobione", nie „ile kosztuje") — ale ma do niego linkować.
  ['baza-wiedzy/konglomerat-kwarcowy.html', 'Pełny poradnik o konglomeracie'],
  ['blaty-kuchenne-tarnobrzeg.html', 'Poradnik: blaty z konglomeratu'],
  ['czesto-zadawane-pytania.html', 'Poradnik: blaty z konglomeratu'],
];

const LINK = (etykieta) =>
  `<p class="cta-linia">Wybierasz materiał na blat? ` +
  `<a href="/blaty-z-konglomeratu-kwarcowego-poradnik">${etykieta}</a> — ceny z rozbiciem, ` +
  `wady, porównanie ze spiekiem i granitem.</p>`;

function przelinkuj() {
  let zmienione = 0;
  for (const [plik, etykieta] of ZAPLECZE) {
    const sciezka = path.join(ROOT, plik);
    if (!fs.existsSync(sciezka)) continue;
    const surowy = fs.readFileSync(sciezka);
    const crlf = surowy.includes('\r\n');
    let t = surowy.toString('utf8').replace(/\r\n/g, '\n');
    /*
     * ⚠ Warunek sprawdza LINK KONTEKSTOWY, nie sam adres.
     * Adres poradnika jest od 01.09.2026 w stopce KAŻDEJ strony, więc
     * `t.includes(adres)` było zawsze prawdziwe i linkowanie zaplecza
     * po cichu się nie wykonywało — generator kończył się „Gotowe"
     * i nikt by tego nie zauważył.
     */
    if (t.includes('cta-linia') && t.includes('blaty-z-konglomeratu-kwarcowego-poradnik">Po')) continue;

    const przed = t;
    t = t.replace(/(\n  <\/main>)/, `\n    ${LINK(etykieta)}$1`);
    if (t === przed) {
      console.warn(`  ! ${plik} — nie znalazłem miejsca na link`);
      continue;
    }
    if (!tylkoSprawdz) fs.writeFileSync(sciezka, crlf ? t.replace(/\n/g, '\r\n') : t, 'utf8');
    zmienione++;
    console.log(`  ${tylkoSprawdz ? '≠' : '✓'} ${plik} → link do poradnika`);
  }
  return zmienione;
}

/* ───────────────────────────────────────────────────────────── przebieg */

const nowa = zbuduj();
const stara = fs.existsSync(CEL) ? fs.readFileSync(CEL, 'utf8') : null;
const trzebaPisac = stara !== nowa;

console.log(
  `Poradnik o konglomeracie — ${WZORY.razem} wzorów z 5 cenników, ` +
    `blat od ${KWOTY.konglomeratProste} zł`
);

if (trzebaPisac && !tylkoSprawdz) {
  fs.writeFileSync(CEL, nowa, 'utf8');
  console.log('  ✓ blaty-z-konglomeratu-kwarcowego-poradnik.html');
} else if (trzebaPisac) {
  console.log('  ≠ blaty-z-konglomeratu-kwarcowego-poradnik.html — nieaktualny');
}

const przecelowane = przecelujKolekcje();
const linkow = przelinkuj();

if (!trzebaPisac && !linkow && !przecelowane) {
  console.log('\n✓ Poradnik aktualny — nic do zmiany.');
  process.exit(0);
}
if (tylkoSprawdz) {
  console.error('\n✗ Poradnik wymaga odświeżenia — uruchom `npm run konglomeraty`.');
  process.exit(1);
}
console.log('\nGotowe.');

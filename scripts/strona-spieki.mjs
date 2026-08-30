/**
 * PORADNIK O SPIEKACH — generator strony.
 *
 *   npm run spieki
 *   npm run spieki -- --sprawdz     (nic nie zapisuje, mówi czy jest aktualna)
 *
 * Zlecenie Dawida (30.08.2026): wejść do top10 na frazy spiekowe, które robią
 * ~300 wyświetleń na trzy tygodnie i ZERO kliknięć. Analiza przed napisaniem:
 * `docs/analiza-spieki.md`.
 *
 * DLACZEGO GENERATOR, A NIE RĘCZNY HTML:
 * poradnik żyje z konkretnych kwot i liczby wzorów. Wpisane ręcznie zaczęłyby
 * kłamać przy pierwszej zmianie cennika i nikt by tego nie zauważył, bo to
 * zwykły tekst na stronie. Tu wszystko wchodzi z JEDNEGO ŹRÓDŁA:
 *
 *   • kwoty  ← scripts/lib/ceny-tresc.json (to samo, co reszta serwisu)
 *   • wzory  ← src/generated/<marka>.dekory.json (policzone, nie przepisane)
 *
 * Ramę strony (head, zgody, nagłówek, stopka, skrypty) bierzemy ZE WZORCA —
 * jak przy stronach miast i wyprzedaży — żeby nie rozjechała się z resztą
 * serwisu przy pierwszej zmianie w stopce.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tresc, schema, zl } from './lib/tresc-spieki.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tylkoSprawdz = process.argv.includes('--sprawdz');

const WZORZEC = path.join(ROOT, 'blaty-lazienkowe.html');
const CEL = path.join(ROOT, 'blaty-ze-spieku-kwarcowego-poradnik.html');
const ADRES = 'https://kam24h.pl/blaty-ze-spieku-kwarcowego-poradnik';

/* ─────────────────────────────────────────────────── dane z jednego źródła */

const KWOTY = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'scripts', 'lib', 'ceny-tresc.json'), 'utf8')
).kwoty;

/** Ile dekorów ma marka — liczone z wygenerowanego cennika, nie wpisane. */
function ile(marka) {
  const plik = path.join(ROOT, 'src', 'generated', `${marka}.dekory.json`);
  if (!fs.existsSync(plik)) return 0;
  return Object.keys(JSON.parse(fs.readFileSync(plik, 'utf8')).dekory || {}).length;
}

/*
 * Wszystkie PIĘĆ marek spiekowych z cennika.
 *
 * ⚠ To celowo szersza lista niż `SPIEKI_NA_STRONIE` w ceny-tresc.mjs, która
 * zna tylko Keralini i Marazzi. Poradnik wymienia wszystkie pięć marek z nazwy,
 * więc musi też podawać ich prawdziwą sumę — inaczej lista pod tekstem nie
 * zgadzałaby się z liczbą nad nią.
 */
const WZORY = {
  atlas: ile('atlas-plan'),
  marazzi: ile('marazzi'),
  laminam: ile('laminam'),
  florim: ile('florim-stone'),
  keralini: ile('keralini'),
};
WZORY.razem = Object.values(WZORY).reduce((a, b) => a + b, 0);

/* ────────────────────────────────────────────────────────── head i teksty */

const TYTUL = 'Blaty ze spieku kwarcowego — poradnik, ceny i wady';

// Do 160 znakow — dluzszy Google i tak utnie w wynikach.
const OPIS =
  `Blat ze spieku kwarcowego od ${zl(KWOTY.spiekProste)} zł (60 × 300 cm). Rozbicie ceny, ` +
  'uczciwe wady, porównanie z granitem i konglomeratem. Poradnik kamieniarza.';

/* ───────────────────────────────────────────────────────────── budowanie */

function zbuduj() {
  // Repo ma pomieszane CRLF i LF — wzorce po znaku nowej linii by w nie nie trafiły.
  let t = fs.readFileSync(WZORZEC, 'utf8').replace(/\r\n/g, '\n');

  const podmiany = [
    ['<title>Blaty łazienkowe z kamienia — który materiał wybrać</title>', `<title>${TYTUL}</title>`],
    ['blaty-lazienkowe', 'blaty-ze-spieku-kwarcowego-poradnik'],
    [
      '<meta property="og:title" content="Blaty łazienkowe z kamienia — co się sprawdza" />',
      '<meta property="og:title" content="Blaty ze spieku kwarcowego — poradnik i ceny" />',
    ],
    [
      '<h1>Blaty<br><em>łazienkowe.</em></h1>',
      '<h1>Blaty ze spieku<br><em>kwarcowego.</em></h1>',
    ],
    /*
     * Stopka: wzorzec niesie „tu jesteś" przy SOBIE. Bez odwrócenia klient
     * miałby na poradniku wyszarzone, nieklikalne „Blaty łazienkowe" —
     * dokładnie ten błąd wyszedł 30.08 na stronie wyprzedaży.
     */
    ['<span class="foot-tu">Blaty łazienkowe</span>',
     '<a href="/blaty-lazienkowe">Blaty łazienkowe</a>'],
    // ...i odwrotnie: na WŁASNEJ stronie nie linkujemy sami do siebie.
    ['<a href="/blaty-ze-spieku-kwarcowego-poradnik">Poradnik: spieki</a>',
     '<span class="foot-tu">Poradnik: spieki</span>'],
  ];

  for (const [z, na] of podmiany) {
    if (!t.includes(z)) throw new Error(`Wzorzec nie zawiera fragmentu: ${z.slice(0, 60)}`);
    t = t.split(z).join(na);
  }

  t = t.replace(/(name="description" content=")[^"]*(")/, `$1${OPIS}$2`);
  t = t.replace(/(property="og:description" content=")[^"]*(")/, `$1${OPIS}$2`);
  t = t.replace(
    /<p class="sub">[\s\S]*?<\/p>/,
    '<p class="sub">Ile naprawdę kosztuje, z czego składa się cena, jakie ma wady i kiedy ' +
      'wygrywa z granitem — z warsztatu, w którym te płyty tniemy od 2014 roku.</p>'
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

/* ──────────────────────────────── linkowanie ZE stron spiekowych DO poradnika */

/**
 * Kanibalizacja była główną przyczyną zera kliknięć: trzy cienkie strony
 * o spiekach rozcieńczały sygnał. Poradnik jest teraz filarem, a tamte
 * linkują DO NIEGO — sygnały spływają w jedno miejsce.
 */
const ZAPLECZE = [
  ['blaty-ze-spieku.html', 'Pełny poradnik o spiekach'],
  ['baza-wiedzy/spiek-kwarcowy.html', 'Poradnik: blaty ze spieku kwarcowego'],
  ['baza-wiedzy/spiek-kwarcowy-wady-i-zalety.html', 'Poradnik: blaty ze spieku kwarcowego'],
];

const LINK = (etykieta) =>
  `<p class="cta-linia">Szukasz pełnej odpowiedzi? ` +
  `<a href="/blaty-ze-spieku-kwarcowego-poradnik">${etykieta}</a> — ceny z rozbiciem, ` +
  `porównanie z granitem i konglomeratem, wady i FAQ.</p>`;

function przelinkuj() {
  let zmienione = 0;
  for (const [plik, etykieta] of ZAPLECZE) {
    const sciezka = path.join(ROOT, plik);
    if (!fs.existsSync(sciezka)) continue;
    const surowy = fs.readFileSync(sciezka);
    const crlf = surowy.includes('\r\n');
    let t = surowy.toString('utf8').replace(/\r\n/g, '\n');
    if (t.includes('/blaty-ze-spieku-kwarcowego-poradnik')) continue;

    // Wstawiamy tuż przed zamknięciem treści — po tym, co strona ma do powiedzenia.
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

console.log(`Poradnik o spiekach — ${WZORY.razem} wzorów z 5 cenników, blat od ${KWOTY.spiekProste} zł`);

if (trzebaPisac && !tylkoSprawdz) {
  fs.writeFileSync(CEL, nowa, 'utf8');
  console.log('  ✓ blaty-ze-spieku-kwarcowego-poradnik.html');
} else if (trzebaPisac) {
  console.log('  ≠ blaty-ze-spieku-kwarcowego-poradnik.html — nieaktualny');
}

const linkow = przelinkuj();

if (!trzebaPisac && !linkow) {
  console.log('\n✓ Poradnik aktualny — nic do zmiany.');
  process.exit(0);
}
if (tylkoSprawdz) {
  console.error('\n✗ Poradnik wymaga odświeżenia — uruchom `npm run spieki`.');
  process.exit(1);
}
console.log('\nGotowe.');

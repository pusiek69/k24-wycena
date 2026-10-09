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
 *   • wzory  ← rejestr firm z silnika (policzone, nie przepisane) — tak samo
 *              jak liczy je ceny-tresc.mjs, patrz `ile()` niżej
 *
 * Ramę strony (head, zgody, nagłówek, stopka, skrypty) bierzemy ZE WZORCA —
 * jak przy stronach miast i wyprzedaży — żeby nie rozjechała się z resztą
 * serwisu przy pierwszej zmianie w stopce.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tresc, schema, zl } from './lib/tresc-spieki.mjs';
import { wczytajSilnik } from './lib/silnik.mjs';
import { zOdmiana } from './lib/odmiana.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tylkoSprawdz = process.argv.includes('--sprawdz');

const WZORZEC = path.join(ROOT, 'blaty-lazienkowe.html');
const CEL = path.join(ROOT, 'blaty-ze-spieku-kwarcowego-poradnik.html');
const ADRES = 'https://kam24h.pl/blaty-ze-spieku-kwarcowego-poradnik';

/* ─────────────────────────────────────────────────── dane z jednego źródła */

const KWOTY = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'scripts', 'lib', 'ceny-tresc.json'), 'utf8')
).kwoty;

/**
 * Ile dekorów ma marka.
 *
 * ⚠ Liczymy z REJESTRU FIRM (`silnik.mjs`), a nie z pliku `*.dekory.json`.
 * Różnica jest realna: `_promocje.js` dokłada do firmy wzory dostępne tylko
 * na czas kampanii dostawcy — Laminam ma dziś 87 wzorów stałych i 110 razem
 * z letnią kampanią. Klient w kalkulatorze może wybrać 110, więc taką liczbę
 * ma widzieć na stronie.
 *
 * Tak samo liczy `ceny-tresc.mjs` dla wszystkich pozostałych marek. Zanim to
 * ujednolicono (30.08.2026), oba generatory podawały inne liczby i nadpisywały
 * sobie nawzajem te same strony.
 */
const FIRMY = (await wczytajSilnik()).FIRMY;

function ile(marka) {
  const f = FIRMY.find((x) => x.slug === marka);
  return f ? Object.keys(f.dekory || {}).length : 0;
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

/*
 * DE-KANIBALIZACJA „blaty ze spieku kwarcowego" (K1 z planu 3.10.2026).
 *
 * Fraza robiła 97 wyświetleń i zero kliknięć z pozycji 27,6, bo walczyły
 * o nią dwie nasze strony: oferta /blaty-ze-spieku (914 wyświetleń,
 * 7 kliknięć) i ten poradnik. Frazę główną przejmuje oferta — poradnik
 * schodzi na to, czego naprawdę dotyczy: „spiek kwarcowy wady/zalety".
 * H1 zostaje bez zmian, bo dalej odpowiada na pytanie o ceny.
 *
 * Falsyfikacja (ok. 25.10): jeśli fraza główna spadnie poniżej poz. 30
 * i oferta NIE urosnąła — wraca stary tytuł, jednym revertem.
 */
const TYTUL = 'Spiek kwarcowy na blat kuchenny — wady, zalety, ceny';

// Do 160 znakow — dluzszy Google i tak utnie w wynikach.
const OPIS =
  `Spiek kwarcowy na blat: uczciwe wady i zalety, rozbicie ceny od ${zl(KWOTY.spiekProste)} zł (60 × 300 cm), ` +
  'porównanie z granitem i konglomeratem.';

/* ───────────────────────────────────────────────────────────── budowanie */

function zbuduj() {
  // Repo ma pomieszane CRLF i LF — wzorce po znaku nowej linii by w nie nie trafiły.
  let t = fs.readFileSync(WZORZEC, 'utf8').replace(/\r\n/g, '\n');

  const podmiany = [
    ['<title>Blaty łazienkowe z kamienia — który materiał wybrać</title>', `<title>${TYTUL}</title>`],
    ['blaty-lazienkowe', 'blaty-ze-spieku-kwarcowego-poradnik'],
    [
      '<meta property="og:title" content="Blaty łazienkowe z kamienia — co się sprawdza" />',
      '<meta property="og:title" content="Spiek kwarcowy na blat — poradnik kamieniarza" />',
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

/*
 * LICZBY WZORÓW NA STRONIE OFERTOWEJ `/blaty-ze-spieku`
 *
 * Poradnik liczy dekory z rejestru firm przy każdym przebiegu, ale strona
 * ofertowa miała je wpisane na sztywno — i 30.09.2026, gdy wygasły cztery
 * kampanie dostawców naraz, została z „504 wzory" i „Laminam — 110 dekorów",
 * choć w kalkulatorze było już 502 i 108. Dekory wyłącznie promocyjne znikają
 * z cennika razem z kampanią (`dekoryZKampaniami`), więc te liczby zmieniają
 * się same z siebie, bez żadnego commita — muszą być liczone, nie przepisane.
 */
const OFERTA = path.join(ROOT, 'blaty-ze-spieku.html');
const MARKI_NA_OFERCIE = {
  'Atlas Plan': WZORY.atlas,
  Marazzi: WZORY.marazzi,
  Laminam: WZORY.laminam,
  'Florim Stone': WZORY.florim,
  Keralini: WZORY.keralini,
};

function odswiezLiczbyNaOfercie() {
  if (!fs.existsSync(OFERTA)) return 0;
  const surowy = fs.readFileSync(OFERTA);
  const crlf = surowy.includes('\r\n');
  const przed = surowy.toString('utf8').replace(/\r\n/g, '\n');
  let t = przed;

  for (const [marka, n] of Object.entries(MARKI_NA_OFERCIE)) {
    t = t.replace(
      // W szablonie `...` pojedyncze \d stałoby się zwykłym „d” — stąd \\d.
      new RegExp(`(<strong>${marka}</strong> — )\\d+ dekor[a-ząćęłńóśźż]*`, 'g'),
      `$1${zOdmiana(n, 'dekor')}`
    );
  }
  // Suma — w opisie dla Google, w danych strukturalnych i w zdaniu nad listą.
  // Liczba wzorów w opisie dla Google. Kotwicą jest kwota PRZED nią, nie zdanie
  // PO niej: CTA w opisie zmieniało się już dwa razy („Kalkulator wyceny online",
  // „Wycena online w 2 minuty") i za każdym razem zabierało ze sobą tę podmianę.
  t = t.replace(
    new RegExp('(z\\u0142\\. )\\d+ wzor[a-ząćęłńóśźż]*\\.', 'g'),
    `$1${zOdmiana(WZORY.razem, 'wzor')}.`
  );
  t = t.replace(/\d+ dekor[a-ząćęłńóśźż]* w pięciu kolekcjach/g, `${zOdmiana(WZORY.razem, 'dekor')} w pięciu kolekcjach`);

  if (t === przed) return 0;
  if (!tylkoSprawdz)
    fs.writeFileSync(OFERTA, crlf ? t.replace(/\n/g, '\r\n') : t, 'utf8');
  console.log(`  ${tylkoSprawdz ? '≠' : '✓'} blaty-ze-spieku.html → liczby wzorów z cenników`);
  return 1;
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

const linkow = przelinkuj() + odswiezLiczbyNaOfercie();

if (!trzebaPisac && !linkow) {
  console.log('\n✓ Poradnik aktualny — nic do zmiany.');
  process.exit(0);
}
if (tylkoSprawdz) {
  console.error('\n✗ Poradnik wymaga odświeżenia — uruchom `npm run spieki`.');
  process.exit(1);
}
console.log('\nGotowe.');

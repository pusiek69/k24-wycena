/**
 * STRONY MIAST — nowe strony i sekcje FAQ.
 *
 *   npm run miasta
 *   npm run miasta -- --sprawdz     (nic nie zapisuje, mówi co jest nieaktualne)
 *
 * Zlecenie Dawida (25.08.2026): pięć nowych miast + realne FAQ na wszystkich
 * stronach miast.
 *
 * Skrypt robi trzy rzeczy:
 *   1. tworzy brakujące strony miast z istniejącego wzorca (Opatów),
 *   2. wstawia/odświeża sekcję FAQ + FAQPage na KAŻDEJ stronie miasta,
 *   3. dopisuje nowe miasta do listy „Gdzie dojeżdżamy" w stopce
 *      wszystkich stron serwisu.
 *
 * Wzorcem jest prawdziwa, działająca strona, a nie osobny szablon — dzięki
 * temu nowe miasta dziedziczą wszystko, co dopracowaliśmy na istniejących
 * (dane strukturalne, okruszki, CTA, stopka) i nie rozjeżdżają się z nimi.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MIASTA, NOWE } from './lib/miasta.mjs';
import { pytaniaMiasta, sekcjaHtml, schemaFaq } from './lib/faq-miasta.mjs';
import { grafMiasta } from './lib/schema-miasta.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tylkoSprawdz = process.argv.includes('--sprawdz');

const WZORZEC = 'blaty-kuchenne-opatow.html';
const WZ = MIASTA.find((m) => m.slug === 'opatow');

const pamiec = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'lib', 'ceny-tresc.json'), 'utf8'));
const KWOTY = pamiec.kwoty;
const WZOROW = pamiec.liczby?.wszystkieWzory ?? 700;

/** ['A','B','C'] → „A, B i C" — polska lista, nie ciąg przecinków. */
const wyliczenie = (lista) =>
  lista.length < 2 ? lista.join('') : `${lista.slice(0, -1).join(', ')} i ${lista.at(-1)}`;

const plikMiasta = (slug) => path.join(ROOT, `blaty-kuchenne-${slug}.html`);
const wszystkieStrony = () =>
  fs
    .readdirSync(ROOT)
    .filter((f) => f.endsWith('.html') && f !== 'podglad.html')
    .map((f) => path.join(ROOT, f))
    .concat(
      fs
        .readdirSync(path.join(ROOT, 'baza-wiedzy'))
        .filter((f) => f.endsWith('.html'))
        .map((f) => path.join(ROOT, 'baza-wiedzy', f))
    );

let zmian = 0;
const zapisz = (plik, tresc, opis) => {
  const przed = fs.existsSync(plik) ? fs.readFileSync(plik, 'utf8') : null;
  if (przed === tresc) return false;
  zmian++;
  if (!tylkoSprawdz) fs.writeFileSync(plik, tresc, 'utf8');
  console.log(`  ${tylkoSprawdz ? '≠' : '✓'} ${opis}`);
  return true;
};

/* ─────────────────────────────────────────── 1. nowe strony miast */

/**
 * Strona miasta DALEKIEGO nie może obiecywać bezpłatnego pomiaru.
 *
 * Akapit o dojeździe mówi wprost: „to dalej niż promień, w którym pomiar
 * wykonujemy bezpłatnie bez żadnych warunków". Wzorzec (Opatów) jest miastem
 * bliskim, więc w CTA i w stopce niesie zdania o darmowym pomiarze — na
 * stronie Krakowa czy Lublina te same zdania przeczyłyby akapitowi obok
 * i byłyby obietnicą, której Dawid nie składa.
 *
 * Podmiany są IDEMPOTENTNE i leżą poza `nowaStrona`, żeby działały też na
 * stronach, które już istnieją (Lublin powstał przed tą regułą i miał CTA
 * z darmowym pomiarem). Test: scripts/test-miasta.mjs.
 */
const DLA_DALEKICH = [
  ['<span>Wycena orientacyjna w dwie minuty, pomiar u Państwa bezpłatny.</span>',
   '<span>Wycena orientacyjna w dwie minuty — warunki dojazdu ustalamy przy zamówieniu.</span>'],
  ['<span>Zadzwoń — doradzimy materiał i umówimy bezpłatny pomiar.</span>',
   '<span>Zadzwoń — doradzimy materiał i ustalimy warunki dojazdu.</span>'],
  ['Ostateczna cena po bezpłatnym pomiarze.', 'Ostateczna cena po pomiarze u Państwa.'],
];

function dlaDalekich(t, m) {
  if (!m.daleko) return t;
  for (const [z, na] of DLA_DALEKICH) t = t.split(z).join(na);
  return t;
}

/**
 * Wzorzec → strona nowego miasta.
 *
 * Podmieniamy WYŁĄCZNIE miejsca specyficzne dla miasta, wypisane niżej
 * z nazwy. Globalne „zamień Opatów na X" zepsułoby wspólną listę miast
 * w danych strukturalnych i link do Opatowa w stopce — a te mają zostać.
 */
function nowaStrona(m) {
  // Ujednolicamy końce linii. Repo ma pomieszane CRLF i LF po latach edycji,
  // a wzorce dopasowywane po znaku nowej linii po prostu by w nie nie trafiły.
  const wzor = fs.readFileSync(path.join(ROOT, WZORZEC), 'utf8').replace(/\r\n/g, '\n');
  const czas = m.czas || `około ${Math.round(m.km / 60 * 60)} minut drogi`;

  // Miasto może mieć własny opis pod konkretne frazy (Kraków) — wtedy
  // wygrywa nad wzorcem. Reszta miast zostaje przy zdaniu z generatora.
  const opisDojazdu = m.opis
    ? m.opis
    : m.daleko
    ? `Blaty kamienne w ${m.wMiescie} — około ${m.km} km od naszego zakładu w Tarnobrzegu. ` +
      'Realizujemy pomiar i montaż, warunki dojazdu ustalamy indywidualnie.'
    : `Blaty kamienne w ${m.wMiescie} i okolicy — około ${m.km} km od zakładu w Tarnobrzegu. ` +
      'Bezpłatny pomiar Prolinerem, montaż u klienta.';

  const akapitDojazdu = m.daleko
    ? `Z Tarnobrzega do ${m.doMiasta} jest około <strong>${m.km} km, czyli ${czas}</strong>. ` +
      'To dalej niż promień, w którym pomiar wykonujemy bezpłatnie bez żadnych warunków — ' +
      'ale dojeżdżamy: montaże realizujemy w całej Polsce, a warunki dojazdu ustalamy przy ' +
      'zamówieniu, najczęściej łącząc wyjazd z innym montażem w tamtym rejonie.'
    : `Z Tarnobrzega do ${m.doMiasta} jest około <strong>${m.km} km, czyli ${czas}</strong>. ` +
      'Obsługujemy nie tylko samo miasto, ale też mniejsze miejscowości w gminie i w okolicy — ' +
      'przy tej odległości nie robi nam to różnicy, a klientom często oszczędza szukania ' +
      'wykonawcy w większym mieście.';

  /*
   * „I OKOLICE" — jedna mocna strona zamiast kilku cienkich.
   *
   * Osobne podstrony dla Wieliczki, Skawiny czy Niepołomic miałyby tę samą
   * treść z podmienioną nazwą; Google traktuje takie zestawy jako treść
   * powieloną i nie pozycjonuje żadnej z nich. Nazwy wchodzą więc w treść
   * TEJ strony (i w `areaServed` — patrz lib/schema-miasta.mjs).
   */
  const akapitOkolic = (m.okolice || []).length
    ? `
      <p>
        Jeździmy nie tylko do samego miasta. Blaty wozimy i montujemy również ` +
      `w okolicy: ${wyliczenie(m.okolice)} — dla nas to ten sam wyjazd, a klientom ` +
      `spoza centrum oszczędza szukania wykonawcy na miejscu.
      </p>`
    : '';

  const podmiany = [
    // ── head ──────────────────────────────────────────────────────────
    [`<title>Blaty kuchenne ${WZ.nazwa} — kamień na wymiar</title>`,
     `<title>${m.tytul || `Blaty kuchenne ${m.nazwa} — kamień na wymiar`}</title>`],
    [`content="Blaty kuchenne — ${WZ.nazwa}"`, `content="Blaty kuchenne — ${m.nazwa}"`],
    [`blaty-kuchenne-${WZ.slug}`, `blaty-kuchenne-${m.slug}`],
    /*
     * Nazw miasta w danych strukturalnych tu NIE podmieniamy — `@graph`
     * jest od 27.08.2026 GENEROWANY (lib/schema-miasta.mjs) i wchodzi na
     * stronę dopiero w kroku 2, więc wzorzec go już nie niesie.
     */
    [`<h1>Blaty kuchenne<br><em>${WZ.nazwa}.</em></h1>`,
     `<h1>Blaty kuchenne<br><em>${m.nazwa}.</em></h1>`],
    // Okruszek: sam <span> z nazwą, bez linku — to bieżąca strona.
    [`<span>${WZ.nazwa}</span>\n    </nav>`, `<span>${m.nazwa}</span>\n    </nav>`],
    [`<h2>${WZ.nazwa} i okoliczne miejscowości</h2>`, `<h2>${m.nazwa} i okoliczne miejscowości</h2>`],
    [`<strong>Blat w ${WZ.wMiescie}? Policz cenę albo zadzwoń</strong>`,
     `<strong>Blat w ${m.wMiescie}? Policz cenę albo zadzwoń</strong>`],
    [`miejscowości wokół ${WZ.doMiasta}.`, `miejscowości wokół ${m.doMiasta}.`],
    // ── stopka: wzorzec ma siebie jako „tu jesteś", nowe miasto nie ──
    [`<span class="foot-tu">${WZ.nazwa}</span>`,
     `<a href="/blaty-kuchenne-${WZ.slug}">${WZ.nazwa}</a>`],
  ];

  let t = wzor;
  for (const [z, na] of podmiany) {
    if (!t.includes(z)) throw new Error(`Wzorzec nie zawiera fragmentu: ${z.slice(0, 70)}`);
    t = t.split(z).join(na);
  }

  // Opisy i akapity, które wymagają pełnego zdania, a nie podmiany słowa.
  t = t.replace(/(name="description" content=")[^"]*(")/, `$1${opisDojazdu}$2`);
  t = t.replace(/(property="og:description" content=")[^"]*(")/, `$1${opisDojazdu}$2`);
  t = t.replace(/<p class="sub">[\s\S]*?<\/p>/, `<p class="sub">${m.krotki}</p>`);
  t = t.replace(
    /(<h2>[^<]*i okoliczne miejscowości<\/h2>\s*<p>)[\s\S]*?(<\/p>)/,
    `$1\n        ${akapitDojazdu}\n      $2${akapitOkolic}`
  );

  return dlaDalekich(t, m);
}

console.log('Nowe strony miast:');
for (const m of NOWE) {
  const plik = plikMiasta(m.slug);
  if (fs.existsSync(plik)) {
    console.log(`  = ${m.nazwa} — strona już jest`);
    continue;
  }
  zapisz(plik, nowaStrona(m), `${m.nazwa} → blaty-kuchenne-${m.slug}.html`);
}

/* ────────────────────────────────────────── 2. FAQ na stronach miast */

const ZNACZNIK_OD = '      <!-- FAQ:MIASTO — generowane przez `npm run miasta`. Nie edytuj ręcznie. -->';
const ZNACZNIK_DO = '      <!-- /FAQ:MIASTO -->';

console.log('\nFAQ na stronach miast:');
MIASTA.forEach((m, i) => {
  const plik = plikMiasta(m.slug);
  if (!fs.existsSync(plik)) return;

  const pytania = pytaniaMiasta(m, KWOTY, WZOROW, i);
  const blok = `${ZNACZNIK_OD}\n${sekcjaHtml(pytania, m)}\n${ZNACZNIK_DO}`;
  const schema = schemaFaq(pytania);
  // Graf firmy/usługi/okruszków — generowany, nie kopiowany ze wzorca,
  // żeby wszystkie miasta miały go identycznego i zawsze aktualnego.
  const opisMiasta =
    m.opis ||
    (m.daleko
      ? `Blaty kamienne w ${m.wMiescie} — około ${m.km} km od naszego zakładu w Tarnobrzegu. ` +
        'Realizujemy pomiar i montaż, warunki dojazdu ustalamy indywidualnie.'
      : `Blaty kamienne w ${m.wMiescie} i okolicy — około ${m.km} km od zakładu w Tarnobrzegu. ` +
        'Bezpłatny pomiar Prolinerem, montaż u klienta.');
  const graf = grafMiasta(m, MIASTA, KWOTY, opisMiasta);

  let t = fs.readFileSync(plik, 'utf8').replace(/\r\n/g, '\n');

  // Sekcja w treści — przed zamknięciem <main>.
  const re = new RegExp(`${ZNACZNIK_OD.trim()}[\\s\\S]*?${ZNACZNIK_DO.trim()}`);
  t = re.test(t) ? t.replace(re, blok.trim()) : t.replace(/(\s*)<\/main>/, `\n${blok}\n$1</main>`);

  /*
   * DANE STRUKTURALNE — dwa OSOBNE bloki, każdy podmieniany własnym,
   * zakotwiczonym wzorcem.
   *
   * ⚠ TU BYŁ BŁĄD (25–27.08.2026). Poprzedni wzorzec brzmiał:
   *     /<script …>\s*\{\s*"@context"[^]*?"@type": "FAQPage"[^]*?<\/script>/
   * `[^]*?` przeskakiwało z początku PIERWSZEGO bloku (grafu firmy) aż do
   * FAQPage w DRUGIM, więc podmiana zjadała oba i zostawiała samo FAQ.
   * Wszystkie 14 stron miast straciło dane o firmie, usłudze, cenie
   * i okruszkach — z zewnątrz niewidoczne, bo strony wyglądały tak samo.
   *
   * Zasada na przyszłość: wzorzec podmieniający blok JSON-LD musi
   * rozpoznawać JEGO WŁASNY typ tuż po `"@context"`, nigdy „cokolwiek aż
   * do typu, którego szukam".
   */
  const reGraf = /  <script type="application\/ld\+json">\s*\{\s*"@context"[^]*?"@graph"[^]*?\n  <\/script>/;
  const reFaq = /  <script type="application\/ld\+json">\s*\{\s*"@context": "https:\/\/schema\.org",\s*"@type": "FAQPage"[^]*?<\/script>/;

  t = reGraf.test(t) ? t.replace(reGraf, graf) : t.replace(/(\s*)<\/head>/, `\n${graf}\n$1</head>`);
  t = reFaq.test(t) ? t.replace(reFaq, schema) : t.replace(/(\s*)<\/head>/, `\n${schema}\n$1</head>`);

  t = dlaDalekich(t, m);

  zapisz(plik, t, `${m.nazwa} — ${pytania.length} pytań`);
});

/* ──────────────────────────── 3. nowe miasta w stopce całego serwisu */

console.log('\nLinkowanie w stopce:');
let stopek = 0;
for (const plik of wszystkieStrony()) {
  let t = fs.readFileSync(plik, 'utf8').replace(/\r\n/g, '\n');
  const przed = t;

  for (const m of NOWE) {
    const link = `<a href="/blaty-kuchenne-${m.slug}">${m.nazwa}</a>`;
    const tu = `<span class="foot-tu">${m.nazwa}</span>`;
    if (t.includes(link) || t.includes(tu)) continue;

    // Dokładamy na koniec kolumny „Gdzie dojeżdżamy”.
    t = t.replace(
      /(<a href="\/blaty-kuchenne-opatow">Opatów<\/a>|<span class="foot-tu">Opatów<\/span>)/,
      `$1\n              ${path.basename(plik) === `blaty-kuchenne-${m.slug}.html` ? tu : link}`
    );
  }

  if (t !== przed) {
    stopek++;
    if (!tylkoSprawdz) fs.writeFileSync(plik, t, 'utf8');
  }
}
console.log(`  ${tylkoSprawdz ? '≠' : '✓'} ${stopek} stron z uzupełnioną listą miast`);

/* ───────────────────────────────────────────────────────────── koniec */

if (!zmian && !stopek) {
  console.log('\n✓ Strony miast aktualne — nic do zmiany.');
  process.exit(0);
}
if (tylkoSprawdz) {
  console.error('\n✗ Strony miast wymagają odświeżenia — uruchom `npm run miasta`.');
  process.exit(1);
}
console.log(`\nGotowe: ${zmian} stron miast, ${stopek} stron z linkami.`);

/**
 * STRONA UMYWALKI — to, co musi być prawdą, zanim Dawid powie „publikuj".
 *
 *   node --test scripts/test-umywalka-strona.mjs
 *
 * Strona jest UKRYTA: ma `noindex`, nie ma jej w sitemapie i nie prowadzi
 * do niej żaden link. Dopóki tak jest, Google jej nie pokaże, a Dawid może
 * ją spokojnie oglądać na telefonie.
 *
 * Druga rzecz: mechaniczna kontrola wyglądu. Z przeglądu forów o interfejsach
 * generowanych przez AI wyszło, że sama intencja („nie róbmy tak") nie
 * działa — działa lista i sprawdzenie. Stąd punkt o zakazanych wzorcach.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const czytaj = (s) => fs.readFileSync(new URL('../' + s, import.meta.url), 'utf8');
const HTML = czytaj('umywalka-na-wymiar.html');
const CSS = czytaj('src/umywalka/umywalka.css');
const MAIN = czytaj('src/umywalka/main.js');

/* ═══════════════════════════════════════════ ukrycie */

test('strona ma noindex, nofollow', () => {
  assert.match(HTML, /<meta name="robots" content="noindex, nofollow"/);
});

test('nie ma jej w sitemapie', () => {
  const sitemap = czytaj('public/sitemap.xml');
  assert.ok(!sitemap.includes('umywalka-na-wymiar'), 'ukryta strona trafiła do sitemapy');
});

test('nie prowadzi do niej żaden link ze stron publicznych', () => {
  const strony = fs.readdirSync(new URL('../', import.meta.url)).filter((f) => f.endsWith('.html'));
  for (const plik of strony) {
    if (plik === 'umywalka-na-wymiar.html') continue;
    assert.ok(
      !czytaj(plik).includes('umywalka-na-wymiar'),
      `${plik} linkuje do ukrytej strony — to ją publikuje`
    );
  }
});

test('jest w konfiguracji budowania (inaczej nie da się jej obejrzeć)', () => {
  assert.match(czytaj('vite.config.js'), /umywalka_na_wymiar: resolve/);
});

/* ═══════════════════════════════════════════ adres firmy */

test('jedyny adres na stronie to Szpitalna 8', () => {
  assert.match(HTML, /ul\. Szpitalna 8, 39-400 Tarnobrzeg/);
  // Drugiego adresu nie wymieniamy nawet jako wzorca — repozytorium jest
  // publiczne, więc sam wzorzec w teście by go ujawnił. Sprawdzamy
  // liczbę wystąpień słowa „ul." zamiast szukać konkretnej ulicy.
  const adresy = (HTML.match(/ul\.\s/g) || []).length;
  assert.equal(adresy, 1, 'na stronie jest więcej niż jeden adres');
});

/* ═══════════════════════════════════════════ ceny */

test('w kodzie strony nie ma ani jednej zaszytej kwoty materiału', () => {
  for (const plik of fs.readdirSync(new URL('../src/umywalka/', import.meta.url))) {
    if (!plik.endsWith('.js')) continue;
    const zrodlo = czytaj('src/umywalka/' + plik);
    for (const slowo of ['rabat', 'marż', 'narzut', 'zakupow', 'koszt własny', 'hurt']) {
      assert.ok(
        !zrodlo.toLowerCase().includes(slowo.toLowerCase()),
        `${plik} zawiera „${slowo}" — to nie może trafić na stronę publiczną`
      );
    }
  }
});

test('ceny biorą się z silnika i panelu, nie z kodu strony', () => {
  const wycena = czytaj('src/umywalka/wycena-umywalki.js');
  assert.match(wycena, /import \{ wycen \} from '\.\.\/engine\/wycena\.js'/);
  assert.match(wycena, /DOMYSLNE/);
  // Lista polecanych kamieni nie może nieść cen — te są w katalogu.
  const dekory = czytaj('src/umywalka/dekory-polecane.js');
  assert.ok(!/cena|zl\/m2|zł\/m²/i.test(dekory), 'lista kamieni nie może zawierać cen');
});

/* ═══════════════════════════════════════════ wygląd */

test('paleta jest z tokenów strony — zero nowych kolorów markowych', () => {
  // Pomarańcz z artefaktu Dawida i „fiolet AI" nie mają tu wstępu.
  for (const zakazany of ['#ff6', '#f60', '#f97316', '#fb923c', '#7c3aed', '#8b5cf6', '#6366f1']) {
    assert.ok(!CSS.toLowerCase().includes(zakazany), `zakazany kolor ${zakazany}`);
  }
  for (const token of ['--vein', '--slab', '--stone', '--cream', '--serif-ozdobny']) {
    assert.ok(CSS.includes(token), `brak tokenu ${token} — styl odkleił się od strony`);
  }
});

test('bez gradientów tęczowych, bez szkła, bez emoji w interfejsie', () => {
  assert.ok(!/backdrop-filter/.test(CSS), 'glassmorphism');
  assert.ok(!/linear-gradient\([^)]*(#7|#8b5|purple|violet)/i.test(CSS), 'gradient „AI"');
  // Emoji jako ikony — w UI używamy znaków typograficznych (✓, ☎),
  // a nie emotek. Sprawdzamy zakres emoji, nie pojedyncze znaki.
  assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(MAIN), 'emoji w interfejsie');
  assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(HTML), 'emoji w treści strony');
});

test('ruch jest wyłączany przy prefers-reduced-motion', () => {
  assert.match(CSS, /@media \(prefers-reduced-motion: no-preference\)/);
  assert.match(czytaj('src/umywalka/wynik.js'), /prefers-reduced-motion: reduce/);
});

test('cyfry w cenach są tabularne (nie skaczą przy przeliczaniu)', () => {
  assert.match(CSS, /\.cena-kwota[\s\S]*?font-variant-numeric: tabular-nums/);
});

test('nagłówki mają text-wrap: balance', () => {
  assert.match(CSS, /text-wrap: balance/);
});

/* ═══════════════════════════════════════════ dostępność */

test('bryła ma opis dla czytnika ekranu', () => {
  assert.match(czytaj('src/umywalka/bryla.js'), /role: 'img'/);
  assert.match(czytaj('src/umywalka/bryla.js'), /'aria-label'/);
});

test('znaczek i podpowiedź są ogłaszane przez czytnik (aria-live)', () => {
  assert.match(MAIN, /'aria-live': 'polite'/);
});

test('bryłę da się obrócić klawiaturą', () => {
  assert.match(czytaj('src/umywalka/bryla.js'), /ArrowLeft/);
  assert.match(MAIN, /tabindex: '0'/);
});

test('przyciski mają wysokość pod kciuk (44 px, główne 56)', () => {
  assert.match(CSS, /min-height: 44px/);
  assert.match(CSS, /min-height: 56px/);
});

/* ═══════════════════════════════════════════ AI */

test('faza 1 nie ma ŻADNEGO wywołania modelu z przeglądarki', () => {
  for (const plik of fs.readdirSync(new URL('../src/umywalka/', import.meta.url))) {
    if (!plik.endsWith('.js')) continue;
    const zrodlo = czytaj('src/umywalka/' + plik);
    assert.ok(!zrodlo.includes('anthropic'), `${plik}: ślad po API modelu`);
    assert.ok(!zrodlo.includes('ANTHROPIC'), `${plik}: ślad po kluczu`);
    assert.ok(!/api\.anthropic\.com/.test(zrodlo), `${plik}: wywołanie modelu`);
  }
});

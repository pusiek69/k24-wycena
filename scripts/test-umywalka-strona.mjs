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

test('akcent i krój są takie, jak chciał Dawid', () => {
  /*
   * Pomarańcz #ff4f00 i Geist to WYBÓR KLIENTA z jego projektu — nie
   * zmieniamy go, choćby trendy mówiły co innego. Test pilnuje, żeby
   * ktoś (także ja przy następnej iteracji) tego nie „poprawił".
   */
  assert.ok(CSS.includes('--acc: #ff4f00'), 'zniknął pomarańczowy akcent z projektu Dawida');
  assert.match(CSS, /font-family: Geist/);
});

test('fonty i biblioteka 3D są z naszego serwera, nie z CDN-a', () => {
  // Content-Security-Policy strony dopuszcza tylko własne zasoby —
  // zewnętrzny CDN byłby zablokowany, a i tak nie chcemy wysyłać
  // adresu klienta do obcego serwera.
  assert.ok(!HTML.includes('fonts.googleapis.com'), 'font z Google Fonts');
  assert.ok(!HTML.includes('cdnjs'), 'biblioteka z CDN-a');
  assert.match(CSS, /url\('\/fonty\/Geist-/);
  assert.match(czytaj('src/umywalka/scena3d.js'), /import\('three'\)/);
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
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(czytaj('src/umywalka/scena3d.js'), /prefers-reduced-motion: reduce/);
});

test('cyfry w cenach są tabularne (nie skaczą przy przeliczaniu)', () => {
  assert.match(CSS, /\.big\s*\{[\s\S]*?font-variant-numeric: tabular-nums/);
});

test('nagłówki mają text-wrap: balance', () => {
  assert.match(CSS, /text-wrap: balance/);
});

/* ═══════════════════════════════════════════ dostępność */

test('podgląd 3D ma opis i działa też bez WebGL', () => {
  assert.match(HTML, /aria-label="Podgląd 3D umywalki"/);
  assert.match(HTML, /Podgląd 3D jest niedostępny/);
  // Brak WebGL nie może zatrzymać wyceny — scena zwraca wtedy null.
  assert.match(czytaj('src/umywalka/scena3d.js'), /return null/);
});

test('znaczek i ostrzeżenia są ogłaszane przez czytnik (aria-live)', () => {
  assert.match(HTML, /id="polowka" aria-live="polite"/);
  assert.match(HTML, /id="warnTop" aria-live="polite"/);
});

test('podgląd oszczędza słabsze telefony', () => {
  const scena = czytaj('src/umywalka/scena3d.js');
  assert.match(scena, /slabySprzet/);
  assert.match(scena, /setPixelRatio/);
  // Nie renderujemy, gdy podglądu nie widać — telefon niepotrzebnie grzeje.
  assert.match(scena, /visibilitychange/);
});

test('przyciski mają wysokość pod kciuk (44 px, główna akcja 52)', () => {
  assert.match(CSS, /min-height: 44px/);
  assert.match(CSS, /\.btn\.acc \{[^}]*min-height: 52px/);
});

test('strona NIE pokazuje edytowalnych stawek warsztatu', () => {
  // W projekcie Dawida była sekcja „Twoje stawki" — to narzędzie warsztatowe,
  // nie treść dla klienta. Stawki przychodzą z panelu.
  assert.ok(!HTML.includes('Twoje stawki'), 'sekcja stawek została na stronie');
  assert.ok(!MAIN.includes('localStorage'), 'stawki nie mogą siedzieć w przeglądarce klienta');
  assert.match(MAIN, /pobierzUstawienia/);
});

test('bramka cenowa to jeden warunek do przestawienia', () => {
  assert.match(MAIN, /const CENA_PO_FORMULARZU = (true|false);/);
});

test('zapytanie wysyła się formularzem, nie kopiowaniem do schowka', () => {
  assert.ok(!HTML.includes('Kopiuj wycenę'), 'został przycisk kopiowania z wersji warsztatowej');
  assert.match(HTML, /Zapytanie o tę umywalkę/);
  assert.match(MAIN, /formularzUmywalki/);
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

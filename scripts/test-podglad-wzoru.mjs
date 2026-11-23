/**
 * PODGLĄD WZORU KAMIENIA — jeden komponent, dwa kalkulatory.
 *
 *   node --test scripts/test-podglad-wzoru.mjs
 *
 * Zgłoszenie Dawida (23.11.2026): „w miniaturkach nic nie widac" oraz
 * „dolacz tez te zdjecia do głównego kalkulatora". Stąd wspólny komponent:
 * ta sama biblioteka zdjęć i ten sam podgląd w kalkulatorze blatów
 * i w kalkulatorze umywalek.
 *
 * Najważniejsze, czego pilnują te testy: komponent siedzi WYŁĄCZNIE
 * w warstwie wyświetlania. Kalkulator blatów to główny lejek — wybór
 * dekoru musi działać dokładnie tak, jak działał.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const czytaj = (s) => fs.readFileSync(path.join(ROOT, s), 'utf8');

const KOMPONENT = czytaj('src/app/podglad-wzoru.js');
const STYL = czytaj('src/app/podglad-wzoru.css');
const POMOCNICY = czytaj('src/app/pomocnicy.js');
const UMYWALKA = czytaj('src/umywalka/main.js');

/* ═══════════════════════════════════════════ jedna biblioteka */

test('oba kalkulatory biorą zdjęcia z tego samego miejsca', () => {
  assert.match(KOMPONENT, /from '\.\.\/generated\/wzory-dekorow\.js'/);
  assert.match(POMOCNICY, /from '\.\/podglad-wzoru\.js'/);
  assert.match(UMYWALKA, /from '\.\.\/app\/podglad-wzoru\.js'/);
  // Zero kopii plików: katalog zdjęć jest jeden.
  assert.ok(fs.existsSync(path.join(ROOT, 'public', 'wzory')));
  assert.ok(!fs.existsSync(path.join(ROOT, 'public', 'wzory-blaty')));
});

test('styl komponentu jest w jednym pliku, a nie przepisany w dwóch', () => {
  assert.match(KOMPONENT, /import '\.\/podglad-wzoru\.css'/);
  for (const klasa of ['.wzor-dymek', '.wzor-okno', '.wzor-plyta', '.wzor-lupa', '.wzor-mini']) {
    assert.ok(STYL.includes(klasa), `brak stylu ${klasa}`);
    assert.ok(!czytaj('src/style.css').includes(klasa), `${klasa} zdublowane w style.css`);
    assert.ok(!czytaj('src/umywalka/umywalka.css').includes(klasa), `${klasa} zdublowane w umywalka.css`);
  }
});

/* ═══════════════════════════════════════════ główny lejek nietknięty */

test('wybór dekoru w kalkulatorze blatów działa jak działał', () => {
  // Kliknięcie kafelka nadal woła dokładnie to samo co przed zmianą.
  assert.match(POMOCNICY, /onclick: \(\) => wyslij\(n, `Wybieram dekor \$\{n\}\.`\)/);
});

test('komponent nie dotyka wyceny, bramki ani zdarzeń', () => {
  for (const zakazane of ['wycen(', 'wyslijLead', 'konwersjaLead', 'zdarzenie(', 'razemZaokr']) {
    assert.ok(!KOMPONENT.includes(zakazane), `komponent sięga po ${zakazane}`);
  }
});

test('podgląd nie pokazuje żadnych cen', () => {
  for (const slowo of ['zł', 'cena', 'rabat', 'marż', 'netto']) {
    assert.ok(!KOMPONENT.toLowerCase().includes(slowo.toLowerCase()), `w podglądzie jest „${slowo}"`);
  }
});

test('dekor bez zdjęcia zostaje zwykłym kafelkiem', () => {
  // `elementyWzoru` oddaje pustą listę, a `podlaczPodglad` nic nie podpina.
  assert.match(KOMPONENT, /if \(!mini\) return \[\];/);
  assert.match(KOMPONENT, /if \(!plikWzoru\(dane\.marka, dane\.dekor\)\) return false;/);
  assert.match(POMOCNICY, /kropka \? 'pom-dekor pom-dekor-wzor' : 'pom-dekor'/);
});

/* ═══════════════════════════════════════════ trzy drogi do podglądu */

test('mysz, klawiatura i dotyk — każdy ma swoją drogę', () => {
  assert.match(KOMPONENT, /addEventListener\('mouseenter'/);
  assert.match(KOMPONENT, /addEventListener\('focus'/);
  assert.match(KOMPONENT, /PRZYTRZYMANIE_MS/);
  assert.match(KOMPONENT, /\.wzor-lupa/);
  // Dymek przy kafelku tylko tam, gdzie jest prawdziwy kursor.
  assert.match(KOMPONENT, /\(hover: hover\) and \(pointer: fine\)/);
});

test('po przytrzymaniu palca dekor NIE zostaje wybrany', () => {
  // Inaczej klient, który chciał tylko obejrzeć, zmieniałby sobie wycenę.
  assert.match(KOMPONENT, /if \(!dlugie\) return;[\s\S]{0,120}preventDefault/);
});

test('podgląd zamyka się tapnięciem w tło, przyciskiem i Escape', () => {
  assert.match(KOMPONENT, /key === 'Escape'/);
  assert.match(KOMPONENT, /wzor-zamknij'\)\.addEventListener\('click', zamknijPodglad\)/);
  assert.match(KOMPONENT, /e\.target === okno/);
});

/* ═══════════════════════════════════════════ przybliżanie */

test('przybliżanie: kółko, kliknięcie, dwuklik i szczypanie', () => {
  assert.match(KOMPONENT, /addEventListener\(\s*'wheel'/);
  assert.match(KOMPONENT, /startSzczypania/);
  assert.match(KOMPONENT, /dwuklik/);
  // Zakres powiększenia jest ograniczony z obu stron.
  assert.match(KOMPONENT, /const ZOOM_MIN = 1;/);
  assert.match(KOMPONENT, /const ZOOM_MAX = \d+;/);
  assert.match(KOMPONENT, /Math\.max\(ZOOM_MIN, Math\.min\(ZOOM_MAX/);
});

test('przybliżone zdjęcie nie ucieka poza kadr', () => {
  assert.match(KOMPONENT, /x = Math\.max\(-zapasX, Math\.min\(zapasX, x\)\);/);
  assert.match(KOMPONENT, /y = Math\.max\(-zapasY, Math\.min\(zapasY, y\)\);/);
});

test('przeglądarka nie przejmuje gestów nad zdjęciem', () => {
  // Bez `touch-action: none` telefon przewijałby stronę zamiast przybliżać.
  assert.match(STYL, /\.wzor-plyta[\s\S]*?touch-action: none/);
});

/* ═══════════════════════════════════════════ waga */

test('duże zdjęcie dociąga się dopiero przy podglądzie', () => {
  // Na kafelku miniatura (~1 kB), pełna płyta dopiero w dymku i w oknie.
  assert.match(KOMPONENT, /plikWzoru\(marka, dekor, true\)/);
  assert.match(KOMPONENT, /loading="lazy"/);
});

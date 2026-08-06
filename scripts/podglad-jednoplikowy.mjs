#!/usr/bin/env node
/**
 * JEDEN PLIK HTML z całą aplikacją — do wysłania mailem/WhatsAppem
 * albo do obejrzenia przez podwójne kliknięcie, bez uruchamiania czegokolwiek.
 *
 *   npm run podglad
 *
 * Bierze osobny build z dist-podglad/ (jedna paczka, format bez modułów —
 * patrz vite.podglad.config.js) i skleja go z index.html w jeden plik.
 *
 * ⚠ Czego podgląd NIE potrafi: rozmowy z asystentem AI. Asystent działa na
 *   serwerze (Netlify), więc plik z dysku nie ma się z czym połączyć —
 *   aplikacja sama przełącza się wtedy na kreator „w kilka pytań".
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUILD = path.join(ROOT, 'dist-podglad');
const WYJSCIE = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'podglad.html');

const js = path.join(BUILD, 'podglad.js');
const css = path.join(BUILD, 'podglad.css');

if (!fs.existsSync(js)) {
  console.error('✗ Brak dist-podglad/podglad.js — najpierw `npm run build:podglad`.');
  process.exit(1);
}

let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// 1. skrypt: zwykły <script>, nie moduł — moduły nie działają z dysku
html = html.replace(
  /<script type="module"[^>]*><\/script>/,
  `<script>\n${fs.readFileSync(js, 'utf8')}\n</script>`
);

// 2. style
if (fs.existsSync(css)) {
  html = html.replace('</head>', `<style>\n${fs.readFileSync(css, 'utf8')}\n</style>\n</head>`);
}

// 3. logo i favicon jako dane w środku pliku
const logo = path.join(ROOT, 'public', 'logo-k24h.png');
if (fs.existsSync(logo)) {
  const dane = 'data:image/png;base64,' + fs.readFileSync(logo).toString('base64');
  html = html.replaceAll('/logo-k24h.png', dane);
}

// 4. podstrony nie istnieją w jednym pliku — nie kuśmy klienta martwymi linkami
html = html.replace(
  /<a href="\/polityka-prywatnosci\.html">Polityka prywatności<\/a> ·\s*/,
  ''
);

// 5. wyraźna informacja, że to podgląd
html = html.replace(
  '</body>',
  `  <div style="position:fixed;left:12px;bottom:12px;z-index:60;background:#1b1815;
       border:1px solid rgba(201,168,106,.45);border-radius:4px;padding:9px 13px;
       font:12px/1.4 Arial,sans-serif;color:#8c8474;max-width:280px">
     <b style="color:#c9a86a">PODGLĄD OFFLINE</b><br>
     Wersja z jednego pliku — asystent AI wymaga internetu i działa dopiero
     na stronie. Tutaj liczy kreator „w kilka pytań".
   </div>\n</body>`
);

fs.writeFileSync(WYJSCIE, html, 'utf8');
const kb = (fs.statSync(WYJSCIE).size / 1024).toFixed(0);
console.log(`✓ ${path.relative(ROOT, WYJSCIE)} — ${kb} kB, działa po podwójnym kliknięciu.`);

#!/usr/bin/env node
/**
 * STRAŻNIK TAJEMNICY HANDLOWEJ
 *
 * Uruchamiany automatycznie po każdym `npm run build`.
 * Przegląda gotowy folder dist/ (czyli dokładnie to, co dostanie przeglądarka
 * klienta) i przerywa build, jeśli znajdzie w nim cokolwiek o rabatach,
 * cenach zakupowych albo marżach.
 *
 * Jeśli kiedyś build padnie na tym skrypcie — to znaczy, że do pliku firmy
 * albo do tekstu w UI wkradła się informacja, której klient widzieć nie może.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

const ZAKAZANE = [
  { wzor: /rabat/i, opis: 'słowo „rabat"' },
  { wzor: /mar[żz]a|mar[żz]y|mar[żz]ą|mar[żz]ę/i, opis: 'słowo „marża"' },
  { wzor: /zakupow|cena zakupu|kosztw?asny|koszt własny/i, opis: 'cena/koszt zakupu' },
  { wzor: /notaWewnetrzna|jakLiczyc/i, opis: 'pole wewnętrzne z konfiguracji firmy' },
  { wzor: /zasady\.json|pricing[/\\]zrodla/i, opis: 'ścieżka do tajnych źródeł cen' },
  { wzor: /netto\s*[x×*]\s*0[.,]\d+/i, opis: 'wzór przeliczenia ceny zakupowej' },
  { wzor: /\bnarzut\b/i, opis: 'słowo „narzut" (może zdradzać sposób liczenia marży)' },
  // Wytyczne asystenta AI mają zostać na serwerze — w przeglądarce klient
  // mógłby je przeczytać i podpowiedzieć konsultantowi, jak ma się zachować.
  { wzor: /Jesteś konsultantem firmy|ŻELAZNE ZASADY|action":"quote/, opis: 'wytyczne konsultanta (mają być tylko w Workerze)' },
  { wzor: /sk-ant-[A-Za-z0-9_-]/, opis: 'klucz API Anthropic (!)' },
];

if (!fs.existsSync(DIST)) {
  console.error('✗ Brak folderu dist/ — najpierw `npm run build`.');
  process.exit(1);
}

const pliki = [];
(function zbierz(dir) {
  for (const w of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, w.name);
    if (w.isDirectory()) zbierz(p);
    else if (/\.(js|css|html|json|map)$/i.test(w.name)) pliki.push(p);
  }
})(DIST);

let znalezione = 0;

for (const plik of pliki) {
  const tresc = fs.readFileSync(plik, 'utf8');
  for (const { wzor, opis } of ZAKAZANE) {
    const m = tresc.match(wzor);
    if (!m) continue;
    znalezione++;
    const i = tresc.indexOf(m[0]);
    const kontekst = tresc.slice(Math.max(0, i - 90), i + 90).replace(/\s+/g, ' ');
    console.error(`✗ ${path.relative(ROOT, plik)}: ${opis}\n    …${kontekst}…`);
  }
}

if (znalezione) {
  console.error(
    `\n✗ ZATRZYMANO BUILD: w plikach dla klienta znalazłem ${znalezione} rzecz(y),` +
      ' których klient widzieć nie powinien.\n' +
      '  Usuń je z src/ (opis metody trzymamy w KOMENTARZACH — te nie trafiają do bundla).'
  );
  process.exit(1);
}

console.log(`✓ Bundle czysty — sprawdzono ${pliki.length} plików, zero śladów cen zakupowych i rabatów.`);

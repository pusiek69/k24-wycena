#!/usr/bin/env node
/**
 * Składa gotowy plik Workera do wklejenia w Cloudflare.
 *
 *   worker/worker.template.js  +  lista dekorów  →  worker/worker.js
 *
 * Konsultant musi znać dokładne nazwy dekorów, żeby nie wymyślał wzorów,
 * których nie mamy. Cen NIE dostaje — te liczy kalkulator na stronie.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ZRODLO = path.join(ROOT, 'src', 'generated');

const FIRMY_DIR = path.join(ROOT, 'src', 'firms');

/**
 * Lista kolekcji bierze się z plików firm — tak jak w aplikacji.
 * Dzięki temu dodanie dostawcy to nadal JEDEN plik w src/firms/,
 * a nie dopisywanie go jeszcze w tym skrypcie (łatwo o tym zapomnieć,
 * a wtedy konsultant nie zna nowych dekorów, choć strona je pokazuje).
 */
function firmyZPlikow() {
  return fs
    .readdirSync(FIRMY_DIR)
    .filter((f) => f.endsWith('.js') && f !== 'index.js' && !f.startsWith('_'))
    .map((f) => {
      const tresc = fs.readFileSync(path.join(FIRMY_DIR, f), 'utf8');
      const slug = tresc.match(/slug:\s*'([^']+)'/)?.[1] || f.replace('.js', '');
      const aktywna = !/aktywna:\s*false/.test(tresc);
      const reczna = /trybCeny:\s*'reczna'/.test(tresc);
      const pomij = (tresc.match(/pomijGrubosci:\s*\[([^\]]*)\]/)?.[1] || '')
        .split(',')
        .map((s) => s.trim().replace(/['"]/g, ''))
        .filter(Boolean);
      const kolejnosc = Number(tresc.match(/kolejnosc:\s*(\d+)/)?.[1] ?? 99);
      return { slug, klucz: slug.replace(/-/g, '_'), aktywna, reczna, pomij, kolejnosc };
    })
    .filter((f) => f.aktywna && !f.reczna) // kamienia naturalnego konsultant nie wycenia
    .sort((a, b) => a.kolejnosc - b.kolejnosc);
}

const sekcje = [];
for (const { slug, klucz, pomij: pomijane } of firmyZPlikow()) {
  const plik = path.join(ZRODLO, `${slug}.dekory.json`);
  if (!fs.existsSync(plik)) continue;
  const dane = JSON.parse(fs.readFileSync(plik, 'utf8'));

  const wpisy = [];
  for (const [nazwa, grubosci] of Object.entries(dane.dekory || {})) {
    const gr = Object.keys(grubosci)
      .filter((g) => !pomijane.includes(g))
      .sort((a, b) => Number(a) - Number(b));
    if (gr.length) wpisy.push(`${nazwa} (${gr.join('/')} mm)`);
  }
  sekcje.push(`## ${klucz}\n${wpisy.join('; ')}`);
  console.log(`  ${klucz.padEnd(14)} ${wpisy.length} dekorów`);
}

/**
 * Wytyczne rozmowy trzymamy POZA repozytorium (jest publiczne) — tak samo
 * jak ceny zakupowe. Plik `worker/prompt.local.md` ma je w całości;
 * tutaj tylko wstrzykujemy jego treść w gotowego Workera.
 */
const PROMPT_ZAPASOWY = [
  'Jesteś konsultantem firmy kamieniarskiej. Odpowiadasz po polsku, krótko',
  'i rzeczowo. Zbierz od klienta: materiał, wzór, wymiary odcinków blatu',
  'w centymetrach oraz sposób montażu zlewu i płyty grzewczej.',
  'Nie podawaj żadnych kwot — wycenę liczy kalkulator.',
  'Gdy masz komplet danych, dołącz obiekt JSON:',
  '{"action":"quote","params":{...},"message":"..."}',
  'Jeśli sprawa jest nietypowa: {"action":"lead","message":"..."}',
].join('\n');

const sciezkaPromptu = path.join(ROOT, 'worker', 'prompt.local.md');
let wytyczne = PROMPT_ZAPASOWY;

if (fs.existsSync(sciezkaPromptu)) {
  wytyczne = fs.readFileSync(sciezkaPromptu, 'utf8').trim();
  console.log(`  wytyczne      ${(Buffer.byteLength(wytyczne) / 1024).toFixed(1)} kB z prompt.local.md`);
} else {
  console.warn('\n⚠ Brak worker/prompt.local.md — wstawiam prompt ZAPASOWY.');
  console.warn('  Konsultant będzie działał, ale bez naszego sposobu prowadzenia rozmowy.');
  console.warn('  Plik jest celowo poza gitem: to know-how handlowe.\n');
}

// Backticki i ${...} w treści wytycznych rozwaliłyby literał szablonowy.
const bezpieczne = wytyczne.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

const szablon = fs.readFileSync(path.join(ROOT, 'worker', 'worker.template.js'), 'utf8');
const wynik = szablon
  .replace('__DEKORY__', sekcje.join('\n\n'))
  .replace('__PROMPT__', bezpieczne);

for (const znacznik of ['__DEKORY__', '__PROMPT__']) {
  if (wynik.includes(znacznik)) {
    console.error(`✗ Nie udało się podstawić ${znacznik}.`);
    process.exit(1);
  }
}

fs.writeFileSync(path.join(ROOT, 'worker', 'worker.js'), wynik, 'utf8');
console.log(`✓ worker/worker.js — ${(wynik.length / 1024).toFixed(0)} kB (plik jest poza gitem)`);

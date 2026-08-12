#!/usr/bin/env node
/**
 * PROGI CENOWE W TREŚCI STRON — synchronizacja z silnikiem.
 *
 *   npm run ceny:tresc            → wstawia aktualne kwoty do stron
 *   npm run ceny:tresc -- --sprawdz → tylko raport, nic nie zapisuje
 *
 * Na stronie głównej, stronach miast i stronach materiałowych stoją zdania
 * „blat 60 × 300 cm od 4 400 zł". Pisane ręcznie rozjeżdżały się przy każdej
 * zmianie cennika — w sierpniu 2026 strona mówiła 4 100 zł, gdy kalkulator
 * liczył już 4 400 zł. Teraz liczby biorą się z tego samego silnika.
 *
 * JAK PODMIENIAMY
 * Nie zgadujemy kontekstu z treści. Skrypt pamięta w ceny-tresc.json,
 * jakie kwoty wpisał poprzednio, i zamienia je na nowe. Dzięki temu działa
 * przy każdej kolejnej zmianie cennika, a nie tylko raz.
 */
import fs from 'node:fs';
import path from 'node:path';
import { wczytajSilnik } from './lib/silnik.mjs';
import { progi, zapisy } from './lib/ceny-progowe.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const PAMIEC = path.join(ROOT, 'scripts', 'lib', 'ceny-tresc.json');
const tylkoSprawdz = process.argv.includes('--sprawdz');

/* strony, na których stoją te kwoty (bez dist/ i bez podglądu) */
const STRONY = fs
  .readdirSync(ROOT)
  .filter((f) => f.endsWith('.html') && f !== 'podglad.html')
  .map((f) => path.join(ROOT, f));

const { wycen, FIRMY } = await wczytajSilnik();
const p = progi(FIRMY, wycen);

/** Klucze muszą się zgadzać z tym, co zapisujemy w pamięci. */
const AKTUALNE = {
  konglomeratProste: p.konglomerat.proste,
  konglomeratL: p.konglomerat.wL,
  konglomeratM2Od: p.konglomerat.m2Od,
  konglomeratM2Do: p.konglomerat.m2Do,
  spiekProste: p.spiek.proste,
  spiekL: p.spiek.wL,
  spiekM2Od: p.spiek.m2Od,
  spiekM2Do: p.spiek.m2Do,
};

const poprzednie = fs.existsSync(PAMIEC) ? JSON.parse(fs.readFileSync(PAMIEC, 'utf8')).kwoty : null;
if (!poprzednie) {
  console.error('✗ Brak scripts/lib/ceny-tresc.json — nie wiem, jakie kwoty stoją dziś na stronach.');
  process.exit(1);
}

console.log('Progi z silnika:');
for (const [k, v] of Object.entries(AKTUALNE)) {
  const stara = poprzednie[k];
  const zmiana = stara === v ? 'bez zmian' : `${stara} → ${v}`;
  console.log(`  ${k.padEnd(20)} ${String(v).padStart(6)} zł   ${zmiana}`);
}

/* ── podmiana ───────────────────────────────────────────────────────────── */
let zmienionych = 0;
let trafien = 0;
const doZmiany = Object.entries(AKTUALNE).filter(([k, v]) => poprzednie[k] !== v);

for (const plik of STRONY) {
  const przed = fs.readFileSync(plik, 'utf8');
  let t = przed;

  for (const [klucz, nowa] of doZmiany) {
    const stara = poprzednie[klucz];
    // Kwota bywa zapisana na trzy sposoby: „4400" (meta, JSON-LD),
    // „4 400" (treść) i „4 400" z niełamliwą spacją. Podmieniamy każdy,
    // zachowując zapis, który zastaliśmy.
    const stareZapisy = zapisy(stara);
    const noweZapisy = zapisy(nowa);
    for (const [odS, naS] of stareZapisy.map((z, i) => [z, noweZapisy[i]])) {
      // tylko tam, gdzie zaraz obok stoi „zł" — żeby nie ruszyć np. roku ani NIP-u
      const re = new RegExp(`${odS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=(&nbsp;| | )?zł)`, 'g');
      const ile = (t.match(re) || []).length;
      if (ile) {
        t = t.replace(re, naS);
        trafien += ile;
      }
    }
  }

  if (t !== przed) {
    zmienionych++;
    if (!tylkoSprawdz) fs.writeFileSync(plik, t, 'utf8');
    console.log(`  ${tylkoSprawdz ? '≠' : '✓'} ${path.basename(plik)}`);
  }
}

if (!doZmiany.length) {
  console.log('\n✓ Treść stron zgodna z silnikiem — nic do zmiany.');
  process.exit(0);
}

console.log(
  `\n${tylkoSprawdz ? 'DO ZMIANY' : 'Zmieniono'}: ${trafien} wystąpień w ${zmienionych} plikach.`
);

if (tylkoSprawdz) {
  console.error('✗ Kwoty na stronach rozjechały się z silnikiem — uruchom `npm run ceny:tresc`.');
  process.exit(1);
}

// Historia wycofanych kwot służy checkliście: jeśli któraś wróci na stronę
// (np. przez ręczną edycję albo cofnięcie zmiany), test §8.17 to wyłapie.
const stanPliku = JSON.parse(fs.readFileSync(PAMIEC, 'utf8'));
const historia = new Set(stanPliku.historia || []);
for (const [k, v] of Object.entries(poprzednie)) {
  if (AKTUALNE[k] !== v) historia.add(v);
}
for (const v of Object.values(AKTUALNE)) historia.delete(v);

fs.writeFileSync(
  PAMIEC,
  JSON.stringify(
    {
      _info: [
        'Kwoty, które skrypt ceny-tresc.mjs wpisał ostatnio do stron.',
        'Służą do znalezienia ich przy następnej zmianie cennika — nie edytuj ręcznie.',
        '"historia" to kwoty już wycofane — checklista pilnuje, żeby nie wróciły.',
      ],
      _zapisano: new Date().toISOString().slice(0, 10),
      kwoty: AKTUALNE,
      historia: [...historia].sort((a, b) => a - b),
    },
    null,
    2
  ) + '\n',
  'utf8'
);
console.log('✓ Zapisano nowy stan do scripts/lib/ceny-tresc.json');

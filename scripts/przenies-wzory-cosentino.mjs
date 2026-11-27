/**
 * PRZENIESIENIE ZDJĘĆ COSENTINO DO REPOZYTORIUM
 *
 *   node scripts/przenies-wzory-cosentino.mjs
 *
 * Zdjęcia pobierały się najpierw poza repo, bo zgody Cosentino na ich
 * użycie jeszcze nie było. Dawid potwierdził ją 27.11.2026 („mam zgode,
 * tylko cale plyty"), więc wchodzą do `public/wzory/`.
 *
 * „TYLKO CAŁE PŁYTY" jest tu regułą, nie życzeniem: dekory oznaczone
 * w danych jako `slabKwadrat` (katalog oddał próbkę zamiast płyty)
 * NIE SĄ przenoszone. Lepiej, żeby dekor nie miał podglądu, niż żeby
 * pokazywał kwadratowy wycinek — to był dokładnie ten błąd, który
 * poprawialiśmy przy Avancie.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KOLORY = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'kolory-cosentino.json'), 'utf8'));
const ZRODLO = process.argv[2] || 'C:/Users/kamie/Downloads/kam24h-marketing/cosentino-zdjecia';
const CEL = path.join(ROOT, 'public', 'wzory');

let przeniesione = 0;
const pominiete = [];
const brakPliku = [];

for (const marka of ['silestone', 'dekton']) {
  const zKat = path.join(ZRODLO, marka);
  const doKat = path.join(CEL, marka);
  if (!fs.existsSync(zKat)) continue;
  fs.mkdirSync(doKat, { recursive: true });

  for (const [nazwa, v] of Object.entries(KOLORY[marka])) {
    if (!v.slug || !v.kod) continue;
    if (v.slabKwadrat) {
      pominiete.push(`${marka}/${nazwa} — katalog oddał próbkę, nie płytę`);
      continue;
    }
    let maKomplet = true;
    for (const sufiks of ['-slab', '', '-mini']) {
      const plik = `${v.slug}${sufiks}.webp`;
      const z = path.join(zKat, plik);
      if (!fs.existsSync(z)) {
        maKomplet = false;
        continue;
      }
      fs.copyFileSync(z, path.join(doKat, plik));
    }
    if (maKomplet) przeniesione++;
    else brakPliku.push(`${marka}/${nazwa}`);
  }
}

console.log(`✓ przeniesione dekory: ${przeniesione}`);
if (pominiete.length) {
  console.log(`\nŚWIADOMIE POMINIĘTE (${pominiete.length}) — tylko całe płyty:`);
  for (const p of pominiete) console.log('  ·', p);
}
if (brakPliku.length) {
  console.log(`\nNiekompletne (${brakPliku.length}):`);
  for (const b of brakPliku) console.log('  ·', b);
}

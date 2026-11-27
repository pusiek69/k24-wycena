/**
 * POBRANIE ZDJĘĆ PEŁNYCH PŁYT COSENTINO
 *
 *   node scripts/pobierz-wzory-cosentino.mjs [katalog-docelowy]
 *
 * Źródłem jest `tablahd` z biblioteki Cosentino — jedyny wariant, jaki
 * serwer oddaje, i od razu ten największy: sprawdzone na Et. Marquina
 * 10000 × 4831 px (9,3 MB). To jest dokładnie to, o co prosił Dawid:
 * „najbardziej mi zalezy na duzych slabach, a nie miniaturki".
 *
 * Zapisujemy trzy rozmiary, tak jak przy Architype, ale płytę większą:
 *   <kod>-slab.webp  2200 px — podgląd pełnej płyty z przybliżaniem
 *   <kod>.webp        640 px — kafelek przy wyborze kamienia
 *   <kod>-mini.webp    96 px — miniaturka w podpowiedzi
 *
 * ⚠ DOMYŚLNIE ZAPISUJE POZA REPOZYTORIUM. Zgody Cosentino na użycie
 *   zdjęć jeszcze nie mamy (przy Architype Dawid ją potwierdził). Dopóki
 *   jej nie ma, zdjęcia nie mają prawa trafić na produkcję — leżą
 *   w katalogu roboczym i czekają.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KOLORY = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'kolory-cosentino.json'), 'utf8'));

const CEL = process.argv[2] || 'C:/Users/kamie/Downloads/kam24h-marketing/cosentino-zdjecia';
const naglowki = { 'user-agent': 'k24h-kalkulator/1.0 (strona kamieniarstwa)' };

const ROZMIARY = [
  { sufiks: '-slab', szer: 2200, jakosc: 82, limitKB: 600 },
  { sufiks: '', szer: 640, wys: 640, jakosc: 80, limitKB: 120 },
  { sufiks: '-mini', szer: 96, wys: 96, jakosc: 72, limitKB: 8 },
];

async function zapisz(buf, plik, r) {
  let jakosc = r.jakosc;
  for (let i = 0; i < 4; i++) {
    const obraz = sharp(buf);
    const wyjscie = await (r.wys
      ? obraz.resize(r.szer, r.wys, { fit: 'cover', position: 'centre' })
      : obraz.resize({ width: r.szer, withoutEnlargement: true })
    )
      .webp({ quality: jakosc })
      .toBuffer();
    if (wyjscie.length / 1024 <= r.limitKB || jakosc <= 55) {
      fs.writeFileSync(plik, wyjscie);
      return { kb: Math.round(wyjscie.length / 1024), jakosc };
    }
    jakosc -= 8;
  }
  return null;
}

let pobrane = 0;
let juzByly = 0;
let bezZdjecia = [];

for (const marka of ['silestone', 'dekton']) {
  const katalog = path.join(CEL, marka);
  fs.mkdirSync(katalog, { recursive: true });

  for (const [nazwa, v] of Object.entries(KOLORY[marka])) {
    if (!v.kod) {
      bezZdjecia.push(`${marka}: ${nazwa}`);
      continue;
    }
    const docelowy = path.join(katalog, `${v.slug}-slab.webp`);
    if (fs.existsSync(docelowy)) {
      juzByly++;
      continue;
    }
    try {
      const url = `https://assetstools.cosentino.com/api/v1/bynder/color/${v.kod}/tablahd/${v.kod}-fullslab.jpg`;
      const odp = await fetch(url, { headers: naglowki });
      if (!odp.ok) {
        bezZdjecia.push(`${marka}: ${nazwa} — HTTP ${odp.status}`);
        process.stdout.write('x');
        continue;
      }
      const buf = Buffer.from(await odp.arrayBuffer());
      const meta = await sharp(buf).metadata();
      for (const r of ROZMIARY) {
        await zapisz(buf, path.join(katalog, `${v.slug}${r.sufiks}.webp`), r);
      }
      pobrane++;
      process.stdout.write(meta.width >= 3000 ? '.' : 'm');
    } catch (e) {
      bezZdjecia.push(`${marka}: ${nazwa} — ${e.message}`);
      process.stdout.write('!');
    }
  }
  process.stdout.write('\n');
}

console.log(`\n✓ pobrane: ${pobrane}, już były: ${juzByly}`);
console.log(`  (kropka = źródło ≥3000 px, „m" = mniejsze)`);
console.log(`  katalog: ${CEL}`);
if (bezZdjecia.length) {
  console.log(`\nBEZ ZDJĘCIA CAŁEJ PŁYTY — ${bezZdjecia.length}. Te dekory Dawid może mieć`);
  console.log('w materiałach partnerskich Cosentino:');
  for (const b of bezZdjecia) console.log('  ·', b);
}

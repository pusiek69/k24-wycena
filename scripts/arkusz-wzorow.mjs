/**
 * ARKUSZ KONTROLNY ZDJĘĆ PŁYT
 *
 *   node scripts/arkusz-wzorow.mjs [fragment-nazwy ...]
 *
 * Skleja pobrane zdjęcia płyt w jeden obrazek, żeby dało się OBEJRZEĆ, czy
 * to naprawdę płyty — a nie zdjęcia wnętrz o podobnych proporcjach. Bez
 * argumentów bierze wszystkie; z argumentami tylko pasujące dekory.
 *
 * Powstało, bo rozpoznawanie płyty „po kształcie" (`zbierz-wzory.mjs`)
 * wybiera zdjęcie 16:9 i tyle — a 16:9 bywa też zdjęciem kuchni.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { WZORY } = await import('file://' + path.join(ROOT, 'src/generated/wzory-dekorow.js'));

const argumenty = process.argv.slice(2);
const stronaArg = argumenty.findIndex((a) => a === '--strona');
const strona = stronaArg >= 0 ? Number(argumenty[stronaArg + 1]) : null;
const katalogIdx = argumenty.findIndex((a) => a === '--katalog');
const pomin = new Set();
for (const i of [stronaArg, katalogIdx]) if (i >= 0) pomin.add(i).add(i + 1);
const szukane = argumenty.filter((_, i) => !pomin.has(i)).map((s) => s.toLowerCase());
const NA_STRONE = 18;
const KAFELEK = 360;
const PODPIS = 26;

/*
 * Źródłem jest albo katalog wzorów z repo (domyślnie), albo dowolny inny
 * folder — `--katalog <ścieżka>`. To drugie służy do oglądania zdjęć,
 * które jeszcze nie weszły do repo, na przykład Cosentino, gdzie czekamy
 * na potwierdzenie zgody na użycie zdjęć.
 */
const katalogArg = katalogIdx;
const KATALOG = katalogArg >= 0 ? argumenty[katalogArg + 1] : null;

const wybrane = [];
if (KATALOG) {
  const marki = fs.readdirSync(KATALOG).filter((d) => fs.statSync(path.join(KATALOG, d)).isDirectory());
  for (const marka of marki) {
    for (const f of fs.readdirSync(path.join(KATALOG, marka)).filter((f) => f.endsWith('-slab.webp'))) {
      const nazwa = f.replace(/-slab\.webp$/, '');
      const etykieta = `${marka}/${nazwa}`.toLowerCase();
      if (szukane.length && !szukane.some((s) => etykieta.includes(s))) continue;
      wybrane.push({ marka, nazwa, plik: path.join(KATALOG, marka, f) });
    }
  }
  wybrane.sort((a, b) => (a.marka + a.nazwa).localeCompare(b.marka + b.nazwa, 'pl'));
} else {
  for (const marka of Object.keys(WZORY)) {
    for (const [nazwa, v] of Object.entries(WZORY[marka])) {
      if (!v.slab) continue;
      const plik = path.join(ROOT, 'public/wzory', marka, `${v.k}-slab.webp`);
      if (!fs.existsSync(plik)) continue;
      const etykieta = `${marka}/${nazwa}`.toLowerCase();
      if (szukane.length && !szukane.some((s) => etykieta.includes(s))) continue;
      wybrane.push({ marka, nazwa, plik });
    }
  }
}

if (!wybrane.length) {
  console.log('Nic nie pasuje.');
  process.exit(0);
}

const stron = Math.ceil(wybrane.length / NA_STRONE);
if (strona) {
  const od = (strona - 1) * NA_STRONE;
  console.log(`strona ${strona} z ${stron} (${wybrane.length} zdjęć razem)`);
  wybrane.splice(0, od);
  wybrane.length = Math.min(wybrane.length, NA_STRONE);
}

const kolumny = Math.min(3, wybrane.length);
const wiersze = Math.ceil(wybrane.length / kolumny);
const wysKafelka = Math.round(KAFELEK / 2) + PODPIS;

const warstwy = [];
for (let i = 0; i < wybrane.length; i++) {
  const { nazwa, plik } = wybrane[i];
  const obraz = await sharp(plik).resize(KAFELEK, Math.round(KAFELEK / 2), { fit: 'contain', background: '#111' }).toBuffer();
  const x = (i % kolumny) * KAFELEK;
  const y = Math.floor(i / kolumny) * wysKafelka;
  warstwy.push({ input: obraz, left: x, top: y });

  const podpis = Buffer.from(
    `<svg width="${KAFELEK}" height="${PODPIS}"><rect width="100%" height="100%" fill="#111"/>` +
      `<text x="6" y="18" font-family="sans-serif" font-size="14" fill="#ddd">${nazwa.replace(/[<&]/g, '')}</text></svg>`
  );
  warstwy.push({ input: podpis, left: x, top: y + Math.round(KAFELEK / 2) });
}

const wyjscie = path.join(ROOT, 'arkusz-wzorow.png');
await sharp({
  create: { width: kolumny * KAFELEK, height: wiersze * wysKafelka, channels: 3, background: '#111' },
})
  .composite(warstwy)
  .png()
  .toFile(wyjscie);

console.log(`✓ ${wybrane.length} zdjęć → ${wyjscie}`);
for (const w of wybrane) console.log('  ·', w.marka, '/', w.nazwa);

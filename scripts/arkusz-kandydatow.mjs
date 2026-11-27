/**
 * ARKUSZ KANDYDATÓW — wszystkie zdjęcia z karty dekoru, podpisane nazwą pliku.
 *
 *   node scripts/arkusz-kandydatow.mjs <klucz-dekoru> [...]
 *
 * Służy do ręcznego wskazania płyty tam, gdzie ani nazwa pliku, ani kształt
 * nie wystarczają — bo dostawca wrzucił zdjęcie kuchni w proporcji 16:9
 * i algorytm bierze je za płytę. Zamiast zgadywać dalej, patrzymy.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KARTY = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'karty-architype.json'), 'utf8'));
const naglowki = { 'user-agent': 'k24h-kalkulator/1.0 (strona kamieniarstwa, zgoda dystrybutora)' };

const szukane = process.argv.slice(2).map((s) => s.toLowerCase());
if (!szukane.length) {
  console.log('Podaj fragment adresu karty, np. absolute-white');
  process.exit(1);
}

const adresy = [];
for (const [marka, lista] of Object.entries(KARTY)) {
  for (const u of lista) if (szukane.some((s) => u.toLowerCase().includes(s))) adresy.push({ marka, u });
}

const KAF = 300;
const PODPIS = 34;
const warstwy = [];
let i = 0;
const kolumny = 4;

for (const { marka, u } of adresy) {
  const html = await (await fetch('https://architype.pl' + u, { headers: naglowki })).text();
  const pliki = [...new Set([...html.matchAll(/stones\/[^"')\s]+\.jpg/gi)].map((m) => m[0]))];
  const slug = u.split('/colors/')[1];
  const kod = (slug.match(/^(\d+[a-z]?)-/i) || [])[1] || '';
  const czlony = slug.replace(/^\d+[a-z]?-/i, '').replace(/-\d$/, '').split('-').filter((c) => c.length > 2);
  const moje = pliki.filter((p) => {
    const s = decodeURIComponent(p).toLowerCase().replace(/[_\s-]+/g, ' ');
    if (kod && new RegExp(`(^|/)${kod.toLowerCase()}( |/)`).test(s)) return true;
    return czlony.length > 0 && czlony.every((c) => s.includes(c));
  });

  console.log(`\n--- ${marka} ${slug} (${moje.length} zdjęć)`);
  for (const p of moje.slice(0, 12)) {
    const nazwa = decodeURIComponent(p).split('/').pop();
    console.log('   ', nazwa);
    try {
      const odp = await fetch('https://architype.pl/media/images/1920/' + p, { headers: naglowki });
      if (!odp.ok) continue;
      const buf = Buffer.from(await odp.arrayBuffer());
      const m = await sharp(buf).metadata();
      const kafel = await sharp(buf).resize(KAF, KAF - PODPIS, { fit: 'contain', background: '#111' }).toBuffer();
      const x = (i % kolumny) * KAF;
      const y = Math.floor(i / kolumny) * KAF;
      warstwy.push({ input: kafel, left: x, top: y });
      const txt = `${nazwa.slice(0, 40)} ${m.width}x${m.height}`.replace(/[<&]/g, '');
      warstwy.push({
        input: Buffer.from(
          `<svg width="${KAF}" height="${PODPIS}"><rect width="100%" height="100%" fill="#111"/>` +
            `<text x="4" y="14" font-family="monospace" font-size="10" fill="#ddd">${txt}</text></svg>`
        ),
        left: x,
        top: y + KAF - PODPIS,
      });
      i++;
    } catch { /* pomijamy */ }
  }
}

const wiersze = Math.ceil(i / kolumny);
const wyjscie = path.join(ROOT, 'arkusz-kandydatow.png');
await sharp({ create: { width: kolumny * KAF, height: Math.max(1, wiersze) * KAF, channels: 3, background: '#111' } })
  .composite(warstwy)
  .png()
  .toFile(wyjscie);
console.log(`\n✓ ${i} kandydatów → ${wyjscie}`);

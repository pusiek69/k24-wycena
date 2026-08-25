/**
 * ODŚWIEŻENIE `lastmod` W SITEMAPIE.
 *
 *   npm run sitemap
 *   npm run sitemap -- --sprawdz     (nic nie zapisuje, tylko mówi, co jest nieaktualne)
 *
 * POWÓD (25.08.2026, przegląd SEO): daty w sitemapie stały na 6–11 sierpnia,
 * mimo że ceny i treść zmieniały się później. Wyszukiwarka dostawała
 * sygnał „ta strona się nie zmienia" o stronach, które właśnie się
 * zmieniły — a przy cenach to akurat ta informacja, na której zależy
 * najbardziej.
 *
 * Datę bierzemy z OSTATNIEGO COMMITU danego pliku, a nie z czasu
 * modyfikacji na dysku: `git clone` ustawia wszystkim plikom datę
 * pobrania, więc mtime kłamałby przy każdym świeżym środowisku.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITEMAP = path.join(ROOT, 'public', 'sitemap.xml');
const tylkoSprawdz = process.argv.includes('--sprawdz');

/** Adres z sitemapy → plik HTML w repozytorium. */
function doPliku(url) {
  const sciezka = url.replace(/^https?:\/\/[^/]+\/?/, '').replace(/\/$/, '');
  if (!sciezka) return 'index.html';
  return sciezka.endsWith('.html') ? sciezka : `${sciezka}.html`;
}

/** Data ostatniego commitu pliku (YYYY-MM-DD) albo null, gdy plik nieznany. */
function dataZGita(plik) {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cs', '--', plik], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(out) ? out : null;
  } catch {
    return null;
  }
}

let xml = fs.readFileSync(SITEMAP, 'utf8');
const wpisy = [...xml.matchAll(/<url>\s*<loc>\s*([^<]+?)\s*<\/loc>([\s\S]*?)<\/url>/g)];

const zmiany = [];
const braki = [];

for (const wpis of wpisy) {
  const [caly, url, reszta] = wpis;
  const plik = doPliku(url);
  if (!fs.existsSync(path.join(ROOT, plik))) {
    braki.push(`${url} → brak pliku ${plik}`);
    continue;
  }
  const data = dataZGita(plik);
  if (!data) continue;

  const stara = reszta.match(/<lastmod>\s*([^<]+?)\s*<\/lastmod>/)?.[1];
  if (stara === data) continue;

  zmiany.push({ url, stara: stara || '(brak)', nowa: data });
  const nowy = stara
    ? caly.replace(/<lastmod>\s*[^<]+?\s*<\/lastmod>/, `<lastmod>${data}</lastmod>`)
    : caly.replace('</loc>', `</loc>\n    <lastmod>${data}</lastmod>`);
  xml = xml.replace(caly, nowy);
}

for (const b of braki) console.error(`  ⚠ ${b}`);

if (!zmiany.length) {
  console.log(`✓ Sitemapa aktualna — ${wpisy.length} adresów, daty zgodne z historią zmian.`);
  process.exit(0);
}

for (const z of zmiany) {
  console.log(`  ${tylkoSprawdz ? '≠' : '✓'} ${z.url}  ${z.stara} → ${z.nowa}`);
}

if (tylkoSprawdz) {
  console.error(`\n✗ ${zmiany.length} dat nieaktualnych — uruchom \`npm run sitemap\`.`);
  process.exit(1);
}

fs.writeFileSync(SITEMAP, xml, 'utf8');
console.log(`\nZaktualizowano ${zmiany.length} dat w sitemapie.`);

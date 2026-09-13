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
  const czyKatalog = /\/$/.test(url.replace(/^https?:\/\/[^/]+/, ''));
  const sciezka = url.replace(/^https?:\/\/[^/]+\/?/, '').replace(/\/$/, '');
  if (!sciezka) return 'index.html';
  if (sciezka.endsWith('.html')) return sciezka;
  // Adres katalogu („/baza-wiedzy/") to jego index, a nie plik obok.
  return czyKatalog ? `${sciezka}/index.html` : `${sciezka}.html`;
}

/**
 * Data ostatniego commitu, który zmienił TREŚĆ pliku (YYYY-MM-DD), albo null.
 *
 * ⚠ ZMIANA 13.09.2026. Wcześniej brana była data ostatniego commitu
 * JAKIEGOKOLWIEK. Tego dnia wyszło, że generator stron miast dopisywał puste
 * linie przy każdym uruchomieniu — a sprzątnięcie ich w commicie dałoby
 * jedenastu stronom świeży `lastmod`, choć nie zmieniło się w nich ani jedno
 * słowo. To dokładnie ten fałszywy sygnał „strona się zmieniła", z którym
 * walczyliśmy w sitemapie tydzień wcześniej, tylko w odwrotną stronę.
 *
 * Dlatego idziemy po historii pliku od najnowszego commitu i bierzemy
 * pierwszy, którego diff NIE jest pusty po zignorowaniu białych znaków
 * i pustych linii (`-w --ignore-blank-lines`). Commit czysto formatujący
 * po prostu nie liczy się jako zmiana strony.
 */
function dataZGita(plik) {
  const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  try {
    const historia = git(['log', '--format=%H %cs', '--', plik])
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((l) => l.split(' '));
    if (!historia.length) return null;

    for (const [hash, data] of historia) {
      // Pierwszy commit pliku (brak rodzica) zawsze jest zmianą treści.
      let rodzic;
      try {
        rodzic = git(['rev-parse', '--verify', '--quiet', `${hash}^`]).trim();
      } catch {
        return data;
      }
      const roznica = git([
        'diff', '-w', '--ignore-blank-lines', '--name-only', rodzic, hash, '--', plik,
      ]).trim();
      if (roznica) return /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : null;
    }
    // Sama historia formatowania — bierzemy najstarszy commit.
    const najstarszy = historia[historia.length - 1][1];
    return /^\d{4}-\d{2}-\d{2}$/.test(najstarszy) ? najstarszy : null;
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

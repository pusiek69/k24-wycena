/**
 * ZEBRANIE ZDJĘĆ PŁYT Z KATALOGU COSENTINO (Silestone i Dekton)
 *
 *   node scripts/zbierz-wzory-cosentino.mjs
 *
 * Cosentino ma pod tym względem porządek, jakiego nie ma Architype: każdy
 * kolor ma stronę `cosentino.com/pl-pl/colors/<marka>/<slug>/`, a na niej
 * zdjęcie CAŁEJ PŁYTY pod przewidywalnym adresem
 *
 *   assetstools.cosentino.com/api/v1/bynder/color/<KOD>/tablahd/<KOD>-fullslab.jpg
 *
 * czyli 2200 px, od krawędzi do krawędzi. Nie trzeba zgadywać po nazwie
 * pliku ani mierzyć proporcji — „fullslab" znaczy dokładnie to, czego
 * Dawid chce („najbardziej mi zalezy na duzych slabach, a nie miniaturki").
 *
 * ⚠ TEGO SKRYPTU NIE DA SIĘ URUCHOMIĆ Z NODE — I TO NIE JEST BŁĄD.
 *
 * cosentino.com odbija żądania spoza przeglądarki: zwraca 307 BEZ nagłówka
 * `Location`, czyli zagadkę, której fetch nie ma jak rozwiązać. Zmiana
 * user-agenta nie pomaga. Z wnętrza otwartej strony (są ciasteczka sesji)
 * te same żądania przechodzą normalnie.
 *
 * Dlatego kody kolorów zebrane są RAZ, z konsoli przeglądarki, i leżą
 * gotowe w `kolory-cosentino.json`. Ten plik zostaje jako zapis tego, JAK
 * je wyciągnąć, gdyby trzeba było powtórzyć — wtedy poniższą pętlę wkleja
 * się do konsoli na https://www.cosentino.com/pl-pl/colors/ :
 *
 *   for (const w of ['silestone/et-marquina', ...]) {
 *     const t = await (await fetch(`/pl-pl/colors/${w}/`)).text();
 *     const m = t.match(/color\\/([A-Z0-9]{2,8})\\/tablahd\\/\\1-fullslab\\.jpg/i);
 *     console.log(w, m && m[1]);
 *   }
 *
 * Samo POBIERANIE zdjęć działa z Node bez przeszkód — host z obrazami
 * (assetstools.cosentino.com) niczego nie blokuje.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SLUGI = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'kolory-cosentino-slugi.json'), 'utf8'));

const naglowki = { 'user-agent': 'k24h-kalkulator/1.0 (strona kamieniarstwa)' };

/** Kod koloru i adres pełnej płyty z HTML-a karty. */
function zKarty(html) {
  const slab = html.match(/https:\/\/assetstools\.cosentino\.com\/api\/v1\/bynder\/color\/([A-Z0-9]{2,8})\/tablahd\/\1-fullslab\.jpg/i);
  const tytul = (html.match(/<title>([^<]+)<\/title>/i) || [])[1] || '';
  // „Silestone Clay Veil - Cosentino" → „Clay Veil"
  const nazwa = tytul
    .replace(/\s*[-|]\s*Cosentino.*$/i, '')
    .replace(/^\s*(Silestone|Dekton)\s*/i, '')
    .trim();
  return { kod: slab ? slab[1] : null, slab: slab ? slab[0] : null, nazwa };
}

const wynik = { silestone: {}, dekton: {} };
const braki = [];

for (const wpis of SLUGI) {
  const [marka, slug] = wpis.split('/');
  try {
    const odp = await fetch(`https://www.cosentino.com/pl-pl/colors/${marka}/${slug}/`, { headers: naglowki });
    if (!odp.ok) {
      braki.push(`${wpis}: HTTP ${odp.status}`);
      process.stdout.write('x');
      continue;
    }
    const { kod, slab, nazwa } = zKarty(await odp.text());
    if (!slab) {
      braki.push(`${wpis}: karta bez zdjęcia całej płyty`);
      process.stdout.write('z');
      continue;
    }
    wynik[marka][slug] = { nazwa, kod, slab };
    process.stdout.write('.');
  } catch (e) {
    braki.push(`${wpis}: ${e.message}`);
    process.stdout.write('!');
  }
}
process.stdout.write('\n');

fs.writeFileSync(
  path.join(ROOT, 'scripts', 'wzory-cosentino.json'),
  JSON.stringify(
    {
      _info:
        'Zdjęcia pełnych płyt z katalogu Cosentino. GENEROWANE: node scripts/zbierz-wzory-cosentino.mjs. ' +
        '`slab` = pełny adres zdjęcia całej płyty (2200 px). ZGODA NA UŻYCIE ZDJĘĆ DO POTWIERDZENIA.',
      ...wynik,
    },
    null,
    2
  ) + '\n',
  'utf8'
);

for (const m of ['silestone', 'dekton']) {
  console.log(`✓ ${m}: ${Object.keys(wynik[m]).length} kolorów ze zdjęciem całej płyty`);
}
if (braki.length) {
  console.log(`\nBez płyty (${braki.length}):`);
  for (const b of braki) console.log('  ·', b);
}

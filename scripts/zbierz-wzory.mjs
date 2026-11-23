/**
 * ZEBRANIE ZDJĘĆ WZORÓW Z KATALOGU ARCHITYPE
 *
 *   node scripts/zbierz-wzory.mjs            — czyta karty dekorów i zapisuje
 *                                              scripts/wzory-architype.json
 *
 * Każdy dekor ma w katalogu dostawcy kilka zdjęć. Interesują nas dwa:
 *
 *   SLAB  — CAŁA PŁYTA na stojaku, od krawędzi do krawędzi. To jest to,
 *           co klient ma zobaczyć po najechaniu albo kliknięciu lupki:
 *           widać przebieg żyły przez całą płytę, a nie jej kawałek.
 *           (Zgłoszenie Dawida: „a ty dalej tylko miniaturki zdjec
 *           a ja chciałem całe slaby".)
 *   ZOOM  — zbliżenie struktury. Zostaje jako tekstura na bryle 3D,
 *           bo tam kafelkuje się po powierzchni i zdjęcie całej płyty
 *           wyglądałoby jak tapeta w płyty.
 *
 * Nazwy plików u dostawcy są nierówne (`_A_sl`, `-4`, `_zoom`, `ZOOM`),
 * więc zgadujemy po wzorcach, a wynik zapisujemy do pliku — żeby pobieranie
 * zdjęć (pobierz-wzory.mjs) było powtarzalne i nie wymagało przeglądarki.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const KARTY = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'karty-architype.json'), 'utf8'));

const naglowki = {
  'user-agent': 'k24h-kalkulator/1.0 (strona kamieniarstwa, zgoda dystrybutora)',
};

/** Slug karty → klucz w naszej mapie (bez kodu handlowego z przodu). */
function klucz(slug, zajete) {
  const kod = (slug.match(/^(\d+[a-z]?)-/i) || [])[1] || '';
  let k = slug
    .replace(/^\d+[a-z]?-/i, '')
    .replace(/-\d$/, '')
    .toLowerCase();
  // „1001 Blanche" i „1001L Blanche" to dwa różne dekory — rozróżnia je
  // litera w kodzie. Dokładamy ją dopiero przy kolizji, żeby nie psuć
  // nazw, które są jednoznaczne (8011H Nantes to po prostu „nantes").
  if (zajete.has(k) && kod) k += '-' + kod.slice(-1).toLowerCase();
  return k;
}

/*
 * ⚠ Karta dekoru pokazuje też KARUZELĘ INNYCH KAMIENI, więc w HTML-u leżą
 * zdjęcia cudzych płyt. Bez tego filtra Clermont dostawał slab Calacatty.
 * Zostawiamy pliki z folderu tego dekoru: poznajemy go po kodzie
 * handlowym ze slugu (7500, 1220) albo po nazwie w ścieżce.
 */
function tylkoTegoDekoru(pliki, slug) {
  const kod = (slug.match(/^(\d+[a-z]?)-/i) || [])[1] || '';
  const czlony = slug
    .replace(/^\d+[a-z]?-/i, '')
    .replace(/-\d$/, '')
    .split('-')
    .filter((c) => c.length > 2);

  return pliki.filter((p) => {
    const sciezka = decodeURIComponent(p).toLowerCase().replace(/[_\s-]+/g, ' ');
    if (kod && new RegExp(`(^|/)${kod.toLowerCase()}( |/)`).test(sciezka)) return true;
    return czlony.length > 0 && czlony.every((c) => sciezka.includes(c));
  });
}

/*
 * CAŁA PŁYTA. Dostawca nazywa ją na trzy sposoby, zależnie od rocznika
 * zdjęć: `_A_sl` / `_B_sl` (Keralini), `_R` (starsze Avant), `-4`
 * (nowsze Avant). Sprawdzone na zdjęciach: wszystkie trzy to płyta
 * na stojaku, od krawędzi do krawędzi.
 */
const wyborSlabu = (pliki) =>
  pliki.find((p) => /_A_sl\.jpg$/i.test(p)) ||
  pliki.find((p) => /_B_sl\.jpg$/i.test(p)) ||
  pliki.find((p) => /_sl\.jpg$/i.test(p)) ||
  pliki.find((p) => /_R\.jpg$/i.test(p)) ||
  pliki.find((p) => /-4\.jpg$/i.test(p)) ||
  null;

/** Zbliżenie struktury — zostaje teksturą na bryle 3D. */
const wyborZoomu = (pliki) =>
  pliki.find((p) => /zoom/i.test(p)) ||
  pliki.find((p) => /-1\.jpg$/i.test(p)) ||
  pliki.find((p) => !/_int|-2\.jpg$|-3\.jpg$/i.test(p)) ||
  null;

async function karta(url) {
  const odp = await fetch('https://architype.pl' + url, { headers: naglowki });
  if (!odp.ok) throw new Error(`HTTP ${odp.status}`);
  const html = await odp.text();
  const pliki = [...new Set([...html.matchAll(/stones\/[^"')\s]+\.jpg/gi)].map((m) => m[0]))];
  return pliki;
}

async function main() {
  const wynik = {};
  const braki = [];

  for (const [marka, adresy] of Object.entries(KARTY)) {
    wynik[marka] = {};
    const zajete = new Set();
    process.stdout.write(`${marka}: `);

    for (const adres of adresy) {
      const slug = adres.split('/colors/')[1];
      const k = klucz(slug, zajete);
      zajete.add(k);
      try {
        const wszystkie = await karta(adres);
        const pliki = tylkoTegoDekoru(wszystkie, slug);
        const slab = wyborSlabu(pliki);
        const zoom = wyborZoomu(pliki);
        if (!slab && !zoom) {
          braki.push(`${marka}/${k}: brak zdjęć`);
          process.stdout.write('x');
          continue;
        }
        wynik[marka][k] = {
          slab: slab ? slab.replace(/^stones\//, '') : null,
          zoom: zoom ? zoom.replace(/^stones\//, '') : null,
        };
        if (!slab) braki.push(`${marka}/${k}: brak zdjęcia całej płyty (zostaje zbliżenie)`);
        process.stdout.write(slab ? '.' : 'z');
      } catch (e) {
        braki.push(`${marka}/${k}: ${e.message}`);
        process.stdout.write('x');
      }
    }
    process.stdout.write('\n');
  }

  const plik = path.join(ROOT, 'scripts', 'wzory-architype.json');
  fs.writeFileSync(
    plik,
    JSON.stringify(
      {
        _info:
          'Zdjęcia wzorów z katalogu Architype (dystrybutor Keralini i Avant Quartz), ' +
          'za zgodą dystrybutora. GENEROWANE: node scripts/zbierz-wzory.mjs. ' +
          '`slab` = cała płyta (podgląd dla klienta), `zoom` = zbliżenie (tekstura 3D). ' +
          'Ścieżki względem https://architype.pl/media/images/<rozmiar>/stones/',
        ...wynik,
      },
      null,
      2
    ) + '\n',
    'utf8'
  );

  for (const marka of Object.keys(wynik)) {
    const ile = Object.keys(wynik[marka]).length;
    const zeSlabem = Object.values(wynik[marka]).filter((x) => x.slab).length;
    console.log(`✓ ${marka}: ${ile} dekorów, w tym ${zeSlabem} ze zdjęciem całej płyty`);
  }
  if (braki.length) {
    console.log(`\nUwagi (${braki.length}):`);
    for (const b of braki) console.log('  ·', b);
  }
}

main().catch((e) => {
  console.error('Nie udało się:', e);
  process.exit(1);
});

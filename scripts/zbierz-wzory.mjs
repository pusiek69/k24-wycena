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
import sharp from 'sharp';

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
 * CAŁA PŁYTA. Dostawca nazywa ją na kilkanaście sposobów, zależnie od
 * rocznika zdjęć i od tego, kto je wrzucał.
 *
 * PIERWSZE PIĘĆ WZORCÓW ZOSTAJE W TEJ SAMEJ KOLEJNOŚCI — one już raz
 * wybrały dobre zdjęcia dla 69 dekorów i nie wolno tego ruszyć, bo
 * podmieniłoby działające podglądy.
 *
 * Reszta to wzorce znalezione 27.11.2026 po zgłoszeniu Dawida („w avant
 * tez to popraw bo niektore maja miniaturki zdjec zamiast pelnego slabu
 * a na stronie architype sa pelne slaby"). Dekory ich nie dostawały nie
 * dlatego, że płyty nie ma, tylko dlatego, że nazywa się inaczej:
 *
 *   `_sl_v2` `_sl_v4` `_sl_mat` `_sl1` `_A_sl_v3`  — wersjonowany slab;
 *        stary wzorzec wymagał `_sl.jpg` NA KOŃCU nazwy i je omijał.
 *        To sama ta grupa to 8 dekorów Avant.
 *   `-plita` `_plita` `Plita-` `-Plita`            — rosyjskie „плита",
 *        czyli płyta, w trzech wariantach pisowni i po obu stronach nazwy.
 *   `_pl` `_pl-2n` `Pl-...`                        — skrót od tego samego.
 */
/*
 * RĘCZNE WSKAZANIE PŁYTY.
 *
 * Trzy dekory oszukały i nazwę, i kształt: dostawca wrzucił na kartę
 * zdjęcie kuchni w proporcji 16:9, a prawdziwa płyta leży pod nazwą,
 * której żaden wzorzec nie przewiduje. Sprawdzone okiem na arkuszu
 * kontrolnym (`arkusz-kandydatow.mjs`), 27.11.2026.
 *
 * Ta tabela ma pierwszeństwo przed wszystkim innym. Gdy rośnie — to znak,
 * że warto dopisać wzorzec, a nie kolejny wiersz.
 */
const SLAB_RECZNIE = {
  // `-1` i `-2` to kuchnie; płyta na stojaku leży pod samą nazwą dekoru.
  'keralini/absolute-white': 'Absolute-White.jpg',
  // `-1`..`-3` to płaskie zdjęcia materiału, `-4` i dalej to wnętrza.
  // Stary wzorzec `-4.jpg` brał właśnie kuchnię.
  'avant-quartz/patagonia-brive': '5900-Patagonia-Brive-1.jpg',
};

/*
 * `-4.jpg` TYLKO NA KRÓTKIEJ KARCIE.
 *
 * To była cicha wpadka pierwszej wersji (zgłoszona przez Dawida 27.11.2026:
 * „niektore maja miniaturki zdjec zamiast pelnego slabu"). Na starych
 * kartach Avant zdjęcia są cztery i czwarte jest płytą — stąd ta reguła.
 * Na nowszych kartach zdjęć jest pięć do piętnastu i `-4` to po prostu
 * czwarta aranżacja kuchni. Regułą `-4` szło 20 dekorów: 5 dobrze
 * (karty 4-zdjęciowe) i 15 źle (karty dłuższe). Sprawdzone zdjęcie po
 * zdjęciu na arkuszu kontrolnym.
 *
 * Dlatego bierzemy `-4` wyłącznie wtedy, gdy jest OSTATNIM z czterech.
 */
const wyborSlabu = (pliki) =>
  pliki.find((p) => /_A_sl\.jpg$/i.test(p)) ||
  pliki.find((p) => /_B_sl\.jpg$/i.test(p)) ||
  pliki.find((p) => /_sl\.jpg$/i.test(p)) ||
  pliki.find((p) => /_R\.jpg$/i.test(p)) ||
  (pliki.length === 4 ? pliki.find((p) => /-4\.jpg$/i.test(p)) : null) ||
  // wersjonowane: _A_sl_v3, _sl_v2, _sl_mat, _sl1
  pliki.find((p) => /_A_sl[_\d]/i.test(p)) ||
  pliki.find((p) => /_B_sl[_\d]/i.test(p)) ||
  pliki.find((p) => /_sl[_\d]/i.test(p)) ||
  // „płyta" po rosyjsku, w dowolnej pisowni i po dowolnej stronie nazwy
  pliki.find((p) => /plita/i.test(p)) ||
  // skrót `pl` — tylko jako wyraźny człon, żeby nie łapać „Plateau”
  pliki.find((p) => /[-_]pl([-_.]|\.jpg$)/i.test(p)) ||
  pliki.find((p) => /\/pl-/i.test(p)) ||
  null;

/*
 * OSTATNIA DESKA RATUNKU: nazwa nic nie mówi.
 *
 * Część kart ma same ponumerowane zdjęcia (`9030 Royal Beige (1..5)`,
 * `Taj-Mahal1..7`, `14.jpg` obok `14 detal.jpg`). Wtedy nie zgadujemy —
 * mierzymy. Płyta na stojaku jest wyraźnie szersza niż wyższa (zwykle
 * 16:9 albo 2:1); zbliżenie struktury i zdjęcie wnętrza takie nie są.
 *
 * Bierzemy najszersze zdjęcie o proporcji co najmniej 1,5, z pominięciem
 * tego, co już wiemy, że płytą nie jest.
 */
const NIE_PLYTA = /zoom|_int|detal|[-_]int\d|inter/i;

async function slabPoKsztalcie(pliki, zmierz) {
  const kandydaci = pliki.filter((p) => !NIE_PLYTA.test(p)).slice(0, 8);
  let najlepszy = null;
  for (const p of kandydaci) {
    const wym = await zmierz(p);
    if (!wym || !wym.width || !wym.height) continue;
    const proporcja = wym.width / wym.height;
    if (proporcja < 1.5) continue;
    if (!najlepszy || wym.width > najlepszy.width) najlepszy = { plik: p, ...wym, proporcja };
  }
  return najlepszy;
}

/** Zbliżenie struktury — zostaje teksturą na bryle 3D. */
const wyborZoomu = (pliki) =>
  pliki.find((p) => /zoom/i.test(p)) ||
  pliki.find((p) => /-1\.jpg$/i.test(p)) ||
  pliki.find((p) => !/_int|-2\.jpg$|-3\.jpg$/i.test(p)) ||
  null;

/**
 * Wymiary zdjęcia bez zapisywania go na dysk — do rozpoznawania płyty
 * po kształcie. Wariant 1920 to u Architype największy, jaki serwer daje
 * (sprawdzone: 2560 i 3840 zwracają 404, a `/stones/...` bez `/media/images/`
 * oddaje stronę HTML, nie obraz).
 */
const zmierzone = new Map();
async function zmierz(sciezka) {
  if (zmierzone.has(sciezka)) return zmierzone.get(sciezka);
  let wynik = null;
  try {
    // Ścieżki ze strony są już zakodowane (`Avant%20Quartz`) — doklejamy je
    // tak, jak robi to `pobierz-wzory.mjs`. Kodowanie ich drugi raz dawało
    // `%2520` i ciche 404, przez co pomiar nigdy nie wystartował.
    const odp = await fetch('https://architype.pl/media/images/1920/' + sciezka, { headers: naglowki });
    if (odp.ok) {
      const buf = Buffer.from(await odp.arrayBuffer());
      const m = await sharp(buf).metadata();
      wynik = { width: m.width, height: m.height };
    }
  } catch {
    wynik = null;
  }
  zmierzone.set(sciezka, wynik);
  return wynik;
}

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
        const reczny = SLAB_RECZNIE[`${marka}/${k}`];
        let slab = reczny ? pliki.find((p) => decodeURIComponent(p).endsWith(reczny)) || null : null;
        if (reczny && !slab) braki.push(`${marka}/${k}: ręcznie wskazane „${reczny}" NIE MA na karcie`);
        if (!slab) slab = wyborSlabu(pliki);
        let zmierzony = null;
        if (!slab) {
          zmierzony = await slabPoKsztalcie(pliki, zmierz);
          if (zmierzony) {
            slab = zmierzony.plik;
            braki.push(
              `${marka}/${k}: płytę rozpoznano po kształcie (${zmierzony.width}×${zmierzony.height}), nie po nazwie`
            );
          }
        }
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

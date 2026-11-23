/**
 * ZDJĘCIA WZORÓW KAMIENIA — pobranie i przygotowanie plików
 *
 *   node scripts/pobierz-wzory.mjs            — pobiera brakujące
 *   node scripts/pobierz-wzory.mjs --od-nowa  — pobiera wszystko od nowa
 *
 * Źródła zebrane wcześniej: `node scripts/zbierz-wzory.mjs`.
 *
 * Z każdego dekoru robimy trzy pliki, bo trzy różne zastosowania:
 *
 *   <klucz>-slab.webp   CAŁA PŁYTA w naturalnych proporcjach (szeroki
 *                       prostokąt, płyta na stojaku) — to widzi klient po
 *                       najechaniu i po kliknięciu lupki. Widać przebieg
 *                       żyły od krawędzi do krawędzi.
 *   <klucz>.webp        zbliżenie struktury, przycięte do kwadratu —
 *                       tekstura na bryle 3D, która kafelkuje się po
 *                       powierzchni (cała płyta wyglądałaby tam jak
 *                       tapeta w płyty).
 *   <klucz>-mini.webp   96 px — kropka przy nazwie dekoru.
 *
 * Zdjęcia pochodzą z katalogu Architype (dystrybutor Keralini i Avant
 * Quartz), za zgodą dystrybutora, i leżą U NAS: nie podłączamy się do
 * ich serwera przy każdym wejściu klienta.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const KATALOG = path.join(ROOT, 'public', 'wzory');
const ZRODLA = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'wzory-architype.json'), 'utf8'));
const ODNOWA = process.argv.includes('--od-nowa');
const MARKI = ['keralini', 'avant-quartz'];

/*
 * Wariant 1920 px. W mniejszym (540) część zdjęć jest tak skompresowana,
 * że zostaje z nich jednolita plama. Gdy większego nie ma — schodzimy niżej.
 */
const WARIANTY = [
  'https://architype.pl/media/images/1920/stones/',
  'https://architype.pl/media/images/540/stones/',
];

/*
 * LITERÓWKI PO STRONIE DOSTAWCY. W cenniku mamy „Sorbona" i „Patagonia
 * Martinica", a w katalogu zdjęć leżą jako „sorbonne" i „mortinica".
 * Jedna linijka na przypadek — lepsze to niż dwa dekory bez zdjęcia.
 */
const ALIASY = {
  sorbona: 'sorbonne',
  'patagonia-martinica': 'patagonia-mortinica',
};

/** Wykończenia i znaczniki doklejane do nazw w cenniku. */
const KONCOWKI = /\s+(naturale|levigato|structured|leather|fulbody|fullbody|mat|polerowany|new)$/i;

const slug = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Nazwa z cennika → możliwe klucze w katalogu dostawcy. */
function kandydaci(nazwa) {
  const warianty = new Set();
  const n = String(nazwa).trim();
  warianty.add(slug(n));
  let bez = n;
  for (let i = 0; i < 3; i++) {
    const krotsza = bez.replace(KONCOWKI, '').trim();
    if (krotsza === bez) break;
    bez = krotsza;
    warianty.add(slug(bez));
  }
  warianty.add(slug(n.replace(/\b(fulbody|fullbody|new|a\+b)\b/gi, '')));
  for (const w of [...warianty]) if (ALIASY[w]) warianty.add(ALIASY[w]);
  return [...warianty].filter(Boolean);
}

async function pobierz(sciezka) {
  let ostatni = 'brak wariantu';
  for (const baza of WARIANTY) {
    try {
      const odp = await fetch(baza + sciezka, {
        headers: { 'user-agent': 'k24h-kalkulator/1.0 (strona kamieniarstwa, zgoda dystrybutora)' },
      });
      if (odp.ok) return Buffer.from(await odp.arrayBuffer());
      ostatni = `HTTP ${odp.status}`;
    } catch (e) {
      ostatni = e.message;
    }
  }
  throw new Error(ostatni);
}

/** Zapis z dociśnięciem, gdy plik wyszedł cięższy niż limit. */
async function zapisz(dane, plik, { szer, wys, kadr, limitKB }) {
  const przygotuj = (jakosc) => {
    const obraz = sharp(dane);
    return (
      kadr
        ? obraz.resize(szer, wys, { fit: 'cover', position: 'centre' })
        : obraz.resize({ width: szer, withoutEnlargement: true })
    )
      .webp({ quality: jakosc })
      .toFile(plik);
  };
  await przygotuj(78);
  if (fs.statSync(plik).size > limitKB * 1024) await przygotuj(58);
}

async function main() {
  fs.mkdirSync(KATALOG, { recursive: true });

  const mapa = {};
  let pobrane = 0;
  let pominiete = 0;
  const bledy = [];

  for (const marka of MARKI) {
    const zrodla = ZRODLA[marka] || {};
    const katalogMarki = path.join(KATALOG, marka);
    fs.mkdirSync(katalogMarki, { recursive: true });
    mapa[marka] = {};
    process.stdout.write(`${marka}: `);

    for (const [klucz, zrodlo] of Object.entries(zrodla)) {
      const tekstura = path.join(katalogMarki, `${klucz}.webp`);
      const mini = path.join(katalogMarki, `${klucz}-mini.webp`);
      const slab = path.join(katalogMarki, `${klucz}-slab.webp`);

      const juzJest =
        fs.existsSync(tekstura) && fs.existsSync(mini) && (!zrodlo.slab || fs.existsSync(slab));
      if (!ODNOWA && juzJest) {
        pominiete++;
        mapa[marka][klucz] = { slab: fs.existsSync(slab) };
        continue;
      }

      try {
        // Zbliżenie: kwadratowy kadr ze środka — tekstura kafelkuje się
        // po bryle, więc interesuje nas sam rysunek kamienia.
        const daneZoom = await pobierz(zrodlo.zoom || zrodlo.slab);
        await zapisz(daneZoom, tekstura, { szer: 640, wys: 640, kadr: true, limitKB: 110 });
        await zapisz(daneZoom, mini, { szer: 96, wys: 96, kadr: true, limitKB: 12 });

        // Cała płyta: BEZ kadrowania. Proporcje zdjęcia zostają, bo to one
        // pokazują, że patrzymy na płytę, a nie na jej wycinek.
        let maSlab = false;
        if (zrodlo.slab) {
          const daneSlab = await pobierz(zrodlo.slab);
          await zapisz(daneSlab, slab, { szer: 1400, kadr: false, limitKB: 220 });
          maSlab = true;
        } else if (fs.existsSync(slab)) {
          fs.unlinkSync(slab);
        }

        mapa[marka][klucz] = { slab: maSlab };
        pobrane++;
        process.stdout.write(maSlab ? '.' : 'z');
      } catch (e) {
        bledy.push(`${marka}/${klucz}: ${e.message}`);
        process.stdout.write('x');
      }
    }
    process.stdout.write('\n');
  }

  /* ---------- mapowanie dekorów z cennika na pliki ---------- */

  const przypisane = {};
  const bezZdjecia = [];

  for (const marka of MARKI) {
    const katalog = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'src', 'generated', `${marka}.dekory.json`), 'utf8')
    );
    przypisane[marka] = {};

    for (const nazwa of Object.keys(katalog.dekory)) {
      const trafiony = kandydaci(nazwa).find((k) => mapa[marka][k]);
      if (trafiony) przypisane[marka][nazwa] = { k: trafiony, slab: !!mapa[marka][trafiony].slab };
      else bezZdjecia.push(`${marka}: ${nazwa}`);
    }
  }

  const tresc = `/**
 * WZORY KAMIENIA — mapa „dekor z cennika → pliki ze zdjęciami".
 *
 * ⚠ PLIK GENEROWANY: node scripts/pobierz-wzory.mjs
 *   Ręczne zmiany przepadną przy następnym uruchomieniu.
 *
 * Zdjęcia: katalog Architype (dystrybutor Keralini i Avant Quartz),
 * za zgodą dystrybutora. Leżą w public/wzory/<marka>/:
 *   <klucz>-slab.webp  CAŁA PŁYTA (podgląd dla klienta),
 *   <klucz>.webp       zbliżenie w kwadracie (tekstura na bryle 3D),
 *   <klucz>-mini.webp  kropka przy nazwie dekoru.
 *
 * Z tej mapy korzystają OBA kalkulatory: umywalki i blaty.
 */
export const WZORY = ${JSON.stringify(przypisane, null, 2)};

/**
 * Ścieżka do zdjęcia wzoru albo \`null\`, gdy go nie mamy.
 * @param {string} marka
 * @param {string} dekor
 * @param {'tekstura'|'mini'|'slab'} [rodzaj]
 */
export function plikWzoru(marka, dekor, rodzaj = 'tekstura') {
  const wpis = WZORY[marka]?.[dekor];
  if (!wpis) return null;
  if (rodzaj === 'mini') return \`/wzory/\${marka}/\${wpis.k}-mini.webp\`;
  // Gdy dostawca nie ma zdjęcia całej płyty, podgląd pokazuje zbliżenie —
  // lepsze to niż puste miejsce, a strukturę kamienia widać tak czy tak.
  if (rodzaj === 'slab') return \`/wzory/\${marka}/\${wpis.k}\${wpis.slab ? '-slab' : ''}.webp\`;
  return \`/wzory/\${marka}/\${wpis.k}.webp\`;
}

/** Czy dla tego dekoru mamy zdjęcie CAŁEJ płyty, a nie tylko zbliżenie. */
export function maCalaPlyte(marka, dekor) {
  return !!WZORY[marka]?.[dekor]?.slab;
}
`;

  fs.writeFileSync(path.join(ROOT, 'src', 'generated', 'wzory-dekorow.js'), tresc, 'utf8');

  const ile = (m) => Object.keys(przypisane[m] || {}).length;
  const zeSlabem = (m) => Object.values(przypisane[m] || {}).filter((x) => x.slab).length;
  console.log(`\n✓ pobrane: ${pobrane}, już były: ${pominiete}, błędy: ${bledy.length}`);
  for (const m of MARKI) {
    console.log(`✓ ${m}: ${ile(m)} dekorów ze zdjęciem, w tym ${zeSlabem(m)} z całą płytą`);
  }
  if (bezZdjecia.length) {
    console.log(`\nBez zdjęcia (tekstura rysowana, bez podglądu) — ${bezZdjecia.length}:`);
    for (const b of bezZdjecia) console.log('  ·', b);
  }
  if (bledy.length) {
    console.log('\nBłędy pobierania:');
    for (const b of bledy) console.log('  ·', b);
  }
}

main().catch((e) => {
  console.error('Nie udało się:', e);
  process.exit(1);
});

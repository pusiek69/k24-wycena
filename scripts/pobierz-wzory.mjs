/**
 * ZDJĘCIA WZORÓW KAMIENIA DO PODGLĄDU 3D UMYWALKI
 *
 *   node scripts/pobierz-wzory.mjs            — pobiera brakujące
 *   node scripts/pobierz-wzory.mjs --od-nowa  — pobiera wszystko od nowa
 *
 * Bryła umywalki ma pokazywać PRAWDZIWY wzór wybranego kamienia, a nie
 * wygenerowaną imitację (polecenie Dawida, 23.11.2026). Zdjęcia pochodzą
 * z katalogu Architype — dystrybutora Keralini i Avant Quartz, z którym
 * Dawid współpracuje i który zgodził się na ich użycie.
 *
 * ZASADA: zdjęcia leżą U NAS. Nie podłączamy się do serwera dostawcy przy
 * każdym wejściu klienta — ani im nie generujemy ruchu, ani nie ryzykujemy,
 * że pewnego dnia zmienią ścieżki i strona zostanie bez wzorów.
 *
 * Z każdego zdjęcia robimy dwa pliki:
 *   • `<slug>.webp`      640 px — tekstura na bryłę 3D,
 *   • `<slug>-mini.webp`  96 px — kropka na kafelku wyboru kamienia.
 *
 * Na koniec skrypt wypisuje `src/umywalka/wzory-dekorow.js` — mapę
 * „dekor z cennika → plik", budowaną przez porównanie nazw. Dekory bez
 * zdjęcia zostają przy teksturze proceduralnej i są wypisane na konsoli.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const KATALOG = path.join(ROOT, 'public', 'wzory');
/*
 * Wariant 1920 px. W mniejszym (540) część zdjęć jest tak skompresowana,
 * że zostaje z nich jednolita plama — Calacatta Oro wychodziła szarym
 * prostokątem bez żyły. Gdy większego wariantu nie ma, schodzimy do 540.
 */
const WARIANTY = ['https://architype.pl/media/images/1920/stones/', 'https://architype.pl/media/images/540/stones/'];
const ZRODLA = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'wzory-architype.json'), 'utf8'));
const ODNOWA = process.argv.includes('--od-nowa');

/** Nasze marki → klucz w pliku źródeł. */
const MARKI = ['keralini', 'avant-quartz'];

/** Wykończenia i znaczniki, które doklejamy do nazw w cenniku. */
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
  let n = String(nazwa).trim();
  warianty.add(slug(n));
  // „Absolute Black Structured" → „Absolute Black"
  let bez = n;
  for (let i = 0; i < 3; i++) {
    const krotsza = bez.replace(KONCOWKI, '').trim();
    if (krotsza === bez) break;
    bez = krotsza;
    warianty.add(slug(bez));
  }
  // „Pandora FULBODY Naturale" → „Pandora"
  warianty.add(slug(n.replace(/\b(fulbody|fullbody|new|a\+b)\b/gi, '')));
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

    for (const [klucz, sciezka] of Object.entries(zrodla)) {
      const plik = path.join(katalogMarki, `${klucz}.webp`);
      const mini = path.join(katalogMarki, `${klucz}-mini.webp`);

      if (!ODNOWA && fs.existsSync(plik) && fs.existsSync(mini)) {
        pominiete++;
        mapa[marka][klucz] = true;
        continue;
      }

      try {
        const dane = await pobierz(sciezka);
        // Kwadrat ze środka zdjęcia: tekstura ma się kafelkować na bryle,
        // więc interesuje nas sam rysunek kamienia, nie proporcje zdjęcia.
        await sharp(dane).resize(640, 640, { fit: 'cover', position: 'centre' }).webp({ quality: 76 }).toFile(plik);
        // Wzory o gęstym rysunku (np. Epiphany) potrafią wyjść dwa razy
        // cięższe od reszty — takie dociskamy, żeby żaden nie przekroczył
        // ~110 kB. Na teksturze kamienia tej różnicy nie widać.
        if (fs.statSync(plik).size > 110 * 1024) {
          await sharp(dane).resize(640, 640, { fit: 'cover', position: 'centre' }).webp({ quality: 58 }).toFile(plik + '.tmp');
          fs.renameSync(plik + '.tmp', plik);
        }
        await sharp(dane).resize(96, 96, { fit: 'cover', position: 'centre' }).webp({ quality: 70 }).toFile(mini);
        mapa[marka][klucz] = true;
        pobrane++;
        process.stdout.write('.');
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
      if (trafiony) przypisane[marka][nazwa] = trafiony;
      else bezZdjecia.push(`${marka}: ${nazwa}`);
    }
  }

  const naglowek = `/**
 * WZORY KAMIENIA — mapa „dekor z cennika → plik ze zdjęciem".
 *
 * ⚠ PLIK GENEROWANY: node scripts/pobierz-wzory.mjs
 *   Ręczne zmiany przepadną przy następnym uruchomieniu.
 *
 * Zdjęcia: katalog Architype (dystrybutor Keralini i Avant Quartz),
 * za zgodą dystrybutora. Leżą w public/wzory/<marka>/<klucz>.webp
 * (tekstura 640 px) oraz -mini.webp (kropka na kafelku, 96 px).
 *
 * Z tej mapy korzystają OBA kalkulatory: umywalki (tekstura na bryle 3D)
 * i blaty (miniaturka przy dekorze oraz podgląd całej płyty).
 */
`;

  const tresc =
    naglowek +
    `export const WZORY = ${JSON.stringify(przypisane, null, 2)};\n\n` +
    `/** Ścieżka do tekstury wzoru albo \`null\`, gdy zdjęcia nie mamy. */\n` +
    `export function plikWzoru(marka, dekor, mini = false) {\n` +
    `  const klucz = WZORY[marka]?.[dekor];\n` +
    `  if (!klucz) return null;\n` +
    `  return \`/wzory/\${marka}/\${klucz}\${mini ? '-mini' : ''}.webp\`;\n` +
    `}\n`;

  fs.writeFileSync(path.join(ROOT, 'src', 'generated', 'wzory-dekorow.js'), tresc, 'utf8');

  const ile = (m) => Object.keys(przypisane[m] || {}).length;
  console.log(`\n✓ pobrane: ${pobrane}, już były: ${pominiete}, błędy: ${bledy.length}`);
  console.log(`✓ dekory ze zdjęciem wzoru: keralini ${ile('keralini')}, avant-quartz ${ile('avant-quartz')}`);
  if (bezZdjecia.length) {
    console.log(`\nBez zdjęcia (zostają przy teksturze rysowanej) — ${bezZdjecia.length}:`);
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

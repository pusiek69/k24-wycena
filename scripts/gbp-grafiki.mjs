/**
 * GRAFIKI DO WIZYTÓWKI GOOGLE (Google Business Profile).
 *
 * Zlecenie Dawida (27.08.2026): na wizytówce „Kamieniarstwo 24h Dawid Ząbek"
 * stoi jeszcze okładka z nagrobkiem i logo „Centrum Pogrzebowe Jan Ząbek" —
 * ma to zniknąć. Robimy dwa pliki w stylu serwisu i wrzucamy je do
 * /realizacje/ (tam działa CORS, więc Google je pobierze).
 *
 *   npm run gbp
 *
 * Skąd wymiary: Google przycina logo do KOŁA, więc znak musi zmieścić się
 * w okręgu wpisanym w kwadrat 720×720 — stąd margines i rezygnacja z ramki
 * przy krawędzi. Okładka ma proporcje 16:9 (min. 1024×576 wg Google).
 */
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const p = (...a) => path.join(ROOT, ...a);

const TLO = '#13110f';   // ta sama czerń, co og-k24h.png
const ZLOTO = '#dcb64e';   // jaśniejsze niż złoto ze strony — pod spodem jest jasny kamień

/* ── LOGO 720×720 ───────────────────────────────────────────────────── */

// Oryginał to znak „K" + „K24H.pl" + podpis „Dawid Ząbek". Podpisu NIE
// bierzemy: w wizytówce logo pokazuje się często jako kółko ~60 px i pismo
// odręczne zamienia się tam w plamę. Znak i „K24H.pl" czytają się do końca.
const ZNAK_WYSOKOSC = 510;   // z 600 px oryginału — obcinamy sam podpis

async function logo() {
  const znak = await sharp(p('assets-zrodla', 'logo-k24h-oryginal.png'))
    .extract({ left: 0, top: 0, width: 471, height: ZNAK_WYSOKOSC })
    .resize({ height: 500 })
    .toBuffer();

  const tlo = Buffer.from(`<svg width="720" height="720" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="g" cx="50%" cy="38%" r="72%">
        <stop offset="0%" stop-color="#1e1915"/>
        <stop offset="100%" stop-color="${TLO}"/>
      </radialGradient>
    </defs>
    <rect width="720" height="720" fill="url(#g)"/>
  </svg>`);

  const { width } = await sharp(znak).metadata();
  await sharp(tlo)
    .composite([{ input: znak, left: Math.round((720 - width) / 2), top: 110 }])
    .png()
    .toFile(p('public', 'realizacje', 'gbp-logo.png'));
  console.log('✓ gbp-logo.png 720×720');
}

/* ── OKŁADKA 1600×900 ───────────────────────────────────────────────── */

// Zdjęcie z realizacji, kadr NAD wklejką z płytą i paskiem podpisu — te
// dwa elementy Dawid wypala w zdjęciach do galerii, ale na okładce
// wizytówki wyglądałyby jak kolaż. Kadr 1191×670 to dokładnie 16:9.
const ZDJECIE = 'konglomerat-calacatta-aveyron.jpg';
const KADR = { left: 0, top: 0, width: 1191, height: 670 };

async function okladka() {
  const foto = await sharp(p('public', 'realizacje', ZDJECIE))
    .extract(KADR)
    .resize(1600, 900, { kernel: 'lanczos3' })
    .toBuffer();

  // Delikatna poświata u dołu — żeby podpis miał się na czym oprzeć,
  // a zdjęcie nie zrobiło się ciemne. Google potrafi przyciąć okładkę
  // w pionie, więc podpis stoi z zapasem od krawędzi.
  const napis = Buffer.from(`<svg width="1600" height="900" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="c" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#000" stop-opacity="0"/>
        <stop offset="100%" stop-color="#000" stop-opacity="0.72"/>
      </linearGradient>
    </defs>
    <rect x="0" y="500" width="1600" height="400" fill="url(#c)"/>
    <text x="86" y="782" font-family="Georgia, 'Times New Roman', serif" font-size="52"
          fill="#ffffff">Blaty kuchenne z kamienia</text>
    <text x="86" y="828" font-family="Arial, Helvetica, sans-serif" font-size="25"
          letter-spacing="3.2" fill="${ZLOTO}">TARNOBRZEG &#183; KAMIENIARSTWO 24H</text>
  </svg>`);

  await sharp(foto)
    .composite([{ input: napis, top: 0, left: 0 }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(p('public', 'realizacje', 'gbp-okladka.jpg'));
  console.log('✓ gbp-okladka.jpg 1600×900');
}

await logo();
await okladka();

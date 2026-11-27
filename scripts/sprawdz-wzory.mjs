/**
 * AUDYT ZDJĘĆ DEKORÓW — który plik jest prawdziwą płytą, a który wycinkiem.
 *
 * Płyta kamienna ma proporcje mniej więcej 2:1 (320 × 160 cm). Wycinek wzoru
 * albo miniaturka z listy bywa kwadratem. Ten skrypt mierzy, co naprawdę
 * leży na dysku — niezależnie od tego, jak plik się nazywa.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WZORY = path.join(ROOT, 'public/wzory');

const { WZORY: MAPA } = await import('file://' + path.join(ROOT, 'src/generated/wzory-dekorow.js'));

const wynik = [];

for (const marka of ['avant-quartz', 'keralini']) {
  const dekory = MAPA[marka] || {};
  for (const [nazwa, v] of Object.entries(dekory)) {
    const plikSlab = v.slab ? path.join(WZORY, marka, `${v.k}-slab.webp`) : null;
    const plikTekst = path.join(WZORY, marka, `${v.k}.webp`);

    let wym = null;
    let bajty = 0;
    if (plikSlab && fs.existsSync(plikSlab)) {
      const m = await sharp(plikSlab).metadata();
      wym = { w: m.width, h: m.height };
      bajty = fs.statSync(plikSlab).size;
    }

    wynik.push({
      marka,
      nazwa,
      kod: v.k,
      maSlab: !!v.slab,
      plikIstnieje: !!(plikSlab && fs.existsSync(plikSlab)),
      w: wym?.w ?? null,
      h: wym?.h ?? null,
      proporcja: wym ? Math.round((wym.w / wym.h) * 100) / 100 : null,
      kb: Math.round(bajty / 1024),
      maTeksture: fs.existsSync(plikTekst),
    });
  }
}

const zeSlabem = wynik.filter((x) => x.plikIstnieje);
const bezSlabu = wynik.filter((x) => !x.plikIstnieje);

console.log('=== PODSUMOWANIE ===');
console.log('dekorow razem      :', wynik.length);
console.log('ma plik -slab      :', zeSlabem.length);
console.log('BEZ pliku -slab    :', bezSlabu.length, '(podglad pokazuje wycinek/teksture)');

// Płyta to ~2:1. Wszystko ponizej 1,5 traktujemy jako podejrzane.
const podejrzane = zeSlabem.filter((x) => x.proporcja < 1.5);
console.log('slab o proporcji <1,5 (podejrzany wycinek):', podejrzane.length);

console.log('\n=== ROZKLAD PROPORCJI ISTNIEJACYCH SLABOW ===');
const kubelki = {};
for (const x of zeSlabem) {
  const k = x.proporcja < 1.2 ? 'kwadrat (<1,2)'
    : x.proporcja < 1.5 ? '1,2-1,5'
    : x.proporcja < 1.8 ? '1,5-1,8'
    : x.proporcja < 2.2 ? '1,8-2,2 (plyta)'
    : '>2,2';
  kubelki[k] = (kubelki[k] || 0) + 1;
}
for (const [k, v] of Object.entries(kubelki)) console.log(' ', k.padEnd(18), v);

console.log('\n=== SZEROKOSCI ===');
const szer = {};
for (const x of zeSlabem) { szer[x.w] = (szer[x.w] || 0) + 1; }
for (const [k, v] of Object.entries(szer).sort((a, b) => b[1] - a[1])) console.log(' ', String(k).padStart(5), 'px →', v, 'plikow');

if (podejrzane.length) {
  console.log('\n=== PODEJRZANE (proporcja < 1,5) ===');
  for (const x of podejrzane) console.log(' ', x.marka, '|', x.nazwa, '|', `${x.w}x${x.h}`, `(${x.proporcja})`, x.kb + 'kB');
}

console.log('\n=== BEZ PELNEGO SLABU ===');
for (const m of ['avant-quartz', 'keralini']) {
  const l = bezSlabu.filter((x) => x.marka === m);
  console.log(` ${m} (${l.length}):`);
  for (const x of l) console.log('   -', x.nazwa, '| kod', x.kod, '| tekstura:', x.maTeksture ? 'jest' : 'BRAK');
}

fs.writeFileSync(
  path.join(ROOT, 'audyt-wzorow.json'),
  JSON.stringify(wynik, null, 1)
);
console.log('\nzapisano audyt-wzorow.json');

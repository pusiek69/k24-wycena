/**
 * SZUKANIE PEŁNYCH PŁYT DLA DEKORÓW, KTÓRE ICH NIE DOSTAŁY
 *
 *   node scripts/szukaj-brakujacych-slabow.mjs
 *
 * Zgłoszenie Dawida (27.11.2026): „w avant tez to popraw bo niektore maja
 * miniaturki zdjec zamiast pelnego slabu a na stronie architype sa pelne slaby".
 *
 * Audyt (`sprawdz-wzory.mjs`) pokazał, że żaden POBRANY slab nie jest wycinkiem —
 * problem jest inny: 29 dekorów nie dostało slabu wcale i podgląd spada na
 * kwadratową teksturę. `zbierz-wzory.mjs` szukał pięciu wzorców nazw
 * (`_A_sl`, `_B_sl`, `_sl`, `_R`, `-4`) i tych dekorów po prostu nie rozpoznał.
 *
 * Ten skrypt wypisuje WSZYSTKIE zdjęcia z kart brakujących dekorów, żeby
 * zobaczyć, jak dostawca je tam nazwał — zamiast zgadywać dalej.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KARTY = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'karty-architype.json'), 'utf8'));
const { WZORY } = await import('file://' + path.join(ROOT, 'src/generated/wzory-dekorow.js'));

const naglowki = { 'user-agent': 'k24h-kalkulator/1.0 (strona kamieniarstwa, zgoda dystrybutora)' };

/** Dekory, które nie mają pliku -slab. */
const braki = [];
for (const marka of ['avant-quartz', 'keralini']) {
  for (const [nazwa, v] of Object.entries(WZORY[marka] || {})) {
    if (!v.slab) braki.push({ marka, nazwa, kod: v.k });
  }
}

/** Karta dekoru → lista zdjęć. Dopasowanie karty po kluczu z `zbierz-wzory`. */
function adresDla(marka, kod) {
  const lista = KARTY[marka] || [];
  return lista.find((u) => {
    const slug = u.split('/colors/')[1] || '';
    const bezKodu = slug.replace(/^\d+[a-z]?-/i, '').replace(/-\d$/, '').toLowerCase();
    return bezKodu === kod || slug.toLowerCase() === kod;
  });
}

const raport = [];
for (const b of braki) {
  const adres = adresDla(b.marka, b.kod);
  if (!adres) {
    raport.push({ ...b, adres: null, pliki: [], uwaga: 'nie znalazłem karty w katalogu' });
    continue;
  }
  try {
    const odp = await fetch('https://architype.pl' + adres, { headers: naglowki });
    const html = await odp.text();
    const pliki = [...new Set([...html.matchAll(/stones\/[^"')\s]+\.jpg/gi)].map((m) => decodeURIComponent(m[0])))];
    raport.push({ ...b, adres, pliki });
    process.stdout.write(pliki.length ? '.' : 'x');
  } catch (e) {
    raport.push({ ...b, adres, pliki: [], uwaga: e.message });
    process.stdout.write('!');
  }
}
process.stdout.write('\n\n');

for (const r of raport) {
  console.log(`--- ${r.marka} / ${r.nazwa} (kod ${r.kod})`);
  if (r.uwaga) console.log('    UWAGA:', r.uwaga);
  for (const p of r.pliki) console.log('   ', p.replace(/^stones\//, ''));
  if (!r.pliki.length && !r.uwaga) console.log('    (zero zdjęć na karcie)');
}

// Jakie końcówki w ogóle występują — stąd wezmą się nowe wzorce.
const koncowki = {};
for (const r of raport) {
  for (const p of r.pliki) {
    const k = (p.match(/([-_][A-Za-z0-9]+)\.jpg$/i) || [, '(inne)'])[1].toLowerCase();
    koncowki[k] = (koncowki[k] || 0) + 1;
  }
}
console.log('\n=== KOŃCÓWKI NAZW NA KARTACH BRAKUJĄCYCH DEKORÓW ===');
for (const [k, v] of Object.entries(koncowki).sort((a, b) => b[1] - a[1])) console.log(' ', k.padEnd(14), v);

fs.writeFileSync(path.join(ROOT, 'scripts', 'braki-slabow.json'), JSON.stringify(raport, null, 1));
console.log('\nzapisano scripts/braki-slabow.json');

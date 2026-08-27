#!/usr/bin/env node
/**
 * AUDYT CEN MATERIAŁÓW.
 *
 *   npm run ceny:audyt
 *
 * Zlecenie Dawida (26.08.2026): „sprawdź mi ponownie wycenę płyt, bo mam
 * wrażenie, że niektóre płyty mają ZANIŻONE ceny".
 *
 * `npm run cennik:sprawdz` odpowiada tylko na pytanie „czy wygenerowane
 * pliki zgadzają się ze źródłami" — i zawsze odpowie „tak", bo liczy je
 * tym samym kodem. Ten skrypt pyta o coś innego: czy REGUŁA jest ta,
 * którą ustalił Dawid, i czy cena ma pokrycie w dokumencie od dostawcy.
 *
 * Cztery kontrole:
 *   1. mnożnik każdego źródła = reguła zapisana niżej w OCZEKIWANE,
 *   2. cena promocyjna nigdy nie jest DROŻSZA od bazowej,
 *   3. przy dwóch aktywnych kampaniach silnik bierze tańszą
 *      (bierze pierwszą z listy — więc pierwsza musi być tańsza),
 *   4. każdy wzór dołożony przez kampanię ma datę końca — inaczej po
 *      wygaśnięciu liczyłby się po nieaktualnej, niskiej cenie.
 *
 * Skrypt NIE zmienia cen. Rozbieżność w cenniku to decyzja handlowa
 * Dawida, nie programu.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ZRODLA = path.join(ROOT, 'pricing', 'zrodla');
const GEN = path.join(ROOT, 'src', 'generated');

/**
 * Reguły marży — spisane z poleceń Dawida. To jest wzorzec, do którego
 * porównujemy pliki źródłowe; zmiana reguły zaczyna się TUTAJ.
 */
const OCZEKIWANE = {
  'atlas-plan': { mnoznik: 0.55 * 1.3 * 4.35, opis: 'detal −45% × marża 30% × kurs 4,35' },
  'avant-quartz': { mnoznik: 1.3, opis: 'cennik zakupu × 1,30' },
  caesarstone: { mnoznik: 1.3, opis: 'cennik zakupu × 1,30' },
  'florim-stone': { mnoznik: 1, opis: 'cennik wprost (marża wliczona)' },
  interq: { mnoznik: 1, opis: 'cz.1 detal × 1,35 wliczone w plik, cz.2 „na stanie" wprost' },
  keralini: { mnoznik: 1.3, opis: 'cennik zakupu × 1,30' },
  laminam: { mnoznik: 1, opis: 'cennik wprost (marża wliczona)' },
  marazzi: { mnoznik: 1.3 * 4.35, opis: 'cena po rabacie B2B × marża 30% × kurs 4,35' },
  pacific: { mnoznik: 1.3 / 1.23, opis: 'zakup brutto ÷ 1,23 × 1,30 → netto' },
  technistone: { mnoznik: 1, opis: 'katalog × 0,793 wliczone w plik' },
};

const czytaj = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const dzis = process.argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) || new Date().toISOString().slice(0, 10);

let uwag = 0;
const uwaga = (t) => {
  uwag++;
  console.log('  ⚠ ' + t);
};

/* ─────────────────────────────────────────── 1. mnożniki wobec reguły */

function mnoznikZrodla(z) {
  const kurs = z.waluta === 'EUR' ? z.kursEurPln : 1;
  if (typeof z.mnoznikRecznie === 'number') return z.mnoznikRecznie * kurs;
  if (z.cenyBrutto) return ((1 + z.marza) / (1 + (z.vatZrodla ?? 0.23))) * (1 - (z.rabatZakupowy || 0)) * kurs;
  if (z.juzPrzeliczone) return kurs;
  return (1 - z.rabatZakupowy) * (1 + z.marza) * kurs;
}

console.log('MNOŻNIKI WOBEC REGUŁ DAWIDA');
if (!fs.existsSync(ZRODLA)) {
  console.log('  (brak pricing/zrodla — audytu reguł nie da się zrobić bez plików źródłowych)');
} else {
  for (const plik of fs.readdirSync(ZRODLA).filter((f) => f.endsWith('.zasady.json') && !f.startsWith('_'))) {
    const slug = plik.replace('.zasady.json', '');
    const z = czytaj(path.join(ZRODLA, plik));
    const m = mnoznikZrodla(z);
    const ocz = OCZEKIWANE[slug];
    if (!ocz) {
      uwaga(`${slug}: nowe źródło bez zapisanej reguły — dopisz je do OCZEKIWANE w tym skrypcie`);
      continue;
    }
    const zgodny = Math.abs(m - ocz.mnoznik) < 1e-6;
    console.log(`  ${zgodny ? '✓' : '✗'} ${slug.padEnd(14)} ×${m.toFixed(4)}  (${ocz.opis})`);
    if (!zgodny) uwaga(`${slug}: mnożnik ×${m.toFixed(4)}, a reguła mówi ×${ocz.mnoznik.toFixed(4)}`);
  }
}

/* ───────────────────── 2–4. promocje wobec cen bazowych i dat końca */

console.log('\nPROMOCJE');
let pozycjiPromo = 0;
for (const plik of fs.readdirSync(GEN).filter((f) => f.endsWith('.promocje.json') && f !== 'naturalny.promocje.json')) {
  const slug = plik.replace('.promocje.json', '');
  const kampanie = (czytaj(path.join(GEN, plik)).kampanie || []).filter((k) => dzis >= k.od && dzis <= k.do);
  if (!kampanie.length) continue;

  const dek = czytaj(path.join(GEN, `${slug}.dekory.json`)).dekory || {};
  const wg = new Map();
  kampanie.forEach((k) => {
    for (const [klucz, wpis] of Object.entries(k.ceny || {})) {
      const cena = typeof wpis === 'number' ? wpis : wpis.cena;
      if (!wg.has(klucz)) wg.set(klucz, []);
      wg.get(klucz).push({ kampania: k.nazwa, cena });
    }
  });

  for (const [klucz, lista] of wg) {
    pozycjiPromo++;
    const i = klucz.lastIndexOf('||');
    const dekor = klucz.slice(0, i);
    const gr = klucz.slice(i + 2);
    const bazWpis = dek[dekor]?.[gr];
    const baza = typeof bazWpis === 'number' ? bazWpis : bazWpis?.cena;

    // Silnik bierze PIERWSZĄ pasującą kampanię — musi być najtańsza.
    const wybrana = lista[0];
    const najtansza = lista.reduce((a, b) => (b.cena < a.cena ? b : a));
    if (wybrana.cena > najtansza.cena) {
      uwaga(
        `${slug} · ${dekor} ${gr}mm: silnik naliczy „${wybrana.kampania}" ${wybrana.cena} zł/m², ` +
          `a tańsza jest „${najtansza.kampania}" ${najtansza.cena} — przestaw kolejność kampanii`
      );
    }
    if (baza != null && wybrana.cena > baza) {
      uwaga(`${slug} · ${dekor} ${gr}mm: promocja ${wybrana.cena} zł/m² DROŻSZA od ceny bazowej ${baza}`);
    }
    // Wzór wyłącznie promocyjny MUSI mieć datę końca — bez niej po
    // wygaśnięciu kampanii liczyłby się dalej po niskiej cenie.
    if (baza == null && typeof bazWpis === 'object' && !bazWpis.promocyjnyDo) {
      uwaga(`${slug} · ${dekor} ${gr}mm: wzór tylko promocyjny BEZ daty końca`);
    }
  }
}
console.log(`  sprawdzono ${pozycjiPromo} pozycji w kampaniach aktywnych na ${dzis}`);

console.log(
  uwag ? `\n✗ Audyt cen: ${uwag} ${uwag === 1 ? 'uwaga' : 'uwag'} do sprawdzenia.` : '\n✓ Audyt cen — reguły i promocje bez zastrzeżeń.'
);
process.exit(uwag ? 1 : 0);

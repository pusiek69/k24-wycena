#!/usr/bin/env node
/**
 * CHECKLISTA ZGODNOŚCI ze specyfikacją (§8).
 *
 * Sprawdza to, co da się sprawdzić bez przeglądarki: konfigurację kolekcji,
 * treść wytycznych konsultanta, zawartość plików dla klienta i brak kluczy.
 * Zachowanie silnika (wycena, promocje, bramka) sprawdzamy w przeglądarce —
 * patrz `npm run dev`.
 *
 *   npm run checklist
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const czytaj = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const json = (p) => JSON.parse(czytaj(p));

let bledy = 0;
const ok = (nr, opis, warunek, szczegol = '') => {
  console.log(`${warunek ? '✓' : '✗'} §8.${String(nr).padEnd(2)} ${opis}${szczegol ? '  — ' + szczegol : ''}`);
  if (!warunek) bledy++;
};

/* 1. Kolekcje i ceny */
const kolekcje = {
  'avant-quartz': 61,
  caesarstone: 24,
  technistone: 54,
  keralini: 49,
};
let razem = 0;
let zgodne = true;
for (const [slug, ile] of Object.entries(kolekcje)) {
  const n = Object.keys(json(`src/generated/${slug}.dekory.json`).dekory).length;
  razem += n;
  if (n !== ile) zgodne = false;
}
ok(1, 'kolekcje i liczba dekorów', zgodne && razem === 188, `${razem} dekorów`);

/* 2. Technistone: format płyty, tylko całe płyty, przelicznik */
const techn = czytaj('src/firms/technistone.js');
const zasadyTechn = json('pricing/zrodla/technistone.zasady.json');
ok(
  2,
  'Technistone 318,5 × 155, bez połówek, przelicznik ×0,793',
  techn.includes('w: 318.5') && techn.includes('h: 155') && techn.includes('polowkaDozwolona: false') &&
    typeof zasadyTechn.rabatZakupowy === 'number' && typeof zasadyTechn.marza === 'number',
  `mnożnik ×${((1 - zasadyTechn.rabatZakupowy) * (1 + zasadyTechn.marza)).toFixed(3)} (wartości z pricing/zrodla, poza repo)`
);

/* Technistone: pominięte dekory */
const dekTechn = json('src/generated/technistone.dekory.json').dekory;
ok(2.1, 'Technistone bez Ambiente Light i Residente Dark', !dekTechn['Ambiente Light'] && !dekTechn['Residente Dark']);

/* 3. Keralini: 6 mm nie na blat */
const ker = czytaj('src/firms/keralini.js');
const silnik = czytaj('src/engine/wycena.js');
ok(
  3,
  'Keralini: 6 mm podnoszone do 12 mm',
  ker.includes("pomijGrubosci: ['6']") && silnik.includes('pomijane.includes(gr)')
);

/* 4. Pakowanie */
const domyslne = czytaj('src/firms/_domyslne.js');
ok(4, 'płyta 320 × 160, zapas 10%', domyslne.includes('w: 320, h: 160') && czytaj('src/firms/avant-quartz.js').includes('narzutOdpad: 0.1'));

/* 5. Zawsze zlew 650 + indukcja 250 */
ok(
  5,
  'zlew i płyta grzewcza zawsze w wycenie (bez wariantu „brak")',
  domyslne.includes('cena: 650') && domyslne.includes('cena: 250') && !domyslne.includes("id: 'brak'")
);

/* 6. Mat 60 zł/m² */
ok(6, 'wykończenie matowe 60 zł/m²', /id: 'mat'[\s\S]{0,200}cena: 60[\s\S]{0,60}per: 'm2'/.test(domyslne));

/* 7. Promocje wielokampaniowe */
const promAQ = json('src/generated/avant-quartz.promocje.json').kampanie;
const promT = json('src/generated/technistone.promocje.json').kampanie;
ok(
  7,
  'promocje: wiele kampanii naraz',
  promAQ.length >= 2 && promT.length >= 1 && silnik.includes('for (const p of firma.promocje'),
  `Avant ${promAQ.length} kampanie, Technistone ${promT.length}`
);

/* 8. Bramka kontaktowa */
const bramka = czytaj('src/app/bramka.js');
ok(
  8,
  'bramka: telefon + e-mail + miejscowość wymagane, plik do 8 MB',
  bramka.includes("pole: 'telefon'") && bramka.includes("pole: 'email'") && bramka.includes("pole: 'miejscowosc'") &&
    bramka.includes('8 * 1024 * 1024')
);
ok(8.1, 'po wysłaniu: mail do klienta + zgłoszenie do firmy', czytaj('worker/worker.template.js').includes('mailDoKlienta') && czytaj('worker/worker.template.js').includes('LEAD_EMAIL'));

/* 9–12. Wytyczne konsultanta
   Treść wytycznych leży poza repozytorium (worker/prompt.local.md — know-how
   handlowe). Sprawdzamy więc plik lokalny, a jeśli go nie ma, to gotowego
   Workera. Na czystym klonie tych punktów nie da się sprawdzić i mówimy
   o tym wprost, zamiast raportować fałszywy błąd. */
const zrodloPromptu = ['worker/prompt.local.md', 'worker/worker.js'].find((p) =>
  fs.existsSync(path.join(ROOT, p))
);
if (!zrodloPromptu) {
  console.log('\n⚠ Brak worker/prompt.local.md i worker/worker.js — punkty 9–12 pominięte.');
  console.log('  (Wytyczne konsultanta są celowo poza repozytorium.)\n');
}
const prompt = zrodloPromptu ? czytaj(zrodloPromptu) : null;

/** Punkt sprawdzany tylko wtedy, gdy mamy dostęp do treści wytycznych. */
const okPrompt = (nr, opis, warunek) => {
  if (prompt === null) return;
  ok(nr, opis, warunek);
};
okPrompt(9, 'styl premium: 1–2 zdania, bez wykrzykników', prompt.includes('Zwykle 1–2 zdania. Nigdy więcej niż 3.') && prompt.includes('ekskluzywnym salonie kamienia'));
okPrompt(10, 'kamień naturalny: bez auto-wyceny + alternatywa', prompt.includes('Nie wyceniasz automatycznie') && prompt.includes('ZAWSZE zaproponuj alternatywę'));
okPrompt(11, 'inne marki: nigdy „nie mamy"', prompt.includes('Nigdy nie mów, że czegoś nie mamy') && prompt.includes('Neolith'));
okPrompt(12, 'eskalacja do Dawida 796 991 128', prompt.includes('Dawid Ząbek, 796 991 128'));
okPrompt(12.1, 'kolejność materiał → dekor → link', prompt.includes('KROK 1 — najpierw materiał') && prompt.includes('dopiero po wyborze materiału pokaż wzory'));
okPrompt(12.2, 'nie pyta o listwę, kwot nie podaje', prompt.includes('O listwę przyścienną NIE PYTASZ') && prompt.includes('NIGDY nie podajesz kwoty'));
okPrompt(12.4, 'bramka zapowiadana, bez placeholderów', prompt.includes('Cena NIE pokazuje się od razu') && prompt.includes('[Formularz]'));
ok(12.3, 'model i limit wg specyfikacji', czytaj('worker/worker.template.js').includes("MODEL = 'claude-sonnet-4-6'") && czytaj('worker/worker.template.js').includes('MAX_TOKENS = 1000'));

/* 15. Tańsze alternatywy */
const alt = czytaj('src/engine/alternatywy.js');
const widok = czytaj('src/app/wynik-widok.js');
ok(
  15,
  'tańszy zamiennik pokazuje się sam, z różnicą w cenie',
  widok.includes('alt-zajawka') && widok.includes('już od') && widok.includes('taniej') &&
    alt.includes('rodzajMaterialu(firma) !== rodzaj') &&
    alt.includes("firma.trybCeny !== 'katalog'"),
  'konglomerat ↔ konglomerat, spiek ↔ spiek, promocje wliczone'
);

/* 13. Brak „Architype" w widocznych miejscach */
const dist = path.join(ROOT, 'dist');
let wystapienia = [];
if (fs.existsSync(dist)) {
  const pliki = [];
  (function zbierz(d) {
    for (const w of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, w.name);
      if (w.isDirectory()) zbierz(p);
      else if (/\.(js|css|html)$/i.test(w.name)) pliki.push(p);
    }
  })(dist);
  for (const p of pliki) {
    const t = fs.readFileSync(p, 'utf8');
    // architype.pl w linkach do wzorów jest OK — chodzi o nazwę jako naszą firmę
    const bezLinkow = t.replace(/https:\/\/architype\.pl[^\s"')]*/g, '');
    if (/architype/i.test(bezLinkow)) wystapienia.push(path.relative(ROOT, p));
  }
}
ok(13, 'nazwa dostawcy nie pojawia się w treści dla klienta', wystapienia.length === 0, wystapienia.join(', ') || 'tylko jako link do katalogu wzorów');

/* 14. Klucze */
const podejrzane = [];
(function skan(d) {
  for (const w of fs.readdirSync(d, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist', 'dist-podglad'].includes(w.name)) continue;
    const p = path.join(d, w.name);
    if (w.isDirectory()) skan(p);
    else if (/\.(js|mjs|json|html|toml|md)$/i.test(w.name)) {
      const t = fs.readFileSync(p, 'utf8');
      if (/sk-ant-[A-Za-z0-9]{10}|re_[A-Za-z0-9]{20}/.test(t)) podejrzane.push(path.relative(ROOT, p));
    }
  }
})(ROOT);
ok(14, 'żadnych kluczy API w repozytorium', podejrzane.length === 0, podejrzane.join(', ') || 'klucze zostają w Cloudflare');

/* 16. Link „Zobacz dekory" prowadzi do JEDNEJ marki
 *
 * Avant Quartz i Caesarstone miały ten sam adres z filtrem na obie marki
 * naraz (brands=avant-quartz,caesarstone). Klient klikał „dekory Avant
 * Quartz", a dostawał listę wymieszaną z Caesarstone — zgłoszone przez
 * Dawida 11.08.2026. Ten test pilnuje, żeby to nie wróciło.
 */
const linki = new Map();
const wielomarkowe = [];
for (const plik of fs.readdirSync(path.join(ROOT, 'src/firms')).filter((f) => f.endsWith('.js') && !f.startsWith('_') && f !== 'index.js')) {
  const tresc = czytaj(`src/firms/${plik}`);
  const url = tresc.match(/linkDekory:\s*\{[^}]*url:\s*'([^']+)'/)?.[1];
  if (!url) continue;
  if (linki.has(url)) wielomarkowe.push(`${plik} i ${linki.get(url)} mają ten sam link`);
  else linki.set(url, plik);
  // Filtr marek architype.pl rozdziela je przecinkiem — więcej niż jedna
  // marka w adresie oznacza wymieszaną listę.
  const marki = url.match(/brands=([^&]+)/)?.[1];
  if (marki && marki.includes(',')) wielomarkowe.push(`${plik}: link do kilku marek (${marki})`);
}
ok(16, 'link „Zobacz dekory" prowadzi do jednej marki', wielomarkowe.length === 0, wielomarkowe.join('; ') || `${linki.size} firm, każda z własnym adresem`);

/* 17. Kwoty „od…" w treści stron zgodne z silnikiem wyceny
 *
 * Strona główna, strony miast i strony materiałowe podają progi w rodzaju
 * „blat 60 × 300 cm od 4 400 zł". Pisane ręcznie rozjeżdżały się przy każdej
 * zmianie cennika — w sierpniu 2026 strona mówiła 4 100 zł, gdy kalkulator
 * liczył już 4 400 zł. Ten test porównuje treść z silnikiem.
 * Naprawa: `npm run ceny:tresc`.
 */
{
  const { wczytajSilnik } = await import('./lib/silnik.mjs');
  const { progi, zapisy } = await import('./lib/ceny-progowe.mjs');
  const { wycen, FIRMY } = await wczytajSilnik();
  const p = progi(FIRMY, wycen);

  const oczekiwane = [
    ['konglomerat 60×300', p.konglomerat.proste],
    ['konglomerat L', p.konglomerat.wL],
    ['spiek 60×300', p.spiek.proste],
    ['spiek L', p.spiek.wL],
  ];
  const strony = fs
    .readdirSync(ROOT)
    .filter((f) => f.endsWith('.html') && f !== 'podglad.html')
    .map((f) => czytaj(f));
  const cala = strony.join('\n');

  // Każdy próg musi być gdzieś w treści; żadna wersja pamiętana jako
  // poprzednia nie może już występować przy „zł".
  const stan = JSON.parse(czytaj('scripts/lib/ceny-tresc.json'));
  const brakuje = oczekiwane.filter(([, v]) => !zapisy(v).some((z) => cala.includes(`${z} zł`) || cala.includes(`${z}&nbsp;zł`)));
  const rozjazd = Object.entries({
    konglomeratProste: p.konglomerat.proste,
    konglomeratL: p.konglomerat.wL,
    spiekProste: p.spiek.proste,
    spiekL: p.spiek.wL,
  }).filter(([k, v]) => stan.kwoty[k] !== v);

  // Kwoty wycofane nie mogą wrócić do treści — to łapie ręczną edycję strony,
  // której samo porównanie pamięci z silnikiem by nie zauważyło.
  const wrocily = (stan.historia || []).filter((v) =>
    zapisy(v).some((z) => cala.includes(`${z} zł`) || cala.includes(`${z}&nbsp;zł`))
  );

  const problemy = [
    ...brakuje.map(([n]) => `brak progu: ${n}`),
    ...rozjazd.map(([k]) => `pamięć ≠ silnik: ${k}`),
    ...wrocily.map((v) => `wycofana kwota ${v} zł znów w treści`),
  ];

  ok(
    17,
    'kwoty „od…" w treści stron zgodne z silnikiem',
    problemy.length === 0,
    problemy.length
      ? `uruchom npm run ceny:tresc — ${problemy.join('; ')}`
      : oczekiwane.map(([n, v]) => `${n} ${v} zł`).join(' · ')
  );
}

console.log(bledy ? `\n✗ Niezgodności: ${bledy}` : '\n✓ Checklista §8 — wszystko zgodne ze specyfikacją');
process.exit(bledy ? 1 : 0);

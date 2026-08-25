#!/usr/bin/env node
/**
 * Składa gotowy plik Workera do wklejenia w Cloudflare.
 *
 *   worker/worker.template.js  +  lista dekorów  →  worker/worker.js
 *
 * Konsultant musi znać dokładne nazwy dekorów, żeby nie wymyślał wzorów,
 * których nie mamy. Cen NIE dostaje — te liczy kalkulator na stronie.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ZRODLO = path.join(ROOT, 'src', 'generated');

const FIRMY_DIR = path.join(ROOT, 'src', 'firms');

/**
 * Lista kolekcji bierze się z plików firm — tak jak w aplikacji.
 * Dzięki temu dodanie dostawcy to nadal JEDEN plik w src/firms/,
 * a nie dopisywanie go jeszcze w tym skrypcie (łatwo o tym zapomnieć,
 * a wtedy konsultant nie zna nowych dekorów, choć strona je pokazuje).
 */
function firmyZPlikow() {
  return fs
    .readdirSync(FIRMY_DIR)
    .filter((f) => f.endsWith('.js') && f !== 'index.js' && !f.startsWith('_'))
    .map((f) => {
      const tresc = fs.readFileSync(path.join(FIRMY_DIR, f), 'utf8');
      const slug = tresc.match(/slug:\s*'([^']+)'/)?.[1] || f.replace('.js', '');
      const aktywna = !/aktywna:\s*false/.test(tresc);
      const reczna = /trybCeny:\s*'reczna'/.test(tresc);
      const pomij = (tresc.match(/pomijGrubosci:\s*\[([^\]]*)\]/)?.[1] || '')
        .split(',')
        .map((s) => s.trim().replace(/['"]/g, ''))
        .filter(Boolean);
      const kolejnosc = Number(tresc.match(/kolejnosc:\s*(\d+)/)?.[1] ?? 99);
      // Nazwa handlowa, rodzaj i format płyty — z nich składamy listy marek
      // w wytycznych. Bez tego trzeba by je dopisywać ręcznie w prompcie,
      // a właśnie na tym przewrócił się Pacific (25.08.2026): dekory były
      // generowane, ale konsultant twierdził, że takiej marki nie mamy.
      const nazwa = tresc.match(/nazwa:\s*'([^']+)'/)?.[1] || slug;
      const typ = tresc.match(/typ:\s*'([^']+)'/)?.[1] || '';
      const plyta = tresc.match(/plyta:\s*\{[^}]*w:\s*(\d+)[^}]*h:\s*(\d+)/);
      const polowki = !/polowkaDozwolona:\s*false/.test(tresc);
      return {
        slug, klucz: slug.replace(/-/g, '_'), aktywna, reczna, pomij, kolejnosc,
        nazwa, typ,
        plyta: plyta ? { w: Number(plyta[1]), h: Number(plyta[2]) } : null,
        polowki,
      };
    })
    .filter((f) => f.aktywna && !f.reczna) // kamienia naturalnego konsultant nie wycenia
    .sort((a, b) => a.kolejnosc - b.kolejnosc);
}

const firmy = firmyZPlikow();

const sekcje = [];
for (const { slug, klucz, nazwa, plyta, polowki, pomij: pomijane } of firmy) {
  const plik = path.join(ZRODLO, `${slug}.dekory.json`);
  if (!fs.existsSync(plik)) continue;
  const dane = JSON.parse(fs.readFileSync(plik, 'utf8'));

  // Kampania promocyjna potrafi wprowadzić wzory spoza cennika podstawowego.
  // Bez tego konsultant nie znałby dekorów, które strona już pokazuje.
  const plikPromo = path.join(ZRODLO, `${slug}.promocje.json`);
  const dzis = new Date().toISOString().slice(0, 10);
  const wCenie = new Set();
  const wPromocji = new Set();
  if (fs.existsSync(plikPromo)) {
    for (const k of JSON.parse(fs.readFileSync(plikPromo, 'utf8')).kampanie || []) {
      if (dzis < k.od || dzis > k.do) continue;
      for (const [wpisKlucz, wpis] of Object.entries(k.ceny || {})) {
        const i = wpisKlucz.lastIndexOf('||');
        const nazwa = wpisKlucz.slice(0, i);
        const gr = wpisKlucz.slice(i + 2);
        if (typeof wpis === 'object' && wpis.matWCenie) wCenie.add(nazwa);
        // Konsultant ma wiedzieć, że wzór jest objęty promocją — samą
        // informację, bez ceny. Kwotę i tak liczy silnik po stronie strony.
        wPromocji.add(nazwa);
        if (dane.dekory[nazwa]?.[gr] == null) {
          dane.dekory[nazwa] = { ...(dane.dekory[nazwa] || {}), [gr]: 1 };
        }
      }
    }
  }

  const wpisy = [];
  for (const [nazwa, grubosci] of Object.entries(dane.dekory || {})) {
    const gr = Object.keys(grubosci)
      .filter((g) => !pomijane.includes(g))
      .sort((a, b) => Number(a) - Number(b));
    const dopiski = [
      wCenie.has(nazwa) ? 'mat/struktura w tej samej cenie' : '',
      wPromocji.has(nazwa) ? 'PROMOCJA' : '',
    ].filter(Boolean);
    if (gr.length) wpisy.push(`${nazwa} (${gr.join('/')} mm${dopiski.length ? ', ' + dopiski.join(', ') : ''})`);
  }
  /*
   * Nagłówek sekcji: NAZWA HANDLOWA (nie slug — klient pisze „Pacific",
   * nie „pacific") plus fakty, które decydują o rozmowie: format płyty
   * i to, czy dostawca sprzedaje połówki. Konsultant musi wiedzieć, że
   * na płycie 348 cm zmieści się blat, który na 320 wymagałby łączenia.
   */
  const fakty = [
    plyta ? `płyta ${plyta.w} × ${plyta.h} cm` : '',
    plyta ? (polowki ? 'dostępne połówki płyt' : 'sprzedaż tylko pełnymi płytami') : '',
  ].filter(Boolean);
  sekcje.push(`## ${nazwa}${fakty.length ? ` (${fakty.join(', ')})` : ''}\n${wpisy.join('; ')}`);
  console.log(
    `  ${klucz.padEnd(14)} ${wpisy.length} dekorów` + (wPromocji.size ? `, w promocji: ${wPromocji.size}` : '')
  );
}

/**
 * Wytyczne rozmowy trzymamy POZA repozytorium (jest publiczne) — tak samo
 * jak ceny zakupowe. Plik `worker/prompt.local.md` ma je w całości;
 * tutaj tylko wstrzykujemy jego treść w gotowego Workera.
 */
const PROMPT_ZAPASOWY = [
  'Jesteś konsultantem firmy kamieniarskiej. Odpowiadasz po polsku, krótko',
  'i rzeczowo. Zbierz od klienta: materiał, wzór, wymiary odcinków blatu',
  'w centymetrach oraz sposób montażu zlewu i płyty grzewczej.',
  'Nie podawaj żadnych kwot — wycenę liczy kalkulator.',
  'Gdy masz komplet danych, dołącz obiekt JSON:',
  '{"action":"quote","params":{...},"message":"..."}',
  'Jeśli sprawa jest nietypowa: {"action":"lead","message":"..."}',
].join('\n');

/**
 * LISTY MAREK DO WYTYCZNYCH.
 *
 * Wytyczne wyliczają marki po nazwie („Konglomerat kwarcowy — marki A, B, C").
 * Do 25.08.2026 były wpisane ręcznie i to one przewróciły Pacifica: dekory
 * doszły automatycznie, ale konsultant czytał w wytycznych zamkniętą listę
 * marek i odpowiadał klientowi, że takiego materiału nie mamy.
 *
 * Teraz listy powstają z tych samych plików firm co reszta. Dodanie cennika
 * to nadal JEDEN plik w src/firms/.
 */
function poPolsku(nazwy) {
  if (nazwy.length <= 1) return nazwy[0] || '';
  return `${nazwy.slice(0, -1).join(', ')} i ${nazwy[nazwy.length - 1]}`;
}

const wgTypu = (fragment) =>
  firmy.filter((f) => (f.typ || '').includes(fragment)).map((f) => f.nazwa);

const MARKI = {
  __MARKI_KONGLOMERAT__: poPolsku(wgTypu('konglomerat')),
  __MARKI_SPIEK__: poPolsku(wgTypu('spiek').concat(wgTypu('gres')).filter((n, i, a) => a.indexOf(n) === i)),
  __MARKI_WSZYSTKIE__: poPolsku(firmy.map((f) => f.nazwa)),
};

const sciezkaPromptu = path.join(ROOT, 'worker', 'prompt.local.md');
let wytyczne = PROMPT_ZAPASOWY;

if (fs.existsSync(sciezkaPromptu)) {
  wytyczne = fs.readFileSync(sciezkaPromptu, 'utf8').trim();
  console.log(`  wytyczne      ${(Buffer.byteLength(wytyczne) / 1024).toFixed(1)} kB z prompt.local.md`);
} else {
  console.warn('\n⚠ Brak worker/prompt.local.md — wstawiam prompt ZAPASOWY.');
  console.warn('  Konsultant będzie działał, ale bez naszego sposobu prowadzenia rozmowy.');
  console.warn('  Plik jest celowo poza gitem: to know-how handlowe.\n');
}

/*
 * Marki podstawiamy w wytyczne, zanim trafią do szablonu. Znacznik, który
 * zostałby niepodstawiony, wyszedłby wprost do klienta w rozmowie —
 * dlatego sprawdzamy to twardo niżej.
 */
for (const [znacznik, lista] of Object.entries(MARKI)) {
  wytyczne = wytyczne.split(znacznik).join(lista);
}

// Backticki i ${...} w treści wytycznych rozwaliłyby literał szablonowy.
const bezpieczne = wytyczne.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

const szablon = fs.readFileSync(path.join(ROOT, 'worker', 'worker.template.js'), 'utf8');
const wynik = szablon
  .replace('__DEKORY__', sekcje.join('\n\n'))
  .replace('__PROMPT__', bezpieczne);

for (const znacznik of ['__DEKORY__', '__PROMPT__', ...Object.keys(MARKI)]) {
  if (wynik.includes(znacznik)) {
    console.error(`✗ Nie udało się podstawić ${znacznik}.`);
    process.exit(1);
  }
}

fs.writeFileSync(path.join(ROOT, 'worker', 'worker.js'), wynik, 'utf8');
console.log(`✓ worker/worker.js — ${(wynik.length / 1024).toFixed(0)} kB (plik jest poza gitem)`);

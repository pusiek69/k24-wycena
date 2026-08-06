/**
 * Wspólna logika cennikowa — używana przez `npm run cennik`
 * i przez narzędzie „Dodaj cennik" (scripts/cennik-serwer.mjs).
 *
 * Zasada jest jedna i niezmienna:
 *   cena katalogowa → (−rabat) → (+marża) → cena końcowa dla klienta
 * Do przeglądarki trafia WYŁĄCZNIE wynik ostatniego kroku.
 */
import fs from 'node:fs';
import path from 'node:path';

export const ZRODLA = 'pricing/zrodla';
export const GENEROWANE = 'src/generated';

/**
 * Mnożnik: cena katalogowa netto → cena końcowa netto dla klienta.
 *   juzPrzeliczone = true  → katalog zawiera już ceny końcowe (×1)
 *   inaczej                → (1 − rabat) × (1 + marża)
 */
export function policzMnoznik(zasady) {
  if (typeof zasady.mnoznikRecznie === 'number') return zasady.mnoznikRecznie;
  if (zasady.juzPrzeliczone) return 1;

  const { rabatZakupowy: rabat, marza } = zasady;
  if (typeof rabat !== 'number' || typeof marza !== 'number') {
    throw new Error('Brakuje rabatu albo marży. Uzupełnij je albo zaznacz, że ceny są już końcowe.');
  }
  if (rabat < 0 || rabat >= 1) throw new Error('Rabat musi być z zakresu 0–99%.');
  if (marza < 0) throw new Error('Marża nie może być ujemna.');
  return (1 - rabat) * (1 + marza);
}

/** Przelicza katalog na ceny końcowe i zapisuje plik dla przeglądarki. */
export function zapiszKatalogKlienta(root, slug, zasady) {
  const mnoznik = policzMnoznik(zasady);
  const dekory = {};
  let ile = 0;

  for (const [nazwa, grubosci] of Object.entries(zasady.katalog || {})) {
    const wpis = {};
    for (const [gr, cena] of Object.entries(grubosci)) {
      if (cena == null) continue;
      if (typeof cena !== 'number' || !(cena > 0)) {
        throw new Error(`Dekor „${nazwa}", grubość ${gr} mm — cena nie jest liczbą.`);
      }
      wpis[gr] = Math.round(cena * mnoznik);
    }
    if (Object.keys(wpis).length) {
      dekory[nazwa] = wpis;
      ile++;
    }
  }

  if (!ile) throw new Error('Cennik jest pusty — nie znalazłem ani jednego dekoru z ceną.');

  const tresc = {
    _info: [
      'PLIK GENEROWANY AUTOMATYCZNIE — nie edytuj ręcznie.',
      `Źródło: pricing/zrodla/${slug}.zasady.json (poza gitem).`,
      'Zawartość: cena KOŃCOWA NETTO za 1 m² dla klienta (VAT dolicza aplikacja).',
      'Nie ma tu cen zakupowych ani rabatów.',
    ].join(' '),
    _firma: slug,
    _wygenerowano: new Date().toISOString().slice(0, 10),
    _dekorow: ile,
    dekory,
  };

  const cel = path.join(root, GENEROWANE, `${slug}.dekory.json`);
  fs.mkdirSync(path.dirname(cel), { recursive: true });
  fs.writeFileSync(cel, JSON.stringify(tresc, null, 2) + '\n', 'utf8');

  return { ile, mnoznik };
}

/**
 * Wyciąga cennik z tekstu wklejonego z PDF-a, Excela albo pliku CSV.
 *
 * Każda linia to nazwa dekoru i jedna lub kilka cen, np.:
 *   Dijon            685    973
 *   Blanche;791;1122
 *   Crystal Polar White  884
 *
 * `grubosci` mówi, czym są kolejne kolumny cen (np. ['20','30']).
 */
export function rozpoznajCennik(tekst, grubosci) {
  const wynik = {};
  const pominiete = [];

  for (const surowa of String(tekst).split(/\r?\n/)) {
    const linia = surowa.trim();
    if (!linia) continue;

    // rozdzielamy średnikami, tabulatorami albo min. dwiema spacjami
    const czesci = linia.split(/\s*[;\t]\s*|\s{2,}/).map((c) => c.trim()).filter(Boolean);
    let nazwa;
    let ceny;

    if (czesci.length > 1) {
      nazwa = czesci[0];
      ceny = czesci.slice(1);
    } else {
      // jedna kolumna: ceny są na końcu linii, nazwa przed nimi
      const m = linia.match(/^(.*?)((?:\s+[\d\s.,]+)+)$/);
      if (!m) {
        pominiete.push(linia);
        continue;
      }
      nazwa = m[1].trim();
      ceny = m[2].trim().split(/\s+/);
    }

    const liczby = ceny.map(naLiczbe).filter((n) => n !== null);
    if (!nazwa || !liczby.length) {
      pominiete.push(linia);
      continue;
    }

    const wpis = {};
    liczby.forEach((cena, i) => {
      const gr = grubosci[i];
      if (gr) wpis[gr] = cena;
    });
    if (Object.keys(wpis).length) wynik[nazwa] = wpis;
    else pominiete.push(linia);
  }

  return { katalog: wynik, pominiete };
}

function naLiczbe(tekst) {
  const oczyszczony = String(tekst)
    .replace(/\s/g, '')
    .replace(/zł|PLN/gi, '')
    .replace(/\.(?=\d{3}\b)/g, '') // 1.234 → 1234
    .replace(',', '.');
  const n = Number(oczyszczony);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

/** Slug firmy: tylko małe litery, cyfry i myślniki. */
export function naSlug(nazwa) {
  return String(nazwa)
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

/** Plik firmy dla kreatora i konsultanta — jeden plik = jedna firma. */
export function szablonFirmy(dane) {
  const { slug, nazwa, typ, krotki, opis, linkDekory, plytaW, plytaH, polowki, kolejnosc } = dane;
  return `import dekory from '../generated/${slug}.dekory.json';
import { VAT, ROBOCIZNA, OPCJE } from './_domyslne.js';

/**
 * ${nazwa.toUpperCase()} — ${typ}
 *
 * Plik utworzony narzędziem „Dodaj cennik" (npm run cennik:dodaj).
 *
 * ⚠ NIE WPISUJEMY TU RABATÓW ANI CEN ZAKUPOWYCH — ten plik trafia w całości
 *   do przeglądarki klienta. Ceny w \`dekory\` to gotowe ceny końcowe netto/m²;
 *   zasady handlowe siedzą w pricing/zrodla/${slug}.zasady.json (poza gitem).
 */
export default {
  slug: '${slug}',
  nazwa: '${nazwa.replace(/'/g, "\\'")}',
  typ: '${typ.replace(/'/g, "\\'")}',
  kolejnosc: ${kolejnosc},
  aktywna: true,
  trybCeny: 'katalog',

  krotki: '${krotki.replace(/'/g, "\\'")}',
  opis:
    '${opis.replace(/'/g, "\\'")}',

  linkDekory: {
    url: '${linkDekory}',
    label: 'Zobacz dekory ${nazwa.replace(/'/g, "\\'")}',
  },

  vat: VAT,
  cenyUslug: 'brutto',
  plyta: { w: ${plytaW}, h: ${plytaH}, polowkaDozwolona: ${polowki} },
  narzutOdpad: 0.1,

  robocizna: ROBOCIZNA,
  opcje: OPCJE,
  promocje: [],

  dekory: dekory.dekory,
};

/* ─────────────────────────────────────────────────────────────────────────
   JAK LICZYMY ${nazwa.toUpperCase()}:
   płyty ${plytaW} × ${plytaH} cm${polowki ? ' (wolno kupić połówkę)' : ', TYLKO całe płyty'},
   +10% zapasu na docięcie, VAT 23% na materiał, robocizna od metra bieżącego.
   Rabat i marża: pricing/zrodla/${slug}.zasady.json (poza gitem).
   ───────────────────────────────────────────────────────────────────────── */
`;
}

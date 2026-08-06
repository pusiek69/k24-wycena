import { FIRMY } from '../firms/index.js';
import { wycen } from './wycena.js';

/**
 * SZUKANIE TAŃSZEJ ALTERNATYWY
 *
 * Zasada: ten sam RODZAJ kamienia, dowolna nasza firma.
 * Konglomeratu nie podmieniamy na spiek i odwrotnie — to inny materiał,
 * inna twardość i inne zachowanie w kuchni. Ale w obrębie rodzaju
 * przeszukujemy wszystkie kolekcje: często najtańsza wychodzi u innego
 * dostawcy albo dzięki trwającej promocji.
 *
 * Wszystko liczymy DOKŁADNIE tak samo jak wycenę wyjściową: te same odcinki,
 * te same obróbki, grubość jak najbliższa. Różnica w cenie bierze się więc
 * wyłącznie z materiału, a nie z innego zakresu prac.
 */

/** Minimalna oszczędność, żeby w ogóle proponować zamianę. */
const PROG_OSZCZEDNOSCI = 0.03; // 3%

export function rodzajMaterialu(firma) {
  const typ = String(firma?.typ || '').toLowerCase();
  if (typ.includes('spiek') || typ.includes('ceramik')) return 'spiek';
  if (typ.includes('konglomerat')) return 'konglomerat';
  return 'naturalny';
}

/** Dopełniacz: „…w tym rodzaju kamienia (konglomeratu kwarcowego)". */
export function nazwaRodzaju(rodzaj) {
  if (rodzaj === 'spiek') return 'spieku';
  if (rodzaj === 'konglomerat') return 'konglomeratu kwarcowego';
  return 'kamienia naturalnego';
}

/** Mianownik: „Ten sam konglomerat kwarcowy już od…". */
export function nazwaRodzajuMianownik(rodzaj) {
  if (rodzaj === 'spiek') return 'spiek';
  if (rodzaj === 'konglomerat') return 'konglomerat kwarcowy';
  return 'kamień naturalny';
}

/**
 * @param {object} w      wycena wyjściowa (wynik `wycen`)
 * @param {number} ile    ile propozycji zwrócić
 * @returns {Array<{wycena, taniejO, procent}>} posortowane od najtańszej
 */
export function szukajTanszych(w, ile = 3) {
  if (!w?.ok || w.materialDoUstalenia || !w.odcinki?.length) return [];

  const rodzaj = rodzajMaterialu(w.firma);
  const kandydaci = [];

  for (const firma of FIRMY) {
    if (firma.trybCeny !== 'katalog') continue; // kamienia naturalnego nie liczymy automatycznie
    if (rodzajMaterialu(firma) !== rodzaj) continue;

    for (const dekor of Object.keys(firma.dekory || {})) {
      if (firma.slug === w.firma.slug && dekor === w.dekor) continue;

      const grubosc = dobierzGrubosc(firma, dekor, w.grubosc);
      if (!grubosc) continue;

      const propozycja = wycen(firma, {
        dekor,
        grubosc,
        odcinki: w.odcinki,
        opcje: w.opcje,
      });
      if (!propozycja.ok) continue;

      const taniejO = w.razem - propozycja.razem;
      if (taniejO < w.razem * PROG_OSZCZEDNOSCI) continue;

      kandydaci.push({
        wycena: propozycja,
        taniejO,
        procent: Math.round((taniejO / w.razem) * 100),
      });
    }
  }

  kandydaci.sort((a, b) => a.wycena.razem - b.wycena.razem);
  return zroznicuj(kandydaci, ile);
}

/**
 * PÓŁ PŁYTY ZAMIAST CAŁEJ
 *
 * Część kolekcji (Marazzi) sprzedajemy wyłącznie w całych płytach. Przy małym
 * blacie klient płaci wtedy za materiał, którego fizycznie nie wykorzysta —
 * a obok stoi kolekcja tego samego rodzaju, u której wolno kupić połówkę.
 * Wtedy różnica potrafi być kilka tysięcy, więc mówimy o tym wprost,
 * zamiast czekać, aż klient sam się zorientuje.
 *
 * Warunek: blat z zapasem mieści się w połowie płyty, a mimo to płaci
 * za całą. Jeśli i tak trzeba by kupić więcej niż pół — nie ma o czym mówić.
 *
 * @returns {{wycena, taniejO, procent, polePlyty, potrzebne}|null}
 */
export function tanszaPrzezPolowke(w) {
  if (!w?.ok || w.materialDoUstalenia || !w.odcinki?.length) return null;

  const plyta = w.firma?.plyta;
  if (!plyta || plyta.polowkaDozwolona) return null; // ta firma i tak daje połówki
  if (w.pak?.plytyPelne !== 1 || w.pak?.polowka) return null; // liczymy tylko jedną płytę

  const polePlyty = (plyta.w / 100) * (plyta.h / 100);
  const potrzebne = w.pak.m2Blatu * (1 + (w.firma.narzutOdpad ?? 0.1));
  if (potrzebne > polePlyty / 2) return null; // połówka i tak by nie starczyła

  const rodzaj = rodzajMaterialu(w.firma);
  const kandydaci = [];

  for (const firma of FIRMY) {
    if (firma.trybCeny !== 'katalog') continue;
    if (firma.slug === w.firma.slug) continue;
    if (!firma.plyta?.polowkaDozwolona) continue; // szukamy właśnie tych z połówką
    if (rodzajMaterialu(firma) !== rodzaj) continue;

    for (const dekor of Object.keys(firma.dekory || {})) {
      const grubosc = dobierzGrubosc(firma, dekor, w.grubosc);
      if (!grubosc) continue;

      const propozycja = wycen(firma, { dekor, grubosc, odcinki: w.odcinki, opcje: w.opcje });
      if (!propozycja.ok) continue;
      if (!propozycja.pak?.polowka) continue; // ma realnie zejść na połówce

      const taniejO = w.razem - propozycja.razem;
      if (taniejO < w.razem * PROG_OSZCZEDNOSCI) continue;

      kandydaci.push({
        wycena: propozycja,
        taniejO,
        procent: Math.round((taniejO / w.razem) * 100),
        podobienstwo: podobienstwoNazw(w.dekor, dekor),
      });
    }
  }
  if (!kandydaci.length) return null;

  // Najtańsza wygrywa, ale wśród porównywalnie tanich (do 5% różnicy)
  // wybieramy wzór najbardziej zbliżony do tego, który klient już polubił.
  kandydaci.sort((a, b) => a.wycena.razem - b.wycena.razem);
  const prog = kandydaci[0].wycena.razem * 1.05;
  const blisko = kandydaci.filter((k) => k.wycena.razem <= prog);
  blisko.sort((a, b) => b.podobienstwo - a.podobienstwo || a.wycena.razem - b.wycena.razem);

  return { ...blisko[0], polePlyty, potrzebne };
}

/**
 * Jak bardzo dwa dekory brzmią podobnie — po wspólnych słowach nazwy
 * („Calacatta", „Statuario", „Concrete"). Prosto, ale wystarcza, żeby
 * zamiast białego marmuru nie zaproponować czarnego betonu.
 */
const SLOWA_POMIJANE = new Set(['look', 'marble', 'stone', 'concrete', 'lux', 'satin', 'naturale', 'matt', 'bookmatch', 'faccia', 'a', 'b']);

function podobienstwoNazw(a, b) {
  const tokeny = (s) =>
    new Set(
      String(s || '')
        .toLowerCase()
        .split(/[^a-ząćęłńóśźż0-9]+/)
        .filter((t) => t.length > 2 && !SLOWA_POMIJANE.has(t))
    );
  const ta = tokeny(a);
  const tb = tokeny(b);
  if (!ta.size || !tb.size) return 0;
  let wspolne = 0;
  for (const t of ta) if (tb.has(t)) wspolne++;
  return wspolne / Math.min(ta.size, tb.size);
}

/**
 * Najtańsza propozycja plus kolejne z INNYCH kolekcji — żeby klient dostał
 * realny wybór, a nie trzy odcienie tego samego dekoru z jednej firmy.
 */
function zroznicuj(kandydaci, ile) {
  const wynik = [];
  const uzyteFirmy = new Set();

  for (const k of kandydaci) {
    if (wynik.length >= ile) break;
    if (uzyteFirmy.has(k.wycena.firma.slug)) continue;
    wynik.push(k);
    uzyteFirmy.add(k.wycena.firma.slug);
  }
  // Gdy rodzaj ma mało kolekcji, dobieramy resztę bez oglądania się na firmę.
  for (const k of kandydaci) {
    if (wynik.length >= ile) break;
    if (!wynik.includes(k)) wynik.push(k);
  }
  return wynik;
}

/** Ta sama grubość, a jeśli jej nie ma — najbliższa dostępna na blat. */
function dobierzGrubosc(firma, dekor, oczekiwana) {
  const wpis = firma.dekory?.[dekor];
  if (!wpis) return null;

  const dostepne = Object.keys(wpis)
    .filter((g) => !(firma.pomijGrubosci || []).includes(g))
    .sort((a, b) => Number(a) - Number(b));
  if (!dostepne.length) return null;
  if (dostepne.includes(String(oczekiwana))) return String(oczekiwana);

  const cel = Number(oczekiwana) || 20;
  return dostepne.reduce((naj, g) =>
    Math.abs(Number(g) - cel) < Math.abs(Number(naj) - cel) ? g : naj
  );
}

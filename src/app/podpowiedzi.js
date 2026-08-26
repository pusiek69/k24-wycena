/**
 * TAŃSZE MATERIAŁY W PODOBNYM KOLORZE.
 *
 * Zlecenie Dawida (26.08.2026): „podpowiedź 3 tańszych materiałów,
 * możliwie podobnych kolorystycznie" — na szybką odpowiedź, gdy klient
 * mówi „za drogo", i na dokładanie wariantów jednym kliknięciem.
 *
 * DLACZEGO KWOTA, A NIE CENA ZA METR. Cena za m² kłamie przy porównaniu:
 * tańszy materiał w innym formacie płyty potrafi wyjść drożej, bo z tego
 * arkusza zostanie więcej odpadu. Dlatego każdy kandydat przechodzi przez
 * TEN SAM silnik i te same odcinki co oferta główna — a Dawid widzi
 * gotowe „−2 300 zł", nie różnicę stawek, którą musiałby przeliczać.
 * To kosztuje: 734 przeliczenia to ok. 30 ms, czyli nic.
 *
 * Moduł jest czysty (bez DOM), więc regułę doboru da się przetestować.
 */
import { odlegloscKoloru } from './kolory-dekorow.js';

/** Ile podpowiedzi pokazujemy. */
export const ILE_PODPOWIEDZI = 3;

/**
 * Poniżej tej kwoty podpowiedź nie jest odpowiedzią na „za drogo".
 * Materiał tańszy o 80 zł na całej kuchni to szum, nie argument.
 */
export const MINIMALNA_OSZCZEDNOSC = 200;

/** Jak blisko koloru trzeba być, żeby to jeszcze nazwać dopasowaniem. */
const PROG_ZBLIZONY = 2;

export function opisDopasowania(dystans) {
  if (dystans === 0) return 'ten sam kolor';
  if (dystans <= PROG_ZBLIZONY) return 'zbliżony kolor';
  // Świadomie nazwane wprost: Dawid ma wiedzieć, że tu koloru NIE
  // dobieraliśmy — bo albo dekor nie ma oznaczenia, albo jest z innej bajki.
  return 'podobna cena, dowolny kolor';
}

/**
 * Trzy tańsze materiały do pokazania obok oferty głównej.
 *
 * @param {object}  p
 * @param {string}  p.kolorGlowny  tag koloru materiału z oferty głównej
 * @param {number}  p.cenaObecna   kwota oferty głównej (brutto)
 * @param {Array}   p.kandydaci    [{ firma, firmaNazwa, typ, dekor, grubosc, razem, kolor }]
 * @param {Array}   p.pomijaj      ['firma/Dekor', …] — główna oferta i już dodane warianty
 * @param {number}  p.ile
 */
export function tanszeAlternatywy({
  kolorGlowny,
  cenaObecna,
  kandydaci = [],
  pomijaj = [],
  ile = ILE_PODPOWIEDZI,
} = {}) {
  const obecna = Number(cenaObecna) || 0;
  if (!(obecna > 0)) return [];

  const bez = new Set(pomijaj);

  const pula = kandydaci
    .filter((k) => k && Number(k.razem) > 0 && !bez.has(`${k.firma}/${k.dekor}`))
    .map((k) => ({
      ...k,
      oszczednosc: obecna - Number(k.razem),
      dystans: odlegloscKoloru(kolorGlowny, k.kolor),
    }))
    .filter((k) => k.oszczednosc >= MINIMALNA_OSZCZEDNOSC)
    // Najpierw kolor, potem pieniądze. Odwrotna kolejność dawałaby zawsze
    // ten sam najtańszy materiał w katalogu, niezależnie od tego, co
    // klient wybrał — a wtedy podpowiedź nie jest podpowiedzią.
    .sort((a, b) => a.dystans - b.dystans || b.oszczednosc - a.oszczednosc);

  return zroznicuj(pula, ile).map((k) => ({
    ...k,
    dopasowanie: opisDopasowania(k.dystans),
  }));
}

/**
 * Wybór z pilnowaniem różnorodności.
 *
 * Trzy dekory tej samej marki to nie są trzy propozycje, tylko jedna.
 * Dlatego bierzemy najpierw po jednym z różnych marek I różnych rodzajów
 * materiału (konglomerat, spiek, gres) — Dawid dostaje wtedy realny
 * wachlarz: „ten sam wygląd taniej" obok „inny materiał, dużo taniej".
 * Gdyby tak nie dało się uzbierać trzech, luzujemy warunki po kolei,
 * zamiast oddawać mniej propozycji.
 */
function zroznicuj(pula, ile) {
  const wynik = [];
  const firmy = new Set();
  const typy = new Set();
  /*
   * Ta sama marka w tej samej cenie i tym samym kolorze to dla klienta
   * jedna propozycja pokazana dwa razy — kolekcje mają po kilkanaście
   * dekorów w jednej cenie. Blokujemy to nawet w fazie „bierz co jest",
   * bo trzy wiersze różniące się wyłącznie nazwą wyglądają na błąd.
   */
  const bliznieta = new Set();
  const odcisk = (k) => `${k.firma}|${k.razem}|${k.kolor}`;

  for (const faza of [0, 1, 2]) {
    for (const k of pula) {
      if (wynik.length >= ile) return wynik;
      if (wynik.includes(k) || bliznieta.has(odcisk(k))) continue;
      if (faza === 0 && (firmy.has(k.firma) || typy.has(k.typ))) continue;
      if (faza === 1 && firmy.has(k.firma)) continue;
      wynik.push(k);
      firmy.add(k.firma);
      typy.add(k.typ);
      bliznieta.add(odcisk(k));
    }
  }
  return wynik;
}

/**
 * WSZYSTKIE DEKORY AKTUALNIE W PROMOCJI.
 *
 * Dopisek Dawida (26.08.2026): „albo żebym miał pokazane wszystkie te
 * z promocji". Do tej pory promocja odsłaniała się dopiero po wybraniu
 * konkretnego dekoru — Dawid musiał wiedzieć, czego szukać.
 *
 * ŹRÓDŁO PRAWDY TO KAMPANIE, NIE LISTA RĘCZNA. Bierzemy dokładnie te
 * kampanie, którymi liczy silnik, i porównujemy daty tak samo. Dzięki
 * temu sekcja gaśnie sama w dniu po zakończeniu promocji, a po wgraniu
 * nowej kampanii pojawia się bez dotykania kodu.
 *
 * KOLEJNOŚĆ KAMPANII MA ZNACZENIE. Ten sam dekor bywa w dwóch aktywnych
 * kampaniach naraz (Laminam: „Sezon Letnich Okazji" do 30.09 i cennikowa
 * do 31.12). Silnik (`znajdzPromocje` w engine/wycena.js) bierze PIERWSZĄ
 * pasującą z listy firmy — więc my też, inaczej plakietka mówiłaby o innej
 * promocji niż ta, po której naliczyliśmy cenę.
 *
 * Moduł jest czysty (bez DOM), żeby dało się to sprawdzić testem.
 */

/** Czy kampania trwa danego dnia. */
export const trwa = (k, dzis) => !!k && dzis >= k.od && dzis <= k.do;

export const dzisiaj = () => new Date().toISOString().slice(0, 10);

/**
 * Dekory w aktywnych kampaniach — po JEDNYM wierszu na dekor.
 *
 * Dlaczego jeden wiersz, skoro promocja bywa na kilka grubości: lista ma
 * służyć do szybkiego przejrzenia przy telefonie z klientem. Osobne
 * wiersze dla 12 i 20 mm rozdmuchałyby ją dwukrotnie, a Dawid i tak
 * porównuje z blatem, który już wycenia — więc wybieramy grubość
 * z oferty głównej, a gdy dekor jej nie ma, najcieńszą promowaną.
 *
 * @param {Array}  firmy       kolekcje z `FIRMY` (kamień naturalny osobno)
 * @param {string} gruboscGl   grubość oferty głównej, np. '20'
 * @param {string} dataISO     dzień, na który sprawdzamy (do testów)
 */
export function dekoryWPromocji(firmy, gruboscGl, dataISO) {
  const dzis = dataISO || dzisiaj();
  const wynik = [];

  for (const firma of firmy || []) {
    // Dekor → pierwsza kampania, która go obejmuje (tak jak w silniku).
    const znalezione = new Map();

    for (const kampania of firma.promocje || []) {
      if (!trwa(kampania, dzis)) continue;

      for (const klucz of Object.keys(kampania.ceny || {})) {
        const rozdzielnik = klucz.lastIndexOf('||');
        if (rozdzielnik < 0) continue;
        const dekor = klucz.slice(0, rozdzielnik);
        const grubosc = klucz.slice(rozdzielnik + 2);

        const dotad = znalezione.get(dekor);
        if (dotad && dotad.kampania !== kampania.nazwa) continue; // pierwsza wygrywa
        if (!dotad) {
          znalezione.set(dekor, {
            firma: firma.slug,
            firmaNazwa: firma.nazwa,
            typ: firma.typ || '',
            dekor,
            grubosci: [grubosc],
            kampania: kampania.nazwa,
            doKiedy: kampania.do,
          });
          continue;
        }
        if (!dotad.grubosci.includes(grubosc)) dotad.grubosci.push(grubosc);
      }
    }

    for (const w of znalezione.values()) {
      wynik.push({ ...w, grubosc: wybierzGrubosc(w.grubosci, gruboscGl) });
    }
  }

  return wynik;
}

/** Grubość z oferty głównej, a gdy jej nie ma — najcieńsza promowana. */
function wybierzGrubosc(grubosci, gruboscGl) {
  if (gruboscGl && grubosci.includes(String(gruboscGl))) return String(gruboscGl);
  return [...grubosci].sort((a, b) => Number(a) - Number(b))[0];
}

/**
 * Promocyjne pozycje kamienia naturalnego.
 *
 * Kamień naturalny stoi OSOBNO, bo jego cena wynika z konkretnej płyty
 * w magazynie, a nie z dekoru: promocja podaje cenę za m² dla wzoru
 * w danym wykończeniu i grubości, ale ile płyt trzeba kupić, wiadomo
 * dopiero po wskazaniu sztuki. Dlatego te pozycje dostają kwotę
 * ORIENTACYJNĄ (typowy format płyty) i nie da się ich dodać jako wariant —
 * zamiast tego prowadzą do magazynu, gdzie Dawid wybiera realną płytę.
 */
export function naturalneWPromocji(promocja, dataISO) {
  const k = promocja?.kampania;
  const dzis = dataISO || dzisiaj();
  if (!trwa(k, dzis)) return [];

  return (promocja.pozycje || []).map((p) => ({
    naturalny: true,
    firma: 'interstone',
    firmaNazwa: 'Kamień naturalny',
    typ: 'kamień naturalny',
    dekor: p.nazwa,
    wykonczenie: p.wykonczenie || '',
    grubosc: String(p.gruboscMm || 20),
    blok: p.blok || null,
    cenaNettoM2: Number(p.cenaNettoM2) || 0,
    kampania: k.nazwa,
    doKiedy: k.do,
  }));
}

/*
 * Próg jest CIAŚNIEJSZY niż przy trzech podpowiedziach (podpowiedzi.js).
 * Tam szeroka siatka nie szkodzi — pozycje są trzy. Tu przy stu dwudziestu
 * pozycjach próg 2 oznaczał gwiazdkę przy 73 z nich, czyli przy większości:
 * wyróżnienie przestawało cokolwiek wyróżniać. Zostaje ten sam kolor
 * i jeden krok obok (biel ↔ biel z żyłą, szary ↔ antracyt).
 */
export const PROG_PODOBNEGO_KOLORU = 1;

/**
 * Kolejność na liście — dokładnie tak, jak prosił Dawid:
 * „posortuj od najtańszych, a te w podobnym kolorze do wyboru klienta
 * wypchnij na górę".
 *
 * Czyli DWIE grupy, każda po cenie rosnąco: najpierw pasujące kolorem,
 * potem reszta. Nie sortujemy po samej odległości koloru, bo wtedy
 * porządek cenowy rozpadłby się na kilka drobnych kubełków i lista
 * przestałaby się czytać jako „od najtańszych".
 */

export function ulozPromocje(pozycje) {
  return [...(pozycje || [])].sort((a, b) => {
    const grupaA = a.podobnyKolor ? 0 : 1;
    const grupaB = b.podobnyKolor ? 0 : 1;
    if (grupaA !== grupaB) return grupaA - grupaB;
    // Pozycje bez policzonej kwoty (naturalny bez formatu) na koniec grupy.
    const ka = Number(a.razem) || Infinity;
    const kb = Number(b.razem) || Infinity;
    if (ka !== kb) return ka - kb;
    return String(a.dekor).localeCompare(String(b.dekor), 'pl');
  });
}

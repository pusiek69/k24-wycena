import dekory from '../generated/laminam.dekory.json';
import promocje from '../generated/laminam.promocje.json';
import { VAT, ROBOCIZNA, OPCJE } from './_domyslne.js';
import { dekoryZKampaniami } from './_promocje.js';

/**
 * LAMINAM — spiek wielkoformatowy (płyty 162 × 324 cm)
 *
 * ⚠ Bez rabatów i cen zakupowych — patrz komentarz w avant-quartz.js.
 *
 * Ceny w cenniku dostawcy (13.07.2026) są podane NETTO i mają już wliczoną
 * marżę Dawida, więc trafiają do `generated` jeden do jednego (mnożnik ×1).
 * To ta sama rola co ceny z magazynu Interstone — kwota jest gotową ceną
 * dla klienta — ale INNA podstawa: Interstone publikuje brutto i silnik
 * dzieli je przez 1,23, a tutaj dzielić nie ma czego. Gdyby ktoś kiedyś
 * potraktował te liczby jak brutto, wycena spadłaby o 23%.
 *
 * W odróżnieniu od kamienia naturalnego Laminam NIE ma magazynu online
 * ani kodów płyt: klient wybiera dekor z listy, tak jak przy Keralini
 * czy Marazzi.
 */
export default {
  slug: 'laminam',
  nazwa: 'Laminam',
  typ: 'spiek / gres wielkoformatowy',
  kolejnosc: 37,
  aktywna: true,
  trybCeny: 'katalog',

  krotki: 'Wielki format, cienka płyta, włoski spiek.',
  opis:
    'Spiek wielkoformatowy z płyt 162 × 324 cm — wypalany w wysokiej temperaturze. ' +
    'Wytrzyma gorący garnek prosto z palnika, nie chłonie plam i bardzo trudno go zarysować. ' +
    'Duży format oznacza mniej łączeń na długim blacie.',

  linkDekory: {
    url: 'https://www.laminam.com/pol/pl/kolekcje/',
    label: 'Zobacz kolekcje Laminam',
  },

  vat: VAT,
  cenyUslug: 'brutto',
  // Płyta 1620 × 3240 mm, nierektyfikowana. Jak przy pozostałych
  // wielkoformatowych spiekach kupujemy CAŁE płyty — połówek dostawca
  // nie sprzedaje.
  plyta: { w: 324, h: 162, polowkaDozwolona: false },
  narzutOdpad: 0.1,

  // Cennik ma też 3, 5 i 6 mm — to okładziny i fronty, nie blaty.
  // Do kalkulatora wchodzą wyłącznie grubości blatowe.
  pomijGrubosci: ['3', '5', '6'],
  opisGrubosci: {
    12: '12 mm — standard na blat ze spieku',
    20: '20 mm — grubszy, bardziej masywny',
  },

  robocizna: ROBOCIZNA,
  opcje: OPCJE,
  promocje: promocje.kampanie,

  /*
   * Ceny promocyjne z cennika (pozycje z gwiazdką) są ważne do 31.12.2026.
   * Dekory, które mają WYŁĄCZNIE cenę promocyjną, dokładamy do listy tylko
   * na czas kampanii — po niej znikają same, zamiast zostać z ceną, której
   * już nie honorujemy. Dekor z promocyjną dwunastką i regularną dwudziestką
   * zostaje po kampanii z samą dwudziestką.
   */
  dekory: dekoryZKampaniami(dekory.dekory, promocje.kampanie),
};

/* ─────────────────────────────────────────────────────────────────────────
   JAK LICZYMY LAMINAM:
   płyty 324 × 162 cm (tylko całe), +10% zapasu, ceny netto z cennika,
   VAT dolicza silnik wg wariantu (8% z montażem, 23% przy odbiorze własnym).
   Obróbka, wycięcia i montaż — jak przy pozostałych spiekach.
   ───────────────────────────────────────────────────────────────────────── */

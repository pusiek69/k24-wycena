import dekory from '../generated/silestone.dekory.json';
import kolory from '../../scripts/kolory-cosentino.json';
import { VAT, ROBOCIZNA, OPCJE } from './_domyslne.js';

/**
 * SILESTONE (Cosentino) — konglomerat kwarcowy
 *
 * Cennik Cosentino 01.2026 (REV.01, ważny do 31.12.2026). W źródle
 * (`pricing/zrodla`, poza gitem) leżą ceny zakupowe Dawida — potwierdził
 * 27.11.2026, że kwoty z grup cennika to już JEGO ceny, bez dodatkowego
 * rabatu. Tutaj jest wyłącznie cena końcowa netto dla klienta: zakupowa
 * × 1,30.
 *
 * PŁYTA ZALEŻY OD DEKORU, nie od marki. Cosentino sprzedaje dwa formaty
 * i nie każdy kolor ma oba:
 *   Standard  od 290 × 130 cm   (np. White Storm 14, Marengo, Yukon)
 *   Jumbo     od 310 × 150 cm   (np. Arden Blue, cała grupa 7)
 * Cennik podaje je jako ZAKRESY („od 290 × 130 do 306 × 141"), więc
 * liczymy po DOLNEJ granicy. Inaczej kalkulator obiecałby blat, który
 * nie zmieści się w płycie, jaka faktycznie przyjedzie. Format siedzi
 * przy każdej pozycji cennika, a nie tutaj — `plyta` niżej to tylko
 * wartość awaryjna.
 *
 * BEZ POŁÓWEK [DOMYŚLNE]. Cennik o nich nie wspomina; pytanie do
 * przedstawiciela jest otwarte. Liczymy całe płyty, bo to zawyża wycenę,
 * a nie zaniża.
 *
 * WYKOŃCZENIE to realny wybór i realna dopłata: suede i volcano kosztują
 * 10% więcej od polerowanego. Nie każdy kolor ma każde — lista przy
 * każdym dekorze pochodzi wprost z tabeli portfolio w cenniku.
 *
 * ⚠ W tym pliku NIE MA cen zakupowych ani marż — one siedzą wyłącznie
 *   w pricing/zrodla/ (poza gitem i poza buildem).
 */

/** Dekory, przy których dostawca robi dane wykończenie. */
const zWykonczeniem = (co) =>
  Object.entries(kolory.silestone)
    .filter(([, v]) => (v.wykonczenia || []).includes(co))
    .map(([nazwa]) => nazwa);

export default {
  slug: 'silestone',
  nazwa: 'Silestone',
  typ: 'konglomerat kwarcowy',
  kolejnosc: 26,
  aktywna: true,
  trybCeny: 'katalog',

  krotki: 'Konglomerat Cosentino — Hybriq+, 50 kolorów.',
  opis:
    'Konglomerat kwarcowy hiszpańskiej Cosentino, produkowany w technologii ' +
    'Hybriq+ o obniżonej zawartości krzemionki. Od spokojnych bieli i szarości ' +
    'po mocne marmurowe żyłowania z kolekcji Ethereal. Wykończenie polerowane, ' +
    'matowe Suede albo chropowate Volcano — przy części kolorów do wyboru, ' +
    'za dopłatą 10%.',

  linkDekory: {
    url: 'https://www.cosentino.com/pl-pl/colors/?brand=silestone',
    label: 'Zobacz kolory Silestone',
  },

  vat: VAT,
  cenyUslug: 'brutto',

  // Wartość awaryjna — prawdziwy format przychodzi z pozycji cennika.
  plyta: { w: 290, h: 130, polowkaDozwolona: false },
  narzutOdpad: 0.1,

  gruboscDomyslna: '20',
  opisGrubosci: {
    12: '12 mm — lżejsza płyta, zwykle na ściankę lub cienki blat',
    20: '20 mm — standard na blat kuchenny',
    30: '30 mm — masywna, pod duże wyspy',
  },

  robocizna: ROBOCIZNA,

  opcje: [
    {
      id: 'wykonczenieSilestone',
      label: 'Wykończenie powierzchni',
      opis:
        'Poler to gładka, błyszcząca powierzchnia. Suede jest matowa i miękka ' +
        'w dotyku, Volcano wyraźnie chropowata. Suede i Volcano kosztują ' +
        '10% więcej od poleru — tak liczy to cennik Cosentino.',
      typ: 'wybor',
      domyslnie: 'poler',
      wymagane: true,
      warianty: [
        { id: 'poler', label: 'Poler (polerowane)', cena: 0, tylkoDekory: zWykonczeniem('poler') },
        { id: 'suede', label: 'Suede (matowe)', procentMaterialu: 0.1, tylkoDekory: zWykonczeniem('suede') },
        { id: 'volcano', label: 'Volcano (chropowate)', procentMaterialu: 0.1, tylkoDekory: zWykonczeniem('volcano') },
      ],
    },
    ...OPCJE,
  ],

  dekory: dekory.dekory,
};

/* ─────────────────────────────────────────────────────────────────────────
   JAK LICZYMY SILESTONE:
   płyta zależna od dekoru (Standard 290 × 130 albo Jumbo 310 × 150, po
   dolnej granicy zakresu z cennika), TYLKO pełne płyty, +10% zapasu, cena
   końcowa netto z generated (przelicznik w pricing/zrodla, poza gitem),
   VAT wg wariantu: 8% z montażem, 23% przy odbiorze własnym. Grubości
   12/20/30 mm — poza Eclectic Pearl, RAW A i RAW G, które są tylko
   w 20 i 30. Suede i Volcano to +10% do ceny kamienia, dostępne tylko
   przy kolorach z listy w cenniku.
   ───────────────────────────────────────────────────────────────────────── */

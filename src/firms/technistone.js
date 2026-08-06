import dekory from '../generated/technistone.dekory.json';
import promocje from '../generated/technistone.promocje.json';
import { VAT, ROBOCIZNA, OPCJE } from './_domyslne.js';

/**
 * TECHNISTONE — konglomerat kwarcowy (Czechy)
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  TODO — DO DOKOŃCZENIA Z DAWIDEM                                    │
 * │  1. Wgrać aktualny cennik PDF do:                                   │
 * │     C:\Users\kamie\Downloads\CENNIKI\TECHNISTONE\                   │
 * │  2. Przepisać ceny katalogowe netto/m² do:                          │
 * │     pricing/zrodla/technistone.zasady.json  (klucz "katalog")       │
 * │  3. Potwierdzić rabat zakupowy i marżę, ustawić w tym samym pliku    │
 * │     "juzPrzeliczone": false, "rabatZakupowy": …, "marza": …         │
 * │  4. Uruchomić:  npm run cennik                                      │
 * │                                                                     │
 * │  STAN NA DZIŚ: ceny przeniesione ze starej aplikacji (były tam już  │
 * │  przeliczone). Wycena działa, ale traktujemy ją jako TYMCZASOWĄ.    │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ W tym pliku NIE MA rabatów ani cen zakupowych — one siedzą wyłącznie
 *   w pricing/zrodla/ (poza gitem i poza buildem).
 */
export default {
  slug: 'technistone',
  nazwa: 'Technistone',
  typ: 'konglomerat kwarcowy',
  kolejnosc: 15,
  aktywna: true,
  trybCeny: 'katalog',

  krotki: 'Czeski kwarc, mocne biele i calacatty.',
  opis:
    'Konglomerat kwarcowy produkowany w Czechach — od lat na polskim rynku. ' +
    'Bardzo dobre biele (Crystal, Noble), efektowne calacatty i ciemne dekory. ' +
    'Płyta w formacie 318,5 × 155 cm.',

  linkDekory: {
    url: 'https://www.technistone.com/int/pl/dekory',
    label: 'Zobacz dekory Technistone',
  },

  vat: VAT,
  cenyUslug: 'brutto',

  // Technistone: własny format płyty, sprzedaż tylko w całych płytach.
  plyta: { w: 318.5, h: 155, polowkaDozwolona: false },
  narzutOdpad: 0.1,

  opisGrubosci: {
    12: '12 mm — cienki, do zabudowy',
    20: '20 mm — standard na blat kuchenny',
    30: '30 mm — masywny, najbardziej efektowny',
  },

  robocizna: ROBOCIZNA,
  opcje: OPCJE,
  promocje: promocje.kampanie,

  dekory: dekory.dekory,

  // Widoczne dla klienta na ekranie wyniku — bez tego wycena mogłaby zaskoczyć.
  notaKlient:
    'Technistone sprzedaje wyłącznie całe płyty 318,5 × 155 cm — przy małym blacie ' +
    'i tak płacimy za pełną płytę. Resztę materiału możemy wykorzystać np. na parapety lub cokoły.',

};

/* ─────────────────────────────────────────────────────────────────────────
   JAK LICZYMY TECHNISTONE:
   1. Płyty 318,5 × 155 cm i TYLKO całe — nie ma połówek, więc nawet mały
      blat oznacza zakup pełnej płyty (klient jest o tym uprzedzany
      w `notaKlient`).
   2. +10% zapasu na docięcie, VAT 23% na materiał.
   3. Robocizna i obróbki jak przy pozostałych konglomeratach.

   Rabat zakupowy i marża: pricing/zrodla/technistone.zasady.json (poza gitem).
   Stan cennika: DO POTWIERDZENIA — patrz TODO na górze pliku.
   ───────────────────────────────────────────────────────────────────────── */

import dekory from '../generated/marazzi.dekory.json';
import promocje from '../generated/marazzi.promocje.json';
import { VAT, ROBOCIZNA, OPCJE } from './_domyslne.js';

/**
 * MARAZZI — włoski gres wielkoformatowy (kolekcja Grande / The Top)
 * ⚠ Bez rabatów i cen zakupowych — patrz komentarz w avant-quartz.js
 */
export default {
  slug: 'marazzi',
  nazwa: 'Marazzi',
  typ: 'spiek / gres wielkoformatowy',
  kolejnosc: 35,
  aktywna: true,
  trybCeny: 'katalog',

  krotki: 'Włoski gres wielkoformatowy, płyty do 324 cm.',
  opis:
    'Gres porcelanowy wielkoformatowy z Włoch (kolekcja Grande / The Top). ' +
    'Odporny na wysoką temperaturę, plamy i zarysowania — jak spiek. ' +
    'Płyty do 324 cm długości, więc długi blat często idzie bez łączenia. ' +
    'Wzory marmurowe dostępne w book-matchu (lustrzane odbicie dwóch płyt) ' +
    'i w wykończeniach Lux (połysk), Satin (satyna) oraz Naturale (mat).',

  linkDekory: {
    url: 'https://www.marazzigroup.com/grande/',
    label: 'Zobacz wzory Marazzi Grande',
  },

  vat: VAT,
  cenyUslug: 'netto',

  // Płyta 162 × 324 cm — format z cennika dostawcy, ten sam dla 12 i 20 mm.
  // Kupujemy TYLKO całe płyty; przy małym blacie sporo materiału zostaje,
  // dlatego kalkulator sam podpowiada wtedy kolekcję sprzedającą połówki
  // (patrz `tanszaPrzezPolowke` w src/engine/alternatywy.js).
  plyta: { w: 324, h: 162, polowkaDozwolona: false },
  narzutOdpad: 0.1,

  // Na blat: 12 i 20 mm. Pozycje 6 mm (okładziny, fronty mebli) nie wchodzą
  // do kalkulatora w ogóle — nie ma ich nawet w cenniku dla klienta.
  gruboscDomyslna: '12',
  opisGrubosci: {
    12: '12 mm — standard na blat z gresu',
    20: '20 mm — grubszy, bardziej masywny',
  },

  robocizna: ROBOCIZNA,
  opcje: OPCJE,
  promocje: promocje.kampanie,

  dekory: dekory.dekory,
};

/* ─────────────────────────────────────────────────────────────────────────
   JAK LICZYMY MARAZZI:
   płyty 324 × 162 cm (format z cennika), TYLKO całe (bez połówek),
   +10% zapasu, VAT 23% na materiał, robocizna od metra bieżącego.
   Grubości blatowe: 12 i 20 mm. Pozycje 6 mm nie wchodzą do kalkulatora
   w ogóle (decyzja Dawida, 6.08.2026).
   Cennik jest w EUR: przeliczenie i marża siedzą w
   pricing/zrodla/marazzi.zasady.json (poza gitem).
   Kurs EUR/PLN: 4,35 — zatwierdzony przez Dawida 6.08.2026.
   ───────────────────────────────────────────────────────────────────────── */

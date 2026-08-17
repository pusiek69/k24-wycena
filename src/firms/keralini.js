import dekory from '../generated/keralini.dekory.json';
import promocje from '../generated/keralini.promocje.json';
import { VAT, ROBOCIZNA, OPCJE, PLYTA_STANDARD } from './_domyslne.js';
import { dekoryZKampaniami } from './_promocje.js';

/**
 * KERALINI — spiek kwarcowy / ceramika wielkoformatowa (dystrybucja: Architype)
 * ⚠ Bez rabatów i cen zakupowych — patrz komentarz w avant-quartz.js
 */
export default {
  slug: 'keralini',
  nazwa: 'Keralini',
  typ: 'spiek kwarcowy / ceramika',
  kolejnosc: 30,
  aktywna: true,
  trybCeny: 'katalog',

  krotki: 'Odporny na wysoką temperaturę i zarysowania.',
  opis:
    'Spiek kwarcowy (ceramika wielkoformatowa) — wypalany w wysokiej temperaturze. ' +
    'Można postawić gorący garnek prosto z palnika, nie chłonie plam, bardzo odporny na zarysowania. ' +
    'Chłodniejszy w dotyku i cieńszy niż konglomerat.',

  linkDekory: {
    url: 'https://architype.pl/stones/brands=keralini',
    label: 'Zobacz dekory Keralini',
  },

  vat: VAT,
  cenyUslug: 'netto',
  plyta: { ...PLYTA_STANDARD },
  narzutOdpad: 0.1,

  // 6 mm to za cienko na blat kuchenny — pokazujemy tylko grubości blatowe.
  pomijGrubosci: ['6'],
  opisGrubosci: {
    12: '12 mm — standard na blat ze spieku',
    20: '20 mm — grubszy, bardziej masywny',
  },

  robocizna: ROBOCIZNA,
  opcje: OPCJE,
  promocje: promocje.kampanie,

  // Kampania Architype wprowadza wzory spoza cennika podstawowego —
  // bez tego klient nie mógłby ich wybrać (patrz avant-quartz.js).
  dekory: dekoryZKampaniami(dekory.dekory, promocje.kampanie),

};

/* ─────────────────────────────────────────────────────────────────────────
   JAK LICZYMY KERALINI:
   płyty 320 × 160 cm (wolno połówkę), +10% zapasu, VAT 23% na materiał,
   robocizna od metra bieżącego. Na blat kuchenny NIE wyceniamy 6 mm —
   minimum 12 mm (pole `pomijGrubosci`).
   Rabat i marża: pricing/zrodla/keralini.zasady.json (poza gitem).
   ───────────────────────────────────────────────────────────────────────── */

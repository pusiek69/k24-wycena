import dekory from '../generated/atlas-plan.dekory.json';
import { VAT, ROBOCIZNA, OPCJE } from './_domyslne.js';

/**
 * ATLAS PLAN — gres porcelanowy wielkoformatowy (Atlas Concorde, Włochy)
 * ⚠ Bez rabatów i cen zakupowych — patrz komentarz w avant-quartz.js
 */
export default {
  slug: 'atlas-plan',
  nazwa: 'Atlas Plan',
  typ: 'spiek / gres wielkoformatowy',
  kolejnosc: 36,
  aktywna: true,
  trybCeny: 'katalog',

  krotki: 'Włoski gres wielkoformatowy, bogaty wybór wzorów marmurowych.',
  opis:
    'Gres porcelanowy wielkoformatowy Atlas Concorde. Odporny na wysoką temperaturę, ' +
    'plamy i zarysowania — jak każdy spiek. Mocna strona kolekcji to wzory marmurowe, ' +
    'w tym book-match (dwie płyty jak lustrzane odbicie), oraz trzy wykończenia: ' +
    'Polished (połysk), Matte (mat) i Hammered (struktura młotkowana).',

  linkDekory: {
    url: 'https://www.atlasplan.com/en/large-format-porcelain-slabs/',
    label: 'Zobacz wzory Atlas Plan',
  },

  vat: VAT,
  cenyUslug: 'netto',

  // Format domyślny — 12 mm tniemy z płyt 324 × 162 cm. Część pozycji 20 mm
  // ma płytę 324 × 159 cm i taki wpis niesie własny format (patrz cennik).
  // Gres wielkoformatowy kupujemy w całych płytach.
  plyta: { w: 324, h: 162, polowkaDozwolona: false },
  narzutOdpad: 0.1,

  // Na blat: 12 i 20 mm. Pozycji 6 mm (okładziny, fronty, zestawy „Kit Endless")
  // nie ma w cenniku dla klienta w ogóle.
  gruboscDomyslna: '12',
  opisGrubosci: {
    12: '12 mm — standard na blat z gresu',
    20: '20 mm — grubszy, bardziej masywny',
  },

  robocizna: ROBOCIZNA,
  opcje: OPCJE,
  promocje: [],

  dekory: dekory.dekory,
};

/* ─────────────────────────────────────────────────────────────────────────
   JAK LICZYMY ATLAS PLAN:
   płyty 324 × 162 cm (12 mm) i 324 × 159 lub 162 cm (20 mm, zależnie od
   pozycji), TYLKO całe, +10% zapasu, VAT 23% na materiał, robocizna
   od metra bieżącego. Format płyty jest zapisany przy pozycji cennika,
   bo w tej kolekcji różni się w obrębie jednej grubości.
   Cennik jest w EUR: rabat, marża i kurs siedzą w
   pricing/zrodla/atlas-plan.zasady.json (poza gitem).
   ⚠ Kurs EUR/PLN przyjęty jak przy Marazzi (4,35) — do potwierdzenia.
   ───────────────────────────────────────────────────────────────────────── */

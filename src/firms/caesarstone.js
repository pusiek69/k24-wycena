import dekory from '../generated/caesarstone.dekory.json';
import promocje from '../generated/caesarstone.promocje.json';
import { VAT, ROBOCIZNA, OPCJE, PLYTA_STANDARD } from './_domyslne.js';
import { dekoryZKampaniami } from './_promocje.js';

/**
 * CAESARSTONE — konglomerat kwarcowy premium (dystrybucja: Architype)
 * ⚠ Bez rabatów i cen zakupowych — patrz komentarz w avant-quartz.js
 */
export default {
  slug: 'caesarstone',
  nazwa: 'Caesarstone',
  typ: 'konglomerat kwarcowy',
  kolejnosc: 20,
  aktywna: true,
  trybCeny: 'katalog',

  krotki: 'Światowa marka premium, bardzo równa jakość płyt.',
  opis:
    'Kwarc premium z Izraela — jedna z najbardziej rozpoznawalnych marek konglomeratu na świecie. ' +
    'Powtarzalna jakość, wyraziste dekory betonu i marmuru, także w wykończeniu matowym.',

  // Patrz komentarz w avant-quartz.js — filtr marki tylko pojedynczy.
  linkDekory: {
    url: 'https://architype.pl/stones/brands=caesarstone',
    label: 'Zobacz dekory Caesarstone',
  },
  linkiDodatkowe: [
    {
      url: 'https://drive.google.com/drive/u/0/folders/13F4r2MlYdy94rfKyMxyNepf74xyAzt3V',
      label: 'Zdjęcia płyt na żywo',
    },
  ],

  vat: VAT,
  cenyUslug: 'netto',
  plyta: { ...PLYTA_STANDARD },
  narzutOdpad: 0.1,

  opisGrubosci: {
    20: '20 mm — standard na blat kuchenny',
    30: '30 mm — masywny, najbardziej efektowny',
  },

  robocizna: ROBOCIZNA,
  opcje: OPCJE,
  promocje: promocje.kampanie,

  // Kampania Architype wprowadza wzory spoza cennika podstawowego —
  // bez tego klient nie mógłby ich wybrać (patrz avant-quartz.js).
  dekory: dekoryZKampaniami(dekory.dekory, promocje.kampanie),

};

/* ─────────────────────────────────────────────────────────────────────────
   JAK LICZYMY CAESARSTONE — identycznie jak Avant Quartz:
   płyty 320 × 160 cm (wolno połówkę), +10% zapasu, VAT 23% na materiał,
   robocizna od metra bieżącego blatu.
   Rabat i marża: pricing/zrodla/caesarstone.zasady.json (poza gitem).
   ───────────────────────────────────────────────────────────────────────── */

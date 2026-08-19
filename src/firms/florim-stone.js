import dekory from '../generated/florim-stone.dekory.json';
import { VAT, ROBOCIZNA, OPCJE } from './_domyslne.js';

/**
 * FLORIM STONE — włoski gres wielkoformatowy na blaty (płyty 320 × 160 cm)
 *
 * ⚠ Bez rabatów i cen zakupowych — patrz komentarz w avant-quartz.js.
 *
 * Ceny z cennika dostawcy (12.09.2025) są NETTO i mają już wliczoną marżę
 * 30% (potwierdzone przez Dawida), więc trafiają do `generated` jeden do
 * jednego (mnożnik ×1) — dokładnie tak samo jak Laminam. Interstone dzielimy
 * przez 1,23, bo tam ceny publiczne są brutto; tutaj dzielić nie ma czego.
 *
 * Cennik obejmuje WYŁĄCZNIE 12 mm — nie ma dwudziestki, więc kalkulator
 * nie pyta o grubość. Bez promocji i dat wygaśnięcia: ceny są stałe,
 * dlatego nie ma pliku florim-stone.promocje.json.
 */
export default {
  slug: 'florim-stone',
  nazwa: 'Florim Stone',
  typ: 'spiek / gres wielkoformatowy',
  kolejnosc: 38,
  aktywna: true,
  trybCeny: 'katalog',

  krotki: 'Włoski gres na blaty, wzory kamienia i marmuru.',
  opis:
    'Gres porcelanowy wielkoformatowy z Włoch, robiony pod blaty kuchenne i meblowe. ' +
    'Wytrzyma gorący garnek, nie chłonie plam i bardzo trudno go zarysować. ' +
    'Kolekcje: marmury, kamienie naturalne, betony, metal i kolory jednolite, ' +
    'w wykończeniach mat, poler, velvet, leather, silk i lithos.',

  linkDekory: {
    url: 'https://www.florim.com/en/products/brand/florim-stone',
    label: 'Zobacz wzory Florim Stone',
  },

  vat: VAT,
  cenyUslug: 'brutto',

  // Płyta 320 × 160 cm z cennika hurtowego. Kupujemy TYLKO całe płyty —
  // połówek dostawca nie sprzedaje (decyzja Dawida, 19.08.2026), tak samo
  // jak przy Laminamie, Marazzi i Atlas Planie.
  plyta: { w: 320, h: 160, polowkaDozwolona: false },
  narzutOdpad: 0.1,

  // W cenniku jest sama dwunastka — nie ma czego pomijać ani z czego wybierać.
  gruboscDomyslna: '12',
  opisGrubosci: {
    12: '12 mm — jedyna grubość w tym cenniku',
  },

  robocizna: ROBOCIZNA,
  opcje: OPCJE,

  dekory: dekory.dekory,
};

/* ─────────────────────────────────────────────────────────────────────────
   JAK LICZYMY FLORIM STONE:
   płyty 320 × 160 cm (tylko całe), +10% zapasu, ceny netto z cennika
   (marża wliczona przez dostawcę), VAT dolicza silnik wg wariantu
   — 8% z montażem, 23% przy odbiorze własnym.
   Jedyna grubość to 12 mm. Obróbka, wycięcia i montaż — jak przy
   pozostałych spiekach.
   Nazwy dekorów: „KOLEKCJA — NAZWA wykończenie", np. „Marble — Statuario
   poler". Zapis „mat/leather" znaczy, że pozycja jest w obu wykończeniach
   w tej samej cenie (w cenniku skracane do „mat/let").
   ───────────────────────────────────────────────────────────────────────── */

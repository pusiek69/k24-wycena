import dekory from '../generated/interq.dekory.json';
import { VAT, ROBOCIZNA, OPCJE, PLYTA_STANDARD } from './_domyslne.js';

/**
 * INTERQ — konglomerat kwarcowy (kategoria dostawcy: „kwarco-granity")
 *
 * ⚠ Bez rabatów i cen zakupowych — patrz komentarz w avant-quartz.js.
 *   Przelicznik z cennika detalicznego dostawcy na cenę dla klienta
 *   siedzi w pricing/zrodla/interq.zasady.json (poza gitem).
 *
 * Konwencja netto/VAT jak przy Laminam i Florim: w `generated` stoi cena
 * końcowa NETTO za m², a VAT (8% z montażem / 23% odbiór) dolicza silnik.
 *
 * Cennik z 20.08.2026: wyłącznie grubość 20 mm, płyta 1600 × 3200 mm.
 * Wykończenie (Polished/Brushed) jest częścią nazwy dekoru — Marfil
 * i Taj Mahal występują w obu, każde w innej cenie.
 */
export default {
  slug: 'interq',
  nazwa: 'InterQ',
  typ: 'konglomerat kwarcowy',
  kolejnosc: 25,
  aktywna: true,
  trybCeny: 'katalog',

  krotki: 'Kwarco-granity — wzory marmurów i kwarcytów.',
  opis:
    'Konglomerat kwarcowy z linii kwarco-granitów — wzory inspirowane marmurem ' +
    '(Calacatta, Carrara, Marfil) i kwarcytem (Taj Mahal, Patagonia). ' +
    'Twardy, nienasiąkliwy i odporny na plamy; wykończenie polerowane ' +
    'albo szczotkowane (Brushed).',

  linkDekory: {
    url: 'https://www.interstone.pl/produkt-kategoria/konglomerat',
    label: 'Zobacz wzory InterQ',
  },

  vat: VAT,
  cenyUslug: 'brutto',

  // Płyta 1600 × 3200 mm — format standardowy konglomeratów; tak jak przy
  // Avant Quartz i Caesarstone można kupić połówkę płyty.
  plyta: { ...PLYTA_STANDARD },
  narzutOdpad: 0.1,

  // Cennik ma tylko dwudziestkę.
  gruboscDomyslna: '20',
  opisGrubosci: {
    20: '20 mm — jedyna grubość w tym cenniku',
  },

  robocizna: ROBOCIZNA,
  opcje: OPCJE,

  dekory: dekory.dekory,
};

/* ─────────────────────────────────────────────────────────────────────────
   JAK LICZYMY INTERQ:
   płyty 320 × 160 cm (połówki dozwolone), +10% zapasu, cena końcowa netto
   z generated (przelicznik w pricing/zrodla, poza gitem), VAT wg wariantu:
   8% z montażem, 23% przy odbiorze własnym. Jedyna grubość: 20 mm.
   Obróbka, wycięcia i montaż — jak przy pozostałych konglomeratach.
   ───────────────────────────────────────────────────────────────────────── */

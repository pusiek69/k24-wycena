import dekory from '../generated/interq.dekory.json';
import promocje from '../generated/interq.promocje.json';
import { VAT, ROBOCIZNA, OPCJE, PLYTA_STANDARD } from './_domyslne.js';

/**
 * INTERQ — konglomerat kwarcowy (kategoria dostawcy: „kwarco-granity")
 *
 * ⚠ Bez rabatów i cen zakupowych — patrz komentarz w avant-quartz.js.
 *   Sposób dojścia do cen klienta siedzi w pricing/zrodla/interq.zasady.json
 *   (poza gitem) — cennik ma DWIE części o różnych zasadach, więc w źródle
 *   stoją już kwoty końcowe (juzPrzeliczone).
 *
 * Konwencja netto/VAT jak przy Laminam i Florim: w `generated` stoi cena
 * końcowa NETTO za m², a VAT (8% z montażem / 23% odbiór) dolicza silnik.
 *
 * Cennik z 20.08.2026 (dwa obrazki od Dawida): część 1 to katalog dostawcy,
 * część 2 to dekory NA STANIE W POLSCE (krótszy termin). Płyta 1600 × 3200 mm,
 * grubości 20 mm i — przy pojedynczych wzorach ze stanu — 30 mm.
 * Wykończenie (Polished/Brushed) jest częścią nazwy dekoru — Marfil,
 * Taj Mahal i Harmony występują w dwóch wersjach, każda w innej cenie.
 * Angel White Polished łączy obie części: 20 mm z katalogu, 30 mm ze stanu
 * (stąd nietypowo trzydziestka jest tańsza od dwudziestki — inna podstawa
 * cenowa, świadoma decyzja Dawida z 20.08.2026).
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

  // Płyta 1600 × 3200 mm. Dostawca sprzedaje WYŁĄCZNIE pełne płyty —
  // bez połówek, także 30 mm ze stanu (korekta Dawida, 21.08.2026;
  // wcześniej błędnie przyjęliśmy zasadę Avant/Caesarstone).
  plyta: { ...PLYTA_STANDARD, polowkaDozwolona: false },
  narzutOdpad: 0.1,

  gruboscDomyslna: '20',
  opisGrubosci: {
    20: '20 mm — standard na blat z konglomeratu',
    30: '30 mm — grubszy, masywniejszy (wybrane wzory ze stanu w Polsce)',
  },

  robocizna: ROBOCIZNA,
  opcje: OPCJE,
  promocje: promocje.kampanie,

  dekory: dekory.dekory,
};

/* ─────────────────────────────────────────────────────────────────────────
   JAK LICZYMY INTERQ:
   płyty 320 × 160 cm (połówki dozwolone), +10% zapasu, cena końcowa netto
   z generated (przelicznik w pricing/zrodla, poza gitem), VAT wg wariantu:
   8% z montażem, 23% przy odbiorze własnym. Jedyna grubość: 20 mm.
   Obróbka, wycięcia i montaż — jak przy pozostałych konglomeratach.
   ───────────────────────────────────────────────────────────────────────── */

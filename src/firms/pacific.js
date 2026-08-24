import dekory from '../generated/pacific.dekory.json';
import { VAT, ROBOCIZNA, OPCJE } from './_domyslne.js';

/**
 * PACIFIC — konglomerat kwarcowy
 *
 * Cennik od Dawida (zrzut, 25.08.2026). W źródle (`pricing/zrodla`, poza
 * gitem) leżą jego ceny ZAKUPOWE BRUTTO; tutaj jest już wyłącznie cena
 * końcowa netto dla klienta — zakupowa × 1,30, sprowadzona do netto.
 *
 * PŁYTA 348 × 201 cm. To najbardziej nietypowy format w całym kalkulatorze:
 * szerszy i wyższy od standardowych 320 × 160. Ma znaczenie podwójne —
 * przy liczeniu, ile płyt trzeba kupić, i przy rozrysie, bo z takiej płyty
 * wychodzi blat, który na zwykłej wymagałby łączenia.
 *
 * SPRZEDAŻ TYLKO PEŁNYMI PŁYTAMI — bez połówek (potwierdził Dawid
 * 25.08.2026), tak samo jak przy InterQ.
 *
 * ⚠ W tym pliku NIE MA cen zakupowych ani marż — one siedzą wyłącznie
 *   w pricing/zrodla/ (poza gitem i poza buildem).
 */
export default {
  slug: 'pacific',
  nazwa: 'Pacific',
  typ: 'konglomerat kwarcowy',
  kolejnosc: 27,
  aktywna: true,
  trybCeny: 'katalog',

  krotki: 'Konglomerat na wielkiej płycie 348 × 201 cm.',
  opis:
    'Konglomerat kwarcowy na płycie 348 × 201 cm — największym formacie ' +
    'w naszym kalkulatorze. Długi blat wychodzi z jednej płyty tam, gdzie ' +
    'przy standardowych 320 cm trzeba by go łączyć. Wzory od czystych bieli ' +
    'po marmurowe żyłowania; przy większości dekorów dostępne wykończenie ' +
    'matowe Matt/Suede za dopłatą.',

  vat: VAT,
  cenyUslug: 'brutto',

  // 348 × 201 cm. Dostawca sprzedaje WYŁĄCZNIE pełne płyty — bez połówek
  // (decyzja Dawida 25.08.2026, ta sama zasada co przy InterQ).
  plyta: { w: 348, h: 201, polowkaDozwolona: false },
  narzutOdpad: 0.1,

  gruboscDomyslna: '20',
  opisGrubosci: {
    20: '20 mm — jedyna grubość w tym cenniku',
  },

  robocizna: ROBOCIZNA,

  /*
   * WYKOŃCZENIE MATT / SUEDE — dopłata tylko przy części wzorów.
   *
   * W cenniku Dawida oznaczone gwiazdką (27 z 33 dekorów). Podmieniamy
   * standardową opcję „mat" na wersję z ceną Pacifica i listą dekorów;
   * przy pozostałych wzorach opcja w ogóle się nie pokazuje — patrz
   * engine/opcje-dekoru.js.
   */
  opcje: OPCJE.map((o) =>
    o.id === 'mat'
      ? {
          ...o,
          label: 'Wykończenie Matt / Suede',
          opis:
            'Powierzchnia matowa (Suede) zamiast polerowanej — dopłata dostawcy, ' +
            'liczona od metrażu materiału. Dostępna przy wybranych wzorach.',
          cena: dekory.wykonczenie.cena,
          // Cena z CENNIKA DOSTAWCY — stawka „mat" z panelu jej nie rusza.
          zCennika: true,
          tylkoDekory: dekory.wykonczenie.dekory,
        }
      : o
  ),

  dekory: dekory.dekory,
};

/* ─────────────────────────────────────────────────────────────────────────
   JAK LICZYMY PACIFIC:
   płyty 348 × 201 cm, TYLKO pełne (bez połówek), +10% zapasu, cena końcowa
   netto z generated (przelicznik w pricing/zrodla, poza gitem), VAT wg
   wariantu: 8% z montażem, 23% przy odbiorze własnym. Jedyna grubość 20 mm.
   Matt/Suede to dopłata za m² materiału, dostępna przy wzorach z listy.
   Obróbka, wycięcia i montaż — jak przy pozostałych konglomeratach.
   ───────────────────────────────────────────────────────────────────────── */

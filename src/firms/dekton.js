import dekory from '../generated/dekton.dekory.json';
import kolory from '../../scripts/kolory-cosentino.json';
import { VAT, ROBOCIZNA, OPCJE } from './_domyslne.js';

/**
 * DEKTON (Cosentino) — spiek kwarcowy
 *
 * Cennik Cosentino 01.2026 (REV.01, ważny do 31.12.2026). Ceny zakupowe
 * Dawida siedzą w `pricing/zrodla` (poza gitem); tutaj jest wyłącznie
 * cena końcowa netto dla klienta: zakupowa × 1,30.
 *
 * TRZY FORMATY PŁYT, I NIE KAŻDY KOLOR MA KAŻDY:
 *   od 320 × 144 cm   grubości 8, 12, 20 mm
 *   300 × 100 cm      na życzenie, cienkie grubości
 *   od 330 × 163 cm   grubości 8, 12, 20 mm
 * Cennik rozpisuje dostępność osobno dla KAŻDEJ PARY kolor × grubość —
 * Daze jest tylko w 330 × 163 i tylko w 8 mm, Keon tylko w 320 × 144
 * w 8 i 12 mm, a Laurent we wszystkich trzech formatach. Dlatego format
 * siedzi przy każdej pozycji cennika, a `plyta` niżej to tylko wartość
 * awaryjna. Wymiary bierzemy po DOLNEJ granicy („od 320 × 144").
 *
 * GRUBOŚĆ 4 mm POMINIĘTA [DOMYŚLNE]. Dekton 4 mm jedzie z siatką
 * zabezpieczającą na plecach — to materiał okładzinowy, nie blatowy.
 * Gdyby wszedł do kalkulatora, klient wybrałby najtańszą pozycję
 * i dostał wycenę na coś, czego Dawid nie zrobi.
 *
 * BEZ POŁÓWEK [DOMYŚLNE] — cennik o nich nie wspomina, pytanie do
 * przedstawiciela otwarte. Liczymy całe płyty.
 *
 * WYKOŃCZENIE NIE JEST WYBOREM. W Dektonie to cecha koloru: Entzo jest
 * matowy, Laurent ma teksturowany mat, Marina velvet, Trance poler
 * X-Gloss. Dlatego pokazujemy je jako opis przy nazwie, a nie jako
 * kontrolkę. Grip+ pomijamy — cennik mówi wprost: tylko podłogi, zawsze
 * na specjalne zamówienie.
 *
 * ⚠ W tym pliku NIE MA cen zakupowych ani marż.
 */

const NAZWY_WYKONCZEN = {
  poler: 'poler (X-Gloss)',
  mat: 'mat',
  'teksturowany-mat': 'teksturowany mat',
  velvet: 'velvet',
  'teksturowany-velvet': 'teksturowany velvet',
};

/** Dekor → nazwa wykończenia, do pokazania przy kolorze. */
export const WYKONCZENIE_DEKORU = Object.fromEntries(
  Object.entries(kolory.dekton)
    .filter(([, v]) => v.tekstura)
    .map(([nazwa, v]) => [nazwa, NAZWY_WYKONCZEN[v.tekstura] || v.tekstura])
);

export default {
  slug: 'dekton',
  nazwa: 'Dekton',
  typ: 'spiek kwarcowy',
  kolejnosc: 28,
  aktywna: true,
  trybCeny: 'katalog',

  krotki: 'Spiek Cosentino — płyty do 330 × 163 cm.',
  opis:
    'Spiek kwarcowy hiszpańskiej Cosentino — bardzo twardy, odporny na ' +
    'temperaturę i plamy, więc dobrze znosi blat roboczy i wyspę. Płyty ' +
    'sięgają 330 × 163 cm, czyli więcej niż typowe 320 × 160: długi blat ' +
    'wychodzi z jednej sztuki tam, gdzie indziej trzeba by go łączyć. ' +
    'Każdy kolor ma swoje wykończenie — matowe, teksturowane, velvet ' +
    'albo polerowane X-Gloss.',

  linkDekory: {
    url: 'https://www.cosentino.com/pl-pl/colors/?brand=dekton',
    label: 'Zobacz kolory Dekton',
  },

  vat: VAT,
  cenyUslug: 'brutto',

  // Wartość awaryjna — prawdziwy format przychodzi z pozycji cennika.
  plyta: { w: 320, h: 144, polowkaDozwolona: false },
  narzutOdpad: 0.1,

  gruboscDomyslna: '12',
  opisGrubosci: {
    8: '8 mm — cienka płyta, na okładziny i lekkie blaty',
    12: '12 mm — standard na blat',
    20: '20 mm — masywna, pod wyspy i grube krawędzie',
  },

  robocizna: ROBOCIZNA,
  opcje: OPCJE,

  dekory: dekory.dekory,
};

/* ─────────────────────────────────────────────────────────────────────────
   JAK LICZYMY DEKTON:
   płyta zależna od dekoru I grubości (320 × 144, 300 × 100 albo 330 × 163,
   po dolnej granicy zakresu), TYLKO pełne płyty, +10% zapasu, cena końcowa
   netto z generated, VAT wg wariantu: 8% z montażem, 23% przy odbiorze
   własnym. Grubości 8/12/20 mm — tylko te, które cennik daje dla danego
   koloru. Wykończenie jest cechą koloru, nie dopłatą.
   ───────────────────────────────────────────────────────────────────────── */

import dekory from '../generated/avant-quartz.dekory.json';
import promocje from '../generated/avant-quartz.promocje.json';
import { VAT, ROBOCIZNA, OPCJE, PLYTA_STANDARD } from './_domyslne.js';
import { dekoryZKampaniami } from './_promocje.js';

/**
 * AVANT QUARTZ — konglomerat kwarcowy (dystrybucja: Architype)
 *
 * ⚠ W TYM PLIKU NIE WPISUJEMY RABATÓW ANI CEN ZAKUPOWYCH.
 *   Ten plik trafia w całości do przeglądarki klienta.
 *   Ceny w `dekory` to gotowe ceny KOŃCOWE netto/m² — generuje je
 *   `npm run cennik` z pliku pricing/zrodla/avant-quartz.zasady.json.
 */
export default {
  slug: 'avant-quartz',
  nazwa: 'Avant Quartz',
  typ: 'konglomerat kwarcowy',
  kolejnosc: 10,
  aktywna: true,
  trybCeny: 'katalog',

  krotki: 'Najszerszy wybór wzorów, ciepły w dotyku.',
  opis:
    'Konglomerat kwarcowy — ok. 90% naturalnego kwarcu. Ciepły w dotyku, nienasiąkliwy, ' +
    'bogata paleta bieli, betonów i marmurowych calacatt. Najczęściej wybierany na blaty kuchenne.',

  // Filtr marki MUSI być pojedynczy. Wspólny adres „brands=avant-quartz,caesarstone"
  // pokazywał klientowi obie marki naraz — klikał „dekory Avant Quartz",
  // a dostawał listę wymieszaną z Caesarstone (zgłoszone przez Dawida).
  linkDekory: {
    url: 'https://architype.pl/stones/brands=avant-quartz',
    label: 'Zobacz dekory Avant Quartz',
  },
  linkiDodatkowe: [
    {
      url: 'https://drive.google.com/drive/u/0/folders/13F4r2MlYdy94rfKyMxyNepf74xyAzt3V',
      label: 'Zdjęcia płyt na żywo',
    },
  ],

  vat: VAT,
  cenyUslug: 'brutto',
  plyta: { ...PLYTA_STANDARD },
  narzutOdpad: 0.1,

  opisGrubosci: {
    15: '15 mm — lekki, ekonomiczny',
    20: '20 mm — standard na blat kuchenny',
    30: '30 mm — masywny, najbardziej efektowny',
  },

  robocizna: ROBOCIZNA,
  opcje: OPCJE,

  // Kampanie promocyjne dostawcy — silnik sprawdza WSZYSTKIE aktywne naraz
  // i bierze pierwszą pasującą. Po dacie `do` wraca cena podstawowa.
  // Ceny w pliku to gotowe ceny końcowe netto/m² dla klienta.
  promocje: promocje.kampanie,

  // Kampania Architype wprowadza wzory spoza cennika podstawowego
  // (np. Calacatta Modane). Bez tego klient nie mógłby ich wybrać,
  // choć konsultant już o nich mówi — promocja byłaby w połowie niewidoczna.
  dekory: dekoryZKampaniami(dekory.dekory, promocje.kampanie),

};

/* ─────────────────────────────────────────────────────────────────────────
   JAK LICZYMY AVANT QUARTZ  (opis metody — komentarz, NIE trafia do bundla)

   1. Odcinki blatu pakujemy w płyty 320 × 160 cm; wolno kupić połówkę płyty.
   2. Do wysokości pasów doliczamy 10% zapasu na docięcie i pasowanie.
   3. Klient płaci za CAŁY kupiony materiał (płyty / połówki), nie za sam
      metraż blatu — resztka zostaje u klienta albo idzie na parapety.
   4. Materiał = cena m² (z src/generated) × kupiony metraż, + VAT 23%.
   5. Robocizna: obróbka 350 zł/m.b. + montaż 150 zł/m.b. (kwoty brutto).
   6. Obróbki dodatkowe — ryczałtem wg _domyslne.js.

   Rabat zakupowy i marża: pricing/zrodla/avant-quartz.zasady.json (poza gitem).
   ───────────────────────────────────────────────────────────────────────── */

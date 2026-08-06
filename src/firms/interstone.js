import { VAT, ROBOCIZNA, OPCJE } from './_domyslne.js';

/**
 * INTERSTONE — KAMIEŃ NATURALNY (granit, marmur, kwarcyt) + spieki Laminam
 *
 * Tu NIE MA cennika dekorów i nie będzie: każda płyta kamienia naturalnego
 * jest inna (rysunek, kolor, dostępność), a ceny na interstone.pl są podane
 * już z marżą Dawida. Dlatego:
 *
 *   • klient domyślnie idzie ścieżką „obejrzyj płyty / umów pomiar",
 *   • ale można też wpisać cenę z magazynu ręcznie i policzyć wycenę
 *     (przydatne, gdy Dawid liczy przy kliencie albo przez telefon).
 *
 * CENY SĄ NETTO — sprawdzone na postach Dawida z fanpage'a (sierpień 2026):
 *   AZUL BAHIA    3030,72 zł brutto ÷ 1,23 = 2464 zł netto (równe)
 *   ANDORA WHITE  1013,52 zł brutto ÷ 1,23 =  824 zł netto (równe)
 * Obie kwoty netto wychodzą na pełne złote, więc stan magazynowy interstone.pl
 * podaje NETTO, a Dawid publikuje brutto. Stąd `cenaRecznaJest: 'netto'`.
 */
export default {
  slug: 'interstone',
  nazwa: 'Kamień naturalny',
  typ: 'granit · marmur · kwarcyt',
  kolejnosc: 40,
  aktywna: true,

  trybCeny: 'reczna',
  // Kamienia naturalnego nie kupujemy „w płytach z cennika" — rozliczamy metraż
  // konkretnej płyty wybranej na placu.
  rozliczenieMaterialu: 'metraz',
  // Ceny ze stanu magazynowego interstone.pl są JUŻ z marżą i podane NETTO
  // (potwierdzone przeliczeniem z postów na fanpage'u — patrz komentarz wyżej).
  cenaRecznaJest: 'netto',

  krotki: 'Niepowtarzalny — każda płyta jedyna w swoim rodzaju.',
  opis:
    'Granit, marmur i kwarcyt prosto z placu. Każda płyta ma własny rysunek, więc dekor ' +
    'wybiera się na żywo — zapraszamy do Tarnobrzega albo wysyłamy zdjęcia konkretnych płyt. ' +
    'Cenę materiału podajemy po wskazaniu płyty.',

  linkDekory: {
    url: 'https://www.interstone.pl/stan-magazynowy',
    label: 'Zobacz płyty dostępne w magazynie',
  },
  linkiDodatkowe: [
    {
      url: 'https://drive.google.com/drive/u/0/folders/12IQfkunhX_hiY-92gJQNIELMUoKn0-K8',
      label: 'Przykładowe płyty — zdjęcia',
    },
  ],

  vat: VAT,
  cenyUslug: 'brutto',
  plyta: { w: 300, h: 180, polowkaDozwolona: true },
  narzutOdpad: 0.15, // kamień naturalny — większy odpad (rysunek, pęknięcia, dobór)

  opisGrubosci: {
    20: '20 mm — standard',
    30: '30 mm — masywny',
  },

  robocizna: ROBOCIZNA,
  opcje: OPCJE,

  // Ekran „ręcznej ceny" — teksty dla klienta.
  reczna: {
    naglowek: 'Cena płyty kamienia naturalnego',
    opis:
      'Ceny kamienia naturalnego zależą od konkretnej płyty. Jeśli ma Pan/Pani wybraną ' +
      'płytę ze stanu magazynowego — proszę wpisać jej cenę za m², a policzymy całość. ' +
      'Jeśli nie — zapraszamy na plac albo dzwońmy: dobierzemy płytę i podamy cenę.',
    etykietaPola: 'Cena płyty za m² (ze stanu magazynowego)',
  },

  notaKlient:
    'Kamień naturalny wybieramy z konkretnej płyty. Ostateczna cena zależy od wybranego ' +
    'bloku i dostępności — potwierdzamy ją zawsze przed zamówieniem.',

};

/* ─────────────────────────────────────────────────────────────────────────
   JAK LICZYMY KAMIEŃ NATURALNY:
   1. Materiał = cena m² wskazanej płyty × metraż blatu + 15% na odpad
      (rysunek kamienia, dobór, pęknięcia). Nie liczymy całych płyt —
      przy kamieniu naturalnym rozliczamy metraż (`rozliczenieMaterialu`).
   2. Ceny ze stanu magazynowego interstone.pl są podane tak, że nic do nich
      nie doliczamy poza VAT — dlatego pole `cenaRecznaJest` mówi tylko,
      czy wpisana kwota jest netto czy brutto.
   3. Bez wpisanej ceny wycena i tak działa: pokazujemy samą obróbkę
      i montaż, a materiał zostaje „do ustalenia" + CTA na telefon.
   4. Robocizna i obróbki jak przy konglomeratach.
   ───────────────────────────────────────────────────────────────────────── */

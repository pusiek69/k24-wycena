/**
 * Domyślne stawki naszego zakładu (robocizna i obróbki).
 *
 * To NIE są ceny dostawcy — to nasza praca. Dlatego są wspólne dla firm,
 * a plik konkretnej firmy może je nadpisać w całości albo po kawałku.
 * Wszystkie kwoty tutaj są BRUTTO (tak jak podajemy klientowi).
 *
 * Pliki zaczynające się od „_" nie są traktowane jak firmy.
 */

export const VAT = 0.23;

export const ROBOCIZNA = [
  {
    id: 'obrobka',
    label: 'Obróbka: docięcie, polerowanie krawędzi, klejenie',
    cena: 350,
    per: 'mb',
  },
  /*
   * MONTAŻ: baza raz na zamówienie + stawka od powierzchni blatu.
   *
   * Wcześniej było 150 zł od metra bieżącego. To zakładało, że koszt wyjazdu
   * rośnie proporcjonalnie do długości blatu — a nie rośnie. Ekipa jedzie,
   * wnosi, poziomuje i sylikonuje tak samo przy blacie łazienkowym, jak przy
   * kuchni; różni się dopiero czas przy większej powierzchni. Przy małych
   * zleceniach wycena wychodziła przez to wyraźnie poniżej rynku
   * (zgłoszenie Dawida, sierpień 2026).
   *
   * `baza` naliczana JEDEN raz na całą wycenę, niezależnie od liczby
   * elementów i pomieszczeń. Stawka liczona od powierzchni ELEMENTÓW blatu
   * (`per: 'm2blatu'`), a nie od zużytej płyty — klient płaci za to,
   * co mu zostaje na szafkach, nie za ścinkę.
   */
  {
    id: 'montaz',
    label: 'Transport i montaż u klienta',
    // 1500 zł przy wprowadzeniu formuły, 800 zł od 17.08.2026 (korekta Dawida).
    baza: 800,
    cena: 200,
    per: 'm2blatu',
    // Odpada w całości przy odbiorze własnym z zakładu — razem z bazą,
    // stawką od metra i transportem. Reszta produkcji zostaje bez zmian.
    tylkoZMontazem: true,
  },
];

/**
 * ODBIÓR WŁASNY — blat do odebrania z zakładu, bez montażu.
 *
 * Klient bierze na siebie dwie rzeczy: transport i, co ważniejsze, POPRAWNOŚĆ
 * WYMIARÓW. Przy montażu robimy pomiar Prolinerem i to my odpowiadamy za to,
 * że blat wejdzie. Przy odbiorze własnym tniemy dokładnie to, co klient poda —
 * i jeśli ściana okaże się krzywa, płyty nie da się już „dociąć z powrotem".
 *
 * Dlatego to zastrzeżenie musi być widoczne w wycenie, a nie schowane
 * w regulaminie.
 */
export const NOTA_ODBIOR =
  'Odbiór własny: blat wykonujemy ŚCIŚLE według wymiarów podanych przez Państwa — ' +
  'bez naszego pomiaru i szablonu. Odpowiedzialność za poprawność wymiarów ' +
  'i dopasowanie do zabudowy jest po stronie zamawiającego. Kamienia po docięciu ' +
  'nie da się poprawić. Odbiór: Tarnobrzeg, ul. Szpitalna 8, po wcześniejszym ustaleniu terminu.';

/*
 * Wycięcie pod zlew i pod płytę grzewczą są w KAŻDEJ wycenie — nie ma
 * wariantu „bez". Klient wybiera tylko rodzaj. Zlewów nie sprzedajemy:
 * wycinamy otwór pod sprzęt, który klient kupuje sam.
 */
export const OPCJE = [
  {
    id: 'zlew',
    label: 'Zlew',
    opis: 'Wycięcie otworu pod zlew klienta — gotowych zlewów nie sprzedajemy.',
    typ: 'wybor',
    domyslnie: 'podblat',
    wymagane: true,
    warianty: [
      { id: 'podblat', label: 'Wycięcie + montaż zlewu podblatowego', cena: 650 },
      { id: 'nablat', label: 'Wycięcie pod zlew nablatowy', cena: 300 },
    ],
  },
  {
    id: 'plyta',
    label: 'Płyta grzewcza',
    opis: 'Licowana = równo z blatem, bez wystającej ramki (250 zł + 400 zł dopłaty).',
    typ: 'wybor',
    domyslnie: 'nakladana',
    wymagane: true,
    warianty: [
      { id: 'nakladana', label: 'Wycięcie pod płytę nakładaną', cena: 250 },
      { id: 'licowana', label: 'Wycięcie pod płytę licowaną z blatem', cena: 650 },
    ],
  },
  /*
   * Otwory w blacie liczymy sztukowo — nie tylko pod baterię. Klient
   * zamawia dziś także dozownik do płynu, gniazdko blatowe czy przelew
   * do zlewu, a każdy taki otwór to osobne wiercenie i wykończenie.
   * Dlatego jedna pozycja z liczbą sztuk zamiast osobnych „ptaszków".
   */
  {
    id: 'otwory',
    label: 'Otwory w blacie (bateria, dozownik, gniazdko)',
    opis: 'Każdy otwór wiercimy i wykańczamy osobno — bateria, dozownik, gniazdko blatowe, przelew.',
    typ: 'liczba',
    cena: 150,
    jednostka: 'szt.',
    domyslnie: 1,
    min: 0,
    max: 6,
  },
  {
    id: 'mat',
    label: 'Powierzchnia matowa lub strukturalna',
    opis: 'Dopłata do wykończenia innego niż polerowane — liczona od m² materiału.',
    typ: 'checkbox',
    cena: 60,
    per: 'm2',
    domyslnie: false,
  },
  {
    id: 'listwa',
    label: 'Listwa przyścienna (cokół z tego samego materiału)',
    typ: 'liczba',
    cena: 180,
    jednostka: 'm.b.',
    max: 40,
    domyslnie: 0,
  },
  {
    id: 'krawedz',
    label: 'Wykończenie krawędzi: fazowanie, zaokrąglenie, podklejka',
    typ: 'liczba',
    cena: 90,
    jednostka: 'm.b.',
    max: 40,
    domyslnie: 0,
  },
];

/** Standardowa płyta konglomeratu. */
export const PLYTA_STANDARD = { w: 320, h: 160, polowkaDozwolona: true };

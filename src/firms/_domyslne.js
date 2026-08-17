/**
 * Domyślne stawki naszego zakładu (robocizna i obróbki).
 *
 * To NIE są ceny dostawcy — to nasza praca. Dlatego są wspólne dla firm,
 * a plik konkretnej firmy może je nadpisać w całości albo po kawałku.
 * Wszystkie kwoty tutaj są BRUTTO (tak jak podajemy klientowi).
 *
 * Pliki zaczynające się od „_" nie są traktowane jak firmy.
 */

/*
 * STAWKI VAT — zależą od tego, co sprzedajemy, a nie od materiału.
 *
 * Blat Z MONTAŻEM to usługa budowlana w obiekcie mieszkalnym objętym
 * społecznym programem mieszkaniowym — 8%. Blat wydany z zakładu bez montażu
 * to zwykła dostawa towaru — 23%. Ta sama płyta, dwie różne stawki, bo różni
 * się przedmiot sprzedaży.
 *
 * 8% dotyczy lokali MIESZKALNYCH. Przy lokalu użytkowym, biurze czy zamówieniu
 * na firmę obowiązuje 23% — dlatego karta klienta mówi o tym wprost, zamiast
 * pokazywać 8% jak pewnik.
 */
export const VAT_MONTAZ = 0.08;
export const VAT_TOWAR = 0.23;

/** Stawka, przy której podane są ceny publiczne dostawców i stawki w cennikach. */
export const VAT = VAT_TOWAR;

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

/*
 * Zlew podblatowy wymaga wypolerowania krawędzi otworu na gotowo — ta krawędź
 * zostaje widoczna i dotykalna. Przy zlewie nablatowym kołnierz sprzętu ją
 * zakrywa, więc obróbka jest prostsza i kosztuje POŁOWĘ (decyzja Dawida,
 * 17.08.2026). Stawka nablatowego jest liczona, a nie wpisana z ręki —
 * zmiana ceny podblatowego ma automatycznie pociągnąć nablatowy.
 *
 * Dotyczy tak samo zlewu w kuchni, jak umywalki w łazience, i mnoży się
 * przez liczbę sztuk (`iloscZ` niżej).
 */
export const ZLEW_PODBLATOWY = 650;
export const UDZIAL_NABLATOWEGO = 0.5;

export const OPCJE = [
  {
    id: 'zlew',
    label: 'Zlew',
    opis: 'Wycięcie otworu pod zlew klienta — gotowych zlewów nie sprzedajemy.',
    typ: 'wybor',
    // Liczba wycięć siedzi w osobnym polu `zlewy` (domyślnie 1). W kuchni
    // zlew jest zwykle jeden, ale w łazience dwie umywalki obok siebie
    // to normalna zabudowa i każde wycięcie to osobna robota.
    iloscZ: 'zlewy',
    domyslnie: 'podblat',
    wymagane: true,
    warianty: [
      { id: 'podblat', label: 'Wycięcie + montaż zlewu podblatowego', cena: ZLEW_PODBLATOWY },
      { id: 'nablat', label: 'Wycięcie pod zlew nablatowy', cena: ZLEW_PODBLATOWY * UDZIAL_NABLATOWEGO },
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

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

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  CENNIK USŁUG — AKTUALIZACJA WG CENNIKA DAWIDA (16.09.2026)
 *
 *  Dawid przysłał zrzut swojego cennika z kolumnami netto / jedn. / brutto
 *  przy VAT 8%. Tu wszystkie stawki usług zapisujemy BRUTTO PRZY 23%
 *  (tak działa `kwotaBrutto` w silniku: dzieli przez 1,23 i mnoży przez
 *  stawkę wyceny), więc liczba w kodzie to `netto × 1,23`.
 *
 *  Sprawdzenie w drugą stronę, bo to jest ta pomyłka, która kosztuje:
 *      netto 250 → w kodzie 308 → 308 / 1,23 × 1,08 = 270 zł brutto ✔
 *      netto 1000 → w kodzie 1230 → 1080 zł brutto ✔
 *
 *  ⚠ STAWKI Z PANELU NADPISUJĄ TE LICZBY (src/app/ustawienia.js). Zmiana
 *  tutaj działa tylko tam, gdzie Dawid nie zapisał własnej wartości —
 *  po zmianie cennika trzeba też przejść przez panel.
 * ══════════════════════════════════════════════════════════════════════════
 */

/**
 * netto z cennika → zapis brutto przy 23%, którego używa silnik.
 *
 * Zostawiamy grosze (2 miejsca), zamiast zaokrąglać do złotówki: przy
 * drobnych stawkach za jednostkę zaokrąglenie potrafi przesunąć cenę
 * o kilka procent. Transport 4 zł/km netto zapisany jako 5 zł brutto@23
 * dałby 4,39 zł/km zamiast 4,32 — a przy 200 km to już 14 zł różnicy.
 * Kwoty pozycji i tak zaokrągla się na końcu do pełnych złotych.
 */
export const zCennika = (netto) => Math.round(netto * 1.23 * 100) / 100;

export const ROBOCIZNA = [
  /*
   * DOCIĘCIE, POLEROWANIE I KLEJENIE — baza + stawka od m² blatu.
   *
   * Historia tej pozycji, bo jest kręta i łatwo się na niej pomylić:
   *   • do 17.08.2026 — 350 zł za metr bieżący, największa pojedyncza
   *     kwota w wielu wycenach (przy kuchni w U — 2 520 zł),
   *   • 17.08.2026 — Dawid zdjął naliczanie: pozycja została na liście
   *     jako świadczenie „w cenie", z kwotą zero,
   *   • od 21.08.2026 — stawkę przejął panel (`obrobkaZaM2`, domyślnie
   *     200 zł/m²) i PRODUKCJA liczyła ją znowu, choć ta konfiguracja
   *     nadal mówiła „zero",
   *   • 16.09.2026 — polecenie Dawida: „1500 zł podstawa + 150 zł za m²".
   *
   * Wartości w konfiguracji są BRUTTO PRZY 23% (patrz `zCennika`), więc
   * `zCennika(1500)` to 1 500 zł NETTO — dokładnie ta kwota, którą podał
   * Dawid. Przy kuchni z montażem (VAT 8%) klient zobaczy 1 620 zł.
   *
   * `bazaTylkoKuchnia`: stałe 1 500 zł doliczamy tylko do blatów kuchennych
   * — tak brzmiało polecenie („za m² blatu kuchennego"), a przy blacie
   * łazienkowym 0,6 m² podstawa byłaby większa niż cała reszta wyceny.
   * Sama stawka od metra zostaje wszędzie: łazienkowy blat też się tnie
   * i poleruje.
   */
  {
    id: 'obrobka',
    label: 'Docięcie, polerowanie krawędzi, klejenie',
    baza: zCennika(1500),
    bazaTylkoKuchnia: true,
    cena: zCennika(150),
    per: 'm2blatu',
  },
  /*
   * POMIAR CYFROWY PROLINEREM — 1000 zł, raz na zlecenie, TYLKO KUCHNIA.
   *
   * Blat kuchenny jest łączony, wchodzi między ściany i musi trafić w zabudowę
   * co do milimetra — bez pomiaru cyfrowego nie da się go zrobić dobrze.
   * Blat łazienkowy to zwykle jeden prostokąt pod umywalkę: pomiaru Prolinerem
   * tam nie robimy, więc i nie doliczamy (decyzja Dawida, 17.08.2026).
   *
   * `tylkoZMontazem` dla porządku: odbiór własny to jawnie brak pomiaru.
   * W praktyce nie ma kolizji, bo odbiór własny jest wariantem łazienkowym.
   */
  {
    id: 'pomiar',
    label: 'Pomiar cyfrowy Proliner',
    // Cennik Dawida (16.09.2026): 1 000 zł netto = 1 080 zł brutto.
    cena: zCennika(1000),
    tylkoKuchnia: true,
    tylkoZMontazem: true,
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
    // 1500 zł przy wprowadzeniu formuły, przez chwilę 800 zł, i z powrotem
    // 1500 zł — korekta Dawida z 17.08.2026 po usunięciu naliczania obróbki.
    // Obniżka bazy miała sens, dopóki wycenę podnosiło 350 zł za metr bieżący.
    baza: 1500,
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
// Cennik Dawida (16.09.2026): otwór pod zlew podwieszany 450 zł netto = 486 brutto.
export const ZLEW_PODBLATOWY = zCennika(450);
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
    opis: 'Licowana = równo z blatem, bez wystającej ramki.',
    typ: 'wybor',
    domyslnie: 'nakladana',
    wymagane: true,
    warianty: [
      // Cennik Dawida (16.09.2026): 250 zł netto = 270 brutto; licowana 700 = 756.
      { id: 'nakladana', label: 'Wycięcie pod płytę nakładaną', cena: zCennika(250) },
      { id: 'licowana', label: 'Wycięcie pod płytę licowaną z blatem', cena: zCennika(700) },
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
    // Cennik Dawida: wycięcie pod otwór fi do 30 mm i fi 30–69 mm kosztuje
    // tyle samo (150 zł netto = 162 brutto), więc zostaje jedna pozycja.
    cena: zCennika(150),
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

  /*
   * ════════════════════════════════════════════════════════════════════
   *  DODATKI Z CENNIKA DAWIDA (16.09.2026) — WYŁĄCZNIE W EDYTORZE
   *
   *  `tylkoWlasciciel` trzyma je poza kalkulatorem klienta. Powód nie jest
   *  kosmetyczny: klient, który zobaczy dziesięć dodatkowych „ptaszków",
   *  przestaje rozumieć, co zamawia, a wycena online ma być prosta.
   *  Dawid dokłada je przy konkretnej rozmowie, z ilością, którą uzgodnił.
   *
   *  Wszystkie domyślnie 0 — żadna wycena nie urośnie sama z siebie.
   *  Kwoty: netto z cennika przez `zCennika` (patrz nagłówek pliku).
   * ════════════════════════════════════════════════════════════════════
   */
  {
    id: 'zbrojenie',
    label: 'Zbrojenie otworów',
    typ: 'liczba',
    cena: zCennika(200),
    jednostka: 'szt.',
    domyslnie: 0,
    max: 20,
    tylkoWlasciciel: true,
  },
  {
    id: 'kanaliki',
    label: 'Kanaliki / rowki ociekowe',
    typ: 'liczba',
    cena: zCennika(500),
    jednostka: 'szt.',
    domyslnie: 0,
    max: 10,
    tylkoWlasciciel: true,
  },
  {
    id: 'ociekaczSpad',
    label: 'Ociekacz spadkowy (pochylnia)',
    typ: 'liczba',
    cena: zCennika(1000),
    jednostka: 'szt.',
    domyslnie: 0,
    max: 10,
    tylkoWlasciciel: true,
  },
  {
    id: 'ociekaczRowki',
    label: 'Ociekacz z rowkami',
    typ: 'liczba',
    cena: zCennika(1500),
    jednostka: 'szt.',
    domyslnie: 0,
    max: 10,
    tylkoWlasciciel: true,
  },
  {
    id: 'impregnacja',
    label: 'Impregnacja',
    typ: 'liczba',
    cena: zCennika(200),
    jednostka: 'szt.',
    domyslnie: 0,
    max: 20,
    tylkoWlasciciel: true,
  },
  {
    id: 'projektCad',
    label: 'Wykonanie projektu CAD',
    typ: 'liczba',
    cena: zCennika(250),
    jednostka: 'szt.',
    domyslnie: 0,
    max: 10,
    tylkoWlasciciel: true,
  },
  {
    id: 'podswietlenie',
    label: 'Podświetlenie blatów',
    typ: 'liczba',
    cena: zCennika(1050),
    jednostka: 'm²',
    domyslnie: 0,
    max: 40,
    tylkoWlasciciel: true,
  },
  {
    id: 'frezowanie',
    label: 'Frezowanie płyty',
    typ: 'liczba',
    cena: zCennika(100),
    jednostka: 'm²',
    domyslnie: 0,
    max: 60,
    tylkoWlasciciel: true,
  },
  {
    id: 'polerSpodu',
    label: 'Poler spodu',
    typ: 'liczba',
    cena: zCennika(300),
    jednostka: 'm²',
    domyslnie: 0,
    max: 60,
    tylkoWlasciciel: true,
  },
  {
    id: 'nacieciaLed',
    label: 'Nacięcia pod ledy',
    typ: 'liczba',
    cena: zCennika(100),
    jednostka: 'm.b.',
    domyslnie: 0,
    max: 60,
    tylkoWlasciciel: true,
  },
  /*
   * TRANSPORT, DZIEŃ EKIPY I DODATKOWA OSOBA.
   *
   * ⚠ Te trzy stoją OBOK automatycznego „Transportu i montażu u klienta"
   * (baza + stawka od m²), a nie zamiast niego — kalkulator nie wie ani ile
   * jest kilometrów, ani ile dni potrwa montaż. Domyślnie zero, więc nic się
   * nie dubluje samo; przy wycenie liczonej na dni Dawid zeruje montaż
   * automatyczny przyciskiem „0 zł" i wpisuje dni tutaj.
   */
  {
    id: 'transportKm',
    label: 'Transport (dojazd)',
    typ: 'liczba',
    cena: zCennika(4),
    jednostka: 'km',
    domyslnie: 0,
    max: 2000,
    tylkoWlasciciel: true,
  },
  {
    id: 'montazDzien',
    label: 'Montaż — dzień ekipy',
    typ: 'liczba',
    cena: zCennika(3000),
    jednostka: 'dzień',
    domyslnie: 0,
    max: 30,
    tylkoWlasciciel: true,
  },
  {
    id: 'dodatkowaOsoba',
    label: 'Dodatkowa osoba przy montażu',
    typ: 'liczba',
    cena: zCennika(1000),
    jednostka: 'dzień',
    domyslnie: 0,
    max: 30,
    tylkoWlasciciel: true,
  },
];

/** Standardowa płyta konglomeratu. */
export const PLYTA_STANDARD = { w: 320, h: 160, polowkaDozwolona: true };

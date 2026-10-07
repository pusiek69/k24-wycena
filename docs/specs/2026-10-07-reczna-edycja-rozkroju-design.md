# Ręczna edycja rozkroju — projekt (7.10.2026)

Zlecenie Dawida: w panelu właściciela, w widoku „Rozrys płyt", ma być tryb
ręcznego układania elementów na płytach. Propozycja leżała od sierpnia
(„MVP celowo bez przeciągania elementów myszą" — `src/app/rozrys.js`),
teraz dostała zielone światło.

## Co jest nietykalne

**Silnik liczenia płyt (`src/engine/nesting.js`, `src/engine/pakowanie.js`)
i cała wycena — bez zmian.** Ręczna edycja to warstwa PREZENTACJI: bierze
gotowy układ z `rozrysuj()`, pozwala go przestawić i oddaje w tym samym
kształcie. Automat zostaje punktem wyjścia i punktem powrotu.

Kalkulator klienta też bez zmian — tryb widoczny wyłącznie w panelu
właściciela (Powtórz wycenę / Wycena testowa).

## Model i operacje (`src/app/rozkroj-reczny.js`, moduł czysty, bez DOM)

    zUkladu(wynik)                 → model (elementy dostają stabilne id)
    doUkladu(model, plyta)         → { plyty, statystyki } — kształt jak z silnika
    przesun(model, id, {x, y})     → nowy model
    obroc(model, id, {rotacja})    → { model, blad? }   (blokada usłojenia)
    przenies(model, id, nrPlyty)   → nowy model
    dodajPlyte(model)              → nowy model
    usunPlyte(model, nr)           → { model, blad? }   (tylko pusta płyta)
    sprawdz(model, {rzaz, margines}) → [{ typ, nrPlyty, id, komunikat }]

Wszystkie operacje zwracają NOWY model — wejście zostaje nietknięte,
dzięki czemu „Wróć do automatu" to po prostu ponowne `zUkladu(rozrysuj(...))`.

### Reguły walidacji — te same, co w silniku

* **rzaz piły** liczy się WYŁĄCZNIE MIĘDZY ELEMENTAMI: dwa prostokąty są
  rozłączne, gdy dzieli je co najmniej `rzaz` w poziomie albo w pionie.
  Przy krawędzi płyty rzazu nie ma.
* **margines płyty** (domyślnie 0) zawęża pole użyteczne z każdej strony.
* **usłojenie**: przy kamieniu z rysunkiem (`rotacja: false`) obrót jest
  zabroniony — operacja odmawia i oddaje komunikat, zamiast cicho obracać.
* Typy problemów: `kolizja`, `poza-plyta`, `uslojenie`.

### Statystyki

Liczone tym samym wzorem co `statystyki()` w silniku (pole płyt, pole
elementów, odpad, wykorzystanie). Test porównuje `doUkladu(zUkladu(w))`
z oryginalnym wynikiem silnika — nietknięty układ musi dać te same liczby
co do trzeciego miejsca.

## Warstwa UI (`src/app/rozrys.js`, `src/app/rozrys-svg.js`)

* przełącznik **„Edytuj ręcznie"**, w trybie ręcznym badge **„układ ręczny"**,
* przeciąganie elementów po SVG (Pointer Events — jedna obsługa dla myszy
  i dotyku; na telefonie wystarczy samo przesuwanie),
* obrót 90° zaznaczonego elementu, przeniesienie na inną płytę,
  dodanie/usunięcie płyty,
* walidacja na żywo: elementy z problemem na czerwono, lista problemów pod
  rysunkiem, **zapis zablokowany dopóki są kolizje**,
* **„Wróć do automatu"** — przelicza MaxRects od nowa i kasuje ręczny układ,
* gdy liczba płyt po ręcznej edycji różni się od wyceny — ostrzeżenie
  z różnicą. **Ceny nie zmieniamy automatycznie**, decyzja należy do Dawida
  (ta sama zasada, co przy dotychczasowym ostrzeżeniu rozrys↔wycena).

## Zamrożenie z ofertą

`zamrozRozrys()` w `src/app/oferta-dawida.js` dziś ZAWSZE przelicza układ
automatem. Po zmianie: jeśli w stanie jest układ ręczny pasujący do
aktualnej wyceny — idzie on, bez przeliczania. Klient w swojej sekcji widzi
dokładnie to, co Dawid ułożył; jego widok nie zmienia się ani o linijkę.

## Kryteria akceptacji

1. `npm test` zielone, nowe testy modułu ręcznego przechodzą cykl RED→GREEN.
2. Silnik (`engine/nesting.js`, `engine/pakowanie.js`) bez zmian — pilnuje test.
3. Kalkulator klienta bez śladu edycji — pilnuje test skanujący źródła.
4. Zapis zablokowany przy kolizjach.
5. Ręczny układ trafia do oferty zamiast przeliczonego.

---

## Korekta Dawida (7.10.2026, wieczorem): żadnych blokad + magnes

**Żadnych blokad.** Właściciel wie, co robi:

* obrót 90° działa ZAWSZE — przy usłojeniu `obroc()` oddaje `uwaga`
  (nieblokującą), nie `blad`;
* układ z kolizją albo elementem poza płytą też trafia do oferty — czerwień
  na rysunku zostaje jako informacja. `czyMoznaZapisac()` usunięte: funkcja,
  która mówiła „nie wolno", nie ma tu już czego pilnować.

**Magnes (`magnes()`), próg 8 mm.** Złap → przeciągnij → samo się dosunie.
Cztery rodzaje „równo": krawędź płyty (z marginesem, bez rzazu — przy brzegu
nie ma sąsiada), tuż za sąsiadem i tuż przed nim (dokładnie o grubość cięcia),
oraz krawędź w jednej linii z sąsiadem. Liczy się JUŻ W TRAKCIE ciągnięcia,
a złapana linia podkreśla się delikatną złotą kreską na rysunku.

**Mniej przycisków.** „− Pusta płyta" wypada — puste arkusze znikają same
(`uporzadkuj()`), poza ostatnim, który zostaje jako miejsce odkładcze.
„Obróć" i „Na następną płytę" pokazują się dopiero, gdy jakiś element jest
złapany. W trybie ręcznym na stałe widoczne są tylko: badge, „Wróć do
automatu" i „+ Płyta".

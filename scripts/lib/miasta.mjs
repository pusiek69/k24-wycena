/**
 * MIASTA, DLA KTÓRYCH MAMY OSOBNE STRONY.
 *
 * Jedno źródło prawdy: z tej listy powstają nowe strony miast, sekcje FAQ
 * i linkowanie w stopce. Dopisanie miasta to dopisanie wiersza tutaj.
 *
 * ODMIANA jest podana wprost, a nie zgadywana z końcówki — polskie nazwy
 * miejscowości odmieniają się zbyt nieregularnie, żeby to automatyzować
 * („w Nowej Dębie", „w Ostrowcu Świętokrzyskim", „w Kielcach").
 *
 * `daleko: true` znaczy, że miasto leży poza promieniem bezpłatnego
 * pomiaru (~100 km od Tarnobrzega). Wtedy strona i FAQ mówią o tym
 * WPROST — obiecywanie darmowego dojazdu 160 km w jedną stronę byłoby
 * obietnicą, której nie chcemy składać.
 */
/*
 * ═══════════════════════════════════════════════════════════════════════
 *  KILOMETRAŻE SPRAWDZONE W MAPACH GOOGLE (27.09.2026)
 *
 *  Trzy miasta z rzędu (Sandomierz 25.09, Mielec 26.09, Rzeszów 27.09)
 *  miały `km` wzięte z pamięci i każde było błędne — więc przejechaliśmy
 *  Mapami WSZYSTKIE piętnaście, trasa autem ze Szpitalnej 8 do centrum
 *  miasta. Pomiar (km / czas najszybszej trasy):
 *
 *    Sandomierz 16,5 / 24 min      Nowa Dęba   18,6 / 19 min
 *    Stalowa Wola 29,6 / 30 min    Nisko        37,5 / 40 min
 *    Mielec     40,1 / 40 min      Staszów      46,0 / 39 min
 *    Opatów     46,6 / 48 min      Ostrowiec Św. 64,6 / 1 h 04
 *    Rzeszów    72,1 / 1 h 11      Dębica       72,2 / 1 h 05
 *    Starachowice 92,5 / 1 h 32    Kielce      102   / 1 h 31
 *    Lublin    157   / 1 h 42      Kraków      190   / 2 h 16
 *
 *  Zasada zaokrąglania: do pełnych pięciu kilometrów, ale NIGDY w dół
 *  o więcej niż 2 km — obiecany dojazd ma być nie krótszy niż prawdziwy.
 *  `czas` podajemy jawnie wszędzie tam, gdzie domyślne przeliczenie
 *  generatora (1 km = 1 min) rozmija się z Mapami o więcej niż kwadrans.
 * ═══════════════════════════════════════════════════════════════════════
 */
export const MIASTA = [
  // ── istniejące strony (kolejność jak w stopce) ──────────────────────
  {
    slug: 'tarnobrzeg', nazwa: 'Tarnobrzeg', wMiescie: 'Tarnobrzegu', doMiasta: 'Tarnobrzega',
    km: 0, nowa: false, daleko: false,
    // Link zwrotny do Mielca — miasta priorytetowego — z najmocniejszej strony.
    dodatkowiSasiedzi: ['mielec'],
    // Tytuł i opis pod „blaty kuchenne kamienne tarnobrzeg" (poz. 6,5, 0 klik.)
    // i „blaty granitowe tarnobrzeg" (Ignikom #1) — zmiana z 14.09.2026.
    tytul: 'Blaty kuchenne kamienne Tarnobrzeg — granit, spiek, kwarc',
    opis:
      'Blaty kuchenne kamienne Tarnobrzeg — granitowe, ze spieku i konglomeratu na wymiar. ' +
      'Zakład przy ul. Szpitalnej 8, wycena online w 2 minuty, bezpłatny pomiar.',
    okolice: ['Baranów Sandomierski', 'Gorzyce', 'Grębów', 'Zaleszany', 'Radomyśl nad Sanem'],
    dzielnice: ['Dzików', 'Mokrzyszów', 'Wielowieś', 'Miechocin', 'Sobów', 'Zakrzów', 'Serbinów', 'Sielec', 'Nagnajów'],
  },
  {
    slug: 'sandomierz', nazwa: 'Sandomierz', wMiescie: 'Sandomierzu', doMiasta: 'Sandomierza',
    /*
     * ODLEGŁOŚĆ SPRAWDZONA W MAPACH (25.09.2026), bo strona podawać potrafiła
     * dwie różne: opis i FAQ mówiły „25 km", a nagłówek „około 15 km,
     * mniej więcej kwadrans". Żadna nie była prawdziwa.
     *
     * Szpitalna 8, Tarnobrzeg → Sandomierz: **16,5 km / 24 min** trasą DW723
     * (wariant przez aleję Warszawską: 16,7 km, ten sam czas). Zaokrąglamy
     * W GÓRĘ do 17 km — przy dojazdach lepiej obiecać więcej niż mniej.
     * `czas` podajemy jawnie, bo domyślne przeliczenie generatora (1 km = 1 min)
     * dałoby 17 minut, a realnie jedzie się dobre 24.
     */
    km: 17, nowa: false, daleko: false,
    czas: 'jakieś 25 minut drogi',
    // Link do Staszowa (3.10.2026) — miasto priorytetowe (nr 4), a automat
    // dobierał Sandomierzowi tylko Nową Dębę, Stalową Wolę, Tarnobrzeg
    // i Mielec. Etykieta w stylu automatu: km od zakładu w Tarnobrzegu
    // (50 km, zweryfikowane w Mapach wcześniej — patrz wpis Staszowa).
    dodatkowiSasiedzi: ['staszow'],
    tytul: 'Blaty kuchenne kamienne Sandomierz — granit, spiek, kwarc',
    opis:
      'Blaty kuchenne kamienne Sandomierz — granitowe, ze spieku i konglomeratu na wymiar. ' +
      'Ok. 17 km od Tarnobrzega, wycena online w 2 minuty, bezpłatny pomiar.',
    okolice: ['Dwikozy', 'Zawichost', 'Koprzywnica', 'Klimontów', 'Obrazów', 'Samborzec'],
    dzielnice: ['Stare Miasto', 'Nadbrzezie', 'Mokoszyn', 'Gołębice', 'Krakówka', 'Kamień Plebański'],
  },
  {
    slug: 'stalowa-wola', nazwa: 'Stalowa Wola', wMiescie: 'Stalowej Woli', doMiasta: 'Stalowej Woli',
    km: 30, nowa: false, daleko: false, // Mapy: 29,6 km / 30 min (DW871). Było 20.
    // Link zwrotny do Mielca (13.09.2026) — Stalowa Wola to jedna z dwóch
    // najmocniejszych stron miast, a automat Mielca tu nie dobierał.
    dodatkowiSasiedzi: ['mielec'],
  },
  /*
   * MIELEC — miasto priorytetowe (Dawid, 06.09.2026: „na tym najbardziej").
   *
   * Dostaje najwięcej treści własnej ze wszystkich miast: swój tytuł i opis
   * pod frazy zakupowe, listę okolicznych gmin i dwa pytania, których nie ma
   * nigdzie indziej. To jedyny sposób, żeby strona miasta nie była kopią
   * czternastu pozostałych — a przy takim zestawie stron to jest realne
   * ryzyko, nie teoria.
   */
  {
    slug: 'mielec', nazwa: 'Mielec', wMiescie: 'Mielcu', doMiasta: 'Mielca',
    /*
     * ODLEGŁOŚĆ SPRAWDZONA W MAPACH (26.09.2026): Szpitalna 8, Tarnobrzeg
     * → Mielec to **40,1 km / 40 min** trasą DW985 (wariant przez Wisłostradę
     * i DW871: 40,3 km, ten sam czas). Strona mówiła „45 km" i „pięćdziesiąt
     * minut" — zawyżone, a przy Mielcu bliskość jest argumentem sprzedażowym,
     * więc akurat tu nie ma powodu zaokrąglać na swój niekorzyść.
     *
     * Ta sama pomyłka co przy Sandomierzu (25.09) — warto sprawdzić pozostałe
     * miasta przy najbliższej okazji, zamiast ufać liczbom z pamięci.
     *
     * `czas` zostaje niepodany: generator liczy 1 km = 1 min, więc przy 40 km
     * wychodzi „około 40 minut" — i to się zgadza z Mapami.
     */
    km: 40, nowa: false, daleko: false,
    // Sąsiedzi ustaleni ręcznie (13.09.2026, Dawid): automat dobierał miasta
    // ~45 km od TARNOBRZEGA (Opatów, Staszów, Nisko, Sandomierz), czyli
    // 60–90 km od samego Mielca. Odległości poniżej liczone OD MIELCA.
    sasiedzi: [
      { slug: 'nowa-deba', km: 25 },
      { slug: 'debica', km: 30 },
      { slug: 'tarnobrzeg', km: 40 },
      { slug: 'stalowa-wola', km: 55 },
    ],
    tytul: 'Blaty kuchenne kamienne Mielec — granit, spiek, kwarc',
    opis:
      'Blaty kuchenne kamienne Mielec — granitowe, ze spieku i konglomeratu na wymiar. ' +
      '40 km od Tarnobrzega, wycena online w 2 minuty, pomiar i montaż w cenie.',
    okolice: [
      'Przecław', 'Radomyśl Wielki', 'Tuszów Narodowy', 'Padew Narodowa',
      'Czermin', 'Borowa', 'Wadowice Górne', 'Gawłuszowice',
    ],
    dzielnice: [
      'Smoczka', 'Wojsław', 'Rzochów', 'Cyranka', 'Borek',
      'osiedle Lotników', 'osiedle Kusocińskiego', 'osiedle Szafera',
    ],
    pytaniaWlasne: [
      {
        pytanie: 'Czy wymienicie blat w kuchni w mieleckim bloku bez przebudowy?',
        odpowiedz:
          'Tak i to najczęstsze zlecenie, jakie realizujemy w Mielcu. Szafki zostają na ' +
          'miejscu — zdejmujemy stary blat laminowany, bierzemy pomiar Prolinerem i po ' +
          'kilkunastu dniach montujemy kamienny. Sama wymiana na miejscu to zwykle kilka ' +
          'godzin, kuchnia jest używalna tego samego dnia. Do wymiany w bloku najczęściej ' +
          'idzie konglomerat kwarcowy: nie wymaga impregnacji i nie zmienia się z czasem.',
      },
      {
        pytanie: 'Robicie blaty pod wyspę w domach pod Mielcem?',
        odpowiedz:
          'Tak. W domach jednorodzinnych w gminach wokół Mielca — Przecław, Tuszów ' +
          'Narodowy, Radomyśl Wielki, Padew Narodowa — zamówienia to zwykle blat plus ' +
          'wyspa, często z dołożoną okładziną ścienną z tego samego materiału. Przy ' +
          'wyspie warto od razu ustalić, czy ma mieć zlew albo płytę indukcyjną, bo od ' +
          'tego zależy układ płyty i to, czy da się wyciąć blat z jednej sztuki bez łączenia.',
      },
    ],
  },
  {
    slug: 'rzeszow', nazwa: 'Rzeszów', wMiescie: 'Rzeszowie', doMiasta: 'Rzeszowa',
    // Mapy: 72,1 km / 1 h 11 (DK9); do Rynku 74,3 km / 1 h 16. Było 80 km.
    km: 75, nowa: false, daleko: false,
    czas: 'godzina z kwadransem',
    tytul: 'Blaty kuchenne kamienne Rzeszów — granit, spiek, kwarc',
    opis:
      'Blaty kuchenne kamienne Rzeszów — granitowe, ze spieku i konglomeratu na wymiar. ' +
      'Wycena online w 2 minuty, bezpłatny pomiar i montaż w cenie.',
    okolice: ['Głogów Małopolski', 'Boguchwała', 'Tyczyn', 'Trzebownisko', 'Krasne', 'Świlcza'],
    dzielnice: [
      'Śródmieście', 'Baranówka', 'Nowe Miasto', 'Staroniwa', 'Zalesie',
      'Drabinianka', 'Przybyszówka', 'Budziwój', 'Słocina',
    ],
  },
  { slug: 'kielce', nazwa: 'Kielce', wMiescie: 'Kielcach', doMiasta: 'Kielc', km: 105, nowa: false, daleko: true,
    czas: 'półtorej godziny drogi' }, // Mapy: 102 km / 1 h 31 (DW764). Było 110.
  // Mapy: 37,5 km / 40 min (DW871). Było 30.
  { slug: 'nisko', nazwa: 'Nisko', wMiescie: 'Nisku', doMiasta: 'Niska', km: 40, nowa: false, daleko: false },
  { slug: 'nowa-deba', nazwa: 'Nowa Dęba', wMiescie: 'Nowej Dębie', doMiasta: 'Nowej Dęby', km: 20, nowa: false, daleko: false },
  {
    slug: 'debica', nazwa: 'Dębica', wMiescie: 'Dębicy', doMiasta: 'Dębicy', km: 75, nowa: false, daleko: false,
    czas: 'nieco ponad godzina drogi', // Mapy: 72,2 km / 1 h 05 (DW985)
    // Sąsiedzi ustaleni ręcznie (30.09.2026). Automat dobierał ich po km
    // OD TARNOBRZEGA, więc Dębica (75 km) dostawała Ostrowiec i Starachowice
    // — miasta za Wisłą, 100+ km od samej Dębicy. Odległości poniżej liczone
    // OD DĘBICY i sprawdzone w Mapach 30.09.2026:
    //   Mielec 32,0 km / 40 min · Rzeszów 55,7 km / 39 min (A4)
    //   Nowa Dęba 59,9 km / 1 h 04 · Tarnobrzeg 73,0 km / 1 h 16 (DW985)
    sasiedzi: [
      { slug: 'mielec', km: 30 },
      { slug: 'rzeszow', km: 55 },
      { slug: 'tarnobrzeg', km: 75 },
      { slug: 'nowa-deba', km: 60 },
    ],
    // Pod „blaty kuchenne kamienne dębica" (poz. 9,6, 0 klik.) — zmiana z 15.09.2026.
    tytul: 'Blaty kuchenne kamienne Dębica — granit, spiek, konglomerat',
    opis:
      'Blaty kuchenne kamienne Dębica — granitowe, ze spieku i konglomeratu na wymiar. ' +
      'Ok. 75 km od Tarnobrzega, wycena online w 2 minuty, pomiar Prolinerem.',
  },
  { slug: 'opatow', nazwa: 'Opatów', wMiescie: 'Opatowie', doMiasta: 'Opatowa', km: 50, nowa: false, daleko: false },

  // ── nowe (zlecenie Dawida, 25.08.2026) ──────────────────────────────
  {
    slug: 'ostrowiec-swietokrzyski', nazwa: 'Ostrowiec Świętokrzyski',
    wMiescie: 'Ostrowcu Świętokrzyskim', doMiasta: 'Ostrowca Świętokrzyskiego',
    km: 65, nowa: true, daleko: false, // Mapy: 64,6 km / 1 h 04. Było 70.
    czas: 'około godziny drogi',
    krotki: 'Miasto z dużą liczbą domów jednorodzinnych i blokowych kuchni do wymiany.',
  },
  {
    slug: 'starachowice', nazwa: 'Starachowice',
    wMiescie: 'Starachowicach', doMiasta: 'Starachowic',
    km: 95, nowa: true, daleko: false,
    czas: 'około półtorej godziny drogi',
    krotki: 'Na granicy naszego promienia bezpłatnego pomiaru — dojeżdżamy normalnie.',
  },
  {
    slug: 'staszow', nazwa: 'Staszów',
    wMiescie: 'Staszowie', doMiasta: 'Staszowa',
    km: 50, nowa: true, daleko: false,
    czas: 'niecała godzina drogi',
    krotki: 'Blisko, w zasięgu bezpłatnego pomiaru razem z całą okolicą.',
    // Tytuł i opis pod „blaty kuchenne kamienne staszów" i „blaty granitowe
    // staszów" — wzór z Tarnobrzega (14.09.2026), gdzie ten sam zabieg dał
    // pozycję 6,5 → 3,1 i pierwsze kliknięcia. Staszów siedzi na 5,0, w SERP
    // trzeci za Ignikomem, czyli najbliżej pierwszego miejsca ze wszystkich
    // miast (propozycja dziennego zadania SEO, 24.09.2026).
    tytul: 'Blaty kuchenne kamienne Staszów — granit, spiek, kwarc',
    opis:
      'Blaty kuchenne kamienne Staszów — granitowe, ze spieku i konglomeratu na wymiar. ' +
      '50 km od Tarnobrzega, wycena online w 2 minuty, pomiar i montaż w cenie.',
    okolice: ['Połaniec', 'Osiek', 'Rytwiany', 'Bogoria', 'Szydłów', 'Łubnice'],
  },
  {
    slug: 'lublin', nazwa: 'Lublin',
    wMiescie: 'Lublinie', doMiasta: 'Lublina',
    km: 160, nowa: true, daleko: true, // Mapy: 157 km / 1 h 42 (S19). Było 130.
    czas: 'niecałe dwie godziny drogi',
    krotki: 'Dalej niż nasz standardowy promień — warunki dojazdu ustalamy indywidualnie.',
    // Pod „blaty kuchenne kamienne lublin" (11,4 / 12 wyśw.) i „blaty lublin" — zmiana z 15.09.2026.
    /*
     * K5 (7.10.2026): Lublin rośnie sam — 194 wyświetlenia, pozycja 12,6,
     * ale CTR 1,5%. W opisie nie było żadnego konkretu o dojezdzie, a przy
     * mieście spoza promienia to pierwsze pytanie klienta. Dystans
     * sprawdzony w Mapach 7.10: **158 km / 1 h 50** trasą S19 (warianty
     * 154 km / 1 h 51 i 142 km / 1 h 53) — zaokrąglamy w górę do 160 km,
     * zgodnie z zasadą „obiecany dojazd nie krótszy niż prawdziwy".
     * „Dojazd indywidualnie" zostaje: Lublin jest poza promieniem
     * bezpłatnego pomiaru i opis nie może sugerować inaczej.
     */
    tytul: 'Blaty kuchenne kamienne Lublin — granit, spiek, konglomerat',
    opis:
      // Czas słownie, nie „2 godziny" — strona mówi „niecałe dwie godziny drogi",
      // a test spójności czasów czyta opis razem z treścią.
      'Blaty kuchenne kamienne Lublin — granit, spiek, konglomerat. ' +
      '160 km z Tarnobrzega, niecałe dwie godziny drogi. Wycena online w 2 minuty, dojazd indywidualnie.',
  },

  // ── Kraków i okolice (zlecenie Dawida, 27.08.2026) ───────────────────
  //
  // JEDNA MOCNA STRONA, nie sześć cienkich. Wieliczka, Skawina czy
  // Niepołomice nie dostają własnych podstron — miałyby tę samą treść
  // z podmienioną nazwą, a Google od lat traktuje takie zestawy jako
  // treść powieloną i nie pozycjonuje żadnej z nich. Zamiast tego
  // nazwy wchodzą w treść i w `areaServed` strony Krakowa (`okolice`).
  {
    slug: 'krakow', nazwa: 'Kraków',
    wMiescie: 'Krakowie', doMiasta: 'Krakowa',
    km: 190, nowa: true, daleko: true, // Mapy: 190 km / 2 h 16 (A4). Było 170.
    czas: 'niecałe dwie i pół godziny drogi',
    krotki:
      'Kraków i okolice — Wieliczka, Skawina, Niepołomice, Zabierzów, Krzeszowice, Zielonki. ' +
      'Dalej niż nasz standardowy promień, ale dojeżdżamy — warunki ustalamy przy zamówieniu.',
    okolice: ['Wieliczka', 'Skawina', 'Niepołomice', 'Zabierzów', 'Krzeszowice', 'Zielonki'],
    // Tytuł i opis pod frazy, o które prosił Dawid: „blaty kuchenne Kraków",
    // „blat z kamienia Kraków", „blaty granitowe Kraków". Pozostałe miasta
    // zostają przy wzorcu z generatora — te pola są opcjonalne.
    tytul: 'Blaty kuchenne Kraków — blat z kamienia i blaty granitowe',
    opis:
      'Blaty kuchenne Kraków — blat z kamienia na wymiar: konglomerat, spiek, blaty ' +
      'granitowe. Także Wieliczka, Skawina, Niepołomice. Wycena online w dwie minuty.',
  },
];

export const NOWE = MIASTA.filter((m) => m.nowa);
export const wgSluga = (slug) => MIASTA.find((m) => m.slug === slug);

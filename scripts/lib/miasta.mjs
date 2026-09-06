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
 * WPROST — obiecywanie darmowego dojazdu 130 km w jedną stronę byłoby
 * obietnicą, której nie chcemy składać.
 */
export const MIASTA = [
  // ── istniejące strony (kolejność jak w stopce) ──────────────────────
  {
    slug: 'tarnobrzeg', nazwa: 'Tarnobrzeg', wMiescie: 'Tarnobrzegu', doMiasta: 'Tarnobrzega',
    km: 0, nowa: false, daleko: false,
    tytul: 'Blaty kuchenne Tarnobrzeg — blat z kamienia na wymiar',
    opis:
      'Blaty kuchenne Tarnobrzeg — konglomerat, spiek i granit na wymiar. Zakład przy ' +
      'ul. Szpitalnej 8: płyty można obejrzeć na hali, pomiar Prolinerem bezpłatny.',
    okolice: ['Baranów Sandomierski', 'Gorzyce', 'Grębów', 'Zaleszany', 'Radomyśl nad Sanem'],
  },
  {
    slug: 'sandomierz', nazwa: 'Sandomierz', wMiescie: 'Sandomierzu', doMiasta: 'Sandomierza',
    km: 25, nowa: false, daleko: false,
    tytul: 'Blaty kuchenne Sandomierz — blat z kamienia na wymiar',
    opis:
      'Blaty kuchenne Sandomierz — blat z konglomeratu, spieku lub granitu na wymiar. ' +
      '25 km od naszego zakładu w Tarnobrzegu, bezpłatny pomiar i montaż w cenie.',
    okolice: ['Dwikozy', 'Zawichost', 'Koprzywnica', 'Klimontów', 'Obrazów', 'Samborzec'],
  },
  { slug: 'stalowa-wola', nazwa: 'Stalowa Wola', wMiescie: 'Stalowej Woli', doMiasta: 'Stalowej Woli', km: 20, nowa: false, daleko: false },
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
    km: 45, nowa: false, daleko: false,
    tytul: 'Blaty kuchenne Mielec — blat kamienny, konglomerat, granit',
    opis:
      'Blaty kuchenne Mielec — blat kamienny na wymiar: konglomerat, spiek i granit. ' +
      '45 km od zakładu w Tarnobrzegu, bezpłatny pomiar, montaż w cenie blatu.',
    okolice: [
      'Przecław', 'Radomyśl Wielki', 'Tuszów Narodowy', 'Padew Narodowa',
      'Czermin', 'Borowa', 'Wadowice Górne', 'Gawłuszowice',
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
    km: 80, nowa: false, daleko: false,
    tytul: 'Blaty kuchenne Rzeszów — blat z kamienia na wymiar',
    opis:
      'Blaty kuchenne Rzeszów — blat kamienny na wymiar: konglomerat kwarcowy, spiek ' +
      'i granit. Dojeżdżamy z Tarnobrzega, pomiar bezpłatny, montaż w cenie.',
    okolice: ['Głogów Małopolski', 'Boguchwała', 'Tyczyn', 'Trzebownisko', 'Krasne', 'Świlcza'],
  },
  { slug: 'kielce', nazwa: 'Kielce', wMiescie: 'Kielcach', doMiasta: 'Kielc', km: 110, nowa: false, daleko: true },
  { slug: 'nisko', nazwa: 'Nisko', wMiescie: 'Nisku', doMiasta: 'Niska', km: 30, nowa: false, daleko: false },
  { slug: 'nowa-deba', nazwa: 'Nowa Dęba', wMiescie: 'Nowej Dębie', doMiasta: 'Nowej Dęby', km: 20, nowa: false, daleko: false },
  { slug: 'debica', nazwa: 'Dębica', wMiescie: 'Dębicy', doMiasta: 'Dębicy', km: 75, nowa: false, daleko: false },
  { slug: 'opatow', nazwa: 'Opatów', wMiescie: 'Opatowie', doMiasta: 'Opatowa', km: 50, nowa: false, daleko: false },

  // ── nowe (zlecenie Dawida, 25.08.2026) ──────────────────────────────
  {
    slug: 'ostrowiec-swietokrzyski', nazwa: 'Ostrowiec Świętokrzyski',
    wMiescie: 'Ostrowcu Świętokrzyskim', doMiasta: 'Ostrowca Świętokrzyskiego',
    km: 70, nowa: true, daleko: false,
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
    tytul: 'Blaty kuchenne Staszów — blat z kamienia na wymiar',
    opis:
      'Blaty kuchenne Staszów — blat kamienny na wymiar: konglomerat, spiek i granit. ' +
      '50 km od zakładu w Tarnobrzegu, bezpłatny pomiar Prolinerem, montaż w cenie.',
    okolice: ['Połaniec', 'Osiek', 'Rytwiany', 'Bogoria', 'Szydłów', 'Łubnice'],
  },
  {
    slug: 'lublin', nazwa: 'Lublin',
    wMiescie: 'Lublinie', doMiasta: 'Lublina',
    km: 130, nowa: true, daleko: true,
    czas: 'około dwóch godzin drogi',
    krotki: 'Dalej niż nasz standardowy promień — warunki dojazdu ustalamy indywidualnie.',
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
    km: 170, nowa: true, daleko: true,
    czas: 'około dwóch i pół godziny drogi',
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

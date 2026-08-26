/**
 * KOLOR DEKORU — po nazwie.
 *
 * Zlecenie Dawida (26.08.2026): podpowiedź trzech TAŃSZYCH materiałów
 * podobnych kolorystycznie, na szybką odpowiedź „za drogo".
 *
 * Cenniki nie niosą koloru — mamy tylko nazwę handlową. Na szczęście
 * nazewnictwo w kamieniu jest mocno skonwencjonalizowane: „Calacatta",
 * „Statuario" i „Carrara" to biel z marmurową żyłą, „Nero"/„Black"
 * biel czerń, „Grigio"/„Gris"/„Grey" szarość. Z tego da się zbudować
 * klasyfikację, która trafia w większość katalogu.
 *
 * CZEGO TU NIE MA — I DLACZEGO. Część kolekcji nazywa dekory nazwami
 * miejscowości („Dijon", „Amiens", „Reims", „Clermont"). Z takiej nazwy
 * nie wynika żaden kolor i NIE ZGADUJEMY go: wpisanie tu wymyślonego
 * koloru byłoby gorsze niż jego brak, bo podpowiedź wyglądałaby na
 * pewną, a prowadziłaby Dawida w maliny. Takie dekory dostają `nieznany`
 * i trafiają do podpowiedzi wyłącznie jako „podobna cena, dowolny kolor",
 * wprost tak oznaczone.
 *
 * RĘCZNA MAPA (`RECZNE`) jest miejscem na uzupełnienia od Dawida — jedna
 * linijka na dekor. Ma pierwszeństwo przed regułami.
 */

/** Kolory, w jakich myśli klient przy blacie. */
export const TAGI = [
  { id: 'biel', nazwa: 'biel' },
  { id: 'biel-zyla', nazwa: 'biel z żyłą' },
  { id: 'krem-bez', nazwa: 'kremowy / beż' },
  { id: 'szary', nazwa: 'szary' },
  { id: 'antracyt', nazwa: 'antracyt / czerń' },
  { id: 'beton', nazwa: 'beton' },
  { id: 'drewno', nazwa: 'drewno' },
  { id: 'kolor', nazwa: 'kolorowy' },
  { id: 'nieznany', nazwa: 'kolor nieoznaczony' },
];

export const nazwaTagu = (id) => TAGI.find((t) => t.id === id)?.nazwa || id;

/**
 * Ręczne przypisania — mają pierwszeństwo przed regułami.
 * Format: 'firma/Dekor': 'tag' albo 'Dekor': 'tag' (dla wszystkich firm).
 *
 * Tu wpisujemy dekory, których nazwa nic nie mówi, a Dawid wie, jak
 * wyglądają. Pusto = jeszcze nikt nie uzupełnił, nie = „nie ma czego".
 */
export const RECZNE = {};

/**
 * REGUŁY — pierwsza pasująca wygrywa, więc KOLEJNOŚĆ MA ZNACZENIE.
 *
 * Czerń stoi PRZED marmurową żyłą celowo: „Black Carrara" to kamień
 * czarny z białym rysunkiem i klient widzi go jako czarny, nie jako
 * biel z żyłą. Ta sama zasada dotyczy „Blue Stone Negro".
 */
const REGULY = [
  // Drewno i beton — osobne światy, sprawdzane najpierw, żeby „Ash"
  // w nazwie drewna nie wpadło do szarości. „wood" bez granicy słowa
  // z przodu, bo „Driftwood" to jedno słowo.
  ['drewno', /(wood|\boak|\brovere|\blegno|\bnoce\b|\bwalnut|\bteak|\bacero\b|\bmaple|\bdrewn)/i],
  ['beton', /\b(concrete|beton|cemento|cement|tarmac|industrial|loft|raw)\b/i],

  // Czerń i antracyt.
  ['antracyt', /\b(nero|negro|black|noir|marquina|antracyt|antracit|anthracite|graphite|grafit|basalt|basaltina|lava|volcano|dark|raven|night|shadow|piombo)/i],

  // Szarość — łącznie z „iron", „steel" i „pearl", które w kamieniu
  // znaczą odcienie szarego, a nie kolor.
  ['szary', /\b(grey|gray|grigi|gris|silver|ash|smoke|fume|cenere|pearl|perl|taupe|steel|iron|titanium|mist|fog|cloud|tortora|metal|fior di bosco)/i],

  // Biel z marmurową żyłą — najczęstszy wybór do kuchni.
  ['biel-zyla', /\b(calacatta|statuar|carrara|carrina|arabescato|dolomit|cristallo|panda|taj|venat|altissimo|lasa\b|makrana|paonazz)/i],

  // Czysta biel.
  ['biel', /\b(white|bianco|biancone|blanc|blanche|snow|alpin|pure|angel|milk|neve|nieve|frost|ice)/i],

  // Kremy, beże, brązy, piaski.
  ['krem-bez', /\b(beige|bez|crema|creme|cream|ivory|avorio|sand|almond|botticino|champagne|camel|ecru|dune|marfil|travertin|honey|latte|biscuit|bone|breccia|gold|amber|brown|bruno|marrone|emperador|cappucino|vanilla|caramel|sahara|desert|gobi|arena|canela|hay\b|clamshell|shitake)/i],

  // Wyraźne kolory.
  ['kolor', /\b(blue|blu\b|azul|azur|verde|green|rosso|red\b|emerald|bronze|copper|rust|terra|viola|violet|purple|pink|rosa|rose|yellow|indigo|navy|patagonia)/i],
];

/** Kolor dekoru. Zwraca id tagu, nigdy nie rzuca. */
export function kolorDekoru(dekor, firmaSlug = '') {
  const nazwa = String(dekor ?? '').trim();
  if (!nazwa) return 'nieznany';

  const reczny = RECZNE[`${firmaSlug}/${nazwa}`] ?? RECZNE[nazwa];
  if (reczny) return reczny;

  for (const [tag, re] of REGULY) if (re.test(nazwa)) return tag;
  return 'nieznany';
}

/**
 * Jak blisko siebie są dwa kolory. 0 = ten sam, wyżej = dalej.
 *
 * Graf jest celowo płytki: chodzi o to, żeby obok bieli podsunąć biel
 * z żyłą albo krem, a nie o teorię barw. `nieznany` jest zawsze daleko,
 * bo nie wiemy, czy pasuje — i tak ma to wyglądać w podpowiedzi.
 */
const BLISKIE = {
  biel: { 'biel-zyla': 1, 'krem-bez': 1, szary: 2 },
  'biel-zyla': { biel: 1, 'krem-bez': 2, szary: 2 },
  'krem-bez': { biel: 1, 'biel-zyla': 2, drewno: 2 },
  szary: { beton: 1, antracyt: 1, biel: 2, 'biel-zyla': 2 },
  beton: { szary: 1, antracyt: 2 },
  antracyt: { szary: 1, beton: 2 },
  drewno: { 'krem-bez': 2 },
  kolor: {},
};

export const DALEKO = 4;

export function odlegloscKoloru(a, b) {
  if (!a || !b) return DALEKO;
  if (a === b) return a === 'nieznany' ? 3 : 0;
  if (a === 'nieznany' || b === 'nieznany') return 3;
  return BLISKIE[a]?.[b] ?? BLISKIE[b]?.[a] ?? DALEKO;
}

/**
 * GEOMETRIA UMYWALKI Z KAMIENIA — z parametrów klienta na kawałki do cięcia.
 *
 * Tu zamieniamy cztery liczby, które klient rusza suwakiem (długość,
 * głębokość, wysokość krawędzi, niecka) na listę prostokątów. Dalej bierze
 * je silnik wyceny: pakuje na płytę 320 × 160 i liczy, ile płyty trzeba
 * kupić. Dlatego ten plik nie zna się na cenach — zna się tylko na tym,
 * CO się wycina.
 *
 * Nazwy elementów trafiają do maila dla Dawida. Klient ich nie widzi:
 * rozkrój to know-how zakładu, a nie treść strony.
 *
 * Jednostki: centymetry (tak samo jak reszta silnika), metry bieżące
 * dopiero na wyjściu `mbPogrubienia`.
 */

/** Zakresy suwaków. Poza nimi liczymy dalej, tylko z ostrzeżeniem (§6.3). */
export const ZAKRESY = {
  L: [60, 200],
  G: [40, 60],
  H: [4, 30],
  nieckaH: [8, 15],
};

/** Szybkie wymiary z kroku 2 — długość razem z typową głębokością. */
export const PRESETY = [
  { L: 80, G: 46 },
  { L: 100, G: 50 },
  { L: 120, G: 50 },
  { L: 160, G: 50 },
];

/**
 * Stan startowy konfiguratora.
 *
 * Każde pole ma sensowną wartość, więc „Dalej" działa jednym tapnięciem
 * i klient nie musi niczego ustawiać, żeby zobaczyć wycenę.
 */
export const STAN_DOMYSLNY = {
  typ: 'zintegrowana',
  L: 100,
  G: 50,
  H: 15,
  pogrubienie: 'boki',
  bokL: true,
  bokP: true,
  // null = wyliczamy z blatu (§6.2). Klient może nadpisać w „Więcej opcji".
  niecka: { L: null, G: null, H: 10 },
  marka: 'keralini',
  dekor: 'Absolute Naturale',
  grubosc: '12',
  montaz: true,
  mocowanie: 'szafka',
  bateria: 'blat',
};

const miedzy = (n, [min, max]) => Math.min(max, Math.max(min, n));
const zaokr3 = (n) => Math.round(n * 1000) / 1000;
/*
 * `null` znaczy „wylicz za mnie" (pola niecki), więc nie wolno go
 * potraktować jak zera — `Number(null)` to 0 i niecka wychodziła 40 × 20.
 */
const num = (v, zapas) => {
  if (v === null || v === undefined || v === '') return zapas;
  const n = Number(v);
  return Number.isFinite(n) ? n : zapas;
};

/**
 * Wymiary niecki — podane przez klienta albo wyliczone z blatu.
 *
 * Granice pilnują wykonalności: niecka musi mieć z czego trzymać front
 * i boki, inaczej nie ma czego kleić. Nie odmawiamy jednak wyceny —
 * przycinamy wartość i liczymy dalej (§6.3).
 */
export function nieckaStanu(stan) {
  const L = num(stan?.L, STAN_DOMYSLNY.L);
  const G = num(stan?.G, STAN_DOMYSLNY.G);
  const wybor = stan?.niecka || {};

  const H = miedzy(Math.round(num(wybor.H, 10)), ZAKRESY.nieckaH);

  const autoL = Math.max(40, Math.round(L - 20));
  const dl = Math.min(Math.round(num(wybor.L, autoL)), Math.round(L - 16));
  const autoG = Math.round(G - 15);
  const gl = Math.min(Math.round(num(wybor.G, autoG)), Math.round(G - 12));

  return { L: Math.max(40, dl), G: Math.max(20, gl), H };
}

/**
 * Stan po korektach, które wynikają z samej konstrukcji.
 *
 * Dwie rzeczy nie są kwestią gustu:
 *   • zlew wycięty w kamieniu MUSI mieć pogrubiony front — to on zakrywa
 *     nieckę; bez niego widać od dołu klejenie,
 *   • krawędź nie może być niższa niż niecka, bo niecka wystawałaby pod
 *     blatem (stąd zapas 2 cm na dno i spadek).
 */
export function normalizuj(stan) {
  const s = { ...STAN_DOMYSLNY, ...(stan || {}) };
  s.L = Math.round(num(s.L, STAN_DOMYSLNY.L));
  s.G = Math.round(num(s.G, STAN_DOMYSLNY.G));
  s.H = Math.round(num(s.H, STAN_DOMYSLNY.H));
  s.niecka = { ...STAN_DOMYSLNY.niecka, ...(s.niecka || {}) };

  if (s.typ === 'zintegrowana' && s.pogrubienie === 'brak') s.pogrubienie = 'front';

  if (s.typ === 'zintegrowana') {
    const n = nieckaStanu(s);
    if (s.H < n.H + 2) s.H = n.H + 2;
  }

  return s;
}

/**
 * Kawałki do wycięcia — każdy egzemplarz jako osobna pozycja.
 *
 * Dwie identyczne ścianki niecki to DWA wpisy, nie jeden ze sztukami:
 * pakowanie układa pojedyncze prostokąty i inaczej policzyłoby płytę.
 */
export function kawalki(stan) {
  const s = normalizuj(stan);
  const lista = [];
  const dodaj = (nazwa, dl, gl, szt = 1) => {
    for (let i = 0; i < szt; i++) {
      if (dl > 0 && gl > 0) lista.push({ nazwa, dl: Math.round(dl), gl: Math.round(gl) });
    }
  };

  dodaj('Blat górny', s.L, s.G);

  if (s.pogrubienie !== 'brak') dodaj('Pogrubienie frontu', s.L, s.H);
  if (s.pogrubienie === 'boki') {
    if (s.bokL) dodaj('Pogrubienie boku', s.G, s.H);
    if (s.bokP) dodaj('Pogrubienie boku', s.G, s.H);
  }

  if (s.typ === 'zintegrowana') {
    const n = nieckaStanu(s);
    dodaj('Ścianka niecki długa', n.L, n.H, 2);
    dodaj('Ścianka niecki krótka', n.G, n.H, 2);
    dodaj('Dno niecki', n.L, n.G);
    // Wstawka usztywnia front nad niecką — bez niej front pracuje
    // na samym kleju. Wzór z przykładu Dawida: przy niecce 100 cm
    // wstawka 90 cm (§6.1, pozycja 7).
    dodaj('Wstawka pod front', n.L - 10, s.H);
  }

  return lista;
}

/** Odcinki w postaci, jakiej oczekuje silnik (`upakuj` / `wycen`). */
export function odcinki(stan) {
  return kawalki(stan).map((k) => ({ dl: k.dl, gl: k.gl, nazwa: k.nazwa }));
}

/** Powierzchnia samych kawałków w m² (bez ścinki — tę liczy pakowanie). */
export function poleM2(lista) {
  return zaokr3((lista || []).reduce((suma, k) => suma + (k.dl * k.gl) / 10000, 0));
}

/**
 * Metry bieżące krawędzi klejonej pod kątem.
 *
 * Artefakt Dawida liczył tu samą długość frontu (1,20 mb przy umywalce
 * 120 cm z dwoma bokami) — brakowało obu boków, czyli metra bieżącego
 * roboty na każdej sztuce. Liczymy front + włączone boki.
 */
export function mbPogrubienia(stan) {
  const s = normalizuj(stan);
  if (s.pogrubienie === 'brak') return 0;
  let cm = s.L;
  if (s.pogrubienie === 'boki') {
    if (s.bokL) cm += s.G;
    if (s.bokP) cm += s.G;
  }
  return Math.round((cm / 100) * 100) / 100;
}

/**
 * Liczba otworów (§7.2).
 *
 * Przy zlewie wyciętym w kamieniu odpływ jest w ryczałcie niecki, więc
 * płatny zostaje tylko otwór pod baterię. Przy blacie pod umywalkę
 * nablatową odpływ trzeba wyciąć osobno.
 */
export function otwory(stan) {
  const s = normalizuj(stan);
  const bateria = s.bateria === 'blat' ? 1 : 0;
  return s.typ === 'zintegrowana' ? bateria : 1 + bateria;
}

/** Powierzchnia blatu w m² — od niej liczy się stawka montażu. */
export function m2Blatu(stan) {
  const s = normalizuj(stan);
  return zaokr3((s.L * s.G) / 10000);
}

/**
 * Ostrzeżenia o wymiarach. NIGDY nie zamiast wyceny — zawsze obok niej.
 *
 * Klient, który chce umywalkę 220 cm, ma usłyszeć „policzymy, ustalimy
 * na pomiarze", a nie „nie da się".
 */
export function ostrzezeniaWymiarow(stan) {
  const s = normalizuj(stan);
  const lista = [];
  const poza = (v, [min, max]) => v < min || v > max;

  if (poza(s.L, ZAKRESY.L) || poza(s.G, ZAKRESY.G) || poza(s.H, ZAKRESY.H)) {
    lista.push('Taki wymiar ustalimy na pomiarze — cenę i tak pokażemy.');
  }

  return lista;
}

/** Jedno zdanie o konfiguracji — na kartę, do maila i do tytułu zgłoszenia. */
export function opisKonfiguracji(stan) {
  const s = normalizuj(stan);
  const czesci = [
    `Umywalka ${s.L} × ${s.G} cm`,
    s.typ === 'zintegrowana' ? 'zlew wycięty w kamieniu' : 'blat pod umywalkę nablatową',
  ];
  if (s.pogrubienie === 'boki') czesci.push('pogrubiony front i boki');
  else if (s.pogrubienie === 'front') czesci.push('pogrubiony front');
  czesci.push(s.montaz ? 'z montażem' : 'odbiór własny');
  return czesci.join(', ');
}

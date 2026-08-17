/**
 * PARAMETRY WYCENY — tłumaczenie tego, co powiedział klient (albo konsultant),
 * na wejście kalkulatora.
 *
 * Plik jest celowo czysty: żadnego DOM-u, żadnego importu firm. Dzięki temu
 * te same funkcje uruchamiają się w przeglądarce i w testach na gołym node,
 * bez przechodzenia przez `import.meta.glob` Vite. To właśnie tutaj
 * pilnujemy reguł, które nie mogą zależeć od tego, co odpowie model.
 */

/** Nazwy materiałów, jakimi posługuje się konsultant → slug firmy. */
const MATERIALY = {
  avant_quartz: 'avant-quartz',
  'avant-quartz': 'avant-quartz',
  caesarstone: 'caesarstone',
  technistone: 'technistone',
  keralini: 'keralini',
  marazzi: 'marazzi',
  grande: 'marazzi',
  atlas_plan: 'atlas-plan',
  'atlas-plan': 'atlas-plan',
  atlasplan: 'atlas-plan',
  atlas: 'atlas-plan',
  kamien_naturalny: 'interstone',
  interstone: 'interstone',
};

/** Odcinki z parametrów konsultanta: {d: głębokość, w: długość} w cm. */
export function odcinkiZParametrow(params) {
  return (Array.isArray(params?.odcinki) ? params.odcinki : [])
    .map((o) => ({
      dl: Number(o?.w ?? o?.dl) || 0,
      gl: Number(o?.d ?? o?.gl) || 60, // domyślna głębokość blatu to 60 cm
    }))
    .filter((o) => o.dl > 0);
}

/**
 * Czy to łazienka? Wszystko inne (także brak odpowiedzi) traktujemy jak kuchnię.
 *
 * Kierunek jest celowy: kuchnia to wariant z montażem i z płytą grzewczą,
 * czyli droższy i bezpieczniejszy. Gdyby pomieszczenie gdzieś umknęło,
 * wolimy policzyć za dużo i skorygować niż wysłać klientowi zaniżoną kwotę.
 */
export function toLazienka(pomieszczenie) {
  const t = String(pomieszczenie || '').toLowerCase();
  return t.startsWith('lazienk') || t.startsWith('łazienk');
}

/** Opcje obróbki z parametrów konsultanta — wspólne dla wszystkich materiałów. */
export function opcjeZParametrow(params) {
  const lazienka = toLazienka(params?.pomieszczenie);
  return {
    // Pomieszczenie w postaci znormalizowanej — silnik po nim poznaje, czy
    // doliczyć pomiar Prolinerem (tylko kuchnia).
    pomieszczenie: lazienka ? 'lazienka' : 'kuchnia',
    // Wycięcie pod zlew jest w każdej wycenie — w łazience pod umywalkę.
    // `zlew_podwieszany` to starsze pole; czytamy je nadal, żeby odpowiedź
    // konsultanta sprzed zmiany nie wywróciła wyceny.
    zlew: params?.zlew_nablatowy || params?.zlew_podwieszany === false ? 'nablat' : 'podblat',
    zlewy: liczbaZlewow(params || {}),
    // Płyty grzewczej w łazience nie ma, więc nie ma też za co doliczać.
    plyta: lazienka ? 'brak' : params?.indukcja_licowana ? 'licowana' : 'nakladana',
    // Liczba otworów: bateria, dozownik, gniazdko blatowe, przelew.
    otwory: liczbaOtworow(params || {}),
    // Konsultant przekazuje wybór montażu polem odbior_wlasny, ale odbiór
    // własny jest wariantem WYŁĄCZNIE łazienkowym — blat kuchenny montujemy
    // zawsze, po własnym pomiarze. Gdyby konsultant się pomylił, decyduje to.
    dostawa: lazienka && params?.odbior_wlasny ? 'odbior' : 'montaz',
    mat: !!params?.wykonczenie_matowe,
    listwa: Number(params?.listwa_mb) || 0,
    krawedz: Number(params?.krawedz_mb) || 0,
  };
}

/**
 * Opcje z tego, co klient wyklikał w kreatorze (ścieżka bez konsultanta).
 * Te same zasady co wyżej: w łazience brak płyty grzewczej, w kuchni brak
 * odbioru własnego.
 */
export function opcjeZeSzczegolow(szczegoly = {}, pomieszczenie) {
  const lazienka = toLazienka(pomieszczenie);
  return {
    pomieszczenie: lazienka ? 'lazienka' : 'kuchnia',
    zlew: szczegoly.nablatowy ? 'nablat' : 'podblat',
    zlewy: Math.max(1, Math.round(Number(szczegoly.zlewy) || 1)),
    plyta: lazienka ? 'brak' : szczegoly.licowana ? 'licowana' : 'nakladana',
    otwory: szczegoly.otwory ?? 1,
    dostawa: lazienka && szczegoly.odbior ? 'odbior' : 'montaz',
  };
}

/** Parametry z rozmowy → wejście kalkulatora. Null, gdy nie da się policzyć. */
export function przelozParametry(params) {
  if (!params) return null;
  const slug = MATERIALY[String(params.material || '').toLowerCase()];
  // Kamień naturalny ma własną ścieżkę — cenę bierzemy z magazynu na żywo,
  // bo w cenniku go nie ma (patrz app/wycena-naturalny.js).
  if (!slug || slug === 'interstone') return null;

  const odcinki = odcinkiZParametrow(params);
  if (!odcinki.length) return null;

  return {
    slug,
    dane: {
      dekor: params.dekor,
      grubosc: String(params.grubosc || (slug === 'keralini' ? '12' : '20')),
      odcinki,
      opcje: opcjeZParametrow(params),
    },
  };
}

/** Liczba wycięć pod zlew/umywalkę — konsultant podaje `umywalki` albo `zlewy`. */
function liczbaZlewow(params) {
  const n = Number(params.umywalki ?? params.zlewy);
  if (Number.isFinite(n) && n >= 1) return Math.min(4, Math.round(n));
  return 1;
}

/**
 * Liczba otworów z parametrów konsultanta.
 * `otwor_bateria` to stary parametr sprzed uogólnienia — przyjmujemy go nadal,
 * żeby starsza odpowiedź konsultanta nie wywróciła wyceny.
 */
function liczbaOtworow(params) {
  const n = Number(params.otwory);
  if (Number.isFinite(n) && n >= 0) return Math.min(6, Math.round(n));
  if (params.otwor_bateria === false) return 0;
  return 1;
}

/** „Wymiary blatu: 60×300 cm, 60×180 cm." → [{gl:60,dl:300},{gl:60,dl:180}] */
export function odczytajWymiary(wiadomosc) {
  const wynik = [];
  const wzor = /(\d{2,3})\s*[×x]\s*(\d{2,4})/g;
  let m;
  while ((m = wzor.exec(String(wiadomosc))) !== null) {
    wynik.push({ gl: Number(m[1]), dl: Number(m[2]) });
  }
  return wynik;
}

/** „Umywalka nablatowa, liczba umywalek: 2, otwory w blacie: 3." → wybory klienta */
export function odczytajSzczegoly(wiadomosc) {
  const t = String(wiadomosc).toLowerCase();
  // „otwory w blacie: 2" — z pomocnika; przy pisaniu ręcznym bierzemy
  // pierwszą liczbę stojącą przy słowie „otwor".
  const m = t.match(/otwor\w*[^0-9]{0,20}(\d)/) || t.match(/(\d)\s*otwor/);
  // „liczba umywalek: 2" albo „dwie umywalki" napisane cyfrą.
  const u = t.match(/umywal\w*[^0-9]{0,20}(\d)/) || t.match(/(\d)\s*umywal/);
  return {
    licowana: t.includes('licowana'),
    // „nablatowy" dla zlewu, „nablatowa" dla umywalki.
    nablatowy: /nablatow[ya]/.test(t),
    zlewy: u ? Math.min(4, Number(u[1])) : undefined,
    otwory: m ? Math.min(6, Number(m[1])) : undefined,
    // „bez montażu — odbiór własny" z pomocnika; przy pisaniu ręcznym
    // łapiemy też naturalne sformułowania klienta.
    odbior: /odbi(o|ó)r w(l|ł)asny|bez monta(z|ż)u|odbior(e|ę) sam|sam odbior/.test(t),
  };
}

/** Czy konsultant mówi o materiale, który liczymy sami z cennika. */
export function slugMaterialu(nazwa) {
  return MATERIALY[String(nazwa || '').toLowerCase()];
}

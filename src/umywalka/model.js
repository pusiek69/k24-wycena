/**
 * MODEL UMYWALKI — stan, granice i geometria.
 *
 * ŹRÓDŁO: projekt Dawida (artefakt z 23.11.2026). Przeniesiony do repozytorium
 * prawie bez zmian, bo jest dobry: zna dwa zlewy z mostkiem, wstawkę, płytę
 * spadkową, dno z wycinki blatu i pogrubienie wybranych boków. Zostawiam jego
 * nazwy pól (L, W, H, sL, gap, sW, ins) — kod bryły i kontrolek jest na nich
 * oparty, a przepisywanie nazw to tylko okazja do pomyłki.
 *
 * Co tu NIE wchodzi: ceny. Formatki z tego pliku idą do silnika wyceny blatów,
 * który sam liczy płyty, połówki i promocje (patrz wycena-umywalki.js).
 *
 * Jednostki: centymetry. Oś x = długość, y = w górę, z = głębokość (przód +z).
 */

/** Stan startowy — ten sam, od którego zaczyna projekt Dawida. */
export const STAN_DOMYSLNY = {
  // 'int'   — zlew wycięty w kamieniu (jedna płyta, bez łączeń)
  // 'top'   — blat pod umywalkę NABLATOWĄ (miska stoi na kamieniu)
  // 'under' — blat pod umywalkę PODBLATOWĄ (miska pod wyciętym otworem)
  mode: 'int',
  L: 120, // długość blatu
  W: 50, // głębokość blatu
  H: 15, // wysokość widocznej krawędzi (z pogrubieniem)
  left: true, // pogrubienie lewego boku
  right: true, // pogrubienie prawego boku
  n: 1, // liczba umywalek: 1–2 przy zlewie w kamieniu, 1–3 przy nablatowej/podblatowej
  sL: 100, // szerokość zlewu
  gap: 15, // mostek między zlewami
  sW: 35, // głębokość zlewu (od przodu)
  ins: 5, // wstawka przy tylnej krawędzi niecki
  marka: 'keralini',
  dekor: 'Absolute White Structured',
  grubosc: '12', // mm — grubość płyty z katalogu
  holes: 1, // otwory w blacie (bateria, dozownik)
  mont: true, // montaż u klienta
  reuse: false, // dno i wstawka z wycinki blatu
};

/** Grubość płyty w centymetrach (katalog podaje milimetry). */
export const plytaCm = (S) => Math.max(0.6, (Number(S.grubosc) || 20) / 10);

/** Czy krawędź jest pogrubiona, czy to goła grubość płyty. */
export const grube = (S) => S.H > plytaCm(S) + 0.01;

/** Ile boków pogrubiamy (0–2). */
export const iloscBokow = (S) => (S.left ? 1 : 0) + (S.right ? 1 : 0);

/** Czy w blacie wycinamy otwór pod miskę (zlew w kamieniu albo podblatowa). */
export const zOtworem = (S) => S.mode === 'int' || S.mode === 'under';

/** Ile niecek wycinamy w kamieniu — przy nablatowej żadnej. */
export const iloscZlewow = (S) => (S.mode === 'int' ? S.n : 0);

/** Ile otworów pod umywalki podblatowe (każdy z polerowaną krawędzią). */
export const iloscPodblatowych = (S) => (S.mode === 'under' ? S.n : 0);

/** Ile misek stoi na blacie albo pod nim — przy zlewie w kamieniu żadnej. */
export const iloscMisek = (S) => (S.mode === 'int' ? 0 : S.n);

/**
 * Ile umywalek zmieści się na blacie tej długości.
 *
 * Przy zlewie wyciętym w kamieniu zostajemy przy dwóch: dwie niecki
 * z mostkiem to już cała szerokość typowego blatu łazienkowego.
 * Nablatowe i podblatowe idą do trzech — ale tylko jeśli naprawdę jest
 * gdzie je postawić: każda potrzebuje swojej szerokości, odstępu między
 * sąsiadkami i rantu przy ścianach.
 */
/*
 * MISA PODBLATOWA — jak posadzić ceramikę pod wyciętym otworem.
 *
 * Profil misy w scena3d.js jest toczony wokół osi: spód na wysokości 0,
 * rant na 13,5, największy promień 21. Pierwsza wersja wieszała ją
 * ujemną skalą (`scale.y = -0.85`) i wychodziło dokładnie odwrotnie niż
 * w rzeczywistości: okrągły SPÓD lądował pod otworem jak kopuła, rant
 * zwisał na dole, a odbite normalne oświetlały misę od środka.
 * Zgłoszone przez Dawida 24.11.2026.
 *
 * Prawidłowo: misa stoi normalnie, tylko zjeżdża o własną wysokość w
 * dół, więc RANT siada na wysokości zaczepienia — czyli na spodzie
 * płyty — a czasza wisi pod nim. Owal zamiast koła, bo wycięcie jest
 * prostokątne (sL × sW): koło zostawiałoby szpary w rogach. Rant jest
 * o 4% szerszy od otworu, bo podblatową przykręca się OD SPODU i
 * kamień ma zakrywać jej krawędź.
 */
export const PROFIL_MISY = { rant: 13.5, promien: 21 };

/*
 * Obrys misy to ZAOKRĄGLONY PROSTOKĄT (superelipsa), nie owal. Wycięcie
 * w kamieniu jest prostokątne, a owal wpisany w prostokąt dotyka tylko
 * środków boków — w czterech rogach zostawały ciemne dziury na wylot
 * (widać to było dopiero na podglądzie, 24.11.2026).
 *
 * Dobór liczbowy, nie na oko: żeby rant zakrył róg otworu, musi być
 * spełnione 2 / zakładka^wykładnik ≤ 1. Owal (wykładnik 2) wymagałby
 * zakładki 41%, zaokrąglenie 4 — 19%; tyle kamienia dookoła nie ma.
 * Wykładnik 12 wystarcza przy zakładce 7% i wygląda jak to, czym jest:
 * prostokątna umywalka podblatowa z miękkimi narożnikami.
 */
export const OBRYS_WYKLADNIK = 12;
export const OBRYS_ZAKLADKA = 1.07;

export function promienObrysu(kat, a, b, n = OBRYS_WYKLADNIK) {
  const c = Math.abs(Math.cos(kat)) / a;
  const s = Math.abs(Math.sin(kat)) / b;
  return 1 / Math.pow(Math.pow(c, n) + Math.pow(s, n), 1 / n);
}

export function obrysMisy(S) {
  const sL = Math.max(10, Number(S?.sL) || 40);
  const sW = Math.max(10, Number(S?.sW) || 35);
  const { rant } = PROFIL_MISY;

  // Rant szerszy od otworu: podblatową przykręca się OD SPODU,
  // więc kamień ma zakrywać jej krawędź dookoła.
  const a = (sL / 2) * OBRYS_ZAKLADKA;
  const b = (sW / 2) * OBRYS_ZAKLADKA;

  // Umywalka jest głęboka mniej więcej w proporcji do swojego węższego
  // wymiaru, ale nigdy jak miska i nigdy jak wiadro.
  const glebokosc = Math.min(15, Math.max(7, Math.min(sL, sW) * 0.38));
  const sy = glebokosc / rant;

  // Przesunięcie misy w jej grupie: rant na zero, czasza pod spodem.
  return { a, b, sy, glebokosc, dy: -rant * sy };
}

export function maksUmywalek(S) {
  if (S.mode === 'int') return 2;
  const szer = Math.max(30, Number(S.sL) || 40);
  const odstep = Math.max(8, Number(S.gap) || 10);
  const rant = 10;
  for (let n = 3; n > 1; n--) {
    if (n * szer + (n - 1) * odstep + 2 * rant <= S.L) return n;
  }
  return 1;
}

const polowki = (v) => Math.floor(v * 2) / 2;

/** Szerokość zlewu dopasowana do długości blatu (przy zmianie presetu). */
export const szerokoscZlewu = (S, L) =>
  S.n === 2 ? polowki((L - 20 - S.gap) / 2) : L - 20;

/**
 * Szerokość wycięcia po zmianie długości blatu albo liczby umywalek.
 *
 * ZLEW W KAMIENIU wykuwamy sami, więc wypełnia blat — im większy, tym
 * lepiej, i tak liczyło to `szerokoscZlewu`.
 *
 * NABLATOWA I PODBLATOWA to kupiona ceramika o swoim rozmiarze. Wspólna
 * reguła robiła z nich potwory: po wybraniu dwóch podblatowych na blacie
 * 200 cm otwór rósł z 45 do 82,5 cm każdy (złapane na podglądzie
 * 24.11.2026) — razem z ceną wycięć i bezsensownym rysunkiem. Tutaj
 * wymiar zostaje taki, jaki klient ustawił; zmniejsza się tylko wtedy,
 * gdy przestaje się mieścić.
 */
export function szerokoscWyciecia(S, L) {
  if (S.mode === 'int') return szerokoscZlewu(S, L);
  const granice = limity({ ...S, L });
  return Math.min(Math.max(Number(S.sL) || 40, granice.sL[0]), granice.sL[1]);
}

/*
 * Największa sensowna umywalka z półki. [DOMYŚLNE — do potwierdzenia
 * przez Dawida]: podblatowe i nablatowe z katalogów mają 40–60 cm.
 * Suwak wolno przeciągnąć dalej, jeśli klient wie, co robi; ta granica
 * działa tylko przy PRZEŁĄCZENIU typu, żeby zlew kuty w kamieniu
 * (nieraz i 110 cm) nie przenosił swojego rozmiaru na kupioną ceramikę.
 */
export const CERAMIKA_MAKS = 60;

/** Szerokość wycięcia po zmianie rodzaju umywalki. */
export function szerokoscPoZmianieTypu(S) {
  if (S.mode === 'int') return szerokoscZlewu(S, S.L);
  return Math.min(Number(S.sL) || 40, CERAMIKA_MAKS);
}

/** Granice suwaków — zależą od siebie nawzajem, stąd funkcja, a nie stała. */
export function limity(S) {
  const int = S.mode === 'int';
  const t = plytaCm(S);
  const ile = Math.max(1, Math.min(3, Number(S.n) || 1));
  // Przy kilku umywalkach szerokość każdej liczy się z tego, co zostaje
  // po odjęciu odstępów między nimi.
  const naSzerokosc = ile > 1 ? (S.L - 10 - (ile - 1) * S.gap) / ile : S.L - 10;
  return {
    L: [40, 300],
    W: [30, 80],
    H: [int ? 15 : t, int ? 30 : 20],
    sL: [30, Math.max(30, naSzerokosc)],
    gap: [8, ile > 1 ? Math.max(8, Math.min(60, (S.L - 10 - ile * S.sL) / (ile - 1))) : 60],
    sW: [25, Math.max(25, S.W - 10)],
    ins: [0, Math.max(0, Math.min(10, S.sW - 15))],
  };
}

/**
 * Przycięcie wszystkich wymiarów do granic.
 *
 * Dwa przebiegi, bo granice zależą od siebie: skrócenie blatu zmienia
 * dopuszczalną szerokość zlewu, a ta — dopuszczalny mostek.
 */
export function zacisnij(S) {
  S.n = Math.max(1, Math.min(3, Math.round(Number(S.n) || 1)));
  S.n = Math.min(S.n, maksUmywalek(S));
  S.holes = Math.max(0, Math.min(3, Math.round(Number(S.holes) || 0)));
  for (let i = 0; i < 2; i++) {
    const l = limity(S);
    for (const k in l) {
      const v = Number(S[k]);
      S[k] = Math.min(l[k][1], Math.max(l[k][0], Number.isFinite(v) ? v : l[k][0]));
    }
  }
  return S;
}

/** Środki zlewów na osi długości (jeden na środku, dwa symetrycznie z mostkiem). */
export function srodkiZlewow(S) {
  const n = Math.max(1, S.mode === 'int' ? iloscZlewow(S) : iloscMisek(S));
  const g = n > 1 ? S.gap : 0;
  const calosc = n * S.sL + (n - 1) * g;
  return [...Array(n)].map((_, i) => -calosc / 2 + S.sL / 2 + i * (S.sL + g));
}

/**
 * FORMATKI DO WYCIĘCIA — lista elementów z wymiarami i liczbą sztuk.
 *
 * `cut: true` znaczy „wychodzi z wycinki po zlewie" — przy włączonej opcji
 * takiego kawałka NIE dokładamy do zakupu materiału, bo on już jest w cenie
 * blatu, z którego wypadł.
 */
/** Jak nazywamy blat na liście formatek — zależnie od tego, co w nim wycinamy. */
function nazwaBlatu(S) {
  const n = S.n;
  if (S.mode === 'int') return n > 1 ? `Blat z ${n} otworami na zlewy` : 'Blat z otworem na zlew';
  if (S.mode === 'under') {
    return n > 1 ? `Blat z ${n} otworami pod umywalki` : 'Blat z otworem pod umywalkę';
  }
  return 'Blat';
}

export function formatki(S) {
  const { L, W, H, sL, sW, ins } = S;
  const int = S.mode === 'int';
  const boki = iloscBokow(S);
  const n = S.n;
  const lista = [];

  lista.push({
    k: 'top',
    n: nazwaBlatu(S),
    a: L,
    b: W,
    q: 1,
  });

  if (grube(S)) {
    lista.push({ k: 'front', n: 'Pogrubienie przód', a: L, b: H, q: 1 });
    if (boki) lista.push({ k: 'side', n: boki > 1 ? 'Pogrubienie boki' : 'Pogrubienie bok', a: W, b: H, q: boki });
  }

  if (int) {
    lista.push(
      { k: 'wl', n: 'Ścianka zlewu długa', a: sL, b: H, q: 2 * n },
      { k: 'ws', n: 'Ścianka zlewu krótka', a: sW, b: H, q: 2 * n },
      { k: 'slope', n: 'Płyta spadkowa (dno)', a: sL, b: sW - ins, q: n, cut: !!S.reuse }
    );
    if (ins > 0) lista.push({ k: 'ins', n: 'Wstawka', a: sL, b: ins, q: n, cut: !!S.reuse });
  }

  lista.forEach((x, i) => {
    x.i = i + 1;
    x.m = (x.a * x.b * x.q) / 1e4;
  });
  return lista;
}

/**
 * Odcinki dla silnika wyceny — każda sztuka osobno, bo pakowanie układa
 * pojedyncze prostokąty. Kawałki „z wycinki" pomijamy: ich materiał już
 * kupiliśmy razem z blatem.
 */
export function odcinki(S) {
  const out = [];
  for (const f of formatki(S)) {
    if (f.cut) continue;
    for (let i = 0; i < f.q; i++) out.push({ dl: f.a, gl: f.b, nazwa: f.n });
  }
  return out;
}

/**
 * Metry bieżące krawędzi klejonej pod kątem: przód + pogrubione boki.
 * (We wcześniejszej wersji projektu liczony był sam przód — stąd 1,20 mb
 * zamiast 2,20 przy umywalce 120 × 50 z dwoma bokami.)
 */
export const mbPogrubienia = (S) => (grube(S) ? (S.L + S.W * iloscBokow(S)) / 100 : 0);

/** Powierzchnia blatu w m² — od niej liczy się stawka montażu. */
export const m2Blatu = (S) => Math.round(((S.L * S.W) / 1e4) * 1000) / 1000;

/** Rant wokół zlewu: po bokach, z przodu i z tyłu — stąd ostrzeżenia. */
export function ranty(S) {
  const dwa = S.n === 2;
  const bok = (S.L - S.n * S.sL - (dwa ? S.gap : 0)) / 2;
  const przod = (S.W - S.sW) / 2;
  return { bok: Math.round(bok * 10) / 10, przod: Math.round(przod * 10) / 10 };
}

/**
 * BRYŁY DO RYSUNKU 3D — prostopadłościany w układzie sceny.
 *
 * Każdy wpis: `k` rodzaj (zgodny z formatkami, po nim numerek i podświetlenie),
 * `s` rozmiar, `p` środek, `ex` kierunek rozsunięcia przy „Rozłóż na formatki".
 */
export function bryly(S) {
  const { L, W, H, sL, sW, ins } = S;
  const t = plytaCm(S);
  const int = S.mode === 'int';
  const P = [];
  const e = 0.04;
  const th = grube(S);

  const x0 = -L / 2;
  const x1 = L / 2;
  const zf = W / 2;
  const zb = -W / 2;
  const sz0 = -sW / 2;
  const sz1 = sW / 2;
  const ty = H - t;
  const up = [0, 22 + H, 0];

  const B = (k, a0, a1, y0, y1, z0, z1, ex, extra = {}) =>
    P.push({
      k,
      s: [a1 - a0, y1 - y0, z1 - z0],
      p: [(a0 + a1) / 2, (y0 + y1) / 2, (z0 + z1) / 2],
      ex,
      ...extra,
    });

  const lx = S.left && th ? x0 + e : x0;
  const rx = S.right && th ? x1 - e : x1;
  const fz = th ? zf - e : zf;
  const cs = srodkiZlewow(S);
  const n = int ? S.n : 1;

  if (zOtworem(S)) {
    /*
     * Blat wokół otworów: pas z przodu, pas z tyłu i kawałki między nimi.
     * Ten sam rysunek obsługuje zlew wycięty w kamieniu i otwór pod
     * umywalkę podblatową — różni je to, co widać POD otworem.
     */
    B('top', lx, rx, ty, H, sz1, fz, up);
    B('top', lx, rx, ty, H, zb, sz0, up);
    const xs = [lx, ...cs.flatMap((c) => [c - sL / 2, c + sL / 2]), rx];
    for (let i = 0; i < xs.length; i += 2) B('top', xs[i], xs[i + 1], ty, H, sz0, sz1, up);
  } else {
    B('top', lx, rx, ty, H, zb, fz, up);
  }

  if (th) {
    B('front', x0, x1, 0, H - e, zf - t, zf, [0, 0, 26]);
    if (S.left) B('side', x0, x0 + t, 0, H - e, zb, zf - e, [-26, 0, 0]);
    if (S.right) B('side', x1 - t, x1, 0, H - e, zb, zf - e, [26, 0, 0]);
  }

  if (int) {
    cs.forEach((c) => {
      const a0 = c - sL / 2;
      const a1 = c + sL / 2;
      const sp = n > 1 ? c * 0.35 : 0;
      const X = (x, y, z) => [x + sp, y, z];

      B('wl', a0, a1, 0, H - e, sz1 + e, sz1 + t, X(0, 0, 9));
      B('wl', a0, a1, 0, H - e, sz0 - t, sz0 - e, X(0, 0, -9));
      B('ws', a0 - t, a0 - e, 0, H - e, sz0, sz1, X(-9, 0, 0));
      B('ws', a1 + e, a1 + t, 0, H - e, sz0, sz1, X(9, 0, 0));

      // Dno ze spadkiem do odpływu — lekko pochylona płyta.
      const gp = ins > 0 ? 1 : 0;
      const zA = sz0 + ins + gp;
      const yB = t + 0.6;
      const rozpietosc = sz1 - zA;
      const spad = Math.max(1.5, rozpietosc * 0.06);
      const kat = Math.atan2(spad, rozpietosc);
      P.push({
        k: 'slope',
        s: [sL - 2 * e, t, Math.hypot(rozpietosc, spad)],
        p: [c, yB + spad / 2 - (t / 2) * Math.cos(kat), (zA + sz1) / 2 + (t / 2) * Math.sin(kat)],
        rx: -kat,
        ex: X(0, 14, 0),
      });
      if (ins > 0) B('ins', a0 + e, a1 - e, yB - t, yB, sz0 + e, sz0 + ins, X(0, 25, -6));
      // Ciemny kanał odpływu — sam dołek, żeby dno nie wyglądało na płaskie.
      B('chan', a0 + e, a1 - e, 0, 0.4, sz0, zA + 0.5, [0, 0, 0], { dark: 1, hideEx: 1 });
    });
  } else {
    /*
     * MISKI CERAMICZNE — nablatowe stoją na kamieniu, podblatowe wiszą
     * pod wyciętym otworem. Nie wchodzą w cenę (klient kupuje je sam),
     * ale muszą być na podglądzie: bez nich blat z dziurą wygląda jak
     * pomyłka, a nie jak umywalka.
     */
    cs.forEach((c) => {
      P.push({
        k: 'bowl',
        obj: 'bowl',
        p: [c, S.mode === 'under' ? H - t : H, S.mode === 'under' ? 0 : 3],
        pod: S.mode === 'under',
        ex: up,
      });
    });
  }

  for (let i = 0; i < Math.min(S.holes, Math.max(1, cs.length)); i++) {
    P.push({
      k: 'tap',
      obj: 'tap',
      // Bateria stoi za miską: przy zlewie w kamieniu i przy podblatowej
      // na rancie za otworem, przy nablatowej przy tylnej krawędzi.
      p: [cs[i] ?? 0, H, zOtworem(S) ? (zb + sz0) / 2 : zb + 5],
      ex: up,
    });
  }

  return P;
}

/** Jedno zdanie o konfiguracji — na kartę, do maila i do tematu zgłoszenia. */
export function opisKonfiguracji(S) {
  const czesci = [`Umywalka ${fd(S.L)} × ${fd(S.W)} cm`];
  const ile = S.n;
  if (S.mode === 'int') {
    czesci.push(
      ile === 2
        ? `dwa zlewy w kamieniu ${fd(S.sL)} × ${fd(S.sW)}, mostek ${fd(S.gap)} cm`
        : `zlew wycięty w kamieniu ${fd(S.sL)} × ${fd(S.sW)}`
    );
  } else if (S.mode === 'under') {
    czesci.push(
      ile > 1
        ? `${slownie(ile)} otwory pod umywalki podblatowe ${fd(S.sL)} × ${fd(S.sW)}`
        : `otwór pod umywalkę podblatową ${fd(S.sL)} × ${fd(S.sW)}`
    );
  } else {
    czesci.push(ile > 1 ? `blat pod ${slownie(ile)} umywalki nablatowe` : 'blat pod umywalkę nablatową');
  }
  if (grube(S)) {
    const boki = iloscBokow(S);
    czesci.push(`krawędź ${fd(S.H)} cm${boki ? ` (przód + ${boki === 2 ? '2 boki' : 'bok'})` : ''}`);
  }
  czesci.push(S.mont ? 'z montażem' : 'odbiór własny');
  return czesci.join(', ');
}

/**
 * Podpis pod nagłówkiem wizualizacji — sam przedmiot, bez wymiarów blatu
 * (te są niżej, na karcie konfiguracji).
 *
 * Mieszka tutaj, a nie w wizualizacja.js, bo tamta kopia nie znała trybu
 * „under" i na renderze z dwiema podblatowymi pisała „Blat pod umywalkę
 * nablatową" — zła nazwa produktu na obrazku, który klient pokazuje
 * rodzinie i który leci załącznikiem w mailu (24.11.2026).
 */
export function podpisUmywalki(S) {
  const ile = Math.max(1, Number(S?.n) || 1);
  const wym = `${fd(S.sL)} × ${fd(S.sW)} cm`;
  const kazdy = ile > 1 ? `${wym} każdy` : wym;

  if (S.mode === 'int') {
    return ile > 1
      ? `${wielka(slownie(ile))} zlewy wycięte w kamieniu · ${kazdy}`
      : `Zlew wycięty w kamieniu · ${wym}`;
  }
  if (S.mode === 'under') {
    return ile > 1
      ? `${wielka(slownie(ile))} otwory pod umywalki podblatowe · ${kazdy}`
      : `Otwór pod umywalkę podblatową · ${wym}`;
  }
  return ile > 1 ? `Blat pod ${slownie(ile)} umywalki nablatowe` : 'Blat pod umywalkę nablatową';
}

const fd = (v) => (Math.round(v * 10) / 10).toLocaleString('pl-PL');
const slownie = (n) => ({ 2: 'dwa', 3: 'trzy' })[n] || String(n);
const wielka = (s) => s.charAt(0).toUpperCase() + s.slice(1);

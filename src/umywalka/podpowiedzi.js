/**
 * PODPOWIEDZI Z REGUŁ — „pomysł 0" ze specyfikacji: bez AI, bez kosztu.
 *
 * To jest ta część, która ma sprawiać, że kalkulator „rozumie, co robię".
 * Nie trzeba do tego modelu językowego: trzeba wiedzieć, co w kamieniarstwie
 * naprawdę decyduje o cenie i o tym, czy rzecz da się dobrze zrobić.
 *
 * Reguła numer jeden to POŁÓWKA PŁYTY. Keralini i Avant wolno kupić
 * w połowie formatu (320 × 80 zamiast 320 × 160). Umywalka, która się
 * w niej mieści, kosztuje materiałowo połowę tego, co umywalka kilka
 * centymetrów dłuższa. Klient nie ma skąd tego wiedzieć — i właśnie
 * dlatego mu to mówimy, razem z gotowym przyciskiem „ustaw 169 cm".
 *
 * Progi liczymy SILNIKIEM, nie wpisujemy ich z palca: zmiana formatu płyty
 * w cenniku dostawcy ma sama przestawić podpowiedzi.
 *
 * Zasady: najwyżej jedna podpowiedź naraz (ta najważniejsza), nigdy kwota
 * przed formularzem, nigdy ton zakazu — „zrobimy też cieńszą", a nie
 * „nie wolno".
 */
import { upakuj } from '../engine/pakowanie.js';
import { normalizuj, odcinki, nieckaStanu, ostrzezeniaWymiarow, ZAKRESY } from './geometria.js';

/** Czy przy takim stanie wystarczy połówka płyty. */
function mieciSieWPolowce(stan, plyta) {
  if (!plyta?.polowkaDozwolona) return false;
  const pak = upakuj(odcinki(stan), plyta);
  return pak.polowka === true && pak.plytyPelne === 0;
}

/**
 * Znaczek pod bryłą, gdy klient trafił w połówkę.
 *
 * Osobno od podpowiedzi, bo to nie rada, tylko potwierdzenie — ma być
 * widoczne cały czas, nie zamiast innej wskazówki.
 */
export function znacznikPolowki(pak) {
  if (!pak || pak.polowka !== true || pak.plytyPelne > 0) return null;
  return { ok: true, tekst: '✓ Mieści się w połówce płyty' };
}

/**
 * Najbliższy wymiar, który zmieści się w połówce.
 *
 * Najpierw skracamy długość (co 1 cm, maksymalnie o 40 cm i nie poniżej
 * 60 cm) — to zmiana, którą klient najłatwiej zaakceptuje. Jeśli to nie
 * pomaga, schodzimy z głębokości (co 1 cm, nie poniżej 40 cm).
 *
 * @returns {{L:number}|{G:number}|{L:number,G:number}|null}
 */
export function najblizszaPolowka(stan, plyta) {
  const s = normalizuj(stan);
  if (!plyta?.polowkaDozwolona) return null;

  const dolnaL = Math.max(ZAKRESY.L[0], s.L - 40);
  for (let L = s.L - 1; L >= dolnaL; L--) {
    // Niecka liczona automatycznie zmienia się razem z blatem — dlatego
    // nie wolno podmienić samej długości i zostawić starej niecki.
    if (mieciSieWPolowce({ ...s, L }, plyta)) return { L };
  }

  for (let G = s.G - 1; G >= ZAKRESY.G[0]; G--) {
    if (mieciSieWPolowce({ ...s, G }, plyta)) return { G };
    // Przy bardzo głębokiej umywalce sama głębokość nie wystarczy —
    // próbujemy jeszcze raz ze skróconą długością.
    const zKrotszym = najblizszaDlugosc({ ...s, G }, plyta);
    if (zKrotszym) return { L: zKrotszym, G };
  }

  return null;
}

function najblizszaDlugosc(stan, plyta) {
  const dolna = Math.max(ZAKRESY.L[0], stan.L - 40);
  for (let L = stan.L - 1; L >= dolna; L--) {
    if (mieciSieWPolowce({ ...stan, L }, plyta)) return L;
  }
  return null;
}

/* ──────────────────────────────────────────────────────── reguły */

/**
 * Reguła 1 — połówka płyty. Najdroższa rzecz w całej wycenie.
 * Przed formularzem BEZ kwot: mówimy „tańszy kamień", nie „mniej o 2 000 zł".
 */
function regulaPolowki(stan, pak, plyta) {
  if (znacznikPolowki(pak)) return null;
  if (!plyta?.polowkaDozwolona) return null;

  const zmiana = najblizszaPolowka(stan, plyta);
  if (!zmiana) return null;

  const L = zmiana.L ?? stan.L;
  const G = zmiana.G ?? stan.G;
  const opis = zmiana.G !== undefined ? `${L} × ${G} cm` : `${L} cm`;

  return {
    id: 'polowka',
    waga: 1,
    tekst:
      `Przy ${opis} zmieścimy się w połowie płyty — kamienia potrzeba o połowę mniej. ` +
      'Przy obecnym wymiarze trzeba kupić całą płytę.',
    akcja: {
      etykieta: zmiana.G !== undefined ? `Ustaw ${L} × ${G} cm` : `Ustaw ${L} cm`,
      zmiana,
    },
  };
}

/**
 * Reguła 2 — bateria z blatu potrzebuje rantu, na którym stanie.
 *
 * ⚠ ODSTĘPSTWO OD SPECYFIKACJI, ŚWIADOME (23.11.2026).
 * Specyfikacja §10.2 podaje próg 8 cm, ale przy niecce liczonej jej własnym
 * wzorem (`zG = G − 15`) i głębokości 50 cm rant wychodzi 7,5 cm — czyli
 * DOMYŚLNA umywalka Dawida (100 × 35 w blacie 120 × 50, dokładnie jak
 * w jego artefakcie) dostawałaby ostrzeżenie przy każdym otwarciu strony.
 * Podpowiedź, która zapala się zawsze, przestaje być podpowiedzią.
 * Dlatego próg to 7 cm: 7,5 cm przechodzi, a realnie za wąski rant (6 cm
 * i mniej) nadal ostrzega. Do potwierdzenia przez Dawida na pierwszej
 * realnej umywalce — wtedy albo próg, albo wzór niecki.
 */
function regulaBaterii(stan) {
  if (stan.bateria !== 'blat') return null;
  if (stan.typ !== 'zintegrowana') return null;

  const n = nieckaStanu(stan);
  const rant = Math.round(((stan.G - n.G) / 2) * 10) / 10;
  if (rant >= 7) return null;

  return {
    id: 'bateria',
    waga: 2,
    tekst:
      `Przy tej niecce zostaje po ${String(rant).replace('.', ',')} cm z każdej strony — ` +
      'bateria z blatu może się nie zmieścić. Rozważ baterię ze ściany.',
  };
}

/** Reguła 3 — proporcje krawędzi. Sugestia, nie zakaz. */
function regulaKrawedzi(stan) {
  if (stan.H >= 15) return null;
  return {
    id: 'krawedz',
    waga: 3,
    tekst: 'Krawędź wygląda najlepiej od 15 cm w górę — cieńszą też zrobimy.',
  };
}

/** Reguła 4 — wymiar poza suwakami. Zawsze z obietnicą ceny. */
function regulaWymiaru(stan) {
  const ostrzezenia = ostrzezeniaWymiarow(stan);
  if (!ostrzezenia.length) return null;
  return { id: 'wymiar', waga: 4, tekst: ostrzezenia[0] };
}

/** Reguła 5 — skoro i tak cała płyta, niech druga połowa na coś pójdzie. */
function regulaCalejPlyty(stan, pak, plyta) {
  if (znacznikPolowki(pak)) return null;
  if (najblizszaPolowka(stan, plyta)) return null;
  return {
    id: 'calaPlyta',
    waga: 5,
    tekst:
      'Przy tym wymiarze kupujemy całą płytę — z drugiej połowy dorobimy ' +
      'półkę albo parapet w tym samym kamieniu.',
  };
}

/**
 * Jedna podpowiedź — ta najważniejsza.
 *
 * Dwie rady naraz pod bryłą czyta się jak listę zarzutów; klient wtedy nie
 * robi żadnej z nich. Kolejność ważności jest w `waga`.
 *
 * @param {{stan:object, pak:object, plyta:object}} p
 */
export function podpowiedz({ stan, pak, plyta } = {}) {
  if (!stan) return null;
  const s = normalizuj(stan);

  const kandydaci = [
    regulaPolowki(s, pak, plyta),
    regulaBaterii(s),
    regulaKrawedzi(s),
    regulaWymiaru(s),
    regulaCalejPlyty(s, pak, plyta),
  ].filter(Boolean);

  if (!kandydaci.length) return null;
  kandydaci.sort((a, b) => a.waga - b.waga);
  return kandydaci[0];
}

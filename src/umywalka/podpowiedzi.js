/**
 * PODPOWIEDZI — reguły, zero AI, zero kosztu.
 *
 * Dwie rodziny:
 *
 * 1. OSTRZEŻENIA WYKONAWCZE — z projektu Dawida: wąski rant, wąski mostek
 *    między zlewami, za mało miejsca na baterię. To wiedza z hali, nie
 *    z internetu, i dlatego zostaje słowo w słowo.
 *
 * 2. POŁÓWKA PŁYTY — nasza, bo tylko my widzimy, co robi silnik wyceny.
 *    Keralini i Avant wolno kupić w połowie formatu 320 × 160. Umywalka,
 *    która się w niej mieści, kosztuje materiałowo połowę tego, co umywalka
 *    kilka centymetrów dłuższa. Klient nie ma skąd tego wiedzieć — więc
 *    mówimy mu to sami i dajemy gotowy przycisk „Ustaw 169 cm".
 *
 * Progi połówki liczymy SILNIKIEM, nie wpisujemy ich z palca: zmiana formatu
 * płyty w cenniku dostawcy ma sama przestawić podpowiedzi.
 */
import { upakuj } from '../engine/pakowanie.js';
import { zacisnij, odcinki, ranty } from './model.js';

/** Czy przy takiej konfiguracji wystarczy połówka płyty. */
function mieciSieWPolowce(S, plyta) {
  if (!plyta?.polowkaDozwolona) return false;
  const pak = upakuj(odcinki(S), plyta);
  return pak.polowka === true && pak.plytyPelne === 0;
}

/** Znaczek nad ceną, gdy klient trafił w połówkę. */
export function znacznikPolowki(pak) {
  if (!pak || pak.polowka !== true || pak.plytyPelne > 0) return null;
  return { ok: true, tekst: 'Mieści się w połówce płyty' };
}

/**
 * Najbliższa długość, która zmieści się w połówce.
 *
 * Skracamy co 1 cm, najwyżej o 40 cm i nie poniżej 60 — dłuższe szukanie
 * daje propozycje, których nikt nie przyjmie („zamiast 180 proponujemy 110").
 * Zlew przycina się sam razem z blatem (patrz `zacisnij`).
 */
export function najblizszaPolowka(S, plyta) {
  if (!plyta?.polowkaDozwolona) return null;
  const dolna = Math.max(60, Math.round(S.L) - 40);
  for (let L = Math.round(S.L) - 1; L >= dolna; L--) {
    const kandydat = zacisnij({ ...S, L, sL: Math.min(S.sL, L - 10) });
    if (mieciSieWPolowce(kandydat, plyta)) return { L };
  }
  return null;
}

/**
 * Ostrzeżenia wykonawcze z projektu Dawida — teksty jego, bo to jego wiedza
 * o tym, co pęka przy transporcie.
 */
export function ostrzezeniaWykonawcze(S) {
  const lista = [];
  if (S.mode !== 'int') {
    return [
      {
        rodzaj: 'info',
        tekst:
          'Umywalka nablatowa nie jest wliczona w cenę. Otwór na jej odpływ ' +
          'policz w „Otworach w blacie".',
      },
    ];
  }

  const r = ranty(S);
  if (r.bok < 6 || r.przod < 6) {
    lista.push({
      rodzaj: 'uwaga',
      tekst:
        'Wąski rant przy zlewie (poniżej 6 cm) — blat łatwiej pęknie przy ' +
        'transporcie i montażu.',
    });
  }
  if (S.n === 2 && S.gap < 10) {
    lista.push({
      rodzaj: 'uwaga',
      tekst: 'Wąski mostek między zlewami (poniżej 10 cm) — łatwo go złamać przy transporcie.',
    });
  }
  if (S.holes > 0 && r.przod < 7) {
    lista.push({
      rodzaj: 'uwaga',
      tekst:
        'Za zlewem zostaje mniej niż 7 cm — otwór Ø35 na baterię może się nie ' +
        'zmieścić, rozważ baterię ścienną.',
    });
  }
  return lista;
}

/**
 * Podpowiedź o połówce płyty — najwyżej jedna, z gotową akcją.
 *
 * Przed formularzem BEZ kwot: mówimy „o połowę mniej kamienia", a nie
 * „mniej o 2 000 zł". Kwoty pokazujemy dopiero przy cenie.
 */
export function podpowiedzPolowki({ stan, pak, plyta } = {}) {
  if (!stan || !plyta) return null;
  if (znacznikPolowki(pak)) return null;
  if (!plyta.polowkaDozwolona) return null;

  const zmiana = najblizszaPolowka(stan, plyta);
  if (!zmiana) {
    return {
      id: 'calaPlyta',
      tekst:
        'Przy tym wymiarze kupujemy całą płytę — z drugiej połowy dorobimy ' +
        'półkę albo parapet w tym samym kamieniu.',
    };
  }

  return {
    id: 'polowka',
    tekst:
      `Przy długości ${zmiana.L} cm zmieścimy się w połowie płyty — kamienia ` +
      'potrzeba o połowę mniej. Przy obecnym wymiarze trzeba kupić całą płytę.',
    akcja: { etykieta: `Ustaw ${zmiana.L} cm`, zmiana },
  };
}

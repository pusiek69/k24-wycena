/**
 * PLANOWANY CZAS REALIZACJI — jedno pole w formularzu wyceny.
 *
 * Zlecenie Dawida (30.08.2026): „chcę wiedzieć, czy klientowi zależy
 * na blacie za tydzień, czy planuje za rok". To najtańsza informacja,
 * jaką można dostać od klienta — jedno kliknięcie — a decyduje o tym,
 * kogo Dawid obdzwania najpierw.
 *
 * Moduł jest CZYSTY (bez DOM-u i bez sieci), bo tych samych wartości
 * używa front, worker (mail leadowy) i panel (kolumna, filtr, plakietka).
 * Jedna lista w jednym miejscu — inaczej etykieta w mailu i w panelu
 * zaczęłyby się rozjeżdżać przy pierwszej zmianie.
 *
 * ⚠ `id` trafia do bazy i NIE WOLNO go zmieniać — stare wyceny mają
 * już zapisane te wartości i po zmianie pokazałyby się jako nieznane.
 * Etykiety można poprawiać do woli.
 */

/** Wartość zapisywana, gdy klient nic nie wybrał (albo wycena jest starsza niż to pole). */
export const NIEZNANY = '';

export const TERMINY = [
  {
    id: 'pilne',
    label: 'Jak najszybciej — do 2 tygodni',
    // Krótki opis do maila i panelu; pełna etykieta bywa za długa w tabeli.
    krotki: 'do 2 tygodni',
    pilny: true,
  },
  { id: 'miesiac', label: 'W ciągu miesiąca', krotki: 'w miesiąc' },
  { id: 'kwartal', label: 'Za 1–3 miesiące', krotki: '1–3 mies.' },
  { id: 'pol_roku', label: 'Za 3–6 miesięcy', krotki: '3–6 mies.' },
  { id: 'pozniej', label: 'Później — dopiero planuję', krotki: 'dopiero planuje' },
];

/** Wpis po id, albo null. Nieznane id nie może wywalić karty ani panelu. */
export function termin(id) {
  return TERMINY.find((t) => t.id === id) || null;
}

/** Pełna etykieta do formularza i maila; pusty string, gdy nic nie wybrano. */
export function etykietaTerminu(id) {
  return termin(id)?.label || '';
}

/** Krótka etykieta do tabeli w panelu. */
export function krotkiTermin(id) {
  return termin(id)?.krotki || '';
}

/**
 * Czy to klient „na już".
 *
 * Po tym panel rysuje plakietkę PILNE, a mail leadowy dostaje wyróżnienie
 * w temacie. Świadomie JEDEN próg, nie skala: Dawid ma na to spojrzeć
 * i wiedzieć, do kogo dzwoni najpierw, a nie ważyć pięć odcieni pilności.
 */
export function pilny(id) {
  return !!termin(id)?.pilny;
}

/**
 * Czy podana wartość jest jednym ze znanych terminów.
 * Worker sprawdza to przed zapisem — do bazy nie ma prawa wejść nic,
 * czego panel potem nie umie wyświetlić.
 */
export function znanyTermin(id) {
  return id === NIEZNANY || TERMINY.some((t) => t.id === id);
}

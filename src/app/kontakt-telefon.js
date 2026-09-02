/**
 * ZGODA NA TELEFON — jedno pytanie w formularzu wyceny.
 *
 * Zlecenie Dawida (01.09.2026), jego słowami: „nie będę od razu dzwonił
 * do każdego, kto skorzysta z kalkulatora, tylko chcę dzwonić do osób
 * faktycznie tych, co chcą rozmawiać. Bo miałem tak, że Pani odebrała
 * telefon i nie bardzo była zadowolona, że dzwonię."
 *
 * To nie jest zgoda RODO — tę klient daje osobnym checkboxem niżej
 * („zgadzam się na kontakt w sprawie tej wyceny"). To PREFERENCJA KANAŁU:
 * czy woli, żeby Dawid zadzwonił, czy woli dostać wszystko na piśmie.
 * Dwie różne rzeczy i celowo nie mieszamy ich w jedno pole.
 *
 * Moduł jest CZYSTY (bez DOM-u i bez sieci), bo tych samych wartości używa
 * front, worker (mail leadowy) i panel (kolumna, filtr, plakietka) —
 * dokładnie tak samo jak `termin.js`. Jedna lista w jednym miejscu,
 * inaczej etykieta w mailu i w panelu zaczęłyby się rozjeżdżać.
 *
 * ⚠ `id` trafia do bazy i NIE WOLNO go zmieniać — starsze zgłoszenia mają
 * już zapisane te wartości. Etykiety można poprawiać do woli.
 */

/** Zgłoszenia sprzed 01.09.2026 nie mają tego pola — i to nie jest błąd. */
export const NIEZNANY = '';

export const KANALY = [
  {
    id: 'tak',
    label: 'Tak, proszę o telefon',
    // Krótko — do tabeli w panelu, gdzie pełna etykieta się nie mieści.
    krotki: 'chce telefon',
    // Po tym panel rysuje plakietkę, a mail leadowy dostaje wyróżnienie.
    dzwonic: true,
  },
  {
    id: 'nie',
    label: 'Wolę mailem lub SMS-em',
    krotki: 'bez telefonu',
    dzwonic: false,
  },
];

/** Wpis po id, albo null. Nieznane id nie może wywalić karty ani panelu. */
export function kanal(id) {
  return KANALY.find((k) => k.id === id) || null;
}

/** Pełna etykieta do formularza i maila; pusty string, gdy nic nie wybrano. */
export function etykietaKanalu(id) {
  return kanal(id)?.label || '';
}

/** Krótka etykieta do tabeli w panelu. */
export function krotkiKanal(id) {
  return kanal(id)?.krotki || '';
}

/**
 * Czy do tego klienta MOŻNA dzwonić.
 *
 * ⚠ Domyślna odpowiedź to NIE. Brak wyboru (starsze zgłoszenie, pole
 * dodane później) nie jest zgodą — a właśnie o to Dawidowi chodziło:
 * nie dzwonić do kogoś, kto o telefon nie prosił. Panel pokazuje wtedy
 * „nie pytaliśmy", żeby dało się odróżnić „nie chce" od „nie wiadomo".
 */
export function dzwonic(id) {
  return kanal(id)?.dzwonic === true;
}

/**
 * Czy klient WPROST odmówił telefonu — to co innego niż brak odpowiedzi.
 * Panel maluje tę różnicę, bo do „nie wiadomo" wolno zadzwonić po namyśle,
 * a do „nie dzwonić" nie wolno wcale.
 */
export function odmowiono(id) {
  return kanal(id)?.dzwonic === false;
}

/**
 * Czy podana wartość jest jednym ze znanych kanałów.
 * Worker sprawdza to przed zapisem — do bazy nie ma prawa wejść nic,
 * czego panel potem nie umie wyświetlić.
 */
export function znanyKanal(id) {
  return id === NIEZNANY || KANALY.some((k) => k.id === id);
}

/**
 * Zdanie dla klienta PO wysłaniu zgłoszenia — potwierdzenie tego, co wybrał.
 *
 * Dawid prosił, żeby po wysłaniu wyceny było „bardzo widocznie" widać
 * ustalenie co do telefonu. Klient ma przeczytać wprost, czego się
 * spodziewać: zadzwonimy albo nie zadzwonimy.
 */
export function potwierdzenie(id, telefon = '') {
  if (dzwonic(id)) {
    return telefon
      ? `Zadzwonimy pod ${telefon} — zwykle tego samego dnia, w godzinach 8–18.`
      : 'Zadzwonimy — zwykle tego samego dnia, w godzinach 8–18.';
  }
  if (odmowiono(id)) {
    return 'Nie będziemy dzwonić. Wycena i odpowiedzi pójdą na e-mail — ' +
      'gdyby jednak wygodniej było porozmawiać, proszę dzwonić śmiało: 796 991 128.';
  }
  return '';
}

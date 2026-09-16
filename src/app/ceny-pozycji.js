/**
 * ══════════════════════════════════════════════════════════════════════════
 *  RĘCZNE CENY USŁUG W EDYTORZE WŁAŚCICIELA  (zlecenie Dawida, 16.09.2026)
 *
 *  „Chcę mieć możliwość zmiany ceny w każdej usłudze."
 *
 *  Dawid nadpisuje cenę pojedynczej pozycji (cięcie, otwory, montaż…)
 *  na czas JEDNEJ wyceny. Cennik zakładu i stawki z panelu zostają
 *  nietknięte — to jest cała różnica między tym a `/panel/api/stawki`.
 *
 *  Reguły, które muszą być w jednym miejscu, bo korzysta z nich i lista
 *  pozycji na ekranie, i suma oferty, i zapis do parametrów:
 *    • cena ręczna wygrywa z cennikową, ale GRATIS wygrywa z obiema,
 *    • wpisanie dokładnie ceny cennikowej kasuje nadpisanie (inaczej
 *      pozycja zostałaby „ręczna" na zawsze i przestała reagować na zmianę
 *      stawek w panelu),
 *    • różnica z nadpisań wchodzi do kwoty PRZED upustem — nadpisanie to
 *      nowa cena, a nie rabat do przekreślenia.
 * ══════════════════════════════════════════════════════════════════════════
 */

/**
 * Kwota z pola. Tolerujemy przecinek dziesiętny i spacje („1 499,50"):
 * pole jest typu `number`, ale wklejona kwota albo inna klawiatura potrafi
 * przynieść zapis po polsku, a ciche zero w cenie usługi to najgorszy
 * możliwy błąd tej funkcji — oferta wychodzi tańsza, niż ktokolwiek chciał.
 */
const kwota = (x) => {
  const n =
    typeof x === 'number'
      ? x
      : Number(String(x ?? '').replace(/[\s ]/g, '').replace(',', '.').replace(/[^0-9.-]/g, ''));
  return Math.max(0, Math.round(Number.isFinite(n) ? n : 0));
};

/** Cena pozycji w tej wycenie: ręczna, gdy jest, inaczej cennikowa. */
export function cenaPozycji(ceny, pozycja) {
  const reczna = ceny?.get?.(pozycja?.nazwa);
  return reczna === undefined ? Math.round(Number(pozycja?.brutto) || 0) : kwota(reczna);
}

/** Czy ta pozycja ma cenę wpisaną ręcznie. */
export const recznaCena = (ceny, nazwa) => !!ceny?.has?.(nazwa);

/**
 * Ustawia cenę pozycji. Zwraca TĘ SAMĄ mapę, żeby wywołanie dało się wpiąć
 * w jedną linię obsługi pola. Cena równa cennikowej = powrót do cennika.
 */
export function ustawCene(ceny, pozycja, nowa) {
  const cennikowa = Math.round(Number(pozycja?.brutto) || 0);
  // Wyczyszczone pole = powrót do cennika. Inaczej skasowanie zawartości
  // przed wpisaniem nowej kwoty zostawiałoby pozycję na sztywnym zerze.
  if (String(nowa ?? '').trim() === '') {
    ceny.delete(pozycja.nazwa);
    return ceny;
  }
  const czysta = kwota(nowa);
  if (czysta === cennikowa) ceny.delete(pozycja.nazwa);
  else ceny.set(pozycja.nazwa, czysta);
  return ceny;
}

/**
 * O ile ręczne ceny zmieniają kwotę wyjściową oferty.
 *
 * Liczymy KAŻDĄ pozycję silnika, także tę „w cenie" — jej kwota bazowa
 * to zero, więc wpisana cena wchodzi do sumy w całości. To jest dokładnie
 * przypadek pomiaru Prolinerem: świadczenie stoi na liście za 0 zł, a Dawid
 * chce mu czasem nadać cenę (zgłoszenie z 16.09.2026, po pierwszym podejściu,
 * które te pozycje pomijało).
 *
 * Pomijamy tylko wyzerowane na gratis — te odejmuje osobny mechanizm,
 * i to po cenie cennikowej, bo taka siedzi w sumie silnika.
 */
export function roznicaRecznychCen(ceny, pozycje, gratisy) {
  return (pozycje || [])
    .filter((p) => !gratisy?.has?.(p.nazwa))
    .reduce((suma, p) => suma + (cenaPozycji(ceny, p) - Math.round(Number(p.brutto) || 0)), 0);
}

/** Parametry oferty → mapa cen (po „Powtórz wycenę" nic nie ginie). */
export function zParametrow(obiekt) {
  return new Map(
    Object.entries(obiekt && typeof obiekt === 'object' ? obiekt : {})
      .map(([nazwa, wartosc]) => [String(nazwa), kwota(wartosc)])
      .filter(([nazwa]) => nazwa)
  );
}

/** Mapa cen → parametry oferty. Pusta mapa nie zostawia po sobie pola. */
export const doParametrow = (ceny) => (ceny?.size ? Object.fromEntries(ceny) : undefined);

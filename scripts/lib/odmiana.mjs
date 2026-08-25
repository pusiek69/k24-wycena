/**
 * ODMIANA RZECZOWNIKA PO LICZBIE — po polsku.
 *
 * Potrzebne, bo liczby wzorów na stronach aktualizują się automatycznie
 * (patrz scripts/ceny-tresc.mjs), a wraz z liczbą MUSI zmienić się forma
 * słowa: „24 dekory" → „30 dekorów". Sama podmiana cyfry zostawiłaby
 * na stronie „30 dekory", czyli błąd językowy na wizytówce firmy.
 *
 * Reguła polska:
 *   1                      → dekor      (mianownik l. poj.)
 *   2–4, 22–24, 32–34 …    → dekory     (mianownik l. mn.)
 *   pozostałe, w tym 12–14 → dekorów    (dopełniacz l. mn.)
 *
 * Wyjątek 12–14 jest istotny: „12 dekorów", nie „12 dekory", mimo że
 * końcówka to 2, 3 albo 4.
 */
export function odmiana(liczba, [pojedyncza, kilka, wiele]) {
  const n = Math.abs(Math.round(Number(liczba) || 0));
  if (n === 1) return pojedyncza;

  const ostatnia = n % 10;
  const dwieOstatnie = n % 100;
  const nastki = dwieOstatnie >= 12 && dwieOstatnie <= 14;

  return ostatnia >= 2 && ostatnia <= 4 && !nastki ? kilka : wiele;
}

/** Gotowe formy dla słów, których używamy na stronach. */
export const FORMY = {
  dekor: ['dekor', 'dekory', 'dekorów'],
  wzor: ['wzór', 'wzory', 'wzorów'],
};

/** „62 dekory" — liczba razem z właściwą formą słowa. */
export const zOdmiana = (liczba, slowo) =>
  `${liczba} ${odmiana(liczba, FORMY[slowo] || FORMY.dekor)}`;

/**
 * Zaokrąglenie w dół do pełnej setki — do haseł typu „Ponad 700 wzorów".
 *
 * Deklaracja marketingowa ma być PRAWDZIWA i okrągła: przy 734 wzorach
 * piszemy „ponad 700", nigdy „ponad 800". Zaokrąglamy w dół, żeby zdanie
 * nie stało się nieprawdziwe między jednym a drugim cennikiem.
 */
export const doPelnejSetki = (liczba) => Math.floor((Number(liczba) || 0) / 100) * 100;

/**
 * ILE JESZCZE PYTAŃ — licznik kroków ścieżki klikanej.
 *
 * Przegląd designu z 9.10.2026 (mobile, oczami klienta-laika): „klient nie
 * wie, ile pytań zostało, a to realnie 4–5 kroków". Bez tej informacji
 * każda kolejna karta wygląda jak początek czegoś dłuższego — a to jest
 * dokładnie ten moment, w którym ludzie zamykają kartę.
 *
 * TYLKO ŚCIEŻKA KLIKANA. W rozmowie swobodnej klient potrafi wrócić do
 * materiału po podaniu wymiarów, dopisać drugi blat albo zapytać o coś
 * obok — kroki przestają być liniowe i licznik mówiłby nieprawdę. Lepiej
 * nie pokazać nic, niż pokazać „KROK 2 Z 5", gdy za chwilę będzie ich
 * siedem (wariant bezpieczny z raportu).
 *
 * KROKÓW JEST SZEŚĆ, nie pięć jak szacował raport: po rodzaju kamienia stoi
 * jeszcze wybór kolekcji. Policzone z pomocników, nie z pamięci.
 *
 * Pomocnicy wchodzące w rozmowę z boku (wyprzedaż płyt, wyszukiwarka
 * kamienia naturalnego, karta wybranej płyty) kroku NIE mają i nie
 * dostaną licznika — `postep()` zwraca dla nich `null`.
 *
 * To warstwa prezentacji: nic tu nie dotyka silnika wyceny ani lejka
 * leadów, a kolejność pytań zostaje taka, jaka była.
 */

/** Kroki ścieżki klikanej, w kolejności, w jakiej widzi je klient. */
export const KROKI = [
  { id: 'pomieszczenie', etykieta: 'Pomieszczenie' },
  { id: 'rodzaj', etykieta: 'Materiał' },
  { id: 'material', etykieta: 'Kolekcja' },
  { id: 'dekor', etykieta: 'Wzór' },
  { id: 'wymiary', etykieta: 'Wymiary' },
  { id: 'szczegoly', etykieta: 'Szczegóły' },
];

export const ILE_KROKOW = KROKI.length;

/**
 * @param {string} id  identyfikator kroku albo cokolwiek innego
 * @returns {{numer:number, ile:number, etykieta:string, udzial:number}|null}
 *   `null`, gdy krok nie należy do ścieżki klikanej.
 */
export function postep(id) {
  const i = KROKI.findIndex((k) => k.id === id);
  if (i < 0) return null;
  const numer = i + 1;
  return {
    numer,
    ile: ILE_KROKOW,
    etykieta: `KROK ${numer} Z ${ILE_KROKOW}`,
    udzial: Math.round((numer / ILE_KROKOW) * 100),
  };
}

/**
 * BEZ CEN JEDNOSTKOWYCH (decyzja Dawida, 21.08.2026).
 *
 * Wycena, którą Dawid wysyła osobiście, ma pokazywać kwoty pozycji
 * i sumę — ale nie stawki, z których powstały. Klient widzi „2 szt.",
 * nie „2 szt. × 150 zł": inaczej każda negocjacja zaczyna się od licytacji
 * stawek zamiast od wartości całości.
 *
 * Zostawiamy samą ILOŚĆ, bo ta tłumaczy, skąd kwota (2,7 m², 3 m.b.).
 */
export function bezCenJednostkowych(detal) {
  const t = String(detal || '').trim();
  if (!t) return '';
  // „2 szt. × 150 zł" → „2 szt."; „5,2 m² × 60 zł" → „5,2 m²".
  const bezStawki = t.replace(/\s*[×x]\s*[\d\s.,]+\s*zł.*$/i, '').trim();
  // Cokolwiek jeszcze niesie kwotę (np. „baza 1500 zł + …") wycinamy w całości.
  return /\d\s*zł/i.test(bezStawki) ? '' : bezStawki;
}

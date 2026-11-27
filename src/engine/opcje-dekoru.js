/**
 * CZY OPCJA JEST DOSTĘPNA PRZY TYM DEKORZE.
 *
 * Większość obróbek (otwory, listwa, krawędź) dotyczy każdego dekoru
 * w cenniku. Są jednak dopłaty zależne od konkretnego wzoru — u Pacifica
 * wykończenie Matt/Suede jest dostępne tylko przy części dekorów
 * (w cenniku oznaczone gwiazdką).
 *
 * Reguła siedzi w jednym miejscu, bo pyta o nią i silnik (żeby nie doliczył
 * dopłaty tam, gdzie jej nie ma), i kreator (żeby nie pokazał klientowi
 * przycisku, którego nie da się kupić).
 *
 * Brak `tylkoDekory` = opcja dostępna zawsze. Dzięki temu wszystkie
 * dotychczasowe cenniki działają bez zmian.
 */
export function opcjaDostepna(opcja, dekor) {
  const lista = opcja?.tylkoDekory;
  if (!Array.isArray(lista)) return true;
  return lista.includes(String(dekor || ''));
}

/**
 * To samo o jeden poziom niżej — które WARIANTY wyboru są dostępne.
 *
 * Silestone: wykończenie Suede albo Volcano robią tylko przy części
 * kolorów (Volcano przy trzech z pięćdziesięciu). Opcja „wykończenie"
 * jest więc zawsze, ale jej warianty już nie — i klient nie ma prawa
 * zobaczyć przycisku, którego nie da się zamówić.
 *
 * Wariant bez `tylkoDekory` jest dostępny zawsze, więc wszystkie
 * dotychczasowe cenniki zachowują się dokładnie jak wcześniej.
 */
export function wariantyDostepne(opcja, dekor) {
  return (opcja?.warianty || []).filter((w) => opcjaDostepna(w, dekor));
}

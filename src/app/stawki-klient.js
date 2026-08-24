/**
 * POBRANIE STAWEK Z PANELU I NAŁOŻENIE ICH NA FIRMY
 *
 * Osobny plik od app/ustawienia.js, bo tamten jest CZYSTY (żadnego DOM-u,
 * żadnego import.meta.glob) i dzięki temu testuje się w gołym node.
 * Tutaj mieszka jedyna nieczysta część: sieć i lista firm.
 *
 * Wołane raz, przy starcie strony. Zwraca obietnicę, na którą czeka tylko
 * tryb właściciela — u klienta rozmowa trwa dłużej niż to zapytanie,
 * a gdyby worker milczał, kalkulator liczy stawkami domyślnymi.
 */
import { FIRMY } from '../firms/index.js';
import { pobierzUstawienia } from '../api.js';
import { DOMYSLNE, zastosujUstawienia } from './ustawienia.js';

let obietnica = null;

export function gotoweStawki() {
  if (!obietnica) {
    obietnica = pobierzUstawienia()
      .then((zBazy) => zastosujUstawienia(FIRMY, zBazy))
      .catch(() => zastosujUstawienia(FIRMY, DOMYSLNE));
  }
  return obietnica;
}

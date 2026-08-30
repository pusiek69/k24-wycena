/**
 * WYPRZEDAŻ PŁYT — pobranie listy z workera i pamięć podręczna.
 *
 * Osobno od `wyprzedaz.js`, bo tamten moduł jest czysty (testuje się
 * w node). Tutaj siedzi wszystko, co dotyka sieci i adresu strony.
 *
 * PODGLĄD WŁAŚCICIELA: jeśli w adresie jest `#wyprzedazPodglad=…`
 * z ważnym podpisem, worker dokłada do listy JEDEN wskazany szkic.
 * Reszta aplikacji nie wie, że coś jest inaczej — kategoria, karty płyt
 * i wycena renderują się tym samym kodem, co u klienta. O to chodzi:
 * podgląd, który idzie inną ścieżką, prędzej czy później zaczyna kłamać.
 */
import { API_BASE } from '../api.js';
import { paczkaPodgladu } from './wyprzedaz.js';

/**
 * Cache na czas życia strony. Kreator pyta o płyty w kilku miejscach
 * (lista materiałów, lista płyt, wycena) i każde z nich musi dostać
 * TĘ SAMĄ listę — inaczej klient mógłby wybrać płytę, której w wycenie
 * już nie ma.
 */
let pamiec = null;
let wPoczcie = null;

/** Płyty pobrane wcześniej — synchronicznie, dla kodu, który nie może czekać. */
export function zaladowane() {
  return pamiec || [];
}

/** Czy jesteśmy w trybie podglądu właściciela (do wstążki na stronie). */
export function czyPodglad() {
  return !!paczkaPodgladu(typeof location === 'undefined' ? '' : location.hash);
}

/**
 * Lista płyt wyprzedaży. Pobiera raz, potem oddaje z pamięci.
 * Przy błędzie sieci zwraca pustą listę — brak wyprzedaży nie może
 * wywalić kalkulatora, bo to dodatek, a nie rdzeń aplikacji.
 */
export async function pobierzPlyty() {
  if (pamiec) return pamiec;
  if (wPoczcie) return wPoczcie;

  const podglad = paczkaPodgladu(typeof location === 'undefined' ? '' : location.hash);

  wPoczcie = (async () => {
    try {
      const odp = await fetch(`${API_BASE}/wyprzedaz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(podglad || {}),
      });
      const d = await odp.json();
      pamiec = Array.isArray(d?.plyty) ? d.plyty : [];
    } catch {
      pamiec = [];
    } finally {
      wPoczcie = null;
    }
    return pamiec;
  })();

  return wPoczcie;
}

/** Tylko do testów i podglądu — wyrzuca pamięć podręczną. */
export function zapomnij() {
  pamiec = null;
  wPoczcie = null;
}

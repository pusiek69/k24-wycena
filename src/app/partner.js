/**
 * KOD PARTNERSKI W PRZEGLĄDARCE KLIENTA (program partnerski, 26.10.2026).
 *
 * Partner wysyła klienta linkiem kam24h.pl/?p=KOD (albo /p/KOD, które
 * Netlify przepisuje na ?p=). Kod zapisujemy w localStorage z DATĄ WEJŚCIA
 * i doklejamy do zgłoszenia — a czy jeszcze przypisuje, decyduje SERWER
 * wg konfiguracji z panelu (domyślnie 365 dni). Dzięki temu zmiana okresu
 * w panelu działa od ręki, także dla kodów zapisanych wcześniej.
 *
 * Zasady (decyzje Dawida):
 *  • PIERWSZY kod wygrywa — kolejny partner nie podbiera klienta; ustępuje
 *    dopiero wpis ewidentnie martwy (>400 dni, ponad maksymalny sensowny
 *    okres przypisania),
 *  • zapis NIEZALEŻNY od zgody marketingowej — to identyfikator POLECAJĄCEGO
 *    do rozliczenia B2B z partnerem, nie profilowanie klienta; nie trafia
 *    do GA ani nigdzie poza zgłoszeniem do naszego workera,
 *  • klient płaci dokładnie tyle, ile pokazuje kalkulator — kod niczego
 *    nie zmienia w cenie ani w rozmowie.
 *
 * Argumenty wstrzykiwane (storage/teraz/search), żeby reguły dało się
 * przetestować w gołym node — scripts/test-partnerzy.mjs.
 */

const KLUCZ = 'k24h-partner';
/** Powyżej tego wieku wpis jest martwy niezależnie od konfiguracji. */
const MAKS_WIEK_MS = 400 * 86400000;
const WZOR_KODU = /^[a-z0-9-]{3,24}$/;

function odczytaj(storage) {
  try {
    const wpis = JSON.parse(storage.getItem(KLUCZ) || 'null');
    if (wpis && WZOR_KODU.test(String(wpis.kod)) && Number(wpis.od) > 0)
      return { kod: String(wpis.kod), od: Number(wpis.od) };
  } catch {
    /* zepsuty wpis = brak wpisu */
  }
  return null;
}

/** Wołane raz przy starcie strony (obok zapamietajZrodlo). */
export function zapamietajPartnera({
  search = typeof location !== 'undefined' ? location.search : '',
  storage = typeof localStorage !== 'undefined' ? localStorage : null,
  teraz = Date.now(),
} = {}) {
  if (!storage) return;
  try {
    const kod = new URLSearchParams(search).get('p');
    if (!kod || !WZOR_KODU.test(kod)) return;
    const stary = odczytaj(storage);
    if (stary && teraz - stary.od <= MAKS_WIEK_MS) return; // pierwszy wygrywa
    storage.setItem(KLUCZ, JSON.stringify({ kod, od: teraz }));
  } catch {
    /* prywatne okno bez storage — przypisanie po prostu nie zadziała */
  }
}

/** Co dokleić do zgłoszenia — {kod, od} albo null. Ważność liczy worker. */
export function partnerDoLeada({
  storage = typeof localStorage !== 'undefined' ? localStorage : null,
  teraz = Date.now(),
} = {}) {
  if (!storage) return null;
  const wpis = odczytaj(storage);
  if (!wpis) return null;
  if (teraz - wpis.od > MAKS_WIEK_MS) {
    try {
      storage.removeItem(KLUCZ);
    } catch {
      /* trudno */
    }
    return null;
  }
  return wpis;
}

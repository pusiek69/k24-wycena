/**
 * PAMIĘĆ KLIENTA — kto już raz zostawił kontakt, nie wypełnia formularza drugi raz.
 *
 * Zlecenie Dawida (23.11.2026): „chcialbym ze jesli klient juz raz wpisze
 * swoje dane to nuz system go pamieta i nie musi ponownie wypełnić
 * formularze zeby znac ceny".
 *
 * Jak to działa:
 *   • po udanym wysłaniu zgłoszenia zapisujemy kontakt W TEJ PRZEGLĄDARCE
 *     na 90 dni (localStorage, nic więcej),
 *   • przy kolejnej wizycie albo zmianie konfiguracji ceny są widoczne
 *     od razu — bramka już spełniła swoje zadanie,
 *   • gdyby klient chciał wysłać kolejne zapytanie, pola są wstępnie
 *     wypełnione i da się je poprawić.
 *
 * ⚠ Dane nie opuszczają przeglądarki inaczej niż zwykłym zgłoszeniem,
 *   które klient sam wysyła. Nic tu nie leci do żadnej analityki.
 *
 * Każdy dostęp do `localStorage` jest w try/catch: w trybie prywatnym
 * albo przy zablokowanych danych stron odczyt i zapis rzucają wyjątkiem,
 * a kalkulator ma wtedy działać po staremu (z formularzem), nie wywalić się.
 */

const KLUCZ = 'k24h-umywalka-klient';
const DNI = 90;
const MS_DNIA = 24 * 60 * 60 * 1000;

/** Tylko to, co klient sam wpisał w formularzu — nic ponadto. */
function doZapisu(dane) {
  return {
    name: String(dane.name || '').slice(0, 80),
    phone: String(dane.phone || '').slice(0, 30),
    email: String(dane.email || '').slice(0, 120),
    city: String(dane.city || '').slice(0, 80),
    termin: String(dane.termin || '').slice(0, 40),
    telefonZgoda: String(dane.telefonZgoda || '').slice(0, 10),
  };
}

/**
 * Zapis po udanym zgłoszeniu.
 * @returns {boolean} czy się udało (fałsz = tryb prywatny albo brak miejsca)
 */
export function zapamietajKlienta(dane) {
  if (!dane?.phone && !dane?.email) return false;
  try {
    localStorage.setItem(
      KLUCZ,
      JSON.stringify({ kiedy: Date.now(), dane: doZapisu(dane) })
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Zapamiętany klient albo `null`.
 * Wpis starszy niż 90 dni kasujemy przy odczycie — nie trzymamy danych
 * dłużej, niż są do czegoś potrzebne.
 */
export function zapamietanyKlient() {
  try {
    const surowe = localStorage.getItem(KLUCZ);
    if (!surowe) return null;

    const wpis = JSON.parse(surowe);
    const kiedy = Number(wpis?.kiedy) || 0;
    if (!kiedy || Date.now() - kiedy > DNI * MS_DNIA) {
      zapomnijKlienta();
      return null;
    }
    const d = wpis.dane || {};
    if (!d.phone && !d.email) return null;
    return { ...d, kiedy };
  } catch {
    return null;
  }
}

/** Ręczne wyczyszczenie — „to nie ja" na karcie powitalnej. */
export function zapomnijKlienta() {
  try {
    localStorage.removeItem(KLUCZ);
  } catch {
    /* tryb prywatny — nie ma czego czyścić */
  }
}

/** Czy klient zostawił już kontakt (czyli: czy pokazujemy ceny od razu). */
export const znanyKlient = () => zapamietanyKlient() !== null;

/** „Anna" albo pusty string — do powitania na karcie ceny. */
export function imieKlienta() {
  const k = zapamietanyKlient();
  return k?.name?.trim() || '';
}

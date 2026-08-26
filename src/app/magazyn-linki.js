/**
 * ADRESY DO STANU MAGAZYNOWEGO INTERSTONE — strona klienta.
 *
 * Kamienia naturalnego nie wybiera się z listy wzorów: klient ogląda
 * konkretne płyty w magazynie i podaje nam kod tej, która mu się podoba.
 * Żeby w ogóle wiedział, DOKĄD iść, kreator musi umieć zbudować adres
 * od razu — zanim cokolwiek odpytamy. Stąd te stałe tutaj, a nie w Workerze.
 *
 * ⚠ Numery grup są przepisane z worker/magazyn.js (GRUPY) i muszą się z nimi
 * zgadzać. Tamten plik pozostaje źródłem prawdy — tu jest tylko wycinek
 * potrzebny klientowi: trzy rodzaje kamienia naturalnego.
 *
 * Filtr grupy jest istotny, a nie kosmetyczny: bez niego magazyn pokazuje
 * wszystko naraz — spieki i konglomeraty na pierwszej stronie, kamień
 * naturalny gdzieś dalej.
 */
import { rozlozKodPlyty } from './plyta-kod.js';

const ADRES = 'https://www.interstone.pl/stan-magazynowy';

/** Rodzaje kamienia naturalnego, w kolejności popularności u klientów. */
export const RODZAJE_KAMIENIA = [
  { id: 'granit', nazwa: 'Granit', grupa: 512, opis: 'Twardy, odporny na gorąco i zarysowania.' },
  { id: 'marmur', nazwa: 'Marmur', grupa: 511, opis: 'Efektowne żyłkowanie, wymaga impregnacji.' },
  { id: 'kwarcyt', nazwa: 'Kwarcyt', grupa: 521, opis: 'Wygląd marmuru, twardość bliższa granitowi.' },
];

/**
 * Adres stanu magazynowego — opcjonalnie zawężony do jednej grupy
 * i do jednej nazwy. Zawsze z filtrem dostępności, żeby klient nie trafiał
 * na płyty, których już nie ma.
 */
export function linkMagazynu({ grupa, fraza } = {}) {
  const u = new URL(ADRES);
  u.searchParams.set('custp', '1');
  u.searchParams.set('type', 'inventory');
  u.searchParams.set('sort', 'name-asc');
  u.searchParams.set('inventory-status', '122');
  if (fraza) u.searchParams.set('search', String(fraza).slice(0, 40));
  if (grupa) u.searchParams.set('inventory-group', String(grupa));
  return u.toString();
}

/** Adres dla rodzaju kamienia po jego identyfikatorze („granit"). */
export function linkRodzaju(id) {
  const r = RODZAJE_KAMIENIA.find((x) => x.id === id);
  return linkMagazynu(r ? { grupa: r.grupa } : {});
}

/* ═══════════════════ LINK DO KONKRETNEJ PŁYTY (tylko dla Dawida) ═══════════
 *
 * Zlecenie Dawida (26.08.2026): „ciężko mi ją znaleźć na magazynie".
 * Wszędzie, gdzie widzi kod płyty, ma być klik prowadzący do TEJ płyty.
 *
 * KARTY PŁYTY NIE DA SIĘ ZLINKOWAĆ WPROST. Interstone nie renderuje jej
 * jako osobnej strony — karta siedzi w atrybucie `data-content` kafelka
 * i otwiera się panelem po kliknięciu. Nie ma więc żadnego adresu, który
 * dałoby się zapamiętać. Zostaje wyszukiwarka stanu magazynowego.
 *
 * SZUKAMY PO SAMYM NUMERZE PŁYTY, NIE PO PEŁNYM KODZIE. Sprawdzone na żywym
 * magazynie 26.08.2026 na 22 płytach (granit i marmur):
 *
 *   search=90659             → 1 płyta, właściwa          ✔ 22/22
 *   search=STON000510-90659  → 7 przypadkowych płyt       ✗
 *   search=STON000510        → 7 przypadkowych płyt       ✗
 *
 * Ta sama obserwacja stoi już w worker/worker.template.js przy narzędziu
 * konsultanta: pełny kod tokenizuje się inaczej i gubi trafienie.
 *
 * FILTRA GRUPY TU NIE MA — I NIE WOLNO GO DOKŁADAĆ. Dopisanie
 * `inventory-group` psuje wyszukiwanie po numerze i wraca ta sama siódemka
 * przypadkowych płyt, nawet gdy grupa jest właściwa.
 *
 * PUDŁO NIE DAJE PUSTEJ STRONY, tylko tę samą siódemkę losowych płyt.
 * Dlatego przy KAŻDYM linku pokazujemy obok pełny kod STON — Dawid ma po
 * czym poznać, że trafił na właściwą płytę, a nie na wynik zastępczy.
 */

/**
 * Sam numer płyty z kodu w dowolnym zapisie. „STON000510-90659" → „90659".
 *
 * Rozkład kodu bierzemy z plyta-kod.js, żeby nie było drugiej, własnej
 * interpretacji tego, co jest numerem płyty. Naiwne „ostatnie cyfry"
 * czytało sam numer bloku („STON000510") jako płytę 000510 i prowadziło
 * Dawida do przypadkowego wyniku.
 */
export function numerPlyty(kod) {
  const c = rozlozKodPlyty(kod);
  return c?.numer || '';
}

/**
 * Adres, pod którym Dawid zobaczy TĘ płytę — albo null, gdy z kodu nie da
 * się wyłuskać numeru. `null` jest tu celowe: lepiej nie pokazać linku niż
 * wysłać Dawida na losową listę.
 */
export function linkPlyty(kod) {
  const numer = numerPlyty(kod);
  if (!numer) return null;
  const u = new URL(ADRES);
  u.searchParams.set('custp', '1');
  u.searchParams.set('type', 'inventory');
  u.searchParams.set('sort', 'name-asc');
  u.searchParams.set('search', numer);
  return u.toString();
}

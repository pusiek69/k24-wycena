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

/**
 * WARIANTY MATERIAŁOWE — „ta sama kuchnia, inny kamień".
 *
 * Zlecenie Dawida (25.08.2026): „chciałbym móc klientowi wysłać np. jedną
 * tę główną i 3x takie do porównania cen (wybieranie ręczne tylko na
 * podstawie materiałów)".
 *
 * Wariant to TEN SAM blat — te same odcinki, otwory, montaż — policzony
 * na innym materiale. Dobiera je Dawid ręcznie, nie automat: to on wie,
 * co danemu klientowi pokazać obok siebie.
 *
 * Ten moduł jest czysty (bez DOM i bez sieci), żeby regułę pieniędzy dało
 * się przetestować w gołym node. Samo liczenie robi ten sam silnik co
 * przy ofercie głównej — tutaj rozstrzygamy wyłącznie, co się dzieje
 * z upustem.
 */

/** Ilu wariantów Dawid może dołożyć obok głównej oferty. */
export const MAKS_WARIANTOW = 3;

/** Tryby upustu w wariancie. `dziedziczy` jest domyślny — patrz niżej. */
export const TRYBY_UPUSTU = [
  ['dziedziczy', 'jak w ofercie głównej'],
  ['brak', 'bez upustu (cena regularna)'],
  ['wlasny', 'własny upust %'],
];

/**
 * Jaki procent upustu Dawid dał na ofercie głównej.
 *
 * Liczymy go z KWOT, a nie z ustawionego mechanizmu, bo mechanizmy są
 * trzy (procent, kwota, nadpisanie ceny) i tylko procent przenosi się
 * sensownie na inny materiał. Kwota „−500 zł" przy tańszym kamieniu
 * znaczy zupełnie co innego niż przy droższym, a nadpisana cena końcowa
 * nie znaczy nic. Sprowadzenie wszystkiego do procentu sprawia, że
 * klient porównuje materiały, a nie przypadkowe rabaty.
 *
 * @returns {number} 0 = bez upustu, 0.08 = osiem procent taniej
 */
export function upustGlownej({ razem, razemPrzed }) {
  const przed = Number(razemPrzed) || 0;
  const po = Number(razem) || 0;
  if (!(przed > 0) || !(po > 0) || po >= przed) return 0;
  return (przed - po) / przed;
}

/**
 * Cena wariantu po nałożeniu upustu.
 *
 * @param {number} bazowa   cena wariantu prosto z silnika
 * @param {object} wariant  { upustTyp, upustProc }
 * @param {number} upustGl  upust oferty głównej (0–1) z `upustGlownej`
 */
export function cenaWariantu(bazowa, wariant = {}, upustGl = 0) {
  const cena = Number(bazowa) || 0;
  if (!(cena > 0)) return 0;

  const proc = wspolczynnik(wariant, upustGl);
  return Math.round(cena * (1 - proc));
}

/** Ile procent upustu realnie zejdzie z wariantu (0–1). */
export function wspolczynnik(wariant = {}, upustGl = 0) {
  if (wariant.upustTyp === 'brak') return 0;
  if (wariant.upustTyp === 'wlasny') {
    const p = Number(wariant.upustProc) || 0;
    // Bez ujemnych („podwyżek") i bez oddawania towaru za darmo.
    return Math.min(Math.max(p, 0), 90) / 100;
  }
  return Math.min(Math.max(Number(upustGl) || 0, 0), 0.9);
}

/**
 * Opis upustu wariantu dla Dawida — jedno zdanie w edytorze, żeby widział,
 * co właściwie wyśle, bez liczenia w pamięci.
 */
export function opisUpustu(wariant = {}, upustGl = 0) {
  const p = wspolczynnik(wariant, upustGl);
  if (!(p > 0)) return 'cena regularna';
  const proc = (p * 100).toFixed(p * 100 % 1 === 0 ? 0 : 1).replace('.', ',');
  return wariant.upustTyp === 'wlasny' ? `upust ${proc}%` : `upust ${proc}% (jak w głównej)`;
}

/**
 * Zamrożony wariant — dokładnie to, co zobaczy klient.
 *
 * Świadomie NIE ma tu pozycji ani cen jednostkowych: wariant to porównanie
 * cen, nie druga wycena. Klient dostaje materiał, jednozdaniowy opis
 * i kwotę łączną. Rozrys też nie — jest tylko dla oferty głównej.
 */
export function zamrozWariant({ opis, material, typ, razem, razemPrzed, stawkaVat }) {
  return {
    opis: String(opis || ''),
    material: String(material || ''),
    typ: String(typ || ''),
    razem: Math.round(Number(razem) || 0),
    // `razemPrzed` niesiemy tylko wtedy, gdy naprawdę jest co przekreślić.
    razemPrzed: Number(razemPrzed) > Number(razem) ? Math.round(Number(razemPrzed)) : null,
    stawkaVat: Number(stawkaVat) || 0.08,
  };
}

/**
 * Różnica ceny wariantu względem oferty głównej — to jest ta jedna liczba,
 * dla której klient w ogóle patrzy na tabelkę.
 *
 * @returns {{ znak: '+'|'-'|'=', kwota: number, opis: string }}
 */
export function roznica(wariantRazem, glownaRazem) {
  const d = Math.round((Number(wariantRazem) || 0) - (Number(glownaRazem) || 0));
  if (d === 0) return { znak: '=', kwota: 0, opis: 'tyle samo' };
  return d > 0
    ? { znak: '+', kwota: d, opis: `droższy o ${grosze(d)}` }
    : { znak: '-', kwota: -d, opis: `tańszy o ${grosze(-d)}` };
}

/** Kwota po polsku, bez zależności od ustawień środowiska. */
const grosze = (n) =>
  String(Math.round(Math.abs(Number(n) || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' zł';

/**
 * Porządkuje warianty do pokazania klientowi: od najtańszego.
 * Kolejność z edytora jest przypadkowa (Dawid dokłada je, jak mu przyjdzie
 * do głowy), a klient czyta cenniki od dołu.
 */
export function poCenie(warianty) {
  return [...(warianty || [])].sort((a, b) => (a.razem || 0) - (b.razem || 0));
}

/**
 * PŁYTA WŁASNA — materiał spoza cenników.
 *
 * Zlecenie Dawida (25.08.2026): „chciałbym też mieć możliwość dodać płyty
 * ręcznie — wymiar, cenę i nazwę i ewentualny nr płyty — jak robię
 * klientowi wycenę".
 *
 * Dawid dostaje płytę z hurtowni albo z resztek i chce ją wycenić od ręki,
 * bez czekania, aż dopiszemy cały cennik. Taka płyta ma działać jak każdy
 * inny materiał: silnik liczy PEŁNYMI płytami z podanego wymiaru, rozrys
 * bierze ten sam wymiar, a klient widzi nazwę (i numer płyty, jeśli był).
 *
 * Moduł jest czysty — bez DOM-u i bez sieci — żeby przeliczenia dały się
 * sprawdzić w gołym node. Samą wycenę robi ten sam silnik co przy płycie
 * z magazynu (`wycenWlasciciela`), więc obróbki, montaż i VAT liczą się
 * identycznie jak wszędzie.
 */

/** Jak podana jest cena. Obie formy zdarzają się w hurtowniach. */
export const JEDNOSTKI = [
  ['m2', 'za m² płyty'],
  ['plyta', 'za całą płytę'],
];

/** Czy podana kwota zawiera VAT. */
export const FORMY_CENY = [
  ['brutto', 'brutto (z VAT 23%)'],
  ['netto', 'netto (bez VAT)'],
];

/** VAT, po którym przeliczamy cenę materiału — towar, nie usługa. */
export const VAT_MATERIALU = 0.23;

/** Domyślny stan formularza. Wymiar jak typowa płyta konglomeratu. */
export const PUSTA = {
  nazwa: '',
  nrPlyty: '',
  szer: 3200,
  wys: 1600,
  cena: 0,
  jednostka: 'm2',
  forma: 'brutto',
};

/** Powierzchnia płyty w m². */
export function poleM2({ szer, wys }) {
  const w = Number(szer) || 0;
  const h = Number(wys) || 0;
  return w > 0 && h > 0 ? (w * h) / 1e6 : 0;
}

/**
 * Cena BRUTTO za m² — jedyna postać, jakiej potrzebuje silnik
 * (`wariantReczny.cenaBruttoM2`).
 *
 * Sprowadzamy tu obie osie naraz: „za całą płytę" dzielimy przez metraż,
 * a netto podnosimy o VAT. Dzięki temu Dawid wpisuje kwotę tak, jak ma ją
 * na fakturze, i nie musi niczego przeliczać w pamięci.
 */
export function cenaBruttoM2(plyta) {
  const kwota = Number(plyta?.cena) || 0;
  if (!(kwota > 0)) return 0;

  const zaM2 =
    plyta.jednostka === 'plyta' ? (poleM2(plyta) > 0 ? kwota / poleM2(plyta) : 0) : kwota;

  const brutto = plyta.forma === 'netto' ? zaM2 * (1 + VAT_MATERIALU) : zaM2;
  // Do groszy: dzielenie przez metraż potrafi dać 1000.0000000000001,
  // a cena za m² z trzynastoma miejscami po przecinku nic nie znaczy.
  return Math.round(brutto * 100) / 100;
}

/** Ta sama kwota netto — do pokazania obok, żeby nie było wątpliwości. */
export const cenaNettoM2 = (plyta) => cenaBruttoM2(plyta) / (1 + VAT_MATERIALU);

/**
 * Czy da się z tego policzyć wycenę. Zwraca `null`, gdy komplet jest,
 * albo zdanie po polsku — trafia wprost pod formularz.
 */
export function czegoBrakuje(plyta) {
  if (!String(plyta?.nazwa || '').trim()) return 'Podaj nazwę materiału.';
  if (!(poleM2(plyta) > 0)) return 'Podaj wymiar płyty (szerokość i wysokość w mm).';
  if (!(cenaBruttoM2(plyta) > 0)) return 'Podaj cenę płyty.';
  return null;
}

/**
 * Opis materiału dla klienta: nazwa i — jeśli Dawid go wpisał — numer
 * płyty. Numer bywa jedynym sposobem, żeby dogadać się, o którą sztukę
 * chodzi, więc pokazujemy go wprost.
 */
export function opisDlaKlienta(plyta) {
  const nazwa = String(plyta?.nazwa || '').trim();
  const nr = String(plyta?.nrPlyty || '').trim();
  return nr ? `${nazwa} (płyta nr ${nr})` : nazwa;
}

/**
 * Kształt przyjmowany przez `wariantReczny` z app/wycena-naturalny.js.
 *
 * `rodzaj` NIE zawiera słowa „kamień" — i to jest tu istotne: po tym
 * silnik rozpoznaje kamień naturalny i dolicza mu dodatek za trudność
 * obróbki oraz większy odpad. Płyta własna ma się liczyć jak zwykły
 * materiał płytowy.
 */
export function doWariantu(plyta, grubosc) {
  return {
    nazwa: opisDlaKlienta(plyta),
    kod: String(plyta?.nrPlyty || '').trim(),
    cenaBruttoM2: cenaBruttoM2(plyta),
    // Silnik operuje na centymetrach, Dawid podaje milimetry.
    plytaCm: { dl: (Number(plyta?.szer) || 0) / 10, gl: (Number(plyta?.wys) || 0) / 10 },
    gruboscMm: Number(grubosc) || 20,
  };
}

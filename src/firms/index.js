/**
 * REJESTR FIRM — zbiera się sam.
 *
 * Każdy plik `src/firms/<slug>.js` z eksportem domyślnym staje się firmą
 * w kreatorze. Nie ma tu żadnej listy do ręcznego dopisywania — żeby dodać
 * firmę, wystarczy wrzucić plik obok (i ewentualnie wygenerować cennik).
 *
 * Pliki zaczynające się od „_" są pomijane (to nie firmy, tylko wspólne stawki).
 */
const moduly = import.meta.glob('./*.js', { eager: true });

export const FIRMY = Object.entries(moduly)
  .filter(([sciezka]) => {
    const nazwa = sciezka.split('/').pop();
    return nazwa !== 'index.js' && !nazwa.startsWith('_');
  })
  .map(([, mod]) => mod.default)
  .filter((f) => f && f.aktywna !== false)
  .sort((a, b) => (a.kolejnosc ?? 99) - (b.kolejnosc ?? 99));

export function firmaWgSlug(slug) {
  return FIRMY.find((f) => f.slug === slug) || null;
}

/**
 * Wpis cennika bywa liczbą albo obiektem {cena, plyta} — ta druga postać
 * pozwala przypisać pozycji własny format płyty. Wszędzie, gdzie potrzebna
 * jest sama cena, przechodzimy przez tę funkcję.
 */
export function cenaWpisu(wpis) {
  return typeof wpis === 'number' ? wpis : wpis?.cena ?? null;
}

/** Grubości dostępne dla danego dekoru (z pominięciem tych nieblatowych). */
export function grubosciDekoru(firma, dekor) {
  const wpis = firma.dekory?.[dekor];
  if (!wpis) return [];
  return Object.keys(wpis)
    .filter((g) => !(firma.pomijGrubosci || []).includes(g))
    .sort((a, b) => Number(a) - Number(b));
}

/**
 * Grubość przyjmowana, gdy klient sam jej nie wskazał.
 * Spiek i gres liczymy od 12 mm, konglomeraty od 20 mm — stąd pole
 * `gruboscDomyslna` w pliku firmy, a nie zgadywanie po nazwie.
 */
export function gruboscDomyslna(firma, dekor) {
  const dostepne = grubosciDekoru(firma, dekor);
  if (!dostepne.length) return '20';
  const chciana = String(firma.gruboscDomyslna || '');
  if (dostepne.includes(chciana)) return chciana;
  return dostepne.includes('20') ? '20' : dostepne[0];
}

/** Najniższa cena m² w firmie — do etykiety „od … zł/m²" na karcie wyboru. */
export function odCenyM2(firma) {
  let min = Infinity;
  for (const wpis of Object.values(firma.dekory || {})) {
    for (const [gr, pozycja] of Object.entries(wpis)) {
      if ((firma.pomijGrubosci || []).includes(gr)) continue;
      const cena = cenaWpisu(pozycja);
      if (cena != null && cena < min) min = cena;
    }
  }
  // Kwota od m2 dotyczy blatu z montażem, czyli stawki 8%.
  return Number.isFinite(min) ? min * (1 + (firma.vatMontaz ?? 0.08)) : null;
}

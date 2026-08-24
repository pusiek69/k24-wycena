/**
 * ROZBICIE CENY DLA KLIENTA — trzy linijki, nie lista pozycji.
 *
 * Decyzja Dawida (21.08.2026): klient ma widzieć CENĘ MATERIAŁU, CENĘ PRAC
 * KAMIENIARSKICH i podsumowanie — koniec. Wcześniej pod drugą kwotą stała
 * lista „w tej cenie": pomiar Prolinerem, wycięcie pod zlew, otwory, montaż.
 * Każda taka pozycja zapraszała do wycinania jej z oferty („a bez pomiaru
 * ile?"), zamiast rozmawiać o wartości całości.
 *
 * Pełne rozbicie zostaje tam, gdzie jest potrzebne: w mailu firmowym
 * i w edytorze właściciela (tam Dawid ustawia gratisy i widzi każdą kwotę).
 *
 * Moduł jest czysty — bez DOM-u i bez importu firm — żeby ta sama funkcja
 * liczyła w przeglądarce i w testach.
 */

export const ETYKIETA_MATERIALU = 'Materiał';
export const ETYKIETA_PRAC = 'Prace kamieniarskie';

/**
 * Opis prac bez wymieniania pojedynczych czynności. Zależy od wariantu,
 * bo przy odbiorze własnym nie ma ani pomiaru, ani montażu — obiecywanie
 * ich w opisie byłoby nieprawdą.
 */
export const opisPrac = (odbiorWlasny) =>
  odbiorWlasny
    ? 'Docięcie, obróbka krawędzi, wycięcia i przygotowanie do odbioru.'
    : 'Docięcie, obróbka krawędzi, wycięcia, transport i montaż u klienta.';

/**
 * Pozycje wyceny → to, co widzi klient.
 *
 * @param {Array} pozycje  pozycje z silnika albo z zamrożonej oferty
 * @param {object} opcje   { odbiorWlasny }
 * @returns {{material:number, prace:number, razem:number, gratisy:string[],
 *            materialOpis:string, doUstalenia:boolean}}
 */
export function rozbicieDlaKlienta(pozycje, { odbiorWlasny = false } = {}) {
  const lista = Array.isArray(pozycje) ? pozycje : [];
  // Zamrożona oferta nie ma pola `grupa` — tam materiał jest pierwszy
  // i rozpoznaje się po nazwie kolekcji. Rozróżniamy oba kształty.
  const jestMaterial = (p, i) => (p.grupa ? p.grupa === 'materiał' : i === 0);

  const material = lista.filter((p, i) => jestMaterial(p, i));
  const prace = lista.filter((p, i) => !jestMaterial(p, i));
  const suma = (x) => x.reduce((a, p) => a + (Number(p.brutto) || 0), 0);

  return {
    material: suma(material),
    prace: suma(prace),
    razem: suma(lista),
    // Co Dawid dał gratis — to jedyna nazwa czynności, jaka zostaje
    // na oczach klienta, bo to argument, a nie pozycja do wycięcia.
    gratisy: prace.filter((p) => p.gratis).map((p) => p.nazwa),
    materialOpis: material.map((p) => p.detal).filter(Boolean).join(' · '),
    doUstalenia: material.some((p) => p.materialDoUstalenia),
  };
}

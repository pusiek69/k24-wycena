/**
 * KRÓTKA LISTA KAMIENI DO UMYWALKI — dwanaście zamiast stu dwunastu.
 *
 * Katalog Keralini (48 wzorów) i Avant Quartz (64) razem to 112 pozycji.
 * Klient, który pierwszy raz wszedł na stronę, nie wybiera z takiej listy —
 * on się z niej wycofuje. Dlatego pokazujemy dwanaście, a pełny katalog
 * siedzi pod „Pokaż wszystkie".
 *
 * ⚠ Ta lista jest DO PODMIANY PRZEZ DAWIDA — jedna linijka na kamień.
 * Nie ma tu żadnej ceny: ceny są w katalogu (`src/generated/*.dekory.json`)
 * i liczy je silnik. Tutaj jest tylko to, czego katalog nie wie: jak dany
 * wzór wygląda i w którym filtrze ma się pokazać.
 *
 * `probka` to PRZYBLIŻENIE koloru do kropki na kafelku i do bryły —
 * nie jest to wzorzec kolorystyczny producenta. Prawdziwy wzór klient
 * zobaczy na próbce w zakładzie i na projekcie 3D.
 *
 * Tylko marki z dystrybucji Architype (Keralini, Avant Quartz): one jedne
 * pozwalają kupić POŁOWĘ płyty, a to przy umywalce decyduje o cenie.
 */

/**
 * RODZINY FAKTUR — parametry do proceduralnej tekstury kamienia w podglądzie 3D.
 *
 * Tekstura rysuje się w przeglądarce na canvasie (ziarno + żyły), więc nie
 * ładujemy ani jednego zdjęcia. To oczywiście PRZYBLIŻENIE charakteru, a nie
 * wzór producenta — prawdziwą płytę klient zobaczy na próbce i na projekcie 3D.
 *
 * `sp` to kolory ziarna, `vein` kolor żyły, `veins` ile żył, `vw` ich grubość,
 * `dense` zagęszcza ziarno (granit, struktury).
 */
export const FAKTURY = {
  gladki: { sp: ['#d6d4ce', '#fbfbf9', '#c7c4bd'], vein: '#b5b2aa', veins: 0, vw: 1 },
  ziarno: { sp: ['#b6b0a7', '#dad6cf', '#a39d94'], vein: '#968f85', veins: 1, vw: 1, dense: 1 },
  zyla: { sp: ['#e3e1dd', '#f6f5f2'], vein: '#8a8e94', veins: 6, vw: 1.7 },
  zylaZlota: { sp: ['#e8e2d4', '#f7f3e9'], vein: '#a3906f', veins: 5, vw: 2.1 },
  ciemny: { sp: ['#717479', '#2a2c2e', '#a6a9ae'], vein: '#15161a', veins: 2, vw: 1.2, dense: 1 },
};

/** Parametry faktury dla wzoru — razem z jego kolorem bazowym. */
export function fakturaDekoru(marka, dekor, tagKoloru) {
  const znany = POLECANE.find((p) => p.marka === marka && p.dekor === dekor);
  const rodzina = znany?.faktura || domyslnaFaktura(dekor, tagKoloru);
  return { base: probkaDekoru(marka, dekor, tagKoloru), ...FAKTURY[rodzina] };
}

function domyslnaFaktura(dekor, tagKoloru) {
  const nazwa = String(dekor || '').toLowerCase();
  if (/calacatta|statuario|arabescato|portoro|marquina/.test(nazwa)) return 'zyla';
  if (/travertino|travertine|beige|crema|dorato|oro/.test(nazwa)) return 'zylaZlota';
  if (tagKoloru === 'antracyt' || tagKoloru === 'szary' || tagKoloru === 'beton') return 'ciemny';
  return 'gladki';
}

/** Filtry nad listą — trzy pigułki, nie dziewięć kolorów. */
export const ODCIENIE = [
  { id: 'jasne', nazwa: 'Jasne' },
  { id: 'zyla', nazwa: 'Z żyłą' },
  { id: 'ciemne', nazwa: 'Ciemne' },
];

export const POLECANE = [
  // Avant Quartz — konglomerat kwarcowy, 20 mm.
  { marka: 'avant-quartz', dekor: 'Chantilly', grubosc: '20', odcien: 'jasne', probka: '#eceae4', faktura: 'gladki' },
  { marka: 'avant-quartz', dekor: 'Clermont', grubosc: '20', odcien: 'jasne', probka: '#e3ded4', faktura: 'gladki' },
  { marka: 'avant-quartz', dekor: 'White Quartz', grubosc: '20', odcien: 'jasne', probka: '#f1efe9', faktura: 'ziarno' },
  { marka: 'avant-quartz', dekor: 'Blanche', grubosc: '20', odcien: 'jasne', probka: '#f4f2ec', faktura: 'gladki' },
  { marka: 'avant-quartz', dekor: 'Calacatta Bianco', grubosc: '20', odcien: 'zyla', probka: '#eeeae1', faktura: 'zyla' },
  { marka: 'avant-quartz', dekor: 'Gris Fonce', grubosc: '20', odcien: 'ciemne', probka: '#4a4a4c', faktura: 'ciemny' },

  // Keralini — spiek kwarcowy, 12 mm (cieńszy, chłodniejszy w dotyku).
  { marka: 'keralini', dekor: 'Absolute White Structured', grubosc: '12', odcien: 'jasne', probka: '#efeeea', faktura: 'ziarno' },
  { marka: 'keralini', dekor: 'Travertino White Naturale', grubosc: '12', odcien: 'jasne', probka: '#e8e0d2', faktura: 'zylaZlota' },
  { marka: 'keralini', dekor: 'Statuario Leonardo Naturale', grubosc: '12', odcien: 'zyla', probka: '#e9e7e3', faktura: 'zyla' },
  { marka: 'keralini', dekor: 'Calacatta Oro Naturale', grubosc: '12', odcien: 'zyla', probka: '#eae3d3', faktura: 'zylaZlota' },
  { marka: 'keralini', dekor: 'Pietra Grigia Naturale', grubosc: '12', odcien: 'ciemne', probka: '#6f6c66', faktura: 'ciemny' },
  { marka: 'keralini', dekor: 'Absolute Black Structured', grubosc: '12', odcien: 'ciemne', probka: '#2b2a29', faktura: 'ciemny' },
];

/** Kamień, od którego startuje konfigurator. */
export const START = POLECANE.find((p) => p.marka === 'keralini' && p.odcien === 'jasne') || POLECANE[0];

/** Próbka koloru dla dowolnego wzoru — także z pełnego katalogu. */
export function probkaDekoru(marka, dekor, tagKoloru) {
  const znany = POLECANE.find((p) => p.marka === marka && p.dekor === dekor);
  if (znany) return znany.probka;

  // Poza krótką listą zgadujemy z tagu koloru, który liczy już kalkulator
  // blatów (`app/kolory-dekorow.js`) — jeden kolor na grupę.
  return (
    {
      biel: '#f1efe9',
      'biel-zyla': '#eae7e0',
      'krem-bez': '#e6ddcc',
      szary: '#8d8a84',
      antracyt: '#2f2e2d',
      beton: '#9a9892',
      drewno: '#a98258',
      kolor: '#8a7f9a',
    }[tagKoloru] || '#cfcac0'
  );
}

/** Czy wzór pasuje do wybranego filtra odcienia. */
export function wOdcieniu(pozycja, odcien) {
  if (!odcien) return true;
  return pozycja.odcien === odcien;
}

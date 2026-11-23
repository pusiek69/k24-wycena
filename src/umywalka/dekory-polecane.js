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

/** Filtry nad listą — trzy pigułki, nie dziewięć kolorów. */
export const ODCIENIE = [
  { id: 'jasne', nazwa: 'Jasne' },
  { id: 'zyla', nazwa: 'Z żyłą' },
  { id: 'ciemne', nazwa: 'Ciemne' },
];

export const POLECANE = [
  // Avant Quartz — konglomerat kwarcowy, 20 mm.
  { marka: 'avant-quartz', dekor: 'Chantilly', grubosc: '20', odcien: 'jasne', probka: '#eceae4' },
  { marka: 'avant-quartz', dekor: 'Clermont', grubosc: '20', odcien: 'jasne', probka: '#e3ded4' },
  { marka: 'avant-quartz', dekor: 'White Quartz', grubosc: '20', odcien: 'jasne', probka: '#f1efe9' },
  { marka: 'avant-quartz', dekor: 'Blanche', grubosc: '20', odcien: 'jasne', probka: '#f4f2ec' },
  { marka: 'avant-quartz', dekor: 'Calacatta Bianco', grubosc: '20', odcien: 'zyla', probka: '#eeeae1' },
  { marka: 'avant-quartz', dekor: 'Gris Fonce', grubosc: '20', odcien: 'ciemne', probka: '#4a4a4c' },

  // Keralini — spiek kwarcowy, 12 mm (cieńszy, chłodniejszy w dotyku).
  { marka: 'keralini', dekor: 'Absolute White Structured', grubosc: '12', odcien: 'jasne', probka: '#efeeea' },
  { marka: 'keralini', dekor: 'Travertino White Naturale', grubosc: '12', odcien: 'jasne', probka: '#e8e0d2' },
  { marka: 'keralini', dekor: 'Statuario Leonardo Naturale', grubosc: '12', odcien: 'zyla', probka: '#e9e7e3' },
  { marka: 'keralini', dekor: 'Calacatta Oro Naturale', grubosc: '12', odcien: 'zyla', probka: '#eae3d3' },
  { marka: 'keralini', dekor: 'Pietra Grigia Naturale', grubosc: '12', odcien: 'ciemne', probka: '#6f6c66' },
  { marka: 'keralini', dekor: 'Absolute Black Structured', grubosc: '12', odcien: 'ciemne', probka: '#2b2a29' },
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

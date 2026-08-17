/**
 * KOD KONKRETNEJ PŁYTY KAMIENIA NATURALNEGO
 *
 * Plik jest celowo czysty: żadnego DOM-u, żadnego importu firm. Dzięki temu
 * te same funkcje działają w przeglądarce i w testach na gołym node,
 * bez przechodzenia przez `import.meta.glob` Vite.
 *
 * Kamienia naturalnego nie wyceniamy „ogólnie" — każdy blok ma własną cenę,
 * wymiar i dostępność, a różnica między blokami tego samego wzoru sięga
 * kilkuset złotych za m². Dlatego wycena zaczyna się od wskazania płyty
 * (decyzja Dawida, 17.08.2026).
 */

/**
 * „STON000334 - 84224" → „STON000334-84224".
 *
 * Magazyn zapisuje kod ze spacjami wokół myślnika, klient przepisuje go bez
 * nich, czasem małymi literami albo z myślnikiem typograficznym. Kod poza
 * formatem zwraca pusty łańcuch — wtedy wycena się nie zaczyna.
 *
 * Ta sama zasada obowiązuje w worker/magazyn.js. Front ma własną kopię,
 * bo sprawdza format ZANIM ruszy do sieci: literówkę widać od razu.
 */
export function normalizujKodPlyty(kod) {
  const s = String(kod ?? '')
    .toUpperCase()
    .replace(/[‐-―−]/g, '-')
    // Każdy znak niebędący literą ani cyfrą to separator: spacja, podkreślnik,
    // ukośnik, kropka. Klient przepisuje kod ręcznie i robi to na swój sposób.
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  if (/^[A-Z]{2,6}\d{4,}-\d{3,}$/.test(s)) return s;

  // Zapis bez separatora („STON00062386421") — numer płyty to ostatnie 5 cyfr.
  const m = s.replace(/-/g, '').match(/^([A-Z]{2,6}\d{4,})(\d{5})$/);
  return m ? `${m[1]}-${m[2]}` : '';
}

/**
 * Surowa płyta z magazynu → wariant, jaki rozumie wycena.
 *
 * `/magazyn` oddaje dwie różne rzeczy: pogrupowane WARIANTY (mają `plytaCm`,
 * bo grupowanie wybiera największy format) i pojedyncze PŁYTY z kodami
 * (mają surowe `formatCm` prosto z parsera). Wskazanie konkretnej płyty
 * pracuje na tych drugich, więc trzeba je sprowadzić do wspólnego kształtu.
 *
 * Dłuższy bok ZAWSZE jako `dl` — po nim pakowanie liczy, czy odcinek zmieści
 * się bez łączenia. Pomylona orientacja to pomylona liczba płyt.
 */
export function wariantZPlyty(plyta) {
  if (!plyta?.formatCm) return null;
  const { wys, szer } = plyta.formatCm;
  if (!(wys > 0 && szer > 0)) return null;
  return {
    ...plyta,
    plytaCm: { dl: Math.max(wys, szer), gl: Math.min(wys, szer) },
  };
}

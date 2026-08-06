/**
 * DEKORY, KTÓRE ISTNIEJĄ TYLKO W PROMOCJI
 *
 * Kampanie dostawców czasem obejmują wzory, których nie ma w cenniku
 * podstawowym — bo są nowe albo w innym gatunku. Taki dekor musi dać się
 * wybrać w kreatorze, inaczej promocja jest niewidoczna dla klienta.
 *
 * Dopisujemy je do listy dekorów TYLKO na czas trwania kampanii:
 * po jej zakończeniu znikają, zamiast zostać z ceną promocyjną,
 * której już nie honorujemy.
 *
 * Dekory obecne w cenniku podstawowym zostają nietknięte — ich cenę
 * promocyjną podmienia silnik w `wycen()`, dzięki czemu widać oszczędność
 * względem ceny regularnej. Dekor wyłącznie promocyjny żadnej „ceny przed"
 * nie ma, więc pokazujemy samą plakietkę, bez wymyślonej przeceny.
 */
export function dekoryZKampaniami(dekory, kampanie, dataISO) {
  const dzis = dataISO || new Date().toISOString().slice(0, 10);
  const wynik = { ...dekory };

  for (const k of kampanie || []) {
    if (dzis < k.od || dzis > k.do) continue;

    for (const [klucz, wpis] of Object.entries(k.ceny || {})) {
      const rozdzielnik = klucz.lastIndexOf('||');
      if (rozdzielnik < 0) continue;
      const nazwa = klucz.slice(0, rozdzielnik);
      const grubosc = klucz.slice(rozdzielnik + 2);

      const cena = typeof wpis === 'number' ? wpis : wpis?.cena;
      if (!(cena > 0)) continue;

      // Jest w cenniku podstawowym — nic nie robimy, silnik sam podmieni cenę.
      if (wynik[nazwa]?.[grubosc] != null) continue;

      wynik[nazwa] = { ...(wynik[nazwa] || {}), [grubosc]: cena };
    }
  }

  return wynik;
}

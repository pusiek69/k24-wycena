/**
 * WŁASNE POZYCJE W OFERCIE — usługi i dodatki dopisywane ręcznie przez Dawida.
 *
 * Zlecenie Dawida (01.09.2026): w „Powtórz wycenę" chce móc dopisać własną
 * pozycję z nazwą, ceną i ilością — demontaż starego blatu, cokoły, dopłata
 * ekspresowa. Do tej pory takie rzeczy trzeba było chować w upuście albo
 * w nadpisanej kwocie, więc znikały z rozbicia i nie było po nich śladu.
 *
 * Moduł jest CZYSTY (bez DOM i bez zależności), żeby dał się przetestować
 * w gołym node — tak samo jak `wyprzedaz.js`. Rysowanie siedzi w edytorze.
 *
 * ⚠ CENA JEST BRUTTO. Dawid wpisuje kwotę, którą ma zobaczyć klient —
 * tak samo jak przy cenie płyty z wyprzedaży i przy ręcznej cenie kamienia
 * naturalnego. Nigdzie tego nie przeliczamy przez VAT: pozycje wchodzą do
 * sumy oferty, która też jest brutto.
 */

/** Nowy, pusty wiersz. Domyślnie praca — bo tak wygląda większość dodatków. */
export const PUSTA = { nazwa: '', cena: 0, ilosc: 1, grupa: 'usługi' };

/** Dozwolone grupy — te same nazwy, których używa silnik wyceny. */
export const GRUPY = [
  { id: 'usługi', nazwa: 'praca' },
  { id: 'materiał', nazwa: 'materiał' },
];

const liczba = (n) => {
  const x = Math.round((Number(n) || 0) * 100) / 100;
  return String(x).replace('.', ',');
};

/** Kwota wiersza: cena × ilość, zaokrąglona do pełnych złotych. */
export function kwota(poz) {
  const cena = Number(poz?.cena) || 0;
  const ilosc = Number(poz?.ilosc) || 0;
  if (!(cena > 0) || !(ilosc > 0)) return 0;
  return Math.round(cena * ilosc);
}

/**
 * Czego brakuje w wierszu — null, gdy jest kompletny.
 *
 * Pusty wiersz (świeżo dodany, nic nie wpisane) NIE jest błędem: Dawid
 * dopiero zaczyna pisać. Błędem jest wiersz zaczęty i niedokończony,
 * bo taki po cichu wypadłby z sumy.
 */
export function czegoBrakuje(poz) {
  const nazwa = String(poz?.nazwa || '').trim();
  const cena = Number(poz?.cena) || 0;
  const ilosc = Number(poz?.ilosc) || 0;

  if (!nazwa && !(cena > 0)) return null; // wiersz jeszcze pusty
  if (!nazwa) return 'Podaj nazwę pozycji.';
  if (!(cena > 0)) return 'Podaj cenę brutto.';
  if (!(ilosc > 0)) return 'Ilość musi być większa od zera.';
  return null;
}

/** Wiersze, które naprawdę wchodzą do oferty. */
export function poprawne(lista) {
  return (Array.isArray(lista) ? lista : []).filter(
    (p) => String(p?.nazwa || '').trim() && kwota(p) > 0
  );
}

/** Suma własnych pozycji, brutto. */
export function razem(lista) {
  return poprawne(lista).reduce((suma, p) => suma + kwota(p), 0);
}

/**
 * Wiersze w kształcie, jakiego oczekuje zamrożona oferta.
 *
 * ⚠ `grupa` jest tu KONIECZNA i to ona decyduje, po której stronie rozbicia
 * kwota wyląduje u klienta. `pozycje-klienta.js#rozbicieDlaKlienta` czyta ją
 * wprost, a gdy jej nie ma — uznaje za materiał wyłącznie PIERWSZĄ pozycję
 * (bo w zamrożonej ofercie pozycje silnika grupy nie mają). Nasze wiersze
 * dopisujemy na końcu listy, więc bez `grupa` wpadłyby do prac — i tak jest
 * domyślnie, zgodnie z ustaleniem: własna pozycja to zwykle robota.
 * Cokoły czy inny dokupiony materiał Dawid przełącza jednym kliknięciem.
 *
 * ⚠ `detal` NIE MOŻE NIEŚĆ CENY JEDNOSTKOWEJ. Przy pozycji materiałowej
 * ten tekst dokleja się do opisu materiału na karcie klienta (patrz
 * `rozbicieDlaKlienta#materialOpis`), a stawek jednostkowych klientowi
 * nie pokazujemy — to zasada z 11.08.2026, obowiązuje całą kartę wyceny.
 * Dlatego jest tu sama ilość, bez mnożenia i bez kwoty.
 */
export function doOferty(lista) {
  return poprawne(lista).map((p) => ({
    nazwa: String(p.nazwa).trim().slice(0, 80),
    detal: Number(p.ilosc) > 1 ? `ilość: ${liczba(p.ilosc)}` : '',
    brutto: kwota(p),
    grupa: p.grupa === 'materiał' ? 'materiał' : 'usługi',
    // Znacznik dla edytora: te wiersze rysujemy inaczej i można je usunąć.
    wlasna: true,
  }));
}

/**
 * Wiersze do zapisania w parametrach oferty.
 *
 * Dzięki temu „Powtórz wycenę" na już wysłanej ofercie odtwarza także
 * dopisane pozycje — bez tego Dawid tracił je przy każdej poprawce
 * i musiał wpisywać demontaż od nowa.
 */
export function doParametrow(lista) {
  return poprawne(lista).map((p) => ({
    nazwa: String(p.nazwa).trim().slice(0, 80),
    cena: Number(p.cena) || 0,
    ilosc: Number(p.ilosc) || 1,
    grupa: p.grupa === 'materiał' ? 'materiał' : 'usługi',
  }));
}

/** Odtworzenie wierszy z parametrów — z odsianiem śmieci z zewnątrz. */
export function zParametrow(dane) {
  return (Array.isArray(dane) ? dane : [])
    .map((p) => ({
      nazwa: String(p?.nazwa || '').slice(0, 80),
      cena: Number(p?.cena) || 0,
      ilosc: Number(p?.ilosc) || 1,
      grupa: p?.grupa === 'materiał' ? 'materiał' : 'usługi',
    }))
    .filter((p) => p.nazwa && p.cena > 0);
}

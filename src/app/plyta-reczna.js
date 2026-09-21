/**
 * ══════════════════════════════════════════════════════════════════════════
 *  RĘCZNY WYMIAR PŁYTY W EDYTORZE WŁAŚCICIELA (zlecenie Dawida, 21.09.2026)
 *
 *  „Avant Mulen ma płytę 320 × 160, ale chcę móc wpisać też np. 100 × 100
 *   (resztka albo inny format) — i żeby rozkrój liczył się z tego."
 *
 *  Format płyty decyduje o LICZBIE PŁYT, a liczba płyt o cenie materiału —
 *  to nie jest kosmetyka rysunku. Dlatego reguły stoją w osobnym module,
 *  tak samo jak ręczne ceny usług (`ceny-pozycji.js`): korzysta z nich
 *  i pole na ekranie, i wycena, i zapis do parametrów oferty.
 *
 *  Zasady, które muszą być w jednym miejscu:
 *    • puste pole = powrót do formatu z cennika (nie do zera),
 *    • wpisanie dokładnie formatu cennikowego kasuje nadpisanie — inaczej
 *      wycena zostałaby „ręczna" na zawsze i przestała reagować na zmianę
 *      formatu w cenniku,
 *    • z resztki NIE kupuje się połówki płyty: to jeden fizyczny kawałek,
 *      więc `polowkaDozwolona` schodzi na `false`.
 * ══════════════════════════════════════════════════════════════════════════
 */

/** Najmniejszy sensowny bok płyty w cm — niżej to pomyłka w przecinku. */
export const MIN_BOK = 20;
/** Największy — płyty spiekowe kończą się grubo poniżej 4 m. */
export const MAKS_BOK = 400;

/** Liczba z pola. Tolerujemy przecinek dziesiętny („318,5"). */
const liczba = (x) => {
  const n =
    typeof x === 'number'
      ? x
      : Number(
          String(x ?? '')
            .replace(/[\s ]/g, '')
            .replace(',', '.')
            .replace(/[^0-9.]/g, '')
        );
  return Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : 0;
};

/** Czy oba boki mieszczą się w granicach zdrowego rozsądku. */
export const bokOk = (n) => n >= MIN_BOK && n <= MAKS_BOK;

/** Wymiary płyty z cennika (albo z kampanii) — do prefillu pola. */
export const wymiarDomyslny = (plyta) => ({
  w: Math.round((Number(plyta?.w) || 0) * 10) / 10,
  h: Math.round((Number(plyta?.h) || 0) * 10) / 10,
});

/**
 * Stan pola → format płyty dla silnika, albo `null`, gdy nie ma czego liczyć.
 *
 * `bazowy` to format, który obowiązywałby bez nadpisania (z kampanii albo
 * z pozycji cennika). Przepisujemy z niego wszystko poza wymiarami —
 * rzaz, obrzeże i reguły rotacji zostają takie, jak dla tego materiału.
 */
export function formatDoWyceny(reczny, bazowy) {
  const w = liczba(reczny?.w);
  const h = liczba(reczny?.h);
  if (!bokOk(w) || !bokOk(h)) return null;

  return {
    ...(bazowy || {}),
    w,
    h,
    /*
     * Resztka to jeden kawałek — „połówka płyty" nie ma z czego powstać.
     * Zostawienie `true` z cennika kazałoby wycenie policzyć pół resztki
     * i kwota materiału wyszłaby o połowę za niska.
     */
    polowkaDozwolona: false,
    reczna: true,
  };
}

/**
 * Czy wpisane wymiary to po prostu format z cennika.
 *
 * Wtedy NIE zapisujemy nadpisania: inaczej wycena zostałaby „ręczna"
 * na zawsze i przestała reagować na zmianę formatu w cenniku — a przy
 * okazji straciłaby prawo do połówki płyty, choć nikt o to nie prosił.
 */
export function takiJakDomyslny(reczny, domyslny) {
  const d = wymiarDomyslny(domyslny);
  return liczba(reczny?.w) === d.w && liczba(reczny?.h) === d.h;
}

/** Czy wymiar jest w tej wycenie wpisany ręcznie. */
export const recznyWymiar = (reczny) => !!formatDoWyceny(reczny, null);

/**
 * Czy to, co Dawid właśnie wpisał, w ogóle da się policzyć.
 * Zwraca komunikat po polsku albo pusty napis.
 */
export function bladWymiaru(reczny) {
  const w = liczba(reczny?.w);
  const h = liczba(reczny?.h);
  if (!w && !h) return '';
  if (!w || !h) return 'Podaj oba wymiary płyty.';
  if (!bokOk(w) || !bokOk(h)) return `Wymiar płyty poza zakresem ${MIN_BOK}–${MAKS_BOK} cm.`;
  return '';
}

/** Parametry oferty → stan pola (po „Powtórz wycenę" nic nie ginie). */
export function zParametrow(obiekt) {
  const w = liczba(obiekt?.w);
  const h = liczba(obiekt?.h);
  return bokOk(w) && bokOk(h) ? { w, h } : null;
}

/** Stan pola → parametry oferty. Brak nadpisania nie zostawia pola. */
export function doParametrow(reczny) {
  const f = formatDoWyceny(reczny, null);
  return f ? { w: f.w, h: f.h } : undefined;
}

/** Opis formatu do podpisu na ekranie: „100 × 100 cm". */
export const opisFormatu = (plyta) =>
  plyta?.w && plyta?.h
    ? `${String(plyta.w).replace('.', ',')} × ${String(plyta.h).replace('.', ',')} cm`
    : '';

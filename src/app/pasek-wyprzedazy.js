/**
 * PASEK WYPRZEDAŻY — jeden, nad startem rozmowy.
 *
 * Zlecenie Dawida (01.09.2026): „jako klient, jak uruchamiam kalkulator, to
 * ciężko znaleźć wyprzedaż — a to powinno być dobrze widoczne, aż KRZYKLIWE".
 *
 * Wcześniej wyprzedaż istniała wyłącznie jako jeden kafelek na trzecim kroku
 * rozmowy. Klient musiał wybrać pomieszczenie, potem rodzaj kamienia, i dopiero
 * wtedy mógł ją zobaczyć — czyli praktycznie nie widział jej wcale.
 *
 * ⚠ BYŁY DWA PASKI, ZOSTAŁ JEDEN (poprawka tego samego dnia, po zrzucie
 * z telefonu Dawida). Pierwsza wersja stawiała wstążkę w hero strony głównej
 * ORAZ smukły pasek nad rozmową. Na telefonie oba wypadały kilkadziesiąt
 * pikseli od siebie — nad sekcją „Policz swój blat" i zaraz pod jej
 * nagłówkiem — i czytało się to jak usterka, a nie jak oferta.
 *
 * Decyzja Dawida: zostaje ten przy kalkulatorze. I słusznie — on prowadzi
 * PROSTO do kart płyt w rozmowie, zamiast przerzucać klienta na inną stronę
 * w połowie drogi do wyceny. Wariant „hero" usunięty razem z kodem: martwy
 * przełącznik prędzej czy później wróciłby przez pomyłkę.
 *
 * Głośny, ale nie tandetny: żar rozgrzanego kamienia i złoto z reszty strony,
 * wersaliki, jeden przesuwający się refleks — bez migania, bez licznika
 * „oferta kończy się za 3:59" i bez wykrzykników.
 *
 * Treść bierze się z `hasloWyprzedazy`, wspólnie z kafelkiem przy wyborze
 * materiału — żeby liczby nie zaczęły się rozjeżdżać. Gdy Dawid nic nie
 * wystawił, funkcja zwraca `null` i paska nie ma. O pustym placu nie krzyczymy.
 */
import { h } from './dom.js';
import { formaPlyty, hasloWyprzedazy } from './wyprzedaz.js';
import { zdarzenie } from '../analytics/zdarzenia.js';

/**
 * @param {Array}  plyty            lista z `/wyprzedaz`
 * @param {object} opcje
 * @param {Function} [opcje.onKlik] co zrobić po kliknięciu (pokazać płyty)
 * @param {string} [opcje.miejsce]  do statystyk — skąd klient kliknął
 * @returns {HTMLElement|null}
 */
export function pasekWyprzedazy(plyty, opcje = {}) {
  const haslo = hasloWyprzedazy(plyty);
  if (!haslo) return null;

  const miejsce = opcje.miejsce || 'nieznane';
  // Upust pokazujemy tylko wtedy, gdy Dawid podał ceny „było" — procent
  // wzięty z powietrza byłby zwykłym oszustwem.
  const upust = haslo.upust ? h('span', { class: 'pw-upust' }, `−${haslo.upust}%`) : null;

  return h(
    'button',
    {
      class: 'pasek-wyprzedaz pasek-smukly',
      type: 'button',
      'data-miejsce': miejsce,
      onclick: () => {
        zdarzenie('wyprzedaz_pasek', { miejsce });
        opcje.onKlik?.();
      },
    },
    h('span', { class: 'pw-plomien', 'aria-hidden': 'true' }, '🔥'),
    h('span', { class: 'pw-tytul' }, haslo.tytul, upust),
    h(
      'span',
      { class: 'pw-nota' },
      `${haslo.sztuk} ${formaPlyty(haslo.sztuk)} z placu — policz blat z konkretnej sztuki`
    ),
    h('span', { class: 'pw-akcja' }, 'Pokaż płyty →')
  );
}

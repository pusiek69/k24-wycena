/**
 * PASEK WYPRZEDAŻY — głośny akcent, który ma być widać od pierwszego ekranu.
 *
 * Zlecenie Dawida (01.09.2026): „jako klient, jak uruchamiam kalkulator, to
 * ciężko znaleźć wyprzedaż — a to powinno być dobrze widoczne, aż KRZYKLIWE".
 *
 * Wcześniej wyprzedaż istniała wyłącznie jako jeden kafelek na trzecim kroku
 * rozmowy. Klient musiał wybrać pomieszczenie, potem rodzaj kamienia, i dopiero
 * wtedy mógł ją zobaczyć — czyli praktycznie nie widział jej wcale.
 *
 * DWA WARIANTY, bo oba stoją na stronie głównej i widać je naraz:
 *
 *   • 'hero' — wstążka pod przyciskiem wyceny, prowadzi na /wyprzedaz-plyt.
 *     To ona jest głośna: dwie linijki, płomień w palenisku, żar od lewej.
 *   • 'rozmowa' — smukły pasek nad startem rozmowy, otwiera karty płyt
 *     w kalkulatorze. Jedna linijka, ten sam żar, o połowę niższy.
 *
 * ⚠ Wariantów nie scalamy. Pierwsza wersja rysowała w obu miejscach ten sam
 * pas i na stronie głównej wychodziły dwa identyczne czerwone paski w jednym
 * ekranie — czytelne raczej jako usterka niż jako oferta. Krzykliwy ma być
 * JEDEN element, drugi ma być akcją.
 *
 * Treść w obu miejscach bierze się z `hasloWyprzedazy`, żeby liczby nigdy nie
 * zaczęły się rozjeżdżać: baner nie ma prawa obiecywać −43%, gdy karta pokazuje
 * −25%. Gdy Dawid nic nie wystawił, funkcja zwraca `null` i nie ma paska nigdzie
 * — o pustym placu nie krzyczymy.
 */
import { h } from './dom.js';
import { formaPlyty, hasloWyprzedazy } from './wyprzedaz.js';
import { zdarzenie } from '../analytics/zdarzenia.js';

/**
 * @param {Array}  plyty            lista z `/wyprzedaz`
 * @param {object} opcje
 * @param {string} [opcje.wariant]  'hero' (domyślnie) albo 'rozmowa'
 * @param {string} [opcje.href]     gdy pasek ma być linkiem (strona główna)
 * @param {Function} [opcje.onKlik] gdy ma być przyciskiem (rozmowa)
 * @param {string} [opcje.miejsce]  do statystyk — skąd klient kliknął
 * @returns {HTMLElement|null}
 */
export function pasekWyprzedazy(plyty, opcje = {}) {
  const haslo = hasloWyprzedazy(plyty);
  if (!haslo) return null;

  const smukly = opcje.wariant === 'rozmowa';
  const miejsce = opcje.miejsce || 'nieznane';
  // Upust pokazujemy tylko wtedy, gdy Dawid podał ceny „było" — procent
  // wzięty z powietrza byłby zwykłym oszustwem.
  const upust = haslo.upust ? h('span', { class: 'pw-upust' }, `−${haslo.upust}%`) : null;

  const tresc = smukly
    ? [
        h('span', { class: 'pw-plomien', 'aria-hidden': 'true' }, '🔥'),
        h('span', { class: 'pw-tytul' }, haslo.tytul, upust),
        h(
          'span',
          { class: 'pw-nota' },
          `${haslo.sztuk} ${formaPlyty(haslo.sztuk)} z placu — policz blat z konkretnej sztuki`
        ),
        h('span', { class: 'pw-akcja' }, 'Pokaż płyty →'),
      ]
    : [
        /*
         * Płomień siedzi we własnym „palenisku" — kółku z żarem. Bez tego
         * emoji zlewa się z tekstem i wygląda jak literówka, a nie jak znak.
         */
        h('span', { class: 'pw-znak', 'aria-hidden': 'true' }, '🔥'),
        h(
          'span',
          { class: 'pw-tresc' },
          h('span', { class: 'pw-tytul' }, haslo.tytul, upust),
          h('span', { class: 'pw-nota' }, haslo.nota)
        ),
        h('span', { class: 'pw-akcja' }, haslo.akcja, ' →'),
      ];

  const klasa = 'pasek-wyprzedaz' + (smukly ? ' pasek-smukly' : '');

  if (opcje.href) {
    return h(
      'a',
      {
        class: klasa,
        href: opcje.href,
        'data-miejsce': miejsce,
        onclick: () => zdarzenie('wyprzedaz_pasek', { miejsce }),
      },
      tresc
    );
  }

  return h(
    'button',
    {
      class: klasa,
      type: 'button',
      'data-miejsce': miejsce,
      onclick: () => {
        zdarzenie('wyprzedaz_pasek', { miejsce });
        opcje.onKlik?.();
      },
    },
    tresc
  );
}

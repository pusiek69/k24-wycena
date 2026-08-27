/**
 * BANER „OSTATNIE PŁYTY" — widoczny dla każdego klienta od wejścia.
 *
 * Zlecenie Dawida (27.08.2026), z warunkiem: zanim cokolwiek pojawi się
 * publicznie, chce to najpierw ZOBACZYĆ i zaakceptować. Stąd `podglad`:
 * ten sam moduł renderuje baner na produkcji (tylko opublikowane promocje)
 * i na stronie podglądu z panelu (dokłada jeden szkic, z wyraźną wstążką
 * „PODGLĄD"), żeby Dawid oglądał DOKŁADNIE to, co zobaczy klient.
 *
 * Jedyna nieczysta część aplikacji dotycząca promocji — sieć i DOM.
 * Reguły (co jest aktywne, jak brzmi licznik) siedzą w czystym
 * app/promo-plyt.js i tam są testowane.
 */
import { h, zl, pusty } from './dom.js';
import { pobierzPromocje } from '../api.js';
import { doBanera, formaPlyty, dataPl } from './promo-plyt.js';

let obietnica = null;
let ostatnieZaladowane = [];

/**
 * Promocje z sieci — wołane RAZ na wejście (jak `gotoweStawki`). `podglad`
 * przekazany tylko przy starcie w trybie podglądu, więc produkcja nigdy
 * przypadkiem nie odpyta jako właściciel.
 */
export function gotowePromocje(podglad) {
  if (!obietnica) {
    obietnica = pobierzPromocje(podglad)
      .then((p) => {
        ostatnieZaladowane = p;
        return p;
      })
      .catch(() => []);
  }
  return obietnica;
}

/**
 * Ostatni znany wynik, SYNCHRONICZNIE — puste, dopóki `gotowePromocje` się
 * nie rozstrzygnie. Używa tego dyskretna podpowiedź w wynik-widok.js: nie
 * ma sensu opóźniać pokazania gotowej wyceny o kolejny fetch, a promocje
 * i tak zdążą się wczytać w tle, zanim klient w ogóle dojdzie do wyniku.
 */
export function promocjeZaladowane() {
  return ostatnieZaladowane;
}

/**
 * Renderuje baner do `kontener`. Pusto, gdy nie ma czego pokazać —
 * kontener zostaje w DOM (żeby nie skakał layout), ale bez zawartości.
 *
 * @param {HTMLElement} kontener
 * @param {Array} promocje
 * @param {object} opcje
 * @param {(promo) => void} opcje.onWybierz  klik „policz z tej płyty"
 * @param {boolean} [opcje.podglad]  wstążka „PODGLĄD" + notatka dla Dawida
 */
export function renderBaner(kontener, promocje, { onWybierz, podglad = false } = {}) {
  pusty(kontener);
  const aktywne = doBanera(promocje);
  if (!aktywne.length) return;

  kontener.append(
    h(
      'div',
      { class: 'promo-baner' + (podglad ? ' promo-baner-podglad' : '') },
      podglad ? wstazkaPodgladu() : null,
      ...aktywne.map((p) => kartaPromocji(p, onWybierz))
    )
  );
}

function wstazkaPodgladu() {
  return h(
    'div',
    { class: 'promo-podglad-info' },
    h('b', {}, '👁 Podgląd — niepublikowane.'),
    ' Klienci tego jeszcze nie widzą. Wygląda dobrze? Wróć do panelu i kliknij „Opublikuj".'
  );
}

function kartaPromocji(p, onWybierz) {
  return h(
    'article',
    { class: 'promo-baner-karta' },
    h(
      'div',
      { class: 'promo-baner-tekst' },
      h('span', { class: 'promo-baner-etykieta' }, 'Ostatnie płyty'),
      h('h3', { class: 'promo-baner-nazwa' }, p.nazwa),
      p.opisMaterial || p.dekor
        ? h(
            'p',
            { class: 'promo-baner-material' },
            [p.opisMaterial, p.dekor].filter(Boolean).join(' · ')
          )
        : null
    ),
    h(
      'div',
      { class: 'promo-baner-cena' },
      p.cenaNormalnaM2 > 0
        ? h('s', { class: 'promo-baner-cena-przed' }, `${zl(p.cenaNormalnaM2)}/m²`)
        : null,
      h('b', { class: 'promo-baner-cena-teraz' }, `${zl(p.cenaPromoM2)}/m²`),
      h(
        'span',
        { class: 'promo-baner-licznik' },
        `zostało ${p.plytZostalo} ${formaPlyty(p.plytZostalo)}${p.dataKonca ? ' · do ' + dataPl(p.dataKonca) : ''}`
      )
    ),
    h(
      'button',
      {
        class: 'btn promo-baner-cta',
        type: 'button',
        onclick: () => onWybierz?.(p),
      },
      'Policz z tej płyty →'
    )
  );
}

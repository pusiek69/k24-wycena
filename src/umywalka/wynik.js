/**
 * KARTA CENY — to, co klient widzi po wysłaniu zgłoszenia.
 *
 * Cztery linie, nie czternaście. Klient ma zrozumieć, za co płaci, bez
 * kalkulatora w ręku i bez słownika kamieniarskiego: „kamień", „wykonanie",
 * „montaż", „projekt i pomiar — w cenie". Stawek warsztatu, metrów
 * bieżących i listy kawałków tu nie ma — to materiał do maila dla Dawida.
 *
 * Kwota odlicza się w górę przez pół sekundy. Nie dla efektu: w tym
 * momencie klient właśnie zostawił telefon i ten ruch mówi „policzone
 * teraz, dla Ciebie", a nie „wyjęte z tabelki".
 */
import { h, zl } from '../app/dom.js';

const TEL = '796 991 128';

export function kartaCeny(w) {
  const kwota = h('div', { class: 'cena-kwota', 'aria-live': 'polite' }, zl(w.razemZaokr));
  odliczaj(kwota, w.razemZaokr);

  return h(
    'div',
    { class: 'cena-karta' },
    h('div', { class: 'cena-naglowek' }, 'Twoja umywalka'),
    kwota,
    h(
      'div',
      { class: 'cena-podpis' },
      w.stan.montaz
        ? 'brutto, z montażem (VAT 8% — lokal mieszkalny)'
        : 'brutto, odbiór własny z zakładu (VAT 23%)'
    ),

    h(
      'ul',
      { class: 'cena-linie' },
      w.linieKlienta.map((l) =>
        h(
          'li',
          { class: l.wCenie ? 'cena-linia cena-wcenie' : 'cena-linia' },
          h('span', { class: 'cena-linia-nazwa' }, l.nazwa),
          h('span', { class: 'cena-linia-kwota' }, l.wCenie ? 'w cenie' : zl(Math.round(l.brutto)))
        )
      )
    ),

    w.promo
      ? h(
          'p',
          { class: 'cena-promo' },
          '✓ Ten kamień jest teraz w promocji producenta — cena już ją uwzględnia.'
        )
      : null,

    h(
      'div',
      { class: 'cena-wcenie-blok' },
      h('h4', {}, 'W cenie'),
      h(
        'ul',
        {},
        h('li', {}, 'projekt 3D umywalki do zatwierdzenia'),
        h('li', {}, 'pomiar u klienta przed wykonaniem'),
        h('li', {}, 'wycięcie, klejenie i polerowanie krawędzi'),
        w.stan.typ === 'zintegrowana' ? h('li', {}, 'zlew wycięty w tym samym kamieniu') : null,
        w.stan.montaz ? h('li', {}, 'transport i montaż u klienta') : null
      ),
      h('h4', {}, 'Nie ma w cenie'),
      h(
        'ul',
        {},
        h('li', {}, 'bateria i syfon'),
        h('li', {}, 'demontaż starej umywalki'),
        w.stan.mocowanie === 'podwieszana'
          ? h('li', {}, 'wsporniki przy montażu podwieszanym — ustalimy na pomiarze')
          : null
      )
    ),

    w.tanszaWersja && w.tanszaWersja < w.razemZaokr
      ? h(
          'p',
          { class: 'cena-tansza' },
          `Tańsza wersja: ten sam kamień jako blat pod umywalkę nablatową — około `,
          h('b', {}, zl(w.tanszaWersja)),
          ' (bez zlewu wyciętego w kamieniu).'
        )
      : null,

    h(
      'div',
      { class: 'cena-dalej' },
      h(
        'a',
        { class: 'btn', href: 'tel:+48796991128', 'data-miejsce': 'umywalka-wynik' },
        'Umów pomiar i projekt 3D'
      ),
      h('span', { class: 'form-nota' }, `albo odpowiedz na maila z wyceną · ☎ ${TEL} (8–18)`)
    ),

    h(
      'p',
      { class: 'cena-zastrzezenie' },
      'Wycena orientacyjna, przygotowana na podstawie podanych wymiarów. ' +
        'Wiążąca cena po pomiarze u klienta. ' +
        (w.stan.montaz
          ? 'Stawka 8% dotyczy usługi w lokalu mieszkalnym; przy innym przeznaczeniu obowiązuje 23%.'
          : 'Przy odbiorze własnym odpowiedzialność za poprawność wymiarów jest po stronie zamawiającego.')
    ),

    (w.ostrzezenia || []).length
      ? h(
          'ul',
          { class: 'cena-ostrzezenia' },
          w.ostrzezenia.map((o) => h('li', {}, o))
        )
      : null
  );
}

/**
 * Odliczanie kwoty w górę (0,6 s).
 *
 * Przy `prefers-reduced-motion: reduce` kwota pojawia się od razu —
 * animacja liczb jest jedną z pierwszych rzeczy, które przeszkadzają
 * osobom wrażliwym na ruch.
 */
function odliczaj(element, docelowa) {
  const stoj = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  if (stoj || !docelowa) {
    element.textContent = zl(docelowa);
    return;
  }

  const czas = 600;
  const start = performance.now();
  const krok = (teraz) => {
    const postep = Math.min(1, (teraz - start) / czas);
    // Wyhamowanie na końcu — liczba „dojeżdża", a nie urywa się w biegu.
    const wygladzony = 1 - Math.pow(1 - postep, 3);
    element.textContent = zl(Math.round((docelowa * wygladzony) / 50) * 50);
    if (postep < 1) requestAnimationFrame(krok);
    else element.textContent = zl(docelowa);
  };
  requestAnimationFrame(krok);
}

/**
 * FILTRY WYPRZEDAŻY — kafelki kategorii, typu i pole szukania.
 *
 * Zlecenie Dawida (01.09.2026): przy kilkudziesięciu płytach jedna długa
 * lista przestaje być ofertą, a zaczyna być spisem z magazynu.
 *
 * Jeden komponent obsługuje stronę `/wyprzedaz-plyt` i listę płyt w samym
 * kalkulatorze — inaczej klient filtrowałby w dwóch miejscach na dwa różne
 * sposoby i szybko przestałby ufać, że widzi wszystko.
 *
 * Sama LOGIKA (co przez co przechodzi) siedzi w `wyprzedaz.js#filtruj`,
 * bo daje się ją testować w node. Tutaj jest wyłącznie DOM.
 *
 * Kafelki, które nic by nie pokazały, w ogóle się nie rysują: pusty filtr
 * to zmarnowane kliknięcie i fałszywa obietnica, że coś takiego mamy.
 */
import { h } from './dom.js';
import { policzWKategoriach, policzWTypach } from './wyprzedaz.js';

/**
 * @param {Array} plyty       pełna lista (przed filtrowaniem)
 * @param {object} stan       { kategoria, typ, szukaj } — modyfikowany w miejscu
 * @param {Function} przerysuj  wołane po każdej zmianie
 * @returns {HTMLElement|null}  null, gdy nie ma czego filtrować
 */
export function filtryWyprzedazy(plyty, stan, przerysuj) {
  const kategorie = policzWKategoriach(plyty, stan);
  const typy = policzWTypach(plyty, stan);

  /*
   * Jedna kategoria to nie wybór, tylko etykieta — przy jednym kafelku
   * filtr niczego nie zawęża, a zajmuje miejsce nad ofertą. To samo z typem.
   *
   * ⚠ ALE grupa z WŁĄCZONYM filtrem musi zostać na ekranie, nawet gdy
   * zostanie w niej jedna pozycja. Bez tego wpisanie czegoś w wyszukiwarce
   * przy aktywnym „Spieki" chowało kafelki kategorii — filtr dalej działał,
   * a klient nie miał go jak zdjąć ani nawet zobaczyć.
   */
  const wartoKategorie = kategorie.length > 1 || !!stan.kategoria;
  const wartoTypy = typy.length > 1 || !!stan.typ;
  // Szukanie ma sens dopiero wtedy, gdy jest w czym szukać.
  const wartoSzukac = plyty.length >= 6;
  if (!wartoKategorie && !wartoTypy && !wartoSzukac) return null;

  const kafelek = (etykieta, ile, aktywny, onKlik) =>
    h(
      'button',
      {
        class: 'wyp-filtr' + (aktywny ? ' wyp-filtr-sel' : ''),
        type: 'button',
        'aria-pressed': aktywny ? 'true' : 'false',
        onclick: onKlik,
      },
      etykieta,
      ile == null ? null : h('span', { class: 'wyp-filtr-ile' }, String(ile))
    );

  const grupa = (etykieta, kafelki) =>
    h(
      'div',
      { class: 'wyp-grupa' },
      h('span', { class: 'wyp-grupa-label' }, etykieta),
      h('div', { class: 'wyp-kafelki' }, kafelki)
    );

  const ustaw = (pole, wartosc) => () => {
    // Ponowny klik w wybrany kafelek zdejmuje filtr — bez szukania „X".
    stan[pole] = stan[pole] === wartosc ? null : wartosc;
    przerysuj();
  };

  const pole = h('input', {
    class: 'wyp-szukaj',
    type: 'search',
    value: stan.szukaj || '',
    placeholder: 'Szukaj wzoru, np. „Taj Mahal"',
    'aria-label': 'Szukaj wśród płyt z wyprzedaży',
    oninput: (e) => {
      stan.szukaj = e.target.value;
      przerysuj({ zachowajFokus: true });
    },
  });

  return h(
    'div',
    { class: 'wyp-filtry' },
    wartoKategorie
      ? grupa('Materiał', [
          kafelek('Wszystkie', null, !stan.kategoria, ustaw('kategoria', null)),
          kategorie.map((k) => kafelek(k.nazwa, k.ile, stan.kategoria === k.id, ustaw('kategoria', k.id))),
        ])
      : null,
    wartoTypy
      ? grupa('Rodzaj płyty', [
          kafelek('Wszystkie', null, !stan.typ, ustaw('typ', null)),
          typy.map((t) => kafelek(t.nazwa, t.ile, stan.typ === t.id, ustaw('typ', t.id))),
        ])
      : null,
    wartoSzukac ? pole : null
  );
}

/** Pole szukania po przerysowaniu — żeby klient nie tracił kursora w trakcie pisania. */
export function przywrocFokus(korzen, poprzednie) {
  if (!poprzednie) return;
  const pole = korzen.querySelector('.wyp-szukaj');
  if (!pole) return;
  pole.focus();
  const koniec = pole.value.length;
  pole.setSelectionRange(koniec, koniec);
}

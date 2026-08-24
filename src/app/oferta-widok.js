/**
 * KARTA OFERTY — DOKŁADNIE TO, CO WIDZI KLIENT.
 *
 * Jeden renderer dla dwóch miejsc:
 *   • strona wyceny online (src/oferta.js), którą klient otwiera z maila,
 *   • podgląd przed wysyłką w trybie właściciela (app/oferta-dawida.js).
 *
 * Wspólny kod jest tu celowo: podgląd, który rysuje się własną ścieżką,
 * po pierwszej zmianie przestaje pokazywać prawdę — a to jedyna rzecz,
 * do której ten ekran służy.
 *
 * Ceny jednostkowe są już wycięte wcześniej (app/oferta-detal.js), więc
 * tutaj tylko wyświetlamy to, co siedzi w zamrożonej ofercie.
 */
import { h, zl } from './dom.js';

export function kartaOferty(o, { imie = '', utworzono = null } = {}) {
  const data = new Date(utworzono || Date.now()).toLocaleDateString('pl-PL');

  return h(
    'div',
    { class: 'karta-wyceny' },
    h('div', { class: 'q-kicker' }, `Wycena z dnia ${data}${imie ? ` dla: ${imie}` : ''}`),
    h('h3', { class: 'q-title' }, o.opis || 'Blat z kamienia'),

    h(
      'div',
      { class: 'oferta-pozycje' },
      ...(o.pozycje || []).map((p) =>
        h(
          'div',
          { class: 'oferta-poz' + (p.gratis ? ' gratis' : '') },
          h('span', {}, p.nazwa, p.detal ? h('small', {}, p.detal) : null),
          h('b', {}, p.gratis ? 'GRATIS' : zl(p.brutto))
        )
      )
    ),

    h(
      'div',
      { class: 'oferta-suma' },
      h('span', {}, 'Razem brutto'),
      h(
        'span',
        {},
        // Przekreślona cena „przed" tylko wtedy, gdy Dawid świadomie pokazał
        // obniżkę — inaczej klient widzi samą kwotę końcową.
        o.przekresl && Number(o.razemPrzed) > Number(o.razem)
          ? h('s', { class: 'oferta-stara' }, zl(o.razemPrzed))
          : null,
        h('b', {}, zl(o.razem))
      )
    ),

    ...(o.noty || []).map((nota) => h('div', { class: 'info' }, nota)),
    h(
      'div',
      { class: 'info' },
      `W cenie stawka VAT ${Math.round((o.stawkaVat ?? 0.08) * 100)}%. ` +
        'Wycena przygotowana indywidualnie, ważna 30 dni. ' +
        (o.odbiorWlasny
          ? 'Odbiór własny w zakładzie — prosimy sprawdzić wymiary przed zamówieniem.'
          : 'Ostateczną cenę potwierdzamy po bezpłatnym pomiarze.')
    ),

    h(
      'div',
      { class: 'nav' },
      h('a', { class: 'btn', href: 'tel:+48796991128', 'data-miejsce': 'oferta-karta' }, '☎ 796 991 128')
    )
  );
}

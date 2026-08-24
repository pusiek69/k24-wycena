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
import {
  rozbicieDlaKlienta,
  opisPrac,
  ETYKIETA_MATERIALU,
  ETYKIETA_PRAC,
} from './pozycje-klienta.js';

export function kartaOferty(o, { imie = '', utworzono = null } = {}) {
  const data = new Date(utworzono || Date.now()).toLocaleDateString('pl-PL');
  const r = rozbicieDlaKlienta(o.pozycje, { odbiorWlasny: o.odbiorWlasny });

  return h(
    'div',
    { class: 'karta-wyceny' },
    h('div', { class: 'q-kicker' }, `Wycena z dnia ${data}${imie ? ` dla: ${imie}` : ''}`),
    h('h3', { class: 'q-title' }, o.opis || 'Blat z kamienia'),

    // Klient widzi DWIE kwoty i sumę — bez wyliczania pomiaru, wycięć
    // i montażu z osobna (decyzja Dawida, 21.08.2026).
    h(
      'div',
      { class: 'oferta-pozycje' },
      h(
        'div',
        { class: 'oferta-poz' },
        h('span', {}, ETYKIETA_MATERIALU, r.materialOpis ? h('small', {}, r.materialOpis) : null),
        h('b', {}, zl(r.material))
      ),
      h(
        'div',
        { class: 'oferta-poz' },
        h(
          'span',
          {},
          ETYKIETA_PRAC,
          h('small', {}, opisPrac(o.odbiorWlasny)),
          r.gratisy.length ? h('small', {}, 'W tym gratis: ' + r.gratisy.join(', ').toLowerCase()) : null
        ),
        h('b', {}, zl(r.prace))
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

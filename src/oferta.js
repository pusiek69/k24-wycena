/**
 * WYCENA ONLINE — strona, którą klient otwiera z linku w mailu od Dawida.
 *
 * Token siedzi we FRAGMENCIE adresu (#…): nie wychodzi w referrerze,
 * nie trafia do logów serwera ani do statystyk. Dane wyceny są ZAMROŻONE
 * po stronie serwera (baza klientów) — ta strona niczego nie liczy,
 * tylko pokazuje to, co Dawid wysłał, i zbiera odpowiedź klienta tymi
 * samymi trzema przyciskami co kalkulator.
 *
 * Każde otwarcie podbija licznik „klient obejrzał" w karcie leada.
 */
import './style.css';
import { h, zl } from './app/dom.js';
import { API_BASE, wyslijFeedback } from './api.js';
import { zdarzenie } from './analytics/zdarzenia.js';

const PORY = ['Jak najszybciej', 'Po 16:00', 'Jutro przed południem'];
const BUDZETY = ['do 8 tys.', '8–12 tys.', '12–20 tys.', 'powyżej 20 tys.'];

const token = (location.hash || '').replace(/^#/, '').trim();
const root = document.getElementById('oferta');

async function start() {
  if (!/^[a-f0-9]{32,64}$/.test(token)) {
    return blad('Ten link jest niekompletny. Proszę otworzyć go prosto z maila albo zadzwonić: 796 991 128.');
  }
  let dane = null;
  try {
    const odp = await fetch(`${API_BASE}/oferta/dane`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    dane = await odp.json();
  } catch {
    /* pokażemy komunikat niżej */
  }
  if (!dane?.ok || !dane.oferta) {
    return blad('Nie udało się wczytać wyceny. Proszę spróbować za chwilę albo zadzwonić: 796 991 128.');
  }
  zdarzenie('oferta_otwarta');
  root.replaceChildren(widok(dane));
}

function blad(tresc) {
  root.replaceChildren(h('div', { class: 'bramka-ok' }, h('span', { class: 'ptak' }, '☎'), h('span', {}, tresc)));
}

function widok({ imie, utworzono, oferta: o }) {
  const data = new Date(utworzono).toLocaleDateString('pl-PL');

  return h(
    'div',
    {},
    h(
      'div',
      { class: 'karta-wyceny' },
      h(
        'div',
        { class: 'q-kicker' },
        `Wycena z dnia ${data}${imie ? ` dla: ${imie}` : ''}`
      ),
      h('h3', { class: 'q-title' }, o.opis || 'Blat z kamienia'),

      h(
        'div',
        { class: 'oferta-pozycje' },
        ...o.pozycje.map((p) =>
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
          o.przekresl && Number(o.razemPrzed) > Number(o.razem)
            ? h('s', { class: 'oferta-stara' }, zl(o.razemPrzed))
            : null,
          h('b', {}, zl(o.razem))
        )
      ),

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
    ),
    feedback()
  );
}

/* Trzy przyciski — te same co pod wyceną w kalkulatorze; odpowiedź trafia
   na tę samą kartę klienta (serwer rozpoznaje ją po tokenie oferty). */
function feedback() {
  const box = h('div', { class: 'feedback' });
  const wyslij = (tresc) => {
    zdarzenie('feedback_oferta', { wybor: tresc.feedback });
    wyslijFeedback({ oferta: token, ...tresc });
  };

  box.append(
    h('div', { class: 'feedback-pyt' }, 'Co Pan/Pani sądzi o tej wycenie?'),
    h(
      'div',
      { class: 'feedback-przyciski' },
      przycisk('👍', 'Pasuje mi — proszę o kontakt', () => {
        wyslij({ feedback: 'pasuje' });
        box.replaceChildren(
          h('div', { class: 'feedback-krok' },
            h('div', { class: 'feedback-pyt' }, 'Świetnie! Kiedy najlepiej zadzwonić?'),
            h('div', { class: 'feedback-przyciski' },
              ...PORY.map((pora) =>
                przycisk(null, pora, () => {
                  wyslijFeedback({ oferta: token, feedback: 'pasuje', pora });
                  box.replaceChildren(dzieki('Dziękujemy! ', `Oddzwonimy (${pora.toLowerCase()}).`));
                })
              )
            )
          )
        );
      }),
      przycisk('💰', 'Cena za wysoka', () => {
        wyslij({ feedback: 'za_drogo' });
        box.replaceChildren(
          h('div', { class: 'feedback-krok' },
            h('div', { class: 'feedback-pyt' }, 'Jaki budżet Pan/Pani zakładał(a)? (niewymagane)'),
            h('div', { class: 'feedback-przyciski' },
              ...BUDZETY.map((budzet) =>
                przycisk(null, budzet, () => {
                  wyslijFeedback({ oferta: token, feedback: 'za_drogo', budzet });
                  box.replaceChildren(dzieki('Dziękujemy! ', 'Odezwiemy się z propozycją w tym budżecie.'));
                })
              )
            )
          )
        );
      }),
      przycisk('🤔', 'Muszę się zastanowić', () => {
        wyslij({ feedback: 'zastanowi' });
        box.replaceChildren(dzieki('Nic nie ucieka. ', 'Wycena pozostaje ważna 30 dni. W razie pytań: 796 991 128.'));
      })
    )
  );
  return box;
}

const przycisk = (ikona, tekst, onclick) =>
  h(
    'button',
    { class: 'feedback-btn', type: 'button', onclick },
    ikona ? h('span', { class: 'feedback-ikona', 'aria-hidden': 'true' }, ikona) : null,
    tekst
  );

const dzieki = (mocne, reszta) =>
  h('div', { class: 'feedback-dzieki' }, h('span', { class: 'ptak' }, '✓'), h('span', {}, h('b', {}, mocne), reszta));

start();

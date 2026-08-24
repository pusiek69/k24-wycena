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
import { h } from './app/dom.js';
import { kartaOferty } from './app/oferta-widok.js';
import { sekcjaRozmowy } from './app/rozmowa-klienta.js';
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

function widok({ imie, utworzono, oferta: o, rozmowa }) {
  // Karta jest wspólna z podglądem w trybie właściciela — patrz
  // app/oferta-widok.js. Tu dokładamy przyciski feedbacku i rozmowę.
  return h(
    'div',
    {},
    kartaOferty(o, {
      imie,
      utworzono,
      // Klik w wariancie to najmocniejszy sygnał, jaki klient może dać:
      // mówi nie tylko że chce, ale NA CZYM. Idzie jako zwykły feedback
      // „pasuje" z dopisaną nazwą materiału.
      naWybor: (wariant) => wybierzWariant(wariant),
    }),
    feedback(),
    // Wątek wisi przy TEJ ofercie — autoryzuje ten sam token, co wycena.
    sekcjaRozmowy(token, rozmowa || [])
  );
}

/**
 * Klient wskazał wariant materiałowy.
 *
 * Potwierdzenie pokazujemy NA KARCIE tego wariantu, a nie gdzieś na dole —
 * klient ma zobaczyć reakcję tam, gdzie kliknął.
 */
function wybierzWariant(wariant) {
  zdarzenie('feedback_oferta', { wybor: 'wariant' });
  wyslijFeedback({ oferta: token, feedback: 'pasuje', wariant: wariant.opis || wariant.material });

  const karty = [...document.querySelectorAll('.wariant-karta')];
  const karta = karty.find((k) => k.textContent.includes(wariant.opis));
  if (!karta) return;
  karta.classList.add('wybrany');
  const przycisk = karta.querySelector('.wariant-wybor');
  if (przycisk) {
    przycisk.replaceWith(
      h('div', { class: 'wariant-potwierdzenie' }, '✓ Zapisane — odezwiemy się w sprawie tego materiału.')
    );
  }
  for (const inna of karty) {
    if (inna !== karta) inna.querySelector('.wariant-wybor')?.setAttribute('disabled', 'disabled');
  }
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

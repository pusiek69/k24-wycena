/**
 * FEEDBACK PO WYCENIE — trzy przyciski pod pokazaną kwotą.
 *
 * Klient właśnie zobaczył cenę i to jest jedyny moment, w którym powie
 * nam prawdę o niej jednym dotknięciem. Zasady:
 *   • przyciski pojawiają się DOPIERO z wyceną (rysuje je odsloniecie()
 *     w bramka.js, czyli po wysłaniu zgłoszenia),
 *   • „za wysoka" i „muszę się zastanowić" nie wymagają żadnych danych —
 *     telefon i mail już mamy z bramki,
 *   • odpowiedź leci do bazy klientów (etykieta przy leadzie w panelu),
 *     a „pasuje mi" dodatkowo podnosi status na CIEPŁY,
 *   • wysyłka feedbacku nie ma prawa niczego zepsuć — leci w tle,
 *     bez czekania i bez komunikatów o błędach.
 */
import { h, zl } from './dom.js';
import { wyslijFeedback } from '../api.js';
import { zdarzenie } from '../analytics/zdarzenia.js';
import { szukajTanszych, rodzajMaterialu, nazwaRodzaju } from '../engine/alternatywy.js';

const PORY = ['Jak najszybciej', 'Po 16:00', 'Jutro przed południem'];
const BUDZETY = ['do 8 tys.', '8–12 tys.', '12–20 tys.', 'powyżej 20 tys.'];

/**
 * @param {object|null} w  wycena (null przy zgłoszeniu bez wyceny — wtedy nic nie rysujemy)
 * @param {object} dane    { phone, email } z formularza bramki
 */
export function panelFeedbacku(w, dane) {
  if (!w?.ok) return null;

  const box = h('div', { class: 'feedback' });
  const wspolne = {
    telefon: dane.phone || '',
    email: dane.email || '',
  };

  const wyslij = (tresc) => {
    zdarzenie('feedback_wycena', { wybor: tresc.feedback, ...(tresc.budzet ? { budzet: tresc.budzet } : {}) });
    // W tle i bez fanfar: odpowiedź klienta nie może zależeć od kondycji sieci.
    wyslijFeedback({ ...wspolne, ...tresc });
  };

  box.append(
    h('div', { class: 'feedback-pyt' }, 'Co Pan/Pani sądzi o tej wycenie?'),
    h(
      'div',
      { class: 'feedback-przyciski' },
      przycisk('👍', 'Pasuje mi — proszę o kontakt', () => {
        wyslij({ feedback: 'pasuje' });
        box.replaceChildren(krokPory(wspolne, box));
      }),
      przycisk('💰', 'Cena za wysoka', () => {
        wyslij({ feedback: 'za_drogo' });
        box.replaceChildren(krokZaDrogo(w, wspolne, box));
      }),
      przycisk('🤔', 'Muszę się zastanowić', () => {
        wyslij({ feedback: 'zastanowi' });
        box.replaceChildren(
          podziekowanie(
            'Nic nie ucieka. ',
            `Wycena jest już w Pana/Pani skrzynce (${wspolne.email}) i pozostaje ważna 30 dni. ` +
              'W razie pytań: 796 991 128.'
          )
        );
      })
    )
  );
  return box;
}

/* ─────────────────────────────── „pasuje mi": pora kontaktu jednym dotknięciem */

function krokPory(wspolne, box) {
  return h(
    'div',
    { class: 'feedback-krok' },
    h('div', { class: 'feedback-pyt' }, 'Świetnie! Kiedy najlepiej zadzwonić?'),
    h(
      'div',
      { class: 'feedback-przyciski' },
      ...PORY.map((pora) =>
        przycisk(null, pora, () => {
          wyslijFeedback({ ...wspolne, feedback: 'pasuje', pora });
          zdarzenie('feedback_pora', { pora });
          box.replaceChildren(
            podziekowanie('Dziękujemy! ', `Oddzwonimy pod ${wspolne.telefon} (${pora.toLowerCase()}).`)
          );
        })
      )
    ),
    h('p', { class: 'feedback-nota' }, `Zadzwonimy pod numer z formularza: ${wspolne.telefon}.`)
  );
}

/* ────────────────── „za drogo": tańsza propozycja + pytanie o budżet (opcjonalne) */

function krokZaDrogo(w, wspolne, box) {
  const czesci = [];

  // Wersja PROSTA tańszej alternatywy: jedna propozycja i strzałka w dół —
  // pełny blok z przeliczeniem „na ten wzór" już wisi pod kartą wyceny.
  const [naj] = szukajTanszych(w, 1);
  if (naj) {
    czesci.push(
      h(
        'div',
        { class: 'feedback-alt' },
        h('b', {}, `Podobny efekt od ${zl(naj.wycena.widelki.od)}`),
        ` — ${naj.wycena.firma.nazwa} · ${naj.wycena.dekor}. `,
        h(
          'button',
          {
            class: 'link-btn',
            type: 'button',
            onclick: (e) => {
              const alt = e.currentTarget.closest('.bramka, .bramka-ok')?.parentElement || document;
              const blok = alt.querySelector('.alternatywy') || document.querySelector('.alternatywy');
              blok?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            },
          },
          'Przeliczyć? ↓'
        )
      )
    );
  } else {
    czesci.push(
      h(
        'div',
        { class: 'feedback-alt' },
        `Rozumiemy. To już najkorzystniejsza opcja w tym rodzaju kamienia ` +
          `(${nazwaRodzaju(rodzajMaterialu(w.firma))}) — ale przy pomiarze często ` +
          'znajdujemy oszczędności w układzie płyt.'
      )
    );
  }

  czesci.push(
    h('div', { class: 'feedback-pyt' }, 'Jaki budżet Pan/Pani zakładał(a)? (niewymagane)'),
    h(
      'div',
      { class: 'feedback-przyciski' },
      ...BUDZETY.map((budzet) =>
        przycisk(null, budzet, () => {
          wyslijFeedback({ ...wspolne, feedback: 'za_drogo', budzet });
          zdarzenie('feedback_budzet', { budzet });
          box.replaceChildren(
            podziekowanie('Dziękujemy! ', 'Ta informacja pomaga nam dobrać materiał do budżetu.')
          );
        })
      )
    )
  );

  return h('div', { class: 'feedback-krok' }, ...czesci);
}

/* ──────────────────────────────────────────────────────────── drobiazgi */

function przycisk(ikona, tekst, onclick) {
  return h(
    'button',
    { class: 'feedback-btn', type: 'button', onclick },
    ikona ? h('span', { class: 'feedback-ikona', 'aria-hidden': 'true' }, ikona) : null,
    tekst
  );
}

function podziekowanie(mocne, reszta) {
  return h(
    'div',
    { class: 'feedback-dzieki' },
    h('span', { class: 'ptak' }, '✓'),
    h('span', {}, h('b', {}, mocne), reszta)
  );
}

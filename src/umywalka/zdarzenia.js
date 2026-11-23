/**
 * ZDARZENIA GA4 UMYWALKI — osobny lejek, cienka nakładka.
 *
 * Umywalka ma WŁASNE zdarzenia (`umywalka_*`) i celowo nie woła
 * `konwersjaLead()` ani `lead_wyslany`. Powód jest prosty: lejek blatów
 * jest mierzony od miesięcy i służy do decyzji o reklamach. Gdyby umywalki
 * wpadały do tych samych zdarzeń, każda zmiana w nich wyglądałaby jak
 * zmiana skuteczności kalkulatora blatów — a nie byłaby nią.
 *
 * Czy `umywalka_lead` ma zostać konwersją w Google Ads, zdecyduje Dawid
 * po pierwszych tygodniach (specyfikacja §11.1).
 */
import { zdarzenie } from '../analytics/zdarzenia.js';

let juzStartowalo = false;

/** Pierwsze dotknięcie konfiguratora — raz na wizytę. */
export function start(typ) {
  if (juzStartowalo) return;
  juzStartowalo = true;
  zdarzenie('umywalka_start', { typ: String(typ || '') });
}

/** Wejście na krok 2/3/4 (krok 1 to wejście na stronę). */
export function krok(numer) {
  if (numer <= 1) return;
  zdarzenie('umywalka_krok', { krok: numer });
}

/** Pokazanie formularza — moment, w którym wiemy, ile kosztuje konfiguracja. */
export function formularz(kwota) {
  zdarzenie('umywalka_formularz', { value: Math.round(kwota || 0), currency: 'PLN' });
}

/** Udane wysłanie zgłoszenia. `polowka` mówi, czy zmieścił się w połówce płyty. */
export function lead(kwota, polowka) {
  zdarzenie('umywalka_lead', {
    value: Math.round(kwota || 0),
    currency: 'PLN',
    polowka: polowka ? 'tak' : 'nie',
  });
}

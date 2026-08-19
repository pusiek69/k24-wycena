/**
 * SKĄD PRZYSZEDŁ KLIENT
 *
 * Do bazy klientów leci jedno z trzech: 'ads', 'organiczne' albo 'nieznane'.
 * Służy to wyłącznie ocenie, czy kampania Google Ads się zwraca — nie
 * budujemy profilu klienta i nie przekazujemy tego nikomu dalej.
 *
 * ZGODA JEST WARUNKIEM. Identyfikator kliknięcia w reklamę (gclid) i znaczniki
 * UTM to dane marketingowe. Jeśli klient wybrał „tylko niezbędne" albo nie
 * odpowiedział jeszcze na baner, zapisujemy „nieznane" i tyle — żadnego
 * odtwarzania źródła z adresu odsyłającego na boku.
 *
 * Znaczniki zbieramy przy PIERWSZYM wejściu i trzymamy w sessionStorage:
 * klient klika reklamę, czyta trzy podstrony i dopiero potem wypełnia
 * formularz — bez tego gclid zgubiłby się po pierwszym przejściu.
 */

import { zgodaMarketingowa } from '../analytics/zgody.js';

const KLUCZ = 'k24h-zrodlo';

const POLA_UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

/**
 * Wywoływane raz na wejściu. Zapamiętuje znaczniki z adresu, jeśli jakieś
 * są — niezależnie od zgody, bo to sessionStorage, znika z kartą przeglądarki
 * i nigdzie nie wychodzi. Decyzja, czy je wysłać, zapada dopiero w zrodloLeada().
 */
export function zapamietajZrodlo() {
  try {
    const parametry = new URLSearchParams(location.search);
    const zebrane = {};
    const gclid = parametry.get('gclid') || parametry.get('wbraid') || parametry.get('gbraid');
    if (gclid) zebrane.gclid = gclid.slice(0, 120);
    for (const pole of POLA_UTM) {
      const wartosc = parametry.get(pole);
      if (wartosc) zebrane[pole] = wartosc.slice(0, 120);
    }
    // Pierwsze wejście w tej sesji zapisuje też skąd klient przyszedł.
    if (!sessionStorage.getItem(KLUCZ)) {
      const skad = document.referrer || '';
      if (skad && !skad.includes(location.host)) zebrane.referrer = new URL(skad).hostname;
      sessionStorage.setItem(KLUCZ, JSON.stringify(zebrane));
    } else if (Object.keys(zebrane).length) {
      // Kolejne wejście z reklamy nadpisuje — liczy się ostatnie kliknięcie.
      sessionStorage.setItem(KLUCZ, JSON.stringify(zebrane));
    }
  } catch {
    /* prywatne okno bez storage — trudno, zostanie „nieznane" */
  }
}

/** Co dokleić do zgłoszenia wysyłanego do workera. */
export function zrodloLeada() {
  if (!zgodaMarketingowa()) return { typ: 'nieznane' };
  let zebrane = {};
  try {
    zebrane = JSON.parse(sessionStorage.getItem(KLUCZ) || '{}') || {};
  } catch {
    zebrane = {};
  }

  const zReklamy = Boolean(zebrane.gclid) || /(^|\W)(cpc|ppc|paid)/i.test(zebrane.utm_medium || '');
  return { typ: zReklamy ? 'ads' : 'organiczne', ...zebrane };
}

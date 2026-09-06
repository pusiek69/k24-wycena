/**
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  TU DAWID WKLEJA IDENTYFIKATORY Z GOOGLE I FACEBOOKA                │
 * │                                                                     │
 * │  Dopóki pole jest puste ('') — dany skrypt SIĘ NIE WCZYTUJE.        │
 * │  Strona działa bez nich normalnie i nie zostawia żadnych ciasteczek.│
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Skąd wziąć numery:
 *   ga4              → analytics.google.com → Administracja → Strumienie danych
 *                      → identyfikator „G-XXXXXXXXXX"
 *   googleAds        → ads.google.com → Narzędzia → Tag Google → „AW-XXXXXXXXXX"
 *   konwersjaLead    → Ads → Cele → Konwersje → nowa konwersja „Wysłanie formularza"
 *                      → etykieta w formacie „AW-XXXXXXXXXX/AbCdEfGhIjK"
 *   konwersjaTelefon → jak wyżej, konwersja „Kliknięcie w numer telefonu"
 *   metaPixel        → business.facebook.com → Menedżer zdarzeń → identyfikator piksela
 *
 * Po wklejeniu: `npm test`, potem `git push` — Netlify zbuduje samo.
 * Workera to NIE dotyczy (pomiar jest wyłącznie po stronie przeglądarki).
 *
 * Sprawdzenie, czy działa: wejść na kam24h.pl, policzyć wycenę i w konsoli
 * wpisać `dataLayer.filter(x => x[0] === 'event')` — muszą tam być
 * `wycena_gotowa`, `bramka_pokazana` i `lead_wyslany`.
 */
export const POMIAR = {
  // ⚠ GA4 — DO WKLEJENIA. Dopóki jest puste, NIE MA ŻADNEJ statystyki ruchu:
  //    nie widać ani ilu ludzi weszło, ani gdzie odpadli w lejku. Google Ads
  //    (niżej) zbiera tylko konwersje, nie odsłony.
  ga4: '',

  googleAds: 'AW-18396227572',

  // Etykiety konwersji z Google Ads — format „AW-XXXXXXXXXX/AbCdEfGhIjK".
  // Bez nich Ads dostaje zdarzenie `lead_wyslany`, ale nie liczy go jako
  // konwersji, więc kampania nie ma się na czym uczyć.
  konwersjaLead: '',
  konwersjaTelefon: '',

  // ⚠ Piksel Meta — DO WKLEJENIA. Same cyfry, np. '1234567890123456'.
  //   Ładuje się dopiero po pełnej zgodzie na ciasteczka (Meta nie ma
  //   odpowiednika Consent Mode), i wtedy dostaje `Lead` przy wysyłce.
  metaPixel: '',
};

/** Adres docelowy strony — używany w meta tagach i mapie witryny. */
export const DOMENA = 'https://kam24h.pl';

/** Czy cokolwiek jest skonfigurowane (jeśli nie — nie pokazujemy banera zgód). */
export function pomiarWlaczony() {
  return Boolean(POMIAR.ga4 || POMIAR.googleAds || POMIAR.metaPixel);
}

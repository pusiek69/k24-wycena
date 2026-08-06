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
 * Po wklejeniu: npm run build i wrzucamy na Netlify. Nic więcej.
 */
export const POMIAR = {
  ga4: '',
  googleAds: '',
  konwersjaLead: '',
  konwersjaTelefon: '',
  metaPixel: '',
};

/** Adres docelowy strony — używany w meta tagach i mapie witryny. */
export const DOMENA = 'https://kam24h.pl';

/** Czy cokolwiek jest skonfigurowane (jeśli nie — nie pokazujemy banera zgód). */
export function pomiarWlaczony() {
  return Boolean(POMIAR.ga4 || POMIAR.googleAds || POMIAR.metaPixel);
}

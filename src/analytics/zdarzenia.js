import { POMIAR } from './config.js';
import { gtag } from './zgody.js';

/**
 * ZDARZENIA — to, po czym Google Ads i Facebook uczą się, kogo szukać.
 *
 * Lejek, który mierzymy:
 *   wycena_start      klient wybrał materiał (wszedł w kreator)
 *   wycena_dekor      wybrał dekor
 *   wycena_gotowa     zobaczył kwotę            ← mikrokonwersja
 *   formularz_otwarty kliknął „umów pomiar"
 *   lead_wyslany      wysłał formularz          ← KONWERSJA GŁÓWNA
 *   klik_telefon      kliknął w numer           ← KONWERSJA (na komórce)
 *
 * Jeśli nic nie jest skonfigurowane w config.js — funkcje po prostu nic nie robią.
 */

export function zdarzenie(nazwa, dane = {}) {
  try {
    if (window.dataLayer) gtag('event', nazwa, dane);
    if (window.fbq) window.fbq('trackCustom', nazwa, dane);
  } catch {
    /* pomiar nigdy nie może zepsuć strony */
  }
}

/** Klient zobaczył wycenę — mikrokonwersja, dobra do optymalizacji kampanii. */
export function zdarzenieWycena(w) {
  zdarzenie('wycena_gotowa', {
    currency: 'PLN',
    value: Math.round(w.razemZaokr || 0),
    material: w.firma?.nazwa,
    dekor: w.dekor || '(kamień naturalny)',
    metry_biezace: Math.round((w.pak?.mb || 0) * 10) / 10,
  });
  try {
    if (window.fbq) {
      window.fbq('track', 'ViewContent', {
        content_name: `${w.firma?.nazwa || ''} ${w.dekor || ''}`.trim(),
        currency: 'PLN',
        value: Math.round(w.razemZaokr || 0),
      });
    }
  } catch {
    /* nic */
  }
}

/** Kliknięcie w numer telefonu — na komórce to najczęstsza konwersja. */
export function zdarzenieTelefon(skad = 'nieznane') {
  zdarzenie('klik_telefon', { miejsce: skad });
  try {
    if (POMIAR.konwersjaTelefon) gtag('event', 'conversion', { send_to: POMIAR.konwersjaTelefon });
    if (window.fbq) window.fbq('track', 'Contact', { miejsce: skad });
  } catch {
    /* nic */
  }
}

/**
 * Wysłany formularz — KONWERSJA GŁÓWNA.
 * Odpalana na stronie „dziękujemy", żeby liczyła się tylko realnie wysłane leady.
 */
export function konwersjaLead(wartosc = 0) {
  zdarzenie('lead_wyslany', { currency: 'PLN', value: Math.round(wartosc) });
  try {
    if (POMIAR.konwersjaLead) {
      gtag('event', 'conversion', {
        send_to: POMIAR.konwersjaLead,
        value: Math.round(wartosc),
        currency: 'PLN',
      });
    }
    if (window.fbq) window.fbq('track', 'Lead', { currency: 'PLN', value: Math.round(wartosc) });
  } catch {
    /* nic */
  }
}

/** Podpina zliczanie kliknięć we wszystkie numery telefonu na stronie. */
export function sledzTelefony(korzen = document) {
  korzen.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="tel:"]');
    if (!a) return;
    zdarzenieTelefon(a.dataset.miejsce || (a.closest('footer') ? 'stopka' : 'naglowek'));
  });
}

import { POMIAR, pomiarWlaczony } from './config.js';

/**
 * ZGODY NA CIASTECZKA (Consent Mode v2)
 *
 * Zasada: dopóki klient nie kliknie „Akceptuję", Google i Meta NIE dostają
 * żadnych danych o nim. Consent Mode v2 to wymóg Google dla reklam
 * kierowanych do Europy — bez niego kampanie tracą dane o konwersjach,
 * a docelowo mogą zostać ograniczone.
 *
 * Co robimy:
 *   1. Zanim cokolwiek się wczyta — ustawiamy domyślnie WSZYSTKO ZABRONIONE.
 *   2. Pokazujemy baner z realnym wyborem (zgoda / tylko niezbędne).
 *   3. Po zgodzie: aktualizujemy Consent Mode i dopiero wtedy ładujemy piksele.
 *   4. Wybór pamiętamy 12 miesięcy; da się go zmienić linkiem w stopce.
 */

const KLUCZ = 'k24h-zgody';
const WAZNOSC_DNI = 365;

const ZABRONIONE = {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied',
};

const DOZWOLONE = {
  ad_storage: 'granted',
  ad_user_data: 'granted',
  ad_personalization: 'granted',
  analytics_storage: 'granted',
};

let zaladowane = false;

export function gtag() {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(arguments);
}

/** Uruchamiane na każdej podstronie, najwcześniej jak się da. */
export function inicjujZgody() {
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || gtag;

  // Domyślnie: nic nie wolno. Musi być PRZED wczytaniem gtag.js.
  gtag('consent', 'default', {
    ...ZABRONIONE,
    functionality_storage: 'granted',
    security_storage: 'granted',
    wait_for_update: 500,
  });
  gtag('set', 'ads_data_redaction', true);
  gtag('set', 'url_passthrough', true);

  if (!pomiarWlaczony()) return; // nic nie skonfigurowane — brak banera, brak ciasteczek

  const zapisana = odczytajWybor();
  if (zapisana === 'wszystkie') {
    gtag('consent', 'update', DOZWOLONE);
    zaladujSkrypty();
  } else if (zapisana === 'niezbedne') {
    zaladujSkrypty(); // GA4 działa w trybie bez ciasteczek (dane zagregowane)
  } else {
    pokazBaner();
  }
}

function odczytajWybor() {
  try {
    const s = JSON.parse(localStorage.getItem(KLUCZ) || 'null');
    if (!s?.wybor || !s?.data) return null;
    const dni = (Date.now() - new Date(s.data).getTime()) / 86400000;
    return dni > WAZNOSC_DNI ? null : s.wybor;
  } catch {
    return null;
  }
}

function zapiszWybor(wybor) {
  try {
    localStorage.setItem(KLUCZ, JSON.stringify({ wybor, data: new Date().toISOString() }));
  } catch {
    /* tryb prywatny — trudno, zapytamy ponownie */
  }
}

/** Wywoływane z linku „Ustawienia cookies" w stopce. */
export function zmienZgody() {
  try {
    localStorage.removeItem(KLUCZ);
  } catch {
    /* nic */
  }
  pokazBaner();
}

/* ---------------------------------------------------------------- baner */

function pokazBaner() {
  if (document.getElementById('zgody')) return;

  const baner = document.createElement('div');
  baner.id = 'zgody';
  baner.className = 'zgody';
  baner.setAttribute('role', 'dialog');
  baner.setAttribute('aria-label', 'Zgoda na pliki cookies');
  baner.innerHTML = `
    <div class="zgody-tresc">
      <strong>Ciasteczka</strong>
      <p>Używamy plików cookies, żeby wiedzieć, które reklamy realnie przynoszą
      telefony od klientów. Bez Twojej zgody nie wysyłamy nic do Google ani Facebooka.
      Szczegóły w <a href="/polityka-prywatnosci.html">polityce prywatności</a>.</p>
    </div>
    <div class="zgody-akcje">
      <button type="button" class="btn ghost" data-wybor="niezbedne">Tylko niezbędne</button>
      <button type="button" class="btn" data-wybor="wszystkie">Akceptuję</button>
    </div>`;

  baner.addEventListener('click', (e) => {
    const wybor = e.target.closest('[data-wybor]')?.dataset.wybor;
    if (!wybor) return;
    zapiszWybor(wybor);
    if (wybor === 'wszystkie') gtag('consent', 'update', DOZWOLONE);
    zaladujSkrypty();
    baner.remove();
  });

  document.body.appendChild(baner);
}

/* ------------------------------------------------------- ładowanie tagów */

function zaladujSkrypty() {
  if (zaladowane) return;
  zaladowane = true;

  const idGoogle = POMIAR.ga4 || POMIAR.googleAds;
  if (idGoogle) {
    wstawSkrypt(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(idGoogle)}`);
    gtag('js', new Date());
    if (POMIAR.ga4) gtag('config', POMIAR.ga4, { anonymize_ip: true });
    if (POMIAR.googleAds) gtag('config', POMIAR.googleAds);
  }

  // Meta Pixel ładujemy dopiero po zgodzie — nie ma odpowiednika Consent Mode.
  if (POMIAR.metaPixel && odczytajWybor() === 'wszystkie') {
    zaladujMeta(POMIAR.metaPixel);
  }
}

function wstawSkrypt(src) {
  const s = document.createElement('script');
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

function zaladujMeta(id) {
  /* eslint-disable */
  !(function (f, b, e, v, n, t, s) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = '2.0';
    n.queue = [];
    t = b.createElement(e);
    t.async = true;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */
  window.fbq('init', id);
  window.fbq('track', 'PageView');
}

export function zgodaMarketingowa() {
  return odczytajWybor() === 'wszystkie';
}

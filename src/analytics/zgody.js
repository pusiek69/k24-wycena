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
 *   1. Domyślne zgody (wszystko zabronione) ustawia wstawka w <head>
 *      każdej strony — musi tam być, zanim wystartuje gtag.js.
 *   2. Pokazujemy baner z realnym wyborem (zgoda / tylko niezbędne).
 *   3. Po zgodzie: aktualizujemy Consent Mode i dopiero wtedy ładujemy piksele.
 *   4. Wybór pamiętamy 12 miesięcy; da się go zmienić linkiem w stopce.
 */

const KLUCZ = 'k24h-zgody';
const WAZNOSC_DNI = 365;

const DOZWOLONE = {
  ad_storage: 'granted',
  ad_user_data: 'granted',
  ad_personalization: 'granted',
  analytics_storage: 'granted',
};

let zaladowane = false;
let ga4Wlaczone = false;

export function gtag() {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(arguments);
}

/** Uruchamiane na każdej podstronie, najwcześniej jak się da. */
export function inicjujZgody() {
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || gtag;

  /*
   * Domyślne zgody (wszystko zabronione) ustawia wstawka w <head> KAŻDEJ
   * strony — razem z wczytaniem gtag.js dla Google Ads. Tak wymaga Consent
   * Mode v2: ustawienie domyślne musi istnieć, zanim tag wystartuje, a tag
   * ma startować od razu, żeby Ads dostał choćby bezciasteczkowy sygnał.
   *
   * Tutaj zostaje więc tylko to, co dzieje się PÓŹNIEJ: baner, aktualizacja
   * zgody po wyborze klienta i skrypty, które nie mają Consent Mode (Meta).
   * Nie ustawiamy defaultów drugi raz i nie ładujemy gtag.js ponownie —
   * dwa razy ten sam tag to podwójne odsłony w statystykach.
   */

  if (!pomiarWlaczony()) return; // nic nie skonfigurowane — brak banera, brak ciasteczek

  /*
   * ⚠ GA4 WŁĄCZAMY OD RAZU, jeszcze przed decyzją klienta.
   *
   * To nie jest obejście zgody — dokładnie o to chodzi w Consent Mode v2:
   * wstawka w <head> ustawia `analytics_storage: 'denied'` ZANIM tag
   * wystartuje, więc do kliknięcia „Akceptuję" GA4 nie zapisuje żadnego
   * ciasteczka ani identyfikatora, a wysyła tylko zagregowany ping.
   *
   * Do 06.09.2026 GA4 konfigurowało się dopiero w `zaladujSkrypty()`, czyli
   * PO kliknięciu w baner. Kto banera nie dotknął — a to większość ruchu —
   * nie istniał w statystykach wcale. Wyszło to przy diagnozie ciszy
   * w leadach (05–06.09): nie dało się odróżnić „nikt nie wchodzi" od
   * „wchodzą i nie wysyłają", bo danych po prostu nie było.
   */
  wlaczGa4();

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

/**
 * Czy klient zgodził się na marketing. Pyta o to app/zrodlo.js, zanim
 * dołoży do zgłoszenia identyfikator kliknięcia w reklamę — format zapisu
 * zgody ma być znany w JEDNYM miejscu, tutaj.
 */
export function zgodaMarketingowa() {
  return odczytajWybor() === 'wszystkie';
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
      Szczegóły w <a href="/polityka-prywatnosci">polityce prywatności</a>.</p>
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

  // GA4 chodzi już od `inicjujZgody()` — po zgodzie Consent Mode sam
  // przełącza je z pingu bezciasteczkowego na pełny pomiar. Drugi
  // `gtag('config')` zrobiłby z tego podwójne odsłony, więc go tu nie ma.

  // Meta Pixel ładujemy dopiero po zgodzie — nie ma odpowiednika Consent Mode.
  if (POMIAR.metaPixel && odczytajWybor() === 'wszystkie') {
    zaladujMeta(POMIAR.metaPixel);
  }
}

/**
 * GA4 — jeden raz na stronę, niezależnie od banera.
 *
 * gtag.js jest już wczytany ze wstawki w <head> (razem z Google Ads),
 * więc dokładamy tylko drugi cel do tego samego tagu.
 */
function wlaczGa4() {
  if (ga4Wlaczone || !POMIAR.ga4) return;
  ga4Wlaczone = true;
  gtag('config', POMIAR.ga4, { anonymize_ip: true });
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

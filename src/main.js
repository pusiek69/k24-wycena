import './style.css';
import { h } from './app/dom.js';
import { uruchomCzat } from './app/czat.js';
import { uruchom as uruchomKreator } from './app/wizard.js';
import { FIRMY } from './firms/index.js';
import { inicjujZgody, zmienZgody } from './analytics/zgody.js';
import { sledzTelefony, zdarzenie } from './analytics/zdarzenia.js';
import { zapamietajZrodlo } from './app/zrodlo.js';
import { paczkaPowtorki, uruchomOferteDawida } from './app/oferta-dawida.js';
import { gotoweStawki } from './app/stawki-klient.js';
import { pobierzPlyty, zaladowane } from './app/wyprzedaz-dane.js';
import { doPokazania, kluczDekoru } from './app/wyprzedaz.js';

// Zgody ustawiamy najwcześniej — zanim cokolwiek zdąży się wczytać.
inicjujZgody();
sledzTelefony();
// Znaczniki kampanii z adresu — do oceny, czy reklama się zwraca.
zapamietajZrodlo();

document.getElementById('cookies')?.addEventListener('click', (e) => {
  e.preventDefault();
  zmienZgody();
});

const root = document.getElementById('kreator');

/**
 * Przyklejony przycisk „Wyceń swój blat" — tylko telefon (resztę załatwia CSS).
 *
 * Pokazuje się dopiero wtedy, gdy kalkulator zjedzie z ekranu. Klient, który
 * przewinął do zdjęć albo do stopki, ma jedno kliknięcie z powrotem do wyceny,
 * ale nikomu nie zasłania tego, do czego prowadzi.
 */
function przyklejonyPrzycisk() {
  const cta = document.querySelector('.cta-mobil');
  if (!cta || !root || !('IntersectionObserver' in window)) return;

  const obserwator = new IntersectionObserver(
    ([wpis]) => {
      cta.hidden = wpis.isIntersecting;
    },
    { rootMargin: '-80px 0px -120px 0px' }
  );
  obserwator.observe(root);
}
przyklejonyPrzycisk();

/*
 * „Powtórz wycenę" z panelu Dawida: fragment #powtorz=… przełącza kalkulator
 * w tryb właściciela (edycja parametrów + rabaty + wysyłka oferty).
 * Zwykły klient nigdy tu nie trafia — fragment wymaga podpisanego linku
 * z panelu, a bez ważnego podpisu worker i tak odmówi wysyłki.
 */
// Stawki zakładu z panelu Dawida — nakładają się na konfiguracje firm,
// zanim ktokolwiek zdąży policzyć wycenę (rozmowa i tak trwa dłużej).
gotoweStawki();

/*
 * WYPRZEDAŻ PŁYT (zlecenie Dawida, 30.08.2026).
 *
 * Płyty pobieramy RAZ, zanim wystartuje kreator — kategoria „NATURA
 * WYPRZEDAŻ" musi być gotowa już przy pierwszym rysowaniu kroku
 * „Materiał", inaczej pojawiłaby się z opóźnieniem i przeskoczyła
 * klientowi pod kursorem.
 *
 * Gdy pobranie się nie uda (albo Dawid nic nie wystawił), lista jest
 * pusta i kategoria po prostu się nie pokazuje. Wyprzedaż jest dodatkiem —
 * jej awaria nie ma prawa zatrzymać kalkulatora.
 *
 * TRYB PODGLĄDU: link z panelu niesie fragment `#wyprzedazPodglad=…`.
 * Obsługuje go `wyprzedaz-dane.js` — dokłada JEDEN wskazany szkic,
 * z podpisem właściciela. Dalej wszystko idzie tym samym kodem, więc
 * Dawid widzi DOKŁADNIE to, co zobaczy klient po publikacji.
 */
const powtorka = paczkaPowtorki();
if (!FIRMY.length) {
  root.innerHTML =
    '<div class="card"><p class="q-title">Brak skonfigurowanych firm.</p>' +
    '<p class="q-hint">Dodaj plik do src/firms/ — patrz pricing/README.md.</p></div>';
} else if (powtorka) {
  uruchomOferteDawida(root, powtorka);
} else {
  pobierzPlyty().finally(() => {
    /*
     * Wejście prosto z konkretnej płyty: strona wyprzedaży linkuje do
     * `/#wyprzedaz=<klucz płyty>`. Numer idzie w ADRESIE, a nie w pamięci
     * przeglądarki, żeby link dało się wysłać klientowi i żeby działał
     * po otwarciu w nowej karcie.
     *
     * Gdy płyta zeszła między kliknięciem a wejściem tutaj, nie
     * udajemy, że nadal jest — kreator startuje normalnie, od materiału.
     */
    const zLinku = /^#wyprzedaz=(.+)$/.exec(location.hash);
    const plyta = zLinku
      ? doPokazania(zaladowane()).find((p) => kluczDekoru(p) === decodeURIComponent(zLinku[1]))
      : null;

    uruchomAplikacje(root);
    if (plyta) {
      zdarzenie('wyprzedaz_kreator', { plyta: plyta.nazwa });
      uruchomKreator(root.querySelector('.panel') || root, { plyta });
    }
  });
}

/**
 * Dwie drogi do tej samej wyceny:
 *   • rozmowa z konsultantem — domyślna, jak w poprzedniej wersji strony,
 *   • kreator w kilka pytań — dla tych, którzy wolą klikać niż pisać,
 *     i awaryjnie, gdy konsultant jest niedostępny (np. podgląd z dysku).
 */
function uruchomAplikacje(korzen) {
  const panel = h('div', { class: 'panel' });
  korzen.replaceChildren(panel);

  // Jedna ścieżka: rozmowa z wtopionym kreatorem. Klasyczny kreator
  // krok-po-kroku zostaje wyłącznie jako wyjście awaryjne, gdy konsultant
  // nie odpowiada — wtedy klient i tak policzy wycenę.
  uruchomCzat(panel, {
    pokazKreator: () => {
      zdarzenie('tryb_awaryjny_kreator');
      uruchomKreator(panel);
    },
  });
}

// Podpowiedź dla nas w konsoli — klient tego nie szuka, a nam ułatwia sprawdzenie,
// co jest wgrane. NIE wypisujemy tu niczego o rabatach ani cenach zakupowych.
if (import.meta.env?.DEV) {
  console.info(
    '%cK24H — wgrane firmy:',
    'color:#c9a86a',
    FIRMY.map((f) => `${f.nazwa} (${Object.keys(f.dekory || {}).length} dekorów)`)
  );
}

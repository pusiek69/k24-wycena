import './style.css';
import { h } from './app/dom.js';
import { uruchomCzat } from './app/czat.js';
import { uruchom as uruchomKreator } from './app/wizard.js';
import { FIRMY } from './firms/index.js';
import { inicjujZgody, zmienZgody } from './analytics/zgody.js';
import { sledzTelefony, zdarzenie } from './analytics/zdarzenia.js';

// Zgody ustawiamy najwcześniej — zanim cokolwiek zdąży się wczytać.
inicjujZgody();
sledzTelefony();

document.getElementById('cookies')?.addEventListener('click', (e) => {
  e.preventDefault();
  zmienZgody();
});

const root = document.getElementById('kreator');

if (!FIRMY.length) {
  root.innerHTML =
    '<div class="card"><p class="q-title">Brak skonfigurowanych firm.</p>' +
    '<p class="q-hint">Dodaj plik do src/firms/ — patrz pricing/README.md.</p></div>';
} else {
  uruchomAplikacje(root);
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

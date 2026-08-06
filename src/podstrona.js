/**
 * Wspólny skrypt stron treściowych (podstrony SEO, polityka, 404).
 * Kalkulatora tu nie ma — tylko style, zgody na cookies i mierzenie
 * kliknięć w telefon. Dzięki temu podstrony ważą kilkaset bajtów JS
 * i renderują się w całości bez JavaScriptu.
 */
import './style.css';
import { inicjujZgody, zmienZgody } from './analytics/zgody.js';
import { sledzTelefony } from './analytics/zdarzenia.js';

inicjujZgody();
sledzTelefony();

document.getElementById('cookies')?.addEventListener('click', (e) => {
  e.preventDefault();
  zmienZgody();
});

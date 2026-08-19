/**
 * Wspólny skrypt stron treściowych (podstrony SEO, polityka, 404).
 * Kalkulatora tu nie ma — tylko style, zgody na cookies i mierzenie
 * kliknięć w telefon. Dzięki temu podstrony ważą kilkaset bajtów JS
 * i renderują się w całości bez JavaScriptu.
 */
import './style.css';
import { inicjujZgody, zmienZgody } from './analytics/zgody.js';
import { sledzTelefony } from './analytics/zdarzenia.js';
import { zapamietajZrodlo } from './app/zrodlo.js';

inicjujZgody();
sledzTelefony();
// Klient często ląduje z reklamy na podstronie, a kalkulator otwiera potem.
zapamietajZrodlo();

document.getElementById('cookies')?.addEventListener('click', (e) => {
  e.preventDefault();
  zmienZgody();
});

/**
 * Podgląd zdjęcia w galerii realizacji.
 *
 * Kafel jest zwykłym odnośnikiem do pliku, więc bez JavaScriptu (i dla
 * robotów) galeria nadal działa — klik otwiera zdjęcie. Skrypt tylko
 * podmienia to na wygodniejszy podgląd bez opuszczania strony.
 */
function galeria() {
  const box = document.getElementById('lightbox');
  const siatka = document.querySelector('.galeria');
  if (!box || !siatka) return;

  const img = box.querySelector('img');
  const podpis = box.querySelector('figcaption');
  let wracaDo = null;

  const otworz = (a) => {
    img.src = a.dataset.duze || a.href;
    img.alt = a.querySelector('img')?.alt || '';
    podpis.textContent = a.dataset.podpis || '';
    box.hidden = false;
    document.body.style.overflow = 'hidden';
    wracaDo = a;
    box.querySelector('.lightbox-zamknij').focus();
  };

  const zamknij = () => {
    box.hidden = true;
    img.removeAttribute('src'); // żeby duże zdjęcie nie siedziało w pamięci
    document.body.style.overflow = '';
    wracaDo?.focus();
    wracaDo = null;
  };

  siatka.addEventListener('click', (e) => {
    const a = e.target.closest('.real-link');
    // Ctrl/Cmd/środkowy przycisk = klient chce otworzyć w nowej karcie.
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    otworz(a);
  });

  box.addEventListener('click', (e) => {
    if (e.target === box || e.target.closest('.lightbox-zamknij')) zamknij();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !box.hidden) zamknij();
  });
}

galeria();

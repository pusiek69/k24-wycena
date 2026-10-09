/**
 * Strzałki paska realizacji — czysta prezentacja.
 *
 * Audyt 09.10.2026: na desktopie pasek wygląda jak trzy przyklejone
 * zdjęcia — nic nie mówi, że w prawo jest ich więcej (systemowy pasek
 * przewijania łatwo przeoczyć, a kółko myszy nad poziomym paskiem nie
 * przewija go). Strzałki są dorysowywane TUTAJ, nie w HTML-u, żeby bez
 * JavaScriptu strona wyglądała dokładnie tak, jak dziś — przewijalny
 * pasek bez martwych przycisków.
 *
 * Na ekranie dotykowym strzałek nie dokładamy w ogóle: palec i tak
 * przewija naturalnie, a CSS pokazuje złoty wskaźnik przewinięcia.
 */
export function uzbrojPasekRealizacji() {
  const pasek = document.querySelector('.real-pasek');
  if (!pasek) return;
  // Dotyk = swipe; strzałki tylko tam, gdzie jest precyzyjny kursor.
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (pasek.scrollWidth <= pasek.clientWidth + 8) return;

  const otulina = document.createElement('div');
  otulina.className = 'real-otulina';
  pasek.parentNode.insertBefore(otulina, pasek);
  otulina.append(pasek);

  const strzalka = (kierunek) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'real-strzalka real-strzalka-' + (kierunek < 0 ? 'lewo' : 'prawo');
    b.setAttribute('aria-label', kierunek < 0 ? 'Poprzednie realizacje' : 'Następne realizacje');
    b.textContent = kierunek < 0 ? '←' : '→';
    b.addEventListener('click', () => {
      pasek.scrollBy({ left: kierunek * Math.round(pasek.clientWidth * 0.8), behavior: 'smooth' });
    });
    otulina.append(b);
    return b;
  };
  const lewa = strzalka(-1);
  const prawa = strzalka(1);

  // Strzałka bez dalszego ciągu jest wygaszona — klient widzi, że to koniec.
  const odswiez = () => {
    lewa.disabled = pasek.scrollLeft <= 4;
    prawa.disabled = pasek.scrollLeft + pasek.clientWidth >= pasek.scrollWidth - 4;
  };
  pasek.addEventListener('scroll', odswiez, { passive: true });
  window.addEventListener('resize', odswiez, { passive: true });
  odswiez();
}

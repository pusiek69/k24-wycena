/**
 * PODGLĄD WZORU KAMIENIA — jeden komponent dla obu kalkulatorów.
 *
 * Zgłoszenie Dawida (23.11.2026): „chcialbym zeby po najechaniu na kolor
 * kamienia mozna zobaczyc pełny obraz plyty bo w miniaturkach nic nie widac"
 * oraz „i tez zeby mozna bylo szybko przyblizyc".
 *
 * Trzy drogi do tego samego zdjęcia, zależnie od tego, czym klient klika:
 *   • MYSZ — najechanie na kafelek pokazuje dymek z całą płytą. Znika,
 *     gdy kursor zjedzie. Nic nie trzeba klikać.
 *   • KLAWIATURA — to samo na `focus`, bo inaczej podgląd byłby dostępny
 *     wyłącznie dla myszy.
 *   • DOTYK — lupka na kafelku albo przytrzymanie palca otwiera podgląd
 *     pełnoekranowy; zamyka tapnięcie w tło, Escape albo przycisk.
 *
 * W podglądzie pełnoekranowym można przybliżać: kółkiem myszy (w punkt
 * pod kursorem), kliknięciem, dwuklikiem/podwójnym tapnięciem i szczypaniem
 * dwoma palcami. Przy powiększeniu obraz przesuwa się przeciągnięciem.
 *
 * Zdjęcia są nasze (public/wzory), a to duże wczytuje się DOPIERO przy
 * pierwszym podglądzie — lista dekorów zostaje lekka.
 *
 * ⚠ To warstwa wyświetlania. Nie dotyka wyceny, bramki leadów ani zdarzeń.
 */
import './podglad-wzoru.css';
import { plikWzoru, maCalaPlyte } from '../generated/wzory-dekorow.js';

const ZOOM_MIN = 1;
const ZOOM_MAX = 6;
const PRZYTRZYMANIE_MS = 420;

/* ────────────────────────────────────────────── dymek przy kafelku */

let dymek = null;
let dymekDla = null;

function schowajDymek() {
  dymek?.remove();
  dymek = null;
  dymekDla = null;
}

function pokazDymek(element, { marka, dekor }) {
  // CAŁA PŁYTA, nie wycinek — po to klient tu najeżdża.
  const plik = plikWzoru(marka, dekor, 'slab');
  if (!plik || dymekDla === element) return;
  schowajDymek();
  dymekDla = element;

  dymek = document.createElement('div');
  dymek.className = 'wzor-dymek';
  dymek.innerHTML =
    `<img src="${plik}" alt="" loading="lazy">` +
    `<div class="wzor-dymek-stopka"><b>${dekor}</b><span>${maCalaPlyte(marka, dekor) ? 'cała płyta · kliknij, żeby przybliżyć' : 'kliknij, żeby przybliżyć'}</span></div>`;
  document.body.appendChild(dymek);

  // Dymek ustawiamy przy kafelku, ale nigdy poza ekranem — na wąskim
  // oknie przeskakuje na drugą stronę albo pod spód.
  const r = element.getBoundingClientRect();
  const sz = Math.min(340, window.innerWidth - 24);
  dymek.style.width = `${sz}px`;
  const poPrawej = r.right + 12 + sz < window.innerWidth;
  dymek.style.left = `${poPrawej ? r.right + 12 : Math.max(12, r.left - sz - 12)}px`;
  const wys = dymek.offsetHeight || 300;
  dymek.style.top = `${Math.max(12, Math.min(window.innerHeight - wys - 12, r.top))}px`;
  requestAnimationFrame(() => dymek?.classList.add('widoczny'));
}

/* ────────────────────────────────────────────── podgląd pełnoekranowy */

let okno = null;

export function zamknijPodglad() {
  okno?.remove();
  okno = null;
  document.documentElement.classList.remove('wzor-blokada');
}

/**
 * Pełnoekranowy podgląd płyty z przybliżaniem.
 * @param {{marka:string, dekor:string, marka_nazwa?:string}} p
 */
export function otworzPodglad({ marka, dekor, nazwaMarki }) {
  const plik = plikWzoru(marka, dekor, 'slab');
  if (!plik) return;
  zamknijPodglad();
  schowajDymek();

  okno = document.createElement('div');
  okno.className = 'wzor-okno';
  okno.setAttribute('role', 'dialog');
  okno.setAttribute('aria-modal', 'true');
  okno.setAttribute('aria-label', `Wzór kamienia: ${dekor}`);
  okno.innerHTML =
    `<div class="wzor-okno-pasek">` +
    `<div><b>${dekor}</b>${nazwaMarki ? `<span>${nazwaMarki}</span>` : ''}</div>` +
    `<button class="wzor-zamknij" type="button" aria-label="Zamknij podgląd">✕</button>` +
    `</div>` +
    `<div class="wzor-plyta"><img src="${plik}" alt="Cała płyta ${dekor}" draggable="false"></div>` +
    `<p class="wzor-wskazowka">Przybliż kółkiem, kliknięciem albo dwoma palcami · zamknij tapnięciem w tło</p>`;
  document.body.appendChild(okno);
  document.documentElement.classList.add('wzor-blokada');

  const ramka = okno.querySelector('.wzor-plyta');
  const obraz = ramka.querySelector('img');
  podlaczZoom(ramka, obraz);

  okno.querySelector('.wzor-zamknij').addEventListener('click', zamknijPodglad);
  okno.addEventListener('pointerdown', (e) => {
    // Tapnięcie w tło zamyka; w samo zdjęcie — przybliża (niżej).
    if (e.target === okno || e.target.classList.contains('wzor-wskazowka')) zamknijPodglad();
  });
  requestAnimationFrame(() => okno?.classList.add('widoczne'));
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') zamknijPodglad();
});

/* ────────────────────────────────────────────── przybliżanie */

/**
 * Przybliżanie i przesuwanie zdjęcia.
 *
 * Wszystko na jednym `transform`, bez przeładowań — zdjęcie ma 640 px
 * boku i jest w pamięci, więc powiększenie jest natychmiastowe.
 */
function podlaczZoom(ramka, obraz) {
  let skala = 1;
  let x = 0;
  let y = 0;
  const wskazniki = new Map();
  let startSzczypania = null;
  let ciagniecie = null;
  let ostatnieTapniecie = 0;

  const zastosuj = () => {
    const r = ramka.getBoundingClientRect();
    // Nie pozwalamy wyciągnąć zdjęcia poza kadr — inaczej klient gubi wzór
    // i nie wie, jak wrócić.
    const zapasX = Math.max(0, (r.width * skala - r.width) / 2);
    const zapasY = Math.max(0, (r.height * skala - r.height) / 2);
    x = Math.max(-zapasX, Math.min(zapasX, x));
    y = Math.max(-zapasY, Math.min(zapasY, y));
    obraz.style.transform = `translate(${x}px, ${y}px) scale(${skala})`;
    ramka.classList.toggle('przyblizone', skala > 1.02);
  };

  /** Przybliżenie w konkretny punkt — tam, gdzie klient patrzy. */
  const przybliz = (nowa, punkt) => {
    const poprzednia = skala;
    skala = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, nowa));
    if (punkt) {
      const r = ramka.getBoundingClientRect();
      const dx = punkt.x - (r.left + r.width / 2);
      const dy = punkt.y - (r.top + r.height / 2);
      const k = skala / poprzednia;
      x = (x - dx) * k + dx;
      y = (y - dy) * k + dy;
    }
    if (skala <= 1.001) {
      x = 0;
      y = 0;
    }
    zastosuj();
  };

  ramka.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      przybliz(skala * (e.deltaY < 0 ? 1.22 : 1 / 1.22), { x: e.clientX, y: e.clientY });
    },
    { passive: false }
  );

  ramka.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    wskazniki.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try {
      ramka.setPointerCapture(e.pointerId);
    } catch {
      /* starsze przeglądarki */
    }

    if (wskazniki.size === 2) {
      const [a, b] = [...wskazniki.values()];
      startSzczypania = { odleglosc: Math.hypot(a.x - b.x, a.y - b.y), skala };
      ciagniecie = null;
      return;
    }
    ciagniecie = { x: e.clientX, y: e.clientY, odX: x, odY: y, ruszony: false };
  });

  ramka.addEventListener('pointermove', (e) => {
    if (!wskazniki.has(e.pointerId)) return;
    wskazniki.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (wskazniki.size === 2 && startSzczypania) {
      const [a, b] = [...wskazniki.values()];
      const teraz = Math.hypot(a.x - b.x, a.y - b.y);
      przybliz(startSzczypania.skala * (teraz / startSzczypania.odleglosc), {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
      });
      return;
    }

    if (ciagniecie && skala > 1.02) {
      x = ciagniecie.odX + (e.clientX - ciagniecie.x);
      y = ciagniecie.odY + (e.clientY - ciagniecie.y);
      ciagniecie.ruszony = true;
      zastosuj();
    }
  });

  const koniec = (e) => {
    wskazniki.delete(e.pointerId);
    if (wskazniki.size < 2) startSzczypania = null;

    // Kliknięcie (bez przeciągania) przybliża o krok; drugie tapnięcie
    // w krótkim czasie wraca do całej płyty.
    if (ciagniecie && !ciagniecie.ruszony && wskazniki.size === 0) {
      const teraz = Date.now();
      const dwuklik = teraz - ostatnieTapniecie < 320;
      ostatnieTapniecie = teraz;
      if (dwuklik) przybliz(skala > 1.02 ? 1 : 3, { x: e.clientX, y: e.clientY });
      else przybliz(skala > 1.02 ? (skala > 3.5 ? 1 : skala * 1.7) : 2.2, { x: e.clientX, y: e.clientY });
    }
    ciagniecie = null;
  };
  ramka.addEventListener('pointerup', koniec);
  ramka.addEventListener('pointercancel', (e) => {
    wskazniki.delete(e.pointerId);
    ciagniecie = null;
    startSzczypania = null;
  });

  ramka.addEventListener('dblclick', (e) => e.preventDefault());
}

/* ────────────────────────────────────────────── podpinanie do kafelków */

/**
 * Podpina podgląd pod kafelek dekoru.
 *
 * @param {HTMLElement} element  kafelek (przycisk wyboru dekoru)
 * @param {{marka:string, dekor:string, nazwaMarki?:string}} dane
 */
export function podlaczPodglad(element, dane) {
  if (!plikWzoru(dane.marka, dane.dekor)) return false;
  element.classList.add('ma-wzor');

  const mysz = window.matchMedia?.('(hover: hover) and (pointer: fine)')?.matches;
  if (mysz) {
    element.addEventListener('mouseenter', () => pokazDymek(element, dane));
    element.addEventListener('mouseleave', schowajDymek);
    element.addEventListener('focus', () => pokazDymek(element, dane));
    element.addEventListener('blur', schowajDymek);
  }

  // Lupka: jedno dotknięcie otwiera pełny podgląd i NIE wybiera dekoru.
  const lupa = element.querySelector('.wzor-lupa');
  if (lupa) {
    const otworz = (e) => {
      e.preventDefault();
      e.stopPropagation();
      otworzPodglad(dane);
    };
    lupa.addEventListener('click', otworz);
    lupa.addEventListener('pointerdown', (e) => e.stopPropagation());
  }

  // Przytrzymanie palca na kafelku — druga droga do tego samego.
  let timer = null;
  let dlugie = false;
  element.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    dlugie = false;
    timer = setTimeout(() => {
      dlugie = true;
      otworzPodglad(dane);
    }, PRZYTRZYMANIE_MS);
  });
  const stop = () => clearTimeout(timer);
  element.addEventListener('pointerup', stop);
  element.addEventListener('pointercancel', stop);
  element.addEventListener('pointermove', stop);
  // Po przytrzymaniu nie wybieramy dekoru — klient chciał tylko zobaczyć.
  element.addEventListener(
    'click',
    (e) => {
      if (!dlugie) return;
      e.preventDefault();
      e.stopPropagation();
      dlugie = false;
    },
    true
  );

  return true;
}

/**
 * Miniaturka i lupka jako gotowe elementy — dla kodu, który buduje kafelki
 * z DOM-u (kalkulator blatów). Nic nie sklejamy ze stringów, więc nazwa
 * wzoru nie ma jak trafić do HTML-a inaczej niż jako tekst.
 */
export function elementyWzoru(marka, dekor) {
  const mini = plikWzoru(marka, dekor, 'mini');
  if (!mini) return [];

  const kropka = document.createElement('span');
  kropka.className = 'wzor-mini';
  kropka.style.backgroundImage = `url('${mini}')`;
  kropka.setAttribute('aria-hidden', 'true');

  const lupa = document.createElement('span');
  lupa.className = 'wzor-lupa';
  lupa.setAttribute('role', 'button');
  lupa.setAttribute('tabindex', '-1');
  lupa.title = 'Zobacz całą płytę';
  lupa.setAttribute('aria-label', `Zobacz całą płytę: ${dekor}`);
  lupa.textContent = '⌕';

  return [kropka, lupa];
}

/** Czy mamy zdjęcie wzoru dla tego dekoru. */
export function maWzor(marka, dekor) {
  return !!plikWzoru(marka, dekor);
}

export { plikWzoru, maCalaPlyte };

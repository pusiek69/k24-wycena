/**
 * WIZUALIZACJA UMYWALKI — nagroda na końcu ścieżki.
 *
 * Decyzja Dawida (23.11.2026): „albo na koncu zeby zrobiło wizualizacje
 * jakas ladną". Klient konfiguruje bryłę bez ceny, zostawia kontakt —
 * i dostaje ładny obrazek SWOJEJ umywalki razem z kwotą.
 *
 * Obrazek powstaje w przeglądarce: render sceny 3D w wyższej rozdzielczości
 * (bez rozsunięcia, z katalogowego kąta) wklejony na tło z podpisami.
 * Ten sam plik idzie potem w mailu do klienta i daje się pobrać albo
 * wysłać dalej — bo pierwsze, co robi człowiek z taką wyceną, to pokazuje
 * ją drugiej osobie w domu.
 *
 * Rysujemy na zwykłym canvasie, bez żadnej biblioteki.
 */
import { podpisUmywalki } from './model.js';

const SZER = 1200;
const WYS = 900;
/* Paleta kam24h.pl — wizualizacja ma wyglądać jak strona, bo trafia dalej:
   do maila, na telefon klienta i stamtąd do drugiej osoby w domu. */
const AKCENT = '#c9a86a';
const AKCENT_JASNY = '#d9bd84';
const TUSZ = '#ece6da';
const SZARY = '#b6ad9d';
const KARTA = '#1b1815';

const zl = (v) => Math.round(v).toLocaleString('pl-PL') + ' zł';
const fd = (v) => (Math.round(v * 10) / 10).toLocaleString('pl-PL');

/** Kroje jak na stronie: nagłówki i kwota Cormorantem, reszta sansem. */
const font = (waga, rozmiar) => `${waga} ${rozmiar}px "Helvetica Neue", Arial, sans-serif`;
const ozdobny = (rozmiar) => `400 ${rozmiar}px Cormorant, Georgia, "Times New Roman", serif`;

/**
 * @param {object} p
 * @param {object} p.podglad  scena 3D (z `zrzut`)
 * @param {object} p.wycena   wynik `wycenUmywalke`
 * @returns {Promise<{dataURL:string, blob:Blob|null}|null>}
 */
export async function zrobWizualizacje({ podglad, wycena }) {
  if (!podglad?.zrzut || !wycena?.ok) return null;

  const png = podglad.zrzut({ szer: 1400, wys: 1000 });
  if (!png) return null;

  try {
    await document.fonts?.ready;
  } catch {
    /* brak API fontów — rysujemy systemowym */
  }

  const bryla = await wczytaj(png);
  const c = document.createElement('canvas');
  c.width = SZER;
  c.height = WYS;
  const g = c.getContext('2d');

  tlo(g);
  naglowek(g, wycena);
  wklejBryle(g, bryla);
  stopka(g, wycena);

  const dataURL = c.toDataURL('image/jpeg', 0.88);
  const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.88)).catch(() => null);
  return { dataURL, blob };
}

function wczytaj(src) {
  return new Promise((ok, nie) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = nie;
    i.src = src;
  });
}

/** Jasne tło z delikatnym światłem u góry — jak płyta pod lampą. */
function tlo(g) {
  const grad = g.createLinearGradient(0, 0, 0, WYS);
  grad.addColorStop(0, '#221d19');
  grad.addColorStop(0.6, '#191614');
  grad.addColorStop(1, '#13110f');
  g.fillStyle = grad;
  g.fillRect(0, 0, SZER, WYS);

  // Światło lampy nad stołem kamieniarza — ciepłe, złote, przygaszone.
  /*
   * Mocniejsza plama światła niż na stronie: na obrazku ląduje też czarny
   * kamień (Portoro, Absolute Black) i bez tego zlewałby się z tłem.
   */
  const plama = g.createRadialGradient(SZER * 0.5, WYS * 0.4, 60, SZER * 0.5, WYS * 0.4, SZER * 0.66);
  plama.addColorStop(0, 'rgba(236,230,218,0.13)');
  plama.addColorStop(0.45, 'rgba(201,168,106,0.09)');
  plama.addColorStop(1, 'rgba(201,168,106,0)');
  g.fillStyle = plama;
  g.fillRect(0, 0, SZER, WYS);
}

function naglowek(g, w) {
  g.fillStyle = AKCENT;
  g.font = font(600, 17);
  g.letterSpacing = '3px';
  g.fillText('KAMIENIARSTWO 24H', 64, 72);
  g.letterSpacing = '0px';

  g.fillStyle = TUSZ;
  g.font = ozdobny(46);
  g.fillText('Umywalka z kamienia na wymiar', 64, 130);

  g.fillStyle = SZARY;
  g.font = font(400, 22);
  // Podpis bierzemy z modelu — druga kopia tej treści już raz skłamała
  // o rodzaju umywalki na gotowym renderze (patrz podpisUmywalki).
  g.fillText(podpisUmywalki(w.stan), 64, 164);
}

/** Render bryły wklejony tak, by nie zasłaniał podpisów. */
function wklejBryle(g, bryla) {
  const polePole = { x: 40, y: 180, w: SZER - 80, h: 470 };
  const skala = Math.min(polePole.w / bryla.width, polePole.h / bryla.height);
  const w = bryla.width * skala;
  const h = bryla.height * skala;
  const x = polePole.x + (polePole.w - w) / 2;
  const y = polePole.y + (polePole.h - h) / 2;

  // Miękki cień pod bryłą — osadza ją na tle zamiast zawieszać w powietrzu.
  const cien = g.createRadialGradient(SZER / 2, y + h * 0.82, 10, SZER / 2, y + h * 0.82, w * 0.34);
  cien.addColorStop(0, 'rgba(0,0,0,0.38)');
  cien.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = cien;
  g.fillRect(0, y + h * 0.55, SZER, h * 0.6);

  g.drawImage(bryla, x, y, w, h);
}

function stopka(g, w) {
  const S = w.stan;
  const y = 672;
  const h = 150;

  zaokraglony(g, 48, y, SZER - 96, h, 14);
  g.fillStyle = KARTA;
  g.fill();
  g.strokeStyle = 'rgba(201,168,106,0.28)';
  g.lineWidth = 1.5;
  g.stroke();

  // Lewa strona: wymiary i kamień.
  g.fillStyle = SZARY;
  g.font = font(500, 16);
  g.letterSpacing = '1.5px';
  g.fillText('TWOJA KONFIGURACJA', 80, y + 40);
  g.letterSpacing = '0px';

  g.fillStyle = TUSZ;
  g.font = ozdobny(34);
  g.fillText(`${fd(S.L)} × ${fd(S.W)} × ${fd(S.H)} cm`, 80, y + 82);

  g.fillStyle = SZARY;
  g.font = font(400, 19);
  g.fillText(`${w.firma.nazwa} · ${w.dekor}`, 80, y + 112);

  // Prawa strona: cena.
  g.textAlign = 'right';
  g.fillStyle = SZARY;
  g.font = font(500, 16);
  g.letterSpacing = '1.5px';
  g.fillText('CENA ORIENTACYJNA', SZER - 80, y + 40);
  g.letterSpacing = '0px';

  g.fillStyle = AKCENT_JASNY;
  g.font = ozdobny(52);
  g.fillText(zl(w.razemZaokr), SZER - 80, y + 90);

  g.fillStyle = SZARY;
  g.font = font(400, 17);
  g.fillText(
    S.mont ? 'brutto, z montażem (VAT 8%)' : 'brutto, odbiór własny (VAT 23%)',
    SZER - 80,
    y + 116
  );
  g.textAlign = 'left';

  // Pasek na dole: co jest w cenie i jak się skontaktować.
  g.fillStyle = SZARY;
  g.font = font(400, 17);
  g.fillText('Projekt 3D i pomiar u klienta — w cenie', 64, WYS - 36);

  g.textAlign = 'right';
  g.fillStyle = TUSZ;
  g.font = font(600, 17);
  g.fillText('kam24h.pl  ·  796 991 128', SZER - 64, WYS - 36);
  g.textAlign = 'left';
}

function zaokraglony(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Nazwa pliku, po której klient pozna, co to jest, gdy trafi na pulpit. */
export function nazwaPliku(wycena) {
  const S = wycena?.stan || {};
  return `umywalka-${Math.round(S.L || 0)}x${Math.round(S.W || 0)}-kamieniarstwo24h.jpg`;
}

/** Pobranie obrazka na dysk / do galerii telefonu. */
export function pobierz(dataURL, nazwa) {
  const a = document.createElement('a');
  a.href = dataURL;
  a.download = nazwa;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Udostępnienie systemowe (telefon) — klient wysyła wizualizację mężowi
 * czy żonie jednym tapnięciem. Gdy przeglądarka tego nie umie, zwracamy
 * `false` i strona pokazuje zwykłe pobieranie.
 */
export async function udostepnij(blob, nazwa, tekst) {
  if (!blob || !navigator.canShare) return false;
  const plik = new File([blob], nazwa, { type: 'image/jpeg' });
  if (!navigator.canShare({ files: [plik] })) return false;
  try {
    await navigator.share({ files: [plik], text: tekst });
    return true;
  } catch {
    return false;
  }
}

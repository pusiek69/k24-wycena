/**
 * KALKULATOR UMYWALEK — strona `/umywalka-na-wymiar`.
 *
 * Układ, sterowanie i podgląd 3D pochodzą z projektu Dawida (23.11.2026).
 * Zmienione jest jedno, za to najważniejsze: CENA. U niego liczyła się jako
 * pole formatek + 25% odpadu × stawka za metr; tutaj liczy ją silnik wyceny
 * blatów — ten sam katalog, te same promocje i, co decyduje o kwocie,
 * prawdziwe pakowanie na płytę z możliwością kupienia POŁÓWKI.
 *
 * Druga różnica: stawki robocizny nie są edytowalne na stronie. Klient nie
 * ma po co ich widzieć ani tym bardziej zmieniać — przychodzą z panelu Dawida.
 *
 * BRAMKA: `CENA_PO_FORMULARZU` decyduje, czy kwota jest widoczna od razu,
 * czy dopiero po zostawieniu kontaktu. Jeden warunek, do przestawienia
 * w sekundę, gdy Dawid podejmie decyzję.
 */
import './umywalka.css';

import keralini from '../firms/keralini.js';
import avantQuartz from '../firms/avant-quartz.js';
import { grubosciDekoru } from '../firms/index.js';
import { kolorDekoru } from '../app/kolory-dekorow.js';
import { inicjujZgody, zmienZgody } from '../analytics/zgody.js';
import { sledzTelefony } from '../analytics/zdarzenia.js';
import { zapamietajZrodlo } from '../app/zrodlo.js';
import { pobierzUstawienia } from '../api.js';
import { scalUstawienia, zastosujUstawienia } from '../app/ustawienia.js';

import {
  STAN_DOMYSLNY,
  zacisnij,
  limity,
  formatki,
  szerokoscZlewu,
  iloscBokow,
  ranty,
  plytaCm,
} from './model.js';
import { wycenUmywalke } from './wycena-umywalki.js';
import { znacznikPolowki, podpowiedzPolowki, ostrzezeniaWykonawcze } from './podpowiedzi.js';
import { POLECANE, ODCIENIE, fakturaDekoru, probkaDekoru } from './dekory-polecane.js';
import { plikWzoru } from '../generated/wzory-dekorow.js';
import { podlaczPodglad } from '../app/podglad-wzoru.js';
import { zrobWizualizacje, nazwaPliku, pobierz, udostepnij } from './wizualizacja.js';
import { uruchomPodglad } from './scena3d.js';
import { formularzUmywalki, potwierdzenieWyslania } from './formularz.js';
import { znanyKlient, imieKlienta, zapomnijKlienta } from './pamiec-klienta.js';
import * as ga from './zdarzenia.js';

/** Czy kwota pojawia się dopiero po zostawieniu kontaktu. */
const CENA_PO_FORMULARZU = true;

const FIRMY = [keralini, avantQuartz];
const $ = (s) => document.querySelector(s);
const fd = (v) => (Math.round(v * 10) / 10).toLocaleString('pl-PL');
const f2 = (v) => v.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const zl = (v) => Math.round(v).toLocaleString('pl-PL') + ' zł';
const liczba = (s) => parseFloat(String(s).replace(',', '.').replace(/\s/g, ''));

const DIM = {
  L: 'Długość blatu',
  W: 'Głębokość blatu',
  H: 'Grubość z pogrubieniem',
  sL: 'Szerokość zlewu',
  gap: 'Mostek między zlewami',
  sW: 'Głębokość zlewu (od przodu)',
  ins: 'Wstawka',
};
const PRESETY = [
  [80, 46],
  [100, 50],
  [120, 50],
  [160, 50],
];
/*
 * Paski udziału w cenie — odcienie kamienia i złota, jak reszta strony.
 * (Do 24.11.2026 siedział tu pomarańcz #ff4f00 z artefaktu: przeoczenie
 * przy zmianie palety, widoczne w legendzie pod kwotą.)
 */
const KOLORY_POZYCJI = {
  material: 'var(--acc-hi)',
  pogrubienie: 'var(--acc)',
  niecka: '#8a7244',
  otwory: '#6b6257',
  montaz: '#b6ad9d',
};

let S = { ...STAN_DOMYSLNY };
let stawki = scalUstawienia(null);
let W = null; // ostatnia wycena
let FORMATKI = [];
let podglad = null;
let odcienFiltr = null;
let pelnyKatalog = false;
let wyslane = null;
let przypiete = null;

const firma = () => FIRMY.find((f) => f.slug === S.marka) || FIRMY[0];

/**
 * Wygląd kamienia na bryle: najpierw prawdziwe zdjęcie wzoru z katalogu
 * Architype, a gdy danego wzoru nie mamy w zdjęciach — tekstura rysowana
 * w zbliżonym kolorze.
 */
const wyglad = () => ({
  plik: plikWzoru(S.marka, S.dekor),
  faktura: fakturaDekoru(S.marka, S.dekor, kolorDekoru(S.dekor, S.marka)),
});

/* ═════════════════════════════════════════════════════ adres */

const slug = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function czytajURL() {
  const p = new URLSearchParams(location.search);
  if (!p.toString()) return;
  const liczby = ['L', 'W', 'H', 'sL', 'gap', 'sW', 'ins', 'n', 'holes'];
  for (const k of liczby) {
    const v = liczba(p.get(k));
    if (Number.isFinite(v)) S[k] = v;
  }
  if (p.get('mode')) S.mode = p.get('mode') === 'top' ? 'top' : 'int';
  if (p.get('mont')) S.mont = p.get('mont') === '1';
  if (p.get('reuse')) S.reuse = p.get('reuse') === '1';
  if (p.get('left')) S.left = p.get('left') === '1';
  if (p.get('right')) S.right = p.get('right') === '1';

  const d = (p.get('d') || '').split(':');
  if (d.length === 3) {
    const f = FIRMY.find((x) => x.slug === d[0]);
    const nazwa = f && Object.keys(f.dekory || {}).find((n) => slug(n) === d[1]);
    if (nazwa) {
      S.marka = d[0];
      S.dekor = nazwa;
      S.grubosc = d[2];
    }
  }
}

function zapiszURL() {
  const p = new URLSearchParams({
    mode: S.mode,
    L: String(S.L),
    W: String(S.W),
    H: String(S.H),
    n: String(S.n),
    sL: String(S.sL),
    gap: String(S.gap),
    sW: String(S.sW),
    ins: String(S.ins),
    holes: String(S.holes),
    mont: S.mont ? '1' : '0',
    reuse: S.reuse ? '1' : '0',
    left: S.left ? '1' : '0',
    right: S.right ? '1' : '0',
    d: `${S.marka}:${slug(S.dekor)}:${S.grubosc}`,
  });
  history.replaceState(null, '', `${location.pathname}?${p}`);
}

/* ═════════════════════════════════════════════════════ przeliczanie */

function przelicz(przebuduj = true) {
  zacisnij(S);
  FORMATKI = formatki(S);
  W = wycenUmywalke({ firma: firma(), stan: S, stawki });
  zapiszURL();
  if (podglad && przebuduj) podglad.build(FORMATKI);
  rysuj();
  kontrolki();
}

/* ═════════════════════════════════════════════════════ rysowanie */

function rysuj() {
  rysujCene();
  rysujFormatki();
  rysujRozbicie();
  rysujOdczyt();
  rysujOstrzezenia();
  rysujPolowke();
}

/*
 * JEDNO miejsce, które decyduje o tym, czy klient widzi kwoty.
 *
 * Kto już raz zostawił kontakt, widzi ceny od razu — także przy kolejnej
 * wizycie i po każdej zmianie konfiguracji (zlecenie Dawida, 23.11.2026).
 * Bramka ma zebrać kontakt RAZ, a nie męczyć tego samego człowieka przy
 * każdym ruchu suwaka.
 *
 * Warunek siedzi w funkcji, a nie w dwóch kopiach, bo przy dwóch kopiach
 * karta ceny i rozbicie potrafią pokazywać co innego — tak właśnie było
 * przez chwilę przy pierwszym podejściu.
 */
const cenaUkryta = () => CENA_PO_FORMULARZU && !wyslane && !znanyKlient();

function rysujCene() {
  const box = $('#total');
  const mbar = $('#mbar');
  if (!W?.ok) {
    box.innerHTML = `<div class="tl">Cena</div><p class="info">${W?.blad || 'Policzymy tę konfigurację indywidualnie — proszę zadzwonić.'}</p>`;
    mbar.innerHTML = '';
    return;
  }

  const ukryta = cenaUkryta();

  if (ukryta) {
    box.innerHTML =
      `<div class="tl">Cena orientacyjna</div>` +
      `<div class="zamek">` +
      `<div class="big">— — —<small> zł brutto</small></div>` +
      `<p>Wycena jest gotowa. Zostaw kontakt, a pokażemy kwotę od razu i wyślemy całe zestawienie na e-mail.</p>` +
      `<button class="btn acc" id="doForm">Pokaż cenę i wyślij zapytanie</button>` +
      `</div>`;
    // Zamknięta cena: bez wielkiej cyfry, więc i bez ozdobnego kroju —
    // inaczej „Wycena gotowa" łamało się na dwie linie i nachodziło na przycisk.
    mbar.innerHTML =
      `<div class="mbar-info"><b>Wycena gotowa</b><span>zostaw kontakt, pokażemy kwotę</span></div>` +
      `<button class="btn acc" id="doFormM">Pokaż cenę</button>`;
    return;
  }

  const udzialy = W.udzialy;
  box.innerHTML =
    `<div class="tl">Cena orientacyjna</div>` +
    `<div class="big">${Math.round(W.razemZaokr).toLocaleString('pl-PL')} zł <small>brutto</small></div>` +
    `<div class="sub">netto ${zl(W.razemNetto)} · VAT ${Math.round(W.stawkaVat * 100)}% · ` +
    `${f2(W.m2Formatek)} m² kamienia w ${FORMATKI.length} ${FORMATKI.length === 1 ? 'formatce' : 'formatkach'}</div>` +
    `<div class="split">${udzialy
      .map((u) => `<i style="width:${u.procent.toFixed(2)}%;background:${KOLORY_POZYCJI[u.id] || 'var(--mute)'}" title="${u.nazwa}"></i>`)
      .join('')}</div>` +
    `<div class="legend">${udzialy
      .map((u) => `<span><i class="key" style="background:${KOLORY_POZYCJI[u.id] || 'var(--mute)'}"></i>${krotko(u.id)} ${Math.round(u.procent)}%</span>`)
      .join('')}</div>` +
    // Powitanie dla kogoś, kto zostawił kontakt wcześniej — razem z wyjściem
    // z pamięci, bo telefon bywa wspólny i nie zawsze patrzy ta sama osoba.
    (!wyslane && znanyKlient()
      ? `<p class="znany-klient">` +
        (imieKlienta() ? `Witamy ponownie, ${imieKlienta()}. ` : 'Witamy ponownie. ') +
        `Kwoty widać od razu — kontakt już mamy. ` +
        `<button type="button" class="link-zmien" id="toNieJa">to nie ja</button></p>`
      : '') +
    (wyslane
      ? `<div class="row"><a class="btn" href="tel:+48796991128" data-miejsce="umywalka-cena">Zadzwoń 796 991 128</a></div>`
      : `<div class="row"><button class="btn acc" id="doForm">Wyślij zapytanie</button></div>`);

  mbar.innerHTML =
    `<div><b>${zl(W.razemZaokr)}</b> <span>brutto</span></div>` +
    (wyslane
      ? `<a class="btn" href="tel:+48796991128" data-miejsce="umywalka-pasek">Zadzwoń</a>`
      : `<button class="btn acc" id="doFormM">Wyślij zapytanie</button>`);
}

const krotko = (id) =>
  ({ material: 'Kamień', pogrubienie: 'Krawędź', niecka: 'Zlew', otwory: 'Otwory', montaz: 'Montaż' })[id] || id;

function rysujFormatki() {
  $('#cut').innerHTML = FORMATKI.map(
    (x) =>
      `<tr data-k="${x.k}"><td><span class="no">${x.i}</span></td><td>${x.n}${x.cut ? ' <em>z wycinki</em>' : ''}</td>` +
      `<td class="r nw">${fd(x.a)} × ${fd(x.b)}</td><td class="r">${x.q}</td><td class="r nw">${f2(x.m)}</td></tr>`
  ).join('');

  const sztuk = FORMATKI.reduce((s, x) => s + x.q, 0);
  const plyta = W?.ok ? W.plyta : null;
  $('#cutF').innerHTML =
    `<tr><td></td><td>Razem</td><td></td><td class="r">${sztuk}</td><td class="r nw">${f2(W?.m2Formatek || 0)}</td></tr>` +
    (W?.ok
      ? `<tr><td></td><td colspan="3">Materiał do kupienia: ${opisPlyty(W)}${plyta ? ` (${fd(plyta.w)} × ${fd(plyta.h)} cm)` : ''}</td>` +
        `<td class="r nw">${f2(W.m2Platne)}</td></tr>`
      : '');
}

/** „pół płyty" zamiast „2,56 m² materiału" — tak to widzi kamieniarz. */
function opisPlyty(w) {
  const p = w.pak || {};
  if (p.polowka && !p.plytyPelne) return 'pół płyty';
  if (p.polowka) return `${p.plytyPelne} i pół płyty`;
  return `${p.plytyPelne} ${p.plytyPelne === 1 ? 'płyta' : p.plytyPelne < 5 ? 'płyty' : 'płyt'}`;
}

function rysujRozbicie() {
  const karta = $('#brkCard');
  if (!W?.ok) return (karta.hidden = true);

  if (cenaUkryta()) {
    karta.hidden = false;
    $('#brk').innerHTML =
      `<p class="info">Rozbicie ceny pokażemy razem z kwotą — po zostawieniu kontaktu. ` +
      `Zawsze widać, za co dokładnie się płaci: kamień, wykonanie, montaż.</p>`;
    return;
  }

  karta.hidden = false;
  $('#brk').innerHTML =
    W.pozycje
      .filter((p) => p.brutto > 0 || p.wCenie)
      .map(
        (p) =>
          `<div class="bi"><i class="key" style="background:${KOLORY_POZYCJI[p.id] || 'var(--mute)'}"></i>` +
          `<div><b>${p.nazwa}</b><small>${opisPozycji(p)}</small></div>` +
          `<span class="v">${p.wCenie ? 'w cenie' : zl(p.brutto)}</span></div>`
      )
      .join('') +
    `<div class="bi tot"><span></span><div><b>Razem brutto</b>` +
    `<small>w tym VAT ${Math.round(W.stawkaVat * 100)}%: ${zl(W.razem - W.razemNetto)} · netto ${zl(W.razemNetto)}</small></div>` +
    `<span class="v">${zl(W.razemZaokr)}</span></div>`;
}

/**
 * Opis pozycji BEZ stawek warsztatu — klient widzi ilość i czego dotyczy,
 * a nie po ile liczymy metr bieżący.
 */
function opisPozycji(p) {
  if (p.id === 'material') return `${opisPlyty(W)} · ${f2(W.m2Platne)} m²`;
  if (p.id === 'pogrubienie') return `cięcie pod kątem, klejenie i poler: ${f2(p.ilosc)} m krawędzi`;
  if (p.id === 'niecka') return p.ilosc > 1 ? 'dwa zlewy: ścianki, spadek, poler wnętrza' : 'ścianki, dno ze spadkiem, poler wnętrza';
  if (p.id === 'otwory') return `${p.ilosc} szt.`;
  if (p.id === 'montaz') return 'dojazd, wniesienie, poziomowanie, silikonowanie';
  if (p.id === 'projekt') return 'projekt do zatwierdzenia i pomiar przed wykonaniem';
  return '';
}

function rysujOdczyt() {
  $('#rd1').textContent = `${fd(S.L)} × ${fd(S.W)} × ${fd(S.H)} cm`;
  const opisKamienia = `${firma().nazwa} ${S.dekor}, płyta ${fd(plytaCm(S))} cm`;
  $('#rd2').textContent =
    (S.mode === 'int'
      ? S.n === 2
        ? `2 zlewy ${fd(S.sL)} × ${fd(S.sW)}, mostek ${fd(S.gap)} · `
        : `zlew ${fd(S.sL)} × ${fd(S.sW)} · `
      : 'pod umywalkę nablatową · ') + opisKamienia;

  $('#hint').textContent =
    $('#ex').getAttribute('aria-pressed') === 'true' ? 'Numery jak na liście formatek' : 'Przeciągnij, aby obrócić';
}

function rysujOstrzezenia() {
  const r = ranty(S);
  if (S.mode === 'int') {
    $('#sinkInfo').textContent =
      `Dno${S.n === 2 ? ' każdego zlewu' : ''}: płyta spadkowa ${fd(S.sL)} × ${fd(S.sW - S.ins)}` +
      `${S.ins > 0 ? ` + wstawka ${fd(S.sL)} × ${fd(S.ins)}` : ''}. ` +
      `Rant: ${fd(r.bok)} cm po bokach${S.n === 2 ? `, mostek ${fd(S.gap)} cm` : ''}, ${fd(r.przod)} cm z przodu i z tyłu.`;
  }

  const lista = ostrzezeniaWykonawcze(S);

  $('#warnTop').innerHTML = lista
    .map((x) => `<p class="${x.rodzaj === 'info' ? 'info' : 'warn'}">${x.tekst}</p>`)
    .join('');
}

/**
 * Połówka płyty — jedyne miejsce, gdzie kalkulator sam coś radzi.
 * Bez kwot przed formularzem: „o połowę mniej kamienia", nie „mniej o 2 000 zł".
 */
function rysujPolowke() {
  const box = $('#polowka');
  if (!W?.ok) return (box.innerHTML = '');

  const znak = znacznikPolowki(W.pak);
  if (znak) {
    box.innerHTML = `<p class="ok-znak">✓ ${znak.tekst} — kamień w najtańszym wariancie zakupu.</p>`;
    return;
  }

  const rada = podpowiedzPolowki({ stan: S, pak: W.pak, plyta: W.plyta });
  if (!rada) return (box.innerHTML = '');

  box.innerHTML =
    `<div class="polowka"><p>${rada.tekst}</p>` +
    (rada.akcja ? `<button class="btn acc" id="ustawPolowke">${rada.akcja.etykieta}</button>` : '') +
    `</div>`;
  if (rada.akcja) {
    $('#ustawPolowke').addEventListener('click', () => {
      S.L = rada.akcja.zmiana.L;
      S.sL = Math.min(S.sL, S.L - 10);
      ga.start(S.mode);
      przelicz();
    });
  }
}

/* ═════════════════════════════════════════════════════ kontrolki */

function wierszWymiaru(k) {
  return (
    `<div class="dim" id="d-${k}"><div class="dl"><label for="n-${k}">${DIM[k]}</label>` +
    `<span class="num"><input id="n-${k}" data-k="${k}" type="text" inputmode="decimal" autocomplete="off"><i>cm</i></span></div>` +
    `<input id="r-${k}" data-k="${k}" type="range" step="0.5" aria-label="${DIM[k]}"></div>`
  );
}

function kontrolki() {
  const l = limity(S);
  const int = S.mode === 'int';

  $('#d-gap').hidden = S.n !== 2;
  $('label[for=n-sL]').textContent = S.n === 2 ? 'Szerokość każdego zlewu' : 'Szerokość zlewu';

  for (const k of ['L', 'W', 'H', 'sL', 'gap', 'sW', 'ins']) {
    const n = $('#n-' + k);
    const r = $('#r-' + k);
    if (document.activeElement !== n) n.value = String(S[k]).replace('.', ',');
    r.min = l[k][0];
    r.max = l[k][1];
    r.value = S[k];
    r.style.setProperty('--p', ((S[k] - l[k][0]) / Math.max(0.001, l[k][1] - l[k][0])) * 100 + '%');
  }

  $('#sinkCard').hidden = !int;
  $('#reuseRow').hidden = !int;
  document.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === S.mode)));
  document.querySelectorAll('[data-side]').forEach((b) => b.setAttribute('aria-pressed', String(!!S[b.dataset.side])));
  document.querySelectorAll('[data-pre]').forEach((b) => {
    const [a, c] = b.dataset.pre.split(',').map(Number);
    b.setAttribute('aria-pressed', String(a === S.L && c === S.W));
  });
  document.querySelectorAll('[data-n]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.n === S.n)));
  $('#hn').textContent = S.holes;
  $('#mont').checked = !!S.mont;
  $('#reuse').checked = !!S.reuse;
  $('#holeHint').textContent = int
    ? S.n === 2
      ? 'baterie (po jednej na zlew), dozownik'
      : 'bateria, dozownik'
    : 'odpływ umywalki, bateria';

  rysujKamienie();
  rysujGrubosci();
}

function rysujKamienie() {
  $('#odcienie').innerHTML = ODCIENIE.map(
    (o) => `<button class="chip" data-odcien="${o.id}" aria-pressed="${String(odcienFiltr === o.id)}">${o.nazwa}</button>`
  ).join('');

  const lista = pelnyKatalog ? wszystkieDekory() : POLECANE.filter((p) => !odcienFiltr || p.odcien === odcienFiltr);
  $('#mats').innerHTML = lista
    .map((p) => {
      const f = fakturaDekoru(p.marka, p.dekor, kolorDekoru(p.dekor, p.marka));
      const wybrany = p.marka === S.marka && p.dekor === S.dekor;
      // Kropka pokazuje PRAWDZIWY wzór, jeśli mamy zdjęcie z katalogu.
      const mini = plikWzoru(p.marka, p.dekor, 'mini');
      const tlo = mini
        ? `background-image:url('${mini}');background-size:cover;background-position:center`
        : `background:radial-gradient(circle at 32% 30%,${f.sp[1] || f.sp[0]},${f.base} 45%,${f.vein} 150%)`;
      // Lupka otwiera całą płytę — w kropce 28 px wzoru nie widać.
      const lupa = mini
        ? `<span class="wzor-lupa" role="button" tabindex="-1" title="Zobacz całą płytę" aria-label="Zobacz całą płytę ${p.dekor}">⌕</span>`
        : '';
      return (
        `<button class="mat" data-dekor="${p.dekor}" data-marka="${p.marka}" data-grubosc="${p.grubosc}" aria-pressed="${String(wybrany)}">` +
        `<span class="dot" style="${tlo}"></span>` +
        `<span><b>${p.dekor}</b><small>${p.marka === 'keralini' ? 'Keralini' : 'Avant Quartz'}</small></span>${lupa}</button>`
      );
    })
    .join('');

  // Podgląd całej płyty: najechanie myszą, lupka albo przytrzymanie palca.
  for (const kafelek of $('#mats').querySelectorAll('.mat')) {
    podlaczPodglad(kafelek, {
      marka: kafelek.dataset.marka,
      dekor: kafelek.dataset.dekor,
      nazwaMarki: kafelek.dataset.marka === 'keralini' ? 'Keralini' : 'Avant Quartz',
    });
  }

  const ile = FIRMY.reduce((s, f) => s + Object.keys(f.dekory || {}).length, 0);
  $('#wszystkie').textContent = pelnyKatalog ? 'Pokaż krótką listę' : `Pokaż wszystkie wzory (${ile})`;
}

function wszystkieDekory() {
  const out = [];
  for (const f of FIRMY) {
    for (const nazwa of Object.keys(f.dekory || {})) {
      const g = grubosciDekoru(f, nazwa);
      if (!g.length) continue;
      out.push({ marka: f.slug, dekor: nazwa, grubosc: g[0], probka: probkaDekoru(f.slug, nazwa, kolorDekoru(nazwa, f.slug)) });
    }
  }
  return out.sort((a, b) => a.dekor.localeCompare(b.dekor, 'pl'));
}

function rysujGrubosci() {
  const dostepne = grubosciDekoru(firma(), S.dekor);
  $('#thick').innerHTML = dostepne
    .map(
      (g) =>
        `<button data-grubosc="${g}" aria-pressed="${String(g === S.grubosc)}">${fd(Number(g) / 10)} cm</button>`
    )
    .join('');
}

/* ═════════════════════════════════════════════════════ formularz */

function rysujFormularz() {
  const box = $('#leadBox');
  if (!W?.ok) {
    box.innerHTML = '';
    return;
  }

  if (wyslane) return rysujFinal(box);

  box.replaceChildren(
    formularzUmywalki({
      wycena: W,
      link: location.href,
      wizualizacja: () => zrobWizualizacje({ podglad, wycena: W }),
      poWyslaniu: (dane) => {
        wyslane = dane;
        $('#lead').scrollIntoView({ behavior: 'smooth', block: 'start' });
        rysuj();
        rysujFormularz();
      },
    })
  );

  // Zdarzenie „zobaczył formularz" dopiero przy pierwszym dotknięciu pola —
  // sam fakt, że formularz jest na stronie, niczego jeszcze nie mówi.
  box.addEventListener('focusin', () => ga.formularz(W?.razemZaokr), { once: true });
}

/**
 * FINAŁ — to, po co klient tu przyszedł.
 *
 * Ładny obrazek jego umywalki, kwota, co jest w cenie i co dalej. Obrazek
 * da się pobrać albo wysłać dalej jednym tapnięciem: pierwsze, co robi
 * człowiek z taką wyceną, to pokazuje ją drugiej osobie w domu.
 */
function rysujFinal(box) {
  const obraz = wyslane.obraz;
  // Po wysłaniu nagłówek „Zapytanie o tę umywalkę" przestaje być prawdą.
  const tytul = document.querySelector('#lead h2');
  if (tytul) tytul.textContent = 'Twoja umywalka';
  box.replaceChildren();
  box.append(potwierdzenieWyslania({ ...wyslane, mailWyslany: wyslane.mailWyslany }));

  const final = document.createElement('div');
  final.className = 'final';
  final.innerHTML =
    (obraz?.dataURL
      ? `<figure class="final-obraz">` +
        `<img src="${obraz.dataURL}" id="obrazFinal" alt="Wizualizacja Twojej umywalki ${W.stan.L} × ${W.stan.W} cm, ${W.dekor}">` +
        `<figcaption>Dotknij obrazka, żeby zapisać go w telefonie.</figcaption>` +
        `</figure>`
      : '') +
    `<div class="final-cena">` +
    `<div class="tl">Twoja umywalka</div>` +
    `<div class="big">${Math.round(W.razemZaokr).toLocaleString('pl-PL')} zł <small>brutto</small></div>` +
    `<div class="sub">${W.stan.mont ? 'z montażem (VAT 8% — lokal mieszkalny)' : 'odbiór własny z zakładu (VAT 23%)'}</div>` +
    `<ul class="final-linie">` +
    W.linieKlienta
      .map(
        (l) =>
          `<li><span>${l.nazwa}</span><b>${l.wCenie ? 'w cenie' : zl(Math.round(l.brutto))}</b></li>`
      )
      .join('') +
    `</ul>` +
    (W.tanszaWersja && W.tanszaWersja < W.razemZaokr
      ? `<p class="info">Tańsza wersja: ten sam kamień jako blat pod umywalkę nablatową — około <b>${zl(W.tanszaWersja)}</b>.</p>`
      : '') +
    `</div>` +
    `<div class="final-dalej">` +
    `<h3>Co dalej</h3>` +
    `<ol>` +
    `<li><b>Pomiar u klienta</b> — przyjeżdżamy z Prolinerem i mierzymy co do milimetra. W cenie.</li>` +
    `<li><b>Projekt 3D do zatwierdzenia</b> — widzi Pan/Pani dokładnie tę umywalkę przed cięciem. W cenie.</li>` +
    `<li><b>Wykonanie i montaż</b> — termin ustalamy przy zamówieniu.</li>` +
    `</ol>` +
    `<div class="row">` +
    (obraz?.dataURL ? `<button class="btn acc" id="pobierzObraz">Pobierz wizualizację</button>` : '') +
    (obraz?.blob ? `<button class="btn" id="udostepnijObraz" hidden>Wyślij dalej</button>` : '') +
    `<a class="btn" href="tel:+48796991128" data-miejsce="umywalka-final">Zadzwoń 796 991 128</a>` +
    `</div>` +
    `<p class="info">Wycena orientacyjna — wiążąca cena po pomiarze. Zestawienie poszło na podany adres e-mail.</p>` +
    `</div>`;
  box.append(final);

  if (obraz?.dataURL) {
    const zapisz = () => pobierz(obraz.dataURL, nazwaPliku(W));
    $('#pobierzObraz').addEventListener('click', zapisz);
    // Na telefonie obrazek jest mały — dotknięcie go zapisuje plik,
    // bo właśnie po to klient tam patrzy.
    $('#obrazFinal')?.addEventListener('click', zapisz);
  }
  const przyciskUdostepnij = $('#udostepnijObraz');
  if (przyciskUdostepnij && obraz?.blob && navigator.canShare) {
    // Pokazujemy tylko tam, gdzie system naprawdę to umie (telefony).
    try {
      const plik = new File([obraz.blob], nazwaPliku(W), { type: 'image/jpeg' });
      if (navigator.canShare({ files: [plik] })) {
        przyciskUdostepnij.hidden = false;
        przyciskUdostepnij.addEventListener('click', () =>
          udostepnij(obraz.blob, nazwaPliku(W), `Moja umywalka z kamienia — ${W.opis}`)
        );
      }
    } catch {
      /* brak obsługi — zostaje samo pobieranie */
    }
  }
}

/* ═════════════════════════════════════════════════════ zdarzenia UI */

const panel = $('#panel');

panel.addEventListener('input', (e) => {
  const t = e.target;
  const k = t.dataset.k;
  if (!k) return;
  ga.start(S.mode);
  if (t.type === 'range') {
    S[k] = +t.value;
    przelicz();
  } else {
    const v = liczba(t.value);
    const l = limity(S)[k];
    if (Number.isFinite(v) && v >= l[0] && v <= l[1]) {
      S[k] = v;
      przelicz();
    }
  }
});

panel.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'mont' || t.id === 'reuse') {
    S[t.id] = t.checked;
    ga.start(S.mode);
    przelicz(t.id !== 'reuse');
    return;
  }
  const k = t.dataset.k;
  if (!k || t.type === 'range') return;
  const v = liczba(t.value);
  if (Number.isFinite(v)) S[k] = v;
  przelicz();
  t.value = String(S[k]).replace('.', ',');
});

panel.addEventListener('keydown', (e) => {
  const t = e.target;
  const k = t.dataset.k;
  if (!k || t.type === 'range' || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
  e.preventDefault();
  S[k] = +S[k] + (e.key === 'ArrowUp' ? 0.5 : -0.5);
  przelicz();
  t.value = String(S[k]).replace('.', ',');
});

document.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const d = b.dataset;

  if (d.mode) {
    S.mode = d.mode;
    ga.start(S.mode);
    przelicz();
  } else if (d.side) {
    S[d.side] = !S[d.side];
    przelicz();
  } else if (d.pre) {
    const [a, c] = d.pre.split(',').map(Number);
    Object.assign(S, { L: a, W: c, sL: szerokoscZlewu(S, a), sW: c - 15 });
    ga.start(S.mode);
    przelicz();
  } else if (d.n) {
    const v = +d.n;
    if (v !== S.n) {
      S.n = v;
      S.sL = szerokoscZlewu(S, S.L);
      if (v === 2 && S.holes === 1) S.holes = 2;
      else if (v === 1 && S.holes === 2) S.holes = 1;
    }
    przelicz();
  } else if (d.dekor) {
    S.marka = d.marka;
    S.dekor = d.dekor;
    const g = grubosciDekoru(firma(), S.dekor);
    if (!g.includes(S.grubosc)) S.grubosc = d.grubosc || g[0];
    ga.start(S.mode);
    przelicz();
  } else if (d.grubosc) {
    S.grubosc = d.grubosc;
    przelicz();
  } else if (d.odcien) {
    odcienFiltr = odcienFiltr === d.odcien ? null : d.odcien;
    pelnyKatalog = false;
    rysujKamienie();
  } else if (d.view) {
    document.querySelectorAll('#views button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    podglad && podglad.widok(d.view);
  } else if (b.id === 'wszystkie') {
    pelnyKatalog = !pelnyKatalog;
    odcienFiltr = null;
    rysujKamienie();
  } else if (b.id === 'wym') {
    const on = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(on));
    podglad && podglad.pokazWymiary(on);
  } else if (b.id === 'ex') {
    const on = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(on));
    // Na telefonie dłuższa część etykiety jest ukryta w CSS — dzięki temu
    // przyciski mieszczą się w jednym rzędzie i nie zjadają sceny.
    b.innerHTML = on ? 'Złóż<span class="dlugie"> z powrotem</span>' : 'Rozłóż<span class="dlugie"> na formatki</span>';
    podglad && podglad.rozloz(on);
    rysujOdczyt();
  } else if (b.id === 'hm' || b.id === 'hp') {
    S.holes = Math.max(0, Math.min(3, S.holes + (b.id === 'hp' ? 1 : -1)));
    przelicz();
  } else if (b.id === 'toNieJa') {
    // Wspólny telefon albo komputer w salonie — da się wyjść z pamięci.
    zapomnijKlienta();
    rysuj();
    rysujFormularz();
  } else if (b.id === 'doForm' || b.id === 'doFormM') {
    $('#lead').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('#leadBox').querySelector('input')?.focus({ preventScroll: true });
  }
});

// Najechanie na wiersz formatki podświetla element na podglądzie.
const tabela = $('#cut');
tabela.addEventListener('mouseover', (e) => {
  const r = e.target.closest('tr');
  if (r && podglad) podglad.podswietl(r.dataset.k);
});
tabela.addEventListener('mouseleave', () => podglad && podglad.podswietl(przypiete));
tabela.addEventListener('click', (e) => {
  const r = e.target.closest('tr');
  if (!r) return;
  przypiete = przypiete === r.dataset.k ? null : r.dataset.k;
  tabela.querySelectorAll('tr').forEach((x) => x.classList.toggle('hl', x.dataset.k === przypiete));
  podglad && podglad.podswietl(przypiete);
});

$('#cookies')?.addEventListener('click', (e) => {
  e.preventDefault();
  zmienZgody();
});

// Dolny pasek chowa się, gdy karta z ceną i tak jest na ekranie.
try {
  const mb = $('#mbar');
  new IntersectionObserver((wpisy) => wpisy.forEach((x) => mb.classList.toggle('off', x.isIntersecting)), {
    threshold: 0.3,
  }).observe($('#total'));
} catch {
  /* bez obserwatora pasek po prostu zostaje */
}

/* ═════════════════════════════════════════════════════ start */

inicjujZgody();
sledzTelefony();
zapamietajZrodlo();

$('#dimsTop').innerHTML = ['L', 'W', 'H'].map(wierszWymiaru).join('');
$('#dimsSink').innerHTML = ['sL', 'gap', 'sW', 'ins'].map(wierszWymiaru).join('');
$('#presets').innerHTML = PRESETY.map((p) => `<button class="chip" data-pre="${p}">${p[0]} × ${p[1]}</button>`).join('');

czytajURL();
przelicz(false);
rysujFormularz();

// Stawki z panelu Dawida dochodzą po chwili — do tego czasu liczymy
// domyślnymi, więc nic nie mruga i nic nie czeka na sieć.
pobierzUstawienia()
  .then((zBazy) => {
    stawki = scalUstawienia(zBazy);
    zastosujUstawienia(FIRMY, zBazy);
    przelicz(false);
    rysujFormularz();
  })
  .catch(() => {});

// Podgląd 3D dociąga się osobno: strona i wycena działają, zanim wczyta się
// biblioteka — a gdy WebGL jest niedostępny, zostaje komunikat zastępczy.
uruchomPodglad({
  scena: $('#stage'),
  etykiety: $('#lab'),
  stan: () => S,
  wyglad,
})
  .then((p) => {
    podglad = p;
    if (!p) return brakPodgladu();
    // Podgląd gotowy — komunikat „przygotowuję" znika dopiero teraz,
    // żeby kadr nie stał pusty i nie wyglądał na zepsuty.
    $('#nogl').hidden = true;
    podglad.build(FORMATKI);
  })
  .catch(brakPodgladu);

function brakPodgladu() {
  const box = $('#nogl');
  if (!box) return;
  box.hidden = false;
  box.textContent =
    'Podgląd 3D jest niedostępny w tej przeglądarce. Wycena i lista formatek liczą się normalnie.';
}

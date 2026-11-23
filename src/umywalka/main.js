/**
 * KALKULATOR UMYWALEK — strona `/umywalka-na-wymiar`.
 *
 * Zasada konstrukcyjna: prosto na wierzchu, mądrze pod spodem. Jedna
 * decyzja na ekran, wszystko ma sensowne ustawienie domyślne — „Dalej"
 * zawsze działa jednym tapnięciem, a kto chce, rozwija „Więcej opcji".
 *
 * Cena liczy się w przeglądarce tym samym silnikiem co blaty, więc bryła,
 * znaczek połówki płyty i podpowiedzi reagują od razu na ruch suwaka.
 * Rysunek przerysowuje się natychmiast; pakowanie na płytę (droższe) jest
 * opóźnione o 120 ms, żeby przeciąganie suwaka było gładkie.
 *
 * Kwoty pojawiają się dopiero po formularzu — decyzja Dawida z 23.11.2026.
 * Przed nim klient widzi tylko kotwicę „od … zł" w kroku 1.
 *
 * ⚠ Ta strona nie dotyka kalkulatora blatów: korzysta z jego silnika,
 *   katalogu i klocków formularza, ale nie zmienia w nich niczego.
 */
import '../style.css';
import './umywalka.css';

import keralini from '../firms/keralini.js';
import avantQuartz from '../firms/avant-quartz.js';
import { h, zl } from '../app/dom.js';
import { inicjujZgody, zmienZgody } from '../analytics/zgody.js';
import { sledzTelefony } from '../analytics/zdarzenia.js';
import { zapamietajZrodlo } from '../app/zrodlo.js';
import { pobierzUstawienia } from '../api.js';
import { scalUstawienia, zastosujUstawienia } from '../app/ustawienia.js';
import { kolorDekoru } from '../app/kolory-dekorow.js';
import { grubosciDekoru } from '../firms/index.js';

import { STAN_DOMYSLNY, PRESETY, ZAKRESY, normalizuj, nieckaStanu } from './geometria.js';
import { wycenUmywalke, cenaOd } from './wycena-umywalki.js';
import { podpowiedz, znacznikPolowki } from './podpowiedzi.js';
import { svgBryly, svgRozlozenia, podlaczObrot } from './bryla.js';
import { POLECANE, ODCIENIE, START, probkaDekoru, wOdcieniu } from './dekory-polecane.js';
import { formularzUmywalki, potwierdzenieWyslania } from './formularz.js';
import { kartaCeny } from './wynik.js';
import * as ga from './zdarzenia.js';

const FIRMY = [keralini, avantQuartz];
const ILE_KROKOW = 4;
/* Kotwicę „od … zł" w kroku 1 da się wyłączyć bez zmian w kodzie strony. */
const POKAZ_OD = true;

const stan = {
  ...STAN_DOMYSLNY,
  marka: START.marka,
  dekor: START.dekor,
  grubosc: START.grubosc,
  L: 100,
  G: 50,
};

let krok = 1;
let obrot = -18;
let rozlozone = false;
let stawki = scalUstawienia(null);
let odcienFiltr = null;
let pelnyKatalog = false;
let wyslane = null;
let ostatniaWycena = null;

const firma = () => FIRMY.find((f) => f.slug === stan.marka) || FIRMY[0];

/* ═════════════════════════════════════════════════════ start */

inicjujZgody();
sledzTelefony();
zapamietajZrodlo();

const korzen = document.getElementById('umywalka');
const scena = document.getElementById('scena');
const panel = document.getElementById('panel');
const pasek = document.getElementById('pasek');

/* ═════════════════════════════════════════════════════ adres */

const slug = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function czytajURL() {
  const p = new URLSearchParams(location.search);
  if (!p.toString()) return;

  if (p.get('t')) stan.typ = p.get('t') === 'n' ? 'nablatowa' : 'zintegrowana';

  const w = (p.get('w') || '').match(/^(\d{2,3})x(\d{2,3})$/);
  if (w) {
    stan.L = Number(w[1]);
    stan.G = Number(w[2]);
  }

  const pg = p.get('p');
  if (pg === 'b') stan.pogrubienie = 'boki';
  else if (pg === 'f') stan.pogrubienie = 'front';
  else if (pg === 'x') stan.pogrubienie = 'brak';

  const d = (p.get('d') || '').split(':');
  if (d.length === 3) {
    const f = FIRMY.find((x) => x.slug === d[0]);
    const nazwa = f && Object.keys(f.dekory || {}).find((n) => slug(n) === d[1]);
    if (nazwa) {
      stan.marka = d[0];
      stan.dekor = nazwa;
      stan.grubosc = d[2];
    }
  }

  if (p.get('m')) stan.montaz = p.get('m') === '1';
  if (p.get('b')) stan.bateria = p.get('b') === 'sciana' ? 'sciana' : 'blat';
  if (p.get('h')) stan.H = Number(p.get('h')) || stan.H;
  if (p.get('k')) krok = Math.min(ILE_KROKOW, Math.max(1, Number(p.get('k')) || 1));

  Object.assign(stan, normalizuj(stan));
}

function adres() {
  const p = new URLSearchParams({
    t: stan.typ === 'nablatowa' ? 'n' : 'z',
    w: `${stan.L}x${stan.G}`,
    h: String(stan.H),
    p: { boki: 'b', front: 'f', brak: 'x' }[stan.pogrubienie] || 'b',
    d: `${stan.marka}:${slug(stan.dekor)}:${stan.grubosc}`,
    m: stan.montaz ? '1' : '0',
    b: stan.bateria,
  });
  return `${location.pathname}?${p}`;
}

function zapiszURL({ nowy } = {}) {
  const cel = `${adres()}&k=${krok}`;
  if (nowy) history.pushState({ krok }, '', cel);
  else history.replaceState({ krok }, '', cel);
}

/* ═════════════════════════════════════════════════════ przeliczanie */

let timerPakowania = null;

function wycena() {
  return wycenUmywalke({ firma: firma(), stan, stawki, dataISO: undefined });
}

/** Szybka ścieżka: sam rysunek i wymiar. Woła się przy każdym ruchu suwaka. */
function odswiezBryle() {
  const ramka = scena.querySelector('.bryla-ramka');
  if (!ramka) return;

  const probka = probkaDekoru(stan.marka, stan.dekor, kolorDekoru(stan.dekor, stan.marka));
  const rysunek = rozlozone
    ? svgRozlozenia({ stan, probka })
    : svgBryly({ stan, probka, obrot });
  ramka.replaceChildren(rysunek);

  const wymiar = scena.querySelector('.scena-wymiar');
  if (wymiar) wymiar.textContent = `${stan.L} × ${stan.G} × ${stan.H} cm`;
}

/** Wolna ścieżka: pakowanie na płytę, znaczek połówki i podpowiedź. */
function odswiezPodpowiedzi() {
  clearTimeout(timerPakowania);
  timerPakowania = setTimeout(() => {
    const w = wycena();
    ostatniaWycena = w.ok ? w : null;

    const znak = w.ok ? znacznikPolowki(w.pak) : null;
    const pole = scena.querySelector('.scena-znaczek');
    if (pole) {
      pole.textContent = znak ? znak.tekst : '';
      pole.hidden = !znak;
    }

    const rada = w.ok ? podpowiedz({ stan: w.stan, pak: w.pak, plyta: w.plyta }) : null;
    const box = scena.querySelector('.scena-rada');
    if (!box) return;
    box.replaceChildren();
    box.hidden = !rada;
    if (!rada) return;

    box.append(h('span', { class: 'rada-tekst' }, rada.tekst));
    if (rada.akcja) {
      box.append(
        h(
          'button',
          {
            class: 'btn-maly',
            type: 'button',
            onclick: () => {
              Object.assign(stan, normalizuj({ ...stan, ...rada.akcja.zmiana }));
              zapiszURL();
              rysuj();
            },
          },
          rada.akcja.etykieta
        )
      );
    }
  }, 120);
}

/* ═════════════════════════════════════════════════════ rysowanie */

function rysuj() {
  rysujScene();
  rysujPanel();
  rysujPasek();
  odswiezPodpowiedzi();
}

function rysujScene() {
  if (scena.querySelector('.bryla-ramka')) {
    odswiezBryle();
    return;
  }

  const ramka = h('div', {
    class: 'bryla-ramka',
    tabindex: '0',
    role: 'group',
    'aria-label': 'Podgląd umywalki — przeciągnij, aby obrócić',
  });

  const przelacznik = h(
    'button',
    {
      class: 'btn-przezroczysty',
      type: 'button',
      onclick: () => {
        rozlozone = !rozlozone;
        przelacznik.textContent = rozlozone ? 'Pokaż bryłę' : 'Rozłóż na części';
        przelacznik.setAttribute('aria-pressed', String(rozlozone));
        odswiezBryle();
      },
      'aria-pressed': 'false',
    },
    'Rozłóż na części'
  );

  scena.replaceChildren(
    ramka,
    h('div', { class: 'scena-wymiar' }, `${stan.L} × ${stan.G} × ${stan.H} cm`),
    h('div', { class: 'scena-znaczek', 'aria-live': 'polite', hidden: true }),
    h('div', { class: 'scena-rada', 'aria-live': 'polite', hidden: true }),
    h('div', { class: 'scena-narzedzia' }, przelacznik, h('span', { class: 'scena-hint' }, 'przeciągnij, aby obrócić'))
  );

  podlaczObrot(ramka, {
    odczyt: () => obrot,
    zapis: (v) => {
      obrot = v;
      if (!rozlozone) odswiezBryle();
    },
  });

  odswiezBryle();
}

function rysujPanel() {
  if (wyslane) return rysujWynik();

  const ekrany = { 1: krokRodzaj, 2: krokWymiar, 3: krokKamien, 4: krokWycena };
  panel.replaceChildren(ekrany[krok]());
  panel.scrollIntoView?.({ block: 'nearest' });
}

function rysujPasek() {
  if (wyslane || krok >= ILE_KROKOW) {
    pasek.replaceChildren();
    pasek.hidden = true;
    return;
  }

  pasek.hidden = false;
  pasek.replaceChildren(
    h('span', { class: 'pasek-krok' }, `Krok ${krok} z ${ILE_KROKOW}`),
    h(
      'button',
      {
        class: 'btn',
        type: 'button',
        onclick: () => idzDo(krok + 1),
      },
      krok === 3 ? 'Pokaż wycenę' : 'Dalej'
    )
  );
}

function idzDo(nowy) {
  krok = Math.min(ILE_KROKOW, Math.max(1, nowy));
  ga.krok(krok);
  zapiszURL({ nowy: true });
  rysuj();
  /*
   * Przewijamy do SCENY, nie na sam początek strony. Na telefonie nagłówek
   * z hasłem zajmuje prawie cały pierwszy ekran — skok na górę po każdym
   * kroku wyrzucałby klienta do nagłówka zamiast do pytania.
   */
  (scena || document.body).scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ═════════════════════════════════════════════════════ krok 1 */

function krokRodzaj() {
  const karta = (typ, tytul, opis) =>
    h(
      'button',
      {
        class: 'wybor-karta' + (stan.typ === typ ? ' wybrana' : ''),
        type: 'button',
        onclick: () => {
          stan.typ = typ;
          Object.assign(stan, normalizuj(stan));
          ga.start(typ);
          zapiszURL();
          idzDo(2);
        },
      },
      h('span', { class: 'wybor-rysunek' }, miniatura(typ)),
      h('span', { class: 'wybor-tytul' }, tytul),
      h('span', { class: 'wybor-opis' }, opis)
    );

  const od = POKAZ_OD ? cenaOd({ firmy: FIRMY, polecane: POLECANE, stawki }) : 0;

  return h(
    'section',
    { class: 'ekran' },
    naglowek('Jaką umywalkę robimy?', 'Wybierz rodzaj — wszystko inne ustawisz dalej.'),
    h(
      'div',
      { class: 'wybor-karty' },
      karta('zintegrowana', 'Zlew wycięty w kamieniu', 'Umywalka i blat z jednej płyty, bez łączeń.'),
      karta('nablatowa', 'Blat pod umywalkę nablatową', 'Kamienny blat, na nim Twoja umywalka.')
    ),
    od
      ? h(
          'p',
          { class: 'kotwica' },
          'Umywalka z kamienia na wymiar — od ',
          h('b', {}, zl(od)),
          ' z montażem.'
        )
      : null
  );
}

/** Mała bryła na kafelku wyboru — ten sam renderer, bez etykiet. */
function miniatura(typ) {
  const probka = probkaDekoru(stan.marka, stan.dekor, kolorDekoru(stan.dekor, stan.marka));
  return svgBryly({
    stan: { ...stan, typ, L: 120, G: 50, H: 15 },
    probka,
    obrot: -22,
    wymiary: false,
  });
}

/* ═════════════════════════════════════════════════════ krok 2 */

function krokWymiar() {
  const pigulki = h(
    'div',
    { class: 'pigulki' },
    PRESETY.map((p) =>
      h(
        'button',
        {
          class: 'pigulka' + (stan.L === p.L && stan.G === p.G ? ' wybrana' : ''),
          type: 'button',
          onclick: () => {
            Object.assign(stan, normalizuj({ ...stan, L: p.L, G: p.G }));
            zapiszURL();
            rysuj();
          },
        },
        `${p.L} cm`
      )
    )
  );

  return h(
    'section',
    { class: 'ekran' },
    naglowek('Jaki wymiar?', 'Zacznij od gotowego rozmiaru, potem dociągnij suwakiem.'),
    pigulki,
    suwak('Długość', 'L', ZAKRESY.L, 'cm'),
    pogrubienieWybor(),
    podsumowanieDomyslnych(),
    wiecejOpcji()
  );
}

function suwak(etykieta, klucz, [min, max], jednostka) {
  const id = `u-${klucz}`;
  const liczbowe = h('input', {
    type: 'number',
    id,
    class: 'suwak-liczba',
    value: stan[klucz],
    min,
    max: Math.max(max, stan[klucz]),
    step: '1',
    inputmode: 'numeric',
    'aria-label': `${etykieta} w ${jednostka}`,
  });

  const zakres = h('input', {
    type: 'range',
    class: 'suwak-zakres',
    value: stan[klucz],
    min,
    max,
    step: '1',
    'aria-labelledby': id,
  });

  const zmien = (wartosc, zrodlo) => {
    const v = Number(wartosc);
    if (!Number.isFinite(v)) return;
    stan[klucz] = Math.round(v);
    Object.assign(stan, normalizuj(stan));
    if (zrodlo !== 'liczba') liczbowe.value = stan[klucz];
    if (zrodlo !== 'zakres') zakres.value = Math.min(max, Math.max(min, stan[klucz]));
    zapiszURL();
    odswiezBryle();
    odswiezPodpowiedzi();
  };

  zakres.addEventListener('input', (e) => zmien(e.target.value, 'zakres'));
  liczbowe.addEventListener('input', (e) => zmien(e.target.value, 'liczba'));

  return h(
    'div',
    { class: 'pole-suwak' },
    h('label', { for: id }, etykieta),
    h('div', { class: 'suwak-rzad' }, zakres, liczbowe, h('span', { class: 'suwak-jednostka' }, jednostka))
  );
}

function pogrubienieWybor() {
  const opcje = [
    ['brak', 'Cienka krawędź', 'grubość samej płyty'],
    ['front', 'Gruby front', 'pogrubiony przód'],
    ['boki', 'Gruby front i boki', 'pogrubienie z trzech stron'],
  ].filter(([id]) => !(id === 'brak' && stan.typ === 'zintegrowana'));

  return h(
    'div',
    { class: 'pole-grupa' },
    h('span', { class: 'pole-etykieta' }, 'Krawędź'),
    h(
      'div',
      { class: 'kafelki' },
      opcje.map(([id, tytul, opis]) =>
        h(
          'button',
          {
            class: 'kafelek' + (stan.pogrubienie === id ? ' wybrany' : ''),
            type: 'button',
            onclick: () => {
              Object.assign(stan, normalizuj({ ...stan, pogrubienie: id }));
              zapiszURL();
              rysuj();
            },
          },
          h('span', { class: 'kafelek-rysunek' }, krawedzRysunek(id)),
          h('span', { class: 'kafelek-tytul' }, tytul),
          h('span', { class: 'kafelek-opis' }, opis)
        )
      )
    ),
    stan.typ === 'zintegrowana'
      ? h(
          'p',
          { class: 'pole-nota' },
          'Przy zlewie w kamieniu front zakrywa nieckę — dlatego zawsze jest pogrubiony.'
        )
      : null
  );
}

/** Mały przekrój krawędzi — czytelniejszy niż ikona. */
function krawedzRysunek(rodzaj) {
  const probka = probkaDekoru(stan.marka, stan.dekor, kolorDekoru(stan.dekor, stan.marka));
  return svgBryly({
    stan: {
      ...stan,
      typ: 'nablatowa',
      L: 60,
      G: 40,
      H: rodzaj === 'brak' ? 2 : 12,
      pogrubienie: rodzaj,
      bokL: true,
      bokP: true,
    },
    probka,
    obrot: -26,
    wymiary: false,
  });
}

function podsumowanieDomyslnych() {
  const opis = [
    stan.montaz ? 'Z montażem' : 'Odbiór własny',
    stan.mocowanie === 'szafka' ? 'na szafce' : 'podwieszana',
    stan.bateria === 'blat' ? 'bateria z blatu' : 'bateria ze ściany',
  ].join(' · ');

  const rozwiniete = h('div', { class: 'przelaczniki', hidden: true });
  rozwiniete.append(
    segment('Montaż', 'montaz', [
      [true, 'Z montażem'],
      [false, 'Odbiorę sam'],
    ]),
    segment('Mocowanie', 'mocowanie', [
      ['szafka', 'Na szafce'],
      ['podwieszana', 'Podwieszana'],
    ]),
    segment('Bateria', 'bateria', [
      ['blat', 'Z blatu'],
      ['sciana', 'Ze ściany'],
    ])
  );

  const link = h(
    'button',
    {
      class: 'link-zmien',
      type: 'button',
      onclick: () => {
        rozwiniete.hidden = !rozwiniete.hidden;
        link.textContent = rozwiniete.hidden ? 'zmień' : 'zwiń';
      },
    },
    'zmień'
  );

  return h(
    'div',
    { class: 'domyslne' },
    h('span', { class: 'domyslne-opis' }, opis),
    link,
    rozwiniete
  );
}

function segment(etykieta, klucz, opcje) {
  return h(
    'div',
    { class: 'segment' },
    h('span', { class: 'segment-etykieta' }, etykieta),
    h(
      'div',
      { class: 'segment-opcje' },
      opcje.map(([wartosc, tytul]) =>
        h(
          'button',
          {
            class: 'segment-opcja' + (stan[klucz] === wartosc ? ' wybrana' : ''),
            type: 'button',
            onclick: () => {
              stan[klucz] = wartosc;
              Object.assign(stan, normalizuj(stan));
              zapiszURL();
              rysuj();
            },
          },
          tytul
        )
      )
    )
  );
}

function wiecejOpcji() {
  const n = nieckaStanu(stan);
  const tresc = h('div', { class: 'wiecej-tresc', hidden: true });

  /*
   * `append` to goły DOM — `null` wszedłby na stronę jako napis „null"
   * (przerabiane w repozytorium 30.08.2026 na ofertach klientów). Stąd
   * `filter(Boolean)`, a nie warunki wprost w argumentach.
   */
  tresc.append(
    ...[
      suwak('Głębokość', 'G', ZAKRESY.G, 'cm'),
      suwak('Wysokość krawędzi', 'H', ZAKRESY.H, 'cm'),
      stan.pogrubienie === 'boki'
        ? h(
            'div',
            { class: 'pole-grupa' },
            h('span', { class: 'pole-etykieta' }, 'Pogrubione boki'),
            h(
              'div',
              { class: 'segment-opcje' },
              przelacznikBoku('bokL', 'Lewy'),
              przelacznikBoku('bokP', 'Prawy')
            )
          )
        : null,
      stan.typ === 'zintegrowana' ? nieckaPola(n) : null,
      grubosciPola(),
    ].filter(Boolean)
  );

  const przycisk = h(
    'button',
    {
      class: 'wiecej-przycisk',
      type: 'button',
      'aria-expanded': 'false',
      onclick: () => {
        const otwarte = tresc.hidden;
        tresc.hidden = !otwarte;
        przycisk.setAttribute('aria-expanded', String(otwarte));
        przycisk.textContent = otwarte ? 'Mniej opcji' : 'Więcej opcji';
      },
    },
    'Więcej opcji'
  );

  return h('div', { class: 'wiecej' }, przycisk, tresc);
}

function przelacznikBoku(klucz, tytul) {
  return h(
    'button',
    {
      class: 'segment-opcja' + (stan[klucz] ? ' wybrana' : ''),
      type: 'button',
      'aria-pressed': String(!!stan[klucz]),
      onclick: () => {
        stan[klucz] = !stan[klucz];
        zapiszURL();
        rysuj();
      },
    },
    tytul
  );
}

function nieckaPola(n) {
  const polePola = (etykieta, klucz, wartosc, min, max) => {
    const input = h('input', {
      type: 'number',
      class: 'suwak-liczba',
      value: wartosc,
      min,
      max,
      step: '1',
      inputmode: 'numeric',
    });
    input.addEventListener('input', () => {
      stan.niecka = { ...stan.niecka, [klucz]: Number(input.value) };
      Object.assign(stan, normalizuj(stan));
      odswiezBryle();
      odswiezPodpowiedzi();
      zapiszURL();
    });
    return h('div', { class: 'pole-male' }, h('label', {}, etykieta), input);
  };

  return h(
    'div',
    { class: 'pole-grupa' },
    h('span', { class: 'pole-etykieta' }, 'Zlew w kamieniu'),
    h(
      'div',
      { class: 'pola-rzad' },
      polePola('Długość', 'L', n.L, 40, stan.L - 16),
      polePola('Szerokość', 'G', n.G, 20, stan.G - 12),
      polePola('Głębokość', 'H', n.H, ZAKRESY.nieckaH[0], ZAKRESY.nieckaH[1])
    ),
    h('p', { class: 'pole-nota' }, 'Puste pola wyliczymy sami — zwykle tak jest najlepiej.')
  );
}

function grubosciPola() {
  const dostepne = grubosciDekoru(firma(), stan.dekor);
  if (dostepne.length < 2) return null;

  return h(
    'div',
    { class: 'pole-grupa' },
    h('span', { class: 'pole-etykieta' }, 'Grubość płyty'),
    h(
      'div',
      { class: 'segment-opcje' },
      dostepne.map((g) =>
        h(
          'button',
          {
            class: 'segment-opcja' + (stan.grubosc === g ? ' wybrana' : ''),
            type: 'button',
            onclick: () => {
              stan.grubosc = g;
              zapiszURL();
              rysuj();
            },
          },
          `${Number(g) / 10} cm`.replace('.', ',')
        )
      )
    )
  );
}

/* ═════════════════════════════════════════════════════ krok 3 */

function krokKamien() {
  const filtry = h(
    'div',
    { class: 'pigulki' },
    ODCIENIE.map((o) =>
      h(
        'button',
        {
          class: 'pigulka' + (odcienFiltr === o.id ? ' wybrana' : ''),
          type: 'button',
          onclick: () => {
            odcienFiltr = odcienFiltr === o.id ? null : o.id;
            rysujPanel();
          },
        },
        o.nazwa
      )
    )
  );

  const lista = pelnyKatalog ? wszystkieDekory() : POLECANE.filter((p) => wOdcieniu(p, odcienFiltr));

  const kafelki = h(
    'div',
    { class: 'dekory' },
    lista.map((p) =>
      h(
        'button',
        {
          class: 'dekor' + (stan.dekor === p.dekor && stan.marka === p.marka ? ' wybrany' : ''),
          type: 'button',
          onclick: () => {
            stan.marka = p.marka;
            stan.dekor = p.dekor;
            stan.grubosc = p.grubosc;
            zapiszURL();
            rysuj();
          },
        },
        h('span', {
          class: 'dekor-probka',
          style: `background:${p.probka}`,
          'aria-hidden': 'true',
        }),
        h('span', { class: 'dekor-nazwa' }, p.dekor),
        h('span', { class: 'dekor-marka' }, p.marka === 'keralini' ? 'Keralini' : 'Avant Quartz')
      )
    )
  );

  const ile = FIRMY.reduce((suma, f) => suma + Object.keys(f.dekory || {}).length, 0);

  return h(
    'section',
    { class: 'ekran' },
    naglowek('Z jakiego kamienia?', 'Dotknij wzoru — bryła od razu zmieni kolor.'),
    pelnyKatalog ? null : filtry,
    kafelki,
    h(
      'button',
      {
        class: 'link-zmien',
        type: 'button',
        onclick: () => {
          pelnyKatalog = !pelnyKatalog;
          odcienFiltr = null;
          rysujPanel();
        },
      },
      pelnyKatalog ? 'Pokaż krótką listę' : `Pokaż wszystkie (${ile})`
    ),
    h(
      'p',
      { class: 'pole-nota' },
      'Kolory na kafelkach są przybliżone. Prawdziwą próbkę pokażemy przy pomiarze, ' +
        'a wybrany wzór zobaczysz na projekcie 3D.'
    )
  );
}

function wszystkieDekory() {
  const lista = [];
  for (const f of FIRMY) {
    for (const nazwa of Object.keys(f.dekory || {})) {
      const grubosci = grubosciDekoru(f, nazwa);
      if (!grubosci.length) continue;
      lista.push({
        marka: f.slug,
        dekor: nazwa,
        grubosc: grubosci[0],
        probka: probkaDekoru(f.slug, nazwa, kolorDekoru(nazwa, f.slug)),
      });
    }
  }
  return lista.sort((a, b) => a.dekor.localeCompare(b.dekor, 'pl'));
}

/* ═════════════════════════════════════════════════════ krok 4 */

function krokWycena() {
  const w = wycena();
  if (!w.ok) {
    return h(
      'section',
      { class: 'ekran' },
      naglowek('Policzymy to indywidualnie', w.blad || 'Zadzwoń — podamy cenę od ręki.'),
      h('a', { class: 'btn', href: 'tel:+48796991128' }, 'Zadzwoń 796 991 128')
    );
  }

  ostatniaWycena = w;
  ga.formularz(w.razemZaokr);

  return h(
    'section',
    { class: 'ekran' },
    formularzUmywalki({
      wycena: w,
      link: location.origin + adres(),
      poWyslaniu: (dane) => {
        wyslane = dane;
        rysuj();
        (scena || document.body).scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
    })
  );
}

function rysujWynik() {
  const w = ostatniaWycena || wycena();
  panel.replaceChildren(
    h(
      'section',
      { class: 'ekran' },
      potwierdzenieWyslania({ ...wyslane, mailWyslany: wyslane.mailWyslany }),
      kartaCeny(w)
    )
  );
}

/* ═════════════════════════════════════════════════════ drobne */

function naglowek(tytul, podtytul) {
  return h(
    'header',
    { class: 'ekran-naglowek' },
    h('h2', {}, tytul),
    podtytul ? h('p', {}, podtytul) : null
  );
}

/* ═════════════════════════════════════════════════════ uruchomienie
 *
 * Start stoi NA KOŃCU pliku, a nie w połowie: funkcje są wynoszone na górę
 * modułu, ale `const` i `let` nie. Start z połowy pliku sięgał do stałych
 * zadeklarowanych niżej i strona wywracała się na „Cannot access … before
 * initialization" — rysunek był, podpowiedzi już nie.
 */

czytajURL();
rysuj();

// Stawki z panelu Dawida dochodzą po chwili — do tego czasu liczymy
// domyślnymi, więc nic nie mruga i nic nie czeka na sieć.
pobierzUstawienia()
  .then((zBazy) => {
    stawki = scalUstawienia(zBazy);
    zastosujUstawienia(FIRMY, zBazy);
    rysuj();
  })
  .catch(() => {});

window.addEventListener('popstate', () => {
  czytajURL();
  rysuj();
});

document.getElementById('cookies')?.addEventListener('click', (e) => {
  e.preventDefault();
  zmienZgody();
});

if (korzen) korzen.dataset.gotowe = '1';

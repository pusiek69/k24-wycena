/**
 * ROZRYS PŁYT — widok dla Dawida (tryb właściciela).
 *
 * Pokazuje, jak elementy blatu układają się na płytach: statystyki na
 * górze, rysunek każdej płyty z wymiarowaniem, tabela elementów i wersja
 * do druku. Liczy `engine/nesting.js` — tutaj jest wyłącznie rysowanie
 * i formularz elementów.
 *
 * Do czego to służy: sprawdzić PRZED zamówieniem płyt, ile ich naprawdę
 * potrzeba i czy nietypowy blat w ogóle się mieści. Wycena liczy metry
 * i zaokrągla do pełnych płyt — rozrys weryfikuje tę heurystykę realnym
 * układem i mówi wprost, gdy się rozjeżdżają.
 *
 * MVP celowo bez przeciągania elementów myszą i bez podkładania tekstury
 * płyty — to następny krok, gdy rozrys sprawdzi się w codziennej robocie.
 */
import { h, liczba } from './dom.js';
import { rozrysuj, DOMYSLNY_RZAZ_MM, DOMYSLNY_MARGINES_MM } from '../engine/nesting.js';

/** Kolory elementów — spokojne, rozróżnialne też na wydruku mono. */
const KOLORY = ['#8a6a2f', '#4a6d7c', '#6b5b7b', '#7c6a4a', '#4f7a5c', '#8a5a5a', '#5a6a8a'];

const mm = (n) => Math.round(Number(n) || 0);
const naM2 = (mm2) => mm2 / 1e6;

/**
 * @param {object} kontekst
 *   { elementy, plyta: {szer, wys, nazwa}, rotacja, rzaz, margines,
 *     plytZWyceny }  — wszystko w mm poza `plytZWyceny`
 * @param {Function} onZmiana  wywoływane po edycji elementów/opcji
 */
export function widokRozrysu(kontekst, onZmiana) {
  const { elementy, plyta, rotacja, rzaz, margines, plytZWyceny, opisMaterialu } = kontekst;
  const wynik = rozrysuj(elementy, plyta, { rotacja, rzaz, margines });

  return h(
    'div',
    { class: 'rozrys' },
    naglowek(wynik, plyta, opisMaterialu),
    ostrzezenia(wynik, plytZWyceny),
    ustawieniaCiecia(kontekst, onZmiana),
    formularzElementow(kontekst, onZmiana),
    ...wynik.plyty.map((p) => rysunekPlyty(p, opisMaterialu)),
    tabelaElementow(elementy, wynik)
  );
}

/* ───────────────────────────────────────────────────── statystyki */

function naglowek(wynik, plyta, opisMaterialu) {
  const s = wynik.statystyki;
  return h(
    'div',
    { class: 'rozrys-naglowek' },
    h('div', { class: 'q-kicker' }, 'Rozrys płyt' + (opisMaterialu ? ` · ${opisMaterialu}` : '')),
    h(
      'div',
      { class: 'rozrys-staty' },
      staty('Wykorzystane płyty', s.plyt),
      staty('Powierzchnia płyt', `${liczba(s.plytM2, 2)} m²`),
      staty('Powierzchnia elementów', `${liczba(s.elementyM2, 2)} m²`),
      staty('Odpad', `${liczba(s.odpadM2, 2)} m²`),
      staty('Wykorzystanie', `${liczba(s.wykorzystanieProc, 1)}%`),
      staty('Format płyty', `${mm(plyta.szer)} × ${mm(plyta.wys)} mm`)
    )
  );
}

const staty = (etykieta, wartosc) =>
  h('div', { class: 'rozrys-stat' }, h('span', {}, etykieta), h('b', {}, String(wartosc)));

/**
 * Rozrys kontra heurystyka wyceny. W MVP niczego nie przeliczamy —
 * Dawid ma zobaczyć różnicę i sam zdecydować (świadoma decyzja: cena
 * nie może zmieniać się sama pod klientem, który już dostał ofertę).
 */
function ostrzezenia(wynik, plytZWyceny) {
  const uwagi = [];
  const s = wynik.statystyki;

  if (plytZWyceny > 0 && s.plyt > 0 && s.plyt !== plytZWyceny) {
    uwagi.push(
      s.plyt > plytZWyceny
        ? `Rozrys potrzebuje ${s.plyt} płyt, a wycena policzyła ${plytZWyceny}. ` +
            'Przy tym układzie materiału zabraknie — sprawdź wycenę przed wysłaniem.'
        : `Rozrys mieści wszystko na ${s.plyt} płytach, a wycena liczy ${plytZWyceny}. ` +
            'Wycena jest bezpieczna, ale jest pole do upustu.'
    );
  }

  for (const el of wynik.nieumieszczone) {
    uwagi.push(
      el.powod === 'wiekszy-od-plyty'
        ? `„${el.nazwa}" (${mm(el.szer)} × ${mm(el.gl)} mm) nie mieści się na płycie — ` +
            'trzeba go podzielić na kawałki albo wziąć większy format.'
        : `„${el.nazwa}" nie zmieścił się w rozrysie (${el.powod}).`
    );
  }

  if (!uwagi.length) return null;
  return h('div', { class: 'rozrys-uwagi' }, ...uwagi.map((u) => h('div', { class: 'info' }, u)));
}

/* ────────────────────────────────────── parametry cięcia i elementy */

function ustawieniaCiecia(k, onZmiana) {
  return h(
    'div',
    { class: 'od-siatka rozrys-opcje' },
    polePrzy(
      'Rzaz piły (mm)',
      h('input', {
        type: 'number', min: '0', max: '20', value: k.rzaz,
        onchange: (e) => onZmiana({ rzaz: Number(e.target.value) || 0 }),
      })
    ),
    polePrzy(
      'Margines płyty (mm)',
      h('input', {
        type: 'number', min: '0', max: '100', value: k.margines,
        onchange: (e) => onZmiana({ margines: Number(e.target.value) || 0 }),
      })
    ),
    h(
      'label',
      { class: 'switch zgoda rozrys-uslojenie' },
      h('input', {
        type: 'checkbox',
        checked: !k.rotacja ? 'checked' : undefined,
        onchange: (e) => onZmiana({ rotacja: !e.target.checked }),
      }),
      h('span', { class: 'box' }, '✓'),
      h(
        'span',
        { class: 'zgoda-txt' },
        'Zachowaj kierunek usłojenia (bez obracania elementów o 90°) — ' +
          'przy kamieniach z wyraźnym rysunkiem i book-matchu obowiązkowo.'
      )
    )
  );
}

function formularzElementow(k, onZmiana) {
  const zmien = (i, pole, wartosc) => {
    const kopia = k.elementy.map((el, j) => (i === j ? { ...el, [pole]: wartosc } : el));
    onZmiana({ elementy: kopia });
  };

  return h(
    'div',
    { class: 'rozrys-elementy' },
    h('div', { class: 'q-kicker' }, 'Elementy do rozrysu (mm)'),
    ...k.elementy.map((el, i) =>
      h(
        'div',
        { class: 'rozrys-wiersz' },
        h('input', {
          type: 'text', value: el.nazwa, 'aria-label': 'nazwa elementu',
          onchange: (e) => zmien(i, 'nazwa', e.target.value),
        }),
        h('input', {
          type: 'number', value: el.szer, 'aria-label': 'szerokość', min: '1',
          onchange: (e) => zmien(i, 'szer', Number(e.target.value) || 0),
        }),
        h('span', {}, '×'),
        h('input', {
          type: 'number', value: el.gl, 'aria-label': 'głębokość', min: '1',
          onchange: (e) => zmien(i, 'gl', Number(e.target.value) || 0),
        }),
        h('input', {
          type: 'number', value: el.ilosc || 1, 'aria-label': 'ilość', min: '1', max: '20',
          onchange: (e) => zmien(i, 'ilosc', Math.max(1, Number(e.target.value) || 1)),
        }),
        h(
          'button',
          {
            class: 'link-btn', type: 'button', title: 'Usuń element',
            onclick: () => onZmiana({ elementy: k.elementy.filter((_, j) => j !== i) }),
          },
          '✕'
        )
      )
    ),
    h(
      'button',
      {
        class: 'link-btn', type: 'button',
        onclick: () =>
          onZmiana({
            elementy: [...k.elementy, { nazwa: 'Nowy element', szer: 1000, gl: 600, ilosc: 1 }],
          }),
      },
      '+ dodaj element'
    )
  );
}

const polePrzy = (etykieta, kontrolka) =>
  h('div', { class: 'pole' }, h('label', {}, etykieta), kontrolka);

/* ─────────────────────────────────────────────── rysunek płyty (SVG) */

/**
 * Rysunek jest skalowany do szerokości kontenera przez `viewBox`, więc
 * ten sam SVG dobrze wygląda na telefonie i na wydruku A4.
 * Wokół płyty zostawiamy pas na wymiary — stąd `RAMKA`.
 */
const RAMKA = 90;

function rysunekPlyty(p, opisMaterialu) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `${-RAMKA} ${-RAMKA} ${p.szer + 2 * RAMKA} ${p.wys + 2 * RAMKA}`);
  svg.setAttribute('class', 'rozrys-svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Płyta ${p.nr}: rozrys elementów`);

  const el = (nazwa, atrybuty, tekst) => {
    const w = document.createElementNS('http://www.w3.org/2000/svg', nazwa);
    for (const [k, v] of Object.entries(atrybuty)) w.setAttribute(k, String(v));
    if (tekst != null) w.textContent = tekst;
    svg.appendChild(w);
    return w;
  };

  // Płyta i margines użyteczny.
  el('rect', { x: 0, y: 0, width: p.szer, height: p.wys, fill: '#f2efe9', stroke: '#8a8578', 'stroke-width': 6 });
  if (p.margines > 0) {
    el('rect', {
      x: p.margines, y: p.margines,
      width: p.szer - 2 * p.margines, height: p.wys - 2 * p.margines,
      fill: 'none', stroke: '#c9b998', 'stroke-width': 3, 'stroke-dasharray': '24 18',
    });
  }

  // Wymiary płyty: nad i z lewej.
  el('text', { x: p.szer / 2, y: -30, 'text-anchor': 'middle', 'font-size': 58, fill: '#4a463d' }, `${mm(p.szer)} mm`);
  el(
    'text',
    { x: -34, y: p.wys / 2, 'text-anchor': 'middle', 'font-size': 58, fill: '#4a463d',
      transform: `rotate(-90 ${-34} ${p.wys / 2})` },
    `${mm(p.wys)} mm`
  );

  p.elementy.forEach((e, i) => {
    const kolor = KOLORY[i % KOLORY.length];
    el('rect', {
      x: e.x, y: e.y, width: e.szer, height: e.gl,
      fill: kolor, 'fill-opacity': 0.18, stroke: kolor, 'stroke-width': 5, rx: 4,
    });
    const srodekX = e.x + e.szer / 2;
    const srodekY = e.y + e.gl / 2;
    el('text', { x: srodekX, y: srodekY - 8, 'text-anchor': 'middle', 'font-size': 52, 'font-weight': 'bold', fill: '#2b2823' }, e.nazwa);
    el('text', { x: srodekX, y: srodekY + 52, 'text-anchor': 'middle', 'font-size': 46, fill: '#4a463d' },
      `${mm(e.szer)} × ${mm(e.gl)}${e.obrocony ? ' ↻' : ''}`);
  });

  const wykorzystanie = p.szer * p.wys > 0 ? (p.poleElementowMm2 / (p.szer * p.wys)) * 100 : 0;

  return h(
    'div',
    { class: 'rozrys-plyta' },
    h(
      'div',
      { class: 'rozrys-plyta-tytul' },
      h('b', {}, `Płyta ${p.nr}`),
      opisMaterialu ? h('span', {}, ' — ' + opisMaterialu) : null,
      h('span', { class: 'mini' }, ` · ${p.elementy.length} elem. · ${liczba(naM2(p.poleElementowMm2), 2)} m² · ${liczba(wykorzystanie, 1)}% wykorzystania`)
    ),
    svg
  );
}

/* ────────────────────────────────────────────────── tabela elementów */

function tabelaElementow(elementy, wynik) {
  const gdzie = new Map();
  for (const p of wynik.plyty) {
    for (const e of p.elementy) gdzie.set(e.id, p.nr);
  }

  const wiersze = [];
  let lp = 0;
  for (const el of elementy) {
    const ile = Math.max(1, Math.round(Number(el.ilosc) || 1));
    for (let i = 0; i < ile; i++) {
      lp += 1;
      const id = `${el.id || el.nazwa || 'el'}-${i + 1}`;
      const nrPlyty = gdzie.get(id);
      wiersze.push(
        h(
          'tr',
          {},
          h('td', {}, String(lp)),
          h('td', {}, ile > 1 ? `${el.nazwa} ${i + 1}` : el.nazwa),
          h('td', {}, `${mm(el.szer)} × ${mm(el.gl)} mm`),
          h('td', {}, `${liczba((el.szer * el.gl) / 1e6, 3)} m²`),
          h('td', {}, nrPlyty ? `Płyta ${nrPlyty}` : '— nie mieści się')
        )
      );
    }
  }

  return h(
    'table',
    { class: 'rozrys-tabela' },
    h(
      'thead',
      {},
      h('tr', {}, ...['Lp.', 'Nazwa', 'Wymiary', 'Powierzchnia', 'Płyta'].map((t) => h('th', {}, t)))
    ),
    h('tbody', {}, ...wiersze)
  );
}

/* ───────────────────────────────────── elementy z parametrów wyceny */

/**
 * Odcinki blatu z wyceny → elementy rozrysu. Kalkulator trzyma centymetry
 * (głębokość × długość), rozrys milimetry (szerokość × głębokość).
 */
export function elementyZOdcinkow(odcinki) {
  return (odcinki || [])
    .filter((o) => Number(o.dl) > 0 && Number(o.gl) > 0)
    .map((o, i) => ({
      id: `blat-${i + 1}`,
      nazwa: `Blat ${i + 1}`,
      szer: Math.round(Number(o.dl) * 10),
      gl: Math.round(Number(o.gl) * 10),
      ilosc: 1,
    }));
}

export { DOMYSLNY_RZAZ_MM, DOMYSLNY_MARGINES_MM };

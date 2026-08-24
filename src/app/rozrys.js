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
import { svgPlyty, tytulPlyty, mm, naM2 } from './rozrys-svg.js';

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
    ...wynik.plyty.map((p) => h('div', { class: 'rozrys-plyta' }, tytulPlyty(p, opisMaterialu), svgPlyty(p))),
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

/* ─────────────────────────────────────────────── tabela elementów */

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

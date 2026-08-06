import { h, zl, liczba, uprosc } from './dom.js';
import { FIRMY, grubosciDekoru } from '../firms/index.js';
import { wycen } from '../engine/wycena.js';
import { upakuj, opisPlyt } from '../engine/pakowanie.js';
import { zdarzenie } from '../analytics/zdarzenia.js';
import { bramkaWyceny } from './bramka.js';

const TEL = '796 991 128';
const TEL_HREF = 'tel:+48796991128';

/* ============================ 1. MATERIAŁ ============================ */

export function krokMaterial(stan, a) {
  return karta(
    'Krok 1 z 4',
    'Z czego ma być blat?',
    'Wybierz materiał — przy każdym podpowiadamy, czym się wyróżnia. Wszystkie ceny w kreatorze są brutto.',
    h(
      'div',
      { class: 'choices cols-2' },
      FIRMY.map((f) => {
        return h(
          'button',
          {
            class: 'choice' + (stan.firma === f.slug ? ' sel' : ''),
            type: 'button',
            onclick: () => a.wybierzFirme(f.slug),
          },
          h(
            'div',
            { class: 'c-top' },
            h('span', { class: 'c-name' }, f.nazwa),
            h('span', { class: 'c-tag' }, f.typ)
          ),
          h('span', { class: 'c-desc' }, f.krotki)
        );
      })
    )
  );
}

/* ============================= 2. DEKOR ============================= */

export function krokDekor(stan, a) {
  const f = a.firma();

  if (f.trybCeny === 'reczna') return krokKamienNaturalny(stan, a, f);

  const lista = przygotujDekory(f);
  const box = h('div', {});

  const szukaj = h('input', {
    class: 'search',
    type: 'search',
    placeholder: 'Szukaj dekoru, np. Calacatta…',
    value: stan.szukaj || '',
    oninput: (e) => {
      stan.szukaj = e.target.value;
      rysujDekory(box, lista, stan, a, f);
    },
  });

  rysujDekory(box, lista, stan, a, f);

  return karta(
    'Krok 2 z 4',
    `${f.nazwa} — który dekor?`,
    f.opis,
    h(
      'div',
      { class: 'tools' },
      szukaj,
      h(
        'a',
        { class: 'link-btn', href: f.linkDekory.url, target: '_blank', rel: 'noopener' },
        '↗ ' + f.linkDekory.label
      ),
      (f.linkiDodatkowe || []).map((l) =>
        h('a', { class: 'link-btn', href: l.url, target: '_blank', rel: 'noopener' }, '↗ ' + l.label)
      )
    ),
    box,
    nawigacja(a, { wstecz: 'material', dalejBlokada: true })
  );
}

/** Dekory posortowane wg ceny + podział na grupy cenowe. */
function przygotujDekory(f) {
  const poz = Object.entries(f.dekory || {}).map(([nazwa, ceny]) => {
    const dostepne = Object.entries(ceny).filter(([g]) => !(f.pomijGrubosci || []).includes(g));
    const min = Math.min(...dostepne.map(([, c]) => c));
    return { nazwa, min, grubosci: dostepne.map(([g]) => g) };
  });
  return poz.filter((p) => Number.isFinite(p.min)).sort((x, y) => x.min - y.min || x.nazwa.localeCompare(y.nazwa, 'pl'));
}

function rysujDekory(box, lista, stan, a, f) {
  box.replaceChildren();
  const vat = 1 + (f.vat ?? 0.23);
  const q = uprosc(stan.szukaj || '');
  const widoczne = q ? lista.filter((p) => uprosc(p.nazwa).includes(q)) : lista;

  if (!widoczne.length) {
    box.append(
      h(
        'p',
        { class: 'pusto' },
        `Nie mamy dekoru „${stan.szukaj}" w kolekcji ${f.nazwa}. Sprawdź pisownię, obejrzyj pełną kolekcję pod linkiem powyżej albo zadzwoń — mamy dostęp do wszystkich marek na rynku (tel. ${TEL}).`
      )
    );
    return;
  }

  const przycisk = (p) =>
    h(
      'button',
      {
        class: 'dekor' + (stan.dekor === p.nazwa ? ' sel' : ''),
        type: 'button',
        onclick: () => a.wybierzDekor(p.nazwa),
      },
      h('span', {}, p.nazwa)
    );

  if (q || widoczne.length < 9) {
    box.append(h('div', { class: 'dekory', style: 'margin-top:18px' }, widoczne.map(przycisk)));
    return;
  }

  for (const g of grupyCenowe(widoczne, vat)) {
    box.append(
      h('div', { class: 'grupa-tytul' }, g.nazwa),
      h('div', { class: 'dekory' }, g.poz.map(przycisk))
    );
  }
}

/** Trzy grupy cenowe wg tercyli — klient od razu widzi „tańsze / droższe". */
function grupyCenowe(poz, vat) {
  const n = poz.length;
  const a = poz.slice(0, Math.round(n / 3));
  const b = poz.slice(Math.round(n / 3), Math.round((2 * n) / 3));
  const c = poz.slice(Math.round((2 * n) / 3));
  return [
    { nazwa: 'Najkorzystniejsze cenowo', poz: a },
    { nazwa: 'Środek stawki', poz: b },
    { nazwa: 'Premium', poz: c },
  ].filter((g) => g.poz.length);
}

/* -------------------- 2b. KAMIEŃ NATURALNY (cena ręczna) -------------------- */

function krokKamienNaturalny(stan, a, f) {
  return karta(
    'Krok 2 z 4',
    f.reczna.naglowek,
    f.reczna.opis,
    h(
      'div',
      { class: 'tools' },
      h('a', { class: 'link-btn', href: f.linkDekory.url, target: '_blank', rel: 'noopener' }, '↗ ' + f.linkDekory.label),
      (f.linkiDodatkowe || []).map((l) =>
        h('a', { class: 'link-btn', href: l.url, target: '_blank', rel: 'noopener' }, '↗ ' + l.label)
      )
    ),
    h(
      'div',
      { class: 'odcinki' },
      h(
        'div',
        { class: 'odcinek', style: 'grid-template-columns:1fr 1fr' },
        pole('Nazwa kamienia (jeśli już wybrany)', {
          type: 'text',
          value: stan.dekor || '',
          placeholder: 'np. Granit Steel Grey',
          oninput: (e) => (stan.dekor = e.target.value),
        }),
        pole(f.reczna.etykietaPola, {
          type: 'number',
          inputmode: 'decimal',
          min: '0',
          step: '10',
          value: stan.cenaRecznaM2 || '',
          placeholder: 'zł / m²',
          oninput: (e) => (stan.cenaRecznaM2 = e.target.value),
        })
      )
    ),
    h(
      'div',
      { class: 'info' },
      'Nie ma Pan/Pani jeszcze wybranej płyty? ',
      h('b', {}, 'Można iść dalej bez ceny'),
      ' — policzymy obróbkę i montaż, a materiał wycenimy po obejrzeniu płyt. ',
      `Zapraszamy na plac w Tarnobrzegu albo dzwońmy: ${TEL}.`
    ),
    nawigacja(a, { wstecz: 'material', dalej: 'wymiary' })
  );
}

/* ============================ 3. WYMIARY ============================ */

export function krokWymiary(stan, a) {
  const f = a.firma();
  const grubosci = f.trybCeny === 'reczna'
    ? Object.keys(f.opisGrubosci || { 20: '' })
    : grubosciDekoru(f, stan.dekor);

  if (grubosci.length && !grubosci.includes(String(stan.grubosc))) {
    stan.grubosc = grubosci.includes('20') ? '20' : grubosci[0];
  }

  const podsumowanie = h('div', { class: 'info' });
  const szkic = h('div', { class: 'szkic' });
  const odswiez = () => {
    odswiezPodsumowanie(podsumowanie, szkic, stan, f);
  };

  const listaOdcinkow = h('div', { class: 'odcinki' });
  const rysujOdcinki = () => {
    listaOdcinkow.replaceChildren(
      ...stan.odcinki.map((o, i) =>
        h(
          'div',
          { class: 'odcinek' },
          h('div', { class: 'nr' }, `Odcinek ${i + 1}`),
          pole('Długość', {
            type: 'number',
            inputmode: 'numeric',
            min: '1',
            step: '1',
            value: o.dl,
            oninput: (e) => {
              o.dl = Number(e.target.value) || 0;
              odswiez();
            },
          }, 'cm'),
          pole('Głębokość', {
            type: 'number',
            inputmode: 'numeric',
            min: '1',
            step: '1',
            value: o.gl,
            oninput: (e) => {
              o.gl = Number(e.target.value) || 0;
              odswiez();
            },
          }, 'cm'),
          stan.odcinki.length > 1
            ? h('button', {
                class: 'icon-btn',
                type: 'button',
                title: 'Usuń odcinek',
                'aria-label': `Usuń odcinek ${i + 1}`,
                onclick: () => {
                  stan.odcinki.splice(i, 1);
                  rysujOdcinki();
                  odswiez();
                },
              }, '×')
            : null
        )
      ),
      h('button', {
        class: 'dodaj',
        type: 'button',
        onclick: () => {
          const ost = stan.odcinki[stan.odcinki.length - 1];
          stan.odcinki.push({ dl: 120, gl: ost ? ost.gl : 62 });
          rysujOdcinki();
          odswiez();
        },
      }, '+ dodaj kolejny odcinek (np. wyspa albo blat pod oknem)')
    );
  };
  rysujOdcinki();
  odswiez();

  return karta(
    'Krok 3 z 4',
    'Jakie wymiary?',
    'Podaj każdy prosty odcinek blatu osobno — blat w literę L to dwa odcinki. ' +
      'Typowa głębokość blatu kuchennego to 60–65 cm. Wymiary mogą być przybliżone, dokładne bierzemy na pomiarze.',

    grubosci.length > 1
      ? h(
          'div',
          {},
          h('div', { class: 'grupa-tytul' }, 'Grubość blatu'),
          h(
            'div',
            { class: 'choices cols-2' },
            grubosci.map((g) =>
              h(
                'button',
                {
                  class: 'choice' + (String(stan.grubosc) === String(g) ? ' sel' : ''),
                  type: 'button',
                  onclick: () => a.ustawGrubosc(g),
                },
                h('span', { class: 'c-name' }, `${g} mm`),
                h('span', { class: 'c-desc' }, (f.opisGrubosci || {})[g] || '')
              )
            )
          )
        )
      : null,

    h('div', { class: 'grupa-tytul' }, 'Odcinki blatu'),
    listaOdcinkow,
    szkic,
    podsumowanie,
    nawigacja(a, { wstecz: 'dekor', dalej: 'obrobki' })
  );
}

function odswiezPodsumowanie(box, szkic, stan, f) {
  const pak = upakuj(stan.odcinki, f.plyta, f.narzutOdpad ?? 0.1);
  box.replaceChildren();
  if (!pak.m2Blatu) {
    box.append('Podaj wymiary przynajmniej jednego odcinka.');
    szkic.replaceChildren();
    return;
  }
  const czesci = [
    h('b', {}, `${liczba(pak.mb)} m.b.`),
    ` blatu · ${liczba(pak.m2Blatu)} m² powierzchni`,
  ];
  if (f.rozliczenieMaterialu !== 'metraz') {
    czesci.push(` · materiał do zamówienia: `, h('b', {}, opisPlyt(pak)));
  }
  box.append(...czesci);
  if (pak.ostrzezenia.length) {
    box.append(h('div', { style: 'margin-top:8px;color:#d0a24a;font-size:14px' }, pak.ostrzezenia.join(' ')));
  }
  szkic.replaceChildren(rysunek(stan.odcinki));
}

/** Prosty rysunek poglądowy odcinków (do skali względem najdłuższego). */
function rysunek(odcinki) {
  const wazne = odcinki.filter((o) => o.dl > 0 && o.gl > 0);
  if (!wazne.length) return h('div', {});
  const maxDl = Math.max(...wazne.map((o) => o.dl));
  const W = 640;
  const skala = (W - 20) / maxDl;
  let y = 6;
  const el = [];
  for (const [i, o] of wazne.entries()) {
    const w = Math.max(12, o.dl * skala);
    const wys = Math.max(14, Math.min(60, o.gl * skala));
    el.push(
      `<rect x="10" y="${y}" width="${w.toFixed(1)}" height="${wys.toFixed(1)}" fill="#272320" stroke="#c9a86a" stroke-width="1"/>`,
      `<text x="${(10 + w / 2).toFixed(1)}" y="${(y + wys / 2 + 4).toFixed(1)}" fill="#b6ad9d" font-size="12" font-family="Helvetica Neue,Arial" text-anchor="middle">${o.dl} × ${o.gl} cm</text>`
    );
    y += wys + 10;
    if (i > 5) break;
  }
  return h('div', {
    html: `<svg viewBox="0 0 ${W} ${y}" role="img" aria-label="Szkic odcinków blatu">${el.join('')}</svg>`,
  });
}

/* ============================ 4. OBRÓBKI ============================ */

export function krokObrobki(stan, a) {
  const f = a.firma();
  return karta(
    'Krok 4 z 4',
    'Co jeszcze robimy przy blacie?',
    'Zaznacz to, co ma być w wycenie. Zlewów i płyt grzewczych nie sprzedajemy — wycinamy otwory pod sprzęt klienta.',
    h(
      'div',
      { class: 'opcje' },
      (f.opcje || []).map((o) => opcjaWidok(o, stan, a, f))
    ),
    nawigacja(a, { wstecz: 'wymiary', dalej: 'wynik', dalejLabel: 'Pokaż wycenę →' })
  );
}

function opcjaWidok(o, stan, a, f) {
  const vat = 1 + (f.vat ?? 0.23);
  const cenaBrutto = (c) => ((f.cenyUslug || 'brutto') === 'netto' ? c * vat : c);

  if (o.typ === 'wybor') {
    return h(
      'div',
      { class: 'opcja' },
      h('div', { class: 'o-head' }, h('span', { class: 'o-name' }, o.label)),
      o.opis ? h('div', { class: 'o-desc' }, o.opis) : null,
      h(
        'div',
        { class: 'o-warianty' },
        o.warianty.map((wv) =>
          h(
            'button',
            {
              class: 'wariant' + (stan.opcje[o.id] === wv.id ? ' sel' : ''),
              type: 'button',
              onclick: () => a.ustawOpcje(o.id, wv.id),
            },
            wv.label + (wv.cena ? ` · ${zl(cenaBrutto(wv.cena))}` : '')
          )
        )
      )
    );
  }

  if (o.typ === 'liczba') {
    return h(
      'div',
      { class: 'opcja' },
      h(
        'div',
        { class: 'o-head' },
        h('span', { class: 'o-name' }, o.label),
        h('span', { class: 'c-tag' }, `${zl(cenaBrutto(o.cena))} / ${o.jednostka}`)
      ),
      o.opis ? h('div', { class: 'o-desc' }, o.opis) : null,
      h(
        'div',
        { class: 'qty' },
        h('input', {
          class: 'search',
          type: 'number',
          inputmode: 'decimal',
          min: '0',
          max: String(o.max ?? 99),
          step: '0.5',
          value: stan.opcje[o.id] || 0,
          oninput: (e) => (stan.opcje[o.id] = e.target.value),
        }),
        h('span', { class: 'unit' }, o.jednostka)
      )
    );
  }

  return h(
    'div',
    { class: 'opcja' },
    h(
      'label',
      { class: 'switch' },
      h('input', {
        type: 'checkbox',
        checked: !!stan.opcje[o.id],
        onchange: (e) => a.ustawOpcje(o.id, e.target.checked, false),
      }),
      h('span', { class: 'box' }, '✓'),
      h(
        'span',
        {},
        h('span', { class: 'o-name' }, o.label),
        h(
          'span',
          { class: 'c-tag', style: 'margin-left:10px' },
          `${zl(cenaBrutto(o.cena))}${o.per === 'm2' ? ' / m²' : o.per === 'mb' ? ' / m.b.' : ''}`
        ),
        o.opis ? h('div', { class: 'o-desc' }, o.opis) : null
      )
    )
  );
}

/* ============================= 5. WYNIK ============================= */

export function krokWynik(stan, a) {
  const f = a.firma();
  const w = wycen(f, {
    dekor: stan.dekor,
    grubosc: stan.grubosc,
    odcinki: stan.odcinki,
    opcje: stan.opcje,
    cenaRecznaM2: stan.cenaRecznaM2,
  });

  if (!w.ok) {
    return karta('Wycena', 'Brakuje jeszcze danych', w.blad, nawigacja(a, { wstecz: 'wymiary' }));
  }

  // Kwota odsłania się dopiero po zostawieniu kontaktu — tak samo jak
  // w rozmowie z konsultantem. Jedna zasada dla obu ścieżek.
  return karta(
    null,
    null,
    null,
    bramkaWyceny(w),
    h(
      'div',
      { class: 'nav' },
      h('button', { class: 'btn ghost', type: 'button', onclick: () => a.idz('obrobki') }, '← Popraw dane'),
      h('button', { class: 'btn ghost', type: 'button', onclick: () => a.odNowa() }, 'Nowa wycena')
    )
  );
}

/* ============================ WSPÓLNE ============================ */

function karta(kicker, tytul, podpowiedz, ...tresc) {
  return h(
    'section',
    { class: 'card fade' },
    kicker ? h('div', { class: 'q-kicker' }, kicker) : null,
    tytul ? h('h2', { class: 'q-title' }, tytul) : null,
    podpowiedz ? h('p', { class: 'q-hint' }, podpowiedz) : null,
    tresc
  );
}

function pole(etykieta, props, jednostka) {
  return h(
    'div',
    { class: 'pole' },
    h('label', {}, etykieta + (jednostka ? ` (${jednostka})` : '')),
    h('input', props)
  );
}

function nawigacja(a, { wstecz, dalej, dalejLabel, dalejBlokada } = {}) {
  return h(
    'div',
    { class: 'nav' },
    wstecz ? h('button', { class: 'btn ghost', type: 'button', onclick: () => a.idz(wstecz) }, '← Wstecz') : null,
    dalej && !dalejBlokada
      ? h('button', { class: 'btn', type: 'button', onclick: () => a.idz(dalej) }, dalejLabel || 'Dalej →')
      : null
  );
}

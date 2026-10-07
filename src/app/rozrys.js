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
 * TRYB RĘCZNY (7.10.2026): automat układa dobrze, ale nie wie o przebarwieniu
 * w tym rogu płyty ani o tym, że resztka ma zostać w jednym kawałku na parapet.
 * „Edytuj ręcznie" pozwala przesunąć elementy myszą albo palcem; reguły
 * (rzaz, margines, usłojenie) pilnuje `app/rozkroj-reczny.js`, a silnik
 * liczenia płyt zostaje nietknięty — od niego zaczyna się każdy układ
 * i do niego wraca przycisk „Wróć do automatu".
 */
import { h, liczba } from './dom.js';
import { rozrysuj, DOMYSLNY_RZAZ_MM, DOMYSLNY_MARGINES_MM } from '../engine/nesting.js';
import { svgPlyty, tytulPlyty, mm, naM2 } from './rozrys-svg.js';
import { podpisOdcinka, etykietaOdcinka } from './etykiety-odcinkow.js';
import {
  zUkladu,
  doUkladu,
  przesun,
  obroc,
  przenies,
  dodajPlyte,
  sprawdz,
  roznicaPlyt,
  magnes,
  uporzadkuj,
} from './rozkroj-reczny.js';

/**
 * @param {object} kontekst
 *   { elementy, plyta: {szer, wys, nazwa}, rotacja, rzaz, margines,
 *     plytZWyceny }  — wszystko w mm poza `plytZWyceny`
 * @param {Function} onZmiana  wywoływane po edycji elementów/opcji
 */
export function widokRozrysu(kontekst, onZmiana) {
  /*
   * PRZERYSOWUJEMY WYNIKI, NIE CAŁY EKRAN (bug od Dawida, 25.08.2026).
   *
   * Wcześniej każda zmiana pola przebudowywała cały widok od zera. Skutek
   * był taki, że edycja „nie działała": <input> zgłasza `change` dopiero
   * przy utracie ogniska, więc gdy Dawid wpisał wymiar i OD RAZU kliknął
   * „+ dodaj element", kolejność była taka:
   *     mousedown → blur pola → change → przebudowa DOM → przycisku już
   *     nie ma → kliknięcie nie dochodzi.
   * Raz ginęło kliknięcie, raz wpisana wartość — zależnie od tego, co
   * zdążyło się wykonać pierwsze.
   *
   * Teraz formularz zostaje na miejscu (ognisko i wpisywana wartość też),
   * a odpowiadają na zmianę tylko: statystyki, ostrzeżenia, rysunki i tabela.
   * Wiersze elementów przerysowujemy WYŁĄCZNIE przy zmianie strukturalnej
   * (dodanie/usunięcie), bo tylko wtedy jest ich inna liczba.
   */
  let k = { ...kontekst };

  /*
   * `reczny === null` znaczy „liczy automat". Każda operacja ręczna oddaje
   * NOWY model (patrz app/rozkroj-reczny.js), więc powrót do automatu to
   * zwykłe `reczny = null` — nie ma czego cofać.
   */
  let reczny = kontekst.reczny || null;
  let wybrany = null;
  let komunikat = null;

  const gora = h('div', { class: 'rozrys-gora' });
  const pasek = h('div', { class: 'rozrys-pasek' });
  const wiersze = h('div', { class: 'rozrys-elementy' });
  const dol = h('div', { class: 'rozrys-dol' });

  const zmiana = (co, { struktura = false } = {}) => {
    k = { ...k, ...co };
    onZmiana(co);
    if (struktura) rysujWiersze();
    rysujWyniki();
  };

  function automat() {
    return rozrysuj(k.elementy, k.plyta, {
      rotacja: k.rotacja, rzaz: k.rzaz, margines: k.margines,
      polowkaDozwolona: k.polowkaDozwolona === true,
    });
  }

  function rysujWyniki() {
    const problemy = reczny ? sprawdz(reczny, { rzaz: k.rzaz, margines: k.margines }) : [];
    const wynik = reczny ? doUkladu(reczny, k.plyta) : automat();

    // Oferta bierze układ stąd — razem z problemami, bo rozjechanego
    // rysunku do klienta nie wysyłamy (patrz zamrozRozrys).
    onZmiana({ reczny, problemyRozkroju: problemy });

    gora.replaceChildren(
      naglowek(wynik, k.plyta, k.opisMaterialu, !!reczny),
      ostrzezenia(wynik, k.plytZWyceny, k.polowkaZWyceny),
      ...(reczny ? [blokProblemow(problemy, reczny, k.plytZWyceny)] : [])
    );
    pasek.replaceChildren(...narzedzia());

    const zle = new Set(problemy.map((x) => x.id));
    dol.replaceChildren(
      ...wynik.plyty.map((p) => {
        const rysunek = svgPlyty(reczny ? { ...p, edycja: true, zle, wybrany } : p);
        if (reczny) podepnijEdycje(rysunek);
        return h('div', { class: 'rozrys-plyta' }, tytulPlyty(p, k.opisMaterialu), rysunek);
      }),
      tabelaElementow(k.elementy, wynik)
    );
  }

  /* ──────────────────────── tryb ręczny: narzędzia */

  const przycisk = (etykieta, onclick) =>
    h('button', { type: 'button', class: 'btn-maly', onclick }, etykieta);

  function narzedzia() {
    if (!reczny) {
      return [
        przycisk('✎ Edytuj ręcznie', () => {
          reczny = zUkladu(automat());
          wybrany = null;
          komunikat = 'Przeciągnij element na płycie — myszą albo palcem.';
          rysujWyniki();
        }),
      ];
    }

    // Przyciski działające na elemencie pokazujemy DOPIERO, gdy jakiś jest
    // złapany — pusty pasek narzędzi to pasek, którego nie trzeba czytać.
    const naWybranym = (zmiana) => () => {
      zmiana();
      rysujWyniki();
    };

    return [
      h('span', { class: 'rozrys-badge' }, 'układ ręczny'),
      przycisk('↺ Wróć do automatu', () => {
        reczny = null;
        wybrany = null;
        komunikat = 'Układ policzony od nowa.';
        rysujWyniki();
      }),
      ...(wybrany ? [przycisk('↻ Obróć 90°', naWybranym(() => {
        const wynik = obroc(reczny, wybrany, { rotacja: k.rotacja !== false });
        reczny = wynik.model;
        // Usłojenie to uwaga, nie odmowa — obrót wykonał się tak czy owak.
        komunikat = wynik.uwaga || null;
      }))] : []),
      ...(wybrany && reczny.plyty.length > 1
        ? [przycisk('→ Na następną płytę', naWybranym(() => {
            const teraz = reczny.plyty.find((p) => p.elementy.some((e) => e.id === wybrany));
            const docelowa = (teraz.nr % reczny.plyty.length) + 1;
            reczny = uporzadkuj(przenies(reczny, wybrany, docelowa));
            komunikat = 'Element na płycie ' + docelowa + '.';
          }))]
        : []),
      przycisk('+ Płyta', () => {
        reczny = dodajPlyte(reczny);
        komunikat = null;
        rysujWyniki();
      }),
    ];
  }

  /**
   * Przeciąganie elementu po płycie.
   *
   * Pointer Events, bo to JEDNA obsługa dla myszy i dotyku — Dawid ogląda
   * rozrys równie często na telefonie w warsztacie, co na komputerze.
   * W trakcie ciągnięcia ruszamy samą grafiką (`transform`), a model
   * zmieniamy dopiero przy puścięciu: przerysowanie w połowie gestu
   * zabrałoby węzeł, który trzyma pointer capture.
   */
  function podepnijEdycje(ramka) {
    const svg = ramka.querySelector ? ramka.querySelector('svg') : null;
    if (!svg) return;
    let ciagniety = null;

    svg.addEventListener('pointerdown', (e) => {
      const grupa = e.target.closest ? e.target.closest('[data-el-id]') : null;
      if (!grupa) return;
      const id = grupa.getAttribute('data-el-id');
      const el = reczny.plyty.flatMap((p) => p.elementy).find((x) => String(x.id) === id);
      if (!el) return;

      const pole = svg.getBoundingClientRect();
      const skala = pole.width > 0 ? (svg.viewBox?.baseVal?.width || pole.width) / pole.width : 1;
      ciagniety = { id, el, grupa, startX: e.clientX, startY: e.clientY, skala, dx: 0, dy: 0 };
      wybrany = id;
      try {
        svg.setPointerCapture(e.pointerId);
      } catch {
        /* starsza przeglądarka — przeciąganie działa dalej, tylko bez przechwycenia */
      }
      e.preventDefault();
    });

    svg.addEventListener('pointermove', (e) => {
      if (!ciagniety) return;
      const surowyX = ciagniety.el.x + (e.clientX - ciagniety.startX) * ciagniety.skala;
      const surowyY = ciagniety.el.y + (e.clientY - ciagniety.startY) * ciagniety.skala;

      // MAGNES liczy się JUŻ W TRAKCIE ciągnięcia — element widocznie
      // klika na miejsce, zamiast skakac dopiero po puszczeniu.
      const cel = magnes(reczny, ciagniety.id, { x: surowyX, y: surowyY }, {
        rzaz: k.rzaz,
        margines: k.margines,
      });
      ciagniety.cel = cel;
      ciagniety.grupa.setAttribute(
        'transform',
        'translate(' + (cel.x - ciagniety.el.x) + ' ' + (cel.y - ciagniety.el.y) + ')'
      );
      pokazLinie(svg, cel.linie);
    });

    const koniec = () => {
      if (!ciagniety) return;
      const { id, el, cel } = ciagniety;
      ciagniety = null;
      schowajLinie(svg);
      reczny = uporzadkuj(przesun(reczny, id, { x: cel?.x ?? el.x, y: cel?.y ?? el.y }));
      komunikat = null;
      rysujWyniki();
    };
    svg.addEventListener('pointerup', koniec);
    svg.addEventListener('pointercancel', koniec);
  }

  /** Lista problemów, stan zapisu i różnica względem wyceny. */
  function blokProblemow(problemy, model, plytZWyceny) {
    const roznica = roznicaPlyt(model, plytZWyceny);
    return h(
      'div',
      { class: 'rozrys-uwagi' },
      komunikat ? h('div', { class: 'mini' }, komunikat) : null,
      ...problemy.map((x) => h('div', { class: 'form-blad' }, x.komunikat)),
      // Czerwień jest INFORMACJĄ, nie blokadą (korekta Dawida, 7.10.2026):
      // właściciel wie, co robi, a układ trafia do oferty taki, jaki jest.
      h('div', { class: 'mini' }, 'Układ ręczny trafi do oferty w tej postaci.'),
      roznica
        ? h(
            'div',
            { class: 'info' },
            roznica.komunikat + ' Cena nie zmieniła się sama — decyzja należy do Ciebie.'
          )
        : null
    );
  }

  function rysujWiersze() {
    wiersze.replaceChildren(...wierszeElementow(() => k, zmiana));
  }

  rysujWiersze();
  rysujWyniki();

  return h(
    'div',
    { class: 'rozrys' },
    gora,
    pasek,
    ustawieniaCiecia(k, zmiana),
    h('div', { class: 'q-kicker' }, 'Elementy do rozrysu (mm)'),
    wiersze,
    dol
  );
}

/**
 * Podpis wymiarów blatu z wyceny.
 *
 * Po nim poznajemy, czy zapisany rozrys wciąż pasuje do wyceny — patrz
 * `zapewnijRozrys` w app/oferta-dawida.js.
 */
export function podpisWyceny(odcinki) {
  /*
   * Etykieta jest częścią podpisu, choć nie zmienia ani jednego wymiaru:
   * to po tym podpisie `zapewnijRozrys` poznaje, że rozrys jest nieaktualny.
   * Bez niej zmiana „Blat 2" → „Wyspa" nie przerysowałaby napisu na płycie
   * i Dawid wysłałby klientowi rysunek ze starym podpisem.
   */
  return JSON.stringify(
    (odcinki || []).map((o) => [Number(o.gl) || 0, Number(o.dl) || 0, etykietaOdcinka(o)])
  );
}

/* ───────────────────────────────────────────────────── statystyki */

/**
 * Linie przyciągania — delikatna informacja, do czego element się równa.
 * Rysujemy je wprost w SVG płyty i kasujemy po puścięciu elementu.
 */
function pokazLinie(svg, linie) {
  schowajLinie(svg);
  for (const l of linie || []) {
    const w = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    const szer = svg.viewBox?.baseVal?.width || 0;
    const wys = svg.viewBox?.baseVal?.height || 0;
    const wsp =
      l.os === 'x'
        ? { x1: l.wartosc, y1: -wys, x2: l.wartosc, y2: wys * 2 }
        : { x1: -szer, y1: l.wartosc, x2: szer * 2, y2: l.wartosc };
    for (const [atrybut, wartosc] of Object.entries(wsp)) w.setAttribute(atrybut, String(wartosc));
    w.setAttribute('stroke', '#c9a86a');
    w.setAttribute('stroke-width', '6');
    w.setAttribute('stroke-dasharray', '26 20');
    w.setAttribute('data-magnes', '1');
    svg.appendChild(w);
  }
}

const schowajLinie = (svg) =>
  svg.querySelectorAll('[data-magnes]').forEach((w) => w.remove());

function naglowek(wynik, plyta, opisMaterialu, reczny = false) {
  const s = wynik.statystyki;
  return h(
    'div',
    { class: 'rozrys-naglowek' },
    h(
      'div',
      { class: 'q-kicker' },
      'Rozrys płyt' +
        (opisMaterialu ? ` · ${opisMaterialu}` : '') +
        (reczny ? ' · układ ręczny' : '')
    ),
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
/** „2 i ½ płyty" — tak samo, jak mówi o tym wycena. */
function opisIle(pelnych, polowek) {
  if (pelnych === 0 && polowek) return '½ płyty';
  return polowek ? `${pelnych} i ½ płyty` : `${pelnych} ${pelnych === 1 ? 'płytę' : 'płyt'}`;
}

function ostrzezenia(wynik, plytZWyceny, polowkaZWyceny) {
  const uwagi = [];
  const s = wynik.statystyki;

  /*
   * Porównanie z wyceną liczone w POŁÓWKACH, nie w sztukach — inaczej
   * rozrys z jedną połówką „nie zgadzałby się" z wyceną, która liczy
   * dokładnie to samo (zlecenie Dawida, 25.08.2026).
   */
  const polRozrysu = (s.plytPelnych ?? s.plyt) * 2 + (s.polowek || 0);
  const polWyceny = plytZWyceny * 2 + (polowkaZWyceny ? 1 : 0);

  if (polWyceny > 0 && polRozrysu > 0 && polRozrysu !== polWyceny) {
    const wRozrysie = opisIle(s.plytPelnych ?? s.plyt, s.polowek || 0);
    const wWycenie = opisIle(plytZWyceny, polowkaZWyceny ? 1 : 0);
    uwagi.push(
      polRozrysu > polWyceny
        ? `Rozrys potrzebuje ${wRozrysie}, a wycena policzyła ${wWycenie}. ` +
            'Przy tym układzie materiału zabraknie — sprawdź wycenę przed wysłaniem.'
        : `Rozrys mieści wszystko na ${wRozrysie}, a wycena liczy ${wWycenie}. ` +
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

/**
 * Wiersze elementów. Zwraca TABLICĘ wierszy (nie kontener), żeby widok
 * mógł je podmieniać samodzielnie przy dodaniu/usunięciu elementu.
 *
 * Zmiana wartości w polu NIE jest zmianą strukturalną — wiersze zostają
 * na miejscu, więc ognisko nie ucieka w środku pisania.
 *
 * UWAGA: bierzemy `dajK` (getter), a nie gotowy stan. Wiersze żyją dłużej
 * niż jedno przeliczenie, więc domknięcie na kopii stanu z chwili budowy
 * cofałoby późniejsze zmiany: wpisany wymiar znikał, gdy zaraz po nim
 * kliknąło się „+ dodaj element" (lista składała się ze starych wartości).
 */
function wierszeElementow(dajK, zmiana) {
  const zmien = (i, pole, wartosc) => {
    const kopia = dajK().elementy.map((el, j) => (i === j ? { ...el, [pole]: wartosc } : el));
    zmiana({ elementy: kopia });
  };

  return [
    ...dajK().elementy.map((el, i) =>
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
            onclick: () =>
              zmiana({ elementy: dajK().elementy.filter((_, j) => j !== i) }, { struktura: true }),
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
          zmiana(
            { elementy: [...dajK().elementy, { nazwa: 'Nowy element', szer: 1000, gl: 600, ilosc: 1 }] },
            { struktura: true }
          ),
      },
      '+ dodaj element'
    ),
  ];
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
      // Podpis Dawida („Wyspa") wygrywa z numerem — to on trafia na rysunek
      // rozkroju i do tabeli elementów. Bez podpisu zostaje „Blat N".
      nazwa: podpisOdcinka(o, `Blat ${i + 1}`),
      szer: Math.round(Number(o.dl) * 10),
      gl: Math.round(Number(o.gl) * 10),
      ilosc: 1,
    }));
}

export { DOMYSLNY_RZAZ_MM, DOMYSLNY_MARGINES_MM };

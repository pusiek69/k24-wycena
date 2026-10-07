/**
 * RĘCZNA EDYCJA ROZKROJU — model i reguły (zlecenie Dawida, 7.10.2026).
 *
 * Automat (MaxRects w `engine/nesting.js`) układa dobrze, ale nie wie
 * wszystkiego: że z tej części płyty Dawid chce mieć blat bez przebarwienia,
 * że resztkę woli mieć w jednym kawałku na parapet, że żyła ma biec przez
 * wyspę w konkretną stronę. Stąd tryb ręczny.
 *
 * ZAKRES TEGO PLIKU: wyłącznie model układu i reguły, które o nim orzekają.
 * Zero DOM-u, zero rysowania, ZERO liczenia ile płyt trzeba kupić — to drugie
 * zostaje w silniku i w wycenie, i nie ma prawa się stąd zmienić.
 *
 * Każda operacja zwraca NOWY model. Dzięki temu „Wróć do automatu" to po
 * prostu `zUkladu(rozrysuj(...))`, bez odkręcania czegokolwiek.
 */

/** Tyle milimetrów łapie „to samo miejsce" przy liczeniu kolizji. */
const TOLERANCJA_MM = 0.001;

/** Układ z silnika → model do edycji. Elementy dostają stabilne id. */
export function zUkladu(wynik) {
  const plyty = (wynik?.plyty || []).map((p, i) => ({
    ...p,
    nr: i + 1,
    elementy: (p.elementy || []).map((el, j) => ({ ...el, id: el.id || `p${i + 1}-e${j + 1}` })),
  }));
  return { plyty, reczny: false };
}

/**
 * Model → kształt, który rozumie rysunek i oferta.
 *
 * Statystyki liczą się TYM SAMYM wzorem co w silniku — inaczej „odpad"
 * i „wykorzystanie" zaczęłyby żyć własnym życiem, gdy Dawid coś przesunie.
 */
export function doUkladu(model, plyta) {
  const plyty = (model?.plyty || []).map((p, i) => ({
    ...p,
    nr: i + 1,
    poleElementowMm2: p.elementy.reduce((a, e) => a + e.szer * e.gl, 0),
  }));

  const format = { szer: Number(plyta?.szer) || 0, wys: Number(plyta?.wys) || 0 };
  const plytM2 = plyty.reduce((a, p) => a + (p.szer * p.wys) / 1e6, 0);
  const elementyM2 = plyty.reduce((a, p) => a + p.poleElementowMm2, 0) / 1e6;
  const polowek = plyty.filter((p) => p.polowka).length;

  return {
    plyty,
    nieumieszczone: [],
    statystyki: {
      plyt: plyty.length,
      plytPelnych: plyty.length - polowek,
      polowek,
      polePlytyM2: zaokr((format.szer * format.wys) / 1e6, 3),
      plytM2: zaokr(plytM2, 3),
      elementyM2: zaokr(elementyM2, 3),
      odpadM2: zaokr(Math.max(0, plytM2 - elementyM2), 3),
      wykorzystanieProc: plytM2 > 0 ? zaokr((elementyM2 / plytM2) * 100, 2) : 0,
      nieumieszczonych: 0,
    },
  };
}

/** Nowe położenie elementu. Współrzędne w mm, od lewego górnego rogu płyty. */
export function przesun(model, id, { x, y }) {
  return zElementem(model, id, (el) => ({
    ...el,
    x: Math.round(Number(x) || 0),
    y: Math.round(Number(y) || 0),
  }));
}

/**
 * Obrót o 90°.
 *
 * Przy kamieniu z wyraźnym rysunkiem (`rotacja: false`) obrót jest zakazany:
 * żyła pobiegłaby w poprzek blatu. Odmawiamy głośno, zamiast cicho obracać —
 * to samo rozstrzygnięcie, co w silniku.
 */
export function obroc(model, id, { rotacja } = {}) {
  if (rotacja === false) {
    return {
      model,
      blad: 'Ten kamień ma usłojenie — obrót o 90° puszcza rysunek w poprzek blatu.',
    };
  }
  return { model: zElementem(model, id, (el) => ({ ...el, szer: el.gl, gl: el.szer })) };
}

/** Przeniesienie elementu na płytę o numerze `nrPlyty` (1-based). */
export function przenies(model, id, nrPlyty) {
  const szukany = wszystkie(model).find((e) => e.id === id);
  if (!szukany) return model;

  const plyty = model.plyty.map((p) => {
    const bez = p.elementy.filter((e) => e.id !== id);
    if (p.nr !== nrPlyty) return { ...p, elementy: bez };
    return { ...p, elementy: [...bez, { ...szukany }] };
  });
  return { ...model, plyty, reczny: true };
}

/** Pusta płyta w formacie pozostałych — miejsce na element, który się nie mieści. */
export function dodajPlyte(model) {
  const wzorzec = model.plyty[model.plyty.length - 1] || { szer: 0, wys: 0, margines: 0 };
  const nowa = {
    nr: model.plyty.length + 1,
    szer: wzorzec.szer,
    wys: wzorzec.wys,
    margines: wzorzec.margines || 0,
    elementy: [],
    poleElementowMm2: 0,
  };
  return { ...model, plyty: [...model.plyty, nowa], reczny: true };
}

/** Zdejmuje płytę, ale tylko pustą — inaczej elementy zniknęłyby po cichu. */
export function usunPlyte(model, nr) {
  const plyta = model.plyty.find((p) => p.nr === nr);
  if (!plyta) return { model };
  if (plyta.elementy.length) {
    return { model, blad: 'Na tej płycie leżą elementy — najpierw przenieś je gdzie indziej.' };
  }
  const plyty = model.plyty.filter((p) => p.nr !== nr).map((p, i) => ({ ...p, nr: i + 1 }));
  return { model: { ...model, plyty, reczny: true } };
}

/**
 * Co jest nie tak z tym układem.
 *
 * Reguły są te same, co w silniku: rzaz liczy się WYŁĄCZNIE MIĘDZY
 * ELEMENTAMI (przy krawędzi płyty go nie ma), a margines zawęża pole
 * użyteczne z każdej strony.
 *
 * @returns {Array<{typ:'kolizja'|'poza-plyta', nrPlyty:number, id:string, komunikat:string}>}
 */
export function sprawdz(model, { rzaz = 0, margines = 0 } = {}) {
  const problemy = [];

  for (const p of model?.plyty || []) {
    const pole = {
      x1: margines,
      y1: margines,
      x2: p.szer - margines,
      y2: p.wys - margines,
    };

    for (const el of p.elementy) {
      if (
        el.x < pole.x1 - TOLERANCJA_MM ||
        el.y < pole.y1 - TOLERANCJA_MM ||
        el.x + el.szer > pole.x2 + TOLERANCJA_MM ||
        el.y + el.gl > pole.y2 + TOLERANCJA_MM
      ) {
        problemy.push({
          typ: 'poza-plyta',
          nrPlyty: p.nr,
          id: el.id,
          komunikat: `${el.nazwa || 'Element'} wychodzi poza płytę ${p.nr}.`,
        });
      }
    }

    for (let i = 0; i < p.elementy.length; i++) {
      for (let j = i + 1; j < p.elementy.length; j++) {
        const a = p.elementy[i];
        const b = p.elementy[j];
        if (rozlaczne(a, b, rzaz)) continue;
        problemy.push({
          typ: 'kolizja',
          nrPlyty: p.nr,
          id: b.id,
          zId: a.id,
          komunikat:
            `${b.nazwa || 'Element'} nachodzi na ${a.nazwa || 'element'} ` +
            `(między elementami musi zostać ${rzaz} mm na rzaz piły).`,
        });
      }
    }
  }

  return problemy;
}

/** Czy wolno zapisać ten układ. Każdy problem blokuje — także wystający element. */
export function czyMoznaZapisac(problemy) {
  return (problemy || []).length === 0;
}

/**
 * Różnica między liczbą płyt w ręcznym układzie a tą z wyceny.
 *
 * Cena NIE zmienia się sama — to ta sama zasada, co przy dotychczasowym
 * ostrzeżeniu rozrys kontra wycena: Dawid widzi różnicę i sam decyduje,
 * czy poprawia układ, czy wycenę.
 */
export function roznicaPlyt(model, plytZWyceny) {
  const zWyceny = Number(plytZWyceny);
  if (!Number.isFinite(zWyceny) || zWyceny <= 0) return null;

  const reczne = (model?.plyty || []).length;
  if (reczne === zWyceny) return null;

  const wiecej = reczne > zWyceny;
  return {
    reczne,
    zWyceny,
    komunikat:
      `Ręczny układ zajmuje ${reczne} płyt, a wycena liczy ${zWyceny}. ` +
      (wiecej
        ? 'Materiału trzeba więcej, niż policzono.'
        : 'Materiału trzeba mniej, niż policzono.'),
  };
}


/* ─────────────────────────────────────────────────────────── pomocnicze */

const wszystkie = (model) => (model?.plyty || []).flatMap((p) => p.elementy);

function zElementem(model, id, zmien) {
  const plyty = model.plyty.map((p) => ({
    ...p,
    elementy: p.elementy.map((el) => (el.id === id ? zmien(el) : el)),
  }));
  return { ...model, plyty, reczny: true };
}

/** Rozstaw między elementami: co najmniej `rzaz` w poziomie ALBO w pionie. */
function rozlaczne(a, b, rzaz) {
  const t = TOLERANCJA_MM;
  return (
    a.x + a.szer + rzaz <= b.x + t ||
    b.x + b.szer + rzaz <= a.x + t ||
    a.y + a.gl + rzaz <= b.y + t ||
    b.y + b.gl + rzaz <= a.y + t
  );
}

const zaokr = (n, m) => Math.round(n * 10 ** m) / 10 ** m;

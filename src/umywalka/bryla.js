/**
 * BRYŁA UMYWALKI — własny rysunek 3D w SVG, bez żadnej biblioteki.
 *
 * Dlaczego nie three.js: sam jego rdzeń to ~170 kB po kompresji, czyli
 * więcej niż cała ta strona razem z kalkulatorem. Umywalka to pudło,
 * niecka i kilka ścianek — od kilkunastu wielokątów nie potrzeba WebGL-a,
 * karty graficznej ani wczytywania modeli. Rysunek jest w SVG, więc jest
 * ostry na każdym ekranie, działa bez GPU i da się go wydrukować.
 *
 * Rzut: obrót w poziomie (klient przeciąga palcem, zakres ±40°) plus stałe
 * pochylenie kamery 25° — patrzymy na umywalkę tak, jak się nad nią stoi.
 * W pionie obracać nie wolno: przy swobodnej kamerze pierwszym, co robi
 * człowiek, jest obrócenie bryły do góry nogami i potem nie wie, jak wrócić.
 *
 * Cieniowanie: trzy tony jednego koloru (góra jaśniejsza, boki ciemniejsze,
 * wnętrze niecki najciemniejsze). To wystarcza, żeby mózg zobaczył bryłę.
 *
 * Wymiarów produkcyjnych i rozkroju tu nie ma i być nie może — klient widzi
 * trzy wymiary gabarytowe, a nie listę kawałków do wycięcia.
 */
import { normalizuj, nieckaStanu, kawalki } from './geometria.js';

const NS = 'http://www.w3.org/2000/svg';
const POCHYLENIE = 25 * (Math.PI / 180);
const OBROT_MAX = 40;

/** Najmniejsza szerokość kadru — żeby mała umywalka nie puchła na cały ekran. */
const KADR_MIN = 230;

const el = (nazwa, atrybuty = {}, tekst) => {
  const w = document.createElementNS(NS, nazwa);
  for (const [k, v] of Object.entries(atrybuty)) {
    if (v !== null && v !== undefined) w.setAttribute(k, String(v));
  }
  if (tekst != null) w.textContent = tekst;
  return w;
};

/* ───────────────────────────────────────────────── kolory */

function rozbijHex(hex) {
  const s = String(hex || '#cccccc').replace('#', '');
  const pelny = s.length === 3 ? s.replace(/./g, (c) => c + c) : s;
  return [0, 2, 4].map((i) => parseInt(pelny.slice(i, i + 2), 16) || 0);
}

/** Jaśniej (>1) albo ciemniej (<1) o zadany współczynnik. */
export function ton(hex, mnoznik) {
  const [r, g, b] = rozbijHex(hex);
  const skala = (v) => Math.max(0, Math.min(255, Math.round(v * mnoznik)));
  return `#${[skala(r), skala(g), skala(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/* ───────────────────────────────────────────────── geometria rzutu */

function rzut(obrot) {
  const t = (Math.max(-OBROT_MAX, Math.min(OBROT_MAX, obrot)) * Math.PI) / 180;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  const sinP = Math.sin(POCHYLENIE);
  const cosP = Math.cos(POCHYLENIE);

  return (x, y, z, srodek) => {
    const dx = x - srodek.x;
    const dy = y - srodek.y;
    const X = dx * cos + dy * sin;
    const Y = -dx * sin + dy * cos;
    return { x: X, y: Y * sinP - z * cosP, glebokosc: Y };
  };
}

/* ───────────────────────────────────────────────── bryła */

/**
 * Rysunek bryły.
 *
 * @param {object} p
 * @param {object} p.stan     konfiguracja klienta
 * @param {string} p.probka   przybliżony kolor kamienia (hex)
 * @param {number} [p.obrot]  obrót w stopniach, −40…40
 * @param {boolean} [p.wymiary] czy nanieść etykiety wymiarów
 * @returns {SVGElement}
 */
export function svgBryly({ stan, probka = '#e8e4dc', obrot = -18, wymiary = true } = {}) {
  const s = normalizuj(stan);
  const n = nieckaStanu(s);
  const zintegrowana = s.typ === 'zintegrowana';

  const srodek = { x: s.L / 2, y: s.G / 2 };
  const P = rzut(obrot);
  const p = (x, y, z) => P(x, y, z, srodek);

  const gora = ton(probka, 1.0);
  const bok = ton(probka, 0.74);
  const front = ton(probka, 0.86);
  const wnetrze = ton(probka, 0.6);
  const dno = ton(probka, 0.66);

  const svg = el('svg', {
    class: 'bryla-svg',
    role: 'img',
    'aria-label': opisDlaCzytnika(s, n),
  });

  svg.append(
    (() => {
      const defs = el('defs');
      // Światło z góry — delikatny gradient na blacie. Bez niego kamień
      // wygląda jak płaska plama koloru.
      const grad = el('linearGradient', { id: 'swiatlo-blatu', x1: '0', y1: '0', x2: '0.4', y2: '1' });
      grad.append(
        el('stop', { offset: '0', 'stop-color': ton(probka, 1.08) }),
        el('stop', { offset: '1', 'stop-color': ton(probka, 0.93) })
      );
      defs.append(grad);
      return defs;
    })()
  );

  const punkty = [];
  const wielokat = (wsp, wypelnienie, klasa) => {
    const d = wsp.map((q) => `${zaokr(q.x)},${zaokr(q.y)}`).join(' ');
    wsp.forEach((q) => punkty.push(q));
    return el('polygon', { points: d, fill: wypelnienie, class: klasa || null });
  };

  const warstwy = [];

  /* ---- wnętrze niecki (rysowane pierwsze, zasłaniane przez rant) ---- */
  if (zintegrowana) {
    const x0 = (s.L - n.L) / 2;
    const x1 = x0 + n.L;
    const y0 = (s.G - n.G) / 2;
    const y1 = y0 + n.G;
    const gl = -n.H;

    // Dno ze spadkiem do odpływu.
    warstwy.push(
      wielokat([p(x0, y0, gl), p(x1, y0, gl), p(x1, y1, gl), p(x0, y1, gl)], dno)
    );

    // Ścianka tylna i dwie boczne. Przedniej nie widać — jest odwrócona
    // od patrzącego i rysowanie jej tylko brudziłoby obrazek.
    warstwy.push(
      wielokat([p(x0, y0, 0), p(x1, y0, 0), p(x1, y0, gl), p(x0, y0, gl)], ton(wnetrze, 1.05)),
      wielokat([p(x0, y0, 0), p(x0, y1, 0), p(x0, y1, gl), p(x0, y0, gl)], wnetrze),
      wielokat([p(x1, y0, 0), p(x1, y1, 0), p(x1, y1, gl), p(x1, y0, gl)], ton(wnetrze, 0.92))
    );

    // Odpływ — mały owal na dnie, bo to pierwsza rzecz, której szuka wzrok.
    const srodekDna = p((x0 + x1) / 2, (y0 + y1) / 2 + n.G * 0.12, gl);
    warstwy.push(
      el('ellipse', {
        cx: zaokr(srodekDna.x),
        cy: zaokr(srodekDna.y),
        rx: 4.2,
        ry: 2.2,
        fill: ton(probka, 0.42),
      })
    );
  }

  /* ---- blat: prostokąt z dziurą na nieckę (fill-rule evenodd) ---- */
  const blatZewn = [p(0, 0, 0), p(s.L, 0, 0), p(s.L, s.G, 0), p(0, s.G, 0)];
  blatZewn.forEach((q) => punkty.push(q));
  let sciezka = `M ${blatZewn.map((q) => `${zaokr(q.x)},${zaokr(q.y)}`).join(' L ')} Z`;

  if (zintegrowana) {
    const x0 = (s.L - n.L) / 2;
    const x1 = x0 + n.L;
    const y0 = (s.G - n.G) / 2;
    const y1 = y0 + n.G;
    const dziura = [p(x0, y0, 0), p(x1, y0, 0), p(x1, y1, 0), p(x0, y1, 0)];
    sciezka += ` M ${dziura.map((q) => `${zaokr(q.x)},${zaokr(q.y)}`).join(' L ')} Z`;
  }

  warstwy.push(
    el('path', {
      d: sciezka,
      'fill-rule': 'evenodd',
      fill: 'url(#swiatlo-blatu)',
      class: 'bryla-blat',
    })
  );

  /* ---- pogrubienie: front i boki ---- */
  const h = s.pogrubienie === 'brak' ? grubosc(s) : s.H;

  // Front zawsze (przy „cienkiej krawędzi" to po prostu grubość płyty).
  warstwy.push(wielokat([p(0, s.G, 0), p(s.L, s.G, 0), p(s.L, s.G, -h), p(0, s.G, -h)], front));

  const bokiPelne = s.pogrubienie === 'boki';
  const hL = bokiPelne && s.bokL ? s.H : grubosc(s);
  const hP = bokiPelne && s.bokP ? s.H : grubosc(s);
  warstwy.push(
    wielokat([p(0, 0, 0), p(0, s.G, 0), p(0, s.G, -hL), p(0, 0, -hL)], bok),
    wielokat([p(s.L, 0, 0), p(s.L, s.G, 0), p(s.L, s.G, -hP), p(s.L, 0, -hP)], ton(bok, 0.92))
  );

  /* ---- otwór baterii ---- */
  if (s.bateria === 'blat') {
    const o = p(s.L / 2, Math.max(4, (s.G - (zintegrowana ? n.G : 0)) / 2 / 2), 0);
    warstwy.push(
      el('ellipse', { cx: zaokr(o.x), cy: zaokr(o.y), rx: 3, ry: 1.6, fill: ton(probka, 0.45) })
    );
  }

  /* ---- cień kontaktowy: bryła przestaje wisieć w powietrzu ---- */
  const cienWsp = [p(0, 0, -h), p(s.L, 0, -h), p(s.L, s.G, -h), p(0, s.G, -h)];
  const cien = el('polygon', {
    points: cienWsp.map((q) => `${zaokr(q.x)},${zaokr(q.y + 3)}`).join(' '),
    fill: 'rgba(0,0,0,0.45)',
    class: 'bryla-cien',
  });

  const grupa = el('g', { class: 'bryla-grupa' });
  grupa.append(cien, ...warstwy);

  if (wymiary) grupa.append(...etykiety(s, p, punkty));

  svg.append(grupa);
  svg.setAttribute('viewBox', kadr(punkty));
  return svg;
}

/** Grubość samej płyty w cm (do „cienkiej krawędzi"). */
const grubosc = (s) => Math.max(1.2, Number(s.grubosc) / 10 || 2);

const zaokr = (n) => Math.round(n * 10) / 10;

function kadr(punkty) {
  const xs = punkty.map((q) => q.x);
  const ys = punkty.map((q) => q.y);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);

  /*
   * Zapas liczony w jednostkach rysunku, nie procentowo: etykiety wymiarów
   * wychodzą poza bryłę o stałe ~20 jednostek, więc przy długiej umywalce
   * mnożnik procentowy ucinał „15 cm" przy lewej krawędzi.
   */
  const szer = Math.max(KADR_MIN, x1 - x0 + 24);
  const wys = Math.max(KADR_MIN * 0.52, y1 - y0 + 24);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;

  return `${zaokr(cx - szer / 2)} ${zaokr(cy - wys / 2)} ${zaokr(szer)} ${zaokr(wys)}`;
}

/**
 * Trzy złote etykiety wymiarów — długość, głębokość, wysokość krawędzi.
 *
 * Trzy, nie sześć: wymiary niecki i kawałków klienta nie interesują,
 * a rysunek z sześcioma podpisami przestaje być rysunkiem.
 */
function etykiety(s, p, punkty = []) {
  const h = s.pogrubienie === 'brak' ? grubosc(s) : s.H;
  const chip = (punkt, tekst, przesun = { x: 0, y: 0 }) => {
    const g = el('g', { class: 'bryla-chip' });
    const szer = tekst.length * 5.4 + 9;
    // Rogi etykiety wchodzą do rachunku kadru — inaczej „15 cm" ucinało się
    // o krawędź rysunku przy długiej umywalce.
    punkty.push(
      { x: punkt.x - szer / 2 + przesun.x, y: punkt.y - 6 + przesun.y },
      { x: punkt.x + szer / 2 + przesun.x, y: punkt.y + 6 + przesun.y }
    );
    g.append(
      el('rect', {
        x: zaokr(punkt.x - szer / 2 + przesun.x),
        y: zaokr(punkt.y - 6 + przesun.y),
        width: zaokr(szer),
        height: 12,
        rx: 2,
      }),
      el(
        'text',
        {
          x: zaokr(punkt.x + przesun.x),
          y: zaokr(punkt.y + 3 + przesun.y),
          'text-anchor': 'middle',
        },
        tekst
      )
    );
    return g;
  };

  return [
    chip(p(s.L / 2, s.G, -h), `${s.L} cm`, { x: 0, y: 14 }),
    chip(p(s.L, s.G / 2, 0), `${s.G} cm`, { x: 20, y: 6 }),
    chip(p(0, s.G, -h / 2), `${s.H} cm`, { x: -20, y: 0 }),
  ];
}

function opisDlaCzytnika(s, n) {
  const czesci = [`Umywalka ${s.L} × ${s.G} cm, krawędź ${s.H} cm`];
  if (s.typ === 'zintegrowana') czesci.push(`zlew wycięty w kamieniu ${n.L} × ${n.G} cm`);
  else czesci.push('blat pod umywalkę nablatową');
  czesci.push(s.dekor);
  return czesci.join(', ') + '.';
}

/* ───────────────────────────────────────────────── widok „rozłóż" */

/**
 * Kawałki rozłożone płasko — poglądowo, BEZ wymiarów.
 *
 * Pokazujemy, że umywalka składa się z kilku elementów z jednej płyty
 * (i że mieści się w jej połowie). Wymiary produkcyjne zostają w zakładzie:
 * z nich konkurencja odtworzyłaby cały rozkrój.
 */
export function svgRozlozenia({ stan, probka = '#e8e4dc' } = {}) {
  const lista = kawalki(stan);
  const svg = el('svg', {
    class: 'bryla-svg bryla-rozlozone',
    role: 'img',
    'aria-label': `Umywalka składa się z ${lista.length} elementów wyciętych z jednej płyty.`,
  });

  const SZER = 320;
  const ODSTEP = 6;
  let x = 0;
  let y = 0;
  let wysRzedu = 0;
  const grupa = el('g');

  lista.forEach((k, i) => {
    if (x + k.dl > SZER) {
      x = 0;
      y += wysRzedu + ODSTEP;
      wysRzedu = 0;
    }

    const g = el('g', { class: 'rozl-kawalek', style: `--opoznienie:${i * 40}ms` });
    g.append(
      el('rect', {
        x: zaokr(x),
        y: zaokr(y),
        width: zaokr(k.dl),
        height: zaokr(k.gl),
        rx: 1,
        fill: ton(probka, 0.92),
      }),
      el('circle', {
        cx: zaokr(x + Math.min(k.dl / 2, 9)),
        cy: zaokr(y + Math.min(k.gl / 2, 9)),
        r: 6,
        class: 'rozl-numer-tlo',
      }),
      el(
        'text',
        {
          x: zaokr(x + Math.min(k.dl / 2, 9)),
          y: zaokr(y + Math.min(k.gl / 2, 9) + 3),
          'text-anchor': 'middle',
          class: 'rozl-numer',
        },
        String(i + 1)
      )
    );
    grupa.append(g);

    x += k.dl + ODSTEP;
    wysRzedu = Math.max(wysRzedu, k.gl);
  });

  svg.append(grupa);
  svg.setAttribute('viewBox', `-8 -8 ${SZER + 16} ${y + wysRzedu + 16}`);
  return svg;
}

/* ───────────────────────────────────────────────── obracanie */

/**
 * Przeciąganie w poziomie obraca bryłę. Klawiatura: strzałki lewo/prawo.
 *
 * `touch-action: pan-y` zostaje w CSS — dzięki temu przewijanie strony
 * palcem w pionie nadal działa, a obraca się tylko w poziomie.
 */
export function podlaczObrot(ramka, { odczyt, zapis }) {
  let startX = null;
  let startObrot = 0;

  const dotknij = (e) => {
    startX = punktX(e);
    startObrot = odczyt();
    ramka.classList.add('bryla-obracana');
  };

  const rusz = (e) => {
    if (startX === null) return;
    const delta = (punktX(e) - startX) * 0.35;
    zapis(Math.max(-OBROT_MAX, Math.min(OBROT_MAX, startObrot + delta)));
  };

  const puszcz = () => {
    startX = null;
    ramka.classList.remove('bryla-obracana');
  };

  ramka.addEventListener('pointerdown', dotknij);
  ramka.addEventListener('pointermove', rusz);
  ramka.addEventListener('pointerup', puszcz);
  ramka.addEventListener('pointercancel', puszcz);
  ramka.addEventListener('pointerleave', puszcz);

  ramka.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const krok = e.key === 'ArrowLeft' ? -8 : 8;
    zapis(Math.max(-OBROT_MAX, Math.min(OBROT_MAX, odczyt() + krok)));
  });
}

const punktX = (e) => (e.touches ? e.touches[0].clientX : e.clientX) || 0;

export { OBROT_MAX };

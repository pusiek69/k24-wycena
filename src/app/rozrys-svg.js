/**
 * RYSUNEK PŁYTY (SVG) — wspólny dla Dawida i dla klienta.
 *
 * Ten sam obrazek ogląda Dawid w edytorze i klient na stronie oferty —
 * dlatego rysowanie siedzi w jednym miejscu. Różnią się tylko obudową:
 * warsztat ma przy nim parametry cięcia i formularz elementów, klient
 * dostaje sam rysunek z podpisami.
 *
 * Rysunek jest skalowany przez `viewBox`, więc ta sama grafika wygląda
 * dobrze na telefonie, na monitorze i na wydruku A4.
 */
import { h, liczba } from './dom.js';

/** Kolory elementów — spokojne, rozróżnialne także na wydruku mono. */
export const KOLORY = ['#8a6a2f', '#4a6d7c', '#6b5b7b', '#7c6a4a', '#4f7a5c', '#8a5a5a', '#5a6a8a'];

/**
 * Pas wokół płyty na wymiary.
 *
 * Rozmiary tekstów są duże w skali `viewBox` (płyta to ~3200 jednostek),
 * bo rysunek ogląda się GŁÓWNIE NA TELEFONIE: przy szerokości 285 px
 * font 52 schodził do ~4 px i nazwy elementów były nieczytelne.
 */
const RAMKA = 130;

export const mm = (n) => Math.round(Number(n) || 0);
export const naM2 = (mm2) => mm2 / 1e6;

export function svgPlyty(p) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `${-RAMKA} ${-RAMKA} ${p.szer + 2 * RAMKA} ${p.wys + 2 * RAMKA}`);
  svg.setAttribute('class', 'rozrys-svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Płyta ${p.nr}: rozłożenie elementów blatu`);

  const el = (nazwa, atrybuty, tekst) => {
    const w = document.createElementNS('http://www.w3.org/2000/svg', nazwa);
    for (const [k, v] of Object.entries(atrybuty)) w.setAttribute(k, String(v));
    if (tekst != null) w.textContent = tekst;
    svg.appendChild(w);
    return w;
  };

  el('rect', { x: 0, y: 0, width: p.szer, height: p.wys, fill: '#f2efe9', stroke: '#8a8578', 'stroke-width': 10 });
  if (p.margines > 0) {
    el('rect', {
      x: p.margines, y: p.margines,
      width: p.szer - 2 * p.margines, height: p.wys - 2 * p.margines,
      fill: 'none', stroke: '#c9b998', 'stroke-width': 5, 'stroke-dasharray': '30 22',
    });
  }

  el('text', { x: p.szer / 2, y: -22, 'text-anchor': 'middle', 'font-size': 105, fill: '#4a463d' }, `${mm(p.szer)} mm`);
  el(
    'text',
    {
      x: -30, y: p.wys / 2, 'text-anchor': 'middle', 'font-size': 105, fill: '#4a463d',
      transform: `rotate(-90 ${-30} ${p.wys / 2})`,
    },
    `${mm(p.wys)} mm`
  );

  (p.elementy || []).forEach((e, i) => {
    const kolor = KOLORY[i % KOLORY.length];
    el('rect', {
      x: e.x, y: e.y, width: e.szer, height: e.gl,
      fill: kolor, 'fill-opacity': 0.2, stroke: kolor, 'stroke-width': 9, rx: 6,
    });
    const srodekX = e.x + e.szer / 2;
    const srodekY = e.y + e.gl / 2;
    el(
      'text',
      { x: srodekX, y: srodekY - 12, 'text-anchor': 'middle', 'font-size': 95, 'font-weight': 'bold', fill: '#2b2823' },
      e.nazwa
    );
    el(
      'text',
      { x: srodekX, y: srodekY + 78, 'text-anchor': 'middle', 'font-size': 80, fill: '#4a463d' },
      `${mm(e.szer)} × ${mm(e.gl)}`
    );
  });

  /*
   * Rysunek jest szeroki (płyta ~2:1), więc na telefonie zmieściłby się
   * w 285 px i napisy zeszłyby do kilku pikseli. Zamiast tego dajemy mu
   * własne przewijanie w poziomie i minimalną szerokość — strona nadal
   * nie przewija się na boki, a klient ogląda rozrys w czytelnej skali.
   */
  const ramka = document.createElement('div');
  ramka.className = 'rozrys-ramka';
  ramka.appendChild(svg);
  return ramka;
}

/** Podpis nad rysunkiem: numer płyty, materiał, ile elementów i ile m². */
export function tytulPlyty(p, opisMaterialu) {
  const wykorzystanie = p.szer * p.wys > 0 ? (p.poleElementowMm2 / (p.szer * p.wys)) * 100 : 0;
  return h(
    'div',
    { class: 'rozrys-plyta-tytul' },
    h('b', {}, `Płyta ${p.nr}`),
    opisMaterialu ? h('span', {}, ' — ' + opisMaterialu) : null,
    h(
      'span',
      { class: 'mini' },
      ` · ${(p.elementy || []).length} elem. · ${liczba(naM2(p.poleElementowMm2), 2)} m² · ` +
        `${liczba(wykorzystanie, 1)}% wykorzystania`
    )
  );
}

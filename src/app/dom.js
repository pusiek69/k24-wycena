/** Mikro-helper do budowania DOM — bez frameworka, bez zależności. */

export function h(tag, props = {}, ...dzieci) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dane') Object.assign(el.dataset, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  dodaj(el, dzieci);
  return el;
}

function dodaj(el, dzieci) {
  for (const d of dzieci) {
    if (d == null || d === false) continue;
    if (Array.isArray(d)) dodaj(el, d);
    else el.append(d instanceof Node ? d : document.createTextNode(String(d)));
  }
}

export function pusty(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

/** Liczba → „1 234 zł" */
export function zl(n) {
  return Math.round(n).toLocaleString('pl-PL') + ' zł';
}

/** Liczba → „2,4" (max 1 miejsce po przecinku) */
export function liczba(n, miejsca = 1) {
  return (Math.round(n * 10 ** miejsca) / 10 ** miejsca).toLocaleString('pl-PL');
}

/** Bez polskich znaków i wielkości liter — do wyszukiwarki dekorów. */
export function uprosc(s) {
  return String(s)
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

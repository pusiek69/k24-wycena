/**
 * GOŁY DOM A PUSTE DZIECI — „null" na oczach klienta.
 *
 *   node --test scripts/test-dom-null.mjs
 *
 * ⚠ POWÓD POWSTANIA (30.08.2026, przegląd produkcji).
 *
 * `h()` z app/dom.js odsiewa `null`/`false` wśród dzieci, więc w kodzie
 * roi się od wzorca `warunek ? h(...) : null`. Ale `replaceChildren`
 * i `append` to GOŁY DOM: `null` zamieniają na TEKST „null" i wstawiają
 * jako węzeł strony.
 *
 * Skutkiem był literalny napis „null" nad wyceną na KAŻDEJ ofercie
 * wysłanej klientowi (src/oferta.js, od 25.08.2026 do 30.08.2026).
 * Nikt tego nie zgłosił — po prostu wyglądało jak usterka strony.
 *
 * Ten test czyta źródła i pilnuje, żeby żadne wywołanie gołego DOM-u nie
 * dostawało wyrażenia warunkowego bez odsiania pustych wartości.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const KORZEN = new URL('../src/', import.meta.url);

/** Wszystkie pliki .js w src/, rekurencyjnie. */
function zrodla(katalog = KORZEN) {
  const out = [];
  for (const wpis of fs.readdirSync(katalog, { withFileTypes: true })) {
    const sciezka = new URL(wpis.name + (wpis.isDirectory() ? '/' : ''), katalog);
    if (wpis.isDirectory()) out.push(...zrodla(sciezka));
    else if (wpis.name.endsWith('.js')) out.push(sciezka);
  }
  return out;
}

/**
 * Wycina argumenty wywołania, licząc nawiasy — zwykłe `slice` do pierwszego
 * nawiasu zamykającego urwałoby się na pierwszym zagnieżdżonym `h(...)`.
 */
function argumenty(tekst, odNawiasu) {
  let glebokosc = 0;
  for (let i = odNawiasu; i < tekst.length; i++) {
    if (tekst[i] === '(') glebokosc++;
    else if (tekst[i] === ')') {
      glebokosc--;
      if (glebokosc === 0) return tekst.slice(odNawiasu + 1, i);
    }
  }
  return '';
}

/** Ile nawiasów zostaje otwartych w podanym fragmencie. */
function otwarte(fragment) {
  let g = 0;
  for (const znak of fragment) {
    if (znak === '(') g++;
    else if (znak === ')') g--;
  }
  return g;
}

test('gołe replaceChildren/append nie dostaje warunku bez filter(Boolean)', () => {
  const podejrzane = [];

  for (const plik of zrodla()) {
    const tekst = fs.readFileSync(plik, 'utf8');
    const nazwa = path.basename(plik.pathname);

    for (const m of tekst.matchAll(/\.(replaceChildren|append|prepend)\(/g)) {
      const nawias = m.index + m[0].length - 1;
      const args = argumenty(tekst, nawias);
      if (!args.includes('?')) continue;
      if (args.includes('filter(Boolean)')) continue;

      // `h(...)` samo odsiewa puste dzieci, więc warunek w JEGO argumentach
      // jest bezpieczny. Zamieniamy `h(` na zwykły nawias i sprawdzamy,
      // czy jakiś warunek został na POZIOMIE NAJWYŻSZYM.
      const pozaH = args.replace(/\bh\(/g, ' (');
      const idx = pozaH.indexOf('?');
      if (idx < 0 || otwarte(pozaH.slice(0, idx)) > 0) continue;

      /*
       * Groźna jest tylko gałąź oddająca PUSTĄ wartość. Warunek
       * `w ? bramkaWyceny(…) : bramkaKontaktu(…)` zwraca element w obu
       * przypadkach i jest bezpieczny — nie ma po co go zgłaszać, bo test
       * z fałszywymi alarmami przestaje być czytany.
       */
      if (!/:\s*(null|undefined|false|''|"")\s*[,)\n]/.test(args)) continue;

      podejrzane.push(`${nazwa}: .${m[1]}(${args.trim().slice(0, 70)}…)`);
    }
  }

  assert.deepEqual(
    podejrzane,
    [],
    'Wywołanie gołego DOM-u z warunkiem — puste dziecko wjedzie jako tekst:\n  ' +
      podejrzane.join('\n  ')
  );
});

test('nie przypisujemy pustych wartości do treści węzła', () => {
  // Tania siatka bezpieczeństwa na inne drogi do tego samego skutku.
  for (const plik of zrodla()) {
    const tekst = fs.readFileSync(plik, 'utf8');
    assert.doesNotMatch(
      tekst,
      /textContent\s*=\s*(null|undefined)\b/,
      `${path.basename(plik.pathname)}: przypisanie pustej wartości do textContent`
    );
  }
});

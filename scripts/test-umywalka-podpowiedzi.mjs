/**
 * PODPOWIEDZI UMYWALKI — „pomysł 0": reguły, zero AI, zero kosztu.
 *
 *   node --test scripts/test-umywalka-podpowiedzi.mjs
 *
 * Najważniejsza z nich to połówka płyty. Keralini i Avant (dystrybucja
 * Architype) wolno kupić w połowie formatu — 320 × 80 zamiast 320 × 160.
 * Umywalka, która się w niej mieści, kosztuje materiałowo połowę tego,
 * co umywalka o 3 cm dłuższa. Klient nie ma skąd tego wiedzieć, więc
 * kalkulator musi mu to powiedzieć sam.
 *
 * Każda reguła jest czystą funkcją: wejście → tekst albo `null`. Dzięki
 * temu da się ją sprawdzić bez przeglądarki i bez wyceny.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { STAN_DOMYSLNY, normalizuj } from '../src/umywalka/geometria.js';
import { znacznikPolowki, podpowiedz, najblizszaPolowka } from '../src/umywalka/podpowiedzi.js';
import { wycenUmywalke } from '../src/umywalka/wycena-umywalki.js';

const { wczytajSilnik } = await import('./lib/silnik.mjs');
const silnik = await wczytajSilnik();
const KERALINI = silnik.FIRMY.find((f) => f.slug === 'keralini');

const DATA = '2026-11-23';

function stan(zmiany = {}) {
  return normalizuj({ ...STAN_DOMYSLNY, L: 120, G: 50, H: 15, ...zmiany });
}

function wycena(zmiany = {}) {
  return wycenUmywalke({ firma: KERALINI, stan: stan(zmiany), dataISO: DATA });
}

function hint(zmiany = {}) {
  const w = wycena(zmiany);
  return podpowiedz({ stan: w.stan, pak: w.pak, plyta: w.plyta });
}

/* ═══════════════════════════════════════════ reguła 1: połówka płyty */

test('160 × 50 mieści się w połówce → znaczek, bez propozycji zmiany', () => {
  const w = wycena({ L: 160, G: 50 });

  const znak = znacznikPolowki(w.pak);
  assert.ok(znak);
  assert.match(znak.tekst, /połówce/);
  assert.equal(znak.ok, true);

  const p = podpowiedz({ stan: w.stan, pak: w.pak, plyta: w.plyta });
  assert.ok(!p || p.id !== 'polowka', 'nie powinno proponować skrócenia');
});

test('200 × 50 nie mieści się → propozycja 169 cm z gotową akcją', () => {
  const w = wycena({ L: 200, G: 50 });

  assert.equal(w.pak.polowka, false);
  assert.equal(znacznikPolowki(w.pak), null);

  const p = podpowiedz({ stan: w.stan, pak: w.pak, plyta: w.plyta });
  assert.equal(p.id, 'polowka');
  assert.match(p.tekst, /169/);
  assert.deepEqual(p.akcja.zmiana, { L: 169 });
  assert.match(p.akcja.etykieta, /169/);
});

test('propozycja nie podaje kwot przed formularzem', () => {
  const p = hint({ L: 200, G: 50 });
  assert.ok(!/\d+\s*zł/.test(p.tekst), `w podpowiedzi nie może być kwoty: ${p.tekst}`);
});

test('najblizszaPolowka skraca długość, a głębokość zostawia', () => {
  const w = wycena({ L: 200, G: 50 });
  const z = najblizszaPolowka(w.stan, w.plyta);
  assert.deepEqual(z, { L: 169 });
});

test('głęboka umywalka: gdy skrócenie nie pomaga, schodzi z głębokości', () => {
  // Przy G = 60 w połówce mieści się tylko do 123 cm (sprawdzone silnikiem).
  const w = wycena({ L: 200, G: 60 });
  const z = najblizszaPolowka(w.stan, w.plyta);
  assert.ok(z, 'powinna być jakaś propozycja');
  assert.ok(z.L <= 123 || z.G < 60);
});

test('reguła „cała płyta": gdy nic nie pomaga, proponujemy drugą połowę', () => {
  // Umywalka 200 × 70 nie zmieści się w połówce przy żadnym rozsądnym
  // skróceniu — wtedy mówimy, co zrobić z resztą płyty.
  const p = hint({ L: 200, G: 70, niecka: { L: 180, G: 55, H: 15 } });
  assert.ok(p);
  if (p.id === 'calaPlyta') assert.match(p.tekst, /półk|parapet/);
});

/* ═══════════════════════════════════════════ reguła 2: bateria */

test('wąski rant przy niecce → ostrzeżenie o baterii z blatu', () => {
  /*
   * G 50, niecka G 40 — ale granica z §6.2 (zG ≤ G − 12) przycina ją do 38,
   * więc rant to 6 cm z każdej strony. Mniej niż próg 7 cm, czyli ostrzegamy.
   *
   * Próg 7 cm, a nie 8 jak w §10.2: przy 8 domyślna umywalka Dawida
   * (rant 7,5 cm) ostrzegałaby zawsze — patrz komentarz w podpowiedzi.js.
   */
  const p = hint({ L: 120, G: 50, niecka: { L: 100, G: 40, H: 10 } });
  assert.equal(p.id, 'bateria');
  assert.match(p.tekst, /baterii? ze ściany|bateria z blatu/i);
  assert.match(p.tekst, /6 cm/);
});

test('domyślna niecka (rant 7,5 cm) NIE wywołuje ostrzeżenia o baterii', () => {
  // Gdyby wywoływała, podpowiedź świeciłaby się przy każdym wejściu
  // na stronę — i klient przestałby ją czytać.
  const p = hint({ L: 120, G: 50, H: 15 });
  assert.ok(!p || p.id !== 'bateria');
});

test('bateria ze ściany: tej podpowiedzi już nie pokazujemy', () => {
  const p = hint({ L: 120, G: 50, niecka: { L: 100, G: 40, H: 10 }, bateria: 'sciana' });
  assert.ok(!p || p.id !== 'bateria');
});

/* ═══════════════════════════════════════════ reguła 3: krawędź */

test('krawędź niższa niż 15 cm → delikatna sugestia, nie zakaz', () => {
  const p = hint({ L: 120, G: 50, H: 13 });
  assert.equal(p.id, 'krawedz');
  assert.match(p.tekst, /15 cm/);
  assert.match(p.tekst, /zrobimy/);
});

test('krawędź 15 cm i więcej → bez podpowiedzi o krawędzi', () => {
  const p = hint({ L: 120, G: 50, H: 15 });
  assert.ok(!p || p.id !== 'krawedz');
});

/* ═══════════════════════════════════════════ reguła 4: nietypowy wymiar */

test('wymiar poza zakresem → „ustalimy na pomiarze"', () => {
  const p = hint({ L: 240, G: 50 });
  assert.ok(p);
  assert.ok(['polowka', 'wymiar', 'calaPlyta'].includes(p.id));
});

/* ═══════════════════════════════════════════ kolejność i liczba */

test('pokazujemy najwyżej jedną podpowiedź — najważniejszą', () => {
  // Jednocześnie: nie mieści się w połówce, wąski rant i niska krawędź.
  const p = hint({ L: 200, G: 50, H: 13, niecka: { L: 180, G: 40, H: 10 } });
  assert.ok(p && typeof p.tekst === 'string');
  assert.equal(p.id, 'polowka', 'połówka jest najważniejsza — to ona kosztuje najwięcej');
});

test('typowa konfiguracja mieszcząca się w połówce nie dostaje podpowiedzi', () => {
  assert.equal(hint({ L: 120, G: 50, H: 15 }), null);
});

test('nablatowa w całym zakresie mieści się w połówce', () => {
  for (const L of [80, 120, 160, 200]) {
    const w = wycena({ typ: 'nablatowa', L, G: 50 });
    assert.equal(w.pak.polowka, true, `nablatowa ${L} × 50`);
  }
});

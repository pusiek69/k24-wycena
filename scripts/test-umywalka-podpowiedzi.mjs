/**
 * PODPOWIEDZI — połówka płyty i ostrzeżenia wykonawcze.
 *
 *   node --test scripts/test-umywalka-podpowiedzi.mjs
 *
 * Połówka płyty to jedyne miejsce, w którym kalkulator sam coś doradza —
 * i jedyne, w którym naprawdę warto. Keralini i Avant (Architype) wolno
 * kupić w połowie formatu 320 × 160; umywalka, która się w niej mieści,
 * kosztuje materiałowo połowę tego, co umywalka kilka centymetrów dłuższa.
 *
 * Progi liczy silnik, nie my: dlatego testy sprawdzają zachowanie
 * („mieści się / nie mieści, a przy X cm by się zmieściło"), a liczbę
 * progu biorą z tego, co policzy pakowanie.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { STAN_DOMYSLNY, zacisnij, odcinki } from '../src/umywalka/model.js';
import { upakuj } from '../src/engine/pakowanie.js';
import {
  znacznikPolowki,
  najblizszaPolowka,
  podpowiedzPolowki,
  ostrzezeniaWykonawcze,
} from '../src/umywalka/podpowiedzi.js';

const PLYTA = { w: 320, h: 160, polowkaDozwolona: true };
const stan = (zmiany = {}) => zacisnij({ ...STAN_DOMYSLNY, L: 120, W: 50, H: 15, sL: 100, sW: 35, ins: 5, ...zmiany });
const pak = (S) => upakuj(odcinki(S), PLYTA);
const rada = (S) => podpowiedzPolowki({ stan: S, pak: pak(S), plyta: PLYTA });

/* ═══════════════════════════════════════════ połówka płyty */

test('typowa umywalka mieści się w połówce — znaczek, bez rady', () => {
  const S = stan();
  const znak = znacznikPolowki(pak(S));
  assert.ok(znak);
  assert.match(znak.tekst, /połówce płyty/);
  assert.equal(rada(S), null);
});

test('za duża umywalka dostaje propozycję konkretnej długości', () => {
  // Przy głębokości 60 cm granica połówki wypada koło 173 cm, więc blat
  // 200 cm da się „uratować" skróceniem — i to proponujemy.
  const S = stan({ L: 200, W: 60, sL: 100, sW: 35 });
  assert.equal(znacznikPolowki(pak(S)), null);

  const p = rada(S);
  assert.equal(p.id, 'polowka');
  assert.ok(p.akcja, 'propozycja powinna mieć gotowy przycisk');
  assert.match(p.akcja.etykieta, /^Ustaw \d+ cm$/);
  assert.ok(p.akcja.zmiana.L < S.L);

  // Propozycja musi być prawdziwa: po jej przyjęciu naprawdę się mieści.
  const poZmianie = zacisnij({ ...S, L: p.akcja.zmiana.L, sL: Math.min(S.sL, p.akcja.zmiana.L - 10) });
  assert.equal(pak(poZmianie).polowka, true);
  assert.equal(pak(poZmianie).plytyPelne, 0);
});

test('propozycja nie podaje kwot — kwoty są dopiero przy cenie', () => {
  const p = rada(stan({ L: 200, W: 60, sL: 100, sW: 35 }));
  assert.ok(!/\d+\s*zł/.test(p.tekst), p.tekst);
});

test('najblizszaPolowka skraca najwyżej o 40 cm', () => {
  const S = stan({ L: 300, W: 80, sL: 260, sW: 65 });
  const z = najblizszaPolowka(S, PLYTA);
  if (z) assert.ok(z.L >= S.L - 40, `${z.L} to więcej niż 40 cm skrócenia`);
});

test('gdy skrócenie nie pomaga — mówimy, co zrobić z drugą połową płyty', () => {
  const S = stan({ L: 300, W: 80, sL: 260, sW: 65 });
  const p = rada(S);
  assert.ok(p);
  if (p.id === 'calaPlyta') assert.match(p.tekst, /półk|parapet/);
});

test('materiał bez połówek (gdyby taki wszedł) nie dostaje tej podpowiedzi', () => {
  const S = stan({ L: 240, W: 60 });
  assert.equal(podpowiedzPolowki({ stan: S, pak: pak(S), plyta: { w: 320, h: 160 } }), null);
});

/* ═══════════════════════════════════════════ ostrzeżenia z hali */

test('wąski rant przy zlewie — ostrzeżenie o pęknięciu przy transporcie', () => {
  const o = ostrzezeniaWykonawcze(stan({ L: 120, W: 50, sL: 112, sW: 40 }));
  assert.ok(o.some((x) => /Wąski rant/.test(x.tekst)));
});

test('wąski mostek między dwoma zlewami', () => {
  const o = ostrzezeniaWykonawcze(stan({ L: 160, W: 50, n: 2, sL: 65, gap: 8 }));
  assert.ok(o.some((x) => /mostek/.test(x.tekst)));
});

test('za mało miejsca na baterię — sugerujemy ścienną', () => {
  const o = ostrzezeniaWykonawcze(stan({ L: 120, W: 50, sW: 38, holes: 1 }));
  assert.ok(o.some((x) => /baterię ścienną/.test(x.tekst)));
});

test('typowa konfiguracja nie straszy klienta niczym', () => {
  assert.deepEqual(ostrzezeniaWykonawcze(stan({ L: 120, W: 50, sL: 100, sW: 35 })), []);
});

test('blat pod umywalkę nablatową uprzedza, że misy nie ma w cenie', () => {
  const o = ostrzezeniaWykonawcze(stan({ mode: 'top' }));
  assert.equal(o.length, 1);
  assert.equal(o[0].rodzaj, 'info');
  assert.match(o[0].tekst, /nie jest wliczona/);
});

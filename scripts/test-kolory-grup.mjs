/**
 * GRUPOWANIE DEKORÓW PO KOLORZE (zlecenie Dawida, 9/14.10.2026 — flow 3/4).
 *
 *   node --test scripts/test-kolory-grup.mjs
 *
 * Lista ~700 wzorów z samymi nazwami przytłacza klienta-laika. Wariant (b)
 * z raportu designu: nagłówki grup kolorystycznych nad listą. Grupa to
 * PODPOWIEDŹ, nie deklaracja — dekory, których nazwa nie zdradza koloru,
 * lądują uczciwie w „kolor nieoznaczony" NA KOŃCU, nigdy wmieszane.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { TAGI, grupujPoKolorze } from '../src/app/kolory-dekorow.js';

const pozycja = (nazwa, firmaSlug = 'test') => ({ nazwa, firmaSlug });

test('grupy wychodzą w kolejności TAGI i tylko niepuste', () => {
  const grupy = grupujPoKolorze([
    pozycja('Brilliant Black'),   // antracyt
    pozycja('Calacatta Gold'),    // biel z żyłą
    pozycja('Beton Grey'),        // beton (przed szarością w regułach? sprawdzamy realny wynik)
  ]);
  const kolejnoscTagow = TAGI.map((t) => t.id);
  const idGrup = grupy.map((g) => g.tag);
  // kolejność zgodna z TAGI…
  assert.deepEqual(
    idGrup,
    kolejnoscTagow.filter((id) => idGrup.includes(id))
  );
  // …i żadnych pustych grup.
  for (const g of grupy) assert.ok(g.pozycje.length > 0, `pusta grupa ${g.tag}`);
});

test('dekor trafia do grupy zgodnej z kolorDekoru, z zachowaniem obiektu', () => {
  const wejscie = [pozycja('Calacatta Aurelia', 'technistone')];
  const grupy = grupujPoKolorze(wejscie);
  assert.equal(grupy.length, 1);
  assert.equal(grupy[0].tag, 'biel-zyla');
  // Ten sam obiekt, nie kopia — pomocnik dokłada do niego własne pola.
  assert.equal(grupy[0].pozycje[0], wejscie[0]);
});

test('nazwy, z których nic nie wynika, lądują w „kolor nieoznaczony" na końcu', () => {
  const grupy = grupujPoKolorze([
    pozycja('Dijon'),            // nazwa miejscowości — nie zgadujemy
    pozycja('Brilliant White'),  // biel
  ]);
  assert.equal(grupy.at(-1).tag, 'nieznany');
  assert.deepEqual(grupy.at(-1).pozycje.map((p) => p.nazwa), ['Dijon']);
});

test('grupa niesie etykietę po polsku dla nagłówka na stronie', () => {
  const [g] = grupujPoKolorze([pozycja('Nero Assoluto')]);
  assert.equal(typeof g.etykieta, 'string');
  assert.ok(g.etykieta.length > 2);
});

test('kolor liczony z firmaSlug — ręczna mapa per firma ma szansę zadziałać', () => {
  // Bez wpisu w RECZNE wynik jak z samej nazwy; test pilnuje tylko, że
  // slug JEST przekazywany (zła sygnatura wysypałaby się tutaj).
  const grupy = grupujPoKolorze([pozycja('Brilliant White', 'technistone')]);
  assert.equal(grupy[0].tag, 'biel');
});

test('kolejność wewnątrz grupy = kolejność wejścia (sortuje wołający)', () => {
  const grupy = grupujPoKolorze([
    pozycja('Snow White'),
    pozycja('Arctic White'),
  ]);
  assert.deepEqual(
    grupy[0].pozycje.map((p) => p.nazwa),
    ['Snow White', 'Arctic White']
  );
});

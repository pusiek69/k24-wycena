/**
 * PŁYTY Z TEGO SAMEGO BLOKU — parser tabeli i dostępność liczona blokiem.
 *
 *   node --test scripts/test-blok.mjs
 *
 * Blok to jeden kamień przecięty na płyty (identyczny wzór i usłojenie).
 * Interstone pokazuje na karcie płyty tabelę „Produkty o tym samym bloku"
 * (Status / Magazyn / Symbol / Opis / Stan) — z niej liczymy dostępność
 * zleceń na więcej niż jedną płytę. Płyt z różnych bloków nie wolno mieszać.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { tabelaBloku } from '../worker/magazyn.js';
import { wczytajSilnik } from './lib/silnik.mjs';

const { wycenZMagazynu } = await wczytajSilnik();

const wiersz = (status, magazyn, symbol, opis, stan) =>
  `<div class="table-row"><div><span>${status}</span></div><div><span>${magazyn}</span></div>` +
  `<div><span>${symbol}</span></div><div><span>${opis}</span></div><div><span>${stan}</span></div></div>`;

const TABELA =
  wiersz('Na stanie', 'Mszczonów', '93055', 'pol_2x315x165 dp_', '10.4 m²') +
  wiersz('Na stanie', 'Wrocław', '93054', 'pol_2x310x175 dp_', '5.43 m²') +
  wiersz('Na stanie', 'Poznań outlet', '69045', 'lus_pol_2x313x195  dp_', 'Rezerwacja') +
  wiersz('W drodze', 'Mszczonów', '9510072311', '', '74.64 m²');

/* ───────────────────────────────────────────────────── parser tabeli */

test('parser bierze tylko „Na stanie" z metrażem — bez rezerwacji i „w drodze"', () => {
  const blok = tabelaBloku(TABELA);
  assert.equal(blok.plyty.length, 2);
  assert.deepEqual(blok.plyty.map((p) => p.symbol), ['93055', '93054'], 'większa płyta pierwsza');
  assert.equal(blok.razemM2, 15.83);
});

test('opis „pol_2x315x165 dp_" daje wymiar płyty i grubość', () => {
  const [p] = tabelaBloku(TABELA).plyty;
  assert.deepEqual(p.wymiarCm, { dl: 315, gl: 165 });
  assert.equal(p.gruboscCm, 2);
  assert.equal(p.magazyn, 'Mszczonów');
});

test('karta bez tabeli → null, nie pusty obiekt', () => {
  assert.equal(tabelaBloku('<div>zwykla karta bez tabeli</div>'), null);
});

/* ─────────────────────────────── dostępność liczona całym blokiem */

const PLYTA = (blokPlyty, dostepneM2 = 5.43) => ({
  nazwa: 'TAJ MAHAL',
  rodzaj: 'Kamień Naturalny',
  kod: 'STON001023-93054',
  cenaBruttoM2: 1400,
  plytaCm: { dl: 310, gl: 175 },
  gruboscMm: 20,
  dostepneM2,
  blokPlyty,
});

// Blat ~7,9 m² materiału → dwie płyty; jedna płyta bloku nie starcza.
const DUZY_BLAT = {
  odcinki: [{ gl: 90, dl: 300 }, { gl: 90, dl: 300 }],
  opcje: { zlew: 'podblat', plyta: 'nakladana', otwory: 2, pomieszczenie: 'kuchnia' },
};

test('metraż ponad jedną płytę: liczy się blok, komunikat wymienia symbole', () => {
  const blok = tabelaBloku(TABELA);
  const w = wycenZMagazynu(PLYTA(blok), DUZY_BLAT);
  assert.equal(w.ok, true, w.blad);
  assert.ok(w.pak.plytyPelne > 1, 'scenariusz musi wymagać co najmniej dwóch płyt');

  const nota = w.ostrzezenia.find((o) => /TEGO SAMEGO bloku/.test(o));
  assert.ok(nota, 'klient ma wiedzieć, że wzór będzie spójny');
  assert.match(nota, /93054/, 'wskazana płyta pierwsza');
  assert.match(nota, /93055/, 'dobrana z tabeli bloku');
  assert.match(nota, /spójne/);
  assert.ok(!w.ostrzezenia.some((o) => /Sprawdzimy termin dostawy/.test(o)), 'bloku starcza');
});

test('bloku nie starcza: ostrzeżenie podaje ŁĄCZNĄ dostępność bloku', () => {
  const malyBlok = tabelaBloku(
    wiersz('Na stanie', 'Wrocław', '93054', 'pol_2x310x175 dp_', '5.43 m²') +
      wiersz('Na stanie', 'Mszczonów', '93055', 'pol_2x315x165 dp_', '1.2 m²')
  );
  const w = wycenZMagazynu(PLYTA(malyBlok), DUZY_BLAT);
  assert.equal(w.ok, true, w.blad);
  const nota = w.ostrzezenia.find((o) => /Sprawdzimy termin dostawy/.test(o));
  assert.ok(nota);
  assert.match(nota, /6,6\s*m² z tego bloku \(2 płyt\)/);
});

test('bez tabeli bloku zachowanie jak dotąd — liczy się sama płyta', () => {
  const w = wycenZMagazynu(PLYTA(null), DUZY_BLAT);
  assert.equal(w.ok, true, w.blad);
  assert.ok(w.ostrzezenia.some((o) => /Sprawdzimy termin dostawy/.test(o)));
});

test('mały blat na jedną płytę — żadnych dopisków o bloku', () => {
  const w = wycenZMagazynu(PLYTA(tabelaBloku(TABELA)), {
    odcinki: [{ gl: 60, dl: 200 }],
    opcje: { zlew: 'podblat', plyta: 'nakladana', otwory: 1, pomieszczenie: 'kuchnia' },
  });
  assert.equal(w.ok, true, w.blad);
  assert.ok(!w.ostrzezenia.some((o) => /bloku/.test(o)), JSON.stringify(w.ostrzezenia));
});

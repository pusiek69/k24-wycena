/**
 * PŁYTY DODATKOWE W ROZKROJU — resztki poprodukcyjne (zlecenie Dawida, 2.11.2026).
 *
 *   node --test scripts/test-plyty-dodatkowe.mjs
 *
 * „Mam kawałek po produkcji i mogę go wykorzystać przy następnym zleceniu."
 * Dawid dokłada do rozkroju arkusz o WŁASNYM wymiarze (i opcjonalnej cenie —
 * domyślnie 0 zł, bo resztka już jest opłacona). Automat używa resztek
 * PRZED pełnymi płytami; cena klienta NIE zmienia się sama — rozbicie
 * i ostrzeżenie pokazują różnicę, decyzja należy do Dawida.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { rozrysuj } from '../src/engine/nesting.js';
import { dodajPlyte, doUkladu } from '../src/app/rozkroj-reczny.js';

const zrodlo = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const PLYTA = { szer: 3200, wys: 1600 };

test('AUTOMAT: elementy mieszczące się na resztce nie biorą pełnej płyty', () => {
  // Blat 60×200 cm mieści się na resztce 220×80 cm — pełna płyta zbędna.
  const w = rozrysuj([{ nazwa: 'Blat', szer: 2000, gl: 600, ilosc: 1 }], PLYTA, {
    dodatkowePlyty: [{ szer: 2200, wys: 800, etykieta: 'resztka z magazynu' }],
  });
  assert.equal(w.plyty.length, 1, 'miała wystarczyć sama resztka');
  assert.equal(w.plyty[0].dodatkowa, true);
  assert.equal(w.plyty[0].szer, 2200);
  assert.equal(w.plyty[0].wys, 800);
  assert.equal(w.plyty[0].etykieta, 'resztka z magazynu');
  assert.equal(w.nieumieszczone.length, 0);
  assert.equal(w.statystyki.dodatkowych, 1);
  assert.equal(w.statystyki.plytPelnych, 0, 'resztka nie jest pełną płytą w statystyce');
});

test('AUTOMAT: resztka ZA MAŁA jest pomijana, nie blokuje układu', () => {
  const w = rozrysuj([{ nazwa: 'Blat', szer: 3000, gl: 600, ilosc: 1 }], PLYTA, {
    dodatkowePlyty: [{ szer: 500, wys: 400, etykieta: 'ścinka' }],
  });
  assert.equal(w.plyty.length, 1);
  assert.ok(!w.plyty[0].dodatkowa, 'za mała resztka nie ma prawa wejść do układu');
  assert.equal(w.statystyki.dodatkowych, 0);
  assert.equal(w.nieumieszczone.length, 0);
});

test('AUTOMAT: resztka + pełna płyta — rzaz i reszta zasad bez zmian', () => {
  // Na resztkę 100×70 wejdzie blat 60×90; drugi (60×300) musi na pełną.
  const w = rozrysuj(
    [
      { nazwa: 'Wyspa', szer: 900, gl: 600, ilosc: 1 },
      { nazwa: 'Blat', szer: 3000, gl: 600, ilosc: 1 },
    ],
    PLYTA,
    { dodatkowePlyty: [{ szer: 1000, wys: 700 }], rzaz: 3 }
  );
  assert.equal(w.plyty.length, 2);
  const dodatkowa = w.plyty.find((p) => p.dodatkowa);
  const pelna = w.plyty.find((p) => !p.dodatkowa);
  assert.ok(dodatkowa && pelna);
  assert.equal(dodatkowa.elementy.length, 1);
  assert.equal(dodatkowa.elementy[0].nazwa, 'Wyspa');
  assert.equal(pelna.elementy[0].nazwa, 'Blat');
  // Statystyki liczą metry z RZECZYWISTYCH wymiarów (0,7 m² + 5,12 m²).
  assert.ok(Math.abs(w.statystyki.plytM2 - (0.7 + 5.12)) < 0.001, `plytM2: ${w.statystyki.plytM2}`);
});

test('AUTOMAT: połówka NIGDY nie powstaje z resztki', () => {
  // Wszystko mieści się na resztce — domknięcie na połówce nie ma prawa
  // przyciąć arkusza, który fizycznie leży na magazynie w tym wymiarze.
  const w = rozrysuj([{ nazwa: 'Blat', szer: 1500, gl: 300, ilosc: 1 }], PLYTA, {
    dodatkowePlyty: [{ szer: 1600, wys: 900 }],
    polowkaDozwolona: true,
  });
  assert.equal(w.plyty.length, 1);
  assert.equal(w.plyty[0].dodatkowa, true);
  assert.ok(!w.plyty[0].polowka, 'resztka przycięta do połówki!');
  assert.equal(w.plyty[0].wys, 900, 'wymiar resztki ma zostać nietknięty');
});

test('AUTOMAT: bez dodatkowych płyt wynik jak dotąd (regresja)', () => {
  const el = [{ nazwa: 'Blat', szer: 3000, gl: 600, ilosc: 1 }];
  const przed = rozrysuj(el, PLYTA, {});
  const zPusta = rozrysuj(el, PLYTA, { dodatkowePlyty: [] });
  assert.deepEqual(zPusta.plyty.map((p) => [p.szer, p.wys]), przed.plyty.map((p) => [p.szer, p.wys]));
  assert.equal(przed.statystyki.dodatkowych, 0);
});

test('TRYB RĘCZNY: dodajPlyte przyjmuje własny wymiar i etykietę', () => {
  const model = { plyty: [{ nr: 1, szer: 3200, wys: 1600, margines: 0, elementy: [] }] };
  const po = dodajPlyte(model, { szer: 1200, wys: 700, etykieta: 'resztka' });
  assert.equal(po.plyty.length, 2);
  assert.equal(po.plyty[1].szer, 1200);
  assert.equal(po.plyty[1].wys, 700);
  assert.equal(po.plyty[1].dodatkowa, true);
  assert.equal(po.plyty[1].etykieta, 'resztka');
  // Bez wymiaru — jak dotąd (wzorzec z ostatniej płyty).
  const stare = dodajPlyte(model);
  assert.equal(stare.plyty[1].szer, 3200);
  assert.ok(!stare.plyty[1].dodatkowa);
});

test('UI rozrysu: przycisk dodania, cena resztki (0 = za darmo) i rozbicie bez ruszania ceny', () => {
  const r = zrodlo('src/app/rozrys.js');
  assert.match(r, /Dodaj płytę o innym wymiarze/, 'brak przycisku dodania resztki');
  assert.match(r, /dodatkowePlyty/, 'rozrys nie zna płyt dodatkowych');
  assert.match(r, /cena tej płyty/i, 'brak pola ceny resztki');
  assert.match(r, /nie zmieni\w* się sam/i, 'brak zastrzeżenia, że cena klienta nie zmienia się sama');
  // Automat edytora przekazuje resztki do silnika rozrysu.
  assert.match(r, /rozrysuj\(k\.elementy, k\.plyta, \{[\s\S]{0,200}dodatkowePlyty/, 'automat nie widzi resztek');
});

test('ZAMROŻENIE: oferta dostaje układ z resztkami (automat przekazuje dodatkowePlyty)', () => {
  const o = zrodlo('src/app/oferta-dawida.js');
  assert.match(o, /zamrozRozrys[\s\S]{0,2200}dodatkowePlyty/, 'zamrozRozrys gubi resztki przy wysyłce');
});

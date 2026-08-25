/**
 * PŁYTA WŁASNA — materiał spoza cenników.
 *
 *   node --test scripts/test-plyta-wlasna.mjs
 *
 * Zlecenie Dawida (25.08.2026): dodawanie płyt ręcznie — wymiar, cena,
 * nazwa i ewentualny numer płyty.
 *
 * Najwięcej pilnujemy PRZELICZENIA CENY: w hurtowniach spotyka się i „za
 * m²", i „za całą płytę", raz netto, raz brutto. Pomyłka w którąkolwiek
 * stronę to realne pieniądze na każdym zleceniu.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PUSTA,
  VAT_MATERIALU,
  poleM2,
  cenaBruttoM2,
  cenaNettoM2,
  czegoBrakuje,
  opisDlaKlienta,
  doWariantu,
} from '../src/app/plyta-wlasna.js';
import { wczytajSilnik } from './lib/silnik.mjs';

const { wycenWlasciciela, wariantReczny } = await wczytajSilnik();

const PLYTA = { ...PUSTA, nazwa: 'Dekton Aura 15', szer: 3200, wys: 1440, cena: 1000 };

/* ─────────────────────────────────────────────── metraż i przeliczenia */

test('powierzchnia płyty liczona z milimetrów', () => {
  assert.equal(poleM2({ szer: 3200, wys: 1440 }), 4.608);
  assert.equal(poleM2({ szer: 3480, wys: 2010 }), 6.9948);
});

test('brak wymiaru to zero metrów, nie NaN', () => {
  assert.equal(poleM2({}), 0);
  assert.equal(poleM2({ szer: 3200, wys: 0 }), 0);
});

test('cena za m² brutto zostaje bez zmian', () => {
  assert.equal(cenaBruttoM2({ ...PLYTA, jednostka: 'm2', forma: 'brutto', cena: 900 }), 900);
});

test('cena za m² netto podnosi się o VAT', () => {
  assert.equal(cenaBruttoM2({ ...PLYTA, jednostka: 'm2', forma: 'netto', cena: 1000 }), 1230);
});

test('cena za CAŁĄ PŁYTĘ dzieli się przez metraż', () => {
  // 4608 zł brutto za płytę 4,608 m² = 1000 zł/m².
  const p = { ...PLYTA, jednostka: 'plyta', forma: 'brutto', cena: 4608 };
  assert.equal(cenaBruttoM2(p), 1000);
});

test('cena za całą płytę NETTO przechodzi obie konwersje', () => {
  const p = { ...PLYTA, jednostka: 'plyta', forma: 'netto', cena: 4608 };
  assert.equal(cenaBruttoM2(p), 1230);
});

test('netto i brutto są swoimi odwrotnościami', () => {
  const p = { ...PLYTA, jednostka: 'm2', forma: 'brutto', cena: 861 };
  assert.equal(Math.round(cenaNettoM2(p) * (1 + VAT_MATERIALU)), 861);
});

test('cena za całą płytę bez wymiaru nie dzieli przez zero', () => {
  const p = { ...PLYTA, szer: 0, wys: 0, jednostka: 'plyta', cena: 4000 };
  assert.equal(cenaBruttoM2(p), 0);
  assert.ok(Number.isFinite(cenaBruttoM2(p)));
});

test('zerowa i ujemna cena nie przechodzą', () => {
  assert.equal(cenaBruttoM2({ ...PLYTA, cena: 0 }), 0);
  assert.equal(cenaBruttoM2({ ...PLYTA, cena: -500 }), 0);
});

/* ─────────────────────────────────────────────────────── kompletność */

test('brakujące dane nazwane po polsku', () => {
  assert.match(czegoBrakuje({ ...PLYTA, nazwa: '' }), /nazw/i);
  assert.match(czegoBrakuje({ ...PLYTA, szer: 0 }), /wymiar/i);
  assert.match(czegoBrakuje({ ...PLYTA, cena: 0 }), /cen/i);
  assert.equal(czegoBrakuje(PLYTA), null);
});

test('sama spacja to nie jest nazwa', () => {
  assert.match(czegoBrakuje({ ...PLYTA, nazwa: '   ' }), /nazw/i);
});

/* ──────────────────────────────────── co widzi klient */

test('numer płyty trafia do opisu, gdy Dawid go wpisał', () => {
  assert.equal(opisDlaKlienta({ nazwa: 'Dekton Aura', nrPlyty: '24/118' }), 'Dekton Aura (płyta nr 24/118)');
});

test('bez numeru opis to sama nazwa', () => {
  assert.equal(opisDlaKlienta({ nazwa: 'Dekton Aura' }), 'Dekton Aura');
  assert.equal(opisDlaKlienta({ nazwa: 'Dekton Aura', nrPlyty: '  ' }), 'Dekton Aura');
});

/* ────────────────────────────── wycena tym samym silnikiem */

const wycen = (plyta, odcinki = [{ gl: 60, dl: 300 }]) =>
  wycenWlasciciela(wariantReczny({ ...doWariantu(plyta, '20'), rodzaj: 'Płyta własna' }), {
    odcinki,
    opcje: { pomieszczenie: 'kuchnia', otwory: 1 },
    grubosc: '20',
  });

test('płyta własna wycenia się jak każdy inny materiał', () => {
  const w = wycen(PLYTA);
  assert.equal(w.ok, true, w.blad);
  assert.ok(w.razem > 0);
  assert.match(w.dekor, /Dekton Aura 15/);
});

test('liczymy PEŁNYMI płytami z podanego wymiaru', () => {
  // Blat 0,6 m² na płycie 4,608 m² — i tak płacimy za całą płytę.
  const w = wycen(PLYTA, [{ gl: 60, dl: 100 }]);
  assert.equal(w.ok, true, w.blad);
  assert.ok(w.pak.m2Kupione >= 4.6, `kupione ${w.pak.m2Kupione} m² zamiast całej płyty`);
});

test('dwa blaty ponad jedną płytę wymuszają drugą', () => {
  const w = wycen(PLYTA, [{ gl: 60, dl: 300 }, { gl: 60, dl: 300 }, { gl: 90, dl: 300 }]);
  assert.equal(w.ok, true, w.blad);
  assert.ok(w.pak.plytyPelne >= 2, `wyszło ${w.pak.plytyPelne} płyt`);
});

test('płyta własna NIE dostaje dodatku za obróbkę kamienia naturalnego', () => {
  // Dodatek dotyczy wyłącznie kamienia — po nim poznaje go silnik.
  const w = wycen(PLYTA);
  const nazwy = w.pozycje.map((p) => p.nazwa).join(' | ');
  assert.doesNotMatch(nazwy, /kamien|kamień/i, `doliczono dodatek naturalny: ${nazwy}`);
});

test('wymiar płyty jest brany dosłownie — bez obcinania obrzeża', () => {
  // Dawid podaje wymiar użytkowy („podaję wymiary bez marginesów"),
  // więc z płyty 3200 mm ma wyjść blat 320 cm, a nie 318.
  const w = wycen(PLYTA, [{ gl: 60, dl: 320 }]);
  assert.equal(w.ok, true, w.blad);
  assert.equal(w.pak.plytyPelne, 1, 'blat równy szerokości płyty wymusił drugą płytę');
});

test('bez ceny silnik odmawia, zamiast liczyć zero', () => {
  const w = wycen({ ...PLYTA, cena: 0 });
  assert.equal(w.ok, false);
});

test('cena za całą płytę daje tę samą kwotę co równoważna cena za m²', () => {
  const zaM2 = wycen({ ...PLYTA, jednostka: 'm2', cena: 1000 });
  const zaPlyte = wycen({ ...PLYTA, jednostka: 'plyta', cena: 4608 });
  assert.equal(zaM2.razem, zaPlyte.razem);
});

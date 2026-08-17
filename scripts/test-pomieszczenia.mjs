/**
 * Rozdzielone ścieżki: blat kuchenny a blat łazienkowy.
 *
 *   node --test scripts/test-pomieszczenia.mjs
 *
 * Reguły, których pilnujemy (decyzja Dawida, 17.08.2026):
 *   • w łazience NIE MA płyty grzewczej — ani pytania, ani dopłaty,
 *   • odbiór własny jest wariantem WYŁĄCZNIE łazienkowym; blat kuchenny
 *     montujemy zawsze, bo wymaga naszego pomiaru,
 *   • w łazience bywa więcej niż jedna umywalka i każde wycięcie kosztuje.
 *
 * Ostatnia reguła jest najważniejsza w drugą stronę: gdyby konsultant
 * pomylił się i podał odbiór własny przy kuchni, wycena ma go ZIGNOROWAĆ,
 * a nie policzyć blat bez montażu.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { wycen } from '../src/engine/wycena.js';
import { opcjeZParametrow, opcjeZeSzczegolow, odczytajSzczegoly } from '../src/app/parametry.js';
import { ROBOCIZNA, OPCJE, VAT } from '../src/firms/_domyslne.js';

const FIRMA = {
  slug: 'test',
  nazwa: 'Test',
  typ: 'konglomerat kwarcowy',
  aktywna: true,
  trybCeny: 'katalog',
  vat: VAT,
  cenyUslug: 'brutto',
  plyta: { w: 320, h: 160, polowkaDozwolona: true },
  robocizna: ROBOCIZNA,
  opcje: OPCJE,
  dekory: { Testowy: { 20: 800 } },
};

const LAZIENKA = [{ gl: 60, dl: 120 }];
const KUCHNIA = [{ gl: 60, dl: 300 }];

const licz = (odcinki, opcje) => wycen(FIRMA, { dekor: 'Testowy', grubosc: '20', odcinki, opcje });
const poz = (w, wzor) => w.pozycje.find((p) => wzor.test(p.nazwa));
const CENA_PLYTY = 250; // wycięcie pod płytę nakładaną
const CENA_ZLEWU = 650; // wycięcie + montaż zlewu podblatowego

/* ─────────────────────────────────────────── łazienka: bez płyty grzewczej */

test('łazienka nie dostaje wycięcia pod płytę grzewczą', () => {
  const w = licz(LAZIENKA, opcjeZParametrow({ pomieszczenie: 'lazienka', otwory: 1 }));
  assert.equal(poz(w, /płyt[ęy] (grzewcz|nakładan|licowan)/i), undefined);
});

test('kuchnia dostaje wycięcie pod płytę', () => {
  const w = licz(KUCHNIA, opcjeZParametrow({ pomieszczenie: 'kuchnia', otwory: 1 }));
  assert.ok(poz(w, /płyt[ęy] nakładan/i));
});

test('ta sama łazienka jest o wycięcie pod płytę tańsza niż wyceniona jak kuchnia', () => {
  const jakLazienka = licz(LAZIENKA, opcjeZParametrow({ pomieszczenie: 'lazienka', otwory: 1 }));
  const jakKuchnia = licz(LAZIENKA, opcjeZParametrow({ pomieszczenie: 'kuchnia', otwory: 1 }));
  assert.ok(Math.abs(jakKuchnia.razem - jakLazienka.razem - CENA_PLYTY) < 0.01);
});

test('konsultant nie może doliczyć indukcji w łazience, nawet gdy poda pole', () => {
  const o = opcjeZParametrow({ pomieszczenie: 'lazienka', indukcja_licowana: true, otwory: 1 });
  assert.equal(o.plyta, 'brak');
  assert.equal(poz(licz(LAZIENKA, o), /płyt/i), undefined);
});

/* ──────────────────────────────────── odbiór własny tylko przy łazience */

test('łazienka może być bez montażu', () => {
  const o = opcjeZParametrow({ pomieszczenie: 'lazienka', odbior_wlasny: true, otwory: 1 });
  assert.equal(o.dostawa, 'odbior');
  assert.equal(licz(LAZIENKA, o).odbiorWlasny, true);
});

test('kuchnia zawsze z montażem — nawet gdy konsultant poprosi o odbiór', () => {
  const o = opcjeZParametrow({ pomieszczenie: 'kuchnia', odbior_wlasny: true, otwory: 1 });
  assert.equal(o.dostawa, 'montaz');
  const w = licz(KUCHNIA, o);
  assert.equal(w.odbiorWlasny, false);
  assert.ok(poz(w, /Transport i montaż/), 'montaż musi zostać w wycenie');
});

test('brak podanego pomieszczenia znaczy kuchnia — czyli montaż', () => {
  const o = opcjeZParametrow({ odbior_wlasny: true, otwory: 1 });
  assert.equal(o.dostawa, 'montaz');
  assert.equal(o.plyta, 'nakladana');
});

test('kreator też nie wypuści kuchni bez montażu', () => {
  assert.equal(opcjeZeSzczegolow({ odbior: true }, 'kuchnia').dostawa, 'montaz');
  assert.equal(opcjeZeSzczegolow({ odbior: true }, 'lazienka').dostawa, 'odbior');
});

/* ──────────────────────────────────────────────── liczba umywalek */

test('dwie umywalki to dwa wycięcia', () => {
  const jedna = licz(LAZIENKA, opcjeZParametrow({ pomieszczenie: 'lazienka', umywalki: 1, otwory: 1 }));
  const dwie = licz(LAZIENKA, opcjeZParametrow({ pomieszczenie: 'lazienka', umywalki: 2, otwory: 1 }));
  assert.ok(Math.abs(dwie.razem - jedna.razem - CENA_ZLEWU) < 0.01);
  assert.equal(poz(dwie, /zlewu podblatowego/).detal, '2 szt.');
});

test('przy jednej umywalce nie dopisujemy „1 szt."', () => {
  const w = licz(LAZIENKA, opcjeZParametrow({ pomieszczenie: 'lazienka', umywalki: 1, otwory: 1 }));
  assert.equal(poz(w, /zlewu podblatowego/).detal, undefined);
});

test('brak liczby umywalek znaczy jedna', () => {
  assert.equal(opcjeZParametrow({ pomieszczenie: 'lazienka' }).zlewy, 1);
  assert.equal(opcjeZeSzczegolow({}, 'lazienka').zlewy, 1);
});

test('umywalka nablatowa jest tańsza od podwieszanej', () => {
  const pod = licz(LAZIENKA, opcjeZParametrow({ pomieszczenie: 'lazienka', otwory: 1 }));
  const nad = licz(LAZIENKA, opcjeZParametrow({ pomieszczenie: 'lazienka', zlew_nablatowy: true, otwory: 1 }));
  assert.ok(nad.razem < pod.razem);
});

/* ────────────────────────────────── odczyt tego, co klient wyklikał */

test('wiadomość z kreatora łazienkowego czyta się poprawnie', () => {
  const s = odczytajSzczegoly(
    'Umywalka nablatowa, liczba umywalek: 2, otwory w blacie: 3, bez montażu — odbiór własny z zakładu. Proszę o wycenę blatu łazienkowego.'
  );
  assert.equal(s.nablatowy, true);
  assert.equal(s.zlewy, 2);
  assert.equal(s.otwory, 3);
  assert.equal(s.odbior, true);
});

test('wiadomość z kreatora kuchennego nadal czyta się poprawnie', () => {
  const s = odczytajSzczegoly(
    'Zlew podwieszany, płyta indukcyjna licowana z blatem, otwory w blacie: 2, z montażem u klienta. Proszę o wycenę blatu kuchennego.'
  );
  assert.equal(s.nablatowy, false);
  assert.equal(s.licowana, true);
  assert.equal(s.otwory, 2);
  assert.equal(s.odbior, false);
  assert.equal(s.zlewy, undefined, 'w kuchni o liczbę zlewów nie pytamy');
});

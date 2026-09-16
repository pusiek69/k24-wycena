/**
 * RĘCZNE CENY USŁUG W EDYTORZE WŁAŚCICIELA (zlecenie Dawida, 16.09.2026).
 *
 *   node --test scripts/test-ceny-uslug.mjs
 *
 * „Chcę mieć możliwość zmiany ceny w każdej usłudze."
 *
 * Najgroźniejsza pomyłka przy takiej funkcji nie jest w polu tekstowym,
 * tylko w SUMIE: nadpisanie musi zmienić kwotę wyjściową, a nie udawać
 * rabatu — inaczej przekreślona cena na ofercie pokazywałaby kwotę,
 * której Dawid nigdy nie podał, a warianty dostałyby ten „upust"
 * w procentach (patrz upustGlownej w warianty.js).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  cenaPozycji,
  doParametrow,
  recznaCena,
  roznicaRecznychCen,
  ustawCene,
  zParametrow,
} from '../src/app/ceny-pozycji.js';

/** Pozycje takie, jakie oddaje silnik wyceny. */
const POZYCJE = [
  { nazwa: 'Materiał', brutto: 4000 },
  { nazwa: 'Cięcie i obróbka', brutto: 1200 },
  { nazwa: 'Wycięcie pod zlew', brutto: 300 },
  { nazwa: 'Montaż', brutto: 900 },
  { nazwa: 'Pomiar Prolinerem', brutto: 0, wCenie: true },
];
const zrodlo = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/* ═════════════════════════════ pojedyncza cena ═════════════════════════ */

test('bez nadpisania obowiązuje cena z cennika', () => {
  const ceny = new Map();
  assert.equal(cenaPozycji(ceny, POZYCJE[3]), 900);
  assert.equal(recznaCena(ceny, 'Montaż'), false);
  assert.equal(roznicaRecznychCen(ceny, POZYCJE, new Set()), 0);
});

test('ręczna cena wygrywa z cennikową', () => {
  const ceny = new Map();
  ustawCene(ceny, POZYCJE[3], 700);
  assert.equal(cenaPozycji(ceny, POZYCJE[3]), 700);
  assert.equal(recznaCena(ceny, 'Montaż'), true);
  // Pozostałe pozycje zostają nietknięte — zmiana jest punktowa.
  assert.equal(cenaPozycji(ceny, POZYCJE[1]), 1200);
});

test('wpisanie ceny cennikowej kasuje nadpisanie', () => {
  /*
   * Inaczej pozycja zostałaby „ręczna" na zawsze: kwota ta sama, ale przy
   * najbliższej zmianie stawek w panelu ta wycena po cichu trzymałaby stare
   * pieniądze, a Dawid nie miałby jak się domyślić dlaczego.
   */
  const ceny = new Map();
  ustawCene(ceny, POZYCJE[3], 700);
  ustawCene(ceny, POZYCJE[3], 900);
  assert.equal(recznaCena(ceny, 'Montaż'), false);
  assert.equal(cenaPozycji(ceny, POZYCJE[3]), 900);
});

test('cena ujemna i śmieci schodzą do zera, nie do NaN', () => {
  const ceny = new Map();
  ustawCene(ceny, POZYCJE[1], -50);
  assert.equal(cenaPozycji(ceny, POZYCJE[1]), 0);
  ustawCene(ceny, POZYCJE[1], 'dużo');
  assert.equal(cenaPozycji(ceny, POZYCJE[1]), 0);
  // Kwoty trzymamy w pełnych złotych — „1 499,70" to 1500 zł, a nie zero.
  ustawCene(ceny, POZYCJE[1], '1 499,70');
  assert.equal(cenaPozycji(ceny, POZYCJE[1]), 1500, 'przecinek dziesiętny nie ma wywalać kwoty');
});

/* ═════════════════════════════ wpływ na sumę ═══════════════════════════ */

test('różnica z nadpisań to dokładnie tyle, ile Dawid zmienił', () => {
  const ceny = new Map();
  ustawCene(ceny, POZYCJE[3], 700); // −200
  ustawCene(ceny, POZYCJE[1], 1500); // +300
  assert.equal(roznicaRecznychCen(ceny, POZYCJE, new Set()), 100);
});

test('pozycja „w cenie" nie wchodzi do różnicy', () => {
  /*
   * Pomiar jest w cenie, czyli w sumie silnika siedzi jako zero. Gdyby jego
   * nadpisanie doliczało się do kwoty wyjściowej, oferta rosłaby o pieniądze,
   * których nie ma w żadnej pozycji.
   */
  const ceny = new Map();
  ustawCene(ceny, POZYCJE[4], 250);
  assert.equal(roznicaRecznychCen(ceny, POZYCJE, new Set()), 0);
});

test('gratis wygrywa z ręczną ceną i nie liczy się podwójnie', () => {
  const ceny = new Map();
  ustawCene(ceny, POZYCJE[3], 700);
  const gratisy = new Set(['Montaż']);
  assert.equal(roznicaRecznychCen(ceny, POZYCJE, gratisy), 0, 'gratis policzył się dwa razy');
});

/* ══════════════════════ przeżycie „Powtórz wycenę" ═════════════════════ */

test('ceny wracają z parametrów oferty', () => {
  const ceny = zParametrow({ Montaż: 700, 'Cięcie i obróbka': '1500' });
  assert.equal(cenaPozycji(ceny, POZYCJE[3]), 700);
  assert.equal(cenaPozycji(ceny, POZYCJE[1]), 1500);
});

test('brak nadpisań nie zostawia pola w parametrach', () => {
  // Stare oferty mają wyglądać w JSON-ie dokładnie jak dotąd.
  assert.equal(doParametrow(new Map()), undefined);
  assert.deepEqual(doParametrow(new Map([['Montaż', 700]])), { Montaż: 700 });
  assert.deepEqual(zParametrow(undefined), new Map());
  assert.deepEqual(zParametrow(null), new Map());
});

/* ═══════════════════════ wpięcie w edytor (źródło) ═════════════════════ */

test('EDYTOR dolicza ręczne ceny PRZED upustem, a nie jako rabat', () => {
  /*
   * Gdyby różnica z nadpisań wchodziła po upuście, obniżenie montażu
   * wyglądałoby na ofercie jak rabat — z przekreśloną kwotą, której
   * Dawid nigdy nie podał.
   */
  const ed = zrodlo('src/app/oferta-dawida.js');
  assert.match(ed, /const roznicaCen = cenyPoz\.roznicaRecznychCen\(stan\.ceny, w\.pozycje, stan\.gratisy\)/);
  assert.match(ed, /const przed = Math\.round\(w\.razemZaokr \|\| w\.razem\) \+ wlasneRazem \+ roznicaCen;/);
  assert.ok(
    ed.indexOf('const roznicaCen') < ed.indexOf("stan.korektaTyp === 'procent'"),
    'ręczne ceny liczone po zastosowaniu upustu'
  );
});

test('EDYTOR pokazuje, że cena jest ręczna, i pozwala wrócić do cennikowej', () => {
  const ed = zrodlo('src/app/oferta-dawida.js');
  assert.match(ed, /cena-reczna/, 'brak oznaczenia ręcznej ceny');
  assert.match(ed, /Wróć do ceny z cennika/, 'brak powrotu do ceny cennikowej');
  assert.match(ed, /cennik i stawki w panelu zostają bez zmian/, 'brak informacji o zasięgu zmiany');
  // Ceny zapisują się do parametrów, więc poprawka oferty ich nie gubi.
  assert.match(ed, /ceny: cenyPoz\.doParametrow\(stan\.ceny\)/);
  assert.match(ed, /ceny: cenyPoz\.zParametrow\(p\.ceny\)/);
});

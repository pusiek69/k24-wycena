/**
 * LINKI DO KONKRETNEJ PŁYTY W MAGAZYNIE INTERSTONE.
 *
 *   node --test scripts/test-magazyn-linki.mjs
 *
 * Zlecenie Dawida (26.08.2026): „ciężko mi ją znaleźć na magazynie".
 *
 * Testy pilnują trzech rzeczy, z których każda była sprawdzona na ŻYWYM
 * magazynie 26.08.2026 (22 płyty granitu i marmuru, 22/22 trafień):
 *
 *   1. szukamy po SAMYM NUMERZE płyty — pełny kod STON zwraca siedem
 *      przypadkowych płyt zamiast tej jednej,
 *   2. w adresie NIE MA filtra grupy — jego dodanie psuje wyszukiwanie
 *      po numerze, nawet gdy grupa jest właściwa,
 *   3. linki są tylko dla Dawida — na stronie oferty klienta ich nie ma.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { linkPlyty, numerPlyty, linkMagazynu } from '../src/app/magazyn-linki.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ───────────────────────────────────── numer płyty z dowolnego zapisu */

test('numer płyty z pełnego kodu', () => {
  assert.equal(numerPlyty('STON000510-90659'), '90659');
});

test('kod ze spacjami, małymi literami i myślnikiem typograficznym', () => {
  assert.equal(numerPlyty('STON000510 - 90659'), '90659');
  assert.equal(numerPlyty('ston000510-90659'), '90659');
});

test('adres zdjęcia ze strony magazynu też niesie numer', () => {
  // Dawid czasem kopiuje adres obrazka zamiast przepisywać kod.
  assert.equal(numerPlyty('/content/uploads/images/stock/STON000510/90659/90659-1.JPG'), '90659');
});

test('sam numer przechodzi bez zmian', () => {
  assert.equal(numerPlyty('90659'), '90659');
});

test('śmieci nie dają numeru', () => {
  for (const x of ['', null, undefined, 'kamień', 'STON000510']) {
    assert.equal(numerPlyty(x), '', JSON.stringify(x));
  }
});

/* ─────────────────────────────────────────────────────── adres płyty */

test('adres zawęża magazyn do numeru tej płyty', () => {
  const u = new URL(linkPlyty('STON000510-90659'));
  assert.equal(u.origin + u.pathname, 'https://www.interstone.pl/stan-magazynowy');
  assert.equal(u.searchParams.get('search'), '90659');
  assert.equal(u.searchParams.get('type'), 'inventory');
});

test('w adresie NIE MA pełnego kodu STON', () => {
  // Sprawdzone na żywo: search=STON000510-90659 oddaje 7 przypadkowych płyt.
  const url = linkPlyty('STON000510-90659');
  assert.ok(!url.includes('STON'), `pełny kod w adresie: ${url}`);
});

test('w adresie NIE MA filtra grupy', () => {
  /*
   * To nie jest kosmetyka. `inventory-group` psuje wyszukiwanie po numerze
   * i magazyn wraca do tej samej siódemki losowych płyt — sprawdzone na
   * marmurze 80989 z poprawną grupą 511 i z niepoprawną 512.
   */
  const u = new URL(linkPlyty('STON000213-80989'));
  assert.equal(u.searchParams.get('inventory-group'), null);
});

test('bez numeru nie ma linku — zamiast losowej listy wolimy nic', () => {
  for (const x of ['', 'kamień', null]) assert.equal(linkPlyty(x), null, JSON.stringify(x));
});

test('link klienta do przeglądania magazynu został nietknięty', () => {
  // `linkMagazynu` obsługuje kreator klienta — filtr grupy JEST tam potrzebny,
  // bo klient przegląda kamień, a nie szuka jednej płyty po numerze.
  const u = new URL(linkMagazynu({ grupa: 512 }));
  assert.equal(u.searchParams.get('inventory-group'), '512');
  assert.equal(u.searchParams.get('inventory-status'), '122');
});

/* ──────────────────────────────── zakres: to widzi wyłącznie Dawid */

const czytaj = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('oferta klienta NIE linkuje do magazynu', () => {
  // Zakres ze zlecenia: „NIE na ofercie klienta (tam bez zmian)".
  for (const plik of ['src/app/oferta-widok.js', 'src/app/wynik-widok.js']) {
    assert.ok(!czytaj(plik).includes('linkPlyty'), `${plik} linkuje płytę do magazynu`);
  }
});

test('mail do KLIENTA nie niesie linku do magazynu', () => {
  assert.ok(!czytaj('worker/mail-oferty.js').includes('linkPlyty'));
});

test('panel i edytor Dawida link mają', () => {
  assert.ok(czytaj('worker/panel.js').includes('linkPlyty'), 'panel bez linku');
  assert.ok(czytaj('src/app/oferta-dawida.js').includes('linkPlyty'), 'edytor bez linku');
});

test('oferta Dawida zapisuje kod płyty do bazy', () => {
  // Bez tego panel nie ma czego zlinkować — kolumna zostawała pusta.
  assert.ok(
    czytaj('worker/baza.js').includes("String(oferta.kodPlyty || '')"),
    'zapiszOferte gubi kod płyty'
  );
});

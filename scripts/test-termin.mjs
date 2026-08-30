/**
 * PLANOWANY CZAS REALIZACJI (zlecenie Dawida, 30.08.2026).
 *
 *   node --test scripts/test-termin.mjs
 *
 * „Chcę wiedzieć, czy klientowi zależy na blacie za tydzień, czy planuje
 * za rok." Jedno pole, ale musi dojechać w trzy miejsca naraz: na kartę
 * klienta w panelu (kolumna + filtr), do maila leadowego i do danych
 * wyceny. Te testy pilnują, żeby żadne z nich nie zostało w tyle.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  TERMINY,
  NIEZNANY,
  termin,
  etykietaTerminu,
  krotkiTermin,
  pilny,
  znanyTermin,
} from '../src/app/termin.js';

const zrodlo = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/* ─────────────────────────────────────────────────────────── sama lista */

test('lista terminów pokrywa cały zakres — od „na już" po „dopiero planuję"', () => {
  assert.deepEqual(
    TERMINY.map((t) => t.id),
    ['pilne', 'miesiac', 'kwartal', 'pol_roku', 'pozniej']
  );
});

test('każdy termin ma etykietę pełną i skróconą', () => {
  for (const t of TERMINY) {
    assert.ok(t.label && t.label.length > 3, `${t.id}: brak etykiety`);
    assert.ok(t.krotki && t.krotki.length > 2, `${t.id}: brak skrótu`);
    // Skrót jedzie do tabeli w panelu — długi rozwaliłby wiersz.
    assert.ok(t.krotki.length <= 16, `${t.id}: skrót „${t.krotki}" za długi`);
  }
});

test('PILNY jest dokładnie JEDEN — to ma być decyzja, nie skala', () => {
  const pilne = TERMINY.filter((t) => t.pilny);
  assert.equal(pilne.length, 1);
  assert.equal(pilne[0].id, 'pilne');
});

test('identyfikatory są techniczne i stabilne — trafiają do bazy', () => {
  for (const t of TERMINY) {
    assert.match(t.id, /^[a-z_]+$/, `${t.id}: id musi być bez spacji i znaków polskich`);
  }
  assert.equal(new Set(TERMINY.map((t) => t.id)).size, TERMINY.length, 'powtórzone id');
});

/* ──────────────────────────────────────────────────────────── funkcje */

test('nieznane id nie wywala niczego — zwraca puste, nie wyjątek', () => {
  assert.equal(termin('nie-ma-takiego'), null);
  assert.equal(etykietaTerminu('nie-ma-takiego'), '');
  assert.equal(krotkiTermin('nie-ma-takiego'), '');
  assert.equal(pilny('nie-ma-takiego'), false);
  assert.equal(etykietaTerminu(undefined), '');
  assert.equal(pilny(null), false);
});

test('pilny() reaguje tylko na „do 2 tygodni"', () => {
  assert.equal(pilny('pilne'), true);
  for (const t of TERMINY.filter((x) => x.id !== 'pilne')) {
    assert.equal(pilny(t.id), false, `${t.id} nie powinien być pilny`);
  }
});

test('do bazy wpuszczamy tylko znane wartości (i pustą)', () => {
  assert.equal(znanyTermin(NIEZNANY), true, 'pusta wartość musi przechodzić — stare wyceny');
  for (const t of TERMINY) assert.equal(znanyTermin(t.id), true, t.id);
  assert.equal(znanyTermin('DROP TABLE klienci'), false);
  assert.equal(znanyTermin('pilne '), false, 'spacja na końcu to inna wartość');
});

/* ───────────────────────────────── wpięcie: formularz, worker, panel */

test('formularz wyceny ma pole terminu i wymaga go', () => {
  const bramka = zrodlo('src/app/bramka.js');
  assert.match(bramka, /wybor\('termin'/, 'brak pola w formularzu');
  assert.match(bramka, /termin: wartosc\(form, 'termin'\)/, 'termin nie trafia do zgłoszenia');
  assert.match(bramka, /pole: 'termin'/, 'brak walidacji — pole miało być wymagane');
});

test('lista w formularzu bierze się Z MODUŁU, nie jest przepisana', () => {
  // Gdyby formularz miał własną kopię listy, dołożenie terminu w termin.js
  // nie pokazałoby się klientowi i nikt by tego nie zauważył.
  const bramka = zrodlo('src/app/bramka.js');
  assert.match(bramka, /import \{ TERMINY \} from '\.\/termin\.js'/);
});

test('WORKER zapisuje termin i odrzuca wartości spoza listy', () => {
  const w = zrodlo('worker/worker.template.js');
  assert.match(w, /znanyTermin\(d\.termin\)/, 'worker nie waliduje terminu');
  assert.match(w, /termin: terminId/, 'termin nie idzie do bazy');

  const baza = zrodlo('worker/baza.js');
  assert.match(baza, /znanyTermin\(lead\.termin\)/, 'baza nie waliduje terminu');
  assert.match(baza, /termin = COALESCE\(NULLIF\(\?, ''\), termin\)/,
    'druga wycena bez terminu nie może kasować poprzedniej deklaracji');
  assert.match(baza, /termin: k\.termin \|\| ''/, 'termin nie wychodzi na kartę klienta');
});

test('MAIL LEADOWY niesie termin i wyróżnia klienta „na już"', () => {
  const w = zrodlo('worker/worker.template.js');
  // Temat — Dawid ma to zobaczyć na liście maili w telefonie.
  assert.match(w, /pilny\(klient\.terminId\) \? 'PILNE — ' : ''/, 'brak PILNE w temacie');
  // Treść HTML i tekstowa.
  assert.match(w, /PILNE — KLIENT CHCE BLAT DO 2 TYGODNI/, 'brak plakietki w mailu');
  assert.match(w, /etykietaTerminu\(klient\.terminId\)/, 'brak wiersza z terminem');
});

test('PANEL pokazuje plakietkę, termin w wierszu i ma filtr', () => {
  const panel = zrodlo('worker/panel.js');
  assert.match(panel, /id="f-termin"/, 'brak filtra terminu');
  assert.match(panel, /p\.get\('termin'\)/, 'filtr nie dojeżdża do zapytania');
  assert.match(panel, /znacznik pilne/, 'brak plakietki PILNE');
  assert.match(panel, /krotkiTermin\(k\.termin\)/, 'termin nie pokazuje się w wierszu');

  const baza = zrodlo('worker/baza.js');
  assert.match(baza, /filtry\.termin/, 'zapytanie do bazy nie filtruje po terminie');
});

test('SCHEMAT bazy ma kolumnę terminu', () => {
  assert.match(zrodlo('worker/schema.sql'), /termin\s+TEXT NOT NULL DEFAULT ''/);
});

test('panel i moduł mają IDENTYCZNE identyfikatory terminów', () => {
  /*
   * Panel to samodzielny skrypt w przeglądarce — nie może zaimportować
   * `src/app/termin.js`, więc ma własną kopię skróconych etykiet.
   * Ten test jest jedynym, co pilnuje, żeby obie listy nie rozjechały się
   * po cichu: po dołożeniu terminu w module trzeba dopisać go też tam.
   */
  const panel = zrodlo('worker/panel.js');
  const blok = panel.match(/var TERMINY_KROTKO = \{([^}]*)\}/);
  assert.ok(blok, 'brak słownika TERMINY_KROTKO w panelu');
  const wPanelu = [...blok[1].matchAll(/^\s*([a-z_]+):/gm)].map((m) => m[1]);
  assert.deepEqual(
    wPanelu.sort(),
    TERMINY.map((t) => t.id).sort(),
    'lista terminów w panelu rozjechała się z src/app/termin.js'
  );

  // Filtr w pasku też musi znać wszystkie terminy.
  for (const t of TERMINY) {
    assert.ok(
      panel.includes(`<option value="${t.id}">`),
      `filtr w panelu nie zna terminu „${t.id}"`
    );
  }
});

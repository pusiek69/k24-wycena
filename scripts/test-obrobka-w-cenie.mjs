/**
 * Docięcie, polerowanie i klejenie — w cenie, bez osobnego naliczenia.
 *
 *   node --test scripts/test-obrobka-w-cenie.mjs
 *
 * Do 17.08.2026 była to pozycja 350 zł za metr bieżący i największa
 * pojedyncza kwota w wielu wycenach. Dawid zdecydował, że nie doliczamy jej
 * osobno, ale świadczenie ZOSTAJE — klient ma widzieć na liście „w tej cenie",
 * że dostaje docięcie i polerowanie, tylko już za nie nie płaci.
 *
 * Dwie rzeczy muszą trzymać jednocześnie:
 *   • kwota nie może wracać do wyceny w żadnym wariancie,
 *   • pozycja nie może zniknąć z listy dla klienta.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { wycen } from '../src/engine/wycena.js';
import { ROBOCIZNA, OPCJE, VAT_MONTAZ } from '../src/firms/_domyslne.js';

const FIRMA = {
  slug: 'test',
  nazwa: 'Test',
  typ: 'konglomerat kwarcowy',
  aktywna: true,
  trybCeny: 'katalog',
  cenyUslug: 'brutto', // jak w produkcji: stawki brutto przy 23%
  plyta: { w: 320, h: 160, polowkaDozwolona: true },
  robocizna: ROBOCIZNA,
  opcje: OPCJE,
  dekory: { Testowy: { 20: 800 } },
};

const LAZIENKA = [{ gl: 60, dl: 120 }];
const KUCHNIA_U = [{ gl: 60, dl: 300 }, { gl: 60, dl: 240 }, { gl: 60, dl: 180 }];
const OPCJE_BAZOWE = { zlew: 'podblat', plyta: 'nakladana', otwory: 1 };

const licz = (odcinki, dostawa = 'montaz') =>
  wycen(FIRMA, { dekor: 'Testowy', grubosc: '20', odcinki, opcje: { ...OPCJE_BAZOWE, dostawa } });
const obrobka = (w) => w.pozycje.find((p) => /Docięcie|Obróbka/i.test(p.nazwa));

/* ─────────────────────────────────────────── nie kosztuje nic */

test('pozycja obróbki ma kwotę zero — w każdym wariancie i rozmiarze', () => {
  for (const odcinki of [LAZIENKA, KUCHNIA_U]) {
    for (const dostawa of ['montaz', 'odbior']) {
      const p = obrobka(licz(odcinki, dostawa));
      assert.ok(p, 'pozycja musi istnieć');
      assert.equal(p.brutto, 0, `wariant ${dostawa}`);
    }
  }
});

test('kwota wyceny nie zależy od długości cięcia', () => {
  // 7,2 m.b. kosztowałoby dawniej 2 520 zł. Jeśli cokolwiek zostało
  // naliczane od metra bieżącego, ten test to pokaże.
  const mala = licz(LAZIENKA);
  const duza = licz(KUCHNIA_U);
  const bezMaterialuIMontazu = (w) =>
    w.pozycje
      .filter((p) => p.grupa === 'usługi' && !/Transport i montaż/.test(p.nazwa))
      .reduce((a, p) => a + p.brutto, 0);
  assert.ok(Math.abs(bezMaterialuIMontazu(mala) - bezMaterialuIMontazu(duza)) < 0.01);
});

test('żadna pozycja nie jest liczona od metra bieżącego', () => {
  const w = licz(KUCHNIA_U);
  const odMetra = w.pozycje.filter((p) => p.brutto > 0 && /m\.b\./.test(p.detal || ''));
  assert.deepEqual(odMetra.map((p) => p.nazwa), []);
});

/* ────────────────────────────────── ale zostaje widoczna dla klienta */

test('świadczenie zostaje na liście dla klienta', () => {
  const w = licz(LAZIENKA);
  const p = obrobka(w);
  assert.equal(p.grupa, 'usługi', 'musi trafić do bloku „w tej cenie"');
  assert.match(p.nazwa, /docięcie/i);
  assert.match(p.nazwa, /polerowanie/i);
  assert.match(p.nazwa, /klejenie/i);
});

test('pozycja jest oznaczona jako świadczenie bez naliczenia', () => {
  const p = obrobka(licz(LAZIENKA));
  assert.equal(p.wCenie, true, 'po tym mail firmowy ją pomija');
  assert.match(p.detalFirmowy, /bez osobnego naliczenia/);
});

test('klient nie widzi przy niej żadnej kwoty', () => {
  const p = obrobka(licz(LAZIENKA));
  assert.doesNotMatch(String(p.detal || ''), /zł/);
});

test('suma usług zgadza się mimo pozycji zerowej', () => {
  const w = licz(LAZIENKA);
  const suma = w.pozycje.filter((p) => p.grupa === 'usługi').reduce((a, p) => a + p.brutto, 0);
  assert.ok(Math.abs(suma - w.uslugiBrutto) < 0.01);
  assert.ok(Math.abs(w.materialBrutto + w.uslugiBrutto - w.razem) < 0.01);
});

/* ───────────────────── stawki brutto 23% → netto → VAT wariantu */

test('stawka 650 zł brutto 23% daje 650 ÷ 1,23 netto i VAT wariantu', () => {
  const w = licz(LAZIENKA, 'montaz');
  const zlew = w.pozycje.find((p) => /zlewu podblatowego/.test(p.nazwa));
  const oczekiwane = (650 / 1.23) * (1 + VAT_MONTAZ);
  assert.ok(
    Math.abs(zlew.brutto - oczekiwane) < 0.01,
    `${zlew.brutto} ≠ ${oczekiwane}`
  );
});

test('rozbicie firmowe mówi, przy jakiej stawce zapisano stawki', () => {
  const w = licz(LAZIENKA, 'montaz');
  const montaz = w.pozycje.find((p) => /Transport i montaż/.test(p.nazwa));
  assert.match(montaz.detalFirmowy, /stawki brutto 23%, wycena po 8%/);
});

test('przy odbiorze własnym stawki i sprzedaż są w tej samej stawce — bez dopisku', () => {
  const w = licz(LAZIENKA, 'odbior');
  const zlew = w.pozycje.find((p) => /zlewu podblatowego/.test(p.nazwa));
  assert.ok(Math.abs(zlew.brutto - 650) < 0.01, 'przy 23% kwota wraca do stawki z konfiguracji');
});

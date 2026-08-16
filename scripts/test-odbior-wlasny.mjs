/**
 * Odbiór własny z zakładu — zamówienie bez montażu.
 *
 *   node --test scripts/test-odbior-wlasny.mjs
 *
 * Odpada baza montażu i stawka od metra; cała reszta produkcji zostaje.
 * Klient bierze na siebie transport i — co ważniejsze — odpowiedzialność
 * za wymiary, bo nie robimy pomiaru. Dlatego zastrzeżenie musi być widoczne
 * dokładnie wtedy, gdy ta opcja jest wybrana, i nigdy wcześniej.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { wycen } from '../src/engine/wycena.js';
import { ROBOCIZNA, OPCJE, VAT, NOTA_ODBIOR } from '../src/firms/_domyslne.js';

const BAZA = 1500;
const ZA_M2 = 200;

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
const OPCJE_BAZOWE = { zlew: 'podblat', plyta: 'nakladana', otwory: 1 };

const licz = (odcinki, dostawa) =>
  wycen(FIRMA, { dekor: 'Testowy', grubosc: '20', odcinki, opcje: { ...OPCJE_BAZOWE, dostawa } });
const montaz = (w) => w.pozycje.find((p) => p.nazwa.startsWith('Transport i montaż'));

/* ─────────────────────────────────────────────────────── różnica dokładna */

test('różnica między wariantami to dokładnie baza + stawka × m²', () => {
  const zMontazem = licz(LAZIENKA, 'montaz');
  const odbior = licz(LAZIENKA, 'odbior');
  const oczekiwana = BAZA + ZA_M2 * zMontazem.pak.m2Blatu;
  assert.ok(
    Math.abs(zMontazem.razem - odbior.razem - oczekiwana) < 0.01,
    `różnica ${zMontazem.razem - odbior.razem} ≠ ${oczekiwana}`
  );
});

test('przy odbiorze nie ma pozycji transportu ani montażu', () => {
  const w = licz(LAZIENKA, 'odbior');
  assert.equal(montaz(w), undefined);
  // Uwaga: „Wycięcie + montaż zlewu podblatowego" ZOSTAJE — to montaż zlewu
  // w blacie, robiony w zakładzie, a nie wyjazd do klienta.
  assert.equal(
    w.pozycje.filter((p) => /transport|montaż u klienta/i.test(p.nazwa)).length,
    0,
    'nie może zostać nic o dojeździe do klienta'
  );
});

test('montaż jest domyślny — brak wyboru działa jak dawniej', () => {
  const bezWyboru = licz(LAZIENKA, undefined);
  const jawnie = licz(LAZIENKA, 'montaz');
  assert.ok(montaz(bezWyboru), 'domyślnie montujemy');
  assert.ok(Math.abs(bezWyboru.razem - jawnie.razem) < 0.01);
});

/* ────────────────────────────────────────── reszta produkcji bez zmian */

test('cięcie, otwory i zlew zostają identyczne', () => {
  const zMontazem = licz(LAZIENKA, 'montaz');
  const odbior = licz(LAZIENKA, 'odbior');
  const bezMontazu = (w) =>
    w.pozycje
      .filter((p) => !p.nazwa.startsWith('Transport i montaż'))
      .map((p) => `${p.nazwa}=${Math.round(p.brutto)}`)
      .sort();
  assert.deepEqual(bezMontazu(odbior), bezMontazu(zMontazem));
});

test('materiał bez zmian — odbiór dotyczy tylko usług', () => {
  const a = licz(LAZIENKA, 'montaz');
  const b = licz(LAZIENKA, 'odbior');
  assert.ok(Math.abs(a.materialBrutto - b.materialBrutto) < 0.01);
});

test('dodatek za obróbkę kamienia naturalnego zostaje przy odbiorze', () => {
  const naturalny = {
    ...FIRMA,
    typ: 'granit · marmur · kwarcyt',
    trybCeny: 'reczna',
    cenaRecznaJest: 'brutto',
    rozliczenieMaterialu: 'plyty',
    dodatekObrobkiNaturalnej: 0.1,
  };
  const w = wycen(naturalny, {
    odcinki: LAZIENKA,
    opcje: { ...OPCJE_BAZOWE, dostawa: 'odbior' },
    cenaRecznaM2: 1200,
  });
  assert.ok(w.pozycje.find((p) => p.nazwa === 'Obróbka kamienia naturalnego'));
});

/* ─────────────────────────────────────────────── karta i zastrzeżenie */

test('karta ma dwie kwoty w OBU wariantach', () => {
  for (const dostawa of ['montaz', 'odbior']) {
    const w = licz(LAZIENKA, dostawa);
    assert.deepEqual(
      [...new Set(w.pozycje.map((p) => p.grupa))].sort(),
      ['materiał', 'usługi'],
      `wariant ${dostawa}`
    );
    const suma = w.pozycje.reduce((a, p) => a + p.brutto, 0);
    assert.ok(Math.abs(suma - (w.materialBrutto + w.uslugiBrutto)) < 0.01);
  }
});

test('flaga odbioru jest w wyniku tylko przy tym wariancie', () => {
  assert.equal(licz(LAZIENKA, 'odbior').odbiorWlasny, true);
  assert.equal(licz(LAZIENKA, 'montaz').odbiorWlasny, false);
});

test('zastrzeżenie mówi o odpowiedzialności za wymiary i podaje właściwy adres', () => {
  assert.match(NOTA_ODBIOR, /wymiar/i);
  assert.match(NOTA_ODBIOR, /odpowiedzialność/i);
  assert.match(NOTA_ODBIOR, /Szpitalna 8/);
  // Adres warsztatu przy Bema 227 nie jest adresem publicznym firmy.
  assert.doesNotMatch(NOTA_ODBIOR, /Bema/i);
});

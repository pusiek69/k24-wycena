/**
 * VAT: 8% przy blacie z montażem, 23% przy odbiorze własnym.
 *
 *   node --test scripts/test-vat.mjs
 *
 * Stawka zależy od PRZEDMIOTU SPRZEDAŻY, nie od materiału. Blat z montażem
 * to usługa budowlana w lokalu mieszkalnym objętym społecznym programem
 * mieszkaniowym — 8%. Blat wydany z zakładu bez montażu to dostawa towaru — 23%.
 *
 * Wszystkie stawki w konfiguracji firm są NETTO; VAT dolicza silnik na końcu.
 * Wyjątek to ceny publiczne dostawców (magazyn Interstone), które są brutto
 * przy 23% i muszą być rozliczane tą stawką niezależnie od naszej sprzedaży —
 * inaczej cena płyty zmieniałaby się przy zmianie wariantu.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { wycen } from '../src/engine/wycena.js';
import { ROBOCIZNA, OPCJE, VAT_MONTAZ, VAT_TOWAR } from '../src/firms/_domyslne.js';

const FIRMA = {
  slug: 'test',
  nazwa: 'Test',
  typ: 'konglomerat kwarcowy',
  aktywna: true,
  trybCeny: 'katalog',
  cenyUslug: 'netto',
  plyta: { w: 320, h: 160, polowkaDozwolona: true },
  robocizna: ROBOCIZNA,
  opcje: OPCJE,
  dekory: { Testowy: { 20: 800 } },
};

const LAZIENKA = [{ gl: 60, dl: 120 }];
const OPCJE_BAZOWE = { zlew: 'podblat', plyta: 'nakladana', otwory: 1 };

const licz = (dostawa, dodatkowe = {}) =>
  wycen(FIRMA, {
    dekor: 'Testowy',
    grubosc: '20',
    odcinki: LAZIENKA,
    opcje: { ...OPCJE_BAZOWE, dostawa },
    ...dodatkowe,
  });

/* ──────────────────────────────────────────────── właściwa stawka */

test('z montażem obowiązuje 8%', () => {
  assert.equal(licz('montaz').stawkaVat, VAT_MONTAZ);
});

test('odbiór własny to dostawa towaru — 23%', () => {
  assert.equal(licz('odbior').stawkaVat, VAT_TOWAR);
});

test('brak wyboru znaczy montaż, czyli 8%', () => {
  assert.equal(licz(undefined).stawkaVat, VAT_MONTAZ);
});

/* ──────────────────────────────────────── rozbicie netto / VAT / brutto */

test('netto plus VAT daje dokładnie brutto', () => {
  for (const dostawa of ['montaz', 'odbior']) {
    const w = licz(dostawa);
    assert.ok(Math.abs(w.razemNetto + w.kwotaVat - w.razem) < 0.01, `wariant ${dostawa}`);
    assert.ok(Math.abs(w.kwotaVat - w.razemNetto * w.stawkaVat) < 0.01, `VAT wariantu ${dostawa}`);
  }
});

test('każda pozycja jest brutto przy tej samej stawce co całość', () => {
  for (const dostawa of ['montaz', 'odbior']) {
    const w = licz(dostawa);
    const suma = w.pozycje.reduce((a, p) => a + p.brutto, 0);
    assert.ok(Math.abs(suma / (1 + w.stawkaVat) - w.razemNetto) < 0.01, `wariant ${dostawa}`);
  }
});

/* ───────────────────────────────────── ta sama robota, dwie stawki */

test('ta sama pozycja kosztuje brutto mniej przy 8% niż przy 23%', () => {
  const zMontazem = licz('montaz');
  const odbior = licz('odbior');
  const zlew = (w) => w.pozycje.find((p) => /zlewu podblatowego/.test(p.nazwa)).brutto;
  assert.ok(zlew(zMontazem) < zlew(odbior));
  // 650 zł netto → 702 zł przy 8%, 799,50 zł przy 23%.
  assert.ok(Math.abs(zlew(zMontazem) - 650 * (1 + VAT_MONTAZ)) < 0.01);
  assert.ok(Math.abs(zlew(odbior) - 650 * (1 + VAT_TOWAR)) < 0.01);
});

test('materiał netto jest ten sam, brutto zależy od stawki', () => {
  const a = licz('montaz');
  const b = licz('odbior');
  const netto = (w) => w.materialBrutto / (1 + w.stawkaVat);
  assert.ok(Math.abs(netto(a) - netto(b)) < 0.01);
  assert.ok(Math.abs(a.materialBrutto / b.materialBrutto - 1.08 / 1.23) < 0.001);
});

/* ─────────────────── ceny publiczne dostawcy rozliczamy zawsze po 23% */

test('cena płyty ze stanu magazynowego nie zmienia się z wariantem', () => {
  const naturalny = {
    ...FIRMA,
    typ: 'granit · marmur · kwarcyt',
    trybCeny: 'reczna',
    cenaRecznaJest: 'brutto',
    vatCenZrodlowych: VAT_TOWAR,
    rozliczenieMaterialu: 'metraz',
  };
  const liczNat = (dostawa) =>
    wycen(naturalny, {
      odcinki: LAZIENKA,
      opcje: { ...OPCJE_BAZOWE, dostawa },
      cenaRecznaM2: 1230, // brutto ze strony dostawcy → 1000 zł netto
    });
  const netto = (w) => w.materialBrutto / (1 + w.stawkaVat);
  assert.ok(
    Math.abs(netto(liczNat('montaz')) - netto(liczNat('odbior'))) < 0.01,
    'ta sama płyta musi mieć to samo netto w obu wariantach'
  );
});

test('bez pola vatCenZrodlowych domyślnie i tak rozliczamy po 23%', () => {
  const bezPola = {
    ...FIRMA,
    trybCeny: 'reczna',
    cenaRecznaJest: 'brutto',
    rozliczenieMaterialu: 'metraz',
  };
  const w = wycen(bezPola, {
    odcinki: LAZIENKA,
    opcje: { ...OPCJE_BAZOWE, dostawa: 'montaz' },
    cenaRecznaM2: 1230,
  });
  // 1000 zł netto × metraż z narzutem, ogrossowane po 8%.
  const netto = w.materialBrutto / (1 + w.stawkaVat);
  assert.ok(Math.abs(netto / w.m2Platne - 1000) < 0.01, `netto/m² = ${netto / w.m2Platne}`);
});

/* ──────────────────────────────────────── skala zmiany dla klienta */

test('blat z montażem jest brutto o ~12,2% tańszy niż przy 23%', () => {
  const w = licz('montaz');
  const jakGdyby23 = w.razemNetto * (1 + VAT_TOWAR);
  const zmiana = w.razem / jakGdyby23 - 1;
  assert.ok(Math.abs(zmiana + 0.12195) < 0.001, `zmiana ${(zmiana * 100).toFixed(2)}%`);
});

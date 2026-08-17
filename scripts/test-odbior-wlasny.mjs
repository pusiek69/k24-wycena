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
  cenyUslug: 'brutto', // stawki zapisane jak w produkcji: brutto przy 23%
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

/*
 * Warianty różnią się nie tylko zakresem, ale i stawką VAT (8% z montażem,
 * 23% przy odbiorze), więc kwot brutto nie da się odejmować wprost.
 * Wszystkie porównania zakresu robimy na NETTO.
 */
const netto = (w) => w.razemNetto;
// Stawki w konfiguracji są brutto przy 23% — patrz test-montaz.mjs.
const nettoStawki = (bruttoDwadziesciaTrzy) => bruttoDwadziesciaTrzy / 1.23;
const nettoPozycji = (w, p) => p.brutto / (1 + w.stawkaVat);

/* ─────────────────────────────────────────────────────── różnica dokładna */

test('różnica netto między wariantami to dokładnie baza + stawka × m²', () => {
  const zMontazem = licz(LAZIENKA, 'montaz');
  const odbior = licz(LAZIENKA, 'odbior');
  const oczekiwana = nettoStawki(BAZA) + nettoStawki(ZA_M2) * zMontazem.pak.m2Blatu;
  assert.ok(
    Math.abs(netto(zMontazem) - netto(odbior) - oczekiwana) < 0.01,
    `różnica netto ${netto(zMontazem) - netto(odbior)} ≠ ${oczekiwana}`
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

test('cięcie, otwory i zlew zostają identyczne (netto)', () => {
  const zMontazem = licz(LAZIENKA, 'montaz');
  const odbior = licz(LAZIENKA, 'odbior');
  const bezMontazu = (w) =>
    w.pozycje
      .filter((p) => !p.nazwa.startsWith('Transport i montaż'))
      .map((p) => `${p.nazwa}=${Math.round(nettoPozycji(w, p))}`)
      .sort();
  assert.deepEqual(bezMontazu(odbior), bezMontazu(zMontazem));
});

test('materiał netto bez zmian — odbiór dotyczy tylko zakresu usług', () => {
  const a = licz(LAZIENKA, 'montaz');
  const b = licz(LAZIENKA, 'odbior');
  const materialNetto = (w) => w.materialBrutto / (1 + w.stawkaVat);
  assert.ok(Math.abs(materialNetto(a) - materialNetto(b)) < 0.01);
  // Brutto RÓŻNI SIĘ, bo różni się stawka — to nie błąd, tylko sedno zmiany.
  assert.ok(a.materialBrutto < b.materialBrutto, 'przy 8% ta sama płyta jest tańsza brutto');
});

test('kamień naturalny przy odbiorze też traci tylko montaż', () => {
  const naturalny = {
    ...FIRMA,
    typ: 'granit · marmur · kwarcyt',
    trybCeny: 'reczna',
    cenaRecznaJest: 'brutto',
    rozliczenieMaterialu: 'plyty',
  };
  const dane = (dostawa) => ({
    odcinki: LAZIENKA,
    opcje: { ...OPCJE_BAZOWE, dostawa },
    cenaRecznaM2: 1200,
  });
  const zMontazem = wycen(naturalny, dane('montaz'));
  const odbior = wycen(naturalny, dane('odbior'));
  const oczekiwana = nettoStawki(BAZA) + nettoStawki(ZA_M2) * zMontazem.pak.m2Blatu;
  assert.ok(Math.abs(netto(zMontazem) - netto(odbior) - oczekiwana) < 0.01);
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

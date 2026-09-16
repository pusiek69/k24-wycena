/**
 * DOCIĘCIE, POLEROWANIE I KLEJENIE — podstawa + stawka od m² blatu.
 *
 *   node --test scripts/test-obrobka-w-cenie.mjs
 *
 * Nazwa pliku jest historyczna: od 17.08.2026 pozycja szła „w cenie", z kwotą
 * zero. Polecenie Dawida z 16.09.2026 przywraca naliczanie w formule
 * **1 500 zł podstawy + 150 zł za m² blatu kuchennego** (kwoty NETTO).
 *
 * ⚠ CO TEN PLIK PILNOWAŁ ŹLE, A CO TERAZ PILNUJE DOBRZE.
 * Poprzednia wersja brała `ROBOCIZNA` wprost z `_domyslne.js` i sprawdzała,
 * że obróbka kosztuje zero. Była zielona przez miesiąc — a produkcja przez
 * ten czas liczyła 200 zł/m², bo stawkę nadpisywał panel
 * (`ustawienia.js#zastosujUstawienia`, domyślnie 200). Test pilnował wersji,
 * której nikt nie używał. Dlatego teraz sprawdzamy OBIE ścieżki: gołą
 * konfigurację i tę po nałożeniu ustawień panelu — i to, że mówią to samo.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { wycen } from '../src/engine/wycena.js';
import { ROBOCIZNA, OPCJE, VAT_MONTAZ, zCennika } from '../src/firms/_domyslne.js';
import { DOMYSLNE, PARAMETRY, zastosujUstawienia } from '../src/app/ustawienia.js';

// Cena z KONFIGURACJI, nie z literału — cennik Dawida bywa aktualizowany,
// a te testy pilnują przeliczenia VAT, nie konkretnej kwoty.
const CENA_ZLEWU = OPCJE.find((o) => o.id === 'zlew').warianty.find((w) => w.id === 'podblat').cena;

const firmaTestowa = () => ({
  slug: 'test',
  nazwa: 'Test',
  typ: 'konglomerat kwarcowy',
  aktywna: true,
  trybCeny: 'katalog',
  cenyUslug: 'brutto', // jak w produkcji: stawki brutto przy 23%
  vatMontaz: VAT_MONTAZ,
  plyta: { w: 320, h: 160, polowkaDozwolona: true },
  robocizna: ROBOCIZNA.map((r) => ({ ...r })),
  opcje: OPCJE.map((o) => ({ ...o })),
  dekory: { Testowy: { 20: 800 } },
});

const LAZIENKA = [{ gl: 60, dl: 120 }]; // 0,72 m²
const TRZY_M2 = [{ gl: 60, dl: 500 }]; // dokładnie 3 m² — przykład Dawida
const KUCHNIA_U = [{ gl: 60, dl: 300 }, { gl: 60, dl: 240 }, { gl: 60, dl: 180 }];
const OPCJE_BAZOWE = { zlew: 'podblat', plyta: 'nakladana', otwory: 1 };

const licz = (odcinki, dostawa = 'montaz', pomieszczenie = 'kuchnia', firma = firmaTestowa()) =>
  wycen(firma, {
    dekor: 'Testowy',
    grubosc: '20',
    odcinki,
    opcje: { ...OPCJE_BAZOWE, dostawa, pomieszczenie },
  });

const obrobka = (w) => w.pozycje.find((p) => /Docięcie|Obróbka/i.test(p.nazwa));
/** Kwota brutto → netto, przy stawce użytej w wycenie. */
const netto = (brutto, vat = VAT_MONTAZ) => brutto / (1 + vat);

/* ══════════════════ formuła: podstawa + stawka od metra ══════════════════ */

test('PRZYKŁAD DAWIDA: 3 m² blatu kuchennego to 1 500 + 450 = 1 950 zł netto', () => {
  const p = obrobka(licz(TRZY_M2));
  assert.ok(p, 'pozycja zniknęła z wyceny');
  assert.equal(Math.round(netto(p.brutto)), 1950);
  // Przy kuchni z montażem klient widzi 8% od tej kwoty.
  assert.equal(Math.round(p.brutto), 2106);
});

test('podstawa wchodzi RAZ, niezależnie od liczby odcinków', () => {
  /*
   * Kuchnia w U to trzy elementy, ale jedno przygotowanie i jedno sklejenie.
   * Gdyby podstawa liczyła się per element, wycena urosłaby o 3 000 zł
   * i nikt by tego nie zauważył poza klientem.
   */
  const m2 = KUCHNIA_U.reduce((a, o) => a + (o.gl * o.dl) / 10000, 0);
  const p = obrobka(licz(KUCHNIA_U));
  assert.equal(Math.round(netto(p.brutto)), Math.round(1500 + 150 * m2));
  assert.match(p.detalFirmowy, /^baza /, 'rozbicie firmowe nie pokazuje podstawy');
});

test('BLAT ŁAZIENKOWY: sama stawka od metra, bez podstawy', () => {
  /*
   * Polecenie mówiło o metrze blatu KUCHENNEGO. Podstawa 1 500 zł przy
   * blacie 0,72 m² byłaby większa niż cała reszta wyceny — a docięcie
   * i polerowanie robi się tak samo, więc stawka od metra zostaje.
   */
  const p = obrobka(licz(LAZIENKA, 'montaz', 'lazienka'));
  assert.ok(p, 'łazienka straciła obróbkę w całości');
  assert.equal(Math.round(netto(p.brutto)), Math.round(150 * 0.72));
  assert.doesNotMatch(p.detalFirmowy, /baza/, 'podstawa weszła do łazienki');
});

test('nic nie jest liczone od metra BIEŻĄCEGO', () => {
  // Do 17.08.2026 obróbka szła po 350 zł/m.b. i przy kuchni w U dawała
  // 2 520 zł. Gdyby cokolwiek wróciło do metra bieżącego, ten test to pokaże.
  const w = licz(KUCHNIA_U);
  const odMetra = w.pozycje.filter((p) => p.brutto > 0 && /m\.b\./.test(p.detal || ''));
  assert.deepEqual(odMetra.map((p) => p.nazwa), []);
});

/* ══════════════════════ pozycja na oczach klienta ═══════════════════════ */

test('świadczenie zostaje opisane pełną nazwą', () => {
  const p = obrobka(licz(TRZY_M2));
  assert.equal(p.grupa, 'usługi');
  assert.match(p.nazwa, /docięcie/i);
  assert.match(p.nazwa, /polerowanie/i);
  assert.match(p.nazwa, /klejenie/i);
});

test('klient widzi metraż, a nie stawkę', () => {
  // Stawki są tajemnicą handlową — w karcie klienta pokazujemy ilość.
  const p = obrobka(licz(TRZY_M2));
  assert.doesNotMatch(String(p.detal || ''), /zł/);
  assert.match(String(p.detal || ''), /m²/);
});

test('suma usług zgadza się z pozycjami', () => {
  const w = licz(TRZY_M2);
  const suma = w.pozycje.filter((p) => p.grupa === 'usługi').reduce((a, p) => a + p.brutto, 0);
  assert.ok(Math.abs(suma - w.uslugiBrutto) < 0.01);
  assert.ok(Math.abs(w.materialBrutto + w.uslugiBrutto - w.razem) < 0.01);
});

/* ═══════════ panel i konfiguracja muszą mówić to samo ═══════════════════ */

test('KONFIGURACJA I PANEL: te same kwoty domyślne', () => {
  /*
   * To jest test, którego brakowało. Przez miesiąc `_domyslne.js` mówiło
   * „zero, w cenie", a panel „200 zł/m²" — i wygrywał panel, więc wycena
   * u klienta różniła się od tej, którą liczyły testy.
   */
  const poz = ROBOCIZNA.find((r) => r.id === 'obrobka');
  const par = (klucz) => PARAMETRY.find((p) => p.klucz === klucz);
  assert.equal(par('obrobkaBaza').domyslnie, poz.baza, 'panel ma inną podstawę niż cennik');
  assert.equal(par('obrobkaZaM2').domyslnie, poz.cena, 'panel ma inną stawkę niż cennik');
  assert.equal(DOMYSLNE.obrobkaBaza, zCennika(1500), 'podstawa to nie 1 500 zł netto');
  assert.equal(DOMYSLNE.obrobkaZaM2, zCennika(150), 'stawka to nie 150 zł netto za m²');
});

test('USTAWIENIA Z PANELU: wycena po nałożeniu stawek daje to samo', () => {
  const firma = firmaTestowa();
  zastosujUstawienia([firma], {}); // brak zapisanych stawek = wartości domyślne
  const p = obrobka(licz(TRZY_M2, 'montaz', 'kuchnia', firma));
  assert.equal(Math.round(netto(p.brutto)), 1950, 'ścieżka przez panel liczy inaczej niż cennik');
});

test('USTAWIENIA Z PANELU: zmiana stawki w panelu przechodzi do wyceny', () => {
  const firma = firmaTestowa();
  zastosujUstawienia([firma], { obrobkaBaza: zCennika(1000), obrobkaZaM2: zCennika(100) });
  const p = obrobka(licz(TRZY_M2, 'montaz', 'kuchnia', firma));
  assert.equal(Math.round(netto(p.brutto)), 1300, '1 000 + 3 × 100');
});

test('USTAWIENIA Z PANELU: dopiero OBIE kwoty na zero wracają do „w cenie"', () => {
  /*
   * Sama zerowa stawka od metra nie wystarczy — podstawa nadal by wchodziła,
   * a pozycja pokazywałaby klientowi „w cenie" obok kwoty 1 500 zł.
   */
  const samaStawka = firmaTestowa();
  zastosujUstawienia([samaStawka], { obrobkaZaM2: 0 });
  const p1 = obrobka(licz(TRZY_M2, 'montaz', 'kuchnia', samaStawka));
  assert.equal(p1.wCenie, false);
  assert.ok(p1.brutto > 0, 'podstawa przepadła mimo zerowej stawki');

  const oba = firmaTestowa();
  zastosujUstawienia([oba], { obrobkaZaM2: 0, obrobkaBaza: 0 });
  const p2 = obrobka(licz(TRZY_M2, 'montaz', 'kuchnia', oba));
  assert.equal(p2.wCenie, true);
  assert.equal(p2.brutto, 0);
  assert.match(p2.detalFirmowy, /bez osobnego naliczenia/);
});

/* ═══════════ stawki brutto 23% → netto → VAT wariantu ═══════════════════ */

test('stawka zapisana brutto 23% schodzi na netto i VAT wariantu', () => {
  const w = licz(LAZIENKA, 'montaz', 'lazienka');
  const zlew = w.pozycje.find((p) => /zlewu podblatowego/.test(p.nazwa));
  const oczekiwane = (CENA_ZLEWU / 1.23) * (1 + VAT_MONTAZ);
  assert.ok(Math.abs(zlew.brutto - oczekiwane) < 0.01, `${zlew.brutto} ≠ ${oczekiwane}`);
});

test('rozbicie firmowe mówi, przy jakiej stawce zapisano stawki', () => {
  const w = licz(LAZIENKA, 'montaz', 'lazienka');
  const montaz = w.pozycje.find((p) => /Transport i montaż/.test(p.nazwa));
  assert.match(montaz.detalFirmowy, /stawki brutto 23%, wycena po 8%/);
});

test('przy odbiorze własnym stawki i sprzedaż są w tej samej stawce — bez dopisku', () => {
  const w = licz(LAZIENKA, 'odbior', 'lazienka');
  const zlew = w.pozycje.find((p) => /zlewu podblatowego/.test(p.nazwa));
  assert.ok(Math.abs(zlew.brutto - CENA_ZLEWU) < 0.01, 'przy 23% kwota wraca do stawki z konfiguracji');
});

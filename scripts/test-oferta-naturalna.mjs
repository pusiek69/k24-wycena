/**
 * KAMIEŃ NATURALNY W TRYBIE WŁAŚCICIELA („Powtórz wycenę")
 *
 *   node --test scripts/test-oferta-naturalna.mjs
 *
 * Dawid może w edytorze ofert policzyć kamień naturalny na dwa sposoby:
 *   • z magazynu Interstone (kod płyty → realna cena i wymiar — ta sama
 *     droga co w wycenie klienta),
 *   • z ceną wpisaną RĘCZNIE — dla płyt spoza magazynu. To zdejmuje wymóg
 *     kodu płyty, ale wyłącznie w trybie właściciela; ścieżka klienta
 *     dalej odmawia wyceny bez wskazanej sztuki.
 * Reszta zasad naturalnego zostaje: całe płyty, obrzeże, odpad 15%,
 * dodatek za obróbkę 300 zł/m².
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { wczytajSilnik } from './lib/silnik.mjs';

const { wycenZMagazynu, wycenWlasciciela, wariantReczny } = await wczytajSilnik();

const KUCHNIA = { odcinki: [{ gl: 60, dl: 300 }], opcje: { zlew: 'podblat', plyta: 'nakladana', otwory: 2, pomieszczenie: 'kuchnia' } };

const RECZNY = wariantReczny({
  nazwa: 'Kwarcyt Bella Vista',
  cenaBruttoM2: 1500, // brutto, jak ceny na interstone.pl
  plytaCm: { dl: 310, gl: 190 },
  gruboscMm: 20,
});

/* ─────────────────────────────── tryb właściciela: cena ręczna */

test('ręczna cena bez kodu płyty daje pełną wycenę', () => {
  const w = wycenWlasciciela(RECZNY, KUCHNIA);
  assert.equal(w.ok, true, w.blad);
  assert.equal(w.brakKoduPlyty, undefined);
  assert.equal(w.dekor, 'Kwarcyt Bella Vista');
});

test('liczy się jak naturalny: całe płyty, obróbka 300 zł/m²', () => {
  const w = wycenWlasciciela(RECZNY, KUCHNIA);
  // Całe płyty z obrzeżem — bez połówek.
  assert.ok(!w.pak.polowka, 'kamień naturalny bez połówek');
  const obrobka = w.pozycje.find((p) => p.nazwa.includes('Obróbka kamienia naturalnego'));
  assert.ok(obrobka, 'dodatek za obróbkę naturalnego musi być');
  assert.match(obrobka.detalFirmowy || '', /300 zł/);
});

test('cena ręczna jest brutto — jak ceny magazynowe Interstone', () => {
  // 1500 zł/m² brutto przy 23% → netto 1219,51 → z montażem brutto 8%.
  const w = wycenWlasciciela(RECZNY, KUCHNIA);
  const m = w.pozycje.find((p) => p.grupa === 'materiał');
  const nettoM2 = m.brutto / (1 + w.stawkaVat) / w.m2Platne;
  assert.ok(Math.abs(nettoM2 - 1500 / 1.23) < 0.5, `netto/m2 = ${nettoM2}`);
});

test('bez ceny albo bez wymiaru płyty wycena odmawia po ludzku', () => {
  assert.equal(wycenWlasciciela(wariantReczny({ nazwa: 'X', plytaCm: { dl: 300, gl: 180 } }), KUCHNIA).ok, false);
  assert.equal(
    wycenWlasciciela(wariantReczny({ nazwa: 'X', cenaBruttoM2: 1000, plytaCm: { dl: 0, gl: 0 } }), KUCHNIA).ok,
    false
  );
});

test('kod podany przy cenie ręcznej trafia do wyniku (na kartę i do maila)', () => {
  const w = wycenWlasciciela(
    wariantReczny({ nazwa: 'Taj Mahal', kod: 'STON000334 - 84224', cenaBruttoM2: 1600, plytaCm: { dl: 320, gl: 190 }, gruboscMm: 30 }),
    KUCHNIA
  );
  assert.equal(w.ok, true, w.blad);
  assert.equal(w.kodPlyty, 'STON000334-84224', 'kod znormalizowany');
  assert.equal(w.grubosc, '30');
});

/* ────────────────── ścieżka klienta bez zmian: kod obowiązkowy */

test('wycena KLIENTA z magazynu dalej wymaga kodu płyty', () => {
  const bezKodu = {
    nazwa: 'Taj Mahal',
    rodzaj: 'Kamień Naturalny',
    kod: '',
    cenaBruttoM2: 1400,
    plytaCm: { dl: 320, gl: 190 },
    gruboscMm: 20,
    dostepneM2: 10,
  };
  const w = wycenZMagazynu(bezKodu, KUCHNIA);
  assert.equal(w.ok, false);
  assert.equal(w.brakKoduPlyty, true, 'ochrona ścieżki klienta zostaje');
});

test('wycena z magazynu z kodem działa jak dotąd', () => {
  const w = wycenZMagazynu(
    {
      nazwa: 'Taj Mahal',
      rodzaj: 'Kamień Naturalny',
      kod: 'STON000623-86421',
      cenaBruttoM2: 1400,
      plytaCm: { dl: 320, gl: 190 },
      gruboscMm: 20,
      dostepneM2: 12,
    },
    KUCHNIA
  );
  assert.equal(w.ok, true, w.blad);
  assert.equal(w.kodPlyty, 'STON000623-86421');
  assert.ok(w.pozycje.some((p) => p.nazwa.includes('Obróbka kamienia naturalnego')));
});

test('nadpisanie ceny magazynowej ręczną zmienia tylko materiał', () => {
  const plyta = {
    nazwa: 'Taj Mahal', rodzaj: 'Kamień Naturalny', kod: 'STON000623-86421',
    cenaBruttoM2: 1400, plytaCm: { dl: 320, gl: 190 }, gruboscMm: 20, dostepneM2: 12,
  };
  const a = wycenZMagazynu(plyta, KUCHNIA);
  const b = wycenZMagazynu({ ...plyta, cenaBruttoM2: 1100 }, KUCHNIA);
  const material = (w) => w.pozycje.find((p) => p.grupa === 'materiał').brutto;
  const uslugi = (w) => w.uslugiBrutto - (w.pozycje.find((p) => p.nazwa.includes('Obróbka')) ? 0 : 0);
  assert.ok(material(b) < material(a));
  assert.ok(Math.abs(b.uslugiBrutto - a.uslugiBrutto) < 0.01, 'usługi bez zmian');
});

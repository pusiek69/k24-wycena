/**
 * ROZRYS W OFERCIE KLIENTA.
 *
 *   node --test scripts/test-rozrys-oferta.mjs
 *
 * Decyzja Dawida (21.08.2026): rozrys ma trafiać do klienta, bo najlepiej
 * tłumaczy, czemu płaci za całe płyty. Pilnujemy trzech rzeczy:
 *   • rysunek jest ZAMROŻONY w chwili wysyłki (żadnego przeliczania przy
 *     otwarciu strony przez klienta — także po ręcznych zmianach Dawida),
 *   • do klienta nie idzie nic warsztatowego,
 *   • oferta z rozrysem przechodzi przez zapis do bazy w całości.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { rozrysuj } from '../src/engine/nesting.js';
import { mailOferty } from '../worker/mail-oferty.js';

const PLYTA = { szer: 3200, wys: 1600 };

/** Zdjęcie rozrysu takie, jakie edytor wkłada do oferty. */
const zdjecieRozrysu = (elementy, opcje = {}) => {
  const w = rozrysuj(elementy, PLYTA, { rzaz: 3, margines: 10, ...opcje });
  return {
    plyty: w.plyty,
    statystyki: w.statystyki,
    opisMaterialu: 'Technistone · Altamonte',
  };
};

const OFERTA = (rozrys) => ({
  opis: 'Technistone · Altamonte · 20 mm',
  pozycje: [
    { nazwa: 'Materiał', detal: '1 płyta · 5,2 m²', brutto: 4000 },
    { nazwa: 'Prace', detal: '', brutto: 2000 },
  ],
  razem: 6000,
  razemPrzed: 6000,
  stawkaVat: 0.08,
  rozrys,
});

/* ────────────────────────────── zamrożony rysunek, nie przeliczany */

test('oferta niesie gotowe płyty z pozycjami elementów', () => {
  const r = zdjecieRozrysu([
    { nazwa: 'Blat 1', szer: 1900, gl: 800 },
    { nazwa: 'Fartuch', szer: 2300, gl: 550 },
  ]);
  assert.equal(r.plyty.length, 1);
  const el = r.plyty[0].elementy[0];
  // Współrzędne i wymiary muszą być w danych — strona klienta tylko rysuje.
  for (const pole of ['x', 'y', 'szer', 'gl', 'nazwa']) {
    assert.ok(pole in el, `brakuje pola ${pole}`);
  }
  assert.equal(typeof r.statystyki.wykorzystanieProc, 'number');
});

test('ręczne zmiany Dawida jadą do klienta bez przeliczania', () => {
  // Dawid dorzucił wyspę i nogę — zdjęcie ma je zawierać.
  const r = zdjecieRozrysu([
    { nazwa: 'Blat 1', szer: 1900, gl: 800 },
    { nazwa: 'Wyspa', szer: 1400, gl: 900 },
    { nazwa: 'Noga wyspy', szer: 900, gl: 850 },
  ]);
  const nazwy = r.plyty.flatMap((p) => p.elementy.map((e) => e.nazwa));
  assert.deepEqual(nazwy.sort(), ['Blat 1', 'Noga wyspy', 'Wyspa']);
});

test('zdjęcie przetrwa podróż przez JSON — tak jak w bazie', () => {
  const r = zdjecieRozrysu([{ nazwa: 'Blat', szer: 3000, gl: 800, ilosc: 4 }]);
  const poJson = JSON.parse(JSON.stringify(OFERTA(r)));
  assert.deepEqual(poJson.rozrys.plyty, r.plyty);
  assert.equal(poJson.rozrys.statystyki.plyt, r.statystyki.plyt);
});

test('oferta z rozrysem mieści się w limicie zapisu do bazy', () => {
  // Duże zlecenie: 10 elementów na kilku płytach.
  const elementy = Array.from({ length: 10 }, (_, i) => ({
    nazwa: `Element ${i + 1}`, szer: 1500 + i * 30, gl: 700, ilosc: 1,
  }));
  const json = JSON.stringify(OFERTA(zdjecieRozrysu(elementy)));
  assert.ok(json.length < 200000, `oferta ma ${json.length} znaków`);
  // Musi też dać się odczytać — czyli nie być ucięta w połowie.
  assert.equal(typeof JSON.parse(json).rozrys.statystyki.plyt, 'number');
});

/* ─────────────────────── do klienta nie idzie nic warsztatowego */

test('zdjęcie nie niesie parametrów cięcia ani elementów nieumieszczonych', () => {
  const r = zdjecieRozrysu([
    { nazwa: 'Gigant', szer: 5000, gl: 900 },
    { nazwa: 'Blat', szer: 1800, gl: 600 },
  ]);
  // Element, który się nie mieści, jest sprawą warsztatu — w ofercie
  // klienta ma po nim nie zostać ślad.
  assert.equal(r.nieumieszczone, undefined);
  assert.equal(r.rzaz, undefined);
  assert.equal(r.margines, undefined);
  assert.equal(r.plytZWyceny, undefined);
  const wSrodku = JSON.stringify(r);
  assert.doesNotMatch(wSrodku, /wiekszy-od-plyty/);
  assert.doesNotMatch(wSrodku, /Gigant/, 'niezmieszczony element nie trafia do klienta');
});

test('statystyki dla klienta mają to, co tłumaczy cenę materiału', () => {
  const s = zdjecieRozrysu([{ nazwa: 'Blat', szer: 1900, gl: 800 }]).statystyki;
  for (const pole of ['plyt', 'plytM2', 'elementyM2', 'odpadM2', 'wykorzystanieProc']) {
    assert.ok(typeof s[pole] === 'number', `brakuje ${pole}`);
  }
});

/* ─────────────────────────────────────── zajawka w mailu */

test('mail zapowiada rozrys liczbami, bez wklejania SVG', () => {
  const html = mailOferty('Anna', OFERTA(zdjecieRozrysu([{ nazwa: 'Blat', szer: 3000, gl: 800, ilosc: 3 }])), 'https://kam24h.pl/oferta#abc');
  assert.match(html, /Rozrys płyt/);
  assert.match(html, /płyty|płyta/);
  assert.match(html, /wykorzystania/);
  assert.doesNotMatch(html, /<svg/i, 'SVG w mailu bywa wycinane — ma być link');
  assert.match(html, /oferta#abc/, 'link do wersji online musi zostać');
});

test('mail bez rozrysu wygląda jak dotąd', () => {
  const html = mailOferty('Anna', OFERTA(null), 'https://kam24h.pl/oferta#abc');
  assert.doesNotMatch(html, /Rozrys płyt/);
  assert.match(html, /Kwota całkowita brutto/);
});

test('liczby w zajawce są po polsku, z przecinkiem', () => {
  const r = zdjecieRozrysu([{ nazwa: 'Blat', szer: 1900, gl: 800 }]);
  const html = mailOferty('', OFERTA(r), 'https://kam24h.pl/oferta#x');
  assert.doesNotMatch(html, /\d+\.\d+ m²/, 'kropka dziesiętna nie może przejść do klienta');
});

/**
 * ROZRYS PŁYT — układanie elementów na płytach (2D bin packing).
 *
 *   node --test scripts/test-nesting.mjs
 *
 * Wszystko w milimetrach. Najważniejsze, czego pilnujemy:
 *   • elementy NIE NACHODZĄ na siebie i mieszczą się w płycie,
 *   • rzaz piły i margines krawędzi są realnie rezerwowane,
 *   • blokada obrotu (usłojenie) jest respektowana,
 *   • element większy od płyty wraca z powodem, a nie znika po cichu.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { rozrysuj, DOMYSLNY_RZAZ_MM, DOMYSLNY_MARGINES_MM } from '../src/engine/nesting.js';

const PLYTA = { szer: 3200, wys: 1600 }; // InterQ / Florim: 320 × 160 cm
const BEZ_STRAT = { rzaz: 0, margines: 0 };

/** Czy dwa ułożone elementy nachodzą na siebie (z tolerancją 0,001 mm). */
const nachodza = (a, b) =>
  a.x < b.x + b.szer - 0.001 &&
  a.x + a.szer > b.x + 0.001 &&
  a.y < b.y + b.gl - 0.001 &&
  a.y + a.gl > b.y + 0.001;

function sprawdzPoprawnosc(wynik, plyta, { rzaz = 0, margines = 0 } = {}) {
  for (const p of wynik.plyty) {
    for (const el of p.elementy) {
      assert.ok(el.x >= margines - 0.001, `${el.nazwa}: wychodzi poza margines z lewej`);
      assert.ok(el.y >= margines - 0.001, `${el.nazwa}: wychodzi poza margines z góry`);
      assert.ok(el.x + el.szer <= plyta.szer - margines + 0.001, `${el.nazwa}: wystaje w prawo`);
      assert.ok(el.y + el.gl <= plyta.wys - margines + 0.001, `${el.nazwa}: wystaje w dół`);
    }
    for (let i = 0; i < p.elementy.length; i++) {
      for (let j = i + 1; j < p.elementy.length; j++) {
        assert.ok(
          !nachodza(p.elementy[i], p.elementy[j]),
          `nachodzą: ${p.elementy[i].nazwa} i ${p.elementy[j].nazwa}`
        );
      }
    }
  }
}

/* ─────────────────────────────────────────── podstawowe układanie */

test('typowa kuchnia mieści się na jednej płycie i nic nie nachodzi', () => {
  const w = rozrysuj(
    [
      { nazwa: 'Blat 1', szer: 1900, gl: 800 },
      { nazwa: 'Blat 2', szer: 1700, gl: 600 },
      { nazwa: 'Noga blatu', szer: 950, gl: 800 },
    ],
    PLYTA,
    BEZ_STRAT
  );
  assert.equal(w.statystyki.plyt, 1);
  assert.equal(w.nieumieszczone.length, 0);
  assert.equal(w.plyty[0].elementy.length, 3);
  sprawdzPoprawnosc(w, PLYTA);
});

test('statystyki liczą powierzchnię, odpad i wykorzystanie', () => {
  const w = rozrysuj([{ nazwa: 'Blat', szer: 1600, gl: 800 }], PLYTA, BEZ_STRAT);
  assert.equal(w.statystyki.plytM2, 5.12);
  assert.equal(w.statystyki.elementyM2, 1.28);
  assert.equal(w.statystyki.odpadM2, 3.84);
  assert.equal(w.statystyki.wykorzystanieProc, 25);
});

test('dużo elementów rozkłada się na kolejne płyty', () => {
  const elementy = [{ nazwa: 'Blat', szer: 3000, gl: 800, ilosc: 6 }];
  const w = rozrysuj(elementy, PLYTA, BEZ_STRAT);
  assert.ok(w.statystyki.plyt >= 3, `płyt: ${w.statystyki.plyt}`);
  assert.equal(w.nieumieszczone.length, 0);
  assert.equal(w.plyty.reduce((a, p) => a + p.elementy.length, 0), 6, 'nic nie zginęło');
  sprawdzPoprawnosc(w, PLYTA);
});

test('ilość rozwija się na osobne, ponumerowane elementy', () => {
  const w = rozrysuj([{ nazwa: 'Półka', szer: 600, gl: 300, ilosc: 3 }], PLYTA, BEZ_STRAT);
  const nazwy = w.plyty[0].elementy.map((e) => e.nazwa);
  assert.deepEqual(nazwy, ['Półka 1', 'Półka 2', 'Półka 3']);
});

/* ───────────────────────────────────── rzaz piły i margines płyty */

test('margines odsuwa elementy od krawędzi płyty', () => {
  const w = rozrysuj([{ nazwa: 'Blat', szer: 3100, gl: 1500 }], PLYTA, { rzaz: 0, margines: 20 });
  assert.equal(w.statystyki.plyt, 1);
  assert.equal(w.plyty[0].elementy[0].x, 20);
  assert.equal(w.plyty[0].elementy[0].y, 20);
  sprawdzPoprawnosc(w, PLYTA, { margines: 20 });
});

test('element mieszczący się w płycie, ale nie w marginesie, odpada', () => {
  const w = rozrysuj([{ nazwa: 'Blat', szer: 3190, gl: 800 }], PLYTA, { rzaz: 0, margines: 20 });
  assert.equal(w.statystyki.plyt, 0);
  assert.equal(w.nieumieszczone[0].powod, 'wiekszy-od-plyty');
});

test('rzaz piły realnie zabiera miejsce — dwa blaty na styk już nie wchodzą', () => {
  // 2 × 1600 mm = dokładnie szerokość płyty: bez rzazu wejdą, z rzazem nie.
  const elementy = [{ nazwa: 'Blat', szer: 1600, gl: 1500, ilosc: 2 }];
  const bez = rozrysuj(elementy, PLYTA, BEZ_STRAT);
  const z = rozrysuj(elementy, PLYTA, { rzaz: 10, margines: 0 });
  assert.equal(bez.statystyki.plyt, 1);
  assert.equal(z.statystyki.plyt, 2, 'rzaz musi wypchnąć drugi element na kolejną płytę');
  sprawdzPoprawnosc(z, PLYTA, { rzaz: 10 });
});

test('domyślne parametry cięcia są ostrożne, ale nie absurdalne', () => {
  assert.ok(DOMYSLNY_RZAZ_MM >= 2 && DOMYSLNY_RZAZ_MM <= 6);
  assert.ok(DOMYSLNY_MARGINES_MM >= 5 && DOMYSLNY_MARGINES_MM <= 30);
});

/* ────────────────────────────────────────── usłojenie: obrót 90° */

test('bez rotacji element w poprzek płyty nie wchodzi, z rotacją wchodzi', () => {
  // 1500 × 3000: przy płycie 3200 × 1600 mieści się TYLKO po obrocie.
  const elementy = [{ nazwa: 'Blat pionowy', szer: 1500, gl: 3000 }];
  const zRotacja = rozrysuj(elementy, PLYTA, { ...BEZ_STRAT, rotacja: true });
  const bezRotacji = rozrysuj(elementy, PLYTA, { ...BEZ_STRAT, rotacja: false });

  assert.equal(zRotacja.statystyki.plyt, 1);
  assert.equal(zRotacja.plyty[0].elementy[0].obrocony, true);
  assert.equal(bezRotacji.statystyki.plyt, 0);
  assert.equal(bezRotacji.nieumieszczone[0].powod, 'wiekszy-od-plyty');
});

test('blokada obrotu zachowuje podane wymiary co do milimetra', () => {
  const w = rozrysuj(
    [
      { nazwa: 'A', szer: 1200, gl: 700 },
      { nazwa: 'B', szer: 700, gl: 1200 },
    ],
    PLYTA,
    { ...BEZ_STRAT, rotacja: false }
  );
  for (const el of w.plyty[0].elementy) {
    assert.equal(el.obrocony, false);
    const wzor = el.nazwa === 'A' ? [1200, 700] : [700, 1200];
    assert.deepEqual([el.szer, el.gl], wzor);
  }
});

test('rotacja potrafi zmieścić komplet na mniejszej liczbie płyt', () => {
  const elementy = [{ nazwa: 'Pas', szer: 1550, gl: 3000, ilosc: 2 }];
  const zRotacja = rozrysuj(elementy, PLYTA, { ...BEZ_STRAT, rotacja: true });
  const bezRotacji = rozrysuj(elementy, PLYTA, { ...BEZ_STRAT, rotacja: false });
  assert.ok(zRotacja.statystyki.plyt < bezRotacji.statystyki.plyt || bezRotacji.statystyki.plyt === 0);
});

/* ─────────────────────────────────── przypadki brzegowe i błędy */

test('element większy od płyty wraca z powodem, reszta układa się dalej', () => {
  const w = rozrysuj(
    [
      { nazwa: 'Gigant', szer: 4000, gl: 900 },
      { nazwa: 'Zwykły blat', szer: 1800, gl: 600 },
    ],
    PLYTA,
    BEZ_STRAT
  );
  assert.equal(w.nieumieszczone.length, 1);
  assert.equal(w.nieumieszczone[0].nazwa, 'Gigant');
  assert.equal(w.nieumieszczone[0].powod, 'wiekszy-od-plyty');
  assert.equal(w.statystyki.nieumieszczonych, 1);
  assert.equal(w.plyty[0].elementy.length, 1, 'reszta ma się policzyć mimo błędu');
});

test('pusta lista i bezsensowne wymiary nie wywracają rozrysu', () => {
  assert.equal(rozrysuj([], PLYTA, BEZ_STRAT).statystyki.plyt, 0);
  assert.equal(rozrysuj([{ nazwa: 'X', szer: 0, gl: 500 }], PLYTA, BEZ_STRAT).plyty.length, 0);
  const zlaPlyta = rozrysuj([{ nazwa: 'X', szer: 500, gl: 500 }], { szer: 10, wys: 10 }, { margines: 20 });
  assert.equal(zlaPlyta.plyty.length, 0);
  assert.equal(zlaPlyta.nieumieszczone.length, 1);
});

test('element dokładnie na wymiar użytecznej płyty wchodzi', () => {
  const w = rozrysuj([{ nazwa: 'Cała płyta', szer: 3180, gl: 1580 }], PLYTA, { rzaz: 0, margines: 10 });
  assert.equal(w.statystyki.plyt, 1);
  assert.equal(w.statystyki.wykorzystanieProc, 98.13);
});

test('wynik jest powtarzalny — te same dane, ten sam rozrys', () => {
  const dane = [
    { nazwa: 'Blat 1', szer: 1900, gl: 800 },
    { nazwa: 'Fartuch', szer: 2300, gl: 550 },
    { nazwa: 'Wyspa', szer: 1200, gl: 900 },
  ];
  const a = rozrysuj(dane, PLYTA, BEZ_STRAT);
  const b = rozrysuj(dane, PLYTA, BEZ_STRAT);
  assert.deepEqual(a.plyty, b.plyty);
});

/* ═════════════ PODPIS WYMIARÓW — unieważnianie zapisanego rozrysu ═════════
 *
 * Bug od Dawida (25.08.2026): „jak zmienię wymiar płyty albo dodam element,
 * to później w rozrysie tego nie widać". `stan.rozrys` powstawał raz i nigdy
 * się nie odświeżał — po zmianie długości blatu w wycenie rozrys (i oferta
 * wysyłana klientowi!) pokazywały starą migawkę.
 */
import { podpisWyceny } from '../src/app/rozrys.js';

test('zmiana długości blatu zmienia podpis — rozrys musi się przeliczyć', () => {
  const przed = podpisWyceny([{ gl: 60, dl: 300 }]);
  const po = podpisWyceny([{ gl: 60, dl: 180 }]);
  assert.notEqual(przed, po, 'skrócenie blatu nie unieważniło rozrysu');
});

test('zmiana głębokości też unieważnia', () => {
  assert.notEqual(podpisWyceny([{ gl: 60, dl: 300 }]), podpisWyceny([{ gl: 90, dl: 300 }]));
});

test('dołożenie odcinka unieważnia', () => {
  assert.notEqual(
    podpisWyceny([{ gl: 60, dl: 300 }]),
    podpisWyceny([{ gl: 60, dl: 300 }, { gl: 60, dl: 120 }])
  );
});

test('te same wymiary = ten sam podpis (ręczne zmiany Dawida przeżywają)', () => {
  assert.equal(podpisWyceny([{ gl: 60, dl: 300 }]), podpisWyceny([{ gl: 60, dl: 300 }]));
  // Liczba czy tekst — bez znaczenia, wymiar jest ten sam.
  assert.equal(podpisWyceny([{ gl: '60', dl: '300' }]), podpisWyceny([{ gl: 60, dl: 300 }]));
});

test('kolejność odcinków ma znaczenie — inny układ to inny rozrys', () => {
  assert.notEqual(
    podpisWyceny([{ gl: 60, dl: 300 }, { gl: 60, dl: 120 }]),
    podpisWyceny([{ gl: 60, dl: 120 }, { gl: 60, dl: 300 }])
  );
});

test('brak odcinków nie wywraca podpisu', () => {
  assert.equal(podpisWyceny([]), podpisWyceny(undefined));
  assert.equal(typeof podpisWyceny(null), 'string');
});

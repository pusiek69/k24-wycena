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
  // Bez rotacji, żeby sprawdzić sam rzaz — po obrocie elementy ułożyłyby się
  // inaczej i test mówiłby o czym innym.
  const elementy = [{ nazwa: 'Blat', szer: 1600, gl: 1500, ilosc: 2 }];
  const bez = rozrysuj(elementy, PLYTA, { rzaz: 0, margines: 0, rotacja: false });
  const z = rozrysuj(elementy, PLYTA, { rzaz: 10, margines: 0, rotacja: false });
  assert.equal(bez.statystyki.plyt, 1);
  assert.equal(z.statystyki.plyt, 2, 'rzaz musi wypchnąć drugi element na kolejną płytę');
  sprawdzPoprawnosc(z, PLYTA, { rzaz: 10 });
});

test('element równy wysokości płyty wchodzi — przy krawędzi rzazu nie ma', () => {
  // Do 25.08.2026 rzaz doliczaliśmy także od strony krawędzi płyty, więc
  // element 1600 mm na płycie 1600 mm „nie mieścił się" o 10 mm. Decyzja
  // Dawida: jego wymiary są ostateczne, rzaz dzieli tylko sąsiadów.
  const w = rozrysuj([{ nazwa: 'Blat', szer: 1500, gl: 1600 }], PLYTA, { rzaz: 10, margines: 0 });
  assert.equal(w.statystyki.nieumieszczonych, 0);
});

test('domyślne parametry cięcia: rzaz realny, margines zerowy', () => {
  assert.ok(DOMYSLNY_RZAZ_MM >= 2 && DOMYSLNY_RZAZ_MM <= 6);
  // 0 od 25.08.2026 — Dawid podaje wymiary do wycięcia bez marginesów.
  assert.equal(DOMYSLNY_MARGINES_MM, 0);
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

/* ══════ RZAZ TYLKO MIĘDZY ELEMENTAMI, MARGINES 0 (Dawid, 25.08.2026) ══════
 *
 * „Ja już podaję wymiary do wycięcia bez marginesów" — wymiary Dawida są
 * ostateczne. Nic ich nie powiększa, rzaz jest wyłącznie odstępem między
 * sąsiadami, a przy krawędzi płyty rzazu nie ma.
 */

test('domyślny margines płyty to 0 — elementy mogą dojść do krawędzi', () => {
  assert.equal(DOMYSLNY_MARGINES_MM, 0);
});

test('element równy płycie co do milimetra MIEŚCI SIĘ', () => {
  // Wcześniej doliczaliśmy rzaz z każdej strony i taki element „nie wchodził".
  const w = rozrysuj([{ nazwa: 'Blat', szer: 3480, gl: 2010 }], { szer: 3480, wys: 2010 });
  assert.equal(w.plyty.length, 1, 'element równy płycie został odrzucony');
  assert.equal(w.nieumieszczone.length, 0);
  assert.equal(w.plyty[0].elementy[0].szer, 3480, 'wymiar elementu został zmieniony');
});

test('wymiary elementu nie są nigdzie powiększane', () => {
  const wej = [{ nazwa: 'Blat', szer: 2537, gl: 613 }, { nazwa: 'Wyspa', szer: 1401, gl: 897 }];
  const w = rozrysuj(wej, { szer: 3480, wys: 2010 });
  const ulozone = w.plyty.flatMap((p) => p.elementy);
  for (const el of wej) {
    const u = ulozone.find((x) => x.nazwa === el.nazwa);
    assert.ok(u, `${el.nazwa} nie został ułożony`);
    // Element mógł zostać obrócony, ale wymiary muszą być te same.
    const zgodne = (u.szer === el.szer && u.gl === el.gl) || (u.szer === el.gl && u.gl === el.szer);
    assert.ok(zgodne, `${el.nazwa}: ${u.szer}×${u.gl} zamiast ${el.szer}×${el.gl}`);
  }
});

test('element zaczyna się w rogu płyty, bez odsunięcia', () => {
  const w = rozrysuj([{ nazwa: 'Blat', szer: 1000, gl: 600 }], { szer: 3480, wys: 2010 });
  const el = w.plyty[0].elementy[0];
  assert.equal(el.x, 0, 'element odsunięty od lewej krawędzi');
  assert.equal(el.y, 0, 'element odsunięty od górnej krawędzi');
});

test('rzaz nadal rozdziela SĄSIADÓW', () => {
  // Dwa elementy po 1000 mm na płycie 2003 mm: wejdą oba tylko wtedy,
  // gdy między nimi zmieści się 3 mm rzazu — i ani milimetra więcej.
  const dwa = [{ nazwa: 'A', szer: 1000, gl: 600 }, { nazwa: 'B', szer: 1000, gl: 600 }];
  const zapas = rozrysuj(dwa, { szer: 2003, wys: 600 }, { rzaz: 3, rotacja: false });
  assert.equal(zapas.plyty.length, 1, 'dwa elementy z rzazem powinny wejść na jedną płytę');

  // Ta sama para na 2002 mm już się nie mieści obok siebie — brakuje rzazu.
  const ciasno = rozrysuj(dwa, { szer: 2002, wys: 600 }, { rzaz: 3, rotacja: false });
  assert.equal(ciasno.plyty.length, 2, 'rzaz między elementami przestał obowiązywać');
});

test('rzaz nie zjada miejsca przy krawędzi płyty', () => {
  // Element 3480 obok niczego — brak sąsiada, brak rzazu.
  const w = rozrysuj([{ nazwa: 'Blat', szer: 3480, gl: 600 }], { szer: 3480, wys: 2010 }, { rzaz: 5 });
  assert.equal(w.statystyki.nieumieszczonych, 0);
});

test('margines ustawiony ręcznie nadal działa', () => {
  // Parametr zostaje w Stawkach — przy surowej krawędzi kamienia bywa potrzebny.
  const bez = rozrysuj([{ nazwa: 'Blat', szer: 3480, gl: 600 }], { szer: 3480, wys: 2010 }, { margines: 0 });
  const z = rozrysuj([{ nazwa: 'Blat', szer: 3480, gl: 600 }], { szer: 3480, wys: 2010 }, { margines: 20 });
  assert.equal(bez.statystyki.nieumieszczonych, 0);
  assert.equal(z.statystyki.nieumieszczonych, 1, 'margines 20 mm powinien wykluczyć element równy płycie');
});

test('margines odsuwa elementy od krawędzi, gdy jest ustawiony', () => {
  const w = rozrysuj([{ nazwa: 'Blat', szer: 1000, gl: 600 }], { szer: 3480, wys: 2010 }, { margines: 15 });
  assert.equal(w.plyty[0].elementy[0].x, 15);
  assert.equal(w.plyty[0].elementy[0].y, 15);
});

test('na płycie Pacifica 3480×2010 mieszczą się trzy blaty 3400 mm', () => {
  const el = Array.from({ length: 3 }, (_, i) => ({ nazwa: `Blat ${i + 1}`, szer: 3400, gl: 600 }));
  const w = rozrysuj(el, { szer: 3480, wys: 2010 }, { rzaz: 3, rotacja: false });
  assert.equal(w.plyty.length, 1, 'trzy pasy 600 mm + rzazy mieszczą się w 2010 mm');
  assert.equal(w.statystyki.nieumieszczonych, 0);
});

/* ═══════════ POŁÓWKI PŁYT W ROZKROJU (Dawid, 25.08.2026) ═══════════
 *
 * „W avant, caesarstone i keralini uwzględnij w rozkroju, że są połówki
 * płyt." Wycena liczyła je od dawna (engine/pakowanie.js), ale rozrys
 * rysował pełny arkusz — przez co odpad na rysunku kłócił się z kwotą.
 *
 * Połówka to arkusz przecięty w POPRZEK: 3200 × 1600 → 3200 × 800.
 */

const POL = { szer: 3200, wys: 1600 };

test('bez zgody dostawcy połówek nie ma — rysujemy pełny arkusz', () => {
  const w = rozrysuj([{ nazwa: 'Blat', szer: 3000, gl: 600 }], POL);
  assert.equal(w.plyty[0].wys, 1600);
  assert.equal(w.plyty[0].polowka, undefined);
  assert.equal(w.statystyki.polowek, 0);
});

test('blat mieszczący się w połowie wysokości daje POŁÓWKĘ', () => {
  const w = rozrysuj([{ nazwa: 'Blat', szer: 3000, gl: 600 }], POL, { polowkaDozwolona: true });
  assert.equal(w.plyty[0].polowka, true);
  assert.equal(w.plyty[0].wys, 800, 'połówka ma połowę wysokości arkusza');
  assert.equal(w.statystyki.polowek, 1);
  assert.equal(w.statystyki.plytPelnych, 0);
});

test('metry liczą się z RZECZYWISTEGO arkusza — połówka to pół', () => {
  const pelna = rozrysuj([{ nazwa: 'Blat', szer: 3000, gl: 600 }], POL);
  const polowka = rozrysuj([{ nazwa: 'Blat', szer: 3000, gl: 600 }], POL, { polowkaDozwolona: true });
  assert.equal(pelna.statystyki.plytM2, 5.12);
  assert.equal(polowka.statystyki.plytM2, 2.56);
});

test('odpad na połówce jest liczony od połówki, nie od całej płyty', () => {
  const w = rozrysuj([{ nazwa: 'Blat', szer: 3000, gl: 600 }], POL, { polowkaDozwolona: true });
  // 2,56 m² arkusza − 1,8 m² blatu = 0,76 m² odpadu.
  assert.equal(w.statystyki.odpadM2, 0.76);
  assert.ok(w.statystyki.wykorzystanieProc > 60, 'wykorzystanie połówki musi być wyższe niż całej płyty');
});

test('blat wyższy niż połowa arkusza NIE jest połówką', () => {
  const w = rozrysuj([{ nazwa: 'Blat', szer: 3000, gl: 900 }], POL, { polowkaDozwolona: true });
  assert.equal(w.plyty[0].polowka, undefined);
  assert.equal(w.plyty[0].wys, 1600);
});

test('połówką może być tylko OSTATNI arkusz', () => {
  // Trzy blaty 3000×600: dwa na pierwszą płytę, trzeci na drugą (połówka).
  const el = Array.from({ length: 3 }, (_, i) => ({ nazwa: `Blat ${i + 1}`, szer: 3000, gl: 600 }));
  const w = rozrysuj(el, POL, { polowkaDozwolona: true, rotacja: false });
  assert.equal(w.plyty.length, 2);
  assert.equal(w.plyty[0].polowka, undefined, 'pierwsza płyta nie może być połówką');
  assert.equal(w.plyty[1].polowka, true);
  assert.equal(w.statystyki.plytPelnych, 1);
  assert.equal(w.statystyki.polowek, 1);
});

test('rozkrój zgadza się z wyceną co do połówki', async () => {
  // To jest sedno zgłoszenia: rysunek i kwota mają mówić to samo.
  const { wycen, FIRMY } = await import('./lib/silnik.mjs').then((m) => m.wczytajSilnik());
  const firma = FIRMY.find((f) => f.slug === 'avant-quartz');
  assert.equal(firma.plyta.polowkaDozwolona, true, 'Avant Quartz ma mieć połówki');

  const odcinki = [{ gl: 60, dl: 300 }];
  const w = wycen(firma, {
    dekor: Object.keys(firma.dekory)[0],
    grubosc: '20',
    odcinki,
    opcje: { pomieszczenie: 'kuchnia', otwory: 1 },
  });
  assert.equal(w.ok, true, w.blad);

  const r = rozrysuj(
    [{ nazwa: 'Blat 1', szer: 3000, gl: 600 }],
    { szer: firma.plyta.w * 10, wys: firma.plyta.h * 10 },
    { polowkaDozwolona: true }
  );
  assert.equal(r.statystyki.plytPelnych, w.pak.plytyPelne, 'liczba pełnych płyt się rozjeżdża');
  assert.equal(r.statystyki.polowek > 0, w.pak.polowka, 'połówka w rozrysie nie zgadza się z wyceną');
});

test('trzy firmy z połówkami mają to ustawione w konfiguracji', async () => {
  const { FIRMY } = await import('./lib/silnik.mjs').then((m) => m.wczytajSilnik());
  for (const slug of ['avant-quartz', 'caesarstone', 'keralini']) {
    const f = FIRMY.find((x) => x.slug === slug);
    assert.equal(f.plyta.polowkaDozwolona, true, `${slug} powinien mieć połówki`);
  }
  // A InterQ i Pacific NIE — dostawcy sprzedają tylko pełne płyty.
  for (const slug of ['interq', 'pacific']) {
    const f = FIRMY.find((x) => x.slug === slug);
    assert.equal(f.plyta.polowkaDozwolona, false, `${slug} nie ma połówek`);
  }
});

test('OŚ CIĘCIA POŁÓWKI: długość zostaje, na pół idzie wysokość', () => {
  /*
   * Potwierdzone przez Dawida 25.08.2026: połówka u Avanta, Caesarstone
   * i Keralini to 320 × 80 cm, a NIE 160 × 160.
   *
   * Ten test istnieje, bo to rozstrzygnięcie kosztuje pieniądze: przy
   * cięciu wzdłuż blat dłuższy niż 160 cm nie zmieściłby się na połówce
   * i trzeba by kupić całą płytę — typowa prosta kuchnia drożeje wtedy
   * o ok. 1 600 zł. Gdyby ktoś kiedyś odwrócił oś, ma się to wywalić tutaj,
   * a nie w cenniku u klienta.
   */
  const w = rozrysuj([{ nazwa: 'Blat', szer: 3000, gl: 600 }], { szer: 3200, wys: 1600 },
    { polowkaDozwolona: true });
  const p = w.plyty[0];
  assert.equal(p.polowka, true);
  assert.equal(p.szer, 3200, 'DŁUGOŚĆ połówki musi zostać pełna');
  assert.equal(p.wys, 800, 'na pół idzie WYSOKOŚĆ');
});

test('blat dłuższy niż połowa płyty i tak wchodzi na połówkę', () => {
  // Sedno wyboru osi: 300 cm blat mieści się, bo połówka ma pełne 320 cm.
  const w = rozrysuj([{ nazwa: 'Blat', szer: 3000, gl: 600 }], { szer: 3200, wys: 1600 },
    { polowkaDozwolona: true, rotacja: false });
  assert.equal(w.statystyki.nieumieszczonych, 0);
  assert.equal(w.statystyki.polowek, 1);
  assert.equal(w.statystyki.plytM2, 2.56, 'klient płaci za pół płyty, nie za całą');
});

/* ═══ POŁÓWKA MIMO NIEWYGODNEGO UKŁADU (Dawid, 26.08.2026) ═══════════
 *
 * „Wycena wychodzi z 1,5 płyty, a na rozrysie pokazuje 2 płyty."
 *
 * MaxRects układał elementy tak, żeby zostawić równe resztki, i nie wiedział,
 * że wysokość OSTATNIEGO arkusza kosztuje pieniądze. Dwa układy potrafiły
 * zabrać połówkę mimo że elementy się na niej mieściły — oba niżej.
 */

test('obrót elementu nie może zabrać połówki', () => {
  // 900 × 800 zmieści się w połówce (wys. 800) tylko BEZ obrotu. Algorytm
  // wolał obrócić na 800 × 900, bo tak lepiej pasowało do wolnego miejsca —
  // i połówka przepadała przez 100 mm.
  const el = [
    { nazwa: 'Blat', szer: 2400, gl: 800 },
    { nazwa: 'Wyspa', szer: 900, gl: 800 },
  ];
  const w = rozrysuj(el, POL, { polowkaDozwolona: true });

  assert.equal(w.plyty.length, 2);
  assert.equal(w.plyty[1].polowka, true, 'druga płyta ma być połówką');
  assert.equal(w.plyty[1].wys, 800);
  assert.equal(w.plyty[1].elementy[0].obrocony, false, 'na połówce element leży bez obrotu');
  assert.equal(w.statystyki.plytPelnych, 1);
  assert.equal(w.statystyki.polowek, 1);
});

test('elementy idą OBOK siebie, gdy dzięki temu wystarczy połówka', () => {
  // 2000 + 600 to 2603 mm z rzazem — mieści się obok siebie na 3200 mm.
  // Algorytm kładł drugi element POD pierwszym (wysokość 1203 mm) i robiła
  // się z tego cała płyta zamiast połówki.
  const el = [
    { nazwa: 'Blat', szer: 2000, gl: 600 },
    { nazwa: 'Wyspa', szer: 600, gl: 600 },
  ];
  const w = rozrysuj(el, POL, { polowkaDozwolona: true });

  assert.equal(w.plyty.length, 1);
  assert.equal(w.plyty[0].polowka, true);
  assert.equal(w.statystyki.plytM2, 2.56, 'kupujemy pół arkusza, nie cały');
});

test('przymiarka do połówki nie może dołożyć płyty', () => {
  // Dwa blaty 2400 × 800 nie zejdą na połówce — ma zostać pełny arkusz,
  // a liczba płyt bez zmian.
  const el = [
    { nazwa: 'Blat A', szer: 2400, gl: 800 },
    { nazwa: 'Blat B', szer: 2400, gl: 800 },
  ];
  const bez = rozrysuj(el, POL);
  const z = rozrysuj(el, POL, { polowkaDozwolona: true });

  assert.equal(z.plyty.length, bez.plyty.length, 'liczba płyt nie może urosnąć');
  assert.equal(z.statystyki.nieumieszczonych, 0);
});

test('elementy na połówce nie wychodzą poza jej wysokość', () => {
  const w = rozrysuj(
    [
      { nazwa: 'Blat', szer: 2400, gl: 800 },
      { nazwa: 'Wyspa', szer: 900, gl: 800 },
    ],
    POL,
    { polowkaDozwolona: true }
  );
  for (const p of w.plyty) {
    for (const e of p.elementy) {
      assert.ok(e.y + e.gl <= p.wys + 0.001, `${e.nazwa} wystaje poza arkusz ${p.nr}`);
      assert.ok(e.x + e.szer <= p.szer + 0.001, `${e.nazwa} wystaje w bok na arkuszu ${p.nr}`);
    }
  }
});

test('rozrys NIGDY nie potrzebuje więcej materiału niż wycena', async () => {
  /*
   * Sedno zgłoszenia, sprawdzone na całej siatce realnych kuchni, a nie
   * na jednym przykładzie. Rozrys może wypaść LEPIEJ od wyceny (MaxRects
   * pakuje gęściej niż pasy) — ale nigdy gorzej, bo wtedy Dawid patrzy
   * na rysunek z dwiema płytami przy kwocie za półtorej.
   *
   * Liczymy w POŁÓWKACH, żeby „1 i ½" dało się porównać z „2".
   */
  const { upakuj } = await import('../src/engine/pakowanie.js');
  const PLYTA_CM = { w: 320, h: 160, polowkaDozwolona: true };

  const gorsze = [];
  for (const dl of [180, 200, 240, 260, 280, 300, 320]) {
    for (const drugi of [0, 60, 90, 120, 160, 180, 200, 240]) {
      for (const gl of [60, 62, 65, 80]) {
        const odcinki = [{ dl, gl }];
        if (drugi) odcinki.push({ dl: drugi, gl });

        const pak = upakuj(odcinki, PLYTA_CM);
        const r = rozrysuj(
          odcinki.map((o, i) => ({ nazwa: `E${i}`, szer: o.dl * 10, gl: o.gl * 10 })),
          POL,
          { polowkaDozwolona: true }
        );

        const wWycenie = pak.plytyPelne * 2 + (pak.polowka ? 1 : 0);
        const wRozrysie = r.statystyki.plytPelnych * 2 + r.statystyki.polowek;
        if (wRozrysie > wWycenie) {
          gorsze.push(`${odcinki.map((o) => `${o.dl}×${o.gl}`).join(' + ')}: rozrys ${wRozrysie / 2}, wycena ${wWycenie / 2}`);
        }
      }
    }
  }

  assert.deepEqual(gorsze, [], 'rozrys żąda więcej płyt niż wycena');
});

test('połówka działa też na formacie Interstone 300 × 180', () => {
  // Inny format, ta sama zasada: połowa WYSOKOŚCI (1800 → 900).
  const w = rozrysuj([{ nazwa: 'Blat', szer: 2800, gl: 600 }], { szer: 3000, wys: 1800 }, { polowkaDozwolona: true });
  assert.equal(w.plyty[0].polowka, true);
  assert.equal(w.plyty[0].wys, 900);
});

/* ═══ PRZYKŁAD DAWIDA: WYSPA GŁĘBSZA NIŻ BLATY (26.08.2026) ═══════════
 *
 * Avant Quartz, płyta 320 × 160. Odcinki (głębokość × długość):
 * 60×300, 60×320, 99×160, 60×100.
 *
 * Rozrys pokazywał 2 PEŁNE płyty, wycena 1 i ½ — i to WYCENA miała rację:
 * układ na 1 pełnej + połówce jest wykonalny (sprawdzony ręcznie), tylko
 * zachłanne pakowanie go nie znajdowało. Wyspa 99 × 160 cm stawiana
 * „na sztorc" (990 × 1600 mm) wchodziła dokładnie w wysokość arkusza
 * i blokowała go na jeden element.
 */

const DAWID = [
  { nazwa: 'Blat A', szer: 3000, gl: 600 },
  { nazwa: 'Blat B', szer: 3200, gl: 600 },
  { nazwa: 'Wyspa', szer: 1600, gl: 990 },
  { nazwa: 'Blat C', szer: 1000, gl: 600 },
];

test('przykład Dawida: rozrys schodzi na 1 pełną + połówkę', () => {
  const w = rozrysuj(DAWID, POL, { polowkaDozwolona: true });
  assert.equal(w.statystyki.nieumieszczonych, 0);
  assert.equal(w.statystyki.plytPelnych, 1);
  assert.equal(w.statystyki.polowek, 1);
  assert.equal(w.statystyki.plytM2, 7.68);
});

test('przykład Dawida: wycena i rozrys mówią to samo', async () => {
  const { upakuj, opisPlyt } = await import('../src/engine/pakowanie.js');
  const odcinki = [
    { gl: 60, dl: 300 },
    { gl: 60, dl: 320 },
    { gl: 99, dl: 160 },
    { gl: 60, dl: 100 },
  ];
  const pak = upakuj(odcinki, { w: 320, h: 160, polowkaDozwolona: true });
  const r = rozrysuj(DAWID, POL, { polowkaDozwolona: true });

  assert.equal(opisPlyt(pak), '1 i ½ płyty');
  assert.equal(pak.plytyPelne, r.statystyki.plytPelnych);
  assert.equal(pak.polowka, r.statystyki.polowek > 0);
});

test('elementy z przykładu Dawida naprawdę mieszczą się tam, gdzie narysowane', () => {
  const w = rozrysuj(DAWID, POL, { polowkaDozwolona: true });
  for (const p of w.plyty) {
    for (const e of p.elementy) {
      assert.ok(e.x >= -0.001 && e.y >= -0.001, `${e.nazwa} poza arkuszem`);
      assert.ok(e.x + e.szer <= p.szer + 0.001, `${e.nazwa} wystaje w bok`);
      assert.ok(e.y + e.gl <= p.wys + 0.001, `${e.nazwa} wystaje w dół`);
    }
    // Żadne dwa elementy nie mogą na siebie nachodzić.
    for (let i = 0; i < p.elementy.length; i++) {
      for (let j = i + 1; j < p.elementy.length; j++) {
        const a = p.elementy[i];
        const b = p.elementy[j];
        const koliduje =
          a.x < b.x + b.szer - 0.001 &&
          a.x + a.szer - 0.001 > b.x &&
          a.y < b.y + b.gl - 0.001 &&
          a.y + a.gl - 0.001 > b.y;
        assert.ok(!koliduje, `${a.nazwa} nachodzi na ${b.nazwa}`);
      }
    }
  }
});

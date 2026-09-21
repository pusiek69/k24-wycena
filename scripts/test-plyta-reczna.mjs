/**
 * RĘCZNY WYMIAR PŁYTY W EDYTORZE WŁAŚCICIELA (zlecenie Dawida, 21.09.2026).
 *
 *   node --test scripts/test-plyta-reczna.mjs
 *
 * „Avant Mulen ma płytę 320 × 160, ale chcę móc wpisać też np. 100 × 100
 *  (resztka albo inny format) — i żeby algorytm rozkroju liczył się z tego."
 *
 * Ta funkcja nie jest kosmetyką rysunku: format płyty decyduje o LICZBIE
 * PŁYT, a liczba płyt o cenie materiału. Dlatego testy idą aż do `wycen()`
 * i sprawdzają kwotę, a nie tylko to, czy pole przyjmuje liczby.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { wycen } from '../src/engine/wycena.js';
import { ROBOCIZNA, OPCJE, VAT_MONTAZ } from '../src/firms/_domyslne.js';
import * as plytaR from '../src/app/plyta-reczna.js';

const zrodlo = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** Firma jak w produkcji: pełne płyty 320 × 160, połówka dozwolona. */
const firma = (plyta = { w: 320, h: 160, polowkaDozwolona: true }) => ({
  slug: 'test',
  nazwa: 'Test',
  typ: 'konglomerat kwarcowy',
  aktywna: true,
  trybCeny: 'katalog',
  cenyUslug: 'brutto',
  vatMontaz: VAT_MONTAZ,
  plyta,
  robocizna: ROBOCIZNA,
  opcje: OPCJE,
  dekory: { Testowy: { 20: 800 } },
});

const licz = (plytaReczna, odcinki = [{ gl: 60, dl: 300 }], f = firma()) =>
  wycen(f, {
    dekor: 'Testowy',
    grubosc: '20',
    odcinki,
    opcje: { pomieszczenie: 'kuchnia', zlew: 'podblat', plyta: 'nakladana', otwory: 1 },
    plytaReczna,
  });

/* ═════════════════════════ reguły pola ═════════════════════════════════ */

test('wpisane wymiary składają się na format płyty', () => {
  const f = plytaR.formatDoWyceny({ w: 100, h: 100 }, { w: 320, h: 160, rzaz: 0.3 });
  assert.equal(f.w, 100);
  assert.equal(f.h, 100);
  assert.equal(f.rzaz, 0.3, 'rzaz z cennika ma zostać — to parametr piły, nie wymiar');
});

test('z resztki nie kupuje się POŁÓWKI płyty', () => {
  /*
   * Resztka to jeden fizyczny kawałek. Gdyby `polowkaDozwolona` przeszło
   * z cennika, wycena policzyłaby pół resztki i materiał wyszedłby o połowę
   * tańszy, niż Dawid realnie zapłacił.
   */
  const f = plytaR.formatDoWyceny({ w: 100, h: 100 }, { w: 320, h: 160, polowkaDozwolona: true });
  assert.equal(f.polowkaDozwolona, false);
});

test('bzdurny wymiar nie wchodzi do wyceny', () => {
  for (const zly of [{ w: 100 }, { w: 0, h: 100 }, { w: 5, h: 100 }, { w: 100, h: 900 }, {}, null])
    assert.equal(plytaR.formatDoWyceny(zly, null), null, `${JSON.stringify(zly)} przeszło`);
  assert.match(plytaR.bladWymiaru({ w: 100 }), /oba wymiary/);
  assert.match(plytaR.bladWymiaru({ w: 5, h: 5 }), /poza zakresem/);
  assert.equal(plytaR.bladWymiaru({}), '', 'puste pole to nie błąd, tylko brak nadpisania');
});

test('przecinek dziesiętny jest dopuszczalny — cenniki mają 318,5', () => {
  const f = plytaR.formatDoWyceny({ w: '318,5', h: '155' }, null);
  assert.equal(f.w, 318.5);
  assert.equal(f.h, 155);
});

test('wpisanie formatu cennikowego to NIE jest nadpisanie', () => {
  // Inaczej wycena zostałaby „ręczna" na zawsze: przestałaby reagować na
  // zmianę formatu w cenniku i po cichu straciłaby prawo do połówki płyty.
  assert.equal(plytaR.takiJakDomyslny({ w: 320, h: 160 }, { w: 320, h: 160 }), true);
  assert.equal(plytaR.takiJakDomyslny({ w: '320', h: '160' }, { w: 320, h: 160 }), true);
  assert.equal(plytaR.takiJakDomyslny({ w: 100, h: 100 }, { w: 320, h: 160 }), false);
});

/* ═══════════════ wpływ na rozkrój, liczbę płyt i cenę ══════════════════ */

test('PRZYKŁAD DAWIDA: 100 × 100 zmienia liczbę płyt i cenę materiału', () => {
  const zCennika = licz(null);
  const zResztki = licz(plytaR.formatDoWyceny({ w: 100, h: 100 }, null));

  assert.ok(zCennika.ok && zResztki.ok);
  assert.equal(zCennika.plyta.w, 320, 'bez nadpisania liczymy z formatu cennikowego');
  assert.equal(zResztki.plyta.w, 100, 'z nadpisaniem liczymy z wymiaru od Dawida');
  /*
   * Format cennikowy MUSI zostać osobno. Bez niego edytor podpisywał pole
   * „w cenniku 100 × 100" (czyli wymiarem, który Dawid właśnie wpisał),
   * a wpisanie z powrotem 320 × 160 nie kasowało nadpisania — złapane
   * na produkcji 21.09.2026, zaraz po wdrożeniu.
   */
  assert.equal(zResztki.plytaCennikowa.w, 320, 'format z cennika przepadł');
  assert.equal(zResztki.plytaCennikowa.h, 160);
  assert.equal(zCennika.plytaCennikowa.w, 320, 'bez nadpisania to ten sam format');

  // Blat 60 × 300 mieści się na jednej płycie 320 × 160, a na kawałkach
  // 100 × 100 trzeba go pociąć i dokupić kolejne sztuki.
  assert.ok(
    zResztki.pak.plytyPelne > zCennika.pak.plytyPelne,
    `z resztki ${zResztki.pak.plytyPelne} płyt, z cennika ${zCennika.pak.plytyPelne}`
  );
  assert.ok(zResztki.materialBrutto > zCennika.materialBrutto, 'cena materiału nie drgnęła');
});

test('rozkrój i wycena liczą z TEGO SAMEGO formatu', () => {
  /*
   * `w.plyta` jest tym, co karta wyceny i rysunek pokazują klientowi.
   * Gdyby wycena liczyła z resztki, a rysunek rysował płytę katalogową,
   * Dawid zobaczyłby dwie różne prawdy naraz — dokładnie ta klasa błędu,
   * którą zamknęło ujednolicenie pakowania (26.08.2026).
   */
  const w = licz(plytaR.formatDoWyceny({ w: 120, h: 90 }, null));
  assert.equal(w.plyta.w, 120);
  assert.equal(w.plyta.h, 90);
  // Rozkrój na rysunku i liczba płyt w wycenie wychodzą z tego samego
  // pakowania (`w.pak`), więc wystarczy sprawdzić, że policzyło się
  // z kawałka: blat 300 cm nie zmieści się w 120 cm bez łączeń.
  assert.ok(w.pak.laczenia > 0, 'blat 300 cm zmieścił się na płycie 120 cm bez łączenia?');
  assert.ok(w.pak.plytyPelne >= 3, `z płyty 120 × 90 wyszło tylko ${w.pak.plytyPelne} płyt`);
});

test('za mały kawałek mówi wprost, że blat się nie mieści', () => {
  // Bez ostrzeżenia wyszłaby kwota za kilkanaście płyt i nikt by nie wiedział
  // dlaczego. Ostrzeżenie robi pakowanie — sprawdzamy, że dociera do wyniku.
  const w = licz(plytaR.formatDoWyceny({ w: 50, h: 50 }, null), [{ gl: 60, dl: 300 }]);
  assert.ok(w.ok, 'wycena ma się policzyć, a nie wywalić');
  assert.ok(w.ostrzezenia.length > 0, 'brak ostrzeżenia o niemieszczącym się elemencie');
});

test('bez nadpisania format kampanii i pozycji cennika działa jak dotąd', () => {
  /*
   * Najgroźniejszy możliwy skutek uboczny tej funkcji: gdyby edytor zawsze
   * podawał format (choćby domyślny), nadpisałby format z kampanii —
   * Technistone promocyjny tnie się z płyt 330 × 165, nie 318,5 × 155.
   */
  const zWpisu = wycen(firma({ w: 320, h: 160, polowkaDozwolona: true }), {
    dekor: 'Testowy',
    grubosc: '20',
    odcinki: [{ gl: 60, dl: 300 }],
    opcje: { pomieszczenie: 'kuchnia', zlew: 'podblat', plyta: 'nakladana', otwory: 1 },
    // dokładnie to, co poda edytor, gdy Dawid niczego nie zmieni
    plytaReczna: plytaR.formatDoWyceny(null, null),
  });
  assert.equal(zWpisu.plyta.w, 320);
  assert.equal(zWpisu.plyta.polowkaDozwolona, true, 'prawo do połówki płyty przepadło');
});

/* ═══════════════════ przeżycie „Powtórz wycenę" ════════════════════════ */

test('wymiar wraca z parametrów oferty, a brak nadpisania nie zostawia pola', () => {
  assert.deepEqual(plytaR.zParametrow({ w: 100, h: 100 }), { w: 100, h: 100 });
  assert.equal(plytaR.zParametrow({ w: 100 }), null);
  assert.equal(plytaR.zParametrow(undefined), null);
  assert.deepEqual(plytaR.doParametrow({ w: 100, h: 100 }), { w: 100, h: 100 });
  assert.equal(plytaR.doParametrow(null), undefined);
});

/* ═════════════ czy to w ogóle jest PODŁĄCZONE ══════════════════════════ */

test('SILNIK: ręczny format bije kampanię i pozycję cennika', () => {
  const e = zrodlo('src/engine/wycena.js');
  assert.match(e, /const plytaCennikowa = promo\?\.plyta \|\| plytaDekoru \|\| firma\.plyta;/);
  assert.match(e, /const plyta = w\.plytaReczna \|\| plytaCennikowa;/);
  // Format cennikowy wraca w wyniku — edytor podpisuje nim pole.
  assert.match(e, /^    plytaCennikowa,$/m);
});

test('EDYTOR: pole jest w widoku, prefill z formatu UŻYTEGO w wycenie', () => {
  const ed = zrodlo('src/app/oferta-dawida.js');
  assert.match(ed, /blokPlyty\(stan, w, odswiez\)/, 'blok nie jest wpięty w widok');
  // Prefill z `w.plyta`, czyli z formatu, którym silnik NAPRAWDĘ liczył.
  assert.match(ed, /plytaR\.wymiarDomyslny\(w\?\.plytaCennikowa \|\| w\?\.plyta\)/);
  assert.match(ed, /plyta-reczna/, 'brak złotego oznaczenia wymiaru ręcznego');
  assert.match(ed, /Wróć do wymiaru z cennika/, 'brak powrotu do wymiaru cennikowego');
  // Format leci do obu ścieżek katalogowych: kolekcje i wyprzedaż.
  assert.equal(
    (ed.match(/plytaReczna: plytaR\.formatDoWyceny\(stan\.plytaReczna, null\)/g) || []).length,
    2,
    'ręczny format nie dociera do wszystkich ścieżek wyceny'
  );
  // Zapis do parametrów — „Powtórz wycenę" nie gubi wymiaru.
  assert.match(ed, /plytaReczna: plytaR\.doParametrow\(stan\.plytaReczna\)/);
  assert.match(ed, /plytaReczna: plytaR\.zParametrow\(p\.plytaReczna\)/);
});

test('KALKULATOR KLIENTA: nigdzie nie podaje ręcznego formatu płyty', () => {
  /*
   * Zlecenie mówi wprost: tylko panel/edytor właściciela. Klient nie ma
   * skąd wiedzieć, jakie resztki leżą na hali, a pole w kreatorze byłoby
   * zaproszeniem do wyceny, której nikt nie jest w stanie zrealizować.
   */
  for (const plik of ['src/app/kroki.js', 'src/app/wizard.js', 'src/app/pomocnicy.js', 'src/app/czat.js'])
    assert.ok(!zrodlo(plik).includes('plytaReczna'), `${plik} podaje ręczny format płyty`);
});

test('EDYTOR: przy kamieniu naturalnym i płycie własnej pola NIE MA', () => {
  // Tam wymiar płyty ma już własne pola — dwa miejsca na tę samą liczbę
  // kończyłyby się pytaniem, które z nich obowiązuje.
  const ed = zrodlo('src/app/oferta-dawida.js');
  assert.match(ed, /naturalny \|\| plytaWlasna \? null : blokPlyty\(stan, w, odswiez\)/);
});

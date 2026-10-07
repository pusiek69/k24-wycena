/**
 * RĘCZNA EDYCJA ROZKROJU — moduł czysty (zlecenie Dawida, 7.10.2026).
 *
 *   node --test scripts/test-rozkroj-reczny.mjs
 *
 * Silnik rozkroju zostaje nietknięty: tu sprawdzamy warstwę, która bierze
 * gotowy układ z `rozrysuj()`, pozwala go przestawić i oddaje w tym samym
 * kształcie. Projekt: docs/specs/2026-10-07-reczna-edycja-rozkroju-design.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { rozrysuj } from '../src/engine/nesting.js';
import {
  zUkladu,
  doUkladu,
  przesun,
  obroc,
  przenies,
  dodajPlyte,
  usunPlyte,
  sprawdz,
  roznicaPlyt,
  magnes,
  uporzadkuj,
  PROG_MAGNESU_MM,
} from '../src/app/rozkroj-reczny.js';

const PLYTA = { szer: 3200, wys: 1600 };
const KUCHNIA = [
  { nazwa: 'Blat', szer: 3000, gl: 600, ilosc: 1 },
  { nazwa: 'Wyspa', szer: 1800, gl: 900, ilosc: 1 },
];
const automat = (opcje = {}) => rozrysuj(KUCHNIA, PLYTA, { rzaz: 3, margines: 0, ...opcje });

test('zUkladu nadaje elementom id i nie rusza współrzędnych', () => {
  const w = automat();
  const model = zUkladu(w);
  const zSilnika = w.plyty.flatMap((p) => p.elementy);
  const zModelu = model.plyty.flatMap((p) => p.elementy);

  assert.equal(zModelu.length, zSilnika.length);
  assert.equal(new Set(zModelu.map((e) => e.id)).size, zModelu.length, 'id muszą być unikalne');
  for (const [i, e] of zModelu.entries()) {
    assert.equal(e.x, zSilnika[i].x);
    assert.equal(e.y, zSilnika[i].y);
    assert.equal(e.szer, zSilnika[i].szer);
    assert.equal(e.gl, zSilnika[i].gl);
  }
});

test('doUkladu odtwarza statystyki silnika co do trzeciego miejsca', () => {
  /*
   * To jest główna gwarancja całego modułu: nietknięty układ przepuszczony
   * przez model ma dać DOKŁADNIE te same liczby, które podał silnik. Inaczej
   * „odpad" i „wykorzystanie" na rysunku Dawida zaczynają żyć własnym życiem.
   */
  const w = automat();
  const odtworzony = doUkladu(zUkladu(w), PLYTA);
  assert.deepEqual(odtworzony.statystyki, w.statystyki);
  assert.equal(odtworzony.plyty.length, w.plyty.length);
});

test('przesun zmienia tylko wskazany element i nie mutuje wejścia', () => {
  const model = zUkladu(automat());
  const id = model.plyty[0].elementy[0].id;
  const przed = JSON.stringify(model);

  const po = przesun(model, id, { x: 120, y: 240 });
  const el = po.plyty.flatMap((p) => p.elementy).find((e) => e.id === id);

  assert.equal(el.x, 120);
  assert.equal(el.y, 240);
  assert.equal(JSON.stringify(model), przed, 'model wejściowy ma zostać nietknięty');
});

test('sprawdz widzi kolizję, gdy element nachodzi na sąsiada', () => {
  const model = zUkladu(automat());
  const [a, b] = model.plyty[0].elementy.length > 1
    ? model.plyty[0].elementy
    : [model.plyty[0].elementy[0], null];
  assert.ok(b, 'test potrzebuje dwóch elementów na jednej płycie');

  const zderzony = przesun(model, b.id, { x: a.x, y: a.y });
  const problemy = sprawdz(zderzony, { rzaz: 3, margines: 0 });

  assert.ok(
    problemy.some((p) => p.typ === 'kolizja' && p.id === b.id),
    `brak kolizji w: ${JSON.stringify(problemy)}`
  );
});

test('sprawdz nie czepia się elementów odsuniętych dokładnie o rzaz', () => {
  const model = {
    plyty: [
      {
        nr: 1,
        szer: 3200,
        wys: 1600,
        elementy: [
          { id: 'a', nazwa: 'A', x: 0, y: 0, szer: 1000, gl: 600 },
          { id: 'b', nazwa: 'B', x: 1003, y: 0, szer: 1000, gl: 600 },
        ],
      },
    ],
  };
  assert.deepEqual(sprawdz(model, { rzaz: 3, margines: 0 }), []);
});

test('sprawdz wykrywa element wystający poza płytę i poza margines', () => {
  const model = {
    plyty: [
      { nr: 1, szer: 3200, wys: 1600, elementy: [{ id: 'a', nazwa: 'A', x: 3000, y: 0, szer: 400, gl: 600 }] },
    ],
  };
  assert.ok(sprawdz(model, { rzaz: 3, margines: 0 }).some((p) => p.typ === 'poza-plyta'));

  const przyKrawedzi = {
    plyty: [
      { nr: 1, szer: 3200, wys: 1600, elementy: [{ id: 'a', nazwa: 'A', x: 0, y: 0, szer: 400, gl: 600 }] },
    ],
  };
  assert.deepEqual(sprawdz(przyKrawedzi, { rzaz: 3, margines: 0 }), [], 'bez marginesu krawędź jest legalna');
  assert.ok(
    sprawdz(przyKrawedzi, { rzaz: 3, margines: 20 }).some((p) => p.typ === 'poza-plyta'),
    'przy marginesie 20 mm ten sam element już wystaje'
  );
});

test('obroc zamienia boki ZAWSZE — przy usłojeniu tylko ostrzega', () => {
  /*
   * Korekta Dawida (7.10.2026, wieczór): żadnych blokad. Przy kamieniu
   * z rysunkiem obrót zwykle jest błędem — ale to Dawid stoi przy płycie
   * i czasem wie lepiej niż reguła (pasek pod okno, resztka z bloku,
   * element, którego usłojenie i tak nie będzie widoczne). Dostaje więc
   * uwagę, nie odmowę.
   */
  const model = zUkladu(automat());
  const el = model.plyty[0].elementy[0];

  const wolny = obroc(model, el.id, { rotacja: true });
  const obrocony = wolny.model.plyty.flatMap((p) => p.elementy).find((e) => e.id === el.id);
  assert.equal(wolny.uwaga, undefined, 'bez usłojenia nie ma o czym ostrzegać');
  assert.equal(obrocony.szer, el.gl);
  assert.equal(obrocony.gl, el.szer);

  const zUslojeniem = obroc(model, el.id, { rotacja: false });
  const mimoWszystko = zUslojeniem.model.plyty.flatMap((p) => p.elementy).find((e) => e.id === el.id);
  assert.equal(mimoWszystko.szer, el.gl, 'obrót ma się wykonać także przy usłojeniu');
  assert.equal(mimoWszystko.gl, el.szer);
  assert.match(zUslojeniem.uwaga || '', /usłojeni/i, 'ma zostać uwaga, dlaczego to ryzykowne');
  assert.equal(zUslojeniem.blad, undefined, 'żadnych blokad — to ma być uwaga, nie odmowa');
});

test('przenies przekłada element na inną płytę z zachowaniem wymiarów', () => {
  const model = dodajPlyte(zUkladu(automat()));
  const el = model.plyty[0].elementy[0];
  const docelowa = model.plyty.length;

  const po = przenies(model, el.id, docelowa);

  assert.ok(!po.plyty[0].elementy.some((e) => e.id === el.id), 'element zniknął ze starej płyty');
  const przeniesiony = po.plyty[docelowa - 1].elementy.find((e) => e.id === el.id);
  assert.ok(przeniesiony, 'element jest na nowej płycie');
  assert.equal(przeniesiony.szer, el.szer);
  assert.equal(przeniesiony.gl, el.gl);
});

test('dodajPlyte dokłada pustą płytę w formacie pozostałych', () => {
  const model = zUkladu(automat());
  const po = dodajPlyte(model);

  assert.equal(po.plyty.length, model.plyty.length + 1);
  const nowa = po.plyty[po.plyty.length - 1];
  assert.deepEqual(nowa.elementy, []);
  assert.equal(nowa.szer, model.plyty[0].szer);
  assert.equal(nowa.wys, model.plyty[0].wys);
  assert.equal(nowa.nr, po.plyty.length);
});

test('usunPlyte zdejmuje pustą, a zajętej broni — i numeruje od nowa', () => {
  const zPusta = dodajPlyte(zUkladu(automat()));
  const nrPustej = zPusta.plyty.length;

  const { model: po, blad } = usunPlyte(zPusta, nrPustej);
  assert.equal(blad, undefined);
  assert.equal(po.plyty.length, zPusta.plyty.length - 1);
  assert.deepEqual(po.plyty.map((p) => p.nr), po.plyty.map((_, i) => i + 1));

  const zajeta = usunPlyte(zPusta, 1);
  assert.match(zajeta.blad || '', /element/i, 'odmowa ma powiedzieć, że płyta nie jest pusta');
  assert.equal(zajeta.model.plyty.length, zPusta.plyty.length);
});

test('sprawdz MELDUJE problemy, ale niczego nie blokuje', () => {
  /*
   * Korekta Dawida (7.10.2026, wieczór): czerwień zostaje jako informacja,
   * zapis ma działać zawsze. Moduł orzeka o układzie i tyle — żadnej
   * funkcji, która mówi „nie wolno".
   */
  const kolidujacy = {
    plyty: [
      {
        nr: 1,
        szer: 3200,
        wys: 1600,
        elementy: [
          { id: 'a', nazwa: 'A', x: 0, y: 0, szer: 1000, gl: 600 },
          { id: 'b', nazwa: 'B', x: 500, y: 0, szer: 1000, gl: 600 },
        ],
      },
    ],
  };
  const problemy = sprawdz(kolidujacy, { rzaz: 3, margines: 0 });
  assert.equal(problemy.length, 1);
  assert.equal(problemy[0].typ, 'kolizja');
  assert.ok(!problemy[0].blokuje, 'problem nie ma prawa niczego blokować');
});

test('roznicaPlyt mówi, o ile ręczny układ rozjeżdża się z wyceną', () => {
  /*
   * Cena NIE zmienia się sama — to ta sama zasada, co przy dotychczasowym
   * ostrzeżeniu rozrys kontra wycena. Dawid ma zobaczyć różnicę i zdecydować.
   */
  const model = { plyty: [{ nr: 1, elementy: [] }, { nr: 2, elementy: [] }] };

  assert.equal(roznicaPlyt(model, 2), null, 'zgadza się — nie ma o czym mówić');

  const wiecej = roznicaPlyt(model, 1);
  assert.equal(wiecej.reczne, 2);
  assert.equal(wiecej.zWyceny, 1);
  assert.match(wiecej.komunikat, /wycen/i);
  assert.ok(!/cen[aę]|zł/i.test(wiecej.komunikat.replace(/wycen\w*/gi, '')), 'komunikat nie obiecuje zmiany ceny');

  assert.equal(roznicaPlyt(model, 3).reczne, 2);
  assert.equal(roznicaPlyt(model, null), null, 'bez liczby z wyceny nie ma czego porównać');
});

/* ══════════════════════ warstwa widoku (skan źródeł, jak reszta repo) */

const zrodlo = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('widok rozrysu ma tryb ręczny: przełącznik, badge i powrót do automatu', () => {
  const t = zrodlo('src/app/rozrys.js');
  assert.match(t, /from '\.\/rozkroj-reczny\.js'/, 'widok nie używa modułu reguł');
  assert.match(t, /Edytuj ręcznie/);
  assert.match(t, /Wróć do automatu/);
  assert.match(t, /układ ręczny/, 'brak wyraźnego oznaczenia układu ręcznego');
  assert.match(t, /Obróć 90°/);
  assert.match(t, /Na następną płytę/);
  assert.match(t, /\+ Płyta/);
  assert.ok(!/Zapis zablokowany/.test(t), 'żadnych blokad — korekta Dawida z 7.10.2026');
});

test('przeciąganie działa myszą i palcem — jedna obsługa Pointer Events', () => {
  /*
   * Dawid ogląda rozrys równie często na telefonie w warsztacie, co przy
   * komputerze. Osobne mouse* i touch* znaczyłoby dwie ścieżki do utrzymania
   * i jedną z nich zawsze nieprzetestowaną.
   */
  const t = zrodlo('src/app/rozrys.js');
  for (const zdarzenie of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
    assert.match(t, new RegExp(zdarzenie), `brak obsługi ${zdarzenie}`);
  }
  assert.ok(!/addEventListener\('(mousedown|touchstart)/.test(t), 'mysz i dotyk mają iść jedną ścieżką');
  assert.match(zrodlo('src/app/rozrys-svg.js'), /touchAction/, 'bez touch-action palec przewija stronę zamiast przesuwać element');
});

test('SILNIK liczenia płyt zostaje nietknięty', () => {
  /*
   * Warunek Dawida wprost: moduł rozrysu ma wspólny silnik z wyceną.
   * Edycja jest warstwą prezentacji — jak tylko silnik zacznie o niej
   * wiedzieć, każda ręczna zmiana zaczyna ruszać kwotę na ofercie.
   */
  for (const plik of ['src/engine/nesting.js', 'src/engine/pakowanie.js']) {
    const t = zrodlo(plik);
    assert.ok(!t.includes('rozkroj-reczny'), `${plik} importuje warstwę edycji`);
    assert.ok(!/reczny/i.test(t), `${plik} wie o trybie ręcznym`);
  }
});

test('kalkulator klienta nie wie o edycji układu', () => {
  for (const plik of ['src/app/kroki.js', 'src/app/czat.js', 'src/app/oferta-widok.js', 'src/app/pomocnicy.js']) {
    assert.ok(!zrodlo(plik).includes('rozkroj-reczny'), `${plik} sięga po edycję rozkroju`);
  }
  // Rysunek u klienta powstaje bez `edycja`, więc żadnego uchwytu tam nie ma.
  const svg = zrodlo('src/app/rozrys-svg.js');
  for (const uchwyt of ["data-el-id", "cursor: 'grab'", 'touchAction']) {
    const linia = svg.split('\n').find((l) => l.includes(uchwyt));
    assert.ok(linia, `brak ${uchwyt} w rysunku`);
  }
  assert.match(svg, /p\.edycja \? el\('g'/, 'grupy do przeciągania muszą być tylko w trybie ręcznym');
});

test('oferta zamraża układ RĘCZNY taki, jaki jest', () => {
  /*
   * Korekta Dawida: układ ma trafiać do oferty także wtedy, gdy reguły
   * zgłaszają kolizję — właściciel wie, co robi, a rysunek ma pokazywać
   * to, co naprawdą ułożył.
   */
  const t = zrodlo('src/app/oferta-dawida.js');
  assert.match(t, /ustawienia\.reczny\?\.plyty\?\.length/, 'oferta nie bierze układu ręcznego');
  assert.match(t, /doUkladu\(ustawienia\.reczny, plyta\)/);
  assert.ok(
    !/problemyRozkroju\?\.length/.test(t),
    'układ z uwagami też ma iść do oferty — bez warunku'
  );
});

/* ════════════════════════════════════════════════════ magnes */

const PLYTA_1 = (elementy) => ({
  plyty: [{ nr: 1, szer: 3200, wys: 1600, margines: 0, elementy }],
});

test('magnes dosuwa element do krawędzi płyty', () => {
  /*
   * „Złap → przeciągnij → samo się równiutko dosunie" (Dawid, 7.10.2026).
   * Przy krawędzi płyty rzazu NIE MA — element może dojść do zera.
   */
  const model = PLYTA_1([{ id: 'a', nazwa: 'A', x: 0, y: 0, szer: 1000, gl: 600 }]);

  const przy = magnes(model, 'a', { x: 6, y: 4 }, { rzaz: 3, margines: 0 });
  assert.equal(przy.x, 0, 'lewa krawędź ma przyciągnąć');
  assert.equal(przy.y, 0, 'górna krawędź ma przyciągnąć');
  assert.ok(przy.linie.some((l) => l.os === 'x' && l.wartosc === 0), 'brak linii przyciągania');

  const daleko = magnes(model, 'a', { x: 400, y: 300 }, { rzaz: 3, margines: 0 });
  assert.equal(daleko.x, 400, 'poza zasięgiem magnes nie rusza elementu');
  assert.deepEqual(daleko.linie, []);
});

test('magnes dosuwa do prawej krawędzi i do marginesu', () => {
  const model = PLYTA_1([{ id: 'a', nazwa: 'A', x: 0, y: 0, szer: 1000, gl: 600 }]);

  const doPrawej = magnes(model, 'a', { x: 2195, y: 995 }, { rzaz: 3, margines: 0 });
  assert.equal(doPrawej.x, 2200, 'prawa krawędź: 3200 − 1000');
  assert.equal(doPrawej.y, 1000, 'dół: 1600 − 600');

  const zMarginesem = magnes(model, 'a', { x: 16, y: 16 }, { rzaz: 3, margines: 20 });
  assert.equal(zMarginesem.x, 20, 'przy marginesie element równa się do jego linii');
  assert.equal(zMarginesem.y, 20);
});

test('magnes dostawia element do sąsiada Z ODSTĘPEM NA RZAZ', () => {
  /*
   * To jest sedno: ręczne dosuwanie „na oko" kończyło się albo kolizją
   * o 1 mm, albo dziurą na 7 mm. Magnes stawia element dokładnie o grubość
   * cięcia dalej — tak, jak później pójdzie piła.
   */
  const model = PLYTA_1([
    { id: 'a', nazwa: 'A', x: 0, y: 0, szer: 1000, gl: 600 },
    { id: 'b', nazwa: 'B', x: 2000, y: 800, szer: 800, gl: 500 },
  ]);

  const dostawiony = magnes(model, 'b', { x: 1006, y: 4 }, { rzaz: 3, margines: 0 });
  assert.equal(dostawiony.x, 1003, 'B ma stać o rzaz za A (1000 + 3)');
  assert.equal(dostawiony.y, 0, 'i wyrównać się do górnej krawędzi');
  assert.deepEqual(sprawdz({ ...model, plyty: [{ ...model.plyty[0], elementy: [
    model.plyty[0].elementy[0],
    { ...model.plyty[0].elementy[1], x: dostawiony.x, y: dostawiony.y },
  ] }] }, { rzaz: 3, margines: 0 }), [], 'po dosunięciu układ ma być czysty');
});

test('magnes wyrównuje krawędź do krawędzi sąsiada', () => {
  const model = PLYTA_1([
    { id: 'a', nazwa: 'A', x: 500, y: 0, szer: 1000, gl: 600 },
    { id: 'b', nazwa: 'B', x: 2000, y: 900, szer: 800, gl: 500 },
  ]);
  const wyrownany = magnes(model, 'b', { x: 504, y: 900 }, { rzaz: 3, margines: 0 });
  assert.equal(wyrownany.x, 500, 'lewe krawędzie w jednej linii');
});

test('próg magnesu mieści się w obiecanych 5–10 mm', () => {
  assert.ok(PROG_MAGNESU_MM >= 5 && PROG_MAGNESU_MM <= 10, `próg to ${PROG_MAGNESU_MM} mm`);
});

test('uporzadkuj kasuje puste płyty, ale zostawia ostatnią jako miejsce odkładcze', () => {
  /*
   * Mniej przycisków: zamiast „− Pusta płyta" puste arkusze znikają same.
   * Ostatni zostaje, żeby było GDZIE przeciągnąć element z zatłoczonej płyty.
   */
  const model = {
    plyty: [
      { nr: 1, szer: 3200, wys: 1600, elementy: [] },
      { nr: 2, szer: 3200, wys: 1600, elementy: [{ id: 'a', nazwa: 'A', x: 0, y: 0, szer: 10, gl: 10 }] },
      { nr: 3, szer: 3200, wys: 1600, elementy: [] },
    ],
  };
  const po = uporzadkuj(model);
  assert.equal(po.plyty.length, 2, 'pusta ze środka znika, końcowa zostaje');
  assert.deepEqual(po.plyty.map((p) => p.nr), [1, 2]);
  assert.equal(po.plyty[0].elementy.length, 1);
  assert.deepEqual(po.plyty[1].elementy, []);
});

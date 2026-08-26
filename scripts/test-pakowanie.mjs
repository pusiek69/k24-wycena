/**
 * Testy pakowania odcinków blatu w płyty.
 *
 *   node --test scripts/test-pakowanie.mjs
 *   npm test
 *
 * Punkt wyjścia: zgłoszenie Dawida z sierpnia 2026 — trzy odcinki po 60 cm
 * głębokości na płycie 315 × 188 wychodziły jako DWIE płyty, choć trzy pasy
 * po 60 cm zajmują 180 z 188 cm. Winny był narzut procentowy nakładany
 * na wysokość pasów (180 × 1,15 = 207 > 188).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { upakuj, opisPlyt } from '../src/engine/pakowanie.js';

const plyta = (w, h, extra = {}) => ({ w, h, polowkaDozwolona: false, ...extra });

/* ─────────────────────────────────── zgłoszenie Dawida (przypadek wzorcowy) */

test('trzy odcinki po 60 cm mieszczą się na jednej płycie 315 × 188', () => {
  const p = upakuj(
    [
      { gl: 60, dl: 280 },
      { gl: 60, dl: 150 },
      { gl: 60, dl: 220 },
    ],
    plyta(315, 188)
  );
  assert.equal(p.plytyPelne, 1, '3 pasy × 60 cm = 180 cm ≤ 188 cm — jedna płyta');
  assert.equal(p.polowka, false);
  assert.equal(opisPlyt(p), '1 płyta');
  assert.ok(Math.abs(p.m2Blatu - 3.9) < 0.001);
  assert.deepEqual(p.ostrzezenia, [], 'nic nie wymaga łączenia');
});

test('ten sam blat kosztuje jedną płytę niezależnie od kolejności odcinków', () => {
  const warianty = [
    [{ gl: 60, dl: 280 }, { gl: 60, dl: 150 }, { gl: 60, dl: 220 }],
    [{ gl: 60, dl: 150 }, { gl: 60, dl: 220 }, { gl: 60, dl: 280 }],
    [{ gl: 60, dl: 220 }, { gl: 60, dl: 280 }, { gl: 60, dl: 150 }],
  ];
  for (const odc of warianty) {
    assert.equal(upakuj(odc, plyta(315, 188)).plytyPelne, 1);
  }
});

test('odcinki podane jako {dl: 60, gl: 280} liczą się tak samo', () => {
  // Klient bywa, że poda wymiary w odwrotnej kolejności — silnik normalizuje.
  const a = upakuj([{ gl: 60, dl: 280 }], plyta(315, 188));
  const b = upakuj([{ dl: 60, gl: 280 }], plyta(315, 188));
  assert.deepEqual(b, a);
});

/* ─────────────────────────────────────────────────── zapas na rzaz i obrzeże */

test('rzaz i obrzeże realnie zabierają miejsce', () => {
  // Płyta kwadratowa, żeby obrót niczego nie ratował i został sam rzaz.
  // Odcinki po 200 cm — dwa nie zmieszczą się obok siebie w jednym pasie
  // (200 + 1 + 200 > 300), więc każdy dostaje własny pas i test mierzy
  // dokładnie to, co ma mierzyć: piętrzenie pasów z rzazem.
  // 3 × 99 = 297, + 2 rzazy = 299 ≤ 300 → jedna płyta.
  assert.equal(upakuj(
    [{ gl: 99, dl: 200 }, { gl: 99, dl: 200 }, { gl: 99, dl: 200 }],
    plyta(300, 300)
  ).plytyPelne, 1);

  // 3 × 100 = 300, + 2 rzazy = 302 > 300 → już się NIE mieści.
  assert.equal(upakuj(
    [{ gl: 100, dl: 200 }, { gl: 100, dl: 200 }, { gl: 100, dl: 200 }],
    plyta(300, 300)
  ).plytyPelne, 2);
});

test('obrót płyty ratuje układ, gdy nie kosztuje łączenia', () => {
  // Wzdłuż boku 188: 3 × 64 + 2 rzazy = 194 > 188 → nie mieści się.
  // Wzdłuż boku 315: te same pasy mają 315 cm miejsca → jedna płyta.
  // Kawałki (100 cm) mieszczą się w obu układach, więc nic nie łączymy.
  const p = upakuj(
    [{ gl: 64, dl: 100 }, { gl: 64, dl: 100 }, { gl: 64, dl: 100 }],
    plyta(315, 188)
  );
  assert.equal(p.plytyPelne, 1);
  assert.equal(p.laczenia, 0);
});

test('dwa odcinki obok siebie w jednym pasie muszą zmieścić się z rzazem', () => {
  // 150 + 1 (rzaz) + 160 = 311 ≤ 315 długości płyty → jeden pas.
  const mieszczy = upakuj([{ gl: 60, dl: 150 }, { gl: 60, dl: 160 }], plyta(315, 188));
  assert.equal(mieszczy.plytyPelne, 1);

  // 160 + 1 + 155 = 316 > 315 → dwa pasy, ale nadal jedna płyta (121 ≤ 188).
  const dwaPasy = upakuj([{ gl: 60, dl: 160 }, { gl: 60, dl: 155 }], plyta(315, 188));
  assert.equal(dwaPasy.plytyPelne, 1);
});

/* ───────────────────────────────────────────────── przypadki brzegowe (Dawid) */

test('głębokość większa niż połowa szerokości płyty — dwa pasy się nie mieszczą', () => {
  // 100 + 1 + 100 = 201 > 188 → dwie płyty.
  // Obrót płyty zmieściłby to w jednej, ale kosztem przecięcia odcinka
  // 200 cm na pół — a łączenia unikamy, nawet gdy kosztuje płytę.
  const p = upakuj([{ gl: 100, dl: 200 }, { gl: 100, dl: 200 }], plyta(315, 188));
  assert.equal(p.plytyPelne, 2);
  assert.equal(p.laczenia, 0, 'wolimy dołożyć płytę niż spoinę w blacie');
});

test('głębokość przekraczająca szerokość płyty ostrzega o łączeniu', () => {
  const p = upakuj([{ gl: 200, dl: 250 }], plyta(315, 188));
  assert.ok(
    p.ostrzezenia.some((o) => /Głębokość/.test(o)),
    'brakuje ostrzeżenia o głębokości: ' + JSON.stringify(p.ostrzezenia)
  );
});

test('odcinek dłuższy niż płyta jest łączony i ostrzega', () => {
  const p = upakuj([{ gl: 60, dl: 420 }], plyta(315, 188));
  assert.ok(
    p.ostrzezenia.some((o) => /będzie łączony/.test(o)),
    'brakuje ostrzeżenia o łączeniu: ' + JSON.stringify(p.ostrzezenia)
  );
  assert.equal(p.laczenia, 1);
  // 315 + reszta 105 — dwa pasy po 60 cm, wciąż jedna płyta.
  assert.equal(p.plytyPelne, 1);
  assert.ok(Math.abs(p.mb - 4.2) < 0.001, 'metry bieżące liczone z całego odcinka');
});

test('odcinek mieszczący się dokładnie w płycie nie generuje łączenia', () => {
  const p = upakuj([{ gl: 60, dl: 315 }], plyta(315, 188));
  assert.deepEqual(p.ostrzezenia, []);
  assert.equal(p.plytyPelne, 1);
});

/* ──────────────────────────────────────────────────────── obrót płyty i pół */

test('silnik wybiera korzystniejszy obrót płyty', () => {
  // Odcinek 300 cm nie zmieści się wzdłuż boku 200, ale zmieści wzdłuż 330.
  const p = upakuj([{ gl: 60, dl: 300 }], plyta(200, 330));
  assert.equal(p.plytyPelne, 1);
  assert.deepEqual(p.ostrzezenia, [], 'obrót płyty pozwala uniknąć łączenia');
});

test('połówka płyty, gdy wolno ją kupić', () => {
  const p = upakuj([{ gl: 60, dl: 200 }], plyta(315, 188, { polowkaDozwolona: true }));
  assert.equal(p.polowka, true);
  assert.equal(p.plytyPelne, 0);
  assert.equal(opisPlyt(p), '½ płyty');
});

test('bez zgody na połówkę kupujemy całą płytę', () => {
  const p = upakuj([{ gl: 60, dl: 200 }], plyta(315, 188));
  assert.equal(p.polowka, false);
  assert.equal(p.plytyPelne, 1);
});

/* ───────────────────────────────────────────────────────────── dane zepsute */

test('brak odcinków nie wywraca silnika', () => {
  for (const wejscie of [[], null, undefined, [{ gl: 0, dl: 0 }], [{}]]) {
    const p = upakuj(wejscie, plyta(315, 188));
    assert.equal(p.plytyPelne, 0);
    assert.equal(p.m2Kupione, 0);
  }
});

test('płyta mniejsza niż obrzeże nie powoduje dzielenia przez zero', () => {
  const p = upakuj([{ gl: 60, dl: 100 }], plyta(1, 1));
  assert.ok(Number.isFinite(p.m2Kupione));
});

test('surowa płyta kamienia naturalnego traci obrzeże', () => {
  // Formaty z cenników są użytkowe — nic nie obcinamy.
  assert.equal(upakuj([{ gl: 60, dl: 300 }], plyta(300, 180)).laczenia, 0);

  // Magazyn podaje wymiar surowej płyty, więc 1 cm z każdej krawędzi schodzi
  // i blat 300 cm nie zmieści się już bez łączenia.
  assert.equal(upakuj([{ gl: 60, dl: 300 }], plyta(300, 180, { obrzeze: 1 })).laczenia, 1);
});

/* ────────────────────────────────────── uklad kawalkow na plytach (mail) */

test('uklad pokazuje, ktory odcinek trafia na ktora plyte', () => {
  // Prawdziwe zgloszenie (Paulina, sierpien 2026): 60x185 + 60x396 + 60x200
  // na plycie Technistone 318,5 x 155.
  const p = upakuj(
    [{ gl: 60, dl: 185 }, { gl: 60, dl: 396 }, { gl: 60, dl: 200 }],
    plyta(318.5, 155)
  );
  assert.equal(p.plytyPelne, 2);
  assert.equal(p.laczenia, 1, 'odcinek 396 cm nie miesci sie w plycie 318,5 cm');
  assert.equal(p.uklad.length, 2, 'uklad ma tyle wpisow, ile plyt');

  // Suma dlugosci wszystkich kawalkow = suma dlugosci odcinkow.
  const kawalki = p.uklad.flatMap((pl) => pl.pasy.flatMap((s) => s.elementy));
  const suma = kawalki.reduce((a, e) => a + e.dl, 0);
  assert.ok(Math.abs(suma - (185 + 396 + 200)) < 0.5, 'nic nie zginelo: ' + suma);

  // Odcinek nr 2 (396 cm) jest jedynym cietym i sklada sie z dwoch kawalkow.
  const ciete = kawalki.filter((e) => e.ciety);
  assert.equal(ciete.length, 2);
  assert.ok(ciete.every((e) => e.odcinek === 1), 'ciety jest tylko odcinek nr 2 (indeks 1)');

  // Zaden pas nie przekracza dlugosci plyty, zadna plyta swojej wysokosci.
  for (const pl of p.uklad) {
    assert.ok(pl.wysokoscUzyta <= pl.wysokoscPlyty + 0.1);
    for (const pas of pl.pasy) assert.ok(pas.zajete <= pas.dostepne + 0.1);
  }
});

test('uklad przechodzi przez JSON bez strat (leci do Workera)', () => {
  const p = upakuj([{ gl: 60, dl: 300 }, { gl: 60, dl: 180 }], plyta(318.5, 155));
  const poJson = JSON.parse(JSON.stringify(p.uklad));
  assert.deepEqual(poJson, p.uklad);
});

/* ═══ POŁÓWKI TYLKO WTEDY, GDY NAPRAWDĘ WCHODZĄ (Dawid, 26.08.2026) ═══
 *
 * Do tej pory wystarczyło, że pasy na ostatniej płycie nie przekraczały
 * połowy wysokości W TYM USTAWIENIU PŁYTY, które akurat wygrało. Przy
 * pasach ułożonych w poprzek „połowa" wypadała na 160 cm z boku 320 cm —
 * a połówka to zawsze 320 × 80. Skutek: wycena liczyła pół płyty mniej,
 * niż trzeba kupić, i różnicę dopłacałby Dawid z własnej kieszeni.
 *
 * Teraz decyduje PRZYMIARKA na arkuszu w × h/2 — ten sam moduł, którym
 * liczy rozrys.
 */

const POLOWKI = { w: 320, h: 160, polowkaDozwolona: true };

test('element głębszy niż połówka NIE daje połówki', () => {
  // 99 cm głębokości nie zejdzie na arkuszu głębokim na 80 cm w żadnej
  // orientacji: obrócony ma 160 cm wysokości, czyli dwa razy za dużo.
  const p = upakuj([{ gl: 99, dl: 160 }, { gl: 60, dl: 100 }], POLOWKI);
  assert.equal(p.polowka, false, 'to musi być pełna płyta');
  assert.equal(p.plytyPelne, 1);
});

test('płytki blat nadal schodzi na połówce', () => {
  const p = upakuj([{ gl: 60, dl: 300 }], POLOWKI);
  assert.equal(p.polowka, true);
  assert.equal(p.plytyPelne, 0);
  assert.equal(p.m2Kupione, 2.56);
});

test('przykład Dawida zostaje przy 1 i ½ płyty', () => {
  // Tu połówka JEST wykonalna (na ostatniej płycie leży sam blat 60 × 300),
  // więc poprawka nie ma prawa podnieść tej wyceny.
  const p = upakuj(
    [{ gl: 60, dl: 300 }, { gl: 60, dl: 320 }, { gl: 99, dl: 160 }, { gl: 60, dl: 100 }],
    POLOWKI
  );
  assert.equal(opisPlyt(p), '1 i ½ płyty');
});

test('wycena NIGDY nie liczy połówki, której nie da się wyciąć', async () => {
  /*
   * Sedno zgłoszenia, sprawdzone na siatce kuchni o MIESZANYCH głębokościach
   * — bo to one łamały starą regułę. Dla każdej wyceny z połówką bierzemy
   * kawałki z ostatniej płyty i sprawdzamy, czy zejdą na arkuszu w × h/2.
   */
  const { rozrysuj } = await import('../src/engine/nesting.js');
  const GL = [60, 62, 65, 80, 90, 99, 120];
  const DL = [80, 100, 120, 160, 200, 240, 260, 300, 320];

  let ziarno = 20260826;
  const los = () => ((ziarno = (ziarno * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

  const zanizone = [];
  for (let i = 0; i < 1500; i++) {
    const ile = 2 + Math.floor(los() * 3);
    const odcinki = Array.from({ length: ile }, () => ({
      gl: GL[Math.floor(los() * GL.length)],
      dl: DL[Math.floor(los() * DL.length)],
    }));
    const pak = upakuj(odcinki, POLOWKI);
    if (!pak.polowka) continue;

    const kawalki = pak.uklad
      .at(-1)
      .pasy.flatMap((pas, a) =>
        pas.elementy.map((e, b) => ({ nazwa: `k${a}-${b}`, szer: e.dl * 10, gl: e.gl * 10 }))
      );
    const proba = rozrysuj(kawalki, { szer: 3200, wys: 800 }, { rzaz: 3, margines: 0, maksPlyt: 1 });
    if (proba.nieumieszczone.length) {
      zanizone.push(odcinki.map((o) => `${o.gl}×${o.dl}`).join(' + '));
    }
  }

  assert.deepEqual(zanizone.slice(0, 5), [], 'wycena policzyła połówkę, której nie da się wyciąć');
});

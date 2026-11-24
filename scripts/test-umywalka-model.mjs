/**
 * MODEL UMYWALKI — formatki, granice i metry krawędzi.
 *
 *   node --test scripts/test-umywalka-model.mjs
 *
 * Geometria pochodzi z projektu Dawida: zna dwa zlewy z mostkiem, wstawkę,
 * płytę spadkową i dno z wycinki blatu. Te testy pilnują, żeby przy
 * przenoszeniu do repozytorium nic z tego nie wypadło — i żeby metry
 * bieżące krawędzi liczyły się z bokami, a nie samym przodem.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STAN_DOMYSLNY,
  maksUmywalek,
  iloscPodblatowych,
  iloscMisek,
  zOtworem,
  zacisnij,
  limity,
  formatki,
  odcinki,
  mbPogrubienia,
  m2Blatu,
  ranty,
  bryly,
  srodkiZlewow,
  szerokoscZlewu,
  grube,
  opisKonfiguracji,
} from '../src/umywalka/model.js';

const stan = (zmiany = {}) => zacisnij({ ...STAN_DOMYSLNY, ...zmiany });
const pole = (lista) => Math.round(lista.reduce((s, x) => s + x.m, 0) * 1000) / 1000;
const wg = (lista, k) => lista.find((x) => x.k === k);

/* ═══════════════════════════════════════════ formatki */

test('120 × 50, jeden zlew, oba boki → 7 wierszy, 10 sztuk, 1,685 m²', () => {
  // Siedem WIERSZY, bo pogrubienie boków to jedna pozycja w dwóch sztukach —
  // dokładnie tak, jak pokazywał projekt Dawida („7 formatek", 10 kawałków).
  const f = formatki(stan({ L: 120, W: 50, H: 15, sL: 100, sW: 35, ins: 5 }));

  assert.equal(f.length, 7);
  assert.equal(f.reduce((s, x) => s + x.q, 0), 10);
  assert.equal(pole(f), 1.685);
});

test('rozbicie 120 × 50 element po elemencie', () => {
  const f = formatki(stan({ L: 120, W: 50, H: 15, sL: 100, sW: 35, ins: 5 }));
  const wymiar = (k) => [wg(f, k).a, wg(f, k).b, wg(f, k).q];

  assert.deepEqual(wymiar('top'), [120, 50, 1]);
  assert.deepEqual(wymiar('front'), [120, 15, 1]);
  assert.deepEqual(wymiar('side'), [50, 15, 2]);
  assert.deepEqual(wymiar('wl'), [100, 15, 2]);
  assert.deepEqual(wymiar('ws'), [35, 15, 2]);
  assert.deepEqual(wymiar('slope'), [100, 30, 1]);
  assert.deepEqual(wymiar('ins'), [100, 5, 1]);
});

test('dwa zlewy: podwojone ścianki, dna i wstawki', () => {
  const f = formatki(stan({ L: 160, W: 50, n: 2, sL: 65, gap: 15 }));
  assert.equal(wg(f, 'wl').q, 4);
  assert.equal(wg(f, 'ws').q, 4);
  assert.equal(wg(f, 'slope').q, 2);
  assert.ok(wg(f, 'top').n.includes('2 otworami'));
});

test('blat pod umywalkę nablatową: żadnych ścianek ani dna', () => {
  const f = formatki(stan({ mode: 'top', L: 120, W: 50, H: 15 }));
  assert.equal(f.length, 3);
  for (const k of ['wl', 'ws', 'slope', 'ins']) assert.equal(wg(f, k), undefined, k);
});

test('cienka krawędź (bez pogrubienia) zostawia sam blat', () => {
  // Przy nablatowej krawędź może zejść do grubości płyty.
  const s = stan({ mode: 'top', L: 120, W: 50, grubosc: '20', H: 2 });
  assert.equal(grube(s), false);
  assert.equal(formatki(s).length, 1);
  assert.equal(mbPogrubienia(s), 0);
});

/* ═══════════════════════════════════════════ trzy rodzaje umywalek */

test('podblatowa: otwór w blacie, bez ścianek niecki', () => {
  // Zlecenie Dawida (24.11.2026): „dodaj tez mozliwosc kilku umywalek
  // nablatowych lub podblatowych (nie wchodzą w cene umywalki)".
  const s = stan({ mode: 'under', L: 120, W: 50, H: 15, sL: 55, sW: 38 });
  const f = formatki(s);

  assert.equal(zOtworem(s), true, 'w blacie wycinamy otwór');
  assert.equal(iloscPodblatowych(s), 1);
  assert.equal(iloscMisek(s), 1, 'miska jest, tylko nie z kamienia');
  assert.equal(wg(f, 'wl'), undefined, 'podblatowa nie ma ścianek z kamienia');
  assert.match(wg(f, 'top').n, /otworem pod umywalkę/);
});

test('nablatowa: pełny blat, miski stoją na wierzchu', () => {
  const s = stan({ mode: 'top', L: 120, W: 50, H: 15 });
  assert.equal(zOtworem(s), false);
  assert.equal(iloscPodblatowych(s), 0);
  assert.equal(iloscMisek(s), 1);
  assert.equal(wg(formatki(s), 'top').n, 'Blat');
});

test('kilka umywalek: do trzech, ale tylko gdy jest gdzie je postawić', () => {
  assert.equal(maksUmywalek(stan({ mode: 'top', L: 240, sL: 45, gap: 15 })), 3);
  // Dwie miski po 45 cm z odstępem 15 i rantami po 10 potrzebują 125 cm —
  // na 130 się mieszczą, na 120 już nie. Granica jest policzona, nie zgadnięta.
  assert.equal(maksUmywalek(stan({ mode: 'top', L: 130, sL: 45, gap: 15 })), 2);
  assert.equal(maksUmywalek(stan({ mode: 'top', L: 120, sL: 45, gap: 15 })), 1);
  // Zlew wycięty w kamieniu zostaje przy dwóch — dwie niecki z mostkiem
  // to już cała szerokość typowego blatu łazienkowego.
  assert.equal(maksUmywalek(stan({ mode: 'int', L: 300 })), 2);
});

test('za dużo umywalek jak na blat — liczba przycina się sama', () => {
  assert.equal(stan({ mode: 'top', L: 100, sL: 45, gap: 15, n: 3 }).n, 1);
  assert.equal(stan({ mode: 'top', L: 240, sL: 45, gap: 15, n: 3 }).n, 3);
  assert.equal(stan({ mode: 'int', L: 300, n: 3 }).n, 2);
});

test('trzy miski dostają trzy środki, równo rozstawione', () => {
  const s = stan({ mode: 'top', L: 240, W: 50, sL: 45, gap: 15, n: 3 });
  const c = srodkiZlewow(s);
  assert.equal(c.length, 3);
  assert.ok(Math.abs(c[0] + c[2]) < 0.01, 'rozstaw ma być symetryczny');
  assert.ok(Math.abs(c[1]) < 0.01, 'środkowa miska na środku blatu');
  assert.ok(Math.abs(c[1] - c[0] - (45 + 15)) < 0.01, 'odstęp między miskami');
});

test('bryła podblatowej: otwór w blacie i miska pod nim', () => {
  const b = bryly(stan({ mode: 'under', L: 120, W: 50, H: 15, sL: 55, sW: 38 }));
  const miski = b.filter((x) => x.obj === 'bowl');
  assert.equal(miski.length, 1);
  assert.equal(miski[0].pod, true, 'miska ma wisieć pod blatem');
  // Blat jest rozbity na kawałki wokół otworu — jak przy zlewie w kamieniu.
  assert.ok(b.filter((x) => x.k === 'top').length > 1);
});

test('bryła nablatowej z trzema miskami', () => {
  const b = bryly(stan({ mode: 'top', L: 240, W: 50, sL: 45, gap: 15, n: 3 }));
  const miski = b.filter((x) => x.obj === 'bowl');
  assert.equal(miski.length, 3);
  assert.ok(miski.every((m) => !m.pod));
  assert.equal(b.filter((x) => x.k === 'top').length, 1, 'blat bez otworów to jeden kawałek');
});

/* ═══════════════════════════════════════════ metry krawędzi */

test('metry krawędzi to przód PLUS pogrubione boki', () => {
  assert.equal(mbPogrubienia(stan({ L: 120, W: 50, H: 15 })), 2.2);
  assert.equal(mbPogrubienia(stan({ L: 120, W: 50, H: 15, right: false })), 1.7);
  assert.equal(mbPogrubienia(stan({ L: 120, W: 50, H: 15, left: false, right: false })), 1.2);
});

/* ═══════════════════════════════════════════ dno z wycinki */

test('dno z wycinki blatu nie wchodzi do zakupu materiału', () => {
  const bez = odcinki(stan({ L: 120, W: 50, reuse: false }));
  const zWycinki = odcinki(stan({ L: 120, W: 50, reuse: true }));

  assert.equal(bez.length, 10);
  // Odpada płyta spadkowa i wstawka — zostaje osiem sztuk.
  assert.equal(zWycinki.length, 8);
  assert.ok(formatki(stan({ reuse: true })).find((x) => x.k === 'slope').cut);
});

/* ═══════════════════════════════════════════ granice */

test('zlew nie może być szerszy niż blat minus 10 cm', () => {
  const s = stan({ L: 100, sL: 999 });
  assert.equal(s.sL, 90);
});

test('skrócenie blatu przycina zlew razem z nim', () => {
  const s = stan({ L: 120, sL: 100 });
  const krotszy = zacisnij({ ...s, L: 80 });
  assert.ok(krotszy.sL <= 70, `sL = ${krotszy.sL}`);
});

test('przy zlewie w kamieniu krawędź ma co najmniej 15 cm', () => {
  assert.equal(limity(stan())['H'][0], 15);
  assert.equal(stan({ H: 2 }).H, 15);
});

test('mostek liczy się tylko przy dwóch zlewach', () => {
  const dwa = stan({ L: 160, n: 2, sL: 65, gap: 15 });
  assert.equal(srodkiZlewow(dwa).length, 2);
  assert.equal(srodkiZlewow(stan({ n: 1 })).length, 1);
  assert.equal(szerokoscZlewu(dwa, 160) <= (160 - 20 - 15) / 2, true);
});

test('liczba otworów trzyma się zakresu 0–3', () => {
  assert.equal(stan({ holes: 9 }).holes, 3);
  assert.equal(stan({ holes: -2 }).holes, 0);
});

/* ═══════════════════════════════════════════ rant i opis */

test('rant liczy się od zlewu do krawędzi blatu', () => {
  const r = ranty(stan({ L: 120, W: 50, sL: 100, sW: 35 }));
  assert.equal(r.bok, 10);
  assert.equal(r.przod, 7.5);
});

test('powierzchnia blatu w m² — od niej liczy się montaż', () => {
  assert.equal(m2Blatu(stan({ L: 120, W: 50 })), 0.6);
});

test('opis konfiguracji mówi ludzkim językiem, bez żargonu', () => {
  const opis = opisKonfiguracji(stan({ L: 120, W: 50, H: 15 }));
  assert.match(opis, /120 × 50 cm/);
  assert.match(opis, /zlew wycięty w kamieniu/);
  assert.match(opis, /z montażem/);
  for (const zargon of ['formatk', 'nesting', 'rozkr', 'm.b.']) {
    assert.ok(!opis.includes(zargon), `w opisie nie powinno być „${zargon}"`);
  }
});

/* ═══════════════════════════════════════════ bryły do podglądu */

test('bryła ma blat, pogrubienia, ścianki i baterię', () => {
  const b = bryly(stan({ L: 120, W: 50, H: 15, holes: 1 }));
  const rodzaje = new Set(b.map((x) => x.k));
  for (const k of ['top', 'front', 'side', 'wl', 'ws', 'slope', 'ins', 'tap']) {
    assert.ok(rodzaje.has(k), `brak bryły „${k}"`);
  }
  // Każda bryła ma wymiar i środek — inaczej scena 3D by się wywróciła.
  for (const x of b) {
    if (x.obj) continue;
    assert.equal(x.s.length, 3, x.k);
    assert.ok(x.s.every((v) => v > 0), `${x.k}: ${x.s}`);
  }
});

test('nablatowa dostaje ceramiczną misę zamiast ścianek', () => {
  const b = bryly(stan({ mode: 'top', L: 120, W: 50, H: 15 }));
  assert.ok(b.some((x) => x.obj === 'bowl'));
  assert.ok(!b.some((x) => x.k === 'wl'));
});

test('numery formatek zgadzają się z rodzajami brył', () => {
  const s = stan({ L: 120, W: 50, H: 15 });
  const numery = new Set(formatki(s).map((f) => f.k));
  const wBrylach = new Set(bryly(s).filter((b) => !b.obj && !b.dark).map((b) => b.k));
  for (const k of wBrylach) {
    assert.ok(numery.has(k), `bryła „${k}" nie ma swojego wiersza w formatkach`);
  }
});


/* ═══════════════════════════ misa podblatowa — wisi, a nie stoi na głowie */

/*
 * ZGŁOSZENIE DAWIDA (24.11.2026): „zle jest wykonany podblatowy
 * wizualizacja jest błędna". Misę wieszała ujemna skala, przez co pod
 * otworem sterczał jej okrągły SPÓD (z góry wyglądało to jak kopuła),
 * rant zwisał na dole, a odbite normalne oświetlały ceramikę od środka.
 * Druga rzecz wyszła dopiero na podglądzie po poprawce: okrągła misa
 * wpisana w prostokątne wycięcie zostawiała w rogach dziury na wylot.
 */
const { obrysMisy, promienObrysu, PROFIL_MISY, bryly: bryly2, plytaCm } = await import(
  '../src/umywalka/model.js'
);

const OTWORY = [
  [30, 20],
  [40, 28],
  [50, 35],
  [80, 40],
  [135, 44],
];

test('rant misy podblatowej siada na płaszczyźnie zaczepienia', () => {
  const m = obrysMisy(stan({ mode: 'under', sL: 50, sW: 35 }));
  // Grupa stoi na spodzie płyty, więc rant musi wypaść dokładnie na 0.
  assert.equal(Math.round((m.dy + PROFIL_MISY.rant * m.sy) * 1e6) / 1e6, 0);
});

test('misa wisi POD płytą — ani jeden punkt nie wychodzi nad nią', () => {
  for (const [sL, sW] of OTWORY) {
    const m = obrysMisy(stan({ mode: 'under', sL, sW }));
    // (wymiary bierzemy z zaciśniętego stanu — patrz niżej)
    assert.equal(m.dy + PROFIL_MISY.rant * m.sy, 0, `${sL}×${sW}: rant ponad kamieniem`);
    assert.ok(m.dy < 0, `${sL}×${sW}: misa nie wisi, tylko leży na płycie`);
    assert.ok(m.sy > 0, `${sL}×${sW}: ujemna skala odwraca normalne`);
  }
});

test('rant zakrywa cały otwór — razem z rogami', () => {
  // Tego nie łapał poprzedni test: owal dotyka boków prostokąta, ale
  // w rogach zostawia dziurę. Sprawdzamy obrys dookoła, co 2 stopnie.
  for (const [zadaneL, zadaneW] of OTWORY) {
    // Granice wymiarów pilnuje `zacisnij` — porównujemy z otworem,
    // który naprawdę powstanie, nie z tym, o który poprosiliśmy.
    const S = stan({ mode: 'under', sL: zadaneL, sW: zadaneW });
    const { sL, sW } = S;
    const m = obrysMisy(S);
    for (let deg = 0; deg < 360; deg += 2) {
      const kat = (deg * Math.PI) / 180;
      const r = promienObrysu(kat, m.a, m.b);
      const x = Math.abs(r * Math.cos(kat));
      const z = Math.abs(r * Math.sin(kat));
      // Punkt obrysu wychodzi poza prostokąt otworu tylko wtedy, gdy
      // rant naprawdę leży na kamieniu — inaczej w tym kierunku szpara.
      const naKamieniu = x >= sL / 2 || z >= sW / 2;
      assert.ok(naKamieniu, `${sL}×${sW}: szpara przy ${deg}° (x=${x.toFixed(1)} z=${z.toFixed(1)})`);
    }
  }
});

test('rant nie rozlewa się poza wycięcie bardziej niż o zakładkę', () => {
  for (const [zadaneL, zadaneW] of OTWORY) {
    const S = stan({ mode: 'under', sL: zadaneL, sW: zadaneW });
    const { sL, sW } = S;
    const m = obrysMisy(S);
    assert.ok(2 * m.a > sL && 2 * m.a < sL * 1.12, `${sL}×${sW}: zła długość rantu`);
    assert.ok(2 * m.b > sW && 2 * m.b < sW * 1.12, `${sL}×${sW}: zła szerokość rantu`);
    // Rant ma zniknąć POD kamieniem, a nie wystawać poza blat.
    assert.ok(2 * m.a <= S.L, `${sL}×${sW}: misa dłuższa od blatu`);
    assert.ok(2 * m.b <= S.W, `${sL}×${sW}: misa głębsza od blatu`);
  }
});

test('obrys jest zaokrąglonym prostokątem, nie kołem i nie kantem', () => {
  const m = obrysMisy(stan({ mode: 'under', sL: 50, sW: 35 }));
  const bok = promienObrysu(0, m.a, m.b);
  const rog = promienObrysu(Math.PI / 4, m.a, m.b);
  assert.equal(Math.round(bok * 100) / 100, Math.round(m.a * 100) / 100, 'w osi obrys to półoś');
  // Róg superelipsy leży dalej niż róg elipsy, ale bliżej niż kant prostokąta.
  const elipsa = 1 / Math.hypot(Math.cos(Math.PI / 4) / m.a, Math.sin(Math.PI / 4) / m.b);
  const prostokat = Math.hypot(m.a, m.b);
  assert.ok(rog > elipsa, 'obrys spłaszczony jak elipsa — rogi zostaną puste');
  assert.ok(rog < prostokat, 'obrys ostry jak prostokąt — to nie umywalka');
});

test('głębokość misy mieści się między miseczką a wiadrem', () => {
  for (const [sL, sW] of OTWORY) {
    const { glebokosc } = obrysMisy(stan({ mode: 'under', sL, sW }));
    assert.ok(glebokosc >= 7 && glebokosc <= 15, `${sL}×${sW}: głębokość ${glebokosc} cm`);
  }
});

test('misa zaczepia się o spód płyty, nie o jej wierzch', () => {
  const S = stan({ mode: 'under', L: 120, W: 50, H: 15, sL: 50, sW: 35 });
  const misa = bryly2(S).find((b) => b.k === 'bowl');
  assert.ok(misa, 'brak misy w bryle');
  assert.equal(misa.pod, true);
  assert.equal(misa.p[1], S.H - plytaCm(S), 'misa nie wisi na spodzie płyty');
  assert.equal(misa.p[2], 0, 'misa nie jest wyśrodkowana w otworze');
});

test('każda podblatowa dostaje własną misę pod własnym otworem', () => {
  const S = stan({ mode: 'under', L: 240, W: 50, n: 3, sL: 45, sW: 35, gap: 15 });
  const miski = bryly2(S).filter((b) => b.k === 'bowl');
  assert.equal(miski.length, 3);
  const srodki = miski.map((b) => b.p[0]).sort((a, b) => a - b);
  assert.equal(Math.round(srodki[1] - srodki[0]), Math.round(srodki[2] - srodki[1]));
  assert.ok(srodki[0] < 0 && srodki[2] > 0, 'miski nie rozkładają się na blacie');
  for (const m of miski) assert.equal(m.pod, true);
});

test('nablatowa zostaje okrągła i stoi NA kamieniu', () => {
  const S = stan({ mode: 'top', L: 120, W: 50, H: 15, sL: 50, sW: 35 });
  const misa = bryly2(S).find((b) => b.k === 'bowl');
  assert.equal(misa.pod, false);
  assert.equal(misa.p[1], S.H, 'nablatowa nie stoi na wierzchu płyty');
});

/* ═══════════════════════════ podpis na wizualizacji */

/*
 * Na renderze dla klienta (ten sam obrazek leci załącznikiem do maila)
 * stała druga kopia opisu — nie znała trybu „under" i przy dwóch
 * podblatowych pisała „Blat pod umywalkę nablatową". Zła nazwa produktu
 * na obrazku, który klient pokazuje w domu. Teraz opis jest jeden.
 */
const { podpisUmywalki } = await import('../src/umywalka/model.js');

test('podpis renderu nazywa rodzaj umywalki zgodnie z konfiguracją', () => {
  const p = (z) => podpisUmywalki(stan(z));

  assert.match(p({ mode: 'int', n: 1 }), /^Zlew wycięty w kamieniu · /);
  assert.match(p({ mode: 'int', n: 2, L: 240, sL: 60 }), /^Dwa zlewy wycięte w kamieniu · /);

  assert.match(p({ mode: 'under', n: 1 }), /^Otwór pod umywalkę podblatową · /);
  assert.match(p({ mode: 'under', n: 2, L: 200, sL: 45, gap: 15 }), /^Dwa otwory pod umywalki podblatowe · /);
  assert.match(p({ mode: 'under', n: 3, L: 240, sL: 45, gap: 15 }), /^Trzy otwory pod umywalki podblatowe · /);

  assert.equal(p({ mode: 'top', n: 1 }), 'Blat pod umywalkę nablatową');
  assert.equal(p({ mode: 'top', n: 2, L: 200, sL: 45, gap: 15 }), 'Blat pod dwa umywalki nablatowe');
});

test('podpis podblatowej NIGDY nie mówi „nablatową"', () => {
  // To był dokładnie ten błąd: render podblatowej z nazwą nablatowej.
  for (const n of [1, 2, 3]) {
    const p = podpisUmywalki(stan({ mode: 'under', n, L: 240, sL: 45, gap: 15 }));
    assert.ok(!/nablatow/i.test(p), `${n} umywalki: podpis mówi o nablatowej — „${p}"`);
    assert.match(p, /podblatow/i, `${n} umywalki: podpis nie mówi, że podblatowa`);
  }
});

test('podpis podaje wymiar wycięcia, a przy kilku — że każdego', () => {
  assert.match(podpisUmywalki(stan({ mode: 'under', n: 1, sL: 50, sW: 35 })), /50 × 35 cm$/);
  assert.match(
    podpisUmywalki(stan({ mode: 'under', n: 2, L: 200, sL: 45, sW: 35, gap: 15 })),
    /45 × 35 cm każdy$/
  );
});

/* ═══════════════════════════ szerokość wycięcia przy zmianach */

/*
 * Jedna reguła obsługiwała zlew kuty w kamieniu i kupioną ceramikę, więc
 * wybranie dwóch umywalek podblatowych na blacie 200 cm rozdmuchiwało
 * otwór z 45 do 82,5 cm każdy — razem z ceną wycięć i rysunkiem, na
 * którym stały dwa koryta (podgląd, 24.11.2026).
 */
const { szerokoscWyciecia, szerokoscPoZmianieTypu, CERAMIKA_MAKS } = await import(
  '../src/umywalka/model.js'
);

test('zlew kuty w kamieniu dalej wypełnia blat', () => {
  const S = stan({ mode: 'int', L: 200, n: 2, gap: 15 });
  // Mostek bierzemy z zaciśniętego stanu — `limity` potrafi go przyciąć.
  assert.equal(szerokoscWyciecia(S, 200), Math.floor(((200 - 20 - S.gap) / 2) * 2) / 2);
  assert.ok(szerokoscWyciecia(S, 200) > 80, 'zlew w kamieniu ma wypełniać blat');
});

test('kupiona ceramika zostaje przy swoim rozmiarze', () => {
  for (const mode of ['under', 'top']) {
    const S = stan({ mode, L: 200, n: 1, sL: 45, gap: 15 });
    S.n = 2;
    assert.equal(szerokoscWyciecia(S, 200), 45, `${mode}: wycięcie urosło przy zmianie liczby`);
  }
});

test('ceramika zmniejsza się tylko wtedy, gdy przestaje się mieścić', () => {
  const S = stan({ mode: 'under', L: 200, n: 1, sL: 55, gap: 15 });
  S.n = 3;
  // (200 - 10 - 2×15) / 3 = 53,33 — czyli mniej niż 55, więc musi zejść.
  const w = szerokoscWyciecia(S, 200);
  assert.ok(w < 55 && w > 50, `oczekiwałem lekkiego zejścia, jest ${w}`);
});

test('przy zmianie typu zlew nie przenosi swojego rozmiaru na ceramikę', () => {
  // Zlew w kamieniu bywa i stucentymetrowy; umywalka z katalogu nie.
  const S = stan({ mode: 'int', L: 240, n: 1, sL: 220 });
  S.mode = 'under';
  assert.equal(szerokoscPoZmianieTypu(S), CERAMIKA_MAKS);
  S.mode = 'top';
  assert.equal(szerokoscPoZmianieTypu(S), CERAMIKA_MAKS);
});

test('powrót na zlew w kamieniu znów wypełnia blat', () => {
  const S = stan({ mode: 'top', L: 200, n: 1, sL: 45 });
  S.mode = 'int';
  assert.equal(szerokoscPoZmianieTypu(S), 180);
});

test('umywalka mniejsza od granicy przeżywa przełączenie typu', () => {
  const S = stan({ mode: 'top', L: 200, n: 1, sL: 45 });
  S.mode = 'under';
  assert.equal(szerokoscPoZmianieTypu(S), 45);
});

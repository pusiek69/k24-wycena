/**
 * PODPOWIEDZI TAŃSZYCH MATERIAŁÓW W PODOBNYM KOLORZE.
 *
 *   node --test scripts/test-podpowiedzi.mjs
 *
 * Zlecenie Dawida (26.08.2026) — odpowiedź na „za drogo".
 *
 * Testy pilnują trzech rzeczy, na których ta funkcja stoi:
 *   • podpowiedź jest ZAWSZE tańsza (inaczej nie jest odpowiedzią),
 *   • kolor decyduje przed pieniędzmi (inaczej zawsze wypadałby
 *     najtańszy dekor katalogu, niezależnie od wyboru klienta),
 *   • propozycje są różne — trzy dekory tej samej marki w tej samej
 *     cenie to jedna propozycja pokazana trzy razy.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { kolorDekoru, odlegloscKoloru, nazwaTagu, RECZNE } from '../src/app/kolory-dekorow.js';
import { tanszeAlternatywy, MINIMALNA_OSZCZEDNOSC } from '../src/app/podpowiedzi.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ═══════════════════════════════════════════════ kolor z nazwy dekoru */

test('konwencje nazewnicze kamienia są rozpoznawane', () => {
  const oczekiwane = {
    'Calacatta Cannes Gold': 'biel-zyla',
    'Statuario Lille': 'biel-zyla',
    'Bianco Carrara Polished': 'biel-zyla',
    'Absolute White': 'biel',
    'Neve Brushed': 'biel',
    'Nero Marquina': 'antracyt',
    Raven: 'antracyt',
    'Badal Grey': 'szary',
    'Moorland Fog': 'szary',
    'Royal Beige': 'krem-bez',
    'Marble Look Emperador Lux': 'krem-bez',
    'Boost Tarmac Hammered': 'beton',
    Driftwood: 'drewno',
  };
  for (const [nazwa, tag] of Object.entries(oczekiwane)) {
    assert.equal(kolorDekoru(nazwa), tag, nazwa);
  }
});

test('czerń wygrywa z marmurową żyłą — KOLEJNOŚĆ reguł ma znaczenie', () => {
  // „Black Carrara" to kamień czarny z białym rysunkiem. Klient widzi
  // czerń, więc podpowiadanie go przy bieli byłoby pomyłką.
  assert.equal(kolorDekoru('Black Carrara Polished'), 'antracyt');
  assert.equal(kolorDekoru('Blue Stone Negro'), 'antracyt');
});

test('nazwa miejscowości nie daje koloru — i dobrze', () => {
  // Zgadywanie koloru z „Dijon" wyglądałoby na pewne, a prowadziłoby
  // Dawida w maliny. Lepszy jawny brak oznaczenia.
  for (const n of ['Dijon', 'Amiens', 'Clermont', 'Glencoe']) {
    assert.equal(kolorDekoru(n), 'nieznany', n);
  }
});

test('pusta nazwa nie wywraca klasyfikacji', () => {
  for (const x of ['', null, undefined, 123]) assert.equal(kolorDekoru(x), 'nieznany');
});

test('ręczna mapa ma pierwszeństwo przed regułami', () => {
  RECZNE['test-firma/Absolute White'] = 'szary';
  try {
    assert.equal(kolorDekoru('Absolute White', 'test-firma'), 'szary');
    assert.equal(kolorDekoru('Absolute White', 'inna'), 'biel', 'inne firmy bez zmian');
  } finally {
    delete RECZNE['test-firma/Absolute White'];
  }
});

test('każdy tag ma nazwę do pokazania Dawidowi', () => {
  // Część tagów ma etykietę równą identyfikatorowi („biel", „szary") —
  // to w porządku. Pilnujemy tylko, żeby żaden nie pokazał się jako
  // techniczny skrót w rodzaju „biel-zyla".
  const tagi = ['biel', 'biel-zyla', 'krem-bez', 'szary', 'antracyt', 'beton', 'drewno', 'kolor', 'nieznany'];
  for (const t of tagi) {
    const nazwa = nazwaTagu(t);
    assert.ok(nazwa, t);
    assert.ok(!nazwa.includes('-'), `${t} pokazuje się jako skrót techniczny: ${nazwa}`);
  }
});

/* ─────────────────────────────────────────────── odległość kolorów */

test('ten sam kolor to zero, biel i biel z żyłą blisko', () => {
  assert.equal(odlegloscKoloru('biel', 'biel'), 0);
  assert.equal(odlegloscKoloru('biel', 'biel-zyla'), 1);
  assert.equal(odlegloscKoloru('szary', 'antracyt'), 1);
});

test('odległość jest symetryczna', () => {
  const tagi = ['biel', 'biel-zyla', 'krem-bez', 'szary', 'antracyt', 'beton', 'drewno', 'kolor'];
  for (const a of tagi) {
    for (const b of tagi) {
      assert.equal(odlegloscKoloru(a, b), odlegloscKoloru(b, a), `${a} - ${b}`);
    }
  }
});

test('nieznany jest daleko od wszystkiego, także od siebie', () => {
  // Dwa dekory bez oznaczenia nie są „tym samym kolorem" — nie wiemy tego.
  assert.ok(odlegloscKoloru('nieznany', 'biel') >= 3);
  assert.ok(odlegloscKoloru('nieznany', 'nieznany') >= 3);
});

/* ═══════════════════════════════════════════════════ dobór podpowiedzi */

const k = (firma, dekor, razem, kolor, typ = 'konglomerat kwarcowy') => ({
  firma,
  firmaNazwa: firma,
  typ,
  dekor,
  grubosc: '20',
  razem,
  kolor,
});

test('podpowiadamy WYŁĄCZNIE tańsze', () => {
  const p = tanszeAlternatywy({
    kolorGlowny: 'biel',
    cenaObecna: 10000,
    kandydaci: [k('a', 'Tanszy', 7000, 'biel'), k('b', 'Drozszy', 12000, 'biel')],
  });
  assert.equal(p.length, 1);
  assert.equal(p[0].dekor, 'Tanszy');
  assert.equal(p[0].oszczednosc, 3000);
});

test('grosze to nie odpowiedź na „za drogo"', () => {
  const p = tanszeAlternatywy({
    kolorGlowny: 'biel',
    cenaObecna: 10000,
    kandydaci: [k('a', 'Ledwie tanszy', 10000 - (MINIMALNA_OSZCZEDNOSC - 1), 'biel')],
  });
  assert.deepEqual(p, []);
});

test('kolor decyduje PRZED pieniędzmi', () => {
  /*
   * Gdyby rządziła oszczędność, przy każdej wycenie wypadałby ten sam
   * najtańszy dekor katalogu — bez związku z tym, co wybrał klient.
   */
  const p = tanszeAlternatywy({
    kolorGlowny: 'biel',
    cenaObecna: 10000,
    kandydaci: [
      k('a', 'Czarny bardzo tani', 4000, 'antracyt'),
      k('b', 'Bialy troche tanszy', 9000, 'biel'),
    ],
  });
  assert.equal(p[0].dekor, 'Bialy troche tanszy');
  assert.equal(p[0].dopasowanie, 'ten sam kolor');
});

test('dobór sięga po różne marki i różne rodzaje materiału', () => {
  const p = tanszeAlternatywy({
    kolorGlowny: 'biel',
    cenaObecna: 10000,
    kandydaci: [
      k('avant', 'A1', 8000, 'biel'),
      k('avant', 'A2', 7900, 'biel'),
      k('avant', 'A3', 7800, 'biel'),
      k('keralini', 'K1', 7000, 'biel', 'spiek'),
      k('marazzi', 'M1', 6900, 'biel', 'gres'),
    ],
  });
  assert.equal(p.length, 3);
  assert.equal(new Set(p.map((x) => x.firma)).size, 3, 'trzy różne marki');
  assert.equal(new Set(p.map((x) => x.typ)).size, 3, 'trzy różne rodzaje');
});

test('bliźniaki z jednej marki w tej samej cenie liczą się raz', () => {
  // Kolekcje mają po kilkanaście dekorów w jednej cenie — trzy wiersze
  // różniące się wyłącznie nazwą wyglądają na błąd programu.
  const p = tanszeAlternatywy({
    kolorGlowny: 'biel',
    cenaObecna: 10000,
    kandydaci: [k('a', 'Bliźniak 1', 7000, 'biel'), k('a', 'Bliźniak 2', 7000, 'biel')],
  });
  assert.equal(p.length, 1);
});

test('nie podpowiadamy tego, co już jest na stole', () => {
  const p = tanszeAlternatywy({
    kolorGlowny: 'biel',
    cenaObecna: 10000,
    kandydaci: [k('a', 'Juz wariant', 7000, 'biel'), k('b', 'Nowy', 7500, 'biel')],
    pomijaj: ['a/Juz wariant'],
  });
  assert.equal(p.length, 1);
  assert.equal(p[0].dekor, 'Nowy');
});

test('brak koloru jest OZNACZONY, a nie przemilczany', () => {
  const p = tanszeAlternatywy({
    kolorGlowny: 'nieznany',
    cenaObecna: 10000,
    kandydaci: [k('a', 'Cokolwiek', 7000, 'szary')],
  });
  assert.equal(p[0].dopasowanie, 'podobna cena, dowolny kolor');
});

test('bez ceny głównej nie ma podpowiedzi', () => {
  for (const c of [0, null, undefined, -5]) {
    const p = tanszeAlternatywy({
      kolorGlowny: 'biel',
      cenaObecna: c,
      kandydaci: [k('a', 'X', 1, 'biel')],
    });
    assert.deepEqual(p, []);
  }
});

test('nigdy więcej niż trzy', () => {
  const kand = Array.from({ length: 40 }, (_, i) =>
    k(`f${i}`, `D${i}`, 9000 - i * 10, 'biel', `t${i}`)
  );
  const p = tanszeAlternatywy({ kolorGlowny: 'biel', cenaObecna: 10000, kandydaci: kand });
  assert.equal(p.length, 3);
});

/* ═════════════════════════════ na prawdziwym cenniku i prawdziwym silniku */

test('na realnym katalogu podpowiedzi są tańsze i w kolorze', async () => {
  const { wycen, FIRMY } = await import('./lib/silnik.mjs').then((m) => m.wczytajSilnik());
  const odcinki = [
    { gl: 60, dl: 300 },
    { gl: 60, dl: 180 },
  ];
  const opcje = { pomieszczenie: 'kuchnia', otwory: 1 };
  const kwota = (w) => Math.round(w.razemZaokr || w.razem);

  const glowna = FIRMY.find((f) => f.slug === 'caesarstone');
  const dekor = Object.keys(glowna.dekory).find((d) => /calacatta/i.test(d));
  assert.ok(dekor, 'brak dekoru Calacatta w Caesarstone');
  const w = wycen(glowna, { dekor, grubosc: '20', odcinki, opcje });
  assert.equal(w.ok, true, w.blad);

  const kandydaci = [];
  for (const f of FIRMY) {
    if (f.slug === 'interstone') continue;
    for (const d of Object.keys(f.dekory || {})) {
      const gr = Object.keys(f.dekory[d] || {});
      const g = gr.includes('20') ? '20' : gr[0];
      const wy = wycen(f, { dekor: d, grubosc: g, odcinki, opcje });
      if (!wy.ok) continue;
      kandydaci.push({
        firma: f.slug,
        firmaNazwa: f.nazwa,
        typ: f.typ || '',
        dekor: d,
        grubosc: g,
        razem: kwota(wy),
        kolor: kolorDekoru(d, f.slug),
      });
    }
  }

  const p = tanszeAlternatywy({
    kolorGlowny: kolorDekoru(dekor, 'caesarstone'),
    cenaObecna: kwota(w),
    kandydaci,
    pomijaj: [`caesarstone/${dekor}`],
  });

  assert.equal(p.length, 3, 'przy białej żyle katalog musi mieć czym podpowiedzieć');
  for (const x of p) {
    assert.ok(x.razem < kwota(w), `${x.dekor} nie jest tańszy`);
    assert.ok(x.oszczednosc >= MINIMALNA_OSZCZEDNOSC, `${x.dekor}: ${x.oszczednosc} zł`);
    assert.ok(x.dystans <= 2, `${x.dekor} ma kolor z innej bajki (${x.kolor})`);
  }
  assert.equal(new Set(p.map((x) => x.firma)).size, 3, 'trzy różne marki');
});

/* ══════════════════════════════════ zakres: to jest narzędzie Dawida */

const czytaj = (pl) => fs.readFileSync(path.join(ROOT, pl), 'utf8');

test('podpowiedzi nie wyciekają do widoków klienta', () => {
  // U klienta zostają wyłącznie normalne warianty, które Dawid wybrał.
  for (const plik of ['src/app/oferta-widok.js', 'src/app/wynik-widok.js', 'src/app/czat.js']) {
    const t = czytaj(plik);
    assert.ok(!t.includes('podpowiedzi.js'), `${plik} importuje podpowiedzi`);
    assert.ok(!t.includes('tanszeAlternatywy'), `${plik} woła tanszeAlternatywy`);
  }
});

test('podpowiedzi są tylko w edytorze właściciela', () => {
  assert.ok(czytaj('src/app/oferta-dawida.js').includes('tanszeAlternatywy'));
});

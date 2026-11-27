/**
 * COSENTINO — SILESTONE I DEKTON.
 *
 *   node --test scripts/test-cosentino.mjs
 *
 * Trzy rzeczy, które muszą trzymać, bo kosztują pieniądze albo zaufanie:
 *
 * 1. CENY ZAKUPU NIE WYCIEKAJĄ. Przy Cosentino jest to ostrzejsze niż
 *    gdzie indziej: kwoty wydrukowane w cenniku to CENY ZAKUPU Dawida
 *    (potwierdził 27.11.2026), a nie sugestia dla klienta. Gdyby któraś
 *    z nich trafiła do pliku dla przeglądarki, konkurencja wiedziałaby,
 *    po ile Dawid kupuje.
 * 2. MARŻA JEST DOKŁADNIE 1,30 i liczona przed VAT-em — tak zdecydował
 *    Dawid („przed VAT", 27.11.2026).
 * 3. FORMAT I GRUBOŚĆ IDĄ ZA DEKOREM, nie za marką. Cennik rozpisuje
 *    dostępność osobno dla każdej pary kolor × grubość i nie każdy kolor
 *    ma każdy format.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const { wczytajSilnik } = await import('./lib/silnik.mjs');
const silnik = await wczytajSilnik();
const firma = (slug) => silnik.FIRMY.find((f) => f.slug === slug);

const czytaj = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
const SIL = czytaj('../src/generated/silestone.dekory.json');
const DEK = czytaj('../src/generated/dekton.dekory.json');
const KOLORY = czytaj('./kolory-cosentino.json');

/* ═══════════════════════════════════ 1. ceny zakupu zostają poza frontem */

test('żadna cena zakupu z cennika Cosentino nie trafiła do plików dla klienta', () => {
  /*
   * Komplet kwot z tabel cennika — wszystkie grupy, wszystkie grubości,
   * obie marki. Gdyby generator kiedyś przestał mnożyć przez marżę albo
   * ktoś wkleił surową tabelę, ten test to złapie.
   */
  const zakupy = [
    489, 563, 768, 560, 651, 881, 615, 710, 964, 740, 981, 1374,
    815, 1079, 1514, 984, 1310, 1837, 1109, 1472, 2065,
    261, 321, 373, 431, 516, 619, 389, 550, 643, 741, 890, 1069,
    922, 1067, 1277, 1533, 648, 917, 1081, 1255, 1509, 1811,
  ];

  for (const [nazwa, dane] of [
    ['silestone.dekory.json', SIL],
    ['dekton.dekory.json', DEK],
  ]) {
    const tekst = JSON.stringify(dane);
    for (const z of new Set(zakupy)) {
      const ile = (tekst.match(new RegExp(`"cena": ?${z}[,}]`, 'g')) || []).length;
      assert.equal(ile, 0, `${nazwa}: kwota ZAKUPOWA ${z} zł widoczna jako cena klienta`);
    }
  }
});

test('plik z kolorami w repo nie zawiera żadnych kwot', () => {
  // kolory-cosentino.json jest jawny (nazwy, grupy, formaty) — ceny mają
  // siedzieć wyłącznie w pricing/zrodla, poza gitem.
  const tekst = JSON.stringify(KOLORY);
  for (const z of [489, 563, 768, 1109, 2065, 261, 389, 1811]) {
    assert.ok(!new RegExp(`\\b${z}\\b`).test(tekst), `kolory-cosentino.json zawiera kwotę ${z}`);
  }
});

/* ═══════════════════════════════════════════ 2. marża: netto × 1,30 */

test('cena kliencka to dokładnie cena zakupu × 1,30, liczona przed VAT', () => {
  // Punkty kontrolne z trzech grup i trzech grubości.
  const kontrola = [
    ['silestone', 'Arden Blue', '20', 563],
    ['silestone', 'Et. Marquina', '12', 815],
    ['silestone', 'Versailles Ivory', '30', 2065],
    ['dekton', 'Laurent', '12', 1067],
    ['dekton', 'Aeris', '8', 389],
    ['dekton', 'Trance', '20', 1509],
  ];
  for (const [marka, dekor, gr, zakup] of kontrola) {
    const wpis = (marka === 'silestone' ? SIL : DEK).dekory[dekor][gr];
    const cena = typeof wpis === 'number' ? wpis : wpis.cena;
    assert.equal(cena, Math.round(zakup * 1.3), `${marka}/${dekor} ${gr} mm`);
  }
});

/* ══════════════════════════════ 3. format i grubość idą za dekorem */

test('nie każdy dekor ma każdą grubość — katalog pokazuje tylko realne', () => {
  // Daze istnieje wyłącznie w 8 mm, Keon w 8 i 12, Laurent we wszystkich.
  assert.deepEqual(Object.keys(DEK.dekory['Daze']), ['8']);
  assert.deepEqual(Object.keys(DEK.dekory['Keon']).sort(), ['12', '8']);
  assert.deepEqual(Object.keys(DEK.dekory['Laurent']).sort(), ['12', '20', '8']);
  // Silestone: trzy kolory bez 12 mm (przypis cennika).
  for (const d of ['Eclectic Pearl', 'RAW A', 'RAW G']) {
    assert.ok(!SIL.dekory[d]['12'], `${d} nie powinien mieć 12 mm`);
  }
});

test('grubość 4 mm nie weszła do kalkulatora — to okładzina, nie blat', () => {
  for (const wpis of Object.values(DEK.dekory)) {
    assert.ok(!wpis['4'], 'Dekton 4 mm trafił do cennika blatów');
  }
});

test('format płyty jest przypisany do pozycji, nie do marki', () => {
  // Daze tylko 330 × 163, Keon tylko 320 × 144 — różne płyty w tej samej marce.
  assert.deepEqual(DEK.dekory['Daze']['8'].plyta, { w: 330, h: 163, polowkaDozwolona: false });
  assert.deepEqual(DEK.dekory['Keon']['8'].plyta, { w: 320, h: 144, polowkaDozwolona: false });
  // Silestone: Arden Blue to Jumbo, White Storm 14 tylko Standard.
  assert.equal(SIL.dekory['Arden Blue']['20'].plyta.w, 310);
  assert.equal(SIL.dekory['White Storm 14']['20'].plyta.w, 290);
});

test('u Cosentino nie liczymy połówek płyt [DOMYŚLNE do potwierdzenia]', () => {
  for (const [nazwa, dane] of [['silestone', SIL], ['dekton', DEK]]) {
    for (const [dekor, grubosci] of Object.entries(dane.dekory)) {
      for (const [gr, wpis] of Object.entries(grubosci)) {
        if (typeof wpis === 'number') continue;
        assert.equal(wpis.plyta.polowkaDozwolona, false, `${nazwa}/${dekor} ${gr} mm`);
      }
    }
  }
  assert.equal(KOLORY._plyty.polowkaDozwolona, false);
});

test('wymiary płyt bierzemy z DOLNEJ granicy zakresu z cennika', () => {
  // Cennik pisze „od 290 × 130 do 306 × 141". Gdybyśmy liczyli po górnej,
  // kalkulator obiecałby blat, który nie zmieści się w płycie.
  const szerokosci = new Set();
  for (const grubosci of Object.values(SIL.dekory))
    for (const wpis of Object.values(grubosci)) szerokosci.add(wpis.plyta.w);
  assert.deepEqual([...szerokosci].sort((a, b) => a - b), [290, 310]);
});

/* ══════════════════════════════════════ 4. wykończenie: wybór i dopłata */

test('Silestone: suede i volcano to +10% do ceny kamienia, nie płaska stawka', () => {
  const f = firma('silestone');
  const opcja = f.opcje.find((o) => o.id === 'wykonczenieSilestone');
  assert.ok(opcja, 'brak opcji wykończenia');
  assert.equal(opcja.warianty.find((w) => w.id === 'suede').procentMaterialu, 0.1);
  assert.equal(opcja.warianty.find((w) => w.id === 'volcano').procentMaterialu, 0.1);

  const dane = (wyk) => ({
    dekor: 'Arden Blue',
    grubosc: '20',
    odcinki: [{ dl: 300, gl: 60 }],
    opcje: { dostawa: 'montaz', pomieszczenie: 'kuchnia', ...(wyk ? { wykonczenieSilestone: wyk } : {}) },
  });
  const bez = silnik.wycen(f, dane(null), '2026-11-27');
  const zSuede = silnik.wycen(f, dane('suede'), '2026-11-27');
  assert.ok(bez.ok && zSuede.ok);
  assert.ok(zSuede.razem > bez.razem, 'suede nie podniosło ceny');

  // Dopłata to 10% WARTOŚCI MATERIAŁU, więc rośnie razem z grupą cenową.
  const material = bez.pozycje.find((p) => p.grupa === 'materiał').brutto;
  const doplata = zSuede.razem - bez.razem;
  assert.ok(
    Math.abs(doplata - material * 0.1) < 1,
    `dopłata ${doplata.toFixed(2)} ≠ 10% materiału ${(material * 0.1).toFixed(2)}`
  );
});

test('Volcano nie pokazuje się przy kolorach, przy których go nie robią', () => {
  const f = firma('silestone');
  const opcja = f.opcje.find((o) => o.id === 'wykonczenieSilestone');
  const volcano = opcja.warianty.find((w) => w.id === 'volcano');
  // Cennik daje Volcano przy trzech kolorach z pięćdziesięciu.
  assert.equal(volcano.tylkoDekory.length, 3);
  assert.ok(volcano.tylkoDekory.includes('Arden Blue'));
  assert.ok(!volcano.tylkoDekory.includes('Et. Marquina'));

  // …i silnik go nie doliczy, nawet gdy przyjdzie w żądaniu.
  const w = silnik.wycen(
    f,
    {
      dekor: 'Et. Marquina',
      grubosc: '20',
      odcinki: [{ dl: 300, gl: 60 }],
      opcje: { dostawa: 'montaz', pomieszczenie: 'kuchnia', wykonczenieSilestone: 'volcano' },
    },
    '2026-11-27'
  );
  assert.ok(w.ok);
  assert.ok(!w.pozycje.some((p) => /volcano/i.test(p.nazwa)), 'Volcano doliczone tam, gdzie go nie ma');
});

test('Dekton nie daje wyboru wykończenia — to cecha koloru', () => {
  const f = firma('dekton');
  assert.ok(!f.opcje.some((o) => /wykonczenie/i.test(o.id)), 'Dekton ma kontrolkę wykończenia');
  // Wykończenia siedzą w danych i są opisem przy kolorze, nie kontrolką.
  assert.equal(KOLORY.dekton['Laurent'].tekstura, 'teksturowany-mat');
  assert.equal(KOLORY.dekton['Trance'].tekstura, 'poler');
});

/* ══════════════════════════════════════════════ 5. zdjęcia i fallback */

test('dekory bez zdjęcia całej płyty zostają w cenniku, tylko bez podglądu', async () => {
  const { WZORY } = await import('../src/generated/wzory-dekorow.js');
  // Sirius25 i Zenith: katalog oddał kwadratową próbkę, nie płytę.
  assert.ok(DEK.dekory['Sirius25'], 'Sirius25 wypadł z cennika');
  assert.ok(DEK.dekory['Zenith'], 'Zenith wypadł z cennika');
  assert.ok(!WZORY.dekton['Sirius25'], 'Sirius25 dostał zdjęcie, choć to próbka');
  assert.ok(!WZORY.dekton['Zenith'], 'Zenith dostał zdjęcie, choć to próbka');
  // A te, które mają prawdziwą płytę, mają ją podpiętą.
  assert.equal(WZORY.dekton['Laurent'].slab, true);
  assert.equal(WZORY.silestone['Arden Blue'].slab, true);
});

/**
 * PROMOCJE „OSTATNIE PŁYTY".
 *
 *   node --test scripts/test-promo-plyt.mjs
 *
 * Zlecenie Dawida (27.08.2026): wyprzedaż resztek magazynowych z gotową
 * ceną dla klienta i ręcznie zmniejszanym licznikiem sztuk.
 *
 * NIE MYLIĆ z app/promocje-lista.js (rabaty dostawców na cały dekor
 * z cennika) — to inny, niezależny mechanizm, stąd osobny plik testów.
 *
 * Najważniejsze, czego pilnują te testy:
 *   • cena, którą wpisał Dawid, trafia do wyceny BEZ ŻADNEJ marży,
 *   • promocja gaśnie sama po wyczerpaniu sztuk i po terminie,
 *   • dyskretna podpowiedź liczy się na DOKŁADNIE tych samych wymiarach
 *     i opcjach co bieżąca wycena, i nigdy nie podpowiada promocji
 *     samej sobie.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { wczytajSilnik } = await import('./lib/silnik.mjs');
const m = await wczytajSilnik();
const {
  aktywna,
  doBanera,
  firmaZPromocji,
  notaPromocji,
  wycenPromocje,
  podpowiedzPromocji,
  formaPlyty,
  dataPl,
  MINIMALNA_OSZCZEDNOSC,
  wycen,
  FIRMY,
} = m;

const ODCINKI = [
  { gl: 60, dl: 300 },
  { gl: 60, dl: 180 },
];
const OPCJE = {
  pomieszczenie: 'kuchnia',
  otwory: 1,
  zlew: 'podblat',
  zlewy: 1,
  plyta: 'nakladana',
  dostawa: 'montaz',
};

const promo = (nadpisz = {}) => ({
  id: 1,
  nazwa: 'Calacatta Gold — ostatnie płyty',
  opisMaterial: 'Konglomerat kwarcowy',
  firmaSlug: '',
  dekor: '',
  gruboscMm: 20,
  plytaDlCm: 320,
  plytaGlCm: 160,
  cenaNormalnaM2: 1200,
  cenaPromoM2: 890,
  plytRazem: 4,
  plytZostalo: 2,
  dataKonca: '2026-09-30',
  ...nadpisz,
});

/* ═══════════════════════════════════════════════════ czy aktywna */

test('promocja z zapasem i przed terminem jest aktywna', () => {
  assert.equal(aktywna(promo()), true);
});

test('promocja bez sztuk gaśnie sama — nie trzeba jej ręcznie ukrywać', () => {
  assert.equal(aktywna(promo({ plytZostalo: 0 })), false);
});

test('promocja po terminie gaśnie sama', () => {
  assert.equal(aktywna(promo(), '2026-10-01'), false);
  assert.equal(aktywna(promo(), '2026-09-30'), true, 'ostatni dzień jeszcze trwa');
});

test('bez daty końca promocja trwa, dopóki są sztuki', () => {
  assert.equal(aktywna(promo({ dataKonca: '' }), '2099-01-01'), true);
});

test('brak promocji nie wywraca sprawdzenia', () => {
  assert.equal(aktywna(null), false);
  assert.equal(aktywna(undefined), false);
});

/* ═══════════════════════════════════════════════ kolejność na banerze */

test('baner pokazuje najpierw te, co kończą się najszybciej', () => {
  const pilna = promo({ id: 1, dataKonca: '2026-09-01' });
  const luzna = promo({ id: 2, dataKonca: '2026-12-31' });
  const bezTerminu = promo({ id: 3, dataKonca: '' });
  const lista = doBanera([bezTerminu, luzna, pilna]);
  assert.deepEqual(lista.map((p) => p.id), [1, 2, 3]);
});

test('nieaktywne (0 sztuk, po terminie) nie trafiają na baner', () => {
  const wygasla = promo({ id: 9, dataKonca: '2020-01-01' });
  const wyprzedana = promo({ id: 10, plytZostalo: 0 });
  assert.deepEqual(doBanera([promo(), wygasla, wyprzedana]).map((p) => p.id), [1]);
});

/* ═══════════════════════════════════════ cena bez marży w kodzie klienta */

test('wycena liczy DOKŁADNIE cenę Dawida — bez żadnego przelicznika', () => {
  // 890 zł/m² brutto → netto po 23% (stawka źródłowa) = 723,58 zł.
  // Płyta 320×160 = 5,12 m². Materiał netto = 3704,73 zł.
  const w = wycenPromocje(promo(), { odcinki: [{ gl: 60, dl: 300 }], opcje: OPCJE });
  const mat = w.pozycje.find((p) => p.grupa === 'materiał');
  const cenaNettoOczekiwana = 890 / 1.23;
  const materialNettoOczekiwany = cenaNettoOczekiwana * w.pak.m2Kupione;
  const materialBruttoOczekiwany = materialNettoOczekiwany * (1 + w.stawkaVat);
  assert.ok(
    Math.abs(mat.brutto - materialBruttoOczekiwany) < 1,
    `materiał ${mat.brutto} zł, oczekiwano ${materialBruttoOczekiwany.toFixed(2)} zł`
  );
});

test('promocja z realnego dekoru dziedziczy rodzaj materiału i format płyty', () => {
  const f = FIRMY.find((x) => x.slug === 'avant-quartz');
  assert.ok(f, 'brak avant-quartz w cennikach testowych');
  const p = promo({ firmaSlug: 'avant-quartz', dekor: 'Dijon', plytaDlCm: f.plyta.w, plytaGlCm: f.plyta.h });
  const pseudo = firmaZPromocji(p);
  assert.equal(pseudo.typ, f.typ);
  assert.deepEqual(pseudo.plyta, { w: f.plyta.w, h: f.plyta.h, polowkaDozwolona: false });
  // Ale CENA jest promocyjna, nie z cennika Dijon.
  const w = wycenPromocje(p, { odcinki: ODCINKI, opcje: OPCJE });
  assert.equal(w.ok, true);
});

test('płyta własna (bez dekoru z cennika) i tak liczy się poprawnie', () => {
  const w = wycenPromocje(promo({ firmaSlug: '', dekor: '' }), { odcinki: ODCINKI, opcje: OPCJE });
  assert.equal(w.ok, true);
  assert.ok(w.razem > 0);
});

test('płyta promocyjna kupowana jest w CAŁYCH sztukach, nie metrażem', () => {
  const w = wycenPromocje(promo(), { odcinki: [{ gl: 60, dl: 100 }], opcje: OPCJE });
  // Mały odcinek na dużej płycie 320×160 — i tak płacimy za całą płytę.
  assert.equal(w.pak.plytyPelne >= 1, true);
  assert.equal(w.pak.m2Kupione, (320 * 160) / 10000);
});

/* ═══════════════════════════════════════════════════ dopisek klienta */

test('nota mówi wprost „do wyczerpania płyt" i podaje ile zostało', () => {
  const n = notaPromocji(promo({ plytZostalo: 3 }));
  assert.match(n, /do wyczerpania płyt/);
  assert.match(n, /Zostało 3 płyty/);
});

test('nota z terminem wspomina obie granice — sztuki i datę', () => {
  const n = notaPromocji(promo({ dataKonca: '2026-09-30' }));
  assert.match(n, /30\.09\.2026/);
});

test('nota bez terminu nie wspomina o dacie', () => {
  const n = notaPromocji(promo({ dataKonca: '' }));
  assert.ok(!/\d{2}\.\d{2}\.\d{4}/.test(n));
});

test('ta sama nota widoczna jest w wycenie klienta (firma.notaKlient)', () => {
  const p = promo();
  const w = wycenPromocje(p, { odcinki: ODCINKI, opcje: OPCJE });
  assert.equal(w.firma.notaKlient, notaPromocji(p));
});

test('odmiana: 1 płyta, 2–4 płyty, 5+ płyt', () => {
  assert.equal(formaPlyty(1), 'płyta');
  assert.equal(formaPlyty(2), 'płyty');
  assert.equal(formaPlyty(4), 'płyty');
  assert.equal(formaPlyty(5), 'płyt');
  assert.equal(formaPlyty(0), 'płyt');
});

/* ═══════════════════════════════════════ dyskretna podpowiedź (cross-sell) */

function drogaWycena(cenaM2, opts = {}) {
  const f = FIRMY.find((x) => x.slug === 'avant-quartz');
  return wycen(
    {
      nazwa: 'Test',
      typ: 'test',
      vat: 0.23,
      cenyUslug: 'brutto',
      robocizna: f.robocizna,
      opcje: f.opcje,
      trybCeny: 'reczna',
      cenaRecznaJest: 'brutto',
      rozliczenieMaterialu: 'plyty',
      plyta: { w: 320, h: 160, polowkaDozwolona: false },
    },
    { dekor: 'x', grubosc: '20', odcinki: ODCINKI, opcje: OPCJE, cenaRecznaM2: cenaM2, ...opts }
  );
}

test('podpowiedź pojawia się, gdy promocja realnie oszczędza', () => {
  const drogi = drogaWycena(2000);
  const sugestia = podpowiedzPromocji(drogi, [promo()]);
  assert.ok(sugestia);
  assert.ok(sugestia.oszczednosc >= MINIMALNA_OSZCZEDNOSC);
});

test('podpowiedź NIE pojawia się przy groszowej różnicy', () => {
  // Ten sam materiał, dwie prawie identyczne ceny — różnica poniżej progu.
  const bazowy = drogaWycena(900);
  const prawieTakaSama = wycenPromocje(promo({ cenaPromoM2: 895 }), { odcinki: ODCINKI, opcje: OPCJE });
  const oszczednoscRzeczywista = Math.round((bazowy.razemZaokr ?? bazowy.razem) - (prawieTakaSama.razemZaokr ?? prawieTakaSama.razem));
  assert.ok(oszczednoscRzeczywista < MINIMALNA_OSZCZEDNOSC, `test zły — różnica ${oszczednoscRzeczywista} zł już przekracza próg`);

  const sugestia = podpowiedzPromocji(bazowy, [promo({ cenaPromoM2: 895 })]);
  assert.equal(sugestia, null);
});

test('płyta własna (bez firmaSlug) liczy obróbkę i montaż TYMI SAMYMI, ŻYWYMI stawkami co reszta aplikacji', () => {
  /*
   * Regresja złapana przy pisaniu tego modułu: firmaZPromocji budowana
   * wprost z gołych stałych `_domyslne.ROBOCIZNA/OPCJE` zamrażała obróbkę
   * na „w cenie" (0 zł) NIEZALEŻNIE od stawek Dawida w panelu, bo
   * `zastosujUstawienia` nakłada panel na `firma.robocizna` każdej firmy
   * z osobna i nigdy nie dotyka gołych stałych. Efekt: promocyjna „płyta
   * własna" różniłaby się cichcem od każdego innego materiału.
   *
   * Dowód poprawności: policzona bez wskazanego dekoru firma ma TĘ SAMĄ
   * tablicę obiektów robocizna/opcje, co dowolna realna firma z cennika —
   * więc każda przyszła zmiana stawki w panelu obejmie też promocje.
   */
  const f = FIRMY.find((x) => x.slug === 'avant-quartz');
  const pseudo = firmaZPromocji(promo({ firmaSlug: '', dekor: '' }));
  assert.deepEqual(pseudo.robocizna, f.robocizna);
  assert.deepEqual(pseudo.opcje, f.opcje);
});

test('promocja nigdy nie podpowiada samej siebie', () => {
  const p = promo();
  const wlasna = wycenPromocje(p, { odcinki: ODCINKI, opcje: OPCJE });
  assert.equal(podpowiedzPromocji(wlasna, [p]), null);
});

test('przy kilku promocjach wygrywa ta z NAJWIĘKSZĄ oszczędnością', () => {
  const drogi = drogaWycena(2000);
  const tansza = promo({ id: 1, cenaPromoM2: 1000 });
  const najtansza = promo({ id: 2, cenaPromoM2: 700 });
  const sugestia = podpowiedzPromocji(drogi, [tansza, najtansza]);
  assert.equal(sugestia.promo.id, 2);
});

test('nieaktywna promocja (po terminie) nie wchodzi do podpowiedzi', () => {
  const drogi = drogaWycena(2000);
  const wygasla = promo({ dataKonca: '2020-01-01' });
  assert.equal(podpowiedzPromocji(drogi, [wygasla]), null);
});

test('brak wyceny albo błędna wycena nie wywraca podpowiedzi', () => {
  assert.equal(podpowiedzPromocji(null, [promo()]), null);
  assert.equal(podpowiedzPromocji({ ok: false }, [promo()]), null);
});

test('data po polsku: RRRR-MM-DD → DD.MM.RRRR', () => {
  assert.equal(dataPl('2026-09-30'), '30.09.2026');
  assert.equal(dataPl(''), '');
});

/* ═══════════════════════════════════════ fragment linku podglądu */

test('paczkaPodgladu rozbiera poprawny fragment #promoPodglad=', async () => {
  const { paczkaPodgladu } = m;
  const paczka = { podgladId: 7, exp: 123456, podpis: 'abc' };
  const b64 = Buffer.from(JSON.stringify(paczka))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  assert.deepEqual(paczkaPodgladu(`#promoPodglad=${b64}`), paczka);
});

test('paczkaPodgladu odrzuca śmieci i inne fragmenty', async () => {
  const { paczkaPodgladu } = m;
  assert.equal(paczkaPodgladu(''), null);
  assert.equal(paczkaPodgladu('#powtorz=cokolwiek'), null);
  assert.equal(paczkaPodgladu('#promoPodglad=%%%nie-base64%%%'), null);
});

/**
 * CENA UMYWALKI — ten sam silnik, ten sam cennik, te same stawki co blaty.
 *
 *   node --test scripts/test-umywalka-cena.mjs
 *
 * Przykład kontrolny ze specyfikacji §7.4 (umywalka 120 × 50, Keralini
 * Absolute Naturale 12 mm, oba boki, bateria z blatu):
 *
 *   materiał      2,56 m² × 792 × 1,08            2 189,72
 *   pogrubienie   200 / 1,23 × 1,08 × 2,20 mb       386,34
 *   niecka        1 200 / 1,23 × 1,08             1 053,66
 *   otwór         184,50 / 1,23 × 1,08               162,00
 *   montaż        (1 500 + 200 × 0,60) / 1,23 × 1,08  1 422,44
 *   razem                                         5 214,16 → 5 200 zł
 *
 * Trzy rzeczy, których ten plik pilnuje najmocniej — bo wzór z artefaktu
 * mylił się w każdej z nich:
 *   1. materiał liczy się od KUPIONEJ płyty (2,56 m² połówki), nie od pola
 *      kawałków z ryczałtowym odpadem 25% (byłoby ~1 250 zł mniej),
 *   2. metry pogrubienia to front PLUS boki (2,20 mb, nie 1,20),
 *   3. VAT zależy od montażu (8% / 23%), nie jest na sztywno 23%.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { STAN_DOMYSLNY, zacisnij } from '../src/umywalka/model.js';
import { wycenUmywalke } from '../src/umywalka/wycena-umywalki.js';
import { DOMYSLNE } from '../src/app/ustawienia.js';

const { wczytajSilnik } = await import('./lib/silnik.mjs');
const silnik = await wczytajSilnik();
const firma = (slug) => silnik.FIRMY.find((f) => f.slug === slug);

const DATA = '2026-11-23';
const grosze = (n) => Math.round(n * 100) / 100;

function policz(zmiany = {}, opcje = {}) {
  const stan = zacisnij({ ...STAN_DOMYSLNY, dekor: 'Absolute Naturale', L: 120, W: 50, H: 15, sL: 100, sW: 35, ins: 5, ...zmiany });
  return wycenUmywalke({
    firma: firma(stan.marka),
    stan,
    stawki: { ...DOMYSLNE, ...(opcje.stawki || {}) },
    dataISO: opcje.dataISO || DATA,
  });
}

const kwota = (w, id) => grosze(w.pozycje.find((p) => p.id === id)?.brutto ?? 0);

/* ═══════════════════════════════════════════ przykład kontrolny §7.4 */

test('120 × 50 Keralini 12 mm z montażem → 5 214,16 zł, pokazane 5 200 zł', () => {
  const w = policz();

  assert.equal(w.ok, true);
  assert.equal(kwota(w, 'material'), 2189.72);
  assert.equal(kwota(w, 'pogrubienie'), 386.34);
  assert.equal(kwota(w, 'niecka'), 1053.66);
  assert.equal(kwota(w, 'otwory'), 162);
  assert.equal(kwota(w, 'montaz'), 1422.44);
  assert.equal(grosze(w.razem), 5214.16);
  assert.equal(w.razemZaokr, 5200);
  assert.equal(w.stawkaVat, 0.08);
});

test('ta sama umywalka bez montażu (odbiór, VAT 23%) → 4 300 zł', () => {
  const w = policz({ mont: false });

  assert.equal(w.stawkaVat, 0.23);
  assert.equal(kwota(w, 'montaz'), 0);
  assert.equal(grosze(w.razem), 4318.35);
  assert.equal(w.razemZaokr, 4300);
});

test('najmniejsza: 80 × 46 Avant Clermont 20 mm z montażem → 4 500 zł', () => {
  const w = policz({ L: 80, W: 46, sL: 60, sW: 31, marka: 'avant-quartz', dekor: 'Clermont', grubosc: '20' });

  assert.equal(w.ok, true);
  assert.equal(grosze(w.razem), 4491.93);
  assert.equal(w.razemZaokr, 4500);
});

/* ═══════════════════════════════════════════ połówka płyty */

test('presety mieszczą się w połówce płyty (2,56 m²)', () => {
  for (const [L, W] of [
    [80, 46],
    [100, 50],
    [120, 50],
    [160, 50],
  ]) {
    const w = policz({ L, W });
    assert.equal(w.pak.polowka, true, `${L} × ${W} powinno zmieścić się w połówce`);
    assert.equal(w.pak.m2Kupione, 2.56, `${L} × ${W}`);
  }
});

test('240 × 60 nie mieści się w połówce — potrzeba całej płyty', () => {
  // Przy geometrii z projektu Dawida granica przy głębokości 60 cm wypada
  // na 173 cm: ścianki zlewu są niższe niż w pierwszym podejściu i lepiej
  // się pakują, więc w połówce mieści się więcej niż wcześniej.
  const w = policz({ L: 240, W: 60, sL: 150, sW: 45 });
  assert.equal(w.pak.polowka, false);
  assert.equal(w.pak.m2Kupione, 5.12);
});

test('materiał liczy się od kupionej płyty, nie od pola kawałków', () => {
  const w = policz();
  // Pole kawałków to 1,685 m² — gdyby ktoś wrócił do wzoru „pole + 25%
  // odpadu", wyszłoby 2,106 m² i cena niższa o ponad tysiąc złotych.
  // Silnik nie zaokrągla `m2Blatu` (1,6849999…) — porównujemy z tolerancją.
  assert.ok(Math.abs(w.pak.m2Blatu - 1.685) < 0.001, `m2Blatu = ${w.pak.m2Blatu}`);
  assert.equal(w.m2Platne, 2.56);
  assert.equal(grosze(w.materialNetto), 2027.52);
});

/* ═══════════════════════════════════════════ stawki i VAT */

test('stawka z panelu zmienia cenę (pogrubienie 250 zł/m.b.)', () => {
  const w = policz({}, { stawki: { umywalkaPogrubienieMb: 250 } });
  assert.equal(kwota(w, 'pogrubienie'), grosze((250 / 1.23) * 1.08 * 2.2));
  assert.ok(w.razem > policz().razem);
});

test('bez ustawień z panelu liczymy wartościami domyślnymi', () => {
  const w = wycenUmywalke({
    firma: firma('keralini'),
    stan: zacisnij({ ...STAN_DOMYSLNY, dekor: 'Absolute Naturale', L: 120, W: 50, H: 15, sL: 100, sW: 35, ins: 5 }),
    dataISO: DATA,
  });
  assert.equal(w.razemZaokr, 5200);
});

test('bateria ze ściany: przy zlewie w kamieniu nie ma płatnego otworu', () => {
  const w = policz({ holes: 0 });
  assert.equal(kwota(w, 'otwory'), 0);
});

test('nablatowa: liczba otworów z kontrolki, bez ryczałtu za zlew', () => {
  // Przy blacie pod umywalkę nablatową klient sam ustawia, ile otworów
  // wycinamy (odpływ, bateria) — stąd dwa osobne przypadki.
  assert.equal(kwota(policz({ mode: 'top' }), 'otwory'), 162);
  assert.equal(kwota(policz({ mode: 'top', holes: 2 }), 'otwory'), 324);
  assert.equal(kwota(policz({ mode: 'top' }), 'niecka'), 0);
});

test('nablatowa jest tańsza od zlewu w kamieniu na tym samym wymiarze', () => {
  assert.ok(policz({ mode: 'top' }).razem < policz().razem);
});

test('montaż liczy się od powierzchni blatu, nie od kupionej płyty', () => {
  // 1,20 × 0,50 = 0,60 m². Pomyłka na rzecz m2Kupione (2,56) dałaby
  // montaż wyższy o ponad 300 zł.
  const w = policz();
  assert.equal(kwota(w, 'montaz'), grosze(((1500 + 200 * 0.6) / 1.23) * 1.08));
});

/* ═══════════════════════════════════════════ podblatowa i kilka umywalek */

test('podblatowa: płatne wycięcie otworu z polerowaną krawędzią', () => {
  // Stawka `zlewPodblatowy` z panelu: 450 zł netto = 486 brutto przy 8%.
  const w = policz({ mode: 'under', n: 1, holes: 1 });
  assert.equal(kwota(w, 'podblatowa'), 486);
  assert.equal(kwota(w, 'niecka'), 0, 'podblatowa nie ma niecki z kamienia');
});

test('dwie umywalki podblatowe — dwa wycięcia', () => {
  // Blat kontrolny ma 120 cm i otwór 100 cm — dwa takie się nie zmieszczą,
  // więc bierzemy wymiar, przy którym naprawdę da się je zrobić.
  const w = policz({ mode: 'under', n: 2, holes: 2, L: 160, sL: 55, sW: 38, gap: 20 });
  assert.equal(w.stan.n, 2, 'dwie umywalki powinny się zmieścić na 160 cm');
  assert.equal(kwota(w, 'podblatowa'), 972);
});

test('za ciasny blat przycina liczbę umywalek zamiast policzyć niemożliwe', () => {
  // 120 cm i otwory po 100 cm — dwóch się nie da wyciąć i cena tego nie udaje.
  const w = policz({ mode: 'under', n: 2, holes: 2 });
  assert.equal(w.stan.n, 1);
  assert.equal(kwota(w, 'podblatowa'), 486);
});

test('nablatowa nie płaci ani za nieckę, ani za wycięcie', () => {
  const w = policz({ mode: 'top', n: 2, holes: 2 });
  assert.equal(kwota(w, 'niecka'), 0);
  assert.equal(kwota(w, 'podblatowa'), 0);
  // Płaci za otwory na odpływy — po jednym na miskę.
  assert.equal(kwota(w, 'otwory'), 324);
});

test('ceramika nie wchodzi w cenę — mówimy to wprost', () => {
  for (const tryb of ['top', 'under']) {
    const w = policz({ mode: tryb });
    const tekst = JSON.stringify(w.linieKlienta) + JSON.stringify(w.pozycje);
    assert.ok(!/miska|ceramik/i.test(tekst), `w cenie ${tryb} nie ma prawa być miski`);
  }
});

test('kolejność cen: nablatowa taniej niż podblatowa, ta taniej niż zlew w kamieniu', () => {
  const nablatowa = policz({ mode: 'top', n: 1, holes: 1 }).razemZaokr;
  const podblatowa = policz({ mode: 'under', n: 1, holes: 1 }).razemZaokr;
  const wKamieniu = policz({ mode: 'int', n: 1, holes: 1 }).razemZaokr;
  assert.ok(nablatowa < podblatowa, `${nablatowa} ≥ ${podblatowa}`);
  assert.ok(podblatowa < wKamieniu, `${podblatowa} ≥ ${wKamieniu}`);
});

/* ═══════════════════════════════════════════ promocje dostawcy */

test('promocja aktywna w dacie wyceny obniża materiał (tańsza wygrywa)', () => {
  const wPromo = policz({ dekor: 'Portoro Naturale', grubosc: '12' }, { dataISO: '2026-11-23' });
  const poPromo = policz({ dekor: 'Portoro Naturale', grubosc: '12' }, { dataISO: '2027-02-01' });

  assert.ok(
    kwota(wPromo, 'material') < kwota(poPromo, 'material'),
    'kampania październik–grudzień 2026 powinna być tańsza niż cennik podstawowy'
  );
  assert.ok(wPromo.promo, 'wycena powinna nieść informację o promocji');
});

/* ═══════════════════════════════════════════ pozycje dla klienta */

test('karta dla klienta ma 4 linie i nie zdradza stawek warsztatu', () => {
  const linie = policz().linieKlienta;

  assert.equal(linie.length, 4);
  assert.match(linie[0].nazwa, /Kamień/);
  assert.match(linie[1].nazwa, /Wykonanie/);
  assert.match(linie[2].nazwa, /montaż/);
  assert.equal(linie[3].wCenie, true);

  const tekst = JSON.stringify(linie);
  for (const zakazane of ['m.b.', 'm²', '45°', 'formatk', 'netto', 'rozkr']) {
    assert.ok(!tekst.includes(zakazane), `w karcie klienta nie powinno być „${zakazane}"`);
  }
});

test('wykonanie to suma pogrubienia, niecki i otworów', () => {
  const w = policz();
  const wykonanie = w.linieKlienta[1].brutto;
  assert.equal(
    grosze(wykonanie),
    grosze(kwota(w, 'pogrubienie') + kwota(w, 'niecka') + kwota(w, 'otwory'))
  );
});

test('tańsza wersja: ten sam kamień jako blat pod umywalkę nablatową', () => {
  const w = policz();
  assert.ok(w.tanszaWersja > 0);
  assert.equal(w.tanszaWersja, policz({ mode: 'top' }).razemZaokr);
});

/* ═══════════════════════════════════════════ odporność */

test('nieznany dekor nie wywraca wyceny — zwraca czytelny błąd', () => {
  const w = policz({ dekor: 'Nie Ma Takiego' });
  assert.equal(w.ok, false);
  assert.ok(w.blad);
});

test('nietypowo duża umywalka liczy się normalnie, bez odmowy', () => {
  // Suwaki w projekcie Dawida sięgają 300 × 80 cm — takiego blatu nie
  // odrzucamy, tylko kupujemy pod niego całe płyty.
  const w = policz({ L: 280, W: 75, sL: 200, sW: 60 });
  assert.equal(w.ok, true);
  assert.ok(w.razemZaokr > 0);
  assert.ok(w.pak.plytyPelne >= 1);
});

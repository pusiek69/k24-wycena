/**
 * „SEZON LETNICH OKAZJI" (Interstone, do 30.09.2026) — trzy ulotki:
 * spieki Laminam, konglomerat InterQ i kamień naturalny.
 *
 *   node --test scripts/test-sezon-letni.mjs
 *
 * Zasady: ceny z ulotek to ceny zakupowe (zostają w pricing/zrodla, poza
 * gitem); klient płaci zakup × 1,30. Do 30.09 obowiązuje TAŃSZA z cen —
 * promocyjna albo standardowa. Po 30.09 wszystko wraca do zwykłych zasad.
 * Testy Laminamu siedzą w test-laminam.mjs — tu InterQ i naturalny.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { wczytajSilnik } from './lib/silnik.mjs';

const { wycen, FIRMY, wycenZMagazynu, znajdzPromocjeNaturalna } = await wczytajSilnik();

const W_SEZONIE = '2026-09-01';
const PO_SEZONIE = '2026-10-15';
const KUCHNIA = [{ gl: 60, dl: 300 }];
const OPCJE = { zlew: 'podblat', plyta: 'nakladana', otwory: 2, pomieszczenie: 'kuchnia' };

const nettoM2 = (w) => {
  const m = w.pozycje.find((p) => p.grupa === 'materiał');
  return m.brutto / (1 + w.stawkaVat) / w.m2Platne;
};

/* ─────────────────────────────────────────────────────────── InterQ */

const interq = FIRMY.find((f) => f.slug === 'interq');
const liczIQ = (dekor, dzien) =>
  wycen(interq, { dekor, grubosc: '20', odcinki: KUCHNIA, opcje: OPCJE }, dzien);

test('InterQ: w sezonie obowiązuje cena promocyjna, po nim cennikowa', () => {
  const wSezonie = liczIQ('Taj Mahal Polished', W_SEZONIE);
  const poSezonie = liczIQ('Taj Mahal Polished', PO_SEZONIE);
  assert.ok(Math.abs(nettoM2(wSezonie) - 741) < 0.01, `sezon: ${nettoM2(wSezonie)}`);
  assert.ok(Math.abs(nettoM2(poSezonie) - 1781) < 0.01, `po: ${nettoM2(poSezonie)}`);
  assert.equal(wSezonie.promo.nazwa, 'Sezon Letnich Okazji');
  assert.equal(poSezonie.promo, null);
});

test('InterQ: wszystkie pozycje sezonu są TAŃSZE od cennika stałego', () => {
  const kampania = interq.promocje.find((k) => k.nazwa === 'Sezon Letnich Okazji');
  assert.equal(Object.keys(kampania.ceny).length, 9);
  for (const [klucz, cena] of Object.entries(kampania.ceny)) {
    const nazwa = klucz.slice(0, klucz.lastIndexOf('||'));
    const gr = klucz.slice(klucz.lastIndexOf('||') + 2);
    const stala = interq.dekory[nazwa]?.[gr];
    assert.ok(typeof stala === 'number', `${nazwa} musi być w cenniku stałym`);
    assert.ok(cena < stala, `${nazwa}: promo ${cena} nie jest tańsza od ${stala}`);
  }
});

test('InterQ: promocja dotyczy tylko 2 cm — Angel White 30 mm bez zmian', () => {
  const w = wycen(interq, { dekor: 'Angel White Polished', grubosc: '30', odcinki: KUCHNIA, opcje: OPCJE }, W_SEZONIE);
  assert.ok(Math.abs(nettoM2(w) - 588) < 0.01, `30 mm: ${nettoM2(w)}`);
  assert.equal(w.promo, null);
});

test('InterQ: sezon nie zmienia zasady pełnych płyt', () => {
  const w = liczIQ('Taj Mahal Polished', W_SEZONIE);
  assert.ok(!w.pak.polowka);
  assert.ok(Math.abs(w.pak.m2Kupione - 5.12) < 0.01);
});

/* ─────────────────────────────────────────────────── kamień naturalny */

const PLYTA = (nadpisz = {}) => ({
  nazwa: 'SILK',
  rodzaj: 'Kamień Naturalny',
  kod: 'STON000900-91000',
  wykonczenie: 'Polerowana',
  cenaBruttoM2: 1400,
  plytaCm: { dl: 320, gl: 190 },
  gruboscMm: 20,
  dostepneM2: 12,
  blok: '7',
  ...nadpisz,
});

test('naturalny: dopasowanie po nazwie, wykończeniu i grubości', () => {
  const promo = znajdzPromocjeNaturalna(PLYTA(), W_SEZONIE);
  assert.ok(promo, 'Silk poler 20 jest na ulotce');
  assert.equal(promo.cenaNettoM2, 715); // 550 × 1,30
  assert.equal(znajdzPromocjeNaturalna(PLYTA({ wykonczenie: 'Szczotkowana' }), W_SEZONIE), null);
  assert.equal(znajdzPromocjeNaturalna(PLYTA({ gruboscMm: 30 }), W_SEZONIE), null);
  assert.equal(znajdzPromocjeNaturalna(PLYTA({ nazwa: 'NIEZNANY KAMIEN' }), W_SEZONIE), null);
  assert.equal(znajdzPromocjeNaturalna(PLYTA(), PO_SEZONIE), null, 'po 30.09 nic');
});

test('naturalny: Patagonia wyceniona per BLOK — bez zgodnego bloku brak promocji', () => {
  const p42 = znajdzPromocjeNaturalna(PLYTA({ nazwa: 'PATAGONIA', blok: '42', cenaBruttoM2: 3200 }), W_SEZONIE);
  const p44 = znajdzPromocjeNaturalna(PLYTA({ nazwa: 'PATAGONIA', blok: '44', cenaBruttoM2: 3200 }), W_SEZONIE);
  const inny = znajdzPromocjeNaturalna(PLYTA({ nazwa: 'PATAGONIA', blok: '7', cenaBruttoM2: 3200 }), W_SEZONIE);
  assert.equal(p42.cenaNettoM2, 2139); // 1645 × 1,30
  assert.equal(p44.cenaNettoM2, 1875); // 1442 × 1,30
  assert.equal(inny, null);
});

test('naturalny: promocja podmienia cenę materiału i dokleja dopisek', () => {
  const w = wycenZMagazynu(PLYTA(), { odcinki: KUCHNIA, opcje: OPCJE });
  assert.equal(w.ok, true, w.blad);
  // 715 netto zamiast 1400/1,23 = 1138 netto z magazynu.
  assert.ok(Math.abs(nettoM2(w) - 715) < 0.5, `netto/m2 = ${nettoM2(w)}`);
  assert.equal(w.promo.nazwa, 'Sezon Letnich Okazji');
  assert.ok(w.ostrzezenia.some((o) => /wyczerpania zapasów/.test(o) && /opiekuna/.test(o)));
  // Reguły naturalnego zostają: obróbka 300 zł/m², całe płyty.
  assert.ok(w.pozycje.some((p) => p.nazwa.includes('Obróbka kamienia naturalnego')));
  assert.ok(!w.pak.polowka);
});

test('naturalny: gdy magazyn jest TAŃSZY niż promocja, zostaje magazyn', () => {
  // Silk promo 715 netto; płyta za 800 brutto = 650 netto — taniej.
  const w = wycenZMagazynu(PLYTA({ cenaBruttoM2: 800 }), { odcinki: KUCHNIA, opcje: OPCJE });
  assert.equal(w.ok, true, w.blad);
  assert.ok(Math.abs(nettoM2(w) - 800 / 1.23) < 0.5, `netto/m2 = ${nettoM2(w)}`);
  assert.ok(w.promo == null, 'bez plakietki, skoro liczymy z magazynu');
});

test('naturalny: po 30.09 wycena wraca do ceny magazynowej', () => {
  const dzis = new Date().toISOString().slice(0, 10);
  const w = wycenZMagazynu(PLYTA(), { odcinki: KUCHNIA, opcje: OPCJE });
  // Test uruchamiany w trakcie sezonu korzysta z promocji; sam mechanizm
  // powrotu sprawdza znajdzPromocjeNaturalna(PO_SEZONIE) wyżej — tu tylko
  // pilnujemy, że dzisiejsza data w ogóle przechodzi przez tę ścieżkę.
  assert.equal(w.ok, true, w.blad);
  assert.ok(dzis <= '2026-09-30' ? !!w.promo : !w.promo);
});

/* ─────────────────────────────────── tajemnica: zakup nie wycieka */

test('w plikach generated nie ma żadnej ceny zakupowej z ulotek', () => {
  // Próbka cen hurtowych z trzech ulotek — nie mają prawa pojawić się
  // w żadnym pliku dla klienta jako cena.
  const zakupy = [399, 639, 349, 469, 570, 595, 323, 406, 387, 375, 255, 316, 510, 1190, 1645, 1442, 550, 740, 424];
  for (const plik of ['laminam.promocje.json', 'interq.promocje.json', 'naturalny.promocje.json']) {
    const dane = JSON.parse(fs.readFileSync(new URL(`../src/generated/${plik}`, import.meta.url), 'utf8'));
    const ceny = JSON.stringify(dane).match(/(?<=:\s?)\d+(?=[,}])/g)?.map(Number) ?? [];
    // Kampania cennikowa Laminamu legalnie zawiera 782/946 — pomijamy ją,
    // sprawdzamy wyłącznie kwoty z listy zakupowej sezonu.
    for (const z of zakupy) {
      const wystapienia = (JSON.stringify(dane).match(new RegExp(`: ?${z}[,}\\s]`, 'g')) || []).length;
      assert.equal(wystapienia, 0, `${plik}: kwota zakupowa ${z} widoczna`);
    }
  }
});

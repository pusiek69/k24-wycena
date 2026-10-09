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
  // Dzień podajemy JAWNIE. Do 30.09.2026 test brał datę dzisiejszą i przechodził
  // sam z siebie; 1.10 kampania wygasła i ten sam test zaczął padać, choć
  // mechanizm działa poprawnie. Sprawdzamy mechanizm, nie kalendarz.
  const w = wycenZMagazynu(PLYTA(), { odcinki: KUCHNIA, opcje: OPCJE }, W_SEZONIE);
  assert.equal(w.ok, true, w.blad);
  // 715 netto zamiast 1400/1,23 = 1138 netto z magazynu.
  assert.ok(Math.abs(nettoM2(w) - 715) < 0.5, `netto/m2 = ${nettoM2(w)}`);
  assert.equal(w.promo.nazwa, 'Sezon Letnich Okazji');
  assert.ok(w.ostrzezenia.some((o) => /wyczerpania zapasów/.test(o) && /opiekuna/.test(o)));
  // Reguły naturalnego zostają: obróbka wg stawki z panelu, całe płyty.
  assert.ok(w.pozycje.some((p) => p.nazwa.includes('Docięcie, polerowanie')));
  assert.ok(!w.pak.polowka);
});

test('naturalny: gdy magazyn jest TAŃSZY niż promocja, zostaje magazyn', () => {
  // Silk promo 715 netto; płyta za 800 brutto = 650 netto — taniej.
  const w = wycenZMagazynu(PLYTA({ cenaBruttoM2: 800 }), { odcinki: KUCHNIA, opcje: OPCJE }, W_SEZONIE);
  assert.equal(w.ok, true, w.blad);
  assert.ok(Math.abs(nettoM2(w) - 800 / 1.23) < 0.5, `netto/m2 = ${nettoM2(w)}`);
  assert.ok(w.promo == null, 'bez plakietki, skoro liczymy z magazynu');
});

test('naturalny: po 30.09 wycena wraca do ceny magazynowej', () => {
  // Kampania skończyła się 30.09.2026 i nikt jej nie przedłużył — od 1.10
  // liczymy z magazynu: 1400 brutto/m² to 1138 netto, bez plakietki
  // i bez dopisku o wyczerpaniu zapasów.
  const w = wycenZMagazynu(PLYTA(), { odcinki: KUCHNIA, opcje: OPCJE }, PO_SEZONIE);
  assert.equal(w.ok, true, w.blad);
  assert.equal(w.promo, null, 'po sezonie plakietka promocji nie ma prawa zostać');
  assert.ok(Math.abs(nettoM2(w) - 1400 / 1.23) < 0.5, `netto/m2 = ${nettoM2(w)}`);
  assert.ok(!w.ostrzezenia.some((o) => /wyczerpania zapasów/.test(o)));

  // Bez podanego dnia liczy się DZIŚ — i też ma być po cenie magazynowej,
  // dopóki Dawid nie zdecyduje o nowej kampanii.
  const dzisiaj = wycenZMagazynu(PLYTA(), { odcinki: KUCHNIA, opcje: OPCJE });
  const wciazTrwa = new Date().toISOString().slice(0, 10) <= '2026-09-30';
  assert.equal(!!dzisiaj.promo, wciazTrwa);
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

/* ═══════════════════ PROMOCJA PAŹDZIERNIK–GRUDZIEŃ 2026 (Architype) ═══ */

/*
 * Ulotka „PROMOCJE październik–grudzień 2026": trzy kolekcje Architype
 * (Avant Quartz, Caesarstone, Keralini), czas trwania 01.10–30.12.2026
 * „lub do wyczerpania zapasów". Zasada ta sama co w sezonie letnim:
 * do klienta idzie TAŃSZA z dwóch cen, a po ostatnim dniu kampanii
 * wszystko wraca do cennika stałego bez niczyjej ingerencji.
 */
const W_JESIENI = '2026-11-15';
const PO_JESIENI = '2027-01-10';

const licz = (slug, dekor, grubosc, dzien) =>
  wycen(FIRMY.find((f) => f.slug === slug), { dekor, grubosc, odcinki: KUCHNIA, opcje: OPCJE }, dzien);

test('jesień: Avant, Caesarstone i Keralini licz\u0105 z ceny promocyjnej', () => {
  // Ceny klienckie = cena po rabacie z ulotki × 1,45 — TA SAMA reguła, co
  // w kampanii letniej Architype (Dawid, 9.10.2026). Mnożnik 1,30 dotyczy
  // cennika BAZOWEGO tych marek i nie miesza się z promocyjnym.
  for (const [slug, dekor, grubosc, oczekiwana] of [
    ['avant-quartz', 'Dijon', '20', 566],              // 390 × 1,45
    ['avant-quartz', 'Calacatta Dauphine', '20', 929], // 641 × 1,45
    ['caesarstone', 'Jet Black', '20', 798],           // 550 × 1,45
    ['keralini', 'Grey Soap', '12', 574],              // 396 × 1,45
  ]) {
    const w = licz(slug, dekor, grubosc, W_JESIENI);
    assert.equal(w.ok, true, w.blad);
    assert.ok(
      Math.abs(nettoM2(w) - oczekiwana) < 0.51,
      `${slug}/${dekor}: ${nettoM2(w)} zamiast ${oczekiwana}`
    );
    assert.equal(w.promo?.nazwa, 'Promocja pa\u017adziernik\u2013grudzie\u0144 2026');
  }
});

test('jesie\u0144: wygrywa TA\u0143SZA z dw\u00f3ch cen, nie zawsze promocyjna', () => {
  /*
   * Promocja nie mo\u017ce podnie\u015b\u0107 ceny \u2014 gdyby dekor by\u0142 w cenniku ta\u0144szy
   * ni\u017c na ulotce, klient ma zap\u0142aci\u0107 mniej, a plakietki promocji nie ma.
   */
  const avant = FIRMY.find((f) => f.slug === 'avant-quartz');
  const kampania = avant.promocje.find((k) => k.nazwa === 'Promocja pa\u017adziernik\u2013grudzie\u0144 2026');
  assert.ok(kampania, 'brak kampanii jesiennej w rejestrze firm');

  for (const [klucz, cenaPromo] of Object.entries(kampania.ceny)) {
    const nazwa = klucz.slice(0, klucz.lastIndexOf('||'));
    const gr = klucz.slice(klucz.lastIndexOf('||') + 2);
    const stala = avant.dekory[nazwa]?.[gr];
    if (typeof stala !== 'number') continue; // dekor wy\u0142\u0105cznie promocyjny
    const w = licz('avant-quartz', nazwa, gr, W_JESIENI);
    assert.ok(
      Math.abs(nettoM2(w) - Math.min(cenaPromo, stala)) < 0.51,
      `${nazwa}: policzono ${nettoM2(w)}, a ta\u0144sza z cen to ${Math.min(cenaPromo, stala)}`
    );
  }
});

test('jesie\u0144: po 30.12.2026 ceny wracaj\u0105 do cennika sta\u0142ego', () => {
  const po = licz('caesarstone', 'White Attica', '20', PO_JESIENI);
  assert.equal(po.ok, true, po.blad);
  assert.equal(po.promo, null, 'po ostatnim dniu kampanii plakietki nie ma');
  assert.ok(Math.abs(nettoM2(po) - 1430) < 0.51, `po kampanii: ${nettoM2(po)} zamiast 1430`);

  // Dekory wy\u0142\u0105cznie promocyjne znikaj\u0105 z katalogu razem z kampani\u0105.
  const avantPo = FIRMY.find((f) => f.slug === 'avant-quartz');
  assert.ok(avantPo.dekory['Botticiono Burges'], 'w czasie kampanii dekor ma by\u0107 wybieralny');
});

test('jesie\u0144: wycena promocyjna niesie dopisek o dost\u0119pno\u015bci', () => {
  const w = licz('keralini', 'Portoro', '12', W_JESIENI);
  assert.equal(w.promo?.nazwa, 'Promocja pa\u017adziernik\u2013grudzie\u0144 2026');
  assert.equal(w.promo?.do, '2026-12-30', 'data ko\u0144ca z ulotki, nie z pami\u0119ci');
});

test('jesie\u0144: ceny ZAKUPOWE z ulotki nie wyciek\u0142y do plik\u00f3w dla klienta', () => {
  /*
   * Pr\u00f3bka kwot hurtowych z ulotki X\u2013XII. \u017badna nie ma prawa pojawi\u0107 si\u0119
   * w `src/generated` jako cena \u2014 tam id\u0105 wy\u0142\u0105cznie kwoty ko\u0144cowe.
   */
  const zakupy = [390, 310, 450, 300, 381, 499, 735, 641, 409, 646, 540, 550, 800, 594, 396, 389, 449, 580];
  for (const plik of ['avant-quartz.promocje.json', 'caesarstone.promocje.json', 'keralini.promocje.json']) {
    const tekst = fs.readFileSync(new URL(`../src/generated/${plik}`, import.meta.url), 'utf8');
    const dane = JSON.parse(tekst);
    const jesien = dane.kampanie.find((k) => k.nazwa === 'Promocja pa\u017adziernik\u2013grudzie\u0144 2026');
    assert.ok(jesien, `${plik}: brak kampanii jesiennej`);
    for (const z of zakupy) {
      assert.ok(
        !Object.values(jesien.ceny).includes(z),
        `${plik}: kwota zakupowa ${z} w cenach dla klienta`
      );
    }
  }
});

test('jesień: Mulen — promocja ma pierwszeństwo przed nowym cennikiem', () => {
  /*
   * Decyzja Dawida 9.10.2026: cena bazowa Mulena 20 mm idzie z cennika 2026
   * (1 059 zakupowe), ale dekor jest na ulotce — a promocja zawsze wygrywa.
   * Do 30.12 klient widzi 646 × 1,45, od 31.12 cennik stały 1 059 × 1,30.
   *
   * Ten test pilnuje OBU końców naraz, bo pomyłka w którąkolwiek stronę
   * jest kosztowna: za nisko — sprzedaż po cenie, której nie ma w ulotce,
   * za wysoko — klient dostaje w kalkulatorze więcej, niż Dawid obiecuje.
   */
  const wKampanii = licz('avant-quartz', 'Mulen', '20', W_JESIENI);
  assert.ok(Math.abs(nettoM2(wKampanii) - 937) < 0.51, `w kampanii: ${nettoM2(wKampanii)} zamiast 937`);
  assert.equal(wKampanii.promo?.nazwa, 'Promocja październik–grudzień 2026');

  const poKampanii = licz('avant-quartz', 'Mulen', '20', PO_JESIENI);
  assert.ok(Math.abs(nettoM2(poKampanii) - 1377) < 0.51, `po kampanii: ${nettoM2(poKampanii)} zamiast 1377`);
  assert.equal(poKampanii.promo, null);

  // 1 377 = 1 059 z cennika 2026 × 1,30 — gdyby ktoś wrócił do starych 1 106,
  // wyszłoby 1 438 i ten test by to złapał.
  assert.equal(FIRMY.find((f) => f.slug === 'avant-quartz').dekory.Mulen['20'], 1377);
});

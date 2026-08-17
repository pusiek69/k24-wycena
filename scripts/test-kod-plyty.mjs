/**
 * Kamień naturalny WYŁĄCZNIE ze wskazaną płytą.
 *
 *   node --test scripts/test-kod-plyty.mjs
 *
 * Każdy blok kamienia naturalnego ma własną cenę, wymiar i dostępność —
 * różnica między blokami tego samego wzoru sięga kilkuset złotych za m².
 * Wycena „z metra", bez wskazania płyty, wychodziła przez to systematycznie
 * poniżej realnej ceny. Od 17.08.2026 bez kodu płyty nie liczymy nic.
 *
 * Konglomeratów i spieków to NIE dotyczy — te mają cennik katalogowy.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { wycen } from '../src/engine/wycena.js';
import { ROBOCIZNA, OPCJE } from '../src/firms/_domyslne.js';
import { normalizujKod, znajdzPoKodzie, wygladaJakKod } from '../worker/magazyn.js';
import { wariantZPlyty, normalizujKodPlyty } from '../src/app/plyta-kod.js';
import { wczytajSilnik } from './lib/silnik.mjs';

const NATURALNY = {
  slug: 'test-naturalny',
  nazwa: 'Kamień naturalny',
  typ: 'granit · marmur · kwarcyt',
  aktywna: true,
  trybCeny: 'reczna',
  cenaRecznaJest: 'brutto',
  rozliczenieMaterialu: 'plyty',
  cenyUslug: 'brutto',
  plyta: { w: 300, h: 180, polowkaDozwolona: false },
  robocizna: ROBOCIZNA,
  opcje: OPCJE,
  wymagaKoduPlyty: true,
};

const KONGLOMERAT = {
  ...NATURALNY,
  slug: 'test-konglomerat',
  nazwa: 'Konglomerat',
  typ: 'konglomerat kwarcowy',
  trybCeny: 'katalog',
  dekory: { Testowy: { 20: 800 } },
  wymagaKoduPlyty: false,
};

const ODCINKI = [{ gl: 60, dl: 120 }];
const OPCJE_BAZOWE = { zlew: 'podblat', plyta: 'brak', otwory: 1, dostawa: 'montaz' };
const KOD = 'STON000334-84224';

/** Prawdziwa płyta ze stanu magazynowego — kształt jak po wariantZPlyty. */
const PLYTA = {
  kod: 'STON000596-85645',
  nazwa: 'CALACATTA PAONAZZINO',
  rodzaj: 'Kamień naturalny',
  cenaBruttoM2: 1665,
  gruboscMm: 20,
  dostepneM2: 6.33,
  plytaCm: { dl: 333, gl: 190 },
};

const liczNaturalny = (dodatkowe = {}) =>
  wycen(NATURALNY, { odcinki: ODCINKI, opcje: OPCJE_BAZOWE, cenaRecznaM2: 1400, ...dodatkowe });

/* ───────────────────────────────────────── bez kodu nie ma wyceny */

test('kamień naturalny bez kodu płyty nie przechodzi do wyceny', () => {
  const w = liczNaturalny();
  assert.equal(w.ok, false);
  assert.equal(w.brakKoduPlyty, true, 'front po tym pozna, że ma pokazać wybór płyty');
});

test('komunikat mówi wprost, czego brakuje', () => {
  const w = liczNaturalny();
  assert.match(w.blad, /kod/i);
  assert.match(w.blad, /płyt/i);
});

test('sama cena z metra nie wystarczy — to była właśnie zabijana ścieżka', () => {
  const w = liczNaturalny({ cenaRecznaM2: 1400, kodPlyty: '' });
  assert.equal(w.ok, false);
});

/* ─────────────────────────────────────── z kodem liczy jak dotąd */

test('z kodem wycena przechodzi i liczy całe płyty', () => {
  const w = liczNaturalny({ kodPlyty: KOD });
  assert.equal(w.ok, true);
  // Blat 0,72 m² z płyty 300×180 — płacimy za całą płytę, nie za metraż.
  assert.ok(w.pak.m2Kupione > w.pak.m2Blatu * 5, `m² kupione ${w.pak.m2Kupione}`);
  assert.ok(w.materialBrutto > 0);
});

test('kod trafia do wyniku i na pozycję materiału', () => {
  const w = liczNaturalny({ kodPlyty: KOD, dekor: 'Kwarcyt' });
  assert.equal(w.kodPlyty, KOD);
  const material = w.pozycje.find((p) => p.grupa === 'materiał');
  assert.match(material.nazwa, new RegExp(KOD));
});

test('bez kodu przy konglomeracie nic się nie zmienia', () => {
  const w = wycen(KONGLOMERAT, {
    dekor: 'Testowy',
    grubosc: '20',
    odcinki: ODCINKI,
    opcje: OPCJE_BAZOWE,
  });
  assert.equal(w.ok, true);
  assert.equal(w.kodPlyty, null);
});

test('spiek i konglomerat z Interstone też liczą się bez kodu', () => {
  // InterQ i Laminam sprzedaje się z katalogu — wymóg dotyczy tylko naturali.
  const interQ = { ...NATURALNY, wymagaKoduPlyty: false };
  assert.equal(wycen(interQ, { odcinki: ODCINKI, opcje: OPCJE_BAZOWE, cenaRecznaM2: 900 }).ok, true);
});

/* ──────────────────────────────────────────── format i szukanie kodu */

test('kod normalizuje się niezależnie od zapisu klienta', () => {
  // Zgłoszenie Dawida: „STON000623 - 86421" ze spacjami wokół myślnika.
  // Klient przepisuje kod ręcznie ze strony magazynu i robi to po swojemu.
  for (const zapis of [
    'STON000334 - 84224',
    'ston000334-84224',
    ' STON000334  -  84224 ',
    'STON000334–84224', // półpauza zamiast dywizu
    'STON000334 84224', // sama spacja, bez myślnika
    'STON000334_84224',
    'STON000334/84224',
    'STON000334.84224',
    'STON00033484224', // zupełnie bez separatora
    'ston000334 – 84224',
  ]) {
    assert.equal(normalizujKod(zapis), KOD, `zapis: ${zapis}`);
    assert.equal(normalizujKodPlyty(zapis), KOD, `front, zapis: ${zapis}`);
  }
});

test('front i worker normalizują identycznie', () => {
  // Dwie kopie tej samej zasady — front sprawdza format bez sieci,
  // worker przed odpytaniem magazynu. Rozjazd oznaczałby kod przyjęty
  // w polu i odrzucony przy wyszukiwaniu.
  for (const zapis of ['LAMF000046 - 86549', 'idyfn00241-84488', 'STON000623 86421', 'bzdura', '']) {
    assert.equal(normalizujKod(zapis), normalizujKodPlyty(zapis), `zapis: ${JSON.stringify(zapis)}`);
  }
});

test('prefiks nie musi być STON — magazyn ma też LAMF i IDYFN', () => {
  assert.equal(normalizujKod('LAMF000046 - 86549'), 'LAMF000046-86549');
  assert.equal(normalizujKod('IDYFN00241 - 84488'), 'IDYFN00241-84488');
});

test('to, co nie jest kodem, odpada', () => {
  // „STONE000334-84224" NIE jest tu odrzucane: literówki w prefiksie nie da
  // się odróżnić od nieznanej serii, więc format przepuszczamy, a brak takiej
  // płyty wychodzi dopiero przy wyszukiwaniu — z czytelnym komunikatem.
  for (const zly of ['', null, 'calacatta', 'STON334-1', '000334-84224', '84224']) {
    assert.equal(normalizujKod(zly), '', `zapis: ${JSON.stringify(zly)}`);
    assert.equal(wygladaJakKod(zly), false);
  }
});

/* ──────────────── surowa płyta z magazynu → wariant dla wyceny */

test('płyta z magazynu dostaje wymiar dłuższym bokiem naprzód', () => {
  // `/magazyn` oddaje `formatCm: {wys, szer}` — wys bywa krótszym bokiem.
  // Pomylona orientacja to pomylona liczba płyt w pakowaniu.
  const w = wariantZPlyty({ kod: KOD, nazwa: 'CALACATTA', formatCm: { wys: 195, szer: 343 } });
  assert.deepEqual(w.plytaCm, { dl: 343, gl: 195 });
  assert.equal(w.kod, KOD, 'reszta danych płyty zostaje');
});

test('płyta bez formatu nie przechodzi dalej', () => {
  assert.equal(wariantZPlyty({ kod: KOD, nazwa: 'X' }), null);
  assert.equal(wariantZPlyty(null), null);
});

/* ─────────── cała ścieżka naturalnego, na prawdziwych modułach aplikacji

   Te testy ładują wycena-naturalny.js przez ten sam mechanizm co reszta
   skryptów. Wcześniej moduł był poza zasięgiem testów (ciągnie firms/index.js
   z import.meta.glob) i właśnie tam pojechał na produkcję `uprosc is not
   defined` — funkcja zniknęła przy przenoszeniu sąsiednich helperów.
   Odtąd każda wycena naturalnego przechodzi tędy w teście.                */

test('wskazana płyta przechodzi całą ścieżkę i daje kwotę', async () => {
  const { wycenZMagazynu } = await wczytajSilnik();
  const w = wycenZMagazynu(PLYTA, {
    odcinki: [{ gl: 60, dl: 300 }],
    opcje: { zlew: 'podblat', plyta: 'nakladana', otwory: 1, dostawa: 'montaz' },
    grubosc: '20',
  });
  assert.equal(w.ok, true, w.blad);
  assert.ok(w.razem > 0);
  assert.equal(w.kodPlyty, 'STON000596-85645');
});

test('rozpoznanie kamienia naturalnego działa', async () => {
  const { jestNaturalny } = await wczytajSilnik();
  assert.equal(jestNaturalny(PLYTA), true);
  assert.equal(jestNaturalny({ rodzaj: 'Konglomerat kwarcowy' }), false);
  assert.equal(jestNaturalny({}), false);
});

test('konfiguracja z płyty wymusza kod tylko przy naturalnym', async () => {
  const { firmaZWariantu } = await wczytajSilnik();
  assert.equal(firmaZWariantu(PLYTA).wymagaKoduPlyty, true);
  assert.equal(firmaZWariantu({ ...PLYTA, rodzaj: 'Konglomerat' }).wymagaKoduPlyty, false);
});

test('bez kodu ta sama płyta nie przechodzi', async () => {
  const { wycenZMagazynu } = await wczytajSilnik();
  const w = wycenZMagazynu({ ...PLYTA, kod: null }, {
    odcinki: [{ gl: 60, dl: 300 }],
    opcje: { zlew: 'podblat', plyta: 'nakladana', otwory: 1, dostawa: 'montaz' },
    grubosc: '20',
  });
  assert.equal(w.ok, false);
  assert.equal(w.brakKoduPlyty, true);
});

/* ───────── rozkrój i cena z konkretnej sztuki, nie z domyślnych */

test('wymiar rozkroju bierze się z płyty, nie z konfiguracji firmy', async () => {
  const { wycenZMagazynu } = await wczytajSilnik();
  const dla = (dl, gl) =>
    wycenZMagazynu(
      { ...PLYTA, plytaCm: { dl, gl } },
      { odcinki: [{ gl: 60, dl: 300 }], opcje: { zlew: 'podblat', otwory: 1 }, grubosc: '20' }
    );
  const krotka = dla(290, 195);
  const dluga = dla(310, 195);

  // Interstone ma w konfiguracji domyślne 300×180. Gdyby wchodziło w grę,
  // obie wyceny miałyby ten sam materiał.
  assert.notEqual(krotka.pak.m2Kupione, dluga.pak.m2Kupione);
  assert.ok(Math.abs(krotka.pak.m2Kupione - (290 * 195) / 10000) < 0.01);
  assert.ok(Math.abs(dluga.pak.m2Kupione - (310 * 195) / 10000) < 0.01);
});

test('za krótka płyta daje ostrzeżenie o łączeniu, a nie cichy rozkrój', async () => {
  const { wycenZMagazynu } = await wczytajSilnik();
  const w = wycenZMagazynu(
    { ...PLYTA, plytaCm: { dl: 290, gl: 195 } },
    { odcinki: [{ gl: 60, dl: 300 }], opcje: { zlew: 'podblat', otwory: 1 }, grubosc: '20' }
  );
  assert.ok(w.ostrzezenia.some((o) => /łączon/i.test(o)), JSON.stringify(w.ostrzezenia));
});

test('cena materiału bierze się z ceny tej sztuki', async () => {
  const { wycenZMagazynu } = await wczytajSilnik();
  const dla = (cena) =>
    wycenZMagazynu(
      { ...PLYTA, cenaBruttoM2: cena },
      { odcinki: [{ gl: 60, dl: 300 }], opcje: { zlew: 'podblat', otwory: 1 }, grubosc: '20' }
    );
  const tania = dla(1000);
  const droga = dla(2000);
  assert.ok(Math.abs(droga.materialBrutto / tania.materialBrutto - 2) < 0.001);
});

test('płyta bez ceny w magazynie nie przechodzi — zamiast „do ustalenia"', async () => {
  const { wycenZMagazynu } = await wczytajSilnik();
  const w = wycenZMagazynu(
    { ...PLYTA, cenaBruttoM2: 0 },
    { odcinki: [{ gl: 60, dl: 300 }], opcje: { zlew: 'podblat', otwory: 1 }, grubosc: '20' }
  );
  assert.equal(w.ok, false);
  assert.equal(w.brakCenyPlyty, true);
});

test('szukanie płyty po kodzie ignoruje różnice zapisu', () => {
  const plyty = [
    { kod: 'STON000111 - 11111', nazwa: 'A', dostepneM2: 5 },
    { kod: 'STON000334 - 84224', nazwa: 'B', dostepneM2: 12 },
  ];
  assert.equal(znajdzPoKodzie(plyty, 'ston000334-84224')?.nazwa, 'B');
  assert.equal(znajdzPoKodzie(plyty, 'STON000999-00000'), null);
  assert.equal(znajdzPoKodzie(plyty, 'byle co'), null);
});

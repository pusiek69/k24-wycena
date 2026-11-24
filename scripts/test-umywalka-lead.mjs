/**
 * UMYWALKA: FORMULARZ, ZGŁOSZENIE I ŚCIEŻKA LEADA.
 *
 *   node --test scripts/test-umywalka-lead.mjs
 *
 * Dwie rzeczy są tu ważniejsze niż sama umywalka:
 *
 * 1. KLIENT MA WIDZIEĆ TEN SAM FORMULARZ, co przy wycenie blatu. Decyzja
 *    Dawida z 23.11.2026. `app/bramka.js` nie eksportuje walidacji, a edytować
 *    go nie wolno (lejek blatów musi zostać nietknięty), więc w umywalce stoi
 *    jej KOPIA — i ten test pilnuje, żeby obie wersje nie rozjechały się
 *    po cichu.
 *
 * 2. ZGŁOSZENIE BLATU MA IŚĆ DOKŁADNIE TAK, JAK SZŁO. Umywalka dokłada
 *    jedno pole (`produkt`), po którym worker rozpoznaje inny temat, inny
 *    szablon maila i dopisek w SMS-ie. Bez tego pola nie ma prawa zmienić
 *    się ani jeden znak.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { trescSmsLead } from '../worker/sms.js';

const czytaj = (sciezka) => fs.readFileSync(new URL('../' + sciezka, import.meta.url), 'utf8');

const BRAMKA = czytaj('src/app/bramka.js');
const FORMULARZ = czytaj('src/umywalka/formularz.js');
const SZABLON = czytaj('worker/worker.template.js');

/** Ciało funkcji `sprawdz` z pliku — do porównania znak w znak. */
function walidacja(zrodlo) {
  const od = zrodlo.indexOf('function sprawdz(d) {');
  assert.notEqual(od, -1, 'nie znalazłem funkcji sprawdz()');
  const do_ = zrodlo.indexOf('\n}', od);
  return zrodlo
    .slice(od, do_)
    // Komentarze różnią się (w kopii stoi informacja, że to kopia) —
    // porównujemy sam kod i komunikaty.
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ═══════════════════════════════════════════ formularz 1:1 */

test('walidacja formularza umywalki jest kopią 1:1 z bramki blatów', () => {
  assert.equal(walidacja(FORMULARZ), walidacja(BRAMKA));
});

test('kopia jest oznaczona jako kopia — żeby ktoś zmienił obie naraz', () => {
  assert.match(FORMULARZ, /KOPIA 1:1 z `app\/bramka\.js#sprawdz`/);
});

test('te same pola i te same klasy CSS co przy blacie', () => {
  for (const pole of ['imie', 'telefon', 'email', 'miejscowosc', 'termin', 'telefonZgoda', 'zgoda']) {
    assert.ok(FORMULARZ.includes(`'${pole}'`) || FORMULARZ.includes(`"${pole}"`), `brak pola ${pole}`);
  }
  for (const klasa of ['lead-form', 'form-siatka', 'tel-wybor', 'switch zgoda', 'form-blad', 'bramka-karta']) {
    assert.ok(FORMULARZ.includes(klasa), `brak klasy ${klasa}`);
    assert.ok(BRAMKA.includes(klasa), `klasa ${klasa} zniknęła z bramki blatów`);
  }
});

test('formularz umywalki bierze listy z tych samych modułów co blaty', () => {
  assert.match(FORMULARZ, /from '\.\.\/app\/termin\.js'/);
  assert.match(FORMULARZ, /from '\.\.\/app\/kontakt-telefon\.js'/);
  assert.match(FORMULARZ, /wyslijLead, wyslijLeadZapasowo/);
});

test('umywalka NIE woła konwersji leada blatowego', () => {
  const zdarzenia = czytaj('src/umywalka/zdarzenia.js');
  // Komentarze odcinamy: w nich te nazwy padają właśnie po to, żeby
  // wyjaśnić, dlaczego umywalka ich NIE woła.
  const bezKomentarzy = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const zrodlo of [FORMULARZ, zdarzenia, czytaj('src/umywalka/main.js')]) {
    const kod = bezKomentarzy(zrodlo);
    assert.ok(!kod.includes('konwersjaLead'), 'umywalka nie może ruszać lejka blatów');
    assert.ok(!kod.includes('lead_wyslany'), 'umywalka nie może wysyłać lead_wyslany');
  }
  // ...a własne zdarzenia ma.
  for (const nazwa of ['umywalka_start', 'umywalka_krok', 'umywalka_formularz', 'umywalka_lead']) {
    assert.ok(zdarzenia.includes(nazwa), `brak zdarzenia ${nazwa}`);
  }
});

test('zgłoszenie umywalki niesie produkt i rozbicie dla Dawida', () => {
  assert.match(FORMULARZ, /produkt: 'umywalka'/);
  for (const pole of ['formatki', 'polowka', 'm2Platne', 'pozycje', 'stawkaVat', 'konfiguracja']) {
    assert.ok(FORMULARZ.includes(pole + ':'), `brak ${pole} w szczegółach dla Dawida`);
  }
});

/* ═══════════════════════════════════════════ worker: blat bez zmian */

test('worker rozpoznaje umywalkę po polu produkt', () => {
  assert.match(SZABLON, /const umywalka = String\(d\.produkt \|\| ''\) === 'umywalka'/);
});

test('temat do Dawida: UMYWALKA z przodu, blat dokładnie jak dotąd', () => {
  assert.match(SZABLON, /subject: \(umywalka \? 'UMYWALKA — ' : ''\) \+ tematLeada\(klient, szczegoly, wycena\)/);
});

test('mail do klienta: osobny szablon umywalki, blatowy nietknięty', () => {
  assert.match(SZABLON, /'Pana\/Pani wycena umywalki — Kamieniarstwo 24h'/);
  assert.match(SZABLON, /'Pana\/Pani wycena blatu — Kamieniarstwo 24h'/);
  assert.match(SZABLON, /function mailDoKlientaUmywalka\(imie, wycena, szczegoly, zWizualizacja\)/);
  assert.match(SZABLON, /mailDoKlienta\(imie, wycena, uwaga, linkPlyty, szczegoly\)/);
});

test('mail umywalkowy nie zdradza warsztatu', () => {
  const od = SZABLON.indexOf('function mailDoKlientaUmywalka');
  const tresc = SZABLON.slice(od, SZABLON.indexOf('function mailDoKlienta(', od));
  for (const slowo of ['m.b.', 'formatk', 'rozkr', 'marż', 'rabat']) {
    assert.ok(!tresc.includes(slowo), `mail do klienta nie może zawierać „${slowo}"`);
  }
});

test('wizualizacja umywalki jedzie zalacznikiem do obu maili', () => {
  // Obrazek powstaje w przegladarce klienta i ma trafic i do niego,
  // i do Dawida — klient pokaze go w domu, Dawid od razu widzi konfiguracje.
  assert.match(SZABLON, /const wizualizacja =/);
  assert.match(SZABLON, /umywalka-wizualizacja\.jpg/);
  assert.match(SZABLON, /\[\.\.\.zalaczniki, \.\.\.wizualizacja\]/);
  // Limit rozmiaru, zeby nie probowac wyslac czegos, czego poczta nie przyjmie.
  assert.match(SZABLON, /6_000_000/);
});

test('zgloszenie blatu nie dostaje pola wizualizacji', () => {
  // Warunek `umywalka &&` pilnuje, zeby sciezka blatow zostala bez zmian.
  assert.match(SZABLON, /umywalka && typeof d\.wizualizacja === 'string'/);
});

/* ═══════════════════════════════════════════ SMS */

test('SMS o blacie brzmi dokładnie tak jak przed zmianą', () => {
  const sms = trescSmsLead({
    imie: 'Anna',
    miejscowosc: 'Tarnobrzeg',
    telefon: '600100200',
    kwota: 7200,
    material: 'Keralini Absolute',
    pilne: false,
    nieDzwonic: false,
  });
  // Bez spacji w tysiącach — `doGsm` sprowadza treść do znaków GSM-7,
  // żeby SMS zmieścił się w jednym segmencie.
  assert.equal(sms, 'Nowa wycena: Anna tel 600100200. Tarnobrzeg, 7200 zl, Keralini Absolute');
});

test('SMS o blacie z flagami — też bez zmian', () => {
  const sms = trescSmsLead({
    imie: 'Anna',
    miejscowosc: 'Mielec',
    telefon: '600100200',
    kwota: 5200,
    material: 'Avant Clermont',
    pilne: true,
    nieDzwonic: true,
  });
  assert.match(sms, /^NIE DZWONIC \(woli mail\) PILNE Nowa wycena: Anna/);
});

test('SMS o umywalce zaczyna się od słowa UMYWALKA', () => {
  const sms = trescSmsLead({
    imie: 'Anna',
    miejscowosc: 'Tarnobrzeg',
    telefon: '600100200',
    kwota: 5200,
    material: 'Keralini Absolute White Structured',
    pilne: false,
    nieDzwonic: false,
    produkt: 'UMYWALKA',
  });
  assert.match(sms, /^UMYWALKA Nowa wycena: Anna/);
});

/* ════════════════════════ rozbicie dla Dawida — na prawdziwym zgłoszeniu */

/*
 * ZGŁOSZENIE TESTOWE DAWIDA (24.11.2026) pokazało, czego regexy po
 * źródle nie widzą: mail do firmy renderuje SZABLON BLATÓW, a ten czyta
 * `mb`, `materialBrutto`, `uslugiBrutto` i flagę `wCenie`. Umywalka
 * wysyłała własne nazwy, więc Dawid dostał w nagłówku „0 m.b.", pod
 * rozbiciem „materiał 0 zł · usługi 0 zł", a w pozycjach wiersz
 * „Wycięcie pod umywalkę podblatową — 0 zł" przy zamówieniu na zlew
 * wycięty w kamieniu. Dlatego tutaj liczymy prawdziwą wycenę i oglądamy
 * ładunek, który poleci do workera.
 */
const { STAN_DOMYSLNY, zacisnij } = await import('../src/umywalka/model.js');
const { wycenUmywalke } = await import('../src/umywalka/wycena-umywalki.js');
const { DOMYSLNE } = await import('../src/app/ustawienia.js');
const { szczegolyUmywalki } = await import('../src/umywalka/formularz.js');
const { wczytajSilnik } = await import('./lib/silnik.mjs');
const silnik = await wczytajSilnik();

function ladunek(zmiany = {}) {
  const stan = zacisnij({
    ...STAN_DOMYSLNY,
    dekor: 'Absolute Naturale',
    L: 120,
    W: 50,
    H: 15,
    sL: 100,
    sW: 35,
    ins: 5,
    ...zmiany,
  });
  const w = wycenUmywalke({
    firma: silnik.FIRMY.find((f) => f.slug === stan.marka),
    stan,
    stawki: DOMYSLNE,
    dataISO: '2026-11-23',
  });
  assert.ok(w.ok, w.blad);
  return { w, s: szczegolyUmywalki(w, 'https://kam24h.pl/umywalka-na-wymiar?x=1') };
}

test('nagłówek maila do Dawida dostaje prawdziwe metry pogrubienia', () => {
  const { w, s } = ladunek();
  assert.ok(w.mb > 0, 'wycena bez metrów — zły przykład kontrolny');
  // Szablon blatów sięga po `s.mb`; `mbKrawedzi` zostaje dla czytelności.
  assert.equal(s.mb, w.mb);
  assert.equal(s.mbKrawedzi, w.mb);
});

test('podsumowanie „materiał · usługi" nie jest zerowe', () => {
  const { w, s } = ladunek();
  assert.ok(s.materialBrutto > 0, 'materiał zerowy');
  assert.ok(s.uslugiBrutto > 0, 'usługi zerowe');
  // Suma musi się domknąć na kwocie, którą widzi klient.
  assert.equal(Math.round(s.materialBrutto + s.uslugiBrutto), Math.round(w.razem));
});

test('pozycja za 0 zł nie trafia do rozbicia', () => {
  // Zlew wycięty w kamieniu: umywalek podblatowych nie ma ani jednej.
  const { s } = ladunek({ mode: 'int' });
  const nazwy = s.pozycje.map((p) => p.nazwa);
  assert.ok(
    !nazwy.some((n) => /podblatow/i.test(n)),
    'przy zlewie w kamieniu wisiała pozycja o umywalce podblatowej'
  );
  for (const p of s.pozycje) {
    assert.ok(p.brutto > 0 || p.wCenie, `pozycja „${p.nazwa}" za 0 zł bez flagi wCenie`);
  }
});

test('świadczenia gratis zachowują flagę wCenie', () => {
  // Bez niej szablon drukuje projekt 3D jako pozycję za 0 zł.
  const { s } = ladunek();
  const projekt = s.pozycje.find((p) => /projekt 3d/i.test(p.nazwa));
  assert.ok(projekt, 'projekt 3D zniknął z rozbicia');
  assert.equal(projekt.wCenie, true);
});

test('każdy z trzech rodzajów nazywa się w zgłoszeniu po swojemu', () => {
  assert.equal(ladunek({ mode: 'int' }).s.typ, 'zlew w kamieniu');
  assert.equal(ladunek({ mode: 'under' }).s.typ, 'blat z otworami pod umywalki podblatowe');
  assert.equal(ladunek({ mode: 'top' }).s.typ, 'blat pod umywalki nablatowe');
});

test('przy umywalkach kupowanych osobno Dawid zna liczbę i rozstaw', () => {
  for (const mode of ['under', 'top']) {
    const { s } = ladunek({ mode, n: 2, L: 200, sL: 45, gap: 15 });
    assert.equal(s.umywalki.ile, 2, `${mode}: zgubiona liczba umywalek`);
    assert.equal(s.umywalki.rodzaj, mode === 'under' ? 'podblatowa' : 'nablatowa');
    assert.equal(s.umywalki.odstep, 15, `${mode}: zgubiony rozstaw`);
    assert.equal(s.zlewy, null, `${mode}: to nie jest zlew w kamieniu`);
  }
  // Przy zlewie w kamieniu ta sama treść siedzi w `zlewy` — bez powtórki.
  const int = ladunek({ mode: 'int' }).s;
  assert.equal(int.umywalki, null);
  assert.ok(int.zlewy.ile >= 1);
});

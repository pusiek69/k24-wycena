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

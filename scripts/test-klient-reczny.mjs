/**
 * KLIENT DODANY RĘCZNIE W PANELU (zlecenie Dawida, 16.09.2026).
 *
 *   node --test scripts/test-klient-reczny.mjs
 *
 * „Chcę w kalkulatorze zbierać WSZYSTKICH klientów — czasem klient przychodzi
 *  do biura i chcę móc go wpisać ręcznie w panelu, poza kalkulatorem."
 *
 * Testy chodzą po prawdziwym SQLu (node:sqlite w atrapie D1), tak jak
 * test-baza-klientow.mjs — literówka w zapytaniu ma wywalić test, a nie
 * wyjść dopiero przy kliencie stojącym przy biurku.
 *
 * NAJWAŻNIEJSZE, CZEGO PILNUJĄ: karta z biura ma wylądować w TEJ SAMEJ
 * tabeli co zgłoszenie z kalkulatora i nie ma prawa zdublować klienta,
 * który już w bazie jest.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { dodajKlientaRecznie, zapiszLead, lista, karta, csv, TEMATY, znanyTemat } from '../worker/baza.js';

const SCHEMAT = fs.readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');

/** Atrapa D1 na node:sqlite — ta sama co w test-baza-klientow.mjs. */
function nowaBaza() {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMAT);
  const baza = {
    prepare(sql) {
      let dane = [];
      const stmt = db.prepare(sql);
      const api = {
        bind(...args) {
          dane = args.map((a) => (a === undefined ? null : typeof a === 'boolean' ? Number(a) : a));
          return api;
        },
        async run() {
          const w = stmt.run(...dane);
          return { meta: { last_row_id: Number(w.lastInsertRowid), changes: Number(w.changes) } };
        },
        async first() {
          return stmt.get(...dane) ?? null;
        },
        async all() {
          return { results: stmt.all(...dane) };
        },
      };
      return api;
    },
  };
  return { BAZA: baza, _db: db };
}

const wiersz = (env, id) => env._db.prepare('SELECT * FROM klienci WHERE id = ?').get(id);
const notatki = (env, id) =>
  env._db.prepare('SELECT * FROM notatki WHERE klient_id = ? ORDER BY id').all(id);

const Z_BIURA = { imie: 'Marek Nowak', telefon: '600 100 300' };

/* ════════════════════════════════════ zakładanie karty ══════════════════ */

test('minimum to imię i telefon — reszta pól jest dobrowolna', async () => {
  const env = nowaBaza();
  const w = await dodajKlientaRecznie(env, Z_BIURA);
  assert.equal(w.ok, true, w.blad);
  assert.equal(w.nowy, true);

  const k = wiersz(env, w.klientId);
  assert.equal(k.imie, 'Marek Nowak');
  assert.equal(k.telefon, '600 100 300');
  assert.equal(k.telefon_klucz, '600100300', 'klucz telefonu liczony jak przy leadzie');
  assert.equal(k.status, 'nowy', 'karta z biura wchodzi na początek lejka');
  assert.equal(k.zrodlo, 'biuro', 'po tym panel pozna „dodany ręcznie"');
  assert.equal(k.wycen, 0);
  assert.equal(k.kwota_ostatnia, 0);
  assert.equal(k.kwota_max, 0);
});

test('karta bez imienia albo bez telefonu nie powstaje', async () => {
  const env = nowaBaza();
  assert.equal((await dodajKlientaRecznie(env, { telefon: '600100300' })).ok, false);
  assert.equal((await dodajKlientaRecznie(env, { imie: 'Marek' })).ok, false);
  // Numer krótszy niż 9 cyfr to zwykle literówka — bez telefonu karta
  // z biura jest bezużyteczna, bo nie ma jak oddzwonić.
  assert.equal((await dodajKlientaRecznie(env, { imie: 'Marek', telefon: '600100' })).ok, false);
  assert.equal(env._db.prepare('SELECT COUNT(*) AS ile FROM klienci').get().ile, 0);
});

test('e-mail jest dobrowolny, ale gdy jest — musi wyglądać jak adres', async () => {
  const env = nowaBaza();
  const zly = await dodajKlientaRecznie(env, { ...Z_BIURA, email: 'marek@' });
  assert.equal(zly.ok, false);
  assert.match(zly.blad, /e-mail/i);

  const bez = await dodajKlientaRecznie(env, Z_BIURA);
  assert.equal(bez.ok, true, 'brak maila nie może blokować zapisu');
  assert.equal(wiersz(env, bez.klientId).email, '');
});

test('temat spoza listy nie wchodzi do bazy', async () => {
  const env = nowaBaza();
  const a = await dodajKlientaRecznie(env, { ...Z_BIURA, temat: 'nagrobek' });
  const b = await dodajKlientaRecznie(env, { imie: 'Ewa Kot', telefon: '600100301', temat: 'cokolwiek' });
  assert.equal(wiersz(env, a.klientId).temat, 'nagrobek');
  assert.equal(wiersz(env, b.klientId).temat, '', 'nieznany temat zapisany jako pusty');
  assert.ok(TEMATY.every((t) => znanyTemat(t.id)));
});

test('notatka z biura ląduje w notatkach, a karta dostaje wpis systemowy', async () => {
  const env = nowaBaza();
  const w = await dodajKlientaRecznie(env, {
    ...Z_BIURA,
    temat: 'blat_kuchenny',
    notatka: 'Przyszedł z wymiarami, chce spiek. Oddzwonić po weekendzie.',
  });
  const n = notatki(env, w.klientId);
  assert.equal(n.length, 2, 'oczekuję wpisu systemowego i notatki Dawida');
  assert.equal(n[0].autor, 'system');
  assert.match(n[0].tresc, /ręcznie w panelu/i);
  assert.match(n[0].tresc, /Blat kuchenny/, 'temat ma być widoczny w logu karty');
  assert.equal(n[1].autor, 'dawid');
  assert.match(n[1].tresc, /chce spiek/);
});

/* ═════════════════════════════════════ zgoda na telefon ═════════════════ */

test('zaznaczona kratka to „tak", NIEzaznaczona to „nie pytaliśmy" — nigdy „nie"', async () => {
  /*
   * ⚠ To jest ta sama reguła, co przy formularzu na stronie (01.09.2026).
   * Gdyby pusta kratka zapisywała się jako 'nie', panel malowałby czerwone
   * „NIE DZWOŃ" komuś, kto o tym nie powiedział ani słowa — a Dawid
   * przestałby dzwonić do klienta, który właśnie stał u niego w biurze.
   */
  const env = nowaBaza();
  const zgoda = await dodajKlientaRecznie(env, { ...Z_BIURA, telefonZgoda: true });
  const bez = await dodajKlientaRecznie(env, { imie: 'Ewa Kot', telefon: '600100301' });
  assert.equal(wiersz(env, zgoda.klientId).telefon_zgoda, 'tak');
  assert.equal(wiersz(env, bez.klientId).telefon_zgoda, '');
});

test('wpis z biura nie kasuje wcześniejszego „nie dzwonić"', async () => {
  const env = nowaBaza();
  await zapiszLead(env, {
    imie: 'Anna Lis',
    telefon: '600100400',
    email: 'anna@example.com',
    telefonZgoda: 'nie',
    szczegoly: { firma: 'avant-quartz', razem: 5000 },
  });
  await dodajKlientaRecznie(env, { imie: 'Anna Lis', telefon: '600100400' });
  const k = env._db.prepare("SELECT * FROM klienci WHERE telefon_klucz = '600100400'").get();
  assert.equal(k.telefon_zgoda, 'nie', 'pusta kratka skasowała odmowę klienta');
});

/* ══════════════════════════════════════ deduplikacja ════════════════════ */

test('klient, który wcześniej liczył blat na stronie, nie dostaje drugiej karty', async () => {
  /*
   * Bez tego Dawid dzwoniłby dwa razy i nie widziałby na karcie z biura,
   * że wycena już jest — a to najdroższa informacja, jaką ma.
   */
  const env = nowaBaza();
  const lead = await zapiszLead(env, {
    imie: 'Anna Lis',
    telefon: '+48 600 100 400',
    email: 'anna@example.com',
    miejscowosc: 'Tarnobrzeg',
    zrodlo: { typ: 'ads', gclid: 'abc' },
    szczegoly: { firma: 'avant-quartz', dekor: 'Bianco', razem: 7200, rodzaj: 'konglomerat' },
  });

  const w = await dodajKlientaRecznie(env, {
    imie: 'Anna Lis-Kowalska',
    telefon: '600100400',
    temat: 'blat_kuchenny',
    notatka: 'Przyszła obejrzeć próbki.',
  });

  assert.equal(w.ok, true, w.blad);
  assert.equal(w.istnial, true, 'panel musi wiedzieć, że dopisał się do istniejącej karty');
  assert.equal(w.klientId, lead.klientId);
  assert.equal(env._db.prepare('SELECT COUNT(*) AS ile FROM klienci').get().ile, 1, 'zdublowana karta');

  const k = wiersz(env, lead.klientId);
  assert.equal(k.wycen, 1, 'dopisanie z biura nie może ruszać licznika wycen');
  assert.equal(k.kwota_ostatnia, 7200, 'kwota z kalkulatora ma zostać');
  assert.equal(k.zrodlo, 'ads', 'kartę założył kalkulator — źródło się nie zmienia');
  assert.equal(k.imie, 'Anna Lis-Kowalska', 'świeższe dane z biura wygrywają');
  assert.equal(k.temat, 'blat_kuchenny');

  const n = notatki(env, lead.klientId).map((x) => x.tresc).join('\n');
  assert.match(n, /karta już istniała/i, 'log nie mówi, co się stało');
  assert.match(n, /imię: Anna Lis → Anna Lis-Kowalska/, 'zmiana danych ma zostać w logu');
  assert.match(n, /próbki/);
});

test('ten sam mail, inny numer — to nadal jeden klient', async () => {
  const env = nowaBaza();
  const lead = await zapiszLead(env, {
    imie: 'Jan Bąk',
    telefon: '600100500',
    email: 'jan@example.com',
    szczegoly: { firma: 'avant-quartz', razem: 4000 },
  });
  const w = await dodajKlientaRecznie(env, {
    imie: 'Jan Bąk',
    telefon: '600100501',
    email: 'JAN@example.com',
  });
  assert.equal(w.istnial, true);
  assert.equal(w.klientId, lead.klientId);
  assert.equal(wiersz(env, lead.klientId).telefon, '600100501', 'nowszy numer wygrywa');
});

test('klient z biura, który potem sam policzy blat, zostaje na swojej karcie', async () => {
  const env = nowaBaza();
  const w = await dodajKlientaRecznie(env, { ...Z_BIURA, temat: 'blat_kuchenny' });
  await zapiszLead(env, {
    imie: 'Marek Nowak',
    telefon: '600100300',
    email: 'marek@example.com',
    szczegoly: { firma: 'avant-quartz', dekor: 'Grey', razem: 6100, rodzaj: 'konglomerat' },
  });

  assert.equal(env._db.prepare('SELECT COUNT(*) AS ile FROM klienci').get().ile, 1);
  const k = wiersz(env, w.klientId);
  assert.equal(k.wycen, 1);
  assert.equal(k.kwota_ostatnia, 6100);
  assert.equal(k.zrodlo, 'biuro', 'karta nadal pochodzi z biura — plakietka zostaje');
  assert.equal(k.email, 'marek@example.com', 'mail z kalkulatora uzupełnia kartę');
});

/* ════════════════════════════════════ widok w panelu ════════════════════ */

test('panel dostaje wprost: karta ręczna, temat i brak wycen', async () => {
  const env = nowaBaza();
  const w = await dodajKlientaRecznie(env, { ...Z_BIURA, temat: 'nagrobek' });
  await zapiszLead(env, {
    imie: 'Ewa Kot',
    telefon: '600100600',
    email: 'ewa@example.com',
    szczegoly: { firma: 'avant-quartz', razem: 5200 },
  });

  const wszyscy = await lista(env, {});
  const zBiura = wszyscy.find((k) => k.id === w.klientId);
  const zKalkulatora = wszyscy.find((k) => k.id !== w.klientId);

  assert.equal(zBiura.reczny, true);
  assert.equal(zBiura.temat, 'nagrobek');
  assert.equal(zBiura.tematNazwa, 'Nagrobek', 'panel pokazuje nazwę, nie identyfikator');
  assert.equal(zBiura.wycen, 0, 'po tym panel wie, że nie ma czego „powtarzać"');
  assert.equal(zKalkulatora.reczny, false, 'lead nie może dostać plakietki „ręcznie"');
  assert.equal(zKalkulatora.tematNazwa, '');

  const pelna = await karta(env, w.klientId);
  assert.deepEqual(pelna.wyceny, [], 'karta z biura nie ma wycen');
  assert.equal(pelna.notatki.length, 1, 'ale ma wpis, skąd się wzięła');
});

test('CSV wywozi temat razem z resztą karty', async () => {
  const env = nowaBaza();
  await dodajKlientaRecznie(env, { ...Z_BIURA, temat: 'blat_lazienkowy' });
  const [naglowek, wiersz1] = (await csv(env)).replace('﻿', '').split('\r\n');
  assert.match(naglowek, /;zrodlo;temat;/);
  assert.match(wiersz1, /"biuro";"Blat łazienkowy"/);
});

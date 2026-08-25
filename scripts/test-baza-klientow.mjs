/**
 * BAZA KLIENTÓW — deduplikacja, flagi, lejek, retencja.
 *
 *   node --test scripts/test-baza-klientow.mjs
 *
 * Testy chodzą po prawdziwym SQLu — na node:sqlite opakowanym w atrapę
 * interfejsu D1 (prepare/bind/run/first/all). Dzięki temu sprawdzamy
 * zapytania, a nie własne wyobrażenie o nich: literówka w SQL wywala test,
 * zamiast wyjść dopiero na produkcji.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import {
  zapiszLead,
  zapiszFeedback,
  statystykaFeedbacku,
  zapiszOferte,
  ofertaPoTokenie,
  lista,
  karta,
  podsumowanie,
  ustawStatus,
  ustawOddzwonic,
  dodajNotatke,
  skasujKlienta,
  rozmowaOferty,
  kontekstRozmowy,
  dopiszWiadomosc,
  posprzataj,
  csv,
  kluczTelefonu,
  STATUSY,
  W_LEJKU,
} from '../worker/baza.js';

const SCHEMAT = fs.readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');

/** Atrapa D1 na node:sqlite — tyle interfejsu, ile używa worker/baza.js. */
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

const LEAD = {
  imie: 'Anna',
  telefon: '796 123 456',
  email: 'anna@example.com',
  miejscowosc: 'Tarnobrzeg',
  kwota: 9900,
  opis: 'Florim Stone · Marble — Statuario poler',
  szczegoly: {
    firma: 'Florim Stone', rodzaj: 'spiek', dekor: 'Marble — Statuario poler',
    grubosc: '12', m2Blatu: 1.8, mb: 3,
    parametry: {
      firma: 'florim-stone', dekor: 'Marble — Statuario poler', grubosc: '12',
      odcinki: [{ gl: 60, dl: 300 }],
      opcje: { zlew: 'podblat', plyta: 'nakladana', otwory: 2, pomieszczenie: 'kuchnia' },
    },
  },
  zrodlo: { typ: 'ads', gclid: 'abc123', utm_campaign: 'blaty-tarnobrzeg' },
};

/* ────────────────────────────────────────────────── normalizacja numeru */

test('numer telefonu sprowadzamy do 9 cyfr', () => {
  const oczekiwane = '796123456';
  for (const zapis of ['796123456', '796 123 456', '+48 796 123 456', '0048796123456', '796-123-456']) {
    assert.equal(kluczTelefonu(zapis), oczekiwane, zapis);
  }
});

/* ─────────────────────────────────────────────────────── deduplikacja */

test('pierwsze zgłoszenie zakłada kartę', async () => {
  const env = nowaBaza();
  const wynik = await zapiszLead(env, LEAD);
  assert.equal(wynik.nowy, true);

  const k = await karta(env, wynik.klientId);
  assert.equal(k.imie, 'Anna');
  assert.equal(k.status, 'nowy');
  assert.equal(k.wycen, 1);
  assert.equal(k.kwota, 9900);
  assert.equal(k.zrodlo, 'ads');
  assert.equal(k.wyceny.length, 1);
  assert.equal(k.wyceny[0].dekor, 'Marble — Statuario poler');
});

test('ten sam telefon dokleja wycenę zamiast zakładać duplikat', async () => {
  const env = nowaBaza();
  const pierwszy = await zapiszLead(env, LEAD);
  const drugi = await zapiszLead(env, {
    ...LEAD,
    telefon: '+48 796 123 456', // ten sam numer, inny zapis
    email: 'anna.prywatnie@example.com',
    kwota: 12500,
  });

  assert.equal(drugi.nowy, false);
  assert.equal(drugi.klientId, pierwszy.klientId);

  const k = await karta(env, pierwszy.klientId);
  assert.equal(k.wycen, 2);
  assert.equal(k.wyceny.length, 2);
  assert.equal(k.kwota, 12500, 'kwota ostatniej wyceny');
  assert.equal(k.kwotaMax, 12500);
  assert.equal((await lista(env, {})).length, 1, 'na liście jeden klient');
});

test('ten sam mail przy innym numerze też trafia na tę samą kartę', async () => {
  const env = nowaBaza();
  const pierwszy = await zapiszLead(env, LEAD);
  const drugi = await zapiszLead(env, { ...LEAD, telefon: '600 700 800' });
  assert.equal(drugi.klientId, pierwszy.klientId);
  assert.equal((await lista(env, {})).length, 1);
});

test('dwaj różni klienci to dwie karty', async () => {
  const env = nowaBaza();
  await zapiszLead(env, LEAD);
  await zapiszLead(env, { ...LEAD, imie: 'Piotr', telefon: '600 700 800', email: 'piotr@example.com' });
  assert.equal((await lista(env, {})).length, 2);
});

test('kolejna wycena zostawia ślad w notatkach', async () => {
  const env = nowaBaza();
  const { klientId } = await zapiszLead(env, LEAD);
  await zapiszLead(env, { ...LEAD, kwota: 12500 });
  const k = await karta(env, klientId);
  const systemowe = k.notatki.filter((n) => n.autor === 'system');
  assert.equal(systemowe.length, 1);
  assert.match(systemowe[0].tresc, /Kolejna wycena/);
});

/* ─────────────────────────────────────────────────────────── antyfake */

test('mail testowy Dawida dostaje szarą flagę, ale nie status fake', async () => {
  const env = nowaBaza();
  const { klientId } = await zapiszLead(env, { ...LEAD, email: 'kamieniarstwo24h@gmail.com' });
  const k = await karta(env, klientId);
  assert.ok(k.flagi.includes('test'));
  assert.equal(k.status, 'nowy', 'decyzję o fake podejmuje Dawid');
});

test('numer bez dziewięciu cyfr dostaje flagę', async () => {
  const env = nowaBaza();
  const { klientId } = await zapiszLead(env, { ...LEAD, telefon: '+4851581645' });
  assert.ok((await karta(env, klientId)).flagi.includes('telefon'));
});

test('drugie zgłoszenie w kwadrans to dubel', async () => {
  const env = nowaBaza();
  const { klientId } = await zapiszLead(env, LEAD);
  await zapiszLead(env, LEAD);
  assert.ok((await karta(env, klientId)).flagi.includes('dubel'));
});

test('zwykły klient nie ma żadnej flagi', async () => {
  const env = nowaBaza();
  const { klientId } = await zapiszLead(env, LEAD);
  assert.deepEqual((await karta(env, klientId)).flagi, []);
});

test('bez zgody marketingowej źródło zostaje nieznane', async () => {
  const env = nowaBaza();
  const { klientId } = await zapiszLead(env, { ...LEAD, zrodlo: { typ: 'nieznane' } });
  const k = await karta(env, klientId);
  assert.equal(k.zrodlo, 'nieznane');
  assert.equal(k.zrodloSzczegol, '', 'nie zapisujemy gclid bez zgody');
});

/* ──────────────────────────────────────────────── statusy, lejek, „na dziś" */

test('zmiana statusu zapisuje się w logu notatek', async () => {
  const env = nowaBaza();
  const { klientId } = await zapiszLead(env, LEAD);
  assert.equal(await ustawStatus(env, klientId, 'cieply'), true);

  const k = await karta(env, klientId);
  assert.equal(k.status, 'cieply');
  assert.match(k.notatki[0].tresc, /Nowy → Ciepły/);
});

test('nieznanego statusu nie przyjmujemy', async () => {
  const env = nowaBaza();
  const { klientId } = await zapiszLead(env, LEAD);
  assert.equal(await ustawStatus(env, klientId, 'wymyslony'), false);
  assert.equal((await karta(env, klientId)).status, 'nowy');
});

test('lejek sumuje kwoty ciepłych i wysłanych ofert', async () => {
  const env = nowaBaza();
  const a = await zapiszLead(env, LEAD); // 9900
  const b = await zapiszLead(env, { ...LEAD, telefon: '600 700 800', email: 'b@x.pl', kwota: 5000 });
  const c = await zapiszLead(env, { ...LEAD, telefon: '600 700 801', email: 'c@x.pl', kwota: 30000 });

  await ustawStatus(env, a.klientId, 'cieply');
  await ustawStatus(env, b.klientId, 'oferta');
  await ustawStatus(env, c.klientId, 'przegrany');

  const p = await podsumowanie(env);
  assert.equal(p.wLejku, 14900, 'przegrany nie wisi w lejku');
  assert.equal(p.statusy.cieply.ile, 1);
  assert.equal(p.statusy.przegrany.ile, 1);
  assert.deepEqual(W_LEJKU, ['cieply', 'oferta']);
});

test('„na dziś" bierze zaległe i dzisiejsze terminy, pomija przyszłe', async () => {
  const env = nowaBaza();
  const wczoraj = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const dzis = new Date().toISOString().slice(0, 10);
  const zaTydzien = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const a = await zapiszLead(env, LEAD);
  const b = await zapiszLead(env, { ...LEAD, telefon: '600 700 800', email: 'b@x.pl' });
  const c = await zapiszLead(env, { ...LEAD, telefon: '600 700 801', email: 'c@x.pl' });

  await ustawOddzwonic(env, a.klientId, wczoraj);
  await ustawOddzwonic(env, b.klientId, dzis);
  await ustawOddzwonic(env, c.klientId, zaTydzien);

  const naDzis = await lista(env, { naDzis: true });
  assert.deepEqual(naDzis.map((k) => k.id), [a.klientId, b.klientId], 'zaległy pierwszy');
  assert.equal((await podsumowanie(env)).naDzis, 2);
});

test('termin kontaktu da się zdjąć', async () => {
  const env = nowaBaza();
  const { klientId } = await zapiszLead(env, LEAD);
  await ustawOddzwonic(env, klientId, '2026-09-01');
  await ustawOddzwonic(env, klientId, '');
  assert.equal((await karta(env, klientId)).oddzwonic, null);
  assert.equal((await lista(env, { naDzis: true })).length, 0);
});

/* ──────────────────────────────────────────────────── notatki i filtry */

test('notatki dopisują się, a nie nadpisują', async () => {
  const env = nowaBaza();
  const { klientId } = await zapiszLead(env, LEAD);
  await dodajNotatke(env, klientId, 'Prosi o kontakt po 16.');
  await dodajNotatke(env, klientId, 'Zdecydowana na poler.');

  const k = await karta(env, klientId);
  const moje = k.notatki.filter((n) => n.autor === 'dawid');
  assert.equal(moje.length, 2);
  assert.equal(moje[0].tresc, 'Zdecydowana na poler.', 'najnowsza na górze');
  assert.ok(moje.every((n) => n.utworzono), 'każdy wpis ma znacznik czasu');
});

test('pusta notatka nie zaśmieca logu', async () => {
  const env = nowaBaza();
  const { klientId } = await zapiszLead(env, LEAD);
  assert.equal(await dodajNotatke(env, klientId, '   '), false);
  assert.equal((await karta(env, klientId)).notatki.length, 0);
});

test('filtrowanie po statusie, kwocie i szukajce', async () => {
  const env = nowaBaza();
  const a = await zapiszLead(env, LEAD);
  await zapiszLead(env, {
    ...LEAD, imie: 'Piotr', telefon: '600 700 800', email: 'piotr@example.com',
    miejscowosc: 'Sandomierz', kwota: 4000,
  });
  await ustawStatus(env, a.klientId, 'cieply');

  assert.deepEqual((await lista(env, { status: 'cieply' })).map((k) => k.imie), ['Anna']);
  assert.deepEqual((await lista(env, { kwotaOd: 5000 })).map((k) => k.imie), ['Anna']);
  assert.deepEqual((await lista(env, { szukaj: 'Sandomierz' })).map((k) => k.imie), ['Piotr']);
  assert.deepEqual((await lista(env, { szukaj: '600 700' })).map((k) => k.imie), ['Piotr']);
  assert.equal((await lista(env, { status: 'fake' })).length, 0);
});

/* ───────────────────────────────────────────── feedback po wycenie */

test('„pasuje mi" podnosi status na ciepły i zapisuje porę', async () => {
  const env = nowaBaza();
  const { klientId } = await zapiszLead(env, LEAD);
  const wynik = await zapiszFeedback(env, {
    telefon: '+48 796 123 456', // inny zapis tego samego numeru
    email: '',
    feedback: 'pasuje',
    pora: 'Po 16:00',
  });
  assert.equal(wynik.klientId, klientId);

  const k = await karta(env, klientId);
  assert.equal(k.status, 'cieply');
  assert.equal(k.feedback, 'pasuje');
  assert.equal(k.pora, 'Po 16:00');
  assert.match(k.notatki[0].tresc, /Pasuje mi/);
});

test('klik klienta nie cofa statusu ustawionego przez Dawida', async () => {
  const env = nowaBaza();
  const { klientId } = await zapiszLead(env, LEAD);
  await ustawStatus(env, klientId, 'oferta');
  await zapiszFeedback(env, { telefon: LEAD.telefon, feedback: 'pasuje' });
  assert.equal((await karta(env, klientId)).status, 'oferta', 'oferta zostaje');
});

test('„za drogo" z budżetem zapisuje etykietę, bez zmiany statusu', async () => {
  const env = nowaBaza();
  const { klientId } = await zapiszLead(env, LEAD);
  await zapiszFeedback(env, { email: LEAD.email, feedback: 'za_drogo', budzet: '8–12 tys.' });

  const k = await karta(env, klientId);
  assert.equal(k.status, 'nowy');
  assert.equal(k.feedback, 'za_drogo');
  assert.equal(k.budzet, '8–12 tys.');
  assert.match(k.notatki[0].tresc, /Cena za wysoka \(budżet: 8–12 tys\.\)/);
});

test('feedback przypina się do ostatniej wyceny — statystyka liczy per materiał', async () => {
  const env = nowaBaza();
  await zapiszLead(env, LEAD); // spiek
  await zapiszFeedback(env, { telefon: LEAD.telefon, feedback: 'za_drogo' });

  const KONGLOMERAT = {
    ...LEAD, telefon: '600 700 800', email: 'k@x.pl',
    szczegoly: { ...LEAD.szczegoly, firma: 'Avant Quartz', rodzaj: 'konglomerat' },
  };
  await zapiszLead(env, KONGLOMERAT);
  await zapiszFeedback(env, { telefon: '600 700 800', feedback: 'pasuje' });

  const stat = await statystykaFeedbacku(env);
  assert.equal(stat.spiek.za_drogo, 1);
  assert.equal(stat.spiek.razem, 1);
  assert.equal(stat.konglomerat.pasuje, 1);
  assert.equal(stat.konglomerat.razem, 1);
});

test('kolejny klik nadpisuje poprzednią odpowiedź', async () => {
  const env = nowaBaza();
  const { klientId } = await zapiszLead(env, LEAD);
  await zapiszFeedback(env, { telefon: LEAD.telefon, feedback: 'za_drogo' });
  await zapiszFeedback(env, { telefon: LEAD.telefon, feedback: 'za_drogo', budzet: 'do 8 tys.' });
  const k = await karta(env, klientId);
  assert.equal(k.budzet, 'do 8 tys.');
});

test('feedback od nieznanego klienta albo z błędną wartością ginie po cichu', async () => {
  const env = nowaBaza();
  assert.equal(await zapiszFeedback(env, { telefon: '111 222 333', feedback: 'pasuje' }), null);
  const { klientId } = await zapiszLead(env, LEAD);
  assert.equal(await zapiszFeedback(env, { telefon: LEAD.telefon, feedback: 'wymyslony' }), null);
  assert.equal((await karta(env, klientId)).feedback, '');
});

test('klient z „pasuje mi" wisi na górze listy', async () => {
  const env = nowaBaza();
  await zapiszLead(env, LEAD);
  const b = await zapiszLead(env, { ...LEAD, imie: 'Piotr', telefon: '600 700 800', email: 'p@x.pl' });
  // Anna jest świeższa (późniejszy ruch)…
  await dodajNotatke(env, (await lista(env, {}))[0].id, 'ruch');
  await zapiszFeedback(env, { telefon: '600 700 800', feedback: 'pasuje' });
  // …ale to Piotr prosi o kontakt, więc idzie pierwszy.
  assert.equal((await lista(env, {}))[0].id, b.klientId);
});

/* ─────────────────────────────── oferty Dawida („Powtórz wycenę") */

const TOKEN = 'a'.repeat(32);
const OFERTA = {
  opis: 'Florim Stone · Marble — Statuario poler · 12 mm · 60×300 cm',
  pozycje: [
    { nazwa: 'Materiał', detal: '1 płyta', brutto: 6000, gratis: false },
    { nazwa: 'Transport i montaż u klienta', detal: '', brutto: 0, gratis: true },
  ],
  razemPrzed: 9900, razem: 8500, korektaOpis: 'upust 14%; gratis: montaż',
  przekresl: true, stawkaVat: 0.08, odbiorWlasny: false,
  firma: 'Florim Stone', dekor: 'Marble — Statuario poler', grubosc: '12',
  m2: 1.8, mb: 3, pomieszczenie: 'kuchnia', kategoria: 'spiek',
};

test('parametry wyceny klienta zapisują się do „Powtórz wycenę"', async () => {
  const env = nowaBaza();
  const { klientId } = await zapiszLead(env, LEAD);
  const k = await karta(env, klientId);
  assert.equal(k.wyceny[0].dane.firma, 'florim-stone');
  assert.deepEqual(k.wyceny[0].dane.odcinki, [{ gl: 60, dl: 300 }]);
  assert.equal(k.wyceny[0].dane.opcje.otwory, 2);
});

test('oferta Dawida to NOWY wiersz — oryginał klienta nietknięty', async () => {
  const env = nowaBaza();
  const { klientId } = await zapiszLead(env, LEAD);
  await zapiszOferte(env, klientId, OFERTA, TOKEN);

  const k = await karta(env, klientId);
  assert.equal(k.wyceny.length, 2);
  const [dawida, klienta] = k.wyceny; // najnowsza pierwsza
  assert.equal(dawida.wersja, 'dawid');
  assert.equal(dawida.kwota, 8500);
  assert.equal(klienta.wersja, '');
  assert.equal(klienta.kwota, 9900, 'wycena klienta bez zmian');
  assert.match(k.notatki[0].tresc, /Wysłano ofertę od Dawida/);
  assert.match(k.notatki[0].tresc, /upust 14%/);
});

test('wysyłka oferty ustawia status „oferta", ale nie cofa wygranego', async () => {
  const env = nowaBaza();
  const a = await zapiszLead(env, LEAD);
  await zapiszOferte(env, a.klientId, OFERTA, TOKEN);
  assert.equal((await karta(env, a.klientId)).status, 'oferta');

  const b = await zapiszLead(env, { ...LEAD, telefon: '600 700 800', email: 'b@x.pl' });
  await ustawStatus(env, b.klientId, 'wygrany');
  await zapiszOferte(env, b.klientId, OFERTA, 'b'.repeat(32));
  assert.equal((await karta(env, b.klientId)).status, 'wygrany', 'wygranego nie ruszamy');
});

test('wycena online po tokenie liczy otwarcia klienta, podgląd Dawida nie', async () => {
  const env = nowaBaza();
  const { klientId } = await zapiszLead(env, LEAD);
  await zapiszOferte(env, klientId, OFERTA, TOKEN);

  const podglad = await ofertaPoTokenie(env, TOKEN, { podglad: true });
  assert.equal(podglad.oferta.razem, 8500);
  assert.equal(podglad.klientId, klientId);

  await ofertaPoTokenie(env, TOKEN);
  await ofertaPoTokenie(env, TOKEN);

  const k = await karta(env, klientId);
  const wersjaDawida = k.wyceny.find((w) => w.wersja === 'dawid');
  assert.equal(wersjaDawida.otwarcia, 2, 'podgląd z panelu nie liczy się');
  assert.ok(wersjaDawida.ostatnie_otwarcie);
});

test('zły albo obcy token nie zwraca niczego', async () => {
  const env = nowaBaza();
  const { klientId } = await zapiszLead(env, LEAD);
  await zapiszOferte(env, klientId, OFERTA, TOKEN);
  assert.equal(await ofertaPoTokenie(env, 'z'.repeat(32)), null, 'niehex');
  assert.equal(await ofertaPoTokenie(env, 'b'.repeat(32)), null, 'nieistniejący');
  assert.equal(await ofertaPoTokenie(env, ''), null);
});

test('feedback ze strony oferty (po klientId) trafia na kartę', async () => {
  const env = nowaBaza();
  const { klientId } = await zapiszLead(env, LEAD);
  await zapiszOferte(env, klientId, OFERTA, TOKEN);
  const zTokenu = await ofertaPoTokenie(env, TOKEN, { podglad: true });

  await zapiszFeedback(env, { klientId: zTokenu.klientId, feedback: 'pasuje', pora: 'Po 16:00' });
  const k = await karta(env, klientId);
  assert.equal(k.feedback, 'pasuje');
  assert.equal(k.status, 'oferta', '„pasuje" nie cofa statusu oferta');
  assert.equal(k.pora, 'Po 16:00');
});

/* ─────────────────────────────────────────────── kasowanie i retencja */

test('kasowanie karty zabiera wyceny i notatki', async () => {
  const env = nowaBaza();
  const { klientId } = await zapiszLead(env, LEAD);
  await dodajNotatke(env, klientId, 'cokolwiek');
  await skasujKlienta(env, klientId);

  assert.equal(await karta(env, klientId), null);
  assert.equal(env._db.prepare('SELECT COUNT(*) AS i FROM wyceny').get().i, 0);
  assert.equal(env._db.prepare('SELECT COUNT(*) AS i FROM notatki').get().i, 0);
});

test('karta bez ruchu przez 24 miesiące kasuje się sama', async () => {
  const env = nowaBaza();
  const stary = await zapiszLead(env, LEAD);
  const swiezy = await zapiszLead(env, { ...LEAD, telefon: '600 700 800', email: 'b@x.pl' });

  const dawno = new Date(Date.now() - 800 * 86400000).toISOString();
  env._db.prepare('UPDATE klienci SET ruch = ? WHERE id = ?').run(dawno, stary.klientId);

  assert.equal(await posprzataj(env), 1);
  assert.equal(await karta(env, stary.klientId), null);
  assert.ok(await karta(env, swiezy.klientId), 'świeża karta zostaje');
});

test('sprzątanie odpala się raz dziennie', async () => {
  const env = nowaBaza();
  await zapiszLead(env, LEAD);
  await posprzataj(env);
  assert.equal(await posprzataj(env), 0, 'drugie wejście tego samego dnia nic nie robi');
});

/* ──────────────────────────────────────────────────────────────── CSV */

test('eksport CSV ma nagłówki, dane i BOM dla Excela', async () => {
  const env = nowaBaza();
  const { klientId } = await zapiszLead(env, LEAD);
  await ustawStatus(env, klientId, 'cieply');

  const plik = await csv(env);
  assert.ok(plik.startsWith('﻿'), 'bez BOM Excel robi krzaki');
  const [naglowek, wiersz] = plik.replace('﻿', '').split('\r\n');
  assert.match(naglowek, /^id;utworzono;imie;telefon;email;miejscowosc;status/);
  assert.match(wiersz, /"Anna"/);
  assert.match(wiersz, /"Ciepły"/);
});

test('średnik i cudzysłów w danych nie rozjeżdżają kolumn', async () => {
  const env = nowaBaza();
  await zapiszLead(env, { ...LEAD, imie: 'Anna "Ania"; Kowalska' });
  const wiersz = (await csv(env)).split('\r\n')[1];
  assert.match(wiersz, /"Anna ""Ania""; Kowalska"/);
});

/* ────────────────────────────────────────────────────────────── lejek */

test('lejek ma statusy w kolejności sprzedażowej', () => {
  assert.deepEqual(
    STATUSY.map((s) => s.id),
    ['nowy', 'cieply', 'pomiar', 'oferta', 'wygrany', 'przegrany', 'fake']
  );
});

/* ═══════════════ ROZMOWA POD OFERTĄ ═══════════════ */

/** Wysyła ofertę i oddaje jej ID — wątek wisi właśnie przy nim. */
async function ofertaZTokenem(env, klientId, token) {
  const { wycenaId } = await zapiszOferte(env, klientId, OFERTA, token);
  return wycenaId;
}

test('zapiszOferte oddaje ID wyceny — bez niego nie ma do czego przypiąć wątku', async () => {
  const env = nowaBaza();
  const { klientId } = await zapiszLead(env, LEAD);
  const wycenaId = await ofertaZTokenem(env, klientId, TOKEN);
  assert.ok(wycenaId > 0, 'brak ID wyceny');
});

test('wiadomości zapisują się w kolejności rozmowy', async () => {
  const env = nowaBaza();
  const { klientId } = await zapiszLead(env, LEAD);
  const wycenaId = await ofertaZTokenem(env, klientId, TOKEN);

  await dopiszWiadomosc(env, { wycenaId, klientId, autor: 'klient', tresc: 'Czy zdążycie do piątku?' });
  await dopiszWiadomosc(env, { wycenaId, klientId, autor: 'dawid', tresc: 'Tak, zdążymy.' });

  const w = await rozmowaOferty(env, wycenaId);
  assert.deepEqual(w.map((m) => m.autor), ['klient', 'dawid']);
  assert.equal(w[0].tresc, 'Czy zdążycie do piątku?');
});

test('DWIE oferty tego samego klienta mają OSOBNE wątki', async () => {
  // Sedno decyzji Dawida: kuchnia i łazienka to dwie sprawy, nie jeden czat.
  const env = nowaBaza();
  const { klientId } = await zapiszLead(env, LEAD);
  const kuchnia = await ofertaZTokenem(env, klientId, TOKEN);
  const lazienka = await ofertaZTokenem(env, klientId, 'b'.repeat(32));

  await dopiszWiadomosc(env, { wycenaId: kuchnia, klientId, autor: 'klient', tresc: 'pytanie o kuchnię' });
  await dopiszWiadomosc(env, { wycenaId: lazienka, klientId, autor: 'klient', tresc: 'pytanie o łazienkę' });

  const wKuchni = await rozmowaOferty(env, kuchnia);
  assert.equal(wKuchni.length, 1);
  assert.equal(wKuchni[0].tresc, 'pytanie o kuchnię');
  assert.equal((await rozmowaOferty(env, lazienka))[0].tresc, 'pytanie o łazienkę');
});

test('w panelu wszystkie wątki są na karcie klienta, każdy przy swojej wycenie', async () => {
  const env = nowaBaza();
  const { klientId } = await zapiszLead(env, LEAD);
  const kuchnia = await ofertaZTokenem(env, klientId, TOKEN);
  const lazienka = await ofertaZTokenem(env, klientId, 'b'.repeat(32));
  await dopiszWiadomosc(env, { wycenaId: kuchnia, klientId, autor: 'klient', tresc: 'o kuchnię' });
  await dopiszWiadomosc(env, { wycenaId: lazienka, klientId, autor: 'dawid', tresc: 'o łazienkę' });

  const k = await karta(env, klientId);
  const wg = new Map(k.wyceny.map((w) => [w.id, w.rozmowa || []]));
  assert.equal(wg.get(kuchnia).length, 1);
  assert.equal(wg.get(kuchnia)[0].tresc, 'o kuchnię');
  assert.equal(wg.get(lazienka)[0].autor, 'dawid');
  // Wycena klienta (bez linku) wątku nie ma — nie ma gdzie na nią odpisać.
  const klienta = k.wyceny.find((w) => w.wersja !== 'dawid');
  assert.deepEqual(klienta.rozmowa, []);
});

test('limit liczy TYLKO wiadomości klienta — odpowiedzi Dawida go nie zjadają', async () => {
  const env = nowaBaza();
  const { klientId } = await zapiszLead(env, LEAD);
  const wycenaId = await ofertaZTokenem(env, klientId, TOKEN);

  await dopiszWiadomosc(env, { wycenaId, klientId, autor: 'klient', tresc: 'raz' });
  for (let i = 0; i < 5; i += 1) {
    await dopiszWiadomosc(env, { wycenaId, klientId, autor: 'dawid', tresc: 'odpowiedź ' + i });
  }

  const kontekst = await kontekstRozmowy(env, wycenaId);
  assert.equal(kontekst.odKlienta, 1, 'odpowiedzi Dawida nie mogą zużywać limitu klienta');
  assert.ok(kontekst.ostatnia, 'brak znacznika czasu ostatniej wiadomości klienta');
});

test('pusty wątek nie wywraca odczytu', async () => {
  const env = nowaBaza();
  const { klientId } = await zapiszLead(env, LEAD);
  const wycenaId = await ofertaZTokenem(env, klientId, TOKEN);
  assert.deepEqual(await rozmowaOferty(env, wycenaId), []);
  assert.deepEqual(await kontekstRozmowy(env, wycenaId), { odKlienta: 0, ostatnia: null });
  assert.deepEqual(await rozmowaOferty(env, 0), []);
});

test('strona oferty dostaje wątek razem z wyceną', async () => {
  const env = nowaBaza();
  const { klientId } = await zapiszLead(env, LEAD);
  const wycenaId = await ofertaZTokenem(env, klientId, TOKEN);
  await dopiszWiadomosc(env, { wycenaId, klientId, autor: 'dawid', tresc: 'Dzień dobry!' });

  const w = await ofertaPoTokenie(env, TOKEN);
  assert.equal(w.wycenaId, wycenaId);
  assert.equal(w.rozmowa.length, 1);
  assert.equal(w.rozmowa[0].tresc, 'Dzień dobry!');
});

test('skasowanie karty zabiera też rozmowy — nic nie zostaje sierotą', async () => {
  const env = nowaBaza();
  const { klientId } = await zapiszLead(env, LEAD);
  const wycenaId = await ofertaZTokenem(env, klientId, TOKEN);
  await dopiszWiadomosc(env, { wycenaId, klientId, autor: 'klient', tresc: 'halo' });

  await skasujKlienta(env, klientId);
  const zostalo = await env.BAZA.prepare('SELECT COUNT(*) AS ile FROM wiadomosci').bind().first();
  assert.equal(zostalo.ile, 0, 'wiadomości zostały po skasowanej karcie');
});

test('nowa wiadomość podbija ruch — klient wraca na wierzch listy', async () => {
  const env = nowaBaza();
  const { klientId } = await zapiszLead(env, LEAD);
  const wycenaId = await ofertaZTokenem(env, klientId, TOKEN);
  await env.BAZA.prepare("UPDATE klienci SET ruch = '2020-01-01T00:00:00.000Z' WHERE id = ?")
    .bind(klientId)
    .run();

  await dopiszWiadomosc(env, { wycenaId, klientId, autor: 'klient', tresc: 'jeszcze jedno pytanie' });

  const k = await env.BAZA.prepare('SELECT ruch FROM klienci WHERE id = ?').bind(klientId).first();
  assert.notEqual(k.ruch, '2020-01-01T00:00:00.000Z', 'ruch nie został podbity');
});

test('wiadomość od Dawida zamraża się w ofercie i wraca do klienta', async () => {
  const env = nowaBaza();
  const { klientId } = await zapiszLead(env, LEAD);
  await zapiszOferte(env, klientId, { ...OFERTA, wiadomosc: 'Pomiar mam wolny w czwartek.' }, TOKEN);

  const w = await ofertaPoTokenie(env, TOKEN);
  assert.equal(w.oferta.wiadomosc, 'Pomiar mam wolny w czwartek.');
});

/* ═══════ JEDEN LINK = NAJNOWSZA WERSJA (zlecenie Dawida, 25.08.2026) ═══════
 *
 * „Chciałbym tę wycenę móc zmieniać dla klienta w czasie rzeczywistym —
 *  pod TYM SAMYM linkiem, żeby nie robić 5 osobnych wycen."
 */

const OFERTA2 = { ...OFERTA, opis: 'Wersja druga', razem: 7900 };
const OFERTA3 = { ...OFERTA, opis: 'Wersja trzecia', razem: 7500 };

test('pierwsza oferta zakłada wątek własnym tokenem', async () => {
  const env = nowaBaza();
  const { klientId } = await zapiszLead(env, LEAD);
  const z = await zapiszOferte(env, klientId, OFERTA, TOKEN);
  assert.equal(z.watek, TOKEN);
});

test('aktualizacja to NOWY wiersz w tym samym wątku — historia zostaje', async () => {
  const env = nowaBaza();
  const { klientId } = await zapiszLead(env, LEAD);
  await zapiszOferte(env, klientId, OFERTA, TOKEN);
  await zapiszOferte(env, klientId, OFERTA2, 'b'.repeat(32), TOKEN);

  const ile = await env.BAZA.prepare("SELECT COUNT(*) c FROM wyceny WHERE watek = ?").bind(TOKEN).first();
  assert.equal(ile.c, 2, 'aktualizacja nadpisała wersję zamiast dopisać');
});

test('STARY link pokazuje NAJNOWSZĄ wersję', async () => {
  const env = nowaBaza();
  const { klientId } = await zapiszLead(env, LEAD);
  await zapiszOferte(env, klientId, OFERTA, TOKEN);
  await zapiszOferte(env, klientId, OFERTA2, 'b'.repeat(32), TOKEN);

  // Klient ma w mailu TOKEN (pierwszy) — i ma zobaczyć wersję drugą.
  const w = await ofertaPoTokenie(env, TOKEN);
  assert.equal(w.oferta.opis, 'Wersja druga');
  assert.equal(w.wersjaNr, 2);
  assert.equal(w.zaktualizowana, true);
});

test('link do wersji pośredniej też prowadzi do najnowszej', async () => {
  const env = nowaBaza();
  const { klientId } = await zapiszLead(env, LEAD);
  await zapiszOferte(env, klientId, OFERTA, TOKEN);
  await zapiszOferte(env, klientId, OFERTA2, 'b'.repeat(32), TOKEN);
  await zapiszOferte(env, klientId, OFERTA3, 'c'.repeat(32), TOKEN);

  for (const link of [TOKEN, 'b'.repeat(32), 'c'.repeat(32)]) {
    const w = await ofertaPoTokenie(env, link);
    assert.equal(w.oferta.opis, 'Wersja trzecia', `link ${link.slice(0, 4)} pokazał starą wersję`);
    assert.equal(w.wersjaNr, 3);
  }
});

test('pojedyncza oferta nie jest oznaczona jako zaktualizowana', async () => {
  const env = nowaBaza();
  const { klientId } = await zapiszLead(env, LEAD);
  await zapiszOferte(env, klientId, OFERTA, TOKEN);
  const w = await ofertaPoTokenie(env, TOKEN);
  assert.equal(w.zaktualizowana, false);
  assert.equal(w.wersjaNr, 1);
});

test('KLIENT ODŚWIEŻA W TRAKCIE EDYCJI — widzi spójną ostatnią wersję', async () => {
  const env = nowaBaza();
  const { klientId } = await zapiszLead(env, LEAD);
  await zapiszOferte(env, klientId, OFERTA, TOKEN);

  // Dawid „edytuje": dopóki nie opublikuje, klient widzi wersję pierwszą.
  const wTrakcie = await ofertaPoTokenie(env, TOKEN);
  assert.equal(wTrakcie.oferta.opis, OFERTA.opis);
  assert.equal(wTrakcie.oferta.razem, OFERTA.razem, 'klient zobaczył półprodukt');

  // Publikacja to jeden INSERT — po nim od razu pełna nowa wersja.
  await zapiszOferte(env, klientId, OFERTA2, 'b'.repeat(32), TOKEN);
  const po = await ofertaPoTokenie(env, TOKEN);
  assert.equal(po.oferta.opis, 'Wersja druga');
  assert.equal(po.oferta.razem, 7900);
});

test('rozmowa PRZEŻYWA aktualizacje — wisi przy pierwszej wersji', async () => {
  const env = nowaBaza();
  const { klientId } = await zapiszLead(env, LEAD);
  const pierwsza = await zapiszOferte(env, klientId, OFERTA, TOKEN);
  await dopiszWiadomosc(env, {
    wycenaId: pierwsza.wycenaId, klientId, autor: 'klient', tresc: 'Czy zdążycie?',
  });

  await zapiszOferte(env, klientId, OFERTA2, 'b'.repeat(32), TOKEN);

  const w = await ofertaPoTokenie(env, TOKEN);
  assert.equal(w.rozmowa.length, 1, 'rozmowa zniknęła po aktualizacji');
  assert.equal(w.rozmowa[0].tresc, 'Czy zdążycie?');
  assert.equal(w.watekId, pierwsza.wycenaId, 'kotwica wątku się przesunęła');
});

test('licznik otwarć liczy się przy wersji, którą klient widział', async () => {
  const env = nowaBaza();
  const { klientId } = await zapiszLead(env, LEAD);
  const p1 = await zapiszOferte(env, klientId, OFERTA, TOKEN);
  await ofertaPoTokenie(env, TOKEN);           // otwarcie wersji 1
  const p2 = await zapiszOferte(env, klientId, OFERTA2, 'b'.repeat(32), TOKEN);
  await ofertaPoTokenie(env, TOKEN);           // otwarcie wersji 2
  await ofertaPoTokenie(env, TOKEN);           // i jeszcze raz

  const w1 = await env.BAZA.prepare('SELECT otwarcia FROM wyceny WHERE id = ?').bind(p1.wycenaId).first();
  const w2 = await env.BAZA.prepare('SELECT otwarcia FROM wyceny WHERE id = ?').bind(p2.wycenaId).first();
  assert.equal(w1.otwarcia, 1, 'otwarcia starej wersji się zmieniły');
  assert.equal(w2.otwarcia, 2, 'otwarcia nowej wersji nie doszły');
});

test('podgląd właściciela nadal nie podbija licznika żadnej wersji', async () => {
  const env = nowaBaza();
  const { klientId } = await zapiszLead(env, LEAD);
  const p = await zapiszOferte(env, klientId, OFERTA, TOKEN);
  await ofertaPoTokenie(env, TOKEN, { podglad: true });
  const w = await env.BAZA.prepare('SELECT otwarcia FROM wyceny WHERE id = ?').bind(p.wycenaId).first();
  assert.equal(w.otwarcia, 0);
});

test('notatka rozróżnia nową ofertę od aktualizacji', async () => {
  const env = nowaBaza();
  const { klientId } = await zapiszLead(env, LEAD);
  await zapiszOferte(env, klientId, OFERTA, TOKEN);
  await zapiszOferte(env, klientId, OFERTA2, 'b'.repeat(32), TOKEN);

  const n = await env.BAZA.prepare(
    "SELECT tresc FROM notatki WHERE klient_id = ? ORDER BY id DESC LIMIT 1"
  ).bind(klientId).first();
  assert.match(n.tresc, /Zaktualizowano ofertę \(ten sam link\)/);
});

test('dwie OSOBNE oferty tego samego klienta zostają osobne', async () => {
  const env = nowaBaza();
  const { klientId } = await zapiszLead(env, LEAD);
  await zapiszOferte(env, klientId, OFERTA, TOKEN);
  await zapiszOferte(env, klientId, OFERTA2, 'b'.repeat(32)); // bez wątku = nowa

  assert.equal((await ofertaPoTokenie(env, TOKEN)).oferta.opis, OFERTA.opis);
  assert.equal((await ofertaPoTokenie(env, 'b'.repeat(32))).oferta.opis, 'Wersja druga');
});

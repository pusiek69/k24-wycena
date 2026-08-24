/**
 * WORKER — TEST DYMNY (czy w ogóle wstaje i odpowiada).
 *
 *   npm run worker && node --test scripts/test-worker-smoke.mjs
 *
 * POWÓD POWSTANIA (24.08.2026): przy wydzielaniu wysyłki maili do
 * worker/poczta.js zbiorcza podmiana zrobiła z linii
 *
 *     const nadawca = env.MAIL_FROM || '…';
 *     → const nadawca = nadawca(env);
 *
 * samoodwołujący się `const`. Kod parsował się bez zarzutu, cały pakiet
 * 334 testów świecił na zielono, a `/lead` na produkcji zwracał 500 —
 * bo błąd wychodzi dopiero przy WYKONANIU handlera. Zgłoszenie klienta
 * przepadłoby razem z mailem i wpisem w bazie.
 *
 * Dlatego tutaj naprawdę wołamy `worker.fetch()` na atrapie środowiska:
 * prawdziwe trasy, prawdziwy SQL (node:sqlite), maile wyłączone brakiem
 * klucza. To nie zastępuje testów logiki — łapie klasę błędów, której
 * testy modułów z definicji nie widzą.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const SCIEZKA = new URL('../worker/worker.js', import.meta.url);
const JEST = fs.existsSync(SCIEZKA);

const SCHEMAT = fs.readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');

/** Atrapa D1 — ta sama co w test-baza-klientow.mjs. */
function nowaBaza() {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMAT);
  return {
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
}

/*
 * Worker odmawia od progu, gdy nie ma klucza poczty (503), więc klucz
 * MUSI być — żeby ścieżka wykonała się w całości. Żeby przy tym nic nie
 * poszło w świat, podmieniamy globalny `fetch`: każde wyjście na zewnątrz
 * jest przechwytywane i policzone.
 */
const wyslane = [];
const prawdziwyFetch = globalThis.fetch;
globalThis.fetch = async (url, opcje) => {
  const adres = String(url?.url || url);
  if (/api\.resend\.com|api\.anthropic\.com|interstone\.pl/.test(adres)) {
    wyslane.push(adres);
    return new Response(JSON.stringify({ id: 'test' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
  throw new Error('Test próbował wyjść na: ' + adres);
};
process.on('exit', () => {
  globalThis.fetch = prawdziwyFetch;
});

const srodowisko = () => ({
  BAZA: nowaBaza(),
  ALLOWED_ORIGIN: 'https://kam24h.pl',
  PANEL_HASLO: 'testowe-haslo',
  RESEND_API_KEY: 'test-klucz-bez-pokrycia',
  LEAD_EMAIL: 'kamieniarstwo24h@example.com',
});

const zapytanie = (sciezka, cialo) =>
  new Request(`https://k24h.example${sciezka}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://kam24h.pl' },
    body: JSON.stringify(cialo),
  });

const ctx = { waitUntil() {}, passThroughOnException() {} };

const LEAD = {
  name: 'Anna Testowa',
  phone: '600100200',
  email: 'anna@example.com',
  city: 'Tarnobrzeg',
  consent: true,
  szczegoly: {
    material: 'Technistone',
    dekor: 'Crystal Absolute White',
    grubosc: '20',
    razem: 9000,
    widelki: { od: 8500, do: 9500 },
    odcinki: [{ gl: 60, dl: 300 }],
    pozycje: [],
  },
};

test('worker/worker.js istnieje (npm run worker)', { skip: JEST ? false : 'brak worker.js — uruchom `npm run worker`' }, () => {
  assert.ok(JEST);
});

if (JEST) {
  const { default: worker } = await import(SCIEZKA.href);

  test('/lead przyjmuje zgłoszenie i zapisuje kartę klienta', async () => {
    const env = srodowisko();
    const odp = await worker.fetch(zapytanie('/lead', LEAD), env, ctx);
    const dane = await odp.json();

    assert.equal(odp.status, 200, `/lead oddał ${odp.status}: ${JSON.stringify(dane)}`);
    assert.equal(dane.ok, true);

    const k = await env.BAZA.prepare('SELECT imie, telefon FROM klienci').bind().first();
    assert.equal(k.imie, 'Anna Testowa', 'zgłoszenie nie trafiło do bazy');
  });

  test('/lead przeżywa brak widełek w szczegółach', async () => {
    // Realny przypadek z produkcji: payload bez `widelki` wywalał handler,
    // a z nim mail z wyceną i wpis w bazie.
    const env = srodowisko();
    const bezWidelek = { ...LEAD, szczegoly: { ...LEAD.szczegoly, widelki: undefined } };
    const odp = await worker.fetch(zapytanie('/lead', bezWidelek), env, ctx);
    assert.equal(odp.status, 200, `/lead oddał ${odp.status}`);
  });

  test('/lead wysyła dwa maile: zgłoszenie do Dawida i wycenę do klienta', async () => {
    wyslane.length = 0;
    const odp = await worker.fetch(zapytanie('/lead', LEAD), srodowisko(), ctx);
    assert.equal(odp.status, 200);
    const doPoczty = wyslane.filter((a) => a.includes('resend.com'));
    assert.equal(doPoczty.length, 2, `poszło ${doPoczty.length} maili zamiast 2`);
  });

  test('/feedback odpowiada, nawet gdy nie ma czego dopiąć', async () => {
    const env = srodowisko();
    const odp = await worker.fetch(zapytanie('/feedback', { feedback: 'pasuje' }), env, ctx);
    assert.ok(odp.status < 500, `/feedback oddał ${odp.status}`);
  });

  test('/oferta/dane na nieznany token nie wywala workera', async () => {
    const env = srodowisko();
    const odp = await worker.fetch(zapytanie('/oferta/dane', { token: 'f'.repeat(32) }), env, ctx);
    assert.ok(odp.status < 500, `/oferta/dane oddał ${odp.status}`);
  });

  test('/oferta/napisz bez tokenu odmawia grzecznie, nie błędem serwera', async () => {
    const env = srodowisko();
    const odp = await worker.fetch(zapytanie('/oferta/napisz', { tresc: 'halo' }), env, ctx);
    assert.equal(odp.status, 400);
    assert.equal((await odp.json()).ok, false);
  });

  test('/oferta/napisz na nieistniejącą wycenę oddaje 404, nie 500', async () => {
    const env = srodowisko();
    const odp = await worker.fetch(
      zapytanie('/oferta/napisz', { token: 'a'.repeat(32), tresc: 'Czy zdążycie?' }),
      env,
      ctx
    );
    assert.equal(odp.status, 404, `oddał ${odp.status}`);
  });

  test('/oferta/wyslij bez podpisu właściciela nie przepuszcza', async () => {
    const env = srodowisko();
    const odp = await worker.fetch(
      zapytanie('/oferta/wyslij', { leadId: 1, oferta: { pozycje: [{}], razem: 100 } }),
      env,
      ctx
    );
    assert.equal(odp.status, 401, 'klient nie może wysłać sobie oferty');
  });

  test('panel bez ciasteczka prosi o hasło zamiast wpuszczać', async () => {
    const env = srodowisko();
    const odp = await worker.fetch(
      new Request('https://k24h.example/panel', { headers: { origin: 'https://kam24h.pl' } }),
      env,
      ctx
    );
    assert.ok(odp.status < 500, `panel oddał ${odp.status}`);
    const html = await odp.text();
    assert.match(html, /hasło|Hasło/, 'panel nie pokazał ekranu logowania');
  });

  test('nieznana trasa oddaje 404, a nie wyjątek', async () => {
    const env = srodowisko();
    const odp = await worker.fetch(zapytanie('/nie-ma-takiej', {}), env, ctx);
    assert.ok(odp.status === 404 || odp.status === 405, `oddał ${odp.status}`);
  });
}

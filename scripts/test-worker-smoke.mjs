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
// Treść wychodzących maili — bez niej dało się sprawdzić tylko ILE ich
// poszło, a nie CO w nich było (np. czy temat niesie „PILNE").
const listy = [];
const prawdziwyFetch = globalThis.fetch;
globalThis.fetch = async (url, opcje) => {
  const adres = String(url?.url || url);
  if (/api\.resend\.com|api\.anthropic\.com|interstone\.pl/.test(adres)) {
    wyslane.push(adres);
    if (adres.includes('resend.com')) {
      try {
        listy.push(JSON.parse(String(opcje?.body || '{}')));
      } catch {
        listy.push({});
      }
    }
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

  test('PLANOWANY TERMIN zapisuje się na karcie klienta', async () => {
    const env = srodowisko();
    const odp = await worker.fetch(
      zapytanie('/lead', { ...LEAD, email: 'pilny@example.com', termin: 'pilne' }),
      env,
      ctx
    );
    assert.equal(odp.status, 200);

    const cookie = await ciastkoPanelu(env);
    const dane = await (
      await worker.fetch(
        new Request('https://k24h.example/panel/api/dane', {
          headers: { origin: 'https://kam24h.pl', cookie },
        }),
        env,
        ctx
      )
    ).json();
    const klient = dane.lista.find((k) => k.email === 'pilny@example.com');
    assert.ok(klient, 'nie znalazłem karty klienta');
    assert.equal(klient.termin, 'pilne');
  });

  test('KLIENT NA JUŻ wyróżnia się w mailu do Dawida', async () => {
    listy.length = 0;
    await worker.fetch(
      zapytanie('/lead', { ...LEAD, email: 'szybko@example.com', termin: 'pilne' }),
      srodowisko(),
      ctx
    );
    // Pierwszy mail idzie do firmy, drugi do klienta.
    const doFirmy = listy[0];
    assert.match(doFirmy.subject, /^PILNE — Nowa wycena/, `temat: ${doFirmy.subject}`);
    assert.match(doFirmy.html, /PILNE — KLIENT CHCE BLAT DO 2 TYGODNI/);
    assert.match(doFirmy.text, /Termin:\s+Jak najszybciej/);
  });

  test('klient „dopiero planuję" NIE jest oznaczany jako pilny', async () => {
    listy.length = 0;
    await worker.fetch(
      zapytanie('/lead', { ...LEAD, email: 'kiedys@example.com', termin: 'pozniej' }),
      srodowisko(),
      ctx
    );
    const doFirmy = listy[0];
    assert.doesNotMatch(doFirmy.subject, /PILNE/, `temat: ${doFirmy.subject}`);
    assert.doesNotMatch(doFirmy.html, /PILNE — KLIENT/);
    // ...ale sam termin ma być widoczny — to informacja, nie ozdoba.
    assert.match(doFirmy.text, /Termin:\s+Później/);
  });

  test('podrobiony termin nie trafia do bazy ani nie wywraca zgłoszenia', async () => {
    const env = srodowisko();
    const odp = await worker.fetch(
      zapytanie('/lead', { ...LEAD, email: 'lewy@example.com', termin: "'; DROP TABLE klienci; --" }),
      env,
      ctx
    );
    assert.equal(odp.status, 200, 'zgłoszenie jest warte więcej niż to pole');

    const cookie = await ciastkoPanelu(env);
    const dane = await (
      await worker.fetch(
        new Request('https://k24h.example/panel/api/dane', {
          headers: { origin: 'https://kam24h.pl', cookie },
        }),
        env,
        ctx
      )
    ).json();
    const klient = dane.lista.find((k) => k.email === 'lewy@example.com');
    assert.equal(klient.termin, '', 'nieznana wartość weszła do bazy');
  });

  test('filtr terminu w panelu zawęża listę', async () => {
    const env = srodowisko();
    await worker.fetch(
      zapytanie('/lead', { ...LEAD, phone: '600100201', email: 'a@example.com', termin: 'pilne' }),
      env,
      ctx
    );
    await worker.fetch(
      zapytanie('/lead', { ...LEAD, phone: '600100202', email: 'b@example.com', termin: 'pozniej' }),
      env,
      ctx
    );

    const cookie = await ciastkoPanelu(env);
    const pobierz = async (query) =>
      (
        await (
          await worker.fetch(
            new Request(`https://k24h.example/panel/api/dane${query}`, {
              headers: { origin: 'https://kam24h.pl', cookie },
            }),
            env,
            ctx
          )
        ).json()
      ).lista;

    const wszyscy = await pobierz('');
    const tylkoPilni = await pobierz('?termin=pilne');
    assert.ok(wszyscy.length >= 2);
    assert.ok(tylkoPilni.length >= 1);
    assert.ok(tylkoPilni.every((k) => k.termin === 'pilne'), 'filtr przepuścił inny termin');
    assert.ok(tylkoPilni.length < wszyscy.length, 'filtr niczego nie zawęził');
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

  /* ═══════════ PROMOCJE „OSTATNIE PŁYTY" (zlecenie Dawida, 27.08.2026) ══
   *
   * Dokładnie ten scenariusz, po który powstał ten plik: `npm run worker`
   * i wszystkie 24 testy modułu przechodzą, ale prawdziwy request przez
   * `worker.fetch()` to jedyny sposób złapać literówkę widoczną dopiero
   * przy WYKONANIU (jak self-referencing const w sierpniu).
   */
  const { podpisz } = await import('../worker/panel.js');

  async function ciastkoPanelu(env) {
    const wygasa = Date.now() + 3600000;
    const podpis = await podpisz(env.PANEL_HASLO, 'panel|' + wygasa);
    return `k24h_panel=${wygasa}.${podpis}`;
  }

  function zapytaniePanel(sciezka, cialo, cookie) {
    return new Request(`https://k24h.example${sciezka}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://kam24h.pl', cookie },
      body: JSON.stringify(cialo),
    });
  }

  test('/wyprzedaz bez żadnej płyty zwraca pustą listę, nie błąd', async () => {
    const env = srodowisko();
    const odp = await worker.fetch(zapytanie('/wyprzedaz', {}), env, ctx);
    const dane = await odp.json();
    assert.equal(odp.status, 200, `/wyprzedaz oddał ${odp.status}: ${JSON.stringify(dane)}`);
    assert.deepEqual(dane.plyty, []);
  });

  test('szkic z panelu NIE pojawia się w publicznym /wyprzedaz', async () => {
    const env = srodowisko();
    const cookie = await ciastkoPanelu(env);
    const zapis = await worker.fetch(
      zapytaniePanel(
        '/panel/api/wyprzedaz/zapisz',
        { nazwa: 'Granit testowy', plytaDlCm: 320, plytaGlCm: 160, cenaM2: 890, plytRazem: 3 },
        cookie
      ),
      env,
      ctx
    );
    const zapisDane = await zapis.json();
    assert.equal(zapis.status, 200, `zapisz oddał ${zapis.status}: ${JSON.stringify(zapisDane)}`);
    assert.ok(zapisDane.id, 'brak id nowej płyty');
    assert.ok(
      zapisDane.plyta.linkPodgladu.includes('/wyprzedaz-plyt#wyprzedazPodglad='),
      'link podglądu nie prowadzi na stronę wyprzedaży'
    );

    const publiczny = await (await worker.fetch(zapytanie('/wyprzedaz', {}), env, ctx)).json();
    assert.deepEqual(publiczny.plyty, [], 'szkic wyciekł do publicznego /wyprzedaz');
  });

  test('link podglądu pokazuje TEN szkic, a publikacja wprowadza go na produkcję', async () => {
    const env = srodowisko();
    const cookie = await ciastkoPanelu(env);
    const zapis = await (
      await worker.fetch(
        zapytaniePanel(
          '/panel/api/wyprzedaz/zapisz',
          { nazwa: 'Podgląd — test', plytaDlCm: 320, plytaGlCm: 160, cenaM2: 750, plytRazem: 2 },
          cookie
        ),
        env,
        ctx
      )
    ).json();

    // Wyciągamy exp/podpis z gotowego linku, tak jak zrobiłaby to strona podglądu.
    const b64 = zapis.plyta.linkPodgladu.split('#wyprzedazPodglad=')[1];
    const paczka = JSON.parse(Buffer.from(b64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());

    const podglad = await (await worker.fetch(zapytanie('/wyprzedaz', paczka), env, ctx)).json();
    assert.equal(podglad.plyty.length, 1, 'podgląd nie pokazał szkicu');
    assert.equal(podglad.plyty[0].nazwa, 'Podgląd — test');
    assert.equal(podglad.podglad, true, 'podgląd nie oznaczył się jako podgląd');

    // Sfałszowany podpis nie ma prawa odsłonić szkicu.
    const falszywy = await (
      await worker.fetch(zapytanie('/wyprzedaz', { ...paczka, podpis: 'x'.repeat(64) }), env, ctx)
    ).json();
    assert.deepEqual(falszywy.plyty, [], 'zły podpis odsłonił szkic');

    await worker.fetch(
      zapytaniePanel('/panel/api/wyprzedaz/publikuj', { id: zapis.id, opublikowana: true }, cookie),
      env,
      ctx
    );
    const naProdukcji = await (await worker.fetch(zapytanie('/wyprzedaz', {}), env, ctx)).json();
    assert.equal(naProdukcji.plyty.length, 1, 'opublikowana płyta nie trafiła na produkcję');
  });

  test('płyta oznaczona jako sprzedana znika z publicznej listy, ale zostaje w panelu', async () => {
    const env = srodowisko();
    const cookie = await ciastkoPanelu(env);
    const zapis = await (
      await worker.fetch(
        zapytaniePanel(
          '/panel/api/wyprzedaz/zapisz',
          { nazwa: 'Zejdzie', plytaDlCm: 300, plytaGlCm: 150, cenaM2: 600, plytRazem: 1 },
          cookie
        ),
        env,
        ctx
      )
    ).json();
    await worker.fetch(
      zapytaniePanel('/panel/api/wyprzedaz/publikuj', { id: zapis.id, opublikowana: true }, cookie),
      env,
      ctx
    );
    const przed = await (await worker.fetch(zapytanie('/wyprzedaz', {}), env, ctx)).json();
    assert.equal(przed.plyty.length, 1);

    await worker.fetch(
      zapytaniePanel('/panel/api/wyprzedaz/dostepnosc', { id: zapis.id, plytZostalo: 0 }, cookie),
      env,
      ctx
    );
    const po = await (await worker.fetch(zapytanie('/wyprzedaz', {}), env, ctx)).json();
    assert.deepEqual(po.plyty, [], 'sprzedana płyta nadal widoczna dla klienta');

    // ...ale zostaje w panelu, żeby Dawid mógł odkręcić pomyłkę.
    const wPanelu = await (
      await worker.fetch(zapytaniePanel('/panel/api/wyprzedaz', {}, cookie), env, ctx)
    ).json();
    assert.equal(wPanelu.plyty.length, 1, 'sprzedana płyta zniknęła też z panelu');
  });

  test('wyprzedaz/zapisz bez ciasteczka panelu nie przepuszcza', async () => {
    const env = srodowisko();
    const odp = await worker.fetch(
      zapytanie('/panel/api/wyprzedaz/zapisz', { nazwa: 'x', plytaDlCm: 1, plytaGlCm: 1, cenaM2: 1, plytRazem: 1 }),
      env,
      ctx
    );
    assert.equal(odp.status, 401, `klient bez panelu nie może zapisać płyty, oddał ${odp.status}`);
  });

  test('wyprzedaz/zapisz odrzuca cenę „było" niższą od wyprzedażowej', async () => {
    const env = srodowisko();
    const cookie = await ciastkoPanelu(env);
    const odp = await worker.fetch(
      zapytaniePanel(
        '/panel/api/wyprzedaz/zapisz',
        { nazwa: 'x', plytaDlCm: 320, plytaGlCm: 160, cenaNormalnaM2: 500, cenaM2: 800, plytRazem: 1 },
        cookie
      ),
      env,
      ctx
    );
    assert.equal(odp.status, 400);
    assert.match((await odp.json()).error, /przekreślenie/);
  });

  test('zdjęcie wgrane w panelu wraca pod własnym adresem, nie w liście płyt', async () => {
    const env = srodowisko();
    const cookie = await ciastkoPanelu(env);
    // Najmniejszy poprawny PNG (1×1 px) — chodzi o obsługę, nie o obrazek.
    const png =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const zapis = await (
      await worker.fetch(
        zapytaniePanel(
          '/panel/api/wyprzedaz/zapisz',
          { nazwa: 'Ze zdjęciem', plytaDlCm: 320, plytaGlCm: 160, cenaM2: 700, plytRazem: 1, zdjecieDane: png },
          cookie
        ),
        env,
        ctx
      )
    ).json();
    await worker.fetch(
      zapytaniePanel('/panel/api/wyprzedaz/publikuj', { id: zapis.id, opublikowana: true }, cookie),
      env,
      ctx
    );

    const lista = await (await worker.fetch(zapytanie('/wyprzedaz', {}), env, ctx)).json();
    assert.equal(lista.plyty[0].zdjecie, `/wyprzedaz/zdjecie/${zapis.id}`);
    // Base64 NIE MA prawa jechać w liście — przy kilku płytach urosłaby
    // do megabajtów i spowolniła kalkulator każdemu klientowi.
    assert.ok(!JSON.stringify(lista).includes('iVBORw0KGgo'), 'zdjęcie pojechało w liście płyt');

    const obraz = await worker.fetch(
      new Request(`https://k24h.example/wyprzedaz/zdjecie/${zapis.id}`, {
        headers: { origin: 'https://kam24h.pl' },
      }),
      env,
      ctx
    );
    assert.equal(obraz.status, 200);
    assert.equal(obraz.headers.get('content-type'), 'image/png');
  });

  test('wgrane zdjęcie ponad limit jest odrzucane, a nie zapisywane', async () => {
    const env = srodowisko();
    const cookie = await ciastkoPanelu(env);
    const zaDuze = 'data:image/jpeg;base64,' + 'A'.repeat(800_000);
    const odp = await worker.fetch(
      zapytaniePanel(
        '/panel/api/wyprzedaz/zapisz',
        { nazwa: 'x', plytaDlCm: 320, plytaGlCm: 160, cenaM2: 700, plytRazem: 1, zdjecieDane: zaDuze },
        cookie
      ),
      env,
      ctx
    );
    assert.equal(odp.status, 400);
    assert.match((await odp.json()).error, /za duże/);
  });
}

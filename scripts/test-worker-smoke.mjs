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
import { readFile } from 'node:fs/promises';

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

  test('ZGODA NA TELEFON przechodzi całą drogę: formularz → baza → panel', async () => {
    /*
     * Zlecenie Dawida (01.09.2026): „chcę dzwonić do osób faktycznie tych,
     * co chcą rozmawiać". Sprawdzamy, że wybór klienta naprawdę dojeżdża
     * na kartę w panelu — testy modułu sprawdzają regułę, ten sprawdza drogę.
     */
    const env = srodowisko();
    await worker.fetch(
      zapytanie('/lead', { ...LEAD, email: 'bezTelefonu@example.com', phone: '600100401',
                           termin: 'miesiac', telefonZgoda: 'nie' }),
      env, ctx
    );
    await worker.fetch(
      zapytanie('/lead', { ...LEAD, email: 'zTelefonem@example.com', phone: '600100402',
                           termin: 'miesiac', telefonZgoda: 'tak' }),
      env, ctx
    );

    const cookie = await ciastkoPanelu(env);
    const dane = await (
      await worker.fetch(
        new Request('https://k24h.example/panel/api/dane', {
          headers: { origin: 'https://kam24h.pl', cookie },
        }),
        env, ctx
      )
    ).json();

    const bez = dane.lista.find((k) => k.email === 'bezTelefonu@example.com');
    const z = dane.lista.find((k) => k.email === 'zTelefonem@example.com');
    assert.ok(bez && z, 'nie znalazłem obu kart');
    assert.equal(bez.telefonZgoda, 'nie', 'odmowa nie dojechała do panelu');
    assert.equal(z.telefonZgoda, 'tak', 'zgoda nie dojechała do panelu');
  });

  test('DRUGA WYCENA bez odpowiedzi nie kasuje „nie dzwonić"', async () => {
    /*
     * ⚠ To jest ten telefon, którego Dawid chce uniknąć: klient raz poprosił
     * o kontakt mailem, wrócił po drugą wycenę starą zakładką (bez nowego
     * pola) — i gdyby zapis nadpisywał pustą wartością, karta znów
     * wyglądałaby jak „nie pytaliśmy".
     */
    const env = srodowisko();
    await worker.fetch(
      zapytanie('/lead', { ...LEAD, email: 'wraca@example.com', phone: '600100403',
                           telefonZgoda: 'nie' }),
      env, ctx
    );
    // Druga wycena — bez pola, jak ze starej zakładki.
    await worker.fetch(
      zapytanie('/lead', { ...LEAD, email: 'wraca@example.com', phone: '600100403' }),
      env, ctx
    );

    const cookie = await ciastkoPanelu(env);
    const dane = await (
      await worker.fetch(
        new Request('https://k24h.example/panel/api/dane', {
          headers: { origin: 'https://kam24h.pl', cookie },
        }),
        env, ctx
      )
    ).json();
    const k = dane.lista.find((x) => x.email === 'wraca@example.com');
    assert.equal(k.telefonZgoda, 'nie', 'druga wycena skasowała prośbę o kontakt mailem');
    assert.equal(k.wycen, 2, 'to miała być ta sama karta, nie nowa');
  });

  test('MAIL do Dawida ostrzega, gdy klient nie chce telefonu', async () => {
    listy.length = 0;
    await worker.fetch(
      zapytanie('/lead', { ...LEAD, email: 'mail-nie@example.com', telefonZgoda: 'nie' }),
      srodowisko(), ctx
    );
    const doFirmy = listy[0];
    assert.match(doFirmy.subject, /^NIE DZWONIĆ — /, `temat: ${doFirmy.subject}`);
    assert.match(doFirmy.html, /NIE DZWONIĆ — KLIENT PROSI O KONTAKT MAILEM/);
    assert.match(doFirmy.text, /\*\*\* NIE DZWONIĆ/);
    assert.match(doFirmy.html, /Wolę mailem lub SMS-em/, 'brak wiersza „Kontakt"');
  });

  test('MAIL wyróżnia klienta, który PROSI o telefon', async () => {
    listy.length = 0;
    await worker.fetch(
      zapytanie('/lead', { ...LEAD, email: 'mail-tak@example.com', telefonZgoda: 'tak' }),
      srodowisko(), ctx
    );
    const doFirmy = listy[0];
    assert.doesNotMatch(doFirmy.subject, /NIE DZWONIĆ/, `temat: ${doFirmy.subject}`);
    assert.match(doFirmy.html, /PROSI O TELEFON/);
    assert.match(doFirmy.text, /Kontakt: KLIENT PROSI O TELEFON/);
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

  test('KAZDA trasa z routera ma swoja funkcje i nie rzuca wyjatkiem', async () => {
    /*
     * REGRESJA Z 30.08.2026, ktorej ten test pilnuje.
     *
     * Przepisujac promocje na wyprzedaz podmienilem blok kodu PO NUMERACH
     * LINII, a w srodku tego zakresu stala `obsluzKolekcje`. Trasa
     * `/kolekcje` zostala w routerze, funkcji juz nie bylo — i poniewaz
     * ta trasa stala POZA `try`, produkcja oddawala surowy wyjatek workera
     * (blad 1101), nie czytelne 500. Zaden test tego nie lapal, bo zaden
     * nie wolal `/kolekcje`.
     *
     * Dlatego nie wypisujemy tras recznie: CZYTAMY je z routera. Dolozenie
     * trasy automatycznie dokłada ja do tego testu.
     */
    const zrodlo = await readFile(new URL('../worker/worker.js', import.meta.url), 'utf8');

    // `if (sciezka === '/cos')` oraz `sciezka.startsWith('/cos/')`
    const dokladne = [...zrodlo.matchAll(/sciezka === '(\/[^']*)'/g)].map((m) => m[1]);
    const prefiksy = [...zrodlo.matchAll(/sciezka\.startsWith\('(\/[^']*)'\)/g)].map((m) => m[1]);
    const trasy = [...new Set([...dokladne, ...prefiksy])]
      // Panel ma wlasne logowanie i osobne testy nizej.
      .filter((t) => !t.startsWith('/panel'));

    assert.ok(trasy.length >= 8, `router zna tylko ${trasy.length} tras — cos nie tak z odczytem`);

    const env = srodowisko();
    const zle = [];
    for (const trasa of trasy) {
      // Prefiksowe trasy potrzebuja czegos po ukosniku.
      const adres = prefiksy.includes(trasa) ? `${trasa}1` : trasa;
      for (const metoda of ['GET', 'POST']) {
        const zadanie =
          metoda === 'GET'
            ? new Request(`https://k24h.example${adres}`, { headers: { origin: 'https://kam24h.pl' } })
            : zapytanie(adres, {});
        const odp = await worker.fetch(zadanie, env, ctx);
        /*
         * Interesuje nas DOKLADNIE 500 — to kod z naszego `catch`,
         * czyli „funkcja wybuchla albo jej nie ma". 503 jest odpowiedzia
         * ZAMIERZONA (np. /chat bez klucza Anthropic w atrapie srodowiska),
         * a nie awaria, wiec go nie liczymy.
         */
        if (odp.status === 500) zle.push(`${metoda} ${adres} -> 500`);
      }
    }
    assert.deepEqual(zle, [], `trasy oddaly blad serwera:\n  ${zle.join('\n  ')}`);
  });

  test('/kolekcje mowi, jakie cenniki zna WDROZONY worker', async () => {
    // Ten endpoint istnieje po to, zeby dalo sie sprawdzic, czy worker
    // zostal wdrozony po zmianie cennika — patrz `npm run sprawdz:asystent`.
    const odp = await worker.fetch(
      new Request('https://k24h.example/kolekcje', { headers: { origin: 'https://kam24h.pl' } }),
      srodowisko(),
      ctx
    );
    assert.equal(odp.status, 200);
    const d = await odp.json();
    assert.ok(Array.isArray(d.kolekcje) && d.kolekcje.length >= 5, `kolekcje: ${JSON.stringify(d.kolekcje)}`);
    assert.ok(d.dekorow > 100, `dekorow: ${d.dekorow}`);
  });

  test('PANEL POZWALA WYSWIETLAC OBRAZKI (img-src w CSP)', async () => {
    /*
     * ⚠ REGRESJA Z 30.08.2026, zgloszona przez Dawida jako „nie moge dodac
     * zdjecia w wyprzedazy plyt".
     *
     * CSP panelu mialo `default-src 'none'` i NIE MIALO `img-src`. Efekt:
     * przegladarka blokowala kazdy obrazek, wiec podglad z `data:` URI
     * nie ladowal sie i `Image.onerror` odpalal sie dla POPRAWNEGO JPEG-a.
     * Upload nie dzialal dla ZADNEGO pliku, a miniatury przy wierszach
     * plyt tez byly puste.
     *
     * Testy tego nie lapaly, bo szly przez API (`worker.fetch`), a nie
     * przez przegladarke — a CSP dziala dopiero w przegladarce.
     */
    const odp = await worker.fetch(
      new Request('https://k24h.example/panel', { headers: { origin: 'https://kam24h.pl' } }),
      srodowisko(),
      ctx
    );
    const csp = odp.headers.get('content-security-policy') || '';
    assert.ok(csp, 'panel bez CSP');
    assert.match(csp, /img-src/, 'CSP panelu nie pozwala na zadne obrazki');

    const img = csp.match(/img-src ([^;]*)/)[1];
    assert.match(img, /data:/, 'brak `data:` — podglad zdjecia przed wyslaniem nie zadziala');
    assert.match(img, /'self'/, "brak `'self'` — miniatury z /wyprzedaz/zdjecie/<id> nie zadzialaja");
  });

  test('panel nie rozluznia CSP bardziej, niz trzeba', async () => {
    // Obrazki tak, ale skrypty i ramki z zewnatrz — nie.
    const odp = await worker.fetch(
      new Request('https://k24h.example/panel', { headers: { origin: 'https://kam24h.pl' } }),
      srodowisko(),
      ctx
    );
    const csp = odp.headers.get('content-security-policy') || '';
    assert.ok(!/script-src[^;]*https:/.test(csp), 'CSP wpuszcza skrypty z zewnatrz');
    assert.match(csp, /frame-ancestors 'none'/, 'panel da sie osadzic w ramce');
    assert.match(csp, /default-src 'none'/, 'panel stracil domyslna blokade');
  });

  test('limit zdjecia po stronie panelu jest NIZSZY niz w workerze', async () => {
    /*
     * Panel kompresuje zdjecie do wlasnego limitu, worker odrzuca powyzej
     * swojego. Gdyby panel mial limit rowny albo wyzszy, Dawid widzialby
     * podglad, klikal „Zapisz" i DOPIERO wtedy dostawal blad — najgorsza
     * mozliwa kolejnosc. Zapas jest po to, zeby problem nigdy do niego
     * nie dotarl.
     */
    const { MAX_ZDJECIE_ZNAKOW } = await import('../worker/wyprzedaz-baza.js');
    const zrodlo = fs.readFileSync(new URL('../worker/panel.js', import.meta.url), 'utf8');
    const limitPanelu = Number(zrodlo.match(/var ZDJECIE_LIMIT = (\d+)/)[1]);

    assert.ok(
      limitPanelu < MAX_ZDJECIE_ZNAKOW,
      `panel kompresuje do ${limitPanelu}, a worker przyjmuje do ${MAX_ZDJECIE_ZNAKOW}`
    );
  });

  test('panel mowi WPROST, co zrobic z formatem bez dekodera', () => {
    /*
     * Zdjecia z telefonu bywaja w HEIC (iPhone, czesc Samsungow), ktorego
     * przegladarka nie zdekoduje. „Nie umiem odczytac tego pliku" nie mowi
     * uzytkownikowi nic — komunikat ma powiedziec, CO ZROBIC.
     */
    const zrodlo = fs.readFileSync(new URL('../worker/panel.js', import.meta.url), 'utf8');
    assert.match(zrodlo, /BEZ_DEKODERA/, 'panel nie rozpoznaje formatow bez dekodera');
    assert.match(zrodlo, /heic\|heif/, 'HEIC/HEIF nie sa rozpoznawane');
    assert.match(zrodlo, /JPG albo PNG/, 'komunikat nie mowi, jakiego formatu uzyc');
    // Blad odczytu z dysku tez nie moze konczyc sie cisza.
    assert.match(zrodlo, /czytnik\.onerror/, 'brak obslugi bledu odczytu pliku');
  });

  test('kompresja zdjecia schodzi z jakoscia, gdy nie miesci sie w limicie', () => {
    // Samo skalowanie do 1200 px nie wystarcza: szczegolowe zdjecie plyty
    // dawalo 910 kB base64, czyli powyzej limitu workera.
    const zrodlo = fs.readFileSync(new URL('../worker/panel.js', import.meta.url), 'utf8');
    assert.match(zrodlo, /function sprezuj/, 'brak adaptacyjnej kompresji');
    const jakosci = zrodlo.match(/var jakosci = \[([^\]]*)\]/);
    assert.ok(jakosci, 'brak listy jakosci kompresji');
    assert.ok(
      jakosci[1].split(',').length >= 3,
      'kompresja ma tylko jeden prog jakosci — przy szczegolowym zdjeciu nie zejdzie pod limit'
    );
  });

  test('panel sprawdza, czy wklejony adres NAPRAWDE jest zdjeciem', () => {
    /*
     * ⚠ Z zycia (31.08.2026): Dawid wkleil w pole adresu link
     * „share.google/..." — czyli adres STRONY ze zdjeciem, nie samego pliku.
     * Przegladarka nie zrobi z tego obrazka, wiec klient na stronie
     * wyprzedazy widzial pusta ramke, a panel milczal.
     */
    const zrodlo = fs.readFileSync(new URL('../worker/panel.js', import.meta.url), 'utf8');
    assert.match(zrodlo, /function sprawdzAdresZdjecia/, 'panel nie sprawdza adresu zdjecia');
    assert.match(zrodlo, /share\.google/, 'nie rozpoznajemy linku do strony zamiast pliku');
    assert.match(zrodlo, /pl-zdjecie-url'\)\.onchange/, 'sprawdzanie nie jest podpiete do pola');

    /*
     * Adres MUSI byc z kam24h.pl: strona wyprzedazy ma wlasne CSP i obcych
     * obrazkow nie pokaze. Panel ma luzniejsze CSP, wiec bez tej kontroli
     * Dawid widzialby „adres dziala", a klient pusta ramke.
     */
    assert.match(zrodlo, /kam24h\.pl/, 'panel nie sprawdza, czy adres jest z naszej domeny');

    const csp = fs.readFileSync(new URL('../netlify.toml', import.meta.url), 'utf8')
      .match(/img-src ([^;]*)/)[1];
    assert.ok(
      !/https:(?!\/)/.test(csp),
      'strona dopuszcza obrazki z dowolnego https — kontrola domeny w panelu jest wtedy za ostra'
    );
  });

  test('SKRYPT PANELU PARSUJE SIE W PRZEGLADARCE', async () => {
    /*
     * ⚠ REGRESJA Z 31.08.2026, zgloszona jako „w panelu nie widze zadnych zlecen".
     *
     * Skrypt panelu mieszka w TEMPLATE LITERALU, wiec pojedynczy ukosnik
     * odwrotny jest w nim zjadany: regex sprawdzajacy adres dojechal do
     * przegladarki bez ukosnikow i wywalil CALY skrypt panelu bledem
     * skladni. Endpointy odpowiadaly poprawnie (200, 51 klientow), ale nic
     * sie nie renderowalo: ani lista, ani lejek, ani „na dzis".
     *
     * `node --check worker/panel.js` tego NIE lapal, bo sprawdza modul,
     * a nie tresc szablonu. Ten test bierze HTML z prawdziwej odpowiedzi
     * i probuje sparsowac to, co naprawde dostaje przegladarka.
     */
    const env = srodowisko();
    const cookie = await ciastkoPanelu(env);
    const odp = await worker.fetch(
      new Request('https://k24h.example/panel', {
        headers: { origin: 'https://kam24h.pl', cookie },
      }),
      env,
      ctx
    );
    assert.equal(odp.status, 200, 'panel nie oddal strony po zalogowaniu');

    const html = await odp.text();
    const skrypty = [...html.matchAll(/<script>([^]*?)<\/script>/g)].map((m) => m[1]);
    assert.ok(skrypty.length, 'panel nie ma wcale skryptu');

    for (const [i, kod] of skrypty.entries()) {
      try {
        // Sam parsing, bez uruchamiania — rzuca na bledzie skladni.
        new Function(kod);
      } catch (e) {
        assert.fail(`skrypt ${i + 1} panelu nie parsuje sie: ${e.message}`);
      }
    }
  });

  test('panel po zalogowaniu naprawde niesie liste zgloszen', async () => {
    // Druga strona tej samej regresji: sprawdzamy, ze endpoint oddaje karty,
    // a nie tylko ze cos odpowiada.
    const env = srodowisko();
    await worker.fetch(zapytanie('/lead', { ...LEAD, phone: '600100301', email: 'lista@example.com' }), env, ctx);

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

    assert.ok(Array.isArray(dane.lista), 'brak listy zgloszen');
    assert.ok(dane.lista.length >= 1, 'lista zgloszen pusta mimo zapisanego leada');
    assert.ok('termin' in dane.lista[0], 'karta klienta bez pola terminu');
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

  test('SZEŚĆDZIESIĄT PŁYT nie topi listy — zdjęcia nie jadą w JSON-ie', async () => {
    /*
     * Pytanie Dawida (01.09.2026): „czy duża liczba płyt nie obciąży strony".
     *
     * ⚠ Zanim to napisałem, `listaPlyt` robiła `SELECT *` — a więc czytała
     * z D1 KAŻDE zdjęcie (do 700 kB base64 na płytę), żeby po chwili je
     * wyrzucić: front i tak dostaje sam ADRES obrazka. Przy dwóch płytach
     * to było 389 kB na odsłonę, przy sześćdziesięciu byłoby ~12 MB.
     *
     * Ten test mierzy odpowiedź przy sześćdziesięciu płytach ze zdjęciami.
     * Nie jest to test „czy szybko" (na atrapie SQLite to nic nie znaczy),
     * tylko „czy w odpowiedzi nie ma bajtów, których nie powinno tam być".
     */
    const env = srodowisko();
    const cookie = await ciastkoPanelu(env);
    // ~40 kB base64 na płytę — mniej niż realne zdjęcie, ale dość, żeby
    // przypadkowy `SELECT *` rzucał się w oczy w rozmiarze odpowiedzi.
    const zdjecie = 'data:image/jpeg;base64,' + 'A'.repeat(40_000);

    const ILE = 60;
    for (let i = 0; i < ILE; i += 1) {
      const zapis = await (
        await worker.fetch(
          zapytaniePanel(
            '/panel/api/wyprzedaz/zapisz',
            {
              nazwa: `Płyta testowa ${i}`,
              plytaDlCm: 320,
              plytaGlCm: 160,
              cenaM2: 700 + i,
              plytRazem: 1,
              zdjecieDane: zdjecie,
              zdjecieMini: 'data:image/jpeg;base64,' + 'B'.repeat(3000),
              kategoria: ['spiek', 'naturalny', 'konglomerat'][i % 3],
              typ: i % 4 === 0 ? 'poprodukcyjna' : 'pelna',
            },
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
    }

    const surowa = await (await worker.fetch(zapytanie('/wyprzedaz', {}), env, ctx)).text();
    const dane = JSON.parse(surowa);

    assert.equal(dane.plyty.length, ILE, 'lista zgubiła płyty');

    // Żaden bajt zdjęcia nie ma prawa być w liście.
    assert.ok(!surowa.includes('AAAAAAAAAA'), 'pełne zdjęcie pojechało w liście płyt');
    assert.ok(!surowa.includes('BBBBBBBBBB'), 'miniatura pojechała w liście płyt');

    /*
     * Budżet na odpowiedź. Sześćdziesiąt płyt to ~25 kB metadanych — gdyby
     * kiedyś ktoś dołożył do `zWiersza` kolumnę z base64, ten limit pęknie
     * natychmiast i będzie wiadomo dlaczego.
     */
    const kb = Math.round(surowa.length / 1024);
    assert.ok(kb < 60, `lista ${ILE} płyt waży ${kb} kB — ktoś dołożył do niej dane zdjęć`);

    // Kategorie i typy przeżyły zapis i wracają do klienta.
    assert.ok(dane.plyty.every((p) => p.kategoria), 'kategoria nie wróciła z bazy');
    assert.ok(dane.plyty.some((p) => p.typ === 'poprodukcyjna'), 'typ nie wrócił z bazy');
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
    /*
     * Adres niesie znacznik `?v=` (czas ostatniej zmiany wiersza). Bez niego
     * podmiana zdjęcia w panelu nie zmieniałaby adresu i klient dostawałby
     * z cache stare zdjęcie — a to właśnie znacznik pozwala trzymać obrazek
     * przez rok zamiast godziny.
     */
    const adresZdjecia = lista.plyty[0].zdjecie;
    assert.ok(
      adresZdjecia.startsWith(`/wyprzedaz/zdjecie/${zapis.id}?v=`),
      `adres zdjęcia bez znacznika wersji: ${adresZdjecia}`
    );
    assert.match(adresZdjecia, /\?v=\d{8,}$/, 'znacznik wersji nie jest datą zmiany');
    // Miniatura idzie osobnym adresem — to ona ląduje na kartach listy.
    assert.match(
      lista.plyty[0].zdjecieMini,
      /\?(mini=1&)?v=\d{8,}$/,
      'brak osobnego adresu miniatury'
    );
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

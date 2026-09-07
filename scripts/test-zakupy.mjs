/**
 * ZAKUPY Z TRELLO (zlecenie Dawida, 06.09.2026).
 *
 *   node --test scripts/test-zakupy.mjs
 *
 * Po co to powstało, słowami Dawida: pozycje do kupienia leżą
 * w checklistach na kartach grobów i nigdzie nie widać ich razem, więc
 * zamawiał na raty. Cała wartość tego modułu jest w JEDNEJ liczbie —
 * „ławeczki: 4 szt." — i ta liczba musi się zgadzać.
 *
 * ⚠ W testach NIE MA prawdziwych nazwisk. Karty grobów to dane osobowe
 * rodzin, a repozytorium jest publiczne. Używamy „Karta A", „Karta B".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { rozbierzPozycje, kluczProduktu, bezOgonkow, odhaczWTrello } from '../worker/trello.js';
import {
  znanyStatus,
  konfigDlaPanelu,
  zapiszKonfig,
  wczytajKonfig,
  zestawienie,
  listaDoMaila,
  ustawStatus,
  ustawStatusGrupy,
  ustawDostawce,
} from '../worker/zakupy.js';

const SCHEMAT = fs.readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');

function nowaBaza() {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMAT);
  return {
    prepare(sql) {
      let dane = [];
      const stmt = db.prepare(sql);
      const api = {
        bind(...a) {
          dane = a.map((x) => (x === undefined ? null : typeof x === 'boolean' ? Number(x) : x));
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

/** Wstawia pozycję prosto do bazy — omija Trello, testujemy agregację. */
async function dodaj(env, { item, karta, tresc, produkt, klucz, ilosc = 1, dostawca = '', zrodlo = '' }) {
  const t = new Date().toISOString();
  await env.BAZA.prepare(
    `INSERT INTO zakupy_pozycje
       (trello_item_id, trello_card_id, karta_nazwa, karta_url, tresc, produkt, klucz,
        ilosc, dostawca, dostawca_zrodlo, trello_odhaczone, widziano, utworzono)
     VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, ?, 0, ?, ?)`
  )
    .bind(item, 'karta-' + karta, karta, tresc, produkt, klucz, ilosc, dostawca, zrodlo, t, t)
    .run();
}

/* ═════════════════════════════════════════════ rozbiór tekstu pozycji */

test('DOPISEK DOSTAWCY odcina się od nazwy produktu', () => {
  const p = rozbierzPozycje('ławeczka ze skrzyneczką — Firma Nowak');
  assert.equal(p.produkt, 'ławeczka ze skrzyneczką');
  assert.equal(p.dostawca, 'Firma Nowak');
});

test('myślnik W ŚRODKU nazwy nie jest dopiskiem dostawcy', () => {
  /*
   * „litery piaskowane - srebrne" to jedna nazwa, nie produkt u dostawcy
   * „srebrne". Bierzemy OSTATNI myślnik, ale tylko wtedy, gdy ogon wygląda
   * jak nazwa firmy — inaczej lądowałoby to w grupie „dostawca: srebrne".
   */
  const p = rozbierzPozycje('litery piaskowane - srebrne — Kamień sp. z o.o.');
  assert.equal(p.dostawca, 'Kamień sp. z o.o.');
  assert.match(p.produkt, /litery piaskowane/);
});

test('bez dopisku dostawca zostaje pusty — niczego nie zgadujemy', () => {
  const p = rozbierzPozycje('misa');
  assert.equal(p.dostawca, '');
  assert.equal(p.produkt, 'misa');
});

test('ILOŚĆ czytamy z każdego zapisu, jakiego Dawid używa', () => {
  assert.equal(rozbierzPozycje('2x misa').ilosc, 2);
  assert.equal(rozbierzPozycje('misa x2').ilosc, 2);
  assert.equal(rozbierzPozycje('misa 3 szt').ilosc, 3);
  assert.equal(rozbierzPozycje('4 szt. ławeczki').ilosc, 4);
  assert.equal(rozbierzPozycje('misa').ilosc, 1, 'brak liczby to jedna sztuka');
});

test('ilość znika z nazwy produktu', () => {
  // Inaczej „2x misa" i „misa" byłyby dwoma osobnymi produktami
  // i nie zsumowałyby się — czyli dokładnie problem, który tu rozwiązujemy.
  assert.equal(rozbierzPozycje('2x misa').produkt, 'misa');
  assert.equal(rozbierzPozycje('misa 3 szt').produkt, 'misa');
});

test('⚠ ZNACZNIK „zamówione" NIE WRACA do nazwy produktu', () => {
  /*
   * Najbardziej podstępny błąd w tym module. Odhaczając pozycję dopisujemy
   * do niej w Trello „✅ zamówione [data]". Przy następnej synchronizacji
   * czytamy tę samą pozycję z powrotem — gdyby znacznik został w nazwie,
   * powstałby nowy produkt („misa ✅ zamówione 2026-09-06"), osobna grupa,
   * a przy każdym przebiegu crona nazwa puchłaby o kolejny dopisek.
   */
  const p = rozbierzPozycje('misa ✅ zamówione 2026-09-06');
  assert.equal(p.produkt, 'misa');
  assert.equal(kluczProduktu(p.produkt), kluczProduktu('misa'));
});

/* ═════════════════════════════════════════════════ sumowanie produktów */

test('WARIANTY TEGO SAMEGO PRODUKTU mają wspólny klucz', () => {
  const laweczka = kluczProduktu('ławeczka');
  assert.equal(kluczProduktu('ławeczka ze skrzyneczką'), laweczka);
  assert.equal(kluczProduktu('Ławeczka granitowa'), laweczka);
  assert.equal(kluczProduktu('ławeczki'), laweczka, 'liczba mnoga rozbija sumowanie');

  const misa = kluczProduktu('misa');
  assert.equal(kluczProduktu('misa granitowa'), misa);
  assert.equal(kluczProduktu('Misa czarna'), misa);
});

test('RÓŻNE produkty NIE zlewają się w jeden', () => {
  // Zlanie „misy" z „ławeczką" byłoby gorsze niż brak sumowania:
  // Dawid zamówiłby cztery sztuki czegoś, czego nie potrzebuje.
  const klucze = ['misa', 'ławeczka', 'zdjęcie', 'litery piaskowane srebrne', 'wazon'].map(kluczProduktu);
  assert.equal(new Set(klucze).size, klucze.length);
});

test('ogonki nie rozbijają grupowania', () => {
  assert.equal(bezOgonkow('Ławeczka ze skrzyneczką'), 'laweczka ze skrzyneczka');
});

test('SUMOWANIE per dostawca i produkt — sedno całego modułu', async () => {
  const env = { BAZA: nowaBaza() };
  const k = kluczProduktu('ławeczka');
  await dodaj(env, { item: 'i1', karta: 'Karta A', tresc: 'ławeczka — Nowak', produkt: 'ławeczka', klucz: k, dostawca: 'Nowak', zrodlo: 'dopisek' });
  await dodaj(env, { item: 'i2', karta: 'Karta B', tresc: 'ławeczka ze skrzyneczką — Nowak', produkt: 'ławeczka ze skrzyneczką', klucz: k, dostawca: 'Nowak', zrodlo: 'dopisek' });
  await dodaj(env, { item: 'i3', karta: 'Karta C', tresc: '2x ławeczka — Nowak', produkt: 'ławeczka', klucz: k, ilosc: 2, dostawca: 'Nowak', zrodlo: 'dopisek' });
  await dodaj(env, { item: 'i4', karta: 'Karta D', tresc: 'misa — Kowalski', produkt: 'misa', klucz: kluczProduktu('misa'), dostawca: 'Kowalski', zrodlo: 'dopisek' });

  const grupy = await zestawienie(env);
  assert.equal(grupy.length, 2, 'dwaj dostawcy, dwie grupy');

  const nowak = grupy.find((g) => g.dostawca === 'Nowak');
  assert.equal(nowak.produkty.length, 1, 'warianty ławeczki rozbiły się na kilka wierszy');
  assert.equal(nowak.produkty[0].sztuk, 4, 'ŹLE ZSUMOWANE — to jest ta jedna liczba, po którą Dawid tu wchodzi');
  assert.equal(nowak.produkty[0].pozycje.length, 3, 'nie widać, z których kart to się wzięło');
  // Nagłówek grupy ma być najbardziej opisowy z wariantów.
  assert.equal(nowak.produkty[0].nazwa, 'ławeczka ze skrzyneczką');
});

test('pozycje BEZ DOSTAWCY lądują w osobnej grupie, na końcu', async () => {
  const env = { BAZA: nowaBaza() };
  await dodaj(env, { item: 'i1', karta: 'Karta A', tresc: 'misa', produkt: 'misa', klucz: kluczProduktu('misa') });
  await dodaj(env, { item: 'i2', karta: 'Karta B', tresc: 'wazon — Nowak', produkt: 'wazon', klucz: kluczProduktu('wazon'), dostawca: 'Nowak', zrodlo: 'dopisek' });

  const grupy = await zestawienie(env);
  assert.equal(grupy[0].dostawca, 'Nowak', 'znany dostawca ma być pierwszy');
  assert.equal(grupy[1].nieznany, true, 'brak dostawcy to lista do uzupełnienia, nie do zamówienia');
});

test('lista do maila niesie sztuki I karty', async () => {
  const env = { BAZA: nowaBaza() };
  const k = kluczProduktu('ławeczka');
  await dodaj(env, { item: 'i1', karta: 'Karta A', tresc: 'ławeczka — Nowak', produkt: 'ławeczka', klucz: k, dostawca: 'Nowak', zrodlo: 'dopisek' });
  await dodaj(env, { item: 'i2', karta: 'Karta B', tresc: 'ławeczka — Nowak', produkt: 'ławeczka', klucz: k, dostawca: 'Nowak', zrodlo: 'dopisek' });

  const tekst = listaDoMaila((await zestawienie(env))[0]);
  assert.match(tekst, /2 szt/, 'brak liczby sztuk — po to jest ta lista');
  assert.match(tekst, /Karta A/, 'brak kart — przy reklamacji nie wiadomo, której dotyczy');
  assert.match(tekst, /796 991 128/, 'brak kontaktu do Dawida');
});

/* ═════════════════════════════════════════════════════════ statusy */

test('status przechodzi do kupienia → zamówione → otrzymane', async () => {
  const env = { BAZA: nowaBaza() };
  await dodaj(env, { item: 'i1', karta: 'Karta A', tresc: 'misa', produkt: 'misa', klucz: kluczProduktu('misa') });
  const id = (await env.BAZA.prepare(`SELECT id FROM zakupy_pozycje`).first()).id;

  // Bez tokenu Trello nie ruszamy — `doTrello:false` w teście.
  await ustawStatus(env, { id, status: 'zamowione', doTrello: false });
  let p = await env.BAZA.prepare(`SELECT status, zamowiono, otrzymano FROM zakupy_pozycje WHERE id = ?`).bind(id).first();
  assert.equal(p.status, 'zamowione');
  assert.ok(p.zamowiono, 'brak daty zamówienia');
  assert.equal(p.otrzymano, null);

  await ustawStatus(env, { id, status: 'otrzymane', doTrello: false });
  p = await env.BAZA.prepare(`SELECT status, zamowiono, otrzymano FROM zakupy_pozycje WHERE id = ?`).bind(id).first();
  assert.equal(p.status, 'otrzymane');
  assert.ok(p.otrzymano, 'brak daty odbioru');
  assert.ok(p.zamowiono, 'data zamówienia zniknęła przy odbiorze');
});

test('nieznany status jest odrzucany', async () => {
  const env = { BAZA: nowaBaza() };
  await dodaj(env, { item: 'i1', karta: 'Karta A', tresc: 'misa', produkt: 'misa', klucz: kluczProduktu('misa') });
  const id = (await env.BAZA.prepare(`SELECT id FROM zakupy_pozycje`).first()).id;
  const odp = await ustawStatus(env, { id, status: 'wymyslony' });
  assert.equal(odp.ok, false);
  assert.equal(znanyStatus('wymyslony'), false);
  assert.equal(znanyStatus('zamowione'), true);
});

test('ZAMÓWIENIE HURTEM zmienia wszystkie sztuki produktu naraz', async () => {
  // To jest cel całego modułu: jeden klik zamiast czterech.
  const env = { BAZA: nowaBaza() };
  const k = kluczProduktu('ławeczka');
  for (const [i, karta] of ['Karta A', 'Karta B', 'Karta C'].entries()) {
    await dodaj(env, { item: 'i' + i, karta, tresc: 'ławeczka — Nowak', produkt: 'ławeczka', klucz: k, dostawca: 'Nowak', zrodlo: 'dopisek' });
  }
  const odp = await ustawStatusGrupy(env, { klucz: k, dostawca: 'Nowak', status: 'zamowione' });
  assert.equal(odp.zmieniono, 3);
  const zostalo = await zestawienie(env, { status: 'do_kupienia' });
  assert.equal(zostalo.length, 0, 'coś zostało w „do kupienia"');
});

/* ═══════════════════════════════════════════════ nauka dostawcy */

test('ręczne przypisanie dostawcy zostaje zapamiętane na przyszłość', async () => {
  const env = { BAZA: nowaBaza() };
  const k = kluczProduktu('misa');
  await dodaj(env, { item: 'i1', karta: 'Karta A', tresc: 'misa', produkt: 'misa', klucz: k });
  await ustawDostawce(env, { klucz: k, dostawca: 'Nowak' });

  const p = await env.BAZA.prepare(`SELECT dostawca, dostawca_zrodlo FROM zakupy_pozycje`).first();
  assert.equal(p.dostawca, 'Nowak');
  assert.equal(p.dostawca_zrodlo, 'reczne');

  const nauka = await env.BAZA.prepare(`SELECT dostawca FROM zakupy_dostawcy WHERE produkt = ?`).bind(k).first();
  assert.equal(nauka.dostawca, 'Nowak', 'nie zapamiętano — przy następnej misie znów trzeba by wpisywać');
});

test('⚠ ręczne przypisanie NIE nadpisuje dopisku z Trello', async () => {
  /*
   * Dopisek „— Firma" w Trello jest tym, co Dawid napisał WPROST.
   * Podpowiedź i poprawka zbiorcza nie mają prawa go nadpisać, bo wtedy
   * jego własna decyzja cicho by zniknęła.
   */
  const env = { BAZA: nowaBaza() };
  const k = kluczProduktu('misa');
  await dodaj(env, { item: 'i1', karta: 'Karta A', tresc: 'misa — Kowalski', produkt: 'misa', klucz: k, dostawca: 'Kowalski', zrodlo: 'dopisek' });
  await ustawDostawce(env, { klucz: k, dostawca: 'Nowak' });
  const p = await env.BAZA.prepare(`SELECT dostawca FROM zakupy_pozycje`).first();
  assert.equal(p.dostawca, 'Kowalski');
});

/* ═══════════════════════════════════════════ sekrety i zapis do Trello */

test('⚠ TOKEN TRELLO NIE WYCHODZI DO PRZEGLĄDARKI', async () => {
  /*
   * Panel jest za hasłem, ale sekret wstawiony w HTML zostaje w historii
   * przeglądarki, w cache i na każdym zrzucie ekranu. Do panelu idzie
   * wyłącznie „czy jest" i cztery ostatnie znaki.
   */
  const env = { BAZA: nowaBaza() };
  await zapiszKonfig(env, { klucz: 'KLUCZ-TESTOWY', token: 'TOKEN-TAJNY-1234' });
  const widok = konfigDlaPanelu(await wczytajKonfig(env));
  const json = JSON.stringify(widok);
  assert.ok(!json.includes('TOKEN-TAJNY-1234'), 'TOKEN WYCIEKŁ DO PANELU');
  assert.ok(!json.includes('KLUCZ-TESTOWY'), 'KLUCZ WYCIEKŁ DO PANELU');
  assert.equal(widok.maToken, true);
  assert.equal(widok.koncowkaTokenu, '…1234');
});

test('pusta wartość w konfiguracji nie kasuje zapisanego sekretu', async () => {
  // Formularz nie odsyła tokenu z powrotem, więc zapis samej tablicy
  // z pustym polem tokenu kasowałby połączenie.
  const env = { BAZA: nowaBaza() };
  await zapiszKonfig(env, { klucz: 'K', token: 'T' });
  await zapiszKonfig(env, { tablica: 'abc' });
  const k = await wczytajKonfig(env);
  assert.equal(k.token, 'T');
  assert.equal(k.tablica, 'abc');
});

test('ODHACZENIE w Trello dopisuje znacznik i NIE dubluje go przy kolejnym przebiegu', async () => {
  const wolania = [];
  const stary = globalThis.fetch;
  globalThis.fetch = async (url) => {
    // URLSearchParams koduje spację jako „+", nie „%20" — bez tego
    // asercje poniżej porównywałyby coś innego, niż leci do Trello.
    wolania.push(decodeURIComponent(String(url)).replace(/\+/g, ' '));
    return { ok: true, json: async () => ({}), text: async () => '' };
  };
  try {
    const konfig = { klucz: 'K', token: 'T' };
    await odhaczWTrello(konfig, { kartaId: 'c1', itemId: 'i1', nazwa: 'misa', status: 'zamowione', data: '2026-09-06' });
    const pierwsze = wolania[0];
    assert.match(pierwsze, /state=complete/);
    assert.match(pierwsze, /✅ zamówione 2026-09-06/);

    // Drugi przebieg na nazwie, która znacznik już ma.
    await odhaczWTrello(konfig, { kartaId: 'c1', itemId: 'i1', nazwa: 'misa ✅ zamówione 2026-09-06', status: 'zamowione', data: '2026-09-07' });
    const drugie = wolania[1];
    assert.equal((drugie.match(/✅/g) || []).length, 1, 'nazwa puchnie z każdym przebiegiem crona');

    // Cofnięcie odznacza pozycję — panel i Trello mają pokazywać to samo.
    await odhaczWTrello(konfig, { kartaId: 'c1', itemId: 'i1', nazwa: 'misa ✅ zamówione 2026-09-06', status: 'do_kupienia', data: '2026-09-07' });
    assert.match(wolania[2], /state=incomplete/);
  } finally {
    globalThis.fetch = stary;
  }
});

test('bez klucza i tokenu NIC nie leci do Trello', async () => {
  // Zabezpieczenie przed wysłaniem czegokolwiek, zanim Dawid zobaczy podgląd.
  let ruszono = false;
  const stary = globalThis.fetch;
  globalThis.fetch = async () => {
    ruszono = true;
    return { ok: true, json: async () => ({}), text: async () => '' };
  };
  try {
    const odp = await odhaczWTrello({}, { kartaId: 'c1', itemId: 'i1', nazwa: 'misa', status: 'zamowione', data: '2026-09-06' });
    assert.equal(odp.ok, false);
    assert.equal(ruszono, false, 'poszło zapytanie do Trello bez tokenu');
  } finally {
    globalThis.fetch = stary;
  }
});

/* ═══════════════════════════════════════════════ podłączenie w panelu */

test('moduł jest PODŁĄCZONY — trasy i cron istnieją', () => {
  /*
   * Trzy z pięciu usterek znalezionych 30.08.2026 na produkcji to był kod
   * z zielonymi testami, którego nikt nie wołał. Stąd ten test.
   */
  const panel = fs.readFileSync(new URL('../worker/panel.js', import.meta.url), 'utf8');
  for (const trasa of ['/panel/api/zakupy', '/panel/api/zakupy/sync', '/panel/api/zakupy/status', '/panel/api/zakupy/konfig']) {
    assert.ok(panel.includes(`'${trasa}'`), `brak trasy ${trasa}`);
  }
  assert.match(panel, /<section id="zakupy">/, 'brak sekcji w panelu');
  assert.match(panel, /wczytajZakupy\(\)/, 'widok nigdy się nie wczytuje');

  const szablon = fs.readFileSync(new URL('../worker/worker.template.js', import.meta.url), 'utf8');
  assert.match(szablon, /async scheduled\(/, 'brak obsługi crona');
  assert.match(szablon, /await synchronizuj\(env/, 'cron nie woła synchronizacji');
  // Brak tokenu ma kończyć przebieg po cichu — inaczej cron wpisuje błąd
  // do logów 48 razy dziennie i topi w nim prawdziwe awarie.
  assert.match(szablon, /if \(!konfig\.klucz \|\| !konfig\.token \|\| !konfig\.tablica\) return;/,
    'cron hałasuje w logach, zanim Dawid cokolwiek skonfiguruje');

  const wrangler = fs.readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
  assert.match(wrangler, /crons\s*=/, 'cron nie jest skonfigurowany we wrangler.toml');
});

test('SKRYPT PANELU parsuje się — po tym już raz padł cały panel', () => {
  /*
   * 01.09.2026: pojedyncze ukośniki w wyrażeniach regularnych wewnątrz
   * szablonu JS dały SyntaxError i przez dwa dni nie dało się otworzyć
   * bazy klientów. Bierzemy skrypt DOKŁADNIE tak, jak trafia do
   * przeglądarki, i każemy go sparsować.
   */
  const panel = fs.readFileSync(new URL('../worker/panel.js', import.meta.url), 'utf8');

  /*
   * ⚠ NIE WOLNO czytać tu surowego źródła. `HTML_PANELU` to szablon:
   * to, co widzi przeglądarka, powstaje dopiero po przetworzeniu sekwencji
   * ucieczki. W źródle stoi „backslash backslash /", w przeglądarce
   * „backslash /" — i właśnie ta różnica jest tym, na czym padł panel
   * 01.09.2026. Test czytający źródło sprawdzałby coś innego niż produkcja.
   *
   * Dlatego odtwarzamy literal: podstawiamy stałą pod wstawki i każemy
   * silnikowi wyliczyć napis dokładnie tak, jak zrobi to worker.
   */
  const od = panel.indexOf('const HTML_PANELU = `') + 'const HTML_PANELU = `'.length;
  const doo = panel.indexOf('`;', od);
  assert.ok(od > 20 && doo > od, 'nie znalazłem szablonu panelu');
  const literal = panel.slice(od, doo).replace(/\$\{[^}]*\}/g, '0');
  const html = new Function('return `' + literal + '`')();

  const skrypt = html.slice(html.indexOf('<script>') + '<script>'.length, html.indexOf('</script>'));
  assert.doesNotThrow(() => new Function(skrypt), 'skrypt panelu się nie parsuje');
  assert.ok(skrypt.includes('wczytajZakupy'), 'zakupy nie weszły do skryptu panelu');
  // Znak nowej linii w liście do maila ma dojechać jako sekwencja, nie jako
  // prawdziwy przełam — inaczej rozwaliłby literal napisu.
  assert.ok(skrypt.includes("join('\\n')"), 'ukośnik w liście do maila zgubił podwojenie');
});

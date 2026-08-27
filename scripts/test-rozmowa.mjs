/**
 * WIADOMOŚĆ OD DAWIDA + ROZMOWA POD OFERTĄ.
 *
 *   node --test scripts/test-rozmowa.mjs
 *
 * Zlecenie Dawida z 24.08.2026: „chciałbym móc przekazywać wiadomość
 * klientowi wraz z wysłaniem nowej oferty" oraz „czy jest możliwość
 * prowadzić dyskusję o blatach na naszej stronie z klientem pod jego
 * zleceniem".
 *
 * Pilnujemy trzech rzeczy:
 *   • dopisek Dawida dociera IDENTYCZNIE do maila i na stronę oferty,
 *   • wątek nie jest otwartą furtką dla botów i spamu,
 *   • treść klienta nigdy nie wykona się jako HTML.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sprawdzWiadomosc,
  oczysc,
  skrot,
  odstepSekund,
  MAKS_ZNAKOW,
  MAKS_OD_KLIENTA,
  ODSTEP_S,
} from '../worker/rozmowa.js';
import { mailOferty } from '../worker/mail-oferty.js';
import {
  mailDoDawida,
  mailDoKlienta,
  tematDoDawida,
  zajawkaRozmowy,
} from '../worker/mail-rozmowa.js';

const OFERTA = (wiadomosc) => ({
  opis: 'Technistone · Crystal Absolute White · 20 mm',
  pozycje: [{ nazwa: 'Materiał', detal: '1 płyta', brutto: 4000 }],
  razem: 6000,
  razemPrzed: 6000,
  stawkaVat: 0.08,
  wiadomosc,
});

/* ────────────────────────────────── 1. wiadomość od Dawida przy ofercie */

test('dopisek Dawida trafia do maila z ofertą', () => {
  const html = mailOferty('Anna', OFERTA('Pomiar mam wolny w czwartek.'), 'https://kam24h.pl/oferta#abc');
  assert.match(html, /Od Dawida/);
  assert.match(html, /Pomiar mam wolny w czwartek\./);
});

test('brak dopisku = mail jak dotąd, bez pustej ramki', () => {
  const html = mailOferty('Anna', OFERTA(''), 'https://kam24h.pl/oferta#abc');
  assert.doesNotMatch(html, /Od Dawida/);
  assert.match(html, /Kwota całkowita brutto/);
});

test('same spacje to nie jest wiadomość', () => {
  assert.doesNotMatch(mailOferty('', OFERTA('   \n  '), 'https://x/#a'), /Od Dawida/);
});

test('dopisek Dawida nie wykona się w mailu jako HTML', () => {
  const html = mailOferty('', OFERTA('<script>alert(1)</script> & "cudzysłów"'), 'https://x/#a');
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&amp;/);
});

test('dopisek zachowuje akapity (pre-wrap, nie zlepiony tekst)', () => {
  const html = mailOferty('', OFERTA('Pierwszy akapit.\n\nDrugi akapit.'), 'https://x/#a');
  assert.match(html, /white-space:pre-wrap/);
  assert.match(html, /Pierwszy akapit\.\n\nDrugi akapit\./);
});

/* ──────────────────────────────────────── 2. co wolno wysłać klientowi */

test('zwykłe pytanie przechodzi', () => {
  const w = sprawdzWiadomosc('Czy ten dekor wchodzi w 30 mm?');
  assert.equal(w.ok, true);
  assert.equal(w.tresc, 'Czy ten dekor wchodzi w 30 mm?');
});

test('pusta wiadomość odpada z ludzkim komunikatem', () => {
  const w = sprawdzWiadomosc('   ');
  assert.equal(w.ok, false);
  assert.match(w.powod, /treść wiadomości/i);
});

test('za długa wiadomość odpada i podaje telefon', () => {
  const w = sprawdzWiadomosc('a'.repeat(MAKS_ZNAKOW + 1));
  assert.equal(w.ok, false);
  assert.match(w.powod, /za długa/i);
  assert.match(w.powod, /796 991 128/);
});

test('dokładnie na limicie jeszcze wchodzi', () => {
  assert.equal(sprawdzWiadomosc('a'.repeat(MAKS_ZNAKOW)).ok, true);
});

test('bot wypełniający pole-pułapkę jest odrzucany po cichu', () => {
  const w = sprawdzWiadomosc('kup tanie zegarki', { pulapka: 'https://spam.example' });
  assert.equal(w.ok, false);
  assert.equal(w.spam, true);
  // Powód nie może zdradzać, co go zdradziło — bot nie ma czego optymalizować.
  assert.doesNotMatch(w.powod, /pułapk|bot|spam/i);
});

test('odstęp między wiadomościami blokuje seryjne klikanie', () => {
  const teraz = Date.parse('2026-08-24T12:00:00Z');
  const w = sprawdzWiadomosc('jeszcze jedno', {
    ostatnia: new Date(teraz - 3000).toISOString(),
    teraz,
  });
  assert.equal(w.ok, false);
  assert.match(w.powod, /odczekać/i);
});

test('po odczekaniu można napisać ponownie', () => {
  const teraz = Date.parse('2026-08-24T12:00:00Z');
  const w = sprawdzWiadomosc('jeszcze jedno', {
    ostatnia: new Date(teraz - (ODSTEP_S + 1) * 1000).toISOString(),
    teraz,
  });
  assert.equal(w.ok, true);
});

test('sufit na wątek chroni przed zalaniem karty', () => {
  const w = sprawdzWiadomosc('halo', { odKlienta: MAKS_OD_KLIENTA });
  assert.equal(w.ok, false);
  assert.match(w.powod, /796 991 128/);
});

test('limit liczy tylko wiadomości klienta — patrz kontekstRozmowy', () => {
  // Zabezpieczenie na przyszłość: gdyby ktoś zaczął liczyć cały wątek,
  // rozmowa umarłaby po 30 zdaniach Dawida.
  assert.equal(sprawdzWiadomosc('halo', { odKlienta: MAKS_OD_KLIENTA - 1 }).ok, true);
});

test('pierwsza wiadomość w wątku nie ma z czym porównać odstępu', () => {
  assert.equal(odstepSekund(null), null);
  assert.equal(odstepSekund('to nie jest data'), null);
  assert.equal(sprawdzWiadomosc('pierwsze pytanie', { ostatnia: null }).ok, true);
});

/* ─────────────────────────────────────────────── 3. porządkowanie treści */

test('oczysc normalizuje entery, nie kaleczy treści', () => {
  assert.equal(oczysc('  Dzień dobry \r\n\r\n\r\n Ile to potrwa?  '), 'Dzień dobry\n\nIle to potrwa?');
});

test('oczysc zostawia polskie znaki i interpunkcję', () => {
  assert.equal(oczysc('Zażółć gęślą jaźń — 30 mm?'), 'Zażółć gęślą jaźń — 30 mm?');
});

test('skrot nie tnie w połowie słowa', () => {
  const pelne = 'Dzień dobry, chciałbym zapytać o termin montażu blatu kuchennego';
  const s = skrot(pelne, 30);
  assert.match(s, /…$/);
  const bezKropek = s.slice(0, -1);
  // Skrót musi być początkiem oryginału — i kończyć się na granicy słowa,
  // czyli w pełnym tekście zaraz po nim stoi spacja.
  assert.ok(pelne.startsWith(bezKropek), s);
  assert.equal(pelne[bezKropek.length], ' ', `ucięte w połowie słowa: ${s}`);
});

test('krótka treść wraca bez wielokropka', () => {
  assert.equal(skrot('Ile to potrwa?', 80), 'Ile to potrwa?');
});

/* ──────────────────────────────────────────── 4. maile z rozmowy */

test('mail do Dawida niesie treść, telefon i link do panelu', () => {
  const html = mailDoDawida({
    imie: 'Anna',
    telefon: '600100200',
    email: 'anna@example.com',
    opis: 'Technistone · 20 mm',
    tresc: 'Czy da się zrobić do piątku?',
    linkPanelu: 'https://k24h.example/panel',
  });
  assert.match(html, /Anna/);
  assert.match(html, /Czy da się zrobić do piątku\?/);
  assert.match(html, /600100200/);
  assert.match(html, /k24h\.example\/panel/);
});

test('treść klienta nie wykona się w mailu do Dawida', () => {
  const html = mailDoDawida({ imie: '<b>x</b>', tresc: '<img src=x onerror=alert(1)>' });
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img/);
});

test('mail do klienta prowadzi pod wycenę, nie w próżnię', () => {
  const html = mailDoKlienta({
    imie: 'Anna',
    tresc: 'Tak, zdążymy do piątku.',
    link: 'https://kam24h.pl/oferta#abc123',
  });
  assert.match(html, /Tak, zdążymy do piątku\./);
  assert.match(html, /oferta#abc123/);
  assert.match(html, /796 991 128/);
});

test('temat maila mówi, kto pisze i w jakiej sprawie', () => {
  assert.match(tematDoDawida('Anna', 'Technistone · 20 mm'), /Anna/);
  assert.match(tematDoDawida('Anna', 'Technistone · 20 mm'), /Technistone/);
  // Bez imienia temat nadal ma sens.
  assert.match(tematDoDawida('', ''), /Klient/);
});

test('zajawka rozmowy odmienia się po polsku', () => {
  assert.equal(zajawkaRozmowy(0), '');
  assert.match(zajawkaRozmowy(1), /1 wiadomość/);
  assert.match(zajawkaRozmowy(3), /3 wiadomości/);
});

/* ────────────────────────────── 5. tajemnica handlowa i higiena treści */

test('maile z rozmowy nie niosą cen zakupowych ani słowa „rabat"', () => {
  const html =
    mailDoDawida({ imie: 'A', tresc: 'pytanie', opis: 'x' }) +
    mailDoKlienta({ imie: 'A', tresc: 'odpowiedź', link: 'https://x/#a' });
  for (const slowo of ['rabat', 'marża', 'narzut', 'zakupow']) {
    assert.doesNotMatch(html.toLowerCase(), new RegExp(slowo), `wyciek: ${slowo}`);
  }
});

/* ═══ CZĘŚĆ TEKSTOWA MAILA (zgłoszenie Dawida, 27.08.2026) ════════════
 *
 * „Czy jak odsyłam email to klientom może to wpadać do spamu."
 *
 * Wiadomość wyłącznie w HTML to jeden z sygnałów masowej wysyłki —
 * zwykła poczta idzie jako multipart. Maile do klientów nie miały części
 * tekstowej wcale; teraz dokłada ją `resend()` dla każdego maila naraz.
 */
test('z HTML-a powstaje czytelny tekst', async () => {
  const { tekstZHtml } = await import('../worker/poczta.js');
  const html =
    '<div><style>p{color:red}</style><h1>Oferta na blat</h1>' +
    '<p>Dzie&#324; dobry,<br>przygotowa&#322;em wycen&#281;.</p></div>';
  const t = tekstZHtml(html);
  assert.equal(t, 'Oferta na blat\nDzień dobry,\nprzygotowałem wycenę.');
  assert.ok(!/color:red/.test(t), 'style nie może przeciekać do tekstu');
  assert.ok(!/</.test(t), 'w tekście nie zostaje żaden znacznik');
});

test('link zachowuje adres — inaczej klient nie wejdzie w ofertę', async () => {
  const { tekstZHtml } = await import('../worker/poczta.js');
  const t = tekstZHtml('<p><a href="https://kam24h.pl/oferta#abc">Zobacz ofertę</a></p>');
  assert.equal(t, 'Zobacz ofertę (https://kam24h.pl/oferta#abc)');
});

test('encje z esc() rozwijają się z powrotem', async () => {
  const { tekstZHtml } = await import('../worker/poczta.js');
  // Tak wygląda wiadomość klienta po przejściu przez esc().
  assert.equal(tekstZHtml('<p>Blat 3&quot; &amp; wyspa &lt;2 m&gt;</p>'), 'Blat 3" & wyspa <2 m>');
});

test('nadawca bez MAIL_FROM to awaryjna domena Resend — nie do produkcji', async () => {
  /*
   * Ten test nie „przechodzi bo tak ma być" — pilnuje, żeby fallback
   * pozostał rozpoznawalny. Na produkcji MAIL_FROM musi być ustawiony,
   * bo z onboarding@resend.dev wolno wysyłać tylko na własny adres.
   */
  const { nadawca } = await import('../worker/poczta.js');
  assert.match(nadawca({}), /resend\.dev/);
  assert.equal(nadawca({ MAIL_FROM: 'K24H <oferty@kam24h.pl>' }), 'K24H <oferty@kam24h.pl>');
});

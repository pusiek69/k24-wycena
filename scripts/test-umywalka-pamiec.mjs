/**
 * PAMIĘĆ KLIENTA I WYMIAROWANIE BRYŁY.
 *
 *   node --test scripts/test-umywalka-pamiec.mjs
 *
 * Dwa zgłoszenia Dawida z 23.11.2026:
 *
 *   „nie widac wogule umywalki bo wymiary na niej sa" — opisy wymiarów
 *   leżały na modelu. Mają stać POZA bryłą, przy liniach odniesienia.
 *
 *   „jesli klient juz raz wpisze swoje dane to nuz system go pamieta
 *   i nie musi ponownie wypełnić formularze zeby znac ceny" — bramka
 *   zbiera kontakt RAZ, nie przy każdym ruchu suwaka.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const czytaj = (s) => fs.readFileSync(path.join(ROOT, s), 'utf8');

const PAMIEC = czytaj('src/umywalka/pamiec-klienta.js');
const MAIN = czytaj('src/umywalka/main.js');
const FORMULARZ = czytaj('src/umywalka/formularz.js');
const SCENA = czytaj('src/umywalka/scena3d.js');
const CSS = czytaj('src/umywalka/umywalka.css');

/* ═══════════════════════════════════════════ pamięć klienta */

/** Atrapa `localStorage` — raz działająca, raz rzucająca jak tryb prywatny. */
function podstawSchowek({ psuje = false } = {}) {
  const dane = new Map();
  globalThis.localStorage = {
    getItem: (k) => {
      if (psuje) throw new Error('tryb prywatny');
      return dane.has(k) ? dane.get(k) : null;
    },
    setItem: (k, v) => {
      if (psuje) throw new Error('tryb prywatny');
      dane.set(k, String(v));
    },
    removeItem: (k) => {
      if (psuje) throw new Error('tryb prywatny');
      dane.delete(k);
    },
  };
  return dane;
}

const modul = async () => import(`../src/umywalka/pamiec-klienta.js?v=${Math.random()}`);

test('po wysłaniu zgłoszenia klient jest zapamiętany', async () => {
  podstawSchowek();
  const { zapamietajKlienta, zapamietanyKlient, znanyKlient } = await modul();

  assert.equal(znanyKlient(), false);
  assert.equal(
    zapamietajKlienta({ name: 'Anna', phone: '600100200', email: 'a@example.com', city: 'Tarnobrzeg' }),
    true
  );
  const k = zapamietanyKlient();
  assert.equal(k.name, 'Anna');
  assert.equal(k.city, 'Tarnobrzeg');
  assert.equal(znanyKlient(), true);
});

test('zapisujemy TYLKO to, co klient sam wpisał w formularzu', async () => {
  const dane = podstawSchowek();
  const { zapamietajKlienta } = await modul();
  zapamietajKlienta({
    name: 'Anna',
    phone: '600100200',
    email: 'a@example.com',
    city: 'Tarnobrzeg',
    termin: 'miesiac',
    telefonZgoda: 'tak',
    // Rzeczy, które nie mają prawa wylądować w przeglądarce na 90 dni:
    kwota: 5200,
    szczegoly: { pozycje: [] },
    wizualizacja: 'AAAA',
  });
  const zapis = JSON.parse([...dane.values()][0]);
  assert.deepEqual(Object.keys(zapis.dane).sort(), [
    'city',
    'email',
    'name',
    'phone',
    'telefonZgoda',
    'termin',
  ]);
});

test('wpis starszy niż 90 dni przestaje obowiązywać i znika', async () => {
  const dane = podstawSchowek();
  const { zapamietanyKlient } = await modul();
  const stary = Date.now() - 91 * 24 * 60 * 60 * 1000;
  dane.set('k24h-umywalka-klient', JSON.stringify({ kiedy: stary, dane: { phone: '600100200' } }));

  assert.equal(zapamietanyKlient(), null);
  assert.equal(dane.size, 0, 'przeterminowany wpis powinien zostać skasowany');
});

test('tryb prywatny nie wywraca kalkulatora', async () => {
  podstawSchowek({ psuje: true });
  const { zapamietajKlienta, zapamietanyKlient, zapomnijKlienta, znanyKlient } = await modul();

  // Wszystko ma po prostu zwrócić „nie pamiętam", a nie rzucić wyjątkiem.
  assert.equal(zapamietajKlienta({ phone: '600100200' }), false);
  assert.equal(zapamietanyKlient(), null);
  assert.equal(znanyKlient(), false);
  assert.doesNotThrow(() => zapomnijKlienta());
});

test('zapis bez kontaktu jest odrzucany', async () => {
  podstawSchowek();
  const { zapamietajKlienta } = await modul();
  assert.equal(zapamietajKlienta({ name: 'Anna' }), false);
  assert.equal(zapamietajKlienta({}), false);
});

test('uszkodzony wpis nie psuje strony', async () => {
  const dane = podstawSchowek();
  const { zapamietanyKlient } = await modul();
  dane.set('k24h-umywalka-klient', '{to nie jest JSON');
  assert.equal(zapamietanyKlient(), null);
});

/* ═══════════════════════════════════════════ ceny dla znajomego klienta */

test('o widoczności kwot decyduje JEDNO miejsce w kodzie', () => {
  // Przy dwóch kopiach warunku karta ceny i rozbicie pokazywały co innego.
  assert.match(MAIN, /const cenaUkryta = \(\) => CENA_PO_FORMULARZU && !wyslane && !znanyKlient\(\)/);
  // Używana i przy karcie ceny, i przy rozbiciu — to te dwa miejsca
  // rozjechały się przy pierwszym podejściu.
  assert.ok((MAIN.match(/cenaUkryta\(\)/g) || []).length >= 2, 'warunek używany w mniej niż dwóch miejscach');
});

test('znany klient dostaje powitanie i wyjście z pamięci', () => {
  assert.match(MAIN, /Witamy ponownie/);
  assert.match(MAIN, /id="toNieJa"/);
  assert.match(MAIN, /zapomnijKlienta\(\)/);
});

test('formularz wstępnie wypełnia się zapamiętanymi danymi', () => {
  assert.match(FORMULARZ, /const znany = zapamietanyKlient\(\) \|\| \{\}/);
  for (const pole of ['znany.name', 'znany.phone', 'znany.email', 'znany.city', 'znany.termin']) {
    assert.ok(FORMULARZ.includes(pole), `pole ${pole} nie jest wypełniane`);
  }
  // ...i da się je poprawić: to zwykłe pola, nie podgląd.
  assert.ok(!FORMULARZ.includes('readonly'), 'pola mają być edytowalne');
});

test('zapamiętanie dzieje się dopiero po UDANYM wysłaniu', () => {
  const poWyslaniu = FORMULARZ.indexOf('await wyslijLead(zgloszenie);');
  const zapis = FORMULARZ.indexOf('zapamietajKlienta(dane);');
  assert.ok(poWyslaniu > 0 && zapis > poWyslaniu, 'zapis musi być po wysłaniu, nie przed');
});

test('dane klienta nie jadą nigdzie poza zwykłym zgłoszeniem', () => {
  for (const zakazane of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'zdarzenie(']) {
    assert.ok(!PAMIEC.includes(zakazane), `pamięć klienta sięga po ${zakazane}`);
  }
});

/* ═══════════════════════════════════════════ wymiary poza bryłą */

test('opisy zlewów stoją na linii odniesienia, nie na modelu', () => {
  // Punkt opisu jest PRZED frontem bryły (zf + odsunięcie), na wysokości 0.
  assert.match(SCENA, /const zOpisu = zf \+ o \* 2\.1;/);
  assert.match(SCENA, /for \(const c of zlewy\) ln\(\[c, 0, zf \+ 3\], \[c, 0, zOpisu\]\)/);
  assert.match(SCENA, /add\(`\$\{S\.n > 1 \? '' : 'zlew '\}\$\{fd\(sL\)\} × \$\{fd\(sW\)\}`, \[c, 0, zOpisu\]/);
});

test('odsunięcie wymiarów rośnie razem z bryłą', () => {
  // Stałe 11 cm przy umywalce 271 cm to był margines niewidoczny gołym okiem.
  assert.match(SCENA, /const o = Math\.max\(12, Math\.min\(34, Math\.max\(L, W\) \* 0\.085\)\)/);
});

test('na wąskim ekranie opisy zlewów znikają', () => {
  assert.match(SCENA, /const ciasno = scena\.clientWidth < 520;/);
  assert.match(SCENA, /const zlewy = S\.mode === 'int' && !ciasno \? srodkiZlewow\(S\) : \[\];/);
});

test('wymiary da się wyłączyć jednym przyciskiem', () => {
  assert.match(SCENA, /function pokazWymiary\(on\)/);
  assert.match(SCENA, /dimG\.visible = e < 0\.02 && wymiaryWlaczone/);
  assert.match(MAIN, /b\.id === 'wym'/);
  assert.match(CSS, /\.lab\.bez-wymiarow \.lb\.d \{ opacity: 0 !important; \}/);
  assert.ok(czytaj('umywalka-na-wymiar.html').includes('id="wym"'));
});

test('plakietki są mniejsze na telefonie', () => {
  assert.match(CSS, /@media \(max-width: 600px\)[\s\S]*?\.lb \{ font-size: 11px/);
});

/**
 * ZGODA NA TELEFON (zlecenie Dawida, 01.09.2026).
 *
 *   node --test scripts/test-kontakt-telefon.mjs
 *
 * Dawid, jego słowami: „nie będę od razu dzwonił do każdego, kto skorzysta
 * z kalkulatora, tylko chcę dzwonić do osób faktycznie tych, co chcą
 * rozmawiać. Bo miałem tak, że Pani odebrała telefon i nie bardzo była
 * zadowolona, że dzwonię."
 *
 * Czego pilnujemy:
 *   • BRAK ODPOWIEDZI TO NIE ZGODA — to jedyna rzecz, której złe ustawienie
 *     odtwarza dokładnie ten telefon, przed którym się bronimy,
 *   • wybór dociera do maila leadowego I do panelu,
 *   • druga wycena bez odpowiedzi nie kasuje wcześniejszego „nie dzwonić",
 *   • po wysłaniu klient widzi, czego się spodziewać.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const zrodlo = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const kt = await import('../src/app/kontakt-telefon.js');

/* ───────────────────────────────────────────────────── sama reguła */

test('BRAK ODPOWIEDZI NIE JEST ZGODĄ NA TELEFON', () => {
  /*
   * ⚠ Najważniejszy test w tym pliku. Gdyby puste pole znaczyło „można
   * dzwonić", wszystkie zgłoszenia sprzed 01.09.2026 — i każde, które
   * przyjdzie starą zakładką — wyglądałyby jak zgoda. Wracalibyśmy
   * dokładnie do sytuacji, w której Dawid dzwoni do kogoś, kto o to
   * nie prosił.
   */
  assert.equal(kt.dzwonic(''), false, 'brak odpowiedzi potraktowany jak zgoda');
  assert.equal(kt.dzwonic(undefined), false);
  assert.equal(kt.dzwonic(null), false);
  assert.equal(kt.dzwonic('wymyślone'), false);
  assert.equal(kt.dzwonic('tak'), true);
  assert.equal(kt.dzwonic('nie'), false);
});

test('„nie wiadomo" to co innego niż „nie chce"', () => {
  // Panel maluje te dwa stany osobno: do „nie wiadomo" wolno zadzwonić
  // po namyśle, do „nie dzwonić" nie wolno wcale.
  assert.equal(kt.odmowiono(''), false, 'brak odpowiedzi udaje odmowę');
  assert.equal(kt.odmowiono('nie'), true);
  assert.equal(kt.odmowiono('tak'), false);
});

test('do bazy wchodzą tylko znane wartości', () => {
  assert.equal(kt.znanyKanal('tak'), true);
  assert.equal(kt.znanyKanal('nie'), true);
  assert.equal(kt.znanyKanal(''), true, 'puste musi przejść — stare zgłoszenia');
  assert.equal(kt.znanyKanal('moze'), false);
  assert.equal(kt.znanyKanal('<script>'), false);
});

test('etykiety są w jednym miejscu dla maila i panelu', () => {
  assert.equal(kt.etykietaKanalu('tak'), 'Tak, proszę o telefon');
  assert.equal(kt.etykietaKanalu('nie'), 'Wolę mailem lub SMS-em');
  assert.equal(kt.etykietaKanalu(''), '', 'brak wyboru nie ma etykiety');
  assert.equal(kt.krotkiKanal('nie'), 'bez telefonu');
});

test('potwierdzenie mówi klientowi wprost, czego się spodziewać', () => {
  const tak = kt.potwierdzenie('tak', '600 100 200');
  assert.match(tak, /Zadzwonimy pod 600 100 200/);
  assert.match(tak, /8–18/, 'brak godzin — klient nie wie, kiedy czekać');

  const nie = kt.potwierdzenie('nie');
  assert.match(nie, /Nie będziemy dzwonić/);
  // ...ale numer i tak podajemy: to klient decyduje, nie my za niego.
  assert.match(nie, /796 991 128/);

  assert.equal(kt.potwierdzenie(''), '', 'bez wyboru nie obiecujemy niczego');
});

/* ─────────────────────────────────────────────────── formularz */

test('FORMULARZ pyta i nie przepuszcza bez odpowiedzi', () => {
  const br = zrodlo('src/app/bramka.js');
  assert.match(br, /class: 'tel-wybor'/, 'brak wyróżnionego pytania');
  assert.match(br, /Czy mamy zadzwonić\? \*/, 'pytanie nie jest oznaczone jako wymagane');
  assert.match(br, /name: 'telefonZgoda', value: k\.id/, 'opcje nie mają wspólnej nazwy pola');
  assert.match(
    br,
    /if \(!d\.telefonZgoda\)[\s\S]{0,200}pole: 'telefonZgoda'/,
    'formularz przepuszcza zgłoszenie bez odpowiedzi'
  );
  assert.match(br, /telefonZgoda: form\.querySelector/, 'wybór nie trafia do wysyłki');
});

test('ŻADNA opcja nie jest zaznaczona z góry', () => {
  /*
   * Gdyby „tak" było domyślne, Dawid dzwoniłby do ludzi, którzy o telefon
   * nie prosili — tylko nie ruszyli pola. To ten sam błąd, przed którym
   * chroni `dzwonic('')`, tylko po stronie interfejsu.
   */
  const br = zrodlo('src/app/bramka.js');
  const blok = br.slice(br.indexOf("class: 'tel-wybor'"), br.indexOf("class: 'switch zgoda'"));
  assert.doesNotMatch(blok, /checked/, 'któraś odpowiedź jest zaznaczona domyślnie');
});

test('po wysłaniu NIE obiecujemy telefonu każdemu', () => {
  /*
   * ⚠ Do 01.09.2026 ekran po wysłaniu mówił „Oddzwonimy w godzinach 8–18"
   * KAŻDEMU, niezależnie od tego, czy ktoś o telefon prosił. Dokładnie ta
   * obietnica kończyła się rozmową, której klient sobie nie życzył.
   */
  const br = zrodlo('src/app/bramka.js');
  const i = br.indexOf('function odsloniecie');
  const blok = br.slice(i, br.indexOf('function wybor', i));
  assert.doesNotMatch(blok, /Oddzwonimy w godzinach 8–18\.'/,
    'ekran po wysłaniu wciąż obiecuje telefon każdemu');
  assert.match(blok, /potwierdzenie\(dane\.telefonZgoda, dane\.phone\)/,
    'potwierdzenie nie zależy od wyboru klienta');
  assert.match(blok, /tel-potwierdzenie/, 'potwierdzenie nie jest wyróżnione');
});

/* ─────────────────────────────────────────────────── worker i baza */

test('MAIL LEADOWY niesie decyzję — w temacie i w treści', () => {
  const w = zrodlo('worker/worker.template.js');
  // Temat: zakaz z przodu, bo łatwiej przeoczyć zgodę niż zakaz.
  assert.match(w, /odmowiono\(klient\.telefonZgoda\) \? 'NIE DZWONIĆ — ' : ''/,
    'temat maila nie ostrzega przed telefonem');
  // HTML: plakietka pod nazwiskiem.
  assert.match(w, /NIE DZWONIĆ — KLIENT PROSI O KONTAKT MAILEM/, 'brak plakietki w mailu');
  assert.match(w, /PROSI O TELEFON/, 'brak oznaczenia zgody w mailu');
  // Wersja tekstowa — tę Dawid czyta w powiadomieniu na telefonie.
  assert.match(w, /\*\*\* NIE DZWONIĆ — KLIENT PROSI O KONTAKT MAILEM \*\*\*/,
    'wersja tekstowa maila nie ostrzega');
  assert.match(w, /etykietaKanalu\(klient\.telefonZgoda\)/, 'brak wiersza „Kontakt" w tabeli');
});

test('BAZA zapisuje tylko znane wartości i nie kasuje wcześniejszej odmowy', () => {
  const b = zrodlo('worker/baza.js');
  assert.match(b, /znanyKanal\(lead\.telefonZgoda\)/, 'do bazy wchodzi cokolwiek');
  /*
   * ⚠ COALESCE + NULLIF: druga wycena BEZ odpowiedzi nie ma prawa skasować
   * „nie dzwonić" z pierwszej. Bez tego klient, który raz poprosił o mail,
   * po drugiej wycenie znów wyglądałby jak „nie pytaliśmy".
   */
  assert.match(
    b,
    /telefon_zgoda = COALESCE\(NULLIF\(\?, ''\), telefon_zgoda\)/,
    'druga wycena kasuje wcześniejsze „nie dzwonić"'
  );
  assert.match(b, /telefonZgoda: k\.telefon_zgoda \|\| ''/, 'karta nie niesie pola do panelu');
});

test('SCHEMAT ma kolumnę z bezpieczną wartością domyślną', () => {
  const sql = zrodlo('worker/schema.sql');
  assert.match(
    sql,
    /ALTER TABLE klienci ADD COLUMN telefon_zgoda TEXT NOT NULL DEFAULT ''/,
    'brak kolumny albo zła wartość domyślna'
  );
});

/* ─────────────────────────────────────────────────── panel */

test('PANEL oznacza karty i wygasza przycisk telefonu', () => {
  const p = zrodlo('worker/panel.js');
  assert.match(p, /NIE DZWONIC - woli mail/, 'brak plakietki na karcie');
  assert.match(p, /PROSI O TELEFON/, 'brak oznaczenia zgody');
  assert.match(p, /dzwon-stop/, 'przycisk telefonu nie jest wyróżniony przy odmowie');
  // Puste pole nie dostaje żadnej plakietki — „nie pytaliśmy" to nie „nie chce".
  assert.match(p, /k\.telefonZgoda === 'nie'/, 'panel nie sprawdza wprost odmowy');
  assert.match(p, /k\.telefonZgoda === 'tak'/, 'panel nie sprawdza wprost zgody');
});

test('id w panelu zgadzają się z modułem', () => {
  /*
   * Panel jest osobnym skryptem w przeglądarce i nie może zaimportować
   * modułu — wartości są tam przepisane. Ten test pilnuje, żeby oba
   * zestawy pozostały identyczne (tak samo robimy przy terminach).
   */
  const p = zrodlo('worker/panel.js');
  for (const k of kt.KANALY) {
    assert.match(p, new RegExp(`telefonZgoda === '${k.id}'`), `panel nie zna wartości ${k.id}`);
  }
});

test('ŚCIEŻKA AWARYJNA (Netlify) też niesie wybór', () => {
  /*
   * Gdy worker milczy, zgłoszenie idzie formularzem Netlify. Bez tego pola
   * taki lead trafiałby do Dawida bez informacji, czy wolno zadzwonić —
   * czyli dokładnie w stan sprzed tej zmiany, i to akurat w sytuacji,
   * w której nikt tego nie sprawdza.
   */
  assert.match(zrodlo('src/api.js'), /telefonZgoda: dane\.telefonZgoda \|\| ''/,
    'ścieżka awaryjna gubi wybór klienta');
  assert.match(zrodlo('index.html'), /name="telefonZgoda"/,
    'ukryty formularz Netlify nie zna pola — Netlify odrzuci wartość');
});

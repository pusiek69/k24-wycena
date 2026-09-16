/**
 * CENNIK USŁUG I DODATKÓW WG ZRZUTU DAWIDA (16.09.2026).
 *
 *   node --test scripts/test-cennik-uslug.mjs
 *
 * Dawid przysłał zdjęcie swojego cennika: kolumny netto / jednostka / brutto
 * przy VAT 8%. Ten plik jest przepisaniem tamtej tabeli i sprawdza JEDNĄ
 * rzecz, na której wszystko stoi: czy kwota, którą zobaczy klient w wycenie
 * z montażem, zgadza się co do złotówki z kolumną „brutto" z cennika.
 *
 * Dlaczego to nie jest oczywiste: w kodzie stawki zapisujemy BRUTTO PRZY 23%
 * (silnik dzieli przez 1,23 i mnoży przez stawkę wyceny), a cennik jest
 * podany netto. Pomyłka o ten jeden przelicznik to 12% ceny w każdej pozycji.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { wycen } from '../src/engine/wycena.js';
import { OPCJE, ROBOCIZNA, PLYTA_STANDARD, VAT_MONTAZ, zCennika } from '../src/firms/_domyslne.js';

/** Tabela ze zrzutu: [nazwa w cenniku, netto, brutto 8%, gdzie w konfiguracji]. */
const CENNIK = [
  ['Otwór pod płytę grzewczą nakładaną', 250, 270, () => wariant('plyta', 'nakladana')],
  ['Otwór pod płytę grzewczą licowaną', 700, 756, () => wariant('plyta', 'licowana')],
  ['Otwór pod zlew podwieszany', 450, 486, () => wariant('zlew', 'podblat')],
  ['Kanaliki / rowki ociekowe', 500, 540, () => opcja('kanaliki').cena],
  ['Ociekacz spadkowy (pochylnia)', 1000, 1080, () => opcja('ociekaczSpad').cena],
  ['Ociekacz z rowkami', 1500, 1620, () => opcja('ociekaczRowki').cena],
  ['Wycięcie pod otwór fi do 69 mm', 150, 162, () => opcja('otwory').cena],
  ['Zbrojenie otworów', 200, 216, () => opcja('zbrojenie').cena],
  ['Impregnacja', 200, 216, () => opcja('impregnacja').cena],
  ['Wykonanie projektu CAD', 250, 270, () => opcja('projektCad').cena],
  ['Podświetlenie blatów (m²)', 1050, 1134, () => opcja('podswietlenie').cena],
  ['Frezowanie płyty (m²)', 100, 108, () => opcja('frezowanie').cena],
  ['Poler spodu (m²)', 300, 324, () => opcja('polerSpodu').cena],
  ['Nacięcia pod ledy (m.b.)', 100, 108, () => opcja('nacieciaLed').cena],
  ['Pomiar PROLINER', 1000, 1080, () => ROBOCIZNA.find((r) => r.id === 'pomiar').cena],
  ['Montaż (dzień ekipy)', 3000, 3240, () => opcja('montazDzien').cena],
  ['Dodatkowa osoba (dzień)', 1000, 1080, () => opcja('dodatkowaOsoba').cena],
];

const opcja = (id) => OPCJE.find((o) => o.id === id);
const wariant = (id, wid) => opcja(id).warianty.find((w) => w.id === wid).cena;
/** Jak silnik: stawka brutto@23 → brutto przy stawce wyceny. */
const naBrutto = (stawka, vat = VAT_MONTAZ) => (stawka / 1.23) * (1 + vat);

/* ═════════════════════ każda pozycja z cennika ═══════════════════════ */

for (const [nazwa, netto, brutto, skad] of CENNIK) {
  test(`${nazwa}: ${netto} zł netto → ${brutto} zł brutto`, () => {
    const stawka = skad();
    assert.ok(stawka > 0, `brak stawki w konfiguracji dla „${nazwa}"`);
    assert.equal(Math.round(naBrutto(stawka)), brutto, `stawka ${stawka} daje inną kwotę brutto`);
  });
}

test('transport liczy się co do grosza, bo mnoży się przez kilometry', () => {
  /*
   * 4 zł netto → 4,32 brutto. Przy zaokrągleniu stawki do pełnych złotych
   * wychodziłoby 4,39 zł/km — na 200 km to 14 zł różnicy w jedną stronę.
   */
  assert.ok(Math.abs(naBrutto(opcja('transportKm').cena) - 4.32) < 0.005);
});

test('przelicznik z cennika jest jeden dla wszystkich pozycji', () => {
  assert.equal(zCennika(1000), 1230);
  assert.equal(zCennika(250), 307.5, 'grosze mają zostać — patrz transport');
});

/* ═══════════════════ dodatki nie psują istniejących wycen ════════════ */

const FIRMA = {
  slug: 'test',
  nazwa: 'Test',
  cenyUslug: 'brutto',
  vatMontaz: VAT_MONTAZ,
  plyta: PLYTA_STANDARD,
  dekory: { Testowy: { 20: 1000 } },
  robocizna: ROBOCIZNA,
  opcje: OPCJE,
};
const licz = (opcje) =>
  wycen(FIRMA, { dekor: 'Testowy', grubosc: '20', odcinki: [{ gl: 60, dl: 300 }], opcje });

test('nowe dodatki są domyślnie zerowe — wycena nie rośnie sama', () => {
  const bez = licz({ pomieszczenie: 'kuchnia', zlew: 'podblat', plyta: 'nakladana', otwory: 1 });
  const nazwy = bez.pozycje.map((p) => p.nazwa);
  for (const id of ['kanaliki', 'ociekaczSpad', 'impregnacja', 'montazDzien', 'transportKm']) {
    assert.ok(!nazwy.includes(opcja(id).label), `„${opcja(id).label}" wszedł do wyceny bez pytania`);
  }
});

test('wpisany dodatek wchodzi do wyceny w cenie z cennika', () => {
  const bez = licz({ pomieszczenie: 'kuchnia', zlew: 'podblat', plyta: 'nakladana', otwory: 1 });
  const z = licz({
    pomieszczenie: 'kuchnia',
    zlew: 'podblat',
    plyta: 'nakladana',
    otwory: 1,
    ociekaczSpad: 2,
    transportKm: 100,
  });

  const ociekacz = z.pozycje.find((p) => p.nazwa === opcja('ociekaczSpad').label);
  assert.ok(ociekacz, 'ociekacz nie wszedł do pozycji');
  assert.equal(Math.round(ociekacz.brutto), 2160, 'dwa ociekacze to 2 × 1 080 zł');

  const transport = z.pozycje.find((p) => p.nazwa === opcja('transportKm').label);
  assert.equal(Math.round(transport.brutto), 432, '100 km × 4,32 zł');

  assert.equal(Math.round(z.razem - bez.razem), 2592, 'suma nie urosła dokładnie o dodatki');
});

test('dodatki z cennika są WYŁĄCZNIE dla właściciela', () => {
  /*
   * Kalkulator klienta ma zostać prosty: materiał, wymiary, kilka opcji.
   * Dziesięć dodatkowych „ptaszków" zamieniłoby go w cennik warsztatu.
   */
  const nowe = ['zbrojenie', 'kanaliki', 'ociekaczSpad', 'ociekaczRowki', 'impregnacja',
    'projektCad', 'podswietlenie', 'frezowanie', 'polerSpodu', 'nacieciaLed',
    'transportKm', 'montazDzien', 'dodatkowaOsoba'];
  for (const id of nowe) {
    const o = opcja(id);
    assert.ok(o, `brak pozycji ${id}`);
    assert.equal(o.tylkoWlasciciel, true, `${id} pokazałby się klientowi`);
    assert.equal(o.domyslnie ?? 0, 0, `${id} ma niezerową wartość domyślną`);
  }

  const kroki = fs.readFileSync(new URL('../src/app/kroki.js', import.meta.url), 'utf8');
  assert.match(kroki, /\.filter\(\(o\) => !o\.tylkoWlasciciel\)/, 'kalkulator klienta nie filtruje dodatków');

  const edytor = fs.readFileSync(new URL('../src/app/oferta-dawida.js', import.meta.url), 'utf8');
  assert.match(edytor, /blokDodatkow\(stan, firma, odswiez\)/, 'edytor właściciela nie pokazuje dodatków');
});

test('stawki z panelu obejmują każdą nową pozycję cennika', async () => {
  // Bez wpisu w PARAMETRY cena byłaby zaszyta w kodzie i Dawid nie mógłby
  // jej zmienić bez wdrożenia — czyli dokładnie to, od czego uciekliśmy.
  const { PARAMETRY, DOMYSLNE } = await import('../src/app/ustawienia.js');
  for (const o of OPCJE.filter((x) => x.tylkoWlasciciel)) {
    assert.ok(o.id in DOMYSLNE, `stawka „${o.label}" nie jest edytowalna w panelu`);
    const p = PARAMETRY.find((x) => x.klucz === o.id);
    assert.equal(p.domyslnie, o.cena, `${o.id}: panel i cennik mają inną wartość domyślną`);
  }
});

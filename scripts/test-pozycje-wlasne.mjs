/**
 * WŁASNE POZYCJE W OFERCIE (zlecenie Dawida, 01.09.2026).
 *
 *   node --test scripts/test-pozycje-wlasne.mjs
 *
 * Dawid dopisuje do wyceny demontaż starego blatu, cokoły albo dopłatę
 * ekspresową. Czego pilnujemy:
 *   • kwota = cena × ilość, cena jest BRUTTO i nikt jej nie przelicza,
 *   • pozycja wchodzi do sumy oferty PRZED upustem,
 *   • u klienta ląduje w „Pracach kamieniarskich" (a materiał — w materiale),
 *     ale sama NAZWA do klienta nie trafia,
 *   • przeżywa „Powtórz wycenę",
 *   • niedokończony wiersz nie wpada po cichu do kwoty.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const zrodlo = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const pw = await import('../src/app/pozycje-wlasne.js');
const { rozbicieDlaKlienta } = await import('../src/app/pozycje-klienta.js');

const poz = (n = {}) => ({ nazwa: 'Demontaż starego blatu', cena: 300, ilosc: 1, grupa: 'usługi', ...n });

/* ─────────────────────────────────────────────────────────────── liczenie */

test('kwota to cena razy ilość, zaokrąglona do złotówki', () => {
  assert.equal(pw.kwota(poz()), 300);
  assert.equal(pw.kwota(poz({ cena: 150, ilosc: 3 })), 450);
  // Metry bieżące cokołów — ilość ułamkowa musi działać.
  assert.equal(pw.kwota(poz({ cena: 120, ilosc: 2.5 })), 300);
  assert.equal(pw.kwota(poz({ cena: 99.5, ilosc: 3 })), 299);
});

test('wiersz bez ceny albo bez ilości nie ma kwoty', () => {
  assert.equal(pw.kwota(poz({ cena: 0 })), 0);
  assert.equal(pw.kwota(poz({ ilosc: 0 })), 0);
  assert.equal(pw.kwota(poz({ cena: -100 })), 0, 'ujemna cena to nie upust');
});

test('suma liczy tylko wiersze kompletne', () => {
  const lista = [
    poz({ cena: 300 }),
    poz({ nazwa: '', cena: 500 }), // bez nazwy — nie wiadomo, za co
    poz({ nazwa: 'Cokoły', cena: 0 }), // zaczęty, niedokończony
    poz({ nazwa: 'Dopłata ekspresowa', cena: 200, ilosc: 2 }),
  ];
  assert.equal(pw.razem(lista), 700);
  assert.equal(pw.poprawne(lista).length, 2);
});

test('niedokończony wiersz MÓWI, czego brakuje', () => {
  // Pusty wiersz to nie błąd — Dawid dopiero zaczyna pisać.
  assert.equal(pw.czegoBrakuje({ nazwa: '', cena: 0, ilosc: 1 }), null);
  assert.match(pw.czegoBrakuje({ nazwa: '', cena: 300, ilosc: 1 }), /nazwę/i);
  assert.match(pw.czegoBrakuje({ nazwa: 'Cokoły', cena: 0, ilosc: 1 }), /cenę/i);
  assert.match(pw.czegoBrakuje({ nazwa: 'Cokoły', cena: 100, ilosc: 0 }), /Ilość/i);
  assert.equal(pw.czegoBrakuje(poz()), null);
});

/* ────────────────────────────────────────────── rozbicie na oczach klienta */

test('własna pozycja wchodzi klientowi do PRAC, nie do materiału', () => {
  /*
   * Klient widzi tylko dwie kwoty: materiał i prace kamieniarskie.
   * Dodatek to zwykle robota, więc domyślnie ląduje w pracach.
   */
  const oferta = [
    { nazwa: 'Technistone — Crystal White, 20 mm', detal: '', brutto: 4000 }, // pozycja silnika
    { nazwa: 'Obróbka', detal: '', brutto: 1000 },
    ...pw.doOferty([poz({ cena: 300 })]),
  ];
  const r = rozbicieDlaKlienta(oferta, {});
  assert.equal(r.material, 4000, 'dodatek wpadł do materiału');
  assert.equal(r.prace, 1300, 'dodatek nie doliczył się do prac');
  assert.equal(r.razem, 5300);
});

test('pozycja oznaczona jako MATERIAŁ ląduje po stronie materiału', () => {
  const oferta = [
    { nazwa: 'Technistone — Crystal White, 20 mm', detal: '', brutto: 4000 },
    { nazwa: 'Obróbka', detal: '', brutto: 1000 },
    ...pw.doOferty([{ nazwa: 'Cokoły', cena: 120, ilosc: 3, grupa: 'materiał' }]),
  ];
  const r = rozbicieDlaKlienta(oferta, {});
  assert.equal(r.material, 4360);
  assert.equal(r.prace, 1000);
});

test('do klienta NIE trafia cena jednostkowa dodatku', () => {
  /*
   * ⚠ `detal` pozycji materiałowej dokleja się do opisu materiału na karcie
   * klienta (`materialOpis`). Stawek jednostkowych klientowi nie pokazujemy —
   * to zasada z 11.08.2026, obowiązuje całą kartę wyceny.
   */
  const [cokoly] = pw.doOferty([{ nazwa: 'Cokoły', cena: 120, ilosc: 3, grupa: 'materiał' }]);
  assert.equal(cokoly.detal, 'ilość: 3');
  assert.doesNotMatch(cokoly.detal, /120|360|zł/, `detal zdradza stawkę: ${cokoly.detal}`);

  const r = rozbicieDlaKlienta(
    [{ nazwa: 'Materiał', detal: '', brutto: 4000 }, cokoly],
    {}
  );
  assert.doesNotMatch(r.materialOpis, /zł/, 'opis materiału pokazuje kwotę jednostkową');
});

test('przy ilości 1 nie dopisujemy nic zbędnego', () => {
  const [demontaz] = pw.doOferty([poz()]);
  assert.equal(demontaz.detal, '');
  assert.equal(demontaz.brutto, 300);
  assert.equal(demontaz.grupa, 'usługi');
  assert.equal(demontaz.wlasna, true);
});

/* ──────────────────────────────────────────────── zapis i odtworzenie */

test('pozycje przeżywają „Powtórz wycenę"', () => {
  const lista = [poz({ cena: 300 }), { nazwa: 'Cokoły', cena: 120, ilosc: 3, grupa: 'materiał' }];
  const zapis = pw.doParametrow(lista);
  const odtworzone = pw.zParametrow(zapis);
  assert.equal(odtworzone.length, 2);
  assert.equal(pw.razem(odtworzone), pw.razem(lista), 'kwota po odtworzeniu się zmieniła');
  assert.equal(odtworzone[1].grupa, 'materiał', 'zgubiony typ pozycji');
});

test('parametry z zewnątrz nie wysadzają edytora', () => {
  // Paczka „Powtórz wycenę" idzie przez adres, więc trzeba założyć śmieci.
  assert.deepEqual(pw.zParametrow(null), []);
  assert.deepEqual(pw.zParametrow('nonsens'), []);
  assert.deepEqual(pw.zParametrow([{ nazwa: 'Bez ceny' }]), []);
  const dziwne = pw.zParametrow([{ nazwa: 'X', cena: '250', ilosc: '2', grupa: 'wymyślona' }]);
  assert.equal(dziwne[0].cena, 250, 'cena z tekstu nie została policzona');
  assert.equal(dziwne[0].grupa, 'usługi', 'nieznana grupa powinna wpaść w usługi');
});

test('nazwa jest przycinana, żeby nie rozwaliła karty', () => {
  const [dl] = pw.doOferty([poz({ nazwa: 'x'.repeat(200) })]);
  assert.equal(dl.nazwa.length, 80);
});

/* ─────────────────────────────────────────────────────── wpięcie w edytor */

test('EDYTOR dolicza dodatki PRZED upustem', () => {
  /*
   * Upust procentowy ma objąć całą ofertę. Gdyby dodatki doliczały się po
   * upuście, „−10%" liczyłoby się tylko od części policzonej przez silnik,
   * a Dawid obiecywałby klientowi upust, którego nie dostaje.
   */
  const ed = zrodlo('src/app/oferta-dawida.js');
  assert.match(ed, /const wlasnePoz = pozWlasne\.doOferty\(stan\.wlasnePozycje\)/);
  assert.match(
    ed,
    /const przed = Math\.round\(w\.razemZaokr \|\| w\.razem\) \+ wlasneRazem;/,
    'dodatki nie wchodzą do kwoty przed upustem'
  );
  // Kolejność w kodzie: suma dodatków musi powstać PRZED korektą.
  assert.ok(
    ed.indexOf('const wlasneRazem') < ed.indexOf("stan.korektaTyp === 'procent'"),
    'dodatki liczone po zastosowaniu upustu'
  );
});

test('EDYTOR zapisuje dodatki W ŚRODKU parametrów', () => {
  /*
   * ⚠ To `parametry` wracają do edytora przy „Powtórz wycenę". Pozycja
   * położona piętro wyżej zniknęłaby przy pierwszej poprawce i Dawid
   * wpisywałby demontaż od nowa.
   */
  const ed = zrodlo('src/app/oferta-dawida.js');
  const i = ed.indexOf('parametry: {');
  assert.ok(i > 0, 'parametry nie są jednym obiektem');
  const koniec = ed.indexOf('const opisOdcinkow', i);
  const blok = ed.slice(i, koniec);
  assert.match(blok, /wlasnePozycje: pozWlasne\.doParametrow\(stan\.wlasnePozycje\)/,
    'dodatki zapisane poza parametrami');
  assert.match(ed, /wlasnePozycje: pozWlasne\.zParametrow\(p\.wlasnePozycje\)/,
    'edytor nie odczytuje dodatków z paczki');
});

test('EDYTOR ma blok dodawania i usuwania wierszy', () => {
  const ed = zrodlo('src/app/oferta-dawida.js');
  assert.match(ed, /function blokWlasnychPozycji\(stan, odswiez\)/);
  assert.match(ed, /blokWlasnychPozycji\(stan, odswiez\),/, 'blok nie jest rysowany');
  assert.match(ed, /\+ dodaj pozycję/);
  assert.match(ed, /lista\.splice\(i, 1\)/, 'brak usuwania wiersza');
});

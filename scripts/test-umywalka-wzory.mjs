/**
 * WZORY KAMIENIA I WIZUALIZACJA KOŃCOWA.
 *
 *   node --test scripts/test-umywalka-wzory.mjs
 *
 * Dwie rzeczy, o które prosił Dawid (23.11.2026):
 *   • bryła ma pokazywać PRAWDZIWY wzór kamienia ze zdjęć Architype,
 *   • na końcu, po formularzu, klient dostaje ładną wizualizację swojej
 *     umywalki razem z ceną — tę samą, która idzie mu na maila.
 *
 * Testy pilnują tego, co łatwo zepsuć przy następnej zmianie: że zdjęcia
 * leżą u nas (a nie są podłączone z serwera dostawcy), że mapa dekorów
 * zgadza się z plikami na dysku i że wizualizacja nie zgubi kwoty.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { WZORY, plikWzoru } from '../src/generated/wzory-dekorow.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const czytaj = (s) => fs.readFileSync(path.join(ROOT, s), 'utf8');
const MARKI = ['keralini', 'avant-quartz'];

/* ═══════════════════════════════════════════ zdjęcia wzorów */

test('zdjęcia wzorów leżą w repozytorium, a nie na serwerze dostawcy', () => {
  for (const plik of ['src/umywalka/main.js', 'src/umywalka/scena3d.js', 'umywalka-na-wymiar.html']) {
    assert.ok(
      !czytaj(plik).includes('architype.pl'),
      `${plik} sięga po zdjęcia na serwer Architype zamiast do naszych plików`
    );
  }
  assert.match(czytaj('src/generated/wzory-dekorow.js'), /\/wzory\/\$\{marka\}/);
});

test('każdy wzór z mapy ma swój plik — teksturę i miniaturę', () => {
  for (const marka of MARKI) {
    for (const klucz of Object.values(WZORY[marka] || {})) {
      for (const sufiks of ['', '-mini']) {
        const sciezka = path.join(ROOT, 'public', 'wzory', marka, `${klucz}${sufiks}.webp`);
        assert.ok(fs.existsSync(sciezka), `brak pliku ${marka}/${klucz}${sufiks}.webp`);
      }
    }
  }
});

test('zdjęcia są lekkie — tekstura poniżej 120 kB, miniatura poniżej 12 kB', () => {
  // Tekstura dociąga się dopiero przy wyborze wzoru, ale na telefonie
  // w terenie każde sto kilobajtów widać.
  for (const marka of MARKI) {
    const katalog = path.join(ROOT, 'public', 'wzory', marka);
    for (const plik of fs.readdirSync(katalog)) {
      const kb = fs.statSync(path.join(katalog, plik)).size / 1024;
      const limit = plik.includes('-mini') ? 12 : 120;
      assert.ok(kb < limit, `${marka}/${plik} ma ${Math.round(kb)} kB (limit ${limit})`);
    }
  }
});

test('większość dekorów z cennika ma zdjęcie wzoru', () => {
  for (const marka of MARKI) {
    const katalog = JSON.parse(czytaj(`src/generated/${marka}.dekory.json`));
    const wszystkie = Object.keys(katalog.dekory).length;
    const zeZdjeciem = Object.keys(WZORY[marka] || {}).length;
    assert.ok(
      zeZdjeciem / wszystkie > 0.7,
      `${marka}: tylko ${zeZdjeciem} z ${wszystkie} dekorów ma zdjęcie`
    );
  }
});

test('plikWzoru oddaje ścieżkę albo null — nigdy nie zgaduje', () => {
  const pierwszy = Object.keys(WZORY.keralini)[0];
  assert.match(plikWzoru('keralini', pierwszy), /^\/wzory\/keralini\/.+\.webp$/);
  assert.match(plikWzoru('keralini', pierwszy, true), /-mini\.webp$/);
  assert.equal(plikWzoru('keralini', 'Nie Ma Takiego Wzoru'), null);
  assert.equal(plikWzoru('nieznana-marka', pierwszy), null);
});

test('bryła sięga po zdjęcie, a bez zdjęcia rysuje teksturę zastępczą', () => {
  const scena = czytaj('src/umywalka/scena3d.js');
  assert.match(scena, /zeZdjecia/);
  assert.match(scena, /w\.plik \? zeZdjecia\(w\.plik\) : tekstura\(w\.faktura\)/);
  // Nieudane wczytanie zdjęcia nie może zostawić klienta z czarną bryłą.
  assert.match(scena, /delete texC\[plik\]/);
});

/* ═══════════════════════════════════════════ wizualizacja końcowa */

test('wizualizacja niesie to, po co klient przyszedł', () => {
  const wiz = czytaj('src/umywalka/wizualizacja.js');
  assert.match(wiz, /KAMIENIARSTWO 24H/);
  assert.match(wiz, /796 991 128/);
  assert.match(wiz, /kam24h\.pl/);
  assert.match(wiz, /zl\(w\.razemZaokr\)/);
  assert.match(wiz, /Projekt 3D i pomiar u klienta/);
  // JPEG, nie PNG: obrazek jedzie mailem, więc rozmiar ma znaczenie.
  assert.match(wiz, /toDataURL\('image\/jpeg'/);
});

test('wizualizacja powstaje PRZED wysłaniem, żeby pojechać razem ze zgłoszeniem', () => {
  const formularz = czytaj('src/umywalka/formularz.js');
  const indeksObrazka = formularz.indexOf('obraz = typeof wizualizacja');
  const indeksWysylki = formularz.indexOf('await wyslijLead(');
  assert.ok(indeksObrazka > 0 && indeksObrazka < indeksWysylki, 'obrazek musi powstać przed wysyłką');
  // ...ale jej brak nie może zablokować zgłoszenia.
  assert.match(formularz, /obraz = null;\s*\}/);
});

test('zrzut sceny wraca do stanu sprzed zrzutu', () => {
  const scena = czytaj('src/umywalka/scena3d.js');
  const od = scena.indexOf('function zrzut');
  const tresc = scena.slice(od, od + 2600);
  assert.match(tresc, /finally/);
  for (const co of ['R.setPixelRatio(zapasPr)', 'R.setSize(rozmiar.x', 'dimG.visible = true']) {
    assert.ok(tresc.includes(co), `zrzut nie przywraca: ${co}`);
  }
});

test('finał daje pobrać i wysłać dalej wizualizację', () => {
  const main = czytaj('src/umywalka/main.js');
  assert.match(main, /Pobierz wizualizację/);
  assert.match(main, /udostepnij\(/);
  // Przycisk „Wyślij dalej" tylko tam, gdzie system naprawdę to umie.
  assert.match(main, /navigator\.canShare/);
});

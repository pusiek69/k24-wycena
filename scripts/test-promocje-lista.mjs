/**
 * LISTA WSZYSTKICH DEKORÓW W PROMOCJI.
 *
 *   node --test scripts/test-promocje-lista.mjs
 *
 * Dopisek Dawida (26.08.2026): „żebym miał pokazane wszystkie te z promocji".
 *
 * Najważniejsze, czego pilnujemy:
 *   • lista bierze się z KAMPANII, nie z ręcznego spisu — więc gaśnie sama
 *     nazajutrz po zakończeniu promocji i sama pokazuje nową,
 *   • plakietka mówi o tej kampanii, po której NAPRAWDĘ policzył silnik,
 *   • porządek jest taki, jak prosił Dawid: podobny kolor na górze,
 *     w obu grupach od najtańszych.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  dekoryWPromocji,
  naturalneWPromocji,
  ulozPromocje,
  trwa,
  PROG_PODOBNEGO_KOLORU,
} from '../src/app/promocje-lista.js';
import { kolorDekoru, odlegloscKoloru } from '../src/app/kolory-dekorow.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const firma = (slug, promocje) => ({ slug, nazwa: slug, typ: 'konglomerat', promocje });

/* ═══════════════════════════════════════ wygasanie razem z kampanią */

test('kampania obowiązuje od pierwszego do ostatniego dnia włącznie', () => {
  const k = { od: '2026-08-20', do: '2026-09-30' };
  assert.equal(trwa(k, '2026-08-19'), false, 'dzień przed');
  assert.equal(trwa(k, '2026-08-20'), true, 'pierwszy dzień');
  assert.equal(trwa(k, '2026-09-30'), true, 'ostatni dzień');
  assert.equal(trwa(k, '2026-10-01'), false, 'dzień po');
});

test('po zakończeniu promocji lista jest pusta — sekcja znika sama', () => {
  const f = firma('x', [{ nazwa: 'Lato', od: '2026-08-20', do: '2026-09-30', ceny: { 'Dekor||20': 500 } }]);
  assert.equal(dekoryWPromocji([f], '20', '2026-09-30').length, 1, 'ostatniego dnia jeszcze jest');
  assert.equal(dekoryWPromocji([f], '20', '2026-10-01').length, 0, 'nazajutrz już nie');
});

test('kampania, która jeszcze nie ruszyła, nie pokazuje się', () => {
  const f = firma('x', [{ nazwa: 'Jesień', od: '2026-10-01', do: '2026-11-30', ceny: { 'D||20': 500 } }]);
  assert.equal(dekoryWPromocji([f], '20', '2026-09-30').length, 0);
});

/* ═════════════════════════════════ zgodność z tym, co liczy silnik */

test('przy dwóch nakładających się kampaniach wygrywa PIERWSZA', () => {
  /*
   * `znajdzPromocje` w engine/wycena.js idzie po liście firmy i bierze
   * pierwszą pasującą. Gdybyśmy tu wybrali inną, plakietka mówiłaby
   * o promocji, po której nie naliczyliśmy ceny.
   */
  const f = firma('laminam', [
    { nazwa: 'Sezon Letnich Okazji', od: '2026-08-20', do: '2026-09-30', ceny: { 'D||20': 600 } },
    { nazwa: 'Do końca roku', od: '2026-07-13', do: '2026-12-31', ceny: { 'D||20': 700 } },
  ]);
  const [poz] = dekoryWPromocji([f], '20', '2026-08-26');
  assert.equal(poz.kampania, 'Sezon Letnich Okazji');
  assert.equal(poz.doKiedy, '2026-09-30');
});

test('dekor promowany w kilku grubościach daje JEDEN wiersz', () => {
  const f = firma('x', [
    { nazwa: 'Lato', od: '2026-08-01', do: '2026-12-31', ceny: { 'D||12': 400, 'D||20': 600 } },
  ]);
  const lista = dekoryWPromocji([f], '20', '2026-08-26');
  assert.equal(lista.length, 1);
  assert.equal(lista[0].grubosc, '20', 'bierzemy grubość oferty głównej');
});

test('gdy dekor nie ma grubości z oferty — najcieńsza promowana', () => {
  const f = firma('keralini', [
    { nazwa: 'Lato', od: '2026-08-01', do: '2026-12-31', ceny: { 'D||12': 400 } },
  ]);
  assert.equal(dekoryWPromocji([f], '20', '2026-08-26')[0].grubosc, '12');
});

test('firma bez kampanii nie wywraca listy', () => {
  assert.deepEqual(dekoryWPromocji([firma('x', undefined)], '20', '2026-08-26'), []);
  assert.deepEqual(dekoryWPromocji(undefined, '20', '2026-08-26'), []);
});

/* ══════════════════════════════════════════════ kamień naturalny */

test('kamień naturalny wchodzi z własnej kampanii i jest oznaczony', () => {
  const promocja = {
    kampania: { nazwa: 'Sezon Letnich Okazji', od: '2026-08-20', do: '2026-09-30' },
    pozycje: [{ nazwa: 'BLACK PEARL', wykonczenie: 'poler', gruboscMm: 20, cenaNettoM2: 442 }],
  };
  const [poz] = naturalneWPromocji(promocja, '2026-08-26');
  assert.equal(poz.naturalny, true, 'musi być oznaczony — nie da się go dodać jako wariant');
  assert.equal(poz.dekor, 'BLACK PEARL');
  assert.equal(poz.grubosc, '20');
  assert.equal(poz.cenaNettoM2, 442);
});

test('kamień naturalny też gaśnie z datą', () => {
  const promocja = {
    kampania: { nazwa: 'Lato', od: '2026-08-20', do: '2026-09-30' },
    pozycje: [{ nazwa: 'X', gruboscMm: 20, cenaNettoM2: 400 }],
  };
  assert.equal(naturalneWPromocji(promocja, '2026-10-01').length, 0);
});

/* ═══════════════════════════════════════════════════════ kolejność */

test('podobny kolor na górze, w każdej grupie od najtańszych', () => {
  const lista = ulozPromocje([
    { dekor: 'Obcy tani', razem: 5000, podobnyKolor: false },
    { dekor: 'Pasujący drogi', razem: 9000, podobnyKolor: true },
    { dekor: 'Pasujący tani', razem: 6000, podobnyKolor: true },
    { dekor: 'Obcy drogi', razem: 8000, podobnyKolor: false },
  ]);
  assert.deepEqual(
    lista.map((x) => x.dekor),
    ['Pasujący tani', 'Pasujący drogi', 'Obcy tani', 'Obcy drogi']
  );
});

test('pozycje bez policzonej kwoty lądują na końcu swojej grupy', () => {
  const lista = ulozPromocje([
    { dekor: 'Bez kwoty', razem: null, podobnyKolor: true },
    { dekor: 'Z kwotą', razem: 9000, podobnyKolor: true },
  ]);
  assert.equal(lista[0].dekor, 'Z kwotą');
});

test('próg podobnego koloru jest ciaśniejszy niż przy trzech podpowiedziach', () => {
  // Przy stu dwudziestu pozycjach szeroki próg oznaczałby większość z nich
  // i wyróżnienie przestawałoby cokolwiek znaczyć.
  assert.equal(PROG_PODOBNEGO_KOLORU, 1);
  assert.ok(odlegloscKoloru('biel-zyla', 'biel') <= PROG_PODOBNEGO_KOLORU);
  assert.ok(odlegloscKoloru('biel-zyla', 'szary') > PROG_PODOBNEGO_KOLORU);
});

/* ═══════════════════════ na prawdziwych kampaniach z cenników */

test('na realnych cennikach plakietka nie kłamie', async () => {
  /*
   * Dla KAŻDEJ pozycji z listy sprawdzamy, że silnik naprawdę policzył ją
   * po cenie promocyjnej i po tej samej kampanii, którą pokazujemy.
   * To jest sedno: lista, która obiecuje promocję bez pokrycia w kwocie,
   * jest gorsza niż jej brak.
   */
  const { wycen, FIRMY } = await import('./lib/silnik.mjs').then((m) => m.wczytajSilnik());
  const odcinki = [
    { gl: 60, dl: 300 },
    { gl: 60, dl: 180 },
  ];
  const opcje = { pomieszczenie: 'kuchnia', otwory: 1 };

  const firmy = FIRMY.filter((f) => f.slug !== 'interstone');
  const lista = dekoryWPromocji(firmy, '20');
  assert.ok(lista.length > 0, 'w cennikach nie ma ani jednej aktywnej promocji');

  const bezPokrycia = [];
  for (const p of lista) {
    const f = FIRMY.find((x) => x.slug === p.firma);
    const w = wycen(f, { dekor: p.dekor, grubosc: p.grubosc, odcinki, opcje });
    if (!w.ok) continue;
    if (!w.promo) bezPokrycia.push(`${p.firma}/${p.dekor}/${p.grubosc} — silnik nie widzi promocji`);
    else if (w.promo.nazwa !== p.kampania) {
      bezPokrycia.push(`${p.firma}/${p.dekor} — plakietka „${p.kampania}", silnik „${w.promo.nazwa}"`);
    }
  }
  assert.deepEqual(bezPokrycia.slice(0, 5), []);
});

test('lista promocji obejmuje WSZYSTKIE aktywne kampanie, nie jedną', () => {
  // Dawid wymienił z pamięci tylko „Sezon Letnich Okazji". Aktywnych jest
  // więcej i pominięcie ich wyglądałoby na zgubione pozycje.
  return import('./lib/silnik.mjs')
    .then((m) => m.wczytajSilnik())
    .then(({ FIRMY }) => {
      const lista = dekoryWPromocji(FIRMY.filter((f) => f.slug !== 'interstone'), '20');
      const kampanie = new Set(lista.map((p) => p.kampania));
      assert.ok(kampanie.size >= 2, `tylko jedna kampania na liście: ${[...kampanie]}`);
      assert.ok(new Set(lista.map((p) => p.firma)).size >= 3, 'promocje z co najmniej trzech marek');
    });
});

/* ═════════════════════════════════════ zakres: narzędzie Dawida */

const czytaj = (pl) => fs.readFileSync(path.join(ROOT, pl), 'utf8');

test('lista promocji nie wycieka do widoków klienta', () => {
  for (const plik of ['src/app/oferta-widok.js', 'src/app/wynik-widok.js', 'src/app/czat.js']) {
    assert.ok(!czytaj(plik).includes('promocje-lista.js'), `${plik} importuje listę promocji`);
  }
});

test('kolor dekoru promocyjnego liczy się tym samym klasyfikatorem', () => {
  assert.equal(kolorDekoru('Crystal Absolute White'), 'biel');
});

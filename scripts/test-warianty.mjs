/**
 * WARIANTY MATERIAŁOWE W OFERCIE.
 *
 *   node --test scripts/test-warianty.mjs
 *
 * Zlecenie Dawida (25.08.2026): do oferty głównej można ręcznie dobrać
 * do trzech wariantów na innym materiale — ten sam blat, inny kamień,
 * do porównania cen.
 *
 * Pilnujemy trzech rzeczy:
 *   • upust przenosi się na wariant UCZCIWIE (procentem, nie kwotą),
 *   • do klienta idzie sama kwota łączna — żadnych cen jednostkowych,
 *   • wariant liczy ten sam silnik co ofertę główną.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAKS_WARIANTOW,
  upustGlownej,
  cenaWariantu,
  wspolczynnik,
  opisUpustu,
  zamrozWariant,
  roznica,
  poCenie,
} from '../src/app/warianty.js';
import { wczytajSilnik } from './lib/silnik.mjs';

// Silnik bundlujemy tak samo jak pozostale testy — warianty MUSZA chodzic
// tym samym kodem co oferta glowna, inaczej porownanie klamie.
const { wycen, FIRMY } = await wczytajSilnik();

/* ─────────────────────────────────── upust: z kwot, nie z mechanizmu */

test('upust głównej liczy się z kwot', () => {
  assert.equal(upustGlownej({ razemPrzed: 10000, razem: 9200 }), 0.08);
});

test('brak upustu = zero', () => {
  assert.equal(upustGlownej({ razemPrzed: 10000, razem: 10000 }), 0);
});

test('cena podniesiona ręcznie nie robi się „ujemnym upustem"', () => {
  // Dawid może nadpisać cenę w górę — wariant nie ma z tego tytułu drożeć.
  assert.equal(upustGlownej({ razemPrzed: 9000, razem: 9500 }), 0);
});

test('puste kwoty nie wywracają rachunku', () => {
  assert.equal(upustGlownej({}), 0);
  assert.equal(upustGlownej({ razemPrzed: 0, razem: 0 }), 0);
});

/* ───────────────────────────────────────── przenoszenie na wariant */

test('domyślnie wariant dziedziczy upust głównej — w procentach', () => {
  const upust = upustGlownej({ razemPrzed: 10000, razem: 9000 }); // 10%
  assert.equal(cenaWariantu(8000, {}, upust), 7200);
});

test('KWOTOWY upust głównej NIE przenosi się jako kwota', () => {
  // Główna: 10 000 → 9 500 (−500 zł, czyli −5%).
  // Wariant za 5 000 ma stanieć o 5% (250 zł), a nie o 500 zł —
  // inaczej tańszy kamień dostawałby absurdalnie większy rabat.
  const upust = upustGlownej({ razemPrzed: 10000, razem: 9500 });
  assert.equal(cenaWariantu(5000, {}, upust), 4750);
  assert.notEqual(cenaWariantu(5000, {}, upust), 4500);
});

test('tryb „brak" daje cenę regularną mimo upustu na głównej', () => {
  const upust = upustGlownej({ razemPrzed: 10000, razem: 9000 });
  assert.equal(cenaWariantu(8000, { upustTyp: 'brak' }, upust), 8000);
});

test('tryb „własny" bierze procent Dawida, nie głównej', () => {
  const upust = upustGlownej({ razemPrzed: 10000, razem: 9000 }); // 10%
  assert.equal(cenaWariantu(8000, { upustTyp: 'wlasny', upustProc: 25 }, upust), 6000);
});

test('własny upust 0% znaczy naprawdę zero', () => {
  const upust = upustGlownej({ razemPrzed: 10000, razem: 9000 });
  assert.equal(cenaWariantu(8000, { upustTyp: 'wlasny', upustProc: 0 }, upust), 8000);
});

test('upust nie schodzi poniżej zera ani powyżej 90%', () => {
  assert.equal(wspolczynnik({ upustTyp: 'wlasny', upustProc: -30 }), 0);
  assert.equal(wspolczynnik({ upustTyp: 'wlasny', upustProc: 150 }), 0.9);
  assert.equal(wspolczynnik({}, 5), 0.9, 'absurdalny upust z głównej też jest ścinany');
});

test('cena wariantu jest zaokrąglona do pełnych złotych', () => {
  const c = cenaWariantu(7777, {}, 0.075);
  assert.equal(c, Math.round(c), 'grosze nie mają prawa wyjść do klienta');
});

test('opis upustu mówi Dawidowi, co wyśle', () => {
  assert.match(opisUpustu({}, 0.08), /8%/);
  assert.match(opisUpustu({}, 0.08), /jak w g/);
  assert.match(opisUpustu({ upustTyp: 'wlasny', upustProc: 12 }, 0.08), /12%/);
  assert.equal(opisUpustu({ upustTyp: 'brak' }, 0.08), 'cena regularna');
});

/* ──────────────────────────── zamrożony wariant: co widzi klient */

test('zamrożony wariant nie niesie pozycji ani cen jednostkowych', () => {
  const w = zamrozWariant({
    opis: 'Technistone · Noble Carrara · 20 mm',
    material: 'Technistone', typ: 'konglomerat kwarcowy',
    razem: 7200, razemPrzed: 8000, stawkaVat: 0.08,
  });
  assert.deepEqual(Object.keys(w).sort(),
    ['material', 'opis', 'razem', 'razemPrzed', 'stawkaVat', 'typ']);
  const json = JSON.stringify(w);
  assert.doesNotMatch(json, /pozycje|detal|zaM2|brutto"/, 'wariant to porównanie cen, nie druga wycena');
  assert.doesNotMatch(json, /rozrys/, 'rozrys jest tylko dla oferty głównej');
});

test('przekreślona cena tylko wtedy, gdy naprawdę jest co przekreślić', () => {
  assert.equal(zamrozWariant({ razem: 7200, razemPrzed: 8000 }).razemPrzed, 8000);
  assert.equal(zamrozWariant({ razem: 8000, razemPrzed: 8000 }).razemPrzed, null);
  assert.equal(zamrozWariant({ razem: 8000 }).razemPrzed, null);
});

/* ──────────────────────────────────── różnica i kolejność dla klienta */

test('różnica mówi wprost, o ile taniej lub drożej', () => {
  assert.match(roznica(7200, 9000).opis, /tańszy o 1 800 zł/);
  assert.match(roznica(11000, 9000).opis, /droższy o 2 000 zł/);
  assert.equal(roznica(9000, 9000).opis, 'tyle samo');
});

test('kwoty w różnicy są grupowane spacją, po polsku', () => {
  assert.match(roznica(1000, 12500).opis, /11 500 zł/);
});

test('warianty pokazujemy od najtańszego', () => {
  const w = poCenie([{ razem: 9000 }, { razem: 6000 }, { razem: 12000 }]);
  assert.deepEqual(w.map((x) => x.razem), [6000, 9000, 12000]);
});

test('sortowanie nie psuje oryginalnej tablicy', () => {
  const wej = [{ razem: 9000 }, { razem: 6000 }];
  poCenie(wej);
  assert.equal(wej[0].razem, 9000, 'edytor Dawida ma zachować swoją kolejność');
});

test('pusta lista wariantów nie wywraca widoku', () => {
  assert.deepEqual(poCenie([]), []);
  assert.deepEqual(poCenie(undefined), []);
});

/* ───────────────────────────── wariant liczy TEN SAM silnik */

test('wariant to ten sam blat na innym materiale — liczony silnikiem', () => {
  const odcinki = [{ gl: 60, dl: 300 }];
  const opcje = { pomieszczenie: 'kuchnia', otwory: 1 };

  const wyniki = FIRMY.filter((f) => f.slug !== 'interstone')
    .slice(0, 3)
    .map((f) => {
      const dekor = Object.keys(f.dekory || {})[0];
      const grubosci = Object.keys(f.dekory[dekor]?.grubosci || f.dekory[dekor] || {});
      const w = wycen(f, { dekor, grubosc: grubosci[0], odcinki, opcje });
      return { firma: f.nazwa, ok: w.ok, razem: w.razemZaokr || w.razem };
    });

  for (const w of wyniki) {
    assert.equal(w.ok, true, `${w.firma}: silnik odmówił policzenia wariantu`);
    assert.ok(w.razem > 0, `${w.firma}: zerowa cena wariantu`);
  }
  // Różne materiały = różne ceny; inaczej porównanie nie ma sensu.
  const kwoty = new Set(wyniki.map((w) => w.razem));
  assert.ok(kwoty.size > 1, 'wszystkie warianty wyszły w tej samej cenie');
});

test('limit wariantów to trzy — tyle ustalił Dawid', () => {
  assert.equal(MAKS_WARIANTOW, 3);
});

/* ─────────────────────────────── warianty w mailu do klienta */

const { mailOferty } = await import('../worker/mail-oferty.js');

const OFERTA_Z_WARIANTAMI = {
  opis: 'Technistone · Crystal Absolute White · 20 mm',
  pozycje: [{ nazwa: 'Materiał', detal: '1 płyta · 380 zł/m²', brutto: 4000 }],
  razem: 9000,
  razemPrzed: 9000,
  stawkaVat: 0.08,
  warianty: [
    { opis: 'Caesarstone · Frosty Carrina · 20 mm', material: 'Caesarstone', typ: 'konglomerat kwarcowy', razem: 11500, razemPrzed: null },
    { opis: 'Laminam · Calce Bianco · 12 mm', material: 'Laminam', typ: 'spiek kwarcowy', razem: 7200, razemPrzed: 8000 },
  ],
};

test('mail pokazuje warianty od najtańszego', () => {
  const html = mailOferty('Anna', OFERTA_Z_WARIANTAMI, 'https://kam24h.pl/oferta#abc');
  assert.match(html, /Inne materiały/);
  const iLaminam = html.indexOf('Laminam');
  const iCaesar = html.indexOf('Caesarstone');
  assert.ok(iLaminam > 0 && iCaesar > 0, 'brak wariantów w mailu');
  assert.ok(iLaminam < iCaesar, 'tańszy wariant ma stać wyżej');
});

test('mail z wariantami niesie ich kwoty łączne', () => {
  const html = mailOferty('', OFERTA_Z_WARIANTAMI, 'https://x/#a');
  assert.match(html, /7 200 zł/);
  assert.match(html, /11 500 zł/);
});

test('warianty w mailu bez cen jednostkowych', () => {
  const html = mailOferty('', OFERTA_Z_WARIANTAMI, 'https://x/#a');
  // Kwota główna i kwoty wariantów — tak. Stawki za m² — nie.
  const poWariantach = html.slice(html.indexOf('Inne materiały'));
  assert.doesNotMatch(poWariantach, /zł\/m²/, 'cena jednostkowa wyciekła do wariantów');
});

test('oferta bez wariantów wygląda jak dotąd', () => {
  const html = mailOferty('Anna', { ...OFERTA_Z_WARIANTAMI, warianty: [] }, 'https://x/#a');
  assert.doesNotMatch(html, /Inne materiały/);
  assert.match(html, /Kwota całkowita brutto/);
});

test('nazwy materiałów w mailu są eskejpowane', () => {
  const html = mailOferty('', {
    ...OFERTA_Z_WARIANTAMI,
    warianty: [{ opis: '<script>x</script>', material: 'X', razem: 100 }],
  }, 'https://x/#a');
  assert.doesNotMatch(html, /<script>x/);
  assert.match(html, /&lt;script&gt;/);
});

test('wariant bez ceny nie psuje tabelki', () => {
  const html = mailOferty('', {
    ...OFERTA_Z_WARIANTAMI,
    warianty: [{ opis: 'Bez ceny', material: 'X', razem: 0 }],
  }, 'https://x/#a');
  assert.match(html, /Bez ceny/);
  assert.match(html, /0 zł/);
});

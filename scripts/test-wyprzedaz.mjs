/**
 * WYPRZEDAŻ PŁYT — kategoria „NATURA WYPRZEDAŻ" (zlecenie Dawida, 30.08.2026).
 *
 *   node --test scripts/test-wyprzedaz.mjs
 *
 * Najważniejsze, czego pilnujemy:
 *   • cena Dawida jest GOTOWA — silnik nie dokłada do niej marży,
 *   • każda płyta wchodzi do wyceny w SWOIM formacie,
 *   • sprzedana i nieopublikowana płyta nie ma prawa pokazać się klientowi,
 *   • wyprzedaż nie obiecuje więcej płyt, niż Dawid ma na placu.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { wczytajSilnik } = await import('./lib/silnik.mjs');
const m = await wczytajSilnik();
const {
  WYPRZEDAZ_SLUG,
  WYPRZEDAZ_NAZWA,
  dostepna,
  doPokazania,
  m2Plyty,
  cenaCalejPlyty,
  cenaNettoM2,
  upustProcent,
  formaPlyty,
  notaPlyty,
  firmaWyprzedazy,
  kluczDekoru,
  plytaWgDekoru,
  charakterPlyty,
  firmaDlaPlyty,
  brakuje,
  ostrzezenieOWyprzedazy,
  paczkaPodgladu,
  wycen,
  FIRMY,
} = m;

/** Płyta jak z workera — nadpisujemy tylko to, co dany test sprawdza. */
const plyta = (n = {}) => ({
  id: 1,
  nazwa: 'Granit Star Galaxy',
  opis: '',
  kodPlyty: '',
  firmaSlug: '',
  gruboscMm: 20,
  plytaDlCm: 320,
  plytaGlCm: 160,
  cenaNormalnaM2: 0,
  cenaM2: 600,
  plytRazem: 1,
  plytZostalo: 1,
  zdjecie: '',
  opublikowana: true,
  ...n,
});

/* ─────────────────────────────────────────────── dostępność i sortowanie */

test('sprzedana płyta nie jest dostępna', () => {
  assert.equal(dostepna(plyta({ plytZostalo: 0 })), false);
  assert.equal(dostepna(plyta({ plytZostalo: 1 })), true);
});

test('szkic (nieopublikowany) nie jest dostępny', () => {
  assert.equal(dostepna(plyta({ opublikowana: false })), false);
});

test('lista dla klienta pomija sprzedane i szkice', () => {
  const lista = [
    plyta({ id: 1, cenaM2: 900 }),
    plyta({ id: 2, cenaM2: 500 }),
    plyta({ id: 3, plytZostalo: 0 }),
    plyta({ id: 4, opublikowana: false }),
  ];
  const widoczne = doPokazania(lista);
  assert.deepEqual(widoczne.map((p) => p.id), [2, 1]);
});

test('płyty idą od najtańszej — po to klient tu wchodzi', () => {
  const lista = [plyta({ id: 1, cenaM2: 800 }), plyta({ id: 2, cenaM2: 300 }), plyta({ id: 3, cenaM2: 550 })];
  assert.deepEqual(doPokazania(lista).map((p) => p.cenaM2), [300, 550, 800]);
});

/* ─────────────────────────────────────────────────────────── arytmetyka */

test('metry płyty liczą się z centymetrów, nie z metrów', () => {
  assert.equal(m2Plyty(plyta({ plytaDlCm: 320, plytaGlCm: 160 })), 5.12);
});

test('cena całej płyty to cena m² razy jej powierzchnia', () => {
  assert.equal(cenaCalejPlyty(plyta({ cenaM2: 600 })), Math.round(5.12 * 600));
});

test('upust liczy się tylko wtedy, gdy Dawid podał cenę „było"', () => {
  assert.equal(upustProcent(plyta({ cenaNormalnaM2: 0 })), null);
  assert.equal(upustProcent(plyta({ cenaNormalnaM2: 800, cenaM2: 600 })), 25);
  // Cena „było" niższa od wyprzedażowej to pomyłka — nie pokazujemy upustu.
  assert.equal(upustProcent(plyta({ cenaNormalnaM2: 400, cenaM2: 600 })), null);
});

test('BRUTTO Dawida sprowadzamy do NETTO po stawce towarowej', () => {
  // Cennik w silniku jest netto — bez tej zamiany wyprzedaż byłaby o 23%
  // droższa, niż Dawid ustawił, i to bez śladu w interfejsie.
  assert.equal(Math.round(cenaNettoM2(plyta({ cenaM2: 615 }), 0.23)), 500);
});

test('odmiana „płyta / płyty / płyt"', () => {
  assert.equal(formaPlyty(1), 'płyta');
  assert.equal(formaPlyty(3), 'płyty');
  assert.equal(formaPlyty(7), 'płyt');
});

/* ───────────────────────────────────────────── pseudo-firma dla silnika */

test('kategoria ma stały slug i nazwę, po których poznaje ją kreator', () => {
  const f = firmaWyprzedazy([plyta()]);
  assert.equal(f.slug, WYPRZEDAZ_SLUG);
  assert.equal(f.nazwa, WYPRZEDAZ_NAZWA);
  assert.equal(f.nazwa, 'NATURA WYPRZEDAŻ');
});

test('stawki robocizny pochodzą z REALNEJ firmy, nie z gołych stałych', () => {
  /*
   * `app/ustawienia.js#zastosujUstawienia` nakłada stawki z panelu Dawida
   * na `robocizna`/`opcje` KAŻDEJ firmy z osobna, ale nigdy na gołe stałe
   * w `_domyslne.js`. Kategoria zbudowana wprost ze stałych liczyłaby
   * obróbkę po staremu i cichcem rozjechałaby się z resztą aplikacji.
   */
  const f = firmaWyprzedazy([plyta()]);
  assert.ok(f.robocizna.length, 'brak stawek robocizny');
  assert.deepEqual(f.robocizna, FIRMY[0].robocizna);
  assert.deepEqual(f.opcje, FIRMY[0].opcje);
});

test('każda płyta wchodzi do cennika w SWOIM formacie', () => {
  const f = firmaWyprzedazy([
    plyta({ id: 1, nazwa: 'Duża', plytaDlCm: 320, plytaGlCm: 160 }),
    plyta({ id: 2, nazwa: 'Mała', plytaDlCm: 240, plytaGlCm: 120 }),
  ]);
  const duza = f.dekory['Duża #1']['20'];
  const mala = f.dekory['Mała #2']['20'];
  assert.deepEqual(duza.plyta, { w: 320, h: 160, polowkaDozwolona: false });
  assert.deepEqual(mala.plyta, { w: 240, h: 120, polowkaDozwolona: false });
});

test('resztka z placu nie ma połówki — nie ma z czego jej wziąć', () => {
  const f = firmaWyprzedazy([plyta()]);
  assert.equal(f.dekory[kluczDekoru(plyta())]['20'].plyta.polowkaDozwolona, false);
});

test('dwie płyty o tej samej nazwie nie nadpisują się w cenniku', () => {
  const f = firmaWyprzedazy([
    plyta({ id: 1, nazwa: 'Star Galaxy', plytaDlCm: 320 }),
    plyta({ id: 2, nazwa: 'Star Galaxy', plytaDlCm: 280 }),
  ]);
  assert.equal(Object.keys(f.dekory).length, 2, 'druga płyta nadpisała pierwszą');
});

test('kod magazynowy wchodzi do klucza, gdy Dawid go podał', () => {
  assert.equal(kluczDekoru(plyta({ kodPlyty: 'A-42' })), 'Granit Star Galaxy (A-42)');
  assert.equal(kluczDekoru(plyta({ id: 7 })), 'Granit Star Galaxy #7');
});

test('z klucza wracamy do właściwej płyty', () => {
  const lista = [plyta({ id: 1, nazwa: 'Pierwsza' }), plyta({ id: 2, nazwa: 'Druga' })];
  assert.equal(plytaWgDekoru(lista, 'Druga #2').id, 2);
  assert.equal(plytaWgDekoru(lista, 'Nie ma takiej'), null);
});

test('płyta ze wskazanym cennikiem dziedziczy charakter materiału, nie cenę', () => {
  const kamien = charakterPlyty(plyta({ firmaSlug: 'interstone' }));
  const zwykla = charakterPlyty(plyta({ firmaSlug: '' }));
  // Kamień naturalny ma większy odpad — rysunek, dobór, pęknięcia.
  assert.ok(kamien.narzutOdpad > zwykla.narzutOdpad, 'kamień powinien mieć większy odpad');
  // Dodatek za obróbkę bierzemy Z FIRMY, jaka by nie była: Dawid steruje
  // nim z panelu i dziś stoi na zerze. Test pilnuje ŹRÓDŁA, nie kwoty —
  // inaczej wywalałby się przy każdej zmianie stawki w panelu.
  const zFirmy = FIRMY.find((f) => f.slug === 'interstone');
  assert.equal(kamien.obrobkaNaturalnaZaM2, zFirmy.obrobkaNaturalnaZaM2);
  assert.equal(kamien.linkDekory, zFirmy.linkDekory);
});

test('firma dla płyty niesie jej charakter i notę dla klienta', () => {
  const lista = [plyta({ id: 1, firmaSlug: 'interstone', kodPlyty: 'B-7' })];
  const f = firmaDlaPlyty(lista, kluczDekoru(lista[0]));
  assert.equal(f.narzutOdpad, FIRMY.find((x) => x.slug === 'interstone').narzutOdpad);
  assert.equal(f.kodPlytyWyceny, 'B-7');
  assert.match(f.notaKlient, /potwierdzić dostępność/);
  // Kategoria zostaje ta sama — zmienia się tylko charakter materiału.
  assert.equal(f.slug, WYPRZEDAZ_SLUG);
});

/* ──────────────────────────────────────────────── wycena przez silnik */

test('WYCENA bierze cenę Dawida i nie dokłada do niej marży', () => {
  const p = plyta({ cenaM2: 615, plytaDlCm: 320, plytaGlCm: 160 });
  const f = firmaDlaPlyty([p], kluczDekoru(p));

  const w = wycen(f, {
    dekor: kluczDekoru(p),
    grubosc: '20',
    odcinki: [{ dl: 260, gl: 62 }],
    opcje: {},
  });
  assert.ok(w.ok, w.blad);

  // Blat mieści się w jednej płycie, a wyprzedaż rozliczamy na całe płyty,
  // więc materiał = cena Dawida × pełna powierzchnia płyty.
  const material = w.pozycje.find((x) => x.grupa === 'materiał');
  const oczekiwane = Math.round(cenaNettoM2(p, 0.23) * m2Plyty(p) * 1.08);
  assert.ok(
    Math.abs(material.brutto - oczekiwane) <= 1,
    `materiał ${material.brutto} zł, oczekiwane ~${oczekiwane} zł`
  );
});

test('wycena z wyprzedaży pokazuje nazwę płyty, nie samą kategorię', () => {
  const p = plyta({ nazwa: 'Kwarcyt Taj Mahal', id: 3 });
  const f = firmaDlaPlyty([p], kluczDekoru(p));
  const w = wycen(f, {
    dekor: kluczDekoru(p),
    grubosc: '20',
    odcinki: [{ dl: 260, gl: 62 }],
    opcje: {},
  });
  const material = w.pozycje.find((x) => x.grupa === 'materiał');
  assert.match(material.nazwa, /Kwarcyt Taj Mahal/);
});

test('grubość spoza płyty nie wywala wyceny — liczy tę, którą Dawid ma', () => {
  const p = plyta({ gruboscMm: 30 });
  const f = firmaDlaPlyty([p], kluczDekoru(p));
  const w = wycen(f, {
    dekor: kluczDekoru(p),
    grubosc: '20',
    odcinki: [{ dl: 260, gl: 62 }],
    opcje: {},
  });
  assert.ok(w.ok, w.blad);
});

/* ─────────────────────────────────────── skończona liczba sztuk na placu */

test('nie obiecujemy więcej płyt, niż Dawid ma na placu', () => {
  const p = plyta({ plytRazem: 1, plytZostalo: 1 });
  assert.equal(brakuje(p, 1), null);
  const komunikat = brakuje(p, 2);
  assert.ok(komunikat, 'brak ostrzeżenia przy zbyt dużym blacie');
  assert.match(komunikat, /2 płyty/);
  assert.match(komunikat, /kontakt/);
});

test('przy kilku sztukach limit jest odpowiednio wyższy', () => {
  const p = plyta({ plytRazem: 3, plytZostalo: 3 });
  assert.equal(brakuje(p, 3), null);
  assert.ok(brakuje(p, 4));
});

/* ──────────────────────────────────────────────── nota i podgląd */

test('nota mówi wprost, ile sztuk zostało', () => {
  assert.match(notaPlyty(plyta({ plytZostalo: 1 })), /ostatnia sztuka/i);
  assert.match(notaPlyty(plyta({ plytZostalo: 3 })), /Zostało 3 płyty/);
});

test('paczka podglądu przechodzi tylko z kompletem pól', () => {
  const paczka = { podgladId: 5, exp: 123, podpis: 'abc' };
  const b64 = Buffer.from(JSON.stringify(paczka)).toString('base64url');
  assert.deepEqual(paczkaPodgladu(`#wyprzedazPodglad=${b64}`), paczka);
  assert.equal(paczkaPodgladu('#cos-innego'), null);
  assert.equal(paczkaPodgladu(''), null);

  const niepelna = Buffer.from(JSON.stringify({ podgladId: 5 })).toString('base64url');
  assert.equal(paczkaPodgladu(`#wyprzedazPodglad=${niepelna}`), null);
});

test('uszkodzony fragment adresu nie wywala strony', () => {
  assert.equal(paczkaPodgladu('#wyprzedazPodglad=to-nie-jest-base64!!!'), null);
});

/* ═══════════════════════════════════════════════════════════════════════
 * LISTA DEKORÓW A OBIEKTOWY WPIS CENNIKA
 *
 * Nie dotyczy samej wyprzedaży, ale tej samej postaci danych: wpis cennika
 * bywa obiektem `{cena, plyta}`, nie liczbą. `kroki.js#przygotujDekory`
 * liczyło minimum przez `Math.min` po obiektach — wychodziło NaN, filtr
 * `Number.isFinite` wycinał pozycję i przy Atlas Plan oraz Pacific klient
 * widział PUSTĄ listę dekorów. Znalezione 30.08.2026.
 * ═══════════════════════════════════════════════════════════════════════ */

test('marki z płytami w kilku formatach mają NIEPUSTĄ listę dekorów', () => {
  for (const slug of ['atlas-plan', 'pacific']) {
    const f = FIRMY.find((x) => x.slug === slug);
    if (!f) continue; // cennik może być chwilowo wyłączony
    const dekory = Object.entries(f.dekory || {});
    assert.ok(dekory.length, `${slug}: brak dekorów w cenniku`);

    // Dokładnie to, co robi lista w kreatorze — po naprawie.
    const zCena = dekory.filter(([, ceny]) => {
      const min = Math.min(
        ...Object.entries(ceny)
          .filter(([g]) => !(f.pomijGrubosci || []).includes(g))
          .map(([, wpis]) => (typeof wpis === 'number' ? wpis : wpis?.cena ?? NaN))
      );
      return Number.isFinite(min);
    });
    assert.equal(zCena.length, dekory.length, `${slug}: ${dekory.length - zCena.length} dekorów bez ceny`);
  }
});

/* ═══════════════════════════════════════════════════════════════════════
 * OSTRZEŻENIE O BRAKU PŁYT — na CAŁEJ ścieżce, nie tylko w funkcji
 *
 * ⚠ Znalezione 30.08.2026 przy przeglądzie produkcji: `brakuje` miało
 * własne testy i przechodziło, ale NIKT GO NIE WOŁAŁ. Na żywo blat
 * z dwóch odcinków 300×90 cm liczył się z dwóch płyt wyprzedażowych,
 * choć Dawid miał jedną — bez słowa ostrzeżenia.
 *
 * Dlatego te testy idą przez `wycen()` i sprawdzają, co realnie ląduje
 * w `w.ostrzezenia` — czyli w tym, co widzi klient na karcie i w mailu.
 * ═══════════════════════════════════════════════════════════════════════ */

/** Wycena tego blatu z tej płyty, z dopiętym ostrzeżeniem — jak w kreatorze. */
function wycenZOstrzezeniem(p, odcinki) {
  const f = firmaDlaPlyty([p], kluczDekoru(p));
  const w = wycen(f, { dekor: kluczDekoru(p), grubosc: String(p.gruboscMm), odcinki, opcje: {} });
  const uwaga = ostrzezenieOWyprzedazy(w, [p]);
  if (uwaga) w.ostrzezenia.push(uwaga);
  return w;
}

test('blat mieszczący się w jednej płycie NIE straszy klienta', () => {
  const w = wycenZOstrzezeniem(plyta({ plytRazem: 1, plytZostalo: 1 }), [{ dl: 260, gl: 62 }]);
  assert.ok(w.ok);
  assert.equal(w.pak.plytyPelne, 1);
  assert.deepEqual(w.ostrzezenia.filter((o) => o.includes('wymaga')), []);
});

test('blat na DWIE płyty przy jednej dostępnej ostrzega w wycenie', () => {
  // Dokładnie przypadek z produkcji: 2 × 300×90 cm na płycie 320×160.
  const w = wycenZOstrzezeniem(
    plyta({ plytRazem: 1, plytZostalo: 1 }),
    [{ dl: 300, gl: 90 }, { dl: 300, gl: 90 }]
  );
  assert.ok(w.ok);
  assert.ok(w.pak.plytyPelne >= 2, `rozkrój dał ${w.pak.plytyPelne} płyt`);
  const uwaga = w.ostrzezenia.find((o) => o.includes('wymaga'));
  assert.ok(uwaga, `brak ostrzeżenia; ostrzeżenia: ${JSON.stringify(w.ostrzezenia)}`);
  assert.match(uwaga, /została 1 płyta/);
  assert.match(uwaga, /kontakt/);
});

test('przy dwóch sztukach na placu ten sam blat NIE ostrzega', () => {
  const w = wycenZOstrzezeniem(
    plyta({ plytRazem: 2, plytZostalo: 2 }),
    [{ dl: 300, gl: 90 }, { dl: 300, gl: 90 }]
  );
  assert.deepEqual(w.ostrzezenia.filter((o) => o.includes('wymaga')), []);
});

test('ostrzeżenie NIE dotyczy zwykłych materiałów z cennika', () => {
  // Konglomerat kupujemy u dostawcy — tam liczba płyt nie jest ograniczona.
  const f = FIRMY.find((x) => x.slug === 'avant-quartz');
  const dekor = Object.keys(f.dekory)[0];
  const w = wycen(f, {
    dekor,
    grubosc: '20',
    odcinki: [{ dl: 300, gl: 90 }, { dl: 300, gl: 90 }],
    opcje: {},
  });
  assert.equal(ostrzezenieOWyprzedazy(w, [plyta()]), null);
});

test('KREATOR naprawdę dopina to ostrzeżenie do wyceny', () => {
  /*
   * Test na ŹRÓDLE, nie na zachowaniu: pilnuje, że wywołanie w ogóle
   * istnieje w kodzie kroku „Wynik". Bez tego cała reszta testów tego
   * pliku przechodziła, a klient i tak nie widział ostrzeżenia.
   */
  const kroki = readFileSync(new URL('../src/app/kroki.js', import.meta.url), 'utf8');
  assert.match(kroki, /dopiszOstrzezenieWyprzedazy\(w\)/, 'krokWynik nie dopina ostrzeżenia');
  assert.match(kroki, /ostrzezenieOWyprzedazy/, 'brak importu funkcji ostrzegającej');
});

/* ═══════════════════════════════════════════════════════════════════════
 * FORMAT PŁYTY NA KARCIE — ten, z którego naprawdę liczyliśmy
 *
 * ⚠ Znalezione 30.08.2026 na produkcji: karta wyceny pisała „format
 * 324 × 162 cm" przy blacie ciętym z płyt 324 × 159 (Atlas Plan 20 mm),
 * a przy wyprzedaży pokazywała 300 × 180 zamiast prawdziwego wymiaru
 * płyty z placu. Widok brał `firma.plyta` (domyślny format firmy) zamiast
 * formatu przypisanego do pozycji cennika.
 * ═══════════════════════════════════════════════════════════════════════ */

test('wycena oddaje format płyty, z którego liczyła rozkrój', () => {
  const p = plyta({ plytaDlCm: 320, plytaGlCm: 160 });
  const f = firmaDlaPlyty([p], kluczDekoru(p));
  const w = wycen(f, {
    dekor: kluczDekoru(p),
    grubosc: '20',
    odcinki: [{ dl: 260, gl: 62 }],
    opcje: {},
  });
  assert.deepEqual(
    { w: w.plyta.w, h: w.plyta.h },
    { w: 320, h: 160 },
    'karta pokazałaby format inny niż płyta, którą klient kupuje'
  );
  // Domyślny format kategorii jest INNY — właśnie o to chodzi w tym teście.
  assert.notDeepEqual({ w: w.firma.plyta.w, h: w.firma.plyta.h }, { w: 320, h: 160 });
});

test('marki z formatem per grubość też oddają właściwą płytę', () => {
  // Atlas Plan: 12 mm z płyt 324×162, 20 mm z 324×159.
  const f = FIRMY.find((x) => x.slug === 'atlas-plan');
  if (!f) return;
  const dekor = Object.entries(f.dekory).find(([, ceny]) => {
    const a12 = ceny['12']?.plyta;
    const a20 = ceny['20']?.plyta;
    return a12 && a20 && (a12.w !== a20.w || a12.h !== a20.h);
  })?.[0];
  assert.ok(dekor, 'brak dekoru o różnych formatach — cennik Atlas Plan się zmienił');

  const formaty = ['12', '20'].map((g) => {
    const w = wycen(f, { dekor, grubosc: g, odcinki: [{ dl: 260, gl: 62 }], opcje: {} });
    return `${w.plyta.w}×${w.plyta.h}`;
  });
  assert.notEqual(formaty[0], formaty[1], 'obie grubości pokazują ten sam format — regresja wróciła');
});

test('WIDOK bierze format z wyceny, nie z domyślnego formatu firmy', () => {
  const widok = readFileSync(new URL('../src/app/wynik-widok.js', import.meta.url), 'utf8');
  assert.match(widok, /w\.plyta \|\| w\.firma\.plyta/, 'opisPlyty znów czyta sam firma.plyta');
});

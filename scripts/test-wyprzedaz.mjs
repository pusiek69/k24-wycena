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
  plytNaPlacu,
  hasloWyprzedazy,
  KATEGORIE,
  TYPY,
  etykietaTypu,
  doUzupelnienia,
  filtruj,
  policzWKategoriach,
  policzWTypach,
  listaProduktow,
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

/* ═══════════════════════════════════════════════════════════════════════
 * WYPRZEDAŻ W POZOSTAŁYCH ŚCIEŻKACH (zgłoszenia Dawida, 31.08.2026)
 *
 * 1. „Policz blat z tej płyty" prowadziło do KLASYCZNEGO kreatora, czyli
 *    do ścieżki awaryjnej, którą klient normalnie widzi tylko przy awarii
 *    asystenta. Ma prowadzić do tej samej rozmowy, co strona główna.
 * 2. W edytorze właściciela („Powtórz wycenę") nie dało się wybrać płyty
 *    z wyprzedaży — Dawid nie mógł powtórzyć wyceny na tej płycie.
 *
 * Testy idą po ŹRÓDLE, bo te moduły dotykają DOM-u i sieci, więc nie
 * uruchomią się w node. Sprawdzamy WPIĘCIE — czyli dokładnie to, czego
 * zabrakło: kod istniał, ale nikt go nie wołał.
 * ═══════════════════════════════════════════════════════════════════════ */

const zrodlo = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('link „Policz blat z tej płyty" prowadzi do ROZMOWY, nie do kreatora', () => {
  const main = zrodlo('src/main.js');
  assert.match(main, /uruchomAplikacje\(root, plyta\)/, 'płyta nie trafia do rozmowy');
  assert.ok(
    !/uruchomKreator\([^)]*plyta/.test(main),
    'płyta wciąż uruchamia klasyczny kreator'
  );
  // Kreator zostaje WYŁĄCZNIE jako wyjście awaryjne.
  assert.match(main, /pokazKreator/, 'zniknęło awaryjne wyjście do kreatora');
});

test('rozmowa przyjmuje płytę i zaczyna od niej', () => {
  const czat = zrodlo('src/app/czat.js');
  assert.match(czat, /akcje\.plyta/, 'rozmowa nie przyjmuje wybranej płyty');
  assert.match(czat, /function zacznijOdPlyty/, 'brak preselekcji płyty');
  assert.match(czat, /stan\.material = WYPRZEDAZ_SLUG/, 'preselekcja nie ustawia materiału');
});

test('rozmowa umie policzyć wyprzedaż — nie odsyła do telefonu', () => {
  /*
   * `firmaWgSlug('wyprzedaz')` zwraca null, bo kategoria powstaje w locie.
   * Bez wspólnego resolvera rozmowa mówiłaby „przy tym materiale wycenę
   * przygotowuje Dawid" i klient nie dostałby kwoty.
   */
  const czat = zrodlo('src/app/czat.js');
  assert.match(czat, /function firmaMaterialu/, 'brak resolvera firmy');
  assert.ok(
    !/firmaWgSlug\(stan\.material\)/.test(czat),
    'rozmowa liczy wciąż przez firmaWgSlug — wyprzedaży nie znajdzie'
  );
  assert.ok(
    !/firmaWgSlug\(wybor\.slug\)/.test(czat),
    'ścieżka z asystentem liczy przez firmaWgSlug'
  );
  // Ostrzeżenie o liczbie płyt musi działać także tutaj.
  assert.match(czat, /ostrzezenieOWyprzedazy/, 'rozmowa nie ostrzega o braku płyt');
});

test('kategoria jest do wybrania także w samej rozmowie', () => {
  // Inaczej klient w rozmowie nigdy jej nie zobaczy, choć w kreatorze jest.
  const pom = zrodlo('src/app/pomocnicy.js');
  assert.match(pom, /pom-karta-wyprzedaz/, 'brak kafelka kategorii w rozmowie');
  assert.match(pom, /function pomocnikPlytWyprzedazy/, 'brak wyboru płyty w rozmowie');
  assert.match(pom, /kartaPlyty/, 'rozmowa rysuje płyty innym kodem niż reszta');
});

test('EDYTOR WŁAŚCICIELA ma kategorię wyprzedaży i naprawdę nią liczy', () => {
  const ed = zrodlo('src/app/oferta-dawida.js');
  assert.match(ed, /WYPRZEDAZ_NAZWA.*płyta z placu/, 'brak pozycji w liście kolekcji');
  assert.match(ed, /stan\.firma === WYPRZEDAZ_SLUG/, 'edytor nie liczy wyprzedaży');
  assert.match(ed, /firmaDlaPlyty\(plyty, stan\.dekor\)/, 'edytor nie bierze firmy dla płyty');
  assert.match(ed, /ostrzezenieOWyprzedazy/, 'edytor nie ostrzega o braku płyt');
});

test('edytor NIE gubi wyboru wyprzedaży przy przerysowaniu', () => {
  /*
   * Gałąź wypełniająca listę dekorów wołała `firmaWgSlug(stan.firma) || FIRMY[0]`
   * i przypisywała `stan.firma = firma.slug`. Dla wyprzedaży dawało to ciche
   * cofnięcie wyboru do pierwszej kolekcji z cennika — wybór Dawida znikał
   * po jednym odświeżeniu formularza.
   */
  const ed = zrodlo('src/app/oferta-dawida.js');
  assert.match(ed, /const zWyprzedazy = stan\.firma === WYPRZEDAZ_SLUG/, 'brak rozpoznania kategorii');
  assert.match(
    ed,
    /if \(!naturalny && !plytaWlasna && !zWyprzedazy\)/,
    'gałąź cennikowa wciąż łapie wyprzedaż i resetuje wybór'
  );
});

test('kategoria pokazuje się TYLKO wtedy, gdy Dawid ma coś na placu', () => {
  // Pusta pozycja „NATURA WYPRZEDAŻ" w liście kolekcji tylko myli.
  const ed = zrodlo('src/app/oferta-dawida.js');
  assert.match(ed, /doPokazania\(plytyWyprzedazy\(\)\)\.length/, 'edytor pokazuje pustą kategorię');
  // Od 01.09.2026 pilnuje tego `hasloWyprzedazy`, które przy pustym placu
  // zwraca null — i kafelek, i pasek, i baner znikają jedną decyzją.
  const pom = zrodlo('src/app/pomocnicy.js');
  assert.match(pom, /const zWyprzedazy = haslo/, 'rozmowa pokazuje pustą kategorię');
});


/* ───────────────────────── pasek wyprzedaży (01.09.2026) ─────────────────
 * Zlecenie Dawida: „ciężko znaleźć wyprzedaż, a to powinno być aż KRZYKLIWE".
 * Pasek stoi w trzech miejscach naraz, więc najważniejsze jest to, żeby
 * wszystkie trzy liczyły TAK SAMO — i żeby milczały, gdy plac jest pusty.
 */

test('licznik płyt liczy SZTUKI, a nie pozycje w wykazie', () => {
  /*
   * ⚠ Pierwsza płyta Dawida to jedna pozycja, ale OSIEM sztuk. Kafelek
   * mówił wtedy „1 płyta z placu" i wyprzedaż wyglądała na resztkę, którą
   * ktoś już sprzątnął sprzed nosa.
   */
  const plyty = [
    plyta({ id: 1, plytZostalo: 8 }),
    plyta({ id: 2, plytZostalo: 3 }),
  ];
  assert.equal(plytNaPlacu(plyty), 11);
  assert.equal(doPokazania(plyty).length, 2, 'pozycje to co innego niż sztuki');
});

test('sprzedane i nieopublikowane płyty nie wchodzą do licznika', () => {
  const plyty = [
    plyta({ id: 1, plytZostalo: 4 }),
    plyta({ id: 2, plytZostalo: 0 }),
    plyta({ id: 3, plytZostalo: 9, opublikowana: false }),
  ];
  assert.equal(plytNaPlacu(plyty), 4);
});

test('pusty plac = brak hasła, czyli brak paska w każdym miejscu naraz', () => {
  assert.equal(hasloWyprzedazy([]), null);
  assert.equal(hasloWyprzedazy([plyta({ plytZostalo: 0 })]), null);
  assert.equal(hasloWyprzedazy([plyta({ opublikowana: false })]), null);
});

test('pasek zapowiada NAJWIĘKSZY upust, jaki naprawdę leży na placu', () => {
  const haslo = hasloWyprzedazy([
    plyta({ id: 1, cenaNormalnaM2: 1000, cenaM2: 800 }),   // −20%
    plyta({ id: 2, cenaNormalnaM2: 1250, cenaM2: 715 }),   // −43%
  ]);
  assert.equal(haslo.upust, 43);
  // Ta sama liczba musi wyjść na karcie płyty — inaczej baner obiecuje
  // co innego, niż klient widzi po kliknięciu.
  assert.equal(upustProcent(plyta({ cenaNormalnaM2: 1250, cenaM2: 715 })), 43);
});

test('bez ceny „było" pasek nie wymyśla procentu', () => {
  // Przekreślona cena wzięta z powietrza to zwykłe oszustwo — wolimy
  // pasek bez plakietki niż plakietkę bez pokrycia.
  const haslo = hasloWyprzedazy([plyta({ cenaNormalnaM2: 0, cenaM2: 700 })]);
  assert.equal(haslo.upust, null);
  assert.ok(haslo.sztuk >= 1);
});

test('nota odmienia „płytę" po polsku i mówi o ostatniej sztuce', () => {
  assert.match(hasloWyprzedazy([plyta({ plytZostalo: 1 })]).nota, /ostatnia płyta z placu/);
  assert.match(hasloWyprzedazy([plyta({ plytZostalo: 2 })]).nota, /^2 płyty z placu/);
  assert.match(hasloWyprzedazy([plyta({ plytZostalo: 8 })]).nota, /^8 płyt z placu/);
});

test('pasek w hero i pasek nad rozmową to DWA różne warianty', () => {
  /*
   * ⚠ Pierwsza wersja rysowała w obu miejscach ten sam pas. Na stronie
   * głównej wychodziły dwa identyczne czerwone paski w jednym ekranie —
   * czytelne raczej jako usterka niż jako oferta.
   */
  const zr = zrodlo('src/app/pasek-wyprzedazy.js');
  assert.match(zr, /opcje\.wariant === 'rozmowa'/, 'brak wariantu smukłego');
  assert.match(zr, /pasek-smukly/, 'brak klasy wariantu smukłego');

  const css = zrodlo('src/style.css');
  assert.match(css, /\.pasek-smukly \{/, 'wariant smukły bez własnego stylu');
  assert.match(css, /--zar:/, 'brak koloru żaru w motywie');

  const cz = zrodlo('src/app/czat.js');
  assert.match(cz, /wariant: 'rozmowa'/, 'rozmowa rysuje wariant z hero');
});

test('klik w pasek prowadzi PROSTO do płyt, a nie do pytania o pomieszczenie', () => {
  /*
   * Klient klika „Pokaż płyty" i ma zobaczyć płyty. Bez tego wyjątku
   * kolejność pomocnika (pomieszczenie → rodzaj → materiał) odpowiadała
   * na klik pytaniem „kuchnia czy łazienka?".
   */
  const cz = zrodlo('src/app/czat.js');
  assert.match(cz, /function pokazWyprzedaz\(\)/, 'brak wejścia z paska');
  assert.match(
    cz,
    /stan\.material === WYPRZEDAZ_SLUG && !stan\.dekor && doPokazania\(plytyWyprzedazy\(\)\)\.length[\s\S]{0,80}pomocnikDekor\(WYPRZEDAZ_SLUG/,
    'płyty nie mają pierwszeństwa po kliknięciu w pasek'
  );
  // Pasek czyści wcześniejszy wybór wzoru — inaczej klik w środku rozmowy
  // ustawiał materiał na wyprzedaż i zostawiał dekor z poprzedniej kolekcji.
  assert.match(cz, /stan\.dekor = null;/, 'pasek nie czyści poprzedniego wzoru');
});

test('kafelek wyprzedaży pokazuje się przy KAŻDYM rodzaju materiału', () => {
  /*
   * ⚠ Do 01.09.2026 kafelek wychodził tylko przy kamieniu naturalnym —
   * a pierwsza płyta, którą Dawid wystawił, to konglomerat kwarcowy.
   * Klient szukający konglomeratu nie widział jej wcale.
   */
  const pom = zrodlo('src/app/pomocnicy.js');
  assert.doesNotMatch(
    pom,
    /rodzaj === 'naturalny'\s*\)?\s*$/m,
    'kafelek wciąż zawężony do kamienia naturalnego'
  );
  const cz = zrodlo('src/app/czat.js');
  assert.match(
    cz,
    /const jestWyprzedaz = doPokazania\(plytyWyprzedazy\(\)\)\.length > 0;/,
    'skrót „jedna kolekcja w grupie" wciąż potrafi przeskoczyć wyprzedaż'
  );
});

test('zdjęcia płyt mają przejście przez Netlify na worker', () => {
  /*
   * ⚠ ZNALEZIONE NA PRODUKCJI 01.09.2026: worker wpisuje do listy adres
   * względem korzenia (`/wyprzedaz/zdjecie/4`), więc na kam24h.pl leciał
   * do Netlify — 404 i zbite zdjęcie na KAŻDEJ karcie wyprzedaży.
   *
   * Proxy (status 200) trzyma obrazek na własnej domenie, dzięki czemu
   * `img-src 'self'` w CSP wystarcza i nie trzeba wpuszczać obcej domeny.
   */
  const netlify = zrodlo('netlify.toml');
  const blok = /\[\[redirects\]\]\s*\n\s*from = "\/wyprzedaz\/zdjecie\/\*"\s*\n\s*to = "([^"]+)"\s*\n\s*status = (\d+)/.exec(netlify);
  assert.ok(blok, 'brak przekierowania dla zdjęć wyprzedaży');
  assert.match(blok[1], /workers\.dev\/wyprzedaz\/zdjecie\/:splat$/, 'proxy nie celuje w workera');
  assert.equal(blok[2], '200', 'zdjęcie musi iść przez proxy (200), nie przez 301');
});

test('zdjęcie, które się nie wczyta, ustępuje miejsca placeholderowi', () => {
  /*
   * ⚠ Z życia (01.09.2026): adres zdjęcia na kam24h.pl wracał 404 i na
   * karcie zostawała PUSTA RAMKA bez slowa wyjasnienia. Dawid zglosil to
   * trzy razy pod roznymi objawami („nie moge dodac zdjecia", „zdjecie sie
   * nie pokazuje", „nie widze zdjecia w podgladzie"), bo za kazdym razem
   * widzial to samo: nic. Cicha porazka kosztowala wiecej niz sam blad.
   *
   * Sama przyczyna jest naprawiona (proxy w netlify.toml), ale zamiana
   * ciszy na czytelny komunikat zostaje — i tu jej pilnujemy.
   */
  const karta = zrodlo('src/app/wyprzedaz-karta.js');
  assert.match(karta, /function zdjeciePlyty\(p\)/, 'brak osobnej obsługi zdjęcia');
  assert.match(karta, /onerror:[\s\S]{0,120}plyta-foto pusta/, 'zdjęcie znika po cichu');

  const panel = zrodlo('worker/panel.js');
  assert.match(panel, /function zdjecieZapasowe\(el\)/, 'panel nie ma zapasowej miniatury');
  // Obie miniatury w panelu: w wierszu płyty i w formularzu edycji.
  assert.equal(
    (panel.match(/onerror="zdjecieZapasowe\(this\)"/g) || []).length,
    2,
    'któraś miniatura w panelu wciąż znika po cichu'
  );
});

test('przegląd sprawdza zdjęcia płyt NA DOMENIE KLIENTA', () => {
  /*
   * Sedno błędu było w RÓŻNICY między domenami: z panelu (workers.dev)
   * zdjęcia działały, z kam24h.pl nie. Przegląd, który pyta tylko workera,
   * przepuściłby to jeszcze raz.
   */
  const pr = zrodlo('scripts/przeglad.mjs');
  assert.match(pr, /async function sprawdzZdjeciaWyprzedazy\(\)/, 'brak sekcji ze zdjęciami');
  assert.match(pr, /await sprawdzZdjeciaWyprzedazy\(\);/, 'sekcja nie jest wołana');
  assert.match(
    pr,
    /\/\^https\?:\/i\.test\(p\.zdjecie\) \? p\.zdjecie : ADRES \+ p\.zdjecie/,
    'przegląd pyta o zdjęcie inną domenę niż klient'
  );
});

test('edytor właściciela CZEKA na płyty, zanim się narysuje', () => {
  /*
   * ⚠ ZNALEZIONE 01.09.2026 przy weryfikacji liczbowej.
   *
   * `main.js` miał trzy gałęzie startu i tylko jedna z nich wołała
   * `pobierzPlyty()`. Gałąź „Powtórz wycenę" rysowała edytor od razu, więc
   * `zaladowane()` oddawało pustą listę i Dawid widział „Nie ma dziś żadnej
   * opublikowanej płyty na wyprzedaży" — mając dwie na placu. Wybór materiału
   * wracał wtedy do pierwszej kolekcji z cennika.
   *
   * Dodanie kategorii do edytora (31.08.2026) tego NIE naprawiło: brakowało
   * nie kategorii, tylko danych. Dlatego pilnujemy tu samego pobrania.
   */
  const main = zrodlo('src/main.js');
  assert.match(
    main,
    /pobierzPlyty\(\)\.finally\(\(\) => uruchomOferteDawida\(root, powtorka\)\)/,
    'edytor właściciela znów rysuje się przed pobraniem płyt'
  );
  // Kontrola negatywna: gołe wywołanie bez czekania nie ma prawa wrócić.
  assert.doesNotMatch(
    main,
    /^\s*uruchomOferteDawida\(root, powtorka\);\s*$/m,
    'została gałąź rysująca edytor bez pobrania płyt'
  );
});

/* ═════════════════ kategorie, typ płyty i filtry (01.09.2026) ═════════════
 * Zlecenie Dawida: podział na SPIEKI / KAMIENIE NATURALNE / KONGLOMERATY,
 * rozróżnienie pełnych płyt od pozostałości z produkcji i szukanie po nazwie.
 */

test('filtr kategorii przepuszcza tylko swoją kategorię', () => {
  const plyty = [
    plyta({ id: 1, nazwa: 'Spiek Calacatta', kategoria: 'spiek' }),
    plyta({ id: 2, nazwa: 'Granit Star Galaxy', kategoria: 'naturalny' }),
    plyta({ id: 3, nazwa: 'Taj Mahal', kategoria: 'konglomerat' }),
  ];
  assert.deepEqual(filtruj(plyty, { kategoria: 'spiek' }).map((p) => p.id), [1]);
  assert.deepEqual(filtruj(plyty, { kategoria: 'naturalny' }).map((p) => p.id), [2]);
  assert.equal(filtruj(plyty, {}).length, 3, 'brak filtra ma pokazywać wszystko');
});

test('płyta BEZ kategorii nie wpada do żadnego kafelka, ale jest pod „wszystkie"', () => {
  /*
   * ⚠ Płyty Dawida sprzed 01.09.2026 nie mają kategorii. Zgadywanie za niego,
   * że „Taj Mahal Konglomerat Kwarcowy" to konglomerat, byłoby wpisywaniem
   * mu do oferty rzeczy, których nie potwierdził — a przy okazji ustawiłoby
   * kategorię płycie, którą mógł chcieć opisać inaczej.
   */
  const stara = plyta({ id: 9, nazwa: 'Taj Mahal Konglomerat Kwarcowy', kategoria: '' });
  assert.equal(filtruj([stara], {}).length, 1, 'stara płyta zniknęła z oferty');
  assert.equal(filtruj([stara], { kategoria: 'konglomerat' }).length, 0);
  assert.deepEqual(doUzupelnienia(stara), ['kategoria', 'typ']);
});

test('pozostałość z produkcji ma własny filtr i własną etykietę', () => {
  const plyty = [
    plyta({ id: 1, typ: 'pelna' }),
    plyta({ id: 2, typ: 'poprodukcyjna', plytaDlCm: 137, plytaGlCm: 64 }),
  ];
  assert.deepEqual(filtruj(plyty, { typ: 'poprodukcyjna' }).map((p) => p.id), [2]);
  assert.equal(etykietaTypu('poprodukcyjna'), 'Pozostałość z produkcji');
  assert.equal(etykietaTypu(''), '', 'brak typu nie ma etykiety');
});

test('formatka o nietypowym wymiarze liczy się tak samo — za sztukę', () => {
  /*
   * Pozostałość z produkcji to inna informacja dla klienta, ale NIE inna
   * arytmetyka: nadal kupuje konkretną sztukę o podanym wymiarze.
   */
  const formatka = plyta({
    typ: 'poprodukcyjna', plytaDlCm: 137, plytaGlCm: 64, cenaM2: 700, plytZostalo: 1,
  });
  assert.ok(Math.abs(m2Plyty(formatka) - 0.8768) < 0.0001, 'zły metraż formatki');
  assert.equal(cenaCalejPlyty(formatka), Math.round(0.8768 * 700));

  // Silnik musi przyjąć nietypowy format bez mrugnięcia.
  const f = firmaDlaPlyty([formatka], kluczDekoru(formatka));
  const w = wycen(f, {
    dekor: kluczDekoru(formatka),
    grubosc: String(formatka.gruboscMm),
    odcinki: [{ dl: 120, gl: 60 }],
    opcje: { dostawa: 'odbior' },
  });
  assert.ok(w.ok, w.blad);
  assert.equal(w.plyta.w, 137, 'rozkrój liczy z innego formatu niż formatka');
  assert.equal(w.plyta.h, 64);
});

test('szukanie działa po nazwie, dopisku i numerze płyty', () => {
  const plyty = [
    plyta({ id: 1, nazwa: 'Taj Mahal Light', opis: 'polerowany', kodPlyty: 'A-77' }),
    plyta({ id: 2, nazwa: 'Star Galaxy', opis: 'satyna', kodPlyty: 'B-12' }),
  ];
  assert.deepEqual(filtruj(plyty, { szukaj: 'taj' }).map((p) => p.id), [1]);
  assert.deepEqual(filtruj(plyty, { szukaj: 'SATYNA' }).map((p) => p.id), [2], 'szukanie ma nie zważać na wielkość liter');
  assert.deepEqual(filtruj(plyty, { szukaj: 'a-77' }).map((p) => p.id), [1]);
  assert.equal(filtruj(plyty, { szukaj: 'nie ma takiego' }).length, 0);
});

test('filtry składają się ze sobą', () => {
  const plyty = [
    plyta({ id: 1, nazwa: 'Spiek Calacatta', kategoria: 'spiek', typ: 'pelna' }),
    plyta({ id: 2, nazwa: 'Spiek Calacatta', kategoria: 'spiek', typ: 'poprodukcyjna' }),
    plyta({ id: 3, nazwa: 'Granit', kategoria: 'naturalny', typ: 'poprodukcyjna' }),
  ];
  assert.deepEqual(
    filtruj(plyty, { kategoria: 'spiek', typ: 'poprodukcyjna', szukaj: 'calacatta' }).map((p) => p.id),
    [2]
  );
});

test('kafelek, który nic by nie pokazał, w ogóle się nie rysuje', () => {
  // Pusty filtr to zmarnowane kliknięcie i fałszywa obietnica, że coś mamy.
  const plyty = [plyta({ id: 1, kategoria: 'spiek', typ: 'pelna' })];
  assert.deepEqual(policzWKategoriach(plyty, {}).map((k) => k.id), ['spiek']);
  assert.deepEqual(policzWTypach(plyty, {}).map((t) => t.id), ['pelna']);
});

test('liczby przy kafelkach uwzględniają pozostałe filtry', () => {
  const plyty = [
    plyta({ id: 1, nazwa: 'Alfa', kategoria: 'spiek' }),
    plyta({ id: 2, nazwa: 'Beta', kategoria: 'spiek' }),
    plyta({ id: 3, nazwa: 'Alfa', kategoria: 'konglomerat' }),
  ];
  const zeSzukaniem = policzWKategoriach(plyty, { szukaj: 'alfa' });
  assert.deepEqual(zeSzukaniem.map((k) => [k.id, k.ile]), [['spiek', 1], ['konglomerat', 1]]);
});

test('sprzedana płyta nie liczy się do żadnego filtra', () => {
  const plyty = [
    plyta({ id: 1, kategoria: 'spiek', plytZostalo: 0 }),
    plyta({ id: 2, kategoria: 'spiek', opublikowana: false }),
  ];
  assert.equal(filtruj(plyty, { kategoria: 'spiek' }).length, 0);
  assert.deepEqual(policzWKategoriach(plyty, {}), []);
});

test('słowniki kategorii i typów zgadzają się z bazą', () => {
  // Rozjazd między frontem a walidacją w workerze znaczyłby, że Dawid
  // wybiera w panelu kategorię, której żaden filtr klienta nie pokaże.
  const baza = zrodlo('worker/wyprzedaz-baza.js');
  for (const k of KATEGORIE) assert.match(baza, new RegExp(`'${k.id}'`), `baza nie zna kategorii ${k.id}`);
  for (const t of TYPY) assert.match(baza, new RegExp(`'${t.id}'`), `baza nie zna typu ${t.id}`);
});

test('dane strukturalne wyprzedaży nie obiecują płyt, których nie ma', () => {
  /*
   * Fałszywa dostępność w schema.org to nie drobiazg — za to leci kara ręczna
   * w Search Console. Sprzedana i nieopublikowana płyta nie ma prawa
   * pojawić się w ItemList, tak samo jak nie pojawia się na stronie.
   */
  const plyty = [
    plyta({ id: 1, nazwa: 'Widoczna', cenaM2: 700, plytZostalo: 2 }),
    plyta({ id: 2, nazwa: 'Sprzedana', plytZostalo: 0 }),
    plyta({ id: 3, nazwa: 'Szkic', opublikowana: false }),
  ];

  const lista = listaProduktow(plyty);
  assert.equal(lista.numberOfItems, 1, 'do schematu weszły płyty niedostępne');
  const produkt = lista.itemListElement[0].item;
  assert.equal(produkt.name, 'Widoczna');
  assert.equal(produkt.offers.availability, 'https://schema.org/InStock');
  assert.equal(produkt.offers.priceCurrency, 'PLN');

  // Cena w schemacie = cena CAŁEJ PŁYTY, ta sama, co na karcie klienta.
  assert.equal(produkt.offers.price, String(cenaCalejPlyty(plyty[0])));

  // Pusty plac → brak bloku, a nie pusty ItemList.
  assert.equal(listaProduktow([]), null);
  assert.equal(listaProduktow([plyta({ plytZostalo: 0 })]), null);
});

test('formatka jest w schemacie opisana jako pozostałość z produkcji', () => {
  const lista = listaProduktow([
    plyta({ typ: 'poprodukcyjna', plytaDlCm: 137, plytaGlCm: 64, kodPlyty: 'A-7' }),
  ]);
  const produkt = lista.itemListElement[0].item;
  assert.match(produkt.description, /137 × 64 cm/, 'brak rzeczywistego wymiaru formatki');
  assert.match(produkt.description, /Pozostałość z produkcji/, 'formatka podana jako pełna płyta');
  assert.equal(produkt.sku, 'A-7');
});

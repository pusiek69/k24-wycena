/**
 * ══════════════════════════════════════════════════════════════════════════
 *  STAN MAGAZYNOWY INTERSTONE — pobieranie i parsowanie
 *
 *  Interstone publikuje swój magazyn pod adresem
 *  https://www.interstone.pl/stan-magazynowy — z cenami, formatami płyt
 *  i dostępnymi metrami. Ceny tam podane są JUŻ z marżą Dawida, więc
 *  wolno je pokazywać klientowi wprost (to wyjątek od reguły ukrywania
 *  cen zakupowych — patrz skill „wycena-blatow").
 *
 *  Moduł jest CELOWO defensywny. Interstone nie ma API i nie obiecywał
 *  nam stabilnego HTML-a. Gdy strona się zmieni albo padnie, dostajemy
 *  pustą listę albo błąd — nigdy zmyślone dane. Konsultant ma wtedy
 *  powiedzieć „sprawdzę dostępność i wrócę z informacją" i wziąć kontakt.
 * ══════════════════════════════════════════════════════════════════════════
 */

const ADRES = 'https://www.interstone.pl/stan-magazynowy';

// Bez nagłówka przeglądarki Interstone odsyła pustą treść.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

const LIMIT_CZASU_MS = 8000;
const CACHE_SEK = 45 * 60; // magazyn zmienia się w skali dni, nie minut

/**
 * Wyniki są STRONICOWANE po 12 pozycji, a numer strony siedzi w parametrze
 * `custp`. To nie jest drobiazg: „taj mahal" daje 130 pozycji na 11 stronach,
 * a naturalny kwarcyt TAJ MAHAL leży dopiero na stronie 11 — bo sortowanie
 * alfabetyczne stawia przed nim „I NATURALI…", „InterQ…" i „RARE…".
 * Czytanie samej pierwszej strony kazało nam twierdzić, że naturalnego
 * Taj Mahal nie ma w magazynie. Miał rację Dawid, nie parser.
 */
const NA_STRONE = 12;
const MAKS_STRON = 14; // 168 płyt — z zapasem ponad najliczniejsze zapytania
const RAZEM_STRON = 4; // ile stron ciągniemy równolegle, żeby nie zalać Interstone

/* ─────────────────────────────────────────────── odescapowanie i pomocnicze */

const ENCJE = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#039;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&amp;': '&',
};

/**
 * Karty płyt siedzą w stronie jako ZAESCAPOWANY HTML (&lt;div&gt;…),
 * a niektóre encje są zaescapowane podwójnie (&amp;nbsp;) — stąd dwa przejścia.
 */
export function odescapuj(s) {
  let t = String(s);
  for (let i = 0; i < 2; i++) {
    t = t.replace(/&(lt|gt|quot|#039|apos|nbsp|amp);/g, (m) => ENCJE[m] ?? m);
  }
  return t;
}

const tekst = (s) =>
  odescapuj(s)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Pierwsza grupa z wyrażenia albo null — bez rzucania wyjątkiem. */
function zlap(html, re) {
  const m = html.match(re);
  return m ? tekst(m[1]) : null;
}

function liczba(s) {
  if (!s) return null;
  const m = String(s).replace(/\s/g, '').match(/-?\d+(?:[.,]\d+)?/);
  return m ? Number(m[0].replace(',', '.')) : null;
}

/** Cechy zapisane parami <div class="left">Etykieta</div><div class="right">wartość</div> */
function cechy(html) {
  const out = {};
  const re = /<div class="left">([\s\S]*?)<\/div>\s*<div class="right">([\s\S]*?)<\/div>/g;
  let m;
  while ((m = re.exec(html))) {
    const k = tekst(m[1]).replace(/:$/, '');
    if (k) out[k] = tekst(m[2]);
  }
  return out;
}

/** „1620.0 x 3240.0 mm" → { wys: 162, szer: 324 } w centymetrach */
function format(s) {
  if (!s) return null;
  const m = String(s).match(/(\d+(?:[.,]\d+)?)\s*[xX×]\s*(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const a = Number(m[1].replace(',', '.'));
  const b = Number(m[2].replace(',', '.'));
  if (!(a > 0 && b > 0)) return null;
  const cm = (x) => Math.round(x / 10 * 10) / 10; // mm → cm, do 0,1 cm
  return { wys: cm(a), szer: cm(b) };
}

/* ─────────────────────────────────────────────────────────────────── parser */

/**
 * ZDJĘCIA PŁYT — mapa „numer płyty → adresy zdjęć".
 *
 * Adresy mają postać:
 *   /content/uploads/images/stock/<STON…>/<id>/<id>-<N>.jpg
 * a miniatury tej samej płyty:
 *   …/<id>/conversions/<id>-<N>-small.jpg
 *
 * Dwie rzeczy sprawdzone na żywym serwisie, zanim to powstało:
 *   • rozszerzenie bywa .jpg ALBO .JPG — zgadywanie kończy się pustym obrazkiem,
 *   • nie każda płyta ma komplet zdjęć (są takie z samymi -1 i -2),
 * dlatego czytamy to, co faktycznie jest w HTML, zamiast składać adresy z kodu.
 *
 * Miniatura ma zawsze rozszerzenie .jpg, nawet gdy oryginał jest .JPG.
 *
 * Zdjęcia stoją w HTML PRZED znacznikiem karty, więc podział z parsera ich nie
 * obejmuje. Przypisujemy je po numerze płyty, który jest i w adresie, i w kodzie
 * („STON000890 - 91361" → 91361) — to nie zależy od układu strony.
 */
function zdjeciaWgPlyty(html) {
  const mapa = new Map();
  const wzor = /stock\/(STON\d+)\/(\d+)\/(\d+)-(\d+)\.(jpe?g)/gi;
  let m;
  while ((m = wzor.exec(html)) !== null) {
    const [, ston, id, , numer] = m;
    if (m[3] !== id) continue; // nazwa pliku musi dotyczyć tej samej płyty
    const lista = mapa.get(id) || new Map();
    if (!lista.has(numer)) {
      const katalog = `${ADRES.replace('/stan-magazynowy', '')}/content/uploads/images/stock/${ston}/${id}`;
      lista.set(numer, {
        numer: Number(numer),
        pelne: `${katalog}/${id}-${numer}.${m[5]}`,
        miniatura: `${katalog}/conversions/${id}-${numer}-small.jpg`,
      });
    }
    mapa.set(id, lista);
  }
  return mapa;
}

/**
 * Zdjęcie CAŁEJ płyty (na tle Interstone) kontra zbliżenie powierzchni.
 *
 * Sprawdzone na płytach 91361 i 93588: „-1" i „-2" to zbliżenia rysunku,
 * a „-3" to cała płyta ustawiona na stojaku. Dlatego bierzemy trójkę, a gdy
 * jej nie ma (płyta 92384 ma tylko dwa zdjęcia) — ostatnie dostępne.
 */
function wybierzZdjecia(lista) {
  if (!lista || !lista.size) return null;
  const wszystkie = [...lista.values()].sort((a, b) => a.numer - b.numer);
  const calaPlyta = wszystkie.find((z) => z.numer === 3) || wszystkie[wszystkie.length - 1];
  return {
    plyta: calaPlyta.pelne,
    miniatura: calaPlyta.miniatura,
    // Zbliżenie rysunku — przydaje się, gdy klient chce zobaczyć strukturę.
    detal: (wszystkie.find((z) => z.numer === 1) || calaPlyta).pelne,
    ile: wszystkie.length,
  };
}

/**
 * „PRODUKTY O TYM SAMYM BLOKU" — tabela osadzona w każdej karcie listingu
 * (Status / Magazyn / Symbol / Opis / Stan). Blok to jeden kamień przecięty
 * na płyty: identyczny wzór i usłojenie. Przy blacie na więcej niż jedną
 * płytę wolno mieszać WYŁĄCZNIE płyty z tej tabeli.
 *
 * Bierzemy tylko wiersze realnie dostępne: status „Na stanie" i stan w m².
 * „Rezerwacja" i „W drodze" odpadają — nie wolno ich obiecywać klientowi.
 *
 * Opis w rodzaju „pol_2x325x180 dp_" niesie wymiar płyty: grubość 2 cm,
 * 325 × 180 cm — czytamy go, bo tabela nie ma osobnej kolumny z formatem.
 */
export function tabelaBloku(karta) {
  const wzor =
    /<div class="table-row">\s*<div>\s*<span>([^<]*)<\/span>\s*<\/div>\s*<div>\s*<span>([^<]*)<\/span>\s*<\/div>\s*<div>\s*<span>([^<]*)<\/span>\s*<\/div>\s*<div>\s*<span>([^<]*)<\/span>\s*<\/div>\s*<div>\s*<span>([^<]*)<\/span>\s*<\/div>/g;

  const plyty = [];
  let razemM2 = 0;
  let m;
  while ((m = wzor.exec(karta)) !== null) {
    const [, status, magazyn, symbol, opis, stan] = m.map((x) => String(x ?? '').trim());
    if (!/na stanie/i.test(status)) continue; // „W drodze" nie obiecujemy
    const m2 = liczba(stan);
    if (!(m2 > 0)) continue; // „Rezerwacja" — zajęta
    const wym = opis.match(/(\d+(?:[.,]\d+)?)x(\d{2,3})x(\d{2,3})/);
    plyty.push({
      symbol,
      magazyn: magazyn || null,
      opis: opis || null,
      // Z opisu „pol_2x325x180 dp_": grubość 2 cm, płyta 325 × 180 cm.
      wymiarCm: wym ? { dl: Number(wym[2]), gl: Number(wym[3]) } : null,
      gruboscCm: wym ? Number(wym[1].replace(',', '.')) : null,
      dostepneM2: m2,
    });
    razemM2 += m2;
  }

  if (!plyty.length) return null;
  plyty.sort((a, b) => b.dostepneM2 - a.dostepneM2);
  return { razemM2: Math.round(razemM2 * 100) / 100, plyty };
}

export function parsujMagazyn(html) {
  const czysty = odescapuj(html);
  const zdjecia = zdjeciaWgPlyty(czysty);
  const czesci = czysty.split('l-single-inventory__type-label');
  const plyty = [];

  for (let i = 1; i < czesci.length; i++) {
    // 20 000 znaków: tabela „tym samym bloku" stoi ~5 kB w głąb karty
    // i rośnie z liczbą płyt bloku — 12 kB bywało na styk.
    const karta = czesci[i].slice(0, 20000);

    const nazwa = zlap(karta, /l-single-inventory__title[^>]*>([\s\S]*?)<\/div>/);
    if (!nazwa) continue;

    const c = cechy(karta);

    // Rodzaj materiału i marka stoją w dwóch pierwszych akapitach nad tytułem.
    const nag = [...karta.slice(0, 900).matchAll(/c-text--size-10[^>]*>([\s\S]*?)<\/div>/g)].map((m) =>
      tekst(m[1])
    );

    const kod = zlap(karta, /l-single-inventory__matnr[^>]*>([\s\S]*?)<\/div>/);
    // Numer płyty z końca kodu: „STON000890 - 91361" → „91361".
    const numerPlyty = (String(kod || '').match(/(\d+)\s*$/) || [])[1];

    plyty.push({
      nazwa,
      kod,
      zdjecia: wybierzZdjecia(zdjecia.get(numerPlyty)),
      rodzaj: (nag[0] || '').replace(/\s*\/\s*$/, '').trim() || null,
      marka: nag[1] || null,
      wykonczenie: c['Wykończenie'] || null,
      kolor: c['Kolor'] || null,
      blok: c['Blok'] || null,
      formatCm: format(c['Format (wys x szer)']),
      gruboscMm: liczba(c['Grubość']),
      jakosc: c['Jakość'] || null,
      cenaBruttoM2: liczba(zlap(karta, /l-single-inventory__price"[^>]*>([\s\S]*?)<\/div>/)),
      // Płyty z tego samego bloku (spójny wzór) — do liczenia dostępności
      // zleceń na więcej niż jedną płytę i do wyboru w trybie właściciela.
      blokPlyty: tabelaBloku(karta),
      stanM2: liczba(c['Stan rzeczywisty']),
      rezerwacjaM2: liczba(c['Rezerwacja']),
      dostepneM2: liczba(c['Dostępne']),
    });
  }

  return plyty;
}

/* ───────────────────────────────────────────────────────── fraza od klienta */

/**
 * Fraza trafia do cudzego serwera, więc przepuszczamy tylko to, co może być
 * nazwą kamienia: litery (także polskie), cyfry, spacja, myślnik, kropka.
 * Zwraca pusty łańcuch, gdy z frazy nic sensownego nie zostało.
 */
export function oczyscFraze(fraza) {
  const s = String(fraza ?? '')
    .normalize('NFC')
    .replace(/[^\p{L}\p{N} .-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
  return s.length >= 2 ? s : '';
}

/* ─────────────────────────────────────────────── kod konkretnej płyty */

/**
 * KOD PŁYTY (matnr) — np. „STON000334 - 84224".
 *
 * Magazyn zapisuje go ze spacjami wokół myślnika, klient przepisuje bez nich,
 * czasem małymi literami i z myślnikiem innego rodzaju. Do porównań
 * sprowadzamy wszystko do jednej postaci: WIELKIE LITERY, jeden dywiz,
 * bez spacji.
 *
 * Wyszukiwarka Interstone INDEKSUJE kody — `search=86421` oddaje dokładnie
 * tę jedną płytę. Przez pewien czas było tu napisane odwrotnie: zera zwracał
 * nie magazyn, tylko nasz własny filtr `odsiejNietrafione`, który porównywał
 * frazę wyłącznie z nazwą kamienia i kasował trafienie po kodzie.
 *
 * Format jest stały: 4 litery + 6 cyfr + 5 cyfr (sprawdzone na 544 kodach
 * ze stanu magazynowego). Prefiks bywa różny — STON to kamień naturalny,
 * ale są też LAMF (Laminam) i IDYFN — dlatego nie zawężamy go do „STON".
 */
export function normalizujKod(kod) {
  const s = String(kod ?? '')
    .toUpperCase()
    .replace(/[‐-―−]/g, '-') // myślniki typograficzne → dywiz
    // Wszystko, co nie jest literą ani cyfrą, traktujemy jak separator:
    // klient wpisuje spację, podkreślnik, ukośnik albo kropkę.
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  if (/^[A-Z]{2,6}\d{4,}-\d{3,}$/.test(s)) return s;

  // Zapis bez żadnego separatora („STON00062386421"). Numer płyty to
  // ostatnie 5 cyfr — reszta jest numerem bloku.
  const bezMyslnika = s.replace(/-/g, '');
  const m = bezMyslnika.match(/^([A-Z]{2,6}\d{4,})(\d{5})$/);
  return m ? `${m[1]}-${m[2]}` : '';
}

/** Czy tekst wygląda na kod płyty (sam format, bez sprawdzania magazynu). */
export function wygladaJakKod(kod) {
  return normalizujKod(kod) !== '';
}

/**
 * ROZŁOŻENIE TEGO, CO WKLEIŁ KLIENT, NA CZĘŚCI.
 *
 * Przyjmujemy trzy postacie, bo tyle realnie trafia od ludzi:
 *   • kod w dowolnym zapisie — „STON000623 - 86421", „ston000623_86421",
 *     „STON00062386421",
 *   • ADRES ze strony Interstone — klient kopiuje link do zdjęcia płyty,
 *     a ten zawiera i blok, i numer: …/stock/STON000623/86421/86421-3.jpg,
 *   • sam numer płyty — „86421". Numery są unikalne w magazynie, więc to
 *     wystarcza; gdyby jednak trafiły dwie płyty, lookup zgłosi niejednoznaczność.
 *
 * Zwraca { pelny, blok, numer } albo null, gdy z wejścia nic sensownego
 * nie zostało. `pelny` bywa null, gdy klient podał sam numer.
 */
export function rozlozKod(wejscie) {
  const surowe = String(wejscie ?? '').trim();
  if (!surowe) return null;

  // Adres ze strony magazynu — bierzemy blok i numer wprost ze ścieżki.
  const zUrl = surowe.match(/stock\/([A-Za-z]{2,6}\d{4,})\/(\d{3,})/);
  if (zUrl) {
    const blok = zUrl[1].toUpperCase();
    return { pelny: `${blok}-${zUrl[2]}`, blok, numer: zUrl[2] };
  }

  const pelny = normalizujKod(surowe);
  if (pelny) {
    const [blok, numer] = pelny.split('-');
    return { pelny, blok, numer };
  }

  // Sam numer płyty. Wymagamy 4–6 cyfr, żeby nie łapać przypadkowych liczb
  // z wiadomości (metrów, wymiarów, cen).
  const samNumer = surowe.replace(/\s/g, '');
  if (/^\d{4,6}$/.test(samNumer)) return { pelny: null, blok: null, numer: samNumer };

  return null;
}

/**
 * Numer płyty z kodu: „STON000623 - 86421" → „86421".
 *
 * To NAJLEPSZA fraza do wyszukiwania. Sprawdzone na żywym magazynie:
 *   search=86421              → 1 karta, dokładnie ta płyta,
 *   search=STON000623         → 8 kart (cały blok),
 *   search=STON000623-86421   → 8 kart, a nasz filtr trafień gubi z nich
 *                               wszystko, bo Interstone inaczej tokenizuje
 *                               pełny kod niż sam numer.
 * Dlatego przy szukaniu po kodzie pytamy numerem, a nie całym kodem.
 */
export function numerPlytyZKodu(kod) {
  const s = normalizujKod(kod);
  return s ? s.split('-')[1] : '';
}

/** Płyta o podanym kodzie spośród pobranych. Zwraca null, gdy jej nie ma. */
export function znajdzPoKodzie(plyty, kod) {
  const szukany = normalizujKod(kod);
  if (!szukany) return null;
  return (plyty || []).find((p) => normalizujKod(p.kod) === szukany) || null;
}

/* ─────────────────────────────────── link do magazynu dla klienta */

/**
 * Grupy materiałów w filtrze Interstone (`inventory-group`).
 * Nazwa grupy stoi na karcie płyty nad tytułem — parser zapisuje ją jako
 * `marka`, bo tam faktycznie widnieje „Kwarcyt", „Marmur", „Laminam".
 */
const GRUPY = {
  granit: 512,
  marmur: 511,
  kwarcyt: 521,
  onyx: 517,
  trawertyn: 518,
  dolomit: 608,
  szlachetne: 527,
  laminam: 524,
  interq: 610,
  interlite: 605,
  cosmolite: 609,
  re_stile: 607,
  tailored: 606,
  'quarella aglomarmur': 530,
  'quarella quartz': 531,
};

/**
 * Adres, pod którym KLIENT sam obejrzy i wybierze płytę: zdjęcia, wymiary
 * i ceny konkretnych bloków. Ceny na interstone.pl są już z marżą Dawida,
 * więc to, co klient tam zobaczy, zgadza się z naszą wyceną.
 *
 * Filtr grupy jest tu istotny, a nie kosmetyczny. Samo `search=taj mahal`
 * daje 130 pozycji i na pierwszej stronie pokazuje spiek oraz konglomerat —
 * naturalny kwarcyt leży dopiero na stronie 11. Z `inventory-group=521`
 * klient od razu widzi to, o czym rozmawiamy.
 */
export function linkMagazynu(nazwa, grupa) {
  const fraza = oczyscFraze(nazwa);
  if (!fraza) return null;

  const u = new URL(ADRES);
  u.searchParams.set('custp', '1');
  u.searchParams.set('type', 'inventory');
  u.searchParams.set('sort', 'name-asc');
  u.searchParams.set('search', fraza);
  u.searchParams.set('inventory-status', '122');

  const id = GRUPY[String(grupa || '').trim().toLowerCase()];
  if (id) u.searchParams.set('inventory-group', String(id));

  return u.toString();
}

/* ──────────────────────────────────────────── kontrola trafności wyników */

/** „Kamień Naturalny" → „kamien naturalny" — do porównywania nazw. */
function uprosc(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

/**
 * WAŻNE: gdy Interstone nie znajdzie nic pod daną frazą, NIE zwraca pustej
 * listy — oddaje pierwszą stronę całego magazynu posortowaną alfabetycznie.
 * Bez tego filtra konsultant na pytanie o nieistniejący wzór odpowiedziałby
 * cenami przypadkowego kamienia. Zostawiamy więc tylko płyty, których nazwa
 * zawiera wszystkie słowa z zapytania.
 *
 * Porównujemy wyłącznie z nazwą — rodzaj („Kamień naturalny") czy kolor
 * pasowałyby do zbyt wielu przypadkowych zapytań.
 */
/**
 * Ta sama płyta potrafi wrócić z dwóch stron, gdy magazyn przestawi się
 * między naszymi żądaniami. Kod magazynowy jest unikalny dla płyty,
 * więc po nim rozpoznajemy powtórki.
 */
export function odfiltrujDuplikaty(plyty) {
  const widziane = new Set();
  return plyty.filter((p) => {
    const klucz = p.kod || `${p.nazwa}|${p.formatCm?.wys}|${p.formatCm?.szer}|${p.dostepneM2}`;
    if (widziane.has(klucz)) return false;
    widziane.add(klucz);
    return true;
  });
}

export function odsiejNietrafione(plyty, fraza) {
  const slowa = uprosc(fraza)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 3);

  if (!slowa.length) return plyty;
  return plyty.filter((p) => {
    const nazwa = uprosc(p.nazwa);
    // Fraza bywa KODEM PŁYTY, nie nazwą kamienia — wyszukiwarka Interstone
    // indeksuje matnr i oddaje wtedy właściwą kartę. Bez tego warunku
    // sami kasowaliśmy trafienie, bo „STON000623" nie występuje w nazwie.
    // Kod porównujemy bez separatorów, żeby „STON000623 - 86421",
    // „ston000623-86421" i „86421" trafiały w to samo.
    const kod = uprosc(String(p.kod || '')).replace(/[^a-z0-9]/g, '');
    return slowa.every((w) => nazwa.includes(w) || kod.includes(w));
  });
}

/* ────────────────────────────────────────────────── ograniczenie odpytywania */

// Licznik żyje w pamięci izolatu — to zabezpieczenie „best effort",
// ale wystarcza, żeby zapętlony klient nie zaczął młócić Interstone'a.
const OKNO_MS = 60_000;
const MAKS_NA_OKNO = 12;
let oknoOd = 0;
let wOknie = 0;

function wolnoPobrac() {
  const teraz = Date.now();
  if (teraz - oknoOd > OKNO_MS) {
    oknoOd = teraz;
    wOknie = 0;
  }
  if (wOknie >= MAKS_NA_OKNO) return false;
  wOknie++;
  return true;
}

/* ───────────────────────────────────────────────────────── pobranie + cache */

function adresDla(fraza, strona = 1, { tylkoNaStanie = true } = {}) {
  const u = new URL(ADRES);
  u.searchParams.set('custp', String(strona)); // numer strony wyników
  u.searchParams.set('type', 'inventory');
  u.searchParams.set('sort', 'name-asc');
  u.searchParams.set('search', fraza);
  // 122 = „Produkt na stanie" (123 to „Produkt w drodze" — tego nie obiecujemy).
  //
  // Przy szukaniu KONKRETNEJ płyty filtr zdejmujemy. Inaczej płyta sprzedana
  // albo zarezerwowana wygląda dokładnie tak samo jak nieistniejący kod,
  // a to dwie różne wiadomości dla klienta: „sprawdź zapis kodu" kontra
  // „ta płyta już zeszła, proszę wybrać inną".
  if (tylkoNaStanie) u.searchParams.set('inventory-status', '122');
  return u.toString();
}

/**
 * Ile jest stron wyników — z bloku paginacji (`data-page="11"`).
 * Gdy paginacji nie ma, wynik mieści się na jednej stronie.
 */
function ileStron(html) {
  let maks = 1;
  for (const m of html.matchAll(/data-page="(\d+)"/g)) {
    const n = Number(m[1]);
    if (n > maks) maks = n;
  }
  return Math.min(maks, MAKS_STRON);
}

/** Pobranie jednej strony wyników. Zwraca HTML albo null. */
async function pobierzStrone(fraza, strona, opcje) {
  try {
    const odp = await fetch(adresDla(fraza, strona, opcje), {
      headers: { 'user-agent': UA, accept: 'text/html', 'accept-language': 'pl-PL,pl;q=0.9' },
      redirect: 'follow',
      signal: AbortSignal.timeout(LIMIT_CZASU_MS),
    });
    if (!odp.ok) {
      console.error('interstone', strona, odp.status);
      return null;
    }
    return await odp.text();
  } catch (e) {
    console.error('interstone', strona, e?.message || e);
    return null;
  }
}

/**
 * WYSZUKANIE KONKRETNEJ PŁYTY PO KODZIE — osobna ścieżka.
 *
 * Celowo NIE korzysta z `pobierzMagazyn`: tamto szuka po nazwie kamienia
 * i przepuszcza wynik przez `odsiejNietrafione`, który porównuje frazę
 * z nazwą. Kod nie jest nazwą, więc jazda tamtą drogą kończyła się gubieniem
 * trafień i błędnym wnioskiem, że magazyn nie zna kodów. Zna — po numerze
 * płyty oddaje dokładnie jedną kartę.
 *
 * Kolejność prób jest istotna:
 *   1. `search=<numer>` — najwęższe zapytanie, zwykle jedna karta,
 *   2. `search=<blok>` — cały blok (kilka–kilkanaście płyt), gdy numer sam
 *      nic nie dał; wśród nich szukamy dokładnego kodu.
 * Obie bez filtra dostępności, żeby odróżnić „nie ma takiego kodu"
 * od „płyta już zeszła" — to dwie różne wiadomości dla klienta.
 *
 * Zwraca zawsze obiekt z `powod`; `plyta` bywa wypełniona także przy
 * odmowie (np. „niedostepna"), żeby dało się napisać, o którą płytę chodzi.
 */
export async function znajdzPlyte(wejscie, ctx) {
  const czesci = rozlozKod(wejscie);
  if (!czesci) return { ok: false, powod: 'zly-format' };

  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const klucz = new Request(
    `https://magazyn.k24h.internal/plyta?v=${WERSJA_CACHE}&k=${encodeURIComponent(
      czesci.pelny || czesci.numer
    )}`
  );

  if (cache) {
    const zPamieci = await cache.match(klucz).catch(() => null);
    if (zPamieci) {
      const zapisane = await zPamieci.json().catch(() => null);
      if (zapisane) return { ...zapisane, zCache: true };
    }
  }

  if (!wolnoPobrac()) return { ok: false, powod: 'magazyn-niedostepny' };

  const proby = [czesci.numer, czesci.blok].filter(Boolean);
  let znalezione = [];

  for (const fraza of proby) {
    const strony = await wszystkieStrony(fraza, { tylkoNaStanie: false });
    if (strony === null) return { ok: false, powod: 'magazyn-niedostepny' };

    let plyty;
    try {
      plyty = odfiltrujDuplikaty(strony.flatMap((h) => parsujMagazyn(h)));
    } catch (e) {
      console.error('interstone parser (kod)', e?.message || e);
      return { ok: false, powod: 'magazyn-niedostepny' };
    }

    znalezione = plyty.filter((p) =>
      czesci.pelny
        ? normalizujKod(p.kod) === czesci.pelny
        : numerPlytyZKodu(p.kod) === czesci.numer
    );
    if (znalezione.length) break;
  }

  const wynik = oceńZnalezione(znalezione, czesci);

  if (cache && wynik.powod !== 'magazyn-niedostepny') {
    const zapis = cache
      .put(
        klucz,
        new Response(JSON.stringify(wynik), {
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': `max-age=${CACHE_SEK}`,
          },
        })
      )
      .catch(() => {});
    if (ctx?.waitUntil) ctx.waitUntil(zapis);
  }

  return wynik;
}

/** Co powiedzieć o tym, co znaleźliśmy (albo czego nie). */
function oceńZnalezione(znalezione, czesci) {
  const kod = czesci.pelny || (znalezione[0] ? normalizujKod(znalezione[0].kod) : null);

  if (!znalezione.length) return { ok: false, powod: 'nie-znaleziono', kod };

  // Sam numer płyty powinien być unikalny. Gdyby jednak trafił w kilka,
  // prosimy o pełny kod zamiast zgadywać, którą płytę klient miał na myśli.
  const rozne = new Set(znalezione.map((p) => normalizujKod(p.kod)));
  if (!czesci.pelny && rozne.size > 1) {
    return { ok: false, powod: 'niejednoznaczny', kody: [...rozne].slice(0, 5) };
  }

  const plyta = znalezione[0];
  if (!(plyta.dostepneM2 > 0)) return { ok: false, powod: 'niedostepna', plyta, kod };
  if (!(plyta.cenaBruttoM2 > 0)) return { ok: false, powod: 'brak-ceny', plyta, kod };
  if (!plyta.formatCm) return { ok: false, powod: 'brak-wymiaru', plyta, kod };

  return { ok: true, plyta, kod };
}

/**
 * Wszystkie strony wyników dla frazy. Zwraca tablicę HTML-i albo null,
 * gdy magazyn nie odpowiedział — wołający ma wtedy nie zgadywać.
 */
async function wszystkieStrony(fraza, opcje) {
  const pierwsza = await pobierzStrone(fraza, 1, opcje);
  if (pierwsza == null) return null;
  if (!pierwsza.includes('l-single-inventory__type-label')) return [];

  const stron = Math.min(ileStron(pierwsza), MAKS_STRON);
  const strony = [pierwsza];
  for (let od = 2; od <= stron; od += RAZEM_STRON) {
    const partia = [];
    for (let n = od; n < od + RAZEM_STRON && n <= stron; n++) partia.push(pobierzStrone(fraza, n, opcje));
    strony.push(...(await Promise.all(partia)).filter(Boolean));
  }
  return strony;
}

/**
 * Wersja w kluczu cache'u. PODNIEŚ JĄ przy każdej zmianie parsera albo
 * sposobu pobierania — inaczej po wdrożeniu przez 45 minut serwujemy stare,
 * błędne wyniki. Kosztowało nas to raz: po naprawie paginacji konsultant
 * dalej twierdził, że nie ma naturalnego Taj Mahal, bo czytał cache.
 */
const WERSJA_CACHE = 6; // 6: tabela płyt z tego samego bloku (20.08.2026)

const kluczCache = (fraza) =>
  new Request(
    `https://magazyn.k24h.internal/interstone?v=${WERSJA_CACHE}&q=${encodeURIComponent(fraza.toLowerCase())}`
  );

/**
 * Zwraca { ok, plyty, fraza } albo { ok: false, powod }.
 * NIGDY nie rzuca — wołający ma dostać jednoznaczną odpowiedź.
 *
 * powod: 'pusta-fraza' | 'limit' | 'blad-sieci' | 'blad-strony' | 'brak-danych'
 */
export async function pobierzMagazyn(frazaSurowa, ctx) {
  const fraza = oczyscFraze(frazaSurowa);
  if (!fraza) return { ok: false, powod: 'pusta-fraza' };

  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const klucz = kluczCache(fraza);

  if (cache) {
    const zPamieci = await cache.match(klucz).catch(() => null);
    if (zPamieci) {
      const plyty = await zPamieci.json().catch(() => null);
      if (Array.isArray(plyty)) return { ok: true, fraza, plyty, zCache: true };
    }
  }

  if (!wolnoPobrac()) return { ok: false, powod: 'limit', fraza };

  const pierwsza = await pobierzStrone(fraza, 1);
  if (pierwsza == null) return { ok: false, powod: 'blad-strony', fraza };

  // Znacznik kart musi być w treści. Gdy go nie ma, strona wygląda inaczej
  // niż zakładał parser — wolimy przyznać się do niewiedzy niż zmyślać.
  if (!pierwsza.includes('l-single-inventory__type-label')) {
    // Pusty wynik wyszukiwania to nie awaria — po prostu nic nie pasuje.
    if (/js-filters-counter[^>]*>\s*0\s/.test(pierwsza)) {
      return { ok: true, fraza, plyty: [], stron: 1 };
    }
    console.error('interstone: brak znacznika kart — strona zmieniła układ?');
    return { ok: false, powod: 'brak-danych', fraza };
  }

  // Reszta stron równolegle, partiami — inaczej „taj mahal" (11 stron)
  // czekałby na 11 kolejnych żądań po ~2 s każde.
  const stron = ileStron(pierwsza);
  const strony = [pierwsza];
  for (let od = 2; od <= stron; od += RAZEM_STRON) {
    const partia = [];
    for (let n = od; n < od + RAZEM_STRON && n <= stron; n++) partia.push(pobierzStrone(fraza, n));
    strony.push(...(await Promise.all(partia)));
  }

  let plyty;
  try {
    const wszystkie = strony.filter(Boolean).flatMap((h) => parsujMagazyn(h));
    plyty = odsiejNietrafione(odfiltrujDuplikaty(wszystkie), fraza);
  } catch (e) {
    console.error('interstone parser', e?.message || e);
    return { ok: false, powod: 'brak-danych', fraza };
  }

  if (stron >= MAKS_STRON) {
    console.warn(`interstone: „${fraza}" ma co najmniej ${stron} stron — czytamy pierwsze ${MAKS_STRON}.`);
  }

  if (cache) {
    const doZapisu = new Response(JSON.stringify(plyty), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': `max-age=${CACHE_SEK}`,
      },
    });
    const zapis = cache.put(klucz, doZapisu).catch(() => {});
    if (ctx?.waitUntil) ctx.waitUntil(zapis);
    else await zapis;
  }

  return { ok: true, fraza, plyty, stron };
}

/* ──────────────────────────────────────────── format wyniku dla konsultanta */

const pl = (n, jedn = '') =>
  n == null ? '?' : `${String(Math.round(n * 100) / 100).replace('.', ',')}${jedn}`;

/**
 * Zawsze dłuższy bok najpierw. Interstone podaje „wys × szer" w dowolnej
 * kolejności, a model potrafi z tego wyciągnąć, że odcinek 280 cm nie zmieści
 * się w płycie 153×293 — bo pierwszą liczbę bierze za długość.
 */
const wymiar = (f) =>
  f ? `${pl(Math.max(f.wys, f.szer))}×${pl(Math.min(f.wys, f.szer))} cm` : null;

const dluzszyBok = (f) => (f ? Math.max(f.wys, f.szer) : 0);

/** 1 płyta / 2 płyty / 5 płyt — konsultant czyta ten tekst, więc ma być po polsku. */
function mnoga(n, [jedna, kilka, wiele]) {
  const d = n % 10;
  const s = n % 100;
  if (n === 1) return `${n} ${jedna}`;
  if (d >= 2 && d <= 4 && !(s >= 12 && s <= 14)) return `${n} ${kilka}`;
  return `${n} ${wiele}`;
}

/**
 * Magazyn zwraca osobny wiersz na KAŻDĄ płytę — dla granitu bywa ich
 * kilkanaście z tą samą ceną i wykończeniem, a różnymi wymiarami.
 * Konsultanta interesuje co innego: ile łącznie mamy i czy zmieści się
 * najdłuższy odcinek blatu. Dlatego łączymy wiersze w warianty.
 */
export function pogrupuj(plyty) {
  const grupy = new Map();

  for (const p of plyty) {
    if (!(p.dostepneM2 > 0)) continue; // pozycja zarezerwowana albo wyzerowana
    const klucz = [p.nazwa, p.rodzaj, p.wykonczenie, p.gruboscMm, p.jakosc, p.cenaBruttoM2].join('|');
    const g = grupy.get(klucz) || {
      ...p,
      sztuk: 0,
      lacznieM2: 0,
      najwieksza: null,
      rozneFormaty: false,
    };

    g.sztuk++;
    g.lacznieM2 += p.dostepneM2;

    // „Największa" = z najdłuższym bokiem, bo to on decyduje, czy odcinek
    // blatu da się wyciąć bez łączenia. Pole powierzchni jest tu bez znaczenia.
    if (p.formatCm) {
      if (!g.najwieksza) g.najwieksza = p.formatCm;
      else {
        if (wymiar(p.formatCm) !== wymiar(g.najwieksza)) g.rozneFormaty = true;
        if (dluzszyBok(p.formatCm) > dluzszyBok(g.najwieksza)) g.najwieksza = p.formatCm;
      }
    }

    grupy.set(klucz, g);
  }

  return [...grupy.values()]
    .map((g) => ({
      nazwa: g.nazwa,
      rodzaj: g.rodzaj,
      marka: g.marka,
      wykonczenie: g.wykonczenie,
      kolor: g.kolor,
      jakosc: g.jakosc,
      gruboscMm: g.gruboscMm,
      cenaBruttoM2: g.cenaBruttoM2,
      // Wymiary płyty ZAWSZE dłuższym bokiem naprzód — front pakuje w nie
      // odcinki blatu, więc pomylona orientacja to pomylona liczba płyt.
      plytaCm: g.najwieksza
        ? { dl: Math.max(g.najwieksza.wys, g.najwieksza.szer), gl: Math.min(g.najwieksza.wys, g.najwieksza.szer) }
        : null,
      rozneFormaty: g.rozneFormaty,
      sztuk: g.sztuk,
      dostepneM2: Math.round(g.lacznieM2 * 100) / 100,
      // Gotowy adres do obejrzenia płyt tego wzoru — budujemy go tutaj,
      // żeby front i konsultant podawali dokładnie ten sam link.
      link: linkMagazynu(g.nazwa, g.marka),
    }))
    .sort((a, b) => b.dostepneM2 - a.dostepneM2);
}

/**
 * Zwięzły tekst dla modelu. Świadomie bez tabelek i bez upiększeń —
 * to dane wejściowe, nie gotowa odpowiedź dla klienta.
 */
export function opiszPlyty(wynik) {
  if (!wynik.ok) {
    const powody = {
      'pusta-fraza': 'Nie podano sensownej nazwy materiału.',
      limit: 'Za dużo zapytań do magazynu w krótkim czasie — spróbuj później.',
      'blad-sieci': 'Magazyn Interstone nie odpowiedział.',
      'blad-strony': 'Magazyn Interstone zwrócił błąd.',
      'brak-danych': 'Nie udało się odczytać stanu magazynowego.',
    };
    return `NIEDOSTĘPNE: ${powody[wynik.powod] || 'Nie udało się sprawdzić magazynu.'}`;
  }

  const warianty = pogrupuj(wynik.plyty);

  if (!warianty.length) {
    return wynik.plyty.length
      ? `„${wynik.fraza}" jest w katalogu Interstone, ale wszystkie płyty są zarezerwowane — brak wolnych metrów.`
      : `Brak płyt o nazwie „${wynik.fraza}" w magazynie Interstone. Jeśli podałeś kilka słów, ` +
          'spróbuj raz jeszcze samą nazwą własną wzoru (bez słów „granit", „marmur", „blat").';
  }

  // Popularny wzór potrafi mieć 40 wariantów na 11 stronach — surowa lista
  // byłaby dla konsultanta ścianą tekstu (i kosztem). Zwijamy ją o poziom
  // wyżej: to samo wykończenie i gatunek, a cena jako WIDEŁKI, bo każdy blok
  // kamienia naturalnego ma własną cenę.
  const zwiniete = new Map();
  for (const g of warianty) {
    const klucz = [g.nazwa, g.rodzaj, g.wykonczenie, g.gruboscMm, g.jakosc].join('|');
    const z = zwiniete.get(klucz) || {
      ...g,
      cenaOd: g.cenaBruttoM2,
      cenaDo: g.cenaBruttoM2,
      blokow: 0,
      sztukRazem: 0,
      m2Razem: 0,
      najdluzsza: 0,
    };
    if (g.cenaBruttoM2 != null) {
      z.cenaOd = z.cenaOd == null ? g.cenaBruttoM2 : Math.min(z.cenaOd, g.cenaBruttoM2);
      z.cenaDo = z.cenaDo == null ? g.cenaBruttoM2 : Math.max(z.cenaDo, g.cenaBruttoM2);
    }
    z.blokow++;
    z.sztukRazem += g.sztuk;
    z.m2Razem += g.dostepneM2;
    z.najdluzsza = Math.max(z.najdluzsza, g.plytaCm?.dl || 0);
    zwiniete.set(klucz, z);
  }

  const lista = [...zwiniete.values()].sort((a, b) => b.m2Razem - a.m2Razem);
  const POKAZ = 10;

  const wiersze = lista.slice(0, POKAZ).map((z) => {
    const cena =
      z.cenaOd == null
        ? 'cena do potwierdzenia'
        : z.cenaOd === z.cenaDo
          ? `${pl(z.cenaOd)} zł/m² brutto`
          : `${pl(z.cenaOd)}–${pl(z.cenaDo)} zł/m² brutto (zależnie od bloku)`;
    const cz = [
      z.nazwa,
      z.rodzaj,
      z.gruboscMm != null ? `${pl(z.gruboscMm)} mm` : null,
      z.wykonczenie,
      z.jakosc,
      cena,
      z.najdluzsza ? `płyty do ${pl(z.najdluzsza)} cm długości` : null,
      `wolne ${pl(z.m2Razem)} m² (${mnoga(z.sztukRazem, ['płyta', 'płyty', 'płyt'])})`,
    ].filter(Boolean);
    return `- ${cz.join(' | ')}`;
  });

  if (lista.length > POKAZ) {
    wiersze.push(`- …i ${mnoga(lista.length - POKAZ, ['dalszy wariant', 'dalsze warianty', 'dalszych wariantów'])} o mniejszej dostępności.`);
  }

  // Adresy podajemy gotowe — model ma je WKLEIĆ, a nie składać z parametrów.
  // Ręcznie sklejony link trafiłby klientowi do maila i po cichu prowadził
  // na pierwszą stronę wszystkich 130 pozycji zamiast na właściwy kamień.
  const linki = [];
  const widziane = new Set();
  for (const z of lista) {
    const klucz = `${z.nazwa}|${z.marka}`;
    if (!z.link || widziane.has(klucz)) continue;
    widziane.add(klucz);
    linki.push(`- ${z.nazwa}${z.marka ? ` (${z.marka})` : ''}: ${z.link}`);
    if (linki.length >= 4) break;
  }

  /*
   * KODY KONKRETNYCH PŁYT.
   *
   * Kamienia naturalnego nie wyceniamy „ogólnie" — potrzebny jest kod
   * wskazanej płyty (patrz normalizujKod). Konsultant musi więc mieć skąd go
   * wziąć: poniżej najlepsze dostępne płyty z kodami, cenami i wymiarami.
   * Bez tej listy model podawałby kody z pamięci, czyli zmyślone.
   */
  const konkretne = (wynik.plyty || [])
    .filter((p) => p.kod && p.dostepneM2 > 0 && p.cenaBruttoM2 > 0 && p.formatCm)
    .sort((a, b) => dluzszyBok(b.formatCm) - dluzszyBok(a.formatCm))
    .slice(0, 8)
    .map((p) => {
      const dl = Math.max(p.formatCm.wys, p.formatCm.szer);
      const gl = Math.min(p.formatCm.wys, p.formatCm.szer);
      return `- ${normalizujKod(p.kod) || p.kod} | ${p.nazwa} | ${pl(dl)} × ${pl(gl)} cm | ` +
        `${p.gruboscMm != null ? `${pl(p.gruboscMm)} mm | ` : ''}${pl(p.cenaBruttoM2)} zł/m² brutto | ` +
        `wolne ${pl(p.dostepneM2)} m²`;
    });

  return [
    `Magazyn Interstone — „${wynik.fraza}": ${mnoga(wynik.plyty.length, ['płyta', 'płyty', 'płyt'])} ` +
      `w ${mnoga(lista.length, ['wariancie', 'wariantach', 'wariantach'])}.`,
    ...wiersze,
    ...(konkretne.length
      ? [
          '',
          'KONKRETNE PŁYTY (kod | nazwa | wymiar | grubość | cena | dostępność).',
          'Wyceny kamienia naturalnego NIE DA SIĘ policzyć bez kodu płyty — podaj',
          'klientowi te kody i poproś o wskazanie jednego. Kody przepisuj DOKŁADNIE:',
          ...konkretne,
        ]
      : []),
    ...(linki.length
      ? ['', 'Klient może sam obejrzeć i wybrać płytę — WKLEJ ten adres bez zmian:', ...linki]
      : []),
    '',
    'Wymiary płyt: dłuższy bok podany jako pierwszy — tyle mierzy najdłuższy odcinek bez łączenia. ' +
      'Ceny są brutto za m² i wolno je podać klientowi wprost; przy widełkach powiedz „od … zł/m²", ' +
      'bo każdy blok ma własną cenę. Stan magazynu bywa zmienny — potwierdzamy przy zamówieniu.',
  ].join('\n');
}

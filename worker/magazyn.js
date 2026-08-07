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

export function parsujMagazyn(html) {
  const czysty = odescapuj(html);
  const czesci = czysty.split('l-single-inventory__type-label');
  const plyty = [];

  for (let i = 1; i < czesci.length; i++) {
    const karta = czesci[i].slice(0, 12000);

    const nazwa = zlap(karta, /l-single-inventory__title[^>]*>([\s\S]*?)<\/div>/);
    if (!nazwa) continue;

    const c = cechy(karta);

    // Rodzaj materiału i marka stoją w dwóch pierwszych akapitach nad tytułem.
    const nag = [...karta.slice(0, 900).matchAll(/c-text--size-10[^>]*>([\s\S]*?)<\/div>/g)].map((m) =>
      tekst(m[1])
    );

    plyty.push({
      nazwa,
      kod: zlap(karta, /l-single-inventory__matnr[^>]*>([\s\S]*?)<\/div>/),
      rodzaj: (nag[0] || '').replace(/\s*\/\s*$/, '').trim() || null,
      marka: nag[1] || null,
      wykonczenie: c['Wykończenie'] || null,
      kolor: c['Kolor'] || null,
      blok: c['Blok'] || null,
      formatCm: format(c['Format (wys x szer)']),
      gruboscMm: liczba(c['Grubość']),
      jakosc: c['Jakość'] || null,
      cenaBruttoM2: liczba(zlap(karta, /l-single-inventory__price"[^>]*>([\s\S]*?)<\/div>/)),
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
    return slowa.every((w) => nazwa.includes(w));
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

function adresDla(fraza, strona = 1) {
  const u = new URL(ADRES);
  u.searchParams.set('custp', String(strona)); // numer strony wyników
  u.searchParams.set('type', 'inventory');
  u.searchParams.set('sort', 'name-asc');
  u.searchParams.set('search', fraza);
  // 122 = „Produkt na stanie" (123 to „Produkt w drodze" — tego nie obiecujemy).
  u.searchParams.set('inventory-status', '122');
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
async function pobierzStrone(fraza, strona) {
  try {
    const odp = await fetch(adresDla(fraza, strona), {
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
 * Wersja w kluczu cache'u. PODNIEŚ JĄ przy każdej zmianie parsera albo
 * sposobu pobierania — inaczej po wdrożeniu przez 45 minut serwujemy stare,
 * błędne wyniki. Kosztowało nas to raz: po naprawie paginacji konsultant
 * dalej twierdził, że nie ma naturalnego Taj Mahal, bo czytał cache.
 */
const WERSJA_CACHE = 2;

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

  return [
    `Magazyn Interstone — „${wynik.fraza}": ${mnoga(wynik.plyty.length, ['płyta', 'płyty', 'płyt'])} ` +
      `w ${mnoga(lista.length, ['wariancie', 'wariantach', 'wariantach'])}.`,
    ...wiersze,
    'Wymiary płyt: dłuższy bok podany jako pierwszy — tyle mierzy najdłuższy odcinek bez łączenia. ' +
      'Ceny są brutto za m² i wolno je podać klientowi wprost; przy widełkach powiedz „od … zł/m²", ' +
      'bo każdy blok ma własną cenę. Stan magazynu bywa zmienny — potwierdzamy przy zamówieniu.',
  ].join('\n');
}

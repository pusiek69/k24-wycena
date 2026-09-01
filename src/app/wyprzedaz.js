/**
 * WYPRZEDAŻ PŁYT — logika kategorii „NATURA WYPRZEDAŻ".
 *
 * Zlecenie Dawida (30.08.2026): zamiast osobnego systemu promocji z banerem
 * i licznikiem — jedna dodatkowa KATEGORIA MATERIAŁU w kalkulatorze, obok
 * „Kamienia naturalnego", plus strona prezentująca płyty. Każda pozycja to
 * jedna fizyczna płyta z placu: zdjęcie, wymiar, grubość i gotowa cena.
 *
 * Moduł jest CZYSTY — bez DOM-u i bez sieci. Dostaje gotową listę płyt
 * (pobiera ją `wyprzedaz-dane.js`) i zwraca kształty, które rozumie reszta
 * kreatora. Dzięki temu testuje się go w gołym node, tak samo jak silnik.
 */
import { kluczDekoru } from './wyprzedaz-klucz.js';
import { FIRMY, firmaWgSlug } from '../firms/index.js';

/** Slug pseudo-firmy. Musi być stały — kreator porównuje po nim `stan.firma`. */
export const SLUG = 'wyprzedaz';

export const NAZWA = 'NATURA WYPRZEDAŻ';

/** Płyta jest do wzięcia, gdy jest opublikowana i coś jeszcze zostało. */
export function dostepna(p) {
  return !!p && p.opublikowana !== false && Number(p.plytZostalo) > 0;
}

/**
 * Płyty do pokazania klientowi — dostępne, najtańsze za m² na początku.
 *
 * Kolejność „od najtańszej" jest celowa: wyprzedaż ogląda się dla ceny,
 * więc pierwsza karta ma odpowiadać na pytanie, po co klient tu wszedł.
 */
export function doPokazania(plyty) {
  return (plyty || []).filter(dostepna).sort((a, b) => a.cenaM2 - b.cenaM2);
}

/**
 * Cena Dawida (brutto) → netto, w jakim silnik trzyma każdy cennik.
 *
 * Stawka źródłowa to VAT TOWAROWY (23%), nie stawka sprzedaży — dokładnie
 * tak samo, jak przy ręcznej cenie kamienia naturalnego. Gdyby dzielić
 * przez stawkę sprzedaży, cena płyty zmieniałaby się sama przy przejściu
 * z montażu (8%) na odbiór własny (23%), a to ta sama płyta i ta sama kwota.
 */
export function cenaNettoM2(p, vatZrodla = 0.23) {
  return Number(p.cenaM2) / (1 + vatZrodla);
}

/** Metry kwadratowe jednej płyty — do „cena za całą płytę" na karcie. */
export function m2Plyty(p) {
  return (Number(p.plytaDlCm) * Number(p.plytaGlCm)) / 10_000;
}

/** Ile klient zapłaci za sam materiał, gdy weźmie tę jedną płytę. */
export function cenaCalejPlyty(p) {
  return Math.round(m2Plyty(p) * Number(p.cenaM2));
}

/** Ile procent taniej niż „było" — null, gdy Dawid nie podał ceny normalnej. */
export function upustProcent(p) {
  const normalna = Number(p.cenaNormalnaM2) || 0;
  if (!(normalna > Number(p.cenaM2))) return null;
  return Math.round((1 - Number(p.cenaM2) / normalna) * 100);
}

/**
 * Ile FIZYCZNYCH płyt leży na placu — suma sztuk, nie liczba pozycji.
 *
 * ⚠ To nie to samo, co `doPokazania(plyty).length`. Jedna pozycja może
 * mieć osiem sztuk tego samego wzoru i klientowi trzeba powiedzieć „8 płyt",
 * a nie „1 płyta" — inaczej wyprzedaż wygląda na resztkę, którą ktoś już
 * sprzątnął sprzed nosa.
 */
export function plytNaPlacu(plyty) {
  return doPokazania(plyty).reduce((suma, p) => suma + (Number(p.plytZostalo) || 0), 0);
}

/**
 * HASŁO WYPRZEDAŻY — treść paska nad rozmową, kafelka przy wyborze
 * materiału i banera na stronie głównej (zlecenie Dawida, 01.09.2026:
 * „ciężko znaleźć wyprzedaż, a to powinno być aż KRZYKLIWE").
 *
 * Jedna funkcja, bo trzy miejsca muszą mówić DOKŁADNIE to samo. Gdyby
 * każde liczyło po swojemu, prędzej czy później baner obiecywałby −40%,
 * a karta pokazywała −25% — i to klient wyłapałby to pierwszy.
 *
 * Zwraca `null`, gdy Dawid nic nie wystawił. Wtedy nigdzie nie ma paska,
 * kafelka ani banera — nie krzyczymy o pustym placu.
 *
 * @param {Array} plyty  surowa lista z `/wyprzedaz`
 */
export function hasloWyprzedazy(plyty) {
  const widoczne = doPokazania(plyty);
  if (!widoczne.length) return null;

  const upusty = widoczne.map(upustProcent).filter((u) => u !== null);
  const sztuk = plytNaPlacu(plyty);

  return {
    /* Ile sztuk — to jest licznik, który widzi klient. */
    sztuk,
    /* Ile różnych wzorów — do liczby mnogiej w nocie. */
    pozycji: widoczne.length,
    /*
     * NAJWIĘKSZY upust, nie średni. Pasek zapowiada „nawet −43%",
     * a nie „średnio −31%" — i tak jest uczciwie, dopóki taka płyta
     * naprawdę leży na placu. Gdy Dawid nie podał ceny „było" przy
     * żadnej płycie, upustu nie ma i pasek o nim nie wspomina.
     */
    upust: upusty.length ? Math.max(...upusty) : null,
    tytul: 'WYPRZEDAŻ PŁYT',
    nota:
      sztuk === 1
        ? 'ostatnia płyta z placu — konkretna sztuka w niższej cenie'
        : `${sztuk} ${formaPlyty(sztuk)} z placu — konkretne sztuki w niższej cenie`,
    akcja: 'Zobacz płyty',
  };
}

/** „3 płyty" / „1 płyta" — ta sama odmiana, co w opisie rozkroju. */
export function formaPlyty(n) {
  const liczba = Number(n) || 0;
  if (liczba === 1) return 'płyta';
  if (liczba > 1 && liczba < 5) return 'płyty';
  return 'płyt';
}

/**
 * Zastrzeżenie widoczne przy wycenie z wyprzedaży — ten sam tekst
 * co na karcie płyty, żeby klient nie zobaczył dwóch różnych obietnic.
 */
export function notaPlyty(p) {
  return (
    `Cena wyprzedażowa konkretnej płyty z magazynu. ${
      p.plytZostalo === 1 ? 'Została ostatnia sztuka' : `Zostało ${p.plytZostalo} ${formaPlyty(p.plytZostalo)}`
    } — prosimy potwierdzić dostępność przed zamówieniem.`
  );
}

/**
 * PSEUDO-FIRMA „NATURA WYPRZEDAŻ" dla silnika wyceny.
 *
 * Jedna firma, wiele dekorów — każdy dekor to jedna płyta z magazynu.
 * Silnik obsługuje to bez żadnej zmiany, bo wpis cennika może mieć postać
 * `{ cena, plyta }` (patrz `firms/index.js#cenaWpisu` i `engine/wycena.js`),
 * a więc każda płyta niesie SWÓJ format — a tu każda jest inna.
 *
 * ⚠ `robocizna`, `opcje`, `vat` i `cenyUslug` MUSZĄ pochodzić z REALNEJ firmy
 * z `FIRMY`, nie z gołych stałych w `_domyslne.js`. Powód:
 * `app/ustawienia.js#zastosujUstawienia` nakłada stawki z panelu Dawida
 * na `robocizna`/`opcje` KAŻDEJ firmy z osobna (nowa tablica per firma),
 * ale NIGDY nie dotyka gołych stałych — te zostają zamrożone na wartościach
 * z kodu. Kategoria zbudowana wprost ze stałych liczyłaby obróbkę „w cenie"
 * (0 zł) nawet wtedy, gdy Dawid ustawił w panelu inną stawkę, i cichcem
 * różniłaby się od każdego innego materiału w aplikacji.
 *
 * @param {Array} plyty  lista z `/wyprzedaz` (już przefiltrowana albo nie)
 */
export function firmaWyprzedazy(plyty) {
  const widoczne = doPokazania(plyty);
  const stawki = FIRMY[0];
  const vatZrodla = stawki?.vatCenZrodlowych ?? 0.23;

  const dekory = {};
  for (const p of widoczne) {
    dekory[kluczDekoru(p)] = {
      [String(p.gruboscMm)]: {
        // ⚠ Cennik w silniku jest NETTO — tak wygląda każdy wpis
        // w `src/generated/*.json`. Dawid wpisuje kwotę BRUTTO (tę, którą
        // ma zobaczyć klient), więc sprowadzamy ją tutaj, raz, po stawce
        // towarowej. Bez tego wyprzedaż byłaby o 23% droższa, niż Dawid
        // ustawił — i to bez żadnego śladu w interfejsie.
        cena: cenaNettoM2(p, vatZrodla),
        // Każda płyta ma własny format — to jest cały sens tej kategorii.
        plyta: {
          w: Number(p.plytaDlCm),
          h: Number(p.plytaGlCm),
          // Resztka magazynowa jest jedna i cała. Nie ma z czego wziąć
          // „połówki", więc rozkrój nie ma prawa na nią liczyć.
          polowkaDozwolona: false,
        },
      },
    };
  }

  return {
    slug: SLUG,
    nazwa: NAZWA,
    typ: 'ostatnie sztuki z placu',
    kolejnosc: 45, // tuż za kamieniem naturalnym (40)

    krotki: 'Konkretne płyty z magazynu w niższej cenie — póki są.',
    opis:
      'Pojedyncze płyty, które zostały z większych zamówień albo czekają na placu dłużej, ' +
      'niż powinny. Każda jest jedna — ze zdjęciem, wymiarem i ceną podaną wprost. ' +
      'Kiedy płyta schodzi, znika też z kalkulatora.',

    // Cena jest w cenniku (powyżej), więc to zwykły tryb cennikowy — klient
    // niczego nie wpisuje. Kwota pochodzi wprost od Dawida i nie jest
    // przeliczana żadną marżą; jedyne, co z nią robimy, to sprowadzenie
    // brutto → netto w `cenaNettoM2`.
    trybCeny: 'cennik',
    // Resztkę magazynową sprzedajemy w całości — klient kupuje TĘ płytę,
    // nie metry z niej. Stąd rozliczenie „na płyty", nie „na metraż".
    rozliczenieMaterialu: 'plyty',
    wymagaKoduPlyty: false,

    vat: stawki?.vat ?? 0.23,
    vatCenZrodlowych: stawki?.vatCenZrodlowych ?? 0.23,
    cenyUslug: stawki?.cenyUslug || 'brutto',
    robocizna: stawki?.robocizna || [],
    opcje: stawki?.opcje || [],

    // Odpad i dodatek za obróbkę zależą od tego, CZYM ta płyta jest.
    // Przy płycie bez wskazanego cennika trzymamy wartości bezpieczne
    // dla kamienia naturalnego — bo tak najczęściej wygląda resztka z placu.
    narzutOdpad: 0.1,
    obrobkaNaturalnaZaM2: 0,

    plyta: { w: 300, h: 180, polowkaDozwolona: false },
    dekory,

    // Metadane per płyta — kreator i strona sięgają tu po zdjęcie, opis,
    // liczbę sztuk i kod magazynowy. Silnik ich nie czyta.
    plytyWyprzedazy: widoczne,
  };
}

/**
 * Klucz dekoru = nazwa płyty. Gdy Dawid ma dwie płyty o tej samej nazwie
 * (a ma prawo — dwie sztuki tego samego granitu w różnym wymiarze),
 * doklejamy numer, żeby druga nie nadpisała pierwszej w `dekory`.
 */
/*
 * `kluczDekoru` mieszka w osobnym pliku bez zależności, bo tej samej reguły
 * potrzebuje WORKER (podaje asystentowi dokładną nazwę do wyceny), a tego
 * modułu worker zaimportować nie może — ciągnie rejestr firm przez
 * `import.meta.glob`. Re-eksport zostaje, żeby reszta kodu nic nie zauważyła.
 */
export { kluczDekoru };

/**
 * Płyta rozpoznana z tego, CO NAPISAŁ MODEL — a nie z dokładnego klucza.
 *
 * ⚠ Powód (błąd zgłoszony 01.09.2026): asystent podawał „Taj Mahal Light
 * Konglomerat Kwarcowy", a klucz dekoru to „Taj Mahal Light Konglomerat
 * Kwarcowy #6". Dokładne porównanie nie trafiało i klient dostawał
 * „nie znam dekoru" tuż po zdaniu, że wycena jest gotowa.
 *
 * Kolejność prób jest ważna: najpierw dokładny klucz (jedyna forma pewna
 * w 100%), potem sama nazwa, na końcu zawieranie. Gdy pasuje więcej niż
 * jedna płyta, NIE zgadujemy — dwie sztuki o tej samej nazwie to dwie różne
 * ceny i dwie różne dostępności, więc lepiej dopytać niż wycenić losową.
 */
export function plytaZTekstu(plyty, tekst) {
  const szukane = String(tekst || '').trim().toLowerCase();
  if (!szukane) return null;
  const widoczne = doPokazania(plyty);

  const dokladne = widoczne.find((p) => kluczDekoru(p).toLowerCase() === szukane);
  if (dokladne) return dokladne;

  const poNazwie = widoczne.filter((p) => String(p.nazwa).toLowerCase() === szukane);
  if (poNazwie.length === 1) return poNazwie[0];
  if (poNazwie.length > 1) return null;

  const zawiera = widoczne.filter(
    (p) =>
      szukane.includes(String(p.nazwa).toLowerCase()) ||
      String(p.nazwa).toLowerCase().includes(szukane)
  );
  return zawiera.length === 1 ? zawiera[0] : null;
}

/** Odwrotność `kluczDekoru` — z wybranego dekoru z powrotem do płyty. */
export function plytaWgDekoru(plyty, dekor) {
  return doPokazania(plyty).find((p) => kluczDekoru(p) === dekor) || null;
}

/**
 * Firma, po której wyprzedażowa płyta dziedziczy charakter materiału.
 * Bierzemy stąd narzut odpadu i dodatek za obróbkę kamienia naturalnego —
 * nigdy cenę. Gdy Dawid nie wskazał cennika, zostają wartości domyślne
 * z `firmaWyprzedazy`.
 */
export function charakterPlyty(p) {
  const firma = p?.firmaSlug ? firmaWgSlug(p.firmaSlug) : null;
  return {
    narzutOdpad: firma?.narzutOdpad ?? 0.1,
    obrobkaNaturalnaZaM2: firma?.obrobkaNaturalnaZaM2 ?? 0,
    linkDekory: firma?.linkDekory || null,
    typ: firma?.typ || '',
  };
}

/**
 * Firma dla JEDNEJ konkretnej płyty — tego używa silnik przy liczeniu
 * wyceny, bo narzut odpadu i dodatek za obróbkę są cechą TEJ płyty,
 * a nie całej kategorii.
 */
export function firmaDlaPlyty(plyty, dekor) {
  const bazowa = firmaWyprzedazy(plyty);
  const plyta = plytaWgDekoru(plyty, dekor);
  if (!plyta) return bazowa;

  const charakter = charakterPlyty(plyta);
  return {
    ...bazowa,
    narzutOdpad: charakter.narzutOdpad,
    obrobkaNaturalnaZaM2: charakter.obrobkaNaturalnaZaM2,
    linkDekory: charakter.linkDekory,
    notaKlient: notaPlyty(plyta),
    // Kod magazynowy trafia na kartę wyceny i w temat maila — tak samo
    // jak przy kamieniu naturalnym, żeby Dawid od razu wiedział, o którą
    // płytę z placu chodzi.
    kodPlytyWyceny: plyta.kodPlyty || '',
  };
}

/**
 * Czy z tej płyty w ogóle da się zrobić ten blat.
 *
 * Wyprzedaż ma SKOŃCZONĄ liczbę sztuk — jeśli rozkrój potrzebuje więcej
 * płyt, niż Dawid ma na placu, wycena byłaby obietnicą bez pokrycia.
 * Zwracamy komunikat zamiast kwoty.
 *
 * Wołaj to przez `ostrzezenieOWyprzedazy` niżej, nie wprost — tamta funkcja
 * sama wyciąga liczbę płyt z gotowej wyceny i pilnuje, żeby dotyczyło to
 * WYŁĄCZNIE wyprzedaży.
 *
 * @param {object} plyta   pozycja wyprzedaży
 * @param {number} plytPotrzeba  ile płyt wyszło z rozkroju
 */
export function brakuje(plyta, plytPotrzeba) {
  if (!plyta) return null;
  const potrzeba = Math.ceil(Number(plytPotrzeba) || 0);
  if (potrzeba <= Number(plyta.plytZostalo)) return null;
  return (
    `Ten blat wymaga ${potrzeba} ${formaPlyty(potrzeba)}, a z tej wyprzedaży ` +
    `${plyta.plytZostalo === 1 ? 'została 1 płyta' : `zostało ${plyta.plytZostalo} ${formaPlyty(plyta.plytZostalo)}`}. ` +
    'Prosimy o kontakt — dobierzemy materiał albo sprawdzimy, czy da się inaczej rozłożyć blat.'
  );
}

/**
 * OSTRZEŻENIE DO GOTOWEJ WYCENY — jedyne miejsce, z którego wołamy `brakuje`.
 *
 * ⚠ POWÓD POWSTANIA (30.08.2026, przegląd produkcji): `brakuje` istniało
 * i miało własne testy, ale NIGDZIE nie było wywoływane. Skutek na żywo:
 * blat z dwóch odcinków 300×90 cm liczył się z DWÓCH płyt wyprzedażowych,
 * mimo że Dawid miał na placu jedną — klient dostawał kwotę za materiał,
 * którego nie ma. Test jednostkowy funkcji nie wystarczy, jeśli nikt jej
 * nie woła; stąd ta funkcja i test na CAŁEJ ścieżce wyceny.
 *
 * @param {object} w      wynik `wycen()`
 * @param {Array}  plyty  lista z `/wyprzedaz`
 * @returns {string|null} komunikat do `w.ostrzezenia` albo null
 */
export function ostrzezenieOWyprzedazy(w, plyty) {
  if (!w?.ok || w.firma?.slug !== SLUG) return null;
  const plyta = plytaWgDekoru(plyty, w.dekor);
  if (!plyta) return null;
  // Rozkrój liczy pełne płyty i ewentualną połówkę; przy wyprzedaży
  // połówki nie ma (`polowkaDozwolona: false`), ale liczymy ostrożnie.
  const potrzeba = (w.pak?.plytyPelne || 0) + (w.pak?.polowka ? 1 : 0);
  return brakuje(plyta, potrzeba);
}

/**
 * Rozbiera fragment `#wyprzedazPodglad=<base64>` z linku podglądu (panel).
 * Czyste — bierze gotowy string, nie czyta `location.hash` samo, żeby dało
 * się to przetestować w node.
 *
 * @param {string} hash  np. `location.hash`
 * @returns {{podgladId:number, exp:number, podpis:string}|null}
 */
export function paczkaPodgladu(hash) {
  const m = String(hash || '').match(/^#wyprzedazPodglad=([A-Za-z0-9_-]+)$/);
  if (!m) return null;
  try {
    const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
    const bajty = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const paczka = JSON.parse(new TextDecoder().decode(bajty));
    return paczka?.podgladId && paczka?.exp && paczka?.podpis ? paczka : null;
  } catch {
    return null;
  }
}

/* ═══════════════════ KATEGORIE, TYPY I FILTROWANIE (01.09.2026) ═══════════
 *
 * Zlecenie Dawida: przy kilkudziesięciu płytach jedna długa lista przestaje
 * być ofertą, a zaczyna być spisem z magazynu. Klient ma móc zawęzić ją do
 * tego, czego szuka: rodzaju materiału, typu płyty albo nazwy wzoru.
 */

/** Kategorie materiału — te same trzy, co w panelu i w bazie. */
export const KATEGORIE = [
  { id: 'spiek', nazwa: 'Spieki' },
  { id: 'naturalny', nazwa: 'Kamienie naturalne' },
  { id: 'konglomerat', nazwa: 'Konglomeraty' },
];

/**
 * Typ płyty.
 *
 * „Pozostałość z produkcji" to formatka po wcześniejszym zleceniu: wymiar
 * nietypowy, cena niższa, sztuka jedna. Dla kupującego to zupełnie inna
 * oferta niż pełna płyta i musi być widoczna od pierwszego spojrzenia —
 * nikt nie może przez pomyłkę policzyć dużej kuchni z formatki 90 × 60.
 */
export const TYPY = [
  { id: 'pelna', nazwa: 'Pełne płyty', krotko: 'pełna płyta' },
  { id: 'poprodukcyjna', nazwa: 'Pozostałości z produkcji', krotko: 'Pozostałość z produkcji' },
];

export function etykietaKategorii(id) {
  return KATEGORIE.find((k) => k.id === id)?.nazwa || '';
}

export function etykietaTypu(id) {
  return TYPY.find((t) => t.id === id)?.krotko || '';
}

/** Czy płyta czeka na uzupełnienie kategorii albo typu (widok panelu). */
export function doUzupelnienia(p) {
  const braki = [];
  if (!p?.kategoria) braki.push('kategoria');
  if (!p?.typ) braki.push('typ');
  return braki;
}

/**
 * Filtrowanie listy dla klienta.
 *
 * ⚠ Płyta BEZ kategorii (wystawiona przed 01.09.2026) nie wpada do żadnego
 * kafelka kategorii — i tak ma być. Zgadywanie za Dawida, że „Taj Mahal
 * Konglomerat Kwarcowy" to konglomerat, byłoby wpisywaniem mu do oferty
 * rzeczy, których nie potwierdził. Takie płyty widać pod „Wszystkie",
 * a panel prosi go o uzupełnienie.
 *
 * @param {Array} plyty
 * @param {object} f  { kategoria, typ, szukaj }
 */
export function filtruj(plyty, f = {}) {
  const szukaj = String(f.szukaj || '').trim().toLowerCase();

  return doPokazania(plyty).filter((p) => {
    if (f.kategoria && p.kategoria !== f.kategoria) return false;
    if (f.typ && p.typ !== f.typ) return false;
    if (!szukaj) return true;
    // Szukamy po tym, co klient widzi na karcie: nazwa, dopisek, numer.
    return `${p.nazwa} ${p.opis || ''} ${p.kodPlyty || ''}`.toLowerCase().includes(szukaj);
  });
}

/**
 * Ile płyt kryje się pod każdym kafelkiem — liczby przy filtrach.
 * Kafelek, który po kliknięciu daje pustą listę, tylko marnuje klikanie,
 * więc puste kategorie w ogóle się nie pokazują.
 */
export function policzWKategoriach(plyty, f = {}) {
  const bezKategorii = { ...f, kategoria: null };
  return KATEGORIE.map((k) => ({
    ...k,
    ile: filtruj(plyty, { ...bezKategorii, kategoria: k.id }).length,
  })).filter((k) => k.ile > 0);
}

export function policzWTypach(plyty, f = {}) {
  const bezTypu = { ...f, typ: null };
  return TYPY.map((t) => ({
    ...t,
    ile: filtruj(plyty, { ...bezTypu, typ: t.id }).length,
  })).filter((t) => t.ile > 0);
}

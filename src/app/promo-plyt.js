/**
 * PROMOCJE „OSTATNIE PŁYTY" — wspólna logika dla banera i wyceny.
 *
 * Zlecenie Dawida (27.08.2026): wyprzedaż resztek magazynowych. Dawid ma
 * fizycznie ograniczoną liczbę sztuk jednej płyty, ustawia GOTOWĄ cenę dla
 * klienta (zł/m² brutto — silnik NIE dokłada do niej żadnej marży) i sam
 * zmniejsza licznik w panelu, bo sprzedaje też poza kalkulatorem.
 *
 * To NIE JEST to samo, co kampanie dostawców z app/promocje-lista.js —
 * tamte to rabat na cały dekor z cennika, tu jedna fizyczna partia płyt
 * Dawida. Osobne moduły, żeby nikt tego nie pomylił.
 *
 * Moduł jest czysty (bez DOM-u, bez sieci) — importuje tylko FIRMY (do
 * odtworzenia realnego materiału, gdy promocja odwołuje się do dekoru
 * z cennika) i silnik wyceny, więc daje się przetestować w gołym node.
 */
import { FIRMY, firmaWgSlug } from '../firms/index.js';
import { wycen } from '../engine/wycena.js';

/** Poniżej tej oszczędności cross-sell nie jest argumentem — szum, nie okazja. */
export const MINIMALNA_OSZCZEDNOSC = 200;

/** Czy promocja jest dziś aktywna: są sztuki i (jeśli podano) nie minął termin. */
export function aktywna(promo, dataISO) {
  if (!promo) return false;
  if (!(Number(promo.plytZostalo) > 0)) return false;
  const dzis = dataISO || new Date().toISOString().slice(0, 10);
  if (promo.dataKonca && dzis > promo.dataKonca) return false;
  return true;
}

/** Promocje do pokazania na banerze — aktywne, najpilniejsze (kończą się najszybciej) pierwsze. */
export function doBanera(promocje, dataISO) {
  return (promocje || [])
    .filter((p) => aktywna(p, dataISO))
    .sort((a, b) => {
      const da = a.dataKonca || '9999-99-99';
      const db = b.dataKonca || '9999-99-99';
      return da === db ? 0 : da < db ? -1 : 1;
    });
}

/**
 * Pseudo-firma dla silnika wyceny — jedna konkretna, fizyczna partia płyt.
 *
 * Gdy promocja wskazuje realny dekor z cennika (`firmaSlug`+`dekor`),
 * dziedziczymy po nim rodzaj materiału, link do zdjęć i narzut odpadu —
 * ale CENA i tak jest ta z promocji, nigdy z cennika (`trybCeny: 'reczna'`
 * pomija `firma.dekory` w silniku całkowicie).
 *
 * Bez wskazanego dekoru (Dawid wpisał „płytę własną") bazą jest DOWOLNA
 * REALNA firma z cennika, nie gołe stałe z `_domyslne.js`. To nie jest
 * kosmetyka: `app/ustawienia.js#zastosujUstawienia` nakłada stawki
 * z panelu Dawida na `robocizna`/`opcje` KAŻDEJ firmy z osobna (nowa
 * tablica per firma), ale NIGDY nie dotyka gołych stałych `ROBOCIZNA`/
 * `OPCJE` — te zostają zamrożone na wartościach z kodu. Płyta własna
 * budowana wprost z tamtych stałych liczyłaby więc obróbkę „w cenie"
 * (0 zł) nawet wtedy, gdy Dawid ustawił w panelu 200 zł/m² — i różniłaby
 * się cichcem od każdego innego materiału w aplikacji. Złapane testem
 * przy pisaniu tego modułu (27.08.2026), nie na produkcji.
 */
export function firmaZPromocji(promo) {
  // Firma wskazana przez Dawida — TYLKO wtedy dziedziczymy jej tożsamość
  // (rodzaj materiału, link do zdjęć, narzut odpadu, dodatek za obróbkę
  // kamienia naturalnego). Przy „płycie własnej" te pola muszą zostać
  // generyczne — nic nie mówi, że resztka ma tyle samo odpadu, co akurat
  // pierwsza firma w tablicy.
  const zywaFirma = promo.firmaSlug ? firmaWgSlug(promo.firmaSlug) : null;
  // Stawki NASZEJ pracy (obróbka, montaż, wycięcia) — te są takie same dla
  // każdego materiału, więc bierzemy je z DOWOLNEJ realnej firmy: byle
  // realnej, nie z gołych stałych `_domyslne.js` (patrz komentarz niżej).
  const zywaFirmaStawki = zywaFirma || FIRMY[0];

  return {
    typ: zywaFirma?.typ || 'promocja',
    vat: zywaFirmaStawki?.vat ?? 0.23,
    cenyUslug: zywaFirmaStawki?.cenyUslug || 'brutto',
    // ⚠ `robocizna`/`opcje` MUSZĄ pochodzić z realnej firmy z `FIRMY`, nie
    // z gołych stałych `ROBOCIZNA`/`OPCJE` w `_domyslne.js`. Powód:
    // `app/ustawienia.js#zastosujUstawienia` nakłada stawki z panelu
    // Dawida na `robocizna`/`opcje` KAŻDEJ firmy z osobna (nowa tablica
    // per firma), ale NIGDY nie dotyka gołych stałych — te zostają
    // zamrożone na wartościach z kodu. Firma budowana wprost z tamtych
    // stałych liczyłaby obróbkę „w cenie" (0 zł) nawet wtedy, gdy Dawid
    // ustawił w panelu 200 zł/m² — i cichcem różniłaby się od każdego
    // innego materiału w aplikacji. Złapane testem przy pisaniu tego
    // modułu (27.08.2026), nie na produkcji.
    robocizna: zywaFirmaStawki?.robocizna || [],
    opcje: zywaFirmaStawki?.opcje || [],
    narzutOdpad: zywaFirma?.narzutOdpad ?? 0.1,
    obrobkaNaturalnaZaM2: zywaFirma?.obrobkaNaturalnaZaM2 ?? 0,
    linkDekory: zywaFirma?.linkDekory || null,

    slug: `promo-${promo.id}`,
    nazwa: promo.nazwa,
    krotki: promo.opisMaterial || promo.nazwa,
    trybCeny: 'reczna',
    // Cena Dawida jest już gotowa dla klienta, brutto — silnik rozlicza ją
    // przez stawkę źródłową 23% (tak samo jak każdą inną ręczną cenę
    // w aplikacji), a dopiero potem dolicza VAT właściwy dla wariantu
    // sprzedaży. Patrz engine/wycena.js i app/wycena-naturalny.js.
    cenaRecznaJest: 'brutto',
    rozliczenieMaterialu: 'plyty',
    wymagaKoduPlyty: false,
    plyta: { w: promo.plytaDlCm, h: promo.plytaGlCm, polowkaDozwolona: false },
    opisGrubosci: { [String(promo.gruboscMm)]: `${promo.gruboscMm} mm` },
    notaKlient: notaPromocji(promo),
  };
}

/** Zastrzeżenie widoczne w wycenie — dokładnie ten sam tekst co dopisek na banerze. */
export function notaPromocji(promo) {
  const koniec = promo.dataKonca ? ` albo do ${dataPl(promo.dataKonca)}` : '';
  return (
    `Cena promocyjna — do wyczerpania płyt${koniec}. Zostało ${promo.plytZostalo} ` +
    `${formaPlyty(promo.plytZostalo)} — prosimy potwierdzić dostępność przed zamówieniem.`
  );
}

/**
 * Policzenie promocji na TYCH SAMYCH wymiarach i opcjach, co bieżąca wycena.
 * Zwraca wynik `wycen()` albo null, gdy się nie da (np. blat głębszy niż
 * płyta promocyjna).
 */
export function wycenPromocje(promo, { odcinki, opcje }) {
  const w = wycen(firmaZPromocji(promo), {
    // Pusty dekor CELOWO: przy promocji nazwa materiału i nazwa dekoru to
    // to samo (Dawid ma jeden tytuł, nie markę + wzór osobno). Wszędzie,
    // gdzie kod skleja „firma.nazwa · dekor" (karta klienta, mail leadowy,
    // temat maila), pusty dekor sam znika z tego zdania — inaczej wyszłoby
    // dwa razy to samo: „TEST — ostatnie płyty · TEST — ostatnie płyty".
    dekor: '',
    grubosc: String(promo.gruboscMm),
    odcinki,
    opcje,
    cenaRecznaM2: promo.cenaPromoM2,
  });
  return w.ok ? w : null;
}

/**
 * Dyskretna podpowiedź pod wyceną INNEGO materiału: „ta sama kuchnia
 * z płyty promocyjnej wyszłaby o X zł taniej". Liczymy WSZYSTKIE aktywne
 * promocje na dokładnie tych samych odcinkach i opcjach klienta i bierzemy
 * tę z największą oszczędnością — jedna, dyskretna linijka, nie lista.
 *
 * Nic nie pokazujemy, gdy klient i tak ogląda już wycenę promocyjną
 * (`w.firma.slug` zaczyna się od „promo-") — podpowiadanie mu tej samej
 * płyty byłoby bez sensu.
 */
export function podpowiedzPromocji(w, promocje, dataISO) {
  if (!w?.ok || String(w.firma?.slug || '').startsWith('promo-')) return null;

  let najlepsza = null;
  for (const promo of doBanera(promocje, dataISO)) {
    const wPromo = wycenPromocje(promo, { odcinki: w.odcinki, opcje: w.opcje });
    if (!wPromo) continue;
    const oszczednosc = Math.round((w.razemZaokr ?? w.razem) - (wPromo.razemZaokr ?? wPromo.razem));
    if (oszczednosc < MINIMALNA_OSZCZEDNOSC) continue;
    if (!najlepsza || oszczednosc > najlepsza.oszczednosc) najlepsza = { promo, wPromo, oszczednosc };
  }
  return najlepsza;
}

/** „3 płyty” / „1 płyta” — ta sama prostota co pakowanie.js#opisPlyt, żeby nie mnożyć konwencji odmiany. */
export function formaPlyty(n) {
  const liczba = Number(n) || 0;
  if (liczba === 1) return 'płyta';
  if (liczba > 1 && liczba < 5) return 'płyty';
  return 'płyt';
}

/** „2026-09-30" → „30.09.2026" — data w banerze i nocie ma być czytelna od razu. */
export function dataPl(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : String(iso || '');
}

/**
 * Rozbiera fragment `#promoPodglad=<base64>` z linku podglądu (panel).
 * Czyste — bierze gotowy string, nie czyta `location.hash` samo, żeby dało
 * się to przetestować w node tak samo jak `paczkaPowtorki` w oferta-dawida.js.
 *
 * @param {string} hash  np. `location.hash`
 * @returns {{podgladId:number, exp:number, podpis:string}|null}
 */
export function paczkaPodgladu(hash) {
  const m = String(hash || '').match(/^#promoPodglad=([A-Za-z0-9_-]+)$/);
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

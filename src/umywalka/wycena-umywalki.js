/**
 * CENA UMYWALKI — materiał z silnika blatów, robocizna z panelu Dawida.
 *
 * Nie ma tu drugiego silnika wyceny i nie może go być. Materiał liczy
 * `wycen()` z `src/engine/wycena.js`: on zna cennik, promocje (z regułą
 * „tańsza wygrywa"), format płyty i to, że Keralini oraz Avant wolno kupić
 * w POŁÓWCE 320 × 80. Przy umywalce to nie detal — połówka zamiast całej
 * płyty to różnica rzędu dwóch tysięcy złotych na jednej sztuce.
 *
 * Z wyniku silnika bierzemy WYŁĄCZNIE pozycję materiału. Reszta jego
 * pozycji dotyczy blatu kuchennego (wycięcie pod zlew podblatowy, pod płytę
 * grzewczą, obróbka od metra blatu) i do umywalki się nie stosuje — tutaj
 * robocizna to pogrubienie krawędzi, niecka, otwory i montaż.
 *
 * Stawki robocizny są zapisane BRUTTO PRZY 23% — taka jest konwencja całego
 * repozytorium (patrz `firms/_domyslne.js#zCennika`). Silnik schodzi z nich
 * na netto i nalicza VAT wariantu, więc umywalka z montażem (8%) jest dla
 * klienta brutto tańsza, zamiast po cichu zostawiać różnicę w zakładzie.
 *
 * ⚠ W tym pliku są wyłącznie ceny dla klienta. Tego, po ile kamień wchodzi
 *   do zakładu, nie ma tu i być nie może — to zostaje w pricing/zrodla,
 *   poza repozytorium.
 */
import { wycen } from '../engine/wycena.js';
import { DOMYSLNE } from '../app/ustawienia.js';
import {
  normalizuj,
  odcinki,
  mbPogrubienia,
  otwory,
  m2Blatu,
  ostrzezeniaWymiarow,
  opisKonfiguracji,
  nieckaStanu,
} from './geometria.js';

const grosze = (n) => Math.round(n * 100) / 100;
const do50 = (n) => Math.round(n / 50) * 50;

/**
 * Stawka z panelu → kwota brutto przy stawce VAT tej wyceny.
 * Dokładnie ta sama konwersja, którą stosuje silnik (`kwotaBrutto`).
 */
function zeStawki(kwota, firma, vat) {
  const wartosc = Number(kwota) || 0;
  if ((firma?.cenyUslug || 'brutto') === 'netto') return wartosc * (1 + vat);
  const vatZrodla = firma?.vatCenZrodlowych ?? 0.23;
  return (wartosc / (1 + vatZrodla)) * (1 + vat);
}

/**
 * @param {object} p
 * @param {object} p.firma    konfiguracja marki (Keralini / Avant Quartz)
 * @param {object} p.stan     konfiguracja klienta (patrz geometria.js)
 * @param {object} [p.stawki] stawki z panelu; brak = wartości domyślne
 * @param {string} [p.dataISO] data wyceny (promocje)
 * @param {boolean} [p.bezAlternatywy] blokada rekurencji dla „tańszej wersji"
 */
export function wycenUmywalke({ firma, stan, stawki, dataISO, bezAlternatywy } = {}) {
  if (!firma) return { ok: false, blad: 'Nie wiem, z jakiego kamienia liczyć.' };

  const s = normalizuj(stan);
  const st = { ...DOMYSLNE, ...(stawki || {}) };
  const kawalkiDoCiecia = odcinki(s);

  // ---------- materiał: silnik blatów, bez żadnych zmian ----------
  const material = wycen(
    firma,
    {
      dekor: s.dekor,
      grubosc: s.grubosc,
      odcinki: kawalkiDoCiecia,
      opcje: {
        dostawa: s.montaz ? 'montaz' : 'odbior',
        // Umywalka jest zawsze w łazience. Dla silnika to informacja, że
        // nie ma tu pomiaru Prolinerem ani podstawy obróbki blatu
        // kuchennego — i tak bierzemy od niego tylko materiał, ale niech
        // liczy to, co jest prawdą.
        pomieszczenie: 'lazienka',
      },
    },
    dataISO
  );

  if (!material.ok) return { ok: false, blad: material.blad };

  const vat = material.stawkaVat;
  const pozycjaMaterialu = material.pozycje.find((p) => p.grupa === 'materiał');
  const materialBrutto = pozycjaMaterialu?.brutto || 0;

  // ---------- robocizna umywalki ----------
  const mb = mbPogrubienia(s);
  const iloscOtworow = otwory(s);
  const powierzchnia = m2Blatu(s);

  const pozycje = [
    {
      id: 'material',
      nazwa: `${firma.nazwa} ${s.dekor}, grubość ${s.grubosc} mm`,
      brutto: materialBrutto,
    },
    {
      id: 'pogrubienie',
      nazwa: 'Pogrubiona krawędź — cięcie, klejenie, polerowanie',
      brutto: zeStawki(st.umywalkaPogrubienieMb, firma, vat) * mb,
      ilosc: mb,
    },
    {
      id: 'niecka',
      nazwa: 'Zlew wycięty w kamieniu — wykonanie i odpływ',
      brutto: s.typ === 'zintegrowana' ? zeStawki(st.umywalkaNiecka, firma, vat) : 0,
    },
    {
      id: 'otwory',
      nazwa: iloscOtworow === 1 ? 'Otwór w blacie' : 'Otwory w blacie',
      brutto: zeStawki(st.otwor, firma, vat) * iloscOtworow,
      ilosc: iloscOtworow,
    },
    {
      id: 'montaz',
      nazwa: 'Transport i montaż u klienta',
      brutto: s.montaz
        ? zeStawki(Number(st.montazBaza) + Number(st.montazZaM2) * powierzchnia, firma, vat)
        : 0,
    },
    {
      id: 'projekt',
      nazwa: 'Projekt 3D i pomiar u klienta',
      brutto: 0,
      wCenie: true,
    },
  ];

  const razem = pozycje.reduce((suma, p) => suma + (p.brutto || 0), 0);

  /*
   * TAŃSZA WERSJA — ta sama płyta jako blat pod umywalkę nablatową.
   *
   * Klient, dla którego zlew w kamieniu jest za drogi, dostaje konkretną
   * alternatywę z kwotą, a nie samo „mamy też tańsze opcje". Liczona tym
   * samym kodem, więc nie może się rozjechać z główną wyceną.
   */
  let tanszaWersja = 0;
  if (!bezAlternatywy && s.typ === 'zintegrowana') {
    const alternatywa = wycenUmywalke({
      firma,
      stan: { ...s, typ: 'nablatowa' },
      stawki,
      dataISO,
      bezAlternatywy: true,
    });
    if (alternatywa.ok) tanszaWersja = alternatywa.razemZaokr;
  }

  return {
    ok: true,
    stan: s,
    firma,
    dekor: s.dekor,
    grubosc: s.grubosc,
    niecka: nieckaStanu(s),
    kawalki: kawalkiDoCiecia,
    pak: material.pak,
    plyta: material.plyta,
    m2Platne: material.m2Platne,
    materialNetto: materialBrutto / (1 + vat),
    promo: material.promo || null,
    oszczednosc: material.oszczednosc || 0,
    stawkaVat: vat,
    pozycje,
    linieKlienta: linieKlienta(pozycje, s, firma),
    razem,
    razemNetto: razem / (1 + vat),
    razemZaokr: do50(razem),
    tanszaWersja,
    opis: opisKonfiguracji(s),
    ostrzezenia: [...ostrzezeniaWymiarow(s), ...(material.ostrzezenia || [])],
  };
}

/**
 * Cztery linie, które widzi klient.
 *
 * Nie pokazujemy ani stawek warsztatu, ani metrów, ani kawałków do
 * wycięcia — rozkrój to know-how zakładu. Klient ma widzieć, za co płaci,
 * w słowach, których sam używa.
 */
function linieKlienta(pozycje, stan, firma) {
  const kwota = (id) => pozycje.find((p) => p.id === id)?.brutto || 0;
  const wykonanie = kwota('pogrubienie') + kwota('niecka') + kwota('otwory');

  const skladniki = ['pogrubiona krawędź'];
  if (stan.typ === 'zintegrowana') skladniki.push('zlew w kamieniu');
  skladniki.push(otwory(stan) === 1 ? 'otwór' : 'otwory');

  return [
    {
      nazwa: `Kamień (${firma.nazwa} ${stan.dekor}, ${stan.grubosc} mm)`,
      brutto: kwota('material'),
    },
    {
      nazwa: `Wykonanie: ${skladniki.join(', ')}`,
      brutto: wykonanie,
    },
    stan.montaz
      ? { nazwa: 'Transport i montaż', brutto: kwota('montaz') }
      : { nazwa: 'Odbiór własny — bez montażu', brutto: 0 },
    {
      nazwa: 'Projekt 3D i pomiar u klienta',
      brutto: 0,
      wCenie: true,
    },
  ];
}

/**
 * Kotwica „od … zł" w kroku 1 (§7.6) — liczona, nie wpisana z palca.
 *
 * Najmniejsza umywalka z najtańszego polecanego kamienia, z montażem.
 * Gdyby kiedyś zmieniły się stawki albo cennik, liczba na stronie zmieni
 * się razem z nimi.
 */
export function cenaOd({ firmy, polecane, stawki, dataISO } = {}) {
  let min = Infinity;

  for (const p of polecane || []) {
    const firma = (firmy || []).find((f) => f.slug === p.marka);
    if (!firma) continue;
    const w = wycenUmywalke({
      firma,
      stan: { typ: 'zintegrowana', L: 80, G: 46, H: 15, dekor: p.dekor, grubosc: p.grubosc, montaz: true },
      stawki,
      dataISO,
      bezAlternatywy: true,
    });
    if (w.ok && w.razemZaokr < min) min = w.razemZaokr;
  }

  return Number.isFinite(min) ? min : 0;
}

export { grosze };

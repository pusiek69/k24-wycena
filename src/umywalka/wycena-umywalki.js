/**
 * CENA UMYWALKI — formatki z modelu, pieniądze z silnika blatów.
 *
 * Projekt Dawida liczył materiał tak: pole formatek + 25% odpadu × stawka
 * za metr. To wygodne, ale nieprawdziwe — kamienia nie kupuje się na metry,
 * tylko w płytach. Keralini i Avant (dystrybucja Architype) pozwalają kupić
 * POŁOWĘ płyty 320 × 160, i właśnie o to toczy się gra: umywalka, która
 * mieści się w połówce, kosztuje materiałowo o około dwa tysiące złotych
 * mniej niż ta o kilka centymetrów dłuższa. Ryczałtowy odpad tego nie widzi.
 *
 * Dlatego materiał liczy `wycen()` z `src/engine` — ten sam silnik, katalog
 * i promocje co kalkulator blatów. Stąd bierzemy WYŁĄCZNIE pozycję materiału;
 * reszta jego pozycji dotyczy blatu kuchennego. Robocizna umywalki to
 * pogrubienie krawędzi, niecka, otwory i montaż — stawkami z panelu Dawida.
 *
 * ⚠ W tym pliku są wyłącznie ceny dla klienta. Tego, po ile kamień wchodzi
 *   do zakładu, nie ma tu i być nie może — to zostaje w pricing/zrodla,
 *   poza repozytorium.
 */
import { wycen } from '../engine/wycena.js';
import { DOMYSLNE } from '../app/ustawienia.js';
import {
  STAN_DOMYSLNY,
  zacisnij,
  formatki,
  odcinki,
  mbPogrubienia,
  m2Blatu,
  iloscZlewow,
  grube,
  opisKonfiguracji,
  ranty,
} from './model.js';

const grosze = (n) => Math.round(n * 100) / 100;
const do50 = (n) => Math.round(n / 50) * 50;

/**
 * Stawka z panelu → kwota brutto przy stawce VAT tej wyceny.
 * Dokładnie ta sama konwersja, którą stosuje silnik (`kwotaBrutto`):
 * stawki są zapisane BRUTTO PRZY 23%, schodzimy na netto i naliczamy VAT
 * wariantu. Dzięki temu montaż w mieszkaniu (8%) jest brutto tańszy dla
 * klienta, zamiast po cichu zostawiać różnicę w zakładzie.
 */
function zeStawki(kwota, firma, vat) {
  const wartosc = Number(kwota) || 0;
  if ((firma?.cenyUslug || 'brutto') === 'netto') return wartosc * (1 + vat);
  const vatZrodla = firma?.vatCenZrodlowych ?? 0.23;
  return (wartosc / (1 + vatZrodla)) * (1 + vat);
}

/**
 * @param {object} p
 * @param {object} p.firma     konfiguracja marki (Keralini / Avant Quartz)
 * @param {object} p.stan      stan konfiguratora (patrz model.js)
 * @param {object} [p.stawki]  stawki z panelu; brak = wartości domyślne
 * @param {string} [p.dataISO] data wyceny (promocje)
 * @param {boolean} [p.bezAlternatywy] blokada rekurencji dla „tańszej wersji"
 */
export function wycenUmywalke({ firma, stan, stawki, dataISO, bezAlternatywy } = {}) {
  if (!firma) return { ok: false, blad: 'Nie wiem, z jakiego kamienia liczyć.' };

  const S = zacisnij({ ...STAN_DOMYSLNY, ...(stan || {}) });
  const st = { ...DOMYSLNE, ...(stawki || {}) };
  const lista = formatki(S);

  // ---------- materiał: silnik blatów, bez żadnych zmian ----------
  const material = wycen(
    firma,
    {
      dekor: S.dekor,
      grubosc: S.grubosc,
      odcinki: odcinki(S),
      opcje: {
        dostawa: S.mont ? 'montaz' : 'odbior',
        // Umywalka jest zawsze w łazience: bez pomiaru Prolinerem
        // i bez podstawy obróbki blatu kuchennego.
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
  const mb = mbPogrubienia(S);
  const zlewy = iloscZlewow(S);
  const powierzchnia = m2Blatu(S);

  const pozycje = [
    {
      id: 'material',
      nazwa: `${firma.nazwa} ${S.dekor}, grubość ${S.grubosc} mm`,
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
      nazwa: zlewy > 1 ? 'Zlewy wycięte w kamieniu' : 'Zlew wycięty w kamieniu',
      brutto: zeStawki(st.umywalkaNiecka, firma, vat) * zlewy,
      ilosc: zlewy,
    },
    {
      id: 'otwory',
      nazwa: S.holes === 1 ? 'Otwór w blacie' : 'Otwory w blacie',
      brutto: zeStawki(st.otwor, firma, vat) * S.holes,
      ilosc: S.holes,
    },
    {
      id: 'montaz',
      nazwa: 'Transport i montaż u klienta',
      brutto: S.mont
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
   * Klient, dla którego zlew w kamieniu jest za drogi, dostaje konkretną
   * kwotę, a nie samo „mamy też tańsze opcje".
   */
  let tanszaWersja = 0;
  if (!bezAlternatywy && S.mode === 'int') {
    const alternatywa = wycenUmywalke({
      firma,
      stan: { ...S, mode: 'top' },
      stawki,
      dataISO,
      bezAlternatywy: true,
    });
    if (alternatywa.ok) tanszaWersja = alternatywa.razemZaokr;
  }

  return {
    ok: true,
    stan: S,
    firma,
    dekor: S.dekor,
    grubosc: S.grubosc,
    formatki: lista,
    m2Formatek: grosze(lista.reduce((s, x) => s + x.m, 0)),
    pak: material.pak,
    plyta: material.plyta,
    m2Platne: material.m2Platne,
    materialNetto: materialBrutto / (1 + vat),
    promo: material.promo || null,
    stawkaVat: vat,
    mb,
    ranty: ranty(S),
    pozycje,
    udzialy: udzialy(pozycje, razem),
    linieKlienta: linieKlienta(pozycje, S, firma),
    razem,
    razemNetto: razem / (1 + vat),
    razemZaokr: do50(razem),
    tanszaWersja,
    opis: opisKonfiguracji(S),
    ostrzezenia: material.ostrzezenia || [],
  };
}

/** Paski udziału pod kwotą — tak jak w projekcie Dawida. */
function udzialy(pozycje, razem) {
  if (!razem) return [];
  return pozycje
    .filter((p) => p.brutto > 0)
    .map((p) => ({ id: p.id, nazwa: p.nazwa, procent: (p.brutto / razem) * 100 }));
}

/**
 * Cztery linie, które widzi klient — bez stawek warsztatu i bez metrów.
 * Klient ma widzieć, za co płaci, w słowach, których sam używa.
 */
function linieKlienta(pozycje, S, firma) {
  const kwota = (id) => pozycje.find((p) => p.id === id)?.brutto || 0;
  const wykonanie = kwota('pogrubienie') + kwota('niecka') + kwota('otwory');

  const skladniki = [];
  if (grube(S)) skladniki.push('pogrubiona krawędź');
  if (S.mode === 'int') skladniki.push(S.n > 1 ? 'dwa zlewy w kamieniu' : 'zlew w kamieniu');
  if (S.holes > 0) skladniki.push(S.holes === 1 ? 'otwór' : 'otwory');

  return [
    {
      nazwa: `Kamień (${firma.nazwa} ${S.dekor}, ${S.grubosc} mm)`,
      brutto: kwota('material'),
    },
    {
      nazwa: skladniki.length ? `Wykonanie: ${skladniki.join(', ')}` : 'Wykonanie',
      brutto: wykonanie,
    },
    S.mont
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
 * Kotwica „od … zł" — liczona, nie wpisana z palca.
 * Najmniejsza umywalka z najtańszego polecanego kamienia, z montażem.
 */
export function cenaOd({ firmy, polecane, stawki, dataISO } = {}) {
  let min = Infinity;

  for (const p of polecane || []) {
    const firma = (firmy || []).find((f) => f.slug === p.marka);
    if (!firma) continue;
    const w = wycenUmywalke({
      firma,
      stan: {
        ...STAN_DOMYSLNY,
        L: 80,
        W: 46,
        sL: 60,
        sW: 31,
        marka: p.marka,
        dekor: p.dekor,
        grubosc: p.grubosc,
        mont: true,
      },
      stawki,
      dataISO,
      bezAlternatywy: true,
    });
    if (w.ok && w.razemZaokr < min) min = w.razemZaokr;
  }

  return Number.isFinite(min) ? min : 0;
}

export { grosze };

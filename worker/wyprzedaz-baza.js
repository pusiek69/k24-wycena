/**
 * WYPRZEDAŻ PŁYT — dostęp do bazy (Cloudflare D1).
 *
 * Zlecenie Dawida (30.08.2026): jeden wiersz = jedna fizyczna płyta
 * z magazynu, ze zdjęciem i GOTOWĄ ceną dla klienta. Płyty pokazują się
 * w kalkulatorze jako osobna kategoria „NATURA WYPRZEDAŻ" (obok kamienia
 * naturalnego) i na stronie /wyprzedaz-plyt.
 *
 * To NIE JEST to samo, co kampanie dostawców (Avant/Caesarstone/Keralini —
 * pricing/zrodla/*.promocje.json, src/app/promocje-lista.js). Tamte to
 * upusty na CAŁY dekor z cennika. Tu — konkretne sztuki z placu Dawida.
 *
 * SZKIC vs PUBLIKACJA: `opublikowana = 0` znaczy, że ani kalkulator, ani
 * strona wyprzedaży płyty nie pokazują. Widzi ją wyłącznie Dawid pod
 * podpisanym linkiem podglądu (`tokenWyprzedazy` w worker.template.js) —
 * i to DOKŁADNIE tym samym kodem, który zobaczy klient. Podgląd nie kłamie,
 * bo nie ma osobnej ścieżki renderowania „dla właściciela".
 */

const teraz = () => new Date().toISOString();

/*
 * Czy wiersz ma zdjęcie / miniaturę.
 *
 * `listaPlyt` NIE POBIERA base64 (patrz niżej), tylko flagi `ma_zdjecie`
 * i `ma_mini`. `plytaPoId` pobiera wiersz w całości. Obie ścieżki muszą
 * dać ten sam wynik, więc pytamy o jedno i o drugie.
 */
const maZdjecie = (w) => !!(w.ma_zdjecie ?? w.zdjecie_dane);
const maMini = (w) => !!(w.ma_mini ?? w.zdjecie_mini);
const wersja = (w) => String(w.zmieniono || '').replace(/[^0-9]/g, '').slice(0, 14);

/** Wiersz z D1 (snake_case) → kształt, jakiego oczekuje front (camelCase). */
function zWiersza(w) {
  return {
    id: w.id,
    nazwa: w.nazwa,
    opis: w.opis || '',
    kodPlyty: w.kod_plyty || '',
    firmaSlug: w.firma_slug || '',
    gruboscMm: w.grubosc_mm,
    plytaDlCm: w.plyta_dl_cm,
    plytaGlCm: w.plyta_gl_cm,
    cenaNormalnaM2: w.cena_normalna_m2,
    cenaM2: w.cena_m2,
    plytRazem: w.plyt_razem,
    plytZostalo: w.plyt_zostalo,
    kategoria: w.kategoria || '',
    typ: w.typ || '',
    /*
     * Front dostaje JEDEN adres zdjęcia, nieważne, czy Dawid wkleił link,
     * czy wgrał plik. Wgrany leży w bazie jako data URI i jest serwowany
     * przez `/wyprzedaz/zdjecie/<id>` — patrz worker.template.js.
     *
     * `?v=` to znacznik zmiany wiersza. Adres zdjęcia jest zbudowany z `id`,
     * więc podmiana zdjęcia w panelu NIE zmieniałaby adresu i klient dalej
     * widziałby stare. Ze znacznikiem możemy trzymać obrazek w cache rok,
     * a i tak każda podmiana dojeżdża natychmiast.
     */
    zdjecie: w.zdjecie_url || (maZdjecie(w) ? `/wyprzedaz/zdjecie/${w.id}?v=${wersja(w)}` : ''),
    /*
     * MINIATURA (~300 px) do listy. Pełne zdjęcie potrafi ważyć 200 kB,
     * więc dwadzieścia kart to były 4 MB na jedno wejście na stronę.
     * Gdy miniatury jeszcze nie ma (płyty sprzed 01.09.2026), oddajemy
     * pełne zdjęcie — lepiej cięższe niż żadne.
     */
    zdjecieMini: w.zdjecie_url
      || (maMini(w) ? `/wyprzedaz/zdjecie/${w.id}?mini=1&v=${wersja(w)}` : '')
      || (maZdjecie(w) ? `/wyprzedaz/zdjecie/${w.id}?v=${wersja(w)}` : ''),
    opublikowana: !!w.opublikowana,
    utworzono: w.utworzono,
    zmieniono: w.zmieniono,
  };
}

/** Płyta jest do kupienia, gdy jest opublikowana i coś jeszcze zostało. */
export const dostepna = (p) => !!p && p.opublikowana && Number(p.plytZostalo) > 0;

/**
 * Lista płyt.
 *
 * @param {object}  opcje
 * @param {boolean} [opcje.wszystkie]  panel: szkice + opublikowane + sprzedane
 * @param {number}  [opcje.dolaczId]   podgląd JEDNEGO szkicu mimo `wszystkie:false`
 *                                     (link podglądu właściciela)
 */
export async function listaPlyt(env, opcje = {}) {
  const { wszystkie = false, dolaczId = null } = opcje;

  /*
   * ⚠ NIE „SELECT *". Kolumny `zdjecie_dane` i `zdjecie_mini` trzymają
   * base64 (do 700 kB na płytę), a lista ich nie potrzebuje — front dostaje
   * ADRES zdjęcia, nie samo zdjęcie. Przy `SELECT *` każde wejście na stronę
   * wyprzedaży czytało z D1 wszystkie zdjęcia naraz i wyrzucało je do kosza:
   * przy dwóch płytach 389 kB, przy pięćdziesięciu byłoby ~10 MB na odsłonę.
   *
   * Zamiast treści bierzemy dwie flagi — tyle wystarczy, żeby zbudować adres.
   */
  let sql = `SELECT id, nazwa, opis, kod_plyty, firma_slug, kategoria, typ,
      grubosc_mm, plyta_dl_cm, plyta_gl_cm, cena_normalna_m2, cena_m2,
      plyt_razem, plyt_zostalo, zdjecie_url,
      length(zdjecie_dane) > 0 AS ma_zdjecie,
      length(zdjecie_mini) > 0 AS ma_mini,
      opublikowana, utworzono, zmieniono
    FROM wyprzedaz_plyt`;
  const wartosci = [];
  if (!wszystkie) {
    if (dolaczId) {
      sql += ` WHERE (opublikowana = 1 OR id = ?)`;
      wartosci.push(Number(dolaczId));
    } else {
      sql += ` WHERE opublikowana = 1`;
    }
  }
  // Najpierw to, co jeszcze jest, potem sprzedane; w obrębie grupy — najnowsze.
  sql += ` ORDER BY (plyt_zostalo > 0) DESC, utworzono DESC`;

  const stmt = env.BAZA.prepare(sql);
  const { results } = wartosci.length ? await stmt.bind(...wartosci).all() : await stmt.all();
  return (results || []).map(zWiersza);
}

export async function plytaPoId(env, id) {
  const w = await env.BAZA.prepare(`SELECT * FROM wyprzedaz_plyt WHERE id = ?`)
    .bind(Number(id))
    .first();
  return w ? zWiersza(w) : null;
}

/**
 * Surowe dane zdjęcia (data URI) — tylko do serwowania obrazka.
 * Osobno od `plytaPoId`, żeby lista płyt nie wlokła za sobą kilkuset
 * kilobajtów base64 przy każdym wejściu na kalkulator.
 */
export async function zdjeciePlyty(env, id, mini = false) {
  const kolumna = mini ? 'zdjecie_mini' : 'zdjecie_dane';
  const w = await env.BAZA.prepare(
    `SELECT ${kolumna} AS dane, zdjecie_dane AS pelne FROM wyprzedaz_plyt WHERE id = ?`
  )
    .bind(Number(id))
    .first();
  // Płyty sprzed 01.09.2026 nie mają miniatury — wtedy oddajemy pełne
  // zdjęcie zamiast 404. Klient ma zobaczyć płytę, a nie pustą ramkę.
  return w?.dane || w?.pelne || '';
}

/**
 * KATEGORIE i TYPY — jedno miejsce prawdy dla panelu, strony i kalkulatora.
 *
 * Puste znaczy „do uzupełnienia": płyty wystawione przed 01.09.2026 nie mają
 * ani kategorii, ani typu, i to jest w porządku — publikacja działa dalej,
 * a panel prosi Dawida o uzupełnienie. Filtry u klienta pokazują takie płyty
 * pod „wszystkie", bo zgadywanie za Dawida byłoby wpisywaniem mu do oferty
 * rzeczy, których nie potwierdził.
 */
export const KATEGORIE = ['spiek', 'naturalny', 'konglomerat'];
export const TYPY = ['pelna', 'poprodukcyjna'];

/** Maksymalny rozmiar wgranego zdjęcia po zmniejszeniu w przeglądarce. */
export const MAX_ZDJECIE_ZNAKOW = 700_000;

/**
 * Zapis — tworzy nową płytę (bez `id`) albo aktualizuje istniejącą.
 *
 * Walidacja jest CELOWO surowa: to jedyne miejsce, gdzie zapisujemy kwotę,
 * którą klient zobaczy wprost. Literówka tutaj wychodzi na stronę od razu
 * i nikt jej po drodze nie przeliczy.
 */
export async function zapiszPlyte(env, dane) {
  const nazwa = String(dane?.nazwa || '').trim();
  if (!nazwa) return { ok: false, blad: 'Podaj nazwę płyty — klient zobaczy ją na karcie.' };

  const plytaDl = Number(dane?.plytaDlCm);
  const plytaGl = Number(dane?.plytaGlCm);
  if (!(plytaDl > 0) || !(plytaGl > 0)) {
    return { ok: false, blad: 'Podaj wymiar płyty (długość × głębokość w cm).' };
  }

  const cena = Number(dane?.cenaM2);
  if (!(cena > 0)) {
    return { ok: false, blad: 'Podaj cenę za m² — gotową, brutto, taką jaką ma zobaczyć klient.' };
  }

  const cenaNormalna = Number(dane?.cenaNormalnaM2) || 0;
  if (cenaNormalna > 0 && cenaNormalna <= cena) {
    return {
      ok: false,
      blad: 'Cena „było" musi być wyższa od wyprzedażowej — inaczej przekreślenie nie ma sensu.',
    };
  }

  const plytRazem = Math.max(1, Math.round(Number(dane?.plytRazem) || 1));
  // Przy tworzeniu „zostało" = „razem"; przy edycji Dawid podaje je wprost.
  // To licznik RĘCZNY — płyty schodzą też przez telefon i na miejscu, więc
  // odejmowanie ich z zamówień online pokazywałoby nieprawdę.
  const plytZostalo =
    dane?.plytZostalo != null ? Math.max(0, Math.round(Number(dane.plytZostalo))) : plytRazem;
  if (plytZostalo > plytRazem) {
    return { ok: false, blad: '„Zostało" nie może być większe niż „razem".' };
  }

  /*
   * Kategoria i typ są NIEOBOWIĄZKOWE — pusty znaczy „jeszcze nie ustalone".
   * Odrzucamy tylko wartości spoza słownika, żeby literówka w panelu nie
   * stworzyła po cichu czwartej kategorii, której żaden filtr nie pokaże.
   */
  const kategoria = String(dane?.kategoria || '').trim();
  if (kategoria && !KATEGORIE.includes(kategoria)) {
    return { ok: false, blad: 'Nieznana kategoria materiału.' };
  }
  const typ = String(dane?.typ || '').trim();
  if (typ && !TYPY.includes(typ)) {
    return { ok: false, blad: 'Nieznany typ płyty.' };
  }

  const zdjecieDane = String(dane?.zdjecieDane || '');
  if (zdjecieDane && !/^data:image\/(jpeg|png|webp);base64,/.test(zdjecieDane)) {
    return { ok: false, blad: 'Wgrane zdjęcie ma nieznany format.' };
  }
  if (zdjecieDane.length > MAX_ZDJECIE_ZNAKOW) {
    return { ok: false, blad: 'Zdjęcie jest za duże — spróbuj mniejszym plikiem.' };
  }

  // Miniatura powstaje w przeglądarce razem z pełnym zdjęciem. Gdy jej nie
  // ma (stara wersja panelu, wklejony adres), lista pokaże pełne zdjęcie.
  const zdjecieMini = String(dane?.zdjecieMini || '');
  if (zdjecieMini && !/^data:image\/(jpeg|png|webp);base64,/.test(zdjecieMini)) {
    return { ok: false, blad: 'Miniatura zdjęcia ma nieznany format.' };
  }
  if (zdjecieMini.length > MAX_ZDJECIE_ZNAKOW) {
    return { ok: false, blad: 'Miniatura zdjęcia jest za duża.' };
  }

  const pola = {
    nazwa: nazwa.slice(0, 120),
    opis: String(dane?.opis || '').trim().slice(0, 300),
    kod_plyty: String(dane?.kodPlyty || '').trim().slice(0, 60),
    firma_slug: String(dane?.firmaSlug || '').trim().slice(0, 60),
    grubosc_mm: Math.max(1, Math.round(Number(dane?.gruboscMm) || 20)),
    plyta_dl_cm: plytaDl,
    plyta_gl_cm: plytaGl,
    cena_normalna_m2: Math.round(cenaNormalna),
    cena_m2: Math.round(cena),
    plyt_razem: plytRazem,
    plyt_zostalo: plytZostalo,
    zdjecie_url: String(dane?.zdjecieUrl || '').trim().slice(0, 500),
    zdjecie_dane: zdjecieDane,
    zdjecie_mini: zdjecieMini,
    kategoria,
    typ,
  };

  const czas = teraz();
  const id = Number(dane?.id) || 0;

  if (id) {
    await env.BAZA.prepare(
      `UPDATE wyprzedaz_plyt SET nazwa=?, opis=?, kod_plyty=?, firma_slug=?, grubosc_mm=?,
        plyta_dl_cm=?, plyta_gl_cm=?, cena_normalna_m2=?, cena_m2=?, plyt_razem=?,
        plyt_zostalo=?, zdjecie_url=?, zdjecie_dane=?, zdjecie_mini=?,
        kategoria=?, typ=?, zmieniono=? WHERE id=?`
    )
      .bind(
        pola.nazwa, pola.opis, pola.kod_plyty, pola.firma_slug, pola.grubosc_mm,
        pola.plyta_dl_cm, pola.plyta_gl_cm, pola.cena_normalna_m2, pola.cena_m2,
        pola.plyt_razem, pola.plyt_zostalo, pola.zdjecie_url, pola.zdjecie_dane,
        pola.zdjecie_mini, pola.kategoria, pola.typ, czas, id
      )
      .run();
    return { ok: true, id, plyta: await plytaPoId(env, id) };
  }

  const wynik = await env.BAZA.prepare(
    `INSERT INTO wyprzedaz_plyt (nazwa, opis, kod_plyty, firma_slug, grubosc_mm,
      plyta_dl_cm, plyta_gl_cm, cena_normalna_m2, cena_m2, plyt_razem, plyt_zostalo,
      zdjecie_url, zdjecie_dane, zdjecie_mini, kategoria, typ,
      opublikowana, utworzono, zmieniono)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
  )
    .bind(
      pola.nazwa, pola.opis, pola.kod_plyty, pola.firma_slug, pola.grubosc_mm,
      pola.plyta_dl_cm, pola.plyta_gl_cm, pola.cena_normalna_m2, pola.cena_m2,
      pola.plyt_razem, pola.plyt_zostalo, pola.zdjecie_url, pola.zdjecie_dane,
      pola.zdjecie_mini, pola.kategoria, pola.typ, czas, czas
    )
    .run();

  const nowyId = wynik.meta.last_row_id;
  return { ok: true, id: nowyId, plyta: await plytaPoId(env, nowyId) };
}

/**
 * Publikacja / cofnięcie — osobno od zapisu, żeby kliknięcie „Opublikuj"
 * nie wymagało poprawnie wypełnionego formularza obok.
 */
export async function ustawPublikacje(env, id, opublikowana) {
  const zmiany = await env.BAZA.prepare(
    `UPDATE wyprzedaz_plyt SET opublikowana=?, zmieniono=? WHERE id=?`
  )
    .bind(opublikowana ? 1 : 0, teraz(), Number(id))
    .run();
  return zmiany.meta.changes > 0;
}

/**
 * „Sprzedana" / „wróciła" — zeruje albo przywraca licznik sztuk.
 * Nie kasuje wiersza: Dawid ma widzieć w panelu, co zeszło, i móc
 * odkręcić przypadkowe kliknięcie.
 */
export async function ustawDostepnosc(env, id, zostalo) {
  const plyta = await plytaPoId(env, id);
  if (!plyta) return false;
  const nowe = Math.min(Math.max(0, Math.round(Number(zostalo))), plyta.plytRazem);
  const zmiany = await env.BAZA.prepare(
    `UPDATE wyprzedaz_plyt SET plyt_zostalo=?, zmieniono=? WHERE id=?`
  )
    .bind(nowe, teraz(), Number(id))
    .run();
  return zmiany.meta.changes > 0;
}

export async function skasujPlyte(env, id) {
  const zmiany = await env.BAZA.prepare(`DELETE FROM wyprzedaz_plyt WHERE id=?`)
    .bind(Number(id))
    .run();
  return zmiany.meta.changes > 0;
}

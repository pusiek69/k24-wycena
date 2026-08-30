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
    // Front dostaje JEDEN adres zdjęcia, nieważne, czy Dawid wkleił link,
    // czy wgrał plik. Wgrany leży w bazie jako data URI i jest serwowany
    // przez `/wyprzedaz/zdjecie/<id>` — patrz worker.template.js.
    zdjecie: w.zdjecie_url || (w.zdjecie_dane ? `/wyprzedaz/zdjecie/${w.id}` : ''),
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

  let sql = `SELECT * FROM wyprzedaz_plyt`;
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
export async function zdjeciePlyty(env, id) {
  const w = await env.BAZA.prepare(`SELECT zdjecie_dane FROM wyprzedaz_plyt WHERE id = ?`)
    .bind(Number(id))
    .first();
  return w?.zdjecie_dane || '';
}

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

  const zdjecieDane = String(dane?.zdjecieDane || '');
  if (zdjecieDane && !/^data:image\/(jpeg|png|webp);base64,/.test(zdjecieDane)) {
    return { ok: false, blad: 'Wgrane zdjęcie ma nieznany format.' };
  }
  if (zdjecieDane.length > MAX_ZDJECIE_ZNAKOW) {
    return { ok: false, blad: 'Zdjęcie jest za duże — spróbuj mniejszym plikiem.' };
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
  };

  const czas = teraz();
  const id = Number(dane?.id) || 0;

  if (id) {
    await env.BAZA.prepare(
      `UPDATE wyprzedaz_plyt SET nazwa=?, opis=?, kod_plyty=?, firma_slug=?, grubosc_mm=?,
        plyta_dl_cm=?, plyta_gl_cm=?, cena_normalna_m2=?, cena_m2=?, plyt_razem=?,
        plyt_zostalo=?, zdjecie_url=?, zdjecie_dane=?, zmieniono=? WHERE id=?`
    )
      .bind(
        pola.nazwa, pola.opis, pola.kod_plyty, pola.firma_slug, pola.grubosc_mm,
        pola.plyta_dl_cm, pola.plyta_gl_cm, pola.cena_normalna_m2, pola.cena_m2,
        pola.plyt_razem, pola.plyt_zostalo, pola.zdjecie_url, pola.zdjecie_dane, czas, id
      )
      .run();
    return { ok: true, id, plyta: await plytaPoId(env, id) };
  }

  const wynik = await env.BAZA.prepare(
    `INSERT INTO wyprzedaz_plyt (nazwa, opis, kod_plyty, firma_slug, grubosc_mm,
      plyta_dl_cm, plyta_gl_cm, cena_normalna_m2, cena_m2, plyt_razem, plyt_zostalo,
      zdjecie_url, zdjecie_dane, opublikowana, utworzono, zmieniono)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
  )
    .bind(
      pola.nazwa, pola.opis, pola.kod_plyty, pola.firma_slug, pola.grubosc_mm,
      pola.plyta_dl_cm, pola.plyta_gl_cm, pola.cena_normalna_m2, pola.cena_m2,
      pola.plyt_razem, pola.plyt_zostalo, pola.zdjecie_url, pola.zdjecie_dane, czas, czas
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

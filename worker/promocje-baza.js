/**
 * PROMOCJE „OSTATNIE PŁYTY" — dostęp do bazy (Cloudflare D1).
 *
 * Zlecenie Dawida (27.08.2026): wyprzedaż resztek magazynowych — Dawid ma
 * fizycznie ograniczoną liczbę sztuk jednej płyty, ustawia GOTOWĄ cenę dla
 * klienta i sam zmniejsza licznik (sprzedaje też poza kalkulatorem).
 *
 * To NIE JEST to samo, co kampanie dostawców (Avant/Caesarstone/Keralini —
 * pricing/zrodla/*.promocje.json, src/app/promocje-lista.js w panelu).
 * Tamte to rabaty na CAŁY dekor z cennika, tu — jedna fizyczna partia płyt.
 *
 * SZKIC vs PUBLIKACJA: `opublikowana = 0` znaczy, że baner na produkcji
 * jej nie pokazuje. Widzi ją wyłącznie Dawid pod podpisanym linkiem
 * podglądu (patrz `tokenPromocji` w worker.template.js) — dokładnie ten
 * sam kod renderuje baner tam i na produkcji, więc podgląd nie kłamie.
 */

const teraz = () => new Date().toISOString();

/** Wiersz z D1 (snake_case) → kształt, jakiego oczekuje klient (camelCase). */
function zWiersza(w) {
  return {
    id: w.id,
    nazwa: w.nazwa,
    opisMaterial: w.opis_material,
    firmaSlug: w.firma_slug,
    dekor: w.dekor,
    gruboscMm: w.grubosc_mm,
    plytaDlCm: w.plyta_dl_cm,
    plytaGlCm: w.plyta_gl_cm,
    cenaNormalnaM2: w.cena_normalna_m2,
    cenaPromoM2: w.cena_promo_m2,
    plytRazem: w.plyt_razem,
    plytZostalo: w.plyt_zostalo,
    dataKonca: w.data_konca || '',
    zdjecieUrl: w.zdjecie_url || '',
    opublikowana: !!w.opublikowana,
    utworzono: w.utworzono,
    zmieniono: w.zmieniono,
  };
}

/**
 * Lista promocji.
 *
 * @param {object} opcje
 * @param {boolean} [opcje.wszystkie]  panel: draft + opublikowane
 * @param {number}  [opcje.dolaczId]   podgląd jednego szkicu, mimo że
 *                                     `wszystkie` jest false (link podglądu)
 */
export async function listaPromocji(env, opcje = {}) {
  const { wszystkie = false, dolaczId = null } = opcje;
  let sql = `SELECT * FROM promocje_plyt`;
  const warunki = [];
  const wartosci = [];
  if (!wszystkie) {
    if (dolaczId) {
      warunki.push(`(opublikowana = 1 OR id = ?)`);
      wartosci.push(dolaczId);
    } else {
      warunki.push(`opublikowana = 1`);
    }
  }
  if (warunki.length) sql += ` WHERE ` + warunki.join(' AND ');
  sql += ` ORDER BY (data_konca <> '') DESC, data_konca ASC, utworzono DESC`;

  const stmt = env.BAZA.prepare(sql);
  const { results } = wartosci.length ? await stmt.bind(...wartosci).all() : await stmt.all();
  return (results || []).map(zWiersza);
}

export async function promocjaPoId(env, id) {
  const w = await env.BAZA.prepare(`SELECT * FROM promocje_plyt WHERE id = ?`).bind(Number(id)).first();
  return w ? zWiersza(w) : null;
}

/**
 * Zapis — tworzy nową promocję (bez `id`) albo aktualizuje istniejącą.
 * Walidacja jest CELOWO surowa: to jedyne miejsce, gdzie zapisujemy cenę,
 * którą klient zobaczy wprost — literówka tu wychodzi na stronę od razu.
 */
export async function zapiszPromocje(env, dane) {
  const nazwa = String(dane?.nazwa || '').trim();
  if (!nazwa) return { ok: false, blad: 'Podaj nazwę promocji.' };

  const plytaDl = Number(dane?.plytaDlCm);
  const plytaGl = Number(dane?.plytaGlCm);
  if (!(plytaDl > 0) || !(plytaGl > 0)) return { ok: false, blad: 'Podaj wymiar płyty (dł. × gł., cm).' };

  const cenaPromo = Number(dane?.cenaPromoM2);
  if (!(cenaPromo > 0)) return { ok: false, blad: 'Podaj cenę promocyjną (zł/m², gotowa dla klienta).' };

  const cenaNormalna = Number(dane?.cenaNormalnaM2) || 0;
  if (cenaNormalna > 0 && cenaNormalna <= cenaPromo) {
    return { ok: false, blad: 'Cena normalna musi być wyższa od promocyjnej — inaczej to nie jest okazja.' };
  }

  const plytRazem = Math.max(1, Math.round(Number(dane?.plytRazem) || 1));
  // Przy tworzeniu zostało = razem; przy edycji Dawid podaje `plytZostalo`
  // wprost (to jest RĘCZNY licznik — patrz nagłówek pliku).
  const plytZostalo = dane?.plytZostalo != null
    ? Math.max(0, Math.round(Number(dane.plytZostalo)))
    : plytRazem;
  if (plytZostalo > plytRazem) {
    return { ok: false, blad: 'Zostało nie może być więcej niż razem.' };
  }

  const gruboscMm = Math.max(1, Math.round(Number(dane?.gruboscMm) || 20));
  const dataKonca = String(dane?.dataKonca || '').trim();
  if (dataKonca && !/^\d{4}-\d{2}-\d{2}$/.test(dataKonca)) {
    return { ok: false, blad: 'Data końca musi być w formacie RRRR-MM-DD (albo pusta).' };
  }

  const pola = {
    nazwa,
    opis_material: String(dane?.opisMaterial || '').trim().slice(0, 200),
    firma_slug: String(dane?.firmaSlug || '').trim(),
    dekor: String(dane?.dekor || '').trim(),
    grubosc_mm: gruboscMm,
    plyta_dl_cm: plytaDl,
    plyta_gl_cm: plytaGl,
    cena_normalna_m2: cenaNormalna,
    cena_promo_m2: Math.round(cenaPromo),
    plyt_razem: plytRazem,
    plyt_zostalo: plytZostalo,
    data_konca: dataKonca,
    zdjecie_url: String(dane?.zdjecieUrl || '').trim().slice(0, 500),
  };

  const czas = teraz();
  const id = Number(dane?.id) || 0;

  if (id) {
    await env.BAZA.prepare(
      `UPDATE promocje_plyt SET nazwa=?, opis_material=?, firma_slug=?, dekor=?, grubosc_mm=?,
        plyta_dl_cm=?, plyta_gl_cm=?, cena_normalna_m2=?, cena_promo_m2=?, plyt_razem=?,
        plyt_zostalo=?, data_konca=?, zdjecie_url=?, zmieniono=? WHERE id=?`
    )
      .bind(
        pola.nazwa, pola.opis_material, pola.firma_slug, pola.dekor, pola.grubosc_mm,
        pola.plyta_dl_cm, pola.plyta_gl_cm, pola.cena_normalna_m2, pola.cena_promo_m2,
        pola.plyt_razem, pola.plyt_zostalo, pola.data_konca, pola.zdjecie_url, czas, id
      )
      .run();
    return { ok: true, id, promocja: await promocjaPoId(env, id) };
  }

  const wynik = await env.BAZA.prepare(
    `INSERT INTO promocje_plyt (nazwa, opis_material, firma_slug, dekor, grubosc_mm,
      plyta_dl_cm, plyta_gl_cm, cena_normalna_m2, cena_promo_m2, plyt_razem, plyt_zostalo,
      data_konca, zdjecie_url, opublikowana, utworzono, zmieniono)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
  )
    .bind(
      pola.nazwa, pola.opis_material, pola.firma_slug, pola.dekor, pola.grubosc_mm,
      pola.plyta_dl_cm, pola.plyta_gl_cm, pola.cena_normalna_m2, pola.cena_promo_m2,
      pola.plyt_razem, pola.plyt_zostalo, pola.data_konca, pola.zdjecie_url, czas, czas
    )
    .run();
  const nowyId = wynik.meta.last_row_id;
  return { ok: true, id: nowyId, promocja: await promocjaPoId(env, nowyId) };
}

/** Publikacja / cofnięcie — osobno od zapisu, żeby jedno kliknięcie „Cofnij" nie gubiło danych formularza. */
export async function ustawPublikacje(env, id, opublikowana) {
  const zmiany = await env.BAZA.prepare(`UPDATE promocje_plyt SET opublikowana=?, zmieniono=? WHERE id=?`)
    .bind(opublikowana ? 1 : 0, teraz(), Number(id))
    .run();
  return zmiany.meta.changes > 0;
}

export async function skasujPromocje(env, id) {
  const zmiany = await env.BAZA.prepare(`DELETE FROM promocje_plyt WHERE id=?`).bind(Number(id)).run();
  return zmiany.meta.changes > 0;
}

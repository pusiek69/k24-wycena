/**
 * PROGRAM PARTNERSKI — DOSTĘP DO BAZY (26.10.2026).
 *
 * Reguły (procenty, ważność kodu) mieszkają w worker/partnerzy.js jako
 * czyste funkcje; tutaj wyłącznie SQL i czytanie konfiguracji. Konfiguracja
 * leży w tabeli `ustawienia` pod kluczami `partner*` — NIEJAWNA: publiczny
 * /ustawienia ją odfiltrowuje (patrz odczytajStawki + test w smoke).
 */
import { KONFIG_DOMYSLNA, KLUCZE_KONFIGU, poprawnyKod } from './partnerzy.js';

/** Partner po kodzie z linku — null, gdy nie ma albo kod śmieciowy. */
export async function partnerPoKodzie(env, kod) {
  if (!env.BAZA || !poprawnyKod(kod)) return null;
  return (
    (await env.BAZA.prepare(
      `SELECT id, nazwa, kod, typ, status, aktywny FROM partnerzy WHERE kod = ? LIMIT 1`
    )
      .bind(kod)
      .first()) || null
  );
}

/** Konfiguracja programu: ustawienia z bazy ∪ domyślne (15/10/15, 365 dni). */
export async function konfigPartnerska(env) {
  const konfig = { ...KONFIG_DOMYSLNA };
  if (!env.BAZA) return konfig;
  try {
    const wiersze = await env.BAZA.prepare(
      `SELECT klucz, wartosc FROM ustawienia WHERE klucz LIKE 'partner%'`
    ).all();
    const zBazy = new Map((wiersze.results || []).map((w) => [w.klucz, Number(w.wartosc)]));
    for (const [pole, klucz] of Object.entries(KLUCZE_KONFIGU)) {
      const w = zBazy.get(klucz);
      if (Number.isFinite(w) && w >= 0) konfig[pole] = w;
    }
  } catch (e) {
    // Bez konfiguracji liczymy domyślnymi — lead jest ważniejszy niż odczyt.
    console.error('konfig partnerska', e?.message || e);
  }
  return konfig;
}

/**
 * PROGRAM PARTNERSKI — DOSTĘP DO BAZY (26.10.2026).
 *
 * Reguły (procenty, ważność kodu) mieszkają w worker/partnerzy.js jako
 * czyste funkcje; tutaj wyłącznie SQL i czytanie konfiguracji. Konfiguracja
 * leży w tabeli `ustawienia` pod kluczami `partner*` — NIEJAWNA: publiczny
 * /ustawienia ją odfiltrowuje (patrz odczytajStawki + test w smoke).
 */
import {
  KONFIG_DOMYSLNA,
  KLUCZE_KONFIGU,
  poprawnyKod,
  stawkaProwizji,
  prowizja,
  nettoZlecenia,
} from './partnerzy.js';

const TYPY = ['stolarz', 'meble', 'projektant', 'inny'];
const STATUSY = ['standard', 'premium'];

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

/**
 * Dodanie (bez `id`) albo edycja (z `id`) partnera. Zwraca { ok, id }
 * albo { ok: false, blad } — komunikat po polsku, idzie wprost do panelu.
 */
export async function zapiszPartnera(env, d) {
  const baza = env.BAZA;
  if (!baza) return { ok: false, blad: 'Panel nie ma podpiętej bazy.' };
  const dane = d && typeof d === 'object' ? d : {};
  const id = Number(dane.id) || 0;

  const pola = {};
  if (dane.nazwa !== undefined) pola.nazwa = String(dane.nazwa || '').trim().slice(0, 160);
  if (dane.kod !== undefined) pola.kod = String(dane.kod || '').trim();
  if (dane.typ !== undefined) pola.typ = TYPY.includes(dane.typ) ? dane.typ : 'inny';
  if (dane.status !== undefined) pola.status = STATUSY.includes(dane.status) ? dane.status : 'standard';
  if (dane.telefon !== undefined) pola.telefon = String(dane.telefon || '').trim().slice(0, 40);
  if (dane.email !== undefined) pola.email = String(dane.email || '').trim().slice(0, 160);
  if (dane.aktywny !== undefined) pola.aktywny = dane.aktywny ? 1 : 0;
  if (dane.notatka !== undefined) pola.notatka = String(dane.notatka || '').trim().slice(0, 2000);

  if (pola.kod !== undefined && !poprawnyKod(pola.kod))
    return { ok: false, blad: 'Kod: 3–24 znaki, małe litery, cyfry i myślnik (np. meble-kowalski).' };

  if (pola.kod !== undefined) {
    const zajety = await baza
      .prepare(`SELECT id FROM partnerzy WHERE kod = ? AND id != ? LIMIT 1`)
      .bind(pola.kod, id)
      .first();
    if (zajety) return { ok: false, blad: 'Ten kod ma już inny partner.' };
  }

  if (id) {
    const obecny = await baza.prepare(`SELECT kod FROM partnerzy WHERE id = ?`).bind(id).first();
    if (!obecny) return { ok: false, blad: 'Nie ma takiego partnera.' };
    // Zmiana kodu zrywa powiązanie z kartami klientów — przy leadach zabroniona.
    if (pola.kod !== undefined && pola.kod !== obecny.kod) {
      const maLeady = await baza
        .prepare(`SELECT id FROM klienci WHERE partner_kod = ? LIMIT 1`)
        .bind(obecny.kod)
        .first();
      if (maLeady)
        return { ok: false, blad: 'Partner ma już przypisanych klientów — kodu nie zmieniamy.' };
    }
    const kolumny = Object.keys(pola);
    if (!kolumny.length) return { ok: true, id };
    await baza
      .prepare(`UPDATE partnerzy SET ${kolumny.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
      .bind(...kolumny.map((k) => pola[k]), id)
      .run();
    return { ok: true, id };
  }

  if (!pola.nazwa) return { ok: false, blad: 'Wpisz nazwę partnera.' };
  if (pola.kod === undefined) return { ok: false, blad: 'Wpisz kod do linku partnerskiego.' };
  const wynik = await baza
    .prepare(
      `INSERT INTO partnerzy (nazwa, kod, typ, status, telefon, email, aktywny, notatka, utworzono)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      pola.nazwa,
      pola.kod,
      pola.typ || 'inny',
      pola.status || 'standard',
      pola.telefon || '',
      pola.email || '',
      pola.aktywny === undefined ? 1 : pola.aktywny,
      pola.notatka || '',
      new Date().toISOString()
    )
    .run();
  return { ok: true, id: wynik.meta?.last_row_id ?? null };
}

/** Zapis konfiguracji programu — klucze `partner*`, z widełkami rozsądku. */
export async function zapiszKonfigPartnerska(env, d) {
  const dane = d && typeof d === 'object' ? d : {};
  const widelki = {
    procPierwsze: [0, 50],
    procKolejne: [0, 50],
    procPremium: [0, 50],
    podstawa: [0, 1],
    dni: [1, 3650],
  };
  const doZapisu = [];
  for (const [pole, [od, doo]] of Object.entries(widelki)) {
    if (dane[pole] === undefined) continue;
    const w = Number(dane[pole]);
    if (!Number.isFinite(w) || w < od || w > doo)
      return { ok: false, blad: `${pole}: wartość spoza widełek ${od}–${doo}.` };
    doZapisu.push([KLUCZE_KONFIGU[pole], w]);
  }
  const czas = new Date().toISOString();
  for (const [klucz, wartosc] of doZapisu) {
    await env.BAZA.prepare(
      `INSERT INTO ustawienia (klucz, wartosc, zmieniono) VALUES (?, ?, ?)
       ON CONFLICT(klucz) DO UPDATE SET wartosc = excluded.wartosc, zmieniono = excluded.zmieniono`
    )
      .bind(klucz, String(wartosc), czas)
      .run();
  }
  return { ok: true, zapisanych: doZapisu.length };
}

function bezpiecznyJsonWyceny(tekst) {
  try {
    const d = JSON.parse(tekst);
    return d && typeof d === 'object' ? d : null;
  } catch {
    return null;
  }
}

/**
 * Wygrane partnera w kolejności HISTORII (pierwsza wygrana → procPierwsze)
 * z naliczoną prowizją. `miesiac` ('YYYY-MM') filtruje POZYCJE, ale kolejność
 * pierwsze/kolejne zostaje globalna — o to chodzi w regule.
 */
async function naliczWygrane(env, partner, konfig, miesiac = null) {
  const wygrane =
    (
      await env.BAZA.prepare(
        `SELECT id, imie, wygrany_kiedy, kwota_ostatnia FROM klienci
          WHERE partner_kod = ? AND status = 'wygrany' AND wygrany_kiedy != ''
          ORDER BY wygrany_kiedy ASC, id ASC`
      )
        .bind(partner.kod)
        .all()
    ).results || [];

  const pozycje = [];
  let suma = 0;
  for (let i = 0; i < wygrane.length; i++) {
    const k = wygrane[i];
    if (miesiac && !String(k.wygrany_kiedy).startsWith(miesiac)) continue;
    const ostatnia = await env.BAZA.prepare(
      `SELECT dane FROM wyceny WHERE klient_id = ? ORDER BY utworzono DESC, id DESC LIMIT 1`
    )
      .bind(k.id)
      .first();
    const { netto, zPodgladu } = nettoZlecenia(bezpiecznyJsonWyceny(ostatnia?.dane), k.kwota_ostatnia);
    const procent = stawkaProwizji({
      premium: partner.status === 'premium',
      pierwsze: i === 0,
      konfig,
    });
    const kwota = prowizja(netto, procent);
    pozycje.push({
      klientId: k.id,
      imie: k.imie,
      data: k.wygrany_kiedy,
      netto,
      procent,
      prowizja: kwota,
      // „sprawdź podstawę" — netto przybliżone z kwoty karty, nie z wyceny.
      zPodgladu,
    });
    suma += kwota;
  }
  return { pozycje, suma };
}

/** Lista do zakładki: partnerzy z licznikami i sumą prowizji od początku. */
export async function listaPartnerow(env) {
  const konfig = await konfigPartnerska(env);
  const partnerzy =
    (await env.BAZA.prepare(`SELECT * FROM partnerzy ORDER BY nazwa COLLATE NOCASE`).all())
      .results || [];
  const wynik = [];
  for (const p of partnerzy) {
    const liczby = await env.BAZA.prepare(
      `SELECT COUNT(*) AS leadow,
              SUM(CASE WHEN status = 'wygrany' THEN 1 ELSE 0 END) AS wygranych
         FROM klienci WHERE partner_kod = ?`
    )
      .bind(p.kod)
      .first();
    const { suma } = await naliczWygrane(env, p, konfig);
    wynik.push({
      ...p,
      leadow: liczby?.leadow || 0,
      wygranych: liczby?.wygranych || 0,
      prowizjaSuma: suma,
    });
  }
  return { partnerzy: wynik, konfig };
}

/** Zestawienie do rozliczenia miesięcznego (FV partnera). */
export async function rozliczenieMiesiaca(env, miesiac) {
  if (!/^\d{4}-\d{2}$/.test(String(miesiac || ''))) return { ok: false, blad: 'Miesiąc w formacie RRRR-MM.' };
  const konfig = await konfigPartnerska(env);
  const partnerzy =
    (await env.BAZA.prepare(`SELECT * FROM partnerzy ORDER BY nazwa COLLATE NOCASE`).all())
      .results || [];
  const wynik = [];
  for (const p of partnerzy) {
    const { pozycje, suma } = await naliczWygrane(env, p, konfig, miesiac);
    if (pozycje.length)
      wynik.push({ id: p.id, kod: p.kod, nazwa: p.nazwa, status: p.status, pozycje, suma });
  }
  return { ok: true, miesiac, partnerzy: wynik };
}

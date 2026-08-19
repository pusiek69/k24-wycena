/**
 * ══════════════════════════════════════════════════════════════════════════
 *  BAZA KLIENTÓW — zapis i odczyt (Cloudflare D1)
 *
 *  Schemat: worker/schema.sql
 *
 *  ZASADA NADRZĘDNA: zapis do bazy nie ma prawa przewrócić wysyłki maili.
 *  Każde wywołanie z /lead jest opakowane w try/catch po stronie workera,
 *  a funkcje tutaj nie rzucają niczym, czego nie da się złapać.
 *
 *  DEDUPLIKACJA: klient rozpoznawany jest po numerze telefonu (9 cyfr)
 *  albo po mailu. Kolejna wycena dokleja się do istniejącej karty, zamiast
 *  zakładać drugą — dzięki temu w panelu widać historię, a nie listę
 *  powtórzeń tego samego człowieka.
 * ══════════════════════════════════════════════════════════════════════════
 */

/** Lejek sprzedaży. Kolejność ma znaczenie — w tej kolejności stoją w panelu. */
export const STATUSY = [
  { id: 'nowy', nazwa: 'Nowy' },
  { id: 'cieply', nazwa: 'Ciepły' },
  { id: 'pomiar', nazwa: 'Pomiar umówiony' },
  { id: 'oferta', nazwa: 'Oferta wysłana' },
  { id: 'wygrany', nazwa: 'Wygrany' },
  { id: 'przegrany', nazwa: 'Przegrany' },
  { id: 'fake', nazwa: 'Fake' },
];

/** Statusy, których kwoty sumują się do „ile wisi w lejku". */
export const W_LEJKU = ['cieply', 'oferta'];

const NAZWY_STATUSOW = Object.fromEntries(STATUSY.map((s) => [s.id, s.nazwa]));
export const znanyStatus = (s) => STATUSY.some((x) => x.id === s);

/** Maile testowe Dawida — zgłoszenia z nich to prawie zawsze próba działania. */
const MAILE_TESTOWE = ['kamieniarstwo24h@gmail.com', 'pusiex69@gmail.com'];

/** Ile miesięcy trzymamy kartę bez żadnego ruchu (decyzja Dawida, 19.08.2026). */
export const RETENCJA_MIESIECY = 24;

/* ─────────────────────────────────────────────────────── klucze i drobiazgi */

/**
 * Numer do porównań: same cyfry, bez kierunkowego. „+48 796 991 128",
 * „0048796991128" i „796-991-128" to ten sam klient.
 */
export function kluczTelefonu(telefon) {
  let c = String(telefon || '').replace(/\D/g, '');
  if (c.startsWith('0048')) c = c.slice(4);
  else if (c.startsWith('48') && c.length > 9) c = c.slice(2);
  return c.length >= 9 ? c.slice(-9) : c;
}

export const kluczEmaila = (email) => String(email || '').trim().toLowerCase();

const teraz = () => new Date().toISOString();
const dzis = () => new Date().toISOString().slice(0, 10);
const liczba = (x) => Math.round(Number(x) || 0);

/** Data sprzed N miesięcy w ISO — do retencji. */
function przedMiesiacami(ile) {
  const d = new Date();
  d.setMonth(d.getMonth() - ile);
  return d.toISOString();
}

/* ───────────────────────────────────────────────────────────────── zapis */

/**
 * Zapisuje zgłoszenie z kalkulatora. Zwraca { klientId, nowy } albo null,
 * gdy bazy nie ma (np. lokalne uruchomienie bez bindowania D1).
 *
 * @param {any} env      środowisko workera (env.BAZA to baza D1)
 * @param {object} lead  { imie, telefon, email, miejscowosc, kwota, opis,
 *                         szczegoly, zrodlo }
 */
export async function zapiszLead(env, lead) {
  const baza = env.BAZA;
  if (!baza) return null;

  const telefon = String(lead.telefon || '').trim();
  const email = String(lead.email || '').trim();
  const tk = kluczTelefonu(telefon);
  const ek = kluczEmaila(email);
  const czas = teraz();

  const istniejacy = await znajdzKlienta(baza, tk, ek);
  const flagi = await wykryjFlagi(baza, { tk, ek, telefon, istniejacy });

  const s = lead.szczegoly && typeof lead.szczegoly === 'object' ? lead.szczegoly : {};
  const kwota = liczba(lead.kwota || s.razem);
  const zrodlo = czytelneZrodlo(lead.zrodlo);

  let klientId = istniejacy?.id ?? null;
  let nowy = false;

  if (klientId) {
    await baza
      .prepare(
        `UPDATE klienci SET imie = COALESCE(NULLIF(?, ''), imie),
                            telefon = COALESCE(NULLIF(?, ''), telefon),
                            email = COALESCE(NULLIF(?, ''), email),
                            miejscowosc = COALESCE(NULLIF(?, ''), miejscowosc),
                            telefon_klucz = COALESCE(NULLIF(?, ''), telefon_klucz),
                            email_klucz = COALESCE(NULLIF(?, ''), email_klucz),
                            flagi = ?, wycen = wycen + 1,
                            kwota_ostatnia = ?, kwota_max = MAX(kwota_max, ?),
                            ruch = ?
         WHERE id = ?`
      )
      .bind(
        String(lead.imie || '').trim(),
        telefon,
        email,
        String(lead.miejscowosc || '').trim(),
        tk,
        ek,
        JSON.stringify([...new Set([...bezpieczneFlagi(istniejacy.flagi), ...flagi])]),
        kwota,
        kwota,
        czas,
        klientId
      )
      .run();
  } else {
    nowy = true;
    const wynik = await baza
      .prepare(
        `INSERT INTO klienci (imie, telefon, email, miejscowosc, telefon_klucz, email_klucz,
                              status, zrodlo, zrodlo_szczegol, flagi, wycen,
                              kwota_ostatnia, kwota_max, utworzono, ruch)
         VALUES (?, ?, ?, ?, ?, ?, 'nowy', ?, ?, ?, 1, ?, ?, ?, ?)`
      )
      .bind(
        String(lead.imie || '').trim(),
        telefon,
        email,
        String(lead.miejscowosc || '').trim(),
        tk,
        ek,
        zrodlo.typ,
        zrodlo.szczegol,
        JSON.stringify(flagi),
        kwota,
        kwota,
        czas,
        czas
      )
      .run();
    klientId = wynik.meta?.last_row_id ?? null;
  }

  if (!klientId) return null;

  await baza
    .prepare(
      `INSERT INTO wyceny (klient_id, utworzono, kwota, firma, dekor, grubosc,
                           m2, mb, pomieszczenie, odbior, kod_plyty, opis)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      klientId,
      czas,
      kwota,
      String(s.firma || ''),
      String(s.dekor || ''),
      String(s.grubosc || ''),
      Number(s.m2Blatu || 0),
      Number(s.mb || 0),
      String(lead.pomieszczenie || s.pomieszczenie || ''),
      s.odbiorWlasny ? 1 : 0,
      String(s.kodPlyty || ''),
      String(lead.opis || '').slice(0, 500)
    )
    .run();

  if (!nowy) {
    await dopiszNotatke(baza, klientId, 'system', `Kolejna wycena: ${opisWyceny(s, kwota)}`);
  }

  return { klientId, nowy };
}

const opisWyceny = (s, kwota) =>
  [s.firma, s.dekor, kwota ? `${kwota} zł` : ''].filter(Boolean).join(' · ') || 'zapytanie bez kwoty';

/** Karta rozpoznawana po telefonie ALBO mailu; numer jest silniejszy. */
async function znajdzKlienta(baza, tk, ek) {
  if (tk) {
    const poTelefonie = await baza
      .prepare(`SELECT id, flagi FROM klienci WHERE telefon_klucz = ? LIMIT 1`)
      .bind(tk)
      .first();
    if (poTelefonie) return poTelefonie;
  }
  if (ek) {
    return await baza
      .prepare(`SELECT id, flagi FROM klienci WHERE email_klucz = ? LIMIT 1`)
      .bind(ek)
      .first();
  }
  return null;
}

const bezpieczneFlagi = (json) => {
  try {
    const x = JSON.parse(json || '[]');
    return Array.isArray(x) ? x : [];
  } catch {
    return [];
  }
};

/**
 * Szare flagi — podpowiedź, nie wyrok. Statusu nie ustawiamy automatycznie
 * na „fake": decyzję podejmuje Dawid, my tylko zwracamy uwagę.
 */
async function wykryjFlagi(baza, { tk, ek, telefon, istniejacy }) {
  const flagi = [];
  if (MAILE_TESTOWE.includes(ek)) flagi.push('test');
  if (kluczTelefonu(telefon).length !== 9) flagi.push('telefon');

  // Dwa zgłoszenia z tego samego numeru w kwadrans to zwykle klikanie
  // w kółko albo bot — nie mylić z klientem wracającym po tygodniu.
  if (istniejacy?.id) {
    const swieze = await baza
      .prepare(
        `SELECT COUNT(*) AS ile FROM wyceny
         WHERE klient_id = ? AND utworzono > datetime('now', '-15 minutes')`
      )
      .bind(istniejacy.id)
      .first();
    if ((swieze?.ile ?? 0) >= 1) flagi.push('dubel');
  }
  return flagi;
}

/**
 * Źródło wizyty. Gdy klient nie zgodził się na marketing, przeglądarka
 * przysyła { typ: 'nieznane' } — i tak to zapisujemy, bez kombinowania.
 */
function czytelneZrodlo(zrodlo) {
  const z = zrodlo && typeof zrodlo === 'object' ? zrodlo : {};
  const typ = ['ads', 'organiczne', 'nieznane'].includes(z.typ) ? z.typ : 'nieznane';
  const szczegol = [z.gclid ? `gclid` : '', z.utm_source || '', z.utm_campaign || '', z.referrer || '']
    .filter(Boolean)
    .join(' · ')
    .slice(0, 200);
  return { typ, szczegol };
}

async function dopiszNotatke(baza, klientId, autor, tresc) {
  await baza
    .prepare(`INSERT INTO notatki (klient_id, utworzono, autor, tresc) VALUES (?, ?, ?, ?)`)
    .bind(klientId, teraz(), autor, String(tresc).slice(0, 2000))
    .run();
  await baza.prepare(`UPDATE klienci SET ruch = ? WHERE id = ?`).bind(teraz(), klientId).run();
}

/* ──────────────────────────────────────────────────────────────── odczyt */

/** Liczniki i kwoty do paska na górze panelu. */
export async function podsumowanie(env) {
  const baza = env.BAZA;
  const wiersze = await baza
    .prepare(`SELECT status, COUNT(*) AS ile, SUM(kwota_ostatnia) AS kwota FROM klienci GROUP BY status`)
    .all();

  const wg = {};
  for (const s of STATUSY) wg[s.id] = { nazwa: s.nazwa, ile: 0, kwota: 0 };
  for (const w of wiersze.results || []) {
    if (!wg[w.status]) wg[w.status] = { nazwa: w.status, ile: 0, kwota: 0 };
    wg[w.status].ile = w.ile;
    wg[w.status].kwota = liczba(w.kwota);
  }

  const wLejku = W_LEJKU.reduce((suma, id) => suma + (wg[id]?.kwota || 0), 0);
  const naDzisIle = await baza
    .prepare(`SELECT COUNT(*) AS ile FROM klienci WHERE oddzwonic IS NOT NULL AND oddzwonic <= ?`)
    .bind(dzis())
    .first();

  const ostatnie = await odczytajMeta(baza, 'ostatnie-wejscie');
  const nowych = ostatnie
    ? (
        await baza
          .prepare(`SELECT COUNT(*) AS ile FROM klienci WHERE utworzono > ?`)
          .bind(ostatnie)
          .first()
      )?.ile ?? 0
    : 0;

  return { statusy: wg, wLejku, naDzis: naDzisIle?.ile ?? 0, nowych, odKiedy: ostatnie || null };
}

/**
 * Lista kart. Filtry są opcjonalne; „naDzis" ma pierwszeństwo, bo to
 * najważniejszy widok w panelu.
 */
export async function lista(env, filtry = {}) {
  const warunki = [];
  const dane = [];

  if (filtry.naDzis) {
    warunki.push(`oddzwonic IS NOT NULL AND oddzwonic <= ?`);
    dane.push(dzis());
  }
  if (filtry.status && znanyStatus(filtry.status)) {
    warunki.push(`status = ?`);
    dane.push(filtry.status);
  }
  if (filtry.od) {
    warunki.push(`utworzono >= ?`);
    dane.push(String(filtry.od));
  }
  if (filtry.do) {
    warunki.push(`utworzono <= ?`);
    dane.push(String(filtry.do) + 'T23:59:59Z');
  }
  if (filtry.kwotaOd) {
    warunki.push(`kwota_max >= ?`);
    dane.push(liczba(filtry.kwotaOd));
  }
  if (filtry.szukaj) {
    warunki.push(`(imie LIKE ?1 OR telefon LIKE ?1 OR email LIKE ?1 OR miejscowosc LIKE ?1)`);
    dane.push(`%${String(filtry.szukaj).slice(0, 60)}%`);
  }

  const gdzie = warunki.length ? `WHERE ${warunki.join(' AND ')}` : '';
  const porzadek = filtry.naDzis ? `oddzwonic ASC, ruch DESC` : `ruch DESC`;
  const limit = Math.min(Number(filtry.limit) || 200, 500);

  const wynik = await env.BAZA.prepare(
    `SELECT * FROM klienci ${gdzie} ORDER BY ${porzadek} LIMIT ${limit}`
  )
    .bind(...dane)
    .all();

  return (wynik.results || []).map(kartaSkrocona);
}

const kartaSkrocona = (k) => ({
  id: k.id,
  imie: k.imie,
  telefon: k.telefon,
  email: k.email,
  miejscowosc: k.miejscowosc,
  status: k.status,
  statusNazwa: NAZWY_STATUSOW[k.status] || k.status,
  oddzwonic: k.oddzwonic,
  zrodlo: k.zrodlo,
  zrodloSzczegol: k.zrodlo_szczegol,
  flagi: bezpieczneFlagi(k.flagi),
  wycen: k.wycen,
  kwota: k.kwota_ostatnia,
  kwotaMax: k.kwota_max,
  utworzono: k.utworzono,
  ruch: k.ruch,
});

/** Pełna karta: dane, historia wycen, log notatek. */
export async function karta(env, id) {
  const k = await env.BAZA.prepare(`SELECT * FROM klienci WHERE id = ?`).bind(id).first();
  if (!k) return null;

  const wyceny = await env.BAZA.prepare(
    `SELECT * FROM wyceny WHERE klient_id = ? ORDER BY utworzono DESC, id DESC`
  )
    .bind(id)
    .all();
  const notatki = await env.BAZA.prepare(
    `SELECT * FROM notatki WHERE klient_id = ? ORDER BY utworzono DESC, id DESC`
  )
    .bind(id)
    .all();

  return { ...kartaSkrocona(k), wyceny: wyceny.results || [], notatki: notatki.results || [] };
}

/* ───────────────────────────────────────────────────────────────── zmiany */

export async function ustawStatus(env, id, status) {
  if (!znanyStatus(status)) return false;
  const stary = await env.BAZA.prepare(`SELECT status FROM klienci WHERE id = ?`).bind(id).first();
  if (!stary) return false;
  if (stary.status === status) return true;

  await env.BAZA.prepare(`UPDATE klienci SET status = ?, ruch = ? WHERE id = ?`)
    .bind(status, teraz(), id)
    .run();
  await dopiszNotatke(
    env.BAZA,
    id,
    'system',
    `Status: ${NAZWY_STATUSOW[stary.status] || stary.status} → ${NAZWY_STATUSOW[status]}`
  );
  return true;
}

export async function ustawOddzwonic(env, id, data) {
  const czysta = /^\d{4}-\d{2}-\d{2}$/.test(String(data || '')) ? String(data) : null;
  await env.BAZA.prepare(`UPDATE klienci SET oddzwonic = ?, ruch = ? WHERE id = ?`)
    .bind(czysta, teraz(), id)
    .run();
  await dopiszNotatke(
    env.BAZA,
    id,
    'system',
    czysta ? `Oddzwonić: ${czysta}` : 'Zdjęto termin kontaktu'
  );
  return true;
}

export async function dodajNotatke(env, id, tresc) {
  const t = String(tresc || '').trim();
  if (!t) return false;
  await dopiszNotatke(env.BAZA, id, 'dawid', t);
  return true;
}

export async function skasujKlienta(env, id) {
  await env.BAZA.prepare(`DELETE FROM notatki WHERE klient_id = ?`).bind(id).run();
  await env.BAZA.prepare(`DELETE FROM wyceny WHERE klient_id = ?`).bind(id).run();
  await env.BAZA.prepare(`DELETE FROM klienci WHERE id = ?`).bind(id).run();
  return true;
}

/* ─────────────────────────────────────────────────────── meta i sprzątanie */

export async function odczytajMeta(baza, klucz) {
  const w = await baza.prepare(`SELECT wartosc FROM meta WHERE klucz = ?`).bind(klucz).first();
  return w?.wartosc ?? null;
}

export async function zapiszMeta(baza, klucz, wartosc) {
  await baza
    .prepare(
      `INSERT INTO meta (klucz, wartosc) VALUES (?, ?)
       ON CONFLICT(klucz) DO UPDATE SET wartosc = excluded.wartosc`
    )
    .bind(klucz, String(wartosc))
    .run();
}

/**
 * RETENCJA (RODO): karta bez żadnego ruchu przez 24 miesiące znika razem
 * z wycenami i notatkami. Wołane przy wejściu do panelu — nie potrzeba
 * osobnego crona, a i tak wykona się co najwyżej raz dziennie.
 */
export async function posprzataj(env) {
  const baza = env.BAZA;
  const ostatnie = await odczytajMeta(baza, 'sprzatanie');
  if (ostatnie === dzis()) return 0;

  const granica = przedMiesiacami(RETENCJA_MIESIECY);
  const stare = await baza.prepare(`SELECT id FROM klienci WHERE ruch < ?`).bind(granica).all();
  for (const k of stare.results || []) await skasujKlienta(env, k.id);

  await zapiszMeta(baza, 'sprzatanie', dzis());
  return (stare.results || []).length;
}

/* ──────────────────────────────────────────────────────────────────── CSV */

const pole = (x) => `"${String(x ?? '').replace(/"/g, '""')}"`;

export async function csv(env) {
  const wiersze = await env.BAZA.prepare(`SELECT * FROM klienci ORDER BY utworzono DESC`).all();
  const naglowki = [
    'id', 'utworzono', 'imie', 'telefon', 'email', 'miejscowosc', 'status',
    'oddzwonic', 'zrodlo', 'flagi', 'wycen', 'kwota_ostatnia', 'kwota_max', 'ostatni_ruch',
  ];
  const linie = [naglowki.join(';')];
  for (const k of wiersze.results || []) {
    linie.push(
      [
        k.id, k.utworzono, k.imie, k.telefon, k.email, k.miejscowosc,
        NAZWY_STATUSOW[k.status] || k.status, k.oddzwonic || '', k.zrodlo,
        bezpieczneFlagi(k.flagi).join(' '), k.wycen, k.kwota_ostatnia, k.kwota_max, k.ruch,
      ]
        .map(pole)
        .join(';')
    );
  }
  // BOM, żeby Excel nie zrobił krzaków z polskich znaków.
  return '﻿' + linie.join('\r\n');
}

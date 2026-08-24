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
                           m2, mb, pomieszczenie, odbior, kod_plyty, opis, kategoria)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      String(lead.opis || '').slice(0, 500),
      String(s.rodzaj || '')
    )
    .run();

  // Parametry wejściowe wyceny — z nich „Powtórz wycenę" w panelu odtwarza
  // kalkulator. Osobny UPDATE, żeby nie ruszać zgodności INSERT-u wyżej.
  if (s.parametry && typeof s.parametry === 'object') {
    try {
      await baza
        .prepare(
          `UPDATE wyceny SET dane = ? WHERE id =
             (SELECT id FROM wyceny WHERE klient_id = ? ORDER BY utworzono DESC, id DESC LIMIT 1)`
        )
        .bind(JSON.stringify(s.parametry).slice(0, 4000), klientId)
        .run();
    } catch {
      /* parametry to bonus — bez nich lead i tak jest kompletny */
    }
  }

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
  // Klient, który kliknął „pasuje mi", wisi na górze, dopóki sprawa jest
  // otwarta (nowy/ciepły) — to najgorętszy telefon do wykonania.
  const przypiete = `CASE WHEN feedback = 'pasuje' AND status IN ('nowy','cieply') THEN 0 ELSE 1 END`;
  const porzadek = filtry.naDzis ? `oddzwonic ASC, ruch DESC` : `${przypiete}, ruch DESC`;
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
  feedback: k.feedback || '',
  budzet: k.budzet || '',
  pora: k.pora || '',
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

  // Wszystkie wątki klienta naraz — jedno zapytanie zamiast jednego
  // na wycenę. Rozdzielamy je niżej po `wycena_id`.
  const wiadomosci = await env.BAZA.prepare(
    `SELECT wycena_id, autor, tresc, utworzono FROM wiadomosci
      WHERE klient_id = ? ORDER BY id ASC`
  )
    .bind(id)
    .all();
  const watki = new Map();
  for (const m of wiadomosci.results || []) {
    if (!watki.has(m.wycena_id)) watki.set(m.wycena_id, []);
    watki.get(m.wycena_id).push({ autor: m.autor, tresc: m.tresc, utworzono: m.utworzono });
  }

  return {
    ...kartaSkrocona(k),
    wyceny: (wyceny.results || []).map((w) => ({
      ...w,
      dane: bezpiecznyJson(w.dane),
      rozmowa: watki.get(w.id) || [],
    })),
    notatki: notatki.results || [],
  };
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
  // Kasujemy JAWNIE, nie licząc na kaskadę z klucza obcego: SQLite wymusza
  // ją tylko przy włączonym `PRAGMA foreign_keys`, a na tym nie chcemy
  // opierać usunięcia danych klienta (RODO liczy się bardziej niż elegancja).
  await env.BAZA.prepare(`DELETE FROM wiadomosci WHERE klient_id = ?`).bind(id).run();
  await env.BAZA.prepare(`DELETE FROM notatki WHERE klient_id = ?`).bind(id).run();
  await env.BAZA.prepare(`DELETE FROM wyceny WHERE klient_id = ?`).bind(id).run();
  await env.BAZA.prepare(`DELETE FROM klienci WHERE id = ?`).bind(id).run();
  return true;
}

const bezpiecznyJson = (t) => {
  try {
    const x = JSON.parse(t || 'null');
    return x && typeof x === 'object' ? x : null;
  } catch {
    return null;
  }
};

/* ───────────────────────────────────── oferty Dawida („Powtórz wycenę") */

/**
 * Zapisuje wersję wyceny przygotowaną przez Dawida — jako KOLEJNY wiersz,
 * nigdy nadpisanie: oryginał klienta zostaje nietknięty. Zwraca token
 * linku wyceny online.
 */
export async function zapiszOferte(env, klientId, oferta, token) {
  const baza = env.BAZA;
  const czas = teraz();
  const kwota = liczba(oferta.razem);

  await baza
    .prepare(
      `INSERT INTO wyceny (klient_id, utworzono, kwota, firma, dekor, grubosc,
                           m2, mb, pomieszczenie, odbior, kod_plyty, opis,
                           kategoria, wersja, dane, token)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'dawid', ?, ?)`
    )
    .bind(
      klientId,
      czas,
      kwota,
      String(oferta.firma || ''),
      String(oferta.dekor || ''),
      String(oferta.grubosc || ''),
      Number(oferta.m2 || 0),
      Number(oferta.mb || 0),
      String(oferta.pomieszczenie || ''),
      oferta.odbiorWlasny ? 1 : 0,
      '',
      String(oferta.opis || '').slice(0, 500),
      String(oferta.kategoria || ''),
      jsonOferty(oferta),
      token
    )
    .run();

  // ID wyceny jest potrzebne rozmowie: wątek wisi przy KONKRETNEJ ofercie,
  // żeby dwie wyceny dla tego samego klienta nie zlały się w jeden czat.
  const swieza = await baza
    .prepare(`SELECT id FROM wyceny WHERE token = ? LIMIT 1`)
    .bind(token)
    .first();

  /*
   * Status idzie na „Oferta wysłana" tylko z wcześniejszych etapów lejka.
   * Wygranego, przegranego ani fake nie cofamy — klik w panelu nie może
   * odkręcić decyzji, którą Dawid już podjął.
   */
  const stary = await baza.prepare(`SELECT status FROM klienci WHERE id = ?`).bind(klientId).first();
  const wolno = ['nowy', 'cieply', 'pomiar'];
  if (stary && wolno.includes(stary.status)) {
    await baza
      .prepare(`UPDATE klienci SET status = 'oferta', kwota_ostatnia = ?, ruch = ? WHERE id = ?`)
      .bind(kwota, czas, klientId)
      .run();
  } else {
    await baza
      .prepare(`UPDATE klienci SET kwota_ostatnia = ?, ruch = ? WHERE id = ?`)
      .bind(kwota, czas, klientId)
      .run();
  }

  await dopiszNotatke(
    baza,
    klientId,
    'system',
    `Wysłano ofertę od Dawida: ${oferta.opis || ''} — ${kwota} zł` +
      (oferta.korektaOpis ? ` (${oferta.korektaOpis})` : '')
  );

  return { token, wycenaId: swieza?.id || 0 };
}

/**
 * Oferta do zapisu w kolumnie `dane`.
 *
 * Wcześniej stało tu `slice(0, 16000)` — i to była pułapka: ucięty JSON
 * przestaje się parsować, więc strona oferty pokazałaby klientowi pustkę
 * zamiast wyceny. Od kiedy oferta niesie też rozrys płyt (współrzędne
 * każdego elementu), limit realnie można dobić.
 *
 * Dlatego: próbujemy zapisać całość, a gdy urwałoby się pole — odcinamy
 * NAJPIERW rozrys (dodatek), zostawiając wycenę w całości.
 */
const LIMIT_OFERTY = 200000;

function jsonOferty(oferta) {
  const pelna = JSON.stringify(oferta);
  if (pelna.length <= LIMIT_OFERTY) return pelna;
  const bezRozrysu = JSON.stringify({ ...oferta, rozrys: null });
  return bezRozrysu.length <= LIMIT_OFERTY ? bezRozrysu : JSON.stringify({ ...oferta, rozrys: null, pozycje: [] });
}

/**
 * Wycena online po tokenie z linku. Każde otwarcie przez klienta podbija
 * licznik „klient obejrzał" (z datą); podgląd z panelu licznika nie rusza.
 */
export async function ofertaPoTokenie(env, token, { podglad = false } = {}) {
  const czysty = String(token || '').trim();
  if (!/^[a-f0-9]{32,64}$/.test(czysty)) return null;

  const w = await env.BAZA.prepare(`SELECT * FROM wyceny WHERE token = ? LIMIT 1`)
    .bind(czysty)
    .first();
  if (!w) return null;

  if (!podglad) {
    await env.BAZA.prepare(
      `UPDATE wyceny SET otwarcia = otwarcia + 1, ostatnie_otwarcie = ? WHERE id = ?`
    )
      .bind(teraz(), w.id)
      .run();
  }

  const klient = await env.BAZA.prepare(`SELECT imie FROM klienci WHERE id = ?`)
    .bind(w.klient_id)
    .first();

  return {
    klientId: w.klient_id,
    wycenaId: w.id,
    imie: klient?.imie || '',
    utworzono: w.utworzono,
    oferta: bezpiecznyJson(w.dane),
    rozmowa: await rozmowaOferty(env, w.id),
  };
}

/* ─────────────────────────────────── rozmowa pod ofertą */

/**
 * ROZMOWA POD OFERTĄ (zlecenie Dawida, 24.08.2026)
 *
 * Wątek wisi przy ofercie, nie przy kliencie — ten sam klient może mieć
 * wycenę kuchni i łazienki, a rozmowy o nich to dwie różne sprawy.
 * W panelu Dawid i tak widzi je wszystkie na karcie klienta.
 *
 * Klient pisze BEZ LOGOWANIA: autoryzuje go token z linku do oferty.
 */
export async function rozmowaOferty(env, wycenaId) {
  if (!env.BAZA || !(wycenaId > 0)) return [];
  const w = await env.BAZA.prepare(
    `SELECT autor, tresc, utworzono FROM wiadomosci WHERE wycena_id = ? ORDER BY id ASC`
  )
    .bind(wycenaId)
    .all();
  return w.results || [];
}

/**
 * Dane potrzebne do sprawdzenia, czy klient nie spamuje: ile już napisał
 * i kiedy ostatnio. Liczymy TYLKO jego wiadomości — odpowiedzi Dawida
 * nie mogą zużywać limitu klienta.
 */
export async function kontekstRozmowy(env, wycenaId) {
  const pusty = { odKlienta: 0, ostatnia: null };
  if (!env.BAZA || !(wycenaId > 0)) return pusty;
  const r = await env.BAZA.prepare(
    `SELECT COUNT(*) AS ile, MAX(utworzono) AS ostatnia
       FROM wiadomosci WHERE wycena_id = ? AND autor = 'klient'`
  )
    .bind(wycenaId)
    .first();
  return { odKlienta: Number(r?.ile || 0), ostatnia: r?.ostatnia || null };
}

/**
 * Dopisuje wiadomość do wątku. Treść jest już sprawdzona przez
 * worker/rozmowa.js — tutaj tylko zapis i ślad w notatkach, żeby wpis
 * w karcie klienta pokazywał ruch w sprawie.
 */
export async function dopiszWiadomosc(env, { wycenaId, klientId, autor, tresc }) {
  const czas = teraz();
  await env.BAZA.prepare(
    `INSERT INTO wiadomosci (wycena_id, klient_id, autor, tresc, utworzono)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(wycenaId, klientId, autor, tresc, czas)
    .run();

  // Ruch w sprawie — żeby klient odezwał się na liście „na dziś", a nie
  // czekał niezauważony na dole tabeli.
  await env.BAZA.prepare(`UPDATE klienci SET ruch = ? WHERE id = ?`).bind(czas, klientId).run();

  return { autor, tresc, utworzono: czas };
}

/* ─────────────────────────────────────────────────── feedback po wycenie */

const FEEDBACKI = ['pasuje', 'za_drogo', 'zastanowi'];
const OPIS_FEEDBACKU = {
  pasuje: 'Pasuje mi — proszę o kontakt',
  za_drogo: 'Cena za wysoka',
  zastanowi: 'Muszę się zastanowić',
};

/**
 * Odpowiedź klienta na pokazaną wycenę. Klienta rozpoznajemy po telefonie
 * albo mailu — dokładnie tych, które przed chwilą zostawił w bramce.
 *
 * „Pasuje mi" podnosi status na CIEPŁY, ale wyłącznie z „nowy" — jeśli
 * Dawid zdążył już coś ustawić (pomiar, oferta), klik klienta tego nie cofa.
 * Feedback zapisuje się też przy ostatniej wycenie, bo z tego liczy się
 * statystyka „ile procent uznało cenę za wysoką" per rodzaj materiału.
 */
/**
 * STAWKI ZAKŁADU (panel → kalkulator)
 *
 * Stawki naszej pracy, które Dawid ustawia w panelu (montaż, obróbka,
 * wycięcia, otwory). Leżą w tabeli `ustawienia` jako pary klucz→liczba;
 * kalkulator dopytuje o nie przy starcie strony, a bez nich liczy
 * wartościami domyślnymi z kodu.
 *
 * To NASZE ceny sprzedaży — cen zakupu materiału ani przeliczników
 * dostawców tu nie ma i być nie może.
 */
export async function odczytajStawki(env) {
  if (!env.BAZA) return {};
  const wynik = await env.BAZA.prepare(`SELECT klucz, wartosc FROM ustawienia`).all();
  const stawki = {};
  for (const w of wynik.results || []) {
    const liczba = Number(w.wartosc);
    if (Number.isFinite(liczba)) stawki[w.klucz] = liczba;
  }
  return stawki;
}

/**
 * Zapis stawek z panelu. Przyjmuje wyłącznie klucze z listy dozwolonych
 * i liczby nieujemne — panel jest jedynym wołającym, ale baza nie może
 * zależeć od tego, że formularz się nie pomyli.
 */
export async function zapiszStawki(env, stawki, dozwolone) {
  const czas = teraz();
  let zapisanych = 0;
  for (const [klucz, wartosc] of Object.entries(stawki || {})) {
    if (!dozwolone.includes(klucz)) continue;
    const liczba = Number(wartosc);
    if (!Number.isFinite(liczba) || liczba < 0) continue;
    await env.BAZA.prepare(
      `INSERT INTO ustawienia (klucz, wartosc, zmieniono) VALUES (?, ?, ?)
       ON CONFLICT(klucz) DO UPDATE SET wartosc = excluded.wartosc, zmieniono = excluded.zmieniono`
    )
      .bind(klucz, String(liczba), czas)
      .run();
    zapisanych++;
  }
  return zapisanych;
}

export async function zapiszFeedback(env, dane) {
  const baza = env.BAZA;
  if (!baza) return null;

  const feedback = String(dane.feedback || '');
  if (!FEEDBACKI.includes(feedback)) return null;

  // Ze strony wyceny online klient jest znany wprost (token → klientId);
  // z kalkulatora rozpoznajemy go po telefonie albo mailu z bramki.
  const klient = dane.klientId
    ? await baza.prepare(`SELECT id FROM klienci WHERE id = ?`).bind(Number(dane.klientId)).first()
    : await znajdzKlienta(baza, kluczTelefonu(dane.telefon), kluczEmaila(dane.email));
  if (!klient?.id) return null;

  const budzet = String(dane.budzet || '').slice(0, 40);
  const pora = String(dane.pora || '').slice(0, 40);
  // Który wariant materiałowy wskazał klient (zlecenie z 25.08.2026).
  // To jest NAJWAŻNIEJSZA informacja z całego feedbacku: mówi wprost,
  // na czym Dawid ma oprzeć rozmowę, więc ląduje w notatce.
  const wariant = String(dane.wariant || '').slice(0, 120);

  await baza
    .prepare(
      `UPDATE klienci SET feedback = ?,
                          budzet = COALESCE(NULLIF(?, ''), budzet),
                          pora = COALESCE(NULLIF(?, ''), pora),
                          status = CASE WHEN ? = 'pasuje' AND status = 'nowy' THEN 'cieply' ELSE status END,
                          ruch = ?
       WHERE id = ?`
    )
    .bind(feedback, budzet, pora, feedback, teraz(), klient.id)
    .run();

  await baza
    .prepare(
      `UPDATE wyceny SET feedback = ? WHERE id =
         (SELECT id FROM wyceny WHERE klient_id = ? ORDER BY utworzono DESC, id DESC LIMIT 1)`
    )
    .bind(feedback, klient.id)
    .run();

  const szczegol = [
    wariant && `wybrał wariant: ${wariant}`,
    pora && `pora: ${pora}`,
    budzet && `budżet: ${budzet}`,
  ]
    .filter(Boolean)
    .join(', ');
  await dopiszNotatke(
    baza,
    klient.id,
    'system',
    `Klient po wycenie: ${OPIS_FEEDBACKU[feedback]}${szczegol ? ` (${szczegol})` : ''}`
  );

  return { klientId: klient.id };
}

/**
 * Ile procent klientów uznało cenę za dobrą / za wysoką / do przemyślenia —
 * osobno dla konglomeratu, spieku i kamienia naturalnego. Z tego Dawid
 * ocenia, czy poziom cen w danym materiale trzyma się rynku.
 */
export async function statystykaFeedbacku(env) {
  const wiersze = await env.BAZA.prepare(
    `SELECT kategoria, feedback, COUNT(*) AS ile FROM wyceny WHERE feedback != '' GROUP BY kategoria, feedback`
  ).all();

  const wg = {};
  for (const w of wiersze.results || []) {
    const kat = w.kategoria || 'inne';
    wg[kat] = wg[kat] || { razem: 0, pasuje: 0, za_drogo: 0, zastanowi: 0 };
    wg[kat][w.feedback] = w.ile;
    wg[kat].razem += w.ile;
  }
  return wg;
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

/**
 * ══════════════════════════════════════════════════════════════════════════
 *  PANEL BAZY KLIENTÓW — dla Dawida, pod adresem workera:
 *
 *      https://k24h.kamieniarstwo24h.workers.dev/panel
 *
 *  Panel NIE stoi na kam24h.pl: siedzi przy bazie, nie ma go w mapie
 *  witryny ani w buildzie Netlify, a nagłówek X-Robots-Tag trzyma go poza
 *  wyszukiwarką.
 *
 *  DOSTĘP: hasło z sekretu PANEL_HASLO (Cloudflare → Variables and Secrets).
 *  Po zalogowaniu leci podpisane ciasteczko ważne 30 dni — na telefonie
 *  nie trzeba logować się przy każdym wejściu. Po kilku błędnych hasłach
 *  z tego samego adresu panel milknie na kwadrans.
 * ══════════════════════════════════════════════════════════════════════════
 */

import { resend, nadawca, doDawida } from './poczta.js';
import { linkPlyty } from '../src/app/magazyn-linki.js';
import { sprawdzWiadomosc } from './rozmowa.js';
import { TEMAT_DO_KLIENTA, mailDoKlienta } from './mail-rozmowa.js';

import {
  STATUSY,
  W_LEJKU,
  RETENCJA_MIESIECY,
  podsumowanie,
  lista,
  karta,
  ustawStatus,
  ustawOddzwonic,
  dodajNotatke,
  skasujKlienta,
  posprzataj,
  csv,
  statystykaFeedbacku,
  odczytajMeta,
  zapiszMeta,
  odczytajStawki,
  zapiszStawki,
  dopiszWiadomosc,
  rozmowaOferty,
} from './baza.js';
import {
  listaPlyt,
  zapiszPlyte,
  ustawPublikacje,
  ustawDostepnosc,
  skasujPlyte,
} from './wyprzedaz-baza.js';

/*
 * STAWKI ZAKŁADU EDYTOWALNE W PANELU.
 *
 * Lista musi zgadzać się z PARAMETRY w src/app/ustawienia.js — tam siedzą
 * wartości domyślne i nakładanie ich na firmy. Tutaj są tylko etykiety
 * dla formularza i lista dozwolonych kluczy (baza nie ufa formularzowi).
 *
 * To NASZE ceny sprzedaży. Cen zakupu materiału ani przeliczników
 * dostawców w panelu nie ma — te żyją w pricing/zrodla, poza repozytorium.
 */
const STAWKI = [
  { klucz: 'obrobkaZaM2', label: 'Obróbka blatu (docięcie, polerowanie, klejenie)', jednostka: 'zł/m² blatu', domyslnie: 200, opis: '0 = w cenie, bez naliczenia' },
  { klucz: 'obrobkaNaturalnaZaM2', label: 'Dodatek: obróbka kamienia naturalnego', jednostka: 'zł/m² blatu', domyslnie: 0, opis: 'ponad stawkę obróbki, tylko kamień naturalny' },
  { klucz: 'montazBaza', label: 'Montaż — baza (dojazd, wniesienie)', jednostka: 'zł raz na zlecenie', domyslnie: 1500 },
  { klucz: 'montazZaM2', label: 'Montaż — stawka od powierzchni', jednostka: 'zł/m² blatu', domyslnie: 200 },
  { klucz: 'pomiar', label: 'Pomiar Proliner (tylko kuchnia)', jednostka: 'zł raz na zlecenie', domyslnie: 1000 },
  { klucz: 'zlewPodblatowy', label: 'Wycięcie + montaż zlewu podblatowego', jednostka: 'zł/szt.', domyslnie: 650 },
  { klucz: 'udzialNablatowego', label: 'Zlew nablatowy — część ceny podblatowego', jednostka: '× (0,5 = połowa)', domyslnie: 0.5, krok: 0.05 },
  { klucz: 'plytaNakladana', label: 'Wycięcie pod płytę nakładaną', jednostka: 'zł', domyslnie: 250 },
  { klucz: 'plytaLicowana', label: 'Wycięcie pod płytę licowaną', jednostka: 'zł', domyslnie: 650 },
  { klucz: 'otwor', label: 'Otwór w blacie', jednostka: 'zł/szt.', domyslnie: 150 },
  { klucz: 'mat', label: 'Dopłata: powierzchnia matowa / strukturalna', jednostka: 'zł/m²', domyslnie: 60 },
  { klucz: 'listwa', label: 'Listwa przyścienna', jednostka: 'zł/m.b.', domyslnie: 180 },
  { klucz: 'krawedz', label: 'Wykończenie krawędzi', jednostka: 'zł/m.b.', domyslnie: 90 },
  { klucz: 'rzazMm', label: 'Rozrys: rzaz piły', jednostka: 'mm', domyslnie: 3, opis: 'parametr cięcia, nie cena' },
  { klucz: 'marginesPlytyMm', label: 'Rozrys: margines krawędzi płyty', jednostka: 'mm', domyslnie: 10, opis: 'parametr cięcia, nie cena' },
];
const KLUCZE_STAWEK = STAWKI.map((s) => s.klucz);

const CIASTKO = 'k24h_panel';
const WAZNOSC_DNI = 30;
const MAKS_PROB = 8;

/* ────────────────────────────────────────────────────────────── routing */

export async function obsluzPanel(request, env) {
  const url = new URL(request.url);
  const sciezka = url.pathname.replace(/\/$/, '') || '/panel';

  if (!env.PANEL_HASLO) return odpowiedzHtml(stronaBledu('Panel nie ma ustawionego hasła.'), 503);
  if (!env.BAZA) return odpowiedzHtml(stronaBledu('Panel nie ma podpiętej bazy.'), 503);

  if (sciezka === '/panel/login' && request.method === 'POST') return await zaloguj(request, env);
  if (sciezka === '/panel/wyloguj') return wyloguj();

  const wpuszczony = await sprawdzCiastko(request, env);
  if (!wpuszczony) {
    if (sciezka.startsWith('/panel/api')) return json({ error: 'Brak dostępu.' }, 401);
    return odpowiedzHtml(stronaLogowania());
  }

  if (sciezka === '/panel') return await stronaPanelu(env);
  if (sciezka === '/panel/api/dane') return await apiDane(request, env);
  if (sciezka === '/panel/api/karta') return await apiKarta(request, env);
  if (sciezka === '/panel/api/zmien' && request.method === 'POST') return await apiZmien(request, env);
  if (sciezka === '/panel/api/csv') return await apiCsv(env);
  if (sciezka === '/panel/api/stawki') return await apiStawki(request, env);
  if (sciezka === '/panel/api/test') return await apiTest(request, env);
  if (sciezka === '/panel/api/odpowiedz' && request.method === 'POST')
    return await apiOdpowiedz(request, env);
  if (sciezka === '/panel/api/wyprzedaz') return await apiWyprzedaz(request, env);
  if (sciezka === '/panel/api/wyprzedaz/zapisz' && request.method === 'POST')
    return await apiWyprzedazZapisz(request, env);
  if (sciezka === '/panel/api/wyprzedaz/publikuj' && request.method === 'POST')
    return await apiWyprzedazPublikuj(request, env);
  if (sciezka === '/panel/api/wyprzedaz/dostepnosc' && request.method === 'POST')
    return await apiWyprzedazDostepnosc(request, env);
  if (sciezka === '/panel/api/wyprzedaz/usun' && request.method === 'POST')
    return await apiWyprzedazUsun(request, env);

  return json({ error: 'Nieznany adres panelu.' }, 404);
}

/* ─────────────────────────────────────────────────────────── logowanie */

/**
 * Ciasteczko to `wygasa.podpis`, gdzie podpis = HMAC-SHA256 z hasła.
 * Nie ma sesji w bazie: znajomość hasła jest jedynym sekretem, a zmiana
 * hasła unieważnia wszystkie wydane ciasteczka.
 */
export async function podpisz(sekret, tekst) {
  const klucz = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(sekret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const podpis = await crypto.subtle.sign('HMAC', klucz, new TextEncoder().encode(tekst));
  return [...new Uint8Array(podpis)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Porównanie odporne na mierzenie czasu — hasło i podpis to sekrety. */
function rowneStale(a, b) {
  const x = String(a);
  const y = String(b);
  if (x.length !== y.length) return false;
  let r = 0;
  for (let i = 0; i < x.length; i++) r |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return r === 0;
}

async function sprawdzCiastko(request, env) {
  const ciastka = String(request.headers.get('cookie') || '');
  const wartosc = ciastka
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(CIASTKO + '='))
    ?.slice(CIASTKO.length + 1);
  if (!wartosc) return false;

  const [wygasa, podpis] = wartosc.split('.');
  if (!wygasa || !podpis) return false;
  if (Number(wygasa) < Date.now()) return false;
  return rowneStale(podpis, await podpisz(env.PANEL_HASLO, 'panel|' + wygasa));
}

async function zaloguj(request, env) {
  const ip = request.headers.get('cf-connecting-ip') || 'nieznany';
  const blokada = await sprawdzBlokade(env, ip);
  if (blokada) return odpowiedzHtml(stronaLogowania('Za dużo prób. Proszę spróbować za kwadrans.'), 429);

  const dane = await request.formData().catch(() => null);
  const haslo = String(dane?.get('haslo') || '');

  if (!rowneStale(haslo, env.PANEL_HASLO)) {
    await zapiszNieudane(env, ip);
    return odpowiedzHtml(stronaLogowania('Nieprawidłowe hasło.'), 401);
  }

  await env.BAZA.prepare(`DELETE FROM logowania WHERE ip = ?`).bind(ip).run();

  const wygasa = Date.now() + WAZNOSC_DNI * 86400000;
  const ciastko =
    `${CIASTKO}=${wygasa}.${await podpisz(env.PANEL_HASLO, 'panel|' + wygasa)}; ` +
    `Path=/panel; Max-Age=${WAZNOSC_DNI * 86400}; HttpOnly; Secure; SameSite=Lax`;

  return new Response(null, { status: 302, headers: { location: '/panel', 'set-cookie': ciastko } });
}

function wyloguj() {
  return new Response(null, {
    status: 302,
    headers: {
      location: '/panel',
      'set-cookie': `${CIASTKO}=; Path=/panel; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
    },
  });
}

async function sprawdzBlokade(env, ip) {
  const w = await env.BAZA.prepare(`SELECT proby, do_kiedy FROM logowania WHERE ip = ?`)
    .bind(ip)
    .first();
  return w && w.proby >= MAKS_PROB && w.do_kiedy > new Date().toISOString();
}

async function zapiszNieudane(env, ip) {
  const doKiedy = new Date(Date.now() + 15 * 60000).toISOString();
  await env.BAZA.prepare(
    `INSERT INTO logowania (ip, proby, do_kiedy) VALUES (?, 1, ?)
     ON CONFLICT(ip) DO UPDATE SET
       proby = CASE WHEN logowania.do_kiedy < ? THEN 1 ELSE logowania.proby + 1 END,
       do_kiedy = ?`
  )
    .bind(ip, doKiedy, new Date().toISOString(), doKiedy)
    .run();
}

/* ──────────────────────────────────────────────────────────────── API */

async function apiDane(request, env) {
  const p = new URL(request.url).searchParams;
  const filtry = {
    status: p.get('status') || '',
    termin: p.get('termin') || '',
    szukaj: p.get('szukaj') || '',
    od: p.get('od') || '',
    do: p.get('do') || '',
    kwotaOd: p.get('kwotaOd') || '',
  };

  const [suma, naDzis, wszystkie, feedback] = await Promise.all([
    podsumowanie(env),
    lista(env, { naDzis: true }),
    lista(env, filtry),
    statystykaFeedbacku(env),
  ]);

  // Licznik „nowych od ostatniego wejścia" przesuwamy dopiero po odczycie,
  // żeby Dawid zobaczył liczbę, zanim się wyzeruje.
  await zapiszMeta(env.BAZA, 'ostatnie-wejscie', new Date().toISOString());

  return json({
    podsumowanie: suma,
    naDzis,
    lista: wszystkie,
    statusy: STATUSY,
    wLejku: W_LEJKU,
    feedback,
  });
}

async function apiKarta(request, env) {
  const id = Number(new URL(request.url).searchParams.get('id'));
  const k = id ? await karta(env, id) : null;
  if (!k) return json({ error: 'Nie ma takiej karty.' }, 404);

  /*
   * „Powtórz wycenę": link do kalkulatora z wczytanymi parametrami tej
   * wyceny i podpisem właściciela (HMAC z hasła panelu, ważny 7 dni).
   * Parametry jadą we FRAGMENCIE adresu (#…) — fragment nie wychodzi
   * w referrerze ani do statystyk, więc podpis nigdzie nie wycieka.
   */
  const exp = Date.now() + 7 * 86400000;
  const sig = await podpisz(env.PANEL_HASLO, `oferta|${k.id}|${exp}`);
  const doBase64 = (obj) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(obj))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

  for (const w of k.wyceny) {
    /*
     * PODGLĄD WYSŁANEJ OFERTY (zlecenie Dawida, 25.08.2026):
     * „chciałbym mieć dostęp również do wysłanej nowej wyceny do klienta".
     *
     * Link prowadzi na tę samą stronę co link z maila, więc Dawid widzi
     * DOKŁADNIE to, co klient — razem z jego wiadomością, rozrysem
     * i wariantami, w wersji zamrożonej w chwili wysyłki.
     *
     * Doklejamy podpis właściciela, żeby strona zapytała o dane w trybie
     * PODGLĄDU. Bez tego każde zajrzenie Dawida podbijałoby licznik
     * „klient obejrzał" i statystyka, po której pozna, czy oferta została
     * przeczytana, przestałaby cokolwiek znaczyć.
     */
    if (w.wersja === 'dawid' && w.token) {
      w.podglad =
        'https://kam24h.pl/oferta#' +
        w.token +
        '~' +
        doBase64({ leadId: k.id, exp, podpis: sig });
    }

    /*
     * AKTUALIZUJ OFERTĘ (zlecenie Dawida, 25.08.2026): otwiera edytor
     * z parametrami TEJ oferty i tokenem wątku, więc kolejna wersja
     * pójdzie pod tym samym linkiem, który klient już ma.
     */
    if (w.wersja === 'dawid' && w.watek && w.dane?.parametry) {
      w.aktualizuj =
        'https://kam24h.pl/#powtorz=' +
        doBase64({
          leadId: k.id, exp, podpis: sig, imie: k.imie,
          parametry: w.dane.parametry, watek: w.watek,
        });
    }

    /*
     * LINK DO PŁYTY W MAGAZYNIE (zlecenie Dawida, 26.08.2026):
     * „ciężko mi ją znaleźć na magazynie". Kod płyty leży w kolumnie
     * `kod_plyty`, a przy ofertach Dawida także w zamrożonych danych.
     * Adres składamy TU, po stronie serwera, bo przeglądarkowy skrypt
     * panelu siedzi w szablonie i nie ma jak zaimportować modułu.
     */
    const kod = w.kod_plyty || w.dane?.kodPlyty || '';
    if (kod) {
      w.kodPlyty = kod;
      w.magazyn = linkPlyty(kod);
    }

    if (w.wersja || !w.dane || !w.dane.firma) continue; // tylko wyceny klienta z parametrami
    w.powtorz =
      'https://kam24h.pl/#powtorz=' +
      doBase64({ leadId: k.id, exp, podpis: sig, parametry: w.dane, imie: k.imie });
  }
  return json(k);
}

async function apiZmien(request, env) {
  const d = await request.json().catch(() => null);
  const id = Number(d?.id);
  if (!d || !id) return json({ error: 'Brak karty.' }, 400);

  if (d.status !== undefined && !(await ustawStatus(env, id, d.status)))
    return json({ error: 'Nieznany status.' }, 400);
  if (d.oddzwonic !== undefined) await ustawOddzwonic(env, id, d.oddzwonic);
  if (d.notatka !== undefined) await dodajNotatke(env, id, d.notatka);
  if (d.skasuj === true) {
    await skasujKlienta(env, id);
    return json({ ok: true, skasowany: true });
  }

  return json({ ok: true, karta: await karta(env, id) });
}

/**
 * Stawki zakładu: odczyt (GET) i zapis (POST) z panelu.
 * Zapis idzie przez listę dozwolonych kluczy — nic spoza STAWKI nie wejdzie.
 */
async function apiStawki(request, env) {
  if (request.method === 'POST') {
    const d = await request.json().catch(() => null);
    if (!d || typeof d !== 'object') return json({ error: 'Niepoprawne dane.' }, 400);
    const ile = await zapiszStawki(env, d.stawki, KLUCZE_STAWEK);
    return json({ ok: true, zapisanych: ile, stawki: await odczytajStawki(env) });
  }
  return json({ ok: true, opis: STAWKI, stawki: await odczytajStawki(env) });
}

/**
 * WYPRZEDAŻ PŁYT (zlecenie Dawida, 30.08.2026).
 *
 * Panel widzi WSZYSTKO — szkice, opublikowane i sprzedane naraz
 * (`wszystkie: true`), bo Dawid musi móc dokończyć szkic i odkręcić
 * pomyłkowe „sprzedana". Produkcja (worker.template.js `/wyprzedaz`)
 * widzi wyłącznie płyty dostępne. Filtr jest zamierzenie w dwóch
 * miejscach: tu decyduje WIDOCZNOŚĆ DLA DAWIDA, tam WIDOCZNOŚĆ DLA
 * KLIENTA — i to są dwa różne pytania.
 */
async function apiWyprzedaz(request, env) {
  const plyty = await listaPlyt(env, { wszystkie: true });
  const zLinkiem = await Promise.all(
    plyty.map(async (p) => ({ ...p, linkPodgladu: await linkPodgladuWyprzedazy(env, p.id) }))
  );
  return json({ ok: true, plyty: zLinkiem });
}

/**
 * Link „Podgląd" — Dawid otwiera DOKŁADNIE tę samą stronę i ten sam kod,
 * co klient zobaczy po publikacji, tylko z jednym doklejonym szkicem.
 * Podpis ważny 14 dni: dłużej, niż zwykle trwa dopracowanie oferty,
 * a krócej niż „na zawsze", gdyby link kiedyś wyciekł.
 */
async function linkPodgladuWyprzedazy(env, id) {
  const exp = Date.now() + 14 * 24 * 3600000;
  const podpis = await podpisz(env.PANEL_HASLO, `wyprzedaz|${id}|${exp}`);
  const paczka = { podgladId: id, exp, podpis };
  const bajty = new TextEncoder().encode(JSON.stringify(paczka));
  const b64 = btoa(String.fromCharCode(...bajty))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `https://kam24h.pl/wyprzedaz-plyt#wyprzedazPodglad=${b64}`;
}

/** Zapis (nowa płyta albo edycja) — walidacja siedzi w wyprzedaz-baza.js. */
async function apiWyprzedazZapisz(request, env) {
  const d = await request.json().catch(() => null);
  if (!d || typeof d !== 'object') return json({ error: 'Niepoprawne dane.' }, 400);
  const wynik = await zapiszPlyte(env, d);
  if (!wynik.ok) return json({ error: wynik.blad }, 400);
  return json({
    ok: true,
    id: wynik.id,
    plyta: { ...wynik.plyta, linkPodgladu: await linkPodgladuWyprzedazy(env, wynik.id) },
  });
}

/**
 * Publikacja / cofnięcie — osobny krok od zapisu, żeby „chcę to zobaczyć,
 * zanim pójdzie na stronę" (warunek Dawida) było naprawdę osobnym
 * kliknięciem, a nie zgadywaniem, czy zapis od razu publikuje.
 *
 * Wyłącznie z zalogowanego panelu (jak reszta /panel/api) — strona
 * podglądu NIE publikuje sama, tylko odsyła Dawida z powrotem do panelu.
 * Jedno miejsce publikacji jest prostsze do obronienia niż dwie ścieżki
 * autoryzacji dla tej samej operacji.
 */
async function apiWyprzedazPublikuj(request, env) {
  const d = await request.json().catch(() => null);
  const id = Number(d?.id);
  if (!id) return json({ error: 'Brak płyty.' }, 400);
  const ok = await ustawPublikacje(env, id, d?.opublikowana !== false);
  if (!ok) return json({ error: 'Nie znaleziono płyty.' }, 404);
  return json({ ok: true });
}

/** „Sprzedana" / „wróciła" — zmiana licznika sztuk bez kasowania wiersza. */
async function apiWyprzedazDostepnosc(request, env) {
  const d = await request.json().catch(() => null);
  const id = Number(d?.id);
  if (!id) return json({ error: 'Brak płyty.' }, 400);
  const ok = await ustawDostepnosc(env, id, d?.plytZostalo);
  if (!ok) return json({ error: 'Nie znaleziono płyty.' }, 404);
  return json({ ok: true });
}

async function apiWyprzedazUsun(request, env) {
  const d = await request.json().catch(() => null);
  const id = Number(d?.id);
  if (!id) return json({ error: 'Brak płyty.' }, 400);
  return json({ ok: await skasujPlyte(env, id) });
}

/**
 * WYCENA TESTOWA — podpisany link do kalkulatora w trybie właściciela,
 * bez żadnego leada. Dawid sprawdza skutki zmiany stawek jednym kliknięciem,
 * a baza klientów i statystyki zostają nietknięte (`leadId: 0` — worker
 * nie ma czego zapisać, więc wysyłka jest wyłączona po stronie edytora).
 */
async function apiTest(request, env) {
  const p = new URL(request.url).searchParams;
  const exp = Date.now() + 2 * 3600000;
  const paczka = {
    leadId: 0,
    test: true,
    exp,
    podpis: await podpisz(env.PANEL_HASLO, `oferta|0|${exp}`),
    imie: 'wycena testowa',
    parametry: {
      firma: p.get('firma') || 'avant-quartz',
      dekor: p.get('dekor') || '',
      grubosc: p.get('grubosc') || '20',
      odcinki: [{ gl: Number(p.get('gl')) || 60, dl: Number(p.get('dl')) || 300 }],
      opcje: {
        pomieszczenie: 'kuchnia',
        zlew: 'podblat',
        zlewy: 1,
        plyta: 'nakladana',
        otwory: Number(p.get('otwory')) || 2,
        dostawa: 'montaz',
      },
    },
  };
  const bajty = new TextEncoder().encode(JSON.stringify(paczka));
  const b64 = btoa(String.fromCharCode(...bajty))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return json({ ok: true, link: `https://kam24h.pl/#powtorz=${b64}` });
}

/**
 * DAWID ODPISUJE W WĄTKU (zlecenie z 24.08.2026).
 *
 * Wątek wisi przy konkretnej wycenie, więc przychodzi tu `wycena` — i to
 * z niej bierzemy klienta oraz token do linku. Adres oferty NIE przychodzi
 * z przeglądarki: składamy go z tokenu w bazie, żeby nikt nie podstawił
 * klientowi cudzego linku.
 */
async function apiOdpowiedz(request, env) {
  const d = await request.json().catch(() => null);
  const wycenaId = Number(d?.wycena);
  if (!wycenaId) return json({ error: 'Brak wyceny.' }, 400);

  const sprawdzenie = sprawdzWiadomosc(d?.tresc, {});
  if (!sprawdzenie.ok) return json({ error: sprawdzenie.powod }, 400);

  const w = await env.BAZA.prepare(
    `SELECT id, klient_id, token, opis FROM wyceny WHERE id = ? LIMIT 1`
  )
    .bind(wycenaId)
    .first();
  if (!w) return json({ error: 'Nie ma takiej wyceny.' }, 404);

  await dopiszWiadomosc(env, {
    wycenaId: w.id,
    klientId: w.klient_id,
    autor: 'dawid',
    tresc: sprawdzenie.tresc,
  });

  const klient = await env.BAZA.prepare(`SELECT imie, email FROM klienci WHERE id = ?`)
    .bind(w.klient_id)
    .first();

  // Mail tylko wtedy, gdy jest gdzie i po co: bez adresu albo bez tokenu
  // odpowiedź zostaje w panelu, a Dawid widzi to po zwróconym `mail:false`.
  let mail = false;
  if (klient?.email && w.token) {
    mail = await resend(env, {
      from: nadawca(env),
      to: [klient.email],
      reply_to: doDawida(env),
      subject: TEMAT_DO_KLIENTA,
      html: mailDoKlienta({
        imie: klient.imie,
        tresc: sprawdzenie.tresc,
        link: `https://kam24h.pl/oferta#${w.token}`,
      }),
    });
  }

  return json({ ok: true, mail, rozmowa: await rozmowaOferty(env, w.id) });
}

async function apiCsv(env) {
  return new Response(await csv(env), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="klienci-${new Date().toISOString().slice(0, 10)}.csv"`,
      'x-robots-tag': 'noindex',
    },
  });
}

/* ───────────────────────────────────────────────────────────── strony */

const json = (dane, status = 200) =>
  new Response(JSON.stringify(dane), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'x-robots-tag': 'noindex' },
  });

const odpowiedzHtml = (html, status = 200) =>
  new Response(html, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'x-robots-tag': 'noindex, nofollow',
      'referrer-policy': 'no-referrer',
      'cache-control': 'no-store',
      /*
       * ⚠ `img-src` MUSI tu być — bez niego obowiązuje `default-src 'none'`
       * i przeglądarka blokuje KAŻDY obrazek w panelu.
       *
       * Tak padł upload zdjęć w wyprzedaży płyt (30.08–31.08.2026): kod
       * wczytywał plik, robił podgląd przez `data:` URI — i przeglądarka
       * go blokowała, więc `Image.onerror` odpalał się dla POPRAWNEGO JPEG-a.
       * Dawid dostawał „Nie umiem odczytać tego pliku" niezależnie od formatu
       * i rozmiaru. Nie działały też miniatury przy wierszach płyt.
       * Testy tego nie łapały, bo szły przez API, a nie przez przeglądarkę.
       *
       *   data:  — podgląd zdjęcia zrobiony z canvas przed wysłaniem
       *   'self' — zdjęcia wgrane do bazy, serwowane z /wyprzedaz/zdjecie/<id>
       *   https: — zdjęcia wskazane adresem, które Dawid wkleja w formularzu
       *            (pole „adres w internecie")
       */
      'content-security-policy':
        "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; " +
        "img-src 'self' data: https:; " +
        "connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    },
  });

async function stronaPanelu(env) {
  // Retencja RODO: karty bez ruchu dłużej niż RETENCJA_MIESIECY znikają.
  // Robimy to przy wejściu (raz dziennie), więc nie potrzeba osobnego crona.
  try {
    await posprzataj(env);
  } catch (e) {
    console.error('sprzatanie', e?.message || e);
  }
  return odpowiedzHtml(HTML_PANELU);
}

const STYL = `
/* Rozmowa pod ofertą — dymki jak w czacie: klient z lewej, Dawid z prawej.
 *
 * UWAGA NA KOLORY (bug od Dawida, 25.08.2026): pierwsza wersja dawała
 * dymkom sztywne JASNE tło (#f0ede7) i nie ustawiała koloru tekstu.
 * Panel ma tryb ciemny (prefers-color-scheme), w którym --tekst jest
 * jasny — wychodziło jasne na jasnym i treści nie było widać.
 *
 * Teraz: tła bierzemy ze ZMIENNYCH motywu (działają w obu trybach),
 * a kolor tekstu podajemy JAWNIE przy każdym dymku.
 *
 * Dymki to <li> wewnątrz .log, więc najpierw kasujemy kreski i wcięcia,
 * które .log li na nie nakłada.
 */
.watek{margin:10px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px}
.watek li{max-width:82%;padding:9px 12px;border-top:0;border-left:0;border-radius:12px;
font-size:14px;line-height:1.5;white-space:pre-wrap;word-break:break-word;color:var(--tekst)}
.watek .od-klienta{align-self:flex-start;background:var(--tlo);color:var(--tekst);
border:1px solid var(--linia);border-bottom-left-radius:3px}
/* Złoty odcień przez przezroczystość — dobrze siada i na białym, i na ciemnym. */
.watek .od-dawida{align-self:flex-end;background:rgba(138,106,47,.16);color:var(--tekst);
border:1px solid var(--akcent);border-left:1px solid var(--akcent);padding-left:12px;
border-bottom-right-radius:3px}
.watek .kiedy{display:block;font-size:11px;color:var(--szary);margin-bottom:3px}
.watek .pusto{align-self:stretch;max-width:none;background:none;border:0;padding:0;color:var(--szary)}
.odpowiedz{margin-top:10px}
.odpowiedz textarea{width:100%;min-height:64px;background:var(--pole);color:var(--tekst)}
.nowa-wiad{display:inline-block;margin-left:6px;padding:1px 7px;border-radius:9px;
background:var(--akcent);color:var(--naAkcencie);font-size:11px;font-weight:bold}

:root{--tlo:#f4f4f2;--karta:#fff;--tekst:#17150f;--szary:#6d6a60;--linia:#e2e0d8;
--akcent:#8a6a2f;--zielony:#2f6b3a;--czerwony:#9a3524;--pole:#fff;--naAkcencie:#fff;
color-scheme:light}
@media (prefers-color-scheme:dark){:root{--tlo:#15140f;--karta:#1e1c17;--tekst:#f0eee6;
--szary:#a09b8e;--linia:#332f26;--akcent:#c9a24a;--zielony:#7fbf8c;--czerwony:#e08a76;
--pole:#26241d;--naAkcencie:#17150f;color-scheme:dark}}
*{box-sizing:border-box}
body{margin:0;background:var(--tlo);color:var(--tekst);
font:16px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding-bottom:3rem}
header{position:sticky;top:0;z-index:5;background:var(--karta);border-bottom:1px solid var(--linia);
padding:.7rem .9rem;display:flex;align-items:center;gap:.6rem}
header h1{font-size:1.05rem;margin:0;flex:1}
a,button{font:inherit}
.mini{color:var(--szary);font-size:.82rem}
/* Kod płyty: do zaznaczenia jednym kliknięciem i czytelny w obu motywach —
   kolory jawnie, bo dziedziczone już raz zniknęły w trybie ciemnym. */
.kod-plyty{user-select:all;background:var(--pole);color:var(--tekst);
border:1px solid var(--linia);border-radius:3px;padding:0 .28em;
font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.95em}
/* Wyprzedaż płyt: miniatura obok opisu, żeby Dawid poznawał płytę po
   zdjęciu, a nie po nazwie — na placu leżą trzy podobne granity. */
/* PILNE: jedyna plakietka, ktora ma krzyczec - reszta jest stonowana. */
.znacznik.pilne{background:var(--zloto,#c9a86a);color:#13110f;font-weight:700;
letter-spacing:.05em;border-color:transparent}
.plyta-wiersz{display:flex;gap:.7rem;align-items:flex-start}
.plyta-mini{width:76px;height:56px;object-fit:cover;border-radius:4px;
border:1px solid var(--linia);flex:0 0 auto;background:var(--pole)}
.plyta-mini.pusta{display:flex;align-items:center;justify-content:center;
font-size:.62rem;color:var(--szary);text-align:center;line-height:1.2}
.plyta-tresc{flex:1;min-width:0}
.plyta-akcje{margin-top:.45rem;display:flex;flex-wrap:wrap;gap:.3rem}
.plyta-form label{display:block;margin:.5rem 0}
.plyta-form input,.plyta-form select{width:100%;box-sizing:border-box}
.plyta-form .dwie{display:grid;grid-template-columns:1fr 1fr;gap:.6rem}
main{padding:.9rem;max-width:820px;margin:0 auto}
section{margin-bottom:1.4rem}
h2{font-size:.78rem;letter-spacing:.09em;text-transform:uppercase;color:var(--szary);
margin:0 0 .55rem;font-weight:600}
.chipy{display:flex;flex-wrap:wrap;gap:.4rem}
.chip{background:var(--karta);border:1px solid var(--linia);border-radius:999px;
padding:.3rem .7rem;font-size:.85rem;cursor:pointer;color:inherit}
.chip[aria-pressed="true"]{border-color:var(--akcent);color:var(--akcent);font-weight:600}
.chip b{font-variant-numeric:tabular-nums}
.lejek{background:var(--karta);border:1px solid var(--linia);border-radius:12px;
padding:.75rem .9rem;margin-top:.6rem}
.lejek strong{font-size:1.5rem;font-variant-numeric:tabular-nums;display:block}
.karta{background:var(--karta);border:1px solid var(--linia);border-radius:12px;
padding:.75rem .85rem;margin-bottom:.6rem}
.karta.dzis{border-left:4px solid var(--akcent)}
.karta.goracy{border-left:4px solid var(--zielony)}
.znacznik.dobry{border-color:var(--zielony);color:var(--zielony)}
label.stawka{display:block;font-size:.82rem;color:var(--tekst);margin:0 0 .6rem}
label.stawka input{margin-top:.2rem}
.stawki-siatka{display:grid;grid-template-columns:1fr;gap:.2rem}
@media (min-width:620px){.stawki-siatka{grid-template-columns:1fr 1fr;gap:.2rem .9rem}}
.zmieniona{color:var(--akcent)}
table.reakcje{width:100%;border-collapse:collapse;font-size:.88rem}
table.reakcje th{font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;color:var(--szary);
font-weight:600;text-align:left;padding:.15rem .5rem .3rem 0}
table.reakcje td{padding:.25rem .5rem .25rem 0;border-top:1px solid var(--linia);font-variant-numeric:tabular-nums}
.gora{display:flex;gap:.5rem;align-items:flex-start}
.gora .kto{flex:1;min-width:0}
.kto b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kwota{font-variant-numeric:tabular-nums;font-weight:600;white-space:nowrap}
.znacznik{display:inline-block;font-size:.72rem;padding:.1rem .45rem;border-radius:999px;
border:1px solid var(--linia);color:var(--szary);margin-right:.3rem}
.znacznik.flaga{border-color:var(--czerwony);color:var(--czerwony)}
.akcje{display:flex;gap:.4rem;margin-top:.6rem}
.akcje a,.akcje button{flex:1;text-align:center;text-decoration:none;padding:.55rem .3rem;
border-radius:9px;border:1px solid var(--linia);background:var(--pole);color:inherit;cursor:pointer}
.akcje a.dzwon{background:var(--akcent);border-color:var(--akcent);color:#fff;font-weight:600}
.szczegoly{margin-top:.7rem;border-top:1px solid var(--linia);padding-top:.7rem}
label{display:block;font-size:.78rem;color:var(--szary);margin:.55rem 0 .2rem}
/* Kolor podajemy JAWNIE, nie przez inherit — patrz uwaga przy <option>. */
select,input,textarea{width:100%;padding:.5rem;border:1px solid var(--linia);border-radius:9px;
background:var(--pole);color:var(--tekst)}
/* <option> stylujemy BEZPOŚREDNIO: rozwinięta lista to widżet systemowy,
   ktory na Windows rysuje sie na bialym tle. W trybie ciemnym --tekst jest
   jasny — wychodzilo jasne na bialym (kontrast 1,16) i klient Dawida
   „nie widzial nic w rozwijanych". */
option,optgroup{background:var(--pole);color:var(--tekst)}
input::placeholder,textarea::placeholder{color:var(--szary)}
textarea{min-height:4.2rem;resize:vertical}
.btn{background:var(--akcent);color:var(--naAkcencie);border:0;border-radius:9px;padding:.55rem 1rem;
cursor:pointer;font-weight:600}
.btn.cichy{background:transparent;color:var(--szary);border:1px solid var(--linia);font-weight:400}
.log{list-style:none;margin:.5rem 0 0;padding:0;font-size:.88rem}
.log li{border-top:1px solid var(--linia);padding:.4rem 0}
.log .kiedy{color:var(--szary);font-size:.76rem}
.log li.system{color:var(--szary)}
.log li.od-dawida{border-left:3px solid var(--akcent);padding-left:.5rem}
.filtry{display:grid;grid-template-columns:1fr 1fr;gap:.5rem}
.filtry .szeroko{grid-column:1/-1}
.pusto{color:var(--szary);padding:.6rem 0}
form.logowanie{max-width:22rem;margin:16vh auto;padding:1.4rem;background:var(--karta);
border:1px solid var(--linia);border-radius:14px}
form.logowanie h1{font-size:1.1rem;margin:0 0 1rem}
.blad{color:var(--czerwony);font-size:.88rem;margin-bottom:.6rem}
`;

const stronaLogowania = (blad = '') => `<!doctype html><html lang="pl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Baza klientów</title><style>${STYL}</style></head>
<body><form class="logowanie" method="post" action="/panel/login">
<h1>Baza klientów</h1>
${blad ? `<p class="blad">${blad}</p>` : ''}
<label for="haslo">Hasło</label>
<input id="haslo" name="haslo" type="password" autocomplete="current-password" autofocus>
<p><button class="btn" type="submit">Wejdź</button></p>
<p class="mini">Dostęp tylko dla właściciela. Po zalogowaniu urządzenie pamięta dostęp przez 30 dni.</p>
</form></body></html>`;

const stronaBledu = (tresc) => `<!doctype html><html lang="pl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Baza klientów</title><style>${STYL}</style></head>
<body><form class="logowanie"><h1>Baza klientów</h1><p class="blad">${tresc}</p>
<p class="mini">Ustaw brakującą konfigurację w panelu Cloudflare i odśwież stronę.</p></form></body></html>`;

/* Aplikacja panelu. Skrypt celowo bez szablonów z odwrotnym apostrofem —
   cały plik jest literałem szablonowym, więc obyłoby się bez ucieczek. */
const HTML_PANELU = `<!doctype html><html lang="pl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Baza klientów</title><style>${STYL}</style></head>
<body>
<header><h1>Baza klientów</h1><span id="nowe" class="mini"></span>
<a class="mini" href="/panel/wyloguj">Wyloguj</a></header>
<main>
  <section id="podsumowanie"></section>
  <section id="dzis"></section>
  <section id="reakcje"></section>
  <section id="stawki"></section>
  <section id="wyprzedaz"></section>
  <section>
    <h2>Wszystkie zgłoszenia</h2>
    <div class="filtry">
      <select id="f-status"><option value="">Każdy status</option></select>
      <select id="f-termin">
        <option value="">Każdy termin</option>
        <option value="pilne">Tylko PILNE (do 2 tyg.)</option>
        <option value="miesiac">W ciągu miesiąca</option>
        <option value="kwartal">Za 1–3 miesiące</option>
        <option value="pol_roku">Za 3–6 miesięcy</option>
        <option value="pozniej">Później — dopiero planuje</option>
      </select>
      <input id="f-kwota" type="number" inputmode="numeric" placeholder="Kwota od (zł)">
      <input id="f-od" type="date" aria-label="Zgłoszenia od">
      <input id="f-do" type="date" aria-label="Zgłoszenia do">
      <input id="f-szukaj" class="szeroko" type="search" placeholder="Szukaj: nazwisko, telefon, mail, miejscowość">
      <button class="btn cichy szeroko" id="f-czysc" type="button">Wyczyść filtry</button>
    </div>
    <div id="lista"></div>
    <p><a class="mini" href="/panel/api/csv">Pobierz wszystko jako CSV</a>
    &nbsp;·&nbsp;<span class="mini">Karty bez ruchu przez ${RETENCJA_MIESIECY} mies. kasują się same.</span></p>
  </section>
</main>
<script>
var STATUSY = [], dane = null, otwarta = null;

function esc(t){ var d = document.createElement('div'); d.textContent = t == null ? '' : String(t); return d.innerHTML; }
function zl(n){ return (Math.round(Number(n)||0)).toLocaleString('pl-PL') + ' zł'; }
function dzien(iso){ if(!iso) return ''; var d = new Date(iso); return d.toLocaleDateString('pl-PL',{day:'2-digit',month:'2-digit',year:'2-digit'}); }
function godzina(iso){ if(!iso) return ''; var d = new Date(iso); return d.toLocaleString('pl-PL',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}); }
function tel(t){ return String(t||'').replace(/[^0-9+]/g,''); }

function filtry(){
  var p = new URLSearchParams();
  var s = document.getElementById('f-status').value; if(s) p.set('status', s);
  var t = document.getElementById('f-termin').value; if(t) p.set('termin', t);
  var k = document.getElementById('f-kwota').value; if(k) p.set('kwotaOd', k);
  var od = document.getElementById('f-od').value; if(od) p.set('od', od);
  var dd = document.getElementById('f-do').value; if(dd) p.set('do', dd);
  var q = document.getElementById('f-szukaj').value.trim(); if(q) p.set('szukaj', q);
  return p.toString();
}

async function wczytaj(){
  var odp = await fetch('/panel/api/dane?' + filtry(), {headers:{'accept':'application/json'}});
  if(odp.status === 401){ location.reload(); return; }
  dane = await odp.json();
  STATUSY = dane.statusy;
  if(!document.getElementById('f-status').dataset.gotowe){
    var sel = document.getElementById('f-status');
    STATUSY.forEach(function(s){ var o = document.createElement('option'); o.value = s.id; o.textContent = s.nazwa; sel.appendChild(o); });
    sel.dataset.gotowe = '1';
  }
  rysuj();
}

function rysuj(){
  var p = dane.podsumowanie;
  document.getElementById('nowe').textContent = p.nowych ? ('+' + p.nowych + ' nowych') : '';

  var chipy = STATUSY.map(function(s){
    var w = p.statusy[s.id] || {ile:0};
    return '<button class="chip" type="button" data-status="' + s.id + '" aria-pressed="' +
      (document.getElementById('f-status').value === s.id) + '">' + esc(s.nazwa) + ' <b>' + w.ile + '</b></button>';
  }).join('');

  document.getElementById('podsumowanie').innerHTML =
    '<h2>Lejek</h2><div class="chipy">' + chipy + '</div>' +
    '<div class="lejek"><span class="mini">W lejku (ciepły + oferta wysłana)</span>' +
    '<strong>' + zl(p.wLejku) + '</strong></div>';

  document.getElementById('dzis').innerHTML =
    '<h2>Na dziś' + (dane.naDzis.length ? ' (' + dane.naDzis.length + ')' : '') + '</h2>' +
    (dane.naDzis.length ? dane.naDzis.map(function(k){ return kartaHtml(k, true); }).join('')
                        : '<p class="pusto">Nikogo nie trzeba dziś oddzwaniać.</p>');

  document.getElementById('reakcje').innerHTML = reakcjeHtml(dane.feedback);

  rysujStawki();
  rysujWyprzedaz();

  document.getElementById('lista').innerHTML =
    dane.lista.length ? dane.lista.map(function(k){ return kartaHtml(k, false); }).join('')
                      : '<p class="pusto">Brak zgłoszeń dla tych filtrów.</p>';

  if(otwarta) pokazSzczegoly(otwarta, true);
}

function kartaHtml(k, dzis){
  var flagi = (k.flagi||[]).map(function(f){ return '<span class="znacznik flaga">' + esc(opisFlagi(f)) + '</span>'; }).join('');
  if(k.feedback) flagi = znacznikFeedbacku(k) + flagi;
  // PILNE idzie PRZED wszystkim innym - to jest ta jedna rzecz, po ktorej
  // Dawid ustawia kolejnosc obdzwaniania (zlecenie z 30.08.2026).
  if(k.termin === 'pilne') flagi = '<span class="znacznik pilne">PILNE - do 2 tygodni</span>' + flagi;
  var goracy = (k.feedback === 'pasuje' || k.termin === 'pilne') && (k.status === 'nowy' || k.status === 'cieply');
  return '<article class="karta' + (dzis ? ' dzis' : '') + (goracy ? ' goracy' : '') + '" data-id="' + k.id + '">' +
    '<div class="gora"><div class="kto"><b>' + esc(k.imie || 'Klient') + ' · ' + esc(k.miejscowosc || '—') + '</b>' +
    '<span class="mini">' + esc(k.statusNazwa) + ' · ' + dzien(k.utworzono) +
    (k.wycen > 1 ? ' · ' + k.wycen + ' wyceny' : '') +
    (k.termin ? ' · termin: ' + esc(krotkiTermin(k.termin)) : '') +
    (k.oddzwonic ? ' · oddzwonić ' + esc(k.oddzwonic) : '') + '</span></div>' +
    '<span class="kwota">' + zl(k.kwota) + '</span></div>' +
    (flagi ? '<div style="margin-top:.4rem">' + flagi + '</div>' : '') +
    '<div class="akcje">' +
      '<a class="dzwon" href="tel:' + esc(tel(k.telefon)) + '">Zadzwoń</a>' +
      '<a href="sms:' + esc(tel(k.telefon)) + '">SMS</a>' +
      '<a href="mailto:' + esc(k.email) + '">Mail</a>' +
      '<button type="button" data-rozwin="' + k.id + '">Szczegóły</button>' +
    '</div><div class="szczegoly" id="sz-' + k.id + '" hidden></div></article>';
}

var STAWKI_OPIS = [], STAWKI_WART = {};

async function rysujStawki(){
  if(!STAWKI_OPIS.length){
    var d = await (await fetch('/panel/api/stawki')).json();
    STAWKI_OPIS = d.opis || []; STAWKI_WART = d.stawki || {};
  }
  var pola = STAWKI_OPIS.map(function(s){
    var v = (STAWKI_WART[s.klucz] !== undefined) ? STAWKI_WART[s.klucz] : s.domyslnie;
    var domyslna = Number(v) === Number(s.domyslnie);
    return '<label class="stawka">' + esc(s.label) +
      '<span class="mini"> \u2014 ' + esc(s.jednostka) + (s.opis ? ' \u00b7 ' + esc(s.opis) : '') + '</span>' +
      '<input type="number" step="' + (s.krok || 1) + '" min="0" data-stawka="' + s.klucz + '" value="' + v + '">' +
      (domyslna ? '' : '<span class="mini zmieniona">zmieniona (domy\u015blnie ' + s.domyslnie + ')</span>') +
      '</label>';
  }).join('');

  document.getElementById('stawki').innerHTML =
    '<h2>Stawki zak\u0142adu <button class="chip" type="button" id="stawki-pokaz">poka\u017c / ukryj</button></h2>' +
    '<div class="lejek" id="stawki-tresc" hidden>' +
      '<p class="mini">Kwoty brutto przy 23% \u2014 kalkulator sam schodzi do stawki wariantu ' +
      '(8% z monta\u017cem). Zmiana dzia\u0142a od razu, tak\u017ce w wycenach klient\u00f3w.</p>' +
      '<div class="stawki-siatka">' + pola + '</div>' +
      '<p><button class="btn" type="button" id="stawki-zapisz">Zapisz stawki</button> ' +
      '<button class="btn cichy" type="button" id="stawki-test">Wycena testowa \u2197</button></p>' +
      '<p class="mini" id="stawki-info"></p>' +
    '</div>';
}

/**
 * WYPRZEDAZ PLYT (zlecenie Dawida, 30.08.2026) - panel.
 *
 * Jeden wiersz = jedna fizyczna plyta z placu. Dawid wpisuje GOTOWA cene
 * dla klienta (zl/m2 brutto) i sam pilnuje licznika sztuk - plyty schodza
 * tez przez telefon i na miejscu.
 *
 * SZKIC widac TYLKO tutaj i pod podpisanym linkiem "Podglad". Klient
 * zobaczy plyte dopiero po kliknieciu "Opublikuj" - to warunek Dawida.
 *
 * Ten sam formularz sluzy do dodawania i edycji; PLYTA_EDYTOWANA trzyma
 * id edytowanej pozycji albo 'nowa'.
 */
var WYPRZEDAZ = [], PLYTA_EDYTOWANA = null;

async function rysujWyprzedaz(){
  var d = await (await fetch('/panel/api/wyprzedaz')).json();
  WYPRZEDAZ = d.plyty || [];

  var wiersze = WYPRZEDAZ.length
    ? WYPRZEDAZ.map(plytaWiersz).join('')
    : '<p class="pusto">Brak plyt. Dodaj pierwsza - zobaczysz podglad, zanim trafi na strone.</p>';

  document.getElementById('wyprzedaz').innerHTML =
    '<h2>Wyprzedaz plyt <button class="chip" type="button" id="wyprzedaz-pokaz">pokaz / ukryj</button></h2>' +
    '<div class="lejek" id="wyprzedaz-tresc" hidden>' +
      '<p class="mini">Kategoria "NATURA WYPRZEDAZ" w kalkulatorze i strona /wyprzedaz-plyt. ' +
      'Cena jest GOTOWA dla klienta (zl/m2 brutto) - nic do niej nie doliczamy.</p>' +
      '<p><button class="btn" type="button" id="wyprzedaz-nowa">+ Dodaj plyte</button></p>' +
      '<div id="wyprzedaz-formularz"></div>' +
      '<div id="wyprzedaz-lista">' + wiersze + '</div>' +
    '</div>';

  document.getElementById('wyprzedaz-pokaz').onclick = function(){
    var t = document.getElementById('wyprzedaz-tresc');
    t.hidden = !t.hidden;
  };
  document.getElementById('wyprzedaz-nowa').onclick = function(){
    document.getElementById('wyprzedaz-tresc').hidden = false;
    PLYTA_EDYTOWANA = 'nowa';
    rysujPlyteFormularz(null);
  };
  if (PLYTA_EDYTOWANA !== null) {
    document.getElementById('wyprzedaz-tresc').hidden = false;
    rysujPlyteFormularz(PLYTA_EDYTOWANA === 'nowa' ? null : PLYTA_EDYTOWANA);
  }
}

function plytaWiersz(p){
  var sprzedana = p.plytZostalo <= 0;
  var stan = sprzedana
    ? '<span class="znacznik">sprzedana</span>'
    : p.opublikowana
      ? '<span class="znacznik dobry">widoczna dla klientow</span>'
      : '<span class="znacznik">szkic - klient jej nie widzi</span>';

  var bylo = p.cenaNormalnaM2 > 0
    ? '<s>' + p.cenaNormalnaM2 + '</s> ' : '';

  var mini = p.zdjecie
    ? '<img class="plyta-mini" src="' + esc(p.zdjecie) + '" alt="" loading="lazy">'
    : '<span class="plyta-mini pusta">bez zdjecia</span>';

  return '<div class="wiersz plyta-wiersz" data-id="' + p.id + '">' +
    mini +
    '<div class="plyta-tresc">' +
      '<b>' + esc(p.nazwa) + '</b> ' + stan +
      (p.kodPlyty ? ' <span class="kod-plyty">' + esc(p.kodPlyty) + '</span>' : '') +
      '<div class="mini">' + p.plytaDlCm + ' x ' + p.plytaGlCm + ' cm, ' + p.gruboscMm + ' mm' +
        ' &middot; ' + bylo + '<b>' + p.cenaM2 + ' zl/m2</b>' +
        ' &middot; zostalo ' + p.plytZostalo + ' z ' + p.plytRazem +
        (p.opis ? ' &middot; ' + esc(p.opis) : '') +
      '</div>' +
      '<div class="plyta-akcje">' +
        '<button class="btn cichy" type="button" data-akcja="edytuj">Edytuj</button> ' +
        '<a class="btn cichy" href="' + esc(p.linkPodgladu) + '" target="_blank" rel="noopener">Podglad ↗</a> ' +
        '<button class="btn' + (p.opublikowana ? ' cichy' : '') + '" type="button" data-akcja="publikuj">' +
          (p.opublikowana ? 'Cofnij publikacje' : 'Opublikuj') + '</button> ' +
        '<button class="btn cichy" type="button" data-akcja="dostepnosc">' +
          (sprzedana ? 'Wrocila na plac' : 'Sprzedana') + '</button> ' +
        '<button class="btn cichy" type="button" data-akcja="usun">Usun</button>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function rysujPlyteFormularz(id){
  var p = id ? WYPRZEDAZ.find(function(x){ return x.id === id; }) : null;
  var w = function(n, d){ return p && p[n] != null && p[n] !== '' ? p[n] : (d == null ? '' : d); };

  document.getElementById('wyprzedaz-formularz').innerHTML =
    '<div class="lejek plyta-form">' +
      '<h3>' + (p ? 'Edytujesz: ' + esc(p.nazwa) : 'Nowa plyta') + '</h3>' +
      '<label>Nazwa (widzi ja klient)<input id="pl-nazwa" value="' + esc(String(w('nazwa'))) + '" placeholder="np. Granit Star Galaxy"></label>' +
      '<label>Dopisek pod nazwa<input id="pl-opis" value="' + esc(String(w('opis'))) + '" placeholder="np. polerowany, ostatnia sztuka"></label>' +
      '<label>Numer plyty z magazynu<input id="pl-kod" value="' + esc(String(w('kodPlyty'))) + '" placeholder="dla Ciebie - trafia na karte wyceny"></label>' +
      '<label>Rodzaj materialu' +
        '<select id="pl-firma">' +
          '<option value=""' + (w('firmaSlug') ? '' : ' selected') + '>Konglomerat / spiek</option>' +
          '<option value="interstone"' + (w('firmaSlug') === 'interstone' ? ' selected' : '') + '>Kamien naturalny (granit, marmur, kwarcyt)</option>' +
        '</select>' +
      '</label>' +
      '<div class="dwie">' +
        '<label>Dlugosc plyty (cm)<input id="pl-dl" type="number" step="1" value="' + esc(String(w('plytaDlCm', 320))) + '"></label>' +
        '<label>Glebokosc plyty (cm)<input id="pl-gl" type="number" step="1" value="' + esc(String(w('plytaGlCm', 160))) + '"></label>' +
      '</div>' +
      '<div class="dwie">' +
        '<label>Grubosc (mm)<input id="pl-grubosc" type="number" step="1" value="' + esc(String(w('gruboscMm', 20))) + '"></label>' +
        '<label>Ile sztuk masz<input id="pl-razem" type="number" step="1" min="1" value="' + esc(String(w('plytRazem', 1))) + '"></label>' +
      '</div>' +
      '<div class="dwie">' +
        '<label>Cena dla klienta (zl/m2 brutto)<input id="pl-cena" type="number" step="1" value="' + esc(String(w('cenaM2'))) + '"></label>' +
        '<label>Cena "bylo" (opcjonalnie)<input id="pl-cena-bylo" type="number" step="1" value="' + esc(String(w('cenaNormalnaM2', 0))) + '"></label>' +
      '</div>' +
      (p ? '<label>Zostalo sztuk<input id="pl-zostalo" type="number" step="1" min="0" value="' + esc(String(w('plytZostalo', 1))) + '"></label>' : '') +
      '<label>Zdjecie - adres w internecie<input id="pl-zdjecie-url" value="' + esc(String(w('zdjecieUrl'))) + '" placeholder="https://..."></label>' +
      '<label>...albo wgraj plik z dysku<input id="pl-zdjecie-plik" type="file" accept="image/*"></label>' +
      '<p class="mini" id="pl-zdjecie-info">' +
        (p && p.zdjecie ? 'Teraz: <img class="plyta-mini" src="' + esc(p.zdjecie) + '" alt="">' : 'Bez zdjecia karta pokaze sama nazwe.') +
      '</p>' +
      '<p><button class="btn" type="button" id="pl-zapisz">Zapisz</button> ' +
      '<button class="btn cichy" type="button" id="pl-anuluj">Anuluj</button></p>' +
      '<p class="mini" id="pl-info"></p>' +
    '</div>';

  document.getElementById('pl-anuluj').onclick = function(){
    PLYTA_EDYTOWANA = null;
    document.getElementById('wyprzedaz-formularz').innerHTML = '';
  };
  document.getElementById('pl-zdjecie-plik').onchange = wczytajZdjecie;
  document.getElementById('pl-zapisz').onclick = function(){ plytaZapisz(id); };
}

/*
 * ZDJECIE Z DYSKU - zmniejszamy je W PRZEGLADARCE, przed wyslaniem.
 *
 * Telefon Dawida robi zdjecia po kilka megabajtow. Wiersz D1 tego nie
 * uniesie, a i tak nikt nie oglada plyty w rozdzielczosci aparatu.
 *
 * ⚠ HISTORIA BLEDU (30-31.08.2026). Ta funkcja NIE DZIALALA W OGOLE —
 * dla zadnego pliku, nawet dla malego JPEG-a. Przyczyna nie byla tutaj,
 * tylko w naglowku CSP panelu: brakowalo 'img-src', wiec przegladarka
 * blokowala podglad z 'data:' URI i 'Image.onerror' odpalal sie zawsze.
 * Przy okazji naprawy wyszly trzy dalsze usterki, opisane nizej.
 */
var ZDJECIE_DANE = '';
var ZDJECIE_MAKS_BOK = 1200;

/*
 * Limit z workera (wyprzedaz-baza.js) minus zapas na reszte pola.
 * Kompresujemy TAK DLUGO, az sie zmiescimy - patrz 'sprezuj'.
 */
var ZDJECIE_LIMIT = 680000;

/* Formaty, ktorych przegladarka nie zdekoduje - rozpoznajemy PO NAZWIE,
   bo typ MIME z systemu bywa pusty albo ogolny. */
var BEZ_DEKODERA = /\.(heic|heif|avif|tiff?|raw|cr2|nef|arw|dng)$/i;

/**
 * Zmniejsza obraz i dobiera jakosc tak, zeby zmiescic sie w limicie.
 *
 * ⚠ Samo skalowanie do 1200 px NIE WYSTARCZA. Zdjecie o duzej ilosci
 * szczegolow (plyta z wyraznym rysunkiem kamienia) daje po kompresji
 * ponad 900 kB base64 - powyzej limitu workera. Dawid widzial wtedy
 * podglad, klikal „Zapisz" i DOPIERO wtedy dostawal blad. Teraz schodzimy
 * z jakoscia, a potem z rozmiarem, i problem nie dociera do uzytkownika.
 */
function sprezuj(obraz){
  var bok = ZDJECIE_MAKS_BOK;
  var jakosci = [0.82, 0.7, 0.6, 0.5];

  for (var proba = 0; proba < 3; proba++) {
    var skala = Math.min(1, bok / Math.max(obraz.width, obraz.height));
    var plotno = document.createElement('canvas');
    plotno.width = Math.max(1, Math.round(obraz.width * skala));
    plotno.height = Math.max(1, Math.round(obraz.height * skala));
    var ctx = plotno.getContext('2d');
    /* Bialy podklad: JPEG nie zna przezroczystosci, wiec PNG z alfa
       wyszedlby na CZARNYM tle. Zdjecie plyty na czarnym to nie zdjecie. */
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, plotno.width, plotno.height);
    ctx.drawImage(obraz, 0, 0, plotno.width, plotno.height);

    for (var i = 0; i < jakosci.length; i++) {
      var dane = plotno.toDataURL('image/jpeg', jakosci[i]);
      if (dane.length <= ZDJECIE_LIMIT) return dane;
    }
    bok = Math.round(bok * 0.75);   // dalej za duzo - mniejszy obrazek
  }
  return null;
}

function wczytajZdjecie(e){
  var plik = e.target.files && e.target.files[0];
  var info = document.getElementById('pl-zdjecie-info');
  ZDJECIE_DANE = '';
  if (!plik) return;

  var powiedz = function(tekst){ info.textContent = tekst; };

  /* Format bez dekodera w przegladarce - mowimy WPROST co zrobic.
     „Nie umiem odczytac tego pliku" nie pomaga nikomu. */
  if (BEZ_DEKODERA.test(plik.name)) {
    powiedz('Ten format (' + plik.name.split('.').pop().toUpperCase() + ') nie otwiera sie '
      + 'w przegladarce. Zapisz zdjecie jako JPG albo PNG i wgraj ponownie. '
      + 'W iPhone: Ustawienia > Aparat > Formaty > Najbardziej zgodne.');
    return;
  }

  powiedz('Przetwarzam zdjecie...');

  var czytnik = new FileReader();

  /* Bez tego blad odczytu konczyl sie CISZA - Dawid nie wiedzial,
     czy trwa, czy padlo. */
  czytnik.onerror = function(){
    powiedz('Nie udalo sie odczytac pliku z dysku. Sprobuj ponownie albo wybierz inny.');
  };

  czytnik.onload = function(){
    var obraz = new Image();

    obraz.onload = function(){
      var dane = sprezuj(obraz);
      if (!dane) {
        powiedz('Nie umiem zmniejszyc tego zdjecia na tyle, zeby je zapisac. '
          + 'Sprobuj zdjeciem o mniejszej rozdzielczosci.');
        return;
      }
      ZDJECIE_DANE = dane;
      var kb = Math.round(dane.length * 0.75 / 1024);
      info.innerHTML = 'Wgrane (' + kb + ' kB): <img class="plyta-mini" src="' + dane + '" alt="">';
    };

    obraz.onerror = function(){
      powiedz('Nie umiem odczytac tego zdjecia. Uzyj pliku JPG albo PNG.');
    };

    obraz.src = czytnik.result;
  };

  czytnik.readAsDataURL(plik);
}

async function plytaZapisz(id){
  var info = document.getElementById('pl-info');
  var wart = function(x){ return document.getElementById(x).value; };
  var dane = {
    id: id || 0,
    nazwa: wart('pl-nazwa'),
    opis: wart('pl-opis'),
    kodPlyty: wart('pl-kod'),
    firmaSlug: wart('pl-firma'),
    gruboscMm: wart('pl-grubosc'),
    plytaDlCm: wart('pl-dl'),
    plytaGlCm: wart('pl-gl'),
    cenaM2: wart('pl-cena'),
    cenaNormalnaM2: wart('pl-cena-bylo'),
    plytRazem: wart('pl-razem'),
    zdjecieUrl: wart('pl-zdjecie-url')
  };
  if (id) dane.plytZostalo = wart('pl-zostalo');
  if (ZDJECIE_DANE) dane.zdjecieDane = ZDJECIE_DANE;

  info.textContent = 'Zapisuje...';
  var odp = await (await fetch('/panel/api/wyprzedaz/zapisz', {method:'POST',
    headers:{'content-type':'application/json'}, body: JSON.stringify(dane)})).json();
  if (odp.error) { info.textContent = odp.error; return; }

  ZDJECIE_DANE = '';
  PLYTA_EDYTOWANA = null;
  document.getElementById('wyprzedaz-formularz').innerHTML = '';
  await rysujWyprzedaz();
  document.getElementById('wyprzedaz-tresc').hidden = false;
}

async function plytaPublikuj(id, opublikowana){
  await fetch('/panel/api/wyprzedaz/publikuj', {method:'POST', headers:{'content-type':'application/json'},
    body: JSON.stringify({id: id, opublikowana: opublikowana})});
  await rysujWyprzedaz();
  document.getElementById('wyprzedaz-tresc').hidden = false;
}

async function plytaDostepnosc(id){
  var p = WYPRZEDAZ.find(function(x){ return x.id === id; });
  if (!p) return;
  // "Sprzedana" zeruje licznik, "wrocila" przywraca pelen stan.
  await fetch('/panel/api/wyprzedaz/dostepnosc', {method:'POST', headers:{'content-type':'application/json'},
    body: JSON.stringify({id: id, plytZostalo: p.plytZostalo > 0 ? 0 : p.plytRazem})});
  await rysujWyprzedaz();
  document.getElementById('wyprzedaz-tresc').hidden = false;
}

async function plytaUsun(id){
  if (!confirm('Skasowac te plyte? Tego nie da sie cofnac.')) return;
  await fetch('/panel/api/wyprzedaz/usun', {method:'POST', headers:{'content-type':'application/json'},
    body: JSON.stringify({id: id})});
  await rysujWyprzedaz();
  document.getElementById('wyprzedaz-tresc').hidden = false;
}

/* Krotkie etykiety terminow - te same id, co w src/app/termin.js.
   Panel jest osobnym, samodzielnym skryptem w przegladarce, wiec nie
   moze zaimportowac tamtego modulu; lista jest tu przepisana swiadomie,
   a testy pilnuja, zeby oba zestawy id byly identyczne. */
var TERMINY_KROTKO = {
  pilne: 'do 2 tygodni',
  miesiac: 'w miesiac',
  kwartal: '1-3 mies.',
  pol_roku: '3-6 mies.',
  pozniej: 'dopiero planuje'
};
function krotkiTermin(id){ return TERMINY_KROTKO[id] || ''; }

function znacznikFeedbacku(k){
  if(k.feedback === 'pasuje')
    return '<span class="znacznik dobry">✓ prosi o kontakt' + (k.pora ? ': ' + esc(k.pora.toLowerCase()) : '') + '</span>';
  if(k.feedback === 'za_drogo')
    return '<span class="znacznik">za drogo' + (k.budzet ? ' · budżet ' + esc(k.budzet) : '') + '</span>';
  if(k.feedback === 'zastanowi') return '<span class="znacznik">zastanawia się</span>';
  return '';
}

function reakcjeHtml(fb){
  var kategorie = Object.keys(fb || {});
  if(!kategorie.length) return '';
  var NAZWY = {konglomerat:'Konglomerat', spiek:'Spiek / gres', naturalny:'Kamień naturalny', inne:'Inne'};
  var wiersze = kategorie.map(function(kat){
    var w = fb[kat];
    var proc = function(x){ return w.razem ? Math.round(100 * (x||0) / w.razem) + '%' : '—'; };
    return '<tr><td>' + esc(NAZWY[kat] || kat) + '</td>' +
      '<td>' + proc(w.pasuje) + '</td><td>' + proc(w.za_drogo) + '</td>' +
      '<td>' + proc(w.zastanowi) + '</td><td class="mini">' + w.razem + '</td></tr>';
  }).join('');
  return '<h2>Reakcje na wycenę</h2><div class="lejek" style="margin-top:0;overflow-x:auto">' +
    '<table class="reakcje"><thead><tr><th>Materiał</th><th>Pasuje</th><th>Za drogo</th>' +
    '<th>Zastanawia się</th><th class="mini">odp.</th></tr></thead><tbody>' + wiersze + '</tbody></table></div>';
}

function opisFlagi(f){
  return f === 'test' ? 'mail testowy' : f === 'dubel' ? 'dubel w kwadrans' :
         f === 'telefon' ? 'numer nie ma 9 cyfr' : f;
}

async function pokazSzczegoly(id, cicho){
  var boks = document.getElementById('sz-' + id);
  if(!boks) return;
  if(!cicho) boks.hidden = false;
  var k = await (await fetch('/panel/api/karta?id=' + id)).json();
  if(k.error) return;

  var opcje = STATUSY.map(function(s){
    return '<option value="' + s.id + '"' + (s.id === k.status ? ' selected' : '') + '>' + esc(s.nazwa) + '</option>';
  }).join('');

  var licznik = 0;
  var wyceny = k.wyceny.slice().reverse().map(function(w){
    licznik += 1;
    var naglowek = 'Wycena #' + licznik + (w.wersja === 'dawid' ? ' — od Dawida' : '');
    var obejrzenia = '';
    if (w.wersja === 'dawid') {
      obejrzenia = w.otwarcia
        ? '<br><span class="mini">👁 klient obejrzał ' + w.otwarcia + '×, ostatnio ' + godzina(w.ostatnie_otwarcie) + '</span>'
        : '<br><span class="mini">jeszcze nie otwarta przez klienta</span>';
    }
    var powtorz = w.powtorz
      ? ' · <a href="' + esc(w.powtorz) + '" target="_blank" rel="noopener">Powtórz wycenę ↗</a>'
      : '';
    // Każda wysłana wersja ma swój link — także te starsze, bo właśnie
    // po nie sięga się, gdy klient dzwoni „ale Pan mi wtedy pisał…".
    var podglad = w.podglad
      ? ' · <a href="' + esc(w.podglad) + '" target="_blank" rel="noopener">Zobacz ofertę klienta ↗</a>'
      : '';
    var aktualizuj = w.aktualizuj
      ? ' · <a href="' + esc(w.aktualizuj) + '" target="_blank" rel="noopener">Aktualizuj ofertę ↗</a>'
      : '';
    return '<li' + (w.wersja === 'dawid' ? ' class="od-dawida"' : '') + '>' +
      '<span class="kiedy">' + esc(naglowek) + ' · ' + godzina(w.utworzono) + '</span><br>' +
      esc([w.firma, w.dekor, w.grubosc ? w.grubosc + ' mm' : ''].filter(Boolean).join(' · ')) +
      ' — <b>' + zl(w.kwota) + '</b>' + (w.m2 ? ' · ' + String(w.m2).replace('.', ',') + ' m²' : '') +
      (w.odbior ? ' · odbiór własny' : '') + plytaHtml(w) +
      podglad + aktualizuj + powtorz + obejrzenia +
      watekHtml(w) + '</li>';
  }).reverse().join('') || '<li class="mini">Brak zapisanych wycen.</li>';

  var notatki = k.notatki.map(function(n){
    return '<li class="' + (n.autor === 'system' ? 'system' : '') + '"><span class="kiedy">' +
      godzina(n.utworzono) + '</span><br>' + esc(n.tresc) + '</li>';
  }).join('') || '<li class="mini">Brak notatek.</li>';

  boks.innerHTML =
    '<label for="st-' + id + '">Status</label><select id="st-' + id + '" data-pole="status">' + opcje + '</select>' +
    '<label for="od-' + id + '">Oddzwonić kiedy</label>' +
    '<input id="od-' + id + '" type="date" data-pole="oddzwonic" value="' + esc(k.oddzwonic || '') + '">' +
    '<label for="nt-' + id + '">Nowa notatka</label>' +
    '<textarea id="nt-' + id + '" placeholder="Co ustaliliście?"></textarea>' +
    '<p><button class="btn" type="button" data-zapisz="' + id + '">Zapisz</button> ' +
    '<button class="btn cichy" type="button" data-kasuj="' + id + '">Skasuj kartę</button></p>' +
    '<p class="mini">Telefon: ' + esc(k.telefon || '—') + ' · ' + esc(k.email || '—') +
    ' · źródło: ' + esc(zrodloOpis(k)) + '</p>' +
    '<h2>Wyceny</h2><ul class="log">' + wyceny + '</ul>' +
    '<h2>Notatki</h2><ul class="log">' + notatki + '</ul>';
}

/**
 * KOD PŁYTY JAKO KLIK DO MAGAZYNU — tylko przy kamieniu naturalnym.
 *
 * Interstone nie daje karcie płyty własnego adresu, więc link prowadzi
 * do stanu magazynowego zawężonego do TEGO numeru płyty. Kod stoi obok
 * do przepisania — wyszukiwarka na nietrafiony numer oddaje kilka
 * przypadkowych płyt zamiast pustej listy, więc trzeba mieć po czym
 * poznać, że to właściwa.
 */
function plytaHtml(w){
  if (!w.kodPlyty) return '';
  var kod = '<code class="kod-plyty">' + esc(w.kodPlyty) + '</code>';
  return '<br><span class="mini">Płyta: ' + kod +
    (w.magazyn
      ? ' <a href="' + esc(w.magazyn) + '" target="_blank" rel="noopener">pokaż w magazynie ↗</a>'
      : '') + '</span>';
}

/**
 * ROZMOWA POD OFERTĄ — dymki plus okienko odpowiedzi.
 *
 * Pokazujemy wątek tylko przy wycenach OD DAWIDA: to one mają link,
 * który klient dostał, więc tylko pod nimi może cokolwiek napisać.
 */
function watekHtml(w){
  if(w.wersja !== 'dawid') return '';
  var rozmowa = w.rozmowa || [];
  var odKlienta = rozmowa.filter(function(m){ return m.autor === 'klient'; }).length;
  var dymki = rozmowa.map(function(m){
    var kto = m.autor === 'klient' ? 'Klient' : 'Ty';
    return '<li class="od-' + (m.autor === 'klient' ? 'klienta' : 'dawida') + '">' +
      '<span class="kiedy">' + kto + ' · ' + godzina(m.utworzono) + '</span>' + esc(m.tresc) + '</li>';
  }).join('');

  var naglowek = '<span class="mini">Rozmowa' +
    (odKlienta ? '<span class="nowa-wiad">' + odKlienta + ' od klienta</span>' : '') + '</span>';

  return '<div class="odpowiedz">' + naglowek +
    (dymki ? '<ul class="watek">' + dymki + '</ul>'
           : '<ul class="watek"><li class="pusto">Jeszcze nikt tu nie pisał.</li></ul>') +
    '<textarea id="ws-' + w.id + '" placeholder="Odpisz klientowi…"></textarea>' +
    '<p><button class="btn cichy" type="button" data-odpisz="' + w.id + '">Wyślij odpowiedź</button> ' +
    '<span class="mini" id="wsi-' + w.id + '"></span></p></div>';
}

async function odpisz(wycenaId){
  var pole = document.getElementById('ws-' + wycenaId);
  var info = document.getElementById('wsi-' + wycenaId);
  var tresc = (pole.value || '').trim();
  if(!tresc){ info.textContent = 'Pusta wiadomość.'; return; }

  info.textContent = 'Wysyłam…';
  var odp = await (await fetch('/panel/api/odpowiedz', {
    method: 'POST',
    headers: {'content-type':'application/json'},
    body: JSON.stringify({wycena: Number(wycenaId), tresc: tresc})
  })).json();

  if(odp.error){ info.textContent = odp.error; return; }
  pole.value = '';
  info.textContent = odp.mail ? 'Wysłane — klient dostał maila.'
                              : 'Zapisane, ale mail nie wyszedł (brak adresu?).';
  // Odświeżamy kartę, żeby dymek pojawił się w wątku od razu.
  await pokazSzczegoly(otwarta, true);
}

function zrodloOpis(k){
  var t = k.zrodlo === 'ads' ? 'Google Ads' : k.zrodlo === 'organiczne' ? 'organiczne' : 'nieznane';
  return k.zrodloSzczegol ? t + ' (' + k.zrodloSzczegol + ')' : t;
}

async function zapisz(id){
  var boks = document.getElementById('sz-' + id);
  var notatka = boks.querySelector('textarea').value.trim();
  var zmiana = {
    id: Number(id),
    status: boks.querySelector('[data-pole="status"]').value,
    oddzwonic: boks.querySelector('[data-pole="oddzwonic"]').value || null
  };
  if(notatka) zmiana.notatka = notatka;
  await fetch('/panel/api/zmien', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(zmiana)});
  otwarta = Number(id);
  await wczytaj();
  var b = document.getElementById('sz-' + id); if(b) b.hidden = false;
}

document.addEventListener('click', function(e){
  var odp = e.target.closest('[data-odpisz]');
  if(odp){ odpisz(odp.dataset.odpisz); return; }

  var rozwin = e.target.closest('[data-rozwin]');
  if(rozwin){
    var id = Number(rozwin.dataset.rozwin);
    var boks = document.getElementById('sz-' + id);
    if(boks.hidden){ otwarta = id; pokazSzczegoly(id); } else { boks.hidden = true; otwarta = null; }
    return;
  }
  var zap = e.target.closest('[data-zapisz]');
  if(zap){ zapisz(zap.dataset.zapisz); return; }

  var kas = e.target.closest('[data-kasuj]');
  if(kas){
    if(!confirm('Skasować kartę razem z wycenami i notatkami? Tego nie da się cofnąć.')) return;
    fetch('/panel/api/zmien', {method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify({id: Number(kas.dataset.kasuj), skasuj: true})}).then(function(){ otwarta = null; wczytaj(); });
    return;
  }
  if(e.target.id === 'stawki-pokaz'){
    var t = document.getElementById('stawki-tresc'); t.hidden = !t.hidden; return;
  }
  if(e.target.id === 'stawki-zapisz'){
    var stawki = {};
    [].forEach.call(document.querySelectorAll('[data-stawka]'), function(i){ stawki[i.dataset.stawka] = i.value; });
    e.target.disabled = true;
    fetch('/panel/api/stawki', {method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify({stawki: stawki})})
      .then(function(r){ return r.json(); })
      .then(function(d){
        STAWKI_WART = d.stawki || {};
        document.getElementById('stawki-info').textContent =
          'Zapisano ' + (d.zapisanych || 0) + ' stawek. Kalkulator liczy po nowemu od zaraz.';
        e.target.disabled = false;
      });
    return;
  }
  if(e.target.id === 'stawki-test'){
    fetch('/panel/api/test').then(function(r){ return r.json(); }).then(function(d){
      if(d.link) window.open(d.link, '_blank', 'noopener');
    });
    return;
  }
  // Wyprzedaz plyt: kazdy wiersz niesie swoje id, a przycisk - nazwe akcji.
  // Jeden zestaw atrybutow zamiast szesciu osobnych data-* na kazda operacje.
  var przyciskPlyty = e.target.closest('.plyta-wiersz [data-akcja]');
  if(przyciskPlyty){
    var idPlyty = Number(przyciskPlyty.closest('.plyta-wiersz').dataset.id);
    var akcja = przyciskPlyty.dataset.akcja;
    if(akcja === 'edytuj'){ PLYTA_EDYTOWANA = idPlyty; rysujPlyteFormularz(idPlyty); return; }
    if(akcja === 'publikuj'){
      var plyta = WYPRZEDAZ.find(function(x){ return x.id === idPlyty; });
      plytaPublikuj(idPlyty, !(plyta && plyta.opublikowana)); return;
    }
    if(akcja === 'dostepnosc'){ plytaDostepnosc(idPlyty); return; }
    if(akcja === 'usun'){ plytaUsun(idPlyty); return; }
  }
  var chip = e.target.closest('[data-status]');
  if(chip){
    var sel = document.getElementById('f-status');
    sel.value = sel.value === chip.dataset.status ? '' : chip.dataset.status;
    wczytaj();
  }
});

['f-status','f-termin','f-kwota','f-od','f-do'].forEach(function(id){
  document.getElementById(id).addEventListener('change', wczytaj);
});
var czasomierz;
document.getElementById('f-szukaj').addEventListener('input', function(){
  clearTimeout(czasomierz); czasomierz = setTimeout(wczytaj, 350);
});
document.getElementById('f-czysc').addEventListener('click', function(){
  ['f-status','f-termin','f-kwota','f-od','f-do','f-szukaj'].forEach(function(id){ document.getElementById(id).value = ''; });
  wczytaj();
});

wczytaj();
</script></body></html>`;

/**
 * ZAKUPY — jedno miejsce na wszystko, co trzeba kupić.
 *
 * Zlecenie Dawida (06.09.2026). Problem, który to rozwiązuje, jego słowami:
 * pozycje do kupienia leżą w checklistach na kartach grobów w Trello, więc
 * nigdzie nie widać ich razem. Cztery ławeczki z czterech kart to były
 * cztery osobne zamówienia zamiast jednego hurtowego.
 *
 * Co ten moduł robi:
 *   • trzyma pozycje ściągnięte z Trello (`zakupy_pozycje`),
 *   • sumuje je per PRODUKT i grupuje per DOSTAWCA,
 *   • pamięta, u kogo Dawid kupuje dany produkt (`zakupy_dostawcy`),
 *     żeby przy pozycji bez dopisku podpowiedzieć dostawcę,
 *   • pilnuje statusów: do kupienia → zamówione → otrzymane.
 *
 * Pisanie do Trello siedzi w `trello.js`; tutaj jest decyzja KIEDY pisać.
 *
 * ⚠ Repozytorium jest publiczne. Nazwy grobów to dane osobowe zmarłych
 * i rodzin — nie trafiają do gita, tylko do D1. Żadnych przykładów
 * z prawdziwymi nazwiskami w komentarzach ani w testach.
 */

import { pobierzPozycje, odhaczWTrello, kluczProduktu } from './trello.js';

export const STATUSY = [
  { id: 'do_kupienia', nazwa: 'Do kupienia' },
  { id: 'zamowione', nazwa: 'Zamówione' },
  { id: 'otrzymane', nazwa: 'Otrzymane' },
];

const ZNANE_STATUSY = new Set(STATUSY.map((s) => s.id));
export const znanyStatus = (s) => ZNANE_STATUSY.has(String(s || ''));

const teraz = () => new Date().toISOString();
const dzisiaj = () => new Date().toISOString().slice(0, 10);

/* ────────────────────────────────────────────────────────── konfiguracja */

/**
 * Klucz i token Trello.
 *
 * ⚠ Osobna tabela, NIE `ustawienia` — tamtą panel czyta w całości i odsyła
 * do przeglądarki jako stawki. Token wjechałby wtedy do HTML-a przy każdym
 * otwarciu panelu. Tu czytamy go wyłącznie po stronie workera.
 */
export async function wczytajKonfig(env) {
  const wynik = await env.BAZA.prepare(`SELECT klucz, wartosc FROM zakupy_konfig`).all();
  const k = {};
  for (const w of wynik?.results || []) k[w.klucz] = w.wartosc;
  return { klucz: k.klucz || '', token: k.token || '', tablica: k.tablica || '', tablicaNazwa: k.tablicaNazwa || '' };
}

export async function zapiszKonfig(env, pola) {
  const dozwolone = ['klucz', 'token', 'tablica', 'tablicaNazwa'];
  for (const [nazwa, wartosc] of Object.entries(pola || {})) {
    if (!dozwolone.includes(nazwa)) continue;
    if (wartosc === undefined || wartosc === null) continue;
    await env.BAZA.prepare(
      `INSERT INTO zakupy_konfig (klucz, wartosc, zmieniono) VALUES (?, ?, ?)
       ON CONFLICT(klucz) DO UPDATE SET wartosc = excluded.wartosc, zmieniono = excluded.zmieniono`
    )
      .bind(nazwa, String(wartosc).trim(), teraz())
      .run();
  }
}

/**
 * Stan konfiguracji dla przeglądarki — BEZ sekretów.
 * Panel ma wiedzieć, czy klucz jest, a nie jaki jest.
 */
export function konfigDlaPanelu(k) {
  return {
    maKlucz: Boolean(k.klucz),
    maToken: Boolean(k.token),
    tablica: k.tablica || '',
    tablicaNazwa: k.tablicaNazwa || '',
    // Cztery ostatnie znaki, żeby Dawid poznał, który token wkleił.
    koncowkaTokenu: k.token ? '…' + k.token.slice(-4) : '',
  };
}

/* ──────────────────────────────────────────── nauka: produkt → dostawca */

/**
 * Kto dostarcza dany produkt — uczone z pozycji, które MIAŁY dopisek.
 *
 * Dawid pisze „ławeczka — Firma" raz; przy następnej ławeczce bez dopisku
 * podpowiadamy tę samą firmę i oznaczamy to jako podpowiedź (`zrodlo`),
 * a nie pewnik. Panel pokazuje różnicę, bo pomyłka tutaj to zamówienie
 * u złego dostawcy.
 */
export async function nauczDostawcy(env, klucz, dostawca) {
  if (!klucz || !dostawca) return;
  await env.BAZA.prepare(
    `INSERT INTO zakupy_dostawcy (produkt, dostawca, razy, zmieniono) VALUES (?, ?, 1, ?)
     ON CONFLICT(produkt) DO UPDATE SET
       dostawca = excluded.dostawca,
       razy = zakupy_dostawcy.razy + 1,
       zmieniono = excluded.zmieniono`
  )
    .bind(klucz, dostawca, teraz())
    .run();
}

async function nauczoneDostawcy(env) {
  const w = await env.BAZA.prepare(`SELECT produkt, dostawca, razy FROM zakupy_dostawcy`).all();
  const mapa = new Map();
  for (const r of w?.results || []) mapa.set(r.produkt, { dostawca: r.dostawca, razy: r.razy });
  return mapa;
}

/** Ręczne poprawki nazw: „to jest to samo co…". Zatwierdza je Dawid. */
async function aliasy(env) {
  const w = await env.BAZA.prepare(`SELECT surowy, produkt FROM zakupy_aliasy`).all();
  const mapa = new Map();
  for (const r of w?.results || []) mapa.set(r.surowy, r.produkt);
  return mapa;
}

export async function zapiszAlias(env, surowy, produkt) {
  if (!surowy || !produkt) return;
  await env.BAZA.prepare(
    `INSERT INTO zakupy_aliasy (surowy, produkt, zmieniono) VALUES (?, ?, ?)
     ON CONFLICT(surowy) DO UPDATE SET produkt = excluded.produkt, zmieniono = excluded.zmieniono`
  )
    .bind(kluczProduktu(surowy) || surowy, produkt, teraz())
    .run();
}

/* ──────────────────────────────────────────────────────── synchronizacja */

/**
 * Ściągnięcie tablicy do bazy.
 *
 * Zasady, na które trzeba uważać:
 *   • pozycja rozpoznawana jest po `trello_item_id` — zmiana treści w Trello
 *     aktualizuje wiersz, nie tworzy drugiego,
 *   • STATUS USTAWIONY W PANELU WYGRYWA z tym, co przyjdzie z Trello.
 *     Inaczej cron co 30 minut cofałby „zamówione" na „do kupienia" przy
 *     każdej pozycji, której Dawid nie odhaczył ręcznie w Trello,
 *   • pozycja, która zniknęła z Trello, znika i u nas (`widziano`), ale
 *     dopiero gdy przebieg się UDAŁ — inaczej awaria Trello wyczyściłaby
 *     całą listę.
 */
export async function synchronizuj(env, { konfig } = {}) {
  const k = konfig || (await wczytajKonfig(env));
  if (!k.klucz || !k.token) return { ok: false, blad: 'Nie ma jeszcze klucza i tokenu Trello.' };
  if (!k.tablica) return { ok: false, blad: 'Nie wybrano tablicy.' };

  const odp = await pobierzPozycje(k, k.tablica);
  if (!odp.ok) return odp;

  const znak = teraz();
  const mapaAliasow = await aliasy(env);
  const mapaDostawcow = await nauczoneDostawcy(env);

  for (const p of odp.pozycje) {
    const klucz = mapaAliasow.get(p.klucz) || p.klucz;

    // Dopisek w Trello jest źródłem prawdy o dostawcy. Brak dopisku →
    // podpowiedź z historii, wyraźnie oznaczona jako podpowiedź.
    let dostawca = p.dostawca;
    let zrodlo = p.dostawca ? 'dopisek' : '';
    if (!dostawca) {
      const znane = mapaDostawcow.get(klucz);
      if (znane) {
        dostawca = znane.dostawca;
        zrodlo = 'historia';
      }
    }

    await env.BAZA.prepare(
      `INSERT INTO zakupy_pozycje
         (trello_item_id, trello_card_id, karta_nazwa, karta_url, tresc, produkt, klucz,
          ilosc, dostawca, dostawca_zrodlo, trello_odhaczone, widziano, utworzono)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(trello_item_id) DO UPDATE SET
         karta_nazwa = excluded.karta_nazwa,
         karta_url = excluded.karta_url,
         tresc = excluded.tresc,
         produkt = excluded.produkt,
         klucz = excluded.klucz,
         ilosc = excluded.ilosc,
         trello_odhaczone = excluded.trello_odhaczone,
         widziano = excluded.widziano,
         -- Dopisek w Trello nadpisuje podpowiedź; podpowiedź nie nadpisuje dopisku.
         dostawca = CASE WHEN excluded.dostawca_zrodlo = 'dopisek'
                         THEN excluded.dostawca ELSE zakupy_pozycje.dostawca END,
         dostawca_zrodlo = CASE WHEN excluded.dostawca_zrodlo = 'dopisek'
                           THEN 'dopisek' ELSE zakupy_pozycje.dostawca_zrodlo END`
    )
      .bind(
        p.itemId, p.kartaId, p.karta, p.url, p.tresc, p.produkt, klucz,
        p.ilosc, dostawca, zrodlo, p.odhaczone ? 1 : 0, znak, znak
      )
      .run();

    if (p.dostawca) await nauczDostawcy(env, klucz, p.dostawca);
  }

  // Sprzątanie dopiero po udanym przebiegu — patrz komentarz w nagłówku.
  const usuniete = await env.BAZA.prepare(`DELETE FROM zakupy_pozycje WHERE widziano < ?`)
    .bind(znak)
    .run();

  await zapiszKonfig(env, {});
  await env.BAZA.prepare(
    `INSERT INTO zakupy_konfig (klucz, wartosc, zmieniono) VALUES ('ostatniaSync', ?, ?)
     ON CONFLICT(klucz) DO UPDATE SET wartosc = excluded.wartosc, zmieniono = excluded.zmieniono`
  )
    .bind(znak, znak)
    .run();

  return {
    ok: true,
    pobrano: odp.pozycje.length,
    usunieto: usuniete?.meta?.changes || 0,
    sugestie: odp.sugestie,
    kiedy: znak,
  };
}

/* ─────────────────────────────────────────────────────────── zestawienie */

/**
 * LISTA DO ZAMÓWIENIA — pogrupowana tak, jak Dawid dzwoni: najpierw
 * dostawca, w środku produkty ze zsumowaną ilością, a pod produktem
 * rozwijana lista kart, z których to się wzięło.
 *
 * Bez tej ostatniej warstwy lista byłaby bezużyteczna przy reklamacji —
 * „cztery ławeczki" nic nie mówi, kiedy jedna przyjdzie uszkodzona.
 */
export async function zestawienie(env, { status = 'do_kupienia' } = {}) {
  const w = await env.BAZA.prepare(
    `SELECT id, trello_item_id, trello_card_id, karta_nazwa, karta_url, tresc, produkt, klucz,
            ilosc, dostawca, dostawca_zrodlo, status, zamowiono, otrzymano
       FROM zakupy_pozycje
      WHERE (? = 'wszystko' OR status = ?)
      ORDER BY dostawca, klucz, karta_nazwa`
  )
    .bind(status, status)
    .all();

  const grupy = new Map();
  for (const p of w?.results || []) {
    const dostawca = p.dostawca || '';
    if (!grupy.has(dostawca)) grupy.set(dostawca, new Map());
    const produkty = grupy.get(dostawca);

    if (!produkty.has(p.klucz)) {
      produkty.set(p.klucz, { klucz: p.klucz, nazwa: p.produkt, sztuk: 0, pozycje: [] });
    }
    const grupa = produkty.get(p.klucz);
    grupa.sztuk += p.ilosc;
    // Najdłuższa nazwa jest zwykle najbardziej opisowa („ławeczka ze
    // skrzyneczką" mówi więcej niż „ławeczka") — a nagłówek grupy ma
    // Dawidowi przypominać, o co dokładnie chodzi.
    if (p.produkt.length > grupa.nazwa.length) grupa.nazwa = p.produkt;
    grupa.pozycje.push({
      id: p.id,
      karta: p.karta_nazwa,
      url: p.karta_url,
      tresc: p.tresc,
      ilosc: p.ilosc,
      status: p.status,
      zamowiono: p.zamowiono,
      otrzymano: p.otrzymano,
      zrodloDostawcy: p.dostawca_zrodlo,
    });
  }

  const wynik = [...grupy.entries()]
    .map(([dostawca, produkty]) => ({
      dostawca,
      // Pozycje bez rozpoznanego dostawcy lądują na końcu — to jest lista
      // rzeczy do dopisania, a nie do zamówienia.
      nieznany: !dostawca,
      sztukRazem: [...produkty.values()].reduce((s, g) => s + g.sztuk, 0),
      produkty: [...produkty.values()].sort((a, b) => b.sztuk - a.sztuk),
    }))
    .sort((a, b) => Number(a.nieznany) - Number(b.nieznany) || a.dostawca.localeCompare(b.dostawca, 'pl'));

  return wynik;
}

/** Tekst do wklejenia w maila albo do wydruku — jedna grupa dostawcy. */
export function listaDoMaila(grupa) {
  const linie = [`Zamówienie — ${grupa.dostawca || '(dostawca nieprzypisany)'}`, ''];
  for (const p of grupa.produkty) {
    linie.push(`${p.nazwa} — ${p.sztuk} szt.`);
    for (const poz of p.pozycje) linie.push(`    · ${poz.karta}${poz.ilosc > 1 ? ` (${poz.ilosc} szt.)` : ''}`);
  }
  linie.push('', 'Kamieniarstwo 24h · Tarnobrzeg, ul. Szpitalna 8 · tel. 796 991 128');
  return linie.join('\n');
}

/* ───────────────────────────────────────────────────────────── statusy */

/**
 * ZMIANA STATUSU + odbicie w Trello.
 *
 * Kolejność ma znaczenie: najpierw zapis u nas, potem Trello. Gdyby Trello
 * nie odpowiedziało, status i tak zostaje zapisany, a panel mówi wprost,
 * że w Trello się nie udało — zamiast cicho zgubić kliknięcie Dawida.
 */
export async function ustawStatus(env, { id, status, doTrello = true }) {
  if (!znanyStatus(status)) return { ok: false, blad: 'Nieznany status.' };

  const poz = await env.BAZA.prepare(
    `SELECT id, trello_item_id, trello_card_id, tresc, status FROM zakupy_pozycje WHERE id = ?`
  )
    .bind(id)
    .first();
  if (!poz) return { ok: false, blad: 'Nie ma takiej pozycji.' };

  const data = dzisiaj();
  await env.BAZA.prepare(
    `UPDATE zakupy_pozycje SET status = ?,
       zamowiono = CASE WHEN ? IN ('zamowione','otrzymane') THEN COALESCE(zamowiono, ?) ELSE NULL END,
       otrzymano = CASE WHEN ? = 'otrzymane' THEN ? ELSE NULL END
     WHERE id = ?`
  )
    .bind(status, status, data, status, data, id)
    .run();

  if (!doTrello) return { ok: true, wTrello: false };

  const konfig = await wczytajKonfig(env);
  const odp = await odhaczWTrello(konfig, {
    kartaId: poz.trello_card_id,
    itemId: poz.trello_item_id,
    nazwa: poz.tresc,
    status,
    data,
  });
  return { ok: true, wTrello: odp.ok, bladTrello: odp.ok ? '' : odp.blad };
}

/** Zmiana statusu całej grupy produktu — „zamawiam cztery ławeczki naraz". */
export async function ustawStatusGrupy(env, { klucz, dostawca, status }) {
  if (!znanyStatus(status)) return { ok: false, blad: 'Nieznany status.' };
  const w = await env.BAZA.prepare(
    `SELECT id FROM zakupy_pozycje WHERE klucz = ? AND dostawca = ? AND status <> ?`
  )
    .bind(klucz, dostawca || '', status)
    .all();

  const wyniki = [];
  for (const p of w?.results || []) wyniki.push(await ustawStatus(env, { id: p.id, status }));
  const bledy = wyniki.filter((r) => r.bladTrello).map((r) => r.bladTrello);
  return { ok: true, zmieniono: wyniki.length, bledyTrello: [...new Set(bledy)] };
}

/** Ręczne przypisanie dostawcy — i zapamiętanie go na przyszłość. */
export async function ustawDostawce(env, { klucz, dostawca }) {
  const czysty = String(dostawca || '').trim().slice(0, 60);
  await env.BAZA.prepare(
    `UPDATE zakupy_pozycje SET dostawca = ?, dostawca_zrodlo = 'reczne' WHERE klucz = ? AND dostawca_zrodlo <> 'dopisek'`
  )
    .bind(czysty, klucz)
    .run();
  if (czysty) await nauczDostawcy(env, klucz, czysty);
  return { ok: true };
}

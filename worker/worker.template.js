/**
 * ══════════════════════════════════════════════════════════════════════════
 *  KAMIENIARSTWO 24H — WORKER (Cloudflare)
 *
 *  ⚠ TEGO PLIKU NIE EDYTUJEMY RĘCZNIE.
 *    Powstaje z worker/worker.template.js przez `npm run worker`
 *    (wstrzykiwana jest aktualna lista dekorów).
 *
 *  Co robi:
 *    POST /chat     — rozmowa z konsultantem (klucz Anthropic zostaje tutaj)
 *    POST /lead     — dwa maile przez Resend: wycena do klienta + zgłoszenie do firmy
 *    POST /feedback — odpowiedź klienta na pokazaną wycenę (do bazy klientów)
 *    POST /oferta/dane   — wycena online po tokenie (strona /oferta na kam24h.pl)
 *    POST /oferta/wyslij — zapis wersji Dawida + mail do klienta (token z panelu)
 *    POST /magazyn  — stan magazynowy Interstone (podgląd/diagnostyka; ten sam
 *                     odczyt, z którego korzysta konsultant przez narzędzie)
 *    POST /wyprzedaz — płyty z wyprzedaży dla kategorii „NATURA WYPRZEDAŻ"
 *                      i strony /wyprzedaz-plyt (publicznie tylko dostępne;
 *                      podgląd szkicu — patrz worker/wyprzedaz-baza.js)
 *    GET  /wyprzedaz/zdjecie/<id> — zdjęcie płyty wgrane przez panel
 *    GET  /panel    — baza klientów dla Dawida (worker/panel.js), za hasłem
 *
 *  Sekrety (Cloudflare → Settings → Variables and Secrets):
 *    ANTHROPIC_API_KEY   klucz do Anthropic
 *    RESEND_API_KEY      klucz do Resend
 *    LEAD_EMAIL          kamieniarstwo24h@gmail.com
 *    PANEL_HASLO         hasło do panelu bazy klientów
 *    ALLOWED_ORIGIN      https://kam24h.pl  (można podać kilka po przecinku)
 *    MAIL_FROM           opcjonalnie, domyślnie onboarding@resend.dev
 *
 *  Kluczy NIE MA w tym pliku i nigdy nie może być.
 * ══════════════════════════════════════════════════════════════════════════
 */

import { obsluzPanel, podpisz } from './panel.js';
import { mailOferty, TEMAT_OFERTY } from './mail-oferty.js';
import { sprawdzWiadomosc, MAKS_ZNAKOW } from './rozmowa.js';
import { tematDoDawida, mailDoDawida } from './mail-rozmowa.js';
import { linkPlyty } from '../src/app/magazyn-linki.js';
import { kluczDekoru } from '../src/app/wyprzedaz-klucz.js';
import { etykietaTerminu, pilny, znanyTermin } from '../src/app/termin.js';
import { resend, nadawca, doDawida } from './poczta.js';
import {
  zapiszLead,
  zapiszFeedback,
  zapiszOferte,
  rozmowaOferty,
  kontekstRozmowy,
  dopiszWiadomosc,
  ofertaPoTokenie,
  odczytajStawki,
} from './baza.js';
import { listaPlyt, zdjeciePlyty, dostepna } from './wyprzedaz-baza.js';
import {
  pobierzMagazyn,
  opiszPlyty,
  pogrupuj,
  znajdzPlyte,
  numerPlytyZKodu,
  linkMagazynu,
} from './magazyn.js';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 1000;

// Ile razy w jednej turze konsultant może odpytać magazyn. Dwa wystarczą,
// żeby porównać dwa materiały; więcej to już pętla, nie rozmowa.
const MAKS_NARZEDZI = 2;

/* ────────────────────────────────────────────────────────────────────────
   WYTYCZNE KONSULTANTA — uczymy go rozmawiać w pliku worker/prompt.local.md
   (poza repozytorium). Zmieniasz tekst tam, uruchamiasz `npm run worker`
   i `npx wrangler deploy`.
   ──────────────────────────────────────────────────────────────────────── */
// Lista dekorów — generowana z cenników przy `npm run worker`.
const DEKORY = `__DEKORY__`.trim();

/**
 * WYTYCZNE ROZMOWY
 *
 * Pełnej treści wytycznych NIE ma w tym repozytorium — to know-how handlowe
 * Dawida, a repozytorium jest publiczne. Wytyczne leżą w pliku
 * `worker/prompt.local.md` (poza gitem) i wstrzykuje je `npm run worker`
 * w miejsce znacznika poniżej — dokładnie tak samo jak listę dekorów.
 *
 * Gdy pliku brak (ktoś sklonował repozytorium), zostaje krótki, neutralny
 * prompt zapasowy: konsultant nadal zbiera dane i kieruje do formularza,
 * ale nie zna naszego sposobu prowadzenia rozmowy ani domykania sprzedaży.
 */
const WYTYCZNE = `__PROMPT__`.trim();

// Lista dekorów doklejana osobno, żeby zmiana cennika nie wymagała
// ruszania wytycznych (i odwrotnie).
const PROMPT = WYTYCZNE + `\n\n# Dekory (używaj wyłącznie tych nazw)\n` + DEKORY;

/* ──────────────────────────────────────────────────────────── obsługa HTTP */

export default {
  async fetch(request, env, ctx) {
    const cors = naglowkiCors(request, env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const adres = new URL(request.url);
    const sciezka = adres.pathname.replace(/\/$/, '');

    // Panel bazy klientów to jedyna część workera odpytywana z przeglądarki
    // przez GET — i jedyna z własnym logowaniem. Idzie przed regułą „tylko
    // POST", bo Dawid wchodzi tu zwykłym kliknięciem w zakładkę.
    if (sciezka === '/panel' || sciezka.startsWith('/panel/')) {
      try {
        return await obsluzPanel(request, env);
      } catch (e) {
        console.error('panel', e?.message || e);
        return json({ error: 'Błąd panelu.' }, 500);
      }
    }

    /*
     * Trasy GET i cała reszta idą pod WSPÓLNY `try`. Wcześniej dwie trasy
     * GET stały przed nim i wyjątek z nich wychodził na zewnątrz jako
     * surowy błąd workera (1101) zamiast czytelnego 500 z logiem.
     * Złapane 30.08.2026 testem dymnym tras.
     */
    try {
      // Odczyt diagnostyczny — GET, bo woła go skrypt i człowiek z przeglądarki.
      if (sciezka === '/kolekcje') return obsluzKolekcje(cors);

      // Zdjęcie płyty z wyprzedaży — GET, bo wchodzi wprost w <img src>.
      // Musi stać PRZED bramką „tylko POST" niżej.
      if (sciezka.startsWith('/wyprzedaz/zdjecie/'))
        return await obsluzZdjecieWyprzedazy(sciezka, env, cors, adres.searchParams);

      if (request.method !== 'POST') return json({ error: 'Tylko POST.' }, 405, cors);

      if (sciezka === '/chat') return await obsluzChat(request, env, cors, ctx);
      if (sciezka === '/lead') return await obsluzLead(request, env, cors);
      if (sciezka === '/feedback') return await obsluzFeedback(request, env, cors);
      if (sciezka === '/ustawienia') return await obsluzUstawienia(env, cors);
      if (sciezka === '/oferta/dane') return await obsluzOfertaDane(request, env, cors);
      if (sciezka === '/oferta/wyslij') return await obsluzOfertaWyslij(request, env, cors);
      if (sciezka === '/oferta/napisz') return await obsluzOfertaNapisz(request, env, cors);
      if (sciezka === '/magazyn') return await obsluzMagazyn(request, cors, ctx);
      if (sciezka === '/wyprzedaz') return await obsluzWyprzedaz(request, env, cors);
      return json({ error: 'Nieznany adres.' }, 404, cors);
    } catch (e) {
      console.error(sciezka, e?.message || e);
      return json({ error: 'Błąd serwera.' }, 500, cors);
    }
  },
};

/* ─────────────────────────────────────────────────────────────────── /chat */

/**
 * Jedyne narzędzie konsultanta: podgląd magazynu Interstone.
 * Wywołuje je model, a wykonuje Worker — klucze i adresy zostają po naszej
 * stronie, a przeglądarka nie ma jak podstawić fałszywych danych.
 */
const NARZEDZIA = [
  {
    name: 'sprawdz_wyprzedaz',
    description: [
      'Sprawdza AKTUALNĄ WYPRZEDAŻ PŁYT — pojedyncze, konkretne płyty',
      'z magazynu Dawida (konglomerat, spiek albo kamień naturalny), które',
      'Dawid sprzedaje po gotowej, niższej cenie za m². W kalkulatorze siedzą',
      'w osobnej kategorii „NATURA WYPRZEDAŻ", a na stronie pod adresem',
      'kam24h.pl/wyprzedaz-plyt. To NIE są zwykłe ceny katalogowe — to',
      'policzone sztuki, które znikają, gdy zejdą.',
      '',
      'Używaj na początku rozmowy o materiale i kolorze, żeby WSPOMNIEĆ',
      'o pasującej płycie, jeśli akurat jakaś jest — i zawsze, gdy klient',
      'pyta wprost o okazje, wyprzedaże albo „coś taniej". Nigdy nie zgaduj',
      'cen ani liczby sztuk — tylko z odpowiedzi tego narzędzia. Gdy zwróci',
      'brak płyt, po prostu nie wspominaj o wyprzedaży — to nie błąd.',
    ].join('\n'),
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'sprawdz_magazyn',
    description: [
      'Sprawdza AKTUALNY stan magazynowy hurtowni Interstone: jakie płyty są',
      'na składzie, w jakim formacie, grubości i wykończeniu, po ile za m²',
      'oraz ile metrów jest wolnych.',
      '',
      'Używaj, gdy klient pyta o konkretny kamień naturalny, kwarcyt, marmur',
      'lub granit z oferty Interstone — o dostępność, cenę albo wymiar płyty.',
      'Do konglomeratów i spieków z naszego kalkulatora (Technistone, Marazzi,',
      'Atlas Plan, Keralini, Laminam, Florim Stone) NIE używaj — te wycenia',
      'kalkulator na stronie. Interstone bywa dystrybutorem Laminam, ale ceny',
      'spieku biorą się u nas z cennika, nie ze stanu magazynowego.',
      '',
      'Zwraca dane na dziś. Jeśli odpowiedź zaczyna się od NIEDOSTĘPNE,',
      'znaczy że magazynu nie udało się odczytać — nie zgaduj wtedy',
      'dostępności ani cen, tylko zaproponuj kontakt.',
    ].join('\n'),
    input_schema: {
      type: 'object',
      properties: {
        fraza: {
          type: 'string',
          description:
            'Nazwa materiału do wyszukania, np. „taj mahal", „verde guatemala", „calacatta". ' +
            'Sama nazwa kamienia, bez słów „granit", „blat" czy „cena".',
        },
      },
      required: ['fraza'],
    },
  },
];

async function obsluzChat(request, env, cors, ctx) {
  if (!env.ANTHROPIC_API_KEY) return json({ error: 'Brak konfiguracji.', kod: 'brak-klucza' }, 503, cors);

  const dane = await request.json().catch(() => null);
  const messages = oczyscHistorie(dane?.messages);
  if (!messages.length) return json({ error: 'Pusta rozmowa.' }, 400, cors);

  /*
   * Stan wyprzedaży dokładamy do KAŻDEGO zapytania, a nie dopiero wtedy,
   * gdy model sam sięgnie po narzędzie. Powód jest prosty: żeby po nie
   * sięgnąć, musiałby najpierw wiedzieć, że taka kategoria istnieje —
   * a do 01.09.2026 nie wiedział i dlatego nie umiał wycenić płyty,
   * którą klient wybrał kliknięciem.
   *
   * Awaria bazy nie może wywalić rozmowy: bez tego bloku asystent nadal
   * doradza, tylko nie wspomni o wyprzedaży.
   */
  const dodatkowy = await blokWyprzedazy(env).catch((e) => {
    console.error('wyprzedaz-prompt', e?.message || e);
    return null;
  });

  // Pętla narzędziowa toczy się w CAŁOŚCI tutaj: front wysyła i dostaje
  // zwykły tekst, więc nie musi wiedzieć nic o blokach tool_use.
  let wynik = null;

  for (let tura = 0; tura <= MAKS_NARZEDZI; tura++) {
    // W ostatniej turze zabieramy narzędzia — model musi wtedy odpowiedzieć
    // słowami, zamiast prosić o kolejne sprawdzenie w nieskończoność.
    const ostatnia = tura === MAKS_NARZEDZI;
    wynik = await anthropic(env, messages, ostatnia ? null : NARZEDZIA, dodatkowy);
    if (!wynik) return json({ error: 'Konsultant chwilowo niedostępny.' }, 502, cors);

    const proby = (wynik.content || []).filter((b) => b?.type === 'tool_use');
    if (wynik.stop_reason !== 'tool_use' || !proby.length) break;

    messages.push({ role: 'assistant', content: wynik.content });
    messages.push({
      role: 'user',
      content: await Promise.all(proby.map((b) => wykonajNarzedzie(b, ctx, env))),
    });
  }

  return json({ content: wynik.content, stop_reason: wynik.stop_reason }, 200, cors);
}

async function wykonajNarzedzie(blok, ctx, env) {
  let tresc;
  try {
    if (blok.name === 'sprawdz_magazyn') {
      // Klient często podaje KOD płyty, a nie nazwę kamienia. Magazyn znajdzie
      // go po samym numerze — pełny kod tokenizuje inaczej i gubi trafienie.
      const fraza = numerPlytyZKodu(blok.input?.fraza) || blok.input?.fraza;
      tresc = opiszPlyty(await pobierzMagazyn(fraza, ctx));
    } else if (blok.name === 'sprawdz_wyprzedaz') {
      tresc = await opiszWyprzedazDlaAsystenta(env);
    } else {
      tresc = `NIEDOSTĘPNE: Nieznane narzędzie „${blok.name}".`;
    }
  } catch (e) {
    // Awaria narzędzia nie może wywalić całej rozmowy — model dostaje
    // czytelny komunikat i sam kieruje klienta do kontaktu.
    console.error('narzędzie', blok.name, e?.message || e);
    tresc = 'NIEDOSTĘPNE: Błąd podczas sprawdzania magazynu.';
  }
  return { type: 'tool_result', tool_use_id: blok.id, content: tresc };
}

/** Jedno wywołanie Anthropic. Zwraca odpowiedź albo null przy błędzie. */
async function anthropic(env, messages, narzedzia, dodatkowy) {
  // Prompt bierzemy ZAWSZE stąd — nawet jeśli front coś przyśle.
  // Dzięki temu wytycznych nie da się podmienić z przeglądarki.
  const cialo = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    /*
     * Dwa bloki systemowe, celowo. Pierwszy jest STAŁY (wytyczne + dekory
     * z cennika) i dlatego objęty cache. Drugi niesie stan wyprzedaży
     * z D1 — zmienia się, gdy Dawid doda albo sprzeda płytę, więc cache
     * go nie obejmuje. Sklejone w jedno psułyby cache całości.
     */
    system: [
      { type: 'text', text: PROMPT, cache_control: { type: 'ephemeral' } },
      ...(dodatkowy ? [{ type: 'text', text: dodatkowy }] : []),
    ],
    messages,
  };
  if (narzedzia) cialo.tools = narzedzia;

  try {
    const odp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(cialo),
    });

    if (!odp.ok) {
      console.error('anthropic', odp.status, await odp.text().catch(() => ''));
      return null;
    }
    return await odp.json();
  } catch (e) {
    console.error('anthropic', e?.message || e);
    return null;
  }
}

/* ──────────────────────────────────────────────────────────────── /magazyn */

/**
 * Ten sam odczyt co narzędzie konsultanta, tylko wołany wprost.
 *
 * Woła go STRONA, gdy ma policzyć wstępną wycenę kamienia naturalnego.
 * Robi to sama, zamiast brać cenę i wymiar płyty z wiadomości konsultanta —
 * model potrafi się pomylić przy przepisywaniu liczb, a tu chodzi o kwotę
 * na fakturze. Konsultant podaje wyłącznie NAZWĘ kamienia.
 *
 * Przydaje się też do sprawdzenia „czy Interstone nadal daje się parsować"
 * bez płacenia za rozmowę z modelem.
 */
async function obsluzMagazyn(request, cors, ctx) {
  const dane = await request.json().catch(() => null);

  /*
   * DWIE ROZŁĄCZNE ŚCIEŻKI.
   *
   * `kod` → szukamy JEDNEJ konkretnej płyty: dokładne dopasowanie po
   * znormalizowanym kodzie, po całym magazynie, bez filtra nazwy i bez filtra
   * dostępności (żeby odróżnić „nie ma takiego kodu" od „płyta już zeszła").
   *
   * `fraza` → zwykłe szukanie po nazwie kamienia, z listą wariantów do wyboru.
   *
   * Mieszanie tych dwóch rzeczy kosztowało nas wcześniej błędny wniosek,
   * że magazyn nie zna kodów — gubił je nasz własny filtr trafień.
   */
  if (dane?.kod) {
    const wynik = await znajdzPlyte(dane.kod, ctx);
    return json(
      {
        ok: wynik.ok,
        plyta: wynik.plyta || null,
        kod: wynik.kod || null,
        powodKodu: wynik.ok ? null : wynik.powod,
        kody: wynik.kody || null,
        // Adres, pod którym klient sam sprawdzi płytę — do każdego komunikatu
        // o błędzie, żeby miał gdzie kliknąć zamiast utknąć.
        link: linkMagazynu(wynik.plyta?.nazwa || '', wynik.plyta?.marka) || null,
        zCache: !!wynik.zCache,
      },
      wynik.powod === 'magazyn-niedostepny' ? 503 : 200,
      cors
    );
  }

  const wynik = await pobierzMagazyn(dane?.fraza, ctx);
  return json(
    {
      ...wynik,
      warianty: wynik.ok ? pogrupuj(wynik.plyty) : [],
      opis: opiszPlyty(wynik),
    },
    wynik.ok ? 200 : wynik.powod === 'pusta-fraza' ? 400 : 503,
    cors
  );
}

function oczyscHistorie(messages) {
  if (!Array.isArray(messages)) return [];
  const out = [];
  for (const m of messages.slice(-30)) {
    const role = m?.role === 'assistant' ? 'assistant' : 'user';
    const content = String(m?.content || '').slice(0, 1500).trim();
    if (content) out.push({ role, content });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  return out;
}

/* ─────────────────────────────────────────────────────────────────── /lead */

async function obsluzLead(request, env, cors) {
  const d = await request.json().catch(() => null);
  if (!d) return json({ error: 'Niepoprawne dane.' }, 400, cors);

  const telefon = String(d.phone || '').trim();
  const email = String(d.email || '').trim();
  const miejscowosc = String(d.city || '').trim();
  /*
   * PLANOWANY TERMIN (zlecenie Dawida, 30.08.2026) — po nim Dawid ustala
   * kolejność obdzwaniania. Nieznaną wartość zamieniamy na pustą zamiast
   * odrzucać zgłoszenie: lead jest wart o wiele więcej niż to pole,
   * a stara zakładka w przeglądarce klienta nie zna nowej listy.
   */
  const terminId = znanyTermin(d.termin) ? String(d.termin || '') : '';

  if (telefon.replace(/\D/g, '').length < 9) return json({ error: 'Telefon.' }, 400, cors);
  if (!/^[^@\s]+@[^@\s.]+\.[^@\s]{2,}$/.test(email)) return json({ error: 'E-mail.' }, 400, cors);
  if (!miejscowosc) return json({ error: 'Miejscowość.' }, 400, cors);
  if (!env.RESEND_API_KEY) return json({ error: 'Brak konfiguracji poczty.' }, 503, cors);

  const imie = String(d.name || '').trim() || 'Klient';
  const wycena = String(d.quote || '').trim();
  // Zastrzeżenie zależne od materiału — przy kamieniu naturalnym mówi, że
  // wycena jest wstępna, bo konkretna płyta może zejść z magazynu.
  const uwaga = String(d.uwaga || '').trim().slice(0, 400);
  // Link do magazynu przyjmujemy tylko wtedy, gdy prowadzi do Interstone —
  // pole przychodzi z przeglądarki, więc nie wolno go wstawić do maila w ciemno.
  const linkPlyty = /^https:\/\/(www\.)?interstone\.pl\//.test(String(d.linkPlyty || ''))
    ? String(d.linkPlyty).slice(0, 400)
    : '';
  const odKogo = nadawca(env);
  const doFirmy = doDawida(env);

  const zalaczniki = [];
  if (d.file && d.filename) {
    zalaczniki.push({ filename: String(d.filename).slice(0, 120), content: String(d.file) });
  }

  // Pole przychodzi z przeglądarki — ktoś może wysłać obiekt bez `pozycje`
  // ręcznym POST-em i taki brak nie ma prawa wywrócić wysyłki maili.
  const szczegoly = d.szczegoly && typeof d.szczegoly === 'object' ? d.szczegoly : null;
  if (szczegoly && !Array.isArray(szczegoly.pozycje)) szczegoly.pozycje = [];
  const klient = { imie, telefon, email, miejscowosc, terminId, uwagi: String(d.uwagi || '').trim() };

  // 1. zgłoszenie do firmy — pełne rozbicie, transkrypcja i załącznik
  const doFirmyOdp = await resend(env, {
    from: odKogo,
    to: [doFirmy],
    reply_to: email,
    subject: tematLeada(klient, szczegoly, wycena),
    html: mailDoFirmy(klient, szczegoly, { wycena, uwaga, transkrypcja: d.transcript }),
    text: leadTekstem(klient, szczegoly, { wycena, uwaga, transkrypcja: d.transcript }),
    attachments: zalaczniki.length ? zalaczniki : undefined,
  });

  // 2. wycena do klienta
  const doKlientaOdp = await resend(env, {
    from: odKogo,
    to: [email],
    reply_to: doFirmy,
    subject: 'Pana/Pani wycena blatu — Kamieniarstwo 24h',
    html: mailDoKlienta(imie, wycena, uwaga, linkPlyty, szczegoly),
  });

  /*
   * BAZA KLIENTÓW — dopiero po mailach i w pełni „na własne ryzyko".
   * Zgłoszenie ma dojechać do Dawida nawet wtedy, gdy baza akurat nie
   * odpowiada; dlatego wynik zapisu nie wpływa na odpowiedź dla przeglądarki.
   */
  try {
    await zapiszLead(env, {
      imie: imie === 'Klient' ? '' : imie,
      telefon,
      email,
      miejscowosc,
      termin: terminId,
      kwota: d.kwota,
      opis: wycena,
      szczegoly,
      pomieszczenie: szczegoly?.pomieszczenie || '',
      zrodlo: d.zrodlo,
    });
  } catch (e) {
    console.error('baza', e?.message || e);
  }

  return json(
    { ok: true, doFirmy: doFirmyOdp, doKlienta: doKlientaOdp },
    doFirmyOdp ? 200 : 502,
    cors
  );
}

/* ─────────────────────────────────────────────── /oferta („Powtórz wycenę") */

/**
 * Autoryzacja trybu właściciela: panel podpisuje `oferta|leadId|exp`
 * HMAC-em z hasła panelu i wkleja podpis do linku „Powtórz wycenę".
 * Zmiana hasła unieważnia wszystkie stare linki — tak jak ciasteczka.
 */
/**
 * Stawki zakładu dla kalkulatora. Odczyt jest PUBLICZNY — to nasze ceny
 * sprzedaży, które klient i tak zobaczy w wycenie; edytować może wyłącznie
 * Dawid z panelu (/panel/api/stawki, za hasłem).
 */
async function obsluzUstawienia(env, cors) {
  try {
    return json({ ok: true, ustawienia: await odczytajStawki(env) }, 200, cors);
  } catch (e) {
    console.error('ustawienia', e?.message || e);
    // Milczące zero: kalkulator ma wtedy policzyć stawkami domyślnymi.
    return json({ ok: true, ustawienia: {} }, 200, cors);
  }
}

async function tokenWlasciciela(env, leadId, exp, podpisKlienta) {
  if (!env.PANEL_HASLO) return false;
  if (!leadId || !exp || Number(exp) < Date.now()) return false;
  const wzor = await podpisz(env.PANEL_HASLO, `oferta|${leadId}|${exp}`);
  const podany = String(podpisKlienta || '');
  if (podany.length !== wzor.length) return false;
  let r = 0;
  for (let i = 0; i < wzor.length; i++) r |= wzor.charCodeAt(i) ^ podany.charCodeAt(i);
  return r === 0;
}

/**
 * KTORE KOLEKCJE ZNA ASYSTENT (/kolekcje).
 *
 * POWÓD POWSTANIA (25.08.2026): po dodaniu cennika Pacific konsultant
 * na produkcji twierdził, że takiego materiału nie ma — bo prompt jest
 * generowany poprawnie z src/firms, ale WORKER NIE ZOSTAŁ WDROŻONY.
 * Strona znała nowy cennik, asystent nie. Z zewnątrz nie dało się tego
 * zobaczyć inaczej niż przez rozmowę.
 *
 * Ten endpoint pokazuje wprost, co siedzi w PROMPCIE wdrożonej wersji.
 * `npm run sprawdz:asystent` porównuje to z lokalnymi cennikami i mówi,
 * czy trzeba wdrożyć workera. Nazwy kolekcji są publiczne (widnieją
 * w kalkulatorze), więc nic tu nie wycieka.
 *
 * ⚠ ZNIKNĘŁA RAZ (30.08.2026): przy przepisywaniu promocji na wyprzedaż
 * podmieniłem blok kodu po NUMERACH LINII, a ta funkcja stała w środku
 * tego zakresu. Trasa została, funkcji nie było — `/kolekcje` oddawało
 * surowy wyjątek workera (1101), bo stoi POZA `try`. Stąd test dymny
 * `scripts/test-worker-smoke.mjs`, który woła każdą trasę z osobna.
 */
function obsluzKolekcje(cors) {
  const kolekcje = [...DEKORY.matchAll(/^##\s*(.+)$/gm)].map((m) => m[1].trim());
  const dekorow = (DEKORY.match(/;/g) || []).length + kolekcje.length;
  return json({ ok: true, kolekcje, dekorow }, 200, cors);
}

/**
 * Autoryzacja podglądu wyprzedaży — szkice płyt NIE są przypięte do
 * żadnego klienta (`leadId`), więc mają WŁASNY, prostszy podpis:
 * `wyprzedaz|<id>|<exp>`. Panel wkleja go w link „Podgląd" przy szkicu.
 */
async function tokenWyprzedazy(env, id, exp, podpisKlienta) {
  if (!env.PANEL_HASLO) return false;
  if (!id || !exp || Number(exp) < Date.now()) return false;
  const wzor = await podpisz(env.PANEL_HASLO, `wyprzedaz|${id}|${exp}`);
  const podany = String(podpisKlienta || '');
  if (podany.length !== wzor.length) return false;
  let r = 0;
  for (let i = 0; i < wzor.length; i++) r |= wzor.charCodeAt(i) ^ podany.charCodeAt(i);
  return r === 0;
}

/**
 * WYPRZEDAŻ PŁYT (POST /wyprzedaz).
 *
 * PUBLICZNIE zwraca wyłącznie płyty DOSTĘPNE: opublikowane i takie,
 * z których coś jeszcze zostało. Dokładnie to, co ma zobaczyć klient
 * w kategorii „NATURA WYPRZEDAŻ" i na stronie wyprzedaży.
 *
 * PODGLĄD WŁAŚCICIELA: `{ podgladId, exp, podpis }` z ważnym podpisem
 * dokłada JEDEN wskazany szkic — Dawid widzi go razem z tym, co już jest
 * opublikowane, dokładnie tak, jak wyglądałaby strona, gdyby ten szkic
 * był live. Bez ważnego podpisu żądanie z `podgladId` dostaje po prostu
 * widok publiczny: nie da się podejrzeć cudzego szkicu, zgadując numer.
 */
async function obsluzWyprzedaz(request, env, cors) {
  const d = (await request.json().catch(() => ({}))) || {};
  const podglad = !!d.podgladId && (await tokenWyprzedazy(env, d.podgladId, d.exp, d.podpis));

  const wszystkie = await listaPlyt(env, {
    dolaczId: podglad ? Number(d.podgladId) : null,
  });

  // Szkic w podglądzie jest z definicji `opublikowana = 0`, więc nie
  // przeszedłby przez `dostepna`. Przepuszczamy dokładnie ten jeden.
  const widoczne = wszystkie.filter(
    (p) => dostepna(p) || (podglad && p.id === Number(d.podgladId) && p.plytZostalo > 0)
  );

  return json({ ok: true, plyty: widoczne, podglad }, 200, cors);
}

/**
 * Zdjęcie płyty wgrane przez panel (GET /wyprzedaz/zdjecie/<id>).
 *
 * Trzymamy je w D1 jako data URI, ale NIE wysyłamy go w liście płyt —
 * przy kilku płytach lista urosłaby do megabajtów i kalkulator wstawałby
 * wolniej dla wszystkich, także dla klientów, którzy wyprzedaży nie oglądają.
 * Zamiast tego lista niesie sam adres, a obrazek idzie osobno i z cache.
 */
async function obsluzZdjecieWyprzedazy(sciezka, env, cors, szukaj) {
  const id = Number(sciezka.split('/').pop());
  if (!id) return json({ error: 'Brak zdjęcia.' }, 404, cors);

  // `?mini=1` — miniatura do listy (~300 px). Bez tego pełne zdjęcie.
  const mini = szukaj?.get('mini') === '1';
  // `?v=` — znacznik zmiany wiersza. Nie czytamy go, ale to on sprawia, że
  // po podmianie zdjęcia w panelu klient dostaje NOWY adres, a nie stary
  // obrazek z cache.
  const wersjonowane = !!szukaj?.get('v');

  const dane = await zdjeciePlyty(env, id, mini);
  const m = /^data:(image\/[a-z]+);base64,(.+)$/.exec(dane || '');
  if (!m) return json({ error: 'Brak zdjęcia.' }, 404, cors);

  const bajty = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
  return new Response(bajty, {
    headers: {
      ...cors,
      'Content-Type': m[1],
      /*
       * Adres ze znacznikiem `?v=` zmienia się przy KAŻDEJ edycji płyty,
       * więc obrazek pod nim jest niezmienny — można go trzymać rok.
       * Adres bez znacznika (stare linki, wklejone gdzieś wcześniej) dostaje
       * godzinę, tak jak dotąd: tam podmiana zdjęcia nie zmienia adresu
       * i dłuższy cache pokazywałby Dawidowi stare zdjęcie.
       */
      'Cache-Control': wersjonowane
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=3600',
    },
  });
}

/**
 * Płyty z wyprzedaży opisane dla asystenta.
 *
 * ⚠ KAŻDA POZYCJA NIESIE `dekor` — dokładny klucz, który asystent ma wpisać
 * do wyceny. To jest sedno błędu z 01.09.2026, zgłoszonego przez Dawida:
 * asystent mówił „wycena płyty Taj Mahal Light jest gotowa", a zaraz potem
 * „NIE ZNAM DEKORU »Taj Mahal Light Konglomerat Kwarcowy«" — bo kalkulator
 * szuka klucza z numerem sztuki („… #6"), a model podawał samą nazwę.
 *
 * Klucz liczy `kluczDekoru` z `src/app/wyprzedaz-klucz.js` — TA SAMA funkcja,
 * której używa kalkulator. Przepisana tutaj „na chwilę" rozjechałaby się
 * przy pierwszej zmianie formatu.
 *
 * Cen zakupowych ani rabatów Dawida tu NIE MA i być nie może — `cenaM2`
 * to gotowa cena dla klienta, ta sama, którą widzi na karcie płyty.
 */
async function opiszWyprzedazDlaAsystenta(env) {
  const plyty = (await listaPlyt(env, {})).filter(dostepna);
  if (!plyty.length) return 'Brak płyt na wyprzedaży — nie wspominaj o niej.';

  return plyty
    .map((p, i) => {
      const bylo = p.cenaNormalnaM2 > 0 ? ` (normalnie ${p.cenaNormalnaM2} zł/m²)` : '';
      const kod = p.kodPlyty ? `, płyta nr ${p.kodPlyty}` : '';
      const opis = p.opis ? ` — ${p.opis}` : '';
      return (
        `${i + 1}. „${p.nazwa}"${opis} — ${p.plytaDlCm}×${p.plytaGlCm} cm, ${p.gruboscMm} mm${kod}; ` +
        `${p.cenaM2} zł/m² brutto${bylo}; zostało ${p.plytZostalo} z ${p.plytRazem}.\n` +
        `   dekor do wyceny: "${kluczDekoru(p)}"`
      );
    })
    .join('\n');
}

/**
 * DRUGI BLOK SYSTEMOWY — wyprzedaż na żywo.
 *
 * ⚠ DLACZEGO OSOBNY BLOK, A NIE DOKLEJENIE DO `PROMPT`.
 * Lista dekorów w `PROMPT` powstaje przy BUDOWANIU workera, z plików
 * cennika — i jest wysyłana z `cache_control`, bo się nie zmienia. Płyty
 * z wyprzedaży leżą w D1 i zmieniają się bez wdrożenia, więc doklejone
 * do tamtego bloku psułyby cache przy każdej zmianie stanu magazynu.
 *
 * ⚠ DLACZEGO W OGÓLE. Do 01.09.2026 prompt asystenta NIE WSPOMINAŁ
 * o wyprzedaży ani słowem (0 trafień na „wyprzedaż" w wytycznych).
 * Narzędzie `sprawdz_wyprzedaz` istniało, ale model nie wiedział, że jest
 * taka kategoria, więc go nie wołał i nie umiał jej wycenić. To ta sama
 * klasa błędu, co Pacific 25.08: ściąga materiałów nie obejmowała
 * czegoś, co kalkulator liczył od dawna.
 *
 * Zwraca `null`, gdy Dawid nic nie wystawił — wtedy nie zajmujemy modelowi
 * kontekstu na pustą listę.
 */
async function blokWyprzedazy(env) {
  const opis = await opiszWyprzedazDlaAsystenta(env);
  if (opis.startsWith('Brak płyt')) return null;

  return [
    '# WYPRZEDAŻ PŁYT — stan na teraz (dane z magazynu, nie z cennika)',
    '',
    'To pojedyncze, konkretne płyty z placu Dawida w gotowej, niższej cenie.',
    'W kalkulatorze są osobną kategorią „NATURA WYPRZEDAŻ". Rozliczamy je',
    'ZA CAŁĄ PŁYTĘ, nie za metry blatu — klient kupuje sztukę.',
    '',
    opis,
    '',
    'JAK JE WYCENIĆ. W poleceniu `quote` podaj:',
    '  "material": "NATURA WYPRZEDAŻ"',
    '  "dekor":    dokładnie ten ciąg z pola „dekor do wyceny" wyżej,',
    '              razem z numerem sztuki — bez niego kalkulator odpowie',
    '              „nie znam dekoru".',
    '  "grubosc":  grubość tej płyty z listy wyżej.',
    '',
    'Nigdy nie podawaj kwoty wyceny w rozmowie — liczy ją kalkulator,',
    'a klient widzi ją po zostawieniu kontaktu. Nie obiecuj też więcej sztuk,',
    'niż jest na liście: gdy blat wymaga dwóch płyt, a została jedna,',
    'powiedz o tym wprost i zaproponuj kontakt.',
  ].join('\n');
}

async function obsluzOfertaDane(request, env, cors) {
  const d = await request.json().catch(() => null);
  if (!d?.token) return json({ ok: false }, 400, cors);
  try {
    // Podgląd z edytora Dawida nie liczy się jako „klient obejrzał" —
    // wymaga ważnego podpisu właściciela, więc klient go nie podrobi.
    const podglad = !!d.podglad && (await tokenWlasciciela(env, d.leadId, d.exp, d.podpis));
    const wynik = await ofertaPoTokenie(env, d.token, { podglad });
    if (!wynik?.oferta) return json({ ok: false }, 404, cors);
    return json(
      {
        ok: true,
        imie: wynik.imie,
        utworzono: wynik.utworzono,
        oferta: wynik.oferta,
        // Rozmowa pod ofertą — klient widzi całą historię od razu przy wycenie.
        rozmowa: wynik.rozmowa || [],
        // Ktora wersje klient wlasnie oglada i kiedy zostala opublikowana —
        // z tego strona sklada znacznik „Oferta zaktualizowana…".
        wersjaNr: wynik.wersjaNr || 1,
        opublikowano: wynik.opublikowano || wynik.utworzono,
        zaktualizowana: !!wynik.zaktualizowana,
      },
      200,
      cors
    );
  } catch (e) {
    console.error('oferta/dane', e?.message || e);
    return json({ ok: false }, 500, cors);
  }
}

/**
 * Zapis wersji Dawida + mail do klienta z linkiem do wyceny online.
 * Wymaga podpisu właściciela z panelu — z kalkulatora bez panelu nie da
 * się tego wywołać, więc klient nigdy nie wyśle sobie sam oferty.
 */
async function obsluzOfertaWyslij(request, env, cors) {
  const d = await request.json().catch(() => null);
  if (!d) return json({ error: 'Niepoprawne dane.' }, 400, cors);
  if (!(await tokenWlasciciela(env, d.leadId, d.exp, d.podpis)))
    return json({ error: 'Brak autoryzacji.' }, 401, cors);

  const o = d.oferta && typeof d.oferta === 'object' ? d.oferta : null;
  if (!o || !Array.isArray(o.pozycje) || !o.pozycje.length || !(Number(o.razem) > 0))
    return json({ error: 'Pusta oferta.' }, 400, cors);

  /*
   * WIADOMOŚĆ OD DAWIDA (zlecenie z 24.08.2026) — osobisty dopisek, który
   * idzie i do maila, i na stronę oferty. Limit tniemy TUTAJ, a nie tylko
   * w przeglądarce: pole z formularza nie jest żadnym dowodem długości.
   * Zamrażamy go razem z ofertą, więc późniejsza zmiana go nie ruszy.
   */
  o.wiadomosc = String(o.wiadomosc || '').trim().slice(0, MAKS_ZNAKOW);

  const klient = await env.BAZA.prepare(`SELECT id, imie, email FROM klienci WHERE id = ?`)
    .bind(Number(d.leadId))
    .first();
  if (!klient?.email) return json({ error: 'Karta bez adresu e-mail.' }, 404, cors);

  /*
   * PODGLĄD PRZED WYSYłKĄ (decyzja Dawida, 21.08.2026).
   *
   * Ten sam generator treści co przy wysyłce — Dawid widzi dokładnie ten
   * mail, który pójdzie do klienta, a nie jego podobiznę. Nic się przy tym
   * nie zapisuje i nic nie wychodzi: żadnej wersji w karcie, żadnego maila,
   * status leada bez zmian.
   */
  if (d.podglad === true) {
    return json(
      {
        ok: true,
        podglad: true,
        temat: TEMAT_OFERTY,
        adres: klient.email,
        // Link powstanie dopiero przy wysyłce — w podglądzie pokazujemy,
        // jak będzie wyglądał, żeby przycisk w mailu nie był pusty.
        html: mailOferty(klient.imie, o, 'https://kam24h.pl/oferta#(link-powstanie-przy-wysylce)'),
      },
      200,
      cors
    );
  }

  // Token linku: 32 znaki hex z generatora kryptograficznego.
  const bajty = new Uint8Array(16);
  crypto.getRandomValues(bajty);
  const token = [...bajty].map((b) => b.toString(16).padStart(2, '0')).join('');

  /*
   * AKTUALIZACJA POD TYM SAMYM LINKIEM (zlecenie Dawida, 25.08.2026).
   *
   * `d.watek` niesie token pierwszej wersji. Nowa wersja to zawsze nowy
   * WIERSZ (historia i audyt zostają nietknięte), ale należy do tego
   * samego wątku — więc klient pod starym linkiem zobaczy właśnie ją.
   *
   * Sprawdzamy, czy wątek naprawdę należy do TEGO klienta: bez tego
   * podpisany link właściciela pozwalałby dopisać wersję do cudzej oferty.
   */
  let watek = '';
  const zadanyWatek = String(d.watek || '').trim();
  if (/^[a-f0-9]{32,64}$/.test(zadanyWatek)) {
    const nalezy = await env.BAZA.prepare(
      `SELECT 1 FROM wyceny WHERE watek = ? AND klient_id = ? LIMIT 1`
    )
      .bind(zadanyWatek, klient.id)
      .first();
    if (nalezy) watek = zadanyWatek;
  }

  const zapis = await zapiszOferte(env, klient.id, o, token, watek);
  const aktualizacja = !!watek;

  // Link klienta się NIE zmienia przy aktualizacji — na tym polega cały
  // pomysł: „żeby nie robić 5 osobnych wycen".
  const link = `https://kam24h.pl/oferta#${zapis.watek}`;

  /*
   * Mail przy aktualizacji jest OPCJONALNY i domyślnie go nie ma.
   * Dawid zwykle poprawia wycenę w trakcie rozmowy telefonicznej, a klient
   * po prostu odświeża stronę — osobny mail przy każdej poprawce byłby
   * hałasem. Przy NOWEJ ofercie mail leci jak dotąd.
   */
  const powiadom = aktualizacja ? d.powiadom === true : true;
  const wyslany = powiadom
    ? await resend(env, {
        from: nadawca(env),
        to: [klient.email],
        reply_to: doDawida(env),
        subject: aktualizacja ? `${TEMAT_OFERTY} (aktualizacja)` : TEMAT_OFERTY,
        html: mailOferty(klient.imie, o, link),
      })
    : false;

  return json({ ok: true, token: zapis.watek, link, mail: wyslany, aktualizacja }, 200, cors);
}


/* ─────────────────────────────────────────────────────────────── /feedback */

/**
 * Klient klika pod wyceną „pasuje mi / za drogo / zastanowię się".
 * Zero danych wrażliwych poza tym, co już mamy z bramki; zapis do bazy
 * klientów, żaden mail nie leci. Odpowiadamy zawsze 200 — feedback to
 * bonus i przeglądarka nie ma z nim nic do roboty.
 */
/**
 * KLIENT PISZE POD SWOJĄ WYCENĄ (/oferta/napisz).
 *
 * Bez logowania — autoryzuje token z linku do oferty (kto ma link, ma
 * wątek; taki sam próg jak przy oglądaniu samej wyceny). Obrona stoi
 * na treści i tempie: pole-pułapka na boty, limit długości, odstęp
 * między wiadomościami i sufit na wątek — patrz worker/rozmowa.js.
 *
 * Odpowiadamy ZAWSZE całym wątkiem, żeby strona nie musiała zgadywać,
 * co się zapisało.
 */
async function obsluzOfertaNapisz(request, env, cors) {
  const d = await request.json().catch(() => null);
  if (!d?.token) return json({ ok: false, powod: 'Brak wyceny.' }, 400, cors);

  try {
    // `podglad: true` — napisanie wiadomości to nie jest „klient obejrzał
    // ofertę"; licznik otwarć ma zostać uczciwy.
    const w = await ofertaPoTokenie(env, String(d.token), { podglad: true });
    if (!w?.wycenaId) return json({ ok: false, powod: 'Nie znaleźliśmy tej wyceny.' }, 404, cors);

    // Wątek wisi przy PIERWSZEJ wersji oferty, więc przetrwa aktualizacje.
    const kotwica = w.watekId || w.wycenaId;
    const limity = await kontekstRozmowy(env, kotwica);
    const sprawdzenie = sprawdzWiadomosc(d.tresc, { pulapka: d.pulapka, ...limity });
    if (!sprawdzenie.ok) {
      // Botowi nie tłumaczymy, co go zdradziło — dostaje zwykłe „ok",
      // żeby nie miał czego optymalizować. Nic się nie zapisuje.
      if (sprawdzenie.spam) return json({ ok: true, rozmowa: w.rozmowa || [] }, 200, cors);
      return json({ ok: false, powod: sprawdzenie.powod }, 200, cors);
    }

    await dopiszWiadomosc(env, {
      wycenaId: kotwica,
      klientId: w.klientId,
      autor: 'klient',
      tresc: sprawdzenie.tresc,
    });

    const klient = await env.BAZA.prepare(`SELECT imie, telefon, email FROM klienci WHERE id = ?`)
      .bind(w.klientId)
      .first();

    // Mail do Dawida leci obok odpowiedzi: klient nie ma czekać na Resend,
    // żeby zobaczyć swój dymek w rozmowie.
    const powiadomienie = resend(env, {
      from: nadawca(env),
      to: [doDawida(env)],
      reply_to: klient?.email || undefined,
      subject: tematDoDawida(klient?.imie, w.oferta?.opis),
      html: mailDoDawida({
        imie: klient?.imie,
        telefon: klient?.telefon,
        email: klient?.email,
        opis: w.oferta?.opis,
        tresc: sprawdzenie.tresc,
        linkPanelu: `${new URL(request.url).origin}/panel`,
      }),
    });
    if (typeof powiadomienie?.catch === 'function') powiadomienie.catch(() => {});

    return json({ ok: true, rozmowa: await rozmowaOferty(env, kotwica) }, 200, cors);
  } catch (e) {
    console.error('oferta/napisz', e?.message || e);
    return json(
      { ok: false, powod: 'Nie udało się wysłać. Proszę spróbować za chwilę.' },
      500,
      cors
    );
  }
}

async function obsluzFeedback(request, env, cors) {
  const d = await request.json().catch(() => null);
  if (!d) return json({ ok: false }, 400, cors);
  try {
    // Ze strony wyceny online przychodzi token oferty zamiast telefonu —
    // rozwiązujemy go na kartę klienta po stronie serwera.
    let klientId = 0;
    if (d.oferta) {
      const zTokenu = await ofertaPoTokenie(env, String(d.oferta), { podglad: true });
      klientId = zTokenu?.klientId || 0;
      if (!klientId) return json({ ok: false }, 200, cors);
    }
    const wynik = await zapiszFeedback(env, {
      klientId,
      telefon: String(d.telefon || '').slice(0, 40),
      email: String(d.email || '').slice(0, 120),
      feedback: String(d.feedback || ''),
      budzet: String(d.budzet || '').slice(0, 40),
      pora: String(d.pora || '').slice(0, 40),
      // Który wariant materiałowy wskazał klient — opis, nie indeks:
      // ma być czytelny wprost w notatce na karcie.
      wariant: String(d.wariant || '').slice(0, 120),
      wersja: Number(d.wersja) || 1,
    });
    return json({ ok: !!wynik }, 200, cors);
  } catch (e) {
    console.error('feedback', e?.message || e);
    return json({ ok: false }, 200, cors);
  }
}


/* ──────────────────────────────────── mail leadowy do firmy (dla Dawida) */

const zl = (n) => Math.round(Number(n) || 0).toLocaleString('pl-PL') + ' zł';

/**
 * Widełki ±10% do maila firmowego.
 *
 * `widelki` przychodzi z przeglądarki i teoretycznie może go zabraknąć —
 * a sięganie po `s.widelki.od` w ciemno wywracało CAŁĄ obsługę zgłoszenia:
 * mail nie wychodził, lead nie zapisywał się w bazie, a klient dostawał
 * „spróbuj ponownie". Jeden brakujący klucz nie ma prawa kosztować leada,
 * więc gdy widełek nie ma, pokazujemy samo wyliczenie.
 */
const widelki = (s) =>
  s?.widelki?.od > 0 ? `${zl(s.widelki.od)} – ${zl(s.widelki.do)}` : zl(s?.razem);
/** 1 płyta / 2 płyty / 5 płyt — mail czyta człowiek, nie parser. */
function mnogaPlyt(n) {
  const d = n % 10;
  const st = n % 100;
  if (n === 1) return 'płyta';
  if (d >= 2 && d <= 4 && !(st >= 12 && st <= 14)) return 'płyty';
  return 'płyt';
}

const lb = (n, m = 1) => {
  const x = Math.round((Number(n) || 0) * 10 ** m) / 10 ** m;
  return String(x).replace('.', ',');
};

/**
 * Polski numer to 9 cyfr. Numer z leada Pauliny (+4851581645) miał osiem —
 * czyli literówkę. Nie odrzucamy zgłoszenia, bo mail i tak działa, ale Dawid
 * ma o tym wiedzieć ZANIM zacznie wydzwaniać pod niedziałający numer.
 */
function telefonPodejrzany(telefon) {
  let c = String(telefon || '').replace(/\D/g, '');
  if (c.startsWith('0048')) c = c.slice(4);
  else if (c.startsWith('48') && c.length > 9) c = c.slice(2);
  if (c.length === 9) return null;
  return `numer ma ${c.length} ${c.length === 1 ? 'cyfrę' : c.length < 5 ? 'cyfry' : 'cyfr'} zamiast 9`;
}

/** „Nowa wycena: Paulina, Przecław — 22 200–27 150 zł — Technistone Calacatta Volegno" */
function tematLeada(klient, s, wycenaTekst) {
  // „PILNE" na samym początku tematu: Dawid widzi to na liście maili
  // w telefonie, bez otwierania. To cały sens tego pola.
  const czesci = [
    `${pilny(klient.terminId) ? 'PILNE — ' : ''}Nowa wycena: ${klient.imie}, ${klient.miejscowosc}`,
  ];
  if (s?.widelki?.od) {
    czesci.push(`${Math.round(s.widelki.od).toLocaleString('pl-PL')}–${zl(s.widelki.do)}`);
  }
  if (s?.firma) czesci.push([s.firma, s.dekor].filter(Boolean).join(' '));
  else if (wycenaTekst) czesci.push(wycenaTekst.split('·')[0].trim());
  // Kod płyty w temacie: przy kamieniu naturalnym to jedyna informacja,
  // po której Dawid zarezerwuje właściwy blok, nie otwierając maila.
  if (s?.kodPlyty) czesci.push(s.kodPlyty);
  return czesci.join(' — ').slice(0, 180);
}

/** Rozmowa bez powitań i bez ścian tekstu — ma się mieścić na jednym ekranie. */
function skrocTranskrypcje(tekst, maks = 1800) {
  const linie = String(tekst || '')
    .split(/\n{2,}/)
    .map((l) => l.trim())
    .filter(Boolean)
    // Powitanie asystenta i uprzejmości nic nie wnoszą — Dawid zna swój skrypt.
    .filter((l) => !/^Konsultant:\s*Dzień dobry, jestem asystentem/i.test(l))
    .filter((l) => !/^Klient:\s*(dzień dobry|cześć|witam)[.!, ]*$/i.test(l));

  const out = [];
  let dlugosc = 0;
  for (let i = linie.length - 1; i >= 0; i--) {
    const l = linie[i].length > 320 ? linie[i].slice(0, 317) + '…' : linie[i];
    if (dlugosc + l.length > maks) {
      out.unshift(`[…wcześniejsza część rozmowy pominięta — ${i + 1} wiadomości]`);
      break;
    }
    out.unshift(l);
    dlugosc += l.length;
  }
  return out.join('\n');
}

/** Które kawałki na której płycie — to, czego brakowało w starym mailu. */
function opisUkladu(s) {
  if (!s?.uklad?.length) return [];
  return s.uklad.map((pl, i) => {
    const pasy = pl.pasy.map((pas) => {
      const el = pas.elementy
        .map((e) => {
          const zrodlo = s.odcinki?.[e.odcinek];
          const nazwa = zrodlo ? `odcinek ${lb(zrodlo.gl, 0)}×${lb(zrodlo.dl, 0)}` : `odcinek ${e.odcinek + 1}`;
          return `${lb(e.dl)} cm — ${nazwa}${e.ciety ? ' (kawałek, tu wypada łączenie)' : ''}`;
        })
        .join(' + ');
      return `${el}  [zajęte ${lb(pas.zajete)} z ${lb(pas.dostepne)} cm]`;
    });
    return { nr: i + 1, wysokosc: `${lb(pl.wysokoscUzyta)} z ${lb(pl.wysokoscPlyty)} cm`, pasy };
  });
}

function wykorzystaniePlyty(s) {
  if (!s || !(s.m2Platne > 0)) return null;
  const odpad = Math.round((1 - s.m2Blatu / s.m2Platne) * 100);
  return {
    tekst:
      `${lb(s.m2Blatu, 2)} m² blatu z ${lb(s.m2Platne, 2)} m² ${s.wgMetrazu ? 'materiału' : 'płyt'} ` +
      `(${odpad}% odpadu`,
    odpad,
  };
}

/**
 * Rozbicie podatkowe dla Dawida: netto, VAT i brutto.
 *
 * Stawka zależy od wariantu — 8% przy blacie z montażem w lokalu mieszkalnym,
 * 23% przy odbiorze własnym (dostawa towaru). Dawid wystawia z tego fakturę,
 * więc musi mieć netto i kwotę podatku wprost, a nie do przeliczania w głowie.
 */
function rozbicieVat(s) {
  if (!s || !s.razem) return '';
  const procent = Math.round((s.stawkaVat ?? 0.23) * 100);
  const netto = s.razemNetto ?? Math.round(s.razem / (1 + (s.stawkaVat ?? 0.23)));
  const podatek = s.kwotaVat ?? s.razem - netto;
  const powod =
    procent < 20
      ? 'montaż w lokalu mieszkalnym (społeczny program mieszkaniowy)'
      : 'dostawa towaru — bez montażu';
  return `
    <table style="margin-top:10px;border-collapse:collapse;font-size:13px;color:#3c3730">
      <tr><td style="padding:2px 14px 2px 0">Netto</td>
          <td style="padding:2px 0;text-align:right">${zl(netto)}</td></tr>
      <tr><td style="padding:2px 14px 2px 0">VAT ${procent}%</td>
          <td style="padding:2px 0;text-align:right">${zl(podatek)}</td></tr>
      <tr><td style="padding:4px 14px 2px 0;border-top:1px solid #ded7cb"><b>Brutto</b></td>
          <td style="padding:4px 0 2px;text-align:right;border-top:1px solid #ded7cb"><b>${zl(s.razem)}</b></td></tr>
    </table>
    <div style="color:#8c8474;font-size:12px;margin-top:4px">stawka ${procent}% — ${powod}</div>`;
}

/**
 * PŁYTA W MAGAZYNIE — blok tylko w mailu DO FIRMY.
 *
 * Zlecenie Dawida (26.08.2026): „ciężko mi ją znaleźć na magazynie".
 * Kod płyty stał do tej pory wyłącznie w temacie maila, a żeby zobaczyć
 * płytę, trzeba było wejść na interstone.pl i przeklikać stan magazynowy.
 *
 * Do maila KLIENTA to nie trafia — klient dostaje cenę, nie źródło.
 *
 * Interstone nie daje karcie płyty własnego adresu, więc link zawęża stan
 * magazynowy do numeru tej płyty. Kod stoi obok, bo nietrafiony numer
 * oddaje kilka przypadkowych płyt zamiast pustej listy.
 */
function plytaWMagazynie(s) {
  const kod = s?.kodPlyty;
  const url = kod ? linkPlyty(kod) : null;
  if (!url) return '';
  return `
    <div style="margin:14px 0 0;padding:11px 13px;background:#f7f4ee;border-left:3px solid #c9a86a;border-radius:4px">
      <span style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#8c7040">Płyta w magazynie</span><br>
      <span style="font-family:monospace;font-size:15px;color:#232220">${esc(kod)}</span>
      &nbsp;·&nbsp;
      <a href="${esc(url)}" style="color:#8c7040;font-weight:bold">pokaz te plyte w magazynie &#8599;</a>
    </div>`;
}

function mailDoFirmy(klient, s, extra) {
  const problem = telefonPodejrzany(klient.telefon);
  const uklad = opisUkladu(s);
  const wyk = wykorzystaniePlyty(s);
  const material = s ? s.pozycje.filter((p) => p.grupa === 'materiał') : [];
  // Świadczenia bez osobnego naliczenia (docięcie, polerowanie, klejenie)
  // zostają na liście dla klienta, ale w rozbiciu dla firmy są zbędne —
  // to nie jest kwota do zweryfikowania, tylko zakres.
  const uslugi = s ? s.pozycje.filter((p) => p.grupa === 'usługi' && !p.wCenie) : [];
  const transkrypcja = skrocTranskrypcje(extra.transkrypcja);

  // W mailu do FIRMY pokazujemy szczegół pełny: przy dodatku za obróbkę
  // kamienia naturalnego to stawka, z której wyszła kwota. Klient widzi
  // tylko nazwę pozycji — `detalFirmowy` nigdy nie trafia do jego maila.
  const szczegol = (p) => p.detalFirmowy || p.detal;

  const wiersz = (p) => `
    <tr>
      <td style="padding:7px 10px;border-bottom:1px solid #e8e4dc">
        ${esc(p.nazwa)}${szczegol(p) ? `<br><span style="color:#8c8474;font-size:12px">${esc(szczegol(p))}</span>` : ''}
      </td>
      <td style="padding:7px 10px;border-bottom:1px solid #e8e4dc;text-align:right;white-space:nowrap;font-weight:bold">
        ${zl(p.brutto)}
      </td>
    </tr>`;

  const sekcja = (tytul, poz, suma) =>
    !poz.length
      ? ''
      : `
    <div style="font:bold 11px/1 Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#8c7040;margin:18px 0 6px">${tytul}</div>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      ${poz.map(wiersz).join('')}
      <tr>
        <td style="padding:7px 10px;font-weight:bold">Razem</td>
        <td style="padding:7px 10px;text-align:right;font-weight:bold;white-space:nowrap">${zl(suma)}</td>
      </tr>
    </table>`;

  return `<!doctype html>
<html lang="pl"><body style="margin:0;background:#f4f1ea;font-family:Arial,Helvetica,sans-serif;color:#232220">
<div style="max-width:640px;margin:0 auto;padding:20px">

  <div style="background:#13110f;color:#ece6da;border-radius:6px;padding:18px 20px">
    <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#c9a86a">Nowe zgłoszenie</div>
    <div style="font-size:23px;margin-top:5px">${esc(klient.imie)} · ${esc(klient.miejscowosc)}</div>
    ${
      pilny(klient.terminId)
        ? '<div style="margin-top:9px;display:inline-block;background:#c9a86a;color:#13110f;' +
          'border-radius:4px;padding:5px 11px;font-size:13px;font-weight:bold;letter-spacing:.06em">' +
          'PILNE — KLIENT CHCE BLAT DO 2 TYGODNI</div>'
        : ''
    }
    <table style="width:100%;margin-top:12px;font-size:15px;color:#ece6da">
      <tr>
        <td style="padding:3px 0;width:76px;color:#b6ad9d">Telefon</td>
        <td style="padding:3px 0">
          <a href="tel:${esc(klient.telefon.replace(/[^\d+]/g, ''))}" style="color:#c9a86a;font-weight:bold;font-size:19px;text-decoration:none">${esc(klient.telefon)}</a>
          ${problem ? `<div style="margin-top:5px;background:#5a2418;border-radius:4px;padding:7px 9px;font-size:13px;color:#ffd9cf"><b>Uwaga:</b> ${esc(problem)} — numer wygląda na niepełny, najlepiej odpisać mailem.</div>` : ''}
        </td>
      </tr>
      <tr><td style="padding:3px 0;color:#b6ad9d">E-mail</td>
          <td style="padding:3px 0"><a href="mailto:${esc(klient.email)}" style="color:#c9a86a;text-decoration:none">${esc(klient.email)}</a></td></tr>
      ${
        etykietaTerminu(klient.terminId)
          ? `<tr><td style="padding:3px 0;color:#b6ad9d">Termin</td>
          <td style="padding:3px 0">${esc(etykietaTerminu(klient.terminId))}</td></tr>`
          : ''
      }
      ${klient.uwagi ? `<tr><td style="padding:3px 0;color:#b6ad9d">Uwagi</td><td style="padding:3px 0">${esc(klient.uwagi)}</td></tr>` : ''}
    </table>
  </div>

  ${
    s
      ? `
  <div style="background:#fff;border:1px solid #e0dbd1;border-radius:6px;padding:18px 20px;margin-top:14px">
    <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8c7040">Wycena</div>
    ${
      s.odbiorWlasny
        ? `<div style="margin:8px 0 4px;padding:9px 12px;background:#fdf0e3;border-left:3px solid #c96a2a;
                     border-radius:4px;font-weight:bold;color:#8a4413">
             ODBIÓR WŁASNY — bez montażu. Brak pomiaru i wyjazdu; blat wg wymiarów klienta.
           </div>`
        : ''
    }
    <div style="font-size:20px;margin:4px 0 2px">${esc(s.firma)}${s.dekor ? ' · ' + esc(s.dekor) : ''}</div>
    <div style="color:#6b6459;font-size:14px">
      ${(s.odcinki || []).map((o) => `${lb(o.gl, 0)}×${lb(o.dl, 0)} cm`).join(' + ')}
      · ${lb(s.mb)} m.b.${s.grubosc ? ' · ' + esc(s.grubosc) + ' mm' : ''}
    </div>
    <div style="margin-top:12px;padding:12px 14px;background:#f7f4ee;border-left:3px solid #c9a86a;border-radius:4px">
      <span style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#8c7040">Razem brutto</span><br>
      <span style="font-size:26px;font-weight:bold">${widelki(s)}</span><br>
      <span style="color:#6b6459;font-size:13px">wyliczenie: ${zl(s.razem)} · widełki ±10%</span>
      ${s.promo ? `<br><span style="color:#1d6b3a;font-size:13px">promocja „${esc(s.promo.nazwa)}" — klient oszczędza ${zl(s.oszczednosc)}</span>` : ''}
    </div>
    ${rozbicieVat(s)}

    ${sekcja('Materiał', material, s.materialBrutto)}
    ${plytaWMagazynie(s)}
    ${sekcja(s.odbiorWlasny ? 'Cięcie i dodatki (bez montażu)' : 'Cięcie, montaż i dodatki', uslugi, s.uslugiBrutto)}

    ${
      uklad.length
        ? `
    <div style="font:bold 11px/1 Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#8c7040;margin:20px 0 6px">
      Rozkrój — ${s.plytyPelne}${s.polowka ? ' i ½' : ''} ${s.polowka ? 'płyty' : mnogaPlyt(s.plytyPelne)} ${lb(s.plyta.w)} × ${lb(s.plyta.h)} cm
    </div>
    ${uklad
      .map(
        (pl) => `
    <div style="border:1px solid #e0dbd1;border-radius:4px;padding:10px 12px;margin-bottom:7px;font-size:13.5px">
      <b>Płyta ${pl.nr}</b> <span style="color:#8c8474">— wykorzystana wysokość ${pl.wysokosc}</span>
      <ul style="margin:6px 0 0 16px;padding:0;color:#3c3a35">
        ${pl.pasy.map((p) => `<li style="margin-bottom:3px">${esc(p)}</li>`).join('')}
      </ul>
    </div>`
      )
      .join('')}
    ${
      wyk
        ? `<div style="font-size:13.5px;color:#3c3a35;margin-top:8px">
             <b>Wykorzystanie płyty:</b> ${wyk.tekst}${wyk.odpad >= 25 ? ' — resztę można wykorzystać np. na parapety, cokoły lub półki' : ''}).
           </div>`
        : ''
    }`
        : ''
    }

    ${
      s.ostrzezenia?.length
        ? `<div style="margin-top:14px;background:#fdf6e3;border:1px solid #e6d9b0;border-radius:4px;padding:10px 12px;font-size:13.5px">
             <b>Do omówienia na pomiarze:</b>
             <ul style="margin:5px 0 0 16px;padding:0">${s.ostrzezenia.map((o) => `<li>${esc(o)}</li>`).join('')}</ul>
           </div>`
        : ''
    }
    ${extra.uwaga ? `<div style="margin-top:10px;font-size:13px;color:#6b6459">${esc(extra.uwaga)}</div>` : ''}
  </div>`
      : `<div style="background:#fff;border:1px solid #e0dbd1;border-radius:6px;padding:18px 20px;margin-top:14px">
           <b>Wycena:</b> ${esc(extra.wycena) || 'zapytanie z rozmowy — do przygotowania'}
         </div>`
  }

  ${
    transkrypcja
      ? `
  <div style="background:#fff;border:1px solid #e0dbd1;border-radius:6px;padding:14px 18px;margin-top:14px">
    <div style="font:bold 11px/1 Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#8c7040;margin-bottom:8px">Rozmowa (skrót)</div>
    <pre style="margin:0;white-space:pre-wrap;word-wrap:break-word;font:13px/1.55 Arial,sans-serif;color:#4a4740">${esc(transkrypcja)}</pre>
  </div>`
      : ''
  }

</div></body></html>`;
}

/** Wersja tekstowa — dla klientów pocztowych bez HTML i dla podglądu. */
function leadTekstem(klient, s, extra) {
  const problem = telefonPodejrzany(klient.telefon);
  const l = [
    `${pilny(klient.terminId) ? '*** PILNE — KLIENT CHCE BLAT DO 2 TYGODNI ***\n' : ''}${klient.imie}, ${klient.miejscowosc}`,
    `Telefon: ${klient.telefon}${problem ? `  <-- UWAGA: ${problem}, numer wygląda na niepełny — najlepiej odpisać mailem` : ''}`,
    `E-mail:  ${klient.email}`,
  ];
  if (etykietaTerminu(klient.terminId)) l.push(`Termin:  ${etykietaTerminu(klient.terminId)}`);
  if (klient.uwagi) l.push(`Uwagi:   ${klient.uwagi}`);

  if (s) {
    l.push('', `WYCENA: ${s.firma}${s.dekor ? ' · ' + s.dekor : ''}`);
    l.push(`${(s.odcinki || []).map((o) => `${lb(o.gl, 0)}×${lb(o.dl, 0)} cm`).join(' + ')} · ${lb(s.mb)} m.b.${s.grubosc ? ` · ${s.grubosc} mm` : ''}`);
    if (s.odbiorWlasny) l.push('*** ODBIÓR WŁASNY — BEZ MONTAŻU (brak pomiaru i wyjazdu) ***');
    l.push(`RAZEM: ${widelki(s)} brutto (wyliczenie ${zl(s.razem)})`);
    {
      const procent = Math.round((s.stawkaVat ?? 0.23) * 100);
      const netto = s.razemNetto ?? Math.round(s.razem / (1 + (s.stawkaVat ?? 0.23)));
      l.push(`  netto ${zl(netto)} + VAT ${procent}% ${zl(s.kwotaVat ?? s.razem - netto)} = ${zl(s.razem)}`);
    }
    l.push('');
    // Świadczenia bez naliczenia pomijamy — w rozbiciu liczą się kwoty.
    for (const p of s.pozycje.filter((x) => !x.wCenie)) {
      const d = p.detalFirmowy || p.detal;
      l.push(`  ${p.nazwa}${d ? ` (${d})` : ''} — ${zl(p.brutto)}`);
    }
    l.push('', `  materiał ${zl(s.materialBrutto)} · usługi ${zl(s.uslugiBrutto)}`);

    const uklad = opisUkladu(s);
    if (uklad.length) {
      l.push('', `ROZKRÓJ — ${s.plytyPelne}${s.polowka ? ' i ½' : ''} ${s.polowka ? 'płyty' : mnogaPlyt(s.plytyPelne)} ${lb(s.plyta.w)}×${lb(s.plyta.h)} cm:`);
      for (const pl of uklad) {
        l.push(`  Płyta ${pl.nr} (wysokość ${pl.wysokosc}):`);
        for (const p of pl.pasy) l.push(`     ${p}`);
      }
    }
    const wyk = wykorzystaniePlyty(s);
    if (wyk) l.push('', `Wykorzystanie płyty: ${wyk.tekst}).`);
    if (s.ostrzezenia?.length) l.push('', 'DO OMÓWIENIA NA POMIARZE:', ...s.ostrzezenia.map((o) => '  - ' + o));
  } else {
    l.push('', 'WYCENA: ' + (extra.wycena || '(brak)'));
  }
  if (extra.uwaga) l.push('', extra.uwaga);

  const t = skrocTranskrypcje(extra.transkrypcja);
  if (t) l.push('', '--- ROZMOWA (skrót) ---', t);
  return l.join('\n');
}

/**
 * Podsumowanie dla KLIENTA — dwie kwoty i lista tego, co w cenie.
 *
 * Świadomie bez stawek jednostkowych: klient ma widzieć „za płyty" i „za
 * produkcję z montażem", a nie cennik obróbek (decyzja Dawida 11.08.2026).
 * Pełne rozbicie ze stawkami idzie osobnym mailem do firmy — patrz mailDoFirmy.
 */
function podsumowanieDlaKlienta(s) {
  if (!s || !Array.isArray(s.pozycje) || !s.pozycje.length) return '';

  const material = s.pozycje.filter((p) => p.grupa === 'materiał');
  const uslugi = s.pozycje.filter((p) => p.grupa === 'usługi');
  const suma = (lista) => lista.reduce((a, p) => a + (Number(p.brutto) || 0), 0);

  const wiersz = (tytul, opis, kwota) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid rgba(201,168,106,.15)">
        <div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:.14em;
                    text-transform:uppercase;color:#c9a86a">${tytul}</div>
        <div style="margin-top:6px;font-size:15px;line-height:1.55;color:#ece6da">${opis}</div>
      </td>
      <td style="padding:12px 0;border-bottom:1px solid rgba(201,168,106,.15);
                 text-align:right;vertical-align:top;white-space:nowrap;
                 font-family:Arial,sans-serif;font-size:19px;font-weight:bold;color:#c9a86a">${kwota}</td>
    </tr>`;

  const opisMaterialu = material
    .map((p) => `${esc(p.nazwa)}${p.detal ? `<br><span style="color:#8c8474;font-size:13px">${esc(p.detal)}</span>` : ''}`)
    .join('<br>');

  /*
   * PRACE KAMIENIARSKIE — jedna kwota, bez wyliczania czynności.
   *
   * Do 21.08.2026 stała tu lista „w tej cenie" z pomiarem Prolinerem,
   * wycięciami i montażem. Klient czytał ją jak menu do skreślania
   * („a bez pomiaru ile?"), dlatego Dawid kazał pokazywać wyłącznie cenę
   * materiału, cenę prac i sumę. Pełne rozbicie ze stawkami zostaje
   * w mailu FIRMOWYM — tam jest potrzebne.
   */
  const opisPrac = s.odbiorWlasny
    ? 'Docięcie, obróbka krawędzi, wycięcia i przygotowanie do odbioru.'
    : 'Docięcie, obróbka krawędzi, wycięcia, transport i montaż u klienta.';

  return `
    <table style="width:100%;border-collapse:collapse;margin:18px 0 0">
      ${material.length ? wiersz('Materiał', opisMaterialu, zl(suma(material))) : ''}
      ${uslugi.length ? wiersz('Prace kamieniarskie', opisPrac, zl(suma(uslugi))) : ''}
    </table>
    ${
      s.odbiorWlasny
        ? `<p style="margin:14px 0 0;padding:12px 15px;background:#241f19;border-left:3px solid #c9a86a;
                     border-radius:4px;color:#d8cfbc;font-size:14px;line-height:1.55">
             <strong style="color:#c9a86a">Odbiór własny — ważne:</strong> blat wykonujemy ŚCIŚLE według
             wymiarów podanych przez Państwa, bez naszego pomiaru i szablonu. Odpowiedzialność
             za poprawność wymiarów i dopasowanie do zabudowy jest po stronie zamawiającego —
             kamienia po docięciu nie da się poprawić.<br>
             Odbiór: Tarnobrzeg, ul. Szpitalna 8, po wcześniejszym ustaleniu terminu.
           </p>`
        : ''
    }`;
}

function mailDoKlienta(imie, wycena, uwaga, linkPlyty, szczegoly) {
  return `<!doctype html>
<html lang="pl"><body style="margin:0;background:#13110f;color:#ece6da;font-family:Georgia,serif">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px">
    <div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:.18em;color:#c9a86a;text-transform:uppercase">
      Kamieniarstwo 24h
    </div>
    <h1 style="font-weight:400;font-size:28px;margin:14px 0 6px">Dziękujemy, ${esc(imie)}.</h1>
    <p style="color:#b6ad9d;font-size:16px;line-height:1.55;margin:0 0 22px">
      Poniżej orientacyjna wycena przygotowana na podstawie podanych wymiarów.
    </p>
    <div style="background:#1b1815;border:1px solid rgba(201,168,106,.25);border-left:3px solid #c9a86a;
                border-radius:4px;padding:18px 20px;font-size:16px;line-height:1.6">
      ${esc(wycena) || 'Wycenę przekażemy telefonicznie.'}
    </div>
    ${podsumowanieDlaKlienta(szczegoly)}
    ${
      uwaga
        ? `<p style="background:#241f19;border-left:3px solid #c9a86a;border-radius:4px;
                     padding:12px 16px;margin:14px 0 0;color:#d8cfbc;font-size:14px;line-height:1.55">
             <strong style="color:#c9a86a">Ważne:</strong> ${esc(uwaga)}
           </p>`
        : ''
    }
    ${
      linkPlyty
        ? `<div style="margin:18px 0 0;padding:16px 18px;background:#1b1815;
                       border:1px solid rgba(201,168,106,.25);border-left:3px solid #c9a86a;border-radius:4px">
             <div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:.14em;
                         text-transform:uppercase;color:#c9a86a;margin-bottom:8px">
               Wybierz swoją płytę
             </div>
             <p style="margin:0 0 12px;color:#ece6da;font-size:15px;line-height:1.55">
               Każda płyta kamienia ma własny rysunek i własną cenę. Pod tym adresem zobaczy
               Pan/Pani zdjęcia dostępnych płyt, ich wymiary i ceny:
             </p>
             <a href="${esc(linkPlyty)}" style="display:inline-block;color:#c9a86a;font-weight:bold;
                text-decoration:none;border:1px solid rgba(201,168,106,.45);border-radius:4px;padding:10px 14px">
               ↗ Zobacz płyty w magazynie
             </a>
             <p style="margin:12px 0 0;color:#8c8474;font-size:13px;line-height:1.6">
               Po wybraniu płyty proszę podać nam jej numer (np. STON000477 - 92326) —
               zarezerwujemy ją i potwierdzimy ostateczną cenę.
             </p>
           </div>`
        : ''
    }
    <p style="color:#8c8474;font-size:13px;line-height:1.6;margin:20px 0">
      Wycena jest orientacyjna i nie stanowi oferty w rozumieniu art. 66 §1 Kodeksu cywilnego.
      ${
        // Przy odbiorze własnym pomiaru NIE robimy — obietnica pomiaru
        // przeczyłaby zastrzeżeniu o wymiarach, które stoi wyżej.
        szczegoly && szczegoly.odbiorWlasny
          ? 'Cenę potwierdzamy po przyjęciu zamówienia.'
          : 'Ostateczną cenę potwierdzamy po bezpłatnym pomiarze.'
      } Podane kwoty są brutto.
      ${
        // Skąd 8%: obniżona stawka dotyczy montażu w lokalach mieszkalnych.
        // Bez tego zdania klient z lokalu użytkowego dostałby kwotę, której
        // nie da się dotrzymać.
        szczegoly && (szczegoly.stawkaVat ?? 0.23) < 0.2
          ? 'Stawka VAT 8% dla montażu w lokalach mieszkalnych (budownictwo objęte ' +
            'społecznym programem mieszkaniowym); dla lokali użytkowych i firm 23%.'
          : 'Stawka VAT 23% — przy odbiorze własnym sprzedajemy sam blat, bez usługi montażu.'
      }
    </p>
    <p style="font-size:16px;line-height:1.6">
      Oddzwonimy w godzinach 8:00–18:00. Można też dzwonić bezpośrednio:
      <a href="tel:+48796991128" style="color:#c9a86a;font-weight:bold">796 991 128</a>.
    </p>
    <hr style="border:none;border-top:1px solid rgba(201,168,106,.2);margin:26px 0">
    <div style="font-family:Arial,sans-serif;font-size:12px;color:#8c8474;line-height:1.8">
      Kamieniarstwo 24h · Aaron sp. z o.o. · ul. Szpitalna 8, 39-400 Tarnobrzeg<br>
      NIP 8672241748 · tel. 796 991 128 ·
      <a href="https://k24h.pl/o-nas/" style="color:#c9a86a">k24h.pl</a>
    </div>
  </div>
</body></html>`;
}

/* ─────────────────────────────────────────────────────────────── pomocnicze */

function naglowkiCors(request, env) {
  const origin = request.headers.get('Origin') || '';
  const dozwolone = String(env.ALLOWED_ORIGIN || '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);

  const pasuje =
    !dozwolone.length ||
    dozwolone.includes(origin.replace(/\/$/, '')) ||
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

  return {
    'Access-Control-Allow-Origin': pasuje ? origin || '*' : dozwolone[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(dane, status, cors) {
  return new Response(JSON.stringify(dane), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...cors },
  });
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

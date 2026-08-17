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
 *    POST /magazyn  — stan magazynowy Interstone (podgląd/diagnostyka; ten sam
 *                     odczyt, z którego korzysta konsultant przez narzędzie)
 *
 *  Sekrety (Cloudflare → Settings → Variables and Secrets):
 *    ANTHROPIC_API_KEY   klucz do Anthropic
 *    RESEND_API_KEY      klucz do Resend
 *    LEAD_EMAIL          kamieniarstwo24h@gmail.com
 *    ALLOWED_ORIGIN      https://kam24h.pl  (można podać kilka po przecinku)
 *    MAIL_FROM           opcjonalnie, domyślnie onboarding@resend.dev
 *
 *  Kluczy NIE MA w tym pliku i nigdy nie może być.
 * ══════════════════════════════════════════════════════════════════════════
 */

import {
  pobierzMagazyn,
  opiszPlyty,
  pogrupuj,
  wygladaJakKod,
  znajdzPoKodzie,
  numerPlytyZKodu,
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
    if (request.method !== 'POST') return json({ error: 'Tylko POST.' }, 405, cors);

    const sciezka = new URL(request.url).pathname.replace(/\/$/, '');

    try {
      if (sciezka === '/chat') return await obsluzChat(request, env, cors, ctx);
      if (sciezka === '/lead') return await obsluzLead(request, env, cors);
      if (sciezka === '/magazyn') return await obsluzMagazyn(request, cors, ctx);
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
    name: 'sprawdz_magazyn',
    description: [
      'Sprawdza AKTUALNY stan magazynowy hurtowni Interstone: jakie płyty są',
      'na składzie, w jakim formacie, grubości i wykończeniu, po ile za m²',
      'oraz ile metrów jest wolnych.',
      '',
      'Używaj, gdy klient pyta o konkretny kamień naturalny, kwarcyt, marmur',
      'lub granit z oferty Interstone — o dostępność, cenę albo wymiar płyty.',
      'Do konglomeratów i spieków z naszego kalkulatora (Technistone, Marazzi,',
      'Atlas Plan, Keralini) NIE używaj — te wycenia kalkulator na stronie.',
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

  // Pętla narzędziowa toczy się w CAŁOŚCI tutaj: front wysyła i dostaje
  // zwykły tekst, więc nie musi wiedzieć nic o blokach tool_use.
  let wynik = null;

  for (let tura = 0; tura <= MAKS_NARZEDZI; tura++) {
    // W ostatniej turze zabieramy narzędzia — model musi wtedy odpowiedzieć
    // słowami, zamiast prosić o kolejne sprawdzenie w nieskończoność.
    const ostatnia = tura === MAKS_NARZEDZI;
    wynik = await anthropic(env, messages, ostatnia ? null : NARZEDZIA);
    if (!wynik) return json({ error: 'Konsultant chwilowo niedostępny.' }, 502, cors);

    const proby = (wynik.content || []).filter((b) => b?.type === 'tool_use');
    if (wynik.stop_reason !== 'tool_use' || !proby.length) break;

    messages.push({ role: 'assistant', content: wynik.content });
    messages.push({
      role: 'user',
      content: await Promise.all(proby.map((b) => wykonajNarzedzie(b, ctx))),
    });
  }

  return json({ content: wynik.content, stop_reason: wynik.stop_reason }, 200, cors);
}

async function wykonajNarzedzie(blok, ctx) {
  let tresc;
  try {
    if (blok.name === 'sprawdz_magazyn') {
      tresc = opiszPlyty(await pobierzMagazyn(blok.input?.fraza, ctx));
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
async function anthropic(env, messages, narzedzia) {
  // Prompt bierzemy ZAWSZE stąd — nawet jeśli front coś przyśle.
  // Dzięki temu wytycznych nie da się podmienić z przeglądarki.
  const cialo = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [{ type: 'text', text: PROMPT, cache_control: { type: 'ephemeral' } }],
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
   * Gdy znamy kod, szukamy SAMYM NUMEREM PŁYTY — magazyn indeksuje matnr
   * i oddaje wtedy dokładnie jedną kartę. Nazwa kamienia nie jest do niczego
   * potrzebna, więc nie musimy o nią prosić klienta.
   */
  const numer = numerPlytyZKodu(dane?.kod);
  const fraza = numer || dane?.fraza || '';
  const wynik = await pobierzMagazyn(fraza, ctx);

  // Kod konkretnej płyty sprawdzamy WŚRÓD pobranych — wyszukiwarka Interstone
  // nie umie znaleźć płyty po kodzie, więc nazwa kamienia jest niezbędna.
  let plyta = null;
  let powodKodu = null;
  if (dane?.kod) {
    if (!wygladaJakKod(dane.kod)) powodKodu = 'zly-format';
    else if (!wynik.ok) powodKodu = 'magazyn-niedostepny';
    else {
      plyta = znajdzPoKodzie(wynik.plyty, dane.kod);
      if (!plyta) powodKodu = 'nie-znaleziono';
      else if (!(plyta.dostepneM2 > 0)) powodKodu = 'brak-dostepnosci';
      else if (!(plyta.cenaBruttoM2 > 0)) powodKodu = 'brak-ceny';
    }
  }

  return json(
    {
      ...wynik,
      warianty: wynik.ok ? pogrupuj(wynik.plyty) : [],
      plyta: powodKodu ? null : plyta,
      powodKodu,
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
  const nadawca = env.MAIL_FROM || 'Kamieniarstwo 24h <onboarding@resend.dev>';
  const doFirmy = env.LEAD_EMAIL || 'kamieniarstwo24h@gmail.com';

  const zalaczniki = [];
  if (d.file && d.filename) {
    zalaczniki.push({ filename: String(d.filename).slice(0, 120), content: String(d.file) });
  }

  const szczegoly = d.szczegoly && typeof d.szczegoly === 'object' ? d.szczegoly : null;
  const klient = { imie, telefon, email, miejscowosc, uwagi: String(d.uwagi || '').trim() };

  // 1. zgłoszenie do firmy — pełne rozbicie, transkrypcja i załącznik
  const doFirmyOdp = await resend(env, {
    from: nadawca,
    to: [doFirmy],
    reply_to: email,
    subject: tematLeada(klient, szczegoly, wycena),
    html: mailDoFirmy(klient, szczegoly, { wycena, uwaga, transkrypcja: d.transcript }),
    text: leadTekstem(klient, szczegoly, { wycena, uwaga, transkrypcja: d.transcript }),
    attachments: zalaczniki.length ? zalaczniki : undefined,
  });

  // 2. wycena do klienta
  const doKlientaOdp = await resend(env, {
    from: nadawca,
    to: [email],
    reply_to: doFirmy,
    subject: 'Pana/Pani wycena blatu — Kamieniarstwo 24h',
    html: mailDoKlienta(imie, wycena, uwaga, linkPlyty, szczegoly),
  });

  return json(
    { ok: true, doFirmy: doFirmyOdp, doKlienta: doKlientaOdp },
    doFirmyOdp ? 200 : 502,
    cors
  );
}

async function resend(env, wiadomosc) {
  try {
    const odp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${env.RESEND_API_KEY}`,
      },
      body: JSON.stringify(wiadomosc),
    });
    if (!odp.ok) {
      console.error('resend', odp.status, await odp.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (e) {
    console.error('resend', e?.message || e);
    return false;
  }
}

/* ──────────────────────────────────── mail leadowy do firmy (dla Dawida) */

const zl = (n) => Math.round(Number(n) || 0).toLocaleString('pl-PL') + ' zł';
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
  const czesci = [`Nowa wycena: ${klient.imie}, ${klient.miejscowosc}`];
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
      <span style="font-size:26px;font-weight:bold">${zl(s.widelki.od)} – ${zl(s.widelki.do)}</span><br>
      <span style="color:#6b6459;font-size:13px">wyliczenie: ${zl(s.razem)} · widełki ±10%</span>
      ${s.promo ? `<br><span style="color:#1d6b3a;font-size:13px">promocja „${esc(s.promo.nazwa)}" — klient oszczędza ${zl(s.oszczednosc)}</span>` : ''}
    </div>
    ${rozbicieVat(s)}

    ${sekcja('Materiał', material, s.materialBrutto)}
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
    `${klient.imie}, ${klient.miejscowosc}`,
    `Telefon: ${klient.telefon}${problem ? `  <-- UWAGA: ${problem}, numer wygląda na niepełny — najlepiej odpisać mailem` : ''}`,
    `E-mail:  ${klient.email}`,
  ];
  if (klient.uwagi) l.push(`Uwagi:   ${klient.uwagi}`);

  if (s) {
    l.push('', `WYCENA: ${s.firma}${s.dekor ? ' · ' + s.dekor : ''}`);
    l.push(`${(s.odcinki || []).map((o) => `${lb(o.gl, 0)}×${lb(o.dl, 0)} cm`).join(' + ')} · ${lb(s.mb)} m.b.${s.grubosc ? ` · ${s.grubosc} mm` : ''}`);
    if (s.odbiorWlasny) l.push('*** ODBIÓR WŁASNY — BEZ MONTAŻU (brak pomiaru i wyjazdu) ***');
    l.push(`RAZEM: ${zl(s.widelki.od)} – ${zl(s.widelki.do)} brutto (wyliczenie ${zl(s.razem)})`);
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

  // „7,8 m.b. × 350 zł" → „7,8 m.b." — ilość zostaje, stawka znika.
  const bezStawki = (p) => {
    if (!p.detal) return esc(p.nazwa);
    const ilosc = p.detal.includes('×') ? p.detal.split('×')[0].trim() : p.detal.trim();
    return ilosc ? `${esc(p.nazwa)} — ${esc(ilosc)}` : esc(p.nazwa);
  };

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

  const listaUslug = uslugi.length
    ? `<div style="color:#8c8474;font-size:13px;margin-bottom:6px">W tej cenie:</div>
       <ul style="margin:0;padding-left:18px">${uslugi.map((p) => `<li style="margin:3px 0">${bezStawki(p)}</li>`).join('')}</ul>`
    : '';

  return `
    <table style="width:100%;border-collapse:collapse;margin:18px 0 0">
      ${material.length ? wiersz('Płyty / materiał', opisMaterialu, zl(suma(material))) : ''}
      ${
        uslugi.length
          ? wiersz(s.odbiorWlasny ? 'Produkcja (odbiór własny)' : 'Produkcja i montaż', listaUslug, zl(suma(uslugi)))
          : ''
      }
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

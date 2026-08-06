/**
 * ══════════════════════════════════════════════════════════════════════════
 *  KAMIENIARSTWO 24H — WORKER (Cloudflare)
 *
 *  ⚠ TEGO PLIKU NIE EDYTUJEMY RĘCZNIE.
 *    Powstaje z worker/worker.template.js przez `npm run worker`
 *    (wstrzykiwana jest aktualna lista dekorów).
 *
 *  Co robi:
 *    POST /chat  — rozmowa z konsultantem (klucz Anthropic zostaje tutaj)
 *    POST /lead  — dwa maile przez Resend: wycena do klienta + zgłoszenie do firmy
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

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 1000;

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
  async fetch(request, env) {
    const cors = naglowkiCors(request, env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ error: 'Tylko POST.' }, 405, cors);

    const sciezka = new URL(request.url).pathname.replace(/\/$/, '');

    try {
      if (sciezka === '/chat') return await obsluzChat(request, env, cors);
      if (sciezka === '/lead') return await obsluzLead(request, env, cors);
      return json({ error: 'Nieznany adres.' }, 404, cors);
    } catch (e) {
      console.error(sciezka, e?.message || e);
      return json({ error: 'Błąd serwera.' }, 500, cors);
    }
  },
};

/* ─────────────────────────────────────────────────────────────────── /chat */

async function obsluzChat(request, env, cors) {
  if (!env.ANTHROPIC_API_KEY) return json({ error: 'Brak konfiguracji.', kod: 'brak-klucza' }, 503, cors);

  const dane = await request.json().catch(() => null);
  const messages = oczyscHistorie(dane?.messages);
  if (!messages.length) return json({ error: 'Pusta rozmowa.' }, 400, cors);

  // Prompt bierzemy ZAWSZE stąd — nawet jeśli front coś przyśle.
  // Dzięki temu wytycznych nie da się podmienić z przeglądarki.
  const odp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [{ type: 'text', text: PROMPT, cache_control: { type: 'ephemeral' } }],
      messages,
    }),
  });

  if (!odp.ok) {
    console.error('anthropic', odp.status, await odp.text().catch(() => ''));
    return json({ error: 'Konsultant chwilowo niedostępny.' }, 502, cors);
  }

  const wynik = await odp.json();
  return json({ content: wynik.content, stop_reason: wynik.stop_reason }, 200, cors);
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
  const nadawca = env.MAIL_FROM || 'Kamieniarstwo 24h <onboarding@resend.dev>';
  const doFirmy = env.LEAD_EMAIL || 'kamieniarstwo24h@gmail.com';

  const zalaczniki = [];
  if (d.file && d.filename) {
    zalaczniki.push({ filename: String(d.filename).slice(0, 120), content: String(d.file) });
  }

  // 1. zgłoszenie do firmy — z transkrypcją i załącznikiem
  const doFirmyOdp = await resend(env, {
    from: nadawca,
    to: [doFirmy],
    reply_to: email,
    subject: `Nowa wycena: ${imie}, ${miejscowosc} — ${telefon}`,
    text: [
      `Imię: ${imie}`,
      `Telefon: ${telefon}`,
      `E-mail: ${email}`,
      `Miejscowość: ${miejscowosc}`,
      '',
      'WYCENA:',
      wycena || '(brak)',
      '',
      'ROZMOWA:',
      String(d.transcript || '(brak transkrypcji)'),
    ].join('\n'),
    attachments: zalaczniki.length ? zalaczniki : undefined,
  });

  // 2. wycena do klienta
  const doKlientaOdp = await resend(env, {
    from: nadawca,
    to: [email],
    reply_to: doFirmy,
    subject: 'Pana/Pani wycena blatu — Kamieniarstwo 24h',
    html: mailDoKlienta(imie, wycena),
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

function mailDoKlienta(imie, wycena) {
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
    <p style="color:#8c8474;font-size:13px;line-height:1.6;margin:20px 0">
      Wycena jest orientacyjna i nie stanowi oferty w rozumieniu art. 66 §1 Kodeksu cywilnego.
      Ostateczną cenę potwierdzamy po bezpłatnym pomiarze. Podane kwoty są brutto.
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

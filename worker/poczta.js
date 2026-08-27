/**
 * WYSYŁKA MAILI (Resend) — jedno miejsce dla całego workera.
 *
 * Wydzielone, bo maile wychodzą teraz z dwóch stron: z endpointów
 * publicznych (wycena, oferta, wiadomość klienta) i z panelu Dawida
 * (odpowiedź w wątku). Dwie kopie tej samej funkcji rozjechałyby się
 * przy pierwszej zmianie nadawcy.
 *
 * Nigdy nie rzuca: mail to dodatek, który nie ma prawa przewrócić
 * zapisu do bazy ani odpowiedzi dla przeglądarki.
 */
export async function resend(env, wiadomosc) {
  if (!env.RESEND_API_KEY) return false;
  try {
    const odp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${env.RESEND_API_KEY}`,
      },
      body: JSON.stringify(zCzesciaTekstowa(wiadomosc)),
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

/**
 * CZĘŚĆ TEKSTOWA MAILA — dokładana automatycznie.
 *
 * Wiadomość wyłącznie w HTML, bez odpowiednika `text/plain`, jest jednym
 * z sygnałów, po których filtry antyspamowe rozpoznają masową wysyłkę:
 * zwykła poczta wychodzi jako multipart z obiema wersjami. Mail leadowy
 * do Dawida miał ją od początku, maile do KLIENTÓW nie miały żadnej.
 *
 * Robimy to tutaj, a nie w każdym szablonie z osobna, żeby nie dało się
 * o tym zapomnieć przy dokładaniu kolejnego maila. Szablon może nadal
 * podać własny `text` — wtedy go nie ruszamy.
 */
function zCzesciaTekstowa(w) {
  if (!w?.html || w.text) return w;
  return { ...w, text: tekstZHtml(w.html) };
}

const ENCJE = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#039;': "'",
  '&apos;': "'",
};

/** Prosty HTML → tekst: bez stylów, skryptów i znaczników. */
export function tekstZHtml(html) {
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    // Adres z linku zostaje w nawiasie — w wersji tekstowej klient
    // inaczej nie miałby jak wejść w ofertę.
    .replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, url, tresc) => {
      const napis = tresc.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      return napis ? `${napis} (${url})` : url;
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h[1-6]|li|table)>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(nbsp|amp|lt|gt|quot|#039|apos);/g, (m) => ENCJE[m] ?? m)
    .replace(/&#(\d+);/g, (_, kod) => String.fromCharCode(Number(kod)))
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Nadawca — jeden dla wszystkich maili wychodzących z workera.
 *
 * ⚠ `onboarding@resend.dev` to WSPÓLNA domena testowa Resend. Wolno z niej
 * wysyłać wyłącznie na własny adres właściciela konta, a poza tym nie ma
 * ona nic wspólnego z kam24h.pl — dla klienta wygląda jak obcy nadawca.
 * To jest awaryjny fallback, a nie ustawienie docelowe: na produkcji MUSI
 * być ustawiony sekret MAIL_FROM z adresem we własnej, zweryfikowanej
 * w Resend domenie (npx wrangler secret put MAIL_FROM).
 */
export const nadawca = (env) => env.MAIL_FROM || 'Kamieniarstwo 24h <onboarding@resend.dev>';

/** Adres Dawida — tam trafiają leady i wiadomości od klientów. */
export const doDawida = (env) => env.LEAD_EMAIL || 'kamieniarstwo24h@gmail.com';

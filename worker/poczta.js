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

/** Nadawca — jeden dla wszystkich maili wychodzących z workera. */
export const nadawca = (env) =>
  env.MAIL_FROM || 'Kamieniarstwo 24h <onboarding@resend.dev>';

/** Adres Dawida — tam trafiają leady i wiadomości od klientów. */
export const doDawida = (env) => env.LEAD_EMAIL || 'kamieniarstwo24h@gmail.com';

/**
 * POŁĄCZENIE Z SERWEREM
 *
 * Cała część, która wymaga kluczy (rozmowa z asystentem, wysyłka maili),
 * działa w Cloudflare Workerze Dawida. Strona nie zna żadnego klucza —
 * wysyła zapytanie do Workera i tyle.
 *
 *   POST {API_BASE}/chat  → odpowiedź asystenta
 *   POST {API_BASE}/lead  → mail z wyceną do klienta + zgłoszenie do firmy
 *
 * Adres Workera można nadpisać przy budowaniu (VITE_API_BASE),
 * np. gdyby powstał osobny worker testowy.
 */
export const API_BASE = (
  import.meta.env?.VITE_API_BASE || 'https://k24h.kamieniarstwo24h.workers.dev'
).replace(/\/$/, '');

/** Rozmowa z konsultantem. Zwraca surowy tekst odpowiedzi. */
export async function zapytajKonsultanta(messages) {
  const odp = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  if (!odp.ok) {
    const blad = new Error('chat ' + odp.status);
    blad.status = odp.status;
    throw blad;
  }
  const dane = await odp.json();
  // Worker zwraca odpowiedź Anthropic — bierzemy bloki tekstowe.
  if (Array.isArray(dane?.content)) {
    return dane.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  }
  return String(dane?.text || dane?.odpowiedz || '').trim();
}

/**
 * Stan magazynowy kamienia naturalnego (Interstone), przez Workera.
 *
 * Cenę i wymiar płyty bierzemy STĄD, a nie z wiadomości konsultanta —
 * model bywa nieprecyzyjny przy przepisywaniu liczb, a z tych liczb
 * wychodzi kwota dla klienta. Konsultant podaje tylko nazwę kamienia.
 *
 * Zwraca `{ ok, warianty: [...] }`. Gdy magazyn nie odpowiada, oddajemy
 * `{ ok: false }` zamiast rzucać — brak danych nie może przerwać rozmowy.
 */
export async function sprawdzMagazyn(fraza, kod) {
  try {
    const odp = await fetch(`${API_BASE}/magazyn`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(kod ? { fraza, kod } : { fraza }),
    });
    const dane = await odp.json().catch(() => null);
    if (!odp.ok || !dane?.ok) return { ok: false, warianty: [], plyty: [] };
    return {
      ok: true,
      warianty: Array.isArray(dane.warianty) ? dane.warianty : [],
      // Pojedyncze płyty z kodami — z nich budujemy listę do wyboru.
      plyty: Array.isArray(dane.plyty) ? dane.plyty : [],
      // Wypełnione tylko wtedy, gdy pytaliśmy o konkretny kod.
      plyta: dane.plyta || null,
      powodKodu: dane.powodKodu || null,
    };
  } catch {
    return { ok: false, warianty: [], plyty: [] };
  }
}

/** Zgłoszenie: wycena mailem do klienta + lead do firmy. */
export async function wyslijLead(dane) {
  const odp = await fetch(`${API_BASE}/lead`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(dane),
  });
  if (!odp.ok) {
    const blad = new Error('lead ' + odp.status);
    blad.status = odp.status;
    throw blad;
  }
  return odp.json().catch(() => ({}));
}

/**
 * Zapas: jeśli Worker nie odpowiada, zgłoszenie idzie przez formularz Netlify.
 * Lepiej stracić ładny mail do klienta niż cały kontakt.
 */
export async function wyslijLeadZapasowo(dane) {
  const body = new URLSearchParams({
    'form-name': 'pomiar',
    imie: dane.name || '',
    telefon: dane.phone || '',
    email: dane.email || '',
    miejscowosc: dane.city || '',
    uwagi: dane.uwagi || '',
    wycena: dane.quote || '',
    kwota: String(dane.kwota || ''),
    zgoda: 'tak',
  });
  const odp = await fetch('/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!odp.ok) throw new Error('netlify-forms ' + odp.status);
  return { zapasowo: true };
}

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
    // Przy szukaniu po KODZIE `ok:false` niesie treść: powód odmowy i często
    // samą płytę (np. zarezerwowaną). Odsyłamy to dalej, zamiast gubić.
    if (kod && dane) {
      return {
        ok: !!dane.ok,
        plyta: dane.plyta || null,
        kod: dane.kod || null,
        powodKodu: dane.powodKodu || null,
        kody: dane.kody || null,
        link: dane.link || null,
        warianty: [],
        plyty: [],
      };
    }
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

/**
 * Stawki zakładu ustawione przez Dawida w panelu. Gdy worker nie odpowie,
 * kalkulator liczy wartościami domyślnymi — patrz app/ustawienia.js.
 */
export async function pobierzUstawienia() {
  try {
    const odp = await fetch(`${API_BASE}/ustawienia`, { method: 'POST' });
    const dane = await odp.json().catch(() => null);
    return dane?.ok ? dane.ustawienia || {} : {};
  } catch {
    return {};
  }
}

/**
 * Promocje „ostatnie płyty" (zlecenie Dawida, 27.08.2026).
 *
 * Bez argumentów — publiczny widok: tylko to, co Dawid opublikował.
 * Z `{ podgladId, exp, podpis }` z linku podglądu — dokłada JEDEN wskazany
 * szkic, z podpisem właściciela. Worker sam sprawdza podpis; zły albo
 * przeterminowany po prostu wraca do publicznego widoku, bez błędu.
 */
export async function pobierzPromocje(podglad) {
  try {
    const odp = await fetch(`${API_BASE}/promocje`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(podglad || {}),
    });
    const dane = await odp.json().catch(() => null);
    return dane?.ok ? dane.promocje || [] : [];
  } catch {
    return [];
  }
}

/**
 * Odpowiedź klienta na pokazaną wycenę (pasuje / za drogo / zastanowi się).
 * Zawsze w tle: feedback to bonus, więc błąd sieci ma zniknąć bez śladu,
 * zamiast pokazywać klientowi cokolwiek.
 */
export function wyslijFeedback(dane) {
  return fetch(`${API_BASE}/feedback`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(dane),
    keepalive: true,
  }).catch(() => null);
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
    // Planowany termin realizacji — ścieżka awaryjna też musi go nieść,
    // inaczej lead, który poszedł formularzem Netlify (bo worker milczał),
    // trafiałby do Dawida bez informacji, czy klient się śpieszy.
    termin: dane.termin || '',
    /*
     * Zgoda na telefon — ścieżka awaryjna też musi ją nieść. Lead, który
     * poszedł formularzem Netlify (bo worker milczał), trafiałby do Dawida
     * bez informacji, czy wolno zadzwonić — czyli dokładnie w stan sprzed
     * tej zmiany. Puste znaczy „nie pytaliśmy", nie „można dzwonić".
     */
    telefonZgoda: dane.telefonZgoda || '',
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

/**
 * SMS DO KLIENTA PO WYSŁANIU WYCENY (zlecenie Dawida, 2.11.2026).
 *
 * Idzie AUTOMATYCZNIE po mailu z ofertą — zero klikania (korekta Dawida:
 * żadnego checkboxa przy wysyłce). Klucze Zadarmy mieszkają WYŁĄCZNIE
 * w workerze bartek-sms; my znamy tylko wspólny sekret mostu (MOST_SEKRET)
 * i wołamy jego trasę POST /wyslij. Globalny wyłącznik: klucz ustawień
 * `smsPoOfercie` (brak wpisu = włączone) — furtka w panelu.
 *
 * Treść: GSM-7 bez polskich ogonków, jeden segment (≤160 znaków) —
 * ogonki przełączyłyby kodowanie na UCS-2 i pocięły wiadomość.
 * Koszt ~0,13 zł/SMS.
 */

export const MOST_URL = 'https://bartek-sms.kamieniarstwo24h.workers.dev/wyslij';

export const TRESC_SMS_OFERTA =
  'Kamieniarstwo 24h: wycena blatu zostala wyslana na Pana/Pani e-mail. ' +
  'Zapraszamy do kontaktu: 796 991 128';

/** 9 cyfr polskiego numeru albo null — ta sama reguła co walidacja kart. */
export function numerDoSms(telefon) {
  let c = String(telefon || '').replace(/\D/g, '');
  if (c.startsWith('0048')) c = c.slice(4);
  else if (c.startsWith('48') && c.length > 9) c = c.slice(2);
  return c.length === 9 ? c : null;
}

/**
 * Transport przez most do bartek-sms (service binding, fallback fetch).
 * Zwraca { wyslany, powod? } — NIGDY nie rzuca: SMS jest dodatkiem.
 */
async function przezMost(env, cyfry, tresc) {
  if (!env.MOST_SEKRET) return { wyslany: false, powod: 'wylaczony' };
  try {
    /*
     * SERVICE BINDING zamiast gołego fetch (naprawa 2.11.2026): wywołanie
     * własnej domeny *.workers.dev z innego workera tego samego konta
     * Cloudflare odbija 404 — binding (env.SMS_MOST_WORKER) idzie wprost
     * do workera bartek-sms. Fallback na fetch: testy i środowiska bez bindingu.
     */
    const init = {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${env.MOST_SEKRET}` },
      body: JSON.stringify({ do: cyfry, tresc }),
    };
    const r = env.SMS_MOST_WORKER
      ? await env.SMS_MOST_WORKER.fetch(new Request(MOST_URL, init))
      : await fetch(MOST_URL, init);
    if (!r.ok) {
      console.error('sms most', r.status, await r.text().catch(() => ''));
      return { wyslany: false, powod: `most-${r.status}` };
    }
    return { wyslany: true };
  } catch (e) {
    console.error('sms most', e?.message || e);
    return { wyslany: false, powod: 'blad-polaczenia' };
  }
}

/** SMS do KLIENTA po wysłaniu oferty (2.11.2026). */
export async function wyslijSmsOferta(env, telefon) {
  if (!env.MOST_SEKRET) return { wyslany: false, powod: 'wylaczony' };
  const cyfry = numerDoSms(telefon);
  if (!cyfry) return { wyslany: false, powod: 'brak-telefonu' };
  return przezMost(env, cyfry, TRESC_SMS_OFERTA);
}

/* ═══════════ SMS DO DAWIDA (zlecenie Dawida, 13.11.2026) ═══════════════
 *
 * „Jak przychodzi mi wiadomość od klienta z kalkulatora, żeby też
 * przychodziła do mnie SMS-em i informowała, o co klient zapytał. Tak
 * samo, jak przyjdzie nowa wycena." Mail zostaje źródłem pełnej treści;
 * SMS to szybki sygnał w telefonie — jeden segment (160 znaków GSM-7),
 * telefon klienta ZAWSZE przed treścią, żeby ucięcie go nie zjadło.
 * Wyłącznik w panelu: klucz ustawień `smsDoDawida` (brak = włączone).
 */
export const NUMER_DAWIDA = '796991128';
const MAKS_SMS = 160;

const POLSKIE = {
  ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z',
  Ą: 'A', Ć: 'C', Ę: 'E', Ł: 'L', Ń: 'N', Ó: 'O', Ś: 'S', Ź: 'Z', Ż: 'Z',
  '„': '"', '”': '"', '“': '"', '‘': "'", '’': "'", '–': '-', '—': '-', '…': '...',
};

/** Tekst do bezpiecznego GSM-7: ogonki → ASCII, emoji i reszta egzotyki precz. */
export function doGsm(tekst) {
  return String(tekst || '')
    .replace(/[\s\S]/g, (z) => POLSKIE[z] ?? z)
    .replace(/\s+/g, ' ')
    .replace(/[^A-Za-z0-9 .,:;!?'"()\-+\/@&%=*#<>_]/g, '')
    .replace(/ {2,}/g, ' ')
    .trim();
}

/** Przycina do 160 znaków z „..." na końcu, gdy trzeba. */
function jedenSegment(tekst) {
  return tekst.length <= MAKS_SMS ? tekst : tekst.slice(0, MAKS_SMS - 3).trimEnd() + '...';
}

/** „PILNE Nowa wycena: Anna, Tarnobrzeg, 9 000 zl, Technistone Crystal. Tel 600100200" */
export function trescSmsLead({ imie, miejscowosc, telefon, kwota, material, pilne, nieDzwonic }) {
  const flagi = [nieDzwonic ? 'NIE DZWONIC (woli mail)' : '', pilne ? 'PILNE' : ''].filter(Boolean).join(' ');
  const tel = numerDoSms(telefon) || doGsm(telefon);
  const kwotaTxt = Number(kwota) > 0 ? `${Math.round(Number(kwota)).toLocaleString('pl-PL').replace(/\s/g, ' ')} zl` : '';
  const glowa = `${flagi ? flagi + ' ' : ''}Nowa wycena: ${doGsm(imie) || 'Klient'}${tel ? ` tel ${tel}` : ''}`;
  const reszta = [doGsm(miejscowosc), kwotaTxt, doGsm(material)].filter(Boolean).join(', ');
  return jedenSegment(doGsm(`${glowa}${reszta ? '. ' + reszta : ''}`));
}

/** „Anna (tel 600100200) pyta pod wycena: czy montaz jest w cenie?..." */
export function trescSmsWiadomosc({ imie, telefon, tresc }) {
  const tel = numerDoSms(telefon);
  const glowa = `${doGsm(imie) || 'Klient'}${tel ? ` (tel ${tel})` : ''} pyta pod wycena: `;
  return jedenSegment(glowa + doGsm(tresc));
}

/** Wysyłka do Dawida z poszanowaniem wyłącznika w panelu. Nigdy nie rzuca. */
export async function wyslijSmsDoDawida(env, tresc) {
  try {
    const w = await env.BAZA?.prepare(`SELECT wartosc FROM ustawienia WHERE klucz = 'smsDoDawida'`).first();
    if (w && Number(w.wartosc) === 0) return { wyslany: false, powod: 'wylaczony-w-panelu' };
  } catch {
    /* bez bazy — lecimy dalej, sygnał jest ważniejszy */
  }
  return przezMost(env, NUMER_DAWIDA, tresc);
}

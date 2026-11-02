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
 * Wysyłka przez most. Zwraca { wyslany, powod? } — nigdy nie rzuca:
 * SMS jest dodatkiem do maila i nie ma prawa zepsuć wysyłki oferty.
 */
export async function wyslijSmsOferta(env, telefon) {
  if (!env.MOST_SEKRET) return { wyslany: false, powod: 'wylaczony' };
  const cyfry = numerDoSms(telefon);
  if (!cyfry) return { wyslany: false, powod: 'brak-telefonu' };
  try {
    /*
     * SERVICE BINDING zamiast gołego fetch (naprawa 2.11.2026): wywołanie
     * własnej domeny *.workers.dev z innego workera tego samego konta
     * Cloudflare odbija 404 — binding (env.SMS_MOST_WORKER) idzie wprost
     * do workera bartek-sms, z pominięciem publicznej sieci. Fallback na
     * fetch zostaje dla testów (atrapa przechwytuje adres) i na wypadek
     * braku bindingu w środowisku.
     */
    const init = {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${env.MOST_SEKRET}`,
      },
      body: JSON.stringify({ do: cyfry, tresc: TRESC_SMS_OFERTA }),
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

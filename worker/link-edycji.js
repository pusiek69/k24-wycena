/**
 * LINK „✏️ EDYTUJ TĘ WYCENĘ" DO MAILI WŁAŚCICIELA.
 *
 * Powstał przy mailu leadowym (22.10.2026); 26.10 Dawid rozszerzył go na
 * WSZYSTKIE maile ownerowe związane z klientem (wiadomość spod oferty,
 * feedback po wycenie). Jeden moduł = jeden format linku wszędzie:
 * HMAC `oferta|leadId|exp` z hasła panelu (ta sama formuła co ciasteczko
 * „Powtórz wycenę" w panelu), 7 dni ważności, całość we FRAGMENCIE adresu
 * (#…) — fragment nie wychodzi w referrerze ani do statystyk. W linku nie
 * ma żadnego hasła, sam podpis; zmiana hasła panelu unieważnia stare linki.
 *
 * Link trafia WYŁĄCZNIE do maili Dawida — test smoke pilnuje, żeby żaden
 * mail do klienta go nie niósł.
 */
import { podpisz } from './panel.js';

const b64url = (obj) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(obj))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

/**
 * Buduje podpisany link do edytora właściciela albo '' (brak karty, brak
 * hasła panelu, awaria krypto) — mail bez przycisku jest lepszy niż brak
 * maila, więc nic stąd nie ma prawa rzucić wyżej.
 *
 * `parametry` — konfiguracja wyceny, z którą edytor ma wstać (bez nich
 * wstaje pusty, podpisany na tę kartę — jak „Zrób wycenę" w panelu).
 * `watek` — token wątku oferty: kolejna wersja pójdzie pod tym samym
 * linkiem, który klient już ma (jak „Aktualizuj ofertę" w panelu).
 */
export async function linkEdycji(env, { leadId, imie = '', parametry = null, watek = '' }) {
  if (!(Number(leadId) > 0) || !env?.PANEL_HASLO) return '';
  try {
    const exp = Date.now() + 7 * 86400000;
    const podpis = await podpisz(env.PANEL_HASLO, `oferta|${leadId}|${exp}`);
    const paczka = { leadId, exp, podpis };
    if (imie) paczka.imie = imie;
    if (parametry && typeof parametry === 'object') paczka.parametry = parametry;
    if (watek) paczka.watek = watek;
    return 'https://kam24h.pl/#powtorz=' + b64url(paczka);
  } catch (e) {
    console.error('link edycji', e?.message || e);
    return '';
  }
}

/**
 * Parametry edytora z wyniku `ofertaPoTokenie` — te same reguły co linki
 * w panelu: oferta Dawida niesie `parametry` + token wątku (edycja = nowa
 * wersja pod linkiem klienta); wycena z kalkulatora jest parametrami sama
 * w sobie; karta bez rozpoznawalnych danych → edytor pusty.
 */
export function paczkaZOferty(w) {
  const o = w?.oferta;
  if (o?.parametry && typeof o.parametry === 'object') {
    return { parametry: o.parametry, watek: w.watek || '' };
  }
  if (o && typeof o === 'object' && o.firma) return { parametry: o };
  return {};
}

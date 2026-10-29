/**
 * ══════════════════════════════════════════════════════════════════════════
 *  PROGRAM PARTNERSKI — REGUŁY (zlecenie Dawida, 26.10.2026)
 *
 *  Czyste funkcje, zero SQL i zero fetch — żeby naliczanie prowizji dało się
 *  policzyć w gołym node i w teście co do złotówki. SQL mieszka w
 *  worker/partnerzy-baza.js, trasy w worker.template.js i panel.js.
 *
 *  Decyzje wiążące Dawida:
 *   • prowizja od CAŁOŚCI netto zlecenia, PO rabacie (kwota, którą klient
 *     realnie płaci),
 *   • 15% pierwsze wygrane zlecenie partnera → 10% kolejne → 15% Premium
 *     (status nadawany ręcznie w panelu),
 *   • stawki NIEJAWNE publicznie — klucze konfiguracji mają prefiks
 *     `partner`, po którym publiczny /ustawienia je ODFILTROWUJE,
 *   • wszystko konfigurowalne w panelu (furtka na później),
 *   • przypisanie klienta do partnera: domyślnie 365 dni (konfigurowalne),
 *     o ważności decyduje SERWER przy leadzie — zmiana konfiguracji działa
 *     od ręki, także dla kodów zapisanych wcześniej.
 * ══════════════════════════════════════════════════════════════════════════
 */

/** Domyślna konfiguracja — dokładnie decyzje z 26.10.2026. */
export const KONFIG_DOMYSLNA = {
  procPierwsze: 15,
  procKolejne: 10,
  procPremium: 15,
  // 0 = całość netto; 1 = materiał+prace (furtka — MVP liczy wyłącznie 0,
  // panel pokazuje wariant 1 jako „wkrótce", żeby klucz już istniał).
  podstawa: 0,
  dni: 365,
};

/** Pole konfiguracji → klucz w tabeli `ustawienia` (prefiks obowiązkowy!). */
export const KLUCZE_KONFIGU = {
  procPierwsze: 'partnerProcPierwsze',
  procKolejne: 'partnerProcKolejne',
  procPremium: 'partnerProcPremium',
  podstawa: 'partnerPodstawa',
  dni: 'partnerDniPrzypisania',
};

/**
 * Procent dla zlecenia: Premium bije wszystko, potem pierwsze/kolejne.
 *
 * INDYWIDUALNE STAWKI (zlecenie Dawida, 29.10.2026): partner może mieć
 * własne pola procPierwsze/procKolejne/procPremium — liczba (także 0!)
 * nadpisuje globalną konfigurację, `null`/brak pola dziedziczy z niej.
 * Dokładnie jak edytowalne ceny pozycji: puste pole = wartość z cennika.
 */
export function stawkaProwizji({ premium, pierwsze, konfig, partner = null }) {
  const k = konfig || KONFIG_DOMYSLNA;
  const wlasna = (pole) => {
    const w = Number(partner?.[pole]);
    return partner?.[pole] != null && Number.isFinite(w) ? w : null;
  };
  if (premium) return wlasna('procPremium') ?? k.procPremium;
  if (pierwsze) return wlasna('procPierwsze') ?? k.procPierwsze;
  return wlasna('procKolejne') ?? k.procKolejne;
}

/** Prowizja w całych złotych — pół złotego w górę, jak w rachunkach. */
export function prowizja(nettoZl, procent) {
  return Math.round(((Number(nettoZl) || 0) * (Number(procent) || 0)) / 100);
}

/**
 * Podstawa netto zlecenia.
 *
 * Źródłem jest OSTATNIA wycena karty: `razem` (brutto PO rabacie — decyzja
 * Dawida: prowizja od tego, co klient realnie płaci, więc `razemPrzed`
 * celowo ignorujemy) i `stawkaVat` z tej samej oferty (0.08 albo 0.23).
 * Karta bez wyceny z kwotą dostaje przybliżenie `kwota_ostatnia / 1,08`
 * i flagę `zPodgladu` — zestawienie w panelu mówi wtedy „sprawdź podstawę",
 * zamiast udawać pewność.
 */
export function nettoZlecenia(daneWyceny, kwotaFallback) {
  const brutto = Number(daneWyceny?.razem);
  const vat = Number(daneWyceny?.stawkaVat);
  if (brutto > 0 && Number.isFinite(vat) && vat >= 0 && vat < 1)
    return { netto: Math.round(brutto / (1 + vat)), zPodgladu: false };
  const zapas = Number(kwotaFallback);
  if (zapas > 0) return { netto: Math.round(zapas / 1.08), zPodgladu: true };
  return { netto: 0, zPodgladu: true };
}

/**
 * Czy kod zapisany w przeglądarce klienta jeszcze przypisuje.
 * `od` to moment wejścia z linku partnerskiego (ms); granica włącznie —
 * „365 dni" ma znaczyć, że w 365. dniu klient wciąż jest partnera.
 */
export function kodWazny({ od, teraz, dni }) {
  const start = Number(od);
  if (!Number.isFinite(start) || start <= 0) return false;
  return Number(teraz) - start <= (Number(dni) || 0) * 86400000;
}

/** Kod partnerski do linku: małe litery/cyfry/myślnik, 3–24 znaki. */
export function poprawnyKod(kod) {
  return typeof kod === 'string' && /^[a-z0-9-]{3,24}$/.test(kod);
}

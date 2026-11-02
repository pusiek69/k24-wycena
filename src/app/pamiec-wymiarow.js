/**
 * PAMIĘĆ WYMIARÓW KLIENTA (zlecenie Dawida, 2.11.2026).
 *
 * Klient, który raz policzył blat i wraca do kalkulatora (np. sprawdzić
 * inny materiał), nie ma wpisywać wymiarów od nowa. Ostatnie odcinki
 * (z etykietami) leżą w localStorage JEGO przeglądarki:
 *  • zapis dopiero przy wysłaniu zgłoszenia (bramka) — nic nie wychodzi
 *    na serwer poza normalnym leadem, prywatność bez zmian,
 *  • wygasają po 90 dniach, „Zacznij od nowa" czyści od ręki,
 *  • rozmowa i kreator awaryjny tylko PROPONUJĄ — jedno jasne pytanie,
 *    trzy duże przyciski; decyzja zawsze należy do klienta.
 *
 * Argumenty wstrzykiwane (storage/teraz) — testy w gołym node,
 * wzorzec jak src/app/partner.js.
 */

const KLUCZ = 'k24h-wymiary';
export const WAZNOSC_WYMIAROW_DNI = 90;

const czysteOdcinki = (odcinki) =>
  (Array.isArray(odcinki) ? odcinki : [])
    .map((o) => ({
      gl: Number(o?.gl) || 0,
      dl: Number(o?.dl) || 0,
      ...(o?.etykieta ? { etykieta: String(o.etykieta).slice(0, 40) } : {}),
    }))
    .filter((o) => o.gl > 0 && o.dl > 0)
    .slice(0, 12);

/** Wołane przy wysłaniu zgłoszenia — zapamiętuje to, co klient policzył. */
export function zapamietajWymiary(odcinki, {
  storage = typeof localStorage !== 'undefined' ? localStorage : null,
  teraz = Date.now(),
} = {}) {
  if (!storage) return;
  const czyste = czysteOdcinki(odcinki);
  if (!czyste.length) return;
  try {
    storage.setItem(KLUCZ, JSON.stringify({ odcinki: czyste, od: teraz }));
  } catch {
    /* prywatne okno bez storage — po prostu nie zapamiętamy */
  }
}

/** Ostatnie wymiary albo null; przeterminowany wpis sprząta po sobie. */
export function poprzednieWymiary({
  storage = typeof localStorage !== 'undefined' ? localStorage : null,
  teraz = Date.now(),
} = {}) {
  if (!storage) return null;
  try {
    const wpis = JSON.parse(storage.getItem(KLUCZ) || 'null');
    const odcinki = czysteOdcinki(wpis?.odcinki);
    const od = Number(wpis?.od);
    if (!odcinki.length || !Number.isFinite(od) || od < 0) return null;
    if (teraz - od > WAZNOSC_WYMIAROW_DNI * 86400000) {
      storage.removeItem(KLUCZ);
      return null;
    }
    return { odcinki, od };
  } catch {
    return null;
  }
}

/** „Zacznij od nowa" — klient decyduje, my czyścimy. */
export function zapomnijWymiary({
  storage = typeof localStorage !== 'undefined' ? localStorage : null,
} = {}) {
  try {
    storage?.removeItem(KLUCZ);
  } catch {
    /* trudno */
  }
}

/** „Blat 60×300 cm + Wyspa 100×220 cm" — treść jednego jasnego pytania. */
export function opisWymiarow(odcinki) {
  return czysteOdcinki(odcinki)
    .map((o) => `${o.etykieta ? `${o.etykieta} ` : ''}${o.gl}×${o.dl} cm`)
    .join(' + ');
}

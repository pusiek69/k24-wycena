/**
 * ROZMOWA POD OFERTĄ — reguły, bez bazy i bez sieci.
 *
 * Wydzielone, żeby dało się to przetestować w gołym node: co wolno
 * wysłać, co jest spamem i jak często można pisać. Sam zapis siedzi
 * w worker/baza.js, wysyłka maili w worker/mail-rozmowa.js.
 *
 * Klient pisze BEZ LOGOWANIA — autoryzuje go token z linku do oferty.
 * To świadoma decyzja (Dawid: „bez logowania klienta"), więc obrona
 * musi stać na treści i tempie, a nie na tożsamości.
 */

/** Dłuższa wiadomość to zwykle wklejony spam, nie pytanie o blat. */
export const MAKS_ZNAKOW = 2000;
export const MIN_ZNAKOW = 2;

/** Ile wiadomości klient może wysłać pod jedną ofertą. */
export const MAKS_OD_KLIENTA = 30;

/** Odstęp między wiadomościami klienta (sekundy). */
export const ODSTEP_S = 15;

export const AUTORZY = ['klient', 'dawid'];

/**
 * Czyści treść wiadomości.
 *
 * Nie wycinamy znaków — treść i tak wychodzi na stronę i do maila przez
 * eskejpowanie. Normalizujemy tylko białe znaki i puste linie, żeby
 * dymek nie rozjechał się na pół ekranu przez wklejone entery.
 */
export function oczysc(tresc) {
  return String(tresc ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Czy tę wiadomość wolno przyjąć.
 *
 * Zwraca `{ ok, tresc, powod }`. `powod` jest po polsku, bo trafia
 * wprost pod okienko klienta — nikt nie lubi „ERR_VALIDATION".
 *
 * @param {object} kontekst
 * @param {string} kontekst.pulapka  ukryte pole formularza (bot je wypełni)
 * @param {number} kontekst.odKlienta ile wiadomości klient już wysłał
 * @param {string} kontekst.ostatnia  ISO ostatniej wiadomości klienta
 * @param {number} kontekst.teraz     znacznik czasu (ms) — wstrzykiwany dla testów
 */
export function sprawdzWiadomosc(surowa, kontekst = {}) {
  const { pulapka = '', odKlienta = 0, ostatnia = null, teraz = Date.now() } = kontekst;

  // Pole-pułapka jest w formularzu ukryte przez CSS. Człowiek go nie widzi,
  // automat wypełnia wszystko jak leci — i tym się zdradza.
  if (String(pulapka || '').trim() !== '') {
    return { ok: false, powod: 'Nie udało się wysłać wiadomości.', spam: true };
  }

  const tresc = oczysc(surowa);
  if (tresc.length < MIN_ZNAKOW) {
    return { ok: false, powod: 'Proszę wpisać treść wiadomości.' };
  }
  if (tresc.length > MAKS_ZNAKOW) {
    return {
      ok: false,
      powod: `Wiadomość jest za długa (limit ${MAKS_ZNAKOW} znaków). Najszybciej pomożemy telefonicznie: 796 991 128.`,
    };
  }
  if (odKlienta >= MAKS_OD_KLIENTA) {
    return {
      ok: false,
      powod: 'W tym wątku jest już bardzo dużo wiadomości. Proszę zadzwonić: 796 991 128.',
    };
  }

  const odstep = odstepSekund(ostatnia, teraz);
  if (odstep !== null && odstep < ODSTEP_S) {
    return {
      ok: false,
      powod: `Chwileczkę — proszę odczekać ${Math.ceil(ODSTEP_S - odstep)} s przed kolejną wiadomością.`,
    };
  }

  return { ok: true, tresc };
}

/** Ile sekund minęło od ostatniej wiadomości; `null`, gdy jej nie było. */
export function odstepSekund(ostatniaIso, teraz = Date.now()) {
  if (!ostatniaIso) return null;
  const t = Date.parse(ostatniaIso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, (teraz - t) / 1000);
}

/**
 * Skrót wiadomości do tematu maila i do listy w panelu.
 * Bez łamania w połowie słowa — to widzi człowiek, nie parser.
 */
export function skrot(tresc, maks = 80) {
  const t = oczysc(tresc).replace(/\s+/g, ' ');
  if (t.length <= maks) return t;
  const uciety = t.slice(0, maks);
  const spacja = uciety.lastIndexOf(' ');
  return (spacja > maks * 0.6 ? uciety.slice(0, spacja) : uciety) + '…';
}

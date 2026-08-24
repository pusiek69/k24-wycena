/**
 * STAWKI ZAKŁADU EDYTOWALNE Z PANELU
 *
 * Do 21.08.2026 wszystkie stawki naszej pracy (montaż, pomiar, wycięcia,
 * otwory) siedziały na sztywno w firms/_domyslne.js — każda zmiana ceny
 * wymagała wdrożenia. Teraz Dawid ustawia je sam w panelu, a wartości leżą
 * w bazie i wchodzą do kalkulatora przy starcie strony.
 *
 * ZASADY:
 *   • DOMYSLNE to dokładnie to, co było zaszyte w kodzie — bez ustawień
 *     w bazie kalkulator liczy jak dotąd i nic się nie psuje,
 *   • kwoty są BRUTTO przy 23% (tak jak reszta stawek w cennikach) —
 *     silnik sam schodzi do stawki wariantu,
 *   • to są NASZE ceny sprzedaży, nie ceny zakupu materiału. Cen zakupowych
 *     ani przeliczników dostawców tu nie ma i być nie może — te zostają
 *     w pricing/zrodla, poza repozytorium.
 */

/** Parametry, które Dawid widzi w panelu. Kolejność = kolejność w formularzu. */
export const PARAMETRY = [
  {
    klucz: 'obrobkaZaM2',
    label: 'Obróbka blatu (docięcie, polerowanie, klejenie)',
    jednostka: 'zł/m² blatu',
    domyslnie: 200,
    opis: 'Naliczana przy każdym blacie od powierzchni elementów. 0 = w cenie, bez naliczenia.',
  },
  {
    klucz: 'obrobkaNaturalnaZaM2',
    label: 'Dodatek za obróbkę kamienia naturalnego',
    jednostka: 'zł/m² blatu',
    domyslnie: 0,
    opis:
      'Doliczany PONAD stawkę obróbki, tylko przy kamieniu naturalnym. ' +
      'Do 21.08.2026 było to 300 zł/m²; teraz naturalny płaci wspólną stawkę obróbki.',
  },
  {
    klucz: 'montazBaza',
    label: 'Montaż — baza (dojazd, wniesienie)',
    jednostka: 'zł raz na zlecenie',
    domyslnie: 1500,
  },
  {
    klucz: 'montazZaM2',
    label: 'Montaż — stawka od powierzchni',
    jednostka: 'zł/m² blatu',
    domyslnie: 200,
  },
  {
    klucz: 'pomiar',
    label: 'Pomiar cyfrowy Proliner (tylko kuchnia)',
    jednostka: 'zł raz na zlecenie',
    domyslnie: 1000,
  },
  {
    klucz: 'zlewPodblatowy',
    label: 'Wycięcie + montaż zlewu podblatowego',
    jednostka: 'zł/szt.',
    domyslnie: 650,
  },
  {
    klucz: 'udzialNablatowego',
    label: 'Zlew nablatowy — część ceny podblatowego',
    jednostka: '× (0,5 = połowa)',
    domyslnie: 0.5,
    krok: 0.05,
    max: 1,
  },
  {
    klucz: 'plytaNakladana',
    label: 'Wycięcie pod płytę nakładaną',
    jednostka: 'zł',
    domyslnie: 250,
  },
  {
    klucz: 'plytaLicowana',
    label: 'Wycięcie pod płytę licowaną z blatem',
    jednostka: 'zł',
    domyslnie: 650,
  },
  { klucz: 'otwor', label: 'Otwór w blacie (bateria, dozownik…)', jednostka: 'zł/szt.', domyslnie: 150 },
  { klucz: 'mat', label: 'Dopłata za powierzchnię matową / strukturalną', jednostka: 'zł/m²', domyslnie: 60 },
  { klucz: 'listwa', label: 'Listwa przyścienna', jednostka: 'zł/m.b.', domyslnie: 180 },
  { klucz: 'krawedz', label: 'Wykończenie krawędzi', jednostka: 'zł/m.b.', domyslnie: 90 },
];

export const DOMYSLNE = Object.fromEntries(PARAMETRY.map((p) => [p.klucz, p.domyslnie]));

/** Wartości z bazy + uzupełnienie domyślnymi. Odrzuca śmieci i liczby ujemne. */
export function scalUstawienia(zBazy) {
  const wynik = { ...DOMYSLNE };
  for (const [klucz, wartosc] of Object.entries(zBazy || {})) {
    if (!(klucz in DOMYSLNE)) continue;
    const liczba = Number(wartosc);
    if (Number.isFinite(liczba) && liczba >= 0) wynik[klucz] = liczba;
  }
  return wynik;
}

/**
 * Nakłada stawki na konfiguracje firm. Wołane RAZ, przy starcie strony,
 * zanim ktokolwiek policzy wycenę.
 *
 * Firmy współdzielą tablice ROBOCIZNA i OPCJE (ten sam obiekt w pamięci),
 * więc każdej podmieniamy własną kopię — inaczej zmiana stawki w jednej
 * firmie przeciekłaby do pozostałych.
 */
export function zastosujUstawienia(firmy, ustawienia) {
  const u = scalUstawienia(ustawienia);

  for (const firma of firmy || []) {
    firma.robocizna = (firma.robocizna || []).map((r) => {
      if (r.id === 'obrobka') {
        return {
          ...r,
          // Zerowa stawka wraca do trybu „w cenie": pozycja zostaje na liście
          // świadczeń, ale bez kwoty (tak działało do 21.08.2026).
          cena: u.obrobkaZaM2,
          per: 'm2blatu',
          wCenie: u.obrobkaZaM2 <= 0,
        };
      }
      if (r.id === 'pomiar') return { ...r, cena: u.pomiar };
      if (r.id === 'montaz') return { ...r, baza: u.montazBaza, cena: u.montazZaM2 };
      return r;
    });

    firma.opcje = (firma.opcje || []).map((o) => {
      if (o.id === 'zlew') {
        return {
          ...o,
          warianty: (o.warianty || []).map((w) =>
            w.id === 'podblat'
              ? { ...w, cena: u.zlewPodblatowy }
              : { ...w, cena: Math.round(u.zlewPodblatowy * u.udzialNablatowego) }
          ),
        };
      }
      if (o.id === 'plyta') {
        return {
          ...o,
          warianty: (o.warianty || []).map((w) =>
            w.id === 'nakladana' ? { ...w, cena: u.plytaNakladana } : { ...w, cena: u.plytaLicowana }
          ),
        };
      }
      if (o.id === 'otwory') return { ...o, cena: u.otwor };
      if (o.id === 'mat') return { ...o, cena: u.mat };
      if (o.id === 'listwa') return { ...o, cena: u.listwa };
      if (o.id === 'krawedz') return { ...o, cena: u.krawedz };
      return o;
    });

    // Dodatek naturalny dotyczy wyłącznie firm, które go w ogóle mają
    // (Interstone). Reszta zostaje z zerem, tak jak dotąd.
    if (firma.obrobkaNaturalnaZaM2 != null) firma.obrobkaNaturalnaZaM2 = u.obrobkaNaturalnaZaM2;
  }

  return u;
}

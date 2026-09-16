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
 *     silnik sam schodzi do stawki wariantu. Cennik Dawida jest podany
 *     NETTO, więc w polach stoi `netto × 1,23`; panel pokazuje przy każdym
 *     polu przeliczenie na netto i na brutto 8%, żeby dało się je porównać
 *     z cennikiem bez kalkulatora w ręku,
 *   • to są NASZE ceny sprzedaży, nie ceny zakupu materiału. Cen zakupowych
 *     ani przeliczników dostawców tu nie ma i być nie może — te zostają
 *     w pricing/zrodla, poza repozytorium.
 */

import { ROBOCIZNA, zCennika } from '../firms/_domyslne.js';

/*
 * Wartości domyślne obróbki bierzemy WPROST z konfiguracji cennika, zamiast
 * przepisywać liczby. Do 16.09.2026 stały tu osobno i rozjechały się cicho:
 * `_domyslne.js` mówiło „w cenie, zero zł", panel domyślnie 200 zł/m² —
 * i to panel wygrywał, więc produkcja liczyła co innego niż repozytorium,
 * a test pilnował nieużywanej wersji.
 */
const OBROBKA = ROBOCIZNA.find((r) => r.id === 'obrobka') || {};
const OBROBKA_BAZA = OBROBKA.baza ?? 0;
const OBROBKA_ZA_M2 = OBROBKA.cena ?? 0;

/** Parametry, które Dawid widzi w panelu. Kolejność = kolejność w formularzu. */
export const PARAMETRY = [
  {
    klucz: 'obrobkaBaza',
    label: 'Obróbka — podstawa (przygotowanie, sklejenie)',
    jednostka: 'zł raz na wycenę',
    domyslnie: OBROBKA_BAZA,
    opis:
      'Doliczana RAZ na wycenę blatu kuchennego, obok stawki od metra. ' +
      'Przy blacie łazienkowym nie wchodzi. 0 = bez podstawy.',
  },
  {
    klucz: 'obrobkaZaM2',
    label: 'Obróbka blatu (docięcie, polerowanie, klejenie)',
    jednostka: 'zł/m² blatu',
    domyslnie: OBROBKA_ZA_M2,
    opis: 'Naliczana przy każdym blacie od powierzchni elementów. 0 razem z podstawą = w cenie.',
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
    domyslnie: zCennika(1000),
  },
  {
    klucz: 'zlewPodblatowy',
    label: 'Wycięcie + montaż zlewu podblatowego',
    jednostka: 'zł/szt.',
    domyslnie: zCennika(450),
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
    domyslnie: zCennika(250),
  },
  {
    klucz: 'plytaLicowana',
    label: 'Wycięcie pod płytę licowaną z blatem',
    jednostka: 'zł',
    domyslnie: zCennika(700),
  },
  { klucz: 'otwor', label: 'Otwór w blacie (bateria, dozownik…)', jednostka: 'zł/szt.', domyslnie: zCennika(150) },
  { klucz: 'mat', label: 'Dopłata za powierzchnię matową / strukturalną', jednostka: 'zł/m²', domyslnie: 60 },
  { klucz: 'listwa', label: 'Listwa przyścienna', jednostka: 'zł/m.b.', domyslnie: 180 },
  { klucz: 'krawedz', label: 'Wykończenie krawędzi', jednostka: 'zł/m.b.', domyslnie: 90 },

  /*
   * DODATKI Z CENNIKA DAWIDA (16.09.2026) — widoczne tylko w edytorze
   * właściciela (`tylkoWlasciciel` w firms/_domyslne.js). Domyślnie 0 sztuk,
   * więc żadna wycena nie rośnie sama; tu ustawia się ich CENĘ.
   */
  { klucz: 'zbrojenie', label: 'Zbrojenie otworów', jednostka: 'zł/szt.', domyslnie: zCennika(200) },
  { klucz: 'kanaliki', label: 'Kanaliki / rowki ociekowe', jednostka: 'zł/szt.', domyslnie: zCennika(500) },
  { klucz: 'ociekaczSpad', label: 'Ociekacz spadkowy (pochylnia)', jednostka: 'zł/szt.', domyslnie: zCennika(1000) },
  { klucz: 'ociekaczRowki', label: 'Ociekacz z rowkami', jednostka: 'zł/szt.', domyslnie: zCennika(1500) },
  { klucz: 'impregnacja', label: 'Impregnacja', jednostka: 'zł/szt.', domyslnie: zCennika(200) },
  { klucz: 'projektCad', label: 'Wykonanie projektu CAD', jednostka: 'zł/szt.', domyslnie: zCennika(250) },
  { klucz: 'podswietlenie', label: 'Podświetlenie blatów', jednostka: 'zł/m²', domyslnie: zCennika(1050) },
  { klucz: 'frezowanie', label: 'Frezowanie płyty', jednostka: 'zł/m²', domyslnie: zCennika(100) },
  { klucz: 'polerSpodu', label: 'Poler spodu', jednostka: 'zł/m²', domyslnie: zCennika(300) },
  { klucz: 'nacieciaLed', label: 'Nacięcia pod ledy', jednostka: 'zł/m.b.', domyslnie: zCennika(100) },
  {
    klucz: 'transportKm',
    label: 'Transport (dojazd)',
    jednostka: 'zł/km',
    domyslnie: zCennika(4),
    krok: 0.01,
    opis: 'Osobno od montażu automatycznego — wpisuje się kilometry w edytorze.',
  },
  {
    klucz: 'montazDzien',
    label: 'Montaż — dzień ekipy',
    jednostka: 'zł/dzień',
    domyslnie: zCennika(3000),
    opis: 'Rozliczenie dniówkowe. Stoi OBOK montażu od m² — nie zastępuje go.',
  },
  {
    klucz: 'dodatkowaOsoba',
    label: 'Dodatkowa osoba przy montażu',
    jednostka: 'zł/dzień',
    domyslnie: zCennika(1000),
  },

  /*
   * Poniższe dwa NIE są cenami — to parametry cięcia używane przez rozrys
   * płyt (app/rozrys.js). Trzymamy je w tym samym miejscu, bo to ta sama
   * szuflada „ustawienia zakładu", którą Dawid otwiera w panelu.
   */
  {
    klucz: 'rzazMm',
    label: 'Rozrys: rzaz piły',
    jednostka: 'mm',
    domyslnie: 3,
    opis: 'Szerokość cięcia — odstęp MIĘDZY elementami. Wymiarów elementów nie powiększa.',
  },
  {
    klucz: 'marginesPlytyMm',
    label: 'Rozrys: margines krawędzi płyty',
    jednostka: 'mm',
    // 0 od 25.08.2026 (decyzja Dawida): podaje wymiary do wycięcia bez
    // marginesów, więc elementy mają móc dochodzić do krawędzi płyty.
    // Parametr zostaje — przy surowej krawędzi kamienia bywa potrzebny.
    domyslnie: 0,
    opis: 'Zapas przy surowej krawędzi płyty. 0 = elementy mogą dochodzić do brzegu.',
  },
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
          baza: u.obrobkaBaza,
          bazaTylkoKuchnia: true,
          cena: u.obrobkaZaM2,
          per: 'm2blatu',
          // Dopiero OBIE kwoty na zero wracają do trybu „w cenie": pozycja
          // zostaje na liście świadczeń, ale bez kwoty. Sama zerowa stawka
          // od metra nie wystarczy, bo podstawa nadal by wchodziła — i wycena
          // pokazywałaby „w cenie" obok kwoty 1 500 zł.
          wCenie: u.obrobkaZaM2 <= 0 && u.obrobkaBaza <= 0,
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
      /*
       * Uwaga: stawka „mat" z panelu to NASZA dopłata za powierzchnię
       * matową. Gdy dopłata pochodzi z CENNIKA DOSTAWCY (Pacific:
       * Matt/Suede), zostawiamy ją w spokoju — inaczej stawka warsztatowa
       * skasowałaby cenę z cennika i sprzedawalibyśmy poniżej kosztu.
       */
      if (o.id === 'mat') return o.zCennika ? o : { ...o, cena: u.mat };
      if (o.id === 'listwa') return { ...o, cena: u.listwa };
      if (o.id === 'krawedz') return { ...o, cena: u.krawedz };
      // Dodatki z cennika 16.09.2026 — klucz stawki = id opcji, więc nowa
      // pozycja w cenniku nie wymaga kolejnego `if`-a tutaj.
      if (o.id in u) return { ...o, cena: u[o.id] };
      return o;
    });

    // Dodatek naturalny dotyczy wyłącznie firm, które go w ogóle mają
    // (Interstone). Reszta zostaje z zerem, tak jak dotąd.
    if (firma.obrobkaNaturalnaZaM2 != null) firma.obrobkaNaturalnaZaM2 = u.obrobkaNaturalnaZaM2;
  }

  return u;
}

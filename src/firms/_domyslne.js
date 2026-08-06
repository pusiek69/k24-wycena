/**
 * Domyślne stawki naszego zakładu (robocizna i obróbki).
 *
 * To NIE są ceny dostawcy — to nasza praca. Dlatego są wspólne dla firm,
 * a plik konkretnej firmy może je nadpisać w całości albo po kawałku.
 * Wszystkie kwoty tutaj są BRUTTO (tak jak podajemy klientowi).
 *
 * Pliki zaczynające się od „_" nie są traktowane jak firmy.
 */

export const VAT = 0.23;

export const ROBOCIZNA = [
  {
    id: 'obrobka',
    label: 'Obróbka: docięcie, polerowanie krawędzi, klejenie',
    cena: 350,
    per: 'mb',
  },
  {
    id: 'montaz',
    label: 'Transport i montaż u klienta',
    cena: 150,
    per: 'mb',
  },
];

/*
 * Wycięcie pod zlew i pod płytę grzewczą są w KAŻDEJ wycenie — nie ma
 * wariantu „bez". Klient wybiera tylko rodzaj. Zlewów nie sprzedajemy:
 * wycinamy otwór pod sprzęt, który klient kupuje sam.
 */
export const OPCJE = [
  {
    id: 'zlew',
    label: 'Zlew',
    opis: 'Wycięcie otworu pod zlew klienta — gotowych zlewów nie sprzedajemy.',
    typ: 'wybor',
    domyslnie: 'podblat',
    wymagane: true,
    warianty: [
      { id: 'podblat', label: 'Wycięcie + montaż zlewu podblatowego', cena: 650 },
      { id: 'nablat', label: 'Wycięcie pod zlew nablatowy', cena: 300 },
    ],
  },
  {
    id: 'plyta',
    label: 'Płyta grzewcza',
    opis: 'Licowana = równo z blatem, bez wystającej ramki (250 zł + 400 zł dopłaty).',
    typ: 'wybor',
    domyslnie: 'nakladana',
    wymagane: true,
    warianty: [
      { id: 'nakladana', label: 'Wycięcie pod płytę nakładaną', cena: 250 },
      { id: 'licowana', label: 'Wycięcie pod płytę licowaną z blatem', cena: 650 },
    ],
  },
  {
    id: 'bateria',
    label: 'Otwór pod baterię',
    typ: 'checkbox',
    cena: 120,
    per: 'szt',
    domyslnie: true,
  },
  {
    id: 'mat',
    label: 'Powierzchnia matowa lub strukturalna',
    opis: 'Dopłata do wykończenia innego niż polerowane — liczona od m² materiału.',
    typ: 'checkbox',
    cena: 60,
    per: 'm2',
    domyslnie: false,
  },
  {
    id: 'listwa',
    label: 'Listwa przyścienna (cokół z tego samego materiału)',
    typ: 'liczba',
    cena: 180,
    jednostka: 'm.b.',
    max: 40,
    domyslnie: 0,
  },
  {
    id: 'krawedz',
    label: 'Wykończenie krawędzi: fazowanie, zaokrąglenie, podklejka',
    typ: 'liczba',
    cena: 90,
    jednostka: 'm.b.',
    max: 40,
    domyslnie: 0,
  },
];

/** Standardowa płyta konglomeratu. */
export const PLYTA_STANDARD = { w: 320, h: 160, polowkaDozwolona: true };

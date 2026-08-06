# Cenniki i zasady wyceny — instrukcja

> **Najprościej:** dwuklik w `start-cennik.cmd` — narzędzie „Dodaj cennik"
> zrobi wszystko poniżej za Ciebie (wklejasz tabelę, podajesz rabat i marżę,
> zapisujesz). Ten dokument opisuje, co dzieje się pod spodem i jak zrobić
> to ręcznie, gdy cennik ma nietypowy układ.

Ten folder opisuje, **jak liczyć wycenę dla konkretnej firmy**. Jest celowo
oddzielony od aplikacji, bo trzyma rzeczy, których klient widzieć nie może.

```
pricing/
  README.md              ← ten plik (jest w gicie)
  zrodla/                ← TAJNE, POZA GITEM
    _WZOR.zasady.json    wzór do skopiowania
    <firma>.zasady.json  cennik katalogowy + rabat Dawida + marża
```

---

## 1. Skąd się bierze cena, którą widzi klient

```
cena katalogowa netto/m²      (z PDF-a dostawcy)
      × (1 − rabat zakupowy)   ← ile Dawid faktycznie płaci
      × (1 + marża)            ← ile zarabiamy
      = cena końcowa netto/m²  ← TO trafia do aplikacji
      × 1,23 (VAT)             ← dolicza aplikacja przy wyświetlaniu
```

Skrypt `npm run cennik` robi to za nas i zapisuje **wyłącznie ostatni wynik**
do `src/generated/<firma>.dekory.json`. Rabat i cena katalogowa zostają na dysku.

Jeśli któraś firma sprzedawana jest „po cenniku" (marżą jest sam rabat zakupowy),
wpisujemy `"juzPrzeliczone": true` — wtedy mnożnik wynosi 1.

---

## 2. Plik zasad — `pricing/zrodla/<firma>.zasady.json`

```jsonc
{
  "firma": "przyklad",                 // musi pasować do nazwy pliku w src/firms/
  "nazwa": "Przykładowa Firma",
  "zrodlo": "Cennik_2026.pdf",               // skąd przepisane
  "obowiazujeOd": "2026-01-01",
  "jednostka": "netto za 1 m2 plyty",

  "juzPrzeliczone": false,             // true = katalog zawiera już ceny końcowe
  "rabatZakupowy": 0.00,               // PRZYKŁAD — 0.30 oznacza 30% rabatu od cennika
  "marza": 0.00,                       // PRZYKŁAD — 0.25 oznacza +25% do ceny zakupu
  // "mnoznikRecznie": 1.0,            // opcjonalnie: nadpisuje powyższe

  // Cennik w euro (Marazzi)? Dopisz dwa pola — przeliczenie idzie na końcu,
  // już po rabacie i marży. Po zmianie kursu wystarczy `npm run cennik`.
  // "waluta": "EUR",
  // "kursEurPln": 4.35,

  "notatka": "Skąd rabat i kiedy potwierdzony.",

  "katalog": {
    "Nazwa Dekoru": { "20": 1000, "30": 1400 },
    "Inny Dekor":   { "20": 950 }
  }
}
```

Klucze w `katalog` to **dokładne nazwy dekorów** (tak jak mają być pokazane
klientowi), a w środku grubości w milimetrach.

---

## 3. Plik firmy — `src/firms/<firma>.js`

Jeden plik = jedna firma. Najważniejsze pola:

| Pole | Co robi |
|---|---|
| `slug` | identyfikator, musi pasować do nazwy pliku |
| `nazwa`, `typ`, `krotki`, `opis` | to, co czyta klient przy wyborze materiału |
| `linkDekory` | **przycisk „zobacz dekory"** — link do kolekcji dostawcy |
| `linkiDodatkowe` | dodatkowe linki (np. zdjęcia płyt na żywo) |
| `trybCeny` | `'katalog'` (ceny z pliku) lub `'reczna'` (klient/Dawid wpisuje cenę) |
| `rozliczenieMaterialu` | `'plyty'` (domyślnie) albo `'metraz'` (kamień naturalny) |
| `plyta` | `{ w, h, polowkaDozwolona }` — wymiar płyty w cm |
| `narzutOdpad` | zapas na docięcie, np. `0.1` = 10% |
| `pomijGrubosci` | grubości, których nie wyceniamy na blat, np. `['6']` |
| `opisGrubosci` | podpowiedzi przy wyborze grubości |
| `robocizna` | pozycje liczone zawsze (obróbka, montaż) |
| `opcje` | obróbki do wyboru przez klienta |
| `promocje` | czasowe ceny dostawcy (patrz niżej) |
| `notaKlient` | zdanie pokazywane w wycenie (np. „tylko całe płyty") |
| `vat`, `cenyUslug` | `0.23` i `'brutto'` / `'netto'` dla stawek usług |

Domyślne stawki robocizny i obróbek są w `src/firms/_domyslne.js` — firma może
je wziąć w całości (`robocizna: ROBOCIZNA`) albo napisać własne.

### Rodzaje obróbek (`opcje`)

```js
{ id:'zlew', label:'Zlew', typ:'wybor', domyslnie:'podblat',
  warianty:[ {id:'podblat', label:'…', cena:650}, {id:'brak', label:'Bez zlewu', cena:0} ] }

{ id:'bateria', label:'Otwór pod baterię', typ:'checkbox', cena:120, per:'szt', domyslnie:true }

{ id:'listwa', label:'Listwa przyścienna', typ:'liczba', cena:180, jednostka:'m.b.' }
```

`per`: `'szt'` (ryczałt) · `'mb'` (× metry bieżące blatu) · `'m2'` (× m² materiału).

### Promocje dostawcy

```js
promocje: [
  { nazwa: 'Wiosna 2026', od: '2026-03-01', do: '2026-06-30',
    ceny: { 'Nazwa Dekoru||20': 520 } }          // cena końcowa netto/m²
]
```

Aplikacja sama sprawdza datę: po `do` wraca cena podstawowa. **Uwaga:** tu też
wpisujemy cenę KOŃCOWĄ dla klienta, nie promocyjną cenę zakupu.

---

## 4. Checklista przy nowej firmie

- [ ] PDF cennika w `Downloads\CENNIKI\<FIRMA>\`
- [ ] `pricing/zrodla/<firma>.zasady.json` — katalog + rabat + marża
- [ ] `npm run cennik` — bez błędów
- [ ] `src/firms/<firma>.js` — z linkiem do dekorów dla klienta
- [ ] wymiar płyty i zasada połówek potwierdzone u dostawcy
- [ ] `npm run build` — strażnik nie zgłasza wycieku
- [ ] przeklikane w `npm run dev`: dekor → wymiary → obróbki → wycena

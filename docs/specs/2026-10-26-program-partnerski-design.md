# Program partnerski — projekt MVP (faza 1)

Data: 2026-10-26 · Ścieżka: architectural (superpowers) · Status: CZEKA NA AKCEPTACJĘ DAWIDA
Koncept: `Downloads\kam24h-marketing\PROGRAM-PARTNERSKI-koncept.md` — z tym, że
**decyzje Dawida nadpisują koncept** tam, gdzie się różnią.

## 0. Decyzje wiążące (od Dawida, 26.10.2026)

- Prowizja liczona **od całości netto zlecenia** (nie materiał+prace osobno — ale
  podstawa ma być konfigurowalna jako furtka).
- Struktura stawek: **15% pierwsze wygrane zlecenie partnera → 10% kolejne →
  15% status Premium** (Premium nadaje Dawid ręcznie w panelu „za dobrą współpracę").
- Stawka **NIEJAWNA publicznie** — na stronie tylko „atrakcyjna prowizja —
  szczegóły przy pierwszej rozmowie". (Odwrotnie niż w koncepcie — koncept przegrywa.)
- **Wszystkie parametry konfigurowalne w panelu** (jak „Stawki zakładu"):
  trzy procenty, podstawa naliczania (całość / materiał+prace), okres przypisania
  klienta (domyślnie **365 dni**).
- Poza MVP (faza 2): logowanie partnera, prowizja na żywo w kalkulatorze,
  polecenia dwupoziomowe, wariant rabatowy dla projektantów.

## 1. Zakres MVP

1. Strona `kam24h.pl/dla-partnerow` (statyczna, wg szkicu z konceptu §5.1,
   bez sekcji ze stawkami i bez 2. poziomu) + formularz zgłoszenia:
   imię, firma, typ (stolarz / firma meblowa / projektant / inny), telefon, e-mail.
   Zgłoszenie → mail do Dawida + karta w CRM ze źródłem `partner-zgloszenie`.
2. Linki partnerskie `kam24h.pl/?p=KOD` + przekierowanie `/p/KOD → /?p=KOD`
   (Netlify). Kod trzymany w przeglądarce klienta; lead z kalkulatora
   z ważnym kodem dostaje w CRM przypisanie do partnera.
3. Panel: zakładka **Partnerzy** — dodawanie/edycja partnera (nazwa, kod, typ,
   status Standard/Premium, aktywny), konfiguracja programu, lista leadów
   partnera, naliczone prowizje (od statusu „Wygrany"), zestawienie miesięczne.
4. Testy: naliczanie co do złotówki, przypisanie i wygaszanie po N dniach,
   zero śladów stawek na stronie publicznej i w publicznym API.
   **Silnik wyceny i lejek leadów nietknięte.**

## 2. Model danych (D1)

### Nowa tabela `partnerzy`

```sql
CREATE TABLE IF NOT EXISTS partnerzy (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  nazwa     TEXT NOT NULL,                  -- „Stolarnia Kowalski"
  kod       TEXT NOT NULL UNIQUE,           -- [a-z0-9-]{3,24}, np. 'kowalski'
  typ       TEXT NOT NULL DEFAULT 'inny',   -- stolarz|meble|projektant|inny
  status    TEXT NOT NULL DEFAULT 'standard', -- standard|premium
  telefon   TEXT NOT NULL DEFAULT '',
  email     TEXT NOT NULL DEFAULT '',
  aktywny   INTEGER NOT NULL DEFAULT 1,     -- 0 = kod przestaje przypisywać
  notatka   TEXT NOT NULL DEFAULT '',
  utworzono TEXT NOT NULL
);
```

### Zmiany w `klienci` (ALTER wg wzorca z 30.08 — osobno, nie w CREATE przy
istniejącej bazie; w CREATE dla świeżej)

- `partner_kod TEXT NOT NULL DEFAULT ''` — kod partnera przypisany przy leadzie
  (albo ręcznie w panelu — edycja pola na karcie, faza 1 TYLKO automat + wpis
  w notatce; ręczne przypisanie przez apiZmien to 1 pole więcej — tanio, robimy).
- `wygrany_kiedy TEXT NOT NULL DEFAULT ''` — data (YYYY-MM-DD) PIERWSZEGO
  przejścia karty na status `wygrany`; ustawiana w `ustawStatus`, nie cofana
  przy zmianie statusu z powrotem. Potrzebna do: (a) kolejności „pierwsze → kolejne",
  (b) zestawienia miesięcznego („wygrane w październiku").

### Konfiguracja — tabela `ustawienia` (istniejąca), klucze z prefiksem `partner`

| klucz                  | domyślnie | znaczenie |
|---|---|---|
| `partnerProcPierwsze`  | 15        | % od pierwszego wygranego zlecenia partnera |
| `partnerProcKolejne`   | 10        | % od kolejnych |
| `partnerProcPremium`   | 15        | % dla partnera Premium (wszystkie zlecenia) |
| `partnerPodstawa`      | 0         | 0 = całość netto; 1 = materiał+prace (furtka — MVP liczy tylko wariant 0, wariant 1 zaznaczony w UI jako „wkrótce") |
| `partnerDniPrzypisania`| 365       | ile dni kod z linku przypisuje klienta |

⚠ **ZNALEZISKO BEZPIECZEŃSTWA:** publiczny `/ustawienia` zwraca dziś WSZYSTKIE
wiersze tabeli (`odczytajStawki` robi `SELECT klucz, wartosc FROM ustawienia`).
Gdyby klucze `partner*` tam trafiły bez zmian, stawki — z decyzji NIEJAWNE —
wyszłyby na publicznym API. Dlatego `odczytajStawki` dostaje filtr do listy
dozwolonych kluczy silnika (`DOZWOLONE` z `src/app/ustawienia.js`), a klucze
`partner*` czyta wyłącznie panel. Pilnuje tego test (patrz §6).

## 3. Naliczanie prowizji (worker/partnerzy.js — czyste funkcje)

- **Zlecenie liczone do prowizji** = karta klienta z `partner_kod = kod`
  i statusem `wygrany` (stan obecny karty), uporządkowana po `wygrany_kiedy`
  (fallback `utworzono` dla kart wygranych przed wdrożeniem — nie będzie takich
  z partnerem, bo kolumny wchodzą razem).
- **Podstawa netto**: z OSTATNIEJ wyceny karty — `dane.razemPrzed ?? dane.razem`
  brutto i `dane.stawkaVat` (0.08/0.23) → `netto = round(brutto / (1 + vat))`;
  gdy karta nie ma wyceny z kwotą — `kwota_ostatnia / 1.08` i wiersz oznaczony
  w zestawieniu „sprawdź podstawę". Rabaty: liczymy od kwoty PO rabacie
  (`razem`), nie przed — prowizja od tego, co klient realnie płaci. ⟵ ZAŁOŻENIE
  DO POTWIERDZENIA przez Dawida.
- **Stawka**: `premium → procPremium`; inaczej pierwszy element listy wygranych
  partnera → `procPierwsze`, reszta → `procKolejne`.
- **Prowizja** = `round(netto × proc / 100)` w zł (całe złote, zaokrąglenie
  matematyczne — co do złotówki, jak w zleceniu).
- Zestawienie miesięczne: wygrane z `wygrany_kiedy` w danym `YYYY-MM`,
  per partner: lista (klient, data, netto, %, prowizja) + suma. Stawka
  pierwsze/kolejne liczona wg GLOBALNEJ kolejności wygranych partnera
  (nie per miesiąc).

## 4. Przypisanie klienta do partnera

- Front (`src/app/partner.js`, wołany z main.js obok `zapamietajZrodlo`):
  `?p=KOD` (po sanityzacji `[a-z0-9-]{3,24}`) → `localStorage['k24h-partner']
  = {kod, od: Date.now()}`. **Pierwszy kod wygrywa**: istniejący, nieprzeterminowany
  wpis nie jest nadpisywany; wpis starszy niż 400 dni jest sprzątany.
  Zapis niezależny od zgody marketingowej — to identyfikator POLECAJĄCEGO
  (rozliczenie B2B z partnerem), nie profilowanie klienta; nie wchodzi do GA.
  ⟵ ZAŁOŻENIE DO POTWIERDZENIA.
- Lead (`src/app/bramka.js`): do payloadu `/lead` dokłada `partner: {kod, od}`
  (gdy wpis istnieje). Zero zmian w lejku/GA4 — jedno dodatkowe pole w JSON.
- Worker (`obsluzLead`): kod ważny, gdy partner istnieje, `aktywny=1`
  i `Date.now() - od <= partnerDniPrzypisania × 86400000` (konfig czytany
  z bazy; decyzja o ważności PO STRONIE SERWERA, więc zmiana konfiguracji
  działa od ręki). Ważny → `klienci.partner_kod` przy zapisie leada
  (nowa karta i dopisanie do istniejącej karty bez partnera; karta z JUŻ
  przypisanym innym partnerem NIE jest nadpisywana — pierwszy wygrywa) +
  wiersz „Partner: Nazwa (kod)" w mailu do Dawida.
- `/p/KOD`: redirect w `netlify.toml`: `from = "/p/*" to = "/?p=:splat" status = 302`.

## 5. Strona /dla-partnerow i formularz

- `dla-partnerow.html` (nowy input w vite.config) — struktura i style jak
  istniejące strony statyczne; sekcje wg konceptu §5.1 z cenzurą stawek:
  H1 bez procentów („Zarabiaj na blatach z kamienia — bez obróbki kamienia"),
  sekcja „Ile zarobisz" → „Atrakcyjna prowizja od każdego zrealizowanego
  zlecenia — szczegóły przy pierwszej rozmowie", 4 kroki, „Twój klient zostaje
  Twój — przypisanie w CRM na 365 dni", sekcje dla stolarzy i projektantów,
  FAQ (bez pytań o 2 poziom), formularz. Title/description wg wzorca
  („wycena online w 2 minuty" w opisie), wpis do sitemap (`npm run sitemap`),
  link w stopce/nawigacji jak inne podstrony.
- Formularz: imię, firma, typ (select), telefon, e-mail + pole-pułapka na boty
  + zgoda kontaktowa. POST na nową trasę workera **`/partner`**:
  walidacja (imię+telefon wymagane, telefon 9 cyfr — reguła jak w panelu),
  zapis karty przez istniejący mechanizm klienta ręcznego (`zrodlo =
  'partner-zgloszenie'`, temat `inne`, notatka: „Zgłoszenie do programu
  partnerskiego — typ: stolarz, firma: X"), mail do Dawida (szkielet
  mail-rozmowa, bez przycisku edycji — nie ma czego edytować), odpowiedź
  „Dziękujemy — odezwiemy się w 48 h". Awaria maila nie blokuje zapisu i
  odwrotnie (wzorzec z /lead).

## 6. Panel — zakładka „Partnerzy"

Wzorzec istniejących sekcji panelu (Wyprzedaż/Zakupy). Trasy (wszystkie za
ciasteczkiem panelu):

- `GET  /panel/api/partnerzy` → `{partnerzy:[{...partner, leadow, wygranych,
  prowizjaSuma}], konfig:{procPierwsze, procKolejne, procPremium, podstawa, dni}}`
- `POST /panel/api/partnerzy/zapisz` → dodaj/edytuj (`id?` = edycja); walidacja
  kodu `[a-z0-9-]{3,24}` + unikalność; zmiana kodu zabroniona, gdy są leady.
- `POST /panel/api/partnerzy/konfig` → zapis kluczy `partner*` (tylko te,
  liczby w sensownych widełkach: procenty 0–50, dni 1–3650).
- `GET  /panel/api/partnerzy/rozliczenie?miesiac=YYYY-MM` → zestawienie §3.
- Karta klienta w panelu pokazuje partnera (gdy przypisany); `apiZmien`
  przyjmuje `partnerKod` (ręczne przypisanie/odpięcie, walidowane po tabeli).

UI: lista partnerów (nazwa, kod — do skopiowania pełny link, typ, Standard/
Premium przełącznik, aktywny, liczby), formularz dodawania, blok konfiguracji
(jak Stawki zakładu, z dopiskiem „stawki niejawne — nie trafiają na stronę"),
wybór miesiąca + tabela rozliczenia z sumami per partner.

## 7. Czego NIE ruszamy

Silnik wyceny (`src/engine`, firms, pricing), lejek leadów i zdarzenia GA4,
mechanika ofert/rozmów, mail do KLIENTA (partner niewidoczny dla klienta),
istniejące strony. Żadnych stawek partnerskich w: HTML stron publicznych,
bundlach JS strony, odpowiedzi `/ustawienia`, mailach do klienta.

## 8. Testy (nowy scripts/test-partnerzy.mjs + rozszerzenia smoke)

1. **Naliczanie co do złotówki** (czyste funkcje): 15% od pierwszego, 10% od
   drugiego i trzeciego; Premium 15% od wszystkich; netto z brutto 8% i 23%;
   zaokrąglenia na granicach (np. netto 10 000,49); konfiguracja nadpisuje
   procenty; podstawa=1 na razie liczy jak 0 (furtka, nie feature).
2. **Przypisanie** (smoke, realny worker.fetch): lead z ważnym kodem →
   `klienci.partner_kod`; kod przeterminowany (od = now − 366 dni przy konfig
   365) → brak przypisania; kod nieistniejący/nieaktywny → brak; karta z już
   przypisanym partnerem nie jest nadpisywana; mail do Dawida niesie partnera.
3. **Wygaszanie konfigurowalne**: konfig dni=30 → kod 31-dniowy odpada,
   29-dniowy wchodzi.
4. **Zero śladów stawek publicznie**: `/ustawienia` nie zawiera żadnego klucza
   `partner*`; `dla-partnerow.html` nie matchuje `/\d\s*%/` i nie zawiera słów
   „15%", „10%", „prowizja wynosi"; trasa `/partner` nie zwraca konfiguracji.
5. **Zgłoszenie partnera**: POST /partner → karta ze `zrodlo='partner-zgloszenie'`
   + 1 mail do Dawida; pułapka na boty → cisza; telefon 8-cyfrowy → czytelny błąd.
6. **Panel**: zapis partnera, odrzucenie dubla kodu, rozliczenie miesięczne
   zgadza się co do złotówki na przygotowanym scenariuszu (3 wygrane w 2 mies.).
7. **Regresje**: cały istniejący pakiet zielony; `wygrany_kiedy` nie psuje
   apiZmien dla kart bez partnera.

## 9. Rozważone warianty

- **Osobna tabela prowizji (ledger) zamiast liczenia derywacyjnego** — odpada
  w MVP: dopóki prowizja wynika w 100% z reguł i statusów, ledger to drugi
  stan do synchronizacji (YAGNI). Wróci w fazie 2, gdy dojdą korekty ręczne.
- **Okres przypisania we froncie** (localStorage z datą ważności) — odpada:
  decyzja po stronie serwera, bo konfiguracja ma działać od ręki i wstecz.
- **Kod w cookie zamiast localStorage** — localStorage wystarcza (ta sama
  przeglądarka; cookie nie daje tu nic poza wysyłką przy każdym request).

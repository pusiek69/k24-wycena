-- ═══════════════════════════════════════════════════════════════════════
--  BAZA KLIENTÓW (Cloudflare D1, region EEUR)
--
--  Zakładanie / aktualizacja:
--    npx wrangler d1 execute k24h-crm --remote --file=worker/schema.sql
--
--  Każde zgłoszenie z kalkulatora dokleja się do karty klienta rozpoznanej
--  po telefonie albo mailu — jeden klient, wiele wycen. Maile do Dawida
--  i do klienta lecą jak dotąd; zapis do bazy jest dodatkiem, który nie
--  ma prawa przewrócić wysyłki.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS klienci (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  imie            TEXT NOT NULL DEFAULT '',
  telefon         TEXT NOT NULL DEFAULT '',
  email           TEXT NOT NULL DEFAULT '',
  miejscowosc     TEXT NOT NULL DEFAULT '',
  -- Klucze deduplikacji: 9 cyfr numeru i mail małymi literami.
  telefon_klucz   TEXT NOT NULL DEFAULT '',
  email_klucz     TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'nowy',
  -- Data następnego kontaktu (YYYY-MM-DD) — z niej robi się sekcja „NA DZIŚ".
  oddzwonic       TEXT,
  -- 'ads' | 'organiczne' | 'nieznane' (gdy klient nie zgodził się na marketing)
  zrodlo          TEXT NOT NULL DEFAULT 'nieznane',
  zrodlo_szczegol TEXT NOT NULL DEFAULT '',
  -- Automatyczne podejrzenia (JSON: ["test","dubel"]) — szara flaga, nie wyrok.
  flagi           TEXT NOT NULL DEFAULT '[]',
  -- Odpowiedź klienta na pokazaną wycenę: '' | 'pasuje' | 'za_drogo' | 'zastanowi'.
  feedback        TEXT NOT NULL DEFAULT '',
  -- Planowany termin realizacji, zaznaczony przez klienta w formularzu
  -- (id z src/app/termin.js: pilne | miesiac | kwartal | pol_roku | pozniej).
  -- Trzymamy go PRZY KLIENCIE, nie przy wycenie: Dawid dzwoni do człowieka,
  -- a nie do wyceny, i interesuje go najświeższa deklaracja. Puste = wycena
  -- starsza niż to pole (30.08.2026) albo klient nic nie zaznaczył.
  termin          TEXT NOT NULL DEFAULT '',
  -- Budżet z pytania przy „za drogo" (dobrowolny) i pora kontaktu przy „pasuje".
  budzet          TEXT NOT NULL DEFAULT '',
  pora            TEXT NOT NULL DEFAULT '',
  wycen           INTEGER NOT NULL DEFAULT 0,
  kwota_ostatnia  INTEGER NOT NULL DEFAULT 0,
  kwota_max       INTEGER NOT NULL DEFAULT 0,
  utworzono       TEXT NOT NULL,
  -- Ostatni ruch na karcie: nowa wycena, notatka, zmiana statusu.
  ruch            TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS klienci_telefon  ON klienci (telefon_klucz);
CREATE INDEX IF NOT EXISTS klienci_email    ON klienci (email_klucz);
CREATE INDEX IF NOT EXISTS klienci_status   ON klienci (status);
CREATE INDEX IF NOT EXISTS klienci_oddzwonic ON klienci (oddzwonic);
CREATE INDEX IF NOT EXISTS klienci_ruch     ON klienci (ruch);

-- Dopisanie kolumny do bazy, która powstała przed 30.08.2026.
-- D1 nie zna `ADD COLUMN IF NOT EXISTS`, więc przy świeżej bazie ten
-- ALTER się wywali („duplicate column") — i dobrze, bo kolumna już jest
-- w CREATE TABLE wyżej. Uruchamiamy go osobno, nie z całym schematem.

CREATE TABLE IF NOT EXISTS wyceny (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  klient_id    INTEGER NOT NULL REFERENCES klienci(id) ON DELETE CASCADE,
  utworzono    TEXT NOT NULL,
  kwota        INTEGER NOT NULL DEFAULT 0,
  firma        TEXT NOT NULL DEFAULT '',
  dekor        TEXT NOT NULL DEFAULT '',
  grubosc      TEXT NOT NULL DEFAULT '',
  m2           REAL NOT NULL DEFAULT 0,
  mb           REAL NOT NULL DEFAULT 0,
  pomieszczenie TEXT NOT NULL DEFAULT '',
  odbior       INTEGER NOT NULL DEFAULT 0,
  kod_plyty    TEXT NOT NULL DEFAULT '',
  opis         TEXT NOT NULL DEFAULT '',
  -- Rodzaj materiału (konglomerat / spiek / naturalny) — po nim grupuje się
  -- statystyka odpowiedzi klientów na wyceny.
  kategoria    TEXT NOT NULL DEFAULT '',
  -- Odpowiedź klienta przypięta do tej konkretnej wyceny (ostatniej w chwili
  -- kliknięcia) — z tego liczy się % pasuje/za drogo/zastanowi per materiał.
  feedback     TEXT NOT NULL DEFAULT '',
  -- '' = wycena klienta z kalkulatora; 'dawid' = wersja przygotowana w panelu
  -- („Powtórz wycenę"). Oryginał klienta nigdy nie jest nadpisywany.
  wersja       TEXT NOT NULL DEFAULT '',
  -- JSON: zamrożone pozycje i kwoty (wersja Dawida) albo parametry wejściowe
  -- (wycena klienta — z nich „Powtórz wycenę" odtwarza kalkulator).
  dane         TEXT NOT NULL DEFAULT '',
  -- Losowy token linku wyceny online dla klienta (wersje Dawida).
  token        TEXT NOT NULL DEFAULT '',
  -- „Klient obejrzał": licznik i data ostatniego otwarcia linku.
  otwarcia     INTEGER NOT NULL DEFAULT 0,
  ostatnie_otwarcie TEXT
);

CREATE INDEX IF NOT EXISTS wyceny_token ON wyceny (token);

CREATE INDEX IF NOT EXISTS wyceny_klient ON wyceny (klient_id);

CREATE TABLE IF NOT EXISTS notatki (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  klient_id  INTEGER NOT NULL REFERENCES klienci(id) ON DELETE CASCADE,
  utworzono  TEXT NOT NULL,
  -- 'dawid' (wpisana ręcznie) albo 'system' (zmiana statusu, nowa wycena)
  autor      TEXT NOT NULL DEFAULT 'dawid',
  tresc      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS notatki_klient ON notatki (klient_id);

-- Drobiazgi panelu: znacznik ostatniego wejścia (licznik nowych),
-- data ostatniego sprzątania starych kart.
CREATE TABLE IF NOT EXISTS meta (
  klucz   TEXT PRIMARY KEY,
  wartosc TEXT NOT NULL
);

-- Nieudane logowania — po kilku próbach z tego samego adresu panel
-- przestaje odpowiadać na hasło przez kwadrans.
CREATE TABLE IF NOT EXISTS logowania (
  ip    TEXT PRIMARY KEY,
  proby INTEGER NOT NULL DEFAULT 0,
  do_kiedy TEXT NOT NULL
);

-- Stawki zakładu ustawiane przez Dawida w panelu (montaż, obróbka, wycięcia).
-- Klucze odpowiadają PARAMETRY w src/app/ustawienia.js; brak wiersza znaczy
-- „wartość domyślna z kodu". Nie ma tu cen zakupu materiału.
CREATE TABLE IF NOT EXISTS ustawienia (
  klucz     TEXT PRIMARY KEY,
  wartosc   TEXT NOT NULL,
  zmieniono TEXT NOT NULL
);

-- ═══════════════════════════════════════════════════════════════════════
--  ROZMOWA POD OFERTĄ (zlecenie Dawida, 24.08.2026)
--
--  Wątek wisi przy KONKRETNEJ ofercie, nie przy kliencie: ten sam klient
--  może dostać dwie wyceny (kuchnia i łazienka) i rozmowy nie mogą się
--  zlewać. W panelu i tak widać je wszystkie na jego karcie.
--
--  Klient pisze bez logowania — autoryzuje go token z linku do oferty
--  (kto ma link, ma wątek). Dlatego `wycena_id` jest tu kluczem, po
--  którym wszystko chodzi.
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS wiadomosci (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  wycena_id  INTEGER NOT NULL REFERENCES wyceny(id) ON DELETE CASCADE,
  klient_id  INTEGER NOT NULL REFERENCES klienci(id) ON DELETE CASCADE,
  -- 'klient' (napisał ze strony oferty) albo 'dawid' (odpisał z panelu)
  autor      TEXT NOT NULL,
  tresc      TEXT NOT NULL,
  utworzono  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS wiadomosci_wycena ON wiadomosci (wycena_id, id);

CREATE INDEX IF NOT EXISTS wiadomosci_klient ON wiadomosci (klient_id, id);

-- ═══════════════════════════════════════════════════════════════════════
--  JEDEN LINK = ZAWSZE NAJNOWSZA WERSJA (zlecenie Dawida, 25.08.2026)
--
--  „Chciałbym tę wycenę móc zmieniać dla klienta w czasie rzeczywistym —
--   pod TYM SAMYM linkiem, żeby nie robić 5 osobnych wycen."
--
--  Wersje nadal są osobnymi wierszami (audyt zostaje nietknięty), ale
--  łączy je `watek` — token PIERWSZEJ wersji. Link klienta pokazuje
--  najnowszą wersję z wątku, a stare, rozesłane wcześniej linki dalej
--  działają, bo prowadzą do tego samego wątku.
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE wyceny ADD COLUMN watek TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS wyceny_watek ON wyceny (watek, id);

-- Wysłane wcześniej oferty: każda jest sama dla siebie osobnym wątkiem.
UPDATE wyceny SET watek = token WHERE watek = '' AND token <> '';

-- ═══════════════════════════════════════════════════════════════════════
--  WYPRZEDAŻ PŁYT — kategoria „NATURA WYPRZEDAŻ" w kalkulatorze
--  oraz strona /wyprzedaz-plyt  (zlecenie Dawida, 30.08.2026)
--
--  Jeden wiersz = JEDNA fizyczna płyta z magazynu, którą Dawid chce
--  sprzedać: zdjęcie, wymiar, grubość i GOTOWA cena dla klienta.
--
--  DLACZEGO CENA JEST GOTOWA: Dawid wpisuje kwotę, którą klient ma
--  zobaczyć. Silnik nie nakłada na nią żadnej marży ani upustu —
--  wyprzedaż to resztka magazynowa, jej cena nie wynika z cennika
--  dostawcy i nie ma się do czego odnosić.
--
--  `cena_normalna_m2 = 0` znaczy „nie pokazuj przekreślonej ceny".
--  Gdy większa od zera, na karcie płyty widać „było … jest …".
--
--  `plyt_zostalo = 0` to płyta SPRZEDANA: znika z kalkulatora i ze strony,
--  ale zostaje w panelu — Dawid widzi, co poszło, i może cofnąć pomyłkę.
--
--  `opublikowana = 0` to SZKIC: ani kategoria w kalkulatorze, ani strona
--  wyprzedaży go nie pokazują. Widzi go wyłącznie Dawid pod podpisanym
--  linkiem podglądu — tym samym kodem, który zobaczy klient po
--  kliknięciu „Opublikuj".
--
--  POPRZEDNICZKA: tabela `promocje_plyt` (baner „ostatnie płyty"
--  z licznikiem). Dawid zmienił koncepcję na prostszą, zanim cokolwiek
--  trafiło na produkcję — tamta tabela była pusta i została usunięta.
-- ═══════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS promocje_plyt;

CREATE TABLE IF NOT EXISTS wyprzedaz_plyt (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  -- Nazwa widoczna dla klienta, np. „Granit Star Galaxy".
  nazwa             TEXT NOT NULL,
  -- Wolny dopisek pod nazwą, np. „polerowany, jedna sztuka".
  opis              TEXT NOT NULL DEFAULT '',
  -- Numer płyty z magazynu — trafia na kartę wyceny i w temat maila,
  -- tak samo jak przy kamieniu naturalnym, żeby Dawid wiedział, o którą chodzi.
  kod_plyty         TEXT NOT NULL DEFAULT '',
  -- Gdy płyta pochodzi z konkretnego cennika: dziedziczymy po niej rodzaj
  -- materiału, narzut odpadu i dodatek za obróbkę kamienia naturalnego.
  -- Cena i tak bierze się z `cena_m2`, nigdy z cennika.
  firma_slug        TEXT NOT NULL DEFAULT '',
  grubosc_mm        INTEGER NOT NULL DEFAULT 20,
  plyta_dl_cm       REAL NOT NULL,
  plyta_gl_cm       REAL NOT NULL,
  -- Obie kwoty to zł/m² BRUTTO, wpisywane wprost przez Dawida.
  cena_normalna_m2  INTEGER NOT NULL DEFAULT 0,
  cena_m2           INTEGER NOT NULL,
  plyt_razem        INTEGER NOT NULL DEFAULT 1,
  plyt_zostalo      INTEGER NOT NULL DEFAULT 1,
  -- Zdjęcie: albo adres (`zdjecie_url`), albo wgrany plik trzymany jako
  -- data URI (`zdjecie_dane`). Panel zmniejsza obrazek w przeglądarce
  -- PRZED wysłaniem, żeby wiersz D1 nie urósł ponad limit.
  zdjecie_url       TEXT NOT NULL DEFAULT '',
  zdjecie_dane      TEXT NOT NULL DEFAULT '',
  opublikowana      INTEGER NOT NULL DEFAULT 0,
  utworzono         TEXT NOT NULL,
  zmieniono         TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS wyprzedaz_plyt_opublikowana ON wyprzedaz_plyt (opublikowana);

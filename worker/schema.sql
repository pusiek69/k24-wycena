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
  feedback     TEXT NOT NULL DEFAULT ''
);

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

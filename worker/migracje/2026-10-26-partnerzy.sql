-- PROGRAM PARTNERSKI (26.10.2026) — migracja produkcyjnej D1 (k24h-crm).
-- Uruchomić PRZED deployem workera (kolumny mają DEFAULT, więc stary kod
-- ich nie zauważy, a nowy już je zastanie):
--
--   npx wrangler d1 execute k24h-crm --remote --file worker/migracje/2026-10-26-partnerzy.sql
--
-- (pamiętać o CLOUDFLARE_ACCOUNT_ID — bez niego wrangler odbija błędem 7403)

CREATE TABLE IF NOT EXISTS partnerzy (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  nazwa     TEXT NOT NULL,
  kod       TEXT NOT NULL UNIQUE,
  typ       TEXT NOT NULL DEFAULT 'inny',
  status    TEXT NOT NULL DEFAULT 'standard',
  telefon   TEXT NOT NULL DEFAULT '',
  email     TEXT NOT NULL DEFAULT '',
  aktywny   INTEGER NOT NULL DEFAULT 1,
  notatka   TEXT NOT NULL DEFAULT '',
  utworzono TEXT NOT NULL
);

ALTER TABLE klienci ADD COLUMN partner_kod TEXT NOT NULL DEFAULT '';
ALTER TABLE klienci ADD COLUMN wygrany_kiedy TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS klienci_partner ON klienci (partner_kod);

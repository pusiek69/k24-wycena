-- INDYWIDUALNE PROWIZJE PER PARTNER (29.10.2026) — migracja produkcyjnej D1.
-- NULL = dziedziczy z globalnej konfiguracji programu; liczba (także 0)
-- nadpisuje. Uruchomić przed/za deployem workera (kolumny NULL-owe są
-- niewidzialne dla starego kodu):
--
--   npx wrangler d1 execute k24h-crm --remote --file worker/migracje/2026-10-29-partnerzy-prowizje.sql
--   (przy błędzie auth na --file: trzy ALTERy pojedynczo przez --command
--    albo konsolę D1 w dashboardzie — jak 29.10 przy tabeli partnerzy)

ALTER TABLE partnerzy ADD COLUMN proc_pierwsze INTEGER;
ALTER TABLE partnerzy ADD COLUMN proc_kolejne INTEGER;
ALTER TABLE partnerzy ADD COLUMN proc_premium INTEGER;

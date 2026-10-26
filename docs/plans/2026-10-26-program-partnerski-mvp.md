# Plan implementacji: program partnerski MVP

Spec: `docs/specs/2026-10-26-program-partnerski-design.md` (musi być zaakceptowany).
Metodyka: TDD (red→green→commit po każdym etapie), zmiany chirurgiczne,
zero dotykania silnika wyceny i lejka. Osobne commity per etap.

## Mapa plików

| Plik | Nowy? | Odpowiedzialność |
|---|---|---|
| `worker/partnerzy.js` | NOWY | Czyste reguły: `stawkaProwizji({premium, pierwsze, konfig})`, `prowizja(nettoZl, procent)`, `nettoZlecenia(daneWyceny, kwotaFallback)`, `KONFIG_DOMYSLNA`, `KLUCZE_KONFIGU`, `poprawnyKod(kod)`, `kodWazny({od, teraz, dni})` |
| `worker/partnerzy-baza.js` | NOWY | SQL: CRUD partnerów, `partnerPoKodzie`, `konfigPartnerska(env)` (ustawienia `partner*` + domyślne), `wygraneParntera`, `rozliczenieMiesiaca(env, 'YYYY-MM')`, `zglosPartnera` (karta klienta `zrodlo='partner-zgloszenie'`) |
| `worker/schema.sql` | zmiana | tabela `partnerzy`; kolumny `klienci.partner_kod`, `klienci.wygrany_kiedy` (CREATE + ALTER-y wg wzorca 30.08) |
| `worker/baza.js` | zmiana | `odczytajStawki(env, dozwolone)` — filtr kluczy (publiczne `/ustawienia` dostaje TYLKO stawki silnika); `zapiszLead` przyjmuje `partnerKod`; `ustawStatus` stempluje `wygrany_kiedy` przy pierwszym `wygrany` |
| `worker/worker.template.js` | zmiana | trasa `POST /partner` (zgłoszenie); w `obsluzLead` walidacja `d.partner` → `partnerKod`; linia partnera w mailu do firmy; `obsluzUstawienia` woła odczyt z filtrem |
| `worker/panel.js` | zmiana | trasy `/panel/api/partnerzy[,/zapisz,/konfig,/rozliczenie]`; UI zakładki Partnerzy (lista, formularz, konfig, rozliczenie); partner na karcie klienta; `apiZmien` + `partnerKod` |
| `worker/mail-partner.js` | NOWY | mail do Dawida o zgłoszeniu partnera (szkielet jak mail-rozmowa, bez przycisku edycji) |
| `src/app/partner.js` | NOWY | front: `zapamietajPartnera()` (z `?p=`), `partnerDoLeada()` (localStorage `k24h-partner`, pierwszy kod wygrywa, sprzątanie >400 dni) |
| `src/main.js` | zmiana | wywołanie `zapamietajPartnera()` obok `zapamietajZrodlo()` |
| `src/app/bramka.js` | zmiana | payload `/lead` + `partner: partnerDoLeada()` |
| `dla-partnerow.html` | NOWY | strona publiczna wg spec §5 (bez procentów!) |
| `vite.config.js` | zmiana | input `dla_partnerow` |
| `netlify.toml` | zmiana | redirect `/p/* → /?p=:splat 302` |
| `public/sitemap.xml` | generowane | `npm run sitemap` po dodaniu strony |
| `scripts/test-partnerzy.mjs` | NOWY | testy reguł + bazy + źródłowe strony |
| `scripts/test-worker-smoke.mjs` | zmiana | przypisanie e2e, /partner, szczelność /ustawienia |

## Etapy (commit po każdym; każdy etap: testy RED → implementacja → GREEN → pakiet)

### Etap 1: reguły prowizji (worker/partnerzy.js) — sam czysty kod
RED (test-partnerzy.mjs):
- `stawkaProwizji({premium:false, pierwsze:true, konfig:DOMYSLNA})` → 15;
  `pierwsze:false` → 10; `premium:true` (pierwsze i kolejne) → 15;
  konfig {procPierwsze:12, procKolejne:7, procPremium:20} honorowany.
- `nettoZlecenia({razem:12960, stawkaVat:0.08})` → 12000;
  `({razem:12300, stawkaVat:0.23})` → 10000; brak danych + fallback 10800 →
  `{netto:10000, zPodgladu:true}`; razemPrzed ignorowane gdy jest razem (rabat:
  liczymy po rabacie).
- `prowizja(10000, 15)` → 1500; `prowizja(3333, 10)` → 333; pół złotego w górę:
  `prowizja(10003, 15)` → 1500 (1500.45→1500), `prowizja(10010, 15)` → 1502
  (1501.5→1502).
- `kodWazny({od: now-364d, teraz: now, dni:365})` → true; 366d → false;
  dni:30 z od 31d → false, 29d → true.
- `poprawnyKod('kowalski')` → true; 'Kowal ski', 'ab', 51 znaków, 'ko!d' → false.
GREEN: implementacja. Commit: „Partnerski 1/6: reguly prowizji i waznosci kodu".

### Etap 2: schema + szczelność /ustawienia + stempel wygranej
RED (smoke + test-partnerzy):
- `/ustawienia` po wpisaniu do bazy klucza `partnerProcPierwsze=15` NIE zawiera
  żadnego klucza zaczynającego się od `partner` (a stawki silnika nadal są).
- `ustawStatus(…,'wygrany')` ustawia `wygrany_kiedy=YYYY-MM-DD`; ponowna zmiana
  statusów nie nadpisuje daty; karty bez partnera działają jak dotąd (regresja
  apiZmien).
GREEN: schema.sql (tabela+kolumny+ALTERy), `odczytajStawki(env, dozwolone)`
(lista = klucze PARAMETRY z src/app/ustawienia.js; wywołania panelu stawek bez
zmian zachowania), stempel w ustawStatus. Commit: „Partnerski 2/6: schema,
szczelnosc publicznych ustawien, stempel wygranej".

### Etap 3: przypisanie leada (front + worker)
RED:
- źródłowe: `src/main.js` woła `zapamietajPartnera`, bramka dokleja `partner:`;
  `partner.js`: pierwszy kod wygrywa, sanityzacja, sprzątanie starych wpisów
  (testy czystych funkcji z wstrzykniętym storage).
- smoke: partner 'kowalski' w bazie → lead z `partner:{kod:'kowalski', od:now-1d}`
  → karta ma `partner_kod='kowalski'`, mail do Dawida zawiera „Partner:";
  od=now−366d → partner_kod=''; kod nieistniejący → ''; `aktywny=0` → '';
  konfig dni=30: 31d odpada, 29d wchodzi; druga wycena klienta z innym kodem
  nie nadpisuje pierwszego partnera.
GREEN: partner.js, main.js, bramka.js, obsluzLead + zapiszLead + mailDoFirmy
(linia partnera), partnerzy-baza (partnerPoKodzie, konfigPartnerska).
Commit: „Partnerski 3/6: link ?p=KOD przypisuje klienta (365 dni, konfig)".

### Etap 4: zgłoszenie partnera (/partner) + mail + karta CRM
RED (smoke): POST /partner {imie, firma, typ:'stolarz', telefon:'600100800',
email} → 200, karta `zrodlo='partner-zgloszenie'` z notatką typu i firmy,
1 mail do Dawida (temat zawiera „partner"); pułapka wypełniona → 200 i zero
śladów; telefon '12' → 400 z „9 cyfr"; mail pada → karta i tak jest.
GREEN: trasa, mail-partner.js, zglosPartnera. Commit: „Partnerski 4/6:
formularz zgloszenia — mail + karta CRM".

### Etap 5: strona /dla-partnerow + redirect + sitemap
RED (test-partnerzy, po źródle):
- `dla-partnerow.html` istnieje, ma title wg wzorca, formularz z polami
  imie/firma/typ/telefon/email + pułapką, POST na /partner;
- NIE matchuje `/\d\s*%/`, nie zawiera „15%", „10%", „prowizj" obok cyfr
  (dokładny regex w teście), zawiera „szczegóły przy pierwszej rozmowie";
- netlify.toml ma redirect `/p/*`; vite.config ma input.
GREEN: strona (treść wg spec §5 — pełny HTML pisany na tym etapie, wzorzec
markupu z blaty-ze-spieku.html), vite.config, netlify.toml, `npm run sitemap`.
Commit: „Partnerski 5/6: strona dla-partnerow + /p/KOD + sitemap".

### Etap 6: panel Partnerzy
RED (smoke):
- POST zapisz {nazwa, kod:'kowalski', typ} → 200; drugi raz ten sam kod → 400;
  bez ciasteczka → 401; przełączenie na premium działa.
- konfig: POST {procPierwsze:12, dni:30} zapisuje; proc 60 → 400; GET partnerzy
  zwraca konfig i liczniki.
- rozliczenie: scenariusz — partner standard, 3 karty z partner_kod, netto
  10000/20000/30000 (brutto 8%), wygrane: 2 w 2026-10, 1 w 2026-11 →
  `?miesiac=2026-10` = 15%×10000 + 10%×20000 = 3500; `2026-11` = 10%×30000
  = 3000; po przełączeniu na premium 2026-11 = 15%×30000 = 4500.
- apiZmien z partnerKod przypisuje/odpina (walidacja po tabeli).
GREEN: trasy + partnerzy-baza (rozliczenie) + UI panelu (lista/formularz/konfig/
tabela rozliczenia — wzorzec sekcji Wyprzedaż). Commit: „Partnerski 6/6:
zakladka Partnerzy w panelu — prowizje i rozliczenie miesieczne".

### Finał
Pełny `npm test` (baseline + nowe, zero nowych porażek), `npm run przeglad`
jeśli dotyczy frontu, aktualizacja notatki GOTOWE-DO-PUSHA, raport.
Deploy: zmiany obejmują WORKERA i STRONĘ → `wdroz-mail-edycja.bat`
(push + build + wrangler). Po wdrożeniu: ręczny smoke na produkcji
(?p=test → lead testowy → karta z partnerem → sprzątnięcie), zgłoszenie
/dla-partnerow do indeksowania w GSC.

## Interfejsy między etapami (dokładne)

- `KONFIG_DOMYSLNA = { procPierwsze:15, procKolejne:10, procPremium:15, podstawa:0, dni:365 }`
- `konfigPartnerska(env) → Promise<KONFIG>` (ustawienia ∪ domyślne; używana w etapach 3 i 6)
- `stawkaProwizji({premium:boolean, pierwsze:boolean, konfig}) → number` (%)
- `nettoZlecenia(dane|null, kwotaFallback:number) → {netto:number, zPodgladu:boolean}`
- `prowizja(netto:number, procent:number) → number` (zł, Math.round)
- `kodWazny({od:number, teraz:number, dni:number}) → boolean`
- `poprawnyKod(kod:unknown) → boolean` (regex `^[a-z0-9-]{3,24}$`)
- `partnerPoKodzie(env, kod) → Promise<{id,nazwa,kod,typ,status,aktywny}|null>`
- front `partnerDoLeada(storage?, teraz?) → {kod:string, od:number}|null`

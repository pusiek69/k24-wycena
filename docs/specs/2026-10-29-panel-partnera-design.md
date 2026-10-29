# Panel partnera + prowizja na żywo (faza 2 programu) — projekt

Data: 2026-10-29 · Ścieżka: architectural · Status: CZEKA NA AKCEPTACJĘ DAWIDA
Fundament: MVP fazy 1 (spec 2026-10-26) + indywidualne stawki per partner.

## 1. Zakres

1. **Panel partnera bez haseł** — osobisty link podpisany HMAC, strona mobilna
   z kafelkami i listą prowizji.
2. **Prowizja na żywo w kalkulatorze** — pasek widoczny WYŁĄCZNIE dla partnera
   uwierzytelnionego tokenem (nie dla klienta z kodem polecającym).
3. **Status „wypłacone"** — odhaczanie w rozliczeniu miesięcznym Dawida.

Twarde zasady: zero danych kontaktowych klientów i kwot zleceń u partnera;
zero stawek globalnych i cudzych; silnik wyceny/lejek nietknięte.

## 2. Autoryzacja partnera — link bezterminowy, ODNAWIALNY

- Podpis: `podpisz(PANEL_HASLO, 'partner|idPartnera|wersjaLinku')` — ta sama
  formuła HMAC co linki właściciela, ale bez `exp`; bezterminowość jest
  bezpieczna, bo w podpisie siedzi **wersja linku** (nowa kolumna
  `partnerzy.link_wersja INTEGER NOT NULL DEFAULT 1`).
- **Odnowienie/unieważnienie**: przycisk w zakładce Partnerzy podbija wersję —
  wszystkie stare linki tego partnera umierają natychmiast (jak zmiana hasła
  dla ciasteczek). Zmiana PANEL_HASLO unieważnia wszystko globalnie.
- Format: `https://kam24h.pl/partner#<b64url{p:id, w:wersja, podpis}>` —
  wszystko we FRAGMENCIE (nie wychodzi w referrerze/logach).
- Zakładka Partnerzy: przycisk **„Link dla partnera"** przy każdym wierszu
  (kopiuje gotowy adres; Dawid wysyła raz, SMS-em/mailem) + „unieważnij linki".

## 3. Panel partnera — strona `partner.html` + trasa workera

- `POST /partner/panel {p, w, podpis}` → weryfikacja (partner istnieje,
  `aktywny=1`, wersja się zgadza, podpis HMAC stały-czasowo) → dane; inaczej
  403 bez szczegółów. Strona statyczna w Vite (jak dla-partnerow), moduł
  `src/app/panel-partnera.js` czyta fragment, woła workera, renderuje.
- **Dane w odpowiedzi (i TYLKO te):**
  - nagłówek: `nazwa`, `kod`, status (Standard/Premium),
  - **stawki partnera** (efektywne, po dziedziczeniu — jego własne liczby:
    „pierwsze zlecenie X% · kolejne Y%" + „Premium Z%" gdy premium); bez
    informacji, czy to stawka indywidualna czy globalna,
  - kafelki: **Uzbierane łącznie** (suma prowizji wygranych), **W tym
    miesiącu**, **Wypłacone łącznie**, **Zleceń w toku** (liczba kart
    partnera w statusach nowy/ciepły/pomiar/oferta — bez kwot),
  - pozycje (wygrane, od najnowszej): `data`, klient **dyskretnie: samo imię
    + miejscowość**, `status` (zrealizowane / wypłacone), `prowizja zł`;
    osobna sekcja „W realizacji": imię + miejscowość + data zgłoszenia,
    bez żadnych kwot (prowizja powstaje dopiero przy wygranej).
- **CZEGO NIE MA w odpowiedzi (testy privacy):** telefonów, e-maili, kwot
  zleceń/netto, stawek globalnych (`partnerProc*` z ustawień jako osobne
  pola), danych innych partnerów, statusów lejka poza podziałem
  w-toku/zrealizowane, identyfikatorów kart (id klientów zastąpione
  indeksem pozycji).
- Mobile-first: kafelki 2×2, lista jednokolumnowa, duża typografia; estetyka
  spójna ze stroną (Cormorant w nagłówku, złote akcenty).

## 4. Prowizja na żywo w kalkulatorze — bezpieczny tryb partnera

- **Wejście do trybu WYŁĄCZNIE z panelu partnera**: przycisk „Otwórz
  kalkulator w trybie partnera" → `https://kam24h.pl/#partner=<ten sam
  token b64>`. Zwykły klient z `?p=KOD` tokenu nie ma i nie zgadnie —
  podpis HMAC; sam kod polecający NIGDY nie włącza paska.
- Front (`src/app/partner-widok.js`): parsuje `#partner=`, weryfikuje token
  przez `POST /partner/panel` (ta sama trasa; przy okazji dostaje stawki),
  trzyma tryb w **sessionStorage** (żyje w tej karcie przeglądarki, nie
  przenosi się linkiem ani na inne karty), czyści fragment z adresu po
  odczycie. Tryb partnera USTAWIA też zwykły kod partnerski (`k24h-partner`),
  więc wycena z tej sesji przypisze klienta do partnera jak z linku.
- **Pasek** (dyskretny, nad/pod podsumowaniem wyceny): „Twoja prowizja od tej
  wyceny: ~X zł (orientacyjnie, od wartości netto)" — liczona stawką
  „kolejne" partnera od netto bieżącej kwoty; dopisek „za pierwsze wygrane
  zlecenie: Y%" gdy stawki się różnią (która stawka naprawdę wejdzie, zależy
  od historii w chwili wygranej — pasek jest orientacyjny i tak go
  podpisujemy). Przycisk „ukryj" (partner bywa przy kliencie ze swoim
  ekranem); stan ukrycia w sessionStorage.
- Testy privacy: bez tokenu pasek nie istnieje w DOM (nie „ukryty CSS-em");
  `?p=KOD` sam w sobie nie tworzy paska; stawki nie trafiają do localStorage.

## 5. Status „wypłacone"

- Nowa tabela:
  ```sql
  CREATE TABLE IF NOT EXISTS partner_wyplaty (
    klient_id INTEGER PRIMARY KEY,   -- wygrane zlecenie rozliczone z partnerem
    partner_kod TEXT NOT NULL,
    wyplacono TEXT NOT NULL          -- data odhaczenia (YYYY-MM-DD)
  );
  ```
  Derywacyjne naliczanie zostaje; „wypłacone" to fakt dopisany do pozycji
  (JOIN przy rozliczeniu i w panelu partnera).
- Panel Dawida, rozliczenie miesięczne: **checkbox per pozycja** + przycisk
  **„Oznacz miesiąc jako rozliczony"** (wstawia wszystkie pozycje miesiąca);
  odhaczenie odwracalne (DELETE). Suma „do FV" pokazuje osobno pozycje
  wypłacone i niewypłacone.
- Kafelek partnera „Wypłacone łącznie" i status pozycji biorą się z tej tabeli.

## 6. Migracja D1 (plik `worker/migracje/2026-10-29-panel-partnera.sql`)

```sql
ALTER TABLE partnerzy ADD COLUMN link_wersja INTEGER NOT NULL DEFAULT 1;
CREATE TABLE IF NOT EXISTS partner_wyplaty (...);  -- jak wyżej
```
Wykonanie jak poprzednie (dashboard D1 / --command) — zaznaczone w raporcie.

## 7. Mapa plików

| Plik | Nowy? | Rola |
|---|---|---|
| `worker/partnerzy-panel.js` | NOWY | podpisPartnera/weryfikacja, zestaw danych panelu partnera (filtr privacy W JEDNYM miejscu), wypłaty |
| `worker/worker.template.js` | zmiana | trasa `POST /partner/panel` |
| `worker/panel.js` | zmiana | przycisk „Link dla partnera" + „unieważnij", checkboxy wypłat w rozliczeniu |
| `partner.html` + `src/app/panel-partnera.js` | NOWE | strona panelu partnera (Vite input, noindex!) |
| `src/app/partner-widok.js` + wpięcie w podsumowanie wyceny | NOWE/zmiana | tryb partnera + pasek prowizji |
| `worker/schema.sql`, migracja | zmiana/NOWY | link_wersja + partner_wyplaty |
| `scripts/test-partner-panel.mjs` + smoke | NOWE/zmiana | podpisy, privacy, wypłaty, co do złotówki |

`partner.html`: `robots noindex` + wpis WYKLUCZONY z sitemapy (strona
prywatna, choć bez sekretów w samym HTML).

## 8. Etapy TDD (commit po każdym)

1. Podpis + trasa `/partner/panel` z pełnym filtrem privacy (RED: podpis
   zły/stara wersja/nieaktywny → 403; odpowiedź bez telefonów/maili/kwot
   zleceń/stawek globalnych; kwoty prowizji co do złotówki na scenariuszu
   z fazy 1).
2. Strona partner.html (mobile; testy źródłowe: noindex, brak twardych kwot).
3. Wypłaty: tabela + checkboxy + „oznacz miesiąc" + statusy w obu panelach.
4. Tryb partnera w kalkulatorze + pasek (testy: bez tokenu brak paska w DOM,
   `?p=` nie włącza, sessionStorage nie localStorage).
5. Zakładka Partnerzy: „Link dla partnera" + unieważnianie (bump wersji
   ubija stary token — test).
6. Finał: pełny pakiet, migracja w raporcie, notatka do pusha.

## 9. Rozważone warianty

- **Logowanie hasłem/kontem** — odpada: tarcie przy wdrażaniu partnerów,
  utrzymanie haseł; link podpisany = ten sam model co oferta klienta.
- **exp w tokenie partnera** — odpada: link „umiera co X dni" frustruje;
  odnawialność przez wersję daje kontrolę bez terminów.
- **Pasek prowizji z samego `?p=`** — ODRZUCONE twardo: kod polecający jest
  publiczny (klient ma go w URL), pokazywałby prowizję klientom.
- **Ledger wypłat per miesiąc zamiast per zlecenie** — odpada: Dawid czasem
  wypłaci jedną pozycję wcześniej; per zlecenie jest odwracalne i proste.

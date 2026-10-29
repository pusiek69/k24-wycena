# GOTOWE DO PUSHA: wstecz + SEO + maile + dyktando + PROGRAM PARTNERSKI (26.10.2026)

Notatka koordynacyjna — nie commitować, skasować po pushu. Paczka RUSZA WORKERA
**I BAZĘ D1**, więc kolejność:

1. **NAJPIERW migracja bazy** (nowa tabela partnerów + 2 kolumny klientów;
   bezpieczna przy starym workerze, konieczna dla nowego):
   `npx wrangler d1 execute k24h-crm --remote --file worker/migracje/2026-10-26-partnerzy.sql`
   (z `CLOUDFLARE_ACCOUNT_ID=…` jak zwykle przy błędzie 7403)
2. potem jeden klik **`wdroz-mail-edycja.bat`** (push + build workera + wrangler deploy):

```
56ece4f Nawigacja wstecz w drzewku materialu (rozmowa)
03858df Test sezonowy: dekor wylacznie promocyjny to Calacatta Modane
3fe0879 SEO: tytul strony kolekcji konglomeratu pod pelna fraze wolumenowa
37076f4 Sitemap: lastmod po zmianie tytulu /blaty-z-konglomeratu
2aed1c1 Dziennik SEO: wpis 26.10
6beb9d9 Przycisk 'Edytuj te wycene' we WSZYSTKICH mailach do Dawida  ← worker!
a5d67cd Dyktando: przejrzyste komunikaty bledow                      ← worker!
```

## 4. Dyktando — diagnoza „nie udało się rozpoznać"
PRZYCZYNA (log workera): wyczerpany MIESIĘCZNY LIMIT WYDATKÓW klucza
Anthropic — wróci 1.11, albo wcześniej po podniesieniu limitu w
console.anthropic.com → Billing. **Leży też asystent czatu (/chat = 502)**;
kalkulator ratuje kreator awaryjny. Kod teraz mówi wprost o limicie
(i osobno o kluczu/modelu/przeciążeniu); błędy mikrofonu (cisza/sieć/brak
urządzenia) też mają osobne rady. Testy: 43/43 dyktando, pakiet 775/23.

## 3. Przycisk edycji we wszystkich mailach ownerowych (worker)
- Ten sam podpisany link HMAC (7 dni, fragment URL) teraz też w mailu
  z wiadomością klienta spod oferty i w NOWYM mailu o feedbacku
  („pasuje / za drogo / zastanowię się" — dotąd tylko notatka w panelu).
- Link z oferty niesie parametry TEJ wyceny + token wątku → edycja
  publikuje nową wersję pod linkiem, który klient już ma.
- Feedback bez rozpoznanej karty nie wysyła maila (anty-bot); awaria
  maila nie psuje zapisu feedbacku.
- Testy: 4 nowe w smoke (54/54), w tym parasolowy — żaden mail do
  klienta nie niesie #powtorz / przycisku / podpisu.

## 1. Nawigacja wstecz (rozmowa; kreator awaryjny miał „← Wstecz" od dawna)
- kategoria: „← Kuchnia czy łazienka?", marki: „← Inny rodzaj kamienia",
  dekory + wyprzedaż: „← Inne kolekcje", wyszukiwarka kamienia: „← Inny rodzaj
  kamienia", wymiary/szczegóły: „← Zmień materiał (wymiary zostają)".
- Nowe kroki `pomieszczenie:wstecz` i `material:wstecz` kasują TYLKO to, co
  unieważnia cofnięcie; **wymiary, odcinki i szczegóły zostają**. Dotyk 48 px.
  Silnik wyceny/ceny/lejek — zero zmian. Test: `scripts/test-nawigacja-wstecz.mjs`.

## 2. SEO — odblokowanie pushów (czerwone testy od 20.10) + K6
- Test sezonowy: asercja wskazuje Calacatta Modane (jedyny dekor Avanta
  tylko z ulotki) zamiast „Botticiono Burges", który po naprawie literówki
  jest dekorem katalogowym.
- /blaty-z-konglomeratu: zatwierdzony tytuł „Blaty z konglomeratu kwarcowego —
  wzory i wycena online" + opis z „Wycena online w 2 minuty" (HTML + generator
  `scripts/strona-konglomeraty.mjs` + dopasowany test kanibalizacji).
- Sitemap lastmod 26.10 dla tej strony.
- /blaty-ze-spieku NIE ruszane — frazy cenowe („cena za m²", „Wycena online
  w 2 minuty") są tam już od K1/K9 na produkcji.

## Testy
770 zielonych (w tym 4 nowe) / 23 znane esbuildowe sandboksa — zero nowych
porażek. Na Windowsie `npm test` powinien być w komplecie zielony.

## Po pushu (zgłoś mi — zrobię)
1. Weryfikacja produkcji: title/description/H1 na /blaty-z-konglomeratu
   i /blaty-ze-spieku + klik przez flow wstecz na telefonie.
2. GSC: Sprawdzenie URL → „Poproś o zindeksowanie" dla obu adresów
   (przez Twojego Chrome'a).
3. Skasować tę notatkę.

## 5. PROGRAM PARTNERSKI — MVP (6 commitów, spec zaakceptowany 3× TAK)
```
827d9e6 Partnerski 1/6: reguly prowizji i waznosci kodu
eb1758e Partnerski 2/6: schema, szczelnosc publicznych ustawien, stempel wygranej
fdd5994 Partnerski 3/6: link ?p=KOD przypisuje klienta (365 dni, konfig)
af8e81d Partnerski 4/6: formularz zgloszenia (/partner) - mail + karta CRM
b0872a6 Partnerski 5/6: strona /dla-partnerow + /p/KOD + sitemap
c24e2ab Partnerski 6/6: zakladka Partnerzy w panelu - prowizje i rozliczenie
```
- Prowizja: 15% pierwsze wygrane → 10% kolejne → Premium 15%; od CAŁOŚCI
  netto PO rabacie; wszystko konfigurowalne w panelu (zakładka Partnerzy),
  stawki NIEJAWNE (publiczny /ustawienia odfiltrowany + testy strony).
- Link partnera: kam24h.pl/p/KOD → ?p=KOD → localStorage; o ważności
  (domyślnie 365 dni) decyduje worker wg konfiguracji; pierwszy kod wygrywa.
- Naliczanie od statusu „Wygrany" (nowa data `wygrany_kiedy`), zestawienie
  miesięczne do FV w panelu.
- Silnik wyceny, lejek leadów i GA4 — nietknięte (testy regresyjne zielone).

## 6. CENY ARCHITYPE WPROST (29.10.2026) — commit eaf1bd0
Avant + Keralini + Caesarstone: cennik 2026 jest detaliczny, mnożnik 1,30
dublował marżę → teraz 1,0 (Monaco 1388→1068 netto/m²). Promocje X–XII bez
zmian (×1,45; wszystkie 46 pozycji nadal tańsze od nowego cennika).
**PRZED PUSHEM na Windowsie:** `npm run ceny:tresc` (progi „od" na stronach;
wymaga esbuild), potem `npm test` i commit przeliczonych stron — inaczej
progi na stronach zostaną stare (zawyżone).

## Po pushu (zgłoś mi — zrobię)
- weryfikacja produkcji: /dla-partnerow (tytuł/treść/formularz testowy),
  /p/test → ?p=, panel → zakładka Partnerzy (dodanie partnera testowego,
  lead testowy z jego linku, sprzątnięcie),
- GSC: zgłosić /dla-partnerow, /blaty-z-konglomeratu i /blaty-ze-spieku.

## 7. ROZKRÓJ RĘCZNY (29.10) — commit 14909d6
Pusta płyta znika też na końcu listy (zostaje tylko jedyna), jawny przycisk
„× Usuń pustą płytę", drag nie kasuje świeżo dodanych arkuszy; ostrzeżenie
o różnicy płyt względem wyceny bez zmian (cena nie zmienia się sama).
Front — wchodzi w ten sam push strony.

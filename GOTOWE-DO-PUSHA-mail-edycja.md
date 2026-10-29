# GOTOWE DO PUSHA + WRANGLER: link „Edytuj tę wycenę" w mailu leadowym (22.10)

Notatka koordynacyjna — nie commitować, skasować po wdrożeniu.

```
b592272 Mail leadowy: podpisany link Edytuj te wycene dla Dawida
```

## ⚠⚠ PUSH TO ZA MAŁO — TO ZMIANA WORKERA ⚠⚠
`wyslij-zmiany-strony.bat` wdraża tylko stronę (Netlify). Mail leadowy wysyła
WORKER — żeby przycisk pojawił się w mailach, po pushu trzeba na komputerze:

```bash
npm run worker && node --test scripts/test-worker-smoke.mjs && npx wrangler deploy
```

(przy błędzie 7403: `CLOUDFLARE_ACCOUNT_ID=<id> npx wrangler deploy`,
id pokaże `npx wrangler whoami`).

## Co robi
W mailu „Nowe zgłoszenie" do Dawida, zaraz pod ciemną kartą z telefonem,
stoi pełnej szerokości złoty przycisk **„✏️ Edytuj tę wycenę"** (wygodny
na telefonie) + drobny druk „bez logowania · link ważny 7 dni, potem
normalnie przez panel". Link = dokładnie mechanizm „Powtórz wycenę"
z panelu: `https://kam24h.pl/#powtorz=…` z HMAC `oferta|leadId|exp`
z hasła panelu, parametry wyceny klienta w środku, wszystko we fragmencie
(#…, nie wychodzi w referrerze). Żadnych haseł w linku — sam podpis.

## Zmiana kolejności w /lead (świadoma)
Zapis do bazy teraz PRZED mailami (link potrzebuje id karty). Gwarancja
z poprzedniej kolejności zachowana i pokryta testem: przy awarii bazy oba
maile i tak wychodzą — po prostu bez przycisku.

## Testy (smoke 50/50, pakiet 760 zielonych + 23 znane esbuildowe)
- mail Dawida: przycisk, „ważny 7 dni", link dekoduje się do
  {leadId z bazy, exp≈7 dni, podpis == formuła panelu, parametry wyceny},
  hasła panelu w ładunku brak,
- **mail KLIENTA: zero `#powtorz`, zero podpisu, zero przycisku** (test),
- awaria bazy → 2 maile bez przycisku (test).

## Ścieżka awaryjna Netlify Forms — ŚWIADOMIE bez przycisku
Zapasowy formularz wysyła przeglądarka prosto do Netlify, bez workera.
Podpis wymaga hasła panelu, a sekret nie ma prawa trafić do przeglądarki —
więc tam linku nie będzie (i nie powinno być). Awaryjny mail = jak dotąd.

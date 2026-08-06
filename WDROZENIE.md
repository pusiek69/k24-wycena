# Wdrożenie na kam24h.pl — instrukcja krok po kroku

Wszystko, co trzeba kliknąć. Ja przygotowałem kod i repozytorium; poniższe
kroki wymagają Twojego logowania, więc robisz je Ty — mogę siedzieć obok
i mówić, co dalej.

**Stan na dziś:** kod jest w **publicznym** repozytorium
`https://github.com/pusiek69/k24-wycena` (gałąź `main`). Publiczne, bo darmowy
plan Netlify buduje prywatne repozytoria tylko dla jednego, połączonego konta.
Poza repozytorium zostają: ceny zakupowe i rabaty (`pricing/zrodla/`),
wytyczne konsultanta (`worker/prompt.local.md`) oraz wszystkie klucze API.
Domena `kam24h.pl` jest zaparkowana u nazwa.pl — nic tam nie ma do stracenia.

---

## 1 · Netlify — podłączenie repozytorium (5 minut)

1. Wejdź na **app.netlify.com** i zaloguj się swoim kontem.
2. **Add new site → Import an existing project → GitHub**.
3. Przy pierwszym razie Netlify poprosi o dostęp do GitHuba — wybierz
   **Only select repositories** i wskaż `k24-wycena`.
4. Wybierz repozytorium `pusiek69/k24-wycena`.
5. Ustawienia builda (powinny podstawić się same z pliku `netlify.toml`):

   | Pole | Wartość |
   |---|---|
   | Branch to deploy | `main` |
   | Build command | `npm run build` |
   | Publish directory | `dist` |
   | Functions directory | *(puste — backend jest na Cloudflare)* |

6. **Deploy site.** Po minucie strona żyje pod adresem typu
   `losowa-nazwa.netlify.app`. Sprawdź, czy działa, zanim podepniesz domenę.

### Zmienne środowiskowe

Strona **nie potrzebuje żadnych kluczy** — cała część z kluczami siedzi
w Cloudflare Workerze. Jedyna opcjonalna zmienna:

| Nazwa | Kiedy potrzebna |
|---|---|
| `VITE_API_BASE` | tylko gdy zmieni się adres Workera (domyślnie `https://k24h.kamieniarstwo24h.workers.dev`) |

### Powiadomienia o zgłoszeniach

**Site configuration → Forms → Form notifications → Add notification →
Email notification** → formularz `pomiar` → adres `kamieniarstwo24h@gmail.com`.

To jest droga zapasowa: normalnie maile wysyła Worker przez Resend, ale gdyby
Worker nie odpowiadał, zgłoszenie i tak trafi tutaj. Warto mieć włączone.

---

## 2 · Domena kam24h.pl — rekordy DNS w nazwa.pl

Kalkulator ma stać na **domenie głównej** `https://kam24h.pl`, a `www`
ma na nią przekierowywać. Przekierowanie jest już wpisane w `netlify.toml`,
więc po stronie Netlify nie trzeba nic klikać poza ustawieniem domeny głównej.

### Krok 1 — dodaj domenę w Netlify

**Site configuration → Domain management → Add a domain** → wpisz `kam24h.pl`.
Netlify od razu pokaże, jakie rekordy wpisać — **przepisuj wartości z panelu**,
bo bywają różne dla różnych kont. Poniżej typowy układ.

Dodaj też `www.kam24h.pl` i ustaw `kam24h.pl` jako **Primary domain**
(przy drugiej domenie: **Options → Set as primary domain**). Wtedy Netlify
sam traktuje `www` jako alias, a nasza reguła 301 domyka sprawę.

### Krok 2 — rekordy w panelu nazwa.pl

Zaloguj się do **panel.nazwa.pl** (Active.admin) i wejdź w konfigurację DNS
domeny `kam24h.pl`. W nazwa.pl edytor stref DNS jest dostępny tylko wtedy,
gdy domena korzysta z **serwerów DNS nazwa.pl** — jeśli panel o tym przypomni,
najpierw przełącz domenę na ich serwery nazw.

Docelowo mają być dwa rekordy:

| Typ | Nazwa (host) | Wartość | TTL |
|---|---|---|---|
| `A` | `@` — czyli sama `kam24h.pl` | `75.2.60.5` | 3600 |
| `CNAME` | `www` | `<nazwa-strony>.netlify.app` | 3600 |

- `<nazwa-strony>` to adres, który Netlify nadał stronie po pierwszym
  wdrożeniu (widać go u góry panelu, np. `kam24h-wycena.netlify.app`).
- **Jeśli w edytorze nazwa.pl jest do wyboru `ALIAS` albo `ANAME`** — użyj go
  dla `@` zamiast rekordu `A` i wskaż `<nazwa-strony>.netlify.app`.
  To lepsze rozwiązanie: przetrwa ewentualną zmianę adresów IP po stronie
  Netlify. Jeśli takiego typu nie ma na liście, zostaw `A` — działa tak samo,
  tylko wymaga poprawki, gdyby Netlify kiedyś zmienił adres.

### Krok 3 — usuń stare wpisy

To najczęstsza przyczyna „raz działa, raz nie":

- skasuj istniejące rekordy `A` dla `@` i `www` wskazujące na serwer
  parkingowy nazwa.pl (dziś domena pokazuje ich stronę „Domena kam24h.pl
  jest utrzymywana na serwerach nazwa.pl"),
- wyłącz ewentualne **przekierowanie WWW** albo „parking domeny",
  jeśli nazwa.pl ma je włączone dla tej domeny,
- **rekordów `MX` nie ruszaj**, jeśli masz na tej domenie pocztę —
  zmiana `A` i `CNAME` nie ma na nią wpływu.

### Krok 4 — certyfikat

Po propagacji (zwykle 15 minut do 2 godzin, czasem dłużej) w Netlify:
**Domain management → HTTPS → Verify DNS configuration**, a potem
**Provision certificate**. Certyfikat Let's Encrypt jest darmowy i odnawia się
sam. Od tej chwili `https://kam24h.pl` działa z zieloną kłódką.

> Dla porównania: na `k24h.pl` HTTPS dziś **nie działa** — certyfikat jest
> wystawiony na `*.nazwa.pl`, więc przeglądarka straszy ostrzeżeniem.
> Na `kam24h.pl` tego problemu nie będzie.

### Jak sprawdzić, że wszystko wskoczyło

W wierszu poleceń (albo poproś mnie, sprawdzę):

```
nslookup kam24h.pl          → ma pokazać 75.2.60.5 (albo adres z panelu Netlify)
nslookup www.kam24h.pl      → ma prowadzić do <nazwa-strony>.netlify.app
```

Potem w przeglądarce: `https://kam24h.pl` pokazuje kalkulator,
a `https://www.kam24h.pl` przeskakuje na adres bez `www`.

---

## 3 · Cloudflare Worker — jedna zmiana po podpięciu domeny

Worker przyjmuje zapytania tylko z naszej strony. Po uruchomieniu domeny:

**Cloudflare → Workers & Pages → Twój worker → Settings → Variables and
Secrets → `ALLOWED_ORIGIN`** — ustaw:

```
https://kam24h.pl,https://www.kam24h.pl
```

Bez tego rozmowa z konsultantem i wysyłka zgłoszeń będą blokowane.
Przy okazji sprawdź, czy są ustawione: `ANTHROPIC_API_KEY`, `RESEND_API_KEY`,
`LEAD_EMAIL`. Nie podawaj mi tych wartości — mają zostać wyłącznie u Ciebie.

### Wgrywanie kodu — przez wrangler, nie przez wklejanie

Kodu **nie wkleja się już ręcznie** w edytorze Cloudflare (25 kB przez
przeglądarkę to proszenie się o ucięty plik). W repozytorium jest
`wrangler.toml`, więc aktualizacja to dwie komendy:

```bash
npm run worker        # generuje worker/worker.js z szablonu + cenników
npx wrangler deploy   # wysyła do Cloudflare
```

Logowanie (`npx wrangler login`) robi się raz — otwiera przeglądarkę,
klikasz **Allow**, token ląduje lokalnie na Twoim komputerze.

Dwie rzeczy zabezpieczone w `wrangler.toml`, o których łatwo zapomnieć:

- **`keep_vars = true`** — bez tego `wrangler deploy` uznaje plik konfiguracyjny
  za źródło prawdy i **kasuje zmienne ustawione w panelu**, czyli `ALLOWED_ORIGIN`.
  Sekrety (klucze API) przetrwałyby, ale czat i tak przestałby działać.
- **`preview_urls = false`** — żeby każda wersja nie dostawała własnego
  publicznego adresu. Rozmowa z konsultantem kosztuje; jedno wejście wystarczy.

Sprawdzenie, czy poszła nowa wersja — nowy kod odpowiada po polsku:

```bash
curl https://k24h.kamieniarstwo24h.workers.dev/
# {"error":"Tylko POST."}  ← nowa wersja
# {"error":"Method not allowed"}  ← jeszcze stara
```

---

## 4 · Jak od teraz wprowadzać zmiany

Po podpięciu repozytorium **każda zmiana w kodzie = automatyczne wdrożenie**:

```
zmiana w plikach  →  git commit  →  git push  →  Netlify buduje i publikuje
```

W praktyce, po naszej rozmowie i poprawkach:

```bash
git add -A
git commit -m "krótki opis zmiany"
git push
```

Po ~minucie zmiana jest na `kam24h.pl`. W Netlify widać historię wdrożeń
i **jednym kliknięciem można cofnąć się do poprzedniej wersji**
(Deploys → wybrany deploy → Publish deploy) — gdyby coś poszło nie tak.

Zmiany w cennikach robisz narzędziem (`start-cennik.cmd`), potem `git push`.
Zmiany w zachowaniu konsultanta: `worker/prompt.local.md` → `npm run worker`
→ `npx wrangler deploy` (Worker nie wdraża się z GitHuba — trzeba go
wysłać osobno, ale to jedna komenda).

---

## 5 · Zgodność z prawem — co jest, a czego brakuje

### Jest ✅

| Wymóg | Gdzie |
|---|---|
| Polityka prywatności z administratorem, adresem i NIP | `/polityka-prywatnosci.html` |
| Podstawy prawne przetwarzania (art. 6 RODO) przy każdej kategorii danych | tamże, pkt 2 |
| Okresy przechowywania danych | pkt 3 |
| Lista odbiorców danych (Netlify, Anthropic, Google, Meta, poczta) | pkt 4 |
| Informacja o transferze poza EOG i standardowych klauzulach | pkt 4 |
| Tabela cookies z podziałem na niezbędne / analityczne / marketingowe | pkt 5 |
| Prawa osoby, której dane dotyczą + skarga do PUODO | pkt 6 |
| Informacja o braku automatycznych decyzji | pkt 7 |
| Baner zgód z realnym wyborem, przed załadowaniem jakichkolwiek tagów | Consent Mode v2 |
| Możliwość wycofania zgody | link „Ustawienia cookies" w stopce |
| Zgoda na kontakt przy formularzu, z linkiem do polityki | bramka kontaktowa |
| Minimalizacja danych (imię, telefon, e-mail, miejscowość) | formularz |
| Zastrzeżenie, że wycena nie jest ofertą (art. 66 §1 KC) | stopka i karta wyceny |
| Informacja o przetwarzaniu treści rozmowy z konsultantem AI | polityka, pkt 2 i 4 |

### Brakuje — do uzupełnienia ⚠

1. **Dane rejestrowe spółki (art. 206 KSH).** Spółka z o.o. musi podawać
   w pismach i na stronie: firmę, siedzibę i adres, **sąd rejestrowy i numer
   KRS**, NIP oraz **wysokość kapitału zakładowego**. Mamy firmę, adres i NIP —
   **brakuje KRS i kapitału zakładowego**. Podaj mi te dwie wartości, dopiszę
   je do stopki i polityki (5 minut).

2. **Regulamin świadczenia usług drogą elektroniczną.** Kalkulator i czat to
   usługa świadczona drogą elektroniczną, a ustawa (art. 8 u.ś.u.e.) wymaga
   udostępnienia regulaminu przed skorzystaniem. Musi określać m.in.: rodzaj
   usług, warunki korzystania, wymagania techniczne, zakaz dostarczania treści
   bezprawnych i **tryb reklamacji**. Mogę przygotować projekt, ale potrzebuję
   od Ciebie decyzji: w jakim czasie odpowiadasz na reklamacje (standard:
   14 dni) i na jaki adres mają wpływać.

3. **Umowy powierzenia przetwarzania (art. 28 RODO).** Netlify, Anthropic,
   Cloudflare, Resend i Google udostępniają standardowe DPA — trzeba je
   zaakceptować w panelach i zachować potwierdzenie. To formalność, ale przy
   kontroli jest pierwszą rzeczą, o którą pytają.

4. **Rejestr czynności przetwarzania.** Dokument wewnętrzny, nie publikujemy
   go na stronie — ale przy zbieraniu danych klientów powinien istnieć.
   Dla firmy Twojej wielkości to jedna tabelka.

5. **Zgodność adresu.** Na fanpage'u widnieje ul. Bema 227, w danych
   rejestrowych ul. Szpitalna 8. W polityce prywatności musi być adres
   zgodny z rejestrem — jest. Ale warto ujednolicić komunikację.

### Nie jest potrzebne

- **Prawo odstąpienia od umowy / regulamin sklepu** — nic nie sprzedajemy
  przez stronę, wycena nie jest ofertą ani zamówieniem.
- **Deklaracja dostępności** — dotyczy podmiotów publicznych.
- **Inspektor Ochrony Danych** — nie ma obowiązku przy tej skali i rodzaju
  przetwarzania.

---

## 6 · Kolejność, gdybym miał to robić za Ciebie

1. Netlify: import repo → deploy → sprawdzenie adresu `*.netlify.app`
2. Netlify: dodanie domeny `kam24h.pl`
3. nazwa.pl: rekordy DNS według wskazań Netlify (usunąć stary parking)
4. Netlify: certyfikat SSL, ustawienie `kam24h.pl` jako primary
5. Cloudflare: `ALLOWED_ORIGIN` na `https://kam24h.pl`
6. Test od początku: rozmowa → wycena → formularz → mail
7. Uzupełnienie KRS i kapitału zakładowego w stopce
8. Dopiero potem: GA4, Google Ads, piksel Meta (patrz `MARKETING.md`)

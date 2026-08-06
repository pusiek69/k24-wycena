# Kamieniarstwo 24h — kreator wyceny blatu

Kalkulator wyceny blatów z konsultantem AI. Klient rozmawia (albo klika kreator),
dostaje orientacyjną wycenę mailem, a firma — zgłoszenie z pełną transkrypcją.

**Adres docelowy:** https://kam24h.pl (Netlify, folder `dist/`)
**Repozytorium:** https://github.com/pusiek69/k24-wycena (prywatne, gałąź `main`)
**Kontakt w treści:** Dawid Ząbek · 796 991 128 · ul. Szpitalna 8, 39-400 Tarnobrzeg

---

Dokumenty w projekcie:
- **`WDROZENIE.md`** — jak podpiąć kam24h.pl, Netlify i co jeszcze trzeba prawnie
- **`ANALIZA.md`** — co było nie tak ze starą wersją i dlaczego
- **`MARKETING.md`** — plan uruchomienia reklam Google Ads i Facebook
- **`PYTANIA.md`** — czego nie zgadywałem, czeka na decyzje Dawida
- **`pricing/README.md`** — jak dodać nową firmę i cennik

---

## Uruchomienie

```bash
npm install       # tylko raz
npm run dev       # podgląd na http://localhost:5173 (odświeża się na żywo)
npm run build     # wersja produkcyjna → dist/ + kontrola tajemnicy handlowej
npm run preview   # podgląd tego, co pójdzie na Netlify
npm run cennik:dodaj  # ⬅ narzędzie „Dodaj cennik" (dwuklik: start-cennik.cmd)
npm run cennik    # przelicz cenniki po ręcznej zmianie rabatów
npm run podglad   # cała strona w jednym pliku HTML (do wysłania)
npm run worker    # składa plik Workera do wklejenia w Cloudflare
npm run checklist # weryfikacja zgodności ze specyfikacją (§8)
```

> **`podglad.html` to wersja offline.** Otwierany z dysku plik nie ma jak
> połączyć się z asystentem AI (ten działa na serwerze), więc pokazuje kreator
> i wyraźną informację w rogu. Do obejrzenia czatu potrzebna jest strona
> uruchomiona przez `npm run dev` albo wgrana na Netlify.

Szybciej: kliknij dwa razy **`start.cmd`** — sam uruchomi podgląd i otworzy przeglądarkę.

---

## Najważniejsza zasada: ceny zakupowe nie trafiają do klienta

```
pricing/zrodla/<firma>.zasady.json     ← TAJNE: cennik katalogowy + rabat + marża
        │                                 (poza gitem, poza Netlify, tylko na dysku Dawida)
        │   npm run cennik
        ▼
src/generated/<firma>.dekory.json      ← JAWNE: gotowa cena końcowa netto/m²
        │                                 (to widzi przeglądarka klienta)
        ▼
src/firms/<firma>.js  →  kreator
```

Z ceny końcowej nie da się odtworzyć rabatu — w przeglądarce nie ma ani ceny
katalogowej, ani mnożnika. Dodatkowo po każdym `npm run build` uruchamia się
`scripts/sprawdz-bundle.mjs`, który **przerywa build**, jeśli w plikach dla klienta
pojawi się słowo „rabat", „marża", „cena zakupu" itp.

> Opis metody liczenia trzymamy w **komentarzach** na dole plików firm —
> komentarze nie trafiają do bundla, więc można w nich pisać swobodnie.

---

## Dodawanie cennika — narzędzie dla Dawida

Najprostsza droga: **dwuklik w `start-cennik.cmd`** (albo `npm run cennik:dodaj`).
Otworzy się lokalna strona, na której:

1. wybierasz firmę z listy (albo wpisujesz nową),
2. **wklejasz tabelę z cennika** — prosto z Excela albo z PDF-a; narzędzie
   rozpoznaje rozdzielenie tabulatorem, średnikiem i spacjami,
3. podajesz **grubości** kolumn (np. `20, 30`), **rabat** i **marżę**,
4. klikasz „Sprawdź, co rozpoznałem" — widzisz podgląd z cenami dla klienta,
5. zapisujesz.

Narzędzie samo zapisuje trzy rzeczy:

| Plik | Co w nim jest | Kto to widzi |
|---|---|---|
| `pricing/zrodla/<firma>.zasady.json` | cennik katalogowy + rabat + marża | tylko Twój komputer (poza gitem) |
| `src/generated/<firma>.dekory.json` | gotowe ceny końcowe netto/m² | przeglądarka klienta |
| `src/firms/<firma>.js` | opis firmy dla kreatora i konsultanta | przeglądarka klienta |

Nową firmę kreator i konsultant zobaczą sami — nie trzeba nic dopisywać.
Po zapisaniu wystarczy `npm run build` i wgranie strony na Netlify
(oraz `npm run worker`, jeśli konsultant ma znać nowe dekory).

> ⚠ Narzędzie działa **tylko na tym komputerze** (adres 127.0.0.1) i nigdy
> nie trafia na Netlify — obsługuje rabaty, czyli tajemnicę firmy.

Ręczna droga (dla mnie albo gdy cennik ma nietypowy układ) jest opisana niżej.

---

## Jak dodać nową firmę ręcznie (np. kolejnego dostawcę)

Cała firma to **jeden plik** w `src/firms/`. Silnika wyceny się nie rusza.

1. **Cennik na dysk:** `Downloads\CENNIKI\<FIRMA>\cennik.pdf`
2. **Zasady handlowe** → `pricing/zrodla/<firma>.zasady.json`
   (wzór: `pricing/zrodla/_WZOR.zasady.json`) — tu wpisujesz ceny katalogowe,
   rabat zakupowy i marżę. Ten plik **nie jest w gicie**.
3. **Przelicz:** `npm run cennik` → powstaje `src/generated/<firma>.dekory.json`
4. **Plik firmy:** skopiuj `src/firms/caesarstone.js`, zmień `slug`, `nazwa`,
   `linkDekory`, wymiar płyty i ewentualnie stawki. Nic więcej — kreator sam
   zobaczy nową firmę (rejestr `src/firms/index.js` zbiera pliki automatycznie).
5. `npm run build` — jeśli przejdzie, można wrzucać na Netlify.

Pola pliku firmy opisane są w `pricing/README.md`.

---

## Stan na dziś

| Firma | Dekory | Cennik | Uwagi |
|---|---|---|---|
| Avant Quartz | 61 | cennik Architype 2026 | 2 kampanie promocyjne |
| Technistone | 54 | ceny wg specyfikacji | rabat i marża POTWIERDZONE — wartości w pricing/zrodla |
| Caesarstone | 24 | przeniesiony ze starej aplikacji | rabat do potwierdzenia |
| Keralini | 49 | przeniesiony ze starej aplikacji | rabat do potwierdzenia |
| Marazzi (Grande / The Top) | 129 | MARAZZI_2026_B2B.pdf | 12/20 mm, tylko całe płyty; EUR po 4,35 |
| Kamień naturalny (Interstone) | — | ceny z placu / stanu magazynowego | cena wpisywana ręcznie albo kontakt |

---

## Asystent AI + bramka kontaktowa

Sercem strony jest **rozmowa z konsultantem**. Kreator „w kilka pytań" został
jako druga ścieżka i jako wyjście awaryjne, gdy konsultant jest niedostępny.

### Kto co robi

```
przeglądarka klienta                    Cloudflare Worker
─────────────────────                   ──────────────────────────────
czat (src/app/czat.js) ──/chat──▶       wytyczne konsultanta + klucz Anthropic
kalkulator (src/engine) ◀─polecenie──   {"action":"quote","params":{…}}
bramka (src/app/bramka.js) ──/lead──▶   Resend: mail do klienta + zgłoszenie do firmy
```

**Konsultant nie zna cen i nie podaje kwot w rozmowie.** Gdy zbierze materiał,
dekor, wymiary i grubość, zwraca polecenie w JSON-ie, a wycenę liczy kalkulator
na stronie — tym samym silnikiem co kreator.

### Bramka kontaktowa

Kwota **nie pokazuje się od razu**. Po policzeniu wyceny klient widzi kartę
„Twoja wycena jest gotowa" i formularz: telefon, e-mail i miejscowość
(wymagane), opcjonalnie imię i plik z projektem do 8 MB. Dopiero po wysłaniu:

1. karta z ceną odsłania się na stronie,
2. klient dostaje wycenę mailem,
3. do firmy leci zgłoszenie z wyceną, transkrypcją rozmowy i załącznikiem.

Ta sama zasada obowiązuje w kreatorze — jedno zachowanie w obu ścieżkach.
Gdyby Worker nie odpowiadał, zgłoszenie idzie zapasowo przez Netlify Forms,
żeby nie zgubić kontaktu; dopiero gdy oba zawiodą, klient dostaje telefon.

### Worker — wgranie i utrzymanie

```bash
npm run worker     # składa worker/worker.js (wstrzykuje aktualne dekory)
```

Zawartość `worker/worker.js` wklejasz w Cloudflare (Workers → edytuj → Deploy).
**Wytyczne konsultanta edytujesz w `worker/prompt.local.md`** (plik poza repozytorium)
i uruchamiasz `npm run worker` ponownie.

Sekrety ustawia się raz w Cloudflare (Settings → Variables and Secrets):

| Sekret | Wartość |
|---|---|
| `ANTHROPIC_API_KEY` | klucz do Anthropic |
| `RESEND_API_KEY` | klucz do Resend (wysyłka maili) |
| `LEAD_EMAIL` | kamieniarstwo24h@gmail.com |
| `ALLOWED_ORIGIN` | https://kam24h.pl |
| `MAIL_FROM` | opcjonalnie, docelowo wycena@k24h.pl po weryfikacji domeny |

**Kluczy nie ma i nie może być w repozytorium.** Strona zna tylko adres Workera
(`src/api.js`); wytycznych konsultanta nie da się podejrzeć z przeglądarki —
build przerywa się, gdyby któreś zdanie tam trafiło.

Model: `claude-sonnet-4-6`, `max_tokens: 1000` — zgodnie ze specyfikacją.

### Zgodność ze specyfikacją

```bash
npm run checklist  # 19 sprawdzeń z §8 specyfikacji
```

---

## Reklama, pomiar i zgody

Strona jest przygotowana pod płatny ruch — szczegółowy plan w `MARKETING.md`.

**Wszystkie identyfikatory wkleja się w JEDNYM miejscu:** `src/analytics/config.js`
(GA4, Google Ads, konwersje, Meta Pixel). Dopóki pola są puste — żaden skrypt
się nie wczytuje i strona nie zostawia ciasteczek marketingowych.

Co już działa:

- **Baner zgód (Consent Mode v2)** — domyślnie wszystko zablokowane, tagi
  wczytują się dopiero po kliknięciu „Akceptuję". Wybór można zmienić linkiem
  w stopce. Bez tego Google Ads traci dane o konwersjach z Europy.
- **Lejek zdarzeń** — od wejścia w kreator po wysłany formularz.
- **Osobna strona `/dziekujemy.html`** — tam odpala się konwersja główna,
  więc liczą się tylko realnie wysłane zgłoszenia.
- **Polityka prywatności** — wymagana przez Google i Meta przy reklamach.
- **Meta tagi, Open Graph, dane strukturalne firmy, robots.txt, mapa witryny.**

### Formularz „umów bezpłatny pomiar" → mail

Zgłoszenia odbiera **Netlify Forms** — bez własnego serwera i bez kluczy API.

Żeby zgłoszenia przychodziły na `kamieniarstwo24h@gmail.com`, trzeba **raz**
kliknąć w panelu Netlify:

> Site configuration → **Forms** → Form notifications → Add notification →
> *Email notification* → formularz `pomiar` → adres `kamieniarstwo24h@gmail.com`

Ochrona przed spamem: pole-pułapka („honeypot") niewidoczne dla ludzi — bot je
wypełnia i Netlify odrzuca zgłoszenie. Bez CAPTCHY, żeby nie tracić klientów.

W mailu przychodzi: imię, telefon, miejscowość, uwagi i **podsumowanie wyceny**
z kreatora — nie trzeba niczego dopytywać na starcie rozmowy.

---

## Deploy na Netlify

W repo jest gotowy `netlify.toml` (komenda `npm run build`, folder `dist`).

- **Przez panel:** New site → import z Gita → Netlify sam odczyta `netlify.toml`.
- **Bez Gita:** `npm run build`, potem przeciągnij folder `dist/` na app.netlify.com/drop.
- **Z konsoli:** `npx netlify deploy --prod` (wymaga zalogowania na konto Dawida).

Netlify **nie potrzebuje** plików z `pricing/zrodla/` — buduje z gotowych
`src/generated/*.dekory.json`, które są w repo.

---

## Struktura

```
index.html                 kreator wyceny
dziekujemy.html            po wysłaniu formularza — tu liczy się konwersja
polityka-prywatnosci.html  RODO + cookies
worker/
  worker.template.js       kod Workera (bez wytycznych)
  prompt.local.md          ⬅ TU edytujemy wytyczne konsultanta (POZA gitem)
  worker.js                plik do wklejenia w Cloudflare (generowany)
src/
  main.js                  start aplikacji + przełącznik rozmowa/kreator
  style.css                cały wygląd
  app/
    czat.js                rozmowa z konsultantem
    bramka.js              bramka kontaktowa (cena po zostawieniu kontaktu)
    wynik-widok.js         karta wyceny — wspólna dla rozmowy i kreatora
    wizard.js, kroki.js    kreator: stan i kolejne ekrany
    dom.js                 pomocniki
  analytics/
    config.js              ⬅ TU wklejamy ID z Google i Facebooka
    zgody.js               baner zgód + Consent Mode v2
    zdarzenia.js           zdarzenia i konwersje
  engine/
    wycena.js              silnik — wspólny dla wszystkich firm
    pakowanie.js           ile płyt trzeba kupić na dane odcinki
  firms/
    _domyslne.js           stawki naszego zakładu (robocizna, obróbki)
    index.js               rejestr — zbiera pliki firm automatycznie
    <firma>.js             JEDEN plik = JEDNA firma
  generated/               ceny końcowe dla klienta (generowane)
public/                    logo, obrazek OG, robots.txt, mapa witryny
pricing/
  README.md                instrukcja dodawania firmy i opis pól
  zrodla/                  TAJNE zasady handlowe (poza gitem)
scripts/
  build-katalog.mjs        cennik zakupowy → cena dla klienta
  sprawdz-bundle.mjs       strażnik tajemnicy handlowej
  podglad-jednoplikowy.mjs jeden plik HTML do wysłania klientowi
  grafiki.ps1              logo i obrazek do social mediów
```

## Wydajność

Liczy się przy płatnym ruchu — wolna strona to droższe kliknięcia i mniej leadów.

| | stara wersja | teraz |
|---|---|---|
| Strona główna | 282 kB (logo wklejone w kod) | ~24 kB po kompresji |
| Logo | 161 kB, 471×600 px | 12 kB, 85×108 px |
| Zapytania do API przy starcie | tak (Cloudflare Worker) | brak |
| Czcionki z internetu | — | brak (systemowe) |

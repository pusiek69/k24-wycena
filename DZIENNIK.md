# DZIENNIK SEO — kam24h.pl

Pamięć między sesjami SEO. Każda sesja: przeczytaj od góry, dopisz wpis na górze
(najnowsze pierwsze). Szablon wpisu na dole pliku.

---

## 2026-10-09 (wieczorem) — nowa promocja Architype X–XII 2026 w kalkulatorze

Dawid wgrał ulotkę „PROMOCJE październik–grudzień 2026" i aktualny cennik Architype 2026.

**Relacja ustalona z obu PDF-ów:** promocja dotyczy **trzech kolekcji Architype, które już są w kalkulatorze** — Avant Quartz, Caesarstone, Keralini. Architype to nie nowy dostawca, tylko ten sam, z którego od sierpnia idą te trzy marki; reguła marży istnieje (`mnoznikRecznie: 1.3` w `pricing/zrodla/*.zasady.json`, decyzja Dawida z 25.08). Porównanie nowego cennika z naszym katalogiem: na 28 pozycjach, które udało się odczytać jednoznacznie, **zero rozbieżności** — cennik 2026 to ten sam dokument, z którego katalog powstał.

**Wdrożone:** kampania **01.10.2026 – 30.12.2026** („lub do wyczerpania zapasów"), **46 pozycji**: Avant Quartz 26 (20 i 30 mm), Caesarstone 9, Keralini 11. Ceny klienckie = cena po rabacie × 1,30. Mechanika bez zmian: wygrywa tańsza z dwóch cen, dekory wyłącznie promocyjne znikają z katalogu razem z kampanią, plakietka i dopisek o potwierdzeniu dostępności jak w sezonie letnim.

**Progi „od" po włączeniu promocji** (pokazane w treści stron po `npm run ceny:tresc`):

| | było | jest |
|---|---|---|
| konglomerat 60 × 300 | 7 650 zł | **7 050 zł** |
| spiek 60 × 300 | 8 500 zł | **7 150 zł** |
| spiek w L | 9 600 zł | **8 900 zł** |
| spiek zł/m² od | 671 zł | **556 zł** |
| konglomerat w L | 8 650 zł | bez zmian |

Liczby wzorów urosły o dekory wyłącznie promocyjne: konglomerat 223 → **232**, spiek 502 → **506** (Keralini 49 → 53, Avant 61 → 63, Caesarstone 24 → 31).

**Pułapki, w które wpadliśmy po drodze** (i które teraz pilnują testy):
* `pdftotext -layout` rozjeżdża kolumny tej ulotki — nazwy trafiają do innych wierszy niż liczby. Czytane `-table` i skontrolowane krzyżowo z naszym katalogiem: **19 z 23** pozycji Avant ma cenę cennikową identyczną z tym, co mamy, co potwierdza przypisanie wierszy.
* Generator strony ofertowej spieków miał kotwicę na zdaniu „Kalkulator wyceny online", które zmieniło się 29.09 na „Wycena online w 2 minuty" — podmiana liczby wzorów przestała działać po cichu. Kotwica przeniesiona na kwotę przed liczbą.
* Trzy testy spieków używały `\w*` do dopasowania „wzorów" — `\w` nie obejmuje polskich liter, więc przy 502 („wzory") działały, a przy 506 („wzorów") przestały. Poprawione na klasę z polskimi znakami.

**Do potwierdzenia przez Dawida (NIE zgadywałem):**
1. **Mnożnik 1,30 czy 1,45?** Kampania letnia liczyła ceny promocyjne × **1,45** (decyzja z 11.08), a polecenie z dzisiaj mówi × **1,30**. Wdrożone 1,30 — jeśli to pomyłka, zmiana to jedna liczba w pliku źródłowym i `npm run cennik`.
2. **Dwa wiersze „przy zakupie 5 płyt"** (Dijon 310, White Quartz 300) — **pominięte**, bo kalkulator nie gwarantuje zakupu pięciu płyt. Czy wchodzą?
3. **Zlewy Proline** (600 / 820 / 900 zł netto) — pominięte, tak jak w sierpniu.
4. **Caesarstone:** 6 pozycji z ulotki (Jet Black, Fresh Concrete, Sleek Concrete, Empira Black, Empira White, Calacatta Nuvo) **nie ma w naszym katalogu stałym** — wchodzą jako dekory wyłącznie promocyjne. Dodatkowo ulotka podaje dla Ravena cenę cennikową 996 zł, a my mamy 934 zł — to może być inny format/seria.
5. **Avant:** „Botticiono Burges" i „Calacatta Modane" też są tylko w promocji; „Statuario Lille" (nasze 1 022 vs ulotka 1 068) i „Mulen" (1 106 vs 1 068) mają inną cenę cennikową niż u nas.
6. **Data końca:** ulotka mówi **30.12.2026**, nie 31.12 — wpisane 30.12.

## 2026-10-09 — nadrabianie kolejki: inwentura + K7 i K8

### Inwentura (co naprawdę stoi na produkcji)

| Pozycja | Stan |
|---|---|
| K3 — „Jak działa wycena blatu online" na „/" | ✔ od 5.10 |
| `/llms.txt` | ✔ 200, `text/plain; charset=utf-8`, cztery crawlery AI z nazwy w robots.txt |
| K4 — akapit-odpowiedź o cenie | ✔ od 6.10, na `/blaty-z-konglomeratu-kwarcowego-poradnik` (adres z planu idzie 301) |
| K5 — opis Lublina z konkretem dojazdowym | ✔ od 7.10 |

**Zaległych nie było.** Wszystkie cztery pozycje stoją; nic nie wymagało ponownego wdrożenia.

### Wdrożone dzisiaj

**K7 — pytania z „Więcej pytań" Google.** Widoczna treść, bez nowego FAQPage w schemie (rich results dla FAQ Google wycofał 7.05.2026, zostałaby sama deklaracja):

* `/blaty-z-konglomeratu` → H3 **„Co jest tańsze: konglomerat czy granit?"** — konglomerat ma cenę z cennika (blat 60 × 300 cm od 7 650 zł), granit wycenia się po wskazaniu płyty.
* `/blaty-granitowe` → H3 **„Ile kosztuje metr bieżący blatu z kamienia?"** — metrem bieżącym nie wyceniamy, ale dla orientacji ok. 2 550 zł/mb (przeliczenie progu 7 650 zł za 300 cm). Test pilnuje, żeby te dwie liczby nie rozjechały się po zmianie cennika — `ceny-tresc.mjs` poprawi próg, ale przeliczenia samo nie zrobi.

**K8 — Staszów dostał własny blok „który materiał".** Strona miała 1 181 słów (najmniej z priorytetowych) i ani jednego zdania nie do przeniesienia na inne miasto. Teraz **2 248 słów** i blok pisany pod Staszów: gminy, do których stąd jeździmy (Połaniec, Rytwiany, Osiek, Szydłów), granit przy cięższych kuchniach z okolic Połańca, spiek przy długich blatach i wyspach. Liczby wzorów z cennika, nie z palca. Nowy **swap-test**: blok musi wymieniać co najmniej dwie lokalne nazwy z danych tego miasta — tekst, który da się przestawić na inne miasto, nie przechodzi.

### Wstrzymane świadomie

**K6 (tytuł `/blaty-z-konglomeratu`)** — plan mówi wprost: „DOPIERO po zamknięciu obserwacji K1, ta sama klasa zmiany, nie równolegle". K1 (tytuł poradnika spieków) wszedł 4.10 z falsyfikacją na ~25.10. Zmiana tytułu dziś zmieszałaby dwa pomiary. Druga część K6 — sekcja „Ile kosztuje blat z konglomeratu" — **jest już na stronie** (powstała przy przecelowaniu 3.10), więc do zrobienia zostaje sam tytuł.

### GSC, świeże 7 dni (30.09–6.10)

**22 kliknięcia · 728 wyświetleń · CTR 3,0% · średnia pozycja 12,9** — pozycja najlepsza od startu pomiarów (było 15,6 tydzień wcześniej).

Frazy z wyświetleniami i zerem kliknięć: „kamieniarstwo tarnobrzeg" 11 · „blaty kamienne do kuchni" 8 · **„blat ze spieku kwarcowego cena za m2" 8** · „ile kosztuje blat ze spieku kwarcowego" 8 · „blat/blaty ze spieku kwarcowego" 8 + 7 · „blaty kuchenne kamienne krasnobród" 7 · „blaty kamienne" 6.

**Nowe w kolejce (z tego odczytu):**
1. **„blat ze spieku kwarcowego cena za m2"** (8 wyśw., 0 klik.) — na `/blaty-ze-spieku` dopisać H3 „Ile kosztuje metr kwadratowy blatu ze spieku?" z zakresem 671–2 110 zł/m² (ten sam zabieg co K7, liczby z silnika).
2. **Klaster „wągrowiec"** — „konglomerat kwarcowy wągrowiec" 8 i „blaty z konglomeratu wągrowiec" 7, razem 15 wyświetleń z miasta oddalonego o ~400 km. **Nie gonimy** — to ruch bez wartości handlowej; notujemy, żeby przy następnym odczycie nikt nie wziął tego za sygnał.
3. „blaty kuchenne kamienne krasnobród" 7 — drugi tydzień z rzędu; miasto spoza listy priorytetowej, ale fraza łapie regularnie. Do decyzji Dawida, czy Krasnobród wchodzi na listę.

**Bramka:** 966/966 testów (3 nowe), checklista §8, build i bundle czyste. Jeden push. **Zgłoszone do indeksowania (9.10):** `/blaty-z-konglomeratu`, `/blaty-granitowe`, `/blaty-kuchenne-staszow`.

**Do obserwacji (ok. 23.10):** czy pytania PAA zaczną zbierać kliknięcia na obu stronach ofertowych (dziś CTR <1% przy poz. 18–25) i czy Staszów ruszy z pozycji 3 w SERP.

## 2026-10-07 — kontrola + K5: opis Lublina z konkretem dojazdowym

**Kontrola (wszystko na produkcji, nic do nadrabiania):**
- K3 — „Jak działa wycena blatu online" + „wycena online w 2 minuty" w pierwszym kroku ✔
- `/llms.txt` — 200, `text/plain; charset=utf-8` ✔
- **K4 był zrobiony wczoraj**, tyle że nie tam, gdzie wskazywał plan: `/baza-wiedzy/cena-blatu-z-konglomeratu` idzie 301 od 01.09 i jest wyłączona z buildu, więc akapit-odpowiedź stoi na `/blaty-z-konglomeratu-kwarcowego-poradnik` — sprawdzone dziś na żywo ✔

**K5 (dzisiejsza pozycja z kolejki):** Lublin ma 194 wyświetlenia i pozycję 12,6 przy **CTR 1,5%** — rośnie sam, mimo braku priorytetu. W opisie nie było żadnego konkretu o dojeździe, a przy mieście spoza promienia bezpłatnego pomiaru to pierwsze pytanie klienta.

**Dystans sprawdzony w Mapach dziś (nie przepisany):** Szpitalna 8 → Lublin **158 km / 1 h 50** trasą S19; warianty 154 km / 1 h 51 (DW871 + S19) i 142 km / 1 h 53 (DK74 + S19). Dane miasta mówią 160 km — zgodne z zasadą „obiecany dojazd nie krótszy niż prawdziwy".

| | |
|---|---|
| było | Blaty kuchenne kamienne Lublin — granitowe, ze spieku i konglomeratu na wymiar. Wycena online w 2 minuty, pomiar i montaż, dojazd ustalany indywidualnie. |
| jest | **Blaty kuchenne kamienne Lublin — granit, spiek, konglomerat. 160 km z Tarnobrzega, niecałe dwie godziny drogi. Wycena online w 2 minuty, dojazd indywidualnie.** (158 znaków) |

„Dojazd indywidualnie" zostaje świadomie — Lublin leży poza promieniem bezpłatnego pomiaru i opis nie może sugerować inaczej.

**Złapane przez własny test:** pierwsza wersja opisu mówiła „niecałe 2 godziny" (cyfrą), a strona w treści — „niecałe dwie godziny drogi". Test spójności czasów dojazdu z 28.09 czyta opis razem z treścią i zobaczył rozjazd 60 vs 105 minut, bo cyfrowej formy nie zna. Opis przepisany słownie; wersja cyfrowa nie wróci niezauważona.

**Bramka:** 940/940 testów, checklista §8, build i bundle czyste. Jeden push.

**Zgłoszone do indeksowania (7.10):** `/blaty-kuchenne-lublin`.

**Do obserwacji (ok. 21.10):** Lublin — CTR 1,5% przy poz. 12,6 i 194 wyświetleniach; czy konkret dojazdowy w opisie podniesie klikalność.

## 2026-10-06 — K4: akapit-odpowiedź o cenie + trzy strony bazy wiedzy z cenami sprzed wygaśnięcia kampanii

**Kontrola wczorajszego:** K3 („Jak działa wycena blatu online" + „wycena online w 2 minuty" w kroku 1) i `/llms.txt` (200, `text/plain; charset=utf-8`) są na produkcji, `origin` równy, drzewo czyste. Nic do nadrobienia.

**K4 — UWAGA, plan wskazywał nieistniejącą stronę.** `/baza-wiedzy/cena-blatu-z-konglomeratu` od **01.09.2026 idzie 301** na poradnik filarowy i jest wyłączona z buildu (likwidacja kanibalizacji). GSC pokazuje ten adres dalej, bo stary URL siedzi w indeksie — stąd „poz. 11,8, 82 wyświetlenia" w planie. Akapit wszedł więc tam, gdzie klient naprawdę trafia: na `/blaty-z-konglomeratu-kwarcowego-poradnik`, i to **przez generator** (`lib/tresc-konglomeraty.mjs`), bo ręczna zmiana w HTML wróciłaby przy pierwszym `npm run konglomeraty`.

Poradnik otwierał się uwagą, że konkurencja nie podaje kwot — prawdziwie, ale to nie jest odpowiedź na pytanie z wyszukiwarki. Teraz pierwszy akapit po okruszkach brzmi:

> **Blat z konglomeratu kwarcowego 60 × 300 cm kosztuje u nas od 7 650 zł brutto** — razem z obróbką i montażem. Sam materiał to 505–2 451 zł/m² brutto i to on decyduje o kwocie: robocizna jest taka sama dla każdego dekoru. Dokładną cenę dla konkretnych wymiarów policzy kalkulator, a [wzory konglomeratu](/blaty-z-konglomeratu) można obejrzeć w cenniku.

> **Blat z konglomeratu kwarcowego 60 × 300 cm kosztuje u nas od 7 650 zł brutto** — razem z obróbką, wycięciami i montażem. Sam materiał to 505–2 451 zł/m² brutto i to on decyduje o kwocie: robocizna jest taka sama dla każdego dekoru. Kuchnia w L zaczyna się od 8 650 zł, a [wzory konglomeratu](/blaty-z-konglomeratu) można obejrzeć w cenniku.

Wszystkie kwoty z `ceny-tresc.json`, kotwica dokładnie jak w planie. Ten sam akapit (w wersji bez kuchni w L) został też w pliku strony pod 301 — nieserwowanym, ale trzymanym w zgodzie z cennikiem.

### ⚠ Znalezione przy okazji: baza wiedzy nigdy nie była objęta synchronizacją cen

`ceny-tresc.mjs` i checklista §8.17 czytały **wyłącznie katalog główny** (`readdirSync(ROOT)`), więc `baza-wiedzy/` nie była aktualizowana od miesięcy. Dopisanie akapitu „od 7 650 zł" nad tabelą mówiącą „od 4 400 zł" byłoby publikacją sprzeczności, więc strony doprowadzone do zgodności z silnikiem (liczby policzone na 223 dekorach konglomeratu, blat 60 × 300 z obróbką, wycięciami i montażem):

| Miejsce | Było | Jest |
|---|---|---|
| widełki: budżetowo | od 4 400 zł | **od 7 650 zł** (minimum z cennika) |
| widełki: środek stawki | 6 000 – 7 000 zł | **9 400 – 11 450 zł** (kwartyle) |
| widełki: premium | 10 000 zł i więcej | **11 500 zł i więcej** (maks. 16 800) |
| przykład kuchni w L: materiał | 5 800 zł | **6 100 zł** |
| przykład: produkcja i montaż | 3 500 zł | **6 000 zł** |
| przykład: razem | 9 300 zł | **12 100 zł** |
| opis dla Google (4 miejsca) | od 4 400 zł | **od 7 650 zł** |
| `/baza-wiedzy/kwarcyt-czy-granit` | od 4 400 zł | **od 7 650 zł** |
| `/baza-wiedzy/spiek-kwarcowy-wady-i-zalety` | od 4 500 zł, gres od 6 700 zł | **od 8 500 zł**, bez osobnego progu dla gresu (najtańszy spiek to dziś gres Keralini — 8 500 zł) |

Największy rozjazd był przy robociźnie: 3 500 → 6 000 zł, czyli efekt decyzji cenowej z 17.09 (1 500 zł podstawy + 150 zł/m²) plus montaż. Cennika źródłowego nikt nie dotykał — to te same liczby, które kalkulator liczy od 1.10.

**Naprawione u źródła, nie na stronach:** `ceny-tresc.mjs` i checklista §8.17 obejmują teraz także `baza-wiedzy/*.html`. Przy okazji wyszło, że kontrola kwot wycofanych łapała je zwykłym `includes` — „16 800 zł" zawiera „6 800 zł", a składniki przykładowej wyceny nie są progami. Teraz szuka wyłącznie formy progowej „od X zł"; sprawdzone w obie strony (wstrzyknięte „od 4 400 zł" → czerwone, usunięte → zielone).

**Dwa nowe testy** w `test-konglomeraty.mjs`: akapit-odpowiedź ma mieć 40–60 słów, aktualny próg i zakres zł/m² z `ceny-tresc.json` oraz kotwicę „wzory konglomeratu"; żadna z trzech stron bazy wiedzy nie może podawać progu z listy kwot wycofanych.

**Bramka:** 940/940 testów (było 938), checklista §8 cała zielona, build, bundle i przegląd produkcji czyste. Jeden push.

**Zgłoszone do indeksowania (6.10):** `/blaty-z-konglomeratu-kwarcowego-poradnik` (akapit-odpowiedź), `/baza-wiedzy/kwarcyt-czy-granit` i `/baza-wiedzy/spiek-kwarcowy-wady-i-zalety` (poprawione progi cenowe). Adresu pod 301 nie zgłaszamy — nie ma czego indeksować.

**Z GSC przy zgłaszaniu:** `/baza-wiedzy/spiek-kwarcowy-wady-i-zalety` **nie było w indeksie w ogóle** — „Adres URL jest Google nieznany", mimo że strona jest w sitemapie i linkują do niej inne strony bazy wiedzy. Teraz zgłoszona; jeśli za dwa tygodnie dalej będzie poza indeksem, to temat na osobną pozycję w kolejce (sprawdzić canonical i linkowanie wewnętrzne).

**Do obserwacji (ok. 20.10):** `/baza-wiedzy/cena-blatu-z-konglomeratu` — poz. 11,8 i 82 wyświetlenia przy 0 kliknięć; czy akapit-odpowiedź wyciągnie stronę na 1. stronę wyników.

## 2026-10-05 — /llms.txt: wizytówka strony dla modeli językowych (GEO)

**K1 z 4.10 sprawdzone:** tytuł poradnika spieków „Spiek kwarcowy na blat kuchenny — wady, zalety, ceny" jest na produkcji, commity `9d30cd3`, `afc1f12`, `4077c29` na `origin`, drzewo czyste. Nic nie zalegało.

**NOWE — `/llms.txt`** (wg specyfikacji ze skilla `geo-seo`; plik ma go dziś <5% stron):

- 60 linii (limit 50–150), nagłówek `# Kamieniarstwo 24h (Aaron sp. z o.o.)`, opis 181 znaków (limit 200), **24 wpisy** (limit 10–30) w sekcjach: Wycena i kalkulator · Oferta · Poradniki i baza wiedzy · Obszar działania · O firmie · Key Facts · Contact.
- Opisy konkretne, bez marketingu („pojedyncze płyty z magazynu w niższej cenie, z podanym wymiarem i numerem bloku"), 8–35 słów.
- **Bez kwot** — świadomie. Ceny „od…" chodzą za cennikami dostawców (30.09 wygasły cztery kampanie i próg spieku skoczył o 1 200 zł), a tego pliku nikt nie przelicza. Zamiast liczb: odesłanie do kalkulatora.
- Dane firmowe wzięte ze stopki serwisu, nie z pamięci: Aaron sp. z o.o., NIP 8672241748, ul. Szpitalna 8. **KRS pominięty — nie ma go nigdzie w repo, a nie zgaduję numerów rejestrowych.**
- ⚠ **Rozjazd do wyjaśnienia z Dawidem:** zlecenie mówiło „rok zał. 2016", a cała strona (index, /o-mnie, stopki) mówi **„od 2014 roku"**. W pliku jest 2014 — zgodnie ze stroną. Jeśli 2016 to data rejestracji spółki, warto dopisać oba fakty osobno.

**robots.txt:** osiem crawlerów AI wymienionych z nazwy z `Allow: /` — GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, PerplexityBot, Google-Extended, Applebot-Extended. Pułapka, w którą łatwo wejść: **własna grupa ZASTĘPUJE reguły z „*", nie dokłada się do nich** — bez powtórzenia `Disallow: /dziekujemy` w każdej grupie strona podziękowania (cel konwersji Google Ads/Meta) zrobiłaby się nagle crawlowalna dla AI. Każda grupa ją powtarza.

**Netlify:** własny nagłówek dla `/llms.txt` — `text/plain; charset=utf-8` (bez `charset` polskie znaki potrafią dojść jako krzaki) plus `Cache-Control: public, max-age=3600`.

**Nowy test `scripts/test-llms.mjs` (7 asercji):** struktura i długość pliku, format wpisów, **każdy URL ma swój plik w repo** (martwy link w llms.txt jest gorszy niż jego brak — model zacytuje 404), brak kwot, adres tylko Szpitalna 8 (żadnej Bemy), `Allow` dla crawlerów AI razem z wyłączeniem `/dziekujemy`, nagłówek w netlify.toml.

**Bramka:** 937/937 testów (było 930), checklista §8, build i bundle czyste. Jeden push.

### K3 (ten sam dzień, osobny push) — strona główna niesie frazę „wycena blatu online"

Sekcja na „/" nazywała się „Jak to działa" — nagłówek, który nie mówi Google'owi
nic o tym, co ta strona robi. Teraz:

- H2: „Jak to działa" → **„Jak działa wycena blatu online"**
- pierwszy krok: „…Kilka pytań, bez formularzy **— wycena online w 2 minuty.**"

Zmieniony wyłącznie tekst w `index.html`; `#kreator` i skrypty kalkulatora
nietknięte. Test w `test-miasta.mjs` pilnuje obu rzeczy naraz (nagłówek
i fraza w pierwszym kroku) — 938/938 zielone.

**Zgłoszone do indeksowania (5.10):** `/` oraz `/blaty-ze-spieku-kwarcowego-poradnik`.
Ten drugi był już zgłaszany 4.10 razem z `/blaty-ze-spieku`; zgłoszony ponownie,
bo tytuł z K1 wszedł na produkcję tego samego dnia i drugie zgłoszenie nic nie psuje.

**Dwa pushe tego dnia** (llms.txt osobno, K3 osobno) — llms.txt poszło, zanim
dotarło zlecenie K3.

**Do obserwacji:** czy ChatGPT/Perplexity zaczną cytować kam24h.pl przy pytaniach o blaty w Tarnobrzegu i okolicy; plik przejrzeć przy następnej większej zmianie treści (kwartalnie), szczególnie listę miast i poradników.

## 2026-10-04 — K1 z ACTION-PLAN: de-kanibalizacja „blaty ze spieku kwarcowego"

**Problem (GSC, przed zmianą):** fraza „blaty ze spieku kwarcowego" — **97 wyświetleń, 0 kliknięć, śr. poz. 27,6**. Stały na niej DWIE nasze strony: oferta `/blaty-ze-spieku` (914 wyśw., 7 klik.) i poradnik `/blaty-ze-spieku-kwarcowego-poradnik`. Żadna nie zbierała wejść na tej frazie.

**Decyzja (K1):** frazę główną przejmuje **oferta** — jej tytuł już ją niesie („Blaty ze spieku kwarcowego — cena za m², ile kosztuje blat"). Poradnik schodzi na to, czego naprawdę dotyczy.

**Zmiany (commit 9d30cd3 + sitemapa afc1f12, wdrożone i sprawdzone na żywo):**
- tytuł poradnika: „Blaty ze spieku kwarcowego — poradnik, ceny i wady" → **„Spiek kwarcowy na blat kuchenny — wady, zalety, ceny"** (52 zn.)
- `og:title` → „Spiek kwarcowy na blat — poradnik kamieniarza"
- opis → „Spiek kwarcowy na blat: uczciwe wady i zalety, rozbicie ceny od 8 500 zł (60 × 300 cm), porównanie z granitem i konglomeratem." (126 zn.)
- `test-spieki.mjs`: asercja tytułu `/blaty ze spieku kwarcowego/` → `/spiek kwarcowy/` — przybijała poprzednią strategię, nie błąd. Limit 60 znaków i ≤160 dla opisu nadal pilnowany.
- H1 i treść bez zmian (poradnik dalej odpowiada na pytanie o cenę, tylko nie licytuje się z własną ofertą).

Źródła prawdy: tytuł i opis siedzą w `scripts/strona-spieki.mjs` — ręczna zmiana w HTML wróciłaby przy pierwszym `npm run spieki`.

**Bramka:** 930/930 testów, checklista §8, build i bundle czyste. Sitemapa: 1 data. Jeden push. Wcześniejsze commity (`a0c0a6d`, `babf68a`) były już na `origin` — nic nie zalegało.

**Zgłoszone do indeksowania w GSC (4.10):** `/blaty-ze-spieku-kwarcowego-poradnik` i `/blaty-ze-spieku` — oba potwierdzone („Przesłano prośbę o zindeksowanie").

**Zauważone przy okazji (rekomendacje GSC):** poradnik spieków **+249% wyświetleń**, `/blaty-kuchenne-tarnobrzeg` nadal **−64%** (drugi odczyt z rzędu — do diagnozy fraza po frazie, pozycja K-next).

**Falsyfikacja (ok. 25.10):** jeśli „blaty ze spieku kwarcowego" spadnie poniżej poz. 30 i oferta NIE urośnie — wracamy do starego tytułu jednym revertem.

**Do obserwacji (porównać ok. 18–25.10):**
- „blaty ze spieku kwarcowego": poz. 27,6 / 97 wyśw. / 0 klik. — czy pozycja idzie w górę po stronie oferty
- poradnik: czy zaczyna łapać frazy „spiek kwarcowy wady/zalety"

---

## 2026-10-03 — sesja SEO: przegląd GSC, CTA w opisach, indeksowanie

**Stan GSC (28 dni, 2–29.09):** 72 kliknięcia · 3 780 wyświetleń · CTR 1,9% · śr. pozycja 18,6 · 243 frazy · 38 stron zindeksowanych (3 nie).

**Najważniejsze obserwacje:**
- `/blaty-kuchenne-mielec` — poz. **7,5**, CTR 8% (najlepsza strona miasta; wzorzec „kamienne" działa).
- `/blaty-z-konglomeratu-kwarcowego-poradnik` — poz. **7,3 przy 120 wyśw. i 0 kliknięć** → najtańsza wygrana, poprawiono opis (patrz niżej).
- Fraza „ile kosztuje blat ze spieku*" — 45 wyśw., śr. poz. 10, 0 kliknięć; lekka kanibalizacja: `/blaty-ze-spieku` (36 wyśw., poz. 10,5) vs poradnik spieków (11 wyśw., poz. 12,5). Cennik wygrywa — na razie zostawić, obserwować.
- Rekomendacje GSC: **`/blaty-kuchenne-tarnobrzeg` −64% wyświetleń** (sprawdzić za tydzień — może efekt zmiany tytułu strony głównej, która teraz łapie frazy tarnobrzeskie), `/blaty-kuchenne-lublin` **+1020%** (Lublin rośnie mimo braku priorytetu — frazy lubelskie liczne w GSC: „blaty lublin" poz. 7,8 z 40% CTR).
- `/blaty-z-konglomeratu` — 1 375 wyśw., poz. 24,5, CTR 0,6% (największy wolumen; po przecelowaniu na „wzory/kolekcje" czekać na przeindeksowanie).
- Regresja Mielec/Sandomierz: **naprawiona i wdrożona** przez sesję kodową (commity 8eb0961, f075d1d); zweryfikowano na żywo na produkcji — tytuły, treść, ceny stałe (7 650/8 500 zł) OK. Nie dublowano.

**Zmiany (commit a0c0a6d, lokalny — wymaga push):**
- `blaty-ze-spieku.html` — opis meta: „Kalkulator wyceny online." → „**Wycena online w 2 minuty.**" (3 miejsca: description, og, schema). Powód: poz. ~10 na frazy „ile kosztuje…" przy CTR 0%.
- poradnik konglomeratowy (generator `strona-konglomeraty.mjs` + HTML) — opis meta + „, wycena online w 2 minuty" (158 znaków). Powód: poz. 7,3, 120 wyśw., 0 kliknięć.
- `test-spieki.mjs` — wzorzec parsowania opisu dopasowany do nowego tekstu.

**Zgłoszone do indeksowania w GSC (3.10):** `/blaty-kuchenne-mielec`, `/blaty-kuchenne-sandomierz`, `/` (wszystkie już wdrożone zmiany tytułów z sesji kodowej).

**Blokady sesji:** sandbox nie ma dostępu do GitHuba (push) ani nie uruchomi testów (node_modules pod Windows); w `.git` został martwy `index.lock`. **Dawid:** `del .git\index.lock` → `npm test` → `git push` → po deployu zgłosić w GSC indeksowanie `/blaty-ze-spieku` i `/blaty-z-konglomeratu-kwarcowego-poradnik`.

**Do obserwacji (porównać ok. 17–24.10):**
- poradnik konglomeratowy: CTR z 0% (poz. 7,3, 120 wyśw./28 dni)
- `/blaty-ze-spieku` na „ile kosztuje blat ze spieku kwarcowego": poz. 11,5 / CTR 0%
- Tarnobrzeg: czy −64% wyświetleń się pogłębia (poz. frazy „blaty kuchenne kamienne tarnobrzeg": 3,8)
- Mielec: poz. 7,5 → cel TOP3

**Następna sesja:** 1) sprawdzić efekt CTA i indeksowań; 2) Tarnobrzeg −64% — diagnoza (fraza po frazie); 3) rozważyć przecelowanie fraz lubelskich (Lublin rośnie sam — poza priorytetem, ale dane mówią swoje); 4) `/blaty-granitowe` poz. 36 przy 68 wyśw. — tytuł nie zawiera „cena".

---

## Szablon wpisu

```markdown
## RRRR-MM-DD — [temat sesji]

**Stan GSC (28 dni):** kliknięcia X · wyświetlenia Y · CTR Z% · śr. pozycja P
**Zmiany:**
- [strona] — [co i dlaczego] (commit: hash)
**Zgłoszone do indeksowania:** [adresy]
**Do obserwacji:** [fraza → pozycja/CTR przed zmianą]
**Następna sesja:** [co sprawdzić / dokończyć]
```

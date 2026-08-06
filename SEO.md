# SEO — co jest zrobione i co zostaje do Ciebie

Dokument roboczy. Część techniczna jest wdrożona i działa na `kam24h.pl`;
część poza stroną (opinie, wizytówka, linki) wymaga Twojego konta i decyzji.

---

## 1 · Na jakie frazy gramy

Jedna strona = jedna główna fraza. Bez tego podstrony konkurowałyby ze sobą
o to samo hasło i żadna nie wyszłaby wysoko.

| Adres | Fraza główna | Frazy poboczne |
|---|---|---|
| `/` | wycena blatu online | kalkulator blatu, blat kuchenny cena |
| `/blaty-kuchenne-tarnobrzeg` | blaty kuchenne Tarnobrzeg | blaty kamienne Sandomierz / Stalowa Wola / Mielec, blat na wymiar |
| `/blaty-z-konglomeratu` | blaty z konglomeratu | blat kwarcowy cena, blaty Technistone, Caesarstone cena |
| `/blaty-ze-spieku` | spiek kwarcowy blat | blat ze spieku cena, gres wielkoformatowy na blat |
| `/blaty-granitowe` | blaty granitowe | blat granitowy cena, blat z marmuru, kamień naturalny Tarnobrzeg |
| `/czesto-zadawane-pytania` | ile kosztuje blat kuchenny | konglomerat czy spiek, czy blat będzie łączony |

Frazy z nazwami marek („blaty Technistone", „Caesarstone cena") celowo
siedzą na stronie o konglomeracie, a nie na osobnych podstronach. Podstrona
pod każdą markę miałaby zbyt cienką treść i wyglądałaby jak strona-wydmuszka.

---

## 2 · Co zostało zrobione na stronie

### Treść

Pięć nowych podstron, każda **renderowana w HTML-u, nie JavaScriptem**.
To kluczowe: sam kalkulator jest dla Google pustym pojemnikiem — robot widzi
`<main></main>` i nic więcej. Teraz w źródle strony jest 500–700 słów treści,
którą da się przeczytać bez uruchamiania skryptów. Sprawdzone `curl`-em.

Na stronie głównej doszedł krótki, statyczny opis pod kalkulatorem
(z 166 do 309 słów w źródle).

Treść jest zgodna z prawdą i policzona z naszego cennika — widełki 4 100 zł
i 4 850 zł za blat 60 × 300 cm wychodzą z tego samego silnika, który liczy
wyceny w kalkulatorze. Jeśli zmienisz cennik, **te liczby trzeba poprawić
ręcznie** w podstronach.

### Dane strukturalne

| Typ | Gdzie | Po co |
|---|---|---|
| `HomeAndConstructionBusiness` | wszystkie strony | wizytówka firmy: adres, telefon, godziny 8–18, współrzędne, 10 obsługiwanych miast |
| `BreadcrumbList` | podstrony | ścieżka nawigacji w wynikach wyszukiwania |
| `FAQPage` | strona z pytaniami | szansa na rozwijane pytania bezpośrednio w Google |
| `Service` + `AggregateOffer` | strony materiałowe | cena „od" przy wyniku |
| `WebPage` | podstrony | powiązanie strony z firmą |

Ceny w danych strukturalnych są **takie same jak widoczne na stronie** —
inaczej Google traktuje to jako naruszenie i potrafi wyłączyć wyniki rozszerzone.

### Technikalia

- **Canonical bez `.html`** na każdej stronie, a wersja z `.html` przekierowuje
  trwale (301). Wcześniej ta sama treść była dostępna pod dwoma adresami.
- **Koniec miękkich 404.** Do tej pory każdy literówkowy adres zwracał kod 200
  ze stroną główną — Google liczy to jako błąd jakości. Teraz nieistniejący
  adres zwraca prawidłowe 404 z własną stroną i linkami.
- **Sitemapa** z 7 adresami i datą, **robots.txt** wskazujący sitemapę,
  strona podziękowania wyłączona z indeksowania.
- **Podstrony ładują 0,15 kB JavaScriptu** (tylko zgody i mierzenie kliknięć
  w telefon). Core Web Vitals nie mają się o co potknąć.
- Unikalne `title` (37–53 znaki) i `description` (133–144 znaki) — mieszczą się
  w wynikach bez ucięcia.
- Jeden `H1` na stronę, nagłówki bez przeskoków, wszystkie obrazki z `alt`.
- Linkowanie wewnętrzne: każda podstrona linkuje do pozostałych w treści
  i przez mapę serwisu w stopce.

---

## 3 · Co musisz zrobić Ty (poza stroną)

To jest ta część, która realnie decyduje o pozycjach lokalnych. Sama strona
to fundament, ale w wyszukiwaniu lokalnym wygrywa firma z lepszą wizytówką
i opiniami, nie ta z ładniejszym kodem.

### Najpierw — Google Search Console (zrobimy razem)

Potwierdzenie własności domeny i zgłoszenie sitemapy
(`https://kam24h.pl/sitemap.xml`). Bez tego czekasz, aż Google sam znajdzie
stronę; z tym — indeksuje w kilka dni. Powiedz, kiedy masz chwilę, przejdziemy
przez to przez przeglądarkę.

### Wizytówka Google (Profil Firmy)

Największy pojedynczy wpływ na „blaty kuchenne Tarnobrzeg". Do zrobienia:

1. **Ujednolić adres.** Na fanpage'u masz ul. Bema 227, na stronie ul. Szpitalną 8.
   Google porównuje te dane między źródłami i rozbieżność obniża zaufanie.
   Zdecyduj, który adres jest tym oficjalnym dla klientów, i wyrównaj wszędzie.
2. **Adres strony w wizytówce** ustawić na `https://kam24h.pl`.
3. **Kategorie:** główna „Zakład kamieniarski", dodatkowe „Dostawca blatów
   kuchennych", „Sprzedaż kamienia naturalnego".
4. **Godziny 8:00–18:00** — te same co na stronie.
5. **Zdjęcia.** Najmocniej działają gotowe blaty u klientów. Wrzucaj
   regularnie, po kilka miesięcznie, z opisem miejscowości.
6. **Wpisy** — te same „płyty tygodnia", które publikujesz na Facebooku,
   wrzucaj też jako posty w wizytówce.

### Opinie

Napisz mi, ile ich masz — od tego zależy kolejność działań. Przy mniej niż
dziesięciu opiniach zbieranie ich jest ważniejsze niż jakakolwiek zmiana na
stronie, także przed startem reklam (płatny ruch trafiający na wizytówkę
z małą liczbą opinii konwertuje wyraźnie gorzej).

Najprostszy sposób: po montażu wyślij klientowi SMS-a z bezpośrednim linkiem
do wystawienia opinii. Poproszony na miejscu klient zwykle zapomina; SMS
z linkiem działa.

### Link ze starej strony k24h.pl

Masz działającą stronę pod `k24h.pl`. Dodaj z niej **widoczny link do
`kam24h.pl`** — najlepiej z menu albo z sekcji o wycenie, tekstem w rodzaju
„wyceń blat online". To najłatwiejszy do zdobycia link, jaki masz, bo obie
strony należą do Ciebie.

Uwaga: nie przekierowuj całego `k24h.pl` na `kam24h.pl` bez rozmowy — to
osobna decyzja i trzeba ją zrobić ostrożnie, żeby nie stracić tego, co stara
domena już ma wypracowane.

### Pozostałe linki — po kolei, bez przesady

- katalogi branżowe: Panorama Firm, PKT, Oferteo, Fixly (profile z pełnymi
  danymi, tym samym adresem i telefonem),
- lokalne portale Tarnobrzega i Sandomierza,
- profile na Facebooku i Instagramie z adresem `kam24h.pl` w opisie,
- producenci, których materiały sprzedajesz — czasem prowadzą listy punktów
  sprzedaży i warto poprosić o wpis.

Nie kupuj pakietów linków. W lokalnym SEO nic nie dają, a potrafią zaszkodzić.

---

## 4 · Czego świadomie NIE zrobiłem

- **Nie upychałem fraz.** Tekst ma się czytać jak rozmowa z fachowcem,
  bo tak samo ocenia go dziś Google.
- **Nie robiłem podstron pod każde miasto** („blaty Sandomierz",
  „blaty Stalowa Wola"…). Przy jednym zakładzie takie strony są niemal
  identyczne i Google traktuje je jako treść niskiej jakości. Miasta są
  wymienione w treści i w danych strukturalnych — to wystarczy.
- **Nie dodałem ocen (`AggregateRating`)** do danych strukturalnych.
  Oznaczanie ocen własnej firmy na własnej stronie jest wprost zabronione
  w wytycznych Google i grozi karą ręczną.
- **Nie ruszałem `k24h.pl`.** To osobna decyzja — patrz wyżej.

---

## 5 · Co warto zrobić dalej

W kolejności opłacalności:

1. **Search Console + wizytówka + opinie** (wyżej) — to daje najwięcej.
2. **Zdjęcia realizacji na podstronach.** Dziś strony są czysto tekstowe.
   Zdjęcia gotowych blatów, z prawdziwymi opisami (dekor, miejscowość),
   poprawią i pozycje, i konwersję. Potrzebuję od Ciebie plików.
3. **Strona o nagrobkach.** Drugi filar firmy, a w wyszukiwarce nie istnieje.
   Przed Wszystkimi Świętymi to konkretne pieniądze — warto zacząć
   przygotowania z wyprzedzeniem.
4. **Wpisy blogowe pod długie frazy** — „czym różni się spiek od konglomeratu",
   „jak przygotować kuchnię do pomiaru blatu". Każdy taki tekst to nowe wejście
   do serwisu.

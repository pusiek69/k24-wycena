# Poradnik o konglomeracie — analiza przed napisaniem

*Etap 1 zlecenia Dawida z 01.09.2026. Etap 2 (wykonanie) dopiero po tych wnioskach —
tak samo jak przy spiekach (`docs/analiza-spieki.md`).*

---

## 1. Punkt wyjścia (Search Console, pomiar 30.08.2026)

Po frazach spiekowych drugi co do wielkości potencjał bez kliknięć:

| fraza | wyświetleń | kliknięć | pozycja |
|---|---:|---:|---|
| blaty z konglomeratu cena | 49 | 0 | 20–40 |
| blaty kuchenne kamienne tarnobrzeg | 48 | 0 | 20–40 |
| blat z konglomeratu | 47 | 0 | 20–40 |

**~144 wyświetlenia, zero kliknięć.** Google uznaje nas za wystarczająco trafnych,
żeby pokazać, ale nikt nas nie klika — bo na pozycji 20–40 nas po prostu nie widać.

Dwie pierwsze frazy to dwie różne intencje i wymagają dwóch różnych ruchów.
Ta analiza dotyczy konglomeratu; „blaty kuchenne kamienne tarnobrzeg" opisuję
w sekcji 9 jako osobną, tańszą poprawkę.

---

## 2. Diagnoza — dlaczego 0 kliknięć

### 2.1 Kanibalizacja: TRZY strony o tym samym

⚠ **Korekta własnej analizy.** Pierwszy audyt objął tylko katalog główny
(`*.html`) i wyszło z niego, że konglomerat ma jedną stronę. To było błędne —
`baza-wiedzy/` to podkatalog i wypadł z globa. Po poprawnym audycie obraz jest
taki sam jak przy spiekach: **o te same frazy bije się trzy razy ta sama treść.**

| strona | słów | tytuł | intencja |
|---|---:|---|---|
| `/baza-wiedzy/cena-blatu-z-konglomeratu` | 816 | Ile kosztuje blat z konglomeratu kwarcowego w 2026? | **cena** |
| `/blaty-z-konglomeratu` | 598 | Blaty z konglomeratu kwarcowego — ceny i wzory | **cena + wzory** |
| `/baza-wiedzy/konglomerat-kwarcowy` | 509 | Konglomerat kwarcowy — budowa, właściwości, ograniczenia | materiał |

Razem **1923 słowa rozbite na trzy adresy**, z czego dwa celują wprost we
frazę „blat z konglomeratu cena". Google musi wybrać, który pokazać — i wybiera
słabo, bo żaden nie jest wyraźnie najlepszy. To jest ta sama sytuacja, która
przy spiekach dawała zero kliknięć przy 300 wyświetleniach.

Strony poza konglomeratem, które wspominają go tylko z boku (14 stron miast,
`/wyprzedaz-plyt`, `/blaty-granitowe`), nie kanibalizują — mają własne,
inne intencje.

### 2.2 Objętość poniżej progu wejścia

598 słów przeciwko 3000–3500 u najmocniejszego konkurenta w top10. To nie jest
walka o niuans — my nie mamy czym odpowiedzieć na połowę pytań, które zadaje
ktoś szukający „blat z konglomeratu cena".

### 2.3 Znów sprzedajemy część tego, co mamy

`ceny-tresc.mjs` liczy wzory konglomeratu z listy
`KONGLOMERATY_NA_STRONIE = ['avant-quartz', 'caesarstone', 'technistone']`.
W cenniku są jednak **dwie marki więcej**:

| marka | wzorów | na stronie? |
|---|---:|---|
| Technistone | 66 | tak |
| Avant Quartz | 62 | tak |
| InterQ | 39 | **NIE** |
| Pacific | 33 | **NIE** |
| Caesarstone | 30 | tak |
| **razem** | **230** | strona mówi **158** |

To dokładnie ten sam błąd, który 30.08 naprawiliśmy po stronie spieków
(było „178 wzorów", w cennikach 481). Przy konglomeracie został nietknięty.
Decyzja Dawida z tamtego dnia — „na stronach mają być prawdziwe liczby" —
obejmuje i ten przypadek.

---

## 3. Konkurencja w top10 — kto i z czym

Dwa zapytania, dwa różne zestawy stron:

**„blat z konglomeratu wady zalety"** — blogi wnętrzarskie (CzasNaWnętrze,
Madame Edith, Industria24) plus dwa zakłady kamieniarskie (MMSTONE, Bogaccy).

**„blat z konglomeratu cena"** — agregatory cenowe i poradniki remontowe
(kb.pl, chatownik.pl, scandishop.pl) plus zakłady (MMSTONE, Danstone, ExtremeStone).

### Czego brakuje CAŁEJ stawce

Najmocniejszy bezpośredni konkurent (bogaccy.pl, ~3000–3500 słów, tabela
porównawcza, FAQ, wymienia Silestone / Technistone / Dekton) **nie podaje ani
jednej kwoty**. Rankuje na „cenę" i o cenie nie mówi nic poza „drożej niż laminat".

Reszta podaje kwoty, ale wzajemnie sprzeczne i nieporównywalne:

- „od 300 zł/m²" i „od 400 zł/m²" (za sam materiał, bez obróbki)
- „ponad 1000 zł/m², nawet 1500" (droższe kolekcje)
- „800–1500 zł/mb" (inna jednostka — metr bieżący)
- „2000–3500 zł/m² gotowego blatu" (z montażem)

Czytelnik po przeczytaniu trzech takich artykułów wie **mniej** niż przed.
Nie da się z tego policzyć własnej kuchni.

---

## 4. Intencje wyszukujących

1. **„ile mnie to wyjdzie"** — dominująca, i to jej nikt porządnie nie obsługuje.
   Człowiek ma wymiary swojej kuchni i chce liczby.
2. **„czy to się nie zniszczy"** — gorąca patelnia, zarysowania, słońce.
3. **„konglomerat czy spiek/granit"** — porównanie przed decyzją.
4. **„jakie są wzory / marki"** — obsługiwane dziś przez `/blaty-z-konglomeratu`.

---

## 5. Nasze atuty, których konkurencja nie ma

- **Prawdziwe ceny z cennika**, przez jedno źródło prawdy
  (`scripts/lib/ceny-tresc.json`): materiał 505–2451 zł/m² brutto, gotowy blat
  60 × 300 cm **od 5500 zł**, blat w L **od 6650 zł**.
- **Kalkulator, który kończy robotę.** Poradnik nie musi kończyć się na
  „skontaktuj się z nami" — może dać wynik na ekranie.
- **230 wzorów w pięciu kolekcjach** — więcej, niż wymienia którykolwiek
  z artykułów w top10.
- **Zakład, nie pośrednik.** Możemy napisać, ile kosztuje otwór pod zlew,
  bo sami go robimy.

## 6. Czego NIE mamy — i czego nie udajemy

- ~~Zero zdjęć realizacji z konglomeratu.~~ **KOREKTA (etap 2):** to była
  moja pomyłka przez analogię do spieków, gdzie naprawdę jest zero. W galerii
  jest **9 realizacji z konglomeratu**, każda podpisana nazwą wzoru
  (Avant Chantilly, Calacatta Evo, InterQ Lincoln White, Taj Amelie…).
  To atut, którego nie ma ŻADEN artykuł w top10 — wszystkie ilustrują się
  zdjęciami stockowymi. Poradnik ma więc sekcję „Jak to wygląda u klientów"
  z linkiem do galerii.
- Nie podpiszemy cudzych zdjęć ani nie nazwiemy spieku konglomeratem.
- Nie mamy badań laboratoryjnych odporności — nie będziemy podawać liczb
  w stopniach ani w skali Mohsa udając, że to nasze pomiary.
- Nie sprzedajemy Silestone ani Dekton — nie piszemy o nich jak o swojej ofercie.

---

## 7. Burza mózgów — trzy koncepcje

### Wariant A: rozbudować istniejącą stronę w miejscu
Bez nowego adresu, bez ryzyka kanibalizacji, strona zachowuje swoją historię.
**Minus:** tracimy stronę pod intencję „wzory i kolekcje", która dziś działa
poprawnie, i mieszamy dwie różne intencje w jednym adresie.

### Wariant B: nowy poradnik + zostawić starą stronę bez zmian
Najprostsze w wykonaniu. **Minus:** dwie strony z niemal identycznym tytułem
(„…konglomeratu kwarcowego — ceny…") — sam tworzę problem, który przy spiekach
musieliśmy rozwiązywać. Odrzucone.

### Wariant C: poradnik filarowy + uporządkowanie trzech stron ← **WYBRANY**

Ten sam ruch, który zadziałał przy spiekach: jeden filar zbiera sygnały,
reszta albo dostaje własną intencję, albo oddaje mu swoją.

| adres | co się dzieje | intencja po zmianie |
|---|---|---|
| `/blaty-z-konglomeratu-kwarcowego-poradnik` **(nowy)** | filar, ~2000 słów | „ile kosztuje, jakie ma wady, co wybrać" |
| `/baza-wiedzy/cena-blatu-z-konglomeratu` | **301 → poradnik** | ta sama intencja co filar — nie ma czego dzielić |
| `/blaty-z-konglomeratu` | przecelowanie tytułu i opisu | „wzory i kolekcje, katalogi marek" |
| `/baza-wiedzy/konglomerat-kwarcowy` | zostaje + link do filara | „z czego to jest zrobione" |

**Dlaczego 301, a nie zostawienie strony z linkiem.** Przy spiekach obie strony
z bazy wiedzy zostały, bo miały różne intencje od filara (właściwości, wady).
Tutaj `cena-blatu-z-konglomeratu` ma **dokładnie tę samą** intencję co nowy
poradnik i jest od niego trzy razy krótsza. Zostawiona konkurowałaby z nim
o tę samą frazę — a to jest właśnie ta kanibalizacja, którą mamy zlikwidować.
Przekierowanie przekazuje jej sygnały filarowi, zamiast je dzielić.

**Dlaczego nie A (rozbudowa w miejscu):** intencja „wzory i kolekcje" ma własny
wolumen i działającą stronę z katalogami producentów. Sklejenie wszystkiego
w jeden adres to strata, nie oszczędność.

**Wariant B (nowa strona, reszta bez zmian)** odrzucony: zostawiałby trzy strony
walczące o „cenę" zamiast dwóch — pogorszyłby dokładnie to, co naprawiamy.

## 8. Plan wykonania (Etap 2)

1. Generator `scripts/strona-konglomeraty.mjs` + treść w `lib/tresc-konglomeraty.mjs`
   — wszystkie kwoty i liczby wzorów z jednego źródła, jak przy spiekach.
2. Struktura pod cztery intencje z sekcji 4: **najpierw cena** (bo to
   dominująca intencja i luka konkurencji), potem wady, potem porównanie, potem wzory.
3. Tabela porównawcza konglomerat / spiek / granit — na naszych własnych cenach.
4. Uczciwa sekcja o wadach: żywica i temperatura, UV, zarysowania, łączenia.
5. FAQ + schema `Article` i `FAQPage`.
6. Przecelowanie `/blaty-z-konglomeratu` (tytuł, opis, linkowanie) i **301**
   z `/baza-wiedzy/cena-blatu-z-konglomeratu` na poradnik.
7. Poprawa `KONGLOMERATY_NA_STRONIE` na wszystkie pięć marek (158 → 230).
8. Wpięcie: vite, sitemap, stopka, linkowanie wewnętrzne, 301 z `.html`.

---

## 9. Poza zakresem tego poradnika — do decyzji Dawida

Wnioski z pozostałych fraz GSC opisane w raporcie końcowym: „blaty kuchenne
kamienne tarnobrzeg" (48 wyśw.) i dwa kolejne ruchy treściowe.

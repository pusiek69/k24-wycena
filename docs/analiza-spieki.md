# Poradnik o spiekach — analiza przed napisaniem

Data: 30.08.2026. Zlecenie Dawida: wejść do top10 na frazy spiekowe i przekonwertować
ruch na kalkulator. Etap 1 procesu — wnioski spisane PRZED pisaniem treści.

---

## 1. Punkt wyjścia (Search Console, pomiar 30.08.2026)

| Fraza | Wyświetlenia / 3 tyg. | Kliknięcia | Pozycja |
|---|---:|---:|---|
| blat ze spieku kwarcowego | 93 | 0 | 20–40 |
| blaty ze spieku kwarcowego | 81 | 0 | 20–40 |
| blaty ze spieków kwarcowych | 69 | 0 | 20–40 |
| spiek kwarcowy blat | 50 | 0 | 20–40 |
| **razem** | **~300** | **0** | — |

To najlepiej rokująca rodzina fraz w całym serwisie: popyt jest, my go nie zbieramy.

## 2. Diagnoza — dlaczego 0 kliknięć

### 2.1 Kanibalizacja: trzy cienkie strony o tym samym

| Strona | Słów | Tytuł |
|---|---:|---|
| `/blaty-ze-spieku` | **403** | Blaty ze spieku kwarcowego i gresu — ceny |
| `/baza-wiedzy/spiek-kwarcowy` | **309** | Spiek kwarcowy i gres wielkoformatowy — właściwości |
| `/baza-wiedzy/spiek-kwarcowy-wady-i-zalety` | **605** | Spiek kwarcowy na blat — wady i zalety |

Trzy adresy celują w tę samą intencję i wzajemnie rozcieńczają sygnały. Google nie ma
powodu wybrać żadnej z nich — i nie wybiera. **To jest główna przyczyna, nie brak treści.**

### 2.2 Objętość poniżej progu wejścia

Konkurencja w top10 ma 1800–2500 słów. Nasza najmocniejsza strona ma 403.
Nie chodzi o „długość dla długości" — chodzi o to, że na 400 słowach nie da się
odpowiedzieć na wszystkie pytania, które ten temat generuje.

### 2.3 Sprzedajemy 2 z 5 marek, które faktycznie mamy

`scripts/ceny-tresc.mjs` → `SPIEKI_NA_STRONIE = ['keralini', 'marazzi']` → **178 wzorów**
w treści. Realny stan cenników:

| Marka | Dekory |
|---|---:|
| Atlas Plan | 143 |
| Marazzi | 129 |
| Laminam | 110 |
| Florim Stone | 73 |
| Keralini | 49 |
| **razem** | **504** |

> Liczby są z REJESTRU FIRM, nie z plików cennika — bo `_promocje.js` dokłada
> wzory dostępne tylko na czas kampanii dostawcy (Laminam: 87 stałych, 110
> z kampanią letnią do 30.09.2026). Klient wybiera w kalkulatorze 110, więc
> taką liczbę widzi na stronie. Po zakończeniu kampanii `npm run ceny:tresc`
> zejdzie z powrotem — i o to chodzi.

Mówimy klientowi o 178 wzorach, mając 504. Trzy marki (Atlas Plan, Laminam,
Florim Stone) nie istnieją w treści serwisu, choć są w kalkulatorze.

## 3. Konkurencja w top10 — kto i z czym

Zbadane: `kamieniarstwo-abc.pl`, `danstone.pl`, `lukstone.pl`, `relinges.pl`,
`sklad-plyt.pl`, `mgprojekt.com.pl`, `czasnawnetrze.pl`, `kuchenny.com.pl`,
`kamienneblaty.pl`, `dario-stone.pl`, `dmkuchnie.pl`, `urzadzamy.pl`.

**Najmocniejszy (kamieniarstwo-abc.pl)** — 1800–2000 słów, H2/H3 zalety→wady→ceny→
porównanie→FAQ, tabela porównawcza, ceny za metr bieżący per marka (Laminam, Neolith,
Dekton), własne realizacje, link do kalkulatora. To jest poprzeczka.

**Najsłabszy punkt całej stawki (danstone.pl)** — rankuje na frazę **„spiek kwarcowy
blat — jaka jest cena za m2"**, ma 2200–2500 słów i **nie podaje ani jednej kwoty**.
Pisze „koszt zależy od skomplikowania projektu". To jest dziura, w którą wchodzimy.

### Czego brakuje CAŁEJ stawce

1. **Rozbicia ceny na składniki** — materiał / obróbka / wycięcia / montaż osobno.
   Nikt tego nie robi; wszyscy podają jeden zakres „700–2200 zł/m²" bez wyjaśnienia,
   co się w nim mieści.
2. **Ceny z realnego cennika**, nie „widełki rynkowe" przepisane z innego bloga.
3. **Perspektywy wykonawcy** — dlaczego cienka płyta wymaga podklejki, jak wygląda
   łączenie, czemu wycięcie pod zlew podblatowy kosztuje więcej niż nablatowy.
   Wszyscy piszą z perspektywy „redaktora, który zebrał informacje".
4. **Narzędzia** — poza jednym linkiem „wyceń sam" nikt nie daje policzyć blatu.

## 4. Intencje wyszukujących

| Intencja | Frazy | Czego szuka |
|---|---|---|
| **Cena** (najsilniejsza komercyjnie) | spiek kwarcowy cena za m2, blat ze spieku cena | konkretnej kwoty i tego, co ją zmienia |
| **Poznawcza** | co to spiek kwarcowy, blat ze spieku kwarcowego | czym to jest i czy nadaje się do jego kuchni |
| **Obiekcje** | wady spieków kwarcowych, spieki kwarcowe opinie | czy się nie sparzy na zakupie |
| **Porównanie** | spiek czy granit, spiek czy konglomerat | rozstrzygnięcia między dwoma materiałami |
| **Eksploatacja** | pielęgnacja spieku, czy spiek pęka | jak z tym żyć po montażu |

Frazy z GSC („blat ze spieku kwarcowego") to intencja poznawcza z **komercyjnym
ogonem** — ktoś, kto remontuje kuchnię i zawęża wybór. Trafia do nas 300 razy
na trzy tygodnie i nie dostaje nic, co by go zatrzymało.

## 5. Nasze atuty, których konkurencja nie ma

1. **504 dekory w pięciu realnych cennikach** — nie „mamy dostęp do spieków",
   tylko policzalna liczba wzorów z cenami.
2. **Kalkulator** liczący konkretny blat w dwie minuty, tym samym silnikiem,
   którym wyceniamy realne zamówienia.
3. **Rozbicie ceny na składniki** — mamy je w silniku, więc możemy pokazać uczciwie,
   ile kosztuje materiał, a ile praca.
4. **Doświadczenie warsztatu** — Dawid tnie te płyty od 2014 r. Łączenia, podklejka,
   krawędzie, wycięcia: to wiedza, której blogi nie mają.

## 6. Czego NIE mamy — i czego nie udajemy

**Zero realizacji ze spieku w galerii.** Katalog `/realizacje` to 43 pozycje:
granit 24, kwarcyt 10, konglomerat 9. Ani jednego spieku.

Konsekwencja: poradnik **nie może** pokazywać „naszych realizacji ze spieku", bo ich
nie ma. Nie podkładamy pod to zdjęć granitu ani stocku — to byłoby wprowadzanie
klienta w błąd na stronie, która ma budować zaufanie.

→ **Do zrobienia przez Dawida:** sfotografować najbliższy montaż ze spieku.
Po dorzuceniu do galerii dokładamy sekcję ze zdjęciami. Do tego czasu poradnik
opiera się na liczbach i wiedzy warsztatowej, nie na zdjęciach.

## 7. Burza mózgów — trzy koncepcje

### Wariant A: „Kompletny przewodnik po spiekach"
Wszystko o materiale: powstawanie, właściwości, marki, ceny, wady, pielęgnacja.
- **Za:** pokrywa całą rodzinę fraz jedną stroną, naturalne miejsce na wewnętrzne linki.
- **Przeciw:** dokładnie to, co ma dziesięciu konkurentów. Wygrywalibyśmy tylko
  objętością, a domenę mamy słabszą niż `urzadzamy.pl` czy `czasnawnetrze.pl`.

### Wariant B: „Spiek vs granit vs konglomerat"
Strona porównawcza trzech materiałów.
- **Za:** silna intencja, dobrze konwertuje.
- **Przeciw:** przestrzeń zabetonowana (10+ stron w top10, w tym duże portale),
  a frazy z GSC to **nie** frazy porównawcze. Odpowiadalibyśmy na inne pytanie
  niż to, które nam wpada. Poza tym rozdrabnia nas na trzy materiały zamiast
  wzmacniać jeden temat.

### Wariant C: „Poradnik zakupowy z realnymi cenami" ← **WYBRANY**
Kompletny poradnik, ale **zbudowany wokół pieniędzy i decyzji zakupowej**:
ile to kosztuje, z czego składa się cena, kiedy się opłaca, gdzie są pułapki,
policz swój blat.

**Dlaczego ten:**

1. **Uderza w jedyną realną lukę.** Cała stawka pisze o spieku ogólnie; nikt nie
   podaje rozbicia ceny. `danstone.pl` rankuje na frazę cenową bez jednej kwoty —
   to zaproszenie.
2. **Gra naszą jedyną trwałą przewagą.** Blog nie skopiuje naszego cennika ani
   kalkulatora. Może skopiować akapit o wypalaniu w 1200°C.
3. **Zgadza się z intencją z GSC.** Ludzie, którzy do nas trafiają, wybierają
   materiał do konkretnej kuchni — mają budżet i pytanie „czy mnie stać".
4. **Konwertuje.** Poradnik cenowy prowadzi do kalkulatora naturalnie, bez
   doklejanego CTA. To jest cel zlecenia, nie sam ruch.
5. **Rozwiązuje kanibalizację przy okazji.** Nowa strona staje się filarem,
   a trzy istniejące — jej zapleczem, przelinkowanym w jedną stronę.

## 8. Plan wykonania (Etap 2)

**Adres:** `/blaty-ze-spieku-kwarcowego-poradnik`
(zawiera dokładną frazę „blaty ze spieku kwarcowego" — to fraza z drugą pozycją
w GSC; „poradnik" odróżnia od istniejącego `/blaty-ze-spieku`)

**Architektura fraz — koniec kanibalizacji:**

| Strona | Rola | Główna fraza |
|---|---|---|
| **poradnik** (nowa) | filar, najdłuższa treść | blat/blaty ze spieku kwarcowego, cena za m² |
| `/blaty-ze-spieku` | oferta i cennik | ceny blatów ze spieku, kolekcje |
| `/baza-wiedzy/spiek-kwarcowy` | wiedza o materiale | spiek kwarcowy — właściwości |
| `/baza-wiedzy/…-wady-i-zalety` | obiekcje | wady spieku kwarcowego |

Wszystkie trzy linkują **do** poradnika jako źródła pełnej odpowiedzi; poradnik
linkuje do nich po szczegóły. Sygnały spływają w jedno miejsce zamiast się rozpraszać.

**Struktura (H2 pod realne frazy):**
1. Ile kosztuje blat ze spieku kwarcowego — **z rozbiciem ceny na składniki**
2. Co to jest spiek kwarcowy i czym różni się od gresu
3. Spiek a konglomerat i granit — tabela porównawcza
4. Wady spieku kwarcowego — uczciwie
5. Grubość płyty a wygląd i cena krawędzi
6. Łączenia — gdzie wypadną i jak je ukryć
7. Pielęgnacja
8. Które kolekcje mamy w cenniku (5 marek, 504 wzory)
9. Dla kogo spiek ma sens, a dla kogo nie
10. FAQ (8 pytań) + `Article` i `FAQPage`

**Żelazne zasady:**
- Kwoty WYŁĄCZNIE z `scripts/lib/ceny-tresc.json` przez generator — zero liczb
  wpisanych ręcznie w HTML, zero cen zakupowych.
- Liczba wzorów liczona z cenników, nie wpisana.
- Sekcja wad pisana szczerze — to buduje zaufanie i rankuje na „wady spieków".
- Żadnych zdjęć „naszych realizacji ze spieku", dopóki ich nie ma.

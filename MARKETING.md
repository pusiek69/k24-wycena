# Jak z tego zrobić działającą reklamę — plan dla Dawida

Strona jest gotowa technicznie. Poniżej kolejność rzeczy, które trzeba zrobić,
żeby pieniądze wydane w Google i na Facebooku wracały w postaci telefonów.

---

## KROK 1. Zanim wydasz pierwszą złotówkę

Bez tych sześciu rzeczy kampania będzie strzelaniem na ślepo.

| # | Co | Gdzie | Kto robi |
|---|---|---|---|
| 1 | Własna domena `kam24h.pl` | panel nazwa.pl + Netlify | Dawid (klika) + ja (instrukcja) |
| 2 | Konto Google Analytics 4 | analytics.google.com | Dawid (5 min) |
| 3 | Konto Google Ads + konwersje | ads.google.com | Dawid |
| 4 | Piksel Meta | business.facebook.com | Dawid |
| 5 | Wklejenie numerów do `src/analytics/config.js` | projekt | ja |
| 6 | Powiadomienia o zgłoszeniach na maila | panel Netlify → Forms | Dawid (2 min) |
| 7 | Decyzja: jeden adres firmy (Szpitalna czy Bema) | — | Dawid |

Firma ma **dwa filary — blaty i nagrobki** — i one wymagają dwóch osobnych
kampanii oraz dwóch stron docelowych. Ta strona obsługuje blaty; plan dla
nagrobków jest w KROKU 4B.

Punkty 2–4 to zakładanie kont — muszę je robić z Tobą, bo wymagają Twojego
logowania. Sam nigdzie się nie loguję.

---

## KROK 2. Domena — `kam24h.pl`

Strona stoi pod własną domeną, nie pod adresem z „netlify.app". To ma znaczenie:

- adres z „netlify.app" w reklamie wygląda na tymczasowy i obniża klikalność,
- Google Ads ocenia zgodność reklamy ze stroną docelową — własna domena pomaga,
- reklamy Facebooka na obcych domenach częściej wpadają w ręczną weryfikację,
- domena zostaje Twoja: gdyby kiedyś zmieniać hosting, adres się nie zmienia.

Konfiguracja DNS i kroki w panelu Netlify: patrz `WDROZENIE.md`.

> **Uwaga:** `kam24h.pl` to inna domena niż `k24h.pl`. Ta druga przekierowuje
> dziś na starą aplikację — po uruchomieniu nowej warto ją przepiąć albo
> przekierować na `kam24h.pl`, żeby nie krążyły dwie różne wyceny.

---

## KROK 3. Co dokładnie liczymy jako sukces

Strona wysyła te zdarzenia (już działają, czekają tylko na numery kont):

| Zdarzenie | Kiedy | Do czego służy |
|---|---|---|
| `wycena_start` | wybór materiału | widać, ilu ludzi w ogóle zaczyna |
| `wycena_dekor` | wybór dekoru | tu odpada najwięcej niezdecydowanych |
| `wycena_gotowa` | klient zobaczył kwotę | **mikrokonwersja** — dobra do uczenia kampanii na starcie |
| `formularz_wyslany` | kliknął „wyślij" | — |
| `lead_wyslany` | strona `/dziekujemy.html` | **KONWERSJA GŁÓWNA** |
| `klik_telefon` | kliknięcie w numer | **KONWERSJA** — na komórce najczęstsza |

**Ważne:** konwersja główna liczy się dopiero na stronie „dziękujemy", czyli
po realnie przyjętym zgłoszeniu. Dzięki temu Google nie uczy się na
przypadkowych kliknięciach.

W Google Ads ustawiamy **dwie konwersje główne**: `lead_wyslany` i `klik_telefon`.
Wartość konwersji przekazujemy razem z kwotą wyceny — po kilku tygodniach widać,
które frazy przynoszą duże zlecenia, a które ciekawskich.

---

## KROK 4. Google Ads — od czego zacząć

**Jedna kampania w sieci wyszukiwania.** Nie Performance Max na start — PMax
potrzebuje danych o konwersjach, których jeszcze nie ma. Wrócimy do niego,
gdy uzbiera się ~30 leadów miesięcznie.

**Zasięg:** Tarnobrzeg i Sandomierz + **100 km** — czyli tak, jak piszesz na
fanpage'u (Stalowa Wola, Mielec, Nisko, Kolbuszowa, Kielce, Rzeszów, Lublin).
Ustawienie „obecność: osoby przebywające w tej lokalizacji" — nie
„zainteresowane lokalizacją", bo inaczej płacisz za kliknięcia z całej Polski.

> Robisz też realizacje w całej Polsce, ale **na start tego nie reklamujemy**.
> Ogólnopolska kampania na blaty to walka z dużymi firmami przy dużo droższym
> kliknięciu. Lokalnie masz przewagę: własny zakład, dojazd, pomiar następnego
> dnia. Zasięg rozszerzymy, gdy lokalne kampanie zaczną się spinać.

**Grupy reklam — osobno dla różnych intencji:**

1. *blaty kuchenne* — „blaty kuchenne tarnobrzeg", „blat kuchenny na wymiar"
2. *materiał* — „blat konglomerat cena", „blat granitowy kuchnia", „spiek kwarcowy blat"
3. *usługa* — „kamieniarz tarnobrzeg", „parapety granitowe", „blat łazienkowy"

Frazy w dopasowaniu **do wyrażenia** i **ścisłym**. Szerokie dopasowanie dopiero
gdy konwersje zaczną spływać.

**Wykluczenia od pierwszego dnia** (inaczej przepalisz budżet):
`praca`, `zatrudnię`, `używane`, `sam`, `jak zrobić`, `drewniany`, `laminowany`,
`ikea`, `castorama`, `leroy`, `hurtownia`, `płytki`, `nagrobek`, `nagrobki`,
`pomnik`, `pomniki`, `cmentarz`.

> Nagrobki wykluczamy **w tej kampanii**, bo mają własną — patrz KROK 4B.
> Chodzi o to, żeby zapytanie o nagrobek nie trafiło na landing z blatami
> kuchennymi (i odwrotnie). Dwie kampanie, dwa języki, dwa adresy.

**Rozszerzenia (dziś: zasoby):** numer telefonu, lokalizacja (spięta z wizytówką
Google), objaśnienia („bezpłatny pomiar", „własny zakład", „montaż w 7 dni").
Rozszerzenie połączeń jest najważniejsze — na komórce klient dzwoni z poziomu reklamy.

**Harmonogram: poniedziałek–piątek 8:00–18:00** — tak jak odbierasz telefon.
Nic tak nie marnuje budżetu jak kliknięcie o 22:00, gdy nikt nie oddzwoni.
Weekend zostawiamy wyłączony do czasu, aż zobaczymy, ile zapytań przychodzi
w tygodniu — jeśli sobota zacznie się opłacać, włączymy ją osobno z niższą stawką.

> Asystent AI na stronie odpowiada całą dobę, więc wieczorne i weekendowe
> wejścia i tak zbierają zgłoszenia przez formularz. To argument, żeby po kilku
> tygodniach przetestować wąskie okno wieczorne (18:00–21:00) z celem
> „wysłany formularz" zamiast „telefon".

**Strategia stawek:** start na „Maksymalizacja liczby kliknięć" z limitem stawki,
przełączenie na „Maksymalizacja konwersji" po zebraniu ~15–20 konwersji.

---

## KROK 4B. Nagrobki i pomniki — druga kampania, inny świat

To drugi filar firmy i **wymaga zupełnie osobnego ustawienia**. Nie chodzi tylko
o inne słowa kluczowe — chodzi o inny sposób mówienia do człowieka.

### Dlaczego osobno, a nie w jednej kampanii

| | Blaty kuchenne | Nagrobki |
|---|---|---|
| Kto szuka | remontuje, planuje, porównuje | załatwia trudną sprawę, często w żałobie |
| Nastrój | ekscytacja, „jak będzie wyglądać kuchnia" | powaga, obowiązek, presja terminu |
| Język reklamy | „wyceń w 2 minuty", „zobacz dekory" | spokojny, rzeczowy, bez emoji i wykrzykników |
| Co przekonuje | cena, wzór, termin | zaufanie, szacunek, „zajmiemy się wszystkim" |
| Kanał | Google + Facebook | **głównie Google** |

Wysłanie kogoś, kto szuka nagrobka, na stronę z hasłem „Wyceń swój blat
w kilka pytań" to nie tylko stracone kliknięcie — to zła wizytówka firmy.

### Osobny adres docelowy

Rekomendacja: **`nagrobki.kam24h.pl`** (albo `kam24h.pl/nagrobki`) — spokojna
strona z galerią realizacji, przedziałami cenowymi, informacją o zakresie
(projekt, wykonanie, montaż, liternictwo, renowacja) i telefonem na widoku.

**Bez kalkulatora.** Nagrobek to za bardzo indywidualna rzecz — a klikanie
„policz cenę" w takiej sytuacji odbierane jest źle. Zamiast tego: „Zadzwoń,
doradzimy i przygotujemy wycenę" plus prosty formularz kontaktowy.

Mogę taką stronę zbudować na tym samym silniku i stylu, co kreator — powiedz
tylko słowo. Zajmie to podobnie jak obecna strona.

### Słowa kluczowe

1. *ogólne lokalne* — „nagrobki tarnobrzeg", „zakład kamieniarski tarnobrzeg",
   „pomniki nagrobne sandomierz", „nagrobki stalowa wola"
2. *produktowe* — „nagrobek granitowy cena", „nagrobek podwójny",
   „nagrobek pojedynczy", „pomnik z granitu"
3. *usługowe* — „renowacja nagrobka", „liternictwo nagrobkowe",
   „tablica nagrobkowa", „odnowienie pomnika", „montaż nagrobka"

**Wykluczenia:** `blat`, `kuchenny`, `parapet`, `praca`, `używane`, `zdjęcia`,
`wzory za darmo`, `jak zrobić`, `wykonanie samodzielne`, `cennik hurtowy`,
`zasiłek pogrzebowy` (to szukanie informacji, nie kamieniarza).

### Sezonowość — tu jest największa różnica

Zapytania o nagrobki rosną **od sierpnia do końca października**, ze szczytem
przed Wszystkimi Świętymi. Do tego dochodzi drugi, stały strumień: zamówienia
składane kilka–kilkanaście miesięcy po pogrzebie (nagrobek stawia się po
osiadaniu ziemi).

Praktycznie: budżet na wrzesień–październik warto podnieść, ale **rezerwując
moce przerobowe** — reklama, która przyniesie zamówienia niemożliwe do zrobienia
przed 1 listopada, zamienia się w rozczarowanych klientów.

### Czego przy nagrobkach NIE robić

- ❌ **Żadnego agresywnego remarketingu.** Ściganie po internecie reklamą
  nagrobka kogoś, kto właśnie stracił bliską osobę, jest po prostu okrutne
  i tak też zostanie odebrane. Remarketing zostawiamy dla blatów.
- ❌ Żadnych emoji, wykrzykników, „promocja", „ostatnie dni", odliczania czasu.
- ❌ Żadnego targetowania po zdarzeniach życiowych na Facebooku — to zarówno
  wątpliwe etycznie, jak i ryzykowne wobec zasad platformy.
- ❌ Nie mieszać nagrobków do reklam blatów (i odwrotnie) — także w kreacjach
  na Facebooku.

Na Facebooku przy nagrobkach: co najwyżej spokojna obecność wizerunkowa
(zdjęcia realizacji, informacja o zakresie usług). Główny ciężar bierze
Google — bo tam człowiek sam szuka.

---

## KROK 5. Facebook i Instagram

Tu klient **nie szuka** blatu — trzeba mu go pokazać. Dlatego inne podejście:

- **Cel kampanii:** „Potencjalni klienci" z przekierowaniem na stronę wyceny
  (nie formularz błyskawiczny na Facebooku — te leady są dużo słabsze).
- **Kreacje, które działają w tej branży:** zdjęcia „przed i po", film z cięcia
  płyty w zakładzie, blat z wyspą w gotowej kuchni. Rzeczywiste realizacje biją
  grafiki z banków zdjęć.

**Masz już zaplecze, z którego da się to zrobić.** Na fanpage'u
„Kamieniarstwo Dawid Ząbek k24h.pl" publikujesz posty typu „płyta tygodnia"
(AZUL BAHIA, ANDORA WHITE — zdjęcie płyty, opis, cena brutto, telefon).
To dobry materiał wyjściowy, ale pod reklamę wymaga dwóch zmian:

1. **Post o płycie ≠ dobra reklama.** Zdjęcie samej płyty ze stanu
   magazynowego pokazuje towar, a nie efekt. Kliknięcia przynoszą zdjęcia
   **gotowego blatu w kuchni klienta** — dlatego warto przy każdym montażu
   zrobić serię telefonem (blat z wyspą, zlew podblatowy, licowana indukcja,
   cokół przyścienny — to detale, które klienci najczęściej dopytują).
2. **Post, który dobrze zadziała organicznie, promuj jako reklamę.**
   Zamiast wymyślać nowe kreacje: co miesiąc weź post z największą liczbą
   reakcji i podbij go z celem „potencjalni klienci", kierując na kreator wyceny.

Zdjęcia płyt z interstone.pl nadają się do postów o dostępności materiału,
ale **nie do reklam** — to zdjęcia dostawcy, nie Twoje realizacje.
W folderze `Downloads\FANPAGE\OPUBLIKOWANE` (na razie pusty) warto zbierać
to, co już poszło — po kilku miesiącach zrobi się z tego gotowa biblioteka reklam.
- **Grupa:** promień 60–80 km od Tarnobrzega, wiek 28–60, zainteresowania:
  remont, budowa domu, meble kuchenne, wykończenie wnętrz.
- **Remarketing** — najważniejsze: osoby, które zobaczyły wycenę (`ViewContent`),
  ale nie wysłały zgłoszenia. Przekaz: „Twoja wycena wciąż aktualna — umów
  bezpłatny pomiar". To zwykle najtańsze leady w całym zestawie.

Obrazek do udostępniania (og-k24h.png) jest już przygotowany — link wklejony
w post pokaże się z logo i hasłem zamiast gołego adresu.

---

## KROK 6. Remarketing w Google

W GA4 tworzymy dwie listy odbiorców:

1. **„Zaczął wycenę, nie dokończył"** — było `wycena_start`, nie było `lead_wyslany`
2. **„Zobaczył kwotę"** — było `wycena_gotowa`, nie było `lead_wyslany`

Druga grupa to ludzie, którzy znają już cenę i się wahają — najlepszy cel dla
kampanii displayowej z hasłem o bezpłatnym pomiarze. Listy zbierają się same,
gdy tylko GA4 ruszy — im wcześniej podepniemy, tym szybciej będzie z czego robić remarketing.

---

## KROK 7. Rzeczy poza reklamą, które zwykle dają więcej niż budżet

1. **Wizytówka Google (Profil Firmy)** — dla firmy lokalnej to często większe
   źródło telefonów niż płatne reklamy, a jest za darmo. Zdjęcia realizacji,
   godziny, i przede wszystkim **opinie**. Proś każdego zadowolonego klienta
   o opinię — 20 opinii z oceną 4,9 sprzedaje lepiej niż każda reklama.

   ⚠ **Najpierw ustalmy jeden adres.** Na fanpage'u podajesz *Tarnobrzeg,
   ul. Bema 227*, a w kalkulatorze i na k24h.pl jest *ul. Szpitalna 8*.
   Google porównuje adres na stronie, w wizytówce i w rozszerzeniach reklam —
   rozbieżność osłabia pozycję w wynikach lokalnych i potrafi wstrzymać
   weryfikację wizytówki. Jeśli to biuro i plac, trzeba zdecydować, który
   adres jest głównym (albo zgłosić dwie lokalizacje).
2. **Czas oddzwonienia.** Przy zapytaniach z reklam liczy się pierwsza godzina.
   Kto oddzwoni pierwszy, ten zwykle bierze zlecenie.
3. **Zdjęcia własnych realizacji** — do reklam, na stronę i do wizytówki.
   Warto zrobić serię telefonem przy każdym montażu. Osobno blaty, osobno
   nagrobki — te dwa światy nie mieszają się w żadnej kreacji.
4. **Proliner to argument, którego nie używasz wystarczająco.** Pomiar
   laserowy co do milimetra jest realną przewagą nad konkurencją mierzącą
   miarką — wpisałem go już na stronę, warto dać go też w reklamach
   („pomiar Prolinerem — bez szczelin przy ścianie").
4. **Odbieranie telefonu.** Brzmi banalnie, ale każdy nieodebrany telefon
   z reklamy to wyrzucone pieniądze za kliknięcie.

---

## KROK 8. Jak sprawdzić, czy się opłaca

Po miesiącu policz cztery liczby:

```
koszt kampanii ÷ liczba zgłoszeń        = koszt jednego zapytania
liczba pomiarów ÷ liczba zgłoszeń       = % zapytań, które dojrzały do pomiaru
liczba zleceń ÷ liczba pomiarów         = skuteczność zamykania
zysk ze zleceń − koszt kampanii         = wynik
```

Przy zamówieniach rzędu kilku tysięcy złotych kampania ma sens nawet przy
stosunkowo drogim zapytaniu — kluczowe jest, ile z zapytań kończy się pomiarem.
Dlatego mierzymy cały lejek, a nie same kliknięcia.

Realnych stawek za kliknięcie nie zgaduję — sprawdzimy je w Planerze słów
kluczowych Google dla Twojego rejonu, zanim ustawimy budżet.

---

## Czego nie robić

- ❌ Nie kierować reklam na `k24h.pl` — strona firmowa nie ma kreatora ani
  formularza, więc ruch z reklam się rozmyje.
- ❌ Nie startować z szerokim dopasowaniem słów bez wykluczeń.
- ❌ Nie włączać kampanii przed podpięciem konwersji — pierwsze dni uczą algorytm
  i szkoda ich zmarnować.
- ❌ Nie kasować banera zgód „bo przeszkadza" — bez niego Google Ads traci dane
  o konwersjach z Europy, a konto reklamowe może zostać ograniczone.

---

## Co zostaje po mojej stronie, gdy dasz numery kont

1. Wklejenie identyfikatorów do `src/analytics/config.js`
2. Build + wgranie na Netlify
3. Sprawdzenie w podglądzie Google Tag Assistant, czy konwersje wpadają
4. Pomoc przy pierwszej strukturze kampanii i wykluczeniach

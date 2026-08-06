# Pytania do Dawida — zasady wycen

Czego **nie zgadywałem** przy przenoszeniu aplikacji. Do każdego pytania dopisany
jest plik, w którym trzeba nanieść odpowiedź.

---

## 1. Technistone — ZAMKNIĘTE ✅

Specyfikacja potwierdziła wszystko, o co pytałem:

- [x] rabat zakupowy i marża potwierdzone — wartości zapisane w
      `pricing/zrodla/technistone.zasady.json` (poza repozytorium)
- [x] płyta **318,5 × 155 cm**, **tylko całe płyty** (bez połówek)
- [x] pominięte dekory Ambiente Light i Residente Dark
- [ ] zostaje tylko wgranie nowego cennika PDF, gdy dostawca przyśle aktualny
      (wtedy: ceny katalogowe do pola `katalog`, `juzPrzeliczone: false`,
      `npm run cennik` — mnożnik policzy się sam)

→ `pricing/zrodla/technistone.zasady.json` + TODO w `src/firms/technistone.js`

---

## 2. Avant Quartz / Caesarstone / Keralini (Architype)

W starej aplikacji klient płacił **dokładnie cenę z cennika katalogowego**
Architype, czyli całym zarobkiem był rabat zakupowy.

- [ ] Tak ma zostać, czy doliczamy jeszcze marżę na wierzch?
- [ ] Jaki jest rabat u Architype (żeby wiedzieć, ile realnie zostaje)?
- [ ] Czy rabat jest inny dla Avant Quartz, Caesarstone i Keralini?

→ `pricing/zrodla/avant-quartz.zasady.json`, `caesarstone…`, `keralini…`

---

## 2b. Marazzi (gres wielkoformatowy, kolekcja Grande / The Top)

- [x] ~~Kurs EUR/PLN~~ **USTALONE: 4,35** (potwierdzone 6.08.2026).
      Zmiana to jedna liczba w `pricing/zrodla/marazzi.zasady.json`
      + `npm run cennik` — ceny przeliczą się same.
- [x] ~~Które grubości~~ **USTALONE: 12 i 20 mm** (6.08.2026).
      6 mm (okładziny, fronty) pomijamy. Razem 129 dekorów ze 232 pozycji.
- [x] ~~Marża~~ **30% od ceny zakupu** (cennik ma już wliczony rabat B2B 55%
      i 4 EUR transportu) — zgodnie z Twoim poleceniem.

- [x] ~~Format płyty~~ **USTALONE: wg cennika, 162 × 324 cm** dla 12 i 20 mm.
- [x] ~~Połówki~~ **USTALONE: tylko całe płyty.** Przy krótkim blacie
      kalkulator sam pokazuje wtedy Keralini (tam wolno kupić połówkę)
      z konkretną różnicą w cenie — i to samo robi konsultant w rozmowie.

→ `pricing/zrodla/marazzi.zasady.json`, `src/firms/marazzi.js`

---

## 3. Kamień naturalny / Interstone

- [x] ~~Ceny ze stanu magazynowego interstone.pl są netto czy brutto?~~
      **USTALONE: netto.** Sprawdziłem na Twoich postach z fanpage'a —
      AZUL BAHIA 3030,72 zł brutto ÷ 1,23 = 2464 zł, ANDORA WHITE
      1013,52 zł ÷ 1,23 = 824 zł. Obie kwoty netto wychodzą na pełne złote,
      więc interstone.pl podaje netto, a Ty publikujesz brutto.
      Aplikacja liczy tak samo. Daj znać, gdyby to się kiedyś zmieniło.
- [ ] Odpad przy kamieniu naturalnym: ustawiłem **15%** — dobrze?
- [ ] Czy przy kamieniu naturalnym w ogóle chcesz pokazywać klientowi kwotę,
      czy zawsze kierować na telefon/pomiar? (teraz: da się wpisać cenę płyty,
      a bez niej pokazujemy samą obróbkę + montaż i telefon)

→ `src/firms/interstone.js`

---

## 4. Stawki naszego zakładu (wspólne dla wszystkich firm)

Przeniesione ze starej aplikacji. Czy nadal aktualne — i czy są **brutto**?

| Pozycja | Stawka | ? |
|---|---|---|
| Obróbka (docięcie, polerowanie, klejenie) | 350 zł / m.b. | [ ] |
| Transport i montaż | 150 zł / m.b. | [ ] |
| Wycięcie + montaż zlewu podblatowego | 650 zł | [ ] |
| Wycięcie pod zlew nablatowy | 300 zł | [ ] |
| Wycięcie pod płytę nakładaną | 250 zł | [ ] |
| Wycięcie pod płytę licowaną z blatem | 650 zł | [ ] |
| Otwór pod baterię | 120 zł | [ ] |
| Powierzchnia matowa/strukturalna | 60 zł / m² | [ ] |
| Listwa przyścienna | 180 zł / m.b. | [ ] |
| Wykończenie krawędzi (faza, zaokrąglenie) | 90 zł / m.b. | [ ] |
| Zapas na docięcie | 10% | [ ] |

- [ ] Czy montaż liczymy od metra bieżącego, czy raczej ryczałt + dojazd?
- [ ] Minimum zlecenia — jest jakieś? (pole `minimumZlecenia`, dziś puste)

→ `src/firms/_domyslne.js`

---

## 5. Promocje

Stara aplikacja miała kampanie promocyjne (Technistone luty–lipiec 2026,
Wiosna–Lato 2026). Wszystkie **wygasły 31.07.2026**, więc ich nie przenosiłem.

- [ ] Jest nowa promocja na sierpień/jesień? Jeśli tak — wrzucam do `promocje`.

→ pole `promocje` w pliku firmy, opis w `pricing/README.md`

---

## 6. Reklama i dane firmy (potrzebne przed startem kampanii)

- [x] ~~NIP / pełna nazwa firmy~~ **Aaron sp. z o.o., ul. Szpitalna 8,
      39-400 Tarnobrzeg, NIP 8672241748** — wpisane w stopce, polityce
      prywatności i danych strukturalnych.
- [x] ~~Godziny kontaktu~~ **8:00–18:00** — w polityce prywatności i w planie
      harmonogramu reklam.
- [x] ~~Wizytówka Google~~ — jest.
- [x] ~~Konto Google Ads~~ — jest, ale Dawid chce założyć nowe.
- [x] ~~Domena~~ **kam24h.pl** — instrukcja podpięcia w `WDROZENIE.md`.

### Nadal otwarte

- [ ] **Ile opinii ma wizytówka Google?** Od tego zależy, czy przed startem
      reklam warto najpierw pozbierać opinie — przy niskiej ocenie płatny ruch
      konwertuje dużo gorzej.
- [ ] **Adres na fanpage'u to ul. Bema 227**, a na stronie ul. Szpitalna 8.
      Zostawiam Szpitalną (dane rejestrowe), ale jeśli plac jest na Bema —
      trzeba to ujednolicić w wizytówce i postach, bo Google porównuje adresy.
- [ ] **Nowe konto Google Ads** — zakładamy razem, gdy będziesz gotowy;
      logowania sam nie wykonuję.
- [x] ~~Zasięg dojazdu~~ **USTALONE:** Tarnobrzeg/Sandomierz +100 km,
      realizacje w całej Polsce (z Twoich postów). Kampanie na start lokalnie.
- [x] ~~Robisz nagrobki i pomniki?~~ **TAK** — drugi filar firmy.
      Plan osobnej kampanii: `MARKETING.md`, KROK 4B.
- [x] ~~Zdjęcia realizacji~~ — jest fanpage i posty „płyta tygodnia".
      Brakuje zdjęć **gotowych blatów u klientów** (te sprzedają najlepiej)
      i osobno realizacji nagrobkowych.

### Nowe pytania po ustaleniu, że robisz nagrobki

- [ ] **Budujemy stronę `nagrobki.kam24h.pl`?** Rekomenduję osobną, spokojną
      stronę bez kalkulatora — mogę ją zrobić na tym samym silniku i stylu.
- [ ] **Zakres usług nagrobkowych** — projekt, wykonanie, montaż, liternictwo,
      renowacja, obudowy? Co dokładnie wpisać?
- [ ] **Przedziały cenowe nagrobków** — pojedynczy / podwójny / z obudową.
      Czy w ogóle chcesz je pokazywać, czy tylko „wycena po rozmowie"?
- [ ] **Moce przerobowe przed Wszystkimi Świętymi** — ile zamówień jesteś
      w stanie zrobić do 1 listopada? Pod to ustawimy budżet wrzesień–październik.

→ `MARKETING.md`, `src/analytics/config.js`, `polityka-prywatnosci.html`

---

## 7. Asystent AI — decyzje do podjęcia

Czat działa, ale żeby ruszył na stronie, potrzebne są dwie rzeczy od Ciebie
(**klucza nie zakładam i nigdzie nie wpisuję — to musisz zrobić Ty**):

- [ ] **Klucz API Anthropic** — zakładasz konto na console.anthropic.com,
      generujesz klucz i wklejasz go w panelu Netlify jako `ANTHROPIC_API_KEY`.
      Trzeba tam doładować środki (płatność kartą, z góry).
- [ ] **Jaki budżet miesięczny na rozmowy?** Od tego zależy wybór modelu.
      Zgodnie ze specyfikacją ustawiony jest `claude-sonnet-4-6`. Zmiana to jedna linijka
      w `worker/worker.template.js` (stałe MODEL i MAX_TOKENS). Powiedz, ile miesięcznie chcesz na to
      przeznaczyć, a dobiorę model i limity.
- [ ] **Czy chcesz podgląd rozmów?** Dziś rozmowy nigdzie się nie zapisują —
      widzisz tylko zgłoszenia z formularza. Mogę dołączyć skrót rozmowy do
      maila ze zgłoszeniem (wtedy wiesz, o co klient pytał). Wymaga dopisania
      w polityce prywatności.
- [ ] **Przeczytaj wytyczne asystenta** (`worker/prompt.local.md`, poza repozytorium) —
      napisałem je z tego, co wiem o firmie. Popraw wszystko, co brzmi nie
      po Twojemu: czego nie obiecywać, jak mówić o terminach, jak domykać.
- [ ] **Nagrobki w czacie** — teraz asystent nie wycenia ich kalkulatorem,
      tylko kieruje na telefon. Jeśli mają być wyceniane, potrzebuję zasad
      (przedziały cenowe, od czego zależy cena).

→ `worker/prompt.local.md`, `README.md` (sekcja „Asystent AI")

---

## 8. Rzeczy, które celowo wyleciały ze starej aplikacji

- [x] ~~Konsultant AI na czacie~~ **WRÓCIŁ** — na Cloudflare Workerze,
      z kluczem po stronie serwera i wytycznymi poza bundlem klienta.
      Kreator został jako druga ścieżka i awaryjne wyjście.
- **Formularz „zostaw kontakt"** — wysyłał dane na Workera.
  Teraz jest CTA na telefon.
  - [ ] Potrzebny formularz z powiadomieniem na maila? (Netlify Forms — darmowe,
        można dodać w pół godziny)

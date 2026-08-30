---
name: k24-wycena
description: |-
  Ściąga o aplikacji wyceny blatów Kamieniarstwo 24h (kam24h.pl) — architektura, żelazne zasady, konwencje i pułapki.
  Czytaj ZANIM ruszysz cokolwiek w repozytorium k24-wycena: zmiany cen, materiałów, silnika wyceny, workera, panelu, stron miast, oferty dla klienta, maili.
  Szczególnie: cokolwiek dotyka `pricing/`, `src/generated/`, `worker/`, `src/engine/`, stron `blaty-*.html`, albo tekstu, który zobaczy klient.
---

# k24-wycena — jak tu pracować

Aplikacja wyceny blatów kamiennych dla Dawida Ząbka (Aaron sp. z o.o., Tarnobrzeg).
Klient wchodzi na kam24h.pl, klika przez kreator i dostaje kwotę brutto.
To nie jest zabawka — z tych kwot Dawid żyje, a błąd w cenie to jego strata.

## Architektura w pięciu zdaniach

- **Front**: Vite (wielostronicowy build statyczny) + waniliowy JS w `src/`. Hosting: Netlify.
- **Backend**: jeden Cloudflare Worker (`worker/`) — czat asystenta, leady, oferty, panel Dawida.
- **Baza**: Cloudflare D1 (binding `BAZA`) — klienci, wyceny, notatki, ustawienia, wiadomości.
- **Silnik wyceny**: `src/engine/` — czysty, bez DOM-u i bez sieci, dzięki czemu testuje się w gołym node.
- **Źródło prawdy o materiałach**: katalog źródeł cen → generator → `src/generated/*.json`.

### Dwa osobne wdrożenia — łatwo się pomylić

| Co | Jak trafia na produkcję |
|---|---|
| strona, kalkulator, treści | `git push` → Netlify buduje samo |
| worker (czat, panel, oferty, maile) | **wyłącznie ręcznie**: `npx wrangler deploy` |

`git push` NIE wdraża workera. Zmiana w `worker/` bez `wrangler deploy` nie działa u klienta.

## ŻELAZNE ZASADY

### 1. Strzeż tajemnicy handlowej

Ceny zakupowe i marże dostawców Dawida to tajemnica handlowa. **Nie mają prawa
znaleźć się w paczce, którą pobiera przeglądarka.**

- Pliki źródłowe z cenami zakupowymi leżą **poza gitem** (katalog źródeł cen jest w `.gitignore`).
- `npm run cennik` przelicza je na `src/generated/*.json` — tam trafia **wyłącznie
  cena końcowa dla klienta (netto)**, nigdy cena zakupu ani mnożnik.
- Build ma bramkę: `scripts/sprawdz-bundle.mjs` przeszukuje `dist/` i **wywala build**,
  jeśli znajdzie ślad ceny zakupowej. Nie obchodź jej. Jeśli krzyczy — coś naprawdę wyciekło.
- W tym pliku (i w każdym innym w gicie) **nie zapisuj konkretnych kwot ani mnożników** —
  tylko odesłania do plików spoza repozytorium.

Zasady per dostawca (jaki mnożnik, jaki VAT, czy cennik jest netto czy brutto)
są opisane przy każdym źródle, w katalogu spoza gita. Nie zgaduj ich i nie przepisuj tutaj.

### 2. Słowo „rabat" jest zablokowane

W tekstach dla klienta piszemy **„upust"**, nie „rabat". Pilnuje tego test —
`npm test` nie przejdzie, jeśli „rabat" wejdzie do treści klienckiej.

### 3. Każda zmiana kończy się kompletem sprawdzeń

```bash
npm test && node scripts/checklist.mjs && npm run build
```

`npm test` to pełny zestaw (kilkaset testów, sekunda), `checklist.mjs` sprawdza
zgodność ze specyfikacją Dawida (§8), a `build` odpala bramkę wycieku cen.

Gdy ruszasz workera, dodatkowo smoke test na atrapie D1 i dopiero wdrożenie:

```bash
node --test scripts/test-worker-smoke.mjs && npx wrangler deploy
```

⚠ `wrangler` bywa odbijany błędem 7403 („account is not valid or is not
authorized"), mimo poprawnego logowania. Lekarstwo: podaj konto jawnie —
`CLOUDFLARE_ACCOUNT_ID=<id konta> npx wrangler …`. Identyfikator pokaże
`npx wrangler whoami`. Dotyczy tak samo `deploy`, jak `d1 execute`.

Po wdrożeniu **sprawdź, co realnie leży na produkcji** — Netlify potrafi
serwować starą paczkę z cache. Porównaj skrót pliku z `dist/` z tym, co
zwraca kam24h.pl, zanim napiszesz Dawidowi „gotowe".

### 3a. Po każdej większej zmianie: `npm run przeglad`

```bash
npm run przeglad                        # pełny (wymaga Playwrighta)
npm run przeglad -- --bez-przegladarki  # same sprawdzenia HTTP, sekundy
```

Przechodzi produkcję od zewnątrz, tak jak zobaczy ją klient: kalkulator
przez KAŻDĄ wdrożoną kategorię materiału aż do formularza, strony miast
i wyprzedaży, błędy JavaScriptu, wszystkie trasy workera odczytane
z routera, endpointy panelu bez hasła, CORS, sitemapa, linki, grafiki,
układ na 390 px. Kończy się kodem 1, gdy cokolwiek jest nie tak.

**Nie zastępuje testów — uzupełnia je.** Zlecenie z 30.08.2026 („sprawdź,
czy nie mam błędów") wykazało pięć usterek na produkcji przy 613 zielonych
testach jednostkowych. Wszystkie tego samego rodzaju: część działała,
ale nie była **podłączona**. Funkcja z własnymi testami, której nikt nie
wołał; trasa w routerze bez funkcji; widok czytający inne pole niż silnik.
Testy sprawdzają części — przegląd sprawdza, czy części się ze sobą łączą.

Przegląd NIE wysyła zgłoszeń ani maili: zatrzymuje się na formularzu
kontaktowym. Odcina też `/chat`, żeby nie zużywać zapytań do modelu —
kalkulator krok-po-kroku i tak jest ścieżką awaryjną, którą klient
zobaczy przy awarii asystenta, więc musi działać.

### 4. Nie ruszaj cen bez zlecenia

Ceny materiałów zmienia się **tylko wtedy, gdy Dawid o to poprosi**, i tylko
przez `npm run cennik` ze zaktualizowanego źródła. Nigdy ręcznie w `src/generated/`
— generator i tak to nadpisze przy następnym uruchomieniu.

`npm run ceny:audyt` porównuje wygenerowane ceny z regułami źródeł i mówi,
czy coś się rozjechało. Uruchom go, kiedy Dawid pyta „czy ceny są dobre".

## Komendy, które warto znać

| Komenda | Co robi |
|---|---|
| `npm run cennik` | źródła cen → `src/generated/*.json` |
| `npm run ceny:audyt` | audyt: czy ceny zgadzają się z regułami źródeł |
| `npm run ceny:tresc` | kwoty „od…" w treści stron ← z silnika (żeby strony nie kłamały) |
| `npm run miasta` | strony miast + FAQ + dane strukturalne + linki w stopce |
| `npm run sitemap` | odświeża `lastmod` w `public/sitemap.xml` (data z gita, nie z dysku) |
| `npm run galeria` | przetwarza zdjęcia realizacji + generuje `realizacje.html` |
| `npm run worker` | `worker.template.js` → `worker/worker.js` (robi to też `pretest`) |
| `npm run przeglad` | przegląd zdrowia produkcji — po każdej większej zmianie |
| `npm run gbp` | grafiki do wizytówki Google |
| `npm run wyprzedaz` | strona `/wyprzedaz-plyt` ze wzorca (jak strony miast) |

## Konwencje

**Wszystko po polsku.** Nazwy funkcji, zmiennych, testów i komentarzy:
`wycen`, `rozrysuj`, `pakowanie`, `odcinki`. Nie mieszaj angielskiego.

**Komentarze mówią DLACZEGO, nie CO.** Repo jest pełne komentarzy w stylu
„złapane testem, nie na produkcji" albo „bez tego wyszłoby dwa razy to samo".
Trzymaj ten poziom — to jedyna dokumentacja, jaką ma ten projekt.

**Jeden silnik pakowania.** Wycena i rozrys płyt liczą przez ten sam moduł
(`src/engine/nesting.js`, opakowany przez `pakowanie.js`). Kiedyś miały osobne
heurystyki i pokazywały klientowi dwie różne liczby płyt. Nie rozdzielaj ich.

**Strony miast są generowane**, nie pisane ręcznie. Miasto dodaje się w
`scripts/lib/miasta.mjs` i uruchamia `npm run miasta`. Ręczna edycja
`blaty-kuchenne-*.html` zostanie nadpisana przy następnym przebiegu.

**Wyprzedaż płyt = osobna kategoria, nie osobny silnik.** „NATURA
WYPRZEDAŻ" (`src/app/wyprzedaz.js`) to pseudo-firma budowana w locie
z płyt w D1: jeden dekor = jedna fizyczna płyta, każda z własnym formatem
(wpis cennika w postaci `{cena, plyta}`). Nie ma tam drugiego silnika ani
drugiej ścieżki wyceny — jest jeden dodatkowy materiał. Uwaga: cennik
w silniku jest NETTO, a Dawid wpisuje BRUTTO, więc jedyne przeliczenie
to `cenaNettoM2`.

**Podpisy HMAC właściciela.** Linki „tylko dla Dawida" (podgląd oferty, podgląd
szkicu) są podpisane HMAC-SHA256 sekretem panelu i mają termin ważności.
Wzorzec ładunku: `<rodzaj>|<id>|<exp>`. Nie wymyślaj drugiego mechanizmu.

**Szkic → podgląd właściciela → publikacja.** Dawid chce zobaczyć nową rzecz,
zanim zobaczy ją klient. Każda funkcja widoczna publicznie dostaje ten sam
trzytakt: dopóki Dawid nie kliknie „Opublikuj", klient nie widzi nic.

## Pułapki, na które już się nadzialiśmy

- **Pomieszane CRLF i LF.** Repo ma jedno i drugie. Wzorce dopasowywane po
  znaku nowej linii potrafią nie trafić. Generatory normalizują wejście
  (zamiana CRLF na LF przed dopasowaniem) — rób tak samo.
- **Łapczywe regexy przy podmianie JSON-LD.** Wzorzec w rodzaju
  „`"@context"`, cokolwiek leniwie, `"@type": "X"`" przeskakuje z pierwszego
  bloku do drugiego i zjada oba. Kotwicz wzorzec na jego WŁASNYM typie od
  pierwszego znaku. Tak zniknęły dane strukturalne z 14 stron miast —
  na dwa dni, całkowicie niezauważone, bo strony wyglądały tak samo.
- **Minifikacja nazw.** Kod, który porównuje `funkcja.name` albo nazwę klasy,
  po zbudowaniu dostaje `t` zamiast `wycen`. Nie opieraj logiki na nazwach.
- **Limit rozmiaru oferty.** Oferta klienta jest pakowana do jednego ładunku —
  pilnuj górnej granicy, bo duże oferty cicho się urywają. Sposób pakowania
  i limit są opisane przy kodzie oferty w `src/app/`.
- **Stawki z panelu nakładają się per firma.** `app/ustawienia.js#zastosujUstawienia`
  nadpisuje `robocizna`/`opcje` KAŻDEJ firmy z osobna, ale nigdy gołych stałych
  w `_domyslne.js`. Sztuczny materiał zbudowany wprost ze stałych policzy
  obróbkę po staremu i cicho rozjedzie się z resztą aplikacji. Buduj taki
  materiał zawsze na bazie realnej firmy z `FIRMY`.
- **Wpis cennika bywa obiektem.** `firma.dekory[nazwa][grubosc]` to zwykle
  liczba, ale przy markach z kilkoma formatami płyt (Atlas Plan, Pacific,
  wyprzedaż) jest to `{cena, plyta}`. Zawsze przechodź przez `cenaWpisu`
  z `firms/index.js`. `Math.min` po takich obiektach daje NaN — tak zniknęła
  cała lista dekorów Atlas Plan i Pacific z kalkulatora (30.08.2026).
- **Test funkcji ≠ funkcja podłączona.** Trzy z pięciu usterek znalezionych
  30.08.2026 na produkcji to kod, który istniał, miał zielone testy i nie
  był nigdzie wołany. Pisząc zabezpieczenie, dopisz testowi asercję na
  ŚCIEŻCE (przez `wycen()`, przez router, przez widok) albo na źródle
  („czy wywołanie w ogóle jest w kodzie"). Sama funkcja w oderwaniu to
  połowa roboty.
- **Podmiana kodu po numerach linii zjada sąsiadów.** Tak zniknęła funkcja
  obsługująca `/kolekcje` — trasa została, funkcji nie było, produkcja
  oddawała surowy wyjątek workera. Podmieniaj po zakotwiczonym tekście,
  a po większej operacji uruchom `npm run przeglad`.
- **Goły DOM nie odsiewa pustych dzieci.** `h()` z `app/dom.js` pomija
  `null` wśród dzieci, ale `replaceChildren`/`append` zamieniają go na
  TEKST „null" i wstawiają na stronę. Tak przez pięć dni na każdej ofercie
  wysłanej klientowi widniało słowo „null". Pilnuje tego
  `scripts/test-dom-null.mjs`.
- **Format płyty bierz z wyceny, nie z firmy.** `firma.plyta` to wartość
  DOMYŚLNA; pierwszeństwo ma format kampanii, potem format przypisany do
  pozycji cennika (Atlas Plan 20 mm tnie z innej płyty niż 12 mm,
  wyprzedaż ma własny wymiar na każdą sztukę). Silnik oddaje użyty format
  jako `w.plyta` — widoki i maile mają czytać stamtąd.
- **Skrypty node a moduły Vite.** `src/firms/index.js` używa `import.meta.glob`,
  którego node nie zna. Do testów i skryptów jest mikro-paczka
  `scripts/lib/silnik.mjs` (esbuild) — dopisz tam eksport, zamiast obchodzić problem.

## Czego nie robić bez pytania Dawida

- Włączać czegokolwiek płatnego (usługi, plany, limity). Dawid płaci sam —
  twoja rola to powiedzieć **dokładnie, gdzie wejść i co kliknąć**.
- Wysyłać maili do prawdziwych klientów w ramach testu.
- Publikować funkcji, która zmienia to, co widzi klient.
- Zmieniać cen materiałów.

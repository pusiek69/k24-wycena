# Research: jak robi się dziś nowoczesne konfiguratory i kalkulatory leadowe

Data: 23.11.2026. Zamówił Dawid: „przegladni najlepsze fora o ai i sie zastanów jak
najlepiej najładniej to zrobic". Zakres: wzorce do kalkulatora umywalek (faza 1).
Notka jest wejściem do specyfikacji, nie specyfikacją.

Uwaga o jakości źródeł: 90% materiału w sieci na ten temat to blogi firm
sprzedających konfiguratory. Liczby konwersji traktuję jako kierunkowe, nie jako
dowód. Wszędzie, gdzie podaję procent, piszę czyj jest.

---

## 1. Bramka cenowa — wzorzec „partial gating"

Najmocniejszy konkret z całego researchu i jednocześnie korekta naszego planu.

Źródła zgodnie opisują trzy warianty i jeden z nich wypada najlepiej:
- **bez bramki** (cena zawsze widoczna) — najwięcej ruchu, najmniej leadów,
- **pełna bramka** (formularz PRZED jakąkolwiek liczbą) — najwięcej porzuceń,
- **bramka częściowa** (najpierw widełki/orientacja, potem formularz po dokładną
  wycenę) — najlepszy wynik; Social Animal raportuje 47% vs 23% vs 8% zebranych
  kontaktów (dane własne dostawcy, nie audyt).

Drugi zgodny wniosek: **pokazywać widełki, nie jedną kwotę**. Jawnie podpisane
„od–do" ustawia oczekiwania i zostawia miejsce na rozmowę handlową.

Trzeci: **długość formularza** — palvdm cytuje spadek konwersji z ~25% przy 3
polach do ~12% przy 7 polach. Przy dłuższym formularzu: układ wielokrokowy.

> Wniosek dla nas: nasz plan „cena dopiero po formularzu" to pełna bramka —
> wariant najsłabszy z trzech. Propozycja do SPEC: w kroku przed formularzem
> pokazać **widełki** („taka umywalka to zwykle 3 400 – 4 600 zł"), a dokładną
> wycenę z rozbiciem dać po formularzu. Konstrukcja widełek już w repo jest
> (`src/app/widelki.js` z wdrożenia flow pkt 4) — do decyzji Dawida, bo to
> odstępstwo od jego „cene dopiero widzi jak uzupelni formularz".

## 2. UX samego konfiguratora

Wzorce, które powtarzają się u wszystkich (nazwy technik, nie ogólniki):

- **Preset first, potem regulacja.** IKEA pokazuje gotowe warianty i pozwala je
  zmieniać, zamiast startować z pustych suwaków — mniej zmęczenia decyzyjnego.
  U nas: presety 80×46 / 100×50 / 120×50 / 160×50 są w artefakcie Dawida i mają
  być pierwszym, nie piątym elementem ekranu.
- **Krok po kroku dla laika, tryb swobodny dla fachowca.** Stepwise wygrywa u
  klientów detalicznych; swobodne klikanie zostawić panelowi Dawida.
- **Sticky summary.** Przyklejone podsumowanie wyboru (wariant + parametry +
  widełki) w przepływie wielokrokowym; w repo mamy już licznik `KROK X Z 6`
  (`src/app/kroki-postep.js`) — ta sama logika, nowa treść.
- **Walidacja zamiast błędu na końcu.** Reguły wykonalności (np. minimalna
  głębokość przy zlewie zintegrowanym) wpisane w konfigurator, żeby klient nie
  dostał „tego nie zrobimy" po wysłaniu zapytania.
- **Mobile to inny układ, nie zwężony desktop.** Kciukowe CTA na dole ekranu,
  jedno pytanie na ekran, pola tylko dla aktualnego kroku.
- **Hastings (umywalki łazienkowe!)** prowadzi 6 krokami: model → kolor → blat i
  niecka → akcesoria → bateria → zapytanie ofertowe. Dokładnie nasza ścieżka,
  z zapytaniem jako naturalnym końcem, nie jako zaporą.

## 3. Rysunek: 3D czy nie

Decyzja: **nie three.js. Rysunek aksonometryczny w SVG.**

Powody z researchu:
- koszt mobilny 3D siedzi w teksturach i DPR, nie w bibliotece: tekstura
  2048×2048 to 16 MB pamięci GPU niezależnie od wagi JPEG-a; render przy
  `devicePixelRatio` 3 to 9× pikseli bez widocznego zysku (trzeba capować),
  naiwna scena spada do ~12 FPS na średnim Androidzie,
- surowy glTF z CAD to 40–120 MB na wariant; nawet dobrze zoptymalizowany
  konfigurator to 2–3 s ładowania (dane dostawcy),
- żadne źródło nie udowodniło przewagi 3D nad SVG/CSS dla produktu z kilku
  prostopadłościanów — a umywalka to 6–7 prostokątnych formatek,
- kickflip (sprzedawca konfiguratorów!) sam pisze, że dla większości DTC szybkie
  2D bije wolne 3D, bo 3D traci przewagę na lagu i tarciu mobilnym.

Powody z naszego repo (ważniejsze):
- `package.json` ma **zero zależności runtime** (tylko vite + sharp dev).
  three.js byłby największym ciężarem w całym projekcie,
- rysowanie SVG mamy już napisane i przetestowane na telefonie:
  `src/app/rozrys-svg.js` — skalowanie przez `viewBox`, podpisy wymiarów w
  skali rysunku (komentarz w pliku: „rysunek ogląda się GŁÓWNIE NA TELEFONIE"),
  paleta `KOLORY` czytelna też na wydruku mono. To samo podejście, nowa bryła.

Co daje „wrażenie 3D" bez WebGL: aksonometria (stałe kąty, bez perspektywy),
dwa tony na ścianę (góra jaśniejsza, bok ciemniejszy), cień kontaktowy pod
bryłą, animowany `stroke-dasharray` przy zmianie wymiaru, przejście
„bryła → formatki" jako animacja transform na tych samych elementach SVG.

## 4. Techniki „nowoczesności", które warto wziąć

Z przeglądu trendów 2026 — tylko to, co da się zrobić bez biblioteki:

- **CSS scroll-driven animations** (`animation-timeline: view()`) — ujawnianie
  sekcji bez JS i bez observera. Sprawdzić wsparcie w caniuse przed użyciem;
  musi degradować do „widoczne od razu".
- **View Transitions API** (`startViewTransition`) na przejściach między krokami
  kreatora — płynna zmiana zamiast przeskoku. Opcjonalne, za feature detection.
- **Zmienna oś wagi** w nagłówkach zamiast dwóch plików fontów; self-hosted i
  subsetowany (mamy już `--serif-ozdobny: Cormorant`).
- **`text-wrap: balance`** na nagłówkach, **`font-variant-numeric: tabular-nums`**
  na cenach i tabeli formatek (cyfry przestają „skakać" przy przeliczaniu).
- **Spring/overshoot easing** na jednym elemencie (licznik ceny), nie na wszystkim.
- **Micro-interactions** jako potwierdzenie akcji: zmiana suwaka → krótki puls
  na tej pozycji w rozbiciu ceny, która się zmieniła. To jest ta rzecz, która
  robi wrażenie „kalkulator rozumie, co robię".
- Honorować `prefers-reduced-motion` (repo już to robi w dwóch miejscach).

Czego NIE brać: kinetycznej typografii na scrollu, parallaxu, „broken grid",
animowanych gradientów. Przy wycenie blatu to szum, a Priorytet #1 to prostota.

## 5. Anti-slop: czego unikać, żeby nie wyglądało jak generowane AI

To najtwardsza część researchu i dotyczy nas bezpośrednio.

Wzorce, które w 2026 czytają się jako „strona z AI" (Show HN: audyt 1590 landing
pages wg 16 sygnałów; osobny audyt 120 stron — siatka kart z ikoną na górze na
63% z nich):
1. siatka 3–4 kart z ikoną na górze,
2. pigułka/badge nad wycentrowanym nagłówkiem,
3. gradientowy tekst w hero,
4. jedno kursywne słowo serifem w sans-nagłówku,
5. domyślne zestawy: Inter, ikony Lucide, kolory shadcn,
6. emoji jako znaczniki sekcji,
7. fałszywe dowody społeczne (kropki statusu, ściany logo, statystyki z sufitu)
   — wg jednego z audytów tell, który kosztuje najwięcej zaufania,
8. **ciemne tło + pomarańczowy akcent + serif** — komentarz z lipca 2026
   podsumował to jako sygnał strony budowanej przez AI.

Punkt 8 dotyczy wprost artefaktu Dawida: ciemny motyw + pomarańczowe akcenty to
dziś najbardziej rozpoznawalny „look AI". Nasze repo ma na szczęście własną,
starszą tożsamość: kamienne tło (`--slab: #1b1815`, `--stone: #272320`) ze
**złotą żyłą** `--vein: #c9a86a`, krem `--cream: #ece6da`, Cormorant w
nagłówkach. To jest kamieniarstwo, nie szablon.

> Wniosek: zachować z artefaktu Dawida UKŁAD i zachowanie (żywy rysunek,
> presety, pasek udziałów, rozbicie ceny ludzkim językiem), ale ubrać je w
> paletę i typografię kam24h.pl, nie w ciemno-pomarańczowy motyw artefaktu.
> Jeden akcent (złota żyła) na jednym miejscu — licznik ceny.

Jeszcze jedna obserwacja ze źródeł, wygodna dla nas: eksperyment pokazał, że
zakaz tych wzorców wpisany w prompt słabo działa, a **mechaniczny check działa**.
Czyli: lista kontrolna w przeglądzie, nie dobre intencje. Mamy już
`npm run przeglad` — tam jest miejsce na taki check.

## 6. Strona AI — co ludzie realnie robią

Nic w researchu nie zmienia rekomendacji z notatki v3 (pomysł 0 → C → A):
- konfiguratory z „AI" w marketingu w większości robią rekomendację wariantu na
  regułach, nie na modelu — i to wystarcza, żeby klient czuł prowadzenie,
- wszystkie liczby „+300% leadów" przy kalkulatorach AI to materiały dostawców
  bez kontrolowanego testu,
- jedyna rzecz, którą model robi lepiej od reguł na tym etapie: zamiana
  konfiguracji na zdanie po polsku („taka umywalka pasuje do łazienki z…") oraz
  streszczenie leada dla Dawida (pomysł C).

Faza 1: pomysł 0 (reguły), zero wywołań modelu z przeglądarki, limiter przed
jakimkolwiek publicznym endpointem AI — bez zmian.

## 7. Co z tego wchodzi do fazy 1 (propozycje do SPEC)

1. Presety jako pierwszy element, suwaki jako doprecyzowanie.
2. Jedno pytanie na ekran na telefonie, kciukowe CTA, sticky podsumowanie.
3. Rysunek aksonometryczny SVG na bazie `rozrys-svg.js`; „rozłóż na formatki"
   jako animacja transform, nie drugi rysunek.
4. Paleta i typografia z `src/style.css` — zero nowych fontów, zero
   pomarańczowego.
5. Widełki przed formularzem, pełna wycena po (DO DECYZJI DAWIDA — pkt 1).
6. Formularz: maksymalnie 3 pola (telefon lub e-mail, miasto, imię), reszta
   opcjonalna — tak jak w wycenie blatów.
7. `tabular-nums` na cenach, `text-wrap: balance` na nagłówkach,
   `prefers-reduced-motion` honorowane.
8. Lista anti-slop (pkt 5) jako check w przeglądzie, nie jako dobra wola.

Otwarte, czeka na SPEC architekta: wzory na formatki, stawki robocizny
(przykładowe, edytowalne w panelu), kształt bramki, zakres rysunku widocznego
dla klienta.

---

### Źródła

Konfiguratory i UX: configurator.tech (stepwise, walidacja, mobile),
gokickflip.com (2D vs 3D), webmakers.expert (sticky summary), vividworks.com i
zolak.tech (IKEA, Hastings, Tylko, Vitra), emersya.com.
Bramki cenowe: socialanimal.dev (47/23/8%), outgrow.co, orbitforms.ai,
involve.me, palvdm.com (długość formularza), aidtrade.ai (ostrożnie).
3D/mobile: dev.to/gronskideveloper (DPR, instancing, gotchas),
dev.to (16,7 MB → 2,4 MB), creativedevjobs.com, hontran.dev.
Trendy i techniki: elements.envato.com, aidxn.com, line25.com, uxpilot.ai.
Anti-slop: dev.to/alanwest (Slopstrap, 9 telli), falia.co (audyt Show HN),
shipthemes.com, buildtolaunch.substack.com, maxiality.com.

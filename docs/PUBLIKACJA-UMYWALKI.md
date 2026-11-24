# Publikacja kalkulatora umywalek — lista czynności

Strona `/umywalka-na-wymiar` jest **gotowa i działa na produkcji**, ale celowo
ukryta: `noindex, nofollow`, poza sitemapą, bez jednego linku ze strony. Działa
tylko dla kogoś, kto zna adres.

Ten plik istnieje po to, żeby po słowie Dawida **„publikuj"** nie trzeba było
niczego sobie przypominać ani niczego ustalać. Wszystko poniżej to jedno
posiedzenie.

---

## ZANIM COKOLWIEK — dwie rzeczy do potwierdzenia przez Dawida

Publikacja bez nich wypuści w świat ceny, które sami oznaczyliśmy jako
przykładowe.

1. **Stawki [PRZYKŁADOWE] w panelu.** Trzy pozycje liczą się stawkami, których
   Dawid jeszcze nie potwierdził:
   - pogrubienie krawędzi — **200 zł/mb**
   - zlew wycięty w kamieniu — **1200 zł**
   - wycięcie pod umywalkę podblatową — bierzemy istniejącą stawkę
     `zlewPodblatowy` (**450 zł netto**), tę samą co na zlew podwieszany
     w blacie kuchennym. Jeśli umywalka ma mieć własną, trzeba ją dołożyć.
2. **Próg rantu przy baterii — 7 cm [DOMYŚLNE]** oraz **granica 60 cm dla
   kupionej ceramiki [DOMYŚLNE]** (największa nablatowa/podblatowa przy
   przełączeniu typu).

Dopóki to nie jest potwierdzone, publikacja jest przedwczesna — ale strona
może zostać pokazana pojedynczym klientom linkiem, bo działa poprawnie.

---

## KROK 1 — zdjąć `noindex`

Plik `umywalka-na-wymiar.html`, linia z metatagiem:

```html
<meta name="robots" content="noindex, nofollow" />
```

Usunąć całą linię. Nie zastępować jej `index, follow` — brak metatagu znaczy
dokładnie to samo, a mniej się kurzy.

## KROK 2 — dopisać do sitemapy

`public/sitemap.xml`, 41 wpisów, każdy w tym samym kształcie. Dokładamy po
`/blaty-lazienkowe`, bo tam tematycznie należy:

```xml
  <url>
    <loc>https://kam24h.pl/umywalka-na-wymiar</loc>
    <lastmod>RRRR-MM-DD</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
```

`lastmod` = dzień publikacji. `scripts/sitemap-lastmod.mjs` pilnuje dat
pozostałych wpisów.

## KROK 3 — linkowanie ze strony

Dziś **nie ma ani jednego linku** do kalkulatora. Po publikacji powinny być
trzy, w kolejności od najważniejszego:

1. **`/blaty-lazienkowe`** — naturalne miejsce. Klient czytający o blatach
   łazienkowych to ten sam klient. Link w treści, nie w stopce.
2. **Strona główna** — kafel albo zdanie w sekcji o produktach, obok
   kalkulatora blatów.
3. **Menu** — tylko jeśli Dawid chce; menu jest krótkie i każdy nowy wpis
   osłabia pozostałe.

Tekst linku ma zawierać frazę, o którą gramy: „umywalka z kamienia na wymiar",
nie „kalkulator" i nie „sprawdź".

## KROK 4 — dane strukturalne i opis

- Sprawdzić `<title>` i `<meta name="description">` pod kątem frazy
  „umywalka z kamienia na wymiar" + Tarnobrzeg/Podkarpacie.
- Rozważyć `Product` + `Offer` ze schema.org z ceną „od". Kotwica „od … zł"
  jest **liczona silnikiem**, nie wpisana ręcznie, więc nie rozjedzie się
  z rzeczywistością.

## KROK 5 — pomiar

- **GA4**: zdarzenia `umywalka_start`, `umywalka_krok`, `umywalka_formularz`,
  `umywalka_lead` są już w kodzie i działają. Po publikacji warto oznaczyć
  `umywalka_lead` jako konwersję.
- **GSC**: po wdrożeniu „Poproś o zindeksowanie" dla
  `https://kam24h.pl/umywalka-na-wymiar`.

## KROK 6 — bramki przed wypchnięciem

Komplet, jak przy każdej zmianie:

```
npm test
node scripts/checklist.mjs
npm run build
npm run przeglad -- --bez-przegladarki
```

Checklist pokaże **jedną** niezgodność — „§8.1 191 dekorów" — i to jest stan
zastany sprzed kalkulatora umywalek (commit `b435d15` dodał trzy dekory bez
podbicia liczby). Nie blokuje publikacji; czeka na osobną decyzję.

## KROK 7 — po wdrożeniu

- Potwierdzić, że `https://kam24h.pl/umywalka-na-wymiar` **nie ma już**
  `noindex` (`curl -s … | grep robots` ma nic nie zwrócić).
- Sprawdzić, że `https://kam24h.pl/sitemap.xml` zawiera nowy adres.
- Wysłać jedno zgłoszenie testowe i potwierdzić temat „UMYWALKA — …",
  wizualizację w załączniku i SMS.
- Dopisać wpis do `DZIENNIK.md`.

---

## Czego NIE ruszamy przy publikacji

- **Silnika wycen i lejka blatów** — kalkulator umywalek korzysta z tego samego
  silnika, ale niczego w nim nie zmienia. Publikacja to zmiana widoczności,
  nie logiki.
- **Workera** — publikacja nie wymaga ponownego wdrożenia. Worker już umie
  umywalki (wersja `03fb3a92`, wdrożona 24.11.2026).
- **Bramki cenowej** — cena po formularzu zostaje; to była decyzja Dawida,
  nie efekt ukrycia strony.

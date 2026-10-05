# DZIENNIK SEO — kam24h.pl

Pamięć między sesjami SEO. Każda sesja: przeczytaj od góry, dopisz wpis na górze
(najnowsze pierwsze). Szablon wpisu na dole pliku.

---

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

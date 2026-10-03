# DZIENNIK SEO — kam24h.pl

Pamięć między sesjami SEO. Każda sesja: przeczytaj od góry, dopisz wpis na górze
(najnowsze pierwsze). Szablon wpisu na dole pliku.

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

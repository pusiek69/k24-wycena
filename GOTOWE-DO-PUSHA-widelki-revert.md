# GOTOWE DO PUSHA — paczka 21.10.2026: revert widełek + karty wymiarów

Notatka koordynacyjna — nie commitować, skasować po pushu. Dwa commity:

```
fb8d0a0 Wymiary blatu: kazdy odcinek jako karta (mobile)
c8d5334 Revert "Flow 4/4: widelki od-do nad formularzem bramki"
```

## 1. Revert widełek (decyzja: cena dopiero po wysłaniu)
Usunięte: `src/app/widelki.js` + test, blok `.bramka-widelki`, akapit nad
formularzem w `bramka.js`. NIETKNIĘTE: lejek leadów (`wyslijLead`…),
zdarzenia GA4 (`zdarzenieWycena`, `bramka_pokazana`, `konwersjaLead`),
widełki SILNIKA dla kamienia naturalnego po wysłaniu (`w.widelki` —
starsza, inna funkcja), licznik kroków, nagłówki kolorów, Cormorant.

## 2. Karty wymiarów (zlecenie: pola za małe, wszystko się zlewa)
`pomocnikWymiary` + CSS, logika bez zmian (te same pola/stan/wiadomość):
- każdy odcinek = osobna karta (tło, ramka) z nagłówkiem „ODCINEK N"
  i przyciskiem usunięcia 44×44 w nagłówku,
- etykiety GŁĘBOKOŚĆ / DŁUGOŚĆ **nad** polami (nie placeholder-only);
  placeholder pokazuje przykład („60", „np. 300"),
- pola pełnej szerokości, min. 52 px (desktop) / 56 px (dotyk),
  pismo 18 px (blokuje auto-zoom iOS), `inputmode="numeric"` (było),
- jednostka „cm" przy każdym polu; „×" między polami na dotyku schowany,
- pole nazwy odcinka 48 px, większe odstępy między kartami.
Sprawdzone na 375 px i 430 px (emulacja na żywej stronie: „przed" +
symulacja „po" 1:1 z tym commitem — zrzuty w rozmowie z sesji).

`npm test`: 758 zielonych, zero nowych porażek (23 = esbuild w sandboksie).
Procedura: `git pull --rebase` → testy na Windows → `wyslij-zmiany-strony.bat`.
Po deployu zrobię kontrolne zrzuty „po" z produkcji.

Ogon sandboksa (nie mogę usuwać plików) do ręcznego skasowania:
0-bajtowe `src/app/widelki.js`, `scripts/test-widelki.mjs`,
`src/style.css.rej`, `scripts/test-dekory-koloru.mjs`, stare
`GOTOWE-DO-PUSHA-*.md`, katalog `.git/smietnik-sandbox/`.

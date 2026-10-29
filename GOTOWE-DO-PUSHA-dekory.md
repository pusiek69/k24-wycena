# GOTOWE DO PUSHA: audyt dekorów — 2 commity (15.10.2026)

Notatka koordynacyjna, nie commitować; skasować po pushu.

```
c471d5c generated: odswiezony znacznik _wygenerowano (bez zmian cen)
b435d15 Audyt dekorow: 3 nowe dekory z cennika 2026 + naprawa literowek promocji X-XII
```

Decyzje Dawida z 15.10 wykonane:
- **Dodane** (źródła w `pricing/zrodla` zaktualizowane + `npm run cennik`):
  Avant **Patagonia Brive** i **Travertine Lacaze** (cennik 1225 → klient 1593 netto/m², 20 mm),
  Caesarstone **Adamina** (1100 → 1430). Avant: 62→64, Caesarstone: 24→25.
- **Literówki promocji X-XII naprawione u źródła** (ulotka Architype sama je zawiera — kody
  2030 i 5143H): „Botticiono Burges"→**Botticino Bourges**, „White Attica mat"→**White Attica MAT**,
  z notatkami przy pozycjach. Duplikaty z frontu znikną same (dekor promocyjny
  skleja się teraz z katalogowym, silnik pokaże przecenę od ceny regularnej).
- **Calacatta Modane zostaje** — na ulotce to osobny kod **7810**, prawdziwy dekor
  wyłącznie promocyjny (jak Grey Soap).
- 14 dekorów bez cen w cenniku 2026 (10 Avant, 4 Caesarstone) — NIE ruszone, osobna decyzja.

Weryfikacja: `npm test` 763 zielone (23 = znany artefakt esbuild w sandboksie);
generated sprawdzone punktowo (nowe dekory z cenami ×1,30, stare klucze literówek
nieobecne, promocja celuje w nazwy katalogowe obecne w katalogu).

Po pushu front powinien pokazywać: Avant 64 (bez literówkowego duplikatu, +2 nowe),
Caesarstone 31 (25 katalogowych + 6 promocyjnych), a Botticino Bourges i White Attica MAT
z plakietką promocji. Mogę to sprawdzić na produkcji po deployu.

Pamiętaj o kopii zapasowej `pricing/zrodla/` (git go nie chroni) — zmienione:
avant-quartz.zasady/promocje, caesarstone.zasady/promocje.

# AKTUALIZACJA 14.10, po południu: 1 commit do pusha (revert flow 2)

Poprzednia paczka (font, flow 2/3/4) jest już WYPCHNIĘTA i na produkcji.
Po korekcie Dawida doszedł jeden commit do wypchnięcia:

```
72d729a Revert "Flow 2/4: najpierw kolor, nie marka"
```

Wybór materiału wraca do listy MAREK (decyzja Dawida: klient ogląda dekor
u dostawcy po marce i tak samo szuka go w kalkulatorze). Zostają:
grupowanie kolorystyczne w liście wzorów marki (uzupełnienie, nie
zamiennik), widełki ceny, licznik kroków, font Cormorant, poprawki rundy 2.

Procedura jak zwykle: `git pull --rebase` → `npm test` (u mnie 763 zielone;
23 znane esbuildowe) → `wyslij-zmiany-strony.bat`. Workera nie ruszano.

Drobny ogon po sandboksie (nie może kasować plików):
- `scripts/test-dekory-koloru.mjs` — pusty, 0-bajtowy plik NIEśledzony
  (z gita usunięty revertem) → skasować ręcznie,
- `.git/smietnik-sandbox/` — martwe locki gita → skasować,
- ten plik notatki → skasować po pushu.

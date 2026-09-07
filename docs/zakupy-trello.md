# Zakupy z Trello — instrukcja dla Dawida

Panel zbiera teraz w jedno miejsce wszystko, co trzeba kupić z kart w Trello,
sumuje sztuki i grupuje per dostawca. Cztery ławeczki z czterech grobów widać
jako **jedną pozycję „4 szt."**, więc da się zamówić raz, a nie na raty.

**Dopóki nie wklei Pan klucza i tokenu, nic się nie dzieje** — panel nie
łączy się z Trello i niczego tam nie zmienia.

---

## 1. Skąd wziąć klucz i token (5 minut, raz)

**Klucz API**

1. Wejść na **trello.com/power-ups/admin** (zalogowany na to konto, na którym
   jest tablica „Usługi Kamieniarskie").
2. **New** → nazwa dowolna, np. „Panel kam24h" → **Create**.
3. Zakładka **API key** → skopiować długi ciąg z pola **API key**.

**Token**

4. Na tej samej stronie, obok klucza, jest link **Token**. Kliknąć.
5. Trello pokaże pytanie, czy zezwolić — kliknąć **Allow / Zezwól**.
6. Pojawi się drugi długi ciąg. To jest token. Skopiować.

> Token daje dostęp do tablic. Nie wysyłać go mailem ani na czacie —
> wkleja się go bezpośrednio w panelu, do pola, które go nie pokazuje.

## 2. Gdzie to wkleić

1. Panel → sekcja **„Zakupy — połączenie z Trello"**.
2. Wkleić klucz w pierwsze pole, token w drugie → **Zapisz i sprawdź**.
   Panel od razu powie, czy się połączył i jako kto.
3. Kliknąć **Wybierz tablicę** → wybrać **„Usługi Kamieniarskie"** →
   **Użyj tej tablicy**.
4. Kliknąć **Odśwież z Trello**. Lista się pojawi.

Panel pokazuje tylko końcówkę tokenu (cztery znaki), żeby było wiadomo, który
został wklejony. Sam token nigdy nie wychodzi z serwera.

---

## 3. Jak przygotować karty w Trello

**Zasada jest jedna: checklista musi się nazywać „Zakupy".**

Tylko z niej bierzemy pozycje. Dzięki temu listy zadań montażowych czy
terminów nie mieszają się z rzeczami do kupienia.

```
Karta grobu
└── Checklista „Zakupy"
    ├── misa
    ├── ławeczka ze skrzyneczką
    ├── 2x wazon
    └── litery piaskowane srebrne — Kowalski
```

**Dostawca** — dopisek na końcu, po myślniku: `ławeczka — Firma Nowak`.
Wystarczy raz: przy następnej ławeczce bez dopisku panel sam podpowie tę firmę
i oznaczy to jako **„dostawca z historii — sprawdź"**. Podpowiedź wygląda
inaczej niż pewnik, bo pomyłka tutaj to zamówienie u złego dostawcy.

**Ilość** — działa każdy zapis: `2x misa`, `misa x2`, `misa 3 szt`,
`4 szt. ławeczki`. Bez liczby to jedna sztuka.

**Warianty tej samej rzeczy sumują się same.** „ławeczka", „ławeczka ze
skrzyneczką" i „Ławeczka granitowa" to jedna pozycja. Jeśli coś się nie
zsumuje albo zsumuje błędnie — proszę dać znać, dopiszemy wyjątek na stałe.

Karty, których **nazwa** zaczyna się od „zamówić…", panel pokaże osobno jako
podpowiedź („tu chyba też coś trzeba kupić"), ale nie policzy — nie wiadomo
z niej, co i ile.

---

## 4. Codzienna praca

| Chcę | Klikam |
|---|---|
| zobaczyć, co kupić | sekcja **Zakupy**, filtr **Do kupienia** |
| zobaczyć, z których grobów | **ktore groby (3)** przy pozycji |
| zamówić hurtem | **Zamówione** przy pozycji — obejmuje wszystkie sztuki naraz |
| wysłać listę dostawcy | **Kopiuj listę do maila** — gotowy tekst ze sztukami i grobami |
| odnotować dostawę | filtr **Zamówione** → **Otrzymane** |
| pomyłka | filtr **Zamówione** → **Cofnij** |

**Co się dzieje w Trello po kliknięciu „Zamówione":** pozycja zostaje
odhaczona, a do jej nazwy dopisujemy `✅ zamówione [data]`. Dzięki temu
patrząc na samą kartę grobu widać, że rzecz jest w drodze. „Cofnij" odznacza
z powrotem.

Lista odświeża się **sama co 30 minut**. Przycisk **Odśwież z Trello** jest na
wtedy, gdy nie chce się czekać.

---

## 5. Co robić, gdy coś nie gra

| Komunikat | Co znaczy |
|---|---|
| „Trello odrzuciło klucz lub token (401)" | token wygasł albo został cofnięty — wygenerować nowy (punkt 1) i wkleić ponownie |
| „Nie ma czego zapisać" | oba pola były puste — wpisać przynajmniej jedno |
| „Nic tu nie ma" mimo pozycji w Trello | checklista nazywa się inaczej niż **Zakupy** |
| „Zapisane u nas, ale w Trello się nie udało" | status zmienił się w panelu, ale karta w Trello została nietknięta — kliknąć ponownie |
| pozycja w grupie **„Bez przypisanego dostawcy"** | dopisać `— Firma` w Trello albo przypisać w panelu (zapamiętamy) |

---

## Dla programisty

- Logika: `worker/trello.js` (rozbiór tekstu + REST), `worker/zakupy.js`
  (agregacja, statusy, D1). Panel: trasy `/panel/api/zakupy*`.
- Tabele: `zakupy_konfig`, `zakupy_pozycje`, `zakupy_dostawcy`, `zakupy_aliasy`
  — w `worker/schema.sql`.
- Cron `*/30 * * * *` w `wrangler.toml`; handler `scheduled` w
  `worker/worker.template.js`. Bez skonfigurowanego tokenu kończy się po cichu.
- Testy: `scripts/test-zakupy.mjs`.
- Wdrożenie workera **wyłącznie ręcznie**: `CLOUDFLARE_ACCOUNT_ID=… npx wrangler deploy`.

### Czego v1 świadomie nie ma

- **Normalizacji nazw przez AI.** Sumowanie opiera się na heurystyce
  (rdzeń nazwy + tabela aliasów), a nie na modelu. Powód: model przy każdej
  synchronizacji kosztuje, a cron chodzi 48 razy dziennie. Tabela
  `zakupy_aliasy` jest już w bazie i czeka — gdy okaże się, że heurystyka
  gubi konkretne przypadki, dokładamy krok „AI proponuje scalenia, Dawid
  zatwierdza", uruchamiany na żądanie.
- **Zapisu ilości z powrotem do Trello.** Zmieniamy tylko stan pozycji
  i dopisek. Przepisywanie ilości groziłoby nadpisaniem tego, co Dawid
  wpisał ręcznie.

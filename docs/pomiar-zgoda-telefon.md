# Zgoda na telefon — co mierzymy i kiedy

**Decyzja Dawida z 02.09.2026: zostawiamy.** Pytanie „Czy mamy zadzwonić?"
zostaje w formularzu wyceny — wymagane, bez domyślnie zaznaczonej odpowiedzi.
Poprawka obietnicy „Oddzwonimy" zostaje niezależnie od wyniku pomiaru.

Analiza, na której oparta jest ta decyzja: rozmowa z 02.09.2026 (porównanie
trzech wariantów: pole w formularzu / pytanie po wysłaniu / oba).

---

## Termin

**Sprawdzić po 16.09.2026** — dwa tygodnie działania pola.

---

## Co porównujemy

### Miara główna: konwersja formularza (Google Analytics)

```
bramka_pokazana  →  lead_wyslany
```

Oba zdarzenia istnieją w GA od dawna (`src/analytics/zdarzenia.js`), więc
baseline sprzed 02.09 jest już w danych — nie trzeba niczego dosyłać.

**To jest właściwa miara**, bo dzieli przez ruch. Sama liczba zgłoszeń
myli: spadnie tak samo, gdy ubędzie odwiedzin, jak wtedy, gdy formularz
zacznie odstraszać.

### Miara pomocnicza: liczba zgłoszeń dziennie (D1)

Do sprawdzenia, czy nie dzieje się coś, czego GA nie pokazuje:

```sql
SELECT substr(utworzono,1,10) AS d, COUNT(*) AS leadow
FROM klienci GROUP BY d ORDER BY d;
```

```
npx wrangler d1 execute k24h-crm --remote --command "…"
```
(pamiętać o `CLOUDFLARE_ACCOUNT_ID` — bez niego wrangler odbija błędem 7403)

### Przy okazji: czego dowiemy się nowego

```sql
SELECT telefon_zgoda, COUNT(*) FROM klienci
WHERE utworzono >= '2026-09-02' GROUP BY telefon_zgoda;
```

Jaki odsetek klientów w ogóle chce telefonu — tego dziś nie wie nikt.
To informacja wartościowa niezależnie od losu samego pola.

---

## Punkt odniesienia (stan na 02.09.2026, godz. 2:00)

Pole ruszyło **02.09.2026**. Wszystko poniżej to okres SPRZED niego.

| dzień | leadów |
|---|---:|
| 2026-08-20 | 1 |
| 2026-08-21 | 5 |
| 2026-08-22 | 3 |
| 2026-08-23 | 2 |
| 2026-08-24 | 1 |
| 2026-08-25 | 4 |
| 2026-08-26 | 7 |
| 2026-08-27 | 5 |
| 2026-08-28 | 7 |
| 2026-08-29 | 10 |
| 2026-08-30 | 3 |
| 2026-08-31 | 3 |
| 2026-09-01 | 6 |
| **razem** | **57 w 13 dni = 4,38 dziennie** |

Inne liczby z tej samej chwili:

- **61** kart klientów w bazie, wszystkie z pustym `telefon_zgoda`
  („nie pytaliśmy" — to NIE jest zgoda na telefon),
- **12 896 zł** średnia wycena z 60 zgłoszeń z kwotą,
- **23 z 61** klientów (38%) kliknęło cokolwiek pod wyceną — to była liczba,
  która przesądziła o odrzuceniu wariantu „pytamy po wysłaniu",
- **13 z 13** zgłoszeń od 31.08 ma wypełnione pole „termin" — dowód, że pole
  wymagane wypełniają wszyscy.

⚠ Baseline jest **zaszumiony**: w tym samym okresie zmieniło się kilkanaście
innych rzeczy (pasek wyprzedaży, poradnik o konglomeracie, przecelowane
strony, 301). Dlatego miarą główną jest konwersja z GA, a nie surowa liczba
zgłoszeń — ona normalizuje się przez ruch.

---

## Próg reakcji

**Spadek konwersji formularza o więcej niż 10%** względem sierpnia.
Przy ~4,4 zgłoszenia dziennie to mniej więcej 3 zgłoszenia tygodniowo,
przy średniej wycenie 12 896 zł.

| wynik | co robimy |
|---|---|
| spadek ≤ 10% | traktujemy jak szum — zostawiamy bez zmian |
| spadek > 10% | wariant lekki: pole **nieobowiązkowe** w formularzu + to samo pytanie po wysłaniu dla tych, którzy pominęli |

⚠ Przy zmiękczaniu pola **nie wolno** zaznaczać „tak" domyślnie ani uznawać
braku odpowiedzi za zgodę. To wraca dokładnie do sytuacji, przed którą
całe rozwiązanie ma bronić: telefon do kogoś, kto o niego nie prosił.
Reguła `dzwonic('') === false` w `src/app/kontakt-telefon.js` jest tu
najważniejszą linijką i ma test, który jej pilnuje.

---

## Gdzie to siedzi w kodzie

| plik | co robi |
|---|---|
| `src/app/kontakt-telefon.js` | lista odpowiedzi, reguła „brak ≠ zgoda", treść potwierdzenia |
| `src/app/bramka.js` | pytanie w formularzu, walidacja, potwierdzenie po wysłaniu |
| `worker/baza.js` | zapis do D1 (`telefon_zgoda`), ochrona przed skasowaniem odmowy |
| `worker/worker.template.js` | mail leadowy: temat, plakietka, wiersz „Kontakt" |
| `worker/panel.js` | plakietka na karcie, wyszarzony przycisk „Zadzwoń" |
| `scripts/test-kontakt-telefon.mjs` | 14 testów, w tym „BRAK ODPOWIEDZI NIE JEST ZGODĄ" |

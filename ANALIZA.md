# Analiza starego kalkulatora (k24-wycena.netlify.app)

Przejrzałem kod strony linijka po linijce. Poniżej co działało dobrze, co bolało
i co z tego wynikło w nowej wersji.

---

## Co było dobre — i zostało

- **Silnik wyceny był mądry.** Liczenie od CAŁYCH kupionych płyt (a nie od metrażu
  blatu) to rzadkość w kalkulatorach kamieniarskich i realnie chroni marżę.
  Algorytm układania odcinków w płyty przeniosłem prawie 1:1.
- **Estetyka.** Ciemne tło, złoto, szeryfowa typografia — wygląda drożej niż
  konkurencja i to jest atut przy sprzedaży blatów za kilka tysięcy.
- **Rzetelna baza dekorów.** 188 dekorów w czterech kolekcjach z grubościami
  i promocjami — to najcenniejsza rzecz w całym projekcie.
- **Telefon w nagłówku.** Dobry odruch: przy tej wartości zamówienia większość
  ludzi i tak chce zadzwonić.

---

## Co bolało

### 1. Tajemnica handlowa leżała w kodzie strony ⚠

Każdy, kto wcisnął Ctrl+U, widział:

- **cały cennik zakupowy** wszystkich czterech dostawców,
- komentarz z gotowym wzorem przeliczenia ceny katalogowej na sprzedażową —
  czyli rabat i marżę wprost (konkretne liczby zostawiam poza repozytorium),
- **instrukcję dla konsultanta AI**: jak prowadzić rozmowę, kiedy podawać cenę,
  jak odpowiadać na obiekcje, z formułką „Dawid Ząbek, Prezes Firmy".

Konkurencja z Tarnobrzega dowiadywała się z tego, ile Dawid płaci za płytę.

**Teraz:** rabaty żyją poza projektem (`pricing/zrodla/`, poza gitem), do
przeglądarki idą wyłącznie ceny końcowe, a build przerywa się, jeśli
cokolwiek o rabatach spróbuje przeciec.

### 2. Zgubione leady

Wysyłka zgłoszenia kończyła się tak:

```js
fetch(API_BASE+"/lead", {...}).catch(()=>{});   // ← błąd połykany po cichu
f.innerHTML = `<div class="done">Gotowe!</div>`; // ← „wysłane" pokazywane zawsze
```

Jeśli Worker nie odpowiedział — klient widział „Gotowe, zadzwonimy w 24h",
a zgłoszenie nie dotarło nigdzie. Przy płatnym ruchu to znaczy: zapłacone
za kliknięcie, klient stracony, nikt o tym nie wie.

**Teraz:** błąd wysyłki jest pokazywany wprost, z numerem telefonu jako
awaryjną drogą. Zgłoszenia idą przez Netlify Forms — bez własnego serwera,
który może paść.

### 3. Zero pomiaru = kampanie na ślepo

Nie było ani Google Analytics, ani piksela, ani żadnej konwersji.
Google Ads nie miał się na czym uczyć — algorytm optymalizuje pod to, co mu
się pokaże, a nie pokazywano mu nic. Facebook tak samo.

**Teraz:** cały lejek jest mierzony (wejście w kreator → dekor → wycena →
formularz → lead), konwersja odpala się na osobnym adresie `/dziekujemy.html`.

### 4. Brak podstaw prawnych pod reklamy

Nie było **polityki prywatności**, **banera zgód** ani zgody przy formularzu.
Formularz zbierał imię, telefon, miejscowość, zdjęcia i CAŁĄ transkrypcję
rozmowy — bez żadnej klauzuli.

To nie tylko RODO: **Google Ads i Meta odrzucają albo wstrzymują konta reklamowe**
za brak polityki prywatności na stronie docelowej. Kampania mogła paść po tygodniu.

**Teraz:** polityka prywatności, Consent Mode v2, zgoda przy formularzu, minimum danych.

### 5. Wolne wejście na stronę

Plik główny ważył **282 kB**, z czego **220 kB to logo wklejone w kod** jako
base64. Efekt: przeglądarka musiała pobrać całe 282 kB, zanim cokolwiek
narysowała, a logo nie mogło się zapisać w pamięci podręcznej.

Do tego każda odpowiedź konsultanta wymagała zapytania do Cloudflare Workera —
kilka sekund oczekiwania i realny koszt tokenów przy każdej rozmowie.

**Teraz:** logo 12 kB (zamiast 161 kB pliku 471×600 pokazywanego jako 42×54),
strona główna ~20 kB po kompresji, zero zapytań do API. Kreator działa od razu,
także przy słabym zasięgu — a to na komórce decyduje, czy klient zostanie.

### 6. Czat jako pierwsza przeszkoda

Klient z reklamy trafiał na pytanie otwarte: *„czego Pan/Pani szuka: konglomerat
kwarcowy czy spiek kwarcowy?"*. Ktoś, kto pierwszy raz remontuje kuchnię, nie zna
tych słów. Trzeba było **pisać** — a na komórce, w reklamowym ruchu, to duży opór.

Do tego odpowiedzi generował model językowy: przy cenach za kilka tysięcy złotych
istniało realne ryzyko, że powie coś, czego firma nie chce obiecać.

**Teraz:** klikane karty z opisem („ciepły w dotyku" / „można postawić gorący garnek"),
zero pisania, przewidywalne odpowiedzi.

### 7. Drobiazgi, które kosztują kliknięcia

| Problem | Skutek |
|---|---|
| Brak `<meta description>` | Google sam dopisywał opis w wynikach |
| Brak Open Graph | Link wklejony na Facebooka pokazywał się jako goły adres bez obrazka |
| Brak `canonical`, `robots.txt`, mapy witryny | Słabsza widoczność w wyszukiwarce |
| Brak danych strukturalnych firmy | Google nie łączył strony z wizytówką lokalną |
| Formularz bez ochrony przed botami | Spam w skrzynce |
| Brak strony „dziękujemy" | Nie dało się wygodnie ustawić konwersji w Ads |

Wszystkie te punkty są w nowej wersji zamknięte.

---

## Podsumowanie jednym zdaniem

Stary kalkulator był **dobrym prototypem sprzedażowym** z solidną matematyką,
ale **nie nadawał się pod płatny ruch**: zdradzał rabaty, gubił leady, nic nie
mierzył i nie miał podstaw prawnych, których wymagają Google i Meta.

# Wiadomości do klientów — zatwierdzone szablony

Miejsce na treści, które Dawid zaakceptował. Przy każdym kolejnym mailingu
albo nowym szablonie **zacząć od tego pliku**, a nie pisać od nowa —
sformułowania są przez niego przemyślane i część z nich powstała po tym,
jak coś nie zadziałało.

---

## „Czy mogę zadzwonić" — prośba o kontakt telefoniczny

**Zatwierdzona 02.09.2026.** To jest wersja obowiązująca.

```
Dzień dobry,

tu Dawid Ząbek z Kamieniarstwa 24h — [data] przygotowaliśmy dla Państwa
wycenę blatu.

Czy mogę do Państwa zadzwonić, żeby dopytać o szczegóły? W jakich godzinach
najlepiej dzwonić?

Wystarczy krótka odpowiedź na tego maila.
```

### ⚠ Czego w tej wersji NIE MA — i to jest decyzja, nie przeoczenie

Pierwotna wersja kończyła się akapitem:

> ~~Jeśli wolą Państwo załatwić wszystko na piśmie albo temat jest już
> nieaktualny — proszę o jedno słowo, nie będę dzwonić.~~

**Dawid kazał go usunąć po pierwszej wysyłce (02.09.2026).** Nie dopisywać go
z powrotem „dla porządku" ani nie proponować podobnych zdań w nowych
szablonach bez pytania.

Sama prośba o zgodę zostaje w treści — pytanie „czy mogę zadzwonić?" jest
pytaniem, a nie zapowiedzią, więc klient nadal może odpisać „nie".

### Jak używać

- **`[data]` podstawia się RĘCZNIE** — panel wstawia tylko imię, treść
  wiadomości idzie dosłownie tak, jak zostanie wklejona.
- Format daty w treści: **„31 sierpnia"** (dzień + miesiąc słownie).
- **Bez podpisu w treści** — szablon maila dokleja stopkę sam.
- **Bez kwot.** Ta wiadomość umawia rozmowę, nie sprzedaje.
- Nad wklejoną treścią mail dopisuje automatycznie
  *„Pan(i) [imię] — odpisałem na Państwa pytanie o wycenę:"*. Przy karcie
  bez imienia zostaje samo „odpisałem…".

---

## Historia wysyłek

Żeby nikt nie dostał tego samego dwa razy.

| data | co poszło | do kogo |
|---|---|---|
| 02.09.2026 | „Czy mogę zadzwonić" (wersja z usuniętym akapitem — patrz wyżej; wysłana jeszcze w wersji pierwotnej) | **24 leady** ze zgłoszeń **20–27.08.2026**, status „Oferta wysłana" |

Kolejny mailing do tej grupy: sprawdzić najpierw, czy odpowiedzieli —
odpowiedzi wracają na Gmaila Dawida i pojawiają się w wątku „Rozmowa"
na karcie klienta.

---

## Którędy to wychodzi (stan na 02.09.2026)

Panel ma **dwie** drogi do klienta i różnią się tym, co ten dostanie.

| droga | co widzi klient | warunek |
|---|---|---|
| **Rozmowa → „Odpisz klientowi…"** | sama wiadomość, **bez kwoty**; temat „Odpowiedź od Dawida Ząbka" | wycena musi mieć `wersja='dawid'` |
| **„Powtórz wycenę" + dopisek** | wiadomość **plus pełna oferta z kwotą** u góry; temat „Wycena przygotowana przez Dawida Ząbka" | działa zawsze |

Do wiadomości w rodzaju „czy mogę zadzwonić" właściwa jest **pierwsza** —
druga wysyła klientowi nową ofertę z ceną, której nikt nie zamawiał,
a przy kliencie, który ma już ofertę, kwota może wyjść inna niż poprzednio.

### Ograniczenia, o których warto pamiętać

- **Pole odpowiedzi pojawia się tylko przy wycenie z `wersja='dawid'`**,
  czyli takiej, którą Dawid wysłał jako ofertę. Przy samych wycenach
  z kalkulatora sekcji „Rozmowa" nie ma wcale.
- **Panel nie ma linków do pojedynczych kart** — nie zapisuje nic w adresie.
  Kartę znajduje się przez pole „Szukaj: nazwisko, telefon, mail,
  miejscowość" (najpewniej po mailu).
- **Jeden klient naraz.** Wysyłki zbiorczej nie ma i Dawid świadomie jej
  nie zamawiał (02.09.2026: „żadnej nowej wysyłki zbiorczej nie budujemy").
- Po kliknięciu **„Wyślij odpowiedź"** mail idzie **natychmiast**, bez
  podglądu. Potwierdzenie pod przyciskiem: „Wysłane — klient dostał maila."
- Komunikat **„Zapisane, ale mail nie wyszedł (brak adresu?)"** znaczy, że
  wiadomość została w panelu, a klient jej NIE dostał. Warto na niego
  patrzeć po każdej wysyłce.

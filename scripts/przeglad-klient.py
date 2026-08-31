# -*- coding: utf-8 -*-
"""
ŚCIEŻKI KLIENTA — przeglądarkowa część przeglądu (`npm run przeglad`).

Wywoływane przez scripts/przeglad.mjs; da się też uruchomić wprost:

    python scripts/przeglad-klient.py --adres https://kam24h.pl

Co sprawdza:
  • kalkulator od wejścia do formularza kontaktowego dla KAŻDEJ kategorii
    materiału, jaka jest dziś wdrożona (lista czytana ze strony, nie z kodu),
  • pole „Kiedy planujesz blat?" i jego walidację,
  • stronę wyprzedaży (także gdy nic nie jest wystawione),
  • błędy JavaScriptu i odpowiedzi 4xx/5xx na kluczowych stronach,
  • układ na telefonie (390 px) — czy nic nie wychodzi poza ekran.

NIE wysyła zgłoszenia. Zatrzymuje się na formularzu i sprawdza, że jest
kompletny — mail do klienta i karta w bazie to skutki uboczne, których
przegląd nie ma prawa wywoływać.

Każdy znaleziony problem wypisujemy z prefiksem PROBLEM — po tym słowie
skrypt nadrzędny poznaje, że przegląd nie jest czysty.
"""
import argparse
import sys

from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--adres', default='https://kam24h.pl')
ARGS = parser.parse_args()
BAZA = ARGS.adres.rstrip('/')

# Szum spoza naszej kontroli (analityka, blokery) oraz `/chat`, który
# odcinamy sami — patrz `otworz_kreator`.
SZUM = ('googletagmanager', 'google-analytics', 'doubleclick', 'gtag',
        'facebook', 'ERR_BLOCKED', 'favicon', '/chat', 'ERR_FAILED')

problemy = []
bledy_js = []


def zglos(tekst):
    problemy.append(tekst)
    print(f'  PROBLEM  {tekst}')


def ok(tekst):
    print(f'  OK       {tekst}')


def czysty(tekst):
    return not any(s in tekst for s in SZUM)


def podepnij(page, gdzie):
    """Zbiera błędy JS i nieudane żądania z danej strony."""
    page.on('console', lambda m: bledy_js.append(f'{gdzie}: [{m.type}] {m.text[:160]}')
            if m.type == 'error' and czysty(m.text) else None)
    page.on('pageerror', lambda e: bledy_js.append(f'{gdzie}: [wyjątek] {str(e)[:160]}'))
    page.on('response', lambda r: bledy_js.append(f'{gdzie}: {r.status} {r.url[:90]}')
            if r.status >= 400 and czysty(r.url) else None)


def zgoda_cookies(page):
    """Baner zgód zasłania dół ekranu — odklikujemy go raz, najmniej inwazyjnie."""
    try:
        page.click('text=Tylko niezbędne', timeout=3000)
        page.wait_for_timeout(300)
    except Exception:
        pass


def otworz_kreator(page):
    """
    Wchodzi do kalkulatora krok-po-kroku.

    Domyślną ścieżką klienta jest rozmowa z asystentem; klasyczny kreator
    pokazuje się, gdy asystent nie odpowiada. ODCINAMY więc `/chat`
    (w `main()`): dostajemy dokładnie ten kreator, który zobaczy klient
    przy awarii konsultanta — i nie zużywamy przy tym ani jednego zapytania
    do modelu, za które płaci Dawid.
    """
    page.goto(f'{BAZA}/#kreator', wait_until='networkidle')
    zgoda_cookies(page)
    try:
        page.click('button:has-text("Policz kreatorem")', timeout=4000)
        page.wait_for_timeout(600)
    except Exception:
        pass
    if page.locator('button.choice').count():
        return True
    # Czat woła `/chat` dopiero po pierwszym wyborze klienta — wymuszamy go.
    try:
        page.click('button:has-text("Blat kuchenny")', timeout=4000)
        page.wait_for_timeout(1800)
        page.click('button:has-text("Policz kreatorem")', timeout=15000)
        page.wait_for_timeout(800)
    except Exception:
        pass
    return page.locator('button.choice').count() > 0


def przejdz_kategorie(page, nazwa):
    """Materiał → dekor/płyta → wymiary → obróbki → formularz."""
    # Między kategoriami wracamy „Nową wyceną", jak klient, który się rozmyślił.
    if not page.locator('button.choice').count():
        try:
            page.click('button:has-text("Nowa wycena")', timeout=5000)
            page.wait_for_timeout(700)
        except Exception:
            pass
    if not page.locator('button.choice').count() and not otworz_kreator(page):
        zglos(f'{nazwa}: nie udało się wejść do kreatora')
        return

    try:
        page.click(f'button.choice:has(.c-name:text-is("{nazwa}"))', timeout=8000)
    except Exception:
        zglos(f'{nazwa}: nie da się wybrać kategorii')
        return
    page.wait_for_timeout(700)

    dekorow = page.locator('button.dekor').count()
    plyt = page.locator('.plyta-karta').count()

    if dekorow:
        page.locator('button.dekor').first.click()
    elif plyt:
        page.locator('.plyta-karta').first.click()
    else:
        # Kamień naturalny: cena wpisywana ręcznie, brak listy wzorów.
        try:
            page.click('button:has-text("Dalej")', timeout=4000)
        except Exception:
            zglos(f'{nazwa}: brak dekorów, płyt i wyjścia dalej')
            return
    page.wait_for_timeout(700)

    # Nietypowe wymiary + drugi odcinek — żeby ruszyć rozkrój, a nie liczyć
    # wciąż tego samego domyślnego blatu.
    try:
        page.locator('input[type=number]').nth(0).fill('340')
        page.locator('input[type=number]').nth(1).fill('90')
        page.wait_for_timeout(400)
        page.click('button:has-text("+ dodaj kolejny odcinek")', timeout=3000)
        page.wait_for_timeout(400)
    except Exception:
        pass

    try:
        page.click('button:has-text("Dalej")', timeout=6000)
        page.wait_for_timeout(700)
        page.click('button:has-text("Pokaż wycenę")', timeout=8000)
        page.wait_for_timeout(1200)
    except Exception as e:
        zglos(f'{nazwa}: nie dochodzi do wyceny ({str(e)[:70]})')
        return

    forma = page.evaluate("""() => {
      const f = document.querySelector('.lead-form');
      if (!f) return null;
      const sel = f.querySelector('select[name="termin"]');
      return { pola: [...f.querySelectorAll('[name]')].map(e => e.name),
               terminow: sel ? sel.options.length : 0 };
    }""")
    if not forma:
        zglos(f'{nazwa}: brak formularza kontaktowego po „Pokaż wycenę"')
        return

    brakujace = [p for p in ('telefon', 'email', 'miejscowosc', 'termin', 'zgoda')
                 if p not in forma['pola']]
    if brakujace:
        zglos(f"{nazwa}: formularz bez pól {', '.join(brakujace)}")
        return
    if forma['terminow'] < 6:
        zglos(f"{nazwa}: lista terminów ma {forma['terminow']} pozycji zamiast 6")

    # Walidacja: wypełniamy wszystko POZA terminem. Selektory zawężone do
    # `.lead-form` — w index.html stoi ukryta kopia formularza dla Netlify
    # z tymi samymi nazwami pól.
    page.fill('.lead-form [name=telefon]', '600100200')
    page.fill('.lead-form [name=email]', 'przeglad@example.com')
    page.fill('.lead-form [name=miejscowosc]', 'Tarnobrzeg')
    page.evaluate("""() => { const z = document.querySelector('.lead-form [name=zgoda]');
                             z.checked = true;
                             z.dispatchEvent(new Event('change', { bubbles: true })); }""")
    page.evaluate("document.querySelector('.lead-form').requestSubmit()")
    page.wait_for_timeout(500)
    blad = page.evaluate(
        "() => document.querySelector('.form-blad:not([hidden])')?.textContent?.trim() || ''")
    if 'planuje' not in blad:
        zglos(f'{nazwa}: formularz przepuszcza zgłoszenie bez terminu realizacji')
        return

    # Przy wyprzedaży „plyt" to liczba KART na ekranie, czyli wzorów — nie
    # sztuk na placu. Nazywamy to wzorami, żeby przegląd nie mówił „1 płyt"
    # wtedy, gdy klient czyta na pasku „8 płyt z placu" (poprawione 01.09.2026).
    ile = f'{dekorow} dekorów' if dekorow else (
        f'{plyt} {"wzór" if plyt == 1 else "wzory" if plyt < 5 else "wzorów"} na wyprzedaży'
        if plyt else 'cena ręczna')
    ok(f'{nazwa} — {ile}, formularz kompletny, walidacja działa')


def sprawdz_strony(ctx):
    """Konsola i sieć na stronach, które klient odwiedza najczęściej."""
    print('\n  strony statyczne:')
    for sciezka in ['/wyprzedaz-plyt', '/blaty-kuchenne-tarnobrzeg', '/blaty-kuchenne-krakow',
                    '/blaty-kuchenne-lublin', '/realizacje', '/blaty-granitowe',
                    '/czesto-zadawane-pytania', '/baza-wiedzy/granit', '/404']:
        s = ctx.new_page()
        podepnij(s, sciezka)
        try:
            s.goto(f'{BAZA}{sciezka}', wait_until='networkidle', timeout=45000)
            s.wait_for_timeout(800)
            ok(f'{sciezka} — {s.title()[:58]}')
        except Exception as e:
            zglos(f'{sciezka}: nie wczytało się ({str(e)[:70]})')
        s.close()


def sprawdz_telefon(br):
    """Układ na 390 px — czy coś nie wychodzi poza ekran."""
    print('\n  telefon 390 px:')
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    ctx.route('**/chat', lambda r: r.abort())
    for sciezka in ['/', '/wyprzedaz-plyt', '/realizacje']:
        pg = ctx.new_page()
        podepnij(pg, f'telefon{sciezka}')
        pg.goto(f'{BAZA}{sciezka}', wait_until='networkidle')
        zgoda_cookies(pg)
        pg.wait_for_timeout(1200)
        stan = pg.evaluate("""() => {
          const d = document.documentElement;
          return { szer: d.clientWidth, przewijanie: d.scrollWidth,
            winne: [...document.querySelectorAll('body *')]
              .filter(e => e.getBoundingClientRect().right > d.clientWidth + 2)
              .slice(0, 4)
              .map(e => e.tagName + '.' + String(e.className).slice(0, 30)) };
        }""")
        if stan['przewijanie'] > stan['szer'] + 2:
            zglos(f"telefon {sciezka}: strona przewija się w bok "
                  f"({stan['przewijanie']} px) — {', '.join(stan['winne'])}")
        else:
            ok(f'{sciezka} — mieści się w 390 px')
        pg.close()
    ctx.close()


def main():
    with sync_playwright() as p:
        br = p.chromium.launch(headless=True)
        ctx = br.new_context(viewport={'width': 1280, 'height': 900})
        # `/chat` odcinamy CELOWO — patrz `otworz_kreator`.
        ctx.route('**/chat', lambda route: route.abort())

        page = ctx.new_page()
        podepnij(page, 'kalkulator')

        if not otworz_kreator(page):
            zglos('kalkulator: nie udało się otworzyć kreatora w ogóle')
        else:
            kategorie = page.evaluate(
                "() => [...document.querySelectorAll('button.choice .c-name')].map(e => e.textContent)")
            print(f'\n  kategorie materiałów ({len(kategorie)}):')
            for k in kategorie:
                przejdz_kategorie(page, k)

        sprawdz_strony(ctx)
        ctx.close()
        sprawdz_telefon(br)
        br.close()

    print('\n  błędy JavaScriptu i odpowiedzi 4xx/5xx:')
    if bledy_js:
        for b in dict.fromkeys(bledy_js):
            zglos(b)
    else:
        ok('brak — konsola czysta na wszystkich sprawdzonych stronach')

    sys.exit(0)


main()

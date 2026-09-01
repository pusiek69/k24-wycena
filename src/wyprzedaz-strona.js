/**
 * STRONA „WYPRZEDAŻ PŁYT" — wejście przeglądarki.
 *
 * Robi to samo, co `podstrona.js` (zgody, telefony, źródło kampanii),
 * a dodatkowo rysuje karty płyt pobrane z workera.
 *
 * Karty budujemy TYM SAMYM kodem co kreator (`app/wyprzedaz-karta.js`),
 * żeby strona i kalkulator nie zaczęły z czasem pokazywać dwóch różnych
 * cen tej samej płyty.
 *
 * Od 01.09.2026 lista ma filtry (materiał, rodzaj płyty), szukanie po nazwie
 * i limit widocznych kart — zlecenie Dawida pod przyszły większy magazyn.
 */
import './style.css';
import { inicjujZgody, zmienZgody } from './analytics/zgody.js';
import { sledzTelefony, zdarzenie } from './analytics/zdarzenia.js';
import { zapamietajZrodlo } from './app/zrodlo.js';
import { h, pusty } from './app/dom.js';
import { doPokazania, filtruj, formaPlyty, kluczDekoru } from './app/wyprzedaz.js';
import { filtryWyprzedazy, przywrocFokus } from './app/wyprzedaz-filtry.js';
import { pobierzPlyty, czyPodglad } from './app/wyprzedaz-dane.js';
import { kartaPlyty } from './app/wyprzedaz-karta.js';
import { dopiszSchemeWyprzedazy } from './app/wyprzedaz-schema.js';

inicjujZgody();
sledzTelefony();
zapamietajZrodlo();

document.getElementById('cookies')?.addEventListener('click', (e) => {
  e.preventDefault();
  zmienZgody();
});

/**
 * Ile kart rysujemy od razu.
 *
 * Każda karta to jedno zapytanie o miniaturę, więc przy stu płytach strona
 * otwierałaby sto połączeń, zanim klient zdąży cokolwiek przeczytać.
 * Reszta dochodzi na kliknięcie — świadome, a nie w tle.
 */
const NA_RAZ = 24;

const box = document.getElementById('wyprzedaz-lista');

if (box) {
  pobierzPlyty().then((wszystkie) => {
    const plyty = doPokazania(wszystkie);
    const stan = { kategoria: null, typ: null, szukaj: '', ile: NA_RAZ };

    if (plyty.length) zdarzenie('wyprzedaz_lista', { plyt: plyty.length });

    /*
     * Dane strukturalne z PRAWDZIWĄ listą płyt (ceny, dostępność, zdjęcia).
     * Dokładamy je po pobraniu, bo lista zmienia się bez wdrożenia strony —
     * wpisana na sztywno kłamałaby dzień po sprzedaniu pierwszej sztuki.
     * Filtry klienta ich NIE dotyczą: Google ma widzieć całą ofertę,
     * a nie to, co akurat wybrał jeden odwiedzający.
     */
    dopiszSchemeWyprzedazy(plyty);

    rysuj();

    function rysuj(opcje = {}) {
      pusty(box);

      /*
       * WSTĄŻKA PODGLĄDU — Dawid musi wiedzieć, że patrzy na szkic.
       * Bez niej zobaczyłby ładną stronę z płytą i uznał, że wyprzedaż
       * już działa, podczas gdy klient nadal nie widzi niczego.
       */
      if (czyPodglad()) {
        box.append(
          h(
            'p',
            { class: 'wyprzedaz-podglad' },
            h('b', {}, 'Podgląd właściciela. '),
            'Tak zobaczy tę stronę klient. Szkic jest widoczny wyłącznie ' +
              'dla Ciebie — żeby go opublikować, wróć do panelu i kliknij ' +
              '„Opublikuj" przy tej płycie.'
          )
        );
      }

      if (!plyty.length) {
        box.append(pustyPlac());
        return;
      }

      const filtry = filtryWyprzedazy(plyty, stan, (o) => rysuj(o));
      if (filtry) box.append(filtry);

      const wybrane = filtruj(plyty, stan);

      if (!wybrane.length) {
        box.append(
          h(
            'div',
            { class: 'wyprzedaz-pusto' },
            h('p', {}, 'Nic nie pasuje do tego wyboru.'),
            h(
              'p',
              {},
              'Proszę zmienić filtr albo ',
              h(
                'button',
                {
                  class: 'wyp-czysc',
                  type: 'button',
                  onclick: () => {
                    stan.kategoria = null;
                    stan.typ = null;
                    stan.szukaj = '';
                    rysuj();
                  },
                },
                'pokazać wszystkie płyty'
              ),
              '.'
            )
          )
        );
        przywrocFokus(box, opcje.zachowajFokus);
        return;
      }

      const widoczne = wybrane.slice(0, stan.ile);

      box.append(
        h(
          'div',
          { class: 'plyty-wyprzedaz' },
          widoczne.map((p) =>
            kartaPlyty(p, {
              statyczna: true,
              /*
               * Klik przenosi na kalkulator z TĄ płytą już wybraną.
               * Numer płyty idzie w adresie, a nie w pamięci przeglądarki,
               * żeby link dało się wysłać klientowi i żeby działał też
               * wtedy, gdy ktoś otworzy go w nowej karcie.
               */
              cta: {
                href: `/#wyprzedaz=${encodeURIComponent(kluczDekoru(p))}`,
                label: 'Policz blat z tej płyty →',
                onclick: () => zdarzenie('wyprzedaz_wybor', { plyta: p.nazwa }),
              },
            })
          )
        )
      );

      if (wybrane.length > widoczne.length) {
        const zostalo = wybrane.length - widoczne.length;
        box.append(
          h(
            'button',
            {
              class: 'btn wyp-wiecej',
              type: 'button',
              onclick: () => {
                stan.ile += NA_RAZ;
                zdarzenie('wyprzedaz_wiecej', { pokazano: stan.ile });
                rysuj();
              },
            },
            `Pokaż kolejne płyty (zostało ${zostalo} ${formaPlyty(zostalo)}) →`
          )
        );
      }

      przywrocFokus(box, opcje.zachowajFokus);
    }
  });
}

function pustyPlac() {
  return h(
    'div',
    { class: 'wyprzedaz-pusto' },
    h('p', {}, 'W tej chwili nie mamy nic na wyprzedaży — wszystko zeszło.'),
    h(
      'p',
      {},
      'Zaglądaj tu od czasu do czasu albo zadzwoń: ',
      h('a', { href: 'tel:+48796991128', 'data-miejsce': 'wyprzedaz-pusto' }, '796 991 128'),
      ' — czasem coś pojawia się na placu z dnia na dzień.'
    )
  );
}

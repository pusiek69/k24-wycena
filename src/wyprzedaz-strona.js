/**
 * STRONA „WYPRZEDAŻ PŁYT" — wejście przeglądarki.
 *
 * Robi to samo, co `podstrona.js` (zgody, telefony, źródło kampanii),
 * a dodatkowo rysuje karty płyt pobrane z workera.
 *
 * Karty budujemy TYM SAMYM kodem co kreator (`app/wyprzedaz-karta.js`),
 * żeby strona i kalkulator nie zaczęły z czasem pokazywać dwóch różnych
 * cen tej samej płyty.
 */
import './style.css';
import { inicjujZgody, zmienZgody } from './analytics/zgody.js';
import { sledzTelefony, zdarzenie } from './analytics/zdarzenia.js';
import { zapamietajZrodlo } from './app/zrodlo.js';
import { h, pusty } from './app/dom.js';
import { doPokazania, kluczDekoru } from './app/wyprzedaz.js';
import { pobierzPlyty, czyPodglad } from './app/wyprzedaz-dane.js';
import { kartaPlyty } from './app/wyprzedaz-karta.js';

inicjujZgody();
sledzTelefony();
zapamietajZrodlo();

document.getElementById('cookies')?.addEventListener('click', (e) => {
  e.preventDefault();
  zmienZgody();
});

const box = document.getElementById('wyprzedaz-lista');

if (box) {
  pobierzPlyty().then((wszystkie) => {
    const plyty = doPokazania(wszystkie);
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
      box.append(
        h(
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
        )
      );
      return;
    }

    zdarzenie('wyprzedaz_lista', { plyt: plyty.length });

    box.append(
      h(
        'div',
        { class: 'plyty-wyprzedaz' },
        plyty.map((p) =>
          kartaPlyty(p, {
            statyczna: true,
            // Klik przenosi na kalkulator z TĄ płytą już wybraną.
            // Numer płyty idzie w adresie, a nie w pamięci przeglądarki,
            // żeby link dało się wysłać klientowi i żeby działał też
            // wtedy, gdy ktoś otworzy go w nowej karcie.
            cta: {
              href: `/#wyprzedaz=${encodeURIComponent(kluczDekoru(p))}`,
              label: 'Policz blat z tej płyty →',
              onclick: () => zdarzenie('wyprzedaz_wybor', { plyta: p.nazwa }),
            },
          })
        )
      )
    );
  });
}

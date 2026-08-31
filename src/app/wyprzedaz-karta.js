/**
 * KARTA PŁYTY Z WYPRZEDAŻY — jeden kod dla kreatora i dla strony.
 *
 * Kalkulator (`app/kroki.js#krokWyprzedaz`) i strona `/wyprzedaz-plyt`
 * pokazują te same płyty. Gdyby każde z nich rysowało kartę po swojemu,
 * prędzej czy później zaczęłyby podawać dwie różne ceny tej samej płyty —
 * ktoś poprawiłby jedno miejsce i zapomniał o drugim.
 *
 * Różnią się tylko zachowaniem: w kreatorze klikalna jest CAŁA karta
 * (klient wybiera materiał), na stronie karta jest statyczna i ma przycisk
 * pod spodem (ktoś może chcieć tylko obejrzeć zdjęcia).
 */
import { h, zl, liczba } from './dom.js';
import { cenaCalejPlyty, upustProcent, formaPlyty } from './wyprzedaz.js';

/**
 * @param {object} p               płyta z `/wyprzedaz`
 * @param {object} [opcje]
 * @param {boolean} [opcje.wybrana]    podświetlenie w kreatorze
 * @param {Function} [opcje.onWybierz] klik w całą kartę (kreator)
 * @param {boolean} [opcje.statyczna]  karta bez reakcji na klik (strona)
 * @param {object} [opcje.cta]         przycisk pod kartą: {href, label, onclick}
 */
/**
 * Zdjęcie płyty, które NIE ZNIKA po cichu.
 *
 * ⚠ Z życia (01.09.2026): adres zdjęcia wskazywał na trasę workera, ale na
 * kam24h.pl trafiał do Netlify i wracał 404. Efekt był najgorszy z możliwych:
 * pusta ramka bez słowa wyjaśnienia. Dawid widział „nie ma zdjęcia" i nie
 * miał jak zgadnąć, czy zapomniał je wgrać, czy coś się popsuło.
 *
 * Sama przyczyna jest naprawiona (proxy w netlify.toml), ale zamiana cichej
 * porażki na widoczną zostaje: gdy obrazek się nie wczyta, w jego miejsce
 * wchodzi ten sam placeholder, co przy płycie bez zdjęcia.
 */
function zdjeciePlyty(p) {
  const img = h('img', {
    class: 'plyta-foto',
    src: p.zdjecie,
    alt: p.nazwa,
    loading: 'lazy',
    onerror: () => img.replaceWith(h('span', { class: 'plyta-foto pusta' }, 'bez zdjęcia')),
  });
  return img;
}

export function kartaPlyty(p, opcje = {}) {
  const upust = upustProcent(p);

  const srodek = [
    p.zdjecie ? zdjeciePlyty(p) : h('span', { class: 'plyta-foto pusta' }, 'bez zdjęcia'),
    h(
      'span',
      { class: 'plyta-opis' },
      h('b', {}, p.nazwa),
      p.opis ? h('span', { class: 'plyta-dopisek' }, p.opis) : null,
      h(
        'span',
        { class: 'plyta-wymiar' },
        `${liczba(p.plytaDlCm)} × ${liczba(p.plytaGlCm)} cm · ${p.gruboscMm} mm`
      ),
      h(
        'span',
        { class: 'plyta-cena' },
        // „Było" pokazujemy tylko wtedy, gdy Dawid je podał — przekreślona
        // cena wzięta z powietrza byłaby zwykłym oszustwem.
        upust ? h('s', {}, `${zl(p.cenaNormalnaM2)}/m²`) : null,
        h('b', {}, `${zl(p.cenaM2)}/m²`),
        upust ? h('span', { class: 'plyta-upust' }, `−${upust}%`) : null
      ),
      // Przy resztce z placu klient kupuje SZTUKĘ, nie metry z niej —
      // więc cena całej płyty jest tą liczbą, która mówi mu prawdę
      // o wydatku na materiał.
      h(
        'span',
        { class: 'plyta-calosc' },
        `cała płyta: ${zl(cenaCalejPlyty(p))} · ` +
          (p.plytZostalo === 1
            ? 'ostatnia sztuka'
            : `zostało ${p.plytZostalo} ${formaPlyty(p.plytZostalo)}`)
      )
    ),
  ];

  if (opcje.statyczna) {
    return h(
      'div',
      { class: 'plyta-karta statyczna' },
      ...srodek,
      opcje.cta
        ? h(
            'a',
            {
              class: 'btn plyta-cta',
              href: opcje.cta.href,
              onclick: opcje.cta.onclick || null,
            },
            opcje.cta.label
          )
        : null
    );
  }

  return h(
    'button',
    {
      class: 'plyta-karta' + (opcje.wybrana ? ' sel' : ''),
      type: 'button',
      onclick: opcje.onWybierz || null,
    },
    ...srodek
  );
}

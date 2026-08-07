import { h, zl, liczba } from './dom.js';
import { opisPlyt } from '../engine/pakowanie.js';
import {
  szukajTanszych,
  tanszaPrzezPolowke,
  rodzajMaterialu,
  nazwaRodzaju,
  nazwaRodzajuMianownik,
} from '../engine/alternatywy.js';
import { zdarzenie } from '../analytics/zdarzenia.js';

const TEL = '796 991 128';

/**
 * KARTA WYCENY — wspólna dla rozmowy i kreatora, żeby obie ścieżki
 * pokazywały dokładnie to samo.
 *
 * Klientowi podajemy WIDEŁKI (±10%, zaokrąglone do 50 zł), a nie jedną kwotę:
 * to wycena bez pomiaru i tak jest uczciwiej.
 */
export function kartaWyceny(w, ustawienia = {}) {
  // Tańsze zamienniki szukają się SAME, zaraz po pokazaniu wyceny.
  // Klient, którego kwota wystraszyła, ma od razu widzieć, że w tym samym
  // rodzaju kamienia różnice bywają ogromne — zamiast zamykać stronę.
  const alternatywy = h('div', { class: 'alternatywy' });
  if (!ustawienia.bezAlternatyw && !w.materialDoUstalenia) {
    setTimeout(() => wypelnijAlternatywy(w, alternatywy), 40);
  }

  return h(
    'div',
    { class: 'karta-wyceny' },
    w.promo ? plakietkaPromo(w) : null,
    naglowek(w),
    h(
      'div',
      { class: 'bloki' },
      blok('1 · Płyta', w.pozycje.filter((p) => p.grupa === 'materiał'), w),
      blok('2 · Cięcie i montaż', w.pozycje.filter((p) => p.grupa === 'usługi'), w)
    ),
    ostrzezenia(w),
    wyborPlyty(w),
    h(
      'div',
      { class: 'info' },
      'Wycena orientacyjna na podstawie podanych wymiarów. ',
      h('b', {}, 'Ostateczną cenę potwierdzamy po bezpłatnym pomiarze'),
      ' — przy nietypowych kształtach, wyspach i blatach łączonych może się różnić.'
    ),
    h(
      'div',
      { class: 'nav' },
      w.firma.linkDekory
        ? h(
            'a',
            { class: 'link-btn', href: w.firma.linkDekory.url, target: '_blank', rel: 'noopener' },
            '↗ ' + w.firma.linkDekory.label
          )
        : null,
      h('a', { class: 'btn', href: 'tel:+48796991128', 'data-miejsce': 'karta-wyceny' }, '☎ ' + TEL)
    ),
    alternatywy
  );
}

/**
 * Zajawka pod wyceną: najtańszy sensowny zamiennik z wyraźną różnicą w cenie.
 * Nie każemy klientowi niczego klikać, żeby ją zobaczyć — ma ją zobaczyć
 * dokładnie wtedy, gdy patrzy na kwotę i się zastanawia.
 */
function wypelnijAlternatywy(w, box) {
  const propozycje = szukajTanszych(w, 3);
  const rodzaj = nazwaRodzaju(rodzajMaterialu(w.firma));

  // Najpierw sprawdzamy przypadek „płacisz za całą płytę, a zejdzie połówka".
  // To najmocniejszy argument, jaki mamy — idzie przed zwykłą zajawką.
  const polowka = tanszaPrzezPolowke(w);
  if (polowka) {
    zdarzenie('alternatywa_polowka', {
      material: polowka.wycena.firma.nazwa,
      oszczednosc: Math.round(polowka.taniejO),
      currency: 'PLN',
    });
    box.replaceChildren(zajawkaPolowka(w, polowka, propozycje, box, rodzaj));
    return;
  }

  if (!propozycje.length) {
    box.replaceChildren(
      h(
        'div',
        { class: 'alt-brak' },
        h('b', {}, '✓ To już najkorzystniejsza opcja '),
        `w tym rodzaju kamienia (${rodzaj}) przy tych wymiarach.`
      )
    );
    zdarzenie('alternatywy_brak');
    return;
  }

  zdarzenie('alternatywy_pokazane', {
    ile: propozycje.length,
    oszczednosc: Math.round(propozycje[0].taniejO),
    currency: 'PLN',
  });
  box.replaceChildren(zajawka(w, propozycje, box, rodzaj, nazwaRodzajuMianownik(rodzajMaterialu(w.firma))));
}

/**
 * „Przy tym wymiarze korzystniej wychodzi Keralini — 4600 zł zamiast 6800 zł".
 * Mówimy wprost, skąd bierze się różnica: tam wolno kupić połówkę płyty,
 * tutaj trzeba całą. Klient ma prawo to wiedzieć przed decyzją.
 */
function zajawkaPolowka(w, prop, propozycje, box, rodzaj) {
  const alt = prop.wycena;
  const p = w.firma.plyta;

  return h(
    'div',
    { class: 'alt-zajawka alt-polowka' },
    h(
      'div',
      { class: 'alt-zajawka-gora' },
      h('span', { class: 'alt-ikona' }, '½'),
      h(
        'div',
        {},
        h(
          'div',
          { class: 'alt-haslo' },
          `Przy tym wymiarze korzystniej wychodzi ${alt.firma.nazwa} — `,
          h('b', {}, zl(alt.razemZaokr)),
          ' zamiast ',
          h('b', {}, zl(w.razemZaokr))
        ),
        h(
          'div',
          { class: 'alt-podhaslo' },
          `${alt.firma.nazwa} · ${alt.dekor}`,
          alt.promo ? h('span', { class: 'alt-promo' }, '★ promocja') : null,
          ` — ${w.firma.nazwa} sprzedajemy tylko w całych płytach ` +
            `${liczbaCm(p.w)} × ${liczbaCm(p.h)} cm, a Pana/Pani blat to ` +
            `${liczba(w.pak.m2Blatu)} m². Tutaj wystarczy pół płyty ` +
            'i płaci Pan/Pani za materiał, który faktycznie idzie na blat.'
        )
      ),
      h(
        'div',
        { class: 'alt-oszczednosc' },
        h('b', {}, `−${zl(prop.taniejO)}`),
        h('span', {}, `${prop.procent}% taniej`)
      )
    ),
    h(
      'div',
      { class: 'nav' },
      h('button', { class: 'btn', type: 'button', onclick: () => pokazWycene(prop, box) }, 'Przelicz na ten wzór →'),
      propozycje.length > 1
        ? h(
            'button',
            {
              class: 'btn ghost',
              type: 'button',
              onclick: (e) => {
                e.currentTarget.remove();
                box.append(pelnaLista(propozycje, box, rodzaj));
              },
            },
            `Zobacz wszystkie tańsze (${propozycje.length})`
          )
        : null
    )
  );
}

/** „Ten sam konglomerat już od 3800 zł — taniej o 1748 zł (29%)" */
function zajawka(w, propozycje, box, rodzaj, rodzajMianownik) {
  const naj = propozycje[0];

  return h(
    'div',
    { class: 'alt-zajawka' },
    h(
      'div',
      { class: 'alt-zajawka-gora' },
      h('span', { class: 'alt-ikona' }, '↓'),
      h(
        'div',
        {},
        h(
          'div',
          { class: 'alt-haslo' },
          `Ten sam ${rodzajMianownik} już od `,
          h('b', {}, zl(naj.wycena.widelki.od))
        ),
        h(
          'div',
          { class: 'alt-podhaslo' },
          `${naj.wycena.firma.nazwa} · ${naj.wycena.dekor}`,
          naj.wycena.promo ? h('span', { class: 'alt-promo' }, '★ promocja') : null,
          ' — te same wymiary, ta sama robocizna i obróbki.'
        )
      ),
      h('div', { class: 'alt-oszczednosc' }, h('b', {}, `−${zl(naj.taniejO)}`), h('span', {}, `${naj.procent}% taniej`))
    ),
    h(
      'div',
      { class: 'nav' },
      h(
        'button',
        {
          class: 'btn',
          type: 'button',
          onclick: () => pokazWycene(naj, box),
        },
        'Przelicz na ten wzór →'
      ),
      propozycje.length > 1
        ? h(
            'button',
            {
              class: 'btn ghost',
              type: 'button',
              onclick: (e) => {
                e.currentTarget.remove();
                box.append(pelnaLista(propozycje, box, rodzaj));
              },
            },
            `Zobacz wszystkie tańsze (${propozycje.length})`
          )
        : null
    )
  );
}

function pelnaLista(propozycje, box, rodzaj) {
  return h(
    'div',
    { class: 'alt-lista' },
    h(
      'div',
      { class: 'alt-naglowek' },
      h('b', {}, 'Tańsze wzory'),
      ` — wszystkie z ${rodzaj}, policzone na tych samych wymiarach i obróbkach.`
    ),
    ...propozycje.map((prop) => wierszAlternatywy(prop, box))
  );
}

function wierszAlternatywy(prop, box) {
  const alt = prop.wycena;
  return h(
    'div',
    { class: 'alt-poz' },
    h(
      'div',
      { class: 'alt-opis' },
      h(
        'div',
        { class: 'alt-nazwa' },
        `${alt.firma.nazwa} · ${alt.dekor}`,
        alt.promo ? h('span', { class: 'alt-promo' }, '★ promocja') : null
      ),
      h('div', { class: 'alt-szczegol' }, `grubość ${alt.grubosc} mm · ${opisPlyt(alt.pak)}`)
    ),
    h(
      'div',
      { class: 'alt-kwota' },
      h('div', { class: 'alt-widelki' }, `${zl(alt.widelki.od)} – ${zl(alt.widelki.do)}`),
      h('div', { class: 'alt-taniej' }, `taniej o ${zl(prop.taniejO)} (${prop.procent}%)`)
    ),
    h(
      'button',
      { class: 'btn ghost alt-btn', type: 'button', onclick: () => pokazWycene(prop, box) },
      'Przelicz'
    )
  );
}

function pokazWycene(prop, box) {
  const alt = prop.wycena;
  zdarzenie('alternatywa_wybrana', {
    material: alt.firma.nazwa,
    dekor: alt.dekor,
    value: Math.round(alt.razemZaokr),
    oszczednosc: Math.round(prop.taniejO),
    currency: 'PLN',
  });

  const karta = kartaWyceny(alt, { bezAlternatyw: true });
  const blok = h(
    'div',
    { class: 'alt-wybrana' },
    h(
      'div',
      { class: 'alt-wybrana-tytul' },
      `Wycena tańszego wzoru: ${alt.firma.nazwa} · ${alt.dekor} — o ${zl(prop.taniejO)} mniej`
    ),
    karta
  );
  box.append(blok);
  blok.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function plakietkaPromo(w) {
  return h(
    'div',
    { class: 'promo-plakietka' },
    h('span', { class: 'promo-gwiazdka' }, '★'),
    h(
      'span',
      {},
      h('b', {}, `PROMOCJA „${w.promo.nazwa}"`),
      ' — cena promocyjna obowiązuje do ',
      w.promo.do,
      w.oszczednosc > 0 ? ' ' : null,
      w.oszczednosc > 0 ? h('span', { class: 'promo-oszczednosc' }, `oszczędność ${zl(w.oszczednosc)}`) : null
    )
  );
}

function naglowek(w) {
  const doUstalenia = w.materialDoUstalenia;
  return h(
    'div',
    { class: 'wynik-head' },
    h(
      'div',
      {},
      h('div', { class: 'q-kicker' }, 'Wycena orientacyjna'),
      h('div', { class: 'q-title' }, `${w.firma.nazwa}${w.dekor ? ' · ' + w.dekor : ''}`),
      h(
        'div',
        { class: 'q-hint' },
        `${opisOdcinkow(w)} · ${liczba(w.pak.mb)} m.b. · ${liczba(w.pak.m2Blatu)} m²` +
          (w.grubosc ? ` · ${w.grubosc} mm` : '')
      )
    ),
    h(
      'div',
      { class: 'kwota' },
      h('div', { class: 'k-lbl' }, doUstalenia ? 'Obróbka i montaż' : 'Razem brutto'),
      h(
        'div',
        { class: 'k-val' },
        doUstalenia ? zl(w.razemZaokr) : `${zl(w.widelki.od)} – ${zl(w.widelki.do)}`
      ),
      h('div', { class: 'k-note' }, doUstalenia ? '+ materiał wg wybranej płyty' : 'z VAT · bez zobowiązań')
    )
  );
}

function blok(tytul, pozycje, w) {
  if (!pozycje.length) return null;
  const suma = pozycje.reduce((a, p) => a + p.brutto, 0);
  const doUstalenia = pozycje.some((p) => p.materialDoUstalenia);

  return h(
    'div',
    { class: 'blok' },
    h('div', { class: 'blok-tytul' }, tytul, tytul.startsWith('1') ? opisPlyty(w) : null),
    h(
      'table',
      { class: 'zestawienie' },
      h(
        'tbody',
        {},
        pozycje.map((p) =>
          h(
            'tr',
            {},
            h('td', {}, p.nazwa, p.detal ? h('small', {}, p.detal) : null),
            h('td', { class: 'kw' }, p.materialDoUstalenia ? 'do ustalenia' : zl(p.brutto))
          )
        ),
        h(
          'tr',
          { class: 'suma' },
          h('td', {}, 'Razem'),
          h('td', { class: 'kw' }, doUstalenia ? 'do ustalenia' : zl(suma))
        )
      )
    )
  );
}

/** Przy firmach bez połówek klient musi wiedzieć, że płaci za całą płytę. */
function opisPlyty(w) {
  if (w.wgMetrazu) return null;
  const p = w.firma.plyta;
  return h(
    'span',
    { class: 'blok-detal' },
    `${opisPlyt(w.pak)} · format ${liczbaCm(p.w)} × ${liczbaCm(p.h)} cm` +
      (p.polowkaDozwolona ? '' : ' · tylko całe płyty')
  );
}

/**
 * „Wybierz swoją płytę" — sekcja tylko dla materiału z magazynu Interstone.
 *
 * Przy kamieniu naturalnym nie ma czegoś takiego jak „ten wzór": każdy blok
 * ma inny rysunek i inną cenę. Zamiast opisywać to słowami, dajemy klientowi
 * link do magazynu z filtrem na jego kamień — zobaczy zdjęcia konkretnych
 * płyt, ich wymiary i ceny. Ceny na interstone.pl są już z marżą Dawida,
 * więc to, co tam zobaczy, zgadza się z tą wyceną.
 */
function wyborPlyty(w) {
  const wybor = w.firma?.wyborPlyty;
  if (!wybor?.url) return null;

  return h(
    'div',
    { class: 'wybor-plyty' },
    h('div', { class: 'wybor-plyty__tytul' }, 'Zobacz i wybierz swoją płytę'),
    h(
      'p',
      { class: 'wybor-plyty__opis' },
      wybor.naturalny
        ? `Każda płyta ${wybor.nazwa} ma własny rysunek i własną cenę. W magazynie zobaczy Pan/Pani ` +
            'zdjęcia konkretnych płyt, ich wymiary i ceny — można wybrać tę, która się spodoba.'
        : `W magazynie zobaczy Pan/Pani dostępne płyty ${wybor.nazwa} wraz z wymiarami i cenami.`
    ),
    h(
      'a',
      {
        class: 'link-btn',
        href: wybor.url,
        target: '_blank',
        rel: 'noopener',
        'data-miejsce': 'magazyn-wybor-plyty',
      },
      '↗ Przejdź do magazynu i wybierz płytę'
    ),
    h(
      'p',
      { class: 'wybor-plyty__nota' },
      'Gdy wybierze Pan/Pani płytę, proszę podać nam jej numer (np. ',
      h('code', {}, 'STON000477 - 92326'),
      ') — telefonicznie pod ',
      h('a', { href: 'tel:+48796991128', 'data-miejsce': 'wybor-plyty' }, TEL),
      ' albo w rozmowie. Zarezerwujemy ją i potwierdzimy ostateczną cenę.'
    )
  );
}

function ostrzezenia(w) {
  const lista = [...w.ostrzezenia];
  if (w.firma.notaKlient) lista.push(w.firma.notaKlient);
  if (!lista.length) return null;
  return h(
    'div',
    { class: 'uwaga' },
    h('b', {}, 'Warto wiedzieć: '),
    h('ul', {}, lista.map((u) => h('li', {}, u)))
  );
}

export function opisOdcinkow(w) {
  const o = (w.odcinki || []).filter((x) => x.dl > 0 && x.gl > 0);
  if (!o.length) return 'blat';
  return o.map((x) => `${Math.round(x.gl)}×${Math.round(x.dl)} cm`).join(' + ');
}

function liczbaCm(n) {
  return String(Math.round(n * 10) / 10).replace('.', ',');
}

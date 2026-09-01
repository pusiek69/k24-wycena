import { h, zl, liczba } from './dom.js';
import {
  rozbicieDlaKlienta,
  opisPrac,
  ETYKIETA_MATERIALU,
  ETYKIETA_PRAC,
} from './pozycje-klienta.js';
import { opisPlyt } from '../engine/pakowanie.js';
import {
  szukajTanszych,
  tanszaPrzezPolowke,
  rodzajMaterialu,
  nazwaRodzaju,
  nazwaRodzajuMianownik,
} from '../engine/alternatywy.js';
import { zdarzenie } from '../analytics/zdarzenia.js';
import { NOTA_ODBIOR } from '../firms/_domyslne.js';

const TEL = '796 991 128';

/** „8%" albo „23%" — bez ułamków, bo stawki są całkowite. */
function procentVat(w) {
  return `${Math.round((w.stawkaVat ?? 0.23) * 100)}%`;
}

/**
 * Adnotacja o stawce VAT.
 *
 * Przy 8% klient MUSI wiedzieć, skąd ta stawka — obniżona dotyczy montażu
 * w lokalach mieszkalnych objętych społecznym programem mieszkaniowym.
 * Ten sam blat do lokalu użytkowego albo na firmę idzie po 23%, więc
 * pokazanie samego „8%" bez warunku byłoby wprowadzaniem w błąd.
 *
 * Przy odbiorze własnym stawka jest zwykła i nie ma czego tłumaczyć —
 * wystarczy powiedzieć, dlaczego to dostawa towaru, a nie usługa.
 */
function notaVat(w) {
  const stawka = w.stawkaVat ?? 0.23;
  return h(
    'div',
    { class: 'info info-vat' },
    stawka < 0.2
      ? [
          h('b', {}, 'Stawka VAT 8%'),
          ' dla montażu w lokalach mieszkalnych (budownictwo objęte społecznym ' +
            'programem mieszkaniowym); dla lokali użytkowych i firm 23%.',
        ]
      : [
          h('b', {}, 'Stawka VAT 23%'),
          ' — przy odbiorze własnym sprzedajemy sam blat, bez usługi montażu. ' +
            'Blat z montażem w mieszkaniu objęty jest stawką 8%.',
        ]
  );
}

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
    h('div', { class: 'bloki' }, blokMaterialu(w), blokUslug(w)),
    ostrzezenia(w),
    wyborPlyty(w),
    // Przy odbiorze własnym NIE ma pomiaru, więc obietnica „potwierdzimy
    // po pomiarze" byłaby nieprawdziwa — i to akurat ta nieprawda, która
    // wraca przy reklamacji.
    h(
      'div',
      { class: 'info' },
      w.odbiorWlasny
        ? [
            'Wycena na podstawie wymiarów podanych przez Państwa. ',
            h('b', {}, 'Przy odbiorze własnym nie wykonujemy pomiaru'),
            ' — prosimy sprawdzić wymiary przed zamówieniem.',
          ]
        : [
            'Wycena orientacyjna na podstawie podanych wymiarów. ',
            h('b', {}, 'Ostateczną cenę potwierdzamy po bezpłatnym pomiarze'),
            ' — przy nietypowych kształtach, wyspach i blatach łączonych może się różnić.',
          ]
    ),
    notaVat(w),
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
  // Format z rozkroju, nie domyślny firmowy — zdanie mówi klientowi
  // konkretny wymiar płyty, więc musi to być TA płyta, z której tniemy.
  const p = w.plyta || w.firma.plyta;

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

/**
 * NAGŁÓWEK PIERWSZEJ WYCENY (przeprojektowany 25.08.2026).
 *
 * Zgłoszenie Dawida: „popraw, żeby była ładniejsza, czytelniejsza i ten
 * zakres cenowy żeby był dobrze widoczny".
 *
 * Było: nazwa, a pod nią jeden zbity ciąg oddzielany kropkami (odcinki ·
 * metry · m² · grubość), a kwota — jedyna rzecz, po którą klient tu
 * przyszedł — kończyła jako ostatni element tym samym drobnym drukiem.
 *
 * Jest: KWOTA na wierzchu i duża, ze złotym akcentem, a parametry rozbite
 * na pary etykieta–wartość, które da się przeczytać wzrokiem z góry na dół.
 */
function naglowek(w) {
  const doUstalenia = w.materialDoUstalenia;

  const wiersz = (etykieta, wartosc) =>
    wartosc
      ? h('div', { class: 'param' }, h('dt', {}, etykieta), h('dd', {}, String(wartosc)))
      : null;

  return h(
    'div',
    { class: 'wynik-head' },

    /* ── kwota: to po nią klient tu przyszedł ── */
    h(
      'div',
      { class: 'kwota-hero' },
      h('div', { class: 'kh-lbl' }, doUstalenia ? 'Obróbka i montaż' : 'Szacowany koszt'),
      h(
        'div',
        { class: 'kh-val' },
        doUstalenia
          ? zl(w.razemZaokr)
          : [
              h('span', { class: 'kh-od' }, zl(w.widelki.od)),
              h('span', { class: 'kh-myslnik' }, '–'),
              h('span', { class: 'kh-do' }, zl(w.widelki.do)),
            ]
      ),
      h(
        'div',
        { class: 'kh-note' },
        doUstalenia
          ? `+ materiał wg wybranej płyty · z VAT ${procentVat(w)}`
          : `brutto, z VAT ${procentVat(w)} · orientacyjnie, doprecyzujemy po pomiarze`
      )
    ),

    /* ── parametry: pary etykieta–wartość, nie ciąg z kropkami ── */
    h(
      'dl',
      { class: 'parametry' },
      wiersz('Materiał', w.firma.nazwa),
      wiersz('Dekor', w.dekor),
      wiersz('Grubość', w.grubosc ? `${w.grubosc} mm` : ''),
      wiersz('Odcinki', opisOdcinkow(w)),
      wiersz('Metry bieżące', `${liczba(w.pak.mb)} m.b. (${liczba(w.pak.m2Blatu)} m²)`)
    )
  );
}

/**
 * KLIENT WIDZI DWIE KWOTY, NIE CENNIK POZYCJI
 *
 * Wcześniej karta rozpisywała każdą pozycję ze stawką — 350 zł/mb za obróbkę,
 * 150 zł za otwór i tak dalej. Decyzja Dawida (11.08.2026): klient ma widzieć
 * „za płyty" i „za produkcję z montażem", a pod drugą kwotą listę tego, co
 * jest w cenie — bez stawek jednostkowych.
 *
 * Pełne rozbicie ze stawkami zostaje w mailu leadowym do firmy — to osobny
 * widok i osobna potrzeba (Dawid wycenia z niego robociznę przed pomiarem).
 */
function blokMaterialu(w) {
  const pozycje = w.pozycje.filter((p) => p.grupa === 'materiał');
  if (!pozycje.length) return null;
  const r = rozbicieDlaKlienta(w.pozycje, { odbiorWlasny: w.odbiorWlasny });

  return h(
    'div',
    { class: 'blok' },
    h('div', { class: 'blok-tytul' }, '1 · ' + ETYKIETA_MATERIALU, opisPlyty(w)),
    h(
      'div',
      { class: 'blok-kwota' },
      h('div', { class: 'blok-opis' }, h('div', {}, pozycje[0].nazwa, r.materialOpis ? h('small', {}, r.materialOpis) : null)),
      h('div', { class: 'blok-suma' }, r.doUstalenia ? 'do ustalenia' : zl(r.material))
    )
  );
}

/*
 * PRACE KAMIENIARSKIE — jedna kwota, bez listy czynności.
 *
 * Do 21.08.2026 stała tu lista „w tej cenie": pomiar Prolinerem, wycięcie
 * pod zlew, otwory, montaż. Klient czytał ją jak menu do skreślania
 * („a bez pomiaru ile?"), zamiast patrzeć na wartość całości — dlatego
 * Dawid kazał ją zwinąć. Pełne rozbicie ma mail firmowy i edytor ofert.
 */
function blokUslug(w) {
  const pozycje = w.pozycje.filter((p) => p.grupa === 'usługi');
  if (!pozycje.length) return null;
  const r = rozbicieDlaKlienta(w.pozycje, { odbiorWlasny: w.odbiorWlasny });

  return h(
    'div',
    { class: 'blok' },
    h('div', { class: 'blok-tytul' }, '2 · ' + ETYKIETA_PRAC),
    h(
      'div',
      { class: 'blok-kwota' },
      h(
        'div',
        { class: 'blok-opis' },
        h('div', {}, opisPrac(w.odbiorWlasny)),
        r.gratisy.length
          ? h('div', { class: 'w-cenie-lbl' }, 'W tym gratis: ' + r.gratisy.join(', ').toLowerCase())
          : null
      ),
      h('div', { class: 'blok-suma' }, zl(r.prace))
    )
  );
}


/** Przy firmach bez połówek klient musi wiedzieć, że płaci za całą płytę. */
function opisPlyty(w) {
  if (w.wgMetrazu) return null;
  /*
   * ⚠ `w.plyta`, NIE `w.firma.plyta`. Format bywa przypisany do pozycji
   * cennika albo do kampanii, więc firmowy domyślny potrafi się różnić
   * od tego, z czego naprawdę liczyliśmy rozkrój. Zanim to poprawiono,
   * karta pisała klientowi „format 324 × 162 cm" przy blacie ciętym
   * z płyt 324 × 159, a przy wyprzedaży — 300 × 180 zamiast prawdziwego
   * wymiaru płyty z placu.
   */
  const p = w.plyta || w.firma.plyta;
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
  // Przy odbiorze własnym to najważniejsza informacja w całej wycenie —
  // stoi jako pierwsza, przed uwagami o materiale.
  if (w.odbiorWlasny) lista.unshift(NOTA_ODBIOR);
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

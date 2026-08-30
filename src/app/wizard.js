import { h, pusty } from './dom.js';
import { firmaWgSlug } from '../firms/index.js';
import { zdarzenie } from '../analytics/zdarzenia.js';
import { krokMaterial, krokDekor, krokWymiary, krokObrobki, krokWynik } from './kroki.js';
import { SLUG as WYPRZEDAZ_SLUG, firmaDlaPlyty, kluczDekoru, plytaWgDekoru } from './wyprzedaz.js';
import { zaladowane } from './wyprzedaz-dane.js';

const KROKI = [
  { id: 'material', label: 'Materiał' },
  { id: 'dekor', label: 'Dekor' },
  { id: 'wymiary', label: 'Wymiary' },
  { id: 'obrobki', label: 'Obróbki' },
  { id: 'wynik', label: 'Wycena' },
];

const WIDOKI = {
  material: krokMaterial,
  dekor: krokDekor,
  wymiary: krokWymiary,
  obrobki: krokObrobki,
  wynik: krokWynik,
};

/**
 * @param {HTMLElement} root
 * @param {object} [opcje]
 * @param {object} [opcje.plyta]  wejście z „policz blat z tej płyty" na
 *   stronie wyprzedaży: kreator startuje z wybraną kategorią „NATURA
 *   WYPRZEDAŻ" i tą konkretną płytą, od razu na kroku „Wymiary".
 *   Klient nie klika przez „Materiał" i „Dekor", bo już wybrał.
 */
export function uruchom(root, opcje = {}) {
  const stan = czystyStan();
  if (opcje.plyta) ustawPlyteWyprzedazy(stan, opcje.plyta);

  const akcje = {
    /*
     * Kategoria wyprzedaży NIE JEST plikiem w `src/firms/` — powstaje
     * w locie z płyt, które Dawid ma dziś na placu. Dlatego trafia tutaj,
     * a nie do `firmaWgSlug`: gdyby wpaść z nią do rejestru firm, każde
     * dołożenie płyty wymagałoby wdrożenia strony.
     *
     * Bierzemy firmę DLA KONKRETNEJ PŁYTY (`firmaDlaPlyty`), bo narzut
     * odpadu i dodatek za obróbkę są cechą płyty, nie całej kategorii —
     * granit z placu ma je inne niż resztka konglomeratu.
     */
    firma: () =>
      stan.firma === WYPRZEDAZ_SLUG
        ? firmaDlaPlyty(zaladowane(), stan.dekor)
        : firmaWgSlug(stan.firma),

    idz(krok) {
      stan.krok = krok;
      render(true);
    },

    wybierzFirme(slug) {
      if (stan.firma !== slug) {
        stan.firma = slug;
        stan.dekor = null;
        stan.grubosc = null;
        stan.cenaRecznaM2 = '';
        stan.szukaj = '';
        stan.opcje = domyslneOpcje(akcje.firma());
      }
      zdarzenie('wycena_start', { material: akcje.firma()?.nazwa });
      akcje.idz('dekor');
    },

    wybierzDekor(nazwa) {
      zdarzenie('wycena_dekor', { material: akcje.firma()?.nazwa, dekor: nazwa });
      stan.dekor = nazwa;
      // Płyta z wyprzedaży ma JEDNĄ grubość — tę, którą Dawid ma na placu.
      // Nie ma czego wybierać, więc ustawiamy ją od razu; przy zwykłym
      // cenniku zostaje null i pyta o nią krok „Wymiary".
      const plyta = plytaWgDekoru(zaladowane(), nazwa);
      stan.grubosc = stan.firma === WYPRZEDAZ_SLUG && plyta ? String(plyta.gruboscMm) : null;
      akcje.idz('wymiary');
    },

    ustawGrubosc(g) {
      stan.grubosc = String(g);
      render();
    },

    ustawOpcje(id, wartosc, przerysuj = true) {
      stan.opcje[id] = wartosc;
      if (przerysuj) render();
    },

    /** Wyjście z wyprzedaży — klient jednak chce coś z cennika. */
    zmienMaterial() {
      Object.assign(stan, czystyStan());
      akcje.idz('material');
    },

    odNowa() {
      Object.assign(stan, czystyStan());
      render(true);
    },
  };

  function render(przewin = false) {
    pusty(root);
    root.append(pasekKrokow(stan, akcje), (WIDOKI[stan.krok] || krokMaterial)(stan, akcje));
    if (przewin) {
      const y = root.getBoundingClientRect().top + window.scrollY - 16;
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    }
  }

  render(!!opcje.plyta);
}

function czystyStan() {
  return {
    krok: 'material',
    firma: null,
    dekor: null,
    grubosc: null,
    cenaRecznaM2: '',
    szukaj: '',
    odcinki: [{ dl: 260, gl: 62 }],
    opcje: {},
  };
}

/**
 * Wejście prosto z konkretnej płyty wyprzedaży (przycisk „Policz blat
 * z tej płyty" na /wyprzedaz-plyt). Materiał i płyta są już wybrane,
 * więc klient ląduje od razu na wymiarach.
 *
 * Ustawiamy TE SAME pola, co zwykły przeklik przez kroki — dzięki temu
 * dalej wszystko działa identycznie i nie ma osobnego „trybu płyty",
 * który mógłby rozjechać się z resztą kreatora.
 */
function ustawPlyteWyprzedazy(stan, plyta) {
  stan.firma = WYPRZEDAZ_SLUG;
  stan.dekor = kluczDekoru(plyta);
  stan.grubosc = String(plyta.gruboscMm);
  stan.opcje = domyslneOpcje(firmaDlaPlyty(zaladowane(), stan.dekor));
  stan.krok = 'wymiary';
}

function domyslneOpcje(firma) {
  const o = {};
  for (const opcja of firma?.opcje || []) {
    if (opcja.typ === 'wybor') o[opcja.id] = opcja.domyslnie ?? opcja.warianty?.[0]?.id;
    else if (opcja.typ === 'liczba') o[opcja.id] = opcja.domyslnie ?? 0;
    else o[opcja.id] = !!opcja.domyslnie;
  }
  return o;
}

function pasekKrokow(stan, akcje) {
  const teraz = KROKI.findIndex((k) => k.id === stan.krok);
  const el = [];
  KROKI.forEach((k, i) => {
    const zrobiony = i < teraz && dostepny(stan, k.id);
    el.push(
      h(
        'span',
        {
          class: 'st' + (i === teraz ? ' now' : zrobiony ? ' done' : ''),
          onclick: zrobiony ? () => akcje.idz(k.id) : null,
        },
        h('b', {}, `${i + 1}. ${k.label}`)
      )
    );
    if (i < KROKI.length - 1) el.push(h('span', { class: 'sep' }, '—'));
  });
  return h('nav', { class: 'steps', 'aria-label': 'Kroki wyceny' }, el);
}

function dostepny(stan, krok) {
  if (krok === 'material') return true;
  if (!stan.firma) return false;
  if (krok === 'dekor') return true;
  // Wyprzedaż ma ceny w cenniku, więc wymaga wybranej płyty — tak samo
  // jak każdy inny materiał cennikowy wymaga wybranego dekoru.
  if (stan.firma === WYPRZEDAZ_SLUG) return !!stan.dekor;
  const f = firmaWgSlug(stan.firma);
  return f?.trybCeny === 'reczna' || !!stan.dekor;
}

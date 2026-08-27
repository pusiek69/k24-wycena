import { h, pusty } from './dom.js';
import { firmaWgSlug } from '../firms/index.js';
import { zdarzenie } from '../analytics/zdarzenia.js';
import { krokMaterial, krokDekor, krokWymiary, krokObrobki, krokWynik } from './kroki.js';
import { firmaZPromocji } from './promo-plyt.js';

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
 * @param {object} [opcje.promo]  klik w baner „ostatnie płyty" (app/promo-plyt.js)
 *   — kreator startuje z góry PRESELEKCJONOWANY: materiał i cena są już
 *   ustawione (Dawida cena promocyjna, nie do edycji przez klienta),
 *   a klient ląduje od razu na kroku „Wymiary". Patrz `zmienMaterial`,
 *   jedyne wyjście z tego trybu.
 */
export function uruchom(root, opcje = {}) {
  const stan = czystyStan();
  if (opcje.promo) ustawPromocje(stan, opcje.promo);

  const akcje = {
    firma: () => (stan.promo ? firmaZPromocji(stan.promo) : firmaWgSlug(stan.firma)),

    idz(krok) {
      stan.krok = krok;
      render(true);
    },

    wybierzFirme(slug) {
      if (stan.firma !== slug || stan.promo) {
        stan.firma = slug;
        // Klient wraca do zwykłego wyboru — promocja (jeśli była aktywna)
        // przestaje obowiązywać, inaczej `akcje.firma()` dalej brałaby
        // starą pseudo-firmę promocyjną zamiast tego, co właśnie wybrał.
        stan.promo = null;
        stan.dekor = null;
        stan.grubosc = null;
        stan.cenaRecznaM2 = '';
        stan.szukaj = '';
        stan.opcje = domyslneOpcje(firmaWgSlug(slug));
      }
      zdarzenie('wycena_start', { material: firmaWgSlug(slug)?.nazwa });
      akcje.idz('dekor');
    },

    wybierzDekor(nazwa) {
      zdarzenie('wycena_dekor', { material: firmaWgSlug(stan.firma)?.nazwa, dekor: nazwa });
      stan.dekor = nazwa;
      stan.grubosc = null;
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

    /** Jedyne wyjście z trybu promocji — klient jednak chce co innego. */
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

  render(!!opcje.promo);
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
    // Promocja „ostatnie płyty" (app/promo-plyt.js) albo null — patrz
    // `ustawPromocje` i `akcje.firma()` wyżej.
    promo: null,
  };
}

/**
 * Wchodzimy w kreator z góry ustawieni na promocję: materiał i cena znane,
 * krok od razu „Wymiary" — klient nie klika przez „Materiał" i „Dekor",
 * bo Dawid już wybrał za niego. `stan.firma` dostaje ten sam slug, co
 * `firmaZPromocji` (spójność z resztą kreatora, który porównuje slugi).
 */
function ustawPromocje(stan, promo) {
  stan.promo = promo;
  stan.firma = `promo-${promo.id}`;
  // Pusty dekor CELOWO — przy promocji nazwa materiału i nazwa dekoru to
  // to samo (jeden tytuł od Dawida, nie marka + wzór osobno). Karta
  // klienta i maile sklejają „firma.nazwa · dekor" i przy dwóch takich
  // samych wartościach pokazałyby ją dwa razy. Patrz promo-plyt.js#wycenPromocje.
  stan.dekor = '';
  stan.grubosc = String(promo.gruboscMm);
  // Cena Dawida — GOTOWA, klient jej nie wpisuje ani nie zmienia.
  // Patrz app/promo-plyt.js#firmaZPromocji: silnik i tak weźmie
  // `cenaPromoM2`, to pole tylko trzyma wartość do wyświetlenia.
  stan.cenaRecznaM2 = promo.cenaPromoM2;
  stan.opcje = domyslneOpcje(firmaZPromocji(promo));
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
  // Tryb promocji pomija krok „Dekor" na starcie (patrz `ustawPromocje`) —
  // nawigacja tam nie ma prawa być dostępna, bo pokazałaby formularz
  // ręcznej ceny i wyglądałoby, że klient może zmienić cenę Dawida.
  if (stan.promo) return krok !== 'dekor';
  if (krok === 'dekor') return true;
  const f = firmaWgSlug(stan.firma);
  return f?.trybCeny === 'reczna' || !!stan.dekor;
}

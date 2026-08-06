import { h, pusty } from './dom.js';
import { firmaWgSlug } from '../firms/index.js';
import { zdarzenie } from '../analytics/zdarzenia.js';
import { krokMaterial, krokDekor, krokWymiary, krokObrobki, krokWynik } from './kroki.js';

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

export function uruchom(root) {
  const stan = czystyStan();

  const akcje = {
    firma: () => firmaWgSlug(stan.firma),

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

  render();
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
  const f = firmaWgSlug(stan.firma);
  return f?.trybCeny === 'reczna' || !!stan.dekor;
}

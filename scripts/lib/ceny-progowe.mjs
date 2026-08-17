/**
 * PROGI CENOWE UŻYWANE W TREŚCI STRON
 *
 * Na stronie głównej, stronach miast i stronach materiałowych stoją zdania
 * w rodzaju „blat 60 × 300 cm od 4 400 zł". Te liczby muszą pochodzić
 * z tego samego silnika, co kalkulator — inaczej rozjeżdżają się przy
 * każdej zmianie cennika dostawcy (i tak się stało: strona mówiła 4 100 zł,
 * gdy kalkulator liczył już 4 400 zł).
 *
 * Ten moduł liczy je raz, a `npm run ceny:tresc` wstawia je do HTML-a.
 * Checklista (§8.17) porównuje treść stron z tym, co wychodzi tutaj.
 *
 * Konfiguracja odniesienia jest CELOWO typowa, nie minimalna: zlew
 * podwieszany, płyta indukcyjna nakładana i dwa otwory. Klient, który
 * zobaczy „od X", zwykle właśnie tyle zamawia.
 */

export const ODNIESIENIE = {
  opcje: { zlew: 'podblat', plyta: 'nakladana', otwory: 2 },
  proste: [{ gl: 60, dl: 300 }],
  wL: [{ gl: 60, dl: 300 }, { gl: 60, dl: 180 }],
};

/** Które rodzaje materiału składają się na „konglomerat" i „spiek" w tekstach. */
const GRUPY = {
  konglomerat: (f) => f.typ === 'konglomerat kwarcowy',
  spiek: (f) => f.typ.startsWith('spiek'),
};

/**
 * @param {Array} firmy   FIRMY z src/firms
 * @param {Function} wycen  funkcja wyceny z src/engine/wycena.js
 * @param {string} [data]   data (promocje); domyślnie dziś
 */
export function progi(firmy, wycen, data) {
  const wynik = {};

  for (const [grupa, pasuje] of Object.entries(GRUPY)) {
    const kwotyProste = [];
    const kwotyL = [];
    const zaM2 = [];
    let dekorow = 0;

    for (const f of firmy) {
      if (!f.aktywna || f.trybCeny === 'reczna' || !pasuje(f)) continue;
      // Progi na stronach dotyczą blatu z montażem, czyli stawki 8%.
      const vat = 1 + (f.vatMontaz ?? 0.08);

      for (const [dekor, grubosci] of Object.entries(f.dekory || {})) {
        const gr = Object.keys(grubosci).filter((g) => !(f.pomijGrubosci || []).includes(g));
        if (!gr.length) continue;
        dekorow++;
        for (const g of gr) {
          // Część firm (Atlas Plan) trzyma wpis jako { cena, plyta } zamiast
          // samej liczby — bez tego rozróżnienia zakres m² wychodził NaN.
          const wpis = grubosci[g];
          const cena = typeof wpis === 'number' ? wpis : wpis?.cena;
          if (cena > 0) zaM2.push(cena * vat);
          for (const [lista, odcinki] of [
            [kwotyProste, ODNIESIENIE.proste],
            [kwotyL, ODNIESIENIE.wL],
          ]) {
            try {
              const w = wycen(f, { dekor, grubosc: g, odcinki, opcje: ODNIESIENIE.opcje }, data);
              if (w && w.ok !== false) lista.push(w.razemZaokr);
            } catch {
              /* dekor bez ceny w tej grubości — pomijamy */
            }
          }
        }
      }
    }

    if (!kwotyProste.length) continue;
    wynik[grupa] = {
      proste: Math.min(...kwotyProste),
      wL: Math.min(...kwotyL),
      m2Od: Math.round(Math.min(...zaM2)),
      m2Do: Math.round(Math.max(...zaM2)),
      dekorow,
    };
  }

  return wynik;
}

/**
 * Zapisy kwoty, jakie moga stac w tresci stron.
 *
 * Uwaga: toLocaleString('pl-PL') NIE wstawia separatora w liczbach
 * czterocyfrowych („4100"), wiec grupowanie robimy sami. Strony uzywaja
 * zwyklej spacji, ale dopuszczamy tez nielamliwa — obie bywaja w HTML-u.
 */
export function zapisy(n) {
  const bez = String(Math.round(n));
  const zGrupami = bez.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return [bez, zGrupami, zGrupami.split(' ').join(' ')];
}

/** Zapis kanoniczny do tresci: „4 400" (zwykla spacja). */
export const spacjowane = (n) => zapisy(n)[1];
/** Zapis zwarty do meta description i JSON-LD: „4400". */
export const zwarte = (n) => zapisy(n)[0];

/**
 * DANE STRUKTURALNE PŁYT Z WYPRZEDAŻY (schema.org ItemList + Product).
 *
 * Zlecenie Dawida (01.09.2026, etap SEO): strona wyprzedaży to naturalny
 * magnes na frazy „wyprzedaż / outlet płyt kamiennych" — intencję zakupową
 * o wysokiej gotowości. Google pokazuje takie listy ładniej, gdy wie,
 * że to konkretne produkty z ceną i dostępnością.
 *
 * ⚠ DLACZEGO Z JAVASCRIPTU, A NIE W HTML-u.
 * Lista płyt zmienia się bez wdrożenia strony — Dawid dokłada i sprzedaje
 * płyty w panelu. Wpisana na sztywno w HTML zaczęłaby kłamać dzień po
 * sprzedaniu pierwszej sztuki, a fałszywa dostępność w danych strukturalnych
 * to nie drobiazg: za to leci kara ręczna. Blok dokładamy dopiero wtedy,
 * gdy mamy prawdziwą listę z workera.
 *
 * ⚠ CO DOKŁADNIE OZNACZAMY CENĄ.
 * `price` to cena CAŁEJ PŁYTY (m² × stawka Dawida), a nie gotowego blatu —
 * bo to jest kwota, za którą tę konkretną sztukę można kupić. Opis mówi
 * o tym wprost. Podanie tu ceny gotowego blatu byłoby obietnicą, której
 * nie da się dotrzymać bez znajomości wymiarów kuchni.
 *
 * Płyty nieopublikowane i sprzedane nie mają prawa się tu znaleźć —
 * dlatego wchodzimy przez `doPokazania`, tak samo jak reszta aplikacji.
 */
import { doPokazania, cenaCalejPlyty, m2Plyty, etykietaTypu } from './wyprzedaz.js';

const ADRES = 'https://kam24h.pl/wyprzedaz-plyt';

/** Buduje obiekt ItemList — czysta funkcja, żeby dała się przetestować. */
export function listaProduktow(plyty, { baza = 'https://kam24h.pl' } = {}) {
  const widoczne = doPokazania(plyty);
  if (!widoczne.length) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': `${ADRES}#plyty`,
    name: 'Płyty z wyprzedaży',
    numberOfItems: widoczne.length,
    itemListElement: widoczne.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Product',
        name: p.nazwa,
        description:
          `Płyta ${p.plytaDlCm} × ${p.plytaGlCm} cm (${m2Plyty(p).toFixed(2)} m²), ` +
          `grubość ${p.gruboscMm} mm. Cena za całą płytę.` +
          (p.typ === 'poprodukcyjna' ? ` ${etykietaTypu(p.typ)}.` : '') +
          (p.opis ? ` ${p.opis}.` : ''),
        // Zdjęcie tylko wtedy, gdy naprawdę jest — pusty `image` to błąd
        // w Search Console, a nie „mniej informacji".
        ...(p.zdjecie ? { image: p.zdjecie.startsWith('http') ? p.zdjecie : baza + p.zdjecie } : {}),
        ...(p.kodPlyty ? { sku: p.kodPlyty } : {}),
        brand: { '@type': 'Brand', name: 'Kamieniarstwo 24h' },
        offers: {
          '@type': 'Offer',
          url: `${ADRES}#${encodeURIComponent(p.nazwa)}`,
          price: String(cenaCalejPlyty(p)),
          priceCurrency: 'PLN',
          // Płyty z wyprzedaży to nowy, nieużywany materiał — tylko końcówka
          // serii albo pozostałość z produkcji.
          itemCondition: 'https://schema.org/NewCondition',
          availability: 'https://schema.org/InStock',
          seller: { '@id': 'https://kam24h.pl/#firma' },
          areaServed: 'PL',
        },
      },
    })),
  };
}

/**
 * Wkłada blok do strony. Woła się raz, po pobraniu listy.
 * Ponowne wywołanie podmienia zawartość, a nie dokłada drugiego bloku.
 */
export function dopiszSchemeWyprzedazy(plyty, dokument = document) {
  const dane = listaProduktow(plyty);
  if (!dane) return null;

  const ID = 'schema-wyprzedaz';
  let el = dokument.getElementById(ID);
  if (!el) {
    el = dokument.createElement('script');
    el.type = 'application/ld+json';
    el.id = ID;
    dokument.head.appendChild(el);
  }
  el.textContent = JSON.stringify(dane, null, 2);
  return el;
}

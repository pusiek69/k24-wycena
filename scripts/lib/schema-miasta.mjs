/**
 * DANE STRUKTURALNE STRON MIAST (JSON-LD).
 *
 * POWÓD POWSTANIA (27.08.2026) — NAPRAWA REGRESJI, którą sam wprowadziłem.
 *
 * Do 25.08.2026 każda strona miasta miała pełny `@graph`:
 * HomeAndConstructionBusiness + WebPage + BreadcrumbList + Service
 * z AggregateOffer. Generator FAQ dokleił drugi blok JSON-LD, ale wzorzec,
 * którym szukał starego bloku do podmiany, był łapczywy:
 *
 *     /<script …>\s*\{\s*"@context"[^]*?"@type": "FAQPage"[^]*?<\/script>/
 *
 * `[^]*?` przeskakiwało z początku PIERWSZEGO bloku (grafu) aż do FAQPage
 * w DRUGIM — i podmiana zjadała oba, zostawiając samo FAQ. Wszystkie 14
 * stron miast straciło przez to dane o firmie, usłudze, cenie i okruszkach.
 * Z zewnątrz nie było tego widać: strony wyglądały tak samo.
 *
 * Wniosek na przyszłość: wzorzec podmieniający blok JSON-LD musi być
 * zakotwiczony w JEGO WŁASNYM typie od pierwszego znaku, nigdy „cokolwiek
 * aż do typu, którego szukam".
 *
 * Teraz graf jest GENEROWANY, nie kopiowany ze wzorca — dzięki temu jest
 * identyczny na wszystkich miastach, a lista obsługiwanych miejscowości
 * i kwota „od" biorą się z jednego źródła (lib/miasta.mjs + ceny-tresc.json).
 */

const FIRMA_ID = 'https://kam24h.pl/#firma';
const DAWID_ID = 'https://kam24h.pl/#dawid';

/** Wcięcie zgodne z resztą strony — JSON-LD stoi w <head> na dwóch spacjach. */
const wciecie = (obiekt, poziom = 1) =>
  JSON.stringify(obiekt, null, 2)
    .split('\n')
    .map((l, i) => (i === 0 ? l : '  '.repeat(poziom) + l))
    .join('\n');

/**
 * Blok firmy — ten sam na każdej stronie miasta (spina się po `@id`
 * z pozostałymi węzłami). `areaServed` budujemy z lib/miasta.mjs, żeby
 * dopisanie miasta w jednym miejscu odświeżyło też dane strukturalne.
 */
function firma(miasta) {
  return {
    '@type': 'HomeAndConstructionBusiness',
    '@id': FIRMA_ID,
    name: 'Kamieniarstwo 24h',
    legalName: 'Aaron sp. z o.o.',
    vatID: 'PL8672241748',
    taxID: '8672241748',
    description:
      'Blaty kuchenne i łazienkowe oraz okładziny ścienne z konglomeratu kwarcowego, ' +
      'spieku i kamienia naturalnego. Własny zakład w Tarnobrzegu, pomiar Prolinerem, ' +
      'obróbka i montaż.',
    url: 'https://kam24h.pl/',
    telephone: '+48796991128',
    email: 'kamieniarstwo24h@gmail.com',
    image: 'https://kam24h.pl/og-k24h.png',
    logo: 'https://kam24h.pl/logo-k24h.png',
    priceRange: '$$',
    currenciesAccepted: 'PLN',
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '08:00',
        closes: '18:00',
      },
    ],
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'ul. Szpitalna 8',
      addressLocality: 'Tarnobrzeg',
      postalCode: '39-400',
      addressRegion: 'podkarpackie',
      addressCountry: 'PL',
    },
    geo: { '@type': 'GeoCoordinates', latitude: 50.5729, longitude: 21.679 },
    areaServed: [
      ...miasta.map((m) => ({ '@type': 'City', name: m.nazwa })),
      // Dwie miejscowości bez własnej strony, obsługiwane od zawsze.
      { '@type': 'City', name: 'Połaniec' },
      { '@type': 'City', name: 'Baranów Sandomierski' },
    ],
    knowsAbout: [
      'blaty kuchenne',
      'blaty łazienkowe',
      'okładziny ścienne z kamienia',
      'konglomerat kwarcowy',
      'spiek kwarcowy',
      'granit',
      'marmur',
      'kwarcyt',
      'trawertyn',
      'dolomit',
      'nagrobki',
    ],
    founder: { '@id': DAWID_ID },
    employee: { '@id': DAWID_ID },
  };
}

/**
 * Pełny `@graph` strony miasta.
 *
 * @param {object} m        wpis z lib/miasta.mjs
 * @param {Array}  miasta   wszystkie miasta (do `areaServed` firmy)
 * @param {object} kwoty    z scripts/lib/ceny-tresc.json — „od" w AggregateOffer
 * @param {string} opis     ten sam tekst, co w <meta name="description">
 */
export function grafMiasta(m, miasta, kwoty, opis) {
  const url = `https://kam24h.pl/blaty-kuchenne-${m.slug}`;

  // Usługa obsługuje miasto ORAZ okoliczne miejscowości, jeśli je wypisano.
  // Przy jednej mocnej stronie „miasto i okolice" (zamiast cienkich stron
  // per gmina) to jedyne miejsce, gdzie te nazwy trafiają do danych
  // strukturalnych — patrz `okolice` w lib/miasta.mjs.
  const obszar = [{ '@type': 'City', name: m.nazwa }].concat(
    (m.okolice || []).map((n) => ({ '@type': 'City', name: n }))
  );

  const graf = {
    '@context': 'https://schema.org',
    '@graph': [
      firma(miasta),
      {
        '@type': 'WebPage',
        '@id': `${url}#strona`,
        url,
        name: m.tytul || `Blaty kuchenne ${m.nazwa} — kamień na wymiar`,
        description: opis,
        inLanguage: 'pl-PL',
        isPartOf: { '@type': 'WebSite', name: 'Kamieniarstwo 24h', url: 'https://kam24h.pl/' },
        about: { '@id': FIRMA_ID },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Strona główna', item: 'https://kam24h.pl/' },
          { '@type': 'ListItem', position: 2, name: m.nazwa, item: url },
        ],
      },
      {
        '@type': 'Service',
        name: `Blaty kuchenne na wymiar — ${m.nazwa}`,
        serviceType: 'Wykonanie i montaż blatów kamiennych',
        provider: { '@id': FIRMA_ID },
        areaServed: obszar.length === 1 ? obszar[0] : obszar,
        offers: {
          '@type': 'AggregateOffer',
          priceCurrency: 'PLN',
          // Kwota z tego samego źródła co treść stron — inaczej dane
          // strukturalne rozjeżdżałyby się z tym, co klient czyta.
          lowPrice: String(Math.round(kwoty.konglomeratProste)),
          description:
            'Blat 60 × 300 cm z konglomeratu kwarcowego, z obróbką, transportem i montażem.',
        },
      },
    ],
  };

  return `  <script type="application/ld+json">\n  ${wciecie(graf)}\n  </script>`;
}

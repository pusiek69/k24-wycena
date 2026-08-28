/**
 * PYTANIA I ODPOWIEDZI NA STRONACH MIAST.
 *
 * Zlecenie Dawida (25.08.2026): realne sekcje pytań w treści + FAQPage.
 *
 * DWIE ZASADY, KTÓRE TU RZĄDZĄ:
 *
 * 1. Liczby biorą się z jednego źródła — kwoty z scripts/lib/ceny-tresc.json
 *    (te same, które stoją w treści stron i w Product/Offer), liczba wzorów
 *    z cenników. Nic nie jest przepisane ręcznie, więc nie zdąży się
 *    rozjechać po najbliższej zmianie cennika.
 *
 * 2. Odpowiedzi muszą się zgadzać ze stroną „Często zadawane pytania",
 *    która jest zatwierdzoną wykładnią zasad zakładu. Stąd m.in.:
 *      • pomiar jest BEZPŁATNY w promieniu ~100 km, dalej — do ustalenia,
 *      • obróbka, wycięcia, transport i montaż są WLICZONE w cenę „od”
 *        (nie są osobno darmowe — są w kwocie),
 *      • wycena z kalkulatora jest orientacyjna i nie stanowi oferty.
 *
 * Treść jest różnicowana per miasto (odległość, czas dojazdu, zasady
 * dojazdu, jedno pytanie z rotacji). Piętnaście identycznych sekcji FAQ
 * byłoby dla Google treścią powieloną, a dla klienta — bezużyteczną.
 */

/** Pytanie „z rotacji” — żeby strony nie były swoimi kopiami. */
const DODATKOWE = [
  {
    pytanie: 'Czy blat będzie łączony?',
    odpowiedz:
      'Zależy od długości. Płyty konglomeratu mają zwykle 320 × 160 cm, więc blat dłuższy ' +
      'niż długość płyty musi być łączony. Miejsce łączenia ustalamy na pomiarze tak, żeby ' +
      'wypadło w najmniej widocznym punkcie — najczęściej przy zlewie albo płycie grzewczej.',
  },
  {
    pytanie: 'Czy można postawić gorący garnek na blacie?',
    odpowiedz:
      'Na spieku i na granicie — tak. Na konglomeracie kwarcowym lepiej nie: żywica w składzie ' +
      'źle znosi nagłe, wysokie temperatury i może zostawić trwały ślad. Podkładka rozwiązuje problem.',
  },
  {
    pytanie: 'Kiedy umówić pomiar — przed montażem szafek czy po?',
    odpowiedz:
      'Po. Szafki muszą stać na swoim miejscu i być wypoziomowane, bo blat mierzymy po ich ' +
      'rzeczywistym obrysie. Przed montażem szafek podamy wycenę orientacyjną z wymiarów projektu, ' +
      'ale do produkcji potrzebny jest pomiar na gotowej zabudowie.',
  },
  {
    pytanie: 'Czy blat trzeba impregnować?',
    odpowiedz:
      'Konglomerat i spiek — nie, nie nasiąkają. Kamień naturalny (granit, marmur, kwarcyt) tak: ' +
      'impregnujemy go przed montażem, a zabieg warto powtarzać mniej więcej raz w roku.',
  },
  {
    pytanie: 'Jaka grubość blatu jest standardem?',
    odpowiedz:
      'W konglomeracie 20 mm. W spieku i gresie 12 mm albo 20 mm, jeśli zależy komuś na ' +
      'masywniejszym wyglądzie. Grubość 6 mm to materiał na okładziny i fronty mebli, nie na blat kuchenny.',
  },
];

const zl = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' zł';

/**
 * Pytania dla jednego miasta.
 *
 * @param {object} miasto  wpis z lib/miasta.mjs
 * @param {object} kwoty   { konglomeratProste, konglomeratL, spiekProste, spiekL }
 * @param {number} wzorow  ile wzorów łącznie (zaokrąglone w dół do setki)
 * @param {number} i       numer miasta — z niego bierze się pytanie z rotacji
 */
export function pytaniaMiasta(miasto, kwoty, wzorow, i) {
  const { nazwa, wMiescie, doMiasta, km, daleko } = miasto;

  // Tarnobrzeg to miasto zakładu — „0 km od naszego zakładu w Tarnobrzegu"
  // brzmiałoby absurdalnie.
  const naMiejscu = km === 0;

  const dojazd = naMiejscu
    ? 'Tak. Zakład mamy w Tarnobrzegu przy ul. Szpitalnej 8, więc jesteśmy na miejscu — ' +
      'pomiar Prolinerem wykonujemy bezpłatnie i niezobowiązująco, a transport i montaż ' +
      'są wliczone w cenę blatu. Płyty można obejrzeć u nas na hali przed zamówieniem.'
    : daleko
    ? `${nazwa} leży około ${km} km od naszego zakładu w Tarnobrzegu, czyli poza promieniem, ` +
      'w którym pomiar jest bezpłatny bez żadnych warunków. Nie znaczy to, że nie przyjedziemy — ' +
      'realizujemy montaże w całej Polsce. Warunki dojazdu ustalamy indywidualnie przy zamówieniu, ' +
      'najczęściej łącząc wyjazd z innym montażem w tamtym rejonie. Prosimy o telefon: 796 991 128.'
    : `Tak. Do ${doMiasta} jest około ${km} km od naszego zakładu w Tarnobrzegu — to mieści się ` +
      'w promieniu, w którym pomiar Prolinerem wykonujemy bezpłatnie i niezobowiązująco. ' +
      'Transport i montaż są wliczone w cenę blatu.';

  const cena =
    `Blat 60 × 300 cm z konglomeratu kwarcowego zaczyna się od ${zl(kwoty.konglomeratProste)} brutto, ` +
    `ten sam blat ze spieku od ${zl(kwoty.spiekProste)}. Kuchnia w L (odcinki 300 i 180 cm) to ` +
    `odpowiednio od ${zl(kwoty.konglomeratL)} i ${zl(kwoty.spiekL)}. ` +
    'W tych kwotach jest już obróbka, wycięcie pod zlew i płytę grzewczą, transport i montaż — ' +
    'to cena za gotowy, zamontowany blat, a nie za samą płytę.';

  return [
    { pytanie: `Ile kosztuje blat kuchenny z kamienia w ${wMiescie}?`, odpowiedz: cena },
    {
      pytanie: daleko
        ? `Czy dojeżdżacie do ${doMiasta} i ile kosztuje dojazd?`
        : `Czy pomiar i montaż w ${wMiescie} są w cenie?`,
      odpowiedz: dojazd,
    },
    {
      pytanie: 'Ile trwa realizacja od pomiaru do montażu?',
      odpowiedz:
        'Standardowo kilkanaście dni roboczych. Termin zależy od dostępności wybranej płyty ' +
        'i bieżącego obłożenia zakładu — dokładną datę potwierdzamy przy zamówieniu, po pomiarze.',
    },
    {
      pytanie: 'Z jakich materiałów robicie blaty?',
      odpowiedz:
        'Z konglomeratu kwarcowego, spieku kwarcowego (gresu wielkoformatowego) i kamienia ' +
        `naturalnego — granitu, marmuru i kwarcytu. Łącznie ponad ${wzorow} wzorów w kalkulatorze. ` +
        'Konglomerat jest najczęstszym wyborem do kuchni, spiek wybiera się tam, gdzie blat ma ' +
        'znosić gorące naczynia, a kamień naturalny — gdy zależy komuś na niepowtarzalnym rysunku.',
    },
    {
      pytanie: 'Czy można obejrzeć płyty na żywo?',
      odpowiedz:
        'Tak. Zakład jest w Tarnobrzegu przy ul. Szpitalnej 8 — można przyjechać i zobaczyć ' +
        'płyty w naturalnej wielkości, bo zdjęcie nigdy nie oddaje rysunku kamienia. ' +
        'Prosimy tylko o wcześniejszy telefon: 796 991 128, żeby ktoś na pewno był na miejscu.',
    },
    {
      pytanie: `Czy wycenę blatu w ${wMiescie} można zrobić przez internet?`,
      odpowiedz:
        'Tak — kalkulator na tej stronie policzy orientacyjny koszt w dwie minuty, na podstawie ' +
        'podanych wymiarów. To wycena orientacyjna, nie oferta w rozumieniu art. 66 §1 Kodeksu ' +
        `cywilnego: ostateczną cenę potwierdzamy po ${daleko ? '' : 'bezpłatnym '}pomiarze, ` +
        'bo przy nietypowych kształtach, wyspach i blatach łączonych może się różnić.',
    },
    DODATKOWE[i % DODATKOWE.length],
  ];
}

/** Sekcja HTML z pytaniami — widoczna treść, do której odnosi się schema. */
export function sekcjaHtml(pytania, miasto) {
  const pozycje = pytania
    .map(
      (p) => `        <div class="faq-poz">
          <h3>${p.pytanie}</h3>
          <p>${p.odpowiedz}</p>
        </div>`
    )
    .join('\n');

  return `      <section class="faq-miasto" aria-labelledby="faq-tytul">
        <h2 id="faq-tytul">Najczęstsze pytania — ${miasto.nazwa}</h2>
${pozycje}
      </section>`;
}

/** Blok FAQPage. Treść MUSI być ta sama, co widoczna na stronie. */
export function schemaFaq(pytania) {
  const eskapuj = (t) =>
    String(t).replace(/[&<>"]/g, (z) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '\\"' }[z]));

  const wpisy = pytania
    .map(
      (p) => `      {
        "@type": "Question",
        "name": "${eskapuj(p.pytanie)}",
        "acceptedAnswer": { "@type": "Answer", "text": "${eskapuj(p.odpowiedz)}" }
      }`
    )
    .join(',\n');

  return `  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
${wpisy}
    ]
  }
  </script>`;
}

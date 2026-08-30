/**
 * STRONA „WYPRZEDAŻ PŁYT" — generator.
 *
 *   npm run wyprzedaz
 *   npm run wyprzedaz -- --sprawdz   (nic nie zapisuje, mówi czy jest aktualna)
 *
 * Zlecenie Dawida (30.08.2026): strona prezentująca płyty z wyprzedaży,
 * z przyciskiem „policz blat z tej płyty" prowadzącym do kalkulatora.
 *
 * Stronę BUDUJEMY ZE WZORCA (blaty-lazienkowe.html), a nie piszemy ręcznie,
 * z tego samego powodu co strony miast: nagłówek, stopka, okruszki, zgody
 * i skrypty analityczne mają zostać identyczne z resztą serwisu. Ręcznie
 * pisana strona rozjeżdża się z nimi przy pierwszej zmianie w stopce.
 *
 * TREŚĆ PŁYT jest DYNAMICZNA — wchodzi dopiero w przeglądarce
 * (src/wyprzedaz-strona.js), bo pochodzi z D1 i zmienia się bez wdrożenia.
 * Ten generator tworzy tylko ramę: head, nagłówek, pusty kontener i tekst,
 * który ma sens także wtedy, gdy nic akurat nie jest wystawione.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tylkoSprawdz = process.argv.includes('--sprawdz');

const WZORZEC = path.join(ROOT, 'blaty-lazienkowe.html');
const CEL = path.join(ROOT, 'wyprzedaz-plyt.html');

const TYTUL = 'Wyprzedaż płyt — kamień i konglomerat w niższej cenie';
const OPIS =
  'Pojedyncze płyty granitu, konglomeratu i spieku z naszego placu w Tarnobrzegu, ' +
  'w obniżonej cenie. Każda jest jedna — ze zdjęciem, wymiarem i ceną. Policz blat od ręki.';

/** Dane strukturalne strony — okruszki i przynależność do firmy. */
const SCHEMA = `  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": "https://kam24h.pl/wyprzedaz-plyt#strona",
        "url": "https://kam24h.pl/wyprzedaz-plyt",
        "name": ${JSON.stringify(TYTUL)},
        "description": ${JSON.stringify(OPIS)},
        "inLanguage": "pl-PL",
        "isPartOf": { "@type": "WebSite", "name": "Kamieniarstwo 24h", "url": "https://kam24h.pl/" },
        "about": { "@id": "https://kam24h.pl/#firma" }
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Strona główna", "item": "https://kam24h.pl/" },
          { "@type": "ListItem", "position": 2, "name": "Wyprzedaż płyt", "item": "https://kam24h.pl/wyprzedaz-plyt" }
        ]
      }
    ]
  }
  </script>`;

const TRESC = `  <main id="tresc" class="wrap tekst">
    <nav class="okruszki" aria-label="Ścieżka nawigacji">
      <a href="/">Strona główna</a> <span aria-hidden="true">›</span> <span>Wyprzedaż płyt</span>
    </nav>

    <!-- Wstążka podglądu i karty płyt wchodzą tu z src/wyprzedaz-strona.js.
         Kontener zostaje pusty w HTML-u, bo zawartość zmienia się bez
         wdrożenia strony — Dawid dokłada płyty w panelu. -->
    <div id="wyprzedaz-lista"></div>

    <h2>Skąd biorą się te płyty</h2>
    <p>
      Z każdego większego zamówienia zostaje materiał — czasem pół płyty, czasem cała.
      Bywa też, że klient zmieni zdanie po zamówieniu konkretnego kamienia albo że płyta
      leży u nas dłużej, niż powinna. Zamiast trzymać ją na placu, wystawiamy ją taniej.
    </p>
    <p>
      Każda pozycja wyżej to <strong>jedna konkretna płyta</strong>, którą można obejrzeć
      w Tarnobrzegu przy ul. Szpitalnej 8. Kiedy schodzi — znika też stąd i z kalkulatora,
      więc lista pokazuje wyłącznie to, co naprawdę mamy.
    </p>

    <h2>Co obejmuje podana cena</h2>
    <p>
      Kwota przy płycie to <strong>cena samego materiału</strong> (zł/m² brutto).
      Obróbka, wycięcia pod zlew i płytę grzewczą, transport i montaż liczą się osobno —
      dokładnie tak samo jak przy materiale z cennika. Kalkulator policzy całość, kiedy
      poda się wymiary blatu.
    </p>
    <p>
      Przy resztce z placu rozliczamy <strong>całą płytę</strong>, a nie metry z niej.
      Taka płyta jest jedna i po docięciu blatu reszty nie da się już sprzedać komu innemu —
      dlatego cena jest niższa, ale bierze się sztukę.
    </p>

    <h2>Zanim zamówisz</h2>
    <p>
      Prosimy o telefon pod <a href="tel:+48796991128" data-miejsce="tresc-wyprzedaz">796 991 128</a>
      i potwierdzenie dostępności. Płyty schodzą też poza kalkulatorem — telefonicznie
      i na miejscu — więc może się zdarzyć, że akurat tę ktoś już wziął. Wycena
      z kalkulatora jest orientacyjna i nie stanowi oferty w rozumieniu art. 66 §1
      Kodeksu cywilnego; ostateczną cenę potwierdzamy po pomiarze.
    </p>

    <p class="cta-linia">
      Nie ma nic dla Ciebie? <a href="/#kreator">Policz blat z pełnego cennika</a> —
      mamy konglomerat, spiek i kamień naturalny wszystkich marek na rynku.
    </p>
  </main>`;

function zbuduj() {
  // Ujednolicamy końce linii — repo ma pomieszane CRLF i LF, a wzorce
  // dopasowywane po znaku nowej linii po prostu by w nie nie trafiły.
  let t = fs.readFileSync(WZORZEC, 'utf8').replace(/\r\n/g, '\n');

  const podmiany = [
    ['<title>Blaty łazienkowe z kamienia — który materiał wybrać</title>', `<title>${TYTUL}</title>`],
    ['blaty-lazienkowe', 'wyprzedaz-plyt'],
    [
      '<meta property="og:title" content="Blaty łazienkowe z kamienia — co się sprawdza" />',
      '<meta property="og:title" content="Wyprzedaż płyt — Kamieniarstwo 24h" />',
    ],
    ['<meta property="og:type" content="article" />', '<meta property="og:type" content="website" />'],
    [
      '<h1>Blaty<br><em>łazienkowe.</em></h1>',
      '<h1>Wyprzedaż<br><em>płyt.</em></h1>',
    ],
    ['<script type="module" src="/src/podstrona.js"></script>',
     '<script type="module" src="/src/wyprzedaz-strona.js"></script>'],
    /*
     * STOPKA — dwie podmiany, obie konieczne.
     *
     * 1. Na WŁASNEJ stronie nie linkujemy sami do siebie: link do wyprzedaży
     *    zamieniamy na „tu jesteś" (tak samo robi generator miast).
     * 2. ⚠ Wzorcem jest strona blatów łazienkowych, więc niesie „tu jesteś"
     *    przy SOBIE. Bez odwrócenia tego klient na stronie wyprzedaży miał
     *    w stopce wyszarzone „Blaty łazienkowe", w które nie dało się kliknąć.
     *    Znalezione 30.08.2026 na zrzucie z telefonu.
     */
    ['<span class="foot-tu">Blaty łazienkowe</span>',
     '<a href="/blaty-lazienkowe">Blaty łazienkowe</a>'],
    ['<a href="/wyprzedaz-plyt">Wyprzedaż płyt</a>',
     '<span class="foot-tu">Wyprzedaż płyt</span>'],
  ];

  for (const [z, na] of podmiany) {
    if (!t.includes(z)) throw new Error(`Wzorzec nie zawiera fragmentu: ${z.slice(0, 60)}`);
    t = t.split(z).join(na);
  }

  // Opisy — pełne zdania, więc regexem, nie podmianą słowa.
  t = t.replace(/(name="description" content=")[^"]*(")/, `$1${OPIS}$2`);
  t = t.replace(/(property="og:description" content=")[^"]*(")/, `$1${OPIS}$2`);
  t = t.replace(
    /<p class="sub">[\s\S]*?<\/p>/,
    '<p class="sub">Pojedyncze płyty z naszego placu w niższej cenie. Każda jest jedna — ' +
      'kiedy schodzi, znika stąd i z kalkulatora.</p>'
  );

  // Dane strukturalne wzorca (artykuł o blatach łazienkowych) zamieniamy
  // na własne — bez tego strona wyprzedaży przedstawiałaby się Google
  // jako poradnik o łazienkach.
  const reLd = /  <script type="application\/ld\+json">[^]*?\n  <\/script>/;
  if (!reLd.test(t)) throw new Error('Wzorzec nie ma bloku danych strukturalnych.');
  t = t.replace(reLd, SCHEMA);

  // Treść główna.
  const reMain = /  <main id="tresc"[^]*?\n  <\/main>/;
  if (!reMain.test(t)) throw new Error('Wzorzec nie ma sekcji <main>.');
  t = t.replace(reMain, TRESC);

  return t;
}

const nowa = zbuduj();
const stara = fs.existsSync(CEL) ? fs.readFileSync(CEL, 'utf8') : null;

if (stara === nowa) {
  console.log('✓ Strona wyprzedaży aktualna — nic do zmiany.');
  process.exit(0);
}
if (tylkoSprawdz) {
  console.error('✗ Strona wyprzedaży wymaga odświeżenia — uruchom `npm run wyprzedaz`.');
  process.exit(1);
}
fs.writeFileSync(CEL, nowa, 'utf8');
console.log('✓ wyprzedaz-plyt.html');

/**
 * PORADNIK O KONGLOMERACIE — treść i schema.
 *
 * Analiza przed napisaniem: `docs/analiza-konglomeraty.md`.
 *
 * Osobno od generatora (`scripts/strona-konglomeraty.mjs`), bo generator
 * zajmuje się plikami i ramą strony, a tutaj jest sam tekst — łatwiej go
 * czytać i poprawiać.
 *
 * ⚠ ŻADNEJ KWOTY ANI LICZBY WZORÓW NIE WPISUJEMY RĘCZNIE. Wszystko wchodzi
 * przez `k` (kwoty z `scripts/lib/ceny-tresc.json`) i `w` (liczby wzorów
 * policzone z rejestru firm). Wpisana na sztywno liczba zaczęłaby kłamać
 * przy pierwszej zmianie cennika i nikt by tego nie zauważył.
 *
 * KLUCZOWY WNIOSEK Z ANALIZY, KTÓRY USTAWIA KOLEJNOŚĆ SEKCJI:
 * najmocniejszy konkurent w top10 ma ~3000 słów, tabelę i FAQ — i NIE PODAJE
 * ANI JEDNEJ KWOTY, mimo że rankuje na „cenę". Reszta podaje kwoty wzajemnie
 * sprzeczne i w różnych jednostkach (zł/m² materiału vs zł/mb vs zł/m²
 * gotowego blatu). Dlatego u nas cena idzie PIERWSZA i jest rozbita na
 * składniki — to jedyna rzecz, której cała stawka nie potrafi zrobić.
 */

import { odmiana, zOdmiana } from './odmiana.mjs';

/*
 * ⚠ ODMIANA LICZEBNIKA idzie przez wspólny moduł, a nie przez wpisane
 * na sztywno „dekorów".
 *
 * Powód konkretny: `ceny-tresc.mjs` przechodzi po TYCH SAMYCH zdaniach
 * i poprawia formę słowa razem z liczbą („62 dekory", „66 dekorów").
 * Kiedy tekst miał wpisane „dekorów" na sztywno, oba generatory
 * nadpisywały sobie nawzajem tę samą linijkę w kółko — dokładnie ten sam
 * konflikt, który 30.08 wyszedł przy spiekach.
 *
 * Przy okazji: bez tego „33 dekorów" (Pacific) było po prostu błędem
 * językowym, którego ceny-tresc.mjs nie łapał, bo nie ma na tę markę wzorca.
 */

/** 12345 → „12 345" (spacja nierozdzielająca byłaby tu przesadą). */
/*
 * „realizacja" nie ma gotowej formy w `odmiana.mjs` (tamten moduł zna
 * „dekor" i „wzór"), więc dokładamy ją tutaj — obok jedynego miejsca,
 * które jej używa.
 */
const FORMY_REALIZACJI = ['realizacja', 'realizacje', 'realizacji'];

export const zl = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/**
 * FAQ — jedno miejsce dla treści strony i dla schema.org.
 * Gdyby żyły osobno, prędzej czy później Google dostałby inne odpowiedzi
 * niż czytelnik, a to jest dokładnie to, za co leci kara.
 */
export function pytania(k, w) {
  return [
    {
      p: 'Ile kosztuje blat z konglomeratu kwarcowego?',
      o:
        `Gotowy blat 60 × 300 cm zaczyna się od ${zl(k.konglomeratProste)} zł brutto, ` +
        `a kuchnia w literę L od ${zl(k.konglomeratL)} zł brutto. Sam materiał to ` +
        `${zl(k.konglomeratM2Od)}–${zl(k.konglomeratM2Do)} zł/m² brutto zależnie od kolekcji ` +
        'i grubości. W kwocie gotowego blatu jest już materiał, obróbka, wycięcia, ' +
        'pomiar laserowy i montaż.',
    },
    {
      p: 'Czy na blacie z konglomeratu można postawić gorący garnek?',
      o:
        'Nie na stałe. Konglomerat to około 90% kwarcu spojonego żywicą, a żywica ' +
        'jest najsłabszym ogniwem — przy kontakcie z bardzo gorącym naczyniem może ' +
        'zmatowieć albo pożółknąć, i takiej plamy nie da się wypolerować. Podkładka ' +
        'pod patelnię zdjętą z ognia to nie ostrożność na wyrost, tylko warunek ' +
        'gwarancji u każdego producenta.',
    },
    {
      p: 'Czy konglomerat się rysuje?',
      o:
        'W codziennym użytkowaniu praktycznie nie — jest twardszy od większości marmurów. ' +
        'Zarysowania robią dopiero twarde ziarna (piasek, okruch ceramiki) przeciągnięte ' +
        'pod naciskiem. Na blatach matowych i ciemnych ślady widać wyraźniej niż na ' +
        'polerowanych i jasnych, bo matowa powierzchnia rozprasza światło inaczej.',
    },
    {
      p: 'Czy konglomerat trzeba impregnować?',
      o:
        'Nie. Żywica zamyka pory, więc blat nie chłonie wina ani oliwy i nie wymaga ' +
        'okresowej impregnacji — w odróżnieniu od marmuru czy niektórych granitów. ' +
        'Do codziennego mycia wystarczy miękka ściereczka i płyn do naczyń.',
    },
    {
      p: 'Konglomerat czy spiek kwarcowy — co wybrać?',
      o:
        'Konglomerat jest cieplejszy w dotyku i tańszy w obróbce, ale nie znosi ' +
        'wysokiej temperatury i blaknie od mocnego słońca. Spiek wytrzymuje gorący ' +
        'garnek i UV, ale jest bardziej kruchy przy cięciu i droższy w obróbce. ' +
        `U nas gotowy blat 60 × 300 cm to od ${zl(k.konglomeratProste)} zł w konglomeracie ` +
        `i od ${zl(k.spiekProste)} zł w spieku — różnica w materiale jest mniejsza, ` +
        'niż się powszechnie sądzi.',
    },
    {
      p: 'Czy blat z konglomeratu blaknie na słońcu?',
      o:
        'Żywica jest wrażliwa na promieniowanie UV, więc blat wystawiony na ostre, ' +
        'bezpośrednie słońce przez lata może zmienić odcień — najbardziej widać to ' +
        'na kolorach nasyconych. Do kuchni z dużym oknem południowym albo na parapet ' +
        'w pełnym słońcu uczciwiej doradzamy spiek. Powiemy o tym sami przy wycenie.',
    },
    {
      p: 'Ile wzorów konglomeratu macie w cenniku?',
      o:
        `${zOdmiana(w.razem, 'wzor')} w pięciu kolekcjach: Technistone (${w.technistone}), ` +
        `Avant Quartz (${w.avant}), InterQ (${w.interq}), Pacific (${w.pacific}) ` +
        `i Caesarstone (${w.caesarstone}). Każdy z nich można wybrać w kalkulatorze ` +
        'i od razu zobaczyć cenę swojego blatu.',
    },
    {
      p: 'Gdzie będzie łączenie blatu?',
      o:
        'Płyta konglomeratu ma swój format, więc blat dłuższy niż płyta musi mieć ' +
        'łączenie. Pokazujemy na rozrysie, gdzie wypadnie, zanim cokolwiek utniemy — ' +
        'zwykle da się je schować przy zlewie albo w narożniku, gdzie i tak nikt ' +
        'nie patrzy. Spoinę barwimy pod kolor płyty.',
    },
  ];
}

export function tresc(k, w) {
  const faq = pytania(k, w);

  return `  <main id="tresc" class="wrap tekst">
    <nav class="okruszki" aria-label="Ścieżka nawigacji">
      <a href="/">Strona główna</a> <span aria-hidden="true">›</span> <span>Poradnik: blaty z konglomeratu kwarcowego</span>
    </nav>

    <p>
      O konglomeracie kwarcowym napisano w internecie bardzo dużo i bardzo niewiele
      konkretów. Sprawdziliśmy artykuły, które Google pokazuje najwyżej na hasło
      „blat z konglomeratu cena": <strong>najobszerniejszy z nich nie podaje ani jednej
      kwoty</strong>, a pozostałe podają liczby w trzech różnych jednostkach, których
      nie da się ze sobą porównać. Ten poradnik piszemy z warsztatu, w którym te płyty
      tniemy od 2014 roku, i podajemy <strong>ceny z naszego cennika</strong> — takie,
      za jakie naprawdę robimy blaty.
    </p>

    <h2 id="ile-kosztuje">Ile kosztuje blat z konglomeratu kwarcowego</h2>
    <p>
      Najkrócej: <strong>gotowy blat 60 × 300 cm zaczyna się u nas od
      ${zl(k.konglomeratProste)} zł brutto</strong>, a kuchnia w literę L od
      <strong>${zl(k.konglomeratL)} zł brutto</strong>. Sam materiał to
      <strong>${zl(k.konglomeratM2Od)}–${zl(k.konglomeratM2Do)} zł/m² brutto</strong> —
      rozrzut bierze się z kolekcji i grubości płyty.
    </p>
    <p>
      Te dwie liczby znaczą co innego i tu zaczyna się nieporozumienie, na którym
      wykłada się większość poradników. <strong>Materiał to zwykle mniej niż połowa
      rachunku.</strong> Reszta to robota, której nikt nie wycenia w artykułach,
      bo nikt jej nie wykonuje:
    </p>

    <div class="tabela-szeroka">
      <table class="zestawienie">
        <caption>Z czego składa się cena blatu z konglomeratu</caption>
        <thead>
          <tr><th>Składnik</th><th>Co to jest</th><th>Ile waży w rachunku</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Materiał</strong></td>
            <td>Płyta konglomeratu — ${zl(k.konglomeratM2Od)}–${zl(k.konglomeratM2Do)} zł/m². Rozliczamy całe płyty, bo tak je kupujemy.</td>
            <td>40–60%</td>
          </tr>
          <tr>
            <td><strong>Obróbka i krawędź</strong></td>
            <td>Cięcie, szlif, polerowanie widocznych krawędzi, fazowanie.</td>
            <td>15–25%</td>
          </tr>
          <tr>
            <td><strong>Wycięcia</strong></td>
            <td>Otwór pod zlew, pod płytę indukcyjną, pod baterię i dozownik.</td>
            <td>5–15%</td>
          </tr>
          <tr>
            <td><strong>Pomiar i montaż</strong></td>
            <td>Pomiar laserowy Prolinerem u klienta, dowóz, wniesienie, montaż, klejenie łączeń.</td>
            <td>15–25%</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p>
      Dlatego „cena za metr" niewiele mówi, dopóki nie wiadomo, ile tych metrów wyjdzie
      z płyty i ile w blacie jest wycięć. Blat 260 cm i blat 320 cm mogą kosztować
      tyle samo, jeśli oba schodzą z jednej płyty — i różnić się o kilka tysięcy,
      jeśli drugi wymaga płyty numer dwa.
    </p>
    <p class="cta-tekst">
      <a class="btn" href="/#kreator" data-miejsce="poradnik-konglomerat-cena">Policz swój blat z konglomeratu →</a>
    </p>

    <h2 id="co-to-jest">Czym jest konglomerat kwarcowy</h2>
    <p>
      To materiał produkowany, a nie wydobywany: około <strong>90–95% mielonego
      kwarcu</strong> naturalnego, spojonego <strong>żywicą poliestrową</strong>
      z dodatkiem pigmentów, sprasowanego pod próżnią i utwardzonego. Kwarc daje
      twardość, żywica — szczelność i powtarzalność.
    </p>
    <p>
      Z tego składu wynika wszystko, co niżej: skoro spoiwem jest tworzywo, to blat
      jest nieprzepuszczalny i nie wymaga impregnacji, ale ma granicę odporności
      na temperaturę i na słońce. To nie wada konkretnej marki — to cecha materiału,
      identyczna u wszystkich producentów.
    </p>

    <h2 id="wady">Wady konglomeratu — uczciwie</h2>
    <p>
      Zaczynamy od wad, bo to one decydują, czy materiał pasuje do konkretnej kuchni.
      Zalety i tak wypiszą wszyscy.
    </p>

    <h3>Gorący garnek zostawia ślad</h3>
    <p>
      Żywica zaczyna reagować na temperaturę znacznie niżej niż kamień. Patelnia
      prosto z palnika, garnek z gotującym się dżemem, blacha z piekarnika — każde
      z tych naczyń może zostawić matową plamę albo pożółkły ślad. Takiego uszkodzenia
      <strong>nie da się wypolerować</strong>: żywica nie wraca do poprzedniego stanu.
      Podkładka nie jest ostrożnością na wyrost, tylko warunkiem gwarancji.
    </p>

    <h3>Słońce zmienia kolor</h3>
    <p>
      Promieniowanie UV rozkłada żywicę powoli, ale nieodwracalnie. Blat przy dużym
      oknie południowym, parapet w pełnym słońcu albo blat na tarasie po kilku latach
      potrafi zmienić odcień — najwyraźniej w kolorach nasyconych i ciemnych.
      <strong>Do takich miejsc sami odradzamy konglomerat</strong> i proponujemy spiek,
      który UV nie robi nic.
    </p>

    <h3>Zarysowania widać na matach</h3>
    <p>
      Sam materiał rysuje się trudno — jest twardszy od marmuru i od większości
      granitów. Ale ziarno piasku przeciągnięte pod naciskiem zrobi ślad na każdym
      blacie, a na powierzchni <strong>matowej i ciemnej</strong> widać go dużo
      wyraźniej niż na polerowanej i jasnej. Jeśli komuś przeszkadza każdy ślad,
      lepiej wybrać jaśniejszy wzór z drobnym deseniem.
    </p>

    <h3>Łączenia są widoczne z bliska</h3>
    <p>
      Blat dłuższy niż płyta musi mieć spoinę. Barwimy ją pod kolor płyty i schowamy
      w miejscu, w którym najmniej rzuca się w oczy, ale z odległości pół metra
      przy dobrym świetle będzie widoczna. Kto oczekuje jednolitej tafli przez sześć
      metrów, będzie rozczarowany — i nie jest to kwestia staranności montażu,
      tylko formatu płyty.
    </p>

    <h2 id="zalety">Zalety, które naprawdę mają znaczenie</h2>
    <ul class="lista-plus">
      <li>
        <strong>Zero impregnacji.</strong> Blat nie chłonie wina, oliwy ani soku
        z buraka. Marmur w tym samym miejscu wymagałby impregnacji co rok.
      </li>
      <li>
        <strong>Powtarzalność.</strong> To materiał produkowany, więc druga płyta
        wygląda jak pierwsza. Przy blacie z dwóch płyt to różnica między
        „nie widać łączenia" a „widać dwa różne kamienie".
      </li>
      <li>
        <strong>Cieplejszy w dotyku</strong> niż granit czy spiek — drobiazg,
        który czuć przy każdym oparciu dłoni.
      </li>
      <li>
        <strong>Lżejszy od kamienia naturalnego</strong> o mniej więcej jedną piątą,
        więc standardowa zabudowa kuchenna zwykle nie wymaga wzmocnień.
      </li>
      <li>
        <strong>Najszerszy wybór bieli i calacatt.</strong> Jeśli ktoś szuka
        czystej, równej bieli — w kamieniu naturalnym takiej po prostu nie ma.
      </li>
    </ul>

    <h2 id="porownanie">Konglomerat, spiek czy granit — tabela porównawcza</h2>
    <p>
      Ceny w tabeli to nasze realne kwoty za gotowy blat 60 × 300 cm, a nie
      widełki rynkowe. Dzięki temu da się je porównać między wierszami.
    </p>

    <div class="tabela-szeroka">
      <table class="zestawienie">
        <caption>Konglomerat kwarcowy a spiek i kamień naturalny</caption>
        <thead>
          <tr><th>Cecha</th><th>Konglomerat</th><th>Spiek kwarcowy</th><th>Granit</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Gotowy blat 60 × 300 cm od</td>
            <td><strong>${zl(k.konglomeratProste)} zł</strong></td>
            <td>${zl(k.spiekProste)} zł</td>
            <td>wycena po wskazaniu płyty</td>
          </tr>
          <tr>
            <td>Materiał zł/m² brutto</td>
            <td>${zl(k.konglomeratM2Od)}–${zl(k.konglomeratM2Do)}</td>
            <td>${zl(k.spiekM2Od)}–${zl(k.spiekM2Do)}</td>
            <td>zależnie od bloku</td>
          </tr>
          <tr>
            <td>Gorący garnek</td>
            <td>nie — ślad po żywicy</td>
            <td>tak</td>
            <td>tak</td>
          </tr>
          <tr>
            <td>Odporność na UV</td>
            <td>ograniczona</td>
            <td>pełna</td>
            <td>pełna</td>
          </tr>
          <tr>
            <td>Impregnacja</td>
            <td>niepotrzebna</td>
            <td>niepotrzebna</td>
            <td>zwykle co 1–2 lata</td>
          </tr>
          <tr>
            <td>Powtarzalność wzoru</td>
            <td>bardzo wysoka</td>
            <td>bardzo wysoka</td>
            <td>każda płyta inna</td>
          </tr>
          <tr>
            <td>W dotyku</td>
            <td>ciepły</td>
            <td>chłodny</td>
            <td>chłodny</td>
          </tr>
          <tr>
            <td>Wzorów w naszym cenniku</td>
            <td><strong>${w.razem}</strong></td>
            <td>${w.spieki}</td>
            <td>z magazynu, na sztuki</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p>
      Skrótowo: <strong>konglomerat do kuchni bez ostrego słońca, spiek tam, gdzie
      stawia się gorące naczynia albo świeci mocno w okno, granit dla kogoś, kto
      chce kamień z historią i akceptuje impregnację.</strong>
    </p>

    <h2 id="grubosc">Grubość płyty a cena i wygląd krawędzi</h2>
    <p>
      Konglomerat mamy w grubościach <strong>12, 15, 20 i 30 mm</strong>, zależnie
      od kolekcji. Blat 20 mm to standard do kuchni. 30 mm daje masywną krawędź bez
      żadnych sztuczek, ale kosztuje więcej i waży odpowiednio więcej. Cieńsze płyty
      (12–15 mm) używa się głównie na okładziny i fronty, a jako blat wymagają
      podklejenia, żeby krawędź wyglądała solidnie.
    </p>

    <h2 id="kolekcje">Które kolekcje konglomeratu mamy w cenniku</h2>
    <p>
      W kalkulatorze można dziś wybrać <strong>${w.razem} wzorów</strong> w pięciu
      kolekcjach — każdy z gotową ceną, bez pytania o ofertę:
    </p>
    <ul class="lista-kolekcje">
      <li><strong>Technistone</strong> — ${zOdmiana(w.technistone, 'dekor')}. Czeski kwarc, mocne biele i calacatty.</li>
      <li><strong>Avant Quartz</strong> — ${zOdmiana(w.avant, 'dekor')}. Najszerszy wybór wzorów, ciepły w dotyku.</li>
      <li><strong>InterQ</strong> — ${zOdmiana(w.interq, 'dekor')}. Kwarco-granity: wzory marmurów i kwarcytów.</li>
      <li><strong>Pacific</strong> — ${zOdmiana(w.pacific, 'dekor')}. Wielka płyta 348 × 201 cm, mniej łączeń.</li>
      <li><strong>Caesarstone</strong> — ${zOdmiana(w.caesarstone, 'dekor')}. Światowa marka premium, bardzo równa jakość płyt.</li>
    </ul>
    <p>
      Pełne katalogi wzorów z próbkami są na <a href="/blaty-z-konglomeratu">stronie
      kolekcji konglomeratu</a>. Jeśli ktoś szuka konkretnej płyty taniej,
      warto zajrzeć na <a href="/wyprzedaz-plyt">wyprzedaż płyt</a> — leżą tam
      pojedyncze sztuki z naszego placu w niższej cenie.
    </p>

    <h2 id="realizacje">Jak to wygląda u klientów</h2>
    <p>
      W naszej galerii jest <strong>${w.realizacje} ${odmiana(w.realizacje, FORMY_REALIZACJI)}</strong> z konglomeratu —
      zdjęcia blatów, które sami wycięliśmy i zamontowaliśmy, każde podpisane
      nazwą konkretnego wzoru. To nie są zdjęcia z banku zdjęć: przy każdym
      widać, jak dany dekor zachowuje się w prawdziwym świetle i przy prawdziwej
      zabudowie — łącznie z tym, gdzie wypadło łączenie.
    </p>
    <p class="cta-tekst">
      <a class="btn" href="/realizacje" data-miejsce="poradnik-konglomerat-realizacje">Zobacz realizacje z konglomeratu →</a>
    </p>

    <h2 id="pielegnacja">Pielęgnacja blatu z konglomeratu</h2>
    <p>
      Codziennie: miękka ściereczka i płyn do naczyń. Tyle wystarczy, bo blat
      nie ma porów. Czego <strong>nie wolno</strong>: mleczka ściernego i druciaka
      (matowią połysk), środków silnie zasadowych i preparatów z podchlorynem
      (rozkładają żywicę), acetonu i zmywacza do paznokci. Zaschniętą plamę lepiej
      namoczyć niż zeskrobać.
    </p>

    <h2 id="dla-kogo">Dla kogo konglomerat ma sens, a dla kogo nie</h2>
    <p><strong>Ma sens, gdy:</strong></p>
    <ul>
      <li>zależy Ci na równym, powtarzalnym wzorze — zwłaszcza na bieli;</li>
      <li>kuchnia nie stoi w pełnym południowym słońcu;</li>
      <li>nie chcesz pamiętać o impregnacji;</li>
      <li>blat ma być ciepły w dotyku.</li>
    </ul>
    <p><strong>Nie ma sensu, gdy:</strong></p>
    <ul>
      <li>odstawiasz gorące naczynia wprost na blat — wtedy spiek;</li>
      <li>blat idzie na taras, parapet w słońcu albo do przeszklonej kuchni;</li>
      <li>chcesz kamień z naturalnym, niepowtarzalnym rysunkiem — wtedy granit lub marmur.</li>
    </ul>
    <p>
      Przy wycenie mówimy to sami. Wolimy stracić jedno zamówienie niż zrobić blat,
      który po dwóch latach przestanie się podobać.
    </p>

    <h2 id="faq">Najczęstsze pytania o blaty z konglomeratu</h2>
${faq.map((f) => `    <h3>${f.p}</h3>\n    <p>${f.o}</p>`).join('\n')}

    <h2 id="gdzie">Gdzie robimy blaty z konglomeratu</h2>
    <p>
      Zakład mamy w <strong>Tarnobrzegu przy ul. Szpitalnej 8</strong>. Pomiar
      i montaż robimy w Tarnobrzegu i okolicy —
      <a href="/blaty-kuchenne-stalowa-wola">Stalowa Wola</a>,
      <a href="/blaty-kuchenne-sandomierz">Sandomierz</a>,
      <a href="/blaty-kuchenne-mielec">Mielec</a>,
      <a href="/blaty-kuchenne-nisko">Nisko</a>,
      <a href="/blaty-kuchenne-nowa-deba">Nowa Dęba</a>,
      <a href="/blaty-kuchenne-staszow">Staszów</a> —
      a także w <a href="/blaty-kuchenne-rzeszow">Rzeszowie</a>,
      <a href="/blaty-kuchenne-kielce">Kielcach</a>,
      <a href="/blaty-kuchenne-lublin">Lublinie</a> i
      <a href="/blaty-kuchenne-krakow">Krakowie</a>.
    </p>
    <p class="cta-tekst">
      <a class="btn" href="/#kreator" data-miejsce="poradnik-konglomerat-koniec">Policz swój blat →</a>
      albo zadzwoń: <a href="tel:+48796991128" data-miejsce="poradnik-konglomerat">796 991 128</a>
    </p>
  </main>
`;
}

export function schema(k, w, { tytul, opis, adres }) {
  const faq = pytania(k, w);

  const artykul = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${adres}#artykul`,
        headline: tytul,
        description: opis,
        inLanguage: 'pl-PL',
        author: { '@type': 'Person', name: 'Dawid Ząbek', jobTitle: 'Kamieniarz' },
        publisher: { '@id': 'https://kam24h.pl/#firma' },
        mainEntityOfPage: adres,
        about: [
          { '@type': 'Thing', name: 'konglomerat kwarcowy' },
          { '@type': 'Thing', name: 'blat kuchenny' },
        ],
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Strona główna', item: 'https://kam24h.pl/' },
          { '@type': 'ListItem', position: 2, name: 'Poradnik: blaty z konglomeratu kwarcowego', item: adres },
        ],
      },
    ],
  };

  const pytaniaLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({
      '@type': 'Question',
      name: f.p,
      acceptedAnswer: { '@type': 'Answer', text: f.o },
    })),
  };

  const wciecie = (o) =>
    JSON.stringify(o, null, 2)
      .split('\n')
      .map((l, i) => (i === 0 ? l : '  ' + l))
      .join('\n');

  return (
    `  <script type="application/ld+json">\n  ${wciecie(artykul)}\n  </script>\n` +
    `  <script type="application/ld+json">\n  ${wciecie(pytaniaLd)}\n  </script>`
  );
}

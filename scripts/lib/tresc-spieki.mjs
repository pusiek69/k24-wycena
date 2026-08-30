/**
 * PORADNIK O SPIEKACH — treść i dane strukturalne.
 *
 * Osobno od generatora (`scripts/strona-spieki.mjs`), bo tekst jest długi
 * i chcemy go czytać jak tekst, a nie jak skrypt.
 *
 * ⚠ ŻADNEJ KWOTY ANI LICZBY WZORÓW NIE WPISUJEMY TU RĘCZNIE. Wszystko
 * wchodzi przez `kwoty` i `wzory`, wyliczone z cenników w generatorze —
 * inaczej poradnik zacząłby kłamać przy pierwszej zmianie cennika,
 * a nikt by tego nie zauważył, bo to zwykły tekst na stronie.
 */

/** „5 550" — spacja nierozdzielająca, żeby kwota nie łamała się na końcu wiersza. */
export const zl = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/**
 * Pytania do FAQ. Odpowiedzi celowo konkretne — ogólniki („to zależy od
 * projektu") są dokładnie tym, czym konkurencja przegrywa na frazach cenowych.
 */
export function pytania(k, w) {
  return [
    {
      p: 'Ile kosztuje blat ze spieku kwarcowego?',
      o:
        `Sam materiał to ${zl(k.spiekM2Od)}–${zl(k.spiekM2Do)} zł/m² brutto, zależnie od kolekcji ` +
        `i grubości. Gotowy blat 60 × 300 cm — z obróbką, wycięciem pod zlew i płytę grzewczą, ` +
        `transportem i montażem — zaczyna się od ${zl(k.spiekProste)} zł brutto. Kuchnia w literę L ` +
        `od ${zl(k.spiekL)} zł. Kalkulator na naszej stronie policzy konkretny blat w dwie minuty.`,
    },
    {
      p: 'Czy spiek kwarcowy jest droższy od konglomeratu?',
      o:
        `Nieznacznie. Blat 60 × 300 cm z konglomeratu zaczyna się od ${zl(k.konglomeratProste)} zł, ` +
        `ze spieku od ${zl(k.spiekProste)} zł — różnica jest mniejsza, niż większość ludzi zakłada. ` +
        'Przy droższych kolekcjach różnica rośnie, ale przy podstawowych bywa, że spiek wychodzi taniej ' +
        'od konglomeratu z górnej półki.',
    },
    {
      p: 'Czy na blacie ze spieku można postawić gorący garnek?',
      o:
        'Tak — i to jest jego największa przewaga nad konglomeratem kwarcowym. Spiek nie zawiera żywicy, ' +
        'więc nie ma czemu zżółknąć ani się odkształcić. Konglomerat przy garnku prosto z palnika potrafi ' +
        'zostawić trwałą matową plamę. Mimo to podkładkę i tak polecamy — nie ze względu na blat, ' +
        'tylko na fugę przy łączeniu i na sam garnek.',
    },
    {
      p: 'Jakie są wady spieku kwarcowego?',
      o:
        'Trzy realne. Po pierwsze jest twardy, ale kruchy — mocne punktowe uderzenie w krawędź potrafi ' +
        'wyszczerbić płytę, a takiego ubytku praktycznie nie da się naprawić niewidocznie. Po drugie ' +
        'cienkie płyty (6–12 mm) wymagają podklejenia krawędzi, żeby blat wyglądał na grubszy — to praca, ' +
        'która kosztuje. Po trzecie obróbka jest trudniejsza niż konglomeratu, więc mniej zakładów robi ' +
        'to dobrze, a poprawki bywają drogie.',
    },
    {
      p: 'Czy spiek kwarcowy trzeba impregnować?',
      o:
        'Nie. Nasiąkliwość spieku jest bliska zeru, więc nie ma czego uszczelniać — w odróżnieniu od ' +
        'granitu i marmuru, które impregnuje się co jakiś czas. Do codziennego czyszczenia wystarczy ' +
        'wilgotna ściereczka i łagodny płyn.',
    },
    {
      p: 'Czy blat ze spieku będzie miał łączenia?',
      o:
        'Zależy od długości zabudowy. Płyty mają do 324 cm długości, więc typowy prosty blat robimy ' +
        'z jednego kawałka, bez żadnego łączenia. Dłuższa zabudowa albo blat w literę L wymaga złączenia — ' +
        'przy dobrze dobranym wzorze i starannym klejeniu spoina jest linią, którą trzeba znaleźć wzrokiem.',
    },
    {
      p: 'Ile wzorów spieku macie w cenniku?',
      o:
        `${w.razem} dekorów w pięciu kolekcjach: Atlas Plan (${w.atlas}), Marazzi (${w.marazzi}), ` +
        `Laminam (${w.laminam}), Florim Stone (${w.florim}) i Keralini (${w.keralini}). ` +
        'Każdy z ceną w kalkulatorze — nie trzeba dzwonić, żeby poznać rząd wielkości.',
    },
    {
      p: 'Spiek czy granit — co wybrać do kuchni?',
      o:
        'Spiek, jeśli zależy Ci na odporności na temperaturę i plamy oraz na jednolitym, nowoczesnym ' +
        'wyglądzie bez impregnacji. Granit, jeśli chcesz niepowtarzalny rysunek kamienia i masywną ' +
        'krawędź, i nie przeszkadza Ci impregnacja raz na jakiś czas. Granit lepiej znosi punktowe ' +
        'uderzenia, spiek — wysoką temperaturę i kwasy.',
    },
  ];
}

/**
 * Treść poradnika. Nagłówki H2 celowo brzmią jak pytania, które ludzie
 * wpisują w Google — to nie ozdobnik, tylko sposób na dopasowanie do frazy.
 */
export function tresc(k, w) {
  const faq = pytania(k, w);

  return `  <main id="tresc" class="wrap tekst">
    <nav class="okruszki" aria-label="Ścieżka nawigacji">
      <a href="/">Strona główna</a> <span aria-hidden="true">›</span> <span>Poradnik: blaty ze spieku kwarcowego</span>
    </nav>

    <p>
      Spiek kwarcowy to dziś najczęściej wybierany materiał na blaty w nowych kuchniach —
      i najczęściej opisywany ogólnikami. Ten poradnik jest inny: piszemy go z warsztatu,
      w którym te płyty tniemy od 2014 roku, i podajemy <strong>konkretne kwoty z naszego
      cennika</strong>, a nie „widełki rynkowe" przepisane z innego artykułu.
    </p>

    <h2 id="ile-kosztuje">Ile kosztuje blat ze spieku kwarcowego</h2>
    <p>
      Najkrócej: <strong>gotowy blat 60 × 300 cm zaczyna się u nas od ${zl(k.spiekProste)} zł brutto</strong>,
      a kuchnia w literę L od <strong>${zl(k.spiekL)} zł brutto</strong>. Sam materiał to
      <strong>${zl(k.spiekM2Od)}–${zl(k.spiekM2Do)} zł/m² brutto</strong> — rozrzut bierze się
      z kolekcji i grubości płyty.
    </p>
    <p>
      Większość artykułów w internecie kończy się w tym miejscu na jednym zakresie „od–do".
      To za mało, żeby cokolwiek zaplanować, bo <strong>materiał to zwykle mniej niż połowa
      rachunku</strong>. Oto, z czego naprawdę składa się cena blatu:
    </p>

    <div class="tabela-szeroka">
      <table class="zestawienie">
        <caption>Z czego składa się cena blatu ze spieku</caption>
        <thead>
          <tr><th>Składnik</th><th>Co to jest</th><th>Ile waży w rachunku</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Materiał</strong></td>
            <td>Płyta spieku — ${zl(k.spiekM2Od)}–${zl(k.spiekM2Do)} zł/m². Rozliczamy całe płyty, bo tak je kupujemy.</td>
            <td>ok. 40–60%</td>
          </tr>
          <tr>
            <td><strong>Obróbka</strong></td>
            <td>Docięcie, wyszlifowanie i wykończenie krawędzi. Przy cienkiej płycie dochodzi podklejka.</td>
            <td>ok. 20–30%</td>
          </tr>
          <tr>
            <td><strong>Wycięcia</strong></td>
            <td>Otwór pod zlew (podblatowy droższy od nablatowego), pod płytę grzewczą, pod baterię i gniazdka.</td>
            <td>ok. 10–20%</td>
          </tr>
          <tr>
            <td><strong>Pomiar, transport, montaż</strong></td>
            <td>Pomiar cyfrowy Prolinerem, dowóz i montaż u klienta.</td>
            <td>ok. 10–15%</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p>
      Dlatego dwa blaty z tej samej płyty potrafią kosztować różnie: jeden ma proste cięcie
      i zlew nablatowy, drugi wyspę, zlew podblatowy i cztery otwory. Kalkulator liczy każdy
      z tych składników osobno i pokazuje rozbicie — <strong>nie musisz dzwonić, żeby poznać
      rząd wielkości</strong>.
    </p>

    <div class="cta-box">
      <div>
        <strong>Policz swój blat ze spieku w dwie minuty</strong>
        <span>Wybierasz kolekcję i podajesz wymiary — kwota z rozbiciem na materiał, obróbkę i montaż pojawia się od razu.</span>
      </div>
      <div class="cta-btny">
        <a class="btn" href="/#kreator">Przejdź do wyceny →</a>
        <a class="btn ghost" href="tel:+48796991128" data-miejsce="poradnik-spieki-gora">☎ 796 991 128</a>
      </div>
    </div>

    <h2 id="co-to-jest">Co to jest spiek kwarcowy i czym różni się od gresu</h2>
    <p>
      Spiek powstaje z mielonych minerałów — kwarcu, glinek, skaleni i pigmentów — sprasowanych
      pod ogromnym ciśnieniem i wypalonych w temperaturze powyżej 1200°C. To ten sam proces,
      który w naturze tworzy skały magmowe, tylko skrócony do godzin.
      <strong>Kluczowe: w spieku nie ma żywicy</strong> — i stąd bierze się cała jego odporność.
    </p>
    <p>
      „Spiek kwarcowy" i „gres wielkoformatowy" to w praktyce ten sam materiał opisany dwoma
      słowami — pierwsze przyjęło się w branży kamieniarskiej, drugie w ceramicznej. Różnice
      między konkretnymi markami (Laminam, Atlas Plan, Marazzi) są większe niż różnica między
      tymi dwiema nazwami.
    </p>

    <h2 id="porownanie">Spiek, konglomerat czy granit — tabela porównawcza</h2>
    <p>
      Trzy materiały, które realnie rozważa się na blat kuchenny. Poniżej to, co widać
      po latach montaży, a nie to, co piszą karty katalogowe producentów.
    </p>

    <div class="tabela-szeroka">
      <table class="zestawienie">
        <caption>Spiek kwarcowy, konglomerat i granit — porównanie</caption>
        <thead>
          <tr>
            <th>Cecha</th>
            <th>Spiek kwarcowy</th>
            <th>Konglomerat kwarcowy</th>
            <th>Granit</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Gorący garnek</td>
            <td><strong>Bez śladu</strong></td>
            <td>Może zostawić matową plamę</td>
            <td>Bez śladu</td>
          </tr>
          <tr>
            <td>Plamy (wino, kawa, cytryna)</td>
            <td><strong>Odporny</strong></td>
            <td>Odporny</td>
            <td>Wymaga impregnacji</td>
          </tr>
          <tr>
            <td>Impregnacja</td>
            <td><strong>Niepotrzebna</strong></td>
            <td>Niepotrzebna</td>
            <td>Co 1–3 lata</td>
          </tr>
          <tr>
            <td>Odporność na uderzenie w krawędź</td>
            <td>Słabsza — twardy, ale kruchy</td>
            <td>Dobra</td>
            <td><strong>Najlepsza</strong></td>
          </tr>
          <tr>
            <td>Powtarzalność wzoru</td>
            <td><strong>Pełna</strong></td>
            <td><strong>Pełna</strong></td>
            <td>Każda płyta inna</td>
          </tr>
          <tr>
            <td>Blat bez łączeń</td>
            <td><strong>Do 324 cm</strong></td>
            <td>Do 320 cm</td>
            <td>Zależy od bloku</td>
          </tr>
          <tr>
            <td>Blat 60 × 300 cm od</td>
            <td>${zl(k.spiekProste)} zł</td>
            <td>${zl(k.konglomeratProste)} zł</td>
            <td>Wycena po obejrzeniu płyty</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p>
      Wniosek z warsztatu: <strong>spiek wygrywa tam, gdzie w grę wchodzi temperatura
      i chemia</strong> — przy płycie indukcyjnej, przy piekarniku, w kuchni, w której
      naprawdę się gotuje. Granit wygrywa tam, gdzie chcesz masywu i niepowtarzalnego
      rysunku. Konglomerat jest bezpiecznym środkiem, jeśli nie stawiasz garnków wprost
      na blacie. Więcej o alternatywach: <a href="/blaty-z-konglomeratu">blaty z konglomeratu</a>
      i <a href="/blaty-granitowe">blaty granitowe</a>.
    </p>

    <h2 id="wady">Wady spieku kwarcowego — uczciwie</h2>
    <p>
      Żaden materiał nie jest bez wad, a te akurat warto znać <em>przed</em> zamówieniem,
      nie po. Piszemy o nich wprost, bo klient, który wie, czego się spodziewać, jest
      zadowolony — a ten, którego zaskoczyliśmy, nie.
    </p>

    <h3>Twardy, ale kruchy</h3>
    <p>
      Spieku nie da się porysować nożem ani zmatowić kwasem, ale mocne punktowe uderzenie
      w krawędź — spadający garnek żeliwny, upuszczony młotek podczas remontu — potrafi
      wyszczerbić płytę. <strong>Takiego ubytku praktycznie nie da się naprawić niewidocznie</strong>,
      bo materiał ma jednolitą strukturę na wskroś i nie ma czym go uzupełnić. To najpoważniejsza
      wada tego materiału i jedyna, przy której mówimy klientom „uwaga".
    </p>

    <h3>Cienka płyta wymaga podklejki</h3>
    <p>
      Spiek produkuje się w grubościach od 6 do 20 mm. Płyta 12 mm na blacie kuchennym wygląda
      cienko — dlatego krawędź podkleja się drugim paskiem materiału, żeby uzyskać optycznie
      2 albo 4 cm. To dodatkowa praca i dodatkowy koszt, o którym cenniki materiału milczą,
      a który realnie wchodzi do rachunku.
    </p>

    <h3>Trudniejsza obróbka</h3>
    <p>
      Cięcie spieku wymaga innych narzędzi i innego prowadzenia niż konglomerat — przy złym
      podejściu płyta pęka na stole, zanim trafi do klienta. W praktyce znaczy to tyle, że
      <strong>mniej zakładów robi to dobrze</strong>. Pytając o wycenę, warto zapytać wprost,
      ile blatów ze spieku dany zakład zrobił.
    </p>

    <h3>Cena wejścia</h3>
    <p>
      Spiek jest droższy od podstawowego konglomeratu — choć różnica jest mniejsza, niż
      sugeruje większość artykułów. U nas blat 60 × 300 cm to ${zl(k.spiekProste)} zł ze spieku
      wobec ${zl(k.konglomeratProste)} zł z konglomeratu. Przy droższych kolekcjach dystans rośnie.
    </p>

    <h2 id="grubosc">Grubość płyty a wygląd i cena krawędzi</h2>
    <p>
      To pytanie wraca przy prawie każdym zamówieniu. W skrócie:
    </p>
    <ul>
      <li><strong>6 mm</strong> — na blat kuchenny za cienki; używamy do okładzin ścian i frontów.</li>
      <li><strong>12 mm</strong> — najczęstszy wybór na blat. Lekki, ale krawędź prawie zawsze podklejamy.</li>
      <li><strong>20 mm</strong> — wygląda masywnie bez podklejania, droższy w materiale, ale prostszy w obróbce.</li>
    </ul>
    <p>
      Wbrew intuicji <strong>blat z cienkiej płyty nie zawsze wychodzi taniej</strong>: to,
      co oszczędzasz na materiale, dopłacasz za podklejkę krawędzi. Przy krótkim blacie różnica
      jest niewielka, przy długiej zabudowie z wyspą — już zauważalna. Kalkulator liczy oba
      warianty, więc najprościej po prostu porównać.
    </p>

    <h2 id="laczenia">Łączenia — gdzie wypadną i jak je ukryć</h2>
    <p>
      Płyty spieku mają do 324 cm długości, więc <strong>typowy prosty blat robimy z jednego
      kawałka</strong>. Łączenie pojawia się przy dłuższej zabudowie, przy blacie w literę L
      i czasem przy wyspie.
    </p>
    <p>
      Dobrze wykonana spoina jest linią, którą trzeba znaleźć wzrokiem — ale „dobrze wykonana"
      znaczy: zaplanowana tam, gdzie naturalnie kończy się ciąg roboczy (nie na środku blatu
      przed zlewem), z dopasowanym rysunkiem po obu stronach i sklejona na kolor płyty.
      Przy wzorach marmurowych dobieramy sąsiadujące fragmenty tak, żeby żyłkowanie przechodziło
      przez spoinę. To robota, o którą warto zapytać, zanim wybierze się wykonawcę.
    </p>

    <h2 id="pielegnacja">Pielęgnacja blatu ze spieku</h2>
    <p>
      Najprostsza ze wszystkich materiałów, które robimy. Wilgotna ściereczka i łagodny płyn
      do naczyń wystarczą na co dzień. <strong>Impregnacja jest niepotrzebna</strong> —
      nasiąkliwość jest bliska zeru, więc nie ma czego uszczelniać.
    </p>
    <p>
      Czego unikać: agresywnych proszków ściernych na powierzchniach polerowanych (zmatowią
      połysk) i stawiania rozgrzanych naczyń wprost na spoinie. Zaschnięty kamień z wody
      schodzi octem, a tłuszcz — zwykłym odtłuszczaczem do kuchni.
      Więcej: <a href="/baza-wiedzy/pielegnacja-i-impregnacja">pielęgnacja i impregnacja blatów</a>.
    </p>

    <h2 id="kolekcje">Które kolekcje spieku mamy w cenniku</h2>
    <p>
      <strong>${w.razem} dekorów w pięciu kolekcjach</strong>, każdy z ceną w kalkulatorze.
      To nie jest „mamy dostęp do spieków" — to policzalne wzory, które możesz wycenić od ręki.
    </p>
    <ul>
      <li><strong>Atlas Plan</strong> — ${w.atlas} dekorów. Włoski gres wielkoformatowy, bardzo szeroki wybór wzorów marmurowych, płyty do 324 cm.</li>
      <li><strong>Marazzi</strong> — ${w.marazzi} dekorów. Klasyk włoskiej ceramiki, wzory kamienia i betonu.</li>
      <li><strong>Laminam</strong> — ${w.laminam} dekorów. Marka, która wymyśliła ten format; cienkie płyty, mocne biele.</li>
      <li><strong>Florim Stone</strong> — ${w.florim} dekorów. Wzory kamienia naturalnego na wielkiej płycie.</li>
      <li><strong>Keralini</strong> — ${w.keralini} dekorów, grubości 12 i 20 mm. Można kupić połówkę płyty, co przy krótkim blacie realnie obniża koszt.</li>
    </ul>
    <p>
      Pełne ceny i wzory: <a href="/blaty-ze-spieku">blaty ze spieku — cennik i kolekcje</a>.
      Jeśli szukasz konkretnego dekoru, którego u nas nie widzisz — zadzwoń. Mamy dostęp
      do wszystkich marek na rynku, a w cenniku trzymamy te, które realnie schodzą.
    </p>

    <h2 id="dla-kogo">Dla kogo spiek ma sens, a dla kogo nie</h2>
    <p><strong>Ma sens, jeśli:</strong></p>
    <ul>
      <li>naprawdę gotujesz i stawiasz gorące naczynia na blacie,</li>
      <li>chcesz jednolity, powtarzalny wzór — także na wyspie i na ścianie,</li>
      <li>zależy Ci na blacie, którego nie trzeba impregnować,</li>
      <li>planujesz długą zabudowę i chcesz uniknąć łączeń.</li>
    </ul>
    <p><strong>Nie ma sensu, jeśli:</strong></p>
    <ul>
      <li>szukasz najtańszego blatu — laminat i podstawowy konglomerat będą tańsze,</li>
      <li>zależy Ci na niepowtarzalnym rysunku kamienia — to domena
        <a href="/blaty-granitowe">granitu i kwarcytu</a>,</li>
      <li>w kuchni bywa ciężko i głośno (warsztat, remont), a krawędź blatu jest narażona
        na uderzenia.</li>
    </ul>

    <div class="cta-box">
      <div>
        <strong>Wiesz już, czego chcesz? Policz cenę</strong>
        <span>Kalkulator poda kwotę z rozbiciem i wyśle zestawienie na e-mail. Bez zobowiązań.</span>
      </div>
      <div class="cta-btny">
        <a class="btn" href="/#kreator">Wyceń blat ze spieku →</a>
        <a class="btn ghost" href="tel:+48796991128" data-miejsce="poradnik-spieki-dol">☎ 796 991 128</a>
      </div>
    </div>

    <h2 id="faq">Najczęstsze pytania o blaty ze spieku</h2>
${faq.map((f) => `    <div class="faq-poz">
      <h3>${f.p}</h3>
      <p>${f.o}</p>
    </div>`).join('\n')}

    <h2 id="gdzie">Gdzie robimy blaty ze spieku</h2>
    <p>
      Zakład mamy w <a href="/blaty-kuchenne-tarnobrzeg">Tarnobrzegu przy ul. Szpitalnej 8</a> —
      płyty docinamy, szlifujemy i kleimy u siebie, nie pośredniczymy. Bezpłatny pomiar
      Prolinerem w promieniu około 100 km: <a href="/blaty-kuchenne-sandomierz">Sandomierz</a>,
      <a href="/blaty-kuchenne-stalowa-wola">Stalowa Wola</a>,
      <a href="/blaty-kuchenne-mielec">Mielec</a>, <a href="/blaty-kuchenne-rzeszow">Rzeszów</a>,
      <a href="/blaty-kuchenne-kielce">Kielce</a>, <a href="/blaty-kuchenne-nisko">Nisko</a>.
      Montaże realizujemy w całej Polsce — także
      <a href="/blaty-kuchenne-lublin">w Lublinie</a> i <a href="/blaty-kuchenne-krakow">Krakowie</a>,
      gdzie warunki dojazdu ustalamy przy zamówieniu.
    </p>

    <p class="cta-linia">
      Chcesz zobaczyć, co już stoi w kuchniach? <a href="/realizacje">Zobacz nasze realizacje</a>
      — albo od razu <a href="/#kreator">policz swój blat</a>.
    </p>
  </main>`;
}

/** Dane strukturalne: Article + FAQPage + okruszki. */
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
          { '@type': 'Thing', name: 'spiek kwarcowy' },
          { '@type': 'Thing', name: 'blat kuchenny' },
        ],
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Strona główna', item: 'https://kam24h.pl/' },
          { '@type': 'ListItem', position: 2, name: 'Poradnik: blaty ze spieku kwarcowego', item: adres },
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

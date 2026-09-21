/**
 * BLOKI TREŚCI NA STRONACH MIAST — ceny, realizacje, dzielnice, sąsiedzi.
 *
 * Powstało 06.09.2026 po analizie konkurencji (IGNIKOM, Jeżowe — strony
 * miast Tarnobrzeg / Stalowa Wola / Sandomierz / Baranów Sandomierski).
 * Czym oni wygrywali z nami na stronie miasta:
 *
 *   • jawne „od X zł/m²" przy każdym materiale — u nas cena była schowana
 *     dopiero w FAQ, a klient chce ją zobaczyć od razu,
 *   • sekcja realizacji ze zdjęciami — u nas zdjęcia były wyłącznie
 *     na /realizacje, więc strona miasta nie pokazywała ani jednej roboty,
 *   • nazwy DZIELNIC miasta w treści, nie tylko sąsiednich gmin,
 *   • linki do pozostałych stron miast z odległością.
 *
 * Wszystkie cztery rzeczy robimy tu u siebie, tylko szerzej: oni pokazują
 * trzy zdjęcia i trzy ceny „od", my mamy 43 realizacje i prawdziwy cennik
 * ~700 wzorów, więc podajemy ZAKRES materiału ORAZ cenę gotowego,
 * zamontowanego blatu — czego u nich nie ma wcale.
 *
 * ⚠ CENY. `konglomeratM2Od` i `spiekM2Od` to cena SAMEJ PŁYTY (materiału)
 * w zł/m² brutto — tak samo, jak opisują je strony materiałowe. Podpisanie
 * ich jako „blat od…" byłoby wprowadzaniem klienta w błąd, bo do blatu
 * dochodzi obróbka, pomiar, transport i montaż. Dlatego w tabeli stoją
 * DWIE kolumny i każda mówi wprost, co obejmuje.
 *
 * ⚠ Kamień naturalny NIE MA ceny „od" i celowo jej tu nie wymyślamy —
 * liczy się go z konkretnej płyty ze stanu magazynowego Interstone.
 * Konkurencja podaje „granit od 544 zł/m²"; my wolimy powiedzieć prawdę
 * niż dopisać liczbę, której nie umiemy obronić przy telefonie.
 */

/** 5500 → „5 500" */
const zl = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/** ['A','B','C'] → „A, B i C" */
export const wyliczenie = (lista) =>
  lista.length < 2 ? lista.join('') : `${lista.slice(0, -1).join(', ')} i ${lista.at(-1)}`;

/* ─────────────────────────────────────────────────────────── ceny */

/**
 * KTÓRY MATERIAŁ — tekst WŁASNY MIASTA, nie szablon.
 *
 * Propozycja dziennego zadania SEO z 20–21.09.2026, dla Mielca: strona
 * ma 1 361 słów i dziewięć nagłówków, ale żaden nie łączy słowa
 * „kamienne" z nazwą miasta, a w GSC Mielec drugi tydzieŃ z rzędu ma
 * zero wyświetleń. To jest też jedyny blok, który NIE jest kopią
 * pozostałych czternastu stron — więc pisany jest per miasto i na razie
 * ma go tylko Mielec.
 *
 * Liczby wzorów bierzemy z `liczby` (to samo źródło co tabela cen niżej),
 * żeby po zmianie cennika nie został tu literal sprzed pół roku.
 * Kwot tu NIE MA świadomie — są w tabeli bezpośrednio pod spodem.
 */
const WYBOR_MATERIALU = {
  mielec: (m, liczby) => `      <section class="miasto-wybor" aria-labelledby="wybor-${m.slug}">
        <h2 id="wybor-${m.slug}">Blaty kamienne ${m.nazwa} — granit, konglomerat czy spiek?</h2>
        <p>
          Trzy materiały, trzy różne sytuacje. <strong>Konglomerat kwarcowy</strong>
          wybiera najwięcej klientów z mieleckich bloków (Lotników, Smoczka, Borek)
          — to zwykle wymiana starego blatu bez ruszania szafek: konglomerat dobrze
          znosi standardowe głębokości 60 cm, ma ${liczby.konglomeratWzory} jednolitych
          wzorów i nie wymaga impregnacji.
        </p>
        <p>
          <strong>Spiek kwarcowy</strong> bierzemy do domów pod ${m.doMiasta} z wyspą
          lub długą linią szafek — płyta jest większa, więc blat 300 cm wychodzi
          bez łączenia, a powierzchnia nie boi się gorącego garnka ani noża. Spiek ma
          też najwięcej wzorów (${liczby.spiekWzory}), w tym imitacje marmuru, które
          w konglomeracie wypadają gorzej.
        </p>
        <p>
          <strong>Granit</strong> to wybór, gdy blat ma być z prawdziwego kamienia
          i najmniej wrażliwy na wysoką temperaturę; wyceniamy go z konkretnej płyty,
          bo każda sztuka jest inna — dlatego nie podajemy tu ceny „od". Jeśli nie
          wiecie, który wybrać, kalkulator poniżej liczy konglomerat i spiek dla
          Państwa wymiarów, a granit wycenimy po wyborze płyty.
        </p>
      </section>`,
};

/** Blok wyboru materiału dla miasta, które ma własny tekst. */
export function blokWyboru(m, liczby) {
  const tresc = WYBOR_MATERIALU[m.slug];
  return tresc ? tresc(m, liczby) : '';
}

/**
 * TABELA CEN — pierwsza rzecz, której klient szuka na stronie miasta.
 *
 * Liczby biorą się z `lib/ceny-tresc.json`, czyli z tego samego miejsca
 * co ceny na stronach materiałowych i w FAQ. Jedno źródło znaczy, że po
 * zmianie cennika nie zostanie gdzieś stara kwota — a przy piętnastu
 * stronach miast ręczne pilnowanie tego nie miałoby szans.
 */
export function blokCen(m, kwoty, liczby) {
  return `      <section class="miasto-ceny" aria-labelledby="ceny-${m.slug}">
        <h2 id="ceny-${m.slug}">Ile kosztuje blat kamienny w ${m.wMiescie}</h2>
        <p>
          Ceny są te same, co w kalkulatorze — nie mamy osobnego cennika
          „dla ${m.doMiasta}". Kolumna po prawej to <strong>cena gotowego,
          zamontowanego blatu</strong>, a nie samej płyty: mieści już obróbkę,
          wycięcie pod zlew i płytę grzewczą, transport i montaż.
        </p>
        <div class="tabela-przewijana">
          <table class="zestawienie cennik-miasto">
            <caption>Blat kuchenny 60 × 300 cm — ${m.nazwa} i okolice</caption>
            <thead>
              <tr>
                <th scope="col">Materiał</th>
                <th scope="col">Sama płyta</th>
                <th scope="col">Gotowy blat z montażem</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Konglomerat kwarcowy<br><span class="drobne">${liczby.konglomeratWzory} wzorów</span></th>
                <td>od ${zl(kwoty.konglomeratM2Od)} zł/m²</td>
                <td><strong>od ${zl(kwoty.konglomeratProste)} zł</strong></td>
              </tr>
              <tr>
                <th scope="row">Spiek kwarcowy<br><span class="drobne">${liczby.spiekWzory} wzorów</span></th>
                <td>od ${zl(kwoty.spiekM2Od)} zł/m²</td>
                <td><strong>od ${zl(kwoty.spiekProste)} zł</strong></td>
              </tr>
              <tr>
                <th scope="row">Kamień naturalny<br><span class="drobne">granit, marmur, kwarcyt</span></th>
                <td colspan="2">
                  Wycena z konkretnej płyty — każda sztuka jest inna, więc
                  ceny „od" tu nie podajemy. <a href="/blaty-granitowe">Zobacz, jak to liczymy →</a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Kuchnia w L (odcinki 300 i 180 cm) to od ${zl(kwoty.konglomeratL)} zł
          w konglomeracie i od ${zl(kwoty.spiekL)} zł w spieku. Wszystkie kwoty brutto.
          <a href="/#kreator">Policz swój blat →</a> — kalkulator poda widełki
          dla Państwa wymiarów w dwie minuty, bez podawania numeru telefonu.
        </p>
        <p class="miasto-wyprzedaz">
          <strong>Taniej:</strong> mamy też <a href="/wyprzedaz-plyt">wyprzedaż płyt z placu</a> —
          konkretne sztuki z magazynu w niższej cenie, rozliczane za całą płytę.
          Do ${m.doMiasta} wozimy je tak samo jak resztę.
        </p>
      </section>`;
}

/* ────────────────────────────────────────────────────── realizacje */

/**
 * TRZY REALIZACJE — inne na każdej stronie miasta.
 *
 * Zdjęcia bierzemy z tego samego manifestu co galeria (`realizacje.json`),
 * a wybór przesuwamy o numer miasta, żeby dwie sąsiadujące strony nie
 * pokazywały tej samej kuchni. To nie jest kosmetyka: piętnaście stron
 * z identycznym kompletem zdjęć wygląda w oczach Google jak jedna strona
 * powielona piętnaście razy — a tego właśnie unikamy.
 *
 * ⚠ Podpis NIE MÓWI, że realizacja jest z tego miasta. Nie wiemy tego,
 * a wpisanie „nasza realizacja w Mielcu" pod zdjęciem z innej kuchni
 * byłoby zwykłym kłamstwem. Alt niesie materiał i rodzaj zabudowy —
 * czyli to, co na zdjęciu naprawdę widać.
 */
export function blokRealizacji(m, realizacje, i) {
  if (!realizacje?.length) return '';
  const ile = 3;
  const start = (i * ile) % realizacje.length;
  const wybrane = Array.from({ length: ile }, (_, k) => realizacje[(start + k) % realizacje.length]);

  const kafle = wybrane
    .map(
      (r) => `            <figure>
              <picture>
                <source srcset="/realizacje/${r.slug}-mini.webp" type="image/webp" />
                <img src="/realizacje/${r.slug}-mini.jpg" alt="${r.material} — blat kuchenny wykonany przez Kamieniarstwo 24h"
                     width="${r.miniW}" height="${r.miniH}" loading="lazy" decoding="async" />
              </picture>
              <figcaption><strong>${r.material}</strong> — ${r.opis}</figcaption>
            </figure>`
    )
    .join('\n');

  return `      <section class="miasto-realizacje" aria-labelledby="realizacje-${m.slug}">
        <h2 id="realizacje-${m.slug}">Nasze blaty — zdjęcia z montaży</h2>
        <p>
          Zdjęcia są nasze, z zamontowanych kuchni, nie z katalogu producenta.
          Klienci z ${m.doMiasta} najczęściej pytają, jak dany kamień wygląda
          w całości, a nie na próbce 10 × 10 cm.
        </p>
        <div class="miasto-galeria">
${kafle}
        </div>
        <p><a href="/realizacje">Zobacz wszystkie ${realizacje.length} realizacji →</a></p>
      </section>`;
}

/* ────────────────────────────────────── dzielnice i okoliczne gminy */

/**
 * GDZIE DOKŁADNIE JEŹDZIMY — dzielnice miasta i sąsiednie gminy.
 *
 * Osobnych podstron dla tych nazw świadomie NIE robimy: byłyby to kopie
 * z podmienioną nazwą i Google nie pozycjonowałby żadnej z nich. Nazwy
 * wchodzą w treść TEJ strony (i w `areaServed` — patrz schema-miasta.mjs).
 */
export function blokZasiegu(m) {
  const maDzielnice = (m.dzielnice || []).length;
  const maOkolice = (m.okolice || []).length;
  if (!maDzielnice && !maOkolice) return '';

  const dzielnice = maDzielnice
    ? `        <p>
          <strong>W samym ${m.wMiescie}</strong> montujemy we wszystkich dzielnicach —
          ${wyliczenie(m.dzielnice)} i pozostałych. Wjazd na osiedle, winda albo
          jej brak i piętro to rzeczy, które ustalamy przy pomiarze; przy blacie
          w kilku kawałkach ma to znaczenie dla terminu, nie dla ceny.
        </p>`
    : '';

  const okolice = maOkolice
    ? `        <p>
          <strong>Poza miastem</strong> jeździmy do okolicznych gmin:
          ${wyliczenie(m.okolice)}. Dla nas to ten sam wyjazd, a klientom spoza
          centrum oszczędza szukania wykonawcy na miejscu.
        </p>`
    : '';

  return `      <section class="miasto-zasieg" aria-labelledby="zasieg-${m.slug}">
        <h2 id="zasieg-${m.slug}">Gdzie dojeżdżamy w ${m.wMiescie} i okolicy</h2>
${[dzielnice, okolice].filter(Boolean).join('\n')}
      </section>`;
}

/* ──────────────────────────────────────────────────── sąsiednie miasta */

/*
 * SĄSIEDZI — linki do stron innych miast.
 *
 * Po co w treści, skoro stopka i tak linkuje do wszystkich miast: link
 * w stopce waży dla Google tyle co czterdzieści innych obok, a link w treści
 * z kontekstem („ok. 30 km od Mielca") waży więcej — i realnie pomaga
 * klientowi, który trafił na stronę nie swojego miasta.
 *
 * ⚠ BŁĄD ZNALEZIONY 13.09.2026 (zgłoszenie Dawida o stronie Mielca).
 *
 * Algorytm dobierał „sąsiadów" po PODOBNEJ ODLEGŁOŚCI OD TARNOBRZEGA
 * (`|x.km − m.km|`), a nie po bliskości geograficznej. To daje pierścień,
 * nie sąsiedztwo: Mielec leży 45 km od zakładu, więc dostał Opatów,
 * Staszów, Nisko i Sandomierz — miasta też oddalone o ~45 km od
 * Tarnobrzega, ale w zupełnie innych kierunkach, 60–90 km od samego
 * Mielca. Klient z Mielca, który szuka firmy „bliżej", dostawał linki
 * do miast dalej niż nasz zakład.
 *
 * Dane miast nie mają współrzędnych, więc algorytmu nie da się dziś
 * przestawić na prawdziwą geografię bez dopisania ich do wszystkich
 * piętnastu miast. Stąd dwa jawne, ręczne mechanizmy, które mają
 * pierwszeństwo przed automatem:
 *
 *   • `sasiedzi: [{ slug, km }]` — pełna lista ustalona ręcznie, z
 *     odległościami liczonymi OD TEGO MIASTA („ok. 30 km od Mielca");
 *   • `dodatkowiSasiedzi: ['slug']` — dopięcie linku do automatycznej
 *     czwórki, np. link zwrotny do Mielca ze stron najmocniejszych miast.
 *     Etykieta zostaje w stylu automatu (km od zakładu w Tarnobrzegu),
 *     żeby w jednej liście nie mieszać dwóch punktów odniesienia.
 *
 * Literówka w slugu wywala build, zamiast po cichu zgubić link.
 */
export function blokSasiadow(m, miasta) {
  const wgSluga = new Map(miasta.map((x) => [x.slug, x]));
  const znajdz = (slug) => {
    const x = wgSluga.get(slug);
    if (!x) throw new Error(`blokSasiadow(${m.slug}): nie ma miasta „${slug}"`);
    if (slug === m.slug) throw new Error(`blokSasiadow(${m.slug}): miasto nie może linkować do siebie`);
    return x;
  };
  // „0 km od naszego zakładu w Tarnobrzegu" przy linku do Tarnobrzega brzmi
  // jak błąd — tam po prostu JEST zakład, więc mówimy to wprost.
  const odZakladu = (x) =>
    x.km === 0 ? 'tu jest nasz zakład' : `${x.km} km od naszego zakładu w Tarnobrzegu`;

  let pozycje;
  if (m.sasiedzi?.length) {
    pozycje = m.sasiedzi.map(({ slug, km }) => ({ x: znajdz(slug), opis: `ok. ${km} km od ${m.doMiasta}` }));
  } else {
    const auto = miasta
      .filter((x) => x.slug !== m.slug)
      .map((x) => ({ ...x, roznica: Math.abs(x.km - m.km) }))
      .sort((a, b) => a.roznica - b.roznica)
      .slice(0, 4);
    const dodatkowi = (m.dodatkowiSasiedzi || [])
      .filter((slug) => !auto.some((a) => a.slug === slug))
      .map(znajdz);
    pozycje = [...auto, ...dodatkowi].map((x) => ({ x, opis: odZakladu(x) }));
  }
  if (!pozycje.length) return '';

  const lista = pozycje
    .map(
      ({ x, opis }) => `          <li>
            <a href="/blaty-kuchenne-${x.slug}">Blaty kuchenne ${x.nazwa}</a>
            <span class="drobne">${opis}</span>
          </li>`
    )
    .join('\n');

  return `      <section class="miasto-sasiedzi" aria-labelledby="sasiedzi-${m.slug}">
        <h2 id="sasiedzi-${m.slug}">Blaty kamienne w sąsiednich miastach</h2>
        <ul class="lista-sasiadow">
${lista}
        </ul>
      </section>`;
}

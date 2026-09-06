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

/**
 * LINKI DO SĄSIADÓW — po odległości między miastami, nie alfabetycznie.
 *
 * Stopka linkuje do wszystkich miast naraz, więc z punktu widzenia Google
 * każdy taki link waży tyle samo co czterdzieści innych. Link w treści,
 * z sensownym kontekstem („25 km stąd"), waży więcej — i klientowi, który
 * trafił na złe miasto, realnie pomaga.
 */
export function blokSasiadow(m, miasta) {
  const sasiedzi = miasta
    .filter((x) => x.slug !== m.slug)
    .map((x) => ({ ...x, roznica: Math.abs(x.km - m.km) }))
    .sort((a, b) => a.roznica - b.roznica)
    .slice(0, 4);
  if (!sasiedzi.length) return '';

  const pozycje = sasiedzi
    .map(
      (x) => `          <li>
            <a href="/blaty-kuchenne-${x.slug}">Blaty kuchenne ${x.nazwa}</a>
            <span class="drobne">${x.km} km od naszego zakładu w Tarnobrzegu</span>
          </li>`
    )
    .join('\n');

  return `      <section class="miasto-sasiedzi" aria-labelledby="sasiedzi-${m.slug}">
        <h2 id="sasiedzi-${m.slug}">Blaty kamienne w sąsiednich miastach</h2>
        <ul class="lista-sasiadow">
${pozycje}
        </ul>
      </section>`;
}

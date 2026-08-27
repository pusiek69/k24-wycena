/**
 * ILE PŁYT TRZEBA KUPIĆ — ten sam rozkrój, co na rysunku.
 *
 * Materiał kupujemy w CAŁYCH płytach (część firm dopuszcza połówkę), więc
 * o cenie decyduje nie tyle metraż blatu, co ile płyt trzeba kupić.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * DECYZJA DAWIDA (26.08.2026): „rozkrój płyt dobrze liczy, a kalkulator
 * liczy źle — system liczenia i optymalizacji płyt będzie taki sam jak
 * w rozkroju. Bo teraz mam przypadek, że pokazało 1 i 1/2 płyty, a wyszło
 * w rozkroju z jednej płyty."
 *
 * Do tej pory były DWA różne algorytmy. Wycena układała odcinki w proste
 * poziome pasy (shelf), rysunek korzystał z MaxRects, który sięga po wolne
 * prostokąty po obu stronach każdego położonego elementu. Rysunek pakował
 * ciaśniej i na siatce realnych kuchni mieścił blat na mniejszej liczbie
 * płyt niż wycena w co dziesiątym przypadku — a klient widział obie liczby
 * naraz i płacił za tę wyższą.
 *
 * Teraz jest JEDEN silnik: engine/nesting.js. Ten moduł tylko przygotowuje
 * dla niego dane (dzieli za długie odcinki, przelicza centymetry na
 * milimetry) i tłumaczy wynik z powrotem na język wyceny. Rysunek i kwota
 * nie mają już jak powiedzieć czego innego, bo liczy je to samo.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * RZAZ I OBRZEŻE — W CENTYMETRACH, NIE W PROCENTACH
 * Wcześniej stał tu narzut procentowy (10–15%) nakładany na wysokość
 * upakowanych pasów. To był błąd w dwóch miejscach naraz: podwójnie liczył
 * odpad (przy zakupie całych płyt odpadem JEST ścinka, za którą klient
 * i tak płaci) i wywracał wynik na granicy — 3 pasy × 60 cm = 180 cm
 * mieszczą się w 188 cm, ale 180 × 1,15 = 207 cm już nie.
 *
 * `narzutOdpad` z pliku firmy NIE dotyczy pakowania — służy wyłącznie
 * rozliczeniu metrażowemu (kamień naturalny liczony z płyty wskazanej
 * ręcznie), gdzie faktycznie doliczamy procent na dobór rysunku.
 *
 * Wejście:
 *   odcinki — [{ dl, gl }] w centymetrach (długość × głębokość)
 *   plyta   — { w, h, polowkaDozwolona, rzaz?, obrzeze?, rotacja? }
 */
import { rozrysuj, DOMYSLNY_RZAZ_MM } from './nesting.js';

/**
 * Rzaz piły. Ta sama wartość, co domyślna w rozkroju — i to jest cała
 * rzecz: gdyby wycena liczyła 10 mm, a rysunek 3 mm, to przy blacie równym
 * płycie co do centymetra wychodziłyby różne liczby płyt.
 */
const RZAZ_DOMYSLNY_CM = DOMYSLNY_RZAZ_MM / 10;

/**
 * Obrzeże obcinane z krawędzi płyty — DOMYŚLNIE ZERO.
 *
 * Wymiary w cennikach (Technistone 318,5 × 155, Marazzi 324 × 162 itd.) to
 * formaty użytkowe podane przez producenta, już po obróbce krawędzi.
 * Odejmowanie od nich kolejnych centymetrów zawyżałoby liczbę płyt —
 * blat 300 cm przestawałby się mieścić na płycie 300 cm.
 *
 * Inaczej jest przy kamieniu naturalnym: stan magazynowy podaje wymiar
 * SUROWEJ płyty z nierówną krawędzią, więc tam ustawiamy `plyta.obrzeze`
 * jawnie (patrz app/wycena-naturalny.js).
 */
const OBRZEZE_DOMYSLNE = 0;

const PUSTY = {
  plytyPelne: 0,
  polowka: false,
  m2Blatu: 0,
  m2Kupione: 0,
  mb: 0,
  laczenia: 0,
  uklad: [],
  ostrzezenia: [],
};

export function upakuj(odcinki, plyta, opcje = {}) {
  // `opcje` bywa liczbą (stary sposób wołania z kroki.js) — nie może
  // to wywrócić wyceny, więc bierzemy z niej tylko to, co jest obiektem.
  const o = opcje && typeof opcje === 'object' ? opcje : {};

  const rzazCm = liczba(o.rzaz, plyta?.rzaz, RZAZ_DOMYSLNY_CM);
  const obrzezeCm = liczba(o.obrzeze, plyta?.obrzeze, OBRZEZE_DOMYSLNE);
  // Usłojenie: przy kamieniu z wyraźnym rysunkiem elementu nie wolno obrócić.
  // Domyślnie obrót wolno — tak samo jak w rozkroju.
  const rotacja = (o.rotacja ?? plyta?.rotacja) !== false;

  const czyste = (odcinki || [])
    .map((x) => ({ dl: Math.max(x?.dl || 0, x?.gl || 0), gl: Math.min(x?.dl || 0, x?.gl || 0) }))
    .filter((x) => x.dl > 0 && x.gl > 0);

  if (!czyste.length) return { ...PUSTY };

  const szerMm = Math.round(Math.max(plyta.w, plyta.h) * 10);
  const wysMm = Math.round(Math.min(plyta.w, plyta.h) * 10);
  const marginesMm = Math.round(obrzezeCm * 10);

  const wynik =
    ulozWszystko(czyste, { szerMm, wysMm, marginesMm, rzazMm: rzazCm * 10, rotacja, plyta }) ||
    // Płyta mniejsza niż samo obrzeże — konfiguracja jest bez sensu, ale
    // wycena nie może się przez to wywrócić. Próbujemy bez obrzeża.
    ulozWszystko(czyste, { szerMm, wysMm, marginesMm: 0, rzazMm: 0, rotacja, plyta });

  return wynik || { ...PUSTY };
}

function ulozWszystko(czyste, { szerMm, wysMm, marginesMm, rzazMm, rotacja, plyta }) {
  const uzytecznaDl = szerMm - 2 * marginesMm;
  const uzytecznaGl = wysMm - 2 * marginesMm;
  if (!(uzytecznaDl > 0 && uzytecznaGl > 0)) return null;

  const ostrzezenia = [];
  const czesci = [];
  let m2Blatu = 0;
  let mb = 0;
  let laczenia = 0;

  for (const [nr, odc] of czyste.entries()) {
    m2Blatu += (odc.dl * odc.gl) / 10000;
    mb += odc.dl / 100;

    const dlMm = Math.round(odc.dl * 10);
    const glMm = Math.round(odc.gl * 10);

    if (glMm > uzytecznaGl + 1) {
      // Blat głębszy niż płyta — trzeba go zszywać wzdłuż. Rzadkie
      // (wyspy 100 cm+), ale nie wolno tego przemilczeć w wycenie.
      ostrzezenia.push(
        `Głębokość ${fmtCm(odc.gl)} cm przekracza szerokość płyty (${fmtCm(uzytecznaGl / 10)} cm) — wymaga łączenia.`
      );
    }

    // Odcinek dłuższy niż płyta składamy z kilku kawałków (widoczne łączenie).
    // Przy absurdalnie małej płycie (błąd w konfiguracji) odpuszczamy ten
    // układ, zamiast kroić blat na setki kawałków.
    if (dlMm / uzytecznaDl > 20) return null;

    let zostalo = dlMm;
    let dzielony = false;
    while (zostalo > uzytecznaDl + 1) {
      czesci.push({ dl: uzytecznaDl, gl: glMm, odcinek: nr, ciety: true });
      zostalo -= uzytecznaDl;
      dzielony = true;
      laczenia++;
      ostrzezenia.push(
        `Odcinek dłuższy niż płyta (${fmtCm(uzytecznaDl / 10)} cm użytecznej długości) — blat będzie łączony. ` +
          'Miejsce łączenia ustalamy na pomiarze.'
      );
    }
    if (zostalo > 1) czesci.push({ dl: zostalo, gl: glMm, odcinek: nr, ciety: dzielony });
  }

  if (!czesci.length) return null;

  /*
   * TU LICZY JUŻ SILNIK RYSUNKU. Elementy podajemy w takiej kolejności,
   * w jakiej podał je Dawid — nesting sam próbuje kilku uszeregowań
   * i bierze najtańsze, więc sortowanie po naszej stronie tylko by mu
   * przeszkadzało.
   */
  const rozkroj = rozrysuj(
    czesci.map((c, i) => ({
      nazwa: `k${i}`,
      szer: c.dl,
      gl: c.gl,
      odcinek: c.odcinek,
      ciety: c.ciety,
      // Wymiary SPRZED ułożenia. Nesting wolno obrócić element o 90°,
      // a wtedy `szer` niesie już bok, nie długość kawałka — i opis
      // w mailu mówiłby, że blat ma 60 cm zamiast 300.
      dlOryg: c.dl,
      glOryg: c.gl,
    })),
    { szer: szerMm, wys: wysMm },
    { rzaz: rzazMm, margines: marginesMm, rotacja, polowkaDozwolona: plyta?.polowkaDozwolona === true }
  );

  const s = rozkroj.statystyki;
  let plytyPelne = s.plytPelnych ?? rozkroj.plyty.length;
  const polowka = (s.polowek || 0) > 0;
  let m2Kupione = s.plytM2;

  /*
   * ELEMENT, KTÓRY NIE WSZEDŁ NA ŻADNĄ PŁYTĘ.
   *
   * Zdarza się przy blacie głębszym niż arkusz (wyspa 110 cm na płycie
   * 100 cm) — rysunek go odkłada i mówi o tym wprost. Wycena NIE MOŻE go
   * po prostu pominąć, bo wtedy policzyłaby za mało płyt i Dawid dopłacałby
   * z własnej kieszeni. Doliczamy po pełnej płycie na każdy taki kawałek.
   */
  if (rozkroj.nieumieszczone.length) {
    plytyPelne += rozkroj.nieumieszczone.length;
    m2Kupione += (rozkroj.nieumieszczone.length * szerMm * wysMm) / 1e6;
    ostrzezenia.push(
      `${rozkroj.nieumieszczone.length === 1 ? 'Jeden element nie mieści się' : 'Część elementów nie mieści się'} ` +
        'na płycie w całości — wycena zakłada osobną płytę i łączenie. ' +
        'Ostateczny rozkrój ustalamy na pomiarze.'
    );
  }

  return {
    plytyPelne,
    polowka,
    m2Blatu,
    m2Kupione: zaokr3(m2Kupione),
    mb,
    laczenia,
    uklad: ukladDoMaila(rozkroj.plyty, uzytecznaDl),
    ostrzezenia: [...new Set(ostrzezenia)],
  };
}

/**
 * Rozkład kawałków na płytach — Dawid dostaje go w mailu leadowym, żeby
 * przed pomiarem wiedzieć, co z czego wyjdzie i gdzie wypadnie łączenie.
 *
 * Elementy grupujemy po WSPÓLNYM `y`, czyli po rzędach widocznych na
 * rysunku. Mail wyświetla to jako „pasy" i tak też wygląda arkusz — dzięki
 * temu opis w mailu odpowiada temu, co Dawid ma na obrazku.
 */
function ukladDoMaila(plyty, uzytecznaDl) {
  return plyty.map((p) => {
    const rzedy = new Map();
    for (const e of p.elementy) {
      const y = Math.round(e.y);
      if (!rzedy.has(y)) rzedy.set(y, []);
      rzedy.get(y).push(e);
    }

    const pasy = [...rzedy.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, el]) => {
        el.sort((a, b) => a.x - b.x);
        const koniec = Math.max(...el.map((e) => e.x + e.szer));
        return {
          zajete: zaokr(koniec / 10),
          dostepne: zaokr(uzytecznaDl / 10),
          elementy: el.map((e) => ({
            dl: zaokr((e.dlOryg ?? e.szer) / 10),
            gl: zaokr((e.glOryg ?? e.gl) / 10),
            odcinek: e.odcinek ?? 0,
            ciety: !!e.ciety,
          })),
        };
      });

    const uzyta = p.elementy.reduce((a, e) => Math.max(a, e.y + e.gl), 0);
    return {
      wysokoscUzyta: zaokr(uzyta / 10),
      wysokoscPlyty: zaokr(p.wys / 10),
      polowka: !!p.polowka,
      pasy,
    };
  });
}

const zaokr = (n) => Math.round(n * 10) / 10;
const zaokr3 = (n) => Math.round(n * 1000) / 1000;

export function opisPlyt(pak) {
  if (pak.plytyPelne === 0 && pak.polowka) return '½ płyty';
  if (pak.polowka) return `${pak.plytyPelne} i ½ płyty`;
  if (pak.plytyPelne === 1) return '1 płyta';
  if (pak.plytyPelne < 5) return `${pak.plytyPelne} płyty`;
  return `${pak.plytyPelne} płyt`;
}

/** Pierwsza sensowna liczba z listy — pozwala nadpisywać zapas per firma. */
function liczba(...kandydaci) {
  for (const k of kandydaci) if (Number.isFinite(k) && k >= 0) return k;
  return 0;
}

function fmtCm(n) {
  return String(Math.round(n * 10) / 10).replace('.', ',');
}

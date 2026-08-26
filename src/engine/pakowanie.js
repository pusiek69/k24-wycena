/**
 * Upakowanie odcinków blatu w płyty.
 *
 * Materiał kupujemy w CAŁYCH płytach (część firm dopuszcza połówkę), więc
 * o cenie decyduje nie tyle metraż blatu, co ile płyt trzeba kupić.
 *
 * JAK TNIEMY
 * Odcinki o tej samej głębokości układamy jako RÓWNOLEGŁE PASY w poprzek
 * płyty: pas biegnie wzdłuż długości płyty, a jego wysokość to głębokość
 * blatu. Trzy odcinki po 60 cm głębokości to trzy pasy po 60 cm — na płycie
 * 315 × 188 zajmują 180 cm z 188 dostępnych i mieszczą się w jednej płycie.
 *
 * ZAPAS NA RZAZ I OBRZEŻE — LICZONY W CENTYMETRACH, NIE W PROCENTACH
 * Wcześniej stał tu narzut procentowy (10–15%) nakładany na wysokość
 * upakowanych pasów. To był błąd w dwóch miejscach naraz:
 *
 *   • podwójnie liczył odpad — przy zakupie całych płyt odpadem JEST ścinka,
 *     za którą klient i tak płaci, więc dokładanie procentów do geometrii
 *     naliczało to samo drugi raz,
 *   • wywracało wynik na granicy: 3 pasy × 60 cm = 180 cm ≤ 188 cm mieszczą
 *     się bez problemu, ale 180 × 1,15 = 207 cm już nie — i wychodziły
 *     dwie płyty zamiast jednej (zgłoszone przez Dawida, sierpień 2026).
 *
 * Teraz zapas jest fizyczny: `rzaz` to szerokość cięcia między sąsiednimi
 * kawałkami, `obrzeze` to pas obcinany z surowej krawędzi płyty. Oba w cm,
 * oba do nadpisania w konfiguracji firmy (`plyta.rzaz`, `plyta.obrzeze`).
 *
 * `narzutOdpad` z pliku firmy NIE dotyczy już pakowania — służy wyłącznie
 * rozliczeniu metrażowemu (kamień naturalny liczony z płyty wskazanej
 * ręcznie), gdzie faktycznie doliczamy procent na dobór rysunku.
 *
 * Wejście:
 *   odcinki — [{ dl, gl }] w centymetrach (długość × głębokość)
 *   plyta   — { w, h, polowkaDozwolona, rzaz?, obrzeze? }
 */

import { rozrysuj, DOMYSLNY_RZAZ_MM } from './nesting.js';

const RZAZ_DOMYSLNY = 1; // cm — szerokość rzazu piły z zapasem na pasowanie

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

export function upakuj(odcinki, plyta, opcje = {}) {
  const rzaz = liczba(opcje.rzaz, plyta?.rzaz, RZAZ_DOMYSLNY);
  const obrzeze = liczba(opcje.obrzeze, plyta?.obrzeze, OBRZEZE_DOMYSLNE);

  const czyste = (odcinki || [])
    .map((o) => ({ dl: Math.max(o?.dl || 0, o?.gl || 0), gl: Math.min(o?.dl || 0, o?.gl || 0) }))
    .filter((o) => o.dl > 0 && o.gl > 0);

  if (!czyste.length) {
    return { plytyPelne: 0, polowka: false, m2Blatu: 0, m2Kupione: 0, mb: 0, ostrzezenia: [] };
  }

  // Płytę można ciąć w dwie strony — pasy wzdłuż dłuższego albo krótszego
  // boku. Sprawdzamy oba układy i bierzemy ten, który zużywa mniej materiału.
  const ukladA = ulozNaPlycie(czyste, plyta.w, plyta.h, { rzaz, obrzeze, plyta });
  const ukladB = ulozNaPlycie(czyste, plyta.h, plyta.w, { rzaz, obrzeze, plyta });
  const wybrany = lepszy(ukladA, ukladB);
  if (wybrany) return wybrany;

  // Płyta mniejsza niż samo obrzeże — konfiguracja jest bez sensu, ale
  // wycena nie może się przez to wywrócić. Próbujemy bez obrzeża.
  const awaryjny = lepszy(
    ulozNaPlycie(czyste, plyta.w, plyta.h, { rzaz: 0, obrzeze: 0, plyta }),
    ulozNaPlycie(czyste, plyta.h, plyta.w, { rzaz: 0, obrzeze: 0, plyta })
  );
  return awaryjny || { plytyPelne: 0, polowka: false, m2Blatu: 0, m2Kupione: 0, mb: 0, ostrzezenia: [] };
}

/**
 * Który układ lepszy.
 *
 * NAJPIERW mniej łączeń, dopiero potem mniej materiału. Obrót płyty potrafi
 * zmieścić blat w jednej płycie zamiast dwóch, ale za cenę przecięcia
 * odcinka na pół — a widoczne łączenie w blacie to wada, nie oszczędność.
 * Dawid woli dołożyć płytę niż tłumaczyć klientowi spoinę na środku wyspy.
 */
function lepszy(a, b) {
  if (!b) return a;
  if (!a) return b;
  if (a.laczenia !== b.laczenia) return a.laczenia < b.laczenia ? a : b;
  if (b.m2Kupione < a.m2Kupione - 0.001) return b;
  if (a.m2Kupione < b.m2Kupione - 0.001) return a;
  return b.ostrzezenia.length < a.ostrzezenia.length ? b : a;
}

/**
 * Jeden układ: pasy biegną wzdłuż boku PW, a piętrzą się wzdłuż boku PH.
 *
 * @param PW długość płyty w tym układzie (wzdłuż niej biegną pasy)
 * @param PH szerokość płyty w tym układzie (w tę stronę piętrzymy pasy)
 */
function ulozNaPlycie(odcinki, PW, PH, { rzaz, obrzeze, plyta }) {
  // Z surowej płyty realnie wykorzystujemy pole pomniejszone o obrzeże.
  const UW = PW - 2 * obrzeze;
  const UH = PH - 2 * obrzeze;
  if (!(UW > 0 && UH > 0)) return null;

  const ostrzezenia = [];
  const czesci = [];
  let m2Blatu = 0;
  let mb = 0;
  let laczenia = 0; // ile razy trzeba przeciąć odcinek, bo nie mieści się w płycie

  for (const [nrOdcinka, o] of odcinki.entries()) {
    m2Blatu += (o.dl * o.gl) / 10000;
    mb += o.dl / 100;

    if (o.gl > UH + 0.1) {
      // Blat głębszy niż płyta — trzeba go zszywać wzdłuż. Rzadkie
      // (wyspy 100 cm+), ale nie wolno tego przemilczeć w wycenie.
      ostrzezenia.push(
        `Głębokość ${fmtCm(o.gl)} cm przekracza szerokość płyty (${fmtCm(PH)} cm) — wymaga łączenia.`
      );
    }

    // Odcinek dłuższy niż płyta składamy z kilku kawałków (widoczne łączenie).
    // Przy absurdalnie małej płycie (błąd w konfiguracji) odpuszczamy ten
    // układ, zamiast kroić blat na setki kawałków.
    if (o.dl / UW > 20) return null;

    let pozostalo = o.dl;
    let dzielony = false;
    while (pozostalo > UW + 0.1) {
      czesci.push({ dl: UW, gl: o.gl, odcinek: nrOdcinka, ciety: true });
      pozostalo -= UW;
      dzielony = true;
      laczenia++;
      ostrzezenia.push(
        `Odcinek dłuższy niż płyta (${fmtCm(UW)} cm użytecznej długości) — blat będzie łączony. ` +
          'Miejsce łączenia ustalamy na pomiarze.'
      );
    }
    if (pozostalo > 0.1) czesci.push({ dl: pozostalo, gl: o.gl, odcinek: nrOdcinka, ciety: dzielony });
  }

  if (!czesci.length) return null;

  // Shelf packing (First Fit Decreasing Height): najgłębsze kawałki najpierw,
  // bo to głębokość wyznacza wysokość pasa.
  czesci.sort((a, b) => b.gl - a.gl || b.dl - a.dl);

  const pasy = [];
  for (const cz of czesci) {
    let wlozony = false;
    for (const pas of pasy) {
      // Kawałek musi zmieścić się na długość (z rzazem) i nie być głębszy
      // niż pas, który już ma ustaloną wysokość.
      if (pas.zajete + rzaz + cz.dl <= UW + 0.1 && cz.gl <= pas.wysokosc + 0.1) {
        pas.zajete += rzaz + cz.dl;
        pas.el.push(cz);
        wlozony = true;
        break;
      }
    }
    if (!wlozony) pasy.push({ zajete: cz.dl, wysokosc: cz.gl, el: [cz] });
  }

  // Pasy pakujemy w płyty. Pas NIE MOŻE przechodzić z płyty na płytę —
  // dlatego liczymy je płyta po płycie, a nie dzieląc łączną wysokość.
  const plyty = [];
  for (const pas of pasy) {
    let wlozony = false;
    for (const p of plyty) {
      if (p.wysokosc + rzaz + pas.wysokosc <= UH + 0.1) {
        p.wysokosc += rzaz + pas.wysokosc;
        p.pasy.push(pas);
        wlozony = true;
        break;
      }
    }
    if (!wlozony) plyty.push({ wysokosc: pas.wysokosc, pasy: [pas] });
  }

  let plytyPelne = plyty.length;
  let polowka = false;

  if (plyta?.polowkaDozwolona && plytyPelne > 0) {
    const ostatnia = plyty[plyty.length - 1];
    if (zejdzieNaPolowce(ostatnia, plyta)) {
      plytyPelne -= 1;
      polowka = true;
    }
  }

  const m2Plyty = (plyta.w * plyta.h) / 10000;
  const m2Kupione = plytyPelne * m2Plyty + (polowka ? m2Plyty / 2 : 0);

  return {
    plytyPelne,
    polowka,
    m2Blatu,
    m2Kupione,
    mb,
    laczenia,
    // Rozkład kawałków na płytach — Dawid potrzebuje go w mailu leadowym,
    // żeby przed pomiarem wiedzieć, co z czego wyjdzie i gdzie wypadnie
    // łączenie. Postać jest celowo płaska: leci przez JSON do Workera.
    uklad: plyty.map((p) => ({
      wysokoscUzyta: zaokr(p.wysokosc),
      wysokoscPlyty: zaokr(UH),
      pasy: p.pasy.map((pas) => ({
        zajete: zaokr(pas.zajete),
        dostepne: zaokr(UW),
        elementy: pas.el.map((e) => ({
          dl: zaokr(e.dl),
          gl: zaokr(e.gl),
          odcinek: e.odcinek,
          ciety: !!e.ciety,
        })),
      })),
    })),
    ostrzezenia: [...new Set(ostrzezenia)],
  };
}

/**
 * CZY OSTATNIA PŁYTA NAPRAWDĘ ZEJDZIE NA POŁÓWCE.
 *
 * Zgłoszenie Dawida (26.08.2026). Do tej pory wystarczyło, że zsumowana
 * wysokość pasów na ostatniej płycie nie przekraczała połowy — i to
 * potrafiło ZANIŻYĆ materiał, czyli policzyć klientowi pół płyty mniej,
 * niż trzeba kupić. Dwie drogi do tego prowadziły:
 *
 *   • Pakowanie sprawdza OBA ustawienia płyty (pasy wzdłuż dłuższego albo
 *     krótszego boku) i „połowa" liczyła się w tym ustawieniu, które akurat
 *     wygrało. Przy pasach w poprzek „połowa" wypadała na 160 cm z boku
 *     320 cm — a połówka to zawsze 320 × 80. Element o głębokości 99 cm
 *     przechodził jako mieszczący się na arkuszu głębokim na 80 cm.
 *
 *   • Sama suma wysokości pasów nic nie mówi o tym, czy kawałki ułożą się
 *     na węższym arkuszu — pas może być za długi, a nie za wysoki.
 *
 * Dlatego zamiast mierzyć wysokość, ROBIMY PRZYMIARKĘ: bierzemy kawałki
 * z ostatniej płyty i próbujemy ułożyć je na arkuszu w × h/2 tym samym
 * modułem, co rozrys. Wejdą wszystkie — jest połówka. Nie wejdą — pełna
 * płyta. Jeden algorytm w obu torach znaczy, że rysunek i kwota nie mają
 * jak powiedzieć czego innego.
 *
 * Rzaz bierzemy z rozrysu (3 mm), a nie centymetrowy z pakowania: to
 * przymiarka do FIZYCZNEGO arkusza, więc musi zadać dokładnie to samo
 * pytanie, co rysunek, który Dawid ogląda obok kwoty.
 *
 * Obrót jest dozwolony, bo połówki dopuszczają wyłącznie konglomeraty
 * (Avant, Caesarstone, Keralini) i Interstone. Kamień naturalny, gdzie
 * usłojenie blokuje obrót, ma `polowkaDozwolona: false` i tu nie trafia.
 */
function zejdzieNaPolowce(ostatnia, plyta) {
  const arkusz = {
    szer: Math.round(plyta.w * 10),
    wys: Math.round((plyta.h * 10) / 2),
  };
  if (!(arkusz.szer > 0 && arkusz.wys > 0)) return false;

  const kawalki = ostatnia.pasy.flatMap((pas, i) =>
    pas.el.map((e, j) => ({
      nazwa: `k${i}-${j}`,
      szer: Math.round(e.dl * 10),
      gl: Math.round(e.gl * 10),
    }))
  );
  if (!kawalki.length) return false;

  const proba = rozrysuj(kawalki, arkusz, {
    rzaz: DOMYSLNY_RZAZ_MM,
    margines: 0,
    rotacja: true,
    maksPlyt: 1,
  });
  return proba.nieumieszczone.length === 0 && proba.plyty.length === 1;
}

function zaokr(n) {
  return Math.round(n * 10) / 10;
}

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

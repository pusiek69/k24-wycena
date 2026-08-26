/**
 * ROZRYS PŁYT — układanie elementów blatu na płytach kamienia.
 *
 * Wszystko w MILIMETRACH: płyty dostawców podawane są w mm (3250 × 1590),
 * a przy kamieniu grubość rzazu piły to kwestia 3–5 mm, więc centymetry
 * gubiłyby dokładnie to, co tu decyduje.
 *
 * ALGORYTM: MaxRects w wariancie Best Short Side Fit.
 *
 * Wybrany świadomie zamiast prostszego „shelf": blaty kuchenne to kilka
 * elementów o bardzo różnych proporcjach (3120 × 800 obok 950 × 800
 * i fartucha 2300 × 550). Shelf układa je w poziome pasy i przy takim
 * zestawie potrafi zmarnować pół płyty; MaxRects korzysta z wolnych
 * prostokątów po obu stronach każdego położonego elementu i na typowej
 * kuchni wychodzi o kilkanaście punktów procentowych lepiej.
 *
 * RZAZ PIŁY (kerf) — WYŁĄCZNIE MIĘDZY ELEMENTAMI (decyzja Dawida,
 * 25.08.2026: „ja już podaję wymiary do wycięcia bez marginesów").
 *
 * Wymiary, które podaje Dawid, są OSTATECZNE — nic ich nie powiększa.
 * Rzaz wchodzi dopiero przy dzieleniu wolnego miejsca: po położeniu
 * elementu kolejny zaczyna się o grubość cięcia dalej, bo tyle materiału
 * zabiera piła między nimi. Przy KRAWĘDZI PŁYTY rzazu nie ma — nie ma tam
 * sąsiada, od którego trzeba by się odsunąć — więc element może dojść
 * do samego brzegu. Wcześniej doliczaliśmy rzaz z każdej strony i element
 * równy szerokości płyty „nie mieścił się" o 3 mm.
 *
 * MARGINES PŁYTY — DOMYŚLNIE 0 (ta sama decyzja Dawida).
 * Parametr zostaje w Stawkach, bo przy surowej, nierównej krawędzi kamienia
 * naturalnego bywa potrzebny — ale domyślnie elementy mogą dochodzić
 * do krawędzi płyty.
 *
 * USŁOJENIE. Przy kamieniu z wyraźnym rysunkiem (Patagonia, marmury
 * book-match) elementu NIE WOLNO obrócić o 90°, bo rysunek pobiegnie
 * w poprzek blatu. Stąd `rotacja: false` — wtedy każdy element ląduje
 * dokładnie w orientacji, w jakiej go podano.
 */

/** Domyślne parametry cięcia — nadpisywane stawkami z panelu. */
export const DOMYSLNY_RZAZ_MM = 3;
export const DOMYSLNY_MARGINES_MM = 0;

/**
 * @param {Array} elementy  [{ nazwa, szer, gl, ilosc }] w mm
 * @param {object} plyta    { szer, wys } w mm
 * @param {object} opcje    { rzaz, margines, rotacja, polowkaDozwolona }
 * @returns {{plyty: Array, nieumieszczone: Array, statystyki: object}}
 */
export function rozrysuj(elementy, plyta, opcje = {}) {
  const rzaz = liczbaNieujemna(opcje.rzaz, DOMYSLNY_RZAZ_MM);
  const margines = liczbaNieujemna(opcje.margines, DOMYSLNY_MARGINES_MM);
  const rotacja = opcje.rotacja !== false;
  const maksPlyt = Number(opcje.maksPlyt) || 40;

  /*
   * POŁÓWKI PŁYT (zlecenie Dawida, 25.08.2026: „w avant, caesarstone
   * i keralini uwzględnij w rozkroju, że są połówki płyt").
   *
   * U części dostawców można kupić pół płyty — i wycena już to liczy
   * (patrz engine/pakowanie.js). Rozrys tego nie pokazywał i rysował
   * pełny arkusz nawet wtedy, gdy Dawid kupował połowę, przez co
   * „Powierzchnia płyt" i odpad na rysunku kłóciły się z wyceną.
   *
   * OŚ CIĘCIA — POTWIERDZONA PRZEZ DAWIDA (25.08.2026): połówka to arkusz
   * przecięty w POPRZEK, czyli z 320 × 160 cm robi się 320 × 80 cm.
   * DŁUGOŚĆ ZOSTAJE, na pół idzie wysokość.
   *
   * To rozstrzygnięcie ma znaczenie pieniężne, więc zapisujemy je wprost:
   * przy cięciu wzdłuż (160 × 160) blat dłuższy niż 160 cm NIE zmieściłby
   * się na połówce i trzeba by kupić całą płytę — typowa prosta kuchnia
   * drożeje wtedy o ok. 1 600 zł. Ta sama zasada obowiązuje w wycenie
   * (engine/pakowanie.js) i tu — jedna i druga muszą mówić to samo.
   */
  const polowkaDozwolona = opcje.polowkaDozwolona === true;

  const polePlyty = { szer: Number(plyta?.szer) || 0, wys: Number(plyta?.wys) || 0 };
  const uzyteczna = {
    szer: polePlyty.szer - 2 * margines,
    wys: polePlyty.wys - 2 * margines,
  };

  const doUlozenia = rozwin(elementy);
  const nieumieszczone = [];

  if (!(uzyteczna.szer > 0 && uzyteczna.wys > 0)) {
    return pusty(polePlyty, doUlozenia, 'Płyta jest mniejsza niż podwójny margines.');
  }

  // Element większy od użytecznej części płyty nie zmieści się NIGDY —
  // odkładamy go z powodem, zamiast mielić go przez kolejne płyty.
  const mieszczace = [];
  for (const el of doUlozenia) {
    if (zmiesciSie(el, uzyteczna, rzaz, rotacja)) mieszczace.push(el);
    else nieumieszczone.push({ ...el, powod: 'wiekszy-od-plyty' });
  }

  // Najpierw duże elementy: mniejsze łatwiej domknąć w resztkach.
  mieszczace.sort((a, b) => b.szer * b.gl - a.szer * a.gl || Math.max(b.szer, b.gl) - Math.max(a.szer, a.gl));

  const plyty = [];
  let zostalo = mieszczace;

  while (zostalo.length && plyty.length < maksPlyt) {
    const { ulozone, reszta } = ulozNaPlycie(zostalo, uzyteczna, { rzaz, rotacja, margines });
    // Zabezpieczenie przed pętlą bez końca: skoro nic nie weszło na pustą
    // płytę, to nie wejdzie już nigdy.
    if (!ulozone.length) {
      for (const el of reszta) nieumieszczone.push({ ...el, powod: 'nie-zmiescil-sie' });
      break;
    }
    plyty.push({
      nr: plyty.length + 1,
      szer: polePlyty.szer,
      wys: polePlyty.wys,
      margines,
      elementy: ulozone,
      poleElementowMm2: ulozone.reduce((a, e) => a + e.szer * e.gl, 0),
    });
    zostalo = reszta;
  }

  if (polowkaDozwolona && plyty.length) {
    domknijNaPolowce(plyty, uzyteczna, polePlyty, { rzaz, rotacja, margines });
  }

  if (zostalo.length && plyty.length >= maksPlyt) {
    for (const el of zostalo) nieumieszczone.push({ ...el, powod: 'limit-plyt' });
  }

  return { plyty, nieumieszczone, statystyki: statystyki(plyty, polePlyty, nieumieszczone) };
}

/**
 * OSTATNIA PŁYTA NA POŁÓWCE.
 *
 * Zgłoszenie Dawida (26.08.2026): „wycena wychodzi z 1,5 płyty, a na
 * rozrysie pokazuje 2 płyty". Rysunek i kwota mówiły co innego, a klient
 * widzi obie liczby naraz.
 *
 * Skąd się to brało: MaxRects układa elementy tak, żeby zostawić jak
 * najrówniejsze resztki, i NIC nie wiedział o tym, że wysokość ostatniego
 * arkusza kosztuje. Dwa realne przypadki z 3200 × 1600:
 *
 *   • 2400 × 800 + 900 × 800 — algorytm kładł drugi element OBRÓCONY
 *     (800 × 900), bo tak lepiej pasował do wolnego prostokąta. Zajęta
 *     wysokość rosła z 800 do 900 mm i połówka przepadała, choć element
 *     bez obrotu mieścił się w niej co do milimetra.
 *
 *   • 2000 × 600 + 600 × 600 — oba elementy szły na jedną płytę, ale jeden
 *     POD drugim (wysokość 1203 mm) zamiast OBOK (600 mm). Pole to samo,
 *     rachunek inny: pierwsze to cała płyta, drugie połówka.
 *
 * Dlatego zamiast tylko MIERZYĆ zajętą wysokość, próbujemy ostatnią płytę
 * ułożyć jeszcze raz — na arkuszu o połowie wysokości. Jeśli wszystko
 * wejdzie, to jest połówka i tak ją rysujemy. Jeśli nie — zostaje pełna
 * płyta i nic się nie zmienia.
 *
 * Przymiarka NIE MOŻE dołożyć płyty: bierzemy ją tylko wtedy, gdy zmieszczą
 * się WSZYSTKIE elementy z tej płyty.
 */
function domknijNaPolowce(plyty, uzyteczna, polePlyty, opcje) {
  const ostatnia = plyty[plyty.length - 1];
  const polowaWys = polePlyty.wys / 2;

  // Układ, który już jest, mieści się w połowie — nie ma czego przestawiać.
  const uzytaWysokosc = ostatnia.elementy.reduce((a, e) => Math.max(a, e.y + e.gl), 0);
  if (uzytaWysokosc <= polowaWys + 0.001) {
    ostatnia.polowka = true;
    ostatnia.wys = polowaWys;
    return;
  }

  const polUzyteczna = { szer: uzyteczna.szer, wys: polowaWys - 2 * opcje.margines };
  if (!(polUzyteczna.wys > 0)) return;

  // Wracamy do wymiarów sprzed obrotu — inaczej druga próba dziedziczyłaby
  // dokładnie ten obrót, który zepsuł połówkę.
  const surowe = ostatnia.elementy.map((e) => ({
    ...e,
    szer: e.obrocony ? e.gl : e.szer,
    gl: e.obrocony ? e.szer : e.gl,
    x: undefined,
    y: undefined,
    obrocony: undefined,
  }));

  const { ulozone, reszta } = ulozNaPlycie(surowe, polUzyteczna, opcje);
  if (reszta.length) return; // na połówkę się nie da — zostaje pełna płyta

  ostatnia.elementy = ulozone;
  ostatnia.wys = polowaWys;
  ostatnia.polowka = true;
  ostatnia.poleElementowMm2 = ulozone.reduce((a, e) => a + e.szer * e.gl, 0);
}

/* ────────────────────────────────────────────── układanie jednej płyty */

function ulozNaPlycie(elementy, uzyteczna, { rzaz, rotacja, margines }) {
  // Wolne prostokąty w układzie współrzędnych użytecznej części płyty.
  let wolne = [{ x: 0, y: 0, szer: uzyteczna.szer, wys: uzyteczna.wys }];
  const ulozone = [];
  const reszta = [];

  for (const el of elementy) {
    const miejsce = najlepszeMiejsce(el, wolne, rzaz, rotacja);
    if (!miejsce) {
      reszta.push(el);
      continue;
    }

    const { wolny, szer, gl, obrocony } = miejsce;
    ulozone.push({
      ...el,
      x: wolny.x + margines,
      y: wolny.y + margines,
      szer,
      gl,
      obrocony,
    });

    /*
     * Zajmujemy prostokąt elementu POWIĘKSZONY o rzaz — dzięki temu kolejny
     * element zacznie się o grubość cięcia dalej. Ale przycinamy go do
     * wolnego miejsca: gdy element dochodzi do krawędzi, nie ma za czym
     * rezerwować ścinki, bo za krawędzią nie ma już płyty.
     */
    wolne = potnij(wolne, {
      x: wolny.x,
      y: wolny.y,
      szer: Math.min(szer + rzaz, wolny.szer),
      wys: Math.min(gl + rzaz, wolny.wys),
    });
  }

  return { ulozone, reszta };
}

/**
 * Best Short Side Fit: wygrywa miejsce, w którym KRÓTSZY z dwóch zapasów
 * jest najmniejszy. Dzięki temu resztki zostają w jednym kawałku zamiast
 * rozdrabniać się na paski nie do wykorzystania.
 */
function najlepszeMiejsce(el, wolne, rzaz, rotacja) {
  let naj = null;

  for (const wolny of wolne) {
    const warianty = rotacja && el.szer !== el.gl
      ? [
          { szer: el.szer, gl: el.gl, obrocony: false },
          { szer: el.gl, gl: el.szer, obrocony: true },
        ]
      : [{ szer: el.szer, gl: el.gl, obrocony: false }];

    for (const w of warianty) {
      // Element musi się zmieścić w SWOICH wymiarach — rzaz odejmiemy
      // dopiero od tego, co zostanie po nim wolne (patrz niżej).
      const zapasSzer = wolny.szer - w.szer;
      const zapasWys = wolny.wys - w.gl;
      if (zapasSzer < -0.001 || zapasWys < -0.001) continue;

      const krotszy = Math.min(zapasSzer, zapasWys);
      const dluzszy = Math.max(zapasSzer, zapasWys);
      if (!naj || krotszy < naj.krotszy || (krotszy === naj.krotszy && dluzszy < naj.dluzszy)) {
        naj = { wolny, szer: w.szer, gl: w.gl, obrocony: w.obrocony, krotszy, dluzszy };
      }
    }
  }

  return naj;
}

/** Wolne prostokąty po zajęciu miejsca — klasyczne cięcie MaxRects. */
function potnij(wolne, zajety) {
  const wynik = [];

  for (const w of wolne) {
    if (!nachodzi(w, zajety)) {
      wynik.push(w);
      continue;
    }
    // Nad, pod, po lewej i po prawej od zajętego prostokąta.
    if (zajety.y > w.y) wynik.push({ x: w.x, y: w.y, szer: w.szer, wys: zajety.y - w.y });
    const dolZajetego = zajety.y + zajety.wys;
    if (dolZajetego < w.y + w.wys) {
      wynik.push({ x: w.x, y: dolZajetego, szer: w.szer, wys: w.y + w.wys - dolZajetego });
    }
    if (zajety.x > w.x) wynik.push({ x: w.x, y: w.y, szer: zajety.x - w.x, wys: w.wys });
    const prawyZajetego = zajety.x + zajety.szer;
    if (prawyZajetego < w.x + w.szer) {
      wynik.push({ x: prawyZajetego, y: w.y, szer: w.x + w.szer - prawyZajetego, wys: w.wys });
    }
  }

  return odsiejZawarte(wynik.filter((w) => w.szer > 0 && w.wys > 0));
}

/** Prostokąt w całości mieszczący się w innym jest zbędny. */
function odsiejZawarte(lista) {
  return lista.filter(
    (a, i) => !lista.some((b, j) => i !== j && zawiera(b, a) && (!zawiera(a, b) || j < i))
  );
}

const zawiera = (duzy, maly) =>
  maly.x >= duzy.x &&
  maly.y >= duzy.y &&
  maly.x + maly.szer <= duzy.x + duzy.szer &&
  maly.y + maly.wys <= duzy.y + duzy.wys;

const nachodzi = (a, b) =>
  a.x < b.x + b.szer && a.x + a.szer > b.x && a.y < b.y + b.wys && a.y + a.wys > b.y;

/* ──────────────────────────────────────────────────────── drobiazgi */

function zmiesciSie(el, uzyteczna, rzaz, rotacja) {
  // Bez rzazu: pojedynczy element może zająć płytę co do milimetra.
  // Rzaz dotyczy odstępu między sąsiadami, nie krawędzi płyty.
  const pasuje = (szer, gl) => szer <= uzyteczna.szer + 0.001 && gl <= uzyteczna.wys + 0.001;
  return pasuje(el.szer, el.gl) || (rotacja && pasuje(el.gl, el.szer));
}

/** [{nazwa, szer, gl, ilosc: 2}] → dwa osobne elementy z numerami. */
function rozwin(elementy) {
  const wynik = [];
  for (const el of elementy || []) {
    const szer = Number(el.szer) || 0;
    const gl = Number(el.gl) || 0;
    const ile = Math.max(1, Math.round(Number(el.ilosc) || 1));
    if (!(szer > 0 && gl > 0)) continue;
    for (let i = 0; i < ile; i++) {
      wynik.push({
        id: `${el.id || el.nazwa || 'el'}-${i + 1}`,
        nazwa: ile > 1 ? `${el.nazwa || 'Element'} ${i + 1}` : el.nazwa || 'Element',
        szer,
        gl,
      });
    }
  }
  return wynik;
}

function statystyki(plyty, plyta, nieumieszczone) {
  const polePlytyM2 = (plyta.szer * plyta.wys) / 1e6;
  // Metry liczymy z RZECZYWISTYCH wymiarów arkuszy — połówka wchodzi
  // w rachunek jako pół płyty, tak jak w wycenie.
  const plytM2 = plyty.reduce((a, p) => a + (p.szer * p.wys) / 1e6, 0);
  const elementyM2 = plyty.reduce((a, p) => a + p.poleElementowMm2, 0) / 1e6;
  const polowek = plyty.filter((p) => p.polowka).length;
  return {
    plyt: plyty.length,
    // Rozbicie na pełne i połówki — z tego wycena składa „2 i ½ płyty".
    plytPelnych: plyty.length - polowek,
    polowek,
    polePlytyM2: zaokr(polePlytyM2, 3),
    plytM2: zaokr(plytM2, 3),
    elementyM2: zaokr(elementyM2, 3),
    odpadM2: zaokr(Math.max(0, plytM2 - elementyM2), 3),
    wykorzystanieProc: plytM2 > 0 ? zaokr((elementyM2 / plytM2) * 100, 2) : 0,
    nieumieszczonych: nieumieszczone.length,
  };
}

const pusty = (plyta, elementy, powod) => ({
  plyty: [],
  nieumieszczone: elementy.map((el) => ({ ...el, powod })),
  statystyki: statystyki([], plyta, elementy),
});

const zaokr = (n, m) => Math.round(n * 10 ** m) / 10 ** m;
const liczbaNieujemna = (x, domyslna) => {
  const n = Number(x);
  return Number.isFinite(n) && n >= 0 ? n : domyslna;
};

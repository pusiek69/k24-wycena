import { upakuj, opisPlyt } from './pakowanie.js';
import { opcjaDostepna } from './opcje-dekoru.js';

/**
 * SILNIK WYCENY — wspólny dla wszystkich firm.
 *
 * Nie ma tu ŻADNEJ wiedzy o konkretnym dostawcy. Wszystko, czym różnią się
 * firmy (ceny dekorów, wymiar płyty, stawki obróbek, VAT, czy wolno kupić
 * połówkę), siedzi w pliku firmy: src/firms/<slug>.js
 *
 * Dodanie nowej firmy = dodanie jednego pliku w src/firms/. Tego pliku
 * (wycena.js) NIE RUSZAMY.
 *
 * ⚠ W konfiguracji firm trzymamy WYŁĄCZNIE ceny końcowe dla klienta.
 *   Ceny zakupowe i rabaty Dawida są poza aplikacją — patrz pricing/README.md
 */

/**
 * @param {object} firma  konfiguracja z src/firms/<slug>.js
 * @param {object} w      wybór klienta:
 *   { dekor, grubosc, odcinki:[{dl,gl}], opcje:{id: true|'wariant'|liczba}, cenaRecznaM2 }
 * @param {string} [dataISO] data (do promocji); domyślnie dziś
 */
export function wycen(firma, w, dataISO) {
  // Stawka VAT zależy od TEGO, CO SPRZEDAJEMY. Blat z montażem to usługa
  // budowlana w lokalu mieszkalnym (8%), blat wydany z zakładu to dostawa
  // towaru (23%). Patrz firms/_domyslne.js.
  const odbiorWlasny = (w.opcje || {}).dostawa === 'odbior';
  const vat = odbiorWlasny ? (firma.vatTowar ?? 0.23) : (firma.vatMontaz ?? 0.08);

  // Uwaga: to NIE jest stawka, przy której podane są ceny źródłowe. Ceny
  // publiczne dostawców (np. magazyn Interstone) są brutto przy 23% i tak
  // trzeba je rozliczać na netto, niezależnie od stawki naszej sprzedaży.
  const vatZrodla = firma.vatCenZrodlowych ?? 0.23;

  const doBrutto = (netto) => netto * (1 + vat);
  const pozycje = [];
  const ostrzezenia = [];

  // ---------- 1. materiał ----------
  if (!(w.odcinki || []).some((x) => x?.dl > 0 && x?.gl > 0)) {
    return { ok: false, blad: 'Podaj wymiary blatu.' };
  }

  let cenaM2Netto = null;
  let cenaBazowaNetto = null;
  let plytaDekoru = null;
  let dekorNazwa = w.dekor || null;
  let promo = null;

  let materialDoUstalenia = false;

  /*
   * KAMIEŃ NATURALNY TYLKO ZE WSKAZANĄ PŁYTĄ.
   *
   * Każdy blok kamienia naturalnego ma własną cenę, wymiar i dostępność —
   * różnica między blokami tego samego wzoru sięga kilkuset złotych za m².
   * Wycena „z metra", bez wskazania płyty, wychodziła przez to systematycznie
   * poniżej realnej ceny i klient dowiadywał się prawdy dopiero na placu.
   * Dlatego bez kodu płyty (np. STON000334-84224) nie liczymy nic
   * (decyzja Dawida, 17.08.2026).
   */
  if (firma.wymagaKoduPlyty && !w.kodPlyty) {
    return {
      ok: false,
      blad: 'Do wyceny kamienia naturalnego potrzebny jest kod konkretnej płyty z magazynu.',
      brakKoduPlyty: true,
    };
  }

  if (firma.trybCeny === 'reczna') {
    // Kamień naturalny — cena konkretnej płyty, wpisywana ręcznie.
    // Bez ceny też liczymy: pokazujemy samą obróbkę i montaż.
    const podana = Number(w.cenaRecznaM2);
    if (podana > 0) {
      // Cena ze strony dostawcy jest brutto przy 23% — rozliczamy ją tą
      // stawką, a dopiero potem doliczamy VAT właściwy dla naszej sprzedaży.
      cenaM2Netto = firma.cenaRecznaJest === 'brutto' ? podana / (1 + vatZrodla) : podana;
    } else {
      cenaM2Netto = 0;
      materialDoUstalenia = true;
    }
  } else {
    const dekor = firma.dekory?.[w.dekor];
    if (!dekor) {
      /*
       * Dekor mógł istnieć wyłącznie w promocji, która już się skończyła —
       * np. ceny Laminamu z gwiazdką, ważne do 31.12.2026. Nie udajemy wtedy,
       * że wzoru nie znamy: mówimy wprost, że cena wygasła i wyceniamy go
       * indywidualnie. Klient dostaje formularz kontaktowy zamiast ślepego
       * zaułka, a Dawid — sygnał, że ktoś pytał o wycofaną promocję.
       */
      if (byloWWygaslejPromocji(firma, w.dekor, dataISO)) {
        return {
          ok: false,
          blad:
            `Dekor „${w.dekor}" był w cenie promocyjnej, która już się skończyła. ` +
            'Ten wzór wyceniamy indywidualnie — prosimy o kontakt.',
          wycenaIndywidualna: true,
        };
      }
      return { ok: false, blad: `Nie znam dekoru „${w.dekor}".` };
    }

    // Grubości nieblatowe podnosimy, zamiast odmawiać wyceny:
    // spiek 6 mm jest za cienki na blat, więc liczymy 12 mm.
    let gr = String(w.grubosc);
    const pomijane = firma.pomijGrubosci || [];
    if (pomijane.includes(gr) || dekor[gr] == null) {
      const dostepne = Object.keys(dekor)
        .filter((g) => !pomijane.includes(g))
        .sort((a, b) => Number(a) - Number(b));
      if (!dostepne.length) return { ok: false, blad: `Dekor „${w.dekor}" nie jest dostępny na blat.` };
      const podniesiona = dostepne.find((g) => Number(g) >= Number(gr)) || dostepne[0];
      if (pomijane.includes(String(w.grubosc))) {
        ostrzezenia.push(
          `Na blat kuchenny nie stosujemy grubości ${w.grubosc} mm — wycena dla ${podniesiona} mm.`
        );
      }
      gr = podniesiona;
    }
    w = { ...w, grubosc: gr };

    // Wpis cennika to zwykle sama cena, ale bywa obiektem {cena, plyta} —
    // Atlas Plan tnie 12 mm z płyt 162 × 324, a 20 mm z 159 × 324.
    const wpis = dekor[gr];

    /*
     * Wzór dołożony przez kampanię ma zapisaną datę jej końca. Po tej dacie
     * nie honorujemy ceny promocyjnej, a innej dla niego nie mamy — więc
     * zamiast policzyć po nieaktualnej stawce, kierujemy do wyceny
     * indywidualnej. Sprawdzamy to tutaj, a nie na liście dekorów, bo lista
     * powstaje raz przy starcie strony i mogła zostać zbudowana wcześniej.
     */
    const dzisiaj = dataISO || new Date().toISOString().slice(0, 10);
    if (wpis?.promocyjnyDo && dzisiaj > wpis.promocyjnyDo) {
      return {
        ok: false,
        blad:
          `Dekor „${w.dekor}" w grubości ${gr} mm był w cenie promocyjnej, która już się skończyła. ` +
          'Ten wzór wyceniamy indywidualnie — prosimy o kontakt.',
        wycenaIndywidualna: true,
      };
    }

    cenaM2Netto = typeof wpis === 'number' ? wpis : wpis?.cena;
    plytaDekoru = typeof wpis === 'number' ? null : wpis?.plyta || null;

    cenaBazowaNetto = cenaM2Netto;
    // Sprawdzamy WSZYSTKIE kampanie aktywne na dziś — może ich być kilka naraz.
    promo = znajdzPromocje(firma, w.dekor, gr, dataISO);
    if (promo) cenaM2Netto = promo.cena;
  }

  // Format płyty potrafi zależeć od kampanii — Technistone sprzedaje część
  // dekorów promocyjnych w większych płytach 330 × 165 zamiast 318,5 × 155.
  // Dlatego pakujemy dopiero teraz, gdy wiemy, czy promocja obowiązuje.
  // Pierwszeństwo: format z kampanii → format przypisany do pozycji cennika
  // → domyślny format firmy.
  // `narzutOdpad` celowo NIE trafia już do pakowania: przy zakupie całych
  // płyt odpadem jest ścinka, za którą klient i tak płaci, a doliczanie
  // procentów do geometrii zawyżało liczbę płyt (patrz engine/pakowanie.js).
  // Zapas na rzaz i obrzeże liczy pakowanie w centymetrach.
  const plyta = promo?.plyta || plytaDekoru || firma.plyta;
  const pak = upakuj(w.odcinki || [], plyta);
  if (!pak.m2Blatu) return { ok: false, blad: 'Podaj wymiary blatu.' };
  ostrzezenia.push(...pak.ostrzezenia);

  // Konglomeraty/spieki kupujemy w płytach; kamień naturalny rozliczamy metrażem.
  const wgMetrazu = firma.rozliczenieMaterialu === 'metraz';
  const m2Platne = wgMetrazu ? pak.m2Blatu * (1 + (firma.narzutOdpad ?? 0.1)) : pak.m2Kupione;

  // Promocja: pokazujemy klientowi, ile zyskuje względem ceny podstawowej.
  // Do oszczędności doliczamy też zniesioną dopłatę za mat — to realny zysk,
  // a nie tylko niższa cena metra.
  let oszczednosc = promo
    ? Math.max(0, (cenaBazowaNetto - cenaM2Netto) * m2Platne * (1 + vat))
    : 0;

  const materialNetto = cenaM2Netto * m2Platne;
  pozycje.push({
    grupa: 'materiał',
    nazwa: firma.trybCeny === 'reczna'
      ? `${firma.nazwa} — ${dekorNazwa || 'wybrany kamień'}` +
        // Kod płyty na karcie i w mailach: klient ma wiedzieć, którą dokładnie
        // płytę wycenialiśmy, a Dawid — którą zarezerwować.
        (w.kodPlyty ? ` (płyta ${w.kodPlyty})` : '')
      : `${firma.nazwa} — ${dekorNazwa}, grubość ${w.grubosc} mm`,
    detal: materialDoUstalenia
      ? `${round1(m2Platne)} m² materiału — cenę podamy po wybraniu płyty`
      : wgMetrazu
        ? `${round1(m2Platne)} m² materiału (blat: ${round1(pak.m2Blatu)} m² + zapas na docięcie)`
        : `${opisPlyt(pak)} · ${round1(m2Platne)} m² materiału (blat: ${round1(pak.m2Blatu)} m²)`,
    brutto: doBrutto(materialNetto),
    materialDoUstalenia,
  });

  // ---------- 2. robocizna (zawsze) ----------
  // Odbiór własny z zakładu: klient sam odbiera gotowy blat. Odpada wtedy
  // wszystko, co dotyczy dojazdu i montażu — reszta produkcji bez zmian.
  // (`odbiorWlasny` policzone na górze, bo decyduje też o stawce VAT.)
  // Część pozycji dotyczy tylko kuchni (pomiar Prolinerem). Brak wskazanego
  // pomieszczenia traktujemy jak kuchnię — tak samo jak reszta aplikacji.
  const lazienka = String((w.opcje || {}).pomieszczenie || '')
    .toLowerCase()
    .startsWith('lazienk');

  for (const r of firma.robocizna || []) {
    if (r.tylkoZMontazem && odbiorWlasny) continue;
    if (r.tylkoKuchnia && lazienka) continue;

    // `m2blatu` to powierzchnia samych elementów blatu — bez ścinki, którą
    // klient i tak kupuje w cenie płyty. `m2` liczy metraż płatny (z płytą).
    const ilosc =
      r.per === 'mb' ? pak.mb : r.per === 'm2' ? m2Platne : r.per === 'm2blatu' ? pak.m2Blatu : 1;

    // Pozycja może mieć część stałą (dojazd, wniesienie, przygotowanie) —
    // naliczaną RAZ na całą wycenę, niezależnie od liczby elementów.
    const baza = r.baza ? kwotaBrutto(r.baza, firma, vat, vatZrodla) : 0;
    const kwota = baza + kwotaBrutto(r.cena, firma, vat, vatZrodla) * ilosc;
    // Pozycje `wCenie` przepuszczamy mimo zerowej kwoty — to świadczenia,
    // za które nie liczymy osobno, ale klient ma je widzieć na liście.
    if (kwota <= 0 && !r.wCenie) continue;

    const jednostka = r.per === 'mb' ? 'm.b.' : 'm²';
    pozycje.push({
      grupa: 'usługi',
      nazwa: r.label,
      // Klient widzi samą ilość, bez stawki — kartę i jego mail czyta `detal`.
      detal: r.per === 'mb' || r.per === 'm2blatu' ? `${round1(ilosc)} ${jednostka}` : r.detal,
      // Dawid w mailu leadowym widzi, z czego kwota się złożyła.
      // Pozycja bez `per` jest naliczana RAZ na zlecenie (pomiar Prolinerem) —
      // dopisywanie jej „1 m² ×" było mylące w mailu do firmy.
      detalFirmowy: r.wCenie
        ? 'w cenie, bez osobnego naliczenia'
        : (baza
            ? `baza ${fmtStawka(r.baza)} + ${round1(ilosc)} ${jednostka} × ${fmtStawka(r.cena)}`
            : r.per
              ? `${round1(ilosc)} ${jednostka} × ${fmtStawka(r.cena)}`
              : `${fmtStawka(r.cena)} raz na zlecenie`) + notaStawek(firma, vat, vatZrodla),
      brutto: kwota,
      wCenie: !!r.wCenie,
    });
  }

  // ---------- 3. obróbki wybrane przez klienta ----------
  const wybrane = w.opcje || {};
  for (const o of firma.opcje || []) {
    // Dopłaty zależne od wzoru (np. Matt/Suede u Pacifica) pomijamy przy
    // dekorach, które ich nie mają — nawet gdy w żądaniu przyszło `true`.
    if (!opcjaDostepna(o, w.dekor)) continue;
    const v = wybrane[o.id];

    if (o.typ === 'wybor') {
      const wariant = (o.warianty || []).find((x) => x.id === v);
      if (!wariant || !wariant.cena) continue;
      // Niektóre wycięcia bywają w blacie więcej niż raz — w łazience dwie
      // umywalki obok siebie to normalna zabudowa. Liczbę bierzemy z osobnego
      // pola (`o.iloscZ`), żeby rodzaj i sztuki zostały niezależne.
      const sztuk = o.iloscZ ? Math.max(1, Math.round(Number(wybrane[o.iloscZ]) || 1)) : 1;
      pozycje.push({
        grupa: 'usługi',
        nazwa: wariant.label,
        detal: sztuk > 1 ? `${sztuk} szt.` : undefined,
        brutto: kwotaBrutto(wariant.cena, firma, vat, vatZrodla) * mnoznik(o, pak, m2Platne) * sztuk,
      });
    } else if (o.typ === 'liczba') {
      const ile = Number(v) || 0;
      if (ile <= 0) continue;
      pozycje.push({
        grupa: 'usługi',
        nazwa: o.label,
        detal: `${round1(ile)} ${o.jednostka || 'szt.'} × ${fmtStawka(o.cena)}`,
        brutto: kwotaBrutto(o.cena, firma, vat, vatZrodla) * ile,
      });
    } else {
      if (!v) continue;
      // Przy części dekorów promocyjnych mat i struktura są w tej samej cenie
      // co poler. Pokazujemy pozycję (klient ma widzieć, że o niej pamiętamy),
      // ale bez dopłaty.
      if (o.id === 'mat' && promo?.matWCenie) {
        oszczednosc += kwotaBrutto(o.cena, firma, vat, vatZrodla) * m2Platne;
        pozycje.push({
          grupa: 'usługi',
          nazwa: o.label,
          detal: 'w promocji bez dopłaty',
          brutto: 0,
        });
        continue;
      }
      pozycje.push({
        grupa: 'usługi',
        nazwa: o.label,
        detal: o.per === 'm2' ? `${round1(m2Platne)} m² × ${fmtStawka(o.cena)}` : undefined,
        brutto: kwotaBrutto(o.cena, firma, vat, vatZrodla) * mnoznik(o, pak, m2Platne),
      });
    }
  }

  // ---------- 3a. dodatek za obróbkę kamienia naturalnego ----------
  //
  // Kamień naturalny obrabia się dłużej i z większym ryzykiem niż konglomerat:
  // każda płyta ma inny rysunek do dobrania, twardość bywa nierówna, a przy
  // cięciu zdarzają się pęknięcia, których nikt nie przewidzi.
  //
  // Historia stawki (wszystko 2026): 10% wartości płyt → 100 zł/m² →
  // usunięty → 300 zł/m² od 17.08. Podstawą są metry ELEMENTÓW blatu,
  // spójnie z montażem — to świadoma decyzja Dawida, opisana szerzej
  // przy `obrobkaNaturalnaZaM2` w firms/interstone.js.
  //
  // Stawka jest zapisana brutto przy 23%, jak reszta, więc idzie przez
  // `kwotaBrutto` i schodzi do właściwej stawki wariantu.
  //
  // Kwota trafia do grupy „usługi", więc na karcie klienta wchodzi w jedną
  // sumę „produkcja i montaż" i nie pojawia się jako osobna cena. Rozbicie
  // ze stawką widzi tylko Dawid w mailu firmowym (stąd `detalFirmowy`).
  const stawkaObrobki = firma.obrobkaNaturalnaZaM2 ?? 0;
  if (stawkaObrobki > 0 && pak.m2Blatu > 0) {
    pozycje.push({
      grupa: 'usługi',
      nazwa: 'Obróbka kamienia naturalnego',
      detal: `${round1(pak.m2Blatu)} m²`,
      detalFirmowy:
        `${round1(pak.m2Blatu)} m² × ${fmtStawka(stawkaObrobki)}` +
        notaStawek(firma, vat, vatZrodla),
      brutto: kwotaBrutto(stawkaObrobki, firma, vat, vatZrodla) * pak.m2Blatu,
    });
  }

  // ---------- 4. sumy ----------
  const materialBrutto = pozycje.filter((p) => p.grupa === 'materiał').reduce((a, p) => a + p.brutto, 0);
  const uslugiBrutto = pozycje.filter((p) => p.grupa === 'usługi').reduce((a, p) => a + p.brutto, 0);
  let razem = materialBrutto + uslugiBrutto;

  if (firma.minimumZlecenia && razem < firma.minimumZlecenia) {
    ostrzezenia.push(`Minimum zlecenia w naszym zakładzie to ${fmtPLN(firma.minimumZlecenia)} brutto.`);
    razem = firma.minimumZlecenia;
  }

  return {
    ok: true,
    firma,
    dekor: dekorNazwa,
    grubosc: w.grubosc,
    // Wejście zapamiętujemy w całości — dzięki temu da się policzyć
    // alternatywę na dokładnie tych samych warunkach.
    odcinki: w.odcinki || [],
    opcje: wybrane,
    pak,
    /*
     * Format płyty, z którego NAPRAWDĘ liczyliśmy rozkrój.
     *
     * ⚠ Nie zawsze jest to `firma.plyta`: pierwszeństwo ma format kampanii,
     * potem format przypisany do pozycji cennika (Atlas Plan tnie 20 mm
     * z płyt 324×159, a 12 mm z 324×162; wyprzedaż ma własny format
     * na każdą płytę). Karta wyceny musi pokazywać TEN format, nie domyślny
     * firmowy — inaczej mówi klientowi nieprawdę o tym, co kupuje.
     * Znalezione 30.08.2026 przy przeglądzie produkcji.
     */
    plyta,
    m2Platne,
    wgMetrazu,
    pozycje,
    materialBrutto,
    uslugiBrutto,
    materialDoUstalenia,
    // Zmienia nazwę drugiej kwoty na karcie i dokłada zastrzeżenie
    // o odpowiedzialności za wymiary — patrz firms/_domyslne.js.
    odbiorWlasny,
    // Kod wskazanej płyty — trafia na kartę, do maila klienta i w temat
    // zgłoszenia do firmy, żeby dało się ją zarezerwować bez dopytywania.
    kodPlyty: w.kodPlyty || null,
    razem,
    // Rozbicie podatkowe dla maila firmowego. Wszystkie pozycje są brutto
    // przy tej samej stawce, więc netto liczy się jednym dzieleniem.
    stawkaVat: vat,
    razemNetto: razem / (1 + vat),
    kwotaVat: razem - razem / (1 + vat),
    razemZaokr: Math.round(razem / 50) * 50,
    // Klientowi podajemy WIDEŁKI, nie jedną kwotę — to wycena bez pomiaru.
    widelki: {
      od: do50(razem * 0.9),
      do: do50(razem * 1.1),
    },
    promo,
    oszczednosc,
    ostrzezenia: [...new Set(ostrzezenia)],
  };
}

/**
 * Stawka z pliku firmy → kwota brutto przy stawce VAT tej wyceny.
 *
 * `cenyUslug: 'netto'` — liczba jest netto, doliczamy VAT sprzedaży.
 * `cenyUslug: 'brutto'` — liczba jest kwotą BRUTTO PRZY 23% (tak zapisane są
 * wszystkie stawki Dawida). Sprowadzamy ją do netto i grossujemy stawką
 * właściwą dla wariantu. Netto zostaje bez zmian, więc blat z montażem
 * tanieje brutto o różnicę stawek, zamiast po cichu podnosić nam marżę.
 */
/**
 * Dopisek do rozbicia firmowego, gdy stawka sprzedaży różni się od tej,
 * przy której zapisane są stawki w konfiguracji. Bez niego Dawid widziałby
 * „200 zł/m²" obok kwoty policzonej po 8% i musiałby zgadywać, skąd różnica.
 */
function notaStawek(firma, vat, vatZrodla) {
  if ((firma.cenyUslug || 'brutto') !== 'brutto') return '';
  if (Math.abs(vat - vatZrodla) < 0.0001) return '';
  return ` — stawki brutto ${Math.round(vatZrodla * 100)}%, wycena po ${Math.round(vat * 100)}%`;
}

function kwotaBrutto(cena, firma, vat, vatZrodla = 0.23) {
  if ((firma.cenyUslug || 'brutto') === 'netto') return cena * (1 + vat);
  return (cena / (1 + vatZrodla)) * (1 + vat);
}

function mnoznik(o, pak, m2Platne) {
  if (o.per === 'mb') return pak.mb;
  if (o.per === 'm2') return m2Platne;
  return 1;
}

/** Promocje dostawcy — aktywne w oknie dat, nadpisują cenę bazową m²/netto. */
/**
 * Wpis kampanii to albo sama cena (tak było od początku), albo obiekt:
 *   { cena, plyta: {w,h,polowkaDozwolona}, matWCenie: true }
 * Dzięki temu kampania może zmienić format płyty albo znieść dopłatę
 * za mat, nie zmieniając niczego w konfiguracji firmy.
 */
/**
 * Czy dekor występował w kampanii, która JUŻ SIĘ SKOŃCZYŁA?
 *
 * Wzory obecne wyłącznie w promocji znikają z listy po jej wygaśnięciu
 * (patrz firms/_promocje.js). Gdy klient mimo to o taki zapyta — bo pamięta
 * go z jesieni albo ma stary link — chcemy odpowiedzieć konkretnie,
 * a nie „nie znam takiego dekoru".
 */
function byloWWygaslejPromocji(firma, dekor, dataISO) {
  const d = dataISO || new Date().toISOString().slice(0, 10);
  return (firma.promocje || []).some(
    (p) => d > p.do && Object.keys(p.ceny || {}).some((k) => k.slice(0, k.lastIndexOf('||')) === dekor)
  );
}

function znajdzPromocje(firma, dekor, grubosc, dataISO) {
  const d = dataISO || new Date().toISOString().slice(0, 10);
  for (const p of firma.promocje || []) {
    if (d < p.od || d > p.do) continue;
    const wpis = p.ceny?.[`${dekor}||${grubosc}`];
    if (typeof wpis === 'number') return { cena: wpis, nazwa: p.nazwa, do: p.do };
    if (wpis && typeof wpis.cena === 'number') {
      return { ...wpis, nazwa: p.nazwa, do: p.do };
    }
  }
  return null;
}

export function fmtPLN(n) {
  return Math.round(n).toLocaleString('pl-PL') + ' zł';
}

function fmtStawka(n) {
  return Math.round(n).toLocaleString('pl-PL') + ' zł';
}

function round1(n) {
  return (Math.round(n * 10) / 10).toLocaleString('pl-PL');
}

/** Zaokrąglenie do pełnych 50 zł — tak podajemy widełki. */
function do50(n) {
  return Math.round(n / 50) * 50;
}

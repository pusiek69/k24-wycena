import { upakuj, opisPlyt } from './pakowanie.js';

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
  const vat = firma.vat ?? 0.23;
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

  if (firma.trybCeny === 'reczna') {
    // Kamień naturalny — cena konkretnej płyty, wpisywana ręcznie.
    // Bez ceny też liczymy: pokazujemy samą obróbkę i montaż.
    const podana = Number(w.cenaRecznaM2);
    if (podana > 0) {
      cenaM2Netto = firma.cenaRecznaJest === 'brutto' ? podana / (1 + vat) : podana;
    } else {
      cenaM2Netto = 0;
      materialDoUstalenia = true;
    }
  } else {
    const dekor = firma.dekory?.[w.dekor];
    if (!dekor) return { ok: false, blad: `Nie znam dekoru „${w.dekor}".` };

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
      ? `${firma.nazwa} — ${dekorNazwa || 'wybrany kamień'}`
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
  const odbiorWlasny = (w.opcje || {}).dostawa === 'odbior';

  for (const r of firma.robocizna || []) {
    if (r.tylkoZMontazem && odbiorWlasny) continue;

    // `m2blatu` to powierzchnia samych elementów blatu — bez ścinki, którą
    // klient i tak kupuje w cenie płyty. `m2` liczy metraż płatny (z płytą).
    const ilosc =
      r.per === 'mb' ? pak.mb : r.per === 'm2' ? m2Platne : r.per === 'm2blatu' ? pak.m2Blatu : 1;

    // Pozycja może mieć część stałą (dojazd, wniesienie, przygotowanie) —
    // naliczaną RAZ na całą wycenę, niezależnie od liczby elementów.
    const baza = r.baza ? kwotaBrutto(r.baza, firma, vat) : 0;
    const kwota = baza + kwotaBrutto(r.cena, firma, vat) * ilosc;
    if (kwota <= 0) continue;

    const jednostka = r.per === 'mb' ? 'm.b.' : 'm²';
    pozycje.push({
      grupa: 'usługi',
      nazwa: r.label,
      // Klient widzi samą ilość, bez stawki — kartę i jego mail czyta `detal`.
      detal: r.per === 'mb' || r.per === 'm2blatu' ? `${round1(ilosc)} ${jednostka}` : r.detal,
      // Dawid w mailu leadowym widzi, z czego kwota się złożyła.
      detalFirmowy: baza
        ? `baza ${fmtStawka(r.baza)} + ${round1(ilosc)} ${jednostka} × ${fmtStawka(r.cena)}`
        : `${round1(ilosc)} ${jednostka} × ${fmtStawka(r.cena)}`,
      brutto: kwota,
    });
  }

  // ---------- 3. obróbki wybrane przez klienta ----------
  const wybrane = w.opcje || {};
  for (const o of firma.opcje || []) {
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
        brutto: kwotaBrutto(wariant.cena, firma, vat) * mnoznik(o, pak, m2Platne) * sztuk,
      });
    } else if (o.typ === 'liczba') {
      const ile = Number(v) || 0;
      if (ile <= 0) continue;
      pozycje.push({
        grupa: 'usługi',
        nazwa: o.label,
        detal: `${round1(ile)} ${o.jednostka || 'szt.'} × ${fmtStawka(o.cena)}`,
        brutto: kwotaBrutto(o.cena, firma, vat) * ile,
      });
    } else {
      if (!v) continue;
      // Przy części dekorów promocyjnych mat i struktura są w tej samej cenie
      // co poler. Pokazujemy pozycję (klient ma widzieć, że o niej pamiętamy),
      // ale bez dopłaty.
      if (o.id === 'mat' && promo?.matWCenie) {
        oszczednosc += kwotaBrutto(o.cena, firma, vat) * m2Platne;
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
        brutto: kwotaBrutto(o.cena, firma, vat) * mnoznik(o, pak, m2Platne),
      });
    }
  }

  // ---------- 3a. dodatek za obróbkę kamienia naturalnego ----------
  //
  // Kamień naturalny obrabia się dłużej i z większym ryzykiem niż konglomerat:
  // każda płyta ma inny rysunek do dobrania, twardość bywa nierówna, a przy
  // cięciu zdarzają się pęknięcia, których nikt nie przewidzi. Przy dużym
  // blacie ta praca rozkłada się na duży metraż i ginie w cenie materiału,
  // ale przy małym zleceniu — blat łazienkowy, parapet — robocizna liczona
  // od metra bieżącego nie pokrywa nawet przygotowania płyty.
  //
  // Dlatego doliczamy stawkę od metra kwadratowego blatu — tak samo jak montaż,
  // bo to również robocizna, a nie narzut na materiał. Liczymy od powierzchni
  // ELEMENTÓW, nie kupionej płyty: klient nie ma wpływu na to, ile płyty zeszło
  // na odpad, a praca idzie w to, co faktycznie wyjeżdża do kuchni.
  // Podstawa (elementy, nie kupiona płyta) to świadoma decyzja z 17.08.2026 —
  // zanim ją zmienisz, przeczytaj komentarz przy `obrobkaNaturalnaZaM2`
  // w firms/interstone.js. Tam też stawka.
  //
  // Kwota trafia do grupy „usługi", więc na karcie klienta wchodzi w „produkcję
  // i montaż" i nie pojawia się jako osobna cena. Rozbicie ze stawką widzi
  // tylko Dawid w mailu leadowym (stąd `detalFirmowy`).
  const stawkaObrobki = firma.obrobkaNaturalnaZaM2 ?? 0;
  if (stawkaObrobki > 0 && pak.m2Blatu > 0) {
    pozycje.push({
      grupa: 'usługi',
      nazwa: 'Obróbka kamienia naturalnego',
      detalFirmowy: `${round1(pak.m2Blatu)} m² × ${fmtStawka(stawkaObrobki)}`,
      brutto: kwotaBrutto(stawkaObrobki, firma, vat) * pak.m2Blatu,
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
    m2Platne,
    wgMetrazu,
    pozycje,
    materialBrutto,
    uslugiBrutto,
    materialDoUstalenia,
    // Zmienia nazwę drugiej kwoty na karcie i dokłada zastrzeżenie
    // o odpowiedzialności za wymiary — patrz firms/_domyslne.js.
    odbiorWlasny,
    razem,
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

/** Ceny usług w plikach firm mogą być podane netto lub brutto (pole `cenyUslug`). */
function kwotaBrutto(cena, firma, vat) {
  return (firma.cenyUslug || 'brutto') === 'netto' ? cena * (1 + vat) : cena;
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

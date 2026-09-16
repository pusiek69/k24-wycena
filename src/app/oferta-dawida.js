/**
 * TRYB WŁAŚCICIELA — „Powtórz wycenę" z panelu bazy klientów.
 *
 * Uruchamia się WYŁĄCZNIE, gdy adres ma fragment #powtorz=… wygenerowany
 * przez panel: w środku siedzą parametry wyceny klienta i podpis HMAC
 * z hasła panelu (ważny 7 dni). Sam pasek rabatów to tylko widok — bramką
 * bezpieczeństwa jest worker, który bez ważnego podpisu nie zapisze wersji
 * ani nie wyśle maila. Klient nigdy tego ekranu nie zobaczy, bo nie ma
 * jak zdobyć podpisanego linku.
 *
 * Trzy mechanizmy negocjacyjne (celowo bez edycji kwot pojedynczych pozycji):
 *   • rabat % albo kwotowy na całość,
 *   • nadpisanie ceny końcowej,
 *   • wyzerowanie wybranej pozycji („montaż gratis").
 */
import { h, zl, liczba } from './dom.js';
import { wycen } from '../engine/wycena.js';
import { FIRMY, firmaWgSlug, grubosciDekoru } from '../firms/index.js';
import {
  SLUG as WYPRZEDAZ_SLUG,
  NAZWA as WYPRZEDAZ_NAZWA,
  doPokazania,
  kluczDekoru,
  plytaWgDekoru,
  firmaDlaPlyty,
  ostrzezenieOWyprzedazy,
  formaPlyty,
} from './wyprzedaz.js';
import { zaladowane as plytyWyprzedazy } from './wyprzedaz-dane.js';
import { API_BASE, sprawdzMagazyn } from '../api.js';
import { ostrzezenieOGlebokosci, sklejSegmenty } from './dyktando.js';
import { rodzajMaterialu } from '../engine/alternatywy.js';
import { wycenZMagazynu, wycenWlasciciela, wariantReczny } from './wycena-naturalny.js';
import { wariantZPlyty, doWyszukania } from './plyta-kod.js';
import { linkPlyty, linkMagazynu } from './magazyn-linki.js';
import { kolorDekoru, nazwaTagu, odlegloscKoloru } from './kolory-dekorow.js';
import { tanszeAlternatywy, ILE_PODPOWIEDZI } from './podpowiedzi.js';
import {
  dekoryWPromocji,
  naturalneWPromocji,
  ulozPromocje,
  PROG_PODOBNEGO_KOLORU,
} from './promocje-lista.js';
import promocjaNaturalna from '../generated/naturalny.promocje.json';
import * as wlasna from './plyta-wlasna.js';
import * as pozWlasne from './pozycje-wlasne.js';
import { gotoweStawki } from './stawki-klient.js';
import { bezCenJednostkowych } from './oferta-detal.js';
import { kartaOferty } from './oferta-widok.js';
import { widokRozrysu, elementyZOdcinkow, podpisWyceny } from './rozrys.js';
import { rozrysuj } from '../engine/nesting.js';
import { DOMYSLNE } from './ustawienia.js';
import {
  MAKS_WARIANTOW,
  TRYBY_UPUSTU,
  upustGlownej,
  cenaWariantu,
  opisUpustu,
  zamrozWariant,
  roznica,
} from './warianty.js';
import {
  MAKS_ETYKIETA,
  PODPOWIEDZI_ETYKIET,
  czystaEtykieta,
  odcinekDoZapisu,
  opisOdcinkaZWymiarem,
} from './etykiety-odcinkow.js';
import * as cenyPoz from './ceny-pozycji.js';


/** Wartość opcji „Kamień naturalny" w wyborze kolekcji. */
const NATURALNY = '__naturalny';
/** Materiał spoza cenników — Dawid podaje wymiar, cenę i nazwę sam. */
const WLASNA = '__wlasna';

/** Fragment #powtorz=… → paczka z panelu albo null. */
export function paczkaPowtorki() {
  const m = (location.hash || '').match(/^#powtorz=([A-Za-z0-9_-]+)$/);
  if (!m) return null;
  try {
    const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
    const bajty = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const paczka = JSON.parse(new TextDecoder().decode(bajty));
    // Wycena testowa z panelu ma leadId 0 (nie ma klienta) — samo `leadId`
    // jako warunek odrzucałoby ją jako falsy.
    const maKarte = Number(paczka?.leadId) > 0 || paczka?.test === true;
    return maKarte && paczka?.podpis && paczka?.parametry ? paczka : null;
  } catch {
    return null;
  }
}

export function uruchomOferteDawida(root, paczka) {
  const p = paczka.parametry;
  // Wycena klienta na kamieniu naturalnym ma firmę „interstone" — edytor
  // startuje wtedy w trybie naturalnym, z kodem płyty z leada.
  const naturalny = p.firma === 'interstone';

  const stan = {
    firma: naturalny ? NATURALNY : p.firma || FIRMY[0]?.slug,
    dekor: p.dekor || '',
    grubosc: String(p.grubosc || ''),
    // Etykieta wraca razem z wymiarami — po „Powtórz wycenę" Dawid widzi
    // te same podpisy, które klient wpisał w kalkulatorze.
    odcinki: (p.odcinki || []).map((o) => ({
      gl: Number(o.gl),
      dl: Number(o.dl),
      etykieta: czystaEtykieta(o.etykieta),
    })),
    opcje: { ...(p.opcje || {}) },
    // kamień naturalny (tryb właściciela)
    nat: {
      kod: String(p.kodPlyty || ''),
      wariant: null, // płyta z magazynu po lookupie
      komunikat: '',
      szukam: false,
      // ręczne nadpisania Dawida — działają też bez płyty z magazynu
      cenaM2: 0,
      nazwa: String(p.nazwa || p.dekor || ''),
      plytaDl: Number(p.plytaCm?.dl) || 320,
      plytaGl: Number(p.plytaCm?.gl) || 190,
      grubosc: String(p.gruboscMm || p.grubosc || '20').replace(/\D/g, '') || '20',
    },
    // pasek właściciela
    korektaTyp: 'brak', // brak | procent | kwota | nadpisz
    korektaWartosc: 0,
    gratisy: new Set(), // nazwy wyzerowanych pozycji
    /*
     * RĘCZNE CENY USŁUG (zlecenie Dawida, 16.09.2026): „chcę mieć możliwość
     * zmiany ceny w każdej usłudze". Mapa nazwa pozycji → kwota brutto.
     * Nadpisanie działa WYŁĄCZNIE w tej wycenie — cennik zakładu i stawki
     * z panelu zostają nietknięte. Wraca z parametrami, więc poprawka tej
     * samej oferty nie gubi ustalonych cen.
     */
    ceny: cenyPoz.zParametrow(p.ceny),
    przekresl: false,
    // Osobisty dopisek do klienta — idzie do maila i na stronę oferty.
    wiadomosc: '',
    // Warianty materiałowe do porównania (do trzech, dobierane ręcznie).
    warianty: [],
    // Płyta spoza cenników (zlecenie Dawida, 25.08.2026).
    wlasna: { ...wlasna.PUSTA },
    /*
     * Własne pozycje: demontaż starego blatu, cokoły, dopłata ekspresowa
     * (zlecenie Dawida, 01.09.2026). Odtwarzamy je z parametrów, więc
     * powtórna poprawka tej samej oferty ich nie gubi.
     */
    wlasnePozycje: pozWlasne.zParametrow(p.wlasnePozycje),
    // Aktualizacja pod tym samym linkiem: mail do klienta jest OPCJONALNY
    // i domyślnie wyłączony — Dawid zwykle poprawia wycenę w trakcie
    // rozmowy telefonicznej, a klient po prostu odświeża stronę.
    powiadomOAktualizacji: false,
  };
  if (!stan.odcinki.length) stan.odcinki = [{ gl: 60, dl: 300 }];

  const box = h('div', { class: 'panel oferta-dawida' });
  root.replaceChildren(box);
  rysuj(box, stan, paczka);

  // Stawki z panelu mogą dojść ułamek sekundy później niż pierwsze
  // rysowanie — po ich nałożeniu przeliczamy jeszcze raz, żeby Dawid
  // widział skutek własnych zmian, a nie wartości domyślnych.
  gotoweStawki().then((stawki) => {
    stan.stawki = stawki;
    rysuj(box, stan, paczka);
  });

  // Prefill z leada naturalnego: od razu dociągamy świeżą cenę z magazynu.
  if (naturalny && stan.nat.kod) pobierzPlyte(box, stan, paczka);
}

/** Lookup płyty po kodzie — ta sama droga co w kalkulatorze klienta. */
async function pobierzPlyte(box, stan, paczka) {
  const kod = stan.nat.kod.trim();
  if (!kod) {
    stan.nat.komunikat = 'Wpisz kod płyty z magazynu Interstone.';
    return rysuj(box, stan, paczka);
  }
  stan.nat.szukam = true;
  stan.nat.komunikat = '';
  rysuj(box, stan, paczka);

  try {
    const fraza = doWyszukania(kod) || kod;
    const odp = await sprawdzMagazyn(fraza, kod);
    if (odp?.plyta) {
      stan.nat.wariant = wariantZPlyty(odp.plyta);
      stan.nat.nazwa = stan.nat.wariant?.nazwa || stan.nat.nazwa;
      stan.nat.komunikat = '';
    } else {
      stan.nat.wariant = null;
      stan.nat.komunikat =
        (odp?.powodKodu || 'Nie znalazłem tej płyty w magazynie.') +
        ' Możesz policzyć z ceną wpisaną ręcznie poniżej.';
    }
  } catch {
    stan.nat.wariant = null;
    stan.nat.komunikat = 'Magazyn nie odpowiada — policz z ceną ręczną albo spróbuj ponownie.';
  }
  stan.nat.szukam = false;
  rysuj(box, stan, paczka);
}

/* ─────────────────────────────────────────────────────────── liczenie */

function policz(stan) {
  const odcinki = stan.odcinki.filter((o) => o.gl > 0 && o.dl > 0);
  if (!odcinki.length) return { ok: false, blad: 'Podaj wymiary odcinków.' };

  if (stan.firma === NATURALNY) {
    const n = stan.nat;
    // Płyta z magazynu; ręczna cena (jeśli wpisana) nadpisuje magazynową.
    if (n.wariant) {
      const wariant = n.cenaM2 > 0 ? { ...n.wariant, cenaBruttoM2: n.cenaM2 } : n.wariant;
      return wycenZMagazynu(wariant, {
        odcinki,
        opcje: stan.opcje,
        grubosc: n.wariant.gruboscMm,
      });
    }
    // Płyta spoza magazynu: wszystko z rąk Dawida.
    if (!(n.cenaM2 > 0)) {
      return {
        ok: false,
        blad: 'Pobierz płytę z magazynu (kod) albo wpisz cenę materiału ręcznie.',
      };
    }
    return wycenWlasciciela(
      wariantReczny({
        nazwa: n.nazwa,
        kod: n.kod,
        cenaBruttoM2: n.cenaM2,
        plytaCm: { dl: n.plytaDl, gl: n.plytaGl },
        gruboscMm: n.grubosc,
      }),
      { odcinki, opcje: stan.opcje, grubosc: n.grubosc }
    );
  }

  if (stan.firma === WLASNA) {
    // Płyta własna idzie tą samą ścieżką co płyta spoza magazynu przy
    // kamieniu naturalnym: pełne płyty z podanego wymiaru, cena od Dawida.
    // Różni się tylko `rodzaj` — dzięki temu nie dostaje dodatku za trudność
    // obróbki kamienia ani większego odpadu.
    const brak = wlasna.czegoBrakuje(stan.wlasna);
    if (brak) return { ok: false, blad: brak };
    return wycenWlasciciela(
      wariantReczny({ ...wlasna.doWariantu(stan.wlasna, stan.grubosc), rodzaj: 'Płyta własna' }),
      { odcinki, opcje: stan.opcje, grubosc: stan.grubosc || '20' }
    );
  }

  /*
   * WYPRZEDAŻ — kategoria budowana z płyt, które Dawid ma dziś na placu,
   * więc `firmaWgSlug` jej nie zna (patrz app/wyprzedaz.js).
   *
   * Zlecenie Dawida (31.08.2026): przy powtórnej wycenie dla klienta chce
   * móc wybrać płytę z wyprzedaży. Rozliczenie jest takie samo jak wszędzie
   * indziej — pełne płyty, cena wyprzedażowa, ostrzeżenie gdy blat wymaga
   * więcej sztuk, niż zostało.
   */
  if (stan.firma === WYPRZEDAZ_SLUG) {
    const plyty = plytyWyprzedazy();
    const plyta = plytaWgDekoru(plyty, stan.dekor);
    if (!plyta) {
      return {
        ok: false,
        blad: doPokazania(plyty).length
          ? 'Wybierz płytę z wyprzedaży.'
          : 'Nie ma dziś żadnej opublikowanej płyty na wyprzedaży.',
      };
    }
    const w = wycen(firmaDlaPlyty(plyty, stan.dekor), {
      dekor: stan.dekor,
      grubosc: String(plyta.gruboscMm),
      odcinki,
      opcje: stan.opcje,
    });
    if (w.ok) {
      const uwaga = ostrzezenieOWyprzedazy(w, plyty);
      if (uwaga && !w.ostrzezenia.includes(uwaga)) w.ostrzezenia.push(uwaga);
    }
    return w;
  }

  const firma = firmaWgSlug(stan.firma);
  if (!firma) return { ok: false, blad: 'Nieznana firma.' };
  return wycen(firma, { dekor: stan.dekor, grubosc: stan.grubosc, odcinki, opcje: stan.opcje });
}

/**
 * Zamrożona oferta: pozycje z wyceny + mechanizmy właściciela.
 * Kolejność: gratisy zerują pozycje → suma → rabat →— nadpisanie wygrywa
 * ze wszystkim.
 */
function zamrozOferte(stan, w) {
  // pozycje „w cenie" (0 zł) klient i tak widzi jako zawarte — renderujemy
  // je na końcu listy jako gratis, żeby oferta czytała się jak karta wyceny
  /*
   * Pozycja „w cenie" z RĘCZNĄ CENĄ przestaje być gratisem — Dawid właśnie
   * powiedział, ile ma kosztować (zgłoszenie z 16.09.2026 o pomiarze
   * Prolinerem). Bez tego wpisana kwota zniknęłaby w zamrożonej ofercie.
   */
  const wCenie = w.pozycje
    .filter((p) => p.wCenie && !cenyPoz.recznaCena(stan.ceny, p.nazwa))
    .map((p) => ({ nazwa: p.nazwa, detal: bezCenJednostkowych(p.detal), brutto: 0, gratis: true }));

  const widoczne = [
    ...w.pozycje
      .filter((p) => !p.wCenie || cenyPoz.recznaCena(stan.ceny, p.nazwa))
      .map((p) => ({
        nazwa: p.nazwa,
        // Bez stawek jednostkowych — patrz bezCenJednostkowych() na górze pliku.
        detal: bezCenJednostkowych(p.detal),
        // Ręczna cena wygrywa z cennikową, a gratis wygrywa z obiema.
        brutto: stan.gratisy.has(p.nazwa) ? 0 : cenyPoz.cenaPozycji(stan.ceny, p),
        gratis: stan.gratisy.has(p.nazwa),
      })),
    ...wCenie,
  ];

  /*
   * WŁASNE POZYCJE DAWIDA wchodzą na KONIEC listy, za pozycjami silnika.
   *
   * To nie jest kosmetyka kolejności: `rozbicieDlaKlienta` uznaje w zamrożonej
   * ofercie za materiał wyłącznie PIERWSZĄ pozycję (bo pozycje silnika nie mają
   * pola `grupa`). Nasze wiersze niosą `grupa` wprost, więc rozstrzyga ona —
   * ale gdyby kiedyś zniknęła, na końcu listy i tak wpadną do prac, czyli tam,
   * gdzie należy większość dodatków. Bezpiecznie w obie strony.
   */
  const wlasnePoz = pozWlasne.doOferty(stan.wlasnePozycje);
  widoczne.push(...wlasnePoz.map((x) => ({ ...x, brutto: stan.gratisy.has(x.nazwa) ? 0 : x.brutto, gratis: stan.gratisy.has(x.nazwa) })));

  // Suma własnych pozycji dolicza się PRZED upustem — upust procentowy
  // ma objąć całość oferty, a nie tylko część policzoną przez silnik.
  const wlasneRazem = wlasnePoz
    .filter((x) => !stan.gratisy.has(x.nazwa))
    .reduce((suma, x) => suma + x.brutto, 0);

  /*
   * Ręczne ceny wchodzą do PUNKTU WYJŚCIA, a nie do upustu. Gdyby siedziały
   * po stronie upustu, obniżenie montażu wyglądałoby jak rabat: przekreślona
   * kwota pokazywałaby cenę, której Dawid nigdy nie podał, a warianty
   * dostałyby ten „upust" w procentach (patrz upustGlownej w warianty.js).
   */
  const roznicaCen = cenyPoz.roznicaRecznychCen(stan.ceny, w.pozycje, stan.gratisy);

  const przed = Math.round(w.razemZaokr || w.razem) + wlasneRazem + roznicaCen;
  // Punktem wyjścia jest kwota z karty klienta (z jej zaokrągleniem),
  // pomniejszona o wyzerowane pozycje — a nie surowa suma pozycji, która
  // przez zaokrąglenie potrafi różnić się o złotówkę i udawać upust.
  // Wyzerowane liczymy z ceny CENNIKOWEJ, bo tyle siedzi w `przed`.
  const wyzerowane = w.pozycje
    .filter((p) => !p.wCenie && stan.gratisy.has(p.nazwa))
    .reduce((suma, p) => suma + Math.round(p.brutto), 0);
  const poGratisach = przed - wyzerowane;
  let razem = poGratisach;
  let korektaOpis = '';

  const wart = Number(stan.korektaWartosc) || 0;
  if (stan.korektaTyp === 'procent' && wart > 0 && wart < 100) {
    razem = Math.round(poGratisach * (1 - wart / 100));
    korektaOpis = `upust ${wart}%`;
  } else if (stan.korektaTyp === 'kwota' && wart > 0 && wart < poGratisach) {
    razem = Math.round(poGratisach - wart);
    korektaOpis = `upust ${zl(wart)}`;
  } else if (stan.korektaTyp === 'nadpisz' && wart > 0) {
    razem = Math.round(wart);
    korektaOpis = 'cena ustalona indywidualnie';
  }
  if (stan.gratisy.size) {
    korektaOpis = [korektaOpis, [...stan.gratisy].map((n) => `gratis: ${n}`).join(', ')]
      .filter(Boolean)
      .join('; ');
  }

  // Firma prosto z wyniku silnika — przy kamieniu naturalnym to konfiguracja
  // zbudowana z konkretnej płyty, nie wpis z listy kolekcji.
  const firma = w.firma;
  return {
    // Przy płycie własnej pomijamy nazwę „firmy" — to nasza etykieta
    // wewnętrzna, a klient ma zobaczyć nazwę materiału, którą podał Dawid.
    opis: [
      stan.firma === WLASNA ? '' : firma?.nazwa,
      w.dekor,
      w.grubosc ? `${w.grubosc} mm` : '',
      opisOdcinkow(stan.odcinki),
    ]
      .filter(Boolean)
      .join(' · '),
    pozycje: widoczne,
    razemPrzed: przed,
    razem,
    korektaOpis,
    przekresl: !!stan.przekresl && razem < przed,
    // Dopisek zamrażamy razem z ofertą: klient zobaczy dokładnie te słowa,
    // które Dawid zatwierdził w podglądzie.
    wiadomosc: String(stan.wiadomosc || '').trim().slice(0, MAKS_WIADOMOSCI),
    stawkaVat: w.stawkaVat ?? 0.08,
    odbiorWlasny: !!w.odbiorWlasny,
    // Warianty porównawcze — sama kwota łączna per materiał.
    // Dokładane na końcu (patrz niżej): potrzebują gotowej ceny głównej,
    // żeby wiedzieć, jaki upust dziedziczą.
    // Rozrys ZAMROŻONY w chwili wysyłki: klient ma zobaczyć dokładnie ten
    // układ, który zatwierdził Dawid — razem z jego ręcznymi zmianami
    // elementów. Strona oferty niczego nie przelicza.
    rozrys: zamrozRozrys(stan, w),
    // Noty silnika — m.in. „N płyt z tego samego bloku, spójny wzór"
    // i zastrzeżenia o dostępności. Klient widzi je też na stronie oferty.
    noty: w.ostrzezenia || [],
    firma: firma?.nazwa || '',
    dekor: w.dekor,
    grubosc: w.grubosc,
    m2: w.pak?.m2Blatu ?? 0,
    mb: w.pak?.mb ?? 0,
    pomieszczenie: stan.opcje.pomieszczenie || 'kuchnia',
    kategoria: rodzajMaterialu(firma),
    /*
     * ⚠ Własne pozycje muszą siedzieć W ŚRODKU `parametry`, nie obok.
     * To `parametry` wraca do edytora przy „Powtórz wycenę" (czyta je
     * `uruchomOferteDawida` jako `paczka.parametry`), więc pozycja położona
     * piętro wyżej zniknęłaby przy pierwszej poprawce i Dawid wpisywałby
     * demontaż od nowa.
     */
    parametry: {
      ...(stan.firma === NATURALNY
        ? {
            firma: 'interstone',
            dekor: w.dekor,
            grubosc: w.grubosc,
            odcinki: stan.odcinki.map(odcinekDoZapisu),
            opcje: stan.opcje,
            kodPlyty: w.kodPlyty || stan.nat.kod || null,
            nazwa: stan.nat.nazwa,
            cenaM2: stan.nat.wariant && !(stan.nat.cenaM2 > 0)
              ? stan.nat.wariant.cenaBruttoM2
              : stan.nat.cenaM2,
            plytaCm: stan.nat.wariant?.plytaCm || { dl: stan.nat.plytaDl, gl: stan.nat.plytaGl },
            gruboscMm: Number(w.grubosc) || 20,
          }
        : {
            firma: stan.firma,
            dekor: stan.dekor,
            grubosc: stan.grubosc,
            odcinki: stan.odcinki.map(odcinekDoZapisu),
            opcje: stan.opcje,
          }),
      wlasnePozycje: pozWlasne.doParametrow(stan.wlasnePozycje),
      // Ręczne ceny usług — tylko gdy jakieś są, żeby stare oferty
      // wyglądały w JSON-ie dokładnie jak dotąd.
      ...(stan.ceny.size ? { ceny: cenyPoz.doParametrow(stan.ceny) } : {}),
    },
  };
}

/**
 * NAZWA ODCINKA w edytorze właściciela (zlecenie Dawida, 16.09.2026).
 *
 * Tu Dawid „dodaje odcinki", więc to jest miejsce, o którym mówił wprost.
 * Pole idzie POD wymiarami, bo wiersz z wymiarami jest tu główny i wąski.
 * Zapis na `onchange` (nie `oninput`) — edytor przerysowuje się po każdej
 * zmianie, więc zapis przy każdej literze wyrzucałby ognisko z pola.
 */
function etykietaOdcinkaWiersz(o, i, odswiez) {
  return h(
    'div',
    { class: 'od-etykieta' },
    h('input', {
      type: 'text',
      value: o.etykieta || '',
      maxlength: String(MAKS_ETYKIETA),
      placeholder: 'np. Wyspa, fartuch…',
      'aria-label': `Nazwa odcinka ${i + 1} (opcjonalnie)`,
      onchange: (e) => ((o.etykieta = czystaEtykieta(e.target.value)), odswiez()),
    }),
    ...PODPOWIEDZI_ETYKIET.map((t) =>
      h(
        'button',
        {
          class: 'chip-etykieta',
          type: 'button',
          onclick: () => ((o.etykieta = t), odswiez()),
        },
        t
      )
    )
  );
}

/**
 * WPROWADZANIE GŁOSOWE W EDYTORZE (zlecenie Dawida, 16.09.2026).
 *
 * „Mówię imię, nazwisko, email, telefon, wymiary blatów, a na tej podstawie
 *  uzupełniają się dane w kalkulatorze."
 *
 * W edytorze klient jest już znany (karta #N), więc z całego dyktanda
 * bierzemy to, czego tu naprawdę brakuje: WYMIARY ODCINKÓW razem z nazwami.
 * Dane osobowe wpisuje się w panelu, przy „+ Dodaj klienta".
 *
 * Mowę na tekst zamienia sama przeglądarka (Web Speech API) — dźwięk nie
 * opuszcza komputera, do workera idzie gotowy tekst. Bez obsługi mikrofonu
 * (Firefox, stare przeglądarki) bloku po prostu nie ma.
 */
const PODPOWIEDZ_MIKROFONU =
  'Kliknij i podyktuj wymiary, np. „blat trzysta na sześćdziesiąt, wyspa dwieście na dziewięćdziesiąt".';

/**
 * DLACZEGO MIKROFON NIE RUSZYŁ — trzy różne przyczyny, trzy różne rady.
 *
 * ⚠ Dawid, 16.09.2026: „pokazuje że mam zablokowany mikrofon, a nie mam".
 * I miał rację. Przeglądarka na każdą z tych sytuacji oddaje ten sam błąd
 * `not-allowed`, a rady są sprzeczne:
 *
 *   1. POLITYKA UPRAWNIEŃ strony (nagłówek serwera albo ramka bez `allow`)
 *      — kłódka przy adresie NIE MA czego zaproponować, bo przeglądarka
 *      nawet nie pyta. To musimy naprawić my, nie Dawid.
 *   2. ZAPAMIĘTANA BLOKADA dla tej strony w Chrome — tu właśnie kłódka
 *      pomaga, ale trzeba jeszcze odświeżyć stronę.
 *   3. MIKROFON WYŁĄCZONY W SYSTEMIE albo zajęty przez inny program.
 *
 * Wysyłanie kogoś do kłódki, która nic nie oferuje, to godzina stracona
 * przy kliencie — dokładnie to się stało.
 */
async function powodBrakuMikrofonu() {
  const polityka = document.permissionsPolicy || document.featurePolicy;
  if (polityka && !polityka.allowsFeature('microphone')) {
    return window.self !== window.top
      ? 'Ta strona jest otwarta w ramce, która nie wpuszcza mikrofonu — otwórz wycenę w osobnej karcie.'
      : 'Mikrofon blokuje ustawienie serwera strony, nie Twoja przeglądarka. Kłódka przy adresie tu nie pomoże — daj znać, to poprawię.';
  }
  const stan = await navigator.permissions
    ?.query({ name: 'microphone' })
    .then((r) => r.state)
    .catch(() => null);
  if (stan === 'denied')
    return 'Chrome ma zapamiętaną blokadę mikrofonu dla tej strony. Kliknij kłódkę przy adresie → Mikrofon → Zezwalaj, i odśwież stronę.';
  if (stan === 'prompt')
    return 'Przeglądarka pyta o zgodę na mikrofon — kliknij „Zezwól" w okienku u góry i spróbuj jeszcze raz.';
  return 'Mikrofon nie odpowiada. Sprawdź, czy nie używa go inny program i czy jest włączony w ustawieniach Windowsa.';
}

/** Jedno rozpoznawanie na ekran — trzymane poza stanem, bo to urządzenie. */
let sluchEdytora = null;

function blokDyktanda(stan, paczka, odswiez) {
  const Mowa =
    typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
  if (!Mowa) return null;

  /*
   * Każde przerysowanie edytora wymienia węzły tego bloku. Gdyby nasłuch
   * przeżył podmianę, pisałby transkrypt po elementach, których nie ma już
   * na ekranie — mikrofon byłby włączony, a nie byłoby tego widać.
   */
  if (sluchEdytora) {
    try {
      sluchEdytora.abort();
    } catch {
      /* już zamknięty */
    }
    sluchEdytora = null;
  }

  const d = (stan.dyktando = stan.dyktando || { info: PODPOWIEDZ_MIKROFONU, przed: null });
  const info = h('span', { class: 'dy-info' }, d.info);
  const slychac = h('div', { class: 'dy-slychac' });
  const powiedz = (t) => ((d.info = t), (info.textContent = t));

  /**
   * Dwa przyciski, a nie jeden z domysłem.
   *
   * „Wpisz" podmienia komplet odcinków — tak dyktuje się blat od nowa.
   * „Dopisz" doklada kolejne do tego, co już jest — o to Dawid poprosił
   * wprost, bo przy ladzie klient przypomina sobie parapet dopiero po
   * wszystkim. Zgadywanie, o które z dwóch chodzi, po brzmieniu zdania
   * byłoby najgorsze z możliwych: myliłoby się cicho i raz na jakiś czas.
   */
  const przyciskWpisz = h('button', { class: 'dy-btn', type: 'button' }, '\u{1F3A4} Wpisz głosowo');
  const przyciskDopisz = h(
    'button',
    { class: 'dy-btn cichy', type: 'button', title: 'Doda kolejne odcinki do tych, które już są' },
    '\u{1F3A4}+ Dopisz głosem'
  );

  async function rozpoznaj(tekst, dopisz) {
    powiedz('Rozpoznaję…');
    let odp = null;
    try {
      const r = await fetch(`${API_BASE}/dyktando`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tekst,
          leadId: paczka.leadId,
          exp: paczka.exp,
          podpis: paczka.podpis,
        }),
      });
      odp = await r.json();
    } catch {
      powiedz('Brak połączenia — wpisz wymiary ręcznie.');
      return;
    }
    if (odp?.error) return powiedz(odp.error);

    const nowe = odp?.dane?.odcinki || [];
    if (!nowe.length)
      return powiedz('Nie usłyszałem wymiarów — powiedz np. „blat trzysta na sześćdziesiąt".');

    /*
     * Poprzedni komplet zostaje pod „Cofnij" — tak samo przy podmianie,
     * jak przy dopisaniu. Przesłyszany mikrofon nie ma prawa bezpowrotnie
     * ruszyć wymiarów, które klient podał w kalkulatorze.
     */
    d.przed = stan.odcinki;
    const zGlosu = nowe.map((o) => ({ ...o, zGlosu: true }));
    // Przy dopisywaniu odsiewamy pusty odcinek-zalotnik (60×300 z nowej
    // wyceny), żeby „dopisz" nie zostawiało w środku wiersza, którego
    // nikt nie wpisał ani nie podyktował.
    stan.odcinki = dopisz ? [...stan.odcinki.filter((o) => o.gl > 0 && o.dl > 0), ...zGlosu] : zGlosu;

    const czasownik = dopisz ? 'Dopisałem' : 'Wpisałem';
    const opis = nowe.map(opisOdcinkaZWymiarem).join(' + ');
    const uwaga = ostrzezenieOGlebokosci(nowe);
    d.info = `${czasownik}: ${opis} cm. Sprawdź i popraw.${uwaga ? ' ' + uwaga : ''}`;
    odswiez();
  }

  /** Jedno kliknięcie mikrofonu — obsługa jest ta sama dla obu przycisków. */
  function sluchaj(przycisk, etykieta, dopisz) {
    if (sluchEdytora) return sluchEdytora.stop(); // drugie kliknięcie = koniec

    let slyszane = '';
    let porzucone = false;
    const r = new Mowa();
    r.lang = 'pl-PL';
    r.continuous = true; // dyktuje się kilka odcinków naraz, nie jedno słowo
    r.interimResults = true; // podgląd na żywo — widać, że mikrofon słucha

    /*
     * ⚠ BUG ZGŁOSZONY PRZEZ DAWIDA (16.09.2026): „dubluje strasznie — źle
     * zczytuje co mówię i POWTARZA CYFRY". Chrome poprawia zamknięte już
     * fragmenty i zgłasza je drugi raz, więc doklejanie „tylko nowych"
     * wyników od `resultIndex` powiela liczby. Składamy więc cały
     * transkrypt od zera przy każdym zdarzeniu — patrz `sklejSegmenty`.
     * Wyniki wstępne idą OSOBNO, jako sam podgląd, i nigdy do bufora.
     */
    r.onresult = (e) => {
      const finalne = [];
      let wstepne = '';
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalne.push(e.results[i][0].transcript);
        else wstepne += e.results[i][0].transcript;
      }
      slyszane = sklejSegmenty(finalne);
      /*
       * ŚLAD SUROWYCH ZDARZEŃ. Dwa zgłoszenia o „powtarzaniu" z rzędu
       * poszły na domysły, bo z opisu nie da się odtworzyć, co przysłał
       * Chrome. Teraz ostatnie klatki zostają pod ręką w `window.__dyktandoSlad`
       * — nic nie wysyłają i nic nie kosztują, a przy kolejnym „dalej dubluje"
       * widać fakty zamiast teorii.
       */
      (window.__dyktandoSlad = window.__dyktandoSlad || []).push({ finalne, wstepne, zlozone: slyszane });
      slychac.replaceChildren(slyszane, h('span', { class: 'dy-niepewne' }, wstepne));
    };
    r.onerror = async (e) => {
      porzucone = true; // żeby `onend` nie nadpisał tego komunikatu
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed')
        powiedz(await powodBrakuMikrofonu());
      else powiedz(`Mikrofon nie zadziałał (${e.error}) — wpisz ręcznie.`);
    };
    r.onend = () => {
      sluchEdytora = null;
      przycisk.classList.remove('nagrywa');
      przycisk.textContent = etykieta;
      if (porzucone) return;
      if (slyszane.trim()) rozpoznaj(slyszane, dopisz);
      else powiedz('Nic nie usłyszałem — spróbuj jeszcze raz.');
    };

    try {
      r.start();
    } catch {
      return powiedz('Nie udało się włączyć mikrofonu.');
    }
    sluchEdytora = r;
    przycisk.classList.add('nagrywa');
    przycisk.textContent = '\u25A0 Zakończ i rozpoznaj';
    powiedz('Słucham… mów spokojnie, potem kliknij „Zakończ".');
  }

  przyciskWpisz.addEventListener('click', () =>
    sluchaj(przyciskWpisz, '\u{1F3A4} Wpisz głosowo', false)
  );
  przyciskDopisz.addEventListener('click', () =>
    sluchaj(przyciskDopisz, '\u{1F3A4}+ Dopisz głosem', true)
  );

  return h(
    'div',
    { class: 'dy-blok' },
    h(
      'div',
      { class: 'dy-pasek' },
      przyciskWpisz,
      // „Dopisz" pokazujemy dopiero, gdy jest do czego dopisywać.
      stan.odcinki.some((o) => o.gl > 0 && o.dl > 0) ? przyciskDopisz : null,
      info,
      d.przed
        ? h(
            'button',
            {
              class: 'link-btn',
              type: 'button',
              onclick: () => {
                stan.odcinki = d.przed;
                d.przed = null;
                d.info = 'Przywróciłem poprzednie odcinki.';
                odswiez();
              },
            },
            'Cofnij'
          )
        : null
    ),
    slychac
  );
}

/**
 * DODATKI I USŁUGI Z CENNIKA (zlecenie Dawida, 16.09.2026).
 *
 * Wszystkie pozycje liczone sztukowo, od metra albo od dnia — ociekacze,
 * impregnacja, projekt CAD, podświetlenie, transport, dzień ekipy. W kalkulatorze
 * klienta ich nie ma (`tylkoWlasciciel`), bo to cennik warsztatu, a nie
 * ekran do samodzielnego klikania.
 *
 * Blok rysuje się SAM z konfiguracji: nowa pozycja w cenniku pojawia się tu
 * bez dopisywania kolejnego pola. Domyślnie wszystkie mają zero, więc wycena
 * nie rośnie, dopóki Dawid czegoś nie wpisze.
 */
function blokDodatkow(stan, firma, odswiez) {
  const dodatki = (firma?.opcje || []).filter((o) => o.typ === 'liczba' && o.id !== 'otwory');
  if (!dodatki.length) return null;

  const ile = (o) => Number(stan.opcje[o.id] ?? o.domyslnie ?? 0) || 0;
  const wybrane = dodatki.filter((o) => ile(o) > 0).length;

  return h(
    'details',
    { class: 'od-pasek', open: wybrane ? 'open' : undefined },
    h(
      'summary',
      {},
      'Dodatki i usługi',
      wybrane ? h('b', { style: 'margin-left:8px' }, `${wybrane} wybrane`) : null
    ),
    h(
      'div',
      { class: 'od-siatka', style: 'margin-top:10px' },
      ...dodatki.map((o) =>
        pole(
          `${o.label} (${o.jednostka || 'szt.'} · ${zl(Math.round((o.cena / 1.23) * 1.08))})`,
          licznik(ile(o), 0, (v) => ((stan.opcje[o.id] = v), odswiez()), o.max ?? 99)
        )
      )
    ),
    h(
      'p',
      { class: 'form-nota', style: 'margin:8px 0 0' },
      'Kwoty przy nazwach to ceny brutto przy montażu (VAT 8%). ' +
        'Przy odbiorze własnym silnik przelicza je na 23%. ' +
        'Ceny zmieniasz w panelu (Stawki zakładu) albo punktowo w wycenie niżej.'
    )
  );
}

const opisOdcinkow = (odcinki) => odcinki.map(opisOdcinkaZWymiarem).join(' + ') + ' cm';

/**
 * Zdjęcie rozrysu do oferty.
 *
 * Bierze stan z ekranu „Rozrys płyt", jeśli Dawid go otwierał (łącznie
 * z dodanymi fartuchami i wyspami), a jeśli nie — liczy domyślny układ
 * z odcinków wyceny, żeby każda wysłana oferta miała obrazek.
 *
 * Do klienta idą wyłącznie ułożone płyty i statystyki. Rzeczy warsztatowe
 * (parametry cięcia, elementy, które się nie zmieściły) zostają w edytorze.
 */
function zamrozRozrys(stan, w) {
  try {
    // Ta sama gwarancja co przy podglądzie: gdy Dawid zmienił wymiary
    // w wycenie po otwarciu rozrysu, klient NIE może dostać starej migawki.
    zapewnijRozrys(stan);
    const ustawienia = stan.rozrys;
    const plyta = plytaDoRozrysu(stan, w);
    const wynik = rozrysuj(ustawienia.elementy, plyta, {
      rzaz: ustawienia.rzaz,
      margines: ustawienia.margines,
      rotacja: ustawienia.rotacja,
      // U części dostawców można kupić pół płyty — rysunek ma to pokazać,
      // bo inaczej odpad na rozrysie kłóci się z kwotą w wycenie.
      polowkaDozwolona: polowkaZRozkroju(w),
    });
    if (!wynik.plyty.length) return null;

    return {
      plyty: wynik.plyty,
      statystyki: wynik.statystyki,
      opisMaterialu: [w.firma?.nazwa, w.dekor].filter(Boolean).join(' · '),
    };
  } catch {
    // Rozrys to dodatek do oferty — nie ma prawa zablokować wysyłki.
    return null;
  }
}

/* ──────────────────────────────────────────────────────────── widok */

/**
 * Oferta razem z wariantami.
 *
 * Warianty muszą powstać PO głównej, bo dziedziczą jej upust — stąd
 * osobny krok zamiast pola w `zamrozOferte`.
 */
function ofertaZWariantami(stan, w) {
  const oferta = zamrozOferte(stan, w);
  if (!oferta) return oferta;
  const warianty = zamrozWarianty(stan, oferta);
  return warianty.length ? { ...oferta, warianty } : oferta;
}

function rysuj(box, stan, paczka) {
  const naturalny = stan.firma === NATURALNY;
  const plytaWlasna = stan.firma === WLASNA;
  const zWyprzedazy = stan.firma === WYPRZEDAZ_SLUG;
  let dekory = [];
  let grubosci = [];

  /*
   * Wyprzedaż ma „dekory", ale są nimi konkretne płyty z placu, a grubość
   * jest jedna — ta, którą ma wybrana płyta. Bez tej gałęzi `firmaWgSlug`
   * nie znalazłoby kategorii i `stan.firma` wracałoby po cichu do pierwszej
   * kolekcji z listy, czyli wybór Dawida znikałby po jednym przerysowaniu.
   */
  if (zWyprzedazy) {
    const plyty = doPokazania(plytyWyprzedazy());
    dekory = plyty.map(kluczDekoru);
    if (!dekory.includes(stan.dekor)) stan.dekor = dekory[0] || '';
    const wybrana = plytaWgDekoru(plyty, stan.dekor);
    grubosci = wybrana ? [String(wybrana.gruboscMm)] : [];
    stan.grubosc = grubosci[0] || stan.grubosc;
  }

  // Ani kamień naturalny, ani płyta własna nie mają dekorów z cennika —
  // bez tego wyjątku `stan.firma` wracałoby tu do pierwszej kolekcji z listy.
  if (!naturalny && !plytaWlasna && !zWyprzedazy) {
    const firma = firmaWgSlug(stan.firma) || FIRMY[0];
    stan.firma = firma.slug;
    dekory = Object.keys(firma.dekory || {});
    if (!dekory.includes(stan.dekor)) stan.dekor = dekory[0] || '';
    grubosci = grubosciDekoru(firma, stan.dekor);
    if (!grubosci.includes(stan.grubosc)) stan.grubosc = grubosci[0] || '';
  }

  const w = policz(stan);
  const oferta = w.ok ? ofertaZWariantami(stan, w) : null;
  const odswiez = () => rysuj(box, stan, paczka);

  box.replaceChildren(
    h(
      'div',
      { class: 'karta-wyceny' },
      h(
        'div',
        { class: 'q-kicker' },
        paczka.test
          ? 'Tryb właściciela — WYCENA TESTOWA (nic się nie zapisuje)'
          : `Tryb właściciela — oferta dla: ${paczka.imie || 'klient'} (karta #${paczka.leadId})`
      ),
      h('h3', { class: 'q-title' }, paczka.test ? 'Wycena testowa' : 'Powtórz wycenę'),

      /* ── parametry ── */
      h(
        'div',
        { class: 'od-siatka' },
        pole(
          'Kolekcja',
          wybor(
            [
              ...FIRMY.filter((f) => f.trybCeny === 'katalog').map((f) => [f.slug, f.nazwa]),
              // Wyprzedaż pokazujemy TYLKO wtedy, gdy coś na niej stoi —
              // pusta pozycja w liście kolekcji tylko myli przy wycenie.
              ...(doPokazania(plytyWyprzedazy()).length
                ? [[WYPRZEDAZ_SLUG, `${WYPRZEDAZ_NAZWA} (płyta z placu)`]]
                : []),
              [NATURALNY, 'Kamień naturalny (płyta z magazynu)'],
              [WLASNA, 'Płyta własna (spoza cenników)'],
            ],
            stan.firma,
            (v) => {
              stan.firma = v;
              if (v === WYPRZEDAZ_SLUG) {
                // Pierwsza dostępna płyta, żeby wycena policzyła się od razu.
                const pierwsza = doPokazania(plytyWyprzedazy())[0];
                stan.dekor = pierwsza ? kluczDekoru(pierwsza) : '';
                if (pierwsza) stan.grubosc = String(pierwsza.gruboscMm);
              } else if (v !== NATURALNY && v !== WLASNA) {
                const nowa = firmaWgSlug(v);
                stan.dekor = Object.keys(nowa?.dekory || {})[0] || '';
              }
              odswiez();
            }
          )
        ),
        naturalny
          ? null
          : pole(
              zWyprzedazy ? 'Płyta z wyprzedaży' : 'Dekor',
              wybor(dekory.map((d) => [d, d]), stan.dekor, (v) => {
                stan.dekor = v;
                // Każda płyta ma własną grubość — bierzemy ją razem z płytą.
                const p = zWyprzedazy ? plytaWgDekoru(plytyWyprzedazy(), v) : null;
                if (p) stan.grubosc = String(p.gruboscMm);
                odswiez();
              })
            ),
        naturalny ? null : pole('Grubość', wybor(grubosci.map((g) => [g, g + ' mm']), stan.grubosc, (v) => ((stan.grubosc = v), odswiez()))),
        pole('Pomieszczenie', wybor([['kuchnia', 'kuchnia'], ['lazienka', 'łazienka']], stan.opcje.pomieszczenie || 'kuchnia', (v) => {
          stan.opcje.pomieszczenie = v;
          odswiez();
        })),
        pole('Montaż', wybor([['montaz', 'z montażem (8%)'], ['odbior', 'odbiór własny (23%)']], stan.opcje.dostawa === 'odbior' ? 'odbior' : 'montaz', (v) => {
          stan.opcje.dostawa = v === 'odbior' ? 'odbior' : 'montaz';
          odswiez();
        })),
        pole('Zlew / umywalka', wybor([['podblat', 'podwieszany'], ['nablat', 'nablatowy']], stan.opcje.zlew || 'podblat', (v) => ((stan.opcje.zlew = v), odswiez()))),
        (stan.opcje.pomieszczenie || 'kuchnia') === 'kuchnia'
          ? pole('Płyta indukcyjna', wybor([['nakladana', 'nakładana'], ['licowana', 'licowana']], stan.opcje.plyta || 'nakladana', (v) => ((stan.opcje.plyta = v), odswiez())))
          : pole('Umywalki (szt.)', licznik(stan.opcje.umywalki ?? 1, 1, (v) => ((stan.opcje.umywalki = v), odswiez()))),
        pole('Otwory (szt.)', licznik(stan.opcje.otwory ?? 1, 0, (v) => ((stan.opcje.otwory = v), odswiez())))
      ),

      /* ── dodatki i usługi z cennika (16.09.2026) ── */
      /*
       * Firmę bierzemy z WYNIKU silnika (`w.firma`), a nie z `stan.firma`:
       * przy kamieniu naturalnym, płycie własnej i wyprzedaży to dopiero
       * silnik składa konfigurację, z której wychodzą ceny dodatków.
       * Gdy wycena się nie liczy, sięgamy po wpis z cennika.
       */
      blokDodatkow(stan, (w.ok && w.firma) || firmaWgSlug(stan.firma), odswiez),

      /* ── kamień naturalny: płyta z magazynu albo cena ręczna ── */
      naturalny ? blokNaturalny(stan, paczka, box, odswiez) : null,

      /* ── płyta spoza cenników: wymiar, cena i nazwa od Dawida ── */
      plytaWlasna ? blokPlytyWlasnej(stan, odswiez) : null,

      /* ── odcinki ── */
      h('div', { class: 'q-kicker', style: 'margin-top:16px' }, 'Odcinki blatu (głębokość × długość, cm)'),
      blokDyktanda(stan, paczka, odswiez),
      h(
        'div',
        {},
        ...stan.odcinki.map((o, i) =>
          h(
            'div',
            // Podswietlenie znika, gdy Dawid tknie wymiar recznie — ma mowic
            // „tego nie pisales ty", a nie zostawac na ekranie na zawsze.
            { class: 'od-odcinek-blok' + (o.zGlosu ? ' zglosu' : '') + (o.domyslnaGlebokosc ? ' zgadniety' : '') },
            h(
              'div',
              { class: 'od-odcinek' },
              h('input', {
                type: 'number', inputmode: 'numeric', value: o.gl || '',
                'aria-label': 'głębokość', placeholder: 'głęb.',
                onchange: (e) => ((o.gl = Number(e.target.value)), delete o.zGlosu, delete o.domyslnaGlebokosc, odswiez()),
              }),
              h('span', {}, '×'),
              h('input', {
                type: 'number', inputmode: 'numeric', value: o.dl || '',
                'aria-label': 'długość', placeholder: 'dług.',
                onchange: (e) => ((o.dl = Number(e.target.value)), delete o.zGlosu, odswiez()),
              }),
              stan.odcinki.length > 1
                ? h('button', { class: 'link-btn', type: 'button', onclick: () => (stan.odcinki.splice(i, 1), odswiez()) }, '✕')
                : null
            ),
            etykietaOdcinkaWiersz(o, i, odswiez)
          )
        ),
        h('button', { class: 'link-btn', type: 'button', onclick: () => (stan.odcinki.push({ gl: 60, dl: 100 }), odswiez()) }, '+ kolejny odcinek')
      ),

      /* ── własne pozycje: demontaż, cokoły, dopłaty ── */
      blokWlasnychPozycji(stan, odswiez),

      /* ── podgląd pozycji / błąd ── */
      w.ok ? podgladPozycji(stan, oferta, odswiez, w) : h('div', { class: 'form-blad' }, w.blad || 'Nie udało się policzyć.'),

      /* ── pasek właściciela ── */
      w.ok ? pasekWlasciciela(stan, oferta, odswiez) : null,

      /* ── rozrys płyt: narzędzie warsztatowe, nie część oferty ── */
      w.ok ? h('div', { class: 'nav', style: 'margin-top:10px' }, przyciskRozrysu(stan, w, paczka, box)) : null,

      /* ── podpowiedzi tańszych materiałów: odpowiedź na „za drogo" ── */
      w.ok && !paczka.test ? blokPodpowiedzi(stan, w, oferta, odswiez) : null,

      /* ── wszystkie dekory w promocji ── */
      w.ok && !paczka.test ? blokPromocji(stan, oferta, odswiez) : null,

      /* ── warianty do porównania (nie w wycenie testowej) ── */
      w.ok && !paczka.test ? blokWariantow(stan, oferta, odswiez) : null,

      /* ── wiadomość od Dawida: tylko gdy jest do kogo pisać ── */
      w.ok && !paczka.test ? blokWiadomosci(stan) : null,

      /* ── wysyłka (w trybie testowym nie ma komu wysyłać) ── */
      w.ok ? (paczka.test ? notaTestowa() : wysylka(stan, oferta, paczka, box)) : null
    )
  );
}

function blokNaturalny(stan, paczka, box, odswiez) {
  const n = stan.nat;
  const kodPole = h('input', {
    type: 'text',
    value: n.kod,
    placeholder: 'np. STON000334-84224',
    onchange: (e) => (n.kod = e.target.value),
  });

  const wiersze = [
    h('div', { class: 'q-kicker', style: 'margin-top:16px' }, 'Płyta z magazynu Interstone'),
    h(
      'div',
      { class: 'od-odcinek' },
      kodPole,
      h(
        'button',
        { class: 'btn cichy', type: 'button', disabled: n.szukam ? 'disabled' : undefined,
          onclick: () => { n.kod = kodPole.value; pobierzPlyte(box, stan, paczka); } },
        n.szukam ? 'Szukam…' : 'Pobierz z magazynu'
      )
    ),
  ];

  if (n.wariant) {
    const p = n.wariant;
    wiersze.push(
      h(
        'p',
        { class: 'form-nota', style: 'margin:6px 0 0' },
        `✓ ${p.nazwa} · ${p.rodzaj || ''} · ${p.gruboscMm} mm · płyta ` +
          `${liczba(p.plytaCm.dl)}×${liczba(p.plytaCm.gl)} cm · ` +
          `${zl(p.cenaBruttoM2)}/m² · dostępne ${liczba(p.dostepneM2)} m²`
      ),
      linkDoMagazynu(p.kod)
    );

    /*
     * Płyty z TEGO SAMEGO bloku (spójny wzór) — z tabeli na karcie płyty
     * w Interstone. Pozycje zarezerwowane odpadają już w workerze.
     * Klik przełącza wycenę na wskazaną płytę.
     */
    const bl = p.blokPlyty;
    if (bl && bl.plyty.length > 1) {
      const wlasny = (String(p.kod || '').match(/(\d+)\s*$/) || [])[1];
      const stonCzesc = (String(p.kod || '').match(/^[A-Za-z]+\d+/) || [''])[0];
      wiersze.push(
        h('div', { class: 'q-kicker', style: 'margin-top:12px' },
          `Płyty z tego samego bloku (razem ${liczba(bl.razemM2)} m²) — spójny wzór`),
        ...bl.plyty.map((b) =>
          h(
            'div',
            { class: 'od-odcinek', style: 'font-size:13px' },
            h(
              'span',
              { style: 'flex:1' },
              `${b.symbol}${String(b.symbol) === wlasny ? ' (wybrana)' : ''} · ` +
                `${b.wymiarCm ? `${b.wymiarCm.dl}×${b.wymiarCm.gl} cm · ` : ''}` +
                `${liczba(b.dostepneM2)} m²${b.magazyn ? ` · ${b.magazyn}` : ''}`
            ),
            h(
              'a',
              {
                class: 'link-btn',
                href: linkPlyty(String(b.symbol)),
                target: '_blank',
                rel: 'noopener',
                title: `Pokaż płytę ${stonCzesc}-${b.symbol} w magazynie Interstone`,
              },
              'magazyn ↗'
            ),
            String(b.symbol) !== wlasny && stonCzesc
              ? h(
                  'button',
                  {
                    class: 'link-btn', type: 'button',
                    onclick: () => { n.kod = `${stonCzesc}-${b.symbol}`; pobierzPlyte(box, stan, paczka); },
                  },
                  'Licz z tej płyty →'
                )
              : null
          )
        )
      );
    }
  } else if (n.komunikat) {
    wiersze.push(h('p', { class: 'form-blad', style: 'margin:6px 0 0' }, n.komunikat));
  }

  wiersze.push(
    h('div', { class: 'q-kicker', style: 'margin-top:14px' }, 'Cena ręczna (widzi tylko Dawid)'),
    h(
      'div',
      { class: 'od-siatka' },
      pole(
        n.wariant ? 'Cena materiału zł/m² (nadpisuje magazyn)' : 'Cena materiału zł/m² (brutto)',
        h('input', {
          type: 'number', inputmode: 'numeric', value: n.cenaM2 || '',
          placeholder: n.wariant ? String(n.wariant.cenaBruttoM2) : 'jak na interstone.pl',
          onchange: (e) => ((n.cenaM2 = Number(e.target.value) || 0), odswiez()),
        })
      ),
      n.wariant
        ? null
        : pole('Nazwa kamienia', h('input', {
            type: 'text', value: n.nazwa,
            onchange: (e) => ((n.nazwa = e.target.value), odswiez()),
          })),
      n.wariant
        ? null
        : pole('Płyta: długość (cm)', h('input', {
            type: 'number', inputmode: 'numeric', value: n.plytaDl,
            onchange: (e) => ((n.plytaDl = Number(e.target.value) || 0), odswiez()),
          })),
      n.wariant
        ? null
        : pole('Płyta: głębokość (cm)', h('input', {
            type: 'number', inputmode: 'numeric', value: n.plytaGl,
            onchange: (e) => ((n.plytaGl = Number(e.target.value) || 0), odswiez()),
          })),
      n.wariant
        ? null
        : pole('Grubość (mm)', h('input', {
            type: 'number', inputmode: 'numeric', value: n.grubosc,
            onchange: (e) => ((n.grubosc = String(Number(e.target.value) || 20)), odswiez()),
          }))
    )
  );

  return h('div', {}, ...wiersze);
}

/**
 * RĘCZNA CENA USŁUGI (zlecenie Dawida, 16.09.2026).
 *
 * „Chcę mieć możliwość zmiany ceny w każdej usłudze." Pole pokazuje cenę
 * z cennika, a Dawid może wpisać swoją — tylko w TEJ wycenie. Nadpisana
 * cena jest wyraźnie oznaczona i da się do cennikowej wrócić jednym
 * kliknięciem, żeby nikt nie musiał pamiętać, ile było.
 *
 * Wpisanie dokładnie ceny cennikowej kasuje nadpisanie — inaczej pozycja
 * zostałaby na zawsze „ręczna", choć kwota jest ta sama, i przy zmianie
 * stawek w panelu ta wycena po cichu trzymałaby stare pieniądze.
 */
function polaCeny(stan, pozycja, odswiez) {
  const cennikowa = Math.round(pozycja.brutto);
  const reczna = stan.ceny.has(pozycja.nazwa);
  const wartosc = cenyPoz.cenaPozycji(stan.ceny, pozycja);

  const wpis = h('input', {
    type: 'number',
    inputmode: 'numeric',
    min: '0',
    step: '1',
    class: 'cena-poz' + (reczna ? ' cena-reczna' : ''),
    value: String(wartosc),
    'aria-label': `Cena pozycji ${pozycja.nazwa} (brutto)`,
    title: reczna ? `Cena zmieniona ręcznie. W cenniku: ${zl(cennikowa)}` : 'Cena z cennika — można nadpisać',
    onchange: (e) => {
      cenyPoz.ustawCene(stan.ceny, pozycja, e.target.value);
      odswiez();
    },
  });

  return h(
    'span',
    { class: 'cena-blok' },
    wpis,
    h('span', { class: 'cena-zl' }, 'zł'),
    reczna
      ? h(
          'button',
          {
            class: 'link-btn cena-wroc',
            type: 'button',
            title: `Wróć do ceny z cennika (${zl(cennikowa)})`,
            onclick: () => (stan.ceny.delete(pozycja.nazwa), odswiez()),
          },
          '↺'
        )
      : null
  );
}

function podgladPozycji(stan, oferta, odswiez, w) {
  /*
   * Nadpisać można KAŻDĄ pozycję silnika — łącznie z tymi „w cenie"
   * (pomiar Prolinerem, docięcie), bo to właśnie ich ceny Dawid chce czasem
   * ustalić ręcznie. Własne pozycje mają swoją kwotę w bloku niżej.
   */
  const zSilnika = new Map((w?.pozycje || []).map((p) => [p.nazwa, p]));

  return h(
    'div',
    { class: 'oferta-pozycje' },
    // Krótka instrukcja nad listą: pola z kwotami wyglądają jak tekst,
    // dopóki się w nie nie kliknie — a Dawid szukał, gdzie zmienić cenę.
    h(
      'p',
      { class: 'form-nota', style: 'margin:0 0 6px' },
      'Każdą kwotę możesz nadpisać — kliknij w cenę i wpisz swoją. ' +
        'Puste pole wraca do ceny z cennika.'
    ),
    ...oferta.pozycje.map((p) =>
      h(
        'div',
        { class: 'oferta-poz' + (p.gratis ? ' gratis' : '') + (stan.ceny.has(p.nazwa) ? ' poz-reczna' : '') },
        h('span', {}, p.nazwa, p.detal ? h('small', {}, p.detal) : null),
        h(
          'span',
          { class: 'od-akcje-poz' },
          /*
           * Pole ceny dostaje każda pozycja silnika. Wyjątkiem jest wyzerowana
           * na GRATIS — tam kwoty nie ma z wyboru Dawida i najpierw trzeba
           * cofnąć zerowanie (przycisk obok), żeby nie było dwóch sprzecznych
           * decyzji naraz.
           */
          stan.gratisy.has(p.nazwa) || !zSilnika.has(p.nazwa)
            ? h('b', {}, p.gratis ? 'GRATIS' : zl(p.brutto))
            : polaCeny(stan, zSilnika.get(p.nazwa), odswiez),
          // przełącznik „gratis" tylko dla pozycji, które coś kosztują
          p.brutto > 0 || stan.gratisy.has(p.nazwa) || zSilnika.has(p.nazwa)
            ? h(
                'button',
                {
                  class: 'link-btn', type: 'button',
                  title: stan.gratisy.has(p.nazwa) ? 'Przywróć cenę' : 'Wyzeruj (gratis)',
                  onclick: () => {
                    stan.gratisy.has(p.nazwa) ? stan.gratisy.delete(p.nazwa) : stan.gratisy.add(p.nazwa);
                    odswiez();
                  },
                },
                stan.gratisy.has(p.nazwa) ? '↩' : '0 zł'
              )
            : null
        )
      )
    ),
    stan.ceny.size
      ? h(
          'p',
          { class: 'form-nota cena-nota', style: 'margin:8px 0 0' },
          `Ceny zmienione ręcznie: ${[...stan.ceny.keys()].join(', ')}. ` +
            'Dotyczy wyłącznie tej wyceny — cennik i stawki w panelu zostają bez zmian.'
        )
      : null,
    ...(oferta.noty || []).map((nota) =>
      h('p', { class: 'form-nota', style: 'margin:8px 0 0' }, nota)
    ),
    h(
      'div',
      { class: 'oferta-suma' },
      h('span', {}, 'Razem brutto dla klienta'),
      h(
        'span',
        {},
        oferta.razem < oferta.razemPrzed ? h('s', { class: 'oferta-stara' }, zl(oferta.razemPrzed)) : null,
        h('b', {}, zl(oferta.razem))
      )
    )
  );
}

/**
 * WŁASNE POZYCJE — usługi i dodatki dopisywane ręcznie (01.09.2026).
 *
 * Zlecenie Dawida: demontaż starego blatu, cokoły, dopłata ekspresowa.
 * Do tej pory takie rzeczy trzeba było chować w upuście albo w nadpisanej
 * kwocie — znikały wtedy z rozbicia i nie było po nich śladu ani w ofercie,
 * ani w mailu.
 *
 * Cena jest BRUTTO, tak jak wszędzie tam, gdzie Dawid wpisuje kwotę ręcznie.
 * Kwota wiersza to cena × ilość; suma wchodzi do oferty PRZED upustem,
 * więc upust procentowy obejmuje także dodatki.
 *
 * Przełącznik „praca / materiał" decyduje, po której stronie rozbicia kwota
 * wyląduje u klienta. Domyślnie praca, bo tak wygląda większość dodatków —
 * ale cokoły to materiał i Dawid przełącza je jednym kliknięciem.
 */
function blokWlasnychPozycji(stan, odswiez) {
  const lista = stan.wlasnePozycje;

  const wiersz = (poz, i) => {
    const brak = pozWlasne.czegoBrakuje(poz);
    const suma = pozWlasne.kwota(poz);

    return h(
      'div',
      { class: 'wlasna-poz' },
      h('input', {
        class: 'wp-nazwa',
        value: poz.nazwa,
        placeholder: 'np. demontaż starego blatu',
        'aria-label': 'Nazwa pozycji',
        oninput: (e) => {
          poz.nazwa = e.target.value;
          // Bez przerysowania: przepisywanie nazwy nie może gubić kursora.
          odswiezSume();
        },
      }),
      h('input', {
        class: 'wp-cena',
        type: 'number',
        step: '1',
        min: '0',
        value: String(poz.cena || ''),
        placeholder: 'cena',
        'aria-label': 'Cena brutto',
        oninput: (e) => {
          poz.cena = Number(e.target.value) || 0;
          odswiezSume();
        },
      }),
      h('span', { class: 'wp-znak' }, '×'),
      h('input', {
        class: 'wp-ilosc',
        type: 'number',
        step: '0.5',
        min: '0',
        value: String(poz.ilosc ?? 1),
        'aria-label': 'Ilość',
        oninput: (e) => {
          poz.ilosc = Number(e.target.value) || 0;
          odswiezSume();
        },
      }),
      wybor(
        pozWlasne.GRUPY.map((g) => [g.id, g.nazwa]),
        poz.grupa,
        (v) => ((poz.grupa = v), odswiez())
      ),
      h('b', { class: 'wp-suma' }, suma > 0 ? zl(suma) : '—'),
      h(
        'button',
        {
          class: 'link-btn',
          type: 'button',
          title: 'Usuń pozycję',
          onclick: () => (lista.splice(i, 1), odswiez()),
        },
        '✕'
      ),
      brak ? h('span', { class: 'wp-brak form-blad' }, brak) : null
    );
  };

  /*
   * Sumę i podgląd oferty przeliczamy dopiero na `change`/blur, a nie przy
   * każdym wciśniętym klawiszu: pełne przerysowanie edytora zabierałoby
   * kursor z pola w połowie wpisywania nazwy.
   */
  function odswiezSume() {
    clearTimeout(odswiezSume.t);
    odswiezSume.t = setTimeout(odswiez, 700);
  }

  return h(
    'div',
    { class: 'od-blok wlasne-pozycje' },
    h('div', { class: 'od-blok-tytul' }, 'Własne pozycje'),
    h(
      'p',
      { class: 'form-nota', style: 'margin:0 0 8px' },
      'Demontaż, cokoły, dopłata ekspresowa. Cena brutto za sztukę — ' +
        'klient zobaczy kwotę w „Pracach kamieniarskich" (albo w materiale, ' +
        'jeśli przełączysz), bez nazwy pozycji.'
    ),
    ...lista.map(wiersz),
    h(
      'button',
      {
        class: 'link-btn',
        type: 'button',
        onclick: () => (lista.push({ ...pozWlasne.PUSTA }), odswiez()),
      },
      '+ dodaj pozycję'
    ),
    pozWlasne.razem(lista) > 0
      ? h(
          'div',
          { class: 'wp-razem' },
          h('span', {}, 'Razem dodatki'),
          h('b', {}, zl(pozWlasne.razem(lista)))
        )
      : null
  );
}

/** Ten sam limit co w workerze (worker/rozmowa.js) — licznik ma nie kłamać. */
const MAKS_WIADOMOSCI = 2000;

/**
 * WIADOMOŚĆ DO KLIENTA (zlecenie Dawida z 24.08.2026).
 *
 * „Chciałbym móc przekazywać wiadomość klientowi wraz z wysłaniem nowej
 * oferty" — kilka zdań od siebie: co zmienił, czemu ta cena, co dalej.
 *
 * Pole NIE przeładowuje ekranu przy każdym znaku (żadnego `odswiez`
 * w `oninput`) — inaczej kursor skakałby na koniec po każdej literze.
 * Wartość ląduje w `stan` na bieżąco, a podgląd i tak czyta świeży stan.
 */
function blokWiadomosci(stan) {
  const pole = h('textarea', {
    class: 'od-wiadomosc',
    id: 'od-wiadomosc',
    rows: '4',
    maxlength: String(MAKS_WIADOMOSCI),
    placeholder:
      'Np. Dzień dobry, przygotowałem wycenę na płytę, o której rozmawialiśmy. '
      + 'Pomiar mam wolny w czwartek — dam znać, gdyby pasowało.',
  });
  pole.value = stan.wiadomosc || '';
  pole.addEventListener('input', () => {
    stan.wiadomosc = pole.value;
  });

  return h(
    'div',
    { class: 'od-pasek', style: 'margin-top:18px' },
    h('div', { class: 'q-kicker' }, 'Wiadomość od Ciebie (zobaczy ją klient)'),
    pole,
    h(
      'p',
      { class: 'form-nota' },
      'Kilka zdań od siebie — trafią do maila z ofertą i na stronę wyceny, nad kwotę. '
        + 'Puste pole = oferta bez dopisku. Zobaczysz to w podglądzie przed wysłaniem.'
    )
  );
}

/* ───────────────────────────────── płyta spoza cenników */

/**
 * FORMULARZ PŁYTY WŁASNEJ (zlecenie Dawida, 25.08.2026).
 *
 * Dwie rzeczy są tu oznaczone WPROST, bo w hurtowniach spotyka się obie
 * formy i pomyłka kosztuje realne pieniądze:
 *   • czy cena jest za m², czy za całą płytę,
 *   • czy jest netto, czy brutto.
 * Pod spodem pokazujemy przeliczenie na obie postaci — Dawid widzi od razu,
 * czy wpisał to, co miał na fakturze.
 */
function blokPlytyWlasnej(stan, odswiez) {
  const p = stan.wlasna;
  const ustaw = (pole) => (e) => {
    const v = e.target.value;
    p[pole] = ['szer', 'wys', 'cena'].includes(pole) ? Number(v) || 0 : v;
  };
  // Pola tekstowe/liczbowe przeliczamy przy WYJŚCIU z pola, nie przy każdym
  // znaku — inaczej ekran przebudowuje się w środku pisania (ta sama
  // pułapka co w rozrysie, patrz app/rozrys.js).
  const pole2 = (etykieta, kontrolka) => pole(etykieta, kontrolka);
  const wejscie = (klucz, atrybuty) => {
    const i = h('input', atrybuty);
    i.value = p[klucz] ?? '';
    i.addEventListener('input', ustaw(klucz));
    i.addEventListener('change', odswiez);
    return i;
  };

  const brutto = wlasna.cenaBruttoM2(p);
  const netto = wlasna.cenaNettoM2(p);
  const pole_m2 = wlasna.poleM2(p);

  return h(
    'div',
    { class: 'od-pasek', style: 'margin-top:4px' },
    h('div', { class: 'q-kicker' }, 'Płyta spoza cenników'),
    h(
      'div',
      { class: 'od-siatka' },
      pole2('Nazwa materiału', wejscie('nazwa', { type: 'text', placeholder: 'np. Dekton Aura 15' })),
      pole2('Nr płyty (opcjonalnie)', wejscie('nrPlyty', { type: 'text', placeholder: 'np. 24/118' })),
      pole2('Szerokość płyty (mm)', wejscie('szer', { type: 'number', min: '1' })),
      pole2('Wysokość płyty (mm)', wejscie('wys', { type: 'number', min: '1' })),
      pole2('Cena', wejscie('cena', { type: 'number', min: '0', step: '1' })),
      pole2(
        'Cena podana',
        wybor(wlasna.JEDNOSTKI, p.jednostka, (v) => ((p.jednostka = v), odswiez()))
      ),
      pole2(
        'Kwota jest',
        wybor(wlasna.FORMY_CENY, p.forma, (v) => ((p.forma = v), odswiez()))
      )
    ),
    h(
      'p',
      { class: 'form-nota' },
      pole_m2 > 0
        ? `Płyta ${liczba(pole_m2, 2)} m². ` +
          (brutto > 0
            ? `Cena materiału: ${zl(netto)}/m² netto = ${zl(brutto)}/m² brutto · ` +
              `cała płyta ${zl(brutto * pole_m2)} brutto.`
            : 'Podaj cenę, żeby zobaczyć przeliczenie.')
        : 'Podaj wymiar płyty.'
    ),
    h(
      'p',
      { class: 'form-nota' },
      'Liczymy PEŁNYMI płytami z podanego wymiaru — tak jak przy płycie ' +
        'z magazynu. Rozrys użyje tego samego formatu, a klient zobaczy nazwę ' +
        '(i numer płyty, jeśli wpisany).'
    )
  );
}

/* ────────────────────────────── warianty materiałowe do porównania */

/**
 * Firmy, z których można złożyć wariant.
 *
 * Bez kamienia naturalnego: tam cena wynika z KONKRETNEJ płyty w magazynie
 * (każda ma inny wymiar i inną cenę), więc wariantu nie da się złożyć
 * samym wyborem „materiału". Kamień naturalny nadaje się na ofertę
 * GŁÓWNĄ — i tam działa jak dotąd.
 */
const FIRMY_WARIANTOW = () => FIRMY.filter((f) => f.slug !== 'interstone');

/**
 * Cena wariantu: TEN SAM blat, ten sam silnik, inny materiał.
 *
 * Podmieniamy w stanie wyłącznie materiał i wołamy `policz` — dzięki temu
 * wymiary, otwory, montaż i stawki z panelu są gwarantowanie identyczne
 * jak w ofercie głównej. Inaczej porównanie by kłamało.
 */
function policzWariant(stan, wariant) {
  const w = policz({
    ...stan,
    firma: wariant.firma,
    dekor: wariant.dekor,
    grubosc: wariant.grubosc,
  });
  if (!w.ok) return { ok: false, blad: w.blad };
  return { ok: true, bazowa: Math.round(w.razemZaokr || w.razem), w };
}

/** Domyślny wariant: pierwsza firma inna niż główna, pierwszy dekor. */
function nowyWariant(stan) {
  const kandydaci = FIRMY_WARIANTOW();
  const uzyte = new Set([stan.firma, ...stan.warianty.map((w) => w.firma)]);
  const firma = kandydaci.find((f) => !uzyte.has(f.slug)) || kandydaci[0];
  const dekor = Object.keys(firma?.dekory || {})[0] || '';
  return {
    firma: firma?.slug || '',
    dekor,
    grubosc: (grubosciDekoru(firma, dekor) || [])[0] || '',
    upustTyp: 'dziedziczy',
    upustProc: 0,
  };
}

/**
 * WARIANTY DO PORÓWNANIA (zlecenie Dawida, 25.08.2026).
 *
 * „Jedną tę główną i 3x takie do porównania cen" — dobór jest w pełni
 * ręczny, bo to Dawid wie, co danemu klientowi warto pokazać obok siebie.
 * Cena każdego wariantu liczy się tym samym silnikiem co główna.
 */
function blokWariantow(stan, oferta, odswiez) {
  const upustGl = oferta ? upustGlownej(oferta) : 0;

  const wiersze = stan.warianty.map((wariant, i) => {
    const firma = firmaWgSlug(wariant.firma);
    const dekory = Object.keys(firma?.dekory || {});
    const grubosci = grubosciDekoru(firma, wariant.dekor) || [];
    const policzony = policzWariant(stan, wariant);
    const cena = policzony.ok ? cenaWariantu(policzony.bazowa, wariant, upustGl) : 0;
    const r = oferta && cena ? roznica(cena, oferta.razem) : null;

    return h(
      'div',
      { class: 'od-pasek wariant-wiersz' },
      h(
        'div',
        { class: 'od-siatka' },
        pole(
          'Materiał',
          wybor(
            FIRMY_WARIANTOW().map((f) => [f.slug, f.nazwa]),
            wariant.firma,
            (v) => {
              const nowa = firmaWgSlug(v);
              const d = Object.keys(nowa?.dekory || {})[0] || '';
              zmienWariant(stan, i, {
                firma: v,
                dekor: d,
                grubosc: (grubosciDekoru(nowa, d) || [])[0] || '',
              });
              odswiez();
            }
          )
        ),
        pole(
          'Dekor',
          wybor(dekory.map((d) => [d, d]), wariant.dekor, (v) => {
            zmienWariant(stan, i, {
              firma: wariant.firma,
              dekor: v,
              grubosc: (grubosciDekoru(firma, v) || [])[0] || '',
            });
            odswiez();
          })
        ),
        pole(
          'Grubość',
          wybor(grubosci.map((g) => [g, `${g} mm`]), wariant.grubosc, (v) => {
            zmienWariant(stan, i, { ...wariant, grubosc: v });
            odswiez();
          })
        ),
        pole(
          'Upust',
          wybor(TRYBY_UPUSTU, wariant.upustTyp, (v) => {
            zmienWariant(stan, i, { ...wariant, upustTyp: v });
            odswiez();
          })
        ),
        wariant.upustTyp === 'wlasny'
          ? pole(
              'Ile %',
              (() => {
                const inp = h('input', {
                  type: 'number', min: '0', max: '90', value: wariant.upustProc || 0,
                });
                // Wartość zapisujemy na bieżąco, a przeliczamy dopiero po
                // wyjściu z pola — inaczej ekran przebudowuje się w środku
                // pisania i wpisana liczba przepada (ta sama pułapka co
                // w rozrysie, patrz app/rozrys.js).
                inp.addEventListener('input', () => {
                  stan.warianty[i] = { ...stan.warianty[i], upustProc: Number(inp.value) || 0 };
                });
                inp.addEventListener('change', odswiez);
                return inp;
              })()
            )
          : null
      ),
      h(
        'div',
        { class: 'od-akcje-poz wariant-podsumowanie' },
        policzony.ok
          ? h(
              'span',
              {},
              h('b', {}, zl(cena)),
              h('span', { class: 'form-nota' }, ` · ${opisUpustu(wariant, upustGl)}`),
              r ? h('span', { class: 'form-nota' }, ` · ${r.opis} od głównej`) : null
            )
          : h('span', { class: 'form-blad' }, policzony.blad || 'Nie da się policzyć tego wariantu.'),
        h(
          'button',
          {
            class: 'link-btn', type: 'button', title: 'Usuń wariant',
            onclick: () => {
              stan.warianty = stan.warianty.filter((_, j) => j !== i);
              odswiez();
            },
          },
          '✕ usuń'
        )
      )
    );
  });

  return h(
    'div',
    { class: 'od-pasek', style: 'margin-top:18px' },
    h('div', { class: 'q-kicker' }, 'Warianty do porównania (widzi je klient)'),
    ...wiersze,
    stan.warianty.length < MAKS_WARIANTOW
      ? h(
          'button',
          {
            class: 'link-btn', type: 'button',
            onclick: () => {
              stan.warianty = [...stan.warianty, nowyWariant(stan)];
              odswiez();
            },
          },
          `+ dodaj wariant (${stan.warianty.length}/${MAKS_WARIANTOW})`
        )
      : h('span', { class: 'form-nota' }, `Komplet — ${MAKS_WARIANTOW} warianty to maksimum.`),
    h(
      'p',
      { class: 'form-nota' },
      'Ten sam blat i te same prace, inny kamień. Klient zobaczy samą kwotę łączną — ' +
        'bez rozbicia i bez rozrysu, który zostaje przy ofercie głównej. ' +
        'Kamień naturalny wyceniamy z konkretnej płyty, więc nadaje się na ofertę główną, nie na wariant.'
    )
  );
}

function zmienWariant(stan, i, zmiana) {
  stan.warianty = stan.warianty.map((w, j) => (i === j ? { ...w, ...zmiana } : w));
}

/**
 * Warianty zamrożone do oferty — czyli to, co pojedzie do klienta.
 * Niepoliczalne po cichu wypadają: lepiej pokazać dwa warianty niż trzy,
 * z czego jeden pusty.
 */
function zamrozWarianty(stan, oferta) {
  const upustGl = upustGlownej(oferta);
  return (stan.warianty || [])
    .map((wariant) => {
      const policzony = policzWariant(stan, wariant);
      if (!policzony.ok) return null;
      const firma = firmaWgSlug(wariant.firma);
      const bazowa = policzony.bazowa;
      const cena = cenaWariantu(bazowa, wariant, upustGl);
      return zamrozWariant({
        opis: [firma?.nazwa, wariant.dekor, wariant.grubosc ? `${wariant.grubosc} mm` : '']
          .filter(Boolean)
          .join(' · '),
        material: firma?.nazwa || '',
        typ: firma?.typ || '',
        razem: cena,
        razemPrzed: bazowa,
        stawkaVat: policzony.w?.stawkaVat ?? oferta.stawkaVat,
      });
    })
    .filter(Boolean);
}

function pasekWlasciciela(stan, oferta, odswiez) {
  return h(
    'div',
    { class: 'od-pasek' },
    h('div', { class: 'q-kicker' }, 'Upust / cena specjalna (widzi tylko Dawid)'),
    h(
      'div',
      { class: 'od-siatka' },
      pole(
        'Mechanizm',
        wybor(
          [
            ['brak', 'bez zmian'],
            ['procent', 'upust %'],
            ['kwota', 'upust kwotowy (zł)'],
            ['nadpisz', 'nadpisz cenę końcową (zł)'],
          ],
          stan.korektaTyp,
          (v) => ((stan.korektaTyp = v), odswiez())
        )
      ),
      stan.korektaTyp !== 'brak'
        ? pole(
            stan.korektaTyp === 'procent' ? 'Ile %' : 'Kwota (zł)',
            h('input', {
              type: 'number', inputmode: 'numeric', value: stan.korektaWartosc || '',
              onchange: (e) => ((stan.korektaWartosc = Number(e.target.value)), odswiez()),
            })
          )
        : null
    ),
    h(
      'label',
      { class: 'switch zgoda', style: 'margin-top:10px' },
      h('input', {
        type: 'checkbox',
        checked: stan.przekresl ? 'checked' : undefined,
        onchange: (e) => (stan.przekresl = e.target.checked),
      }),
      h('span', { class: 'box' }, '✓'),
      h(
        'span',
        { class: 'zgoda-txt' },
        'Pokaż klientowi obniżkę: przekreślona stara cena obok nowej — w mailu i na stronie wyceny. ' +
          'Bez zaznaczenia klient widzi tylko kwotę końcową.'
      )
    )
  );
}

function notaTestowa() {
  return h(
    'div',
    { class: 'od-pasek', style: 'margin-top:18px' },
    h('b', {}, 'Wycena testowa. '),
    'Nic nie idzie do klienta i nic nie ląduje w bazie — to podgląd skutków ' +
      'aktualnych stawek. Żeby wysłać ofertę, otwórz „Powtórz wycenę" ' +
      'przy konkretnym kliencie w panelu.'
  );
}

/**
 * PRZED WYSYŁKĄ — PODGLĄD (decyzja Dawida, 21.08.2026).
 *
 * Żadnego cichego wysyłania: przycisk prowadzi najpierw do ekranu z tym,
 * co dostanie klient — kartą wyceny online (ten sam renderer co strona
 * /oferta, więc bez cen jednostkowych i z ewentualną obniżką) oraz
 * TREŚCIĄ MAILA prosto z workera, czyli dokładnie tą, która pójdzie.
 * Dopiero „Wyślij do klienta" cokolwiek zapisuje i wysyła.
 */
function wysylka(stan, oferta, paczka, box) {
  const wynik = h('div', { class: 'form-blad', hidden: true, role: 'alert' });
  const przycisk = h('button', { class: 'btn', type: 'button' }, 'Pokaż podgląd →');

  // Przełącznik obniżki mógł się zmienić po ostatnim rysowaniu — zamrażamy
  // dokładnie to, co pójdzie do klienta, i tego samego używa podgląd.
  // Uwaga: `oferta` została zamrożona przy rysowaniu ekranu, a przełącznik
  // obniżki i pole wiadomości zmieniają się BEZ przerysowania. Dlatego oba
  // dobieramy tu na świeżo ze `stan` — inaczej do klienta poszłaby wersja
  // sprzed ostatniego kliknięcia (a dopisek byłby pusty).
  const swieza = () => ({
    ...oferta,
    przekresl: !!stan.przekresl && oferta.razem < oferta.razemPrzed,
    wiadomosc: String(stan.wiadomosc || '').trim().slice(0, MAKS_WIADOMOSCI),
  });

  przycisk.addEventListener('click', async () => {
    przycisk.disabled = true;
    przycisk.textContent = 'Przygotowuję podgląd…';
    wynik.hidden = true;
    try {
      // Do podglądu i do wysyłki idzie DOKŁADNIE ten sam obiekt — inaczej
      // „podgląd" przestaje być podglądem.
      const doWyslania = swieza();
      const dane = await doWorkera(paczka, doWyslania, { podglad: true });
      pokazPodglad(stan, doWyslania, paczka, box, dane);
    } catch (e) {
      przycisk.disabled = false;
      przycisk.textContent = 'Pokaż podgląd →';
      wynik.textContent = opisBledu(e);
      wynik.hidden = false;
    }
  });

  return h(
    'div',
    { class: 'nav', style: 'margin-top:18px; flex-wrap:wrap' },
    przycisk,
    h('span', { class: 'form-nota' }, 'Najpierw zobaczysz, co dostanie klient — mail wychodzi dopiero po potwierdzeniu.'),
    wynik
  );
}

/**
 * ROZRYS PŁYT — osobny ekran, nie część oferty.
 *
 * Klient go nie dostaje: to narzędzie warsztatowe, które odpowiada na
 * pytanie „ile płyt naprawdę trzeba zamówić i czy to się mieści".
 */
function przyciskRozrysu(stan, w, paczka, box) {
  const btn = h('button', { class: 'btn cichy', type: 'button' }, 'Rozrys płyt →');
  btn.addEventListener('click', () => pokazRozrys(stan, w, paczka, box));
  return btn;
}

/**
 * ROZRYS ZGODNY Z WYCENĄ (bug od Dawida, 25.08.2026).
 *
 * „Jak zmienię wymiar płyty albo dodam element, to później w rozrysie tego
 * nie widać" — bo `stan.rozrys` powstawał RAZ i już nigdy się nie
 * odświeżał. Dawid zmieniał długość blatu w wycenie, wracał do rozrysu
 * i oglądał starą migawkę. Co gorsza, ta sama stara migawka poszłaby
 * do klienta — `zamrozRozrys` też z niej korzysta.
 *
 * Trzymamy więc przy rozrysie PODPIS wymiarów, z których powstał. Gdy
 * wycena się zmieni, elementy liczymy od nowa; ustawienia cięcia (rzaz,
 * margines, usłojenie) zostają, bo to preferencje warsztatu, a nie
 * pochodna wymiarów.
 *
 * O fakcie przeliczenia zostawiamy ślad w `stan.rozrysPrzeliczony`, a nie
 * w wartości zwracanej: unieważnienie wypada zwykle przy przerysowaniu
 * WYCENY (idąc przez ścieżkę wysyłki), czyli na długo przed tym, jak Dawid
 * otworzy rozrys. Flaga czeka do otwarcia i dopiero tam się melduje —
 * inaczej ręcznie dodane elementy znikałyby bez słowa.
 */
function zapewnijRozrys(stan) {
  const podpis = podpisWyceny(stan.odcinki);
  if (stan.rozrys && stan.rozrys.zrodlo === podpis) return;

  const poprzedni = stan.rozrys;
  stan.rozrys = {
    elementy: elementyZOdcinkow(stan.odcinki),
    rzaz: poprzedni?.rzaz ?? stan.stawki?.rzazMm ?? DOMYSLNE.rzazMm,
    margines: poprzedni?.margines ?? stan.stawki?.marginesPlytyMm ?? DOMYSLNE.marginesPlytyMm,
    // Kamień naturalny domyślnie BEZ obrotu — rysunek musi biec zgodnie.
    rotacja: poprzedni?.rotacja ?? stan.firma !== NATURALNY,
    zrodlo: podpis,
  };
  if (poprzedni) stan.rozrysPrzeliczony = true;
}

function pokazRozrys(stan, w, paczka, box) {
  zapewnijRozrys(stan);
  // Flaga jest jednorazowa: po pokazaniu komunikatu gasimy ją, żeby nie
  // straszyła przy każdym kolejnym wejściu w rozrys.
  const przeliczono = !!stan.rozrysPrzeliczony;
  stan.rozrysPrzeliczony = false;

  const widok = widokRozrysu(
    {
      ...stan.rozrys,
      plyta: plytaDoRozrysu(stan, w),
      polowkaDozwolona: polowkaZRozkroju(w),
      plytZWyceny: w.pak?.plytyPelne ?? 0,
      polowkaZWyceny: !!w.pak?.polowka,
      opisMaterialu: [w.firma?.nazwa, w.dekor].filter(Boolean).join(' · '),
    },
    // Sam widok dba o przerysowanie swoich wyników — tutaj tylko zapisujemy
    // zmianę w stanie, żeby przetrwała powrót do wyceny i wysyłkę.
    (zmiana) => {
      stan.rozrys = { ...stan.rozrys, ...zmiana };
    }
  );

  box.replaceChildren(
    h(
      'div',
      { class: 'karta-wyceny' },
      przeliczono
        ? h(
            'div',
            { class: 'info' },
            'Wymiary blatu w wycenie się zmieniły, więc elementy zostały policzone od nowa. ' +
              'Ustawienia cięcia zostały bez zmian.'
          )
        : null,
      widok,
      h(
        'div',
        { class: 'nav rozrys-nav', style: 'margin-top:18px; flex-wrap:wrap' },
        h('button', { class: 'btn', type: 'button', onclick: () => window.print() }, 'Drukuj / zapisz PDF'),
        h('button', { class: 'btn cichy', type: 'button', onclick: () => rysuj(box, stan, paczka) }, '← Wróć do wyceny')
      )
    )
  );
  box.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Format płyty w MILIMETRACH. Przy kamieniu naturalnym bierzemy wymiar
 * WSKAZANEJ płyty z magazynu (każda jest inna), przy kolekcjach — format
 * z cennika firmy.
 */
/**
 * Format płyty do rozrysu i na kartę wyceny.
 *
 * ⚠ BIERZEMY `w.plyta`, CZYLI FORMAT, Z KTÓREGO SILNIK NAPRAWDĘ LICZYŁ —
 * nie `w.firma.plyta`, czyli domyślny format firmy.
 *
 * To nie są te same liczby. Pierwszeństwo ma format kampanii, potem format
 * przypisany do pozycji cennika (Atlas Plan tnie 20 mm z płyt 324×159,
 * a 12 mm z 324×162; każda płyta z wyprzedaży ma własny wymiar z magazynu).
 * Silnik rozstrzyga to raz i oddaje wynik w `w.plyta` — patrz engine/wycena.js.
 *
 * ⚠ Zgłoszenie Dawida (01.09.2026): w „Powtórz wycenę" przy płycie
 * z wyprzedaży rozrys pokazywał 300×180, choć jego płyta ma 320×160.
 * Pseudo-firma „NATURA WYPRZEDAŻ" nie ustawia formatu na swoim poziomie
 * (bo każda płyta ma inny), więc `firma.plyta` schodziło do domyślnej stałej
 * 300×180 z `_domyslne.js`. Kalkulator klienta miał to naprawione od 30.08,
 * edytor właściciela — nie.
 *
 * Ten sam błąd dotyczyłby formatek poprodukcyjnych: przy płycie 137×64
 * rozrys rysowałby pełnowymiarową taflę i pokazywał odpad, którego nie ma.
 */
function plytaDoRozrysu(stan, w) {
  const zWariantu = stan.firma === NATURALNY ? stan.nat.wariant?.plytaCm : null;
  if (zWariantu?.dl > 0) {
    return { szer: Math.round(zWariantu.dl * 10), wys: Math.round(zWariantu.gl * 10) };
  }
  const p = w.plyta || w.firma?.plyta || {};
  return { szer: Math.round((p.w || 320) * 10), wys: Math.round((p.h || 160) * 10) };
}

/**
 * Czy z tej płyty można kupić połówkę — z TEGO SAMEGO formatu, co rozrys.
 *
 * Osobna funkcja, bo pytanie zadajemy w dwóch miejscach (rysunek dla Dawida
 * i widok dla klienta), a rozjechanie się ich dawałoby rysunek niezgodny
 * z kwotą. Przy wyprzedaży odpowiedź brzmi „nie": resztka z placu jest jedna
 * i cała, a domyślny format firmowy potrafił tu skłamać „tak".
 */
function polowkaZRozkroju(w) {
  return (w.plyta || w.firma?.plyta)?.polowkaDozwolona === true;
}

/** Jedno wejście do workera: podgląd i wysyłka różnią się jedną flagą. */
async function doWorkera(paczka, oferta, opcje = {}) {
  const { podglad = false } = opcje;
  const odp = await fetch(`${API_BASE}/oferta/wyslij`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      leadId: paczka.leadId,
      exp: paczka.exp,
      podpis: paczka.podpis,
      oferta,
      podglad,
      // Pusty wątek = nowa oferta z nowym linkiem.
      watek: opcje.watek || '',
      powiadom: !!opcje.powiadom,
    }),
  });
  const dane = await odp.json().catch(() => null);
  if (!odp.ok || !dane?.ok) throw new Error(dane?.error || 'Błąd wysyłki.');
  return dane;
}

const opisBledu = (e) =>
  (e?.message === 'Brak autoryzacji.'
    ? 'Link z panelu wygasł — wejdź w kartę i kliknij „Powtórz wycenę" jeszcze raz. '
    : '') + 'Nie udało się: ' + (e?.message || 'błąd sieci');

function pokazPodglad(stan, oferta, paczka, box, dane) {
  const wynik = h('div', { class: 'form-blad', hidden: true, role: 'alert' });
  /*
   * DWIE DROGI PUBLIKACJI (zlecenie Dawida, 25.08.2026).
   *
   * Gdy oferta ma już wątek (Dawid wszedł przez „Aktualizuj ofertę"),
   * domyślną akcją jest AKTUALIZACJA POD TYM SAMYM LINKIEM — klient
   * odświeża stronę i widzi nową kwotę, bez piątego linku w skrzynce.
   * Druga droga zostaje: nowa oferta z nowym linkiem.
   */
  const maWatek = !!paczka.watek;
  /*
   * KARTA BEZ ADRESU E-MAIL (zgłoszenie Dawida, 16.09.2026).
   * Wycena ma się ZAPISAĆ tak samo jak zawsze — nie ma tylko dokąd wysłać
   * maila. Zamiast blokować przycisk, zmieniamy jego treść: to ta sama
   * operacja, tylko bez listu.
   */
  const brakMaila = !!dane.brakMaila || !dane.adres;

  const powiadomienie = h('input', {
    type: 'checkbox',
    checked: stan.powiadomOAktualizacji ? 'checked' : undefined,
  });
  powiadomienie.addEventListener('change', () => {
    stan.powiadomOAktualizacji = powiadomienie.checked;
  });

  const napisGlowny = brakMaila
    ? maWatek
      ? 'Zapisz nową wersję w karcie →'
      : 'Zapisz wycenę w karcie →'
    : maWatek
      ? 'Zaktualizuj ofertę (ten sam link) →'
      : 'Wyślij do klienta →';
  const wyslij = h('button', { class: 'btn', type: 'button' }, napisGlowny);
  const jakoNowa = maWatek
    ? h(
        'button',
        { class: 'btn cichy', type: 'button' },
        brakMaila ? 'Zapisz jako nową ofertę' : 'Wyślij jako nową ofertę'
      )
    : null;
  const wroc = h('button', { class: 'btn cichy', type: 'button' }, '← Wróć do edycji');

  wroc.addEventListener('click', () => rysuj(box, stan, paczka));

  wyslij.addEventListener('click', async () => {
    wyslij.disabled = true;
    wroc.disabled = true;
    wyslij.textContent = 'Wysyłam…';
    try {
      // `oferta` jest tu już wersją pokazaną w podglądzie — wysyłamy ją
      // bez zmian, żeby klient dostał to, co Dawid przed chwilą zatwierdził.
      const odp = await doWorkera(paczka, oferta, {
        watek: paczka.watek || '',
        powiadom: !!stan.powiadomOAktualizacji,
      });
      pokazWyslane(box, odp);
    } catch (e) {
      wyslij.disabled = false;
      wroc.disabled = false;
      wyslij.textContent = napisGlowny;
      wynik.textContent = opisBledu(e);
      wynik.hidden = false;
    }
  });

  if (jakoNowa) {
    jakoNowa.addEventListener('click', async () => {
      jakoNowa.disabled = true;
      wyslij.disabled = true;
      jakoNowa.textContent = 'Wysyłam…';
      try {
        // Bez wątku = osobna oferta z własnym, nowym linkiem.
        pokazWyslane(box, await doWorkera(paczka, oferta, { watek: '' }));
      } catch (e) {
        jakoNowa.disabled = false;
        wyslij.disabled = false;
        jakoNowa.textContent = brakMaila ? 'Zapisz jako nową ofertę' : 'Wyślij jako nową ofertę';
        wynik.textContent = opisBledu(e);
        wynik.hidden = false;
      }
    });
  }

  // Mail pokazujemy w ramce z atrybutem `srcdoc` — to ten sam HTML, który
  // dostanie klient, więc nie chcemy, żeby jego style rozlały się na panel.
  const ramka = h('iframe', {
    class: 'podglad-mail',
    title: 'Podgląd maila do klienta',
    srcdoc: dane.html || '',
    loading: 'lazy',
  });

  box.replaceChildren(
    h(
      'div',
      { class: 'karta-wyceny' },
      h('div', { class: 'q-kicker' }, 'Podgląd — to zobaczy klient'),
      h('h3', { class: 'q-title' }, 'Sprawdź przed wysłaniem'),
      h(
        'p',
        { class: brakMaila ? 'q-hint bez-maila' : 'q-hint' },
        brakMaila
          ? 'Karta nie ma adresu e-mail — wycena zapisze się w karcie i dostanie link, ' +
            'ale mail nie pójdzie. Adres można dopisać na karcie w panelu i wysłać później.'
          : `Mail pójdzie na ${dane.adres} — temat: „${dane.temat || ''}".`
      ),

      h(
        'div',
        { class: 'q-kicker', style: 'margin-top:16px' },
        brakMaila ? '1 · Treść maila (na razie tylko do wglądu)' : '1 · Treść maila'
      ),
      ramka,

      h('div', { class: 'q-kicker', style: 'margin-top:18px' }, '2 · Strona wyceny online (spod linku w mailu)'),
      // W podglądzie pokazujemy też przycisk wyboru wariantu — Dawid ma
      // widzieć dokładnie ten ekran co klient. Klik tylko nic nie wysyła.
      kartaOferty(oferta, {
        imie: paczka.imie,
        utworzono: Date.now(),
        naWybor: () => {},
      }),
      h(
        'p',
        { class: 'form-nota' },
        'Pod wyceną klient ma jeszcze trzy przyciski: „Pasuje mi", „Cena za wysoka", ' +
          '„Muszę się zastanowić" — odpowiedź trafia do jego karty w panelu. ' +
          'Niżej może też napisać wiadomość — przyjdzie do Ciebie mailem, ' +
          'a odpiszesz z karty klienta w panelu.'
      ),

      maWatek && !brakMaila
        ? h(
            'label',
            { class: 'switch zgoda', style: 'margin-top:14px' },
            powiadomienie,
            h('span', { class: 'box' }, '✓'),
            h(
              'span',
              { class: 'zgoda-txt' },
              'Wyślij klientowi maila o aktualizacji. Bez zaznaczenia nowa wersja ' +
                'po prostu pojawi się pod jego linkiem — przydatne, gdy rozmawiacie ' +
                'przez telefon i klient odświeża stronę.'
            )
          )
        : null,
      h('div', { class: 'nav', style: 'margin-top:18px; flex-wrap:wrap' }, wyslij, jakoNowa, wroc, wynik)
    )
  );
  box.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function pokazWyslane(box, dane) {
  box.replaceChildren(
    h(
      'div',
      { class: 'karta-wyceny' },
      h(
        'div',
        { class: 'bramka-ok' },
        h('span', { class: 'ptak' }, '✓'),
        h(
          'span',
          {},
          h('b', {}, dane.brakMaila ? 'Wycena zapisana. ' : 'Oferta wysłana. '),
          dane.mail
            ? 'Mail z wyceną poszedł do klienta, a wersja zapisała się w karcie.'
            : dane.brakMaila
              ? 'Wersja zapisała się w karcie. Maila nie wysłaliśmy — karta nie ma adresu e-mail. ' +
                'Link niżej możesz wysłać SMS-em albo podać przez telefon.'
              : 'Wersja zapisała się w karcie, ale mail nie wyszedł — spróbuj ponownie z panelu.'
        )
      ),
      h('p', { class: 'q-hint' }, 'Link do wyceny online (ten sam, który dostał klient):'),
      h('p', {}, h('a', { class: 'link-btn', href: dane.link, target: '_blank', rel: 'noopener' }, dane.link)),
      h('p', { class: 'q-hint' }, 'Status leada ustawiony na „Oferta wysłana" (chyba że był już dalej).')
    )
  );
}

/* ─────────────────────────────────────────────────────────── drobiazgi */

function pole(etykieta, kontrolka) {
  return h('div', { class: 'pole' }, h('label', {}, etykieta), kontrolka);
}

function wybor(pary, wartosc, onchange) {
  const sel = h(
    'select',
    { onchange: (e) => onchange(e.target.value) },
    ...pary.map(([v, t]) => h('option', { value: v, selected: v === String(wartosc) ? 'selected' : undefined }, t))
  );
  return sel;
}

function licznik(wartosc, min, onchange, max) {
  return h('input', {
    type: 'number',
    inputmode: 'numeric',
    min: String(min),
    ...(max != null ? { max: String(max) } : {}),
    value: liczba(wartosc ?? min),
    onchange: (e) => {
      const v = Math.max(min, Number(e.target.value) || min);
      onchange(max != null ? Math.min(v, max) : v);
    },
  });
}

/**
 * LINK DO PŁYTY W MAGAZYNIE — widzi go WYŁĄCZNIE Dawid.
 *
 * Na ofercie klienta tego nie ma i nie ma być: klient dostaje gotową cenę,
 * a nie wgląd w to, skąd bierzemy materiał.
 *
 * Obok linku stoi pełny kod do zaznaczenia, bo wyszukiwarka Interstone
 * na nietrafiony numer oddaje kilka przypadkowych płyt zamiast pustej
 * listy — po kodzie widać od razu, czy to ta płyta.
 */
function linkDoMagazynu(kod) {
  const url = linkPlyty(kod);
  if (!url) return null;
  return h(
    'p',
    { class: 'form-nota', style: 'margin:4px 0 0' },
    h(
      'a',
      { class: 'link-btn', href: url, target: '_blank', rel: 'noopener' },
      '↗ Pokaż tę płytę w magazynie'
    ),
    ' ',
    h('code', { style: 'user-select:all' }, String(kod))
  );
}

/* ──────────────────────────── podpowiedzi tańszych materiałów */

/**
 * TAŃSZE MATERIAŁY W PODOBNYM KOLORZE (zlecenie Dawida, 26.08.2026).
 *
 * „Za drogo" pada w połowie rozmów i do tej pory Dawid odpowiadał na to
 * z głowy — musiał pamiętać, który dekor w której kolekcji wygląda podobnie
 * i ile kosztuje przy TYM metrażu. Teraz liczy to silnik.
 *
 * Kandydatów przeliczamy CO DO JEDNEGO przez ten sam `policz`, co ofertę
 * główną — te same odcinki, otwory, montaż, stawki i upust. Dzięki temu
 * „−2 300 zł" jest kwotą, którą można powiedzieć klientowi przez telefon,
 * a nie szacunkiem z ceny za metr. Całość to ułamek sekundy.
 */
/*
 * Pamięć podręczna na jedno wejście w edytor.
 *
 * Edytor przerysowuje się po każdej zmianie pola, a 734 przeliczenia
 * to ok. 30 ms — przy wpisywaniu wymiarów byłoby to odczuwalne szarpanie.
 * Kandydaci zależą wyłącznie od wymiarów, opcji, grubości i stawek —
 * nie od wybranego materiału — więc wystarczy jeden zestaw na taki komplet.
 */
let pamiecKandydatow = { podpis: null, lista: [] };

function kandydaciNaPodpowiedz(stan) {
  const podpis = JSON.stringify({
    odcinki: stan.odcinki,
    opcje: stan.opcje,
    grubosc: stan.grubosc,
    stawki: stan.stawki,
  });
  if (pamiecKandydatow.podpis === podpis) return pamiecKandydatow.lista;

  const kandydaci = [];
  for (const firma of FIRMY_WARIANTOW()) {
    for (const dekor of Object.keys(firma.dekory || {})) {
      const grubosci = grubosciDekoru(firma, dekor);
      if (!grubosci.length) continue;
      // Trzymamy grubość oferty głównej, gdy dekor ją ma — inaczej
      // porównywalibyśmy blat 20 mm z blatem 12 mm i różnica w kwocie
      // brałaby się z grubości, nie z materiału.
      const grubosc = grubosci.includes(stan.grubosc) ? stan.grubosc : grubosci[0];
      const policzony = policzWariant(stan, { firma: firma.slug, dekor, grubosc });
      if (!policzony.ok) continue;
      kandydaci.push({
        firma: firma.slug,
        firmaNazwa: firma.nazwa,
        typ: firma.typ || '',
        dekor,
        grubosc,
        razem: policzony.bazowa,
        kolor: kolorDekoru(dekor, firma.slug),
      });
    }
  }

  pamiecKandydatow = { podpis, lista: kandydaci };
  return kandydaci;
}

function blokPodpowiedzi(stan, w, oferta, odswiez) {
  const cenaObecna = Number(oferta?.razem) || 0;
  if (!(cenaObecna > 0)) return null;

  const kolorGlowny =
    stan.firma === NATURALNY
      ? kolorDekoru(stan.nat.nazwa || '')
      : kolorDekoru(stan.dekor, stan.firma);

  const propozycje = tanszeAlternatywy({
    kolorGlowny,
    cenaObecna,
    kandydaci: kandydaciNaPodpowiedz(stan),
    // Nie podpowiadamy tego, co już jest na stole.
    pomijaj: [
      `${stan.firma}/${stan.dekor}`,
      ...stan.warianty.map((v) => `${v.firma}/${v.dekor}`),
    ],
  });

  if (!propozycje.length) return null;

  const pelno = stan.warianty.length >= MAKS_WARIANTOW;

  return h(
    'div',
    { class: 'od-blok' },
    h('div', { class: 'q-kicker' }, `Tańsze, podobne kolorystycznie (${nazwaTagu(kolorGlowny)})`),
    h(
      'p',
      { class: 'form-nota', style: 'margin:2px 0 8px' },
      'Ten sam blat, ten sam montaż — inny materiał. Kwoty przeliczone na tę wycenę.'
    ),
    ...propozycje.map((p) =>
      h(
        'div',
        { class: 'od-pasek', style: 'align-items:center' },
        h(
          'span',
          { style: 'flex:1' },
          h('b', {}, `${p.firmaNazwa} — ${p.dekor}`),
          h(
            'span',
            { class: 'form-nota', style: 'display:block' },
            `${p.grubosc} mm · ${p.typ} · ${p.dopasowanie} (${nazwaTagu(p.kolor)})`
          )
        ),
        h(
          'span',
          { style: 'text-align:right;white-space:nowrap;margin-right:10px' },
          h('b', {}, zl(p.razem)),
          h('span', { class: 'form-nota', style: 'display:block;color:#1d6b3a' }, `−${zl(p.oszczednosc)}`)
        ),
        pelno
          ? h('span', { class: 'form-nota' }, 'komplet wariantów')
          : h(
              'button',
              {
                class: 'link-btn',
                type: 'button',
                onclick: () => {
                  stan.warianty.push({
                    firma: p.firma,
                    dekor: p.dekor,
                    grubosc: p.grubosc,
                    upustTyp: 'dziedziczy',
                    upustProc: 0,
                  });
                  odswiez();
                },
              },
              'dodaj jako wariant →'
            )
      )
    )
  );
}

/* ─────────────────────────────────────── wszystkie dekory w promocji */

/**
 * PROMOCJE (dopisek Dawida, 26.08.2026): „żebym miał pokazane wszystkie
 * te z promocji".
 *
 * Sekcja składa się z tych samych kampanii, po których liczy silnik, więc
 * gaśnie sama nazajutrz po zakończeniu promocji i sama pokazuje nową, gdy
 * wgramy kolejny cennik. Nie ma tu żadnej listy przepisanej ręcznie.
 *
 * Kwoty są przeliczone na TĘ wycenę — te same odcinki, otwory i montaż —
 * więc „6 050 zł" można powiedzieć klientowi przez telefon. Wyjątkiem jest
 * kamień naturalny: tam cena zależy od konkretnej płyty w magazynie, więc
 * kwota jest ORIENTACYJNA i wprost tak podpisana, a zamiast „dodaj jako
 * wariant" prowadzimy Dawida do magazynu po realną sztukę.
 */
const PLYTA_NATURALNA_TYPOWA = { dl: 300, gl: 180 };

let pamiecPromocji = { podpis: null, lista: [] };

function pozycjePromocji(stan) {
  const podpis = JSON.stringify({
    odcinki: stan.odcinki,
    opcje: stan.opcje,
    grubosc: stan.grubosc,
    stawki: stan.stawki,
    firma: stan.firma,
    dekor: stan.dekor,
  });
  if (pamiecPromocji.podpis === podpis) return pamiecPromocji.lista;

  const kolorGlowny =
    stan.firma === NATURALNY
      ? kolorDekoru(stan.nat.nazwa || '')
      : kolorDekoru(stan.dekor, stan.firma);

  const zKolekcji = dekoryWPromocji(FIRMY_WARIANTOW(), stan.grubosc)
    .map((p) => {
      const policzony = policzWariant(stan, { firma: p.firma, dekor: p.dekor, grubosc: p.grubosc });
      if (!policzony.ok) return null;
      return { ...p, razem: policzony.bazowa, kolor: kolorDekoru(p.dekor, p.firma) };
    })
    .filter(Boolean);

  const naturalne = naturalneWPromocji(promocjaNaturalna)
    .map((p) => {
      const w = wycenWlasciciela(
        wariantReczny({
          nazwa: p.dekor,
          // Ceny promocyjne kamienia są NETTO, a `wariantReczny` przyjmuje brutto.
          cenaBruttoM2: p.cenaNettoM2 * (1 + wlasna.VAT_MATERIALU),
          plytaCm: PLYTA_NATURALNA_TYPOWA,
          gruboscMm: Number(p.grubosc),
        }),
        { odcinki: stan.odcinki.filter((o) => o.gl > 0 && o.dl > 0), opcje: stan.opcje, grubosc: p.grubosc }
      );
      if (!w.ok) return null;
      return {
        ...p,
        razem: Math.round(w.razemZaokr || w.razem),
        orientacyjna: true,
        kolor: kolorDekoru(p.dekor),
      };
    })
    .filter(Boolean);

  const lista = ulozPromocje(
    [...zKolekcji, ...naturalne].map((p) => ({
      ...p,
      podobnyKolor: odlegloscKoloru(kolorGlowny, p.kolor) <= PROG_PODOBNEGO_KOLORU,
      // Promocja bywa tylko na INNĄ grubość niż wyceniana (Keralini ma
      // letnie ceny wyłącznie na 12 mm przy blacie liczonym z 20 mm).
      // Kwota jest wtedy niższa także z tego powodu — mówimy o tym wprost,
      // bo inaczej różnica wyglądałaby na samą przecenę materiału.
      innaGrubosc: String(p.grubosc) !== String(stan.grubosc),
    }))
  );

  pamiecPromocji = { podpis, lista };
  return lista;
}

function blokPromocji(stan, oferta, odswiez) {
  const pozycje = pozycjePromocji(stan);
  if (!pozycje.length) return null;

  const cenaObecna = Number(oferta?.razem) || 0;
  const pelno = stan.warianty.length >= MAKS_WARIANTOW;
  const juzNaStole = new Set([
    `${stan.firma}/${stan.dekor}`,
    ...stan.warianty.map((v) => `${v.firma}/${v.dekor}`),
  ]);
  const podobnych = pozycje.filter((p) => p.podobnyKolor).length;

  /*
   * Rozwinięcie trzymamy w STANIE, nie w samym <details>. Kliknięcie
   * „dodaj jako wariant" przerysowuje edytor — bez tego lista zwijałaby
   * się po każdym dodaniu i Dawid musiałby jej szukać od nowa.
   */
  return h(
    'details',
    {
      class: 'od-blok promocje-blok',
      open: stan.promocjeOtwarte ? '' : null,
      ontoggle: (e) => {
        stan.promocjeOtwarte = e.target.open;
      },
    },
    h(
      'summary',
      { class: 'q-kicker', style: 'cursor:pointer' },
      `Wszystkie dekory w promocji (${pozycje.length})`,
      podobnych
        ? h('span', { class: 'form-nota' }, ` — w tym ${podobnych} w podobnym kolorze`)
        : null
    ),
    h(
      'p',
      { class: 'form-nota', style: 'margin:2px 0 8px' },
      'Kwoty przeliczone na tę wycenę. Na górze dekory w kolorze zbliżonym do wyboru klienta, dalej od najtańszych.'
    ),
    ...pozycje.map((p) => wierszPromocji(p, { cenaObecna, pelno, juzNaStole, stan, odswiez }))
  );
}

function wierszPromocji(p, { cenaObecna, pelno, juzNaStole, stan, odswiez }) {
  const roznicaKwoty = cenaObecna ? cenaObecna - p.razem : 0;
  const juz = juzNaStole.has(`${p.firma}/${p.dekor}`);

  return h(
    'div',
    { class: 'od-pasek', style: 'align-items:center' },
    h(
      'span',
      { style: 'flex:1' },
      h('span', { class: 'alt-promo' }, 'PROMOCJA'),
      ' ',
      h('b', {}, `${p.firmaNazwa} — ${p.dekor}`),
      h(
        'span',
        { class: 'form-nota', style: 'display:block' },
        `${p.grubosc} mm${p.innaGrubosc ? ' (inna niż w ofercie)' : ''}` +
          `${p.wykonczenie ? ` · ${p.wykonczenie}` : ''} · ${p.kampania} do ` +
          `${dataPl(p.doKiedy)}${p.podobnyKolor ? ' · podobny kolor' : ''}` +
          (p.orientacyjna ? ' · kwota orientacyjna — zależy od płyty z magazynu' : '')
      )
    ),
    h(
      'span',
      { style: 'text-align:right;white-space:nowrap;margin-right:10px' },
      h('b', {}, `${p.orientacyjna ? '~' : ''}${zl(p.razem)}`),
      roznicaKwoty > 0
        ? h('span', { class: 'form-nota', style: 'display:block;color:#1d6b3a' }, `−${zl(roznicaKwoty)}`)
        : h('span', { class: 'form-nota', style: 'display:block' }, `+${zl(-roznicaKwoty)}`)
    ),
    akcjaPromocji(p, { pelno, juz, stan, odswiez })
  );
}

/**
 * Kamienia naturalnego NIE DA SIĘ dodać jako wariant — jego cena wynika
 * z konkretnej płyty, a wariant zna tylko materiał. Zamiast martwego
 * przycisku dajemy link do magazynu zawężony do tego wzoru: stamtąd
 * Dawid bierze realną sztukę i wycenia ją normalną ścieżką.
 */
function akcjaPromocji(p, { pelno, juz, stan, odswiez }) {
  if (p.naturalny) {
    return h(
      'a',
      {
        class: 'link-btn',
        href: linkMagazynu({ fraza: p.dekor }),
        target: '_blank',
        rel: 'noopener',
      },
      'znajdź płytę ↗'
    );
  }
  if (juz) return h('span', { class: 'form-nota' }, 'już w ofercie');
  if (pelno) return h('span', { class: 'form-nota' }, 'komplet wariantów');
  return h(
    'button',
    {
      class: 'link-btn',
      type: 'button',
      onclick: () => {
        stan.warianty.push({
          firma: p.firma,
          dekor: p.dekor,
          grubosc: p.grubosc,
          upustTyp: 'dziedziczy',
          upustProc: 0,
        });
        odswiez();
      },
    },
    'dodaj jako wariant →'
  );
}

/** „2026-09-30" → „30.09.2026" — data w promocji ma być czytelna od razu. */
function dataPl(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : String(iso || '');
}

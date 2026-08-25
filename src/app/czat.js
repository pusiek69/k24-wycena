import { h } from './dom.js';
import { FIRMY, firmaWgSlug, gruboscDomyslna } from '../firms/index.js';
import { wycen } from '../engine/wycena.js';
import { bramkaWyceny, bramkaKontaktu } from './bramka.js';
import { zapytajKonsultanta, sprawdzMagazyn } from '../api.js';
import { wybierzWariant, wycenZMagazynu } from './wycena-naturalny.js';
import { normalizujKodPlyty, wariantZPlyty } from './plyta-kod.js';
import { zdarzenie } from '../analytics/zdarzenia.js';
import {
  odcinkiZParametrow,
  odczytajSzczegoly,
  odczytajWymiary,
  opcjeZParametrow,
  opcjeZeSzczegolow,
  przelozParametry,
  slugMaterialu,
  rozdziel,
} from './parametry.js';
import {
  pomocnikPomieszczenie,
  pomocnikRodzaj,
  pomocnikMaterial,
  pomocnikDekor,
  pomocnikWymiary,
  pomocnikSzczegoly,
  pomocnikPlyty,
  pomocnikKamien,
  kartaWybranejPlyty,
} from './pomocnicy.js';
import { rodzajMaterialu } from '../engine/alternatywy.js';

/**
 * ROZMOWA Z KONSULTANTEM
 *
 * Podział pracy:
 *   • konsultant (Cloudflare Worker) — prowadzi rozmowę, dobiera materiał
 *     i dekor, zbiera wymiary. Nie zna cen i nie podaje kwot.
 *   • kalkulator (tutaj) — liczy wycenę tym samym silnikiem co kreator.
 *   • bramka — kwota odsłania się dopiero po zostawieniu kontaktu.
 *
 * Konsultant odpowiada zwykłym tekstem, a gdy ma komplet danych, dokłada
 * polecenie w JSON-ie: {"action":"quote","params":{…},"message":"…"}
 * albo {"action":"lead","message":"…"} — wtedy pokazujemy formularz.
 */

const TEL = '796 991 128';

// Ogólny adres magazynu — do komunikatów, gdy nie znamy jeszcze wzoru.
const LINK_MAGAZYNU = 'https://www.interstone.pl/stan-magazynowy';

// Numer telefonu stoi tuż nad powitaniem (w wizytówce) i w nagłówku strony —
// powtarzanie go trzeci raz w pierwszym zdaniu rozmowy tylko rozpraszało.
const POWITANIE =
  'Dzień dobry, jestem asystentem Dawida Ząbka — pomogę dobrać materiał ' +
  'i policzyć orientacyjny koszt blatu. Z czego ma być blat?';

/** Nazwy kolekcji z promptu → pliki firm w aplikacji. */
export function uruchomCzat(root, akcje = {}) {
  const historia = [];
  let zajety = false;

  // Na jakim etapie jest klient — po tym wiemy, co mu podsunąć pod odpowiedzią.
  const stan = {
    pomieszczenie: null,
    rodzaj: null,
    material: null,
    dekor: null,
    wymiary: false,
    szczegoly: false,
    odcinki: [],
    opcje: {},
    // Ustawiane, gdy kamień naturalny czeka na wskazanie konkretnej płyty.
    wyborPlyty: null,
    kodPlyty: null,
    nazwaKamienia: null,
    // Kod podany, zanim znaliśmy nazwę wzoru — czeka na sprawdzenie.
    kodOczekujacy: null,
    szukamPlyt: false,
  };

  const rozmowa = h('div', { class: 'czat', 'aria-live': 'polite' });
  const pole = h('textarea', {
    class: 'czat-pole',
    rows: '1',
    placeholder: 'Napisz wiadomość…',
    'aria-label': 'Twoja wiadomość',
  });
  const wyslijBtn = h('button', { class: 'btn czat-wyslij', type: 'submit' }, 'Wyślij');
  const formularz = h('form', { class: 'czat-wejscie' }, pole, wyslijBtn);

  formularz.addEventListener('submit', (e) => {
    e.preventDefault();
    wyslij(pole.value);
  });
  pole.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      wyslij(pole.value);
    }
  });
  pole.addEventListener('input', () => {
    pole.style.height = 'auto';
    pole.style.height = Math.min(pole.scrollHeight, 140) + 'px';
  });

  root.replaceChildren(wizytowka(), rozmowa, formularz);
  dodajWiadomosc('konsultant', POWITANIE);
  historia.push({ rola: 'assistant', tresc: POWITANIE });
  odswiezPomocnika();

  /* --------------------------------------------------------------- ruch */

  async function wyslij(tekst) {
    const tresc = String(tekst || '').trim();
    if (!tresc || zajety) return;

    rozmowa.querySelector('.pomocnik')?.remove();
    pole.value = '';
    pole.style.height = 'auto';

    dodajWiadomosc('klient', tresc);
    historia.push({ rola: 'user', tresc });
    if (historia.filter((w) => w.rola === 'user').length === 1) zdarzenie('czat_start');

    await odpowiedzKonsultanta();
  }

  async function odpowiedzKonsultanta() {
    zajety = true;
    wyslijBtn.disabled = true;
    const pisze = wskaznikPisania();
    rozmowa.append(pisze);
    przewin();

    try {
      const surowa = await zapytajKonsultanta(
        historia.map((w) => ({ role: w.rola === 'assistant' ? 'assistant' : 'user', content: w.tresc }))
      );
      pisze.remove();

      const { tekst, akcja } = rozdziel(surowa);
      if (tekst) {
        dodajWiadomosc('konsultant', tekst);
        historia.push({ rola: 'assistant', tresc: tekst });
      }

      // `await` jest tu istotne: wycena kamienia naturalnego dopytuje magazyn,
      // a bez czekania `finally` zdążyłoby podsunąć pomocnika przed bramką.
      if (akcja?.action === 'quote') await policzWycene(akcja.params);
      else if (akcja?.action === 'lead') pokazBramke(null);
    } catch (e) {
      pisze.remove();
      // Konsultant nie odpowiada — jeśli klient zdążył wszystko wyklikać,
      // liczymy sami. Nikt nie może utknąć w połowie drogi.
      if (!zapasowaWycena()) dodajBlad(e?.status);
    } finally {
      zajety = false;
      wyslijBtn.disabled = false;
      odswiezPomocnika();
      przewin();
    }
  }

  /* ------------------------------------------------------------- wycena */

  async function policzWycene(params) {
    // Pomieszczenie decyduje o płycie grzewczej i o tym, czy odbiór własny
    // jest w ogóle możliwy. Konsultant ma je podawać, ale gdy zapomni —
    // a klient przeszedł kreatorem — bierzemy je stąd, zamiast zgadywać.
    params = { ...(params || {}) };
    if (!params.pomieszczenie && stan.pomieszczenie) params.pomieszczenie = stan.pomieszczenie;
    else if (params.pomieszczenie && !stan.pomieszczenie) stan.pomieszczenie = params.pomieszczenie;

    // Kamień naturalny: cenę i wymiar płyty bierzemy z magazynu na żywo.
    if (slugMaterialu(params?.material) === 'interstone') {
      if (await wycenaZMagazynu(params)) return;
      dodajWiadomosc(
        'konsultant',
        'Tej płyty nie widzę teraz w magazynie, więc wolę nie podawać ceny na wyrost. ' +
          `Dawid sprawdzi dostępność i wyceni osobiście — proszę o kontakt albo telefon: ${TEL}.`
      );
      pokazBramke(null);
      return;
    }

    const wybor = przelozParametry(params);
    if (!wybor) {
      dodajWiadomosc(
        'konsultant',
        `Przy tym materiale wycenę przygotowuje osobiście Dawid Ząbek — proszę o telefon: ${TEL}.`
      );
      pokazBramke(null);
      return;
    }

    const firma = firmaWgSlug(wybor.slug);
    if (!firma) {
      // Marka spoza naszych cenników (Dekton, Neolith…). Kalkulator jej nie
      // policzy, ale klient ma usłyszeć konkret, a nie zobaczyć samego formularza.
      dodajWiadomosc(
        'konsultant',
        `Przy tym materiale wycenę przygotowuje osobiście Dawid Ząbek — proszę o telefon: ${TEL}.`
      );
      return pokazBramke(null);
    }

    const w = wycen(firma, wybor.dane);
    if (!w.ok) {
      // Wzór po wygasłej promocji: nie ma czego doprecyzowywać, jest za to
      // konkretna sprawa dla Dawida — pokazujemy formularz kontaktowy.
      if (w.wycenaIndywidualna) {
        dodajWiadomosc('konsultant', `${w.blad} Proszę zostawić kontakt — odezwiemy się z ceną.`);
        pokazBramke(null);
        return;
      }
      dodajWiadomosc('konsultant', 'Potrzebuję jeszcze doprecyzować wymiary. ' + w.blad);
      return;
    }

    // Kwota NIE pojawia się w rozmowie — odsłania ją bramka po kontakcie.
    stan.szczegoly = true;
    rozmowa.querySelector('.pomocnik')?.remove();
    rozmowa.append(bramkaWyceny(w, { transkrypcja }));
    przewin();
  }

  /**
   * Wstępna wycena kamienia naturalnego.
   *
   * Konsultant podaje wyłącznie NAZWĘ kamienia — cenę m² i wymiar płyty
   * pobieramy sami z magazynu. Gdyby liczby przepisywał model, wystarczyłaby
   * jedna pomyłka w cyfrze, żeby klient dostał mailem złą kwotę.
   *
   * Zwraca true, gdy udało się policzyć i pokazać bramkę.
   */
  async function wycenaZMagazynu(params) {
    const nazwa = String(params?.kamien || params?.dekor || '').trim();
    const odcinki = odcinkiZParametrow(params);
    if (!nazwa || !odcinki.length) return false;

    /*
     * Kamień naturalny liczymy WYŁĄCZNIE ze wskazanej płyty (decyzja Dawida,
     * 17.08.2026). Każdy blok ma własną cenę i wymiar, więc „wstępna" wycena
     * z metra systematycznie zaniżała kwotę. Bez kodu pokazujemy klientowi
     * listę płyt do wyboru zamiast liczyć cokolwiek.
     */
    const kod = normalizujKodPlyty(params?.kod_plyty || stan.kodPlyty);
    const odp = await sprawdzMagazyn(nazwa, kod || undefined);
    if (!odp.ok) return false;

    if (!kod || !odp.plyta) {
      pokazWyborPlyty(nazwa, odp, params, kod);
      return true;
    }

    stan.kodPlyty = kod;
    stan.wyborPlyty = null;
    // Klient podał kod w rozmowie — pokazujemy, którą płytę tak naprawdę
    // wskazał, zanim zobaczy kwotę.
    rozmowa.append(kartaWybranejPlyty(odp.plyta, kod));
    // `/magazyn` oddaje surową płytę (formatCm) — wycena pracuje na wariancie
    // z `plytaCm`, gdzie dłuższy bok stoi pierwszy.
    const wariant = wariantZPlyty(odp.plyta);
    if (!wariant) return false;

    const w = wycenZMagazynu(wariant, {
      odcinki,
      opcje: opcjeZParametrow(params),
      grubosc: params.grubosc,
    });
    if (!w.ok) return false;

    stan.szczegoly = true;
    rozmowa.querySelector('.pomocnik')?.remove();
    rozmowa.append(bramkaWyceny(w, { transkrypcja }));
    zdarzenie('wycena_naturalny', { kamien: wariant.nazwa, kod });
    przewin();
    return true;
  }

  /**
   * Wybór płyty: lista konkretnych bloków z magazynu albo pole na kod.
   * Pokazujemy ją zamiast wyceny — świadomie, bo bez płyty nie ma ceny.
   */
  function pokazWyborPlyty(nazwa, odp, params, kod) {
    dodajWiadomosc('konsultant', komunikatKodu(odp.powodKodu, kod, odp));
    // Wybór płyty trzymamy w STANIE, a nie doklejamy do rozmowy: `finally`
    // w odpowiedzKonsultanta i tak odświeża pomocnika, więc doklejony element
    // zniknąłby ułamek sekundy po dodaniu.
    stan.wyborPlyty = { nazwa, plyty: odp.plyty };
  }

  /**
   * Krok kreatora: klient podał nazwę kamienia — odpytujemy magazyn
   * i pokazujemy konkretne płyty do wskazania.
   *
   * To jedyna droga do wyceny kamienia naturalnego, więc musi działać także
   * wtedy, gdy konsultant milczy albo prowadzi rozmowę własnym torem.
   */
  async function szukajPlyt(nazwa) {
    if (!nazwa) {
      // „Nie wiem jeszcze" — oddajemy pałeczkę konsultantowi.
      wyslij('Nie wiem jeszcze, jaki kamień naturalny — proszę o pomoc w doborze.');
      return;
    }

    stan.szukamPlyt = true;
    rozmowa.querySelector('.pomocnik')?.remove();
    dodajWiadomosc('klient', `Interesuje mnie ${nazwa}.`);
    historia.push({ rola: 'user', tresc: `Interesuje mnie ${nazwa}.` });
    const pisze = wskaznikPisania();
    rozmowa.append(pisze);
    przewin();

    let odp = { ok: false, plyty: [] };
    try {
      odp = await sprawdzMagazyn(nazwa);
    } catch {
      /* obsłużone niżej — brak płyt zachowuje się tak samo jak awaria */
    }
    pisze.remove();
    stan.szukamPlyt = false;

    const zKodem = (odp.plyty || []).filter(
      (p) => p.kod && p.dostepneM2 > 0 && p.cenaBruttoM2 > 0 && p.formatCm
    );
    /*
     * Pod jedną nazwą (np. „Calacatta") magazyn ma i naturalny marmur,
     * i spiek Laminam, i konglomerat InterQ. Klient jest tu, bo wybrał
     * KAMIEŃ NATURALNY, więc pokazujemy tylko jego — inaczej wskazałby
     * spiek i dostał wycenę materiału, o który nie prosił.
     */
    const naturalne = zKodem.filter((p) => /kamie/i.test(String(p.rodzaj || '')));
    const dostepne = naturalne.length ? naturalne : zKodem;

    if (!dostepne.length) {
      dodajWiadomosc(
        'konsultant',
        `Nie widzę teraz wolnych płyt pod nazwą „${nazwa}". Proszę spróbować samą nazwą własną wzoru ` +
          `albo napisać, jaki efekt ma dać blat — dobierzemy kamień. Można też zadzwonić: ${TEL}.`
      );
      historia.push({ rola: 'assistant', tresc: `Brak wolnych płyt „${nazwa}".` });
      odswiezPomocnika();
      przewin();
      return;
    }

    // Klient podał wcześniej kod bez nazwy — teraz mamy czego szukać.
    if (stan.kodOczekujacy) {
      const kod = stan.kodOczekujacy;
      const trafiona = dostepne.find((p) => normalizujKodPlyty(p.kod) === kod);
      stan.kodOczekujacy = null;
      if (trafiona) {
        stan.nazwaKamienia = nazwa;
        stan.dekor = nazwa;
        stan.kodPlyty = kod;
        rozmowa.append(kartaWybranejPlyty(trafiona, kod));
        wyslij(`Wybieram płytę ${kod} — ${nazwa}.`);
        return;
      }
      dodajWiadomosc(
        'konsultant',
        `Kodu ${kod} nie ma wśród wolnych płyt tego wzoru — mógł zostać sprzedany. ` +
          'Proszę wybrać inną płytę z listy poniżej.'
      );
    }

    // Lista w pomocniku jest ucięta — mówimy o tylu płytach, ile realnie widać,
    // żeby liczba w zdaniu zgadzała się z tym, co klient ma przed oczami.
    const POKAZUJEMY = 24;
    const widocznych = Math.min(dostepne.length, POKAZUJEMY);
    dodajWiadomosc(
      'konsultant',
      (widocznych === 1
        ? 'Mam jedną taką płytę w magazynie.'
        : `Mam ${dostepne.length} płyt tego wzoru` +
          (dostepne.length > POKAZUJEMY ? `, pokazuję ${POKAZUJEMY} największych.` : ' w magazynie.')) +
        ' Każdy blok ma własną cenę i wymiar, więc proszę wskazać konkretną płytę — z niej policzę wycenę.'
    );
    historia.push({ rola: 'assistant', tresc: `Pokazuję dostępne płyty „${nazwa}" do wyboru.` });
    stan.nazwaKamienia = nazwa;
    stan.wyborPlyty = { nazwa, plyty: dostepne };
    odswiezPomocnika();
    przewin();
  }

  /**
   * Klient przepisał kod ze strony magazynu, zanim podał nazwę kamienia.
   *
   * Kodu nie da się sprawdzić samego z siebie — wyszukiwarka Interstone go
   * nie zna. Ale kod niesie numer bloku (STON000596), a magazyn wyszukuje
   * po nazwie, więc pytamy klienta o nazwę tylko wtedy, gdy naprawdę musimy:
   * najpierw próbujemy z nazwą, którą już znamy z rozmowy.
   */
  async function podajKodRecznie(kod) {
    /*
     * Kod wystarcza — magazyn indeksuje matnr, więc szukamy po samym kodzie
     * i nie musimy pytać klienta o nazwę wzoru. (Przez chwilę było odwrotnie:
     * wydawało się, że wyszukiwarka kodów nie zna, ale to nasz własny filtr
     * trafień kasował wynik, bo porównywał frazę tylko z nazwą kamienia.)
     */
    stan.szukamPlyt = true;
    rozmowa.querySelector('.pomocnik')?.remove();
    dodajWiadomosc('klient', `Wybieram płytę o kodzie ${kod}.`);
    const pisze = wskaznikPisania();
    rozmowa.append(pisze);
    przewin();

    let odp = { ok: false };
    try {
      odp = await sprawdzMagazyn(kod, kod);
    } catch {
      /* obsłużone niżej */
    }
    pisze.remove();
    stan.szukamPlyt = false;

    if (!odp.ok || !odp.plyta) {
      historia.push({ rola: 'user', tresc: `Wybieram płytę o kodzie ${kod}.` });
      dodajWiadomosc('konsultant', komunikatKodu(odp.powodKodu, kod, odp));
      historia.push({ rola: 'assistant', tresc: komunikatKodu(odp.powodKodu, kod, odp) });
      odswiezPomocnika();
      przewin();
      return;
    }

    // Wejściem mógł być sam numer albo adres — właściwy kod znamy dopiero
    // z odpowiedzi magazynu.
    const kodPlyty = odp.kod || kod;
    stan.kodPlyty = kodPlyty;
    stan.nazwaKamienia = odp.plyta.nazwa || stan.nazwaKamienia;
    if (odp.plyta.nazwa) stan.dekor = odp.plyta.nazwa;
    stan.wyborPlyty = null;
    rozmowa.append(kartaWybranejPlyty(odp.plyta, kodPlyty));
    przewin();

    /*
     * Dane płyty wkładamy do wiadomości KLIENTA, a nie jako osobną turę
     * asystenta — rozmowa musi kończyć się turą użytkownika, inaczej
     * zapytanie do modelu jest odrzucane i klient widzi „brak połączenia".
     * Dzięki temu konsultant zna nazwę i cenę i nie szuka płyty po raz drugi.
     */
    historia.push({
      rola: 'user',
      tresc:
        `Wybieram płytę ${kodPlyty} — ${odp.plyta.nazwa || 'kamień naturalny'}` +
        (odp.plyta.cenaBruttoM2 ? `, ${odp.plyta.cenaBruttoM2} zł/m² brutto` : '') +
        (odp.plyta.dostepneM2 ? `, wolne ${odp.plyta.dostepneM2} m²` : '') +
        '. Płyta jest dostępna, sprawdziłem ją w magazynie — nie sprawdzaj ponownie.',
    });

    await odpowiedzKonsultanta();
  }

  /**
   * Co powiedzieć, gdy kod nie doprowadził do płyty.
   *
   * Każdy powód to inna rada dla klienta — i do każdego dokładamy adres
   * magazynu, żeby miał gdzie kliknąć, zamiast utknąć na komunikacie.
   */
  function komunikatKodu(powod, kod, odp) {
    const gdzie = ' Płyty obejrzy Pan/Pani w magazynie: ' + (odp?.link || LINK_MAGAZYNU) + '.';

    if (powod === 'zly-format')
      return (
        `„${kod}" nie wygląda na kod płyty. Kod stoi przy zdjęciu i ma postać ` +
        'STON000334-84224 — można też wkleić sam numer z końca albo adres zdjęcia.' + gdzie
      );
    if (powod === 'niejednoznaczny')
      return (
        'Ten numer pasuje do kilku płyt: ' + (odp?.kody || []).join(', ') +
        '. Proszę podać pełny kod, żebym wiedział, o którą chodzi.'
      );
    if (powod === 'niedostepna')
      return (
        `Płyta ${kod}${odp?.plyta?.nazwa ? ` (${odp.plyta.nazwa})` : ''} jest już w całości ` +
        'zarezerwowana — nie zostało z niej wolnych metrów. Proszę wybrać inną.' + gdzie
      );
    if (powod === 'brak-ceny')
      return (
        `Przy płycie ${kod} magazyn nie podaje ceny. Proszę wybrać inną albo zadzwonić: ${TEL} — ` +
        'potwierdzimy cenę u dostawcy.'
      );
    if (powod === 'brak-wymiaru')
      return (
        `Przy płycie ${kod} magazyn nie podaje wymiaru, więc nie policzę rozkroju. ` +
        `Proszę wybrać inną albo zadzwonić: ${TEL}.`
      );
    if (powod === 'magazyn-niedostepny')
      return (
        'Nie mogę teraz połączyć się z magazynem, więc wolę nie podawać ceny na wyrost. ' +
        `Proszę spróbować za chwilę albo zadzwonić: ${TEL}.`
      );
    // 'nie-znaleziono' i wszystko, czego nie przewidzieliśmy
    return (
      `Nie znajduję płyty o kodzie ${kod}. Proszę sprawdzić zapis — kod stoi przy zdjęciu płyty ` +
      'i wygląda tak: STON000334-84224.' + gdzie
    );
  }

  function pokazBramke(w) {
    rozmowa.append(w ? bramkaWyceny(w, { transkrypcja }) : bramkaKontaktu({ transkrypcja }));
    przewin();
  }

  /**
   * Wycena bez udziału konsultanta — z tego, co klient wyklikał.
   * Uruchamia się tylko wtedy, gdy rozmowa jest niedostępna.
   */
  function zapasowaWycena() {
    if (!stan.material || !stan.dekor || !stan.odcinki.length) return false;
    if (rozmowa.querySelector('.bramka')) return true;

    // O zlew, indukcję i liczbę otworów pytamy ZAWSZE — także wtedy, gdy
    // konsultant milczy i liczymy sami. Zwracamy true, żeby nie pokazywać
    // komunikatu o błędzie: zaraz pojawi się pytanie o szczegóły.
    if (!stan.szczegoly) return true;

    const firma = firmaWgSlug(stan.material);
    if (!firma || firma.trybCeny === 'reczna') return false;

    const w = wycen(firma, {
      dekor: stan.dekor,
      grubosc: gruboscDomyslna(firma, stan.dekor),
      odcinki: stan.odcinki,
      opcje: opcjeZeSzczegolow(stan.opcje, stan.pomieszczenie),
    });
    if (!w.ok) return false;

    dodajWiadomosc(
      'konsultant',
      'Wycena jest gotowa. Proszę podać dane poniżej — od razu ją pokażę i wyślę na e-mail.'
    );
    stan.szczegoly = true;
    rozmowa.querySelector('.pomocnik')?.remove();
    rozmowa.append(bramkaWyceny(w, { transkrypcja }));
    zdarzenie('wycena_lokalna');
    przewin();
    return true;
  }

  function transkrypcja() {
    return historia
      .map((w) => (w.rola === 'assistant' ? 'Konsultant: ' : 'Klient: ') + w.tresc)
      .join('\n\n');
  }

  /* --------------------------------------------------- kreator w rozmowie */

  /**
   * Podsuwa dokładnie jeden element: ten, którego teraz brakuje.
   * Dzięki temu klient klika zamiast pisać i szybciej dochodzi do wyceny.
   */
  function odswiezPomocnika() {
    rozmowa.querySelector('.pomocnik')?.remove();
    if (zajety) return;
    // Gdy klient jest już przy formularzu, nic więcej mu nie podsuwamy.
    if (rozmowa.querySelector('.bramka')) return;

    let el = null;
    // Trwa odpytywanie magazynu — nie podsuwamy w tym czasie innego kroku.
    if (stan.szukamPlyt) return;
    // Kamień naturalny czeka na wskazanie płyty — nic innego nie ma wtedy sensu.
    if (stan.wyborPlyty)
      el = pomocnikPlyty(stan.wyborPlyty.plyty, stan.wyborPlyty.nazwa, (wybrany, plyta) => {
        const nazwa = stan.wyborPlyty?.nazwa || stan.nazwaKamienia || '';
        // Potwierdzenie ze zdjęciem zostaje w rozmowie — pomocnik zaraz zniknie.
        if (plyta) rozmowa.append(kartaWybranejPlyty(plyta, wybrany));
        stan.kodPlyty = wybrany;
        stan.nazwaKamienia = nazwa || stan.nazwaKamienia;
        // Dekor przy kamieniu naturalnym to nazwa kamienia — bez tego kreator
        // utknąłby na kroku wzoru, którego dla naturalnego nie ma.
        if (nazwa) stan.dekor = nazwa;
        stan.wyborPlyty = null;
        // Wiadomość niesie nazwę I kod, żeby konsultant miał komplet
        // do `kamien` oraz `kod_plyty` — bez tego dopytywałby o wzór.
        wyslij(
          nazwa
            ? `Wybieram płytę ${wybrany} — ${nazwa}.`
            : `Wybieram płytę ${wybrany}.`
        );
      });
    else if (!stan.pomieszczenie) el = pomocnikPomieszczenie(wybrano);
    else if (!stan.rodzaj) el = pomocnikRodzaj(wybrano);
    else if (!stan.material) el = pomocnikMaterial(wybrano, stan.rodzaj);
    // Kamień naturalny nie ma listy wzorów — zamiast niej pytamy o nazwę
    // kamienia i pokazujemy konkretne płyty z magazynu.
    else if (stan.material === 'interstone' && !stan.kodPlyty) el = pomocnikKamien(szukajPlyt, podajKodRecznie);
    else if (!stan.dekor) el = pomocnikDekor(stan.material, wybrano);
    else if (!stan.wymiary) el = pomocnikWymiary(wybrano);
    else if (!stan.szczegoly) el = pomocnikSzczegoly(wybrano, stan.pomieszczenie);

    if (el) {
      rozmowa.append(el);
      przewin();
    }
  }

  /** Kliknięcie w pomocniku = wysłana wiadomość + przejście do kolejnego kroku. */
  function wybrano(wartosc, wiadomosc) {
    // Krok „kuchnia czy łazienka" — od tego zależy zestaw dalszych pytań.
    if (typeof wartosc === 'string' && wartosc.startsWith('pomieszczenie:')) {
      stan.pomieszczenie = wartosc.slice(14);
      zdarzenie('wybor_pomieszczenia', { pomieszczenie: stan.pomieszczenie });
      wyslij(wiadomosc);
      return;
    }

    // Krok „rodzaj kamienia" — najpierw grupa, potem dopiero nazwy kolekcji.
    if (typeof wartosc === 'string' && wartosc.startsWith('rodzaj:')) {
      const rodzaj = wartosc.slice(7);
      if (rodzaj === 'wstecz') {
        stan.rodzaj = null;
        stan.material = null;
      } else {
        stan.rodzaj = rodzaj;
        zdarzenie('wybor_rodzaju', { rodzaj });
        // Jest tylko jedna kolekcja w tej grupie? Nie każemy klikać drugi raz.
        const wGrupie = FIRMY.filter((f) => rodzajMaterialu(f) === rodzaj);
        if (wGrupie.length === 1) {
          stan.material = wGrupie[0].slug;
          zdarzenie('wybor_materialu', { material: stan.material });
          if (stan.material === 'interstone') stan.dekor = '(kamień naturalny)';
        }
      }
      wyslij(wiadomosc);
      return;
    }

    if (!stan.material && wartosc) {
      stan.material = wartosc;
      zdarzenie('wybor_materialu', { material: wartosc });
      // Kamień naturalny nie ma listy dekorów — od razu idziemy dalej.
      if (wartosc === 'interstone') stan.dekor = '(kamień naturalny)';
    } else if (stan.material && !stan.dekor) {
      stan.dekor = wartosc || '(do doradzenia)';
    } else if (!stan.wymiary && wartosc === 'wymiary') {
      stan.wymiary = true;
      stan.odcinki = odczytajWymiary(wiadomosc);
    } else if (wartosc === 'szczegoly') {
      stan.szczegoly = true;
      stan.opcje = odczytajSzczegoly(wiadomosc);
    }
    wyslij(wiadomosc);
  }

  /* -------------------------------------------------------------- widok */

  function dodajWiadomosc(kto, tresc) {
    const konsultant = kto !== 'klient';
    rozmowa.append(
      h(
        'div',
        { class: 'wiad ' + (konsultant ? 'wiad-konsultant' : 'wiad-klient') },
        h(
          'div',
          { class: 'wiad-kto' },
          konsultant
            ? [
                h('img', {
                  class: 'wiad-awatar',
                  src: '/dawid-awatar-maly.webp',
                  width: '40',
                  height: '40',
                  alt: '',
                  loading: 'lazy',
                }),
                h('span', {}, 'Asystent Dawida'),
              ]
            : 'Ty'
        ),
        h('div', { class: 'wiad-tresc' }, akapity(tresc))
      )
    );
    przewin();
  }

  /**
   * Wizytówka nad rozmową.
   *
   * Dawid jest twarzą tej strony i to jego zakład stoi za każdą wyceną —
   * dlatego zdjęcie, imię i nazwisko. Jednocześnie mówimy wprost, że pisze
   * asystent, a nie człowiek: tego wymaga uczciwość wobec klienta
   * (i przepisy o przejrzystości systemów AI). Jedno drugiego nie wyklucza.
   */
  function wizytowka() {
    return h(
      'div',
      { class: 'wizytowka' },
      h('img', {
        class: 'wiz-foto',
        src: '/dawid-awatar.webp',
        width: '96',
        height: '96',
        alt: 'Dawid Ząbek — właściciel Kamieniarstwa 24h',
        fetchpriority: 'high',
      }),
      h(
        'div',
        { class: 'wiz-tekst' },
        h(
          'div',
          { class: 'wiz-imie' },
          'Dawid Ząbek',
          h('span', { class: 'wiz-tag' }, h('i', { 'aria-hidden': 'true' }), 'asystent online')
        ),
        // Informacja, że pisze asystent, a nie człowiek, ZOSTAJE — to wymóg
        // uczciwości wobec klienta. Skrócona do jednej linijki razem z rolą.
        h(
          'div',
          { class: 'wiz-rola' },
          'Piszesz z moim asystentem — czytam każde zgłoszenie. ',
          h('a', { href: '/o-mnie' }, 'Poznaj mnie →')
        )
      ),
      h(
        'a',
        { class: 'wiz-tel', href: 'tel:+48796991128', 'data-miejsce': 'wizytowka' },
        '☎ ' + TEL
      )
    );
  }

  function dodajBlad(status) {
    const tekst =
      status === 429
        ? 'Za dużo wiadomości naraz — proszę chwilę odczekać. Szybciej będzie telefonicznie: '
        : 'Nie mam teraz połączenia z konsultantem. Wycenę policzy kreator, a najszybciej pomożemy telefonicznie: ';
    rozmowa.append(
      h(
        'div',
        { class: 'wiad wiad-konsultant' },
        h('div', { class: 'wiad-kto' }, 'Konsultant'),
        h(
          'div',
          { class: 'wiad-tresc czat-blad' },
          tekst,
          h('a', { href: 'tel:+48796991128', 'data-miejsce': 'czat-blad' }, TEL),
          akcje.pokazKreator
            ? h(
                'div',
                { style: 'margin-top:12px' },
                h('button', { class: 'btn', type: 'button', onclick: () => akcje.pokazKreator() }, 'Policz kreatorem →')
              )
            : null
        )
      )
    );
    przewin();
  }

  function wskaznikPisania() {
    return h(
      'div',
      { class: 'wiad wiad-konsultant' },
      h('div', { class: 'wiad-kto' }, 'Konsultant'),
      h('div', { class: 'wiad-tresc' }, h('span', { class: 'pisze' }, h('i'), h('i'), h('i')))
    );
  }

  function przewin() {
    requestAnimationFrame(() => rozmowa.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  }
}

/* ------------------------------------------------------------ tłumaczenia */


function akapity(tekst) {
  return String(tekst)
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => h('p', {}, ...linkuj(l)));
}

function linkuj(linia) {
  const czesci = [];
  const wzor = /https?:\/\/[^\s<>"')]+/g;
  let ostatni = 0;
  let m;
  while ((m = wzor.exec(linia)) !== null) {
    if (m.index > ostatni) czesci.push(linia.slice(ostatni, m.index));
    czesci.push(h('a', { href: m[0], target: '_blank', rel: 'noopener nofollow' }, m[0]));
    ostatni = m.index + m[0].length;
  }
  if (ostatni < linia.length) czesci.push(linia.slice(ostatni));
  return czesci;
}

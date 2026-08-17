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
} from './parametry.js';
import {
  pomocnikPomieszczenie,
  pomocnikRodzaj,
  pomocnikMaterial,
  pomocnikDekor,
  pomocnikWymiary,
  pomocnikSzczegoly,
  pomocnikPlyty,
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
    if (!firma) return pokazBramke(null);

    const w = wycen(firma, wybor.dane);
    if (!w.ok) {
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

  /** Co powiedzieć, gdy kodu brak albo jest zły. */
  function komunikatKodu(powod, kod, odp) {
    if (powod === 'zly-format' || (kod === '' && odp.powodKodu === null && stan.kodPlyty))
      return 'Ten kod nie wygląda na kod płyty. Powinien mieć postać STON000334-84224 — proszę sprawdzić i wpisać jeszcze raz albo wybrać płytę z listy.';
    if (powod === 'nie-znaleziono')
      return 'Nie znalazłem tej płyty wśród dostępnych. Mogła zostać sprzedana — proszę wybrać inną z listy poniżej.';
    if (powod === 'brak-dostepnosci')
      return 'Ta płyta jest już zarezerwowana w całości. Proszę wybrać inną z listy poniżej.';
    if (powod === 'brak-ceny')
      return 'Przy tej płycie magazyn nie podaje ceny — proszę wybrać inną albo zadzwonić, potwierdzimy ją u dostawcy.';
    return 'Kamień naturalny wyceniam z konkretnej płyty — każdy blok ma własną cenę i wymiar. Proszę wskazać płytę z listy albo wpisać jej kod.';
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
    // Kamień naturalny czeka na wskazanie płyty — nic innego nie ma wtedy sensu.
    if (stan.wyborPlyty)
      el = pomocnikPlyty(stan.wyborPlyty.plyty, stan.wyborPlyty.nazwa, (wybrany) => {
        stan.kodPlyty = wybrany;
        stan.wyborPlyty = null;
        // Ta sama droga co zwykle: wiadomość klienta wraca do konsultanta,
        // a wycena rusza dopiero z kodem.
        wyslij(`Wybieram płytę ${wybrany}.`);
      });
    else if (!stan.pomieszczenie) el = pomocnikPomieszczenie(wybrano);
    else if (!stan.rodzaj) el = pomocnikRodzaj(wybrano);
    else if (!stan.material) el = pomocnikMaterial(wybrano, stan.rodzaj);
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

/**
 * Konsultant pisze zwykły tekst, a polecenie dokleja jako JSON.
 * Wyciągamy je i zostawiamy klientowi samą wiadomość.
 */
export function rozdziel(surowa) {
  const tekstCalosc = String(surowa || '').trim();
  const start = tekstCalosc.indexOf('{');
  const koniec = tekstCalosc.lastIndexOf('}');
  if (start === -1 || koniec <= start) return { tekst: tekstCalosc, akcja: null };

  let akcja = null;
  try {
    akcja = JSON.parse(tekstCalosc.slice(start, koniec + 1));
  } catch {
    return { tekst: tekstCalosc, akcja: null };
  }
  if (!akcja || (akcja.action !== 'quote' && akcja.action !== 'lead')) {
    return { tekst: tekstCalosc, akcja: null };
  }

  const pozaJsonem = (tekstCalosc.slice(0, start) + ' ' + tekstCalosc.slice(koniec + 1)).trim();
  return { tekst: String(akcja.message || pozaJsonem || '').trim(), akcja };
}

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

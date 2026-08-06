import { h } from './dom.js';
import { FIRMY, firmaWgSlug, gruboscDomyslna } from '../firms/index.js';
import { wycen } from '../engine/wycena.js';
import { bramkaWyceny, bramkaKontaktu } from './bramka.js';
import { zapytajKonsultanta } from '../api.js';
import { zdarzenie } from '../analytics/zdarzenia.js';
import {
  pomocnikRodzaj,
  pomocnikMaterial,
  pomocnikDekor,
  pomocnikWymiary,
  pomocnikSzczegoly,
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

const POWITANIE =
  'Dzień dobry, jestem asystentem Dawida Ząbka — pomogę dobrać materiał ' +
  'i policzyć orientacyjny koszt blatu. W każdej chwili może Pan/Pani też ' +
  'zadzwonić bezpośrednio do Dawida: ' + TEL + '. Z czego ma być blat?';

/** Nazwy kolekcji z promptu → pliki firm w aplikacji. */
const MATERIALY = {
  avant_quartz: 'avant-quartz',
  'avant-quartz': 'avant-quartz',
  caesarstone: 'caesarstone',
  technistone: 'technistone',
  keralini: 'keralini',
  marazzi: 'marazzi',
  grande: 'marazzi',
  atlas_plan: 'atlas-plan',
  'atlas-plan': 'atlas-plan',
  atlasplan: 'atlas-plan',
  atlas: 'atlas-plan',
  kamien_naturalny: 'interstone',
  interstone: 'interstone',
};

export function uruchomCzat(root, akcje = {}) {
  const historia = [];
  let zajety = false;

  // Na jakim etapie jest klient — po tym wiemy, co mu podsunąć pod odpowiedzią.
  const stan = {
    rodzaj: null,
    material: null,
    dekor: null,
    wymiary: false,
    szczegoly: false,
    odcinki: [],
    opcje: {},
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

      if (akcja?.action === 'quote') policzWycene(akcja.params);
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

  function policzWycene(params) {
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

    const firma = firmaWgSlug(stan.material);
    if (!firma || firma.trybCeny === 'reczna') return false;

    const w = wycen(firma, {
      dekor: stan.dekor,
      grubosc: gruboscDomyslna(firma, stan.dekor),
      odcinki: stan.odcinki,
      opcje: {
        zlew: 'podblat',
        plyta: stan.opcje.licowana ? 'licowana' : 'nakladana',
        bateria: true,
      },
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
    if (!stan.rodzaj) el = pomocnikRodzaj(wybrano);
    else if (!stan.material) el = pomocnikMaterial(wybrano, stan.rodzaj);
    else if (!stan.dekor) el = pomocnikDekor(stan.material, wybrano);
    else if (!stan.wymiary) el = pomocnikWymiary(wybrano);
    else if (!stan.szczegoly) el = pomocnikSzczegoly(wybrano);

    if (el) {
      rozmowa.append(el);
      przewin();
    }
  }

  /** Kliknięcie w pomocniku = wysłana wiadomość + przejście do kolejnego kroku. */
  function wybrano(wartosc, wiadomosc) {
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
        h('div', { class: 'wiz-rola' }, 'właściciel Kamieniarstwa 24h · czeladnik kamieniarstwa'),
        h(
          'p',
          { class: 'wiz-nota' },
          'Piszesz z moim asystentem — prowadzę go osobiście i czytam każde zgłoszenie. ',
          h('a', { href: '/o-mnie' }, 'Poznaj mnie →')
        )
      ),
      h(
        'a',
        { class: 'wiz-tel', href: 'tel:+48796991128', 'data-miejsce': 'wizytowka' },
        '☎ Wolisz porozmawiać ze mną osobiście? ' + TEL
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

/**
 * Parametry z rozmowy → wejście kalkulatora.
 * W rozmowie odcinki są opisane jako {d: głębokość, w: długość} w cm.
 */
export function przelozParametry(params) {
  if (!params) return null;
  const slug = MATERIALY[String(params.material || '').toLowerCase()];
  if (!slug || slug === 'interstone') return null; // kamień naturalny — bez auto-wyceny

  const odcinki = (Array.isArray(params.odcinki) ? params.odcinki : [])
    .map((o) => ({
      dl: Number(o?.w ?? o?.dl) || 0,
      gl: Number(o?.d ?? o?.gl) || 60, // domyślna głębokość blatu to 60 cm
    }))
    .filter((o) => o.dl > 0);

  if (!odcinki.length) return null;

  return {
    slug,
    dane: {
      dekor: params.dekor,
      grubosc: String(params.grubosc || (slug === 'keralini' ? '12' : '20')),
      odcinki,
      opcje: {
        // Wycięcie pod zlew i pod płytę grzewczą są w każdej wycenie.
        zlew: 'podblat',
        plyta: params.indukcja_licowana ? 'licowana' : 'nakladana',
        bateria: params.otwor_bateria !== false,
        mat: !!params.wykonczenie_matowe,
        listwa: Number(params.listwa_mb) || 0,
        krawedz: Number(params.krawedz_mb) || 0,
      },
    },
  };
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

/** „Wymiary blatu: 60×300 cm, 60×180 cm." → [{gl:60,dl:300},{gl:60,dl:180}] */
export function odczytajWymiary(wiadomosc) {
  const wynik = [];
  const wzor = /(\d{2,3})\s*[×x]\s*(\d{2,4})/g;
  let m;
  while ((m = wzor.exec(String(wiadomosc))) !== null) {
    wynik.push({ gl: Number(m[1]), dl: Number(m[2]) });
  }
  return wynik;
}

/** „Zlew podwieszany, płyta indukcyjna licowana z blatem." → {licowana:true} */
export function odczytajSzczegoly(wiadomosc) {
  const t = String(wiadomosc).toLowerCase();
  return { licowana: t.includes('licowana'), nablatowy: t.includes('nablatowy') };
}

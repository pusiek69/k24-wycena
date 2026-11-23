/**
 * FORMULARZ UMYWALKI — ten sam, co przy wycenie blatów.
 *
 * Decyzja Dawida z 23.11.2026: „formularz podobny jak w wycenie blatów".
 * Więc nie wymyślamy nowego: te same pola, te same klasy CSS, ta sama
 * walidacja i te same komunikaty, co w `src/app/bramka.js`. Klient, który
 * raz liczył u nas blat, widzi dokładnie to, co zna.
 *
 * ⚠ `sprawdz()` niżej to KOPIA 1:1 z `app/bramka.js` — tamten plik nie
 * eksportuje tej funkcji, a specyfikacja zabrania go edytować (lejek blatów
 * musi działać bez żadnej zmiany). Zmieniać OBIE RAZEM; test
 * `scripts/test-umywalka-formularz.mjs` porównuje je znak w znak.
 */
import { h } from '../app/dom.js';
import { wyslijLead, wyslijLeadZapasowo } from '../api.js';
import { TERMINY } from '../app/termin.js';
import { KANALY, potwierdzenie } from '../app/kontakt-telefon.js';
import { zrodloLeada } from '../app/zrodlo.js';
import { partnerDoLeada } from '../app/partner.js';
import * as ga from './zdarzenia.js';

const MAX_PLIK = 8 * 1024 * 1024; // 8 MB
const OPIS_PLIKU = 'Zdjęcie łazienki lub projekt (opcjonalnie, do 8 MB)';

/**
 * @param {object} p
 * @param {object} p.wycena   wynik `wycenUmywalke()`
 * @param {string} p.link     adres tej konfiguracji (wraca w mailu do Dawida)
 * @param {Function} p.poWyslaniu  (dane) => void — rysuje kartę z ceną
 */
export function formularzUmywalki({ wycena, link, poWyslaniu }) {
  const bledy = h('div', { class: 'form-blad', hidden: true, role: 'alert' });
  const przycisk = h('button', { class: 'btn', type: 'submit' }, 'Pokaż wycenę i wyślij mailem');

  const plikOpis = h('span', { class: 'plik-opis' }, OPIS_PLIKU);
  const plik = h('input', {
    type: 'file',
    accept: 'image/*,application/pdf,.pdf',
    hidden: true,
    id: 'u-plik',
  });

  plik.addEventListener('change', () => {
    const f = plik.files?.[0];
    if (!f) return (plikOpis.textContent = OPIS_PLIKU);
    if (f.size > MAX_PLIK) {
      plik.value = '';
      plikOpis.textContent = '⚠ Plik za duży (max 8 MB) — proszę wybrać mniejszy.';
      return;
    }
    plikOpis.textContent = `✓ ${f.name} (${(f.size / 1048576).toFixed(1)} MB)`;
  });

  const form = h(
    'form',
    { class: 'lead-form', novalidate: true },
    h(
      'div',
      { class: 'form-siatka' },
      pole('imie', 'Imię', { type: 'text', autocomplete: 'given-name', placeholder: 'Jak się zwracać?' }),
      pole('telefon', 'Telefon *', {
        type: 'tel',
        inputmode: 'tel',
        autocomplete: 'tel',
        placeholder: '600 100 200',
      }),
      pole('email', 'E-mail *', {
        type: 'email',
        inputmode: 'email',
        autocomplete: 'email',
        placeholder: 'na ten adres wyślemy wycenę',
      }),
      pole('miejscowosc', 'Miejscowość *', {
        type: 'text',
        autocomplete: 'address-level2',
        placeholder: 'ustalimy rejon pomiaru',
      }),
      wybor('termin', 'Kiedy planujesz umywalkę? *', TERMINY)
    ),

    h('label', { class: 'plik-pick', for: 'u-plik' }, plikOpis),
    plik,

    h(
      'fieldset',
      { class: 'tel-wybor' },
      h('legend', {}, 'Czy mamy zadzwonić? *'),
      h(
        'p',
        { class: 'tel-nota' },
        'Dzwonimy tylko do osób, które o to proszą. Wycena i tak pójdzie na e-mail.'
      ),
      h(
        'div',
        { class: 'tel-opcje' },
        KANALY.map((k) =>
          h(
            'label',
            { class: 'tel-opcja' },
            h('input', { type: 'radio', name: 'telefonZgoda', value: k.id }),
            h('span', { class: 'tel-znak' }, k.id === 'tak' ? '☎' : '✉'),
            h('span', { class: 'tel-tekst' }, k.label)
          )
        )
      )
    ),

    h(
      'label',
      { class: 'switch zgoda' },
      h('input', { type: 'checkbox', name: 'zgoda' }),
      h('span', { class: 'box' }, '✓'),
      h(
        'span',
        { class: 'zgoda-txt' },
        'Zgadzam się na kontakt w sprawie tej wyceny. Administratorem danych jest ' +
          'Aaron sp. z o.o. (Kamieniarstwo 24h) — szczegóły w ',
        h('a', { href: '/polityka-prywatnosci', target: '_blank', rel: 'noopener' }, 'polityce prywatności'),
        '.'
      )
    ),

    bledy,
    h(
      'div',
      { class: 'nav' },
      przycisk,
      h(
        'span',
        { class: 'form-nota' },
        'Wycena trafi na Pana/Pani e-mail. Oddzwaniamy w godzinach 8–18.'
      )
    )
  );

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    bledy.hidden = true;

    const dane = {
      name: wartosc(form, 'imie'),
      phone: wartosc(form, 'telefon'),
      email: wartosc(form, 'email'),
      city: wartosc(form, 'miejscowosc'),
      termin: wartosc(form, 'termin'),
      zgoda: form.querySelector('[name="zgoda"]').checked,
      telefonZgoda: form.querySelector('[name="telefonZgoda"]:checked')?.value || '',
    };

    const problem = sprawdz(dane);
    if (problem) {
      bledy.textContent = problem.komunikat;
      bledy.hidden = false;
      form.querySelector(`[name="${problem.pole}"]`)?.focus();
      return;
    }

    przycisk.disabled = true;
    przycisk.textContent = 'Wysyłam…';

    const zgloszenie = {
      ...dane,
      // Po tym polu worker rozpoznaje umywalkę: temat z prefiksem UMYWALKA
      // i inny szablon maila do klienta. Lead blatu nie ma tego pola
      // i idzie dokładnie tą samą drogą co dotąd.
      produkt: 'umywalka',
      quote: wycena.opis,
      kwota: Math.round(wycena.razemZaokr || 0),
      szczegoly: szczegolyUmywalki(wycena, link),
      zrodlo: zrodloLeada(),
      partner: partnerDoLeada(),
    };

    const zalacznik = plik.files?.[0];
    if (zalacznik && zalacznik.size <= MAX_PLIK) {
      try {
        zgloszenie.filename = zalacznik.name;
        zgloszenie.file = await naBase64(zalacznik);
      } catch {
        delete zgloszenie.file;
        delete zgloszenie.filename;
      }
    }

    try {
      await wyslijLead(zgloszenie);
      ga.lead(wycena.razemZaokr, wycena.pak?.polowka);
      poWyslaniu({ ...dane, mailWyslany: true });
    } catch {
      try {
        await wyslijLeadZapasowo({ ...zgloszenie, uwagi: 'Umywalka z kamienia — ' + wycena.opis });
        ga.lead(wycena.razemZaokr, wycena.pak?.polowka);
        poWyslaniu({ ...dane, mailWyslany: false });
      } catch {
        przycisk.disabled = false;
        przycisk.textContent = 'Spróbuj ponownie';
        bledy.innerHTML =
          'Nie udało się wysłać zgłoszenia. Proszę zadzwonić: ' +
          '<a href="tel:+48796991128" data-miejsce="blad-umywalki">796 991 128</a> — podamy wycenę od ręki.';
        bledy.hidden = false;
      }
    }
  });

  return h(
    'div',
    { class: 'bramka-karta' },
    h('div', { class: 'q-kicker' }, 'Wycena gotowa'),
    h('h3', { class: 'q-title' }, 'Twoja wycena jest gotowa'),
    h(
      'p',
      { class: 'q-hint' },
      `Policzyliśmy ${wycena.opis.replace(/^Umywalka/, 'umywalkę')}. ` +
        'Zostaw kontakt — pokażemy kwotę od razu i wyślemy całe zestawienie na e-mail.'
    ),
    h(
      'ul',
      { class: 'bramka-lista' },
      h('li', {}, `Kamień: ${wycena.firma.nazwa} · ${wycena.dekor}`),
      h('li', {}, `Wymiar: ${wycena.stan.L} × ${wycena.stan.G} cm`),
      h(
        'li',
        {},
        wycena.stan.montaz
          ? 'W cenie: wykonanie, projekt 3D, pomiar u klienta, montaż'
          : 'W cenie: wykonanie, projekt 3D (bez montażu — odbiór własny)'
      )
    ),
    form
  );
}

/** Potwierdzenie po wysłaniu — identyczne jak przy blatach. */
export function potwierdzenieWyslania({ telefonZgoda, phone, mailWyslany }) {
  const tekst = potwierdzenie(telefonZgoda, phone);
  return h(
    'div',
    { class: 'umywalka-potwierdzenie' },
    h(
      'div',
      { class: 'bramka-ok' },
      h('span', { class: 'ptak' }, '✓'),
      h(
        'span',
        {},
        h('b', {}, 'Zgłoszenie przyjęte. '),
        mailWyslany ? 'Wycena poszła na podany adres e-mail.' : 'Wycenę prześlemy mailem.'
      )
    ),
    tekst
      ? h(
          'p',
          { class: 'tel-potwierdzenie' + (telefonZgoda === 'tak' ? ' tel-tak' : ' tel-nie') },
          h('span', { class: 'tel-znak', 'aria-hidden': 'true' }, telefonZgoda === 'tak' ? '☎' : '✉'),
          tekst
        )
      : null
  );
}

/**
 * Pełne rozbicie dla Dawida — to, czego klient NIE widzi.
 *
 * Z tego Dawid robi ofertę: wie, co się wycina, ile płyty schodzi, czy
 * zmieścił się w połówce i jakimi stawkami liczyliśmy. Link na końcu
 * otwiera dokładnie tę konfigurację.
 */
export function szczegolyUmywalki(w, link) {
  return {
    produkt: 'umywalka',
    firma: w.firma?.nazwa || '',
    dekor: w.dekor || '',
    grubosc: w.grubosc || '',
    typ: w.stan.typ,
    wymiar: { L: w.stan.L, G: w.stan.G, H: w.stan.H },
    niecka: w.niecka,
    pogrubienie: w.stan.pogrubienie,
    mocowanie: w.stan.mocowanie,
    bateria: w.stan.bateria,
    // Kawałki z wymiarami — rozkrój do warsztatu.
    kawalki: (w.kawalki || []).map((k) => ({ nazwa: k.nazwa, dl: k.dl, gl: k.gl })),
    plyta: { w: w.plyta?.w, h: w.plyta?.h },
    polowka: !!w.pak?.polowka,
    plytyPelne: w.pak?.plytyPelne ?? 0,
    m2Blatu: Math.round((w.pak?.m2Blatu ?? 0) * 1000) / 1000,
    m2Platne: w.m2Platne ?? 0,
    pozycje: (w.pozycje || []).map((p) => ({
      nazwa: p.nazwa,
      brutto: Math.round((p.brutto || 0) * 100) / 100,
      ...(p.ilosc ? { ilosc: p.ilosc } : {}),
    })),
    stawkaVat: w.stawkaVat,
    razem: Math.round((w.razem || 0) * 100) / 100,
    razemZaokr: w.razemZaokr,
    odbiorWlasny: !w.stan.montaz,
    pomieszczenie: 'lazienka',
    konfiguracja: link || '',
    ostrzezenia: w.ostrzezenia || [],
  };
}

/* ------------------------------------------------------------ pomocnicze */

function pole(nazwa, etykieta, atrybuty) {
  return h(
    'div',
    { class: 'pole' },
    h('label', { for: 'u-' + nazwa }, etykieta),
    h('input', { id: 'u-' + nazwa, name: nazwa, ...atrybuty })
  );
}

function wybor(nazwa, etykieta, opcje) {
  return h(
    'div',
    { class: 'pole' },
    h('label', { for: 'u-' + nazwa }, etykieta),
    h(
      'select',
      { id: 'u-' + nazwa, name: nazwa },
      h('option', { value: '' }, 'wybierz…'),
      opcje.map((o) => h('option', { value: o.id }, o.label))
    )
  );
}

function wartosc(form, nazwa) {
  return String(form.querySelector(`[name="${nazwa}"]`)?.value || '').trim();
}

/**
 * ⚠ KOPIA 1:1 z `app/bramka.js#sprawdz` — zmieniać razem z tamtą.
 * Komunikaty muszą być identyczne: klient nie może dostać innego tekstu
 * przy umywalce niż przy blacie.
 */
export function sprawdz(d) {
  const cyfry = d.phone.replace(/\D/g, '');
  if (cyfry.length < 9) return { pole: 'telefon', komunikat: 'Proszę podać numer telefonu (min. 9 cyfr).' };
  if (!/^[^@\s]+@[^@\s.]+\.[^@\s]{2,}$/.test(d.email))
    return { pole: 'email', komunikat: 'Proszę podać poprawny adres e-mail — na niego wyślemy wycenę.' };
  if (!d.city) return { pole: 'miejscowosc', komunikat: 'Proszę podać miejscowość — ustalamy rejon pomiaru.' };
  if (!d.termin)
    return { pole: 'termin', komunikat: 'Proszę zaznaczyć, kiedy planuje Pan/Pani blat — to jedno kliknięcie.' };
  if (!d.telefonZgoda)
    return {
      pole: 'telefonZgoda',
      komunikat: 'Proszę zaznaczyć, czy mamy zadzwonić — to jedno kliknięcie.',
    };
  if (!d.zgoda) return { pole: 'zgoda', komunikat: 'Potrzebujemy zgody na kontakt, żeby móc odpowiedzieć.' };
  return null;
}

function naBase64(plik) {
  return new Promise((ok, nie) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1]);
    r.onerror = () => nie(new Error('odczyt pliku'));
    r.readAsDataURL(plik);
  });
}

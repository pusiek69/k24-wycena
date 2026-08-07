import { h, zl, liczba } from './dom.js';
import { kartaWyceny, opisOdcinkow } from './wynik-widok.js';
import { wyslijLead, wyslijLeadZapasowo } from '../api.js';
import { zdarzenie, zdarzenieWycena, konwersjaLead } from '../analytics/zdarzenia.js';

/**
 * BRAMKA KONTAKTOWA
 *
 * Kwota nie pojawia się od razu. Klient najpierw zostawia telefon, e-mail
 * i miejscowość — dopiero wtedy karta się odsłania, a wycena leci do niego
 * mailem. Taka jest zasada firmy: wycena jest wartościowa, więc wymieniamy
 * ją na kontakt, zamiast rozdawać anonimowo.
 *
 * Jedno miejsce dla obu ścieżek — rozmowy i kreatora — żeby zachowanie
 * było identyczne niezależnie od tego, jak klient doszedł do wyceny.
 */

const MAX_PLIK = 8 * 1024 * 1024; // 8 MB
const TEL = '796 991 128';

/** Sam kontakt — bez wyceny (kamień naturalny, sprawy nietypowe). */
export function bramkaKontaktu(opcje = {}) {
  return bramkaWyceny(null, { ...opcje, tylkoKontakt: true });
}

export function bramkaWyceny(w, opcje = {}) {
  const box = h('div', { class: 'bramka' });
  if (w) {
    zdarzenieWycena(w);
    zdarzenie('bramka_pokazana', { value: Math.round(w.razemZaokr || 0), currency: 'PLN' });
  } else {
    zdarzenie('bramka_kontakt');
  }

  box.append(formularzBramki(w, box, opcje));
  return box;
}

function formularzBramki(w, box, opcje) {
  const bledy = h('div', { class: 'form-blad', hidden: true, role: 'alert' });
  const przycisk = h('button', { class: 'btn', type: 'submit' }, 'Pokaż wycenę i wyślij mailem');
  const plikOpis = h('span', { class: 'plik-opis' }, 'Projekt kuchni lub zdjęcie (opcjonalnie, do 8 MB)');
  const plik = h('input', { type: 'file', accept: 'image/*,application/pdf,.pdf', hidden: true, id: 'b-plik' });

  plik.addEventListener('change', () => {
    const f = plik.files?.[0];
    if (!f) return (plikOpis.textContent = 'Projekt kuchni lub zdjęcie (opcjonalnie, do 8 MB)');
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
      pole('telefon', 'Telefon *', { type: 'tel', inputmode: 'tel', autocomplete: 'tel', placeholder: '600 100 200' }),
      pole('email', 'E-mail *', { type: 'email', inputmode: 'email', autocomplete: 'email', placeholder: 'na ten adres wyślemy wycenę' }),
      pole('miejscowosc', 'Miejscowość *', { type: 'text', autocomplete: 'address-level2', placeholder: 'ustalimy rejon pomiaru' })
    ),

    h('label', { class: 'plik-pick', for: 'b-plik' }, plikOpis),
    plik,

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
      h('span', { class: 'form-nota' }, 'Wycena trafi na Pana/Pani e-mail. Oddzwaniamy w godzinach 8–18.')
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
      zgoda: form.querySelector('[name="zgoda"]').checked,
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
      quote: w ? opisWyceny(w) : 'Zapytanie z rozmowy — wycena do przygotowania',
      kwota: w ? Math.round(w.razemZaokr || 0) : 0,
      // Zastrzeżenie materiału (np. „wycena wstępna, płyta może zejść
      // z magazynu") musi dojechać do maila, nie zostać na karcie —
      // klient wraca do wyceny właśnie w skrzynce.
      uwaga: w?.firma?.notaKlient || '',
      // Link do wyboru płyty ma sens głównie w mailu: klient wraca do wyceny
      // po kilku dniach i wtedy dopiero siada do wybierania kamienia.
      linkPlyty: w?.firma?.wyborPlyty?.url || '',
      // Pełne rozbicie dla Dawida. Do maila leadowego trafia to samo,
      // co klient widzi na karcie — bez tego trzeba było odtwarzać wycenę
      // z jednozdaniowego podsumowania i transkryptu rozmowy.
      szczegoly: w?.ok ? szczegolyWyceny(w) : null,
      transcript: typeof opcje.transkrypcja === 'function' ? opcje.transkrypcja() : '',
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
      odsloniecie(w, box, { mailWyslany: true });
    } catch {
      // Worker nie odpowiada — nie tracimy kontaktu, próbujemy formularzem Netlify.
      try {
        await wyslijLeadZapasowo(zgloszenie);
        odsloniecie(w, box, { mailWyslany: false });
      } catch {
        przycisk.disabled = false;
        przycisk.textContent = 'Spróbuj ponownie';
        bledy.innerHTML =
          'Nie udało się wysłać zgłoszenia. Proszę zadzwonić: ' +
          '<a href="tel:+48796991128" data-miejsce="blad-bramki">796 991 128</a> — podamy wycenę od ręki.';
        bledy.hidden = false;
      }
    }
  });

  if (!w) {
    return h(
      'div',
      { class: 'bramka-karta' },
      h('div', { class: 'q-kicker' }, 'Kontakt'),
      h('h3', { class: 'q-title' }, 'Przygotujemy wycenę indywidualnie'),
      h(
        'p',
        { class: 'q-hint' },
        'Proszę zostawić kontakt — dobierzemy materiał i podamy cenę. ' +
          'Można też od razu zadzwonić: ' + TEL + ' (8:00–18:00).'
      ),
      form
    );
  }

  return h(
    'div',
    { class: 'bramka-karta' },
    h('div', { class: 'q-kicker' }, 'Wycena gotowa'),
    h('h3', { class: 'q-title' }, 'Twoja wycena jest gotowa'),
    h(
      'p',
      { class: 'q-hint' },
      `Policzyliśmy ${etykietaWyceny(w)}. Proszę zostawić kontakt — pokażemy kwotę od razu ` +
        'i wyślemy całe zestawienie na e-mail.'
    ),
    h(
      'ul',
      { class: 'bramka-lista' },
      h('li', {}, `Materiał: ${w.firma.nazwa}${w.dekor ? ' · ' + w.dekor : ''}`),
      h('li', {}, `Wymiary: ${opisOdcinkow(w)} (${liczba(w.pak.mb)} m.b.)`),
      h('li', {}, 'W cenie: obróbka, wycięcie pod zlew i płytę grzewczą, montaż')
    ),
    form
  );
}

/** Po wysłaniu: karta z ceną + potwierdzenie. */
function odsloniecie(w, box, { mailWyslany }) {
  konwersjaLead(Math.round(w?.razemZaokr || 0));
  box.replaceChildren(
    h(
      'div',
      { class: 'bramka-ok' },
      h('span', { class: 'ptak' }, '✓'),
      h(
        'span',
        {},
        h('b', {}, 'Zgłoszenie przyjęte. '),
        mailWyslany
          ? 'Wycena poszła na podany adres e-mail. Oddzwonimy w godzinach 8–18.'
          : 'Oddzwonimy w godzinach 8–18 i prześlemy wycenę mailem.'
      )
    ),
    w ? kartaWyceny(w) : null
  );
  box.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ------------------------------------------------------------ pomocnicze */

function pole(nazwa, etykieta, atrybuty) {
  return h(
    'div',
    { class: 'pole' },
    h('label', { for: 'b-' + nazwa }, etykieta),
    h('input', { id: 'b-' + nazwa, name: nazwa, ...atrybuty })
  );
}

function wartosc(form, nazwa) {
  return String(form.querySelector(`[name="${nazwa}"]`)?.value || '').trim();
}

function sprawdz(d) {
  const cyfry = d.phone.replace(/\D/g, '');
  if (cyfry.length < 9) return { pole: 'telefon', komunikat: 'Proszę podać numer telefonu (min. 9 cyfr).' };
  if (!/^[^@\s]+@[^@\s.]+\.[^@\s]{2,}$/.test(d.email))
    return { pole: 'email', komunikat: 'Proszę podać poprawny adres e-mail — na niego wyślemy wycenę.' };
  if (!d.city) return { pole: 'miejscowosc', komunikat: 'Proszę podać miejscowość — ustalamy rejon pomiaru.' };
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

function etykietaWyceny(w) {
  return w.materialDoUstalenia
    ? 'koszt obróbki i montażu'
    : `blat ${w.firma.nazwa}${w.dekor ? ' ' + w.dekor : ''}`;
}

/**
 * Wycena rozłożona na czynniki — jedzie do Workera i stamtąd w mail do firmy.
 *
 * Świadomie NIE wysyłamy całego obiektu wyceny: siedzi w nim konfiguracja
 * firmy z cennikiem wszystkich dekorów. Do maila potrzeba tylko tego,
 * co widać na karcie klienta.
 */
export function szczegolyWyceny(w) {
  const plyta = w.firma?.plyta || {};
  return {
    firma: w.firma?.nazwa || '',
    dekor: w.dekor || '',
    grubosc: w.grubosc || '',
    odcinki: (w.odcinki || []).map((o) => ({ gl: o.gl, dl: o.dl })),
    plyta: { w: plyta.w, h: plyta.h },
    plytyPelne: w.pak?.plytyPelne ?? 0,
    polowka: !!w.pak?.polowka,
    laczenia: w.pak?.laczenia ?? 0,
    uklad: w.pak?.uklad || [],
    m2Blatu: w.pak?.m2Blatu ?? 0,
    m2Platne: w.m2Platne ?? 0,
    mb: w.pak?.mb ?? 0,
    wgMetrazu: !!w.wgMetrazu,
    pozycje: (w.pozycje || []).map((p) => ({
      grupa: p.grupa,
      nazwa: p.nazwa,
      detal: p.detal || '',
      brutto: Math.round(p.brutto),
    })),
    materialBrutto: Math.round(w.materialBrutto || 0),
    uslugiBrutto: Math.round(w.uslugiBrutto || 0),
    razem: Math.round(w.razem || 0),
    widelki: { od: Math.round(w.widelki?.od || 0), do: Math.round(w.widelki?.do || 0) },
    promo: w.promo ? { nazwa: w.promo.nazwa, do: w.promo.do } : null,
    oszczednosc: Math.round(w.oszczednosc || 0),
    ostrzezenia: w.ostrzezenia || [],
  };
}

/** Wycena jednym zdaniem — trafia do maila i do zgłoszenia. */
export function opisWyceny(w) {
  if (!w?.ok) return 'Bez wyceny';
  return [
    w.firma.nazwa,
    w.dekor,
    w.grubosc ? `${w.grubosc} mm` : null,
    opisOdcinkow(w),
    `${liczba(w.pak.mb)} m.b.`,
    w.promo ? `promocja „${w.promo.nazwa}"` : null,
    w.materialDoUstalenia
      ? `obróbka i montaż ${zl(w.razemZaokr)} (materiał do ustalenia)`
      : `RAZEM ${zl(w.widelki.od)}–${zl(w.widelki.do)} brutto`,
  ]
    .filter(Boolean)
    .join(' · ');
}

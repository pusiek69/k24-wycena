/**
 * ROZMOWA POD WYCENĄ — to, co widzi i pisze klient.
 *
 * Dymki jak w czacie: klient z prawej (jego własne słowa), Dawid z lewej —
 * odwrotnie niż w panelu, bo po każdej stronie „ja" ma być po swojej.
 *
 * Bez logowania: autoryzuje token z linku do oferty. Dlatego formularz
 * niesie pole-pułapkę (`pulapka`) — ukryte przez CSS, więc człowiek go
 * nie widzi, a automat wypełnia wszystko jak leci i tym się zdradza.
 */
import { h } from './dom.js';
import { API_BASE } from '../api.js';

/** Ten sam limit co w workerze (worker/rozmowa.js) — licznik ma nie kłamać. */
export const MAKS_ZNAKOW = 2000;

export function sekcjaRozmowy(token, poczatkowa = [], { tylkoOdczyt = false } = {}) {
  const lista = h('ul', { class: 'watek' });
  const info = h('p', { class: 'watek-info', hidden: true, role: 'status' });

  const pole = h('textarea', {
    class: 'watek-pole',
    id: 'watek-tresc',
    rows: '3',
    maxlength: String(MAKS_ZNAKOW),
    placeholder: 'Napisz, o co zapytać — wymiary, materiał, termin…',
  });

  // Pole-pułapka: ukryte i wyłączone z nawigacji klawiaturą oraz
  // z czytników ekranu, żeby nie przeszkadzało człowiekowi.
  const pulapka = h('input', {
    class: 'watek-pulapka',
    type: 'text',
    name: 'firma',
    tabindex: '-1',
    autocomplete: 'off',
    'aria-hidden': 'true',
  });

  const licznik = h('span', { class: 'watek-licznik' }, '');
  const wyslij = h('button', { class: 'btn', type: 'submit' }, 'Wyślij wiadomość');

  const odswiezLicznik = () => {
    const zostalo = MAKS_ZNAKOW - pole.value.length;
    licznik.textContent = zostalo < 200 ? `zostało ${zostalo} znaków` : '';
  };
  pole.addEventListener('input', odswiezLicznik);

  const formularz = h(
    'form',
    { class: 'watek-form' },
    h('label', { class: 'watek-etykieta', for: 'watek-tresc' }, 'Pytanie do Dawida'),
    pole,
    pulapka,
    h('div', { class: 'watek-akcje' }, wyslij, licznik),
    info
  );

  formularz.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tresc = pole.value.trim();
    if (!tresc) return pokazInfo(info, 'Proszę wpisać treść wiadomości.', false);

    wyslij.disabled = true;
    wyslij.textContent = 'Wysyłam…';
    try {
      const odp = await fetch(`${API_BASE}/oferta/napisz`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, tresc, pulapka: pulapka.value }),
      });
      const dane = await odp.json().catch(() => null);

      if (!dane?.ok) {
        pokazInfo(info, dane?.powod || 'Nie udało się wysłać. Proszę spróbować za chwilę.', false);
      } else {
        pole.value = '';
        odswiezLicznik();
        narysuj(lista, dane.rozmowa || []);
        pokazInfo(info, 'Wysłane — Dawid dostał powiadomienie i odpisze tutaj oraz mailem.', true);
      }
    } catch {
      pokazInfo(info, 'Brak połączenia. Proszę spróbować za chwilę albo zadzwonić: 796 991 128.', false);
    } finally {
      wyslij.disabled = false;
      wyslij.textContent = 'Wyślij wiadomość';
    }
  });

  narysuj(lista, poczatkowa);

  return h(
    'section',
    { class: 'watek-sekcja' },
    h('h4', { class: 'watek-tytul' }, 'Pytania do tej wyceny'),
    // W podglądzie zachęta „napisz tutaj" kłóciłaby się z brakiem pola.
    tylkoOdczyt
      ? h('p', { class: 'watek-wstep' }, 'Tak wygląda wątek u klienta. Odpowiadasz z jego karty w panelu.')
      : h(
          'p',
          { class: 'watek-wstep' },
          'Można napisać wprost tutaj — odpowiedź Dawida pojawi się w tym miejscu ' +
            'i przyjdzie na Państwa e-mail. Pilne sprawy najszybciej telefonicznie: ',
          h('a', { href: 'tel:+48796991128', 'data-miejsce': 'watek' }, '796 991 128'),
          '.'
        ),
    lista,
    // Podgląd właściciela: sam wątek, bez pola do pisania — Dawid odpowiada
    // z karty klienta w panelu, żeby wiadomość poszła jako „od Dawida",
    // a nie jako kolejny wpis klienta.
    tylkoOdczyt ? null : formularz
  );
}

/** Przerysowuje wątek od zera — po wysyłce serwer oddaje całą historię. */
function narysuj(lista, rozmowa) {
  if (!rozmowa.length) {
    lista.replaceChildren(
      h('li', { class: 'watek-pusto' }, 'Nie ma tu jeszcze żadnych wiadomości.')
    );
    return;
  }
  lista.replaceChildren(
    ...rozmowa.map((m) =>
      h(
        'li',
        { class: m.autor === 'dawid' ? 'od-dawida' : 'od-klienta' },
        h('span', { class: 'watek-kto' }, m.autor === 'dawid' ? 'Dawid Ząbek' : 'Państwo', ' · ', kiedy(m.utworzono)),
        h('span', { class: 'watek-tresc' }, m.tresc)
      )
    )
  );
}

const kiedy = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

function pokazInfo(info, tresc, udane) {
  info.textContent = tresc;
  info.className = 'watek-info' + (udane ? ' udane' : ' blad');
  info.hidden = false;
}

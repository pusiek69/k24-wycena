import { h, uprosc } from './dom.js';
import { FIRMY, firmaWgSlug, grubosciDekoru } from '../firms/index.js';
import { rodzajMaterialu } from '../engine/alternatywy.js';

/**
 * POMOCNICY — kreator wtopiony w rozmowę.
 *
 * Klient nie musi nic wymyślać ani wypisywać: pod wiadomością konsultanta
 * pojawia się dokładnie ten jeden element, którego teraz potrzeba —
 * karty materiałów, lista dekorów albo pola na wymiary. Kliknięcie wysyła
 * gotową odpowiedź, tak jakby klient ją napisał.
 *
 * Pisać nadal można normalnie — to skrót, nie przymus.
 *
 * ⚠ Żadnych cen: kwota pojawia się dopiero po zostawieniu kontaktu.
 */

/**
 * Rodzaje kamienia w kolejności, w jakiej pokazujemy je klientowi.
 * Opisy są po ludzku — klient rzadko wie, czym spiek różni się od konglomeratu.
 */
const RODZAJE = [
  {
    id: 'konglomerat',
    nazwa: 'Konglomerat kwarcowy',
    krotki: 'Najczęstszy wybór na blat kuchenny.',
    opis: 'Równy, powtarzalny wzór, nie chłonie plam. Nie stawiamy na nim gorących garnków.',
  },
  {
    id: 'spiek',
    nazwa: 'Spiek / gres wielkoformatowy',
    krotki: 'Wytrzyma gorący garnek prosto z palnika.',
    opis: 'Najbardziej odporny na temperaturę i zarysowania. Cieńszy, w dużych płytach.',
  },
  {
    id: 'naturalny',
    nazwa: 'Kamień naturalny',
    krotki: 'Granit, marmur, kwarcyt.',
    opis: 'Każda płyta inna — wzór robi natura. Wycena po obejrzeniu konkretnego bloku.',
  },
];

/**
 * 1. Rodzaj kamienia — pierwszy krok.
 *
 * Wcześniej od razu leciała lista wszystkich firm i przy sześciu dostawcach
 * robiła się z tego ściana nazw, z których klient i tak nic nie rozumie.
 * Najpierw pytamy więc o rodzaj materiału (to klient rozumie), a dopiero
 * potem pokazujemy kolekcje z tej jednej grupy.
 */
export function pomocnikRodzaj(wyslij) {
  const dostepne = RODZAJE.filter((r) => FIRMY.some((f) => rodzajMaterialu(f) === r.id));

  return ramka(
    'Jaki rodzaj kamienia?',
    h(
      'div',
      { class: 'pom-karty' },
      dostepne.map((r) =>
        h(
          'button',
          {
            class: 'pom-karta',
            type: 'button',
            onclick: () => wyslij('rodzaj:' + r.id, `Interesuje mnie ${r.nazwa.toLowerCase()}.`),
          },
          h('span', { class: 'pom-karta-nazwa' }, r.nazwa),
          h('span', { class: 'pom-karta-typ' }, r.krotki),
          h('span', { class: 'pom-karta-opis' }, r.opis)
        )
      ),
      h(
        'button',
        {
          class: 'pom-karta pom-karta-pomoc',
          type: 'button',
          onclick: () => wyslij(null, 'Nie wiem, jaki kamień wybrać — proszę doradzić.'),
        },
        h('span', { class: 'pom-karta-nazwa' }, 'Nie wiem, proszę doradzić'),
        h('span', { class: 'pom-karta-opis' }, 'Kilka pytań i podpowiemy, co pasuje do Pana/Pani kuchni.')
      )
    )
  );
}

/** 2. Kolekcja — firmy z wybranego rodzaju kamienia. */
export function pomocnikMaterial(wyslij, rodzaj) {
  const firmy = rodzaj ? FIRMY.filter((f) => rodzajMaterialu(f) === rodzaj) : FIRMY;
  const opisRodzaju = RODZAJE.find((r) => r.id === rodzaj);

  return ramka(
    opisRodzaju ? `Kolekcje — ${opisRodzaju.nazwa.toLowerCase()}` : 'Wybierz materiał',
    h(
      'div',
      { class: 'pom-karty' },
      firmy.map((f) =>
        h(
          'button',
          {
            class: 'pom-karta',
            type: 'button',
            onclick: () => wyslij(f.slug, `Interesuje mnie ${f.nazwa}.`),
          },
          h('span', { class: 'pom-karta-nazwa' }, f.nazwa),
          h('span', { class: 'pom-karta-typ' }, f.typ),
          h('span', { class: 'pom-karta-opis' }, f.krotki)
        )
      ),
      h(
        'button',
        {
          class: 'pom-karta pom-karta-pomoc',
          type: 'button',
          onclick: () => wyslij(null, 'Nie wiem, którą kolekcję wybrać — proszę doradzić.'),
        },
        h('span', { class: 'pom-karta-nazwa' }, 'Nie wiem, proszę doradzić'),
        h('span', { class: 'pom-karta-opis' }, 'Podpowiemy, co pasuje do Pana/Pani kuchni.')
      )
    ),
    h(
      'button',
      {
        class: 'pom-pomin',
        type: 'button',
        onclick: () => wyslij('rodzaj:wstecz', 'Jednak wolę zobaczyć inny rodzaj kamienia.'),
      },
      '← Inny rodzaj kamienia'
    )
  );
}

/** 3. Dekor — lista wzorów wybranej kolekcji, z wyszukiwarką. */
export function pomocnikDekor(slug, wyslij) {
  const firma = firmaWgSlug(slug);
  if (!firma || firma.trybCeny === 'reczna') return null;

  const nazwy = Object.keys(firma.dekory || {}).sort((a, b) => a.localeCompare(b, 'pl'));
  const siatka = h('div', { class: 'pom-dekory' });

  const rysuj = (fraza = '') => {
    const q = uprosc(fraza);
    const widoczne = (q ? nazwy.filter((n) => uprosc(n).includes(q)) : nazwy).slice(0, 60);
    siatka.replaceChildren(
      ...(widoczne.length
        ? widoczne.map((n) =>
            h(
              'button',
              { class: 'pom-dekor', type: 'button', onclick: () => wyslij(n, `Wybieram dekor ${n}.`) },
              n
            )
          )
        : [h('p', { class: 'pusto' }, 'Nie ma takiego wzoru w tej kolekcji — proszę napisać, jak ma wyglądać.')])
    );
  };
  rysuj();

  return ramka(
    `Wybierz dekor — ${firma.nazwa}`,
    h(
      'div',
      { class: 'pom-narzedzia' },
      h('input', {
        class: 'search',
        type: 'search',
        placeholder: 'Szukaj, np. Calacatta…',
        oninput: (e) => rysuj(e.target.value),
      }),
      firma.linkDekory
        ? h(
            'a',
            { class: 'link-btn', href: firma.linkDekory.url, target: '_blank', rel: 'noopener' },
            '↗ Zobacz wzory'
          )
        : null
    ),
    siatka,
    h(
      'button',
      {
        class: 'pom-pomin',
        type: 'button',
        onclick: () => wyslij(null, 'Jeszcze nie wybrałem/wybrałam wzoru — proszę o pomoc w doborze.'),
      },
      'Nie wiem jeszcze — proszę doradzić'
    )
  );
}

/** 4. Wymiary — tyle odcinków, ile trzeba; głębokość podpowiedziana. */
export function pomocnikWymiary(wyslij) {
  const odcinki = [{ gl: 60, dl: '' }];
  const lista = h('div', { class: 'pom-odcinki' });

  const rysuj = () => {
    lista.replaceChildren(
      ...odcinki.map((o, i) =>
        h(
          'div',
          { class: 'pom-odcinek' },
          h('span', { class: 'pom-nr' }, `${i + 1}.`),
          polePom('głębokość', o.gl, (v) => (o.gl = v)),
          h('span', { class: 'pom-x' }, '×'),
          polePom('długość', o.dl, (v) => (o.dl = v), true),
          h('span', { class: 'pom-cm' }, 'cm'),
          odcinki.length > 1
            ? h(
                'button',
                {
                  class: 'icon-btn',
                  type: 'button',
                  'aria-label': 'Usuń odcinek',
                  onclick: () => {
                    odcinki.splice(i, 1);
                    rysuj();
                  },
                },
                '×'
              )
            : null
        )
      ),
      h(
        'button',
        {
          class: 'pom-dodaj',
          type: 'button',
          onclick: () => {
            odcinki.push({ gl: odcinki[odcinki.length - 1]?.gl || 60, dl: '' });
            rysuj();
          },
        },
        '+ kolejny odcinek (kuchnia w L lub U)'
      )
    );
  };
  rysuj();

  const gotowe = () => {
    const wazne = odcinki
      .map((o) => ({ gl: Number(o.gl) || 60, dl: Number(o.dl) || 0 }))
      .filter((o) => o.dl > 0);
    if (!wazne.length) return;
    wyslij('wymiary', 'Wymiary blatu: ' + wazne.map((o) => `${o.gl}×${o.dl} cm`).join(', ') + '.');
  };

  return ramka(
    'Podaj wymiary blatu',
    h('p', { class: 'pom-podpowiedz' }, 'Głębokość zwykle 60 cm — wystarczy wpisać długość.'),
    lista,
    h('button', { class: 'btn', type: 'button', onclick: gotowe }, 'Gotowe →')
  );
}

/**
 * 5. Szczegóły — trzy pytania na jednym ekranie.
 *
 * Zlew, płyta indukcyjna i liczba otworów pytane są ZAWSZE, bo każde
 * z nich realnie zmienia cenę. Wszystkie mają podstawione typowe wartości,
 * więc klient, któremu się spieszy, klika jeden przycisk — ale pytanie
 * i tak zobaczył i świadomie je zaakceptował.
 */
export function pomocnikSzczegoly(wyslij) {
  const wybor = { zlew: 'podwieszany', indukcja: 'nakładana', otwory: 1 };

  const grupa = (etykieta, klucz, opcje) =>
    h(
      'div',
      { class: 'pom-grupa' },
      h('span', { class: 'pom-grupa-label' }, etykieta),
      h(
        'div',
        { class: 'o-warianty' },
        opcje.map((o) =>
          h(
            'button',
            {
              class: 'wariant' + (wybor[klucz] === o ? ' sel' : ''),
              type: 'button',
              onclick: (e) => {
                wybor[klucz] = o;
                [...e.target.parentElement.children].forEach((b) => b.classList.remove('sel'));
                e.target.classList.add('sel');
              },
            },
            o
          )
        )
      )
    );

  // Liczba otworów: bateria, dozownik, gniazdko blatowe, przelew…
  const otwory = h(
    'div',
    { class: 'pom-grupa' },
    h('span', { class: 'pom-grupa-label' }, 'Otwory w blacie'),
    h(
      'div',
      { class: 'o-warianty' },
      [0, 1, 2, 3, 4].map((n) =>
        h(
          'button',
          {
            class: 'wariant' + (wybor.otwory === n ? ' sel' : ''),
            type: 'button',
            onclick: (e) => {
              wybor.otwory = n;
              [...e.target.parentElement.children].forEach((b) => b.classList.remove('sel'));
              e.target.classList.add('sel');
            },
          },
          n === 0 ? 'brak' : String(n)
        )
      )
    ),
    h(
      'span',
      { class: 'pom-podpowiedz' },
      'Bateria, dozownik do płynu, gniazdko blatowe, przelew — każdy otwór liczymy osobno.'
    )
  );

  return ramka(
    'Trzy szczegóły i liczymy',
    grupa('Zlew', 'zlew', ['podwieszany', 'nablatowy']),
    grupa('Płyta indukcyjna', 'indukcja', ['nakładana', 'licowana z blatem']),
    otwory,
    h(
      'div',
      { class: 'nav' },
      h(
        'button',
        {
          class: 'btn',
          type: 'button',
          onclick: () =>
            wyslij(
              'szczegoly',
              `Zlew ${wybor.zlew}, płyta indukcyjna ${wybor.indukcja}, ` +
                `otwory w blacie: ${wybor.otwory}. Proszę o wycenę.`
            ),
        },
        'Policz wycenę →'
      )

    )
  );
}

/* ------------------------------------------------------------ pomocnicze */

function ramka(tytul, ...tresc) {
  return h('div', { class: 'pomocnik' }, h('div', { class: 'pom-tytul' }, tytul), tresc);
}

function polePom(etykieta, wartosc, ustaw, autofokus) {
  return h('input', {
    class: 'pom-pole',
    type: 'number',
    inputmode: 'numeric',
    min: '1',
    step: '1',
    value: wartosc,
    placeholder: etykieta,
    'aria-label': etykieta + ' w centymetrach',
    autofocus: autofokus || null,
    oninput: (e) => ustaw(e.target.value),
  });
}

export { grubosciDekoru };

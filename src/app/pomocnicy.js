import { h, uprosc } from './dom.js';
import { FIRMY, firmaWgSlug, grubosciDekoru } from '../firms/index.js';
import { rodzajMaterialu } from '../engine/alternatywy.js';
import { normalizujKodPlyty } from './plyta-kod.js';

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
 * 0. Pomieszczenie — o co w ogóle chodzi.
 *
 * Kuchnia i łazienka różnią się na tyle, że dalsze pytania nie mogą być te
 * same: w łazience nie ma płyty indukcyjnej, bywają dwie umywalki, a klient
 * częściej ma już gotowy blat pod wymiar i chce go tylko odebrać. Pytanie jest
 * pierwsze, bo od odpowiedzi zależy cała reszta kreatora.
 */
export function pomocnikPomieszczenie(wyslij) {
  const wybory = [
    {
      id: 'kuchnia',
      nazwa: 'Blat kuchenny',
      krotki: 'Zabudowa kuchenna, wyspa, parapet przy oknie.',
      opis: 'Pytamy o zlew, płytę indukcyjną i otwory. Zawsze z pomiarem i montażem.',
      wiadomosc: 'Potrzebuję blatu kuchennego.',
    },
    {
      id: 'lazienka',
      nazwa: 'Blat łazienkowy',
      krotki: 'Pod umywalkę, nablatową lub podwieszaną.',
      opis: 'Pytamy o umywalki i otwory. Można też odebrać blat samemu, bez montażu.',
      wiadomosc: 'Potrzebuję blatu łazienkowego.',
    },
  ];

  return ramka(
    'Blat do kuchni czy do łazienki?',
    h(
      'div',
      { class: 'pom-karty' },
      wybory.map((p) =>
        h(
          'button',
          {
            class: 'pom-karta',
            type: 'button',
            onclick: () => wyslij('pomieszczenie:' + p.id, p.wiadomosc),
          },
          h('span', { class: 'pom-karta-nazwa' }, p.nazwa),
          h('span', { class: 'pom-karta-typ' }, p.krotki),
          h('span', { class: 'pom-karta-opis' }, p.opis)
        )
      )
    )
  );
}

/**
 * 1. Rodzaj kamienia — drugi krok.
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

  // Przy 143 wzorach (Atlas Plan) nie wysypujemy wszystkiego na ekran —
  // pokazujemy pierwsze 60, reszta jest pod wyszukiwarką. Ucięcie MUSI być
  // widoczne: bez tej informacji wzory z końca alfabetu (np. White Quartz)
  // po prostu znikały i klient nie miał skąd wiedzieć, że istnieją.
  const LIMIT = 60;

  const rysuj = (fraza = '') => {
    const q = uprosc(fraza);
    const pasujace = q ? nazwy.filter((n) => uprosc(n).includes(q)) : nazwy;
    const widoczne = pasujace.slice(0, LIMIT);
    const ukryte = pasujace.length - widoczne.length;

    siatka.replaceChildren(
      ...(widoczne.length
        ? [
            ...widoczne.map((n) =>
              h(
                'button',
                { class: 'pom-dekor', type: 'button', onclick: () => wyslij(n, `Wybieram dekor ${n}.`) },
                n
              )
            ),
            ...(ukryte > 0
              ? [
                  h(
                    'p',
                    { class: 'pom-dekory-wiecej' },
                    `…i jeszcze ${ukryte} ${ukryte === 1 ? 'wzór' : ukryte < 5 ? 'wzory' : 'wzorów'} — proszę wpisać nazwę w wyszukiwarce powyżej.`
                  ),
                ]
              : []),
          ]
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
        '+ kolejny odcinek (blat w L lub U)'
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
 * 5. Szczegóły — kilka pytań na jednym ekranie.
 *
 * Każde z nich realnie zmienia cenę i każde ma podstawioną typową wartość,
 * więc klient, któremu się spieszy, klika jeden przycisk — ale pytanie i tak
 * zobaczył i świadomie je zaakceptował.
 *
 * Zestaw pytań zależy od pomieszczenia:
 *   • kuchnia  — zlew, płyta indukcyjna, otwory. Zawsze z montażem.
 *   • łazienka — umywalka (rodzaj i liczba), otwory, montaż albo odbiór własny.
 *     O płytę indukcyjną nie pytamy, bo w łazience jej nie ma.
 */
export function pomocnikSzczegoly(wyslij, pomieszczenie = 'kuchnia') {
  const lazienka = pomieszczenie === 'lazienka';
  const wybor = {
    zlew: lazienka ? 'podwieszana' : 'podwieszany',
    zlewy: 1,
    indukcja: 'nakładana',
    otwory: 1,
    dostawa: 'montaz',
  };

  /** Grupa przycisków, gdzie wartością jest sama etykieta. */
  const grupa = (etykieta, klucz, opcje, podpowiedz) =>
    grupaOgolna(
      etykieta,
      opcje.map((o) => [o, o]),
      () => wybor[klucz],
      (v) => (wybor[klucz] = v),
      podpowiedz
    );

  /** Grupa przycisków, gdzie wartość i etykieta są różne. */
  const grupaOgolna = (etykieta, pary, czytaj, ustaw, podpowiedz) =>
    h(
      'div',
      { class: 'pom-grupa' },
      h('span', { class: 'pom-grupa-label' }, etykieta),
      h(
        'div',
        { class: 'o-warianty' },
        pary.map(([wartosc, opis]) =>
          h(
            'button',
            {
              class: 'wariant' + (czytaj() === wartosc ? ' sel' : ''),
              type: 'button',
              onclick: (e) => {
                ustaw(wartosc);
                [...e.target.parentElement.children].forEach((b) => b.classList.remove('sel'));
                e.target.classList.add('sel');
              },
            },
            opis
          )
        )
      ),
      podpowiedz ? h('span', { class: 'pom-podpowiedz' }, podpowiedz) : null
    );

  const liczby = (od, ile) => Array.from({ length: ile }, (_, i) => od + i);

  // Otwory: bateria, dozownik, gniazdko blatowe, przelew…
  const otwory = grupaOgolna(
    'Otwory w blacie',
    liczby(0, 7).map((n) => [n, n === 0 ? 'brak' : String(n)]),
    () => wybor.otwory,
    (v) => (wybor.otwory = v),
    lazienka
      ? 'Bateria, dozownik, przelew — każdy otwór liczymy osobno.'
      : 'Bateria, dozownik do płynu, gniazdko blatowe, przelew — każdy otwór liczymy osobno.'
  );

  // Odbiór własny zdejmuje z wyceny montaż i transport, ale przenosi na
  // klienta odpowiedzialność za wymiary — dlatego podpowiedź mówi o tym
  // wprost już przy wyborze, a nie dopiero na karcie z ceną. W kuchni tego
  // wyboru nie ma: blat kuchenny montujemy zawsze, po własnym pomiarze.
  const montaz = grupaOgolna(
    'Montaż',
    [
      ['montaz', 'z montażem u klienta'],
      ['odbior', 'bez montażu — odbiór własny'],
    ],
    () => wybor.dostawa,
    (v) => (wybor.dostawa = v),
    'Przy odbiorze własnym nie robimy pomiaru — blat tniemy ściśle wg podanych wymiarów, ' +
      'a odbiór jest w zakładzie przy ul. Szpitalnej 8 w Tarnobrzegu.'
  );

  const opis = () =>
    lazienka
      ? `Umywalka ${wybor.zlew}, liczba umywalek: ${wybor.zlewy}, ` +
        `otwory w blacie: ${wybor.otwory}, ` +
        (wybor.dostawa === 'odbior'
          ? 'bez montażu — odbiór własny z zakładu'
          : 'z montażem u klienta') +
        '. Proszę o wycenę blatu łazienkowego.'
      : `Zlew ${wybor.zlew}, płyta indukcyjna ${wybor.indukcja}, ` +
        `otwory w blacie: ${wybor.otwory}, z montażem u klienta. ` +
        'Proszę o wycenę blatu kuchennego.';

  return ramka(
    'Kilka szczegółów i liczymy',
    ...(lazienka
      ? [
          grupa('Umywalka', 'zlew', ['podwieszana', 'nablatowa']),
          grupaOgolna(
            'Liczba umywalek',
            liczby(1, 3).map((n) => [n, String(n)]),
            () => wybor.zlewy,
            (v) => (wybor.zlewy = v),
            'Każde wycięcie to osobna robota — przy dwóch umywalkach liczymy dwa.'
          ),
          otwory,
          montaz,
        ]
      : [
          grupa('Zlew', 'zlew', ['podwieszany', 'nablatowy']),
          grupa('Płyta indukcyjna', 'indukcja', ['nakładana', 'licowana z blatem']),
          otwory,
        ]),
    h(
      'div',
      { class: 'nav' },
      h('button', { class: 'btn', type: 'button', onclick: () => wyslij('szczegoly', opis()) }, 'Policz wycenę →')
    )
  );
}

/**
 * WYBÓR KONKRETNEJ PŁYTY — kamień naturalny.
 *
 * Kamienia naturalnego nie da się wycenić „ogólnie": ten sam wzór to
 * kilkanaście bloków o różnej cenie, wymiarze i dostępności. Klient wskazuje
 * więc jedną płytę — klikając w liście albo wpisując kod ze strony magazynu.
 *
 * Lista pokazuje to, co realnie decyduje o wyborze: wymiar (czy odcinek
 * zmieści się bez łączenia), cenę za m² i ile metrów zostało.
 */
export function pomocnikPlyty(plyty, nazwa, wybierz) {
  const dostepne = (plyty || [])
    .filter((p) => p.kod && p.dostepneM2 > 0 && p.cenaBruttoM2 > 0 && p.formatCm)
    .sort((a, b) => b.cenaBruttoM2 - a.cenaBruttoM2 || 0)
    .slice(0, 24);

  const pole = h('input', {
    class: 'pom-pole pom-pole-kod',
    type: 'text',
    placeholder: 'STON000334-84224',
    'aria-label': 'Kod płyty z magazynu',
    autocapitalize: 'characters',
    spellcheck: 'false',
  });
  const blad = h('span', { class: 'pom-podpowiedz pom-blad' }, '');

  const zPola = () => {
    const kod = normalizujKodPlyty(pole.value);
    if (!kod) {
      blad.textContent = 'Kod ma postać STON000334-84224 — proszę sprawdzić zapis.';
      pole.focus();
      return;
    }
    blad.textContent = '';
    wybierz(kod);
  };

  const wiersz = (p) => {
    const dl = Math.max(p.formatCm.wys, p.formatCm.szer);
    const gl = Math.min(p.formatCm.wys, p.formatCm.szer);
    const kod = normalizujKodPlyty(p.kod) || p.kod;
    return h(
      'button',
      { class: 'pom-plyta', type: 'button', onclick: () => wybierz(kod) },
      h('span', { class: 'pom-plyta-nazwa' }, p.nazwa),
      h(
        'span',
        { class: 'pom-plyta-dane' },
        `${liczbaPL(dl)} × ${liczbaPL(gl)} cm` +
          (p.gruboscMm ? ` · ${liczbaPL(p.gruboscMm)} mm` : '') +
          ` · ${liczbaPL(p.cenaBruttoM2)} zł/m²` +
          ` · wolne ${liczbaPL(p.dostepneM2)} m²`
      ),
      h('span', { class: 'pom-plyta-kod' }, kod)
    );
  };

  const link = plyty?.find((p) => p.link)?.link;

  return ramka(
    nazwa ? `Wybierz płytę — ${nazwa}` : 'Wybierz konkretną płytę',
    h(
      'p',
      { class: 'pom-podpowiedz' },
      'Każdy blok kamienia naturalnego ma własną cenę i wymiar, dlatego wycenę ' +
        'liczymy z konkretnej płyty.'
    ),
    dostepne.length
      ? h('div', { class: 'pom-plyty' }, dostepne.map(wiersz))
      : h(
          'p',
          { class: 'pusto' },
          'Nie widzę teraz wolnych płyt tego wzoru. Proszę wpisać kod ze strony magazynu albo zadzwonić.'
        ),
    h(
      'div',
      { class: 'pom-grupa' },
      h('span', { class: 'pom-grupa-label' }, 'Albo wpisz kod płyty'),
      h('div', { class: 'pom-narzedzia' }, pole, h('button', { class: 'btn', type: 'button', onclick: zPola }, 'Sprawdź')),
      blad
    ),
    link
      ? h('a', { class: 'link-btn', href: link, target: '_blank', rel: 'noopener' }, '↗ Zobacz płyty w magazynie')
      : null
  );
}

/* ------------------------------------------------------------ pomocnicze */

/** Liczba po polsku, bez zbędnych zer po przecinku. */
function liczbaPL(n) {
  return (Math.round(Number(n) * 10) / 10).toLocaleString('pl-PL');
}

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

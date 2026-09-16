/**
 * ══════════════════════════════════════════════════════════════════════════
 *  WPROWADZANIE GŁOSOWE — porządkowanie tego, co zrozumiał model
 *  (zlecenie Dawida, 16.09.2026)
 *
 *  „Mówię imię, nazwisko, email, telefon, wymiary blatów, a na tej podstawie
 *   uzupełniają się dane w kalkulatorze."
 *
 *  Droga jest trzystopniowa i każdy stopień może się pomylić:
 *    mikrofon (Web Speech API) → model (worker/dyktando.js) → TEN MODUŁ.
 *
 *  Dlatego ostatni stopień jest głupi i nieufny: nie rozumie mowy, tylko
 *  sprawdza, czy to, co dostał, nadaje się do wpisania w pole formularza.
 *  Model dostaje polecenie, żeby oddawać dane już znormalizowane — ale
 *  polecenie to nie gwarancja, a z tych liczb wychodzi kwota dla klienta.
 *
 *  ŻADNA z tych funkcji niczego nie zapisuje. Wynik ląduje w polach
 *  formularza, które Dawid ogląda i poprawia, zanim kliknie „Zapisz" —
 *  to jest cała obrona przed przesłyszeniem się mikrofonu.
 *
 *  Moduł jest wspólny dla przeglądarki i workera (jak `termin.js`
 *  czy `etykiety-odcinkow.js`), żeby panel i edytor nie rozjechały się
 *  własnymi kopiami tych samych reguł.
 * ══════════════════════════════════════════════════════════════════════════
 */

import { czystaEtykieta, opisOdcinkaZWymiarem } from './etykiety-odcinkow.js';

/**
 * Limit długości transkryptu. Dyktando przy kliencie to kilka zdań;
 * dwa tysiące znaków to już wypadek (mikrofon został włączony i słucha
 * całej rozmowy), a każdy znak idzie do modelu za pieniądze Dawida.
 */
export const MAKS_TRANSKRYPT = 2000;

/** Najkrótszy sensowny transkrypt — poniżej tego nie ma czego rozpoznawać. */
export const MIN_TRANSKRYPT = 3;

/** Wymiar odcinka w centymetrach — poza tym zakresem to przesłyszenie. */
export const MIN_CM = 10;
export const MAKS_CM = 1200;

/** Ile odcinków przyjmujemy z jednego dyktanda. */
export const MAKS_ODCINKOW = 12;

/**
 * Głębokość przyjęta, gdy padł tylko jeden wymiar („blat trzysta").
 *
 * Standardowy blat kuchenny ma 60 cm i taką głębokość ma większość wycen
 * w bazie — ale to i tak jest ZGADYWANIE, więc odcinek dostaje znacznik
 * `domyslnaGlebokosc`, ekran mówi o tym wprost, a Dawid poprawia jednym
 * kliknięciem. Milczące wstawienie liczby, której nikt nie powiedział,
 * byłoby najgorszym wariantem: weszłoby do ceny niezauważone.
 */
export const GLEBOKOSC_DOMYSLNA = 60;

/* ─────────────────────────────────────────────────────────── transkrypt */

/**
 * Transkrypt do wysłania. Rozpoznawanie mowy potrafi oddać tekst
 * z podwójnymi spacjami i bez kropek — to normalne i nie przeszkadza.
 * Obcinamy tylko długość i znaki sterujące.
 */
export function czystyTranskrypt(tekst) {
  return String(tekst ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAKS_TRANSKRYPT);
}

/* ──────────────────────────────────── sklejanie rozpoznanych fragmentów */

/**
 * Fragmenty od rozpoznawania mowy → jeden transkrypt.
 *
 * ⚠ ZGŁOSZENIE DAWIDA Z 16.09.2026, godzinę po wdrożeniu:
 *   „dubluje strasznie — źle zczytuje co mówię i POWTARZA CYFRY".
 *
 * Chrome POPRAWIA wcześniejsze fragmenty — zwłaszcza liczby, bo „sześćset
 * sto" doprecyzowuje dopiero po usłyszeniu ciągu dalszego — i zgłasza ten
 * sam, już zamknięty kawałek jeszcze raz. Kto dokleja „tylko nowe" wyniki
 * od `resultIndex`, dostaje wtedy „600 100 600 100 200".
 *
 * Dlatego transkrypt składamy ZA KAŻDYM RAZEM OD ZERA z całej listy
 * wyników — ta operacja niczego nie pamięta, więc nie ma czego policzyć
 * dwa razy. Na wierzchu zostaje jeszcze odsiew sąsiadujących blizniąt:
 * nikt nie dyktuje dwa razy pod rząd tej samej frazy, a rozpoznawanie
 * potrafi ją powtórzyć przy przerwie w mówieniu.
 */
/** Segment na słowa — porównujemy wypowiedzi, nie znaki. */
const slowa = (t) => t.toLowerCase().split(' ').filter(Boolean);

/** Czy `b` zaczyna się od CAŁEGO `a` (słowo w słowo). */
function zaczynaSieOd(b, a) {
  const x = slowa(a);
  const y = slowa(b);
  if (!x.length || y.length < x.length) return false;
  return x.every((w, k) => w === y[k]);
}

/**
 * Fragmenty od rozpoznawania mowy → jeden transkrypt.
 *
 * Chrome z `continuous` zamyka wypowiedź na krótkiej pauzie, a następny
 * wynik końcowy POWTARZA ją w całości i przedłuża:
 *
 *     „sześćset sto"  →  „sześćset sto dwieście"
 *
 * Złożone naiwnie daje „sześćset sto sześćset sto dwieście" — dokładnie to,
 * co Dawid nazwał „powtarza cyfry" (16.09.2026, drugie zgłoszenie; pierwsze
 * dotyczyło innej przyczyny — narastającego bufora).
 *
 * Reguła jest WĄSKA I DOSŁOWNA: nowy fragment zastępuje poprzedni tylko
 * wtedy, gdy zaczyna się od CAŁEGO poprzedniego. Kusiło, żeby ciąć każdą
 * wspólną zakładkę słów — ale wtedy „dwa blaty po dwieście" + „dwieście
 * dwadzieścia parapet" zlepiłoby się w jeden wymiar i JEDEN BLAT BY ZNIKNĄł.
 * Lepiej zostawić czasem zbędne słowo (model i tak je zignoruje) niż po cichu
 * skasować podyktowany wymiar.
 */
export function sklejSegmenty(segmenty) {
  const czyste = (Array.isArray(segmenty) ? segmenty : [])
    .map((t) => String(t ?? '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const przyjete = [];
  for (const segment of czyste) {
    const ostatni = przyjete[przyjete.length - 1];
    if (!ostatni) {
      przyjete.push(segment);
      continue;
    }
    // Krótsze powtórzenie tego samego (też: dokładnie to samo) — pomijamy.
    if (zaczynaSieOd(ostatni, segment)) continue;
    // Doprecyzowanie poprzedniego fragmentu — podmieniamy, nie doklejamy.
    if (zaczynaSieOd(segment, ostatni)) {
      przyjete[przyjete.length - 1] = segment;
      continue;
    }
    przyjete.push(segment);
  }
  return przyjete.join(' ');
}

/* ──────────────────────────────────────────────────────────────── telefon */

/**
 * Telefon → dziewięć cyfr albo pusto.
 *
 * Dyktowany numer przychodzi w każdej możliwej postaci: „sześćset sto dwieście"
 * model zamieni na cyfry, ale prefiks kraju dopisze raz tak, raz inaczej.
 * Baza trzyma dziewięciocyfrowy klucz (`kluczTelefonu` w worker/baza.js),
 * więc tutaj sprowadzamy wszystko do tych samych dziewięciu cyfr.
 */
export function normalizujTelefon(tekst) {
  let c = String(tekst ?? '').replace(/\D/g, '');
  if (c.length === 13 && c.startsWith('0048')) c = c.slice(4);
  if (c.length === 11 && c.startsWith('48')) c = c.slice(2);
  if (c.length === 10 && c.startsWith('0')) c = c.slice(1);
  return c.length === 9 ? c : '';
}

/* ───────────────────────────────────────────────────────────────── e-mail */

/** Słowa, którymi dyktuje się znaki adresu. Klucz po złożeniu liter małych. */
const SLOWA_ADRESU = [
  [/^(malpa|malpka|at|atka|maupa)$/, '@'],
  [/^(kropka|kropke|dot|punkt)$/, '.'],
  [/^(myslnik|minus|kreska|dash|polpauza)$/, '-'],
  [/^(podkreslnik|podkreslenie|underscore|podloga)$/, '_'],
  [/^(ukosnik|slash)$/, '/'],
];

/** „ą" → „a", „ł" → „l" — w adresach mailowych polskich znaków nie ma. */
const bezOgonkow = (s) =>
  String(s)
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/**
 * Adres e-mail z dyktanda → zapis kanoniczny albo pusto.
 *
 * Dawid dyktuje „anna kropka kowalska małpa gmail kropka com" i tak to
 * słyszy przeglądarka. Model ma to składać sam, ale gdy się nie uda,
 * składamy tutaj — bo adres wpisany z „małpa" w środku poszedłby do bazy
 * i mail z ofertą nigdy by nie doszedł.
 *
 * Gdy wynik nie wygląda na adres, oddajemy PUSTE. Pole zostaje puste,
 * Dawid je dopisze — a zapis bez maila i tak jest dozwolony.
 */
export function normalizujEmail(tekst) {
  const surowy = bezOgonkow(String(tekst ?? '').toLowerCase().trim());
  if (!surowy) return '';

  const zlozony = surowy
    .split(/\s+/)
    .map((slowo) => {
      const goly = slowo.replace(/[.,;:!?]+$/, '');
      for (const [wzor, znak] of SLOWA_ADRESU) if (wzor.test(goly)) return znak;
      return slowo;
    })
    .join('')
    .replace(/\s+/g, '')
    // Kropka na końcu zdania („…kropka com.") nie jest częścią adresu.
    .replace(/[.,;:]+$/, '');

  // Ten sam wzorzec, którym broni się zapis w bazie (worker/baza.js) —
  // żeby pole nie przyjęło czegoś, co i tak odbije się przy zapisie.
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(zlozony) ? zlozony : '';
}

/* ──────────────────────────────────────────────────────────────── odcinki */

/**
 * Liczba wymiaru w centymetrach.
 *
 * „Dwa metry dwadzieścia" model zwykle przelicza sam, ale gdy odda „2.2",
 * to znaczy metry — bo blatu o głębokości dwóch centymetrów nie ma.
 * Przeliczamy zamiast odrzucać: odrzucony wymiar to puste pole, a puste
 * pole przy wycenie jest gorsze niż wymiar do sprawdzenia.
 */
function naCentymetry(wartosc) {
  const n = Number(String(wartosc ?? '').replace(',', '.').replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n < MIN_CM ? n * 100 : n);
}

/**
 * Jeden odcinek z dyktanda → `{ gl, dl, etykieta }` albo `null`.
 *
 * ⚠ Bok większy zawsze idzie na DŁUGOŚĆ, mniejszy na GŁĘBOKOŚĆ — niezależnie
 * od tego, co model wpisał w które pole. Po polsku mówi się „blat trzysta
 * na sześćdziesiąt" i „blat sześćdziesiąt na trzysta" o tym samym blacie,
 * więc kolejność w zdaniu nic nie znaczy. Blatu głębszego niż dłuższego
 * nie robi się w kuchni ani w łazience, a zamienione boki dałyby inny
 * rozkrój płyty i inną liczbę płyt — czyli inną cenę.
 */
export function normalizujOdcinek(surowy) {
  const a = naCentymetry(surowy?.dlugosc_cm);
  const b = naCentymetry(surowy?.glebokosc_cm);
  const etykieta = czystaEtykieta(surowy?.etykieta);
  const podpis = etykieta ? { etykieta } : {};

  /*
   * JEDEN WYMIAR („blat trzysta", „parapet sto dwadzieścia”) — przy ladzie
   * mówi się tak nagminnie, bo głębokość „oczywiście” jest standardowa.
   * Podstawiamy 60 cm i ZNACZYMY to, zamiast wyrzucać cały odcinek:
   * wymiar do sprawdzenia jest lepszy niż wymiar, który przepadł, ale
   * tylko dopóki widać, że ktoś go zgadnął.
   *
   * Tu NIE stosujemy reguły „większy bok to długość": wypowiedziana liczba
   * jest długością, a 60 głębokością — także wtedy, gdy padło mniej niż 60.
   */
  if ((a > 0) !== (b > 0)) {
    const dl = a || b;
    if (dl < MIN_CM || dl > MAKS_CM) return null;
    return { gl: GLEBOKOSC_DOMYSLNA, dl, domyslnaGlebokosc: true, ...podpis };
  }

  const dl = Math.max(a, b);
  const gl = Math.min(a, b);
  if (gl < MIN_CM || dl > MAKS_CM) return null;

  return { gl, dl, ...podpis };
}

/** Lista odcinków z dyktanda — bez tych, których nie dało się odczytać. */
export const normalizujOdcinki = (lista) =>
  (Array.isArray(lista) ? lista : [])
    .map(normalizujOdcinek)
    .filter(Boolean)
    .slice(0, MAKS_ODCINKOW);

/* ───────────────────────────────────────────────────────────── scalanie */

const tekstPola = (x, limit) => String(x ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);

/**
 * Notatka z dyktanda.
 *
 * Materiał („chce spiek", „granit czarny") wychodzi z dyktanda osobnym
 * polem, ale w panelu nie ma dla niego rubryki — kategorię i dekor wybiera
 * się dopiero w wycenie. Zamiast go gubić, dopisujemy go NA WIDOKU,
 * do notatki, żeby Dawid zobaczył, co usłyszał mikrofon, i mógł to
 * skasować jednym ruchem.
 */
export function notatkaZDyktanda(notatka, material) {
  const n = tekstPola(notatka, 2000);
  const m = tekstPola(material, 120);
  if (!m) return n;
  // Bez powtarzania: model często wplata materiał także w samą notatkę.
  if (n.toLowerCase().includes(m.toLowerCase())) return n;
  return n ? `Materiał: ${m}. ${n}` : `Materiał: ${m}`;
}

/**
 * Wymiary jednym zdaniem — do NOTATKI, nie do pól.
 *
 * Formularz „klient z biura" nie ma rubryki na odcinki (wymiary wpisuje się
 * dopiero w wycenie), a Dawid i tak je przy kliencie dyktuje. Zamiast je
 * wyrzucić, dopisujemy je do notatki — po to, żeby przy oddzwanianiu było
 * wiadomo, o jakim blacie była mowa.
 */
export function wymiaryDoNotatki(odcinki) {
  const lista = (odcinki || []).map(opisOdcinkaZWymiarem);
  return lista.length ? `Wymiary: ${lista.join(' + ')} cm` : '';
}

/**
 * Surowa odpowiedź modelu → dane gotowe do wpisania w pola.
 *
 * `rozpoznane` to lista pól, które naprawdę czymś wypełniliśmy — po niej
 * ekran podświetla to, co przyszło z mikrofonu, i po niej widać, że
 * np. mail odpadł na walidacji, mimo że model coś tam zwrócił.
 *
 * Czego tu NIE MA i być nie może: zapisu, wysyłki, liczenia ceny.
 */
export function scalDyktando(surowe) {
  const d = surowe && typeof surowe === 'object' ? surowe : {};

  const imie = tekstPola([d.imie, d.nazwisko].filter(Boolean).join(' '), 120);
  const dane = {
    imie,
    telefon: normalizujTelefon(d.telefon),
    email: normalizujEmail(d.email),
    miejscowosc: tekstPola(d.miejscowosc, 80),
    temat: tekstPola(d.temat, 40),
    notatka: notatkaZDyktanda(d.notatka, d.material),
    odcinki: normalizujOdcinki(d.odcinki),
  };

  dane.rozpoznane = Object.keys(dane).filter((k) =>
    Array.isArray(dane[k]) ? dane[k].length > 0 : !!dane[k]
  );
  // Dokładane PO `rozpoznane`, bo to nie jest osobne pole formularza —
  // tylko ten sam komplet odcinków opisany słowami, dla panelu.
  dane.wymiary = wymiaryDoNotatki(dane.odcinki);
  return dane;
}

/** Ile odcinków dostało głębokość z domysłu, a nie z wypowiedzi. */
export const zgadnieteGlebokosci = (odcinki) =>
  (odcinki || []).filter((o) => o?.domyslnaGlebokosc).length;

/**
 * Zdanie doklejane do komunikatu, gdy cokolwiek zgadliśmy. Osobno, bo
 * mówi o czymś innym niż reszta: nie „co wpisałem", tylko „czego
 * nie powiedziałeś, a i tak się pojawiło".
 */
export function ostrzezenieOGlebokosci(odcinki) {
  const ile = zgadnieteGlebokosci(odcinki);
  if (!ile) return '';
  return ile === 1
    ? `Głębokość ${GLEBOKOSC_DOMYSLNA} cm przyjąłem z domysłu — sprawdź.`
    : `Głębokość ${GLEBOKOSC_DOMYSLNA} cm przyjąłem z domysłu w ${ile} odcinkach — sprawdź.`;
}

/** Czy z dyktanda wyszło cokolwiek do wpisania. */
export const pusteDyktando = (dane) => !(dane?.rozpoznane || []).length;

/**
 * Jednozdaniowe podsumowanie dla Dawida: co wpisałem, czego nie.
 *
 * Komunikat jest po polsku i mówi o polach formularza, a nie o kluczach
 * JSON-a — to jedyna informacja zwrotna, jaką dostanie ktoś, kto właśnie
 * mówił do mikrofonu i patrzy na formularz, a nie w konsolę.
 */
export function opisDyktanda(dane) {
  const nazwy = {
    imie: 'imię i nazwisko',
    telefon: 'telefon',
    email: 'e-mail',
    miejscowosc: 'miejscowość',
    temat: 'temat',
    notatka: 'notatka',
  };
  const lista = (dane?.rozpoznane || []).filter((k) => nazwy[k]).map((k) => nazwy[k]);
  const ile = (dane?.odcinki || []).length;
  if (ile) lista.push(ile === 1 ? '1 odcinek' : `${ile} odcinki/ów`);
  if (!lista.length) return 'Nic nie rozpoznałem — powiedz jeszcze raz albo wpisz ręcznie.';
  return `Wpisałem: ${lista.join(', ')}. Sprawdź i popraw, zanim zapiszesz.`;
}

/**
 * TRELLO — czytanie tablicy „Usługi Kamieniarskie" i odhaczanie pozycji.
 *
 * Zlecenie Dawida (06.09.2026): pozycje do kupienia siedzą w checklistach
 * na kartach grobów. Dawid zamawiał je na raty, bo nigdzie nie widział
 * wszystkiego naraz — cztery ławeczki z czterech kart to cztery telefony
 * do dostawcy zamiast jednego.
 *
 * Ten plik robi DWIE rzeczy i nic więcej:
 *   • rozbiera tekst pozycji na produkt / ilość / dostawcę (czysta funkcja,
 *     testowalna bez sieci),
 *   • rozmawia z REST API Trello.
 *
 * Agregacja, statusy i baza są w `zakupy.js`. Rozdzielone celowo: parsowanie
 * to miejsce, w którym najłatwiej o cichy błąd („ławeczka ze skrzyneczką"
 * policzona osobno od „ławeczki"), więc ma być testowalne w gołym node.
 *
 * ⚠ NIC NIE PISZEMY DO TRELLO, dopóki Dawid nie wklei tokenu i nie zobaczy
 * podglądu. Funkcje zapisu są tu, ale panel woła je dopiero po akceptacji.
 */

const API = 'https://api.trello.com/1';

/** Nazwa checklisty, która jest źródłem pozycji zakupowych. */
export const CHECKLISTA = 'Zakupy';

/**
 * Karty, których NAZWA zaczyna się od „zamowic"/„zamówić" — Dawid pisał tak,
 * zanim powstała konwencja z checklistą. Nie traktujemy ich jak pozycji
 * (nie wiadomo, co i ile), tylko pokazujemy jako sugestie „to chyba też
 * do kupienia" — z linkiem do karty. Zero zgadywania za Dawida.
 */
const WZORZEC_SUGESTII = /^\s*zam[oó]wi?c?\b/i;

/* ────────────────────────────────────────────────── rozbiór tekstu pozycji */

/** Polskie znaki → ASCII. Tylko do KLUCZY porównawczych, nigdy do wyświetlania. */
export function bezOgonkow(t) {
  const z = { ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z' };
  return String(t || '')
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (c) => z[c] || c);
}

/*
 * Dopisek dostawcy: „ławeczka ze skrzyneczką — Kowalski".
 *
 * Bierzemy OSTATNI myślnik otoczony spacjami, bo sam produkt też potrafi
 * mieć myślnik („litery piaskowane - srebrne"). Half-dash, en-dash i em-dash
 * traktujemy tak samo — Dawid pisze z telefonu i wpadnie każdy z nich.
 */
const MYSLNIK = /\s+[—–-]\s+/g;

/** Ilość: „2x misa", „misa x2", „misa 2 szt", „3 szt. ławeczki". */
const WZORY_ILOSCI = [
  /^\s*(\d{1,3})\s*(?:x|szt\.?|sztuk[aiy]?)\s+/i, // na początku
  /\s+(?:x|szt\.?|sztuk[aiy]?)\s*(\d{1,3})\s*$/i, // na końcu, po „x"/„szt"
  /\s+(\d{1,3})\s*(?:x|szt\.?|sztuk[aiy]?)\s*$/i, // na końcu, przed „x"/„szt"
];

/**
 * SŁOWA, KTÓRE OPISUJĄ, A NIE NAZYWAJĄ.
 *
 * „misa granitowa" i „misa" to ta sama rzecz do zamówienia; „ławeczka ze
 * skrzyneczką" to nadal ławeczka. Klucz produktu budujemy więc z pierwszego
 * członu nazwy — w polskim to prawie zawsze rzeczownik główny — a resztę
 * odcinamy dopiero od pierwszego słowa opisującego.
 *
 * ⚠ To heurystyka, nie rozumienie języka. Dlatego istnieje tabela aliasów
 * (`zakupy_aliasy`): cokolwiek się tu nie zgadza, Dawid — albo podpowiedź
 * AI, którą zatwierdzi — poprawia raz i zostaje na stałe.
 */
const OPISOWE = /^(z|ze|na|do|w|pod|bez|typu|kolor|kolorze|granitow|marmurow|czarn|szar|bial|srebrn|zlot|piaskowan|polerowan|mal|duz|sred|prost|okragl|kwadratow)/i;

/**
 * Rozbiera jedną pozycję checklisty.
 *
 * @param {string} surowy tekst pozycji, tak jak stoi w Trello
 * @returns {{tresc, produkt, klucz, ilosc, dostawca}}
 */
export function rozbierzPozycje(surowy) {
  let tekst = String(surowy || '').trim();

  // Znacznik, który sami dopisujemy przy zamówieniu — nie może wrócić
  // do nazwy produktu przy następnej synchronizacji.
  tekst = tekst.replace(/\s*✅\s*(zamówione|otrzymane)[^|]*$/iu, '').trim();

  let dostawca = '';
  const czesci = tekst.split(MYSLNIK);
  if (czesci.length > 1) {
    const ogon = czesci[czesci.length - 1].trim();
    // Ogon to dostawca tylko wtedy, gdy wygląda jak nazwa: krótki i nie sama liczba.
    if (ogon && ogon.length <= 40 && !/^\d+$/.test(ogon)) {
      dostawca = ogon;
      tekst = czesci.slice(0, -1).join(' - ').trim();
    }
  }

  let ilosc = 1;
  for (const wzor of WZORY_ILOSCI) {
    const t = tekst.match(wzor);
    if (t) {
      ilosc = Math.max(1, Math.min(999, Number(t[1])));
      tekst = tekst.replace(wzor, ' ').trim();
      break;
    }
  }

  const produkt = tekst.replace(/\s{2,}/g, ' ').trim();
  return { tresc: String(surowy || '').trim(), produkt, klucz: kluczProduktu(produkt), ilosc, dostawca };
}

/**
 * Klucz, po którym sumujemy sztuki. „Ławeczka ze skrzyneczką", „ławeczka
 * granitowa" i „Ławeczka" mają dać jeden wiersz „ławeczki: 4 szt".
 */
export function kluczProduktu(nazwa) {
  const slowa = bezOgonkow(nazwa)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (!slowa.length) return '';

  const rdzen = [slowa[0]];
  for (const s of slowa.slice(1)) {
    if (OPISOWE.test(s)) break;
    rdzen.push(s);
  }
  // Uproszczona liczba mnoga/przypadek: „ławeczki"/„ławeczkę" → „laweczk".
  return rdzen.map((s) => (s.length > 5 ? s.replace(/(a|e|i|y|ow|ach|ami|om|e)$/, '') : s)).join(' ');
}

/* ─────────────────────────────────────────────────────── rozmowa z Trello */

/**
 * Jedno zapytanie do Trello. Nigdy nie rzuca — integracja z cudzym
 * serwisem nie ma prawa przewrócić panelu; oddajemy `{ok:false, blad}`
 * i panel to pokazuje.
 */
async function zapytaj(konfig, sciezka, opcje = {}) {
  if (!konfig?.klucz || !konfig?.token) return { ok: false, blad: 'Brak klucza albo tokenu Trello.' };
  const adres = new URL(API + sciezka);
  adres.searchParams.set('key', konfig.klucz);
  adres.searchParams.set('token', konfig.token);
  for (const [k, v] of Object.entries(opcje.parametry || {})) adres.searchParams.set(k, v);

  try {
    const odp = await fetch(adres, { method: opcje.metoda || 'GET' });
    if (!odp.ok) {
      const tresc = await odp.text().catch(() => '');
      // 401 to najczęstszy przypadek: token wygasł albo został cofnięty.
      const powod = odp.status === 401 ? 'Trello odrzuciło klucz lub token (401).' : `Trello: ${odp.status}`;
      console.error('trello', sciezka, odp.status, tresc.slice(0, 200));
      return { ok: false, blad: powod };
    }
    return { ok: true, dane: await odp.json().catch(() => null) };
  } catch (e) {
    console.error('trello', sciezka, e?.message || e);
    return { ok: false, blad: 'Nie udało się połączyć z Trello.' };
  }
}

/** Sprawdzenie kluczy — wołane, zanim cokolwiek zapiszemy. */
export async function sprawdzDostep(konfig) {
  const odp = await zapytaj(konfig, '/members/me', { parametry: { fields: 'username,fullName' } });
  if (!odp.ok) return odp;
  return { ok: true, uzytkownik: odp.dane?.username || odp.dane?.fullName || '(nieznany)' };
}

/** Tablice, do których token ma dostęp — Dawid wybiera z listy, nie wkleja ID. */
export async function listaTablic(konfig) {
  const odp = await zapytaj(konfig, '/members/me/boards', {
    parametry: { fields: 'name,url,closed', filter: 'open' },
  });
  if (!odp.ok) return odp;
  const tablice = (odp.dane || [])
    .filter((t) => !t.closed)
    .map((t) => ({ id: t.id, nazwa: t.name, url: t.url }));
  return { ok: true, tablice };
}

/**
 * POBRANIE POZYCJI Z TABLICY.
 *
 * Jedno zapytanie na całą tablicę (`/boards/{id}/cards` z `checklists=all`)
 * zamiast osobnego na kartę: przy kilkudziesięciu grobach to różnica między
 * jednym a kilkudziesięcioma wywołaniami, a Trello ma limity.
 */
export async function pobierzPozycje(konfig, tablicaId) {
  if (!tablicaId) return { ok: false, blad: 'Nie wybrano tablicy.' };
  const odp = await zapytaj(konfig, `/boards/${tablicaId}/cards`, {
    parametry: {
      fields: 'name,url,closed,dateLastActivity',
      checklists: 'all',
      checklist_fields: 'name',
      filter: 'open',
    },
  });
  if (!odp.ok) return odp;

  const pozycje = [];
  const sugestie = [];

  for (const karta of odp.dane || []) {
    if (karta.closed) continue;

    if (WZORZEC_SUGESTII.test(karta.name || '')) {
      sugestie.push({ kartaId: karta.id, karta: karta.name, url: karta.url });
    }

    for (const lista of karta.checklists || []) {
      // Tylko checklista o umówionej nazwie. To jest ten „jednoznaczny
      // sygnał" — bez niego wciągnęlibyśmy listy zadań montażowych.
      if (bezOgonkow(lista.name).trim() !== bezOgonkow(CHECKLISTA)) continue;

      for (const poz of lista.checkItems || []) {
        const rozbite = rozbierzPozycje(poz.name);
        if (!rozbite.produkt) continue;
        pozycje.push({
          ...rozbite,
          itemId: poz.id,
          kartaId: karta.id,
          karta: karta.name || '',
          url: karta.url || '',
          odhaczone: poz.state === 'complete',
        });
      }
    }
  }
  return { ok: true, pozycje, sugestie };
}

/**
 * ODHACZENIE POZYCJI W TRELLO + dopisek z datą.
 *
 * Dopisek jest po to, żeby Dawid patrzący na kartę grobu — a nie na nasz
 * panel — od razu wiedział, że rzecz jest zamówiona i kiedy. Samo odhaczenie
 * tego nie mówi.
 *
 * ⚠ Idempotentne: jeśli dopisek już jest, nie doklejamy drugiego. Cron chodzi
 * co 30 minut i bez tego nazwa puchłaby z każdym przebiegiem.
 */
export async function odhaczWTrello(konfig, { kartaId, itemId, nazwa, status, data }) {
  const znacznik = status === 'otrzymane' ? '✅ otrzymane' : '✅ zamówione';
  const czysta = String(nazwa || '').replace(/\s*✅\s*(zamówione|otrzymane)[^|]*$/iu, '').trim();
  const nowa = `${czysta} ${znacznik} ${data}`.trim();

  return await zapytaj(konfig, `/cards/${kartaId}/checkItem/${itemId}`, {
    metoda: 'PUT',
    parametry: {
      name: nowa,
      // „do kupienia" cofa też odhaczenie — panel i Trello mają pokazywać
      // to samo, także gdy Dawid się rozmyśli.
      state: status === 'do_kupienia' ? 'incomplete' : 'complete',
    },
  });
}

/**
 * TRYB WŁAŚCICIELA — „Powtórz wycenę" z panelu bazy klientów.
 *
 * Uruchamia się WYŁĄCZNIE, gdy adres ma fragment #powtorz=… wygenerowany
 * przez panel: w środku siedzą parametry wyceny klienta i podpis HMAC
 * z hasła panelu (ważny 7 dni). Sam pasek rabatów to tylko widok — bramką
 * bezpieczeństwa jest worker, który bez ważnego podpisu nie zapisze wersji
 * ani nie wyśle maila. Klient nigdy tego ekranu nie zobaczy, bo nie ma
 * jak zdobyć podpisanego linku.
 *
 * Trzy mechanizmy negocjacyjne (celowo bez edycji kwot pojedynczych pozycji):
 *   • rabat % albo kwotowy na całość,
 *   • nadpisanie ceny końcowej,
 *   • wyzerowanie wybranej pozycji („montaż gratis").
 */
import { h, zl, liczba } from './dom.js';
import { wycen } from '../engine/wycena.js';
import { FIRMY, firmaWgSlug, grubosciDekoru } from '../firms/index.js';
import { API_BASE, sprawdzMagazyn } from '../api.js';
import { rodzajMaterialu } from '../engine/alternatywy.js';
import { wycenZMagazynu, wycenWlasciciela, wariantReczny } from './wycena-naturalny.js';
import { wariantZPlyty, doWyszukania } from './plyta-kod.js';
import { gotoweStawki } from './stawki-klient.js';
import { bezCenJednostkowych } from './oferta-detal.js';
import { kartaOferty } from './oferta-widok.js';


/** Wartość opcji „Kamień naturalny" w wyborze kolekcji. */
const NATURALNY = '__naturalny';

/** Fragment #powtorz=… → paczka z panelu albo null. */
export function paczkaPowtorki() {
  const m = (location.hash || '').match(/^#powtorz=([A-Za-z0-9_-]+)$/);
  if (!m) return null;
  try {
    const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
    const bajty = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const paczka = JSON.parse(new TextDecoder().decode(bajty));
    // Wycena testowa z panelu ma leadId 0 (nie ma klienta) — samo `leadId`
    // jako warunek odrzucałoby ją jako falsy.
    const maKarte = Number(paczka?.leadId) > 0 || paczka?.test === true;
    return maKarte && paczka?.podpis && paczka?.parametry ? paczka : null;
  } catch {
    return null;
  }
}

export function uruchomOferteDawida(root, paczka) {
  const p = paczka.parametry;
  // Wycena klienta na kamieniu naturalnym ma firmę „interstone" — edytor
  // startuje wtedy w trybie naturalnym, z kodem płyty z leada.
  const naturalny = p.firma === 'interstone';

  const stan = {
    firma: naturalny ? NATURALNY : p.firma || FIRMY[0]?.slug,
    dekor: p.dekor || '',
    grubosc: String(p.grubosc || ''),
    odcinki: (p.odcinki || []).map((o) => ({ gl: Number(o.gl), dl: Number(o.dl) })),
    opcje: { ...(p.opcje || {}) },
    // kamień naturalny (tryb właściciela)
    nat: {
      kod: String(p.kodPlyty || ''),
      wariant: null, // płyta z magazynu po lookupie
      komunikat: '',
      szukam: false,
      // ręczne nadpisania Dawida — działają też bez płyty z magazynu
      cenaM2: 0,
      nazwa: String(p.nazwa || p.dekor || ''),
      plytaDl: Number(p.plytaCm?.dl) || 320,
      plytaGl: Number(p.plytaCm?.gl) || 190,
      grubosc: String(p.gruboscMm || p.grubosc || '20').replace(/\D/g, '') || '20',
    },
    // pasek właściciela
    korektaTyp: 'brak', // brak | procent | kwota | nadpisz
    korektaWartosc: 0,
    gratisy: new Set(), // nazwy wyzerowanych pozycji
    przekresl: false,
  };
  if (!stan.odcinki.length) stan.odcinki = [{ gl: 60, dl: 300 }];

  const box = h('div', { class: 'panel oferta-dawida' });
  root.replaceChildren(box);
  rysuj(box, stan, paczka);

  // Stawki z panelu mogą dojść ułamek sekundy później niż pierwsze
  // rysowanie — po ich nałożeniu przeliczamy jeszcze raz, żeby Dawid
  // widział skutek własnych zmian, a nie wartości domyślnych.
  gotoweStawki().then(() => rysuj(box, stan, paczka));

  // Prefill z leada naturalnego: od razu dociągamy świeżą cenę z magazynu.
  if (naturalny && stan.nat.kod) pobierzPlyte(box, stan, paczka);
}

/** Lookup płyty po kodzie — ta sama droga co w kalkulatorze klienta. */
async function pobierzPlyte(box, stan, paczka) {
  const kod = stan.nat.kod.trim();
  if (!kod) {
    stan.nat.komunikat = 'Wpisz kod płyty z magazynu Interstone.';
    return rysuj(box, stan, paczka);
  }
  stan.nat.szukam = true;
  stan.nat.komunikat = '';
  rysuj(box, stan, paczka);

  try {
    const fraza = doWyszukania(kod) || kod;
    const odp = await sprawdzMagazyn(fraza, kod);
    if (odp?.plyta) {
      stan.nat.wariant = wariantZPlyty(odp.plyta);
      stan.nat.nazwa = stan.nat.wariant?.nazwa || stan.nat.nazwa;
      stan.nat.komunikat = '';
    } else {
      stan.nat.wariant = null;
      stan.nat.komunikat =
        (odp?.powodKodu || 'Nie znalazłem tej płyty w magazynie.') +
        ' Możesz policzyć z ceną wpisaną ręcznie poniżej.';
    }
  } catch {
    stan.nat.wariant = null;
    stan.nat.komunikat = 'Magazyn nie odpowiada — policz z ceną ręczną albo spróbuj ponownie.';
  }
  stan.nat.szukam = false;
  rysuj(box, stan, paczka);
}

/* ─────────────────────────────────────────────────────────── liczenie */

function policz(stan) {
  const odcinki = stan.odcinki.filter((o) => o.gl > 0 && o.dl > 0);
  if (!odcinki.length) return { ok: false, blad: 'Podaj wymiary odcinków.' };

  if (stan.firma === NATURALNY) {
    const n = stan.nat;
    // Płyta z magazynu; ręczna cena (jeśli wpisana) nadpisuje magazynową.
    if (n.wariant) {
      const wariant = n.cenaM2 > 0 ? { ...n.wariant, cenaBruttoM2: n.cenaM2 } : n.wariant;
      return wycenZMagazynu(wariant, {
        odcinki,
        opcje: stan.opcje,
        grubosc: n.wariant.gruboscMm,
      });
    }
    // Płyta spoza magazynu: wszystko z rąk Dawida.
    if (!(n.cenaM2 > 0)) {
      return {
        ok: false,
        blad: 'Pobierz płytę z magazynu (kod) albo wpisz cenę materiału ręcznie.',
      };
    }
    return wycenWlasciciela(
      wariantReczny({
        nazwa: n.nazwa,
        kod: n.kod,
        cenaBruttoM2: n.cenaM2,
        plytaCm: { dl: n.plytaDl, gl: n.plytaGl },
        gruboscMm: n.grubosc,
      }),
      { odcinki, opcje: stan.opcje, grubosc: n.grubosc }
    );
  }

  const firma = firmaWgSlug(stan.firma);
  if (!firma) return { ok: false, blad: 'Nieznana firma.' };
  return wycen(firma, { dekor: stan.dekor, grubosc: stan.grubosc, odcinki, opcje: stan.opcje });
}

/**
 * Zamrożona oferta: pozycje z wyceny + mechanizmy właściciela.
 * Kolejność: gratisy zerują pozycje → suma → rabat →— nadpisanie wygrywa
 * ze wszystkim.
 */
function zamrozOferte(stan, w) {
  // pozycje „w cenie" (0 zł) klient i tak widzi jako zawarte — renderujemy
  // je na końcu listy jako gratis, żeby oferta czytała się jak karta wyceny
  const wCenie = w.pozycje
    .filter((p) => p.wCenie)
    .map((p) => ({ nazwa: p.nazwa, detal: bezCenJednostkowych(p.detal), brutto: 0, gratis: true }));

  const widoczne = [
    ...w.pozycje
      .filter((p) => !p.wCenie)
      .map((p) => ({
        nazwa: p.nazwa,
        // Bez stawek jednostkowych — patrz bezCenJednostkowych() na górze pliku.
        detal: bezCenJednostkowych(p.detal),
        brutto: stan.gratisy.has(p.nazwa) ? 0 : Math.round(p.brutto),
        gratis: stan.gratisy.has(p.nazwa),
      })),
    ...wCenie,
  ];

  const przed = Math.round(w.razemZaokr || w.razem);
  // Punktem wyjścia jest kwota z karty klienta (z jej zaokrągleniem),
  // pomniejszona o wyzerowane pozycje — a nie surowa suma pozycji, która
  // przez zaokrąglenie potrafi różnić się o złotówkę i udawać upust.
  const wyzerowane = w.pozycje
    .filter((p) => !p.wCenie && stan.gratisy.has(p.nazwa))
    .reduce((suma, p) => suma + Math.round(p.brutto), 0);
  const poGratisach = przed - wyzerowane;
  let razem = poGratisach;
  let korektaOpis = '';

  const wart = Number(stan.korektaWartosc) || 0;
  if (stan.korektaTyp === 'procent' && wart > 0 && wart < 100) {
    razem = Math.round(poGratisach * (1 - wart / 100));
    korektaOpis = `upust ${wart}%`;
  } else if (stan.korektaTyp === 'kwota' && wart > 0 && wart < poGratisach) {
    razem = Math.round(poGratisach - wart);
    korektaOpis = `upust ${zl(wart)}`;
  } else if (stan.korektaTyp === 'nadpisz' && wart > 0) {
    razem = Math.round(wart);
    korektaOpis = 'cena ustalona indywidualnie';
  }
  if (stan.gratisy.size) {
    korektaOpis = [korektaOpis, [...stan.gratisy].map((n) => `gratis: ${n}`).join(', ')]
      .filter(Boolean)
      .join('; ');
  }

  // Firma prosto z wyniku silnika — przy kamieniu naturalnym to konfiguracja
  // zbudowana z konkretnej płyty, nie wpis z listy kolekcji.
  const firma = w.firma;
  return {
    opis: [firma?.nazwa, w.dekor, w.grubosc ? `${w.grubosc} mm` : '', opisOdcinkow(stan.odcinki)]
      .filter(Boolean)
      .join(' · '),
    pozycje: widoczne,
    razemPrzed: przed,
    razem,
    korektaOpis,
    przekresl: !!stan.przekresl && razem < przed,
    stawkaVat: w.stawkaVat ?? 0.08,
    odbiorWlasny: !!w.odbiorWlasny,
    // Noty silnika — m.in. „N płyt z tego samego bloku, spójny wzór"
    // i zastrzeżenia o dostępności. Klient widzi je też na stronie oferty.
    noty: w.ostrzezenia || [],
    firma: firma?.nazwa || '',
    dekor: w.dekor,
    grubosc: w.grubosc,
    m2: w.pak?.m2Blatu ?? 0,
    mb: w.pak?.mb ?? 0,
    pomieszczenie: stan.opcje.pomieszczenie || 'kuchnia',
    kategoria: rodzajMaterialu(firma),
    parametry:
      stan.firma === NATURALNY
        ? {
            firma: 'interstone',
            dekor: w.dekor,
            grubosc: w.grubosc,
            odcinki: stan.odcinki,
            opcje: stan.opcje,
            kodPlyty: w.kodPlyty || stan.nat.kod || null,
            nazwa: stan.nat.nazwa,
            cenaM2: stan.nat.wariant && !(stan.nat.cenaM2 > 0)
              ? stan.nat.wariant.cenaBruttoM2
              : stan.nat.cenaM2,
            plytaCm: stan.nat.wariant?.plytaCm || { dl: stan.nat.plytaDl, gl: stan.nat.plytaGl },
            gruboscMm: Number(w.grubosc) || 20,
          }
        : {
            firma: stan.firma,
            dekor: stan.dekor,
            grubosc: stan.grubosc,
            odcinki: stan.odcinki,
            opcje: stan.opcje,
          },
  };
}

const opisOdcinkow = (odcinki) => odcinki.map((o) => `${o.gl}×${o.dl}`).join(' + ') + ' cm';

/* ──────────────────────────────────────────────────────────── widok */

function rysuj(box, stan, paczka) {
  const naturalny = stan.firma === NATURALNY;
  let dekory = [];
  let grubosci = [];
  if (!naturalny) {
    const firma = firmaWgSlug(stan.firma) || FIRMY[0];
    stan.firma = firma.slug;
    dekory = Object.keys(firma.dekory || {});
    if (!dekory.includes(stan.dekor)) stan.dekor = dekory[0] || '';
    grubosci = grubosciDekoru(firma, stan.dekor);
    if (!grubosci.includes(stan.grubosc)) stan.grubosc = grubosci[0] || '';
  }

  const w = policz(stan);
  const oferta = w.ok ? zamrozOferte(stan, w) : null;
  const odswiez = () => rysuj(box, stan, paczka);

  box.replaceChildren(
    h(
      'div',
      { class: 'karta-wyceny' },
      h(
        'div',
        { class: 'q-kicker' },
        paczka.test
          ? 'Tryb właściciela — WYCENA TESTOWA (nic się nie zapisuje)'
          : `Tryb właściciela — oferta dla: ${paczka.imie || 'klient'} (karta #${paczka.leadId})`
      ),
      h('h3', { class: 'q-title' }, paczka.test ? 'Wycena testowa' : 'Powtórz wycenę'),

      /* ── parametry ── */
      h(
        'div',
        { class: 'od-siatka' },
        pole(
          'Kolekcja',
          wybor(
            [
              ...FIRMY.filter((f) => f.trybCeny === 'katalog').map((f) => [f.slug, f.nazwa]),
              [NATURALNY, 'Kamień naturalny (płyta z magazynu)'],
            ],
            stan.firma,
            (v) => {
              stan.firma = v;
              if (v !== NATURALNY) {
                const nowa = firmaWgSlug(v);
                stan.dekor = Object.keys(nowa?.dekory || {})[0] || '';
              }
              odswiez();
            }
          )
        ),
        naturalny ? null : pole('Dekor', wybor(dekory.map((d) => [d, d]), stan.dekor, (v) => ((stan.dekor = v), odswiez()))),
        naturalny ? null : pole('Grubość', wybor(grubosci.map((g) => [g, g + ' mm']), stan.grubosc, (v) => ((stan.grubosc = v), odswiez()))),
        pole('Pomieszczenie', wybor([['kuchnia', 'kuchnia'], ['lazienka', 'łazienka']], stan.opcje.pomieszczenie || 'kuchnia', (v) => {
          stan.opcje.pomieszczenie = v;
          odswiez();
        })),
        pole('Montaż', wybor([['montaz', 'z montażem (8%)'], ['odbior', 'odbiór własny (23%)']], stan.opcje.dostawa === 'odbior' ? 'odbior' : 'montaz', (v) => {
          stan.opcje.dostawa = v === 'odbior' ? 'odbior' : 'montaz';
          odswiez();
        })),
        pole('Zlew / umywalka', wybor([['podblat', 'podwieszany'], ['nablat', 'nablatowy']], stan.opcje.zlew || 'podblat', (v) => ((stan.opcje.zlew = v), odswiez()))),
        (stan.opcje.pomieszczenie || 'kuchnia') === 'kuchnia'
          ? pole('Płyta indukcyjna', wybor([['nakladana', 'nakładana'], ['licowana', 'licowana']], stan.opcje.plyta || 'nakladana', (v) => ((stan.opcje.plyta = v), odswiez())))
          : pole('Umywalki (szt.)', licznik(stan.opcje.umywalki ?? 1, 1, (v) => ((stan.opcje.umywalki = v), odswiez()))),
        pole('Otwory (szt.)', licznik(stan.opcje.otwory ?? 1, 0, (v) => ((stan.opcje.otwory = v), odswiez())))
      ),

      /* ── kamień naturalny: płyta z magazynu albo cena ręczna ── */
      naturalny ? blokNaturalny(stan, paczka, box, odswiez) : null,

      /* ── odcinki ── */
      h('div', { class: 'q-kicker', style: 'margin-top:16px' }, 'Odcinki blatu (głębokość × długość, cm)'),
      h(
        'div',
        {},
        ...stan.odcinki.map((o, i) =>
          h(
            'div',
            { class: 'od-odcinek' },
            h('input', {
              type: 'number', inputmode: 'numeric', value: o.gl || '',
              'aria-label': 'głębokość', placeholder: 'głęb.',
              onchange: (e) => ((o.gl = Number(e.target.value)), odswiez()),
            }),
            h('span', {}, '×'),
            h('input', {
              type: 'number', inputmode: 'numeric', value: o.dl || '',
              'aria-label': 'długość', placeholder: 'dług.',
              onchange: (e) => ((o.dl = Number(e.target.value)), odswiez()),
            }),
            stan.odcinki.length > 1
              ? h('button', { class: 'link-btn', type: 'button', onclick: () => (stan.odcinki.splice(i, 1), odswiez()) }, '✕')
              : null
          )
        ),
        h('button', { class: 'link-btn', type: 'button', onclick: () => (stan.odcinki.push({ gl: 60, dl: 100 }), odswiez()) }, '+ kolejny odcinek')
      ),

      /* ── podgląd pozycji / błąd ── */
      w.ok ? podgladPozycji(stan, oferta, odswiez) : h('div', { class: 'form-blad' }, w.blad || 'Nie udało się policzyć.'),

      /* ── pasek właściciela ── */
      w.ok ? pasekWlasciciela(stan, oferta, odswiez) : null,

      /* ── wysyłka (w trybie testowym nie ma komu wysyłać) ── */
      w.ok ? (paczka.test ? notaTestowa() : wysylka(stan, oferta, paczka, box)) : null
    )
  );
}

function blokNaturalny(stan, paczka, box, odswiez) {
  const n = stan.nat;
  const kodPole = h('input', {
    type: 'text',
    value: n.kod,
    placeholder: 'np. STON000334-84224',
    onchange: (e) => (n.kod = e.target.value),
  });

  const wiersze = [
    h('div', { class: 'q-kicker', style: 'margin-top:16px' }, 'Płyta z magazynu Interstone'),
    h(
      'div',
      { class: 'od-odcinek' },
      kodPole,
      h(
        'button',
        { class: 'btn cichy', type: 'button', disabled: n.szukam ? 'disabled' : undefined,
          onclick: () => { n.kod = kodPole.value; pobierzPlyte(box, stan, paczka); } },
        n.szukam ? 'Szukam…' : 'Pobierz z magazynu'
      )
    ),
  ];

  if (n.wariant) {
    const p = n.wariant;
    wiersze.push(
      h(
        'p',
        { class: 'form-nota', style: 'margin:6px 0 0' },
        `✓ ${p.nazwa} · ${p.rodzaj || ''} · ${p.gruboscMm} mm · płyta ` +
          `${liczba(p.plytaCm.dl)}×${liczba(p.plytaCm.gl)} cm · ` +
          `${zl(p.cenaBruttoM2)}/m² · dostępne ${liczba(p.dostepneM2)} m²`
      )
    );

    /*
     * Płyty z TEGO SAMEGO bloku (spójny wzór) — z tabeli na karcie płyty
     * w Interstone. Pozycje zarezerwowane odpadają już w workerze.
     * Klik przełącza wycenę na wskazaną płytę.
     */
    const bl = p.blokPlyty;
    if (bl && bl.plyty.length > 1) {
      const wlasny = (String(p.kod || '').match(/(\d+)\s*$/) || [])[1];
      const stonCzesc = (String(p.kod || '').match(/^[A-Za-z]+\d+/) || [''])[0];
      wiersze.push(
        h('div', { class: 'q-kicker', style: 'margin-top:12px' },
          `Płyty z tego samego bloku (razem ${liczba(bl.razemM2)} m²) — spójny wzór`),
        ...bl.plyty.map((b) =>
          h(
            'div',
            { class: 'od-odcinek', style: 'font-size:13px' },
            h(
              'span',
              { style: 'flex:1' },
              `${b.symbol}${String(b.symbol) === wlasny ? ' (wybrana)' : ''} · ` +
                `${b.wymiarCm ? `${b.wymiarCm.dl}×${b.wymiarCm.gl} cm · ` : ''}` +
                `${liczba(b.dostepneM2)} m²${b.magazyn ? ` · ${b.magazyn}` : ''}`
            ),
            String(b.symbol) !== wlasny && stonCzesc
              ? h(
                  'button',
                  {
                    class: 'link-btn', type: 'button',
                    onclick: () => { n.kod = `${stonCzesc}-${b.symbol}`; pobierzPlyte(box, stan, paczka); },
                  },
                  'Licz z tej płyty →'
                )
              : null
          )
        )
      );
    }
  } else if (n.komunikat) {
    wiersze.push(h('p', { class: 'form-blad', style: 'margin:6px 0 0' }, n.komunikat));
  }

  wiersze.push(
    h('div', { class: 'q-kicker', style: 'margin-top:14px' }, 'Cena ręczna (widzi tylko Dawid)'),
    h(
      'div',
      { class: 'od-siatka' },
      pole(
        n.wariant ? 'Cena materiału zł/m² (nadpisuje magazyn)' : 'Cena materiału zł/m² (brutto)',
        h('input', {
          type: 'number', inputmode: 'numeric', value: n.cenaM2 || '',
          placeholder: n.wariant ? String(n.wariant.cenaBruttoM2) : 'jak na interstone.pl',
          onchange: (e) => ((n.cenaM2 = Number(e.target.value) || 0), odswiez()),
        })
      ),
      n.wariant
        ? null
        : pole('Nazwa kamienia', h('input', {
            type: 'text', value: n.nazwa,
            onchange: (e) => ((n.nazwa = e.target.value), odswiez()),
          })),
      n.wariant
        ? null
        : pole('Płyta: długość (cm)', h('input', {
            type: 'number', inputmode: 'numeric', value: n.plytaDl,
            onchange: (e) => ((n.plytaDl = Number(e.target.value) || 0), odswiez()),
          })),
      n.wariant
        ? null
        : pole('Płyta: głębokość (cm)', h('input', {
            type: 'number', inputmode: 'numeric', value: n.plytaGl,
            onchange: (e) => ((n.plytaGl = Number(e.target.value) || 0), odswiez()),
          })),
      n.wariant
        ? null
        : pole('Grubość (mm)', h('input', {
            type: 'number', inputmode: 'numeric', value: n.grubosc,
            onchange: (e) => ((n.grubosc = String(Number(e.target.value) || 20)), odswiez()),
          }))
    )
  );

  return h('div', {}, ...wiersze);
}

function podgladPozycji(stan, oferta, odswiez) {
  return h(
    'div',
    { class: 'oferta-pozycje' },
    ...oferta.pozycje.map((p) =>
      h(
        'div',
        { class: 'oferta-poz' + (p.gratis ? ' gratis' : '') },
        h('span', {}, p.nazwa, p.detal ? h('small', {}, p.detal) : null),
        h(
          'span',
          { class: 'od-akcje-poz' },
          h('b', {}, p.gratis ? 'GRATIS' : zl(p.brutto)),
          // przełącznik „gratis" tylko dla pozycji, które coś kosztują
          p.brutto > 0 || stan.gratisy.has(p.nazwa)
            ? h(
                'button',
                {
                  class: 'link-btn', type: 'button',
                  title: stan.gratisy.has(p.nazwa) ? 'Przywróć cenę' : 'Wyzeruj (gratis)',
                  onclick: () => {
                    stan.gratisy.has(p.nazwa) ? stan.gratisy.delete(p.nazwa) : stan.gratisy.add(p.nazwa);
                    odswiez();
                  },
                },
                stan.gratisy.has(p.nazwa) ? '↩' : '0 zł'
              )
            : null
        )
      )
    ),
    ...(oferta.noty || []).map((nota) =>
      h('p', { class: 'form-nota', style: 'margin:8px 0 0' }, nota)
    ),
    h(
      'div',
      { class: 'oferta-suma' },
      h('span', {}, 'Razem brutto dla klienta'),
      h(
        'span',
        {},
        oferta.razem < oferta.razemPrzed ? h('s', { class: 'oferta-stara' }, zl(oferta.razemPrzed)) : null,
        h('b', {}, zl(oferta.razem))
      )
    )
  );
}

function pasekWlasciciela(stan, oferta, odswiez) {
  return h(
    'div',
    { class: 'od-pasek' },
    h('div', { class: 'q-kicker' }, 'Upust / cena specjalna (widzi tylko Dawid)'),
    h(
      'div',
      { class: 'od-siatka' },
      pole(
        'Mechanizm',
        wybor(
          [
            ['brak', 'bez zmian'],
            ['procent', 'upust %'],
            ['kwota', 'upust kwotowy (zł)'],
            ['nadpisz', 'nadpisz cenę końcową (zł)'],
          ],
          stan.korektaTyp,
          (v) => ((stan.korektaTyp = v), odswiez())
        )
      ),
      stan.korektaTyp !== 'brak'
        ? pole(
            stan.korektaTyp === 'procent' ? 'Ile %' : 'Kwota (zł)',
            h('input', {
              type: 'number', inputmode: 'numeric', value: stan.korektaWartosc || '',
              onchange: (e) => ((stan.korektaWartosc = Number(e.target.value)), odswiez()),
            })
          )
        : null
    ),
    h(
      'label',
      { class: 'switch zgoda', style: 'margin-top:10px' },
      h('input', {
        type: 'checkbox',
        checked: stan.przekresl ? 'checked' : undefined,
        onchange: (e) => (stan.przekresl = e.target.checked),
      }),
      h('span', { class: 'box' }, '✓'),
      h(
        'span',
        { class: 'zgoda-txt' },
        'Pokaż klientowi obniżkę: przekreślona stara cena obok nowej — w mailu i na stronie wyceny. ' +
          'Bez zaznaczenia klient widzi tylko kwotę końcową.'
      )
    )
  );
}

function notaTestowa() {
  return h(
    'div',
    { class: 'od-pasek', style: 'margin-top:18px' },
    h('b', {}, 'Wycena testowa. '),
    'Nic nie idzie do klienta i nic nie ląduje w bazie — to podgląd skutków ' +
      'aktualnych stawek. Żeby wysłać ofertę, otwórz „Powtórz wycenę" ' +
      'przy konkretnym kliencie w panelu.'
  );
}

/**
 * PRZED WYSYŁKĄ — PODGLĄD (decyzja Dawida, 21.08.2026).
 *
 * Żadnego cichego wysyłania: przycisk prowadzi najpierw do ekranu z tym,
 * co dostanie klient — kartą wyceny online (ten sam renderer co strona
 * /oferta, więc bez cen jednostkowych i z ewentualną obniżką) oraz
 * TREŚCIĄ MAILA prosto z workera, czyli dokładnie tą, która pójdzie.
 * Dopiero „Wyślij do klienta" cokolwiek zapisuje i wysyła.
 */
function wysylka(stan, oferta, paczka, box) {
  const wynik = h('div', { class: 'form-blad', hidden: true, role: 'alert' });
  const przycisk = h('button', { class: 'btn', type: 'button' }, 'Pokaż podgląd →');

  // Przełącznik obniżki mógł się zmienić po ostatnim rysowaniu — zamrażamy
  // dokładnie to, co pójdzie do klienta, i tego samego używa podgląd.
  const swieza = () => ({
    ...oferta,
    przekresl: !!stan.przekresl && oferta.razem < oferta.razemPrzed,
  });

  przycisk.addEventListener('click', async () => {
    przycisk.disabled = true;
    przycisk.textContent = 'Przygotowuję podgląd…';
    wynik.hidden = true;
    try {
      const dane = await doWorkera(paczka, swieza(), { podglad: true });
      pokazPodglad(stan, oferta, paczka, box, dane);
    } catch (e) {
      przycisk.disabled = false;
      przycisk.textContent = 'Pokaż podgląd →';
      wynik.textContent = opisBledu(e);
      wynik.hidden = false;
    }
  });

  return h(
    'div',
    { class: 'nav', style: 'margin-top:18px; flex-wrap:wrap' },
    przycisk,
    h('span', { class: 'form-nota' }, 'Najpierw zobaczysz, co dostanie klient — mail wychodzi dopiero po potwierdzeniu.'),
    wynik
  );
}

/** Jedno wejście do workera: podgląd i wysyłka różnią się jedną flagą. */
async function doWorkera(paczka, oferta, { podglad = false } = {}) {
  const odp = await fetch(`${API_BASE}/oferta/wyslij`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      leadId: paczka.leadId,
      exp: paczka.exp,
      podpis: paczka.podpis,
      oferta,
      podglad,
    }),
  });
  const dane = await odp.json().catch(() => null);
  if (!odp.ok || !dane?.ok) throw new Error(dane?.error || 'Błąd wysyłki.');
  return dane;
}

const opisBledu = (e) =>
  (e?.message === 'Brak autoryzacji.'
    ? 'Link z panelu wygasł — wejdź w kartę i kliknij „Powtórz wycenę" jeszcze raz. '
    : '') + 'Nie udało się: ' + (e?.message || 'błąd sieci');

function pokazPodglad(stan, oferta, paczka, box, dane) {
  const wynik = h('div', { class: 'form-blad', hidden: true, role: 'alert' });
  const wyslij = h('button', { class: 'btn', type: 'button' }, 'Wyślij do klienta →');
  const wroc = h('button', { class: 'btn cichy', type: 'button' }, '← Wróć do edycji');

  wroc.addEventListener('click', () => rysuj(box, stan, paczka));

  wyslij.addEventListener('click', async () => {
    wyslij.disabled = true;
    wroc.disabled = true;
    wyslij.textContent = 'Wysyłam…';
    try {
      const odp = await doWorkera(paczka, {
        ...oferta,
        przekresl: !!stan.przekresl && oferta.razem < oferta.razemPrzed,
      });
      pokazWyslane(box, odp);
    } catch (e) {
      wyslij.disabled = false;
      wroc.disabled = false;
      wyslij.textContent = 'Wyślij do klienta →';
      wynik.textContent = opisBledu(e);
      wynik.hidden = false;
    }
  });

  // Mail pokazujemy w ramce z atrybutem `srcdoc` — to ten sam HTML, który
  // dostanie klient, więc nie chcemy, żeby jego style rozlały się na panel.
  const ramka = h('iframe', {
    class: 'podglad-mail',
    title: 'Podgląd maila do klienta',
    srcdoc: dane.html || '',
    loading: 'lazy',
  });

  box.replaceChildren(
    h(
      'div',
      { class: 'karta-wyceny' },
      h('div', { class: 'q-kicker' }, 'Podgląd — to zobaczy klient'),
      h('h3', { class: 'q-title' }, 'Sprawdź przed wysłaniem'),
      h(
        'p',
        { class: 'q-hint' },
        `Mail pójdzie na ${dane.adres || 'adres z karty'} — temat: „${dane.temat || ''}".`
      ),

      h('div', { class: 'q-kicker', style: 'margin-top:16px' }, '1 · Treść maila'),
      ramka,

      h('div', { class: 'q-kicker', style: 'margin-top:18px' }, '2 · Strona wyceny online (spod linku w mailu)'),
      kartaOferty(oferta, { imie: paczka.imie, utworzono: Date.now() }),
      h(
        'p',
        { class: 'form-nota' },
        'Pod wyceną klient ma jeszcze trzy przyciski: „Pasuje mi", „Cena za wysoka", ' +
          '„Muszę się zastanowić" — odpowiedź trafia do jego karty w panelu.'
      ),

      h('div', { class: 'nav', style: 'margin-top:18px; flex-wrap:wrap' }, wyslij, wroc, wynik)
    )
  );
  box.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function pokazWyslane(box, dane) {
  box.replaceChildren(
    h(
      'div',
      { class: 'karta-wyceny' },
      h(
        'div',
        { class: 'bramka-ok' },
        h('span', { class: 'ptak' }, '✓'),
        h(
          'span',
          {},
          h('b', {}, 'Oferta wysłana. '),
          dane.mail
            ? 'Mail z wyceną poszedł do klienta, a wersja zapisała się w karcie.'
            : 'Wersja zapisała się w karcie, ale mail nie wyszedł — spróbuj ponownie z panelu.'
        )
      ),
      h('p', { class: 'q-hint' }, 'Link do wyceny online (ten sam, który dostał klient):'),
      h('p', {}, h('a', { class: 'link-btn', href: dane.link, target: '_blank', rel: 'noopener' }, dane.link)),
      h('p', { class: 'q-hint' }, 'Status leada ustawiony na „Oferta wysłana" (chyba że był już dalej).')
    )
  );
}

/* ─────────────────────────────────────────────────────────── drobiazgi */

function pole(etykieta, kontrolka) {
  return h('div', { class: 'pole' }, h('label', {}, etykieta), kontrolka);
}

function wybor(pary, wartosc, onchange) {
  const sel = h(
    'select',
    { onchange: (e) => onchange(e.target.value) },
    ...pary.map(([v, t]) => h('option', { value: v, selected: v === String(wartosc) ? 'selected' : undefined }, t))
  );
  return sel;
}

function licznik(wartosc, min, onchange) {
  return h('input', {
    type: 'number', inputmode: 'numeric', min: String(min), value: liczba(wartosc ?? min),
    onchange: (e) => onchange(Math.max(min, Number(e.target.value) || min)),
  });
}

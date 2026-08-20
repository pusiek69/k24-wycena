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
import { API_BASE } from '../api.js';
import { rodzajMaterialu } from '../engine/alternatywy.js';

/** Fragment #powtorz=… → paczka z panelu albo null. */
export function paczkaPowtorki() {
  const m = (location.hash || '').match(/^#powtorz=([A-Za-z0-9_-]+)$/);
  if (!m) return null;
  try {
    const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
    const bajty = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const paczka = JSON.parse(new TextDecoder().decode(bajty));
    return paczka?.leadId && paczka?.podpis && paczka?.parametry ? paczka : null;
  } catch {
    return null;
  }
}

export function uruchomOferteDawida(root, paczka) {
  const stan = {
    firma: paczka.parametry.firma || FIRMY[0]?.slug,
    dekor: paczka.parametry.dekor || '',
    grubosc: String(paczka.parametry.grubosc || ''),
    odcinki: (paczka.parametry.odcinki || []).map((o) => ({ gl: Number(o.gl), dl: Number(o.dl) })),
    opcje: { ...(paczka.parametry.opcje || {}) },
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
}

/* ─────────────────────────────────────────────────────────── liczenie */

function policz(stan) {
  const firma = firmaWgSlug(stan.firma);
  if (!firma) return { ok: false, blad: 'Nieznana firma.' };
  const odcinki = stan.odcinki.filter((o) => o.gl > 0 && o.dl > 0);
  if (!odcinki.length) return { ok: false, blad: 'Podaj wymiary odcinków.' };
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
    .map((p) => ({ nazwa: p.nazwa, detal: p.detal || '', brutto: 0, gratis: true }));

  const widoczne = [
    ...w.pozycje
      .filter((p) => !p.wCenie)
      .map((p) => ({
        nazwa: p.nazwa,
        detal: p.detal || '',
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

  const firma = firmaWgSlug(stan.firma);
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
    firma: firma?.nazwa || '',
    dekor: w.dekor,
    grubosc: w.grubosc,
    m2: w.pak?.m2Blatu ?? 0,
    mb: w.pak?.mb ?? 0,
    pomieszczenie: stan.opcje.pomieszczenie || 'kuchnia',
    kategoria: rodzajMaterialu(firma),
    parametry: {
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
  const firma = firmaWgSlug(stan.firma) || FIRMY[0];
  stan.firma = firma.slug;
  const dekory = Object.keys(firma.dekory || {});
  if (!dekory.includes(stan.dekor)) stan.dekor = dekory[0] || '';
  const grubosci = grubosciDekoru(firma, stan.dekor);
  if (!grubosci.includes(stan.grubosc)) stan.grubosc = grubosci[0] || '';

  const w = policz(stan);
  const oferta = w.ok ? zamrozOferte(stan, w) : null;
  const odswiez = () => rysuj(box, stan, paczka);

  box.replaceChildren(
    h(
      'div',
      { class: 'karta-wyceny' },
      h('div', { class: 'q-kicker' }, `Tryb właściciela — oferta dla: ${paczka.imie || 'klient'} (karta #${paczka.leadId})`),
      h('h3', { class: 'q-title' }, 'Powtórz wycenę'),

      /* ── parametry ── */
      h(
        'div',
        { class: 'od-siatka' },
        pole('Kolekcja', wybor(FIRMY.filter((f) => f.trybCeny === 'katalog').map((f) => [f.slug, f.nazwa]), stan.firma, (v) => {
          stan.firma = v;
          const nowa = firmaWgSlug(v);
          stan.dekor = Object.keys(nowa?.dekory || {})[0] || '';
          odswiez();
        })),
        pole('Dekor', wybor(dekory.map((d) => [d, d]), stan.dekor, (v) => ((stan.dekor = v), odswiez()))),
        pole('Grubość', wybor(grubosci.map((g) => [g, g + ' mm']), stan.grubosc, (v) => ((stan.grubosc = v), odswiez()))),
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

      /* ── wysyłka ── */
      w.ok ? wysylka(stan, oferta, paczka, box) : null
    )
  );
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

function wysylka(stan, oferta, paczka, box) {
  const wynik = h('div', { class: 'form-blad', hidden: true, role: 'alert' });
  const przycisk = h('button', { class: 'btn', type: 'button' }, 'Wyślij klientowi →');

  przycisk.addEventListener('click', async () => {
    przycisk.disabled = true;
    przycisk.textContent = 'Wysyłam…';
    // przełącznik obniżki mógł się zmienić po ostatnim rysowaniu — zamrażamy na świeżo
    const swieza = { ...oferta, przekresl: !!stan.przekresl && oferta.razem < oferta.razemPrzed };
    try {
      const odp = await fetch(`${API_BASE}/oferta/wyslij`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          leadId: paczka.leadId,
          exp: paczka.exp,
          podpis: paczka.podpis,
          oferta: swieza,
        }),
      });
      const dane = await odp.json().catch(() => null);
      if (!odp.ok || !dane?.ok) throw new Error(dane?.error || 'Błąd wysyłki.');
      box.replaceChildren(
        h(
          'div',
          { class: 'karta-wyceny' },
          h('div', { class: 'bramka-ok' }, h('span', { class: 'ptak' }, '✓'),
            h('span', {}, h('b', {}, 'Oferta wysłana. '),
              dane.mail
                ? 'Mail z wyceną poszedł do klienta, a wersja zapisała się w karcie.'
                : 'Wersja zapisała się w karcie, ale mail nie wyszedł — spróbuj ponownie z panelu.')),
          h('p', { class: 'q-hint' }, 'Link do wyceny online (ten sam, który dostał klient):'),
          h('p', {}, h('a', { class: 'link-btn', href: dane.link, target: '_blank', rel: 'noopener' }, dane.link)),
          h('p', { class: 'q-hint' }, 'Status leada ustawiony na „Oferta wysłana" (chyba że był już dalej).')
        )
      );
    } catch (e) {
      przycisk.disabled = false;
      przycisk.textContent = 'Wyślij klientowi →';
      wynik.textContent =
        (e?.message === 'Brak autoryzacji.' ? 'Link z panelu wygasł — wejdź w kartę i kliknij „Powtórz wycenę" jeszcze raz. ' : '') +
        'Nie udało się wysłać: ' + (e?.message || 'błąd sieci');
      wynik.hidden = false;
    }
  });

  return h(
    'div',
    { class: 'nav', style: 'margin-top:18px; flex-wrap:wrap' },
    przycisk,
    h('span', { class: 'form-nota' }, 'Mail pójdzie na adres z karty klienta, z linkiem do wyceny online.'),
    wynik
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

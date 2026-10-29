/**
 * PROGRAM PARTNERSKI — MVP (zlecenie Dawida, 26.10.2026).
 *
 *   node --test scripts/test-partnerzy.mjs
 *
 * Spec: docs/specs/2026-10-26-program-partnerski-design.md.
 * Decyzje wiążące: 15% pierwsze wygrane zlecenie partnera → 10% kolejne →
 * 15% Premium; prowizja od CAŁOŚCI netto (po rabacie — kwota, którą klient
 * realnie płaci); stawki NIEJAWNE publicznie; wszystko konfigurowalne
 * w panelu; przypisanie klienta 365 dni (konfigurowalne).
 *
 * Tu: czyste reguły (etap 1) + testy po źródle frontu i strony (etapy 3/5).
 * Drogę przez prawdziwego workera (przypisanie leada, /partner, panel)
 * pilnuje scripts/test-worker-smoke.mjs.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  KONFIG_DOMYSLNA,
  KLUCZE_KONFIGU,
  stawkaProwizji,
  prowizja,
  nettoZlecenia,
  kodWazny,
  poprawnyKod,
} from '../worker/partnerzy.js';

const zrodlo = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/* ══════════════════════════ etap 1: reguły prowizji ══════════════════════ */

test('STAWKA: 15% pierwsze, 10% kolejne, Premium zawsze 15%', () => {
  const k = KONFIG_DOMYSLNA;
  assert.equal(stawkaProwizji({ premium: false, pierwsze: true, konfig: k }), 15);
  assert.equal(stawkaProwizji({ premium: false, pierwsze: false, konfig: k }), 10);
  assert.equal(stawkaProwizji({ premium: true, pierwsze: true, konfig: k }), 15);
  assert.equal(stawkaProwizji({ premium: true, pierwsze: false, konfig: k }), 15);
});

test('STAWKA: konfiguracja z panelu nadpisuje domyślne — to jest furtka Dawida', () => {
  const k = { ...KONFIG_DOMYSLNA, procPierwsze: 12, procKolejne: 7, procPremium: 20 };
  assert.equal(stawkaProwizji({ premium: false, pierwsze: true, konfig: k }), 12);
  assert.equal(stawkaProwizji({ premium: false, pierwsze: false, konfig: k }), 7);
  assert.equal(stawkaProwizji({ premium: true, pierwsze: false, konfig: k }), 20);
});

test('KONFIG: domyślne dokładnie wg decyzji (15/10/15, całość, 365 dni)', () => {
  assert.deepEqual(KONFIG_DOMYSLNA, {
    procPierwsze: 15,
    procKolejne: 10,
    procPremium: 15,
    podstawa: 0,
    dni: 365,
  });
  // Klucze w bazie ustawień — z prefiksem `partner`, żeby dało się je
  // ODFILTROWAĆ z publicznego /ustawienia (stawki są niejawne).
  assert.deepEqual(Object.values(KLUCZE_KONFIGU).sort(), [
    'partnerDniPrzypisania',
    'partnerPodstawa',
    'partnerProcKolejne',
    'partnerProcPierwsze',
    'partnerProcPremium',
  ]);
  for (const klucz of Object.values(KLUCZE_KONFIGU))
    assert.match(klucz, /^partner/, `klucz ${klucz} bez prefiksu partner — wycieknie publicznie`);
});

test('NETTO: liczone z ostatniej wyceny po stawce VAT z oferty', () => {
  assert.deepEqual(nettoZlecenia({ razem: 12960, stawkaVat: 0.08 }, 0), {
    netto: 12000,
    zPodgladu: false,
  });
  assert.deepEqual(nettoZlecenia({ razem: 12300, stawkaVat: 0.23 }, 0), {
    netto: 10000,
    zPodgladu: false,
  });
});

test('NETTO: po rabacie, nie przed — klient tyle realnie płaci (decyzja Dawida)', () => {
  const w = nettoZlecenia({ razem: 10800, razemPrzed: 12960, stawkaVat: 0.08 }, 0);
  assert.equal(w.netto, 10000, 'prowizja ma iść od kwoty po rabacie');
});

test('NETTO: bez wyceny — kwota karty / 1,08 i flaga „sprawdź podstawę"', () => {
  assert.deepEqual(nettoZlecenia(null, 10800), { netto: 10000, zPodgladu: true });
  assert.deepEqual(nettoZlecenia({ cokolwiek: 1 }, 10800), { netto: 10000, zPodgladu: true });
  assert.deepEqual(nettoZlecenia(null, 0), { netto: 0, zPodgladu: true });
});

test('PROWIZJA: co do złotówki, pół złotego w górę', () => {
  assert.equal(prowizja(10000, 15), 1500);
  assert.equal(prowizja(3333, 10), 333); // 333,30 → 333
  assert.equal(prowizja(10003, 15), 1500); // 1500,45 → 1500
  assert.equal(prowizja(10010, 15), 1502); // 1501,50 → 1502
  assert.equal(prowizja(0, 15), 0);
});

test('WAŻNOŚĆ KODU: 365 dni domyślnie, granice co do dnia', () => {
  const teraz = Date.UTC(2026, 9, 26);
  const d = 86400000;
  assert.equal(kodWazny({ od: teraz - 364 * d, teraz, dni: 365 }), true);
  assert.equal(kodWazny({ od: teraz - 365 * d, teraz, dni: 365 }), true, 'równo 365 dni jeszcze działa');
  assert.equal(kodWazny({ od: teraz - 366 * d, teraz, dni: 365 }), false);
});

test('WAŻNOŚĆ KODU: konfigurowalny okres — 30 dni tnie po 30 dniach', () => {
  const teraz = Date.UTC(2026, 9, 26);
  const d = 86400000;
  assert.equal(kodWazny({ od: teraz - 29 * d, teraz, dni: 30 }), true);
  assert.equal(kodWazny({ od: teraz - 31 * d, teraz, dni: 30 }), false);
});

test('WAŻNOŚĆ KODU: śmieci nie przechodzą', () => {
  const teraz = Date.now();
  assert.equal(kodWazny({ od: 0, teraz, dni: 365 }), false);
  assert.equal(kodWazny({ od: NaN, teraz, dni: 365 }), false);
  assert.equal(kodWazny({ od: 'wczoraj', teraz, dni: 365 }), false);
});

test('KOD PARTNERA: małe litery, cyfry, myślnik, 3–24 znaki', () => {
  assert.equal(poprawnyKod('kowalski'), true);
  assert.equal(poprawnyKod('meble-anna-24'), true);
  assert.equal(poprawnyKod('ab'), false);
  assert.equal(poprawnyKod('a'.repeat(25)), false);
  assert.equal(poprawnyKod('Kowalski'), false);
  assert.equal(poprawnyKod('ko d'), false);
  assert.equal(poprawnyKod('ko!d'), false);
  assert.equal(poprawnyKod(42), false);
  assert.equal(poprawnyKod(null), false);
});

/* ══════════════ etap 3: kod partnerski w przeglądarce klienta ════════════ */

const { zapamietajPartnera, partnerDoLeada } = await import('../src/app/partner.js');

/** Atrapa localStorage — testy biegają w gołym node. */
function atrapaStorage(poczatek = {}) {
  const dane = { ...poczatek };
  return {
    getItem: (k) => (k in dane ? dane[k] : null),
    setItem: (k, v) => {
      dane[k] = String(v);
    },
    removeItem: (k) => {
      delete dane[k];
    },
    _dane: dane,
  };
}

test('LINK ?p=KOD zapisuje kod z datą wejścia', () => {
  const st = atrapaStorage();
  zapamietajPartnera({ search: '?p=kowalski&utm_source=fb', storage: st, teraz: 1000 });
  assert.deepEqual(JSON.parse(st._dane['k24h-partner']), { kod: 'kowalski', od: 1000 });
});

test('PIERWSZY KOD WYGRYWA — drugi partner nie podbiera klienta', () => {
  const st = atrapaStorage();
  zapamietajPartnera({ search: '?p=kowalski', storage: st, teraz: 1000 });
  zapamietajPartnera({ search: '?p=nowak', storage: st, teraz: 2000 });
  assert.equal(JSON.parse(st._dane['k24h-partner']).kod, 'kowalski');
});

test('kod ze śmieciami nie zapisuje się wcale', () => {
  const st = atrapaStorage();
  for (const s of ['?p=AB', '?p=a', '?p=ko%20d', '?p=' + 'x'.repeat(30), '?q=kowalski', ''])
    zapamietajPartnera({ search: s, storage: st, teraz: 1000 });
  assert.equal(st._dane['k24h-partner'], undefined);
});

test('wpis starszy niż 400 dni jest sprzątany i nowy kod może wejść', () => {
  const d = 86400000;
  const st = atrapaStorage({ 'k24h-partner': JSON.stringify({ kod: 'stary', od: 0 }) });
  zapamietajPartnera({ search: '?p=nowak', storage: st, teraz: 401 * d });
  assert.equal(JSON.parse(st._dane['k24h-partner']).kod, 'nowak', 'przeterminowany wpis miał ustąpić');
});

test('partnerDoLeada oddaje {kod, od} albo null — o ważności decyduje SERWER', () => {
  const st = atrapaStorage({ 'k24h-partner': JSON.stringify({ kod: 'kowalski', od: 1000 }) });
  assert.deepEqual(partnerDoLeada({ storage: st, teraz: 2000 }), { kod: 'kowalski', od: 1000 });
  assert.equal(partnerDoLeada({ storage: atrapaStorage(), teraz: 2000 }), null);
  // Zepsuty wpis (ręczna edycja storage) nie wywraca bramki.
  const zepsuty = atrapaStorage({ 'k24h-partner': '{nie-json' });
  assert.equal(partnerDoLeada({ storage: zepsuty, teraz: 2000 }), null);
});

test('PODŁĄCZENIE (wzorzec 30.08: funkcja bez podłączenia to połowa roboty)', () => {
  assert.match(zrodlo('src/main.js'), /zapamietajPartnera\(\)/, 'main.js nie łapie ?p= przy wejściu');
  assert.match(zrodlo('src/app/bramka.js'), /partner: partnerDoLeada\(\)/, 'bramka nie dokleja partnera do leada');
});

/* ═══════════ etap 5: strona /dla-partnerow — zero śladów stawek ══════════ */

test('STRONA dla-partnerow istnieje i jest podłączona (vite, redirect /p/)', () => {
  assert.ok(fs.existsSync(new URL('../dla-partnerow.html', import.meta.url)), 'brak dla-partnerow.html');
  assert.match(zrodlo('vite.config.js'), /dla-partnerow\.html/, 'strona poza buildem Vite');
  const netlify = zrodlo('netlify.toml');
  assert.match(netlify, /from = "\/p\/\*"/, 'brak przekierowania /p/KOD');
  assert.match(netlify, /to = "\/\?p=:splat"/, '/p/KOD nie przepisuje się na ?p=');
});

test('STRONA: stawki NIEJAWNE — żadnych procentów ani kwot prowizji', () => {
  // CSS ma prawo do „100%" (szerokość pola) — tniemy bloki <style>, bo
  // wyciek stawki może siedzieć wyłącznie w treści, nie w arkuszu.
  const html = zrodlo('dla-partnerow.html').replace(/<style>[\s\S]*?<\/style>/g, '');
  // Decyzja Dawida: na stronie TYLKO „atrakcyjna prowizja — szczegóły przy
  // pierwszej rozmowie". Każda liczba ze znakiem % to wyciek stawki.
  assert.doesNotMatch(html, /\d\s*%/, 'liczba z procentem na stronie publicznej');
  assert.doesNotMatch(html, /%\s*\d/, 'procent z liczbą na stronie publicznej');
  assert.doesNotMatch(html, /prowizj\w*\s+(wynosi|to)\s/i, 'strona zdradza wysokość prowizji');
  assert.match(html, /szczegóły (przy|w) pierwszej rozmowie/i, 'brak obiecanego zdania o rozmowie');
});

test('STRONA: tytuł wg wzorca, formularz z kompletem pól i pułapką', () => {
  const html = zrodlo('dla-partnerow.html');
  assert.match(html, /<title>[^<]*[Pp]rogram partnerski[^<]*<\/title>/);
  assert.match(html, /wycena online w 2 minuty/i, 'description bez sprawdzonego CTA');
  assert.match(html, /rel="canonical" href="https:\/\/kam24h\.pl\/dla-partnerow"/);
  for (const pole of ['name="imie"', 'name="firma"', 'name="typ"', 'name="telefon"', 'name="email"'])
    assert.match(html, new RegExp(pole), `formularz bez pola ${pole}`);
  assert.match(html, /name="pulapka"/, 'formularz bez pola-pułapki na boty');
  for (const typ of ['stolarz', 'meble', 'projektant'])
    assert.match(html, new RegExp(`value="${typ}"`), `brak typu ${typ} w wyborze`);
  assert.match(html, /workers\.dev\/partner/, 'formularz nie celuje w trasę /partner');
  // Obietnica przypisania — liczba DNI jest jawna (to przekaz), stawka nie.
  assert.match(html, /365 dni/, 'brak obietnicy przypisania klienta');
});

test('STRONA: bez słów z listy strażnika bundla (marża/rabat/narzut/zakupowe)', () => {
  /*
   * ⚠ Z PRODUKCJI (27.10.2026): pierwsza wersja strony miała „prowizję
   * płacimy z naszej marży" — scripts/sprawdz-bundle.mjs (strażnik
   * tajemnicy handlowej) PRZERWAŁ build na Netlify i /dla-partnerow
   * oddawał 404, a cała strona została przy starej wersji. Ten test łapie
   * to lokalnie, zanim commit dojedzie do builda.
   */
  const html = zrodlo('dla-partnerow.html');
  assert.doesNotMatch(html, /rabat/i, 'słowo „rabat" ubije build (strażnik bundla)');
  assert.doesNotMatch(html, /mar[żz]a|mar[żz]y|mar[żz]ą|mar[żz]ę/i, 'słowo „marża" ubije build');
  assert.doesNotMatch(html, /\bnarzut\b/i, 'słowo „narzut" ubije build');
  assert.doesNotMatch(html, /zakupow|cena zakupu/i, 'ceny zakupowe ubiją build');
});

test('STRONA: w sitemapie po `npm run sitemap`', () => {
  assert.match(zrodlo('public/sitemap.xml'), /kam24h\.pl\/dla-partnerow/, 'strony nie ma w sitemapie');
});

test('DOJŚCIE do /dla-partnerow: stopka wszystkich stron + pasek na głównej (29.10)', () => {
  // Dawid: „czemu nie widać na stronie głównej" — strona bez dojścia
  // to strona, której nie ma.
  const fs2 = fs;
  const strony = [...fs2.readdirSync(new URL('..', import.meta.url))
      .filter((f) => f.endsWith('.html')),
    ...fs2.readdirSync(new URL('../baza-wiedzy', import.meta.url)).map((f) => 'baza-wiedzy/' + f)]
    .filter((f) => f.endsWith('.html') && f !== 'podglad.html');
  const bezLinku = strony.filter((p) => {
    const t = zrodlo(p);
    if (!t.includes('/o-mnie">O właścicielu</a>')) return false; // strony bez pełnej stopki
    return !t.includes('href="/dla-partnerow"') && !t.includes('foot-tu">Dla partnerów');
  });
  assert.deepEqual(bezLinku, [], `stopka bez linku „Dla partnerów": ${bezLinku.join(', ')}`);

  const glowna = zrodlo('index.html');
  assert.match(glowna, /pasek-partnerzy/, 'główna bez paska partnerskiego');
  assert.match(glowna, /stolarzem, firmą meblową albo projektantem/i);
  assert.match(glowna, /Współpracuj z nami/);
  assert.doesNotMatch(glowna.match(/<section[^>]*sekcja-partnerzy[\s\S]*?<\/section>/)[0], /!/,
    'pasek ma zapraszać, nie krzyczeć — bez wykrzykników');
  assert.match(zrodlo('src/style.css'), /\.pasek-partnerzy/, 'brak stylu paska');
});

test('FORMULARZ: etykiety i selekt jawnie ciemne na białej karcie (kontrast AA)', () => {
  // Zgłoszenie Dawida (29.10, zrzut): strona ma ciemny motyw, karta
  // formularza jest biała — etykiety dziedziczyły jasnozłoty kolor
  // i ginęły. Kolory muszą być JAWNE w stylach karty.
  const html = zrodlo('dla-partnerow.html');
  const styl = (html.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
  assert.match(styl, /\.pf label[^}]*color:\s*#2b2823/, 'etykiety bez jawnego ciemnego koloru');
  assert.match(styl, /\.pf input, \.pf select[^}]*color:\s*#2b2823/, 'pola/selekt bez jawnego koloru tekstu');
  assert.match(styl, /\.pf \{[^}]*color:\s*#2b2823/, 'karta bez bazowego koloru tekstu');
});

/* ═══════ indywidualne prowizje per partner (zlecenie Dawida, 29.10) ═══════ */

test('STAWKA INDYWIDUALNA: pole partnera nadpisuje globalne, puste dziedziczy', () => {
  const k = KONFIG_DOMYSLNA; // 15 / 10 / 15
  const bez = {}; // partner bez indywidualnych stawek
  assert.equal(stawkaProwizji({ premium: false, pierwsze: true, konfig: k, partner: bez }), 15);
  assert.equal(stawkaProwizji({ premium: false, pierwsze: false, konfig: k, partner: bez }), 10);

  const wlasne = { procPierwsze: 20, procKolejne: 12, procPremium: 18 };
  assert.equal(stawkaProwizji({ premium: false, pierwsze: true, konfig: k, partner: wlasne }), 20);
  assert.equal(stawkaProwizji({ premium: false, pierwsze: false, konfig: k, partner: wlasne }), 12);
  // Premium to OSOBNE, trzecie pole — też z dziedziczeniem.
  assert.equal(stawkaProwizji({ premium: true, pierwsze: true, konfig: k, partner: wlasne }), 18);

  // Nadpisane tylko „pierwsze" — reszta z globalnych (null = dziedziczy).
  const czesciowe = { procPierwsze: 25, procKolejne: null, procPremium: null };
  assert.equal(stawkaProwizji({ premium: false, pierwsze: true, konfig: k, partner: czesciowe }), 25);
  assert.equal(stawkaProwizji({ premium: false, pierwsze: false, konfig: k, partner: czesciowe }), 10);
  assert.equal(stawkaProwizji({ premium: true, pierwsze: false, konfig: k, partner: czesciowe }), 15);

  // Zero jest LEGALNĄ stawką indywidualną (0%), nie „pustym" polem.
  assert.equal(stawkaProwizji({ premium: false, pierwsze: true, konfig: k, partner: { procPierwsze: 0 } }), 0);

  // Bez partnera w ogóle — jak dotąd (zgodność wstecz).
  assert.equal(stawkaProwizji({ premium: false, pierwsze: true, konfig: k }), 15);
});

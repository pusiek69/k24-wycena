/**
 * SKĄD PRZYSZEDŁ KLIENT — znaczniki kampanii a zgoda marketingowa.
 *
 *   node --test scripts/test-zrodlo.mjs
 *
 * Najważniejsza reguła: bez zgody na marketing do bazy klientów nie trafia
 * ani gclid, ani UTM-y, ani adres odsyłający — samo „nieznane".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { zapamietajZrodlo, zrodloLeada } from '../src/app/zrodlo.js';

const KLUCZ_ZGODY = 'k24h-zgody';

/** Minimalna przeglądarka: dwa magazyny, adres strony i referrer. */
function przegladarka({ adres = 'https://kam24h.pl/', referrer = '', zgoda = null } = {}) {
  const magazyn = (start = {}) => {
    const dane = new Map(Object.entries(start));
    return {
      getItem: (k) => (dane.has(k) ? dane.get(k) : null),
      setItem: (k, v) => dane.set(k, String(v)),
      removeItem: (k) => dane.delete(k),
    };
  };

  globalThis.location = new URL(adres);
  globalThis.document = { referrer };
  globalThis.sessionStorage = magazyn();
  globalThis.localStorage = magazyn(
    zgoda ? { [KLUCZ_ZGODY]: JSON.stringify({ wybor: zgoda, data: new Date().toISOString() }) } : {}
  );
}

const ADRES_Z_REKLAMY =
  'https://kam24h.pl/?gclid=EAIaIQobChMI&utm_source=google&utm_medium=cpc&utm_campaign=blaty-tarnobrzeg';

/* ─────────────────────────────────────────────────────── zgoda rządzi */

test('bez zgody marketingowej źródło jest nieznane, mimo gclid w adresie', () => {
  przegladarka({ adres: ADRES_Z_REKLAMY, zgoda: null });
  zapamietajZrodlo();
  assert.deepEqual(zrodloLeada(), { typ: 'nieznane' });
});

test('zgoda „tylko niezbędne" też znaczy nieznane', () => {
  przegladarka({ adres: ADRES_Z_REKLAMY, zgoda: 'niezbedne' });
  zapamietajZrodlo();
  assert.deepEqual(zrodloLeada(), { typ: 'nieznane' });
});

test('przy pełnej zgodzie rozpoznajemy kliknięcie w reklamę', () => {
  przegladarka({ adres: ADRES_Z_REKLAMY, zgoda: 'wszystkie' });
  zapamietajZrodlo();
  const z = zrodloLeada();
  assert.equal(z.typ, 'ads');
  assert.equal(z.gclid, 'EAIaIQobChMI');
  assert.equal(z.utm_campaign, 'blaty-tarnobrzeg');
});

test('wejście z wyszukiwarki bez reklamy to źródło organiczne', () => {
  przegladarka({ adres: 'https://kam24h.pl/', referrer: 'https://www.google.com/', zgoda: 'wszystkie' });
  zapamietajZrodlo();
  const z = zrodloLeada();
  assert.equal(z.typ, 'organiczne');
  assert.equal(z.referrer, 'www.google.com');
  assert.equal(z.gclid, undefined);
});

test('sama kampania płatna bez gclid też liczy się jako reklama', () => {
  przegladarka({ adres: 'https://kam24h.pl/?utm_medium=cpc&utm_source=google', zgoda: 'wszystkie' });
  zapamietajZrodlo();
  assert.equal(zrodloLeada().typ, 'ads');
});

/* ──────────────────────────────────────────── znacznik przeżywa wędrówkę */

test('gclid z wejścia przeżywa przejście na podstronę bez parametrów', () => {
  przegladarka({ adres: ADRES_Z_REKLAMY, zgoda: 'wszystkie' });
  zapamietajZrodlo();

  // Klient klika w menu — ten sam sessionStorage, adres już bez znaczników.
  globalThis.location = new URL('https://kam24h.pl/blaty-ze-spieku');
  globalThis.document = { referrer: 'https://kam24h.pl/' };
  zapamietajZrodlo();

  const z = zrodloLeada();
  assert.equal(z.typ, 'ads');
  assert.equal(z.gclid, 'EAIaIQobChMI');
});

test('nowe kliknięcie w reklamę nadpisuje poprzednie źródło', () => {
  przegladarka({ adres: 'https://kam24h.pl/?utm_source=facebook&utm_medium=social', zgoda: 'wszystkie' });
  zapamietajZrodlo();
  globalThis.location = new URL('https://kam24h.pl/?gclid=NOWY123&utm_medium=cpc');
  zapamietajZrodlo();

  const z = zrodloLeada();
  assert.equal(z.gclid, 'NOWY123');
  assert.equal(z.utm_source, undefined, 'liczy się ostatnie kliknięcie');
});

test('własny ruch po stronie nie podszywa się pod adres odsyłający', () => {
  przegladarka({ adres: 'https://kam24h.pl/', referrer: 'https://kam24h.pl/realizacje', zgoda: 'wszystkie' });
  zapamietajZrodlo();
  assert.equal(zrodloLeada().referrer, undefined);
});

/* ─────────────────────────────────────────────────────── tryb prywatny */

test('brak storage nie wywala zgłoszenia', () => {
  przegladarka({ adres: ADRES_Z_REKLAMY, zgoda: 'wszystkie' });
  const wybuch = () => {
    throw new Error('storage wyłączony');
  };
  globalThis.sessionStorage = { getItem: wybuch, setItem: wybuch, removeItem: wybuch };

  assert.doesNotThrow(zapamietajZrodlo);
  assert.equal(zrodloLeada().typ, 'organiczne', 'bez zapamiętanych znaczników zostaje organiczne');
});

test('długie znaczniki są przycinane', () => {
  przegladarka({ adres: 'https://kam24h.pl/?gclid=' + 'x'.repeat(400), zgoda: 'wszystkie' });
  zapamietajZrodlo();
  assert.equal(zrodloLeada().gclid.length, 120);
});

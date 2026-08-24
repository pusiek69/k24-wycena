/**
 * PODGLĄD PRZED WYSYŁKĄ — treść maila do klienta.
 *
 *   node --test scripts/test-podglad-oferty.mjs
 *
 * Decyzja Dawida (21.08.2026): żadnego cichego wysyłania — najpierw
 * podgląd tego, co dostanie klient, potem potwierdzenie. Podgląd i wysyłka
 * używają TEGO SAMEGO generatora treści (worker/mail-oferty.js), więc nie
 * mają jak się rozjechać; tutaj pilnujemy, co ten generator pokazuje,
 * a czego pokazać nie może.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mailOferty, TEMAT_OFERTY } from '../worker/mail-oferty.js';
import { bezCenJednostkowych } from '../src/app/oferta-detal.js';

const LINK = 'https://kam24h.pl/oferta#a1b2c3';

const OFERTA = (nadpisz = {}) => ({
  opis: 'Avant Quartz · Dijon · 20 mm · 60×300 cm',
  pozycje: [
    { nazwa: 'Materiał', detal: bezCenJednostkowych('1 płyta · 5,2 m² materiału'), brutto: 4433, gratis: false },
    { nazwa: 'Otwory w blacie', detal: bezCenJednostkowych('2 szt. × 150 zł'), brutto: 263, gratis: false },
    { nazwa: 'Transport i montaż u klienta', detal: '1,8 m²', brutto: 0, gratis: true },
  ],
  razemPrzed: 9300,
  razem: 6938,
  przekresl: false,
  stawkaVat: 0.08,
  odbiorWlasny: false,
  ...nadpisz,
});

/* ─────────────────────────────────── co mail pokazuje */

test('mail niesie kwotę końcową, opis i link do wyceny online', () => {
  const html = mailOferty('Anna', OFERTA(), LINK);
  assert.match(html, /6 938 zł/);
  assert.match(html, /Avant Quartz · Dijon/);
  assert.match(html, new RegExp(LINK.replace(/[#]/g, '\\#')));
  assert.match(html, /ważna 30 dni/);
  assert.match(html, /796 991 128/);
});

test('temat jest jeden dla podglądu i wysyłki', () => {
  assert.match(TEMAT_OFERTY, /Wycena przygotowana przez Dawida Ząbka/);
});

test('gratisy widać zawsze — to argument negocjacyjny', () => {
  const html = mailOferty('', OFERTA(), LINK);
  assert.match(html, /Transport i montaż u klienta/);
  assert.match(html, /<b>gratis<\/b>/);
});

/* ────────────────── czego mail pokazać nie może */

test('w mailu nie ma cen jednostkowych', () => {
  const html = mailOferty('Anna', OFERTA(), LINK);
  assert.doesNotMatch(html, /×\s*150\s*zł/, 'stawka za otwór nie może wyciec');
  assert.doesNotMatch(html, /zł\/m²/);
});

test('przekreślona cena „przed" tylko przy świadomie pokazanej obniżce', () => {
  assert.doesNotMatch(mailOferty('Anna', OFERTA(), LINK), /line-through/);
  const zObnizka = mailOferty('Anna', OFERTA({ przekresl: true }), LINK);
  assert.match(zObnizka, /line-through/);
  assert.match(zObnizka, /9 300 zł/);
});

test('obniżki nie pokazujemy, gdy nie ma z czego — cena nie spadła', () => {
  const html = mailOferty('Anna', OFERTA({ przekresl: true, razem: 9300, razemPrzed: 9300 }), LINK);
  assert.doesNotMatch(html, /line-through/);
});

test('imię klienta jest eskejpowane — nie da się wstrzyknąć HTML-a', () => {
  const html = mailOferty('<script>alert(1)</script>', OFERTA(), LINK);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
});

test('bez imienia mail dalej czyta się poprawnie', () => {
  const html = mailOferty('', OFERTA(), LINK);
  assert.doesNotMatch(html, /Pan\(i\)\s*—/);
  assert.match(html, /rzygotowałem indywidualną wycenę/);
});

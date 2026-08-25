/**
 * ROZDZIELANIE ODPOWIEDZI KONSULTANTA — tekst dla klienta vs obiekt akcji.
 *
 *   node --test scripts/test-rozdziel.mjs
 *
 * Powód istnienia: 20.08.2026 model odpowiedział DWOMA obiektami akcji
 * naraz („policzę oba warianty — 20 i 30 mm"), a stare cięcie od pierwszego
 * `{` do ostatniego `}` sklejało je w nieparsowalną zbitkę — klient zobaczył
 * surowy JSON w rozmowie, a wycena się nie policzyła.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { rozdziel, slugMaterialu, przelozParametry } from '../src/app/parametry.js';

const AKCJA = (grubosc, message) =>
  JSON.stringify({ action: 'quote', params: { material: 'interq', grubosc }, message });

test('zwykła odpowiedź: jeden JSON znika, zostaje message', () => {
  const { tekst, akcja } = rozdziel(`Wycena gotowa. ${AKCJA('20', 'Proszę o kontakt.')}`);
  assert.equal(akcja.action, 'quote');
  assert.equal(tekst, 'Proszę o kontakt.');
});

test('dwa obiekty akcji: wykonuje się ostatni, klient nie widzi żadnego', () => {
  const surowa = `Policzę oba warianty. ${AKCJA('20', 'Wariant 20 mm.')} A grubsza wersja: ${AKCJA('30', 'Wariant 30 mm.')}`;
  const { tekst, akcja } = rozdziel(surowa);
  assert.equal(akcja.params.grubosc, '30', 'ostatnia akcja wygrywa');
  assert.equal(tekst, 'Wariant 30 mm.');
  assert.doesNotMatch(tekst, /action|params|\{/, 'żaden JSON nie przecieka do rozmowy');
});

test('akcja bez message: tekstem zostaje treść spoza bloków', () => {
  const bez = JSON.stringify({ action: 'lead', message: '' });
  const { tekst, akcja } = rozdziel(`Proszę o kontakt. ${bez} Oddzwonimy.`);
  assert.equal(akcja.action, 'lead');
  assert.equal(tekst, 'Proszę o kontakt. Oddzwonimy.');
});

test('nawiasy klamrowe w zwykłym tekście nie są akcją', () => {
  const surowa = 'Płyta ma format {162 × 324} cm — to nie JSON.';
  const { tekst, akcja } = rozdziel(surowa);
  assert.equal(akcja, null);
  assert.equal(tekst, surowa);
});

test('JSON innego rodzaju (nie quote/lead) zostaje w tekście', () => {
  const surowa = 'Przykład: {"format":"162x324"} — tak opisujemy płyty.';
  const { tekst, akcja } = rozdziel(surowa);
  assert.equal(akcja, null);
  assert.equal(tekst, surowa);
});

test('zagnieżdżone klamry w params nie psują wykrywania granic', () => {
  const surowa = `Tekst. {"action":"quote","params":{"odcinki":[{"d":60,"w":300}],"opcje":{"a":{"b":1}}},"message":"OK"}`;
  const { tekst, akcja } = rozdziel(surowa);
  assert.equal(akcja.params.odcinki[0].w, 300);
  assert.equal(tekst, 'OK');
});

test('uszkodzony JSON nie wywraca rozmowy', () => {
  const surowa = 'Tekst {"action":"quote","params":{urwane';
  const { tekst, akcja } = rozdziel(surowa);
  assert.equal(akcja, null);
  assert.equal(tekst, surowa);
});

/* ══════ NOWY CENNIK DZIAŁA BEZ DOPISYWANIA GO W KODZIE (25.08.2026) ══════
 *
 * Pacific: konsultant znał już kolekcję i odsyłał poprawne `quote`
 * z material: „pacific", ale tablica synonimów go nie znała — więc
 * przeglądarka mówiła klientowi, że wycenę przygotuje Dawid osobiście.
 */

test('nazwa spoza tablicy synonimów normalizuje się do sluga', () => {
  assert.equal(slugMaterialu('pacific'), 'pacific');
  assert.equal(slugMaterialu('Pacific'), 'pacific');
  assert.equal(slugMaterialu('  PACIFIC  '), 'pacific');
});

test('podkreślenia i spacje stają się myślnikiem — jak w slugach firm', () => {
  assert.equal(slugMaterialu('nowa_firma'), 'nowa-firma');
  assert.equal(slugMaterialu('nowa firma'), 'nowa-firma');
});

test('synonimy nadal wygrywają z normalizacją', () => {
  assert.equal(slugMaterialu('grande'), 'marazzi');
  assert.equal(slugMaterialu('atlas'), 'atlas-plan');
  assert.equal(slugMaterialu('florim'), 'florim-stone');
  assert.equal(slugMaterialu('kamien_naturalny'), 'interstone');
});

test('pusta nazwa nadal nie daje sluga', () => {
  assert.equal(slugMaterialu(''), undefined);
  assert.equal(slugMaterialu(null), undefined);
});

test('parametry z Pacifica przekładają się na wycenę', () => {
  const w = przelozParametry({
    material: 'pacific', dekor: 'Velvet', grubosc: '20',
    odcinki: [{ d: 60, w: 320 }], otwory: 1,
  });
  assert.ok(w, 'Pacific nie przełożył się na parametry wyceny');
  assert.equal(w.slug, 'pacific');
  assert.equal(w.dane.dekor, 'Velvet');
  assert.deepEqual(w.dane.odcinki, [{ gl: 60, dl: 320 }]);
});

test('kamień naturalny nadal idzie własną ścieżką', () => {
  assert.equal(przelozParametry({ material: 'interstone', odcinki: [{ d: 60, w: 300 }] }), null);
});

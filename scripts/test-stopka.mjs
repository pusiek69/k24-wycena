/**
 * STOPKA — spójność nawigacji na wszystkich stronach serwisu.
 *
 *   node --test scripts/test-stopka.mjs
 *
 * ⚠ POWÓD POWSTANIA (30.08.2026, przegląd produkcji).
 *
 * Strony budowane ze WZORCA dziedziczą jego stopkę razem ze znacznikiem
 * „tu jesteś" (`foot-tu`), który dotyczy wzorca, nie nowej strony.
 * Tak wyszła strona wyprzedaży: powstała z blatów łazienkowych i miała
 * w stopce wyszarzone, nieklikalne „Blaty łazienkowe”. Z zewnątrz wygląda
 * to jak zepsuty odnośnik — i nim jest.
 *
 * Zasada, której pilnują te testy: na każdej stronie DOKŁADNIE JEDEN wpis
 * stopki jest „tu jesteś", i to ten, na której stronie właśnie jesteśmy.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = new URL('../', import.meta.url);

/** Strony serwisu (bez podglądu roboczego i katalogu build). */
function strony() {
  const korzen = fs
    .readdirSync(new URL('.', ROOT))
    .filter((f) => f.endsWith('.html') && f !== 'podglad.html');
  const baza = fs
    .readdirSync(new URL('baza-wiedzy/', ROOT))
    .filter((f) => f.endsWith('.html'))
    .map((f) => `baza-wiedzy/${f}`);
  return [...korzen, ...baza];
}

const czytaj = (p) => fs.readFileSync(new URL(p, ROOT), 'utf8');

/** Adres, pod którym strona żyje: `blaty-lazienkowe.html` → `/blaty-lazienkowe`. */
function adresStrony(plik) {
  const bez = plik.replace(/\.html$/, '');
  if (bez === 'index') return '/';
  if (bez.endsWith('/index')) return '/' + bez.replace(/\/index$/, '/');
  return '/' + bez;
}

test('żadna strona nie oznacza CUDZEGO wpisu jako „tu jesteś"', () => {
  const zle = [];

  for (const plik of strony()) {
    const html = czytaj(plik);
    const znaczniki = [...html.matchAll(/<span class="foot-tu">([^<]*)<\/span>/g)].map((m) =>
      m[1].trim()
    );
    if (!znaczniki.length) continue;

    /*
     * „Tu jesteś" ma sens tylko dla TEJ strony. Sprawdzamy to po linku:
     * jeśli gdziekolwiek indziej w serwisie ta sama nazwa jest linkiem,
     * to musi prowadzić do strony, na której właśnie stoimy.
     */
    const adres = adresStrony(plik);
    for (const nazwa of znaczniki) {
      const wzor = new RegExp(`<a href="([^"]+)">${nazwa.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</a>`);
      // Szukamy w dowolnej innej stronie, jak ten wpis wygląda jako link.
      let docelowy = null;
      for (const inny of strony()) {
        if (inny === plik) continue;
        const m = czytaj(inny).match(wzor);
        if (m) {
          docelowy = m[1];
          break;
        }
      }
      if (docelowy && docelowy !== adres) {
        zle.push(`${plik}: „${nazwa}" jest wyszarzone, a prowadzi do ${docelowy}`);
      }
    }
  }

  assert.deepEqual(zle, [], 'Martwe wpisy w stopce:\n  ' + zle.join('\n  '));
});

test('każda strona ma co najwyżej JEDEN wpis „tu jesteś" w kolumnie usług', () => {
  const zle = [];
  for (const plik of strony()) {
    const html = czytaj(plik);
    const kolumna = html.match(/<nav aria-label="Co robimy">([\s\S]*?)<\/nav>/);
    if (!kolumna) continue;
    const ile = (kolumna[1].match(/class="foot-tu"/g) || []).length;
    if (ile > 1) zle.push(`${plik}: ${ile} wpisów „tu jesteś"`);
  }
  assert.deepEqual(zle, [], zle.join('\n'));
});

test('strona wyprzedaży linkuje do blatów łazienkowych, a nie wyszarza ich', () => {
  // Konkretny przypadek z produkcji — pilnujemy go wprost, bo generator
  // strony wyprzedaży dziedziczy stopkę właśnie po tamtej stronie.
  const html = czytaj('wyprzedaz-plyt.html');
  assert.match(html, /<a href="\/blaty-lazienkowe">Blaty łazienkowe<\/a>/);
  assert.match(html, /<span class="foot-tu">Wyprzedaż płyt<\/span>/);
  assert.doesNotMatch(html, /<span class="foot-tu">Blaty łazienkowe<\/span>/);
});

test('każda INDEKSOWANA strona ma 301 z wersji .html', () => {
  /*
   * Bez przekierowania Google widzi dwa adresy z tą samą treścią
   * (`/licencja-zdjec` i `/licencja-zdjec.html`) i sam wybiera, który
   * pokazać. Strony z `noindex` (podziękowanie, oferta klienta) tego
   * problemu nie mają — wyszukiwarka i tak ich nie indeksuje.
   */
  const netlify = czytaj('netlify.toml');
  const brakuje = strony()
    .filter((p) => !p.startsWith('baza-wiedzy/') && p !== 'index.html' && p !== '404.html')
    .filter((p) => !/name="robots" content="noindex/.test(czytaj(p)))
    .filter((p) => !netlify.includes(`from = "/${p}"`));
  assert.deepEqual(brakuje, [], 'Strony bez przekierowania z .html:\n  ' + brakuje.join('\n  '));
});

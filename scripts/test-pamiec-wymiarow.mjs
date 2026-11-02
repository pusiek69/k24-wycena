/**
 * PAMIĘĆ WYMIARÓW KLIENTA (zlecenie Dawida, 2.11.2026).
 *
 *   node --test scripts/test-pamiec-wymiarow.mjs
 *
 * Klient, który raz policzył blat i wraca (np. sprawdzić inny materiał),
 * nie wpisuje wymiarów od nowa: ostatnie odcinki (z etykietami) leżą
 * w localStorage JEGO przeglądarki (nic nie idzie na serwer przed leadem),
 * wygasają po 90 dniach. Propozycja „Użyć poprzednich wymiarów?" z trzema
 * drogami: te same / edytuj / od nowa.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  zapamietajWymiary,
  poprzednieWymiary,
  zapomnijWymiary,
  opisWymiarow,
  WAZNOSC_WYMIAROW_DNI,
} from '../src/app/pamiec-wymiarow.js';

const zrodlo = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

function atrapa(poczatek = {}) {
  const dane = { ...poczatek };
  return {
    getItem: (k) => (k in dane ? dane[k] : null),
    setItem: (k, v) => { dane[k] = String(v); },
    removeItem: (k) => { delete dane[k]; },
    _dane: dane,
  };
}

const ODCINKI = [
  { gl: 60, dl: 300, etykieta: 'Blat' },
  { gl: 100, dl: 220, etykieta: 'Wyspa' },
];

test('zapis i odczyt: odcinki z etykietami wracają w całości', () => {
  const st = atrapa();
  zapamietajWymiary(ODCINKI, { storage: st, teraz: 1000 });
  const w = poprzednieWymiary({ storage: st, teraz: 2000 });
  assert.deepEqual(w.odcinki, ODCINKI);
});

test('wygaszanie: po 90 dniach pamięć znika (i jest sprzątana)', () => {
  const d = 86400000;
  assert.equal(WAZNOSC_WYMIAROW_DNI, 90, 'obiecane 90 dni');
  const st = atrapa();
  zapamietajWymiary(ODCINKI, { storage: st, teraz: 0 });
  assert.ok(poprzednieWymiary({ storage: st, teraz: 89 * d }), '89 dni — jeszcze pamięta');
  assert.equal(poprzednieWymiary({ storage: st, teraz: 91 * d }), null, '91 dni — zapomina');
  assert.equal(st._dane['k24h-wymiary'], undefined, 'przeterminowany wpis ma być sprzątnięty');
});

test('śmieci nie wchodzą: puste/zepsute/bez sensownych odcinków = brak zapisu', () => {
  const st = atrapa();
  zapamietajWymiary([], { storage: st, teraz: 1 });
  zapamietajWymiary(null, { storage: st, teraz: 1 });
  zapamietajWymiary([{ gl: 0, dl: 0 }], { storage: st, teraz: 1 });
  assert.equal(st._dane['k24h-wymiary'], undefined);
  const zepsuty = atrapa({ 'k24h-wymiary': '{nie-json' });
  assert.equal(poprzednieWymiary({ storage: zepsuty, teraz: 1 }), null);
});

test('zapomnijWymiary czyści („Zacznij od nowa")', () => {
  const st = atrapa();
  zapamietajWymiary(ODCINKI, { storage: st, teraz: 1 });
  zapomnijWymiary({ storage: st });
  assert.equal(poprzednieWymiary({ storage: st, teraz: 2 }), null);
});

test('opis do jednego jasnego pytania: „Blat 60×300 cm + Wyspa 100×220 cm"', () => {
  assert.equal(opisWymiarow(ODCINKI), 'Blat 60×300 cm + Wyspa 100×220 cm');
  assert.equal(opisWymiarow([{ gl: 60, dl: 250 }]), '60×250 cm');
});

test('PODŁĄCZENIE: bramka zapamiętuje przy wysyłce, rozmowa i kreator proponują', () => {
  assert.match(zrodlo('src/app/bramka.js'), /zapamietajWymiary\(/, 'bramka nie zapisuje wymiarów');
  const pom = zrodlo('src/app/pomocnicy.js');
  assert.match(pom, /poprzednieWymiary\(/, 'pomocnik wymiarów nie zna pamięci');
  assert.match(pom, /Użyć poprzednich wymiarów\?/, 'brak pytania w rozmowie');
  assert.match(pom, /Tak, te same/, 'brak drogi „te same"');
  assert.match(pom, /Zacznij od nowa/, 'brak drogi „od nowa"');
  const kroki = zrodlo('src/app/kroki.js');
  assert.match(kroki, /poprzednieWymiary\(/, 'kreator awaryjny nie zna pamięci');
  assert.match(kroki, /Użyć poprzednich wymiarów\?/, 'brak propozycji w kreatorze');
});

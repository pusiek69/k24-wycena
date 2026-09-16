/**
 * ETYKIETY ODCINKÓW BLATU (zlecenie Dawida, 16.09.2026).
 *
 *   node --test scripts/test-etykiety-odcinkow.mjs
 *
 * „Jak dodaję odcinki blatów, chciałbym móc podpisać dany element,
 *  np. Wyspa, Fartuch czy Blat 1."
 *
 * Etykieta przechodzi przez pół aplikacji: kalkulator → lead → mail →
 * rozrys → oferta → panel → „Powtórz wycenę". Te testy pilnują trzech
 * rzeczy, na których taka przeprowadzka zwykle się wykłada:
 *   • BEZ etykiety wszystko wygląda dokładnie jak przedtem,
 *   • etykieta nie gubi się po drodze (zapis → odczyt → rozrys),
 *   • etykieta nie wysadza formatu tam, gdzie wpisuje ją człowiek.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAKS_ETYKIETA,
  PODPOWIEDZI_ETYKIET,
  czystaEtykieta,
  etykietaOdcinka,
  maEtykiety,
  odcinekDoZapisu,
  opisOdcinkaZWymiarem,
  podpisOdcinka,
} from '../src/app/etykiety-odcinkow.js';
import { elementyZOdcinkow, podpisWyceny } from '../src/app/rozrys.js';
import { rozrysuj } from '../src/engine/nesting.js';
import { odcinkiZParametrow } from '../src/app/parametry.js';

/* ═══════════════════════════════ czyszczenie ═══════════════════════════ */

test('etykieta jest przycinana i sprowadzana do jednej linii', () => {
  assert.equal(czystaEtykieta('  Wyspa  '), 'Wyspa');
  assert.equal(czystaEtykieta('Blat   1'), 'Blat 1');
  assert.equal(czystaEtykieta('Wyspa\nkuchenna'), 'Wyspa kuchenna');
  assert.equal(czystaEtykieta(undefined), '');
  assert.equal(czystaEtykieta(null), '');
  assert.equal(czystaEtykieta(''), '');
});

test('za długi podpis jest ucinany, a nie odrzucany', () => {
  /*
   * Etykieta trafia na rysunek rozkroju — dłuższa i tak nie zmieści się
   * w prostokącie. Ucinamy, bo Dawid ma zobaczyć, że coś wpisał; odrzucenie
   * wyglądałoby jak zjedzone pole.
   */
  const dluga = 'Wyspa kuchenna przy oknie od strony ogrodu';
  assert.equal(czystaEtykieta(dluga).length, MAKS_ETYKIETA);
  assert.ok(czystaEtykieta(dluga).startsWith('Wyspa kuchenna'));
});

test('podpowiedzi to dokładnie te, o które prosił Dawid', () => {
  assert.deepEqual(PODPOWIEDZI_ETYKIET, ['Blat 1', 'Blat 2', 'Wyspa', 'Fartuch', 'Parapet']);
});

/* ════════════════════════ bez etykiety = jak dotąd ═════════════════════ */

test('pusta etykieta nie wchodzi do zapisu', () => {
  /*
   * Stare wyceny i te bez podpisu mają w JSON-ie wyglądać identycznie jak
   * przed zmianą — inaczej każda wycena nosiłaby pole „etykieta": "".
   */
  assert.deepEqual(odcinekDoZapisu({ gl: 60, dl: 300 }), { gl: 60, dl: 300 });
  assert.deepEqual(odcinekDoZapisu({ gl: 60, dl: 300, etykieta: '   ' }), { gl: 60, dl: 300 });
  assert.deepEqual(odcinekDoZapisu({ gl: 90, dl: 200, etykieta: ' Wyspa ' }), {
    gl: 90,
    dl: 200,
    etykieta: 'Wyspa',
  });
});

test('bez podpisu każde miejsce zostaje przy swoim dotychczasowym opisie', () => {
  assert.equal(podpisOdcinka({ gl: 60, dl: 300 }, 'Blat 2'), 'Blat 2');
  assert.equal(podpisOdcinka({ gl: 60, dl: 300 }, 'odcinek 60×300'), 'odcinek 60×300');
  assert.equal(opisOdcinkaZWymiarem({ gl: 60, dl: 300 }), '60×300');
  assert.equal(maEtykiety([{ gl: 60, dl: 300 }, { gl: 60, dl: 120 }]), false);
});

test('podpis wygrywa z domyślnym, gdy jest', () => {
  assert.equal(podpisOdcinka({ gl: 90, dl: 200, etykieta: 'Wyspa' }, 'Blat 2'), 'Wyspa');
  assert.equal(opisOdcinkaZWymiarem({ gl: 90, dl: 200, etykieta: 'Wyspa' }), 'Wyspa: 90×200');
  assert.equal(etykietaOdcinka({ etykieta: 'Fartuch' }), 'Fartuch');
  assert.equal(maEtykiety([{ gl: 60, dl: 300 }, { gl: 90, dl: 200, etykieta: 'Wyspa' }]), true);
});

/* ═══════════════════════════ rozrys płyty ══════════════════════════════ */

test('rozrys podpisuje element nazwą, a bez nazwy zostaje „Blat N"', () => {
  const elementy = elementyZOdcinkow([
    { gl: 60, dl: 300 },
    { gl: 90, dl: 200, etykieta: 'Wyspa' },
    { gl: 6, dl: 240, etykieta: ' Fartuch ' },
  ]);
  assert.deepEqual(
    elementy.map((e) => e.nazwa),
    ['Blat 1', 'Wyspa', 'Fartuch']
  );
  // Wymiary idą w mm i nie mogą się zmienić przez dołożenie podpisu.
  assert.deepEqual(
    elementy.map((e) => [e.szer, e.gl]),
    [[3000, 600], [2000, 900], [2400, 60]]
  );
});

test('nazwa dojeżdża na rysunek płyty, bo po niej podpisujemy prostokąty', () => {
  const wynik = rozrysuj(elementyZOdcinkow([{ gl: 90, dl: 200, etykieta: 'Wyspa' }]), {
    szer: 3200,
    wys: 1600,
  });
  const nazwy = wynik.plyty.flatMap((p) => p.elementy.map((e) => e.nazwa));
  assert.ok(nazwy.includes('Wyspa'), `na rysunku wylądowało ${JSON.stringify(nazwy)}`);
});

test('sama zmiana podpisu unieważnia rozrys', () => {
  /*
   * ⚠ To jest ta pułapka, przez którą Dawid wysłałby klientowi rysunek
   * ze starym napisem: wymiary się nie zmieniły, więc bez etykiety
   * w podpisie `zapewnijRozrys` uznałby rozrys za aktualny.
   */
  const przed = podpisWyceny([{ gl: 90, dl: 200, etykieta: 'Blat 2' }]);
  const po = podpisWyceny([{ gl: 90, dl: 200, etykieta: 'Wyspa' }]);
  assert.notEqual(przed, po);

  // ...ale identyczny komplet nadal daje ten sam podpis (żadnego zbędnego
  // przeliczania przy każdym przerysowaniu edytora).
  assert.equal(
    podpisWyceny([{ gl: 90, dl: 200, etykieta: 'Wyspa' }]),
    podpisWyceny([{ gl: 90, dl: 200, etykieta: ' Wyspa ' }])
  );
});

/* ═════════════════ droga przez rozmowę z konsultantem ═════════════════ */

test('podpis z parametrów konsultanta wchodzi do wyceny', () => {
  /*
   * Klient pisze „wyspa 90×200", konsultant oddaje {"d":90,"w":200,"nazwa":"Wyspa"}.
   * Bez tego przełożenia podpis kończyłby się na treści rozmowy i nie
   * dojechał ani na rozrys, ani do maila.
   */
  const odcinki = odcinkiZParametrow({
    odcinki: [
      { d: 60, w: 300 },
      { d: 90, w: 200, nazwa: '  Wyspa  ' },
      { d: 6, w: 240, etykieta: 'Fartuch' },
    ],
  });
  assert.deepEqual(odcinki, [
    { dl: 300, gl: 60 },
    { dl: 200, gl: 90, etykieta: 'Wyspa' },
    { dl: 240, gl: 6, etykieta: 'Fartuch' },
  ]);
});

test('konsultant bez nazw oddaje dokładnie to co dotąd', () => {
  assert.deepEqual(odcinkiZParametrow({ odcinki: [{ d: 60, w: 300 }] }), [{ dl: 300, gl: 60 }]);
  assert.deepEqual(odcinkiZParametrow({ odcinki: [{ d: 60, w: 300, nazwa: '   ' }] }), [
    { dl: 300, gl: 60 },
  ]);
});

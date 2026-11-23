/**
 * GEOMETRIA UMYWALKI — kawałki, niecka, metry pogrubienia.
 *
 *   node --test scripts/test-umywalka-geometria.mjs
 *
 * Punkt odniesienia dla całej budowy (specyfikacja §6.1): umywalka
 * 120 × 50 cm, krawędź 15 cm, niecka 100 × 35 × 10, pogrubiony front
 * i oba boki → 10 kawałków, 1,685 m² kamienia, 2,20 m.b. krawędzi
 * pod kątem.
 *
 * Dlaczego to ma własny test, choć wygląda na mnożenie: wzór Dawida
 * z artefaktu liczył 1,20 m.b. zamiast 2,20 (gubił boki) i pole samych
 * kawałków zamiast kupionej płyty. Oba błędy kosztowały ponad tysiąc
 * złotych na sztuce — te testy pilnują, żeby nie wróciły.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STAN_DOMYSLNY,
  PRESETY,
  nieckaStanu,
  kawalki,
  mbPogrubienia,
  poleM2,
  normalizuj,
  ostrzezeniaWymiarow,
} from '../src/umywalka/geometria.js';

const stan = (zmiany = {}) => normalizuj({ ...STAN_DOMYSLNY, ...zmiany });

/** Ile sztuk danego elementu w rozbiciu. */
const ile = (lista, nazwa) => lista.filter((k) => k.nazwa === nazwa).length;

test('120 × 50 zintegrowana, oba boki → 10 kawałków, 1,685 m², 2,20 m.b.', () => {
  const s = stan({ L: 120, G: 50, H: 15 });
  const k = kawalki(s);

  assert.equal(k.length, 10);
  assert.equal(poleM2(k), 1.685);
  assert.equal(mbPogrubienia(s), 2.2);
});

test('rozbicie 120 × 50 zgadza się ze specyfikacją §6.1 element po elemencie', () => {
  const k = kawalki(stan({ L: 120, G: 50, H: 15 }));
  const wymiar = (nazwa) => {
    const el = k.find((x) => x.nazwa === nazwa);
    return el ? [el.dl, el.gl] : null;
  };

  assert.deepEqual(wymiar('Blat górny'), [120, 50]);
  assert.deepEqual(wymiar('Pogrubienie frontu'), [120, 15]);
  assert.deepEqual(wymiar('Pogrubienie boku'), [50, 15]);
  assert.equal(ile(k, 'Pogrubienie boku'), 2);
  assert.deepEqual(wymiar('Ścianka niecki długa'), [100, 10]);
  assert.equal(ile(k, 'Ścianka niecki długa'), 2);
  assert.deepEqual(wymiar('Ścianka niecki krótka'), [35, 10]);
  assert.equal(ile(k, 'Ścianka niecki krótka'), 2);
  assert.deepEqual(wymiar('Dno niecki'), [100, 35]);
  // Wstawka pod front: (zL − 10) × H — wzór z przykładu Dawida (90 × 15).
  assert.deepEqual(wymiar('Wstawka pod front'), [90, 15]);
});

test('nablatowa → 4 kawałki, bez niecki', () => {
  const k = kawalki(stan({ typ: 'nablatowa', L: 120, G: 50, H: 15 }));

  assert.equal(k.length, 4);
  assert.equal(ile(k, 'Blat górny'), 1);
  assert.equal(ile(k, 'Pogrubienie frontu'), 1);
  assert.equal(ile(k, 'Pogrubienie boku'), 2);
  assert.equal(ile(k, 'Dno niecki'), 0);
  assert.equal(ile(k, 'Ścianka niecki długa'), 0);
});

test('nablatowa bez pogrubienia → sam blat', () => {
  const k = kawalki(stan({ typ: 'nablatowa', pogrubienie: 'brak', L: 120, G: 50 }));
  assert.equal(k.length, 1);
  assert.deepEqual([k[0].dl, k[0].gl], [120, 50]);
  assert.equal(mbPogrubienia(stan({ typ: 'nablatowa', pogrubienie: 'brak' })), 0);
});

test('pogrubienie tylko frontu → 2 kawałki mniej i mb bez boków', () => {
  const s = stan({ typ: 'nablatowa', pogrubienie: 'front', L: 120, G: 50, H: 15 });
  assert.equal(kawalki(s).length, 2);
  assert.equal(mbPogrubienia(s), 1.2);
});

test('jeden bok wyłączony → mb liczy tylko włączone', () => {
  const s = stan({ L: 120, G: 50, H: 15, bokP: false });
  assert.equal(mbPogrubienia(s), 1.7);
  assert.equal(ile(kawalki(s), 'Pogrubienie boku'), 1);
});

test('niecka automatyczna: L − 20, G − 15, 10 cm głębokości', () => {
  assert.deepEqual(nieckaStanu(stan({ L: 120, G: 50 })), { L: 100, G: 35, H: 10 });
  assert.deepEqual(nieckaStanu(stan({ L: 80, G: 46 })), { L: 60, G: 31, H: 10 });
});

test('niecka nigdy nie schodzi poniżej 40 cm długości', () => {
  assert.equal(nieckaStanu(stan({ L: 60, G: 46 })).L, 40);
});

test('niecka podana ręcznie trzyma się granic z §6.2', () => {
  // zL ≤ L − 16, zG ≤ G − 12, zH w 8–15.
  const s = stan({ L: 120, G: 50, niecka: { L: 118, G: 48, H: 30 } });
  const n = nieckaStanu(s);
  assert.equal(n.L, 104);
  assert.equal(n.G, 38);
  assert.equal(n.H, 15);
});

test('zintegrowana zawsze ma front — „brak pogrubienia" jest korygowane', () => {
  const s = stan({ typ: 'zintegrowana', pogrubienie: 'brak' });
  assert.notEqual(s.pogrubienie, 'brak');
  assert.ok(kawalki(s).some((k) => k.nazwa === 'Pogrubienie frontu'));
});

test('krawędź niższa niż niecka + 2 cm jest podnoszona', () => {
  const s = stan({ L: 120, G: 50, H: 8, niecka: { L: null, G: null, H: 10 } });
  assert.equal(s.H, 12);
});

test('presety mieszczą się w zakresach i mają głębokość z §8.3', () => {
  assert.deepEqual(
    PRESETY.map((p) => [p.L, p.G]),
    [
      [80, 46],
      [100, 50],
      [120, 50],
      [160, 50],
    ]
  );
});

test('wymiar poza zakresem daje ostrzeżenie, ale nigdy nie blokuje', () => {
  const s = stan({ L: 240, G: 70 });
  const o = ostrzezeniaWymiarow(s);
  assert.ok(o.length >= 1, 'powinno ostrzegać');
  assert.ok(o.join(' ').includes('pomiarze'));
  // Kawałki muszą się policzyć mimo nietypowego wymiaru.
  assert.ok(kawalki(s).length >= 10);
  assert.equal(ostrzezeniaWymiarow(stan({ L: 120, G: 50 })).length, 0);
});

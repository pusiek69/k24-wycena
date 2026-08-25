/**
 * CZY WDROŻONY ASYSTENT ZNA WSZYSTKIE CENNIKI?
 *
 *   npm run sprawdz:asystent
 *
 * POWÓD POWSTANIA (25.08.2026). Po dodaniu cennika Pacific konsultant na
 * produkcji odpowiadał klientowi „tego dekoru nie ma w naszych kolekcjach"
 * — mimo że kalkulator ten materiał liczył i sprzedawał.
 *
 * Prompt asystenta jest generowany z `src/firms/` przy `npm run worker`,
 * więc źródło prawdy było jedno i było poprawne. Zawiodło co innego:
 * strona idzie na produkcję przez `git push` (Netlify), a worker WYŁĄCZNIE
 * ręcznym `npx wrangler deploy`. Wystarczy zapomnieć o tym drugim kroku
 * i asystent zostaje z wiedzą sprzed cennika — a widać to dopiero wtedy,
 * gdy klient zapyta.
 *
 * Ten skrypt porównuje kolekcje z lokalnych cenników z tym, co siedzi
 * w PROMPCIE wdrożonej wersji workera (endpoint /kolekcje).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIRMY_DIR = path.join(ROOT, 'src', 'firms');
const WORKER = process.env.WORKER_URL || 'https://k24h.kamieniarstwo24h.workers.dev';

/** Te same reguły co w build-worker.mjs: aktywne, nieręczne kolekcje. */
function lokalneKolekcje() {
  return fs
    .readdirSync(FIRMY_DIR)
    .filter((f) => f.endsWith('.js') && f !== 'index.js' && !f.startsWith('_'))
    .map((f) => {
      const t = fs.readFileSync(path.join(FIRMY_DIR, f), 'utf8');
      return {
        // Porównujemy po NAZWIE HANDLOWEJ — tak samo podpisane są sekcje
        // w prompcie („## Pacific"), bo klient pisze nazwę, nie slug.
        nazwa: t.match(/nazwa:\s*'([^']+)'/)?.[1] || f.replace('.js', ''),
        aktywna: !/aktywna:\s*false/.test(t),
        reczna: /trybCeny:\s*'reczna'/.test(t),
      };
    })
    .filter((f) => f.aktywna && !f.reczna)
    .map((f) => f.nazwa)
    .sort();
}

const lokalne = lokalneKolekcje();

let zdalne;
try {
  const odp = await fetch(`${WORKER}/kolekcje`, { headers: { origin: 'https://kam24h.pl' } });
  if (!odp.ok) throw new Error(`HTTP ${odp.status}`);
  // Nagłówek niesie też fakty w nawiasie („## Pacific (płyta 348 × 201 cm…)") —
  // do porównania bierzemy samą nazwę.
  zdalne = ((await odp.json()).kolekcje || []).map((k) => k.replace(/\s*\(.*$/, '').trim()).sort();
} catch (e) {
  console.error(`✗ Nie udało się zapytać workera (${WORKER}/kolekcje): ${e.message}`);
  console.error('  Jeśli endpoint jeszcze nie istnieje — wdróż workera: npx wrangler deploy');
  process.exit(1);
}

const brakuje = lokalne.filter((k) => !zdalne.includes(k));
const nadmiar = zdalne.filter((k) => !lokalne.includes(k));

console.log(`  lokalnie:  ${lokalne.length} kolekcji`);
console.log(`  wdrożone:  ${zdalne.length} kolekcji`);

if (brakuje.length) {
  console.error(`\n✗ Asystent NIE ZNA: ${brakuje.join(', ')}`);
  console.error('  Klient zapyta o ten materiał i usłyszy, że go nie mamy.');
  console.error('  Napraw:  npm run worker && npx wrangler deploy');
  process.exit(1);
}

if (nadmiar.length) {
  console.error(`\n⚠ Asystent zna kolekcje, których nie ma lokalnie: ${nadmiar.join(', ')}`);
  console.error('  Prawdopodobnie wdrożona wersja jest NOWSZA niż to repo.');
  process.exit(1);
}

console.log('\n✓ Wdrożony asystent zna wszystkie cenniki z repo.');

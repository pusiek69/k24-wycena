/**
 * DOSTĘP DO SILNIKA WYCENY ZE SKRYPTÓW NODE
 *
 * `src/` jest pisane pod Vite: firmy zbiera `import.meta.glob`, a ceny
 * przychodzą z importów JSON. Zwykły node tego nie uruchomi, więc sklejamy
 * mikro-paczkę esbuildem (i tak jest w zależnościach) i importujemy wynik.
 *
 * Dzięki temu skrypty i checklista liczą DOKŁADNIE tym samym kodem,
 * co kalkulator w przeglądarce — bez powielania logiki cenowej.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build } from 'esbuild';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

export async function wczytajSilnik() {
  const firmy = fs
    .readdirSync(path.join(ROOT, 'src', 'firms'))
    .filter((f) => f.endsWith('.js') && !f.startsWith('_') && f !== 'index.js')
    .sort();

  // Wejście omija src/firms/index.js — to jedyny plik z import.meta.glob.
  const wejscie = [
    `export { wycen } from ${JSON.stringify(path.join(ROOT, 'src/engine/wycena.js'))};`,
    ...firmy.map((f, i) => `import f${i} from ${JSON.stringify(path.join(ROOT, 'src/firms', f))};`),
    `export const FIRMY = [${firmy.map((_, i) => `f${i}`).join(', ')}]`,
    `  .filter((f) => f.aktywna !== false)`,
    `  .sort((a, b) => (a.kolejnosc ?? 99) - (b.kolejnosc ?? 99));`,
  ].join('\n');

  const katalog = fs.mkdtempSync(path.join(os.tmpdir(), 'k24-silnik-'));
  const wejsciePlik = path.join(katalog, 'wejscie.mjs');
  const wyjscie = path.join(katalog, 'silnik.mjs');
  fs.writeFileSync(wejsciePlik, wejscie, 'utf8');

  await build({
    entryPoints: [wejsciePlik],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: wyjscie,
    logLevel: 'silent',
  });

  const modul = await import('file:///' + wyjscie.replace(/\\/g, '/'));
  // Paczka jest już w pamięci — katalog tymczasowy nie jest dłużej potrzebny.
  fs.rmSync(katalog, { recursive: true, force: true });
  return modul;
}

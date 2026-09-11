/**
 * ADRES PUBLICZNY FIRMY — jeden i tylko jeden.
 *
 *   node --test scripts/test-adres-publiczny.mjs
 *
 * ⚠ ZASADA WŁAŚCICIELA (12.09.2026, ustalona twardo):
 *
 *   Jedynym publicznym adresem Kamieniarstwa 24h jest
 *   **ul. Szpitalna 8, 39-400 Tarnobrzeg**.
 *   Adresu **Bema 227 NIE WOLNO** publikować nigdzie: ani na stronie,
 *   ani w danych strukturalnych (LocalBusiness), ani w mailach do klienta,
 *   ani w wizytówkach i katalogach NAP.
 *
 * DLACZEGO TO JEST TEST, A NIE NOTATKA. Adres firmy rozłazi się sam: ktoś
 * dopisze go w nowej podstronie miasta, ktoś inny w szablonie maila, a trzeci
 * w schemie — i po pół roku Google widzi dwie lokalizacje jednej firmy.
 * Dla wyszukiwarki niespójny NAP (nazwa-adres-telefon) to sygnał, że firma
 * jest niepewna; przy wizytówce potrafi wręcz zablokować weryfikację.
 * Notatka w dokumentacji tego nie zatrzyma — test zatrzyma, bo wywali build.
 *
 * MINI-LEKCJA: NAP. W lokalnym SEO liczy się, żeby nazwa, adres i telefon
 * były IDENTYCZNE wszędzie — na stronie, w schemie, w wizytówce Google,
 * w katalogach. Google zestawia je ze sobą i im bardziej są zgodne, tym
 * pewniej wiąże je w jedną firmę. Jedna literka różnicy („8" vs „8a")
 * to już dwa różne adresy.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const ADRES_PUBLICZNY = 'ul. Szpitalna 8';
const ZAKAZANY = /Bema\s*227/i;

/**
 * Pliki, które trafiają do klienta: strony, szablony, treści firm, worker.
 * Świadomie POMIJAMY dokumentację (*.md) — tam Bema 227 wolno wymieniać,
 * bo to notatki wewnętrzne o warsztacie, a nie treść dla klienta.
 */
const KATALOGI = ['src', 'worker', 'public', 'scripts/lib'];
const ROZSZERZENIA = new Set(['.html', '.js', '.mjs', '.json', '.txt', '.xml', '.css']);

function plikiPubliczne() {
  const wynik = [];

  // Strony serwisu leżą w korzeniu i w baza-wiedzy/.
  for (const katalog of ['.', 'baza-wiedzy']) {
    const sciezka = path.join(ROOT, katalog);
    if (!fs.existsSync(sciezka)) continue;
    for (const f of fs.readdirSync(sciezka)) {
      if (f.endsWith('.html')) wynik.push(path.join(katalog, f));
    }
  }

  // Szablony, treści firm i worker — rekurencyjnie.
  const obejdz = (wzgledny) => {
    const pelny = path.join(ROOT, wzgledny);
    if (!fs.existsSync(pelny)) return;
    for (const wpis of fs.readdirSync(pelny, { withFileTypes: true })) {
      const dalej = path.join(wzgledny, wpis.name);
      if (wpis.isDirectory()) {
        if (wpis.name === 'node_modules') continue;
        obejdz(dalej);
      } else if (ROZSZERZENIA.has(path.extname(wpis.name))) {
        wynik.push(dalej);
      }
    }
  };
  KATALOGI.forEach(obejdz);

  return wynik;
}

test('nigdzie w treści dla klienta nie ma adresu Bema 227', () => {
  const winne = plikiPubliczne().filter((p) => {
    const tresc = fs.readFileSync(path.join(ROOT, p), 'utf8');
    return ZAKAZANY.test(tresc);
  });

  assert.deepEqual(
    winne,
    [],
    `Adres „Bema 227" wystąpił w treści dla klienta. Publiczny adres firmy to ` +
      `wyłącznie „${ADRES_PUBLICZNY}, 39-400 Tarnobrzeg" — podmień w: ${winne.join(', ')}`
  );
});

test('dane strukturalne podają Szpitalną 8 na każdej stronie z LocalBusiness', () => {
  const strony = plikiPubliczne().filter((p) => p.endsWith('.html'));
  const zeSchema = [];
  const zle = [];

  for (const p of strony) {
    const tresc = fs.readFileSync(path.join(ROOT, p), 'utf8');
    if (!tresc.includes('"streetAddress"')) continue;
    zeSchema.push(p);
    // Wszystkie wystąpienia — jedna strona może mieć kilka węzłów schemy.
    const adresy = [...tresc.matchAll(/"streetAddress"\s*:\s*"([^"]*)"/g)].map((m) => m[1]);
    if (adresy.some((a) => a.trim() !== ADRES_PUBLICZNY)) {
      zle.push(`${p} → ${adresy.join(' | ')}`);
    }
  }

  assert.ok(zeSchema.length > 0, 'Żadna strona nie ma danych strukturalnych z adresem — to podejrzane.');
  assert.deepEqual(zle, [], `streetAddress inny niż „${ADRES_PUBLICZNY}": ${zle.join('; ')}`);
});

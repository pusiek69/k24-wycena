/**
 * /llms.txt — wizytówka strony dla modelów językowych (5.10.2026).
 *
 *   node --test scripts/test-llms.mjs
 *
 * Plik jest STATYCZNY, a strony żyją — miasta dostają nowe adresy, poradniki
 * zmieniają tytuły, oferta bywa przecelowana. Martwy link w llms.txt jest
 * gorszy niż jego brak: model zacytuje adres, który zwraca 404. Stąd ten test.
 *
 * Świadomie NIE ma w nim kwot — ceny „od…" chodzą za cennikami dostawców
 * (30.09.2026 wygasły cztery kampanie naraz i próg spieku skoczył o 1 200 zł),
 * a tego pliku nikt nie przelicza. Aktualne liczby podaje kalkulator.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const czytaj = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const LLMS = czytaj('public/llms.txt');
const ROBOTS = czytaj('public/robots.txt');

const wpisy = [...LLMS.matchAll(/^- \[([^\]]+)\]\(([^)]+)\): (.+)$/gm)].map((m) => ({
  tytul: m[1],
  url: m[2],
  opis: m[3],
}));

test('llms.txt ma nagłówek, opis i rozsądną długość', () => {
  const linie = LLMS.split('\n');
  assert.equal(linie[0], '# Kamieniarstwo 24h (Aaron sp. z o.o.)', 'pierwsza linia to nazwa firmy');
  const opis = linie.find((l) => l.startsWith('> '));
  assert.ok(opis, 'brak linii opisu');
  assert.ok(opis.length - 2 < 200, `opis ma ${opis.length - 2} znaków, limit 200`);
  assert.ok(linie.length >= 50 && linie.length <= 150, `plik ma ${linie.length} linii (50–150)`);
});

test('llms.txt: każdy wpis to [Tytuł](pełny URL) z opisem', () => {
  assert.ok(wpisy.length >= 10 && wpisy.length <= 30, `${wpisy.length} wpisów (ma być 10–30)`);
  for (const w of wpisy) {
    assert.match(w.url, /^https:\/\/kam24h\.pl\//, `${w.tytul}: URL musi być pełny`);
    const slowa = w.opis.split(/\s+/).filter(Boolean).length;
    assert.ok(slowa >= 8 && slowa <= 35, `${w.tytul}: opis ma ${slowa} słów`);
  }
});

test('llms.txt nie prowadzi pod martwe adresy', () => {
  // Czyste adresy bez .html serwuje przekierowanie z netlify.toml,
  // więc szukamy pliku w obu postaciach.
  for (const { tytul, url } of wpisy) {
    const sciezka = url.replace('https://kam24h.pl/', '');
    const kandydaci = sciezka === ''
      ? ['index.html']
      : [`${sciezka}.html`, `${sciezka}index.html`, sciezka];
    assert.ok(
      kandydaci.some((k) => fs.existsSync(path.join(ROOT, k))),
      `${tytul}: ${url} nie ma pliku w repo (szukano: ${kandydaci.join(', ')})`
    );
  }
});

test('llms.txt nie podaje kwot — te starzeją się szybciej niż plik', () => {
  const kwoty = LLMS.match(/\d[\d \u00a0]*z\u0142/g) || [];
  assert.deepEqual(kwoty, [], `w llms.txt są kwoty: ${kwoty.join(', ')}`);
});

test('llms.txt mówi to samo co stopka: Szpitalna 8, bez drugiego adresu', () => {
  assert.match(LLMS, /ul\. Szpitalna 8, 39-400 Tarnobrzeg/);
  assert.ok(!/Bema/i.test(LLMS), 'adres wewnętrzny nie ma prawa trafić do pliku publicznego');
  assert.match(LLMS, /796 991 128/);
});

test('robots.txt wpuszcza crawlery AI — z nazwy', () => {
  /*
   * Własna grupa ZASTĘPUJE reguły z „*", a nie dokłada się do nich — więc
   * każda musi też powtórzyć wyłączenie strony podziękowania.
   */
  for (const bot of ['GPTBot', 'OAI-SearchBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended']) {
    const i = ROBOTS.indexOf(`User-agent: ${bot}\n`);
    assert.ok(i >= 0, `brak grupy dla ${bot}`);
    const grupa = ROBOTS.slice(i).split('\n\n')[0];
    assert.match(grupa, /Allow: \//, `${bot} nie ma Allow`);
    assert.match(grupa, /Disallow: \/dziekujemy/, `${bot}: brak wyłączenia strony podziękowania`);
  }
  assert.ok(!/^Disallow: \/\s*$/m.test(ROBOTS), 'któraś grupa blokuje całą stronę');
});

test('netlify serwuje /llms.txt jako text/plain po polsku', () => {
  const netlify = czytaj('netlify.toml');
  const i = netlify.indexOf('for = "/llms.txt"');
  assert.ok(i >= 0, 'brak nagłówka dla /llms.txt w netlify.toml');
  const blok = netlify.slice(i, i + 200);
  assert.match(blok, /Content-Type = "text\/plain; charset=utf-8"/);
});

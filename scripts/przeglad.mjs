/**
 * PRZEGLĄD ZDROWIA PRODUKCJI (kam24h.pl).
 *
 *   npm run przeglad                  — pełny przegląd
 *   npm run przeglad -- --bez-przegladarki   — same sprawdzenia HTTP
 *   npm run przeglad -- --adres https://…    — inny adres (np. podgląd Netlify)
 *
 * POWÓD POWSTANIA (30.08.2026). Dawid poprosił o sprawdzenie, czy aplikacja
 * nie ma błędów. Wyszło pięć, w tym trzy wprowadzone dzień wcześniej —
 * a wszystkie testy jednostkowe świeciły na zielono. Wspólny mianownik:
 *
 *   • funkcja istniała i miała testy, ale NIKT JEJ NIE WOŁAŁ,
 *   • trasa istniała w routerze, ale jej funkcja zniknęła,
 *   • widok czytał inne pole niż to, którym liczył silnik.
 *
 * Testy jednostkowe takich rzeczy nie łapią z definicji: sprawdzają części,
 * nie ich połączenie. Ten skrypt sprawdza DZIAŁAJĄCĄ PRODUKCJĘ od zewnątrz,
 * tak jak zobaczy ją klient.
 *
 * Uruchamiaj po KAŻDEJ większej zmianie, po wdrożeniu — nie zamiast testów,
 * tylko po nich.
 *
 * Skrypt NIE wysyła zgłoszeń ani maili. Zatrzymuje się na formularzu
 * kontaktowym i sprawdza, że jest kompletny.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (nazwa, domyslnie) => {
  const i = process.argv.indexOf(nazwa);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : domyslnie;
};

const ADRES = arg('--adres', 'https://kam24h.pl').replace(/\/$/, '');
const WORKER = arg('--worker', 'https://k24h.kamieniarstwo24h.workers.dev').replace(/\/$/, '');
const BEZ_PRZEGLADARKI = process.argv.includes('--bez-przegladarki');

/** Zebrane problemy — o nich decyduje kod wyjścia. */
const problemy = [];
const zglos = (co) => problemy.push(co);

const ok = (t) => console.log(`  \x1b[32m✓\x1b[0m ${t}`);
const zle = (t) => console.log(`  \x1b[31m✗\x1b[0m ${t}`);
const tytul = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);

/* ──────────────────────────────────────────────────── narzędzia sieciowe */

/**
 * Jedno żądanie z limitem czasu. Używamy `fetch` z node, bez zależności —
 * przegląd ma dać się uruchomić w świeżo sklonowanym repo.
 */
async function pobierz(url, opcje = {}) {
  const przerwij = AbortSignal.timeout(30_000);
  try {
    const odp = await fetch(url, { redirect: 'manual', signal: przerwij, ...opcje });
    return { status: odp.status, naglowki: odp.headers, tekst: await odp.text() };
  } catch (e) {
    return { status: 0, blad: String(e.message || e), tekst: '' };
  }
}

/** Sprawdza partiami — 200 adresów po kolei trwałoby minutami. */
async function partiami(lista, ile, praca) {
  const wyniki = [];
  for (let i = 0; i < lista.length; i += ile) {
    wyniki.push(...(await Promise.all(lista.slice(i, i + ile).map(praca))));
  }
  return wyniki;
}

/* ─────────────────────────────────────────────── 1. sitemap i przekierowania */

async function sprawdzSitemap() {
  tytul('1. SITEMAP → produkcja');
  const xml = fs.readFileSync(path.join(ROOT, 'public', 'sitemap.xml'), 'utf8');
  const adresy = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

  const wyniki = await partiami(adresy, 8, async (u) => ({
    u,
    ...(await pobierz(u.replace(/^https:\/\/kam24h\.pl/, ADRES))),
  }));
  const zepsute = wyniki.filter((w) => w.status !== 200);
  for (const w of zepsute) zle(`${w.status || w.blad}  ${w.u}`);
  if (zepsute.length) zglos(`sitemap: ${zepsute.length} adresów nie oddaje 200`);
  else ok(`${adresy.length} adresów z sitemapy — wszystkie 200`);
}

/* ────────────────────────────────────────────────── 2. linki wewnętrzne */

async function sprawdzLinki() {
  tytul('2. LINKI WEWNĘTRZNE');
  const dist = path.join(ROOT, 'dist');
  if (!fs.existsSync(dist)) {
    zle('brak katalogu dist — uruchom najpierw `npm run build`');
    zglos('brak dist do sprawdzenia linków');
    return;
  }

  const pliki = [
    ...fs.readdirSync(dist).filter((f) => f.endsWith('.html')).map((f) => path.join(dist, f)),
    ...(fs.existsSync(path.join(dist, 'baza-wiedzy'))
      ? fs
          .readdirSync(path.join(dist, 'baza-wiedzy'))
          .filter((f) => f.endsWith('.html'))
          .map((f) => path.join(dist, 'baza-wiedzy', f))
      : []),
  ];

  const linki = new Set();
  for (const p of pliki) {
    for (const m of fs.readFileSync(p, 'utf8').matchAll(/href="(\/[^"#?]*)"/g)) {
      // Pliki (zdjęcia, pdf) sprawdzamy osobno i wyrywkowo — jest ich 170.
      if (!/\.(png|jpe?g|webp|mp4|xml|txt|ico|pdf|svg)$/i.test(m[1])) linki.add(m[1]);
    }
  }

  const wyniki = await partiami([...linki], 8, async (l) => ({ l, ...(await pobierz(ADRES + l)) }));
  const zepsute = wyniki.filter((w) => w.status !== 200);
  for (const w of zepsute) zle(`${w.status || w.blad}  ${w.l}`);
  if (zepsute.length) zglos(`${zepsute.length} martwych linków wewnętrznych`);
  else ok(`${linki.size} linków wewnętrznych — wszystkie 200`);
}

/* ───────────────────────────────────────────────────────── 3. obrazki */

async function sprawdzObrazki() {
  tytul('3. ZDJĘCIA I GRAFIKI');
  const stale = [
    '/og-k24h.png',
    '/logo-k24h.png',
    '/dawid-zabek.jpg',
    '/realizacje/gbp-logo.png',
    '/realizacje/gbp-okladka.jpg',
  ];

  // Galeria ma ~170 plików — bierzemy co siódmy, żeby przegląd trwał sekundy,
  // a i tak wykryłby wysypanie się całego katalogu.
  const galeria = path.join(ROOT, 'public', 'realizacje');
  const zdjecia = fs.existsSync(galeria)
    ? fs.readdirSync(galeria).filter((f, i) => /\.(jpg|webp)$/i.test(f) && i % 7 === 0).map((f) => `/realizacje/${f}`)
    : [];

  const wyniki = await partiami([...stale, ...zdjecia], 8, async (s) => ({
    s,
    ...(await pobierz(ADRES + s, { method: 'HEAD' })),
  }));
  const zepsute = wyniki.filter((w) => w.status !== 200);
  for (const w of zepsute) zle(`${w.status || w.blad}  ${w.s}`);
  if (zepsute.length) zglos(`${zepsute.length} brakujących grafik`);
  else ok(`${wyniki.length} grafik (stałe + próbka galerii) — wszystkie 200`);
}

/* ──────────────────────────────────────────────────────── 4. worker */

/**
 * Trasy czytamy Z ROUTERA zbudowanego workera, a nie z ręcznej listy.
 *
 * ⚠ 30.08.2026 `/kolekcje` oddawało surowy wyjątek workera, bo funkcja
 * obsługująca zniknęła przy podmianie bloku kodu, a trasa została.
 * Żaden test tego nie łapał, bo żaden nie wołał akurat tej trasy.
 * Lista czytana z routera rośnie sama razem z aplikacją.
 */
function trasyWorkera() {
  const plik = path.join(ROOT, 'worker', 'worker.js');
  if (!fs.existsSync(plik)) return [];
  const zrodlo = fs.readFileSync(plik, 'utf8');
  const dokladne = [...zrodlo.matchAll(/sciezka === '(\/[^']*)'/g)].map((m) => m[1]);
  const prefiksy = [...zrodlo.matchAll(/sciezka\.startsWith\('(\/[^']*)'\)/g)].map((m) => m[1] + '1');
  return [...new Set([...dokladne, ...prefiksy])].filter((t) => !t.startsWith('/panel'));
}

async function sprawdzWorkera() {
  tytul('4. WORKER — wszystkie trasy z routera');
  const trasy = trasyWorkera();
  if (!trasy.length) {
    zle('nie odczytałem tras — czy `npm run worker` się wykonał?');
    zglos('brak worker/worker.js');
    return;
  }

  const naglowki = { 'Content-Type': 'application/json', Origin: 'https://kam24h.pl' };
  let zepsutych = 0;

  for (const trasa of trasy) {
    for (const metoda of ['GET', 'POST']) {
      const odp = await pobierz(WORKER + trasa, {
        method: metoda,
        headers: naglowki,
        body: metoda === 'POST' ? '{}' : undefined,
      });
      /*
       * Status 0 to BRAK ODPOWIEDZI (worker leży, zła nazwa, brak sieci) —
       * inna sprawa niż błąd aplikacji, więc i komunikat inny.
       * 5xx znaczy, że funkcja obsługująca wybuchła albo jej nie ma.
       * 503 bywa ZAMIERZONE (brak konfiguracji usługi), więc go nie liczymy.
       */
      if (odp.status === 0) {
        zle(`${metoda} ${trasa} → brak odpowiedzi (${odp.blad})`);
        zepsutych++;
      } else if (odp.status >= 500 && odp.status !== 503) {
        zle(`${metoda} ${trasa} → ${odp.status}  ${odp.tekst.slice(0, 80)}`);
        zepsutych++;
      }
    }
  }
  if (zepsutych) zglos(`worker: ${zepsutych} tras oddaje błąd serwera`);
  else ok(`${trasy.length} tras × 2 metody — żadna nie wywala workera`);

  // Walidacja zgłoszenia: celowo niepełne dane, ŻADEN mail nie wychodzi.
  const braki = [
    ['bez telefonu', { email: 'a@b.pl', city: 'X' }],
    ['zły e-mail', { phone: '600100200', email: 'zle', city: 'X' }],
    ['bez miejscowości', { phone: '600100200', email: 'a@b.pl' }],
  ];
  for (const [opis, dane] of braki) {
    const odp = await pobierz(WORKER + '/lead', {
      method: 'POST',
      headers: naglowki,
      body: JSON.stringify(dane),
    });
    if (odp.status === 0) {
      zle(`/lead ${opis} → brak odpowiedzi (${odp.blad})`);
      zglos('/lead nie odpowiada');
    } else if (odp.status !== 400) {
      zle(`/lead ${opis} → ${odp.status} (oczekiwane 400)`);
      zglos(`/lead przepuszcza zgłoszenie ${opis}`);
    }
  }
  ok('/lead odrzuca zgłoszenia bez telefonu, e-maila i miejscowości');
}

/* ─────────────────────────────────────────────────────────── 5. panel */

async function sprawdzPanel() {
  tytul('5. PANEL WŁAŚCICIELA (bez hasła)');
  const logowanie = await pobierz(WORKER + '/panel', { headers: { Origin: 'https://kam24h.pl' } });
  if (logowanie.status !== 200) {
    zle(`/panel → ${logowanie.status}`);
    zglos('panel nie pokazuje ekranu logowania');
  } else ok('/panel oddaje ekran logowania');

  // Każdy endpoint panelu MUSI odmówić bez ciasteczka. To jedyna rzecz,
  // która stoi między bazą klientów a internetem.
  const zrodlo = fs.readFileSync(path.join(ROOT, 'worker', 'panel.js'), 'utf8');
  const endpointy = [...zrodlo.matchAll(/sciezka === '(\/panel\/api\/[^']*)'/g)].map((m) => m[1]);
  let przepuszczone = 0;

  for (const e of [...new Set(endpointy)]) {
    for (const metoda of ['GET', 'POST']) {
      const odp = await pobierz(WORKER + e, {
        method: metoda,
        headers: { 'Content-Type': 'application/json', Origin: 'https://kam24h.pl' },
        body: metoda === 'POST' ? '{}' : undefined,
      });
      if (odp.status === 0) {
        // Bez odpowiedzi nie wiemy nic — a już na pewno nie to, że wpuszcza.
        zle(`${metoda} ${e} → brak odpowiedzi (${odp.blad})`);
        przepuszczone++;
      } else if (odp.status !== 401 && odp.status !== 403 && odp.status !== 405) {
        zle(`${metoda} ${e} → ${odp.status} BEZ HASŁA — endpoint panelu stoi otworem`);
        przepuszczone++;
      }
    }
  }
  if (przepuszczone) zglos(`panel: ${przepuszczone} endpointów bez poprawnej odmowy`);
  else ok(`${endpointy.length} endpointów panelu — wszystkie wymagają logowania`);
}

/* ───────────────────────────────────────────────────────────── 6. CORS */

async function sprawdzCors() {
  tytul('6. CORS');
  const obcy = await pobierz(WORKER + '/wyprzedaz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://zlodziej.example' },
    body: '{}',
  });
  const zgoda = obcy.naglowki?.get?.('access-control-allow-origin');
  if (zgoda && zgoda !== 'https://kam24h.pl') {
    zle(`obce źródło dostało zgodę: ${zgoda}`);
    zglos('CORS wpuszcza obce domeny');
  } else ok('obce źródło nie dostaje zgody na odczyt');
}

/* ──────────────────────────────────────────── 7. ścieżki klienta (Playwright) */

/**
 * Część przeglądarkowa siedzi w Pythonie, bo tak podpowiada skill
 * `webapp-testing` i bo nie chcemy dokładać do package.json zależności,
 * która ciągnie za sobą własną przeglądarkę.
 *
 * Gdy Playwrighta nie ma, MÓWIMY o tym wprost i kończymy błędem —
 * cichy przeskok robiłby z przeglądu wydmuszkę.
 */
function sprawdzKlienta() {
  tytul('7. ŚCIEŻKI KLIENTA (Playwright)');

  const ma = spawnSync('python', ['-c', 'import playwright'], { stdio: 'ignore' });
  if (ma.status !== 0) {
    zle('brak Playwrighta — pomijam część przeglądarkową');
    console.log('     zainstaluj:  pip install playwright && python -m playwright install chromium');
    zglos('część przeglądarkowa nie została wykonana');
    return;
  }

  try {
    const wyjscie = execFileSync(
      'python',
      [path.join(ROOT, 'scripts', 'przeglad-klient.py'), '--adres', ADRES],
      { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, timeout: 900_000 }
    );
    console.log(wyjscie.trimEnd());
    if (/\bPROBLEM\b/.test(wyjscie)) zglos('ścieżki klienta: patrz wyżej');
  } catch (e) {
    console.log((e.stdout || '').trimEnd());
    zle(`część przeglądarkowa przerwana: ${String(e.message).slice(0, 160)}`);
    zglos('ścieżki klienta nie przeszły');
  }
}

/* ───────────────────────────────────────────────────────────── przebieg */

console.log(`\x1b[1mPRZEGLĄD ZDROWIA\x1b[0m  ${ADRES}`);
console.log(`worker: ${WORKER}`);

await sprawdzSitemap();
await sprawdzLinki();
await sprawdzObrazki();
await sprawdzWorkera();
await sprawdzPanel();
await sprawdzCors();
if (!BEZ_PRZEGLADARKI) sprawdzKlienta();

console.log('');
if (problemy.length) {
  console.error(`\x1b[31m✗ Przegląd znalazł ${problemy.length} problemów:\x1b[0m`);
  for (const p of problemy) console.error(`  • ${p}`);
  process.exit(1);
}
console.log('\x1b[32m✓ Przegląd czysty — produkcja odpowiada tak, jak powinna.\x1b[0m');

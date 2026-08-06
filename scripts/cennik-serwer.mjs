#!/usr/bin/env node
/**
 * NARZĘDZIE „DODAJ CENNIK"
 *
 * Otwiera lokalną stronę, na której Dawid dodaje albo aktualizuje cennik
 * firmy: wkleja tabelę z PDF-a lub Excela, wpisuje rabat i marżę, widzi
 * podgląd cen końcowych i zapisuje. Reszta dzieje się sama.
 *
 *   npm run cennik:dodaj      (albo dwuklik w start-cennik.cmd)
 *
 * ⚠ To narzędzie działa TYLKO na tym komputerze (adres 127.0.0.1).
 *   Nigdy nie trafia na Netlify — obsługuje rabaty, czyli tajemnicę firmy.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import {
  ZRODLA,
  GENEROWANE,
  zapiszKatalogKlienta,
  rozpoznajCennik,
  naSlug,
  szablonFirmy,
} from './lib/cennik.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STRONA = path.join(ROOT, 'narzedzia', 'cennik.html');
const PORT = Number(process.env.PORT_CENNIK) || 4180;

const serwer = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/?'))) {
      return wyslij(res, 200, 'text/html; charset=utf-8', fs.readFileSync(STRONA));
    }
    if (req.method === 'GET' && req.url === '/api/firmy') {
      return json(res, 200, { firmy: listaFirm() });
    }
    if (req.method === 'POST' && req.url === '/api/podglad') {
      const dane = await czytajJson(req);
      const { katalog, pominiete } = rozpoznajCennik(dane.tekst || '', dane.grubosci || ['20']);
      return json(res, 200, { katalog, pominiete, ile: Object.keys(katalog).length });
    }
    if (req.method === 'POST' && req.url === '/api/zapisz') {
      return json(res, 200, await zapisz(await czytajJson(req)));
    }
    wyslij(res, 404, 'text/plain; charset=utf-8', 'Nie ma takiej strony.');
  } catch (e) {
    json(res, 400, { blad: e?.message || String(e) });
  }
});

serwer.listen(PORT, '127.0.0.1', () => {
  const adres = `http://127.0.0.1:${PORT}`;
  console.log(`\n  Narzędzie „Dodaj cennik" działa: ${adres}`);
  console.log('  Zamknij to okno, gdy skończysz.\n');
  otworzPrzegladarke(adres);
});

/* ------------------------------------------------------------- działania */

function listaFirm() {
  const katalog = path.join(ROOT, GENEROWANE);
  if (!fs.existsSync(katalog)) return [];

  return fs
    .readdirSync(katalog)
    .filter((f) => f.endsWith('.dekory.json'))
    .map((f) => {
      const slug = f.replace('.dekory.json', '');
      const dane = JSON.parse(fs.readFileSync(path.join(katalog, f), 'utf8'));
      const zasadyPlik = path.join(ROOT, ZRODLA, `${slug}.zasady.json`);
      let zasady = null;
      if (fs.existsSync(zasadyPlik)) {
        const z = JSON.parse(fs.readFileSync(zasadyPlik, 'utf8'));
        zasady = {
          rabat: z.rabatZakupowy,
          marza: z.marza,
          juzPrzeliczone: !!z.juzPrzeliczone,
          zrodlo: z.zrodlo || '',
          obowiazujeOd: z.obowiazujeOd || '',
        };
      }
      return { slug, nazwa: dane._firma || slug, dekorow: dane._dekorow || 0, wygenerowano: dane._wygenerowano, zasady };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

async function zapisz(dane) {
  const slug = naSlug(dane.slug || dane.nazwa || '');
  if (!slug) throw new Error('Podaj nazwę firmy.');

  const grubosci = (dane.grubosci || []).map(String).filter(Boolean);
  if (!grubosci.length) throw new Error('Podaj przynajmniej jedną grubość (np. 20).');

  const { katalog, pominiete } = rozpoznajCennik(dane.tekst || '', grubosci);
  if (!Object.keys(katalog).length) {
    throw new Error('Nie rozpoznałem ani jednego dekoru. Sprawdź, czy w każdej linii jest nazwa i cena.');
  }

  const juzPrzeliczone = !!dane.juzPrzeliczone;
  const zasady = {
    firma: slug,
    nazwa: dane.nazwa || slug,
    zrodlo: dane.zrodlo || 'wklejone narzędziem „Dodaj cennik"',
    obowiazujeOd: dane.obowiazujeOd || new Date().toISOString().slice(0, 10),
    jednostka: 'netto za 1 m2 plyty',
    juzPrzeliczone,
    rabatZakupowy: juzPrzeliczone ? null : Number(dane.rabat) / 100,
    marza: juzPrzeliczone ? null : Number(dane.marza) / 100,
    notatka: dane.notatka || '',
    katalog,
  };

  // 1. zasady handlowe — poza gitem
  const plikZasad = path.join(ROOT, ZRODLA, `${slug}.zasady.json`);
  fs.mkdirSync(path.dirname(plikZasad), { recursive: true });
  fs.writeFileSync(plikZasad, JSON.stringify(zasady, null, 2) + '\n', 'utf8');

  // 2. ceny końcowe dla przeglądarki
  const { ile, mnoznik } = zapiszKatalogKlienta(ROOT, slug, zasady);

  // 3. plik firmy — tylko gdy jej jeszcze nie ma
  const plikFirmy = path.join(ROOT, 'src', 'firms', `${slug}.js`);
  const nowaFirma = !fs.existsSync(plikFirmy);
  if (nowaFirma) {
    fs.writeFileSync(
      plikFirmy,
      szablonFirmy({
        slug,
        nazwa: dane.nazwa || slug,
        typ: dane.typ || 'konglomerat kwarcowy',
        krotki: dane.krotki || 'Nowa kolekcja w ofercie.',
        opis: dane.opis || dane.krotki || 'Kolekcja dostępna na zamówienie.',
        linkDekory: dane.linkDekory || 'https://k24h.pl',
        plytaW: Number(dane.plytaW) || 320,
        plytaH: Number(dane.plytaH) || 160,
        polowki: dane.polowki !== false,
        kolejnosc: Number(dane.kolejnosc) || 50,
      }),
      'utf8'
    );
  }

  return {
    ok: true,
    slug,
    ile,
    mnoznik: Number(mnoznik.toFixed(4)),
    pominiete,
    nowaFirma,
    przykład: przykladCeny(katalog, grubosci[0], mnoznik),
  };
}

function przykladCeny(katalog, grubosc, mnoznik) {
  const [nazwa, ceny] = Object.entries(katalog)[0] || [];
  if (!nazwa) return null;
  const katalogowa = ceny[grubosc] ?? Object.values(ceny)[0];
  const koncowa = Math.round(katalogowa * mnoznik);
  return { nazwa, katalogowa, koncowa, brutto: Math.round(koncowa * 1.23) };
}

/* ------------------------------------------------------------ pomocnicze */

function czytajJson(req) {
  return new Promise((ok, nie) => {
    let dane = '';
    req.on('data', (c) => {
      dane += c;
      if (dane.length > 5_000_000) nie(new Error('Za duży cennik (max 5 MB).'));
    });
    req.on('end', () => {
      try {
        ok(JSON.parse(dane || '{}'));
      } catch {
        nie(new Error('Niepoprawne dane.'));
      }
    });
  });
}

function json(res, status, dane) {
  wyslij(res, status, 'application/json; charset=utf-8', JSON.stringify(dane));
}

function wyslij(res, status, typ, tresc) {
  res.writeHead(status, { 'content-type': typ, 'cache-control': 'no-store' });
  res.end(tresc);
}

function otworzPrzegladarke(adres) {
  const [cmd, args] =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '', adres]]
      : process.platform === 'darwin'
        ? ['open', [adres]]
        : ['xdg-open', [adres]];
  execFile(cmd, args, () => {});
}

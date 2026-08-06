#!/usr/bin/env node
/**
 * GENERATOR CEN DLA KLIENTA
 *
 *   pricing/zrodla/<firma>.zasady.json   (TAJNE — poza gitem, poza buildem)
 *        │  ceny katalogowe + rabat zakupowy Dawida + marża
 *        ▼
 *   src/generated/<firma>.dekory.json    (jawne — trafia do przeglądarki)
 *        │  WYŁĄCZNIE gotowe ceny końcowe netto/m² dla klienta
 *        ▼
 *   src/firms/<firma>.js  → import
 *
 * Dzięki temu w bundlu klienta NIE MA cen zakupowych ani rabatów —
 * z ceny końcowej nie da się odtworzyć, ile Dawid płaci dostawcy.
 *
 * Użycie:
 *   npm run cennik           — przelicz wszystkie firmy
 *   npm run cennik:sprawdz   — tylko raport (nic nie zapisuje)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ZRODLA = path.join(ROOT, 'pricing', 'zrodla');
const CEL = path.join(ROOT, 'src', 'generated');

const tylkoSprawdz = process.argv.includes('--sprawdz');

if (!fs.existsSync(ZRODLA)) {
  console.error(`✗ Brak katalogu ${ZRODLA}`);
  process.exit(1);
}
fs.mkdirSync(CEL, { recursive: true });

const pliki = fs.readdirSync(ZRODLA).filter((f) => f.endsWith('.zasady.json') && !f.startsWith('_'));

if (!pliki.length) {
  console.log('Brak plików źródłowych w pricing/zrodla/ — nic do przeliczenia.');
  console.log('(To normalne na Netlify: build używa gotowych src/generated/*.dekory.json)');
  process.exit(0);
}

let bledy = 0;

for (const plik of pliki) {
  const slug = plik.replace('.zasady.json', '');
  let z;
  try {
    z = JSON.parse(fs.readFileSync(path.join(ZRODLA, plik), 'utf8'));
  } catch (e) {
    console.error(`✗ ${plik}: niepoprawny JSON — ${e.message}`);
    bledy++;
    continue;
  }

  const mnoznik = policzMnoznik(z, slug);
  if (mnoznik === null) {
    bledy++;
    continue;
  }

  const dekory = {};
  let ile = 0;
  for (const [dekor, grubosci] of Object.entries(z.katalog || {})) {
    const wpis = {};
    for (const [gr, cena] of Object.entries(grubosci)) {
      if (cena == null) continue;
      if (typeof cena !== 'number' || !(cena > 0)) {
        console.error(`✗ ${slug}: dekor „${dekor}" gr. ${gr} — cena nie jest liczbą (${cena})`);
        bledy++;
        continue;
      }
      // Cena końcowa NETTO/m² dla klienta. VAT dolicza aplikacja.
      wpis[gr] = Math.round(cena * mnoznik);
    }
    if (Object.keys(wpis).length) {
      dekory[dekor] = wpis;
      ile++;
    }
  }

  const wynik = {
    _info: [
      'PLIK GENEROWANY AUTOMATYCZNIE — nie edytuj ręcznie.',
      'Źródło: pricing/zrodla/' + plik + ' (poza gitem). Przelicz: npm run cennik',
      'Zawartość: cena KOŃCOWA NETTO za 1 m² płyty dla klienta (VAT dolicza aplikacja).',
      'Nie ma tu cen zakupowych ani rabatów.',
    ].join(' '),
    _firma: slug,
    _wygenerowano: new Date().toISOString().slice(0, 10),
    _dekorow: ile,
    dekory,
  };

  const sciezka = path.join(CEL, `${slug}.dekory.json`);
  const tresc = JSON.stringify(wynik, null, 2) + '\n';
  const stara = fs.existsSync(sciezka) ? fs.readFileSync(sciezka, 'utf8') : '';
  const zmiana = pomijDate(stara) !== pomijDate(tresc);

  if (tylkoSprawdz) {
    console.log(
      `${zmiana ? '≠' : '='} ${slug.padEnd(14)} ${String(ile).padStart(3)} dekorów  ` +
        `mnożnik ×${mnoznik.toFixed(4)}  ${zmiana ? '→ WYMAGA `npm run cennik`' : 'aktualny'}`
    );
  } else {
    fs.writeFileSync(sciezka, tresc, 'utf8');
    console.log(`✓ ${slug.padEnd(14)} ${String(ile).padStart(3)} dekorów  mnożnik ×${mnoznik.toFixed(4)}`);
  }

  if (z.notatka && /TODO|BRAK|POTWIERDZ/i.test(z.notatka)) {
    console.log(`  ⚠ ${slug}: ${z.notatka}`);
  }
}

/* ─────────────────────────────────────────────────────── kampanie promocyjne
 * pricing/zrodla/<firma>.promocje.json  (ceny ZAKUPU + mnożnik)
 *      ▼
 * src/generated/<firma>.promocje.json   (tylko ceny końcowe dla klienta)
 *
 * Wpis dla klienta to albo sama cena, albo obiekt z dodatkami kampanii:
 * innym formatem płyty i informacją, że mat jest w cenie polerowanego.
 */
const plikiPromo = fs.readdirSync(ZRODLA).filter((f) => f.endsWith('.promocje.json') && !f.startsWith('_'));

for (const plik of plikiPromo) {
  const slug = plik.replace('.promocje.json', '');
  let z;
  try {
    z = JSON.parse(fs.readFileSync(path.join(ZRODLA, plik), 'utf8'));
  } catch (e) {
    console.error(`✗ ${plik}: niepoprawny JSON — ${e.message}`);
    bledy++;
    continue;
  }

  const formaty = z.formatyPlyt || {};
  const kampanie = [];

  for (const k of z.kampanie || []) {
    const mnoznik = k.juzPrzeliczone ? 1 : k.mnoznik;
    if (typeof mnoznik !== 'number' || !(mnoznik > 0)) {
      console.error(`✗ ${plik}: kampania „${k.nazwa}" — brak poprawnego "mnoznik"`);
      bledy++;
      continue;
    }

    const ceny = {};
    for (const p of k.pozycje || []) {
      if (!(p.zakup > 0)) {
        console.error(`✗ ${plik}: „${p.dekor}" — cena musi być liczbą > 0`);
        bledy++;
        continue;
      }
      const cena = Math.round(p.zakup * mnoznik);
      const dodatki = {};
      if (p.plyta) {
        const format = formaty[p.plyta];
        if (!format) {
          console.error(`✗ ${plik}: „${p.dekor}" — nieznany format płyty „${p.plyta}"`);
          bledy++;
          continue;
        }
        dodatki.plyta = format;
      }
      if (p.matWCenie) dodatki.matWCenie = true;

      ceny[`${p.dekor}||${p.grubosc}`] = Object.keys(dodatki).length ? { cena, ...dodatki } : cena;
    }

    kampanie.push({ nazwa: k.nazwa, od: k.od, do: k.do, ceny });
  }

  const wynik = {
    _info:
      'PLIK GENEROWANY AUTOMATYCZNIE — nie edytuj ręcznie. ' +
      'Kampanie promocyjne: ceny KOŃCOWE netto/m² dla klienta. ' +
      'Silnik sprawdza wszystkie aktywne naraz. Nie ma tu cen zakupowych.',
    kampanie,
  };

  const sciezka = path.join(CEL, `${slug}.promocje.json`);
  const tresc = JSON.stringify(wynik, null, 2) + '\n';

  if (tylkoSprawdz) {
    const stara = fs.existsSync(sciezka) ? fs.readFileSync(sciezka, 'utf8') : '';
    console.log(`${stara === tresc ? '=' : '≠'} ${slug.padEnd(14)} ${kampanie.length} kampanii promocyjnych`);
  } else {
    fs.writeFileSync(sciezka, tresc, 'utf8');
    const aktywne = kampanie.filter((k) => {
      const d = new Date().toISOString().slice(0, 10);
      return d >= k.od && d <= k.do;
    });
    console.log(
      `✓ ${slug.padEnd(14)} ${kampanie.length} kampanii promocyjnych ` +
        `(aktywnych dziś: ${aktywne.length}, pozycji: ${kampanie.reduce((a, k) => a + Object.keys(k.ceny).length, 0)})`
    );
  }
}

if (bledy) {
  console.error(`\n✗ Zakończono z ${bledy} błędem/błędami.`);
  process.exit(1);
}
console.log('\nGotowe. Pliki dla klienta: src/generated/*.dekory.json, *.promocje.json');

/**
 * Mnożnik: cena katalogowa netto → cena końcowa netto dla klienta.
 *   juzPrzeliczone=true → katalog zawiera już ceny końcowe (×1)
 *   inaczej             → (1 − rabatZakupowy) × (1 + marza)
 * Opcjonalnie `mnoznikRecznie` nadpisuje wszystko.
 */
function policzMnoznik(z, slug) {
  // Cenniki w euro (Marazzi) — na końcu przeliczamy po kursie z zasad.
  // Kurs jest jawnie w pliku, żeby po zmianie wystarczyło `npm run cennik`.
  let kurs = 1;
  if (z.waluta && z.waluta !== 'PLN') {
    if (z.waluta !== 'EUR') {
      console.error(`✗ ${slug}: obsługujemy tylko PLN i EUR, jest „${z.waluta}"`);
      return null;
    }
    if (typeof z.kursEurPln !== 'number' || !(z.kursEurPln > 0)) {
      console.error(`✗ ${slug}: cennik w EUR wymaga pola "kursEurPln" (liczba > 0)`);
      return null;
    }
    kurs = z.kursEurPln;
  }

  const bazowy = policzMnoznikPln(z, slug);
  return bazowy === null ? null : bazowy * kurs;
}

function policzMnoznikPln(z, slug) {
  if (typeof z.mnoznikRecznie === 'number') return z.mnoznikRecznie;
  if (z.juzPrzeliczone) return 1;
  const rabat = z.rabatZakupowy;
  const marza = z.marza;
  if (typeof rabat !== 'number' || typeof marza !== 'number') {
    console.error(
      `✗ ${slug}: brak rabatZakupowy/marza (a juzPrzeliczone=false). ` +
        'Uzupełnij zasady albo ustaw "juzPrzeliczone": true.'
    );
    return null;
  }
  if (rabat < 0 || rabat >= 1) {
    console.error(`✗ ${slug}: rabatZakupowy musi być ułamkiem 0–1 (np. 0.25 = 25%), jest ${rabat}`);
    return null;
  }
  return (1 - rabat) * (1 + marza);
}

function pomijDate(s) {
  return s.replace(/"_wygenerowano":\s*"[^"]*"/, '');
}

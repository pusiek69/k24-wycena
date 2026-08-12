#!/usr/bin/env node
/**
 * GALERIA REALIZACJI — przygotowanie zdjęć do publikacji.
 *
 *   node scripts/galeria.mjs           → przetwarza zdjęcia do public/realizacje/
 *   node scripts/galeria.mjs --sprawdz → tylko raport, nic nie zapisuje
 *
 * Źródłem są grafiki reklamowe Dawida z pulpitu (folder „Reklama na facebook").
 * Każda z nich to złożenie: zdjęcie zamontowanego blatu + zdjęcie płyty
 * w magazynie + podpis z nazwą kamienia i kontaktem. Do galerii biorą się
 * TYLKO pozycje wypisane niżej w KATALOGU — ręcznie obejrzane, jedna sztuka
 * na realizację, bez artefaktów.
 *
 * Czego świadomie NIE bierzemy (sprawdzone zdjęcie po zdjęciu):
 *   • kadry z widocznym szablonem podpisu („STONE_LABEL:", nawiasy
 *     kwadratowe, „Dane kontaktowe:") — na stronie firmy wygląda to
 *     jak niedokończona robota,
 *   • kadry z dużą pustą białą plamą po nieudanym złożeniu kolażu,
 *   • kadr z przypadkową osobą w tle (bez twarzy, ale i tak niepotrzebna),
 *   • powtórki tej samej realizacji w innym układzie.
 *
 * Zdjęcia źródłowe zostają na pulpicie — do repozytorium trafiają wyłącznie
 * wersje przeskalowane i skompresowane.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { wysokoscPodpisu } from './lib/podpis.mjs';

const RECZNIE = JSON.parse(
  fs.readFileSync(path.resolve(import.meta.dirname, 'lib', 'podpisy-recznie.json'), 'utf8')
);

const ZRODLO = 'C:/Users/kamie/Desktop/Reklama na facebook';
const PODFOLDERY = ['Kuhcnia', 'Rzut 2', 'Zdjecia kuchnia 4 3'];
const CEL = path.resolve(import.meta.dirname, '..', 'public', 'realizacje');
const MANIFEST = path.resolve(import.meta.dirname, '..', 'src', 'generated', 'realizacje.json');

const SZEROKOSC_DUZA = 1600;
const SZEROKOSC_MINI = 800;
const JAKOSC_WEBP = 80;
const JAKOSC_JPG = 78;

/**
 * KATALOG REALIZACJI.
 *
 * `hash` to skrót MD5 pliku źródłowego (10 znaków) — nazwy plików Dawida
 * bywają przypadkowe i się powtarzają, a skrót jednoznacznie wskazuje
 * konkretne zdjęcie i przetrwa przeniesienie czy zmianę nazwy.
 *
 * `material` musi zgadzać się z podpisem wypalonym w grafice — inaczej
 * podpis na stronie kłóciłby się z tym, co widać na zdjęciu.
 */
const KATALOG = [
  { hash: '97e6f6d4f1', slug: 'granit-belvedere', material: 'Granit Belvedere', rodzaj: 'granit', opis: 'Kuchnia z wyspą — blat i front wyspy z ciemnego granitu o wyrazistym rysunku.' },
  { hash: '15bdf5cb72', slug: 'granit-ciemny-wyspa', material: 'Granit ciemny, polerowany', rodzaj: 'granit', opis: 'Wyspa kuchenna z blatem opuszczonym po bokach do podłogi.' },
  { hash: 'd191341950', slug: 'granit-black-forest-drewno', material: 'Granit Black Forest', rodzaj: 'granit', opis: 'Blat w kuchni z drewnianymi frontami — półwysep z podciętym narożnikiem.' },
  { hash: 'd34f4bbcde', slug: 'granit-black-forest-jasna', material: 'Granit Black Forest', rodzaj: 'granit', opis: 'Ciemny blat z pasującą płytą przyścienną w jasnej kuchni.' },
  { hash: '03039f9224', slug: 'granit-havana-blue', material: 'Granit Havana Blue', rodzaj: 'granit', opis: 'Blat z wycięciem pod zlew podblatowy i płytą przyścienną z tego samego kamienia.' },
  { hash: '1fe3c726aa', slug: 'granit-ivory', material: 'Granit Ivory', rodzaj: 'granit', opis: 'Ciepły, kremowy blat w kuchni z drewnianymi frontami.' },
  { hash: 'dbe17b7b58', slug: 'granit-star-galaxy', material: 'Granit Star Galaxy', rodzaj: 'granit', opis: 'Czarny blat ze złotymi drobinami — klasyk do ciemnych zabudów.' },
  { hash: '5efc21d079', slug: 'granit-star-galaxy-polwysep', material: 'Granit Star Galaxy', rodzaj: 'granit', opis: 'Półwysep z czarnego granitu w białej kuchni.' },
  { hash: 'aeaaf8962f', slug: 'granit-andora-white', material: 'Granit Andora White', rodzaj: 'granit', opis: 'Jasny blat z płytą przyścienną w kuchni w kształcie litery U.' },
  { hash: '63d8b53ed7', slug: 'granit-bianco-delicatus', material: 'Granit Bianco Delicatus', rodzaj: 'granit', opis: 'Jasny blat i pełna płyta przyścienna sięgająca szafek górnych.' },
  { hash: '88d62bca28', slug: 'granit-delicatus-wyspa', material: 'Granit Delicatus', rodzaj: 'granit', opis: 'Wyspa z blatem opuszczonym do podłogi, w komplecie z zabudową ścienną.' },
  { hash: '2dc6c5bf0f', slug: 'granit-kaspian-white', material: 'Granit Kaspian White', rodzaj: 'granit', opis: 'Blat z płytą przyścienną i przedłużeniem pod barek.' },
  { hash: '6298f0c32e', slug: 'granit-perfect-white', material: 'Granit Perfect White', rodzaj: 'granit', opis: 'Jasny blat w ciemnej zabudowie — kuchnia z widokiem na ogród.' },
  { hash: '3eca0f5210', slug: 'granit-copacabana', material: 'Granit Copacabana', rodzaj: 'granit', opis: 'Czarny blat z białymi żyłami i pasującą płytą przyścienną.' },
  { hash: '2cc3fcadf7', slug: 'granit-prada-gold', material: 'Granit Prada Gold', rodzaj: 'granit', opis: 'Ciepły, żyłkowany kamień na blacie i ścianie nad blatem.' },
  { hash: '3a753b2eca', slug: 'granit-eclipse-leather', material: 'Granit Eclipse, wykończenie leather', rodzaj: 'granit', opis: 'Matowy, satynowy w dotyku blat z wykończeniem leather.' },
  { hash: 'f05e98af9c', slug: 'granit-nero-zimbabwe-antico', material: 'Granit Nero Zimbabwe, wykończenie antico', rodzaj: 'granit', opis: 'Czarny blat w wykończeniu antico — matowy, lekko strukturalny.' },
  { hash: '3abbdce3a5', slug: 'granit-bianco-perfetto', material: 'Granit Bianco Perfetto', rodzaj: 'granit', opis: 'Jasny blat wyspy z bokiem opuszczonym do podłogi.' },
  { hash: '480903acfb', slug: 'granit-alpinus', material: 'Granit Alpinus', rodzaj: 'granit', opis: 'Wyrazisty, plamisty kamień na blacie i płycie przyściennej.' },
  { hash: 'e710e20195', slug: 'granit-millenium-cream', material: 'Granit Millenium Cream', rodzaj: 'granit', opis: 'Kremowy blat wyspy z bokiem opuszczonym do podłogi.' },
  { hash: '947356bfe8', slug: 'granit-imperial-gold', material: 'Granit Imperial Gold', rodzaj: 'granit', opis: 'Złocisty kamień na blacie i wysokiej płycie przyściennej.' },
  { hash: 'ccc141f030', slug: 'granit-colonial-cream', material: 'Granit Colonial Cream', rodzaj: 'granit', opis: 'Jasny blat w kuchni w kształcie litery U, z wycięciem pod zlew.' },
  { hash: 'b797cf74f0', slug: 'granit-brown-silk', material: 'Granit Brown Silk', rodzaj: 'granit', opis: 'Brązowy blat z opuszczonym bokiem i płytą przyścienną.' },
  { hash: '78c38d752b', slug: 'granit-brown-silk-wyspa', material: 'Granit Brown Silk', rodzaj: 'granit', opis: 'Wyspa z brązowego granitu w kuchni z drewnianą zabudową.' },

  { hash: 'bc19994b7c', slug: 'kwarcyt-patagonia', material: 'Kwarcyt naturalny Patagonia', rodzaj: 'kwarcyt', opis: 'Kwarcyt o mocnym, malarskim rysunku na blacie i płycie przyściennej.' },
  { hash: '59e2714d16', slug: 'kwarcyt-patagonia-narozna', material: 'Kwarcyt naturalny Patagonia', rodzaj: 'kwarcyt', opis: 'Blat narożny z pełną płytą przyścienną z tego samego bloku.' },
  { hash: 'c70e4cf608', slug: 'kwarcyt-midnight-crystal', material: 'Kwarcyt naturalny Midnight Crystal', rodzaj: 'kwarcyt', opis: 'Ciemny kwarcyt z różowo-białymi żyłami, blat z płytą przyścienną.' },
  { hash: 'bf62fed8dc', slug: 'kwarcyt-monte-carlo', material: 'Kwarcyt naturalny Monte Carlo', rodzaj: 'kwarcyt', opis: 'Jasny kwarcyt na blacie i pełnej zabudowie ściany nad blatem.' },
  { hash: '30f1e4985a', slug: 'kwarcyt-taj-mahal-antico', material: 'Kwarcyt naturalny Taj Mahal, wykończenie antico', rodzaj: 'kwarcyt', opis: 'Wyspa z kwarcytu w wykończeniu antico — matowym, lekko falistym w dotyku.' },
  { hash: 'babca4bdbe', slug: 'kwarcyt-taj-mahal-poler', material: 'Kwarcyt naturalny Taj Mahal, polerowany', rodzaj: 'kwarcyt', opis: 'Polerowany blat z kwarcytu z pełną płytą przyścienną.' },
  { hash: '20e7052f7c', slug: 'kwarcyt-taj-mahal-u', material: 'Kwarcyt naturalny Taj Mahal, polerowany', rodzaj: 'kwarcyt', opis: 'Kuchnia w kształcie litery U — blat i płyta przyścienna z jednego kamienia.' },
  { hash: 'ebbf9c8c3b', slug: 'kwarcyt-bianco-supreme', material: 'Kwarcyt naturalny Bianco Supreme', rodzaj: 'kwarcyt', opis: 'Jasny kwarcyt o delikatnym rysunku — blat wyspy i zabudowa ścienna.' },
  { hash: 'c72c666030', slug: 'kwarcyt-gabana', material: 'Kwarcyt naturalny Gabana', rodzaj: 'kwarcyt', opis: 'Ciepły, żyłkowany kwarcyt w kuchni z drewnianą zabudową.' },
  { hash: '633d5c0816', slug: 'kwarcyt-da-vinci', material: 'Kwarcyt naturalny Da Vinci', rodzaj: 'kwarcyt', opis: 'Zielony kwarcyt na blacie i płycie przyściennej — rzadki, wyrazisty wybór.' },

  { hash: 'a7b68dfb58', slug: 'konglomerat-avant-chantilly', material: 'Konglomerat kwarcowy Avant Chantilly', rodzaj: 'konglomerat', opis: 'Piaskowy, drobno cętkowany blat z płytą przyścienną.' },
  { hash: 'e49c5eced9', slug: 'konglomerat-avant-calacatta-evo', material: 'Konglomerat kwarcowy Avant Calacatta Evo', rodzaj: 'konglomerat', opis: 'Blat i wysoka zabudowa ściany w kuchni z drewnianymi frontami.' },
  { hash: '9121184544', slug: 'konglomerat-bianco-carrara', material: 'Konglomerat kwarcowy Bianco Carrara', rodzaj: 'konglomerat', opis: 'Biały blat z podciętym narożnikiem w kuchni w kształcie litery L.' },
  { hash: '262a233c0e', slug: 'konglomerat-almond-milk', material: 'Konglomerat kwarcowy Almond Milk', rodzaj: 'konglomerat', opis: 'Jasny blat z wycięciem pod zlew, w kuchni z drewnianymi frontami.' },
  { hash: 'ed5b8154d3', slug: 'konglomerat-lincoln-white', material: 'Konglomerat kwarcowy InterQ Lincoln White', rodzaj: 'konglomerat', opis: 'Biała wyspa z blatem opuszczonym do podłogi.' },
  { hash: '6fdb966c43', slug: 'konglomerat-taj-amelie', material: 'Konglomerat kwarcowy Taj Amelie', rodzaj: 'konglomerat', opis: 'Blat o rysunku przypominającym kwarcyt, w kuchni z drewnem.' },
  { hash: '501b1e3b07', slug: 'konglomerat-calacatta-aveyron', material: 'Konglomerat kwarcowy Calacatta Aveyron', rodzaj: 'konglomerat', opis: 'Biały blat z szarym żyłowaniem i pasującą płytą przyścienną.' },
  { hash: 'ad0a8725d7', slug: 'konglomerat-calacatta-viviez', material: 'Konglomerat kwarcowy Calacatta Viviez', rodzaj: 'konglomerat', opis: 'Wyspa z blatem o wyrazistym żyłowaniu, bok opuszczony do podłogi.' },
  { hash: '947512c0ef', slug: 'konglomerat-blave', material: 'Konglomerat kwarcowy Blave', rodzaj: 'konglomerat', opis: 'Gładki, jasny blat wzdłuż całej ściany kuchni.' },
];

/* ─────────────────────────────────────────────────────────── indeks źródeł */

function indeksZrodel() {
  const wg = new Map();
  for (const d of PODFOLDERY) {
    const kat = path.join(ZRODLO, d);
    if (!fs.existsSync(kat)) continue;
    for (const f of fs.readdirSync(kat)) {
      if (!/\.(png|jpe?g)$/i.test(f)) continue;
      const p = path.join(kat, f);
      const h = crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex').slice(0, 10);
      if (!wg.has(h)) wg.set(h, p);
    }
  }
  return wg;
}

/* ──────────────────────────────────────────────────────────────── przebieg */

const tylkoSprawdz = process.argv.includes('--sprawdz');
const zrodla = indeksZrodel();

const brakujace = KATALOG.filter((k) => !zrodla.has(k.hash));
if (brakujace.length) {
  console.error('✗ Nie znalazłem zdjęć źródłowych:', brakujace.map((k) => k.slug).join(', '));
  process.exit(1);
}

const slugi = new Set();
for (const k of KATALOG) {
  if (slugi.has(k.slug)) {
    console.error(`✗ Powtórzony slug: ${k.slug}`);
    process.exit(1);
  }
  slugi.add(k.slug);
}

if (tylkoSprawdz) {
  console.log(`✓ ${KATALOG.length} pozycji, wszystkie źródła na miejscu.`);
  process.exit(0);
}

fs.mkdirSync(CEL, { recursive: true });
fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });

const wynik = [];
const pominiete = []; // podpis obok kadru — nie da sie odciac
const reczne = [];    // wysokosc ustawiona recznie po obejrzeniu
let bajtyPrzed = 0;
let bajtyPo = 0;

for (const k of KATALOG) {
  const zrodlo = zrodla.get(k.hash);
  bajtyPrzed += fs.statSync(zrodlo).size;

  const obraz = sharp(zrodlo).rotate(); // rotate() bez argumentu = wg EXIF
  const meta = await obraz.metadata();

  /*
   * MINIATURA BEZ WYPALONEGO PODPISU
   *
   * Duża wersja (lightbox) zostaje nietknięta — podpis z nazwą kamienia
   * i kontaktem dokumentuje realizację i jest znakiem Dawida. Ale w siatce
   * kafelków ucięty w połowie napis wyglądał jak błąd, więc miniaturę
   * kadrujemy nad paskiem. Tniemy z ORYGINAŁU, nie z gotowej miniatury.
   *
   * Wysokość paska mierzy scripts/lib/podpis.mjs, a wyjątki — zdjęcia,
   * gdzie podpis stoi OBOK kadru w kolażu i nie da się go odciąć bez
   * zabrania płyty — są wypisane w podpisy-recznie.json.
   */
  let pasPodpisu = 0;
  if (RECZNIE.bezCiecia[k.slug]) {
    pominiete.push({ slug: k.slug, powod: RECZNIE.bezCiecia[k.slug] });
  } else if (RECZNIE.korekty[k.slug]) {
    pasPodpisu = Math.round(meta.height * RECZNIE.korekty[k.slug]);
    reczne.push(k.slug);
  } else {
    pasPodpisu = await wysokoscPodpisu(() => sharp(zrodlo).rotate());
  }
  // Bezpiecznik: nigdy nie zabieramy więcej niż jednej trzeciej kadru.
  pasPodpisu = Math.min(pasPodpisu, Math.floor(meta.height / 3));

  const warianty = [];
  for (const [przyrostek, szer] of [['', SZEROKOSC_DUZA], ['-mini', SZEROKOSC_MINI]]) {
    const przyciete =
      przyrostek === '-mini' && pasPodpisu > 0
        ? sharp(zrodlo)
            .rotate()
            .extract({ left: 0, top: 0, width: meta.width, height: meta.height - pasPodpisu })
        : sharp(zrodlo).rotate();
    const baza = przyciete.resize({ width: szer, withoutEnlargement: true });
    const webp = path.join(CEL, `${k.slug}${przyrostek}.webp`);
    const jpg = path.join(CEL, `${k.slug}${przyrostek}.jpg`);
    await baza.clone().webp({ quality: JAKOSC_WEBP }).toFile(webp);
    await baza.clone().jpeg({ quality: JAKOSC_JPG, mozjpeg: true }).toFile(jpg);
    bajtyPo += fs.statSync(webp).size + fs.statSync(jpg).size;
    warianty.push({ szer, webp, jpg });
  }

  // Proporcje bierzemy z faktycznie zapisanych plików — bez tego przeglądarka
  // przy ładowaniu przeskakiwałaby układem (CLS liczy się w Core Web Vitals).
  // Miniatura bywa mniejsza niż zamawiane 800 px, gdy oryginał był węższy,
  // dlatego mierzymy ją osobno zamiast przeliczać z dużej.
  const mDuza = await sharp(warianty[0].webp).metadata();
  const mMini = await sharp(warianty[1].webp).metadata();

  wynik.push({
    slug: k.slug,
    material: k.material,
    rodzaj: k.rodzaj,
    opis: k.opis,
    w: mDuza.width,
    h: mDuza.height,
    miniW: mMini.width,
    miniH: mMini.height,
    zrodloW: meta.width,
    zrodloH: meta.height,
    pasPodpisu,
  });

  console.log(
    `  ${k.slug.padEnd(36)} ${meta.width}×${meta.height} → ${mDuza.width}×${mDuza.height}` +
      (pasPodpisu ? `  (podpis −${pasPodpisu} px)` : '')
  );
}

console.log(`
── PODSUMOWANIE PODPISOW ─────────────────────────────`);
console.log(`  przyciete automatycznie : ${wynik.filter((r) => r.pasPodpisu).length - reczne.length}`);
console.log(`  przyciete recznie       : ${reczne.length}${reczne.length ? ' (' + reczne.join(', ') + ')' : ''}`);
console.log(`  zostawione z podpisem   : ${pominiete.length}`);
for (const p of pominiete) console.log(`      ${p.slug.padEnd(32)} ${p.powod}`);
console.log(`  bez wykrytego podpisu   : ${wynik.filter((r) => !r.pasPodpisu).length - pominiete.length}`);

fs.writeFileSync(MANIFEST, JSON.stringify(wynik, null, 2) + '\n', 'utf8');

/* ───────────────────────────────────────────────── strona /realizacje */

const GRUPY = [
  {
    id: 'granit',
    tytul: 'Blaty z granitu',
    wstep:
      'Granit to najtwardszy z kamieni, po które sięgamy na blat kuchenny — odporny na zarysowania ' +
      'i wysoką temperaturę. Każda płyta ma własny rysunek, więc poniższe realizacje są ' +
      'niepowtarzalne: tego samego wzoru nie da się odtworzyć jeden do jednego.',
  },
  {
    id: 'kwarcyt',
    tytul: 'Blaty z kwarcytu',
    wstep:
      'Kwarcyt łączy twardość granitu z rysunkiem marmuru. To materiał dla osób, które chcą ' +
      'wyrazistego kamienia i nie zamierzają się o niego martwić przy codziennym gotowaniu.',
  },
  {
    id: 'konglomerat',
    tytul: 'Blaty z konglomeratu kwarcowego',
    wstep:
      'Konglomerat ma powtarzalny wzór — to, co widać w katalogu, znajdzie się na blacie. ' +
      'Nie chłonie plam i jest najczęstszym wyborem do kuchni używanej na co dzień.',
  },
];

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Alt opisuje ZDJĘCIE, a nie upycha fraz — Google i czytnik ekranu chcą tego samego. */
function alt(r) {
  return `${r.opis.replace(/\.$/, '')} — ${r.material}. Blat kuchenny wykonany przez Kamieniarstwo 24h w Tarnobrzegu.`;
}

function kafel(r, pierwszy) {
  return `        <figure class="real-kafel">
          <a href="/realizacje/${r.slug}.jpg" class="real-link"
             data-duze="/realizacje/${r.slug}.webp" data-podpis="${esc(r.material)}">
            <picture>
              <source srcset="/realizacje/${r.slug}-mini.webp" type="image/webp" />
              <img src="/realizacje/${r.slug}-mini.jpg" width="${r.miniW}" height="${r.miniH}"
                   alt="${esc(alt(r))}"
                   loading="${pierwszy ? 'eager' : 'lazy'}" decoding="async" />
            </picture>
          </a>
          <figcaption>
            <strong>${esc(r.material)}</strong>
            <span>${esc(r.opis)}</span>
          </figcaption>
        </figure>`;
}

const sekcje = GRUPY.map((g) => {
  const poz = wynik.filter((r) => r.rodzaj === g.id);
  if (!poz.length) return '';
  return `    <h2 id="${g.id}">${g.tytul}</h2>
    <p>${g.wstep}</p>

    <div class="galeria">
${poz.map((r, i) => kafel(r, g.id === 'granit' && i < 3)).join('\n')}
    </div>`;
}).join('\n\n');

const obrazyLd = wynik.map((r) => ({
  '@type': 'ImageObject',
  contentUrl: `https://kam24h.pl/realizacje/${r.slug}.jpg`,
  thumbnailUrl: `https://kam24h.pl/realizacje/${r.slug}-mini.jpg`,
  width: r.w,
  height: r.h,
  name: `${r.material} — blat kuchenny`,
  description: r.opis,
  creator: { '@id': 'https://kam24h.pl/#firma' },
  contentLocation: { '@type': 'Place', name: 'Tarnobrzeg' },
}));

const OPIS =
  `Zdjęcia blatów kuchennych, które wykonaliśmy i zamontowaliśmy — granit, kwarcyt ` +
  `i konglomerat kwarcowy. ${wynik.length} realizacji z Tarnobrzega i okolic.`;

const strona = `<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>Realizacje — blaty kuchenne z kamienia, Tarnobrzeg</title>
  <meta name="description" content="${esc(OPIS)} Pomiar Prolinerem, obróbka na pile CNC i montaż." />
  <link rel="canonical" href="https://kam24h.pl/realizacje" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <meta name="theme-color" content="#13110f" />

  <link rel="icon" href="/logo-k24h.png" />
  <link rel="apple-touch-icon" href="/logo-k24h.png" />

  <meta property="og:type" content="article" />
  <meta property="og:locale" content="pl_PL" />
  <meta property="og:site_name" content="Kamieniarstwo 24h" />
  <meta property="og:title" content="Realizacje — blaty kuchenne z kamienia, Tarnobrzeg" />
  <meta property="og:description" content="${esc(OPIS)}" />
  <meta property="og:url" content="https://kam24h.pl/realizacje" />
  <meta property="og:image" content="https://kam24h.pl/realizacje/${wynik[0].slug}.jpg" />
  <meta name="twitter:card" content="summary_large_image" />

  <script type="application/ld+json">
${JSON.stringify(
  {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'HomeAndConstructionBusiness',
        '@id': 'https://kam24h.pl/#firma',
        name: 'Kamieniarstwo 24h',
        legalName: 'Aaron sp. z o.o.',
        url: 'https://kam24h.pl/',
        telephone: '+48796991128',
        image: 'https://kam24h.pl/og-k24h.png',
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'ul. Szpitalna 8',
          addressLocality: 'Tarnobrzeg',
          postalCode: '39-400',
          addressCountry: 'PL',
        },
      },
      {
        '@type': 'ImageGallery',
        '@id': 'https://kam24h.pl/realizacje#galeria',
        name: 'Realizacje — blaty kuchenne z kamienia',
        description: OPIS,
        url: 'https://kam24h.pl/realizacje',
        inLanguage: 'pl-PL',
        numberOfItems: wynik.length,
        associatedMedia: obrazyLd,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Strona główna', item: 'https://kam24h.pl/' },
          { '@type': 'ListItem', position: 2, name: 'Realizacje', item: 'https://kam24h.pl/realizacje' },
        ],
      },
    ],
  },
  null,
  2
)}
  </script>
</head>

<body>
  <a class="skip" href="#tresc">Przejdź do treści</a>

  <header class="wrap">
    <div class="topbar">
      <a class="logo" href="/">
        <img class="logo-img" src="/logo-k24h.png" width="42" height="54" alt="Kamieniarstwo 24h — blaty kamienne Tarnobrzeg" />
      </a>
      <a class="phone-btn" href="tel:+48796991128" data-miejsce="naglowek">
        <span class="ph-ico" aria-hidden="true">☎</span>
        <span class="ph-txt">
          <span class="ph-lbl">Zadzwoń teraz</span>
          <span class="ph-num">796 991 128</span>
        </span>
      </a>
    </div>
    <h1>Nasze realizacje<br><em>blaty, które już stoją w kuchniach.</em></h1>
    <p class="sub">Każde zdjęcie to blat, który wycięliśmy, wypolerowaliśmy i zamontowaliśmy — z podaniem kamienia, z jakiego powstał.</p>
  </header>

  <main id="tresc" class="wrap tekst">
    <nav class="okruszki" aria-label="Ścieżka nawigacji">
      <a href="/">Strona główna</a> <span aria-hidden="true">›</span> <span>Realizacje</span>
    </nav>

    <p>
      Poniżej ${wynik.length} blatów z ostatnich miesięcy — kuchnie w Tarnobrzegu i okolicy:
      <a href="/blaty-kuchenne-sandomierz">Sandomierzu</a>, <a href="/blaty-kuchenne-stalowa-wola">Stalowej Woli</a>,
      <a href="/blaty-kuchenne-mielec">Mielcu</a> i <a href="/blaty-kuchenne-nisko">Nisku</a>.
      Przy każdym zdjęciu podajemy nazwę kamienia, więc jeśli któryś przypadnie Panu/Pani do gustu,
      wystarczy podać nam nazwę — resztę policzymy.
    </p>
    <p>
      Zdjęcia pokazują blat po montażu oraz płytę, z której powstał. Przy kamieniu naturalnym
      to istotne: <strong>każda płyta ma własny rysunek</strong>, więc dwa blaty z tego samego
      gatunku nigdy nie wyglądają identycznie.
    </p>

    <div class="real-cta">
      <div>
        <strong>Policz swój blat w kilka pytań</strong>
        <span>Wybierz materiał i podaj wymiary — orientacyjną wycenę pokażemy od razu.</span>
      </div>
      <a class="btn" href="/#kreator">Przejdź do wyceny →</a>
    </div>

${sekcje}

    <h2>Jak powstaje taki blat</h2>
    <p>
      Zaczynamy od bezpłatnego pomiaru <strong>Prodim Prolinerem</strong> — urządzenie zdejmuje
      cyfrowy obrys rzeczywistego kształtu ścian, więc blat pasuje także w starym budownictwie,
      gdzie kąty rzadko są proste. Płytę tniemy na mostowej pile CNC, wycięcia pod zlew i płytę
      grzewczą przygotowujemy w zakładzie, a na miejscu zostaje sam montaż.
    </p>
    <p>
      Pracownia i plac z płytami są w Tarnobrzegu przy <strong>ul. Szpitalnej 8</strong>.
      Zapraszamy, żeby obejrzeć kamień na żywo — zdjęcie nigdy nie odda głębi polerowanej
      powierzchni. Można też zadzwonić: <a href="tel:+48796991128">796 991 128</a>.
    </p>

    <div class="real-cta">
      <div>
        <strong>Podobny blat u siebie?</strong>
        <span>Podaj wymiary i wybierz kamień — wycena bez wychodzenia z domu.</span>
      </div>
      <a class="btn" href="/#kreator">Wyceń blat →</a>
    </div>
  </main>

  <div class="lightbox" id="lightbox" hidden>
    <button class="lightbox-zamknij" type="button" aria-label="Zamknij podgląd">×</button>
    <figure>
      <img alt="" />
      <figcaption></figcaption>
    </figure>
  </div>

  <footer class="wrap">
    <div class="foot-cta">
      <div>
        <strong>Masz projekt kuchni albo gotowe szafki?</strong>
        <span>Zadzwoń — doradzimy materiał i umówimy bezpłatny pomiar.</span>
      </div>
      <a class="phone-btn" href="tel:+48796991128" data-miejsce="stopka">
        <span class="ph-ico" aria-hidden="true">☎</span>
        <span class="ph-txt">
          <span class="ph-lbl">Dawid Ząbek</span>
          <span class="ph-num">796 991 128</span>
        </span>
      </a>
    </div>

    <div class="foot-mapa">
      <div class="foot-kol">
        <span class="foot-kol-tytul">Co robimy</span>
        <nav aria-label="Co robimy">
          <a href="/blaty-kuchenne-tarnobrzeg">Blaty kuchenne Tarnobrzeg</a>
          <a href="/blaty-lazienkowe">Blaty łazienkowe</a>
          <a href="/okladziny-scienne">Okładziny ścienne</a>
          <a href="/blaty-z-konglomeratu">Blaty z konglomeratu</a>
          <a href="/blaty-ze-spieku">Blaty ze spieku</a>
          <a href="/blaty-granitowe">Blaty granitowe</a>
          <span class="foot-tu">Realizacje</span>
        </nav>
      </div>
      <div class="foot-kol">
        <span class="foot-kol-tytul">Baza wiedzy</span>
        <nav aria-label="Baza wiedzy">
          <a href="/baza-wiedzy/">Baza wiedzy</a>
          <a href="/baza-wiedzy/granit">Granit</a>
          <a href="/baza-wiedzy/marmur">Marmur</a>
          <a href="/baza-wiedzy/kwarcyt">Kwarcyt</a>
          <a href="/baza-wiedzy/trawertyn">Trawertyn</a>
          <a href="/baza-wiedzy/dolomit">Dolomit</a>
          <a href="/baza-wiedzy/konglomerat-kwarcowy">Konglomerat kwarcowy</a>
          <a href="/baza-wiedzy/spiek-kwarcowy">Spiek kwarcowy</a>
          <a href="/baza-wiedzy/pielegnacja-i-impregnacja">Pielęgnacja i impregnacja</a>
        </nav>
      </div>
      <div class="foot-kol">
        <span class="foot-kol-tytul">Gdzie dojeżdżamy</span>
        <nav aria-label="Gdzie dojeżdżamy">
          <a href="/blaty-kuchenne-sandomierz">Sandomierz</a>
          <a href="/blaty-kuchenne-stalowa-wola">Stalowa Wola</a>
          <a href="/blaty-kuchenne-mielec">Mielec</a>
          <a href="/blaty-kuchenne-rzeszow">Rzeszów</a>
          <a href="/blaty-kuchenne-kielce">Kielce</a>
          <a href="/blaty-kuchenne-nisko">Nisko</a>
          <a href="/blaty-kuchenne-nowa-deba">Nowa Dęba</a>
          <a href="/blaty-kuchenne-debica">Dębica</a>
          <a href="/blaty-kuchenne-opatow">Opatów</a>
        </nav>
      </div>
      <div class="foot-kol">
        <span class="foot-kol-tytul">Firma</span>
        <nav aria-label="Firma">
          <a href="/o-mnie">O mnie</a>
          <a href="/czesto-zadawane-pytania">Częste pytania</a>
          <a href="/polityka-prywatnosci">Polityka prywatności</a>
          <a href="#" id="cookies">Ustawienia cookies</a>
        </nav>
      </div>
    </div>

    <div class="foot-dane">
      <p>
        <strong>Kamieniarstwo 24h</strong> · Aaron sp. z o.o. · ul. Szpitalna 8, 39-400 Tarnobrzeg ·
        NIP 8672241748 · tel. <a href="tel:+48796991128">796 991 128</a>
      </p>
    </div>
  </footer>

  <script type="module" src="/src/podstrona.js"></script>
</body>
</html>
`;

fs.writeFileSync(path.resolve(import.meta.dirname, '..', 'realizacje.html'), strona, 'utf8');

const mb = (b) => (b / 1024 / 1024).toFixed(1) + ' MB';
console.log(`\n✓ ${wynik.length} realizacji → public/realizacje/`);
console.log(`  źródła ${mb(bajtyPrzed)} → publikowane ${mb(bajtyPo)} (webp + jpg, po dwa rozmiary)`);
console.log(`  manifest: src/generated/realizacje.json`);
console.log(`  strona:   realizacje.html (GENEROWANA — nie edytuj ręcznie)`);
for (const g of GRUPY) {
  console.log(`    ${g.tytul.padEnd(34)} ${wynik.filter((r) => r.rodzaj === g.id).length}`);
}

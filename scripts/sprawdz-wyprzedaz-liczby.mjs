/**
 * WERYFIKACJA LICZBOWA WYPRZEDAŻY — na PRAWDZIWYCH płytach Dawida.
 *
 *   node scripts/sprawdz-wyprzedaz-liczby.mjs
 *   node scripts/sprawdz-wyprzedaz-liczby.mjs --plik plyty.json   (bez sieci)
 *
 * Zlecenie Dawida (01.09.2026): „sprawdź, czy kalkulator dobrze LICZY płyty
 * wyprzedażowe". Testy jednostkowe sprawdzają REGUŁY na wymyślonych płytach;
 * ten skrypt liczy KWOTY na płytach, które naprawdę leżą na placu, i pokazuje
 * je w tabeli — żeby dało się je porównać z tym, co Dawid policzyłby ręcznie.
 *
 * Czego pilnujemy przy każdym układzie:
 *   1. materiał = LICZBA PEŁNYCH PŁYT × cena całej płyty, a nie m² blatu,
 *   2. liczba płyt z rozkroju wystarcza na blat (i nie jest zawyżona),
 *   3. gdy rozkrój chce więcej płyt, niż Dawid ma na placu — jest ostrzeżenie,
 *   4. rozrys pokazuje dokładnie te płyty, za które liczymy.
 *
 * ⚠ DWIE STAWKI VAT. Dawid wpisuje w panelu kwotę BRUTTO przy stawce
 * towarowej (23%). Silnik trzyma cenniki netto i nakłada stawkę SPRZEDAŻY:
 * 23% przy odbiorze własnym, 8% przy montażu (usługa budowlana). Ta sama
 * płyta ma więc przy montażu NIŻSZE brutto — netto Dawida jest identyczne.
 * Dlatego liczymy oba tryby i przy każdym porównujemy do kwoty przeliczonej
 * na tę stawkę, a nie do surowej liczby z panelu.
 */
import { wczytajSilnik } from './lib/silnik.mjs';

const ARG = (n, d) => {
  const i = process.argv.indexOf(n);
  return i > -1 ? process.argv[i + 1] : d;
};
const WORKER = ARG('--worker', 'https://k24h.kamieniarstwo24h.workers.dev');
const PLIK = ARG('--plik', null);

const m = await wczytajSilnik();
const { firmaDlaPlyty, kluczDekoru, doPokazania, cenaCalejPlyty, m2Plyty, brakuje, wycen } = m;

/* ─────────────────────────────────────────────────────── płyty z produkcji */

async function plyty() {
  if (PLIK) {
    const { readFile } = await import('node:fs/promises');
    return JSON.parse(await readFile(PLIK, 'utf8'));
  }
  const odp = await fetch(`${WORKER}/wyprzedaz`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://kam24h.pl' },
    body: '{}',
  });
  return (await odp.json()).plyty || [];
}

/**
 * Realne układy kuchni, od małej zabudowy po taką, która nie zmieści się
 * na zapasie Dawida. Ostatni jest tu CELOWO: chcemy zobaczyć ostrzeżenie,
 * a nie kwotę bez pokrycia.
 */
const UKLADY = [
  { nazwa: 'prosta zabudowa 260×62', odcinki: [{ dl: 260, gl: 62 }] },
  { nazwa: 'litera L 300+180×62', odcinki: [{ dl: 300, gl: 62 }, { dl: 180, gl: 62 }] },
  { nazwa: 'L z wyspą 300+180+140×90', odcinki: [{ dl: 300, gl: 62 }, { dl: 180, gl: 62 }, { dl: 140, gl: 90 }] },
  { nazwa: 'kuchnia U 320+320+240×65', odcinki: [{ dl: 320, gl: 65 }, { dl: 320, gl: 65 }, { dl: 240, gl: 65 }] },
  { nazwa: 'bardzo duża 6×300×65', odcinki: Array.from({ length: 6 }, () => ({ dl: 300, gl: 65 })) },
];

const TRYBY = [
  { nazwa: 'odbiór własny · VAT 23%', dostawa: 'odbior', vat: 0.23 },
  { nazwa: 'z montażem · VAT 8%', dostawa: 'montaz', vat: 0.08 },
];

const zl = (n) => Math.round(n).toLocaleString('pl-PL') + ' zł';
const problemy = [];
const zle = (t) => { problemy.push(t); console.log(`      \x1b[31m✗ ${t}\x1b[0m`); };
const ok = (t) => console.log(`      \x1b[32m✓\x1b[0m ${t}`);

/* ────────────────────────────────────────────────────────────── przebieg */

const lista = doPokazania(await plyty());
if (!lista.length) {
  console.error('Brak wystawionych płyt — nie ma czego sprawdzać.');
  process.exit(1);
}

console.log(`\x1b[1mWERYFIKACJA LICZBOWA WYPRZEDAŻY\x1b[0m  (${lista.length} pozycji z placu)`);

for (const p of lista) {
  const cenaSztuki = cenaCalejPlyty(p);
  const m2 = m2Plyty(p);
  console.log(
    `\n\x1b[1m${p.nazwa}\x1b[0m\n` +
      `  ${p.plytaDlCm}×${p.plytaGlCm} cm = ${m2.toFixed(2)} m² · ${p.cenaM2} zł/m² brutto · ` +
      `cała płyta ${zl(cenaSztuki)} · na placu ${p.plytZostalo} szt.`
  );

  const firma = firmaDlaPlyty(lista, kluczDekoru(p));

  for (const u of UKLADY) {
    console.log(`\n  \x1b[1m${u.nazwa}\x1b[0m`);

    for (const tryb of TRYBY) {
      const w = wycen(firma, {
        dekor: kluczDekoru(p),
        grubosc: String(p.gruboscMm),
        odcinki: u.odcinki,
        opcje: { dostawa: tryb.dostawa, pomieszczenie: 'kuchnia' },
      });

      if (!w.ok) {
        zle(`${u.nazwa} / ${tryb.nazwa}: silnik odmówił — ${w.blad}`);
        continue;
      }

      const pak = w.pak;
      const sztuk = pak.plytyPelne + (pak.polowka ? 1 : 0);
      const material = w.pozycje.find((x) => x.grupa === 'materiał');
      const cenaWTrybie = (cenaSztuki / 1.23) * (1 + tryb.vat);
      const oczekiwane = sztuk * cenaWTrybie;

      console.log(
        `    ${tryb.nazwa}: blat ${pak.m2Blatu.toFixed(2)} m² → \x1b[1m${sztuk} szt.\x1b[0m · ` +
          `materiał ${zl(material.brutto)} (= ${sztuk} × ${zl(cenaWTrybie)}) · RAZEM ${zl(w.razem)}`
      );

      // 1. materiał liczony PER SZTUKA, nie za metry blatu
      if (Math.abs(material.brutto - oczekiwane) <= 2) {
        ok('materiał = liczba pełnych płyt × cena całej płyty');
      } else {
        zle(`${p.nazwa} / ${u.nazwa} / ${tryb.nazwa}: materiał ${zl(material.brutto)} ≠ ${zl(oczekiwane)}`);
      }

      /*
       * Kontrola negatywna. Gdyby silnik liczył metrażem BLATU, wyszłaby
       * inna kwota — sprawdzamy, że nasza asercja naprawdę je rozróżnia,
       * a nie przechodzi przypadkiem, bo obie liczby są zbliżone.
       */
      const gdybyMetraz = pak.m2Blatu * ((p.cenaM2 / 1.23) * (1 + tryb.vat));
      if (Math.abs(material.brutto - gdybyMetraz) <= 2 && pak.m2Blatu < sztuk * m2 - 0.05) {
        zle(`${u.nazwa} / ${tryb.nazwa}: materiał wygląda na policzony z m² blatu, nie z płyt`);
      }

      // 2. geometria: blat MUSI się zmieścić w naliczonych płytach
      if (pak.m2Blatu > sztuk * m2 + 0.001) {
        zle(`${u.nazwa}: blat ${pak.m2Blatu.toFixed(2)} m² nie mieści się w ${sztuk} płytach`);
      }
      // ...i nie może być zawyżona o całą zbędną płytę
      if (sztuk > 1 && pak.m2Blatu <= (sztuk - 1) * m2 * 0.5) {
        zle(`${u.nazwa}: ${sztuk} płyt na blat ${pak.m2Blatu.toFixed(2)} m² wygląda na zawyżenie`);
      }

      // 3. ostrzeżenie, gdy potrzeba więcej płyt, niż jest na placu
      const braknie = brakuje(p, sztuk);
      const maOstrzezenie = w.ostrzezenia.some((o) => /nie ma tylu|kontakt|zostal|dostępn/i.test(o));
      if (braknie && !maOstrzezenie) {
        zle(`${u.nazwa}: potrzeba ${sztuk} płyt, na placu ${p.plytZostalo} — BRAK ostrzeżenia`);
      } else if (braknie) {
        ok(`ostrzeżenie o brakujących sztukach jest (potrzeba ${sztuk}, na placu ${p.plytZostalo})`);
      }

      // 4. rozrys pokazuje te same płyty, za które płacimy
      const naRozrysie = (pak.uklad || []).length;
      if (naRozrysie !== sztuk) {
        zle(`${u.nazwa} / ${tryb.nazwa}: rozrys ma ${naRozrysie} płyt, a liczymy ${sztuk}`);
      } else {
        ok(`rozrys pokazuje dokładnie te ${sztuk} płyt, za które liczymy`);
      }
    }
  }
}

/* ────────────────────────────────── scenariusz „zabrakło płyt na placu" ──
 *
 * Na realnym zapasie Dawida (8 i 18 sztuk) ten warunek NIGDY się nie odpala —
 * największy sprawdzany blat schodzi na trzech płytach. Sprawdzenie, które
 * nigdy nie wchodzi w gałąź błędu, nie dowodzi niczego, więc odtwarzamy tę
 * sytuację wprost: ta sama płyta, ale ostatnia sztuka na placu.
 */
console.log('\n\x1b[1mSCENARIUSZ KONTROLNY: ostatnia sztuka na placu\x1b[0m');
{
  const wzor = lista[0];
  const jedna = { ...wzor, plytZostalo: 1, plytRazem: 1 };
  const firma = firmaDlaPlyty([jedna], kluczDekoru(jedna));
  const duzy = UKLADY[UKLADY.length - 1];

  const w = wycen(firma, {
    dekor: kluczDekoru(jedna),
    grubosc: String(jedna.gruboscMm),
    odcinki: duzy.odcinki,
    opcje: { dostawa: 'odbior', pomieszczenie: 'kuchnia' },
  });

  const sztuk = w.pak.plytyPelne + (w.pak.polowka ? 1 : 0);
  const uwaga = brakuje(jedna, sztuk);
  console.log(`  ${jedna.nazwa}: blat ${w.pak.m2Blatu.toFixed(2)} m² potrzebuje ${sztuk} płyt, na placu 1`);

  if (!uwaga) {
    zle('rozkrój chce więcej płyt, niż jest na placu, a ostrzeżenia brak');
  } else {
    ok(`ostrzeżenie: „${uwaga.slice(0, 90)}…"`);
    // Ostrzeżenie ma trafić do WYCENY, nie tylko do funkcji pomocniczej —
    // klient czyta kartę, nie kod.
    const wKarcie = m.ostrzezenieOWyprzedazy(w, [jedna]);
    if (!wKarcie) zle('ostrzeżenie nie dokleja się do wyceny (ostrzezenieOWyprzedazy)');
    else ok('ostrzeżenie dokleja się do wyceny, którą widzi klient');
  }
}

console.log('');
if (problemy.length) {
  console.error(`\x1b[31m✗ Znaleziono ${problemy.length} rozbieżności:\x1b[0m`);
  for (const t of problemy) console.error(`  • ${t}`);
  process.exit(1);
}
console.log('\x1b[32m✓ Liczby się zgadzają — materiał per sztuka, rozkrój spójny z rozrysem.\x1b[0m');

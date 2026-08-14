import { firmaWgSlug } from '../firms/index.js';
import { wycen } from '../engine/wycena.js';

/**
 * WSTĘPNA WYCENA Z MAGAZYNU INTERSTONE
 *
 * Do sierpnia 2026 kamień naturalny nie miał automatycznej wyceny: klient
 * dostawał tylko „zapraszamy obejrzeć płytę". Odkąd konsultant widzi stan
 * magazynowy na żywo, da się policzyć całość — bo z magazynu znamy trzy
 * rzeczy, których wcześniej brakowało: cenę m², wymiar płyty i to, czy
 * materiał w ogóle jest.
 *
 * ZASADY (ustalone z Dawidem, sierpień 2026)
 *
 * 1. CENA MATERIAŁU — prosto z magazynu, w złotych brutto za m².
 *    Ceny na interstone.pl są już z marżą Dawida (strona sama pisze
 *    „zł/m² brutto", a każda kwota dzieli się przez 1,23 na równe złote).
 *
 * 2. CAŁE PŁYTY, nie metraż. Kamień naturalny to unikatowe płyty z bloku —
 *    nie da się kupić „półtora metra" z konkretnego rysunku, a stan
 *    magazynowy Interstone potwierdza to liczbami: dostępne metry są
 *    zawsze wielokrotnością powierzchni jednej płyty (np. 160 × 320 cm
 *    = 5,12 m², a dostępne bywa 5,12 / 10,24 / 15,36 m²).
 *    Dlatego pakujemy odcinki w PRAWDZIWY wymiar płyty z magazynu
 *    i płacimy za całe płyty — połówek nie dopuszczamy.
 *
 * 3. OBRÓBKA, MONTAŻ, ZLEW, INDUKCJA, OTWORY — z tego samego silnika
 *    co wszystkie inne materiały. Nic tu nie jest osobne.
 *
 * 4. WYCENA JEST WSTĘPNA. Płyty naturalne są unikatowe i schodzą
 *    z magazynu — dlatego na karcie i w rozmowie zawsze stoi zastrzeżenie,
 *    że ostateczna cena zapada po obejrzeniu i rezerwacji konkretnej płyty.
 */

export const ZASTRZEZENIE =
  'Wycena wstępna, na podstawie aktualnej dostępności magazynowej. Płyty kamienia ' +
  'naturalnego są niepowtarzalne i schodzą z magazynu — ostateczną cenę potwierdzamy ' +
  'po obejrzeniu i rezerwacji konkretnej płyty oraz po pomiarze.';

/**
 * To samo zastrzeżenie dla płyt z magazynu, które kamieniem naturalnym nie są
 * (Interstone ma też konglomerat InterQ i spiek Laminam). Bez zdania
 * o niepowtarzalności — bo konglomerat jest powtarzalny i byłoby to nieprawdą.
 */
export const ZASTRZEZENIE_INNE =
  'Wycena wstępna, na podstawie aktualnej dostępności magazynowej — ostateczną cenę ' +
  'potwierdzamy po rezerwacji płyty i pomiarze.';

/** Czy wariant z magazynu to kamień naturalny (a nie konglomerat/spiek). */
export function jestNaturalny(wariant) {
  return /kamie/i.test(uprosc(wariant?.rodzaj || ''));
}

function uprosc(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

/**
 * Wybór płyty spośród wariantów z magazynu.
 *
 * Kolejność ważności jest celowo taka, a nie „najtaniej":
 * najpierw ma się NADAWAĆ (gatunek, grubość, długość płyty), a dopiero
 * potem ma być tanio. Klientowi, który poprosił o blat 300 cm, nie pomaga
 * najtańsza płyta, z której trzeba go składać z dwóch kawałków.
 */
export function wybierzWariant(warianty, opcje = {}) {
  const {
    grubosc,
    najdluzszyOdcinek = 0,
    m2Potrzebne = 0,
    wykonczenie,
    tylkoNaturalny = false,
    preferujNaturalny = true,
  } = opcje;

  const kandydaci = (warianty || []).filter(
    (w) => w?.cenaBruttoM2 > 0 && w?.plytaCm?.dl > 0 && w?.dostepneM2 > 0
  );

  const naturalne = kandydaci.filter(jestNaturalny);
  if (tylkoNaturalny) {
    if (!naturalne.length) return null;
  }

  /**
   * Gdy klient prosi o kamień naturalny, a magazyn ma i naturalny, i wersję
   * z konglomeratu pod tą samą nazwą (Taj Mahal występuje jako naturalny
   * kwarcyt ORAZ jako InterQ), wybieramy naturalny — twardo, nie punktami.
   * Wcześniej decydowała różnica kilkudziesięciu punktów i przy odrobinie
   * innej ofercie konglomerat wygrałby przypadkiem.
   */
  const pula = (tylkoNaturalny || preferujNaturalny) && naturalne.length ? naturalne : kandydaci;
  if (!pula.length) return null;

  const punkty = (w) => {
    let p = 0;
    if (/gat\.?\s*i\b/i.test(w.jakosc || '')) p += 1000; // I gatunek przed II
    if (w.plytaCm.dl + 0.1 >= najdluzszyOdcinek) p += 500; // odcinek bez łączenia
    // Blok musi mieć dość materiału. Kamień naturalny bywa rozdrobniony:
    // ta sama nazwa to kilkanaście bloków, z których część ma jedną płytę.
    if (m2Potrzebne > 0 && w.dostepneM2 + 0.01 >= m2Potrzebne) p += 400;
    if (grubosc && String(w.gruboscMm) === String(grubosc)) p += 250;
    else if (!grubosc && w.gruboscMm >= 20) p += 200; // na blat domyślnie 20 mm
    if (wykonczenie && uprosc(w.wykonczenie).includes(uprosc(wykonczenie))) p += 100;
    // Przy równych warunkach — tańsza płyta i większy zapas.
    p -= w.cenaBruttoM2 / 1000;
    p += Math.min(w.dostepneM2, 100) / 1000;
    return p;
  };

  return [...pula].sort((a, b) => punkty(b) - punkty(a))[0];
}

/**
 * Wariant z magazynu → konfiguracja „firmy" dla silnika wyceny.
 *
 * Silnika nie ruszamy: on już umie liczyć cenę ręczną i pakować w płyty.
 * Podajemy mu tylko prawdziwy wymiar płyty i cenę z magazynu.
 */
export function firmaZWariantu(wariant) {
  const baza = firmaWgSlug('interstone');
  if (!baza || !wariant?.plytaCm) return null;

  const naturalny = jestNaturalny(wariant);

  return {
    ...baza,
    nazwa: wariant.rodzaj || baza.nazwa,
    trybCeny: 'reczna',
    // Strona Interstone podaje „zł/m² brutto" — nie doliczamy do tego VAT-u.
    cenaRecznaJest: 'brutto',
    // Płacimy za całe płyty (patrz zasada 2 na górze pliku).
    rozliczenieMaterialu: 'plyty',
    plyta: {
      w: wariant.plytaCm.dl,
      h: wariant.plytaCm.gl,
      polowkaDozwolona: false,
      // Magazyn podaje wymiar SUROWEJ płyty — krawędzie kamienia naturalnego
      // są nierówne i schodzą przy obróbce. W cennikach producentów formaty
      // są już użytkowe, dlatego obrzeże dokładamy tylko tutaj.
      obrzeze: 1,
    },
    // Kamień naturalny ma większy odpad — rysunek trzeba dobrać, zdarzają się
    // pęknięcia. Konglomerat i spiek z Interstone tną się jak każde inne.
    narzutOdpad: naturalny ? 0.15 : 0.1,

    // Dodatek za trudność obróbki dotyczy WYŁĄCZNIE kamienia naturalnego.
    // Interstone sprzedaje też konglomerat InterQ i spieki Laminam — te tną
    // się jak każdy inny materiał płytowy, więc nic do nich nie doliczamy.
    dodatekObrobkiNaturalnej: naturalny ? (baza.dodatekObrobkiNaturalnej ?? 0.1) : 0,

    notaKlient: naturalny ? ZASTRZEZENIE : ZASTRZEZENIE_INNE,

    // Klient ogląda i wybiera płytę sam — na stronie magazynu widzi zdjęcia
    // konkretnych bloków, ich wymiary i ceny. Adres przychodzi gotowy
    // z Workera (z filtrem na właściwy kamień i grupę), więc nikt go tutaj
    // nie skleja z parametrów.
    wyborPlyty: wariant.link
      ? { url: wariant.link, nazwa: wariant.nazwa, naturalny }
      : null,
    linkDekory: wariant.link
      ? { url: wariant.link, label: 'Zobacz płyty w magazynie' }
      : baza.linkDekory,
  };
}

/**
 * Pełna wstępna wycena blatu z płyty magazynowej.
 * Zwraca wynik silnika (`w.ok`) wzbogacony o `wariant`.
 */
export function wycenZMagazynu(wariant, { odcinki, opcje = {}, grubosc }) {
  const firma = firmaZWariantu(wariant);
  if (!firma) return { ok: false, blad: 'Brak danych płyty.' };

  const w = wycen(firma, {
    dekor: wariant.nazwa,
    grubosc: String(grubosc || wariant.gruboscMm || 20),
    odcinki,
    opcje,
    cenaRecznaM2: wariant.cenaBruttoM2,
  });
  if (!w.ok) return w;

  // Nie obiecujemy więcej, niż leży w magazynie. Klient ma to wiedzieć
  // ZANIM zadzwoni — inaczej rozczarowanie spada na Dawida.
  if (w.pak.m2Kupione > wariant.dostepneM2 + 0.01) {
    w.ostrzezenia = [
      ...w.ostrzezenia,
      `W magazynie jest teraz ${liczba(wariant.dostepneM2)} m² tego kamienia, a ten blat ` +
        `wymaga ${liczba(w.pak.m2Kupione)} m². Sprawdzimy termin dostawy kolejnych płyt.`,
    ];
  }

  w.wariant = wariant;
  return w;
}

function liczba(n) {
  return (Math.round(n * 10) / 10).toLocaleString('pl-PL');
}

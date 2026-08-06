/**
 * Upakowanie odcinków blatu w płyty.
 *
 * Materiał kupujemy w CAŁYCH płytach (część firm dopuszcza połówkę), więc
 * o cenie decyduje nie tyle metraż blatu, co ile płyt trzeba kupić.
 * Algorytm: układamy odcinki w „pasy" o szerokości płyty (shelf packing),
 * potem sumujemy wysokości pasów i dzielimy przez wysokość płyty.
 *
 * Wejście:
 *   odcinki — [{ dl, gl }] w centymetrach (długość × głębokość)
 *   plyta   — { w, h, polowkaDozwolona }
 *   narzutOdpad — np. 0.10 (10% zapasu na docięcie/pasowanie)
 */
export function upakuj(odcinki, plyta, narzutOdpad = 0.1) {
  const PW = plyta.w;
  const PH = plyta.h;
  const margines = 1 + narzutOdpad;
  const ostrzezenia = [];
  const czesci = [];
  let m2Blatu = 0;
  let mb = 0;

  for (const o of odcinki) {
    const dl = Math.max(o.dl, o.gl);
    const gl = Math.min(o.dl, o.gl);
    if (!(dl > 0) || !(gl > 0)) continue;

    let pozostalo = dl;
    // Odcinek dłuższy niż płyta trzeba złożyć z kilku kawałków (widoczne łączenie).
    while (pozostalo > PW + 0.1) {
      czesci.push({ dl: PW, gl });
      m2Blatu += (PW * gl) / 10000;
      mb += PW / 100;
      pozostalo -= PW;
      ostrzezenia.push(
        `Odcinek dłuższy niż płyta (${fmtCm(PW)} cm) — blat będzie łączony. Miejsce łączenia ustalamy na pomiarze.`
      );
    }
    if (pozostalo > 0.1) {
      czesci.push({ dl: pozostalo, gl });
      m2Blatu += (pozostalo * gl) / 10000;
      mb += pozostalo / 100;
    }
    if (gl > PH + 0.1) {
      ostrzezenia.push(`Głębokość ${fmtCm(gl)} cm przekracza szerokość płyty (${fmtCm(PH)} cm) — wymaga łączenia.`);
    }
  }

  if (!czesci.length) {
    return { plytyPelne: 0, polowka: false, m2Blatu: 0, m2Kupione: 0, mb: 0, ostrzezenia: [] };
  }

  // Pasy o szerokości płyty — dłuższe odcinki najpierw.
  czesci.sort((a, b) => b.dl - a.dl);
  const pasy = [];
  for (const cz of czesci) {
    let wlozony = false;
    for (const pas of pasy) {
      if (pas.zajete + cz.dl <= PW + 0.1) {
        pas.zajete += cz.dl;
        pas.wysokosc = Math.max(pas.wysokosc, cz.gl);
        wlozony = true;
        break;
      }
    }
    if (!wlozony) pasy.push({ zajete: cz.dl, wysokosc: cz.gl });
  }

  const wysokoscRazem = pasy.reduce((a, p) => a + p.wysokosc, 0) * margines;

  let plytyPelne = 0;
  let polowka = false;
  if (plyta.polowkaDozwolona) {
    plytyPelne = Math.floor(wysokoscRazem / PH);
    const reszta = wysokoscRazem - plytyPelne * PH;
    if (reszta > 0.1) {
      if (reszta <= PH / 2) polowka = true;
      else plytyPelne += 1;
    }
    if (plytyPelne === 0 && !polowka) polowka = true; // minimum: pół płyty
  } else {
    plytyPelne = Math.max(1, Math.ceil(wysokoscRazem / PH));
  }

  const m2Plyty = (PW * PH) / 10000;
  const m2Kupione = plytyPelne * m2Plyty + (polowka ? m2Plyty / 2 : 0);

  return {
    plytyPelne,
    polowka,
    m2Blatu,
    m2Kupione,
    mb,
    ostrzezenia: [...new Set(ostrzezenia)],
  };
}

export function opisPlyt(pak) {
  if (pak.plytyPelne === 0 && pak.polowka) return '½ płyty';
  if (pak.polowka) return `${pak.plytyPelne} i ½ płyty`;
  if (pak.plytyPelne === 1) return '1 płyta';
  if (pak.plytyPelne < 5) return `${pak.plytyPelne} płyty`;
  return `${pak.plytyPelne} płyt`;
}

function fmtCm(n) {
  return String(Math.round(n * 10) / 10).replace('.', ',');
}

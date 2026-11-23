/**
 * WZORY KAMIENIA — mapa „dekor z cennika → pliki ze zdjęciami".
 *
 * ⚠ PLIK GENEROWANY: node scripts/pobierz-wzory.mjs
 *   Ręczne zmiany przepadną przy następnym uruchomieniu.
 *
 * Zdjęcia: katalog Architype (dystrybutor Keralini i Avant Quartz),
 * za zgodą dystrybutora. Leżą w public/wzory/<marka>/:
 *   <klucz>-slab.webp  CAŁA PŁYTA (podgląd dla klienta),
 *   <klucz>.webp       zbliżenie w kwadracie (tekstura na bryle 3D),
 *   <klucz>-mini.webp  kropka przy nazwie dekoru.
 *
 * Z tej mapy korzystają OBA kalkulatory: umywalki i blaty.
 */
export const WZORY = {
  "keralini": {
    "Absolute Naturale": {
      "k": "absolute",
      "slab": true
    },
    "Absolute Black Structured": {
      "k": "absolute-black",
      "slab": true
    },
    "Absolute Grey Structured": {
      "k": "absolute-grey",
      "slab": false
    },
    "Absolute White Structured": {
      "k": "absolute-white",
      "slab": false
    },
    "Ballet Naturale": {
      "k": "ballet",
      "slab": true
    },
    "Boulevard Black Naturale": {
      "k": "boulevard-black",
      "slab": false
    },
    "Breccia Stone Beige Naturale": {
      "k": "breccia-stone-beige",
      "slab": false
    },
    "Calacatta Oro Naturale": {
      "k": "calacatta-oro",
      "slab": true
    },
    "Calacatta Oro Levigato": {
      "k": "calacatta-oro",
      "slab": true
    },
    "Canela Roma Naturale": {
      "k": "canela-roma",
      "slab": false
    },
    "Carrara Gold Naturale": {
      "k": "carrara-gold",
      "slab": false
    },
    "Crystal Cream Naturale": {
      "k": "crystal-cream",
      "slab": false
    },
    "Fior Di Bosco Naturale": {
      "k": "fior-di-bosco",
      "slab": true
    },
    "Hermon Naturale": {
      "k": "hermon",
      "slab": true
    },
    "Icelanic White Naturale": {
      "k": "icelanic-white",
      "slab": false
    },
    "Kenya Naturale": {
      "k": "kenya",
      "slab": true
    },
    "Lasa White Naturale": {
      "k": "lasa-white",
      "slab": true
    },
    "Laurent Naturale": {
      "k": "laurent",
      "slab": false
    },
    "Macaubas Beige Naturale": {
      "k": "macaubas-beige",
      "slab": false
    },
    "Makrana Naturale": {
      "k": "makrana",
      "slab": true
    },
    "Makrana Levigato": {
      "k": "makrana",
      "slab": true
    },
    "Marmo Antico Naturale": {
      "k": "marmo-antico",
      "slab": true
    },
    "Meraki Naturale": {
      "k": "meraki",
      "slab": false
    },
    "Monte Bianco Naturale": {
      "k": "monte-bianco",
      "slab": true
    },
    "Nero Marquina Naturale": {
      "k": "nero-marquina",
      "slab": true
    },
    "Pandora FULBODY Naturale": {
      "k": "pandora",
      "slab": false
    },
    "Patagonia Naturale": {
      "k": "patagonia",
      "slab": true
    },
    "Pietra Brown Naturale": {
      "k": "pietra-brown",
      "slab": true
    },
    "Pietra Grigia Naturale": {
      "k": "pietra-grigia",
      "slab": true
    },
    "Portoro Naturale": {
      "k": "portoro",
      "slab": true
    },
    "Saturnia Naturale": {
      "k": "saturnia",
      "slab": true
    },
    "Statuario Leonardo Naturale": {
      "k": "statuario-leonardo",
      "slab": true
    },
    "Statuario Raffaello Naturale": {
      "k": "statuario-raffaello",
      "slab": true
    },
    "Taj Mahal Naturale": {
      "k": "taj-mahal",
      "slab": false
    },
    "Tinta Unita Bianco Naturale": {
      "k": "tinta-unita-bianco",
      "slab": true
    },
    "Tinta Unita Nero Naturale": {
      "k": "tinta-unita-nero",
      "slab": true
    },
    "Travertino White Naturale": {
      "k": "travertino-white",
      "slab": true
    }
  },
  "avant-quartz": {
    "Chablis": {
      "k": "chablis",
      "slab": true
    },
    "Dijon": {
      "k": "dijon",
      "slab": true
    },
    "Blanche": {
      "k": "blanche",
      "slab": true
    },
    "Blanche L": {
      "k": "blanche-l",
      "slab": true
    },
    "White Quartz": {
      "k": "white-quartz",
      "slab": true
    },
    "Amiens": {
      "k": "amiens",
      "slab": false
    },
    "Reims": {
      "k": "reims",
      "slab": true
    },
    "Clermont": {
      "k": "clermont",
      "slab": true
    },
    "Lumiere": {
      "k": "lumiere",
      "slab": true
    },
    "Botticino Bourges": {
      "k": "botticino-bourges",
      "slab": false
    },
    "Champagne": {
      "k": "champagne",
      "slab": true
    },
    "Loiret": {
      "k": "loiret",
      "slab": true
    },
    "Montmartre": {
      "k": "montmartre",
      "slab": true
    },
    "Azur Creme": {
      "k": "azur-creme",
      "slab": true
    },
    "Nimes Marfil": {
      "k": "nimes-marfil",
      "slab": true
    },
    "Taj Amelie": {
      "k": "taj-amelie",
      "slab": true
    },
    "Calacatta Normandie": {
      "k": "calacatta-normandie",
      "slab": false
    },
    "Calacatta Riviera": {
      "k": "calacatta-riviera",
      "slab": false
    },
    "Calacatta Chery": {
      "k": "calacatta-chery",
      "slab": true
    },
    "Calacatta Besson": {
      "k": "calacatta-besson",
      "slab": true
    },
    "Calacatta Aveyron": {
      "k": "calacatta-aveyron",
      "slab": true
    },
    "Calacatta Viviez": {
      "k": "calacatta-viviez",
      "slab": true
    },
    "Gordes": {
      "k": "gordes",
      "slab": true
    },
    "Calacatta Chenonceau": {
      "k": "calacatta-chenonceau",
      "slab": true
    },
    "Calacatta Mont Saint Michel": {
      "k": "calacatta-mont-saint-michel",
      "slab": false
    },
    "Calacatta Versailles": {
      "k": "calacatta-versailles",
      "slab": false
    },
    "Aquitaine Blanca": {
      "k": "aquitaine-blanca",
      "slab": true
    },
    "Calacatta Dauphine": {
      "k": "calacatta-dauphine",
      "slab": true
    },
    "Calacatta Venato": {
      "k": "calacatta-venato",
      "slab": true
    },
    "Calacatta Bianco": {
      "k": "calacatta-bianco",
      "slab": false
    },
    "Calacatta Bearn": {
      "k": "calacatta-bearn",
      "slab": true
    },
    "Calacatta Arras": {
      "k": "calacatta-arras",
      "slab": true
    },
    "Calacatta Concorde": {
      "k": "calacatta-concorde",
      "slab": false
    },
    "Calacatta Cannes Gold": {
      "k": "calacatta-cannes-gold",
      "slab": false
    },
    "Calacatta Cannes Gold H": {
      "k": "calacatta-cannes-gold-h",
      "slab": true
    },
    "Calacatta Monaco": {
      "k": "calacatta-monaco",
      "slab": false
    },
    "Calacatta Pantin": {
      "k": "calacatta-pantin",
      "slab": true
    },
    "Calacatta Troyes": {
      "k": "calacatta-troyes",
      "slab": true
    },
    "Nantes": {
      "k": "nantes",
      "slab": true
    },
    "Mulen": {
      "k": "mulen",
      "slab": true
    },
    "Tarn": {
      "k": "tarn",
      "slab": true
    },
    "Chamonix": {
      "k": "chamonix",
      "slab": false
    },
    "Cassis": {
      "k": "cassis",
      "slab": true
    },
    "Reze": {
      "k": "reze",
      "slab": true
    },
    "Bretagne": {
      "k": "bretagne",
      "slab": false
    },
    "Bourbonnais": {
      "k": "bourbonnais",
      "slab": true
    },
    "Corsica": {
      "k": "corsica",
      "slab": false
    },
    "Royal Beige": {
      "k": "royal-beige",
      "slab": false
    },
    "Gris Fonce": {
      "k": "gris-fonce",
      "slab": true
    },
    "Patagonia Martinica": {
      "k": "patagonia-mortinica",
      "slab": false
    },
    "Arabescato Alencon": {
      "k": "arabescato-alencon",
      "slab": true
    },
    "Blave": {
      "k": "blave",
      "slab": true
    },
    "Bergerac": {
      "k": "bergerac",
      "slab": true
    },
    "Sorbona": {
      "k": "sorbonne",
      "slab": false
    },
    "Calacatta Eno": {
      "k": "calacatta-eno",
      "slab": true
    },
    "Statuario Lille": {
      "k": "statuario-lille",
      "slab": true
    },
    "Calacatta Bron": {
      "k": "calacatta-bron",
      "slab": true
    },
    "Calacatta Cassel": {
      "k": "calacatta-cassel",
      "slab": true
    },
    "Calacatta Marseille": {
      "k": "calacatta-marseille",
      "slab": true
    },
    "Patagonia Brive": {
      "k": "patagonia-brive",
      "slab": true
    },
    "Travertine Lacaze": {
      "k": "travertine-lacaze",
      "slab": true
    }
  }
};

/**
 * Ścieżka do zdjęcia wzoru albo `null`, gdy go nie mamy.
 * @param {string} marka
 * @param {string} dekor
 * @param {'tekstura'|'mini'|'slab'} [rodzaj]
 */
export function plikWzoru(marka, dekor, rodzaj = 'tekstura') {
  const wpis = WZORY[marka]?.[dekor];
  if (!wpis) return null;
  if (rodzaj === 'mini') return `/wzory/${marka}/${wpis.k}-mini.webp`;
  // Gdy dostawca nie ma zdjęcia całej płyty, podgląd pokazuje zbliżenie —
  // lepsze to niż puste miejsce, a strukturę kamienia widać tak czy tak.
  if (rodzaj === 'slab') return `/wzory/${marka}/${wpis.k}${wpis.slab ? '-slab' : ''}.webp`;
  return `/wzory/${marka}/${wpis.k}.webp`;
}

/** Czy dla tego dekoru mamy zdjęcie CAŁEJ płyty, a nie tylko zbliżenie. */
export function maCalaPlyte(marka, dekor) {
  return !!WZORY[marka]?.[dekor]?.slab;
}

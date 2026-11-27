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
      "slab": true
    },
    "Absolute White Structured": {
      "k": "absolute-white",
      "slab": true
    },
    "Ballet Naturale": {
      "k": "ballet",
      "slab": true
    },
    "Boulevard Black Naturale": {
      "k": "boulevard-black",
      "slab": true
    },
    "Breccia Stone Beige Naturale": {
      "k": "breccia-stone-beige",
      "slab": true
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
      "slab": true
    },
    "Carrara Gold Naturale": {
      "k": "carrara-gold",
      "slab": true
    },
    "Crystal Cream Naturale": {
      "k": "crystal-cream",
      "slab": true
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
      "slab": true
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
      "slab": true
    },
    "Macaubas Beige Naturale": {
      "k": "macaubas-beige",
      "slab": true
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
      "slab": true
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
      "slab": true
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
      "slab": true
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
      "slab": true
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
      "slab": true
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
      "slab": true
    },
    "Calacatta Riviera": {
      "k": "calacatta-riviera",
      "slab": true
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
      "slab": true
    },
    "Calacatta Versailles": {
      "k": "calacatta-versailles",
      "slab": true
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
      "slab": true
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
      "slab": true
    },
    "Calacatta Cannes Gold": {
      "k": "calacatta-cannes-gold",
      "slab": true
    },
    "Calacatta Cannes Gold H": {
      "k": "calacatta-cannes-gold-h",
      "slab": true
    },
    "Calacatta Monaco": {
      "k": "calacatta-monaco",
      "slab": true
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
      "slab": true
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
      "slab": true
    },
    "Bourbonnais": {
      "k": "bourbonnais",
      "slab": true
    },
    "Corsica": {
      "k": "corsica",
      "slab": true
    },
    "Royal Beige": {
      "k": "royal-beige",
      "slab": true
    },
    "Gris Fonce": {
      "k": "gris-fonce",
      "slab": true
    },
    "Patagonia Martinica": {
      "k": "patagonia-mortinica",
      "slab": true
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
      "slab": true
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
  },
  "silestone": {
    "Arden Blue": {
      "k": "arden-blue",
      "slab": true
    },
    "Blanco Norte 14": {
      "k": "blanco-norte14",
      "slab": true
    },
    "Gris Expo": {
      "k": "gris-expo",
      "slab": true
    },
    "Linen Cream": {
      "k": "linen-cream",
      "slab": true
    },
    "Marengo": {
      "k": "marengo",
      "slab": true
    },
    "Motion Grey": {
      "k": "motion-grey",
      "slab": true
    },
    "Night Tebas 18": {
      "k": "night-tebas18",
      "slab": true
    },
    "White Storm 14": {
      "k": "white-storm14",
      "slab": true
    },
    "Brass Relish": {
      "k": "brass-relish",
      "slab": true
    },
    "Cinder Craze": {
      "k": "cinder-craze",
      "slab": true
    },
    "Concrete Pulse": {
      "k": "concrete-pulse",
      "slab": true
    },
    "Coral Clay Colour": {
      "k": "coral-clay-colour",
      "slab": true
    },
    "Lagoon": {
      "k": "lagoon",
      "slab": true
    },
    "Lime Delight": {
      "k": "lime-delight",
      "slab": true
    },
    "Miami White 17": {
      "k": "miami-white",
      "slab": true
    },
    "Persian White": {
      "k": "persian-white",
      "slab": true
    },
    "Siberian": {
      "k": "siberian",
      "slab": true
    },
    "Ariel": {
      "k": "ariel",
      "slab": true
    },
    "Blanco Stellar 13": {
      "k": "stellar-blanco13",
      "slab": true
    },
    "Bronze Rivers": {
      "k": "bronze-rivers",
      "slab": true
    },
    "Calacatta Tova": {
      "k": "calacatta-tova",
      "slab": true
    },
    "Charcoal Soapstone": {
      "k": "charcoal-soapstone",
      "slab": true
    },
    "Desert Silver": {
      "k": "desert-silver",
      "slab": true
    },
    "Miami Vena": {
      "k": "miami-vena",
      "slab": true
    },
    "Snowy Ibiza": {
      "k": "snowy-ibiza",
      "slab": true
    },
    "Blanco Zeus": {
      "k": "white-zeus",
      "slab": true
    },
    "Et. Statuario": {
      "k": "et-statuario",
      "slab": true
    },
    "FFROM 01": {
      "k": "ffrom01",
      "slab": true
    },
    "FFROM 02": {
      "k": "ffrom02",
      "slab": true
    },
    "FFROM 03": {
      "k": "ffrom03",
      "slab": true
    },
    "Nolita 23": {
      "k": "nolita",
      "slab": true
    },
    "Poblenou": {
      "k": "poblenou",
      "slab": true
    },
    "RAW A": {
      "k": "raw-a",
      "slab": true
    },
    "White Arabesque": {
      "k": "white-arabesque",
      "slab": true
    },
    "Et. Marquina": {
      "k": "et-marquina",
      "slab": true
    },
    "Et. Calacatta Gold": {
      "k": "et-calacatta-gold",
      "slab": true
    },
    "Ethereal Glow": {
      "k": "ethereal-glow",
      "slab": true
    },
    "Ethereal Noctis": {
      "k": "ethereal-noctis",
      "slab": true
    },
    "Blanc Élysée": {
      "k": "blanc-elysee",
      "slab": true
    },
    "Jardin Emerald": {
      "k": "jardin-emerald",
      "slab": true
    },
    "Parisien Bleu": {
      "k": "parisien-bleu",
      "slab": true
    },
    "Rivière Rose": {
      "k": "riviere-rose",
      "slab": true
    },
    "Romantic Ash": {
      "k": "romantic-ash",
      "slab": true
    },
    "Versailles Ivory": {
      "k": "versailles-ivory",
      "slab": true
    }
  },
  "dekton": {
    "Aeris": {
      "k": "aeris",
      "slab": true
    },
    "Danae": {
      "k": "danae",
      "slab": true
    },
    "Dunna": {
      "k": "dunna",
      "slab": true
    },
    "Eter": {
      "k": "eter",
      "slab": true
    },
    "Evok": {
      "k": "evok",
      "slab": true
    },
    "Keena": {
      "k": "keena",
      "slab": true
    },
    "Kovik": {
      "k": "kovik",
      "slab": true
    },
    "Lunar 22": {
      "k": "lunar",
      "slab": true
    },
    "Mooné": {
      "k": "moone",
      "slab": true
    },
    "Thala": {
      "k": "thala",
      "slab": true
    },
    "Trilium": {
      "k": "trilium",
      "slab": true
    },
    "Bromo": {
      "k": "bromo",
      "slab": true
    },
    "Halo": {
      "k": "halo",
      "slab": true
    },
    "Kira": {
      "k": "kira",
      "slab": true
    },
    "Kreta": {
      "k": "kreta",
      "slab": true
    },
    "Nacre": {
      "k": "nacre",
      "slab": true
    },
    "Adia": {
      "k": "adia",
      "slab": true
    },
    "Albarium 22": {
      "k": "albarium",
      "slab": true
    },
    "Argentium": {
      "k": "argentium",
      "slab": true
    },
    "Aura 22": {
      "k": "aura",
      "slab": true
    },
    "Ava": {
      "k": "ava",
      "slab": true
    },
    "Avorio": {
      "k": "avorio",
      "slab": true
    },
    "Ceppo": {
      "k": "ceppo",
      "slab": true
    },
    "Domoos25": {
      "k": "domoos",
      "slab": true
    },
    "Grafite": {
      "k": "grafite",
      "slab": true
    },
    "Grigio": {
      "k": "grigio",
      "slab": true
    },
    "Kelya": {
      "k": "kelya",
      "slab": true
    },
    "Laos": {
      "k": "laos",
      "slab": true
    },
    "Marina": {
      "k": "marina",
      "slab": true
    },
    "Marmorio": {
      "k": "marmorio",
      "slab": true
    },
    "Nebbia": {
      "k": "nebbia",
      "slab": true
    },
    "Nebu": {
      "k": "nebu",
      "slab": true
    },
    "Polar": {
      "k": "polar",
      "slab": true
    },
    "Sabbia": {
      "k": "sabbia",
      "slab": true
    },
    "Sandik": {
      "k": "sandik",
      "slab": true
    },
    "Soke": {
      "k": "soke",
      "slab": true
    },
    "Trevi": {
      "k": "trevi",
      "slab": true
    },
    "Umber": {
      "k": "umber",
      "slab": true
    },
    "Entzo 22": {
      "k": "entzo",
      "slab": true
    },
    "Laurent": {
      "k": "laurent",
      "slab": true
    },
    "Morpheus": {
      "k": "morpheus",
      "slab": true
    },
    "Nara": {
      "k": "nara",
      "slab": true
    },
    "Neural": {
      "k": "neural",
      "slab": true
    },
    "Rem": {
      "k": "rem",
      "slab": true
    },
    "Reverie": {
      "k": "reverie",
      "slab": true
    },
    "Salina": {
      "k": "salina",
      "slab": true
    },
    "Somnia": {
      "k": "somnia",
      "slab": true
    },
    "Arga": {
      "k": "arga",
      "slab": true
    },
    "Awake": {
      "k": "awake",
      "slab": true
    },
    "Bergen": {
      "k": "bergen",
      "slab": true
    },
    "Helena 22": {
      "k": "helena",
      "slab": true
    },
    "Khalo": {
      "k": "khalo",
      "slab": true
    },
    "Lucid": {
      "k": "lucid",
      "slab": true
    },
    "Taga": {
      "k": "taga",
      "slab": true
    },
    "Trance": {
      "k": "trance",
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

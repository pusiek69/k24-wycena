/**
 * WZORY KAMIENIA — mapa „dekor z cennika → plik ze zdjęciem".
 *
 * ⚠ PLIK GENEROWANY: node scripts/pobierz-wzory.mjs
 *   Ręczne zmiany przepadną przy następnym uruchomieniu.
 *
 * Zdjęcia: katalog Architype (dystrybutor Keralini i Avant Quartz),
 * za zgodą dystrybutora. Leżą w public/wzory/<marka>/<klucz>.webp
 * (tekstura 640 px) oraz -mini.webp (kropka na kafelku, 96 px).
 *
 * Dekory, których nie ma w tej mapie, dostają teksturę proceduralną
 * w kolorze zbliżonym do wzoru — patrz dekory-polecane.js.
 */
export const WZORY = {
  "keralini": {
    "Absolute Naturale": "absolute",
    "Absolute Black Structured": "absolute-black",
    "Absolute Grey Structured": "absolute-grey",
    "Absolute White Structured": "absolute-white",
    "Ballet Naturale": "ballet",
    "Boulevard Black Naturale": "boulevard-black",
    "Breccia Stone Beige Naturale": "breccia-stone-beige",
    "Calacatta Oro Naturale": "calacatta-oro",
    "Calacatta Oro Levigato": "calacatta-oro",
    "Canela Roma Naturale": "canela-roma",
    "Carrara Gold Naturale": "carrara-gold",
    "Crystal Cream Naturale": "crystal-cream",
    "Fior Di Bosco Naturale": "fior-di-bosco",
    "Hermon Naturale": "hermon",
    "Icelanic White Naturale": "icelanic-white",
    "Kenya Naturale": "kenya",
    "Lasa White Naturale": "lasa-white",
    "Laurent Naturale": "laurent",
    "Macaubas Beige Naturale": "macaubas-beige",
    "Makrana Naturale": "makrana",
    "Makrana Levigato": "makrana",
    "Marmo Antico Naturale": "marmo-antico",
    "Meraki Naturale": "meraki",
    "Monte Bianco Naturale": "monte-bianco",
    "Nero Marquina Naturale": "nero-marquina",
    "Pandora FULBODY Naturale": "pandora",
    "Patagonia Naturale": "patagonia",
    "Pietra Brown Naturale": "pietra-brown",
    "Pietra Grigia Naturale": "pietra-grigia",
    "Portoro Naturale": "portoro",
    "Saturnia Naturale": "saturnia",
    "Statuario Leonardo Naturale": "statuario-leonardo",
    "Statuario Raffaello Naturale": "statuario-raffaello",
    "Taj Mahal Naturale": "taj-mahal",
    "Tinta Unita Bianco Naturale": "tinta-unita-bianco",
    "Tinta Unita Nero Naturale": "tinta-unita-nero",
    "Travertino White Naturale": "travertino-white"
  },
  "avant-quartz": {
    "Chablis": "chablis",
    "Dijon": "dijon",
    "Blanche": "blanche",
    "Blanche L": "blanche-l",
    "White Quartz": "white-quartz",
    "Amiens": "amiens",
    "Reims": "reims",
    "Clermont": "clermont",
    "Lumiere": "lumiere",
    "Botticino Bourges": "botticino-bourges",
    "Champagne": "champagne",
    "Loiret": "loiret",
    "Montmartre": "montmartre",
    "Azur Creme": "azur-creme",
    "Nimes Marfil": "nimes-marfil",
    "Taj Amelie": "taj-amelie",
    "Calacatta Normandie": "calacatta-normandie",
    "Calacatta Riviera": "calacatta-riviera",
    "Calacatta Chery": "calacatta-chery",
    "Calacatta Besson": "calacatta-besson",
    "Calacatta Aveyron": "calacatta-aveyron",
    "Calacatta Viviez": "calacatta-viviez",
    "Gordes": "gordes",
    "Calacatta Chenonceau": "calacatta-chenonceau",
    "Calacatta Mont Saint Michel": "calacatta-mont-saint-michel",
    "Calacatta Versailles": "calacatta-versailles",
    "Aquitaine Blanca": "aquitaine-blanca",
    "Calacatta Dauphine": "calacatta-dauphine",
    "Calacatta Venato": "calacatta-venato",
    "Calacatta Bianco": "calacatta-bianco",
    "Calacatta Bearn": "calacatta-bearn",
    "Calacatta Arras": "calacatta-arras",
    "Calacatta Concorde": "calacatta-concorde",
    "Calacatta Cannes Gold": "calacatta-cannes-gold",
    "Calacatta Cannes Gold H": "calacatta-cannes-gold-h",
    "Calacatta Monaco": "calacatta-monaco",
    "Calacatta Pantin": "calacatta-pantin",
    "Calacatta Troyes": "calacatta-troyes",
    "Nantes": "nantes",
    "Mulen": "mulen",
    "Tarn": "tarn",
    "Chamonix": "chamonix",
    "Cassis": "cassis",
    "Reze": "reze",
    "Bretagne": "bretagne",
    "Bourbonnais": "bourbonnais",
    "Corsica": "corsica",
    "Royal Beige": "royal-beige",
    "Gris Fonce": "gris-fonce",
    "Patagonia Martinica": "patagonia-martinica",
    "Arabescato Alencon": "arabescato-alencon",
    "Blave": "blave",
    "Bergerac": "bergerac",
    "Sorbona": "sorbona",
    "Calacatta Eno": "calacatta-eno",
    "Statuario Lille": "statuario-lille",
    "Calacatta Bron": "calacatta-bron",
    "Calacatta Cassel": "calacatta-cassel",
    "Calacatta Marseille": "calacatta-marseille",
    "Patagonia Brive": "patagonia-brive",
    "Travertine Lacaze": "travertine-lacaze"
  }
};

/** Ścieżka do tekstury wzoru albo `null`, gdy zdjęcia nie mamy. */
export function plikWzoru(marka, dekor, mini = false) {
  const klucz = WZORY[marka]?.[dekor];
  if (!klucz) return null;
  return `/wzory/${marka}/${klucz}${mini ? '-mini' : ''}.webp`;
}

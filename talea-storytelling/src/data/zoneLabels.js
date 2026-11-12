// Etichette delle 18 zone del Comune di Bologna, usate come punti di
// riferimento sulle mappe.
//
// Fonte dei nomi e dei confini: Comune di Bologna, open data
// "Zone del Comune di Bologna" (zone-del-comune-di-bologna), confrontati con
// OpenStreetMap (place=suburb). Ogni `coord` è il punto dell'etichetta, scelto
// a mano e verificato dentro i confini ufficiali della zona: di solito il
// baricentro ufficiale, spostato dove serviva per non finire sotto pannelli o
// fuori dall'inquadratura.
//
// I nomi sono toponimi e restano uguali in italiano e in inglese.
//
// `hideWithCard`: id della scheda degli hotspot (hotspotAnnotations.js) che
// rappresenta la stessa zona. Finché quella scheda è visibile (fissa o al
// passaggio del mouse), l'etichetta si nasconde per non ripetere lo stesso
// luogo due volte.
export const bolognaZoneLabels = [
  { id: "borgo-panigale", name: "Borgo Panigale", coord: [11.27618, 44.51949] },
  { id: "barca", name: "Barca", coord: [11.29254, 44.496] },
  { id: "santa-viola", name: "Santa Viola", coord: [11.30128, 44.50863] },
  { id: "saffi", name: "Saffi", coord: [11.318, 44.4995] },
  { id: "lame", name: "Lame", coord: [11.32519, 44.53036] },
  { id: "corticella", name: "Corticella", coord: [11.372, 44.527] },
  {
    id: "bolognina",
    name: "Bolognina",
    coord: [11.34667, 44.51714],
    hideWithCard: "bolognina",
  },
  { id: "san-donato", name: "San Donato", coord: [11.385, 44.515] },
  { id: "san-vitale", name: "San Vitale", coord: [11.385, 44.498] },
  {
    id: "marconi",
    name: "Marconi",
    coord: [11.33816, 44.50057],
    hideWithCard: "centro-storico",
  },
  {
    id: "irnerio",
    name: "Irnerio",
    coord: [11.35068, 44.49838],
    hideWithCard: "centro-storico",
  },
  {
    id: "malpighi",
    name: "Malpighi",
    coord: [11.33486, 44.49283],
    hideWithCard: "centro-storico",
  },
  {
    id: "galvani",
    name: "Galvani",
    coord: [11.34872, 44.48905],
    hideWithCard: "centro-storico",
  },
  { id: "murri", name: "Murri", coord: [11.36456, 44.48023] },
  { id: "mazzini", name: "Mazzini", coord: [11.39042, 44.47666] },
  { id: "san-ruffillo", name: "San Ruffillo", coord: [11.375, 44.463] },
  { id: "colli", name: "Colli", coord: [11.33, 44.479] },
  { id: "costa-saragozza", name: "Costa Saragozza", coord: [11.30447, 44.473] },
];

// Zone da nascondere mentre sono visibili queste schede degli hotspot.
export function zonesHiddenByHotspotCards(cardIds) {
  return bolognaZoneLabels
    .filter((zone) => zone.hideWithCard && cardIds.includes(zone.hideWithCard))
    .map((zone) => zone.id);
}

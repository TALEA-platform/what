/**
 * Annotation data for the surface-heat hotspots shown on the map.
 *
 * `narrative: true` zones animate in as labelled cards at the persistence beat
 * (the four original anchors, incl. Centro storico and CAAB). The extra zones are
 * placed on the actual persistent clusters in the data (public/data/hotspots/
 * hotspots_ge_10 / ge_13 — cells hot in 10–13 of 13 summers): the airport, the
 * western commercial belt, and the northern/eastern corridor (Bolognina,
 * Roveri, Fiera).
 *
 * Hover: from the moment the flags start animating, moving over a zone's area pops
 * a NON-permanent card (dot + connector line + label) showing `context` — a short,
 * plain line in the same voice as the rest of the copy (doc 03 §8).
 *
 * Coords [lng, lat]; `anchor` positions the label/hover card (offset from the dot,
 * with a connector line between them).
 */
export const hotspotAnnotations = [
  {
    id: "centro-storico",
    name: "Centro storico",
    tag: "dentro le mura",
    context: "edifici ravvicinati e stretti dentro le mura",
    narrative: true,
    coord: [11.34148, 44.49477],
    anchor: [11.353, 44.4905],
  },
  {
    id: "stazione-centrale",
    name: "Stazione Centrale",
    tag: "binari e piazzali",
    context: "la fascia dei binari trattiene il sole fino a notte",
    narrative: true,
    coord: [11.3458, 44.5066],
    anchor: [11.360, 44.5045],
  },
  {
    id: "scalo-ravone",
    name: "Scalo Ravone",
    tag: "ex scalo ferroviario",
    context: "binari e piazzali aperti, scuri e senza ombra",
    narrative: true,
    coord: [11.3255, 44.5093],
    anchor: [11.309, 44.5135],
  },
  {
    id: "caab",
    name: "CAAB",
    tag: "mercato e logistica",
    context: "capannoni del mercato e piazzali",
    narrative: true,
    coord: [11.411808, 44.516589],
    anchor: [11.392, 44.5245],
  },
  {
    id: "fiera",
    name: "Quartiere fieristico",
    tag: "padiglioni e piazzali",
    context: "padiglioni e grandi parcheggi",
    narrative: false,
    coord: [11.3626, 44.5149],
    anchor: [11.378, 44.5172],
  },
  {
    id: "villaggio-ina",
    name: "Ducati Villaggio INA",
    tag: "centro commerciale e piazzali",
    context: "parcheggi e grandi coperture che trattengono calore",
    narrative: false,
    coord: [11.26475, 44.51959],
    anchor: [11.281, 44.5222],
  },
  {
    id: "aeroporto",
    name: "Aeroporto",
    tag: "piste e piazzali",
    context: "superfici aperte e scure, esposte al sole per ore",
    narrative: true,
    coord: [11.2949, 44.5308],
    anchor: [11.308, 44.5325],
  },
  {
    id: "bolognina",
    name: "Bolognina",
    tag: "a nord dei binari",
    context: "edifici ravvicinati e strade strette",
    narrative: false,
    coord: [11.3575, 44.5329],
    anchor: [11.371, 44.535],
  },
  {
    id: "roveri",
    name: "Roveri",
    tag: "zona industriale",
    context: "capannoni e piazzali della logistica, quasi senza ombra",
    narrative: false,
    coord: [11.4065, 44.5024],
    anchor: [11.393, 44.5005],
  },
];

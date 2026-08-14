import { PLAN_ANCHORS } from "./cityPlan";

export const planView = { at: [1180, 745], units: 2320 };

export const planBeatSpecs = [
  { id: "quartiere", side: "left" },
  { id: "buco", side: "left" },
  { id: "costruisce", vignette: "costruire", side: "right" },
  { id: "nonuno", side: "right" },
  { id: "corridoi", vignette: "corridoio", side: "left" },
  { id: "portici", vignette: "portico", side: "right" },
  { id: "rete", side: "right" },
];

export const planAnnotationSpecs = [
  {
    id: "parking",
    from: 0,
    until: 1,
    point: PLAN_ANCHORS.piazzale,
    offset: [54, -38],
  },
  {
    id: "new-relief",
    from: 2,
    until: 3,
    point: PLAN_ANCHORS.piazzale,
    offset: [54, -38],
  },
  {
    id: "corridor",
    from: 4,
    until: 4,
    point: PLAN_ANCHORS.corridoio,
    offset: [52, -44],
  },
  {
    id: "arcades",
    from: 5,
    until: 5,
    point: PLAN_ANCHORS.portico,
    offset: [52, 38],
  },
];

export const planLegendSpecs = [
  { id: "new-green-spaces", at: 2, tone: "green" },
  { id: "climate-corridors", at: 4, tone: "shade" },
  { id: "porticoes", at: 5, tone: "portico" },
];

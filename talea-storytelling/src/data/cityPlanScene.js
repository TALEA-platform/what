import { PLAN_ANCHORS } from "./cityPlan";

export const planView = { at: [1180, 745], units: 2320 };

// Camera targets used only below 1280px. `units` is the width of the plan,
// expressed in SVG units, that fits inside the narrative band; lower values
// therefore mean a tighter crop. `screen` places the focused point within the
// sticky viewport. Phone and tablet values are blended fluidly in between.
//
// Beats with a `path` use their keyframes for a short scroll-controlled
// travelling instead of holding a single framing.
export const planMobileCameraSettings = {
  maxWidth: 1279,
  phoneWidth: 480,
  tabletWidth: 1024,
  entryFraction: 0.28,
};

export const planMobileCamera = [
  {
    id: "quartiere",
    phone: {
      path: [
        { t: 0, at: [640, 1022], units: 1080, screen: [0.53, 0.34] },
        { t: 0.78, at: [650, 1010], units: 1120, screen: [0.53, 0.34] },
        { t: 1, at: [650, 1010], units: 1120, screen: [0.53, 0.34] },
      ],
    },
    tablet: {
      path: [
        { t: 0, at: [842, 872], units: 1715, screen: [0.5, 0.38] },
        { t: 0.78, at: [860, 860], units: 1780, screen: [0.5, 0.38] },
        { t: 1, at: [860, 860], units: 1780, screen: [0.5, 0.38] },
      ],
    },
  },
  {
    id: "buco",
    phone: { at: [625, 1030], units: 760, screen: [0.53, 0.33] },
    tablet: { at: [760, 920], units: 1320, screen: [0.5, 0.37] },
  },
  {
    id: "costruisce",
    phone: { at: PLAN_ANCHORS.piazzale, units: 680, screen: [0.53, 0.47] },
    tablet: { at: [610, 1015], units: 1060, screen: [0.5, 0.45] },
  },
  {
    id: "nonuno",
    // Keep the three newly changed places (piazzale, school and piazza)
    // readable together: this is the visual proof that one place is not enough.
    phone: { at: [850, 820], units: 1250, screen: [0.5, 0.34] },
    tablet: { at: [850, 790], units: 1650, screen: [0.5, 0.38] },
  },
  {
    id: "corridoi",
    phone: {
      path: [
        { t: 0, at: [540, 1015], units: 700, screen: [0.48, 0.42] },
        { t: 0.46, at: PLAN_ANCHORS.corridoio, units: 680, screen: [0.5, 0.4] },
        { t: 1, at: [1580, 1065], units: 780, screen: [0.52, 0.38] },
      ],
    },
    tablet: {
      path: [
        { t: 0, at: [650, 990], units: 1180, screen: [0.47, 0.42] },
        { t: 0.46, at: PLAN_ANCHORS.corridoio, units: 1120, screen: [0.5, 0.4] },
        { t: 1, at: [1510, 1040], units: 1260, screen: [0.53, 0.38] },
      ],
    },
  },
  {
    id: "portici",
    // Start from the corridor context, then move north-west and tighten on the
    // existing porticoes. The final focus stays clear of the model at top-right.
    phone: {
      path: [
        { t: 0, at: [900, 780], units: 1200, screen: [0.47, 0.38] },
        { t: 0.55, at: [720, 480], units: 900, screen: [0.4, 0.4] },
        { t: 1, at: [620, 340], units: 780, screen: [0.36, 0.42] },
      ],
    },
    tablet: {
      path: [
        { t: 0, at: [900, 710], units: 1650, screen: [0.48, 0.38] },
        { t: 0.55, at: [760, 500], units: 1420, screen: [0.43, 0.39] },
        { t: 1, at: [700, 440], units: 1250, screen: [0.4, 0.4] },
      ],
    },
  },
  {
    id: "rete",
    entryFraction: 0.72,
    // Frame the whole useful network, not the unused portion below it.
    phone: { at: [1120, 500], units: 1580, screen: [0.5, 0.36] },
    tablet: { at: [1120, 500], units: 1950, screen: [0.5, 0.38] },
  },
];

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

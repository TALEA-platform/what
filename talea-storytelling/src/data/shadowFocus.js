export const shadowScene = {
  opening: { center: [11.3430, 44.4980], zoom: 11.55 },

  stages: [
    {
      id: "overview",
      camera: { center: [11.3430, 44.4980], zoom: 12.1 },
    },
    {
      id: "centro",
      camera: { center: [11.3449, 44.4984], zoom: 13.35 },
    },
  ],
};


const WORDS_OF = (stage) =>
  (Array.isArray(stage.body) ? stage.body.join(" ") : stage.body)
    .trim()
    .split(/\s+/).length;

const READ_MS_BASE = 1200;
const READ_MS_PER_WORD = 118;
const READ_MS_MIN = 3600;
const READ_MS_MAX = 7000;

export const getShadowStageReadMs = (stages) =>
  stages.map((stage) =>
    Math.min(
      READ_MS_MAX,
      Math.max(READ_MS_MIN, READ_MS_BASE + READ_MS_PER_WORD * WORDS_OF(stage)),
    ),
  );


export const shadowMetricLayout = [
  { metricId: "shade", key: "shadow", tier: "lead", tone: "shadow" },
  { metricId: "hotspot", key: "hotspot", tier: "lead", tone: "hot" },
  { metricId: "vegetation", key: "ndvi", tier: "support", tone: "green" },
  {
    metricId: "absorbing-surfaces",
    key: "albedo",
    tier: "support",
    tone: "dark",
  },
];

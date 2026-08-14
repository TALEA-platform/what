import climateReliefStats from "../generated/climate-relief-stats.json";

export const rifugioStepSpecs = [
  { id: "start", tone: "key" },
  { id: "natural-shade", tone: "key" },
  { id: "continuous-shade", tone: "key" },
  { id: "rest", tone: "key" },
  { id: "water", tone: "key" },
  { id: "living-ground", tone: "key" },
  { id: "accessibility", tone: "key" },
  { id: "complete", tone: "prose" },
];

export const rifugioTempSpots = [
  { id: "sun", from: 0, until: 1, tone: "sun", value: "36°" },
  { id: "shade", from: 1, until: 2, tone: "shade", value: "34°" },
  { id: "portico", from: 2, until: 4, tone: "portico", value: "33°" },
  { id: "water", from: 4, until: 6, tone: "water", value: "32°" },
  { id: "final", from: 6, tone: "final", value: "31°" },
];

export const rifugiCounts = {
  official: climateReliefStats.officialRefuges.total,
  indoor: climateReliefStats.officialRefuges.indoor,
  outdoor: climateReliefStats.officialRefuges.outdoor,
  compatible: climateReliefStats.csi.distinctPlaces,
  compatibleFeatures: climateReliefStats.csi.selectedFeatures,
};

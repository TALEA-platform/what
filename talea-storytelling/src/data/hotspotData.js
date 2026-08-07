import { assetUrl } from "../lib/assetUrl";

export const HOTSPOT_DATA_VERSION = "top10pct-bologna-20260702";

export const hotspotPersistenceThresholds = Array.from(
  { length: 13 },
  (_, index) => index + 1
);

export function getHotspotGeojsonUrl(threshold) {
  return assetUrl(`/data/hotspots/hotspots_ge_${threshold}.geojson?v=${HOTSPOT_DATA_VERSION}`);
}

export const CSI_MIN_AREA_HA = 0.5;
export const CSI_MIN_NDVI = 0.4;

const CSI_AREA_KEYS = ["area_Ha", "area_ha", "AREA_HA"];
const CSI_NDVI_KEYS = ["NDVI", "ndvi"];

function firstDefined(properties, keys) {
  for (const key of keys) {
    if (properties?.[key] !== null && properties?.[key] !== undefined) {
      return properties[key];
    }
  }
  return undefined;
}

export function toFiniteNumber(value) {
  if (value === null || value === undefined) return NaN;
  const normalized =
    typeof value === "string" ? value.replace(",", ".") : value;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : NaN;
}

export function csiAreaHectares(properties) {
  return toFiniteNumber(firstDefined(properties, CSI_AREA_KEYS));
}

export function csiNdvi(properties) {
  return toFiniteNumber(firstDefined(properties, CSI_NDVI_KEYS));
}

export function csiPlaceName(properties, fallback = "") {
  return (
    properties?.Nome ||
    properties?.nome ||
    properties?.name ||
    properties?.Name ||
    properties?.denominazione ||
    properties?.DESCRIZIONE ||
    properties?.area_stati ||
    properties?.stat_area_name ||
    properties?.zona ||
    properties?.Zona ||
    fallback
  );
}

export function selectCsiFeatures(geojson) {
  const features = (geojson?.features || []).filter((feature) => {
    if (!feature.geometry) return false;
    return (
      csiAreaHectares(feature.properties) > CSI_MIN_AREA_HA &&
      csiNdvi(feature.properties) > CSI_MIN_NDVI
    );
  });
  return { type: "FeatureCollection", features };
}

export function countDistinctCsiPlaces(geojson) {
  const names = new Set();
  for (const feature of geojson?.features || []) {
    const name = String(csiPlaceName(feature.properties || {}))
      .trim()
      .toLowerCase();
    if (name) names.add(name);
  }
  return names.size;
}

export function deriveOfficialRefugeCounts(geojson) {
  const features = geojson?.features || [];
  const indoor = features.filter(
    (feature) => feature.properties?.ambiente === "interno",
  ).length;
  return {
    total: features.length,
    indoor,
    outdoor: features.length - indoor,
  };
}

export async function loadReliefSources(loadCsi, loadOfficial) {
  const [csiResult, officialResult] = await Promise.allSettled([
    Promise.resolve().then(loadCsi),
    Promise.resolve().then(loadOfficial),
  ]);
  return {
    csi: csiResult.status === "fulfilled" ? csiResult.value : null,
    official:
      officialResult.status === "fulfilled" ? officialResult.value : null,
    errors: {
      csi: csiResult.status === "rejected" ? csiResult.reason : null,
      official:
        officialResult.status === "rejected" ? officialResult.reason : null,
    },
  };
}

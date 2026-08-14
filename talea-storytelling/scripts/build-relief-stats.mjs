import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CSI_MIN_AREA_HA,
  countDistinctCsiPlaces,
  csiAreaHectares,
  csiNdvi,
  csiPlaceName,
  deriveOfficialRefugeCounts,
  selectCsiFeatures,
} from "../src/data/reliefData.js";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const csiPath = path.join(
  projectRoot,
  "public",
  "data",
  "vectors",
  "csi.geojson",
);
const officialPath = path.join(
  projectRoot,
  "src",
  "data",
  "rifugi_ufficiali.geojson",
);
const outputPath = path.join(
  projectRoot,
  "src",
  "generated",
  "climate-relief-stats.json",
);

function dataError(dataset, message) {
  return new Error(`${dataset} validation failed: ${message}`);
}

async function readJson(filePath, dataset) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    throw dataError(dataset, `cannot parse ${path.relative(projectRoot, filePath)}: ${error.message}`);
  }
}

function requireFeatureCollection(value, dataset) {
  if (!value || value.type !== "FeatureCollection") {
    throw dataError(dataset, 'expected GeoJSON type "FeatureCollection"');
  }
  if (!Array.isArray(value.features)) {
    throw dataError(dataset, "features must be an array");
  }
  if (value.features.length === 0) {
    throw dataError(dataset, "features must not be empty");
  }
  return value;
}

function validateCsi(geojson) {
  geojson.features.forEach((feature, index) => {
    const location = `feature ${index}`;
    if (!feature || feature.type !== "Feature") {
      throw dataError("CSI", `${location}: expected GeoJSON Feature`);
    }
    if (!feature.properties || typeof feature.properties !== "object") {
      throw dataError("CSI", `${location}: properties are missing`);
    }

    const area = csiAreaHectares(feature.properties);
    const ndvi = csiNdvi(feature.properties);
    if (!Number.isFinite(area)) {
      throw dataError("CSI", `${location}: area_Ha must be numeric`);
    }
    if (feature.properties.NDVI != null && !Number.isFinite(ndvi)) {
      throw dataError("CSI", `${location}: NDVI must be numeric when present`);
    }
    if (area > CSI_MIN_AREA_HA) {
      if (!Number.isFinite(ndvi)) {
        throw dataError(
          "CSI",
          `${location}: NDVI is required when area_Ha > ${CSI_MIN_AREA_HA}`,
        );
      }
      if (!feature.geometry) {
        throw dataError(
          "CSI",
          `${location}: geometry is required for a selection candidate`,
        );
      }
    }
  });

  const selected = selectCsiFeatures(geojson);
  if (selected.features.length === 0) {
    throw dataError("CSI", "selection produced no features");
  }
  selected.features.forEach((feature, index) => {
    if (!String(csiPlaceName(feature.properties || {})).trim()) {
      throw dataError("CSI", `selected feature ${index}: place name is missing`);
    }
  });

  const distinctPlaces = countDistinctCsiPlaces(selected);
  if (distinctPlaces === 0) {
    throw dataError("CSI", "distinct-place count is zero");
  }
  return {
    selectedFeatures: selected.features.length,
    distinctPlaces,
  };
}

function validateOfficialRefuges(geojson) {
  const supportedEnvironments = new Set(["interno", "esterno"]);
  geojson.features.forEach((feature, index) => {
    const location = `feature ${index}`;
    if (!feature || feature.type !== "Feature") {
      throw dataError("Official refuges", `${location}: expected GeoJSON Feature`);
    }
    if (!feature.geometry || feature.geometry.type !== "Point") {
      throw dataError("Official refuges", `${location}: expected Point geometry`);
    }
    const environment = feature.properties?.ambiente;
    if (!supportedEnvironments.has(environment)) {
      throw dataError(
        "Official refuges",
        `${location}: ambiente must be "interno" or "esterno"`,
      );
    }
  });

  const counts = deriveOfficialRefugeCounts(geojson);
  const metadataCount = Number(geojson.metadata?.conteggio);
  if (!Number.isInteger(metadataCount)) {
    throw dataError("Official refuges", "metadata.conteggio must be an integer");
  }
  if (metadataCount !== counts.total) {
    throw dataError(
      "Official refuges",
      `metadata.conteggio is ${metadataCount}, but the file has ${counts.total} features`,
    );
  }
  return counts;
}

const csi = requireFeatureCollection(await readJson(csiPath, "CSI"), "CSI");
const official = requireFeatureCollection(
  await readJson(officialPath, "Official refuges"),
  "Official refuges",
);
const output = {
  schemaVersion: 1,
  officialRefuges: validateOfficialRefuges(official),
  csi: validateCsi(csi),
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

console.log(
  `ClimateRelief stats built: ${output.officialRefuges.total} official ` +
    `(${output.officialRefuges.indoor} indoor, ${output.officialRefuges.outdoor} outdoor); ` +
    `${output.csi.selectedFeatures} CSI features / ${output.csi.distinctPlaces} places`,
);

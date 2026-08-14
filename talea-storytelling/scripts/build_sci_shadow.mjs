import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { feature } from "topojson-client";

import { requireDataInput, resolveDataInput } from "./lib/data-inputs.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public/data/shadow-focus/bologna_shadow_lines.geojson");

const MONTHS = ["202506", "202507", "202508"];
const LAYERS = [
  {
    kind: "g",
    folder: "green_areas",
    inputIds: {
      "202506": "sciGreenAreas202506",
      "202507": "sciGreenAreas202507",
      "202508": "sciGreenAreas202508",
    },
  },
  {
    kind: "s",
    folder: "street",
    inputIds: {
      "202506": "sciStreets202506",
      "202507": "sciStreets202507",
      "202508": "sciStreets202508",
    },
  },
];
const SCI_INPUT_IDS = LAYERS.flatMap((layer) => Object.values(layer.inputIds));

const SIMPLIFY_TOL = 3e-5;
const MIN_AREA = 4e-9;
const COORD_DP = 5;

const roundc = (n) => Math.round(n * 10 ** COORD_DP) / 10 ** COORD_DP;

function perpDist([x, y], [x1, y1], [x2, y2]) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(x - x1, y - y1);
  const t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy);
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

function douglasPeucker(points, tol) {
  if (points.length < 3) return points;
  let dmax = 0;
  let idx = 0;
  const end = points.length - 1;
  for (let i = 1; i < end; i++) {
    const d = perpDist(points[i], points[0], points[end]);
    if (d > dmax) {
      dmax = d;
      idx = i;
    }
  }
  if (dmax > tol) {
    const left = douglasPeucker(points.slice(0, idx + 1), tol);
    const right = douglasPeucker(points.slice(idx), tol);
    return left.slice(0, -1).concat(right);
  }
  return [points[0], points[end]];
}

function ringArea(ring) {
  let a = 0;
  for (let i = 0, n = ring.length, j = n - 1; i < n; j = i++) {
    a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return Math.abs(a) / 2;
}

function simplifyRing(ring) {
  let r = douglasPeucker(ring, SIMPLIFY_TOL).map(([x, y]) => [roundc(x), roundc(y)]);
  if (r.length < 4) return null;
  const [fx, fy] = r[0];
  const [lx, ly] = r[r.length - 1];
  if (fx !== lx || fy !== ly) r.push([fx, fy]);
  return r;
}

function simplifyPolygon(rings) {
  const out = [];
  for (const ring of rings) {
    const r = simplifyRing(ring);
    if (r) out.push(r);
  }
  return out.length ? out : null;
}

function simplifyGeometry(geom) {
  if (geom.type === "Polygon") {
    const p = simplifyPolygon(geom.coordinates);
    return p ? { type: "Polygon", coordinates: p } : null;
  }
  if (geom.type === "MultiPolygon") {
    const polys = [];
    for (const poly of geom.coordinates) {
      const p = simplifyPolygon(poly);
      if (p) polys.push(p);
    }
    return polys.length ? { type: "MultiPolygon", coordinates: polys } : null;
  }
  return null;
}

function outerArea(geom) {
  if (geom.type === "Polygon") return ringArea(geom.coordinates[0]);
  if (geom.type === "MultiPolygon") return geom.coordinates.reduce((s, p) => s + ringArea(p[0]), 0);
  return 0;
}

function loadMonth(inputIds, month) {
  const file = resolveDataInput(inputIds[month]);
  const topo = JSON.parse(fs.readFileSync(file, "utf8"));
  return feature(topo, topo.objects.data).features;
}

function buildLayer({ kind, folder, inputIds }) {
  const sums = new Map();
  for (const month of MONTHS) {
    for (const f of loadMonth(inputIds, month)) {
      const id = f.properties.feature_idx;
      const m = f.properties.mean;
      if (id == null || typeof m !== "number") continue;
      const e = sums.get(id) ?? { sum: 0, n: 0 };
      e.sum += m;
      e.n += 1;
      sums.set(id, e);
    }
  }

  const base = loadMonth(inputIds, MONTHS[0]);
  const out = [];
  let dropped = 0;
  for (const f of base) {
    const id = f.properties.feature_idx;
    const agg = sums.get(id);
    if (!agg) continue;
    if (outerArea(f.geometry) < MIN_AREA) {
      dropped += 1;
      continue;
    }
    const geom = simplifyGeometry(f.geometry);
    if (!geom) {
      dropped += 1;
      continue;
    }
    out.push({
      type: "Feature",
      properties: { k: kind, s: Math.round((agg.sum / agg.n) * 1000) / 1000 },
      geometry: geom,
    });
  }
  console.log(`  ${folder}: kept ${out.length}, dropped ${dropped}`);
  return out;
}

function main() {
  for (const inputId of SCI_INPUT_IDS) requireDataInput(inputId);
  console.log("-> SCI shadow (peak thermal, summer mean) → slim GeoJSON");
  const features = [];
  for (const layer of LAYERS) features.push(...buildLayer(layer));
  const fc = { type: "FeatureCollection", features };
  const json = JSON.stringify(fc);
  fs.writeFileSync(OUT, json);
  console.log(`-> wrote ${path.relative(ROOT, OUT)} (${(json.length / 1048576).toFixed(2)} MB, ${features.length} features)`);
}

main();

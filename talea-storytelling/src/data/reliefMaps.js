
import maplibregl from "maplibre-gl";
import { assetUrl } from "../lib/assetUrl";
import {
  countDistinctCsiPlaces,
  csiPlaceName,
  selectCsiFeatures,
  toFiniteNumber,
} from "./reliefData";

const csiUrl = assetUrl("/data/vectors/csi.geojson");
const bolognaBoundaryUrl = assetUrl("/data/vectors/bologna_boundary_outline.geojson");
import rifugiUfficialiUrl from "./rifugi_ufficiali.geojson?url";

const COLORS = {
  green: "#21A84A",
  darkGreen: "#004d19",
  yellow: "#FFE604",
};

const EASE_OUT = (t) => 1 - Math.pow(1 - t, 3);

export const BASEMAP_STYLE = {
  version: 8,
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {},
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#dfe6da" } },
  ],
};

export function lockCamera(map) {
  map.scrollZoom.disable();
  map.boxZoom.disable();
  map.doubleClickZoom.disable();
  map.dragRotate.disable();
  map.dragPan.disable();
  map.keyboard.disable();
  map.touchZoomRotate.disable();
  map.touchPitch?.disable?.();
}

export const EXPLORE_ZOOM_LIMITS = { minZoom: 10.4, maxZoom: 16.6 };

export const ORTHOPHOTO_TILES = [
  "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
];

export const BOLOGNA_CENTER = [11.343, 44.494];
export const RELIEF_STORY_CAMERA = { center: [11.344, 44.498], zoom: 11.6, pitch: 0, bearing: 0 };
export const FOCUS_MAX_ZOOM = 15.1;
export const ADDRESS_ZOOM = 15.4;
const VALHALLA_BASE = "https://valhalla1.openstreetmap.de";
const VALHALLA_CLIENT_ID = "talea-storytelling";


export const toNumber = toFiniteNumber;

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} ${r.status}`);
  return r.json();
}

function asGeoJSON(data) {
  if (!data) return null;
  if (data.type === "FeatureCollection") return data;
  if (Array.isArray(data.features)) return { type: "FeatureCollection", features: data.features };
  return data;
}


function extendBounds(coords, b) {
  if (!coords) return;
  if (typeof coords[0] === "number") b.extend(coords);
  else coords.forEach((c) => extendBounds(c, b));
}

export function boundsForFeature(feature) {
  const b = new maplibregl.LngLatBounds();
  if (feature && feature.geometry) extendBounds(feature.geometry.coordinates, b);
  return b;
}

function boundsForCollection(geojson) {
  const b = new maplibregl.LngLatBounds();
  (geojson?.features || []).forEach((f) => extendBounds(f.geometry && f.geometry.coordinates, b));
  return b;
}

export function featureCenter(feature) {
  if (!feature || !feature.geometry) return BOLOGNA_CENTER;
  if (feature.geometry.type === "Point") return feature.geometry.coordinates;
  const b = boundsForFeature(feature);
  if (b.isEmpty()) return BOLOGNA_CENTER;
  const c = b.getCenter();
  return [c.lng, c.lat];
}

export function haversine(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}


export function setOverviewFrame(map, geojson, padding = 44) {
  const b = boundsForCollection(geojson);
  if (!b.isEmpty()) {
    map._reliefBounds = b;
    map._reliefPad = padding;
  }
}

const RESET_MAP_PADDING = { top: 0, right: 0, bottom: 0, left: 0 };

export function frameOverview(map, duration = 0, options = {}) {
  if (!map) return;
  const { resetPadding = false } = options;
  const b = map._reliefBounds;
  if (!b || b.isEmpty()) {
    map.flyTo({
      ...RELIEF_STORY_CAMERA,
      ...(resetPadding ? { padding: RESET_MAP_PADDING } : {}),
      duration,
      essential: true,
    });
    return;
  }
  const fitOptions = {
    padding: map._reliefPad ?? 44,
    maxZoom: 12.4,
  };
  if (resetPadding) {
    const overviewCamera = map.cameraForBounds(b, fitOptions);
    if (!overviewCamera) return;
    map.flyTo({
      ...overviewCamera,
      padding: RESET_MAP_PADDING,
      duration,
      essential: true,
      easing: EASE_OUT,
    });
    return;
  }
  map.fitBounds(b, {
    ...fitOptions,
    duration,
    essential: true,
    easing: EASE_OUT,
  });
}

export function flyToFeature(map, feature, opts = {}) {
  const { maxZoom = FOCUS_MAX_ZOOM, padding = 96, duration = 1500 } = opts;
  const b = boundsForFeature(feature);
  if (b.isEmpty()) return;
  map.fitBounds(b, { padding, maxZoom, duration, essential: true, easing: EASE_OUT });
}

export function boundsForFeatures(features) {
  const b = new maplibregl.LngLatBounds();
  (features || []).forEach((f) => f && f.geometry && extendBounds(f.geometry.coordinates, b));
  return b;
}

export function flyToFeatures(map, features, opts = {}) {
  const { maxZoom = FOCUS_MAX_ZOOM, padding = 96, duration = 1500 } = opts;
  const b = boundsForFeatures(features);
  if (b.isEmpty()) return;
  map.fitBounds(b, { padding, maxZoom, duration, essential: true, easing: EASE_OUT });
}

export function flyToPoint(map, pt, opts = {}) {
  const { zoom = ADDRESS_ZOOM, duration = 1600 } = opts;
  map.flyTo({ center: pt, zoom, duration, essential: true, curve: 1.5 });
}

export function flyToWalkingRoutes(map, pt, routes, opts = {}) {
  const b = new maplibregl.LngLatBounds();
  if (pt) b.extend(pt);
  for (const route of routes || []) {
    for (const coord of route.coordinates || []) b.extend(coord);
  }
  if (b.isEmpty()) return flyToPoint(map, pt, opts);
  const narrow = typeof window !== "undefined" && window.innerWidth <= 860;
  map.fitBounds(b, {
    padding: narrow
      ? { top: 82, right: 38, bottom: 230, left: 38 }
      : { top: 96, right: 96, bottom: 96, left: 440 },
    maxZoom: opts.maxZoom ?? ADDRESS_ZOOM,
    duration: opts.duration ?? 1500,
    essential: true,
    easing: EASE_OUT,
  });
}


function firstSymbolLayerId(map) {
  const layers = map.getStyle().layers || [];
  const symbol = layers.find((l) => l.type === "symbol");
  return symbol && symbol.id;
}

export function addOrthophoto(map, options = {}) {
  if (map.getSource("ortofoto")) return;
  const damped = options.damped === true;
  map.addSource("ortofoto", {
    type: "raster",
    tiles: ORTHOPHOTO_TILES,
    tileSize: 256,
    attribution: "Ortofoto/imagery © Esri, Maxar, Earthstar Geographics e altri provider",
  });
  map.addLayer(
    {
      id: "ortofoto",
      type: "raster",
      source: "ortofoto",
      paint: {
        "raster-opacity": 1,
        "raster-saturation": damped ? -0.55 : -0.26,
        "raster-contrast": damped ? -0.04 : 0.04,
        ...(damped ? { "raster-brightness-max": 0.85 } : {}),
      },
    },
    firstSymbolLayerId(map),
  );
}

export function fadeInPaint(map, layerId, prop, target, duration = 900, delay = 120) {
  if (!map.getLayer(layerId)) return;
  map.setPaintProperty(layerId, `${prop}-transition`, { duration: 0 });
  map.setPaintProperty(layerId, prop, 0);
  requestAnimationFrame(() => {
    if (!map.getLayer(layerId)) return;
    map.setPaintProperty(layerId, `${prop}-transition`, { duration, delay });
    map.setPaintProperty(layerId, prop, target);
  });
}

export function addBolognaBoundary(map, prefix = "relief", options = {}) {
  const sourceId = `${prefix}-bologna-boundary`;
  const glowId = `${prefix}-bologna-boundary-glow`;
  const lineId = `${prefix}-bologna-boundary-line`;
  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, { type: "geojson", data: bolognaBoundaryUrl });
  }
  if (!map.getLayer(glowId)) {
    map.addLayer({
      id: glowId,
      type: "line",
      source: sourceId,
      paint: {
        "line-color": "rgba(255, 255, 255, 0.9)",
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 5, 14, 9],
        "line-blur": 1.4,
        "line-opacity": options.glowOpacity ?? 0.7,
      },
    });
  }
  if (!map.getLayer(lineId)) {
    map.addLayer({
      id: lineId,
      type: "line",
      source: sourceId,
      paint: {
        "line-color": options.color ?? COLORS.yellow,
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1.4, 14, 2.6],
        "line-opacity": options.opacity ?? 0.85,
        "line-dasharray": [2.4, 2],
      },
    });
  }
}


function getName(p, fallback = "") {
  return csiPlaceName(p, fallback);
}

const LOWER_WORDS = new Set(["di", "del", "della", "dei", "delle", "degli", "da", "e", "in", "al", "ai", "la", "le", "il", "lo"]);

export function prettyName(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (!s) return "";
  return s
    .split(/\s+/)
    .map((w, i) =>
      i > 0 && LOWER_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(" ");
}

function metricVal(p, keys) {
  for (const k of keys) {
    const v = toNumber(p[k]);
    if (!Number.isNaN(v)) return v;
  }
  return NaN;
}

function csiOf(p) {
  return metricVal(p, ["CSI", "csi", "CSI_avg", "csi_avg"]);
}

function hasAmenity(v) {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "yes" || s === "si" || s === "sì" || s === "true" || s === "1";
}

const GREEN_TYPE_IDS = {
  "PARCO ESTENSIVO": "urbanPark",
  PARCO: "park",
  GIARDINO: "neighborhoodGarden",
  "VERDE SCOLASTICO": "schoolGreen",
  "VERDE SPORTIVO": "sportsGreen",
};

function prettyParkType(p, labels) {
  const raw = String(p.classe_uni || p.classe_gia || "").trim().toUpperCase();
  return labels[GREEN_TYPE_IDS[raw] || "greenSpace"];
}

const OFFICIAL_TYPE_IDS = {
  Biblioteca: "library",
  "Biblioteca pubblica": "publicLibrary",
  "Casa di quartiere": "communityCenter",
  "Casa di quartiere e parco pubblico": "communityCenterAndPark",
  "Cortile interno": "internalCourtyard",
  "Giardino pubblico": "publicGarden",
  "Luogo multifunzionale": "multifunctionalVenue",
  Museo: "museum",
  "Parco pubblico": "publicPark",
  "Piazza coperta": "coveredSquare",
};

function officialTypeLabel(rawType, labels) {
  return labels[OFFICIAL_TYPE_IDS[String(rawType || "").trim()]] || rawType || "";
}

// This threshold selects six rare high-CSI features in the current snapshot (D11).
function isStandoutRifugio(csi) {
  return !Number.isNaN(csi) && csi >= 0.7;
}

const STREET_VIEW_OFFSET_M = 15;
const M_PER_DEG_LAT = 110540;
const M_PER_DEG_LON = 111320;

function eachPosition(coords, fn) {
  if (!coords) return;
  if (typeof coords[0] === "number") fn(coords);
  else coords.forEach((c) => eachPosition(c, fn));
}

function bearingDeg(from, to) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLon = toRad(to[0] - from[0]);
  const y = Math.sin(dLon) * Math.cos(toRad(to[1]));
  const x =
    Math.cos(toRad(from[1])) * Math.sin(toRad(to[1])) -
    Math.sin(toRad(from[1])) * Math.cos(toRad(to[1])) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function streetViewViewpoint(feature) {
  const center = featureCenter(feature);
  const geometry = feature?.geometry;
  if (!geometry || geometry.type === "Point") return { pt: center, look: center };

  let edge = null;
  let bestD = Infinity;
  eachPosition(geometry.coordinates, (p) => {
    const d = haversine(center, p);
    if (d < bestD) {
      bestD = d;
      edge = p;
    }
  });
  if (!edge) return { pt: center, look: center };

  const lonScale = Math.cos((center[1] * Math.PI) / 180) * M_PER_DEG_LON;
  const mx = (edge[0] - center[0]) * lonScale;
  const my = (edge[1] - center[1]) * M_PER_DEG_LAT;
  const len = Math.hypot(mx, my);
  if (!len) return { pt: edge, look: center };
  return {
    pt: [
      edge[0] + ((mx / len) * STREET_VIEW_OFFSET_M) / lonScale,
      edge[1] + ((my / len) * STREET_VIEW_OFFSET_M) / M_PER_DEG_LAT,
    ],
    look: center,
  };
}

export function streetViewURL(feature) {
  const { pt, look } = streetViewViewpoint(feature);
  const params = new URLSearchParams({
    api: "1",
    map_action: "pano",
    viewpoint: `${pt[1].toFixed(6)},${pt[0].toFixed(6)}`,
    heading: String(Math.round(bearingDeg(pt, look))),
    pitch: "0",
    fov: "90",
  });
  return `https://www.google.com/maps/@?${params.toString()}`;
}


export function popupRifugioHTML(feature, copy) {
  const p = feature.properties || {};
  return `<div class="story-popup"><strong>${prettyName(getName(p, copy.green.fallbackName))}</strong><span>${prettyParkType(p, copy.green.typeLabels)} · ${copy.tapForDetails}</span></div>`;
}

export function rifugiDetailHTML(feature, copy, locale) {
  const p = feature.properties || {};
  const green = copy.green;
  const csi = csiOf(p);
  const area = metricVal(p, ["area_Ha", "area_ha", "ha", "AREA_HA", "superficie", "area"]);
  const areaHa = Number.isNaN(area) ? NaN : area > 1000 ? area / 10000 : area;
  const district = String(p.quartiere || p.quart || "").trim();
  const place = String(p.ubicazione || "").trim();

  const metaParts = [district ? `${green.districtPrefix} ${district}` : "", place].filter(Boolean);
  if (!Number.isNaN(areaHa) && areaHa >= 1) {
    const formattedArea = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(areaHa);
    metaParts.push(green.areaTemplate.replace("{n}", formattedArea));
  }

  const offers = [];
  if (hasAmenity(p.d_fountain)) offers.push(green.amenities.fountain);
  if (hasAmenity(p.benches)) offers.push(green.amenities.benches);
  if (hasAmenity(p.picnic_tab)) offers.push(green.amenities.picnicTables);

  return `<div class="r-card">
    <strong class="r-card-name">${prettyName(getName(p, green.fallbackName))}</strong>
    <span class="r-card-meta">${metaParts.join(" · ")}</span>
    ${offers.length ? `<span class="r-card-offers">${offers.join(" · ")}</span>` : ""}
    ${isStandoutRifugio(csi) ? `<span class="r-card-foot r-card-foot--standout">${green.standout}</span>` : ""}
    <a class="r-card-street" href="${streetViewURL(feature)}" target="_blank" rel="noopener noreferrer">${green.streetViewCta} →</a>
  </div>`;
}


export function popupUfficialeHTML(feature, copy) {
  const p = feature.properties || {};
  return `<div class="story-popup story-popup--ufficiale"><strong>${prettyName(p.nome || "")}</strong><span>${copy.official.popupType} · ${copy.tapForDetails}</span></div>`;
}

function stripLabel(value, label) {
  const s = String(value || "").trim();
  const re = new RegExp(`^${label}\\s+`, "i");
  return s.replace(re, "");
}

function toiletCost(value, copy) {
  const s = String(value || "").trim().toLowerCase();
  if (!s) return "";
  if (s.includes("gratuit")) return copy.toiletsFree;
  if (s.includes("pagamento") || s.includes("solo per gli utenti")) {
    return copy.toiletsNotFree;
  }
  // Unrecognized source text stays unknown instead of being inferred as free or paid.
  return copy.toiletsUnknown;
}

function factRowHTML(label, value) {
  if (!value) return "";
  return `<div class="r-fact"><span class="r-fact-key">${label}</span><span class="r-fact-val">${value}</span></div>`;
}

export function ufficialeDetailHTML(feature, copy) {
  const p = feature.properties || {};
  const official = copy.official;
  const meta = [
    officialTypeLabel(p.tipo, official.typeLabels),
    p.quartiere ? `${official.districtPrefix} ${p.quartiere}` : "",
    p.indirizzo,
  ].filter(Boolean);

  return `<div class="r-card r-card--ufficiale">
    <span class="r-card-badge">${official.badge}${
      p.ambiente === "interno" ? ` · ${official.indoor}` : ` · ${official.outdoor}`
    }</span>
    <strong class="r-card-name">${prettyName(p.nome || "")}</strong>
    <span class="r-card-meta">${meta.join(" · ")}</span>
    <div class="r-facts">
      ${factRowHTML(official.waterLabel, stripLabel(p.acqua, "acqua"))}
      ${factRowHTML(official.toiletsLabel, toiletCost(p.bagni, official))}
    </div>
    ${p.orari ? `<a class="r-card-hours" href="${p.orari}" target="_blank" rel="noopener noreferrer">${official.openingHours} →</a>` : ""}
  </div>`;
}

function numberTemplate(template, value) {
  return template.replace("{n}", String(value));
}

function fmtDistance(d, copy, locale) {
  if (!Number.isFinite(d)) return "";
  if (d <= 20) return copy.alreadyThere;
  if (d >= 1000) {
    const kilometers = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(d / 1000);
    return numberTemplate(copy.kilometersTemplate, kilometers);
  }
  return numberTemplate(copy.metersTemplate, Math.round(d / 10) * 10);
}

function fmtWalkTime(seconds, copy) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const minutes = Math.max(1, Math.round(seconds / 60));
  return numberTemplate(copy.walkMinutesTemplate, minutes);
}

function nearRowHTML(name, d, seconds, copy, locale) {
  const bits = [
    fmtDistance(d, copy, locale),
    fmtWalkTime(seconds, copy),
  ].filter(Boolean);
  return `<span class="r-near-item">${name}<em>${bits.join(" · ")}</em></span>`;
}

export function nearbyCardHTML({ label, ufficiale, verdi, copy, locale }) {
  const nearby = copy.nearby;
  const blocks = [];
  if (ufficiale) {
    blocks.push(`<div class="r-near">
      <span class="r-near-head">${nearby.nearestOfficial}</span>
      ${nearRowHTML(prettyName(ufficiale.f.properties?.nome || ""), ufficiale.d, ufficiale.time, nearby, locale)}
    </div>`);
  }
  if (verdi && verdi.length) {
    blocks.push(`<div class="r-near">
      <span class="r-near-head">${nearby.greenNearby}</span>
      ${verdi.map((x) => nearRowHTML(prettyName(getName(x.f.properties || {}, copy.green.fallbackName)), x.d, x.time, nearby, locale)).join("")}
    </div>`);
  }
  return `<div class="r-card r-card--near">
    <strong class="r-card-name">${label || nearby.searchedPointFallback}</strong>
    ${blocks.join("") || `<span class="r-card-meta">${nearby.noneReachable}</span>`}
    <span class="r-card-foot">${nearby.routeSource}</span>
  </div>`;
}


let rifugiData = null;

export function getRifugiData() {
  return rifugiData;
}

export async function loadRifugiData() {
  if (rifugiData) return rifugiData;
  const parks = asGeoJSON(await fetchJSON(csiUrl));
  rifugiData = selectCsiFeatures(parks);
  if (!rifugiData.features.length) {
    rifugiData = null;
    throw new Error("csi.geojson non contiene spazi compatibili selezionabili");
  }
  return rifugiData;
}

// Research-scored green spaces and municipally designated refuges remain separate.
let ufficialiData = null;

export async function loadRifugiUfficiali() {
  if (ufficialiData) return ufficialiData;
  ufficialiData = asGeoJSON(await fetchJSON(rifugiUfficialiUrl));
  return ufficialiData;
}

export function getRifugiUfficiali() {
  return ufficialiData;
}

export function countRifugi(geojson) {
  return countDistinctCsiPlaces(geojson);
}


// A flat fill avoids implying readable precision in the highly skewed CSI distribution (D11).
const RIFUGI_FILL_COLOR = COLORS.green;

export function addRifugiLayers(map, geojson, prefix, options = {}) {
  const sourceId = `${prefix}-rifugi`;
  if (map.getSource(sourceId)) return;
  const lineWidth = options.lineWidth ?? 2.2;
  map._rifugiFillTarget = options.fillOpacity ?? 0.5;
  map.addSource(sourceId, { type: "geojson", data: geojson });
  map.addLayer({
    id: `${prefix}-rifugi-fill`,
    type: "fill",
    source: sourceId,
    paint: {
      "fill-color": RIFUGI_FILL_COLOR,
      "fill-opacity": options.fillOpacity ?? 0.5,
    },
  });
  map.addLayer({
    id: `${prefix}-rifugi-line-casing`,
    type: "line",
    source: sourceId,
    paint: {
      "line-color": "rgba(255,255,255,.9)",
      "line-width": lineWidth + 2.2,
      "line-opacity": options.lineOpacity ?? 0.85,
    },
  });
  map.addLayer({
    id: `${prefix}-rifugi-line`,
    type: "line",
    source: sourceId,
    paint: {
      "line-color": COLORS.darkGreen,
      "line-width": lineWidth,
      "line-opacity": options.lineOpacity ?? 1,
    },
  });
}

const WAVE_MS = 1600;
const WAVE_EDGE = 0.15;

export function withWaveOrder(geojson, center) {
  const feats = geojson?.features || [];
  const scored = feats.map((f) => ({ f, d: f.geometry ? haversine(center, featureCenter(f)) : 0 }));
  const max = scored.reduce((m, x) => (Number.isFinite(x.d) && x.d > m ? x.d : m), 0) || 1;
  return {
    type: "FeatureCollection",
    features: scored.map(({ f, d }) => ({
      type: "Feature",
      geometry: f.geometry,
      properties: {
        ...(f.properties || {}),
        __wave: Number.isFinite(d) ? d / max : 1,
        __key: rifugioKey(f.properties || {}),
      },
    })),
  };
}

export function runRifugiWave(map, fillLayerId, target = 0.52, onDone) {
  if (!map.getLayer(fillLayerId)) return () => {};
  let frame = null;
  let cancelled = false;
  const t0 = performance.now();
  map.setPaintProperty(fillLayerId, "fill-opacity-transition", { duration: 0 });
  const step = () => {
    frame = null;
    if (cancelled || !map.getLayer(fillLayerId)) return;
    const p = Math.min(1, (performance.now() - t0) / WAVE_MS);
    const t = EASE_OUT(p) * (1 + WAVE_EDGE);
    map.setPaintProperty(fillLayerId, "fill-opacity", [
      "interpolate",
      ["linear"],
      ["coalesce", ["get", "__wave"], 0],
      t - WAVE_EDGE,
      target,
      t,
      0,
    ]);
    if (p < 1) frame = requestAnimationFrame(step);
    else {
      map.setPaintProperty(fillLayerId, "fill-opacity", target);
      onDone?.();
    }
  };
  frame = requestAnimationFrame(step);
  return () => {
    cancelled = true;
    if (frame) cancelAnimationFrame(frame);
  };
}

export function addUfficialiLayers(map, geojson, prefix) {
  const sourceId = `${prefix}-ufficiali`;
  if (map.getSource(sourceId)) return;
  map.addSource(sourceId, { type: "geojson", data: geojson });
  map.addLayer({
    id: `${prefix}-ufficiali-halo`,
    type: "circle",
    source: sourceId,
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 10.5, 4, 12, 6, 14, 13, 16, 20],
      "circle-color": "rgba(255,255,255,0.92)",
      "circle-blur": 0.55,
      "circle-opacity": ["interpolate", ["linear"], ["zoom"], 10.5, 0.16, 12, 0.25, 14, 0.54, 16, 0.68],
    },
  });
  map.addLayer({
    id: `${prefix}-ufficiali-dot`,
    type: "circle",
    source: sourceId,
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 10.5, 2.6, 12, 3.4, 14, 6.4, 16, 9.4],
      "circle-color": COLORS.darkGreen,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 10.5, 1, 14, 1.8, 16, 2.5],
      "circle-opacity": ["interpolate", ["linear"], ["zoom"], 10.5, 0.78, 12, 0.88, 14, 1],
      "circle-stroke-opacity": ["interpolate", ["linear"], ["zoom"], 10.5, 0.72, 12, 0.86, 14, 1],
    },
  });
  map.addLayer({
    id: `${prefix}-ufficiali-label`,
    type: "symbol",
    source: sourceId,
    minzoom: 13,
    layout: {
      "text-field": ["get", "__label"],
      "text-font": ["Noto Sans Bold"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 13, 11, 16, 13.5],
      "text-variable-anchor": ["top", "bottom", "left", "right"],
      "text-radial-offset": 1,
      "text-justify": "auto",
      "text-max-width": 9,
      "text-allow-overlap": false,
    },
    paint: {
      "text-color": "#0b3d20",
      "text-halo-color": "rgba(255,255,255,0.94)",
      "text-halo-width": 1.8,
    },
  });
}

export function addWalkingRouteLayers(map, prefix) {
  const sourceId = `${prefix}-walking-routes`;
  if (map.getSource(sourceId)) return;
  map.addSource(sourceId, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });
  map.addLayer({
    id: `${prefix}-walking-routes-casing`,
    type: "line",
    source: sourceId,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": "rgba(255,230,4,0.94)",
      "line-width": ["interpolate", ["linear"], ["zoom"], 11, 4.5, 14, 7, 16, 9],
      "line-opacity": 0.92,
      "line-blur": 0.35,
    },
  });
  map.addLayer({
    id: `${prefix}-walking-routes-line`,
    type: "line",
    source: sourceId,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": ["match", ["get", "kind"], "ufficiale", COLORS.darkGreen, COLORS.green],
      "line-width": ["interpolate", ["linear"], ["zoom"], 11, 2, 14, 3.5, 16, 4.8],
      "line-opacity": 0.98,
    },
  });
}

export function setWalkingRoutes(map, prefix, routes = []) {
  const source = map?.getSource(`${prefix}-walking-routes`);
  if (!source) return;
  source.setData({
    type: "FeatureCollection",
    features: routes
      .filter((route) => (route.coordinates || []).length >= 2)
      .map((route, index) => ({
        type: "Feature",
        geometry: { type: "LineString", coordinates: route.coordinates },
        properties: { kind: route.kind, index },
      })),
  });
}

export function withUfficialiLabels(geojson) {
  return {
    type: "FeatureCollection",
    features: (geojson?.features || []).map((f) => ({
      type: "Feature",
      geometry: f.geometry,
      properties: { ...(f.properties || {}), __label: prettyName(f.properties?.nome || "") },
    })),
  };
}

export function addUfficialeFocusLayer(map, prefix) {
  const sourceId = `${prefix}-ufficiale-focus`;
  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  }
  if (!map.getLayer(`${prefix}-ufficiale-focus-ring`)) {
    map.addLayer({
      id: `${prefix}-ufficiale-focus-ring`,
      type: "circle",
      source: sourceId,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 13, 16, 22],
        "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-color": COLORS.yellow,
        "circle-stroke-width": 3.4,
        "circle-stroke-opacity": 0.95,
      },
    });
  }
}

export function setUfficialeFocus(map, prefix, feature) {
  const source = map.getSource(`${prefix}-ufficiale-focus`);
  if (!source) return;
  source.setData({
    type: "FeatureCollection",
    features: feature ? [{ type: "Feature", geometry: feature.geometry, properties: {} }] : [],
  });
}

const CUTOUT_MS = 560;
const FOCUS_FILL_OPACITY = 0.22;

function layerExists(map, id) {
  try {
    return Boolean(map && map.getLayer(id));
  } catch {
    return false;
  }
}

function applyRifugiCutout(map, prefix, features) {
  const fillId = `${prefix}-rifugi-fill`;
  if (!layerExists(map, fillId)) return;
  const cutoutId = `${prefix}-rifugi-cutout`;
  const focusFillId = `${prefix}-rifugi-focus-fill`;

  const state = map._rifugiCutout || (map._rifugiCutout = {});
  if (state.frame) cancelAnimationFrame(state.frame);
  state.frame = null;

  const fade = (id, value, duration) => {
    if (!layerExists(map, id)) return;
    map.setPaintProperty(id, "fill-opacity-transition", { duration, delay: 0 });
    map.setPaintProperty(id, "fill-opacity", value);
  };

  const keys = [...new Set((features || []).map((f) => rifugioKey(f.properties || {})).filter(Boolean))];
  if (!keys.length) {
    map.setFilter(fillId, null);
    fade(cutoutId, 0, 0);
    fade(focusFillId, 0, 0);
    return;
  }

  fade(cutoutId, map._rifugiFillTarget ?? 0.5, 0);
  fade(focusFillId, FOCUS_FILL_OPACITY, 0);
  map.setFilter(fillId, ["match", ["coalesce", ["get", "__key"], ""], keys, false, true]);
  state.frame = requestAnimationFrame(() => {
    state.frame = null;
    fade(cutoutId, 0, CUTOUT_MS);
    fade(focusFillId, 0, CUTOUT_MS);
  });
}

export function addRifugiFocusLayers(map, prefix) {
  const sourceId = `${prefix}-rifugi-focus`;
  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  }
  if (!map.getLayer(`${prefix}-rifugi-cutout`)) {
    map.addLayer(
      {
        id: `${prefix}-rifugi-cutout`,
        type: "fill",
        source: sourceId,
        paint: { "fill-color": RIFUGI_FILL_COLOR, "fill-opacity": 0 },
      },
      map.getLayer(`${prefix}-rifugi-line-casing`) ? `${prefix}-rifugi-line-casing` : undefined,
    );
  }
  if (!map.getLayer(`${prefix}-rifugi-focus-fill`)) {
    map.addLayer({
      id: `${prefix}-rifugi-focus-fill`,
      type: "fill",
      source: sourceId,
      paint: { "fill-color": COLORS.yellow, "fill-opacity": 0 },
    });
  }
  if (!map.getLayer(`${prefix}-rifugi-focus-glow`)) {
    map.addLayer({
      id: `${prefix}-rifugi-focus-glow`,
      type: "line",
      source: sourceId,
      paint: {
        "line-color": COLORS.yellow,
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 6, 15, 12],
        "line-blur": 3,
        "line-opacity": 0.5,
      },
    });
  }
  if (!map.getLayer(`${prefix}-rifugi-focus-casing`)) {
    map.addLayer({
      id: `${prefix}-rifugi-focus-casing`,
      type: "line",
      source: sourceId,
      paint: {
        "line-color": COLORS.darkGreen,
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 6, 15, 9],
        "line-opacity": 0.85,
      },
    });
  }
  if (!map.getLayer(`${prefix}-rifugi-focus-line`)) {
    map.addLayer({
      id: `${prefix}-rifugi-focus-line`,
      type: "line",
      source: sourceId,
      paint: {
        "line-color": COLORS.yellow,
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 3.2, 15, 5.5],
        "line-opacity": 1,
      },
    });
  }
  if (!map.getLayer(`${prefix}-rifugi-focus-label`)) {
    map.addLayer({
      id: `${prefix}-rifugi-focus-label`,
      type: "symbol",
      source: sourceId,
      layout: {
        "text-field": ["get", "__label"],
        "text-font": ["Noto Sans Bold"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 11, 11.5, 15, 14],
        "text-variable-anchor": ["top", "bottom", "left", "right"],
        "text-radial-offset": 0.4,
        "text-justify": "auto",
        "text-max-width": 9,
      },
      paint: {
        "text-color": "#0b3d20",
        "text-halo-color": "rgba(255,255,255,0.94)",
        "text-halo-width": 1.7,
      },
    });
  }
}

export function setRifugiFocus(map, prefix, features = [], fallbackName = "") {
  const source = map.getSource(`${prefix}-rifugi-focus`);
  if (!source) return;
  const list = (Array.isArray(features) ? features : [features])
    .filter(Boolean)
    .map((f) => ({
      type: "Feature",
      geometry: f.geometry,
      properties: {
        ...(f.properties || {}),
        __label: prettyName(getName(f.properties || {}, fallbackName)),
      },
    }));
  source.setData({ type: "FeatureCollection", features: list });
  applyRifugiCutout(map, prefix, list);
}

export function addRifugiHoverLayers(map, prefix) {
  const sourceId = `${prefix}-rifugi-hover`;
  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  }
  if (!map.getLayer(`${prefix}-rifugi-hover-glow`)) {
    map.addLayer({
      id: `${prefix}-rifugi-hover-glow`,
      type: "line",
      source: sourceId,
      paint: {
        "line-color": "rgba(255,255,255,0.9)",
        "line-width": ["interpolate", ["linear"], ["zoom"], 11, 5, 15, 9],
        "line-blur": 2.4,
        "line-opacity": 0.55,
      },
    });
  }
  if (!map.getLayer(`${prefix}-rifugi-hover-line`)) {
    map.addLayer({
      id: `${prefix}-rifugi-hover-line`,
      type: "line",
      source: sourceId,
      paint: {
        "line-color": "#ffffff",
        "line-width": ["interpolate", ["linear"], ["zoom"], 11, 2.4, 15, 3.6],
        "line-opacity": 0.95,
      },
    });
  }
}

export function setRifugiHover(map, prefix, features) {
  const source = map.getSource(`${prefix}-rifugi-hover`);
  if (!source) return;
  const list = (Array.isArray(features) ? features : [features])
    .filter(Boolean)
    .map((f) => ({ type: "Feature", geometry: f.geometry, properties: f.properties || {} }));
  source.setData({ type: "FeatureCollection", features: list });
}

export function rifugioKey(p = {}) {
  return [
    String(getName(p)).trim().toLowerCase(),
    String(p.ubicazione || "").trim().toLowerCase(),
    String(p.area_Ha ?? p.area_ha ?? p.AREA_HA ?? ""),
  ].join("|");
}

export function fullRifugiFor(feature) {
  if (!feature) return [];
  if (rifugiData) {
    const key = rifugioKey(feature.properties || {});
    const matches = (rifugiData.features || []).filter((f) => rifugioKey(f.properties || {}) === key);
    if (matches.length) return matches;
  }
  return [{ type: "Feature", geometry: feature.geometry, properties: feature.properties || {} }];
}

export function rifugiHoverKey(feature) {
  const c = featureCenter(feature);
  return `${c[0].toFixed(5)},${c[1].toFixed(5)}`;
}

export function chooseFeaturedRifugi(geojson) {
  const feats = (geojson.features || []).filter((f) => f.geometry);
  return feats
    .map((f) => ({ f, csi: csiOf(f.properties || {}), center: featureCenter(f) }))
    .filter((d) => d.center && Number.isFinite(d.center[0]) && Number.isFinite(d.center[1]))
    .sort((a, b) => (Number.isNaN(b.csi) ? 0 : b.csi) - (Number.isNaN(a.csi) ? 0 : a.csi))
    .reduce((acc, d) => {
      if (acc.length >= 3) return acc;
      if (acc.every((x) => haversine(x.center, d.center) > 1300)) acc.push(d);
      return acc;
    }, [])
    .map((d) => d.f)
    .concat(feats.slice(0, 3))
    .filter((f, i, arr) => arr.findIndex((x) => x === f) === i)
    .slice(0, 3);
}


function pointInRing(pt, ring) {
  const x = pt[0];
  const y = pt[1];
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInFeature(pt, f) {
  if (!f || !f.geometry) return false;
  const g = f.geometry;
  const inPolygon = (polygon) =>
    pointInRing(pt, polygon[0]) && !polygon.slice(1).some((hole) => pointInRing(pt, hole));
  if (g.type === "Polygon") return inPolygon(g.coordinates);
  if (g.type === "MultiPolygon") return g.coordinates.some(inPolygon);
  return false;
}


function closestPointOnSegment(pt, a, b) {
  const cosLat = Math.cos((pt[1] * Math.PI) / 180);
  const ax = (a[0] - pt[0]) * cosLat;
  const ay = a[1] - pt[1];
  const bx = (b[0] - pt[0]) * cosLat;
  const by = b[1] - pt[1];
  const dx = bx - ax;
  const dy = by - ay;
  const denom = dx * dx + dy * dy;
  const t = denom ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / denom)) : 0;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function closestPointOnRings(pt, rings) {
  let bestPoint = null;
  let bestDistance = Infinity;
  for (const ring of rings || []) {
    for (let i = 1; i < ring.length; i += 1) {
      const q = closestPointOnSegment(pt, ring[i - 1], ring[i]);
      const d = haversine(pt, q);
      if (d < bestDistance) {
        bestDistance = d;
        bestPoint = q;
      }
    }
  }
  return { pt: bestPoint, d: bestDistance };
}

function routeTargetForFeature(origin, feature) {
  if (!feature?.geometry) return { pt: null, d: Infinity };
  if (pointInFeature(origin, feature)) return { pt: origin, d: 0 };
  const g = feature.geometry;
  if (g.type === "Point") {
    return { pt: g.coordinates, d: haversine(origin, g.coordinates) };
  }
  if (g.type === "Polygon") return closestPointOnRings(origin, g.coordinates);
  if (g.type === "MultiPolygon") {
    let best = { pt: null, d: Infinity };
    for (const polygon of g.coordinates) {
      const candidate = closestPointOnRings(origin, polygon);
      if (candidate.d < best.d) best = candidate;
    }
    return best;
  }
  const pt = featureCenter(feature);
  return { pt, d: haversine(origin, pt) };
}

async function valhallaRequest(action, payload, signal) {
  const response = await fetch(`${VALHALLA_BASE}/${action}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Client-Id": VALHALLA_CLIENT_ID,
    },
    body: JSON.stringify(payload),
    signal,
  });
  if (!response.ok) throw new Error(`Routing OSM non disponibile (${response.status})`);
  return response.json();
}

async function walkingMatrix(origin, candidates, signal) {
  if (!candidates.length) return [];
  const data = await valhallaRequest(
    "sources_to_targets",
    {
      sources: [{ lat: origin[1], lon: origin[0] }],
      targets: candidates.map((candidate) => ({ lat: candidate.pt[1], lon: candidate.pt[0] })),
      costing: "pedestrian",
      units: "kilometers",
    },
    signal,
  );
  const row = data.sources_to_targets?.[0] || [];
  return candidates.map((candidate, index) => {
    const result = row[index] || {};
    const d = Number(result.distance) * 1000;
    const time = Number(result.time);
    return {
      ...candidate,
      d: Number.isFinite(d) ? d : Infinity,
      time: Number.isFinite(time) ? time : Infinity,
    };
  });
}

function decodePolyline6(encoded) {
  const coordinates = [];
  let index = 0;
  let lat = 0;
  let lon = 0;
  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    lon += result & 1 ? ~(result >> 1) : result >> 1;
    coordinates.push([lon / 1e6, lat / 1e6]);
  }
  return coordinates;
}

async function walkingRoute(origin, candidate, signal) {
  if (candidate.d <= 1) {
    return { ...candidate, coordinates: [origin, origin] };
  }
  const data = await valhallaRequest(
    "route",
    {
      locations: [
        { lat: origin[1], lon: origin[0] },
        { lat: candidate.pt[1], lon: candidate.pt[0] },
      ],
      costing: "pedestrian",
      units: "kilometers",
      directions_type: "none",
    },
    signal,
  );
  const coordinates = [];
  for (const leg of data.trip?.legs || []) {
    const decoded = decodePolyline6(leg.shape || "");
    if (coordinates.length && decoded.length) decoded.shift();
    coordinates.push(...decoded);
  }
  const summary = data.trip?.summary || {};
  const routedDistance = Number(summary.length) * 1000;
  const routedTime = Number(summary.time);
  return {
    ...candidate,
    d: Number.isFinite(routedDistance) ? routedDistance : candidate.d,
    time: Number.isFinite(routedTime) ? routedTime : candidate.time,
    coordinates,
  };
}

function officialRouteCandidates(origin) {
  return (ufficialiData?.features || [])
    .map((f) => {
      const target = routeTargetForFeature(origin, f);
      return { f, pt: target.pt, lowerBound: target.d, kind: "ufficiale" };
    })
    .filter((candidate) => candidate.pt && Number.isFinite(candidate.lowerBound));
}

function greenRouteCandidates(origin) {
  return (rifugiData?.features || [])
    .map((f) => {
      const target = routeTargetForFeature(origin, f);
      const placeKey = String(getName(f.properties || {})).trim().toLowerCase();
      return { f, pt: target.pt, lowerBound: target.d, kind: "verde", placeKey };
    })
    .filter((candidate) => candidate.placeKey && candidate.pt && Number.isFinite(candidate.lowerBound))
    .sort((a, b) => a.lowerBound - b.lowerBound);
}

function bestDistinctGreen(candidates) {
  const byPlace = new Map();
  for (const candidate of candidates) {
    if (!Number.isFinite(candidate.d)) continue;
    const previous = byPlace.get(candidate.placeKey);
    if (!previous || candidate.d < previous.d) byPlace.set(candidate.placeKey, candidate);
  }
  return [...byPlace.values()].sort((a, b) => a.d - b.d);
}

async function nearestOfficialByWalking(origin, signal) {
  const routed = await walkingMatrix(origin, officialRouteCandidates(origin), signal);
  return routed.filter((candidate) => Number.isFinite(candidate.d)).sort((a, b) => a.d - b.d)[0] || null;
}

async function nearestGreenByWalking(origin, count, signal) {
  const candidates = greenRouteCandidates(origin);
  const routed = [];
  const batchSize = 40;
  for (let start = 0; start < candidates.length; start += batchSize) {
    const batch = candidates.slice(start, start + batchSize);
    routed.push(...(await walkingMatrix(origin, batch, signal)));
    const finite = bestDistinctGreen(routed);
    const next = candidates[start + batchSize];
    // Straight-line distance is only a batching lower bound; displayed distances use Valhalla.
    if (finite.length >= count && (!next || next.lowerBound > finite[count - 1].d + 100)) {
      return finite.slice(0, count);
    }
  }
  return bestDistinctGreen(routed).slice(0, count);
}

export async function findWalkingReliefs(origin, options = {}) {
  const { signal, greenCount = 2 } = options;
  const [ufficiale, verdi] = await Promise.all([
    nearestOfficialByWalking(origin, signal),
    nearestGreenByWalking(origin, greenCount, signal),
  ]);
  const selected = [ufficiale, ...verdi].filter(Boolean);
  const routes = await Promise.all(selected.map((candidate) => walkingRoute(origin, candidate, signal)));
  const routedOfficial = routes.find((route) => route.kind === "ufficiale") || null;
  const routedGreen = routes.filter((route) => route.kind === "verde");
  return { ufficiale: routedOfficial, verdi: routedGreen, routes };
}


async function nominatim(params) {
  const url =
    "https://nominatim.openstreetmap.org/search?format=json&countrycodes=it&addressdetails=1&viewbox=11.18,44.60,11.50,44.38&bounded=1&" +
    params;
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  if (!r.ok) return [];
  return (await r.json()) || [];
}

function addressLabel(hit) {
  const a = hit.address || {};
  const road = a.road || a.pedestrian || a.footway || a.square || "";
  const num = a.house_number ? ` ${a.house_number}` : "";
  const zone = a.suburb || a.quarter || a.neighbourhood || a.village || "";
  const main = road ? `${road}${num}` : String(hit.display_name || "").split(",")[0];
  return zone && zone !== main ? `${main} · ${zone}` : main;
}

export async function geocodeBologna(query) {
  const q = String(query || "").trim();
  if (!q) return null;
  if (/\d/.test(q)) {
    const arr = await nominatim(`street=${encodeURIComponent(q)}&city=Bologna&limit=1`);
    if (arr[0]) return { pt: [Number(arr[0].lon), Number(arr[0].lat)], label: addressLabel(arr[0]) };
  }
  const arr = await nominatim(`limit=1&q=${encodeURIComponent(`${q}, Bologna, Italia`)}`);
  if (!arr[0]) return null;
  return { pt: [Number(arr[0].lon), Number(arr[0].lat)], label: addressLabel(arr[0]) };
}

function classifyHit(hit) {
  const a = hit.address || {};
  if (a.house_number) return "address";
  const cls = hit.class;
  const type = hit.type;
  const at = hit.addresstype;
  if (type === "square" || at === "square" || /^piazza/i.test(a.road || "")) return "square";
  if (cls === "highway" || ["residential", "unclassified", "living_street", "pedestrian", "primary", "secondary", "tertiary", "footway", "cycleway", "path", "service", "road"].includes(type)) {
    return "street";
  }
  if (cls === "leisure" && ["park", "garden", "nature_reserve", "common"].includes(type)) return "park";
  if (cls === "landuse" && ["grass", "recreation_ground", "forest", "meadow"].includes(type)) return "greenArea";
  if (cls === "amenity" && ["school", "hospital", "university"].includes(type)) return "place";
  if (a.suburb || a.quarter || a.neighbourhood) return "zone";
  return "place";
}

export async function geocodeSuggestions(query, limit = 5) {
  const q = String(query || "").trim();
  if (q.length < 3) return [];
  const hasNum = /\d/.test(q);
  const arr = await nominatim(
    hasNum
      ? `street=${encodeURIComponent(q)}&city=Bologna&limit=${limit}`
      : `limit=${limit}&q=${encodeURIComponent(`${q}, Bologna`)}`,
  );
  const seen = new Set();
  const out = [];
  for (const hit of arr) {
    const label = addressLabel(hit);
    if (!label || seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    out.push({ type: "address", label, subId: classifyHit(hit), pt: [Number(hit.lon), Number(hit.lat)] });
  }
  return out;
}

export function suggestRifugi(query, limit = 3) {
  if (!rifugiData) return [];
  const q = String(query || "").trim().toLowerCase();
  if (q.length < 2) return [];
  const scored = [];
  for (const f of rifugiData.features || []) {
    if (!f.geometry) continue;
    const name = String(getName(f.properties || {}));
    const idx = name.toLowerCase().indexOf(q);
    if (idx === -1) continue;
    scored.push({ idx, name, f });
  }
  scored.sort((a, b) => a.idx - b.idx || a.name.length - b.name.length);
  const seen = new Set();
  const out = [];
  for (const s of scored) {
    const key = s.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ type: "rifugio", label: prettyName(s.name), subId: "greenSpace", pt: featureCenter(s.f) });
    if (out.length >= limit) break;
  }
  return out;
}

export function suggestUfficiali(query, limit = 3) {
  if (!ufficialiData) return [];
  const q = String(query || "").trim().toLowerCase();
  if (q.length < 2) return [];
  return (ufficialiData.features || [])
    .map((f) => ({ f, idx: String(f.properties?.nome || "").toLowerCase().indexOf(q) }))
    .filter((x) => x.idx !== -1)
    .sort((a, b) => a.idx - b.idx)
    .slice(0, limit)
    .map(({ f }) => ({
      type: "ufficiale",
      label: prettyName(f.properties?.nome || ""),
      subId: "municipalRefuge",
      pt: f.geometry.coordinates,
    }));
}

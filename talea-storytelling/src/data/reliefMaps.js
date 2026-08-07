// Map data + helpers for the climate-refuge map of the "Gli spazi verdi sono la
// soluzione" chapter, plus the ortophoto base shared with the pilot-zones map.
// Ported from talea_capitolo_sollievo_climatico.html and rewired to the app's
// own datasets under public/data/ and the TALEA palette.
//
// Interaction model (2026-06-30 overhaul): the camera holds a calm city-wide
// OVERVIEW by default — the reader just scrolls through. On an explicit action
// (search or click) the map flies in to the chosen place to reveal the green and
// the climate refuges nearby; the moment the reader scrolls on, the map eases
// back out to the overview. So nothing moves unless the citizen asks it to, and
// the narrative is never trapped.
//
// 2026-07-28 (`11`): the 3-30-300 scene left the story, and with it the area
// choropleth, the 30/300 m rings, the tree layers and their cards. What stayed
// is everything the refuge map and the pilot-zones map actually use.

import maplibregl from "maplibre-gl";
import { assetUrl } from "../lib/assetUrl";

// Datasets served from public/data/, like the rest of the app's data. They were
// vendored in from the CRAF and HistorySUHI repos so this repo builds on its own.
// csi.geojson = green spaces scored by the Climate Shelter Index.
const csiUrl = assetUrl("/data/vectors/csi.geojson");
const greenSpacesCsiUrl = assetUrl("/data/vectors/green_spaces_csi.geojson");
const bolognaBoundaryUrl = assetUrl("/data/vectors/bologna_boundary_outline.geojson");
// The Comune's own list of recognised climate refuges (scripts/build_rifugi_ufficiali.mjs).
import rifugiUfficialiUrl from "./rifugi_ufficiali.geojson?url";

// Brand palette (mirrors theme.css). Yellow is reserved for "your focus" — the
// boundary, the selected area, the 300 m ring, the nearest refuges and the search
// marker — so it always means the same thing on the map.
const COLORS = {
  green: "#21A84A",
  darkGreen: "#004d19",
  yellow: "#FFE604",
};

const EASE_OUT = (t) => 1 - Math.pow(1 - t, 3);

// Minimal basemap: just a background + (added at runtime) the ortophoto raster.
// No vector buildings / streets / labels — the imagery stays clean, with only the
// rifugi (and, on the 3-30-300 map, trees + areas) drawn on top. `glyphs` is kept
// so the tree-cluster count labels can render.
export const BASEMAP_STYLE = {
  version: 8,
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {},
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#dfe6da" } },
  ],
};

// The maps are camera-driven only through code (flyTo / fitBounds). Every manual
// handler stays disabled so a citizen can't accidentally pan or zoom away and
// lose the frame — the scroll/search/click flow does all the moving.
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

// Esri World Imagery — can be swapped for the Comune/Regione WMTS ortophoto.
export const ORTHOPHOTO_TILES = [
  "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
];

export const BOLOGNA_CENTER = [11.343, 44.494];
// Initial camera used while the style loads; the real overview is fit to the data
// (setOverviewFrame) as soon as the layers are in, so the whole city is framed.
export const RELIEF_STORY_CAMERA = { center: [11.344, 44.498], zoom: 11.6, pitch: 0, bearing: 0 };
export const FOCUS_MAX_ZOOM = 15.1;
export const ADDRESS_ZOOM = 15.4;
const VALHALLA_BASE = "https://valhalla1.openstreetmap.de";
const VALHALLA_CLIENT_ID = "talea-storytelling";

/* ───────────────────────────── generic helpers ───────────────────────────── */

export function toNumber(v) {
  if (v === null || v === undefined) return NaN;
  if (typeof v === "string") v = v.replace(",", ".");
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

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

/* ───────────────────────────── camera control ───────────────────────────── */

// Remember the city-wide frame (bounds + padding) so we can ease back to it.
export function setOverviewFrame(map, geojson, padding = 44) {
  const b = boundsForCollection(geojson);
  if (!b.isEmpty()) {
    map._reliefBounds = b;
    map._reliefPad = padding;
  }
}

export function frameOverview(map, duration = 0) {
  if (!map) return;
  const b = map._reliefBounds;
  if (!b || b.isEmpty()) {
    map.flyTo({ ...RELIEF_STORY_CAMERA, duration, essential: true });
    return;
  }
  map.fitBounds(b, {
    padding: map._reliefPad ?? 44,
    duration,
    maxZoom: 12.4,
    essential: true,
    easing: EASE_OUT,
  });
}

// Ease in to frame one feature (an area or a refuge polygon).
export function flyToFeature(map, feature, opts = {}) {
  const { maxZoom = FOCUS_MAX_ZOOM, padding = 96, duration = 1500 } = opts;
  const b = boundsForFeature(feature);
  if (b.isEmpty()) return;
  map.fitBounds(b, { padding, maxZoom, duration, essential: true, easing: EASE_OUT });
}

// Combined bounds of several features (a refuge that lives as more than one
// source polygon, or the several clipped pieces of one big park).
export function boundsForFeatures(features) {
  const b = new maplibregl.LngLatBounds();
  (features || []).forEach((f) => f && f.geometry && extendBounds(f.geometry.coordinates, b));
  return b;
}

// Ease in to frame a whole refuge (all its polygons), not just the clicked piece.
export function flyToFeatures(map, features, opts = {}) {
  const { maxZoom = FOCUS_MAX_ZOOM, padding = 96, duration = 1500 } = opts;
  const b = boundsForFeatures(features);
  if (b.isEmpty()) return;
  map.fitBounds(b, { padding, maxZoom, duration, essential: true, easing: EASE_OUT });
}

// Ease in to a geocoded point (a street address) at neighbourhood scale.
export function flyToPoint(map, pt, opts = {}) {
  const { zoom = ADDRESS_ZOOM, duration = 1600 } = opts;
  map.flyTo({ center: pt, zoom, duration, essential: true, curve: 1.5 });
}

// Frame every route returned for an address. On desktop the lower-left dock
// occupies part of the map, so the route network gets asymmetric padding; on a
// narrow screen the dock spans the bottom and the padding moves there instead.
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

/* ───────────────────────────── base layers ───────────────────────────── */

function firstSymbolLayerId(map) {
  const layers = map.getStyle().layers || [];
  const symbol = layers.find((l) => l.type === "symbol");
  return symbol && symbol.id;
}

// `damped` (used by the refuge map, `10` § 10.1) pushes the imagery much further
// down: on an ortophoto the parks are ALREADY green, so a green refuge sitting on
// green imagery doesn't separate from its own background. The fix belongs to the
// base, not to the data — the refuge colours are untouched. With the city
// dropped to a grey-brown, the contrast that carries the scene becomes
// refuge/not-refuge, which is the reading the chapter actually needs.
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

// Ease a paint property from 0 to its target (used to breathe the data layers
// in over the ortophoto, instead of popping everything at once).
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

/* ───────────────────────── property accessors ───────────────────────── */

function getName(p) {
  return (
    p.Nome || p.nome || p.name || p.Name || p.denominazione || p.DESCRIZIONE ||
    p.area_stati || p.stat_area_name || p.zona || p.Zona || "Spazio verde"
  );
}

// Dataset names are shouted ("PARCO DEI CALANCHI DI SABBIUNO"); labels on the
// map read better in title case with the little words kept low.
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

// Amenity flags in csi.geojson are "yes"/"no" strings.
function hasAmenity(v) {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "yes" || s === "si" || s === "sì" || s === "true" || s === "1";
}

function prettyParkType(p) {
  const raw = String(p.classe_uni || p.classe_gia || "").trim().toUpperCase();
  const map = {
    "PARCO ESTENSIVO": "Parco urbano",
    PARCO: "Parco",
    GIARDINO: "Giardino di quartiere",
    "VERDE SCOLASTICO": "Verde scolastico",
    "VERDE SPORTIVO": "Verde sportivo",
  };
  return map[raw] || "Spazio verde";
}

// True only for the real standouts (~1% of refuges) — used to surface a small
// "grande spazio verde" note on the rare high-CSI parks, never a graded score.
function isStandoutRifugio(csi) {
  return !Number.isNaN(csi) && csi >= 0.7;
}

/* ── «Ma com'è, davvero?» (2026-08-06) ──────────────────────────────────────
   Un nome, un quartiere e degli ettari non dicono se in quel giardino ci si sta:
   se c'è ombra vera, se è tenuto, se ci si porterebbe un bambino. Una panoramica
   di Street View lo dice in un colpo, e non costa alla pagina nulla.

   Il punto di vista NON è il centro del parco: là dentro, spesso, Google non è
   mai passato e il link si aprirebbe su un errore. È invece il punto del BORDO
   più vicino al centro, spostato una quindicina di metri all'esterno, cioè dove
   passa la strada e dove le foto esistono davvero; la bussola è girata verso il
   centro, così la panoramica si apre guardando DENTRO il parco. */
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

/* ─────────────────────────────── popups / cards ─────────────────────────── */

// Lightweight hover popup over a refuge (name + type only — full detail on click).
export function popupRifugioHTML(feature) {
  const p = feature.properties || {};
  return `<div class="story-popup"><strong>${prettyName(getName(p))}</strong><span>${prettyParkType(p)} · tocca per i dettagli</span></div>`;
}

// Green-space card (`10` § 10.4). Two lines and one, in the order a citizen
// reads them: WHAT it is, WHERE it is, and then what it offers. The old version
// opened with a chip rack; chips describe an interface, a name and a district
// describe a place.
export function rifugiDetailHTML(feature) {
  const p = feature.properties || {};
  const csi = csiOf(p);
  const area = metricVal(p, ["area_Ha", "area_ha", "ha", "AREA_HA", "superficie", "area"]);
  const areaHa = Number.isNaN(area) ? NaN : area > 1000 ? area / 10000 : area;
  const district = String(p.quartiere || p.quart || "").trim();
  const place = String(p.ubicazione || "").trim();

  const metaParts = [district ? `Quartiere ${district}` : "", place].filter(Boolean);
  if (!Number.isNaN(areaHa) && areaHa >= 1) metaParts.push(`${areaHa.toFixed(1).replace(".", ",")} ettari`);

  // Only what the dataset actually flags. "Ombra del verde" used to be printed
  // on every card as an always-on chip, which made it worth nothing.
  const offers = [];
  if (hasAmenity(p.d_fountain)) offers.push("fontanella");
  if (hasAmenity(p.benches)) offers.push("panchine");
  if (hasAmenity(p.picnic_tab)) offers.push("tavoli da picnic");

  return `<div class="r-card">
    <strong class="r-card-name">${prettyName(getName(p))}</strong>
    <span class="r-card-meta">${metaParts.join(" · ")}</span>
    ${offers.length ? `<span class="r-card-offers">${offers.join(" · ")}</span>` : ""}
    ${isStandoutRifugio(csi) ? `<span class="r-card-foot r-card-foot--standout">Uno dei grandi spazi verdi della città</span>` : ""}
    <a class="r-card-street" href="${streetViewURL(feature)}" target="_blank" rel="noopener noreferrer">Guarda com’è su Street View →</a>
  </div>`;
}

/* ── The Comune's official refuges ──
   These carry things the CSI green spaces cannot: opening hours, indoor cool,
   free toilets, drinking water. The card leads with that, because on a 38 °C
   afternoon it is the only information that changes what a person does. */

export function popupUfficialeHTML(feature) {
  const p = feature.properties || {};
  return `<div class="story-popup story-popup--ufficiale"><strong>${prettyName(p.nome || "")}</strong><span>Rifugio climatico del Comune · tocca per i dettagli</span></div>`;
}

// `acqua` is kept as supplied by the Comune. For toilets this card only answers
// the question requested by the story: are they free? The source has records
// that do not state a price, so those remain explicitly "non indicato" instead
// of silently being presented as either free or paid.
function stripLabel(value, label) {
  const s = String(value || "").trim();
  const re = new RegExp(`^${label}\\s+`, "i");
  return s.replace(re, "");
}

function toiletCost(value) {
  const s = String(value || "").trim().toLowerCase();
  if (!s) return "";
  if (s.includes("gratuit")) return "Gratuiti";
  if (s.includes("pagamento") || s.includes("solo per gli utenti")) return "Non gratuiti";
  return "Gratuità non indicata";
}

function factRowHTML(label, value) {
  if (!value) return "";
  return `<div class="r-fact"><span class="r-fact-key">${label}</span><span class="r-fact-val">${value}</span></div>`;
}

export function ufficialeDetailHTML(feature) {
  const p = feature.properties || {};
  const meta = [p.tipo, p.quartiere ? `Quartiere ${p.quartiere}` : "", p.indirizzo].filter(Boolean);

  return `<div class="r-card r-card--ufficiale">
    <span class="r-card-badge">Riconosciuto dal Comune${
      p.ambiente === "interno" ? " · al chiuso" : " · all’aperto"
    }</span>
    <strong class="r-card-name">${prettyName(p.nome || "")}</strong>
    <span class="r-card-meta">${meta.join(" · ")}</span>
    <div class="r-facts">
      ${factRowHTML("Acqua", stripLabel(p.acqua, "acqua"))}
      ${factRowHTML("Bagni", toiletCost(p.bagni))}
    </div>
    ${p.orari ? `<a class="r-card-hours" href="${p.orari}" target="_blank" rel="noopener noreferrer">Orari di apertura →</a>` : ""}
  </div>`;
}

/* ── The "e casa mia?" answer (`11` § 11.3) ──
   What the 3-30-300 block used to provide, minus the incomplete index: a place
   the reader knows, and how far the relief is from it. A distance is a simple,
   checkable, honest number — no thresholds, no score, nothing to get wrong.
   Both tiers answer, each labelled for what it is. */
function fmtDistance(d) {
  if (!Number.isFinite(d)) return "";
  if (d <= 20) return "sei già lì";
  if (d >= 1000) return `${(d / 1000).toFixed(1).replace(".", ",")} km`;
  return `${Math.round(d / 10) * 10} m`;
}

function fmtWalkTime(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min a piedi`;
}

function nearRowHTML(name, d, seconds) {
  const bits = [fmtDistance(d), fmtWalkTime(seconds)].filter(Boolean);
  return `<span class="r-near-item">${name}<em>${bits.join(" · ")}</em></span>`;
}

export function nearbyCardHTML({ label, ufficiale, verdi }) {
  const blocks = [];
  if (ufficiale) {
    blocks.push(`<div class="r-near">
      <span class="r-near-head">Rifugio riconosciuto più vicino</span>
      ${nearRowHTML(prettyName(ufficiale.f.properties?.nome || ""), ufficiale.d, ufficiale.time)}
    </div>`);
  }
  if (verdi && verdi.length) {
    blocks.push(`<div class="r-near">
      <span class="r-near-head">Spazi verdi a portata</span>
      ${verdi.map((x) => nearRowHTML(prettyName(getName(x.f.properties || {})), x.d, x.time)).join("")}
    </div>`);
  }
  return `<div class="r-card r-card--near">
    <strong class="r-card-name">${label || "Il punto cercato"}</strong>
    ${blocks.join("") || '<span class="r-card-meta">Nessun rifugio raggiungibile trovato.</span>'}
    <span class="r-card-foot">Percorsi pedonali calcolati sulla rete di strade e sentieri OpenStreetMap.</span>
  </div>`;
}

/* ───────────────────────── data loaders (cached) ───────────────────────── */

let rifugiData = null;

export function getRifugiData() {
  return rifugiData;
}

/* csi.geojson holds ALL of Bologna's public green spaces (930 polygons, down to
   200 m² flower beds). Those are not climate refuges, and drawing them all would
   say they are. CRAF's own web app draws the line where this project draws it:
   «candidati rifugi climatici: superficie > 0,5 ha e NDVI > 0,4» — big enough to
   hold a crowd, green enough to actually cool. That leaves 259 polygons over 231
   distinct places, 484 hectares, in all six quartieri.

   The filter is applied at load, so everything downstream — the layers, the
   count in the dock, the nearest-refuge search, the name suggestions, the
   fragment resolution — sees exactly what the map draws, and cannot drift from
   it later. */
const SELECT_MIN_HA = 0.5;
const SELECT_MIN_NDVI = 0.4;

function selectRifugi(geojson) {
  const features = (geojson?.features || []).filter((f) => {
    if (!f.geometry) return false;
    const ha = toNumber(f.properties?.area_Ha ?? f.properties?.area_ha ?? f.properties?.AREA_HA);
    const ndvi = toNumber(f.properties?.NDVI ?? f.properties?.ndvi);
    return ha > SELECT_MIN_HA && ndvi > SELECT_MIN_NDVI;
  });
  return { type: "FeatureCollection", features };
}

export async function loadRifugiData() {
  if (rifugiData) return rifugiData;
  let parks = null;
  try {
    parks = asGeoJSON(await fetchJSON(csiUrl));
  } catch (err) {
    console.warn("csi.geojson non disponibile, uso green_spaces_csi", err);
  }
  if (!parks || !parks.features || !parks.features.length) {
    parks = asGeoJSON(await fetchJSON(greenSpacesCsiUrl));
  }
  rifugiData = selectRifugi(parks);
  return rifugiData;
}

let ufficialiData = null;

// The Comune's OFFICIAL climate-refuge network — a short, named list (libraries,
// museums, case di quartiere, parks), snapshotted by
// scripts/build_rifugi_ufficiali.mjs. Kept strictly apart from the CSI green
// spaces: one is a municipal decision, the other is a research score, and the map
// must never let a reader mistake the second for the first.
export async function loadRifugiUfficiali() {
  if (ufficialiData) return ufficialiData;
  ufficialiData = asGeoJSON(await fetchJSON(rifugiUfficialiUrl));
  return ufficialiData;
}

export function getRifugiUfficiali() {
  return ufficialiData;
}

// How many DISTINCT places the map draws. csi.geojson splits the big parks into
// several polygons (Giardini Margherita, Parco dei Cedri…), so the feature count
// is not the number of places — the counter in the dock must never say 259.
export function countRifugi(geojson) {
  const names = new Set();
  for (const f of geojson?.features || []) {
    const n = String(getName(f.properties || {})).trim().toLowerCase();
    if (n) names.add(n);
  }
  return names.size;
}

/* ───────────────────────────── refuge layers ───────────────────────────── */

// Real CSI is extremely skewed (68% of Bologna's 930 refuges score < 0.05, 97%
// score < 0.2), so a colour gradient here would render almost the entire network
// as one indistinguishable pale blob — showing a false sense of precision rather
// than helping anyone read the map. One flat, legible brand green says plainly
// "this shape is a recognised climate refuge"; the real scale-of-relief story
// (small garden → big urban park) is told honestly elsewhere — by the
// scroll-featured highlight (chooseFeaturedRifugi) and by the standout note in
// the tap card for the rare high-CSI parks — not by shading every polygon.
const RIFUGI_FILL_COLOR = COLORS.green;

export function addRifugiLayers(map, geojson, prefix, options = {}) {
  const sourceId = `${prefix}-rifugi`;
  if (map.getSource(sourceId)) return;
  const lineWidth = options.lineWidth ?? 2.2;
  // Ricordato sulla mappa perché il gemello del riempimento (setRifugiFocus →
  // applyRifugiCutout) deve partire ESATTAMENTE dallo stesso verde, altrimenti
  // il momento in cui prende il posto del layer di base si vedrebbe.
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

/* ── The network lights up, it isn't unveiled (`10` § 10.2) ──
   Hotspot and shadow both open by lifting a veil; a third one would read as a
   procedure. Here the refuges arrive instead as a wave running out from the
   centre of the city, so the reader watches a network APPEAR rather than a map
   get uncovered. It is the most positive moment of the story so far, and it
   deserves an entrance that says "they are already here".

   `__wave` is the feature's distance from the centre, normalised 0..1. Each
   frame the fill is an interpolate over it with a moving front: everything
   behind the front is at full opacity, everything ahead is at zero, and 0.15 of
   soft edge in between keeps it a wash rather than a wipe. */
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
        // Identità del luogo, precalcolata: è la chiave con cui il filtro toglie
        // dal riempimento di base il parco selezionato (applyRifugiCutout), e
        // vale per TUTTI i poligoni dello stesso parco.
        __key: rifugioKey(f.properties || {}),
      },
    })),
  };
}

// Runs the wave over `fillLayerId` and returns a cancel function (the scene may
// scroll away mid-wave — leaving a rAF loop writing paint properties on a map
// that is being torn down throws).
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
    // Ease out: the front sprints away from the centre, then settles on the edges.
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
      // Settle on a plain constant: leaving a per-feature expression in place
      // would make every later paint change re-evaluate 930 features.
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

/* ── The Comune's official refuges: points, not shapes ──
   Two tiers on one map, and they must never blur into each other: the green
   SHAPES are the city's public green spaces scored by the Climate Shelter Index
   (a research reading), the deep-green PINS are the refuges the Comune has
   actually recognised (a municipal decision, and the only ones that carry
   opening hours, toilets and drinking water).
   The distinction is carried by FORM first (a point on a shape is unmistakable)
   and by tone second (the pin is the darkest green on the map). Yellow stays out
   of it: it means "this is what you selected", nothing else (`01` § 1.1). */
export function addUfficialiLayers(map, geojson, prefix) {
  const sourceId = `${prefix}-ufficiali`;
  if (map.getSource(sourceId)) return;
  map.addSource(sourceId, { type: "geojson", data: geojson });
  // Pale halo: on a damped ortophoto a dark dot alone disappears over dark ground.
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
  // Names only once the camera is close enough for 29 labels not to be a thicket.
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

// Dynamic walking routes from a searched address. The yellow casing keeps the
// story's "your focus" language; the core retains the two map categories:
// deep green for Comune refuges, bright green for the calculated green spaces.
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

// Pre-compute the label so the layer doesn't have to shout the dataset's
// ALL-CAPS names (see prettyName).
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

// Ring around the selected official refuge — the same "yellow = your focus"
// grammar the green shapes already use, so a selection looks the same whichever
// tier it belongs to.
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

/* ── Il luogo selezionato si apre (2026-08-06) ──
   Finché la selezione restava una macchia verde con sopra una campitura gialla,
   il lettore vedeva CHE COSA aveva scelto ma non che cosa c'era dentro: alberi,
   vialetti, radure, campi, acqua, il disegno stesso del parco. Ora, appena un
   parco è selezionato, il suo riempimento si dissolve e resta solo il bordo: il
   luogo si apre sull'ortofoto e si mostra da sé.

   Meccanica. Il riempimento di base non può sfumare per un solo poligono (in un
   layer una proprietà data-driven cambia di colpo, senza transizione), quindi il
   parco selezionato viene tolto dal layer generale con un FILTRO e, nello stesso
   frame, un layer gemello — sorgente: i poligoni selezionati — ne prende il posto
   con lo stesso identico verde. È il gemello, un'opacità costante, a sfumare a
   zero: si vede una dissolvenza sola. La campitura gialla del focus segue la
   stessa curva, dopo aver detto per un istante «hai scelto questo». */
const CUTOUT_MS = 560;
const FOCUS_FILL_OPACITY = 0.22;

function layerExists(map, id) {
  try {
    return Boolean(map && map.getLayer(id));
  } catch {
    // La mappa può essere già stata smontata sotto un rAF in volo.
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

  // 1. il gemello prende il posto del riempimento di base, nello stesso verde…
  fade(cutoutId, map._rifugiFillTarget ?? 0.5, 0);
  fade(focusFillId, FOCUS_FILL_OPACITY, 0);
  map.setFilter(fillId, ["match", ["coalesce", ["get", "__key"], ""], keys, false, true]);
  // 2. …e dal frame dopo si dissolve, aprendo il parco sull'ortofoto.
  state.frame = requestAnimationFrame(() => {
    state.frame = null;
    fade(cutoutId, 0, CUTOUT_MS);
    fade(focusFillId, 0, CUTOUT_MS);
  });
}

// Yellow "focus" highlight over selected refuges.
export function addRifugiFocusLayers(map, prefix) {
  const sourceId = `${prefix}-rifugi-focus`;
  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  }
  // Il gemello del riempimento verde (vedi applyRifugiCutout): sta SOTTO i bordi
  // del layer di base, così mentre sfuma non copre né il contorno né il giallo.
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
      // Parte da zero: è applyRifugiCutout ad accenderla e a spegnerla.
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
  // Dark casing under the yellow so the selected contour stays legible on bright
  // ortophoto — makes "this is what you selected" unmistakable.
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
  // Name label so a highlighted refuge is not an anonymous yellow shape.
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

export function setRifugiFocus(map, prefix, features = []) {
  const source = map.getSource(`${prefix}-rifugi-focus`);
  if (!source) return;
  // Build a plain GeoJSON feature. `queryRenderedFeatures` returns objects whose
  // `geometry` is a PROTOTYPE GETTER (not an own prop), so an object spread would
  // silently drop it and the highlight would have nothing to draw — read it
  // explicitly here.
  const list = (Array.isArray(features) ? features : [features])
    .filter(Boolean)
    .map((f) => ({
      type: "Feature",
      geometry: f.geometry,
      properties: { ...(f.properties || {}), __label: prettyName(getName(f.properties || {})) },
    }));
  source.setData({ type: "FeatureCollection", features: list });
  applyRifugiCutout(map, prefix, list);
}

// Soft white hover outline over a refuge — pairs with the anchored hover popup
// so the shape the popup describes is unmistakable (the refuges sit on a busy
// ortophoto, so a plain popup alone is easy to lose).
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

// Identity of a refuge from its properties (name + location + size), stable
// across the tile-clipped fragments that queryRenderedFeatures hands back.
export function rifugioKey(p = {}) {
  return [
    String(getName(p)).trim().toLowerCase(),
    String(p.ubicazione || "").trim().toLowerCase(),
    String(p.area_Ha ?? p.area_ha ?? p.AREA_HA ?? ""),
  ].join("|");
}

// Resolve a (possibly tile-clipped) rendered feature to the FULL source
// feature(s) for that refuge — so selecting/hovering any piece of a park treats
// the WHOLE place as one, with one continuous border. Falls back to the given
// feature (as a plain GeoJSON, geometry read explicitly) if the data isn't loaded.
export function fullRifugiFor(feature) {
  if (!feature) return [];
  if (rifugiData) {
    const key = rifugioKey(feature.properties || {});
    const matches = (rifugiData.features || []).filter((f) => rifugioKey(f.properties || {}) === key);
    if (matches.length) return matches;
  }
  return [{ type: "Feature", geometry: feature.geometry, properties: feature.properties || {} }];
}

// A stable per-refuge key (its centroid) so the hover popup only rebuilds when
// the pointer actually crosses to a different refuge, not on every mouse move.
export function rifugiHoverKey(feature) {
  const c = featureCenter(feature);
  return `${c[0].toFixed(5)},${c[1].toFixed(5)}`;
}

// Three well-separated, high-CSI refuges to illustrate the scales of relief.
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

/* ──────────────────────── search / spatial helpers ──────────────────────── */

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

/* ───────────────── pedestrian routing on the OSM network ───────────────── */

// Closest point on a polygon edge, using a local equirectangular projection.
// This is only a lower bound and a sensible route destination; the distance
// shown to the reader always comes back from the pedestrian routing graph.
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
    // A network path cannot be shorter than its straight-line lower bound.
    // Continue until even the next untested polygon is farther than the current
    // Nth pedestrian result (with a small allowance for Valhalla edge snapping).
    if (finite.length >= count && (!next || next.lowerBound > finite[count - 1].d + 100)) {
      return finite.slice(0, count);
    }
  }
  return bestDistinctGreen(routed).slice(0, count);
}

// Selection and displayed distances both come from Valhalla's pedestrian graph
// built from OpenStreetMap. Straight lines are used only as a mathematically
// safe pre-filter for the 231 parks and are never shown as the answer.
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

/* ─────────────────────────────── geocoding ─────────────────────────────── */

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

// Geocode within Bologna. A query with a number is treated as "via + civico"
// first (structured search resolves house numbers far more reliably than the
// free-form one). Returns { pt, label } or null.
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

// What kind of place a Nominatim hit is, so the suggestion carries an honest
// label (Via / Piazza / Parco / Indirizzo…) instead of a generic "Indirizzo".
function classifyHit(hit) {
  const a = hit.address || {};
  if (a.house_number) return "Indirizzo";
  const cls = hit.class;
  const type = hit.type;
  const at = hit.addresstype;
  if (type === "square" || at === "square" || /^piazza/i.test(a.road || "")) return "Piazza";
  if (cls === "highway" || ["residential", "unclassified", "living_street", "pedestrian", "primary", "secondary", "tertiary", "footway", "cycleway", "path", "service", "road"].includes(type)) {
    return "Via";
  }
  if (cls === "leisure" && ["park", "garden", "nature_reserve", "common"].includes(type)) return "Parco";
  if (cls === "landuse" && ["grass", "recreation_ground", "forest", "meadow"].includes(type)) return "Area verde";
  if (cls === "amenity" && ["school", "hospital", "university"].includes(type)) return "Luogo";
  if (a.suburb || a.quarter || a.neighbourhood) return "Zona";
  return "Luogo";
}

// Address / street / place completions for the search box (debounced by the
// caller). Returns the real streets, squares, parks and civic addresses that
// OpenStreetMap knows within Bologna, each honestly typed.
export async function geocodeSuggestions(query, limit = 5) {
  const q = String(query || "").trim();
  if (q.length < 3) return [];
  const hasNum = /\d/.test(q);
  // With a number: resolve civic addresses on the named street. Without: a
  // free-form search surfaces streets, squares and named places alike.
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
    out.push({ type: "address", label, sub: classifyHit(hit), pt: [Number(hit.lon), Number(hit.lat)] });
  }
  return out;
}

// Local (instant) completions from the climate-refuge network: a citizen can
// search a park by name and land on the 3-30-300 reading at that spot.
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
  // Many refuges are split into several polygons sharing a name — keep the best
  // match per name so the citizen sees each park once, not three times.
  scored.sort((a, b) => a.idx - b.idx || a.name.length - b.name.length);
  const seen = new Set();
  const out = [];
  for (const s of scored) {
    const key = s.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ type: "rifugio", label: prettyName(s.name), sub: "Spazio verde", pt: featureCenter(s.f) });
    if (out.length >= limit) break;
  }
  return out;
}

// The Comune's own list, matched locally and offered FIRST: when a citizen types
// "monta", the recognised Parco della Montagnola should come before any green
// space that happens to share the letters.
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
      sub: "Rifugio del Comune",
      pt: f.geometry.coordinates,
    }));
}

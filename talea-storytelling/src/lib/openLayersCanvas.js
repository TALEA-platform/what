import OLMap from "ol/Map.js";
import View from "ol/View.js";
import Feature from "ol/Feature.js";
import GeoJSON from "ol/format/GeoJSON.js";
import LayerGroup from "ol/layer/Group.js";
import TileLayer from "ol/layer/Tile.js";
import VectorLayer from "ol/layer/Vector.js";
import Overlay from "ol/Overlay.js";
import VectorSource from "ol/source/Vector.js";
import XYZ from "ol/source/XYZ.js";
import CircleStyle from "ol/style/Circle.js";
import Fill from "ol/style/Fill.js";
import Stroke from "ol/style/Stroke.js";
import Style from "ol/style/Style.js";
import Text from "ol/style/Text.js";
import Attribution from "ol/control/Attribution.js";
import ScaleLine from "ol/control/ScaleLine.js";
import DoubleClickZoom from "ol/interaction/DoubleClickZoom.js";
import DragPan from "ol/interaction/DragPan.js";
import KeyboardPan from "ol/interaction/KeyboardPan.js";
import KeyboardZoom from "ol/interaction/KeyboardZoom.js";
import MouseWheelZoom from "ol/interaction/MouseWheelZoom.js";
import PinchZoom from "ol/interaction/PinchZoom.js";
import { asArray, toString as colorToString } from "ol/color.js";
import { getCenter as getExtentCenter } from "ol/extent.js";
import { unByKey } from "ol/Observable.js";
import { fromLonLat, toLonLat, transformExtent } from "ol/proj.js";
import { apply } from "ol-mapbox-style";
import { logPerformanceEvent } from "./mapPerformance";

const geojsonFormat = new GeoJSON();
const PAPER = "#F6F4EE";
const LAND = "#EFEBDF";
const ROAD = "#E6E1D3";
const ROAD_CASING = "#DAD3C3";
const ROAD_DASH = "#F3EFE4";
const PAPER_EXPLICIT = {
  water: ["fill-color", "#DBE0DF"],
  waterway: ["line-color", "#DBE0DF"],
  park: ["fill-color", "#E8E8D6"],
  landcover_wood: ["fill-color", "#E3E3D0"],
  landuse_residential: ["fill-color", "#F1EDE1"],
  building: ["fill-color", "#EBE7DA"],
};

function readSize(target) {
  return {
    width: target?.clientWidth ?? 0,
    height: target?.clientHeight ?? 0,
  };
}

export function observeOpenLayersMapSize(map, target, onResize) {
  let frame = null;
  let lastWidth = null;
  let lastHeight = null;
  let destroyed = false;

  const update = () => {
    frame = null;
    if (destroyed) return;
    const { width, height } = readSize(target);
    if (width <= 0 || height <= 0) return;
    if (width === lastWidth && height === lastHeight) return;
    lastWidth = width;
    lastHeight = height;
    map.updateSize();
    onResize?.({ width, height });
  };
  const request = () => {
    if (destroyed || frame !== null) return;
    frame = requestAnimationFrame(update);
  };
  const observer =
    typeof ResizeObserver === "function" ? new ResizeObserver(request) : null;
  observer?.observe(target);
  request();

  return {
    request,
    update,
    destroy() {
      destroyed = true;
      observer?.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
    },
  };
}

function cloneStyle(style) {
  return typeof structuredClone === "function"
    ? structuredClone(style)
    : JSON.parse(JSON.stringify(style));
}

async function prepareMapboxStyle(style, { hideLabels, paperBasemap, signal }) {
  if (!style) return null;
  const raw =
    typeof style === "string"
      ? await fetch(style, { signal }).then((response) => {
          if (!response.ok) throw new Error(`${style} ${response.status}`);
          return response.json();
        })
      : style;
  const prepared = cloneStyle(raw);
  if (hideLabels) {
    prepared.layers = prepared.layers?.filter((layer) => layer.type !== "symbol");
  }
  if (paperBasemap) {
    prepared.layers?.forEach((layer) => {
      layer.paint ||= {};
      if (layer.type === "background") {
        layer.paint["background-color"] = PAPER;
        return;
      }
      const explicit = PAPER_EXPLICIT[layer.id];
      if (explicit) {
        layer.paint[explicit[0]] = explicit[1];
        return;
      }
      if (layer.type === "line") {
        layer.paint["line-color"] = layer.id.endsWith("_dashline")
          ? ROAD_DASH
          : layer.id.includes("casing")
            ? ROAD_CASING
            : ROAD;
      } else if (layer.type === "fill") {
        layer.paint["fill-color"] = LAND;
      }
    });
  }
  return prepared;
}

function paddingArray(padding = 0) {
  if (typeof padding === "number") return [padding, padding, padding, padding];
  return [
    padding.top ?? 0,
    padding.right ?? 0,
    padding.bottom ?? 0,
    padding.left ?? 0,
  ];
}

function boundsArray(bounds) {
  if (!bounds) return null;
  if (typeof bounds.toArray === "function") return bounds.toArray();
  if (Array.isArray(bounds) && bounds.length === 4) {
    return [
      [bounds[0], bounds[1]],
      [bounds[2], bounds[3]],
    ];
  }
  return bounds;
}

function mapBoundsObject(bounds) {
  return {
    toArray: () => bounds,
    getCenter: () => ({
      lng: (bounds[0][0] + bounds[1][0]) / 2,
      lat: (bounds[0][1] + bounds[1][1]) / 2,
    }),
  };
}

function projectedExtent(bounds) {
  const array = boundsArray(bounds);
  if (!array) return null;
  return transformExtent(
    [array[0][0], array[0][1], array[1][0], array[1][1]],
    "EPSG:4326",
    "EPSG:3857",
  );
}

function adjustedCenter(center, zoom, padding, view) {
  const pad = paddingArray(padding);
  if (!pad.some(Boolean)) return fromLonLat(center);
  const resolution = view.getResolutionForZoom(zoom);
  const projected = fromLonLat(center);
  return [
    projected[0] - ((pad[3] - pad[1]) * resolution) / 2,
    projected[1] + ((pad[0] - pad[2]) * resolution) / 2,
  ];
}

function interpolateNumber(from, to, t) {
  return from + (to - from) * t;
}

function expressionValue(expression, feature, zoom, featureState = {}) {
  if (!Array.isArray(expression)) return expression;
  const [op, ...args] = expression;
  if (op === "get") return feature?.get?.(args[0]);
  if (op === "zoom") return zoom;
  if (op === "feature-state") return featureState[args[0]];
  if (op === "boolean") {
    const value = expressionValue(args[0], feature, zoom, featureState);
    return typeof value === "boolean" ? value : args[1];
  }
  if (op === "coalesce") {
    for (const arg of args) {
      const value = expressionValue(arg, feature, zoom, featureState);
      if (value !== null && value !== undefined) return value;
    }
    return null;
  }
  if (op === "*") {
    return args.reduce(
      (value, arg) => value * Number(expressionValue(arg, feature, zoom, featureState)),
      1,
    );
  }
  if (op === "==") {
    return (
      expressionValue(args[0], feature, zoom, featureState) ===
      expressionValue(args[1], feature, zoom, featureState)
    );
  }
  if (op === "case") {
    for (let index = 0; index < args.length - 1; index += 2) {
      if (expressionValue(args[index], feature, zoom, featureState)) {
        return expressionValue(args[index + 1], feature, zoom, featureState);
      }
    }
    return expressionValue(args.at(-1), feature, zoom, featureState);
  }
  if (op === "match") {
    const input = expressionValue(args[0], feature, zoom, featureState);
    for (let index = 1; index < args.length - 1; index += 2) {
      const candidate = args[index];
      if (
        (Array.isArray(candidate) && candidate.includes(input)) ||
        candidate === input
      ) {
        return expressionValue(args[index + 1], feature, zoom, featureState);
      }
    }
    return expressionValue(args.at(-1), feature, zoom, featureState);
  }
  if (op === "interpolate") {
    const input = Number(expressionValue(args[1], feature, zoom, featureState));
    const stops = args.slice(2);
    if (input <= Number(stops[0])) {
      return expressionValue(stops[1], feature, zoom, featureState);
    }
    for (let index = 0; index < stops.length - 2; index += 2) {
      const leftStop = Number(stops[index]);
      const rightStop = Number(stops[index + 2]);
      if (input > rightStop) continue;
      const left = expressionValue(stops[index + 1], feature, zoom, featureState);
      const right = expressionValue(stops[index + 3], feature, zoom, featureState);
      const t = (input - leftStop) / Math.max(1e-9, rightStop - leftStop);
      if (typeof left === "number" && typeof right === "number") {
        return interpolateNumber(left, right, t);
      }
      return t < 0.5 ? left : right;
    }
    return expressionValue(stops.at(-1), feature, zoom, featureState);
  }
  return expression;
}

function colorWithOpacity(color, opacity) {
  if (!color || opacity <= 0) return "rgba(0,0,0,0)";
  try {
    const rgba = [...asArray(color)];
    rgba[3] = (rgba[3] ?? 1) * Math.max(0, Math.min(1, opacity));
    return colorToString(rgba);
  } catch {
    return color;
  }
}

function lineDash(value, width) {
  return Array.isArray(value) ? value.map((part) => part * Math.max(1, width)) : undefined;
}

class VectorSourceAdapter {
  constructor(data, adapter) {
    this.adapter = adapter;
    this.source = new VectorSource();
    this.featureStates = new Map();
    this.loadToken = 0;
    this.abortController = null;
    this.setData(data);
  }

  async setData(data) {
    const token = ++this.loadToken;
    this.abortController?.abort();
    const abortController = typeof data === "string" ? new AbortController() : null;
    this.abortController = abortController;
    try {
      const value =
        typeof data === "string"
          ? await fetch(data, { signal: abortController.signal }).then((response) => {
              if (!response.ok) throw new Error(`${data} ${response.status}`);
              return response.json();
            })
          : data;
      if (token !== this.loadToken) return;
      const features = geojsonFormat.readFeatures(value, {
        dataProjection: "EPSG:4326",
        featureProjection: "EPSG:3857",
      });
      this.source.clear(true);
      this.source.addFeatures(features);
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.warn("[openlayers] GeoJSON source unavailable", error);
      }
    } finally {
      if (this.abortController === abortController) this.abortController = null;
    }
  }

  destroy() {
    this.loadToken += 1;
    this.abortController?.abort();
    this.abortController = null;
    this.featureStates.clear();
    this.source.clear(true);
  }
}

class RasterSourceAdapter {
  constructor(config) {
    this.source = new XYZ({
      url: config.tiles?.[0],
      tileSize: config.tileSize ?? 256,
      attributions: config.attribution,
      crossOrigin: "anonymous",
    });
  }

  destroy() {
    this.source.clear();
  }
}

function featureStateFor(record, feature) {
  return record.source.featureStates.get(feature.getId()) || {};
}

function resolvedPaint(record, property, feature, resolution, view) {
  const zoom = view.getZoomForResolution(resolution);
  const state = featureStateFor(record, feature);
  const transition = record.transitions.get(property);
  if (!transition) {
    return expressionValue(record.paint[property], feature, zoom, state);
  }
  const now = performance.now();
  const progress = Math.max(
    0,
    Math.min(1, (now - transition.start) / Math.max(1, transition.end - transition.start)),
  );
  const from = expressionValue(transition.from, feature, zoom, state);
  const to = expressionValue(transition.to, feature, zoom, state);
  if (typeof from === "number" && typeof to === "number") {
    return interpolateNumber(from, to, progress);
  }
  return progress < 1 ? from : to;
}

function filterMatches(record, feature, resolution, view) {
  if (!record.filter) return true;
  const zoom = view.getZoomForResolution(resolution);
  return Boolean(
    expressionValue(record.filter, feature, zoom, featureStateFor(record, feature)),
  );
}

function layerStyle(record, feature, resolution, view) {
  if (record.visibility === "none" || !filterMatches(record, feature, resolution, view)) {
    return null;
  }
  const paint = (property, fallback) =>
    resolvedPaint(record, property, feature, resolution, view) ?? fallback;

  if (record.type === "fill") {
    const opacity = Number(paint("fill-opacity", 1));
    return new Style({
      fill: new Fill({
        color: colorWithOpacity(paint("fill-color", "#000000"), opacity),
      }),
      stroke: record.paint["fill-outline-color"]
        ? new Stroke({
            color: colorWithOpacity(paint("fill-outline-color"), opacity),
            width: 1,
          })
        : undefined,
    });
  }
  if (record.type === "line") {
    const width = Number(paint("line-width", 1));
    return new Style({
      stroke: new Stroke({
        color: colorWithOpacity(
          paint("line-color", "#000000"),
          Number(paint("line-opacity", 1)),
        ),
        width,
        lineCap: record.layout["line-cap"] ?? "round",
        lineJoin: record.layout["line-join"] ?? "round",
        lineDash: lineDash(paint("line-dasharray"), width),
      }),
    });
  }
  if (record.type === "circle") {
    const radius = Math.max(0, Number(paint("circle-radius", 5)));
    return new Style({
      image: new CircleStyle({
        radius,
        fill: new Fill({
          color: colorWithOpacity(
            paint("circle-color", "#000000"),
            Number(paint("circle-opacity", 1)),
          ),
        }),
        stroke: new Stroke({
          color: colorWithOpacity(
            paint("circle-stroke-color", "rgba(0,0,0,0)"),
            Number(paint("circle-stroke-opacity", 1)),
          ),
          width: Number(paint("circle-stroke-width", 0)),
        }),
      }),
    });
  }
  if (record.type === "symbol") {
    const zoom = view.getZoomForResolution(resolution);
    if (record.minzoom != null && zoom < record.minzoom) return null;
    const state = featureStateFor(record, feature);
    const label = expressionValue(
      record.layout["text-field"],
      feature,
      zoom,
      state,
    );
    if (!label) return null;
    const size = Number(
      expressionValue(record.layout["text-size"], feature, zoom, state) ?? 12,
    );
    return new Style({
      text: new Text({
        text: String(label),
        font: `700 ${size}px "Noto Sans", sans-serif`,
        overflow: false,
        offsetY: 12,
        fill: new Fill({ color: paint("text-color", "#0b3d20") }),
        stroke: new Stroke({
          color: paint("text-halo-color", "rgba(255,255,255,0.94)"),
          width: Number(paint("text-halo-width", 1.5)) * 2,
        }),
      }),
    });
  }
  return null;
}

function createInteractionSet(interactive, cooperativeGestures) {
  const dragPan = new DragPan({
    condition: (event) => {
      const pointerType = event.originalEvent?.pointerType;
      return (
        pointerType !== "touch" ||
        !cooperativeGestures ||
        (event.activePointers?.length ?? 0) >= 2
      );
    },
  });
  const interactions = {
    dragPan,
    touchZoomRotate: new PinchZoom(),
    scrollZoom: new MouseWheelZoom({
      condition: (event) =>
        !cooperativeGestures ||
        Boolean(event.originalEvent?.ctrlKey || event.originalEvent?.metaKey),
    }),
    doubleClickZoom: new DoubleClickZoom(),
    keyboardPan: new KeyboardPan(),
    keyboardZoom: new KeyboardZoom(),
  };
  Object.values(interactions).forEach((interaction) => interaction.setActive(interactive));
  return interactions;
}

function interactionController(interaction) {
  return {
    enable: () => interaction?.setActive(true),
    disable: () => interaction?.setActive(false),
    isEnabled: () => Boolean(interaction?.getActive()),
    disableRotation: () => {},
  };
}

export function createOpenLayersCanvasMap({
  target,
  center,
  zoom,
  minZoom,
  maxZoom,
  interactive = true,
  cooperativeGestures = true,
  style = null,
  paperBasemap = false,
  hideLabels = false,
  background = "#F6F4EE",
  attribution = true,
  attributionLabel = "Attributions",
  scale = false,
  scaleMaxWidth = 110,
  mapName,
}) {
  const baseGroup = new LayerGroup();
  const interactionSet = createInteractionSet(interactive, cooperativeGestures);
  const controls = [];
  if (attribution) {
    controls.push(
      new Attribution({
        collapsible: true,
        collapsed: true,
        tipLabel: attributionLabel,
      }),
    );
  }
  if (scale) controls.push(new ScaleLine({ maxWidth: scaleMaxWidth, units: "metric" }));

  const view = new View({
    center: fromLonLat(center),
    zoom,
    minZoom,
    maxZoom,
    enableRotation: false,
  });
  const olMap = new OLMap({
    target,
    layers: [baseGroup],
    view,
    controls,
    interactions: Object.values(interactionSet),
    pixelRatio: window.devicePixelRatio || 1,
  });
  target.style.background = background;
  target.classList.add("ios-canvas-map");

  const listeners = new Map();
  const sources = new Map();
  const layers = new Map();
  const cleanups = [];
  let loaded = false;
  let removed = false;
  let lastInputEvent = null;
  let lastInputAt = 0;
  let transitionFrame = null;
  let resizeController;
  const styleAbortController = new AbortController();

  const emit = (type, event = {}) => {
    listeners.get(type)?.forEach((listener) => listener(event));
  };
  const noteInput = (event) => {
    lastInputEvent = event;
    lastInputAt = performance.now();
  };
  target.addEventListener("pointerdown", noteInput, { passive: true });
  target.addEventListener("wheel", noteInput, { passive: true });
  cleanups.push(() => {
    target.removeEventListener("pointerdown", noteInput);
    target.removeEventListener("wheel", noteInput);
  });

  const mapEvent = (event) => {
    const pixel = event.pixel ?? [0, 0];
    const coordinate = event.coordinate ?? olMap.getCoordinateFromPixel(pixel);
    const lngLat = coordinate ? toLonLat(coordinate) : center;
    return {
      ...event,
      point: { x: pixel[0], y: pixel[1] },
      lngLat: { lng: lngLat[0], lat: lngLat[1] },
      originalEvent: event.originalEvent,
    };
  };
  const olEventKeys = [
    olMap.on("singleclick", (event) => emit("click", mapEvent(event))),
    olMap.on("dblclick", (event) => emit("dblclick", mapEvent(event))),
    olMap.on("pointermove", (event) => emit("mousemove", mapEvent(event))),
    olMap.on("postrender", (event) => {
      emit("render", event);
      emit("move", event);
      emit("zoom", event);
    }),
    olMap.on("movestart", (event) => {
      const originalEvent =
        performance.now() - lastInputAt < 350 ? lastInputEvent : undefined;
      emit("dragstart", { ...event, originalEvent });
      emit("zoomstart", { ...event, originalEvent });
    }),
    olMap.on("moveend", (event) => {
      if (adapter._maxBounds) {
        const current = toLonLat(view.getCenter());
        const [[west, south], [east, north]] = adapter._maxBounds;
        const constrained = [
          Math.max(west, Math.min(east, current[0])),
          Math.max(south, Math.min(north, current[1])),
        ];
        if (constrained[0] !== current[0] || constrained[1] !== current[1]) {
          view.setCenter(fromLonLat(constrained));
        }
      }
      emit("dragend", event);
      emit("zoomend", event);
    }),
  ];

  const requestTransitionFrame = () => {
    if (transitionFrame !== null || removed) return;
    transitionFrame = requestAnimationFrame(() => {
      transitionFrame = null;
      let active = false;
      const now = performance.now();
      layers.forEach((record) => {
        record.transitions.forEach((transition, property) => {
          if (now >= transition.end) {
            record.paint[property] = transition.to;
            record.transitions.delete(property);
          } else {
            active = true;
          }
        });
        if (record.transitions.size) record.layer.changed();
      });
      if (active) requestTransitionFrame();
    });
  };

  const adapter = {
    backend: "openlayers-canvas",
    _olMap: olMap,
    _removed: false,
    _locale: {},
    on(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
      if (type === "load" && loaded) queueMicrotask(() => listener({ target: adapter }));
      return adapter;
    },
    once(type, listener) {
      const wrapped = (event) => {
        adapter.off(type, wrapped);
        listener(event);
      };
      return adapter.on(type, wrapped);
    },
    off(type, listener) {
      listeners.get(type)?.delete(listener);
      return adapter;
    },
    getContainer: () => target,
    getCanvas: () => target.querySelector(".ol-viewport") || target,
    getCenter() {
      const value = toLonLat(view.getCenter());
      return { lng: value[0], lat: value[1] };
    },
    getZoom: () => view.getZoom(),
    getBearing: () => 0,
    getPitch: () => 0,
    getMinZoom: () => view.getMinZoom(),
    getMaxZoom: () => view.getMaxZoom(),
    setMinZoom(value) {
      view.setMinZoom(value);
    },
    setMaxZoom(value) {
      view.setMaxZoom(value);
    },
    setMaxBounds(value) {
      adapter._maxBounds = value ? boundsArray(value) : null;
    },
    getMaxBounds() {
      return adapter._maxBounds ? mapBoundsObject(adapter._maxBounds) : null;
    },
    getBounds() {
      const size = olMap.getSize();
      const extent = view.calculateExtent(size);
      const bounds = transformExtent(extent, "EPSG:3857", "EPSG:4326");
      return mapBoundsObject([
        [bounds[0], bounds[1]],
        [bounds[2], bounds[3]],
      ]);
    },
    project(lonLat) {
      const pixel = olMap.getPixelFromCoordinate(fromLonLat(lonLat));
      return { x: pixel?.[0] ?? 0, y: pixel?.[1] ?? 0 };
    },
    fitBounds(bounds, options = {}) {
      const extent = projectedExtent(bounds);
      if (!extent) return;
      view.fit(extent, {
        padding: paddingArray(options.padding),
        duration: options.duration ?? 0,
        easing: options.easing,
        maxZoom: options.maxZoom,
      });
    },
    cameraForBounds(bounds, options = {}) {
      const extent = projectedExtent(bounds);
      const size = olMap.getSize();
      if (!extent || !size) return null;
      const pad = paddingArray(options.padding);
      const available = [
        Math.max(1, size[0] - pad[1] - pad[3]),
        Math.max(1, size[1] - pad[0] - pad[2]),
      ];
      const resolution = view.getResolutionForExtent(extent, available);
      let targetZoom = view.getZoomForResolution(resolution);
      if (options.maxZoom != null) targetZoom = Math.min(targetZoom, options.maxZoom);
      const center3857 = getExtentCenter(extent);
      const targetResolution = view.getResolutionForZoom(targetZoom);
      center3857[0] -= ((pad[3] - pad[1]) * targetResolution) / 2;
      center3857[1] += ((pad[0] - pad[2]) * targetResolution) / 2;
      return { center: toLonLat(center3857), zoom: targetZoom };
    },
    flyTo(options = {}) {
      const nextZoom = options.zoom ?? view.getZoom();
      view.cancelAnimations();
      view.animate({
        center: options.center
          ? adjustedCenter(options.center, nextZoom, options.padding, view)
          : undefined,
        zoom: nextZoom,
        duration: options.duration ?? 0,
        easing: options.easing,
      });
    },
    easeTo(options) {
      adapter.flyTo(options);
    },
    jumpTo(options = {}) {
      view.cancelAnimations();
      if (options.center) view.setCenter(fromLonLat(options.center));
      if (options.zoom != null) view.setZoom(options.zoom);
    },
    stop() {
      view.cancelAnimations();
    },
    resize() {
      resizeController?.request();
    },
    updateSize() {
      resizeController?.request();
    },
    addSource(id, config) {
      if (sources.has(id)) return;
      sources.set(
        id,
        config.type === "raster"
          ? new RasterSourceAdapter(config)
          : new VectorSourceAdapter(config.data, adapter),
      );
    },
    getSource: (id) => sources.get(id) ?? null,
    removeSource(id) {
      sources.get(id)?.destroy?.();
      sources.delete(id);
    },
    addLayer(config, beforeId) {
      if (layers.has(config.id)) return;
      const source = sources.get(config.source);
      let layer;
      if (config.type === "raster") {
        layer = new TileLayer({ source: source?.source });
        const filter = [];
        const saturation = Number(config.paint?.["raster-saturation"] ?? 0);
        const contrast = Number(config.paint?.["raster-contrast"] ?? 0);
        const brightness = Number(config.paint?.["raster-brightness-max"] ?? 1);
        if (saturation) filter.push(`saturate(${Math.max(0, 1 + saturation)})`);
        if (contrast) filter.push(`contrast(${Math.max(0, 1 + contrast)})`);
        if (brightness !== 1) filter.push(`brightness(${brightness})`);
        if (filter.length) {
          layer.on("prerender", ({ context }) => {
            context.save();
            context.filter = filter.join(" ");
          });
          layer.on("postrender", ({ context }) => context.restore());
        }
      } else {
        const record = {
          id: config.id,
          type: config.type,
          source,
          paint: { ...(config.paint || {}) },
          layout: { ...(config.layout || {}) },
          filter: config.filter ?? null,
          minzoom: config.minzoom,
          transitions: new Map(),
          visibility: config.layout?.visibility,
          layer: null,
        };
        layer = new VectorLayer({
          source: source?.source,
          style: (feature, resolution) => layerStyle(record, feature, resolution, view),
          updateWhileAnimating: false,
          updateWhileInteracting: false,
          declutter: config.type === "symbol",
        });
        record.layer = layer;
        layers.set(config.id, record);
      }
      if (config.type === "raster") {
        layers.set(config.id, {
          id: config.id,
          type: config.type,
          source,
          paint: { ...(config.paint || {}) },
          layout: { ...(config.layout || {}) },
          transitions: new Map(),
          layer,
        });
      }
      const before = beforeId ? layers.get(beforeId)?.layer : null;
      const collection = olMap.getLayers();
      const beforeIndex = before ? collection.getArray().indexOf(before) : -1;
      if (beforeIndex >= 0) collection.insertAt(beforeIndex, layer);
      else collection.push(layer);
    },
    getLayer: (id) => layers.get(id) ?? null,
    removeLayer(id) {
      const record = layers.get(id);
      if (!record) return;
      olMap.removeLayer(record.layer);
      layers.delete(id);
    },
    getStyle() {
      return { layers: [...layers.values()].map((record) => ({ id: record.id, type: record.type })) };
    },
    setLayoutProperty(id, property, value) {
      const record = layers.get(id);
      if (!record) return;
      record.layout[property] = value;
      if (property === "visibility") record.visibility = value;
      record.layer.changed();
    },
    getPaintProperty(id, property) {
      return layers.get(id)?.paint[property];
    },
    setPaintProperty(id, property, value) {
      const record = layers.get(id);
      if (!record) return;
      if (property.endsWith("-transition")) {
        record.paint[property] = value;
        return;
      }
      const transition = record.paint[`${property}-transition`];
      if (transition?.duration > 0) {
        const start = performance.now() + (transition.delay ?? 0);
        record.transitions.set(property, {
          from: record.paint[property],
          to: value,
          start,
          end: start + transition.duration,
        });
        requestTransitionFrame();
      } else {
        record.transitions.delete(property);
      }
      record.paint[property] = value;
      record.layer.setOpacity?.(
        property === "raster-opacity" && typeof value === "number" ? value : record.layer.getOpacity(),
      );
      record.layer.changed();
    },
    setFilter(id, filter) {
      const record = layers.get(id);
      if (!record) return;
      record.filter = filter;
      record.layer.changed();
    },
    setFeatureState({ source: sourceId, id }, state) {
      const source = sources.get(sourceId);
      if (!source) return;
      source.featureStates.set(id, { ...(source.featureStates.get(id) || {}), ...state });
      layers.forEach((record) => {
        if (record.source === source) record.layer.changed();
      });
    },
    queryRenderedFeatures(pixelOrBox, options = {}) {
      const requested = new Set(options.layers || []);
      const box = Array.isArray(pixelOrBox?.[0]) ? pixelOrBox : null;
      const pixel = box
        ? [
            (box[0][0] + box[1][0]) / 2,
            (box[0][1] + box[1][1]) / 2,
          ]
        : [pixelOrBox.x ?? pixelOrBox[0], pixelOrBox.y ?? pixelOrBox[1]];
      const hitTolerance = box ? Math.max(1, Math.abs(box[1][0] - box[0][0]) / 2) : 0;
      const found = [];
      olMap.forEachFeatureAtPixel(
        pixel,
        (feature, layer) => {
          const record = [...layers.values()].find((item) => item.layer === layer);
          if (!record || (requested.size && !requested.has(record.id))) return undefined;
          const object = geojsonFormat.writeFeatureObject(feature, {
            dataProjection: "EPSG:4326",
            featureProjection: "EPSG:3857",
          });
          object.layer = { id: record.id };
          found.push(object);
          return undefined;
        },
        { hitTolerance },
      );
      return found;
    },
    addControl() {},
    scrollZoom: interactionController(interactionSet.scrollZoom),
    boxZoom: interactionController(null),
    doubleClickZoom: interactionController(interactionSet.doubleClickZoom),
    dragRotate: interactionController(null),
    dragPan: interactionController(interactionSet.dragPan),
    keyboard: {
      enable() {
        interactionSet.keyboardPan.setActive(true);
        interactionSet.keyboardZoom.setActive(true);
      },
      disable() {
        interactionSet.keyboardPan.setActive(false);
        interactionSet.keyboardZoom.setActive(false);
      },
    },
    touchZoomRotate: interactionController(interactionSet.touchZoomRotate),
    touchPitch: interactionController(null),
    remove() {
      if (removed) return;
      removed = true;
      adapter._removed = true;
      view.cancelAnimations();
      styleAbortController.abort();
      if (transitionFrame !== null) cancelAnimationFrame(transitionFrame);
      resizeController?.destroy();
      cleanups.forEach((cleanup) => cleanup());
      unByKey(olEventKeys);
      listeners.clear();
      sources.forEach((source) => source.destroy?.());
      sources.clear();
      layers.clear();
      olMap.getOverlays().clear();
      olMap.getLayers().clear();
      olMap.setTarget(undefined);
      target.classList.remove("ios-canvas-map");
      logPerformanceEvent(`${mapName?.toLowerCase()}:ol:destroy`, { mapName });
    },
  };

  resizeController = observeOpenLayersMapSize(olMap, target, (size) => {
    emit("resize", { target: adapter, size, taleaApplicationResize: true });
  });

  adapter.ready = (async () => {
    try {
      const prepared = await prepareMapboxStyle(style, {
        hideLabels,
        paperBasemap,
        signal: styleAbortController.signal,
      });
      if (prepared && !removed) await apply(baseGroup, prepared);
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.warn(`[${mapName || "map"}:ol] basemap style unavailable`, error);
      }
    }
    if (removed) return adapter;
    loaded = true;
    olMap.renderSync();
    emit("load", { target: adapter });
    logPerformanceEvent(`${mapName?.toLowerCase()}:ol:create`, {
      mapName,
      backend: "openlayers-canvas",
      canvasCount: target.querySelectorAll("canvas").length,
    });
    return adapter;
  })();

  return adapter;
}

export function createOpenLayersMarker({ color = "#FFE604" } = {}) {
  const element = document.createElement("span");
  element.className = "ios-ol-marker";
  element.style.setProperty("--marker-color", color);
  const overlay = new Overlay({ element, positioning: "bottom-center", stopEvent: false });
  let map = null;
  let coordinate = null;
  return {
    setLngLat(lonLat) {
      coordinate = fromLonLat(lonLat);
      overlay.setPosition(coordinate);
      return this;
    },
    addTo(nextMap) {
      map = nextMap;
      nextMap._olMap.addOverlay(overlay);
      if (coordinate) overlay.setPosition(coordinate);
      return this;
    },
    remove() {
      map?._olMap.removeOverlay(overlay);
      map = null;
    },
  };
}

export function createOpenLayersPopup({ offset = 16 } = {}) {
  const element = document.createElement("div");
  element.className = "maplibregl-popup maplibregl-popup-anchor-bottom ios-ol-popup";
  const tip = document.createElement("div");
  tip.className = "maplibregl-popup-tip";
  const content = document.createElement("div");
  content.className = "maplibregl-popup-content";
  element.append(content, tip);
  const overlay = new Overlay({
    element,
    positioning: "bottom-center",
    offset: [0, -offset],
    stopEvent: false,
  });
  let map = null;
  return {
    setLngLat(lonLat) {
      overlay.setPosition(fromLonLat(lonLat));
      return this;
    },
    setHTML(html) {
      content.innerHTML = html;
      return this;
    },
    addTo(nextMap) {
      if (map && map !== nextMap) map._olMap.removeOverlay(overlay);
      map = nextMap;
      nextMap._olMap.addOverlay(overlay);
      return this;
    },
    remove() {
      map?._olMap.removeOverlay(overlay);
      map = null;
      return this;
    },
  };
}

export function createGeoJSONVectorSource(data) {
  return new VectorSource({
    features:
      typeof data === "string"
        ? undefined
        : geojsonFormat.readFeatures(data, {
            dataProjection: "EPSG:4326",
            featureProjection: "EPSG:3857",
          }),
    url: typeof data === "string" ? data : undefined,
    format: typeof data === "string" ? new GeoJSON() : undefined,
  });
}

export function readGeoJSONFeatures(data) {
  return geojsonFormat.readFeatures(data, {
    dataProjection: "EPSG:4326",
    featureProjection: "EPSG:3857",
  });
}

export {
  CircleStyle,
  Feature,
  Fill,
  Stroke,
  Style,
  Text,
  TileLayer,
  VectorLayer,
  VectorSource,
  XYZ,
  fromLonLat,
  toLonLat,
};

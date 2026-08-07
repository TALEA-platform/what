import { Fragment, useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import { MapLibreCanvas } from "../maps/MapLibreCanvas";
import { SectionDivider } from "./SectionDivider";
import { assetUrl } from "../../lib/assetUrl";
import {
  title,
  aperture,
  apertureCauseParts,
  apertureClose,
  causeStages,
  handleHint,
  lensLegends,
  hotspotLegendLabel,
  greenTopicWord,
  materialsTopicWord,
} from "../../data/causesScene";
import { getHotspotGeojsonUrl } from "../../data/hotspotData";
import { cameraEasing } from "../../lib/motion";

const transparentCauseMapStyle = {
  version: 8,
  sources: {},
  layers: [
    {
      id: "transparent-background",
      type: "background",
      paint: { "background-opacity": 0 },
    },
  ],
};
const overlayManifestUrl = assetUrl("/data/physical-drivers/physical_driver_overlays.json");

// Camera held on the centro storico of Bologna for the whole scene. It only nudges
// in slightly when the crop centres for the compare. The NDVI↔albedo crossfade
// happens WITHOUT moving the camera.
const CAUSES_CENTER = [11.3438, 44.4949];
const CAUSES_ZOOM = 12.5;
const CAUSES_ZOOM_CLOSE = 13.0;

/**
 * Il tempo del ritaglio — gemello JS di `--causes-crop-ms` in story.css.
 *
 * Chiude il punto lasciato aperto da 01 (deviazione 4). `01 § 1.5` porta tutte
 * le camere a `--dur-camera` (2000 ms), ma questa **non è una camera
 * narrativa**: è il ricentraggio che accompagna un riquadro che cambia misura
 * in CSS. Deve durare quanto la transizione del riquadro, non quanto un volo
 * sopra la città: a 2 s la scivolata sinistra↔destra, che è il gesto
 * caratteristico di questa scena, diventerebbe molle — e `06` chiede
 * esplicitamente che quel movimento resti invariato.
 *
 * Restano quindi agganciati fra loro tre valori: la transizione CSS del
 * riquadro, questa camera e il `setTimeout` che rimette a posto la mappa quando
 * il riquadro ha finito di animarsi. Se cambia uno, cambiano tutti e tre.
 */
const CROP_MS = 900;
const CROP_SETTLE_MS = CROP_MS + 60;

/**
 * Rete di sicurezza per la comparsa del ritaglio (06 § 6.4).
 *
 * La mappa si dichiara pronta con l'evento `idle`, che però non arriva mai se
 * i tile non tornano — o se la scheda è in secondo piano, dove WebGL è
 * congelato. Dopo questo tempo il ritaglio si scopre comunque: meglio una mappa
 * che finisce di disegnarsi sotto gli occhi del lettore che una campitura
 * ferma per sempre.
 */
const CROP_READY_FALLBACK_MS = 2600;

// Hotspots are shown ONLY in the compare. Use the top-10% outline recurring in
// at least 9 of 13 summers, so the split map highlights the strongest signal.
const HOTSPOT_URL = getHotspotGeojsonUrl(9);
const HOTSPOT_FILL = "#c1272d";

const rasterIds = ["green", "absorbing"];
const rasterSourceId = (id) => `cause-raster-${id}-src`;
const rasterLayerId = (id) => `cause-raster-${id}-layer`;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

function addLayerBeforeLabels(map, layer) {
  const firstSymbol = map.getStyle().layers?.find((l) => l.type === "symbol")?.id;
  if (firstSymbol) map.addLayer(layer, firstSymbol);
  else map.addLayer(layer);
}

function ensureRasterLayers(map, manifest) {
  if (!manifest) return;
  rasterIds.forEach((id) => {
    const overlay = manifest.layers?.[id];
    if (!overlay) return;
    if (!map.getSource(rasterSourceId(id))) {
      map.addSource(rasterSourceId(id), {
        type: "image",
        url: assetUrl(overlay.url),
        coordinates: overlay.coordinates,
      });
    }
    if (!map.getLayer(rasterLayerId(id))) {
      addLayerBeforeLabels(map, {
        id: rasterLayerId(id),
        type: "raster",
        source: rasterSourceId(id),
        paint: {
          "raster-opacity": id === "green" ? 1 : 0,
          "raster-opacity-transition": { duration: 700, delay: 0 },
          "raster-fade-duration": 0,
        },
      });
    }
  });
}

// Persistent-hotspot outline (≥9 estati). Added above basemap labels; opacity 0
// by default and only lit in the compare.
function ensureHotspotLayers(map) {
  if (!map.getSource("cause-hotspots-src")) {
    map.addSource("cause-hotspots-src", { type: "geojson", data: HOTSPOT_URL });
  } else {
    map.getSource("cause-hotspots-src")?.setData?.(HOTSPOT_URL);
  }
  if (!map.getLayer("cause-hotspots-fill")) {
    addLayerBeforeLabels(map, {
      id: "cause-hotspots-fill",
      type: "fill",
      source: "cause-hotspots-src",
      paint: {
        "fill-color": HOTSPOT_FILL,
        "fill-opacity": 0,
        "fill-opacity-transition": { duration: 450, delay: 0 },
      },
    });
  }
  // White CASING beneath the red outline → the borders stay legible on BOTH the
  // green and the grey (albedo) halves of the split.
  if (!map.getLayer("cause-hotspots-casing")) {
    addLayerBeforeLabels(map, {
      id: "cause-hotspots-casing",
      type: "line",
      source: "cause-hotspots-src",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#ffffff",
        "line-width": 3.4,
        "line-opacity": 0,
        "line-opacity-transition": { duration: 450, delay: 0 },
      },
    });
  }
  if (!map.getLayer("cause-hotspots-line")) {
    addLayerBeforeLabels(map, {
      id: "cause-hotspots-line",
      type: "line",
      source: "cause-hotspots-src",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": HOTSPOT_FILL,
        "line-width": 1.7,
        "line-opacity": 0,
        "line-opacity-transition": { duration: 450, delay: 0 },
      },
    });
  }
}

function setHotspotVisible(map, visible) {
  const reduce = prefersReducedMotion();
  const dur = reduce ? 0 : 450;
  if (map.getLayer("cause-hotspots-fill")) {
    map.setPaintProperty("cause-hotspots-fill", "fill-opacity-transition", { duration: dur });
    map.setPaintProperty("cause-hotspots-fill", "fill-opacity", 0);
  }
  if (map.getLayer("cause-hotspots-casing")) {
    map.setPaintProperty("cause-hotspots-casing", "line-opacity", visible ? 0.55 : 0);
  }
  if (map.getLayer("cause-hotspots-line")) {
    map.setPaintProperty("cause-hotspots-line", "line-opacity", visible ? 0.92 : 0);
  }
}

function cameraFromMap(map) {
  const center = map.getCenter();
  const zoom = map.getZoom();
  const bearing = map.getBearing();
  const pitch = map.getPitch();
  return {
    center: Number.isFinite(center?.lng) && Number.isFinite(center?.lat)
      ? [center.lng, center.lat]
      : CAUSES_CENTER,
    zoom: Number.isFinite(zoom) ? zoom : CAUSES_ZOOM_CLOSE,
    bearing: Number.isFinite(bearing) ? bearing : 0,
    pitch: Number.isFinite(pitch) ? pitch : 0,
  };
}

// Scalda **tutti** i raster del manifest, non solo quelli del confronto: il
// verde della prima tappa è il primo che si vede, ed è quello che non deve far
// aspettare (06 § 6.4). Parte al montaggio della sezione, cioè molte schermate
// prima che la scena si agganci.
function preloadCompareAssets() {
  if (typeof Image === "undefined") return () => {};

  let cancelled = false;
  const images = [];

  fetch(overlayManifestUrl)
    .then((r) => r.json())
    .then((manifest) => {
      if (cancelled) return;
      Object.values(manifest.layers ?? {}).forEach((layer) => {
        const image = new Image();
        image.decoding = "async";
        image.src = assetUrl(layer.url);
        images.push(image);
      });
    })
    .catch(() => {});

  fetch(HOTSPOT_URL, { cache: "reload" }).catch(() => {});

  return () => {
    cancelled = true;
    images.length = 0;
  };
}

// Base crop map: NDVI + albedo overlays crossfading by `lens`, plus the hotspot
// fill (shown only when `showHotspots`). The camera stays on the centro storico.
function CausesCropMap({ lens, expanded, showHotspots, onBaseMapReady, onDrawnChange }) {
  const [map, setMap] = useState(null);
  const [manifest, setManifest] = useState(null);
  const wrapRef = useRef(null);

  const handleReady = useCallback(
    (m) => {
      setMap(m);
      onBaseMapReady?.(m);
    },
    [onBaseMapReady],
  );

  useEffect(() => {
    let ignore = false;
    fetch(overlayManifestUrl)
      .then((r) => r.json())
      .then((data) => {
        if (!ignore) setManifest(data);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!map || !manifest) return;
    ensureRasterLayers(map, manifest);
    ensureHotspotLayers(map);
  }, [map, manifest]);

  // «Il ritaglio non entra mai vuoto» (06 § 6.4). Il riquadro arriva subito con
  // la sua campitura di carta; la mappa gli passa sopra in dissolvenza solo
  // quando ha finito di disegnarsi. `idle` scatta dopo che i tile e l'immagine
  // del raster sono a posto — è l'unico momento onesto per dire «pronta» — e il
  // timer è la rete di sicurezza per quando quell'evento non arriva.
  useEffect(() => {
    if (!map || !manifest) return undefined;
    let done = false;
    const markDrawn = () => {
      if (done) return;
      done = true;
      onDrawnChange?.(true);
    };
    map.once("idle", markDrawn);
    const timer = window.setTimeout(markDrawn, CROP_READY_FALLBACK_MS);
    return () => {
      window.clearTimeout(timer);
      map.off("idle", markDrawn);
    };
  }, [map, manifest, onDrawnChange]);

  // Crossfade by lens (camera does NOT move). compare keeps the green base lit;
  // the albedo half is painted by the synced overlay map.
  useEffect(() => {
    if (!map || !manifest) return;
    const reduce = prefersReducedMotion();
    const target = { green: 0, absorbing: 0 };
    if (lens === "green") target.green = 1;
    else if (lens === "materials") target.absorbing = 1;
    else if (lens === "compare") target.green = 1;

    rasterIds.forEach((id) => {
      if (!map.getLayer(rasterLayerId(id))) return;
      map.setPaintProperty(rasterLayerId(id), "raster-opacity-transition", {
        duration: reduce ? 0 : 700,
        delay: 0,
      });
      map.setPaintProperty(rasterLayerId(id), "raster-opacity", target[id]);
    });
  }, [map, manifest, lens]);

  // Hotspots only in the compare.
  useEffect(() => {
    if (!map || !manifest) return;
    setHotspotVisible(map, showHotspots);
  }, [map, manifest, showHotspots]);

  // Keep Bologna centred on EVERY stage (not just the compare). The crop changes
  // size in CSS; we resize during the transition and settle the camera once the
  // frame has finished animating, so MapLibre never keeps a transient offset.
  useEffect(() => {
    if (!map) return;
    const reduce = prefersReducedMotion();
    const zoom = expanded ? CAUSES_ZOOM_CLOSE : CAUSES_ZOOM;
    map.stop();
    map.resize();
    map.jumpTo({ center: CAUSES_CENTER, bearing: 0, pitch: 0 });

    if (Math.abs(map.getZoom() - zoom) > 0.01) {
      map.easeTo({
        center: CAUSES_CENTER,
        zoom,
        duration: reduce ? 0 : CROP_MS,
        // `essential: true` o la camera non parte quando il sistema chiede meno
        // movimento, e la scena sembra rotta invece che sobria (CONTESTO § 4.4).
        essential: true,
        easing: cameraEasing,
      });
    }

    const settleId = setTimeout(() => {
      map.stop();
      map.resize();
      map.jumpTo({ center: CAUSES_CENTER, zoom, bearing: 0, pitch: 0 });
    }, reduce ? 0 : CROP_SETTLE_MS);

    return () => clearTimeout(settleId);
  }, [map, expanded]);

  // Keep the GL canvas sized to its (animating) frame.
  useEffect(() => {
    if (!map || !wrapRef.current) return;
    let frame = null;
    const resize = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        map.resize();
      });
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrapRef.current);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [map]);

  return (
    <div ref={wrapRef} className="causes-crop-map">
      <MapLibreCanvas
        onMapReady={handleReady}
        className="causes-crop-canvas"
        mapStyle={transparentCauseMapStyle}
        center={CAUSES_CENTER}
        zoom={CAUSES_ZOOM}
        minZoom={11}
        maxZoom={15}
      />
    </div>
  );
}

// Synchronized albedo overlay for the compare, clipped by the slider. Mirrors the
// base camera and paints ONLY the grayscale albedo raster + hotspot fill. It uses
// a transparent style so no second basemap/label stack can flicker during loading.
function CausesCompareOverlay({ baseMap, sliderValue, onReadyChange }) {
  const containerRef = useRef(null);
  const [overlayMap, setOverlayMap] = useState(null);
  const [manifest, setManifest] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: transparentCauseMapStyle,
      center: CAUSES_CENTER,
      zoom: CAUSES_ZOOM,
      minZoom: 11,
      maxZoom: 15,
      attributionControl: false,
      interactive: false,
      fadeDuration: 0,
      trackResize: false,
      canvasContextAttributes: { alpha: true, antialias: true },
    });
    map.on("load", () => setOverlayMap(map));
    return () => {
      setOverlayMap(null);
      map.remove();
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    fetch(overlayManifestUrl)
      .then((r) => r.json())
      .then((data) => {
        if (!ignore) setManifest(data);
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!overlayMap || !manifest) return;
    const overlay = manifest.layers?.absorbing;
    if (!overlay) return;
    if (!overlayMap.getSource("cause-overlay-albedo-src")) {
      overlayMap.addSource("cause-overlay-albedo-src", {
        type: "image",
        url: assetUrl(overlay.url),
        coordinates: overlay.coordinates,
      });
    }
    if (!overlayMap.getLayer("cause-overlay-albedo-layer")) {
      const firstSymbol = overlayMap.getStyle().layers?.find((l) => l.type === "symbol")?.id;
      overlayMap.addLayer(
        {
          id: "cause-overlay-albedo-layer",
          type: "raster",
          source: "cause-overlay-albedo-src",
          paint: { "raster-opacity": 1, "raster-fade-duration": 0 },
        },
        firstSymbol,
      );
    }
    ensureHotspotLayers(overlayMap);
    setHotspotVisible(overlayMap, true);

    const markReady = () => {
      overlayMap.resize();
      setReady(true);
      onReadyChange?.(true);
    };
    if (overlayMap.loaded()) requestAnimationFrame(markReady);
    else overlayMap.once("idle", markReady);

    return () => {
      overlayMap.off("idle", markReady);
      onReadyChange?.(false);
    };
  }, [overlayMap, manifest, onReadyChange]);

  // Lockstep with the base camera. Sync on "move" (fires every frame of any
  // camera animation — pan/zoom/easeTo) and "moveend" for the settled position.
  // NOT on "render" — that fires on every tile fade too and caused the overlay to
  // jumpTo continuously → the flicker (§7).
  useEffect(() => {
    if (!overlayMap || !baseMap) return;
    let frame = null;
    const syncToBase = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        overlayMap.jumpTo(cameraFromMap(baseMap));
      });
    };
    syncToBase();
    baseMap.on("move", syncToBase);
    baseMap.on("moveend", syncToBase);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      baseMap.off("move", syncToBase);
      baseMap.off("moveend", syncToBase);
    };
  }, [overlayMap, baseMap]);

  // Resize the overlay to match the (animating) crop, then re-sync to the base so
  // the two halves stay perfectly aligned when shown (§6, §7).
  useEffect(() => {
    if (!overlayMap || !containerRef.current) return;
    let frame = null;
    const syncSize = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        overlayMap.resize();
        if (baseMap) {
          overlayMap.jumpTo(cameraFromMap(baseMap));
        }
      });
    };
    const ro = new ResizeObserver(syncSize);
    ro.observe(containerRef.current);
    requestAnimationFrame(syncSize);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [overlayMap, baseMap]);

  return (
    <div
      ref={containerRef}
      className={`causes-compare-overlay${ready ? " causes-compare-overlay--visible" : ""}`}
      style={{ clipPath: `inset(0 0 0 ${sliderValue}%)` }}
      aria-hidden="true"
    />
  );
}

function CausesCompareBaseMap({ onBaseMapReady, onDrawnChange }) {
  const [map, setMap] = useState(null);
  const [manifest, setManifest] = useState(null);
  const wrapRef = useRef(null);

  const handleReady = useCallback(
    (m) => {
      setMap(m);
      onBaseMapReady?.(m);
    },
    [onBaseMapReady],
  );

  useEffect(() => {
    let ignore = false;
    fetch(overlayManifestUrl)
      .then((r) => r.json())
      .then((data) => {
        if (!ignore) setManifest(data);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!map || !manifest) return;
    ensureRasterLayers(map, manifest);
    ensureHotspotLayers(map);
    rasterIds.forEach((id) => {
      if (!map.getLayer(rasterLayerId(id))) return;
      map.setPaintProperty(rasterLayerId(id), "raster-opacity-transition", { duration: 0, delay: 0 });
      map.setPaintProperty(rasterLayerId(id), "raster-opacity", id === "green" ? 1 : 0);
    });
    setHotspotVisible(map, true);
  }, [map, manifest]);

  // Stessa regola del ritaglio: il confronto sale solo quando **tutte e due** le
  // sue mappe hanno finito di disegnarsi. Prima bastava che fosse pronto lo
  // strato dell'albedo, e la metà di sinistra poteva arrivare in ritardo.
  useEffect(() => {
    if (!map || !manifest) return undefined;
    let done = false;
    const markDrawn = () => {
      if (done) return;
      done = true;
      onDrawnChange?.(true);
    };
    map.once("idle", markDrawn);
    const timer = window.setTimeout(markDrawn, CROP_READY_FALLBACK_MS);
    return () => {
      window.clearTimeout(timer);
      map.off("idle", markDrawn);
    };
  }, [map, manifest, onDrawnChange]);

  useEffect(() => {
    if (!map || !wrapRef.current) return;
    let frame = null;
    const resize = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        map.resize();
        map.jumpTo({ center: CAUSES_CENTER, zoom: CAUSES_ZOOM_CLOSE, bearing: 0, pitch: 0 });
      });
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrapRef.current);
    requestAnimationFrame(resize);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [map]);

  return (
    <div ref={wrapRef} className="causes-compare-base-map">
      <MapLibreCanvas
        onMapReady={handleReady}
        className="causes-compare-base-canvas"
        mapStyle={transparentCauseMapStyle}
        center={CAUSES_CENTER}
        zoom={CAUSES_ZOOM_CLOSE}
        minZoom={11}
        maxZoom={15}
      />
    </div>
  );
}

function CausesCompareMap({
  sliderValue,
  onSliderChange,
  visible,
  exiting,
  active,
  cropRef,
  demoPlayed,
  onDemoEnd,
}) {
  const [baseMap, setBaseMap] = useState(null);
  const [overlayReady, setOverlayReady] = useState(false);
  const [baseDrawn, setBaseDrawn] = useState(false);
  const reveal = visible && overlayReady && baseDrawn && !exiting;

  // Continuous upward motion: the map rises into place from just below as the
  // description clears (reveal), then drifts further up + fades as it leaves (exit).
  let opacity = 0;
  let transform = "translate(-50%, calc(-50% + 30px)) scale(0.98)";
  if (exiting) {
    opacity = 0;
    transform = "translate(-50%, calc(-50% - 16px)) scale(0.98)";
  } else if (reveal) {
    opacity = 1;
    transform = "translate(-50%, -50%) scale(1)";
  }

  return (
    <div
      ref={cropRef}
      className={`causes-compare-crop${reveal ? " causes-compare-crop--visible" : ""}${exiting ? " causes-compare-crop--exiting" : ""}`}
      aria-hidden={!reveal}
      style={{
        opacity,
        transform,
        pointerEvents: reveal ? "auto" : "none",
      }}
    >
      <CausesCompareBaseMap onBaseMapReady={setBaseMap} onDrawnChange={setBaseDrawn} />
      <CausesCompareOverlay
        baseMap={baseMap}
        sliderValue={sliderValue}
        onReadyChange={setOverlayReady}
      />

      {/* `reveal` already means both maps have loaded AND the crop has been told
          to come in, so mounting the slider here is the earliest honest moment
          the intro can play against a complete map. */}
      {active && reveal && (
        <CompareSlider
          value={sliderValue}
          onChange={onSliderChange}
          autoDemo={!demoPlayed}
          onDemoEnd={onDemoEnd}
        />
      )}

      {active && reveal && (
        <div className="causes-hotspot-legend" aria-hidden="true">
          <span className="causes-hotspot-legend-swatch" />
          <span className="causes-hotspot-legend-label">{hotspotLegendLabel}</span>
        </div>
      )}
    </div>
  );
}

// Un solo connettore vive alla volta, quindi un id fisso basta e non c'è da
// generarne uno per istanza.
const CONNECTOR_MASK_ID = "causes-connector-reveal-mask";

function CausesConnector({
  activeStageId,
  compareCropRef,
  lensCropRef,
  panelBodyRefs,
  stageRef,
  visible,
}) {
  const [geometry, setGeometry] = useState({ width: 100, height: 100, path: "" });

  useEffect(() => {
    if (!visible || !activeStageId) return undefined;

    let frame = null;
    let liveFrame = null;

    const readElements = () => {
      const stage = stageRef.current;
      const map = activeStageId === "compare" ? compareCropRef.current : lensCropRef.current;
      const text = panelBodyRefs.current[activeStageId];
      return { map, stage, text };
    };

    const update = () => {
      frame = null;
      const { map, stage, text } = readElements();
      if (!stage || !map || !text) return;

      const stageRect = stage.getBoundingClientRect();
      const mapRect = map.getBoundingClientRect();
      const textRect = text.getBoundingClientRect();
      const width = Math.max(1, Math.round(stageRect.width));
      const height = Math.max(1, Math.round(stageRect.height));

      const toStage = (rect, x, y) => ({
        x: x - stageRect.left,
        y: y - stageRect.top,
      });

      // The line is anchored to the middle of the description's first line, on the
      // edge that faces the map, so it reads as growing out of the text — then it
      // curves to the near edge of the map crop. A node dot marks the text anchor.
      // (Compare has no connector — the text leaves before the map appears.)
      // Il filetto ambra che stava sopra la prima riga non c'è più: l'ha
      // sostituito l'indice in alto (06 § 6.3, § 6.8), quindi l'attacco scende
      // dall'altezza del filetto a quella della riga vera.
      const mapSide = activeStageId === "clue-materials" ? "right" : "left";
      const lineY = textRect.top + 14;
      if (textRect.top > mapRect.bottom - 12 || textRect.bottom < mapRect.top - 36) {
        setGeometry({ width, height, path: "" });
        return;
      }

      let start;
      let end;
      if (mapSide === "left") {
        // verde: map LEFT, text RIGHT — leave the text's left edge, land on the map's right edge.
        start = toStage(textRect, textRect.left - 5, lineY);
        end = toStage(mapRect, mapRect.right - 13, mapRect.top + mapRect.height * 0.34);
      } else {
        // materiali: map RIGHT, text LEFT — leave the text's right edge, land on the map's left edge.
        start = toStage(textRect, textRect.right + 5, lineY);
        end = toStage(mapRect, mapRect.left + 13, mapRect.top + mapRect.height * 0.34);
      }

      const dx = end.x - start.x;
      const dy = end.y - start.y;
      // Ease out of the text horizontally, then curve down into the map.
      const c1 = { x: start.x + dx * 0.42, y: start.y + Math.max(10, dy * 0.06) };
      const c2 = { x: start.x + dx * 0.62, y: end.y - Math.max(20, dy * 0.34) };

      setGeometry({
        width,
        height,
        start,
        end,
        path: `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)}, ${c2.x.toFixed(1)} ${c2.y.toFixed(1)}, ${end.x.toFixed(1)} ${end.y.toFixed(1)}`,
      });
    };

    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };

    const startLiveTracking = () => {
      const endAt = performance.now() + 1100;
      const tick = () => {
        update();
        if (performance.now() < endAt) {
          liveFrame = requestAnimationFrame(tick);
        }
      };
      tick();
    };

    const { map, stage, text } = readElements();
    const ro = new ResizeObserver(schedule);
    if (stage) ro.observe(stage);
    if (map) ro.observe(map);
    if (text) ro.observe(text);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    startLiveTracking();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      if (liveFrame) cancelAnimationFrame(liveFrame);
      ro.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [activeStageId, compareCropRef, lensCropRef, panelBodyRefs, stageRef, visible]);

  return (
    <svg
      className={`causes-connector${visible && geometry.path ? " causes-connector--visible" : ""}`}
      viewBox={`0 0 ${geometry.width} ${geometry.height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {geometry.path && (
        <g key={activeStageId}>
          {/* Il tratteggio si disegna da sé, e le due cose insieme su un solo
              elemento non si possono fare: il disegno progressivo È un
              `stroke-dasharray`, e occuperebbe il posto del tratteggio. Quindi
              il tratto visibile è tratteggiato e fermo, e a scoprirlo lungo la
              stessa curva è una maschera — la stessa geometria, tirata spessa e
              bianca, con il dashoffset che va da 1 a 0. */}
          <defs>
            <mask
              id={CONNECTOR_MASK_ID}
              maskUnits="userSpaceOnUse"
              x="0"
              y="0"
              width={geometry.width}
              height={geometry.height}
            >
              <path
                className="causes-connector-reveal"
                pathLength="1"
                d={geometry.path}
              />
            </mask>
          </defs>
          {geometry.end && (
            <circle
              className="causes-connector-target"
              cx={geometry.end.x}
              cy={geometry.end.y}
              r="4.5"
            />
          )}
          <path
            className="causes-connector-path"
            mask={`url(#${CONNECTOR_MASK_ID})`}
            d={geometry.path}
          />
          {geometry.start && (
            <circle
              className="causes-connector-node"
              cx={geometry.start.x}
              cy={geometry.start.y}
              r="4.5"
            />
          )}
        </g>
      )}
    </svg>
  );
}

/**
 * Isola i due concetti nelle descrizioni senza cambiare le stringhe dei testi.
 * Se una frase viene riscritta e il termine non c'è più, il paragrafo resta
 * intatto: viene meno soltanto l'enfasi.
 */
const greenEmphasis = (() => {
  const body = causeStages.find((stage) => stage.id === "clue-green")?.body ?? "";
  const at = body.indexOf(greenTopicWord);
  if (at < 0) return null;
  return {
    before: body.slice(0, at),
    after: body.slice(at + greenTopicWord.length),
  };
})();

const TOPIC_FLIGHT_DURATION_MS = 920;
const DESCRIPTION_FLIGHT_DELAY_MS = 140;
const DESCRIPTION_FLIGHT_DURATION_MS = 780;
const topicFlightEasing = (t) => 1 - Math.pow(1 - t, 3);

const materialsEmphasis = (() => {
  const body = causeStages.find((stage) => stage.id === "clue-materials")?.body ?? "";
  const at = body.indexOf(materialsTopicWord);
  if (at < 0) return null;
  return {
    before: body.slice(0, at),
    after: body.slice(at + materialsTopicWord.length),
  };
})();

const compareMaterialsPhrase = `${materialsTopicWord} ad alto assorbimento`;
const compareMaterialsSuffix = compareMaterialsPhrase.slice(
  materialsTopicWord.length,
);
const compareGreenPhrase = `scarsa presenza di ${greenTopicWord}`;
const compareGreenPrefix = compareGreenPhrase.slice(
  0,
  compareGreenPhrase.length - greenTopicWord.length,
);
const compareEmphasis = (() => {
  const body = causeStages.find((stage) => stage.id === "compare")?.body ?? "";
  const materialsAt = body.indexOf(compareMaterialsPhrase);
  const greenAt = body.indexOf(compareGreenPhrase);
  if (materialsAt < 0 || greenAt < 0 || materialsAt > greenAt) return null;
  return {
    before: body.slice(0, materialsAt),
    between: body.slice(materialsAt + compareMaterialsPhrase.length, greenAt),
    after: body.slice(greenAt + compareGreenPhrase.length),
  };
})();

export function PhysicalDriversSection() {
  const stages = causeStages;
  const [activeStageId, setActiveStageId] = useState(stages[0].id);
  const [activeTextStageId, setActiveTextStageId] = useState(null);
  const [compareMapVisible, setCompareMapVisible] = useState(false);
  const [compareExiting, setCompareExiting] = useState(false);
  const [sliderValue, setSliderValue] = useState(50);
  // Latches once the intro sweep has run (or the reader beat it to the handle),
  // so it plays on first view only.
  const [compareDemoPlayed, setCompareDemoPlayed] = useState(false);
  const [sceneEntered, setSceneEntered] = useState(false);
  const [landedTopics, setLandedTopics] = useState(() => {
    const landed = prefersReducedMotion();
    return { green: landed, materials: landed };
  });
  const [landedDescriptions, setLandedDescriptions] = useState(() => {
    const landed = prefersReducedMotion();
    return {
      green: landed,
      materials: landed,
      "compare-green": landed,
      "compare-materials": landed,
    };
  });
  // Il ritaglio non entra mai vuoto (06 § 6.4): finché la mappa non ha finito
  // di disegnarsi, il riquadro è una campitura di carta e la mappa gli passa
  // sopra in dissolvenza. Si arma una volta sola.
  const [lensDrawn, setLensDrawn] = useState(false);
  const panelRefs = useRef([]);
  const panelBodyRefs = useRef({});
  const sceneRef = useRef(null);
  const stageRef = useRef(null);
  const lensCropRef = useRef(null);
  const compareCropRef = useRef(null);
  const enteredRef = useRef(false);
  const topicSourceRefs = useRef({});
  const topicTargetRefs = useRef({});
  const topicFlyerRefs = useRef({});
  const topicFlightPlayedRef = useRef(false);
  const descriptionTargetRefs = useRef({});
  const descriptionFlyerRefs = useRef({});
  const descriptionFlightPlayedRef = useRef({
    green: false,
    materials: false,
    "compare-green": false,
    "compare-materials": false,
  });

  const markCompareDemoPlayed = useCallback(() => setCompareDemoPlayed(true), []);

  useEffect(() => preloadCompareAssets(), []);

  // Due copie dei termini annunciati nell'apertura raggiungono l'indice sticky.
  // La partenza viene fotografata quando la scena entra; l'arrivo, invece, viene
  // riletto a ogni frame, così resta preciso anche se il lettore continua a
  // scorrere durante i 920 ms del volo.
  useEffect(() => {
    const sources = topicSourceRefs.current;
    const targets = topicTargetRefs.current;
    const flyers = topicFlyerRefs.current;
    const flights = [
      { key: "green", delay: 0 },
      { key: "materials", delay: 90 },
    ];
    const landTopic = (key) => {
      targets[key]?.classList.remove("is-waiting");
      setLandedTopics((current) =>
        current[key] ? current : { ...current, [key]: true },
      );
    };

    if (prefersReducedMotion()) {
      return undefined;
    }
    if (!sceneEntered || topicFlightPlayedRef.current) return undefined;

    topicFlightPlayedRef.current = true;
    const frames = new Set();
    const timers = new Set();

    const startFlight = (key) => {
      const source = sources[key];
      const target = targets[key];
      const flyer = flyers[key];
      if (!source || !target || !flyer) {
        landTopic(key);
        return;
      }

      const sourceRect = source.getBoundingClientRect();
      const vh = window.innerHeight || 768;
      if (sourceRect.bottom <= 0 || sourceRect.top >= vh) {
        landTopic(key);
        return;
      }

      const start = {
        left: sourceRect.left,
        top: sourceRect.top,
        height: sourceRect.height,
      };
      const fromSize = parseFloat(getComputedStyle(source).fontSize) || 16;
      let startTime = null;
      let frame = null;

      flyer.style.fontSize = `${fromSize}px`;
      flyer.style.transform = `translate3d(${start.left}px, ${start.top}px, 0)`;
      flyer.classList.add("is-flying");

      const animate = (now) => {
        frames.delete(frame);
        if (startTime === null) startTime = now;
        const p = Math.min(1, (now - startTime) / TOPIC_FLIGHT_DURATION_MS);
        const t = topicFlightEasing(p);
        const targetRect = target.getBoundingClientRect();
        const targetStyle = getComputedStyle(target);
        const toSize = parseFloat(targetStyle.fontSize) || fromSize;
        const toLetterSpacing = parseFloat(targetStyle.letterSpacing) || 0;
        const toOpacity =
          parseFloat(getComputedStyle(target.parentElement).opacity) || 1;
        const x = start.left + (targetRect.left - start.left) * t;
        const directTop = start.top + (targetRect.top - start.top) * t;
        const arc = -Math.sin(Math.PI * p) * 32;
        const height = start.height + (targetRect.height - start.height) * t;

        flyer.style.fontSize = `${fromSize + (toSize - fromSize) * t}px`;
        flyer.style.letterSpacing = `${toLetterSpacing * t}px`;
        flyer.style.opacity = `${1 + (toOpacity - 1) * t}`;
        const y =
          directTop + arc + (height - flyer.getBoundingClientRect().height) / 2;
        flyer.style.transform = `translate3d(${x}px, ${y}px, 0)`;

        if (p < 1) {
          frame = requestAnimationFrame(animate);
          frames.add(frame);
          return;
        }

        landTopic(key);
        flyer.classList.remove("is-flying");
        flyer.style.opacity = "";
        flyer.style.letterSpacing = "";
      };

      frame = requestAnimationFrame(animate);
      frames.add(frame);
    };

    flights.forEach(({ key, delay }) => {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        startFlight(key);
      }, delay);
      timers.add(timer);
    });

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      frames.forEach((frame) => cancelAnimationFrame(frame));
      flights.forEach(({ key }) => {
        const flyer = flyers[key];
        flyer?.classList.remove("is-flying");
        if (flyer) {
          flyer.style.opacity = "";
          flyer.style.letterSpacing = "";
        }
      });
    };
  }, [sceneEntered]);

  const descriptionFlights =
    activeTextStageId === "clue-green"
      ? [{ sourceKey: "green", targetKey: "green" }]
      : activeTextStageId === "clue-materials"
        ? [{ sourceKey: "materials", targetKey: "materials" }]
        : activeTextStageId === "compare"
          ? [
              {
                sourceKey: "materials",
                targetKey: "compare-materials",
              },
              { sourceKey: "green", targetKey: "compare-green" },
            ]
          : [];
  const activeTopicLanded =
    descriptionFlights.length > 0 &&
    descriptionFlights.every(({ sourceKey }) => landedTopics[sourceKey]);

  // Secondo salto: quando una descrizione entra, una nuova copia parte
  // dall'indice e raggiunge il termine in grassetto dentro il paragrafo.
  useEffect(() => {
    if (prefersReducedMotion() || !activeTopicLanded || descriptionFlights.length === 0) {
      return undefined;
    }

    const pendingFlights = descriptionFlights.filter(
      ({ targetKey }) => !descriptionFlightPlayedRef.current[targetKey],
    );
    if (pendingFlights.length === 0) return undefined;

    const cleanups = pendingFlights.map(({ sourceKey, targetKey }) => {
      const source = topicTargetRefs.current[sourceKey];
      const target = descriptionTargetRefs.current[targetKey];
      const flyer = descriptionFlyerRefs.current[sourceKey];
      const landDescription = () => {
        target?.classList.remove("is-waiting");
        setLandedDescriptions((current) =>
          current[targetKey] ? current : { ...current, [targetKey]: true },
        );
      };

      descriptionFlightPlayedRef.current[targetKey] = true;
      let timer = null;
      let frame = null;
      let startTime = null;
      let finished = false;

      const finish = () => {
        finished = true;
        landDescription();
        flyer?.classList.remove("is-flying");
      };

      timer = window.setTimeout(() => {
        timer = null;
        if (!source || !target || !flyer) {
          finish();
          return;
        }

        const sourceRect = source.getBoundingClientRect();
        const start = {
          left: sourceRect.left,
          top: sourceRect.top,
          height: sourceRect.height,
        };
        const fromSize = parseFloat(getComputedStyle(source).fontSize) || 16;

        flyer.style.fontSize = `${fromSize}px`;
        flyer.style.transform = `translate3d(${start.left}px, ${start.top}px, 0)`;
        flyer.classList.add("is-flying");

        const animate = (now) => {
          if (startTime === null) startTime = now;
          const p = Math.min(
            1,
            (now - startTime) / DESCRIPTION_FLIGHT_DURATION_MS,
          );
          const t = topicFlightEasing(p);
          const targetRect = target.getBoundingClientRect();
          const toSize =
            parseFloat(getComputedStyle(target).fontSize) || fromSize;
          const x = start.left + (targetRect.left - start.left) * t;
          const directTop = start.top + (targetRect.top - start.top) * t;
          const arc = -Math.sin(Math.PI * p) * 26;
          const height = start.height + (targetRect.height - start.height) * t;

          flyer.style.fontSize = `${fromSize + (toSize - fromSize) * t}px`;
          const y =
            directTop +
            arc +
            (height - flyer.getBoundingClientRect().height) / 2;
          flyer.style.transform = `translate3d(${x}px, ${y}px, 0)`;

          if (p < 1) {
            frame = requestAnimationFrame(animate);
          } else {
            frame = null;
            finish();
          }
        };

        frame = requestAnimationFrame(animate);
      }, DESCRIPTION_FLIGHT_DELAY_MS);

      return () => {
        if (timer) window.clearTimeout(timer);
        if (frame) cancelAnimationFrame(frame);
        flyer?.classList.remove("is-flying");
        if (!finished) landDescription();
      };
    });

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [activeTextStageId, activeTopicLanded]);

  // Reuse the project's reading-line scroll mechanism (0.52*vh + rAF + rects).
  useEffect(() => {
    let frame = null;
    let fallback = null;
    const update = () => {
      frame = null;
      if (fallback) {
        clearTimeout(fallback);
        fallback = null;
      }
      const vh = window.innerHeight || 768;
      const readingLine = vh * 0.52;
      const textLine = vh * 0.86;
      const panels = panelRefs.current.filter(Boolean);
      let nextId = stages[0].id;
      let nextTextId = null;
      let minDistance = Infinity;
      let nearestPassedTop = -Infinity;

      panels.forEach((panel) => {
        const rect = panel.getBoundingClientRect();
        const center = rect.top + rect.height * 0.5;
        const inRange = rect.bottom > 0 && rect.top < vh;
        const distance = Math.abs(center - readingLine);
        if (inRange && distance < minDistance) {
          minDistance = distance;
          nextId = panel.dataset.stageId;
        }
      });

      stages.forEach((stage) => {
        const probe = panelBodyRefs.current[stage.id];
        if (!probe) return;
        const rect = probe.getBoundingClientRect();
        // The compare caption activates higher up — around the lower-middle of the
        // view — so it appears mid-screen and only needs a short rise before the
        // comparison map reveals below it, instead of fading in at the very bottom
        // and travelling almost a full screen. The two clue captions keep the low line.
        const activationLine = stage.id === "compare" ? vh * 0.64 : textLine;
        if (rect.bottom > 0 && rect.top <= activationLine && rect.top > nearestPassedTop) {
          nearestPassedTop = rect.top;
          nextTextId = stage.id;
        }
      });

      const lastPanel = panels.at(-1);
      const lastRect = lastPanel?.getBoundingClientRect();
      if (minDistance === Infinity && lastRect?.bottom < readingLine) {
        nextId = lastPanel.dataset.stageId;
      }
      if (!nextTextId && lastRect?.top <= textLine && lastRect?.bottom > 0) {
        nextTextId = lastPanel?.dataset.stageId ?? null;
      }
      setActiveStageId(nextId ?? stages[0].id);
      setActiveTextStageId(nextTextId);

      const sceneRect = sceneRef.current?.getBoundingClientRect();
      // Entrance animation before the sticky stage is fully pinned: the first map
      // is already present when the first text rises into view.
      if (!enteredRef.current && sceneRect && sceneRect.top < vh * 0.58 && sceneRect.bottom > 0) {
        enteredRef.current = true;
        setSceneEntered(true);
      }
    };

    const requestUpdate = () => {
      if (frame || fallback) return;
      frame = requestAnimationFrame(update);
      fallback = setTimeout(() => {
        if (frame) cancelAnimationFrame(frame);
        update();
      }, 80);
    };

    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      if (fallback) clearTimeout(fallback);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, [stages]);

  // Compare choreography (prompt: the synthesis text must scroll bottom→top BEFORE
  // the map appears, and the map must transition OUT before the next sector).
  // Two scroll-driven booleans, smoothed by CSS transitions on the crop:
  //  · compareMapVisible — the description has travelled up into the top band, so
  //    the comparison map rises in and holds (slider usable).
  //  · compareExiting    — the compare panel is nearly spent; the map drifts up and
  //    fades out so the scene un-pins onto clean cream, never under the next section.
  useEffect(() => {
    let frame = null;
    let fallback = null;

    const update = () => {
      frame = null;
      if (fallback) {
        clearTimeout(fallback);
        fallback = null;
      }
      const compareText = panelBodyRefs.current.compare;
      const comparePanel = panelRefs.current[stages.length - 1];
      const inCompareBeat = activeStageId === "compare" || activeTextStageId === "compare";
      if (!inCompareBeat || !compareText || !comparePanel) {
        setCompareMapVisible(false);
        setCompareExiting(false);
        return;
      }

      const vh = window.innerHeight || 768;
      const textRect = compareText.getBoundingClientRect();
      const panelRect = comparePanel.getBoundingClientRect();

      // Reveal as soon as the description's bottom edge clears the TOP of the map crop
      // (i.e. the instant they stop overlapping) — so the map comes out a little sooner,
      // not only once the caption has fully settled. The map's resting top follows the
      // CSS (top: 62%, height: min(54vh, 600px)).
      const mapHeight = Math.min(vh * 0.54, 600);
      const mapTop = vh * 0.62 - mapHeight / 2;
      const revealed = textRect.bottom <= mapTop + 8;
      // The compare panel is almost spent (its bottom approaches the top of the
      // viewport) → start the out transition with room to finish before the un-pin.
      const exiting = revealed && panelRect.bottom <= vh * 1.02;

      setCompareMapVisible(revealed && !exiting);
      setCompareExiting(exiting);
    };

    const requestUpdate = () => {
      if (frame || fallback) return;
      frame = requestAnimationFrame(update);
      fallback = setTimeout(update, 70);
    };

    requestUpdate();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      if (fallback) clearTimeout(fallback);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, [activeStageId, activeTextStageId, stages]);

  const activeStage = stages.find((s) => s.id === activeStageId) ?? stages[0];
  const compareTextActive = activeTextStageId === "compare";
  // The map lens + side FOLLOW THE VISIBLE TEXT (not the earlier reading-line): the
  // albedo lens never appears while the green description is still on screen, and the
  // sides swap together with the copy (no stale overlap during the hand-off).
  const textStageId = activeTextStageId ?? activeStageId ?? stages[0].id;
  // Keep the albedo (materials) lens parked on the right for the WHOLE compare
  // approach — until the comparison map is revealed — so the "end of albedo" reads as
  // a gentle fade, not a hard cut to an empty stage.
  const inCompareApproach = textStageId === "compare" && !compareMapVisible;
  const visualStage = inCompareApproach
    ? stages.find((stage) => stage.id === "clue-materials") ?? activeStage
    : stages.find((stage) => stage.id === textStageId) ?? activeStage;
  const stagePosition = visualStage.pos;
  const atmosphereTone =
    visualStage.lens === "green"
      ? "green"
      : visualStage.lens === "materials"
        ? "materials"
        : "compare";
  const isComparing = compareMapVisible || compareExiting;
  const compareTopicsActive = compareTextActive || isComparing;
  const greenTopicActive = visualStage.lens === "green" || compareTopicsActive;
  const materialsTopicActive =
    visualStage.lens === "materials" || compareTopicsActive;
  // The base lens crop fades away once the synthesis text rises (albedo "ends"),
  // leaving a clean cream reading beat before the comparison map comes out.
  const baseCropLeaving = compareTextActive || isComparing;
  const connectorStage = stages.find((s) => s.id === activeTextStageId);
  // The connector links the description to the map only for the two side lenses
  // (verde / materiali). In the compare beat the caption sits above the map instead.
  const connectorVisible =
    Boolean(connectorStage) && activeTextStageId !== "compare" && !isComparing;
  // Small rise from where the text scrolls in (NOT a big jump that makes it appear
  // mid-screen) — the description "starts from the bottom" and rises with the scroll.
  const textMotionStyle = (isActive) => ({
    opacity: isActive ? 1 : 0,
    transform: isActive ? "translateY(0px)" : "translateY(34px)",
  });

  return (
    <section id="causes" className="causes-section" aria-label="Perché il caldo resta proprio qui">
      <span
        ref={(node) => {
          topicFlyerRefs.current.green = node;
        }}
        className="causes-topic-flyer kw"
        aria-hidden="true"
      >
        {greenTopicWord}
      </span>
      <span
        ref={(node) => {
          topicFlyerRefs.current.materials = node;
        }}
        className="causes-topic-flyer kw"
        aria-hidden="true"
      >
        {materialsTopicWord}
      </span>
      <span
        ref={(node) => {
          descriptionFlyerRefs.current.green = node;
        }}
        className="causes-topic-flyer causes-description-topic-flyer kw"
        aria-hidden="true"
      >
        {greenTopicWord}
      </span>
      <span
        ref={(node) => {
          descriptionFlyerRefs.current.materials = node;
        }}
        className="causes-topic-flyer causes-description-topic-flyer kw"
        aria-hidden="true"
      >
        {materialsTopicWord}
      </span>

      {/* (1) Apertura: titolo + testo, colonna centrata, fondo avorio. */}
      <div className="causes-intro">
        <span className="causes-intro-leaf" aria-hidden="true" />
        <SectionDivider />
        <div className="causes-intro-inner">
          <h2 className="causes-title">{title}</h2>
          <p className="causes-aperture">{aperture}</p>
          <p className="causes-aperture causes-aperture--break">
            {apertureCauseParts.map((part, index) => {
              if (!part.kw) return <Fragment key={index}>{part.text}</Fragment>;
              if (part.topic === "green" || part.topic === "materials") {
                return (
                  <span
                    key={index}
                    ref={(node) => {
                      topicSourceRefs.current[part.topic] = node;
                    }}
                    className="kw"
                  >
                    {part.text}
                  </span>
                );
              }
              return (
                <span key={index} className="kw">
                  {part.text}
                </span>
              );
            })}
          </p>
          <p className="causes-aperture-close">{apertureClose}</p>
        </div>
      </div>

      {/* (2–5) Scena: ritaglio sticky che scivola sx↔dx↔centro col testo a fianco. */}
      <div
        id="causes-scene"
        ref={sceneRef}
        className={`causes-scene${sceneEntered ? " causes-scene--entered" : ""}`}
      >
        <div
          ref={stageRef}
          className={`causes-stage causes-stage--pos-${stagePosition} causes-stage--tone-${atmosphereTone}`}
        >
          <div
            className={`causes-topic-header${compareTopicsActive ? " causes-topic-header--compare" : ""}`}
            aria-hidden="true"
          >
            <span
              className={`causes-topic-label${landedTopics.green ? " is-ready" : ""}${greenTopicActive ? " is-active" : ""}`}
            >
              <span
                ref={(node) => {
                  topicTargetRefs.current.green = node;
                }}
                className={`causes-topic-label-text${landedTopics.green ? "" : " is-waiting"}`}
              >
                {greenTopicWord}
              </span>
            </span>
            <span className="causes-topic-divider" />
            <span
              className={`causes-topic-label${landedTopics.materials ? " is-ready" : ""}${materialsTopicActive ? " is-active" : ""}`}
            >
              <span
                ref={(node) => {
                  topicTargetRefs.current.materials = node;
                }}
                className={`causes-topic-label-text${landedTopics.materials ? "" : " is-waiting"}`}
              >
                {materialsTopicWord}
              </span>
            </span>
          </div>

          <CausesConnector
            activeStageId={activeTextStageId}
            compareCropRef={compareCropRef}
            lensCropRef={lensCropRef}
            panelBodyRefs={panelBodyRefs}
            stageRef={stageRef}
            visible={connectorVisible}
          />
          <div
            ref={lensCropRef}
            className={`causes-crop${lensDrawn ? " causes-crop--drawn" : ""}${baseCropLeaving ? " causes-crop--leaving" : ""}${isComparing ? " causes-crop--compare-hidden" : ""}`}
          >
            {/* La campitura sotto la mappa. Ferma, senza luccichii: deve dire
                «il riquadro è qui, l'immagine sta arrivando», non chiedere
                attenzione. */}
            <div className="causes-crop-wash" aria-hidden="true" />

            <CausesCropMap
              lens={visualStage.lens}
              expanded={compareMapVisible}
              showHotspots={compareMapVisible}
              onDrawnChange={setLensDrawn}
            />

            {lensDrawn && !baseCropLeaving && lensLegends[visualStage.lens] && (
              <div className="causes-maplegend" aria-hidden="true">
                <span
                  className="causes-maplegend-bar"
                  style={{ background: lensLegends[visualStage.lens].bar }}
                />
                <span className="causes-maplegend-labels">
                  <span>{lensLegends[visualStage.lens].from}</span>
                  <span>{lensLegends[visualStage.lens].to}</span>
                </span>
              </div>
            )}
          </div>

          <CausesCompareMap
            cropRef={compareCropRef}
            sliderValue={sliderValue}
            onSliderChange={setSliderValue}
            visible={compareMapVisible}
            exiting={compareExiting}
            active={compareMapVisible}
            demoPlayed={compareDemoPlayed}
            onDemoEnd={markCompareDemoPlayed}
          />
        </div>

        <div className="causes-panels" lang="it">
          {stages.map((stage, index) => {
            // The compare caption fades out together with the map during the exit
            // transition (it must not linger when the next section arrives).
            const isTextActive =
              activeTextStageId === stage.id &&
              !(stage.id === "compare" && compareExiting);

            return (
              <div
                key={stage.id}
                ref={(node) => {
                  panelRefs.current[index] = node;
                }}
                data-stage-id={stage.id}
                className={`causes-panel causes-panel--${stage.id}${isTextActive ? " causes-panel--active" : ""}${index === stages.length - 1 ? " causes-panel--last" : ""}`}
              >
                {stage.body && (
                  <p
                    ref={(node) => {
                      panelBodyRefs.current[stage.id] = node;
                    }}
                    className={`causes-panel-body${isTextActive ? " causes-panel-body--active" : ""}`}
                    style={textMotionStyle(isTextActive)}
                  >
                    {stage.id === "clue-green" && greenEmphasis ? (
                      <>
                        {greenEmphasis.before}
                        <strong
                          ref={(node) => {
                            descriptionTargetRefs.current.green = node;
                          }}
                          className={`kw causes-description-topic-target${landedDescriptions.green ? "" : " is-waiting"}`}
                        >
                          {greenTopicWord}
                        </strong>
                        {greenEmphasis.after}
                      </>
                    ) : stage.id === "clue-materials" && materialsEmphasis ? (
                      <>
                        {materialsEmphasis.before}
                        <strong className="kw">
                          <span
                            ref={(node) => {
                              descriptionTargetRefs.current.materials = node;
                            }}
                            className={`causes-description-topic-target${landedDescriptions.materials ? "" : " is-waiting"}`}
                          >
                            {materialsTopicWord}
                          </span>
                        </strong>
                        {materialsEmphasis.after}
                      </>
                    ) : stage.id === "compare" && compareEmphasis ? (
                      <>
                        {compareEmphasis.before}
                        <strong className="kw">
                          <span
                            ref={(node) => {
                              descriptionTargetRefs.current["compare-materials"] = node;
                            }}
                            className={`kw causes-description-topic-target${landedDescriptions["compare-materials"] ? "" : " is-waiting"}`}
                          >
                            {materialsTopicWord}
                          </span>
                          {compareMaterialsSuffix}
                        </strong>
                        {compareEmphasis.between}
                          <strong className="kw">
                          {compareGreenPrefix}
                          <span
                            ref={(node) => {
                              descriptionTargetRefs.current["compare-green"] = node;
                            }}
                            className={`kw causes-description-topic-target${landedDescriptions["compare-green"] ? "" : " is-waiting"}`}
                          >
                            {greenTopicWord}
                          </span>
                        </strong>
                        {compareEmphasis.after}
                      </>
                    ) : (
                      stage.body
                    )}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* (6) Uscita: raccordo morbido verso la sezione ombra (nessun taglio). */}
      <div className="causes-exit" aria-hidden="true" />
    </section>
  );
}

// ── First-view intro: the handle demonstrates itself ────────────────────────
// The compare map is the one view whose whole point is invisible until you drag
// it, so the first time a reader gets there the handle sweeps right, left, and
// back to centre on its own; only then does the "trascina" hint appear. The
// motion shows WHAT to do, the word then names it.
// La corsa era di ±30 punti (50 → 80 → 20 → 50): mostrava che la maniglia si
// trascina, ma nel farlo sbandierava mezza mappa, e il lettore guardava il
// movimento invece della differenza fra le due metà. A ±14 punti il gesto è
// asciutto e resta quello che deve essere, un'indicazione (06 § 6.6).
const DEMO_STOPS = [50, 64, 36, 50];
const DEMO_LEG_MS = 760;
const DEMO_MS = DEMO_LEG_MS * (DEMO_STOPS.length - 1);
// The crop fades and rises into place over ~780ms (.causes-compare-crop), and it
// only starts once BOTH the base map and the albedo overlay have loaded. Waiting
// this out means the sweep begins on a still, fully-drawn map — the reader is
// looking at the finished thing when the handle starts moving, which is the
// whole point of the hint.
const DEMO_SETTLE_MS = 900;

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

// Position along the stop path at `elapsed` ms, eased per leg so it reads as a
// hand moving the handle rather than a linear scrub.
function demoValueAt(elapsed) {
  const clamped = Math.min(Math.max(elapsed, 0), DEMO_MS);
  const leg = Math.min(Math.floor(clamped / DEMO_LEG_MS), DEMO_STOPS.length - 2);
  const t = easeInOut((clamped - leg * DEMO_LEG_MS) / DEMO_LEG_MS);
  return DEMO_STOPS[leg] + (DEMO_STOPS[leg + 1] - DEMO_STOPS[leg]) * t;
}

// Draggable + keyboard-operable compare handle (prompt §9). The "trascina" hint
// lives on the handle itself, never in the narrative copy.
function CompareSlider({ value, onChange, autoDemo, onDemoEnd }) {
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  // Without the intro the hint is simply on, as it always was — and a reader who
  // asked for less motion gets it up front instead of a moving handle, so the
  // affordance still lands without the animation.
  const [hintOn, setHintOn] = useState(() => !autoDemo || prefersReducedMotion());
  const [demoing, setDemoing] = useState(false);
  const demoCancelRef = useRef(null);

  // Ends the intro — either because it finished, or because the reader grabbed
  // the handle mid-sweep. A real interaction always wins: we stop where they
  // took it rather than fighting them back to centre.
  const endDemo = useCallback(() => {
    demoCancelRef.current?.();
    demoCancelRef.current = null;
    setDemoing(false);
    setHintOn(true);
    onDemoEnd?.();
  }, [onDemoEnd]);

  useEffect(() => {
    // Under reduced motion `hintOn` already initialised true, so there is
    // nothing to play and nothing to latch — bailing out here is idempotent.
    if (!autoDemo || prefersReducedMotion()) return undefined;

    let frame = null;
    const startTimer = window.setTimeout(() => {
      setDemoing(true);
      const t0 = performance.now();
      const tick = (now) => {
        const elapsed = now - t0;
        onChange(demoValueAt(elapsed));
        if (elapsed < DEMO_MS) frame = requestAnimationFrame(tick);
        else endDemo();
      };
      frame = requestAnimationFrame(tick);
    }, DEMO_SETTLE_MS);

    const cancel = () => {
      window.clearTimeout(startTimer);
      if (frame) cancelAnimationFrame(frame);
    };
    demoCancelRef.current = cancel;
    // Unmounting mid-sweep (the reader scrolled away before it played) leaves
    // `autoDemo` true, so the intro is still owed to them next time round.
    return cancel;
  }, [autoDemo, onChange, onDemoEnd, endDemo]);

  const updateFromEvent = useCallback(
    (event) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const x = (event.touches?.[0]?.clientX ?? event.clientX) - rect.left;
      const pct = Math.max(2, Math.min(98, (x / rect.width) * 100));
      onChange(pct);
    },
    [onChange],
  );

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (event) => updateFromEvent(event);
    const handleUp = () => setDragging(false);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("touchmove", handleMove, { passive: true });
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchend", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchend", handleUp);
    };
  }, [dragging, updateFromEvent]);

  const startDrag = (event) => {
    event.preventDefault();
    endDemo();
    setDragging(true);
  };

  const onKeyDown = (event) => {
    const step = event.shiftKey ? 10 : 4;
    if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) endDemo();
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      onChange(Math.max(2, value - step));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      onChange(Math.min(98, value + step));
    } else if (event.key === "Home") {
      event.preventDefault();
      onChange(2);
    } else if (event.key === "End") {
      event.preventDefault();
      onChange(98);
    }
  };

  return (
    <div ref={trackRef} className="causes-compare-track">
      <button
        type="button"
        className={`causes-compare-handle${demoing ? " causes-compare-handle--demo" : ""}`}
        style={{ left: `${value}%` }}
        onMouseDown={startDrag}
        onTouchStart={startDrag}
        onKeyDown={onKeyDown}
        role="slider"
        tabIndex={0}
        aria-label="Confronta verde e superfici: trascina o usa le frecce"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value)}
        aria-orientation="horizontal"
      >
        <span className="causes-compare-handle-bar" aria-hidden="true" />
        <span className="causes-compare-handle-knob" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M8.5 5 7.1 6.4 11.7 11H4v2h7.7l-4.6 4.6L8.5 19l7-7z" />
            <path fill="currentColor" d="m15.5 5 1.4 1.4L12.3 11H20v2h-7.7l4.6 4.6L15.5 19l-7-7z" />
          </svg>
        </span>
        <span
          className={`causes-compare-handle-hint${hintOn ? " causes-compare-handle-hint--on" : ""}`}
          aria-hidden="true"
        >
          {handleHint}
        </span>
      </button>
    </div>
  );
}

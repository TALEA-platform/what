import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { MapLibreCanvas } from "../maps/MapLibreCanvas";
import { SectionDivider } from "./SectionDivider";
import { assetUrl } from "../../lib/assetUrl";
import { useContent } from "../../content";
import {
  causeStages as causeStageTechnical,
  lensLegendBars,
} from "../../data/causesScene";
import { getHotspotGeojsonUrl } from "../../data/hotspotData";
import { cameraEasing } from "../../lib/motion";

// Overlay maps own only data layers; a second basemap would flicker while loading.
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
const causeRasterUrls = {
  green: assetUrl("/data/physical-drivers/ndvi_2025_direct_overlay.png"),
  materials: assetUrl("/data/physical-drivers/albedo_absorbing_2025_direct_overlay.png"),
};

const CAUSES_CENTER = [11.3438, 44.4949];
const CAUSES_ZOOM = 12.5;
const CAUSES_ZOOM_CLOSE = 13.0;

const CROP_MS = 900;
const CROP_SETTLE_MS = CROP_MS + 60;

const CROP_READY_FALLBACK_MS = 2600;
const MOBILE_LAYOUT_QUERY = "(max-width: 1279px)";

const HOTSPOT_URL = getHotspotGeojsonUrl(9);
const HOTSPOT_FILL = "#c1272d";
const STATIC_FRAME = {
  west: 11.2144246,
  east: 11.4476067,
  south: 44.4098126,
  north: 44.5678182,
  width: 1000,
  height: 1000 / 1.075,
};

const rasterIds = ["green", "absorbing"];
const rasterSourceId = (id) => `cause-raster-${id}-src`;
const rasterLayerId = (id) => `cause-raster-${id}-layer`;

function staticHotspotPath(geometry) {
  if (!geometry) return "";
  const project = ([longitude, latitude]) => {
    const x =
      ((longitude - STATIC_FRAME.west) /
        (STATIC_FRAME.east - STATIC_FRAME.west)) *
      STATIC_FRAME.width;
    const y =
      ((STATIC_FRAME.north - latitude) /
        (STATIC_FRAME.north - STATIC_FRAME.south)) *
      STATIC_FRAME.height;
    return `${x.toFixed(2)} ${y.toFixed(2)}`;
  };
  const polygonPath = (polygon) =>
    polygon
      .map((ring) =>
        ring
          .map((coordinate, index) =>
            `${index === 0 ? "M" : "L"}${project(coordinate)}`,
          )
          .join(" ") + " Z",
      )
      .join(" ");

  if (geometry.type === "Polygon") return polygonPath(geometry.coordinates);
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.map(polygonPath).join(" ");
  }
  return "";
}

function CausesStaticRaster({ lens, compare = false, sliderValue = 50 }) {
  const [hotspotPath, setHotspotPath] = useState("");

  useEffect(() => {
    if (!compare) return undefined;
    let ignore = false;
    fetch(HOTSPOT_URL)
      .then((response) => response.json())
      .then((collection) => {
        if (ignore) return;
        setHotspotPath(
          collection.features
            ?.map((feature) => staticHotspotPath(feature.geometry))
            .filter(Boolean)
            .join(" ") ?? "",
        );
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [compare]);

  return (
    <div className={`causes-static-raster${compare ? " causes-static-raster--compare" : ""}`}>
      <div className="causes-static-raster-content">
        <img
          className={`causes-static-raster-image causes-static-raster-image--green${!compare && lens === "green" ? " is-active" : ""}`}
          src={causeRasterUrls.green}
          alt=""
          aria-hidden="true"
        />
        {!compare && (
          <img
            className={`causes-static-raster-image causes-static-raster-image--materials${lens === "materials" ? " is-active" : ""}`}
            src={causeRasterUrls.materials}
            alt=""
            aria-hidden="true"
          />
        )}
      </div>
      {compare ? (
        <div
          className="causes-static-raster-clip"
          style={{ clipPath: `inset(0 0 0 ${sliderValue}%)` }}
          aria-hidden="true"
        >
          <div className="causes-static-raster-content">
            <img
              className="causes-static-raster-image causes-static-raster-image--materials is-active"
              src={causeRasterUrls.materials}
              alt=""
            />
          </div>
        </div>
      ) : null}
      {compare && hotspotPath && (
        <svg
          className="causes-static-hotspots"
          viewBox={`0 0 ${STATIC_FRAME.width} ${STATIC_FRAME.height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path className="causes-static-hotspots-casing" d={hotspotPath} />
          <path className="causes-static-hotspots-line" d={hotspotPath} />
        </svg>
      )}
    </div>
  );
}

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

  useEffect(() => {
    if (!map || !manifest) return;
    setHotspotVisible(map, showHotspots);
  }, [map, manifest, showHotspots]);

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
    // `render` also fires during tile fades and would repeatedly reset this camera.
    baseMap.on("move", syncToBase);
    baseMap.on("moveend", syncToBase);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      baseMap.off("move", syncToBase);
      baseMap.off("moveend", syncToBase);
    };
  }, [overlayMap, baseMap]);

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
  hotspotLegendLabel,
  comparisonAriaLabel,
  handleHint,
  mobile = false,
}) {
  const [baseMap, setBaseMap] = useState(null);
  const [overlayReady, setOverlayReady] = useState(false);
  const [baseDrawn, setBaseDrawn] = useState(false);
  if (mobile) {
    const reveal = visible && !exiting;
    const transform = exiting
      ? "translateY(-16px) scale(0.98)"
      : reveal
        ? "translateY(0) scale(1)"
        : "translateY(18px) scale(0.98)";
    return (
      <div
        ref={cropRef}
        className={`causes-compare-crop${reveal ? " causes-compare-crop--visible" : ""}${exiting ? " causes-compare-crop--exiting" : ""}`}
        aria-hidden={!reveal}
        style={{
          opacity: reveal ? 1 : 0,
          transform,
          pointerEvents: reveal ? "auto" : "none",
        }}
      >
        <CausesStaticRaster compare sliderValue={sliderValue} />
        {active && reveal && (
          <CompareSlider
            value={sliderValue}
            onChange={onSliderChange}
            autoDemo={!demoPlayed}
            onDemoEnd={onDemoEnd}
            ariaLabel={comparisonAriaLabel}
            hint={handleHint}
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
  const reveal = visible && overlayReady && baseDrawn && !exiting;

  let opacity = 0;
  let transform = mobile
    ? "translate(-50%, 18px) scale(0.98)"
    : "translate(-50%, calc(-50% + 30px)) scale(0.98)";
  if (exiting) {
    opacity = 0;
    transform = mobile
      ? "translate(-50%, -12px) scale(0.98)"
      : "translate(-50%, calc(-50% - 16px)) scale(0.98)";
  } else if (reveal) {
    opacity = 1;
    transform = mobile
      ? "translate(-50%, 0) scale(1)"
      : "translate(-50%, -50%) scale(1)";
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

      {active && reveal && (
        <CompareSlider
          value={sliderValue}
          onChange={onSliderChange}
          autoDemo={!demoPlayed}
          onDemoEnd={onDemoEnd}
          ariaLabel={comparisonAriaLabel}
          hint={handleHint}
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

      const mapSide = activeStageId === "clue-materials" ? "right" : "left";
      const lineY = textRect.top + 14;
      if (textRect.top > mapRect.bottom - 12 || textRect.bottom < mapRect.top - 36) {
        setGeometry({ width, height, path: "" });
        return;
      }

      let start;
      let end;
      if (mapSide === "left") {
        start = toStage(textRect, textRect.left - 5, lineY);
        end = toStage(mapRect, mapRect.right - 13, mapRect.top + mapRect.height * 0.34);
      } else {
        start = toStage(textRect, textRect.right + 5, lineY);
        end = toStage(mapRect, mapRect.left + 13, mapRect.top + mapRect.height * 0.34);
      }

      const dx = end.x - start.x;
      const dy = end.y - start.y;
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

const TOPIC_FLIGHT_DURATION_MS = 920;
const DESCRIPTION_FLIGHT_DELAY_MS = 140;
const DESCRIPTION_FLIGHT_DURATION_MS = 780;
const topicFlightEasing = (t) => 1 - Math.pow(1 - t, 3);

function groupNarrativeSegments(segments) {
  return segments.reduce((groups, segment) => {
    const previous = groups.at(-1);
    if (
      segment.emphasisGroup &&
      previous?.emphasisGroup === segment.emphasisGroup
    ) {
      previous.segments.push(segment);
    } else {
      groups.push({
        id: segment.emphasisGroup ?? segment.id,
        emphasisGroup: segment.emphasisGroup,
        segments: [segment],
      });
    }
    return groups;
  }, []);
}

function NarrativeSegments({ segments, landedDescriptions, targetRefs }) {
  const targetSpan = (segment, grouped) => (
    <span
      key={segment.id}
      ref={(node) => {
        targetRefs.current[segment.flightTarget] = node;
      }}
      className={`${grouped ? "kw " : ""}causes-description-topic-target${landedDescriptions[segment.flightTarget] ? "" : " is-waiting"}`}
    >
      {segment.text}
    </span>
  );

  return groupNarrativeSegments(segments).map((group) => {
    if (group.emphasisGroup) {
      return (
        <strong key={group.id} className="kw">
          {group.segments.map((segment) =>
            segment.flightTarget ? (
              targetSpan(segment, true)
            ) : (
              <Fragment key={segment.id}>{segment.text}</Fragment>
            ),
          )}
        </strong>
      );
    }

    const [segment] = group.segments;
    if (!segment.kw) {
      return <Fragment key={segment.id}>{segment.text}</Fragment>;
    }
    if (segment.flightTarget === "green") {
      return (
        <strong
          key={segment.id}
          ref={(node) => {
            targetRefs.current[segment.flightTarget] = node;
          }}
          className={`kw causes-description-topic-target${landedDescriptions[segment.flightTarget] ? "" : " is-waiting"}`}
        >
          {segment.text}
        </strong>
      );
    }
    return (
      <strong key={segment.id} className="kw">
        {segment.flightTarget ? targetSpan(segment, false) : segment.text}
      </strong>
    );
  });
}

export function PhysicalDriversSection() {
  const { content, locale, uiContent } = useContent();
  const physicalDrivers = content.physicalDrivers;
  const {
    aperture,
    apertureCauseParts,
    apertureClose,
    comparisonAriaLabel,
    greenTopicWord,
    handleHint,
    hotspotLegendLabel,
    lensLegends,
    materialsTopicWord,
    stages,
    title,
  } = useMemo(() => {
    const causeParts = physicalDrivers.intro.topicStatement.segments;
    const topicWords = new Map(
      causeParts
        .filter((segment) => segment.topic)
        .map((segment) => [segment.topic, segment.text]),
    );
    const stageCopy = new Map(
      physicalDrivers.narrative.stages.map((stage) => [stage.id, stage]),
    );
    return {
      title: physicalDrivers.intro.title,
      aperture: physicalDrivers.intro.lead,
      apertureCauseParts: causeParts,
      apertureClose: physicalDrivers.intro.close.text,
      handleHint: physicalDrivers.comparison.handleHint,
      hotspotLegendLabel: physicalDrivers.legends.hotspot.label,
      comparisonAriaLabel: physicalDrivers.comparison.ariaLabel,
      greenTopicWord: topicWords.get("green"),
      materialsTopicWord: topicWords.get("materials"),
      stages: causeStageTechnical.map((stage) => ({
        ...stage,
        segments: stageCopy.get(stage.id).segments,
      })),
      lensLegends: Object.fromEntries(
        physicalDrivers.legends.lenses.map((legend) => [
          legend.id,
          { ...legend, bar: lensLegendBars[legend.id] },
        ]),
      ),
    };
  }, [physicalDrivers]);
  const [activeStageId, setActiveStageId] = useState(stages[0].id);
  const [activeTextStageId, setActiveTextStageId] = useState(null);
  const [compareMapVisible, setCompareMapVisible] = useState(false);
  const [compareExiting, setCompareExiting] = useState(false);
  const [sliderValue, setSliderValue] = useState(50);
  const [compareDemoPlayed, setCompareDemoPlayed] = useState(false);
  const [sceneEntered, setSceneEntered] = useState(false);
  const [scrollCueVisible, setScrollCueVisible] = useState(false);
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
  const [lensDrawn, setLensDrawn] = useState(false);
  const [mobileLayout, setMobileLayout] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia(MOBILE_LAYOUT_QUERY).matches,
  );
  const panelRefs = useRef([]);
  const panelBodyRefs = useRef({});
  const sceneRef = useRef(null);
  const stageRef = useRef(null);
  const lensCropRef = useRef(null);
  const compareCropRef = useRef(null);
  const localProgressRef = useRef(null);
  const enteredRef = useRef(false);
  const scrollCueShownRef = useRef(false);
  const scrollCueVisibleRef = useRef(false);
  const scrollCueStartYRef = useRef(0);
  const topicSourceRefs = useRef({});
  const topicTargetRefs = useRef({});
  const topicFlyerRefs = useRef({});
  const topicFlightPlayedRef = useRef(false);
  const descriptionTargetRefs = useRef({});
  const mobileDescriptionTargetRefs = useRef({});
  const descriptionFlyerRefs = useRef({});
  const descriptionFlightPlayedRef = useRef({
    green: false,
    materials: false,
    "compare-green": false,
    "compare-materials": false,
  });

  const markCompareDemoPlayed = useCallback(() => setCompareDemoPlayed(true), []);

  useEffect(() => preloadCompareAssets(), []);

  useEffect(() => {
    const query = window.matchMedia(MOBILE_LAYOUT_QUERY);
    const handleChange = (event) => setMobileLayout(event.matches);
    query.addEventListener?.("change", handleChange);
    return () => query.removeEventListener?.("change", handleChange);
  }, []);

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

  const descriptionFlights = useMemo(
    () =>
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
            : [],
    [activeTextStageId],
  );
  const activeTopicLanded =
    descriptionFlights.length > 0 &&
    descriptionFlights.every(({ sourceKey }) => landedTopics[sourceKey]);

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
      const target = mobileLayout
        ? mobileDescriptionTargetRefs.current[targetKey]
        : descriptionTargetRefs.current[targetKey];
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
  }, [activeTextStageId, activeTopicLanded, descriptionFlights, mobileLayout]);

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
      if (mobileLayout) {
        const readingLine = vh * 0.48;
        const panels = panelRefs.current.filter(Boolean);
        const panelMetrics = panels.map((panel) => {
          const rect = panel.getBoundingClientRect();
          return {
            panel,
            rect,
            center: rect.top + rect.height * 0.5,
          };
        });
        let nextId = stages[0].id;
        let minDistance = Infinity;

        panelMetrics.forEach(({ panel, rect, center }) => {
          const distance = Math.abs(center - readingLine);
          if (rect.bottom > 0 && rect.top < vh && distance < minDistance) {
            minDistance = distance;
            nextId = panel.dataset.stageId;
          }
        });

        const firstPanel = panels[0];
        const lastPanel = panels.at(-1);
        if (minDistance === Infinity && firstPanel?.getBoundingClientRect().top > readingLine) {
          nextId = firstPanel.dataset.stageId;
        } else if (
          minDistance === Infinity &&
          lastPanel?.getBoundingClientRect().bottom < readingLine
        ) {
          nextId = lastPanel.dataset.stageId;
        }

        setActiveStageId(nextId);
        setActiveTextStageId(nextId);

        const activeIndex = Math.max(
          0,
          stages.findIndex((stage) => stage.id === nextId),
        );
        const activeMetric = panelMetrics[activeIndex];
        if (activeMetric && localProgressRef.current) {
          const previousMetric = panelMetrics[activeIndex - 1];
          const nextMetric = panelMetrics[activeIndex + 1];
          const beatStart = previousMetric
            ? (previousMetric.center + activeMetric.center) * 0.5
            : activeMetric.rect.top;
          const beatEnd = nextMetric
            ? (activeMetric.center + nextMetric.center) * 0.5
            : activeMetric.rect.bottom;
          const beatDistance = Math.max(1, beatEnd - beatStart);
          const withinBeat = Math.min(
            1,
            Math.max(0, (readingLine - beatStart) / beatDistance),
          );

          stages.forEach((_, index) => {
            const fill = index < activeIndex ? 1 : index === activeIndex ? withinBeat : 0;
            localProgressRef.current?.style.setProperty(
              `--causes-progress-${index}`,
              fill.toFixed(4),
            );
          });
        }

        const sceneRect = sceneRef.current?.getBoundingClientRect();
        if (
          !enteredRef.current &&
          sceneRect &&
          sceneRect.top < vh * 0.58 &&
          sceneRect.bottom > 0
        ) {
          enteredRef.current = true;
          setSceneEntered(true);
        }
        if (
          !scrollCueShownRef.current &&
          sceneRect &&
          sceneRect.top < vh * 0.58 &&
          sceneRect.bottom > 0
        ) {
          scrollCueShownRef.current = true;
          scrollCueVisibleRef.current = true;
          scrollCueStartYRef.current = window.scrollY;
          setScrollCueVisible(true);
        } else if (
          scrollCueVisibleRef.current &&
          Math.abs(window.scrollY - scrollCueStartYRef.current) >= 44
        ) {
          scrollCueVisibleRef.current = false;
          setScrollCueVisible(false);
        }
        return;
      }

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
  }, [mobileLayout, stages]);

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
      if (mobileLayout) {
        const vh = window.innerHeight || 768;
        const panelRect = comparePanel?.getBoundingClientRect();
        const exiting =
          inCompareBeat && Boolean(panelRect) && panelRect.bottom <= vh * 1.02;
        setCompareMapVisible(inCompareBeat);
        setCompareExiting(exiting);
        return;
      }
      if (!inCompareBeat || !compareText || !comparePanel) {
        setCompareMapVisible(false);
        setCompareExiting(false);
        return;
      }

      const vh = window.innerHeight || 768;
      const textRect = compareText.getBoundingClientRect();
      const panelRect = comparePanel.getBoundingClientRect();

      const mapHeight = Math.min(vh * 0.54, 600);
      const mapTop = vh * 0.62 - mapHeight / 2;
      const revealed = textRect.bottom <= mapTop + 8;
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
  }, [activeStageId, activeTextStageId, mobileLayout, stages]);

  const activeStage = stages.find((s) => s.id === activeStageId) ?? stages[0];
  const compareTextActive = activeTextStageId === "compare";
  const textStageId = activeTextStageId ?? activeStageId ?? stages[0].id;
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
  const baseCropLeaving = compareTextActive || isComparing;
  const connectorStage = stages.find((s) => s.id === activeTextStageId);
  const connectorVisible =
    Boolean(connectorStage) && activeTextStageId !== "compare" && !isComparing;
  const textMotionStyle = (isActive) => ({
    opacity: isActive ? 1 : 0,
    transform: isActive ? "translateY(0px)" : "translateY(34px)",
  });
  const mobileNarrativeStageId = textStageId;
  const comparisonStage = stages.find((stage) => stage.id === "compare");
  const localStepIndex = Math.max(
    0,
    stages.findIndex((stage) => stage.id === mobileNarrativeStageId),
  );
  const localStepLabel = uiContent.localStory.stepLabelTemplate
    .replace("{current}", String(localStepIndex + 1))
    .replace("{total}", String(stages.length));
  const causeScrollCue =
    uiContent.localStory.scrollCause ?? uiContent.localStory.scrollPage;

  return (
    <section
      id="causes"
      className="causes-section"
      aria-label={physicalDrivers.intro.ariaLabel}
    >
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

      <div className="causes-intro">
        <span className="causes-intro-leaf" aria-hidden="true" />
        <SectionDivider />
        <div className="causes-intro-inner">
          <h2 className="causes-title">{title}</h2>
          <p className="causes-aperture">{aperture}</p>
          <p className="causes-aperture causes-aperture--break">
            {apertureCauseParts.map((part) => {
              if (!part.kw) return <Fragment key={part.id}>{part.text}</Fragment>;
              if (part.topic === "green" || part.topic === "materials") {
                return (
                  <span
                    key={part.id}
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
                <span key={part.id} className="kw">
                  {part.text}
                </span>
              );
            })}
          </p>
          <p className="causes-aperture-close">{apertureClose}</p>
        </div>
      </div>

      <div
        id="causes-scene"
        ref={sceneRef}
        className={`causes-scene${sceneEntered ? " causes-scene--entered" : ""}`}
      >
        <div
          ref={stageRef}
          className={`causes-stage causes-stage--pos-${stagePosition} causes-stage--tone-${atmosphereTone}${mobileLayout && mobileNarrativeStageId === "compare" ? " causes-stage--mobile-compare" : ""}`}
        >
          <div
            className={`causes-topic-header${compareTopicsActive ? " causes-topic-header--compare" : ""}`}
          >
            <span className="causes-topic-header-labels" aria-hidden="true">
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
            </span>
            {mobileLayout ? (
              <div
                ref={localProgressRef}
                className="causes-local-progress"
              >
                <span className="sr-only" aria-live="polite" aria-atomic="true">
                  {localStepLabel}
                </span>
                <span className="causes-progress-count tnum" aria-hidden="true">
                  {String(localStepIndex + 1).padStart(2, "0")} /{" "}
                  {String(stages.length).padStart(2, "0")}
                </span>
                <span className="causes-progress-segments" aria-hidden="true">
                  {stages.map((stage, index) => (
                    <span
                      key={stage.id}
                      className="causes-progress-segment"
                      style={{
                        "--causes-progress-fill": `var(--causes-progress-${index}, ${index < localStepIndex ? 1 : 0})`,
                      }}
                    />
                  ))}
                </span>
              </div>
            ) : null}
            {mobileLayout && scrollCueVisible ? (
              <span className="causes-scroll-cue">
                <span aria-hidden="true">↓</span> {causeScrollCue}
              </span>
            ) : null}
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
            className={`causes-crop${lensDrawn || mobileLayout ? " causes-crop--drawn" : ""}${baseCropLeaving ? " causes-crop--leaving" : ""}${isComparing ? " causes-crop--compare-hidden" : ""}`}
          >
            <div className="causes-crop-wash" aria-hidden="true" />

            {mobileLayout ? (
              <CausesStaticRaster lens={visualStage.lens} />
            ) : (
              <CausesCropMap
                lens={visualStage.lens}
                expanded={compareMapVisible}
                showHotspots={compareMapVisible}
                onDrawnChange={setLensDrawn}
              />
            )}

            {(lensDrawn || mobileLayout) && !baseCropLeaving && lensLegends[visualStage.lens] && (
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

          {!mobileLayout && (
            <CausesCompareMap
              cropRef={compareCropRef}
              sliderValue={sliderValue}
              onSliderChange={setSliderValue}
              visible={compareMapVisible}
              exiting={compareExiting}
              active={compareMapVisible}
              demoPlayed={compareDemoPlayed}
              onDemoEnd={markCompareDemoPlayed}
              hotspotLegendLabel={hotspotLegendLabel}
              comparisonAriaLabel={comparisonAriaLabel}
              handleHint={handleHint}
            />
          )}

          {mobileLayout && comparisonStage && (
            <div
              className={`causes-mobile-compare-stack${mobileNarrativeStageId === "compare" ? " is-active" : ""}`}
              aria-hidden={mobileNarrativeStageId !== "compare"}
            >
              <div
                className="causes-mobile-story causes-mobile-story--compare"
                lang={locale}
                aria-live="polite"
              >
                <p
                  className={`causes-mobile-story-body${mobileNarrativeStageId === "compare" ? " causes-mobile-story-body--active" : ""}`}
                  aria-hidden={mobileNarrativeStageId !== "compare"}
                >
                  <NarrativeSegments
                    segments={comparisonStage.segments}
                    landedDescriptions={landedDescriptions}
                    targetRefs={mobileDescriptionTargetRefs}
                  />
                </p>
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
                hotspotLegendLabel={hotspotLegendLabel}
                comparisonAriaLabel={comparisonAriaLabel}
                handleHint={handleHint}
                mobile
              />
            </div>
          )}

          <div
            className="causes-mobile-story causes-mobile-story--steps"
            lang={locale}
            aria-live="polite"
            aria-hidden={!mobileLayout}
          >
            {stages.filter((stage) => stage.id !== "compare").map((stage) => {
              const active = mobileNarrativeStageId === stage.id;
              return (
                <p
                  key={stage.id}
                  className={`causes-mobile-story-body${active ? " causes-mobile-story-body--active" : ""}`}
                  aria-hidden={!active}
                >
                  <NarrativeSegments
                    segments={stage.segments}
                    landedDescriptions={landedDescriptions}
                    targetRefs={mobileDescriptionTargetRefs}
                  />
                </p>
              );
            })}
          </div>
        </div>

        <div className="causes-panels" lang={locale} aria-hidden={mobileLayout}>
          {stages.map((stage, index) => {
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
                {stage.segments && (
                  <p
                    ref={(node) => {
                      panelBodyRefs.current[stage.id] = node;
                    }}
                    className={`causes-panel-body${isTextActive ? " causes-panel-body--active" : ""}`}
                    style={textMotionStyle(isTextActive)}
                  >
                    <NarrativeSegments
                      segments={stage.segments}
                      landedDescriptions={landedDescriptions}
                      targetRefs={descriptionTargetRefs}
                    />
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="causes-exit" aria-hidden="true" />
    </section>
  );
}

const DEMO_STOPS = [50, 64, 36, 50];
const DEMO_LEG_MS = 760;
const DEMO_MS = DEMO_LEG_MS * (DEMO_STOPS.length - 1);
const DEMO_SETTLE_MS = 900;

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

function demoValueAt(elapsed) {
  const clamped = Math.min(Math.max(elapsed, 0), DEMO_MS);
  const leg = Math.min(Math.floor(clamped / DEMO_LEG_MS), DEMO_STOPS.length - 2);
  const t = easeInOut((clamped - leg * DEMO_LEG_MS) / DEMO_LEG_MS);
  return DEMO_STOPS[leg] + (DEMO_STOPS[leg + 1] - DEMO_STOPS[leg]) * t;
}

function CompareSlider({ value, onChange, autoDemo, onDemoEnd, ariaLabel, hint }) {
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [hintOn, setHintOn] = useState(() => !autoDemo || prefersReducedMotion());
  const [demoing, setDemoing] = useState(false);
  const demoCancelRef = useRef(null);

  const endDemo = useCallback(() => {
    demoCancelRef.current?.();
    demoCancelRef.current = null;
    setDemoing(false);
    setHintOn(true);
    onDemoEnd?.();
  }, [onDemoEnd]);

  useEffect(() => {
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
        aria-label={ariaLabel}
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
          {hint}
        </span>
      </button>
    </div>
  );
}

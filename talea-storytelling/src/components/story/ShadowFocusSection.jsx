import {
  useEffect,
  useState,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { MapLibreCanvas } from "../maps/MapLibreCanvas";
import { OpenLayersCanvas } from "../maps/OpenLayersCanvas";
import { useTimedSequence } from "../../hooks/useTimedSequence";
import {
  CAMERA_MS,
  SCROLL_ACCELERATION_GRACE_MS,
  cameraEasing,
} from "../../lib/motion";
import { SequenceStepper } from "../ui/SequenceStepper";
import { ScrollCue } from "../ui/ScrollCue";
import { LocalStoryProgress } from "../ui/LocalStoryProgress";
import { CountUp } from "../ui/CountUp";
import { prefersReducedMotion, useCountUpRun } from "../../hooks/useCountUpRun";
import {
  getShadowStageReadMs,
  shadowMetricLayout,
  shadowScene as shadowSceneTechnical,
} from "../../data/shadowFocus";
import { vicoloSvg } from "../../data/shadowVignette";
import { assetUrl } from "../../lib/assetUrl";
import { editorialLinks, useContent } from "../../content";
import { isMapSizeSynchronized } from "../../lib/mapResize";
import { useIOSFarOffscreenMount } from "../../hooks/useIOSFarOffscreenMount";
import { runtimeProfile } from "../../lib/runtimeProfile";

const bolognaBoundaryUrl = assetUrl("/data/vectors/bologna_boundary_outline.geojson");

const VICOLO_HTML = { __html: vicoloSvg };

const START_DELAY = 1200;
const TAIL_MS = 600;
const SCROLL_PLAYBACK_MAX = 4;

const MOBILE_LAYOUT_QUERY = "(max-width: 1279px)";
const MOBILE_PHASE_READING_LINE = 0.72;
const MOBILE_READ_MS_MULTIPLIER = 1.18;
const MOBILE_PANEL_OUT_MS = 280;
const MOBILE_GESTURE_HINT_MS = 4800;
const MOBILE_MAX_ZOOM = 16;

const MOBILE_BOLOGNA_BOUNDS = [
  [11.229655388117, 44.421112955943],
  [11.433714394127, 44.556205390267],
];
const MOBILE_CENTRO_BOUNDS = [
  [11.326802672492, 44.489950590522],
  [11.358517554921, 44.506549144341],
];

function getShadowMobileCameraPadding() {
  const width = window.innerWidth;
  const edge = width < 600 ? 18 : width < 900 ? 28 : 38;
  return {
    top: width < 600 ? 88 : 102,
    right: edge,
    bottom: width < 600 ? 218 : width < 900 ? 224 : 232,
    left: edge,
  };
}

function refitShadowMobileCamera(map, cameraKey) {
  map.fitBounds(
    cameraKey === "centro" ? MOBILE_CENTRO_BOUNDS : MOBILE_BOLOGNA_BOUNDS,
    { padding: getShadowMobileCameraPadding(), duration: 0 },
  );
}

const COLOR_AFTER_MS = 560;

const COUNT_STAGGER_MS = 250;

const CENTRO_TONE = "#E0C24B";
const CENTRO_VEIL_TONE = "#FFE604";

const STAGE_TONES = ["#1272B7", CENTRO_TONE];

const CENTRO_VEIL_OPACITY = 0.18;
const CENTRO_VEIL_IN_MS = 600;
const CENTRO_VEIL_HOLD_MS = 1500;
const CENTRO_VEIL_OUT_MS = 1100;

function renderLines(text) {
  const chunks = Array.isArray(text) ? text : [text];
  const lines = chunks.flatMap((chunk) =>
    String(chunk)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  );
  return lines.map((line, index) => (
    <span className={`sf-line${index > 0 ? " sf-line--secondary" : ""}`} key={index}>
      {line}
    </span>
  ));
}


function ShadowScene() {
  const sceneRef = useRef(null);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return undefined;
    if (prefersReducedMotion()) {
      scene.classList.add("drawn", "colored");
      return undefined;
    }

    const timers = [];
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          io.unobserve(entry.target);
          scene.classList.add("drawn");
          timers.push(
            window.setTimeout(() => scene.classList.add("colored"), COLOR_AFTER_MS),
          );
        });
      },
      { threshold: 0.18 },
    );
    io.observe(scene);
    return () => {
      io.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  return (
    <div
      ref={sceneRef}
      className="sf-intro-scene"
      aria-hidden="true"
      dangerouslySetInnerHTML={VICOLO_HTML}
    />
  );
}


function MunicipalComparison({ value, label }) {
  if (!value?.bologna_fmt) return null;
  return (
    <span className="sf-municipal-compare">
      {label} <strong>{value.bologna_fmt}</strong>
    </span>
  );
}

function LeadCell({ metric, value, delay, run, municipalComparison }) {
  return (
    <div className={`sf-lead-cell sf-lead-cell--${metric.tone}`}>
      <strong className="sf-lead-value tnum">
        <CountUp target={value.value_fmt} delay={delay} run={run} />
      </strong>
      <span className="sf-lead-label">{metric.label}</span>
      <span className="sf-lead-note">{metric.note}</span>
      <MunicipalComparison value={value} label={municipalComparison} />
    </div>
  );
}

function ShadowTable({ values, table }) {
  const stripRef = useRef(null);
  const run = useCountUpRun(stripRef);

  const lead = table.metrics.filter((m) => m.tier === "lead");
  const support = table.metrics.filter((m) => m.tier === "support");

  return (
    <section
      ref={stripRef}
      className="sf-strip"
      data-motion="story"
      aria-labelledby="shadow-table-title"
    >
      <header className="sf-strip-head">
        <h4 id="shadow-table-title" className="sf-strip-kicker">
          {table.kicker}
        </h4>
        <p className="sf-strip-scope">{table.scope}</p>
      </header>

      <div className="sf-strip-lead">
        <LeadCell metric={lead[0]} value={values[lead[0].key]} delay={0} run={run} municipalComparison={table.municipalComparison} />
        <span className="sf-strip-hinge">{table.hinge}</span>
        <LeadCell
          metric={lead[1]}
          value={values[lead[1].key]}
          delay={COUNT_STAGGER_MS}
          run={run}
          municipalComparison={table.municipalComparison}
        />
      </div>

      <p className="sf-strip-because">{table.because}</p>
      <div className="sf-strip-support">
        {support.map((metric, index) => (
          <span
            key={metric.key}
            className={`sf-support-cell sf-support-cell--${metric.tone}`}
          >
            <strong className="sf-support-value tnum">
              <CountUp
                target={values[metric.key].value_fmt}
                delay={(index + 2) * COUNT_STAGGER_MS}
                run={run}
              />
            </strong>
            <span className="sf-support-label">{metric.label}</span>
            <MunicipalComparison value={values[metric.key]} label={table.municipalComparison} />
          </span>
        ))}
      </div>
    </section>
  );
}


const shadowLinesUrl = assetUrl("/data/shadow-focus/bologna_shadow_lines.geojson");
const centroBoundaryUrl = assetUrl("/data/shadow-focus/centro_storico.geojson");
const centroAggregatesUrl = assetUrl("/data/shadow-focus/centro_aggregates.json");

// Low shadow is warm/exposed; high shadow is blue/shaded.
const shadowColorRamp = [
  "interpolate",
  ["linear"],
  ["coalesce", ["get", "s"], 0],
  0, "#9c2a05",
  0.25, "#e6550d",
  0.45, "#f7c08a",
  0.55, "#9ec4e1",
  0.75, "#1272B7",
  1, "#08306b",
];

const darkOpenfreemapStyle = {
  version: 8,
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {
    openmaptiles: {
      type: "vector",
      url: "https://tiles.openfreemap.org/planet",
    },
  },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#0B2A18" } },
    {
      id: "park",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "park",
      paint: { "fill-color": "#0c1612", "fill-opacity": 0.7 },
    },
    {
      id: "landcover-wood",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "landcover",
      filter: ["==", ["get", "class"], "wood"],
      paint: { "fill-color": "#0d1612", "fill-opacity": 0.55 },
    },
    {
      id: "water",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "water",
      paint: { "fill-color": "#0c1622", "fill-opacity": 0.95 },
    },
    {
      id: "transport-major",
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      filter: ["any",
        ["==", ["get", "class"], "tertiary"],
        ["==", ["get", "class"], "secondary"],
        ["==", ["get", "class"], "primary"],
        ["==", ["get", "class"], "trunk"],
        ["==", ["get", "class"], "motorway"],
      ],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "rgba(58, 68, 64, 0.5)",
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.4, 13, 0.9, 16, 2.0],
      },
    },
    {
      id: "place-label",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "place",
      filter: ["any",
        ["==", ["get", "class"], "city"],
        ["==", ["get", "class"], "town"],
        ["==", ["get", "class"], "suburb"],
      ],
      layout: {
        "text-field": ["get", "name"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 9, 10, 14, 13],
        "text-font": ["Noto Sans Regular"],
        "text-padding": 6,
      },
      paint: {
        "text-color": "rgba(255, 255, 255, 0.42)",
        "text-halo-color": "rgba(0, 0, 0, 0.75)",
        "text-halo-width": 1.6,
      },
    },
  ],
};

function SceneDarkMap({
  cameraKey,
  engaged,
  playbackRate,
  mobileLayout,
  locale,
  materialized,
}) {
  const [map, setMap] = useState(null);
  const handleReady = useCallback((m) => setMap(m), []);

  const centroProminent = cameraKey === "centro";
  const playbackRateRef = useRef(playbackRate);
  const mobileCameraTouchedRef = useRef(false);
  const mobileCameraKeyRef = useRef(null);
  const mobileCameraLimitsRef = useRef(null);
  const mobileRefitPendingRef = useRef(false);
  const mobileRefitFrameRef = useRef(null);
  const mobileRefitCameraKeyRef = useRef(null);
  const mobileCameraSnapshotRef = useRef(null);

  const handleRemoved = useCallback((removedMap) => {
    if (mobileCameraTouchedRef.current) {
      const center = removedMap.getCenter?.();
      mobileCameraSnapshotRef.current = center
        ? {
            center: [center.lng, center.lat],
            zoom: removedMap.getZoom(),
            bearing: removedMap.getBearing(),
            pitch: removedMap.getPitch(),
          }
        : null;
    } else {
      mobileCameraKeyRef.current = null;
    }
    if (mobileCameraLimitsRef.current?.map === removedMap) {
      mobileCameraLimitsRef.current = null;
    }
    setMap((current) => (current === removedMap ? null : current));
  }, []);
  useEffect(() => {
    playbackRateRef.current = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    if (!map) return;

    if (!map.getSource("scene-boundary-src")) {
      map.addSource("scene-boundary-src", { type: "geojson", data: bolognaBoundaryUrl });
    }
    if (!map.getLayer("scene-boundary-line")) {
      map.addLayer({
        id: "scene-boundary-line",
        type: "line",
        source: "scene-boundary-src",
        paint: { "line-color": "rgba(255, 255, 255, 0.16)", "line-width": 1.1 },
      });
    }

    if (!map.getSource("scene-shadow-src")) {
      map.addSource("scene-shadow-src", { type: "geojson", data: shadowLinesUrl });
    }
    if (!map.getLayer("scene-shadow-green-fill")) {
      map.addLayer({
        id: "scene-shadow-green-fill",
        type: "fill",
        source: "scene-shadow-src",
        filter: ["==", ["get", "k"], "g"],
        paint: {
          "fill-color": shadowColorRamp,
          "fill-opacity": 0,
          "fill-opacity-transition": { duration: 800, delay: 100 },
        },
      });
    }
    if (!map.getLayer("scene-shadow-street-fill")) {
      map.addLayer({
        id: "scene-shadow-street-fill",
        type: "fill",
        source: "scene-shadow-src",
        filter: ["==", ["get", "k"], "s"],
        paint: {
          "fill-color": shadowColorRamp,
          "fill-opacity": 0,
          "fill-opacity-transition": { duration: 900, delay: 200 },
        },
      });
    }

    if (!map.getSource("scene-centro-src")) {
      map.addSource("scene-centro-src", { type: "geojson", data: centroBoundaryUrl });
    }
    if (!map.getLayer("scene-centro-fill")) {
      map.addLayer({
        id: "scene-centro-fill",
        type: "fill",
        source: "scene-centro-src",
        paint: {
          "fill-color": CENTRO_VEIL_TONE,
          "fill-opacity": 0,
          "fill-opacity-transition": { duration: CENTRO_VEIL_IN_MS },
        },
      });
    }
    if (!map.getLayer("scene-centro-glow")) {
      map.addLayer({
        id: "scene-centro-glow",
        type: "line",
        source: "scene-centro-src",
        paint: {
          "line-color": CENTRO_TONE,
          "line-width": ["interpolate", ["linear"], ["zoom"], 11, 10, 13.5, 18, 15, 24],
          "line-opacity": 0,
          "line-opacity-transition": { duration: 700 },
          "line-blur": ["interpolate", ["linear"], ["zoom"], 11, 6, 13.5, 11, 15, 15],
        },
      });
    }
    if (!map.getLayer("scene-centro-casing")) {
      map.addLayer({
        id: "scene-centro-casing",
        type: "line",
        source: "scene-centro-src",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#0B2A18",
          "line-width": ["interpolate", ["linear"], ["zoom"], 11, 6, 13.5, 10, 15, 13],
          "line-opacity": 0,
          "line-opacity-transition": { duration: 700 },
        },
      });
    }
    if (!map.getLayer("scene-centro-line")) {
      map.addLayer({
        id: "scene-centro-line",
        type: "line",
        source: "scene-centro-src",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": CENTRO_TONE,
          "line-width": ["interpolate", ["linear"], ["zoom"], 11, 2.6, 13.5, 4.4, 15, 5.6],
          "line-opacity": 0,
          "line-opacity-transition": { duration: 700 },
        },
      });
    }
  }, [map]);

  useEffect(() => {
    if (!map) return;
    if (map.getLayer("scene-shadow-street-fill")) {
      map.setPaintProperty("scene-shadow-street-fill", "fill-opacity-transition", {
        duration: 900 / playbackRate,
        delay: 200 / playbackRate,
      });
      map.setPaintProperty("scene-shadow-street-fill", "fill-opacity", engaged ? 0.92 : 0);
    }
    if (map.getLayer("scene-shadow-green-fill")) {
      map.setPaintProperty("scene-shadow-green-fill", "fill-opacity-transition", {
        duration: 800 / playbackRate,
        delay: 100 / playbackRate,
      });
      map.setPaintProperty("scene-shadow-green-fill", "fill-opacity", engaged ? 0.82 : 0);
    }
  }, [map, engaged, playbackRate]);

  useEffect(() => {
    if (!map) return;

    if (mobileLayout) {
      if (mobileCameraLimitsRef.current?.map === map) return;
      const originalMinZoom = map.getMinZoom();
      const originalMaxBounds = map.getMaxBounds()?.toArray?.() ?? null;

      map.fitBounds(MOBILE_BOLOGNA_BOUNDS, {
        padding: getShadowMobileCameraPadding(),
        duration: 0,
      });
      const initialZoom = map.getZoom();
      const initialBounds = map.getBounds().toArray();
      map.setMinZoom(initialZoom);
      map.setMaxBounds(initialBounds);
      mobileCameraLimitsRef.current = {
        map,
        originalMinZoom,
        originalMaxBounds,
      };
      const cameraSnapshot = mobileCameraSnapshotRef.current;
      if (cameraSnapshot) {
        map.jumpTo(cameraSnapshot);
        mobileCameraSnapshotRef.current = null;
        mobileCameraTouchedRef.current = true;
      }
      return;
    }

    const mobileLimits = mobileCameraLimitsRef.current;
    if (mobileLimits?.map !== map) return;
    map.setMaxBounds(mobileLimits.originalMaxBounds);
    map.setMinZoom(mobileLimits.originalMinZoom);
    mobileCameraLimitsRef.current = null;
  }, [map, mobileLayout]);

  useEffect(() => {
    if (map && !engaged) map.stop();
  }, [map, engaged]);

  useEffect(() => {
    if (!map) return;
    if (mobileLayout) {
      const nextKey = cameraKey === "centro" ? "centro" : "overview";
      if (mobileCameraKeyRef.current !== nextKey) {
        mobileCameraKeyRef.current = nextKey;
        mobileCameraTouchedRef.current = false;
        map.fitBounds(
          nextKey === "centro" ? MOBILE_CENTRO_BOUNDS : MOBILE_BOLOGNA_BOUNDS,
          {
            padding: getShadowMobileCameraPadding(),
            duration: prefersReducedMotion() ? 0 : CAMERA_MS / playbackRate,
            easing: cameraEasing,
            essential: true,
          },
        );
      }
    } else {
      mobileCameraKeyRef.current = null;
      const camera =
        shadowSceneTechnical.stages.find((s) => s.id === cameraKey)?.camera ?? shadowSceneTechnical.opening;
      map.easeTo({
        center: camera.center,
        zoom: camera.zoom,
        duration: prefersReducedMotion() ? 0 : CAMERA_MS / playbackRate,
        easing: cameraEasing,
        essential: true,
      });
    }

    const centroOpacity = {
      "scene-centro-glow": mobileLayout ? 0.68 : 0.42,
      "scene-centro-casing": mobileLayout ? 0.96 : 0.88,
      "scene-centro-line": 1,
    };
    Object.entries(centroOpacity).forEach(([layerId, opacity]) => {
      if (!map.getLayer(layerId)) return;
      map.setPaintProperty(layerId, "line-opacity-transition", {
        duration: 700 / playbackRate,
      });
      map.setPaintProperty(layerId, "line-opacity", centroProminent ? opacity : 0);
    });
  }, [map, cameraKey, centroProminent, playbackRate, mobileLayout]);

  useEffect(() => {
    if (!map || !mobileLayout) return undefined;

    const markCameraTouched = (event) => {
      if (event.originalEvent) mobileCameraTouchedRef.current = true;
    };
    const refitUntouchedCamera = () => {
      mobileRefitFrameRef.current = null;
      if (
        !mobileRefitPendingRef.current ||
        !engaged ||
        !isMapSizeSynchronized(map)
      ) {
        return;
      }
      mobileRefitPendingRef.current = false;
      const pendingCameraKey = mobileRefitCameraKeyRef.current ?? cameraKey;
      mobileRefitCameraKeyRef.current = null;
      if (mobileCameraTouchedRef.current) return;
      refitShadowMobileCamera(map, pendingCameraKey);
    };
    const requestRefit = () => {
      if (mobileRefitFrameRef.current !== null) return;
      mobileRefitFrameRef.current = requestAnimationFrame(refitUntouchedCamera);
    };
    const noteViewportResize = () => {
      mobileRefitPendingRef.current = true;
      mobileRefitCameraKeyRef.current = cameraKey;
      if (engaged) requestRefit();
    };
    const handleMapResize = () => {
      if (mobileRefitPendingRef.current && engaged) requestRefit();
    };

    map.on("zoomstart", markCameraTouched);
    map.on("dragstart", markCameraTouched);
    map.on("resize", handleMapResize);
    window.addEventListener("resize", noteViewportResize);
    if (mobileRefitPendingRef.current && engaged) requestRefit();
    return () => {
      if (mobileRefitFrameRef.current !== null) {
        cancelAnimationFrame(mobileRefitFrameRef.current);
        mobileRefitFrameRef.current = null;
      }
      map.off("zoomstart", markCameraTouched);
      map.off("dragstart", markCameraTouched);
      map.off("resize", handleMapResize);
      window.removeEventListener("resize", noteViewportResize);
    };
  }, [map, mobileLayout, cameraKey, engaged]);

  useLayoutEffect(() => {
    if (
      !map ||
      !mobileLayout ||
      !engaged ||
      !mobileRefitPendingRef.current ||
      !isMapSizeSynchronized(map)
    ) {
      return;
    }
    mobileRefitPendingRef.current = false;
    const pendingCameraKey = mobileRefitCameraKeyRef.current ?? cameraKey;
    mobileRefitCameraKeyRef.current = null;
    if (mobileCameraTouchedRef.current) return;
    refitShadowMobileCamera(map, pendingCameraKey);
  }, [map, mobileLayout, cameraKey, engaged]);

  useEffect(() => {
    if (!map || !map.getLayer("scene-centro-fill")) return undefined;
    const rate = playbackRateRef.current;

    if (!centroProminent || prefersReducedMotion()) {
      map.setPaintProperty("scene-centro-fill", "fill-opacity-transition", {
        duration: CENTRO_VEIL_OUT_MS / rate,
      });
      map.setPaintProperty("scene-centro-fill", "fill-opacity", 0);
      return undefined;
    }

    map.setPaintProperty("scene-centro-fill", "fill-opacity-transition", {
      duration: CENTRO_VEIL_IN_MS / rate,
    });
    map.setPaintProperty("scene-centro-fill", "fill-opacity", CENTRO_VEIL_OPACITY);
    const veilOut = window.setTimeout(() => {
      if (!map.getLayer("scene-centro-fill")) return;
      map.setPaintProperty("scene-centro-fill", "fill-opacity-transition", {
        duration: CENTRO_VEIL_OUT_MS / rate,
      });
      map.setPaintProperty("scene-centro-fill", "fill-opacity", 0);
    }, CENTRO_VEIL_HOLD_MS / rate);
    return () => window.clearTimeout(veilOut);
  }, [map, centroProminent]);

  if (!materialized) return null;
  const CanvasRenderer = runtimeProfile.useIOSCanvasMaps
    ? OpenLayersCanvas
    : MapLibreCanvas;
  return (
    <CanvasRenderer
      onMapReady={handleReady}
      onMapRemoved={handleRemoved}
      mapName="Ombra"
      className="sf-scene-canvas"
      mapStyle={darkOpenfreemapStyle}
      center={shadowSceneTechnical.opening.center}
      zoom={shadowSceneTechnical.opening.zoom}
      minZoom={10.4}
      maxZoom={mobileLayout ? MOBILE_MAX_ZOOM : 15}
      interactive={mobileLayout}
      cooperativeGestures={mobileLayout}
      locale={locale}
      collapseAttribution={mobileLayout}
      background="#0B2A18"
    />
  );
}


export function ShadowFocusSection() {
  const { content, locale, uiContent } = useContent();
  const shadowContent = content.shadowFocus;
  const shadowFocus = shadowContent.intro;
  const shadowFinal = shadowContent.closing;
  const { shadowScene, shadowStageReadMs, shadowTable } = useMemo(() => {
    const shadowStageCopy = new Map(
      shadowContent.map.stages.map((stage) => [stage.id, stage]),
    );
    const scene = {
      ...shadowSceneTechnical,
      ...shadowContent.map,
      stages: shadowSceneTechnical.stages.map((stage) => ({
        ...stage,
        body: shadowStageCopy.get(stage.id).body,
      })),
    };
    const shadowMetricCopy = new Map(
      shadowContent.statistics.metrics.map((metric) => [metric.metricId, metric]),
    );
    return {
      shadowScene: scene,
      shadowStageReadMs: getShadowStageReadMs(scene.stages),
      shadowTable: {
        ...shadowContent.statistics,
        metrics: shadowMetricLayout.map((metric) => ({
          ...metric,
          ...shadowMetricCopy.get(metric.metricId),
        })),
      },
    };
  }, [shadowContent]);
  const [aggregates, setAggregates] = useState(null);
  const [engaged, setEngaged] = useState(false);
  const [exitVeil, setExitVeil] = useState(false);
  const [sequenceVisible, setSequenceVisible] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [mobileLayout, setMobileLayout] = useState(
    () =>
      typeof window !== "undefined" &&
      (runtimeProfile.forceIPhoneLayout ||
        window.matchMedia(MOBILE_LAYOUT_QUERY).matches),
  );
  const [renderedMobileIndex, setRenderedMobileIndex] = useState(0);
  const [mobilePanelExiting, setMobilePanelExiting] = useState(false);
  const [mobileScrollCueVisible, setMobileScrollCueVisible] = useState(false);
  const [mobileScrollCueDismissed, setMobileScrollCueDismissed] = useState(false);
  const [mobileGestureHintVisible, setMobileGestureHintVisible] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);

  const sceneRef = useRef(null);
  const sceneMapRef = useRef(null);
  const holdRef = useRef(null);
  const mobileTrackRef = useRef(null);
  const mobileProgressRef = useRef(null);
  const engagedRef = useRef(false);
  const mobileTransitionTimerRef = useRef(null);
  const mobileScrollCueShownRef = useRef(false);
  const mobileGestureHintShownRef = useRef(false);
  const scrollAccelerationUnlockAtRef = useRef(Infinity);
  const mapMaterialized = useIOSFarOffscreenMount(sceneRef, {
    name: "Ombra",
    prewarmViewports: 1.5,
    releaseViewports: 3,
    keepAliveAfterMount: runtimeProfile.useIOSCanvasMaps,
  });

  const stages = shadowScene.stages;
  const mobileStepReadMs = useMemo(
    () =>
      shadowStageReadMs.map((duration) =>
        Math.round(duration * MOBILE_READ_MS_MULTIPLIER),
      ),
    [shadowStageReadMs],
  );
  const {
    revealed: timedRevealed,
    complete: timedComplete,
    activeIndex: timedActiveIndex,
    selected,
    goTo,
    getPlaybackSnapshot,
  } = useTimedSequence({
    count: stages.length,
    engaged: engaged && !legendOpen,
    startDelay: START_DELAY,
    readMs: mobileLayout ? mobileStepReadMs : shadowStageReadMs,
    tailMs: TAIL_MS,
    pickDuringPlay: true,
    playbackRate,
  });

  const activeIndex = timedActiveIndex;
  const revealed = timedRevealed;
  const complete = timedComplete;
  const cameraKey = engaged ? stages[activeIndex].id : "opening";

  const mapLibreLocale = useMemo(
    () => ({
      "AttributionControl.ToggleAttribution": uiContent.map.toggleAttribution,
      "Map.Title": uiContent.map.title,
      "CooperativeGesturesHandler.WindowsHelpText":
        uiContent.map.cooperativeGestures.windows,
      "CooperativeGesturesHandler.MacHelpText":
        uiContent.map.cooperativeGestures.mac,
      "CooperativeGesturesHandler.MobileHelpText":
        uiContent.map.cooperativeGestures.mobile,
    }),
    [uiContent],
  );

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_LAYOUT_QUERY);
    const handler = (event) =>
      setMobileLayout(runtimeProfile.forceIPhoneLayout || event.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  useEffect(() => {
    if (!mobileLayout || !legendOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setLegendOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileLayout, legendOpen]);

  useEffect(() => {
    if (
      !mobileLayout ||
      !engaged ||
      mobileScrollCueShownRef.current
    ) {
      return undefined;
    }

    mobileScrollCueShownRef.current = true;
    const startY = window.scrollY;
    setMobileScrollCueVisible(true);

    const dismissCue = () => {
      if (Math.abs(window.scrollY - startY) < 48) return;
      setMobileScrollCueVisible(false);
      setMobileScrollCueDismissed(true);
      window.removeEventListener("scroll", dismissCue);
    };

    window.addEventListener("scroll", dismissCue, { passive: true });
    return () => {
      window.removeEventListener("scroll", dismissCue);
      setMobileScrollCueVisible(false);
      setMobileScrollCueDismissed(true);
    };
  }, [engaged, mobileLayout]);

  useEffect(() => {
    if (
      !mobileLayout ||
      !engaged ||
      !mobileScrollCueDismissed ||
      legendOpen ||
      mobileGestureHintShownRef.current
    ) {
      return undefined;
    }
    mobileGestureHintShownRef.current = true;
    setMobileGestureHintVisible(true);
    const dismissHint = () => setMobileGestureHintVisible(false);
    const timer = window.setTimeout(dismissHint, MOBILE_GESTURE_HINT_MS);
    const mapBox = sceneMapRef.current;
    mapBox?.addEventListener("touchstart", dismissHint, {
      passive: true,
      once: true,
    });
    return () => {
      window.clearTimeout(timer);
      mapBox?.removeEventListener("touchstart", dismissHint);
      setMobileGestureHintVisible(false);
    };
  }, [engaged, legendOpen, mobileLayout, mobileScrollCueDismissed]);

  useEffect(() => {
    if (!mobileLayout || !engaged) return undefined;

    let frame = null;
    const updateProgress = () => {
      const progressNode = mobileProgressRef.current;
      if (progressNode) {
        const snapshot = getPlaybackSnapshot();
        const stepStart = snapshot.entries[activeIndex] ?? 0;
        const stepEnd =
          snapshot.entries[activeIndex + 1] ?? snapshot.endAt ?? stepStart;
        const duration = Math.max(1, stepEnd - stepStart);
        const timelineProgress = Math.min(
          1,
          Math.max(0, (snapshot.virtualElapsed - stepStart) / duration),
        );
        const withinStepProgress =
          complete || selected != null ? 1 : timelineProgress;
        progressNode.style.setProperty(
          "--local-story-progress",
          String(withinStepProgress),
        );
      }
      if (!legendOpen && !complete && selected == null) {
        frame = window.requestAnimationFrame(updateProgress);
      }
    };

    updateProgress();
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [activeIndex, complete, engaged, getPlaybackSnapshot, legendOpen, mobileLayout, selected]);

  useEffect(() => {
    if (!mobileLayout || renderedMobileIndex === activeIndex) {
      return undefined;
    }
    window.clearTimeout(mobileTransitionTimerRef.current);
    mobileTransitionTimerRef.current = window.setTimeout(() => {
      setMobilePanelExiting(true);
      mobileTransitionTimerRef.current = window.setTimeout(() => {
        setRenderedMobileIndex(activeIndex);
        setMobilePanelExiting(false);
        mobileTransitionTimerRef.current = null;
      }, prefersReducedMotion() ? 0 : MOBILE_PANEL_OUT_MS);
    }, 0);
    return () => window.clearTimeout(mobileTransitionTimerRef.current);
  }, [activeIndex, mobileLayout, renderedMobileIndex]);

  const goToMobileStep = useCallback((nextIndex) => {
    const index = Math.min(stages.length - 1, Math.max(0, nextIndex));
    goTo(index);
  }, [goTo, stages.length]);

  useEffect(() => {
    scrollAccelerationUnlockAtRef.current = engaged
      ? performance.now() + SCROLL_ACCELERATION_GRACE_MS
      : Infinity;
  }, [engaged]);

  useEffect(() => {
    let ignore = false;
    fetch(centroAggregatesUrl).then((r) => r.json())
      .then((d) => { if (!ignore) setAggregates(d); }).catch(() => {});
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    let frame = null;
    const update = () => {
      frame = null;
      const vh = window.innerHeight || 768;
      const readingLine = vh * 0.52;
      const sceneRect = sceneRef.current?.getBoundingClientRect();
      const holdRect = holdRef.current?.getBoundingClientRect();
      const inScene = Boolean(sceneRect) && sceneRect.top < vh && sceneRect.bottom > 0;

      if (mobileLayout) {
        const mobileReleaseLine = engagedRef.current ? 0.28 : 0.12;
        const nextEngaged =
          inScene && Boolean(sceneRect) && sceneRect.top <= vh * mobileReleaseLine;
        const phaseLine = vh * MOBILE_PHASE_READING_LINE;
        const phaseNodes = mobileTrackRef.current?.querySelectorAll(
          ".sf-mobile-beat[data-mobile-step]",
        );
        const introRect = phaseNodes?.[0]?.getBoundingClientRect();
        const introProgress = introRect
          ? Math.min(
              1,
              Math.max(
                0,
                (phaseLine - introRect.top) / Math.max(1, introRect.height),
              ),
            )
          : 0;
        const scrollRate =
          Math.round((1 + introProgress * (SCROLL_PLAYBACK_MAX - 1)) * 4) / 4;
        const scrollAccelerationReady =
          performance.now() >= scrollAccelerationUnlockAtRef.current;
        const nextExitVeil =
          nextEngaged &&
          complete &&
          Boolean(sceneRect) &&
          sceneRect.bottom <= vh * 1.15;
        setPlaybackRate(
          nextEngaged && !complete && scrollAccelerationReady ? scrollRate : 1,
        );
        setSequenceVisible(nextEngaged && !nextExitVeil);
        setExitVeil(nextExitVeil);
        engagedRef.current = nextEngaged;
        setEngaged(nextEngaged);
        if (!nextEngaged || nextExitVeil) setLegendOpen(false);
        return;
      }

      const nextEngaged = inScene && sceneRect.top <= vh * 0.55;

      const travelled = holdRect
        ? (vh - holdRect.top) / Math.max(1, holdRect.height)
        : 0;
      const holdProgress = Math.min(1, Math.max(0, travelled));
      const scrollRate =
        Math.round((1 + holdProgress * (SCROLL_PLAYBACK_MAX - 1)) * 4) / 4;
      const scrollAccelerationReady =
        performance.now() >= scrollAccelerationUnlockAtRef.current;
      setPlaybackRate(
        nextEngaged && !complete && scrollAccelerationReady ? scrollRate : 1,
      );

      const pastHold = Boolean(holdRect) && holdRect.bottom <= readingLine;

      setSequenceVisible(nextEngaged && (!pastHold || !complete));

      const nextExitVeil = nextEngaged
        && complete
        && pastHold
        && Boolean(sceneRect)
        && sceneRect.bottom <= vh * 1.15;

      setEngaged(nextEngaged);
      setExitVeil(nextExitVeil);
    };
    const requestUpdate = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, [complete, mobileLayout, stages.length]);

  const values = useMemo(() => {
    if (!aggregates?.metrics) return null;
    return shadowTable.metrics.every((m) => aggregates.metrics[m.key])
      ? aggregates.metrics
      : null;
  }, [aggregates, shadowTable]);

  const legendContent = (
    <>
      <span className="sf-scene-legend-title">{shadowScene.legend.title}</span>
      <span className="sf-scene-legend-description">{shadowScene.legend.description}</span>
      <span className="sf-scene-legend-bar" />
      <div className="sf-scene-legend-labels">
        <span className="sf-scene-legend-label">{shadowScene.legend.from}</span>
        <span className="sf-scene-legend-label">{shadowScene.legend.to}</span>
      </div>
      <a
        className="sf-scene-legend-link"
        href={editorialLinks.shadowFocus.data}
        target="_blank"
        rel="noopener noreferrer"
      >
        {shadowScene.legend.sourceLink.label} →
      </a>
    </>
  );

  return (
    <section
      id="ombra"
      className="shadow-focus"
      aria-label={shadowContent.ariaLabel}
      lang={locale}
    >
      <div className="sf-intro">
        <ShadowScene />
        <div className="sf-intro-inner">
          <p className="sf-opening">{shadowFocus.opening}</p>
          <h3 className="sf-title">{shadowFocus.title}</h3>
          <p className="sf-lead">{shadowFocus.lead}</p>
          <p className="sf-pivot">{shadowFocus.pivot}</p>
        </div>
      </div>

      <section
        ref={sceneRef}
        className={`sf-scene${engaged ? " sf-scene--engaged" : ""}${exitVeil ? " sf-scene--exiting" : ""}`}
        aria-label={shadowScene.ariaLabel}
      >
        <div
          ref={sceneMapRef}
          className={`sf-scene-map${engaged ? " sf-scene-map--engaged" : ""}${exitVeil ? " sf-scene-map--exiting" : ""}`}
        >
          <SceneDarkMap
            cameraKey={cameraKey}
            engaged={engaged}
            playbackRate={playbackRate}
            mobileLayout={mobileLayout}
            locale={mapLibreLocale}
            materialized={mapMaterialized}
          />
          <div className="sf-scene-frame" aria-hidden="true" />
          <div className="sf-scene-exit-veil" aria-hidden="true" />
          {!mobileLayout && <div className="sf-scene-legend">
            <span className="sf-scene-legend-title">{shadowScene.legend.title}</span>
            <span className="sf-scene-legend-description">{shadowScene.legend.description}</span>
            <span className="sf-scene-legend-bar" />
            <div className="sf-scene-legend-labels">
              <span className="sf-scene-legend-label">{shadowScene.legend.from}</span>
              <span className="sf-scene-legend-label">{shadowScene.legend.to}</span>
            </div>
            <a
              className="sf-scene-legend-link"
              href={editorialLinks.shadowFocus.data}
              target="_blank"
              rel="noopener noreferrer"
            >
              {shadowScene.legend.sourceLink.label} →
            </a>
          </div>}

          {engaged && !mobileLayout && (
            <div
              className={`sf-sequence${sequenceVisible ? " sf-sequence--in" : " sf-sequence--out"}${complete ? " sf-sequence--complete" : ""}`}
              data-motion="story"
            >
              <div className="sf-sequence-stack">
                {stages.map((stage, index) => {
                  const isActive = index === activeIndex;
                  return (
                    <button
                      key={stage.id}
                      type="button"
                      className={`sf-seq-item${isActive ? " is-active" : " is-dim"}`}
                      style={{ "--tier": STAGE_TONES[index] }}
                      onClick={() => goTo(index)}
                      aria-pressed={isActive}
                    >
                      {renderLines(stage.body)}
                    </button>
                  );
                })}
              </div>

              <div
                className={`sf-sequence-foot${revealed > 0 ? " sf-sequence-foot--live" : ""}`}
              >
                <SequenceStepper
                  count={stages.length}
                  revealed={revealed}
                  activeIndex={activeIndex}
                  complete={complete}
                  captionPlaying={shadowScene.sequence.playing}
                  captionDone={shadowScene.sequence.done}
                  variant="dark"
                  showNavigation={false}
                  stepMs={shadowStageReadMs}
                  playbackRate={playbackRate}
                  tones={STAGE_TONES}
                />
                {complete && (
                  <ScrollCue variant="dark" className="sf-sequence-cue" />
                )}
              </div>
            </div>
          )}

          {engaged && mobileLayout && mobileScrollCueVisible && !legendOpen && (
            <div className="sf-page-scroll-cue" role="status" aria-live="polite">
              <span aria-hidden="true">↓</span>
              <span>{uiContent.localStory.scrollPage}</span>
            </div>
          )}

          {engaged && mobileLayout && revealed > 0 && (
            <div
              className={`sf-mobile-story${sequenceVisible ? " sf-mobile-story--in" : " sf-mobile-story--out"}${mobilePanelExiting ? " is-exiting" : ""}`}
              style={{ "--tier": STAGE_TONES[renderedMobileIndex] }}
              data-motion="story"
            >
              <div className="sf-mobile-story-card" role="status" aria-live="polite">
                <span className="sf-mobile-story-marker" aria-hidden="true" />
                <div className="sf-mobile-story-copy">
                  {renderLines(stages[renderedMobileIndex].body)}
                </div>
              </div>
              <div
                className={`sf-mobile-story-nav${complete ? " sf-mobile-story-nav--complete" : ""}`}
              >
                <div className="sf-mobile-nav-copy">
                  <LocalStoryProgress
                    ref={mobileProgressRef}
                    className="sf-local-progress"
                    currentStep={activeIndex}
                    stepCount={stages.length}
                    labelTemplate={uiContent.localStory.stepLabelTemplate}
                  />
                  {complete && (
                    <span className="sf-mobile-sequence-status">
                      {uiContent.map.hotspotSequenceDone}
                    </span>
                  )}
                </div>
                <div className="sf-mobile-sequence-controls">
                  <button
                    type="button"
                    className="sf-mobile-sequence-control"
                    onClick={() => goToMobileStep(activeIndex - 1)}
                    disabled={activeIndex === 0}
                    aria-label={uiContent.actions.previousItem}
                  >
                    <span aria-hidden="true">←</span>
                  </button>
                  <button
                    type="button"
                    className="sf-mobile-sequence-control"
                    onClick={() => goToMobileStep(activeIndex + 1)}
                    disabled={activeIndex === stages.length - 1}
                    aria-label={uiContent.actions.nextItem}
                  >
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {mobileLayout && mobileGestureHintVisible && !legendOpen && (
            <div className="sf-mobile-gesture-hint" role="status" aria-live="polite">
              <span>{uiContent.map.cooperativeGestures.mobile}</span>
            </div>
          )}

          {engaged && mobileLayout && (
            <>
              <button
                type="button"
                className="sf-legend-toggle"
                aria-expanded={legendOpen}
                aria-label={uiContent.map.legend}
                onClick={() => setLegendOpen(true)}
              >
                <span className="sf-legend-toggle-icon" aria-hidden="true">i</span>
                <span>{uiContent.map.legend}</span>
              </button>
              {legendOpen && (
                <div
                  className="sf-legend-overlay"
                  onClick={() => setLegendOpen(false)}
                >
                  <div
                    className="sf-scene-legend sf-scene-legend--mobile"
                    role="dialog"
                    aria-modal="true"
                    aria-label={shadowScene.legend.title}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="sf-legend-close"
                      aria-label={uiContent.actions.close}
                      onClick={() => setLegendOpen(false)}
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                    {legendContent}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="sf-scene-flow">
          {mobileLayout ? (
            <div ref={mobileTrackRef} className="sf-mobile-track" aria-hidden="true">
              {stages.map((stage, index) => (
                <div
                  key={stage.id}
                  className={`sf-mobile-beat${index === stages.length - 1 ? " sf-mobile-beat--closing" : ""}`}
                  data-mobile-step={index}
                />
              ))}
              <div className="sf-mobile-track-tail" />
            </div>
          ) : (
            <>
              <div ref={holdRef} className="sf-sequence-hold" aria-hidden="true" />
              <div className="sf-scene-buffer" aria-hidden="true" />
            </>
          )}
        </div>
      </section>

      <div className="sf-aftermath">
        <div className="sf-aftermath-inner">
          <p className="sf-final-pivot">{shadowFinal.pivot}</p>
          <p className="sf-final">{shadowFinal.body}</p>
        </div>
      </div>

      <div className="sf-handoff" aria-hidden="true" />

      <div className="sf-numbers">
        <div className="sf-numbers-inner">
          {values && <ShadowTable values={values} table={shadowTable} />}
        </div>
        <p className="sf-chapter-handoff">{shadowTable.handoff}</p>
        <ScrollCue variant="light" loop className="sf-chapter-cue" />
      </div>
    </section>
  );
}

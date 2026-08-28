import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AnimatePresence,
  motion,
  useAnimationControls,
  useReducedMotion,
} from "framer-motion";
import { PLAN_ANCHORS, PLAN_H, PLAN_W, cityPlanSvg } from "../../data/cityPlan";
import {
  planAnnotationSpecs,
  planBeatSpecs,
  planLegendSpecs,
  planMobileCamera,
  planMobileCameraSettings,
  planView,
} from "../../data/cityPlanScene";
import { planVignetteMeta, planVignettes } from "../../data/planVignettes";
import { CopySegments } from "./CopySegments";
import { editorialLinks, useContent } from "../../content";
import { assetUrl } from "../../lib/assetUrl";
import { cityPlanMobileRasters } from "../../generated/cityPlanMobileRasters";
import {
  debugPerf,
  logPerformanceEvent,
  logPerformanceSnapshot,
  updateMemoryDebugState,
} from "../../lib/mapPerformance";
import { runtimeProfile } from "../../lib/runtimeProfile";
import { onIOSHeavyOffscreenRelease } from "../../lib/iosMemoryLifecycle";

// Stable objects stop React reinjecting SVG innerHTML and erasing animation classes.
const PLAN_HTML = { __html: cityPlanSvg };
const VIGNETTE_HTML = Object.fromEntries(
  Object.entries(planVignettes).map(([key, markup]) => [
    key,
    { __html: markup },
  ]),
);

const READING_LINE = 0.56;
const CITY_BUILD_RASTER_TEST =
  typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("cityBuildRasterTest")
    : null;
const CITY_BUILD_RASTER_DIAGNOSTIC_MODE =
  CITY_BUILD_RASTER_TEST === "base" ||
  CITY_BUILD_RASTER_TEST === "overlays" ||
  CITY_BUILD_RASTER_TEST === "single"
    ? CITY_BUILD_RASTER_TEST
    : "normal";
const CITY_BUILD_RASTER_DIAGNOSTIC_ACTIVE =
  CITY_BUILD_RASTER_DIAGNOSTIC_MODE !== "normal";
const CITY_PLAN_VIGNETTES_ENABLED =
  !CITY_BUILD_RASTER_DIAGNOSTIC_ACTIVE;

// Coupled to generated vignette steps and their CSS draw duration.
const VIGNETTE_STEP_MS = 420;
const VIGNETTE_ENTER_MS = 720;
const VIGNETTE_FIRST_STEP_MS = 620;
const MAP_HANDOFF_MS = 320;
// Must match the Framer Motion exit duration used for the vignette.
const VIGNETTE_EXIT_MS = 720;

const LINK_R = 30;
const MOBILE_CAMERA_THEN_REVEAL_BEATS = new Set([6]);

const MOBILE_ASSET_ROOT = assetUrl("/assets/cityplan-mobile");
const mobileRasterStyle = ({ left, top, width, height }) => ({
  left: `${left}px`,
  top: `${top}px`,
  right: "auto",
  bottom: "auto",
  width: `${width}px`,
  height: `${height}px`,
});
const MOBILE_PLAN_BASE_ASSET = `${MOBILE_ASSET_ROOT}/${cityPlanMobileRasters.base.file}`;
const MOBILE_PLAN_BASE_STYLE = mobileRasterStyle(
  cityPlanMobileRasters.base.style,
);
const MOBILE_PLAN_RASTERS = new Map(
  cityPlanMobileRasters.layers.map((layer) => [layer.name, layer]),
);
const MOBILE_PLAN_LAYER_SPECS = [
  { name: "parking-state", from: 0, until: 2 },
  { name: "initial-sites", from: 0, until: 3 },
  { name: "gap-emphasis", from: 1, until: 2 },
  { name: "relief-sites", from: 1, until: 3 },
  { name: "first-refuge-accent", from: 2, until: 3 },
  { name: "first-refuge", from: 2, until: null },
  { name: "extra-refuges-accent", from: 3, until: 4 },
  { name: "extra-refuges", from: 3, until: null },
  { name: "corridor-network", from: 4, until: null },
  { name: "porticoes", from: 5, until: null },
  { name: "final-network", from: 6, until: null },
].map((layer) => ({
  ...layer,
  src: `${MOBILE_ASSET_ROOT}/${MOBILE_PLAN_RASTERS.get(layer.name).file}`,
  style: mobileRasterStyle(MOBILE_PLAN_RASTERS.get(layer.name).style),
}));
const MOBILE_PLAN_LAYERS_BY_NAME = new Map(
  MOBILE_PLAN_LAYER_SPECS.map((layer) => [layer.name, layer]),
);
// One existing, semantically representative raster for each narrative beat.
const MOBILE_PLAN_SINGLE_RASTER_NAMES = [
  "base",
  "gap-emphasis",
  "first-refuge",
  "extra-refuges",
  "corridor-network",
  "porticoes",
  "final-network",
];
const MOBILE_VIGNETTE_LAYER_SPECS = {
  costruire: [
    { name: "context", kind: "context", delay: 0 },
    { name: "parking", kind: "before", delay: 0 },
    { name: "ground-and-green", kind: "build", delay: 520 },
    { name: "water", kind: "build", delay: 820 },
    { name: "life", kind: "build", delay: 1080 },
  ],
  corridoio: [
    { name: "context", kind: "context", delay: 0 },
    { name: "existing-shadow", kind: "before", delay: 0 },
    { name: "structures", kind: "build", delay: 280 },
    { name: "green", kind: "build", delay: 560 },
    { name: "shade", kind: "build", delay: 860 },
    { name: "life", kind: "build", delay: 1110 },
  ],
  portico: [
    { name: "context", kind: "context", delay: 0 },
    { name: "building", kind: "build", delay: 240 },
    { name: "arcades", kind: "build", delay: 520 },
    { name: "street", kind: "build", delay: 820 },
    { name: "life", kind: "build", delay: 1080 },
  ],
};
const MOBILE_VIGNETTE_ASSETS = Object.fromEntries(
  Object.entries(MOBILE_VIGNETTE_LAYER_SPECS).map(([name, layers]) => [
    name,
    layers.map((layer) => ({
      ...layer,
      src: `${MOBILE_ASSET_ROOT}/cityplan-vignette-${name}-${layer.name}.svg`,
    })),
  ]),
);
const MOBILE_IMAGE_DECODE_CACHE = new Map();

function decodeMobileImage(src) {
  if (typeof Image === "undefined") return Promise.resolve();
  if (MOBILE_IMAGE_DECODE_CACHE.has(src)) {
    return MOBILE_IMAGE_DECODE_CACHE.get(src);
  }

  const promise = new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.fetchPriority = "high";
    const clearHandlers = () => {
      image.onload = null;
      image.onerror = null;
    };
    image.onload = () => {
      clearHandlers();
      if (typeof image.decode !== "function") {
        resolve();
        return;
      }
      image.decode().then(resolve, resolve);
    };
    image.onerror = () => {
      clearHandlers();
      reject(new Error(`Unable to decode ${src}`));
    };
    image.src = src;
  });
  const cachedPromise = promise.catch((error) => {
    MOBILE_IMAGE_DECODE_CACHE.delete(src);
    throw error;
  });
  MOBILE_IMAGE_DECODE_CACHE.set(src, cachedPromise);
  return cachedPromise;
}

function mobilePlanLayersForBeat(beat) {
  return MOBILE_PLAN_LAYER_SPECS.filter(
    ({ from, until }) => beat >= from && (until == null || beat < until),
  );
}

function mobileSingleRasterForBeat(beat) {
  const name = MOBILE_PLAN_SINGLE_RASTER_NAMES[beat] ?? "base";
  if (name === "base") {
    return {
      name,
      src: MOBILE_PLAN_BASE_ASSET,
      style: MOBILE_PLAN_BASE_STYLE,
    };
  }
  return MOBILE_PLAN_LAYERS_BY_NAME.get(name);
}

function mobileRasterAssetsForBeat(beat) {
  switch (CITY_BUILD_RASTER_DIAGNOSTIC_MODE) {
    case "base":
      return [MOBILE_PLAN_BASE_ASSET];
    case "overlays":
      return mobilePlanLayersForBeat(beat).map(({ src }) => src);
    case "single":
      return [mobileSingleRasterForBeat(beat)?.src];
    default:
      return [
        MOBILE_PLAN_BASE_ASSET,
        ...mobilePlanLayersForBeat(beat).map(({ src }) => src),
      ];
  }
}

function mobileAssetsForBeat(beat) {
  const assets = mobileRasterAssetsForBeat(beat);
  if (CITY_PLAN_VIGNETTES_ENABLED) {
    const name = planBeatSpecs[beat]?.vignette;
    const vignetteAssets = name ? MOBILE_VIGNETTE_ASSETS[name] : null;
    if (vignetteAssets) assets.push(...vignetteAssets.map(({ src }) => src));
  }
  return [...new Set(assets.filter(Boolean))];
}

function decodeMobileBeatAssets(beat) {
  return Promise.all(mobileAssetsForBeat(beat).map(decodeMobileImage));
}

const VIGNETTE_PLACE = {
  costruire: "top",
  corridoio: "top",
  portico: "bottom",
};
const COPY_SIDES = ["left", "right"];
const COPY_BLEND_VH = 0.26;
const MOBILE_VIGNETTE_CONFIG = Object.fromEntries(
  planBeatSpecs
    .map((spec, beat) => ({ spec, beat }))
    .filter(({ spec }) => spec.vignette)
    .map(({ spec, beat }) => [
      spec.vignette,
      {
        beat,
        place: VIGNETTE_PLACE[spec.vignette] ?? "top",
        side: spec.side === "left" ? "right" : "left",
      },
    ]),
);

const clamp01 = (value) => Math.min(1, Math.max(0, value));

function physicalBeatProgress(y, marks, beat) {
  const beatStart = beat === 0 ? marks.start : marks[beat - 1];
  const beatEnd = marks[beat] ?? marks.end;
  if (!Number.isFinite(beatStart) || !Number.isFinite(beatEnd)) return 0;
  return clamp01((y - beatStart) / Math.max(1, beatEnd - beatStart));
}

function formatLocalStepLabel(template, current, total) {
  return (template ?? "{current} / {total}")
    .replaceAll("{current}", String(current))
    .replaceAll("{total}", String(total));
}
const lerp = (from, to, amount) => from + (to - from) * amount;
const smoothstep = (value) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

const scrollWindow = (progress, from, to) =>
  smoothstep((progress - from) / Math.max(0.0001, to - from));

function mobileLayerProgressForBeat(index, localProgress, reduceMotion) {
  const progress = reduceMotion ? 1 : localProgress;
  return {
    gap:
      index < 1 ? 0
      : index === 1 ? scrollWindow(progress, 0.1, 0.58)
      : index === 2 ? 1 - scrollWindow(progress, 0.24, 0.58)
      : 0,
    reliefSites:
      index < 1 ? 0
      : index === 1 ? scrollWindow(progress, 0.18, 0.7)
      : index === 2 ? 1
      : 0,
    parking:
      index < 2 ? 1
      : index === 2 ? 1 - scrollWindow(progress, 0.24, 0.58)
      : 0,
    firstRefuge:
      index < 2 ? 0
      : index === 2 ? scrollWindow(progress, 0.4, 0.72)
      : 1,
    extraRefuges:
      index < 3 ? 0
      : index === 3 ? scrollWindow(progress, 0.36, 0.72)
      : 1,
  };
}

function mixCamera(from, to, amount) {
  return {
    at: [lerp(from.at[0], to.at[0], amount), lerp(from.at[1], to.at[1], amount)],
    units: lerp(from.units, to.units, amount),
    screen: [
      lerp(from.screen[0], to.screen[0], amount),
      lerp(from.screen[1], to.screen[1], amount),
    ],
  };
}

function sampleCameraVariant(variant, progress) {
  if (!variant.path) return variant;
  const path = variant.path;
  const t = clamp01(progress);
  const nextIndex = path.findIndex((keyframe) => keyframe.t >= t);
  if (nextIndex <= 0) return path[0];
  if (nextIndex < 0) return path[path.length - 1];
  const from = path[nextIndex - 1];
  const to = path[nextIndex];
  const span = Math.max(0.0001, to.t - from.t);
  return mixCamera(from, to, smoothstep((t - from.t) / span));
}

function sampleMobileCamera(index, progress, viewportWidth) {
  const spec = planMobileCamera[index];
  const phone = sampleCameraVariant(spec.phone, progress);
  const tablet = sampleCameraVariant(spec.tablet, progress);
  const responsive = clamp01(
    (viewportWidth - planMobileCameraSettings.phoneWidth) /
      (planMobileCameraSettings.tabletWidth - planMobileCameraSettings.phoneWidth),
  );
  return mixCamera(phone, tablet, smoothstep(responsive));
}

function cameraForBeat(index, localProgress, viewportWidth, reduceMotion) {
  if (reduceMotion) return sampleMobileCamera(index, 1, viewportWidth);
  const entry =
    index === 0
      ? 0
      : (planMobileCamera[index].entryFraction ??
        planMobileCameraSettings.entryFraction);
  if (entry && localProgress < entry) {
    const previous = sampleMobileCamera(index - 1, 1, viewportWidth);
    const current = sampleMobileCamera(index, 0, viewportWidth);
    return mixCamera(previous, current, smoothstep(localProgress / entry));
  }
  return sampleMobileCamera(
    index,
    entry ? clamp01((localProgress - entry) / (1 - entry)) : localProgress,
    viewportWidth,
  );
}

function updateLinkSvg(node, geometry) {
  if (!node || !geometry) return;
  node.querySelectorAll(".plan-link-lead").forEach((line) => {
    line.setAttribute("x1", geometry.x1);
    line.setAttribute("y1", geometry.y1);
    line.setAttribute("x2", geometry.x2);
    line.setAttribute("y2", geometry.y2);
    line.style.display = geometry.lead ? "" : "none";
  });
  node.querySelectorAll(".plan-link-ring").forEach((circle) => {
    circle.setAttribute("cx", geometry.ax);
    circle.setAttribute("cy", geometry.ay);
  });
  node.querySelectorAll(".plan-link-ticks").forEach((path) => {
    path.setAttribute(
      "d",
      [
        `M ${geometry.ax - LINK_R - 8} ${geometry.ay} h 6`,
        `M ${geometry.ax + LINK_R + 2} ${geometry.ay} h 6`,
        `M ${geometry.ax} ${geometry.ay - LINK_R - 8} v 6`,
        `M ${geometry.ax} ${geometry.ay + LINK_R + 2} v 6`,
      ].join(" "),
    );
  });
  node.querySelectorAll(".plan-link-dot").forEach((circle) => {
    circle.setAttribute("cx", geometry.ax);
    circle.setAttribute("cy", geometry.ay);
  });
}

function collectVignetteItems(node) {
  return Array.from(node?.querySelectorAll(".pv-i") ?? []).map((el) => {
    const at = Number(el.dataset.step || 0);
    return {
      el,
      at,
      goneAt: Number(el.dataset.goneStep || at + 2),
      goes: el.classList.contains("pv-goes"),
    };
  });
}

function paintVignetteStep(items, step) {
  items.forEach(({ el, at, goneAt, goes }) => {
    el.classList.toggle("is-on", step >= at);
    el.classList.toggle("is-gone", goes && step >= goneAt);
  });
}

function MobilePersistentPlan({
  activeBeat,
  requestedBeat,
  fallbackActive,
  onAssetSettled,
  rasterDiagnosticMode,
}) {
  const singleRaster =
    rasterDiagnosticMode === "single"
      ? mobileSingleRasterForBeat(activeBeat)
      : null;
  const layersEnabled =
    rasterDiagnosticMode === "normal" || rasterDiagnosticMode === "overlays";
  const activeLayers = layersEnabled ? mobilePlanLayersForBeat(activeBeat) : [];
  const requestedLayers = layersEnabled
    ? mobilePlanLayersForBeat(requestedBeat)
    : [];
  // Beat 2 deliberately retains the two outgoing parking/gap deltas just for
  // its cinematic replacement animation. This is not speculative preloading.
  const exitLayers = layersEnabled && activeBeat === 2
    ? mobilePlanLayersForBeat(1)
    : [];
  const renderedLayerNames = new Set(
    [...activeLayers, ...requestedLayers, ...exitLayers].map(
      ({ name }) => name,
    ),
  );
  const renderedLayers = MOBILE_PLAN_LAYER_SPECS.filter(({ name }) =>
    renderedLayerNames.has(name),
  );
  const activeLayerNames = new Set(activeLayers.map(({ name }) => name));
  const hasPlainBackground =
    rasterDiagnosticMode === "overlays" || rasterDiagnosticMode === "single";

  if (rasterDiagnosticMode === "single") {
    const isBase = singleRaster.name === "base";
    return (
      <figure
        className="plan-figure plan-figure--mobile-images plan-figure--raster-plain"
        aria-hidden="true"
      >
        <img
          className={`plan-mobile-map-state ${
            isBase ? "plan-mobile-map-base" : "plan-mobile-map-layer"
          } is-active`}
          src={singleRaster.src}
          style={singleRaster.style}
          alt=""
          decoding="async"
          fetchPriority="high"
          draggable="false"
          data-mobile-map-layer={isBase ? undefined : singleRaster.name}
          onLoad={onAssetSettled}
          onError={onAssetSettled}
        />
      </figure>
    );
  }

  return (
    <figure
      className={`plan-figure plan-figure--mobile-images${
        hasPlainBackground ? " plan-figure--raster-plain" : ""
      }`}
      aria-hidden="true"
    >
      {rasterDiagnosticMode !== "overlays" ? (
        <img
          className="plan-mobile-map-state plan-mobile-map-base is-active"
          src={MOBILE_PLAN_BASE_ASSET}
          style={MOBILE_PLAN_BASE_STYLE}
          alt=""
          decoding="async"
          fetchPriority="high"
          draggable="false"
          onLoad={onAssetSettled}
          onError={onAssetSettled}
        />
      ) : null}
      {renderedLayers.map((layer) => {
        const isActive = !fallbackActive && activeLayerNames.has(layer.name);
        return (
          <img
            key={layer.src}
            className={`plan-mobile-map-state plan-mobile-map-layer${
              isActive ? " is-active" : ""
            }`}
            src={layer.src}
            style={layer.style}
            alt=""
            decoding="async"
            fetchPriority="high"
            draggable="false"
            data-mobile-map-layer={layer.name}
            onLoad={onAssetSettled}
            onError={onAssetSettled}
          />
        );
      })}
    </figure>
  );
}

function MobilePersistentVignettes({
  activeName,
  requestedName,
  onAssetSettled,
}) {
  return Object.keys(VIGNETTE_HTML).map((name) => {
    const config = MOBILE_VIGNETTE_CONFIG[name];
    const isCurrent = name === activeName;
    const shouldLoad = isCurrent || name === requestedName;
    const layers = MOBILE_VIGNETTE_ASSETS[name];
    return (
      <div
        key={name}
        className={`plan-vignette plan-vignette--mobile plan-vignette--${config.place} plan-vignette--${config.side}${
          isCurrent ? " is-active" : ""
        }`}
        style={{ "--ratio": planVignetteMeta[name].ratio }}
        data-mobile-vignette-active={String(isCurrent)}
        data-vignette={name}
        aria-hidden="true"
      >
        <div className="plan-vignette-art">
          {shouldLoad ? layers.map((layer) => (
            <img
              key={layer.src}
              className="plan-vignette-image plan-vignette-layer"
              src={layer.src}
              alt=""
              decoding="async"
              fetchPriority="high"
              draggable="false"
              data-vignette-layer={layer.name}
              data-vignette-layer-kind={layer.kind}
              style={{ "--layer-delay": `${layer.delay}ms` }}
              onLoad={onAssetSettled}
              onError={onAssetSettled}
            />
          )) : null}
        </div>
      </div>
    );
  });
}

function MobilePersistentLink({ name, ready, linkRef }) {
  return (
    <svg
      ref={linkRef}
      className={`plan-link plan-link--mobile${name ? " is-visible" : ""}${
        ready ? " is-ready" : ""
      }`}
      data-vignette={name ?? undefined}
      aria-hidden="true"
    >
      {["halo", "ink"].map((linkLayer) => (
        <g key={linkLayer} className={`plan-link-${linkLayer}`}>
          <line
            className="plan-link-lead"
            x1="0"
            y1="0"
            x2="0"
            y2="0"
            pathLength="1"
          />
          <circle
            className="plan-link-ring"
            cx="0"
            cy="0"
            r={LINK_R}
            pathLength="1"
          />
          <path className="plan-link-ticks" d="" pathLength="1" />
        </g>
      ))}
      <circle className="plan-link-dot" cx="0" cy="0" r="2.8" />
    </svg>
  );
}

export function CityPlanScene() {
  const { content, uiContent } = useContent();
  const cityPlanContent = content.climateRelief.cityPlan;
  const {
    planAnnotations,
    planBeats,
    planContext,
    planFigureLabel,
    planLegend,
    planLegendLabel,
    planSceneLabel,
    vignetteDescriptions,
  } = useMemo(
    () => ({
      planSceneLabel: cityPlanContent.scene.ariaLabel,
      planFigureLabel: cityPlanContent.scene.figureAriaLabel,
      planContext: cityPlanContent.scene.context,
      planLegendLabel: cityPlanContent.legend.label,
      planBeats: planBeatSpecs.map((spec, index) => ({
        ...spec,
        ...cityPlanContent.beats[index],
        body: cityPlanContent.beats[index].body.map((segment) =>
          segment.linkId === "shadow-lines-project"
            ? { ...segment, link: editorialLinks.climateRelief.shadowLinesProject }
            : segment,
        ),
      })),
      planAnnotations: planAnnotationSpecs.map((spec, index) => ({
        ...spec,
        ...cityPlanContent.annotations[index],
      })),
      planLegend: planLegendSpecs.map((spec, index) => ({
        ...spec,
        ...cityPlanContent.legend.items[index],
      })),
      vignetteDescriptions: Object.fromEntries(
        cityPlanContent.vignetteDescriptions.map((item) => [item.id, item.text]),
      ),
    }),
    [cityPlanContent],
  );
  const reduceMotion = useReducedMotion();
  const vignetteControls = useAnimationControls();
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const viewRef = useRef(null);
  const camRef = useRef(null);
  const figRef = useRef(null);
  const bandRef = useRef(null);
  const linkSvgRef = useRef(null);
  const linkGeometryRef = useRef(null);
  const cameraFrameRef = useRef(null);
  const syncOverlayGeometryRef = useRef(null);
  const syncMobileOverlayGeometryRef = useRef(null);
  const syncScrollStateRef = useRef(null);
  const mobileNearbyRef = useRef(true);
  const mobileVignetteNodesRef = useRef({});
  const mobileOverlayLayoutRef = useRef(null);
  const mobilePrewarmedBeatRef = useRef(null);
  const mobilePreparedGeometryRef = useRef(null);
  const mobileDecodedBeatsRef = useRef(new Set());
  const mobileAssetSettleFrameRef = useRef(null);
  const mobileGenerationRef = useRef(0);
  const mobileRequestedBeatRef = useRef(0);
  const mobileCommittedBeatRef = useRef(0);
  const requestMobileBeatRef = useRef(null);
  const viewportMetricsRef = useRef(null);
  const mapBeatStatesRef = useRef(null);
  const mobilePaintedMapBeatRef = useRef(null);
  const vignetteNodeRef = useRef(null);
  const holdsRef = useRef([]);
  const marksRef = useRef([]);
  const copyItemsRef = useRef([]);
  const itemsRef = useRef(null);
  const previousBeatRef = useRef(0);
  const completedVignetteBeatsRef = useRef(new Set());
  const enteredVignetteMountRef = useRef(-1);
  const performanceBeatRef = useRef({ requestedBeat: 0, committedBeat: 0 });

  const [entered, setEntered] = useState(false);
  const [mobileCameraActive, setMobileCameraActive] = useState(
    () =>
      typeof window !== "undefined" &&
      window.innerWidth <= planMobileCameraSettings.maxWidth,
  );
  const [scrollBeat, setScrollBeat] = useState(0);
  const [mapBeat, setMapBeat] = useState(0);
  const [mobileScene, setMobileScene] = useState({
    requestedBeat: 0,
    preparedBeat: 0,
    committedBeat: 0,
    generation: 0,
    preparedGeneration: 0,
    committedGeneration: 0,
  });
  const [mobileVignettesMounted, setMobileVignettesMounted] = useState(false);
  const [mobileVignettesReady, setMobileVignettesReady] = useState(false);
  const [mobileAssetVersion, setMobileAssetVersion] = useState(0);
  const [mobileReadyBeats, setMobileReadyBeats] = useState(() => new Set());
  const [mobileAssetFailure, setMobileAssetFailure] = useState(false);
  const [mobileOverlayLayoutVersion, setMobileOverlayLayoutVersion] = useState(0);
  const [vignetteProgress, setVignetteProgress] = useState({
    beat: -1,
    mount: -1,
    step: 0,
  });
  const [vignetteMount, setVignetteMount] = useState(0);
  const [vignetteNode, setVignetteNode] = useState(null);
  const [link, setLink] = useState(null);

  useLayoutEffect(() => {
    if (!mobileCameraActive) return;
    const rasterCount =
      rootRef.current?.querySelectorAll("img[src], image[href]").length ?? 0;
    updateMemoryDebugState({
      cityPlanRasterCount: rasterCount,
      heavyScene: {
        name: "CityPlan rasters",
        mounted: mobileVignettesMounted && rasterCount > 0,
      },
    });
  }, [mobileCameraActive, mobileVignettesMounted, mobileScene.committedBeat]);
  const beat = mobileCameraActive ? mobileScene.committedBeat : scrollBeat;
  const requestedBeat = mobileCameraActive
    ? mobileScene.requestedBeat
    : scrollBeat;
  const side = planBeats[beat]?.side === "right" ? "right" : "left";
  const vignetteName = planBeats[beat]?.vignette ?? null;
  const place = VIGNETTE_PLACE[vignetteName] ?? "top";
  const vignetteSide = side === "left" ? "right" : "left";
  const vstep =
    !mobileCameraActive &&
    vignetteProgress.beat === beat &&
    vignetteProgress.mount === vignetteMount
      ? vignetteProgress.step
      : 0;
  const vignetteLive = Boolean(vignetteName) && entered;
  const mobileVisualReady = mobileReadyBeats.has(beat);
  const vignetteComplete =
    vignetteName &&
    (mobileCameraActive
      ? true
      : vstep >= (planVignetteMeta[vignetteName]?.steps ?? 1) - 1);
  const currentLink =
    !mobileCameraActive && link?.name === vignetteName ? link : null;
  const synchronizedMapBeat = mobileCameraActive ? beat : mapBeat;
  const activeAnnotations = planAnnotations.filter(
    (note) =>
      (synchronizedMapBeat >= note.from && synchronizedMapBeat <= note.until) ||
      (mobileCameraActive && note.id === "corridor" && synchronizedMapBeat === 5),
  );

  useEffect(() => {
    if (!mobileCameraActive) return;
    const activeLayerCount = mobilePlanLayersForBeat(beat).length;
    const requestedLayerCount = new Set([
      ...mobilePlanLayersForBeat(beat),
      ...mobilePlanLayersForBeat(requestedBeat),
      ...(beat === 2 ? mobilePlanLayersForBeat(1) : []),
    ].map(({ name }) => name)).size;
    const mountedRasterLayerCount =
      !mobileVignettesMounted ? 0
      : CITY_BUILD_RASTER_DIAGNOSTIC_MODE === "base" ||
          CITY_BUILD_RASTER_DIAGNOSTIC_MODE === "single" ? 1
      : (CITY_BUILD_RASTER_DIAGNOSTIC_MODE === "normal" ? 1 : 0) +
        requestedLayerCount;
    const visibleRasterLayerCount =
      !mobileVignettesMounted ? 0
      : CITY_BUILD_RASTER_DIAGNOSTIC_MODE === "base" ||
          CITY_BUILD_RASTER_DIAGNOSTIC_MODE === "single" ? 1
      : (CITY_BUILD_RASTER_DIAGNOSTIC_MODE === "normal" ? 1 : 0) +
        activeLayerCount;
    logPerformanceEvent("cityplan:beat", {
      section: "CityPlan",
      cityPlanBeat: beat,
      requestedBeat,
      mountedRasterLayerCount,
      visibleRasterLayerCount,
    });

    const previous = performanceBeatRef.current;
    const requestedChanged = requestedBeat !== previous.requestedBeat;
    const committedChanged = beat !== previous.committedBeat;
    performanceBeatRef.current = {
      requestedBeat,
      committedBeat: beat,
    };
    if (!requestedChanged && !committedChanged) return undefined;

    const reason =
      requestedChanged && Math.abs(requestedBeat - previous.requestedBeat) > 1
        ? "cityplan-fast-beat-skip"
        : "cityplan-beat-change";
    const frame = requestAnimationFrame(() => {
      logPerformanceSnapshot(reason, {
        scene: "cityplan",
        storyBeat: beat,
        requestedBeat,
        cityBuildRasterDiagnosticMode: CITY_BUILD_RASTER_DIAGNOSTIC_MODE,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [
    beat,
    mobileCameraActive,
    mobileVignettesMounted,
    requestedBeat,
  ]);

  useEffect(() => {
    const root = rootRef.current;
    if (!debugPerf || !mobileCameraActive || !root) return undefined;

    let hasEntered = false;
    let visible = false;
    const observer = new IntersectionObserver(([entry]) => {
      const nextVisible = entry.isIntersecting;
      if (nextVisible === visible) return;
      visible = nextVisible;
      if (nextVisible) hasEntered = true;
      if (!nextVisible && !hasEntered) return;
      logPerformanceSnapshot(
        nextVisible ? "cityplan-enter" : "cityplan-exit",
        {
          scene: "cityplan",
          storyBeat: mobileCommittedBeatRef.current,
          requestedBeat: mobileRequestedBeatRef.current,
          cityBuildRasterDiagnosticMode: CITY_BUILD_RASTER_DIAGNOSTIC_MODE,
        },
      );
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [mobileCameraActive]);

  useEffect(
    () =>
      onIOSHeavyOffscreenRelease((reason) => {
        const rect = rootRef.current?.getBoundingClientRect();
        if (!rect || (rect.bottom > 0 && rect.top < window.innerHeight)) return;
        setMobileVignettesMounted((mounted) => {
          if (!mounted) return mounted;
          logPerformanceEvent("cityplan:rasters-release", {
            section: "CityPlan",
            cityPlanBeat: mobileCommittedBeatRef.current,
            reason,
          });
          return false;
        });
      }),
    [],
  );

  const measureMobileOverlayLayout = useCallback(() => {
    const band = bandRef.current;
    const nodes = mobileVignetteNodesRef.current;
    if (!band || Object.keys(nodes).length !== Object.keys(VIGNETTE_HTML).length) {
      return { ready: false, changed: false };
    }

    // All reads stay together; continuous camera frames use only this cache.
    const bandRect = band.getBoundingClientRect();
    const boxes = {};
    for (const name of Object.keys(VIGNETTE_HTML)) {
      const node = nodes[name];
      const rect = node?.getBoundingClientRect();
      if (!rect || !rect.width || !rect.height) {
        return { ready: false, changed: false };
      }
      boxes[name] = {
        vx: rect.left + rect.width / 2 - bandRect.left,
        vy: rect.top + rect.height / 2 - bandRect.top,
        width: rect.width,
        height: rect.height,
      };
    }

    const next = { bandWidth: bandRect.width, boxes };
    const previous = mobileOverlayLayoutRef.current;
    const changed =
      !previous ||
      previous.bandWidth !== next.bandWidth ||
      Object.keys(boxes).some((name) =>
        ["vx", "vy", "width", "height"].some(
          (key) => previous.boxes[name]?.[key] !== boxes[name][key],
        ),
      );
    mobileOverlayLayoutRef.current = next;
    return { ready: true, changed };
  }, []);

  const geometryForMobileVignette = useCallback((name, frame) => {
    const box = mobileOverlayLayoutRef.current?.boxes[name];
    const anchor = PLAN_ANCHORS[planVignetteMeta[name]?.anchor];
    if (!box || !anchor || !frame) return null;

    const ax = frame.bandWidth / 2 + frame.sx + (anchor[0] - frame.cx) * frame.zc;
    const ay = frame.stageHeight / 2 + frame.sy + (anchor[1] - frame.cy) * frame.zc;
    const dx = ax - box.vx;
    const dy = ay - box.vy;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const edge = Math.min(
      Math.abs(ux) > 1e-3 ? box.width / 2 / Math.abs(ux) : 1e9,
      Math.abs(uy) > 1e-3 ? box.height / 2 / Math.abs(uy) : 1e9,
    );
    return {
      name,
      ax,
      ay,
      fx: Math.round(dx),
      fy: Math.round(dy),
      x1: box.vx + ux * (edge + 10),
      y1: box.vy + uy * (edge + 10),
      x2: ax - ux * (LINK_R + 6),
      y2: ay - uy * (LINK_R + 6),
      lead: len > edge + LINK_R + 26,
    };
  }, []);

  const syncMobileOverlayGeometry = useCallback(
    (activeBeat, frameOverride = null) => {
      const band = bandRef.current;
      const frame = frameOverride ?? cameraFrameRef.current;
      if (!band || !frame) return;

      planAnnotationSpecs.forEach((note) => {
        const x =
          frame.bandWidth / 2 + frame.sx + (note.point[0] - frame.cx) * frame.zc;
        const y =
          frame.stageHeight / 2 + frame.sy + (note.point[1] - frame.cy) * frame.zc;
        band.style.setProperty(`--annotation-${note.id}-x`, `${x.toFixed(2)}px`);
        band.style.setProperty(`--annotation-${note.id}-y`, `${y.toFixed(2)}px`);
      });

      if (!CITY_PLAN_VIGNETTES_ENABLED) return;
      const name = planBeatSpecs[activeBeat]?.vignette;
      if (!name) return;
      const geometry = geometryForMobileVignette(name, frame);
      if (geometry) updateLinkSvg(linkSvgRef.current, geometry);
    },
    [geometryForMobileVignette],
  );

  const syncOverlayGeometry = useCallback(
    (commitLink = false, frameOverride = null) => {
      if (mobileCameraActive) return;
      const band = bandRef.current;
      const box = vignetteNodeRef.current;
      const frame = frameOverride ?? cameraFrameRef.current;
      if (!band || !frame) return;

      const annotationPositions = planAnnotationSpecs.map((note) => ({
        id: note.id,
        x: frame.bandWidth / 2 + frame.sx + (note.point[0] - frame.cx) * frame.zc,
        y: frame.stageHeight / 2 + frame.sy + (note.point[1] - frame.cy) * frame.zc,
      }));

      let geometry = null;
      if (
        CITY_PLAN_VIGNETTES_ENABLED &&
        vignetteName &&
        box &&
        box.dataset.vignette === vignetteName
      ) {
        const anchor = PLAN_ANCHORS[planVignetteMeta[vignetteName]?.anchor];
        if (anchor) {
          // Keep all layout reads before CSS/SVG writes in this frame.
          const br = band.getBoundingClientRect();
          const vr = box.getBoundingClientRect();
          const ax = frame.bandWidth / 2 + frame.sx + (anchor[0] - frame.cx) * frame.zc;
          const ay = frame.stageHeight / 2 + frame.sy + (anchor[1] - frame.cy) * frame.zc;
          const vx = vr.left + vr.width / 2 - br.left;
          const vy = vr.top + vr.height / 2 - br.top;
          const dx = ax - vx;
          const dy = ay - vy;
          const len = Math.hypot(dx, dy) || 1;
          const ux = dx / len;
          const uy = dy / len;
          const edge = Math.min(
            Math.abs(ux) > 1e-3 ? vr.width / 2 / Math.abs(ux) : 1e9,
            Math.abs(uy) > 1e-3 ? vr.height / 2 / Math.abs(uy) : 1e9,
          );
          geometry = {
            name: vignetteName,
            ax,
            ay,
            fx: Math.round(dx),
            fy: Math.round(dy),
            x1: vx + ux * (edge + 10),
            y1: vy + uy * (edge + 10),
            x2: ax - ux * (LINK_R + 6),
            y2: ay - uy * (LINK_R + 6),
            lead: len > edge + LINK_R + 26,
          };
        }
      }

      annotationPositions.forEach(({ id, x, y }) => {
        band.style.setProperty(`--annotation-${id}-x`, `${x.toFixed(2)}px`);
        band.style.setProperty(`--annotation-${id}-y`, `${y.toFixed(2)}px`);
      });

      if (!geometry) return;
      const changedVignette = linkGeometryRef.current?.name !== vignetteName;
      linkGeometryRef.current = geometry;
      if (commitLink || changedVignette) setLink(geometry);
      else updateLinkSvg(linkSvgRef.current, geometry);
    },
    [mobileCameraActive, vignetteName],
  );
  useLayoutEffect(() => {
    syncOverlayGeometryRef.current = syncOverlayGeometry;
    syncMobileOverlayGeometryRef.current = syncMobileOverlayGeometry;
  }, [syncMobileOverlayGeometry, syncOverlayGeometry]);

  useLayoutEffect(() => {
    const planDescription = figRef.current?.querySelector("desc");
    if (planDescription) {
      planDescription.textContent = cityPlanContent.scene.svgDescription;
    }
    if (mobileCameraActive) return;
    if (!CITY_PLAN_VIGNETTES_ENABLED) return;
    if (!vignetteName) return;
    const vignetteDescription = bandRef.current?.querySelector(
      `[data-vignette="${vignetteName}"] .plan-vignette-art desc`,
    );
    if (vignetteDescription) {
      vignetteDescription.textContent = vignetteDescriptions[vignetteName] ?? "";
    }
  }, [
    cityPlanContent.scene.svgDescription,
    mobileCameraActive,
    vignetteDescriptions,
    vignetteMount,
    vignetteName,
  ]);

  useLayoutEffect(() => {
    if (
      !CITY_PLAN_VIGNETTES_ENABLED ||
      !mobileCameraActive ||
      !mobileVignettesMounted
    ) {
      mobileVignetteNodesRef.current = {};
      mobileOverlayLayoutRef.current = null;
      return;
    }

    const band = bandRef.current;
    const nodes = {};
    for (const name of Object.keys(VIGNETTE_HTML)) {
      const node = band?.querySelector(
        `.plan-vignette--mobile[data-vignette="${name}"]`,
      );
      if (!node) {
        return;
      }
      nodes[name] = node;
    }
    mobileVignetteNodesRef.current = nodes;

    const layout = measureMobileOverlayLayout();
    let live = true;
    queueMicrotask(() => {
      if (!live) return;
      setMobileVignettesReady(layout.ready);
      if (layout.changed) {
        setMobileOverlayLayoutVersion((version) => version + 1);
      }
    });
    return () => {
      live = false;
    };
  }, [
    measureMobileOverlayLayout,
    mobileCameraActive,
    mobileVignettesMounted,
  ]);

  const bindVignetteNode = useCallback((node) => {
    if (!node || vignetteNodeRef.current === node) return undefined;
    vignetteNodeRef.current = node;
    setVignetteNode(node);
    node.querySelectorAll(".pv-i").forEach((el) => {
      el.classList.remove("is-on", "is-gone");
    });
    setVignetteMount((current) => current + 1);
    return () => {
      if (vignetteNodeRef.current !== node) return;
      vignetteNodeRef.current = null;
      setVignetteNode(null);
    };
  }, []);

  const prewarmMobileBeat = useCallback(
    (targetBeat) => {
      if (CITY_BUILD_RASTER_DIAGNOSTIC_MODE === "single") {
        mobilePrewarmedBeatRef.current = targetBeat;
        return true;
      }
      if (!mobileDecodedBeatsRef.current.has(targetBeat)) return false;
      const planImages = [
        ...(CITY_BUILD_RASTER_DIAGNOSTIC_MODE !== "overlays"
          ? [camRef.current?.querySelector(".plan-mobile-map-base")]
          : []),
        ...(CITY_BUILD_RASTER_DIAGNOSTIC_MODE !== "base"
          ? mobilePlanLayersForBeat(targetBeat).map(({ name }) =>
              camRef.current?.querySelector(`[data-mobile-map-layer="${name}"]`),
            )
          : []),
      ];
      if (
        planImages.some((image) => !image?.complete || !image.naturalWidth)
      ) {
        return false;
      }

      const name = CITY_PLAN_VIGNETTES_ENABLED
        ? planBeatSpecs[targetBeat]?.vignette
        : null;
      if (!name) {
        mobilePrewarmedBeatRef.current = targetBeat;
        return true;
      }
      if (!mobileVignettesReady) return false;

      const node = mobileVignetteNodesRef.current[name];
      const frame = cameraFrameRef.current;
      const images = Array.from(node?.querySelectorAll(".plan-vignette-image") ?? []);
      if (
        !node?.isConnected ||
        images.length === 0 ||
        images.some((image) => !image.complete || !image.naturalWidth) ||
        !mobileOverlayLayoutRef.current ||
        !frame
      ) {
        return false;
      }

      const geometry = geometryForMobileVignette(name, frame);
      if (!geometry) return false;
      mobilePrewarmedBeatRef.current = targetBeat;
      mobilePreparedGeometryRef.current = { beat: targetBeat, geometry };
      return true;
    },
    [geometryForMobileVignette, mobileVignettesReady],
  );

  const requestMobileBeat = useCallback((nextBeat) => {
    const targetBeat = Math.min(
      planBeatSpecs.length - 1,
      Math.max(0, nextBeat),
    );
    if (mobileRequestedBeatRef.current === targetBeat) return;
    const generation = mobileGenerationRef.current + 1;
    mobileGenerationRef.current = generation;
    mobileRequestedBeatRef.current = targetBeat;
    setMobileScene((current) => ({
      ...current,
      requestedBeat: targetBeat,
      generation,
    }));
  }, []);

  useLayoutEffect(() => {
    requestMobileBeatRef.current = requestMobileBeat;
  }, [requestMobileBeat]);

  const handleMobileAssetSettled = useCallback(() => {
    if (mobileAssetSettleFrameRef.current != null) return;
    mobileAssetSettleFrameRef.current = requestAnimationFrame(() => {
      mobileAssetSettleFrameRef.current = null;
      setMobileAssetVersion((version) => version + 1);
    });
  }, []);

  useEffect(
    () => () => {
      if (mobileAssetSettleFrameRef.current != null) {
        cancelAnimationFrame(mobileAssetSettleFrameRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!mobileCameraActive || !mobileVignettesMounted) return undefined;
    if (CITY_BUILD_RASTER_DIAGNOSTIC_MODE === "single") return undefined;
    const targetBeat = mobileScene.requestedBeat;
    const generation = mobileScene.generation;
    let live = true;

    const markDecoded = (decodedBeat) => {
      mobileDecodedBeatsRef.current.add(decodedBeat);
      setMobileReadyBeats((current) => {
        if (current.has(decodedBeat)) return current;
        const next = new Set(current);
        next.add(decodedBeat);
        return next;
      });
    };

    // Decode only the requested beat. Adjacent beats are neither fetched nor
    // decoded speculatively; the committed visual stays visible until this set
    // of semantic delta assets is ready.
    decodeMobileBeatAssets(targetBeat)
      .then(() => {
        if (!live) return;
        markDecoded(targetBeat);
        if (
          mobileGenerationRef.current === generation &&
          mobileRequestedBeatRef.current === targetBeat
        ) {
          setMobileAssetFailure(false);
          setMobileAssetVersion((version) => version + 1);
        }
      })
      .catch(() => {
        if (
          live &&
          mobileGenerationRef.current === generation &&
          mobileRequestedBeatRef.current === targetBeat
        ) {
          setMobileAssetFailure(true);
        }
      });

    return () => {
      live = false;
    };
  }, [
    mobileCameraActive,
    mobileScene.generation,
    mobileScene.requestedBeat,
    mobileVignettesMounted,
  ]);

  useLayoutEffect(() => {
    if (!mobileCameraActive) return undefined;
    const targetBeat = mobileScene.requestedBeat;
    const generation = mobileScene.generation;
    if (
      mobileScene.preparedBeat === targetBeat &&
      mobileScene.committedBeat === targetBeat
    ) {
      return undefined;
    }

    const name = CITY_PLAN_VIGNETTES_ENABLED
      ? planBeatSpecs[targetBeat]?.vignette
      : null;
    const wasPrewarmed = mobilePrewarmedBeatRef.current === targetBeat;
    if (!prewarmMobileBeat(targetBeat)) return undefined;

    let firstFrame = null;
    let secondFrame = null;
    const commit = () => {
      if (
        mobileGenerationRef.current !== generation ||
        mobileRequestedBeatRef.current !== targetBeat
      ) {
        return;
      }

      let geometry = null;
      if (name) {
        geometry = geometryForMobileVignette(name, cameraFrameRef.current);
        if (!geometry) return;
      }
      mobilePreparedGeometryRef.current = {
        beat: targetBeat,
        generation,
        geometry,
      };
      setMobileScene((current) => {
        if (
          current.generation !== generation ||
          current.requestedBeat !== targetBeat
        ) {
          return current;
        }
        return {
          ...current,
          preparedBeat: targetBeat,
          committedBeat: targetBeat,
          preparedGeneration: generation,
          committedGeneration: generation,
        };
      });
    };

    if (wasPrewarmed || reduceMotion) {
      commit();
    } else {
      // DOM/layout readiness is already established above. Keep the semantic
      // commit on a clean frame without forcing hidden SVGs into compositor layers.
      firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(commit);
      });
    }

    return () => {
      if (firstFrame) cancelAnimationFrame(firstFrame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
    };
  }, [
    geometryForMobileVignette,
    mobileCameraActive,
    mobileAssetVersion,
    mobileOverlayLayoutVersion,
    mobileScene.committedBeat,
    mobileScene.generation,
    mobileScene.preparedBeat,
    mobileScene.requestedBeat,
    prewarmMobileBeat,
    reduceMotion,
  ]);

  useLayoutEffect(() => {
    if (!mobileCameraActive) return;
    mobileCommittedBeatRef.current = mobileScene.committedBeat;
    syncMobileOverlayGeometry(
      mobileScene.committedBeat,
      cameraFrameRef.current,
    );
  }, [
    mobileCameraActive,
    mobileScene.committedBeat,
    syncMobileOverlayGeometry,
  ]);

  useLayoutEffect(() => {
    if (!mobileCameraActive) return;
    const committedProgress = physicalBeatProgress(
      window.scrollY,
      marksRef.current,
      mobileScene.committedBeat,
    );
    rootRef.current?.style.setProperty(
      "--plan-camera-step-progress",
      committedProgress.toFixed(4),
    );
  }, [mobileCameraActive, mobileScene.committedBeat]);

  useEffect(() => {
    if (!entered) return undefined;
    const previousBeat = previousBeatRef.current;
    previousBeatRef.current = beat;
    if (mobileCameraActive) {
      return undefined;
    }
    const name = planBeatSpecs[beat]?.vignette;
    const previousHadVignette = Boolean(planBeatSpecs[previousBeat]?.vignette);
    const previousFinished = completedVignetteBeatsRef.current.has(previousBeat);

    if (name) {
      completedVignetteBeatsRef.current.delete(beat);
      const waitForPreviousExit =
        previousBeat !== beat && previousHadVignette && !previousFinished;
      const id = window.setTimeout(
        () => setMapBeat(Math.max(0, beat - 1)),
        waitForPreviousExit && !reduceMotion && !mobileCameraActive
          ? VIGNETTE_EXIT_MS
          : 0,
      );
      return () => window.clearTimeout(id);
    }

    if (previousBeat !== beat && previousHadVignette && !previousFinished) {
      const id = window.setTimeout(
        () => setMapBeat(beat),
        reduceMotion || mobileCameraActive ? 0 : VIGNETTE_EXIT_MS,
      );
      return () => window.clearTimeout(id);
    }

    const id = window.setTimeout(() => setMapBeat(beat), 0);
    return () => window.clearTimeout(id);
  }, [beat, entered, mobileCameraActive, reduceMotion]);

  useEffect(() => {
    if (
      mobileCameraActive ||
      !entered ||
      !vignetteName ||
      !vignetteComplete
    ) return undefined;
    const completedBeat = beat;
    const id = window.setTimeout(
      () => {
        completedVignetteBeatsRef.current.add(completedBeat);
        setMapBeat(completedBeat);
      },
      reduceMotion ? 0 : MAP_HANDOFF_MS,
    );
    return () => window.clearTimeout(id);
  }, [beat, entered, mobileCameraActive, reduceMotion, vignetteComplete, vignetteName]);

  useEffect(() => {
    const media = window.matchMedia(
      `(max-width: ${planMobileCameraSettings.maxWidth}px)`,
    );
    const updateMode = () => setMobileCameraActive(media.matches);
    updateMode();
    media.addEventListener("change", updateMode);
    return () => media.removeEventListener("change", updateMode);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setEntered(true);
      },
      { rootMargin: "12% 0px" },
    );
    io.observe(root);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    if (!mobileCameraActive || typeof IntersectionObserver !== "function") {
      mobileNearbyRef.current = true;
      root.dataset.mobileNearby = "true";
      syncScrollStateRef.current?.();
      return undefined;
    }

    let syncFrame = null;
    let retentionObserver = null;
    const viewportHeight = window.innerHeight || 768;
    const rect = root.getBoundingClientRect();
    mobileNearbyRef.current =
      rect.top <= viewportHeight * 2 && rect.bottom >= -viewportHeight;
    root.dataset.mobileNearby = String(mobileNearbyRef.current);

    const observer = new IntersectionObserver(
      ([entry]) => {
        const nextNearby = entry.isIntersecting;
        if (nextNearby === mobileNearbyRef.current) return;
        mobileNearbyRef.current = nextNearby;
        if (nextNearby) setMobileVignettesMounted(true);
        root.dataset.mobileNearby = String(nextNearby);
        if (!nextNearby) return;
        if (syncFrame) cancelAnimationFrame(syncFrame);
        syncFrame = requestAnimationFrame(() => {
          syncFrame = null;
          // Measure and paint once before the scene can enter the viewport.
          syncScrollStateRef.current?.();
        });
      },
      { rootMargin: "1500px 0px 1500px 0px", threshold: 0 },
    );
    observer.observe(root);
    if (runtimeProfile.isIOSWebKit) {
      const releaseMargin = Math.round((window.innerHeight || 768) * 4);
      retentionObserver = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) return;
          setMobileVignettesMounted((mounted) => {
            if (!mounted) return mounted;
            logPerformanceEvent("cityplan:rasters-release", {
              section: "CityPlan",
              cityPlanBeat: mobileCommittedBeatRef.current,
            });
            return false;
          });
        },
        { rootMargin: `${releaseMargin}px 0px`, threshold: 0 },
      );
      retentionObserver.observe(root);
    }
    syncFrame = requestAnimationFrame(() => {
      syncFrame = null;
      if (mobileNearbyRef.current) {
        setMobileVignettesMounted(true);
        syncScrollStateRef.current?.();
      }
    });
    return () => {
      observer.disconnect();
      retentionObserver?.disconnect();
      if (syncFrame) cancelAnimationFrame(syncFrame);
      delete root.dataset.mobileNearby;
    };
  }, [mobileCameraActive]);

  const paintMobileCopy = useCallback((activeBeat) => {
    rootRef.current?.style.setProperty("--copy-swap", "0");
    copyItemsRef.current.forEach((el) => {
      const active = Number(el.dataset.copyBeat) === activeBeat;
      el.style.setProperty("--copy-opacity", active ? "1" : "0");
      el.style.setProperty("--copy-blur", "0");
    });
  }, []);

  useLayoutEffect(() => {
    if (!mobileCameraActive) return;
    paintMobileCopy(mobileScene.committedBeat);
  }, [mobileCameraActive, mobileScene.committedBeat, paintMobileCopy]);

  useEffect(() => {
    let frame = null;

    const measure = () => {
      const vh = window.innerHeight || 768;
      const page = window.scrollY;
      const line = vh * READING_LINE;
      marksRef.current = holdsRef.current.map((el) =>
        el ? page + el.getBoundingClientRect().top - line : Infinity,
      );
      const root = rootRef.current?.getBoundingClientRect();
      marksRef.current.enter = root ? page + root.top - vh * 0.95 : Infinity;
      marksRef.current.start = root ? page + root.top : Infinity;
      marksRef.current.end = root
        ? Math.max(marksRef.current.start + 1, page + root.bottom - vh)
        : Infinity;
      copyItemsRef.current = Array.from(
        bandRef.current?.querySelectorAll("[data-copy-beat]") ?? [],
      );
      const bandWidth =
        bandRef.current?.clientWidth || viewRef.current?.clientWidth || 1;
      const stageHeight = stageRef.current?.clientHeight || vh;
      viewportMetricsRef.current = {
        bandWidth,
        stageHeight,
        viewportWidth: window.innerWidth || 1280,
        viewportHeight: vh,
      };
      if (
        CITY_PLAN_VIGNETTES_ENABLED &&
        window.innerWidth <= planMobileCameraSettings.maxWidth
      ) {
        const overlayLayout = measureMobileOverlayLayout();
        if (overlayLayout.changed) {
          setMobileOverlayLayoutVersion((version) => version + 1);
        }
      }
    };

    const paintCopy = (y, activeBeat, mobileViewport) => {
      const items = copyItemsRef.current;
      if (!items.length) return;
      if (mobileViewport) {
        paintMobileCopy(activeBeat);
        return;
      }

      let from = activeBeat;
      let to = activeBeat;
      let fromOpacity = 1;
      let toOpacity = 0;
      let fromBlur = 0;
      let toBlur = 1;
      let swap = 0;

      if (!reduceMotion) {
        const half = Math.max(
          70,
          Math.min(150, (window.innerHeight || 768) * COPY_BLEND_VH * 0.5),
        );
        let nearest = -1;
        let distance = Infinity;
        for (let i = 0; i < planBeatSpecs.length - 1; i += 1) {
          const d = Math.abs(y - marksRef.current[i]);
          if (d < distance) {
            nearest = i;
            distance = d;
          }
        }
        if (nearest >= 0 && distance < half) {
          from = nearest;
          to = nearest + 1;
          const linear = Math.min(
            1,
            Math.max(0, (y - (marksRef.current[nearest] - half)) / (half * 2)),
          );
          swap = Math.sin(linear * Math.PI);
          if (mobileViewport) {
            const eased = smoothstep(linear);
            fromOpacity = 1 - eased;
            toOpacity = eased;
            fromBlur = 0;
            toBlur = 0;
          } else if (linear < 0.48) {
            const t = linear / 0.48;
            const eased = t * t * t * (t * (t * 6 - 15) + 10);
            fromOpacity = 1 - eased;
            fromBlur = eased;
          } else if (linear > 0.52) {
            const t = (linear - 0.52) / 0.48;
            toOpacity = t * t * t * (t * (t * 6 - 15) + 10);
            fromOpacity = 0;
            fromBlur = 1;
            toBlur = 1 - toOpacity;
          } else {
            fromOpacity = 0;
            fromBlur = 1;
          }
        }
      }

      rootRef.current?.style.setProperty("--copy-swap", swap.toFixed(3));

      items.forEach((el) => {
        const index = Number(el.dataset.copyBeat);
        const opacity =
          from === to ? (index === from ? 1 : 0)
          : index === from ? fromOpacity
          : index === to ? toOpacity
          : 0;
        const blur =
          from === to ? 0 : index === from ? fromBlur : index === to ? toBlur : 0;
        el.style.setProperty("--copy-opacity", opacity.toFixed(3));
        el.style.setProperty("--copy-blur", blur.toFixed(3));
      });
    };

    const update = (force = false, mobileBeatOverride = null) => {
      frame = null;
      const mobileViewport =
        window.innerWidth <= planMobileCameraSettings.maxWidth;
      if (mobileViewport && !mobileNearbyRef.current && !force) return;
      const marks = marksRef.current;
      if (!marks.length) return;
      const y = window.scrollY;
      if (y >= marks.enter) setEntered(true);
      const progress = Math.min(
        1,
        Math.max(0, (y - marks.start) / (marks.end - marks.start)),
      );
      const vh = window.innerHeight || 768;
      const entrySpan = Math.max(1, vh * 0.75);
      const entry = reduceMotion
        ? 1
        : Math.min(1, Math.max(0, (y - (marks.start - entrySpan)) / entrySpan));
      const exitStart = marks.end - vh * 0.03;
      const exitSpan = Math.max(1, vh * 0.95);
      const exit = reduceMotion
        ? 0
        : Math.min(1, Math.max(0, (y - exitStart) / exitSpan));
      let reached = 0;
      for (let i = 0; i < marks.length; i += 1) if (y >= marks[i]) reached = i + 1;
      const next =
        mobileViewport && mobileBeatOverride != null
          ? Math.min(planBeatSpecs.length - 1, Math.max(0, mobileBeatOverride))
          : Math.min(planBeatSpecs.length - 1, reached);
      const stage = stageRef.current;
      const band = bandRef.current;
      const cam = camRef.current;
      if (stage && band && cam) {
        const localProgress = physicalBeatProgress(y, marks, next);
        const viewport = viewportMetricsRef.current;
        const viewportWidth =
          viewport?.viewportWidth ?? window.innerWidth ?? 1280;
        if (mobileViewport) {
          const layerProgress = mobileLayerProgressForBeat(
            next,
            localProgress,
            reduceMotion,
          );
          rootRef.current?.style.setProperty(
            "--plan-mobile-gap-opacity",
            layerProgress.gap.toFixed(4),
          );
          rootRef.current?.style.setProperty(
            "--plan-mobile-relief-sites-opacity",
            layerProgress.reliefSites.toFixed(4),
          );
          rootRef.current?.style.setProperty(
            "--plan-mobile-parking-opacity",
            layerProgress.parking.toFixed(4),
          );
          rootRef.current?.style.setProperty(
            "--plan-mobile-first-refuge-opacity",
            layerProgress.firstRefuge.toFixed(4),
          );
          rootRef.current?.style.setProperty(
            "--plan-mobile-extra-refuges-opacity",
            layerProgress.extraRefuges.toFixed(4),
          );
          const revealAfterCamera = MOBILE_CAMERA_THEN_REVEAL_BEATS.has(next);
          const revealAt =
            planMobileCamera[next]?.entryFraction ??
            planMobileCameraSettings.entryFraction;
          stage.dataset.mobileReveal =
            reduceMotion || !revealAfterCamera || localProgress >= revealAt
              ? "ready"
              : "holding";
        }
        const camera =
          viewportWidth <= planMobileCameraSettings.maxWidth
            ? cameraForBeat(next, localProgress, viewportWidth, reduceMotion)
            : { at: planView.at, units: planView.units, screen: [0.5, 0.5] };
        const bandWidth = viewport?.bandWidth ?? 1;
        const stageHeight = viewport?.stageHeight ?? vh;
        const zc = bandWidth / camera.units;
        const sx = (camera.screen[0] - 0.5) * bandWidth;
        const sy = (camera.screen[1] - 0.5) * stageHeight;
        const nextFrame = {
          bandWidth,
          stageHeight,
          cx: camera.at[0],
          cy: camera.at[1],
          zc,
          sx,
          sy,
        };
        cameraFrameRef.current = nextFrame;
        if (mobileViewport) {
          syncMobileOverlayGeometryRef.current?.(
            mobileCommittedBeatRef.current,
            nextFrame,
          );
        } else {
          syncOverlayGeometryRef.current?.(false, nextFrame);
        }
        cam.style.setProperty("--cx", camera.at[0].toFixed(2));
        cam.style.setProperty("--cy", camera.at[1].toFixed(2));
        cam.style.setProperty("--zc", zc.toFixed(5));
        cam.style.setProperty("--sx", `${sx.toFixed(2)}px`);
        cam.style.setProperty("--sy", `${sy.toFixed(2)}px`);
        rootRef.current?.style.setProperty(
          "--plan-camera-step-progress",
          (mobileViewport && next !== mobileCommittedBeatRef.current
            ? 1
            : localProgress
          ).toFixed(4),
        );
      }
      rootRef.current?.style.setProperty("--plan-progress", progress.toFixed(4));
      rootRef.current?.style.setProperty("--plan-entry", entry.toFixed(4));
      rootRef.current?.style.setProperty("--plan-exit", exit.toFixed(4));
      paintCopy(
        y,
        mobileViewport ? mobileCommittedBeatRef.current : next,
        mobileViewport,
      );
      if (mobileViewport) {
        requestMobileBeatRef.current?.(next);
      } else {
        setScrollBeat((current) => (current === next ? current : next));
      }
    };

    const requestUpdate = () => {
      if (
        window.innerWidth <= planMobileCameraSettings.maxWidth &&
        !mobileNearbyRef.current
      )
        return;
      if (frame) return;
      frame = requestAnimationFrame(update);
    };
    const onResize = () => {
      if (
        window.innerWidth <= planMobileCameraSettings.maxWidth &&
        !mobileNearbyRef.current
      )
        return;
      measure();
      update(
        true,
        window.innerWidth <= planMobileCameraSettings.maxWidth
          ? mobileCommittedBeatRef.current
          : null,
      );
    };
    const syncNow = () => {
      measure();
      update(true);
    };
    syncScrollStateRef.current = syncNow;

    if (
      window.innerWidth > planMobileCameraSettings.maxWidth ||
      mobileNearbyRef.current
    )
      syncNow();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", onResize);
    const layoutObserver = new ResizeObserver(onResize);
    const rootNode = rootRef.current;
    if (rootNode) layoutObserver.observe(rootNode);
    if (rootNode?.parentElement) layoutObserver.observe(rootNode.parentElement);
    if (rootNode?.previousElementSibling) {
      layoutObserver.observe(rootNode.previousElementSibling);
    }
    let live = true;
    document.fonts?.ready.then(() => {
      if (live) onResize();
    });
    const settleId = window.setTimeout(onResize, 1100);
    return () => {
      live = false;
      if (syncScrollStateRef.current === syncNow)
        syncScrollStateRef.current = null;
      window.clearTimeout(settleId);
      layoutObserver.disconnect();
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", onResize);
    };
  }, [measureMobileOverlayLayout, paintMobileCopy, reduceMotion]);

  useEffect(() => {
    if (mobileCameraActive) return undefined;
    const name = planBeatSpecs[beat]?.vignette;
    if (!entered || !name) return undefined;
    const node = vignetteNode;
    if (!node || node.dataset.vignette !== name) return undefined;
    const total = planVignetteMeta[name]?.steps ?? 1;
    let k = 0;
    let intervalId;
    const advance = () => {
      k += 1;
      setVignetteProgress({ beat, mount: vignetteMount, step: k });
      if (k >= total - 1) {
        window.clearInterval(intervalId);
      }
    };
    const firstStepId = window.setTimeout(
      () => {
        advance();
        if (k < total - 1) {
          intervalId = window.setInterval(advance, VIGNETTE_STEP_MS);
        }
      },
      reduceMotion ? 0 : VIGNETTE_FIRST_STEP_MS,
    );
    return () => {
      window.clearTimeout(firstStepId);
      window.clearInterval(intervalId);
    };
  }, [
    beat,
    entered,
    mobileCameraActive,
    reduceMotion,
    vignetteMount,
    vignetteNode,
  ]);

  useLayoutEffect(() => {
    if (mobileCameraActive) return;
    if (!vignetteName || !entered || !vignetteLive) return;
    syncOverlayGeometry(true);
  }, [
    entered,
    mobileCameraActive,
    syncOverlayGeometry,
    vignetteLive,
    vignetteMount,
    vignetteName,
  ]);

  useLayoutEffect(() => {
    if (mobileCameraActive) return;
    syncOverlayGeometry();
  });

  useLayoutEffect(() => {
    const node = vignetteNodeRef.current;
    if (
      !vignetteLive ||
      !currentLink ||
      !node ||
      node.dataset.vignette !== vignetteName ||
      enteredVignetteMountRef.current === vignetteMount
    ) return;

    enteredVignetteMountRef.current = vignetteMount;
    if (mobileCameraActive) return;
    if (reduceMotion) {
      vignetteControls.set({ opacity: 1, x: 0, y: 0, scale: 1, filter: "none" });
      return;
    }

    vignetteControls.set({
      opacity: 0,
      x: currentLink.fx,
      y: currentLink.fy,
      scale: 0.12,
      filter: "blur(2px)",
    });
    vignetteControls.start({
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      filter: "none",
      transition: {
        duration: VIGNETTE_ENTER_MS / 1000,
        ease: [0.22, 1, 0.36, 1],
      },
    });
  }, [
    currentLink,
    mobileCameraActive,
    reduceMotion,
    vignetteControls,
    vignetteLive,
    vignetteMount,
    vignetteName,
  ]);

  const paintMapBeat = useCallback((activeBeat, mobileDelta = false) => {
    const fig = figRef.current;
    if (!fig || !entered) return;
    if (!itemsRef.current) {
      itemsRef.current = Array.from(fig.querySelectorAll(".pl-i")).map((el) => ({
        el,
        at: Number(el.dataset.at || 0),
        until: el.dataset.until == null ? null : Number(el.dataset.until),
      }));
      mapBeatStatesRef.current = planBeatSpecs.map((_, stateBeat) => {
        const on = new Set();
        const now = new Set();
        itemsRef.current.forEach(({ at, until }, index) => {
          const active =
            stateBeat >= at && (until == null || stateBeat < until);
          if (active) on.add(index);
          if (active && at === stateBeat) now.add(index);
        });
        return { on, now };
      });
    }

    if (mobileDelta) {
      const previousBeat = mobilePaintedMapBeatRef.current;
      const nextState = mapBeatStatesRef.current[activeBeat];
      if (!nextState) return;
      if (previousBeat == null) {
        itemsRef.current.forEach(({ el }, index) => {
          el.classList.toggle("is-on", nextState.on.has(index));
          el.classList.toggle("is-now", nextState.now.has(index));
        });
      } else if (previousBeat !== activeBeat) {
        const previousState = mapBeatStatesRef.current[previousBeat];
        previousState.on.forEach((index) => {
          if (!nextState.on.has(index)) {
            itemsRef.current[index].el.classList.remove("is-on");
          }
        });
        nextState.on.forEach((index) => {
          if (!previousState.on.has(index)) {
            itemsRef.current[index].el.classList.add("is-on");
          }
        });
        previousState.now.forEach((index) => {
          if (!nextState.now.has(index)) {
            itemsRef.current[index].el.classList.remove("is-now");
          }
        });
        nextState.now.forEach((index) => {
          if (!previousState.now.has(index)) {
            itemsRef.current[index].el.classList.add("is-now");
          }
        });
      }
      mobilePaintedMapBeatRef.current = activeBeat;
      return;
    }

    itemsRef.current.forEach(({ el, at, until }) => {
      const on = activeBeat >= at && (until == null || activeBeat < until);
      el.classList.toggle("is-on", on);
      el.classList.toggle("is-now", on && at === activeBeat);
    });
  }, [entered]);

  useLayoutEffect(() => {
    mobilePaintedMapBeatRef.current = null;
  }, [mobileCameraActive]);

  useLayoutEffect(() => {
    if (!mobileCameraActive) return;
    paintMapBeat(beat, true);
  }, [beat, mobileCameraActive, paintMapBeat]);

  useEffect(() => {
    if (mobileCameraActive) return;
    paintMapBeat(mapBeat);
  }, [mapBeat, mobileCameraActive, paintMapBeat]);

  useLayoutEffect(() => {
    if (mobileCameraActive) return;
    const art = bandRef.current?.querySelector(
      `[data-vignette="${vignetteName}"] .plan-vignette-art`,
    );
    if (!art) return;
    paintVignetteStep(collectVignetteItems(art), vstep);
  }, [mobileCameraActive, vstep, vignetteName]);

  return (
    <section ref={rootRef} className="plan-scene" aria-label={planSceneLabel}>
      <div className="sr-only plan-transcript">
        <h3>{planContext.title}</h3>
        <p>{planContext.note}.</p>
        <p>{planFigureLabel}</p>
        <ol>
          {planBeats.map((step) => (
            <li key={step.id}>
              <strong>{step.lead}</strong>{" "}
              {step.body.map((part) => part.text).join("")}
            </li>
          ))}
        </ol>
        <p>
          {planLegendLabel}: {planLegend.map((item) => item.label).join(", ")}.
        </p>
      </div>

      {mobileCameraActive ? (
        <>
          <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {formatLocalStepLabel(
              uiContent.localStory?.stepLabelTemplate,
              beat + 1,
              planBeats.length,
            )}
          </p>
          <p className="sr-only">{uiContent.localStory?.scrollPlan}</p>
        </>
      ) : null}

      <div
        ref={stageRef}
        className={`plan-stage plan-stage--${side}`}
        data-beat={synchronizedMapBeat}
        data-story-beat={beat}
        data-requested-beat={requestedBeat}
        data-prepared-beat={
          mobileCameraActive ? mobileScene.preparedBeat : beat
        }
        data-committed-beat={beat}
        data-scene-generation={
          mobileCameraActive ? mobileScene.committedGeneration : 0
        }
        aria-hidden="true"
      >
        <div ref={viewRef} className="plan-bleed">
          <div
            ref={camRef}
            className="plan-camera"
            style={{ width: `${PLAN_W}px`, height: `${PLAN_H}px` }}
          >
            {mobileCameraActive ? (
              mobileVignettesMounted ? (
                CITY_BUILD_RASTER_DIAGNOSTIC_MODE === "normal" &&
                mobileAssetFailure &&
                !mobileVisualReady ? (
                  <figure
                    ref={figRef}
                    className="plan-figure plan-figure--mobile-fallback"
                    data-motion="story"
                    aria-hidden="true"
                    dangerouslySetInnerHTML={PLAN_HTML}
                  />
                ) : (
                  <MobilePersistentPlan
                    activeBeat={beat}
                    requestedBeat={requestedBeat}
                    fallbackActive={!mobileVisualReady}
                    onAssetSettled={handleMobileAssetSettled}
                    rasterDiagnosticMode={CITY_BUILD_RASTER_DIAGNOSTIC_MODE}
                  />
                )
              ) : null
            ) : CITY_BUILD_RASTER_DIAGNOSTIC_ACTIVE ? (
              <MobilePersistentPlan
                activeBeat={beat}
                requestedBeat={beat}
                fallbackActive={false}
                onAssetSettled={handleMobileAssetSettled}
                rasterDiagnosticMode={CITY_BUILD_RASTER_DIAGNOSTIC_MODE}
              />
            ) : (
              <figure
                ref={figRef}
                className="plan-figure"
                data-motion="story"
                aria-label={planFigureLabel}
                dangerouslySetInnerHTML={PLAN_HTML}
              />
            )}
          </div>
        </div>

        <div className="plan-veil plan-veil--l" aria-hidden="true" />
        <div className="plan-veil plan-veil--r" aria-hidden="true" />

        <div className="plan-curtain plan-curtain--entry" aria-hidden="true" />
        <div className="plan-curtain plan-curtain--exit" aria-hidden="true" />

        <div ref={bandRef} className="plan-band">
          {mobileCameraActive ? (
            entered && planAnnotations.map((annotation) => {
              const active = activeAnnotations.some(
                (activeAnnotation) => activeAnnotation.id === annotation.id,
              );
              return (
                <div
                  key={annotation.id}
                  className={`plan-annotation plan-annotation--mobile plan-annotation--${annotation.id}${
                    active ? " is-visible" : ""
                  }`}
                  style={{
                    left: `var(--annotation-${annotation.id}-x, -1000px)`,
                    top: `var(--annotation-${annotation.id}-y, -1000px)`,
                    "--annotation-x": `${annotation.offset[0]}px`,
                    "--annotation-y": `${annotation.offset[1]}px`,
                  }}
                  aria-hidden="true"
                >
                  <svg className="plan-annotation-leader" aria-hidden="true">
                    <line
                      className="plan-annotation-line plan-annotation-line--halo"
                      x1="0"
                      y1="0"
                      x2={annotation.offset[0]}
                      y2={annotation.offset[1]}
                      pathLength="1"
                    />
                    <line
                      className="plan-annotation-line plan-annotation-line--ink"
                      x1="0"
                      y1="0"
                      x2={annotation.offset[0]}
                      y2={annotation.offset[1]}
                      pathLength="1"
                    />
                  </svg>
                  <span className="plan-annotation-dot" />
                  <span className="plan-annotation-label">{annotation.label}</span>
                </div>
              );
            })
          ) : (
            <AnimatePresence initial={false}>
              {activeAnnotations.map((activeAnnotation) => (
                <motion.div
                  key={activeAnnotation.id}
                  className={`plan-annotation plan-annotation--${activeAnnotation.id}`}
                  style={{
                    left: `var(--annotation-${activeAnnotation.id}-x, -1000px)`,
                    top: `var(--annotation-${activeAnnotation.id}-y, -1000px)`,
                    "--annotation-x": `${activeAnnotation.offset[0]}px`,
                    "--annotation-y": `${activeAnnotation.offset[1]}px`,
                  }}
                  initial={
                    reduceMotion
                      ? { opacity: 1 }
                      : { opacity: 0, y: 7, filter: "blur(3px)" }
                  }
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={
                    reduceMotion
                      ? { opacity: 0 }
                      : { opacity: 0, y: -5, filter: "blur(2px)" }
                  }
                  transition={{
                    duration: reduceMotion ? 0 : 0.48,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  aria-hidden="true"
                  data-motion="story"
                >
                  <svg className="plan-annotation-leader" aria-hidden="true">
                    <line
                      className="plan-annotation-line plan-annotation-line--halo"
                      x1="0"
                      y1="0"
                      x2={activeAnnotation.offset[0]}
                      y2={activeAnnotation.offset[1]}
                      pathLength="1"
                    />
                    <line
                      className="plan-annotation-line plan-annotation-line--ink"
                      x1="0"
                      y1="0"
                      x2={activeAnnotation.offset[0]}
                      y2={activeAnnotation.offset[1]}
                      pathLength="1"
                    />
                  </svg>
                  <span className="plan-annotation-dot" />
                  <span className="plan-annotation-label">
                    {activeAnnotation.label}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          )}

          {CITY_PLAN_VIGNETTES_ENABLED && (mobileCameraActive ? (
            mobileVignettesMounted ? (
              <MobilePersistentLink
                name={vignetteLive ? vignetteName : null}
                ready={Boolean(vignetteComplete)}
                linkRef={linkSvgRef}
              />
            ) : null
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              {vignetteName && entered && currentLink ? (
              <motion.svg
                ref={linkSvgRef}
                key={`link-${vignetteName}`}
                className={`plan-link${vignetteComplete ? " is-ready" : ""}`}
                aria-hidden="true"
                data-motion="story"
                exit={{ opacity: 0 }}
                transition={{
                  duration: reduceMotion ? 0 : 0.45,
                  delay: reduceMotion ? 0 : 0.08,
                }}
              >
              {["halo", "ink"].map((layer) => (
                <g key={layer} className={`plan-link-${layer}`}>
                  {currentLink.lead ? (
                    <line
                      className="plan-link-lead"
                      x1={currentLink.x1}
                      y1={currentLink.y1}
                      x2={currentLink.x2}
                      y2={currentLink.y2}
                      pathLength="1"
                    />
                  ) : null}
                  <circle
                    className="plan-link-ring"
                    cx={currentLink.ax}
                    cy={currentLink.ay}
                    r={LINK_R}
                    pathLength="1"
                  />
                  <path
                    className="plan-link-ticks"
                    d={[
                      `M ${currentLink.ax - LINK_R - 8} ${currentLink.ay} h 6`,
                      `M ${currentLink.ax + LINK_R + 2} ${currentLink.ay} h 6`,
                      `M ${currentLink.ax} ${currentLink.ay - LINK_R - 8} v 6`,
                      `M ${currentLink.ax} ${currentLink.ay + LINK_R + 2} v 6`,
                    ].join(" ")}
                    pathLength="1"
                  />
                </g>
              ))}
                <circle
                  className="plan-link-dot"
                  cx={currentLink.ax}
                  cy={currentLink.ay}
                  r="2.8"
                />
              </motion.svg>
              ) : null}
            </AnimatePresence>
          ))}

          {CITY_PLAN_VIGNETTES_ENABLED && (mobileCameraActive ? (
            mobileVignettesMounted ? (
              <MobilePersistentVignettes
                activeName={vignetteLive ? vignetteName : null}
                requestedName={
                  entered
                    ? planBeatSpecs[requestedBeat]?.vignette ?? null
                    : null
                }
                onAssetSettled={handleMobileAssetSettled}
              />
            ) : null
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              {vignetteLive ? (
              <motion.div
                ref={bindVignetteNode}
                key={vignetteName}
                className={`plan-vignette plan-vignette--${place} plan-vignette--${vignetteSide}${
                  vignetteComplete ? "" : " is-building"
                }`}
                style={{ "--ratio": planVignetteMeta[vignetteName].ratio }}
                initial={
                  reduceMotion
                    ? false
                    : { opacity: 0 }
                }
                animate={vignetteControls}
                exit={
                  reduceMotion
                    ? { opacity: 0, transition: { duration: 0 } }
                    : {
                        opacity: 0,
                        x: currentLink?.fx ?? 0,
                        y: currentLink?.fy ?? 0,
                        scale: 0.12,
                        filter: "blur(2px)",
                        transition: {
                          duration: VIGNETTE_EXIT_MS / 1000,
                          ease: [0.45, 0, 0.25, 1],
                        },
                      }
                }
                data-motion="story"
                data-vignette={vignetteName}
                aria-hidden="true"
              >
                <div
                  className="plan-vignette-art"
                  dangerouslySetInnerHTML={VIGNETTE_HTML[vignetteName]}
                />
              </motion.div>
              ) : null}
            </AnimatePresence>
          ))}

          {COPY_SIDES.map((copySide) => {
            const currentSide = copySide === side;
            return (
              <div
                key={copySide}
                className={`plan-copy plan-copy--${copySide}${
                  currentSide ? " is-current" : ""
                }${vignetteLive && currentSide ? " is-narrow" : ""}`}
              >
                <span className="plan-step tnum">
                  <span className="plan-step-count" key={`${copySide}-${beat}`}>
                    {String(beat + 1).padStart(2, "0")} /{" "}
                    {String(planBeats.length).padStart(2, "0")}
                  </span>
                  {mobileCameraActive ? (
                    <span className="plan-step-segments" aria-hidden="true">
                      {planBeats.map((step, segmentIndex) => (
                        <span
                          key={step.id}
                          className={`plan-step-segment${
                            segmentIndex < beat
                              ? " is-complete"
                              : segmentIndex === beat
                                ? " is-current"
                                : ""
                          }`}
                          style={{
                            "--plan-step-fill":
                              segmentIndex < beat
                                ? 1
                                : segmentIndex === beat
                                  ? "var(--plan-camera-step-progress)"
                                  : 0,
                          }}
                        />
                      ))}
                    </span>
                  ) : (
                    <span className="plan-step-track" aria-hidden="true">
                      <span className="plan-step-progress" />
                    </span>
                  )}
                </span>

                <div className="plan-copy-body">
                  {planBeats.map((step, i) => {
                    const stepSide = step.side === "right" ? "right" : "left";
                    if (stepSide !== copySide) return null;
                    const active = i === beat;
                    return (
                      <div
                        key={step.id}
                        className={`plan-beat${active ? " is-on" : ""}`}
                        data-copy-beat={i}
                        aria-hidden={active ? undefined : "true"}
                      >
                        <p className="plan-text">
                          <span className="plan-text-lead">{step.lead}</span>
                          <br />
                          <CopySegments parts={step.body} breakAfterPeriod />
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div
                  className={`plan-legend${
                    currentSide && synchronizedMapBeat >= planLegend[0].at ? " is-on" : ""
                  }`}
                  aria-hidden="true"
                >
                  <span className="plan-legend-label">{planLegendLabel}</span>
                  <ul className="plan-legend-list">
                    {planLegend.map((item) => (
                      <li
                        key={item.label}
                        className={`plan-legend-item plan-legend-item--${item.tone}${
                          currentSide && synchronizedMapBeat >= item.at ? " is-on" : ""
                        }${currentSide && synchronizedMapBeat === item.at ? " is-now" : ""}`}
                      >
                        <span className="plan-legend-swatch" />
                        <span className="plan-legend-word">{item.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="plan-arrival-hold" aria-hidden="true" />

      {planBeats.map((step, i) => {
        const givesTimeToVignette = Boolean(planBeats[i + 1]?.vignette);
        return (
          <div
            key={step.id}
            ref={(el) => {
              holdsRef.current[i] = el;
            }}
            className={`plan-hold${givesTimeToVignette ? " plan-hold--wide" : ""}`}
            aria-hidden="true"
          />
        );
      })}
    </section>
  );
}

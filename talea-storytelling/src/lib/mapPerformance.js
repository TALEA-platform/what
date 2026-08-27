import { runtimeProfile } from "./runtimeProfile";

export const debugPerf =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("debugPerf") === "1";

const liveMaps = new Map();
let nextMapId = 1;
let telemetryInitialized = false;
let bootCount = 1;
let currentStorySection = "boot";
const mountedHeavySceneTrees = new Set();
const memoryDebugState = {
  journeyMode: "unknown",
  heroMediaState: "attached",
  causeRasterState: "mounted",
  cityPlanRasterCount: 0,
  rifugioMountedNodeCount: 0,
  lastMapInit: null,
  lastMapRelease: null,
  lastCleanupEvent: null,
  lastLifecycleEvent: "boot",
};

const BREADCRUMB_KEY = "talea:perf:last-event";
const BOOT_COUNT_KEY = "talea:perf:boot-count";

function readBreadcrumb() {
  try {
    return JSON.parse(sessionStorage.getItem(BREADCRUMB_KEY) || "null");
  } catch {
    return null;
  }
}

function countMounted(selector) {
  if (typeof document === "undefined") return 0;
  return document.querySelectorAll(selector).length;
}

function refreshMeasuredMemoryState() {
  if (typeof document === "undefined") return;
  memoryDebugState.cityPlanRasterCount = countMounted(
    ".plan-scene img[src], .plan-scene image[href]",
  );
  memoryDebugState.rifugioMountedNodeCount = countMounted(
    ".rifugio-model3d-holder *",
  );
}

export function getMemoryDebugSummary() {
  refreshMeasuredMemoryState();
  return {
    mapsAlive: liveMaps.size,
    heavyImagesMounted: countMounted(
      ".causes-static-raster-image, .plan-scene img[src], .plan-scene image[href]",
    ),
    rifugioMounted: memoryDebugState.rifugioMountedNodeCount > 0,
    rifugioMountedNodeCount: memoryDebugState.rifugioMountedNodeCount,
    cityPlanRasterCount: memoryDebugState.cityPlanRasterCount,
    heroMediaState: memoryDebugState.heroMediaState,
    causeRasterState: memoryDebugState.causeRasterState,
    activeSection: currentStorySection,
    journeyMode: memoryDebugState.journeyMode,
    currentlyMountedHeavySceneTrees: [...mountedHeavySceneTrees],
    lastMapInit: memoryDebugState.lastMapInit,
    lastMapRelease: memoryDebugState.lastMapRelease,
    lastCleanupEvent: memoryDebugState.lastCleanupEvent,
    lastLifecycleEvent: memoryDebugState.lastLifecycleEvent,
  };
}

export function updateMemoryDebugState(patch = {}) {
  if (patch.heavyScene) {
    const { name, mounted } = patch.heavyScene;
    if (name) {
      if (mounted) mountedHeavySceneTrees.add(name);
      else mountedHeavySceneTrees.delete(name);
    }
  }
  Object.entries(patch).forEach(([key, value]) => {
    if (key !== "heavyScene" && key in memoryDebugState) {
      memoryDebugState[key] = value;
    }
  });
}

export function markJourneyMode(mode) {
  if (!debugPerf || !mode) return;
  if (
    memoryDebugState.journeyMode === "backtrack" &&
    mode !== "direct"
  )
    return;
  memoryDebugState.journeyMode = mode;
}

function writeBreadcrumb(event, details = {}) {
  try {
    const previous = readBreadcrumb() || {};
    const summary = getMemoryDebugSummary();
    const breadcrumb = {
      bootCount,
      timestamp: Date.now(),
      section: details.section ?? currentStorySection ?? previous.section ?? "unknown",
      cityPlanBeat: details.cityPlanBeat ?? previous.cityPlanBeat ?? null,
      mapCount: liveMaps.size,
      contextCount: liveMaps.size,
      lastLifecycleEvent: event,
      journeyMode: summary.journeyMode,
      mountedHeavySceneTrees: summary.currentlyMountedHeavySceneTrees,
      lastMapInit: summary.lastMapInit,
      lastMapRelease: summary.lastMapRelease,
      rifugioMountedNodeCount: summary.rifugioMountedNodeCount,
      cityPlanRasterCount: summary.cityPlanRasterCount,
      heroMediaState: summary.heroMediaState,
      causeRasterState: summary.causeRasterState,
      lastCleanupEvent: summary.lastCleanupEvent,
    };
    sessionStorage.setItem(BREADCRUMB_KEY, JSON.stringify(breadcrumb));
  } catch {
    // Storage can be unavailable in privacy modes; telemetry must stay optional.
  }
}

function mapDimensions(map) {
  const container = map.getContainer?.();
  const canvas = map.getCanvas?.();
  const cssWidth = container?.clientWidth ?? 0;
  const cssHeight = container?.clientHeight ?? 0;
  const widthRatio = cssWidth > 0 ? canvas?.width / cssWidth : 0;
  const heightRatio = cssHeight > 0 ? canvas?.height / cssHeight : 0;

  return {
    cssWidth,
    cssHeight,
    canvasWidth: canvas?.width ?? 0,
    canvasHeight: canvas?.height ?? 0,
    effectivePixelRatio:
      widthRatio > 0 && heightRatio > 0
        ? Number(Math.min(widthRatio, heightRatio).toFixed(3))
        : map.getPixelRatio?.() ?? 1,
  };
}

function logPageLifecycle(event) {
  const details = {
    event: event.type,
    visibility: document.visibilityState,
    persisted: "persisted" in event ? event.persisted : undefined,
  };
  writeBreadcrumb(`page:${event.type}`);
  if (debugPerf) console.debug("[talea:perf] page", details);
}

export function initializeMapPerformanceTelemetry() {
  if (telemetryInitialized) return;
  telemetryInitialized = true;

  const previousBreadcrumb = readBreadcrumb();
  try {
    bootCount = Number.parseInt(sessionStorage.getItem(BOOT_COUNT_KEY) || "0", 10) + 1;
    sessionStorage.setItem(BOOT_COUNT_KEY, String(bootCount));
  } catch {
    // Storage can be unavailable in privacy modes; telemetry must stay optional.
  }

  writeBreadcrumb("boot");
  if (debugPerf) {
    window.__taleaMemorySummary = getMemoryDebugSummary;
    if (runtimeProfile.isIPhone) {
      console.debug(`[ios-map-backend] ${runtimeProfile.iosMapBackend}`);
    }
    console.debug("[talea:perf] boot", {
      bootCount,
      previousBreadcrumb,
      runtimeProfile,
      devicePixelRatio: window.devicePixelRatio || 1,
    });
  }
  document.addEventListener("visibilitychange", logPageLifecycle);
  window.addEventListener("pagehide", logPageLifecycle);
  window.addEventListener("pageshow", logPageLifecycle);
}

export function logPerformanceEvent(event, details = {}) {
  initializeMapPerformanceTelemetry();
  if (event === "story:section" && details.section) {
    currentStorySection = details.section;
  }
  memoryDebugState.lastLifecycleEvent = event;
  if (/release|remove|destroy|cleanup/i.test(event)) {
    memoryDebugState.lastCleanupEvent = event;
  }
  if (event === "renderer:prewarm" && details.renderer) {
    mountedHeavySceneTrees.add(details.renderer);
    if (/cause/i.test(details.renderer)) memoryDebugState.causeRasterState = "mounted";
  }
  if (event === "renderer:release" && details.renderer) {
    mountedHeavySceneTrees.delete(details.renderer);
    if (/cause/i.test(details.renderer)) memoryDebugState.causeRasterState = "released";
  }
  writeBreadcrumb(event, details);
  if (debugPerf) {
    console.debug(`[talea:perf] ${event}`, {
      ...details,
      liveMaps: liveMaps.size,
      contextCount: liveMaps.size,
    });
  }
}

export function observeStoryPerformanceSections() {
  if (typeof window === "undefined") return () => {};
  initializeMapPerformanceTelemetry();
  if (!debugPerf) return () => {};

  const sections = [
    ["Hero", ".hero-zoom-scroll"],
    ["Hotspot intro", ".hotspot-intro"],
    ["Hotspot", ".hotspot-scene"],
    ["Cause", "#causes"],
    ["Ombra", "#ombra"],
    ["Rifugio", ".relief-explainer"],
    ["Mappa Rifugi", ".relief-map-section:not(.zones-scene)"],
    ["CityPlan", ".plan-scene"],
    ["Zones", ".zones-scene"],
  ]
    .map(([name, selector]) => [name, document.querySelector(selector)])
    .filter(([, element]) => element);
  if (!sections.length) return () => {};

  let frame = null;
  let lastSection = null;
  let lastSectionAt = performance.now();
  const update = () => {
    frame = null;
    const readingLine = (window.innerHeight || 768) * 0.5;
    let best = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    sections.forEach(([name, element]) => {
      const rect = element.getBoundingClientRect();
      if (rect.bottom <= 0 || rect.top >= window.innerHeight) return;
      const distance = Math.abs((rect.top + rect.bottom) * 0.5 - readingLine);
      if (distance < bestDistance) {
        best = name;
        bestDistance = distance;
      }
    });
    if (!best || best === lastSection) return;
    const previousSection = lastSection;
    const previousIndex = sections.findIndex(([name]) => name === previousSection);
    const nextIndex = sections.findIndex(([name]) => name === best);
    const now = performance.now();
    if (previousIndex >= 0) {
      const distance = nextIndex - previousIndex;
      if (distance < 0) markJourneyMode("backtrack");
      else if (distance > 1) markJourneyMode("direct");
      else if (distance === 1) {
        markJourneyMode(now - lastSectionAt < 1500 ? "fast" : "slow");
      }
    }
    lastSectionAt = now;
    lastSection = best;
    logPerformanceEvent("story:section", {
      section: best,
      previousSection,
    });
  };
  const requestUpdate = () => {
    if (frame !== null) return;
    frame = requestAnimationFrame(update);
  };
  update();
  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate);
  return () => {
    if (frame !== null) cancelAnimationFrame(frame);
    window.removeEventListener("scroll", requestUpdate);
    window.removeEventListener("resize", requestUpdate);
  };
}

export function registerMapPerformance(map, name) {
  initializeMapPerformanceTelemetry();

  const id = nextMapId++;
  const record = { id, name, createdAt: performance.now() };
  liveMaps.set(map, record);
  memoryDebugState.lastMapInit = name;
  mountedHeavySceneTrees.add(`MapLibre:${name}`);
  const canvas = map.getCanvas();

  const logContextEvent = (event) => {
    const details = {
      id,
      name,
      liveMaps: liveMaps.size,
      ...mapDimensions(map),
    };
    writeBreadcrumb(event.type);
    if (debugPerf) console.debug(`[talea:perf] ${event.type}`, details);
  };
  const logResize = (event) => {
    if (!debugPerf) return;
    console.debug("[talea:perf] map:resize", {
      id,
      name,
      liveMaps: liveMaps.size,
      application: Boolean(event?.taleaApplicationResize),
      reason: event?.taleaResizeReason ?? "maplibre-observer",
      ...mapDimensions(map),
    });
  };

  canvas.addEventListener("webglcontextlost", logContextEvent);
  canvas.addEventListener("webglcontextrestored", logContextEvent);
  map.on("resize", logResize);
  const createDetails = {
    id,
    name,
    liveMaps: liveMaps.size,
    createdAt: record.createdAt,
    configuredPixelRatio:
      map.getPixelRatio?.() ?? (window.devicePixelRatio || 1),
    ...mapDimensions(map),
  };
  writeBreadcrumb(`map:create:${name}`);
  if (debugPerf) console.debug("[talea:perf] map:create", createDetails);

  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    canvas.removeEventListener("webglcontextlost", logContextEvent);
    canvas.removeEventListener("webglcontextrestored", logContextEvent);
    map.off("resize", logResize);
    liveMaps.delete(map);
    memoryDebugState.lastMapRelease = name;
    mountedHeavySceneTrees.delete(`MapLibre:${name}`);
    const removeDetails = {
      id,
      name,
      liveMaps: liveMaps.size,
      lifetimeMs: Number((performance.now() - record.createdAt).toFixed(1)),
    };
    writeBreadcrumb(`map:remove:${name}`);
    if (debugPerf) console.debug("[talea:perf] map:remove", removeDetails);
  };
}

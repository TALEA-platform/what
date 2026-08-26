import { runtimeProfile } from "./runtimeProfile";

const debugPerf =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("debugPerf") === "1";

const liveMaps = new Map();
let nextMapId = 1;
let telemetryInitialized = false;

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
  console.debug("[talea:perf] page", {
    event: event.type,
    visibility: document.visibilityState,
    persisted: "persisted" in event ? event.persisted : undefined,
  });
}

export function initializeMapPerformanceTelemetry() {
  if (!debugPerf || telemetryInitialized) return;
  telemetryInitialized = true;

  let bootCount = 1;
  try {
    const key = "talea:perf:boot-count";
    bootCount = Number.parseInt(sessionStorage.getItem(key) || "0", 10) + 1;
    sessionStorage.setItem(key, String(bootCount));
  } catch {
    // Storage can be unavailable in privacy modes; telemetry must stay optional.
  }

  console.debug("[talea:perf] boot", {
    bootCount,
    runtimeProfile,
    devicePixelRatio: window.devicePixelRatio || 1,
  });
  document.addEventListener("visibilitychange", logPageLifecycle);
  window.addEventListener("pagehide", logPageLifecycle);
  window.addEventListener("pageshow", logPageLifecycle);
}

export function registerMapPerformance(map, name) {
  if (!debugPerf) return () => {};
  initializeMapPerformanceTelemetry();

  const id = nextMapId++;
  const record = { id, name };
  liveMaps.set(map, record);
  const canvas = map.getCanvas();

  const logContextEvent = (event) => {
    console.debug(`[talea:perf] ${event.type}`, {
      id,
      name,
      liveMaps: liveMaps.size,
      ...mapDimensions(map),
    });
  };
  const logResize = (event) => {
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
  console.debug("[talea:perf] map:create", {
    id,
    name,
    liveMaps: liveMaps.size,
    configuredPixelRatio:
      map.getPixelRatio?.() ?? (window.devicePixelRatio || 1),
    ...mapDimensions(map),
  });

  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    canvas.removeEventListener("webglcontextlost", logContextEvent);
    canvas.removeEventListener("webglcontextrestored", logContextEvent);
    map.off("resize", logResize);
    liveMaps.delete(map);
    console.debug("[talea:perf] map:remove", {
      id,
      name,
      liveMaps: liveMaps.size,
    });
  };
}

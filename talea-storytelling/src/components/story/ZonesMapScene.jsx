import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { zonesMap } from "../../data/taleaProject";
import { useContent } from "../../content";
import {
  BASEMAP_STYLE,
  EXPLORE_ZOOM_LIMITS,
  addOrthophoto,
  lockCamera,
} from "../../data/reliefMaps";

const ZONES = zonesMap.zones;
const STAGE_COUNT = ZONES.length + 1;
const INIT_CAMERA = { center: [11.362, 44.4975], zoom: 11.4 };
const OPEN_DURATION = 2600;
const OPEN_PULLBACK = 0.75;
// The small offset avoids sticky-boundary flicker at an exact zero crossing.
const PIN_AT = 0.04;
const OPEN_SPAN = 0.34;
// The iris must still open when scrolling stops exactly at the pin point.
const OPEN_FLOOR_MS = 1500;
const EXIT_FROM = 1.0;
const EXIT_TO = 0.38;
const MOBILE_EXIT_FROM = 1.42;
const MOBILE_EXIT_TO = 0.82;
const FLIGHT_DURATION = 2800;
const RETURN_DURATION = 2200;
const EASE_FLIGHT = (t) =>
  (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);
const MOBILE_LAYOUT_QUERY = "(max-width: 1279px)";

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOpen = (t) => 1 - ((1 - t) ** 2.4);
const smoothstep = (t) => t * t * (3 - 2 * t);

function closeMobileAttribution(container) {
  const attribution = container?.querySelector(".maplibregl-ctrl-attrib");
  if (!attribution) return false;

  attribution.classList.remove("maplibregl-compact-show");
  attribution.removeAttribute("open");
  return attribution.classList.contains("maplibregl-compact");
}

function closeMobileAttributionWhenReady(map, container) {
  if (closeMobileAttribution(container)) return;

  const syncClosedState = () => {
    if (!closeMobileAttribution(container)) return;
    map.off("styledata", syncClosedState);
    map.off("sourcedata", syncClosedState);
    map.off("idle", syncClosedState);
  };

  map.on("styledata", syncClosedState);
  map.on("sourcedata", syncClosedState);
  map.on("idle", syncClosedState);
  window.requestAnimationFrame(syncClosedState);
}

// Camera padding keeps the intervention circles clear of the text panel.
const FIT_PADDING = { top: 110, right: 580, bottom: 120, left: 90 };
const AREA_ZOOM_STOPS = [12, 14, 16, 18];
const METRES_PER_PIXEL_AT_ZOOM_ZERO = 156543.03392;
const METRES_PER_LATITUDE_DEGREE = 111320;
function radiusInPixels(radius, latitude, zoom) {
  const metresPerPixel =
    (METRES_PER_PIXEL_AT_ZOOM_ZERO * Math.cos((latitude * Math.PI) / 180)) /
    (2 ** zoom);
  return radius / metresPerPixel;
}

function areaFeature(zone) {
  const radii = Object.fromEntries(
    AREA_ZOOM_STOPS.map((zoom) => [
      `radius${zoom}`,
      radiusInPixels(zone.radius_m, zone.center[1], zoom),
    ]),
  );
  return {
    type: "Feature",
    id: zone.id,
    properties: { id: zone.id, ...radii },
    geometry: { type: "Point", coordinates: zone.center },
  };
}

function ZonesText({ segments }) {
  return segments.map((segment) =>
    segment.emphasis ? (
      <strong key={segment.id}>{segment.text}</strong>
    ) : (
      <Fragment key={segment.id}>{segment.text}</Fragment>
    ),
  );
}

const AREAS_FC = {
  type: "FeatureCollection",
  features: ZONES.map(areaFeature),
};
const ACTIVE = (attr) => ["case", ["boolean", ["feature-state", "active"], false], attr[0], attr[1]];
const ACTIVE_SCALE = ACTIVE([1, 0.72]);
const AREA_RADIUS = [
  "interpolate",
  ["exponential", 2],
  ["zoom"],
  ...AREA_ZOOM_STOPS.flatMap((zoom) => [
    zoom,
    ["*", ["get", `radius${zoom}`], ACTIVE_SCALE],
  ]),
];

function positionFocusMask(map, zone, element) {
  if (!map || !zone || !element) return;
  const point = map.project(zone.center);
  const radius = radiusInPixels(zone.radius_m, zone.center[1], map.getZoom());
  element.style.setProperty("--zones-focus-x", `${point.x}px`);
  element.style.setProperty("--zones-focus-y", `${point.y}px`);
  element.style.setProperty("--zones-focus-inner", `${Math.max(54, radius * 0.82)}px`);
  element.style.setProperty("--zones-focus-radius", `${Math.max(68, radius)}px`);
  element.style.setProperty("--zones-focus-outer", `${Math.max(104, radius * 1.34)}px`);
}

function cameraPadding() {
  if (!window.matchMedia(MOBILE_LAYOUT_QUERY).matches) return FIT_PADDING;
  const width = window.innerWidth;
  const height = window.innerHeight;
  const edge = width < 600 ? 18 : width < 900 ? 28 : 38;
  return {
    top: width < 600 ? 72 : 84,
    right: edge,
    bottom: width < 600 ? (height < 700 ? 176 : 208) : width < 900 ? 216 : 228,
    left: edge,
  };
}

function zoneBounds(zone) {
  const latitudeDelta = (zone.radius_m * 1.16) / METRES_PER_LATITUDE_DEGREE;
  const longitudeDelta = latitudeDelta / Math.cos((zone.center[1] * Math.PI) / 180);
  return [
    [zone.center[0] - longitudeDelta, zone.center[1] - latitudeDelta],
    [zone.center[0] + longitudeDelta, zone.center[1] + latitudeDelta],
  ];
}

function warmOpeningCamera(map) {
  const padding = cameraPadding();
  map.fitBounds(zonesMap.intro.bounds, { padding, duration: 0 });
  const target = map.cameraForBounds(zonesMap.intro.bounds, { padding });
  if (!target) return;
  map.jumpTo({
    center: target.center,
    zoom: Math.max(target.zoom - OPEN_PULLBACK, EXPLORE_ZOOM_LIMITS.minZoom),
  });
}

export function ZonesMapScene() {
  const { content, locale, uiContent } = useContent();
  const zonesContent = content.talea.zones;
  const localizedZones = useMemo(() => {
    const zoneCopyById = new Map(
      zonesContent.areas.map((zone) => [zone.zoneId, zone]),
    );
    return ZONES.map((zone) => ({
      ...zone,
      ...zoneCopyById.get(zone.id),
    }));
  }, [zonesContent]);
  const sectionRef = useRef(null);
  const containerRef = useRef(null);
  const focusMaskRef = useRef(null);
  const mapRef = useRef(null);
  const stepsRef = useRef([]);
  const flownRef = useRef(false);
  const openedRef = useRef(false);
  const activeZoneRef = useRef(null);
  const driftGenerationRef = useRef(0);
  const driftMoveEndRef = useRef(null);
  const openStartRef = useRef(0);
  const mobileCameraTouchedRef = useRef(false);
  const lastAppliedStageRef = useRef(null);
  const mapLibreLocaleRef = useRef({});

  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [stage, setStage] = useState(0);
  const [engaged, setEngaged] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = (event) => setReduceMotion(event.matches);
    media.addEventListener?.("change", updatePreference);
    return () => media.removeEventListener?.("change", updatePreference);
  }, []);

  useEffect(() => {
    const mapLocale = {
      "AttributionControl.ToggleAttribution": uiContent.map.toggleAttribution,
      "Map.Title": uiContent.map.title,
      "CooperativeGesturesHandler.WindowsHelpText":
        uiContent.map.cooperativeGestures.windows,
      "CooperativeGesturesHandler.MacHelpText":
        uiContent.map.cooperativeGestures.mac,
      "CooperativeGesturesHandler.MobileHelpText":
        uiContent.map.cooperativeGestures.mobile,
    };
    mapLibreLocaleRef.current = mapLocale;

    const map = mapRef.current;
    if (!map) return;
    map._locale = { ...map._locale, ...mapLocale };
    map.getCanvas()?.setAttribute("aria-label", mapLocale["Map.Title"]);
    const attributionButton = containerRef.current?.querySelector(
      ".maplibregl-ctrl-attrib-button",
    );
    if (attributionButton) {
      const label = mapLocale["AttributionControl.ToggleAttribution"];
      attributionButton.setAttribute("aria-label", label);
      attributionButton.setAttribute("title", label);
    }
  }, [uiContent]);

  const applyStage = useCallback((s, animate, opening = false) => {
    const map = mapRef.current;
    if (!map) return;
    const mobileLayout = window.matchMedia(MOBILE_LAYOUT_QUERY).matches;
    if (lastAppliedStageRef.current !== s) {
      lastAppliedStageRef.current = s;
      mobileCameraTouchedRef.current = false;
    }

    driftGenerationRef.current += 1;
    const generation = driftGenerationRef.current;
    if (driftMoveEndRef.current) {
      map.off("moveend", driftMoveEndRef.current);
      driftMoveEndRef.current = null;
    }
    map.stop();

    const zone = s >= 1 ? ZONES[s - 1] : null;
    activeZoneRef.current = zone;
    if (map.getSource("areas-src")) {
      ZONES.forEach((z) => {
        map.setFeatureState(
          { source: "areas-src", id: z.id },
          { active: z.id === zone?.id },
        );
      });
    }
    positionFocusMask(map, zone, focusMaskRef.current);

    if (s === 0) {
      map.fitBounds(zonesMap.intro.bounds, {
        padding: cameraPadding(),
        duration: reduceMotion
          ? 0
          : opening
            ? OPEN_DURATION
            : animate
              ? RETURN_DURATION
              : 0,
        easing: opening
          ? (t) => 1 - ((1 - t) ** 5)
          : EASE_FLIGHT,
        essential: !reduceMotion,
      });
      return;
    }

    const startDrift = (direction = 1) => {
      if (
        mobileLayout ||
        reduceMotion ||
        driftGenerationRef.current !== generation ||
        mobileCameraTouchedRef.current
      ) return;
      const onDriftEnd = () => {
        driftMoveEndRef.current = null;
        startDrift(direction * -1);
      };
      driftMoveEndRef.current = onDriftEnd;
      map.once("moveend", onDriftEnd);
      map.easeTo({
        center: [
          zone.center[0] + (0.00052 * direction),
          zone.center[1] + (0.00016 * direction),
        ],
        ...(mobileLayout ? {} : { zoom: zone.zoom }),
        duration: 14000,
        easing: (t) => t,
        essential: true,
      });
    };

    if (!animate || reduceMotion) {
      if (mobileLayout) {
        map.fitBounds(zoneBounds(zone), {
          padding: cameraPadding(),
          maxZoom: zone.zoom,
          duration: 0,
          essential: !reduceMotion,
        });
        startDrift();
        return;
      }
      map.flyTo({
        center: zone.center,
        zoom: zone.zoom,
        duration: 0,
        padding: cameraPadding(),
        essential: true,
      });
      startDrift();
      return;
    }

    const onFlightEnd = () => {
      driftMoveEndRef.current = null;
      startDrift();
    };
    driftMoveEndRef.current = onFlightEnd;
    map.once("moveend", onFlightEnd);
    if (mobileLayout) {
      map.fitBounds(zoneBounds(zone), {
        padding: cameraPadding(),
        maxZoom: zone.zoom,
        duration: FLIGHT_DURATION,
        easing: EASE_FLIGHT,
        essential: !reduceMotion,
      });
      return;
    }
    map.flyTo({
      center: zone.center,
      zoom: zone.zoom,
      padding: cameraPadding(),
      curve: 1.6,
      duration: FLIGHT_DURATION,
      easing: EASE_FLIGHT,
      essential: true,
    });
  }, [reduceMotion]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return undefined;

    const init = () => {
      if (mapRef.current || !containerRef.current) return;
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: BASEMAP_STYLE,
        center: INIT_CAMERA.center,
        zoom: INIT_CAMERA.zoom,
        minZoom: EXPLORE_ZOOM_LIMITS.minZoom,
        maxZoom: EXPLORE_ZOOM_LIMITS.maxZoom,
        attributionControl: false,
        locale: mapLibreLocaleRef.current,
      });
      mapRef.current = map;
      lockCamera(map);
      const mobileMap = window.matchMedia(MOBILE_LAYOUT_QUERY).matches;
      map.on("render", () => {
        positionFocusMask(map, activeZoneRef.current, focusMaskRef.current);
      });
      const markMobileCameraTouched = (event) => {
        if (
          window.matchMedia(MOBILE_LAYOUT_QUERY).matches &&
          event.originalEvent
        ) {
          mobileCameraTouchedRef.current = true;
        }
      };
      map.on("dragstart", markMobileCameraTouched);
      map.on("zoomstart", markMobileCameraTouched);

      map.on("load", () => {
        try {
          addOrthophoto(map);
          map.addControl(
            new maplibregl.AttributionControl({ compact: true }),
            "bottom-right",
          );
          map.addControl(
            new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }),
            "bottom-right",
          );
          if (mobileMap) {
            closeMobileAttributionWhenReady(map, containerRef.current);
          }
          map.addSource("areas-src", { type: "geojson", data: AREAS_FC });

          map.addLayer({
            id: "areas-circle",
            type: "circle",
            source: "areas-src",
            paint: {
              "circle-radius": AREA_RADIUS,
              "circle-radius-transition": {
                duration: 700,
                delay: 0,
              },
              "circle-color": "#1f9d47",
              "circle-opacity": ACTIVE([0.18, 0.12]),
              "circle-opacity-transition": {
                duration: 450,
                delay: 0,
              },
              "circle-stroke-color": "#FFE604",
              "circle-stroke-width": ACTIVE([2, 1.4]),
              "circle-stroke-opacity": ACTIVE([1, 0.62]),
            },
          });
          warmOpeningCamera(map);
          setReady(true);
        } catch (err) {
          console.warn(err);
          setFailed(true);
        }
      });
    };

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            init();
            window.setTimeout(() => mapRef.current?.resize(), 250);
          }
        });
      },
      { threshold: 0.02 },
    );
    io.observe(section);
    return () => {
      io.disconnect();
      driftGenerationRef.current += 1;
      if (mapRef.current && driftMoveEndRef.current) {
        mapRef.current.off("moveend", driftMoveEndRef.current);
      }
      mapRef.current?.stop();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;

    if (!openedRef.current) {
      if (!engaged) return;
      openedRef.current = true;
      flownRef.current = true;
      applyStage(stage, true, true);
      return;
    }

    if (!engaged && flownRef.current) return;
    applyStage(stage, flownRef.current);
    flownRef.current = true;
  }, [stage, ready, engaged, applyStage]);

  useEffect(() => {
    if (!ready || engaged) return;
    const map = mapRef.current;
    if (!map) return;
    driftGenerationRef.current += 1;
    if (driftMoveEndRef.current) {
      map.off("moveend", driftMoveEndRef.current);
      driftMoveEndRef.current = null;
    }
    map.stop();
  }, [ready, engaged]);

  useEffect(() => {
    let frame = null;
    const update = () => {
      frame = null;
      const vh = window.innerHeight || 768;
      const readingLine = vh * 0.55;
      const steps = stepsRef.current.filter(Boolean);

      let next = 0;
      let min = Infinity;
      steps.forEach((el, idx) => {
        const rect = el.getBoundingClientRect();
        const center = rect.top + rect.height * 0.5;
        if (rect.bottom > 0 && rect.top < vh && Math.abs(center - readingLine) < min) {
          min = Math.abs(center - readingLine);
          next = idx;
        }
      });
      const last = steps.at(-1)?.getBoundingClientRect();
      if (min === Infinity && last && last.bottom < readingLine) next = STAGE_COUNT - 1;
      setStage(next);

      const section = sectionRef.current;
      const rect = section?.getBoundingClientRect();
      if (!rect) return;
      const inScene = rect.top < vh && rect.bottom > 0;
      const mobileLayout = window.matchMedia(MOBILE_LAYOUT_QUERY).matches;
      const exitFrom = mobileLayout ? MOBILE_EXIT_FROM : EXIT_FROM;
      const exitTo = mobileLayout ? MOBILE_EXIT_TO : EXIT_TO;

      const exitProgress = smoothstep(
        clamp01((vh * exitFrom - rect.bottom) / (vh * (exitFrom - exitTo))),
      );
      section.style.setProperty("--map-exit", exitProgress.toFixed(3));
      const nextExiting = inScene && rect.bottom <= vh * exitFrom;

      const pinned = inScene && rect.top <= vh * PIN_AT;
      if (!pinned) openStartRef.current = 0;
      else if (!openStartRef.current) openStartRef.current = performance.now();
      const byScroll = clamp01((vh * PIN_AT - rect.top) / (vh * OPEN_SPAN));
      const byTime = openStartRef.current
        ? clamp01((performance.now() - openStartRef.current) / OPEN_FLOOR_MS)
        : 0;
      section.style.setProperty(
        "--zones-open",
        easeOpen(Math.max(byScroll, byTime)).toFixed(3),
      );

      setEngaged(pinned && !nextExiting);
      setExiting(nextExiting);
      if (openStartRef.current && byTime < 1) request();
    };
    const request = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", request);
      window.removeEventListener("resize", request);
    };
  }, []);

  const activeZone = stage >= 1 ? ZONES[stage - 1] : null;
  const activeZoneContent = stage >= 1 ? localizedZones[stage - 1] : null;
  const stepStatus = uiContent.localStory.stepLabelTemplate
    .replace("{current}", String(stage + 1))
    .replace("{total}", String(STAGE_COUNT));

  return (
    <section
      ref={sectionRef}
      className="relief-map-section zones-scene"
      aria-label={zonesContent.ariaLabel}
      lang={locale}
    >
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {stepStatus}
      </p>
      <div className="relief-map-sticky">
        <div ref={containerRef} className="map-canvas relief-map-canvas" aria-hidden="true" />
        <div className="relief-map-scrim" aria-hidden="true" />
        <div
          ref={focusMaskRef}
          className={`zones-focus-mask${activeZone ? " zones-focus-mask--active" : ""}`}
          aria-hidden="true"
        />
        <div className="relief-map-veil" aria-hidden="true" />
        <div className="relief-map-veil-exit" aria-hidden="true" />
        <div
          className={`zones-key${engaged ? " zones-key--ready" : ""}${
            exiting ? " zones-key--gone" : ""
          }`}
          aria-hidden="true"
        >
          <span className="zones-swatch zones-swatch--area" />
          {zonesContent.legend.area}
        </div>

        <div
          className={`zones-caption${engaged ? " zones-caption--ready" : ""}${
            exiting ? " zones-caption--gone" : ""
          }`}
        >
          {activeZoneContent ? (
            <>
              <h3 className="zones-caption-title">{activeZoneContent.name}</h3>
              <p className="zones-caption-text"><ZonesText segments={activeZoneContent.body} /></p>
            </>
          ) : (
            <>
              <h3 className="zones-caption-title">{zonesContent.intro.title}</h3>
              <p className="zones-caption-text"><ZonesText segments={zonesContent.intro.body} /></p>
            </>
          )}
          <div className="zones-progress" aria-hidden="true">
            {Array.from({ length: STAGE_COUNT }).map((_, i) => (
              <span key={i} className={`zones-dot${i === stage ? " zones-dot--on" : ""}`} />
            ))}
          </div>
          {failed && (
            <p className="relief-map-note relief-map-note--error">
              {zonesContent.loadError}
            </p>
          )}
        </div>
      </div>

      <div className="zones-steps" aria-hidden="true">
        {Array.from({ length: STAGE_COUNT }).map((_, i) => (
          <div
            key={i}
            ref={(el) => {
              stepsRef.current[i] = el;
            }}
            className="zones-step"
          />
        ))}
        <div className="zones-tail" />
      </div>
    </section>
  );
}

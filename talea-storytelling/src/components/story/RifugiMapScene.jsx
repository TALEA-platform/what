import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { rifugiCounts } from "../../data/climateRelief";
import { loadReliefSources } from "../../data/reliefData";
import { editorialLinks, useContent } from "../../content";
import { SearchSuggest } from "../ui/SearchSuggest";
import {
  createIPhoneRifugiMap,
  createIPhoneRifugiMarker,
  createIPhoneRifugiPopup,
} from "../maps/IPhoneRifugiMap";
import {
  createMapResizeController,
  isMapSizeSynchronized,
} from "../../lib/mapResize";
import {
  logPerformanceEvent,
  registerMapPerformance,
} from "../../lib/mapPerformance";
import { runtimeProfile } from "../../lib/runtimeProfile";
import {
  ADDRESS_ZOOM,
  BASEMAP_STYLE,
  EXPLORE_ZOOM_LIMITS,
  RELIEF_STORY_CAMERA,
  addBolognaBoundary,
  addOrthophoto,
  addRifugiFocusLayers,
  addRifugiHoverLayers,
  addRifugiLayers,
  addUfficialeFocusLayer,
  addUfficialiLayers,
  addWalkingRouteLayers,
  boundsForFeatures,
  countRifugi,
  fadeInPaint,
  featureCenter,
  findWalkingReliefs,
  flyToFeatures,
  flyToPoint,
  flyToWalkingRoutes,
  frameOverview,
  fullRifugiFor,
  geocodeBologna,
  loadRifugiData,
  loadRifugiUfficiali,
  lockCamera,
  nearbyCardHTML,
  popupRifugioHTML,
  popupUfficialeHTML,
  rifugiDetailHTML,
  rifugiHoverKey,
  runRifugiWave,
  setOverviewFrame,
  setRifugiFocus,
  setRifugiHover,
  setUfficialeFocus,
  setWalkingRoutes,
  ufficialeDetailHTML,
  withUfficialiLabels,
  withWaveOrder,
} from "../../data/reliefMaps";

const FILL_OPACITY = 0.62;
const EMPTY_FEATURE_COLLECTION = { type: "FeatureCollection", features: [] };

const REVEAL_AT = 0.18;
const EXIT_FROM = 0.94;
const EXIT_TO = 0.28;
const MOBILE_MAP_QUERY = "(max-width: 1279px)";
const MOBILE_GESTURE_HINT_MS = 4800;

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

const mobileOverviewPadding = () => {
  const width = window.innerWidth || 390;
  if (width < 600) return { top: 72, right: 24, bottom: 72, left: 24 };
  if (width < 900) return { top: 84, right: 48, bottom: 84, left: 48 };
  return { top: 88, right: 68, bottom: 88, left: 68 };
};

const mobileDetailPadding = (mapElement, dockElement) => {
  const width = window.innerWidth || 390;
  const narrow = width < 600;
  const mapRect = mapElement?.getBoundingClientRect();
  const dockRect = dockElement?.getBoundingClientRect();
  const height = mapRect?.height || window.innerHeight || 844;
  const top = narrow ? 84 : 96;
  const measuredBottom =
    mapRect && dockRect && dockRect.height > 0
      ? mapRect.bottom - dockRect.top + 24
      : narrow
        ? 280
        : 300;
  const maxBottom = Math.max(180, height - top - 140);
  return {
    top,
    right: narrow ? 24 : 48,
    bottom: Math.round(Math.min(maxBottom, Math.max(narrow ? 210 : 230, measuredBottom))),
    left: narrow ? 24 : 48,
  };
};

const mobileFocusFitPadding = () => (window.innerWidth < 600 ? 36 : 56);
const MOBILE_FOCUS_MIN_ZOOM = 14.2;
const MOBILE_FOCUS_MAX_ZOOM = 15.8;

const boundsForWalkingSearch = (point, routes) => {
  const bounds = new maplibregl.LngLatBounds();
  if (point) bounds.extend(point);
  for (const route of routes || []) {
    for (const coordinate of route.coordinates || []) bounds.extend(coordinate);
  }
  return bounds;
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (t) => t * t * (3 - 2 * t);

export function RifugiMapScene() {
  const { content, locale, uiContent } = useContent();
  const reliefMapContent = content.climateRelief.refuges.map;
  const reliefCards = reliefMapContent.cards;
  const sectionRef = useRef(null);
  const containerRef = useRef(null);
  const dockRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const markerRef = useRef(null);
  const hoverKeyRef = useRef(null);
  const focusedRef = useRef(false);
  const readyRef = useRef(false);
  const cancelWaveRef = useRef(null);
  const sceneEngagedRef = useRef(false);
  const revealStartedRef = useRef(false);
  const revealTargetsRef = useRef(null);
  const controlsReadyTimerRef = useRef(null);
  const routeAbortRef = useRef(null);
  const detailOpenRef = useRef(false);
  const selectedKeyRef = useRef(null);
  const focusAtRef = useRef(0);
  const lastScrollRef = useRef(0);
  const scrollAnchorRef = useRef(0);
  const scrollResetUntilRef = useRef(0);
  const reliefCardsRef = useRef(reliefCards);
  const localeRef = useRef(locale);
  const detailRefreshRef = useRef(null);
  const popupRefreshRef = useRef(null);
  const mobileMapRef = useRef(false);
  const cameraTouchedRef = useRef(false);
  const mapLibreLocaleRef = useRef({});
  const mobileCameraFrameRef = useRef(null);
  const pendingMobileCameraRef = useRef(null);
  const searchResultFocusRef = useRef(false);
  const mobileSearchCameraRef = useRef(null);
  const mapGestureActiveRef = useRef(false);
  const mapGestureGraceUntilRef = useRef(0);
  const mobileGestureHintShownRef = useRef(false);
  const pointSelectionTimerRef = useRef(null);
  const entryResizeTimerRef = useRef(null);
  const resizeControllerRef = useRef(null);
  const unregisterPerformanceRef = useRef(null);
  const cameraResizePendingRef = useRef(false);
  const requestMapResizeUpdateRef = useRef(null);
  const readyWaitersRef = useRef(new Set());

  const [revealed, setRevealed] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [csiUnavailable, setCsiUnavailable] = useState(false);
  const [focused, setFocused] = useState(false);
  const [controlsReady, setControlsReady] = useState(false);
  const [detail, setDetail] = useState("");
  const [messageKey, setMessageKey] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [mobileGestureHintVisible, setMobileGestureHintVisible] = useState(false);
  const message = messageKey ? reliefMapContent.search[messageKey] : "";

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
      const attributionLabel = mapLocale["AttributionControl.ToggleAttribution"];
      attributionButton.setAttribute("aria-label", attributionLabel);
      attributionButton.setAttribute("title", attributionLabel);
    }
  }, [uiContent]);

  useEffect(() => {
    reliefCardsRef.current = reliefCards;
    localeRef.current = locale;
  }, [locale, reliefCards]);

  useEffect(() => {
    const mapElement = containerRef.current;
    if (
      !controlsReady ||
      !engaged ||
      !mobileMapRef.current ||
      !mapElement ||
      mobileGestureHintShownRef.current
    ) {
      return undefined;
    }

    mobileGestureHintShownRef.current = true;
    setMobileGestureHintVisible(true);
    const dismissHint = () => setMobileGestureHintVisible(false);
    const timer = window.setTimeout(dismissHint, MOBILE_GESTURE_HINT_MS);
    mapElement.addEventListener("touchstart", dismissHint, {
      passive: true,
      once: true,
    });

    return () => {
      window.clearTimeout(timer);
      mapElement.removeEventListener("touchstart", dismissHint);
      setMobileGestureHintVisible(false);
    };
  }, [controlsReady, engaged]);

  useEffect(() => {
    const detailHtml = detailRefreshRef.current?.();
    if (detailHtml) setDetail(detailHtml);
    const popupHtml = popupRefreshRef.current?.();
    if (popupHtml) popupRef.current?.setHTML(popupHtml);
  }, [locale]);

  useEffect(() => {
    const progress = document.querySelector(".scroll-stem");
    if (!progress) return undefined;
    const closeMapPanels = () => {
      if (!progress.classList.contains("scroll-stem--mobile-open")) return;
      setSearchOpen(false);
      setInfoOpen(false);
    };
    const observer = new MutationObserver(closeMapPanels);
    observer.observe(progress, { attributes: true, attributeFilter: ["class"] });
    closeMapPanels();
    return () => observer.disconnect();
  }, []);

  const sceneTop = useCallback(() => {
    const section = sectionRef.current;
    if (!section) return window.scrollY;
    return Math.max(0, window.scrollY + section.getBoundingClientRect().top);
  }, []);

  const holdScrollAtSceneTop = useCallback(() => {
    const anchor = Math.round(sceneTop());
    scrollAnchorRef.current = anchor;
    scrollResetUntilRef.current = performance.now() + 900;
    lastScrollRef.current = anchor;
    window.scrollTo({ top: anchor, behavior: "auto" });
  }, [sceneTop]);

  const isFullScreen = useCallback(() => {
    const section = sectionRef.current;
    if (!section) return true;
    const r = section.getBoundingClientRect();
    const vh = window.innerHeight || 768;
    return r.top <= 2 && r.bottom >= vh - 2;
  }, []);

  const setSearchMarker = useCallback((pt) => {
    markerRef.current?.remove();
    markerRef.current = null;
    if (pt && mapRef.current) {
      const marker = runtimeProfile.useIOSCanvasMaps
        ? createIPhoneRifugiMarker({ color: "#FFE604" })
        : new maplibregl.Marker({ color: "#FFE604" });
      markerRef.current = marker.setLngLat(pt).addTo(mapRef.current);
    }
  }, []);

  const enterFocus = useCallback(() => {
    scrollAnchorRef.current = Math.round(sceneTop());
    focusedRef.current = true;
    focusAtRef.current = performance.now();
    setFocused(true);
  }, [sceneTop]);

  const clearHighlights = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    setRifugiFocus(map, "main", [], reliefCardsRef.current.green.fallbackName);
    setRifugiHover(map, "main", null);
    setUfficialeFocus(map, "main", null);
    setWalkingRoutes(map, "main", []);
  }, []);

  const cancelRouting = useCallback(() => {
    routeAbortRef.current?.abort();
    routeAbortRef.current = null;
  }, []);

  const cancelPendingPointSelection = useCallback(() => {
    if (pointSelectionTimerRef.current) {
      window.clearTimeout(pointSelectionTimerRef.current);
      pointSelectionTimerRef.current = null;
    }
  }, []);

  const cancelMobileCamera = useCallback(() => {
    if (mobileCameraFrameRef.current) {
      cancelAnimationFrame(mobileCameraFrameRef.current);
      mobileCameraFrameRef.current = null;
    }
    pendingMobileCameraRef.current = null;
  }, []);

  const scheduleMobileCamera = useCallback((request) => {
    if (!mobileMapRef.current) return false;
    if (mobileCameraFrameRef.current) {
      cancelAnimationFrame(mobileCameraFrameRef.current);
    }
    pendingMobileCameraRef.current = request;
    mobileCameraFrameRef.current = requestAnimationFrame(() => {
      mobileCameraFrameRef.current = null;
      const pending = pendingMobileCameraRef.current;
      pendingMobileCameraRef.current = null;
      const map = mapRef.current;
      if (!pending || !map) return;

      const padding = mobileDetailPadding(containerRef.current, dockRef.current);
      if (pending.type === "features") {
        const bounds = boundsForFeatures(pending.features);
        if (bounds.isEmpty()) return;
        const naturalCamera = map.cameraForBounds(bounds, {
          padding: mobileFocusFitPadding(),
          maxZoom: MOBILE_FOCUS_MAX_ZOOM,
        });
        map.flyTo({
          center: naturalCamera?.center || bounds.getCenter(),
          zoom: Math.max(
            MOBILE_FOCUS_MIN_ZOOM,
            Math.min(MOBILE_FOCUS_MAX_ZOOM, naturalCamera?.zoom ?? 15.2),
          ),
          padding,
          retainPadding: false,
          duration: 1400,
          essential: true,
        });
        return;
      }

      if (pending.type === "point") {
        map.flyTo({
          center: pending.center,
          zoom: pending.zoom,
          padding,
          retainPadding: false,
          duration: pending.duration,
          essential: true,
        });
        return;
      }

      const routeBounds = boundsForWalkingSearch(pending.point, pending.routes);
      if (routeBounds.isEmpty()) return;
      const naturalCamera = map.cameraForBounds(routeBounds, {
        padding: mobileFocusFitPadding(),
        maxZoom: ADDRESS_ZOOM,
      });
      const searchCamera = {
        center: naturalCamera?.center || routeBounds.getCenter(),
        zoom: Math.min(ADDRESS_ZOOM, naturalCamera?.zoom ?? ADDRESS_ZOOM),
      };
      mobileSearchCameraRef.current = searchCamera;
      map.flyTo({
        ...searchCamera,
        padding,
        retainPadding: false,
        duration: 1500,
        essential: true,
      });
    });
    return true;
  }, []);

  const focusUfficiale = useCallback(
    (feature) => {
      const map = mapRef.current;
      if (!feature || !map) return;
      cancelPendingPointSelection();
      cancelRouting();
      searchResultFocusRef.current = false;
      mobileSearchCameraRef.current = null;
      clearHighlights();
      setSearchMarker(null);
      detailOpenRef.current = true;
      selectedKeyRef.current = null;
      setUfficialeFocus(map, "main", feature);
      detailRefreshRef.current = () => ufficialeDetailHTML(feature, reliefCardsRef.current);
      setDetail(detailRefreshRef.current());
      setMessageKey(null);
      setSearchOpen(false);
      setInfoOpen(true);
      enterFocus();
      if (
        !scheduleMobileCamera({
          type: "point",
          center: feature.geometry.coordinates,
          zoom: 15.4,
          duration: 1400,
        })
      ) {
        map.flyTo({
          center: feature.geometry.coordinates,
          zoom: 15.4,
          duration: 1400,
          essential: true,
        });
      }
    },
    [
      cancelPendingPointSelection,
      cancelRouting,
      clearHighlights,
      enterFocus,
      scheduleMobileCamera,
      setSearchMarker,
    ],
  );

  const focusRifugio = useCallback(
    (feature) => {
      const map = mapRef.current;
      if (!feature || !map) return;
      cancelPendingPointSelection();
      cancelRouting();
      searchResultFocusRef.current = false;
      mobileSearchCameraRef.current = null;
      const full = fullRifugiFor(feature);
      const primary = full[0] || feature;
      clearHighlights();
      setSearchMarker(null);
      detailOpenRef.current = true;
      selectedKeyRef.current = rifugiHoverKey(primary);
      setRifugiFocus(map, "main", full, reliefCardsRef.current.green.fallbackName);
      detailRefreshRef.current = () =>
        rifugiDetailHTML(primary, reliefCardsRef.current, localeRef.current);
      setDetail(detailRefreshRef.current());
      setMessageKey(null);
      setSearchOpen(false);
      setInfoOpen(true);
      enterFocus();
      if (!scheduleMobileCamera({ type: "features", features: full })) {
        flyToFeatures(map, full, { maxZoom: 16, padding: 120 });
      }
    },
    [
      cancelPendingPointSelection,
      cancelRouting,
      clearHighlights,
      enterFocus,
      scheduleMobileCamera,
      setSearchMarker,
    ],
  );

  const zoomIntoPoint = useCallback(
    (pt) => {
      const map = mapRef.current;
      if (!map) return;
      cancelPendingPointSelection();
      cancelMobileCamera();
      cancelRouting();
      searchResultFocusRef.current = false;
      mobileSearchCameraRef.current = null;
      clearHighlights();
      if (mobileMapRef.current) setSearchMarker(null);
      detailOpenRef.current = false;
      selectedKeyRef.current = null;
      detailRefreshRef.current = null;
      setDetail("");
      setInfoOpen(false);
      enterFocus();
      const z = Math.min(map.getZoom() + 1.6, EXPLORE_ZOOM_LIMITS.maxZoom - 0.4);
      map.flyTo({ center: pt, zoom: z, duration: 900, essential: true });
    },
    [
      cancelMobileCamera,
      cancelPendingPointSelection,
      cancelRouting,
      clearHighlights,
      enterFocus,
      setSearchMarker,
    ],
  );

  const focusPoint = useCallback(
    async (pt, label) => {
      const map = mapRef.current;
      if (!map) return;
      cancelPendingPointSelection();
      cancelRouting();
      searchResultFocusRef.current = false;
      mobileSearchCameraRef.current = null;
      const controller = new AbortController();
      routeAbortRef.current = controller;
      clearHighlights();
      detailOpenRef.current = false;
      selectedKeyRef.current = null;
      detailRefreshRef.current = null;
      setSearchMarker(pt);
      setDetail("");
      setMessageKey("routeLoading");
      enterFocus();
      flyToPoint(map, pt, { zoom: ADDRESS_ZOOM });
      try {
        const { ufficiale, verdi, routes } = await findWalkingReliefs(pt, {
          greenCount: 2,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (ufficiale) setUfficialeFocus(map, "main", ufficiale.f);
        if (verdi.length) {
          setRifugiFocus(
            map,
            "main",
            verdi.flatMap((item) => fullRifugiFor(item.f)),
            reliefCardsRef.current.green.fallbackName,
          );
        }
        setWalkingRoutes(map, "main", routes);
        detailRefreshRef.current = () =>
          nearbyCardHTML({
            label,
            ufficiale,
            verdi,
            copy: reliefCardsRef.current,
            locale: localeRef.current,
          });
        setDetail(detailRefreshRef.current());
        setMessageKey(null);
        setSearchOpen(false);
        setInfoOpen(true);
        searchResultFocusRef.current = true;
        if (!scheduleMobileCamera({ type: "routes", point: pt, routes })) {
          flyToWalkingRoutes(map, pt, routes);
        }
      } catch (error) {
        if (error?.name !== "AbortError") {
          setMessageKey("routeError");
        }
      } finally {
        if (routeAbortRef.current === controller) routeAbortRef.current = null;
      }
    },
    [
      cancelPendingPointSelection,
      cancelRouting,
      clearHighlights,
      enterFocus,
      scheduleMobileCamera,
      setSearchMarker,
    ],
  );

  const dezoomToOverview = useCallback(
    (opts = {}) => {
      const map = mapRef.current;
      if (!map) return;
      cancelPendingPointSelection();
      cancelMobileCamera();
      cancelRouting();
      focusedRef.current = false;
      mapGestureActiveRef.current = false;
      mapGestureGraceUntilRef.current = 0;
      searchResultFocusRef.current = false;
      mobileSearchCameraRef.current = null;
      detailOpenRef.current = false;
      selectedKeyRef.current = null;
      hoverKeyRef.current = null;
      detailRefreshRef.current = null;
      setFocused(false);
      setDetail("");
      setMessageKey(null);
      setSearchOpen(false);
      setInfoOpen(false);
      setSearchMarker(null);
      clearHighlights();
      cameraTouchedRef.current = false;
      frameOverview(map, 1200, { resetPadding: mobileMapRef.current });
      if (opts.consumeScroll) holdScrollAtSceneTop();
    },
    [
      cancelMobileCamera,
      cancelPendingPointSelection,
      cancelRouting,
      clearHighlights,
      holdScrollAtSceneTop,
      setSearchMarker,
    ],
  );

  const waitForReady = useCallback(
    () => {
      if (readyRef.current) return Promise.resolve(true);
      return new Promise((resolve) => readyWaitersRef.current.add(resolve));
    },
    [],
  );

  const scrollSceneIntoView = useCallback(() => {
    sectionRef.current?.scrollIntoView({ behavior: "instant", block: "start" });
  }, []);

  const runSearch = useCallback(
    async (rawQuery) => {
      const q = String(rawQuery || "").trim();
      if (!q) return;
      scrollSceneIntoView();
      if (!(await waitForReady())) return;
      setMessageKey("searching");
      try {
        const hit = await geocodeBologna(q);
        if (hit) {
          await focusPoint(hit.pt, hit.label);
        } else {
          setMessageKey("empty");
        }
      } catch {
        setMessageKey("empty");
      }
    },
    [focusPoint, scrollSceneIntoView, waitForReady],
  );

  const applyPick = useCallback(
    async (item) => {
      if (!item?.pt) return;
      scrollSceneIntoView();
      if (!(await waitForReady())) return;
      if (item.type === "ufficiale" && item.feature) {
        focusUfficiale(item.feature);
        return;
      }
      if (item.type === "rifugio" && item.feature) {
        focusRifugio(item.feature);
        return;
      }
      await focusPoint(item.pt, item.label);
    },
    [
      focusPoint,
      focusRifugio,
      focusUfficiale,
      scrollSceneIntoView,
      waitForReady,
    ],
  );

  const startNetworkReveal = useCallback(() => {
    const map = mapRef.current;
    const targets = revealTargetsRef.current;
    if (!map || !targets || !readyRef.current || !sceneEngagedRef.current || revealStartedRef.current) return;

    revealStartedRef.current = true;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

    if (reducedMotion) {
      map.setPaintProperty("main-rifugi-fill", "fill-opacity", FILL_OPACITY);
      map.setPaintProperty("main-rifugi-line", "line-opacity", 0.9);
      map.setPaintProperty("main-rifugi-line-casing", "line-opacity", 0.85);
      map.setPaintProperty("main-ufficiali-halo", "circle-opacity", targets.officialHalo);
      map.setPaintProperty("main-ufficiali-dot", "circle-opacity", targets.officialDot);
      map.setPaintProperty("main-ufficiali-dot", "circle-stroke-opacity", targets.officialStroke);
      setControlsReady(true);
      return;
    }

    cancelWaveRef.current = runRifugiWave(map, "main-rifugi-fill", FILL_OPACITY);
    fadeInPaint(map, "main-rifugi-line", "line-opacity", 0.9, 700, 1150);
    fadeInPaint(map, "main-rifugi-line-casing", "line-opacity", 0.85, 700, 1150);
    fadeInPaint(map, "main-ufficiali-halo", "circle-opacity", targets.officialHalo, 620, 1550);
    fadeInPaint(map, "main-ufficiali-dot", "circle-opacity", targets.officialDot, 620, 1620);
    fadeInPaint(map, "main-ufficiali-dot", "circle-stroke-opacity", targets.officialStroke, 620, 1620);

    controlsReadyTimerRef.current = window.setTimeout(() => {
      controlsReadyTimerRef.current = null;
      setControlsReady(true);
    }, 1760);
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return undefined;
    const readyWaiters = readyWaitersRef.current;

    const init = () => {
      if (mapRef.current || !containerRef.current) return;
      const mobileMap =
        runtimeProfile.forceIPhoneLayout ||
        window.matchMedia(MOBILE_MAP_QUERY).matches;
      mobileMapRef.current = mobileMap;
      cameraTouchedRef.current = false;
      logPerformanceEvent("rifugi:init-start", { section: "Mappa Rifugi" });
      logPerformanceEvent("map:constructor", { mapName: "Rifugi" });
      const map = runtimeProfile.useIOSCanvasMaps
        ? createIPhoneRifugiMap({
            container: containerRef.current,
            center: RELIEF_STORY_CAMERA.center,
            zoom: RELIEF_STORY_CAMERA.zoom,
            minZoom: EXPLORE_ZOOM_LIMITS.minZoom,
            maxZoom: EXPLORE_ZOOM_LIMITS.maxZoom,
            locale: mapLibreLocaleRef.current,
          })
        : new maplibregl.Map({
            container: containerRef.current,
            style: BASEMAP_STYLE,
            center: RELIEF_STORY_CAMERA.center,
            zoom: RELIEF_STORY_CAMERA.zoom,
            minZoom: EXPLORE_ZOOM_LIMITS.minZoom,
            maxZoom: EXPLORE_ZOOM_LIMITS.maxZoom,
            attributionControl: false,
            cooperativeGestures: mobileMap,
            locale: mapLibreLocaleRef.current,
          });
      const resizeController = createMapResizeController(map);
      resizeControllerRef.current = resizeController;
      unregisterPerformanceRef.current = runtimeProfile.useIOSCanvasMaps
        ? null
        : registerMapPerformance(map, "Rifugi");
      mapRef.current = map;
      lockCamera(map);
      map.on("resize", () => requestMapResizeUpdateRef.current?.());
      if (mobileMap) {
        map.dragPan.enable();
        map.touchZoomRotate.enable();
        map.touchZoomRotate.disableRotation();
      }
      const markCameraTouched = (event) => {
        if (event?.originalEvent) cameraTouchedRef.current = true;
      };
      const markMapGesture = (event) => {
        markCameraTouched(event);
        if (!mobileMap || !event?.originalEvent) return;
        mapGestureActiveRef.current = true;
        mapGestureGraceUntilRef.current = Number.POSITIVE_INFINITY;
      };
      const finishMapGesture = () => {
        if (!mapGestureActiveRef.current) return;
        mapGestureActiveRef.current = false;
        mapGestureGraceUntilRef.current = performance.now() + 650;
      };
      map.on("dragstart", markMapGesture);
      map.on("dragend", finishMapGesture);
      map.on("zoomstart", markMapGesture);
      map.on("zoomend", finishMapGesture);

      map.on("load", async () => {
        logPerformanceEvent("rifugi:map-load", { section: "Mappa Rifugi" });
        addOrthophoto(map, { damped: true });
        if (!runtimeProfile.useIOSCanvasMaps) {
          map.addControl(
            new maplibregl.AttributionControl({ compact: true }),
            "bottom-right",
          );
          map.addControl(
            new maplibregl.ScaleControl({ maxWidth: 110, unit: "metric" }),
            "bottom-right",
          );
        }
        if (mobileMap && !runtimeProfile.useIOSCanvasMaps) {
          closeMobileAttributionWhenReady(map, containerRef.current);
        }
        addBolognaBoundary(map, "main", { color: "rgba(255,255,255,.72)", glowOpacity: 0.28, opacity: 0.7 });
        try {
          const sources = await loadReliefSources(loadRifugiData, loadRifugiUfficiali);
          if (!sources.official) {
            throw sources.errors.official || new Error("rifugi ufficiali non disponibili");
          }

          const parks = sources.csi || EMPTY_FEATURE_COLLECTION;
          const ufficiali = sources.official;
          if (sources.errors.csi) {
            console.warn("csi.geojson non disponibile; i rifugi ufficiali restano attivi", sources.errors.csi);
            setCsiUnavailable(true);
            setFailed(true);
          }

          const realGreen = sources.csi ? countRifugi(parks) : null;
          const realOfficial = (ufficiali.features || []).length;
          if (
            (realGreen !== null && realGreen !== rifugiCounts.compatible) ||
            realOfficial !== rifugiCounts.official
          ) {
            console.warn(
              `[rifugi] il contatore non corrisponde ai dati: ufficiali ${realOfficial} (attesi ${rifugiCounts.official}), ` +
                `selezionati ${realGreen ?? "non disponibili"} (attesi ${rifugiCounts.compatible}). Esegui npm run data:build.`,
            );
          }

          const waved = withWaveOrder(parks, RELIEF_STORY_CAMERA.center);
          addRifugiLayers(map, waved, "main", { fillOpacity: FILL_OPACITY, lineOpacity: 0.9, lineWidth: 2.2 });
          addRifugiFocusLayers(map, "main");
          addRifugiHoverLayers(map, "main");
          addWalkingRouteLayers(map, "main");
          addUfficialiLayers(map, withUfficialiLabels(ufficiali), "main");
          addUfficialeFocusLayer(map, "main");

          revealTargetsRef.current = {
            officialHalo: map.getPaintProperty("main-ufficiali-halo", "circle-opacity"),
            officialDot: map.getPaintProperty("main-ufficiali-dot", "circle-opacity"),
            officialStroke: map.getPaintProperty("main-ufficiali-dot", "circle-stroke-opacity"),
          };
          map.setPaintProperty("main-rifugi-fill", "fill-opacity", 0);
          map.setPaintProperty("main-rifugi-line", "line-opacity", 0);
          map.setPaintProperty("main-rifugi-line-casing", "line-opacity", 0);
          map.setPaintProperty("main-ufficiali-halo", "circle-opacity", 0);
          map.setPaintProperty("main-ufficiali-dot", "circle-opacity", 0);
          map.setPaintProperty("main-ufficiali-dot", "circle-stroke-opacity", 0);

          setOverviewFrame(
            map,
            sources.csi ? parks : ufficiali,
            mobileMap ? mobileOverviewPadding() : 46,
          );
          frameOverview(map, 0, { resetPadding: mobileMap });
          if (mobileMap) {
            const initialZoom = map.getZoom();
            const initialBounds = map.getBounds().toArray();
            map.setMinZoom(initialZoom);
            map.setMaxBounds(initialBounds);
          }
          readyRef.current = true;
          cameraResizePendingRef.current = false;
          readyWaiters.forEach((resolve) => resolve(true));
          readyWaiters.clear();
          startNetworkReveal();
          logPerformanceEvent("rifugi:map-ready", {
            section: "Mappa Rifugi",
          });

          const clearHover = () => {
            if (hoverKeyRef.current == null) return;
            hoverKeyRef.current = null;
            popupRefreshRef.current = null;
            setRifugiHover(map, "main", null);
            popupRef.current?.remove();
          };
          const HIT = 8;
          const boxAt = (point) => [
            [point.x - HIT, point.y - HIT],
            [point.x + HIT, point.y + HIT],
          ];
          const nearestIn = (point, layers) => {
            const present = layers.filter((id) => map.getLayer(id));
            if (!present.length) return null;
            const feats = map.queryRenderedFeatures(boxAt(point), { layers: present });
            if (!feats.length) return null;
            let best = null;
            let bestD = Infinity;
            for (const f of feats) {
              const c = map.project(featureCenter(f));
              const d = Math.hypot(c.x - point.x, c.y - point.y);
              if (d < bestD) {
                bestD = d;
                best = f;
              }
            }
            return best;
          };
          const ufficialeAt = (point) => nearestIn(point, ["main-ufficiali-dot"]);
          const rifugioAt = (point) => nearestIn(point, ["main-rifugi-fill", "main-rifugi-cutout"]);

          popupRef.current = runtimeProfile.useIOSCanvasMaps
            ? createIPhoneRifugiPopup({ offset: 16 })
            : new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 16 });
          map.on("mousemove", (e) => {
            const pin = ufficialeAt(e.point);
            if (pin) {
              map.getCanvas().style.cursor = "pointer";
              const key = `u:${pin.properties?.nome || ""}`;
              if (key === hoverKeyRef.current) return;
              hoverKeyRef.current = key;
              setRifugiHover(map, "main", null);
              popupRefreshRef.current = () =>
                popupUfficialeHTML(pin, reliefCardsRef.current);
              popupRef.current
                .setLngLat(pin.geometry.coordinates)
                .setHTML(popupRefreshRef.current())
                .addTo(map);
              return;
            }
            const raw = rifugioAt(e.point);
            map.getCanvas().style.cursor = raw ? "pointer" : "";
            if (!raw) {
              clearHover();
              return;
            }
            const full = fullRifugiFor(raw);
            const f = full[0] || raw;
            const key = rifugiHoverKey(f);
            if (detailOpenRef.current && key === selectedKeyRef.current) {
              clearHover();
              return;
            }
            if (key === hoverKeyRef.current) return;
            hoverKeyRef.current = key;
            setRifugiHover(map, "main", full);
            popupRefreshRef.current = () =>
              popupRifugioHTML(f, reliefCardsRef.current);
            popupRef.current
              .setLngLat(featureCenter(f))
              .setHTML(popupRefreshRef.current())
              .addTo(map);
          });
          map.on("click", (e) => {
            cameraTouchedRef.current = true;
            clearHover();
            if (!isFullScreen()) holdScrollAtSceneTop();
            const pin = ufficialeAt(e.point);
            if (pin) return focusUfficiale(pin);
            const f = rifugioAt(e.point);
            if (f) return focusRifugio(f);
            return zoomIntoPoint([e.lngLat.lng, e.lngLat.lat]);
          });
          map.on("dblclick", cancelPendingPointSelection);
        } catch (err) {
          console.warn(err);
          readyWaiters.forEach((resolve) => resolve(false));
          readyWaiters.clear();
          setFailed(true);
          setControlsReady(true);
        }
      });
    };

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            logPerformanceEvent("rifugi:proximity-trigger", {
              section: "Mappa Rifugi",
            });
            init();
            if (entryResizeTimerRef.current !== null) {
              window.clearTimeout(entryResizeTimerRef.current);
            }
            entryResizeTimerRef.current = window.setTimeout(() => {
              entryResizeTimerRef.current = null;
              resizeControllerRef.current?.request("rifugi-entry");
            }, 250);
          } else {
            if (entryResizeTimerRef.current !== null) {
              window.clearTimeout(entryResizeTimerRef.current);
              entryResizeTimerRef.current = null;
            }
            resizeControllerRef.current?.cancelPending();
            mapRef.current?.stop();
            if (!focusedRef.current) return;
            routeAbortRef.current?.abort();
            routeAbortRef.current = null;
            focusedRef.current = false;
            searchResultFocusRef.current = false;
            mobileSearchCameraRef.current = null;
            detailOpenRef.current = false;
            selectedKeyRef.current = null;
            hoverKeyRef.current = null;
            detailRefreshRef.current = null;
            popupRefreshRef.current = null;
            setFocused(false);
            setDetail("");
            setMessageKey(null);
            setSearchOpen(false);
            setInfoOpen(false);
            setSearchMarker(null);
            cameraTouchedRef.current = false;
            if (mapRef.current) {
              setRifugiFocus(
                mapRef.current,
                "main",
                [],
                reliefCardsRef.current.green.fallbackName,
              );
              setRifugiHover(mapRef.current, "main", null);
              setUfficialeFocus(mapRef.current, "main", null);
              setWalkingRoutes(mapRef.current, "main", []);
              frameOverview(mapRef.current, 0, {
                resetPadding: mobileMapRef.current,
              });
            }
          }
        });
      },
      { threshold: 0.05 },
    );
    io.observe(section);
    return () => {
      io.disconnect();
      if (entryResizeTimerRef.current !== null) {
        window.clearTimeout(entryResizeTimerRef.current);
        entryResizeTimerRef.current = null;
      }
      cancelPendingPointSelection();
      cancelMobileCamera();
      cancelWaveRef.current?.();
      if (controlsReadyTimerRef.current) window.clearTimeout(controlsReadyTimerRef.current);
      controlsReadyTimerRef.current = null;
      routeAbortRef.current?.abort();
      routeAbortRef.current = null;
      markerRef.current?.remove();
      markerRef.current = null;
      popupRef.current?.remove();
      popupRef.current = null;
      resizeControllerRef.current?.destroy();
      resizeControllerRef.current = null;
      unregisterPerformanceRef.current?.();
      unregisterPerformanceRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      readyRef.current = false;
      readyWaiters.forEach((resolve) => resolve(false));
      readyWaiters.clear();
      revealTargetsRef.current = null;
    };
  }, [
    focusRifugio,
    focusUfficiale,
    cancelMobileCamera,
    cancelPendingPointSelection,
    zoomIntoPoint,
    isFullScreen,
    holdScrollAtSceneTop,
    setSearchMarker,
    startNetworkReveal,
  ]);

  useEffect(() => {
    let frame = null;
    const update = () => {
      frame = null;
      const vh = window.innerHeight || 768;
      const section = sectionRef.current;
      const rect = section?.getBoundingClientRect();
      if (!rect) return;
      const inScene = rect.top < vh && rect.bottom > 0;

      const exitProgress = smoothstep(
        clamp01((vh * EXIT_FROM - rect.bottom) / (vh * (EXIT_FROM - EXIT_TO))),
      );
      section.style.setProperty("--map-exit", exitProgress.toFixed(3));
      const nextExiting = inScene && rect.bottom <= vh * EXIT_FROM;
      const nextRevealed = inScene && rect.top <= vh * REVEAL_AT;
      const nextEngaged = nextRevealed && !nextExiting;

      sceneEngagedRef.current = nextEngaged;
      setRevealed(nextRevealed);
      setEngaged(nextEngaged);
      setExiting(nextExiting);
      if (nextEngaged) startNetworkReveal();

      const map = mapRef.current;
      if (
        cameraResizePendingRef.current &&
        nextEngaged &&
        readyRef.current &&
        map &&
        isMapSizeSynchronized(map)
      ) {
        cameraResizePendingRef.current = false;
        if (mobileMapRef.current && !cameraTouchedRef.current) {
          map._reliefPad = mobileOverviewPadding();
          frameOverview(map, 0, { resetPadding: true });
        }
      }

      const y = window.scrollY;
      const now = performance.now();
      if (scrollResetUntilRef.current > now) {
        const anchor = scrollAnchorRef.current;
        if (Math.abs(y - anchor) > 1) {
          window.scrollTo({ top: anchor, behavior: "auto" });
        }
        lastScrollRef.current = anchor;
        return;
      }
      const dy = y - lastScrollRef.current;
      lastScrollRef.current = y;
      const mapGestureProtected =
        mobileMapRef.current &&
        (mapGestureActiveRef.current || now < mapGestureGraceUntilRef.current);
      if (
        focusedRef.current &&
        dy > 6 &&
        now - focusAtRef.current > 950 &&
        !mapGestureProtected
      ) {
        dezoomToOverview({ consumeScroll: true });
      }
    };
    const requestUpdate = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };
    const handleResize = () => {
      cameraResizePendingRef.current = true;
      requestUpdate();
    };
    requestMapResizeUpdateRef.current = requestUpdate;
    lastScrollRef.current = window.scrollY;
    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", handleResize);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      if (requestMapResizeUpdateRef.current === requestUpdate) {
        requestMapResizeUpdateRef.current = null;
      }
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", handleResize);
    };
  }, [dezoomToOverview, startNetworkReveal]);

  const controlsGone = exiting || !(engaged || focused);
  const closeInfo = () => {
    if (mobileMapRef.current && searchResultFocusRef.current) {
      setInfoOpen(false);
      const map = mapRef.current;
      const searchCamera = mobileSearchCameraRef.current;
      if (map && searchCamera) {
        map.flyTo({
          ...searchCamera,
          duration: 650,
          essential: true,
        });
      }
      return;
    }
    if (focusedRef.current || detailOpenRef.current) {
      dezoomToOverview();
      return;
    }
    setInfoOpen(false);
  };

  return (
    <section
      ref={sectionRef}
      className={`relief-map-section relief-map-section--rifugi${focused ? " relief-map-section--focused" : ""}`}
      aria-label={reliefMapContent.ariaLabel}
    >
      <div className="relief-map-sticky">
        <div
          ref={containerRef}
          className="map-canvas relief-map-canvas"
          role="region"
          aria-label={reliefMapContent.ariaLabel}
        />
        <div className="relief-map-scrim" aria-hidden="true" />
        <div className={`relief-map-veil${revealed ? " relief-map-veil--hidden" : ""}`} aria-hidden="true" />
        <div className="relief-map-veil-exit" aria-hidden="true" />

        <div
          className={`relief-map-hint relief-map-hint--${focused ? "return" : "invite"}${
            controlsReady && !controlsGone ? " relief-map-hint--visible" : ""
          }${searchOpen || infoOpen ? " relief-map-hint--suppressed" : ""}`}
          aria-hidden="true"
        >
          <span className="relief-map-hint-dot" />
          {focused ? reliefMapContent.hints.return : reliefMapContent.hints.invite}
        </div>

        {controlsReady && infoOpen && !detail && (
          <button
            type="button"
            className="relief-map-info-backdrop"
            onClick={closeInfo}
            aria-label={uiContent.actions.close}
          />
        )}

        {controlsReady && (
          <button
            type="button"
            className={`relief-map-info-toggle${
              infoOpen ? " relief-map-info-toggle--open" : ""
            }${controlsGone ? " relief-map-mobile-control--gone" : ""}`}
            onClick={() => {
              setSearchOpen(false);
              setInfoOpen(true);
            }}
            aria-expanded={infoOpen}
            aria-label={uiContent.map.legend}
          >
            <span className="relief-map-info-toggle-icon" aria-hidden="true">i</span>
            <span>{uiContent.map.legend}</span>
          </button>
        )}

        {controlsReady &&
          mobileGestureHintVisible &&
          !infoOpen &&
          !searchOpen &&
          !controlsGone && (
            <div
              className="relief-map-mobile-gesture-hint"
              role="status"
              aria-live="polite"
            >
              <span>{uiContent.map.cooperativeGestures.mobile}</span>
            </div>
          )}

        {controlsReady && (
          <div ref={dockRef} className={`relief-map-dock relief-map-dock--ready${
            infoOpen ? " relief-map-dock--open" : ""
          }${controlsGone ? " relief-map-dock--gone" : ""}`}>
            <div className="relief-map-panel relief-map-panel--dock">
              <div className="relief-map-info-head">
                <button
                  type="button"
                  className="relief-map-control-close"
                  onClick={closeInfo}
                  aria-label={uiContent.actions.close}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>
              {detail ? (
                <div className="relief-focus-card on" aria-live="polite" dangerouslySetInnerHTML={{ __html: detail }} />
              ) : (
                <>
                  <div className="relief-map-count-group relief-map-count-group--official">
                    <div className="relief-count">
                      <span className="relief-count-num">{rifugiCounts.official}</span>
                      <span className="relief-count-label">
                        <span className="relief-count-dot relief-count-dot--ufficiale" aria-hidden="true" />
                        {reliefMapContent.counts.officialLabel}
                      </span>
                      <span className="relief-count-sub">
                        {reliefMapContent.counts.officialSub}
                      </span>
                    </div>
                    <a className="relief-map-link" href={editorialLinks.climateRelief.municipalRefugesMap} target="_blank" rel="noopener noreferrer">
                      {reliefMapContent.links.municipalLabel} →
                    </a>
                  </div>
                  {!csiUnavailable && (
                    <div className="relief-map-count-group relief-map-count-group--compatible">
                      <div className="relief-count relief-count--second">
                        <span className="relief-count-num">{rifugiCounts.compatible}</span>
                        <span className="relief-count-label">
                          <span className="relief-count-dot relief-count-dot--verde" aria-hidden="true" />
                          {reliefMapContent.counts.compatibleLabel}
                        </span>
                      </div>
                      <a className="relief-map-link" href={editorialLinks.climateRelief.crafMap} target="_blank" rel="noopener noreferrer">
                        {reliefMapContent.links.taleaLabel} →
                      </a>
                    </div>
                  )}
                  {failed && (
                    <p className="relief-map-note relief-map-note--error">
                      {reliefMapContent.loadError}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {controlsReady && (
          <button
            type="button"
            className={`relief-map-search-toggle${
              searchOpen ? " relief-map-search-toggle--open" : ""
            }${controlsGone ? " relief-map-mobile-control--gone" : ""}`}
            onClick={() => {
              setInfoOpen(false);
              setSearchOpen(true);
            }}
            aria-expanded={searchOpen}
            aria-label={reliefMapContent.search.ariaLabel}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <circle cx="10.5" cy="10.5" r="5.75" />
              <path d="m15 15 4.25 4.25" />
            </svg>
            <span>{reliefMapContent.search.submit}</span>
          </button>
        )}

        {controlsReady && (
          <div className={`relief-map-find relief-map-find--ready${
            searchOpen ? " relief-map-find--open" : ""
          }${controlsGone ? " relief-map-find--gone" : ""}`}>
            <button
              type="button"
              className="relief-map-control-close relief-map-search-close"
              onClick={() => setSearchOpen(false)}
              aria-label={uiContent.actions.close}
            >
              <span aria-hidden="true">×</span>
            </button>
            <p className="relief-map-find-prompt">
              <strong className="relief-map-find-prompt-lead">
                {reliefMapContent.search.promptLead}:
              </strong>{" "}
              <span className="relief-map-find-prompt-tail">
                {reliefMapContent.search.promptTail}
              </span>
            </p>
            <SearchSuggest
              autoId="rifugi"
              placeholder={reliefMapContent.search.placeholder}
              ariaLabel={reliefMapContent.search.ariaLabel}
              submitLabel={reliefMapContent.search.submit}
              suggestionLabels={reliefMapContent.search.suggestionLabels}
              onSubmit={runSearch}
              onPick={applyPick}
            />
            {message && <p className="relief-map-message">{message}</p>}
          </div>
        )}
      </div>
      <div className="relief-map-panels" aria-hidden="true">
        <div className="relief-map-explore-buffer" aria-hidden="true" />
      </div>
    </section>
  );
}

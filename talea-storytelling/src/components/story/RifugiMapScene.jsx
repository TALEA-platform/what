import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { rifugiCounts } from "../../data/climateRelief";
import { loadReliefSources } from "../../data/reliefData";
import { editorialLinks, useContent } from "../../content";
import { SearchSuggest } from "../ui/SearchSuggest";
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

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (t) => t * t * (3 - 2 * t);

export function RifugiMapScene() {
  const { content, locale } = useContent();
  const reliefMapContent = content.climateRelief.refuges.map;
  const reliefCards = reliefMapContent.cards;
  const sectionRef = useRef(null);
  const containerRef = useRef(null);
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

  const [revealed, setRevealed] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [csiUnavailable, setCsiUnavailable] = useState(false);
  const [focused, setFocused] = useState(false);
  const [controlsReady, setControlsReady] = useState(false);
  const [detail, setDetail] = useState("");
  const [messageKey, setMessageKey] = useState(null);
  const message = messageKey ? reliefMapContent.search[messageKey] : "";

  useEffect(() => {
    reliefCardsRef.current = reliefCards;
    localeRef.current = locale;
  }, [locale, reliefCards]);

  useEffect(() => {
    const detailHtml = detailRefreshRef.current?.();
    if (detailHtml) setDetail(detailHtml);
    const popupHtml = popupRefreshRef.current?.();
    if (popupHtml) popupRef.current?.setHTML(popupHtml);
  }, [locale]);

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
      markerRef.current = new maplibregl.Marker({ color: "#FFE604" }).setLngLat(pt).addTo(mapRef.current);
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

  const focusUfficiale = useCallback(
    (feature) => {
      const map = mapRef.current;
      if (!feature || !map) return;
      cancelRouting();
      clearHighlights();
      setSearchMarker(null);
      detailOpenRef.current = true;
      selectedKeyRef.current = null;
      setUfficialeFocus(map, "main", feature);
      detailRefreshRef.current = () => ufficialeDetailHTML(feature, reliefCardsRef.current);
      setDetail(detailRefreshRef.current());
      setMessageKey(null);
      enterFocus();
      map.flyTo({ center: feature.geometry.coordinates, zoom: 15.4, duration: 1400, essential: true });
    },
    [cancelRouting, clearHighlights, enterFocus, setSearchMarker],
  );

  const focusRifugio = useCallback(
    (feature) => {
      const map = mapRef.current;
      if (!feature || !map) return;
      cancelRouting();
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
      enterFocus();
      flyToFeatures(map, full, { maxZoom: 16, padding: 120 });
    },
    [cancelRouting, clearHighlights, enterFocus, setSearchMarker],
  );

  const zoomIntoPoint = useCallback(
    (pt) => {
      const map = mapRef.current;
      if (!map) return;
      cancelRouting();
      clearHighlights();
      detailOpenRef.current = false;
      selectedKeyRef.current = null;
      detailRefreshRef.current = null;
      setDetail("");
      enterFocus();
      const z = Math.min(map.getZoom() + 1.6, EXPLORE_ZOOM_LIMITS.maxZoom - 0.4);
      map.flyTo({ center: pt, zoom: z, duration: 900, essential: true });
    },
    [cancelRouting, clearHighlights, enterFocus],
  );

  const focusPoint = useCallback(
    async (pt, label) => {
      const map = mapRef.current;
      if (!map) return;
      cancelRouting();
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
        flyToWalkingRoutes(map, pt, routes);
      } catch (error) {
        if (error?.name !== "AbortError") {
          setMessageKey("routeError");
        }
      } finally {
        if (routeAbortRef.current === controller) routeAbortRef.current = null;
      }
    },
    [cancelRouting, clearHighlights, enterFocus, setSearchMarker],
  );

  const dezoomToOverview = useCallback(
    (opts = {}) => {
      const map = mapRef.current;
      if (!map) return;
      cancelRouting();
      focusedRef.current = false;
      detailOpenRef.current = false;
      selectedKeyRef.current = null;
      hoverKeyRef.current = null;
      detailRefreshRef.current = null;
      setFocused(false);
      setDetail("");
      setMessageKey(null);
      setSearchMarker(null);
      clearHighlights();
      frameOverview(map, 1200);
      if (opts.consumeScroll) holdScrollAtSceneTop();
    },
    [cancelRouting, clearHighlights, holdScrollAtSceneTop, setSearchMarker],
  );

  const waitForReady = useCallback(
    () =>
      new Promise((resolve) => {
        if (readyRef.current) return resolve();
        const tick = () => (readyRef.current ? resolve() : window.setTimeout(tick, 120));
        tick();
      }),
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
      await waitForReady();
      setMessageKey("searching");
      try {
        const hit = await geocodeBologna(q);
        if (hit) await focusPoint(hit.pt, hit.label);
        else setMessageKey("empty");
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
      await waitForReady();
      await focusPoint(item.pt, item.label);
    },
    [focusPoint, scrollSceneIntoView, waitForReady],
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

    const init = () => {
      if (mapRef.current || !containerRef.current) return;
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: BASEMAP_STYLE,
        center: RELIEF_STORY_CAMERA.center,
        zoom: RELIEF_STORY_CAMERA.zoom,
        minZoom: EXPLORE_ZOOM_LIMITS.minZoom,
        maxZoom: EXPLORE_ZOOM_LIMITS.maxZoom,
        attributionControl: false,
      });
      mapRef.current = map;
      lockCamera(map);
      map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
      map.addControl(new maplibregl.ScaleControl({ maxWidth: 110, unit: "metric" }), "bottom-right");

      map.on("load", async () => {
        addOrthophoto(map, { damped: true });
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

          setOverviewFrame(map, sources.csi ? parks : ufficiali, 46);
          frameOverview(map, 0);
          readyRef.current = true;
          startNetworkReveal();

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

          popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 16 });
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
            clearHover();
            if (!isFullScreen()) holdScrollAtSceneTop();
            const pin = ufficialeAt(e.point);
            if (pin) return focusUfficiale(pin);
            const f = rifugioAt(e.point);
            if (f) return focusRifugio(f);
            return zoomIntoPoint([e.lngLat.lng, e.lngLat.lat]);
          });
        } catch (err) {
          console.warn(err);
          setFailed(true);
          setControlsReady(true);
        }
      });
    };

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            init();
            window.setTimeout(() => mapRef.current?.resize(), 250);
          } else if (focusedRef.current) {
            routeAbortRef.current?.abort();
            routeAbortRef.current = null;
            focusedRef.current = false;
            detailOpenRef.current = false;
            selectedKeyRef.current = null;
            hoverKeyRef.current = null;
            detailRefreshRef.current = null;
            popupRefreshRef.current = null;
            setFocused(false);
            setDetail("");
            setMessageKey(null);
            setSearchMarker(null);
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
              frameOverview(mapRef.current, 0);
            }
          }
        });
      },
      { threshold: 0.05 },
    );
    io.observe(section);
    return () => {
      io.disconnect();
      cancelWaveRef.current?.();
      if (controlsReadyTimerRef.current) window.clearTimeout(controlsReadyTimerRef.current);
      controlsReadyTimerRef.current = null;
      routeAbortRef.current?.abort();
      routeAbortRef.current = null;
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      readyRef.current = false;
      revealTargetsRef.current = null;
    };
  }, [
    focusRifugio,
    focusUfficiale,
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
      if (focusedRef.current && dy > 6 && now - focusAtRef.current > 950) {
        dezoomToOverview({ consumeScroll: true });
      }
    };
    const requestUpdate = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };
    lastScrollRef.current = window.scrollY;
    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, [dezoomToOverview, startNetworkReveal]);

  const controlsGone = exiting || !(engaged || focused);

  return (
    <section
      ref={sectionRef}
      className={`relief-map-section relief-map-section--rifugi${focused ? " relief-map-section--focused" : ""}`}
      aria-label={reliefMapContent.ariaLabel}
    >
      <div className="relief-map-sticky">
        <div ref={containerRef} className="map-canvas relief-map-canvas" aria-hidden="true" />
        <div className="relief-map-scrim" aria-hidden="true" />
        <div className={`relief-map-veil${revealed ? " relief-map-veil--hidden" : ""}`} aria-hidden="true" />
        <div className="relief-map-veil-exit" aria-hidden="true" />

        <div
          className={`relief-map-hint relief-map-hint--${focused ? "return" : "invite"}${
            controlsReady && !controlsGone ? " relief-map-hint--visible" : ""
          }`}
          aria-hidden="true"
        >
          <span className="relief-map-hint-dot" />
          {focused ? reliefMapContent.hints.return : reliefMapContent.hints.invite}
        </div>

        {controlsReady && (
          <div className={`relief-map-dock relief-map-dock--ready${controlsGone ? " relief-map-dock--gone" : ""}`}>
            <div className="relief-map-panel relief-map-panel--dock">
              {detail ? (
                <div className="relief-focus-card on" aria-live="polite" dangerouslySetInnerHTML={{ __html: detail }} />
              ) : (
                <>
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
                  {!csiUnavailable && (
                    <>
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
                    </>
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
          <div className={`relief-map-find relief-map-find--ready${controlsGone ? " relief-map-find--gone" : ""}`}>
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

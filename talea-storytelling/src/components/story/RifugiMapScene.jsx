import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { rifugiCopy } from "../../data/climateRelief";
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

// ── Quando la scena si scopre e quando si richiude, in altezze di schermata ──
// `REVEAL_AT`: la mappa ha quasi preso lo schermo e il velo d'ingresso si
// scioglie. Sotto questa soglia il campo di colore in arrivo fa da ponte.
// `EXIT_FROM` / `EXIT_TO`: la dissolvenza d'uscita, legata allo scorrimento.
// Comincia quando il pannello sticky si sgancia e finisce quando della mappa
// resta l'ultimo quarto di schermo: vedi il commento nel ciclo di scorrimento.
const REVEAL_AT = 0.18;
const EXIT_FROM = 0.94;
const EXIT_TO = 0.28;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (t) => t * t * (3 - 2 * t);

/**
 * Sticky ortophoto map of Bologna's climate refuges, on two tiers that must stay
 * legible as two: the deep-green PINS are the refuges the Comune has actually
 * recognised (a decision, with opening hours), the green SHAPES are the parks
 * and gardens the CRAF study finds big and leafy enough to do the same job (a
 * measurement). The city's small green — flower beds, verges — is deliberately
 * not drawn: it is not a refuge, and drawing it would say it is.
 *
 * The scene doesn't lift a veil like the hotspot and shadow maps do: the network
 * LIGHTS UP from the centre outwards (`10` § 10.2), because this is the first
 * good news of the story. Tapping any refuge eases the camera in and opens its
 * card; searching a street answers "e casa mia?" with the distance to the relief
 * nearest to it (`11` § 11.3). Scrolling on eases back out to the overview.
 */
export function RifugiMapScene() {
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
  // True only while a refuge DETAIL card is open (tap a refuge). A plain
  // zoom-into-empty-ground focuses the camera but leaves this false, so refuges
  // stay hoverable once zoomed in.
  const detailOpenRef = useRef(false);
  // Key of the refuge whose detail card is open, so hovering a DIFFERENT refuge
  // still previews it (only the selected one is skipped).
  const selectedKeyRef = useRef(null);
  const focusAtRef = useRef(0);
  const lastScrollRef = useRef(0);
  const scrollAnchorRef = useRef(0);
  const scrollResetUntilRef = useRef(0);

  // `revealed` è «il velo d'ingresso è sciolto»; `engaged` è «la scena sta
  // recitando». Erano la stessa cosa, e all'uscita si pagava due volte: la
  // scena si disingaggiava, il velo d'INGRESSO tornava opaco in 760 ms e sopra
  // di lui saliva anche quello d'uscita. Due bianchi sovrapposti sulla stessa
  // mappa. Il velo d'ingresso ora torna solo se il lettore risale sopra la
  // scena; l'uscita la racconta il velo d'uscita, da solo.
  const [revealed, setRevealed] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [focused, setFocused] = useState(false);
  const [controlsReady, setControlsReady] = useState(false);
  const [detail, setDetail] = useState("");
  const [message, setMessage] = useState("");
  const [searchPromptLead, searchPromptTail = ""] = rifugiCopy.searchPrompt.split(":");

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

  // The sticky map fills the viewport (is "full screen") only while the section
  // is pinned — its top at/above the viewport top and its bottom below it.
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
    // Yellow means one thing on every map of this story: "this is the thing you
    // asked about" (`01` § 1.1). A searched address qualifies; nothing else here does.
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
    setRifugiFocus(map, "main", []);
    setRifugiHover(map, "main", null);
    setUfficialeFocus(map, "main", null);
    setWalkingRoutes(map, "main", []);
  }, []);

  const cancelRouting = useCallback(() => {
    routeAbortRef.current?.abort();
    routeAbortRef.current = null;
  }, []);

  // Tap an official refuge: the card carries the things only these places have —
  // indoor cool, free toilets, drinking water, opening hours.
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
      setDetail(ufficialeDetailHTML(feature));
      setMessage("");
      enterFocus();
      map.flyTo({ center: feature.geometry.coordinates, zoom: 15.4, duration: 1400, essential: true });
    },
    [cancelRouting, clearHighlights, enterFocus, setSearchMarker],
  );

  // Tap a green refuge: the clicked shape is a tile-clipped fragment, so resolve
  // it to the WHOLE park first — highlight, card and camera all describe the one
  // place, with one continuous border.
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
      setRifugiFocus(map, "main", full);
      setDetail(rifugiDetailHTML(primary));
      setMessage("");
      enterFocus();
      flyToFeatures(map, full, { maxZoom: 16, padding: 120 });
    },
    [cancelRouting, clearHighlights, enterFocus, setSearchMarker],
  );

  // Tap empty ground (no refuge under the point): nudge the camera in on that
  // spot so the small refuges there grow and become easy to tap. Marked as a
  // focus so scrolling on eases back out to the overview, like any other move.
  const zoomIntoPoint = useCallback(
    (pt) => {
      const map = mapRef.current;
      if (!map) return;
      cancelRouting();
      clearHighlights();
      detailOpenRef.current = false;
      selectedKeyRef.current = null;
      setDetail("");
      enterFocus();
      const z = Math.min(map.getZoom() + 1.6, EXPLORE_ZOOM_LIMITS.maxZoom - 0.4);
      map.flyTo({ center: pt, zoom: z, duration: 900, essential: true });
    },
    [cancelRouting, clearHighlights, enterFocus],
  );

  // "E casa mia?" — the moment the 3-30-300 block used to carry (`11` § 11.3).
  // No index, no thresholds, nothing that can be wrong for lack of data: a place
  // the reader knows, and how far the relief is from it.
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
      setSearchMarker(pt);
      setDetail("");
      setMessage(rifugiCopy.routeLoading);
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
          );
        }
        setWalkingRoutes(map, "main", routes);
        setDetail(nearbyCardHTML({ label, ufficiale, verdi }));
        setMessage("");
        flyToWalkingRoutes(map, pt, routes);
      } catch (error) {
        if (error?.name !== "AbortError") setMessage(rifugiCopy.routeError);
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
      setFocused(false);
      setDetail("");
      setMessage("");
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
    // `html { scroll-behavior: smooth }` is on: "instant" keeps the landing
    // deterministic, which the pin/unpin maths below depends on.
    sectionRef.current?.scrollIntoView({ behavior: "instant", block: "start" });
  }, []);

  const runSearch = useCallback(
    async (rawQuery) => {
      const q = String(rawQuery || "").trim();
      if (!q) return;
      scrollSceneIntoView();
      await waitForReady();
      setMessage("Cerco…");
      try {
        const hit = await geocodeBologna(q);
        if (hit) await focusPoint(hit.pt, hit.label);
        else setMessage(rifugiCopy.searchEmpty);
      } catch {
        setMessage(rifugiCopy.searchEmpty);
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

    // The map itself speaks first. The information dock and invitation arrive
    // once the green network is legible, while the Comune's pins finish settling:
    // the controls explain the distinction without interrupting its entrance.
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

  // Lazy-init the static map when the scene is near the viewport.
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
        // The boundary is scenery, not a selection: no yellow (`01` § 1.1).
        addBolognaBoundary(map, "main", { color: "rgba(255,255,255,.72)", glowOpacity: 0.28, opacity: 0.7 });
        try {
          const [parks, ufficiali] = await Promise.all([loadRifugiData(), loadRifugiUfficiali()]);

          // The counter in the dock is hand-written copy; if the data moves under
          // it, say so here rather than let the page publish a wrong number.
          const realGreen = countRifugi(parks);
          const realOfficial = (ufficiali.features || []).length;
          if (realGreen !== rifugiCopy.selectedCount || realOfficial !== rifugiCopy.officialCount) {
            console.warn(
              `[rifugi] il contatore non corrisponde ai dati: ufficiali ${realOfficial} (testo ${rifugiCopy.officialCount}), ` +
                `selezionati ${realGreen} (testo ${rifugiCopy.selectedCount}). Allinea rifugiCopy in src/data/climateRelief.js.`,
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

          setOverviewFrame(map, parks, 46);
          frameOverview(map, 0);
          readyRef.current = true;
          startNetworkReveal();

          const clearHover = () => {
            if (hoverKeyRef.current == null) return;
            hoverKeyRef.current = null;
            setRifugiHover(map, "main", null);
            popupRef.current?.remove();
          };
          // Pick the refuge nearest a screen point, searching a small padded box
          // around it — a citizen can tap slightly off a tiny shape and still get
          // it, instead of the exact-hit target the fill layer would require.
          // The Comune's pins win ties: they are the better answer.
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
          // Il parco selezionato è tolto dal riempimento di base (si apre
          // sull'ortofoto): resta però nel layer gemello, che va interrogato
          // anche lui — altrimenti toccarne l'interno varrebbe «terreno vuoto»
          // e la scheda appena aperta si chiuderebbe da sé.
          const rifugioAt = (point) => nearestIn(point, ["main-rifugi-fill", "main-rifugi-cutout"]);

          popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 16 });
          // Anchor the hover popup to the refuge's centre and only rebuild it
          // when the pointer moves to a DIFFERENT refuge — so it no longer trails
          // and flickers under the cursor.
          map.on("mousemove", (e) => {
            const pin = ufficialeAt(e.point);
            if (pin) {
              map.getCanvas().style.cursor = "pointer";
              const key = `u:${pin.properties?.nome || ""}`;
              if (key === hoverKeyRef.current) return;
              hoverKeyRef.current = key;
              setRifugiHover(map, "main", null);
              popupRef.current.setLngLat(pin.geometry.coordinates).setHTML(popupUfficialeHTML(pin)).addTo(map);
              return;
            }
            const raw = rifugioAt(e.point);
            map.getCanvas().style.cursor = raw ? "pointer" : "";
            if (!raw) {
              clearHover();
              return;
            }
            // Resolve the clipped fragment to the whole park so the preview +
            // outline are stable across the park and match what a click selects.
            const full = fullRifugiFor(raw);
            const f = full[0] || raw;
            const key = rifugiHoverKey(f);
            // Skip only the refuge whose detail card is already open — hovering a
            // DIFFERENT refuge still previews it, even while one is selected.
            if (detailOpenRef.current && key === selectedKeyRef.current) {
              clearHover();
              return;
            }
            if (key === hoverKeyRef.current) return;
            hoverKeyRef.current = key;
            setRifugiHover(map, "main", full);
            popupRef.current.setLngLat(featureCenter(f)).setHTML(popupRifugioHTML(f)).addTo(map);
          });
          map.on("click", (e) => {
            clearHover();
            // Pressing acts only against a full-screen map: if it isn't pinned
            // yet, snap it to full screen first, then run the zoom / selection.
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
            setFocused(false);
            setDetail("");
            setMessage("");
            setSearchMarker(null);
            if (mapRef.current) {
              setRifugiFocus(mapRef.current, "main", []);
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

  // Scroll-driven: veil reveal/conceal and de-zoom on scroll-on.
  useEffect(() => {
    let frame = null;
    const update = () => {
      frame = null;
      const vh = window.innerHeight || 768;
      const section = sectionRef.current;
      const rect = section?.getBoundingClientRect();
      if (!rect) return;
      const inScene = rect.top < vh && rect.bottom > 0;

      // ── L'uscita ─────────────────────────────────────────────────────────
      // La dissolvenza d'uscita è LEGATA ALLO SCROLL, non a un cronometro.
      // Prima era una classe che scattava a 0,82 schermate e faceva partire una
      // dissolvenza di 760 ms: da lì il lettore aveva ancora l'82% di una
      // schermata da percorrere con la mappa già coperta di bianco, e quel
      // tratto era letteralmente uno schermo vuoto che non rispondeva a niente.
      // Adesso comincia quando il pannello sticky si sgancia e finisce quando
      // della mappa resta l'ultimo quarto di schermo, con sotto già il ponte
      // verso la pianta: ogni pixel di scorrimento fa succedere qualcosa.
      const exitProgress = smoothstep(
        clamp01((vh * EXIT_FROM - rect.bottom) / (vh * (EXIT_FROM - EXIT_TO))),
      );
      section.style.setProperty("--map-exit", exitProgress.toFixed(3));
      const nextExiting = inScene && rect.bottom <= vh * EXIT_FROM;
      // Wait until the map has nearly taken the screen before starting the
      // network: the incoming field remains a calm colour bridge, then the map
      // performs its reveal while the reader can actually see the whole city.
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

  // I controlli vivono con la scena: entrano quando la mappa ha preso lo schermo
  // e se ne vanno appena il lettore la lascia, in su come in giù. Prima uscivano
  // soltanto verso il basso: tornando indietro il velo copriva la mappa ma il
  // dock e la ricerca restavano appesi sopra un campo di colore vuoto.
  const controlsGone = exiting || !(engaged || focused);

  return (
    <section
      ref={sectionRef}
      className={`relief-map-section relief-map-section--rifugi${focused ? " relief-map-section--focused" : ""}`}
      aria-label="Mappa dei rifugi climatici di Bologna"
    >
      <div className="relief-map-sticky">
        <div ref={containerRef} className="map-canvas relief-map-canvas" aria-hidden="true" />
        <div className="relief-map-scrim" aria-hidden="true" />
        <div className={`relief-map-veil${revealed ? " relief-map-veil--hidden" : ""}`} aria-hidden="true" />
        {/* Niente classe di stato: l'opacità è `--map-exit`, cioè la posizione
            di scorrimento, scritta sulla sezione a ogni fotogramma. */}
        <div className="relief-map-veil-exit" aria-hidden="true" />

        <div
          className={`relief-map-hint relief-map-hint--${focused ? "return" : "invite"}${
            controlsReady && !controlsGone ? " relief-map-hint--visible" : ""
          }`}
          aria-hidden="true"
        >
          <span className="relief-map-hint-dot" />
          {focused ? "Scorri per tornare alla città" : rifugiCopy.mapHint}
        </div>

        {controlsReady && (
          <div className={`relief-map-dock relief-map-dock--ready${controlsGone ? " relief-map-dock--gone" : ""}`}>
            <div className="relief-map-panel relief-map-panel--dock">
              {detail ? (
                <div className="relief-focus-card on" aria-live="polite" dangerouslySetInnerHTML={{ __html: detail }} />
              ) : (
                <>
                  {/* Un contatore, non una legenda (`10` § 10.3): la domanda che un
                      cittadino si fa davanti a questa mappa è «quanti sono?». */}
                  <div className="relief-count">
                    <span className="relief-count-num">{rifugiCopy.officialCount}</span>
                    <span className="relief-count-label">
                      <span className="relief-count-dot relief-count-dot--ufficiale" aria-hidden="true" />
                      {rifugiCopy.officialLabel}
                    </span>
                    <span className="relief-count-sub">{rifugiCopy.officialSub}</span>
                  </div>
                  {/* Il link sta con ciò di cui parla: è la mappa DEL COMUNE, e
                      va letto insieme ai rifugi che il Comune riconosce, non in
                      fondo al blocco dove sembrava riguardare anche i 231 parchi. */}
                  <a className="relief-map-link" href={rifugiCopy.link.href} target="_blank" rel="noopener noreferrer">
                    {rifugiCopy.link.label} →
                  </a>
                  <div className="relief-count relief-count--second">
                    <span className="relief-count-num">{rifugiCopy.selectedCount}</span>
                    <span className="relief-count-label">
                      <span className="relief-count-dot relief-count-dot--verde" aria-hidden="true" />
                      {rifugiCopy.selectedLabel}
                    </span>
                  </div>
                  <a className="relief-map-link" href={rifugiCopy.selectedLink.href} target="_blank" rel="noopener noreferrer">
                    {rifugiCopy.selectedLink.label} →
                  </a>
                  {failed && (
                    <p className="relief-map-note relief-map-note--error">
                      Dati dei rifugi climatici non caricati al momento.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* La domanda personale è un oggetto a sé, all'angolo opposto: dentro al
            dock era la terza cosa incolonnata sotto i numeri e il link, e non si
            capiva più dove finiva la spiegazione e dove cominciava l'azione. */}
        {controlsReady && (
          <div className={`relief-map-find relief-map-find--ready${controlsGone ? " relief-map-find--gone" : ""}`}>
            <p className="relief-map-find-prompt">
              <strong className="relief-map-find-prompt-lead">{searchPromptLead}:</strong>{" "}
              <span className="relief-map-find-prompt-tail">{searchPromptTail.trim()}</span>
            </p>
            <SearchSuggest
              autoId="rifugi"
              placeholder={rifugiCopy.searchPlaceholder}
              ariaLabel="Cerca una via o un parco di Bologna"
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

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { MapLibreCanvas } from "../maps/MapLibreCanvas";
import { HotspotLayer } from "../maps/HotspotLayer";
import { AnnotationLayer } from "../maps/AnnotationLayer";
import { BolognaBoundaryLayer } from "../maps/BolognaBoundaryLayer";
import { ScrollCue } from "../ui/ScrollCue";
import { LocalStoryProgress } from "../ui/LocalStoryProgress";
import { CopySegments } from "./CopySegments";
import { useTimedSequence } from "../../hooks/useTimedSequence";
import { editorialLinks, useContent } from "../../content";
import {
  CAMERA_MS,
  SCROLL_ACCELERATION_GRACE_MS,
  cameraEasing,
} from "../../lib/motion";
import { applyPaperBasemap } from "../../lib/basemapPaper";
import { getHotspotPersistenceColor } from "../../data/hotspotPalette";
import {
  buildHotspotSteps,
  hotspotStepSpecs,
  BOLOGNA_CENTER,
  BOLOGNA_ZOOM,
  BOLOGNA_ZOOM_PERSISTENCE,
  BOLOGNA_ZOOM_INTRO,
  NARROW_MAX_WIDTH,
  NARROW_ZOOM_SHIFT,
} from "../../data/hotspotSteps";

const sliderMarks = [3, 5, 9, 13];
const sliderThresholds = Array.from({ length: 13 }, (_, index) => index + 1);
const fillNumberTemplate = (template, value) =>
  template.replaceAll("{n}", String(value));

const BORDERS_MS = 0;
const VEIL_LIFT_MS = 250;
const FILLS_MS = 800;
const VEIL_DONE_MS = VEIL_LIFT_MS + CAMERA_MS;
const LEGEND_IN_MS = 600;
const LEGEND_MS = VEIL_DONE_MS + 150;
const START_DELAY = LEGEND_MS + LEGEND_IN_MS + 250;
const TAIL_MS = 600;
const SEQUENCE_OUT_MS = LEGEND_IN_MS;

const START_DELAY_REDUCED = 800;

const ENGAGE_RELEASE_VH = 0.2;
const SCROLL_PLAYBACK_MAX = 4;
const MOBILE_LAYOUT_QUERY = "(max-width: 1279px)";
const MOBILE_INTRO_PHASE = 0;
const MOBILE_HANDOFF_PHASE = 1;
const MOBILE_SLIDER_PHASE = 2;
const MOBILE_PHASE_COUNT = 3;
const MOBILE_PHASE_READING_LINE = 0.72;
const MOBILE_READ_MS_MULTIPLIER = 1.18;
const MOBILE_PANEL_OUT_MS = 280;
const MOBILE_MAX_ZOOM = 16;
const MOBILE_GESTURE_HINT_MS = 4800;

// The complete municipal outline is the geographic frame for mobile. Using
// bounds instead of a fixed zoom keeps the same Bologna extent in view across
// portrait phones and wider tablets.
const MOBILE_BOLOGNA_BOUNDS = [
  [11.229655388117, 44.421112955943],
  [11.433714394127, 44.556205390267],
];
const MOBILE_BOLOGNA_PERSISTENCE_BOUNDS = [
  [11.242918223507, 44.429893462024],
  [11.420451558737, 44.547424884186],
];

function getMobileCameraPadding() {
  if (window.innerWidth < 600) return 18;
  if (window.innerWidth < 900) return 28;
  return 38;
}

export function HotspotMapScene() {
  const { content, uiContent } = useContent();
  const hotspotMapCopy = content.hotspot.map;
  const { steps: hotspotSteps, readMs: hotspotStepReadMs } = useMemo(
    () => buildHotspotSteps(content),
    [content],
  );
  const mobileStepReadMs = useMemo(
    () =>
      hotspotStepReadMs.map((duration) =>
        Math.round(duration * MOBILE_READ_MS_MULTIPLIER),
      ),
    [hotspotStepReadMs],
  );
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
  const [map, setMap] = useState(null);
  const [mobileLayout, setMobileLayout] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia(MOBILE_LAYOUT_QUERY).matches,
  );
  const [narrowFrame, setNarrowFrame] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [mobilePhase, setMobilePhase] = useState(0);
  const [renderedMobilePhase, setRenderedMobilePhase] = useState(0);
  const [renderedMobileStep, setRenderedMobileStep] = useState(0);
  const [mobilePanelExiting, setMobilePanelExiting] = useState(false);
  const [mobileLabelsSuppressed, setMobileLabelsSuppressed] = useState(false);
  const [mobileGestureHintVisible, setMobileGestureHintVisible] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [exitActive, setExitActive] = useState(false);
  const [showSlider, setShowSlider] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const [mapEngaged, setMapEngaged] = useState(false);
  const [sequenceVisible, setSequenceVisible] = useState(false);
  const [descriptionsExited, setDescriptionsExited] = useState(false);
  const [bordersReady, setBordersReady] = useState(false);
  const [veilLifted, setVeilLifted] = useState(false);
  const [mapRevealed, setMapRevealed] = useState(false);
  const [legendReady, setLegendReady] = useState(false);
  const [fillsReady, setFillsReady] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );
  const [sliderValue, setSliderValue] = useState(9);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [sliderTouched, setSliderTouched] = useState(false);
  const demoStartedRef = useRef(false);
  const demoTimersRef = useRef([]);
  const sequenceExitTimerRef = useRef(null);
  const sceneRef = useRef(null);
  const holdRef = useRef(null);
  const exitRef = useRef(null);
  const sliderRef = useRef(null);
  const mobileTrackRef = useRef(null);
  const mobileTransitionTimerRef = useRef(null);
  const mapBoxRef = useRef(null);
  const engagedRef = useRef(false);
  const mobilePhaseRef = useRef(-1);
  const mobileCameraConfigRef = useRef(null);
  const mobileCameraTouchedRef = useRef(false);
  const mobileHandoffAdvanceArmedRef = useRef(false);
  const mobileLastWheelAtRef = useRef(0);
  const mobileRevealPlayedRef = useRef(false);
  const mobileGestureHintShownRef = useRef(false);
  const mobileProgressRef = useRef(null);
  const lastZoomRef = useRef(null);
  const scrollAccelerationUnlockAtRef = useRef(Infinity);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (event) => setReduceMotion(event.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_LAYOUT_QUERY);
    const handler = (event) => setMobileLayout(event.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  useEffect(() => {
    if (!mobileLayout) return undefined;

    const armHandoffAdvance = () => {
      if (mobilePhaseRef.current === MOBILE_HANDOFF_PHASE) {
        mobileHandoffAdvanceArmedRef.current = true;
      }
    };
    const onWheel = () => {
      const time = performance.now();
      if (
        mobilePhaseRef.current === MOBILE_HANDOFF_PHASE &&
        time - mobileLastWheelAtRef.current > 260
      ) {
        mobileHandoffAdvanceArmedRef.current = true;
      }
      mobileLastWheelAtRef.current = time;
    };
    const onKeyDown = (event) => {
      if (["ArrowDown", "PageDown", " "].includes(event.key)) {
        armHandoffAdvance();
      }
    };

    window.addEventListener("touchstart", armHandoffAdvance, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("touchstart", armHandoffAdvance);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileLayout]);

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
      !mapEngaged ||
      !mapRevealed ||
      mobileGestureHintShownRef.current
    ) {
      return undefined;
    }

    mobileGestureHintShownRef.current = true;
    setMobileGestureHintVisible(true);
    const dismissHint = () => setMobileGestureHintVisible(false);
    const timer = window.setTimeout(dismissHint, MOBILE_GESTURE_HINT_MS);
    const mapBox = mapBoxRef.current;
    mapBox?.addEventListener("touchstart", dismissHint, {
      passive: true,
      once: true,
    });

    return () => {
      window.clearTimeout(timer);
      mapBox?.removeEventListener("touchstart", dismissHint);
      setMobileGestureHintVisible(false);
    };
  }, [mapEngaged, mapRevealed, mobileLayout]);

  const onMapReady = useCallback((m) => {
    applyPaperBasemap(m);
    setMap(m);
  }, []);

  const sceneReady = mapEngaged && Boolean(map);

  const {
    revealed,
    complete: sequenceComplete,
    activeIndex,
    selected,
    forceComplete,
    goTo,
    getPlaybackSnapshot,
  } = useTimedSequence({
    count: hotspotSteps.length,
    engaged: sceneReady && !legendOpen,
    startDelay: reduceMotion ? START_DELAY_REDUCED : START_DELAY,
    readMs: mobileLayout ? mobileStepReadMs : hotspotStepReadMs,
    tailMs: TAIL_MS,
    pickDuringPlay: true,
    playbackRate,
  });

  useEffect(() => {
    if (!mobileLayout || !sceneReady) return undefined;

    let frame = null;
    const updateProgress = () => {
      const snapshot = getPlaybackSnapshot();
      const startAt = snapshot.entries[activeIndex] ?? 0;
      const endAt =
        snapshot.entries[activeIndex + 1] ?? snapshot.endAt ?? startAt;
      const withinStep =
        selected != null || sequenceComplete
          ? 1
          : Math.min(
              1,
              Math.max(
                0,
                (snapshot.virtualElapsed - startAt) / Math.max(1, endAt - startAt),
              ),
            );

      mobileProgressRef.current?.style.setProperty(
        "--local-story-progress",
        withinStep.toFixed(4),
      );
      if (!legendOpen && !sequenceComplete && selected == null) {
        frame = window.requestAnimationFrame(updateProgress);
      }
    };

    updateProgress();
    return () => {
      if (frame != null) window.cancelAnimationFrame(frame);
    };
  }, [
    activeIndex,
    getPlaybackSnapshot,
    legendOpen,
    mobileLayout,
    sceneReady,
    selected,
    sequenceComplete,
  ]);

  useEffect(() => {
    if (!mobileLayout) return undefined;
    if (
      renderedMobilePhase === mobilePhase &&
      (mobilePhase !== MOBILE_INTRO_PHASE || renderedMobileStep === activeIndex)
    ) {
      return undefined;
    }

    window.clearTimeout(mobileTransitionTimerRef.current);
    mobileTransitionTimerRef.current = window.setTimeout(
      () => {
        setMobilePanelExiting(true);
        mobileTransitionTimerRef.current = window.setTimeout(
          () => {
            setRenderedMobilePhase(mobilePhase);
            setRenderedMobileStep(activeIndex);
            setMobilePanelExiting(false);
            mobileTransitionTimerRef.current = null;
          },
          reduceMotion ? 0 : MOBILE_PANEL_OUT_MS,
        );
      },
      0,
    );

    return () => window.clearTimeout(mobileTransitionTimerRef.current);
  }, [
    activeIndex,
    mobileLayout,
    mobilePhase,
    mobileStepReadMs,
    reduceMotion,
    renderedMobilePhase,
    renderedMobileStep,
  ]);

  const descriptionDivsVisible =
    sequenceVisible && mapRevealed && revealed > 0;

  useEffect(() => {
    scrollAccelerationUnlockAtRef.current = sceneReady
      ? performance.now() + SCROLL_ACCELERATION_GRACE_MS
      : Infinity;
  }, [sceneReady]);

  useEffect(() => {
    return () => {
      if (sequenceExitTimerRef.current) {
        window.clearTimeout(sequenceExitTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let frame = null;

    const update = () => {
      frame = null;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 768;
      const readingLine = viewportHeight * 0.52;

      const sceneRect = sceneRef.current?.getBoundingClientRect();
      const holdRect = holdRef.current?.getBoundingClientRect();
      const exitRect = exitRef.current?.getBoundingClientRect();
      const sliderRect = sliderRef.current?.getBoundingClientRect();
      const inScene =
        Boolean(sceneRect) && sceneRect.top < viewportHeight && sceneRect.bottom > 0;

      const releaseGate = engagedRef.current ? viewportHeight * ENGAGE_RELEASE_VH : 0;
      const mobileReleaseGate = engagedRef.current
        ? viewportHeight * 0.28
        : viewportHeight * 0.12;
      const nextMapEngaged =
        inScene &&
        Boolean(sceneRect) &&
        sceneRect.top <= (mobileLayout ? mobileReleaseGate : releaseGate);

      if (mobileLayout) {
        // A fling can physically leave the section before the timed copy has
        // caught up. Complete only after the section is fully behind the
        // viewport so reverse entry cannot restore an incoherent partial beat.
        if (
          sceneRect?.bottom <= 0 &&
          engagedRef.current &&
          !legendOpen &&
          !sequenceComplete
        ) {
          forceComplete();
        }

        const phaseLine = viewportHeight * MOBILE_PHASE_READING_LINE;
        const phaseNodes = mobileTrackRef.current?.querySelectorAll(
          ".hotspot-mobile-beat[data-mobile-phase]",
        );
        let scrollPhase = MOBILE_INTRO_PHASE;
        phaseNodes?.forEach((node) => {
          if (node.getBoundingClientRect().top <= phaseLine) {
            scrollPhase = Number(node.dataset.mobilePhase);
          }
        });

        const introRect = phaseNodes?.[MOBILE_INTRO_PHASE]?.getBoundingClientRect();
        const introProgress = introRect
          ? Math.min(
              1,
              Math.max(0, (phaseLine - introRect.top) / Math.max(1, introRect.height)),
            )
          : 0;
        const scrollRate =
          Math.round((1 + introProgress * (SCROLL_PLAYBACK_MAX - 1)) * 4) / 4;
        const scrollAccelerationReady =
          performance.now() >= scrollAccelerationUnlockAtRef.current;
        setPlaybackRate(
          nextMapEngaged && !sequenceComplete && scrollAccelerationReady
            ? scrollRate
            : 1,
        );

        let nextMobilePhase = sequenceComplete
          ? scrollPhase
          : MOBILE_INTRO_PHASE;
        if (
          mobilePhaseRef.current === MOBILE_INTRO_PHASE &&
          nextMobilePhase > MOBILE_HANDOFF_PHASE
        ) {
          nextMobilePhase = MOBILE_HANDOFF_PHASE;
        }
        if (
          mobilePhaseRef.current === MOBILE_HANDOFF_PHASE &&
          nextMobilePhase > MOBILE_HANDOFF_PHASE &&
          !mobileHandoffAdvanceArmedRef.current
        ) {
          nextMobilePhase = MOBILE_HANDOFF_PHASE;
        }

        if (mobilePhaseRef.current !== nextMobilePhase) {
          if (nextMobilePhase === MOBILE_HANDOFF_PHASE) {
            mobileCameraTouchedRef.current = false;
            mobileHandoffAdvanceArmedRef.current = false;
            setMobileLabelsSuppressed(false);
          }
          if (nextMobilePhase === MOBILE_SLIDER_PHASE) {
            mobileHandoffAdvanceArmedRef.current = false;
          }
          mobilePhaseRef.current = nextMobilePhase;
          setMobilePhase(nextMobilePhase);
        }

        if (sequenceExitTimerRef.current) {
          window.clearTimeout(sequenceExitTimerRef.current);
          sequenceExitTimerRef.current = null;
        }
        if (mapBoxRef.current) {
          const close = sceneRect
            ? Math.min(
                1,
                Math.max(
                  0,
                  (viewportHeight * 1.08 - sceneRect.bottom) /
                    (viewportHeight * 0.72),
                ),
              )
            : 0;
          mapBoxRef.current.style.setProperty("--handoff", close.toFixed(3));
        }

        setSequenceVisible(
          nextMapEngaged && nextMobilePhase === MOBILE_INTRO_PHASE,
        );
        setDescriptionsExited(false);
        setShowAnnotations(
          inScene && nextMobilePhase === MOBILE_HANDOFF_PHASE,
        );
        setShowSlider(inScene && nextMobilePhase === MOBILE_SLIDER_PHASE);
        setExitActive(inScene && nextMobilePhase === MOBILE_HANDOFF_PHASE);
        setHandoff(false);
        setNarrowFrame(false);
        engagedRef.current = nextMapEngaged;
        setMapEngaged(nextMapEngaged);
        if (!nextMapEngaged) setLegendOpen(false);
        return;
      }

      const travelled = holdRect
        ? (viewportHeight - holdRect.top) / Math.max(1, holdRect.height)
        : 0;
      const holdProgress = Math.min(1, Math.max(0, travelled));
      const scrollRate =
        Math.round((1 + holdProgress * (SCROLL_PLAYBACK_MAX - 1)) * 4) / 4;
      const scrollAccelerationReady =
        performance.now() >= scrollAccelerationUnlockAtRef.current;
      setPlaybackRate(
        nextMapEngaged && !sequenceComplete && scrollAccelerationReady
          ? scrollRate
          : 1,
      );

      const pastHold = Boolean(holdRect) && holdRect.bottom <= readingLine;

      if (
        nextMapEngaged &&
        scrollAccelerationReady &&
        pastHold &&
        !sequenceComplete
      ) {
        forceComplete();
      }

      const nextSequenceVisible = nextMapEngaged && !pastHold;
      setSequenceVisible(nextSequenceVisible);

      if (nextSequenceVisible || !nextMapEngaged) {
        if (sequenceExitTimerRef.current) {
          window.clearTimeout(sequenceExitTimerRef.current);
          sequenceExitTimerRef.current = null;
        }
        setDescriptionsExited(false);
      } else if (
        sequenceComplete &&
        !descriptionsExited &&
        !sequenceExitTimerRef.current
      ) {
        sequenceExitTimerRef.current = window.setTimeout(() => {
          sequenceExitTimerRef.current = null;
          setDescriptionsExited(true);
        }, SEQUENCE_OUT_MS);
      }

      const nextShowAnnotations =
        inScene &&
        sequenceComplete &&
        descriptionsExited &&
        Boolean(exitRect) &&
        exitRect.top <= viewportHeight * 0.68;
      const nextShowSlider =
        inScene &&
        sequenceComplete &&
        descriptionsExited &&
        Boolean(sliderRect) &&
        sliderRect.top <= viewportHeight * 0.58;
      const nextHandoff =
        inScene &&
        Boolean(sceneRect) &&
        sceneRect.bottom <= viewportHeight * 2;

      if (mapBoxRef.current) {
        const close = sceneRect
          ? Math.min(
              1,
              Math.max(0, (viewportHeight * 2 - sceneRect.bottom) / viewportHeight),
            )
          : 0;
        mapBoxRef.current.style.setProperty("--handoff", close.toFixed(3));
      }

      setShowAnnotations((nextShowAnnotations || nextShowSlider) && !nextHandoff);
      setShowSlider(nextShowSlider && !nextHandoff);
      setExitActive(nextShowAnnotations && !nextShowSlider);
      setHandoff(nextHandoff);
      setNarrowFrame(window.innerWidth < NARROW_MAX_WIDTH);
      engagedRef.current = nextMapEngaged;
      setMapEngaged(nextMapEngaged);
      if (!nextMapEngaged) setLegendOpen(false);
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
  }, [
    mapRevealed,
    sequenceComplete,
    descriptionsExited,
    forceComplete,
    goTo,
    hotspotSteps.length,
    legendOpen,
    mobileLayout,
  ]);

  const zoomShift = narrowFrame ? NARROW_ZOOM_SHIFT : 0;

  useEffect(() => {
    if (!map) return;
    if (mobileLayout) {
      if (mobileCameraConfigRef.current?.map === map) return;
      const originalMinZoom = map.getMinZoom();
      const originalMaxZoom = map.getMaxZoom();
      const originalMaxBounds = map.getMaxBounds()?.toArray?.() ?? null;

      map.fitBounds(MOBILE_BOLOGNA_BOUNDS, {
        padding: getMobileCameraPadding(),
        duration: 0,
      });
      const initialZoom = map.getZoom();
      const initialBounds = map.getBounds().toArray();
      map.setMinZoom(initialZoom);
      map.setMaxZoom(MOBILE_MAX_ZOOM);
      map.setMaxBounds(initialBounds);
      mobileCameraConfigRef.current = {
        map,
        initialZoom,
        initialBounds,
        originalMinZoom,
        originalMaxZoom,
        originalMaxBounds,
      };
      mobileCameraTouchedRef.current = false;
      lastZoomRef.current = "mobile-bologna";
      return;
    }

    const mobileConfig = mobileCameraConfigRef.current;
    if (mobileConfig?.map === map) {
      map.setMaxBounds(mobileConfig.originalMaxBounds);
      map.setMinZoom(mobileConfig.originalMinZoom);
      map.setMaxZoom(mobileConfig.originalMaxZoom);
      mobileCameraConfigRef.current = null;
      mobileCameraTouchedRef.current = false;
      lastZoomRef.current = null;
    }
    if (engagedRef.current) return;
    map.jumpTo({ center: BOLOGNA_CENTER, zoom: BOLOGNA_ZOOM_INTRO + zoomShift });
  }, [map, mobileLayout, zoomShift]);

  useEffect(() => {
    if (!map || !mobileLayout) return undefined;

    const onUserCameraChange = (event) => {
      if (!event.originalEvent) return;
      mobileCameraTouchedRef.current = true;
      if (mobilePhase === MOBILE_HANDOFF_PHASE) {
        setMobileLabelsSuppressed(true);
      }
    };

    map.on("zoomstart", onUserCameraChange);
    map.on("dragstart", onUserCameraChange);
    return () => {
      map.off("zoomstart", onUserCameraChange);
      map.off("dragstart", onUserCameraChange);
    };
  }, [map, mobileLayout, mobilePhase]);

  useEffect(() => {
    if (!map || !mapEngaged || !veilLifted) return;
    const step = hotspotStepSpecs[activeIndex];
    if (mobileLayout) {
      if (
        mobilePhase !== MOBILE_INTRO_PHASE ||
        mobileCameraTouchedRef.current
      ) {
        return;
      }
      const persistence = step.id === "persistence";
      const cameraKey = persistence ? "mobile-persistence" : "mobile-bologna";
      if (lastZoomRef.current === cameraKey) return;
      lastZoomRef.current = cameraKey;
      map.fitBounds(
        persistence
          ? MOBILE_BOLOGNA_PERSISTENCE_BOUNDS
          : MOBILE_BOLOGNA_BOUNDS,
        {
          padding: getMobileCameraPadding(),
          duration: reduceMotion ? 0 : CAMERA_MS / playbackRate,
          easing: cameraEasing,
        },
      );
      return;
    }
    const zoom =
      (step.id === "persistence" ? BOLOGNA_ZOOM_PERSISTENCE : BOLOGNA_ZOOM) +
      zoomShift;
    if (lastZoomRef.current === zoom) return;
    lastZoomRef.current = zoom;
    map.easeTo({
      center: BOLOGNA_CENTER,
      zoom,
      duration: reduceMotion ? 0 : CAMERA_MS / playbackRate,
      easing: cameraEasing,
    });
  }, [
    map,
    activeIndex,
    mapEngaged,
    veilLifted,
    mobileLayout,
    zoomShift,
    reduceMotion,
    playbackRate,
    mobilePhase,
  ]);

  useEffect(() => {
    if (
      !map ||
      !mobileLayout ||
      mobilePhase !== MOBILE_HANDOFF_PHASE ||
      !mobileCameraConfigRef.current
    ) {
      return;
    }

    lastZoomRef.current = "mobile-bologna";
    map.fitBounds(MOBILE_BOLOGNA_BOUNDS, {
      padding: getMobileCameraPadding(),
      duration: reduceMotion ? 0 : CAMERA_MS,
      easing: cameraEasing,
    });
  }, [map, mobileLayout, mobilePhase, reduceMotion]);

  useEffect(() => {
    if (!mapEngaged) {
      // Once the mobile scene has been revealed, keep its visual state warm.
      // Re-entering from below must restore the active beat immediately rather
      // than replaying the white veil/legend entrance over the saved phase.
      if (mobileLayout && mobileRevealPlayedRef.current) return undefined;
      const drop = setTimeout(() => {
        setVeilLifted(false);
        setMapRevealed(false);
        setLegendReady(false);
      }, 0);
      return () => clearTimeout(drop);
    }
    if (!sceneReady) return undefined;
    if (mobileLayout && mobileRevealPlayedRef.current) {
      setBordersReady(true);
      setVeilLifted(true);
      setFillsReady(true);
      setMapRevealed(true);
      setLegendReady(true);
      return undefined;
    }
    const timers = [
      setTimeout(() => setBordersReady(true), BORDERS_MS),
      setTimeout(() => setVeilLifted(true), reduceMotion ? 0 : VEIL_LIFT_MS),
      setTimeout(() => setFillsReady(true), reduceMotion ? 0 : FILLS_MS),
      setTimeout(() => {
        if (mobileLayout) mobileRevealPlayedRef.current = true;
        setMapRevealed(true);
      }, reduceMotion ? 0 : VEIL_DONE_MS),
      setTimeout(() => setLegendReady(true), reduceMotion ? 0 : LEGEND_MS),
    ];
    return () => timers.forEach(clearTimeout);
  }, [mapEngaged, mobileLayout, sceneReady, reduceMotion]);


  const stopSliderDemo = useCallback(() => {
    demoTimersRef.current.forEach(clearTimeout);
    demoTimersRef.current = [];
  }, []);

  useEffect(() => {
    if (!showSlider || demoStartedRef.current) return;
    demoStartedRef.current = true;
    const beats = [
      [700, 8], [840, 7], [980, 6],
      [1580, 7], [1720, 8], [1860, 9],
    ];
    demoTimersRef.current = beats.map(([at, value]) =>
      setTimeout(() => setSliderValue(value), at),
    );
  }, [showSlider]);

  useEffect(() => () => demoTimersRef.current.forEach(clearTimeout), []);

  const onSliderPick = useCallback(
    (value) => {
      stopSliderDemo();
      setSliderValue(value);
      setSliderTouched(true);
    },
    [stopSliderDemo],
  );

  useEffect(() => {
    if (!map) return;
    const legacyIds = ["hotspot-slider-src", "hotspot-slider-fill"];
    legacyIds.forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
    });
    const sliderLayerId = (threshold) => `hotspot-slider-fill-${threshold}`;
    const sliderSourceId = (threshold) => `hotspot-slider-src-${threshold}`;
    sliderThresholds.forEach((threshold) => {
      const layerId = sliderLayerId(threshold);
      const sourceId = sliderSourceId(threshold);
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    });
  }, [map]);

  const narrativeVisible = mapEngaged;

  const narrativeMinYears = showSlider
    ? sliderValue
    : hotspotStepSpecs[activeIndex]?.minYears ?? 3;
  const narrativeOpacity = showSlider
    ? 0.9
    : hotspotStepSpecs[activeIndex]?.opacity ?? 0.82;
  const narrativeThresholdTemplate =
    narrativeMinYears === 1
      ? hotspotMapCopy.legend.active.one
      : hotspotMapCopy.legend.active.other;
  const narrativeThresholdText = fillNumberTemplate(
    narrativeThresholdTemplate,
    narrativeMinYears,
  );
  const activeTier = getHotspotPersistenceColor(narrativeMinYears);
  const goToMobileStep = useCallback(
    (index) => {
      goTo(Math.max(0, Math.min(hotspotSteps.length - 1, index)));
    },
    [goTo, hotspotSteps.length],
  );
  const legendStyle = {
    "--legend-t": String((narrativeMinYears - 1) / 12),
    "--tier": activeTier,
  };
  const legendBody = (
    <>
      <span className="hotspot-legend-title">
        {hotspotMapCopy.legend.title}
      </span>
      <strong className="hotspot-legend-active">
        {narrativeThresholdText}
      </strong>
      <span className="hotspot-legend-bar">
        <span className="hotspot-legend-bar-dim" />
        <span className="hotspot-legend-bar-marker" />
      </span>
      <div className="hotspot-legend-scale">
        <span>{hotspotMapCopy.legend.scale.min}</span>
        <span>{hotspotMapCopy.legend.scale.max}</span>
      </div>
      <span className="hotspot-legend-caption">
        {hotspotMapCopy.legend.caption}
      </span>
      <a
        className="hotspot-legend-link"
        href={editorialLinks.hotspot.data}
        target="_blank"
        rel="noopener noreferrer"
      >
        {hotspotMapCopy.legend.sourceLink.label} →
      </a>
    </>
  );

  const sequencePanel = (
    <div
      className={`hotspot-sequence${mobileLayout ? " hotspot-sequence--mobile" : ""}${descriptionDivsVisible ? " hotspot-sequence--in" : " hotspot-sequence--out"}${sequenceComplete ? " hotspot-sequence--complete" : ""}`}
      data-motion="story"
    >
      <div className="hotspot-sequence-stack">
        {hotspotSteps.map((step, i) => {
          const isActive = i === activeIndex;
          return (
            <button
              key={step.id}
              type="button"
              className={`hotspot-seq-item${isActive ? " is-active" : " is-dim"}`}
              style={{ "--tier": getHotspotPersistenceColor(step.minYears) }}
              onClick={() => goTo(i)}
              aria-pressed={isActive}
            >
              {step.paragraphs.map((paragraph) => (
                <span key={paragraph.id} className="hotspot-seq-text">
                  <CopySegments
                    parts={paragraph.segments}
                    kwClass="hotspot-seq-kw"
                  />
                </span>
              ))}
            </button>
          );
        })}
      </div>

      <div className="hotspot-sequence-meta">
        <div
          className={`hotspot-sequence-foot${revealed > 0 ? " hotspot-sequence-foot--live" : ""}${sequenceComplete ? " hotspot-sequence-foot--done" : ""}`}
          aria-hidden={sequenceComplete ? undefined : "true"}
        >
          <div className="hotspot-seq-dots">
            {hotspotSteps.map((step, i) => {
              const isDone = i < revealed;
              const isCurrent = i === activeIndex;
              const isCounting =
                selected == null && !sequenceComplete && i === revealed - 1;
              return (
                <span
                  key={step.id}
                  className={`hotspot-seq-dot-step${isDone ? " is-done" : ""}${isCurrent ? " is-current" : ""}`}
                  style={{ "--tier": getHotspotPersistenceColor(step.minYears) }}
                >
                  {isCounting && (
                    <svg
                      className="hotspot-seq-dot-ring"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      focusable="false"
                      style={{
                        "--step-ms": `${
                          (i === hotspotSteps.length - 1
                            ? TAIL_MS
                            : hotspotStepReadMs[i]) / playbackRate
                        }ms`,
                      }}
                    >
                      <circle cx="12" cy="12" r="10" />
                    </svg>
                  )}
                </span>
              );
            })}
          </div>
          <span className="hotspot-sequence-caption">
            {sequenceComplete
              ? hotspotMapCopy.sequence.done
              : hotspotMapCopy.sequence.playing}
          </span>
          {!mobileLayout && sequenceComplete && (
            <ScrollCue variant="light" className="hotspot-sequence-cue" />
          )}
        </div>

        {mobileLayout && (
          <div className="hotspot-sequence-controls">
            <button
              type="button"
              className="hotspot-sequence-control"
              onClick={() => goTo(activeIndex - 1)}
              disabled={activeIndex === 0}
              aria-label={uiContent.actions.previousItem}
            >
              <span aria-hidden="true">←</span>
            </button>
            <button
              type="button"
              className="hotspot-sequence-control"
              onClick={() => goTo(activeIndex + 1)}
              disabled={activeIndex === hotspotSteps.length - 1}
              aria-label={uiContent.actions.nextItem}
            >
              <span aria-hidden="true">→</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const sliderControl = (
    <div
      className="hotspot-slider"
      style={{ "--slider-t": String((sliderValue - 1) / 12) }}
    >
      <div className="hotspot-slider-head">
        <label className="hotspot-slider-label" htmlFor="ricorrenza-slider">
          {hotspotMapCopy.slider.label}
        </label>
        <strong className="hotspot-slider-badge">
          {fillNumberTemplate(hotspotMapCopy.slider.valueTemplate, sliderValue)}
        </strong>
      </div>
      <div className="hotspot-slider-row">
        <input
          id="ricorrenza-slider"
          type="range"
          min={1}
          max={13}
          step={1}
          value={sliderValue}
          onChange={(e) => onSliderPick(Number(e.target.value))}
          onInput={(e) => onSliderPick(Number(e.currentTarget.value))}
          className="hotspot-slider-input"
        />
      </div>
      <div className="hotspot-slider-marks">
        {sliderMarks.map((mark) => (
          <button
            key={mark}
            type="button"
            className={`hotspot-slider-mark${sliderValue === mark ? " hotspot-slider-mark--active" : ""}`}
            style={{ "--mark-t": String((mark - 1) / 12) }}
            onClick={() => onSliderPick(mark)}
            aria-label={fillNumberTemplate(
              hotspotMapCopy.slider.markLabelTemplate,
              mark,
            )}
          >
            {mark}
          </button>
        ))}
      </div>
    </div>
  );

  const activeMobileStep =
    hotspotSteps[Math.min(renderedMobileStep, hotspotSteps.length - 1)];
  const mobileStoryPanel = (
    <div
      className={`hotspot-mobile-story hotspot-mobile-story--phase-${renderedMobilePhase}${mobilePanelExiting ? " is-exiting" : ""}`}
      style={{
        "--tier":
          renderedMobilePhase === MOBILE_INTRO_PHASE
            ? getHotspotPersistenceColor(activeMobileStep.minYears)
            : "var(--talea-dark-green)",
      }}
      data-motion="story"
    >
      {renderedMobilePhase === MOBILE_INTRO_PHASE && (
        <div className="hotspot-mobile-story-card hotspot-mobile-story-card--step">
          <span className="hotspot-mobile-story-marker" aria-hidden="true" />
          <div className="hotspot-mobile-story-copy">
            {activeMobileStep.paragraphs.map((paragraph) => (
              <span key={paragraph.id} className="hotspot-mobile-story-text">
                <CopySegments
                  parts={paragraph.segments}
                  kwClass="hotspot-seq-kw"
                />
              </span>
            ))}
          </div>
        </div>
      )}

      {renderedMobilePhase === MOBILE_HANDOFF_PHASE && (
        <div className="hotspot-mobile-context-stack">
          <div className="hotspot-mobile-story-card hotspot-mobile-story-card--handoff">
            <h3 className="hotspot-mobile-handoff">
              {hotspotMapCopy.handoff.question}
            </h3>
          </div>
          <div
            className="hotspot-mobile-context-cue hotspot-mobile-context-cue--handoff"
            role="status"
            aria-live="polite"
          >
            <span>{uiContent.localStory.hotspotToComparison}</span>
          </div>
        </div>
      )}

      {renderedMobilePhase === MOBILE_SLIDER_PHASE && (
        <div className="hotspot-mobile-slider-stack">
          {sliderControl}
          <div
            className={`hotspot-mobile-context-cue hotspot-mobile-context-cue--slider${
              sliderTouched ? " is-interacted" : ""
            }`}
            role="status"
            aria-live="polite"
          >
            <span>{uiContent.localStory.hotspotToExit}</span>
          </div>
        </div>
      )}

      {renderedMobilePhase === MOBILE_INTRO_PHASE && (
        <div
          className={`hotspot-mobile-story-nav${sequenceComplete ? " hotspot-mobile-story-nav--complete" : ""}`}
        >
          <div className="hotspot-mobile-nav-copy">
            <LocalStoryProgress
              ref={mobileProgressRef}
              className="hotspot-local-progress"
              currentStep={activeIndex}
              stepCount={hotspotSteps.length}
              labelTemplate={uiContent.localStory.stepLabelTemplate}
            />
            {sequenceComplete && (
              <span className="hotspot-mobile-sequence-status">
                {uiContent.map.hotspotSequenceDone}
              </span>
            )}
          </div>
          <div className="hotspot-sequence-controls">
            <button
              type="button"
              className="hotspot-sequence-control"
              onClick={() => goToMobileStep(activeIndex - 1)}
              disabled={activeIndex === 0}
              aria-label={uiContent.actions.previousItem}
            >
              <span aria-hidden="true">{"\u2190"}</span>
            </button>
            <button
              type="button"
              className="hotspot-sequence-control"
              onClick={() => goToMobileStep(activeIndex + 1)}
              disabled={activeIndex === hotspotSteps.length - 1}
              aria-label={uiContent.actions.nextItem}
            >
              <span aria-hidden="true">{"\u2192"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <section ref={sceneRef} className="hotspot-scene" aria-label={hotspotMapCopy.ariaLabel}>
      <div
        ref={mapBoxRef}
        className={`hotspot-scene-map${mapEngaged ? " hotspot-scene-map--engaged" : ""}`}
      >
        <MapLibreCanvas
          onMapReady={onMapReady}
          className="hotspot-canvas"
          zoom={BOLOGNA_ZOOM_INTRO}
          maxZoom={mobileLayout ? MOBILE_MAX_ZOOM : 16}
          interactive={mobileLayout}
          cooperativeGestures={mobileLayout}
          locale={mapLibreLocale}
          collapseAttribution={mobileLayout}
          hideLabels
        />

        <HotspotLayer
          map={map}
          id="narrative"
          minYears={narrativeMinYears}
          opacity={narrativeOpacity}
          visible={narrativeVisible && fillsReady}
          transitionMs={1100 / playbackRate}
        />

        <BolognaBoundaryLayer map={map} visible={bordersReady} />

        <div className={`hotspot-map-veil${veilLifted ? " hotspot-map-veil--hidden" : ""}`} aria-hidden="true" />

        <div className="hotspot-map-veil-close" aria-hidden="true" />

        {mobileLayout &&
          mobileGestureHintVisible &&
          mobilePhase === MOBILE_INTRO_PHASE &&
          renderedMobilePhase === MOBILE_INTRO_PHASE && (
          <div
            className="hotspot-mobile-gesture-hint"
            role="status"
            aria-live="polite"
          >
            <span>{uiContent.map.cooperativeGestures.mobile}</span>
          </div>
        )}

        <AnnotationLayer
          map={map}
          active={mapEngaged && showAnnotations}
          showNarrative={
            mapEngaged &&
            showAnnotations &&
            (mobileLayout ? !mobileLabelsSuppressed : !sliderTouched)
          }
          ariaLabel={hotspotMapCopy.annotations.ariaLabel}
          mobile={mobileLayout}
        />

        {!mobileLayout && mapEngaged && sequencePanel}
        {mobileLayout &&
          mapEngaged &&
          mapRevealed &&
          (mobilePhase !== MOBILE_INTRO_PHASE || revealed > 0) &&
          mobileStoryPanel}

        {mapEngaged && legendReady && !handoff && !mobileLayout && (
          <div className="hotspot-legend" style={legendStyle}>
            {legendBody}
          </div>
        )}

        {mapEngaged && legendReady && !handoff && mobileLayout && (
          <>
            <button
              type="button"
              className="hotspot-legend-toggle"
              aria-expanded={legendOpen}
              aria-label={uiContent.map.legend}
              onClick={() => setLegendOpen(true)}
            >
              <span className="hotspot-legend-toggle-icon" aria-hidden="true">i</span>
              <span>{uiContent.map.legend}</span>
            </button>
            {legendOpen && (
              <div
                className="hotspot-legend-overlay"
                onClick={() => setLegendOpen(false)}
              >
                <div
                  className="hotspot-legend hotspot-legend--mobile"
                  style={legendStyle}
                  role="dialog"
                  aria-modal="true"
                  aria-label={hotspotMapCopy.legend.title}
                  onClick={(event) => event.stopPropagation()}
                >
                  <button
                    type="button"
                    className="hotspot-legend-close"
                    aria-label={uiContent.actions.close}
                    onClick={() => setLegendOpen(false)}
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                  {legendBody}
                </div>
              </div>
            )}
          </>
        )}

        {!mobileLayout && showSlider && sliderControl}

      </div>

      {mobileLayout ? (
        <div className="hotspot-scene-panels hotspot-scene-panels--mobile" aria-hidden="true">
          <div ref={mobileTrackRef} className="hotspot-mobile-track">
            {Array.from({ length: MOBILE_PHASE_COUNT }, (_, index) => (
              <div
                key={index}
                className={`hotspot-mobile-beat${index === MOBILE_INTRO_PHASE ? " hotspot-mobile-beat--intro" : index === MOBILE_HANDOFF_PHASE ? " hotspot-mobile-beat--handoff" : " hotspot-mobile-beat--slider"}`}
                data-mobile-phase={index}
              />
            ))}
            <div className="hotspot-mobile-track-tail" />
          </div>
        </div>
      ) : (
        <div className="hotspot-scene-panels">
          <div className="hotspot-entry-runway" aria-hidden="true" />
          <div ref={holdRef} className="hotspot-sequence-hold" aria-hidden="true" />

          <div
            ref={exitRef}
            className={`hotspot-panel--exit${exitActive ? " hotspot-panel--active" : ""}`}
          >
            <div className="hotspot-exit-wrapper">
              <h3 className="hotspot-exit-phrase">{hotspotMapCopy.handoff.question}</h3>
            </div>
          </div>

          <div ref={sliderRef} className="hotspot-slider-hold" aria-hidden="true" />
          <div className="hotspot-tail-hold" aria-hidden="true" />
        </div>
      )}
    </section>
  );
}

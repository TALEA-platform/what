import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { MapLibreCanvas } from "../maps/MapLibreCanvas";
import { HotspotLayer } from "../maps/HotspotLayer";
import { AnnotationLayer } from "../maps/AnnotationLayer";
import { BolognaBoundaryLayer } from "../maps/BolognaBoundaryLayer";
import { ScrollCue } from "../ui/ScrollCue";
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

export function HotspotMapScene() {
  const { content } = useContent();
  const hotspotMapCopy = content.hotspot.map;
  const { steps: hotspotSteps, readMs: hotspotStepReadMs } = useMemo(
    () => buildHotspotSteps(content),
    [content],
  );
  const [map, setMap] = useState(null);
  const [narrowFrame, setNarrowFrame] = useState(false);
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
  const mapBoxRef = useRef(null);
  const engagedRef = useRef(false);
  const lastZoomRef = useRef(null);
  const scrollAccelerationUnlockAtRef = useRef(Infinity);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (event) => setReduceMotion(event.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

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
  } = useTimedSequence({
    count: hotspotSteps.length,
    engaged: sceneReady,
    startDelay: reduceMotion ? START_DELAY_REDUCED : START_DELAY,
    readMs: hotspotStepReadMs,
    tailMs: TAIL_MS,
    pickDuringPlay: true,
    playbackRate,
  });

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

      const mobileLayout = window.matchMedia("(max-width: 768px)").matches;
      const releaseGate = engagedRef.current ? viewportHeight * ENGAGE_RELEASE_VH : 0;
      const nextMapEngaged =
        inScene &&
        (mobileLayout || (Boolean(sceneRect) && sceneRect.top <= releaseGate));

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
        inScene && Boolean(sceneRect) && sceneRect.bottom <= viewportHeight * 2;

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
  }, [mapRevealed, sequenceComplete, descriptionsExited, forceComplete]);

  const zoomShift = narrowFrame ? NARROW_ZOOM_SHIFT : 0;

  useEffect(() => {
    if (!map || engagedRef.current) return;
    map.jumpTo({ center: BOLOGNA_CENTER, zoom: BOLOGNA_ZOOM_INTRO + zoomShift });
  }, [map, zoomShift]);

  useEffect(() => {
    if (!map || !mapEngaged || !veilLifted) return;
    const step = hotspotStepSpecs[activeIndex];
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
    zoomShift,
    reduceMotion,
    playbackRate,
  ]);

  useEffect(() => {
    if (!mapEngaged) {
      const drop = setTimeout(() => {
        setVeilLifted(false);
        setMapRevealed(false);
        setLegendReady(false);
      }, 0);
      return () => clearTimeout(drop);
    }
    if (!sceneReady) return undefined;
    const timers = [
      setTimeout(() => setBordersReady(true), BORDERS_MS),
      setTimeout(() => setVeilLifted(true), reduceMotion ? 0 : VEIL_LIFT_MS),
      setTimeout(() => setFillsReady(true), reduceMotion ? 0 : FILLS_MS),
      setTimeout(() => setMapRevealed(true), reduceMotion ? 0 : VEIL_DONE_MS),
      setTimeout(() => setLegendReady(true), reduceMotion ? 0 : LEGEND_MS),
    ];
    return () => timers.forEach(clearTimeout);
  }, [mapEngaged, sceneReady, reduceMotion]);


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

        <AnnotationLayer
          map={map}
          active={mapEngaged && showAnnotations}
          showNarrative={mapEngaged && showAnnotations && !sliderTouched}
          ariaLabel={hotspotMapCopy.annotations.ariaLabel}
        />

        {mapEngaged && (
          <div
            className={`hotspot-sequence${descriptionDivsVisible ? " hotspot-sequence--in" : " hotspot-sequence--out"}${sequenceComplete ? " hotspot-sequence--complete" : ""}`}
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
              {sequenceComplete && (
                <ScrollCue variant="light" className="hotspot-sequence-cue" />
              )}
            </div>
          </div>
        )}

        {mapEngaged && legendReady && !handoff && (
          <div
            className="hotspot-legend"
            style={{
              "--legend-t": String((narrativeMinYears - 1) / 12),
              "--tier": activeTier,
            }}
          >
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
          </div>
        )}

        {showSlider && (
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
        )}

      </div>

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
    </section>
  );
}

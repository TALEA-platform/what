import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { MapLibreCanvas } from "../maps/MapLibreCanvas";
import { useTimedSequence } from "../../hooks/useTimedSequence";
import {
  CAMERA_MS,
  SCROLL_ACCELERATION_GRACE_MS,
  cameraEasing,
} from "../../lib/motion";
import { SequenceStepper } from "../ui/SequenceStepper";
import { ScrollCue } from "../ui/ScrollCue";
import {
  getShadowStageReadMs,
  shadowMetricLayout,
  shadowScene as shadowSceneTechnical,
} from "../../data/shadowFocus";
import { vicoloSvg } from "../../data/shadowVignette";
import { assetUrl } from "../../lib/assetUrl";
import { editorialLinks, useContent } from "../../content";

const bolognaBoundaryUrl = assetUrl("/data/vectors/bologna_boundary_outline.geojson");

const VICOLO_HTML = { __html: vicoloSvg };

const START_DELAY = 1200;
const TAIL_MS = 600;
const SCROLL_PLAYBACK_MAX = 4;

const COLOR_AFTER_MS = 560;

const COUNT_MS = 900;
const COUNT_STAGGER_MS = 250;

const CENTRO_TONE = "#E0C24B";
const CENTRO_VEIL_TONE = "#FFE604";

const STAGE_TONES = ["#1272B7", CENTRO_TONE];

const CENTRO_VEIL_OPACITY = 0.18;
const CENTRO_VEIL_IN_MS = 600;
const CENTRO_VEIL_HOLD_MS = 1500;
const CENTRO_VEIL_OUT_MS = 1100;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

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


function CountUp({ target, delay, run }) {
  const end = Number.parseFloat(target);
  const reducedMotion = prefersReducedMotion();
  const [shown, setShown] = useState(null);

  useEffect(() => {
    if (!run || !Number.isFinite(end)) return undefined;
    if (reducedMotion) return undefined;
    let frame = null;
    const startTimer = window.setTimeout(() => {
      const t0 = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - t0) / COUNT_MS);
        setShown(end * (1 - Math.pow(1 - t, 3)));
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, delay);
    return () => {
      window.clearTimeout(startTimer);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [run, end, delay, reducedMotion]);

  if (!Number.isFinite(end)) return <>{target}</>;
  const display = reducedMotion ? end : (shown ?? (run ? 0 : end));
  return <>{`${Math.round(display)}\u00a0%`}</>;
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
  const [run, setRun] = useState(prefersReducedMotion);

  useEffect(() => {
    const el = stripRef.current;
    if (!el || run) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          io.unobserve(entry.target);
          setRun(true);
        });
      },
      { threshold: 0, rootMargin: "0px 0px -22% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [run]);

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

function SceneDarkMap({ cameraKey, engaged, playbackRate }) {
  const [map, setMap] = useState(null);
  const handleReady = useCallback((m) => setMap(m), []);

  const centroProminent = cameraKey === "centro";
  const playbackRateRef = useRef(playbackRate);
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
    const camera =
      shadowSceneTechnical.stages.find((s) => s.id === cameraKey)?.camera ?? shadowSceneTechnical.opening;
    map.easeTo({
      center: camera.center,
      zoom: camera.zoom,
      duration: prefersReducedMotion() ? 0 : CAMERA_MS / playbackRate,
      easing: cameraEasing,
      essential: true,
    });

    const centroOpacity = {
      "scene-centro-glow": 0.42,
      "scene-centro-casing": 0.88,
      "scene-centro-line": 1,
    };
    Object.entries(centroOpacity).forEach(([layerId, opacity]) => {
      if (!map.getLayer(layerId)) return;
      map.setPaintProperty(layerId, "line-opacity-transition", {
        duration: 700 / playbackRate,
      });
      map.setPaintProperty(layerId, "line-opacity", centroProminent ? opacity : 0);
    });
  }, [map, cameraKey, centroProminent, playbackRate]);

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

  return (
    <MapLibreCanvas
      onMapReady={handleReady}
      className="sf-scene-canvas"
      mapStyle={darkOpenfreemapStyle}
      center={shadowSceneTechnical.opening.center}
      zoom={shadowSceneTechnical.opening.zoom}
      minZoom={10.4}
      maxZoom={15}
    />
  );
}


export function ShadowFocusSection() {
  const { content, locale } = useContent();
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

  const sceneRef = useRef(null);
  const holdRef = useRef(null);
  const scrollAccelerationUnlockAtRef = useRef(Infinity);

  const stages = shadowScene.stages;
  const {
    revealed,
    complete,
    activeIndex,
    goTo,
  } = useTimedSequence({
    count: stages.length,
    engaged,
    startDelay: START_DELAY,
    readMs: shadowStageReadMs,
    tailMs: TAIL_MS,
    pickDuringPlay: true,
    playbackRate,
  });

  const cameraKey = engaged ? stages[activeIndex].id : "opening";

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
      const mobileLayout = window.matchMedia("(max-width: 720px)").matches;
      const revealLine = mobileLayout ? 0.62 : 0.55;
      const nextEngaged = inScene && sceneRect.top <= vh * revealLine;

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
  }, [complete]);

  const values = useMemo(() => {
    if (!aggregates?.metrics) return null;
    return shadowTable.metrics.every((m) => aggregates.metrics[m.key])
      ? aggregates.metrics
      : null;
  }, [aggregates, shadowTable]);

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
        <div className={`sf-scene-map${engaged ? " sf-scene-map--engaged" : ""}${exitVeil ? " sf-scene-map--exiting" : ""}`}>
          <SceneDarkMap
            cameraKey={cameraKey}
            engaged={engaged}
            playbackRate={playbackRate}
          />
          <div className="sf-scene-frame" aria-hidden="true" />
          <div className="sf-scene-exit-veil" aria-hidden="true" />
          <div className="sf-scene-legend">
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
          </div>

          {engaged && (
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
        </div>

        <div className="sf-scene-flow">
          <div ref={holdRef} className="sf-sequence-hold" aria-hidden="true" />
          <div className="sf-scene-buffer" aria-hidden="true" />
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

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

// Stable objects stop React reinjecting SVG innerHTML and erasing animation classes.
const PLAN_HTML = { __html: cityPlanSvg };
const VIGNETTE_HTML = Object.fromEntries(
  Object.entries(planVignettes).map(([key, markup]) => [
    key,
    { __html: markup },
  ]),
);

const READING_LINE = 0.56;

// Coupled to generated vignette steps and their CSS draw duration.
const VIGNETTE_STEP_MS = 420;
const VIGNETTE_ENTER_MS = 720;
const VIGNETTE_FIRST_STEP_MS = 620;
const MAP_HANDOFF_MS = 320;
// Must match the Framer Motion exit duration used for the vignette.
const VIGNETTE_EXIT_MS = 720;
const MOBILE_LAYER_EXIT_FALLBACK_MS = 700;

const LINK_R = 30;

const VIGNETTE_PLACE = {
  costruire: "top",
  corridoio: "top",
  portico: "bottom",
};
const COPY_SIDES = ["left", "right"];
const COPY_BLEND_VH = 0.26;

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const lerp = (from, to, amount) => from + (to - from) * amount;
const smoothstep = (value) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

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

function MobileVignetteHandoff({
  name,
  place,
  vignetteSide,
  ratio,
  html,
  complete,
  bindCurrentNode,
}) {
  const sequenceRef = useRef(0);
  const targetNameRef = useRef(null);
  const [layers, setLayers] = useState([]);

  useLayoutEffect(() => {
    const nextName = name ?? null;
    if (targetNameRef.current === nextName) return;
    targetNameRef.current = nextName;

    setLayers((current) => {
      if (!nextName) {
        return current
          .slice(-2)
          .map((layer) => ({ ...layer, phase: "exiting" }));
      }

      const nextLayer = {
        name: nextName,
        place,
        vignetteSide,
        ratio,
        html,
      };
      const existing = current.find((layer) => layer.name === nextName);
      if (existing) {
        const outgoing = current
          .filter((layer) => layer.name !== nextName)
          .slice(-1)
          .map((layer) => ({ ...layer, phase: "exiting" }));
        return [
          ...outgoing,
          { ...existing, ...nextLayer, phase: "visible" },
        ];
      }

      const outgoing = current.slice(-1);
      sequenceRef.current += 1;
      return [
        ...outgoing,
        {
          ...nextLayer,
          id: `${nextName}-${sequenceRef.current}`,
          phase: "preparing",
        },
      ];
    });
  }, [html, name, place, ratio, vignetteSide]);

  useEffect(() => {
    const preparing = layers.find((layer) => layer.phase === "preparing");
    if (!preparing) return undefined;

    const frame = requestAnimationFrame(() => {
      setLayers((current) =>
        current.map((layer) =>
          layer.id === preparing.id
            ? { ...layer, phase: "visible" }
            : { ...layer, phase: "exiting" },
        ),
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [layers]);

  useEffect(() => {
    if (
      targetNameRef.current ||
      !layers.some((layer) => layer.phase === "exiting")
    ) return undefined;
    const id = window.setTimeout(() => {
      setLayers((current) =>
        current.filter((layer) => layer.phase !== "exiting"),
      );
    }, MOBILE_LAYER_EXIT_FALLBACK_MS);
    return () => window.clearTimeout(id);
  }, [layers]);

  const handleTransitionEnd = useCallback((event, layerId) => {
    if (
      event.target !== event.currentTarget ||
      event.propertyName !== "opacity"
    ) return;

    setLayers((current) => {
      const completed = current.find((layer) => layer.id === layerId);
      if (!completed) return current;
      if (completed.phase === "visible") {
        return current.filter((layer) => layer.phase !== "exiting");
      }
      if (completed.phase === "exiting" && !targetNameRef.current) {
        return current.filter((layer) => layer.id !== layerId);
      }
      return current;
    });
  }, []);

  return layers.map((layer) => {
    const isCurrent = layer.name === name && layer.phase !== "exiting";
    return (
      <div
        ref={isCurrent ? bindCurrentNode : undefined}
        key={layer.id}
        className={`plan-vignette plan-vignette--mobile plan-vignette--${layer.place} plan-vignette--${layer.vignetteSide}${
          isCurrent && !complete ? " is-building" : ""
        }`}
        style={{ "--ratio": layer.ratio }}
        data-mobile-vignette-phase={layer.phase}
        data-vignette={layer.name}
        onTransitionEnd={(event) => handleTransitionEnd(event, layer.id)}
        aria-hidden="true"
      >
        <div
          className="plan-vignette-art"
          dangerouslySetInnerHTML={layer.html}
        />
      </div>
    );
  });
}

function MobileLinkHandoff({ geometry, ready, linkRef }) {
  const sequenceRef = useRef(0);
  const targetNameRef = useRef(null);
  const [layers, setLayers] = useState([]);
  const name = geometry?.name ?? null;

  useLayoutEffect(() => {
    if (targetNameRef.current === name) return;
    targetNameRef.current = name;

    setLayers((current) => {
      if (!name) {
        return current
          .slice(-2)
          .map((layer) => ({ ...layer, phase: "exiting" }));
      }

      const existing = current.find((layer) => layer.name === name);
      if (existing) {
        const outgoing = current
          .filter((layer) => layer.name !== name)
          .slice(-1)
          .map((layer) => ({ ...layer, phase: "exiting" }));
        return [
          ...outgoing,
          { ...existing, geometry, phase: "visible" },
        ];
      }

      const outgoing = current.slice(-1);
      sequenceRef.current += 1;
      return [
        ...outgoing,
        {
          id: `link-${name}-${sequenceRef.current}`,
          name,
          geometry,
          phase: "preparing",
        },
      ];
    });
  }, [geometry, name]);

  useEffect(() => {
    const preparing = layers.find((layer) => layer.phase === "preparing");
    if (!preparing) return undefined;
    const frame = requestAnimationFrame(() => {
      setLayers((current) =>
        current.map((layer) =>
          layer.id === preparing.id
            ? { ...layer, phase: "visible" }
            : { ...layer, phase: "exiting" },
        ),
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [layers]);

  useEffect(() => {
    if (
      targetNameRef.current ||
      !layers.some((layer) => layer.phase === "exiting")
    ) return undefined;
    const id = window.setTimeout(() => {
      setLayers((current) =>
        current.filter((layer) => layer.phase !== "exiting"),
      );
    }, MOBILE_LAYER_EXIT_FALLBACK_MS);
    return () => window.clearTimeout(id);
  }, [layers]);

  const handleTransitionEnd = useCallback((event, layerId) => {
    if (
      event.target !== event.currentTarget ||
      event.propertyName !== "opacity"
    ) return;
    setLayers((current) => {
      const completed = current.find((layer) => layer.id === layerId);
      if (!completed) return current;
      if (completed.phase === "visible") {
        return current.filter((layer) => layer.phase !== "exiting");
      }
      if (completed.phase === "exiting" && !targetNameRef.current) {
        return current.filter((layer) => layer.id !== layerId);
      }
      return current;
    });
  }, []);

  return layers.map((layer) => {
    const isCurrent = layer.name === name && layer.phase !== "exiting";
    const currentGeometry = isCurrent ? geometry : layer.geometry;
    if (!currentGeometry) return null;
    return (
      <svg
        ref={isCurrent ? linkRef : undefined}
        key={layer.id}
        className={`plan-link plan-link--mobile${
          isCurrent && ready ? " is-ready" : ""
        }`}
        data-mobile-link-phase={layer.phase}
        aria-hidden="true"
        onTransitionEnd={(event) => handleTransitionEnd(event, layer.id)}
      >
        {["halo", "ink"].map((linkLayer) => (
          <g key={linkLayer} className={`plan-link-${linkLayer}`}>
            {currentGeometry.lead ? (
              <line
                className="plan-link-lead"
                x1={currentGeometry.x1}
                y1={currentGeometry.y1}
                x2={currentGeometry.x2}
                y2={currentGeometry.y2}
                pathLength="1"
              />
            ) : null}
            <circle
              className="plan-link-ring"
              cx={currentGeometry.ax}
              cy={currentGeometry.ay}
              r={LINK_R}
              pathLength="1"
            />
            <path
              className="plan-link-ticks"
              d={[
                `M ${currentGeometry.ax - LINK_R - 8} ${currentGeometry.ay} h 6`,
                `M ${currentGeometry.ax + LINK_R + 2} ${currentGeometry.ay} h 6`,
                `M ${currentGeometry.ax} ${currentGeometry.ay - LINK_R - 8} v 6`,
                `M ${currentGeometry.ax} ${currentGeometry.ay + LINK_R + 2} v 6`,
              ].join(" ")}
              pathLength="1"
            />
          </g>
        ))}
        <circle
          className="plan-link-dot"
          cx={currentGeometry.ax}
          cy={currentGeometry.ay}
          r="2.8"
        />
      </svg>
    );
  });
}

export function CityPlanScene() {
  const { content } = useContent();
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
  const syncScrollStateRef = useRef(null);
  const mobileNearbyRef = useRef(true);
  const vignetteNodeRef = useRef(null);
  const holdsRef = useRef([]);
  const marksRef = useRef([]);
  const copyItemsRef = useRef([]);
  const itemsRef = useRef(null);
  const previousBeatRef = useRef(0);
  const completedVignetteBeatsRef = useRef(new Set());
  const enteredVignetteMountRef = useRef(-1);

  const [entered, setEntered] = useState(false);
  const [mobileCameraActive, setMobileCameraActive] = useState(
    () =>
      typeof window !== "undefined" &&
      window.innerWidth <= planMobileCameraSettings.maxWidth,
  );
  const [beat, setBeat] = useState(0);
  const [mapBeat, setMapBeat] = useState(0);
  const [vignetteProgress, setVignetteProgress] = useState({
    beat: -1,
    mount: -1,
    step: 0,
  });
  const [vignetteMount, setVignetteMount] = useState(0);
  const [vignetteNode, setVignetteNode] = useState(null);
  const [link, setLink] = useState(null);
  const side = planBeats[beat]?.side === "right" ? "right" : "left";
  const vignetteName = planBeats[beat]?.vignette ?? null;
  const place = VIGNETTE_PLACE[vignetteName] ?? "top";
  const vignetteSide = side === "left" ? "right" : "left";
  const vstep =
    vignetteProgress.beat === beat &&
    vignetteProgress.mount === vignetteMount
      ? vignetteProgress.step
      : 0;
  const vignetteLive = Boolean(vignetteName) && entered;
  const vignetteComplete =
    vignetteName && vstep >= (planVignetteMeta[vignetteName]?.steps ?? 1) - 1;
  const currentLink = link?.name === vignetteName ? link : null;
  const synchronizedMapBeat = mobileCameraActive ? beat : mapBeat;
  const activeAnnotations = planAnnotations.filter(
    (note) =>
      (synchronizedMapBeat >= note.from && synchronizedMapBeat <= note.until) ||
      (mobileCameraActive && note.id === "corridor" && synchronizedMapBeat === 5),
  );

  const syncOverlayGeometry = useCallback(
    (commitLink = false, frameOverride = null) => {
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
      if (vignetteName && box && box.dataset.vignette === vignetteName) {
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
    [vignetteName],
  );
  useLayoutEffect(() => {
    syncOverlayGeometryRef.current = syncOverlayGeometry;
  }, [syncOverlayGeometry]);

  useLayoutEffect(() => {
    const planDescription = figRef.current?.querySelector("desc");
    if (planDescription) planDescription.textContent = cityPlanContent.scene.svgDescription;
    if (!vignetteName) return;
    const vignetteDescription = bandRef.current?.querySelector(
      `[data-vignette="${vignetteName}"] .plan-vignette-art desc`,
    );
    if (vignetteDescription) {
      vignetteDescription.textContent = vignetteDescriptions[vignetteName] ?? "";
    }
  }, [cityPlanContent.scene.svgDescription, vignetteDescriptions, vignetteMount, vignetteName]);
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
    if (mobileNearbyRef.current) syncScrollStateRef.current?.();
    return () => {
      observer.disconnect();
      if (syncFrame) cancelAnimationFrame(syncFrame);
      delete root.dataset.mobileNearby;
    };
  }, [mobileCameraActive]);

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
    };

    const paintCopy = (y, activeBeat, mobileViewport) => {
      const items = copyItemsRef.current;
      if (!items.length) return;

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

    const update = (force = false) => {
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
      const next = Math.min(planBeatSpecs.length - 1, reached);
      const stage = stageRef.current;
      const band = bandRef.current;
      const cam = camRef.current;
      if (stage && band && cam) {
        const viewportWidth = window.innerWidth || 1280;
        const beatStart = next === 0 ? marks.start : marks[next - 1];
        const beatEnd = marks[next] ?? marks.end;
        const localProgress = clamp01((y - beatStart) / Math.max(1, beatEnd - beatStart));
        const camera =
          viewportWidth <= planMobileCameraSettings.maxWidth
            ? cameraForBeat(next, localProgress, viewportWidth, reduceMotion)
            : { at: planView.at, units: planView.units, screen: [0.5, 0.5] };
        const bandWidth = band.clientWidth || viewRef.current?.clientWidth || 1;
        const stageHeight = stage.clientHeight || vh;
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
        syncOverlayGeometryRef.current?.(false, nextFrame);
        cam.style.setProperty("--cx", camera.at[0].toFixed(2));
        cam.style.setProperty("--cy", camera.at[1].toFixed(2));
        cam.style.setProperty("--zc", zc.toFixed(5));
        cam.style.setProperty("--sx", `${sx.toFixed(2)}px`);
        cam.style.setProperty("--sy", `${sy.toFixed(2)}px`);
        rootRef.current?.style.setProperty(
          "--plan-camera-step-progress",
          localProgress.toFixed(4),
        );
      }
      rootRef.current?.style.setProperty("--plan-progress", progress.toFixed(4));
      rootRef.current?.style.setProperty("--plan-entry", entry.toFixed(4));
      rootRef.current?.style.setProperty("--plan-exit", exit.toFixed(4));
      paintCopy(y, next, mobileViewport);
      if (mobileViewport) {
        setMapBeat((current) => (current === next ? current : next));
      }
      setBeat((current) => (current === next ? current : next));
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
      update();
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
  }, [reduceMotion]);

  useEffect(() => {
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
  }, [beat, entered, reduceMotion, vignetteMount, vignetteNode]);

  useLayoutEffect(() => {
    if (!vignetteName || !entered || !vignetteLive) return;
    syncOverlayGeometry(true);
  }, [entered, syncOverlayGeometry, vignetteLive, vignetteMount, vignetteName]);

  useLayoutEffect(() => {
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

  const paintMapBeat = useCallback((activeBeat) => {
    const fig = figRef.current;
    if (!fig || !entered) return;
    if (!itemsRef.current) {
      itemsRef.current = Array.from(fig.querySelectorAll(".pl-i")).map((el) => ({
        el,
        at: Number(el.dataset.at || 0),
        until: el.dataset.until == null ? null : Number(el.dataset.until),
      }));
    }
    itemsRef.current.forEach(({ el, at, until }) => {
      const on = activeBeat >= at && (until == null || activeBeat < until);
      el.classList.toggle("is-on", on);
      el.classList.toggle("is-now", on && at === activeBeat);
    });
  }, [entered]);

  useLayoutEffect(() => {
    if (!mobileCameraActive) return;
    paintMapBeat(beat);
  }, [beat, mobileCameraActive, paintMapBeat]);

  useEffect(() => {
    if (mobileCameraActive) return;
    paintMapBeat(mapBeat);
  }, [mapBeat, mobileCameraActive, paintMapBeat]);

  useLayoutEffect(() => {
    const art = bandRef.current?.querySelector(
      `[data-vignette="${vignetteName}"] .plan-vignette-art`,
    );
    if (!art) return;
    art.querySelectorAll(".pv-i").forEach((el) => {
      const at = Number(el.dataset.step || 0);
      const goneAt = Number(el.dataset.goneStep || at + 2);
      el.classList.toggle("is-on", vstep >= at);
      el.classList.toggle(
        "is-gone",
        el.classList.contains("pv-goes") && vstep >= goneAt,
      );
    });
  }, [vstep, vignetteName]);

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

      <div
        ref={stageRef}
        className={`plan-stage plan-stage--${side}`}
        data-beat={synchronizedMapBeat}
        data-story-beat={beat}
        aria-hidden="true"
      >
        <div ref={viewRef} className="plan-bleed">
          <div
            ref={camRef}
            className="plan-camera"
            style={{ width: `${PLAN_W}px`, height: `${PLAN_H}px` }}
          >
            <figure
              ref={figRef}
              className="plan-figure"
              data-motion="story"
              aria-label={planFigureLabel}
              dangerouslySetInnerHTML={PLAN_HTML}
            />
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

          {mobileCameraActive ? (
            <MobileLinkHandoff
              geometry={vignetteName && entered ? currentLink : null}
              ready={Boolean(vignetteComplete)}
              linkRef={linkSvgRef}
            />
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
          )}

          {mobileCameraActive ? (
            <MobileVignetteHandoff
              name={vignetteLive ? vignetteName : null}
              place={place}
              vignetteSide={vignetteSide}
              ratio={vignetteName ? planVignetteMeta[vignetteName].ratio : null}
              html={vignetteName ? VIGNETTE_HTML[vignetteName] : null}
              complete={Boolean(vignetteComplete)}
              bindCurrentNode={bindVignetteNode}
            />
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
          )}

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
                  <span className="plan-step-track" aria-hidden="true">
                    <span className="plan-step-progress" />
                  </span>
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

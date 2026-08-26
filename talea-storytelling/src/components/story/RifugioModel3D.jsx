import { useEffect, useId, useRef, useState } from "react";
import {
  createRifugioModel,
  RIFUGIO_THERMAL_STATES,
} from "../../lib/rifugioModel3d";
import {
  logPerformanceEvent,
  updateMemoryDebugState,
} from "../../lib/mapPerformance";

const Chevron = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M15 5l-7 7 7 7"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Plus = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M12 6v12M6 12h12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
  </svg>
);

const Minus = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M6 12h12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
  </svg>
);

export function RifugioModel3D({
  step = 0,
  label,
  content,
  idle = false,
  gestureHint,
  onPreparing,
  onReady,
}) {
  const shellRef = useRef(null);
  const modelRef = useRef(null);
  const gestureHintId = useId();
  const onPreparingRef = useRef(onPreparing);
  const onReadyRef = useRef(onReady);
  const [zoom, setZoom] = useState(1);
  const [touched, setTouched] = useState(false);
  const [mobileMode, setMobileMode] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 1280,
  );

  useEffect(() => {
    onPreparingRef.current = onPreparing;
    onReadyRef.current = onReady;
  }, [onPreparing, onReady]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1279px)");
    const updateMode = (event) => setMobileMode(event.matches);
    media.addEventListener?.("change", updateMode);
    return () => media.removeEventListener?.("change", updateMode);
  }, []);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return undefined;

    onPreparingRef.current?.();
    setZoom(1);
    updateMemoryDebugState({
      heavyScene: { name: "Rifugio model", mounted: true },
    });
    logPerformanceEvent("rifugio:model-mount", { section: "Rifugio" });
    let readyNotified = false;
    let paintBarrierStarted = false;
    let paintFrame = null;
    let compositorFrame = null;
    const model = createRifugioModel(shell, {
      mobile: mobileMode,
      onZoom: (nextZoom) => {
        if (!mobileMode) {
          setZoom(nextZoom);
          return;
        }
        // Mobile controls only need the discrete min/max states; the renderer
        // keeps the continuous pinch value outside React.
        setZoom((currentZoom) => {
          const band = (value) =>
            value <= 1.02 ? 0 : value >= 2.38 ? 2 : 1;
          return band(currentZoom) === band(nextZoom) ? currentZoom : nextZoom;
        });
      },
      title: content.title,
      description: content.description,
      onFrame: () => {
        if (readyNotified || paintBarrierStarted) return;
        paintBarrierStarted = true;
        // The renderer has swapped its complete SVG buffer, but WebKit may not
        // have painted or composited it yet. Keep the intro visible through two
        // rendering opportunities before announcing readiness.
        void shell.getBoundingClientRect();
        logPerformanceEvent("rifugio:model-dom-ready", { section: "Rifugio" });
        paintFrame = requestAnimationFrame(() => {
          paintFrame = null;
          void shell.querySelector("#model-svg")?.getBoundingClientRect();
          compositorFrame = requestAnimationFrame(() => {
            compositorFrame = null;
            if (readyNotified) return;
            readyNotified = true;
            updateMemoryDebugState({
              rifugioMountedNodeCount:
                shell.querySelectorAll(".rifugio-model3d *").length,
            });
            logPerformanceEvent("rifugio:model-paint-ready", {
              section: "Rifugio",
            });
            onReadyRef.current?.();
          });
        });
      },
    });
    modelRef.current = model;
    if (import.meta.env?.DEV) window.__rifugio = model;

    let settle = 0;
    let lastWidth = shell.clientWidth;
    let lastHeight = shell.clientHeight;
    // Debounce small viewport-chrome changes because a model redraw is expensive.
    const observer =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(() => {
            window.clearTimeout(settle);
            settle = window.setTimeout(() => {
              const width = shell.clientWidth;
              const height = shell.clientHeight;
              if (
                Math.abs(width - lastWidth) < 4 &&
                Math.abs(height - lastHeight) < 4
              )
                return;
              lastWidth = width;
              lastHeight = height;
              model.refresh();
            }, 180);
          })
        : null;
    observer?.observe(shell);

    const markTouched = () => setTouched(true);
    shell.addEventListener("pointerdown", markTouched, { once: true });

    return () => {
      observer?.disconnect();
      window.clearTimeout(settle);
      if (paintFrame !== null) cancelAnimationFrame(paintFrame);
      if (compositorFrame !== null) cancelAnimationFrame(compositorFrame);
      shell.removeEventListener("pointerdown", markTouched);
      model.destroy();
      updateMemoryDebugState({
        rifugioMountedNodeCount: 0,
        heavyScene: { name: "Rifugio model", mounted: false },
      });
      logPerformanceEvent("rifugio:model-destroy", { section: "Rifugio" });
      modelRef.current = null;
      if (import.meta.env?.DEV && window.__rifugio === model)
        delete window.__rifugio;
    };
  }, [content.description, content.title, mobileMode]);

  useEffect(() => {
    modelRef.current?.setStep(step);
  }, [step]);

  const zoomBy = (factor) => {
    modelRef.current?.zoomBy(factor);
    setTouched(true);
  };

  const zoomed = zoom > 1.02;
  const panBy = (dx, dy) => {
    modelRef.current?.panBy(dx, dy);
    setTouched(true);
  };
  const PAN_STEP = 120;

  const thermalStateIndex = Math.max(
    0,
    Math.min(RIFUGIO_THERMAL_STATES.length - 1, step),
  );
  const thermalState = RIFUGIO_THERMAL_STATES[thermalStateIndex];
  const thermalStateContent = content.temperature.states.find(
    (state) => state.id === thermalState.state,
  );
  const tempLocation = content.temperature.locations[thermalStateIndex];

  return (
    <div className="rifugio-model3d-holder">
      <div className="rifugio-model3d-temp" data-step={step}>
        <span
          className="rifugio-model3d-temp-value"
          style={{ color: thermalState.tint }}
        >
          {thermalStateContent.text}
        </span>
        {step === 0 || step === RIFUGIO_THERMAL_STATES.length - 1 ? (
          <span className="rifugio-model3d-temp-side">
            <span
              className="rifugio-model3d-temp-where"
              style={{ color: thermalState.label }}
            >
              {tempLocation.text}
            </span>
          </span>
        ) : null}
      </div>

      <div
        ref={shellRef}
        className="rifugio-model3d"
        role="application"
        tabIndex={0}
        data-step={step}
        data-idle={String(idle)}
        aria-label={label}
        aria-describedby={mobileMode && !touched ? gestureHintId : undefined}
      >
        <svg
          id="model-svg"
          viewBox="0 0 960 660"
          role="img"
          aria-label={label}
        />
      </div>

      <span
        id={gestureHintId}
        className="rifugio-model3d-mobile-hint"
        data-used={String(touched)}
        aria-hidden={mobileMode && !touched ? undefined : "true"}
      >
        {gestureHint}
      </span>

      <div className="rifugio-model3d-controls">
        <div className="rifugio-model3d-controls-row">
          <span
            className="rifugio-model3d-pan"
            role="group"
            aria-label={content.controls.panGroup}
          >
            {zoomed ? (
              <>
                <button
                  type="button"
                  className="rifugio-model3d-btn rifugio-model3d-pan--up"
                  onClick={() => panBy(0, PAN_STEP)}
                  aria-label={content.controls.panUp}
                >
                  <Chevron />
                </button>
                <button
                  type="button"
                  className="rifugio-model3d-btn rifugio-model3d-pan--left"
                  onClick={() => panBy(PAN_STEP, 0)}
                  aria-label={content.controls.panLeft}
                >
                  <Chevron />
                </button>
                <button
                  type="button"
                  className="rifugio-model3d-btn rifugio-model3d-pan--right"
                  onClick={() => panBy(-PAN_STEP, 0)}
                  aria-label={content.controls.panRight}
                >
                  <Chevron />
                </button>
                <button
                  type="button"
                  className="rifugio-model3d-btn rifugio-model3d-pan--down"
                  onClick={() => panBy(0, -PAN_STEP)}
                  aria-label={content.controls.panDown}
                >
                  <Chevron />
                </button>
              </>
            ) : null}
          </span>

          <span className="rifugio-model3d-zoomgroup">
            <button
              type="button"
              className="rifugio-model3d-btn"
              onClick={() => zoomBy(1 / 1.35)}
              disabled={!zoomed}
              aria-label={content.controls.zoomOut}
            >
              <Minus />
            </button>
            <button
              type="button"
              className="rifugio-model3d-btn"
              onClick={() => zoomBy(1.35)}
              disabled={zoom >= 2.38}
              aria-label={content.controls.zoomIn}
            >
              <Plus />
            </button>
          </span>
        </div>

        <span
          className="rifugio-model3d-hint"
          data-used={String(touched)}
          aria-hidden="true"
        >
          {content.controls.hint}
        </span>
      </div>
    </div>
  );
}

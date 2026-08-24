import { useEffect, useMemo, useRef, useState } from "react";
import { rifugioStepSpecs } from "../../data/climateRelief";
import { rifugioSvg } from "../../data/reliefVignettes";
import { RifugioModel3D } from "./RifugioModel3D";
import { ScrollCue } from "../ui/ScrollCue";
import { SequenceStepper } from "../ui/SequenceStepper";
import { GlossaryTerm } from "../ui/GlossaryDrawer";
import { useTimedSequence } from "../../hooks/useTimedSequence";
import { SCROLL_ACCELERATION_GRACE_MS } from "../../lib/motion";
import { useContent } from "../../content";

const RIFUGIO_HTML = { __html: rifugioSvg };

const wordsOf = (step) => step.paragraphs.join(" ").trim().split(/\s+/).length;
const SCROLL_NUDGE_COOLDOWN_MS = 650;
const START_DELAY = 1500;
const TAIL_MS = 900;
const ENGAGE_SETTLE_MS = 640;
const VIGNETTE_DRAW_MS = 1500;

export function RifugioExplainer({ onGlossary }) {
  const { content, uiContent } = useContent();
  const reliefContent = content.climateRelief;
  const reliefHeader = reliefContent.opening;
  const reliefExplainer = reliefContent.explainer;
  const rifugioSteps = useMemo(
    () =>
      rifugioStepSpecs.map((spec, index) => ({
        ...spec,
        ...reliefExplainer.steps[index],
        index,
      })),
    [reliefExplainer],
  );
  const recipe = useMemo(
    () =>
      rifugioSteps
        .filter((step) => step.piece)
        .map((step) => ({ id: step.id, piece: step.piece, from: step.index })),
    [rifugioSteps],
  );
  const readMs = useMemo(
    () =>
      rifugioSteps.map((step, index) =>
        index === 0
          ? 2000
          : Math.max(3800, Math.min(5400, Math.round((2600 + wordsOf(step) * 190) / 20) * 20)),
      ),
    [rifugioSteps],
  );
  const rifugioScrollGraceMs = START_DELAY + readMs[0] + 300;
  const [entered, setEntered] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [nearby, setNearby] = useState(false);
  const [settled, setSettled] = useState(false);
  const [figureInView, setFigureInView] = useState(false);
  const [finalCueUnlocked, setFinalCueUnlocked] = useState(false);

  const explainerRef = useRef(null);
  const figureRef = useRef(null);
  const introHoldRef = useRef(null);
  const holdRef = useRef(null);
  const scrollAccelerationUnlockAtRef = useRef(Infinity);
  const lastNudgeAtRef = useRef(0);
  const activeIndexRef = useRef(0);
  const drawnKeysRef = useRef(new Set());
  const manualModeRef = useRef(false);

  const {
    revealed,
    complete,
    completeRef,
    activeIndex,
    selected,
    advanceTo,
    forceComplete,
    goTo,
  } = useTimedSequence({
    count: rifugioSteps.length,
    engaged: engaged && !manualMode,
    startDelay: START_DELAY,
    readMs,
    tailMs: TAIL_MS,
    pickDuringPlay: true,
  });

  const step = activeIndex;
  const textIndex = selected != null ? selected : activeIndex;
  const lastStepIndex = rifugioSteps.length - 1;
  const finalCueVisible = finalCueUnlocked || (!manualMode && complete);
  const sequencePlaying = !manualMode && !complete;
  const stepStatus = uiContent.localStory.stepLabelTemplate
    .replace("{current}", String(activeIndex + 1))
    .replace("{total}", String(rifugioSteps.length));

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  const takeManualStep = (delta) => {
    const nextIndex = Math.max(
      0,
      Math.min(lastStepIndex, activeIndexRef.current + delta),
    );
    if (nextIndex === activeIndexRef.current) return;
    if (
      (!manualModeRef.current && completeRef.current) ||
      nextIndex === lastStepIndex
    ) {
      setFinalCueUnlocked(true);
    }
    manualModeRef.current = true;
    setManualMode(true);
    activeIndexRef.current = nextIndex;
    goTo(nextIndex);
  };

  useEffect(() => {
    scrollAccelerationUnlockAtRef.current = engaged
      ? performance.now() + Math.max(SCROLL_ACCELERATION_GRACE_MS, rifugioScrollGraceMs)
      : Infinity;
  }, [engaged, rifugioScrollGraceMs]);

  useEffect(() => {
    figureRef.current
      ?.querySelector("svg")
      ?.setAttribute("aria-label", reliefExplainer.figure.svgAriaLabel);
  }, [reliefExplainer.figure.svgAriaLabel]);

  useEffect(() => {
    if (!engaged) return undefined;
    const timer = window.setTimeout(() => setSettled(true), ENGAGE_SETTLE_MS);
    return () => {
      window.clearTimeout(timer);
      setSettled(false);
    };
  }, [engaged]);

  useEffect(() => {
    const fig = figureRef.current;
    if (!fig || typeof IntersectionObserver === "undefined") {
      setFigureInView(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      ([entry]) => setFigureInView(entry.isIntersecting),
      { rootMargin: "0px 0px 12% 0px" },
    );
    io.observe(fig);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const fig = figureRef.current;
    if (!fig || !entered) return undefined;

    const groups = new Map();
    const base = fig.querySelector(".base");
    if (base) groups.set("base", [base]);
    Array.from(fig.querySelectorAll(".layer")).forEach((layer) => {
      const k = Number(layer.dataset.layer);
      if (!Number.isFinite(k)) return;
      const nodes = groups.get(k);
      if (nodes) nodes.push(layer);
      else groups.set(k, [layer]);
    });

    const watched = !engaged && figureInView;
    const drawnKeys = drawnKeysRef.current;
    const fresh = [];

    groups.forEach((nodes, key) => {
      if (!(key === "base" || key <= step)) {
        nodes.forEach((node) => node.classList.remove("draw", "on", "seen"));
        return;
      }
      if (drawnKeys.has(key)) {
        nodes.forEach((node) => {
          node.classList.remove("draw");
          node.classList.add("on", "seen");
        });
        return;
      }
      if (!watched) {
        nodes.forEach((node) => node.classList.remove("draw", "on", "seen"));
        return;
      }
      drawnKeys.add(key);
      nodes.forEach((node) => node.classList.remove("seen"));
      fresh.push(...nodes);
    });

    if (!fresh.length) return undefined;
    // Keep one painted frame between hidden and active states so SVG strokes animate.
    fig.classList.add("is-building");
    fresh.forEach((node) => node.classList.add("draw"));
    const frame = requestAnimationFrame(() => fresh.forEach((node) => node.classList.add("on")));
    const timer = window.setTimeout(() => {
      fresh.forEach((node) => { node.classList.remove("draw"); node.classList.add("seen"); });
      fig.classList.remove("is-building");
    }, VIGNETTE_DRAW_MS);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      fig.classList.remove("is-building");
    };
  }, [entered, engaged, figureInView, step]);

  useEffect(() => {
    let frame = null;
    const update = () => {
      frame = null;
      const vh = window.innerHeight || 768;
      const readingLine = vh * 0.52;
      const mobileLayout = window.matchMedia("(max-width: 1279px)").matches;

      const sectionRect = explainerRef.current?.getBoundingClientRect();
      const introHoldRect = introHoldRef.current?.getBoundingClientRect();
      const holdRect = holdRef.current?.getBoundingClientRect();
      const inScene = Boolean(sectionRect) && sectionRect.top < vh && sectionRect.bottom > 0;
      const entranceLine = mobileLayout ? 0.78 : 0.64;
      const nextEntered = inScene && sectionRect.top <= vh * entranceLine;
      const nextEngaged =
        inScene && Boolean(introHoldRect) && introHoldRect.top <= readingLine;

      const leftBehind = Boolean(sectionRect) && sectionRect.bottom < vh * 0.3;
      if (leftBehind && !completeRef.current) forceComplete();

      const scrollAccelerationReady =
        performance.now() >= scrollAccelerationUnlockAtRef.current;
      if (
        nextEngaged &&
        !manualModeRef.current &&
        scrollAccelerationReady &&
        holdRect &&
        !completeRef.current
      ) {
        const travelled = (vh - holdRect.top) / Math.max(1, holdRect.height);
        const progress = Math.min(1, Math.max(0, travelled));
        const askedByScroll = Math.min(
          rifugioStepSpecs.length - 1,
          Math.floor(progress * rifugioStepSpecs.length),
        );
        const nowMs = performance.now();
        if (
          askedByScroll > activeIndexRef.current &&
          nowMs - lastNudgeAtRef.current >= SCROLL_NUDGE_COOLDOWN_MS
        ) {
          lastNudgeAtRef.current = nowMs;
          advanceTo(activeIndexRef.current + 1);
        }
      }

      if (sectionRect) {
        const arriving = sectionRect.top < vh * 1.2 && sectionRect.bottom > vh * .1;
        const goneForGood = sectionRect.top > vh * 1.5 || sectionRect.bottom < -vh * .1;
        setNearby((mounted) => (mounted ? !goneForGood : arriving));
      }
      setEngaged(nextEngaged);
      if (nextEntered) setEntered(true);
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
  }, [advanceTo, forceComplete, completeRef]);

  return (
    <div
      ref={explainerRef}
      className={`relief-explainer${entered ? " relief-explainer--entered" : ""}${engaged ? " relief-explainer--engaged" : ""}`}
      data-step={step}
      data-manual={String(manualMode)}
    >
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {stepStatus}
      </p>
      <div className="relief-explainer-stage">
        <div className="relief-explainer-inner">
          <div className="relief-intro-heading">
            <h2 id="relief-title" className="relief-title">
              {reliefHeader.title}
            </h2>
          </div>

          <div className="relief-intro-copy">
            <p className="relief-lead">
              {reliefHeader.lead.before}
              <strong>
                <GlossaryTerm id={reliefHeader.lead.term.glossary} onOpen={onGlossary}>
                  {reliefHeader.lead.term.text}
                </GlossaryTerm>
              </strong>
              {reliefHeader.lead.after}
            </p>
            {reliefHeader.body.map((paragraph) => (
              <p key={paragraph.id} className="relief-body">
                {paragraph.text}
              </p>
            ))}
            <p className="relief-thesis">{reliefHeader.close}</p>
          </div>

          <div className="relief-figure-stage">
            <div className="relief-figure-frame">
              <figure
                ref={figureRef}
                className="relief-figure"
                data-effects-active={String(figureInView && !engaged)}
                data-motion="story"
                aria-hidden={engaged ? "true" : undefined}
                aria-label={engaged ? undefined : reliefExplainer.figure.ariaLabel}
                dangerouslySetInnerHTML={RIFUGIO_HTML}
              />
              {nearby ? (
                <RifugioModel3D
                  step={step}
                  label={reliefExplainer.figure.ariaLabel}
                  content={reliefExplainer.model}
                  idle={!engaged || !settled}
                  gestureHint={uiContent.localStory.modelGesture}
                />
              ) : null}
            </div>
            <SequenceStepper
              className="relief-mobile-stepper"
              variant="light"
              count={rifugioSteps.length}
              revealed={revealed}
              activeIndex={activeIndex}
              complete={complete}
              navigationEnabled
              manual={manualMode}
              showCaption={sequencePlaying}
              reserveCaptionSpace
              stepMs={readMs}
              onPrev={() => takeManualStep(-1)}
              onNext={() => takeManualStep(1)}
              captionPlaying={reliefExplainer.sequence.playing}
              captionDone={reliefExplainer.sequence.done}
            />
            <div
              className={`relief-recipe${
                step === rifugioSteps.length - 1 ? " relief-recipe--complete" : ""
              }`}
              aria-hidden="true"
            >
              <span className="relief-recipe-label">{reliefExplainer.recipeLabel}</span>
              <ul className="relief-recipe-list">
                {recipe.map((r) => (
                  <li
                    key={r.id}
                    className={`relief-recipe-item${
                      entered && step >= r.from ? " relief-recipe-item--on" : ""
                    }${entered && step === r.from ? " relief-recipe-item--now" : ""}${
                      r.id === "living-ground" ? " relief-recipe-item--mobile-break" : ""
                    }`}
                  >
                    <span className="relief-recipe-word">{r.piece}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div
              className="relief-final-cue-slot relief-final-cue-slot--mobile"
              data-unlocked={String(finalCueVisible)}
            >
              <ScrollCue
                label={reliefExplainer.sequence.done}
                variant="light"
                loop
                className={`relief-seq-cue relief-seq-cue--final relief-seq-cue--mobile${
                  finalCueVisible ? " is-unlocked" : " is-locked"
                }`}
                decorative={!finalCueVisible}
              />
            </div>
          </div>

          <div
            className={`relief-explainer-text${
              sequencePlaying ? " relief-explainer-text--playing" : ""
            }`}
          >
            <div className="relief-seq-body" data-motion="story">
              {rifugioSteps.map((s, i) => {
                const state =
                  i === textIndex
                    ? "is-active"
                    : i < textIndex
                      ? "is-past"
                      : "is-future";
                return (
                  <div
                    key={s.id}
                    className={`relief-seq-step ${state}`}
                    aria-hidden={i === textIndex ? undefined : "true"}
                  >
                    <div className={`relief-seq-card relief-seq-card--${s.tone ?? "prose"}`}>
                      <span className="relief-step-label">{s.added}</span>
                      {s.paragraphs.map((p, j) => (
                        <p key={j} className="relief-seq-text">
                          {p}
                        </p>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <SequenceStepper
              className="relief-desktop-stepper"
              variant="light"
              count={rifugioSteps.length}
              revealed={revealed}
              activeIndex={activeIndex}
              complete={complete}
              navigationEnabled
              manual={manualMode}
              showCaption={sequencePlaying}
              reserveCaptionSpace
              stepMs={readMs}
              onPrev={() => takeManualStep(-1)}
              onNext={() => takeManualStep(1)}
              captionPlaying={reliefExplainer.sequence.playing}
              captionDone={reliefExplainer.sequence.done}
            />
            <div
              className="relief-final-cue-slot relief-final-cue-slot--desktop"
              data-unlocked={String(finalCueVisible)}
            >
              <ScrollCue
                label={reliefExplainer.sequence.done}
                variant="light"
                className={`relief-seq-cue relief-seq-cue--final relief-seq-cue--desktop${
                  finalCueVisible ? " is-unlocked" : " is-locked"
                }`}
                decorative={!finalCueVisible}
              />
            </div>
          </div>
        </div>
      </div>

      <div ref={introHoldRef} className="relief-explainer-intro-hold" aria-hidden="true" />

      <div ref={holdRef} className="relief-explainer-hold" aria-hidden="true" />
    </div>
  );
}

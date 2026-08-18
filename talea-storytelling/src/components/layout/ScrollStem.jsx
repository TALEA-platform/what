import { useEffect, useMemo, useRef, useState } from "react";
import { useContent } from "../../content";
import { chapterSpecs } from "../../data/chapters";
import { BRANCH_WIDTH, branchLeaves, branchPath, branchX } from "../../lib/branch";

const CHAPTERS = chapterSpecs;


const MIN_GROWTH = 0.018;

const BLOOM_LEAD = 0.022;

const GROWTH_TWEEN_MIN = 520;
const GROWTH_TWEEN_MAX = 1400;

const EVEN_SPREAD = CHAPTERS.map((chapter, i) => ({
  ...chapter,
  at: CHAPTERS.length > 1 ? i / (CHAPTERS.length - 1) : 0,
}));

const PETALS = [
  { a: 0, r: 3.9 },
  { a: 70, r: 4.1 },
  { a: 146, r: 3.7 },
  { a: 214, r: 4.0 },
  { a: 289, r: 3.8 },
];

const MOBILE_STEM_WIDTH = 1000;
const MOBILE_STEM_STEPS = 64;
const MOBILE_SCRUB_THRESHOLD = 7;
const MOBILE_LEAVES = [
  { at: 0.17, rotate: -38 },
  { at: 0.41, rotate: 34 },
  { at: 0.68, rotate: -32 },
  { at: 0.88, rotate: 38 },
];

const clamp01 = (value) => Math.min(1, Math.max(0, value));

function getNarrativeMetrics() {
  const doc = document.documentElement;
  const scroller = document.scrollingElement || doc;
  const scrollTop = scroller.scrollTop;
  const maxScroll = Math.max(0, scroller.scrollHeight - doc.clientHeight);
  const startNode = document.querySelector(CHAPTERS[0].selector);
  const endNode = document.querySelector(".footer");
  const start = clamp01(
    maxScroll > 0
      ? (startNode ? startNode.getBoundingClientRect().top + scrollTop : 0) / maxScroll
      : 0,
  ) * maxScroll;
  const endCandidate = endNode
    ? endNode.getBoundingClientRect().bottom + scrollTop - doc.clientHeight
    : maxScroll;
  const end = Math.min(maxScroll, Math.max(start, endCandidate));
  const scrollable = Math.max(0, end - start);
  return {
    doc,
    end,
    scroller,
    scrollTop,
    start,
    scrollable,
    progress: scrollable > 0 ? clamp01((scrollTop - start) / scrollable) : 0,
  };
}

function mobileStemY(progress) {
  return (
    50 +
    7 * Math.sin(progress * Math.PI * 2 * 1.45 + 0.35) +
    3 * Math.sin(progress * Math.PI * 2 * 3.2 + 1.4)
  );
}

const MOBILE_STEM_PATH = Array.from(
  { length: MOBILE_STEM_STEPS + 1 },
  (_, index) => {
    const progress = index / MOBILE_STEM_STEPS;
    const command = index === 0 ? "M" : "L";
    return `${command}${(progress * MOBILE_STEM_WIDTH).toFixed(2)} ${mobileStemY(progress).toFixed(2)}`;
  },
).join(" ");

function Flower({ node, index, open, active }) {
  return (
    <g
      className={`stem-flower${open ? " is-open" : ""}${active ? " is-active" : ""}`}
      style={{ "--at": node.at }}
      transform={`translate(${node.x.toFixed(2)} ${node.y.toFixed(2)})`}
    >
      <circle className="stem-flower-bud" r="2.6" />
      <g className="stem-flower-petals">
        {PETALS.map((p, i) => (
          <g
            key={p.a}
            className="stem-petal"
            style={{ "--i": i }}
            transform={`rotate(${p.a + index * 13})`}
          >
            <ellipse rx="4.1" ry="2.8" cx={p.r} cy="0" />
          </g>
        ))}
        <circle className="stem-flower-heart" r="2" />
      </g>
    </g>
  );
}

function MobileFlower({ node, index, open, active }) {
  return (
    <svg
      className="mobile-stem-flower"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <g
        className={`stem-flower${open ? " is-open" : ""}${active ? " is-active" : ""}`}
        style={{ "--at": node.at }}
        transform="translate(12 12) scale(1)"
      >
        <circle className="stem-flower-bud" r="2.6" />
        <g className="stem-flower-petals">
          {PETALS.map((p, i) => (
            <g
              key={p.a}
              className="stem-petal"
              style={{ "--i": i }}
              transform={`rotate(${p.a + index * 13})`}
            >
              <ellipse rx="4.1" ry="2.8" cx={p.r} cy="0" />
            </g>
          ))}
          <circle className="stem-flower-heart" r="2" />
        </g>
      </g>
    </svg>
  );
}

export function ScrollStem({
  mobileOpen = false,
  mobileHidden = false,
  onMobileScrubbingChange,
}) {
  const { uiContent } = useContent();
  const chapterLabels = useMemo(() => {
    const labels = new Map(
      uiContent.progress.chapters.map((chapter) => [chapter.id, chapter.label]),
    );
    CHAPTERS.forEach((chapter) => {
      if (!labels.has(chapter.id)) {
        throw new Error(`Missing progress chapter copy: ${chapter.id}`);
      }
    });
    return labels;
  }, [uiContent]);
  const rootRef = useRef(null);
  const growRef = useRef(null);
  const tipRef = useRef(null);
  const mobileGrowRef = useRef(null);
  const mobileClipRef = useRef(null);
  const mobileTipRef = useRef(null);
  const mobileTrackRef = useRef(null);
  const lengthRef = useRef(0);

  const tweenRef = useRef(null);
  const gestureRef = useRef(null);
  const suppressClickRef = useRef(false);
  const hintShownRef = useRef(false);
  const hintTimerRef = useRef(null);

  const [height, setHeight] = useState(0);
  const [nodes, setNodes] = useState(EVEN_SPREAD);
  const [active, setActive] = useState(0);
  const [openCount, setOpenCount] = useState(0);
  const [mobileOpenCount, setMobileOpenCount] = useState(0);
  const [hintVisible, setHintVisible] = useState(false);
  const nodesRef = useRef(EVEN_SPREAD);

  const path = useMemo(() => branchPath(height), [height]);
  const leaves = useMemo(
    () => branchLeaves(height, nodes.map((n) => n.at)),
    [height, nodes],
  );
  const placed = useMemo(
    () => nodes.map((n) => ({ ...n, x: branchX(n.at), y: n.at * height })),
    [nodes, height],
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    let frame = null;
    let lastAria = -1;

    const measure = () => {
      const { scrollable, start } = getNarrativeMetrics();
      setHeight(Math.round(root.clientHeight));
      if (scrollable <= 0) return;

      const next = CHAPTERS.map((chapter, i) => {
        const el = document.querySelector(chapter.selector);
        if (!el) return nodesRef.current[i];
        const top = el.getBoundingClientRect().top + window.scrollY;
        const at = clamp01((top - start) / scrollable + (chapter.nudge ?? 0));
        return { ...chapter, at };
      });

      const moved = next.some((n, i) => Math.abs(n.at - nodesRef.current[i].at) > 0.002);
      if (!moved) return;
      nodesRef.current = next;
      setNodes(next);
    };

    const update = () => {
      frame = null;
      const { doc, progress: p, scrollable, scrollTop, start } = getNarrativeMetrics();

      const target = Math.max(p, MIN_GROWTH);

      let grown = target;
      const tween = tweenRef.current;
      if (tween) {
        const now = performance.now();
        if (!tween.start) tween.start = now;
        const t = Math.min(1, (now - tween.start) / tween.dur);
        const eased = 1 - Math.pow(1 - t, 3);
        grown = tween.from + (target - tween.from) * eased;
        if (t >= 1) tweenRef.current = null;
        else requestUpdate();
      }

      root.style.setProperty("--stem-p", grown.toFixed(4));
      root.style.setProperty("--story-p", p.toFixed(4));

      if (mobileClipRef.current) {
        mobileClipRef.current.setAttribute(
          "width",
          (MOBILE_STEM_WIDTH * p).toFixed(3),
        );
      }
      if (mobileTipRef.current) {
        mobileTipRef.current.style.left = `${(p * 100).toFixed(3)}%`;
        mobileTipRef.current.style.top = `${mobileStemY(p).toFixed(3)}%`;
      }

      const len = lengthRef.current;
      if (growRef.current && len > 0) {
        growRef.current.style.strokeDashoffset = String(len * (1 - grown));
        if (tipRef.current) {
          const tip = growRef.current.getPointAtLength(len * grown);
          tipRef.current.setAttribute("cx", tip.x.toFixed(2));
          tipRef.current.setAttribute("cy", tip.y.toFixed(2));
        }
      }

      const pct = Math.round(p * 100);
      if (pct !== lastAria) {
        lastAria = pct;
        root.setAttribute("aria-valuenow", String(pct));
      }

      const reading =
        scrollable > 0
          ? clamp01((scrollTop + doc.clientHeight * 0.5 - start) / scrollable)
          : 0;
      let current = 0;
      nodesRef.current.forEach((node, i) => {
        if (reading >= node.at) current = i;
      });
      setActive((prev) => (prev === current ? prev : current));

      let opened = 0;
      nodesRef.current.forEach((node) => {
        if (grown >= node.at - BLOOM_LEAD) opened += 1;
      });
      setOpenCount((prev) => (prev === opened ? prev : opened));

      let mobileOpened = 0;
      nodesRef.current.forEach((node) => {
        if (p >= node.at - BLOOM_LEAD) mobileOpened += 1;
      });
      setMobileOpenCount((prev) => (prev === mobileOpened ? prev : mobileOpened));
    };

    const requestUpdate = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };

    const remeasure = () => {
      measure();
      requestUpdate();
    };

    remeasure();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", remeasure, { passive: true });

    const observer = new ResizeObserver(remeasure);
    observer.observe(document.body);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", remeasure);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!growRef.current || !path) return;
    const len = growRef.current.getTotalLength();
    lengthRef.current = len;
    growRef.current.style.strokeDasharray = String(len);
    const p = Number(rootRef.current?.style.getPropertyValue("--stem-p") || 0);
    growRef.current.style.strokeDashoffset = String(len * (1 - Math.max(p, MIN_GROWTH)));
  }, [path]);

  useEffect(() => {
    let hintFrame = null;
    if (!mobileOpen || mobileHidden) {
      if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current);
      hintTimerRef.current = null;
      hintFrame = window.requestAnimationFrame(() => setHintVisible(false));
      return () => window.cancelAnimationFrame(hintFrame);
    }
    if (hintShownRef.current || !window.matchMedia("(max-width: 1279px)").matches) {
      return undefined;
    }

    hintShownRef.current = true;
    hintFrame = window.requestAnimationFrame(() => setHintVisible(true));
    hintTimerRef.current = window.setTimeout(() => {
      setHintVisible(false);
      hintTimerRef.current = null;
    }, 3600);

    return () => {
      if (hintFrame) window.cancelAnimationFrame(hintFrame);
      if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current);
      hintTimerRef.current = null;
    };
  }, [mobileHidden, mobileOpen]);

  useEffect(
    () => () => {
      onMobileScrubbingChange?.(false);
    },
    [onMobileScrubbingChange],
  );

  const dismissMobileHint = () => {
    if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current);
    hintTimerRef.current = null;
    setHintVisible(false);
  };

  const goTo = (selector) => {
    const el = document.querySelector(selector);
    if (!el) return;
    const { progress, scrollable, start } = getNarrativeMetrics();
    const from = Math.max(progress, MIN_GROWTH);
    const top = el.getBoundingClientRect().top + window.scrollY;
    const to =
      scrollable > 0
        ? Math.max(clamp01((top - start) / scrollable), MIN_GROWTH)
        : MIN_GROWTH;

    tweenRef.current = {
      from,
      start: 0,
      dur: Math.min(
        GROWTH_TWEEN_MAX,
        GROWTH_TWEEN_MIN + 1000 * Math.abs(to - from),
      ),
    };

    window.scrollTo({ top, behavior: "instant" });
  };

  const scrubToClientX = (clientX) => {
    const track = mobileTrackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return;
    const progress = clamp01((clientX - rect.left) / rect.width);
    const { scrollable, start } = getNarrativeMetrics();
    tweenRef.current = null;
    rootRef.current?.style.setProperty("--story-p", progress.toFixed(4));
    if (mobileClipRef.current) {
      mobileClipRef.current.setAttribute(
        "width",
        (MOBILE_STEM_WIDTH * progress).toFixed(3),
      );
    }
    if (mobileTipRef.current) {
      mobileTipRef.current.style.left = `${(progress * 100).toFixed(3)}%`;
      mobileTipRef.current.style.top = `${mobileStemY(progress).toFixed(3)}%`;
    }
    window.scrollTo({ top: start + progress * scrollable, behavior: "instant" });
  };

  const handleMobilePointerDown = (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    dismissMobileHint();
    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      direction: null,
    };
  };

  const handleMobilePointerMove = (event) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;

    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;

    if (!gesture.direction) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < MOBILE_SCRUB_THRESHOLD) return;
      if (Math.abs(dx) > Math.abs(dy) * 1.2) {
        gesture.direction = "horizontal";
        suppressClickRef.current = true;
        onMobileScrubbingChange?.(true);
        event.currentTarget.setPointerCapture?.(event.pointerId);
      } else {
        gesture.direction = "vertical";
        return;
      }
    }

    if (gesture.direction !== "horizontal") return;
    event.preventDefault();
    scrubToClientX(event.clientX);
  };

  const finishMobilePointer = (event) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;

    if (gesture.direction === "horizontal") {
      event.preventDefault();
      scrubToClientX(event.clientX);
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    gestureRef.current = null;
    if (gesture.direction === "horizontal") onMobileScrubbingChange?.(false);
  };

  const cancelMobilePointer = (event) => {
    const gesture = gestureRef.current;
    if (gesture?.pointerId === event.pointerId) {
      gestureRef.current = null;
      if (gesture.direction === "horizontal") onMobileScrubbingChange?.(false);
    }
  };

  const handleMobileClickCapture = (event) => {
    if (!suppressClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = false;
  };

  const handleMobileLineClick = (event) => {
    if (event.target.closest(".mobile-progress-node")) return;
    scrubToClientX(event.clientX);
  };

  return (
    <div
      ref={rootRef}
      className={`scroll-stem${mobileOpen ? " scroll-stem--mobile-open" : ""}${mobileHidden ? " scroll-stem--mobile-hidden" : ""}`}
      role="progressbar"
      aria-valuenow={0}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={uiContent.progress.ariaLabel}
    >
      <div
        id="mobile-story-progress"
        className="scroll-stem-mobile"
        aria-hidden={!mobileOpen || mobileHidden}
      >
        <div
          ref={mobileTrackRef}
          className="mobile-stem-scrubber"
          onClickCapture={handleMobileClickCapture}
          onClick={handleMobileLineClick}
          onPointerDown={handleMobilePointerDown}
          onPointerMove={handleMobilePointerMove}
          onPointerUp={finishMobilePointer}
          onPointerCancel={cancelMobilePointer}
        >
          <svg
            className="mobile-stem-line"
            viewBox={`0 0 ${MOBILE_STEM_WIDTH} 100`}
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            <defs>
              <linearGradient id="mobile-stem-ink" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" style={{ stopColor: "var(--amber)" }} />
                <stop offset="0.36" style={{ stopColor: "var(--amber)" }} />
                <stop offset="0.66" style={{ stopColor: "var(--talea-green)" }} />
                <stop offset="1" style={{ stopColor: "var(--talea-green)" }} />
              </linearGradient>
              <clipPath
                id="mobile-stem-progress-clip"
                clipPathUnits="userSpaceOnUse"
              >
                <rect
                  ref={mobileClipRef}
                  x="-4"
                  y="-12"
                  width="0"
                  height="124"
                />
              </clipPath>
            </defs>
            <path className="mobile-stem-ghost" d={MOBILE_STEM_PATH} />
            <path
              ref={mobileGrowRef}
              className="mobile-stem-grow"
              d={MOBILE_STEM_PATH}
              clipPath="url(#mobile-stem-progress-clip)"
            />
          </svg>

          {MOBILE_LEAVES.map((leaf) => (
            <span
              key={leaf.at}
              className="mobile-stem-leaf"
              style={{
                left: `${leaf.at * 100}%`,
                top: `${mobileStemY(leaf.at)}%`,
                "--leaf-rotate": `${leaf.rotate}deg`,
                "--leaf-at": leaf.at,
              }}
              aria-hidden="true"
            />
          ))}

          <span ref={mobileTipRef} className="mobile-stem-tip" aria-hidden="true" />

          {nodes.map((node, i) => (
          <button
            key={node.id}
            type="button"
            className={`mobile-progress-node${i > 0 && i < 4 ? " is-clustered" : ""}${i < mobileOpenCount ? " is-open" : ""}${i === active ? " is-active" : ""}`}
            style={{
              left: `${node.at * 100}%`,
              top: `${mobileStemY(node.at)}%`,
            }}
            aria-label={chapterLabels.get(node.id)}
            tabIndex={mobileOpen && !mobileHidden ? 0 : -1}
            onClick={(event) => {
              if (suppressClickRef.current) {
                event.preventDefault();
                suppressClickRef.current = false;
                return;
              }
              dismissMobileHint();
              goTo(node.selector);
            }}
          >
            {i === 0 ? (
              <span className="mobile-stem-start" />
            ) : (
              <MobileFlower
                node={node}
                index={i}
                open={i < mobileOpenCount}
                active={i === active}
              />
            )}
          </button>
          ))}
        </div>
        {hintVisible ? (
          <div className="mobile-progress-hint" aria-live="polite">
            {uiContent.progress.hint}
          </div>
        ) : null}
      </div>

      {height > 0 ? (
        <svg
          className="scroll-stem-svg"
          width={BRANCH_WIDTH}
          height={height}
          viewBox={`0 0 ${BRANCH_WIDTH} ${height}`}
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <linearGradient
              id="stem-ink"
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="0"
              x2="0"
              y2={height}
            >
              <stop offset="0" style={{ stopColor: "var(--amber)" }} />
              <stop offset="0.36" style={{ stopColor: "var(--amber)" }} />
              <stop offset="0.66" style={{ stopColor: "var(--talea-green)" }} />
              <stop offset="1" style={{ stopColor: "var(--talea-green)" }} />
            </linearGradient>
          </defs>

          <path className="stem-ghost" d={path} />

          <g className="stem-leaves">
            {leaves.map((leaf) => (
              <g
                key={leaf.key}
                className="stem-leaf"
                style={{ "--at": leaf.at }}
                transform={`translate(${leaf.x.toFixed(2)} ${leaf.y.toFixed(2)}) rotate(${leaf.angle.toFixed(1)}) scale(${leaf.scale})`}
              >
                <path d="M0 0 C2.6 -2.9 7.8 -3.4 10.6 0 C7.8 3.4 2.6 2.9 0 0 Z" />
                <path className="stem-leaf-rib" d="M0.8 0 L9.6 0" />
              </g>
            ))}
          </g>

          <path ref={growRef} className="stem-grow" d={path} />

          <path
            className="stem-cut"
            d={`M${(branchX(0) - 3.4).toFixed(2)} -1.4 L${(branchX(0) + 3.4).toFixed(2)} 1.4`}
          />

          <circle ref={tipRef} className="stem-tip" r="1.7" cx={branchX(0)} cy="0" />

          <g className="stem-flowers">
            {placed.map((node, i) =>
              i === 0 ? null : (
                <Flower
                  key={node.id}
                  node={node}
                  index={i}
                  open={i < openCount}
                  active={i === active}
                />
              ),
            )}
          </g>
        </svg>
      ) : null}

      <div className="scroll-stem-nodes">
        {placed.map((node, i) => (
          <button
            key={node.id}
            type="button"
            className={`scroll-stem-node${i === active ? " is-active" : ""}`}
            style={{ left: `${node.x.toFixed(2)}px`, top: `${node.y.toFixed(2)}px` }}
            onClick={() => goTo(node.selector)}
          >
            <span className="scroll-stem-node-label">{chapterLabels.get(node.id)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

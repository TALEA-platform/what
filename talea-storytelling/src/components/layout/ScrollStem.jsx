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

export function ScrollStem() {
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
  const lengthRef = useRef(0);

  const tweenRef = useRef(null);

  const [height, setHeight] = useState(0);
  const [nodes, setNodes] = useState(EVEN_SPREAD);
  const [active, setActive] = useState(0);
  const [openCount, setOpenCount] = useState(0);
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
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      setHeight(Math.round(root.clientHeight));
      if (scrollable <= 0) return;

      const next = CHAPTERS.map((chapter, i) => {
        const el = document.querySelector(chapter.selector);
        if (!el) return nodesRef.current[i];
        const top = el.getBoundingClientRect().top + window.scrollY;
        const at = Math.min(1, Math.max(0, top / scrollable + (chapter.nudge ?? 0)));
        return { ...chapter, at };
      });

      const moved = next.some((n, i) => Math.abs(n.at - nodesRef.current[i].at) > 0.002);
      if (!moved) return;
      nodesRef.current = next;
      setNodes(next);
    };

    const update = () => {
      frame = null;
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      const p = scrollable > 0 ? Math.min(1, Math.max(0, doc.scrollTop / scrollable)) : 0;

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
        scrollable > 0 ? (doc.scrollTop + doc.clientHeight * 0.5) / scrollable : 0;
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

  const goTo = (selector) => {
    const el = document.querySelector(selector);
    if (!el) return;
    const doc = document.documentElement;
    const scrollable = doc.scrollHeight - doc.clientHeight;
    const from = scrollable > 0 ? Math.max(doc.scrollTop / scrollable, MIN_GROWTH) : MIN_GROWTH;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const to = scrollable > 0 ? Math.max(top / scrollable, MIN_GROWTH) : MIN_GROWTH;

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

  return (
    <div
      ref={rootRef}
      className="scroll-stem"
      role="progressbar"
      aria-valuenow={0}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={uiContent.progress.ariaLabel}
    >
      <div className="scroll-stem-bar" aria-hidden="true" />

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

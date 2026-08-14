import { useEffect, useRef, useState } from "react";


const LEAF = "M0 0C2.6 -2.9 7.8 -3.4 10.6 0C7.8 3.4 2.6 2.9 0 0Z";
const LEAF_RIB = "M1.4 0L9 0";

const GROUND_Y = 300;

const SPRIGS = [
  { x: 150, h: 48, lean: -7, leaves: 0, arms: 0, roots: 0, bud: true },
  { x: 365, h: 84, lean: 6, leaves: 2, arms: 2, roots: 30, bud: true },
  { x: 600, h: 128, lean: -8, leaves: 2, arms: 3, roots: 46, bud: true },
  { x: 1000, h: 178, lean: 9, leaves: 3, arms: 4, roots: 60, bud: false },
  { x: 1400, h: 240, lean: -10, leaves: 3, arms: 5, roots: 76, bud: false },
];

function quadPoint(cx, cy, dx, dy, t) {
  const u = 1 - t;
  return [2 * u * t * cx + t * t * dx, 2 * u * t * cy + t * t * dy];
}

function stemPoint(h, lean, t) {
  return quadPoint(lean * 0.3, -h * 0.5, lean, -h, t);
}

const n = (v) => v.toFixed(1);

function leafAt(key, [px, py], side, size, tilt, delay) {
  const reach = size * 0.62;
  const lx = px + side * reach;
  const ly = py - reach * 0.5;
  const angle = side > 0 ? -30 + tilt : -150 - tilt;
  const scale = size / 10.6;
  const spin = `translate(${n(lx)} ${n(ly)}) rotate(${angle.toFixed(1)}) scale(${scale.toFixed(3)})`;
  return (
    <g key={key}>
      <path
        className="tg-draw tg-petiole"
        pathLength="1"
        d={`M${n(px)} ${n(py)}L${n(lx)} ${n(ly)}`}
        style={{ "--d": delay }}
      />
      <path
        className="tg-leaf"
        d={LEAF}
        transform={spin}
        style={{ "--d": delay + 110 }}
      />
      <path
        className="tg-rib"
        d={LEAF_RIB}
        transform={spin}
        style={{ "--d": delay + 260, strokeWidth: 0.5 / scale }}
      />
    </g>
  );
}

function Sprig({ x, h, lean, leaves, arms, roots, bud, delay }) {
  const [tipX, tipY] = stemPoint(h, lean, 1);
  const nodes = [];

  if (roots) {
    const lateral = [
      { dx: -0.88, dy: 0.42, w: 1 },
      { dx: 0.82, dy: 0.46, w: 1 },
      { dx: -0.5, dy: 0.78, w: 0.82 },
      { dx: 0.54, dy: 0.8, w: 0.82 },
      { dx: -0.24, dy: 0.55, w: 0.62 },
      { dx: 0.28, dy: 0.58, w: 0.62 },
    ];
    nodes.push(
      <path
        key="taproot"
        className="tg-draw tg-root"
        pathLength="1"
        style={{ "--d": delay + 100, strokeWidth: 1.5 + roots * 0.012 }}
        d={`M0 0c${n(lean * 0.06)} ${n(roots * 0.4)} ${n(-lean * 0.05)} ${n(roots * 0.75)} ${n(lean * 0.03)} ${n(roots * 1.02)}`}
      />,
    );
    lateral.forEach(({ dx, dy, w }, i) => {
      const ex = dx * roots;
      const ey = dy * roots;
      const cx = dx * roots * 0.72;
      const cy = dy * roots * 0.16;
      const mid = quadPoint(cx, cy, ex, ey, 0.66);
      const hair = Math.sign(dx);
      nodes.push(
        <g key={`root${i}`}>
          <path
            className="tg-draw tg-root"
            pathLength="1"
            style={{ "--d": delay + 130 + i * 45, strokeWidth: (1.2 + roots * 0.008) * w }}
            d={`M0 0Q${n(cx)} ${n(cy)} ${n(ex)} ${n(ey)}`}
          />
          <path
            className="tg-draw tg-rootlet"
            pathLength="1"
            style={{ "--d": delay + 300 + i * 45 }}
            d={`M${n(mid[0])} ${n(mid[1])}q${n(hair * roots * 0.06)} ${n(roots * 0.12)} ${n(hair * roots * 0.16)} ${n(roots * 0.2)}`}
          />
        </g>,
      );
    });
  }

  nodes.push(
    <path
      key="stem"
      className="tg-draw tg-stem"
      pathLength="1"
      style={{ "--d": delay, strokeWidth: 1.7 + h * 0.007 }}
      d={`M0 0Q${n(lean * 0.3)} ${n(-h * 0.5)} ${n(tipX)} ${n(tipY)}`}
    />,
  );

  nodes.push(
    <circle
      key="node"
      className="tg-node"
      cx="0"
      cy={-h * 0.06}
      r={1.6 + h * 0.008}
      style={{ "--d": delay + 220 }}
    />,
  );

  for (let i = 0; i < arms; i += 1) {
    const t = 0.28 + (i * 0.58) / Math.max(arms - 1, 1);
    const side = i % 2 === 0 ? 1 : -1;
    const [bx, by] = stemPoint(h, lean, t);
    const len = h * (0.36 - i * 0.035);
    const ex = side * len * 0.84;
    const ey = -len * 0.5;
    const cx = side * len * 0.46;
    const cy = -len * 0.1;
    const armDelay = delay + 260 + i * 120;
    const leafSize = (6 + h * 0.055) * (1 - i * 0.05);

    nodes.push(
      <path
        key={`arm${i}`}
        className="tg-draw tg-arm"
        pathLength="1"
        style={{ "--d": armDelay, strokeWidth: 1.1 + h * 0.0035 }}
        d={`M${n(bx)} ${n(by)}q${n(cx)} ${n(cy)} ${n(ex)} ${n(ey)}`}
      />,
    );

    [0.3, 0.55, 0.8].forEach((u, k) => {
      const p = quadPoint(cx, cy, ex, ey, u);
      nodes.push(
        leafAt(
          `arm${i}leaf${k}`,
          [bx + p[0], by + p[1]],
          k % 2 === 0 ? side : -side,
          leafSize * (0.78 + k * 0.08),
          k * 9,
          armDelay + 140 + k * 80,
        ),
      );
    });
    nodes.push(
      leafAt(
        `arm${i}tip`,
        [bx + ex, by + ey],
        side,
        leafSize,
        -16,
        armDelay + 340,
      ),
    );
  }

  for (let i = 0; i < leaves; i += 1) {
    const t = 0.16 + i * 0.14;
    if (t > 0.62) break;
    const side = i % 2 === 0 ? -1 : 1;
    nodes.push(
      leafAt(
        `stem${i}`,
        stemPoint(h, lean, t),
        side,
        (4.4 + h * 0.038) * (1 - i * 0.06),
        4,
        delay + 420 + i * 90,
      ),
    );
  }

  if (bud) {
    nodes.push(
      <path
        key="bud"
        className="tg-draw tg-bud"
        pathLength="1"
        style={{ "--d": delay + 380 }}
        d={`M${n(tipX)} ${n(tipY)}c${n(lean * 0.2 - 1.4)} -2.6 ${n(lean * 0.2 - 1)} -5.4 ${n(lean * 0.14)} -7.4`}
      />,
    );
  }

  return <g transform={`translate(${x} ${GROUND_Y})`}>{nodes}</g>;
}

export function TaleaGrowthBackdrop() {
  const ref = useRef(null);
  const [grown, setGrown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setGrown(true);
        observer.disconnect();
      },
      { threshold: 0.1 },
    );
    observer.observe(node);

    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setGrown(true);
      observer.disconnect();
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`talea-growth${grown ? " is-grown" : ""}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 1600 400" preserveAspectRatio="xMidYMax slice">
        <path
          className="tg-draw tg-ground"
          pathLength="1"
          d={`M-20 ${GROUND_Y + 6}c180-9 420-13 800-12 360 1 620 5 840 13`}
          style={{ "--d": 0 }}
        />
        {[70, 268, 470, 520, 800, 860, 1180, 1240, 1520].map((gx, i) => (
          <path
            key={gx}
            className="tg-draw tg-grass"
            pathLength="1"
            d={`M${gx} ${GROUND_Y + 2}c${i % 2 ? 3 : -3} -4 ${i % 2 ? 5 : -5} -7 ${i % 2 ? 5 : -5} -12`}
            style={{ "--d": 900 + i * 70 }}
          />
        ))}
        {SPRIGS.map((s, i) => (
          <Sprig key={s.x} {...s} delay={320 + i * 260} />
        ))}
      </svg>
    </div>
  );
}

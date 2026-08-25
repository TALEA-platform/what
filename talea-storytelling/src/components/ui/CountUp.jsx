import { useEffect, useState } from "react";
import { prefersReducedMotion } from "../../hooks/useCountUpRun";

const COUNT_MS = 900;

export function CountUp({ target, delay = 0, run, suffix = "\u00a0%" }) {
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
  return <>{`${Math.round(display)}${suffix}`}</>;
}

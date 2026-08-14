
export const BRANCH_WIDTH = 46;

const AXIS_X = 16;
const WAVE_A = 7.4;
const WAVE_B = 2.2;

const STEP = 5;

export function branchX(t) {
  return (
    AXIS_X +
    WAVE_A * Math.sin(t * Math.PI * 2 * 2.3 + 0.7) +
    WAVE_B * Math.sin(t * Math.PI * 2 * 5.7 + 2.1)
  );
}

export function branchPath(height) {
  if (height <= 0) return "";
  const steps = Math.max(2, Math.round(height / STEP));
  let d = "";
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const x = branchX(t).toFixed(2);
    const y = (t * height).toFixed(2);
    d += i === 0 ? `M${x} ${y}` : ` L${x} ${y}`;
  }
  return d;
}

function branchAngle(t, height) {
  const dt = 0.004;
  const t0 = Math.max(0, t - dt);
  const t1 = Math.min(1, t + dt);
  const dx = branchX(t1) - branchX(t0);
  const dy = (t1 - t0) * height;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

export function branchLeaves(height, nodeFractions) {
  if (height <= 0) return [];
  const leaves = [];
  for (let t = 0.042; t < 0.99; t += 0.042) {
    const tooCloseToFlower = nodeFractions.some((f) => Math.abs(f - t) < 0.028);
    if (tooCloseToFlower) continue;
    const side = leaves.length % 2 === 0 ? 1 : -1;
    const angle = branchAngle(t, height) + side * 58;
    leaves.push({
      key: t.toFixed(3),
      at: t,
      x: branchX(t),
      y: t * height,
      angle,
      scale: side > 0 ? 1.18 : 1.04,
    });
  }
  return leaves;
}

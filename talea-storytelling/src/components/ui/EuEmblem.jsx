const EU_STAR = (() => {
  const R = 20;
  const ro = 60 / 18;
  const ri = ro * 0.382;
  const pt = (cx, cy, r, deg) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  };
  return Array.from({ length: 12 }, (_, i) => {
    const a = ((i * 30 - 90) * Math.PI) / 180;
    const cx = 45 + R * Math.cos(a);
    const cy = 30 + R * Math.sin(a);
    const points = Array.from({ length: 5 }, (_, k) =>
      `${pt(cx, cy, ro, k * 72)}L${pt(cx, cy, ri, k * 72 + 36)}`,
    ).join("L");
    return `M${points}Z`;
  }).join("");
})();

export function EuEmblem({ label, className = "talea-eu-flag" }) {
  return (
    <svg className={className} viewBox="0 0 90 60" role="img" aria-label={label}>
      <rect width="90" height="60" rx="3" fill="#003399" />
      <path d={EU_STAR} fill="#FFCC00" />
    </svg>
  );
}

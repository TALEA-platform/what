/**
 * La geometria del ramo dello stelo.
 *
 * Tutto è calcolato in pixel reali, non in un viewBox normalizzato: l'altezza
 * del ramo dipende dal viewport e i fiori devono cadere esattamente all'altezza
 * del loro capitolo, senza deformazioni.
 *
 * Il ramo non è una linea dritta con delle curve aggiunte: è la somma di due
 * onde con frequenze che non vanno d'accordo fra loro. È il trucco più
 * economico per ottenere un andamento che non si ripete mai — quello che
 * distingue un ramo da un fregio.
 */

/** Larghezza della fascia in cui vive il ramo, fiori compresi. */
export const BRANCH_WIDTH = 46;

/** Asse attorno a cui il ramo serpeggia. */
const AXIS_X = 16;
const WAVE_A = 7.4;
const WAVE_B = 2.2;

/** Passo di campionamento del tracciato, in pixel. */
const STEP = 5;

/** x del ramo alla frazione t (0 = inizio della storia, 1 = fine). */
export function branchX(t) {
  return (
    AXIS_X +
    WAVE_A * Math.sin(t * Math.PI * 2 * 2.3 + 0.7) +
    WAVE_B * Math.sin(t * Math.PI * 2 * 5.7 + 2.1)
  );
}

/** Il tracciato del ramo, campionato su un'altezza di `height` pixel. */
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

/** Angolo del ramo (in gradi) alla frazione t, per orientare le foglie. */
function branchAngle(t, height) {
  const dt = 0.004;
  const t0 = Math.max(0, t - dt);
  const t1 = Math.min(1, t + dt);
  const dx = branchX(t1) - branchX(t0);
  const dy = (t1 - t0) * height;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

/**
 * Le foglie: una ogni ~4 % della storia, alternate sui due lati, sempre a
 * debita distanza dai fiori (una foglia addosso a un fiore lo sporca).
 */
export function branchLeaves(height, nodeFractions) {
  if (height <= 0) return [];
  const leaves = [];
  for (let t = 0.042; t < 0.99; t += 0.042) {
    const tooCloseToFlower = nodeFractions.some((f) => Math.abs(f - t) < 0.028);
    if (tooCloseToFlower) continue;
    const side = leaves.length % 2 === 0 ? 1 : -1;
    // La foglia esce dal ramo di traverso, non perpendicolare: perpendicolare
    // sembra una lisca di pesce.
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

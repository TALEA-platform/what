/**
 * L'emblema europeo: campo blu, dodici stelle d'oro in cerchio.
 *
 * Disegnato e non caricato come immagine perché è una figura di dodici punti su
 * una circonferenza, cioè venti righe di codice, e perché una dichiarazione di
 * finanziamento europeo non deve dipendere da un file che qualcuno può
 * dimenticare di copiare. Le proporzioni sono quelle ufficiali: bandiera 3:2,
 * raggio del cerchio delle stelle un terzo dell'altezza, raggio della stella un
 * diciottesimo.
 *
 * Sta qui e non dentro un capitolo perché lo usano in due: la dichiarazione di
 * finanziamento sotto i partner e quella nel footer. Erano lo stesso disegno
 * scritto due volte, e due copie di una geometria ufficiale sono due occasioni
 * di sbagliarla.
 */
const EU_STAR = (() => {
  const R = 20; // cerchio delle stelle, su una bandiera 90 × 60
  const ro = 60 / 18; // raggio della singola stella
  const ri = ro * 0.382; // rientranza delle cinque punte
  const pt = (cx, cy, r, deg) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  };
  return Array.from({ length: 12 }, (_, i) => {
    const a = ((i * 30 - 90) * Math.PI) / 180;
    const cx = 45 + R * Math.cos(a);
    const cy = 30 + R * Math.sin(a);
    // Le stelle sono tutte diritte, una punta in su: non ruotano con il cerchio.
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

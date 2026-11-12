import { useEffect, useRef, useState } from "react";

// Distanza minima dal bordo: un'etichetta che non ci sta per intero si
// nasconde invece di restare tagliata.
const EDGE_INSET = 4;
// Margine attorno agli elementi da non coprire (legende).
const AVOID_PAD = 6;

/**
 * Etichette in stile carta geografica sopra un'immagine statica (mappe mobile
 * senza MapLibre). `frame` è il riquadro geografico dell'immagine
 * ({ west, east, south, north }, proiezione lineare come le immagini stesse).
 * Le posizioni sono in percentuale del riquadro, quindi seguono qualsiasi
 * trasformazione CSS del contenitore (`className`).
 * `avoidSelector`/`avoidScope`: elementi (es. legende) cercati nel
 * contenitore più vicino `avoidScope`, sotto cui un'etichetta non deve finire.
 */
export function StaticPlaceLabels({
  places,
  frame,
  visible,
  className = "",
  avoidSelector = null,
  avoidScope = null,
}) {
  const layerRef = useRef(null);
  const labelRefs = useRef([]);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const frameId = requestAnimationFrame(() => setRevealed(visible));
    return () => cancelAnimationFrame(frameId);
  }, [visible]);

  useEffect(() => {
    const layer = layerRef.current;
    const bounds = layer?.parentElement;
    if (!layer || !bounds) return undefined;
    const avoidRoot = avoidSelector && avoidScope ? layer.closest(avoidScope) : null;
    let frameId = null;
    const update = () => {
      frameId = null;
      const box = bounds.getBoundingClientRect();
      const avoidRects = avoidRoot
        ? [...avoidRoot.querySelectorAll(avoidSelector)].map((element) =>
            element.getBoundingClientRect(),
          )
        : [];
      labelRefs.current.forEach((label) => {
        if (!label) return;
        const rect = label.getBoundingClientRect();
        const clipped =
          rect.left < box.left + EDGE_INSET ||
          rect.right > box.right - EDGE_INSET ||
          rect.top < box.top + EDGE_INSET ||
          rect.bottom > box.bottom - EDGE_INSET;
        label.toggleAttribute("data-clipped", clipped);
        const covered = avoidRects.some(
          (other) =>
            rect.left < other.right + AVOID_PAD &&
            rect.right > other.left - AVOID_PAD &&
            rect.top < other.bottom + AVOID_PAD &&
            rect.bottom > other.top - AVOID_PAD,
        );
        label.toggleAttribute("data-covered", covered);
      });
    };
    const requestUpdate = () => {
      if (!frameId) frameId = requestAnimationFrame(update);
    };
    const observer = new ResizeObserver(requestUpdate);
    observer.observe(bounds);
    // Le legende compaiono e scompaiono come figli diretti del contenitore.
    const children = avoidRoot ? new MutationObserver(requestUpdate) : null;
    children?.observe(avoidRoot, { childList: true });
    requestUpdate();
    return () => {
      observer.disconnect();
      children?.disconnect();
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [places, avoidSelector, avoidScope]);

  return (
    <div
      ref={layerRef}
      className={`place-labels place-labels--map place-labels--static ${className}`}
      aria-hidden="true"
    >
      {places.map((place, index) => {
        const [lng, lat] = place.coord;
        const x = ((lng - frame.west) / (frame.east - frame.west)) * 100;
        const y = ((frame.north - lat) / (frame.north - frame.south)) * 100;
        return (
          <div
            key={place.id}
            ref={(node) => {
              labelRefs.current[index] = node;
            }}
            className={`place-label${revealed ? " place-label--on" : ""}`}
            style={{ left: `${x}%`, top: `${y}%`, "--place-i": index }}
          >
            <span className="place-label-name">{place.name}</span>
          </div>
        );
      })}
    </div>
  );
}

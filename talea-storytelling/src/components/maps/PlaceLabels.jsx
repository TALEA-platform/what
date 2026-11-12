import { useEffect, useRef, useState } from "react";
import { hasLiveMapStyle } from "../../lib/mapLifecycle";

// Distanza minima dal bordo della mappa: un'etichetta che non ci sta per
// intero si nasconde invece di restare tagliata.
const EDGE_INSET = 4;
// Spazio tra il pallino e il testo, uguale al transform in maps.css.
const DOT_OFFSET = 4;
// Margine attorno agli elementi da non coprire (schede, pallini).
const AVOID_PAD = 8;

/**
 * Etichette di riferimento (zone, luoghi) sopra una mappa MapLibre.
 *
 * - `visible`: quando diventa vero, le etichette compaiono dopo `revealDelayMs`
 *   con una dissolvenza a onda; quando torna falso scompaiono subito.
 * - `hiddenIds`: etichette da nascondere in quel momento (es. schede aperte).
 * - `zoomReveal`: se impostato, le etichette compaiono solo quando la mappa è
 *   ingrandita di almeno tanti livelli rispetto al suo zoom minimo.
 *   `zoomRevealCap` limita quella soglia a uno zoom assoluto (es. sui tablet,
 *   dove la vista iniziale è già più vicina).
 * - `hideAboveZoom`: se impostato, le etichette svaniscono quando lo zoom della
 *   mappa raggiunge questo valore (es. dove compaiono altri nomi più dettagliati).
 * - `variant="map"`: nome centrato sul punto, senza pallino, con lo stile
 *   attenuato dei nomi di quartiere sulle carte geografiche.
 * - `avoidSelector`: elementi sopra la mappa (es. schede, legende) sotto cui
 *   un'etichetta non deve finire; `avoidKey` cambia quando quegli elementi
 *   cambiano. Si cercano dentro `avoidScope` (selettore del contenitore più
 *   vicino), altrimenti accanto alle etichette.
 */
export function PlaceLabels({
  map,
  places,
  visible,
  hiddenIds = [],
  revealDelayMs = 0,
  zoomReveal = null,
  zoomRevealCap = Infinity,
  hideAboveZoom = null,
  variant = null,
  avoidSelector = null,
  avoidKey = "",
  avoidScope = null,
}) {
  const centered = variant === "map";
  const layerRef = useRef(null);
  const labelRefs = useRef([]);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!visible) {
      const frame = requestAnimationFrame(() => setRevealed(false));
      return () => cancelAnimationFrame(frame);
    }
    const timer = setTimeout(() => setRevealed(true), revealDelayMs);
    return () => clearTimeout(timer);
  }, [visible, revealDelayMs]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!hasLiveMapStyle(map) || !layer) return undefined;

    let frame = null;
    const update = () => {
      frame = null;
      if (!hasLiveMapStyle(map)) return;
      const width = layer.clientWidth;
      const height = layer.clientHeight;
      const zoomedOut =
        zoomReveal != null &&
        map.getZoom() < Math.min(map.getMinZoom() + zoomReveal, zoomRevealCap);
      layer.toggleAttribute("data-zoomed-out", zoomedOut);
      layer.toggleAttribute(
        "data-zoomed-in",
        hideAboveZoom != null && map.getZoom() >= hideAboveZoom,
      );
      const avoidRoot =
        (avoidScope && layer.closest(avoidScope)) || layer.parentElement;
      const avoidRects =
        avoidSelector && avoidRoot
          ? [...avoidRoot.querySelectorAll(avoidSelector)].map((element) =>
              element.getBoundingClientRect(),
            )
          : [];

      places.forEach((place, index) => {
        const label = labelRefs.current[index];
        if (!label) return;
        const { x, y } = map.project(place.coord);
        label.style.left = `${x}px`;
        label.style.top = `${y}px`;
        const labelWidth = label.offsetWidth;
        const labelHeight = label.offsetHeight;
        const left = centered
          ? x - labelWidth / 2
          : place.side === "left"
            ? x + DOT_OFFSET - labelWidth
            : x - DOT_OFFSET;
        const clipped =
          left < EDGE_INSET ||
          left + labelWidth > width - EDGE_INSET ||
          y - labelHeight / 2 < EDGE_INSET ||
          y + labelHeight / 2 > height - EDGE_INSET;
        label.toggleAttribute("data-clipped", clipped);
        const box = avoidRects.length ? label.getBoundingClientRect() : null;
        const covered = avoidRects.some(
          (rect) =>
            box.left < rect.right + AVOID_PAD &&
            box.right > rect.left - AVOID_PAD &&
            box.top < rect.bottom + AVOID_PAD &&
            box.bottom > rect.top - AVOID_PAD,
        );
        label.toggleAttribute("data-covered", covered);
      });
    };
    const requestUpdate = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    map.on("move", requestUpdate);
    map.on("resize", requestUpdate);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      map.off("move", requestUpdate);
      map.off("resize", requestUpdate);
    };
  }, [map, places, zoomReveal, zoomRevealCap, hideAboveZoom, centered, avoidSelector, avoidKey, avoidScope]);

  return (
    <div
      ref={layerRef}
      className={`place-labels${centered ? " place-labels--map" : ""}`}
      aria-hidden="true"
    >
      {places.map((place, index) => (
        <div
          key={place.id}
          ref={(node) => {
            labelRefs.current[index] = node;
          }}
          className={`place-label${place.side === "left" ? " place-label--left" : ""}${revealed && !hiddenIds.includes(place.id) ? " place-label--on" : ""}`}
          style={{ "--place-i": index }}
        >
          <span className="place-label-dot" />
          <span className="place-label-name">{place.name}</span>
        </div>
      ))}
    </div>
  );
}

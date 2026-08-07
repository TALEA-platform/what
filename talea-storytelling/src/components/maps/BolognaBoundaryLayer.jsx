import { useEffect } from "react";
import { assetUrl } from "../../lib/assetUrl";

const bolognaBoundaryUrl = assetUrl("/data/vectors/bologna_boundary_outline.geojson");

const sourceId = "bologna-boundary-outline-src";
const casingLayerId = "bologna-boundary-outline-casing";
const lineLayerId = "bologna-boundary-outline-line";

function addLayerBeforeLabels(map, layer) {
  const firstSymbolLayer = map
    .getStyle()
    .layers?.find((styleLayer) => styleLayer.type === "symbol")?.id;

  if (firstSymbolLayer) {
    map.addLayer(layer, firstSymbolLayer);
  } else {
    map.addLayer(layer);
  }
}

export function BolognaBoundaryLayer({ map, visible = true }) {
  useEffect(() => {
    if (!map) return;

    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: "geojson",
        data: bolognaBoundaryUrl,
      });
    }

    if (!map.getLayer(casingLayerId)) {
      addLayerBeforeLabels(map, {
        id: casingLayerId,
        type: "line",
        source: sourceId,
        paint: {
          // Carta, non bianco: il contorno passa sopra le campiture calde e
          // l'alone che lo stacca deve appartenere alla stessa carta del resto
          // della storia (--paper).
          "line-color": "rgba(246, 244, 238, 0.9)",
          "line-width": 4.4,
          "line-opacity": 0,
          "line-opacity-transition": { duration: 700, delay: 0 },
        },
      });
    }

    if (!map.getLayer(lineLayerId)) {
      addLayerBeforeLabels(map, {
        id: lineLayerId,
        type: "line",
        source: sourceId,
        paint: {
          // Con le etichette spente questo è l'unico segno «duro» della scena
          // (05 § 5.2): va tenuto sottile e va tolto dal verde, che in questo
          // capitolo non c'entra più niente. --ink di theme.css.
          "line-color": "#1B3A29",
          "line-width": 1.6,
          "line-opacity": 0,
          "line-opacity-transition": { duration: 700, delay: 0 },
        },
      });
    }

    return () => {
      if (map.getLayer(lineLayerId)) map.removeLayer(lineLayerId);
      if (map.getLayer(casingLayerId)) map.removeLayer(casingLayerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;

    const opacity = visible ? 1 : 0;
    if (map.getLayer(casingLayerId)) {
      map.setPaintProperty(casingLayerId, "line-opacity", opacity * 0.92);
    }
    if (map.getLayer(lineLayerId)) {
      map.setPaintProperty(lineLayerId, "line-opacity", opacity);
    }
  }, [map, visible]);

  return null;
}
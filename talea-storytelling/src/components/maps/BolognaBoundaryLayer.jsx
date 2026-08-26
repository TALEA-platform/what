import { useEffect } from "react";
import { assetUrl } from "../../lib/assetUrl";

const bolognaBoundaryUrl = assetUrl("/data/vectors/bologna_boundary_outline.geojson");

const sourceId = "bologna-boundary-outline-src";
const casingLayerId = "bologna-boundary-outline-casing";
const lineLayerId = "bologna-boundary-outline-line";

function hasLiveStyle(map) {
  return Boolean(map && !map._removed && map.style);
}

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
    if (!hasLiveStyle(map)) return;

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
          "line-color": "#1B3A29",
          "line-width": 1.6,
          "line-opacity": 0,
          "line-opacity-transition": { duration: 700, delay: 0 },
        },
      });
    }

    return () => {
      // A far-offscreen iOS teardown can outlive the React commit that cleared
      // this prop. MapLibre nulls `style` during remove(); do not query it then.
      if (!hasLiveStyle(map)) return;
      if (map.getLayer(lineLayerId)) map.removeLayer(lineLayerId);
      if (map.getLayer(casingLayerId)) map.removeLayer(casingLayerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    };
  }, [map]);

  useEffect(() => {
    if (!hasLiveStyle(map)) return;

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

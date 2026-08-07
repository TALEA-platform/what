import { useEffect, useRef } from "react";
import {
  HOTSPOT_DATA_VERSION,
  getHotspotGeojsonUrl,
  hotspotPersistenceThresholds,
} from "../../data/hotspotData";
import { getHotspotPersistenceColor } from "../../data/hotspotPalette";

/**
 * Manages the hotspot persistence stack for the narrative map.
 * The source files are cumulative, so drawing thresholds 1..13 in order keeps
 * highly persistent areas colored by their higher class even when threshold 1 is visible.
 */
export function HotspotLayer({
  map,
  id,
  minYears,
  opacity,
  visible,
  transitionMs = 1100,
}) {
  const loaded = useRef(false);
  const loadedVersion = useRef(null);

  useEffect(() => {
    if (!map) return;

    const sourceId = (threshold) => `hotspot-src-${id}-${threshold}`;
    const layerId = (threshold) => `hotspot-fill-${id}-${threshold}`;
    const needsDataRefresh = loadedVersion.current !== HOTSPOT_DATA_VERSION;

    if (!loaded.current || needsDataRefresh) {
      hotspotPersistenceThresholds.forEach((threshold) => {
        const source = sourceId(threshold);
        const layer = layerId(threshold);
        const url = getHotspotGeojsonUrl(threshold);

        if (!map.getSource(source)) {
          map.addSource(source, {
            type: "geojson",
            data: url,
          });
        } else if (needsDataRefresh) {
          map.getSource(source)?.setData?.(url);
        }

        if (!map.getLayer(layer)) {
          // Add at the TOP of the stack so hotspots sit above basemap labels
          // (e.g. "Bologna") — otherwise the center polygons get covered.
          map.addLayer({
            id: layer,
            type: "fill",
            source,
            paint: {
              "fill-color": getHotspotPersistenceColor(threshold),
              "fill-opacity": 0,
              "fill-opacity-transition": { duration: 1100, delay: 0 },
              "fill-outline-color": "rgba(132, 45, 20, 0.42)",
            },
          });
        }
      });

      loaded.current = true;
      loadedVersion.current = HOTSPOT_DATA_VERSION;
    }

    hotspotPersistenceThresholds.forEach((threshold) => {
      const layer = layerId(threshold);
      if (map.getLayer(layer)) {
        map.setPaintProperty(layer, "fill-opacity-transition", {
          duration: transitionMs,
          delay: 0,
        });
        map.setPaintProperty(
          layer,
          "fill-opacity",
          visible && threshold >= minYears ? opacity : 0
        );
      }
    });
  }, [map, id, minYears, opacity, visible, transitionMs]);

  return null;
}

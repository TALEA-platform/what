import { useEffect, useRef } from "react";
import {
  HOTSPOT_DATA_VERSION,
  getHotspotGeojsonUrl,
  hotspotPersistenceThresholds,
} from "../../data/hotspotData";
import { getHotspotPersistenceColor } from "../../data/hotspotPalette";

export function HotspotLayer({
  map,
  id,
  minYears,
  opacity,
  visible,
  transitionMs = 1100,
}) {
  const configuredMap = useRef(null);
  const loadedVersion = useRef(null);

  useEffect(() => {
    if (!map) return;

    const sourceId = (threshold) => `hotspot-src-${id}-${threshold}`;
    const layerId = (threshold) => `hotspot-fill-${id}-${threshold}`;
    const needsMapSetup = configuredMap.current !== map;
    const needsDataRefresh = loadedVersion.current !== HOTSPOT_DATA_VERSION;

    // MapLibre sources and layers belong to one concrete map/style instance.
    // iPhone destroys that instance when Ombra takes the single WebGL slot;
    // a component-level boolean must therefore never suppress setup on the
    // replacement map when the user scrolls backwards.
    if (needsMapSetup || needsDataRefresh) {
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

      configuredMap.current = map;
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

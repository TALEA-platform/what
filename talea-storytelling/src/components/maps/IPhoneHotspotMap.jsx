import { useCallback, useEffect, useRef, useState } from "react";
import {
  getHotspotGeojsonUrl,
  hotspotPersistenceThresholds,
} from "../../data/hotspotData";
import { getHotspotPersistenceColor } from "../../data/hotspotPalette";
import { assetUrl } from "../../lib/assetUrl";
import {
  Fill,
  Stroke,
  Style,
  VectorLayer,
  VectorSource,
  createGeoJSONVectorSource,
  readGeoJSONFeatures,
} from "../../lib/openLayersCanvas";
import { OpenLayersCanvas } from "./OpenLayersCanvas";

const bolognaBoundaryUrl = assetUrl(
  "/data/vectors/bologna_boundary_outline.geojson",
);

function HotspotCanvasLayers({
  map,
  minYears,
  opacity,
  visible,
  boundaryVisible,
  transitionMs,
}) {
  const sourceRef = useRef(null);
  const layerRef = useRef(null);
  const boundaryLayerRef = useRef(null);
  const cacheRef = useRef(new Map());
  const requestedThresholdRef = useRef(minYears);
  const animationFrameRef = useRef(null);

  const syncFeatures = useCallback(() => {
    const source = sourceRef.current;
    if (!source) return;
    const threshold = requestedThresholdRef.current;
    const needed = hotspotPersistenceThresholds.filter(
      (value) => value >= threshold,
    );
    if (!needed.every((value) => cacheRef.current.has(value))) return;
    const ready = needed.flatMap((value) => cacheRef.current.get(value));
    source.clear(true);
    source.addFeatures(ready);
  }, []);

  useEffect(() => {
    if (!map) return undefined;
    const source = new VectorSource();
    const layer = new VectorLayer({
      source,
      updateWhileAnimating: false,
      updateWhileInteracting: false,
      style: (feature) =>
        new Style({
          fill: new Fill({
            color: getHotspotPersistenceColor(feature.get("__threshold")),
          }),
          stroke: new Stroke({
            color: "rgba(132, 45, 20, 0.42)",
            width: 1,
          }),
        }),
    });
    layer.setOpacity(0);

    const boundaryLayer = new VectorLayer({
      source: createGeoJSONVectorSource(bolognaBoundaryUrl),
      style: [
        new Style({
          stroke: new Stroke({ color: "rgba(246, 244, 238, 0.9)", width: 4.4 }),
        }),
        new Style({
          stroke: new Stroke({ color: "#1B3A29", width: 1.6 }),
        }),
      ],
    });
    boundaryLayer.setOpacity(0);

    sourceRef.current = source;
    layerRef.current = layer;
    boundaryLayerRef.current = boundaryLayer;
    const cache = cacheRef.current;
    map._olMap.addLayer(layer);
    map._olMap.addLayer(boundaryLayer);

    const controller = new AbortController();
    hotspotPersistenceThresholds.forEach(async (threshold) => {
      try {
        const response = await fetch(getHotspotGeojsonUrl(threshold), {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`${response.url} ${response.status}`);
        const features = readGeoJSONFeatures(await response.json());
        features.forEach((feature) => feature.set("__threshold", threshold));
        cache.set(threshold, features);
        if (threshold >= requestedThresholdRef.current) syncFeatures();
      } catch (error) {
        if (error?.name !== "AbortError") {
          console.warn(`[hotspot:ol] threshold ${threshold} unavailable`, error);
          cache.set(threshold, []);
          syncFeatures();
        }
      }
    });

    return () => {
      controller.abort();
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      map._olMap.removeLayer(boundaryLayer);
      map._olMap.removeLayer(layer);
      source.clear(true);
      cache.clear();
      sourceRef.current = null;
      layerRef.current = null;
      boundaryLayerRef.current = null;
    };
  }, [map, syncFeatures]);

  useEffect(() => {
    requestedThresholdRef.current = minYears;
    syncFeatures();
  }, [minYears, syncFeatures]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return undefined;
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    const from = layer.getOpacity();
    const to = visible ? opacity : 0;
    if (!transitionMs || Math.abs(from - to) < 0.001) {
      layer.setOpacity(to);
      return undefined;
    }
    const start = performance.now();
    const step = (now) => {
      const progress = Math.min(1, (now - start) / transitionMs);
      const eased = 1 - (1 - progress) ** 3;
      layer.setOpacity(from + (to - from) * eased);
      animationFrameRef.current =
        progress < 1 ? requestAnimationFrame(step) : null;
    };
    animationFrameRef.current = requestAnimationFrame(step);
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [opacity, transitionMs, visible]);

  useEffect(() => {
    boundaryLayerRef.current?.setOpacity(boundaryVisible ? 1 : 0);
  }, [boundaryVisible]);

  return null;
}

export function IPhoneHotspotMap({
  onMapReady,
  onMapRemoved,
  locale,
  minYears,
  opacity,
  visible,
  boundaryVisible,
  transitionMs,
  center,
  zoom,
  minZoom,
  maxZoom,
}) {
  const [map, setMap] = useState(null);
  const handleReady = useCallback(
    (nextMap) => {
      setMap(nextMap);
      onMapReady?.(nextMap);
    },
    [onMapReady],
  );
  const handleRemoved = useCallback(
    (removedMap) => {
      setMap((current) => (current === removedMap ? null : current));
      onMapRemoved?.(removedMap);
    },
    [onMapRemoved],
  );

  return (
    <>
      <OpenLayersCanvas
        onMapReady={handleReady}
        onMapRemoved={handleRemoved}
        mapName="Hotspot"
        className="hotspot-canvas"
        center={center}
        zoom={zoom}
        minZoom={minZoom}
        maxZoom={maxZoom}
        interactive
        cooperativeGestures
        locale={locale}
        hideLabels
        paperBasemap
      />
      <HotspotCanvasLayers
        map={map}
        minYears={minYears}
        opacity={opacity}
        visible={visible}
        boundaryVisible={boundaryVisible}
        transitionMs={transitionMs}
      />
    </>
  );
}

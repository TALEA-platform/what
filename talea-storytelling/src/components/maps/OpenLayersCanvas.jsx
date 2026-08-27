import { useEffect, useRef } from "react";
import { BOLOGNA_CENTER, BOLOGNA_ZOOM } from "../../data/hotspotSteps";
import { createOpenLayersCanvasMap } from "../../lib/openLayersCanvas";

const DEFAULT_OPENFREEMAP_STYLE = "https://tiles.openfreemap.org/styles/positron";

export function OpenLayersCanvas({
  onMapReady,
  onMapRemoved,
  className = "",
  mapStyle = DEFAULT_OPENFREEMAP_STYLE,
  center = BOLOGNA_CENTER,
  zoom = BOLOGNA_ZOOM,
  minZoom = 10,
  maxZoom = 16,
  interactive = false,
  cooperativeGestures = false,
  locale,
  hideLabels = false,
  paperBasemap = false,
  background,
  attribution = true,
  scale = false,
  scaleMaxWidth,
  mapName = "OpenLayers",
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return undefined;
    const map = createOpenLayersCanvasMap({
      target: containerRef.current,
      center,
      zoom,
      minZoom,
      maxZoom,
      interactive,
      cooperativeGestures,
      style: mapStyle,
      hideLabels,
      paperBasemap,
      background,
      attribution,
      attributionLabel: locale?.["AttributionControl.ToggleAttribution"],
      scale,
      scaleMaxWidth,
      mapName,
    });
    mapRef.current = map;
    map.ready.then(() => {
      if (mapRef.current === map && !map._removed) onMapReady?.(map);
    });

    return () => {
      mapRef.current = null;
      map.stop();
      onMapRemoved?.(map);
      map.remove();
    };
    // Renderer construction intentionally uses its initial immutable options.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !locale) return;
    map._locale = { ...map._locale, ...locale };
    map.getCanvas()?.setAttribute("aria-label", locale["Map.Title"]);
  }, [locale]);

  return (
    <div
      ref={containerRef}
      className={`map-canvas ${className}`}
      aria-hidden="true"
    />
  );
}

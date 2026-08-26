import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { BOLOGNA_CENTER, BOLOGNA_ZOOM } from "../../data/hotspotSteps";
import { registerMapPerformance } from "../../lib/mapPerformance";
import { runtimeProfile } from "../../lib/runtimeProfile";

const DEFAULT_OPENFREEMAP_STYLE = "https://tiles.openfreemap.org/styles/positron";

export function MapLibreCanvas({
  onMapReady,
  className = "",
  mapStyle = DEFAULT_OPENFREEMAP_STYLE,
  center = BOLOGNA_CENTER,
  zoom = BOLOGNA_ZOOM,
  minZoom = 10,
  maxZoom = 16,
  interactive = false,
  cooperativeGestures = false,
  locale,
  collapseAttribution = false,
  hideLabels = false,
  mapName = "MapLibre",
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyle,
      center,
      zoom,
      minZoom,
      maxZoom,
      attributionControl: false,
      interactive,
      cooperativeGestures,
      locale,
      ...runtimeProfile.mapPixelRatioOptions,
    });
    const unregisterPerformance = registerMapPerformance(map, mapName);

    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-left"
    );

    mapRef.current = map;

    map.on("load", () => {
      if (collapseAttribution) {
        containerRef.current
          ?.querySelector(".maplibregl-ctrl-attrib")
          ?.classList.remove("maplibregl-compact-show");
      }
      if (hideLabels) {
        map.getStyle().layers?.forEach((layer) => {
          if (layer.type === "symbol") {
            map.setLayoutProperty(layer.id, "visibility", "none");
          }
        });
      }
      onMapReady?.(map);
    });

    return () => {
      mapRef.current = null;
      unregisterPerformance();
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !locale) return;

    // MapLibre has no public runtime locale setter. Updating its locale table
    // keeps the existing camera/layers alive while language-specific gesture
    // and accessibility strings change immediately.
    map._locale = { ...map._locale, ...locale };
    map.getCanvas()?.setAttribute("aria-label", locale["Map.Title"]);

    const attributionButton = containerRef.current?.querySelector(
      ".maplibregl-ctrl-attrib-button",
    );
    const attributionLabel = locale["AttributionControl.ToggleAttribution"];
    if (attributionButton && attributionLabel) {
      attributionButton.setAttribute("aria-label", attributionLabel);
      attributionButton.setAttribute("title", attributionLabel);
    }
  }, [locale]);

  return (
    <div
      ref={containerRef}
      className={`map-canvas ${className}`}
      aria-hidden="true"
    />
  );
}

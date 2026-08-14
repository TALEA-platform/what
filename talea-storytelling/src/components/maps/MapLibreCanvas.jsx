import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { BOLOGNA_CENTER, BOLOGNA_ZOOM } from "../../data/hotspotSteps";

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
  hideLabels = false,
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
    });

    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-left"
    );

    mapRef.current = map;

    map.on("load", () => {
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
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className={`map-canvas ${className}`}
      aria-hidden="true"
    />
  );
}

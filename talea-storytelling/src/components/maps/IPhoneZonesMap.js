import { createOpenLayersCanvasMap } from "../../lib/openLayersCanvas";

export function createIPhoneZonesMap({
  container,
  center,
  zoom,
  minZoom,
  maxZoom,
  locale,
}) {
  return createOpenLayersCanvasMap({
    target: container,
    center,
    zoom,
    minZoom,
    maxZoom,
    interactive: false,
    cooperativeGestures: true,
    background: "#dfe6da",
    attribution: true,
    attributionLabel: locale?.["AttributionControl.ToggleAttribution"],
    scale: true,
    scaleMaxWidth: 120,
    mapName: "Zones",
  });
}

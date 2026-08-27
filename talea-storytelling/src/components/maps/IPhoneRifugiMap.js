import {
  createOpenLayersCanvasMap,
  createOpenLayersMarker,
  createOpenLayersPopup,
} from "../../lib/openLayersCanvas";

export function createIPhoneRifugiMap({
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
    interactive: true,
    cooperativeGestures: true,
    background: "#dfe6da",
    attribution: true,
    attributionLabel: locale?.["AttributionControl.ToggleAttribution"],
    scale: true,
    scaleMaxWidth: 110,
    mapName: "Rifugi",
  });
}

export function createIPhoneRifugiMarker(options) {
  return createOpenLayersMarker(options);
}

export function createIPhoneRifugiPopup(options) {
  return createOpenLayersPopup(options);
}

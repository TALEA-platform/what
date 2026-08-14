
const PAPER = "#F6F4EE";
const LAND = "#EFEBDF";
const ROAD = "#E6E1D3";
const ROAD_CASING = "#DAD3C3";
const ROAD_DASH = "#F3EFE4";

const EXPLICIT = {
  water: ["fill-color", "#DBE0DF"],
  waterway: ["line-color", "#DBE0DF"],
  park: ["fill-color", "#E8E8D6"],
  landcover_wood: ["fill-color", "#E3E3D0"],
  landuse_residential: ["fill-color", "#F1EDE1"],
  building: ["fill-color", "#EBE7DA"],
};

export function applyPaperBasemap(map) {
  const layers = map.getStyle().layers || [];

  layers.forEach((layer) => {
    const { id, type } = layer;

    if (type === "background") {
      map.setPaintProperty(id, "background-color", PAPER);
      return;
    }

    const explicit = EXPLICIT[id];
    if (explicit) {
      map.setPaintProperty(id, explicit[0], explicit[1]);
      return;
    }

    if (type === "line") {
      if (id.endsWith("_dashline")) map.setPaintProperty(id, "line-color", ROAD_DASH);
      else if (id.includes("casing")) map.setPaintProperty(id, "line-color", ROAD_CASING);
      else map.setPaintProperty(id, "line-color", ROAD);
      return;
    }

    if (type === "fill") {
      map.setPaintProperty(id, "fill-color", LAND);
    }
  });
}

const hotspotAnnotationGeometry = [
  {
    id: "centro-storico",
    narrative: true,
    coord: [11.34148, 44.49477],
    anchor: [11.353, 44.4905],
  },
  {
    id: "stazione-centrale",
    narrative: true,
    coord: [11.3458, 44.5066],
    anchor: [11.360, 44.5045],
  },
  {
    id: "scalo-ravone",
    narrative: true,
    coord: [11.3255, 44.5093],
    anchor: [11.309, 44.5135],
  },
  {
    id: "caab",
    narrative: true,
    coord: [11.411808, 44.516589],
    anchor: [11.392, 44.5245],
  },
  {
    id: "fiera",
    narrative: false,
    coord: [11.3626, 44.5149],
    anchor: [11.378, 44.5172],
  },
  {
    id: "villaggio-ina",
    narrative: false,
    coord: [11.26475, 44.51959],
    anchor: [11.281, 44.5222],
  },
  {
    id: "aeroporto",
    narrative: true,
    coord: [11.2949, 44.5308],
    anchor: [11.308, 44.5325],
  },
  {
    id: "bolognina",
    narrative: false,
    coord: [11.3575, 44.5329],
    anchor: [11.371, 44.535],
  },
  {
    id: "roveri",
    narrative: false,
    coord: [11.4065, 44.5024],
    anchor: [11.393, 44.5005],
  },
];

export function buildHotspotAnnotations(content) {
  const hotspotAnnotationCopy = new Map(
    content.hotspot.map.annotations.items.map((item) => [item.id, item]),
  );
  return hotspotAnnotationGeometry.map((annotation) => {
    const copy = hotspotAnnotationCopy.get(annotation.id);
    if (!copy) throw new Error(`Missing Hotspot annotation copy: ${annotation.id}`);
    return { ...annotation, ...copy };
  });
}

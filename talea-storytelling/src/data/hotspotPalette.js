export const hotspotPersistenceStops = [
  { min: 0, max: 0, color: "#fffdf0", label: "0 estati" },
  { min: 1, max: 1, color: "#fee391", label: "1 estate" },
  { min: 2, max: 4, color: "#fec44f", label: "2-4 estati" },
  { min: 5, max: 8, color: "#fc4e2a", label: "5-8 estati" },
  { min: 9, max: 13, color: "#bd0026", label: "9-13 estati" },
  { min: 14, max: 14, color: "#800026", label: "14 estati" },
];

export function getHotspotPersistenceColor(years) {
  const stop = hotspotPersistenceStops.find(
    (item) => years >= item.min && years <= item.max
  );
  return stop?.color ?? hotspotPersistenceStops.at(-1).color;
}

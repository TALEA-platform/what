const removedMaps = new WeakSet();

export function markMapRemoved(map) {
  if (map) removedMaps.add(map);
}

export function hasLiveMapStyle(map) {
  // iPhone releases the previous WebGL map synchronously. React effects from
  // the preceding render may still hold that instance for one passive flush.
  return Boolean(
    map &&
      !removedMaps.has(map) &&
      !map._removed &&
      map.style,
  );
}

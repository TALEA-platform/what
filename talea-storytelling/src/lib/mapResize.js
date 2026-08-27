function readContainerSize(map) {
  const container = map.getContainer?.();
  return {
    width: container?.clientWidth ?? 0,
    height: container?.clientHeight ?? 0,
  };
}

export function isMapSizeSynchronized(map) {
  if (!map) return false;
  const { width, height } = readContainerSize(map);
  if (map.backend === "openlayers-canvas") {
    const size = map._olMap?.getSize?.();
    return (
      Boolean(size) &&
      Math.abs((size?.[0] ?? 0) - width) < 0.5 &&
      Math.abs((size?.[1] ?? 0) - height) < 0.5
    );
  }
  const canvas = map.getCanvas?.();
  if (!canvas || width <= 0 || height <= 0) return false;
  return (
    Math.abs(Number.parseFloat(canvas.style.width) - width) < 0.5 &&
    Math.abs(Number.parseFloat(canvas.style.height) - height) < 0.5
  );
}

export function createMapResizeController(map) {
  let frame = null;
  let pendingReason = null;
  let pendingForce = false;
  let destroyed = false;
  let lastWidth = null;
  let lastHeight = null;

  const resizeNow = (reason = "application", { force = false } = {}) => {
    if (destroyed || !map) return false;
    const { width, height } = readContainerSize(map);
    if (width <= 0 || height <= 0) return false;

    const dimensionsUnchanged = width === lastWidth && height === lastHeight;
    const mapAlreadySynchronized = isMapSizeSynchronized(map);
    lastWidth = width;
    lastHeight = height;

    if (!force && (dimensionsUnchanged || mapAlreadySynchronized)) return false;

    map.resize({ taleaApplicationResize: true, taleaResizeReason: reason });
    return true;
  };

  const cancelPending = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    pendingReason = null;
    pendingForce = false;
  };

  const request = (reason = "application", { force = false } = {}) => {
    if (destroyed) return;
    pendingReason = reason;
    pendingForce = pendingForce || force;
    if (frame !== null) return;

    frame = requestAnimationFrame(() => {
      frame = null;
      const nextReason = pendingReason;
      const nextForce = pendingForce;
      pendingReason = null;
      pendingForce = false;
      resizeNow(nextReason, { force: nextForce });
    });
  };

  const destroy = () => {
    cancelPending();
    destroyed = true;
  };

  return { request, resizeNow, cancelPending, destroy };
}

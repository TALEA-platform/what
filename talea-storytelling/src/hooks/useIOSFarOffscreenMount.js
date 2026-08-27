import { useEffect, useRef, useState } from "react";
import { logPerformanceEvent } from "../lib/mapPerformance";
import { runtimeProfile } from "../lib/runtimeProfile";

function intersectsMargin(element, margin) {
  const rect = element.getBoundingClientRect();
  const viewportHeight = window.innerHeight || 768;
  return rect.bottom >= -margin && rect.top <= viewportHeight + margin;
}

/**
 * Keeps a heavy renderer warm around its scene, but releases it only after a
 * much wider distance. The policy is intentionally iOS-only: other platforms
 * retain their existing mount lifecycle.
 */
export function useIOSFarOffscreenMount(
  targetRef,
  {
    name,
    prewarmViewports = 5,
    releaseViewports = 9,
    initiallyMounted = false,
    retainUntilFirstApproach = false,
    keepAliveAfterMount = false,
  } = {},
) {
  const [mounted, setMounted] = useState(
    () => !runtimeProfile.isIOSWebKit || initiallyMounted,
  );
  const approachedRef = useRef(false);

  useEffect(() => {
    if (!runtimeProfile.isIOSWebKit) {
      return undefined;
    }

    const target = targetRef.current;
    if (!target || typeof IntersectionObserver !== "function") {
      const fallbackFrame = requestAnimationFrame(() => setMounted(true));
      return () => cancelAnimationFrame(fallbackFrame);
    }

    let prewarmObserver = null;
    let releaseObserver = null;
    let orientationTimer = null;
    let scrollFrame = null;
    let releaseMargin = 0;

    const updateMounted = (next, reason) => {
      setMounted((current) => {
        if (!next && current && keepAliveAfterMount) return current;
        if (current === next) return current;
        logPerformanceEvent(`renderer:${next ? "prewarm" : "release"}`, {
          renderer: name ?? "unnamed",
          reason,
        });
        return next;
      });
    };

    const connect = () => {
      prewarmObserver?.disconnect();
      releaseObserver?.disconnect();

      const viewportHeight = window.innerHeight || 768;
      const prewarmMargin = Math.round(viewportHeight * prewarmViewports);
      releaseMargin = Math.round(
        viewportHeight * Math.max(prewarmViewports + 1, releaseViewports),
      );
      const rect = target.getBoundingClientRect();
      const inPrewarmZone =
        rect.bottom >= -prewarmMargin &&
        rect.top <= viewportHeight + prewarmMargin;
      const farPast = rect.bottom < -releaseMargin;

      if (inPrewarmZone) {
        approachedRef.current = true;
        updateMounted(true, "initial-proximity");
      } else if (
        !intersectsMargin(target, releaseMargin) &&
        (!retainUntilFirstApproach || approachedRef.current || farPast)
      ) {
        updateMounted(false, "initial-far-offscreen");
      }

      prewarmObserver = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          approachedRef.current = true;
          updateMounted(true, "prewarm-zone");
        },
        { rootMargin: `${prewarmMargin}px 0px`, threshold: 0 },
      );
      releaseObserver = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) return;
          const nextRect = target.getBoundingClientRect();
          const isFarPast = nextRect.bottom < -releaseMargin;
          if (
            retainUntilFirstApproach &&
            !approachedRef.current &&
            !isFarPast
          )
            return;
          updateMounted(false, "far-offscreen");
        },
        { rootMargin: `${releaseMargin}px 0px`, threshold: 0 },
      );
      prewarmObserver.observe(target);
      releaseObserver.observe(target);
    };

    // IntersectionObserver does not notify when an instant progress-bar jump
    // moves a never-intersecting target from far below to far above the root.
    // Cover that false -> false transition until the scene has first been
    // approached, without turning this into a permanent scroll measurement.
    const checkSkippedApproach = () => {
      scrollFrame = null;
      if (!retainUntilFirstApproach || approachedRef.current) return;
      const rect = target.getBoundingClientRect();
      if (rect.bottom < -releaseMargin) {
        updateMounted(false, "skipped-past-scene");
      }
    };
    const requestSkippedApproachCheck = () => {
      if (scrollFrame !== null) return;
      scrollFrame = requestAnimationFrame(checkSkippedApproach);
    };

    const reconnectAfterOrientation = () => {
      window.clearTimeout(orientationTimer);
      orientationTimer = window.setTimeout(connect, 180);
    };

    connect();
    if (retainUntilFirstApproach) {
      window.addEventListener("scroll", requestSkippedApproachCheck, {
        passive: true,
      });
    }
    window.addEventListener("orientationchange", reconnectAfterOrientation, {
      passive: true,
    });
    return () => {
      window.clearTimeout(orientationTimer);
      if (scrollFrame !== null) cancelAnimationFrame(scrollFrame);
      prewarmObserver?.disconnect();
      releaseObserver?.disconnect();
      window.removeEventListener("scroll", requestSkippedApproachCheck);
      window.removeEventListener(
        "orientationchange",
        reconnectAfterOrientation,
      );
    };
  }, [
    initiallyMounted,
    keepAliveAfterMount,
    name,
    prewarmViewports,
    releaseViewports,
    retainUntilFirstApproach,
    targetRef,
  ]);

  return mounted;
}

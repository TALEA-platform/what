import { useEffect, useRef, useState } from "react";
import { logPerformanceEvent } from "../lib/mapPerformance";
import { runtimeProfile } from "../lib/runtimeProfile";
import {
  claimIPhoneMapOwnership,
  onIPhoneMapOwnershipChange,
  releaseIPhoneMapOwnership,
} from "../lib/iphoneMapOwnership";
import { onIOSHeavyOffscreenRelease } from "../lib/iosMemoryLifecycle";

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
    exclusiveIPhoneMap = false,
  } = {},
) {
  const [mounted, setMounted] = useState(
    () => !runtimeProfile.isIOSWebKit || initiallyMounted,
  );
  const mountedRef = useRef(mounted);
  const approachedRef = useRef(false);

  useEffect(() => {
    if (!runtimeProfile.isIOSWebKit) {
      return undefined;
    }

    const target = targetRef.current;
    if (!target || typeof IntersectionObserver !== "function") {
      const fallbackFrame = requestAnimationFrame(() => {
        mountedRef.current = true;
        setMounted(true);
      });
      return () => cancelAnimationFrame(fallbackFrame);
    }

    let prewarmObserver = null;
    let releaseObserver = null;
    let orientationTimer = null;
    let scrollFrame = null;
    let exclusiveScrollFrame = null;
    let releaseMargin = 0;
    let lastScrollY = window.scrollY;
    let scrollingDown = target.getBoundingClientRect().top >= 0;
    const exclusiveOwner = runtimeProfile.isIPhone && exclusiveIPhoneMap;
    // Prewarming does not create overlapping contexts: claiming ownership
    // synchronously removes the previous map first. Starting at the first
    // visible pixel was too late for WebKit and exposed an empty sticky frame.
    const effectivePrewarmViewports = prewarmViewports;
    const effectiveReleaseViewports = exclusiveOwner
      ? 0
      : releaseViewports;

    const updateMounted = (next, reason) => {
      if (mountedRef.current === next) return;
      if (exclusiveOwner && next) {
        claimIPhoneMapOwnership(name ?? "unnamed");
      }
      mountedRef.current = next;
      logPerformanceEvent(`renderer:${next ? "prewarm" : "release"}`, {
        renderer: name ?? "unnamed",
        reason,
      });
      setMounted(next);
    };

    const connect = () => {
      prewarmObserver?.disconnect();
      releaseObserver?.disconnect();

      const viewportHeight = window.innerHeight || 768;
      const prewarmMargin = Math.round(
        viewportHeight * effectivePrewarmViewports,
      );
      releaseMargin = Math.round(
        viewportHeight *
          (exclusiveOwner
            ? effectivePrewarmViewports
            : Math.max(
                effectivePrewarmViewports + 1,
                effectiveReleaseViewports,
              )),
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
      prewarmObserver.observe(target);
      if (!exclusiveOwner) {
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
        releaseObserver.observe(target);
      }
    };

    // IntersectionObserver may remain intersecting with the expanded prewarm
    // root while another map takes ownership. In that state it will not emit
    // another entry when this scene reaches the physical viewport. The scroll
    // check is therefore also a visible-scene recovery path. Release happens
    // one viewport beyond the scene boundary so WebKit never loses a sticky
    // WebGL surface while it is still part of the current composite frame.
    const checkExclusiveRange = () => {
      exclusiveScrollFrame = null;
      const nextScrollY = window.scrollY;
      if (nextScrollY !== lastScrollY) {
        scrollingDown = nextScrollY > lastScrollY;
        lastScrollY = nextScrollY;
      }
      const rect = target.getBoundingClientRect();
      const viewportHeight = window.innerHeight || 768;
      const visiblyCurrent = rect.bottom > 0 && rect.top < viewportHeight;
      if (visiblyCurrent && !mountedRef.current) {
        approachedRef.current = true;
        updateMounted(true, "visible-scene-recovery");
      }

      const releaseDistance = viewportHeight;
      if (scrollingDown && rect.bottom < -releaseDistance) {
        updateMounted(false, "passed-section-forward");
      } else if (
        !scrollingDown &&
        rect.top > viewportHeight + releaseDistance
      ) {
        updateMounted(false, "passed-section-backward");
      }
    };
    const requestExclusiveRangeCheck = () => {
      if (exclusiveScrollFrame !== null) return;
      exclusiveScrollFrame = requestAnimationFrame(checkExclusiveRange);
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
    const stopOwnershipListener = exclusiveOwner
      ? onIPhoneMapOwnershipChange((owner) => {
          if (owner && owner !== name) {
            updateMounted(false, `ownership-moved-to:${owner}`);
          }
        })
      : () => {};
    const stopHeavyReleaseListener =
      runtimeProfile.isIPhone && !exclusiveOwner
        ? onIOSHeavyOffscreenRelease((reason) => {
            const rect = target.getBoundingClientRect();
            if (rect.bottom > 0 && rect.top < window.innerHeight) return;
            updateMounted(false, `heavy-boundary:${reason}`);
          })
        : () => {};
    if (retainUntilFirstApproach) {
      window.addEventListener("scroll", requestSkippedApproachCheck, {
        passive: true,
      });
    }
    if (exclusiveOwner) {
      window.addEventListener("scroll", requestExclusiveRangeCheck, {
        passive: true,
      });
    }
    window.addEventListener("orientationchange", reconnectAfterOrientation, {
      passive: true,
    });
    return () => {
      window.clearTimeout(orientationTimer);
      if (scrollFrame !== null) cancelAnimationFrame(scrollFrame);
      if (exclusiveScrollFrame !== null) {
        cancelAnimationFrame(exclusiveScrollFrame);
      }
      prewarmObserver?.disconnect();
      releaseObserver?.disconnect();
      stopOwnershipListener();
      stopHeavyReleaseListener();
      if (exclusiveOwner) {
        releaseIPhoneMapOwnership(name ?? "unnamed", "hook-cleanup");
      }
      window.removeEventListener("scroll", requestSkippedApproachCheck);
      window.removeEventListener("scroll", requestExclusiveRangeCheck);
      window.removeEventListener(
        "orientationchange",
        reconnectAfterOrientation,
      );
    };
  }, [
    initiallyMounted,
    exclusiveIPhoneMap,
    name,
    prewarmViewports,
    releaseViewports,
    retainUntilFirstApproach,
    targetRef,
  ]);

  return mounted;
}

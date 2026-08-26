const hasBrowserRuntime = typeof window !== "undefined" && typeof navigator !== "undefined";

const userAgent = hasBrowserRuntime ? navigator.userAgent || "" : "";
const platform = hasBrowserRuntime ? navigator.platform || "" : "";
const maxTouchPoints = hasBrowserRuntime ? navigator.maxTouchPoints || 0 : 0;
const forceIOSProfile =
  hasBrowserRuntime &&
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).get("forceIOSProfile") === "1";

const isIOSDevice = /iPad|iPhone|iPod/i.test(userAgent);
const isDesktopClassIPad = platform === "MacIntel" && maxTouchPoints > 1;
const isAppleWebKit = /AppleWebKit/i.test(userAgent);
const isIOSWebKit =
  forceIOSProfile || ((isIOSDevice || isDesktopClassIPad) && isAppleWebKit);
const devicePixelRatio = hasBrowserRuntime ? window.devicePixelRatio || 1 : 1;
const maxMapPixelRatio = isIOSWebKit ? 2 : null;

export const runtimeProfile = Object.freeze({
  isIOSWebKit,
  maxMapPixelRatio,
  forceIOSProfile,
  mapPixelRatioOptions: Object.freeze(
    isIOSWebKit
      ? { pixelRatio: Math.min(devicePixelRatio, maxMapPixelRatio) }
      : {},
  ),
});

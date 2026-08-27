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

export const runtimeProfile = Object.freeze({
  isIOSWebKit,
  forceIOSProfile,
});

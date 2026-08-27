const hasBrowserRuntime = typeof window !== "undefined" && typeof navigator !== "undefined";

const userAgent = hasBrowserRuntime ? navigator.userAgent || "" : "";
const platform = hasBrowserRuntime ? navigator.platform || "" : "";
const maxTouchPoints = hasBrowserRuntime ? navigator.maxTouchPoints || 0 : 0;
const forceIOSProfile =
  hasBrowserRuntime &&
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).get("forceIOSProfile") === "1";
const forceIPhoneProfile =
  hasBrowserRuntime &&
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).get("forceIPhoneProfile") === "1";

const isIOSDevice = /iPad|iPhone|iPod/i.test(userAgent);
const isDesktopClassIPad = platform === "MacIntel" && maxTouchPoints > 1;
const isAppleWebKit = /AppleWebKit/i.test(userAgent);
const isIPhone =
  forceIOSProfile || forceIPhoneProfile || (/iPhone/i.test(userAgent) && isAppleWebKit);
const isIPadOS =
  !isIPhone &&
  ((/iPad/i.test(userAgent) && isAppleWebKit) ||
    (isDesktopClassIPad && isAppleWebKit));
const isIOSWebKit =
  forceIOSProfile ||
  forceIPhoneProfile ||
  ((isIOSDevice || isDesktopClassIPad) && isAppleWebKit);
const requestedIOSMapBackend = hasBrowserRuntime
  ? new URLSearchParams(window.location.search).get("iosMapBackend")
  : null;
const iosMapBackend =
  isIPhone && requestedIOSMapBackend === "maplibre"
    ? "maplibre"
    : isIPhone
      ? "openlayers"
      : "maplibre";
const useIOSCanvasMaps = isIPhone && iosMapBackend === "openlayers";
const forceIPhoneLayout = forceIOSProfile || forceIPhoneProfile;

export const runtimeProfile = Object.freeze({
  isIPhone,
  isIPadOS,
  isIOSWebKit,
  useIOSCanvasMaps,
  iosMapBackend,
  forceIPhoneLayout,
  forceIOSProfile,
  forceIPhoneProfile,
});

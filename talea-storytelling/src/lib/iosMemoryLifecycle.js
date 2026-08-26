import { runtimeProfile } from "./runtimeProfile";

const RELEASE_EVENT = "talea:ios-release-heavy-offscreen";

export function requestIOSHeavyOffscreenRelease(reason) {
  if (!runtimeProfile.isIOSWebKit || typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(RELEASE_EVENT, { detail: { reason } }),
  );
}

export function onIOSHeavyOffscreenRelease(listener) {
  if (!runtimeProfile.isIOSWebKit || typeof window === "undefined") {
    return () => {};
  }
  const handleRelease = (event) => listener(event.detail?.reason ?? "unknown");
  window.addEventListener(RELEASE_EVENT, handleRelease);
  return () => window.removeEventListener(RELEASE_EVENT, handleRelease);
}

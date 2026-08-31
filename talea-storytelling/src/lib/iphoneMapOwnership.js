import { runtimeProfile } from "./runtimeProfile";

let currentLease = null;
const listeners = new Set();

function notify(owner) {
  listeners.forEach((listener) => listener(owner));
}

export function claimIPhoneMapOwnership(owner) {
  if (!runtimeProfile.isIPhone) return;
  if (currentLease?.owner === owner) return;

  const previous = currentLease;
  currentLease = {
    owner,
    release: null,
    token: {},
  };

  // Destroy the previous context synchronously before the new owner is told it
  // may construct. This avoids relying on React effect cleanup or WebKit GC.
  previous?.release?.(`superseded-by:${owner}`);
  notify(owner);
}

export function registerIPhoneMapRelease(owner, release) {
  if (!runtimeProfile.isIPhone) return () => {};
  claimIPhoneMapOwnership(owner);

  const lease = currentLease;
  if (!lease || lease.owner !== owner) return () => {};
  lease.release = release;

  return () => {
    if (currentLease?.token !== lease.token) return;
    currentLease = null;
    notify(null);
  };
}

export function releaseIPhoneMapOwnership(owner, reason = "owner-release") {
  if (!runtimeProfile.isIPhone || currentLease?.owner !== owner) return;
  const lease = currentLease;
  currentLease = null;
  lease.release?.(reason);
  notify(null);
}

export function onIPhoneMapOwnershipChange(listener) {
  if (!runtimeProfile.isIPhone) return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
}

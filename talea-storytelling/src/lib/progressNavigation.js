export const PROGRESS_NAVIGATION_EVENT = "talea:progress-navigation";

export function announceProgressNavigation(targetScrollY) {
  window.dispatchEvent(
    new CustomEvent(PROGRESS_NAVIGATION_EVENT, {
      detail: { targetScrollY },
    }),
  );
}

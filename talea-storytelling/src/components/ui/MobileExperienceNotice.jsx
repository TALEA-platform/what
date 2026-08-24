import { useEffect, useId, useState } from "react";
import { useContent } from "../../content";

const MOBILE_QUERY = "(max-width: 1279px)";
const DISMISSAL_KEY = "talea:mobile-experience-notice:v3";

function matchesMobileViewport() {
  return typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches;
}

function wasDismissed() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DISMISSAL_KEY) === "dismissed";
  } catch {
    return false;
  }
}

export function MobileExperienceNotice() {
  const { uiContent } = useContent();
  const titleId = useId();
  const [isMobile, setIsMobile] = useState(matchesMobileViewport);
  const [dismissed, setDismissed] = useState(wasDismissed);

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_QUERY);
    const handleChange = (event) => setIsMobile(event.matches);
    mediaQuery.addEventListener?.("change", handleChange);
    return () => mediaQuery.removeEventListener?.("change", handleChange);
  }, []);

  if (!isMobile || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISSAL_KEY, "dismissed");
    } catch {
      // The notice remains dismissible even when storage is unavailable.
    }
  };

  return (
    <aside
      className="mobile-experience-notice"
      aria-labelledby={titleId}
      aria-live="polite"
    >
      <button
        type="button"
        className="mobile-experience-notice__close"
        aria-label={uiContent.mobileExperience.closeLabel}
        onClick={dismiss}
      >
        <span aria-hidden="true">×</span>
      </button>
      <div className="mobile-experience-notice__copy">
        <h2 id={titleId}>{uiContent.mobileExperience.title}</h2>
        <p>{uiContent.mobileExperience.body}</p>
      </div>
      <button
        type="button"
        className="mobile-experience-notice__continue"
        onClick={dismiss}
      >
        {uiContent.mobileExperience.continue}
      </button>
    </aside>
  );
}

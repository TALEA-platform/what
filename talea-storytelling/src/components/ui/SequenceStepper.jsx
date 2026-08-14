import { useContent } from "../../content";

export function SequenceStepper({
  count,
  revealed,
  activeIndex,
  complete,
  onPrev,
  onNext,
  captionPlaying,
  captionDone,
  variant = "dark",
  stepMs,
  playbackRate = 1,
  tones,
  prevLabel,
  nextLabel,
  showNavigation = true,
  className = "",
}) {
  const { uiContent } = useContent();
  const resolvedPrevLabel = prevLabel ?? uiContent.actions.previousItem;
  const resolvedNextLabel = nextLabel ?? uiContent.actions.nextItem;

  return (
    <div
      className={`seq-stepper seq-stepper--${variant}${complete ? " seq-stepper--done" : ""}${showNavigation ? "" : " seq-stepper--no-nav"}${className ? ` ${className}` : ""}`}
      aria-hidden={complete ? undefined : "true"}
    >
      <div className="seq-stepper-row">
        {showNavigation && (
          <button
            type="button"
            className="seq-nav seq-nav--prev"
            onClick={onPrev}
            disabled={!complete || activeIndex <= 0}
            aria-label={resolvedPrevLabel}
            tabIndex={complete ? 0 : -1}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}

        <div className="seq-dots">
          {Array.from({ length: count }).map((_, i) => {
            const filling = Boolean(stepMs) && !complete && i === revealed - 1;
            return (
              <span
                key={i}
                className={`seq-dot${i < revealed ? " is-done" : ""}${!complete && i === revealed ? " is-next" : ""}${complete && i === activeIndex ? " is-current" : ""}`}
                style={tones ? { "--tone": tones[i] } : undefined}
              >
                {filling && (
                  <svg
                    className="seq-dot-ring"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    focusable="false"
                    style={{
                      "--step-ms": `${stepMs[i] / Math.max(1, playbackRate)}ms`,
                    }}
                  >
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                )}
              </span>
            );
          })}
        </div>

        {showNavigation && (
          <button
            type="button"
            className="seq-nav seq-nav--next"
            onClick={onNext}
            disabled={!complete || activeIndex >= count - 1}
            aria-label={resolvedNextLabel}
            tabIndex={complete ? 0 : -1}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>

      <span className="seq-caption">{complete ? captionDone : captionPlaying}</span>
    </div>
  );
}

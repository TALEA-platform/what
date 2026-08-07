/**
 * Shared foot control for the self-playing story scenes (shadow map, rifugio
 * "sticky vignette"). While the sequence plays it is a calm dot stepper — one
 * dot per stage, filling as each enters, the next gently pulsing — with a
 * caption that says the scene plays on its own (no draining bar, no countdown).
 *
 * Once the whole sequence has played, left/right arrows fade in so a reader who
 * missed something can page back and forth through the stages; the caption
 * switches to the "scroll to continue" cue.
 *
 * `variant` picks the palette: "dark" (a glass pill over a map) or "light"
 * (a soft chip on a cream background).
 *
 * `stepMs` è opzionale: passando la durata di ogni tappa, il pallino in scena
 * si riempie sul suo tempo invece di essere solo acceso. Dà la percezione del
 * tempo che passa senza l'ansia di una barra che si svuota — è il motivo per
 * cui la barra era stata scartata. Era nato dentro la scena hotspot (05 § 5.4),
 * che ha ancora la sua copia inline; qui è generico, e la prossima passata di
 * pulizia può far puntare anche quella a questo componente.
 *
 * `tones` è opzionale allo stesso modo: un colore per tappa, quello con cui la
 * mappa marca quella tappa. Senza, i pallini restano nel colore della variante.
 */
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
  prevLabel = "Elemento precedente",
  nextLabel = "Elemento successivo",
  showNavigation = true,
  className = "",
}) {
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
            aria-label={prevLabel}
            tabIndex={complete ? 0 : -1}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}

        <div className="seq-dots">
          {Array.from({ length: count }).map((_, i) => {
            // Il pallino che si sta riempiendo è quello dell'ultima tappa
            // entrata, e solo mentre la sequenza gioca. Nasce e muore con la
            // tappa, quindi l'animazione riparte da sola a ogni giro.
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
            aria-label={nextLabel}
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

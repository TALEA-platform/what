import { forwardRef } from "react";

const formatStepLabel = (template, current, total) =>
  template
    .replaceAll("{current}", String(current))
    .replaceAll("{total}", String(total));

export const LocalStoryProgress = forwardRef(function LocalStoryProgress(
  {
    currentStep,
    stepCount,
    labelTemplate,
    className = "",
    style,
  },
  ref,
) {
  const safeCurrentStep = Math.min(
    Math.max(0, currentStep),
    Math.max(0, stepCount - 1),
  );
  const accessibleLabel = formatStepLabel(
    labelTemplate,
    safeCurrentStep + 1,
    stepCount,
  );

  return (
    <div
      ref={ref}
      className={`local-story-progress${className ? ` ${className}` : ""}`}
      role="group"
      aria-label={accessibleLabel}
      style={{ "--local-story-step-count": stepCount, ...style }}
    >
      <span className="local-story-progress-count tnum" aria-hidden="true">
        {String(safeCurrentStep + 1).padStart(2, "0")} /{" "}
        {String(stepCount).padStart(2, "0")}
      </span>
      <span className="local-story-progress-segments" aria-hidden="true">
        {Array.from({ length: stepCount }, (_, index) => (
          <span
            key={index}
            className={`local-story-progress-segment${
              index < safeCurrentStep
                ? " is-complete"
                : index === safeCurrentStep
                  ? " is-current"
                  : ""
            }`}
            style={{
              "--local-story-segment-progress":
                index < safeCurrentStep
                  ? 1
                  : index === safeCurrentStep
                    ? "var(--local-story-progress, 0)"
                    : 0,
            }}
          />
        ))}
      </span>
    </div>
  );
});

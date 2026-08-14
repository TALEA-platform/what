export function ScrollCue({ label, variant = "dark", loop = false, className = "" }) {
  return (
    <div
      className={`scroll-cue scroll-cue--${variant}${loop ? " scroll-cue--loop" : ""}${className ? ` ${className}` : ""}`}
      aria-hidden="true"
    >
      {label ? <span className="scroll-cue-label">{label}</span> : null}
      <svg className="scroll-cue-chevron" viewBox="0 0 24 24" focusable="false">
        <path
          d="M5 9l7 7 7-7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

// Thin "new chapter" hairline that marks the start of a major section
// (doc 01 — struttura generale): it signals a new argument while keeping the
// story continuous. Editorial, NOT a numbered chapter.
//
// Marked "da testare": kept as one reusable element so it's trivial to remove
// (drop the three imports + this file). `tone` adapts the line to its
// background — "light" (dark-green hairline on light backgrounds) or "dark"
// (translucent white, for a dark/green background).
export function SectionDivider({ tone = "light" }) {
  return (
    <div
      className={`section-divider section-divider--${tone}`}
      role="separator"
      aria-hidden="true"
    >
      <span className="section-divider-line" />
    </div>
  );
}

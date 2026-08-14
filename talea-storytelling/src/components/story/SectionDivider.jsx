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

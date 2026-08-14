import { useMemo, useState } from "react";
import { ArrowUpRight, Eye, EyeOff } from "lucide-react";
import { useContent } from "../../content";
import { buildMethodContent } from "../../data/method";
import { TitleSprig } from "./TitleSprig";
import { useDrawer } from "../../hooks/useDrawer";
import { useStoryReach } from "../../hooks/useStoryReach";

export function MethodDrawer({ open, onClose }) {
  const { content, locale, uiContent } = useContent();
  const methodContent = useMemo(() => buildMethodContent(content), [content]);
  const { progressive } = methodContent;
  const panelRef = useDrawer({ open, onClose });
  const hasReached = useStoryReach();
  const [showAll, setShowAll] = useState(false);

  if (!open) return null;

  const reached = (item) => !item.after || hasReached(item.after);
  const shown = (item) => showAll || reached(item);
  const sections = methodContent.sections.filter(shown);
  const highlights = methodContent.highlights.filter(shown);
  const waiting = methodContent.sections.filter((s) => !reached(s)).length;

  return (
    <>
      <div className="method-backdrop" onClick={onClose} aria-hidden="true" />
      <aside
        ref={panelRef}
        tabIndex={-1}
        className="method-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={methodContent.title}
        lang={locale}
      >
        <div className="method-drawer-head">
          <div className="method-drawer-heading">
            <p className="method-eyebrow">{methodContent.eyebrow}</p>
            <h2 className="method-drawer-title">{methodContent.title}</h2>
          </div>
          <button
            className="method-close"
            type="button"
            onClick={onClose}
            aria-label={uiContent.actions.close}
          >
            ×
          </button>
        </div>

        <div className="method-drawer-scroll">
          <TitleSprig className="method-sprig" />
          <p className="method-intro">{methodContent.intro}</p>

          {waiting > 0 && (
            <div className="method-progress">
              <p className="method-progress-note">{progressive.note}</p>
              <button
                className="method-progress-toggle"
                type="button"
                aria-pressed={showAll}
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll ? (
                  <EyeOff size={14} aria-hidden="true" />
                ) : (
                  <Eye size={14} aria-hidden="true" />
                )}
                {showAll ? progressive.showRead : progressive.showAll}
                {!showAll && (
                  <span className="method-progress-count tnum">{waiting}</span>
                )}
              </button>
            </div>
          )}

          {highlights.length > 0 && (
            <ul className="method-facts">
              {highlights.map((h) => (
                <li key={h.id} className="method-fact">
                  <span className="method-fact-value tnum">{h.value}</span>
                  <span className="method-fact-label">{h.label}</span>
                </li>
              ))}
            </ul>
          )}

          <ol className="method-sections">
            {sections.map((s, i) => (
              <li key={s.id} className="method-section">
                <span className="method-section-num tnum" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="method-section-copy">
                  <h3 className="method-section-heading">{s.heading}</h3>
                  <p className="method-section-body">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="method-links">
            <span className="method-links-label">{methodContent.linksLabel}</span>
            <ul className="method-links-list">
              {methodContent.links.map((l) => (
                <li key={l.id}>
                  <a
                    className="method-link"
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="method-link-copy">
                      <span className="method-link-label">{l.label}</span>
                      <span className="method-link-note">{l.note}</span>
                    </span>
                    <ArrowUpRight
                      className="method-link-arrow"
                      size={16}
                      aria-hidden="true"
                    />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
    </>
  );
}

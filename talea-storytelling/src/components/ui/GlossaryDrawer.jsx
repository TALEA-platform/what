import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { BookMarked, ChevronRight } from "lucide-react";
import { useContent } from "../../content";
import { buildGlossary } from "../../data/glossary";
import { useDrawer } from "../../hooks/useDrawer";

const fillTerm = (template, term) => template.replace("{term}", term);

const GlossaryTrailContext = createContext(null);

export function GlossaryTrailProvider({ children }) {
  const [met, setMet] = useState(() => new Set());
  const [opened, setOpened] = useState(() => new Set());

  const add = (setter, id) =>
    setter((current) => (current.has(id) ? current : new Set(current).add(id)));

  const markMet = useCallback((id) => add(setMet, id), []);
  const markOpened = useCallback((id) => {
    add(setMet, id);
    add(setOpened, id);
  }, []);

  const value = useMemo(
    () => ({ met, opened, markMet, markOpened }),
    [met, opened, markMet, markOpened],
  );

  return (
    <GlossaryTrailContext.Provider value={value}>
      {children}
    </GlossaryTrailContext.Provider>
  );
}

export function GlossaryTerm({ id, children, onOpen }) {
  const { glossaryContent, uiContent } = useContent();
  const { glossary } = useMemo(
    () => buildGlossary(glossaryContent),
    [glossaryContent],
  );
  const trail = useContext(GlossaryTrailContext);
  const ref = useRef(null);
  const markMet = trail?.markMet;
  const met = trail?.met.has(id) ?? false;
  const opened = trail?.opened.has(id) ?? false;

  useEffect(() => {
    const node = ref.current;
    if (!node || !markMet || met) return undefined;
    if (typeof IntersectionObserver === "undefined") {
      markMet(id);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        markMet(id);
        observer.disconnect();
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [id, markMet, met]);

  return (
    <button
      ref={ref}
      type="button"
      className="glossary-term"
      data-opened={opened ? "" : undefined}
      onClick={() => {
        trail?.markOpened(id);
        onOpen?.(id);
      }}
      aria-label={fillTerm(
        uiContent.glossary.definitionLabelTemplate,
        glossary[id]?.term || children,
      )}
    >
      {children}
    </button>
  );
}

export function GlossaryDrawer({ activeId, onSelect, onClose }) {
  const { glossaryContent, locale, uiContent } = useContent();
  const { glossary, glossaryOrder } = useMemo(
    () => buildGlossary(glossaryContent),
    [glossaryContent],
  );
  const trail = useContext(GlossaryTrailContext);
  const entry = activeId ? glossary[activeId] : null;
  const panelRef = useDrawer({ open: Boolean(entry), onClose });

  const met = trail?.met;
  const trailIds = useMemo(
    () =>
      glossaryOrder.filter(
        (id) => glossary[id] && (met?.has(id) || id === activeId),
      ),
    [activeId, glossary, glossaryOrder, met],
  );

  if (!entry) return null;

  const select = (id) => {
    trail?.markOpened(id);
    onSelect?.(id);
  };

  return (
    <>
      <div className="glossary-backdrop" onClick={onClose} aria-hidden="true" />
      <aside
        ref={panelRef}
        tabIndex={-1}
        className="glossary-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={fillTerm(uiContent.glossary.dialogLabelTemplate, entry.term)}
        lang={locale}
      >
        <span className="glossary-grip" aria-hidden="true" />

        <div className="glossary-drawer-head">
          <p className="glossary-eyebrow">
            <BookMarked size={13} aria-hidden="true" />
            {uiContent.glossary.eyebrow}
          </p>
          <button
            className="glossary-close"
            type="button"
            onClick={onClose}
            aria-label={uiContent.glossary.closeLabel}
          >
            ×
          </button>
        </div>

        <div className="glossary-drawer-body" key={activeId}>
          <h4 className="glossary-drawer-term">{entry.term}</h4>
          <span className="glossary-drawer-rule" aria-hidden="true" />
          {entry.definition.split("\n\n").map((paragraph, i) => (
            <p key={i} className="glossary-drawer-text">
              {paragraph}
            </p>
          ))}
        </div>

        {trailIds.length > 1 && (
          <nav className="glossary-trail" aria-label={uiContent.glossary.trailAriaLabel}>
            <p className="glossary-trail-label">
              {uiContent.glossary.trailLabel}
              <span className="glossary-trail-count tnum">{trailIds.length}</span>
            </p>
            <ul className="glossary-trail-list">
              {trailIds.map((id) => {
                const active = id === activeId;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      className="glossary-trail-item"
                      aria-current={active ? "true" : undefined}
                      onClick={() => select(id)}
                    >
                      <span className="glossary-trail-num tnum">
                        {String(glossaryOrder.indexOf(id) + 1).padStart(2, "0")}
                      </span>
                      <span className="glossary-trail-term">
                        {glossary[id].term}
                      </span>
                      <ChevronRight
                        className="glossary-trail-chevron"
                        size={15}
                        aria-hidden="true"
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </aside>
    </>
  );
}

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
import { glossary, glossaryOrder } from "../../data/glossary";
import { useDrawer } from "../../hooks/useDrawer";

/**
 * La scia del lettore dentro il glossario: quali parole ha già incontrato
 * (`met`) e quali ha già aperto (`opened`).
 *
 * «Incontrata» vuol dire che la parola è passata davanti ai suoi occhi: la
 * segna un IntersectionObserver sul bottone stesso, non lo scorrimento della
 * pagina, così vale anche per chi arriva da un'ancora o salta un pezzo. Una
 * parola aperta è ovviamente anche incontrata.
 *
 * Serve al pannello per offrire, quando si apre una parola in fondo alla
 * pagina, anche tutte quelle di prima: chi ha dimenticato che cos'era un
 * hotspot mentre legge dei rifugi non deve risalire la storia per rileggerlo.
 *
 * È memoria di sessione, non di lettura: si azzera al ricaricamento, come si
 * azzera la storia.
 */
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

/**
 * Inline glossary term that opens the GlossaryDrawer on click.
 *
 * Fuori dal provider funziona lo stesso: apre la sua definizione e basta, senza
 * elenco delle parole precedenti.
 */
export function GlossaryTerm({ id, children, onOpen }) {
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
      // Un filo dentro il bordo basso: la parola conta come letta quando è
      // davvero in pagina, non mentre spunta dal fondo dello schermo.
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
      aria-label={`Definizione: ${glossary[id]?.term || children}`}
    >
      {children}
    </button>
  );
}

/**
 * Slide-in drawer showing a glossary definition.
 *
 * Sotto la definizione, l'elenco delle parole già incontrate: la definizione
 * aperta è una riga come le altre, evidenziata, così si vede a colpo d'occhio
 * a che punto della storia si è. Compare solo se c'è davvero qualcosa da
 * scegliere, cioè da due parole in su.
 */
export function GlossaryDrawer({ activeId, onSelect, onClose }) {
  const trail = useContext(GlossaryTrailContext);
  const entry = activeId ? glossary[activeId] : null;
  const panelRef = useDrawer({ open: Boolean(entry), onClose });

  const met = trail?.met;
  const trailIds = useMemo(
    () =>
      glossaryOrder.filter(
        (id) => glossary[id] && (met?.has(id) || id === activeId),
      ),
    [met, activeId],
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
        aria-label={`Glossario: ${entry.term}`}
      >
        <span className="glossary-grip" aria-hidden="true" />

        <div className="glossary-drawer-head">
          <p className="glossary-eyebrow">
            <BookMarked size={13} aria-hidden="true" />
            Glossario
          </p>
          <button
            className="glossary-close"
            type="button"
            onClick={onClose}
            aria-label="Chiudi glossario"
          >
            ×
          </button>
        </div>

        {/* `key`: cambiare parola rigioca la dissolvenza, così si vede che il
            testo sotto è cambiato anche quando la nuova definizione è lunga
            quanto quella di prima. */}
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
          <nav className="glossary-trail" aria-label="Parole già incontrate">
            <p className="glossary-trail-label">
              Già incontrate
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

import { useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight } from "lucide-react";
import { useContent } from "../../content";
import { useDrawer } from "../../hooks/useDrawer";

/**
 * Pulsante "Come leggere la mappa", da mettere nelle legende delle mappe.
 * `iconOnly`: solo la "i" (il testo resta come nome accessibile).
 */
export function MapGuideButton({
  label,
  open,
  onClick,
  controls,
  className = "",
  iconOnly = false,
}) {
  return (
    <button
      type="button"
      className={`map-guide-button${iconOnly ? " map-guide-button--icon" : ""}${className ? ` ${className}` : ""}`}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={controls}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
      onClick={onClick}
    >
      <span className="map-guide-button-icon" aria-hidden="true">
        i
      </span>
      {!iconOnly && <span>{label}</span>}
    </button>
  );
}

/**
 * Popup "Come leggere la mappa", riutilizzabile in tutte le mappe.
 *
 * Mentre è aperto la pagina non scorre (useDrawer blocca lo scorrimento, chiude
 * con Esc e tiene il focus dentro). La pausa della sequenza della mappa spetta
 * a chi lo apre, che deve trattare `open` come una pausa.
 *
 * Su desktop è una finestra al centro; sotto i 1280px diventa un pannello che
 * sale dal basso (vedi maps.css).
 *
 * `guide`: { id, title, note?, sections[{ title, paragraphs[] }],
 * source?{ label, text }, linkLabel } dai contenuti.
 * `href`: la webapp di approfondimento.
 */
export function MapGuideDialog({ open, onClose, guide, href }) {
  const { locale, uiContent } = useContent();
  const panelRef = useDrawer({ open, onClose });

  // useDrawer blocca lo scorrimento su <html>. Il <body> della pagina ha
  // overflow-y: auto: senza la propagazione dall'<html> diventerebbe un
  // contenitore di scorrimento a sé e le scene "sticky" sotto il popup
  // salterebbero in alto. Finché il popup è aperto il <body> resta visibile.
  useLayoutEffect(() => {
    if (!open) return undefined;
    const body = document.body;
    const previous = body.style.overflow;
    body.style.overflow = "visible";
    return () => {
      body.style.overflow = previous;
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const titleId = `${guide.id}-title`;

  return createPortal(
    <div className="map-guide-layer" lang={locale}>
      <div className="map-guide-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        id={guide.id}
        tabIndex={-1}
        className="map-guide"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="map-guide-head">
          <h2 id={titleId} className="map-guide-title">
            {guide.title}
          </h2>
          <button
            type="button"
            className="map-guide-close"
            onClick={onClose}
            aria-label={uiContent.actions.close}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div className="map-guide-body">
          {guide.note && <p className="map-guide-note">{guide.note}</p>}
          {guide.sections.map((section) => (
            <section key={section.title} className="map-guide-section">
              <h3 className="map-guide-section-title">{section.title}</h3>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
          {guide.source && (
            <p className="map-guide-source">
              <strong>{guide.source.label}:</strong> {guide.source.text}
            </p>
          )}
        </div>

        <div className="map-guide-foot">
          <a
            className="map-guide-link"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>{guide.linkLabel}</span>
            <ArrowUpRight size={18} aria-hidden="true" />
          </a>
        </div>
      </div>
    </div>,
    document.body,
  );
}

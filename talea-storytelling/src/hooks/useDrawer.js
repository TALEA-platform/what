import { useEffect, useRef } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/**
 * Il comportamento comune ai due pannelli che scorrono dentro dal bordo
 * destro — il glossario e «Metodo e fonti». Erano due dialoghi che si
 * comportavano in due modi diversi: quello del metodo si chiudeva con Esc,
 * quello del glossario no; nessuno dei due spostava il fuoco, quindi con la
 * tastiera si apriva un pannello e si continuava a tabulare nella pagina
 * dietro, che il pannello copre.
 *
 * Restituisce la ref da mettere sul pannello (che vuole `tabIndex={-1}`, per
 * poter ricevere il fuoco senza entrare nell'ordine di tabulazione):
 *
 *   Esc          chiude
 *   apertura     il fuoco entra nel pannello
 *   Tab          gira dentro il pannello finché è aperto
 *   chiusura     il fuoco torna alla parola, o al link, da cui si era partiti
 *
 * ── Il blocco dello scorrimento ─────────────────────────────────────────────
 * Con un pannello aperto la storia dietro sta ferma: la rotellina scorre solo
 * dentro il pannello, dove il testo può essere più alto della scheda. Senza,
 * leggere una definizione voleva dire far scorrere la storia sotto, e alla
 * chiusura ci si ritrovava in un altro punto del racconto.
 *
 * Il blocco sta su <html>, non sul <body>. `body { overflow: hidden }` è la
 * ricetta più diffusa ed è quella sbagliata qui: azzera l'altezza scorribile
 * del documento e il browser riporta la pagina in cima, cioè butta via il
 * punto della storia in cui si era. Su <html> l'overflow si propaga alla
 * finestra: lo scorrimento si spegne, la posizione resta, e nessun elemento
 * cambia di posto — le scene agganciate restano agganciate dove sono.
 *
 * Il `padding-right` compensa la barra di scorrimento che sparisce, altrimenti
 * all'apertura tutta la pagina scivolerebbe di una decina di pixel.
 */
export function useDrawer({ open, onClose }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const panel = panelRef.current;
    const returnTo = document.activeElement;

    const root = document.documentElement;
    const previous = {
      overflow: root.style.overflow,
      paddingRight: root.style.paddingRight,
    };
    const scrollbar = window.innerWidth - root.clientWidth;
    root.style.overflow = "hidden";
    if (scrollbar > 0) root.style.paddingRight = `${scrollbar}px`;

    // Il fuoco entra sul pannello, non sul primo bottone: così il lettore di
    // schermo annuncia il titolo del dialogo prima di «Chiudi».
    panel?.focus?.({ preventScroll: true });

    const onKey = (event) => {
      if (event.key === "Escape") {
        onClose?.();
        return;
      }
      if (event.key !== "Tab" || !panel) return;

      const items = Array.from(panel.querySelectorAll(FOCUSABLE)).filter(
        (el) => el.offsetWidth > 0 || el.offsetHeight > 0,
      );
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      root.style.overflow = previous.overflow;
      root.style.paddingRight = previous.paddingRight;
      // `isConnected`: se la parola da cui si era partiti è uscita dal DOM nel
      // frattempo, rimetterle il fuoco lo manderebbe sul <body>.
      if (returnTo?.isConnected) returnTo.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  return panelRef;
}

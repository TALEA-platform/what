import { useEffect, useRef } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

export function useDrawer({ open, onClose }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const panel = panelRef.current;
    const returnTo = document.activeElement;

    // Lock <html>, not <body>, to preserve the story's scroll position.
    const root = document.documentElement;
    const previous = {
      overflow: root.style.overflow,
      paddingRight: root.style.paddingRight,
    };
    const scrollbar = window.innerWidth - root.clientWidth;
    root.style.overflow = "hidden";
    if (scrollbar > 0) root.style.paddingRight = `${scrollbar}px`;

    // Focusing the panel makes its dialog title precede the close control for screen readers.
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
      // A trigger may have left the DOM while the drawer was open.
      if (returnTo?.isConnected) returnTo.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  return panelRef;
}

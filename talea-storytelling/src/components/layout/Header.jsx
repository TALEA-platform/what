import { useState, useEffect } from "react";
import { BookOpen, ExternalLink, Menu, X } from "lucide-react";

const logoUrl = new URL("/assets/talea-logo.png", import.meta.url).href;

// Full-bleed, pinned map scenes (hotspot + shadow + the rifugi and pilot-zone
// maps). While one of these covers the viewport the header slides away so it
// stops stealing space over the map; it returns in the text sections. The causes
// scene is an editorial framed crop, not a full map, so it deliberately keeps the
// header.
const MAP_SCENE_SELECTOR = ".hotspot-scene-map, .sf-scene-map, .relief-map-sticky";

export function Header({ onOpenMethod }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let frame = null;
    const update = () => {
      frame = null;
      const vh = window.innerHeight || 768;
      let onMap = false;
      document.querySelectorAll(MAP_SCENE_SELECTOR).forEach((el) => {
        const r = el.getBoundingClientRect();
        // Pinned and covering most of the viewport from the top.
        if (r.top <= 4 && r.bottom > vh * 0.55) onMap = true;
      });
      setHidden(onMap);
      if (onMap) setMenuOpen(false);
    };
    const requestUpdate = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, []);

  return (
    <header className={`header${hidden ? " header--hidden" : ""}`}>
      <div className="header-inner">
        <div className="brand-left">
          <img className="brand-logo" src={logoUrl} alt="TALEA" />
          <div className="brand-text">
            <h1 className="brand-title">TALEA</h1>
          </div>
        </div>

        <button
          className="mobile-menu-btn"
          type="button"
          aria-label={menuOpen ? "Chiudi menu" : "Apri menu"}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        <div className={`header-actions header-nav${menuOpen ? " open" : ""}`}>
          <button
            type="button"
            className="header-link"
            onClick={() => {
              setMenuOpen(false);
              onOpenMethod?.();
            }}
          >
            <BookOpen size={15} />
            <span className="link-label">Metodo e fonti</span>
          </button>
          <a
            className="header-link"
            href="https://talea.comune.bologna.it/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={15} />
            <span className="link-label">Esplora dati</span>
          </a>
        </div>
      </div>
    </header>
  );
}

import { useState, useEffect } from "react";
import { BookOpen, ExternalLink, Menu, X } from "lucide-react";
import {
  siteConfig,
  supportedLocales,
  useContent,
} from "../../content";

const logoUrl = new URL("/assets/talea-logo.png", import.meta.url).href;
const { platformUrl } = siteConfig;

const MAP_SCENE_SELECTOR = ".hotspot-scene-map, .sf-scene-map, .relief-map-sticky";

export function Header({ onOpenMethod }) {
  const { locale, methodContent, setLocale, uiContent } = useContent();
  const [menuOpen, setMenuOpen] = useState(false);
  const [hidden, setHidden] = useState(false);

  const changeLocale = (language) => {
    const position = { x: window.scrollX, y: window.scrollY };
    setLocale(language);
    requestAnimationFrame(() => {
      window.scrollTo({ left: position.x, top: position.y, behavior: "instant" });
      requestAnimationFrame(() => {
        window.scrollTo({ left: position.x, top: position.y, behavior: "instant" });
      });
    });
  };

  useEffect(() => {
    let frame = null;
    const update = () => {
      frame = null;
      const vh = window.innerHeight || 768;
      let onMap = false;
      document.querySelectorAll(MAP_SCENE_SELECTOR).forEach((el) => {
        const r = el.getBoundingClientRect();
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
    <header className={`header${hidden ? " header--hidden" : ""}`} lang={locale}>
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
          aria-label={menuOpen ? uiContent.header.menu.close : uiContent.header.menu.open}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        <div className={`header-actions header-nav${menuOpen ? " open" : ""}`}>
          <div className="lang-switch" role="group" aria-label="Lingua / Language">
            {supportedLocales.map((language) => (
              <button
                key={language}
                type="button"
                className={language === locale ? "active" : undefined}
                aria-pressed={language === locale}
                lang={language}
                onClick={() => changeLocale(language)}
              >
                {language.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="header-link"
            onClick={() => {
              setMenuOpen(false);
              onOpenMethod?.();
            }}
          >
            <BookOpen size={15} />
            <span className="link-label">{methodContent.title}</span>
          </button>
          <a
            className="header-link"
            href={platformUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={15} />
            <span className="link-label">{uiContent.header.exploreData.label}</span>
          </a>
        </div>
      </div>
    </header>
  );
}

import { useEffect, useRef, useState } from "react";
import { BookOpen, ExternalLink, Menu, Sprout, X } from "lucide-react";
import {
  siteConfig,
  supportedLocales,
  useContent,
} from "../../content";

const logoUrl = new URL("/assets/talea-logo.png", import.meta.url).href;
const { platformUrl } = siteConfig;

const MAP_SCENE_SELECTOR = ".hotspot-scene-map, .sf-scene-map, .relief-map-sticky";
const MOBILE_IMMERSIVE_SCENE_SELECTOR =
  ".plan-stage, .relief-explainer--engaged .relief-explainer-stage";

export function Header({
  onOpenMethod,
  progressOpen = false,
  mobileScrubbing = false,
  mobileScrubbingRef,
  onProgressOpenChange,
  onVisibilityChange,
}) {
  const { locale, methodContent, setLocale, uiContent } = useContent();
  const [menuOpen, setMenuOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const forcedVisibleRef = useRef(false);
  const immersiveRef = useRef(false);

  const changeLocale = (language) => {
    const position = { x: window.scrollX, y: window.scrollY };
    setMenuOpen(false);
    setLocale(language);
    requestAnimationFrame(() => {
      window.scrollTo({ left: position.x, top: position.y, behavior: "instant" });
      requestAnimationFrame(() => {
        window.scrollTo({ left: position.x, top: position.y, behavior: "instant" });
      });
    });
  };

  const languageSwitch = (modifier) => (
    <div
      className={`lang-switch lang-switch--${modifier}`}
      role="group"
      aria-label="Lingua / Language"
    >
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
  );

  useEffect(() => {
    let frame = null;
    const update = () => {
      frame = null;
      const vh = window.innerHeight || 768;
      const isMobile = window.innerWidth < 1280;
      let onMap = false;
      document.querySelectorAll(MAP_SCENE_SELECTOR).forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top <= 4 && r.bottom > vh * 0.55) onMap = true;
      });
      if (isMobile && !onMap) {
        document.querySelectorAll(MOBILE_IMMERSIVE_SCENE_SELECTOR).forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.top <= 4 && r.bottom > vh * 0.55) onMap = true;
        });
      }
      immersiveRef.current = isMobile && onMap;
      if (!onMap) forcedVisibleRef.current = false;
      const scrubInProgress =
        isMobile && (mobileScrubbingRef?.current || mobileScrubbing);
      const nextHidden =
        onMap && !(isMobile && (scrubInProgress || forcedVisibleRef.current));
      setHidden(nextHidden);
      onVisibilityChange?.(nextHidden);
      if (nextHidden) {
        setMenuOpen(false);
      }
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
  }, [mobileScrubbing, mobileScrubbingRef, onProgressOpenChange, onVisibilityChange]);

  return (
    <>
      <header className={`header${hidden ? " header--hidden" : ""}`} lang={locale}>
        <div className="header-inner">
        <div className="brand-left">
          <img className="brand-logo" src={logoUrl} alt="TALEA" />
          <div className="brand-text">
            <h1 className="brand-title">TALEA</h1>
          </div>
        </div>

        <div className="header-mobile-actions">
          {languageSwitch("mobile")}
          <button
            className={`mobile-progress-btn${progressOpen ? " is-active" : ""}`}
            type="button"
            aria-label={uiContent.progress.ariaLabel}
            aria-expanded={progressOpen}
            aria-controls="mobile-story-progress"
            onClick={() => {
              const nextOpen = !progressOpen;
              setMenuOpen(false);
              onProgressOpenChange?.(nextOpen);
              if (!nextOpen && window.innerWidth < 1280 && immersiveRef.current) {
                forcedVisibleRef.current = false;
                setHidden(true);
                onVisibilityChange?.(true);
              }
            }}
          >
            <Sprout size={19} />
          </button>
          <button
            className="mobile-menu-btn"
            type="button"
            aria-label={menuOpen ? uiContent.header.menu.close : uiContent.header.menu.open}
            aria-expanded={menuOpen}
            aria-controls="header-mobile-menu"
            onClick={() => {
              if (!menuOpen) onProgressOpenChange?.(false);
              setMenuOpen((v) => !v);
            }}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        <div
          id="header-mobile-menu"
          className={`header-actions header-nav${menuOpen ? " open" : ""}`}
        >
          {languageSwitch("desktop")}
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
            onClick={() => setMenuOpen(false)}
          >
            <ExternalLink size={15} />
            <span className="link-label">{uiContent.header.exploreData.label}</span>
          </a>
        </div>
        </div>
      </header>
      <button
        className={`mobile-shell-reopen${hidden ? " is-visible" : ""}`}
        type="button"
        aria-label={uiContent.progress.ariaLabel}
        onClick={() => {
          forcedVisibleRef.current = true;
          setHidden(false);
          onVisibilityChange?.(false);
          onProgressOpenChange?.(true);
        }}
      >
        <Sprout size={19} />
      </button>
    </>
  );
}

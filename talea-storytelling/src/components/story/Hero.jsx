import { useEffect, useRef, useState } from "react";
import { HeroBridgeSection } from "./HeroBridgeSection";
import { CopySegments } from "./CopySegments";
import { useContent } from "../../content";
import { assetUrl } from "../../lib/assetUrl";

const heroVideo = assetUrl("/data/hero/bologna.mp4");
const heroPoster = assetUrl("/data/hero/bologna-poster.jpg");

const SCALE_STOPS = [[0, 1], [0.4, 1.14], [0.75, 1.34], [1, 1.58]];
const TEXT_OPACITY_STOPS = [[0, 1], [0.24, 0.65], [0.4, 0.12], [0.48, 0]];
const TEXT_Y_STOPS = [[0, 0], [0.26, -20], [0.48, -48], [1, -72]];
const TEXT_SCALE_STOPS = [[0, 1], [0.24, 1.08], [0.4, 1.24], [0.48, 1.44]];
const OVERLAY_STOPS = [[0, 0.1], [0.3, 0.24], [0.48, 0.38], [0.9, 0.38], [1, 0.12]];
const BRIDGE_OPACITY_STOPS = [[0, 0], [0.26, 0], [0.38, 0.5], [0.48, 1], [0.9, 1], [1, 0]];
const MOBILE_BRIDGE_VISIBLE_STOPS = [[0.35, 1], [0.9, 1], [1, 0]];
const BRIDGE_Y_STOPS = [[0, 30], [0.38, 14], [0.48, 0], [0.9, 0], [1, -22]];
const BRIDGE_SCALE_STOPS = [[0, 1.1], [0.38, 1.04], [0.48, 1], [0.9, 1], [1, 1.16]];
const BRIDGE_BLUR_STOPS = [[0, 6], [0.38, 2], [0.48, 0], [0.9, 0], [1, 10]];
const HERO_FADE_STOPS = [[0, 1], [0.87, 1], [1, 0]];
const MOBILE_HERO_FADE_STOPS = [[0, 1], [0.75, 1], [1, 0]];
const MOBILE_COPY_SWAP_AT = 0.35;

const BRIDGE_LIT_ON = 0.46;
const BRIDGE_LIT_OFF = 0.4;

const POSTER_GRACE_MS = 700;

function interp(p, stops) {
  if (p <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i += 1) {
    const [p1, v1] = stops[i];
    if (p <= p1) {
      const [p0, v0] = stops[i - 1];
      const t = p1 === p0 ? 0 : (p - p0) / (p1 - p0);
      return v0 + (v1 - v0) * t;
    }
  }
  return stops[stops.length - 1][1];
}

const clamp01 = (n) => Math.min(1, Math.max(0, n));

export function Hero() {
  const { content } = useContent();
  const { heroOpening } = content;
  const videoRef = useRef(null);
  const wrapperRef = useRef(null);
  const stickyRef = useRef(null);
  const mobileHeroNearbyRef = useRef(true);
  const mobileHeroPastRef = useRef(false);
  const heroEndScrollRef = useRef(Infinity);
  const syncHeroScrollRef = useRef(null);
  const [videoReady, setVideoReady] = useState(false);
  const [posterVisible, setPosterVisible] = useState(false);
  const [mobileMode, setMobileMode] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 1280,
  );
  const [reduceMotion, setReduceMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (event) => setReduceMotion(event.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1279px)");
    const handler = (event) => setMobileMode(event.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    if (video.readyState >= 2) setVideoReady(true);

    const resume = () => {
      video.play().catch(() => {});
    };
    if (typeof IntersectionObserver !== "function") {
      resume();
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? resume() : video.pause()),
      { threshold: 0 },
    );
    observer.observe(mobileMode ? wrapperRef.current ?? video : video);
    return () => observer.disconnect();
  }, [mobileMode]);

  useEffect(() => {
    if (videoReady) window.__taleaBoot?.ready("hero");
  }, [videoReady]);

  useEffect(() => {
    const id = window.setTimeout(() => setPosterVisible(true), POSTER_GRACE_MS);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return undefined;
    if (!mobileMode || typeof IntersectionObserver !== "function") {
      mobileHeroNearbyRef.current = true;
      syncHeroScrollRef.current?.();
      return undefined;
    }

    let syncFrame = null;
    const vh = window.innerHeight || 768;
    const rect = wrapper.getBoundingClientRect();
    mobileHeroNearbyRef.current = rect.top <= vh * 2 && rect.bottom >= -vh;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const nextNearby = entry.isIntersecting;
        if (nextNearby === mobileHeroNearbyRef.current) return;
        mobileHeroNearbyRef.current = nextNearby;
        if (!nextNearby) {
          videoRef.current?.pause();
          return;
        }
        if (syncFrame) cancelAnimationFrame(syncFrame);
        syncFrame = requestAnimationFrame(() => {
          syncFrame = null;
          syncHeroScrollRef.current?.();
        });
      },
      { rootMargin: "100% 0px 100% 0px", threshold: 0 },
    );
    observer.observe(wrapper);
    return () => {
      observer.disconnect();
      if (syncFrame) cancelAnimationFrame(syncFrame);
    };
  }, [mobileMode]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const sticky = stickyRef.current;
    if (!wrapper || !sticky) return;

    let frame = null;
    let bridgeLit = false;
    let viewportHeight = 1;
    let wrapperStartY = 0;
    let wrapperHeight = 1;
    let scrollable = 1;

    const measure = () => {
      viewportHeight = window.innerHeight || 1;
      const wrapperRect = wrapper.getBoundingClientRect();
      wrapperStartY = window.scrollY + wrapperRect.top;
      wrapperHeight = wrapper.offsetHeight;
      scrollable = Math.max(1, wrapperHeight - viewportHeight);
      heroEndScrollRef.current = wrapperStartY + scrollable;
    };

    if (mobileMode) {
      // These values never animate on mobile. Set them once instead of
      // rewriting the same CSS properties on every scroll frame.
      sticky.style.setProperty("--hero-scale", "1");
      sticky.style.setProperty("--hero-text-y", "0px");
      sticky.style.setProperty("--hero-text-scale", "1");
      sticky.style.setProperty("--bridge-y", "0px");
      sticky.style.setProperty("--bridge-scale", "1");
      sticky.style.setProperty("--bridge-blur", "0px");
      sticky.style.setProperty("--hero-exit-blur", "0px");
    }

    const update = () => {
      frame = null;
      const progress = clamp01((window.scrollY - wrapperStartY) / scrollable);
      mobileHeroPastRef.current = mobileMode && progress >= 0.9995;

      if (!mobileMode) {
        const textY = reduceMotion ? 0 : interp(progress, TEXT_Y_STOPS);
        const textScale = reduceMotion ? 1 : interp(progress, TEXT_SCALE_STOPS);
        const bridgeY = reduceMotion ? 0 : interp(progress, BRIDGE_Y_STOPS);
        const bridgeScale = reduceMotion ? 1 : interp(progress, BRIDGE_SCALE_STOPS);
        const bridgeBlur = reduceMotion ? 0 : interp(progress, BRIDGE_BLUR_STOPS);

        sticky.style.setProperty("--hero-scale", interp(progress, SCALE_STOPS).toFixed(4));
        sticky.style.setProperty("--hero-text-y", `${textY.toFixed(1)}px`);
        sticky.style.setProperty("--hero-text-scale", textScale.toFixed(4));
        sticky.style.setProperty("--bridge-y", `${bridgeY.toFixed(1)}px`);
        sticky.style.setProperty("--bridge-scale", bridgeScale.toFixed(4));
        sticky.style.setProperty("--bridge-blur", `${bridgeBlur.toFixed(2)}px`);
      }

      sticky.style.setProperty(
        "--hero-text-opacity",
        (mobileMode
          ? progress < MOBILE_COPY_SWAP_AT
            ? 1
            : 0
          : interp(progress, TEXT_OPACITY_STOPS)
        ).toFixed(3),
      );
      sticky.style.setProperty("--hero-overlay-opacity", interp(progress, OVERLAY_STOPS).toFixed(3));
      sticky.style.setProperty(
        "--bridge-opacity",
        (mobileMode
          ? progress < MOBILE_COPY_SWAP_AT
            ? 0
            : interp(progress, MOBILE_BRIDGE_VISIBLE_STOPS)
          : interp(progress, BRIDGE_OPACITY_STOPS)
        ).toFixed(3),
      );
      const heroFade = interp(
        progress,
        mobileMode ? MOBILE_HERO_FADE_STOPS : HERO_FADE_STOPS,
      );
      sticky.style.setProperty("--hero-fade", heroFade.toFixed(3));
      if (!mobileMode) {
        const exitBlur = reduceMotion ? 0 : (1 - heroFade) * 16;
        sticky.style.setProperty("--hero-exit-blur", `${exitBlur.toFixed(1)}px`);
      }

      if (mobileMode) {
        const video = videoRef.current;
        const inViewport =
          window.scrollY + viewportHeight > wrapperStartY &&
          window.scrollY < wrapperStartY + wrapperHeight;
        const heroPast = progress >= 0.9995;
        if ((!inViewport || heroPast) && video && !video.paused) {
          video.pause();
        } else if (inViewport && !heroPast && video?.paused) {
          video.play().catch(() => {});
        }

        if (heroPast) sticky.dataset.heroPast = "true";
        else delete sticky.dataset.heroPast;
      } else {
        delete sticky.dataset.heroPast;
      }

      const nextLit = bridgeLit
        ? progress > BRIDGE_LIT_OFF
        : progress >= BRIDGE_LIT_ON;
      if (nextLit !== bridgeLit) {
        bridgeLit = nextLit;
        sticky.dataset.bridgeLit = nextLit ? "on" : "off";
      }
    };

    const requestUpdate = () => {
      if (mobileMode) {
        if (!mobileHeroNearbyRef.current) return;
        if (
          mobileHeroPastRef.current &&
          window.scrollY >= heroEndScrollRef.current - 1
        )
          return;
        mobileHeroPastRef.current = false;
      }
      if (!frame) frame = requestAnimationFrame(update);
    };
    const syncNow = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const requestResize = () => {
      measure();
      requestUpdate();
    };
    syncHeroScrollRef.current = syncNow;
    measure();
    if (!mobileMode || mobileHeroNearbyRef.current) update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestResize);
    return () => {
      if (syncHeroScrollRef.current === syncNow) syncHeroScrollRef.current = null;
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestResize);
    };
  }, [mobileMode, reduceMotion]);

  return (
    <section
      ref={wrapperRef}
      className="hero-zoom-scroll"
      aria-label={heroOpening.ariaLabel}
    >
      <div ref={stickyRef} className="hero-sticky" data-bridge-lit="off">
        <div
          className={`hero-bg ${videoReady ? "is-video-ready" : ""} ${
            posterVisible ? "is-poster-visible" : ""
          }`}
        >
          <div className="hero-bg-poster" aria-hidden="true" />
          <video
            ref={videoRef}
            className="hero-bg-video"
            src={heroVideo}
            poster={heroPoster}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            onLoadedData={() => setVideoReady(true)}
            onCanPlay={() => setVideoReady(true)}
            onError={() => {
              setPosterVisible(true);
              window.__taleaBoot?.ready("hero");
            }}
            aria-hidden="true"
          />
          <div className="hero-bg-veil" aria-hidden="true" />
        </div>

        <div className="hero-zoom-overlay" aria-hidden="true" />

        <div className="hero-content">
          <div className="hero-content-inner">
            <h2 className="hero-title">{heroOpening.title}</h2>

            <p className="hero-subtitle">
              <span className="hero-subtitle-lead">
                <CopySegments parts={heroOpening.subtitle.slice(0, 1)} kwClass="hero-kw" />
              </span>
              <span className="hero-subtitle-follow">
                <CopySegments parts={heroOpening.subtitle.slice(1)} kwClass="hero-kw" />
              </span>
            </p>

            <div className="hero-scroll">
              <span className="hero-scroll-label">{heroOpening.scrollLabel}</span>
              <span className="hero-scroll-line" aria-hidden="true">
                <span className="hero-scroll-line-progress" />
              </span>
            </div>
          </div>
        </div>

        <div className="hero-bridge-preview">
          <HeroBridgeSection />
        </div>
      </div>
    </section>
  );
}

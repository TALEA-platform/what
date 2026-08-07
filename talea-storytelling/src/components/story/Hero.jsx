import { useEffect, useRef, useState } from "react";
import { HeroBridgeSection } from "./HeroBridgeSection";
import { CopySegments } from "./CopySegments";
import { heroOpening } from "../../data/heroCopy";

const heroVideo = "/data/hero/bologna.mp4";
const heroPoster = "/data/hero/bologna-poster.jpg";

// Scroll-progress → value keyframes (progress is 0..1 over the sticky wrapper).
// The zoom keeps pushing in HARD to the very end while the bridge ("second
// description") stays up; then the whole hero fades out, revealing the trend
// section that sits pulled-up underneath — so the white div with its text is
// already there. One continuous movement, no blank-white-then-rescroll.
//
// Refactor cinematico 02: il wrapper è passato da 380vh a 300vh, quindi ogni
// stop vale meno scroll di prima. Le curve sono state rilette su quella misura,
// non semplicemente riscalate.
//
// 02 § 2.2 — zoom più corto e più deciso: l'accelerazione finale (0,75 → 1)
// cade esattamente sulla dissolvenza, ed è lì che la telecamera deve sembrare
// "entrare" nella città.
const SCALE_STOPS = [[0, 1], [0.4, 1.14], [0.75, 1.34], [1, 1.58]];
// Title and bridge resolve earlier, freeing a long final stretch for the dissolve.
// Faster exit: the first text is fully gone by ~0.48 (was 0.55), so the hand-off
// to the second copy feels snappier.
const TEXT_OPACITY_STOPS = [[0, 1], [0.24, 0.65], [0.4, 0.12], [0.48, 0]];
const TEXT_Y_STOPS = [[0, 0], [0.26, -20], [0.48, -48], [1, -72]];
// The hero copy pushes OUT from its centre as it dissolves — the same
// "zoom-into" motion as the background video — so the first text feels like
// it's being flown into rather than merely fading up. Scale grows while the
// opacity ramps to 0 (both resolve by ~0.48), so the words swell and dissolve
// toward the edges instead of shrinking away.
const TEXT_SCALE_STOPS = [[0, 1], [0.24, 1.08], [0.4, 1.24], [0.48, 1.44]];
// 02 § 2.5 — il velo non deve virare al grigio. Il picco scende da 0,50 a 0,38
// (sopra, il video si spegneva in un grigio-verde) e il plateau accompagna il
// ponte per tutta la sua vita, invece di mollarlo prima.
const OVERLAY_STOPS = [[0, 0.1], [0.3, 0.24], [0.48, 0.38], [0.9, 0.38], [1, 0.12]];
// 02 § 2.1 — il ponte NON esce prima dell'hero: esce CON l'hero, coperto
// dall'emersione della sezione trend. Prima usciva a 0,87 e restava una
// schermata intera di verde senza contenuto: era il primo buco della storia, e
// nel punto peggiore (il lettore non sa ancora se vale la pena continuare).
const BRIDGE_OPACITY_STOPS = [[0, 0], [0.26, 0], [0.38, 0.5], [0.48, 1], [0.9, 1], [1, 0]];
const BRIDGE_Y_STOPS = [[0, 30], [0.38, 14], [0.48, 0], [0.9, 0], [1, -22]];
// Enters slightly zoomed-in, resolving to sharp/1:1 by ~0.48; holds; then on
// exit swells and blurs out so it visibly dissolves toward the edges.
const BRIDGE_SCALE_STOPS = [[0, 1.1], [0.38, 1.04], [0.48, 1], [0.9, 1], [1, 1.16]];
// 02 § 2.1 — entrata quasi nitida: 6 px invece di 18, e ≤ 2 px già quando il
// ponte arriva a metà opacità. Sfocato si entra da un'immagine, non da un
// concetto: il testo importante non deve mai essere illeggibile mentre lo si
// legge.
const BRIDGE_BLUR_STOPS = [[0, 6], [0.38, 2], [0.48, 0], [0.9, 0], [1, 10]];
// The whole hero holds opaque until ~0.87, then dissolves over the last stretch
// (0.87→1, ~26vh on the 300vh wrapper), revealing the trend section beneath
// with a soft, low-contrast hand-off. Il ponte se ne va dentro questa finestra.
const HERO_FADE_STOPS = [[0, 1], [0.87, 1], [1, 0]];

// 02 § 2.7 — le parole in evidenza si accendono quando il ponte è ormai
// leggibile, non mentre entra. Due soglie invece di una: senza isteresi, un
// dito sul trackpad intorno alla soglia le farebbe lampeggiare.
const BRIDGE_LIT_ON = 0.46;
const BRIDGE_LIT_OFF = 0.4;

// 02 § 2.3 — il poster non si mostra subito: il video apre con una dissolvenza
// dal bianco, e mostrare prima la città ferma darebbe "città → bianco → città".
// Se il video è pronto entro questa finestra il lettore non vede mai il poster;
// se non lo è (rete lenta, autoplay bloccato) il poster entra al suo posto.
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
  const videoRef = useRef(null);
  const wrapperRef = useRef(null);
  const stickyRef = useRef(null);
  const [videoReady, setVideoReady] = useState(false);
  const [posterVisible, setPosterVisible] = useState(false);
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

  // ── Il video gira solo mentre lo si vede ──────────────────────────────────
  // Era `autoPlay loop` e basta: continuava a decodificare fotogrammi per tutta
  // la storia, venti schermate più giù, rubando lavoro a ogni scena che viene
  // dopo. Un video di sfondo che nessuno sta guardando è puro costo — e a video
  // fermo il primo fotogramma resta comunque in quadro, quindi non si perde
  // niente nemmeno visivamente.
  //
  // Riprende da solo tornando su: `IntersectionObserver` non costa un
  // fotogramma, si limita a dire quando l'elemento entra e quando esce.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    if (video.readyState >= 2) setVideoReady(true);

    // Ambient muted loop: si riproduce a prescindere dalla preferenza «riduci
    // le animazioni», così lo sfondo dell'hero non è mai un fotogramma morto.
    const resume = () => video.play().catch(() => {});
    if (typeof IntersectionObserver !== "function") {
      resume();
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? resume() : video.pause()),
      { threshold: 0 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  // Ultimo cancello della schermata d'ingresso (vedi index.html): il fondo
  // dell'hero ha qualcosa da mostrare. Si apre col video pronto, oppure quando
  // il video ha rinunciato e subentra il poster — non con il semplice scadere
  // della grazia, che dice solo «mostra il poster», non «il poster c'è».
  useEffect(() => {
    if (videoReady) window.__taleaBoot?.ready("hero");
  }, [videoReady]);

  // Poster fallback: appears only if the video hasn't come up in time. It sits
  // UNDER the video, so if the video does arrive later it simply crossfades on
  // top and the poster is never seen again.
  useEffect(() => {
    const id = window.setTimeout(() => setPosterVisible(true), POSTER_GRACE_MS);
    return () => window.clearTimeout(id);
  }, []);

  // Scroll-driven zoom transition. Progress is measured against the tall wrapper
  // while the sticky inner is pinned, and pushed to the DOM via CSS variables so
  // the heavy work stays off the React render path.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const sticky = stickyRef.current;
    if (!wrapper || !sticky) return;

    let frame = null;
    // Kept out of React state on purpose: it's a class switch on one node, and
    // a re-render per scroll frame would be pure waste.
    let bridgeLit = false;

    const update = () => {
      frame = null;
      const vh = window.innerHeight || 1;
      const scrollable = Math.max(1, wrapper.offsetHeight - vh);
      const progress = clamp01(-wrapper.getBoundingClientRect().top / scrollable);

      // The scroll-driven zoom is the hero's defining moment, so it runs even
      // under reduced motion (it's user-driven by scroll, on a muted bg). Only
      // the small text translations are dropped when reduced motion is set.
      const scale = interp(progress, SCALE_STOPS);
      const textY = reduceMotion ? 0 : interp(progress, TEXT_Y_STOPS);
      const textScale = reduceMotion ? 1 : interp(progress, TEXT_SCALE_STOPS);
      const bridgeY = reduceMotion ? 0 : interp(progress, BRIDGE_Y_STOPS);
      const bridgeScale = reduceMotion ? 1 : interp(progress, BRIDGE_SCALE_STOPS);
      const bridgeBlur = reduceMotion ? 0 : interp(progress, BRIDGE_BLUR_STOPS);

      sticky.style.setProperty("--hero-scale", scale.toFixed(4));
      sticky.style.setProperty("--hero-text-opacity", interp(progress, TEXT_OPACITY_STOPS).toFixed(3));
      sticky.style.setProperty("--hero-text-y", `${textY.toFixed(1)}px`);
      sticky.style.setProperty("--hero-text-scale", textScale.toFixed(4));
      sticky.style.setProperty("--hero-overlay-opacity", interp(progress, OVERLAY_STOPS).toFixed(3));
      sticky.style.setProperty("--bridge-opacity", interp(progress, BRIDGE_OPACITY_STOPS).toFixed(3));
      sticky.style.setProperty("--bridge-y", `${bridgeY.toFixed(1)}px`);
      sticky.style.setProperty("--bridge-scale", bridgeScale.toFixed(4));
      sticky.style.setProperty("--bridge-blur", `${bridgeBlur.toFixed(2)}px`);
      const heroFade = interp(progress, HERO_FADE_STOPS);
      sticky.style.setProperty("--hero-fade", heroFade.toFixed(3));
      // As the hero fades out it also DEFOCUSES — the video goes soft and
      // dissolves rather than just cutting to transparent (a filmic exit).
      const exitBlur = reduceMotion ? 0 : (1 - heroFade) * 16;
      sticky.style.setProperty("--hero-exit-blur", `${exitBlur.toFixed(1)}px`);

      const nextLit = bridgeLit
        ? progress > BRIDGE_LIT_OFF
        : progress >= BRIDGE_LIT_ON;
      if (nextLit !== bridgeLit) {
        bridgeLit = nextLit;
        sticky.dataset.bridgeLit = nextLit ? "on" : "off";
      }
    };

    const requestUpdate = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, [reduceMotion]);

  return (
    <section
      ref={wrapperRef}
      className="hero-zoom-scroll"
      aria-label="Introduzione"
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
              // Il video ha rinunciato: inutile far aspettare la schermata
              // d'ingresso fino al tetto duro, il fondo definitivo è il poster.
              window.__taleaBoot?.ready("hero");
            }}
            aria-hidden="true"
          />
          <div className="hero-bg-veil" aria-hidden="true" />
        </div>

        {/* Dark/green overlay that strengthens as the zoom progresses, keeping the
            bridge copy readable over the pushed-in rendering. */}
        <div className="hero-zoom-overlay" aria-hidden="true" />

        <div className="hero-content">
          <h2 className="hero-title">{heroOpening.title}</h2>

          <p className="hero-subtitle">
            <CopySegments parts={heroOpening.subtitle} kwClass="hero-kw" />
          </p>

          <div className="hero-scroll">
            <span className="hero-scroll-label">{heroOpening.scrollLabel}</span>
            <span className="hero-scroll-line" aria-hidden="true">
              <span className="hero-scroll-line-progress" />
            </span>
          </div>
        </div>

        <div className="hero-bridge-preview">
          <HeroBridgeSection />
        </div>
      </div>
    </section>
  );
}

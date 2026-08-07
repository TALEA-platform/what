import { useEffect, useRef, useState } from "react";
import { hotspotIntroCopy } from "../../data/hotspotIntroCopy";
import { superficieSvg, ricorrenzaSvg } from "../../data/hotspotIntroVignettes";
import { CopySegments } from "./CopySegments";
import { SectionDivider } from "./SectionDivider";
import { ScrollCue } from "../ui/ScrollCue";

// Identità stabile per l'HTML iniettato. NON riscrivere come oggetto inline
// (`{{ __html: ... }}`): React confronta le prop per identità, un oggetto nuovo
// a ogni render gli fa ri-iniettare l'innerHTML e cancella le classi
// `drawn`/`colored` che l'effetto qui sotto applica al nodo. Qui le classi
// stanno sul <figure> e non sui figli iniettati, quindi il danno sarebbe solo
// un ridisegno — ma la trappola è nota e costa più a diagnosticarla che a
// evitarla (CONTESTO § 4.2).
const VIGNETTE_HTML = {
  superficieSvg: { __html: superficieSvg },
  ricorrenzaSvg: { __html: ricorrenzaSvg },
};

// Le due vignette non entrano insieme: prima tutta la sinistra, poi la destra.
// Lo sfasamento del piano (~200 ms) non si leggeva come un ordine, si leggeva
// come un ritardo; a 720 ms diventa un'indicazione di lettura, che è quello che
// serve al lettore davanti a due disegni affiancati. Dentro ogni pannello il
// tratto va per primo, il colore lo raggiunge e la didascalia arriva per ultima:
// si guarda, poi si legge. Nessun loop, nessuna animazione infinita.
const PANEL_STAGGER_MS = 720;
const COLOR_AFTER_MS = 560;
const CAPTION_AFTER_MS = 980;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function IntroBridge() {
  return (
    <div className="hotspot-intro-bridge" aria-hidden="true">
      <svg viewBox="0 0 640 460" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient
            id="hsi-bridge-mask-gradient"
            gradientUnits="userSpaceOnUse"
            x1="-348"
            y1="0"
            x2="-82"
            y2="0"
          >
            <stop offset="0" stopColor="#000" />
            <stop offset="0.34" stopColor="#343434" />
            <stop offset="0.72" stopColor="#909090" />
            <stop offset="1" stopColor="#fff" />
          </linearGradient>
          <mask
            id="hsi-bridge-mask"
            maskUnits="userSpaceOnUse"
            x="-370"
            y="0"
            width="500"
            height="460"
          >
            <rect x="-370" y="0" width="500" height="460" fill="url(#hsi-bridge-mask-gradient)" />
          </mask>
          <linearGradient
            id="hsi-bridge-wash-gradient"
            gradientUnits="userSpaceOnUse"
            x1="-300"
            y1="202"
            x2="104"
            y2="236"
          >
            <stop offset="0" stopColor="#f7c968" />
            <stop offset="0.46" stopColor="#efa45f" />
            <stop offset="1" stopColor="#d6642e" />
          </linearGradient>
        </defs>

        <g mask="url(#hsi-bridge-mask)">
          <path
            className="hotspot-intro-bridge-wash"
            d="M-304 142 C-230 148, -178 162, -126 177 C-48 200, 38 210, 112 214 C40 225, -46 240, -126 274 C-178 296, -230 320, -304 344 Z"
          />
          <g className="hotspot-intro-bridge-lines">
            <path d="M-300 152 C-242 156, -185 149, -140 152 C-68 152, 22 218, 66 222" pathLength="1" />
            <path d="M-300 178 C-242 174, -185 181, -140 178 C-68 178, 22 220, 66 222" pathLength="1" />
            <path d="M-300 206 C-242 210, -185 203, -140 206 C-68 206, 22 221, 66 222" pathLength="1" />
            <path d="M-300 234 C-242 230, -185 237, -140 234 C-68 234, 22 223, 66 222" pathLength="1" />
            <path d="M-300 262 C-242 266, -185 259, -140 262 C-68 262, 22 224, 66 222" pathLength="1" />
            <path d="M-300 290 C-242 286, -185 293, -140 290 C-68 290, 22 225, 66 222" pathLength="1" />
            <path d="M-300 318 C-242 322, -185 315, -140 318 C-68 318, 22 227, 66 222" pathLength="1" />
            <path d="M-300 346 C-242 342, -185 349, -140 346 C-68 346, 22 228, 66 222" pathLength="1" />
            <path d="M-300 374 C-242 378, -185 371, -140 374 C-68 374, 22 230, 66 222" pathLength="1" />
            <path d="M-300 402 C-242 398, -185 405, -140 402 C-68 402, 22 231, 66 222" pathLength="1" />
            <path d="M-300 430 C-242 434, -185 427, -140 430 C-68 430, 22 232, 66 222" pathLength="1" />
          </g>
        </g>
      </svg>
    </div>
  );
}

/**
 * Una vignetta che si disegna a inchiostro, si riempie di colore e solo dopo
 * consegna la sua didascalia. Stessa tecnica della vignetta della fragilità e
 * della scena illustrata del sollievo; l'osservatore sta sul pannello, così su
 * mobile — dove le due
 * vignette sono impilate e la seconda è lontana — ognuna parte quando arriva.
 */
function IntroVignette({ vignette, delay, onGlossary }) {
  const panelRef = useRef(null);
  const figureRef = useRef(null);

  useEffect(() => {
    const panel = panelRef.current;
    const figure = figureRef.current;
    if (!panel || !figure) return undefined;
    if (prefersReducedMotion()) {
      figure.classList.add("drawn", "colored");
      panel.classList.add("is-told");
      return undefined;
    }

    const timers = [];
    const at = (ms, fn) => timers.push(window.setTimeout(fn, delay + ms));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          io.unobserve(entry.target);
          at(0, () => figure.classList.add("drawn"));
          at(COLOR_AFTER_MS, () => figure.classList.add("colored"));
          at(CAPTION_AFTER_MS, () => panel.classList.add("is-told"));
        });
      },
      { threshold: 0.28 },
    );
    io.observe(panel);
    return () => {
      io.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [delay]);

  return (
    <div
      ref={panelRef}
      className={`hotspot-intro-panel hotspot-intro-panel--${vignette.id}`}
    >
      <figure
        ref={figureRef}
        className={`hotspot-intro-vg hotspot-intro-vg--${vignette.id}`}
        aria-label={vignette.figureLabel}
        dangerouslySetInnerHTML={VIGNETTE_HTML[vignette.svg]}
      />
      {vignette.id === "ricorrenza" ? <IntroBridge /> : null}
      <div className="hotspot-intro-caption">
        {vignette.paragraphs.map((parts, i) => (
          <p key={i}>
            <CopySegments parts={parts} onGlossary={onGlossary} />
          </p>
        ))}
      </div>
    </div>
  );
}

export function HotspotIntro({ onGlossary }) {
  const sectionRef = useRef(null);
  const closerRef = useRef(null);
  const [closerSeen, setCloserSeen] = useState(false);

  // Alone caldo guidato dallo scroll: pubblica il progresso 0→1 della sezione
  // come --intro-scroll, così il calore cresce mentre il lettore scende verso
  // la mappa. È l'unica decorazione rimasta delle tre che c'erano: la griglia a
  // 96 px era invisibile e l'alone verde pulsava all'infinito senza motivo
  // (04 § 4.4).
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    let frame = null;
    const update = () => {
      frame = null;
      const vh = window.innerHeight || 1;
      const rect = el.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, (vh - rect.top) / (rect.height + vh)));
      el.style.setProperty("--intro-scroll", progress.toFixed(3));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // Il chevron si monta quando la riga di chiusura arriva a schermo, non al
  // caricamento della pagina: i suoi due impulsi devono partire nel momento in
  // cui servono, altrimenti sono già finiti quando il lettore arriva.
  useEffect(() => {
    const el = closerRef.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          setCloserSeen(true);
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.9 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="hotspot-intro" aria-label="Introduzione hotspot">
      <div className="hotspot-intro-heat" aria-hidden="true" />

      <SectionDivider />

      <div className="hotspot-intro-inner" lang="it">
        <p className="hotspot-intro-lead">{hotspotIntroCopy.lead}</p>

        <div className="hotspot-intro-panels">
          {hotspotIntroCopy.vignettes.map((vignette, index) => (
            <IntroVignette
              key={vignette.id}
              vignette={vignette}
              delay={index * PANEL_STAGGER_MS}
              onGlossary={onGlossary}
            />
          ))}
        </div>

        <div ref={closerRef} className="hotspot-intro-closer">
          <p className="hotspot-intro-closer-text">{hotspotIntroCopy.closer}</p>
          {closerSeen ? <ScrollCue variant="light" loop /> : null}
        </div>
      </div>
    </section>
  );
}

import { useState, useRef, useEffect, useCallback } from "react";
import { MapLibreCanvas } from "../maps/MapLibreCanvas";
import { HotspotLayer } from "../maps/HotspotLayer";
import { AnnotationLayer } from "../maps/AnnotationLayer";
import { BolognaBoundaryLayer } from "../maps/BolognaBoundaryLayer";
import { ScrollCue } from "../ui/ScrollCue";
import { CopySegments } from "./CopySegments";
import { useTimedSequence } from "../../hooks/useTimedSequence";
import {
  CAMERA_MS,
  SCROLL_ACCELERATION_GRACE_MS,
  cameraEasing,
} from "../../lib/motion";
import { applyPaperBasemap } from "../../lib/basemapPaper";
import { getHotspotPersistenceColor } from "../../data/hotspotPalette";
import { hotspotMapCopy } from "../../data/hotspotMapCopy";
import {
  hotspotSteps,
  hotspotStepReadMs,
  BOLOGNA_CENTER,
  BOLOGNA_ZOOM,
  BOLOGNA_ZOOM_PERSISTENCE,
  BOLOGNA_ZOOM_INTRO,
  NARROW_MAX_WIDTH,
  NARROW_ZOOM_SHIFT,
} from "../../data/hotspotSteps";

const sliderMarks = [3, 5, 9, 13];
const sliderThresholds = Array.from({ length: 13 }, (_, index) => index + 1);

/* ── L'ingresso ──────────────────────────────────────────────────────────────
     0      il contorno del comune si disegna SOTTO il velo, così quando la
            marea passa la città è già lì invece di arrivare dopo
     250    la marea comincia a ritirarsi (2 s) e nello stesso istante parte la
            camera, con la stessa durata: la città si scopre mentre le si va
            incontro. Sono un movimento solo, non due
     800    il calore fiorisce (1,1 s) sotto la parte di velo che ancora copre:
            quando la marea gli passa sopra è già acceso
     2250   la marea è fuori scena: la mappa c'è tutta
     2400   entra la LEGENDA, un attimo dopo la mappa e DA SOLA: il lettore sa
            cosa sono le macchie prima che qualcuno gliele commenti
     3000   la legenda ha finito di entrare
     3250   entra il TESTO — tutte e tre le schede, in un blocco solo. Da qui il
            timer non fa più comparire niente: sposta l'evidenza da una scheda
            all'altra, e con lei la soglia sulla mappa

   I numeri sono conti, non costanti scritte a mano, perché fra loro corrono due
   regole che vanno tenute:
     · VEIL_DONE_MS = VEIL_LIFT_MS + CAMERA_MS — l'interfaccia della mappa entra
       solo quando la marea è fuori scena. Prima comparirebbe SOPRA l'ambra: il
       velo sta a z-index 4, legenda e testo a 5. E la legenda sta in basso a
       sinistra, cioè nell'ultimo pezzo che la marea libera.
     · START_DELAY = LEGEND_MS + LEGEND_IN_MS + un respiro — il testo non entra
       mai insieme alla legenda: la legenda deve aver finito, e poi si lascia un
       quarto di secondo. Sennò il lettore ha due cose nuove nello stesso
       istante e legge quella che gli commenta una mappa che non ha ancora
       imparato a leggere.
   Così cambiare --dur-camera in theme.css sposta tutto il resto da solo; prima
   VEIL_DONE_MS era 2250 a mano e si sfasava in silenzio.

   Quanto tiene ogni tappa non è qui: dipende dalla lunghezza della sua scheda e
   sta in hotspotSteps.js, accanto ai testi che lo determinano (05 § 5.4). Nota
   che adesso quel tempo non serve più a dare al lettore il tempo di LEGGERE —
   il testo ce l'ha già tutto davanti — ma a tenere ogni soglia sulla mappa
   abbastanza da vederla. È un requisito più corto, e se la sequenza va
   accorciata è di lì che si accorcia. */
const BORDERS_MS = 0;
const VEIL_LIFT_MS = 250;
const FILLS_MS = 800;
const VEIL_DONE_MS = VEIL_LIFT_MS + CAMERA_MS;
// Quanto ci mette la legenda a entrare: è --ui-in-ms in maps.css, l'andatura
// unica dell'interfaccia di questa mappa. Chi cambia lì cambia anche qui.
const LEGEND_IN_MS = 600;
const LEGEND_MS = VEIL_DONE_MS + 150;
const START_DELAY = LEGEND_MS + LEGEND_IN_MS + 250;
const TAIL_MS = 600;
const SEQUENCE_OUT_MS = LEGEND_IN_MS;

// Con reduced-motion marea, camera e fioriture vanno a zero: la mappa è già
// completa al primo fotogramma. L'attesa di orientamento serviva a coprire la
// marea, e senza marea diventa uno schermo fermo per tre secondi — che si legge
// «si è bloccato», non «guarda la mappa». Resta il tempo di posarci gli occhi.
const START_DELAY_REDUCED = 800;

// Isteresi dell'aggancio, in frazioni di schermo. Vedi più sotto.
const ENGAGE_RELEASE_VH = 0.2;
// Come nella scena dell'ombra, lo scroll resta sempre nativo: la mappa è tenuta
// in quadro dallo sticky e la timeline accelera in base a quanto si è attraversato
// il suo hold. Così un salto a un capitolo successivo non può lasciare un listener
// globale a consumare wheel/touch/key fuori dalla scena.
const SCROLL_PLAYBACK_MAX = 4;

export function HotspotMapScene() {
  const [map, setMap] = useState(null);
  // Finestra stretta: tutta l'inquadratura arretra di NARROW_ZOOM_SHIFT.
  const [narrowFrame, setNarrowFrame] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [exitActive, setExitActive] = useState(false);
  const [showSlider, setShowSlider] = useState(false);
  // La consegna al capitolo dopo: da qui la mappa non è più la protagonista.
  const [handoff, setHandoff] = useState(false);
  const [mapEngaged, setMapEngaged] = useState(false);
  const [sequenceVisible, setSequenceVisible] = useState(false);
  const [descriptionsExited, setDescriptionsExited] = useState(false);
  const [bordersReady, setBordersReady] = useState(false);
  // La marea si sta ritirando / la marea è uscita di scena. La seconda governa
  // l'interfaccia della mappa: prima comparirebbe sopra il velo.
  const [veilLifted, setVeilLifted] = useState(false);
  const [mapRevealed, setMapRevealed] = useState(false);
  const [legendReady, setLegendReady] = useState(false);
  const [fillsReady, setFillsReady] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );
  const [sliderValue, setSliderValue] = useState(9);
  const [playbackRate, setPlaybackRate] = useState(1);
  // Once the reader moves the slider, the narrative flags retire (recallable on hover).
  const [sliderTouched, setSliderTouched] = useState(false);
  const demoStartedRef = useRef(false);
  const demoTimersRef = useRef([]);
  const sequenceExitTimerRef = useRef(null);
  const sceneRef = useRef(null);
  const holdRef = useRef(null);
  const exitRef = useRef(null);
  const sliderRef = useRef(null);
  const mapBoxRef = useRef(null);
  const engagedRef = useRef(false);
  const lastZoomRef = useRef(null);
  const scrollAccelerationUnlockAtRef = useRef(Infinity);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (event) => setReduceMotion(event.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  const onMapReady = useCallback((m) => {
    // La base passa sulla carta della storia prima ancora di essere vista: è
    // scenografia, e non deve stonare con la pagina da cui si arriva.
    applyPaperBasemap(m);
    setMap(m);
  }, []);

  // Tutta la regia parte da qui: la scena è agganciata E lo stile della mappa è
  // caricato. `map` arriva sull'evento `load` di MapLibre (MapLibreCanvas), non
  // al montaggio. Senza questa seconda condizione, su una connessione lenta — o
  // ricaricando la pagina dentro la scena — la marea si ritirava su carta vuota
  // e poi contorno e calore comparivano insieme quando lo stile arrivava: la
  // regia in tre tempi diventava un pop, e le schede commentavano il niente.
  const sceneReady = mapEngaged && Boolean(map);

  const {
    revealed,
    complete: sequenceComplete,
    activeIndex,
    selected,
    forceComplete,
    goTo,
  } = useTimedSequence({
    count: hotspotSteps.length,
    engaged: sceneReady,
    startDelay: reduceMotion ? START_DELAY_REDUCED : START_DELAY,
    readMs: hotspotStepReadMs,
    tailMs: TAIL_MS,
    pickDuringPlay: true,
    playbackRate,
  });

  const descriptionDivsVisible =
    sequenceVisible && mapRevealed && revealed > 0;

  // La protezione parte quando la sequenza può davvero partire, non dal primo
  // contatto geometrico con la scena: su una rete lenta `mapEngaged` può
  // precedere di parecchio il caricamento dello stile MapLibre.
  useEffect(() => {
    scrollAccelerationUnlockAtRef.current = sceneReady
      ? performance.now() + SCROLL_ACCELERATION_GRACE_MS
      : Infinity;
  }, [sceneReady]);

  useEffect(() => {
    return () => {
      if (sequenceExitTimerRef.current) {
        window.clearTimeout(sequenceExitTimerRef.current);
      }
    };
  }, []);

  // Scroll-driven state: engagement, the sequence "hold", and the downstream
  // slider / exit / green handoff. The descriptions themselves are NOT scrolled —
  // scrolling only carries the reader past the held sequence into the exit.
  useEffect(() => {
    let frame = null;

    const update = () => {
      frame = null;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 768;
      const readingLine = viewportHeight * 0.52;

      const sceneRect = sceneRef.current?.getBoundingClientRect();
      const holdRect = holdRef.current?.getBoundingClientRect();
      const exitRect = exitRef.current?.getBoundingClientRect();
      const sliderRect = sliderRef.current?.getBoundingClientRect();
      const inScene =
        Boolean(sceneRect) && sceneRect.top < viewportHeight && sceneRect.bottom > 0;

      const mobileLayout = window.matchMedia("(max-width: 768px)").matches;
      // La scena si accende quando la mappa OCCUPA lo schermo, non a metà
      // strada. A 0,5 vh la marea cominciava a ritirarsi mentre in alto si
      // vedeva ancora la sezione di descrizione: scoprendo la carta chiara
      // della mappa sotto la carta calda della sezione, il confine fra le due
      // diventava una riga. Chi scorre veloce non fa in tempo a vederla, chi va
      // piano sì.
      //
      // Ma la soglia non è secca nei due sensi: si aggancia a top ≤ 0 e si
      // sgancia solo dopo che il lettore è risalito di 0,2 vh. Prima bastava un
      // rimbalzo di pochi pixel sul bordo — l'inerzia del trackpad basta — per
      // smontare schede e legenda e far ricominciare la marea da capo: due
      // secondi e un quarto di schermo vuoto per un movimento che il lettore non
      // aveva nemmeno fatto apposta.
      const releaseGate = engagedRef.current ? viewportHeight * ENGAGE_RELEASE_VH : 0;
      const nextMapEngaged =
        inScene &&
        (mobileLayout || (Boolean(sceneRect) && sceneRect.top <= releaseGate));

      // Stesso modello della mappa dell'ombra: lo scroll muove davvero la pagina,
      // mentre l'avanzamento dentro l'hold accelera la timeline fino a 4×.
      const travelled = holdRect
        ? (viewportHeight - holdRect.top) / Math.max(1, holdRect.height)
        : 0;
      const holdProgress = Math.min(1, Math.max(0, travelled));
      const scrollRate =
        Math.round((1 + holdProgress * (SCROLL_PLAYBACK_MAX - 1)) * 4) / 4;
      const scrollAccelerationReady =
        performance.now() >= scrollAccelerationUnlockAtRef.current;
      setPlaybackRate(
        nextMapEngaged && !sequenceComplete && scrollAccelerationReady
          ? scrollRate
          : 1,
      );

      const pastHold = Boolean(holdRect) && holdRect.bottom <= readingLine;

      // Un salto o uno scroll molto rapido può superare l'intero hold in un
      // fotogramma. Anche questo snap è un'accelerazione, quindi resta disattivo
      // durante la protezione iniziale. Lo scroll della pagina non viene mai
      // trattenuto: oltre l'hold le descrizioni si nascondono comunque.
      if (
        nextMapEngaged &&
        scrollAccelerationReady &&
        pastHold &&
        !sequenceComplete
      ) {
        forceComplete();
      }

      // Le descrizioni appartengono solo all'hold. La mappa può restare engaged
      // più a lungo per completare la consegna visiva alla pagina delle cause.
      const nextSequenceVisible = nextMapEngaged && !pastHold;
      setSequenceVisible(nextSequenceVisible);

      // The exit question belongs to the following beat. Wait until the
      // description stack has completed its fade before making that beat
      // eligible, even when a fast scroll has already crossed its trigger.
      if (nextSequenceVisible || !nextMapEngaged) {
        if (sequenceExitTimerRef.current) {
          window.clearTimeout(sequenceExitTimerRef.current);
          sequenceExitTimerRef.current = null;
        }
        setDescriptionsExited(false);
      } else if (
        sequenceComplete &&
        !descriptionsExited &&
        !sequenceExitTimerRef.current
      ) {
        sequenceExitTimerRef.current = window.setTimeout(() => {
          sequenceExitTimerRef.current = null;
          setDescriptionsExited(true);
        }, SEQUENCE_OUT_MS);
      }

      // Ogni battuta ha il suo spaziatore: la domanda con le bandierine, poi lo
      // slider, poi il velo. Così le altezze in CSS dicono da sole quanto dura
      // ogni battuta, invece di essere dedotte da distanze dal fondo della scena.
      const nextShowAnnotations =
        inScene &&
        sequenceComplete &&
        descriptionsExited &&
        Boolean(exitRect) &&
        exitRect.top <= viewportHeight * 0.68;
      const nextShowSlider =
        inScene &&
        sequenceComplete &&
        descriptionsExited &&
        Boolean(sliderRect) &&
        sliderRect.top <= viewportHeight * 0.58;
      // Il capitolo dopo comincia a salire sopra la mappa quando manca esatto
      // uno schermo alla fine dell'aggancio (la sovrapposizione è di 100vh, in
      // story.css su .causes-section). Da lì l'interfaccia della mappa si
      // ritira: sotto una pagina che sale, uno slider vivo è un fantasma.
      const nextHandoff =
        inScene && Boolean(sceneRect) && sceneRect.bottom <= viewportHeight * 2;

      // La carta che si chiude dall'alto sulla mappa, mentre da sotto sale la
      // pagina del capitolo nuovo: le due si incontrano a metà schermo. È
      // l'apertura al contrario, e come l'apertura è un fronte sfumato che
      // scorre — ma qui è legata allo scroll, non a un timer: deve arrivare
      // insieme alla pagina che sale, che allo scroll è legata per forza.
      // Il valore è un numero puro 0→1: lo legge il transform in maps.css.
      if (mapBoxRef.current) {
        const close = sceneRect
          ? Math.min(
              1,
              Math.max(0, (viewportHeight * 2 - sceneRect.bottom) / viewportHeight),
            )
          : 0;
        mapBoxRef.current.style.setProperty("--handoff", close.toFixed(3));
      }

      setShowAnnotations((nextShowAnnotations || nextShowSlider) && !nextHandoff);
      setShowSlider(nextShowSlider && !nextHandoff);
      // La domanda sta con le bandierine e si ritira quando arriva lo slider.
      setExitActive(nextShowAnnotations && !nextShowSlider);
      setHandoff(nextHandoff);
      setNarrowFrame(window.innerWidth < NARROW_MAX_WIDTH);
      engagedRef.current = nextMapEngaged;
      setMapEngaged(nextMapEngaged);
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
  }, [mapRevealed, sequenceComplete, descriptionsExited, forceComplete]);

  const zoomShift = narrowFrame ? NARROW_ZOOM_SHIFT : 0;

  // Primo fotogramma: si tiene l'inquadratura larga finché la scena non si
  // aggancia. Sta sotto il velo, quindi si mette a posto senza animazione.
  useEffect(() => {
    if (!map || engagedRef.current) return;
    map.jumpTo({ center: BOLOGNA_CENTER, zoom: BOLOGNA_ZOOM_INTRO + zoomShift });
  }, [map, zoomShift]);

  // Camera: si muove solo in avanti. Le prime due schede stanno sull'inquadratura
  // di lavoro, la persistenza stringe.
  //
  // Parte quando si alza il velo, non quando arriva la prima scheda: la città
  // deve raffreddarsi MENTRE la camera si avvicina. Una tinta che si scarica su
  // un'immagine ferma resta una dissolvenza; su un'immagine che si muove
  // diventa un'inquadratura.
  useEffect(() => {
    if (!map || !mapEngaged || !veilLifted) return;
    const step = hotspotSteps[activeIndex];
    const zoom =
      (step.id === "persistence" ? BOLOGNA_ZOOM_PERSISTENCE : BOLOGNA_ZOOM) +
      zoomShift;
    // Senza questo, l'arrivo della prima scheda ribatte la stessa easeTo sul
    // push-in ancora in corso e lo fa ripartire da dov'è: il movimento si
    // allunga e rallenta senza motivo.
    if (lastZoomRef.current === zoom) return;
    lastZoomRef.current = zoom;
    map.easeTo({
      center: BOLOGNA_CENTER,
      zoom,
      duration: reduceMotion ? 0 : CAMERA_MS / playbackRate,
      easing: cameraEasing,
    });
  }, [
    map,
    activeIndex,
    mapEngaged,
    veilLifted,
    zoomShift,
    reduceMotion,
    playbackRate,
  ]);

  // Ingresso in quattro tempi: contorno sotto il velo → il velo si alza sulla
  // città già disegnata → il calore fiorisce → la legenda si posa sulla mappa
  // scoperta. Parte da `sceneReady`, non dal solo aggancio: finché lo stile non
  // c'è il velo resta giù, che è esattamente quello che deve fare — a riposo
  // copre tutto, quindi chi arriva su una connessione lenta vede la carta della
  // sezione precedente invece di un rettangolo vuoto, e la marea si ritira
  // quando sotto c'è davvero qualcosa da scoprire.
  useEffect(() => {
    if (!mapEngaged) {
      // Torna giù solo il VELO: è il sipario fra la descrizione e la mappa, e
      // chi risale deve ritrovarlo. Il disegno no, resta: prima si smontava
      // anche quello, e rientrando nella scena si vedevano le descrizioni —
      // che ora riprendono da dove erano, ma comunque — appoggiate su un velo
      // con sotto una mappa che stava ridisegnando da capo.
      const drop = setTimeout(() => {
        setVeilLifted(false);
        setMapRevealed(false);
        setLegendReady(false);
      }, 0);
      return () => clearTimeout(drop);
    }
    if (!sceneReady) return undefined;
    const timers = [
      setTimeout(() => setBordersReady(true), BORDERS_MS),
      setTimeout(() => setVeilLifted(true), reduceMotion ? 0 : VEIL_LIFT_MS),
      setTimeout(() => setFillsReady(true), reduceMotion ? 0 : FILLS_MS),
      setTimeout(() => setMapRevealed(true), reduceMotion ? 0 : VEIL_DONE_MS),
      setTimeout(() => setLegendReady(true), reduceMotion ? 0 : LEGEND_MS),
    ];
    return () => timers.forEach(clearTimeout);
  }, [mapEngaged, sceneReady, reduceMotion]);

  // Qui c'era l'effetto che teneva il piede sotto l'ULTIMA scheda arrivata,
  // misurandone offsetTop + offsetHeight a ogni tappa e a ogni resize. Serviva
  // finché le schede non ancora arrivate erano posti vuoti riservati: il piede
  // in flusso sarebbe rimasto in fondo alla colonna, staccato dalla scheda che
  // stava commentando. Adesso le tre schede sono tutte scritte dall'inizio,
  // sotto l'ultima non c'è nessun vuoto, e il piede sta dove il flusso lo mette
  // — senza misure, senza listener e senza il buco che avevano (le schede
  // cambiano altezza anche quando arrivano i font, non solo al resize).

  // Lo slider si muove da solo appena compare: scende da 9 a 6 e torna. Non è
  // un'animazione decorativa — muove il valore vero, quindi la mappa si apre e
  // si richiude insieme a lui, e la legenda scrive un'altra soglia. È il modo
  // più corto per dire «questo si trascina, e cambia quello che vedi»: un
  // comando che non si è mai visto muovere sembra una decorazione.
  // Si ferma appena il lettore lo tocca, e non riparte mai.
  const stopSliderDemo = useCallback(() => {
    demoTimersRef.current.forEach(clearTimeout);
    demoTimersRef.current = [];
  }, []);

  useEffect(() => {
    if (!showSlider || demoStartedRef.current) return;
    demoStartedRef.current = true;
    // Scende svelto come un trascinamento, si ferma a guardare, torna al posto.
    const beats = [
      [700, 8], [840, 7], [980, 6],
      [1580, 7], [1720, 8], [1860, 9],
    ];
    demoTimersRef.current = beats.map(([at, value]) =>
      setTimeout(() => setSliderValue(value), at),
    );
  }, [showSlider]);

  useEffect(() => () => demoTimersRef.current.forEach(clearTimeout), []);

  const onSliderPick = useCallback(
    (value) => {
      stopSliderDemo();
      setSliderValue(value);
      setSliderTouched(true);
    },
    [stopSliderDemo],
  );

  // Clean up any legacy slider layers from earlier implementations
  useEffect(() => {
    if (!map) return;
    const legacyIds = ["hotspot-slider-src", "hotspot-slider-fill"];
    legacyIds.forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
    });
    const sliderLayerId = (threshold) => `hotspot-slider-fill-${threshold}`;
    const sliderSourceId = (threshold) => `hotspot-slider-src-${threshold}`;
    sliderThresholds.forEach((threshold) => {
      const layerId = sliderLayerId(threshold);
      const sourceId = sliderSourceId(threshold);
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    });
  }, [map]);

  // Narrative layer stays visible always while in scene — slider just overrides minYears
  const narrativeVisible = mapEngaged;

  const narrativeMinYears = showSlider
    ? sliderValue
    : hotspotSteps[activeIndex]?.minYears ?? 3;
  const narrativeOpacity = showSlider
    ? 0.9
    : hotspotSteps[activeIndex]?.opacity ?? 0.82;
  const narrativeThresholdText = hotspotMapCopy.legend.active(narrativeMinYears);
  // Il colore che la mappa ha alla soglia in scena. Scheda, legenda e mappa
  // dicono la stessa cosa nello stesso momento, e la scala resta quella che è.
  const activeTier = getHotspotPersistenceColor(narrativeMinYears);

  return (
    <section ref={sceneRef} className="hotspot-scene" aria-label="Mappa hotspot">
      <div
        ref={mapBoxRef}
        className={`hotspot-scene-map${mapEngaged ? " hotspot-scene-map--engaged" : ""}`}
      >
        <MapLibreCanvas
          onMapReady={onMapReady}
          className="hotspot-canvas"
          zoom={BOLOGNA_ZOOM_INTRO}
          hideLabels
        />

        <HotspotLayer
          map={map}
          id="narrative"
          minYears={narrativeMinYears}
          opacity={narrativeOpacity}
          visible={narrativeVisible && fillsReady}
          transitionMs={1100 / playbackRate}
        />

        <BolognaBoundaryLayer map={map} visible={bordersReady} />

        <div className={`hotspot-map-veil${veilLifted ? " hotspot-map-veil--hidden" : ""}`} aria-hidden="true" />

        {/* L'uscita è in due metà. Da sotto sale la pagina del capitolo dopo,
            che è la sezione vera e sta in story.css (.causes-section, con la
            sua sovrapposizione negativa). Da sopra cala questa, che è
            l'apertura al contrario: le due si incontrano a metà schermo e la
            mappa si chiude in mezzo. */}
        <div className="hotspot-map-veil-close" aria-hidden="true" />

        <AnnotationLayer
          map={map}
          active={mapEngaged && showAnnotations}
          showNarrative={mapEngaged && showAnnotations && !sliderTouched}
        />

        {/* ── Le tre schede, tutte scritte dall'inizio ─────────────────────────
            Prima entravano una alla volta, e chi leggeva svelto guardava il
            vuoto per due secondi mentre chi leggeva piano veniva raggiunto
            dalla scheda dopo. Il testo non era nascosto per una ragione sua:
            era nascosto dal timer. Ora arriva tutto insieme, in un blocco solo,
            e il timer fa l'unica cosa che gli compete davvero — dire QUALE
            delle tre la mappa sta mostrando in questo momento.
            Il ritmo resta (le soglie si accendono a tempo, la mappa si muove
            con loro), ma smette di essere un cancello: chi corre corre, chi va
            piano va piano, e chiunque può toccare una scheda quando vuole. Il
            posto delle tre schede era già riservato dall'inizio, quindi
            l'ingombro sullo schermo è lo stesso di prima. */}
        {mapEngaged && (
          <div
            className={`hotspot-sequence${descriptionDivsVisible ? " hotspot-sequence--in" : " hotspot-sequence--out"}${sequenceComplete ? " hotspot-sequence--complete" : ""}`}
            /* Lo spostarsi dell'evidenza SONO il contenuto: resta anche con
               reduced-motion (vedi il blocco in theme.css). */
            data-motion="story"
          >
            <div className="hotspot-sequence-stack">
              {hotspotSteps.map((step, i) => {
                const isActive = i === activeIndex;
                return (
                  <button
                    key={step.id}
                    type="button"
                    className={`hotspot-seq-item${isActive ? " is-active" : " is-dim"}`}
                    /* Il quadratino a sinistra prende il colore che la mappa ha
                       a quella soglia, letto da hotspotPalette: non è un colore
                       nuovo, è quello. */
                    style={{ "--tier": getHotspotPersistenceColor(step.minYears) }}
                    onClick={() => goTo(i)}
                    aria-pressed={isActive}
                  >
                    {step.paragraphs.map((parts, j) => (
                      <span key={j} className="hotspot-seq-text">
                        {/* La .kw verde scuro di 01 § 1.3 sparirebbe su una
                            scheda scura: qui usa la sua variante chiara. */}
                        <CopySegments parts={parts} kwClass="hotspot-seq-kw" />
                      </span>
                    ))}
                  </button>
                );
              })}
            </div>

            <div
              className={`hotspot-sequence-foot${revealed > 0 ? " hotspot-sequence-foot--live" : ""}${sequenceComplete ? " hotspot-sequence-foot--done" : ""}`}
              aria-hidden={sequenceComplete ? undefined : "true"}
            >
              <div className="hotspot-seq-dots">
                {hotspotSteps.map((step, i) => {
                  const isDone = i < revealed;
                  // Il pallino pieno è quello della scheda IN SCENA, non della
                  // testa dell'autoplay: erano la stessa cosa solo finché non
                  // si poteva scegliere. Adesso si può — e si può anche durante
                  // la riproduzione — quindi chi tocca la prima scheda deve
                  // vedere illuminarsi il primo pallino, non il terzo.
                  const isCurrent = i === activeIndex;
                  // L'anello che si chiude misura il tempo di UNA tappa
                  // dell'autoplay: appena il lettore sceglie da sé, quel tempo
                  // non conta più niente e l'anello sparisce.
                  const isCounting =
                    selected == null && !sequenceComplete && i === revealed - 1;
                  return (
                    <span
                      key={step.id}
                      className={`hotspot-seq-dot-step${isDone ? " is-done" : ""}${isCurrent ? " is-current" : ""}`}
                      style={{ "--tier": getHotspotPersistenceColor(step.minYears) }}
                    >
                      {/* Il pallino in scena si riempie sul tempo della sua
                          scheda: il lettore sente il tempo che passa senza
                          l'ansia di un conto alla rovescia. L'ultimo si chiude
                          sulla coda, cioè proprio quando la sequenza finisce. */}
                      {isCounting && (
                        <svg
                          className="hotspot-seq-dot-ring"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                          focusable="false"
                          style={{
                            "--step-ms": `${
                              (i === hotspotSteps.length - 1
                                ? TAIL_MS
                                : hotspotStepReadMs[i]) / playbackRate
                            }ms`,
                          }}
                        >
                          <circle cx="12" cy="12" r="10" />
                        </svg>
                      )}
                    </span>
                  );
                })}
              </div>
              <span className="hotspot-sequence-caption">
                {sequenceComplete
                  ? hotspotMapCopy.sequence.done
                  : hotspotMapCopy.sequence.playing}
              </span>
              {sequenceComplete && (
                <ScrollCue variant="light" className="hotspot-sequence-cue" />
              )}
            </div>
          </div>
        )}

        {/* Niente interfaccia finché la marea non è passata: la legenda sta in
            basso a sinistra, l'ultimo pezzo che si libera, e ha z-index 5
            contro il 4 del velo — comparire prima vorrebbe dire una scheda
            bianca appoggiata sull'ambra. Entra a LEGEND_MS, un attimo dopo che
            la mappa si è scoperta e da sola: è la prima cosa che il lettore
            legge qui sopra, e ha il tempo di entrare tutta prima che arrivi la
            prima scheda. */}
        {mapEngaged && legendReady && !handoff && (
          <div
            className="hotspot-legend"
            style={{
              "--legend-t": String((narrativeMinYears - 1) / 12),
              "--tier": activeTier,
            }}
          >
            <span className="hotspot-legend-title">
              {hotspotMapCopy.legend.title}
            </span>
            <strong className="hotspot-legend-active">
              {narrativeThresholdText}
            </strong>
            <span className="hotspot-legend-bar">
              <span className="hotspot-legend-bar-dim" />
              <span className="hotspot-legend-bar-marker" />
            </span>
            <div className="hotspot-legend-scale">
              <span>{hotspotMapCopy.legend.scaleMin}</span>
              <span>{hotspotMapCopy.legend.scaleMax}</span>
            </div>
            <span className="hotspot-legend-caption">
              {hotspotMapCopy.legend.caption}
            </span>
            <a
              className="hotspot-legend-link"
              href={hotspotMapCopy.legend.sourceLink.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {hotspotMapCopy.legend.sourceLink.label} →
            </a>
          </div>
        )}

        {/* Il comando, in basso al centro. `--slider-t` è una frazione 0→1, non
            una percentuale: la posizione vera del cursore non è t% della
            traccia, perché il cursore è largo e resta dentro le estremità. Il
            CSS ne ricava --slider-x una volta sola e lo usa sia per la parte
            percorsa sia per i numeri sotto, che prima erano posizionati in
            percentuale su una riga più larga della traccia e finivano ognuno
            lontano dal punto che indicava. */}
        {showSlider && (
          <div
            className="hotspot-slider"
            style={{ "--slider-t": String((sliderValue - 1) / 12) }}
          >
            <div className="hotspot-slider-head">
              <label className="hotspot-slider-label" htmlFor="ricorrenza-slider">
                {hotspotMapCopy.slider.label}
              </label>
              <strong className="hotspot-slider-badge">
                {hotspotMapCopy.slider.value(sliderValue)}
              </strong>
            </div>
            <div className="hotspot-slider-row">
              <input
                id="ricorrenza-slider"
                type="range"
                min={1}
                max={13}
                step={1}
                value={sliderValue}
                onChange={(e) => onSliderPick(Number(e.target.value))}
                className="hotspot-slider-input"
              />
            </div>
            <div className="hotspot-slider-marks">
              {sliderMarks.map((mark) => (
                <button
                  key={mark}
                  type="button"
                  className={`hotspot-slider-mark${sliderValue === mark ? " hotspot-slider-mark--active" : ""}`}
                  style={{ "--mark-t": String((mark - 1) / 12) }}
                  onClick={() => onSliderPick(mark)}
                  aria-label={hotspotMapCopy.slider.markLabel(mark)}
                >
                  {mark}
                </button>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Il ritmo della coda, una battuta per blocco: un runway iniziale assorbe
          lo scroll residuo mentre la mappa entra; poi arrivano l'hold della
          sequenza, la domanda con le bandierine, lo slider e, in fondo, lo
          spazio su cui il capitolo dopo sale sopra la mappa. Le altezze stanno
          in maps.css. */}
      <div className="hotspot-scene-panels">
        <div className="hotspot-entry-runway" aria-hidden="true" />
        <div ref={holdRef} className="hotspot-sequence-hold" aria-hidden="true" />

        <div
          ref={exitRef}
          className={`hotspot-panel--exit${exitActive ? " hotspot-panel--active" : ""}`}
        >
          <div className="hotspot-exit-wrapper">
            <h3 className="hotspot-exit-phrase">Perché proprio lì?</h3>
          </div>
        </div>

        <div ref={sliderRef} className="hotspot-slider-hold" aria-hidden="true" />
        <div className="hotspot-tail-hold" aria-hidden="true" />
      </div>
    </section>
  );
}

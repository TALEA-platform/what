import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  AnimatePresence,
  motion,
  useAnimationControls,
  useReducedMotion,
} from "framer-motion";
import { PLAN_ANCHORS, PLAN_H, PLAN_W, cityPlanSvg } from "../../data/cityPlan";
import {
  planAnnotations,
  planBeats,
  planFigureLabel,
  planContext,
  planLegend,
  planLegendLabel,
  planSceneLabel,
  planView,
} from "../../data/cityPlanScene";
import { planVignetteMeta, planVignettes } from "../../data/planVignettes";
import { CopySegments } from "./CopySegments";

// DEVONO restare costanti di modulo — non riscriverle inline come
// `dangerouslySetInnerHTML={{ __html: … }}`. React confronta le prop per identità,
// quindi un oggetto nuovo a ogni render gli fa re-iniettare l'innerHTML A OGNI
// RE-RENDER, cancellando le classi `.is-on` che gli effetti qui sotto applicano ai
// figli dell'SVG: il disegno riparte da capo e sembra che glitchi.
//
// È già costato lo stesso bug tre volte in questo progetto (RifugioExplainer, la
// scena illustrata che stava qui, e i primi piani: quelli si ridisegnavano a ogni
// cambio di stato, cioè a ogni tempo del loro stesso disegno). Chi aggiunge una
// quarta figura la metta qui.
const PLAN_HTML = { __html: cityPlanSvg };
const VIGNETTE_HTML = Object.fromEntries(
  Object.entries(planVignettes).map(([k, v]) => [k, { __html: v }]),
);

// Dove passa la linea di lettura, in frazione di viewport: è l'altezza a cui un
// hold "conta come passato" e la battuta avanza. Bassa apposta — il cambio arriva
// mentre il lettore sta ancora guardando, non dopo.
const READING_LINE = 0.56;

// Quanto dura un tempo del primo piano, e sono due vincoli opposti.
//
// Troppo veloce e non si legge: a 330 ms arrivavano tredici pezzi in quattro
// secondi, cioè un guazzabuglio invece di una costruzione. Ora il modello non ha
// più una scadenza automatica: finito il disegno resta completo fino allo scroll.
//
// 500 ms è il punto di equilibrio, e regge SOLO perché i tempi del generatore sono
// stati pareggiati a una cosa per volta: l'ultimo ne portava quattro insieme.
// Il tratto di ogni pezzo si chiude in ~0,5 s (CSS), quindi un pezzo comincia
// mentre il precedente sta finendo — è quello a far sembrare una mano che disegna
// invece di una sequenza di diapositive.
//
// Chi lo cambia guardi anche `new_square(CELLS[C1], …)` in `build_city_plan.py`: il
// rifugio sulla pianta è sincronizzato con questo per non smentire il primo piano.
const VIGNETTE_STEP_MS = 420;
// Il modello non deve essere gia' li' al primo frame: entra come un foglio che
// prende posto sopra la pianta, poi comincia a costruirsi. Il primo avanzamento
// interno parte quando questa entrata e' quasi conclusa, cosi' le due letture non
// si contendono lo stesso istante.
const VIGNETTE_ENTER_MS = 720;
const VIGNETTE_FIRST_STEP_MS = 620;
// Ultimo pezzo del modello -> breve tempo per leggerlo -> trasformazione in pianta.
const MAP_HANDOFF_MS = 320;
// Deve restare identico alla durata di uscita del riquadro Framer Motion.
const VIGNETTE_EXIT_MS = 720;

// Il raggio del cerchio di richiamo sulla pianta, in pixel di schermo.
const LINK_R = 30;

// Posizioni stabili, ricavate dalle ancore: nessuna correzione dopo il primo
// paint, quindi nessun salto dal quadrante ereditato dal modello precedente.
const VIGNETTE_PLACE = {
  costruire: "top",
  corridoio: "top",
  portico: "bottom",
};
const COPY_SIDES = ["left", "right"];
// Il cambio non e' un evento secco sulla linea di lettura: la frase vecchia si
// ammorbidisce, il campo respira per un istante e la nuova viene scoperta. Il
// tratto resta abbastanza breve da non sembrare uno schermo vuoto. Nessun
// crossfade: due testi insieme rendono la lettura ambigua.
const COPY_BLEND_VH = 0.26;

/**
 * LA PIANTA — l'ultimo movimento del capitolo sollievo.
 *
 * Un pezzo di Bologna visto dall'alto che resta agganciato mentre si scorre:
 * sopra ci si costruisce la rete del fresco, un pezzo per battuta. Sostituisce il
 * nastro assonometrico che stava qui prima, e il motivo è tutto nella geometria:
 * «dove non c'è si può costruire» è un buco nella copertura, un corridoio
 * climatico è una linea fra due punti, i portici sono una rete che esiste già.
 * Sono tutte e tre DISTANZE, e le distanze si vedono solo dall'alto.
 *
 * ── I limiti della pagina ───────────────────────────────────────────────────
 * Tutto — disegno, testo, primi piani — sta dentro la STESSA fascia del resto del
 * capitolo (`--content-max` meno il respiro laterale: la misura dell'apertura
 * sull'aria). Il testo stava attaccato al bordo dello schermo mentre il disegno
 * finiva quattrocento pixel più in dentro, e su un monitor largo i due sembravano
 * due cose diverse messe sulla stessa riga.
 *
 * Il disegno però non si TAGLIA su quella fascia: sfuma. `.plan-bleed` supera la
 * fascia narrativa e una maschera lineare porta l'inchiostro a zero dentro
 * quell'abbondanza, così il margine resta morbido anche su monitor larghi.
 *
 * ── L'inquadratura sta FERMA ────────────────────────────────────────────────
 * Una sola `transform` su `.plan-camera`, calcolata al montaggio e al resize e mai
 * per battuta. La scala viene solo dalla larghezza (`planView.units`): la stessa
 * porzione di quartiere si vede su ogni monitor.
 *
 * C'era una telecamera che a ogni battuta volava, si stringeva, si inclinava e
 * girava. È stata scartata, e le tre ragioni valgono più della funzionalità:
 * non si capiva cosa si muovesse (si muoveva tutto insieme); l'inquadratura
 * cambiava da monitor a monitor perché la scala veniva dal rapporto della
 * finestra; e muovere una `transform` su duemila elementi costa ~11 ms a colpo,
 * misurati, senza rimedio possibile se non non muoverli.
 *
 * ── I primi piani, e il RICHIAMO ────────────────────────────────────────────
 * Il volume lo fanno le VIGNETTE (`planVignettes`): tre disegni assonometrici a
 * parte, uno per concetto. Sono ~90 path ciascuna, cioè abbastanza poche da
 * potersi DISEGNARE — il tratto che corre e poi il colore che entra.
 *
 * Ciascuna è legata al suo punto sulla pianta da un RICHIAMO: un cerchio sul
 * punto e una linea che lo unisce al disegno, come la chiamata di un dettaglio in
 * una tavola d'architettura. Il richiamo compare SUBITO, insieme al primo piano.
 * È lui a far capire di dove si sta parlando, e per questo non può dipendere da
 * un'animazione che arriva dopo qualche secondo: chi scorre veloce la perderebbe.
 * Quando il lettore cambia battuta, i primi due dettagli rientrano nella propria
 * ancora. L'ultimo, che si trova già vicino al bordo, si spegne sul posto per non
 * attraversare la composizione. Finché non scorre, ogni modello completo resta
 * visibile: l'uscita non interrompe il tempo necessario a osservarlo.
 *
 * La pianta NON si spegne mentre c'è un primo piano. Ci aveva provato (`--closeup`
 * la portava a 0,34) ed era un errore vero: sotto quel velo continuava ad
 * avvenire il contenuto della battuta — il rifugio che si apre, il corridoio che
 * cresce — e non si vedeva. La gerarchia la fa il disegno, non l'opacità: la
 * pianta è una filigrana, il primo piano è a colori pieni.
 *
 * ── Prestazioni: cosa NON si fa qui ─────────────────────────────────────────
 * Niente si muove mentre si scorre. C'era uno scostamento continuo agganciato
 * allo scroll (`--drift`): era una `transform` nuova su un SVG di quattrocento
 * kilobyte a ogni fotogramma. Lo scroll, per la stessa ragione, non legge il
 * layout: gli hold si misurano una volta (`offsetTop`) e poi si confrontano con
 * `scrollY`.
 */
export function CityPlanScene() {
  const reduceMotion = useReducedMotion();
  const vignetteControls = useAnimationControls();
  const rootRef = useRef(null);
  const viewRef = useRef(null);
  const camRef = useRef(null);
  const figRef = useRef(null);
  const bandRef = useRef(null);
  const vignetteNodeRef = useRef(null);
  const holdsRef = useRef([]);
  // Le soglie di scroll, in coordinate di documento: si ricalcolano solo al
  // resize, non a ogni fotogramma.
  const marksRef = useRef([]);
  const copyItemsRef = useRef([]);
  // Gli elementi del disegno, letti UNA volta: sono qualche centinaio, e
  // rileggerli a ogni battuta significherebbe un querySelectorAll per battuta.
  const itemsRef = useRef(null);
  const previousBeatRef = useRef(0);
  const completedVignetteBeatsRef = useRef(new Set());
  const enteredVignetteMountRef = useRef(-1);

  const [entered, setEntered] = useState(false);
  const [beat, setBeat] = useState(0);
  // Testo/modello e pianta non avanzano piu' nello stesso istante. Nei tre beat
  // illustrati la pianta resta un passo indietro finche' il modello non ha finito.
  const [mapBeat, setMapBeat] = useState(0);
  // Il tempo INTERNO al primo piano: avanza a orologio, non a scroll. A scroll il
  // lettore che si ferma non vedrebbe mai il cantiere lavorare, e chi scorre
  // veloce vedrebbe il disegno finire a scatti sotto il dito.
  const [vignetteProgress, setVignetteProgress] = useState({
    beat: -1,
    mount: -1,
    step: 0,
  });
  // AnimatePresence con `mode="wait"` monta il nuovo modello soltanto dopo che
  // il precedente e' uscito. Questo contatore fa ripartire misura e animazione
  // nel momento del montaggio reale, non al cambio anticipato della battuta.
  const [vignetteMount, setVignetteMount] = useState(0);
  // L'effetto del timer deve dipendere dal nodo come STATO, non leggere soltanto
  // la ref. Nel commit in cui il nodo compare la ref e' gia' valorizzata, mentre
  // il contatore qui sopra non e' ancora aggiornato: leggendo la sola ref il
  // timer partiva una volta, veniva subito ripulito dal secondo render e il suo
  // cleanup completava tutto il modello per un fotogramma.
  const [vignetteNode, setVignetteNode] = useState(null);
  // La geometria del richiamo, in pixel dentro `.plan-band`. Si misura quando il
  // primo piano entra in scena e al resize. L'uscita parte soltanto quando il
  // componente viene smontato e non richiede quindi una nuova misura.
  const [link, setLink] = useState(null);
  // Coordinate delle poche annotazioni editoriali, convertite una volta dalle
  // unita' della pianta ai pixel della fascia narrativa. Il testo non viene
  // scalato insieme all'SVG e resta quindi leggibile anche su schermi stretti.
  const [annotationLayout, setAnnotationLayout] = useState({});
  // La metà verticale è esplicita per modello e quella orizzontale è opposta al
  // testo. Entrambe sono note prima del primo paint, quindi non cambiano durante
  // l'entrata della vignetta.
  const side = planBeats[beat]?.side === "right" ? "right" : "left";
  const vignetteName = planBeats[beat]?.vignette ?? null;
  const place = VIGNETTE_PLACE[vignetteName] ?? "top";
  const vignetteSide = side === "left" ? "right" : "left";
  const vstep =
    vignetteProgress.beat === beat &&
    vignetteProgress.mount === vignetteMount
      ? vignetteProgress.step
      : 0;
  const vignetteLive = Boolean(vignetteName) && entered;
  const vignetteComplete =
    vignetteName && vstep >= (planVignetteMeta[vignetteName]?.steps ?? 1) - 1;
  const currentLink = link?.name === vignetteName ? link : null;
  const activeAnnotation = planAnnotations.find(
    (note) => mapBeat >= note.from && mapBeat <= note.until,
  );
  const activeAnnotationPoint = activeAnnotation
    ? annotationLayout[activeAnnotation.id]
    : null;
  const bindVignetteNode = useCallback((node) => {
    if (vignetteNodeRef.current === node) return;
    vignetteNodeRef.current = node;
    setVignetteNode(node);
    if (node) {
      // Il DOM in uscita viene completato apposta prima di sparire. Quando si
      // rientra nella stessa battuta, pero', nessuna di quelle classi deve poter
      // sopravvivere sul primo frame del nuovo SVG: il modello deve nascere dal
      // solo stato di base, non mostrarsi finito e poi "resettarsi".
      node.querySelectorAll(".pv-i").forEach((el) => {
        el.classList.remove("is-on", "is-gone");
      });
      setVignetteMount((current) => current + 1);
    }
  }, []);

  // Quando si entra in una battuta con modello, la pianta conserva lo stato
  // precedente. Una battuta senza modello segue invece subito lo scroll, salvo
  // il caso in cui si sia abbandonato troppo presto il dettaglio precedente: in
  // quel caso aspetta che la sua uscita abbia mostrato lo stato completo.
  useEffect(() => {
    if (!entered) return undefined;
    const previousBeat = previousBeatRef.current;
    previousBeatRef.current = beat;
    const name = planBeats[beat]?.vignette;
    const previousHadVignette = Boolean(planBeats[previousBeat]?.vignette);
    const previousFinished = completedVignetteBeatsRef.current.has(previousBeat);

    if (name) {
      completedVignetteBeatsRef.current.delete(beat);
      const waitForPreviousExit =
        previousBeat !== beat && previousHadVignette && !previousFinished;
      const id = window.setTimeout(
        () => setMapBeat(Math.max(0, beat - 1)),
        waitForPreviousExit && !reduceMotion ? VIGNETTE_EXIT_MS : 0,
      );
      return () => window.clearTimeout(id);
    }

    if (previousBeat !== beat && previousHadVignette && !previousFinished) {
      const id = window.setTimeout(
        () => setMapBeat(beat),
        reduceMotion ? 0 : VIGNETTE_EXIT_MS,
      );
      return () => window.clearTimeout(id);
    }

    const id = window.setTimeout(() => setMapBeat(beat), 0);
    return () => window.clearTimeout(id);
  }, [beat, entered, reduceMotion]);

  // Il passaggio alla mappa parte soltanto quando l'ultimo pezzo del modello e'
  // visibile da abbastanza tempo da essere riconosciuto come stato finale.
  useEffect(() => {
    if (!entered || !vignetteName || !vignetteComplete) return undefined;
    const completedBeat = beat;
    const id = window.setTimeout(
      () => {
        completedVignetteBeatsRef.current.add(completedBeat);
        setMapBeat(completedBeat);
      },
      reduceMotion ? 0 : MAP_HANDOFF_MS,
    );
    return () => window.clearTimeout(id);
  }, [beat, entered, reduceMotion, vignetteComplete, vignetteName]);

  // ── L'arrivo in scena ─────────────────────────────────────────────────────
  // DUE strade verso lo stesso interruttore, e servono tutt'e due.
  //
  // L'IntersectionObserver copre il caso normale: la pagina è lunga quarantamila
  // pixel e il browser ripristina la posizione da sé al ricarico, quindi un
  // primo evento di `scroll` può non arrivare mai e con la sola soglia la pianta
  // resterebbe bianca finché non si muove la rotella.
  //
  // La soglia di scroll (dentro `update` qui sotto) copre il caso in cui il
  // browser non consegna i callback di frame: una scheda in secondo piano non
  // esegue `requestAnimationFrame`, e l'osservatore, che vive nello stesso ciclo,
  // tace con lui. Con il solo osservatore la scena si svegliava vuota al ritorno
  // in primo piano.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setEntered(true);
      },
      { rootMargin: "12% 0px" },
    );
    io.observe(root);
    return () => io.disconnect();
  }, []);

  // ── Scroll: solo quale battuta siamo ──────────────────────────────────────
  useEffect(() => {
    let frame = null;

    const measure = () => {
      const vh = window.innerHeight || 768;
      const page = window.scrollY;
      const line = vh * READING_LINE;
      marksRef.current = holdsRef.current.map((el) =>
        el ? page + el.getBoundingClientRect().top - line : Infinity,
      );
      const root = rootRef.current?.getBoundingClientRect();
      marksRef.current.enter = root ? page + root.top - vh * 0.95 : Infinity;
      marksRef.current.start = root ? page + root.top : Infinity;
      marksRef.current.end = root
        ? Math.max(marksRef.current.start + 1, page + root.bottom - vh)
        : Infinity;
      copyItemsRef.current = Array.from(
        bandRef.current?.querySelectorAll("[data-copy-beat]") ?? [],
      );
    };

    const paintCopy = (y, activeBeat) => {
      const items = copyItemsRef.current;
      if (!items.length) return;

      let from = activeBeat;
      let to = activeBeat;
      let fromOpacity = 1;
      let toOpacity = 0;
      let fromBlur = 0;
      let toBlur = 1;
      let swap = 0;

      if (!reduceMotion) {
        const half = Math.max(
          70,
          Math.min(150, (window.innerHeight || 768) * COPY_BLEND_VH * 0.5),
        );
        let nearest = -1;
        let distance = Infinity;
        for (let i = 0; i < planBeats.length - 1; i += 1) {
          const d = Math.abs(y - marksRef.current[i]);
          if (d < distance) {
            nearest = i;
            distance = d;
          }
        }
        if (nearest >= 0 && distance < half) {
          from = nearest;
          to = nearest + 1;
          const linear = Math.min(
            1,
            Math.max(0, (y - (marksRef.current[nearest] - half)) / (half * 2)),
          );
          swap = Math.sin(linear * Math.PI);
          // Due tempi separati, con un piccolo respiro al centro. La frase nuova
          // non riceve mai opacita' finche' la precedente non e' arrivata a zero.
          if (linear < 0.48) {
            const t = linear / 0.48;
            const eased = t * t * t * (t * (t * 6 - 15) + 10);
            fromOpacity = 1 - eased;
            fromBlur = eased;
          } else if (linear > 0.52) {
            const t = (linear - 0.52) / 0.48;
            toOpacity = t * t * t * (t * (t * 6 - 15) + 10);
            fromOpacity = 0;
            fromBlur = 1;
            toBlur = 1 - toOpacity;
          } else {
            fromOpacity = 0;
            fromBlur = 1;
          }
        }
      }

      rootRef.current?.style.setProperty("--copy-swap", swap.toFixed(3));

      items.forEach((el) => {
        const index = Number(el.dataset.copyBeat);
        const opacity =
          from === to ? (index === from ? 1 : 0)
          : index === from ? fromOpacity
          : index === to ? toOpacity
          : 0;
        const blur =
          from === to ? 0 : index === from ? fromBlur : index === to ? toBlur : 0;
        el.style.setProperty("--copy-opacity", opacity.toFixed(3));
        el.style.setProperty("--copy-blur", blur.toFixed(3));
      });
    };

    const update = () => {
      frame = null;
      const marks = marksRef.current;
      if (!marks.length) return;
      const y = window.scrollY;
      if (y >= marks.enter) setEntered(true);
      const progress = Math.min(
        1,
        Math.max(0, (y - marks.start) / (marks.end - marks.start)),
      );
      rootRef.current?.style.setProperty("--plan-progress", progress.toFixed(4));
      const vh = window.innerHeight || 768;
      const entrySpan = Math.max(1, vh * 0.75);
      const entry = reduceMotion
        ? 1
        : Math.min(1, Math.max(0, (y - (marks.start - entrySpan)) / entrySpan));
      // Keep the completed plan readable until the following chapter actually
      // enters the viewport, then let the two sections overlap visually.
      const exitStart = marks.end - vh * 0.03;
      const exitSpan = Math.max(1, vh * 0.95);
      const exit = reduceMotion
        ? 0
        : Math.min(1, Math.max(0, (y - exitStart) / exitSpan));
      rootRef.current?.style.setProperty("--plan-entry", entry.toFixed(4));
      rootRef.current?.style.setProperty("--plan-exit", exit.toFixed(4));
      let reached = 0;
      for (let i = 0; i < marks.length; i += 1) if (y >= marks[i]) reached = i + 1;
      const next = Math.min(planBeats.length - 1, reached);
      paintCopy(y, next);
      setBeat((current) => (current === next ? current : next));
    };

    const requestUpdate = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };
    const onResize = () => {
      measure();
      update();
    };

    measure();
    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", onResize);
    // La mappa reale che precede questa scena completa il proprio layout dopo il
    // primo paint. Se cresce, tutte le soglie assolute si spostano insieme: con
    // la sola misura iniziale entrata e uscita partivano circa mezzo schermo in
    // anticipo dopo un reload. Osservare il capitolo padre costa zero durante lo
    // scroll e ci permette di rimisurare soltanto quando il layout cambia davvero.
    const layoutObserver = new ResizeObserver(onResize);
    const rootNode = rootRef.current;
    if (rootNode) layoutObserver.observe(rootNode);
    if (rootNode?.parentElement) layoutObserver.observe(rootNode.parentElement);
    if (rootNode?.previousElementSibling) {
      layoutObserver.observe(rootNode.previousElementSibling);
    }
    let live = true;
    document.fonts?.ready.then(() => {
      if (live) onResize();
    });
    const settleId = window.setTimeout(onResize, 1100);
    return () => {
      live = false;
      window.clearTimeout(settleId);
      layoutObserver.disconnect();
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", onResize);
    };
  }, [reduceMotion]);

  // ── L'inquadratura ────────────────────────────────────────────────────────
  // Si calcola al montaggio e al resize, e MAI per battuta: la pianta sta ferma.
  // La scala viene solo dalla larghezza (`planView.units`), non dal rapporto della
  // finestra, così la stessa porzione di quartiere si vede su ogni monitor —
  // prima veniva da `min(vw/…, vh/…)` e su schermo piccolo l'inquadratura
  // stringeva.
  useEffect(() => {
    const place = () => {
      const view = viewRef.current;
      const cam = camRef.current;
      const band = bandRef.current;
      if (!view || !cam || !band) return;
      // `.plan-bleed` è più largo della fascia per poter sfumare senza un taglio
      // verticale. Lo zoom continua però a dipendere dalla fascia narrativa:
      // allargare la dissolvenza non deve cambiare l'inquadratura della pianta.
      const vw = bandRef.current?.clientWidth || view.clientWidth || 1;
      const [cx, cy] = planView.at;
      cam.style.setProperty("--cx", String(cx));
      cam.style.setProperty("--cy", String(cy));
      const zc = vw / planView.units;
      cam.style.setProperty("--zc", zc.toFixed(4));

      // Lo stile della telecamera e' stato appena fissato: una sola lettura del
      // suo rettangolo basta per collocare tutte le note, senza lavoro durante lo
      // scroll e senza rimpicciolire la tipografia insieme alla mappa.
      const br = band.getBoundingClientRect();
      const cr = cam.getBoundingClientRect();
      setAnnotationLayout(
        Object.fromEntries(
          planAnnotations.map((note) => [
            note.id,
            {
              x: cr.left + note.point[0] * zc - br.left,
              y: cr.top + note.point[1] * zc - br.top,
            },
          ]),
        ),
      );
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, []);

  // ── Il primo piano della battuta ─────────────────────────────────────────
  useEffect(() => {
    const name = planBeats[beat]?.vignette;
    if (!entered || !name) return undefined;
    const node = vignetteNode;
    if (!node || node.dataset.vignette !== name) return undefined;
    // Il progresso porta con sé la battuta a cui appartiene. Così, nel passaggio
    // diretto corridoio → portico, il terzo modello non eredita per un frame lo
    // stato già completo del secondo (il piccolo glitch intermittente segnalato).
    const total = planVignetteMeta[name]?.steps ?? 1;
    let k = 0;
    let intervalId;
    const advance = () => {
      k += 1;
      setVignetteProgress({ beat, mount: vignetteMount, step: k });
      if (k >= total - 1) {
        window.clearInterval(intervalId);
      }
    };
    const firstStepId = window.setTimeout(
      () => {
        advance();
        if (k < total - 1) {
          intervalId = window.setInterval(advance, VIGNETTE_STEP_MS);
        }
      },
      reduceMotion ? 0 : VIGNETTE_FIRST_STEP_MS,
    );
    return () => {
      window.clearTimeout(firstStepId);
      window.clearInterval(intervalId);
      // Nessuna mutazione visiva nel cleanup. In sviluppo React verifica gli
      // effetti con setup -> cleanup -> setup: completare qui il disegno lo
      // mostrava gia' pronto per un frame, prima della vera animazione. Se si
      // scorre via in anticipo, il modello esce nello stato effettivamente
      // raggiunto; ogni nuova istanza riparte comunque dal proprio mount id.
    };
  }, [beat, entered, reduceMotion, vignetteMount, vignetteNode]);

  // ── Il RICHIAMO: dal punto della pianta al primo piano ────────────────────
  // Si misura quando il primo piano entra in scena, e al resize. Tutto in pixel
  // dentro `.plan-band`, che è il riquadro comune a disegno, testo e primi piani.
  //
  // Il punto sulla pianta si ricava per conto chiuso, senza cercare niente nel
  // DOM: la telecamera è ferma e la sua trasformazione è
  // `scale(zc) translate(-cx,-cy)` con origine in alto a sinistra, quindi un punto
  // (ax, ay) del disegno cade a `camRect.left + ax * zc`. Vale finché quella
  // `transform` resta di sola scala e traslazione: chi ci rimette una rotazione
  // rifaccia anche questo conto.
  //
  // `vignetteLive` resta fra le dipendenze perché il riquadro viene montato solo
  // quando la scena è entrata: è quel montaggio a rendere disponibile la misura.
  useEffect(() => {
    if (!vignetteName || !entered || !vignetteLive) return undefined;

    const measure = () => {
      const band = bandRef.current;
      const cam = camRef.current;
      const box = vignetteNodeRef.current;
      const anchor = PLAN_ANCHORS[planVignetteMeta[vignetteName]?.anchor];
      if (
        !band ||
        !cam ||
        !box ||
        box.dataset.vignette !== vignetteName ||
        !anchor
      ) return;
      const zc = Number(cam.style.getPropertyValue("--zc")) || 0.5;
      const br = band.getBoundingClientRect();
      const cr = cam.getBoundingClientRect();
      // La scatola è ancora nella posizione di riposo quando viene misurata.
      // La trasformazione d'uscita comincia solo dopo il cambio di battuta.
      const ax = cr.left + anchor[0] * zc - br.left;
      const ay = cr.top + anchor[1] * zc - br.top;
      // La posizione è già definitiva: la misura serve soltanto a collegare il
      // centro del dettaglio alla sua ancora sulla pianta.
      const vr = box.getBoundingClientRect();
      const vx = vr.left + vr.width / 2 - br.left;
      const vy = vr.top + vr.height / 2 - br.top;

      const dx = ax - vx;
      const dy = ay - vy;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      // dove la linea esce dal riquadro del disegno
      const edge = Math.min(
        Math.abs(ux) > 1e-3 ? vr.width / 2 / Math.abs(ux) : 1e9,
        Math.abs(uy) > 1e-3 ? vr.height / 2 / Math.abs(uy) : 1e9,
      );
      const lead = len > edge + LINK_R + 26;
      setLink({
        name: vignetteName,
        ax,
        ay,
        fx: Math.round(dx),
        fy: Math.round(dy),
        x1: vx + ux * (edge + 10),
        y1: vy + uy * (edge + 10),
        x2: ax - ux * (LINK_R + 6),
        y2: ay - uy * (LINK_R + 6),
        lead,
      });
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [vignetteName, entered, place, vignetteLive, vignetteMount]);

  // Il primo piano nasce dalla stessa ancora verso cui tornera' in uscita. La
  // geometria e' disponibile soltanto dopo aver montato e misurato la scatola:
  // fino ad allora Framer la tiene invisibile, poi la posa sull'ancora e percorre
  // al contrario lo stesso vettore dell'uscita. Il mount id impedisce che un
  // resize faccia ripartire l'entrata del modello gia' visibile.
  useLayoutEffect(() => {
    const node = vignetteNodeRef.current;
    if (
      !vignetteLive ||
      !currentLink ||
      !node ||
      node.dataset.vignette !== vignetteName ||
      enteredVignetteMountRef.current === vignetteMount
    ) return;

    enteredVignetteMountRef.current = vignetteMount;
    if (reduceMotion) {
      vignetteControls.set({ opacity: 1, x: 0, y: 0, scale: 1, filter: "none" });
      return;
    }

    vignetteControls.set({
      opacity: 0,
      x: currentLink.fx,
      y: currentLink.fy,
      scale: 0.12,
      filter: "blur(2px)",
    });
    vignetteControls.start({
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      filter: "blur(0px)",
      transition: {
        duration: VIGNETTE_ENTER_MS / 1000,
        ease: [0.22, 1, 0.36, 1],
      },
    });
  }, [
    currentLink,
    reduceMotion,
    vignetteControls,
    vignetteLive,
    vignetteMount,
    vignetteName,
  ]);

  // ── Accendere il disegno ─────────────────────────────────────────────────
  // `is-on` dice "questo esiste adesso"; `is-now` dice "sta arrivando in questa
  // battuta" ed è l'unico che si prende il ritardo `--d`. Senza la distinzione,
  // chi risale si vedrebbe rifare la scala di ritardi di ogni battuta passata.
  useEffect(() => {
    const fig = figRef.current;
    if (!fig || !entered) return;
    if (!itemsRef.current) {
      itemsRef.current = Array.from(fig.querySelectorAll(".pl-i")).map((el) => ({
        el,
        at: Number(el.dataset.at || 0),
        until: el.dataset.until == null ? null : Number(el.dataset.until),
      }));
    }
    itemsRef.current.forEach(({ el, at, until }) => {
      const on = mapBeat >= at && (until == null || mapBeat < until);
      el.classList.toggle("is-on", on);
      el.classList.toggle("is-now", on && at === mapBeat);
    });
  }, [mapBeat, entered]);

  // I tempi dentro il primo piano. Come per la pianta, le classi si mettono a mano
  // sui figli dell'SVG: `.is-on` da quando il pezzo esiste, e `.is-gone` quando se
  // ne va — le auto, le transenne, le chiazze d'ombra staccate. Due tempi dopo il
  // proprio: abbastanza per vederle, abbastanza poco per capire che il posto sta
  // cambiando e non si sta solo riempiendo.
  useLayoutEffect(() => {
    const art = bandRef.current?.querySelector(
      `[data-vignette="${vignetteName}"] .plan-vignette-art`,
    );
    if (!art) return;
    art.querySelectorAll(".pv-i").forEach((el) => {
      const at = Number(el.dataset.step || 0);
      const goneAt = Number(el.dataset.goneStep || at + 2);
      el.classList.toggle("is-on", vstep >= at);
      el.classList.toggle(
        "is-gone",
        el.classList.contains("pv-goes") && vstep >= goneAt,
      );
    });
  }, [vstep, vignetteName]);

  return (
    <section ref={rootRef} className="plan-scene" aria-label={planSceneLabel}>
      {/* Lo scrollytelling cambia testo in base alla posizione della pagina.
          Per chi usa un lettore di schermo non è una sequenza affidabile: i
          sette passaggi sono quindi disponibili qui, nel normale ordine del
          documento, mentre il palco animato sotto è una rappresentazione
          equivalente e viene nascosto alle tecnologie assistive. */}
      <div className="sr-only plan-transcript">
        <h3>{planContext.title}</h3>
        <p>{planContext.note}.</p>
        <p>{planFigureLabel}</p>
        <ol>
          {planBeats.map((step) => (
            <li key={step.id}>
              <strong>{step.lead}</strong>{" "}
              {step.body.map((part) => part.text).join("")}
            </li>
          ))}
        </ol>
        <p>
          {planLegendLabel}: {planLegend.map((item) => item.label).join(", ")}.
        </p>
      </div>

      {/* La scena è alta quanto la finestra. Il disegno è lo SFONDO, dentro la
          fascia larga del capitolo, e sfuma sui fianchi. */}
      <div
        className={`plan-stage plan-stage--${side}`}
        data-beat={mapBeat}
        data-story-beat={beat}
        aria-hidden="true"
      >
        <div ref={viewRef} className="plan-bleed">
          {/* La scatola della telecamera è grande quanto la pianta in unità di
              disegno: così `--cx`/`--cy` sono direttamente coordinate del
              disegno, e le ancore del generatore si usano senza conversioni. */}
          <div
            ref={camRef}
            className="plan-camera"
            style={{ width: `${PLAN_W}px`, height: `${PLAN_H}px` }}
          >
            <figure
              ref={figRef}
              className="plan-figure"
              /* Il disegno È il contenuto: senza questo, con "riduci animazioni"
                 tutta la pianta comparirebbe di colpo a ogni battuta
                 (theme.css, 01 § 1.6). */
              data-motion="story"
              aria-label={planFigureLabel}
              dangerouslySetInnerHTML={PLAN_HTML}
            />
          </div>
        </div>

        {/* La sfumatura del fianco dove sta il testo. Due elementi statici e non un
            gradiente pilotato da variabili: i gradienti CSS non si interpolano,
            mentre due opacità che si scambiano costano niente e restano fuori dal
            ciclo dello scroll. */}
        <div className="plan-veil plan-veil--l" aria-hidden="true" />
        <div className="plan-veil plan-veil--r" aria-hidden="true" />

        {/* Due veli leggeri raccordano la scena alle sezioni adiacenti. Coprono
            il palco invece di animare l'opacita' del grande SVG: stesso effetto
            visivo, senza costringere il browser a rasterizzare tutta la pianta a
            ogni pixel di scroll. */}
        <div className="plan-curtain plan-curtain--entry" aria-hidden="true" />
        <div className="plan-curtain plan-curtain--exit" aria-hidden="true" />

        {/* La fascia: la stessa dell'apertura sull'aria. Testo, primi piani e
            richiami ci stanno dentro, così su un monitor largo non finiscono
            appiccicati al bordo dello schermo mentre il disegno sta molto più in
            dentro. */}
        <div ref={bandRef} className="plan-band">
          {/* Una sola annotazione alla volta. Usa lo stesso doppio tratto carta +
              inchiostro dei richiami ai primi piani, ma resta più discreta: non
              è una legenda della città, serve soltanto a sciogliere un dubbio
              mentre l'elemento pertinente entra nella pianta. */}
          <AnimatePresence mode="wait" initial={false}>
            {activeAnnotation && activeAnnotationPoint ? (
              <motion.div
                key={activeAnnotation.id}
                className={`plan-annotation plan-annotation--${activeAnnotation.id}`}
                style={{
                  left: activeAnnotationPoint.x,
                  top: activeAnnotationPoint.y,
                  "--annotation-x": `${activeAnnotation.offset[0]}px`,
                  "--annotation-y": `${activeAnnotation.offset[1]}px`,
                }}
                initial={
                  reduceMotion
                    ? { opacity: 1 }
                    : { opacity: 0, y: 7, filter: "blur(3px)" }
                }
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={
                  reduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, y: -5, filter: "blur(2px)" }
                }
                transition={{
                  duration: reduceMotion ? 0 : 0.48,
                  ease: [0.22, 1, 0.36, 1],
                }}
                aria-hidden="true"
                data-motion="story"
              >
                <svg className="plan-annotation-leader" aria-hidden="true">
                  <line
                    className="plan-annotation-line plan-annotation-line--halo"
                    x1="0"
                    y1="0"
                    x2={activeAnnotation.offset[0]}
                    y2={activeAnnotation.offset[1]}
                    pathLength="1"
                  />
                  <line
                    className="plan-annotation-line plan-annotation-line--ink"
                    x1="0"
                    y1="0"
                    x2={activeAnnotation.offset[0]}
                    y2={activeAnnotation.offset[1]}
                    pathLength="1"
                  />
                </svg>
                <span className="plan-annotation-dot" />
                <span className="plan-annotation-label">
                  {activeAnnotation.label}
                </span>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Il richiamo resta per tutta la battuta. Quando si scorre oltre, esce
              insieme al modello: l'ancora rimane visibile abbastanza a lungo da
              ricevere il piccolo volo del dettaglio. */}
          <AnimatePresence mode="wait" initial={false}>
            {vignetteName && entered && currentLink ? (
              <motion.svg
                key={`link-${vignetteName}`}
                className={`plan-link${vignetteComplete ? " is-ready" : ""}`}
                aria-hidden="true"
                data-motion="story"
                exit={{ opacity: 0 }}
                transition={{
                  duration: reduceMotion ? 0 : 0.45,
                  delay: reduceMotion ? 0 : 0.08,
                }}
              >
              {/* Due volte lo stesso segno: sotto in carta e largo, sopra in
                  inchiostro e sottile. È il vecchio trucco del disegno tecnico, e
                  serve perché una linea di richiamo sottile sopra una mappa piena
                  di linee semplicemente sparisce. Le due copie hanno le stesse
                  classi, quindi la stessa animazione, e restano in passo. */}
              {["halo", "ink"].map((layer) => (
                <g key={layer} className={`plan-link-${layer}`}>
                  {currentLink.lead ? (
                    <line
                      className="plan-link-lead"
                      x1={currentLink.x1}
                      y1={currentLink.y1}
                      x2={currentLink.x2}
                      y2={currentLink.y2}
                      pathLength="1"
                    />
                  ) : null}
                  <circle
                    className="plan-link-ring"
                    cx={currentLink.ax}
                    cy={currentLink.ay}
                    r={LINK_R}
                    pathLength="1"
                  />
                  <path
                    className="plan-link-ticks"
                    d={[
                      `M ${currentLink.ax - LINK_R - 8} ${currentLink.ay} h 6`,
                      `M ${currentLink.ax + LINK_R + 2} ${currentLink.ay} h 6`,
                      `M ${currentLink.ax} ${currentLink.ay - LINK_R - 8} v 6`,
                      `M ${currentLink.ax} ${currentLink.ay + LINK_R + 2} v 6`,
                    ].join(" ")}
                    pathLength="1"
                  />
                </g>
              ))}
                <circle
                  className="plan-link-dot"
                  cx={currentLink.ax}
                  cy={currentLink.ay}
                  r="2.8"
                />
              </motion.svg>
            ) : null}
          </AnimatePresence>

          {/* Il primo piano della battuta. La pianta dice dove, questo dice com'è
              fatto. Si disegna a tratto, un pezzo per volta.

              La scatola viene misurata nella posizione di riposo. Poi entra
              dall'ancora e, quando si cambia battuta, torna verso la stessa.

              La `key` porta il nome: cambiando battuta React smonta e rimonta,
              quindi il disegno riparte da zero invece di apparire già fatto
              quando si torna indietro. */}
          <AnimatePresence mode="wait" initial={false}>
            {vignetteLive ? (
              <motion.div
                ref={bindVignetteNode}
                key={vignetteName}
                className={`plan-vignette plan-vignette--${place} plan-vignette--${vignetteSide}`}
                style={{ "--ratio": planVignetteMeta[vignetteName].ratio }}
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={vignetteControls}
                exit={
                  reduceMotion
                    ? { opacity: 0, transition: { duration: 0 } }
                    : {
                        opacity: 0,
                        x: currentLink?.fx ?? 0,
                        y: currentLink?.fy ?? 0,
                        scale: 0.12,
                        filter: "blur(2px)",
                        transition: {
                          duration: VIGNETTE_EXIT_MS / 1000,
                          ease: [0.45, 0, 0.25, 1],
                        },
                      }
                }
                data-motion="story"
                data-vignette={vignetteName}
                aria-hidden="true"
              >
                <div
                  className="plan-vignette-art"
                  dangerouslySetInnerHTML={VIGNETTE_HTML[vignetteName]}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Due sedi fisse per il testo. Prima la stessa colonna veniva spostata
              istantaneamente da un lato all'altro al cambio di battuta: anche con
              l'opacità animata, quel salto rendeva la transizione scattante. Ora
              il testo uscente sfuma nel suo punto e quello nuovo entra nell'altro,
              senza traslazioni e senza ricomporre la larghezza delle righe. */}
          {COPY_SIDES.map((copySide) => {
            const currentSide = copySide === side;
            return (
              <div
                key={copySide}
                className={`plan-copy plan-copy--${copySide}${
                  currentSide ? " is-current" : ""
                }${vignetteLive && currentSide ? " is-narrow" : ""}`}
              >
                <span className="plan-step tnum">
                  <span className="plan-step-count" key={`${copySide}-${beat}`}>
                    {String(beat + 1).padStart(2, "0")} /{" "}
                    {String(planBeats.length).padStart(2, "0")}
                  </span>
                  <span className="plan-step-track" aria-hidden="true">
                    <span className="plan-step-progress" />
                  </span>
                </span>

                <div className="plan-copy-body">
                  {planBeats.map((step, i) => {
                    const stepSide = step.side === "right" ? "right" : "left";
                    if (stepSide !== copySide) return null;
                    const active = i === beat;
                    return (
                      <div
                        key={step.id}
                        className={`plan-beat${active ? " is-on" : ""}`}
                        data-copy-beat={i}
                        aria-hidden={active ? undefined : "true"}
                      >
                        <p className="plan-text">
                          <span className="plan-text-lead">{step.lead}</span>
                          <br />
                          <CopySegments parts={step.body} breakAfterPeriod />
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* La somma della sezione, che si compone mentre si legge. */}
                <div
                  className={`plan-legend${
                    currentSide && mapBeat >= planLegend[0].at ? " is-on" : ""
                  }`}
                  aria-hidden="true"
                >
                  <span className="plan-legend-label">{planLegendLabel}</span>
                  <ul className="plan-legend-list">
                    {planLegend.map((item) => (
                      <li
                        key={item.label}
                        className={`plan-legend-item plan-legend-item--${item.tone}${
                          currentSide && mapBeat >= item.at ? " is-on" : ""
                        }${currentSide && mapBeat === item.at ? " is-now" : ""}`}
                      >
                        <span className="plan-legend-swatch" />
                        <span className="plan-legend-word">{item.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tempo di arrivo autonomo: senza questo spazio il primo hold toccava la
          linea di lettura dopo appena il 44% di una schermata e il testo iniziale
          spariva prima che si potesse guardare il quartiere. Non ha un ref perché
          non è una nuova battuta: sposta in avanti tutte le soglie insieme. */}
      <div className="plan-arrival-hold" aria-hidden="true" />

      {/* Un hold per battuta: sono loro a misurare lo scorrimento, e la scena si
          stacca quando è passato l'ultimo. */}
      {planBeats.map((step, i) => {
        /* Lo stato avanza quando il BORDO SUPERIORE dell'hold supera la linea di
           lettura. La sua altezza determina quindi il tempo della battuta
           SUCCESSIVA. Il primo piano di `planBeats[i + 1]`, non quello di
           `step`, decide se questo hold deve essere largo. */
        const givesTimeToVignette = Boolean(planBeats[i + 1]?.vignette);
        return (
          <div
            key={step.id}
            ref={(el) => {
              holdsRef.current[i] = el;
            }}
            className={`plan-hold${givesTimeToVignette ? " plan-hold--wide" : ""}`}
            aria-hidden="true"
          />
        );
      })}
    </section>
  );
}

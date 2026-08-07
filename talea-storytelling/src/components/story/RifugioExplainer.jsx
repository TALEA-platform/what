import { useEffect, useRef, useState } from "react";
import {
  reliefHeader,
  rifugioSteps,
  rifugioFigureLabel,
  rifugioRecipeLabel,
  rifugioSequenceCaptions,
} from "../../data/climateRelief";
import { rifugioSvg } from "../../data/reliefVignettes";
import { RifugioModel3D } from "./RifugioModel3D";
import { ScrollCue } from "../ui/ScrollCue";
import { SequenceStepper } from "../ui/SequenceStepper";
import { GlossaryTerm } from "../ui/GlossaryDrawer";
import { useTimedSequence } from "../../hooks/useTimedSequence";
import { SCROLL_ACCELERATION_GRACE_MS } from "../../lib/motion";

// Cumulative "recipe" of the refuge: one voice per ingredient, lit from the step
// that introduces it.
const RECIPE = rifugioSteps.filter((s) => s.piece).map((s) => ({ piece: s.piece, from: s.id }));

// DEVE restare una costante di modulo — non rimetterlo dentro il JSX come
// `dangerouslySetInnerHTML={{ __html: rifugioSvg }}`. React confronta le prop
// per identità, quindi un oggetto nuovo a ogni render gli farebbe riscrivere
// l'innerHTML della figura ogni volta, cancellando le classi `.draw`/`.on` che
// l'effetto qui sotto applica ai figli dell'SVG. Un'identità stabile fa sì che
// React non tocchi più quel nodo.
const RIFUGIO_HTML = { __html: rifugioSvg };

// Auto-play pacing. The first step (the hot street + its text) is on show from the
// moment the scene engages — there is no empty "orientation" beat here, because
// the figure IS the content.
//
// Ogni tappa dura quanto il suo testo, non un tempo fisso: 3,8 s uguali per tutte
// facevano 28 secondi di figura agganciata, la permanenza più lunga della pagina
// (09 § 9.2). La formula **si adatta da sé** se un domani il testo cambia: non
// c'è una seconda tabella di numeri da tenere allineata.
//
// La costante di partenza è alta apposta, ed è la parte che non dipende dal
// testo. Una battuta deve bastare per DUE cose, non una: leggere la riga a
// destra (~1 s) e poi guardare il pezzo che si disegna, che da solo prende
// ~1,05 s di tratto più ~1,15 s di colore. Con una costante bassa il lettore
// finiva di leggere proprio mentre il disegno finiva, e la vignetta gli passava
// sotto gli occhi senza che la guardasse. Con le tappe ridotte a una riga sola
// il tempo di lettura si è dimezzato: quello guadagnato è andato al disegno, non
// alla velocità.
//
// ── Con il plastico servono battute più lunghe ───────────────────────────────
// I tempi erano tarati su una vignetta piatta che si disegnava e stava ferma.
// Un modello tridimensionale che si costruisce si guarda molto più a lungo: si
// segue il pezzo che cresce, si cerca dov'è finito, spesso lo si gira. Con le
// vecchie battute il testo a destra passava senza che nessuno lo leggesse —
// tutta l'attenzione era sul disegno, e la riga cambiava mentre l'occhio era
// ancora dall'altra parte.
//
// Ogni tappa continua a durare quanto il suo testo, non un tempo fisso: la
// formula si adatta da sé se un domani il testo cambia. Sono cresciuti la
// costante di partenza (il tempo che non dipende dalle parole: guardare il
// pezzo arrivare) e i due estremi.
//
// Nota: l'ultimo valore dell'array non viene mai usato dall'hook (dopo l'ultima
// tappa c'è solo TAIL_MS), quindi il totale è START_DELAY + somma delle prime
// sette + TAIL_MS. Oggi: ~33 s.
const wordsOf = (step) => step.paragraphs.join(" ").trim().split(/\s+/).length;
const READ_MS = rifugioSteps.map((step, index) =>
  index === 0
    ? 2000
    : Math.max(3800, Math.min(5400, Math.round((2600 + wordsOf(step) * 190) / 20) * 20)),
);
// Quanto deve passare fra due spinte da scorrimento. Sotto mezzo secondo una
// scorsa sola ne genera cinque e si torna a saltare la costruzione.
const SCROLL_NUDGE_COOLDOWN_MS = 650;
const START_DELAY = 1500;
const TAIL_MS = 900;
// Il plastico si vede dal primo fotogramma, ma per sei decimi si sta ancora
// posando e la scena attorno a lui si sta riorganizzando. Le sue animazioni
// senza fine — nuvole, acqua, respiro — partono dopo: sarebbe lavoro in più
// proprio nella finestra in cui il disegno va rifatto a ogni larghezza nuova.
const ENGAGE_SETTLE_MS = 640;
const RIFUGIO_SCROLL_GRACE_MS = START_DELAY + READ_MS[0] + 300;
// Quanto tenere la classe `draw` addosso a un gruppo della vignetta: il tempo
// del tratto più quello del colore che lo raggiunge (story.css). Scaduto, il
// gruppo passa a `seen` e da lì in poi è solo acceso, senza più transizioni.
const VIGNETTE_DRAW_MS = 1500;

/**
 * Sticky-vignette explainer: a sunny street becomes a climate refuge, element by
 * element — and now it builds itself. On engage the scene pins, then advances on
 * a timer: each step draws the newly introduced SVG `.layer` groups while the
 * text beside it swaps, until the refuge is complete. After it has played, the
 * SequenceStepper arrows let the reader page back and forth through the elements
 * they watched appear. Chi scorre non salta la costruzione: la scorsa accelera
 * la tappa successiva, una alla volta (vedi la nota sulla spinta più in basso).
 *
 * ── Dalla vignetta al plastico ─────────────────────────────────────────────
 * La figura non è più un SVG piatto a cui questo componente accendeva i livelli
 * uno per uno con le classi `.draw`/`.on`/`.seen`: è un modello tridimensionale
 * che il lettore può girare (`RifugioModel3D`). La vignetta resta però
 * l'APERTURA: finché il testo introduttivo è in quadro il disegno è quello
 * piatto, ed è il registro giusto per presentare l'idea; quando parte la
 * sequenza cede il posto al plastico con una dissolvenza.
 *
 * Il montaggio delle tappe è passato dentro al modello, che sa quale pezzo
 * appartiene a quale tappa e sa farlo crescere da terra — e ritirarsi tornando
 * indietro. Qui resta il numero della tappa da passargli, e il tratto della
 * vignetta: che non è più il solo assetto d'apertura, perché ogni pezzo si
 * disegna la prima volta che il lettore lo vede DAVVERO — anche quando quella
 * prima volta arriva risalendo dal plastico (vedi l'effetto del disegno).
 */
export function RifugioExplainer({ onGlossary }) {
  // Latches true once the scene reaches the reading line, so the opening beat
  // draws itself in on arrival (rather than being silently pre-drawn on mount).
  const [entered, setEntered] = useState(false);
  const [engaged, setEngaged] = useState(false);
  // Vero quando il lettore ha consumato tutto lo spazio agganciato: ha deciso
  // di non aspettare il timer. Non vuol dire che la sequenza sia finita — vuol
  // dire che da lì in poi la scena è sua (vedi `released`).
  const [scrolledPast, setScrolledPast] = useState(false);
  // ── Il plastico esiste solo quando serve ─────────────────────────────────
  // È diecimila poligoni SVG e una dozzina di animazioni CSS senza fine (le
  // nuvole, l'acqua, il respiro delle persone, l'autobus). Lasciato in pagina
  // dopo che il lettore è andato oltre, continua a costarle un pezzo di ogni
  // fotogramma per tutto il resto della storia — e si sente, perché tutto
  // quello che viene dopo è fatto di mappe e di scorrimento.
  //
  // Quindi si monta poco prima di entrare in quadro e si smonta quando il
  // lettore ha davvero lasciato la sezione: `destroy()` svuota l'<svg> e stacca
  // tutti gli ascoltatori. Rientrando si ricostruisce — costa una cinquantina
  // di millisecondi, pagati mentre la scena è ancora fuori campo — e riparte
  // dalla tappa giusta senza rimontarla, perché al primo assetto il modello non
  // anima mai niente. Le due soglie non coincidono: vedi la nota in `update`.
  const [nearby, setNearby] = useState(false);
  // Vero quando la griglia della scena ha finito di riorganizzarsi e il
  // plastico è davvero in quadro. Serve a tenere ferme le sue animazioni senza
  // fine per tutto il secondo della transizione: in quel secondo il plastico
  // non è nemmeno dipinto (vedi rifugio-model3d.css), e nuvole, acqua e respiro
  // che scattano proprio lì aggiungono lavoro all'unico momento che non ne può
  // reggere altro.
  const [settled, setSettled] = useState(false);
  // Vero quando la vignetta piatta è in quadro. Insieme a `!engaged` dice se il
  // lettore la sta davvero guardando: è la condizione per far partire un tratto
  // (vedi l'effetto del disegno più in basso).
  const [figureInView, setFigureInView] = useState(false);

  const explainerRef = useRef(null);
  const figureRef = useRef(null);
  const introHoldRef = useRef(null);
  const holdRef = useRef(null);
  const scrollAccelerationUnlockAtRef = useRef(Infinity);
  // Lo scorrimento dà una SPINTA, non un salto: qui si tiene quando è stata
  // data l'ultima, e a che tappa siamo (l'effetto che ascolta lo scroll non si
  // riabbona a ogni render, quindi non può leggere `activeIndex` dal closure).
  const lastNudgeAtRef = useRef(0);
  const activeIndexRef = useRef(0);
  // Le chiavi dei gruppi della vignetta (`base`, più il numero di tappa di ogni
  // `.layer`) a cui il tratto è già stato mostrato AL LETTORE. Non è la stessa
  // cosa di «acceso»: mentre la sequenza gira il lettore guarda il plastico e la
  // vignetta è nascosta, quindi un livello che si accendesse lì sotto avrebbe
  // speso il suo disegno davanti a nessuno.
  const drawnKeysRef = useRef(new Set());

  const {
    revealed,
    complete,
    completeRef,
    activeIndex,
    selected,
    advanceTo,
    forceComplete,
    goTo,
    goPrev,
    goNext,
  } = useTimedSequence({
    count: rifugioSteps.length,
    engaged,
    startDelay: START_DELAY,
    readMs: READ_MS,
    tailMs: TAIL_MS,
    // Le frecce si sbloccano anche prima della fine per chi ha già scorso via
    // tutto lo spazio agganciato: a quel punto aspettare il timer non ha più
    // senso, e togliergli anche il modo di rivedere le tappe vorrebbe dire
    // lasciarlo con una scena che non può più consultare. (L'altro caso —
    // essere arrivati all'ultima tappa — lo riconosce l'hook da sé.)
    pickDuringPlay: scrolledPast,
  });

  // ── Quando la scena passa in mano al lettore ──────────────────────────────
  // Due strade, e portano allo stesso posto: o ha consumato tutto l'hold, o è
  // arrivato all'ultima tappa. In tutti e due i casi non c'è più niente da
  // aspettare, e le frecce devono accendersi — anche se il cronometro sta
  // ancora contando il suo tempo di coda.
  const released = scrolledPast || revealed >= rifugioSteps.length;

  // Quando le frecce si accendono, la scena si ferma sulla tappa a cui è
  // arrivata: senza questo `selected` resta nullo e la prima freccia premuta
  // salterebbe all'ultima tappa, che è il comportamento di una sequenza finita.
  //
  // ── Con i valori VIVI, non con i ref ──────────────────────────────────────
  // Qui si leggeva la tappa da `activeIndexRef`, che viene però riallineato da
  // un effetto dichiarato più in basso: React li esegue nell'ordine in cui sono
  // scritti, quindi nel giro in cui `released` scatta il ref porta ancora la
  // tappa PRECEDENTE. E `released` scatta esattamente quando arriva l'ultima:
  // il risultato era che la tappa 7 partiva a costruirsi e a metà strada la
  // scena tornava alla 6. Con i valori vivi il problema non esiste.
  useEffect(() => {
    if (released && selected == null) goTo(activeIndex);
  }, [released, selected, activeIndex, goTo]);

  // The element currently being built / on show drives both the figure and the
  // status pill. The reader's arrow pick overrides the auto-play head.
  const step = activeIndex;
  // The text card follows the active step — shown from the very first step (no
  // empty orientation beat), so the scene never reads as "missing" on arrival.
  const textIndex = selected != null ? selected : activeIndex;
  // La sequenza e' "consultabile" sia quando ha finito da se', sia quando il
  // lettore l'ha scavalcata scorrendo: in tutti e due i casi le frecce servono.
  const canStep = complete || released;

  // La spinta da scorrimento legge la tappa da qui, non dal closure:
  // l'effetto che ascolta lo scroll non si riabbona a ogni render.
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    scrollAccelerationUnlockAtRef.current = engaged
      ? performance.now() + Math.max(SCROLL_ACCELERATION_GRACE_MS, RIFUGIO_SCROLL_GRACE_MS)
      : Infinity;
  }, [engaged]);

  // Il momento in cui la griglia ha finito di muoversi e il plastico compare.
  // Tarato sulla stessa durata delle transizioni in rifugio-model3d.css: se
  // cambia una, cambia l'altra.
  useEffect(() => {
    if (!engaged) return undefined;
    const timer = window.setTimeout(() => setSettled(true), ENGAGE_SETTLE_MS);
    return () => {
      window.clearTimeout(timer);
      setSettled(false);
    };
  }, [engaged]);

  // ── Quando la vignetta è davvero sotto gli occhi ──────────────────────────
  // Serve al tratto, e serve per una ragione sola: `engaged` da solo non basta.
  // Scorrendo oltre la sezione la scena si sgancia (il plastico se ne va) ma la
  // vignetta è ormai fuori campo — e senza questa seconda condizione tutti i
  // livelli si disegnerebbero lì, alle spalle del lettore, che risalendo li
  // troverebbe già fatti.
  useEffect(() => {
    const fig = figureRef.current;
    if (!fig || typeof IntersectionObserver === "undefined") {
      setFigureInView(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      ([entry]) => setFigureInView(entry.isIntersecting),
      // Un margine in basso perché il tratto d'apertura parta all'arrivo della
      // scena, dov'è sempre partito, e non qualche pixel di scorrimento più giù.
      { rootMargin: "0px 0px 12% 0px" },
    );
    io.observe(fig);
    return () => io.disconnect();
  }, []);

  // ── La vignetta segue la tappa, e ogni pezzo si disegna la prima volta ────
  // La vignetta è l'apertura, ma non è solo l'apertura: risalendo dalla
  // sequenza il lettore ci ritorna sopra, e deve trovarci la STESSA scena che
  // stava guardando nel plastico. Prima le si disegnava solo il primo assetto e
  // basta, quindi tornando su dalla tappa 5 si ritrovava la strada assolata di
  // partenza: due disegni della stessa cosa che dicevano cose diverse.
  //
  // ── Ma «già acceso» non vuol dire «già visto» ─────────────────────────────
  // Il rimedio a quel difetto era accendere i livelli d'ufficio: k ≤ tappa →
  // `on` + `seen`, senza tratto. Solo che mentre la sequenza gira il lettore
  // guarda il PLASTICO, e la vignetta è nascosta: quei livelli si accendevano
  // dietro un sipario. Chi risaliva trovava un disegno finito senza aver mai
  // visto una linea comparire — la stessa vignetta che, in apertura, si era
  // presentata disegnandosi.
  //
  // Ora la regola è quella di tutte le altre vignette della pagina (l'intro
  // hotspot, la fragilità): OGNI gruppo si disegna la prima volta che il
  // lettore lo vede, e da lì in poi è solo acceso. «Vedere» è la congiunzione
  // di due cose — la vignetta è in quadro e il plastico non le sta davanti —
  // così il tratto non si consuma mai a sipario chiuso. I gruppi arrivati
  // insieme partono insieme: è lo stesso gesto unico dell'apertura, non una
  // seconda sequenza a tappe.
  useEffect(() => {
    const fig = figureRef.current;
    if (!fig || !entered) return undefined;

    // I gruppi per chiave. Più nodi possono condividere la stessa tappa (i
    // livelli 5 e 6 sono disegnati in due pezzi lontani nell'SVG) e devono
    // disegnarsi insieme, quindi la chiave raccoglie, non seleziona.
    const groups = new Map();
    const base = fig.querySelector(".base");
    if (base) groups.set("base", [base]);
    Array.from(fig.querySelectorAll(".layer")).forEach((layer) => {
      const k = Number(layer.dataset.layer);
      if (!Number.isFinite(k)) return;
      const nodes = groups.get(k);
      if (nodes) nodes.push(layer);
      else groups.set(k, [layer]);
    });

    const watched = !engaged && figureInView;
    const drawnKeys = drawnKeysRef.current;
    const fresh = [];

    groups.forEach((nodes, key) => {
      // Il fondale non appartiene a nessuna tappa: c'è da sempre.
      if (!(key === "base" || key <= step)) {
        nodes.forEach((node) => node.classList.remove("draw", "on", "seen"));
        return;
      }
      if (drawnKeys.has(key)) {
        // Già visto disegnarsi: si accende e basta. Rifargli il tratto a ogni
        // ritorno sarebbe un'animazione che nessuno ha chiesto.
        nodes.forEach((node) => {
          node.classList.remove("draw");
          node.classList.add("on", "seen");
        });
        return;
      }
      if (!watched) {
        // Nessuno sta guardando: si resta all'inchiostro nascosto e il tratto
        // aspetta il suo momento. È l'unico posto in cui questa scena sceglie
        // di NON mostrare qualcosa che potrebbe mostrare.
        nodes.forEach((node) => node.classList.remove("draw", "on", "seen"));
        return;
      }
      drawnKeys.add(key);
      nodes.forEach((node) => node.classList.remove("seen"));
      fresh.push(...nodes);
    });

    if (!fresh.length) return undefined;
    // Un fotogramma con l'inchiostro nascosto, poi si lascia correre il tratto:
    // senza il primo, il browser accorpa i due stati e non si vede disegnare.
    fresh.forEach((node) => node.classList.add("draw"));
    const frame = requestAnimationFrame(() => fresh.forEach((node) => node.classList.add("on")));
    const timer = window.setTimeout(() => {
      fresh.forEach((node) => { node.classList.remove("draw"); node.classList.add("seen"); });
    }, VIGNETTE_DRAW_MS);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [entered, engaged, figureInView, step]);

  // Scroll drives engagement, l'avanzamento dentro l'hold e l'uscita. Il
  // montaggio resta a timer per chi sta fermo a guardare; chi invece scorre non
  // deve aspettarlo (09 § 9.2): era il motivo principale per cui una scena
  // agganciata «sembrava bloccata». Scorrere oltre l'hold rilascia la scena nel
  // blocco successivo; la sequenza si conclude solo quando la scena è ormai
  // uscita di quadro, non appena il lettore comincia a scorrere.
  useEffect(() => {
    let frame = null;
    const update = () => {
      frame = null;
      const vh = window.innerHeight || 768;
      const readingLine = vh * 0.52;
      const mobileLayout = window.matchMedia("(max-width: 1100px)").matches;

      const sectionRect = explainerRef.current?.getBoundingClientRect();
      const introHoldRect = introHoldRef.current?.getBoundingClientRect();
      const holdRect = holdRef.current?.getBoundingClientRect();
      const inScene = Boolean(sectionRect) && sectionRect.top < vh && sectionRect.bottom > 0;
      const entranceLine = mobileLayout ? 0.78 : 0.64;
      const nextEntered = inScene && sectionRect.top <= vh * entranceLine;
      const nextEngaged =
        inScene && Boolean(introHoldRect) && introHoldRect.top <= readingLine;

      // ── Scorrere ACCELERA, non salta ───────────────────────────────────
      // Prima lo scorrimento portava la sequenza dove diceva la posizione:
      // una scorsa decisa e ci si ritrovava sul rifugio finito, senza aver
      // visto arrivare niente. E arrivati in fondo all'hold la scena veniva
      // conclusa d'ufficio. Il risultato è che chi scorre — cioè quasi tutti —
      // non vedeva mai la costruzione, che è l'unica cosa che questa scena ha
      // da dire.
      //
      // Ora una scorsa vale una SPINTA: manda avanti di UNA tappa, e non più
      // di una ogni due terzi di secondo. Chi ha fretta accorcia le attese e
      // vede comunque ogni pezzo arrivare; chi sta fermo guarda il timer fare
      // il suo lavoro. Nessuno dei due salta la fine.
      //
      // ── Ma il lettore deve comunque poter riprendere in mano la scena ──
      // Consumato tutto lo spazio agganciato, la sequenza passa a lui: le
      // frecce si accendono sulla tappa a cui è arrivato. Senza questo,
      // togliendo il salto alla fine si era tolta anche l'unica maniera di
      // rivedere le tappe, e chi scorreva restava con una scena muta.
      if (Boolean(holdRect) && holdRect.bottom <= readingLine) setScrolledPast(true);
      // Quando invece la sezione se n'è andata del tutto, si conclude davvero:
      // lì il salto non lo vede nessuno, e risalendo si ritrova tutto a posto.
      const leftBehind = Boolean(sectionRect) && sectionRect.bottom < vh * 0.3;
      if (leftBehind && !completeRef.current) forceComplete();

      const scrollAccelerationReady =
        performance.now() >= scrollAccelerationUnlockAtRef.current;
      if (nextEngaged && scrollAccelerationReady && holdRect && !completeRef.current) {
        // Quanto dell'hold è già passato sotto il bordo alto del viewport. Lo
        // spazio agganciato è esattamente l'altezza dell'hold: quando il suo
        // bordo superiore entra dal basso la scena si è appena fissata (0), e
        // quando ha percorso tutta la propria altezza la scena si stacca (1).
        const travelled = (vh - holdRect.top) / Math.max(1, holdRect.height);
        const progress = Math.min(1, Math.max(0, travelled));
        // `floor` lascia una zona morta naturale sulla prima tappa: il primo
        // ottavo di hold non scavalca l'attesa iniziale, e il disegno di
        // apertura fa in tempo a farsi vedere.
        const askedByScroll = Math.min(
          rifugioSteps.length - 1,
          Math.floor(progress * rifugioSteps.length),
        );
        const nowMs = performance.now();
        if (
          askedByScroll > activeIndexRef.current &&
          nowMs - lastNudgeAtRef.current >= SCROLL_NUDGE_COOLDOWN_MS
        ) {
          lastNudgeAtRef.current = nowMs;
          advanceTo(activeIndexRef.current + 1);
        }
      }

      // ── Il plastico se ne va appena la sezione se ne va ───────────────────
      // C'è stata una versione con una fascia morta larga: il modello restava
      // montato per un paio di schermate oltre la sezione, così chi tornava
      // indietro non ne pagava la ricostruzione. Sulla carta è il compromesso
      // giusto, in pagina no: subito sotto c'è la mappa dei rifugi, e quella
      // fascia morta significa tenere in vita diecimila poligoni SVG e una
      // dozzina di animazioni senza fine proprio mentre si scorre una mappa.
      // La mappa ne usciva impastata, e la mappa la si guarda molto più a lungo
      // di quanto si torni indietro a rivedere una tappa.
      //
      // Quindi si smonta appena la sezione esce dal quadro. Le due soglie non
      // coincidono comunque — un decimo di schermata di scarto — perché una
      // soglia sola farebbe montare e smontare a ripetizione a chi si ferma
      // proprio sul bordo; ma è una banda contro il tremolio, non una riserva.
      if (sectionRect) {
        const arriving = sectionRect.top < vh * 1.2 && sectionRect.bottom > vh * .1;
        const goneForGood = sectionRect.top > vh * 1.5 || sectionRect.bottom < -vh * .1;
        setNearby((mounted) => (mounted ? !goneForGood : arriving));
      }
      setEngaged(nextEngaged);
      if (nextEntered) setEntered(true);
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
  }, [advanceTo, forceComplete, completeRef]);

  return (
    <div
      ref={explainerRef}
      className={`relief-explainer${entered ? " relief-explainer--entered" : ""}${engaged ? " relief-explainer--engaged" : ""}`}
      data-step={step}
    >
      {/* Sticky stage: figure + swapping text pin together while the scene plays. */}
      <div className="relief-explainer-stage">
        <div className="relief-explainer-inner">
          {/* L'apertura è il primo assetto della stessa scena. Quando comincia la
              sequenza, testo introduttivo e titolo cedono spazio alla figura e
              alla colonna delle tappe, senza rimontare o duplicare l'SVG. */}
          <div className="relief-intro-heading">
            <h2 id="relief-title" className="relief-title">
              {reliefHeader.title}
            </h2>
          </div>

          <div className="relief-intro-copy">
            <p className="relief-lead">
              {reliefHeader.lead.before}
              <strong>
                <GlossaryTerm id="rifugio-climatico" onOpen={onGlossary}>
                  {reliefHeader.lead.term}
                </GlossaryTerm>
              </strong>
              {reliefHeader.lead.after}
            </p>
            {reliefHeader.body.map((paragraph, index) => (
              <p key={index} className="relief-body">
                {paragraph}
              </p>
            ))}
            <p className="relief-thesis">{reliefHeader.close}</p>
          </div>

          {/* ── Figure column: l'apertura, poi il plastico, poi la ricetta ──
              L'apertura resta la VIGNETTA piatta: è un'illustrazione ferma
              accanto a un testo che si legge, ed è il registro giusto per
              presentare l'idea. Quando parte la sequenza il disegno diventa il
              modello tridimensionale, che è il registro giusto per guardarla
              costruirsi e per girarci intorno. Il passaggio da uno all'altro è
              una dissolvenza sulla stessa scena, non un cambio di scena.

              Il plastico si monta appena la sezione entra in quadro, non quando
              serve: costruirlo costa un centinaio di millisecondi, e pagarli
              nell'istante in cui la sequenza comincia si vedrebbe. */}
          <div className="relief-figure-stage">
            <div className="relief-figure-frame">
              <figure
                ref={figureRef}
                className="relief-figure"
                data-motion="story"
                aria-hidden={engaged ? "true" : undefined}
                aria-label={engaged ? undefined : rifugioFigureLabel}
                dangerouslySetInnerHTML={RIFUGIO_HTML}
              />
              {nearby ? (
                <RifugioModel3D
                  step={step}
                  label={rifugioFigureLabel}
                  idle={!engaged || !settled}
                />
              ) : null}
            </div>
            {/* Cumulative recipe: what the refuge is made of, so far. Una riga
                sola, non sei pillole: la sintesi del capitolo si legge come una
                formula, e l'ingrediente appena aggiunto si accende (09 § 9.4). */}
            <div
              className={`relief-recipe${
                step === rifugioSteps.length - 1 ? " relief-recipe--complete" : ""
              }`}
              aria-hidden="true"
            >
              <span className="relief-recipe-label">{rifugioRecipeLabel}</span>
              <ul className="relief-recipe-list">
                {RECIPE.map((r) => (
                  <li
                    key={r.piece}
                    className={`relief-recipe-item${
                      entered && step >= r.from ? " relief-recipe-item--on" : ""
                    }${entered && step === r.from ? " relief-recipe-item--now" : ""}`}
                  >
                    {/* La parola sta in uno span suo perché il punto separatore
                        è un ::before del <li>: senza, il filetto dell'ultimo
                        arrivato si prendeva dentro anche il punto che lo
                        precede. */}
                    <span className="relief-recipe-word">{r.piece}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* ── Text column: the active step's copy, swapping in sync with the
              build, plus the stepper (dots while playing, arrows once done) ── */}
          <div
            className={`relief-explainer-text${
              canStep ? "" : " relief-explainer-text--playing"
            }`}
          >
            <div className="relief-seq-body" data-motion="story">
              {rifugioSteps.map((s, i) => {
                const state =
                  i === textIndex
                    ? "is-active"
                    : i < textIndex
                      ? "is-past"
                      : "is-future";
                return (
                  <div
                    key={s.id}
                    className={`relief-seq-step ${state}`}
                    aria-hidden={i === textIndex ? undefined : "true"}
                  >
                    {/* `tone` decide come si legge: "key" è la riga chiave di
                        una tappa che aggiunge un pezzo (grande, si prende in un
                        secondo, poi l'occhio va al disegno); "prose" è la sola
                        tappa finale, che tira la somma a sequenza conclusa. */}
                    <div className={`relief-seq-card relief-seq-card--${s.tone ?? "prose"}`}>
                      <span className="relief-step-label">{s.added}</span>
                      {s.paragraphs.map((p, j) => (
                        <p key={j} className="relief-seq-text">
                          {p}
                        </p>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <SequenceStepper
              variant="light"
              count={rifugioSteps.length}
              revealed={revealed}
              activeIndex={activeIndex}
              complete={canStep}
              stepMs={READ_MS}
              onPrev={goPrev}
              onNext={goNext}
              captionPlaying={rifugioSequenceCaptions.playing}
              captionDone={rifugioSequenceCaptions.done}
              prevLabel={rifugioSequenceCaptions.prev}
              nextLabel={rifugioSequenceCaptions.next}
            />
            {/* Montato solo a sequenza conclusa: i due impulsi partono nel
                momento in cui servono, cioè quando la scena ha finito di
                raccontarsi e il lettore non sa se può andare (01 § 1.4). */}
            {canStep ? <ScrollCue variant="light" className="relief-seq-cue" /> : null}
          </div>
        </div>
      </div>

      {/* Primo tratto di scorrimento: lascia leggere l'apertura mentre la stessa
          vignetta rimane in quadro, prima che cominci a costruirsi. */}
      <div ref={introHoldRef} className="relief-explainer-intro-hold" aria-hidden="true" />

      {/* Secondo tratto: pilota la costruzione e poi rilascia la scena. */}
      <div ref={holdRef} className="relief-explainer-hold" aria-hidden="true" />
    </div>
  );
}

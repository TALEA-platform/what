import { useEffect, useMemo, useRef, useState } from "react";
import { CHAPTERS } from "../../data/chapters";
import { BRANCH_WIDTH, branchLeaves, branchPath, branchX } from "../../lib/branch";

/**
 * Lo stelo — l'avanzamento della lettura, sul bordo sinistro.
 *
 * Una talea è un ramo tagliato che, piantato, mette radici e diventa pianta.
 * Qui la si prende alla lettera: in cima c'è il taglio, e da lì il ramo cresce
 * mentre si scorre. Parte legnoso e ambrato nei capitoli del caldo, mette
 * foglie, vira al verde dove la storia gira verso il sollievo, e arriva
 * fiorito alla chiusura. Ogni capitolo è un fiore: bocciolo finché è lontano,
 * si apre in avvicinamento, giallo quello in cui ci si trova.
 *
 * Perché non basta una linea: una linea sottile, per quanto colorata, si perde
 * sopra una mappa scura o una banda verde. Un ramo disegnato — con l'alone che
 * lo stacca da qualsiasi fondo — si vede sempre, ed è l'unico elemento
 * memorabile che questa pagina si concede.
 *
 * Come funziona: l'avanzamento viaggia su una variabile CSS (`--stem-p`, 0→1)
 * scritta dentro un rAF, e la comparsa delle foglie è espressa in CSS come
 * funzione di quella variabile. La fioritura no: quella è un'animazione vera,
 * accesa da una classe, perché deve vedersi anche quando si arriva al capitolo
 * con un salto. React si risveglia solo quando cambia il capitolo attivo o il
 * numero di fiori aperti — poche volte in tutta la pagina.
 */

/** Il moncone sempre visibile sotto il taglio: la talea è già piantata. */
const MIN_GROWTH = 0.018;

/**
 * Quanto prima della sua sezione un fiore comincia ad aprirsi (frazione della
 * pagina, ~una schermata). Il fiore dev'essere già aperto quando si entra nel
 * capitolo: chi clicca un fiore per tornare indietro atterra sull'inizio della
 * sezione, e vedersi richiudere in un bocciolo il fiore del capitolo in cui si
 * è appena entrati è la cosa più confusa che possa fare questo indicatore.
 */
const BLOOM_LEAD = 0.022;

/**
 * Quanto dura la crescita quando si salta a un capitolo cliccando un fiore.
 * Un salto secco tradirebbe la metafora: il ramo deve *arrivarci*, crescendo
 * verso il basso o ritirandosi verso l'alto, e i fiori sbocciano (o si
 * richiudono) man mano che li tocca. Il tempo cresce con la distanza, entro
 * limiti: un salto corto non deve sembrare lento, uno lungo non deve
 * sembrare eterno.
 */
const GROWTH_TWEEN_MIN = 520;
const GROWTH_TWEEN_MAX = 1400;

// Posizioni di ripiego finché non si è misurato: equidistanti, mai vuote.
const EVEN_SPREAD = CHAPTERS.map((chapter, i) => ({
  ...chapter,
  at: CHAPTERS.length > 1 ? i / (CHAPTERS.length - 1) : 0,
}));

/** Petali un po' storti: cinque, a distanze e angoli non regolari. */
const PETALS = [
  { a: 0, r: 3.9 },
  { a: 70, r: 4.1 },
  { a: 146, r: 3.7 },
  { a: 214, r: 4.0 },
  { a: 289, r: 3.8 },
];

function Flower({ node, index, open, active }) {
  return (
    <g
      className={`stem-flower${open ? " is-open" : ""}${active ? " is-active" : ""}`}
      // --at non serve più alla fioritura (è un'animazione), ma serve ancora al
      // colore: dice al CSS a che altezza della storia sta questo fiore.
      style={{ "--at": node.at }}
      transform={`translate(${node.x.toFixed(2)} ${node.y.toFixed(2)})`}
    >
      {/* Bocciolo: c'è finché il capitolo è lontano. */}
      <circle className="stem-flower-bud" r="2.6" />
      <g className="stem-flower-petals">
        {PETALS.map((p, i) => (
          // Un <g> per petalo: la rotazione sta qui, così l'animazione può
          // usare il transform CSS del petalo senza cancellarla.
          <g
            key={p.a}
            className="stem-petal"
            style={{ "--i": i }}
            transform={`rotate(${p.a + index * 13})`}
          >
            <ellipse rx="4.1" ry="2.8" cx={p.r} cy="0" />
          </g>
        ))}
        <circle className="stem-flower-heart" r="2" />
      </g>
    </g>
  );
}

export function ScrollStem() {
  const rootRef = useRef(null);
  const growRef = useRef(null);
  const tipRef = useRef(null);
  const lengthRef = useRef(0);

  // Crescita in corso verso un capitolo scelto: { from, start, dur }.
  const tweenRef = useRef(null);

  const [height, setHeight] = useState(0);
  const [nodes, setNodes] = useState(EVEN_SPREAD);
  const [active, setActive] = useState(0);
  const [openCount, setOpenCount] = useState(0);
  const nodesRef = useRef(EVEN_SPREAD);

  const path = useMemo(() => branchPath(height), [height]);
  const leaves = useMemo(
    () => branchLeaves(height, nodes.map((n) => n.at)),
    [height, nodes],
  );
  const placed = useMemo(
    () => nodes.map((n) => ({ ...n, x: branchX(n.at), y: n.at * height })),
    [nodes, height],
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    let frame = null;
    let lastAria = -1;

    // Posizione di ogni capitolo come frazione (0→1) dello scroll totale, più
    // l'altezza del ramo. Vanno rimisurate quando il layout cambia: mappe e
    // immagini arrivano dopo il primo render e spostano tutto quello che sta
    // sotto.
    const measure = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      setHeight(Math.round(root.clientHeight));
      if (scrollable <= 0) return;

      const next = CHAPTERS.map((chapter, i) => {
        const el = document.querySelector(chapter.selector);
        if (!el) return nodesRef.current[i];
        const top = el.getBoundingClientRect().top + window.scrollY;
        const at = Math.min(1, Math.max(0, top / scrollable + (chapter.nudge ?? 0)));
        return { ...chapter, at };
      });

      const moved = next.some((n, i) => Math.abs(n.at - nodesRef.current[i].at) > 0.002);
      if (!moved) return;
      nodesRef.current = next;
      setNodes(next);
    };

    const update = () => {
      frame = null;
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      const p = scrollable > 0 ? Math.min(1, Math.max(0, doc.scrollTop / scrollable)) : 0;

      // Il ramo si scopre da sé: il tratto cresciuto è quello non tratteggiato.
      // Un moncone minimo c'è sempre: la talea è già piantata quando la storia
      // comincia, e in cima al video dell'hero serve qualcosa di solido da cui
      // far partire la crescita.
      const target = Math.max(p, MIN_GROWTH);

      // Normalmente il ramo segue lo scroll uno a uno. Dopo un click su un
      // fiore, invece, ci arriva crescendo: si insegue il bersaglio con una
      // decelerazione, e finché dura ci si tiene le frazioni di frame da sé
      // (nessun evento di scroll le darebbe).
      let grown = target;
      const tween = tweenRef.current;
      if (tween) {
        const now = performance.now();
        if (!tween.start) tween.start = now;
        const t = Math.min(1, (now - tween.start) / tween.dur);
        const eased = 1 - Math.pow(1 - t, 3);
        grown = tween.from + (target - tween.from) * eased;
        if (t >= 1) tweenRef.current = null;
        else requestUpdate();
      }

      // Le foglie leggono la crescita, non lo scroll: durante un salto devono
      // spuntare mentre il ramo passa, non tutte insieme.
      root.style.setProperty("--stem-p", grown.toFixed(4));

      const len = lengthRef.current;
      if (growRef.current && len > 0) {
        growRef.current.style.strokeDashoffset = String(len * (1 - grown));
        if (tipRef.current) {
          const tip = growRef.current.getPointAtLength(len * grown);
          tipRef.current.setAttribute("cx", tip.x.toFixed(2));
          tipRef.current.setAttribute("cy", tip.y.toFixed(2));
        }
      }

      const pct = Math.round(p * 100);
      if (pct !== lastAria) {
        lastAria = pct;
        root.setAttribute("aria-valuenow", String(pct));
      }

      // Capitolo corrente = l'ultimo il cui inizio è già passato sopra la linea
      // di lettura (mezza schermata), non il bordo alto: un capitolo "vale"
      // quando lo si sta leggendo, non quando spunta.
      const reading =
        scrollable > 0 ? (doc.scrollTop + doc.clientHeight * 0.5) / scrollable : 0;
      let current = 0;
      nodesRef.current.forEach((node, i) => {
        if (reading >= node.at) current = i;
      });
      setActive((prev) => (prev === current ? prev : current));

      // Quanti fiori sono sbocciati. È un contatore e non un valore continuo
      // perché la fioritura dev'essere un'ANIMAZIONE: parte quando il fiore
      // passa la soglia, e si vede anche quando ci si arriva con un salto
      // (cliccando un fiore per tornare indietro), dove un valore agganciato
      // allo scroll salterebbe da bocciolo a fiore senza nulla in mezzo.
      // Si conta su `grown`, non su `p`: durante la crescita verso un capitolo
      // scelto i fiori si aprono man mano che il ramo li tocca, invece di
      // spalancarsi tutti insieme prima che il ramo ci arrivi.
      let opened = 0;
      nodesRef.current.forEach((node) => {
        if (grown >= node.at - BLOOM_LEAD) opened += 1;
      });
      setOpenCount((prev) => (prev === opened ? prev : opened));
    };

    const requestUpdate = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };

    const remeasure = () => {
      measure();
      requestUpdate();
    };

    remeasure();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", remeasure, { passive: true });

    // Il documento cresce mentre le scene si montano: senza questo i fiori
    // resterebbero schiacciati in cima.
    const observer = new ResizeObserver(remeasure);
    observer.observe(document.body);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", remeasure);
      observer.disconnect();
    };
  }, []);

  // La lunghezza del tracciato cambia con l'altezza del viewport: va ripresa
  // dopo ogni ridisegno, altrimenti la crescita si ferma a metà o straborda.
  useEffect(() => {
    if (!growRef.current || !path) return;
    const len = growRef.current.getTotalLength();
    lengthRef.current = len;
    growRef.current.style.strokeDasharray = String(len);
    const p = Number(rootRef.current?.style.getPropertyValue("--stem-p") || 0);
    growRef.current.style.strokeDashoffset = String(len * (1 - Math.max(p, MIN_GROWTH)));
  }, [path]);

  const goTo = (selector) => {
    const el = document.querySelector(selector);
    if (!el) return;
    const doc = document.documentElement;
    const scrollable = doc.scrollHeight - doc.clientHeight;
    const from = scrollable > 0 ? Math.max(doc.scrollTop / scrollable, MIN_GROWTH) : MIN_GROWTH;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const to = scrollable > 0 ? Math.max(top / scrollable, MIN_GROWTH) : MIN_GROWTH;

    // La pagina ci va subito; il ramo ci arriva crescendo (o ritirandosi, se il
    // capitolo scelto sta più in alto).
    // `start` lo mette il primo frame: qui siamo nel corpo del componente, e
    // leggere l'orologio durante il render non si fa.
    tweenRef.current = {
      from,
      start: 0,
      dur: Math.min(
        GROWTH_TWEEN_MAX,
        GROWTH_TWEEN_MIN + 1000 * Math.abs(to - from),
      ),
    };

    // `html { scroll-behavior: smooth }` è attivo: per arrivare dove vogliamo
    // davvero, senza inseguire un'animazione, ci si posiziona in modo secco.
    window.scrollTo({ top, behavior: "instant" });
  };

  return (
    <div
      ref={rootRef}
      className="scroll-stem"
      role="progressbar"
      aria-valuenow={0}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Avanzamento lettura"
    >
      {/* Su mobile il ramo non ci sta: resta la barra in alto, stesso colore,
          stesso significato. */}
      <div className="scroll-stem-bar" aria-hidden="true" />

      {height > 0 ? (
        <svg
          className="scroll-stem-svg"
          width={BRANCH_WIDTH}
          height={height}
          viewBox={`0 0 ${BRANCH_WIDTH} ${height}`}
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            {/* userSpaceOnUse: il colore dipende dall'altezza nella storia, non
                dal riquadro del singolo elemento. Così ramo, foglie e fiori
                sono d'accordo fra loro senza doverlo calcolare tre volte. */}
            <linearGradient
              id="stem-ink"
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="0"
              x2="0"
              y2={height}
            >
              <stop offset="0" style={{ stopColor: "var(--amber)" }} />
              <stop offset="0.36" style={{ stopColor: "var(--amber)" }} />
              <stop offset="0.66" style={{ stopColor: "var(--talea-green)" }} />
              {/* Si ferma sul verde TALEA e non sul verde scuro: la chiusura
                  della storia è una banda verde scura, e un ramo verde scuro
                  lì dentro sparirebbe lasciando in vista solo il suo alone. */}
              <stop offset="1" style={{ stopColor: "var(--talea-green)" }} />
            </linearGradient>
          </defs>

          {/* Il ramo che verrà: appena accennato, ma c'è — il lettore vede che
              la storia continua. */}
          <path className="stem-ghost" d={path} />

          <g className="stem-leaves">
            {leaves.map((leaf) => (
              <g
                key={leaf.key}
                className="stem-leaf"
                style={{ "--at": leaf.at }}
                transform={`translate(${leaf.x.toFixed(2)} ${leaf.y.toFixed(2)}) rotate(${leaf.angle.toFixed(1)}) scale(${leaf.scale})`}
              >
                <path d="M0 0 C2.6 -2.9 7.8 -3.4 10.6 0 C7.8 3.4 2.6 2.9 0 0 Z" />
                <path className="stem-leaf-rib" d="M0.8 0 L9.6 0" />
              </g>
            ))}
          </g>

          <path ref={growRef} className="stem-grow" d={path} />

          {/* Il taglio della talea, in cima: da lì è partito tutto. */}
          <path
            className="stem-cut"
            d={`M${(branchX(0) - 3.4).toFixed(2)} -1.4 L${(branchX(0) + 3.4).toFixed(2)} 1.4`}
          />

          {/* La punta che sta crescendo adesso. */}
          <circle ref={tipRef} className="stem-tip" r="1.7" cx={branchX(0)} cy="0" />

          <g className="stem-flowers">
            {placed.map((node, i) =>
              i === 0 ? null : (
                <Flower
                  key={node.id}
                  node={node}
                  index={i}
                  open={i < openCount}
                  active={i === active}
                />
              ),
            )}
          </g>
        </svg>
      ) : null}

      {/* Zone cliccabili trasparenti sopra i fiori: il disegno resta SVG, la
          navigazione e l'etichetta restano HTML (accessibili, e con un pill di
          testo che in SVG costerebbe misurare il testo a mano). */}
      <div className="scroll-stem-nodes">
        {placed.map((node, i) => (
          <button
            key={node.id}
            type="button"
            className={`scroll-stem-node${i === active ? " is-active" : ""}`}
            style={{ left: `${node.x.toFixed(2)}px`, top: `${node.y.toFixed(2)}px` }}
            onClick={() => goTo(node.selector)}
          >
            <span className="scroll-stem-node-label">{node.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

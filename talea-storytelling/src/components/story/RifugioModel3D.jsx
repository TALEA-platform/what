import { useEffect, useRef, useState } from "react";
import {
  createRifugioModel,
  RIFUGIO_TEMPERATURES,
} from "../../lib/rifugioModel3d";

const TEMP_LEGEND = "TEMPERATURA DELL’ARIA";

// I segni dei comandi sono disegnati, non caratteri tipografici: «‹» e «−»
// cambiano peso e centratura da un font all'altro, e in un cerchio da trenta
// pixel si vede. Il chevron è lo stesso della freccia dello stepper, così i
// comandi del plastico e quelli della sequenza sembrano la stessa famiglia.
const Chevron = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M15 5l-7 7 7 7"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Plus = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M12 6v12M6 12h12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
  </svg>
);

const Minus = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M6 12h12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
  </svg>
);

/**
 * Il plastico girevole della piazza climatica dentro la scena agganciata.
 *
 * È un guscio sottile attorno a `createRifugioModel`: React monta il
 * contenitore e l'<svg> vuoto, il modello ci disegna dentro da sé, e da lì in
 * poi l'unica cosa che passa da React è la tappa. Non c'è nessuno stato del
 * disegno nel VDOM, e non deve entrarci: il modello riscrive migliaia di
 * poligoni per fotogramma mentre lo si gira, e farli passare per il
 * riconciliatore vorrebbe dire ricostruire l'albero a ogni grado.
 *
 * `step` arriva dalla stessa sequenza a tempo che fa scorrere il testo a lato,
 * quindi il modello si costruisce insieme a quello che si sta leggendo.
 */
export function RifugioModel3D({ step = 0, label, idle = false }) {
  const shellRef = useRef(null);
  const modelRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  // Il suggerimento su come si gira sparisce appena il lettore lo fa: è
  // un'istruzione, e un'istruzione già eseguita è solo rumore in pagina.
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return undefined;

    const model = createRifugioModel(shell, { onZoom: setZoom });
    modelRef.current = model;
    // Aggancio di servizio, solo in sviluppo: serve a guardare una tappa
    // qualsiasi senza doverla aspettare dal timer, e a provare rotazione e
    // zoom da console. In produzione non esiste.
    if (import.meta.env?.DEV) window.__rifugio = model;

    // Il plastico si ridisegna solo quando glielo si chiede: se il contenitore
    // cambia misura (rotazione del telefono, barra del browser che rientra)
    // nessuno lo saprebbe, e resterebbe disegnato per la larghezza di prima.
    //
    // ── Ma non a ogni fotogramma ──────────────────────────────────────────
    // Il riquadro cambia larghezza per un secondo intero quando la griglia
    // agganciata si riapre, e un ridisegno completo costa decine di
    // millisecondi: osservare senza freni voleva dire una scena intera di
    // ridisegni accavallati, con la pagina che si piantava. Si aspetta che la
    // misura si sia FERMATA, e si ignora tutto ciò che non cambia di almeno
    // qualche pixel — durante la transizione ci pensa l'SVG, che si adatta da
    // sé al contenitore senza bisogno di ricalcolare la geometria.
    let settle = 0;
    let lastWidth = shell.clientWidth;
    let lastHeight = shell.clientHeight;
    const observer =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(() => {
            window.clearTimeout(settle);
            settle = window.setTimeout(() => {
              const width = shell.clientWidth;
              const height = shell.clientHeight;
              if (
                Math.abs(width - lastWidth) < 4 &&
                Math.abs(height - lastHeight) < 4
              )
                return;
              lastWidth = width;
              lastHeight = height;
              model.refresh();
            }, 180);
          })
        : null;
    observer?.observe(shell);

    const markTouched = () => setTouched(true);
    shell.addEventListener("pointerdown", markTouched, { once: true });

    return () => {
      observer?.disconnect();
      window.clearTimeout(settle);
      shell.removeEventListener("pointerdown", markTouched);
      model.destroy();
      modelRef.current = null;
      if (import.meta.env?.DEV && window.__rifugio === model)
        delete window.__rifugio;
    };
  }, []);

  useEffect(() => {
    modelRef.current?.setStep(step);
  }, [step]);

  const zoomBy = (factor) => {
    modelRef.current?.zoomBy(factor);
    setTouched(true);
  };

  // ── Spostare la vista, senza doverlo indovinare ──────────────────────────
  // Ingrandendo, il plastico cresce attorno al punto che si indica: chi usa il
  // doppio clic o il pizzico si porta già dove vuole. Ma chi preme il tasto +
  // ingrandisce sul centro, e da lì la fermata o il portico restano fuori
  // quadro senza che ci sia un modo evidente di raggiungerli — Maiusc+trascina
  // esiste ma nessuno lo scopre. Le quattro frecce compaiono SOLO da ingranditi,
  // che è l'unico momento in cui hanno un senso: a vista intera non c'è niente
  // da spostare, e sarebbero quattro bottoni morti.
  const zoomed = zoom > 1.02;
  const panBy = (dx, dy) => {
    modelRef.current?.panBy(dx, dy);
    setTouched(true);
  };
  const PAN_STEP = 120;

  const temp =
    RIFUGIO_TEMPERATURES[
      Math.max(0, Math.min(RIFUGIO_TEMPERATURES.length - 1, step))
    ];

  return (
    <div className="rifugio-model3d-holder">
      {/* ── La lettura sta FUORI dal disegno ──────────────────────────────
          Era scritta dentro l'<svg>, nell'angolo del riquadro. Andava bene
          finché il plastico stava fermo: ingrandendo gli cresce sotto e se la
          mangia. Poi è diventata HTML appoggiato sopra al modello, e restava lo
          stesso problema — a zoom alto la piazza le arrivava dietro.

          Adesso ha una riga sua, sopra il riquadro: qualunque cosa faccia il
          plastico, sotto di lei c'è solo il plastico. Non ha niente da
          scansare, non si ingrandisce con la piazza, e prende i caratteri del
          sito invece di rifarli a mano nell'SVG.

          La dicitura si scrive UNA VOLTA, alla prima tappa: da lì in poi si sa
          che cos'è quel numero. Il DOVE («al sole», «sotto gli alberi») resta
          invece a ogni tappa — senza, 34° e 33° sono due numeri qualsiasi
          invece del prima e del dopo di una cosa precisa. */}
      <div className="rifugio-model3d-temp" data-step={step}>
        <span
          className="rifugio-model3d-temp-value"
          style={{ color: temp.tint }}
        >
          {temp.value}
        </span>
        <span className="rifugio-model3d-temp-side">
          {step === 0 ? (
            <span className="rifugio-model3d-temp-legend">{TEMP_LEGEND}</span>
          ) : null}
          <span
            className="rifugio-model3d-temp-where"
            style={{ color: temp.label }}
          >
            {temp.where}
          </span>
        </span>
      </div>

      <div
        ref={shellRef}
        className="rifugio-model3d"
        role="application"
        tabIndex={0}
        data-step={step}
        data-idle={String(idle)}
        aria-label={label}
      >
        {/* Il modello scrive qui dentro. Vuoto di proposito: il markup vero sta
            in RIFUGIO_MODEL_MARKUP, perché è il modello a doverlo conoscere. */}
        <svg
          id="model-svg"
          viewBox="0 0 960 660"
          role="img"
          aria-label={label}
        />
      </div>

      {/* ── I comandi ───────────────────────────────────────────────────────
          A destra sotto il plastico, incolonnati: sulla prima riga la crocera
          per spostarsi e i due dello zoom, sotto il suggerimento su come si
          gira. Comandi sopra e istruzioni sotto è l'ordine in cui si guardano —
          prima cosa si può fare, poi come.

          La crocera occupa il posto anche da non ingrandita (`min-height` sul
          blocco): comparendo non deve spingere in giù la riga della ricetta. */}
      <div className="rifugio-model3d-controls">
        <div className="rifugio-model3d-controls-row">
          <span
            className="rifugio-model3d-pan"
            role="group"
            aria-label="Sposta la vista"
          >
            {zoomed ? (
              <>
                <button
                  type="button"
                  className="rifugio-model3d-btn rifugio-model3d-pan--up"
                  onClick={() => panBy(0, PAN_STEP)}
                  aria-label="Sposta la vista in alto"
                >
                  <Chevron />
                </button>
                <button
                  type="button"
                  className="rifugio-model3d-btn rifugio-model3d-pan--left"
                  onClick={() => panBy(PAN_STEP, 0)}
                  aria-label="Sposta la vista a sinistra"
                >
                  <Chevron />
                </button>
                <button
                  type="button"
                  className="rifugio-model3d-btn rifugio-model3d-pan--right"
                  onClick={() => panBy(-PAN_STEP, 0)}
                  aria-label="Sposta la vista a destra"
                >
                  <Chevron />
                </button>
                <button
                  type="button"
                  className="rifugio-model3d-btn rifugio-model3d-pan--down"
                  onClick={() => panBy(0, -PAN_STEP)}
                  aria-label="Sposta la vista in basso"
                >
                  <Chevron />
                </button>
              </>
            ) : null}
          </span>

          <span className="rifugio-model3d-zoomgroup">
            <button
              type="button"
              className="rifugio-model3d-btn"
              onClick={() => zoomBy(1 / 1.35)}
              disabled={!zoomed}
              aria-label="Allontana la vista"
            >
              <Minus />
            </button>
            <button
              type="button"
              className="rifugio-model3d-btn"
              onClick={() => zoomBy(1.35)}
              disabled={zoom >= 2.38}
              aria-label="Avvicina la vista"
            >
              <Plus />
            </button>
          </span>
        </div>

        <span
          className="rifugio-model3d-hint"
          data-used={String(touched)}
          aria-hidden="true"
        >
          Trascina per girare la piazza · doppio clic per avvicinarti
        </span>
      </div>
    </div>
  );
}

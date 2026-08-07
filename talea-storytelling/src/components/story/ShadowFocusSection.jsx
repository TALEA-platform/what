import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { MapLibreCanvas } from "../maps/MapLibreCanvas";
import { useTimedSequence } from "../../hooks/useTimedSequence";
import {
  CAMERA_MS,
  SCROLL_ACCELERATION_GRACE_MS,
  cameraEasing,
} from "../../lib/motion";
import { SequenceStepper } from "../ui/SequenceStepper";
import { ScrollCue } from "../ui/ScrollCue";
import {
  shadowFocus,
  shadowScene,
  shadowStageReadMs,
  shadowTable,
  shadowFinal,
} from "../../data/shadowFocus";
import { vicoloSvg } from "../../data/shadowVignette";

const bolognaBoundaryUrl = "/data/vectors/bologna_boundary_outline.geojson";

// Identità stabile per l'HTML iniettato: scritto inline (`{{ __html: … }}`)
// React lo confronta per identità, crea un oggetto nuovo a ogni render e
// ri-inietta il markup, cancellando le classi applicate a mano (CONTESTO § 4.2).
const VICOLO_HTML = { __html: vicoloSvg };

// L'orientamento prima della prima frase. È più corto di prima (1800 ms) perché
// la scena non si scopre più da dietro un velo: si apre già sul centro storico,
// e quello che il lettore deve prendere è un'inquadratura, non una rivelazione.
// I tempi di lettura delle due frasi arrivano dai testi (shadowFocus.js).
const START_DELAY = 1200;
const TAIL_MS = 600;
const SCROLL_PLAYBACK_MAX = 4;

// Il tratto va per primo e il colore lo raggiunge, come nelle altre vignette
// della storia.
const COLOR_AFTER_MS = 560;

// I due numeri grandi contano da zero. Il secondo parte dopo: è la sorpresa,
// e una sorpresa che arriva insieme alla premessa non è una sorpresa.
const COUNT_MS = 900;
const COUNT_STAGGER_MS = 250;

/* I due toni con cui la carta marca il centro storico. Sono due perché fanno due
 * mestieri diversi, e lo stesso valore in entrambi non regge:
 *
 * — il PERIMETRO è pieno e spesso, e ci resta. Il giallo del fuoco a opacità 1,
 *   su un fondo scuro e sopra gli arancioni della rampa, a quella larghezza
 *   diventa fluorescente. Serve desaturato: dice la stessa cosa («questo è ciò
 *   che stai guardando», 01 § 1.1) senza l'acidità.
 * — il VELO è il token del sistema, ma steso al 18 %: a quell'opacità non
 *   fluoresce, si legge come luce sulla zona. Smorzarlo anche lì lo spegneva in
 *   un verde-oliva torbido, cioè gli toglieva l'unica cosa che deve fare.
 *
 * Il token pieno resta comunque quello del sistema dove sta già — marcatore di
 * ricerca, rifugio selezionato, quadrato dell'area pilota: tutti su carta
 * chiara, dove il problema non esiste.
 *
 * Il tono del perimetro è anche quello del quadratino della scheda e dello
 * stepper: è ciò che resta a schermo, quindi è lui la stessa affermazione detta
 * in tre posti (05 § 5.5). */
const CENTRO_TONE = "#E0C24B";
const CENTRO_VEIL_TONE = "#FFE604";

// Il colore con cui la mappa marca ogni tappa, non un colore nuovo: il blu in
// fondo alla rampa dell'ombra per la città intera, l'oro con cui si accende
// il cuore del centro quando la seconda scheda lo nomina. Nell'ordine di
// shadowScene.stages.
const STAGE_TONES = ["#1272B7", CENTRO_TONE];

/* Il velo che localizza il centro storico.
 *
 * L'evidenziato pieno era un velo giallo che RESTAVA: localizzava la zona, e
 * poi si portava dietro il dato per tutto il tempo della lettura (dentro il
 * perimetro il rosso vira all'arancio e il blu al verde, proprio dove il colore
 * va confrontato con il resto della città). Il contorno da solo non ha quel
 * difetto ma è più debole nel dire «è QUESTA l'area».
 *
 * Le due cose però non sono simultanee: prima si localizza, poi si legge. Il
 * velo entra insieme al movimento di macchina, tiene mentre la camera si posa
 * sul centro, e si ritira lasciando il perimetro — e i colori veri — a chi
 * legge. Circa 2,7 s dentro i ~5 s della scheda «centro». */
const CENTRO_VEIL_OPACITY = 0.18;
const CENTRO_VEIL_IN_MS = 600;
// Misurato dall'ingresso, non dalla fine di quello: il velo comincia a ritirarsi
// mentre la camera fa gli ultimi metri, così sparisce quando la mappa è ferma.
const CENTRO_VEIL_HOLD_MS = 1500;
const CENTRO_VEIL_OUT_MS = 1100;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Render copy that may be a single string or an array of lines. Each array
 *  entry becomes its own block with a blank-line gap. */
function renderLines(text) {
  const chunks = Array.isArray(text) ? text : [text];
  const lines = chunks.flatMap((chunk) =>
    String(chunk)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  );
  return lines.map((line, index) => (
    <span className={`sf-line${index > 0 ? " sf-line--secondary" : ""}`} key={index}>
      {line}
    </span>
  ));
}

/* ─────────────────────────── La vignetta d'apertura ───────────────────────── */

/** Il vicolo, che non sta accanto al testo ma dietro (07 § 7.4): il lettore si
 *  trova dentro la scena di cui il capitolo parla, e legge nella fessura di
 *  cielo fra le due facciate.
 *
 *  Stessa meccanica delle altre vignette: il tratto si disegna, il colore lo
 *  raggiunge. Una volta sola, nessun loop. Qui però il disegno non è il
 *  soggetto ma l'ambiente, quindi entra piano e non chiede attenzione:
 *  `aria-hidden`, perché quello che dice lo dice anche il testo sopra. */
function ShadowScene() {
  const sceneRef = useRef(null);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return undefined;
    if (prefersReducedMotion()) {
      scene.classList.add("drawn", "colored");
      return undefined;
    }

    const timers = [];
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          io.unobserve(entry.target);
          scene.classList.add("drawn");
          timers.push(
            window.setTimeout(() => scene.classList.add("colored"), COLOR_AFTER_MS),
          );
        });
      },
      { threshold: 0.18 },
    );
    io.observe(scene);
    return () => {
      io.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  return (
    <div
      ref={sceneRef}
      className="sf-intro-scene"
      aria-hidden="true"
      dangerouslySetInnerHTML={VICOLO_HTML}
    />
  );
}

/* ─────────────────────────── La striscia di numeri ────────────────────────── */

/** Un numero che conta da zero fino al suo valore, una volta sola. Il valore di
 *  arrivo è letto da `value_fmt`, non ricalcolato: l'arrotondamento sta nello
 *  script che genera il dato, e rifarlo qui su `value_pct` (già arrotondato a
 *  un decimale) darebbe 16 % dove il dato dice 15 %. */
function CountUp({ target, delay, run }) {
  const end = Number.parseFloat(target);
  const reducedMotion = prefersReducedMotion();
  // `null` = non ha ancora contato, e finché è così mostra già il valore
  // finale. Partire da zero sarebbe più semplice, ma trasformerebbe ogni
  // intoppo (un osservatore che non scatta, il JS in ritardo) in un dato
  // sbagliato a schermo: «0 %» non si legge come un caricamento, si legge
  // come una misura.
  const [shown, setShown] = useState(null);

  useEffect(() => {
    if (!run || !Number.isFinite(end)) return undefined;
    if (reducedMotion) return undefined;
    let frame = null;
    const startTimer = window.setTimeout(() => {
      const t0 = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - t0) / COUNT_MS);
        // Stessa decelerazione delle camere: arriva, non sbatte.
        setShown(end * (1 - Math.pow(1 - t, 3)));
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, delay);
    return () => {
      window.clearTimeout(startTimer);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [run, end, delay, reducedMotion]);

  if (!Number.isFinite(end)) return <>{target}</>;
  // Finché il conteggio non è partito si legge il valore vero; da quando parte
  // si riparte da zero. Lo zero arriva così dal render e non da un `setState`
  // dentro l'effetto, e non c'è un fotogramma in cui il numero finale
  // lampeggia prima di azzerarsi.
  const display = reducedMotion ? end : (shown ?? (run ? 0 : end));
  // Spazio insecabile fra cifra e simbolo: a questa misura un a capo lì in
  // mezzo lascerebbe il segno di percentuale da solo su una riga.
  return <>{`${Math.round(display)}\u00a0%`}</>;
}

/** Rende esplicito il termine di confronto senza creare una seconda tabella. */
function MunicipalComparison({ value }) {
  if (!value?.bologna_fmt) return null;
  return (
    <span className="sf-municipal-compare">
      Media comunale <strong>{value.bologna_fmt}</strong>
    </span>
  );
}

/** Una delle due celle grandi: il numero, cosa misura, e in piccolo dentro che
 *  cosa. Le `note` chiariscono la soglia di ogni misura, ed è lì che «9 estati
 *  su 13» compare come scelta dichiarata invece che come regola (D5). */
function LeadCell({ metric, value, delay, run }) {
  return (
    <div className={`sf-lead-cell sf-lead-cell--${metric.tone}`}>
      <strong className="sf-lead-value tnum">
        <CountUp target={value.value_fmt} delay={delay} run={run} />
      </strong>
      <span className="sf-lead-label">{metric.label}</span>
      <span className="sf-lead-note">{metric.note}</span>
      <MunicipalComparison value={value} />
    </div>
  );
}

function ShadowTable({ values }) {
  const stripRef = useRef(null);
  // Con reduced-motion i numeri sono già scritti: `run` nasce vero, invece di
  // diventarlo dentro un effetto.
  const [run, setRun] = useState(prefersReducedMotion);

  useEffect(() => {
    const el = stripRef.current;
    if (!el || run) return undefined;
    // Scatta quando il bordo alto della striscia ha superato il 78 % del
    // viewport: l'intestazione è entrata, i due numeri sono ancora appena
    // sotto la piega. Con una soglia di visibilità normale i numeri sarebbero
    // già leggibili quando il conteggio parte, e chi legge vedrebbe il valore
    // finale saltare a zero.
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          io.unobserve(entry.target);
          setRun(true);
        });
      },
      { threshold: 0, rootMargin: "0px 0px -22% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [run]);

  const lead = shadowTable.metrics.filter((m) => m.tier === "lead");
  const support = shadowTable.metrics.filter((m) => m.tier === "support");

  return (
    <section
      ref={stripRef}
      className="sf-strip"
      data-motion="story"
      aria-labelledby="shadow-table-title"
    >
      <header className="sf-strip-head">
        <h4 id="shadow-table-title" className="sf-strip-kicker">
          {shadowTable.kicker}
        </h4>
        <p className="sf-strip-scope">{shadowTable.scope}</p>
      </header>

      {/* Le due celle che SONO il paradosso, e fra loro la cerniera.
          «Eppure» sta in mezzo anche nel DOM, non solo a schermo: è la parola
          che lega i due numeri, e letta in coda («80 %… 19 %… eppure») non
          lega più niente. A schermo largo è posizionata in assoluto, quindi
          l'ordine del markup non le costa la posizione. */}
      <div className="sf-strip-lead">
        <LeadCell metric={lead[0]} value={values[lead[0].key]} delay={0} run={run} />
        <span className="sf-strip-hinge">{shadowTable.hinge}</span>
        <LeadCell
          metric={lead[1]}
          value={values[lead[1].key]}
          delay={COUNT_STAGGER_MS}
          run={run}
        />
      </div>

      {/* E le due che lo spiegano: piccole, in linea. */}
      <p className="sf-strip-because">{shadowTable.because}</p>
      <div className="sf-strip-support">
        {support.map((metric, index) => (
          <span
            key={metric.key}
            className={`sf-support-cell sf-support-cell--${metric.tone}`}
          >
            <strong className="sf-support-value tnum">
              <CountUp
                target={values[metric.key].value_fmt}
                delay={(index + 2) * COUNT_STAGGER_MS}
                run={run}
              />
            </strong>
            <span className="sf-support-label">{metric.label}</span>
            <MunicipalComparison value={values[metric.key]} />
          </span>
        ))}
      </div>
    </section>
  );
}

/* ────────────────────────────── La mappa scura ────────────────────────────── */

// Slim shadow GeoJSON derived from the cloned SCI repo (peak-thermal, summer
// mean). Streets and green areas share the schema { k: "s"|"g", s: 0..1 }.
// Rebuild with: node scripts/build_sci_shadow.mjs
const shadowLinesUrl = "/data/shadow-focus/bologna_shadow_lines.geojson";
const centroBoundaryUrl = "/data/shadow-focus/centro_storico.geojson";
const centroAggregatesUrl = "/data/shadow-focus/centro_aggregates.json";

// Shadow fraction → colour. Warm (exposed) → blue (shaded), mirroring the SCI
// RdYlBu reading: low shadow = sun/hot, high shadow = shade/cool.
// LA RAMPA NON SI TOCCA (07, rev. 2): rosso = più sole, blu = più ombra è una
// convenzione che si legge senza legenda.
const shadowColorRamp = [
  "interpolate",
  ["linear"],
  ["coalesce", ["get", "s"], 0],
  0, "#9c2a05",
  0.25, "#e6550d",
  0.45, "#f7c08a",
  0.55, "#9ec4e1",
  0.75, "#1272B7",
  1, "#08306b",
];

/**
 * OpenFreeMap-based dark style — very dark palette so the shadow data on top
 * stays visually dominant.
 */
const darkOpenfreemapStyle = {
  version: 8,
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {
    openmaptiles: {
      type: "vector",
      url: "https://tiles.openfreemap.org/planet",
    },
  },
  layers: [
    // Fondo della carta = l'unico scuro della storia (--ink-deep in theme.css).
    // Non è una scala dati: è scenografia, e quindi segue il sistema.
    { id: "background", type: "background", paint: { "background-color": "#0B2A18" } },
    {
      id: "park",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "park",
      paint: { "fill-color": "#0c1612", "fill-opacity": 0.7 },
    },
    {
      id: "landcover-wood",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "landcover",
      filter: ["==", ["get", "class"], "wood"],
      paint: { "fill-color": "#0d1612", "fill-opacity": 0.55 },
    },
    {
      id: "water",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "water",
      paint: { "fill-color": "#0c1622", "fill-opacity": 0.95 },
    },
    {
      id: "transport-major",
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      filter: ["any",
        ["==", ["get", "class"], "tertiary"],
        ["==", ["get", "class"], "secondary"],
        ["==", ["get", "class"], "primary"],
        ["==", ["get", "class"], "trunk"],
        ["==", ["get", "class"], "motorway"],
      ],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "rgba(58, 68, 64, 0.5)",
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.4, 13, 0.9, 16, 2.0],
      },
    },
    {
      id: "place-label",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "place",
      filter: ["any",
        ["==", ["get", "class"], "city"],
        ["==", ["get", "class"], "town"],
        ["==", ["get", "class"], "suburb"],
      ],
      layout: {
        "text-field": ["get", "name"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 9, 10, 14, 13],
        "text-font": ["Noto Sans Regular"],
        "text-padding": 6,
      },
      paint: {
        "text-color": "rgba(255, 255, 255, 0.42)",
        "text-halo-color": "rgba(0, 0, 0, 0.75)",
        "text-halo-width": 1.6,
      },
    },
  ],
};

/* Streets and green areas (both polygons from SCI) are drawn as fills coloured
   by their shadow fraction.

   La camera (07 § 7.6). `cameraKey` è il nome dell'inquadratura, non l'oggetto:
   un oggetto ricalcolato a ogni render entrerebbe nelle dipendenze dell'effetto
   con un'identità nuova ogni volta, e la mappa rifarebbe la stessa `easeTo` di
   continuo. */
function SceneDarkMap({ cameraKey, engaged, playbackRate }) {
  const [map, setMap] = useState(null);
  const handleReady = useCallback((m) => setMap(m), []);

  // Il centro è il soggetto solo quando la seconda scheda lo nomina.
  const centroProminent = cameraKey === "centro";
  // L'andatura serve al velo per calcolare le sue durate, ma non deve essere una
  // sua dipendenza (vedi l'effetto in fondo).
  const playbackRateRef = useRef(playbackRate);
  useEffect(() => {
    playbackRateRef.current = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    if (!map) return;

    if (!map.getSource("scene-boundary-src")) {
      map.addSource("scene-boundary-src", { type: "geojson", data: bolognaBoundaryUrl });
    }
    if (!map.getLayer("scene-boundary-line")) {
      map.addLayer({
        id: "scene-boundary-line",
        type: "line",
        source: "scene-boundary-src",
        paint: { "line-color": "rgba(255, 255, 255, 0.16)", "line-width": 1.1 },
      });
    }

    if (!map.getSource("scene-shadow-src")) {
      map.addSource("scene-shadow-src", { type: "geojson", data: shadowLinesUrl });
    }
    // Green areas (k = "g")
    if (!map.getLayer("scene-shadow-green-fill")) {
      map.addLayer({
        id: "scene-shadow-green-fill",
        type: "fill",
        source: "scene-shadow-src",
        filter: ["==", ["get", "k"], "g"],
        paint: {
          "fill-color": shadowColorRamp,
          "fill-opacity": 0,
          "fill-opacity-transition": { duration: 800, delay: 100 },
        },
      });
    }
    // Street segments (k = "s") — SCI buffered polygons, rendered as fills
    if (!map.getLayer("scene-shadow-street-fill")) {
      map.addLayer({
        id: "scene-shadow-street-fill",
        type: "fill",
        source: "scene-shadow-src",
        filter: ["==", ["get", "k"], "s"],
        paint: {
          "fill-color": shadowColorRamp,
          "fill-opacity": 0,
          "fill-opacity-transition": { duration: 900, delay: 200 },
        },
      });
    }

    if (!map.getSource("scene-centro-src")) {
      map.addSource("scene-centro-src", { type: "geojson", data: centroBoundaryUrl });
    }
    // Il velo di localizzazione: sta sotto i tre tratti del bordo, e sopra il
    // dato solo per il tempo di dire quale zona guardare (vedi
    // CENTRO_VEIL_OPACITY). Aggiunto per primo perché in MapLibre l'ordine di
    // inserimento è l'ordine di disegno.
    if (!map.getLayer("scene-centro-fill")) {
      map.addLayer({
        id: "scene-centro-fill",
        type: "fill",
        source: "scene-centro-src",
        paint: {
          "fill-color": CENTRO_VEIL_TONE,
          "fill-opacity": 0,
          "fill-opacity-transition": { duration: CENTRO_VEIL_IN_MS },
        },
      });
    }
    // Quello che resta a chi legge è il contorno, che il dato non lo tocca.
    //
    // Perché un contorno regga il confronto con quel velo servono tre tratti,
    // non uno. Un tono caldo su un fondo rosso-arancio — che è quello che il dato
    // disegna dentro e attorno al centro — ha poco contrasto: da solo si legge
    // come una macchia, non come un bordo. La fodera scura in mezzo è il mestiere
    // della cartografia: isola il tratto chiaro da QUALUNQUE fondo, e da lì l'oro
    // torna a leggersi come una linea.
    //   1. alone  — oro largo e sfocato, il «acceso» che aveva il velo;
    //   2. fodera — scura, sotto la linea e più larga, la stacca dal dato;
    //   3. linea  — d'oro e netta, il bordo vero.
    if (!map.getLayer("scene-centro-glow")) {
      map.addLayer({
        id: "scene-centro-glow",
        type: "line",
        source: "scene-centro-src",
        paint: {
          "line-color": CENTRO_TONE,
          "line-width": ["interpolate", ["linear"], ["zoom"], 11, 10, 13.5, 18, 15, 24],
          "line-opacity": 0,
          "line-opacity-transition": { duration: 700 },
          "line-blur": ["interpolate", ["linear"], ["zoom"], 11, 6, 13.5, 11, 15, 15],
        },
      });
    }
    if (!map.getLayer("scene-centro-casing")) {
      map.addLayer({
        id: "scene-centro-casing",
        type: "line",
        source: "scene-centro-src",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          // Non nero: è --ink-deep, lo stesso scuro del fondo della carta.
          "line-color": "#0B2A18",
          "line-width": ["interpolate", ["linear"], ["zoom"], 11, 6, 13.5, 10, 15, 13],
          "line-opacity": 0,
          "line-opacity-transition": { duration: 700 },
        },
      });
    }
    if (!map.getLayer("scene-centro-line")) {
      map.addLayer({
        id: "scene-centro-line",
        type: "line",
        source: "scene-centro-src",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": CENTRO_TONE,
          "line-width": ["interpolate", ["linear"], ["zoom"], 11, 2.6, 13.5, 4.4, 15, 5.6],
          "line-opacity": 0,
          "line-opacity-transition": { duration: 700 },
        },
      });
    }
  }, [map]);

  // Reveal and conceal symmetrically. Reversing above the scene fades the data
  // away, so coming back down replays the reveal.
  useEffect(() => {
    if (!map) return;
    if (map.getLayer("scene-shadow-street-fill")) {
      map.setPaintProperty("scene-shadow-street-fill", "fill-opacity-transition", {
        duration: 900 / playbackRate,
        delay: 200 / playbackRate,
      });
      map.setPaintProperty("scene-shadow-street-fill", "fill-opacity", engaged ? 0.92 : 0);
    }
    if (map.getLayer("scene-shadow-green-fill")) {
      map.setPaintProperty("scene-shadow-green-fill", "fill-opacity-transition", {
        duration: 800 / playbackRate,
        delay: 100 / playbackRate,
      });
      map.setPaintProperty("scene-shadow-green-fill", "fill-opacity", engaged ? 0.82 : 0);
    }
  }, [map, engaged, playbackRate]);

  // Il movimento di macchina in due tempi: parte largo, entra sulla città
  // quando arriva la prima frase e poi si avvicina al centro storico.
  useEffect(() => {
    if (!map) return;
    const camera =
      shadowScene.stages.find((s) => s.id === cameraKey)?.camera ?? shadowScene.opening;
    map.easeTo({
      center: camera.center,
      zoom: camera.zoom,
      duration: prefersReducedMotion() ? 0 : CAMERA_MS / playbackRate,
      easing: cameraEasing,
      essential: true,
    });

    // L'oro dice «questo è ciò che stai guardando» (01 § 1.1), quindi si
    // accende quando la seconda frase nomina il centro storico e non prima.
    // Non c'è più nemmeno l'accenno tenue sulla prima inquadratura: un perimetro
    // già lì, appena visibile, si legge come un'altra linea della carta e toglie
    // alla comparsa tutto il suo effetto. Il centro non esiste finché il testo
    // non lo nomina, e poi arriva in dissolvenza.
    const centroOpacity = {
      "scene-centro-glow": 0.42,
      "scene-centro-casing": 0.88,
      "scene-centro-line": 1,
    };
    Object.entries(centroOpacity).forEach(([layerId, opacity]) => {
      if (!map.getLayer(layerId)) return;
      map.setPaintProperty(layerId, "line-opacity-transition", {
        duration: 700 / playbackRate,
      });
      map.setPaintProperty(layerId, "line-opacity", centroProminent ? opacity : 0);
    });
    // `cameraKey` porta già dentro di sé l'aggancio: vale "opening" finché la
    // scena non è in scena, quindi non serve `engaged` fra le dipendenze — ed
    // è meglio che non ci sia, o la stessa `easeTo` si rigioca da sola.
    // `centroProminent` è ricavato da `cameraKey`: non si muove da solo, sta lì
    // solo perché la regola delle dipendenze non ammette scorciatoie.
  }, [map, cameraKey, centroProminent, playbackRate]);

  /* Il velo, in un effetto suo e non in quello della camera. Là dentro
     dipenderebbe da `playbackRate`, che cambia a ogni quarto di accelerazione
     mentre il lettore scorre: e mentre tutto il resto di quell'effetto è
     idempotente (la stessa `easeTo`, le stesse opacità), una coreografia a tempo
     rigiocata da capo è un velo che lampeggia. Qui l'unica dipendenza è la
     tappa; l'andatura si legge da un ref, quindi cambiarla non ricomincia
     niente. */
  useEffect(() => {
    if (!map || !map.getLayer("scene-centro-fill")) return undefined;
    const rate = playbackRateRef.current;

    // Con reduced-motion il velo non entra affatto: un elemento che compare e se
    // ne va da solo, senza che il lettore possa fermarlo, è esattamente ciò che
    // quella preferenza chiede di non fare — e il perimetro la zona la dice
    // comunque.
    if (!centroProminent || prefersReducedMotion()) {
      map.setPaintProperty("scene-centro-fill", "fill-opacity-transition", {
        duration: CENTRO_VEIL_OUT_MS / rate,
      });
      map.setPaintProperty("scene-centro-fill", "fill-opacity", 0);
      return undefined;
    }

    map.setPaintProperty("scene-centro-fill", "fill-opacity-transition", {
      duration: CENTRO_VEIL_IN_MS / rate,
    });
    map.setPaintProperty("scene-centro-fill", "fill-opacity", CENTRO_VEIL_OPACITY);
    const veilOut = window.setTimeout(() => {
      if (!map.getLayer("scene-centro-fill")) return;
      map.setPaintProperty("scene-centro-fill", "fill-opacity-transition", {
        duration: CENTRO_VEIL_OUT_MS / rate,
      });
      map.setPaintProperty("scene-centro-fill", "fill-opacity", 0);
    }, CENTRO_VEIL_HOLD_MS / rate);
    // Se il lettore torna alla prima scheda mentre il velo è ancora in scena, il
    // ramo `!centroProminent` lo spegne subito: il timer va scaricato, o
    // riaprirebbe un'uscita già fatta.
    return () => window.clearTimeout(veilOut);
  }, [map, centroProminent]);

  return (
    <MapLibreCanvas
      onMapReady={handleReady}
      className="sf-scene-canvas"
      mapStyle={darkOpenfreemapStyle}
      center={shadowScene.opening.center}
      zoom={shadowScene.opening.zoom}
      minZoom={10.4}
      maxZoom={15}
    />
  );
}

/* ───────────────────────────── Main section ───────────────────────────── */

export function ShadowFocusSection() {
  const [aggregates, setAggregates] = useState(null);
  const [engaged, setEngaged] = useState(false);
  const [exitVeil, setExitVeil] = useState(false);
  const [sequenceVisible, setSequenceVisible] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  const sceneRef = useRef(null);
  const holdRef = useRef(null);
  const scrollAccelerationUnlockAtRef = useRef(Infinity);

  const stages = shadowScene.stages;
  const {
    revealed,
    complete,
    activeIndex,
    goTo,
  } = useTimedSequence({
    count: stages.length,
    engaged,
    startDelay: START_DELAY,
    readMs: shadowStageReadMs,
    tailMs: TAIL_MS,
    pickDuringPlay: true,
    playbackRate,
  });

  // Fuori dalla scena la camera resta larga; appena la scena si aggancia entra
  // sulla città. Risalendo si torna all'apertura, così una nuova discesa
  // rigioca l'avvicinamento.
  const cameraKey = engaged ? stages[activeIndex].id : "opening";

  useEffect(() => {
    scrollAccelerationUnlockAtRef.current = engaged
      ? performance.now() + SCROLL_ACCELERATION_GRACE_MS
      : Infinity;
  }, [engaged]);

  useEffect(() => {
    let ignore = false;
    fetch(centroAggregatesUrl).then((r) => r.json())
      .then((d) => { if (!ignore) setAggregates(d); }).catch(() => {});
    return () => { ignore = true; };
  }, []);

  // Scroll drives only engagement, the "hold" that pins the auto-play, and the
  // reversible exit veil — the descriptions themselves play on a timer.
  useEffect(() => {
    let frame = null;
    const update = () => {
      frame = null;
      const vh = window.innerHeight || 768;
      const readingLine = vh * 0.52;
      const sceneRect = sceneRef.current?.getBoundingClientRect();
      const holdRect = holdRef.current?.getBoundingClientRect();
      const inScene = Boolean(sceneRect) && sceneRect.top < vh && sceneRect.bottom > 0;
      const mobileLayout = window.matchMedia("(max-width: 720px)").matches;
      // 07 § 7.10 — l'aggancio arriva prima (era 0,42): la mappa entra mentre
      // l'ultima riga dell'intro è ancora leggibile, invece che dopo mezza
      // schermata di scuro vuoto.
      const revealLine = mobileLayout ? 0.62 : 0.55;
      const nextEngaged = inScene && sceneRect.top <= vh * revealLine;

      const travelled = holdRect
        ? (vh - holdRect.top) / Math.max(1, holdRect.height)
        : 0;
      const holdProgress = Math.min(1, Math.max(0, travelled));
      const scrollRate =
        Math.round((1 + holdProgress * (SCROLL_PLAYBACK_MAX - 1)) * 4) / 4;
      const scrollAccelerationReady =
        performance.now() >= scrollAccelerationUnlockAtRef.current;
      setPlaybackRate(
        nextEngaged && !complete && scrollAccelerationReady ? scrollRate : 1,
      );

      const pastHold = Boolean(holdRect) && holdRect.bottom <= readingLine;

      // The descriptions stay pinned while engaged and still within the hold;
      // they fade out as the reader scrolls on toward the closing text.
      setSequenceVisible(nextEngaged && (!pastHold || !complete));

      // The dark closing veil rises once the reader has scrolled through the hold
      // and the scene's bottom nears the viewport — handing the pinned map into
      // the light aftermath below.
      const nextExitVeil = nextEngaged
        && complete
        && pastHold
        && Boolean(sceneRect)
        && sceneRect.bottom <= vh * 1.15;

      setEngaged(nextEngaged);
      setExitVeil(nextExitVeil);
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
  }, [complete]);

  const values = useMemo(() => {
    if (!aggregates?.metrics) return null;
    return shadowTable.metrics.every((m) => aggregates.metrics[m.key])
      ? aggregates.metrics
      : null;
  }, [aggregates]);

  return (
    <section id="ombra" className="shadow-focus" aria-label="L'ombra a Bologna">
      {/* La vignetta si fonde nella carta; il testo le resta sopra, in
          sovrimpressione, senza diventare una colonna separata. */}
      <div className="sf-intro">
        <ShadowScene />
        <div className="sf-intro-inner">
          <p className="sf-opening">{shadowFocus.opening}</p>
          {/* Il titolo del capitolo. Finora «ombra» era un grassetto in mezzo a
              una frase: la parola che dà il nome alla scena, detta di sfuggita
              (07 § 7.3). */}
          <h3 className="sf-title">{shadowFocus.title}</h3>
          <p className="sf-lead">{shadowFocus.lead}</p>
          <p className="sf-pivot">{shadowFocus.pivot}</p>
        </div>
      </div>

      {/* ── Sticky 100vh dark scene — the descriptions auto-play on the pinned
          map (they no longer scroll), then release into the closing text. ── */}
      <section
        ref={sceneRef}
        className={`sf-scene${engaged ? " sf-scene--engaged" : ""}${exitVeil ? " sf-scene--exiting" : ""}`}
        aria-label="Mappa scura ombra Bologna"
      >
        <div className={`sf-scene-map${engaged ? " sf-scene-map--engaged" : ""}${exitVeil ? " sf-scene-map--exiting" : ""}`}>
          <SceneDarkMap
            cameraKey={cameraKey}
            engaged={engaged}
            playbackRate={playbackRate}
          />
          {/* Vignettatura morbida: il modo più economico per far sembrare una
              mappa un'inquadratura invece che un dato (07 § 7.1). */}
          <div className="sf-scene-frame" aria-hidden="true" />
          {/* Nessun velo d'ingresso: 07 § 7.6 sostituisce il secondo sipario
              con un movimento di macchina. Resta quello d'uscita, che consegna
              la mappa alla chiusura chiara. */}
          <div className="sf-scene-exit-veil" aria-hidden="true" />
          <div className="sf-scene-legend">
            <span className="sf-scene-legend-title">{shadowScene.legend.title}</span>
            <span className="sf-scene-legend-description">{shadowScene.legend.description}</span>
            <span className="sf-scene-legend-bar" />
            <div className="sf-scene-legend-labels">
              <span className="sf-scene-legend-label">{shadowScene.legend.from}</span>
              <span className="sf-scene-legend-label">{shadowScene.legend.to}</span>
            </div>
            <a
              className="sf-scene-legend-link"
              href={shadowScene.legend.sourceLink.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {shadowScene.legend.sourceLink.label} →
            </a>
          </div>

          {/* Le due schede, con lo stesso impianto della scena hotspot.
              Il § 7.6 le voleva diverse: due sottotitoli che si sostituiscono
              al centro in basso, per non ripetere «lo stesso trucco». Provate
              così e tolte, perché quel § confondeva due piani. Il trucco
              ripetuto cinque volte, che il report giustamente contesta, è la
              MESSA IN SCENA — velo che si alza, mappa agganciata, velo che
              cala — e quella qui è già diversa: nessun sipario, e una camera in
              due tempi. Le schede invece sono un'INTERFACCIA: sono il modo in
              cui questa storia mette le parole sopra una mappa, e un modo
              diverso per lo stesso gesto è una cosa in più da imparare, non una
              regia. Di più: in `05` queste schede sono state rifatte da vetro
              scuro a carta, e riscriverle scure qui avrebbe rimesso in pagina
              proprio ciò che quel lavoro aveva tolto. */}
          {engaged && (
            <div
              className={`sf-sequence${sequenceVisible ? " sf-sequence--in" : " sf-sequence--out"}${complete ? " sf-sequence--complete" : ""}`}
              /* La sequenza si racconta da sola: il suo movimento è contenuto. */
              data-motion="story"
            >
              <div className="sf-sequence-stack">
                {stages.map((stage, index) => {
                  const isActive = index === activeIndex;
                  return (
                    <button
                      key={stage.id}
                      type="button"
                      className={`sf-seq-item${isActive ? " is-active" : " is-dim"}`}
                      /* Il quadratino porta il colore con cui la mappa marca
                         quella tappa: il blu della rampa dell'ombra per la
                         città intera, l'oro con cui si accende il centro
                         quando la seconda scheda lo nomina. Non colori nuovi. */
                      style={{ "--tier": STAGE_TONES[index] }}
                      onClick={() => goTo(index)}
                      aria-pressed={isActive}
                    >
                      {renderLines(stage.body)}
                    </button>
                  );
                })}
              </div>

              <div
                className={`sf-sequence-foot${revealed > 0 ? " sf-sequence-foot--live" : ""}`}
              >
                <SequenceStepper
                  count={stages.length}
                  revealed={revealed}
                  activeIndex={activeIndex}
                  complete={complete}
                  captionPlaying={shadowScene.sequence.playing}
                  captionDone={shadowScene.sequence.done}
                  variant="dark"
                  showNavigation={false}
                  stepMs={shadowStageReadMs}
                  playbackRate={playbackRate}
                  tones={STAGE_TONES}
                />
                {complete && (
                  <ScrollCue variant="dark" className="sf-sequence-cue" />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Scroll "hold": while the reader is within this stretch the sequence
            plays on the pinned map; scrolling past it releases into the closing
            text below. */}
        <div className="sf-scene-flow">
          <div ref={holdRef} className="sf-sequence-hold" aria-hidden="true" />
          <div className="sf-scene-buffer" aria-hidden="true" />
        </div>
      </section>

      {/* ── La chiusura, e poi i numeri ──
          Il testo resta sullo scuro, dove la mappa lo consegna: la riga
          «L'ombra c'è. Il calore resta.» arriva meglio sul buio da cui si sta
          uscendo che su una carta già accesa. Il ritorno alla luce sta in una
          fascia sua, di altezza dichiarata, e sotto ci sono i numeri.

          Prima era un solo gradiente a sei fermate su un blocco di altezza
          variabile: quale riga di testo cadesse sulla parte torbida dipendeva
          dalla finestra. */}
      <div className="sf-aftermath">
        <div className="sf-aftermath-inner">
          <p className="sf-final-pivot">{shadowFinal.pivot}</p>
          <p className="sf-final">{shadowFinal.body}</p>
        </div>
      </div>

      <div className="sf-handoff" aria-hidden="true" />

      <div className="sf-numbers">
        <div className="sf-numbers-inner">
          {values && <ShadowTable values={values} />}
        </div>
        <p className="sf-chapter-handoff">{shadowTable.handoff}</p>
        <ScrollCue variant="light" loop className="sf-chapter-cue" />
      </div>
    </section>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { zonesMap } from "../../data/taleaProject";
import {
  BASEMAP_STYLE,
  EXPLORE_ZOOM_LIMITS,
  addOrthophoto,
  lockCamera,
} from "../../data/reliefMaps";

const ZONES = zonesMap.zones;
// Stage 0 = intro (all zones framed); stages 1..N fly to each zone.
const STAGE_COUNT = ZONES.length + 1;
// L'inquadratura mostrata solo finché lo stile non ha caricato: appena la mappa
// è in piedi, `load` la porta subito sull'inquadratura d'apertura (vedi
// `warmOpeningCamera`), perché a quel punto mancano ancora tre schermate di
// scorrimento e sono tessere che possono arrivare con comodo.
const INIT_CAMERA = { center: [11.362, 44.4975], zoom: 11.4 };
// La discesa d'apertura. Prima la mappa arrivava già inquadrata, perché il primo
// `applyStage` era a durata zero: il lettore alzava gli occhi da una frase e
// trovava una fotografia ferma, senza nessun segnale che quella cosa fosse viva.
const OPEN_DURATION = 2600;
// Quanto sta più in alto la camera d'attesa rispetto all'inquadratura
// d'apertura. Erano due tacche e mezzo (zoom 11.4 contro ~13.5): una discesa
// così attraversa tre livelli di tessere dell'ortofoto, e siccome le tessere si
// chiedono mentre la camera scende, il velo si apriva su una fotografia sfocata
// che si metteva a fuoco a pezzi. Tre quarti di tacca è una discesa che si vede
// lo stesso, ma che parte e arriva su tessere già in cache.
const OPEN_PULLBACK = 0.75;
// ── Quando si apre e quando si chiude, in altezze di schermata ───────────────
// `PIN_AT`: il pannello sticky è agganciato in cima (0.04 è solo il margine che
// evita lo sfarfallio sullo zero esatto). È l'istante in cui lo schermo è tutto
// bianco, ed è da lì che comincia l'iride.
// `OPEN_SPAN`: quanto scroll serve perché l'iride sia spalancata.
// `OPEN_FLOOR_MS`: se il lettore si ferma esattamente sull'aggancio l'iride si
// apre lo stesso, a tempo. È un pavimento, non un tempo di apertura: chi scorre
// la apre prima.
const PIN_AT = 0.04;
const OPEN_SPAN = 0.34;
const OPEN_FLOOR_MS = 1500;
// La dissolvenza d'uscita è legata allo scroll, non a un cronometro: comincia
// quando il pannello sticky si sgancia (rect.bottom = 1 schermata) e finisce
// mentre della mappa resta l'ultimo terzo di schermo. Vedi il commento sopra
// `.relief-map-veil-exit` in story.css.
const EXIT_FROM = 1.0;
const EXIT_TO = 0.38;
// Il volo fra una tappa e l'altra, e il ritorno all'inquadratura d'insieme.
// Vedi il commento dentro `applyStage`: 2,8 secondi è il tempo in cui una
// discesa di una tacca e mezza di zoom si legge come una discesa.
const FLIGHT_DURATION = 2800;
const RETURN_DURATION = 2200;
// Parte piano, arriva piano. La camera non "scatta" dal luogo che sta lasciando
// e non si pianta su quello a cui arriva: è la differenza fra un movimento e un
// taglio di montaggio.
const EASE_FLIGHT = (t) =>
  (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
// Risponde dal primo pixel di scorrimento e rallenta verso la fine: il
// contrario di una `ease-in`, che per un decimo della corsa non fa vedere
// niente. È quello che l'iride deve fare.
const easeOpen = (t) => 1 - ((1 - t) ** 2.4);
const smoothstep = (t) => t * t * (3 - 2 * t);
// Il pannello di testo sta a DESTRA, in alto, come quello della mappa degli
// hotspot: la padding della camera lo tiene in conto, altrimenti i cerchi
// finiscono sotto le parole. `right` è la larghezza del pannello più il suo
// margine dal bordo (vedi `.zones-caption` in story.css).
const FIT_PADDING = { top: 110, right: 580, bottom: 120, left: 90 };
const MOBILE_FIT_PADDING = { top: 300, right: 28, bottom: 90, left: 28 };
const AREA_ZOOM_STOPS = [12, 14, 16, 18];
const METRES_PER_PIXEL_AT_ZOOM_ZERO = 156543.03392;
const ZONES_TEXT_HIGHLIGHTS = [
  "Fossolo",
  "nord del centro storico",
  "Bosco Tanari",
  "via Boldrini",
  "via Fratelli Rosselli",
];

function radiusInPixels(radius, latitude, zoom) {
  const metresPerPixel =
    (METRES_PER_PIXEL_AT_ZOOM_ZERO * Math.cos((latitude * Math.PI) / 180)) /
    (2 ** zoom);
  return radius / metresPerPixel;
}

function areaFeature(zone) {
  const radii = Object.fromEntries(
    AREA_ZOOM_STOPS.map((zoom) => [
      `radius${zoom}`,
      radiusInPixels(zone.radius_m, zone.center[1], zoom),
    ]),
  );
  return {
    type: "Feature",
    id: zone.id,
    properties: { id: zone.id, ...radii },
    geometry: { type: "Point", coordinates: zone.center },
  };
}

function highlightedIntroText(text) {
  const pattern = new RegExp(`(${ZONES_TEXT_HIGHLIGHTS.join("|")})`, "gi");
  return text.split(pattern).map((part, index) => {
    const highlighted = ZONES_TEXT_HIGHLIGHTS.some(
      (term) => term.toLocaleLowerCase("it-IT") === part.toLocaleLowerCase("it-IT"),
    );
    return highlighted ? <strong key={`${part}-${index}`}>{part}</strong> : part;
  });
}

const AREAS_FC = {
  type: "FeatureCollection",
  features: ZONES.map(areaFeature),
};
const ACTIVE = (attr) => ["case", ["boolean", ["feature-state", "active"], false], attr[0], attr[1]];
// Da spenta l'area resta leggibile: 0.72 del raggio e non 0.5, e più contrasto
// (vedi `areas-circle`). Nell'inquadratura d'apertura i due cerchi sono l'unica
// cosa che risponde all'etichetta al centro dello schermo, e a mezzo raggio con
// il 7% di riempimento non si vedevano.
const ACTIVE_SCALE = ACTIVE([1, 0.72]);
const AREA_RADIUS = [
  "interpolate",
  ["exponential", 2],
  ["zoom"],
  ...AREA_ZOOM_STOPS.flatMap((zoom) => [
    zoom,
    ["*", ["get", `radius${zoom}`], ACTIVE_SCALE],
  ]),
];

function positionFocusMask(map, zone, element) {
  if (!map || !zone || !element) return;
  const point = map.project(zone.center);
  const radius = radiusInPixels(zone.radius_m, zone.center[1], map.getZoom());
  element.style.setProperty("--zones-focus-x", `${point.x}px`);
  element.style.setProperty("--zones-focus-y", `${point.y}px`);
  element.style.setProperty("--zones-focus-inner", `${Math.max(54, radius * 0.82)}px`);
  element.style.setProperty("--zones-focus-radius", `${Math.max(68, radius)}px`);
  element.style.setProperty("--zones-focus-outer", `${Math.max(104, radius * 1.34)}px`);
}

function cameraPadding() {
  return window.matchMedia("(max-width: 860px)").matches
    ? MOBILE_FIT_PADDING
    : FIT_PADDING;
}

/**
 * Porta la camera dove sta un attimo prima dell'apertura: sull'inquadratura
 * d'apertura, ma tre quarti di tacca più in alto.
 *
 * Si chiama appena lo stile è caricato, cioè circa tre schermate di scorrimento
 * prima che il lettore ci arrivi. In quel tempo l'ortofoto carica le tessere di
 * TUTTE E DUE le inquadrature (prima si passa dalla destinazione, poi si sale),
 * così la discesa d'apertura avviene su tessere già in cache invece che
 * chiederle mentre scende. Prima la camera aspettava a zoom 11.4 e le tessere
 * dei livelli attraversati si chiedevano durante la discesa: il velo si apriva
 * su una fotografia sfocata che si ricomponeva a quadrati.
 */
function warmOpeningCamera(map) {
  const padding = cameraPadding();
  map.fitBounds(zonesMap.intro.bounds, { padding, duration: 0 });
  const target = map.cameraForBounds(zonesMap.intro.bounds, { padding });
  if (!target) return;
  map.jumpTo({
    center: target.center,
    zoom: Math.max(target.zoom - OPEN_PULLBACK, EXPLORE_ZOOM_LIMITS.minZoom),
  });
}

/**
 * Guided ortophoto map of TALEA's two pilot neighbourhoods. The circular marks
 * are intentionally approximate; a slow camera drift keeps each place alive
 * while the reader moves through the three-stage scene.
 */
export function ZonesMapScene() {
  const sectionRef = useRef(null);
  const containerRef = useRef(null);
  const focusMaskRef = useRef(null);
  const mapRef = useRef(null);
  const stepsRef = useRef([]);
  const flownRef = useRef(false);
  const openedRef = useRef(false);
  const activeZoneRef = useRef(null);
  const driftGenerationRef = useRef(0);
  const driftMoveEndRef = useRef(null);
  // Istante in cui il pannello sticky si è agganciato: serve al pavimento a
  // tempo dell'iride (vedi `OPEN_FLOOR_MS`). Zero = non agganciato.
  const openStartRef = useRef(0);

  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [stage, setStage] = useState(0);
  const [engaged, setEngaged] = useState(false);
  const [exiting, setExiting] = useState(false);

  // Highlight the active area, fly high between places, then keep the ortophoto
  // moving with a slow alternating drift for as long as that stage remains.
  //
  // `opening` è la prima applicazione dopo che il velo si è aperto: la camera
  // scende dall'alto invece di saltare sull'inquadratura buona.
  const applyStage = useCallback((s, animate, opening = false) => {
    const map = mapRef.current;
    if (!map) return;

    driftGenerationRef.current += 1;
    const generation = driftGenerationRef.current;
    if (driftMoveEndRef.current) {
      map.off("moveend", driftMoveEndRef.current);
      driftMoveEndRef.current = null;
    }
    map.stop();

    const zone = s >= 1 ? ZONES[s - 1] : null;
    activeZoneRef.current = zone;
    // Qui c'era un `if (!map.isStyleLoaded()) return;` che copriva TUTTA la
    // funzione, camera compresa. Ma `isStyleLoaded()` resta falso finché ci sono
    // tessere in volo, e le tessere dell'ortofoto arrivano da un servizio
    // esterno: bastava una risposta lenta perché la prima tappa venisse buttata
    // via e la mappa restasse sull'inquadratura d'attesa fino al passo dopo.
    // La camera non ha bisogno dello stile: l'unica cosa che lo richiede è lo
    // stato delle feature, e per quello basta che la sorgente esista.
    if (map.getSource("areas-src")) {
      ZONES.forEach((z) => {
        map.setFeatureState(
          { source: "areas-src", id: z.id },
          { active: z.id === zone?.id },
        );
      });
    }
    positionFocusMask(map, zone, focusMaskRef.current);

    if (s === 0) {
      map.fitBounds(zonesMap.intro.bounds, {
        padding: cameraPadding(),
        duration: opening ? OPEN_DURATION : animate ? RETURN_DURATION : 0,
        // In apertura la frenata è più lunga (quintica): la città arriva da
        // lontano e si ferma dolce, invece di piantarsi.
        easing: opening
          ? (t) => 1 - ((1 - t) ** 5)
          : EASE_FLIGHT,
        essential: true,
      });
      return;
    }

    const startDrift = (direction = 1) => {
      if (driftGenerationRef.current !== generation) return;
      const onDriftEnd = () => {
        driftMoveEndRef.current = null;
        startDrift(direction * -1);
      };
      driftMoveEndRef.current = onDriftEnd;
      map.once("moveend", onDriftEnd);
      map.easeTo({
        center: [
          zone.center[0] + (0.00052 * direction),
          zone.center[1] + (0.00016 * direction),
        ],
        zoom: zone.zoom,
        duration: 14000,
        easing: (t) => t,
        essential: true,
      });
    };

    if (!animate) {
      map.flyTo({
        center: zone.center,
        zoom: zone.zoom,
        duration: 0,
        padding: cameraPadding(),
        essential: true,
      });
      startDrift();
      return;
    }

    const onFlightEnd = () => {
      driftMoveEndRef.current = null;
      startDrift();
    };
    driftMoveEndRef.current = onFlightEnd;
    map.once("moveend", onFlightEnd);
    map.flyTo({
      center: zone.center,
      zoom: zone.zoom,
      padding: cameraPadding(),
      curve: 1.6,
      // ── Perché una durata e non una velocità ─────────────────────────────
      // Qui c'era `speed: 0.6, maxDuration: 6000`. Due difetti, entrambi
      // invisibili leggendo il codice:
      //  · con `speed` la durata la decide la lunghezza del percorso, e per la
      //    prima discesa (dalla città intera al Fossolo) veniva 1,3 secondi: si
      //    scendeva di una tacca e mezza di zoom nel tempo di un battito di
      //    ciglia, e non si capiva dove si era finiti;
      //  · `maxDuration` NON accorcia il volo, lo annulla: in MapLibre, se la
      //    durata calcolata lo supera, `flyTo` mette `duration = 0` e la camera
      //    SALTA. Bastava una schermata stretta o un padding diverso per
      //    trovarsi la seconda tappa senza nessun volo.
      // Con una durata esplicita il tempo è quello per tutte e due le tappe, la
      // curva di van Wijk continua a dare l'arco (si sale, ci si sposta, si
      // scende) e il salto non può più succedere.
      duration: FLIGHT_DURATION,
      easing: EASE_FLIGHT,
      essential: true,
    });
  }, []);

  // Lazy-init the map when the scene approaches the viewport.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return undefined;

    const init = () => {
      if (mapRef.current || !containerRef.current) return;
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: BASEMAP_STYLE,
        center: INIT_CAMERA.center,
        zoom: INIT_CAMERA.zoom,
        minZoom: EXPLORE_ZOOM_LIMITS.minZoom,
        maxZoom: EXPLORE_ZOOM_LIMITS.maxZoom,
        attributionControl: false,
      });
      mapRef.current = map;
      lockCamera(map);
      map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
      map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-right");
      map.on("render", () => {
        positionFocusMask(map, activeZoneRef.current, focusMaskRef.current);
      });

      map.on("load", () => {
        try {
          addOrthophoto(map);
          map.addSource("areas-src", { type: "geojson", data: AREAS_FC });

          map.addLayer({
            id: "areas-circle",
            type: "circle",
            source: "areas-src",
            paint: {
              "circle-radius": AREA_RADIUS,
              "circle-radius-transition": {
                duration: 700,
                delay: 0,
              },
              "circle-color": "#1f9d47",
              "circle-opacity": ACTIVE([0.18, 0.12]),
              "circle-opacity-transition": {
                duration: 450,
                delay: 0,
              },
              "circle-stroke-color": "#FFE604",
              "circle-stroke-width": ACTIVE([2, 1.4]),
              "circle-stroke-opacity": ACTIVE([1, 0.62]),
            },
          });
          warmOpeningCamera(map);
          setReady(true);
        } catch (err) {
          console.warn(err);
          setFailed(true);
        }
      });
    };

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            init();
            window.setTimeout(() => mapRef.current?.resize(), 250);
          }
        });
      },
      { threshold: 0.02 },
    );
    io.observe(section);
    return () => {
      io.disconnect();
      driftGenerationRef.current += 1;
      if (mapRef.current && driftMoveEndRef.current) {
        mapRef.current.off("moveend", driftMoveEndRef.current);
      }
      mapRef.current?.stop();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Apply camera + highlight whenever the stage changes. Re-entering the scene
  // resumes the active place after its off-screen drift has been stopped.
  //
  // La prima applicazione aspetta `engaged`, cioè che il velo si sia aperto.
  // Prima partiva appena la mappa era pronta, che succede molto prima: la
  // discesa d'apertura si consumava dietro il velo e il lettore trovava la
  // scena già ferma.
  useEffect(() => {
    if (!ready) return;

    if (!openedRef.current) {
      if (!engaged) return;
      openedRef.current = true;
      flownRef.current = true;
      applyStage(stage, true, true);
      return;
    }

    if (!engaged && flownRef.current) return;
    applyStage(stage, flownRef.current);
    flownRef.current = true;
  }, [stage, ready, engaged, applyStage]);

  // A repeating 14-second drift must not keep MapLibre rendering after the
  // reader has left the scene.
  useEffect(() => {
    if (!ready || engaged) return;
    const map = mapRef.current;
    if (!map) return;
    driftGenerationRef.current += 1;
    if (driftMoveEndRef.current) {
      map.off("moveend", driftMoveEndRef.current);
      driftMoveEndRef.current = null;
    }
    map.stop();
  }, [ready, engaged]);

  // Reading-line scroll: the step nearest the reading line sets the stage.
  useEffect(() => {
    let frame = null;
    const update = () => {
      frame = null;
      const vh = window.innerHeight || 768;
      // La riga di lettura sta a metà schermo, non in fondo: il pannello che
      // racconta la scena adesso è in alto a destra, e con la riga a 0.82·vh
      // ogni cambio di ambito arrivava con quasi un'intera schermata di
      // ritardo rispetto al punto in cui il lettore guardava.
      const readingLine = vh * 0.55;
      const steps = stepsRef.current.filter(Boolean);

      let next = 0;
      let min = Infinity;
      steps.forEach((el, idx) => {
        const rect = el.getBoundingClientRect();
        const center = rect.top + rect.height * 0.5;
        if (rect.bottom > 0 && rect.top < vh && Math.abs(center - readingLine) < min) {
          min = Math.abs(center - readingLine);
          next = idx;
        }
      });
      const last = steps.at(-1)?.getBoundingClientRect();
      if (min === Infinity && last && last.bottom < readingLine) next = STAGE_COUNT - 1;
      setStage(next);

      const section = sectionRef.current;
      const rect = section?.getBoundingClientRect();
      if (!rect) return;
      const inScene = rect.top < vh && rect.bottom > 0;

      // ── L'uscita ─────────────────────────────────────────────────────────
      // La dissolvenza d'uscita è LEGATA ALLO SCROLL, non a un cronometro.
      // Prima era una classe: superata la soglia partiva una dissolvenza di
      // 620 ms e da lì in poi il lettore aveva ancora tre quarti di schermata
      // da percorrere con la mappa già tutta coperta di bianco. La soglia era
      // per giunta a 1,04 schermate, cioè PRIMA che la mappa cominciasse ad
      // andarsene: si imbiancava una scena ancora ferma e agganciata.
      //
      // Ora comincia esattamente quando il pannello sticky si sgancia
      // (rect.bottom = 1 schermata) e finisce quando della mappa resta l'ultimo
      // terzo di schermo, con sotto già il capitolo successivo: ogni pixel di
      // scorrimento fa succedere qualcosa e non c'è nessun tratto in cui lo
      // schermo è fermo e vuoto. Quello che resta del vuoto lo toglie il
      // margine negativo di `.zones-scene` (story.css), che fa salire il
      // capitolo dopo SOPRA la coda della scena invece che dietro.
      const exitProgress = smoothstep(
        clamp01((vh * EXIT_FROM - rect.bottom) / (vh * (EXIT_FROM - EXIT_TO))),
      );
      section.style.setProperty("--map-exit", exitProgress.toFixed(3));
      const nextExiting = inScene && rect.bottom <= vh * EXIT_FROM;

      // ── L'entrata ────────────────────────────────────────────────────────
      // La scena si apre quando il pannello sticky è AGGANCIATO in cima, non a
      // metà strada: aprire prima vuol dire far partire la rivelazione su una
      // mappa ancora tagliata a metà dalla coda del capitolo precedente.
      // `PIN_AT` è solo il margine che evita lo sfarfallio sullo zero esatto.
      //
      // Da quell'istante l'apertura non è più una dissolvenza a tempo: è
      // un'IRIDE legata allo scorrimento (vedi `.zones-scene .relief-map-veil`
      // in story.css). Il difetto della dissolvenza non era la sua durata, era
      // che cominciava a contare quando lo schermo era già tutto bianco: il
      // lettore restava fermo davanti al niente aspettando un cronometro che
      // non sapeva di aver fatto partire. Un'iride legata allo scroll comincia
      // al primo pixel oltre l'aggancio e si apre quanto il lettore la apre,
      // così l'attesa non esiste più; e il cerchio è la stessa figura con cui
      // questa scena inquadra un luogo (`.zones-focus-mask`), qui al contrario.
      const pinned = inScene && rect.top <= vh * PIN_AT;
      if (!pinned) openStartRef.current = 0;
      else if (!openStartRef.current) openStartRef.current = performance.now();
      const byScroll = clamp01((vh * PIN_AT - rect.top) / (vh * OPEN_SPAN));
      // Il pavimento a tempo: chi si ferma esattamente sull'aggancio vede
      // l'iride aprirsi lo stesso. Chi scorre la apre prima, ed è il caso
      // normale.
      const byTime = openStartRef.current
        ? clamp01((performance.now() - openStartRef.current) / OPEN_FLOOR_MS)
        : 0;
      section.style.setProperty(
        "--zones-open",
        easeOpen(Math.max(byScroll, byTime)).toFixed(3),
      );

      setEngaged(pinned && !nextExiting);
      setExiting(nextExiting);
      // Finché il pavimento a tempo non è arrivato in fondo la scena continua a
      // ridisegnarsi da sola, anche se il lettore ha smesso di scorrere.
      if (openStartRef.current && byTime < 1) request();
    };
    const request = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", request);
      window.removeEventListener("resize", request);
    };
  }, []);

  const activeZone = stage >= 1 ? ZONES[stage - 1] : null;

  return (
    <section
      ref={sectionRef}
      className="relief-map-section zones-scene"
      aria-label="Mappa delle aree pilota del progetto TALEA"
    >
      <div className="relief-map-sticky">
        <div ref={containerRef} className="map-canvas relief-map-canvas" aria-hidden="true" />
        <div className="relief-map-scrim" aria-hidden="true" />
        <div
          ref={focusMaskRef}
          className={`zones-focus-mask${activeZone ? " zones-focus-mask--active" : ""}`}
          aria-hidden="true"
        />
        {/* Nessuna classe di stato su questi due: l'apertura e la chiusura
            sono numeri (`--zones-open`, `--map-exit`) che il ciclo di
            scorrimento scrive sulla sezione a ogni fotogramma. Il velo
            d'entrata è bucato da un'iride che cresce; quello d'uscita è una
            dissolvenza la cui opacità è la posizione di scroll. */}
        <div className="relief-map-veil" aria-hidden="true" />
        <div className="relief-map-veil-exit" aria-hidden="true" />
        {/* L'etichetta del cerchio, al centro in alto: è il posto in cui la
            mappa dei rifugi mette il suo invito («tocca una zona»), ed è dove
            l'occhio arriva prima. Stava in una legenda all'angolo, con la
            dicitura «Ambito indicativo raccontato»: un angolo che nessuno
            guarda, e tre parole di gergo redazionale. */}
        <div
          className={`zones-key${engaged ? " zones-key--ready" : ""}${
            exiting ? " zones-key--gone" : ""
          }`}
          aria-hidden="true"
        >
          <span className="zones-swatch zones-swatch--area" />
          {zonesMap.legend.area}
        </div>

        {/* Il pannello che racconta la scena. Stava in basso a sinistra, scuro,
            sopra il punto in cui la mappa mostra di più: ora sta in alto a
            destra, dove sta la colonna di descrizioni della mappa degli hotspot,
            con la stessa carta e lo stesso corpo di testo. Niente occhiello: era
            l'unica etichetta maiuscola della scena, e diceva il quartiere e le
            vie, che si leggono meglio dentro la frase.
            `--ready` lo fa entrare dopo il velo, non prima. */}
        <div
          className={`zones-caption${engaged ? " zones-caption--ready" : ""}${
            exiting ? " zones-caption--gone" : ""
          }`}
        >
          {activeZone ? (
            <>
              <h3 className="zones-caption-title">{activeZone.area}</h3>
              <p className="zones-caption-text">{highlightedIntroText(activeZone.text)}</p>
            </>
          ) : (
            <>
              <h3 className="zones-caption-title">{zonesMap.intro.title}</h3>
              <p className="zones-caption-text">{highlightedIntroText(zonesMap.intro.text)}</p>
            </>
          )}
          {/* Qui c'era il link «I rifugi climatici sulla piattaforma TALEA»,
              ripetuto identico su tutte e tre le tappe. Portava altrove nel
              mezzo di una sequenza guidata, e la stessa piattaforma è già
              raggiungibile due volte più avanti, dal logo del capitolo e dalla
              griglia degli strumenti in chiusura. */}
          <div className="zones-progress" aria-hidden="true">
            {Array.from({ length: STAGE_COUNT }).map((_, i) => (
              <span key={i} className={`zones-dot${i === stage ? " zones-dot--on" : ""}`} />
            ))}
          </div>
          {failed && (
            <p className="relief-map-note relief-map-note--error">
              Mappa non caricata al momento.
            </p>
          )}
        </div>
      </div>

      <div className="zones-steps" aria-hidden="true">
        {Array.from({ length: STAGE_COUNT }).map((_, i) => (
          <div
            key={i}
            ref={(el) => {
              stepsRef.current[i] = el;
            }}
            className="zones-step"
          />
        ))}
        {/* La coda: scroll in più DOPO l'ultimo passo, senza un passo in più.
            Il secondo ambito arrivava e la sezione finiva quasi subito, e il
            lettore usciva dalla scena mentre la camera era ancora in viaggio.
            Ora, quando l'ultimo passo ha superato la riga di lettura, lo stage
            resta lì per tutta questa coda (vedi il ramo `min === Infinity` qui
            sopra). La sua altezza è tarata sul volo fra le due tappe: chi
            cambia `FLIGHT_DURATION` guardi anche `.zones-tail` in story.css. */}
        <div className="zones-tail" />
      </div>
    </section>
  );
}

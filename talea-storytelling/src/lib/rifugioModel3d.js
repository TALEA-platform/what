// Il plastico tridimensionale della piazza climatica: la stessa scena della
// vignetta 2D, ma girevole. Vive FUORI da React perche' disegna migliaia di
// poligoni per fotogramma scrivendo innerHTML su due buffer alternati: farlo
// passare dal VDOM vorrebbe dire ricostruire l'albero a ogni grado di
// rotazione. React monta il contenitore, chiama createRifugioModel() una volta
// sola, e da li' in poi parla al modello per metodi.
//
// Origine: public/prototypes/rifugio-step0-preview-rifinito-v3.html, il
// prototipo su cui forma, scala, stile e rotazione sono stati approvati. Le
// differenze rispetto a quel file sono solo di confezionamento: niente
// interfaccia di collaudo, niente id cercati nel documento intero, e uno zoom
// che nel prototipo non serviva.
//
// Le PERSONE non stanno piu' qui: la loro geometria e' in `castFigures.js`,
// perche' la usa anche il generatore dei primi piani di «dove manca, si
// costruisce» (`scripts/build_cast_figures.mjs`). Erano lo stesso cast disegnato
// due volte; ora e' lo stesso cast e basta.
import { CAST, createCastFigures } from "./castFigures.js";

/** Il contenuto dell'<svg>: filtri, cielo, i due buffer del modello, l'etichetta. */
export const RIFUGIO_MODEL_MARKUP = String.raw`
<title id="model-title">Una piazza di quartiere prima della trasformazione climatica</title>
  <desc id="model-desc">Una piazza minerale e assolata, circondata da due edifici bolognesi e attraversata da alcune persone. Il modello può essere ruotato a 360 gradi.</desc>
  <defs>
    <filter id="pencil" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.014" numOctaves="2" seed="7" result="n" />
      <feDisplacementMap in="SourceGraphic" in2="n" scale="1.35" />
    </filter>
    <filter id="cast-volume" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB">
      <feColorMatrix in="SourceGraphic" type="saturate" values="1.3" result="saturated" />
      <feGaussianBlur in="SourceAlpha" stdDeviation="2.15" result="soft-alpha" />
      <feSpecularLighting in="soft-alpha" surfaceScale="2.8" specularConstant=".34" specularExponent="14" lighting-color="#fff8e8" result="volume-light">
        <feDistantLight azimuth="225" elevation="48" />
      </feSpecularLighting>
      <feComposite in="volume-light" in2="SourceAlpha" operator="in" result="clipped-light" />
      <feBlend in="saturated" in2="clipped-light" mode="screen" />
    </filter>
    <filter id="cast-side" x="-12%" y="-8%" width="124%" height="116%" color-interpolation-filters="sRGB">
      <feColorMatrix in="SourceGraphic" type="saturate" values="1.08" result="side-colour" />
      <feComponentTransfer in="side-colour">
        <feFuncR type="linear" slope=".7" intercept=".025" />
        <feFuncG type="linear" slope=".7" intercept=".025" />
        <feFuncB type="linear" slope=".7" intercept=".025" />
        <feFuncA type="identity" />
      </feComponentTransfer>
    </filter>
    <radialGradient id="sun-halo">
      <stop offset="0" stop-color="#f4ce84" stop-opacity=".3" />
      <stop offset="1" stop-color="#f4ce84" stop-opacity="0" />
    </radialGradient>

    <clipPath id="road-volume-clip" clipPathUnits="userSpaceOnUse">
      <polygon id="road-volume-clip-shape" points="0,0 960,0 960,660 0,660" />
    </clipPath>

  </defs>
  <g class="static-backdrop" aria-hidden="true" filter="url(#pencil)">
    <path d="M42 335 Q118 281 208 318 Q282 256 374 316 Q454 280 536 328 L536 356 L42 356 Z" fill="#9DB38B" opacity=".12" />
    <path d="M405 337 Q502 291 590 325 Q688 270 785 319 Q862 293 926 330 L926 357 L405 357 Z" fill="#B2C49F" opacity=".14" />
  </g>
  <!-- ── Le nuvole ──────────────────────────────────────────────
       Arrivano con il suolo vivo e attraversano il cielo molto
       lentamente. Non sono meteorologia: sono la prova che l'aria si
       muove, e in un capitolo sul caldo un cielo assolutamente fermo
       e' una cosa che si sente. Stanno FUORI dal modello perche' il
       cielo non ruota con il plastico: la piazza gira, il cielo no.
       Sono ferme in CSS, quindi non costano un poligono al render. -->
  <g id="clouds" aria-hidden="true" fill="#ffffff">
    <g class="cloud" style="--cloud-dur:104s; animation-delay:-8s">
      <g transform="translate(0 82)" opacity=".46">
        <ellipse cx="0" cy="0" rx="48" ry="14" />
        <ellipse cx="-30" cy="4" rx="30" ry="10" />
        <ellipse cx="28" cy="5" rx="34" ry="10" />
        <ellipse cx="4" cy="-10" rx="27" ry="13" />
      </g>
    </g>
    <g class="cloud" style="--cloud-dur:138s; animation-delay:-64s">
      <g transform="translate(0 142)" opacity=".33">
        <ellipse cx="0" cy="0" rx="62" ry="15" />
        <ellipse cx="-38" cy="5" rx="34" ry="10" />
        <ellipse cx="36" cy="4" rx="40" ry="11" />
        <ellipse cx="-6" cy="-11" rx="32" ry="14" />
      </g>
    </g>
    <g class="cloud" style="--cloud-dur:172s; animation-delay:-120s">
      <g transform="translate(0 46)" opacity=".28">
        <ellipse cx="0" cy="0" rx="38" ry="11" />
        <ellipse cx="-22" cy="3" rx="24" ry="8" />
        <ellipse cx="22" cy="3" rx="26" ry="8" />
      </g>
    </g>
  </g>
  <g id="sun" aria-hidden="true"></g>
  <g id="model" filter="url(#pencil)"><g id="model-a"></g><g id="model-b" visibility="hidden"></g></g>
`;

/** Le letture della temperatura, tappa per tappa. Stessi valori e stesse
 *  diciture di `rifugioTempSpots` in src/data/climateRelief.js: se cambiano
 *  lì, vanno cambiate qui. */
export const RIFUGIO_TEMPERATURES = [
  { value: "36°", where: "al sole", tint: "#8E3F25", label: "#7D3A25" },
  { value: "34°", where: "sotto gli alberi", tint: "#8E3F25", label: "#7D3A25" },
  { value: "33°", where: "al riparo", tint: "#87492B", label: "#7D3A25" },
  { value: "33°", where: "al riparo", tint: "#87492B", label: "#7D3A25" },
  { value: "32°", where: "vicino all’acqua", tint: "#6E5A34", label: "#5F4E2C" },
  { value: "32°", where: "vicino all’acqua", tint: "#6E5A34", label: "#5F4E2C" },
  { value: "31°", where: "nel rifugio", tint: "#3F6B3C", label: "#345A32" },
  { value: "31°", where: "nel rifugio", tint: "#3F6B3C", label: "#345A32" },
];

export const RIFUGIO_STEP_COUNT = RIFUGIO_TEMPERATURES.length;

/**
 * Costruisce la scena dentro `shell` e restituisce i comandi per pilotarla.
 *
 * @param {HTMLElement} shell contenitore già in pagina, con dentro un <svg> vuoto
 * @param {object} [options]
 * @param {(info: {angle: number, tilt: number, zoom: number, ms: number}) => void} [options.onFrame]
 * @param {(zoom: number) => void} [options.onZoom]
 */
export function createRifugioModel(shell, options = {}) {
  const svg = shell.querySelector("svg");
  svg.innerHTML = RIFUGIO_MODEL_MARKUP;

  let visibleModelBuffer = svg.querySelector("#model-a");
  let hiddenModelBuffer = svg.querySelector("#model-b");
  const sun = svg.querySelector("#sun");
  const roadVolumeClipShape = svg.querySelector("#road-volume-clip-shape");
  const onFrame = typeof options.onFrame === "function" ? options.onFrame : null;
  const onZoom = typeof options.onZoom === "function" ? options.onZoom : null;

  // ── Lo zoom ─────────────────────────────────────────────────────────────
  // Moltiplica la scala decisa dall'inquadratura automatica lasciando fermo il
  // centro: il plastico cresce dentro il riquadro invece di scivolarne fuori.
  // Sopra 1 il disegno deborda, ed è per questo che l'<svg> ritaglia (story.css).
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 2.4;
 const DEFAULT_ZOOM = 1;   // il riquadro e' gia' pieno: si parte dalla vista intera
  let zoom = DEFAULT_ZOOM;
  // Lo spostamento del riquadro, in unità del disegno. Vale zero a zoom 1.
  let panX = 0;
  let panY = 0;
  let panning = false;

  let unbuildTimer = 0;

  // Ogni ascoltatore passa di qui, così `destroy()` non se ne dimentica nessuno.
  const bindings = [];
  const on = (target, type, handler, opts) => {
    target.addEventListener(type, handler, opts);
    bindings.push(() => target.removeEventListener(type, handler, opts));
  };
  const timers = new Set();
  const later = (fn, ms) => {
    const timer = setTimeout(fn, ms);
    timers.add(timer);
    return timer;
  };

  const C = {
    ink: "#3A352A",
    stone: "#EFE7D4",
    stoneSide: "#CDC2A6",
    stoneDark: "#B7A98A",
    paving: "#DED3BC",
    pavingCentre: "#EEE5D2",
    pavingEdge: "#CDBE9E",
    pavingForecourt: "#E2D4B8",
    threshold: "#B6A27A",
    drain: "#766E61",
    wall: "#E6DBC3",
    wallSide: "#D3C6A9",
    wallDark: "#B9AA89",
    cornice: "#DACDB0",
    roof: "#C9975F",
    roofBack: "#A87B4C",
    roofRidge: "#8E6437",
    window: "#6E7B84",
    windowHi: "#98A6AD",
    shutter: "#9AA087",
    door: "#7A6647",
    doorPanel: "#967B51",
    road: "#827F78",
    roadSide: "#68665F",
    heat: "#C2551F",
    car: "#78958B",
    carSide: "#5F796F",
    carTop: "#9DB3A8",
    carGlass: "#78909B",
    carLight: "#E6C96F",
    carTail: "#A84F3B",
  };

  const C30 = Math.cos(Math.PI / 6);

  // ── Il sole sta nel mondo ──────────────────────────────────────────────
  // Era fisso a (748, 126) in coordinate schermo: con la piazza allargata
  // e l'inquadratura che si adatta finiva dietro un tetto, e soprattutto,
  // ruotando, restava incollato al monitor mentre la scena girava sotto.
  // Ora e' un punto lontano con un proprio azimut, e la sua posizione a
  // schermo si ricalcola a ogni fotogramma: e' la stessa posizione da cui
  // partono le ombre, quindi luce e ombre non possono piu' discordare.
  const SUN_AZ = 8 * Math.PI / 180;
  const SUN_EL = 46 * Math.PI / 180;
  const SUN_DIST = 34;
  const SUN_WORLD = {
    x: Math.cos(SUN_EL) * Math.cos(SUN_AZ) * SUN_DIST,
    y: Math.cos(SUN_EL) * Math.sin(SUN_AZ) * SUN_DIST,
    z: Math.sin(SUN_EL) * SUN_DIST,
  };
  let SUN_SCREEN = { x: 748, y: 126 };

  // ── Inquadratura automatica ────────────────────────────────────────────
  // Prima la scala era fissa (SCALE = 30) e il centro pure (480, 350):
  // ruotando, il plastico scivolava fuori dal quadro da un lato e lasciava
  // mezzo riquadro vuoto dall'altro. Ora la scala e il centro si ricavano
  // dall'ingombro reale a ogni fotogramma, quindi la piazza resta sempre
  // centrata e piena. Costa otto proiezioni per fotogramma.
  //
  // Serve anche per un motivo pratico: la piazza va allargata per fare
  // spazio a cio' che dovra' arrivarci dentro (alberi, pergola, sedute,
  // acqua, suolo vivo, fermata). Con una scala fissa, allargarla voleva
  // dire ritarare a mano SCALE e CENTER a ogni ritocco del disegno.
  // Il riquadro del modello lascia sopra una fascia di cielo: senza, la
  // piazza arrivava a filo del bordo alto e il sole non aveva dove stare.
  const FRAME = { x: 24, y: 112, w: 912, h: 534 };
  // Il bordo dietro era tenuto a -7,4 quando le case finivano molto piu' su:
  // oggi il pezzo piu' arretrato e' la falda del tetto a -5,9, e quel metro e
  // mezzo di aria in piu' si pagava rimpicciolendo tutto il resto.
  const SCENE_BOUNDS = { x0: -10.9, y0: -6.2, x1: 10.9, y1: 14.1, z1: 4.6 };
  let fit = { scale: 26, ox: 480, oy: 350 };
  const DEFAULT_ANGLE = 5;
  const DEFAULT_TILT = 35;
  const MIN_TILT = 22;
  const MAX_TILT = 52;
  const CAR_DURATION_SECONDS = 11;
  const trafficEpoch = performance.now();
  // Le persone hanno un asse frontale proprio tarato sulla scena approvata:
  // cambiare l'inquadratura iniziale non deve ruotare i loro corpi.
  const PERSON_REFERENCE_RADIANS = 316 * Math.PI / 180;
  const PERSON_YAW = Math.PI / 4 - PERSON_REFERENCE_RADIANS;
  const baseFaces = [];
  const groundSurfaces = [];
  const heatFaces = [];
  const groundLines = [];
  const shadows = [];
  const contactFaces = [];
  const carGround = [];
  const carSolids = [];
  const carDetails = [];
  const solids = [];
  const details = [];
  const heatAnchors = [];
  const shadowGroundSurfaces = [];
  let buildingCount = 0;
  let viewTilt = DEFAULT_TILT;

  const point = (x, y, z = 0) => ({ x, y, z });
  const average = (pts) => pts.reduce(
    (acc, p) => ({ x: acc.x + p.x / pts.length, y: acc.y + p.y / pts.length, z: acc.z + p.z / pts.length }),
    { x: 0, y: 0, z: 0 },
  );

  function rotate(p, radians) {
    const c = Math.cos(radians);
    const s = Math.sin(radians);
    return { x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z };
  }

  // Punto del mondo in unita' di camera, prima di scala e centratura.
  function camera2d(p, radians) {
    const q = rotate(p, radians);
    const elevation = viewTilt * Math.PI / 180;
    const normalization = 1 / Math.cos(DEFAULT_TILT * Math.PI / 180);
    const groundY = Math.sin(elevation) / Math.SQRT2 * normalization;
    const verticalY = Math.cos(elevation) * normalization;
    return {
      x: (q.x - q.y) * C30,
      y: (q.x + q.y) * groundY - q.z * verticalY,
    };
  }

  function project(p, radians) {
    const c = camera2d(p, radians);
    return { x: fit.ox + c.x * fit.scale, y: fit.oy + c.y * fit.scale };
  }

  // ── La scala NON dipende dall'angolo ───────────────────────────────────
  // Adattandosi all'ingombro rettangolare ruotato, il modello si
  // rimpiccioliva ogni volta che la piazza mostrava la diagonale (sui
  // 45°) e si ringrandiva sui lati: corretto come calcolo, sbagliato da
  // guardare, perche' un plastico che si gira non deve anche respirare.
  //
  // Qui l'ingombro e' il CERCHIO circoscritto alla pianta, che ruotando
  // non cambia mai: la scala si calcola una volta per inclinazione e resta
  // ferma per tutti i 360°. Si perde qualche punto percentuale di
  // riempimento agli angoli retti, e si guadagna una rotazione che non
  // pulsa. Il centro invece si ricalcola, perche' la rotazione avviene
  // attorno all'origine del mondo e non al centro della piazza.
  function computeFit(radians) {
    const b = SCENE_BOUNDS;
    const cx = (b.x0 + b.x1) / 2;
    const cy = (b.y0 + b.y1) / 2;
    // ── Il limite giusto e' il LATO PIU' LUNGO, non la diagonale ────────────
    // Qui c'era il raggio del cerchio circoscritto alla pianta, per non far
    // «respirare» il plastico mentre gira: giusta l'intenzione, sbagliato il
    // numero. Ruotando un rettangolo di semilati a e b, la sua larghezza sullo
    // schermo vale a|cosθ−sinθ| + b|sinθ+cosθ|, e il massimo su tutti i θ e'
    // √2·max(a,b) — non √2·√(a²+b²). La diagonale e' un limite che nessuna
    // rotazione raggiunge mai, e teneva il disegno un terzo piu' piccolo del
    // necessario dentro un riquadro mezzo vuoto.
    //
    // La scala resta comunque indipendente dall'angolo, che era tutto il
    // punto: si calcola una volta per inclinazione e non pulsa girando.
    const radius = Math.max((b.x1 - b.x0) / 2, (b.y1 - b.y0) / 2);

    const elevation = viewTilt * Math.PI / 180;
    const normalization = 1 / Math.cos(DEFAULT_TILT * Math.PI / 180);
    const groundY = Math.sin(elevation) / Math.SQRT2 * normalization;
    const verticalY = Math.cos(elevation) * normalization;

    const halfWidth = radius * Math.SQRT2 * C30;
    const halfGround = radius * Math.SQRT2 * groundY;
    const height = 2 * halfGround + b.z1 * verticalY;
    // Lo zoom entra QUI e non su una trasformazione dell'<svg>: moltiplicando
    // la scala, tratti e dettagli restano tarati sul disegno (un `transform:
    // scale` avrebbe ingrossato anche gli inchiostri, che sono a spessore
    // costante per scelta). Il centro del riquadro resta il centro del
    // plastico, quindi si ingrandisce senza scivolare via.
    const scale = Math.min(FRAME.w / (2 * halfWidth), FRAME.h / Math.max(.001, height)) * zoom;

    const centre = camera2d(point(cx, cy, 0), radians);
    // Il contenuto va da (centre.y - halfGround - z1*verticalY) a
    // (centre.y + halfGround): il suo punto medio non e' centre.y.
    const midY = centre.y - b.z1 * verticalY / 2;
    fit = {
      scale,
      ox: FRAME.x + FRAME.w / 2 - centre.x * scale + panX,
      oy: FRAME.y + FRAME.h / 2 - midY * scale + panY,
    };
  }

  function depthOf(points, radians) {
    const p = rotate(average(points), radians);
    const elevation = viewTilt * Math.PI / 180;
    return (p.x + p.y) * Math.cos(elevation) / Math.SQRT2 + p.z * Math.sin(elevation);
  }

  // Il culling resta attivo per i volumi regolari, ma con una fascia di
  // tolleranza attorno al profilo. Gli elementi organici, sottili o curvi
  // sono marcati `doubleSided` e non vengono mai eliminati: così alberi,
  // archi, teli e acqua non possono lampeggiare mentre si ruota.
  function visible(normal, radians) {
    const n = rotate(normal, radians);
    const elevation = viewTilt * Math.PI / 180;
    const horizontal = Math.cos(elevation) / Math.SQRT2;
    const facing = n.x * horizontal + n.y * horizontal + n.z * Math.sin(elevation);
    return facing > -.035;
  }

  function stableDepth(item, radians) {
    const raw = depthOf(item.points, radians) + (item.depthBias || 0);
    // Quantizzazione minima: evita che due superfici quasi complanari si
    // scambino continuamente per rumore numerico mentre il mouse si muove.
    return Math.round(raw * 10000) / 10000;
  }

  function compareItems(a, b, radians) {
    const d = stableDepth(a, radians) - stableDepth(b, radians);
    return Math.abs(d) < .0002 ? (a.seq || 0) - (b.seq || 0) : d;
  }

  function ptsAttr(points, radians) {
    return points.map((p) => {
      const q = project(p, radians);
      return `${q.x.toFixed(1)},${q.y.toFixed(1)}`;
    }).join(" ");
  }

  // ── Le otto tappe ──────────────────────────────────────────────────────
  // Ogni pezzo nasce dentro una tappa: `beginLayer(k)` marca tutto quello
  // che viene costruito dopo, finche' non si cambia. `goneAt` e' l'opposto,
  // per le cose che se ne VANNO (le auto in sosta quando arriva il verde).
  //
  // Il filtro non e' un dettaglio di comodo: e' cio' che permette al
  // renderer di ricevere la tappa come INGRESSO invece di farsi applicare
  // le classi da fuori dopo il disegno. E' la differenza fra una scena che
  // sopravvive alla rotazione e una che si scancella ogni volta che il
  // lettore tocca il modello (vedi la nota in RifugioExplainer.jsx).
  let currentLayer = 0;
  let currentGoneAt = null;
 let step = 7;
  // La tappa che il DISEGNO sta mostrando. Coincide con `step`, tranne nel
  // fotogramma in cui una tappa si sta ritirando: lì resta indietro, così i
  // pezzi in uscita sono ancora in scena per potersi ritirare davvero.
  let renderStep = step;

  // ── L'unita' che arriva e' l'OGGETTO, non il poligono ─────────────────
  // Lo sfalsamento del montaggio era contato per faccetta: un albero ne ha
  // centinaia, quindi da solo occupava secondi e sembrava che crescesse al
  // rallentatore. Si conta per oggetto — un albero, una panchina, la
  // fontana — e tutte le faccette di quell'oggetto partono insieme.
  const layerObjects = new Map();
  let objectSeq = 0;
  let objectUid = 0;
  let currentObjectUid = 0;
  let itemSeq = 0;
  let pieceSeq = 0;
  let currentBuildAxis = "pop";
  let noBuild = false;

  function beginLayer(k, goneAt = null) {
    currentLayer = k;
    currentGoneAt = goneAt;
  }

  // `quiet` marca gli oggetti che NON si montano: una persona non si
  // costruisce dal basso, e un autobus non viene assemblato sulla strada —
  // arriva guidando. Per loro il cambio di tappa e' gia' il racconto.
  function beginObject(quiet = false) {
    const n = layerObjects.get(currentLayer) ?? 0;
    layerObjects.set(currentLayer, n + 1);
    objectSeq = n;
    currentObjectUid = ++objectUid;
    pieceSeq = 0;
    currentBuildAxis = (currentLayer === 1 || currentLayer === 5) ? "grow" : "pop";
    noBuild = quiet;
  }

  // Le costruzioni artificiali sono suddivise in componenti logici:
  // montanti, travi, doghe, bordo, acqua, copertura. Tutte le facce dello
  // stesso componente partono insieme; il componente successivo segue.
  function beginPiece(axis = "pop") {
    pieceSeq += 1;
    currentBuildAxis = axis;
  }

  const liveAt = (item, k = renderStep) =>
    (item.layer ?? 0) <= k && (item.goneAt == null || k < item.goneAt);

  const active = (list, k = renderStep) => list.filter((item) => liveAt(item, k));

  function addFace(target, points, fill, normal, options = {}) {
    target.push({
      type: "face", points, fill, normal,
      layer: currentLayer, goneAt: currentGoneAt,
      obj: objectSeq, objectUid: currentObjectUid, piece: pieceSeq, buildAxis: currentBuildAxis,
      seq: itemSeq++, noBuild, ...options,
    });
  }

  function addLine(target, points, normal = { x: 0, y: 0, z: 1 }, options = {}) {
    target.push({
      type: "line", points, normal,
      layer: currentLayer, goneAt: currentGoneAt,
      obj: objectSeq, objectUid: currentObjectUid, piece: pieceSeq, buildAxis: currentBuildAxis,
      seq: itemSeq++, noBuild, ...options,
    });
  }

  function addBox(target, x0, y0, x1, y1, height, colours, base = 0, options = {}) {
    const z0 = base;
    const z1 = base + height;
    const surfaceKeys = options.surfaceKeys || {};
    const faceOptions = (side) => ({ ...options, surfaceKeys: undefined, surfaceKey: surfaceKeys[side] });
    addFace(target, [point(x0,y0,z1), point(x1,y0,z1), point(x1,y1,z1), point(x0,y1,z1)], colours.top, {x:0,y:0,z:1}, faceOptions("top"));
    addFace(target, [point(x1,y0,z0), point(x1,y1,z0), point(x1,y1,z1), point(x1,y0,z1)], colours.xp, {x:1,y:0,z:0}, faceOptions("xp"));
    addFace(target, [point(x0,y1,z0), point(x0,y0,z0), point(x0,y0,z1), point(x0,y1,z1)], colours.xn, {x:-1,y:0,z:0}, faceOptions("xn"));
    addFace(target, [point(x1,y1,z0), point(x0,y1,z0), point(x0,y1,z1), point(x1,y1,z1)], colours.yp, {x:0,y:1,z:0}, faceOptions("yp"));
    addFace(target, [point(x0,y0,z0), point(x1,y0,z0), point(x1,y0,z1), point(x0,y0,z1)], colours.yn, {x:0,y:-1,z:0}, faceOptions("yn"));
  }

  // ── Le figure sono OGGETTI, non mucchi di poligoni ─────────────────────
  // Ogni persona porta un proprio `figureId`. Serve a due cose insieme:
  //  · l'ordine del pittore la tratta come un pezzo solo, invece di
  //    intercalare le sue facce con quelle delle case (da cui i pezzi di
  //    persona che spuntavano attraverso un tetto);
  //  · il render la avvolge in un <g> stabile, e su quel gruppo si puo'
  //    appendere un'animazione CSS. E' l'unico modo per dare respiro alle
  //    persone senza ridisegnare la scena a ogni fotogramma: da fermi la
  //    scena non si ridisegna affatto, quindi il CSS lavora da solo.
  const FIGURE_BASE = { className: "face face--figure", figure: true };
  let figureOptions = FIGURE_BASE;
  const figureAnchors = new Map();

  function beginFigure(id, x, y) {
    figureOptions = { ...FIGURE_BASE, figureId: id };
    figureAnchors.set(id, point(x, y, .95));
  }
  function endFigure() { figureOptions = FIGURE_BASE; }

  // Il respiro di ciascuno. Durate e ritardi diversi perche' cinque persone
  // che ondeggiano all'unisono non sembrano vive, sembrano un carillon. Il
  // bambino e' piu' rapido e si muove di piu': e' l'unico che non sta
  // aspettando, sta aspettando male.
  // ── Le persone stanno un po' sopra la scala vera ───────────────────────
  // Allargare la piazza le aveva rimpicciolite, e sono loro il soggetto: da
  // qui la maggiorazione, che e' il trucco che ogni illustratore usa e non un
  // errore di scala.
  // Era del 22%, tarata su un'inquadratura piu' piccola. Da quando il riquadro
  // si e' allargato e la scala e' cresciuta di un terzo, quel 22% le ha fatte
  // diventare troppo alte per i portoni e per le panchine: una persona
  // arrivava alla gronda del portico. Il 10% le tiene ancora sopra la scala
  // vera — abbastanza da leggerle da lontano — senza che scavalchino
  // l'architettura.
  const CAST_SCALE = 1.10;

  // `dur` in secondi e `offset` come sfasamento proprio. Il ritardo vero si
  // calcola a ogni render dall'epoca globale (vedi phaseOf): cosi' quando
  // innerHTML ricrea i nodi, l'animazione RIPRENDE dal punto in cui era
  // invece di ricominciare da capo a ogni movimento del mouse. E' la stessa
  // tecnica gia' usata dall'auto in transito.
  const CAST_LIFE = {
    elder:             { dur: 5.6, offset: 0.4, lift: "0.9px" },
    elderSeated:       { dur: 6.2, offset: 1.1, lift: "0.55px" },
    adult:             { dur: 4.6, offset: 1.7, lift: "1.1px" },
    adultFountain:     { dur: 5.2, offset: 2.0, lift: "0.9px" },
    child:             { dur: 2.7, offset: 0.9, lift: "2.2px" },
    childFountain:     { dur: 3.4, offset: 1.5, lift: "1.7px" },
    wheelchair:        { dur: 5.1, offset: 2.6, lift: "0.7px" },
    wheelchairTransit: { dur: 5.6, offset: 2.9, lift: "0.6px" },
    pregnant:          { dur: 4.9, offset: 3.3, lift: "1.2px" },
    pregnantSeated:    { dur: 5.8, offset: 3.7, lift: "0.65px" },
    default:           { dur: 4.8, offset: 0,   lift: "1px" },
  };

  const HEAT_DUR = 3.6;
  const RIPPLE_DUR = 4.5;
  const JET_DUR = 1.9;
  const PERCH_DUR = 11;

  // Quanto e' avanzato un ciclo di durata `dur` dall'avvio della pagina.
  function phaseOf(dur, offset = 0) {
    return (((performance.now() - trafficEpoch) / 1000 + offset) % dur).toFixed(3);
  }

  // ── Le primitive e il cast: stessa geometria dei primi piani ───────────
  // Tutto quello che segue viveva qui dentro. Adesso vive in `castFigures.js`
  // e da qui si prende per nome, perche' lo stesso codice serve al generatore
  // dei tre disegni assonometrici di «dove manca, si costruisce»: la' le
  // persone vengono proiettate una volta sola e cotte in un disegno statico,
  // qui vengono riproiettate a ogni fotogramma. Il contesto e' l'unica cosa
  // che cambia — dove finiscono le facce, con quali opzioni, e quanto fitta
  // dev'essere la tassellatura (`detail: 1`, cioe' quella piena).
  const {
    vNormal, localPoint, figureMaterial, mixHex, surfaceTone,
    addOrientedBox, addEllipsoid, addTube, addTaperedTube,
    addElder3D, addElderSeated3D, addAdult3D, addChild3D,
    addWheelchair3D, addPregnant3D, addPregnantSeated3D,
  } = createCastFigures({
    addFace,
    solids,
    contactFaces,
    ink: C.ink,
    personYaw: PERSON_YAW,
    // Le opzioni cambiano a ogni persona (`beginFigure`) e la quota della
    // seduta e' dichiarata piu' in basso: si passano come letture differite,
    // non come valori, o resterebbero congelate a quelle del montaggio.
    figureOptions: () => figureOptions,
    benchSeatZ: () => BENCH_SEAT_Z,
    detail: 1,
  });

  function shadowPolygon(x0, y0, x1, y1, height, opacity = .11) {
    shadows.push({
      footprint: [point(x0,y0,.24),point(x1,y0,.24),point(x1,y1,.24),point(x0,y1,.24)],
      height,
      opacity,
      layer: currentLayer,
      goneAt: currentGoneAt,
    });
  }

  // `convexHull` sta più in basso, vicino a chi lo usa per il ritaglio della
  // strada. Ne esistevano DUE copie, quasi identiche: essendo dichiarazioni di
  // funzione, la seconda vinceva comunque su tutte le chiamate, quindi la prima
  // era codice che nessuno eseguiva. Ne è rimasta una.

  function renderShadows(radians) {
    const clip = shadowGroundSurfaces
      .map((surface) => `<polygon points="${ptsAttr(surface,radians)}"/>`)
      .join("");
    const shade = active(shadows).map((shadow) => {
      const footprint = shadow.footprint.map((p) => project(p,radians));
      const center = footprint.reduce((acc,p) => ({x:acc.x+p.x/footprint.length,y:acc.y+p.y/footprint.length}),{x:0,y:0});
      const vx = center.x - SUN_SCREEN.x;
      const vy = center.y - SUN_SCREEN.y;
      const length = Math.hypot(vx,vy) || 1;
      const reach = shadow.height * fit.scale * .46;
      const offset = {x:vx/length*reach,y:vy/length*reach};
      const hull = convexHull([...footprint,...footprint.map((p) => ({x:p.x+offset.x,y:p.y+offset.y}))]);
      const points = hull.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
      return `<polygon points="${points}" fill="${C.ink}" opacity="${shadow.opacity}"/>`;
    }).join("");
    return `<defs><clipPath id="shadow-ground-clip">${clip}</clipPath></defs><g class="dynamic-shadows" clip-path="url(#shadow-ground-clip)">${shade}</g>`;
  }

  function addWindow(side, fixed, a0, a1, z0, z1, surfaceKey) {
    const offset = .012;
    let points;
    let normal;
    if (side === "yp") { points=[point(a0,fixed+offset,z0),point(a1,fixed+offset,z0),point(a1,fixed+offset,z1),point(a0,fixed+offset,z1)]; normal={x:0,y:1,z:0}; }
    if (side === "yn") { points=[point(a1,fixed-offset,z0),point(a0,fixed-offset,z0),point(a0,fixed-offset,z1),point(a1,fixed-offset,z1)]; normal={x:0,y:-1,z:0}; }
    if (side === "xp") { points=[point(fixed+offset,a1,z0),point(fixed+offset,a0,z0),point(fixed+offset,a0,z1),point(fixed+offset,a1,z1)]; normal={x:1,y:0,z:0}; }
    if (side === "xn") { points=[point(fixed-offset,a0,z0),point(fixed-offset,a1,z0),point(fixed-offset,a1,z1),point(fixed-offset,a0,z1)]; normal={x:-1,y:0,z:0}; }
    addFace(details, points, C.window, normal, {className:"face face--quiet", surfaceKey});
    addLine(details, [points[3], point(points[2].x,points[2].y,z0+(z1-z0)*.72)], normal, {className:"detail", stroke:C.windowHi, opacity:.55, surfaceKey});
  }

  // ── Le finestre hanno un PASSO IN METRI, non un numero per facciata ────
  // Prima ogni lato divideva la propria larghezza in `count` parti: il lato
  // lungo in 3, quello corto in 1. Il risultato e' che il ritmo delle
  // finestre cambiava da faccia a faccia, e ruotando l'edificio sembrava
  // riorganizzarsi le finestre addosso invece di essere sempre lo stesso
  // edificio visto da un'altra parte. Con un passo fisso la campata e'
  // identica ovunque: gira la camera, non la facciata.
  //
  // La fila e' centrata sulla facciata, cosi' gli avanzi si dividono fra i
  // due spigoli invece di accumularsi su uno solo.
  const BAY = 1.42;
  const WIN_W = .6;

  function bayCentres(start, end) {
    const span = end - start;
    const count = Math.max(1, Math.floor(span / BAY + .001));
    const first = start + (span - count * BAY) / 2;
    return Array.from({length: count}, (_, i) => first + BAY * (i + .5));
  }

  function addWindowsForSide(side, fixed, start, end, height, surfaceKey, options = {}) {
    const centres = bayCentres(start, end);
    [1.0, 2.05].forEach((z0) => {
      if (z0 + .64 > height - .2) return;
      centres.forEach((c) => {
        if (z0 === 1.0 && options.skipNear != null && Math.abs(c - options.skipNear) < BAY * .5) return;
        addWindow(side, fixed, c - WIN_W / 2, c + WIN_W / 2, z0, z0 + .64, surfaceKey);
      });
    });
  }

  function addDetailedDoor(fixedY, centerX, width, surfaceKey) {
    const normal = {x:0,y:1,z:0};
    const frameY = fixedY + .016;
    const doorY = fixedY + .022;
    addFace(details,[
      point(centerX-width*.62,frameY,.2),point(centerX+width*.62,frameY,.2),
      point(centerX+width*.62,frameY,1.38),point(centerX-width*.62,frameY,1.38),
    ],C.cornice,normal,{className:"face face--quiet",surfaceKey});
    addFace(details,[
      point(centerX-width*.5,doorY,.23),point(centerX+width*.5,doorY,.23),
      point(centerX+width*.5,doorY,1.28),point(centerX-width*.5,doorY,1.28),
    ],C.door,normal,{className:"face face--quiet",surfaceKey});

    const panel = (x0,x1,z0,z1,fill=C.doorPanel) => addFace(details,[
      point(x0,doorY+.004,z0),point(x1,doorY+.004,z0),
      point(x1,doorY+.004,z1),point(x0,doorY+.004,z1),
    ],fill,normal,{className:"face face--quiet",surfaceKey});
    panel(centerX-width*.4,centerX+width*.4,1.02,1.2,C.window);
    panel(centerX-width*.4,centerX-width*.04,.35,.78);
    panel(centerX+width*.04,centerX+width*.4,.35,.78);
    addLine(details,[point(centerX+width*.28,doorY+.008,.78),point(centerX+width*.36,doorY+.008,.78)],normal,{className:"detail",stroke:"#D7B66E",surfaceKey});
    addLine(details,[point(centerX-width*.4,doorY+.008,.92),point(centerX+width*.4,doorY+.008,.92)],normal,{className:"detail",stroke:C.cornice,opacity:.65,surfaceKey});
  }

  function addRoof(x0, y0, x1, y1, base, rise) {
    const ym = (y0 + y1) / 2;
    addFace(solids, [point(x0,y0,base),point(x1,y0,base),point(x1,ym,base+rise),point(x0,ym,base+rise)], C.roofBack, {x:0,y:-rise,z:(ym-y0)}, {doubleSided:true});
    addFace(solids, [point(x0,ym,base+rise),point(x1,ym,base+rise),point(x1,y1,base),point(x0,y1,base)], C.roof, {x:0,y:rise,z:(y1-ym)}, {doubleSided:true});
    addFace(solids, [point(x1,y0,base),point(x1,y1,base),point(x1,ym,base+rise)], C.wallSide, {x:1,y:0,z:0}, {doubleSided:true});
    addFace(solids, [point(x0,y1,base),point(x0,y0,base),point(x0,ym,base+rise)], C.wall, {x:-1,y:0,z:0}, {doubleSided:true});

    [.32,.6,.84].forEach((u) => {
      const y = ym + (y1-ym)*u;
      const z = base + rise*(1-u) + .012;
      addLine(details, [point(x0,y,z),point(x1,y,z)], {x:0,y:rise,z:(y1-ym)}, {className:"roof-line"});
      const yf = ym - (ym-y0)*u;
      addLine(details, [point(x0,yf,z),point(x1,yf,z)], {x:0,y:-rise,z:(ym-y0)}, {className:"roof-line"});
    });

    addBox(solids, x0-.08, ym-.07, x1+.08, ym+.07, .13,
      {top:C.roofRidge,xp:C.roofRidge,xn:C.roofRidge,yp:C.roofRidge,yn:C.roofRidge},
      base+rise-.04,
      {doubleSided:true},
    );
  }

  function addBuilding(x0, y0, x1, y1, height, rise) {
    const buildingId = `building-${++buildingCount}`;
    const bodySurfaces = {
      xp: `${buildingId}-xp`, xn: `${buildingId}-xn`,
      yp: `${buildingId}-yp`, yn: `${buildingId}-yn`,
    };
    shadowPolygon(x0,y0,x1,y1,height+rise,.12);
    addBox(solids, x0,y0,x1,y1,height,
      {top:C.wall,xp:C.wallSide,xn:C.wallDark,yp:C.wall,yn:C.wallSide},
      0,
      {surfaceKeys: bodySurfaces, doubleSided:true},
    );
    addBox(solids, x0-.14,y0-.14,x1+.14,y1+.14,.24,
      {top:C.cornice,xp:C.stoneSide,xn:C.stoneDark,yp:C.cornice,yn:C.stoneSide},
      height-.24,
      {doubleSided:true},
    );
    addRoof(x0-.22,y0-.18,x1+.22,y1+.18,height,rise);

    // Il portone sta al centro della facciata sulla piazza, e la finestra
    // della campata che occupa si toglie da se'.
    const dx = x0 + (x1-x0)*.5;
    const doorW = Math.min(.9,(x1-x0)*.24);

    addWindowsForSide("yp",y1,x0,x1,height,bodySurfaces.yp,{skipNear:dx});
    addWindowsForSide("yn",y0,x0,x1,height,bodySurfaces.yn);
    addWindowsForSide("xp",x1,y0,y1,height,bodySurfaces.xp);
    addWindowsForSide("xn",x0,y0,y1,height,bodySurfaces.xn);

    addDetailedDoor(y1,dx,doorW,bodySurfaces.yp);
    return { x0, y0, x1, y1, height, rise };
  }

  // ── Il portico ────────────────────────────────────────────────────────
  // Preesistente: non appartiene a una tappa di costruzione, è già lì nella
  // scena di partenza. Corre davanti alle case sul fondo, gira l'angolo e
  // prosegue lungo il fianco sinistro della piazza. Gli archi sono
  // semicircolari e le colonne sono tonde.
  //
  // ── Un solo disegno, due assi ─────────────────────────────────────────
  // Il braccio di fondo corre lungo x col fronte verso la piazza (+y);
  // quello di sinistra corre lungo y col fronte verso la piazza (+x). E' lo
  // stesso portico letto su due assi, quindi si scrive una volta sola:
  // `along` e' la direzione di marcia, `across` la profondita' misurata dal
  // filo esterno, e le due funzioni `P`/`R` traducono quella coppia in
  // coordinate del mondo. Scriverlo due volte avrebbe voluto dire tenere
  // allineate a mano due copie a ogni ritocco delle misure.
  //
  // ── L'angolo ha UNA colonna sola ──────────────────────────────────────
  // I due bracci non si sovrappongono: il tetto del braccio di sinistra
  // parte esattamente dove finisce quello di fondo, e la sua prima colonna
  // non viene posata perche' e' gia' l'ultima del braccio di fondo. E' la
  // colonna d'angolo: in un portico vero ce n'e' una, non due appaiate.
  const PORTICO_DEPTH = .94;

  function addPorticoArm(id, axis, back, a0, a1, first, last, bays, height, options = {}) {
    const { skipFirstColumn = false, floorFrom = a0 } = options;
    const depth = PORTICO_DEPTH;
    const roofZ = height;
    // (marcia, profondita', quota) → punto del mondo
    const P = (along, across, z) => axis === "x"
      ? point(along, back + across, z)
      : point(back + across, along, z);
    // (marcia0, marcia1, profondita'0, profondita'1) → x0,y0,x1,y1
    const R = (n0, n1, c0, c1) => axis === "x"
      ? [n0, back + c0, n1, back + c1]
      : [back + c0, n0, back + c1, n1];
    const frontNormal = axis === "x" ? {x:0,y:1,z:0} : {x:1,y:0,z:0};

    const floor = R(floorFrom, a1, 0, depth);
    shadowPolygon(floor[0], floor[1], floor[2], floor[3], roofZ, .09);

    addFace(groundSurfaces,[point(floor[0],floor[1],.214),point(floor[2],floor[1],.214),
                            point(floor[2],floor[3],.214),point(floor[0],floor[3],.214)],
      "#D8CCB2",{x:0,y:0,z:1},{stroke:"none",opacity:.56,doubleSided:true,depthGroup:`${id}-floor`});

    const columns = Array.from({length:bays+1},(_,i)=>first+(last-first)*(i/bays));

    // ── Il tetto va SPEZZATO in campate ─────────────────────────────────────
    // Era un solo cassone lungo dieci metri, e come tale una sola unità di
    // profondità, ordinata dal suo centro. Il centro di un portico lungo dieci
    // metri non dice niente su dove stia il suo pezzo davanti a un albero che
    // ne tocca l'estremità: alla vista d'apertura il tetto passava sopra la
    // chioma dell'albero di sinistra, e le case gli passavano sopra invece che
    // dietro. Spezzato campata per campata, ogni tratto si ordina per conto
    // proprio e ognuno finisce dove deve. È lo stesso rimedio che già usavano
    // colonne e archi — mancava solo alla trave che li unisce.
    const beam = (from, to, tag) => {
      const two = { doubleSided: true, depthGroup: `${id}-roof-${tag}` };
      addBox(solids,...R(from,to,-.04,depth+.08),.2,
        {top:C.cornice,xp:C.stoneSide,xn:C.stoneDark,yp:C.cornice,yn:C.stoneSide},roofZ-.06,two);
      addBox(solids,...R(from,to,depth-.09,depth+.1),.22,
        {top:C.cornice,xp:C.stoneSide,xn:C.stoneDark,yp:C.cornice,yn:C.stoneSide},roofZ-.24,two);
    };
    // Le giunzioni cadono a metà campata, non sulle colonne: così la fessura
    // fra due tratti finisce dove non c'è niente da vedere.
    const cuts = [a0 - .08];
    for (let i = 0; i < columns.length - 1; i++) cuts.push((columns[i] + columns[i + 1]) / 2);
    cuts.push(a1 + .08);
    for (let i = 0; i < cuts.length - 1; i++) beam(cuts[i], cuts[i + 1], i);
    columns.forEach((ca,ci)=>{
      if (skipFirstColumn && ci === 0) return;
      const columnOptions={doubleSided:true,depthGroup:`${id}-column-${ci}`};
      addTaperedTube(solids,P(ca,depth,.2),P(ca,depth,roofZ-.18),.105,.095,C.wallSide,8,columnOptions);
      addBox(solids,...R(ca-.15,ca+.15,depth-.15,depth+.15),.11,
        {top:C.cornice,xp:C.stoneSide,xn:C.stoneDark,yp:C.cornice,yn:C.stoneSide},.2,columnOptions);
      addBox(solids,...R(ca-.15,ca+.15,depth-.15,depth+.15),.1,
        {top:C.cornice,xp:C.stoneSide,xn:C.stoneDark,yp:C.cornice,yn:C.stoneSide},roofZ-.28,columnOptions);
    });

    // Ogni campata è disegnata con un arco di cerchio vero, non con una
    // curva schiacciata: il raggio è metà della luce fra le colonne.
    for(let i=0;i<bays;i++){
      const a=columns[i]+.1;
      const b=columns[i+1]-.1;
      const mid=(a+b)/2;
      const radius=(b-a)/2;
      const spring=1.02;
      const arc=[];
      for(let j=0;j<=8;j++){
        const t=j/8;
        const theta=Math.PI-(Math.PI*t);
        arc.push(P(mid+Math.cos(theta)*radius,depth+.012,spring+Math.sin(theta)*radius));
      }
      // L'arco ha spessore reale: una semplice linea SVG si annulla quando
      // viene osservata di taglio, mentre questi segmenti tubolari restano
      // leggibili lungo tutti i 360 gradi.
      const archOptions={className:"face face--soft",softness:.86,doubleSided:true,depthGroup:`${id}-arch-${i}`};
      for(let j=0;j<arc.length-1;j++) {
        addTaperedTube(solids, arc[j], arc[j+1], .038, .038, C.wallSide, 4, archOptions);
      }
      addTaperedTube(solids,P(a,depth+.012,.28),P(a,depth+.012,spring),.026,.026,C.wallSide,4,archOptions);
      addTaperedTube(solids,P(b,depth+.012,.28),P(b,depth+.012,spring),.026,.026,C.wallSide,4,archOptions);
    }
    // Il filetto d'ombra sotto la gronda segue lo stesso spezzettamento della
    // trave: attaccato a un solo gruppo, tornerebbe a essere una riga lunga
    // dieci metri ordinata dal centro.
    for (let i = 0; i < cuts.length - 1; i++) {
      addLine(details,[P(cuts[i],depth+.015,roofZ-.2),P(cuts[i+1],depth+.015,roofZ-.2)],
        frontNormal,{className:"detail",stroke:"#786548",opacity:.42,depthGroup:`${id}-roof-${i}`});
    }
  }

  function addCast3D() {
    // Le persone reagiscono alle nuove funzioni della piazza invece di
    // restare ferme nello stesso punto durante tutta la sequenza.
    beginLayer(0, 3);
    beginObject(true);
    beginFigure("elder",-6.0,1.7);
    addElder3D(-6.0,1.7);
    beginLayer(3);
    beginObject(true);
    beginFigure("elderSeated",BENCH_ELDER.x,BENCH_ELDER.y);
    addElderSeated3D(BENCH_ELDER.x,BENCH_ELDER.y);

    // Adulto e bambino si avvicinano alla fontana quando compare l'acqua.
    beginLayer(0, 4);
    beginObject(true);
    const adultInitial={x:-2.6,y:-.2};
    beginFigure("adult",adultInitial.x,adultInitial.y);
    addAdult3D(adultInitial.x,adultInitial.y);
    const childInitial=localPoint(adultInitial.x,adultInitial.y,.02,.72,0);
    beginFigure("child",childInitial.x,childInitial.y);
    addChild3D(childInitial.x,childInitial.y);

    beginLayer(4);
    beginObject(true);
    const adultWater={x:5.35,y:1.3};
    const adultWaterYaw=Math.atan2(2.7-adultWater.y,7.1-adultWater.x);
    beginFigure("adultFountain",adultWater.x,adultWater.y);
    addAdult3D(adultWater.x,adultWater.y,adultWaterYaw);
    const childWater={x:5.95,y:1.72};
    const childWaterYaw=Math.atan2(2.7-childWater.y,7.1-childWater.x);
    beginFigure("childFountain",childWater.x,childWater.y);
    addChild3D(childWater.x,childWater.y,childWaterYaw);

    // La carrozzina raggiunge il percorso accessibile verso la fermata.
    // ── Accanto alla pensilina, non dentro ────────────────────────────
    // Stava a (1,9 · 8,15), cioe' dentro l'ingombro della fermata: la
    // ruota posteriore attraversava il vetro di fondo e il busto finiva
    // sopra la panchina. Non era solo brutto: la pensilina e' UNA unita' di
    // profondita', quindi qualunque posizione dentro il suo perimetro
    // finisce prima o poi dipinta sotto il suo vetro, a seconda
    // dell'angolo. L'unico posto che funziona a 360 gradi e' fuori.
    // Qui e' a sinistra della pensilina, sul filo del marciapiede, girata
    // verso la strada: e' lo spazio d'attesa in piano dove finisce il
    // percorso tattile.
    // Sta a -0,55 e non a ridosso della pensilina per una ragione precisa:
    // l'autobus in sosta occupa da 0,7 a 5,7, e la telecamera lo guarda dal
    // lato strada. Chiunque aspetti dentro quella fascia sparisce dietro la
    // fiancata proprio quando arriva il mezzo — cioe' nel momento in cui la
    // tappa dell'accessibilita' dovrebbe leggersi meglio.
    beginLayer(0, 6);
    beginObject(true);
    beginFigure("wheelchair",1.35,1.35);
    addWheelchair3D(1.35,1.35);
    beginLayer(6);
    beginObject(true);
    const chairTransit={x:-.55,y:8.6};
    beginFigure("wheelchairTransit",chairTransit.x,chairTransit.y);
    addWheelchair3D(chairTransit.x,chairTransit.y,Math.PI/2);

    // La donna incinta utilizza la panchina anteriore dalla tappa 3.
    beginLayer(0, 3);
    beginObject(true);
    beginFigure("pregnant",5.25,-.75);
    addPregnant3D(5.25,-.75);
    beginLayer(3);
    beginObject(true);
    beginFigure("pregnantSeated",2.9,.9);
    addPregnantSeated3D(2.9,.9);

    endFigure();
    beginLayer(0);
    beginObject();
  }

  function addCarWheel(cx,cy,side,centerZ=.34,radius=.21,solidTarget=carSolids,detailTarget=carDetails,halfTrack=.47) {
    const y=cy+side*halfTrack;
    const segments=14;
    const ring=Array.from({length:segments},(_,i)=>{
      const a=i/segments*Math.PI*2;
      return point(cx+Math.cos(a)*radius,y,centerZ+Math.sin(a)*radius);
    });
    for(let i=0;i<segments;i++) addTube(solidTarget,ring[i],ring[(i+1)%segments],.028,CAST.shoe,5,{className:"face face--vehicle",doubleSided:true});
    const hub=point(cx,y,centerZ);
    [0,2,4,6,8,10,12].forEach((i)=>addTube(detailTarget,hub,ring[i],.011,CAST.metalHi,5,{className:"face face--vehicle",doubleSided:true}));
    addEllipsoid(detailTarget,hub.x,hub.y,hub.z,.058,.028,.058,CAST.metal,0,{className:"face face--vehicle",doubleSided:true},8);
  }

  function addCarModel() {
    const y=CAR_LANE_Y;
    addFace(carGround,[point(-1.02,y-.43,.145),point(1.02,y-.43,.145),point(1.02,y+.43,.145),point(-1.02,y+.43,.145)],C.ink,{x:0,y:0,z:1},{stroke:"none",opacity:.12});
    addBox(carSolids,-.94,y-.42,.94,y+.42,.34,
      {top:C.carTop,xp:C.car,xn:C.carSide,yp:C.car,yn:C.carSide},.15,{className:"face face--vehicle"});
    addBox(carSolids,-1.01,y-.38,-.9,y+.38,.12,
      {top:C.stoneSide,xp:C.stoneSide,xn:C.stoneDark,yp:C.stoneSide,yn:C.stoneDark},.19,{className:"face face--vehicle"});
    addBox(carSolids,.9,y-.38,1.01,y+.38,.12,
      {top:C.stoneSide,xp:C.stoneSide,xn:C.stoneDark,yp:C.stoneSide,yn:C.stoneDark},.19,{className:"face face--vehicle"});

    const brm=point(-.5,y-.35,.49),bfm=point(.5,y-.35,.49),bfp=point(.5,y+.35,.49),brp=point(-.5,y+.35,.49);
    const trm=point(-.29,y-.3,.82),tfm=point(.33,y-.3,.82),tfp=point(.33,y+.3,.82),trp=point(-.29,y+.3,.82);
    addFace(carSolids,[bfm,bfp,tfp,tfm],C.carGlass,{x:1,y:0,z:.52},{className:"face face--vehicle"});
    addFace(carSolids,[brp,brm,trm,trp],"#6B8089",{x:-1,y:0,z:.45},{className:"face face--vehicle"});
    addFace(carSolids,[bfp,brp,trp,tfp],C.carGlass,{x:0,y:1,z:.18},{className:"face face--vehicle"});
    addFace(carSolids,[brm,bfm,tfm,trm],"#6F8790",{x:0,y:-1,z:.18},{className:"face face--vehicle"});
    addBox(carSolids,-.34,y-.32,.39,y+.32,.07,
      {top:C.carTop,xp:C.car,xn:C.carSide,yp:C.car,yn:C.carSide},.8,{className:"face face--vehicle"});

    [-.6,.58].forEach((x)=>{ addCarWheel(x,y,-1); addCarWheel(x,y,1); });

    [-.23,.23].forEach((side)=>{
      addFace(carDetails,[point(.946,y+side-.07,.27),point(.946,y+side+.07,.27),point(.946,y+side+.07,.37),point(.946,y+side-.07,.37)],C.carLight,{x:1,y:0,z:0},{className:"face face--vehicle"});
      addFace(carDetails,[point(-.946,y+side+.07,.27),point(-.946,y+side-.07,.27),point(-.946,y+side-.07,.37),point(-.946,y+side+.07,.37)],C.carTail,{x:-1,y:0,z:0},{className:"face face--vehicle"});
    });
  }

  // ── La piazza, allargata ───────────────────────────────────────────────
  // Era 13,2 x 11,6 con un'area utile di circa 11,3 x 7,2: stretta per una
  // scena che dovra' ospitare, una tappa alla volta, filari d'alberi, una
  // pergola, sedute, una fontana, una fascia di suolo vivo e una fermata,
  // senza che nessuno di questi pezzi finisca addosso agli altri o copra le
  // persone. Ora l'area utile e' 18,4 x 12,6: due volte e mezzo lo spazio,
  // con il fronte edificato che cresce da due a tre corpi per non lasciare
  // il lato lungo vuoto.
  //
  // La scala non si ritara: ci pensa computeFit().
  // Il lato verso la strada guadagna 1,9: e' il fronte dove arriveranno la
  // fermata e gli attraversamenti, ed era il piu' stretto dei due.
  // ── La strada, prima e dopo ───────────────────────────────────────────────
  // Fino alla tappa 6 la sezione è quella di sempre: marciapiede e due corsie,
  // 2,1 metri d'asfalto. All'ultima tappa la strada si RIFÀ: la fascia contro
  // il marciapiede diventa ciclabile, la carreggiata si sposta in fuori e la
  // sezione si allarga fino a 3,4. Non è asfalto regalato alle auto — è il
  // contrario: le auto vengono spostate e in mezzo, fra loro e il marciapiede,
  // entra la corsia delle bici. Farlo vedere COME UN CAMBIO della strada, e non
  // come una corsia dipinta su una strada che era già larga, è tutto il punto.
  const ROAD = { narrow: 12.2, wide: 13.5 };
  const CYCLE = { y0: 10.1, y1: 11.4 };

  const PIAZZA = {
    x0: -10.2, y0: -6.6, x1: 10.2, y1: 9.3,   // lastra
    kerbY: 10.1,                               // fine marciapiede
    roadY: ROAD.wide,                          // fine sezione stradale (a rifacimento avvenuto)
    innerX: 9.2, frontY: -6.2, backY: 8.3,     // area utile
    sagratoY: -2.3,                            // fine del sagrato davanti alle case
  };

  // Le auto e l'autobus stanno al centro della carreggiata: che si sposta,
  // quando la ciclabile si prende la corsia interna.
  const CAR_LANE = {
    before: (PIAZZA.kerbY + ROAD.narrow) / 2,   // 11,15
    after: (CYCLE.y1 + ROAD.wide) / 2,          // 12,45
  };
  // I veicoli sono COSTRUITI sulla corsia di prima; nel disegno vengono
  // traslati sulla corsia in vigore, che è una sottrazione fra due proiezioni
  // e non una seconda geometria da tenere allineata.
  const CAR_LANE_Y = CAR_LANE.before;
  const laneY = () => (renderStep >= 7 ? CAR_LANE.after : CAR_LANE.before);
  const roadEdge = () => (renderStep >= 7 ? ROAD.wide : ROAD.narrow);
  // La panchina su cui si siede la signora: la posizione serve sia alla
  // panchina sia alla figura, e devono restare la stessa cosa.
  const BENCH_ELDER = { x: -7.3, y: 4.9 };

  // ── L'ingombro del portico ─────────────────────────────────────────────
  // Non sono numeri di comodo: il braccio di sinistra occupa una fascia del
  // fianco della piazza, e TUTTO quello che ci finirebbe dentro (la
  // tettoia, la fontanella, il prato, la siepe, le righe del selciato) deve
  // sapere dove fermarsi. Tenerli qui evita che al prossimo ritocco del
  // portico qualcosa gli ricresca addosso.
  const PORTICO = {
    backY: -3.26,                    // filo esterno del braccio di fondo
    leftX: -9.75,                    // filo esterno del braccio di sinistra
    endY: 7.4,                       // dove finisce il braccio di sinistra
  };
  PORTICO.frontX = PORTICO.leftX + PORTICO_DEPTH; // filo delle colonne: -8.81
  PORTICO.clearX = PORTICO.frontX + .21;          // primo x libero davanti: -8.6

  // ── L'ingombro della pergola ──────────────────────────────────────────────
  // Come per il portico: qui, e non sparso nelle chiamate, perché ci sono altre
  // cinque cose che devono sapere dove finisce — le panche che ci stanno sotto,
  // l'uccellino sulla trave, il giardino di pioggia che le corre davanti, il
  // percorso tattile che le passa accanto. `shift` è di quanto è arretrata
  // rispetto alla posizione di prima: serve a chi la deve seguire.
  const PERGOLA = { x0: -3.9, y0: 2.2, x1: 2.6, y1: 5.2, shift: -1.1 };

  // ══════════════════════════════════════════════════════════════════════
  //  GLI INGREDIENTI DEL RIFUGIO
  //  Uno per tappa, nell'ordine di climateRelief.js: ombra · riparo
  //  continuo · sosta · acqua · verde e suolo vivo · accessibilita'.
  // ══════════════════════════════════════════════════════════════════════

  const G = {
    bark: "#8A6A46", barkDark: "#6E5336",
    leafLight: "#8FB877", leaf: "#6E9A5C", leafDark: "#527C46",
    slat: "#B0966A", slatDark: "#8E7853", post: "#9A7B58",
    canvas: "#DFD3B4", canvasSide: "#C7BA98",
    benchWood: "#B58A5C", benchWoodDark: "#966E45", benchLeg: "#5E6A56",
    stone: "#CBBDA0", stoneDark: "#A99B7E",
    water: "#A9C9D6", waterDeep: "#7FB0C4", waterFoam: "#DCEDF3",
    metal: "#8A968F", metalDark: "#6E7A82",
    grass: "#94B37E", grassDark: "#7B9C68", soil: "#9C8663",
    shelterGlass: "#DCE7E0",
  };

  // ── Tappa 1 · Ombra naturale ──────────────────────────────────────────
  // Un albero e' il primo pezzo e il piu' importante: e' l'unico che fa
  // ombra SENZA costruire niente. La chioma e' fatta di lobi sovrapposti e
  // non di una palla sola, perche' una palla legge come un lecca-lecca; i
  // lobi danno il bordo frastagliato che si riconosce come fogliame.
  const SOFT = { className: "face face--soft", doubleSided: true };

  // ── Una massa sola, non sfere sovrapposte ──────────────────────────────
  // Le chiome erano cinque ellissoidi accavallati. Ognuno e' un solido
  // chiuso, e l'ordine del pittore li confronta per centroide: ruotando, la
  // classifica fra i lobi si inverte di continuo e la chioma sfarfalla.
  // Non e' un difetto di taratura, e' quello che succede sempre quando due
  // solidi si compenetrano.
  //
  // Qui la chioma e' UNA superficie chiusa il cui raggio viene deformato
  // vertice per vertice. I vertici sono condivisi fra le facce adiacenti,
  // quindi non ci sono ne' crepe ne' compenetrazioni: niente da riordinare,
  // niente da far sfarfallare. E costa un quinto dei poligoni.
  function addBlob(target, cx, cy, cz, rx, ry, rz, fill, seed = 0, lon = 12, options = {}) {
    const lat = 7;
    const warp = (a, l) =>
      1 + .2 * Math.sin(l * 3 + seed * 2.1) * Math.cos(a * 2.3 + seed * 1.3)
        + .12 * Math.sin(l * 5.3 - seed * 3.7)
        + .08 * Math.cos(a * 3.1 + seed * .9);
    const rows = [];
    for (let i = 0; i <= lat; i++) {
      const a = -Math.PI / 2 + (i / lat) * Math.PI;
      // Sotto la chioma e' piu' piatta che sopra: e' li' che si appoggia
      // all'aria e che si legge il bordo dell'ombra.
      const squash = a < 0 ? 1 + a / Math.PI * .7 : 1;
      const row = [];
      for (let j = 0; j < lon; j++) {
        const l = (j / lon) * Math.PI * 2;
        const w = (i === 0 || i === lat) ? 1 : warp(a, l);
        row.push(point(
          cx + rx * w * Math.cos(a) * Math.cos(l),
          cy + ry * w * Math.cos(a) * Math.sin(l),
          cz + rz * w * squash * Math.sin(a),
        ));
      }
      rows.push(row);
    }
    for (let i = 0; i < lat; i++) for (let j = 0; j < lon; j++) {
      const j2 = (j + 1) % lon;
      const p0 = rows[i][j], p1 = rows[i][j2], p2 = rows[i + 1][j2], p3 = rows[i + 1][j];
      const n = vNormal({
        x: (p0.x + p1.x + p2.x + p3.x) / 4 - cx,
        y: (p0.y + p1.y + p2.y + p3.y) / 4 - cy,
        z: (p0.z + p1.z + p2.z + p3.z) / 4 - cz,
      });
      const toned = surfaceTone(fill, n);
      const f = options.softness ? mixHex(toned, fill, options.softness) : toned;
      addFace(target, [p0, p1, p2, p3], f, n, { ...options, stroke: f });
    }
  }

  // ── Il tondo di terra ──────────────────────────────────────────────────
  // Un albero non si pianta sulla pietra. Sotto ogni chioma c'e' il suo
  // disco di terra, con il cordolo che lo trattiene: alla tappa 5, quando
  // arriva il suolo vivo, la terra nuda diventa erba e i dischi si saldano
  // alla fascia verde. E' lo stesso pezzo, in due stati.
  function addTreePit(cx, cy, radius, earthFill, layer) {
    const seg = 14;
    const ring = (r, z) => Array.from({length: seg}, (_, i) => {
      const a = i / seg * Math.PI * 2;
      return point(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z);
    });
    const was = [currentLayer, currentGoneAt];
    beginLayer(layer.from, layer.until);
    addFace(groundSurfaces, ring(radius, .212), earthFill, {x:0,y:0,z:1}, {stroke:"none"});
    addLine(groundLines, [...ring(radius, .233), ring(radius, .233)[0]], {x:0,y:0,z:1},
      {className:"detail", stroke:"#8E7A57", opacity:.55});
    beginLayer(was[0], was[1]);
  }

  function addTree(cx, cy, height, radius, seed = 0) {
    beginObject();
    shadowPolygon(cx-radius*.72, cy-radius*.72, cx+radius*.72, cy+radius*.72, height*.82, .13);

    const rnd = (i) => Math.sin(seed * 12.9898 + i * 78.233) * .5 + .5;
    const j = (i) => rnd(i) - .5;

    // Terra nuda dalla tappa dell'albero fino al verde; poi erba.
    addTreePit(cx, cy, radius * .5, G.soil, { from: currentLayer, until: 5 });
    addTreePit(cx, cy, radius * .5, G.grass, { from: 5, until: null });

    const trunkTop = height * (.42 + rnd(9) * .1);
    const trunkOptions={...SOFT,depthGroup:`tree-${seed}-trunk`};
    const canopyOptions={...SOFT,softness:.8,depthGroup:`tree-${seed}-canopy`};
    addTaperedTube(solids, point(cx,cy,.2), point(cx,cy,trunkTop), .17, .105, G.bark, 8, trunkOptions);
    for (const s of [-1, 1]) {
      const a = (rnd(s) - .5) * 1.4;
      addTaperedTube(solids,
        point(cx, cy, trunkTop * .76),
        point(cx + Math.cos(a) * s * radius * .44, cy + Math.sin(a) * s * radius * .4, trunkTop + radius * .32),
        .07, .04, G.barkDark, 6, trunkOptions);
    }

    // Una chioma sola, deformata dal seme. La varieta' fra gli alberi sta
    // nella forma e nella tinta, non nel numero di palle sovrapposte.
    const tint = [G.leaf, G.leafDark, "#7FA968", "#6B9757", "#5F8C50"];
    addBlob(solids, cx + j(11) * radius * .16, cy + j(12) * radius * .16, height * .74,
      radius * (1 + j(13) * .12), radius * (.94 + j(14) * .12), radius * (.66 + j(15) * .14),
      // `softness` alta: la chioma deve avere un lato in luce e uno in
      // ombra, non quattordici faccette distinguibili una per una. Sotto
      // .7 si vedeva la maglia geodetica.
      tint[seed % tint.length], seed, 13, canopyOptions);
  }

  // ── Tappa 2 · Ombra continua ──────────────────────────────────────────
  // La pergola porta l'ombra dove gli alberi non arrivano, e soprattutto la
  // rende CONTINUA: e' il punto del capitolo. I travetti sono veri pezzi e
  // non una texture, cosi' l'ombra a terra e' rigata come dev'essere.
  function addPergola(x0, y0, x1, y1, height) {
    shadowPolygon(x0, y0, x1, y1, height * .92, .15);
    // Sette metri di pergola in una unità di profondità sola avrebbero lo
    // stesso difetto del portico e della tettoia: montanti e travi stanno in
    // punti diversi della piazza e vanno ordinati come tali, altrimenti la
    // pergola o passa tutta davanti a chi le siede sotto o tutta dietro.
    const id = `pergola-${x0}`;
    for (const px of [x0 + .18, x1 - .18]) for (const py of [y0 + .18, y1 - .18]) {
      beginPiece("y");
      addBox(solids, px-.11, py-.11, px+.11, py+.11, height,
        {top:G.post,xp:G.post,xn:G.barkDark,yp:G.post,yn:G.barkDark}, .18,
        { depthGroup: `${id}-post-${px}-${py}` });
    }
    // Travetti radi e sottili: fitti e alti leggevano come le sbarre di una
    // gabbia. Una pergola deve far passare la luce a strisce, non chiudere.
    const bays = Math.max(4, Math.round((x1 - x0) / .78));
    // Le due travi maestre si spezzano campata per campata, come la trave del
    // portico; ogni tratto porta con sé il travetto trasversale che gli sta
    // sopra, così legno orizzontale e verticale non possono separarsi.
    for (let i = 0; i <= bays; i++) {
      const sx = x0 + (x1 - x0) * (i / bays);
      const from = i === 0 ? x0 - .3 : x0 + (x1 - x0) * ((i - .5) / bays);
      const to = i === bays ? x1 + .3 : x0 + (x1 - x0) * ((i + .5) / bays);
      const group = { depthGroup: `${id}-bay-${i}` };
      for (const py of [y0 + .18, y1 - .18]) {
        beginPiece("x");
        addBox(solids, from, py-.13, to, py+.13, .22,
          {top:G.slat,xp:G.slatDark,xn:G.slatDark,yp:G.slat,yn:G.slatDark}, height + .18, group);
      }
      beginPiece("pop");
      addBox(solids, sx-.035, y0-.05, sx+.035, y1+.05, .075,
        {top:G.slat,xp:G.slatDark,xn:G.slatDark,yp:G.slat,yn:G.slatDark}, height + .4, group);
    }

    // ── Il rampicante ────────────────────────────────────────────────────
    // Una pianta che copre una pergola SEGUE la struttura: sale avvolgendo
    // i montanti, corre lungo le travi, e la foglia pende attraverso i
    // travetti verso il basso. La versione precedente erano palle appoggiate
    // sopra il colmo, e non diceva niente: non si capiva ne' che fosse una
    // pianta ne' che facesse ombra. Sono i tralci lungo la struttura e le
    // foglie che pendono a dire tutte e due le cose.
    // ── E il rampicante si ordina COME il legno a cui sta attaccato ────────
    // Il legno è già spezzato in montanti e campate perché sette metri di
    // pergola ordinati dal proprio centro passano o tutti davanti o tutti
    // dietro. Il verde no: non aveva nessun gruppo di profondità, quindi
    // spirali, tralci e cuscini di foglie — sette metri di roba — finivano
    // TUTTI in un'unità sola, ordinata dal centro della pergola. Da certe
    // rotazioni la fogliame della campata lontana passava davanti al legno
    // vicino, da altre le foglie vicine sparivano dietro la trave in fondo.
    //
    // È lo stesso difetto, e ha la stessa cura: ogni pezzo di verde entra nel
    // gruppo del pezzo di legno su cui cresce. La spirale va con il suo
    // montante, il tralcio e le foglie con la loro campata. Da lì in poi verde
    // e legno non possono più separarsi, a nessun angolo.
    const topZ = height + .48;
    const bayAt = (x) =>
      Math.max(0, Math.min(bays, Math.round((x - x0) / (x1 - x0) * bays)));
    const VINE_DETAIL = {
      ...SOFT, dragSkip:true, noBuild:true,
      revealAfterBuild:true, revealDelay:220,
      revealGroup:"pergola-green", doubleSided:true,
    };
    const vineOn = (group) => ({ ...VINE_DETAIL, depthGroup: group });
    // Durante il trascinamento il rampicante conserva volume e colore con
    // una copertura semplificata; la geometria minuta torna al rilascio. Anche
    // lei si spezza per campata: è la versione che si vede proprio mentre si
    // ruota, cioè quando un ordinamento sbagliato si nota di più.
    const COVER = {className:"face face--soft",stroke:"none",opacity:.82,doubleSided:true,dragOnly:true,revealGroup:"pergola-green"};
    for (let i = 0; i < bays; i++) {
      const a = x0 + (x1 - x0) * (i / bays);
      const b = x0 + (x1 - x0) * ((i + 1) / bays);
      addFace(solids,[point(a,y0,topZ),point(b,y0,topZ),point(b,y1,topZ),point(a,y1,topZ)],
        G.leaf,{x:0,y:0,z:1},{...COVER, depthGroup:`${id}-bay-${bayAt((a + b) / 2)}`});
    }
    for (const px of [x0 + .18, x1 - .18]) for (const py of [y0 + .18, y1 - .18]) {
      addTaperedTube(solids,point(px,py,.3),point(px,py,height),.035,.025,G.leafDark,4,
        {className:"face face--soft",doubleSided:true,dragOnly:true,revealGroup:"pergola-green",
         depthGroup:`${id}-post-${px}-${py}`});
    }
    beginPiece("grow");
    for (const px of [x0 + .18, x1 - .18]) for (const py of [y0 + .18, y1 - .18]) {
      // Il fusto si avvita al montante invece di stargli accanto — e si
      // ordina insieme a lui.
      const onPost = vineOn(`${id}-post-${px}-${py}`);
      const turns = 5;
      let prev = point(px + .13, py, .3);
      for (let s = 1; s <= turns * 4; s++) {
        const t = s / (turns * 4);
        const a = t * turns * Math.PI * 2;
        const q = point(px + Math.cos(a) * .13, py + Math.sin(a) * .13, .3 + t * (height - .15));
        addTaperedTube(solids, prev, q, .028, .026, G.leafDark, 4, onPost);
        if (s % 3 === 0) {
          addBlob(solids, q.x + Math.cos(a) * .1, q.y + Math.sin(a) * .1, q.z,
            .17, .16, .1, s % 6 === 0 ? G.leaf : G.leafDark, s, 7, { ...onPost, softness: .72 });
        }
        prev = q;
      }
    }
    // Sulle travi: tralci orizzontali e foglie che ricadono FRA i travetti.
    // Il tralcio si spezza campata per campata come la trave che segue: un
    // filo lungo sette metri, ordinato dalla propria metà, tornerebbe a
    // passare davanti a tutto o dietro a tutto.
    for (const py of [y0 + .2, y1 - .2]) {
      for (let i = 0; i < bays; i++) {
        const a = x0 + (x1 - x0) * (i / bays);
        const b = x0 + (x1 - x0) * ((i + 1) / bays);
        addTaperedTube(solids, point(a,py,topZ), point(b,py,topZ), .03, .03, G.leafDark, 4,
          vineOn(`${id}-bay-${bayAt((a + b) / 2)}`));
      }
    }
    const leaves = Math.max(7, Math.round((x1 - x0) / .52));
    for (let i = 0; i <= leaves; i++) {
      const t = (i + .5) / (leaves + 1);
      const gx = x0 + (x1 - x0) * t;
      const w = Math.sin(i * 12.9898 + 4.1) * .5 + .5;
      const gy = y0 + (y1 - y0) * (w * .82 + .09);
      const onBay = vineOn(`${id}-bay-${bayAt(gx)}`);
      // Cuscino appiattito a filo del colmo: e' cosi' che si vede una
      // pianta stesa su una pergola vista dall'alto.
      addBlob(solids, gx, gy, topZ + .04, .34 + w * .16, .3 + w * .14, .1 + w * .05,
        w > .55 ? G.leaf : G.leafDark, i * 3 + 1, 8, { ...onBay, softness: .68 });
      // Uno su tre pende sotto i travetti: e' la parte che fa ombra.
      if (i % 3 === 1) {
        addTaperedTube(solids, point(gx, gy, topZ), point(gx + (w - .5) * .18, gy, height + .1),
          .022, .016, G.leafDark, 4, onBay);
        addBlob(solids, gx + (w - .5) * .18, gy, height + .04,
          .16, .15, .19, G.leaf, i * 7 + 3, 7, { ...onBay, softness: .72 });
      }
    }
  }

  // Una tettoia a telo teso sopra il lato che la pergola non copre.
  // ── Ogni montante si ordina per conto suo ────────────────────────────────
  // La tettoia era UNA unità di profondità larga tre metri e mezzo. Ordinata
  // dal proprio centro, o passava tutta davanti o passava tutta dietro: alla
  // vista d'apertura il montante di sinistra copriva la panchina che gli sta
  // davanti, e quello di destra finiva dietro la fontanella che gli sta
  // dietro. Non è una taratura da aggiustare, è che i quattro montanti stanno
  // in quattro punti diversi della piazza e vanno ordinati come tali. Il telo
  // resta un pezzo solo: sta in alto, non ha niente con cui contendersi.
  function addCanopy(x0, y0, x1, y1, height) {
    shadowPolygon(x0, y0, x1, y1, height * .9, .14);
    const id = `canopy-${x0}-${y0}`;
    for (const px of [x0 + .16, x1 - .16]) for (const py of [y0 + .16, y1 - .16]) {
      beginPiece("y");
      addTaperedTube(solids, point(px,py,.18), point(px,py,height), .075, .058, G.metal, 6,
        { depthGroup: `${id}-post-${px}-${py}` });
    }
    const mid = (y0 + y1) / 2;
    const roof = { doubleSided: true, depthGroup: `${id}-roof` };
    beginPiece("pop");
    addFace(solids,[point(x0,y0,height),point(x1,y0,height),point(x1,mid,height+.42),point(x0,mid,height+.42)],
      G.canvas,{x:0,y:-.42,z:(mid-y0)},roof);
    beginPiece("pop");
    addFace(solids,[point(x0,mid,height+.42),point(x1,mid,height+.42),point(x1,y1,height),point(x0,y1,height)],
      G.canvasSide,{x:0,y:.42,z:(y1-mid)},roof);
    addLine(details,[point(x0,mid,height+.44),point(x1,mid,height+.44)],{x:0,y:0,z:1},
      {className:"detail",stroke:G.slatDark,opacity:.6,depthGroup:`${id}-roof`});
  }

  // ── Tappa 3 · Sosta ───────────────────────────────────────────────────
  // La seduta sta a 0,45 su una persona alta 1,72, cioe' a poco piu' di un
  // quarto. Era a 0,68 — il 40% — e con la seduta a quell'altezza chi ci si
  // sedeva restava alto quanto in piedi, e la panchina leggeva come un
  // tavolo. E' l'unica misura che qui non si puo' prendere a occhio.
  const BENCH_SEAT_Z = .45;

  function addBench(cx, cy, yaw = 0, length = 1.9) {
    const h = length / 2;
    shadowPolygon(cx-h*.9, cy-.34, cx+h*.9, cy+.34, .5, .1);
    const L = (f, s, z) => localPoint(cx, cy, f, s, z, yaw);
    for (const s of [-h + .3, h - .3]) {
      beginPiece("y");
      addOrientedBox(solids, L(0,s,0).x, L(0,s,0).y, .09, .52, BENCH_SEAT_Z - .2,
        figureMaterial(G.benchLeg,"#4E5A48","#44503E","#6E7C64"), .2, yaw, {});
    }
    for (const f of [-.17, -.01, .15]) {
      const c = L(f, 0, 0);
      beginPiece("x");
      addOrientedBox(solids, c.x, c.y, length, .14, .06,
        figureMaterial(G.benchWood,G.benchWoodDark,G.benchWoodDark,"#C89C6C"), BENCH_SEAT_Z, yaw, {});
    }
    // Schienale: due doghe, inclinate solo quel tanto che basta a leggerlo
    // come schienale e non come parapetto.
    for (const [z, back] of [[BENCH_SEAT_Z + .2, -.22], [BENCH_SEAT_Z + .35, -.25]]) {
      const c = L(back, 0, 0);
      beginPiece("x");
      addOrientedBox(solids, c.x, c.y, length, .07, .11,
        figureMaterial(G.benchWood,G.benchWoodDark,G.benchWoodDark,"#C89C6C"), z, yaw, {});
    }
    for (const s of [-h + .3, h - .3]) {
      const c = L(-.23, s, 0);
      beginPiece("y");
      addOrientedBox(solids, c.x, c.y, .08, .09, .5, figureMaterial(G.benchLeg), BENCH_SEAT_Z - .04, yaw, {});
    }
  }

  // ── Il tavolo da picnic ───────────────────────────────────────────────
  // Sta nella fascia di prato dietro, al bordo dell'ombra dell'albero di
  // sinistra, e arriva con il verde. Dice una cosa che il prato da solo non
  // dice: che li' ci si può STARE. Un prato vuoto è un'aiuola da guardare;
  // un tavolo è il segno che qualcuno ci porta il pranzo.
  //
  // I cavalletti si incrociano, come in un tavolo vero: due gambe dritte
  // per lato leggevano come una scrivania da giardino.
  function addPicnicTable(cx, cy) {
    const topZ = .2 + .74;
    const seatZ = .2 + .45;
    shadowPolygon(cx-.88, cy-.78, cx+.88, cy+.78, .82, .1);

    beginPiece("y");
    for (const sx of [cx-.62, cx+.62]) {
      addTaperedTube(solids, point(sx,cy-.66,.2), point(sx,cy+.18,topZ), .055, .045, G.benchLeg, 5, {});
      addTaperedTube(solids, point(sx,cy+.66,.2), point(sx,cy-.18,topZ), .055, .045, G.benchLeg, 5, {});
    }
    beginPiece("x");
    addTaperedTube(solids, point(cx-.62,cy,seatZ+.06), point(cx+.62,cy,seatZ+.06), .04, .04, G.benchLeg, 5, {});
    for (const sy of [cy-.62, cy+.62]) {
      beginPiece("x");
      addBox(solids, cx-.85, sy-.15, cx+.85, sy+.15, .06,
        {top:G.benchWood,xp:G.benchWoodDark,xn:G.benchWoodDark,yp:G.benchWood,yn:G.benchWoodDark}, seatZ);
    }
    beginPiece("x");
    addBox(solids, cx-.88, cy-.4, cx+.88, cy+.4, .07,
      {top:"#C89C6C",xp:G.benchWoodDark,xn:G.benchWoodDark,yp:G.benchWood,yn:G.benchWoodDark}, topZ);
  }

  // ── Tappa 4 · Acqua ───────────────────────────────────────────────────
  function addFountain(cx, cy, radius) {
    const seg = 16;
    const ring = (r, z) => Array.from({length: seg}, (_, i) => {
      const a = i / seg * Math.PI * 2;
      return point(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z);
    });
    shadowPolygon(cx-radius, cy-radius, cx+radius, cy+radius, .5, .1);

    // Prima si monta la vasca esterna.
    beginPiece("pop");
    const outer = ring(radius, .52);
    const outerBase = ring(radius, .2);
    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg;
      const a = (i + .5) / seg * Math.PI * 2;
      addFace(solids, [outerBase[i], outerBase[j], outer[j], outer[i]], G.stone,
        {x: Math.cos(a), y: Math.sin(a), z: 0});
    }

    // Il bordo superiore è un anello vero, non un disco pieno: così non
    // può coprire la superficie dell'acqua disegnata appena sotto.
    beginPiece("pop");
    const inner = ring(radius * .91, .52);
    const innerLow = ring(radius * .91, .49);
    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg;
      addFace(solids, [outer[i], outer[j], inner[j], inner[i]], G.stoneDark, {x:0,y:0,z:1});
      const a = (i + .5) / seg * Math.PI * 2;
      addFace(solids, [innerLow[j], innerLow[i], inner[i], inner[j]], G.stoneDark,
        {x:-Math.cos(a),y:-Math.sin(a),z:0});
    }

    // Poi arriva l'acqua, quasi a filo del bordo e chiaramente visibile.
    beginPiece("pop");
    addFace(solids, ring(radius * .89, .5), G.water, {x:0,y:0,z:1}, {stroke:"none",opacity:.92});
    addFace(solids, ring(radius * .69, .505), G.waterDeep, {x:0,y:0,z:1}, {stroke:"none",opacity:.6});
    addFace(solids, ring(radius * .36, .508), "#6B9EB6", {x:0,y:0,z:1}, {stroke:"none",opacity:.5});
    const reflection = Array.from({length:10},(_,i)=>{
      const a=Math.PI*.72+i/9*Math.PI*.55;
      return point(cx+Math.cos(a)*radius*.63,cy+Math.sin(a)*radius*.63,.514);
    });
    addFace(solids, reflection, "#CDEAF1", {x:0,y:0,z:1}, {stroke:"none",opacity:.42});

    beginPiece("pop");
    [0, 1, 2, 3].forEach((i) => {
      addFace(solids, ring(radius * .86, .512), G.waterFoam, {x:0,y:0,z:1},
        { className: "face water-ring", stroke: "none", ripple: i * 1.125 });
    });

    // Infine si attivano gli zampilli, uno dopo l'altro.
    const jets = [[0, 0, 1.5, 0], [-radius*.42, 0, .95, .5], [radius*.44, radius*.1, 1.05, .95],
                  [radius*.1, -radius*.44, .82, 1.4], [-radius*.14, radius*.42, .88, 1.85]];
    for (const [dx, dy, hh, delay] of jets) {
      beginPiece("y");
      addTaperedTube(solids, point(cx+dx,cy+dy,.5), point(cx+dx,cy+dy,.5+hh), .062, .026, G.waterFoam, 7,
        { className:"face face--soft water-jet", opacity:.82, jet: delay });
      addBlob(solids, cx+dx, cy+dy, .5+hh+.09, .1, .1, .1, G.waterFoam, 3,
        7, { className:"face face--soft water-jet", opacity:.75, softness:.8, jet: delay });
      for (const side of [-1, 1]) {
        addTaperedTube(solids,
          point(cx+dx, cy+dy, .5+hh*.86),
          point(cx+dx+side*hh*.3, cy+dy+side*hh*.1, .5+hh*.16),
          .028, .014, G.waterFoam, 5,
          { className:"face face--soft water-jet", opacity:.6, jet: delay + .25 });
      }
    }
  }

  function addDrinkingFountain(cx, cy) {
    shadowPolygon(cx-.24, cy-.24, cx+.24, cy+.24, 1.1, .1);
    beginPiece("y");
    addBox(solids, cx-.16, cy-.16, cx+.16, cy+.16, 1.02,
      {top:G.metalDark,xp:G.metal,xn:"#5E6A72",yp:G.metal,yn:"#5E6A72"}, .18);
    beginPiece("pop");
    addBox(solids, cx-.22, cy-.22, cx+.22, cy+.22, .1,
      {top:G.stone,xp:G.stoneDark,xn:G.stoneDark,yp:G.stone,yn:G.stoneDark}, 1.2);
    beginPiece("x");
    addTaperedTube(solids, point(cx,cy+.16,1.16), point(cx,cy+.42,1.06), .04, .032, G.metalDark, 6, {});
    // ── Il getto ──────────────────────────────────────────────────────────
    // Una fontanella che non butta e' un paletto. Il filo d'acqua e' un
    // arco spezzato in quattro tratti: parte orizzontale dal beccuccio e
    // cade, che e' l'unico modo in cui si legge come acqua che esce e non
    // come un tubo appeso.
    const arc = [[0, 1.04], [.16, .96], [.28, .78], [.36, .5], [.4, .22]];
    for (let i = 0; i < arc.length - 1; i++) {
      addTaperedTube(solids,
        point(cx, cy + .42 + arc[i][0], arc[i][1]),
        point(cx, cy + .42 + arc[i+1][0], arc[i+1][1]),
        .026 - i * .003, .023 - i * .003, G.waterFoam, 5,
        { className:"face face--soft water-jet", opacity:.8, jet: i * .12 });
    }
    // La pozza dove ricade, e gli spruzzi.
    addFace(solids, Array.from({length: 12}, (_, i) => {
      const a = i / 12 * Math.PI * 2;
      return point(cx + Math.cos(a) * .3, cy + .82 + Math.sin(a) * .22, .212);
    }), G.water, {x:0,y:0,z:1}, {stroke:"none", opacity:.7});
    addBlob(solids, cx, cy + .82, .26, .13, .1, .09, G.waterFoam, 5, 7,
      { className:"face face--soft water-jet", opacity:.7, softness:.8, jet:.6 });
  }

  // ── Gli uccelli ────────────────────────────────────────────────────────
  // Non sono un ornamento: arrivano CON l'acqua, ed e' il motivo per cui
  // arrivano. Un posto dove si posa un passero e' un posto vivo, e lo dice
  // meglio di qualunque etichetta. Per questo compaiono alla tappa 4 e non
  // prima: prima non ci sarebbe niente per cui venire.
  function addBird(cx, cy, cz, yaw, seed, delay) {
    const anim = { className: "face face--soft bird", perch: delay };
    addBlob(solids, cx, cy, cz + .09, .1, .075, .075, "#5C6B58", seed, 7, { ...anim, softness:.8 });
    const tail = localPoint(cx, cy, -.13, 0, cz + .1, yaw);
    addTaperedTube(solids, point(cx,cy,cz+.09), tail, .035, .012, "#4E5C4A", 5, anim);
    addBlob(solids, ...(() => { const h = localPoint(cx, cy, .075, 0, cz + .16, yaw); return [h.x, h.y, h.z]; })(),
      .05, .045, .05, "#5C6B58", seed + 2, 6, { ...anim, softness:.8 });
    const beak = localPoint(cx, cy, .14, 0, cz + .155, yaw);
    addTaperedTube(solids, localPoint(cx,cy,.09,0,cz+.16,yaw), beak, .016, .006, "#C98526", 4, anim);
    for (const s of [-1, 1]) {
      addTaperedTube(solids, localPoint(cx,cy,.01,s*.05,cz+.02,yaw),
        localPoint(cx,cy,.02,s*.05,cz-.05,yaw), .011, .009, "#8E6437", 4, anim);
    }
  }

  // ── Tappa 5 · Verde e suolo vivo ──────────────────────────────────────
  // Non e' un prato decorativo: e' il suolo che torna permeabile. Sta a
  // quota leggermente piu' bassa del selciato, come un'aiuola in scavo,
  // perche' e' li' che la pioggia deve poter entrare.
  // `flowerSpots` sono coppie (frazione lungo x, frazione lungo y, quanti
  // fiori, quanto sparsi): servono per la fascia dietro le case, che e'
  // lunga e bassa e va fiorita in modo diverso da una toppa quadrata.
  function addGreenPatch(x0, y0, x1, y1, flowerSpots = null) {
    addFace(groundSurfaces, [point(x0,y0,.213),point(x1,y0,.213),point(x1,y1,.213),point(x0,y1,.213)],
      G.grass, {x:0,y:0,z:1}, {stroke:"none"});
    addLine(groundLines, [point(x0,y0,.232),point(x1,y0,.232),point(x1,y1,.232),point(x0,y1,.232),point(x0,y0,.232)],
      {x:0,y:0,z:1}, {className:"aiuola-line",stroke:G.grassDark,opacity:.5});
    // Ciuffi: pochi segni, sparsi, per dire "erba" senza disegnarla tutta.
    // Hanno una classe diversa dal BORDO, e non per lo stile — sono disegnati
    // uguali. Il bordo deve sopravvivere alla rotazione, altrimenti l'aiuola
    // perde il contorno e il suolo lampeggia; i ciuffi no: sono segni da due
    // pixel che mentre la piazza gira non legge nessuno, e la semplificazione
    // del trascinamento li lascia fuori con tutto il resto del pelo corto.
    const nx = Math.max(2, Math.round((x1 - x0) / 1.35));
    const ny = Math.max(2, Math.round((y1 - y0) / 1.15));
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      const gx = x0 + (x1 - x0) * ((i + .5) / nx);
      const gy = y0 + (y1 - y0) * ((j + .5) / ny);
      const k = Math.sin(i * 12.9 + j * 78.2) * .5 + .5;
      addLine(groundLines, [point(gx,gy,.235), point(gx + (k - .5) * .22, gy - .1, .235 + .22 + k * .12)],
        {x:0,y:0,z:1}, {className:"grass-tuft",stroke:G.grassDark,opacity:.72});
    }
    // I ciuffi dicono che e' erba; i fiori dicono che qualcuno se ne
    // occupa. Vanno su OGNI aiuola: la fascia dietro le case ne era
    // rimasta fuori solo perche' la condizione guardava la sua y.
    const spots = flowerSpots || [[.22,.42,5,.31],[.53,.58,4,.26],[.76,.36,4,.24]];
    spots.forEach(([u,v,n,spread],i) => {
      addFlowerCluster(x0+(x1-x0)*u, y0+(y1-y0)*v, n, spread, .22, Math.round((x0+x1*3)*7)+i*13);
    });
  }

  // Un giardino di pioggia: la fascia in leggero scavo dove l'acqua del
  // temporale si raccoglie e se ne va nel terreno invece che in fogna. E'
  // il pezzo che spiega perche' "suolo vivo" non vuol dire "prato".
  // ── Il giardino di pioggia ────────────────────────────────────────────────
  // Era una lingua d'erba dello stesso verde della pergola e del prato, e in
  // mezzo a tutto quel verde non diceva niente: sembrava un'aiuola stretta,
  // e a ridosso della pergola i due verdi si accavallavano e si annullavano.
  //
  // Un giardino di pioggia si riconosce da tre cose, e ci sono tutte e tre:
  //  · e' IN SCAVO. Il fondo sta dieci centimetri sotto il selciato e ci si
  //    arriva per una sponda inclinata, non per un gradino. E' la conca che
  //    dice che l'acqua ci va a finire.
  //  · il fondo e' MINERALE, non erboso: ghiaia e sabbia scura bagnata, con un
  //    velo d'acqua che resta nei punti piu' bassi. E' un filtro, non un prato.
  //  · ci cresce roba da acqua: giunchi e carici, verdi freddi e bronzo, che
  //    stanno apposta lontani dal verde caldo di alberi e rampicante.
  function addRainGarden(x0, y0, x1, y1) {
    const R = {
      bank: "#9C9F7C",      // sponda erbosa, verde grigio
      bed: "#8A8674",       // fondo di ghiaia e sabbia
      wet: "#6F7A6E",       // il tratto piu' basso, sempre umido
      film: "#93B4B6",      // il velo d'acqua che resta dopo il temporale
      stone: "#B4AE9A",
      rush: "#6E8F76",      // verde freddo: non e' quello degli alberi
      rushDry: "#A98B4E",   // bronzo dei carici a fine stagione
      sedge: "#7FA08A",
    };
    const BED = .098;                       // quanto e' incassato il fondo
    const bank = .22;                       // larghezza della sponda inclinata
    const ix0 = x0 + bank, ix1 = x1 - bank;
    const iy0 = y0 + bank, iy1 = y1 - bank;

    // La sponda: quattro falde che scendono dal bordo al fondo. Sono facce
    // inclinate vere, non un contorno disegnato, quindi la conca si legge
    // anche di taglio e ruotando.
    const rim = (a, b, c, d, normal) => addFace(groundSurfaces, [a, b, c, d], R.bank, normal,
      { stroke: "none", doubleSided: true, depthGroup: "raingarden-bank" });
    rim(point(x0,y0,.207), point(x1,y0,.207), point(ix1,iy0,.207-BED), point(ix0,iy0,.207-BED), {x:0,y:-.4,z:1});
    rim(point(x1,y1,.207), point(x0,y1,.207), point(ix0,iy1,.207-BED), point(ix1,iy1,.207-BED), {x:0,y:.4,z:1});
    rim(point(x0,y1,.207), point(x0,y0,.207), point(ix0,iy0,.207-BED), point(ix0,iy1,.207-BED), {x:-.4,y:0,z:1});
    rim(point(x1,y0,.207), point(x1,y1,.207), point(ix1,iy1,.207-BED), point(ix1,iy0,.207-BED), {x:.4,y:0,z:1});

    // Il fondo, e dentro il fondo la parte che resta bagnata piu' a lungo.
    addFace(groundSurfaces,[point(ix0,iy0,.207-BED),point(ix1,iy0,.207-BED),point(ix1,iy1,.207-BED),point(ix0,iy1,.207-BED)],
      R.bed,{x:0,y:0,z:1},{stroke:"none",depthGroup:"raingarden-bed"});
    addFace(groundSurfaces,[point(ix0+.1,iy0+.5,.206-BED),point(ix1-.1,iy0+.5,.206-BED),
                            point(ix1-.1,iy1-.5,.206-BED),point(ix0+.1,iy1-.5,.206-BED)],
      R.wet,{x:0,y:0,z:1},{stroke:"none",opacity:.9,depthGroup:"raingarden-bed"});

    // Il velo d'acqua: due pozze basse e lucide, non una lastra continua.
    // Sono la prova che l'acqua ci si ferma prima di infiltrarsi. Si allungano
    // lungo il lato lungo dell'invaso, qualunque dei due sia.
    const wideBed = (ix1 - ix0) >= (iy1 - iy0);
    for (const [t, len] of [[.16, .26], [.58, .3]]) {
      const a0 = (wideBed ? ix0 : iy0) + ((wideBed ? ix1 - ix0 : iy1 - iy0)) * t;
      const a1 = a0 + ((wideBed ? ix1 - ix0 : iy1 - iy0)) * len;
      const pool = wideBed
        ? [point(a0,iy0+.1,.205-BED),point(a1,iy0+.1,.205-BED),point(a1,iy1-.1,.205-BED),point(a0,iy1-.1,.205-BED)]
        : [point(ix0+.1,a0,.205-BED),point(ix1-.1,a0,.205-BED),point(ix1-.1,a1,.205-BED),point(ix0+.1,a1,.205-BED)];
      addFace(groundSurfaces,pool,R.film,{x:0,y:0,z:1},
        {stroke:"none",opacity:.5,depthGroup:"raingarden-bed"});
    }

    // Il ciglio superiore: un filo per lato, che e' quello che si vede di una
    // conca quando la si guarda da lontano.
    for (const bx of [x0, x1]) {
      addLine(groundLines,[point(bx,y0,.231),point(bx,y1,.231)],{x:0,y:0,z:1},
        {className:"aiuola-line",stroke:"#7C7F62",opacity:.65});
    }

    // Ciottoli e ciuffi si distribuiscono lungo il lato LUNGO dell'invaso,
    // qualunque dei due sia: la stessa funzione serve una lingua stretta lungo
    // l'asse e una fascia trasversale davanti alla pergola.
    const alongX = (ix1 - ix0) >= (iy1 - iy0);
    const span = alongX ? ix1 - ix0 : iy1 - iy0;
    // (t lungo il lato lungo, u attraverso) → punto sul fondo
    const at = (t, u) => alongX
      ? { x: ix0 + (ix1 - ix0) * t, y: iy0 + (iy1 - iy0) * u }
      : { x: ix0 + (ix1 - ix0) * u, y: iy0 + (iy1 - iy0) * t };

    // Ciottoli sul fondo, sparsi: la ghiaia che rallenta l'acqua in ingresso.
    // Ciottoli e giunchi escono di scena mentre si gira, come le ombre e come
    // il pelo corto del suolo: sono l'arredo del fondo, e il fondo — con la
    // conca, la sponda e le pozze — resta. Quello che si legge ruotando è la
    // forma dell'invaso, non la ghiaia che ci sta dentro.
    const seedAt = (i) => Math.sin(i * 12.9898 + 4.71) * .5 + .5;
    const stones = Math.max(6, Math.round(span / .72));
    for (let i = 0; i < stones; i++) {
      const k = seedAt(i);
      const p = at((i + .5) / stones, .2 + k * .6);
      addEllipsoid(solids, p.x, p.y, .215 - BED,
        .07 + k * .04, .06 + k * .03, .028, R.stone, 0,
        { ...SOFT, softness: .85, dragSkip: true, depthGroup: `raingarden-stone-${i}` }, 5);
    }

    // Giunchi e carici: ciuffi di steli, non cespugli tondi. Sono steli dritti
    // e sottili perche' e' cosi' che si distingue una pianta d'acqua da una
    // siepe, e sono di verde FREDDO per non confondersi con il rampicante e
    // con le chiome, che sono verdi caldi.
    const n = Math.max(4, Math.round(span / .62));
    for (let i = 0; i < n; i++) {
      const k = seedAt(i * 3);
      const p = at((i + .55) / n, .24 + k * .52);
      const tint = i % 5 === 0 ? R.rushDry : (i % 2 ? R.rush : R.sedge);
      const group = { ...SOFT, softness: .8, dragSkip: true, depthGroup: `raingarden-rush-${i}` };
      for (let s = 0; s < 5; s++) {
        const a = (s / 5) * Math.PI * 2 + k * 2.1;
        const lean = .12 + k * .07;
        const tall = .46 + ((s * 7 + i) % 4) * .09;
        addTaperedTube(solids,
          point(p.x + Math.cos(a) * .05, p.y + Math.sin(a) * .04, .21 - BED),
          point(p.x + Math.cos(a) * lean, p.y + Math.sin(a) * lean * .8, .21 - BED + tall),
          .026, .008, tint, 4, group);
      }
    }
  }

  // ── Un fiore e' UN poligono ────────────────────────────────────────────
  // Ogni fiore era una corolla di quattro petali piu' il bottone: cinque
  // ellissoidi da 24 facce l'uno, 120 poligoni per una macchia che sullo
  // schermo misura due pixel e mezzo. In tappa 5 facevano 6.050 poligoni —
  // il 38% dell'intera scena — ed erano loro, da soli, a portare il costo
  // della rotazione da 61 a 227 ms. Un dettaglio che nessuno poteva vedere
  // stava pagando il conto piu' salato del plastico.
  //
  // Adesso la corolla e' un esagono piatto: UNA faccia, disegnata a doppio
  // lato perche' alle inclinazioni basse la si guarda quasi da sotto. E'
  // una stilizzazione dichiarata, non un ripiego: a questa distanza un
  // fiore E' una macchia di colore su un gambo, e il gambo lo fa gia' la
  // linea. Centoventi poligoni diventano uno.
  //
  // `group` tiene insieme il ciuffo: tutti i fiori dello stesso gruppo sono
  // UNA unita' di profondita'. Prima ognuno aveva la propria, quindi si
  // ordinavano uno per uno contro siepi e vasi e si scavalcavano ruotando.
  function addFlowerCluster(cx, cy, count = 4, spread = .2, baseZ = .22, seed = 0, group = null, extra = null) {
    const petals=["#E7D4EA","#F2E4A6","#EDC5CF","#DCE5B0"];
    const depthGroup = group || `flowers-${seed}`;
    const R = .085;
    for(let i=0;i<count;i++){
      const a=(i/count)*Math.PI*2+seed*.47;
      const r=spread*(.35+((i*7+seed)%5)/7);
      const fx=cx+Math.cos(a)*r;
      const fy=cy+Math.sin(a)*r;
      const top=baseZ+.13+(i%3)*.025;
      addLine(details,[point(fx,fy,baseZ),point(fx,fy,top-.01)],{x:0,y:0,z:1},
        {className:"detail",stroke:"#648052",opacity:.72,doubleSided:true,depthGroup});
      addFace(solids, Array.from({length:6},(_,k)=>{
        const t = k/6*Math.PI*2 + a;
        return point(fx+Math.cos(t)*R, fy+Math.sin(t)*R*.92, top);
      }), petals[((seed+i)%petals.length+petals.length)%petals.length],
        {x:0,y:0,z:1}, {...SOFT, depthGroup, ...extra});
    }
  }

  // Sotto i cespugli c'era un parallelepipedo verde che faceva da anima
  // continua. Non serviva — i lobi si sovrappongono gia' fra loro e non
  // lasciano vuoti — e si vedeva: un muretto verde a spigoli vivi che
  // spuntava da dietro la siepe e ne contraddiceva la forma. Tolto.
  function addHedge(x0, y0, x1, y1, height) {
    shadowPolygon(x0, y0, x1, y1, height, .11);
    const id=`hedge-${x0}-${x1}`;
    const length=x1-x0;
    const n=Math.max(5,Math.round(length/.72));
    for(let i=0;i<n;i++){
      const t=(i+.5)/n;
      const k=Math.sin(i*9.17+x0*1.7)*.5+.5;
      const hx=x0+length*t;
      const hy=(y0+y1)/2+(k-.5)*.1;
      // Piu' bassi e piu' alti di quanto fossero: senza l'anima sotto,
      // devono arrivare loro fino a terra invece di poggiarcisi sopra.
      addBlob(solids,hx,hy,.2+height*.52,
        length/n*.66,(y1-y0)*1.2,height*(.62+k*.13),
        i%3===0?G.leafLight:(i%2?G.leaf:G.leafDark),i+31,7,
        {...SOFT,doubleSided:true,softness:.82,depthGroup:`${id}-${i}`});
    }
  }

  // ── Un vaso e' UN pezzo ────────────────────────────────────────────────
  // Cassa, chiome e fiori avevano ognuno il proprio gruppo di profondita':
  // nove unita' distinte, ordinate una per una contro tutto il resto della
  // piazza. Ruotando, la classifica fra loro si rimescolava e il verde si
  // staccava dalla cassa — una chioma che compariva davanti a una siepe che
  // le stava davanti. Un vaso e' largo un metro: ordinarlo tutto insieme dal
  // suo centro e' insieme piu' giusto e piu' economico.
  // Un vaso si monta anche in UN tempo solo, non in due. La cassa e il verde
  // avevano due componenti distinti, quindi due ritardi diversi, quindi le
  // centoquaranta facce del vaso non potevano condividere un'animazione sola
  // (vedi `unitAnimation`). Il guadagno di quel mezzo passo di racconto non
  // vale centoquaranta animazioni CSS: il vaso cresce dal suolo tutto insieme,
  // che per un vaso è anche più giusto.
  function addPlanter(cx, cy, w, d, height) {
    const group = `planter-${cx}-${cy}`;
    addBox(solids, cx-w/2, cy-d/2, cx+w/2, cy+d/2, height,
      {top:G.soil,xp:G.stone,xn:G.stoneDark,yp:G.stone,yn:G.stoneDark}, .2, {depthGroup:group});
    addBlob(solids, cx-w*.08, cy, .2 + height + .24, w*.18, d*.2, .24, G.leaf, 11, 9,
      {...SOFT,doubleSided:true,softness:.92,depthGroup:group});
    addBlob(solids, cx+w*.1, cy-.02, .2 + height + .25, w*.17, d*.19, .22, G.leafDark, 17, 9,
      {...SOFT,doubleSided:true,softness:.94,depthGroup:group});
    // I fiori del vaso escono di scena mentre si gira: sono sei esagoni da un
    // pixel appoggiati sopra il cespuglio, e il cespuglio resta.
    const wilt = { dragSkip: true };
    addFlowerCluster(cx-w*.18,cy+d*.18,3,.10,.2+height+.04,Math.round((cx+10)*7),group,wilt);
    addFlowerCluster(cx+w*.18,cy+d*.12,3,.095,.2+height+.04,Math.round((cx+12)*9),group,wilt);
  }

  // Il tetto verde stava qui, su UN edificio solo, alla tappa 5. E' stato
  // tolto: a questa scala e a questa distanza non leggeva come un tetto
  // coltivato, leggeva come un telo verde steso sulle tegole. Un pezzo che
  // devi spiegare non sta raccontando niente, e la tappa del suolo vivo ha
  // gia' la fascia a terra, il giardino di pioggia e i tondi degli alberi
  // per dire quello che deve dire.

  // ── Tappa 6 · Accessibilita' ──────────────────────────────────────────
  // Il rifugio funziona se ci si arriva. La fermata e' l'oggetto che lo
  // dice piu' in fretta; il percorso tattile e lo scivolo dicono per chi.
  function addBusStop(cx, cy) {
    const w = 3.4, d = 1.5, h = 2.55;
    shadowPolygon(cx-w/2, cy-d/2, cx+w/2, cy+d/2, h, .14);
    for (const px of [cx-w/2+.14, cx+w/2-.14]) for (const py of [cy-d/2+.14, cy+d/2-.14]) {
      beginPiece("y");
      addTaperedTube(solids, point(px,py,.2), point(px,py,h), .07, .055, G.metal, 6, {});
    }
    beginPiece("x");
    addBox(solids, cx-w/2-.16, cy-d/2-.16, cx+w/2+.16, cy+d/2+.16, .14,
      {top:G.metalDark,xp:G.metal,xn:"#5E6A72",yp:G.metal,yn:"#5E6A72"}, h);
    // Parete di fondo vetrata.
    beginPiece("y");
    addFace(solids,[point(cx-w/2,cy-d/2,.2),point(cx+w/2,cy-d/2,.2),point(cx+w/2,cy-d/2,h),point(cx-w/2,cy-d/2,h)],
      G.shelterGlass,{x:0,y:-1,z:0},{opacity:.55});
    // La panchina viene assemblata dopo la struttura della pensilina.
    addBench(cx, cy - d * .14, Math.PI / 2, w * .6);
    // Palina con il segnale.
    const px = cx + w / 2 + .8;
    beginPiece("y");
    addTaperedTube(solids, point(px,cy,.2), point(px,cy,2.5), .055, .045, G.metalDark, 6, {});
    beginPiece("pop");
    addBox(solids, px-.05, cy-.42, px+.05, cy+.42, .5,
      {top:"#E8A23C",xp:"#E8A23C",xn:"#C98526",yp:"#E8A23C",yn:"#C98526"}, 2.35);
  }

  // ── L'autobus ──────────────────────────────────────────────────────────
  // Compare con la fermata, e passa. Una pensilina senza autobus e' un
  // arredo; l'autobus che arriva e' cio' che rende vera l'accessibilita'.
  // Viaggia su una transform CSS come l'auto, con il proprio gruppo, quindi
  // il movimento non costa un ricalcolo per fotogramma.
  const busSolids = [];
  const busDetails = [];
  const busDoors = [];
  const busLod = [];
  const busGround = [];

  function addBusModel() {
    const y = CAR_LANE_Y;
    const B = { body:"#4F7A6B", side:"#41675A", top:"#7CA091", glass:"#93B4BC",
                glassDark:"#7E9DA6", trim:"#E8D9A8", skirt:"#37544A" };
    // Il tetto era a 1,52 con uno smusso di 14 cm per lato: il risultato
    // era un padiglione stretto fra due bordi rialzati, che visto
    // dall'alto leggeva come l'interno del mezzo invece che come la sua
    // copertura. Alzato a 1,68 e con lo smusso ridotto, il tetto torna a
    // essere la parte piu' alta dell'autobus.
    const L = 2.5, W = .56, Z0 = .3, Z1 = 1.68;      // semilunghezza, semilarghezza
    const BEVEL = .11;                               // rientro dello smusso di gronda
    const V = { className: "face face--vehicle", doubleSided:true };
    const Vq = { className: "face face--vehicle face--quiet", doubleSided:true };

    addFace(busGround,[point(-L-.1,y-W-.06,.145),point(L+.1,y-W-.06,.145),
      point(L+.1,y+W+.06,.145),point(-L-.1,y+W+.06,.145)],
      C.ink,{x:0,y:0,z:1},{stroke:"none",opacity:.14});

    // Cassa smussata in alto: uno scatolone dritto leggeva come un vagone.
    // Sono i due spigoli tagliati e il muso arretrato a farne un autobus.
    const nose = L - .3;
    const box = [
      [[-L,y-W,Z0],[nose,y-W,Z0],[nose,y-W,Z1-.16],[-L,y-W,Z1-.16], B.side, {x:0,y:-1,z:0}],
      [[-L,y+W,Z0],[nose,y+W,Z0],[nose,y+W,Z1-.16],[-L,y+W,Z1-.16], B.body, {x:0,y:1,z:0}],
    ];
    for (const [a,b,c,d,fill,n] of box) {
      addFace(busSolids,[point(...a),point(...b),point(...c),point(...d)],fill,n,V);
    }
    addFace(busSolids,[point(-L,y-W,Z1-.16),point(nose,y-W,Z1-.16),point(nose,y-W+BEVEL,Z1),point(-L,y-W+BEVEL,Z1)],
      B.side,{x:0,y:-.6,z:.5},V);
    addFace(busSolids,[point(-L,y+W,Z1-.16),point(nose,y+W,Z1-.16),point(nose,y+W-BEVEL,Z1),point(-L,y+W-BEVEL,Z1)],
      B.body,{x:0,y:.6,z:.5},V);
    addFace(busSolids,[point(-L,y-W+BEVEL,Z1),point(nose,y-W+BEVEL,Z1),point(nose,y+W-BEVEL,Z1),point(-L,y+W-BEVEL,Z1)],
      B.top,{x:0,y:0,z:1},V);
    // Muso inclinato e parabrezza.
    addFace(busSolids,[point(nose,y-W,Z0),point(L,y-W+.1,Z0+.12),point(L,y+W-.1,Z0+.12),point(nose,y+W,Z0)],
      B.body,{x:1,y:0,z:-.2},V);
    addFace(busSolids,[point(L,y-W+.1,Z0+.12),point(L,y+W-.1,Z0+.12),point(nose,y+W,Z1-.1),point(nose,y-W,Z1-.1)],
      B.glass,{x:.85,y:0,z:.35},Vq);
    addFace(busSolids,[point(nose,y-W,Z1-.1),point(nose,y+W,Z1-.1),point(nose,y+W-BEVEL,Z1),point(nose,y-W+BEVEL,Z1)],
      B.top,{x:1,y:0,z:.6},V);
    // Fascia scura sotto e mancorrente chiaro: danno la linea orizzontale
    // lunga che si riconosce come mezzo pubblico.
    addBox(busSolids,-L,y-W-.015,nose,y+W+.015,.2,
      {top:B.skirt,xp:B.skirt,xn:B.skirt,yp:B.skirt,yn:B.skirt},Z0-.02,V);
    addBox(busSolids,-L,y-W-.02,nose,y+W+.02,.07,
      {top:B.trim,xp:B.trim,xn:B.trim,yp:B.trim,yn:B.trim},1.1,V);
    // ── Le fasce vetrate sono decalcomanie ────────────────────────────────
    // Stanno 2 cm fuori dalla lamiera e coprono solo un tratto della
    // fiancata, mentre la lamiera e' lunga cinque metri: confrontando i
    // CENTROIDI, appena la rotazione fa pesare la x piu' della y il vetro
    // finisce «dietro» il metallo e sparisce. Il `depthBias` le stacca dal
    // proprio pannello una volta per tutte — dentro una fiancata il vetro
    // sta sempre davanti alla lamiera, a qualunque angolo la si guardi.
    const GLASS_BIAS = 3, MULLION_BIAS = 3.2;
    for (const [fixed,ny] of [[y+W+.02,1],[y-W-.02,-1]]) {
      addFace(busSolids,[point(-L+.2,fixed,.8),point(.46,fixed,.8),point(.46,fixed,1.34),point(-L+.2,fixed,1.34)],
        B.glass,{x:0,y:ny,z:0},{...Vq,depthBias:GLASS_BIAS,depthGroup:`bus-window-strip-${ny}-rear`});
      addFace(busSolids,[point(1.42,fixed,.8),point(nose-.08,fixed,.8),point(nose-.08,fixed,1.34),point(1.42,fixed,1.34)],
        B.glass,{x:0,y:ny,z:0},{...Vq,depthBias:GLASS_BIAS,depthGroup:`bus-window-strip-${ny}-front`});
      for (const x of [-1.36,-.56,.22,1.72]) {
        addLine(busDetails,[point(x,fixed,.8),point(x,fixed,1.34)],{x:0,y:ny,z:0},
          {className:"detail",stroke:"#456057",opacity:.48,doubleSided:true,depthBias:MULLION_BIAS,depthGroup:`bus-window-strip-${ny}`});
      }
      addFace(busDoors,[point(.62,fixed,Z0),point(.93,fixed,Z0),point(.93,fixed,1.34),point(.62,fixed,1.34)],
        B.glassDark,{x:0,y:ny,z:0},{className:"face face--vehicle face--quiet",doubleSided:true,depthBias:GLASS_BIAS,depthGroup:`bus-door-left-${ny}`});
      addFace(busDoors,[point(.97,fixed,Z0),point(1.28,fixed,Z0),point(1.28,fixed,1.34),point(.97,fixed,1.34)],
        B.glassDark,{x:0,y:ny,z:0},{className:"face face--vehicle face--quiet",doubleSided:true,depthBias:GLASS_BIAS,depthGroup:`bus-door-right-${ny}`});
      addLine(busDetails,[point(.95,fixed,Z0),point(.95,fixed,1.34)],{x:0,y:ny,z:0},
        {className:"detail",stroke:"#2E4A40",opacity:.7,doubleSided:true,depthBias:MULLION_BIAS,depthGroup:`bus-door-split-${ny}`});
    }
    // Il numero di linea sopra il parabrezza: e' il segno che dice
    // "servizio pubblico" piu' in fretta di qualunque altra cosa.
    addFace(busDetails,[point(L-.02,y-.34,1.2),point(L-.02,y+.34,1.2),
      point(L-.02,y+.34,1.42),point(L-.02,y-.34,1.42)],
      "#2B3A36",{x:1,y:0,z:0},{className:"face face--vehicle",doubleSided:true});
    addBox(busLod,-L,y-W,nose,y+W,Z1-Z0,
      {top:B.top,xp:B.body,xn:B.side,yp:B.body,yn:B.side},Z0,
      {className:"face face--vehicle",doubleSided:true});
    addFace(busLod,[point(nose,y-W,Z0),point(L,y-W+.1,Z0+.12),point(L,y+W-.1,Z0+.12),point(nose,y+W,Z0)],
      B.body,{x:1,y:0,z:-.2},{className:"face face--vehicle",doubleSided:true});
    for (const x of [-1.7, 1.5]) {
      addCarWheel(x,y,-1,.3,.28,busSolids,busDetails,.58);
      addCarWheel(x,y,1,.3,.28,busSolids,busDetails,.58);
    }

    // ── A quale fiancata appartiene ogni pezzo ──────────────────────────
    // Serve a disegnare l'autobus in un ordine che non dipende
    // dall'ordinamento per profondita' (vedi renderBus). Il criterio e' la
    // POSIZIONE, non la normale: le ruote hanno normali che puntano in
    // tutte le direzioni ma stanno inequivocabilmente da un lato.
    for (const list of [busSolids, busDetails, busDoors, busLod, busGround]) {
      for (const item of list) {
        const offset = item.points.reduce((s,p)=>s+p.y,0)/item.points.length - y;
        item.busSide = offset > .12 ? 1 : (offset < -.12 ? -1 : 0);
      }
    }
  }

  // ── Tappa 7 · Ci si arriva, e si riparte ──────────────────────────────────
  // L'ultima tappa tirava solo le somme: il disegno non cambiava più, e la
  // battuta finale restava senza niente da guardare. Qui arriva la cosa che
  // chiude il ragionamento: un rifugio serve se ci si arriva, e la bici è il
  // modo in cui ci si arriva da mezzo chilometro senza scaldare la città.
  //
  // La corsia NON è asfalto aggiunto: si prende la fascia contro il
  // marciapiede, che fino a un attimo prima era carreggiata. Il colore è quello
  // che si usa davvero — un rosso mattone spento — e i due filetti bianchi ai
  // lati sono ciò che, a questa distanza, la fa leggere come corsia e non come
  // una striscia di terra.
  function addCycleLane(x0, x1) {
    beginPiece("x");
    addFace(groundSurfaces,[point(x0,CYCLE.y0,.118),point(x1,CYCLE.y0,.118),
                            point(x1,CYCLE.y1,.118),point(x0,CYCLE.y1,.118)],
      "#A8705B",{x:0,y:0,z:1},{stroke:"none",opacity:.82,depthBias:.012});
    for (const ly of [CYCLE.y0 + .08, CYCLE.y1 - .08]) {
      addLine(groundLines,[point(x0,ly,.126),point(x1,ly,.126)],{x:0,y:0,z:1},
        {className:"aiuola-line",stroke:"#F2EAD8",opacity:.75});
    }
    // Frecce di corsia: due tratti a punta, radi. Bastano a dire il verso.
    for (let i = 0; i < 5; i++) {
      const ax = x0 + (x1 - x0) * ((i + .5) / 5);
      const my = (CYCLE.y0 + CYCLE.y1) / 2;
      addLine(groundLines,[point(ax-.28,my-.22,.127),point(ax+.22,my,.127),point(ax-.28,my+.22,.127)],
        {x:0,y:0,z:1},{className:"aiuola-line",stroke:"#F2EAD8",opacity:.62});
    }
  }

  // ── La rastrelliera ───────────────────────────────────────────────────────
  // Archetti in fila e un totem con il display: è come sono fatte le stazioni
  // di bike sharing, e si riconoscono da lontano proprio per quella coppia.
  // Le bici sono ridotte all'osso — due ruote, il triangolo del telaio, il
  // manubrio — perché a questa scala una bici È quello.
  function addBikeStation(cx, cy) {
    const id = `bike-${cx}`;
    const racks = 4, pitch = .62;
    const first = cx - (racks - 1) * pitch / 2;
    shadowPolygon(cx - 1.5, cy - .5, cx + 1.5, cy + .5, .9, .1);

    for (let i = 0; i < racks; i++) {
      const rx = first + i * pitch;
      const group = { depthGroup: `${id}-rack-${i}` };
      beginPiece("y");
      // L'archetto: due montanti e la piega in sommità.
      const top = .2 + .72;
      addTaperedTube(solids, point(rx,cy-.32,.2), point(rx,cy-.32,top-.1), .032, .03, G.metal, 5, group);
      addTaperedTube(solids, point(rx,cy+.32,.2), point(rx,cy+.32,top-.1), .032, .03, G.metal, 5, group);
      addTaperedTube(solids, point(rx,cy-.32,top-.1), point(rx,cy+.32,top-.1), .03, .03, G.metal, 5, group);
    }

    // Due bici agganciate. Le ruote sono anelli veri: un cerchio pieno a questa
    // scala legge come una rotella di formaggio, non come una ruota.
    const bike = (bx, by, tint) => {
      const group = { className: "face face--vehicle", doubleSided: true, depthGroup: `${id}-bike-${bx}` };
      const wheel = (wx) => {
        const seg = 11, r = .33;
        for (let i = 0; i < seg; i++) {
          const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2;
          addTaperedTube(solids,
            point(bx + wx + Math.cos(a0) * r, by, .2 + r + Math.sin(a0) * r),
            point(bx + wx + Math.cos(a1) * r, by, .2 + r + Math.sin(a1) * r),
            .022, .022, CAST.shoe, 4, group);
        }
      };
      wheel(-.5); wheel(.5);
      const hubBack = point(bx - .5, by, .2 + .33);
      const hubFront = point(bx + .5, by, .2 + .33);
      const saddle = point(bx - .28, by, .2 + .86);
      const bars = point(bx + .42, by, .2 + .82);
      const pedals = point(bx + .02, by, .2 + .3);
      for (const [a, b] of [[hubBack, saddle], [saddle, bars], [bars, pedals], [pedals, hubBack], [pedals, saddle], [bars, hubFront]]) {
        addTaperedTube(solids, a, b, .028, .026, tint, 4, group);
      }
      addTaperedTube(solids, point(bx + .42, by - .17, .2 + .84), point(bx + .42, by + .17, .2 + .84), .022, .022, CAST.shoe, 4, group);
      addOrientedBox(solids, bx - .3, by, .22, .1, .05, figureMaterial(CAST.shoe), .2 + .86, 0, group);
    };
    beginPiece("pop");
    bike(first + pitch * .5, cy - .06, "#C9663F");
    bike(first + pitch * 2.5, cy + .04, "#4E7F86");

    // Il totem del noleggio: la colonnina con il display, che è il segno che
    // dice «queste bici si possono prendere», non solo «qui si legano».
    const tx = cx + (racks - 1) * pitch / 2 + .95;
    const totem = { depthGroup: `${id}-totem` };
    beginPiece("y");
    addTaperedTube(solids, point(tx,cy,.2), point(tx,cy,1.62), .075, .062, G.metalDark, 6, totem);
    beginPiece("pop");
    addBox(solids, tx-.06, cy-.34, tx+.06, cy+.34, .52,
      {top:G.metalDark,xp:"#2E4A40",xn:"#2E4A40",yp:"#3E5F52",yn:"#3E5F52"}, 1.5, totem);
    addFace(details,[point(tx+.07,cy-.26,1.62),point(tx+.07,cy+.26,1.62),
                     point(tx+.07,cy+.26,1.92),point(tx+.07,cy-.26,1.92)],
      "#D9E4D2",{x:1,y:0,z:0},{className:"face face--quiet",depthGroup:`${id}-totem`});
  }

  function addTactilePath(x0, y0, x1, y1) {
    const along = Math.abs(x1 - x0) > Math.abs(y1 - y0);
    beginPiece(along ? "x" : "y");
    addFace(groundSurfaces,[point(x0,y0,.226),point(x1,y0,.226),point(x1,y1,.226),point(x0,y1,.226)],
      "#D9C89E",{x:0,y:0,z:1},{stroke:"none",opacity:.92,depthBias:.012,doubleSided:true});
    beginPiece("pop");
    const n = Math.max(4, Math.round(Math.abs(along ? x1 - x0 : y1 - y0) / .38));
    for (let i = 0; i < n; i++) {
      const t = (i + .5) / n;
      if (along) {
        const gx = x0 + (x1 - x0) * t;
        addLine(groundLines,[point(gx,y0+.08,.246),point(gx,y1-.08,.246)],{x:0,y:0,z:1},
          {className:"detail",stroke:"#A8946A",opacity:.84,depthBias:.012,doubleSided:true});
      } else {
        const gy = y0 + (y1 - y0) * t;
        addLine(groundLines,[point(x0+.08,gy,.246),point(x1-.08,gy,.246)],{x:0,y:0,z:1},
          {className:"detail",stroke:"#A8946A",opacity:.84,depthBias:.012,doubleSided:true});
      }
    }
  }

  function buildScene() {
    const Z = PIAZZA;
    addBox(baseFaces,Z.x0,Z.y0,Z.x1,Z.y1,.2,
      {top:C.paving,xp:C.stoneSide,xn:C.stoneDark,yp:C.stoneSide,yn:C.stoneDark});
    addBox(baseFaces,Z.x0-.4,Z.y1,Z.x1+.4,Z.kerbY,.23,
      {top:C.stoneSide,xp:C.stoneDark,xn:C.stoneDark,yp:C.stoneSide,yn:C.stoneDark});
    // Due sezioni stradali, una che se ne va e una che arriva: la seconda è la
    // stessa strada rifatta, non una strada in più. Nessuna delle due si monta
    // dal basso — una carreggiata non cresce, viene riasfaltata, e il pezzo che
    // deve raccontare il cambio è la ciclabile che ci compare sopra.
    const roadTone = {top:C.road,xp:C.roadSide,xn:C.roadSide,yp:C.roadSide,yn:C.roadSide};
    beginLayer(0, 7); beginObject(true);
    addBox(baseFaces,Z.x0-.6,Z.kerbY,Z.x1+.6,ROAD.narrow,.11,roadTone);
    beginLayer(7); beginObject(true);
    addBox(baseFaces,Z.x0-.6,Z.kerbY,Z.x1+.6,ROAD.wide,.11,roadTone);
    beginLayer(0); beginObject(true);

    // Tre famiglie di suolo: bordo, sagrato degli edifici e piazza centrale.
    addFace(groundSurfaces,[point(-9.8,-6.2,.205),point(9.8,-6.2,.205),point(9.8,Z.y1-.35,.205),point(-9.8,Z.y1-.35,.205)],C.pavingEdge,{x:0,y:0,z:1},{stroke:"none"});
    addFace(groundSurfaces,[point(-9.2,-6.2,.21),point(9.2,-6.2,.21),point(9.2,Z.sagratoY,.21),point(-9.2,Z.sagratoY,.21)],C.pavingForecourt,{x:0,y:0,z:1},{stroke:"none"});
    addFace(groundSurfaces,[point(-9.2,Z.sagratoY,.21),point(9.2,Z.sagratoY,.21),point(9.2,Z.backY,.21),point(-9.2,Z.backY,.21)],C.pavingCentre,{x:0,y:0,z:1},{stroke:"none"});

    // Soglie e asse di arrivo rendono leggibili gli accessi senza aggiungere testo.
    [[-7.6,-3.3],[-1.4,-3.5],[5.6,-3.3]].forEach(([dx,dy])=>{
      addFace(groundSurfaces,[point(dx-.55,dy+.02,.218),point(dx+.55,dy+.02,.218),point(dx+.55,dy+1.15,.218),point(dx-.55,dy+1.15,.218)],C.threshold,{x:0,y:0,z:1},{stroke:"none",opacity:.72});
    });
    addFace(groundSurfaces,[point(-.45,1.2,.216),point(.45,1.2,.216),point(.45,Z.backY,.216),point(-.45,Z.backY,.216)],"#D5C29C",{x:0,y:0,z:1},{stroke:"none",opacity:.34});

    // Canale di drenaggio al margine e attraversamento sulla strada.
    addFace(groundSurfaces,[point(-9.5,Z.backY+.18,.219),point(9.5,Z.backY+.18,.219),point(9.5,Z.backY+.42,.219),point(-9.5,Z.backY+.42,.219)],C.drain,{x:0,y:0,z:1},{stroke:"none",opacity:.62});
    // Attraversamento in asse con il percorso accessibile. Le bande sono
    // parallele alla strada e si susseguono nella direzione di attraversamento,
    // e coprono TUTTA la sezione: strisce che si fermano a metà lascerebbero il
    // pedone in mezzo alla carreggiata. Ce n'è quindi una versione per ogni
    // sezione, e la seconda arriva con il rifacimento.
    const crossing = (to) => {
      const from = Z.kerbY + .24;
      const bands = Math.round((to - .24 - from) / .31);
      for (let i = 0; i < bands; i++) {
        const y0 = from + i * ((to - .24 - from) / bands);
        addFace(groundSurfaces,[point(2.12,y0,.13),point(4.42,y0,.13),point(4.42,y0+.17,.13),point(2.12,y0+.17,.13)],
          "#F2EAD8",{x:0,y:0,z:1},{stroke:"none",opacity:.8,depthBias:.01});
      }
    };
    beginLayer(0, 7); crossing(ROAD.narrow);
    beginLayer(7); crossing(ROAD.wide);
    beginLayer(0);
    addFace(heatFaces,[point(-9.4,-5.4,.225),point(9.4,-5.4,.225),point(9.4,Z.backY-.2,.225),point(-9.4,Z.backY-.2,.225)],C.heat,{x:0,y:0,z:1},{className:"face heat-wash",stroke:"none"});

    // Il selciato della piazza si ferma al filo del portico invece di
    // passargli sotto: sotto il portico il pavimento è il suo.
    for (let x=-7.35; x<=8.8; x+=1.45) addLine(groundLines,[point(x,Z.sagratoY+.08,.222),point(x,Z.backY-.05,.222)],{x:0,y:0,z:1},{className:"paving-line"});
    for (let y=-2.0; y<=Z.backY-.15; y+=1.24) {
      const from = y <= PORTICO.endY ? PORTICO.clearX : -9.1;
      addLine(groundLines,[point(from,y,.222),point(9.1,y,.222)],{x:0,y:0,z:1},{className:"paving-line"});
    }
    for (let x=-8.8; x<=8.8; x+=.9) addLine(groundLines,[point(x,-6.1,.221),point(x,Z.sagratoY-.08,.221)],{x:0,y:0,z:1},{className:"paving-line--small"});
    for (let y=-5.9; y<=-2.45; y+=.68) addLine(groundLines,[point(-9.1,y,.221),point(9.1,y,.221)],{x:0,y:0,z:1},{className:"paving-line--small"});
    addLine(groundLines,[point(PORTICO.clearX,Z.sagratoY,.224),point(9.2,Z.sagratoY,.224)],{x:0,y:0,z:1},{className:"threshold-line"});
    [1.9,2.85,3.8,4.75,5.7,6.65,7.6].forEach((y)=>addLine(groundLines,[point(-.4,y,.224),point(.4,y,.224)],{x:0,y:0,z:1},{className:"threshold-line"}));
    for(let x=-9.1;x<=9.1;x+=.46) addLine(groundLines,[point(x,Z.backY+.22,.226),point(x+.18,Z.backY+.38,.226)],{x:0,y:0,z:1},{className:"drain-line"});

    const cover=Array.from({length:17},(_,i)=>{
      const a=i/16*Math.PI*2;
      return point(-3.4+Math.cos(a)*.46,4.3+Math.sin(a)*.46,.226);
    });
    addLine(groundLines,cover,{x:0,y:0,z:1},{className:"service-line"});
    addLine(groundLines,[point(-3.82,4.3,.226),point(-2.98,4.3,.226)],{x:0,y:0,z:1},{className:"service-line"});
    addLine(groundLines,[point(-3.4,3.88,.226),point(-3.4,4.72,.226)],{x:0,y:0,z:1},{className:"service-line"});
    addLine(groundLines,[point(Z.x0-.3,Z.y1+.05,.242),point(Z.x1+.3,Z.y1+.05,.242)],{x:0,y:0,z:1},{className:"curb-line"});
    // La mezzeria segue la carreggiata: prima al centro della sezione, dopo il
    // rifacimento al centro di quello che resta oltre la ciclabile. Lasciarla
    // dov'era vorrebbe dire dipingere la linea di mezzo sulle bici.
    beginLayer(0, 7);
    addLine(groundLines,[point(Z.x0-.4,CAR_LANE.before,.122),point(Z.x1+.4,CAR_LANE.before,.122)],{x:0,y:0,z:1},{className:"road-line"});
    beginLayer(7);
    addLine(groundLines,[point(Z.x0-.4,CAR_LANE.after,.122),point(Z.x1+.4,CAR_LANE.after,.122)],{x:0,y:0,z:1},{className:"road-line"});
    beginLayer(0);

    shadowGroundSurfaces.push(
      [point(Z.x0,Z.y0,.205),point(Z.x1,Z.y0,.205),point(Z.x1,Z.y1,.205),point(Z.x0,Z.y1,.205)],
      [point(Z.x0-.4,Z.y1,.235),point(Z.x1+.4,Z.y1,.235),point(Z.x1+.4,Z.kerbY,.235),point(Z.x0-.4,Z.kerbY,.235)],
      [point(Z.x0-.6,Z.kerbY,.115),point(Z.x1+.6,Z.kerbY,.115),point(Z.x1+.6,Z.roadY,.115),point(Z.x0-.6,Z.roadY,.115)],
    );

    // Tre corpi sul fronte lungo, di altezze diverse: due lasciavano
    // scoperto piu' di meta' del lato una volta allargata la piazza.
    beginObject(true);
    addBuilding(-9.2,-5.7,-5.0,-3.3,3.3,.95);
    beginObject(true);
    addBuilding(-3.2,-5.7,1.2,-3.5,2.8,.8);
    beginObject(true);
    addBuilding(3.4,-5.7,8.6,-3.3,3.5,1.0);
    // Il braccio di fondo mette la sua PRIMA colonna sull'angolo (a
    // PORTICO.frontX) invece che a filo del muro: è quella su cui si
    // aggancia il braccio di sinistra, che infatti salta la propria.
    beginObject(true);
    addPorticoArm("portico-back","x",PORTICO.backY,PORTICO.leftX,-.55,PORTICO.frontX,-.73,6,2.12);
    // Il braccio di sinistra attacca dove finisce il tetto di quello di
    // fondo (-2.24 = frontY + .08) e il pavimento dove finisce il suo
    // (-2.32 = frontY): i due pezzi si toccano invece di accavallarsi.
    beginObject(true);
    addPorticoArm("portico-left","y",PORTICO.leftX,-2.16,PORTICO.endY,PORTICO.backY + PORTICO_DEPTH,7.22,7,2.12,
      { skipFirstColumn: true, floorFrom: PORTICO.backY + PORTICO_DEPTH });
    beginObject();

    addCast3D();

    // L'auto se ne va quando arriva il verde: la carreggiata che diventa
    // suolo vivo e' il gesto piu' forte della tappa 5, e lasciarci sopra
    // un'auto lo contraddirebbe.
    beginLayer(0, 5);
    beginObject(true);
    addCarModel();
    beginLayer(0);

    // Le volute di calore se ne vanno TUTTE con gli alberi. Prima si
    // spegnevano una alla volta fino alla tappa 5, e per quattro tappe la
    // piazza continuava a fumare mentre le si costruiva sopra un rifugio:
    // l'ombra e' la prima cosa che arriva, ed e' quella che toglie il
    // calore dal selciato. Farlo vedere subito e' il punto del capitolo.
    heatAnchors.push(
      { p: point(-5.2,4.2,.23), goneAt: 2 },
      { p: point(.2,3.4,.23),  goneAt: 2 },
      { p: point(5.4,4.4,.23), goneAt: 2 },
    );

    // ══ TAPPA 1 · OMBRA NATURALE ═══════════════════════════════════════
    beginLayer(1);
    // Altezze: le case stanno fra 2,8 e 3,5 al cornicione. Gli alberi
    // restano sotto la gronda tranne DUE, che la superano di poco: un
    // filare tutto piu' alto delle case faceva sembrare la piazza un
    // giardino con dei villini in mezzo, ma un filare tutto uguale e tutto
    // basso non fa ombra a nessuno. Misure e chiome variate una per una.
    [[-7.2,-1.05,3.85,1.82,1],[-1.8,-1.15,3.25,1.48,2],[4.9,-1.12,3.75,1.72,3]]
      .forEach(([x,y,h,r,s]) => addTree(x,y,h,r,s));
    // Sul fronte ne resta uno solo, a destra. Quello di sinistra copriva
    // proprio la meta' di piazza dove poi arrivano tettoia, fontanella e
    // panchina, e con il portico che ora scende su quel fianco l'angolo
    // era diventato illeggibile.
    addTree(6.2,6.65,3.05,1.38,6);

    // ══ TAPPA 2 · OMBRA CONTINUA ═══════════════════════════════════════
    beginLayer(2);
    // ── La pergola arretra dalla strada ──────────────────────────────────
    // Stava a 3,3-6,3, cioè a ridosso del fronte su strada, dove nelle ultime
    // tappe arrivano fermata, siepi, vasi e percorso tattile: quella metà di
    // piazza si era riempita al punto che non si distingueva più un pezzo
    // dall'altro. Arretrandola di un metro e dieci verso le case, il fronte
    // su strada torna a respirare e la pergola guadagna il vuoto che le
    // serve per leggersi come una struttura e non come un intrico.
    // Si è anche accorciata a destra, dove il montante finiva in mezzo al
    // percorso tattile che porta alla fermata.
    beginObject(); addPergola(PERGOLA.x0,PERGOLA.y0,PERGOLA.x1,PERGOLA.y1,2.85);
    // Scostata dal fianco: i suoi montanti stavano esattamente sul filo
    // delle colonne del portico. Resta comunque sopra la panchina della
    // signora e la fontanella, che è quello per cui è lì.
    beginObject(); addCanopy(PORTICO.clearX + .3,3.6,-4.8,5.8,2.7);

    // ══ TAPPA 3 · SOSTA ════════════════════════════════════════════════
    beginLayer(3);
    // Orientate come le persone (PERSON_YAW), cosi' chi si siede guarda
    // verso chi legge invece di dargli le spalle.
    // Le due panche sotto la pergola la seguono nell'arretramento: sono
    // «le panche sotto la pergola», e se restassero dov'erano si ritroverebbero
    // al sole davanti a lei.
    [[BENCH_ELDER.x,BENCH_ELDER.y,PERSON_YAW,1.9],[2.9,.9,PERSON_YAW,2.0],
     [-1.6,4.1+PERGOLA.shift,PERSON_YAW,2.1],[1.5,5.8+PERGOLA.shift,PERSON_YAW+Math.PI,2.1],
     [-5.6,2.4,PERSON_YAW,2.1]]
      .forEach(([x,y,a,l]) => { beginObject(); addBench(x,y,a,l); });

    // ══ TAPPA 4 · ACQUA ════════════════════════════════════════════════
    beginLayer(4);
    // Spostata: a 6,8 finiva dietro la chioma dell'albero di destra e non
    // si vedeva proprio nella tappa che la introduce.
    beginObject(); addFountain(7.1,2.7,1.4);
    // Staccata dalla panchina e portata nello spiazzo libero alla sua
    // destra: era appiccicata al fianco della piazza, e con panchina,
    // tettoia e portico tutti nello stesso angolo non si distingueva piu'
    // da cosa fosse. La sua pozza cade appena oltre il percorso tattile —
    // ci si arriva camminando, che e' il punto.
    beginObject(); addDrinkingFountain(-5.3,5.4);
    // Gli uccelli arrivano con l'acqua: due sul bordo della vasca, uno
    // sulla trave della pergola. Non si montano — si posano.
    beginObject(true);
    addBird(6.35,2.35,.56,PERSON_YAW+.5,1,0);
    addBird(7.85,3.1,.56,PERSON_YAW-1.9,4,4.2);
    addBird(-1.2,PERGOLA.y0+.2,3.36,PERSON_YAW+.9,7,7.6);

    // ══ TAPPA 5 · VERDE E SUOLO VIVO ═══════════════════════════════════
    beginLayer(5);
    // Il verde non e' una decorazione sparsa: e' una FASCIA CONTINUA che
    // salda fra loro i tondi di terra degli alberi, piu' una lingua che
    // entra nella piazza. Toppe staccate leggevano come tappeti buttati li';
    // una fascia dice che il suolo sotto e' tornato permeabile.
    // A sinistra il verde comincia dove finisce il portico: l'erba non
    // cresce sotto un pavimento.
    // La fascia dietro le case e' lunga diciotto metri e profonda tre: i
    // tre ciuffi di fiori buoni per una toppa quadrata ci si perderebbero
    // dentro. Sei, sfalsati fra loro e lontani dai tondi di terra degli
    // alberi, la percorrono tutta senza allinearsi.
    //
    // ── Il verde CRESCE, non compare ─────────────────────────────────────
    // Tutti questi pezzi erano `beginObject(true)`, cioe' senza montaggio:
    // la tappa 5 si accendeva di colpo. Era un rimedio al costo — erano
    // migliaia di poligoni da far entrare insieme — ma il costo stava nei
    // fiori, ed e' li' che e' stato tolto. Ora il verde entra come tutto il
    // resto, e nella tappa 5 il montaggio e' per definizione una crescita
    // (vedi `currentBuildAxis` in beginObject).
    beginObject(); addGreenPatch(PORTICO.clearX,-2.3,9.1,.55,[
      [.226,.193,5,.30],[.294,.684,4,.26],[.537,.246,4,.28],
      [.650,.737,5,.30],[.876,.281,4,.26],[.932,.772,4,.24],
    ]);
    beginObject(); addGreenPatch(PORTICO.clearX,5.7,-4.2,8.0);
    beginObject(); addGreenPatch(3.9,5.9,9.1,8.0);
    // ── Dove va messo un giardino di pioggia ─────────────────────────────
    // Era una lingua stretta lungo l'asse centrale, e passava SOTTO la
    // pergola: due verdi sovrapposti che si annullavano a vicenda, e un
    // invaso che nessuno poteva vedere perché ci stava sopra una struttura.
    // Adesso corre nella fascia libera fra la pergola e la fontana, dove non
    // ha niente né sopra né a ridosso: si vede tutto, dal ciglio al fondo, ed
    // è l'unico pezzo di piazza fatto di verdi freddi e di minerale bagnato.
    beginObject(); addRainGarden(3.65,1.6,4.85,5.6);
    beginObject(); addHedge(PORTICO.clearX,8.05,-3.4,8.35,.55);
    beginObject(); addHedge(6.05,8.05,9.1,8.35,.55);
    // Il tavolo sta al bordo dell'ombra dell'albero dietro, non in mezzo
    // al prato: e' li' che uno ci si siede davvero.
    beginObject(); addPicnicTable(-5.2,-.35);
    // Due vasi. Erano quattro, e allineati sul fronte leggevano come una
    // fila di fioriere da centro commerciale: il suolo vivo lo raccontano
    // la fascia d'erba e il giardino di pioggia, non i vasi.
    beginObject(); addPlanter(-3.0,7.3,1.05,1.05,.48);
    beginObject(); addPlanter(-1.7,7.8,.9,.9,.42);

    // ══ TAPPA 6 · ACCESSIBILITA' ═══════════════════════════════════════
    beginLayer(6);
    beginObject(); addBusStop(3.2,8.6);
    // Il percorso non finisce piu' contro il vetro di fondo della
    // pensilina: si ferma un passo prima, gira a sinistra e scende allo
    // spazio d'attesa accanto alla fermata, dove sta la carrozzina. E'
    // per far posto a questa svolta che il vaso di destra e' arretrato
    // da 7,1 a 6,3.
    beginObject(); addTactilePath(2.92,.3,3.48,7.05);
    beginObject(); addTactilePath(-.83,7.05,3.48,7.6);
    beginObject(); addTactilePath(-.83,7.6,-.27,8.2);
    beginObject(); addTactilePath(-6.6,4.6,-4.25,5.15);
    // L'autobus non si monta: arriva guidando. Il suo ingresso e' gia'
    // un'animazione, e sovrapporgli un montaggio significava dire due volte
    // la stessa cosa in due modi che si contraddicono.
    beginObject(true); addBusModel();

    // ══ TAPPA 7 · CI SI ARRIVA, E SI RIPARTE ═══════════════════════════
    // L'ultima tappa non aggiungeva niente al disegno: tirava le somme su una
    // scena ferma, e la battuta più importante restava senza immagine. Ora
    // chiude il ragionamento con l'ultimo modo di arrivarci, e con l'unico
    // pezzo di trasformazione che tocca la STRADA e non la piazza.
    beginLayer(7);
    beginObject(); addCycleLane(PIAZZA.x0 - .6, PIAZZA.x1 + .6);
    // La rastrelliera scende sul marciapiede e si sposta a sinistra: a -2,35 e
    // a 8,75 stava ancora sulla lastra, appoggiata al vaso e a ridosso della
    // pensilina, e da lì si accavallava con tutto. Qui è sul marciapiede, in
    // faccia alla ciclabile — che è dove una rastrelliera serve — e nel tratto
    // di fronte che non è occupato da nient'altro.
    beginObject(); addBikeStation(-5.4, 9.65);

    beginLayer(0);
  }

  const buildAxisOf = (item) =>
    ["grow","x","y","pop"].includes(item.buildAxis) ? item.buildAxis : "pop";

  // ── Il montaggio, quando può, va sul GRUPPO ────────────────────────────
  // Ogni faccia portava la propria animazione di crescita. Su una siepe fatta
  // di lobi da cinquanta facce l'una, e su una tappa che ne porta milletrecento
  // insieme, vuol dire milletrecento animazioni CSS avviate nello stesso
  // istante — che è precisamente la cosa che il browser non riesce a fare. È
  // per questo che la tappa del verde si impiantava: misurato, il picco era di
  // 938 elementi in movimento contemporaneo, contro i 476 della seconda
  // peggiore e i 96 di quelle normali.
  //
  // Ma un'unità di profondità è già un <g> nel disegno finale. Se tutte le sue
  // facce partirebbero nello stesso istante e nella stessa direzione — ed è il
  // caso di tutto ciò che non è costruito per componenti: chiome, siepi,
  // cespugli, ciottoli, giunchi — l'animazione può stare su quel gruppo: una
  // invece di cinquanta, e a vedersi è la stessa cosa (anzi, il lobo cresce
  // come un lobo invece che come cinquanta scaglie ciascuna per conto suo).
  //
  // Dove l'oggetto è scandito per componenti — i montanti, poi le travi, poi
  // le doghe — le facce hanno ritardi diversi: lì la condizione non passa e si
  // torna al montaggio per faccia, che in quel caso È il racconto.
  function unitAnimation(parts) {
    const first = parts[0];
    if (!first) return null;
    const k = first.layer ?? 0;
    const now = performance.now();

    if (building0(first, k)) {
      const delay = buildDelay(first);
      const axis = buildAxisOf(first);
      for (const part of parts) {
        if (!building0(part, part.layer ?? 0)) return null;
        if (buildDelay(part) !== delay || buildAxisOf(part) !== axis) return null;
      }
      const at = delay - (now - buildEpoch);
      if (at + BUILD_MS <= 0) return null;
      return { cls: `is-building-${axis}`, at };
    }

    if (unbuilding != null && k >= unbuilding.from && k <= unbuilding.to && !first.noBuild) {
      const delay = unbuildDelay(first);
      const axis = buildAxisOf(first);
      for (const part of parts) {
        if (part.noBuild || (part.layer ?? 0) !== k) return null;
        if (unbuildDelay(part) !== delay || buildAxisOf(part) !== axis) return null;
      }
      return { cls: `is-unbuilding-${axis}`, at: delay - (now - unbuildEpoch) };
    }
    return null;
  }

  // `quiet` = l'animazione di montaggio la porta il gruppo, non la faccia.
  function renderItem(item, radians, forceVisible = false, quiet = false) {
    if (!forceVisible && item.normal && !item.doubleSided && !visible(item.normal,radians)) return "";
    // `data-layer` viaggia con ogni pezzo: e' l'aggancio su cui la webapp
    // fa correre il tratto quando la tappa arriva.
    // I pezzi della tappa CORRENTE si montano invece di comparire. Lo
    // sfalsamento (`--i`) e' l'ordine di costruzione: un pezzo dopo
    // l'altro, come se qualcuno stesse posando le cose sulla piazza.
    const k = item.layer ?? 0;
    const isFace = item.type === "face";
    let cls = item.className || (isFace ? "face" : "detail");
    let extra = ` data-layer="${k}"`;
    // Il montaggio appartiene alla tappa che sta arrivando, non a ogni
    // ridisegno: costruirsi e' un evento del racconto, non una proprieta'
    // permanente del pezzo. Il ritardo e' NEGATIVO quando il pezzo e' gia'
    // partito, cosi' ricreando i nodi l'animazione riprende dal punto in cui
    // era invece di ricominciare (vedi la nota su `buildEpoch`).
    const now = performance.now();
    const buildAt = !quiet && building0(item, k) ? buildDelay(item) - (now - buildEpoch) : null;
    // Se il pezzo ha gia' finito di crescere non gli si rimette addosso
    // l'animazione: la rifarebbe da capo al primo ridisegno successivo.
    const building = buildAt != null && buildAt + BUILD_MS > 0;
    // ── E il contrario ────────────────────────────────────────────────────
    // Tornando indietro i pezzi della tappa lasciata sparivano di colpo, e la
    // sequenza si leggeva bene in un verso solo. Ora si RITIRANO: la stessa
    // animazione al contrario, con lo sfalsamento invertito, cosi' l'ultimo
    // arrivato e' il primo ad andarsene. Restano in scena finche' non hanno
    // finito — e' `unbuilding` a tenerceli.
    const leaving = !quiet && unbuilding != null && k >= unbuilding.from && k <= unbuilding.to && !item.noBuild;
    const leaveAt = leaving ? unbuildDelay(item) - (now - unbuildEpoch) : 0;
    const axis = buildAxisOf(item);
    // I cicli continui (acqua, uccelli) hanno il ritardo calcolato
    // dall'epoca della pagina, non un valore fisso: ricreando i nodi
    // riprendono dal punto in cui erano invece di ricominciare a ogni
    // movimento del mouse. E' lo stesso rimedio del respiro delle persone.
    const style = building
      ? `animation-delay:${buildAt.toFixed(0)}ms`
      : leaving
        ? `animation-delay:${leaveAt.toFixed(0)}ms`
      : item.ripple != null ? `animation-delay:-${phaseOf(RIPPLE_DUR, item.ripple)}s`
      : item.jet != null ? `animation-delay:-${phaseOf(JET_DUR, item.jet)}s`
      : item.perch != null ? `animation-delay:-${phaseOf(PERCH_DUR, item.perch)}s`
      : (item.style || "");
    if (building) cls += ` is-building-${axis}`;
    else if (leaving) cls += ` is-unbuilding-${axis}`;
    if (style) extra += ` style="${style}"`;
    const opacity = item.opacity != null ? ` opacity="${item.opacity}"` : "";
    if (isFace) {
      const stroke = item.stroke ?? C.ink;
      return `<polygon class="${cls}"${extra} points="${ptsAttr(item.points,radians)}" fill="${item.fill}" stroke="${stroke}"${opacity}/>`;
    }
    const d = item.points.map((p,i) => {
      const q = project(p,radians);
      return `${i ? "L" : "M"}${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
    }).join(" ");
    return `<path class="${cls}"${extra} d="${d}"${item.stroke ? ` stroke="${item.stroke}"` : ""}${opacity}/>`;
  }

  function sorted(items, radians) {
    return active(items)
      .filter((item) => !item.normal || item.doubleSided || visible(item.normal,radians))
      .sort((a,b) => compareItems(a,b,radians));
  }

  const BUS_SECONDS = 24;

  // ── I veicoli hanno una profondita', non un posto fisso nella pila ─────
  // Prima l'auto era incollata PRIMA della scena e l'autobus DOPO, sempre,
  // a qualunque angolo. Con la strada davanti la pensilina passava sopra
  // l'auto; con la strada dietro l'autobus passava sopra le case. Da certe
  // rotazioni un mezzo spariva, da altre compariva dove non poteva stare.
  //
  // Ora tutti e due dichiarano la propria posizione LUNGO LA CORSIA e
  // vengono ordinati per profondita' insieme a case, alberi e persone. La
  // posizione si ricalcola solo quando la scena si ridisegna: da fermi il
  // movimento continua in CSS e l'ordine resta quello dell'ultimo
  // fotogramma, che e' esattamente il momento in cui non lo si sta
  // guardando muovere.
  const laneDepth = (worldX, z, radians) => depthOf([point(worldX, laneY(), z)], radians);

  // Le tre soste della keyframe `bus-pass-stop`, in frazione di ciclo.
  // Stanno qui perche' servono anche a JavaScript: e' da queste che si
  // ricava dove sta l'autobus nel mondo al momento del disegno.
  const BUS_ARRIVE = .42, BUS_LEAVE = .61;

  // ── L'autobus si muove da solo ─────────────────────────────────────────
  // La sua posizione veniva calcolata in JS a ogni disegno. Ma la scena si
  // ridisegna SOLO mentre la si trascina: da fermi l'autobus restava
  // piantato dov'era e l'arrivo alla fermata — che e' il racconto della
  // tappa 6 — non lo vedeva nessuno. Ora viaggia su una keyframe CSS come
  // l'auto, con lo stesso ritardo negativo calcolato dall'epoca della
  // pagina: ricreando i nodi riprende da dove era, e continua a muoversi
  // anche a plastico fermo. Porte e richiamo a terra hanno le loro
  // keyframe, sulla stessa durata e sullo stesso ritardo.
  //
  // ── L'ordine dei pezzi NON si affida alla profondita' ──────────────────
  // Le fasce vetrate sparivano a certe rotazioni. Non era culling: sono
  // decalcomanie appoggiate 2 cm fuori dalla fiancata, e l'ordine del
  // pittore confronta i CENTROIDI. Una fiancata e' lunga cinque metri e ha
  // il centroide a meta'; una fascia di finestre ne copre un pezzo e ha il
  // centroide spostato. Appena la rotazione fa pesare la x piu' della y, il
  // centroide della fascia finisce dietro quello della fiancata e la fascia
  // viene dipinta SOTTO il metallo.
  //
  // La cura non e' ordinare meglio: e' non chiedere all'ordinamento di
  // decidere cose che sappiamo gia'. Un autobus e' una scatola: si dipinge
  // fiancata lontana, poi il corpo (tetto, muso, sottoscocca), poi fiancata
  // vicina. Dentro ogni gruppo la profondita' va benissimo — sono pezzi a
  // quote diverse dello stesso volume — e i vetri, che sono decalcomanie
  // sulla lamiera, hanno il loro `depthBias` (vedi addBusModel). Cosi' il
  // mezzo e' sempre completo e sempre uguale a se stesso, da tutti i 360°.
  function renderBus(radians) {
    if (renderStep < 6) return null;
    const centre = project(point(0,CAR_LANE_Y,.15),radians);
    const fromX = PIAZZA.x0 - 5.2, stopX = 3.2, toX = PIAZZA.x1 + 5.2;
    const off = (x) => {
      const p = project(point(x,laneY(),.15),radians);
      return [`${(p.x-centre.x).toFixed(1)}px`, `${(p.y-centre.y).toFixed(1)}px`];
    };
    const [sx,sy] = off(fromX), [mx,my] = off(stopX), [ex,ey] = off(toX);
    const phase = ((performance.now() - trafficEpoch) / 1000 + 2.4) % BUS_SECONDS;
    const delay = `animation-delay:-${phase.toFixed(3)}s`;

    const near = visible({x:0,y:1,z:0}, radians) ? 1 : -1;
    const parts = dragging ? busLod : [...busSolids, ...busDetails];
    const paint = (list) => list.sort((a,b)=>compareItems(a,b,radians))
      .map((item) => renderItem(item,radians,true)).join("");
    const onSide = (list, s) => active(list).filter((item) => (item.busSide|0) === s);
    const doorGroup = (s, dir) => {
      const doors = onSide(busDoors, s).filter((_, i) => i % 2 === (dir < 0 ? 0 : 1));
      if (!doors.length) return "";
      return `<g class="bus-door bus-door--${dir < 0 ? "left" : "right"}" style="${delay};--car-duration:${BUS_SECONDS}s">${paint(doors)}</g>`;
    };
    const side = (s) => paint(onSide(parts, s)) + (dragging ? "" : doorGroup(s,-1) + doorGroup(s,1));
    const body = side(-near) + paint(onSide(parts, 0)) + side(near);
    const ground = paint(onSide(busGround, 0));

    // Dove sta adesso, per l'ordinamento in profondita'. La keyframe e'
    // lineare fra le soste, quindi basta la stessa frazione che finisce in
    // `animation-delay`.
    const t = phase / BUS_SECONDS;
    const worldX = t < BUS_ARRIVE ? fromX + (stopX-fromX) * (t/BUS_ARRIVE)
                 : t < BUS_LEAVE  ? stopX
                 : stopX + (toX-stopX) * ((t-BUS_LEAVE)/(1-BUS_LEAVE));

    const cue = dragging ? ""
      : `<ellipse class="bus-stop-cue" style="${delay};--car-duration:${BUS_SECONDS}s" cx="0" cy="14" rx="31" ry="7" fill="#E8D9A8" opacity="0"/>`;
    const html = `<g class="moving-car bus-run" clip-path="url(#road-volume-clip)"`
      + ` style="--car-start-x:${sx};--car-start-y:${sy};--bus-stop-x:${mx};--bus-stop-y:${my};`
      + `--car-end-x:${ex};--car-end-y:${ey};--car-duration:${BUS_SECONDS}s;${delay}">`
      + `${ground}${body}${cue}</g>`;
    return { html, depth: laneDepth(worldX, .9, radians) };
  }

  function renderTraffic(radians) {
    if (!liveAt({ layer: 0, goneAt: 5 })) return null;
    const ground=active(carGround).map((item)=>renderItem(item,radians)).join("");
    const car=sorted([...carSolids,...carDetails],radians).map((item)=>renderItem(item,radians)).join("");
    const centre=project(point(0,CAR_LANE_Y,.15),radians);
    const start=project(point(PIAZZA.x0-2.4,laneY(),.15),radians);
    const end=project(point(PIAZZA.x1+2.4,laneY(),.15),radians);
    const startX=(start.x-centre.x).toFixed(1),startY=(start.y-centre.y).toFixed(1);
    const endX=(end.x-centre.x).toFixed(1),endY=(end.y-centre.y).toFixed(1);
    const phase=((performance.now()-trafficEpoch)/1000)%CAR_DURATION_SECONDS;
    // La keyframe e' lineare, quindi al momento del disegno l'auto sta
    // esattamente a `phase/durata` fra i due capi: la sua x nel mondo si
    // ricava dalla stessa frazione che si passa a `animation-delay`.
    const worldX=(PIAZZA.x0-2.4)+((PIAZZA.x1+2.4)-(PIAZZA.x0-2.4))*(phase/CAR_DURATION_SECONDS);
    const html=`<g class="moving-car" style="--car-start-x:${startX}px;--car-start-y:${startY}px;--car-end-x:${endX}px;--car-end-y:${endY}px;--car-duration:${CAR_DURATION_SECONDS}s;animation-delay:-${phase.toFixed(3)}s">${ground}${car}</g>`;
    return { html, depth: laneDepth(worldX, .5, radians) };
  }

  let angle = DEFAULT_ANGLE;
  let raf = 0;

  function renderSun(radians) {
    // Il sole e' lontanissimo, quindi in una proiezione parallela conta
    // solo la sua DIREZIONE: si proietta il versore e lo si appoggia a un
    // raggio fisso dal centro del quadro. Cosi' il disco orbita attorno
    // alla scena mentre la si ruota, invece di scivolare via dal quadro
    // come farebbe un punto a distanza finita.
    const d = camera2d(SUN_WORLD, radians);
    const len = Math.hypot(d.x, d.y) || 1;
    // L'azimut decide DOVE nel cielo, sopra i tetti; l'altezza resta nella
    // fascia alta del riquadro. Lasciarlo scendere alla sua quota vera lo
    // faceva finire dietro un colmo, e di un sole restavano quattro raggi
    // che spuntavano da un tetto come un errore di disegno.
    const p = {
      x: FRAME.x + FRAME.w / 2 + (d.x / len) * FRAME.w * .40,
      y: 74 + (d.y / len) * 22,
    };
    SUN_SCREEN = p;
    const r = Math.max(15, fit.scale * 1.05);
    let rays = "";
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2 + .2;
      const c = Math.cos(a), s = Math.sin(a);
      rays += `M${(p.x+c*r*1.62).toFixed(1)} ${(p.y+s*r*1.62).toFixed(1)}L${(p.x+c*r*2.16).toFixed(1)} ${(p.y+s*r*2.16).toFixed(1)}`;
    }
    sun.innerHTML =
      `<ellipse cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" rx="${(r*6.6).toFixed(0)}" ry="${(r*3.4).toFixed(0)}" fill="url(#sun-halo)"/>` +
      `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r.toFixed(1)}" fill="#e8a23c" opacity=".92"/>` +
      `<path d="${rays}" fill="none" stroke="#d98a4d" stroke-width="${(r*.082).toFixed(2)}" stroke-linecap="round" opacity=".55"/>`;
  }

  // ── La lettura NON sta nel disegno ─────────────────────────────────────
  // Era un richiamo appoggiato sul selciato: pillola, filo a gomito, alone di
  // carta e un punto rosso sul pavimento, con una ricerca su griglia a ogni
  // fotogramma per trovargli il posto meno affollato. Il problema e' che quel
  // posto non esiste: una piazza che ruota non ha un angolo tranquillo.
  // Poi e' diventata un testo fermo nell'angolo dell'<svg>, e li' il problema
  // era un altro: ingrandendo, il plastico le cresce sotto e se la mangia.
  //
  // Adesso non e' piu' dentro il disegno per niente. La scrive React sopra il
  // riquadro (vedi RifugioModel3D.jsx): sta nel suo spazio, non ha niente da
  // scansare, e lo zoom non la tocca perche' non fa parte di cio' che si
  // ingrandisce. Il modello si limita a dire quale tappa sta mostrando.

  const frameCost = [];

  // ── Il montaggio sopravvive alla rotazione ───────────────────────────────
  // Ogni disegno riscrive l'innerHTML dei buffer, e con i nodi se ne vanno le
  // animazioni CSS che ci stavano sopra: girando il plastico mentre una tappa
  // si montava, i pezzi restavano a mezza crescita o sparivano. La prima cura
  // era stata impedire di girare durante il montaggio — che risolve il sintomo
  // spegnendo la cosa per cui il plastico esiste.
  //
  // La cura vera e' quella che questo file usa gia' per l'acqua, gli uccelli e
  // il respiro delle persone: il RITARDO NEGATIVO. Non si chiede al browser di
  // «far partire» l'animazione, gli si dice a che punto e' — `animation-delay`
  // vale il ritardo del pezzo MENO il tempo passato dall'inizio del montaggio.
  // Ricreando i nodi ogni animazione riprende esattamente da dove era, quindi
  // si puo' girare, ingrandire e ridimensionare mentre la piazza si costruisce
  // senza interromperla di un fotogramma.
  //
  // `buildLayer` resta quindi valorizzato per tutta la durata del montaggio,
  // non per un solo disegno, e un timer lo spegne quando l'ultimo pezzo ha
  // finito di crescere.
  let buildLayer = -1;
  let buildEpoch = 0;
  let buildTimer = 0;
  let rendered = false;

  // `unbuilding` è l'intervallo di tappe che se ne sta andando: finché è
  // valorizzato quei pezzi restano disegnati, con l'animazione di ritiro
  // addosso, anche se `step` è già tornato indietro. Stesso ritardo negativo.
  let unbuilding = null;
  let unbuildEpoch = 0;
  // Fin quando durano le due animazioni. Servono per due cose: sapere quando
  // togliere dalla scena i pezzi che si stanno ritirando, e tenere ferme
  // rotazione e zoom mentre il montaggio è in corso (vedi `locked`).
  const BUILD_MS = 700;      // durata di `piece-*`, dal foglio di stile
  const UNBUILD_MS = 460;    // durata di `piece-un*`
  const buildDelay = (item) => ((item.obj ?? 0) * 170) + ((item.piece ?? 0) * 80);
  const building0 = (item, k) => k > 0 && k === buildLayer && !item.noBuild;
  // In uscita lo sfalsamento è ROVESCIATO e compresso: chi è arrivato per
  // ultimo se ne va per primo, e tutto insieme dura meno di quanto ci ha messo
  // a comparire. Tornare indietro è un ripensamento, non una seconda posa.
  const unbuildDelay = (item) => Math.max(0, (layerObjects.get(item.layer ?? 0) ?? 1) - 1 - (item.obj ?? 0)) * 55;

  // Quanto dura, per ogni tappa, il montaggio completo: il ritardo del pezzo
  // che parte per ultimo più la durata dell'animazione. Si calcola una volta
  // sola sulla scena costruita, invece di tenere a mano una tabella di tempi
  // che si scollerebbe al primo oggetto aggiunto.
  const layerBuildMs = new Map();
  function measureBuildTimes() {
    for (const list of [baseFaces, groundSurfaces, groundLines, solids, details, heatFaces]) {
      for (const item of list) {
        if (item.noBuild) continue;
        const k = item.layer ?? 0;
        if (k <= 0) continue;
        layerBuildMs.set(k, Math.max(layerBuildMs.get(k) ?? 0, buildDelay(item) + BUILD_MS));
      }
    }
    // Alla tappa 2 il rampicante entra dopo la struttura: il montaggio non è
    // finito finché non si è posato anche lui.
    layerBuildMs.set(2, Math.max(layerBuildMs.get(2) ?? 0, 820 + 220 + 460));
  }
  let pergolaGreenReady = false;
  let pergolaGreenAnimating = false;
  let pergolaGreenEpoch = 0;
  let pergolaGreenTimer = 0;
  let pergolaGreenAnimationTimer = 0;

  const FIGURE_LOD = {
    elder:{fill:CAST.elderTop,height:1.82},
    elderSeated:{fill:CAST.elderTop,height:1.38,seated:true},
    adult:{fill:CAST.coral,height:1.78},
    adultFountain:{fill:CAST.coral,height:1.78},
    child:{fill:CAST.childYellow,height:1.28,child:true},
    childFountain:{fill:CAST.childYellow,height:1.28,child:true},
    wheelchair:{fill:CAST.chairBlue,height:1.55,wheelchair:true},
    wheelchairTransit:{fill:CAST.chairBlue,height:1.55,wheelchair:true},
    pregnant:{fill:CAST.pregnant,height:1.75},
    pregnantSeated:{fill:CAST.pregnant,height:1.36,seated:true},
  };

  function renderFigureLOD(id,radians) {
    const a=figureAnchors.get(id);
    const meta=FIGURE_LOD[id]||{fill:"#87978A",height:1.7};
    const foot=project(point(a.x,a.y,.23),radians);
    const ink=C.ink;
    if(meta.wheelchair){
      const wheel=project(point(a.x,a.y,.68),radians);
      const head=project(point(a.x,a.y,1.5),radians);
      const r=Math.max(5,fit.scale*.34);
      return `<g class="figure-lod" data-figure="${id}">`
        + `<ellipse cx="${foot.x.toFixed(1)}" cy="${(foot.y+2).toFixed(1)}" rx="${(r*1.35).toFixed(1)}" ry="${(r*.28).toFixed(1)}" fill="${ink}" opacity=".12"/>`
        + `<circle cx="${(wheel.x-r*.48).toFixed(1)}" cy="${wheel.y.toFixed(1)}" r="${r.toFixed(1)}" fill="none" stroke="${ink}" stroke-width="2"/>`
        + `<circle cx="${(wheel.x+r*.48).toFixed(1)}" cy="${wheel.y.toFixed(1)}" r="${r.toFixed(1)}" fill="none" stroke="${ink}" stroke-width="2"/>`
        + `<path d="M${(wheel.x-r*.35).toFixed(1)} ${wheel.y.toFixed(1)} L${wheel.x.toFixed(1)} ${(head.y+r*.85).toFixed(1)} L${(wheel.x+r*.42).toFixed(1)} ${(wheel.y-r*.05).toFixed(1)}" fill="none" stroke="${ink}" stroke-width="2"/>`
        + `<circle cx="${head.x.toFixed(1)}" cy="${head.y.toFixed(1)}" r="${Math.max(3.6,fit.scale*.12).toFixed(1)}" fill="${CAST.skinCopper}" stroke="${ink}" stroke-width="1"/>`
        + `<path d="M${head.x.toFixed(1)} ${(head.y+r*.7).toFixed(1)} L${(wheel.x+r*.2).toFixed(1)} ${(wheel.y-r*.45).toFixed(1)}" stroke="${meta.fill}" stroke-width="${Math.max(5,fit.scale*.3).toFixed(1)}" stroke-linecap="round"/>`
        + `</g>`;
    }
    const head=project(point(a.x,a.y,meta.height),radians);
    const shoulder=project(point(a.x,a.y,meta.seated?.98:meta.child?.97:1.38),radians);
    const hip=project(point(a.x,a.y,meta.seated?.58:meta.child?.6:.82),radians);
    const hw=Math.max(3.5,fit.scale*(meta.child?.1:.13));
    const bw=Math.max(4.2,fit.scale*(meta.child?.13:.18));
    const body=`M${(shoulder.x-bw).toFixed(1)} ${shoulder.y.toFixed(1)} L${(shoulder.x+bw).toFixed(1)} ${shoulder.y.toFixed(1)} L${(hip.x+bw*.72).toFixed(1)} ${hip.y.toFixed(1)} L${(hip.x-bw*.72).toFixed(1)} ${hip.y.toFixed(1)} Z`;
    const legs=meta.seated
      ? `<path d="M${(hip.x-bw*.35).toFixed(1)} ${hip.y.toFixed(1)} L${(hip.x+bw*.9).toFixed(1)} ${(hip.y+Math.max(5,fit.scale*.23)).toFixed(1)} L${(foot.x+bw*.8).toFixed(1)} ${foot.y.toFixed(1)} M${(hip.x+bw*.15).toFixed(1)} ${hip.y.toFixed(1)} L${(hip.x+bw*1.25).toFixed(1)} ${(hip.y+Math.max(5,fit.scale*.23)).toFixed(1)} L${(foot.x+bw*1.15).toFixed(1)} ${foot.y.toFixed(1)}" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>`
      : `<path d="M${(hip.x-bw*.25).toFixed(1)} ${hip.y.toFixed(1)} L${(foot.x-bw*.45).toFixed(1)} ${foot.y.toFixed(1)} M${(hip.x+bw*.25).toFixed(1)} ${hip.y.toFixed(1)} L${(foot.x+bw*.45).toFixed(1)} ${foot.y.toFixed(1)}" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>`;
    const skin=meta.child?CAST.skinLight:id.startsWith("pregnant")?CAST.skinDeep:id.startsWith("adult")?CAST.skinWarm:CAST.skinLight;
    return `<g class="figure-lod" data-figure="${id}">`
      + `<ellipse cx="${foot.x.toFixed(1)}" cy="${(foot.y+2).toFixed(1)}" rx="${(bw*1.5).toFixed(1)}" ry="${Math.max(2,bw*.28).toFixed(1)}" fill="${ink}" opacity=".12"/>`
      + legs + `<path d="${body}" fill="${meta.fill}" stroke="${ink}" stroke-width="1"/>`
      + `<circle cx="${head.x.toFixed(1)}" cy="${head.y.toFixed(1)}" r="${hw.toFixed(1)}" fill="${skin}" stroke="${ink}" stroke-width="1"/>`
      + `</g>`;
  }

  function convexHull(points) {
    const pts=[...points].sort((a,b)=>a.x===b.x?a.y-b.y:a.x-b.x);
    if(pts.length<=2) return pts;
    const cross=(o,a,b)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);
    const lower=[];
    for(const p of pts){ while(lower.length>=2&&cross(lower[lower.length-2],lower[lower.length-1],p)<=0) lower.pop(); lower.push(p); }
    const upper=[];
    for(let i=pts.length-1;i>=0;i--){ const p=pts[i]; while(upper.length>=2&&cross(upper[upper.length-2],upper[upper.length-1],p)<=0) upper.pop(); upper.push(p); }
    lower.pop(); upper.pop();
    return lower.concat(upper);
  }

  function updateRoadVolumeClip(radians) {
    const x0=PIAZZA.x0-6.2, x1=PIAZZA.x1+6.2;
    const y0=PIAZZA.kerbY+.01, y1=roadEdge()-.01;
    const corners=[];
    for(const z of [.08,1.95]) for(const x of [x0,x1]) for(const y of [y0,y1]) corners.push(project(point(x,y,z),radians));
    const hull=convexHull(corners);
    roadVolumeClipShape.setAttribute("points",hull.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" "));
  }

  function render() {
    raf = 0;
    const started = performance.now();
    const radians = angle * Math.PI / 180;
    computeFit(radians);
    updateRoadVolumeClip(radians);
    renderSun(radians);
    const background = sorted(baseFaces,radians).map((item) => renderItem(item,radians)).join("");
    const materials = active(groundSurfaces).map((item) => renderItem(item,radians)).join("");
    const pavingItems = dragging
      ? active(groundLines).filter((item)=>["curb-line","road-line","drain-line","threshold-line","aiuola-line"].includes(item.className))
      : active(groundLines);
    const paving = pavingItems.map((item) => renderItem(item,radians)).join("");
    const heatFloor = active(heatFaces).map((item) => renderItem(item,radians)).join("");
    const shade = dragging ? "" : renderShadows(radians);
    const contacts = dragging ? "" : sorted(contactFaces,radians).map((item) => renderItem(item,radians)).join("");
    const traffic = renderTraffic(radians);
    const busOverlay = renderBus(radians);

    const attachedDetails = new Map();
    active(details).filter((item) => item.surfaceKey).forEach((item) => {
      if (!attachedDetails.has(item.surfaceKey)) attachedDetails.set(item.surfaceKey, []);
      attachedDetails.get(item.surfaceKey).push(item);
    });

    const visibleSolids = active(solids).filter((item) => {
      if(item.revealGroup === "pergola-green" && !pergolaGreenReady) return false;
      return dragging ? !item.dragSkip : !item.dragOnly;
    });
    const sceneItems = [...visibleSolids,...(dragging ? [] : active(details).filter((item) => !item.surfaceKey && !item.dragOnly))];

    // Ogni persona diventa UNA unita' nell'ordinamento: si ordina per il
    // proprio ancoraggio a terra, e le sue facce si ordinano solo fra
    // loro. Prima erano sciolte nella lista generale e, siccome l'ordine
    // del pittore confronta centroidi, una spalla poteva passare davanti a
    // un tetto che le stava davanti.
    const byFigure = new Map();
    const byObject = new Map();
    const units = [];
    for (const item of sceneItems) {
      if (item.figureId) {
        let bucket = byFigure.get(item.figureId);
        if (!bucket) { bucket = []; byFigure.set(item.figureId, bucket); }
        bucket.push(item);
      } else {
        const key = item.depthGroup
          ? `depth-${item.depthGroup}`
          : item.surfaceKey
            ? `surface-${item.surfaceKey}`
            : (item.objectUid || `single-${item.seq}`);
        let bucket = byObject.get(key);
        if (!bucket) { bucket = []; byObject.set(key, bucket); }
        bucket.push(item);
      }
    }
    for (const [id, parts] of byFigure) {
      units.push({ figureId: id, parts, depth: depthOf([figureAnchors.get(id)],radians), seq: parts[0]?.seq || 0 });
    }
    for (const [id, parts] of byObject) {
      const allPoints = parts.flatMap((item) => item.points);
      units.push({ objectId: id, parts, depth: depthOf(allPoints,radians), seq: parts[0]?.seq || 0 });
    }
    // I mezzi in transito entrano nella stessa classifica: sono unita' come
    // le altre, con una profondita' presa dal punto della corsia in cui si
    // trovano adesso. A parita' di profondita' passano davanti (seq alto):
    // fra un'auto e una panchina complanari, l'auto e' quella che si muove.
    for (const vehicle of [traffic, busOverlay]) {
      if (vehicle) units.push({ html: vehicle.html, depth: vehicle.depth, seq: Number.MAX_SAFE_INTEGER });
    }
    units.sort((a,b) => {
      const d = Math.round((a.depth-b.depth)*10000)/10000;
      return Math.abs(d)<.0002 ? a.seq-b.seq : d;
    });

    const renderSurfacePart = (item, quiet = false) => {
      const surface = renderItem(item,radians,false,quiet);
      if (!surface || !item.surfaceKey) return surface;
      const openings = dragging ? "" : (attachedDetails.get(item.surfaceKey) || [])
        .sort((a,b) => compareItems(a,b,radians))
        .map((detail) => renderItem(detail,radians,true,quiet))
        .join("");
      return `<g data-surface="${item.surfaceKey}">${surface}${openings}</g>`;
    };

    const scene = units.map((unit) => {
      if (unit.html != null) return unit.html;
      if (unit.figureId) {
        if (dragging) return renderFigureLOD(unit.figureId,radians);
        const inner = [...unit.parts]
          .sort((a,b) => compareItems(a,b,radians))
          .map((part) => renderItem(part,radians))
          .join("");
        if (!inner) return "";
        const life = CAST_LIFE[unit.figureId] || CAST_LIFE.default;
        const a = figureAnchors.get(unit.figureId);
        const foot = project(point(a.x, a.y, 0), radians);
        const fx = foot.x.toFixed(1), fy = foot.y.toFixed(1);
        // Due gruppi annidati: fuori la maggiorazione di scala, dentro il
        // respiro. Se stessero sullo stesso elemento la `transform`
        // dell'animazione cancellerebbe quella della scala.
        // Anche la comparsa delle persone si aggancia all'epoca del montaggio:
        // girando mentre arrivano, la dissolvenza riprende invece di ripartire.
        const arrivalAt = buildLayer === unit.parts[0]?.layer
          ? buildDelay(unit.parts[0]) - (performance.now() - buildEpoch)
          : null;
        const arriving = arrivalAt != null && arrivalAt + 820 > 0
          ? ` class="cast-arrival" style="animation-delay:${arrivalAt.toFixed(0)}ms"`
          : "";
        return `<g${arriving} transform="translate(${fx} ${fy}) scale(${CAST_SCALE}) translate(${-foot.x.toFixed(1)} ${-foot.y.toFixed(1)})">`
          + `<g class="cast-alive" data-figure="${unit.figureId}" style="transform-origin:${fx}px ${fy}px;--idle-dur:${life.dur}s;`
          + `animation-delay:-${phaseOf(life.dur, life.offset)}s;--idle-lift:${life.lift}">${inner}</g></g>`;
      }
      if (unit.objectId != null) {
        const ordered = [...unit.parts].sort((a,b) => compareItems(a,b,radians));
        const regularParts=ordered.filter((item)=>!item.revealGroup);
        const revealParts=ordered.filter((item)=>item.revealGroup);
        const anim = unitAnimation(regularParts);
        const quiet = anim != null;
        let regular=regularParts.map((item)=>renderSurfacePart(item,quiet)).join("");
        if (!regular && regularParts.length) regular=regularParts.map((item)=>renderItem(item,radians,true,quiet)).join("");
        let revealed="";
        if(revealParts.length){
          let green=revealParts.map(renderSurfacePart).join("");
          if(!green) green=revealParts.map((item)=>renderItem(item,radians,true)).join("");
          // Il rampicante si posa una volta sola, e anche lui con il ritardo
          // negativo: se il lettore sta girando il plastico proprio mentre si
          // posa, la posa continua invece di ricominciare.
          const revealAt = pergolaGreenAnimating && revealParts[0].revealGroup === "pergola-green"
            ? (revealParts[0].revealDelay || 220) - (performance.now() - pergolaGreenEpoch)
            : null;
          const cls = revealAt != null && revealAt + 460 > 0 ? "reveal-after-build" : "";
          const style = cls ? ` style="animation-delay:${revealAt.toFixed(0)}ms"` : "";
          revealed=`<g class="${cls}"${style} data-reveal-group="${revealParts[0].revealGroup}">${green}</g>`;
        }
        const grow = anim ? ` class="${anim.cls}" style="animation-delay:${anim.at.toFixed(0)}ms"` : "";
        // Dove struttura e verde convivono nella stessa unità — la pergola —
        // il montaggio va su un gruppo INTERNO: il legno cresce, il rampicante
        // no, perché lui si posa dopo e con la sua animazione.
        if (anim && revealed) {
          return `<g data-object="${unit.objectId}"><g${grow}>${regular}</g>${revealed}</g>`;
        }
        return `<g data-object="${unit.objectId}"${grow}>${regular}${revealed}</g>`;
      }
      return "";
    }).join("");

    // Le volute crescono con la scena: erano scostamenti fissi in pixel,
    // quindi restavano della stessa misura mentre il modello cambiava
    // dimensione, e su una piazza piu' grande sembravano tre graffi.
    const w = fit.scale * .30;
    const h = fit.scale * .46;
    const heat = dragging ? "" : heatAnchors.filter((a) => liveAt(a)).map((a, i) => {
      const q = project(a.p,radians);
      return `<path class="heat-line" style="animation-delay:-${phaseOf(HEAT_DUR, i * 1.2)}s"`
        + ` d="M${q.x.toFixed(1)} ${q.y.toFixed(1)} q${(-w).toFixed(1)} ${(-h).toFixed(1)} 0 ${(-h*2).toFixed(1)} q${w.toFixed(1)} ${(-h).toFixed(1)} 0 ${(-h*2).toFixed(1)}"`
        + ` stroke-width="${Math.max(1.4, fit.scale*.075).toFixed(2)}"/>`;
    }).join("");

    const nextFrame = background + materials + paving + heatFloor + shade + contacts + scene + heat;
    hiddenModelBuffer.innerHTML = nextFrame;
    hiddenModelBuffer.setAttribute("visibility", "visible");
    visibleModelBuffer.setAttribute("visibility", "hidden");
    visibleModelBuffer.innerHTML = "";
    const previousBuffer = visibleModelBuffer;
    visibleModelBuffer = hiddenModelBuffer;
    hiddenModelBuffer = previousBuffer;

    rendered = true;
    // Si misura la DURATA del render, non l'intervallo fra due render:
    // da fermi gli intervalli valgono secondi e direbbero «0 fps».
    frameCost.push(performance.now() - started);
    if (frameCost.length > 30) frameCost.shift();
    const sortedCost = [...frameCost].sort((a, b) => a - b);
    if (onFrame) {
      onFrame({
        angle: Math.round((angle % 360 + 360) % 360),
        tilt: Math.round(viewTilt),
        zoom,
        ms: sortedCost[sortedCost.length >> 1],
      });
    }

  }

  function scheduleRender() {
    if (!raf) raf = requestAnimationFrame(render);
  }

  function turn(delta) {
    angle += delta;
    scheduleRender();
  }

  // ── Lo zoom, e perché non è sulla rotellina ───────────────────────────────
  // Il plastico sta dentro una scena AGGANCIATA che avanza con lo scorrimento:
  // rubare la rotellina vorrebbe dire che il lettore, arrivato lì, non riesce
  // più ad andare avanti nella pagina. È il modo classico di rompere una
  // storia lunga, e non c'è taratura che lo salvi — o lo scorrimento passa, o
  // ingrandisce, e il lettore non può saperlo prima di provarci.
  //
  // Quindi lo zoom sta su gesti che allo scorrimento non somigliano affatto:
  //  · i due tasti + e − sotto il modello (il comando dichiarato);
  //  · doppio clic per avvicinarsi di un gradino, e di nuovo per tornare;
  //  · pizzico a due dita sul touch, che il browser qui non usa per altro
  //    perché il contenitore dichiara `touch-action: pan-y` (lo scorrimento
  //    verticale con un dito resta al documento, il pizzico arriva a noi);
  //  · sulla rotellina SOLO con Ctrl o ⌘ premuto, che è il gesto che tutti già
  //    conoscono per ingrandire — e in quel caso si preleva l'evento, così non
  //    parte lo zoom di pagina.
  //
  // ── Ingrandire NON è guardare il centro ───────────────────────────────────
  // Uno zoom che tiene fermo il centro del riquadro è quasi inutile qui: le
  // cose che uno vuole vedere da vicino — la fermata, la fontana, il portico —
  // stanno ai bordi, e ingrandendo scappano fuori tutte insieme. Quindi lo
  // zoom porta con sé uno SPOSTAMENTO (`panX`, `panY`) e ingrandisce attorno al
  // punto che si sta indicando: quel punto resta esattamente dov'è, e il resto
  // della piazza gli si allarga attorno. Doppio clic sulla pensilina e la
  // pensilina è lì, ferma, più grande.
  //
  // Lo spostamento è limitato a quanto il plastico è cresciuto: a zoom 1 vale
  // zero e il riquadro torna da sé alla vista intera, senza doverlo rimettere
  // a posto a mano.
  function clampPan() {
    const maxX = FRAME.w * (zoom - 1) / 2;
    const maxY = FRAME.h * (zoom - 1) / 2;
    panX = Math.max(-maxX, Math.min(maxX, panX));
    panY = Math.max(-maxY, Math.min(maxY, panY));
  }

  function setZoom(next, at = null, silent = false) {
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next));
    if (Math.abs(clamped - zoom) < 0.001) return;
    const k = clamped / zoom;
    if (at) {
      // Il punto indicato resta fermo: si veda la nota di clampPan sopra.
      panX = (at.x - (FRAME.x + FRAME.w / 2)) * (1 - k) + k * panX;
      panY = (at.y - (FRAME.y + FRAME.h / 2)) * (1 - k) + k * panY;
    } else {
      panX *= k;
      panY *= k;
    }
    zoom = clamped;
    clampPan();
    shell.dataset.zoom = zoom > 1.02 ? "in" : "out";
    if (!silent && onZoom) onZoom(zoom);
    scheduleRender();
  }

  function zoomBy(factor, at = null) {
    setZoom(zoom * factor, at);
  }

  function panBy(dx, dy) {
    if (zoom <= 1.001) return;
    panX += dx;
    panY += dy;
    clampPan();
    scheduleRender();
  }

  function resetView() {
    angle = DEFAULT_ANGLE;
    viewTilt = DEFAULT_TILT;
    panX = 0;
    panY = 0;
    setZoom(DEFAULT_ZOOM);
    scheduleRender();
  }

  // Da coordinate di pagina a coordinate del disegno (il viewBox è 960×660,
  // il riquadro sullo schermo è largo quanto capita).
  function toViewBox(event) {
    const box = shell.getBoundingClientRect();
    return {
      x: (event.clientX - box.left) / box.width * 960,
      y: (event.clientY - box.top) / box.height * 660,
    };
  }

  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  // I puntatori attivi sul contenitore. Con due dita si smette di ruotare: si
  // pizzica e si trascina insieme, che è il gesto che tutti conoscono.
  const pointers = new Map();
  let pinchStart = 0;
  let pinchZoomStart = 1;
  let pinchCentre = null;

  const stopDragging = () => {
    if (!dragging) return;
    dragging = false;
    shell.classList.remove("is-dragging");
    scheduleRender();
  };

  const twoFingers = () => {
    const [a, b] = [...pointers.values()];
    return {
      distance: Math.hypot(a.x - b.x, a.y - b.y),
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
    };
  };

  // Il pan si fa con Maiusc, col tasto centrale, o con due dita: il
  // trascinamento nudo resta la rotazione, che è l'identità di questo oggetto.
  const wantsPan = (event) => zoom > 1.001 && (event.shiftKey || event.button === 1);

  on(shell, "pointerdown", (event) => {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      stopDragging();
      const two = twoFingers();
      pinchStart = two.distance;
      pinchZoomStart = zoom;
      pinchCentre = { x: two.x, y: two.y };
      return;
    }
    if (pointers.size > 2) return;
    dragging = true;
    panning = wantsPan(event);
    shell.classList.add("is-dragging");
    lastX = event.clientX;
    lastY = event.clientY;
    shell.setPointerCapture(event.pointerId);
  });

  on(shell, "pointermove", (event) => {
    if (pointers.has(event.pointerId)) {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
    if (pointers.size === 2 && pinchStart > 0) {
      event.preventDefault();
      const two = twoFingers();
      const box = shell.getBoundingClientRect();
      // Due dita fanno le due cose insieme: la distanza ingrandisce, lo
      // spostamento del punto di mezzo trascina.
      setZoom(pinchZoomStart * (two.distance / pinchStart), {
        x: (pinchCentre.x - box.left) / box.width * 960,
        y: (pinchCentre.y - box.top) / box.height * 660,
      });
      panBy(
        (two.x - pinchCentre.x) / box.width * 960,
        (two.y - pinchCentre.y) / box.height * 660,
      );
      pinchCentre = { x: two.x, y: two.y };
      return;
    }
    if (!dragging) return;
    const box = shell.getBoundingClientRect();
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    if (panning) {
      panBy(dx / box.width * 960, dy / box.height * 660);
      return;
    }
    angle -= dx * .42;
    viewTilt = Math.max(MIN_TILT,Math.min(MAX_TILT,viewTilt+dy*.22));
    scheduleRender();
  });

  const releasePointer = (event) => {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) { pinchStart = 0; pinchCentre = null; }
    if (shell.hasPointerCapture?.(event.pointerId)) shell.releasePointerCapture(event.pointerId);
    if (pointers.size === 0) { panning = false; stopDragging(); }
  };
  on(shell, "pointerup", releasePointer);
  on(shell, "pointercancel", releasePointer);

  // Doppio clic: un gradino più vicino SUL PUNTO indicato, e da tutto zoomato
  // si torna alla vista intera. È l'unico gesto del mouse che qui non è già
  // preso dalla rotazione.
  on(shell, "dblclick", (event) => {
    event.preventDefault();
    if (zoom >= MAX_ZOOM - 0.01) { resetView(); return; }
    setZoom(zoom * 1.5, toViewBox(event));
  });

  // `passive: false` è obbligatorio: senza, `preventDefault()` viene ignorato e
  // il Ctrl+rotellina fa ingrandire tutta la pagina invece del plastico.
  on(shell, "wheel", (event) => {
    if (!event.ctrlKey && !event.metaKey) return;   // rotellina nuda = scorrimento
    event.preventDefault();
    setZoom(zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12), toViewBox(event));
  }, { passive: false });

  on(shell, "keydown", (event) => {
    const panStep = 46;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (event.shiftKey) panBy(panStep, 0); else turn(15);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      if (event.shiftKey) panBy(-panStep, 0); else turn(-15);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (event.shiftKey) panBy(0, panStep);
      else { viewTilt = Math.max(MIN_TILT, viewTilt - 3); scheduleRender(); }
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (event.shiftKey) panBy(0, -panStep);
      else { viewTilt = Math.min(MAX_TILT, viewTilt + 3); scheduleRender(); }
    }
    if (event.key === "+" || event.key === "=") { event.preventDefault(); zoomBy(1.25); }
    if (event.key === "-" || event.key === "_") { event.preventDefault(); zoomBy(1 / 1.25); }
    if (event.key === "Home" || event.key === "0") { event.preventDefault(); resetView(); }
  });

  // ── Le tappe ──────────────────────────────────────────────────────────────
  // Nel prototipo le pilotavano due frecce; qui `step` arriva dalla sequenza a
  // tempo di RifugioExplainer, che è la stessa che fa scorrere il testo a lato.
  function setStep(next) {
    const target = Math.max(0, Math.min(RIFUGIO_STEP_COUNT - 1, next));
    const previous = step;
    if (target === step && rendered) return;

    clearTimeout(unbuildTimer);
    unbuilding = null;

    if (!rendered) {
      // Il primo assetto non si monta né si smonta: si trova già fatto. Senza
      // questa uscita la costruzione parte da `step = 7` e la prima cosa che il
      // lettore vedrebbe è il rifugio finito che si smonta all'indietro.
      step = target;
      renderStep = target;
      pergolaGreenReady = target >= 2;
      shell.dataset.step = String(step);
      scheduleRender();
      return;
    }

    if (target > step) {
      // In avanti si monta: i pezzi della tappa nuova crescono dal suolo.
      // `buildLayer` resta acceso per tutta la durata del montaggio, non per un
      // solo disegno: e' quello che permette di girare mentre si costruisce.
      buildLayer = target;
      buildEpoch = performance.now();
      renderStep = target;
      clearTimeout(buildTimer);
      buildTimer = later(() => {
        buildLayer = -1;
        scheduleRender();
      }, (layerBuildMs.get(target) ?? BUILD_MS) + 80);
    } else if (target < step) {
      // Indietro si smonta. I pezzi delle tappe lasciate restano disegnati per
      // la durata del ritiro — `renderStep` non li molla — e solo dopo escono
      // di scena. Senza questo passaggio la tappa precedente spariva di colpo,
      // e la sequenza aveva un verso solo.
      unbuilding = { from: target + 1, to: previous };
      unbuildEpoch = performance.now();
      renderStep = previous;
      unbuildTimer = later(() => {
        unbuilding = null;
        renderStep = step;
        scheduleRender();
      }, UNBUILD_MS + unbuildDelay({ layer: previous, obj: 0 }) + 80);
    }

    clearTimeout(pergolaGreenTimer);
    clearTimeout(pergolaGreenAnimationTimer);
    pergolaGreenAnimating = false;
    if (target < 2) {
      pergolaGreenReady = false;
    } else if (target === 2 && target > previous) {
      // Prima si monta il legno; solo alla fine si inserisce in DOM tutta la
      // massa verde, in un unico gruppo. Così il render della struttura non
      // deve già creare migliaia di facce vegetali nascoste.
      pergolaGreenReady = false;
      pergolaGreenTimer = later(() => {
        if (step < 2) return;
        pergolaGreenReady = true;
        pergolaGreenAnimating = true;
        pergolaGreenEpoch = performance.now();
        scheduleRender();
        pergolaGreenAnimationTimer = later(() => {
          pergolaGreenAnimating = false;
        }, 760);
      }, 820);
    } else {
      pergolaGreenReady = true;
    }

    step = target;
    shell.dataset.step = String(step);
    scheduleRender();
  }

  buildScene();
  measureBuildTimes();
  setStep(0);

  return {
    setStep,
    /** Ruota di `delta` gradi (positivo = antiorario, come la freccia sinistra). */
    turn,
    zoomBy,
    setZoom,
    panBy,
    resetView,
    get zoom() {
      return zoom;
    },
    /** Ridisegna al volo: serve quando il contenitore cambia misura. */
    refresh: scheduleRender,
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
      bindings.forEach((off) => off());
      bindings.length = 0;
      svg.innerHTML = "";
    },
  };
}

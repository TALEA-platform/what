import { CAST, createCastFigures } from "./castFigures.js";

export const RIFUGIO_MODEL_MARKUP = String.raw`
<title id="model-title"></title>
  <desc id="model-desc"></desc>
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

export const RIFUGIO_TEMPERATURES = [
  { value: "36°", tint: "#8E3F25", label: "#7D3A25" },
  { value: "34°", tint: "#8E3F25", label: "#7D3A25" },
  { value: "33°", tint: "#87492B", label: "#7D3A25" },
  { value: "33°", tint: "#87492B", label: "#7D3A25" },
  { value: "32°", tint: "#6E5A34", label: "#5F4E2C" },
  { value: "32°", tint: "#6E5A34", label: "#5F4E2C" },
  { value: "31°", tint: "#3F6B3C", label: "#345A32" },
  { value: "31°", tint: "#3F6B3C", label: "#345A32" },
];

export const RIFUGIO_STEP_COUNT = RIFUGIO_TEMPERATURES.length;

// Kept outside React: each frame replaces thousands of SVG polygons through two buffers.
export function createRifugioModel(shell, options = {}) {
  const svg = shell.querySelector("svg");
  svg.innerHTML = RIFUGIO_MODEL_MARKUP;
  svg.querySelector("#model-title").textContent = options.title ?? "";
  svg.querySelector("#model-desc").textContent = options.description ?? "";

  let visibleModelBuffer = svg.querySelector("#model-a");
  let hiddenModelBuffer = svg.querySelector("#model-b");
  const sun = svg.querySelector("#sun");
  const roadVolumeClipShape = svg.querySelector("#road-volume-clip-shape");
  const onFrame = typeof options.onFrame === "function" ? options.onFrame : null;
  const onZoom = typeof options.onZoom === "function" ? options.onZoom : null;
  const mobileMode = options.mobile === true;

  const MIN_ZOOM = 1;
  const MAX_ZOOM = 2.4;
  const DEFAULT_ZOOM = 1;
  let zoom = DEFAULT_ZOOM;
  let notifiedZoomBand = 0;
  let panX = 0;
  let panY = 0;
  let panning = false;

  let unbuildTimer = 0;

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

  const SUN_AZ = 8 * Math.PI / 180;
  const SUN_EL = 46 * Math.PI / 180;
  const SUN_DIST = 34;
  const SUN_WORLD = {
    x: Math.cos(SUN_EL) * Math.cos(SUN_AZ) * SUN_DIST,
    y: Math.cos(SUN_EL) * Math.sin(SUN_AZ) * SUN_DIST,
    z: Math.sin(SUN_EL) * SUN_DIST,
  };
  let SUN_SCREEN = { x: 748, y: 126 };

  const FRAME = { x: 24, y: 112, w: 912, h: 534 };
  const SCENE_BOUNDS = { x0: -10.9, y0: -6.2, x1: 10.9, y1: 14.1, z1: 4.6 };
  let fit = { scale: 26, ox: 480, oy: 350 };
  const DEFAULT_ANGLE = 5;
  const DEFAULT_TILT = 35;
  const MIN_TILT = 22;
  const MAX_TILT = 52;
  const CAR_DURATION_SECONDS = 11;
  const trafficEpoch = performance.now();
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

  // A rotation-invariant circumscribed radius prevents the model pulsing while it turns.
  function computeFit(radians) {
    const b = SCENE_BOUNDS;
    const cx = (b.x0 + b.x1) / 2;
    const cy = (b.y0 + b.y1) / 2;
    const radius = Math.max((b.x1 - b.x0) / 2, (b.y1 - b.y0) / 2);

    const elevation = viewTilt * Math.PI / 180;
    const normalization = 1 / Math.cos(DEFAULT_TILT * Math.PI / 180);
    const groundY = Math.sin(elevation) / Math.SQRT2 * normalization;
    const verticalY = Math.cos(elevation) * normalization;

    const halfWidth = radius * Math.SQRT2 * C30;
    const halfGround = radius * Math.SQRT2 * groundY;
    const height = 2 * halfGround + b.z1 * verticalY;
    const scale = Math.min(FRAME.w / (2 * halfWidth), FRAME.h / Math.max(.001, height)) * zoom;

    const centre = camera2d(point(cx, cy, 0), radians);
    const midY = centre.y - b.z1 * verticalY / 2;
    fit = {
      scale,
      ox: FRAME.x + FRAME.w / 2 - centre.x * scale + panX,
      oy: FRAME.y + FRAME.h / 2 - midY * scale + panY,
    };
  }

  function depthOf(points, radians) {
    return depthOfPoint(average(points), radians);
  }

  function depthOfPoint(pointValue, radians) {
    const p = rotate(pointValue, radians);
    const elevation = viewTilt * Math.PI / 180;
    return (p.x + p.y) * Math.cos(elevation) / Math.SQRT2 + p.z * Math.sin(elevation);
  }

  // Thin and organic pieces opt into double-sided rendering to avoid rotation flicker.
  function visible(normal, radians) {
    const n = rotate(normal, radians);
    const elevation = viewTilt * Math.PI / 180;
    const horizontal = Math.cos(elevation) / Math.SQRT2;
    const facing = n.x * horizontal + n.y * horizontal + n.z * Math.sin(elevation);
    return facing > -.035;
  }

  function stableDepth(item, radians) {
    const raw = depthOf(item.points, radians) + (item.depthBias || 0);
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

  let currentLayer = 0;
  let currentGoneAt = null;
  let step = 7;
  let renderStep = step;

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

  // Build timing is per object, not per polygon, to cap simultaneous CSS animations.
  function beginObject(quiet = false) {
    const n = layerObjects.get(currentLayer) ?? 0;
    layerObjects.set(currentLayer, n + 1);
    objectSeq = n;
    currentObjectUid = ++objectUid;
    pieceSeq = 0;
    currentBuildAxis = (currentLayer === 1 || currentLayer === 5) ? "grow" : "pop";
    noBuild = quiet;
  }

  function beginPiece(axis = "pop") {
    pieceSeq += 1;
    currentBuildAxis = axis;
  }

  const liveAt = (item, k = renderStep) =>
    (item.layer ?? 0) <= k && (item.goneAt == null || k < item.goneAt);

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

  const FIGURE_BASE = { className: "face face--figure", figure: true };
  let figureOptions = FIGURE_BASE;
  const figureAnchors = new Map();
  const figureTopology = new Map();

  function beginFigure(id, x, y) {
    figureOptions = { ...FIGURE_BASE, figureId: id };
    figureAnchors.set(id, point(x, y, .95));
    figureTopology.set(id, {
      layer: currentLayer,
      goneAt: currentGoneAt,
      seq: itemSeq,
    });
  }
  function endFigure() { figureOptions = FIGURE_BASE; }

  const CAST_SCALE = 1.10;

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

  function phaseOf(now, dur, offset = 0) {
    return (((now - trafficEpoch) / 1000 + offset) % dur).toFixed(3);
  }

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
    figureOptions: () => figureOptions,
    benchSeatZ: () => BENCH_SEAT_Z,
    detail: mobileMode ? .75 : 1,
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


  function renderShadows(radians, activeShadows) {
    const clip = shadowGroundSurfaces
      .map((surface) => `<polygon points="${ptsAttr(surface,radians)}"/>`)
      .join("");
    const shade = activeShadows.map((shadow) => {
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

    const dx = x0 + (x1-x0)*.5;
    const doorW = Math.min(.9,(x1-x0)*.24);

    addWindowsForSide("yp",y1,x0,x1,height,bodySurfaces.yp,{skipNear:dx});
    addWindowsForSide("yn",y0,x0,x1,height,bodySurfaces.yn);
    addWindowsForSide("xp",x1,y0,y1,height,bodySurfaces.xp);
    addWindowsForSide("xn",x0,y0,y1,height,bodySurfaces.xn);

    addDetailedDoor(y1,dx,doorW,bodySurfaces.yp);
    return { x0, y0, x1, y1, height, rise };
  }

  const PORTICO_DEPTH = .94;

  function addPorticoArm(id, axis, back, a0, a1, first, last, bays, height, options = {}) {
    const { skipFirstColumn = false, floorFrom = a0 } = options;
    const depth = PORTICO_DEPTH;
    const roofZ = height;
    const P = (along, across, z) => axis === "x"
      ? point(along, back + across, z)
      : point(back + across, along, z);
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

    const beam = (from, to, tag) => {
      const two = { doubleSided: true, depthGroup: `${id}-roof-${tag}` };
      addBox(solids,...R(from,to,-.04,depth+.08),.2,
        {top:C.cornice,xp:C.stoneSide,xn:C.stoneDark,yp:C.cornice,yn:C.stoneSide},roofZ-.06,two);
      addBox(solids,...R(from,to,depth-.09,depth+.1),.22,
        {top:C.cornice,xp:C.stoneSide,xn:C.stoneDark,yp:C.cornice,yn:C.stoneSide},roofZ-.24,two);
    };
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
      const archOptions={className:"face face--soft",softness:.86,doubleSided:true,depthGroup:`${id}-arch-${i}`};
      for(let j=0;j<arc.length-1;j++) {
        addTaperedTube(solids, arc[j], arc[j+1], .038, .038, C.wallSide, 4, archOptions);
      }
      addTaperedTube(solids,P(a,depth+.012,.28),P(a,depth+.012,spring),.026,.026,C.wallSide,4,archOptions);
      addTaperedTube(solids,P(b,depth+.012,.28),P(b,depth+.012,spring),.026,.026,C.wallSide,4,archOptions);
    }
    for (let i = 0; i < cuts.length - 1; i++) {
      addLine(details,[P(cuts[i],depth+.015,roofZ-.2),P(cuts[i+1],depth+.015,roofZ-.2)],
        frontNormal,{className:"detail",stroke:"#786548",opacity:.42,depthGroup:`${id}-roof-${i}`});
    }
  }

  function addCast3D() {
    beginLayer(0, 3);
    beginObject(true);
    beginFigure("elder",-6.0,1.7);
    addElder3D(-6.0,1.7);
    beginLayer(3);
    beginObject(true);
    beginFigure("elderSeated",BENCH_ELDER.x,BENCH_ELDER.y);
    addElderSeated3D(BENCH_ELDER.x,BENCH_ELDER.y);

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

    beginLayer(0, 6);
    beginObject(true);
    beginFigure("wheelchair",1.35,1.35);
    addWheelchair3D(1.35,1.35);
    beginLayer(6);
    beginObject(true);
    const chairTransit={x:-.55,y:8.6};
    beginFigure("wheelchairTransit",chairTransit.x,chairTransit.y);
    addWheelchair3D(chairTransit.x,chairTransit.y,Math.PI/2);

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

  const ROAD = { narrow: 12.2, wide: 13.5 };
  const CYCLE = { y0: 10.1, y1: 11.4 };

  const PIAZZA = {
    x0: -10.2, y0: -6.6, x1: 10.2, y1: 9.3,
    kerbY: 10.1,
    roadY: ROAD.wide,
    innerX: 9.2, frontY: -6.2, backY: 8.3,
    sagratoY: -2.3,
  };

  const CAR_LANE = {
    before: (PIAZZA.kerbY + ROAD.narrow) / 2,
    after: (CYCLE.y1 + ROAD.wide) / 2,
  };
  const CAR_LANE_Y = CAR_LANE.before;
  const laneY = () => (renderStep >= 7 ? CAR_LANE.after : CAR_LANE.before);
  const roadEdge = () => (renderStep >= 7 ? ROAD.wide : ROAD.narrow);
  const BENCH_ELDER = { x: -7.3, y: 4.9 };

  const PORTICO = {
    backY: -3.26,
    leftX: -9.75,
    endY: 7.4,
  };
  PORTICO.frontX = PORTICO.leftX + PORTICO_DEPTH;
  PORTICO.clearX = PORTICO.frontX + .21;

  const PERGOLA = { x0: -3.9, y0: 2.2, x1: 2.6, y1: 5.2, shift: -1.1 };


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

  const SOFT = { className: "face face--soft", doubleSided: true };

  function addBlob(target, cx, cy, cz, rx, ry, rz, fill, seed = 0, lon = 12, options = {}) {
    const lat = 7;
    const warp = (a, l) =>
      1 + .2 * Math.sin(l * 3 + seed * 2.1) * Math.cos(a * 2.3 + seed * 1.3)
        + .12 * Math.sin(l * 5.3 - seed * 3.7)
        + .08 * Math.cos(a * 3.1 + seed * .9);
    const rows = [];
    for (let i = 0; i <= lat; i++) {
      const a = -Math.PI / 2 + (i / lat) * Math.PI;
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

    const tint = [G.leaf, G.leafDark, "#7FA968", "#6B9757", "#5F8C50"];
    addBlob(solids, cx + j(11) * radius * .16, cy + j(12) * radius * .16, height * .74,
      radius * (1 + j(13) * .12), radius * (.94 + j(14) * .12), radius * (.66 + j(15) * .14),
      tint[seed % tint.length], seed, 13, canopyOptions);
  }

  function addPergola(x0, y0, x1, y1, height) {
    shadowPolygon(x0, y0, x1, y1, height * .92, .15);
    const id = `pergola-${x0}`;
    for (const px of [x0 + .18, x1 - .18]) for (const py of [y0 + .18, y1 - .18]) {
      beginPiece("y");
      addBox(solids, px-.11, py-.11, px+.11, py+.11, height,
        {top:G.post,xp:G.post,xn:G.barkDark,yp:G.post,yn:G.barkDark}, .18,
        { depthGroup: `${id}-post-${px}-${py}` });
    }
    const bays = Math.max(4, Math.round((x1 - x0) / .78));
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

    const topZ = height + .48;
    const bayAt = (x) =>
      Math.max(0, Math.min(bays, Math.round((x - x0) / (x1 - x0) * bays)));
    const VINE_DETAIL = {
      ...SOFT, dragSkip:true, noBuild:true,
      revealAfterBuild:true, revealDelay:220,
      revealGroup:"pergola-green", doubleSided:true,
    };
    const vineOn = (group) => ({ ...VINE_DETAIL, depthGroup: group });
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
      addBlob(solids, gx, gy, topZ + .04, .34 + w * .16, .3 + w * .14, .1 + w * .05,
        w > .55 ? G.leaf : G.leafDark, i * 3 + 1, 8, { ...onBay, softness: .68 });
      if (i % 3 === 1) {
        addTaperedTube(solids, point(gx, gy, topZ), point(gx + (w - .5) * .18, gy, height + .1),
          .022, .016, G.leafDark, 4, onBay);
        addBlob(solids, gx + (w - .5) * .18, gy, height + .04,
          .16, .15, .19, G.leaf, i * 7 + 3, 7, { ...onBay, softness: .72 });
      }
    }
  }

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

  function addFountain(cx, cy, radius) {
    const seg = 16;
    const ring = (r, z) => Array.from({length: seg}, (_, i) => {
      const a = i / seg * Math.PI * 2;
      return point(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z);
    });
    shadowPolygon(cx-radius, cy-radius, cx+radius, cy+radius, .5, .1);

    beginPiece("pop");
    const outer = ring(radius, .52);
    const outerBase = ring(radius, .2);
    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg;
      const a = (i + .5) / seg * Math.PI * 2;
      addFace(solids, [outerBase[i], outerBase[j], outer[j], outer[i]], G.stone,
        {x: Math.cos(a), y: Math.sin(a), z: 0});
    }

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
    const arc = [[0, 1.04], [.16, .96], [.28, .78], [.36, .5], [.4, .22]];
    for (let i = 0; i < arc.length - 1; i++) {
      addTaperedTube(solids,
        point(cx, cy + .42 + arc[i][0], arc[i][1]),
        point(cx, cy + .42 + arc[i+1][0], arc[i+1][1]),
        .026 - i * .003, .023 - i * .003, G.waterFoam, 5,
        { className:"face face--soft water-jet", opacity:.8, jet: i * .12 });
    }
    addFace(solids, Array.from({length: 12}, (_, i) => {
      const a = i / 12 * Math.PI * 2;
      return point(cx + Math.cos(a) * .3, cy + .82 + Math.sin(a) * .22, .212);
    }), G.water, {x:0,y:0,z:1}, {stroke:"none", opacity:.7});
    addBlob(solids, cx, cy + .82, .26, .13, .1, .09, G.waterFoam, 5, 7,
      { className:"face face--soft water-jet", opacity:.7, softness:.8, jet:.6 });
  }

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

  function addGreenPatch(x0, y0, x1, y1, flowerSpots = null) {
    addFace(groundSurfaces, [point(x0,y0,.213),point(x1,y0,.213),point(x1,y1,.213),point(x0,y1,.213)],
      G.grass, {x:0,y:0,z:1}, {stroke:"none"});
    addLine(groundLines, [point(x0,y0,.232),point(x1,y0,.232),point(x1,y1,.232),point(x0,y1,.232),point(x0,y0,.232)],
      {x:0,y:0,z:1}, {className:"aiuola-line",stroke:G.grassDark,opacity:.5});
    const nx = Math.max(2, Math.round((x1 - x0) / 1.35));
    const ny = Math.max(2, Math.round((y1 - y0) / 1.15));
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      const gx = x0 + (x1 - x0) * ((i + .5) / nx);
      const gy = y0 + (y1 - y0) * ((j + .5) / ny);
      const k = Math.sin(i * 12.9 + j * 78.2) * .5 + .5;
      addLine(groundLines, [point(gx,gy,.235), point(gx + (k - .5) * .22, gy - .1, .235 + .22 + k * .12)],
        {x:0,y:0,z:1}, {className:"grass-tuft",stroke:G.grassDark,opacity:.72});
    }
    const spots = flowerSpots || [[.22,.42,5,.31],[.53,.58,4,.26],[.76,.36,4,.24]];
    spots.forEach(([u,v,n,spread],i) => {
      addFlowerCluster(x0+(x1-x0)*u, y0+(y1-y0)*v, n, spread, .22, Math.round((x0+x1*3)*7)+i*13);
    });
  }

  function addRainGarden(x0, y0, x1, y1) {
    const R = {
      bank: "#9C9F7C",
      bed: "#8A8674",
      wet: "#6F7A6E",
      film: "#93B4B6",
      stone: "#B4AE9A",
      rush: "#6E8F76",
      rushDry: "#A98B4E",
      sedge: "#7FA08A",
    };
    const BED = .098;
    const bank = .22;
    const ix0 = x0 + bank, ix1 = x1 - bank;
    const iy0 = y0 + bank, iy1 = y1 - bank;

    const rim = (a, b, c, d, normal) => addFace(groundSurfaces, [a, b, c, d], R.bank, normal,
      { stroke: "none", doubleSided: true, depthGroup: "raingarden-bank" });
    rim(point(x0,y0,.207), point(x1,y0,.207), point(ix1,iy0,.207-BED), point(ix0,iy0,.207-BED), {x:0,y:-.4,z:1});
    rim(point(x1,y1,.207), point(x0,y1,.207), point(ix0,iy1,.207-BED), point(ix1,iy1,.207-BED), {x:0,y:.4,z:1});
    rim(point(x0,y1,.207), point(x0,y0,.207), point(ix0,iy0,.207-BED), point(ix0,iy1,.207-BED), {x:-.4,y:0,z:1});
    rim(point(x1,y0,.207), point(x1,y1,.207), point(ix1,iy1,.207-BED), point(ix1,iy0,.207-BED), {x:.4,y:0,z:1});

    addFace(groundSurfaces,[point(ix0,iy0,.207-BED),point(ix1,iy0,.207-BED),point(ix1,iy1,.207-BED),point(ix0,iy1,.207-BED)],
      R.bed,{x:0,y:0,z:1},{stroke:"none",depthGroup:"raingarden-bed"});
    addFace(groundSurfaces,[point(ix0+.1,iy0+.5,.206-BED),point(ix1-.1,iy0+.5,.206-BED),
                            point(ix1-.1,iy1-.5,.206-BED),point(ix0+.1,iy1-.5,.206-BED)],
      R.wet,{x:0,y:0,z:1},{stroke:"none",opacity:.9,depthGroup:"raingarden-bed"});

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

    for (const bx of [x0, x1]) {
      addLine(groundLines,[point(bx,y0,.231),point(bx,y1,.231)],{x:0,y:0,z:1},
        {className:"aiuola-line",stroke:"#7C7F62",opacity:.65});
    }

    const alongX = (ix1 - ix0) >= (iy1 - iy0);
    const span = alongX ? ix1 - ix0 : iy1 - iy0;
    const at = (t, u) => alongX
      ? { x: ix0 + (ix1 - ix0) * t, y: iy0 + (iy1 - iy0) * u }
      : { x: ix0 + (ix1 - ix0) * u, y: iy0 + (iy1 - iy0) * t };

    const seedAt = (i) => Math.sin(i * 12.9898 + 4.71) * .5 + .5;
    const stones = Math.max(6, Math.round(span / .72));
    for (let i = 0; i < stones; i++) {
      const k = seedAt(i);
      const p = at((i + .5) / stones, .2 + k * .6);
      addEllipsoid(solids, p.x, p.y, .215 - BED,
        .07 + k * .04, .06 + k * .03, .028, R.stone, 0,
        { ...SOFT, softness: .85, dragSkip: true, depthGroup: `raingarden-stone-${i}` }, 5);
    }

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
      addBlob(solids,hx,hy,.2+height*.52,
        length/n*.66,(y1-y0)*1.2,height*(.62+k*.13),
        i%3===0?G.leafLight:(i%2?G.leaf:G.leafDark),i+31,7,
        {...SOFT,doubleSided:true,softness:.82,depthGroup:`${id}-${i}`});
    }
  }

  function addPlanter(cx, cy, w, d, height) {
    const group = `planter-${cx}-${cy}`;
    addBox(solids, cx-w/2, cy-d/2, cx+w/2, cy+d/2, height,
      {top:G.soil,xp:G.stone,xn:G.stoneDark,yp:G.stone,yn:G.stoneDark}, .2, {depthGroup:group});
    addBlob(solids, cx-w*.08, cy, .2 + height + .24, w*.18, d*.2, .24, G.leaf, 11, 9,
      {...SOFT,doubleSided:true,softness:.92,depthGroup:group});
    addBlob(solids, cx+w*.1, cy-.02, .2 + height + .25, w*.17, d*.19, .22, G.leafDark, 17, 9,
      {...SOFT,doubleSided:true,softness:.94,depthGroup:group});
    const wilt = { dragSkip: true };
    addFlowerCluster(cx-w*.18,cy+d*.18,3,.10,.2+height+.04,Math.round((cx+10)*7),group,wilt);
    addFlowerCluster(cx+w*.18,cy+d*.12,3,.095,.2+height+.04,Math.round((cx+12)*9),group,wilt);
  }


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
    beginPiece("y");
    addFace(solids,[point(cx-w/2,cy-d/2,.2),point(cx+w/2,cy-d/2,.2),point(cx+w/2,cy-d/2,h),point(cx-w/2,cy-d/2,h)],
      G.shelterGlass,{x:0,y:-1,z:0},{opacity:.55});
    addBench(cx, cy - d * .14, Math.PI / 2, w * .6);
    const px = cx + w / 2 + .8;
    beginPiece("y");
    addTaperedTube(solids, point(px,cy,.2), point(px,cy,2.5), .055, .045, G.metalDark, 6, {});
    beginPiece("pop");
    addBox(solids, px-.05, cy-.42, px+.05, cy+.42, .5,
      {top:"#E8A23C",xp:"#E8A23C",xn:"#C98526",yp:"#E8A23C",yn:"#C98526"}, 2.35);
  }

  const busSolids = [];
  const busDetails = [];
  const busDoors = [];
  const busLod = [];
  const busGround = [];

  function addBusModel() {
    const y = CAR_LANE_Y;
    const B = { body:"#4F7A6B", side:"#41675A", top:"#7CA091", glass:"#93B4BC",
                glassDark:"#7E9DA6", trim:"#E8D9A8", skirt:"#37544A" };
    const L = 2.5, W = .56, Z0 = .3, Z1 = 1.68;
    const BEVEL = .11;
    const V = { className: "face face--vehicle", doubleSided:true };
    const Vq = { className: "face face--vehicle face--quiet", doubleSided:true };

    addFace(busGround,[point(-L-.1,y-W-.06,.145),point(L+.1,y-W-.06,.145),
      point(L+.1,y+W+.06,.145),point(-L-.1,y+W+.06,.145)],
      C.ink,{x:0,y:0,z:1},{stroke:"none",opacity:.14});

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
    addFace(busSolids,[point(nose,y-W,Z0),point(L,y-W+.1,Z0+.12),point(L,y+W-.1,Z0+.12),point(nose,y+W,Z0)],
      B.body,{x:1,y:0,z:-.2},V);
    addFace(busSolids,[point(L,y-W+.1,Z0+.12),point(L,y+W-.1,Z0+.12),point(nose,y+W,Z1-.1),point(nose,y-W,Z1-.1)],
      B.glass,{x:.85,y:0,z:.35},Vq);
    addFace(busSolids,[point(nose,y-W,Z1-.1),point(nose,y+W,Z1-.1),point(nose,y+W-BEVEL,Z1),point(nose,y-W+BEVEL,Z1)],
      B.top,{x:1,y:0,z:.6},V);
    addBox(busSolids,-L,y-W-.015,nose,y+W+.015,.2,
      {top:B.skirt,xp:B.skirt,xn:B.skirt,yp:B.skirt,yn:B.skirt},Z0-.02,V);
    addBox(busSolids,-L,y-W-.02,nose,y+W+.02,.07,
      {top:B.trim,xp:B.trim,xn:B.trim,yp:B.trim,yn:B.trim},1.1,V);
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

    for (const list of [busSolids, busDetails, busDoors, busLod, busGround]) {
      for (const item of list) {
        const offset = item.points.reduce((s,p)=>s+p.y,0)/item.points.length - y;
        item.busSide = offset > .12 ? 1 : (offset < -.12 ? -1 : 0);
      }
    }
  }

  function addCycleLane(x0, x1) {
    beginPiece("x");
    addFace(groundSurfaces,[point(x0,CYCLE.y0,.118),point(x1,CYCLE.y0,.118),
                            point(x1,CYCLE.y1,.118),point(x0,CYCLE.y1,.118)],
      "#A8705B",{x:0,y:0,z:1},{stroke:"none",opacity:.82,depthBias:.012});
    for (const ly of [CYCLE.y0 + .08, CYCLE.y1 - .08]) {
      addLine(groundLines,[point(x0,ly,.126),point(x1,ly,.126)],{x:0,y:0,z:1},
        {className:"aiuola-line",stroke:"#F2EAD8",opacity:.75});
    }
    for (let i = 0; i < 5; i++) {
      const ax = x0 + (x1 - x0) * ((i + .5) / 5);
      const my = (CYCLE.y0 + CYCLE.y1) / 2;
      addLine(groundLines,[point(ax-.28,my-.22,.127),point(ax+.22,my,.127),point(ax-.28,my+.22,.127)],
        {x:0,y:0,z:1},{className:"aiuola-line",stroke:"#F2EAD8",opacity:.62});
    }
  }

  function addBikeStation(cx, cy) {
    const id = `bike-${cx}`;
    const racks = 4, pitch = .62;
    const first = cx - (racks - 1) * pitch / 2;
    shadowPolygon(cx - 1.5, cy - .5, cx + 1.5, cy + .5, .9, .1);

    for (let i = 0; i < racks; i++) {
      const rx = first + i * pitch;
      const group = { depthGroup: `${id}-rack-${i}` };
      beginPiece("y");
      const top = .2 + .72;
      addTaperedTube(solids, point(rx,cy-.32,.2), point(rx,cy-.32,top-.1), .032, .03, G.metal, 5, group);
      addTaperedTube(solids, point(rx,cy+.32,.2), point(rx,cy+.32,top-.1), .032, .03, G.metal, 5, group);
      addTaperedTube(solids, point(rx,cy-.32,top-.1), point(rx,cy+.32,top-.1), .03, .03, G.metal, 5, group);
    }

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
    const roadTone = {top:C.road,xp:C.roadSide,xn:C.roadSide,yp:C.roadSide,yn:C.roadSide};
    beginLayer(0, 7); beginObject(true);
    addBox(baseFaces,Z.x0-.6,Z.kerbY,Z.x1+.6,ROAD.narrow,.11,roadTone);
    beginLayer(7); beginObject(true);
    addBox(baseFaces,Z.x0-.6,Z.kerbY,Z.x1+.6,ROAD.wide,.11,roadTone);
    beginLayer(0); beginObject(true);

    addFace(groundSurfaces,[point(-9.8,-6.2,.205),point(9.8,-6.2,.205),point(9.8,Z.y1-.35,.205),point(-9.8,Z.y1-.35,.205)],C.pavingEdge,{x:0,y:0,z:1},{stroke:"none"});
    addFace(groundSurfaces,[point(-9.2,-6.2,.21),point(9.2,-6.2,.21),point(9.2,Z.sagratoY,.21),point(-9.2,Z.sagratoY,.21)],C.pavingForecourt,{x:0,y:0,z:1},{stroke:"none"});
    addFace(groundSurfaces,[point(-9.2,Z.sagratoY,.21),point(9.2,Z.sagratoY,.21),point(9.2,Z.backY,.21),point(-9.2,Z.backY,.21)],C.pavingCentre,{x:0,y:0,z:1},{stroke:"none"});

    [[-7.6,-3.3],[-1.4,-3.5],[5.6,-3.3]].forEach(([dx,dy])=>{
      addFace(groundSurfaces,[point(dx-.55,dy+.02,.218),point(dx+.55,dy+.02,.218),point(dx+.55,dy+1.15,.218),point(dx-.55,dy+1.15,.218)],C.threshold,{x:0,y:0,z:1},{stroke:"none",opacity:.72});
    });
    addFace(groundSurfaces,[point(-.45,1.2,.216),point(.45,1.2,.216),point(.45,Z.backY,.216),point(-.45,Z.backY,.216)],"#D5C29C",{x:0,y:0,z:1},{stroke:"none",opacity:.34});

    addFace(groundSurfaces,[point(-9.5,Z.backY+.18,.219),point(9.5,Z.backY+.18,.219),point(9.5,Z.backY+.42,.219),point(-9.5,Z.backY+.42,.219)],C.drain,{x:0,y:0,z:1},{stroke:"none",opacity:.62});
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

    beginObject(true);
    addBuilding(-9.2,-5.7,-5.0,-3.3,3.3,.95);
    beginObject(true);
    addBuilding(-3.2,-5.7,1.2,-3.5,2.8,.8);
    beginObject(true);
    addBuilding(3.4,-5.7,8.6,-3.3,3.5,1.0);
    beginObject(true);
    addPorticoArm("portico-back","x",PORTICO.backY,PORTICO.leftX,-.55,PORTICO.frontX,-.73,6,2.12);
    beginObject(true);
    addPorticoArm("portico-left","y",PORTICO.leftX,-2.16,PORTICO.endY,PORTICO.backY + PORTICO_DEPTH,7.22,7,2.12,
      { skipFirstColumn: true, floorFrom: PORTICO.backY + PORTICO_DEPTH });
    beginObject();

    addCast3D();

    beginLayer(0, 5);
    beginObject(true);
    addCarModel();
    beginLayer(0);

    heatAnchors.push(
      { p: point(-5.2,4.2,.23), goneAt: 2 },
      { p: point(.2,3.4,.23),  goneAt: 2 },
      { p: point(5.4,4.4,.23), goneAt: 2 },
    );

    beginLayer(1);
    [[-7.2,-1.05,3.85,1.82,1],[-1.8,-1.15,3.25,1.48,2],[4.9,-1.12,3.75,1.72,3]]
      .forEach(([x,y,h,r,s]) => addTree(x,y,h,r,s));
    addTree(6.2,6.65,3.05,1.38,6);

    beginLayer(2);
    beginObject(); addPergola(PERGOLA.x0,PERGOLA.y0,PERGOLA.x1,PERGOLA.y1,2.85);
    beginObject(); addCanopy(PORTICO.clearX + .3,3.6,-4.8,5.8,2.7);

    beginLayer(3);
    [[BENCH_ELDER.x,BENCH_ELDER.y,PERSON_YAW,1.9],[2.9,.9,PERSON_YAW,2.0],
     [-1.6,4.1+PERGOLA.shift,PERSON_YAW,2.1],[1.5,5.8+PERGOLA.shift,PERSON_YAW+Math.PI,2.1],
     [-5.6,2.4,PERSON_YAW,2.1]]
      .forEach(([x,y,a,l]) => { beginObject(); addBench(x,y,a,l); });

    beginLayer(4);
    beginObject(); addFountain(7.1,2.7,1.4);
    beginObject(); addDrinkingFountain(-5.3,5.4);
    beginObject(true);
    addBird(6.35,2.35,.56,PERSON_YAW+.5,1,0);
    addBird(7.85,3.1,.56,PERSON_YAW-1.9,4,4.2);
    addBird(-1.2,PERGOLA.y0+.2,3.36,PERSON_YAW+.9,7,7.6);

    beginLayer(5);
    beginObject(); addGreenPatch(PORTICO.clearX,-2.3,9.1,.55,[
      [.226,.193,5,.30],[.294,.684,4,.26],[.537,.246,4,.28],
      [.650,.737,5,.30],[.876,.281,4,.26],[.932,.772,4,.24],
    ]);
    beginObject(); addGreenPatch(PORTICO.clearX,5.7,-4.2,8.0);
    beginObject(); addGreenPatch(3.9,5.9,9.1,8.0);
    beginObject(); addRainGarden(3.65,1.6,4.85,5.6);
    beginObject(); addHedge(PORTICO.clearX,8.05,-3.4,8.35,.55);
    beginObject(); addHedge(6.05,8.05,9.1,8.35,.55);
    beginObject(); addPicnicTable(-5.2,-.35);
    beginObject(); addPlanter(-3.0,7.3,1.05,1.05,.48);
    beginObject(); addPlanter(-1.7,7.8,.9,.9,.42);

    beginLayer(6);
    beginObject(); addBusStop(3.2,8.6);
    beginObject(); addTactilePath(2.92,.3,3.48,7.05);
    beginObject(); addTactilePath(-.83,7.05,3.48,7.6);
    beginObject(); addTactilePath(-.83,7.6,-.27,8.2);
    beginObject(); addTactilePath(-6.6,4.6,-4.25,5.15);
    beginObject(true); addBusModel();

    beginLayer(7);
    beginObject(); addCycleLane(PIAZZA.x0 - .6, PIAZZA.x1 + .6);
    beginObject(); addBikeStation(-5.4, 9.65);

    beginLayer(0);
  }

  const buildAxisOf = (item) =>
    ["grow","x","y","pop"].includes(item.buildAxis) ? item.buildAxis : "pop";

  // One group animation replaces hundreds of identical per-face animations.
  function unitAnimation(parts, now) {
    const first = parts[0];
    if (!first) return null;
    const k = first.layer ?? 0;

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

  function renderItem(item, radians, now, forceVisible = false, quiet = false) {
    if (!forceVisible && item.normal && !item.doubleSided && !visible(item.normal,radians)) return "";
    const k = item.layer ?? 0;
    const isFace = item.type === "face";
    let cls = item.className || (isFace ? "face" : "detail");
    let extra = ` data-layer="${k}"`;
    const buildAt = !quiet && building0(item, k) ? buildDelay(item) - (now - buildEpoch) : null;
    const building = buildAt != null && buildAt + BUILD_MS > 0;
    const leaving = !quiet && unbuilding != null && k >= unbuilding.from && k <= unbuilding.to && !item.noBuild;
    const leaveAt = leaving ? unbuildDelay(item) - (now - unbuildEpoch) : 0;
    const axis = buildAxisOf(item);
    // Negative delays preserve animation progress when innerHTML recreates the nodes.
    const style = building
      ? `animation-delay:${buildAt.toFixed(0)}ms`
      : leaving
        ? `animation-delay:${leaveAt.toFixed(0)}ms`
      : item.ripple != null ? `animation-delay:-${phaseOf(now, RIPPLE_DUR, item.ripple)}s`
      : item.jet != null ? `animation-delay:-${phaseOf(now, JET_DUR, item.jet)}s`
      : item.perch != null ? `animation-delay:-${phaseOf(now, PERCH_DUR, item.perch)}s`
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

  function sortedVisible(items, radians) {
    return items
      .filter((item) => !item.normal || item.doubleSided || visible(item.normal,radians))
      .sort((a,b) => compareItems(a,b,radians));
  }

  const BUS_SECONDS = 24;

  const laneDepth = (worldX, z, radians) => depthOf([point(worldX, laneY(), z)], radians);

  const BUS_ARRIVE = .42, BUS_LEAVE = .61;

  function renderBus(radians, now, lightweight) {
    if (renderStep < 6) return null;
    const centre = project(point(0,CAR_LANE_Y,.15),radians);
    const fromX = PIAZZA.x0 - 5.2, stopX = 3.2, toX = PIAZZA.x1 + 5.2;
    const off = (x) => {
      const p = project(point(x,laneY(),.15),radians);
      return [`${(p.x-centre.x).toFixed(1)}px`, `${(p.y-centre.y).toFixed(1)}px`];
    };
    const [sx,sy] = off(fromX), [mx,my] = off(stopX), [ex,ey] = off(toX);
    const phase = ((now - trafficEpoch) / 1000 + 2.4) % BUS_SECONDS;
    const delay = `animation-delay:-${phase.toFixed(3)}s`;

    const near = visible({x:0,y:1,z:0}, radians) ? 1 : -1;
    const parts = lightweight ? busLod : [...busSolids, ...busDetails];
    const paint = (list) => list.sort((a,b)=>compareItems(a,b,radians))
      .map((item) => renderItem(item,radians,now,true)).join("");
    const onSide = (list, s) => list.filter((item) => (item.busSide|0) === s);
    const doorGroup = (s, dir) => {
      const doors = onSide(busDoors, s).filter((_, i) => i % 2 === (dir < 0 ? 0 : 1));
      if (!doors.length) return "";
      return `<g class="bus-door bus-door--${dir < 0 ? "left" : "right"}" style="${delay};--car-duration:${BUS_SECONDS}s">${paint(doors)}</g>`;
    };
    const side = (s) => paint(onSide(parts, s)) + (lightweight ? "" : doorGroup(s,-1) + doorGroup(s,1));
    const body = side(-near) + paint(onSide(parts, 0)) + side(near);
    const ground = paint(onSide(busGround, 0));

    const t = phase / BUS_SECONDS;
    const worldX = t < BUS_ARRIVE ? fromX + (stopX-fromX) * (t/BUS_ARRIVE)
                 : t < BUS_LEAVE  ? stopX
                 : stopX + (toX-stopX) * ((t-BUS_LEAVE)/(1-BUS_LEAVE));

    const cue = lightweight ? ""
      : `<ellipse class="bus-stop-cue" style="${delay};--car-duration:${BUS_SECONDS}s" cx="0" cy="14" rx="31" ry="7" fill="#E8D9A8" opacity="0"/>`;
    const html = `<g class="moving-car bus-run" clip-path="url(#road-volume-clip)"`
      + ` style="--car-start-x:${sx};--car-start-y:${sy};--bus-stop-x:${mx};--bus-stop-y:${my};`
      + `--car-end-x:${ex};--car-end-y:${ey};--car-duration:${BUS_SECONDS}s;${delay}">`
      + `${ground}${body}${cue}</g>`;
    return { html, depth: laneDepth(worldX, .9, radians) };
  }

  function renderTraffic(radians, now) {
    if (!liveAt({ layer: 0, goneAt: 5 })) return null;
    const ground=carGround.map((item)=>renderItem(item,radians,now)).join("");
    const car=sortedVisible([...carSolids,...carDetails],radians).map((item)=>renderItem(item,radians,now)).join("");
    const centre=project(point(0,CAR_LANE_Y,.15),radians);
    const start=project(point(PIAZZA.x0-2.4,laneY(),.15),radians);
    const end=project(point(PIAZZA.x1+2.4,laneY(),.15),radians);
    const startX=(start.x-centre.x).toFixed(1),startY=(start.y-centre.y).toFixed(1);
    const endX=(end.x-centre.x).toFixed(1),endY=(end.y-centre.y).toFixed(1);
    const phase=((now-trafficEpoch)/1000)%CAR_DURATION_SECONDS;
    const worldX=(PIAZZA.x0-2.4)+((PIAZZA.x1+2.4)-(PIAZZA.x0-2.4))*(phase/CAR_DURATION_SECONDS);
    const html=`<g class="moving-car" style="--car-start-x:${startX}px;--car-start-y:${startY}px;--car-end-x:${endX}px;--car-end-y:${endY}px;--car-duration:${CAR_DURATION_SECONDS}s;animation-delay:-${phase.toFixed(3)}s">${ground}${car}</g>`;
    return { html, depth: laneDepth(worldX, .5, radians) };
  }

  let angle = DEFAULT_ANGLE;
  let raf = 0;
  let interactionFrameTimer = 0;
  let interactionIdleTimer = 0;
  let mobileInteracting = false;
  let lastInteractionRenderAt = 0;
  let restoreRequest = 0;
  let restoreRequestIsIdle = false;
  let restoreEffectsRaf = 0;
  let restorePending = false;
  let viewPreviewActive = false;
  let renderedView = {
    angle,
    viewTilt,
    zoom,
    panX,
    panY,
  };
  const MOBILE_FRAME_MS = 1000 / 30;
  const MOBILE_IDLE_MS = 180;

  function interactionLightweight() {
    return dragging || (mobileMode && mobileInteracting);
  }

  function renderSun(radians) {
    sun.removeAttribute("transform");
    const d = camera2d(SUN_WORLD, radians);
    const len = Math.hypot(d.x, d.y) || 1;
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


  const frameCost = onFrame ? [] : null;
  const diagnostics = {
    fullRenders: 0,
    lightweightRenders: 0,
    previewUpdates: 0,
    svgSwaps: 0,
    detailedFigurePartsTraversed: 0,
  };

  let buildLayer = -1;
  let buildEpoch = 0;
  let buildTimer = 0;
  let rendered = false;

  let unbuilding = null;
  let unbuildEpoch = 0;
  const BUILD_MS = 700;
  const UNBUILD_MS = 460;
  const buildDelay = (item) => ((item.obj ?? 0) * 170) + ((item.piece ?? 0) * 80);
  const building0 = (item, k) => k > 0 && k === buildLayer && !item.noBuild;
  const unbuildDelay = (item) => Math.max(0, (layerObjects.get(item.layer ?? 0) ?? 1) - 1 - (item.obj ?? 0)) * 55;

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

  const LIGHT_GROUND_CLASSES = new Set([
    "curb-line",
    "road-line",
    "drain-line",
    "threshold-line",
    "aiuola-line",
  ]);
  let renderTopology = null;

  function prepareSceneUnits(k, lightweight, greenReady) {
    const byFigure = new Map();
    const byObject = new Map();
    const activeSolids = solids.filter((item) => {
      if (!liveAt(item, k) || item.figureId) return false;
      if (item.revealGroup === "pergola-green" && !greenReady) return false;
      return lightweight ? !item.dragSkip : !item.dragOnly;
    });
    const sceneItems = lightweight
      ? activeSolids
      : activeSolids.concat(details.filter(
          (item) => liveAt(item, k) && !item.surfaceKey && !item.dragOnly,
        ));

    if (!lightweight) {
      for (const item of solids) {
        if (!item.figureId || !liveAt(item, k) || item.dragOnly) continue;
        let bucket = byFigure.get(item.figureId);
        if (!bucket) {
          bucket = [];
          byFigure.set(item.figureId, bucket);
        }
        bucket.push(item);
      }
    }

    for (const item of sceneItems) {
      const key = item.depthGroup
        ? `depth-${item.depthGroup}`
        : item.surfaceKey
          ? `surface-${item.surfaceKey}`
          : (item.objectUid || `single-${item.seq}`);
      let bucket = byObject.get(key);
      if (!bucket) {
        bucket = [];
        byObject.set(key, bucket);
      }
      bucket.push(item);
    }

    const units = [];
    if (lightweight) {
      for (const [id, life] of figureTopology) {
        if (!liveAt(life, k)) continue;
        units.push({
          figureId: id,
          centre: figureAnchors.get(id),
          seq: life.seq || 0,
        });
      }
    } else {
      for (const [id, parts] of byFigure) {
        units.push({
          figureId: id,
          parts,
          centre: figureAnchors.get(id),
          seq: parts[0]?.seq || 0,
        });
      }
    }
    for (const [id, parts] of byObject) {
      const points = parts.flatMap((item) => item.points);
      units.push({
        objectId: id,
        parts,
        centre: average(points),
        seq: parts[0]?.seq || 0,
      });
    }
    return units;
  }

  function prepareRenderTopology() {
    const activeByStep = Array.from({ length: RIFUGIO_STEP_COUNT }, (_, k) => {
      const activeGroundLines = groundLines.filter((item) => liveAt(item, k));
      const attachedDetails = new Map();
      for (const item of details) {
        if (!item.surfaceKey || !liveAt(item, k)) continue;
        let bucket = attachedDetails.get(item.surfaceKey);
        if (!bucket) {
          bucket = [];
          attachedDetails.set(item.surfaceKey, bucket);
        }
        bucket.push(item);
      }
      return {
        baseFaces: baseFaces.filter((item) => liveAt(item, k)),
        groundSurfaces: groundSurfaces.filter((item) => liveAt(item, k)),
        groundLines: activeGroundLines,
        lightGroundLines: activeGroundLines.filter(
          (item) => LIGHT_GROUND_CLASSES.has(item.className),
        ),
        heatFaces: heatFaces.filter((item) => liveAt(item, k)),
        contactFaces: contactFaces.filter((item) => liveAt(item, k)),
        shadows: shadows.filter((item) => liveAt(item, k)),
        heatAnchors: heatAnchors.filter((item) => liveAt(item, k)),
        attachedDetails,
      };
    });
    const fullByStep = Array.from({ length: RIFUGIO_STEP_COUNT }, (_, k) => [
      prepareSceneUnits(k, false, false),
      prepareSceneUnits(k, false, true),
    ]);
    const lightweightByStep = Array.from({ length: RIFUGIO_STEP_COUNT }, (_, k) => [
      prepareSceneUnits(k, true, false),
      prepareSceneUnits(k, true, true),
    ]);
    renderTopology = { activeByStep, fullByStep, lightweightByStep };
  }

  function render() {
    raf = 0;
    const now = performance.now();
    const lightweight = interactionLightweight();
    if (lightweight) diagnostics.lightweightRenders += 1;
    else diagnostics.fullRenders += 1;
    if (mobileMode && mobileInteracting) lastInteractionRenderAt = now;
    const radians = angle * Math.PI / 180;
    computeFit(radians);
    updateRoadVolumeClip(radians);
    renderSun(radians);
    const activeSet = renderTopology.activeByStep[renderStep];
    const background = sortedVisible(activeSet.baseFaces,radians)
      .map((item) => renderItem(item,radians,now)).join("");
    const materials = activeSet.groundSurfaces
      .map((item) => renderItem(item,radians,now)).join("");
    const pavingItems = lightweight ? activeSet.lightGroundLines : activeSet.groundLines;
    const paving = pavingItems.map((item) => renderItem(item,radians,now)).join("");
    const heatFloor = activeSet.heatFaces
      .map((item) => renderItem(item,radians,now)).join("");
    const shade = lightweight ? "" : renderShadows(radians, activeSet.shadows);
    const contacts = lightweight ? "" : sortedVisible(activeSet.contactFaces,radians)
      .map((item) => renderItem(item,radians,now)).join("");
    const traffic = renderTraffic(radians, now);
    const busOverlay = renderBus(radians, now, lightweight);

    const greenState = pergolaGreenReady ? 1 : 0;
    const cachedUnits = lightweight
      ? renderTopology.lightweightByStep[renderStep][greenState]
      : renderTopology.fullByStep[renderStep][greenState];
    const units = cachedUnits.map((unit) => ({
      ...unit,
      depth: depthOfPoint(unit.centre, radians),
    }));
    for (const vehicle of [traffic, busOverlay]) {
      if (vehicle) units.push({ html: vehicle.html, depth: vehicle.depth, seq: Number.MAX_SAFE_INTEGER });
    }
    // Quantized depth plus sequence order keeps coplanar painter ordering stable.
    units.sort((a,b) => {
      const d = Math.round((a.depth-b.depth)*10000)/10000;
      return Math.abs(d)<.0002 ? a.seq-b.seq : d;
    });

    const renderSurfacePart = (item, quiet = false) => {
      const surface = renderItem(item,radians,now,false,quiet);
      if (!surface || !item.surfaceKey) return surface;
      const openings = lightweight ? "" : (activeSet.attachedDetails.get(item.surfaceKey) || [])
        .sort((a,b) => compareItems(a,b,radians))
        .map((detail) => renderItem(detail,radians,now,true,quiet))
        .join("");
      return `<g data-surface="${item.surfaceKey}">${surface}${openings}</g>`;
    };

    const scene = units.map((unit) => {
      if (unit.html != null) return unit.html;
      if (unit.figureId) {
        if (lightweight) return renderFigureLOD(unit.figureId,radians);
        diagnostics.detailedFigurePartsTraversed += unit.parts.length;
        const inner = [...unit.parts]
          .sort((a,b) => compareItems(a,b,radians))
          .map((part) => renderItem(part,radians,now))
          .join("");
        if (!inner) return "";
        const life = CAST_LIFE[unit.figureId] || CAST_LIFE.default;
        const a = figureAnchors.get(unit.figureId);
        const foot = project(point(a.x, a.y, 0), radians);
        const fx = foot.x.toFixed(1), fy = foot.y.toFixed(1);
        const arrivalAt = buildLayer === unit.parts[0]?.layer
          ? buildDelay(unit.parts[0]) - (now - buildEpoch)
          : null;
        const arriving = arrivalAt != null && arrivalAt + 820 > 0
          ? ` class="cast-arrival" style="animation-delay:${arrivalAt.toFixed(0)}ms"`
          : "";
        return `<g${arriving} transform="translate(${fx} ${fy}) scale(${CAST_SCALE}) translate(${-foot.x.toFixed(1)} ${-foot.y.toFixed(1)})">`
          + `<g class="cast-alive" data-figure="${unit.figureId}" style="transform-origin:${fx}px ${fy}px;--idle-dur:${life.dur}s;`
          + `animation-delay:-${phaseOf(now, life.dur, life.offset)}s;--idle-lift:${life.lift}">${inner}</g></g>`;
      }
      if (unit.objectId != null) {
        const ordered = [...unit.parts].sort((a,b) => compareItems(a,b,radians));
        const regularParts=ordered.filter((item)=>!item.revealGroup);
        const revealParts=ordered.filter((item)=>item.revealGroup);
        const anim = unitAnimation(regularParts, now);
        const quiet = anim != null;
        let regular=regularParts.map((item)=>renderSurfacePart(item,quiet)).join("");
        if (!regular && regularParts.length) regular=regularParts.map((item)=>renderItem(item,radians,now,true,quiet)).join("");
        let revealed="";
        if(revealParts.length){
          let green=revealParts.map(renderSurfacePart).join("");
          if(!green) green=revealParts.map((item)=>renderItem(item,radians,now,true)).join("");
          const revealAt = pergolaGreenAnimating && revealParts[0].revealGroup === "pergola-green"
            ? (revealParts[0].revealDelay || 220) - (now - pergolaGreenEpoch)
            : null;
          const cls = revealAt != null && revealAt + 460 > 0 ? "reveal-after-build" : "";
          const style = cls ? ` style="animation-delay:${revealAt.toFixed(0)}ms"` : "";
          revealed=`<g class="${cls}"${style} data-reveal-group="${revealParts[0].revealGroup}">${green}</g>`;
        }
        const grow = anim ? ` class="${anim.cls}" style="animation-delay:${anim.at.toFixed(0)}ms"` : "";
        if (anim && revealed) {
          return `<g data-object="${unit.objectId}"><g${grow}>${regular}</g>${revealed}</g>`;
        }
        return `<g data-object="${unit.objectId}"${grow}>${regular}${revealed}</g>`;
      }
      return "";
    }).join("");

    const w = fit.scale * .30;
    const h = fit.scale * .46;
    const heat = lightweight ? "" : activeSet.heatAnchors.map((a, i) => {
      const q = project(a.p,radians);
      return `<path class="heat-line" style="animation-delay:-${phaseOf(now, HEAT_DUR, i * 1.2)}s"`
        + ` d="M${q.x.toFixed(1)} ${q.y.toFixed(1)} q${(-w).toFixed(1)} ${(-h).toFixed(1)} 0 ${(-h*2).toFixed(1)} q${w.toFixed(1)} ${(-h).toFixed(1)} 0 ${(-h*2).toFixed(1)}"`
        + ` stroke-width="${Math.max(1.4, fit.scale*.075).toFixed(2)}"/>`;
    }).join("");

    const nextFrame = background + materials + paving + heatFloor + shade + contacts + scene + heat;
    // Swap complete buffers so a partially rebuilt model is never painted.
    hiddenModelBuffer.removeAttribute("transform");
    hiddenModelBuffer.innerHTML = nextFrame;
    hiddenModelBuffer.setAttribute("visibility", "visible");
    visibleModelBuffer.setAttribute("visibility", "hidden");
    visibleModelBuffer.innerHTML = "";
    visibleModelBuffer.removeAttribute("transform");
    const previousBuffer = visibleModelBuffer;
    visibleModelBuffer = hiddenModelBuffer;
    hiddenModelBuffer = previousBuffer;
    diagnostics.svgSwaps += 1;
    renderedView = { angle, viewTilt, zoom, panX, panY };
    viewPreviewActive = false;

    rendered = true;
    if (onFrame) {
      frameCost.push(performance.now() - now);
      if (frameCost.length > 30) frameCost.shift();
      const sortedCost = [...frameCost].sort((a, b) => a - b);
      onFrame({
        angle: Math.round((angle % 360 + 360) % 360),
        tilt: Math.round(viewTilt),
        zoom,
        ms: sortedCost[sortedCost.length >> 1],
      });
    }
    if (mobileMode && restorePending && !lightweight && !mobileInteracting) {
      if (restoreRequest) {
        if (restoreRequestIsIdle) window.cancelIdleCallback?.(restoreRequest);
        else cancelAnimationFrame(restoreRequest);
        restoreRequest = 0;
      }
      if (restoreEffectsRaf) cancelAnimationFrame(restoreEffectsRaf);
      restoreEffectsRaf = requestAnimationFrame(() => {
        restoreEffectsRaf = 0;
        if (mobileInteracting) return;
        shell.classList.remove("is-mobile-interacting");
        restorePending = false;
      });
    }

  }

  function queueRenderFrame() {
    if (!raf) raf = requestAnimationFrame(render);
  }

  function scheduleRender(force = false) {
    if (mobileMode && mobileInteracting && !force) {
      const remaining = MOBILE_FRAME_MS -
        (performance.now() - lastInteractionRenderAt);
      if (remaining > 1) {
        if (!interactionFrameTimer) {
          interactionFrameTimer = later(() => {
            interactionFrameTimer = 0;
            queueRenderFrame();
          }, remaining);
        }
        return;
      }
    }
    queueRenderFrame();
  }

  function turn(delta) {
    angle += delta;
    scheduleRender();
  }

  function clampPan() {
    const maxX = FRAME.w * (zoom - 1) / 2;
    const maxY = FRAME.h * (zoom - 1) / 2;
    panX = Math.max(-maxX, Math.min(maxX, panX));
    panY = Math.max(-maxY, Math.min(maxY, panY));
  }

  function notifyViewZoom(silent = false) {
    shell.dataset.zoom = zoom > 1.02 ? "in" : "out";
    if (silent || !onZoom) return;
    const nextBand = zoom <= 1.02 ? 0 : zoom >= 2.38 ? 2 : 1;
    if (!mobileMode || nextBand !== notifiedZoomBand) {
      notifiedZoomBand = nextBand;
      onZoom(zoom);
    }
  }

  function applyViewPreview() {
    if (!mobileMode || !rendered) return;
    const scale = zoom / renderedView.zoom;
    const frameCx = FRAME.x + FRAME.w / 2;
    const frameCy = FRAME.y + FRAME.h / 2;
    const tx = frameCx + panX - scale * (frameCx + renderedView.panX);
    const ty = frameCy + panY - scale * (frameCy + renderedView.panY);
    visibleModelBuffer.setAttribute(
      "transform",
      `matrix(${scale} 0 0 ${scale} ${tx} ${ty})`,
    );
    sun.setAttribute(
      "transform",
      `matrix(${scale} 0 0 ${scale} ${(SUN_SCREEN.x * (1 - scale)).toFixed(4)} ${(SUN_SCREEN.y * (1 - scale)).toFixed(4)})`,
    );
    viewPreviewActive = true;
    diagnostics.previewUpdates += 1;
  }

  function setViewTransform(next, { preview = false, silent = false } = {}) {
    const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next.zoom ?? zoom));
    const nextPanX = next.panX ?? panX;
    const nextPanY = next.panY ?? panY;
    const changed = Math.abs(nextZoom - zoom) >= .001
      || Math.abs(nextPanX - panX) >= .001
      || Math.abs(nextPanY - panY) >= .001;
    if (!changed) return;
    zoom = nextZoom;
    panX = nextPanX;
    panY = nextPanY;
    clampPan();
    notifyViewZoom(silent);
    if (preview && mobileMode) applyViewPreview();
    else scheduleRender();
  }

  function setZoom(next, at = null, silent = false) {
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next));
    if (Math.abs(clamped - zoom) < 0.001) return;
    const k = clamped / zoom;
    let nextPanX;
    let nextPanY;
    if (at) {
      nextPanX = (at.x - (FRAME.x + FRAME.w / 2)) * (1 - k) + k * panX;
      nextPanY = (at.y - (FRAME.y + FRAME.h / 2)) * (1 - k) + k * panY;
    } else {
      nextPanX = panX * k;
      nextPanY = panY * k;
    }
    setViewTransform({ zoom: clamped, panX: nextPanX, panY: nextPanY }, { silent });
  }

  function zoomBy(factor, at = null) {
    setZoom(zoom * factor, at);
  }

  function panBy(dx, dy) {
    if (zoom <= 1.001) return;
    setViewTransform({ zoom, panX: panX + dx, panY: panY + dy });
  }

  function resetView() {
    angle = DEFAULT_ANGLE;
    viewTilt = DEFAULT_TILT;
    panX = 0;
    panY = 0;
    setZoom(DEFAULT_ZOOM);
    scheduleRender();
  }

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
  let gestureBox = null;
  const pointers = new Map();
  let pinchStart = 0;
  let pinchZoomStart = 1;
  let pinchCentre = null;
  let pinchPanStart = { x: 0, y: 0 };
  let pinchAnchor = null;

  const cancelRestoreRequest = () => {
    if (restoreRequest) {
      if (restoreRequestIsIdle) window.cancelIdleCallback?.(restoreRequest);
      else cancelAnimationFrame(restoreRequest);
      restoreRequest = 0;
    }
    if (restoreEffectsRaf) {
      cancelAnimationFrame(restoreEffectsRaf);
      restoreEffectsRaf = 0;
    }
  };

  const beginMobileInteraction = () => {
    if (!mobileMode) return;
    if (interactionIdleTimer) {
      clearTimeout(interactionIdleTimer);
      interactionIdleTimer = 0;
    }
    cancelRestoreRequest();
    restorePending = false;
    mobileInteracting = true;
    shell.classList.add("is-mobile-interacting");
  };

  const finishMobileInteractionSoon = () => {
    if (!mobileMode) return;
    if (interactionIdleTimer) clearTimeout(interactionIdleTimer);
    interactionIdleTimer = later(() => {
      interactionIdleTimer = 0;
      mobileInteracting = false;
      restorePending = true;
      if (interactionFrameTimer) {
        clearTimeout(interactionFrameTimer);
        interactionFrameTimer = 0;
      }
      const restore = () => {
        restoreRequest = 0;
        scheduleRender(true);
      };
      if (typeof window.requestIdleCallback === "function") {
        restoreRequestIsIdle = true;
        restoreRequest = window.requestIdleCallback(restore, { timeout: 80 });
      } else {
        restoreRequestIsIdle = false;
        restoreRequest = requestAnimationFrame(restore);
      }
    }, MOBILE_IDLE_MS);
  };

  const stopDragging = () => {
    if (!dragging) return;
    dragging = false;
    shell.classList.remove("is-dragging");
    if (!mobileMode) scheduleRender();
  };

  const twoFingers = () => {
    const [a, b] = [...pointers.values()];
    return {
      distance: Math.hypot(a.x - b.x, a.y - b.y),
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
    };
  };

  const wantsPan = (event) => zoom > 1.001 && (event.shiftKey || event.button === 1);

  on(shell, "pointerdown", (event) => {
    beginMobileInteraction();
    if (mobileMode) gestureBox = shell.getBoundingClientRect();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    // Capture every active pointer. Without capturing the second touch, a
    // pinch that strays outside the SVG can miss its release and leave the
    // gesture map stuck until the next interaction.
    shell.setPointerCapture?.(event.pointerId);
    if (pointers.size === 2) {
      stopDragging();
      const two = twoFingers();
      pinchStart = two.distance;
      pinchZoomStart = zoom;
      pinchCentre = { x: two.x, y: two.y };
      pinchPanStart = { x: panX, y: panY };
      const box = mobileMode && gestureBox
        ? gestureBox
        : shell.getBoundingClientRect();
      pinchAnchor = {
        x: (two.x - box.left) / box.width * 960,
        y: (two.y - box.top) / box.height * 660,
      };
      return;
    }
    if (pointers.size > 2) return;
    dragging = true;
    panning = wantsPan(event);
    shell.classList.add("is-dragging");
    lastX = event.clientX;
    lastY = event.clientY;
  });

  on(shell, "pointermove", (event) => {
    if (pointers.has(event.pointerId)) {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
    if (pointers.size === 2 && pinchStart > 0) {
      event.preventDefault();
      const two = twoFingers();
      const box = mobileMode && gestureBox
        ? gestureBox
        : shell.getBoundingClientRect();
      if (mobileMode) {
        const targetZoom = Math.max(
          MIN_ZOOM,
          Math.min(MAX_ZOOM, pinchZoomStart * (two.distance / pinchStart)),
        );
        const scale = targetZoom / pinchZoomStart;
        const currentCentre = {
          x: (two.x - box.left) / box.width * 960,
          y: (two.y - box.top) / box.height * 660,
        };
        const frameCx = FRAME.x + FRAME.w / 2;
        const frameCy = FRAME.y + FRAME.h / 2;
        setViewTransform({
          zoom: targetZoom,
          panX: (pinchAnchor.x - frameCx) * (1 - scale)
            + scale * pinchPanStart.x
            + currentCentre.x - pinchAnchor.x,
          panY: (pinchAnchor.y - frameCy) * (1 - scale)
            + scale * pinchPanStart.y
            + currentCentre.y - pinchAnchor.y,
        }, { preview: true });
        return;
      }
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
    const box = mobileMode && gestureBox
      ? gestureBox
      : shell.getBoundingClientRect();
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    if (panning) {
      const viewDx = dx / box.width * 960;
      const viewDy = dy / box.height * 660;
      if (mobileMode) {
        setViewTransform({
          zoom,
          panX: panX + viewDx,
          panY: panY + viewDy,
        }, { preview: true });
      } else {
        panBy(viewDx, viewDy);
      }
      return;
    }
    angle -= dx * .42;
    viewTilt = Math.max(MIN_TILT,Math.min(MAX_TILT,viewTilt+dy*.22));
    scheduleRender();
  });

  const releasePointer = (event) => {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) {
      pinchStart = 0;
      pinchCentre = null;
      pinchAnchor = null;
    }
    if (shell.hasPointerCapture?.(event.pointerId)) shell.releasePointerCapture(event.pointerId);
    if (pointers.size === 0) {
      panning = false;
      stopDragging();
      gestureBox = null;
      finishMobileInteractionSoon();
    }
  };
  on(shell, "pointerup", releasePointer);
  on(shell, "pointercancel", releasePointer);
  on(shell, "lostpointercapture", (event) => {
    if (pointers.has(event.pointerId)) releasePointer(event);
  });

  on(shell, "dblclick", (event) => {
    event.preventDefault();
    beginMobileInteraction();
    if (zoom >= MAX_ZOOM - 0.01) resetView();
    else setZoom(zoom * 1.5, toViewBox(event));
    finishMobileInteractionSoon();
  });

  // `passive: false` is required for Ctrl+wheel to zoom the model instead of the page.
  on(shell, "wheel", (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    beginMobileInteraction();
    setZoom(zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12), toViewBox(event));
    finishMobileInteractionSoon();
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

  function setStep(next) {
    const target = Math.max(0, Math.min(RIFUGIO_STEP_COUNT - 1, next));
    const previous = step;
    if (target === step && rendered) return;

    clearTimeout(unbuildTimer);
    unbuilding = null;

    if (!rendered) {
      step = target;
      renderStep = target;
      pergolaGreenReady = target >= 2;
      shell.dataset.step = String(step);
      scheduleRender();
      return;
    }

    if (target > step) {
      buildLayer = target;
      buildEpoch = performance.now();
      renderStep = target;
      clearTimeout(buildTimer);
      buildTimer = later(() => {
        buildLayer = -1;
        scheduleRender();
      }, (layerBuildMs.get(target) ?? BUILD_MS) + 80);
    } else if (target < step) {
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
  prepareRenderTopology();
  setStep(0);

  return {
    setStep,
    turn,
    zoomBy,
    setZoom,
    setViewTransform,
    panBy,
    resetView,
    get zoom() {
      return zoom;
    },
    get diagnostics() {
      return {
        ...diagnostics,
        previewActive: viewPreviewActive,
        quality: interactionLightweight() ? "lightweight" : "full",
        zoom,
        panX,
        panY,
      };
    },
    refresh: scheduleRender,
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      cancelRestoreRequest();
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
      bindings.forEach((off) => off());
      bindings.length = 0;
      svg.innerHTML = "";
    },
  };
}

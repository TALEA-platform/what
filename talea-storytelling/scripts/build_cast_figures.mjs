// Cuoce le PERSONE del plastico (src/lib/castFigures.js) in disegni statici per i
// tre primi piani di «dove manca, si costruisce». Emette `scripts/cast_figures.json`,
// che `build_plan_vignettes.py` legge al posto della vecchia figurina di scatole.
//
//     node scripts/build_cast_figures.mjs
//
// ── Perche' cuocere ─────────────────────────────────────────────────────────
// Nel plastico le persone si ruotano, quindi vanno riproiettate a ogni
// fotogramma e ogni faccia deve esserci — anche quelle che adesso non si vedono,
// perche' fra mezzo grado si vedranno. Nelle vignette il modello e' FERMO: la
// proiezione e' una sola, l'assonometria e' quella del disegno, e tutto cio' che
// resta dietro non tornera' mai utile. Da qui le tre potature, in quest'ordine:
//
//  1. BACK-FACE: via le facce che danno le spalle a chi guarda (~45%).
//  2. OCCLUSIONE: si dipinge la figura in un buffer di indici e si tengono
//     soltanto le facce che alla fine possiedono almeno un campione. E' la
//     potatura che vale di piu' — dentro un corpo chiuso quasi nulla si vede —
//     ed e' esatta a meno della risoluzione del buffer (4 campioni per unita',
//     cioe' circa un quinto di pixel sullo schermo).
//  3. FUSIONE: le facce contigue dello stesso tono diventano un solo <path> con
//     piu' sottotracciati. I toni vengono quantizzati prima, perche' la
//     variazione fra faccetta e faccetta e' del 3% e a quella distanza non si
//     legge — ma decide se due facce si fondono o no.
//
// Il TRATTO (`.pv-l`, quello che corre quando la battuta arriva) non puo' essere
// il contorno di ogni faccia: sarebbe una ragnatela. E' la SAGOMA, ricavata dal
// medesimo buffer con un inseguimento di bordo, ammorbidita e semplificata. E' lo
// stesso criterio dell'albero della vignetta, che si inchiostra col profilo della
// chioma e non con le sue nove foglie.
//
// ── La scala ────────────────────────────────────────────────────────────────
// Il cast del plastico e' disegnato un po' sopra la scala vera (e' il trucco
// dell'illustratore, non un errore). Le vignette hanno invece un loro righello —
// una persona alta 1,72, da cui si leggono finestre, panchine e portici — e va
// rispettato quello, o le case si rimpiccioliscono attorno alla gente. Quindi si
// misura l'adulto, lo si porta a 1,72 e lo STESSO fattore vale per tutti: il
// bambino resta un bambino.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CAST_FIGURES, createCastFigures } from "../src/lib/castFigures.js";

const here = path.dirname(fileURLToPath(import.meta.url));

// ── L'assonometria delle vignette ───────────────────────────────────────────
// Identica a `iso()` in `build_plan_vignettes.py`: se cambia una, cambia l'altra.
const U = 46.0;
const C30 = Math.cos(Math.PI / 6);
const S30 = Math.sin(Math.PI / 6);
const INK = "#3A352A";

// Quanto vale un adulto sul righello del disegno.
const ADULT_HEIGHT = 1.72;

// L'asse frontale approvato nel plastico (`PERSON_YAW`) piu' i 5 gradi
// dell'inquadratura iniziale: e' l'orientamento con cui il cast e' stato
// disegnato e guardato, quindi e' quello che si porta qui dentro.
const BASE_YAW = Math.PI / 4 - (316 * Math.PI) / 180 + (5 * Math.PI) / 180;
// Un secondo verso, per chi cammina lungo la strada invece di stare nella piazza.
const ALONG_X = BASE_YAW - Math.PI / 2;

// Meno faccette: a ottanta pixel d'altezza e da fermi, i meridiani di una testa
// sono piu' di quanti se ne possano distinguere.
const DETAIL = 0.7;

// Campioni per unita' SVG nel buffer di occlusione e nel contorno.
const RES = 4;

// Di quanto si arrotondano i toni prima di fondere le facce (per canale, su 255).
const TONE_STEP = 5;

// I personaggi da cuocere, e con quale verso. Ogni coppia (chi, verso) e' una
// geometria a se': se ne aggiungono poche, e solo quando servono davvero.
const RECIPES = [
  { name: "elder", figure: "elder", yaw: BASE_YAW },
  { name: "adult", figure: "adult", yaw: BASE_YAW },
  { name: "adultWalking", figure: "adult", yaw: ALONG_X },
  { name: "child", figure: "child", yaw: BASE_YAW },
  { name: "pregnant", figure: "pregnant", yaw: BASE_YAW },
  { name: "wheelchair", figure: "wheelchair", yaw: BASE_YAW },
];

// ════ GEOMETRIA ═════════════════════════════════════════════════════════════

/** Costruisce una figura e restituisce le sue facce, in metri, attorno a (0,0). */
function buildFigure(figureName, yaw) {
  const faces = [];
  const kit = createCastFigures({
    addFace: (target, points, fill, normal, options = {}) => {
      target.push({ points, fill, normal, ...options });
    },
    solids: faces,
    // L'ombra di contatto del plastico non serve: nelle vignette l'ombra la
    // butta la luce del disegno, come per gli alberi e le panchine.
    contactFaces: [],
    ink: INK,
    personYaw: yaw,
    figureOptions: () => ({}),
    benchSeatZ: () => 0.45,
    detail: DETAIL,
  });
  kit[CAST_FIGURES[figureName].build](0, 0, yaw);
  return faces;
}

/** Porta i piedi a quota zero e riscala il corpo sul righello del disegno.
 *  Nel plastico il piano di calpestio sta a 0,24 (e' lo spessore del
 *  lastricato): qui il suolo e' a zero, quindi la gente va posata. */
function groundAndScale(faces, scale) {
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const face of faces) {
    for (const p of face.points) {
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    }
  }
  for (const face of faces) {
    face.points = face.points.map((p) => ({
      x: p.x * scale,
      y: p.y * scale,
      z: (p.z - minZ) * scale,
    }));
  }
  return (maxZ - minZ) * scale;
}

const iso = (p) => ({
  x: (p.x - p.y) * C30 * U,
  y: ((p.x + p.y) * S30 - p.z) * U,
});

// In questa assonometria l'occhio sta lungo (1,1,1): una faccia si vede se la
// sua normale ha una componente positiva in quella direzione. La tolleranza
// negativa tiene le facce quasi di taglio, che sono quelle che cuciono la
// silhouette: toglierle aprirebbe fessure sul profilo.
const facing = (n) => (n.x + n.y + n.z) / Math.sqrt(3);
const depthOf = (points) => {
  let s = 0;
  for (const p of points) s += p.x + p.y + p.z;
  return s / points.length;
};

// ════ RASTER: occlusione e sagoma ═══════════════════════════════════════════

/** Riempie un poligono in un buffer di indici, con la regola pari-dispari. */
function rasterize(buffer, width, height, poly, value) {
  let top = Infinity;
  let bottom = -Infinity;
  for (const [, py] of poly) {
    top = Math.min(top, py);
    bottom = Math.max(bottom, py);
  }
  const y0 = Math.max(0, Math.ceil(top - 0.5));
  const y1 = Math.min(height - 1, Math.floor(bottom - 0.5));
  const xs = [];
  for (let row = y0; row <= y1; row++) {
    const sy = row + 0.5;
    xs.length = 0;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [ax, ay] = poly[j];
      const [bx, by] = poly[i];
      if ((ay > sy) === (by > sy)) continue;
      xs.push(ax + ((sy - ay) / (by - ay)) * (bx - ax));
    }
    if (xs.length < 2) continue;
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const from = Math.max(0, Math.ceil(xs[k] - 0.5));
      const to = Math.min(width - 1, Math.floor(xs[k + 1] - 0.5));
      const base = row * width;
      for (let col = from; col <= to; col++) buffer[base + col] = value;
    }
  }
}

/** Insegue il bordo della maschera e ne restituisce gli anelli, in celle. */
function traceContours(mask, width, height) {
  const at = (i, j) => (i < 0 || j < 0 || i >= width || j >= height ? 0 : mask[j * width + i]);
  const edges = new Map();
  const key = (x, y) => `${x},${y}`;
  const push = (ax, ay, bx, by) => {
    const k = key(ax, ay);
    if (!edges.has(k)) edges.set(k, []);
    edges.get(k).push([bx, by]);
  };
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      if (!at(i, j)) continue;
      // Il giro di ogni cella e' sempre nello stesso verso: cosi' gli anelli
      // esterni e i buchi escono con orientamenti opposti senza doverli
      // riconoscere, ed e' quello che serve alla regola di riempimento.
      if (!at(i - 1, j)) push(i, j + 1, i, j);
      if (!at(i, j - 1)) push(i, j, i + 1, j);
      if (!at(i + 1, j)) push(i + 1, j, i + 1, j + 1);
      if (!at(i, j + 1)) push(i + 1, j + 1, i, j + 1);
    }
  }
  const rings = [];
  for (const [start, list] of edges) {
    while (list.length) {
      const ring = [start.split(",").map(Number)];
      let current = start;
      let next = edges.get(current)?.pop();
      while (next) {
        ring.push(next);
        current = key(next[0], next[1]);
        const outgoing = edges.get(current);
        if (!outgoing || !outgoing.length) break;
        next = outgoing.pop();
        if (key(next[0], next[1]) === start && outgoing.length === 0) {
          ring.push(next);
          break;
        }
      }
      if (ring.length > 4) rings.push(ring);
    }
  }
  return rings;
}

const ringArea = (ring) => {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return Math.abs(a) / 2;
};

/** Chaikin: smussa la scaletta del raster senza inventare dettaglio. */
function chaikin(ring) {
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    const [ax, ay] = ring[i];
    const [bx, by] = ring[(i + 1) % ring.length];
    out.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25]);
    out.push([ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
  }
  return out;
}

/** Douglas–Peucker su un anello chiuso. */
function simplify(ring, eps) {
  const keep = new Array(ring.length).fill(false);
  keep[0] = true;
  const last = ring.length - 1;
  keep[last] = true;
  const stack = [[0, last]];
  while (stack.length) {
    const [from, to] = stack.pop();
    let worst = -1;
    let index = -1;
    const [ax, ay] = ring[from];
    const [bx, by] = ring[to];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    for (let i = from + 1; i < to; i++) {
      const d = Math.abs((ring[i][0] - ax) * dy - (ring[i][1] - ay) * dx) / len;
      if (d > worst) {
        worst = d;
        index = i;
      }
    }
    if (worst > eps && index > 0) {
      keep[index] = true;
      stack.push([from, index], [index, to]);
    }
  }
  return ring.filter((_, i) => keep[i]);
}

// ════ USCITA ════════════════════════════════════════════════════════════════

// ── Il tracciato va scritto CORTO ───────────────────────────────────────────
// Ogni vignetta si porta dentro la propria gente: una figura scritta per esteso
// («M-12.3 -45.6L-11.9 -44.2…») costa una dozzina di caratteri a vertice, e
// dodici persone in tre disegni diventano un file da scaricare. In coordinate
// RELATIVE gli scarti sono numeri di una o due cifre, e la stessa figura pesa
// poco piu' della meta'. Il punto corrente viene ricalcolato dai valori GIA'
// arrotondati: con gli scarti tondi ma la posizione esatta, l'errore si somma
// vertice dopo vertice e alla fine il piede non torna sotto la testa.
const n = (v) => {
  let s = v.toFixed(1);
  if (s.endsWith(".0")) s = s.slice(0, -2);
  if (s.startsWith("0.")) s = s.slice(1);
  else if (s.startsWith("-0.")) s = `-${s.slice(2)}`;
  return s === "-0" ? "0" : s;
};

/** Due numeri di seguito: lo spazio serve solo se il secondo non ha il segno. */
const pair = (a, b) => {
  const sa = n(a);
  const sb = n(b);
  return sb.startsWith("-") ? sa + sb : `${sa} ${sb}`;
};

/** Aggiunge un poligono al tracciato, in relativo, e riporta il punto corrente. */
function appendPoly(parts, points, at) {
  const first = points[0];
  parts.push(at ? `m${pair(first[0] - at[0], first[1] - at[1])}`
                : `M${pair(first[0], first[1])}`);
  let cx = at ? at[0] + Number(n(first[0] - at[0])) : Number(n(first[0]));
  let cy = at ? at[1] + Number(n(first[1] - at[1])) : Number(n(first[1]));
  const start = [cx, cy];
  const steps = [];
  for (let i = 1; i < points.length; i++) {
    const dx = Number(n(points[i][0] - cx));
    const dy = Number(n(points[i][1] - cy));
    if (dx === 0 && dy === 0) continue;
    steps.push(pair(dx, dy));
    cx += dx;
    cy += dy;
  }
  if (steps.length) parts.push("l" + steps.join(" ").replace(/ -/g, "-"));
  parts.push("z");
  // Dopo `z` il punto corrente torna all'inizio del sottotracciato.
  return start;
}

const quantize = (hex) => {
  const v = parseInt(hex.slice(1), 16);
  const ch = (shift) => {
    const c = (v >> shift) & 255;
    return Math.min(255, Math.round(c / TONE_STEP) * TONE_STEP)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${ch(16)}${ch(8)}${ch(0)}`;
};

/** Verso concorde per tutti i sottotracciati: fondendo piu' facce in un solo
 *  `<path>`, due contorni di verso opposto si bucherebbero a vicenda. */
function orient(points) {
  let a = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    a += points[j][0] * points[i][1] - points[i][0] * points[j][1];
  }
  return a < 0 ? points.slice().reverse() : points;
}

function bake(recipe, scale) {
  const faces = buildFigure(recipe.figure, recipe.yaw);
  const metres = groundAndScale(faces, scale);

  // 1 — back-face culling e ordine del pittore (dal fondo verso l'osservatore).
  //     Cadono anche le facce che in proiezione sono una scheggia: una
  //     tassellatura fitta ne produce sempre qualcuna, non si vedono, e in un
  //     disegno cotto pesano quanto una faccia vera.
  const kept = faces
    .filter((face) => facing(face.normal) > -0.03)
    .map((face) => {
      const poly = face.points.map((p) => {
        const q = iso(p);
        return [q.x, q.y];
      });
      let area = 0;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        area += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
      }
      return {
        fill: quantize(face.fill),
        poly,
        area: Math.abs(area) / 2,
        box: [
          Math.min(...poly.map((p) => p[0])), Math.min(...poly.map((p) => p[1])),
          Math.max(...poly.map((p) => p[0])), Math.max(...poly.map((p) => p[1])),
        ],
        depth: depthOf(face.points),
      };
    })
    .filter((face) => face.area > 0.12)
    .sort((a, b) => a.depth - b.depth);

  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const face of kept) {
    for (const [px, py] of face.poly) {
      x0 = Math.min(x0, px);
      y0 = Math.min(y0, py);
      x1 = Math.max(x1, px);
      y1 = Math.max(y1, py);
    }
  }

  // 2 — occlusione: si dipinge tutto e si tiene chi possiede ancora un campione.
  const width = Math.ceil((x1 - x0) * RES) + 2;
  const height = Math.ceil((y1 - y0) * RES) + 2;
  const buffer = new Int32Array(width * height).fill(-1);
  const toCells = (poly) =>
    poly.map(([px, py]) => [(px - x0) * RES + 1, (py - y0) * RES + 1]);
  kept.forEach((face, i) => rasterize(buffer, width, height, toCells(face.poly), i));
  const owns = new Uint8Array(kept.length);
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] >= 0) {
      owns[buffer[i]] = 1;
      mask[i] = 1;
    }
  }
  const visible = kept.filter((_, i) => owns[i]);

  // 3 — fusione. Due facce dello stesso tono possono finire nello stesso
  //     tracciato anche se nell'ordine del pittore non sono contigue: basta che
  //     nulla di quanto sta fra loro le SOVRAPPONGA, perche' solo in quel caso
  //     anticipare la seconda cambierebbe cio' che si vede. Il confronto e' fra
  //     rettangoli d'ingombro: si perde qualche fusione possibile e non se ne
  //     fa mai una sbagliata.
  const paths = [];
  const hits = (a, b) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
  const merge = (a, b) => [
    Math.min(a[0], b[0]), Math.min(a[1], b[1]),
    Math.max(a[2], b[2]), Math.max(a[3], b[3]),
  ];
  for (const face of visible) {
    const poly = orient(face.poly);
    let behind = null;
    let joined = false;
    for (let i = paths.length - 1; i >= 0; i--) {
      if (paths[i].fill === face.fill && (!behind || !hits(behind, face.box))) {
        paths[i].at = appendPoly(paths[i].parts, poly, paths[i].at);
        paths[i].box = merge(paths[i].box, face.box);
        joined = true;
        break;
      }
      behind = behind ? merge(behind, paths[i].box) : paths[i].box;
      if (hits(behind, face.box)) break;
    }
    if (!joined) {
      const parts = [];
      const at = appendPoly(parts, poly, null);
      paths.push({ fill: face.fill, parts, at, box: face.box });
    }
  }

  // Il TRATTO: la sagoma, dalla stessa maschera. Esce come elenco di vertici e
  // non come tracciato gia' scritto, perche' chi la usa deve poterla posare
  // dove vuole e `put()` vuole il tratto come un `d` solo.
  const ink = traceContours(mask, width, height)
    .filter((ring) => ringArea(ring) > 3 * RES * RES)
    .map((ring) => {
      const smooth = simplify(chaikin(chaikin(ring)), 0.34 * RES);
      return smooth.flatMap(([cx, cy]) => [
        Number(((cx - 1) / RES + x0).toFixed(1)),
        Number(((cy - 1) / RES + y0).toFixed(1)),
      ]);
    });

  return {
    figure: recipe.figure,
    paths: paths.map(({ fill, parts }) => ({ fill, d: parts.join("") })),
    ink,
    height: metres,
    box: [x0, y0, x1, y1].map((v) => Number(v.toFixed(1))),
    raw: faces.length,
    culled: kept.length,
    kept: visible.length,
  };
}

// ── L'adulto detta la scala di tutti ────────────────────────────────────────
const probe = buildFigure("adult", BASE_YAW);
let lowest = Infinity;
let highest = -Infinity;
for (const face of probe) {
  for (const p of face.points) {
    lowest = Math.min(lowest, p.z);
    highest = Math.max(highest, p.z);
  }
}
const SCALE = ADULT_HEIGHT / (highest - lowest);

const out = {};
console.log(`scala del cast: ${SCALE.toFixed(4)} (adulto ${ADULT_HEIGHT} m)`);
for (const recipe of RECIPES) {
  const baked = bake(recipe, SCALE);
  const metres = CAST_FIGURES[recipe.figure];
  // L'impronta a terra serve all'ombra portata del disegno, che e' la stessa
  // di alberi e panchine: quella della luce della vignetta, non quella del
  // plastico. Si prende dalla dichiarazione del cast e si riscala.
  out[recipe.name] = {
    paths: baked.paths,
    ink: baked.ink,
    box: baked.box,
    height: Number(baked.height.toFixed(3)),
    footprint: metres.footprint.map((v) => Number((v * SCALE).toFixed(3))),
  };
  const bytes = JSON.stringify(out[recipe.name]).length;
  console.log(
    `  ${recipe.name.padEnd(13)} ${String(baked.raw).padStart(4)} facce ->`
    + ` ${String(baked.culled).padStart(4)} viste ->`
    + ` ${String(baked.kept).padStart(4)} in vista ->`
    + ` ${String(baked.paths.length).padStart(3)} tracciati,`
    + ` alto ${out[recipe.name].height.toFixed(2)} m, ${(bytes / 1024).toFixed(1)} KB`,
  );
}

const target = path.join(here, "cast_figures.json");
fs.writeFileSync(target, JSON.stringify(out), "utf8");
console.log(`-> ${target} (${(fs.statSync(target).size / 1024).toFixed(1)} KB)`);

# -*- coding: utf-8 -*-
"""Generate deterministic CityPlan geometry; see DATA_SOURCES D17."""
import io
import math
import os
import random
import sys

W, H = 2400, 1500
BLEED = 300
S = 0.82
rnd = random.Random(20260803)

BEATS = 7
PROBE = "--probe" in sys.argv


def n(v):
    """Round drawing coordinates to reduce generated output size."""
    return f"{v:.0f}"


def dpath(pts, close=False):
    if not pts:
        return ""
    out = ["M", n(pts[0][0]), " ", n(pts[0][1])]
    for x, y in pts[1:]:
        out += ["L", n(x), " ", n(y)]
    if close:
        out.append("Z")
    return "".join(out)


def multi(polys, close=True):
    return "".join(dpath(p, close) for p in polys)


def circle_d(x, y, r):
    return (f"M{n(x - r)} {n(y)}a{n(r)} {n(r)} 0 1 0 {n(2 * r)} 0"
            f"a{n(r)} {n(r)} 0 1 0 {n(-2 * r)} 0Z")


def lerp2(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def dist(a, b):
    return math.hypot(b[0] - a[0], b[1] - a[1])


def jit(pts, a=1.0):
    return [(x + rnd.uniform(-a, a), y + rnd.uniform(-a, a)) for x, y in pts]


def move(pts, dx, dy):
    return [(x + dx, y + dy) for x, y in pts]


def centroid(poly):
    return (sum(p[0] for p in poly) / len(poly), sum(p[1] for p in poly) / len(poly))


def area(poly):
    m = len(poly)
    return abs(sum(poly[i][0] * poly[(i + 1) % m][1] - poly[(i + 1) % m][0] * poly[i][1]
                   for i in range(m))) / 2


def inset(poly, d):
    """Inset a convex polygon by moving each edge toward the centre."""
    c = centroid(poly)
    m = len(poly)
    lines = []
    for i in range(m):
        a, b = poly[i], poly[(i + 1) % m]
        tx, ty = b[0] - a[0], b[1] - a[1]
        L = math.hypot(tx, ty) or 1.0
        nx, ny = ty / L, -tx / L
        if (c[0] - a[0]) * nx + (c[1] - a[1]) * ny < 0:
            nx, ny = -nx, -ny
        lines.append(((a[0] + nx * d, a[1] + ny * d), (tx / L, ty / L)))
    out = []
    for i in range(m):
        p1, d1 = lines[i - 1]
        p2, d2 = lines[i]
        den = d1[0] * d2[1] - d1[1] * d2[0]
        if abs(den) < 1e-6:
            out.append(p2)
            continue
        t = ((p2[0] - p1[0]) * d2[1] - (p2[1] - p1[1]) * d2[0]) / den
        out.append((p1[0] + d1[0] * t, p1[1] + d1[1] * t))
    return out


def quad_at(q, u, v):
    return lerp2(lerp2(q[0], q[1], u), lerp2(q[3], q[2], u), v)


def quad_cell(q, u0, u1, v0, v1):
    return [quad_at(q, u0, v0), quad_at(q, u1, v0),
            quad_at(q, u1, v1), quad_at(q, u0, v1)]


def quad_ang(q, u=0.5, v=0.5):
    a = quad_at(q, max(0.0, u - 0.08), v)
    b = quad_at(q, min(1.0, u + 0.08), v)
    return math.atan2(b[1] - a[1], b[0] - a[0])


def oct_at(p, ang, length, width, cut=0.3):
    ca, sa = math.cos(ang), math.sin(ang)

    def P(u, v):
        return (p[0] + ca * u - sa * v, p[1] + sa * u + ca * v)

    a, b = length / 2, width / 2
    c = min(a, b) * cut
    return [P(-a + c, -b), P(a - c, -b), P(a, -b + c), P(a, b - c),
            P(a - c, b), P(-a + c, b), P(-a, b - c), P(-a, -b + c)]


def blob(cx, cy, r, lobes=7, rough=0.24, per=8):
    pts = []
    for k in range(lobes):
        a = 2 * math.pi * k / lobes
        rr = r * (1 - rough + rnd.random() * rough * 2)
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
    return smooth(pts + pts[:1], per)


def smooth(pts, per=8):
    """Densify sparse road control points with Catmull-Rom interpolation."""
    P = [pts[0]] + list(pts) + [pts[-1]]
    out = []
    for i in range(len(P) - 3):
        p0, p1, p2, p3 = P[i], P[i + 1], P[i + 2], P[i + 3]
        for k in range(per):
            t = k / per
            t2, t3 = t * t, t * t * t
            x = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t
                       + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2
                       + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
            y = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t
                       + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2
                       + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
            out.append((x, y))
    out.append(tuple(pts[-1]))
    return out


class Way:

    def __init__(self, pts, per=8):
        self.p = smooth(pts, per) if len(pts) > 2 and per > 1 else list(pts)
        self._measure()

    def _measure(self):
        self.c = [0.0]
        for i in range(1, len(self.p)):
            self.c.append(self.c[-1] + dist(self.p[i - 1], self.p[i]))
        self.L = self.c[-1] or 1.0

    def _idx(self, t):
        s = max(0.0, min(1.0, t)) * self.L
        lo, hi = 0, len(self.c) - 1
        while lo < hi - 1:
            mid = (lo + hi) // 2
            if self.c[mid] <= s:
                lo = mid
            else:
                hi = mid
        seg = (self.c[lo + 1] - self.c[lo]) or 1.0
        return lo, (s - self.c[lo]) / seg

    def at(self, t):
        i, u = self._idx(t)
        return lerp2(self.p[i], self.p[i + 1], u)

    def tan(self, t):
        i, _ = self._idx(t)
        a, b = self.p[i], self.p[min(i + 1, len(self.p) - 1)]
        L = dist(a, b) or 1.0
        return ((b[0] - a[0]) / L, (b[1] - a[1]) / L)

    def ang(self, t):
        tv = self.tan(t)
        return math.atan2(tv[1], tv[0])

    def nrm(self, t):
        tx, ty = self.tan(t)
        return (ty, -tx)

    def side(self, t, d):
        p, nv = self.at(t), self.nrm(t)
        return (p[0] + nv[0] * d, p[1] + nv[1] * d)

    def offset(self, d):
        out = []
        for i in range(len(self.p)):
            a = self.p[max(0, i - 1)]
            b = self.p[min(len(self.p) - 1, i + 1)]
            tx, ty = b[0] - a[0], b[1] - a[1]
            L = math.hypot(tx, ty) or 1.0
            out.append((self.p[i][0] + (ty / L) * d, self.p[i][1] - (tx / L) * d))
        w = Way.__new__(Way)
        w.p = out
        w._measure()
        return w

    def slice(self, t0, t1, steps=None):
        steps = steps or max(5, int(abs(t1 - t0) * self.L / 34))
        return [self.at(t0 + (t1 - t0) * k / steps) for k in range(steps + 1)]


PAPER = "#F2F1E8"


def hexc(s):
    s = s.lstrip("#")
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


def rgbs(t):
    return "#%02X%02X%02X" % tuple(max(0, min(255, int(round(v)))) for v in t)


def veil(colour, amount, onto=PAPER):
    a, b = hexc(colour), hexc(onto)
    return rgbs([a[i] + (b[i] - a[i]) * amount for i in range(3)])


def mix(c1, c2, t):
    a, b = hexc(c1), hexc(c2)
    return rgbs([a[i] + (b[i] - a[i]) * t for i in range(3)])


INK = "#3A352A"

C = dict(
    walk=veil("#EFEADD", 0.32),
    asphalt=veil("#DCD5C2", 0.38),
    asphalt_dk=veil("#CFC7B0", 0.4),
    median=veil("#B9CFA1", 0.4),
    stripe=veil("#FAF7EC", 0.2),
    court=veil("#CFC7B2", 0.4),
    stone=veil("#DFD5BB", 0.36),
    lot=veil("#D2C9B0", 0.4),
    lot_line=veil("#B3A88C", 0.44),
    roof=[veil(c, 0.45) for c in
          ("#C89A6A", "#BC8C5F", "#D2A574", "#C08F5C", "#CBA070")],
    ridge=veil("#8E653E", 0.36),
    shadow=veil("#6E6553", 0.56),
    grass=veil("#AFC996", 0.44),
    grass_dk=veil("#9DBB84", 0.46),
    meadow=veil("#C2D6A8", 0.5),
    trail=veil("#E6DFCB", 0.36),
    crown=[veil(c, 0.44) for c in ("#5F8C4C", "#6F9A5B", "#7FA867")],
    crown_hi=veil("#93B978", 0.5),
    trunk=veil("#745B39", 0.4),
    water=veil("#A9C8D6", 0.4),
    water_hi=veil("#C6DEE8", 0.46),
    portico=veil("#CFC3A6", 0.36),
    portico_col="#F4F0E3",
    portico_arch=veil("#6B604B", 0.3),
    court_red=veil("#C08A63", 0.44),
    glass=veil("#BFCBC6", 0.4),
    grass_new=veil("#A8C58C", 0.04),
    meadow_new=veil("#C2D8A6", 0.1),
    crown_new=["#4F7A3E", "#5F8C4C", "#78A263"],
    crown_new_hi="#96BC7B",
    trunk_new="#6C5133",
    water_new="#A9C8D6",
    water_new_hi="#C9E1EA",
    soil=veil("#A98A63", 0.16),
    warm="#C0503A",
    amber="#C97A2E",
    works="#D9902F",
    shade="#2C5A3B",
    car=[veil(c, 0.34) for c in
         ("#8FA3AE", "#B9836A", "#93A183", "#A8A296", "#7E8C99", "#C0A27E")],
)


LAYERS = [
    "street", "plot", "mark", "green", "water", "shadow", "portico", "build",
    "porticoCutaway", "prop", "trees", "wash", "site", "newgreen", "newshade",
    "newtree", "corridor", "route",
]
BAG = {k: [] for k in LAYERS}


class Piece:

    def __init__(self, at=0, d=0, until=None):
        self.at, self.d, self.until = at, d, until
        self.bag = {}

    def add(self, layer, *bodies):
        for b in bodies:
            if b:
                self.bag.setdefault(layer, []).append(b)
        return self

    def flush(self, cls=""):
        for layer, bodies in self.bag.items():
            put(layer, "".join(bodies), at=self.at, d=self.d, cls=cls,
                until=self.until)


def put(layer, body, at=0, d=0, cls="", until=None):
    if body:
        BAG[layer].append(dict(at=at, d=d, cls=cls, until=until, body=body))


WAVES = 6
WAVE_MS = 230


def merged(layer):
    """Merge background pieces into waves to limit rendered SVG groups."""
    waves, loose = {}, []
    for it in BAG[layer]:
        if it["at"] == 0 and it["until"] is None and not it["cls"]:
            waves.setdefault(min(WAVES - 1, int(it["d"] / 240)), []).append(it["body"])
        else:
            loose.append(it)
    out = []
    for w in sorted(waves):
        out.append(f'<g class="pl-i" data-at="0" style="--d:{w * WAVE_MS}ms">'
                   f'{"".join(waves[w])}</g>')
    for it in loose:
        attrs = [f'class="pl-i{(" " + it["cls"]) if it["cls"] else ""}"',
                 f'data-at="{it["at"]}"']
        if it["until"] is not None:
            attrs.append(f'data-until="{it["until"]}"')
        if it["d"]:
            attrs.append(f'style="--d:{int(it["d"])}ms"')
        out.append(f'<g {" ".join(attrs)}>{it["body"]}</g>')
    return "".join(out)


def fill(d, colour, extra=""):
    return f'<path d="{d}" fill="{colour}"{extra}></path>'


def line(d, colour, w, extra=""):
    return (f'<path d="{d}" fill="none" stroke="{colour}" stroke-width="{n(w)}"'
            f' stroke-linecap="round" stroke-linejoin="round"{extra}></path>')


def ink(d, opacity=0.5, w=None):
    wa = f' stroke-width="{n(w)}"' if w else ""
    return (f'<path class="pl-ink" d="{d}" fill="none" opacity="{opacity}"'
            f'{wa} pathlength="1"></path>')


DEFS_PATHS = []
_pid = [0]


def defpath(d):
    _pid[0] += 1
    DEFS_PATHS.append(f'<path id="pw{_pid[0]}" d="{d}"></path>')
    return f"pw{_pid[0]}"


def use(pid, colour, w, extra=""):
    return (f'<use href="#{pid}" fill="none" stroke="{colour}"'
            f' stroke-width="{n(w)}" stroke-linecap="round"'
            f' stroke-linejoin="round"{extra}></use>')


def discs(spots, colour, extra=""):
    """Pack repeated discs into one SVG path to reduce DOM nodes."""
    return (f'<path d="{"".join(circle_d(x, y, r) for x, y, r in spots)}"'
            f' fill="{colour}"{extra}></path>')


VIALE = Way([(-260, 445), (180, 550), (660, 685), (1180, 795),
             (1720, 772), (2200, 662), (2660, 512)])
VIALE_W = 104 * S

PORTA_A = 0.245
PORTA_B = 0.535


def radial(t_gate, up, out=150, bend=0.0, per=11):
    p = VIALE.at(t_gate)
    into = VIALE.nrm(t_gate)
    tv = VIALE.tan(t_gate)
    pts = []
    steps = 6
    for k in range(steps + 1):
        f = k / steps
        r = -out + (up + out) * f
        s = math.sin(f * math.pi) * bend * up
        pts.append((p[0] + into[0] * r + tv[0] * s, p[1] + into[1] * r + tv[1] * s))
    w = Way(pts, per=per)
    w.up, w.out = up, out
    w.tg = out / (up + out)
    w.t_out = lambda d: (out - d) / (up + out)
    return w


RD = radial(0.075, 620, bend=-0.05)
RA = radial(PORTA_A, 790, bend=0.05)
RB = radial(PORTA_B, 920, bend=-0.04)
RC = radial(0.80, 800, bend=0.05)

RADIALS = [(RD, 52 * S, False), (RA, 66 * S, True),
           (RB, 64 * S, True), (RC, 54 * S, False)]


def ladder(a, b, cols, fr, tag):
    return dict(a=a, b=b, cols=cols, tag=tag,
                rows=[a.tg + (1 - a.tg) * f for f in fr])


CENTRO = [
    ladder(RA, RB, 4, [0.03, 0.24, 0.45, 0.66, 0.85, 1.0], "A"),
    ladder(RD, RA, 3, [0.04, 0.28, 0.54, 0.78, 1.0], "D"),
    ladder(RB, RC, 3, [0.03, 0.25, 0.48, 0.71, 0.9, 1.0], "B"),
]

PER_ROWS = [64, 292, 528, 768, 1010, 1260]
PER_COLS = [0.02, 0.105, 0.175, PORTA_A, 0.315, 0.39, 0.465, PORTA_B,
            0.615, 0.695, 0.775, 0.86, 0.94]
PER_OFF = [VIALE.offset(-d) for d in PER_ROWS]

P1 = ("per", 8, 1)
P2 = ("A", 0, 2)
C1 = ("per", 3, 1)
C2 = ("per", 6, 0)
C3 = ("A", 0, 0)

SPECIAL = {
    P1: "park", P2: "garden", C1: "lot", C2: "school", C3: "piazza",
    ("A", 2, 1): "church",
    ("B", 1, 1): "courts",
    ("D", 0, 2): "market",
    ("per", 1, 2): "shed",
    ("per", 5, 2): "shed",
    ("per", 2, 3): "villini",
    ("per", 7, 3): "villini",
    ("per", 9, 2): "villini",
    ("per", 4, 2): "courts",
    ("per", 0, 1): "public",
    ("B", 0, 1): "public",
}

CENTRO_FABRIC = {
    "A": (
        ("piazza", "corte", "open_u", "palazzo"),
        ("open_l", "mixed", "church", "corte"),
        ("garden", "terraces", "open_u", "corte"),
        ("palazzo", "corte", "mixed", "open_l"),
        ("edge", "edge", "edge", "edge"),
    ),
    "D": (
        ("mixed", "open_l", "corte"),
        ("open_u", "terraces", "palazzo"),
        ("market", "allotments", "mixed"),
        ("edge", "edge", "edge"),
    ),
    "B": (
        ("open_u", "corte", "palazzo"),
        ("public", "courts", "open_l"),
        ("corte", "mixed", "open_u"),
        ("palazzo", "open_l", "corte"),
        ("edge", "edge", "edge"),
    ),
}

PER_NEAR = ("open_u", "apartments", "corte", "palazzo", "mixed",
            "apartments", "corte", "open_l", "terraces", "palazzo",
            "apartments", "mixed")
PER_MIDDLE = ("apartments", "terraces", "bars", "open_l", "parking",
              "apartments", "terraces", "mixed", "bars", "open_u",
              "apartments", "terraces")
PER_OUTER = ("villini", "terraces", "apartments", "bars", "mixed", "parking")


def per_fabric_kind(i, j):
    if j == 0:
        return PER_NEAR[i % len(PER_NEAR)]
    if j == 1:
        return PER_MIDDLE[i % len(PER_MIDDLE)]
    return PER_OUTER[(i + 2 * j) % len(PER_OUTER)]


def per_cell(i, j):
    s0, s1 = PER_COLS[i], PER_COLS[i + 1]
    o0, o1 = PER_OFF[j], PER_OFF[j + 1]
    return [o0.at(s0), o0.at(s1), o1.at(s1), o1.at(s0)]


def centro_cell(lad, i, j):
    a, b, rows = lad["a"], lad["b"], lad["rows"]
    t0, t1 = rows[j], rows[j + 1]
    u0, u1 = i / lad["cols"], (i + 1) / lad["cols"]
    return [lerp2(a.at(t0), b.at(t0), u0), lerp2(a.at(t0), b.at(t0), u1),
            lerp2(a.at(t1), b.at(t1), u1), lerp2(a.at(t1), b.at(t1), u0)]


def on_plan(poly, m=BLEED):
    c = centroid(poly)
    return -m <= c[0] <= W + m and -m <= c[1] <= H + m


if PROBE:
    print("VIALE  L=%.0f" % VIALE.L,
          " ".join(f"{t:.2f}:({VIALE.at(t)[0]:.0f},{VIALE.at(t)[1]:.0f})"
                   for t in (0, .075, .245, .40, .535, .68, .80, 1)))
    for nm, w in (("RD", RD), ("RA", RA), ("RB", RB), ("RC", RC)):
        print(f"{nm} tg={w.tg:.2f} porta=({w.at(w.tg)[0]:.0f},{w.at(w.tg)[1]:.0f})"
              f" cima=({w.at(1)[0]:.0f},{w.at(1)[1]:.0f})")
    for lad in CENTRO:
        for i in range(lad["cols"]):
            for j in range(len(lad["rows"]) - 1):
                q = centro_cell(lad, i, j)
                c = centroid(q)
                print(f'  ({lad["tag"]},{i},{j}) ({c[0]:.0f},{c[1]:.0f})'
                      f' a={area(q):.0f} {"" if on_plan(q) else "OFF"}')
    for i in range(len(PER_COLS) - 1):
        for j in range(len(PER_ROWS) - 1):
            q = per_cell(i, j)
            c = centroid(q)
            print(f"  (per,{i},{j}) ({c[0]:.0f},{c[1]:.0f})"
                  f' a={area(q):.0f} {"" if on_plan(q) else "OFF"}')
    sys.exit(0)


def draw_way(w, width, at=0, d=0, dashed=False, kind="locale", until=None):
    pid = defpath(dpath(w.p))
    body = [use(pid, C["walk"], width + 15 * S), use(pid, C["asphalt"], width)]
    if kind == "viale":
        half = width * 0.27
        for sgn in (-1, 1):
            body.append(line(dpath(w.offset(sgn * half).p), C["asphalt_dk"],
                             width * 0.4, ' opacity=".6"'))
    if dashed:
        body.append(use(pid, C["stripe"], 2.8 * S,
                        f' stroke-dasharray="{n(16 * S)} {n(21 * S)}" opacity=".85"'))
    put("street", "".join(body), at=at, d=d, until=until)
    put("street", ink(dpath(jit(w.offset(width / 2).p, 0.7))
                      + dpath(jit(w.offset(-width / 2).p, 0.7)), 0.3),
        at=at, d=d, until=until)


def zebra(w, t, half, at=0, d=0, length=None, colour=None):
    length = length or 15 * S
    bars = []
    p, nv, ang = w.at(t), w.nrm(t), w.ang(t)
    gap = 4.4 * S
    m = max(2, int((2 * half - gap) / (gap * 2)))
    for k in range(m):
        o = -half + gap + k * gap * 2 + gap / 2
        bars.append(oct_at((p[0] + nv[0] * o, p[1] + nv[1] * o), ang,
                           length, gap * 1.05, cut=0))
    put("mark", fill(multi(bars), colour or C["stripe"], ' opacity=".9"'), at=at, d=d)


def bus_bay(w, t, off, at=0, d=0):
    p, nv, ang = w.at(t), w.nrm(t), w.ang(t)
    c = (p[0] + nv[0] * off, p[1] + nv[1] * off)
    bay = oct_at(c, ang, 60 * S, 13 * S, cut=0.5)
    shel = oct_at((c[0] + nv[0] * 11 * S, c[1] + nv[1] * 11 * S), ang,
                  30 * S, 9 * S, cut=0.2)
    put("prop", fill(dpath(bay, True), C["walk"])
        + fill(dpath(shel, True), C["portico_col"], ' opacity=".72"')
        + ink(dpath(shel, True), 0.34), at=at, d=d)


def street_cars(w, t0, t1, off, count, at=0, d=0, until=None):
    tones = {}
    for k in range(count):
        t = t0 + (t1 - t0) * (k + 0.5) / count
        p = w.side(t, off + rnd.uniform(-1, 1))
        tones.setdefault(C["car"][rnd.randrange(len(C["car"]))], []).append(
            oct_at(p, w.ang(t), 11 * S, 4.6 * S, cut=0.34))
    body = "".join(fill(multi(v), k) for k, v in tones.items())
    put("prop", body, at=at, d=d, until=until)


draw_way(VIALE, VIALE_W, d=0, dashed=False, kind="viale")
put("street", line(dpath(VIALE.p), C["median"], VIALE_W * 0.2)
    + ink(dpath(VIALE.offset(VIALE_W * 0.1).p) + dpath(VIALE.offset(-VIALE_W * 0.1).p), 0.22),
    at=0, d=80)

for w, wid, has_portico in RADIALS:
    draw_way(w, wid, d=120 if has_portico else 240, dashed=has_portico)

for lad in CENTRO:
    a, b, rows, cols = lad["a"], lad["b"], lad["rows"], lad["cols"]
    for j, t in enumerate(rows):
        if j == 0:
            continue
        pa, pb = a.at(t), b.at(t)
        ov = 0.08
        draw_way(Way([lerp2(pa, pb, -ov), lerp2(pa, pb, 0.5), lerp2(pa, pb, 1 + ov)],
                     per=8), (42 if j < len(rows) - 1 else 36) * S, d=300 + j * 40)
    for i in range(1, cols):
        u = i / cols
        ts = [rows[0] - 0.03] + rows[1:-1] + [rows[-1] + 0.02]
        draw_way(Way([lerp2(a.at(t), b.at(t), u) for t in ts], per=9), 24 * S,
                 d=420 + i * 45)

for j, off in enumerate(PER_OFF):
    if j == 0:
        continue
    draw_way(Way(off.slice(PER_COLS[0] - 0.03, PER_COLS[-1] + 0.03), per=1),
             (50 if j == 1 else 42) * S, d=260 + j * 45)
for i, s in enumerate(PER_COLS):
    pts = [PER_OFF[k].at(s) for k in range(len(PER_OFF))]
    draw_way(Way(pts, per=9), (46 if s in (PORTA_A, PORTA_B) else 32) * S,
             d=380 + i * 34)

for t in (PORTA_A, PORTA_B):
    zebra(VIALE, t - 0.012, VIALE_W / 2, d=900)
    zebra(VIALE, t + 0.012, VIALE_W / 2, d=960)
for t in (0.155, 0.40, 0.66):
    zebra(VIALE, t, VIALE_W / 2, d=1000)
bus_bay(VIALE, 0.30, VIALE_W / 2 + 8 * S, d=1050)
bus_bay(VIALE, 0.62, -VIALE_W / 2 - 8 * S, d=1080)
for w in (RA, RB):
    zebra(w, w.tg + 0.14, w.up * 0.043 + 12 * S, d=1020)

street_cars(VIALE, 0.12, 0.94, VIALE_W / 2 + 5 * S, 26, d=1120)
street_cars(VIALE, 0.10, 0.92, -VIALE_W / 2 - 5 * S, 24, d=1160)
street_cars(RA, RA.tg + 0.05, 0.96, 38 * S, 5, d=1200)
street_cars(RB, RB.tg + 0.05, 0.96, -37 * S, 5, d=1240)

CANAL = Way([lerp2(RA.at(t), RB.at(t), 0.5 + 0.16 * math.sin(t * 3.4))
             for t in (0.34, 0.48, 0.62, 0.76, 0.9, 1.02)])
put("water", line(dpath(CANAL.p), C["water"], 15 * S, ' opacity=".85"')
    + line(dpath(CANAL.p), C["water_hi"], 6 * S, ' opacity=".7"'), d=560)


def tones(new):
    if new:
        return C["crown_new"], C["crown_new_hi"], mix(C["shade"], PAPER, 0.62)
    return C["crown"], C["crown_hi"], C["shadow"]


def canopy_d(x, y, r, seed=0):
    phase = seed * 1.71 + x * .013 + y * .017
    pts = []
    lobes = 8
    for k in range(lobes):
        a = 2 * math.pi * k / lobes
        rr = r * (.86 + .12 * math.sin(phase + k * 2.17)
                  + .045 * math.cos(phase * .7 + k * 1.31))
        pts.append((x + math.cos(a) * rr, y + math.sin(a) * rr))
    return dpath(pts, True)


def crown_body(x, y, r, k, new=False):
    cr, hi, sh = tones(new)
    base = canopy_d(x, y, r, k)
    shadow = circle_d(x + r * .22, y + r * .27, r * 1.02)
    light = circle_d(x - r * .25, y - r * .27, r * .42)
    trunk_r = max(1.25 * S, r * .13)
    return (fill(shadow, sh, ' opacity=".2"')
            + fill(base, cr[k % 3])
            + (ink(base, .28) if new else "")
            + fill(circle_d(x, y, trunk_r), C["trunk_new" if new else "trunk"])
            + fill(light, hi, ' opacity=".48"'))


def crowns_body(spots, new=False):
    if len(spots) <= 2:
        return "".join(crown_body(x, y, r, k, new)
                       for k, (x, y, r) in enumerate(spots))
    crt, hit, sht = tones(new)
    sh, hi, trunks = [], [], []
    cr = {0: [], 1: [], 2: []}
    for k, (x, y, r) in enumerate(spots):
        sh.append(circle_d(x + r * .22, y + r * .27, r * 1.02))
        cr[k % 3].append(canopy_d(x, y, r, k))
        hi.append(circle_d(x - r * .25, y - r * .27, r * .42))
        trunks.append(circle_d(x, y, max(1.25 * S, r * .13)))
    out = [f'<path d="{"".join(sh)}" fill="{sht}" opacity=".2"></path>']
    for i in (0, 1, 2):
        if cr[i]:
            out.append(f'<path d="{"".join(cr[i])}" fill="{crt[i]}"></path>')
    all_bases = "".join("".join(cr[i]) for i in (0, 1, 2))
    if new:
        out.append(ink(all_bases, .3))
    out.append(fill("".join(trunks), C["trunk_new" if new else "trunk"]))
    out.append(f'<path d="{"".join(hi)}" fill="{hit}" opacity=".48"></path>')
    return "".join(out)


def spots_in(poly, count, r):
    out = []
    for _ in range(count):
        p = quad_at(poly, rnd.uniform(.08, .92), rnd.uniform(.08, .92))
        out.append((p[0], p[1], rnd.uniform(*r)))
    return out


def patch_body(poly, count, r):
    return crowns_body(spots_in(poly, count, r))


def row_spots(w, t0, t1, off, step, r=(7.5, 11.5)):
    m = max(2, int(abs(t1 - t0) * w.L / step))
    out = []
    for k in range(m + 1):
        x, y = w.side(t0 + (t1 - t0) * k / m, off)
        out.append((x, y, rnd.uniform(*r)))
    return out


def crowns(spots, at, d, step=22, chunk=1, layer="trees", cls="pl-tree", new=True):
    """Chunk crowns into shared paths to reduce transition count."""
    for i in range(0, len(spots), chunk):
        put(layer, crowns_body(spots[i:i + chunk], new), at=at,
            d=d + (i // chunk) * step * chunk, cls=cls)


def corridor_pergola(w, t0, t1, off, width, at, d):
    left = w.offset(off - width / 2).slice(t0, t1)
    right = w.offset(off + width / 2).slice(t0, t1)
    band = left + list(reversed(right))
    ribs = []
    count = max(5, int(abs(t1 - t0) * w.L / (18 * S)))
    for k in range(count + 1):
        t = t0 + (t1 - t0) * k / count
        ribs.append(dpath([w.side(t, off - width / 2),
                           w.side(t, off + width / 2)]))
    posts = [(*w.side(t, off + side * width / 2), 3.7 * S)
             for t in (t0, t1) for side in (-1, 1)]
    inner_posts = [(x, y, 1.8 * S) for x, y, _ in posts]
    vine = dpath(w.offset(off).slice(t0, t1))
    body = (
        fill(dpath(band, True), C["shade"], ' opacity=".14"')
        + line(dpath(left) + dpath(right), C["ridge"], 2.8 * S,
               ' opacity=".86"')
        + line("".join(ribs), C["ridge"], 2.1 * S, ' opacity=".76"')
        + line(vine, C["meadow_new"], 5.2 * S,
               f' stroke-dasharray="{n(14 * S)} {n(9 * S)}" opacity=".92"')
        + discs(posts, C["ridge"])
        + discs(inner_posts, C["portico_col"])
        + ink(dpath(band, True), .34)
    )
    put("corridor", body, at=at, d=d, cls="pl-pergola")


put("trees", crowns_body(row_spots(VIALE, 0.05, 0.97, 0, 46 * S, (6, 9))),
    at=0, d=1300)


def roof_tone():
    return C["roof"][rnd.randrange(len(C["roof"]))]


def roof_fill(d, tone):
    return fill(d, tone)


def roof_axis(poly):
    along_u = dist(poly[0], poly[1]) >= dist(poly[1], poly[2])
    if along_u:
        return [quad_at(poly, .08, .5), quad_at(poly, .92, .5)], quad_ang(poly)
    return [quad_at(poly, .5, .08), quad_at(poly, .5, .92)], quad_ang(poly) + math.pi / 2


def building_cluster(pc, bodies, details=True, shadow=.25):
    if not bodies:
        return
    tones, ridges, marks = {}, [], []
    for k, body in enumerate(bodies):
        tones.setdefault(roof_tone(), []).append(body)
        axis, ang = roof_axis(body)
        ridges.append(axis)
        if details and area(body) > 2300 and k % 2 == 0:
            marks.append(oct_at(quad_at(body, .3, .5), ang,
                                13 * S, 7 * S, cut=.12))
    pc.add("shadow", fill(multi([move(body, 3 * S, 4 * S) for body in bodies]),
                          C["shadow"], f' opacity="{shadow}"'))
    for tone, cells in tones.items():
        pc.add("build", roof_fill(multi(cells), tone))
    pc.add("build",
           line("".join(dpath(axis) for axis in ridges), C["ridge"],
                1.7 * S, ' opacity=".76"'),
           fill(multi(marks), C["glass"], ' opacity=".86"') if marks else "",
           ink("".join(dpath(jit(body, .8), True) for body in bodies), .43))


def courtyard(pc, poly):
    a = area(poly)
    if a < 3000:
        return
    pc.add("plot", fill(dpath(poly, True), C["court"]),
           line(dpath([quad_at(poly, .5, .02), quad_at(poly, .5, .48)]),
                C["trail"], 5 * S, ' opacity=".9"'))
    if a > 5200:
        if rnd.random() < .55:
            bed = quad_cell(poly, .2, .8, .55, .82)
            pc.add("green", fill(dpath(jit(bed, 1.4), True), C["meadow"],
                                 ' opacity=".72"'))
            pc.add("trees", patch_body(bed, rnd.randint(1, 2), (7, 11)))
        else:
            pc.add("trees", patch_body(poly, 1, (8, 12)))


def block_corte(pc, q, depth=None, seg=None):
    seg = seg or 138 * S
    outer = inset(q, 5 * S)
    per = sum(dist(outer[i], outer[(i + 1) % 4]) for i in range(4))
    depth = depth or max(34 * S, min(78 * S, per * 0.068))
    inner = inset(outer, depth)
    if min(dist(inner[i], inner[(i + 1) % 4]) for i in range(4)) < 20 * S:
        return block_bars(pc, q)

    tones, ridge, joints, chimneys, cells = {}, [], [], [], []
    for k in range(4):
        a0, a1 = outer[k], outer[(k + 1) % 4]
        i0, i1 = inner[k], inner[(k + 1) % 4]
        side_len = dist(a0, a1)
        m = 2 if side_len > 230 * S else 1
        parts = [(.0, .45), (.55, 1.)] if k == 0 and side_len > 145 * S else [
            (t / m, (t + 1) / m) for t in range(m)
        ]
        for u0, u1 in parts:
            cell = [lerp2(a0, a1, u0), lerp2(a0, a1, u1),
                    lerp2(i0, i1, u1), lerp2(i0, i1, u0)]
            tones.setdefault(roof_tone(), []).append(cell)
            cells.append(cell)
            ridge.append([lerp2(lerp2(a0, i0, .5), lerp2(a1, i1, .5), u0),
                          lerp2(lerp2(a0, i0, .5), lerp2(a1, i1, .5), u1)])
        if m > 1 and k != 0:
            joints.append([lerp2(a0, a1, 0.5), lerp2(i0, i1, 0.5)])
        if side_len > 145 * S:
            pa = lerp2(a0, a1, 0.3)
            pi = lerp2(i0, i1, 0.3)
            cp = lerp2(pa, pi, 0.52)
            ang = math.atan2(a1[1] - a0[1], a1[0] - a0[0])
            chimneys.append(oct_at(cp, ang, 9 * S, 5.5 * S, cut=.12))
    pc.add("shadow", fill(multi([move(cell, 3 * S, 4 * S) for cell in cells]),
                          C["shadow"], ' opacity=".26"'))
    for tone, cells in tones.items():
        pc.add("build", roof_fill(multi(cells), tone))
    pc.add("build",
           line("".join(dpath(x) for x in ridge), C["ridge"], 1.8 * S, ' opacity=".78"'),
           line("".join(dpath(x) for x in joints), C["ridge"], 1.15 * S,
                ' opacity=".48"') if joints else "",
           fill(multi(chimneys), C["ridge"], ' opacity=".72"') if chimneys else "",
           ink("".join(dpath(jit(cell), True) for cell in cells), 0.42))
    courtyard(pc, inner)
    return inner


def block_open(pc, q, form="l"):
    if form == "u":
        bodies = [quad_cell(q, .05, .44, .06, .28),
                  quad_cell(q, .56, .95, .06, .28),
                  quad_cell(q, .05, .25, .28, .79),
                  quad_cell(q, .75, .95, .28, .69)]
        yard = quad_cell(q, .28, .72, .34, .86)
        garden = quad_cell(q, .34, .66, .57, .84)
    elif form == "mixed":
        bodies = [quad_cell(q, .05, .37, .06, .31),
                  quad_cell(q, .43, .69, .08, .28),
                  quad_cell(q, .74, .94, .05, .34),
                  quad_cell(q, .57, .91, .58, .84)]
        yard = quad_cell(q, .07, .52, .4, .87)
        garden = quad_cell(q, .12, .47, .54, .84)
    else:
        bodies = [quad_cell(q, .06, .92, .06, .29),
                  quad_cell(q, .06, .28, .29, .82)]
        yard = quad_cell(q, .32, .91, .36, .88)
        garden = quad_cell(q, .4, .86, .55, .84)

    pc.add("plot", fill(dpath(yard, True), C["court"]),
           line(dpath([quad_at(yard, .5, .02), quad_at(yard, .5, .45)]),
                C["trail"], 5 * S, ' opacity=".86"'),
           ink(dpath(jit(yard, .8), True), .2))
    planted = quad_cell(garden, .18, .82, .2, .78)
    pc.add("green", fill(dpath(jit(planted, 1.3), True), C["meadow"],
                         ' opacity=".54"'))
    building_cluster(pc, bodies)
    if area(planted) > 900:
        pc.add("trees", patch_body(planted, 1 if form == "mixed" else 2, (7, 10)))


def block_palazzo(pc, q):
    main = quad_cell(q, .07, .68, .08, .57)
    wing = quad_cell(q, .07, .3, .57, .86)
    forecourt = quad_cell(q, .34, .67, .61, .84)
    garden = quad_cell(q, .72, .93, .18, .84)
    planted = quad_cell(garden, .12, .88, .22, .76)
    pc.add("plot", fill(dpath(forecourt, True), C["stone"]),
           fill(dpath(garden, True), C["court"]),
           line(dpath([quad_at(forecourt, .5, .08), quad_at(forecourt, .5, .92)]),
                C["lot_line"], 2 * S, ' opacity=".7"'))
    pc.add("green", fill(dpath(jit(planted, 1.4), True), C["grass"],
                         ' opacity=".58"'))
    building_cluster(pc, [main, wing], shadow=.29)
    pc.add("trees", patch_body(planted, 2, (8, 11)))


def block_terraces(pc, q):
    houses, gardens, lawns, divisions = [], [], [], []
    count = 4 if dist(q[0], q[1]) < 240 * S else 5
    for k in range(count):
        u0 = .05 + k * .9 / count
        u1 = .05 + (k + .84) * .9 / count
        v1 = .39 + (k % 3) * .035
        houses.append(quad_cell(q, u0, u1, .07, v1))
        garden = quad_cell(q, u0, u1, v1 + .04, .9)
        gardens.append(garden)
        lawns.append(quad_cell(garden, .08, .92, .5, .92))
        if k:
            divisions.append([quad_at(q, u0 - .012, v1), quad_at(q, u0 - .012, .9)])
    pc.add("plot", fill(multi(gardens), C["court"], ' opacity=".7"'),
           line("".join(dpath(x) for x in divisions), C["lot_line"], 1.2 * S,
                ' opacity=".48"') if divisions else "")
    pc.add("green", fill(multi(lawns), C["grass"], ' opacity=".56"'))
    building_cluster(pc, houses, details=False, shadow=.22)
    trees = []
    for k in range(0, count, 2):
        p = quad_at(lawns[k], .55, .62)
        trees.append((p[0], p[1], rnd.uniform(6.5, 9.5)))
    pc.add("trees", crowns_body(trees))


def block_apartments(pc, q):
    common = quad_cell(q, .05, .95, .06, .92)
    flip = int(abs(centroid(q)[0]) / 180) % 2
    if flip:
        bodies = [quad_cell(q, .08, .34, .12, .68),
                  quad_cell(q, .4, .68, .27, .84),
                  quad_cell(q, .73, .93, .08, .56)]
    else:
        bodies = [quad_cell(q, .07, .3, .1, .58),
                  quad_cell(q, .36, .65, .33, .86),
                  quad_cell(q, .71, .93, .14, .68)]
    pc.add("plot", fill(dpath(jit(common, 1.2), True), C["court"],
                        ' opacity=".62"'))
    building_cluster(pc, bodies, shadow=.27)
    balconies = []
    for body in bodies:
        balconies.extend([[quad_at(body, .08, .94), quad_at(body, .34, .94)],
                          [quad_at(body, .66, .94), quad_at(body, .92, .94)]])
    pc.add("build", line("".join(dpath(x) for x in balconies), C["ridge"],
                         2.1 * S, ' opacity=".5"'))
    open_spots = [quad_at(common, .34, .18), quad_at(common, .67, .78)]
    lawns = [blob(x, y, 18 * S, lobes=7, rough=.12, per=2) for x, y in open_spots]
    pc.add("green", fill(multi(lawns), C["meadow"], ' opacity=".56"'))
    pc.add("trees", crowns_body([(x, y, rnd.uniform(7, 10)) for x, y in open_spots]))


def block_market(pc, q):
    hall = quad_cell(q, .08, .92, .08, .35)
    square = quad_cell(q, .08, .92, .39, .9)
    canopies = [quad_cell(square, .1, .9, .12 + k * .27, .24 + k * .27)
                for k in range(3)]
    pc.add("plot", fill(dpath(square, True), C["stone"]),
           line("".join(dpath([quad_at(square, .06, v), quad_at(square, .94, v)])
                        for v in (.34, .67)), C["lot_line"], 1.5 * S,
                ' opacity=".55"'))
    building_cluster(pc, [hall], shadow=.28)
    pc.add("prop", fill(multi(canopies), C["glass"], ' opacity=".92"'),
           ink("".join(dpath(jit(x, .5), True) for x in canopies), .34))
    edge = [quad_at(square, u, .93) for u in (.12, .38, .64, .88)]
    pc.add("trees", crowns_body([(x, y, rnd.uniform(6.5, 9)) for x, y in edge]))


def block_allotments(pc, q):
    p = inset(q, 10 * S)
    plots, paths, sheds = [], [], []
    count = 4
    for k in range(count):
        u0, u1 = .04 + k * .92 / count, .04 + (k + .86) * .92 / count
        plot = quad_cell(p, u0, u1, .08, .87)
        plots.append(plot)
        if k:
            paths.append([quad_at(p, u0 - .018, .06), quad_at(p, u0 - .018, .92)])
        if k % 2 == 0:
            sheds.append(quad_cell(plot, .16, .52, .08, .25))
    pc.add("green", fill(multi(plots), C["meadow"], ' opacity=".7"'),
           line("".join(dpath(x) for x in paths), C["trail"], 4 * S,
                ' opacity=".9"'))
    building_cluster(pc, sheds, details=False, shadow=.18)
    spots = []
    for k, plot in enumerate(plots):
        if k != 1:
            point = quad_at(plot, .62, .63)
            spots.append((point[0], point[1], rnd.uniform(6, 8.5)))
    pc.add("trees", crowns_body(spots))


def block_bars(pc, q, rows=2):
    tones, edges, ridge, facade_marks, roof_marks = {}, [], [], [], []
    nbar = max(1, int(dist(q[0], q[1]) / (205 * S)))
    band = 0.84 / rows
    for r in range(rows):
        v0 = 0.08 + r * band
        for b in range(nbar):
            u0 = 0.05 + b * (0.9 / nbar)
            u1 = u0 + (0.9 / nbar) * (0.64 + rnd.random() * 0.24)
            v1 = v0 + band * (0.44 + rnd.random() * 0.26)
            cell = quad_cell(q, u0, u1, v0, v1)
            tones.setdefault(roof_tone(), []).append(cell)
            edges.append(cell)
            ridge.append([quad_at(cell, 0.02, 0.5), quad_at(cell, 0.98, 0.5)])
            front_a, front_b = cell[3], cell[2]
            for s0, s1 in ((.14, .34), (.66, .86)):
                facade_marks.append([lerp2(front_a, front_b, s0),
                                     lerp2(front_a, front_b, s1)])
            roof_marks.append(oct_at(quad_at(cell, .28, .5), quad_ang(cell),
                                     12 * S, 6 * S, cut=.12))
    pc.add("shadow", fill(multi([move(e, 3 * S, 4 * S) for e in edges]), C["shadow"],
                          ' opacity=".24"'))
    for tone, cells in tones.items():
        pc.add("build", roof_fill(multi(cells), tone))
    pc.add("build",
           line("".join(dpath(x) for x in ridge), C["ridge"], 1.8 * S, ' opacity=".76"'),
           line("".join(dpath(x) for x in facade_marks), C["ridge"], 2.2 * S,
                ' opacity=".5"'),
           fill(multi(roof_marks), C["glass"], ' opacity=".9"'),
           ink("".join(dpath(jit(e), True) for e in edges), 0.4))


def block_public(pc, q):
    body = quad_cell(q, .1, .9, .3, .88)
    court = quad_cell(q, .1, .9, .06, .28)
    pc.add("plot", fill(dpath(court, True), C["stone"]),
           ink(dpath(jit(court), True), 0.26))
    pc.add("shadow", fill(dpath(move(body, 4.4 * S, 5.6 * S), True), C["shadow"],
                          ' opacity=".32"'))
    wings = [[quad_at(body, u, .04), quad_at(body, u, .96)] for u in (.28, .5, .72)]
    pc.add("build", roof_fill(dpath(body, True), C["roof"][2]),
           line("".join(dpath(x) for x in wings), C["ridge"], 1.6 * S, ' opacity=".7"'),
           ink(dpath(jit(body), True), 0.48))
    pc.add("trees", crowns_body(spots_in(court, 4, (7, 10))))


def block_villini(pc, q):
    cols, rows = 3, 2
    roofs, gardens, lawns, edges, cars, trees = {}, [], [], [], {}, []
    for r in range(rows):
        for c in range(cols):
            u0, u1 = 0.04 + c * 0.92 / cols, 0.04 + (c + 0.62) * 0.92 / cols
            v0 = 0.06 + r * 0.88 / rows
            lot = quad_cell(q, u0 - 0.02, u0 + 0.9 / cols, v0, v0 + 0.8 / rows)
            gardens.append(lot)
            lawns.append(quad_cell(lot, .7, .96, .48, .94))
            house = quad_cell(lot, .1, .66, .12, .62)
            roofs.setdefault(roof_tone(), []).append(house)
            edges.append(house)
            pt = quad_at(lot, .84, .74)
            trees.append((pt[0], pt[1], rnd.uniform(7, 11)))
            if rnd.random() < 0.6:
                dv = quad_at(lot, .48, .86)
                cars.setdefault(C["car"][rnd.randrange(len(C["car"]))], []).append(
                    oct_at(dv, quad_ang(lot, .48), 11 * S, 4.6 * S, cut=.34))
    pc.add("plot", fill(multi(gardens), C["court"], ' opacity=".68"'))
    pc.add("green", fill(multi(lawns), C["grass"], ' opacity=".62"'))
    pc.add("shadow", fill(multi([move(e, 2.4 * S, 3.2 * S) for e in edges]),
                          C["shadow"], ' opacity=".22"'))
    for tone, cells in roofs.items():
        pc.add("build", roof_fill(multi(cells), tone))
    pc.add("build", ink("".join(dpath(jit(e, .8), True) for e in edges), 0.42))
    pc.add("prop", *[fill(multi(v), k) for k, v in cars.items()])
    pc.add("trees", crowns_body(trees))


def block_shed(pc, q):
    body = quad_cell(q, .06, .94, .06, .58)
    yard = quad_cell(q, .06, .94, .62, .94)
    teeth, glass = [], []
    m = 9
    for k in range(m):
        u0, u1 = .06 + k * .88 / m, .06 + (k + 1) * .88 / m
        teeth.append([quad_at(body, u0, .02), quad_at(body, u0, .98)])
        glass.append(quad_cell(body, u0, u0 + (.88 / m) * .34, .04, .96))
    pc.add("shadow", fill(dpath(move(body, 3.4 * S, 4.6 * S), True), C["shadow"],
                          ' opacity=".28"'))
    pc.add("build", roof_fill(dpath(body, True), C["roof"][3]),
           fill(multi(glass), C["glass"], ' opacity=".85"'),
           line("".join(dpath(x) for x in teeth), C["ridge"], 1.5 * S, ' opacity=".7"'),
           ink(dpath(jit(body), True), 0.46))
    pc.add("plot", fill(dpath(yard, True), C["lot"]), ink(dpath(jit(yard), True), 0.26))
    trucks = {}
    for k in range(4):
        pt = quad_at(yard, .14 + k * .24, .5)
        trucks.setdefault(C["car"][k % len(C["car"])], []).append(
            oct_at(pt, quad_ang(yard, .5) + math.pi / 2, 21 * S, 6.4 * S, cut=.2))
    pc.add("prop", *[fill(multi(v), k) for k, v in trucks.items()])


def block_church(pc, q):
    sagrato = quad_cell(q, .06, .94, .06, .3)
    nave = quad_cell(q, .3, .7, .32, .84)
    trans = quad_cell(q, .12, .88, .48, .62)
    cx, cy = quad_at(q, .5, .9)
    r = dist(quad_at(q, .3, .9), quad_at(q, .7, .9)) / 2
    apse = blob(cx, cy, r, lobes=9, rough=0.04)
    pc.add("plot", fill(dpath(sagrato, True), C["stone"]),
           ink(dpath(jit(sagrato), True), 0.28))
    pc.add("shadow", fill(multi([move(nave, 3 * S, 4 * S), move(trans, 3 * S, 4 * S)])
                          + dpath(move(apse, 3 * S, 4 * S), True), C["shadow"],
                          ' opacity=".3"'))
    pc.add("build", roof_fill(multi([nave, trans]) + dpath(apse, True), C["roof"][0]),
           line(dpath([quad_at(nave, .5, .02), quad_at(nave, .5, .98)])
                + dpath([quad_at(trans, .02, .5), quad_at(trans, .98, .5)]),
                C["ridge"], 2 * S, ' opacity=".9"'),
           ink(dpath(jit(nave), True) + dpath(jit(trans), True)
               + dpath(apse, True), 0.5))
    bol = [quad_at(sagrato, k / 7, .84) for k in range(8)]
    pc.add("prop", discs([(x, y, 2.6 * S) for x, y in bol], C["portico_col"],
                         ' opacity=".7"'))


def block_courts(pc, q):
    pad = inset(q, 12 * S)
    pc.add("green", fill(dpath(jit(pad, 2), True), C["grass"], ' opacity=".85"'))
    fields, lines = [], []
    for k in range(2):
        f = quad_cell(pad, .08, .92, .08 + k * .46, .44 + k * .46)
        fields.append(f)
        lines.append([quad_at(f, .5, .04), quad_at(f, .5, .96)])
        lines.append([quad_at(f, .04, .5), quad_at(f, .96, .5)])
    pc.add("plot", fill(multi(fields), C["court_red"], ' opacity=".9"'),
           ink("".join(dpath(jit(f), True) for f in fields), 0.3))
    pc.add("mark", line("".join(dpath(x) for x in lines), C["stripe"], 2.2 * S,
                        ' opacity=".9"'))
    pc.add("trees", crowns_body(spots_in(pad, 5, (7, 11))))


def plan_car_body(point, ang, tone):
    body = oct_at(point, ang, 12 * S, 5.2 * S, cut=.34)
    shadow = oct_at((point[0] + 1.2 * S, point[1] + 1.5 * S), ang,
                    12.3 * S, 5.4 * S, cut=.34)
    cabin = oct_at(point, ang, 5.4 * S, 3.65 * S, cut=.22)
    ca, sa = math.cos(ang), math.sin(ang)
    front = (point[0] + ca * 1.65 * S, point[1] + sa * 1.65 * S)
    normal = (-sa * 1.42 * S, ca * 1.42 * S)
    windscreen = [(front[0] - normal[0], front[1] - normal[1]),
                  (front[0] + normal[0], front[1] + normal[1])]
    return (fill(dpath(shadow, True), C["shadow"], ' opacity=".18"')
            + fill(dpath(body, True), tone)
            + fill(dpath(cabin, True), C["glass"], ' opacity=".94"')
            + line(dpath(windscreen), C["portico_col"], .9 * S, ' opacity=".66"')
            + ink(dpath(body, True), .3))


def parking(pc, q, cars=True, civic=False, surface=True):
    p = inset(q, 9 * S)
    gl, drains = [], []
    m = max(3, int(dist(p[0], p[1]) / (52 * S)))
    for row in range(3):
        v0, v1 = .04 + row * .92 / 3, .04 + (row + 1) * .92 / 3
        offset = .5 if row % 2 else 0
        for k in range(1, m + 1):
            u = (k - offset) / m
            if .04 < u < .96:
                gl.append([quad_at(p, u, v0), quad_at(p, u, v1)])
    for k in range(1, 3):
        gl.append([quad_at(p, 0.04, k / 3), quad_at(p, 0.96, k / 3)])
    drains.append([quad_at(p, .06, .91), quad_at(p, .94, .91)])
    for k in range(m * 2 + 1):
        u = .07 + k * .86 / max(1, m * 2)
        drains.append([quad_at(p, u, .895), quad_at(p, u, .925)])
    if surface:
        pc.add("plot", fill(dpath(p, True), C["stone"]),
               line("".join(dpath(x) for x in gl), C["lot_line"], 1.8 * S,
                    ' opacity=".7"'),
               ink(dpath(jit(p), True), 0.34))
        pc.add("mark", line("".join(dpath(x) for x in drains), C["lot_line"],
                            1.25 * S, ' opacity=".66"'))
        if civic:
            centre = quad_at(p, .5, .5)
            rings = "".join(
                f'<circle cx="{n(centre[0])}" cy="{n(centre[1])}" r="{n(r * S)}"'
                f' fill="none" stroke="{C["lot_line"]}" stroke-width="{n(1.5 * S)}"'
                f' opacity=".66"></circle>' for r in (17, 28)
            )
            rays = []
            for k in range(8):
                a = math.pi * 2 * k / 8
                rays.append([(centre[0] + math.cos(a) * 8 * S,
                              centre[1] + math.sin(a) * 8 * S),
                             (centre[0] + math.cos(a) * 27 * S,
                              centre[1] + math.sin(a) * 27 * S)])
            pc.add("mark", rings,
                   line("".join(dpath(x) for x in rays), C["lot_line"],
                        1.1 * S, ' opacity=".54"'))

            lamps = [quad_at(p, .06, .94), quad_at(p, .94, .94)]
            bollards = [quad_at(p, u, .955) for u in (.08, .16, .84, .92)]
            racks = []
            for k in range(3):
                a = quad_at(p, .8 + k * .04, .29)
                b = quad_at(p, .8 + k * .04, .35)
                racks.append([a, b])
            pc.add("prop",
                   discs([(x + 1.2 * S, y + 1.4 * S, 4.7 * S) for x, y in lamps],
                         C["shadow"], ' opacity=".18"'),
                   discs([(x, y, 3.3 * S) for x, y in lamps], C["portico_arch"]),
                   discs([(x, y, 1.45 * S) for x, y in lamps], C["portico_col"]),
                   discs([(x, y, 2.2 * S) for x, y in bollards], C["portico_arch"]),
                   line("".join(dpath(x) for x in racks), C["ridge"], 2.2 * S,
                        ' opacity=".72"'))
    if cars:
        parking_marks = []
        lane_v = .12 if civic else .1
        for k in range(m + 2):
            u = .04 + k * .92 / (m + 1)
            parking_marks.append([quad_at(p, u, .045), quad_at(p, u, .235)])
        parking_marks.append([quad_at(p, .04, .235), quad_at(p, .96, .235)])
        arrow = [(0.47, .32), (.53, .32), (.53, .42), (.61, .42),
                 (.5, .54), (.39, .42), (.47, .42)]
        arrow_poly = [quad_at(p, u, v) for u, v in arrow]
        pc.add("mark",
               line("".join(dpath(x) for x in parking_marks), C["stripe"],
                    1.7 * S, ' opacity=".9"'),
               fill(dpath(arrow_poly, True), C["stripe"], ' opacity=".82"'))
        park_cars = []
        for k in range(m + 1):
            u = min(0.95, max(0.05, (k + 0.5) / (m + 1)))
            for v in ((lane_v,) if civic else (lane_v, 0.9)):
                if rnd.random() < (0.08 if civic else 0.18):
                    continue
                point = quad_at(p, u, v + rnd.uniform(-.012, .012))
                park_cars.append(plan_car_body(
                    point, quad_ang(p, u, v) + math.pi / 2,
                    C["car"][rnd.randrange(len(C["car"]))]))
        pc.add("prop", "".join(park_cars))
    return p


def school_building(pc, q):
    body_q = quad_cell(q, .07, .93, .07, .33)
    wing = quad_cell(q, .07, .3, .33, .86)
    pc.add("shadow", fill(multi([move(body_q, 3 * S, 4 * S), move(wing, 3 * S, 4 * S)]),
                          C["shadow"], ' opacity=".26"'))
    pc.add("build", roof_fill(multi([body_q, wing]), C["roof"][1]),
           line(dpath([quad_at(body_q, .02, .5), quad_at(body_q, .98, .5)])
                + dpath([quad_at(wing, .5, .02), quad_at(wing, .5, .98)]),
                C["ridge"], 1.7 * S, ' opacity=".8"'),
           ink(dpath(jit(body_q), True) + dpath(jit(wing), True), 0.44))


def school_yard(pc, q):
    yard = quad_cell(q, .33, .93, .37, .92)
    field = quad_cell(yard, .1, .9, .12, .88)
    cx, cy = centroid(field)
    pc.add("plot", fill(dpath(yard, True), C["lot"]), ink(dpath(jit(yard), True), 0.28))
    pc.add("mark",
           line(dpath(field, True), C["stripe"], 2.6 * S, ' opacity=".95"'),
           line(dpath([quad_at(field, .5, .02), quad_at(field, .5, .98)]),
                C["stripe"], 2.6 * S, ' opacity=".95"'),
           f'<circle cx="{n(cx)}" cy="{n(cy)}" r="{n(26 * S)}" fill="none"'
           f' stroke="{C["stripe"]}" stroke-width="{n(2.6 * S)}" opacity=".95"></circle>')
    return yard


def piazza(pc, q, clip_id):
    p = inset(q, 40 * S)
    cx, cy = centroid(p)
    rays = []
    for k in range(16):
        a = 2 * math.pi * k / 16
        rays.append([(cx + math.cos(a) * 24 * S, cy + math.sin(a) * 24 * S),
                     (cx + math.cos(a) * 300 * S, cy + math.sin(a) * 300 * S)])
    rings = "".join(f'<circle cx="{n(cx)}" cy="{n(cy)}" r="{n(rr * S)}" fill="none"'
                    f' stroke="{C["lot_line"]}" stroke-width="{n(2.2 * S)}"'
                    f' opacity=".9"></circle>' for rr in (58, 104, 150))
    pc.add("plot", fill(dpath(p, True), C["stone"]),
           f'<g clip-path="url(#{clip_id})">'
           + line("".join(dpath(x) for x in rays), C["lot_line"], 2 * S, ' opacity=".8"')
           + rings + "</g>",
           ink(dpath(jit(p), True), 0.32))
    pc.add("water",
           f'<circle cx="{n(cx)}" cy="{n(cy)}" r="{n(21 * S)}" fill="{C["water"]}"></circle>'
           f'<circle cx="{n(cx)}" cy="{n(cy)}" r="{n(12 * S)}" fill="{C["water_hi"]}"></circle>'
           f'<circle cx="{n(cx)}" cy="{n(cy)}" r="{n(21 * S)}" fill="none"'
           f' stroke="{C["stone"]}" stroke-width="{n(4 * S)}"></circle>')
    bol = [quad_at(p, k / 9, 0.03) for k in range(10)]
    bol += [quad_at(p, k / 9, 0.97) for k in range(10)]
    pc.add("prop", discs([(x, y, 2.6 * S) for x, y in bol], C["portico_col"],
                         ' opacity=".7"'))
    CLIPS.append(f'<clippath id="{clip_id}"><path d="{dpath(p, True)}"></path></clippath>')
    return p


def park_trail(p, walled=False):
    if walled:
        return (dpath([quad_at(p, .5, .06), quad_at(p, .5, .94)])
                + dpath([quad_at(p, .06, .5), quad_at(p, .94, .5)]))
    wa = Way([quad_at(p, .04, .3), quad_at(p, .34, .62), quad_at(p, .62, .28),
              quad_at(p, .96, .58)], per=7)
    wb = Way([quad_at(p, .3, .96), quad_at(p, .42, .58), quad_at(p, .7, .5),
              quad_at(p, .84, .06)], per=7)
    return dpath(wa.p) + dpath(wb.p)


def park(pc, q, tone=None, walled=False, pad=None, pond=True, layer="green",
         stagger=None, trail=True, tree_layer="trees"):
    pad = pad if pad is not None else 10 * S
    p = inset(q, pad)
    edge_poly = jit(smooth([p[0], lerp2(p[0], p[1], .5), p[1],
                            lerp2(p[1], p[2], .5), p[2],
                            lerp2(p[2], p[3], .5), p[3],
                            lerp2(p[3], p[0], .5), p[0]], per=5), 3.4)
    new = tree_layer == "newtree"
    pc.add(layer, fill(dpath(edge_poly, True),
                       tone or C["grass_new" if new else "grass"]),
           fill(dpath(inset(p, 22 * S), True),
                C["meadow_new" if new else "meadow"], ' opacity=".55"'),
           line(park_trail(p, walled), C["trail"], 9 * S, ' opacity=".95"') if trail else "",
           ink(dpath(edge_poly, True), 0.4 if walled else 0.24,
               w=3.2 * S if walled else None))
    if pond and area(p) > 12000:
        c = quad_at(p, .68, .72)
        pc.add("water" if layer == "green" else layer,
               fill(dpath(blob(c[0], c[1], 30 * S, lobes=8, rough=.26), True), C["water"]),
               fill(dpath(blob(c[0] - 3 * S, c[1] - 3 * S, 19 * S, lobes=7, rough=.22),
                          True), C["water_hi"], ' opacity=".65"'))

    edge = []
    for k in range(16):
        u = (k + rnd.uniform(-.3, .3)) / 16
        for v in (0.055, 0.945):
            e = quad_at(p, min(.97, max(.03, u)), v + rnd.uniform(-.02, .05) * (1 if v < .5 else -1))
            edge.append((e[0], e[1], rnd.uniform(6.5, 12)))
    inner = spots_in(p, max(6, int(area(p) / 2400)), (8, 15))
    if stagger:
        at, d, cls = stagger
        crowns(edge, at=at, d=d, step=15, chunk=4, layer=tree_layer, cls=cls)
        crowns(inner, at=at, d=d + 300, step=70, chunk=1, layer=tree_layer, cls=cls)
    else:
        pc.add(tree_layer, crowns_body(edge), crowns_body(inner))
    return p


PORTICO_DEPTH = 22 * S
PORTICO_STEP = 48 * S


def portico_geometry(w, t0, t1, half, sides=(-1, 1)):
    out = []
    for sgn in sides:
        bi = w.offset(sgn * half)
        bo = w.offset(sgn * (half + PORTICO_DEPTH))
        ipts, opts = bi.slice(t0, t1), bo.slice(t0, t1)
        band = ipts + list(reversed(opts))
        m = max(4, int(abs(t1 - t0) * w.L / PORTICO_STEP))
        arches, ribs, cols = [], [], []
        for k in range(m):
            ta = t0 + (t1 - t0) * k / m
            tb = t0 + (t1 - t0) * (k + 1) / m
            tm = (ta + tb) / 2
            ao, ai = bo.at(ta), bi.at(ta)
            bo_, bi_ = bo.at(tb), bi.at(tb)
            a = lerp2(ao, ai, 0.08)
            b = lerp2(bo_, bi_, 0.08)
            ctrl = lerp2(bo.at(tm), bi.at(tm), 0.66)
            arches.append(
                f"M{n(a[0])} {n(a[1])}Q{n(ctrl[0])} {n(ctrl[1])} "
                f"{n(b[0])} {n(b[1])}"
            )
            if k == 0:
                cols.append(a)
                ribs.append(dpath([a, lerp2(ao, ai, .74)]))
            cols.append(b)
            ribs.append(dpath([b, lerp2(bo_, bi_, .74)]))
        midline = [lerp2(op, ip, .5) for op, ip in zip(opts, ipts)]
        out.append((band, "".join(arches), "".join(ribs), cols,
                    ipts, opts, midline))
    return out


def portico(w, t0, t1, half, at=0, d=0, sides=(-1, 1)):
    pc = Piece(at=at, d=d)
    for band, arches, ribs, cols, ipts, opts, midline in portico_geometry(
            w, t0, t1, half, sides=sides):
        outer_cols = [(x, y, 5.6 * S) for x, y in cols]
        inner_cols = [(x, y, 3.1 * S) for x, y in cols]
        pc.add("portico",
               fill(dpath(band, True), C["portico"]),
               fill(dpath(band, True), C["shade"], ' opacity=".13"'),
               line(dpath(midline), C["trail"], 2 * S,
                    f' stroke-dasharray="{n(10 * S)} {n(13 * S)}" opacity=".72"'),
               line(dpath(opts), C["portico_arch"], 1.6 * S, ' opacity=".62"'),
               line(ribs, C["portico_arch"], 1.35 * S, ' opacity=".48"'),
               line(arches, C["portico_arch"], 3.1 * S, ' opacity=".94"'),
               discs(outer_cols, C["portico_arch"]),
               discs(inner_cols, C["portico_col"]),
               ink(dpath(jit(ipts, .5)) + dpath(jit(opts, .45)), 0.38))
    pc.flush()


def portico_beam(w, t0, t1, half, sides=(-1, 1)):
    return portico_geometry(w, t0, t1, half, sides=sides)



CELLS = {}
CLIPS = []

SITE_AT = {C1: 2, C2: 3, C3: 3}

for lad in CENTRO:
    tag, cols, rows = lad["tag"], lad["cols"], lad["rows"]
    for i in range(cols):
        for j in range(len(rows) - 1):
            q = centro_cell(lad, i, j)
            if not on_plan(q):
                continue
            CELLS[(tag, i, j)] = q
            kind = SPECIAL.get((tag, i, j)) or CENTRO_FABRIC[tag][j][i]
            pc = Piece(at=0, d=700 + j * 60 + i * 34)
            if kind == "piazza":
                piazza(pc, q, f"pl-piazza-{tag}{i}{j}")
            elif kind == "garden":
                park(pc, q, tone=C["grass_dk"], walled=True, pond=False)
            elif kind == "church":
                block_church(pc, q)
            elif kind == "courts":
                block_courts(pc, q)
            elif kind == "public":
                block_public(pc, q)
            elif kind == "market":
                block_market(pc, q)
            elif kind == "allotments":
                block_allotments(pc, q)
            elif kind == "corte":
                block_corte(pc, q)
            elif kind == "open_u":
                block_open(pc, q, "u")
            elif kind == "open_l":
                block_open(pc, q, "l")
            elif kind == "mixed":
                block_open(pc, q, "mixed")
            elif kind == "palazzo":
                block_palazzo(pc, q)
            elif kind == "terraces":
                block_terraces(pc, q)
            pc.flush()

for i in range(len(PER_COLS) - 1):
    for j in range(len(PER_ROWS) - 1):
        q = per_cell(i, j)
        if not on_plan(q):
            continue
        CELLS[("per", i, j)] = q
        kind = SPECIAL.get(("per", i, j)) or per_fabric_kind(i, j)
        d = 760 + i * 34 + j * 70
        pc = Piece(at=0, d=d)
        if kind == "park":
            park(pc, q)
        elif kind == "shed":
            block_shed(pc, q)
        elif kind == "villini":
            block_villini(pc, q)
        elif kind == "courts":
            block_courts(pc, q)
        elif kind == "public":
            block_public(pc, q)
        elif kind == "corte":
            block_corte(pc, q, depth=52 * S)
        elif kind == "open_u":
            block_open(pc, q, "u")
        elif kind == "open_l":
            block_open(pc, q, "l")
        elif kind == "mixed":
            block_open(pc, q, "mixed")
        elif kind == "palazzo":
            block_palazzo(pc, q)
        elif kind == "terraces":
            block_terraces(pc, q)
        elif kind == "apartments":
            block_apartments(pc, q)
        elif kind == "bars":
            block_bars(pc, q, rows=1)
        elif kind == "parking":
            parking(pc, q)
        elif kind == "lot":
            parking(pc, q, cars=False, civic=True)
            pc.flush()
            pc = Piece(at=0, d=d + 40, until=SITE_AT[C1])
            parking(pc, q, cars=True, civic=True, surface=False)
        elif kind == "school":
            school_building(pc, q)
            pc.flush()
            pc = Piece(at=0, d=d + 40, until=SITE_AT[C2])
            school_yard(pc, q)
        pc.flush()

_A_ROWS = CENTRO[0]["rows"]
_D_ROWS = CENTRO[1]["rows"]
_B_ROWS = CENTRO[2]["rows"]
PORTICO_RUNS = [
    (RA, _D_ROWS[0] + .012, _D_ROWS[3] - .012, 36 * S, (1,)),
    (RA, _A_ROWS[1] + .012, _A_ROWS[2] - .012, 36 * S, (-1,)),
    (RA, _A_ROWS[3] + .012, _A_ROWS[4] - .012, 36 * S, (-1,)),
    (RB, max(_A_ROWS[0], _B_ROWS[0]) + .012,
     min(_A_ROWS[4], _B_ROWS[4]) - .012, 34 * S, (-1, 1)),
]
for _lad in CENTRO[:1]:
    for _j in (1, 3):
        _pa = _lad["a"].at(_lad["rows"][_j])
        _pb = _lad["b"].at(_lad["rows"][_j])
        _w = Way([lerp2(_pa, _pb, -0.06), lerp2(_pa, _pb, 0.5),
                  lerp2(_pa, _pb, 1.06)], per=8)
        PORTICO_RUNS.append((_w, 0.29, 0.93, 25 * S, (-1, 1)))

for _k, (_w, _t0, _t1, _h, _sides) in enumerate(PORTICO_RUNS):
    portico(_w, _t0, _t1, _h, at=0, d=1000 + _k * 60, sides=_sides)


COVER_R = 405
cell_c = lambda key: centroid(CELLS[key])
COVER_OLD = [cell_c(P1), cell_c(P2)]
COVER_NEW = [cell_c(C1), cell_c(C2), cell_c(C3)]
RECT_D = (f"M{-BLEED} {-BLEED}H{W + BLEED}V{H + BLEED}H{-BLEED}Z")


def wash(spots, at, until, tag, k=1.0):
    body = []
    for f, op in ((1.0, 0.07 * k), (0.86, 0.058 * k), (0.7, 0.05 * k)):
        holes = "".join(circle_d(x, y, COVER_R * f) for x, y in spots)
        body.append(f'<path d="{RECT_D}{holes}" fill="{C["warm"]}"'
                    f' fill-rule="evenodd" opacity="{op:.3f}"></path>')
    put("wash", "".join(body), at=at, until=until, cls=f"pl-wash pl-wash--{tag}")


wash(COVER_OLD, 1, 2, "a")
wash(COVER_OLD + COVER_NEW, 6, None, "b", k=0.55)

for at, spots in ((1, COVER_OLD), (6, COVER_OLD + COVER_NEW)):
    for k, (x, y) in enumerate(spots):
        put("wash", f'<circle cx="{n(x)}" cy="{n(y)}" r="{COVER_R}" fill="none"'
                    f' stroke="{C["shade"]}" stroke-width="3"'
                    f' stroke-dasharray="13 24" opacity=".34"></circle>',
            at=at, until=2 if at == 1 else None, d=k * 200, cls="pl-ring")


for k, key in enumerate((C1, C2, C3)):
    p = inset(CELLS[key], 7 * S)
    put("site", f'<path d="{dpath(p, True)}" fill="none" stroke="{C["amber"]}"'
                f' stroke-width="{n(5 * S)}"'
                f' stroke-dasharray="{n(17 * S)} {n(12 * S)}" opacity=".9"'
                f' pathlength="1"></path>',
        at=1, until=SITE_AT[key], d=280 + k * 180, cls="pl-site")

def works(cell, at, until, d):
    pc = Piece(at=at, until=until, d=d)
    bars, marks = [], []
    for u in (0.2, 0.62):
        pt = quad_at(cell, u, 0.06)
        bars.append(oct_at(pt, quad_ang(cell, u), 34 * S, 4.4 * S, cut=0))
        marks.append(oct_at(pt, quad_ang(cell, u), 34 * S, 1.6 * S, cut=0))
    pc.add("newgreen", fill(multi(bars), C["works"]),
           fill(multi(marks), C["stripe"], ' opacity=".8"'))
    pc.flush()


def new_park(cell, at, d, pond):
    p = inset(cell, 10 * S)
    pc = Piece(at=at, d=d + 250)
    pc.add("newgreen", fill(dpath(jit(p, 2.4), True), C["soil"]),
           ink(dpath(jit(p), True), 0.3))
    pc.flush()

    pc = Piece(at=at, d=d + 700)
    p = park(pc, cell, layer="newgreen", pond=False, trail=False,
             stagger=(at, d + 1550, "pl-tree pl-pop"), tree_layer="newtree")
    pc.flush()

    pc = Piece(at=at, d=d + 1050)
    pc.add("newgreen", line(park_trail(p), C["trail"], 9 * S, ' opacity=".95"'))
    pc.flush()

    pc = Piece(at=at, d=d + 1300)
    rain = quad_cell(p, .12, .46, .68, .93)
    pc.add("newgreen",
           fill(dpath(jit(rain, 2), True), C["water_new"], ' opacity=".85"'),
           ink(dpath(jit(rain), True), 0.24))
    if pond:
        c = quad_at(p, .72, .3)
        pc.add("newgreen",
               fill(dpath(blob(c[0], c[1], 26 * S, lobes=8, rough=.26), True),
                    C["water_new"]),
               fill(dpath(blob(c[0] - 3 * S, c[1] - 3 * S, 16 * S, lobes=7, rough=.22),
                          True), C["water_new_hi"], ' opacity=".65"'))
    pc.flush()

    works(cell, at=at, until=at + 1, d=d + 120)


def new_square(cell, at, d):
    p = inset(cell, 11 * S)
    bed_a = quad_cell(p, .07, .43, .1, .42)
    bed_b = quad_cell(p, .6, .94, .53, .91)

    pc = Piece(at=at, d=d + 250)
    meadow_a = quad_cell(bed_a, .12, .88, .18, .78)
    meadow_b = quad_cell(bed_b, .1, .9, .12, .55)
    pc.add("newgreen",
           fill(dpath(jit(bed_a, 2), True), C["grass_new"]),
           fill(dpath(jit(bed_b, 2), True), C["grass_new"]),
           fill(dpath(jit(meadow_a, 1.2), True), C["meadow_new"], ' opacity=".7"'),
           fill(dpath(jit(meadow_b, 1.2), True), C["meadow_new"], ' opacity=".66"'),
           ink(dpath(jit(bed_a), True) + dpath(jit(bed_b), True), 0.26))
    pc.flush()

    rain = quad_cell(bed_b, .12, .88, .46, .9)
    pc = Piece(at=at, d=d + 760)
    pc.add("newgreen",
           fill(dpath(jit(rain, 1.6), True), C["water_new"], ' opacity=".86"'),
           ink(dpath(jit(rain), True), 0.24))
    rain_stones = []
    for u, v in ((.08, .2), (.18, .86), (.42, .08), (.7, .9), (.92, .34)):
        x, y = quad_at(rain, u, v)
        rain_stones.append((x, y, rnd.uniform(2.4, 3.8) * S))
    pc.add("newgreen", discs(rain_stones, C["lot_line"], ' opacity=".78"'))
    centre = quad_at(p, .5, .45)
    jets = []
    for k in range(6):
        a = math.pi * 2 * k / 6
        jets.append((centre[0] + math.cos(a) * 10 * S,
                     centre[1] + math.sin(a) * 10 * S, 2.2 * S))
    pc.add("newgreen",
           f'<circle cx="{n(centre[0] + 1.5 * S)}" cy="{n(centre[1] + 1.8 * S)}"'
           f' r="{n(27 * S)}" fill="{C["shadow"]}" opacity=".16"></circle>',
           f'<circle cx="{n(centre[0])}" cy="{n(centre[1])}" r="{n(18 * S)}"'
           f' fill="{C["water_new_hi"]}" opacity=".8"></circle>',
           f'<circle cx="{n(centre[0])}" cy="{n(centre[1])}" r="{n(25 * S)}"'
           f' fill="none" stroke="{C["portico_col"]}" stroke-width="{n(6 * S)}"></circle>',
           discs(jets, C["portico_col"], ' opacity=".88"'))
    pc.flush()

    spots = []
    for u, v in ((.14, .19), (.35, .27), (.68, .62), (.87, .6)):
        x, y = quad_at(p, u, v)
        spots.append((x, y, 15 * S))
    pc = Piece(at=at, d=d + 1030)
    pc.add("newgreen",
           discs([(x, y, 17 * S) for x, y, _ in spots], C["soil"], ' opacity=".72"'),
           discs([(x, y, 12 * S) for x, y, _ in spots], C["grass_new"]))
    pc.flush()
    crowns(spots, at=at, d=d + 1120, step=150, chunk=1,
           layer="newtree", cls="pl-tree pl-pop")

    pergola_q = quad_cell(p, .08, .43, .58, .86)
    slats = [[quad_at(pergola_q, u, .04), quad_at(pergola_q, u, .96)]
             for u in (.05, .2, .35, .5, .65, .8, .95)]
    posts = [pergola_q[0], pergola_q[1], pergola_q[2], pergola_q[3]]
    benches = []
    for u, v, turn in ((.48, .77, 0), (.52, .16, 0), (.88, .27, math.pi / 2)):
        point = quad_at(p, u, v)
        benches.append(oct_at(point, quad_ang(p, u, v) + turn,
                              25 * S, 7 * S, cut=.16))
    pc = Piece(at=at, d=d + 1540)
    pc.add("newtree",
           fill(dpath(pergola_q, True), C["shade"], ' opacity=".14"'),
           line("".join(dpath(x) for x in slats), C["ridge"], 2.5 * S,
                ' opacity=".72"'),
           ink(dpath(pergola_q, True), .34),
           discs([(x, y, 3.4 * S) for x, y in posts], C["ridge"]),
           fill(multi([move(b, 1.4 * S, 1.8 * S) for b in benches]),
                C["shadow"], ' opacity=".18"'),
           fill(multi(benches), C["portico"]),
           ink("".join(dpath(b, True) for b in benches), .34))
    pc.flush()
    works(cell, at=at, until=at + 1, d=d + 80)


def new_shade(cell, at, d):
    p = inset(cell, 46 * S)
    band = quad_cell(p, .52, .95, .70, .94)
    pc = Piece(at=at, d=d)
    pc.add("newgreen", fill(dpath(jit(band, 2), True), C["grass_new"]),
           fill(dpath(jit(quad_cell(band, .05, .95, .18, .72), 1.1), True),
                C["meadow_new"], ' opacity=".68"'),
           ink(dpath(jit(band), True), 0.24))
    pc.flush()

    spots = [(*quad_at(p, u, .82), 11 * S) for u in (.54, .75, .95)]
    pc = Piece(at=at, d=d + 250)
    pc.add("newgreen",
           discs([(x, y, 13 * S) for x, y, _ in spots], C["soil"], ' opacity=".7"'),
           discs([(x, y, 9 * S) for x, y, _ in spots], C["grass_new"]))
    pc.flush()
    crowns(spots, at=at, d=d + 420, step=130, chunk=1,
           layer="newtree", cls="pl-tree pl-pop")

    pergola_q = quad_cell(p, .04, .34, .08, .34)
    slats = [[quad_at(pergola_q, u, .05), quad_at(pergola_q, u, .95)]
             for u in (.05, .23, .41, .59, .77, .95)]
    benches = []
    for u, v in ((.13, .15), (.24, .26)):
        point = quad_at(p, u, v)
        benches.append(oct_at(point, quad_ang(p, u, v),
                              18 * S, 5.5 * S, cut=.16))
    pc = Piece(at=at, d=d + 980)
    pc.add("newshade",
           fill(dpath(pergola_q, True), C["shade"], ' opacity=".15"'),
           line("".join(dpath(x) for x in slats), C["ridge"], 2.5 * S,
                ' opacity=".74"'),
           ink(dpath(pergola_q, True), .34),
           discs([(x, y, 3.4 * S) for x, y in pergola_q], C["ridge"]),
           fill(multi([move(b, 1.4 * S, 1.8 * S) for b in benches]),
                C["shadow"], ' opacity=".18"'),
           fill(multi(benches), C["portico"]),
           ink("".join(dpath(b, True) for b in benches), .34))
    pc.flush()


new_square(CELLS[C1], at=SITE_AT[C1], d=850)
bus_bay(PER_OFF[1], (PER_COLS[3] + PER_COLS[4]) / 2,
        -38 * S, at=SITE_AT[C1], d=2500)
new_park(quad_cell(CELLS[C2], .3, .96, .34, .95), at=SITE_AT[C2], d=120, pond=False)
new_shade(CELLS[C3], at=SITE_AT[C3], d=520)


ROW1 = PER_OFF[1]
GATE = Way([PER_OFF[k].at(PORTA_A) for k in range(len(PER_OFF) - 1, -1, -1)], per=9)
GATE_T0 = 1 - 1 / (len(PER_ROWS) - 1)
ROUTE = []
for seg in (ROW1.slice(PER_COLS[9], PER_COLS[3]),
            GATE.slice(GATE_T0, 1.0),
            RA.slice(RA.t_out(PER_ROWS[0]), 0.985)):
    ROUTE += seg[1:] if ROUTE and dist(ROUTE[-1], seg[0]) < 30 else seg
ROUTE_D = dpath(Way(ROUTE, per=1).p)

put("corridor", "".join(
    f'<path class="pl-shade" d="{ROUTE_D}" fill="none" stroke="{C["shade"]}"'
    f' stroke-width="{n(wd * S)}" stroke-linecap="round" stroke-linejoin="round"'
    f' opacity="{op}" pathlength="1"></path>'
    for wd, op in ((100, 0.09), (72, 0.1), (46, 0.11))), at=4, cls="pl-sweep")

for _t0, _t1, _off, _d in (
        (PER_COLS[9], .63, 30 * S, 140),
        (.54, .45, 30 * S, 330),
        (.37, PER_COLS[3], 30 * S, 540),
        (PER_COLS[9] - .006, .58, -30 * S, 220),
        (.50, .41, -30 * S, 430),
        (.33, PER_COLS[3] + .006, -30 * S, 640)):
    crowns(row_spots(ROW1, _t0, _t1, _off, 39 * S), at=4, d=_d, step=42, chunk=1,
           layer="corridor", cls="pl-tree pl-pop")

corridor_pergola(ROW1, .62, .55, 30 * S, 21 * S, at=4, d=390)
corridor_pergola(ROW1, .40, .34, -30 * S, 21 * S, at=4, d=690)

for _t0, _t1, _off, _d in (
        (GATE_T0 + .03, .865, 23 * S, 760),
        (.925, .96, 23 * S, 980),
        (GATE_T0 + .03, .89, -23 * S, 820),
        (.925, .96, -23 * S, 1040)):
    crowns(row_spots(GATE, _t0, _t1, _off, 37 * S), at=4, d=_d, step=46,
           chunk=1, layer="corridor", cls="pl-tree pl-pop")
corridor_pergola(GATE, .875, .92, 23 * S, 19 * S, at=4, d=920)

for _k, (_w, _t0, _t1, _h, _sides) in enumerate(PORTICO_RUNS):
    pc = Piece(at=5, d=_k * 200)
    for (_band, _arches, _ribs, _cols, _facade,
         _outside, _midline) in portico_beam(
             _w, _t0, _t1, _h, sides=_sides):
        pc.add(
            "porticoCutaway",
            fill(dpath(_band, True), PAPER, ' opacity=".58"'),
            fill(dpath(_band, True), C["portico"], ' opacity=".24"'),
            line(dpath(_facade) + dpath(_outside), C["portico_arch"], 1.45 * S,
                 f' stroke-dasharray="{n(7 * S)} {n(7 * S)}" opacity=".68"'),
            line(dpath(_midline), C["trail"], 2.4 * S,
                 f' stroke-dasharray="{n(10 * S)} {n(13 * S)}" opacity=".86"'),
            line(_ribs, C["portico_arch"], 1.35 * S, ' opacity=".58"'),
            line(_arches, C["portico_arch"], 2.8 * S, ' opacity=".82"'),
            discs([(x, y, 4.8 * S) for x, y in _cols], C["portico_arch"],
                  ' opacity=".82"'),
            discs([(x, y, 2.5 * S) for x, y in _cols], C["portico_col"]),
        )
    pc.flush(cls="pl-portico-on")

put("route", f'<path class="pl-route-line" d="{ROUTE_D}" fill="none"'
             f' stroke="{C["shade"]}" stroke-width="{n(8 * S)}"'
             f' stroke-linecap="round" stroke-linejoin="round" opacity=".78"'
             f' pathlength="1"></path>'
             f'<path class="pl-route-dash" d="{ROUTE_D}" fill="none"'
             f' stroke="#F7F5EC" stroke-width="{n(3 * S)}" stroke-linecap="round"'
             f' stroke-dasharray="{n(11 * S)} {n(15 * S)}" opacity=".85"></path>',
    at=6, cls="pl-sweep")
for k, key in enumerate((P1, C2, C1, C3, P2)):
    x, y = cell_c(key)
    put("route", f'<circle cx="{n(x)}" cy="{n(y)}"'
                 f' r="{n(13 * S)}" fill="#F7F5EC"'
                 f' stroke="{C["shade"]}" stroke-width="{n(4.4 * S)}"></circle>',
        at=6, d=520 + k * 120, cls="pl-node")


CORRIDOR_ANCHOR = centroid([cell_c(C1), cell_c(C2), VIALE.at(PORTA_A), cell_c(P1)])

ANCHORS = {
    "parco": cell_c(P1), "giardino": cell_c(P2), "piazzale": cell_c(C1),
    "scuola": cell_c(C2), "piazza": cell_c(C3),
    "portaA": VIALE.at(PORTA_A), "portaB": VIALE.at(PORTA_B),
    "viale": VIALE.at(0.42), "portico": RA.at((RA.tg + 1) / 2),
    "corridoio": (CORRIDOR_ANCHOR[0], CORRIDOR_ANCHOR[1] + 120 * S),
    "centro": centroid(CELLS[("A", 1, 1)]),
}

TITLE = ("Un pezzo di Bologna visto dall'alto: il viale di circonvallazione con "
         "l'aiuola alberata, il centro con piazze, palazzi a corte, fronti aperti "
         "e due strade porticate. Fuori, una periferia diversa per densita', con "
         "condomini, case a schiera, villini, laboratori, una piazza lastricata "
         "usata come parcheggio e il cortile d'asfalto di una scuola. "
         "Scorrendo, la piazza mantiene il suo centro lastricato ma apre aiuole "
         "permeabili, acqua e ombra, mentre il cortile diventa piu' verde. Una "
         "fermata, gruppi di alberi, pergolati e portici li uniscono in una "
         "fascia d'ombra continua che attraversa la mappa dal parco al giardino.")

svg = "".join([
    f'<svg role="img" viewbox="0 0 {W} {H}"'
    ' preserveaspectratio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">',
    f"<desc>{TITLE}</desc>",
    f"<defs>{''.join(DEFS_PATHS)}{''.join(CLIPS)}</defs>",
    "".join(f'<g class="pl-l pl-l--{k}">{merged(k)}</g>' for k in LAYERS),
    "</svg>",
])

HEAD = '''// AUTO-GENERATO da `scripts/build_city_plan.py` — non modificare a mano.
// I colori premiscelati evitano buffer fuori schermo durante i movimenti di camera.
// `data-at`, `data-until` e `--d` sono il contratto di animazione con CityPlanScene.
'''

here = os.path.dirname(os.path.abspath(__file__))
out = os.path.normpath(os.path.join(here, "..", "src", "data", "cityPlan.js"))
anchors = ",\n".join(f"  {k}: [{v[0]:.0f}, {v[1]:.0f}]" for k, v in ANCHORS.items())
io.open(out, "w", encoding="utf-8").write(
    HEAD
    + f"export const PLAN_W = {W};\n"
    + f"export const PLAN_H = {H};\n"
    + f"export const PLAN_BEATS = {BEATS};\n\n"
    + "export const PLAN_ANCHORS = {\n" + anchors + ",\n};\n\n"
    + "export const cityPlanSvg = `\n" + svg + "\n`;\n"
)
print(f"{sum(len(v) for v in BAG.values())} pezzi, {len(svg) // 1024} KB -> {out}")

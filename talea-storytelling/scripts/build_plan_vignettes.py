# -*- coding: utf-8 -*-
"""Generate deterministic CityPlan close-up vignettes; see DATA_SOURCES D17."""
import io
import json
import math
import os

# Must match the projection used by build_cast_figures.mjs.
U = 46.0

C30 = math.cos(math.radians(30))
S30 = math.sin(math.radians(30))

LIGHT = (0.62, 0.46)
SHADOW = 0.5

EXT = [1e9, 1e9, -1e9, -1e9]


def iso(x, y, z=0.0):
    """Project world coordinates into the shared isometric view."""
    sx = (x - y) * C30 * U
    sy = ((x + y) * S30 - z) * U
    EXT[0] = min(EXT[0], sx)
    EXT[1] = min(EXT[1], sy)
    EXT[2] = max(EXT[2], sx)
    EXT[3] = max(EXT[3], sy)
    return (sx, sy)


def n(v):
    s = f"{v:.1f}"
    return s[:-2] if s.endswith(".0") else s


def d_of(pts, close=True):
    return ("M" + "L".join(f"{n(px)} {n(py)}" for px, py in pts)
            + ("Z" if close else ""))


def curve_d(pts, close=True):
    """Use Catmull-Rom curves for organic tree and hedge outlines."""
    m = len(pts)
    if m < 3:
        return d_of(pts, close)
    out = [f"M{n(pts[0][0])} {n(pts[0][1])}"]
    for i in range(m if close else m - 1):
        p0, p1 = pts[(i - 1) % m], pts[i % m]
        p2, p3 = pts[(i + 1) % m], pts[(i + 2) % m]
        out.append("C%s %s,%s %s,%s %s" % (
            n(p1[0] + (p2[0] - p0[0]) / 6), n(p1[1] + (p2[1] - p0[1]) / 6),
            n(p2[0] - (p3[0] - p1[0]) / 6), n(p2[1] - (p3[1] - p1[1]) / 6),
            n(p2[0]), n(p2[1])))
    return "".join(out) + ("Z" if close else "")


def poly(pts3, close=True):
    return d_of([iso(*p) for p in pts3], close)


def hull(pts):
    pts = sorted(set((round(x, 2), round(y, 2)) for x, y in pts))
    if len(pts) < 3:
        return pts

    def half(seq):
        out = []
        for p in seq:
            while len(out) >= 2:
                (ax, ay), (bx, by) = out[-2], out[-1]
                if (bx - ax) * (p[1] - ay) - (by - ay) * (p[0] - ax) > 0:
                    break
                out.pop()
            out.append(p)
        return out

    return half(pts)[:-1] + half(pts[::-1])[:-1]


C = dict(
    ink="#3A352A",
    ground="#EAE3D0",
    asphalt="#C8BEA6", asphalt_line="#E8E1CE",
    soil="#B08E63",
    stone="#EFE7D4", stone_side="#CDC2A6",
    wall="#E6DBC3", wall_side="#D3C6A9",
    win="#6E7B84", win_hi="#98A6AD", sill="#EFE9DA",
    shutter="#9AA087", shutter_dk="#7C8269",
    door="#7A6647", shopwin="#8FA0A6",
    roof="#C9975F", roof_back="#A87B4C", roof_ridge="#8E6437",
    roof_side="#A9784A", cornice="#DACDB0",
    pier="#E2D7BC", pier_side="#C9BC99", pier_dark="#AC9E7B",
    vault="#DCD1B4", vault_dk="#C4B795", arch_ring="#F3ECD8",
    shade="#2C5A3B",
    grass="#A8C58C", meadow="#C2D8A6",
    hedge="#6E9457", hedge_dk="#557740", hedge_hi="#8CB073",
    vine=["#8AAE64", "#9CBD76"],
    crown=["#4F7A3E", "#5F8C4C", "#78A263"], crown_hi="#96BC7B",
    trunk="#8E7250", trunk_dk="#6C5636",
    water="#A9C8D6", water_hi="#C9E1EA", gravel="#CFC5AC",
    works="#D9902F", works_dk="#A8681C",
    pergola="#C6B48C", pergola_dk="#A6916A",
    car=["#8FA3AE", "#B9836A", "#93A183", "#A8A296"],
)

CAST = json.load(io.open(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "cast_figures.json"),
    encoding="utf-8"))

PLACED = []

BAG = []


def put(step, colour="", ink_d="", cls="", order=50, gone_at=None):
    """Emit colour below linework; CSS times each data-step group."""
    if not colour and not ink_d:
        return
    body = ""
    if colour:
        body += f'<g class="pv-c">{colour}</g>'
    if ink_d:
        body += f'<g class="pv-l"><path d="{ink_d}" pathlength="1"></path></g>'
    attrs = [f'class="pv-i{(" " + cls) if cls else ""}"',
             f'data-step="{step}"']
    if gone_at is not None:
        attrs.append(f'data-gone-step="{gone_at}"')
    BAG.append((order, len(BAG), f'<g {" ".join(attrs)}>{body}</g>'))


def depth_order(x, y, bias=0):
    """Sort isometric volumes back-to-front for painter rendering."""
    return 40 + (x + y) * 2.1 + bias


def fill(d, colour, extra=""):
    return f'<path d="{d}" fill="{colour}"{extra}></path>'


def cast(x0, y0, x1, y1, h, opacity=0.13):
    """Build a cast shadow from the hull of an outline and its translated copy."""
    dx, dy = LIGHT[0] * h * SHADOW, LIGHT[1] * h * SHADOW
    base = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
    pts = [iso(px, py, 0) for px, py in base]
    pts += [iso(px + dx, py + dy, 0) for px, py in base]
    return fill(d_of(hull(pts)), C["ink"], f' opacity="{opacity}"')


def box(x0, y0, x1, y1, h, top, right, left, base=0.0):
    z1 = base + h
    t = [(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    colour = (fill(poly(t), top)
              + fill(poly([(x1, y0, z1), (x1, y1, z1), (x1, y1, base), (x1, y0, base)]),
                     right)
              + fill(poly([(x0, y1, z1), (x1, y1, z1), (x1, y1, base), (x0, y1, base)]),
                     left))
    edges = (poly(t)
             + d_of([iso(x1, y0, z1), iso(x1, y0, base)], False)
             + d_of([iso(x1, y1, z1), iso(x1, y1, base)], False)
             + d_of([iso(x0, y1, z1), iso(x0, y1, base)], False)
             + d_of([iso(x0, y1, base), iso(x1, y1, base)], False)
             + d_of([iso(x1, y1, base), iso(x1, y0, base)], False))
    return colour, edges


def roof(x0, y0, x1, y1, h, rise=None, ov=0.3, chimney=True):
    xa, xb, ya, yb = x0 - ov, x1 + ov, y0 - ov, y1 + ov
    along_x = (x1 - x0) >= (y1 - y0)
    short = (y1 - y0) if along_x else (x1 - x0)
    rise = rise if rise is not None else min(1.5, short * 0.42 + 0.25)
    zr = h + rise
    colour, edges = [], []

    if along_x:
        ym = (ya + yb) / 2
        far = [(xa, ya, h), (xb, ya, h), (xb, ym, zr), (xa, ym, zr)]
        near = [(xa, ym, zr), (xb, ym, zr), (xb, yb, h), (xa, yb, h)]
        gable = [(xb, ya, h), (xb, ym, zr), (xb, yb, h)]
        ridge_a, ridge_b = (xa, ym, zr), (xb, ym, zr)
        courses = [[iso(xa, ym + (yb - ym) * u, zr - rise * u),
                    iso(xb, ym + (yb - ym) * u, zr - rise * u)] for u in (.3, .58, .84)]
    else:
        xm = (xa + xb) / 2
        far = [(xa, ya, h), (xm, ya, zr), (xm, yb, zr), (xa, yb, h)]
        near = [(xm, ya, zr), (xb, ya, h), (xb, yb, h), (xm, yb, zr)]
        gable = [(xa, yb, h), (xm, yb, zr), (xb, yb, h)]
        ridge_a, ridge_b = (xm, ya, zr), (xm, yb, zr)
        courses = [[iso(xm + (xb - xm) * u, ya, zr - rise * u),
                    iso(xm + (xb - xm) * u, yb, zr - rise * u)] for u in (.3, .58, .84)]

    colour.append(fill(poly(far), C["roof_back"]))
    colour.append(fill(poly(near), C["roof"]))
    colour.append(f'<path d="{"".join(d_of(c, False) for c in courses)}" fill="none"'
                  f' stroke="{C["roof_ridge"]}" stroke-width="1.4" opacity=".3"></path>')
    if along_x:
        cr, ce = box(xa, ridge_a[1] - .09, xb, ridge_a[1] + .09, 0.13,
                     C["roof_ridge"], C["roof_ridge"], C["roof_ridge"], base=zr - .06)
    else:
        cr, ce = box(ridge_a[0] - .09, ya, ridge_a[0] + .09, yb, 0.13,
                     C["roof_ridge"], C["roof_ridge"], C["roof_ridge"], base=zr - .06)
    colour.append(cr)
    colour.append(fill(poly(gable), C["wall_side"]))
    edges.append(d_of([iso(xa, ya, h), iso(xb, ya, h), iso(xb, yb, h),
                       iso(xa, yb, h)], False))
    edges.append(d_of([iso(*ridge_a), iso(*ridge_b)], False))
    edges.append(poly(gable, False))
    edges.append(ce)

    if chimney and max(x1 - x0, y1 - y0) > 2.4:
        if along_x:
            cx, cy = x0 + (x1 - x0) * 0.74, (ya + yb) / 2
        else:
            cx, cy = (xa + xb) / 2, y0 + (y1 - y0) * 0.26
        cc, cce = box(cx - .21, cy - .21, cx + .21, cy + .21, rise + 0.75,
                      C["stone"], C["wall_side"], C["stone_side"], base=h)
        colour.append(cc)
        edges.append(cce)
        cp, cpe = box(cx - .3, cy - .3, cx + .3, cy + .3, 0.14, C["stone_side"],
                      C["stone_side"], C["stone_side"], base=h + rise + 0.75)
        colour.append(cp)
        edges.append(cpe)
    return "".join(colour), "".join(edges)


def facade(x0, y0, x1, y1, h, step, floors=4, ground_h=0.0, pitched=True,
           shutters=True, order=50):
    body = [cast(x0, y0, x1, y1, h + 1.1)]
    c, e = box(x0, y0, x1, y1, h, C["roof"], C["wall_side"], C["wall"])
    body.append(c)
    edges = [e]
    cc, ce = box(x0 - 0.22, y0 - 0.22, x1 + 0.22, y1 + 0.22, 0.38,
                 C["cornice"], C["roof_side"], C["cornice"], base=h - 0.38)
    body.append(cc)
    edges.append(ce)

    wins, sills, shut, glints = [], [], [], []
    top = h - 1.0
    span = top - ground_h
    if span > 1.2:
        for f in range(floors):
            wz = ground_h + span * (f + 0.26) / floors
            wh = min(1.45, span / floors * 0.54)
            m = max(2, int((x1 - x0) / 2.2))
            for k in range(m):
                wx = x0 + (x1 - x0) * (k + 0.3) / m
                ww = (x1 - x0) / m * 0.38
                wins.append(poly([(wx, y1, wz), (wx + ww, y1, wz),
                                  (wx + ww, y1, wz + wh), (wx, y1, wz + wh)]))
                glints.append(poly([(wx, y1, wz + wh * 0.62), (wx + ww, y1, wz + wh),
                                    (wx, y1, wz + wh)]))
                sills.append(poly([(wx - 0.11, y1, wz - 0.16),
                                   (wx + ww + 0.11, y1, wz - 0.16),
                                   (wx + ww + 0.11, y1, wz - 0.02),
                                   (wx - 0.11, y1, wz - 0.02)]))
                if shutters and ww > 0.5:
                    for sx in (wx - 0.24, wx + ww + 0.02):
                        shut.append(poly([(sx, y1, wz), (sx + 0.22, y1, wz),
                                          (sx + 0.22, y1, wz + wh), (sx, y1, wz + wh)]))
            mm = max(1, int((y1 - y0) / 2.2))
            for k in range(mm):
                wy = y0 + (y1 - y0) * (k + 0.28) / mm
                ww = (y1 - y0) / mm * 0.42
                wins.append(poly([(x1, wy, wz), (x1, wy + ww, wz),
                                  (x1, wy + ww, wz + wh), (x1, wy, wz + wh)]))
        body.append(fill("".join(sills), C["sill"]))
        if shut:
            body.append(fill("".join(shut), C["shutter"]))
        body.append(fill("".join(wins), C["win"], ' opacity=".88"'))
        body.append(fill("".join(glints), C["win_hi"], ' opacity=".5"'))
    if pitched:
        rc, re = roof(x0, y0, x1, y1, h)
        body.append(rc)
        edges.append(re)
    put(step, "".join(body), "".join(edges), order=order)


def shopfronts(x0, x1, y, z0, z1, step, doors=(0.3, 0.72)):
    glass, frames, leaves = [], [], []
    m = max(2, int((x1 - x0) / 2.6))
    for k in range(m):
        wx = x0 + (x1 - x0) * (k + 0.18) / m
        ww = (x1 - x0) / m * 0.62
        frames.append(poly([(wx - 0.1, y, z0 - 0.1), (wx + ww + 0.1, y, z0 - 0.1),
                            (wx + ww + 0.1, y, z1 + 0.1), (wx - 0.1, y, z1 + 0.1)]))
        glass.append(poly([(wx, y, z0), (wx + ww, y, z0),
                           (wx + ww, y, z1), (wx, y, z1)]))
    for u in doors:
        dx = x0 + (x1 - x0) * u
        leaves.append(poly([(dx, y, 0), (dx + 1.15, y, 0),
                            (dx + 1.15, y, z1 + 0.35), (dx, y, z1 + 0.35)]))
    return (fill("".join(frames), C["stone"]) + fill("".join(glass), C["shopwin"],
                                                     ' opacity=".85"')
            + fill("".join(leaves), C["door"], ' opacity=".9"'),
            "".join(frames) + "".join(leaves))


def arc_x(y, x0, x1, h, steps=16):
    xm, r = (x0 + x1) / 2, (x1 - x0) / 2
    return [(xm - math.cos(math.pi * k / steps) * r, y,
             h + math.sin(math.pi * k / steps) * r) for k in range(steps + 1)]


def portico_bay(xa, xb, y_front, depth, pier, h, ring=0.3):
    y_back = y_front - depth
    y = y_front - pier / 2
    colour, edges = [], []

    front = arc_x(y, xa, xb, h)
    back = arc_x(y_back, xa, xb, h)
    for j in range(len(front) - 1):
        quad = [iso(*back[j]), iso(*back[j + 1]),
                iso(*front[j + 1]), iso(*front[j])]
        k = math.sin(math.pi * j / (len(front) - 1))
        colour.append(fill(d_of(quad), C["vault"] if k < 0.62 else C["vault_dk"],
                           ' opacity="%.2f"' % (0.98 - 0.06 * k)))

    top = max(p[2] for p in front)
    outer = arc_x(y, xa - ring, xb + ring, h)
    spandrel = ([iso(*outer[0])] + [iso(*p) for p in outer]
                + [iso(xb + ring, y, top + 1.4), iso(xa - ring, y, top + 1.4)])
    colour.append(fill(d_of(spandrel), C["wall"]))
    band = [iso(*p) for p in outer] + [iso(*p) for p in reversed(front)]
    colour.append(fill(d_of(band), C["arch_ring"]))
    xm = (xa + xb) / 2
    colour.append(fill(poly([(xm - 0.24, y, top - 0.12), (xm + 0.24, y, top - 0.12),
                             (xm + 0.3, y, top + ring + 0.34),
                             (xm - 0.3, y, top + ring + 0.34)]), C["cornice"]))
    colour.append(fill(poly([(xa - ring, y, top + 1.18), (xb + ring, y, top + 1.18),
                             (xb + ring, y, top + 1.4), (xa - ring, y, top + 1.4)]),
                       C["cornice"]))
    edges.append(d_of([iso(*p) for p in front], False))
    edges.append(d_of([iso(*p) for p in outer], False))
    edges.append(d_of([iso(xm - 0.24, y, top - 0.12), iso(xm - 0.3, y, top + ring + 0.34)],
                      False))
    edges.append(d_of([iso(xm + 0.24, y, top - 0.12), iso(xm + 0.3, y, top + ring + 0.34)],
                      False))

    for px in (xa - ring, xb + ring - pier):
        c, e = box(px, y_front - pier, px + pier, y_front, h,
                   C["pier"], C["pier_side"], C["pier_dark"])
        colour.append(c)
        edges.append(e)
        cc, ce = box(px - 0.09, y_front - pier - 0.09, px + pier + 0.09,
                     y_front + 0.09, 0.24, C["stone"], C["stone_side"],
                     C["stone_side"], base=h - 0.24)
        colour.append(cc)
        edges.append(ce)
    return "".join(colour), "".join(edges)


def portico_run(x0, bays, bay_w, y_front, depth, pier, h, step, floor=True):
    y_back = y_front - depth
    xa, xb = x0 - 0.5, x0 + bays * bay_w + 0.5
    if floor:
        put(step, fill(poly([(xa, y_back, 0.02), (xb, y_back, 0.02),
                             (xb, y_front, 0.02), (xa, y_front, 0.02)]),
                       C["shade"], ' opacity=".2"'), "")
        c, e = box(xa, y_back, xb, y_front, 0.17, C["stone"], C["stone_side"],
                   C["stone_side"])
        put(step, c, e)
    for k in range(bays):
        colour, edges = portico_bay(x0 + k * bay_w + 0.4,
                                    x0 + (k + 1) * bay_w - 0.4,
                                    y_front, depth, pier, h)
        put(step + 1 + k, colour, edges)
    return step + bays


def tree(x, y, h, r, step, seed=0, order=70):
    dx, dy = LIGHT[0] * h * SHADOW * 1.1, LIGHT[1] * h * SHADOW * 1.1
    sh = [iso(x + dx + math.cos(2 * math.pi * k / 11) * r * 0.95,
              y + dy + math.sin(2 * math.pi * k / 11) * r * 0.95, 0)
          for k in range(11)]
    put(step, fill(curve_d(sh), C["ink"], ' opacity=".12"'), "", order=12)

    zt = h + r * 0.16
    b, t = 0.15, 0.075
    stem = (fill(d_of([iso(x + b, y - b, 0), iso(x + b, y + b, 0),
                       iso(x + t, y + t, zt), iso(x + t, y - t, zt)]), C["trunk_dk"])
            + fill(d_of([iso(x - b, y + b, 0), iso(x + b, y + b, 0),
                         iso(x + t, y + t, zt), iso(x - t, y + t, zt)]), C["trunk"]))
    edge = (d_of([iso(x + b, y + b, 0), iso(x + t, y + t, zt)], False)
            + d_of([iso(x - b, y + b, 0), iso(x - t, y + t, zt)], False))
    for sgn in (-1, 1):
        edge += d_of([iso(x + sgn * t * 0.6, y, zt * 0.72),
                      iso(x + sgn * r * 0.3, y - r * 0.1, zt + r * 0.22)], False)

    layers, out_d, last = [], "", []
    for i, (ox, oy, sc) in enumerate(((0.9, -0.5, 1.0), (-0.7, 0.5, 0.86),
                                      (0.1, -1.1, 0.66))):
        cx, cy = iso(x + ox * r * 0.22, y + oy * r * 0.22, h + r * 0.64)
        lobes = []
        for k in range(9):
            a = 2 * math.pi * k / 9 + seed * 0.7 + i
            rr = r * U * sc * (0.8 + 0.24 * ((k * 5 + seed * 3 + i) % 5) / 5)
            lobes.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr * 0.7))
        d = curve_d(lobes)
        layers.append(fill(d, C["crown"][i]))
        if i == 0:
            out_d = d
        last = lobes
    layers.append(fill(curve_d([(px, py - r * U * 0.18) for px, py in last]),
                       C["crown_hi"], ' opacity=".45"'))
    put(step, stem + "".join(layers), out_d + edge, order=order)


def hedge(x0, x1, y0, y1, h, step):
    put(step, cast(x0, y0, x1, y1, h, 0.1), "", order=12)
    c, e = box(x0, y0, x1, y1, h, C["hedge"], C["hedge_dk"], C["hedge_dk"])
    m = max(3, int((x1 - x0) * 1.5))
    tops, crest = [], []
    for k in range(m):
        xa = x0 + (x1 - x0) * k / m
        xb = x0 + (x1 - x0) * (k + 1) / m
        cx, cy = iso((xa + xb) / 2, y1, h)
        rr = (xb - xa) * C30 * U * 0.66
        tops.append(f'<ellipse cx="{n(cx)}" cy="{n(cy)}" rx="{n(rr)}"'
                    f' ry="{n(rr * 0.52)}" fill="{C["hedge_hi"]}"></ellipse>')
        crest.append((cx, cy - rr * 0.5))
    put(step, c + "".join(tops),
        e + curve_d([iso(x0, y1, h)] + crest + [iso(x1, y1, h)], False),
        order=70)


def pergola(x0, x1, y0, y1, h, step, order=72):
    colour, edges = [], []
    m = max(3, int((x1 - x0) / 0.6))
    dx, dy = LIGHT[0] * h * SHADOW, LIGHT[1] * h * SHADOW
    bars = []
    for k in range(m + 1):
        bx = x0 + (x1 - x0) * k / m
        bars.append(poly([(bx + dx, y0 + dy, 0.01), (bx + 0.1 + dx, y0 + dy, 0.01),
                          (bx + 0.1 + dx, y1 + dy, 0.01), (bx + dx, y1 + dy, 0.01)]))
    put(step, fill("".join(bars), C["ink"], ' opacity=".11"'), "", order=12)

    for px in (x0, x1 - 0.15):
        for py in (y0, y1 - 0.15):
            c, e = box(px, py, px + 0.15, py + 0.15, h,
                       C["pergola"], C["pergola_dk"], C["pergola_dk"])
            colour.append(c)
            edges.append(e)
    for py in (y0 - 0.06, y1 - 0.09):
        c, e = box(x0 - 0.1, py, x1 + 0.1, py + 0.15, 0.16,
                   C["pergola"], C["pergola_dk"], C["pergola_dk"], base=h)
        colour.append(c)
        edges.append(e)
    for k in range(m + 1):
        bx = x0 + (x1 - x0) * k / m
        c, _ = box(bx, y0 - 0.14, bx + 0.11, y1 + 0.14, 0.13,
                   C["pergola"], C["pergola_dk"], C["pergola_dk"], base=h + 0.16)
        colour.append(c)
    vine = []
    for k in range(m):
        bx = x0 + (x1 - x0) * (k + 0.5) / m
        for py, sc in ((y0 + 0.35, 0.85), (y1 - 0.35, 0.95)):
            cx, cy = iso(bx, py, h + 0.3)
            rr = (x1 - x0) / m * C30 * U * 0.72 * sc
            lobes = [(cx + math.cos(2 * math.pi * j / 7 + k) * rr,
                      cy + math.sin(2 * math.pi * j / 7 + k) * rr * 0.34)
                     for j in range(7)]
            vine.append((curve_d(lobes), (k + int(py * 3)) % 2))
    for i in (0, 1):
        d = "".join(v for v, j in vine if j == i)
        if d:
            colour.append(fill(d, C["vine"][i]))
    put(step, "".join(colour), "".join(edges), order=order)


def person(who, x, y, step, order=None):
    fig = CAST[who]
    fx, fy = fig["footprint"]
    sx, sy = iso(x, y, 0)
    bx0, by0, bx1, by1 = fig["box"]
    EXT[0] = min(EXT[0], sx + bx0)
    EXT[1] = min(EXT[1], sy + by0)
    EXT[2] = max(EXT[2], sx + bx1)
    EXT[3] = max(EXT[3], sy + by1)

    PLACED.append((who, sx + bx0, sy + by0, sx + bx1, sy + by1))
    body = "".join('<path d="%s" fill="%s" stroke="%s"></path>'
                   % (p["d"], p["fill"], p["fill"]) for p in fig["paths"])
    colour = (cast(x - fx, y - fy, x + fx, y + fy, fig["height"], 0.11)
              + f'<g class="pv-figure" transform="translate({n(sx)} {n(sy)})">'
              + body + "</g>")
    ink = "".join(d_of([(sx + ring[i], sy + ring[i + 1])
                        for i in range(0, len(ring), 2)])
                  for ring in fig["ink"])
    put(step, colour, ink,
        order=depth_order(x, y, bias=.5) if order is None else order)


def ground(x0, y0, x1, y1, colour, step, ink=True, z=0.0, extra="", order=0):
    d = poly([(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)])
    put(step, fill(d, colour, extra), d if ink else "", order=order)
    return d


def slab(x0, y0, x1, y1, thick, top, side, step, joints=True):
    c, e = box(x0, y0, x1, y1, thick, top, side, side)
    j = ""
    if joints and (x1 - x0) > 1.2:
        m = max(2, int((x1 - x0) / 1.15))
        j = "".join(d_of([iso(x0 + (x1 - x0) * k / m, y0, thick),
                          iso(x0 + (x1 - x0) * k / m, y1, thick)], False)
                    for k in range(1, m))
        c += (f'<path d="{j}" fill="none" stroke="{side}" stroke-width="1.3"'
              f' opacity=".55"></path>')
    put(step, c, e, order=6)


def road(x0, x1, y0, y1, step, kerb=True):
    if kerb:
        c, e = box(x0, y0 - 0.16, x1, y0, 0.17, C["stone"], C["stone_side"],
                   C["stone_side"])
        put(step, c, e, order=6)
    ground(x0, y0, x1, y1, C["asphalt"], step)
    ym = (y0 + y1) / 2
    dashes = []
    m = max(3, int((x1 - x0) / 1.9))
    for k in range(m):
        xa = x0 + (x1 - x0) * (k + 0.18) / m
        xb = x0 + (x1 - x0) * (k + 0.62) / m
        dashes.append(poly([(xa, ym - 0.07, 0.01), (xb, ym - 0.07, 0.01),
                            (xb, ym + 0.07, 0.01), (xa, ym + 0.07, 0.01)]))
    dashes.append(poly([(x0, y0 + 0.24, 0.01), (x1, y0 + 0.24, 0.01),
                        (x1, y0 + 0.33, 0.01), (x0, y0 + 0.33, 0.01)]))
    put(step, fill("".join(dashes), C["asphalt_line"]), "", order=4)


def parked_car(x, y, step, k=0, gone_at=None, order=56):
    tone = C["car"][k % len(C["car"])]
    side = C["car"][(k + 1) % len(C["car"])]
    colour = [cast(x, y, x + 0.86, y + 1.72, 0.72, 0.1)]
    body, edges = box(x, y, x + 0.86, y + 1.72, 0.38,
                      tone, side, tone)
    colour.append(body)
    cabin, cabin_edges = box(x + 0.12, y + 0.38, x + 0.74, y + 1.28, 0.3,
                              C["win_hi"], C["win"], C["win"], base=0.38)
    colour.append(cabin)
    put(step, "".join(colour), edges + cabin_edges,
        cls="pv-goes", order=order, gone_at=gone_at)


def bus_stop(x0, x1, y0, step, order=84):
    y1 = y0 + 0.72
    height = 2.45
    colour = [cast(x0, y0, x1, y1, height, 0.11)]
    edges = []

    glass = poly([(x0 + 0.12, y0, 0.32), (x1 - 0.12, y0, 0.32),
                  (x1 - 0.12, y0, height - 0.18),
                  (x0 + 0.12, y0, height - 0.18)])
    colour.append(fill(glass, C["water_hi"], ' opacity=".42"'))
    edges.append(glass)
    for px in (x0, x1 - 0.13):
        for py in (y0, y1 - 0.13):
            c, e = box(px, py, px + 0.13, py + 0.13, height,
                       C["pergola"], C["pergola_dk"], C["pergola_dk"])
            colour.append(c)
            edges.append(e)
    roof_c, roof_e = box(x0 - 0.12, y0 - 0.12, x1 + 0.12, y1 + 0.12, 0.16,
                         C["stone"], C["stone_side"], C["stone_side"],
                         base=height)
    seat_c, seat_e = box(x0 + 0.36, y0 + 0.18, x1 - 0.36, y0 + 0.42, 0.16,
                         C["pergola"], C["pergola_dk"], C["pergola_dk"],
                         base=0.58)
    colour.extend((roof_c, seat_c))
    edges.extend((roof_e, seat_e))

    pole_x, pole_y = x1 + 0.38, y1 - 0.06
    pole_c, pole_e = box(pole_x, pole_y, pole_x + 0.09, pole_y + 0.09, 2.65,
                         C["pergola_dk"], C["pergola_dk"], C["pergola_dk"])
    sx, sy = iso(pole_x + 0.045, pole_y + 0.045, 2.4)
    sign = (f'<circle cx="{n(sx)}" cy="{n(sy)}" r="{n(0.28 * U)}"'
            f' fill="{C["water"]}" stroke="{C["ink"]}" stroke-width="1.5"></circle>'
            f'<circle cx="{n(sx)}" cy="{n(sy)}" r="{n(0.11 * U)}"'
            f' fill="{C["stone"]}"></circle>')
    colour.extend((pole_c, sign))
    edges.append(pole_e)
    put(step, "".join(colour), "".join(edges), order=order)


def parking_bays(x0, x1, y0, y1, count, step, gone_at):
    marks = []
    for k in range(count + 1):
        x = x0 + (x1 - x0) * k / count
        marks.append(d_of([iso(x, y0, .025), iso(x, y1, .025)], False))
    marks.append(d_of([iso(x0, y1, .025), iso(x1, y1, .025)], False))
    ax, ay = x1 + 1.1, y0 + (y1 - y0) * .52
    arrow = poly([(ax - .18, ay - .7, .027), (ax + .18, ay - .7, .027),
                  (ax + .18, ay + .18, .027), (ax + .52, ay + .18, .027),
                  (ax, ay + .82, .027), (ax - .52, ay + .18, .027),
                  (ax - .18, ay + .18, .027)])
    body = (f'<path d="{"".join(marks)}" fill="none" stroke="{C["asphalt_line"]}"'
            f' stroke-width="1.65" opacity=".88"></path>'
            + fill(arrow, C["asphalt_line"], ' opacity=".82"'))
    put(step, body, "", cls="pv-goes", order=4, gone_at=gone_at)


def plaza_drain(x0, x1, y, step):
    channel = poly([(x0, y - .08, .028), (x1, y - .08, .028),
                    (x1, y + .08, .028), (x0, y + .08, .028)])
    bars = []
    count = max(5, int((x1 - x0) / .62))
    for k in range(count + 1):
        x = x0 + (x1 - x0) * k / count
        bars.append(d_of([iso(x, y - .08, .03), iso(x, y + .08, .03)], False))
    body = (fill(channel, C["stone_side"], ' opacity=".72"')
            + f'<path d="{"".join(bars)}" fill="none" stroke="{C["ink"]}"'
              f' stroke-width="1" opacity=".44"></path>')
    put(step, body, channel, order=4)


def plaza_bollards(points, step, order=76):
    colour, edges = [], []
    for x, y in points:
        c, e = box(x - .09, y - .09, x + .09, y + .09, .72,
                   C["stone"], C["stone_side"], C["stone_side"])
        colour.append(c)
        edges.append(e)
    put(step, "".join(colour), "".join(edges), order=order)


def bike_racks(x0, x1, y0, y1, step, order=76):
    racks = []
    for k in range(3):
        x = x0 + (x1 - x0) * k / 2
        racks.append(d_of([iso(x, y0, 0), iso(x, y0, .78),
                           iso(x, y1, .78), iso(x, y1, 0)], False))
    wheels = []
    for x in (x0, x0 + .72):
        cx, cy = iso(x, (y0 + y1) / 2, .36)
        wheels.append(f'<circle cx="{n(cx)}" cy="{n(cy)}" r="{n(.28 * U)}"'
                      f' fill="none" stroke="{C["pergola_dk"]}"'
                      f' stroke-width="1.5"></circle>')
    frame = d_of([iso(x0, (y0 + y1) / 2, .36),
                  iso(x0 + .36, (y0 + y1) / 2, .72),
                  iso(x0 + .72, (y0 + y1) / 2, .36),
                  iso(x0 + .25, (y0 + y1) / 2, .36),
                  iso(x0 + .36, (y0 + y1) / 2, .72)], False)
    body = (f'<path d="{"".join(racks)}" fill="none" stroke="{C["pergola_dk"]}"'
            f' stroke-width="2"></path>' + "".join(wheels)
            + f'<path d="{frame}" fill="none" stroke="{C["pergola_dk"]}"'
              f' stroke-width="1.5"></path>')
    put(step, body, "", order=order)


def street_lamp(x, y, step, order=82):
    height = 3.7
    colour = [cast(x - .08, y - .08, x + .08, y + .08, height, .12)]
    pole, pole_e = box(x - .07, y - .07, x + .07, y + .07, height,
                       C["pergola_dk"], C["pergola_dk"], C["pergola_dk"])
    cap, cap_e = box(x - .28, y - .18, x + .28, y + .18, .18,
                     C["stone"], C["stone_side"], C["stone_side"], base=height)
    sx, sy = iso(x, y, height + .2)
    glow = (f'<circle cx="{n(sx)}" cy="{n(sy)}" r="{n(.18 * U)}"'
            f' fill="{C["sill"]}" opacity=".92"></circle>')
    colour.extend((pole, cap, glow))
    put(step, "".join(colour), pole_e + cap_e, order=order)


def vignette_portico():
    BAG.clear()
    EXT[:] = [1e9, 1e9, -1e9, -1e9]
    BAY, PIER, DEPTH, HIMP = 4.2, 0.62, 3.6, 4.0
    XA, XB = -0.6, 12.4
    Y_FRONT = 5.4
    Y_BACK = Y_FRONT - DEPTH

    ground(XA - 1.4, Y_BACK - 2.2, XB + 1.4, 8.4, C["ground"], 0)
    facade(XA, Y_BACK - 2.2, XB, Y_BACK, 8.6, 1, floors=2, ground_h=HIMP + 2.1)
    sc, se = shopfronts(XA + 0.6, XB - 0.6, Y_BACK, 0.9, 2.9, 1)
    put(1, sc, se)
    last = portico_run(0.2, 3, BAY, Y_FRONT, DEPTH, PIER, HIMP, 2)
    slab(XA - 1.4, Y_FRONT, XB + 1.4, Y_FRONT + 0.5, 0.15, C["stone"],
         C["stone_side"], last + 1)
    road(XA - 1.4, XB + 1.4, Y_FRONT + 0.5, 9.2, last + 1)
    person("elder", 1.55, Y_FRONT - 1.35, last + 2)
    person("wheelchair", 4.7, Y_FRONT - 2.15, last + 2)
    return svg_of(
        "Un portico bolognese visto di sbieco: tre campate con i piedritti sul filo "
        "strada, gli archi a tutto centro con la loro ghiera di conci e il concio di "
        "chiave, e le volte che vanno indietro fino al muro del palazzo, dove si "
        "vedono le vetrine e i portoni del piano terra. Sopra, tre piani di finestre "
        "con le persiane e un tetto a due falde con il comignolo. Sotto il passaggio "
        "corre un'ombra continua, e ci stanno una signora anziana con il bastone e "
        "una persona in carrozzina: il portico e' gia' un rifugio, e lo e' per chi ne "
        "ha piu' bisogno.")


def basin(cx, cy, rx, ry, step, seed=0):
    def lobed(fx, fy, wob):
        pts = []
        for k in range(10):
            a = 2 * math.pi * k / 10
            r = 1.0 + wob * math.sin(a * 2.4 + seed)
            pts.append(iso(cx + math.cos(a) * rx * fx * r,
                           cy + math.sin(a) * ry * fy * r, 0.02))
        return curve_d(pts)

    edge = lobed(1.0, 1.0, 0.1)
    body = (fill(edge, C["soil"], ' opacity=".55"')
            + fill(lobed(0.78, 0.74, 0.08), C["gravel"])
            + fill(lobed(0.46, 0.42, 0.06), C["water"], ' opacity=".9"')
            + fill(lobed(0.3, 0.26, 0.05), C["water_hi"], ' opacity=".7"'))
    stones = []
    for k in range(5):
        a = 0.7 + k * 1.15 + seed
        sx, sy = iso(cx + math.cos(a) * rx * 0.95, cy + math.sin(a) * ry * 0.95, 0.05)
        stones.append('<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="%s"></ellipse>'
                      % (n(sx), n(sy), n(0.16 * U), n(0.09 * U), C["stone_side"]))
    put(step, body + "".join(stones), edge, order=8)


def paving(x0, y0, x1, y1, step, tone=None, joint=None, nx=5, ny=3, z=0.0):
    d = poly([(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)])
    lines = []
    for k in range(1, nx):
        u = x0 + (x1 - x0) * k / nx
        lines.append(d_of([iso(u, y0, z), iso(u, y1, z)], False))
    for k in range(1, ny):
        v = y0 + (y1 - y0) * k / ny
        lines.append(d_of([iso(x0, v, z), iso(x1, v, z)], False))
    put(step, fill(d, tone or C["stone"])
        + f'<path d="{"".join(lines)}" fill="none" stroke="{joint or C["stone_side"]}"'
          f' stroke-width="1.6" opacity=".8"></path>', d, order=2)


def fountain(cx, cy, r, step):
    def ring(rr, z):
        return curve_d([iso(cx + math.cos(2 * math.pi * k / 16) * rr,
                            cy + math.sin(2 * math.pi * k / 16) * rr, z)
                        for k in range(16)])

    rim = ring(r, 0.16)
    body = (fill(ring(r * 1.14, 0.0), C["stone_side"], ' opacity=".55"')
            + fill(rim, C["stone"])
            + fill(ring(r * 0.82, 0.14), C["water"])
            + fill(ring(r * 0.5, 0.15), C["water_hi"], ' opacity=".8"'))
    jets = []
    for k in range(6):
        a = math.pi * 2 * k / 6 + 0.4
        px, py = iso(cx + math.cos(a) * r * 0.55, cy + math.sin(a) * r * 0.55, 0.16)
        hgt = 0.7 * U * (0.72 + 0.28 * abs(math.cos(a)))
        jets.append(f'<ellipse cx="{n(px)}" cy="{n(py - hgt / 2)}"'
                    f' rx="{n(0.075 * U)}" ry="{n(hgt / 2)}"'
                    f' fill="{C["water_hi"]}" opacity=".75"></ellipse>')
    put(step, body + "".join(jets), rim, order=9)


def vignette_costruire():
    BAG.clear()
    EXT[:] = [1e9, 1e9, -1e9, -1e9]
    X0, X1, Y0, Y1 = -5.3, 6.3, 2.1, 9.5
    BEDS = ((X0 + 0.5, Y0 + 0.5, X0 + 3.8, Y0 + 2.5),
            (X0 + 7.0, Y0 + 3.9, X1 - 0.5, Y1 - 0.45))

    ground(X0 - 2.0, Y0 - 3.4, X1 + 2.6, Y1 + 3.6, C["ground"], 0)

    slab(X0 - 2.0, Y1 + 0.3, X1 + 2.6, Y1 + 1.1, 0.15, C["stone"], C["stone_side"], 0)
    road(X0 - 2.0, X1 + 2.6, Y1 + 1.1, Y1 + 3.4, 0)

    paving(X0, Y0, X1, Y1, 0, nx=8, ny=4)
    plaza_cx, plaza_cy = X0 + 6.0, Y0 + 2.0
    medallion = curve_d([iso(plaza_cx + math.cos(2 * math.pi * k / 16) * 1.32,
                                  plaza_cy + math.sin(2 * math.pi * k / 16) * 1.32,
                                  0.012) for k in range(16)])
    put(0, fill(medallion, C["stone_side"], ' opacity=".2"'), medallion, order=3)

    parking_bays(X0 + .52, X0 + 5.95, Y0 + .08, Y0 + 2.15, 4, 0, gone_at=2)
    plaza_drain(X0 + .2, X1 - .2, Y1 - .18, 0)
    plaza_bollards(((X0 + .18, Y1 + .02), (X0 + 1.0, Y1 + .02),
                    (X1 - 1.0, Y1 + .02), (X1 - .18, Y1 + .02)), 0,
                   order=depth_order(X1 - .18, Y1 + .02))
    bike_racks(X1 - 1.3, X1 - .35, Y0 + .55, Y0 + 1.1, 0,
               order=depth_order(X1 - .35, Y0 + 1.1))
    street_lamp(X0 + .25, Y1 - .38, 0,
                order=depth_order(X0 + .25, Y1 - .38))
    street_lamp(X1 - .3, Y0 + .35, 0,
                order=depth_order(X1 - .3, Y0 + .35))

    facade(X0 - 1.8, Y0 - 3.2, X1 - 1.6, Y0 - 1.3, 6.0, 0, floors=2,
           order=depth_order(X1 - 1.6, Y0 - 1.3))
    facade(X1 + 0.8, Y0 - 1.1, X1 + 2.4, Y0 + 2.4, 5.4, 0, floors=2,
           order=depth_order(X1 + 2.4, Y0 + 2.4))

    for i in range(4):
        car_x, car_y = X0 + 0.8 + i * 1.28, Y0 + 0.22
        parked_car(car_x, car_y, 0, i, gone_at=2,
                   order=depth_order(car_x + .86, car_y + 1.72))

    for i in range(4):
        bx = X0 + 0.3 + i * 2.2
        c, e = box(bx, Y1 + 0.06, bx + 1.5, Y1 + 0.2, 0.94,
                   C["works"], C["works_dk"], C["works_dk"])
        put(1, c, e, cls="pv-goes", order=62, gone_at=3)

    for bx0, by0, bx1, by1 in BEDS:
        ground(bx0, by0, bx1, by1, C["soil"], 2, z=0.011, order=5)
    for bx0, by0, bx1, by1 in BEDS:
        ground(bx0 + 0.1, by0 + 0.1, bx1 - 0.1, by1 - 0.1, C["grass"], 3,
               z=0.02, order=5)
        ground(bx0 + 0.6, by0 + 0.5, bx1 - 0.6, by1 - 0.5, C["meadow"], 3,
               ink=False, z=0.03, order=5)

    for i, (tx, ty) in enumerate(((X0 + 1.2, Y0 + 1.5), (X0 + 3.0, Y0 + 1.4),
                                  (X0 + 7.9, Y0 + 5.0), (X1 - 1.1, Y1 - 1.4))):
        radius = 1.0 + (i % 2) * 0.14
        tree_order = depth_order(tx + radius, ty + radius)
        if i < 2:
            tree_order = max(
                tree_order,
                depth_order(X1 - 1.6, Y0 - 1.3, bias=.9 + i * .05),
            )
        tree(tx, ty, 2.0 + (i % 3) * 0.2, radius, 4 + i // 2, seed=i,
             order=tree_order)

    pergola(X0 + 0.7, X0 + 3.8, Y1 - 2.8, Y1 - 1.35, 2.7, 6,
            order=depth_order(X0 + 3.8, Y1 - 1.35))
    basin(X1 - 2.0, Y1 - 1.7, 1.16, 0.78, 7, seed=1)
    fountain(plaza_cx, plaza_cy, 1.02, 8)

    for bx, by in ((X0 + 0.9, Y0 + 2.9), (X0 + 5.1, Y0 + 3.0),
                   (X0 + 1.5, Y1 - 2.1)):
        c, e = box(bx, by, bx + 1.4, by + 0.22, 0.44,
                   C["stone"], C["stone_side"], C["stone_side"])
        put(9, cast(bx, by, bx + 1.4, by + 0.22, 0.44, 0.08) + c, e,
            order=depth_order(bx + 1.4, by + .22))
    bus_stop(X1 - 3.25, X1 - 0.35, Y1 + 0.37, 9,
             order=depth_order(X1 - .35, Y1 + .37 + .72, bias=.5))
    for who, (px, py) in (("adult", (X0 + 2.25, Y0 + 3.7)),
                          ("child", (X0 + 3.77, Y0 + 3.4)),
                          ("wheelchair", (X0 + 3.2, Y1 - 0.8)),
                          ("pregnant", (X0 + 8.15, Y0 + 1.5)),
                          ("elder", (X0 + 9.5, Y0 + 1.3))):
        person(who, px, py, 10, order=depth_order(px, py, bias=.6))
    return svg_of(
        "Una piazza lastricata ampia fra due palazzine, sul fronte di una strada, "
        "con quattro auto raccolte lungo stalli segnati su un solo bordo, una "
        "canaletta, lampioni, paracarri e rastrelliere. Arrivano le transenne e "
        "nella pavimentazione si aprono due grandi aiuole: sotto la pietra c'e' la "
        "terra nuda, poi il prato. Ci si piantano quattro alberi, si monta un "
        "pergolato con il rampicante, si scava un giardino della pioggia con la "
        "ghiaia e le pietre, e a filo del lastricato si accende una fontana a raso. "
        "Gran parte della pietra resta, con tre panche e le persone che ci stanno; "
        "sul marciapiede compare anche una fermata del bus con pensilina.")


def vignette_corridoio():
    BAG.clear()
    EXT[:] = [1e9, 1e9, -1e9, -1e9]
    Y_WALK, Y_KERB = 3.6, 4.2
    XA, XB = -0.8, 14.2

    ground(XA - 1.2, 0.4, XB + 1.2, 7.4, C["ground"], 0)
    facade(XA - 0.4, 0.6, XB + 0.4, 1.5, 8.2, 0, floors=2, ground_h=3.5)
    slab(XA - 0.4, 1.5, XB + 0.4, Y_KERB, 0.15, C["stone"], C["stone_side"], 0)
    road(XA - 1.2, XB + 1.2, Y_KERB, 7.2, 0)

    for x0, x1 in ((0.4, 2.3), (12.2, 14.0)):
        put(1, fill(poly([(x0, 1.6, 0.03), (x1, 1.6, 0.03),
                          (x1, Y_KERB, 0.03), (x0, Y_KERB, 0.03)]),
                   C["shade"], ' opacity=".17"'), "", cls="pv-goes", order=8)

    portico_run(0.1, 1, 3.6, Y_WALK, 2.1, 0.52, 3.4, 2)
    pergola(4.9, 7.6, 2.05, Y_WALK - 0.15, 2.7, 4)
    for i, tx in enumerate((8.9, 10.2, 11.5)):
        tree(tx, Y_WALK - 0.6, 2.4 + (i % 2) * 0.2, 1.34, 5 + i, seed=i)
    hedge(12.5, 14.0, Y_WALK - 0.5, Y_WALK - 0.04, 0.85, 8)
    tree(13.4, 2.45, 1.7, 0.95, 8, seed=2)

    put(9, fill(poly([(XA - 0.2, 1.6, 0.05), (XB + 0.2, 1.6, 0.05),
                      (XB + 0.2, Y_KERB, 0.05), (XA - 0.2, Y_KERB, 0.05)]),
               C["shade"], ' opacity=".19"'), "", cls="pv-sweep", order=8)
    for who, (px, py) in (("elder", (1.17, 2.6)),
                          ("adultWalking", (6.2, 2.75)),
                          ("child", (9.5, 2.9))):
        person(who, px, py, 10)
    return svg_of(
        "Una strada lungo un fronte di palazzine. Il marciapiede resta all'ombra per "
        "tutta la sua lunghezza con quattro mezzi diversi, uno dopo l'altro: un "
        "tratto di portico con le sue arcate, una pergola con i travetti che getta "
        "un'ombra a righe, un filare di tre alberi e infine una siepe con un "
        "alberello. All'inizio l'ombra e' a chiazze staccate; alla fine e' una fascia "
        "continua, e le persone la percorrono da un capo all'altro senza mai un "
        "tratto al sole.")


def check_figures(name):
    """Warn when projected figures overlap."""
    for i in range(len(PLACED)):
        for j in range(i + 1, len(PLACED)):
            a, b = PLACED[i], PLACED[j]
            w = min(a[3], b[3]) - max(a[1], b[1])
            h = min(a[4], b[4]) - max(a[2], b[2])
            if w > 8 and h > 8:
                print(f"    ! {name}: {a[0]} e {b[0]} si accavallano"
                      f" ({w:.0f}x{h:.0f} px)")
    PLACED.clear()


def svg_of(title):
    pieces = [item[2] for item in BAG]
    steps = max(int(g.split('data-step="')[1].split('"')[0]) for g in pieces) + 1
    pad = 34.0
    x0, y0, x1, y1 = EXT
    w, h = (x1 - x0) + pad * 2, (y1 - y0) + pad * 2
    return steps, round(w / h, 4), (
        f'<svg role="img" viewbox="{n(x0 - pad)} {n(y0 - pad)} {n(w)} {n(h)}"'
        ' preserveaspectratio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">'
        f"<desc>{title}</desc>{''.join(item[2] for item in sorted(BAG))}</svg>")


VIGNETTES = [
    ("costruire", vignette_costruire, "piazzale"),
    ("corridoio", vignette_corridoio, "corridoio"),
    ("portico", vignette_portico, "portico"),
]

HEAD = '''// AUTO-GENERATO da `scripts/build_plan_vignettes.py` — non modificare a mano.
// `.pv-l`, `.pv-c` e `data-step` sono il contratto di animazione con CityPlanScene.
'''

here = os.path.dirname(os.path.abspath(__file__))
out = os.path.normpath(os.path.join(here, "..", "src", "data", "planVignettes.js"))
parts, meta = [], []
for name, fn, anchor in VIGNETTES:
    steps, ratio, svg = fn()
    check_figures(name)
    parts.append(f"  {name}: `\n{svg}\n`,")
    meta.append(f'  {name}: {{ steps: {steps}, ratio: {ratio}, anchor: "{anchor}" }},')
    print(f"  {name}: {steps} tempi, rapporto {ratio}, {len(svg) // 1024} KB")

io.open(out, "w", encoding="utf-8").write(
    HEAD
    + "// Per ogni vignetta: quanti tempi ha, il rapporto fra larghezza e altezza del\n"
    + "// disegno (il CSS ci riserva la scatola giusta) e l'ancora della pianta verso\n"
    + "// cui vola quando ha finito.\n"
    + "export const planVignetteMeta = {\n" + "\n".join(meta) + "\n};\n\n"
    + "export const planVignettes = {\n" + "\n".join(parts) + "\n};\n"
)
print(f"-> {out}")

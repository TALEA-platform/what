# -*- coding: utf-8 -*-
"""
Genera i TRE PRIMI PIANI della sezione «dove manca, si costruisce»: tre disegni
assonometrici che si disegnano a tratto, uno per ciascuno dei tre concetti.
Emette `src/data/planVignettes.js`.

    python scripts/build_plan_vignettes.py

── Perche' esistono ────────────────────────────────────────────────────────
La pianta dice DOVE sono le cose e quanto sono lontane, e lo fa meglio di
qualunque altra vista: un buco nella copertura, una linea fra due punti, una rete
che c'e' gia' sono tutte e tre distanze. Ma non sa dire com'e' FATTA una cosa:
dall'alto un portico e' una fascia con dei puntini, un albero un disco, un
cantiere un rettangolo grigio.

Un tentativo precedente rimediava INCLINANDO la pianta stessa (`rotateX` sulla
telecamera, con le estrusioni a proiezione esatta). Era giusto in geometria e
sbagliato in tutto il resto: una pianta piegata di taglio resta una pianta storta,
si muoveva tutto insieme e nessun movimento si leggeva, e trasformare duemila
elementi costava ~11 ms a colpo. Quindi la pianta sta ferma, e il volume lo fanno
questi tre disegni.

── L'assonometria, e il verso che conta ────────────────────────────────────
Isometrica classica:

    sx = (x - y) * cos(30)
    sy = (x + y) * sin(30) - z

`sy` CRESCE con x+y, quindi x+y grande vuol dire piu' in basso, cioe' PIU' VICINO
a chi guarda. Da qui una regola che vale per tutte e tre le scene e che una prima
stesura aveva sbagliato: la strada, che sta in primo piano, va a y GRANDE;
l'edificio, che sta dietro, a y piccola. Con i valori invertiti si guardava il
portico da dentro il palazzo, e le arcate davano le spalle a chi legge.

Per lo stesso motivo l'ordine di emissione va dal fondo verso l'osservatore: prima
la facciata, poi le volte, poi i piedritti. Chi aggiunge un pezzo lo metta al suo
posto nella catena, o vedra' un piedritto trasparire attraverso una colonna.

── Le ombre PORTATE ────────────────────────────────────────────────────────
Il segnale di volume piu' forte non e' il contorno ne' le tre facce: e' l'ombra
per terra. Ogni volume ne butta una nella direzione di `LIGHT`, calcolata come
inviluppo convesso dell'impronta e della sua copia traslata. Senza, i volumi
galleggiano; con, si appoggiano.

── Come si disegnano ──────────────────────────────────────────────────────
Ogni pezzo esce come `<g class="pv-i" data-step="n">` con due figli:
  · `.pv-l`  il TRATTO, con `pathlength="1"`: parte scoperto e si chiude;
  · `.pv-c`  il COLORE, che entra dopo, in dissolvenza.
`data-step` e' il tempo interno, che il componente avanza a orologio: e' quello a
far vedere il cantiere LAVORARE invece di comparire. `.pv-goes` sono i pezzi che
se ne vanno — le auto, le transenne, le chiazze d'ombra staccate: senza qualcosa
che sparisce, «si costruisce» non ha un prima.
"""
import io
import json
import math
import os

# Quante unita' SVG vale un metro. Non decide l'inquadratura — quella la ricava
# `svg_of` misurando il disegno — ma tiene in scala le cose che si misurano in
# unita' SVG: i tratti, i lobi delle chiome, le sagome delle persone.
U = 46.0

C30 = math.cos(math.radians(30))
S30 = math.sin(math.radians(30))

# La luce: direzione in cui cadono le ombre, in pianta, e quanto sono lunghe per
# ogni metro d'altezza. Da dietro-sinistra, cosi' le ombre vengono verso chi legge
# e i volumi si staccano dal terreno.
LIGHT = (0.62, 0.46)
SHADOW = 0.5

EXT = [1e9, 1e9, -1e9, -1e9]


def iso(x, y, z=0.0):
    """Un punto del mondo sulla carta. x a destra-basso, y a sinistra-basso (verso
    chi guarda), z in alto."""
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
    """Gli stessi punti, ma uniti da CURVE (Catmull-Rom convertito in cubiche).

    Serve alle chiome e alle siepi. Un poligono a nove lati letto in pieno campo
    non e' una chioma: e' un dado. La differenza fra i due disegni e' tutta qui —
    un albero e una siepe sono le uniche cose della scena che non hanno spigoli, e
    se li hanno il disegno intero smette di sembrare disegnato a mano."""
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
    """Inviluppo convesso (monotone chain). Serve alle ombre portate: l'ombra di un
    volume e' l'inviluppo della sua impronta e della copia traslata dalla luce."""
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


# ── Tavolozza: gli stessi inchiostri della vignetta del rifugio in `09`, cosi' i
#    due disegni della stessa sezione sembrano usciti dalla stessa mano.
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
    # Il tetto: la falda verso chi guarda prende la luce, quella dietro no. Sono
    # due toni della stessa terracotta, e bastano loro a dire «tetto a due falde»
    # senza nessun'altra spiegazione.
    roof="#C9975F", roof_back="#A87B4C", roof_ridge="#8E6437",
    roof_side="#A9784A", cornice="#DACDB0",
    pier="#E2D7BC", pier_side="#C9BC99", pier_dark="#AC9E7B",
    # La volta e' CHIARA. A tono medio le arcate leggevano come tre buchi bruni: da
    # fuori, un portico si riconosce perche' la volta rimanda luce e l'ombra sta
    # sotto, per terra. Il tono scuro serve solo verso la chiave, dove la volta e'
    # piu' profonda, e la differenza fra i due deve restare piccola.
    vault="#DCD1B4", vault_dk="#C4B795", arch_ring="#F3ECD8",
    shade="#2C5A3B",
    grass="#A8C58C", meadow="#C2D8A6",
    hedge="#6E9457", hedge_dk="#557740", hedge_hi="#8CB073",
    # Il rampicante della pergola ha un verde SUO, piu' chiaro e piu' giallo delle
    # chiome: con lo stesso verde degli alberi la pergola spariva dentro il filare,
    # e delle quattro tipologie del corridoio ne restavano tre.
    vine=["#8AAE64", "#9CBD76"],
    crown=["#4F7A3E", "#5F8C4C", "#78A263"], crown_hi="#96BC7B",
    trunk="#8E7250", trunk_dk="#6C5636",
    water="#A9C8D6", water_hi="#C9E1EA", gravel="#CFC5AC",
    works="#D9902F", works_dk="#A8681C",
    pergola="#C6B48C", pergola_dk="#A6916A",
    car=["#8FA3AE", "#B9836A", "#93A183", "#A8A296"],
)

# ── LA GENTE ────────────────────────────────────────────────────────────────
# Non si disegna qui. Sono le stesse persone del plastico girevole del capitolo
# sul rifugio — la signora col bastone, l'adulto e il bambino, la donna incinta,
# la carrozzina — proiettate una volta sola in questa assonometria e ripulite di
# tutto cio' che non si vede, da `scripts/build_cast_figures.mjs`.
#
# Prima c'erano quattro scatole e un cerchio per ciascuna. Davano la scala e
# nient'altro: in una sezione che parla di CHI ha bisogno di un rifugio
# climatico, la gente non puo' essere un ingombro con la testa. Adesso sono le
# stesse persone che il lettore ha appena visto da vicino nel plastico, e nella
# tavola si riconoscono una per una.
#
#     node scripts/build_cast_figures.mjs   # se cambia il cast, prima questo
CAST = json.load(io.open(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "cast_figures.json"),
    encoding="utf-8"))

# Dove sono finite, in pixel del disegno. Serve solo a farsi dire da `svg_of` se
# due persone si accavallano: in assonometria due punti lontani in pianta possono
# cadere uno sopra l'altro, e a occhio, sul codice, non si vede. Un corpo mezzo
# dentro un altro non legge come "due persone vicine", legge come un errore.
PLACED = []

BAG = []


def put(step, colour="", ink_d="", cls="", order=50, gone_at=None):
    """Un pezzo del disegno: il COLORE sotto, il TRATTO sopra.

    Quest'ordine e' stato invertito, ed era un difetto grosso e invisibile. Con il
    tratto emesso per primo ogni campitura si ricopriva il proprio contorno: di una
    linea da 2,2 restava fuori solo la meta' esterna, e non sempre. Tutto il disegno
    risultava slavato — i volumi senza spigoli, le chiome senza profilo, gli alberi
    davanti che si confondevano con il muro dietro.

    Il tempo non ne risente: che il tratto corra prima e il colore entri dopo lo
    decidono le transizioni CSS, non l'ordine nel documento."""
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
    # `step` decide QUANDO un pezzo compare; `order` decide DOVE sta nello spazio.
    # Una superficie arrivata tardi non deve coprire alberi o arredi soltanto
    # perche' e' stata animata dopo.
    BAG.append((order, len(BAG), f'<g {" ".join(attrs)}>{body}</g>'))


def depth_order(x, y, bias=0):
    """Ordine del pittore per i volumi nell'assonometria.

    In proiezione `x + y` cresce verso il bordo basso, cioè verso chi guarda.
    Usarlo evita che persone e panche finiscano sempre sopra gli oggetti davanti
    solo perché appartengono a una categoria emessa più tardi."""
    return 40 + (x + y) * 2.1 + bias


def fill(d, colour, extra=""):
    return f'<path d="{d}" fill="{colour}"{extra}></path>'


# ════ PRIMITIVE ═════════════════════════════════════════════════════════════
def cast(x0, y0, x1, y1, h, opacity=0.13):
    """L'ombra portata di un volume: l'inviluppo dell'impronta e della sua copia
    traslata dalla luce. E' il segnale di volume piu' forte del disegno — piu' del
    contorno e piu' delle tre facce — perche' e' quello che appoggia una cosa per
    terra invece di lasciarla galleggiare."""
    dx, dy = LIGHT[0] * h * SHADOW, LIGHT[1] * h * SHADOW
    base = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
    pts = [iso(px, py, 0) for px, py in base]
    pts += [iso(px + dx, py + dy, 0) for px, py in base]
    return fill(d_of(hull(pts)), C["ink"], f' opacity="{opacity}"')


def box(x0, y0, x1, y1, h, top, right, left, base=0.0):
    """Un parallelepipedo: le tre facce che si vedono, piu' il tratto degli spigoli.
    `right` e' la faccia a x=x1, `left` quella a y=y1 (verso chi guarda). Tre toni
    diversi: e' quello, non il contorno, a far leggere un volume."""
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
    """Un TETTO A DUE FALDE, con la gronda che sporge, il colmo e la testata a
    timpano. E' la modifica che ha cambiato di piu' questi disegni: con la copertura
    piatta un palazzo restava una scatola beige col coperchio rosso, e nessuna
    quantita' di finestre glielo toglieva. Un colmo e due falde di tono diverso
    bastano invece da soli a dire «edificio».

    In isometrica si vedono ENTRAMBE le falde — quella dietro sopra il colmo e
    quella davanti sotto — perche' l'inclinazione della falda e' minore di quella
    dello sguardo. Vanno emesse in quest'ordine, o la falda dietro copre il colmo."""
    xa, xb, ya, yb = x0 - ov, x1 + ov, y0 - ov, y1 + ov
    # Il colmo corre lungo il lato LUNGO, come in qualunque edificio vero: su una
    # stecca stretta e profonda un colmo trasversale si vede subito che e' sbagliato.
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
    # i corsi di coppi sulla falda in luce: tre righe sole, quanto basta a dire che
    # e' una superficie e non una campitura
    colour.append(f'<path d="{"".join(d_of(c, False) for c in courses)}" fill="none"'
                  f' stroke="{C["roof_ridge"]}" stroke-width="1.4" opacity=".3"></path>')
    # il colmo, in rilievo
    if along_x:
        cr, ce = box(xa, ridge_a[1] - .09, xb, ridge_a[1] + .09, 0.13,
                     C["roof_ridge"], C["roof_ridge"], C["roof_ridge"], base=zr - .06)
    else:
        cr, ce = box(ridge_a[0] - .09, ya, ridge_a[0] + .09, yb, 0.13,
                     C["roof_ridge"], C["roof_ridge"], C["roof_ridge"], base=zr - .06)
    colour.append(cr)
    # il timpano di testata, sul lato verso chi guarda
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
    """Un palazzo: il volume, il cornicione che sporge, il TETTO A FALDE e le
    FINESTRE sulle due facce che si vedono, con le PERSIANE ai lati.

    Le finestre non sono un ornamento: sono la cosa che fa leggere «palazzo
    abitato» invece di «scatola beige», e sono l'unico righello del disegno — una
    finestra e' alta un metro e mezzo, e da li' si legge tutto il resto. Le
    persiane fanno il secondo mestiere: danno alla facciata un ritmo verticale, che
    e' quello che distingue una casa da un magazzino.

    `ground_h` alza il primo ordine, per lasciare libero il piano terra dove ci
    passa un portico."""
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
                # il riflesso in alto: due terzi di vetro in ombra, un terzo che
                # prende il cielo. E' cio' che rende un vetro un vetro.
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
    """Le aperture del piano terra: vetrine e portoni. Sotto un portico e' la cosa
    che si vede ATTRAVERSO le arcate, e senza di lei dietro le colonne c'e' un muro
    cieco — cioe' esattamente il contrario di quello che un portico e'."""
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
    """Un arco a tutto centro nel piano y = costante: raggio uguale a mezza luce,
    imposta a `h`, chiave a `h + luce/2`. Punto per punto, non un semicerchio a
    occhio: e' per questo che le volte tornano anche dove due arcate si
    accavallano."""
    xm, r = (x0 + x1) / 2, (x1 - x0) / 2
    return [(xm - math.cos(math.pi * k / steps) * r, y,
             h + math.sin(math.pi * k / steps) * r) for k in range(steps + 1)]


def portico_bay(xa, xb, y_front, depth, pier, h, ring=0.3):
    """Una campata di portico, dal fondo verso chi guarda.

    `y_front` e' il filo strada (y grande = vicino) e la volta va INDIETRO di
    `depth`. La GHIERA dell'arco (`ring`) e' la fascia di conci che segue
    l'intradosso: e' lei a far leggere «arco di muratura» invece di «buco tondo», ed
    e' quello che di un portico si riconosce da lontano."""
    y_back = y_front - depth
    y = y_front - pier / 2
    colour, edges = [], []

    front = arc_x(y, xa, xb, h)
    back = arc_x(y_back, xa, xb, h)
    for j in range(len(front) - 1):
        quad = [iso(*back[j]), iso(*back[j + 1]),
                iso(*front[j + 1]), iso(*front[j])]
        # piu' scuro verso la chiave: e' la' che la volta e' piu' profonda
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
    # la CHIAVE: il concio in mezzo alla ghiera, un po' piu' alto degli altri. E'
    # il segno che chiude un arco, e senza di lui la ghiera resta una fascia.
    xm = (xa + xb) / 2
    colour.append(fill(poly([(xm - 0.24, y, top - 0.12), (xm + 0.24, y, top - 0.12),
                             (xm + 0.3, y, top + ring + 0.34),
                             (xm - 0.3, y, top + ring + 0.34)]), C["cornice"]))
    # il marcapiano sopra le arcate: separa il portico dai piani abitati
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
    """Un tratto di portico: il piano coperto, l'ombra che ci sta sotto, e le
    campate. Le campate arrivano UNA PER TEMPO, perche' un colonnato si legge come
    un ritmo e un ritmo si sente solo se arriva a battute."""
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
    """Un albero: ombra portata, tronco RASTREMATO con due branche, e la chioma a
    tre strati di curve sovrapposte, dal piu' scuro dietro al piu' chiaro davanti.

    Tre cose che sembrano dettagli e non lo sono. La chioma e' fatta di CURVE e non
    di poligoni: a nove lati diritti un albero legge come un dado. Il tronco si
    stringe salendo ed e' un tronco di piramide, non un parallelepipedo: un palo a
    sezione costante legge come un palo. E le due branche che escono dal fusto ed
    entrano nella chioma sono cio' che tiene insieme le due meta' del disegno."""
    dx, dy = LIGHT[0] * h * SHADOW * 1.1, LIGHT[1] * h * SHADOW * 1.1
    sh = [iso(x + dx + math.cos(2 * math.pi * k / 11) * r * 0.95,
              y + dy + math.sin(2 * math.pi * k / 11) * r * 0.95, 0)
          for k in range(11)]
    put(step, fill(curve_d(sh), C["ink"], ' opacity=".12"'), "", order=12)

    # il fusto: due facce di un tronco di piramide, largo sotto e stretto sopra
    zt = h + r * 0.16
    b, t = 0.15, 0.075
    stem = (fill(d_of([iso(x + b, y - b, 0), iso(x + b, y + b, 0),
                       iso(x + t, y + t, zt), iso(x + t, y - t, zt)]), C["trunk_dk"])
            + fill(d_of([iso(x - b, y + b, 0), iso(x + b, y + b, 0),
                         iso(x + t, y + t, zt), iso(x - t, y + t, zt)]), C["trunk"]))
    edge = (d_of([iso(x + b, y + b, 0), iso(x + t, y + t, zt)], False)
            + d_of([iso(x - b, y + b, 0), iso(x - t, y + t, zt)], False))
    # due branche che entrano nella chioma
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
    """Una siepe: un volume basso col bordo superiore a lobi. In un corridoio conta
    quanto un albero — fa ombra bassa e continua, e soprattutto sta dove un albero
    non ci starebbe."""
    put(step, cast(x0, y0, x1, y1, h, 0.1), "", order=12)
    c, e = box(x0, y0, x1, y1, h, C["hedge"], C["hedge_dk"], C["hedge_dk"])
    # Il bordo superiore a lobi, in curva: una siepe potata ha il filo mosso, e
    # quel filo e' l'unica cosa che la distingue da un muretto verde.
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
    """Una pergola: i pali, i travetti sopra, e l'ombra A RIGHE per terra. E' il
    pezzo che serve dove un albero non si puo' piantare — sopra un sottoservizio,
    in un fronte troppo stretto — e dice che un corridoio si fa anche con
    l'edilizia leggera, non solo aspettando che qualcosa cresca. L'ombra rigata e'
    il suo segno: si riconosce senza spiegazioni."""
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
    # i due correnti longitudinali, e sopra i travetti
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
    # Il RAMPICANTE. Una pergola nuda e' un'impalcatura: quello che fa ombra e'
    # quello che ci cresce sopra, e senza il verde il pezzo non spiega perche' sia
    # in una tavola sui corridoi climatici.
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
    """Una persona del plastico, posata sul disegno.

    Il corpo arriva gia' proiettato e gia' potato (vedi `CAST` qui sopra): qui si
    trasla e basta, perche' l'assonometria del generatore delle figure e' la
    stessa di `iso()` — se cambia una, va cambiata anche l'altra.

    Tre cose restano di competenza del disegno, e non del modello:

    · L'OMBRA. Il plastico posa sotto ai piedi una macchia tonda: e' una scena
      che gira, quindi non puo' avere una direzione della luce fissa. Qui la luce
      ce l'ha (`LIGHT`), e alberi, panchine e persone devono buttare l'ombra
      dalla stessa parte o il disegno si sfalda. Quindi l'ombra e' quella di
      casa, presa sull'impronta a terra del personaggio.

    · IL TRATTO. Non il contorno di ogni faccetta — sarebbe una ragnatela — ma la
      SAGOMA, cioe' lo stesso criterio dell'albero, che si inchiostra col profilo
      della chioma e non con le sue nove foglie.

    · L'ORDINE. Di sua natura una persona sta davanti a quello che ha alle
      spalle: `depth_order` sulla sua posizione, come per ogni altro volume."""
    fig = CAST[who]
    fx, fy = fig["footprint"]
    sx, sy = iso(x, y, 0)
    # I vertici del corpo non passano da `iso`, quindi il suo ingombro va
    # dichiarato a mano: senza, il viewBox taglierebbe teste e cappelli.
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
    """Una piastra con lo spessore: un marciapiede, un cordolo. Lo spessore e' la
    differenza fra una campitura e una cosa, e i GIUNTI fra una superficie e una
    macchia di colore — un marciapiede senza lastre e' solo un rettangolo chiaro."""
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
    """Una strada: il CORDOLO che la stacca dal marciapiede, l'asfalto, la mezzeria
    tratteggiata e la riga di margine. Il cordolo non e' un dettaglio da geometra:
    e' il gradino che dice dove finisce lo spazio di chi cammina e comincia quello
    delle auto, ed e' proprio la distinzione di cui parla questa sezione."""
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
    """Un'auto leggibile, non un cubo: carrozzeria bassa, abitacolo vetrato e
    ombra di contatto. Nella piazza iniziale e' gia' presente e poi si allontana
    quando cominciano i lavori."""
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
    """Una piccola fermata sul marciapiede: pensilina vetrata, seduta e palina.
    Entra alla fine della trasformazione per dire che un rifugio funziona anche
    quando e' facile arrivarci, non soltanto quando e' ben disegnato."""
    y1 = y0 + 0.72
    height = 2.45
    colour = [cast(x0, y0, x1, y1, height, 0.11)]
    edges = []

    # Parete trasparente sul fondo, poi struttura, tetto e seduta davanti.
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

    # Palina rotonda sul lato strada: un segno riconoscibile anche in piccolo.
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
    """Stalli e freccia di circolazione dello stato iniziale.

    Spariscono quando cominciano i lavori: la lastricatura resta, il suo uso come
    parcheggio no. E' la stessa distinzione resa nella pianta generale."""
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
    """Canaletta lineare con griglie, permanente sul bordo della piazza."""
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
    """Tre archetti metallici e una bicicletta stilizzata sul bordo."""
    racks = []
    for k in range(3):
        x = x0 + (x1 - x0) * k / 2
        racks.append(d_of([iso(x, y0, 0), iso(x, y0, .78),
                           iso(x, y1, .78), iso(x, y1, 0)], False))
    # Due ruote e il telaio: abbastanza per spiegare a cosa servono gli archetti.
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
    """Lampione con ombra e testa luminosa, per dare scala allo spazio."""
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


# ════════════════════════════════════════════════════════════════════════════
#  1 — IL PORTICO
# ════════════════════════════════════════════════════════════════════════════
def vignette_portico():
    """Il concetto piu' difficile da far capire dall'alto e il piu' bello da
    vicino. Tre campate, l'ombra che corre continua sotto il passaggio, e la
    differenza fra chi cammina al riparo e chi e' rimasto in strada."""
    BAG.clear()
    EXT[:] = [1e9, 1e9, -1e9, -1e9]
    # Le proporzioni contano piu' del dettaglio. Il palazzo era alto 9,8 m su un
    # portico di 3,4: in campo il portico diventava una zoccolatura e l'occhio
    # leggeva «palazzo». Ora l'arcata e' piu' alta e larga e il palazzo piu' basso,
    # perche' il soggetto e' il PASSAGGIO, non l'edificio che ci sta sopra.
    BAY, PIER, DEPTH, HIMP = 4.2, 0.62, 3.6, 4.0
    XA, XB = -0.6, 12.4
    Y_FRONT = 5.4
    Y_BACK = Y_FRONT - DEPTH

    ground(XA - 1.4, Y_BACK - 2.2, XB + 1.4, 8.4, C["ground"], 0)
    facade(XA, Y_BACK - 2.2, XB, Y_BACK, 8.6, 1, floors=2, ground_h=HIMP + 2.1)
    # Le vetrine e i portoni sul muro di fondo, che si vedono ATTRAVERSO le arcate:
    # e' quello che rende il portico un passaggio invece di una tettoia, e va emesso
    # prima delle volte, perche' sta piu' indietro di tutto.
    sc, se = shopfronts(XA + 0.6, XB - 0.6, Y_BACK, 0.9, 2.9, 1)
    put(1, sc, se)
    last = portico_run(0.2, 3, BAY, Y_FRONT, DEPTH, PIER, HIMP, 2)
    slab(XA - 1.4, Y_FRONT, XB + 1.4, Y_FRONT + 0.5, 0.15, C["stone"],
         C["stone_side"], last + 1)
    road(XA - 1.4, XB + 1.4, Y_FRONT + 0.5, 9.2, last + 1)
    # ── DUE persone, e nessuna sopra un piedritto ────────────────────────────
    # Erano quattro e non ci stavano: il portico e' profondo tre metri e mezzo,
    # in assonometria le tre campate lasciano tre finestre strette, e ogni corpo
    # in piu' finiva addosso a una colonna. Qui restano la signora col bastone e
    # la carrozzina — chi il riparo lo cerca davvero — e le altre due campate
    # restano libere: e' il PASSAGGIO il soggetto, e un passaggio si legge se e'
    # sgombro.
    #
    # La posizione della carrozzina non e' a occhio. I piedritti della campata
    # centrale cadono, in proiezione, a x da -35,9 a 13,5 e da 98,8 a 148,2; la
    # sagoma della carrozzina e' larga 82 e da (4,7 · 3,25) sta fra 13,7 e 95,9,
    # cioe' dentro il vano per un pelo da tutt'e due le parti. Spostarla di mezzo
    # metro a destra la rimette sotto la colonna, ed e' li' che stava.
    #
    # Il piedritto, per giunta, verrebbe disegnato SOTTO: le campate escono con
    # l'ordine fisso 50 mentre una persona porta la propria profondita', che qui
    # vale 57. Una colonna che sta un metro e mezzo davanti e passa dietro non e'
    # un dettaglio, e' la prospettiva che si ribalta. Finche' le campate non
    # avranno un ordine vero, la gente si tiene fuori dalla loro proiezione.
    person("elder", 1.55, Y_FRONT - 1.35, last + 2)
    person("wheelchair", 4.7, Y_FRONT - 2.15, last + 2)
    # Qui c'era un albero, ed era piantato in mezzo alla carreggiata: la strada
    # va da Y_FRONT+0,5 a 9,2 e la chioma stava a 7,3. Toglierlo non costa
    # niente al disegno — il soggetto e' il passaggio coperto, non il verde —
    # e chi lo rimette lo pianti oltre il filo della strada.
    return svg_of(
        "Un portico bolognese visto di sbieco: tre campate con i piedritti sul filo "
        "strada, gli archi a tutto centro con la loro ghiera di conci e il concio di "
        "chiave, e le volte che vanno indietro fino al muro del palazzo, dove si "
        "vedono le vetrine e i portoni del piano terra. Sopra, tre piani di finestre "
        "con le persiane e un tetto a due falde con il comignolo. Sotto il passaggio "
        "corre un'ombra continua, e ci stanno una signora anziana con il bastone e "
        "una persona in carrozzina: il portico e' gia' un rifugio, e lo e' per chi ne "
        "ha piu' bisogno.")


# ════════════════════════════════════════════════════════════════════════════
#  2 — IL RIFUGIO CHE SI COSTRUISCE
# ════════════════════════════════════════════════════════════════════════════
def basin(cx, cy, rx, ry, step, seed=0):
    """Il GIARDINO DELLA PIOGGIA: una conca con il fondo di ghiaia, un velo d'acqua
    e qualche pietra sul bordo.

    Era un rettangolo azzurro, e un rettangolo azzurro dentro un giardino legge
    «piscina». Un giardino della pioggia si riconosce dal contrario: bordo
    irregolare, invaso poco profondo, acqua che c'e' solo in mezzo. E' la cosa che
    il testo chiama «terra che assorbe la pioggia», quindi deve leggersi."""
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
    """La LASTRICATURA: il piano di pietra e i giunti a maglia larga.

    E' il segno che distingue una piazza da un piazzale d'asfalto: le lastre si
    vedono, e si vedono anche quando la piazza e' mezza vuota e mezza occupata dalle
    auto. Serve anche dopo, perche' la piazza NON sparisce sotto il verde — resta
    pietra, e il verde ci si apre dentro."""
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
    """La FONTANA A RASO: la vasca tonda con la ghiera di pietra e i getti.

    Era un rettangolo azzurro traslucido a filo del lastricato, e leggeva come una
    pozzanghera o una lastra di vetro. Una vasca tonda con il bordo in rilievo si
    riconosce da qualunque distanza, ed e' quello che d'estate porta la gente in
    una piazza — nessun altro segno lo dice."""
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
    """LA PIAZZA che diventa un rifugio climatico. E' il disegno piu' importante dei
    tre, perche' e' l'unico che mostra un CAMBIAMENTO invece di uno stato.

    ── Perche' una piazza ──────────────────────────────────────────────────────
    Perche' e' quello che c'e' nel punto della mappa a cui questo disegno e' legato
    dal richiamo. Una prima stesura ci metteva un parcheggio, e sulla pianta il
    cerchio cadeva su una spianata lastricata: i due disegni della stessa cosa si
    smentivano a vicenda, e il richiamo — che serve proprio a dire «e' questo posto
    qui» — diventava la fonte del dubbio. Adesso la cella `C1` della pianta e'
    anch'essa una piazza lastricata usata come parcheggio, e i due combaciano.

    Non e' nemmeno un ripiego: una piazza e' il caso piu' onesto di «dove manca, si
    costruisce». Non serve trovare un terreno libero — lo spazio c'e' gia', ed e'
    sotto la pietra e sotto le auto.

    ── Cosa ci si mette dentro ─────────────────────────────────────────────────
    Tutto il repertorio, uno per tempo, perche' il punto e' proprio che sono TANTE
    cose diverse e non una sola: aiuole tagliate nella pavimentazione, alberi,
    pergolato, giardino della pioggia, fontana a raso, panche. La pietra resta —
    e' una piazza, non un prato — e il verde ci si apre dentro.

    ── Il ritmo ────────────────────────────────────────────────────────────────
    Undici tempi, UNA cosa per tempo. Erano affollati (l'ultimo ne portava
    quattro) e arrivavano tutti addosso: si vedeva un guazzabuglio, non una
    costruzione. Chi aggiunge un pezzo si prenda un tempo suo, o lo tolga.

    Il tempo che conta e' il secondo, la TERRA NUDA: e' l'unico fotogramma in cui si
    vede che la pavimentazione E' STATA TOLTA. Senza, la trasformazione sarebbe una
    campitura grigia che diventa una campitura verde."""
    BAG.clear()
    EXT[:] = [1e9, 1e9, -1e9, -1e9]
    # Piu' larga e meno profonda: il vuoto centrale legge come spazio civico,
    # non come una griglia di stalli.
    X0, X1, Y0, Y1 = -5.3, 6.3, 2.1, 9.5
    # Le due aiuole che si aprono nella pietra. Sono grandi e sono DUE: una sola
    # avrebbe letto come «aiuola», due leggono come «la piazza e' stata ripensata».
    BEDS = ((X0 + 0.5, Y0 + 0.5, X0 + 3.8, Y0 + 2.5),
            (X0 + 7.0, Y0 + 3.9, X1 - 0.5, Y1 - 0.45))

    # 0 — il posto. Tutte le superfici orizzontali vengono emesse PRIMA dei
    #     volumi: in SVG l'ordine e' anche profondita', e una pavimentazione
    #     aggiunta dopo finirebbe visivamente sopra la palazzina di destra.
    ground(X0 - 2.0, Y0 - 3.4, X1 + 2.6, Y1 + 3.6, C["ground"], 0)

    # 0 — strada e marciapiede sono gia' presenti nello stato di partenza.
    slab(X0 - 2.0, Y1 + 0.3, X1 + 2.6, Y1 + 1.1, 0.15, C["stone"], C["stone_side"], 0)
    road(X0 - 2.0, X1 + 2.6, Y1 + 1.1, Y1 + 3.4, 0)

    # 0 — LA PIAZZA com'e' adesso: tutta pietra, con le auto su un solo lato.
    #     Le auto stanno sul BORDO, non a griglia: e' quello a dire «piazza usata
    #     come parcheggio» invece di «parcheggio», ed e' anche la stessa cosa che
    #     si vede sulla pianta.
    paving(X0, Y0, X1, Y1, 0, nx=8, ny=4)
    plaza_cx, plaza_cy = X0 + 6.0, Y0 + 2.0
    medallion = curve_d([iso(plaza_cx + math.cos(2 * math.pi * k / 16) * 1.32,
                                  plaza_cy + math.sin(2 * math.pi * k / 16) * 1.32,
                                  0.012) for k in range(16)])
    put(0, fill(medallion, C["stone_side"], ' opacity=".2"'), medallion, order=3)

    # Dettagli dello stato iniziale, coordinati con la pianta: gli stalli e la
    # freccia spariscono con le auto, mentre canaletta, lampioni, paracarri e
    # rastrelliere restano come infrastruttura della piazza.
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

    # Le palazzine vengono dopo TUTTI i piani di base, pur appartenendo al tempo
    # zero. In questo modo il loro piede resta davanti al suolo e la prospettiva
    # non si ribalta quando entra la pavimentazione della piazza.
    facade(X0 - 1.8, Y0 - 3.2, X1 - 1.6, Y0 - 1.3, 6.0, 0, floors=2,
           order=depth_order(X1 - 1.6, Y0 - 1.3))
    facade(X1 + 0.8, Y0 - 1.1, X1 + 2.4, Y0 + 2.4, 5.4, 0, floors=2,
           order=depth_order(X1 + 2.4, Y0 + 2.4))

    # Stato iniziale completo: le auto sono gia' presenti e raccolte su un bordo.
    for i in range(4):
        car_x, car_y = X0 + 0.8 + i * 1.28, Y0 + 0.22
        parked_car(car_x, car_y, 0, i, gone_at=2,
                   order=depth_order(car_x + .86, car_y + 1.72))

    # 1 — il cantiere: quattro transenne, non una fascia di lavori a tutta pagina
    for i in range(4):
        bx = X0 + 0.3 + i * 2.2
        c, e = box(bx, Y1 + 0.06, bx + 1.5, Y1 + 0.2, 0.94,
                   C["works"], C["works_dk"], C["works_dk"])
        put(1, c, e, cls="pv-goes", order=62, gone_at=3)

    # 2 — si tolgono SOLO ALCUNE LASTRE: sotto c'e' la terra.
    #     E' il fotogramma che vale tutta la sequenza.
    for bx0, by0, bx1, by1 in BEDS:
        ground(bx0, by0, bx1, by1, C["soil"], 2, z=0.011, order=5)
    # 3 — le aiuole piantumate
    for bx0, by0, bx1, by1 in BEDS:
        ground(bx0 + 0.1, by0 + 0.1, bx1 - 0.1, by1 - 0.1, C["grass"], 3,
               z=0.02, order=5)
        ground(bx0 + 0.6, by0 + 0.5, bx1 - 0.6, by1 - 0.5, C["meadow"], 3,
               ink=False, z=0.03, order=5)

    # 4..5 — gli alberi, a due a due. Nessuno nella fascia dietro: una chioma
    #        piantata a ridosso delle palazzine ci sale sopra in assonometria e
    #        taglia le finestre, e il disegno diventa illeggibile anche se la
    #        geometria e' giusta.
    for i, (tx, ty) in enumerate(((X0 + 1.2, Y0 + 1.5), (X0 + 3.0, Y0 + 1.4),
                                  (X0 + 7.9, Y0 + 5.0), (X1 - 1.1, Y1 - 1.4))):
        radius = 1.0 + (i % 2) * 0.14
        tree_order = depth_order(tx + radius, ty + radius)
        # I due alberi dell'aiuola in alto a sinistra sono sul lato della piazza
        # rivolto a chi guarda: devono interrompere il piede della casa, non
        # sparire dietro il suo muro per effetto dell'estensione del fabbricato.
        if i < 2:
            tree_order = max(
                tree_order,
                depth_order(X1 - 1.6, Y0 - 1.3, bias=.9 + i * .05),
            )
        tree(tx, ty, 2.0 + (i % 3) * 0.2, radius, 4 + i // 2, seed=i,
             order=tree_order)

    # 6 — il PERGOLATO: ombra dove un albero non ci starebbe, e sopra la pietra
    pergola(X0 + 0.7, X0 + 3.8, Y1 - 2.8, Y1 - 1.35, 2.7, 6,
            order=depth_order(X0 + 3.8, Y1 - 1.35))
    # 7 — il giardino della pioggia, dentro l'aiuola davanti
    basin(X1 - 2.0, Y1 - 1.7, 1.16, 0.78, 7, seed=1)
    # 8 — la FONTANA, in mezzo alla pietra rimasta libera
    fountain(plaza_cx, plaza_cy, 1.02, 8)

    # 9 — panche e fermata, sul bordo delle aiuole e lungo la strada
    for bx, by in ((X0 + 0.9, Y0 + 2.9), (X0 + 5.1, Y0 + 3.0),
                   (X0 + 1.5, Y1 - 2.1)):
        c, e = box(bx, by, bx + 1.4, by + 0.22, 0.44,
                   C["stone"], C["stone_side"], C["stone_side"])
        put(9, cast(bx, by, bx + 1.4, by + 0.22, 0.44, 0.08) + c, e,
            order=depth_order(bx + 1.4, by + .22))
    bus_stop(X1 - 3.25, X1 - 0.35, Y1 + 0.37, 9,
             order=depth_order(X1 - .35, Y1 + .37 + .72, bias=.5))
    # 10 — la gente: la prova che il posto e' finito e che ci si sta.
    #      E' lo stesso gruppo del plastico girevole: l'adulto col bambino
    #      accanto, la carrozzina sul percorso in piano, la donna incinta e la
    #      signora col bastone. Un rifugio climatico si giudica da chi ci riesce
    #      ad arrivare.
    #
    # ── Dove NON si puo' stare ───────────────────────────────────────────────
    # In assonometria una persona non e' dove la si mette in pianta: e' dove
    # cade la sua proiezione, e li' ci sono gia' i montanti del pergolato
    # (schermo -514/-502, -456/-444, -390/-378, -333/-321), i fusti degli alberi
    # (-313/-301, -237/-225, -185/-173, -121/-109) e le due chiome basse (-225 /
    # -133 e -167 / -63), che di un corpo alto ottanta pixel coprono la testa.
    # Ognuna di queste posizioni e' stata scelta perche' la sagoma del
    # personaggio ci stia INTERA nel varco fra due ostacoli. Chi le sposta
    # rifaccia il conto: bastano trenta centimetri per rimettere un tronco in
    # mezzo a una faccia.
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


# ════════════════════════════════════════════════════════════════════════════
#  3 — IL CORRIDOIO
#  Il messaggio e' che un corridoio NON e' un filare: e' CONTINUITA' D'OMBRA,
#  ottenuta con quello che il posto permette. Quindi il marciapiede attraversa in
#  sequenza quattro modi diversi di fare la stessa cosa — portico, pergola,
#  filare, siepe — e alla fine l'ombra e' una sola fascia che non si interrompe.
#  Chi cambia questa vignetta non riduca i quattro a uno: era il rilievo del
#  committente, ed e' il punto della battuta.
# ════════════════════════════════════════════════════════════════════════════
def vignette_corridoio():
    BAG.clear()
    EXT[:] = [1e9, 1e9, -1e9, -1e9]
    Y_WALK, Y_KERB = 3.6, 4.2
    XA, XB = -0.8, 14.2

    ground(XA - 1.2, 0.4, XB + 1.2, 7.4, C["ground"], 0)
    facade(XA - 0.4, 0.6, XB + 0.4, 1.5, 8.2, 0, floors=2, ground_h=3.5)
    slab(XA - 0.4, 1.5, XB + 0.4, Y_KERB, 0.15, C["stone"], C["stone_side"], 0)
    road(XA - 1.2, XB + 1.2, Y_KERB, 7.2, 0)

    # 1 — l'ombra a CHIAZZE: e' il prima, e senza il prima non c'e' il dopo
    for x0, x1 in ((0.4, 2.3), (12.2, 14.0)):
        put(1, fill(poly([(x0, 1.6, 0.03), (x1, 1.6, 0.03),
                          (x1, Y_KERB, 0.03), (x0, Y_KERB, 0.03)]),
                   C["shade"], ' opacity=".17"'), "", cls="pv-goes", order=8)

    # Le quattro tipologie, una dopo l'altra e con un vuoto fra loro: e' il vuoto a
    # far leggere «quattro modi diversi» invece di «una fascia verde». Chi le
    # riavvicina per guadagnare spazio toglie proprio il punto della battuta.
    # 2..3 — il PORTICO: ombra che c'e' gia', non va costruita
    portico_run(0.1, 1, 3.6, Y_WALK, 2.1, 0.52, 3.4, 2)
    # 4 — la PERGOLA: dove un albero non si puo' piantare
    pergola(4.9, 7.6, 2.05, Y_WALK - 0.15, 2.7, 4)
    # 5..7 — il FILARE: il modo classico
    for i, tx in enumerate((8.9, 10.2, 11.5)):
        tree(tx, Y_WALK - 0.6, 2.4 + (i % 2) * 0.2, 1.34, 5 + i, seed=i)
    # 8 — la SIEPE con un alberello: il fronte stretto
    hedge(12.5, 14.0, Y_WALK - 0.5, Y_WALK - 0.04, 0.85, 8)
    tree(13.4, 2.45, 1.7, 0.95, 8, seed=2)

    # 9 — l'ombra che NON SI INTERROMPE PIU', da un capo all'altro
    put(9, fill(poly([(XA - 0.2, 1.6, 0.05), (XB + 0.2, 1.6, 0.05),
                      (XB + 0.2, Y_KERB, 0.05), (XA - 0.2, Y_KERB, 0.05)]),
               C["shade"], ' opacity=".19"'), "", cls="pv-sweep", order=8)
    # Una figura per ciascun tratto, sempre lontana da piedritti, montanti e
    # tronchi. L'ordine segue la profondita': sotto pergola e chiome la persona
    # viene correttamente coperta dalla struttura, non disegnata sopra di essa.
    #
    # I varchi liberi, in proiezione, sono pochi e stretti: fra i due piedritti
    # del portico c'e' spazio per 73 pixel, fra due montanti del pergolato per
    # 45, fra due fusti del filare per 40. Ognuno prende la persona che ci sta:
    # la signora col bastone sotto il portico, chi cammina sotto la pergola, il
    # bambino nel filare. La carrozzina qui NON ci sta — e' larga 82 pixel, cioe'
    # piu' di ogni varco — e infilarla comunque significherebbe farle passare un
    # montante attraverso il busto: sta nel portico della tavola dopo, dove il
    # vano e' largo abbastanza.
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


# ════ USCITA ════════════════════════════════════════════════════════════════
def check_figures(name):
    """Avverte se due persone si accavallano in proiezione.

    La sovrapposizione si misura sul lato corto dell'intersezione: due sagome
    che si toccano per pochi pixel stanno solo vicine, due che si intersecano
    per mezza spalla sono un pasticcio. Non e' un errore fatale — a volte una
    persona dietro un'altra e' esattamente quello che si vuole — ma deve
    passare da una decisione, non da una svista."""
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
    """Chiude una vignetta: conta i tempi e ricava il viewBox dal disegno.

    La descrizione finisce in `<desc>` e NON in `<title>`: un `<title>` dentro un
    SVG inline diventa il tooltip di sistema del browser — un riquadro bianco con
    tutto il testo — non appena il puntatore si ferma sopra il primo piano, e
    ricompare a ogni rimontaggio del nodo (sviluppo, cambio di battuta). La
    vignetta e' `aria-hidden`, quindi quel testo non serviva nemmeno ai lettori di
    schermo: per loro c'e' la trascrizione `.plan-transcript` in `CityPlanScene`.
    """
    pieces = [item[2] for item in BAG]
    steps = max(int(g.split('data-step="')[1].split('"')[0]) for g in pieces) + 1
    pad = 34.0
    x0, y0, x1, y1 = EXT
    w, h = (x1 - x0) + pad * 2, (y1 - y0) + pad * 2
    return steps, round(w / h, 4), (
        f'<svg role="img" viewbox="{n(x0 - pad)} {n(y0 - pad)} {n(w)} {n(h)}"'
        ' preserveaspectratio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">'
        f"<desc>{title}</desc>{''.join(item[2] for item in sorted(BAG))}</svg>")


# Dove va ciascuna vignetta sulla pianta: il nome di un'ancora di `PLAN_ANCHORS`.
# Serve all'animazione che, finito il disegno, porta il primo piano al suo posto
# sulla mappa — cosi' il lettore non deve indovinare a quale punto del quartiere si
# riferisse quello che ha appena guardato.
VIGNETTES = [
    ("costruire", vignette_costruire, "piazzale"),
    ("corridoio", vignette_corridoio, "corridoio"),
    ("portico", vignette_portico, "portico"),
]

HEAD = '''// AUTO-GENERATO da `scripts/build_plan_vignettes.py` — non modificare a mano.
//     python scripts/build_plan_vignettes.py
//
// I TRE PRIMI PIANI della sezione «dove manca, si costruisce»: tre disegni
// assonometrici che si disegnano a tratto, uno per ciascuno dei tre concetti.
//
// ── Perché ci sono ─────────────────────────────────────────────────────────
// La pianta (`cityPlan`) dice DOVE stanno le cose e quanto sono lontane, e lo fa
// meglio di qualunque altra vista. Ma non sa dire com'è FATTA una cosa: dall'alto
// un portico è una fascia con dei puntini, un albero un disco, un cantiere un
// rettangolo grigio.
//
// Un tentativo precedente rimediava inclinando la pianta stessa. Non funzionava —
// una pianta piegata di taglio resta una pianta storta, si muoveva tutto insieme e
// nessun movimento si leggeva, e trasformare duemila elementi costava ~11 ms a
// colpo. Quindi la pianta sta ferma e il volume lo fanno questi tre disegni.
//
// ── Come si animano ────────────────────────────────────────────────────────
// Ogni pezzo è un `<g class="pv-i" data-step="n">` con due figli:
//   · `.pv-l`  il TRATTO (`pathlength="1"`): parte scoperto e si chiude;
//   · `.pv-c`  il COLORE, che entra dopo in dissolvenza.
// `data-step` è il tempo INTERNO alla vignetta, che il componente avanza a
// orologio: è quello che fa vedere il cantiere lavorare invece di comparire.
// `.pv-goes` sono i pezzi che se ne vanno (le auto, le transenne, le chiazze
// d'ombra staccate): senza qualcosa che sparisce, «si costruisce» non ha un prima.
// `.pv-sweep` è l'unico pezzo che CRESCE invece di comparire, e per ora è uno solo:
// l'ombra del corridoio, che si chiude da un capo all'altro.
//
// ── `anchor`: dove va la vignetta ──────────────────────────────────────────
// Finito il disegno, il primo piano si sposta sul punto della pianta a cui si
// riferisce (`PLAN_ANCHORS`) rimpicciolendosi, e lì svanisce. È il pezzo che lega
// il «com'è fatto» al «dove sta»: senza, il lettore guarda un bel disegno e non sa
// a quale punto del quartiere appartenga.

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

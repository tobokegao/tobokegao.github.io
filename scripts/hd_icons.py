"""24x24 painterly pixel-art link icons for the home page (layouts/_partials/icons-hd/).

    python scripts/hd_icons.py
    python scripts/hd_icons.py --from-grids   # redraw from icons-src/hd/*.txt only
    python scripts/hd_icons.py --only instagram   # just these icons

Each mark (official ones in icons-src/svg from simple-icons; redrawn ones in
icons-src/hand) is drawn 8x larger in Edge, then every icon pixel is decided from how
much of it the mark covers. Needs Edge and ImageMagick, so it runs locally; the
generated partials are committed.

The icons are flat sticker badges with a shine, drawn the way graffiti pieces are built:
outline -> fill -> 3D/shadow -> highlights -> details.
- a 6-step top-to-bottom gradient (dark hue-shifted top, brand color at the lit bottom)
  joined with 2x2 Bayer dithering; on it, sparse horizontal brush dabs (about a fifth of the fill, 2-4 pixels,
  staggered row by row) in a slightly warmer-lighter and a slightly cooler-darker version
  of the color, so the flat face reads like oil paint; white marks get the same dabs in
  cream and cool white. Dabs are never single pixels (no orphans)
- a primary outline that follows the light (selective outline): a lit, colored line on
  the bottom and left, the darkest ink on the top and right, picked from the edge normal
- lit from straight below, the (opaque) piece throws a 2-pixel shadow straight up onto
  the wall: two neutral tones, darker next to the piece, set per theme in CSS
  (--px-sh1 / --px-sh2); at night a light ring hugs the piece, drawn over the shadow
- no paint drips (tried, dropped at the user's request)
- the inner marks (white marks on tiles, the holes of hull icons) keep a painted volume:
  pillow light from below-left (up-lighting, Jazz Jackrabbit 2) in a 5-tone hue-shifted ramp, band edges broken into
  2x2 brush clusters, and a soft cast shadow on the badge; anti-alias pixels blend toward the outline
  color, so edges look the same on the day and the night backgrounds
- on hover the light turns up: a hidden layer (.px__hl) repaints the lower part of the
  piece warmer in three dithered steps and a one-pixel yellow rim hugs the piece; at night
  the lines take one step more light and the silhouette's outer edge turns lemon
- anti-alias only on curves and long steps, never on 45-degree lines (Saint11), and no
  orphan pixels
The pixel classes of each icon are also written to icons-src/hd/<name>.txt for reference.
"""

from __future__ import annotations

import subprocess
import tempfile
from collections import deque
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OFFICIAL = ROOT / "icons-src" / "svg"
HAND = ROOT / "icons-src" / "hand"
GRIDS = ROOT / "icons-src" / "hd"
OUT = ROOT / "layouts" / "_partials" / "icons-hd"
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
N = 24          # icon grid
SS = 8          # supersampling per icon pixel

# kind: "plain" (a colored mark), "hull" (a colored mark with enclosed holes of another
# color), "tile" (a white mark on a colored tile). size: the mark's width on the grid;
# 24 keeps the 24-unit marks at an exact 8x scale, so circles stay round and centered.
ICONS = {
    "x":          dict(src=OFFICIAL / "twitter.svg",    kind="plain", size=20, mark="#1d9bf0",
                       night_fill=True),
    "bluesky":    dict(src=OFFICIAL / "bluesky.svg",    kind="plain", size=20, mark="#1185fe",
                       night_fill=True),  # a 1px outline made the butterfly look thin at night
    "youtube":    dict(src=HAND / "youtube.svg",        kind="hull",  size=24, mark="#ff0033", hole="#ffffff"),
    "niconico":   dict(src=HAND / "niconico.svg",       kind="hull",  size=24, mark="#252525", hole="#ffffff",
                       line_art=True,             # at night: frame, antennas and face as white lines
                       mirror_rows=range(0, 5),   # antennas: force left/right symmetry
                       bare_rows=range(0, 5)),    # and no outline around them (it tripled their width)
    "soundcloud": dict(src=HAND / "soundcloud.svg",     kind="tile",  size=24, mark="#ffffff", tile="#ff5500"),
    "bandcamp":   dict(src=HAND / "bandcamp.svg",       kind="tile",  size=24, mark="#ffffff", tile="#1da0c3"),
    "spotify":    dict(src=HAND / "spotify.svg",        kind="hull",  size=24, mark="#1ed760", hole="#101010"),
    "apple":      dict(src=HAND / "applemusic.svg",     kind="hull",  size=24, mark="#fa2d48", hole="#ffffff"),
    "instagram":  dict(src=HAND / "instagram.svg",      kind="tile",  size=24, mark="#ffffff", tile="#d62976"),
    # the old cloud logo (until 2020), by request; drawn on the grid by
    # icons-src/hand/mixcloud_grid.py (the official outline broke up at this size)
    "mixcloud":   dict(src=OFFICIAL / "mixcloud-2014.svg", kind="tile", size=22, mark="#ffffff", tile="#314359",
                       hand_grid=True),
    # "WB" as on the Weeklybeats favicon, drawn on the grid by icons-src/hand/weeklybeats_grid.py
    "weeklybeats": dict(src=HAND / "weeklybeats_grid.py", kind="tile", size=24, mark="#10161c", tile="#6ce9fc",
                        flat_mark=True, hand_grid=True),
    "botb":       dict(src=HAND / "botb.svg",           kind="tile",  size=24, mark="#fff3d6", tile="#3d78b2",
                       flat_mark=True,            # poster letters: flat cream, no pillow volume
                       stack=("#e4502e", "#f28c28", "#f7c332"),    # the poster's stacked shadow
                       stack_dir=1),              # cast downward as in the poster (the one exception to the up-light)
    "github":     dict(src=OFFICIAL / "github.svg",     kind="hull",  size=24, mark="#24292f", hole="#ffffff",
                       add_holes=((3, 6), (4, 6), (4, 7), (5, 7), (3, 17), (4, 17), (4, 16), (5, 16)),  # ears
                       close_circle=True),
}

WARM = "#ffcc00"   # the light is Tobokegao yellow: highlights and lit edges lean toward it
COOL = "#2a1f5c"   # shadow hue


# ---------------------------------------------------------------- color ramps
def _rgb(c):
    return tuple(int(c[i:i + 2], 16) for i in (1, 3, 5))


def _mix(c1, c2, t):
    return "#%02x%02x%02x" % tuple(round(a + (b - a) * t) for a, b in zip(_rgb(c1), _rgb(c2)))


def ramp(base):
    """6 tones, dark to light: deep, dark, mid, base, light, specular. Shadows sink toward
    a near-black purple, lights toward warm cream."""
    lum = sum(_rgb(base)) / 765
    if lum > 0.92:
        return ["#5f6f8c", "#94a3ba", "#cbd4e0", "#eef2f6", "#ffffff", "#ffffff"]
    if lum < 0.2:
        return ["#040407", "#0d0f14", _mix(base, "#000000", 0.3), base, _mix(base, "#8a9cc0", 0.35), "#e6eeff"]
    return [_mix(base, "#120a2a", 0.72), _mix(base, "#1d1450", 0.42), _mix(base, COOL, 0.18), base,
            _mix(base, WARM, 0.32), _mix(base, "#fffbea", 0.78)]


# ---------------------------------------------------------------- rendering
def coverage(cfg):
    """Render the mark 8x and return per-icon-pixel coverage of (mark, hole, outside)."""
    big = N * SS
    tmp = Path(tempfile.mkdtemp())
    if cfg["src"].suffix == ".png":
        # a picture (e.g. a favicon): crop to the tile, scale up, and take the mark by color
        x, y, w, h = cfg["crop"]
        raw = subprocess.run(["magick", str(cfg["src"]), "-crop", f"{w}x{h}+{x}+{y}", "+repage",
                              "-resize", f"{big}x{big}!", "-depth", "8", "rgb:-"],
                             check=True, capture_output=True).stdout
        is_mark = cfg["mark_test"]
        area = SS * SS
        cov = []
        for Y in range(N):
            row = []
            for X in range(N):
                m = 0
                for yy in range(Y * SS, Y * SS + SS):
                    for xx in range(X * SS, X * SS + SS):
                        i = (yy * big + xx) * 3
                        if is_mark(raw[i], raw[i + 1], raw[i + 2]):
                            m += 1
                row.append((m / area, 0.0, 1 - m / area))
            cov.append(row)
        return cov
    svg = cfg["src"].read_text("utf-8")
    px = cfg["size"] * SS
    off = (big - px) // 2
    svg = svg.replace("<svg ", f'<svg width="{px}" height="{px}" style="position:absolute;left:{off}px;top:{off}px" ', 1)
    page = tmp / "p.html"
    page.write_text('<style>svg *{fill:#000}</style><body style="margin:0;background:#fff">' + svg + "</body>", "utf-8")
    shot = tmp / "s.png"
    subprocess.run([EDGE, "--headless=new", "--disable-gpu", "--hide-scrollbars", f"--user-data-dir={tmp / 'prof'}",
                    "--window-size=600,600", f"--screenshot={shot}", page.as_uri()], check=True, capture_output=True)
    if not shot.exists():
        # headless Edge sometimes exits without writing the file: let ImageMagick draw the
        # mark instead (black on white, placed as on the page)
        flat = tmp / "m.svg"
        flat.write_text(svg.replace("<svg ", '<svg fill="#000" ', 1), "utf-8")
        subprocess.run(["magick", "-size", f"{big}x{big}", "xc:white", "(", "-background", "none", str(flat), ")",
                        "-geometry", f"+{off}+{off}", "-composite", str(shot)], check=True, capture_output=True)
    raw = subprocess.run(["magick", str(shot), "-crop", f"{big}x{big}+0+0", "-colorspace", "gray", "-depth", "8", "gray:-"],
                         check=True, capture_output=True).stdout
    dark = [[raw[y * big + x] < 128 for x in range(big)] for y in range(big)]
    # outside = light pixels reachable from the border; the other light pixels are holes
    out = [[False] * big for _ in range(big)]
    q = deque((y, x) for y in range(big) for x in range(big) if (y in (0, big - 1) or x in (0, big - 1)) and not dark[y][x])
    for y, x in q:
        out[y][x] = True
    while q:
        y, x = q.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < big and 0 <= nx < big and not dark[ny][nx] and not out[ny][nx]:
                out[ny][nx] = True
                q.append((ny, nx))
    if cfg["src"].name == "github.svg":   # the cat opens to the edge; inside the circle is a hole
        c = (big - 1) / 2
        r = px / 2 - SS * 0.5
        for y in range(big):
            for x in range(big):
                if out[y][x] and (x - c) ** 2 + (y - c) ** 2 <= r * r:
                    out[y][x] = False
    area = SS * SS
    cov = []
    for Y in range(N):
        row = []
        for X in range(N):
            m = h = o = 0
            for y in range(Y * SS, Y * SS + SS):
                for x in range(X * SS, X * SS + SS):
                    if dark[y][x]:
                        m += 1
                    elif out[y][x]:
                        o += 1
                    else:
                        h += 1
            row.append((m / area, h / area, o / area))
        cov.append(row)
    return cov


# ---------------------------------------------------------------- pixel decisions
def classify(cov, kind):
    """M mark, H hole, . outside, A anti-alias against the outside, B anti-alias between
    the mark and a hole (or the tile). For tiles the whole square is the tile (T)."""
    g = [["." for _ in range(N)] for _ in range(N)]
    for y in range(N):
        for x in range(N):
            m, h, o = cov[y][x]
            if kind == "tile":
                g[y][x] = "M" if m >= 0.6 else ("B" if m >= 0.3 else "T")
            elif m >= 0.6:
                g[y][x] = "M"
            elif h >= 0.6:
                g[y][x] = "H"
            elif o >= 0.7:
                g[y][x] = "."
            elif h > o:
                g[y][x] = "B"
            else:
                g[y][x] = "M" if m >= 0.45 else "."   # the outline carries the edge; no see-through pixels
    if kind == "tile":
        for y, x in ((0, 0), (0, N - 1), (N - 1, 0), (N - 1, N - 1)):
            g[y][x] = "."
    # Saint11: no AA on 45-degree steps. An AA pixel in the inner corner of a one-by-one
    # staircase only blurs the line, so it goes.
    solid = lambda v: v in "MHT"
    for y in range(N):
        for x in range(N):
            if g[y][x] not in "AB":
                continue
            nb = {}
            for d, (dy, dx) in {"u": (-1, 0), "d": (1, 0), "l": (0, -1), "r": (0, 1)}.items():
                nb[d] = g[y + dy][x + dx] if 0 <= y + dy < N and 0 <= x + dx < N else "."
            s = {d for d, v in nb.items() if solid(v)}
            if len(s) >= 3:
                if g[y][x] == "A" or cov[y][x][0] >= 0.5:
                    g[y][x] = "M"
                else:
                    g[y][x] = "T" if kind == "tile" else "H"
            elif len(s) == 2 and s in ({"u", "l"}, {"u", "r"}, {"d", "l"}, {"d", "r"}) and g[y][x] == "A":
                g[y][x] = "."
    return g


def mirror(g, rows):
    """Copy the left half onto the right for rows that must be symmetric."""
    for y in rows:
        for x in range(N // 2):
            g[y][N - 1 - x] = g[y][x]
    return g


def tidy(g):
    # no orphans: a single mark or hole pixel surrounded by the other kind joins them
    for y in range(1, N - 1):
        for x in range(1, N - 1):
            v = g[y][x]
            around = {g[y - 1][x], g[y + 1][x], g[y][x - 1], g[y][x + 1]}
            if v in "MH" and len(around) == 1 and around != {v} and around <= set("MHT"):
                g[y][x] = around.pop()
    return g


GRADIENT = True      # a dithered two-color gradient in the fill (--flat turns it off)
LIGHT = "below"       # or "below-left": where the light comes from (--light below-left)
INK = "#0b0716"      # outline and block-shadow ink: a near-black violet
P = 3                # padding around the 24x24 icon for outline, block shadow and drips


def _hash(a, b):
    v = (a * 73856093) ^ (b * 19349663)
    return ((v >> 5) % 1000) / 1000.0


def ramp5(base):
    """5 tones for the inner marks, dark to light, hue-shifted (warm light, cool shadow)."""
    lum = sum(_rgb(base)) / 765
    if lum > 0.92:
        return ["#aebbcc", "#cfd8e4", "#eef2f6", "#ffffff", "#ffffff"]
    if lum < 0.2:
        return ["#030305", _mix(base, "#000000", 0.4), base, _mix(base, "#8aa0c8", 0.3), _mix(base, "#b8c8e6", 0.55)]
    return [_mix(base, COOL, 0.45), _mix(base, COOL, 0.22), base, _mix(base, WARM, 0.25), _mix(base, WARM, 0.55)]


def volume(region):
    """Tone 0..4 per cell: light from the top left on a soft pillow form, band edges broken
    into 2x2 brush clusters (the oil look), far edges in shadow, near edges lit, no orphans."""
    if not region:
        return {}
    ys = [c[0] for c in region]
    xs = [c[1] for c in region]
    y0, y1, x0, x1 = min(ys), max(ys), min(xs), max(xs)
    dist = {}
    q = deque()
    for y, x in region:
        if any((y + dy, x + dx) not in region for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            dist[(y, x)] = 0
            q.append((y, x))
    while q:
        y, x = q.popleft()
        for p in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if p in region and p not in dist:
                dist[p] = dist[(y, x)] + 1
                q.append(p)
    tones = {}
    for y, x in region:
        u = (x - x0) / max(1, x1 - x0)
        v = (y - y0) / max(1, y1 - y0)
        light = ((1 - u) * 0.35 + v * 0.65) if LIGHT == "below-left" else v   # up-lighting
        pillow = min(dist[(y, x)], 3) / 3
        val = 0.62 * light + 0.38 * pillow + (_hash(y // 2, x // 2) - 0.5) * 0.14
        t = 0 if val < 0.3 else 1 if val < 0.45 else 2 if val < 0.66 else 3 if val < 0.82 else 4
        side = LIGHT == "below-left"
        if (y - 1, x) not in region or (side and (y, x + 1) not in region):
            t = min(t, 1)                                   # edges turned away from the light
        elif (y + 1, x) not in region or (side and (y, x - 1) not in region):
            t = max(t, 3)                                   # edges facing the light
        tones[(y, x)] = t
    for (y, x), t in list(tones.items()):
        nb = [tones.get(p) for p in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1))]
        nb = [n for n in nb if n is not None]
        if len(nb) >= 3 and t not in nb and len(set(nb)) == 1:
            tones[(y, x)] = nb[0]
    return tones


def cells_glyph(cfg):
    return cfg["mark"] if cfg["kind"] == "tile" else (cfg.get("hole") or cfg["mark"])


def badge(cfg, g):
    """Flat colors for the 24x24 icon (None = empty), plus which cells are the body."""
    kind = cfg["kind"]
    if kind == "tile":
        body_c, glyph_c, body, glyph = cfg["tile"], cfg["mark"], "T", "M"
    else:
        body_c, glyph_c, body, glyph = cfg["mark"], cfg.get("hole") or cfg["mark"], "M", "H"
    edge = _mix(body_c, INK, 0.8)
    cells = [[None] * N for _ in range(N)]
    for y in range(N):
        for x in range(N):
            v = g[y][x]
            if v == ".":
                continue
            if v == glyph:
                cells[y][x] = glyph_c
            elif v == "B":
                cells[y][x] = _mix(body_c, glyph_c, 0.5)
            elif v == "A":
                cells[y][x] = _mix(body_c, edge, 0.5)       # AA toward the outline, not the page
            else:
                cells[y][x] = body_c
    body_cells = {(y, x) for y in range(N) for x in range(N) if g[y][x] in body + "A"}
    return cells, body_cells, body_c, edge


def stack_cells(cfg, g):
    """Retro stacked shadow (the Battle of the Bits poster): copies of the mark in bands,
    straight up (away from the light below) or down with stack_dir=1. Returns
    {(y, x): band 1..n} on the 24 grid. The counters of the letters (enclosed holes)
    stay the tile color."""
    mark = {(y, x) for y in range(N) for x in range(N) if g[y][x] == "M"}
    outside, q = set(), deque((y, x) for y in range(N) for x in range(N)
                              if (y in (0, N - 1) or x in (0, N - 1)) and (y, x) not in mark)
    while q:
        c = q.popleft()
        if c in outside or c in mark or not (0 <= c[0] < N and 0 <= c[1] < N):
            continue
        outside.add(c)
        q.extend(((c[0] + 1, c[1]), (c[0] - 1, c[1]), (c[0], c[1] + 1), (c[0], c[1] - 1)))
    cells = {}
    for k in range(1, len(cfg["stack"]) + 1):
        for (y, x) in mark:
            p_ = (y + k * cfg.get("stack_dir", -1), x)
            if p_ in outside and p_ not in cells:
                cells[p_] = k
    return cells


def to_svg(cfg, g):
    cells, body_cells, body_c, edge = badge(cfg, g)
    size = N + 2 * P
    grid = [[None] * size for _ in range(size)]
    for y in range(N):
        for x in range(N):
            if cells[y][x]:
                grid[y + P][x + P] = cells[y][x]
    body = {(y + P, x + P) for y, x in body_cells}
    if not body:
        body = {(y, x) for y in range(size) for x in range(size) if grid[y][x]}
    by0 = min(y for y, _ in body); by1 = max(y for y, _ in body)
    bx0 = min(x for _, x in body); bx1 = max(x for _, x in body)

    # details: paint drips hanging from the bottom edge
    for dx in cfg.get("drips", ()):
        x = dx + P
        col = [y for y in range(size) if (y, x) in body]
        if col:
            y = max(col)
            for k, dy in enumerate((1, 2)):
                if y + dy < size - 1:
                    grid[y + dy][x] = body_c
                    body.add((y + dy, x))

    # fill texture: oil-paint brush dabs, flat (no light direction), staggered per row
    glyph_c = cfg["mark"] if cfg["kind"] == "tile" else (cfg.get("hole") or cfg["mark"])
    dabs = {body_c: (_mix(body_c, WARM, 0.13), _mix(body_c, COOL, 0.11))}
    if sum(_rgb(glyph_c)) / 765 > 0.92 and glyph_c != body_c:   # white marks: a faint cream / cool white
        dabs[glyph_c] = (_mix(glyph_c, "#f3e7c9", 0.18), _mix(glyph_c, "#c9d6ea", 0.16))
    if GRADIENT:
        # a 6-step gradient from a deep hue-shifted color at the top to the brand color at
        # the bottom (lit from below), each step blended into the next with a 2x2 Bayer
        # ordered dither - the smooth-but-pixelly gradients of Jazz Jackrabbit 2's art
        deep = _mix(body_c, "#3a1d7a", 0.5)
        # the bottom catches the yellow light; a near-black badge (GitHub) shows the same
        # amount of yellow far more, so dark colors get less of it
        glow = 0.3 if sum(_rgb(body_c)) / 765 > 0.2 else 0.12
        lit = _mix(body_c, WARM, glow)
        steps = [_mix(deep, lit, i / 5) for i in range(6)]
        bayer = ((0.125, 0.625), (0.875, 0.375))
        for c in steps:
            dabs.setdefault(c, (_mix(c, WARM, 0.1), _mix(c, COOL, 0.1)))
        for (y, x) in body:
            if grid[y][x] != body_c:
                continue
            t = (y - by0) / max(1, by1 - by0) * 5          # 0 at the top .. 5 at the bottom
            i = int(t)
            frac = t - i
            k = min(5, i + (1 if frac > bayer[y % 2][x % 2] else 0))
            grid[y][x] = steps[k]
    for y in range(size):
        shift = int(_hash(y, 7) * 4)
        for x in range(size):
            c = grid[y][x]
            if c not in dabs or (y, x) not in body and c != glyph_c:
                continue
            stroke = (x + shift) // 4
            pick = _hash(y, stroke)
            if pick < 0.12:
                grid[y][x] = dabs[c][0]
            elif pick > 0.9:
                grid[y][x] = dabs[c][1]
    # the inner marks (white marks on tiles, the holes of hull icons) keep the painted
    # volume of the oil version; the badge around them stays flat
    if cfg.get("stack"):
        for (y, x), k in stack_cells(cfg, g).items():
            if (y + P, x + P) in body:
                grid[y + P][x + P] = cfg["stack"][k - 1]
    if cfg.get("flat_mark"):
        pass
    elif cfg["kind"] != "plain" and glyph_c != body_c and sum(_rgb(glyph_c)) / 765 > 0.5:
        inner = {(y, x) for y in range(size) for x in range(size)
                 if grid[y][x] is not None and (y, x) not in body and grid[y][x] in (glyph_c,) + dabs.get(glyph_c, ())}
        r5 = ramp5(glyph_c)
        for (y, x), t in volume(inner).items():
            grid[y][x] = r5[t]
        for (y, x) in body:                       # lit from below, the mark casts its shadow up-right
            src = (y + 1, x - 1) if LIGHT == "below-left" else (y + 1, x)
            if src in inner and (y, x) not in inner and grid[y][x] is not None:
                grid[y][x] = _mix(body_c, COOL, 0.35)
    # a dab cut to one pixel by an edge would be an orphan: give it back the base color
    for y in range(size):
        for x in range(size):
            c = grid[y][x]
            for base, (lt, dk) in dabs.items():
                if c in (lt, dk) and grid[y][x - 1 if x else x] != c and (x + 1 >= size or grid[y][x + 1] != c):
                    grid[y][x] = base

    solid = {(y, x) for y in range(size) for x in range(size) if grid[y][x]}
    # outline -> block shadow -> night ring
    bare = {(y + P, x + P) for y in cfg.get("bare_rows", ()) for x in range(N)}
    out = {}
    for y in range(size):
        for x in range(size):
            if (y, x) not in solid and any((y + dy, x + dx) in solid and (y + dy, x + dx) not in bare
                                           for dy in (-1, 0, 1) for dx in (-1, 0, 1)):
                # selective outline, following the light from below-left. The edge normal is
                # the average direction away from the shape over the 8 neighbours, so the tone
                # changes smoothly along curves instead of flickering on every stair step.
                ny = nx = 0
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        if (y + dy, x + dx) in solid:
                            ny -= dy
                            nx -= dx
                lx, ly = (-1 / 2 ** 0.5, 1 / 2 ** 0.5) if LIGHT == "below-left" else (0.0, 1.0)
                facing = (nx * lx + ny * ly) / max(1e-6, (nx * nx + ny * ny) ** 0.5)
                rim = 0.55 if sum(_rgb(body_c)) / 765 > 0.2 else 0.28
                out[(y, x)] = (_mix(body_c, WARM, rim) if facing > 0.35   # rim lit yellow
                               else edge if facing < -0.35
                               else _mix(body_c, INK, 0.62))
    piece = solid | set(out)
    # lit from below, the opaque piece throws its shadow up and to the right onto the wall
    # behind: two neutral tones (dark next to the piece, lighter further out) set by CSS,
    # so the shadow suits both the day and the night background
    shade = {1: "sh1", 2: "sh2"}
    shadow = {}
    for k in (1, 2):
        for (y, x) in piece:
            p = (y - k, x + k) if LIGHT == "below-left" else (y - k, x)
            if p not in piece and p not in shadow and 0 <= p[0] < size and 0 <= p[1] < size:
                shadow[p] = shade[k]
    # the night ring hugs the piece itself (around the shadow it detached from the piece and
    # looked broken); it is drawn over the shadow, which shows beyond it. By day the ring is
    # transparent, so the shadow shows in full.
    ring = {(y, x) for y in range(size) for x in range(size)
            if (y, x) not in piece and any((y + dy, x + dx) in piece for dy in (-1, 0, 1) for dx in (-1, 0, 1))}

    fills = {}
    for (y, x), c in out.items():
        fills[(y, x)] = c
    tones = {}
    for p_, c in shadow.items():
        tones.setdefault(c, []).append(p_)
    for (y, x) in solid:
        fills[(y, x)] = grid[y][x]
    paths = {}
    def add(key, y, x):
        paths.setdefault(key, []).append((y, x))
    for (y, x) in ring:
        add("ring", y, x)
    for (y, x), c in fills.items():
        add(c, y, x)

    def runs(pts):
        rows = {}
        for y, x in pts:
            rows.setdefault(y, []).append(x)
        d = []
        for y, xs in sorted(rows.items()):
            xs.sort()
            start = prev = xs[0]
            for x in xs[1:] + [None]:
                if x is not None and x == prev + 1:
                    prev = x
                    continue
                d.append(f"M{start} {y}h{prev - start + 1}v1h-{prev - start + 1}z")
                if x is not None:
                    start = prev = x
        return "".join(d)

    body_svg = [f'<path class="px__{c}" d="{runs(pts)}"/>' for c, pts in sorted(tones.items())]
    if "ring" in paths:
        body_svg.append(f'<path class="px__o" d="{runs(paths.pop("ring"))}"/>')
    body_svg += [f'<path fill="{c}" d="{runs(pts)}"/>' for c, pts in paths.items()]
    # hover: the yellow light from below turns up. The lower part of the piece is repainted
    # warmer, in three steps rising from the bottom, joined with the same 2x2 Bayer dither;
    # the layer stays hidden (.px__hl) until the link is hovered or focused
    dark = sum(_rgb(body_c)) / 765 <= 0.2
    amounts = (0, 0.14, 0.28, 0.42) if dark else (0, 0.22, 0.4, 0.58)
    hi = {}
    for (y, x), c in fills.items():
        k = hover_step(y, x, by0, by1)
        if k and sum(_rgb(c)) / 765 > 0.1:   # near-black marks stay black (yellow on them turned muddy)
            hi.setdefault(_mix(c, WARM, amounts[k]), []).append((y, x))
    # and a one-pixel yellow rim hugs the piece (not its shadow), drawn over the shadow's first row
    hi.setdefault(WARM, []).extend(ring)
    body_svg.append('<g class="px__hl">' + "".join(f'<path fill="{c}" d="{runs(pts)}"/>' for c, pts in hi.items()) + "</g>")
    return (f'<svg class="px px--hd" viewBox="0 0 {size} {size}" width="{size * 2}" height="{size * 2}" '
            f'aria-hidden="true" focusable="false" shape-rendering="crispEdges">{"".join(body_svg)}</svg>')


def hover_step(y, x, y0, y1):
    """0..3: how much more light a pixel catches on hover. Nothing in the top quarter, then
    rising to the bottom, the steps joined with a 2x2 Bayer dither."""
    bayer = ((0.125, 0.625), (0.875, 0.375))
    t = min(1.0, max(0.0, ((y - y0) / max(1, y1 - y0) - 0.25) / 0.75)) * 3
    i = int(t)
    return min(3, i + (1 if t - i > bayer[y % 2][x % 2] else 0))


def to_mono_svg(cfg, g):
    """Night version: white line art on a transparent ground, like the TBKgao night logo.
    The silhouette becomes a one-pixel line, inner marks and holes are filled; niconico,
    already a line drawing, keeps all its lines. Lit from below by the yellow light."""
    kind = cfg["kind"]
    body, glyph = ("T", "M") if kind == "tile" else ("M", "H")
    size = N + 2 * P
    lit = set()
    for y in range(N):
        for x in range(N):
            v = g[y][x]
            if cfg.get("line_art") or cfg.get("night_fill"):
                if v == "M":
                    lit.add((y, x))
                continue
            if v == glyph:
                lit.add((y, x))
    if not (cfg.get("line_art") or cfg.get("night_fill")):
        # the silhouette's line runs just OUTSIDE the badge, where the day outline sits, so
        # the badge keeps its full size and the mark inside gets a pixel of air (drawn on the
        # badge's own edge it looked small and cramped)
        shape = {(y, x) for y in range(N) for x in range(N) if g[y][x] != "."}
        for y in range(-1, N + 1):
            for x in range(-1, N + 1):
                if (y, x) not in shape and any((y + dy, x + dx) in shape
                                               for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    lit.add((y, x))
    # the night light is Tobokegao yellow from below too: the lines run from a dim grey at
    # the top to yellow at the bottom, four steps joined with 2x2 Bayer dithering
    # soft: the dark page makes yellow look stronger, and the resting state stays dim so the
    # hover (one step up, ending in lemon) reads clearly
    ramp_n = ["#c9ccd1", "#d4d5d2", "#dcd9c8", "#e0d4a6"]
    bayer = ((0.125, 0.625), (0.875, 0.375))
    y0 = min(y for y, _ in lit) if lit else 0
    y1 = max(y for y, _ in lit) if lit else 1
    by_color = {}
    for y, x in lit:
        t = (y - y0) / max(1, y1 - y0) * 3
        i = int(t)
        k = min(3, i + (1 if t - i > bayer[y % 2][x % 2] else 0))
        by_color.setdefault(ramp_n[k], []).append((y + P, x + P))
    if cfg.get("stack"):
        # the stacked shadow in grey steps, fading into the dark page band by band
        greys = ["#8e939b", "#666b73", "#474b52"]
        for (y, x), k in stack_cells(cfg, g).items():
            if (y, x) not in lit:
                by_color.setdefault(greys[min(k, 3) - 1], []).append((y + P, x + P))

    def runs(pts):
        rows = {}
        for y, x in sorted(pts):
            rows.setdefault(y, []).append(x)
        d = []
        for y, xs in sorted(rows.items()):
            start = prev = xs[0]
            for x in xs[1:] + [None]:
                if x is not None and x == prev + 1:
                    prev = x
                    continue
                d.append(f"M{start} {y}h{prev - start + 1}v1h-{prev - start + 1}z")
                if x is not None:
                    start = prev = x
        return "".join(d)

    body = "".join(f'<path fill="{c}" d="{runs(pts)}"/>' for c, pts in by_color.items())
    # hover: the lines take one step more light, and the lowest step turns lemon
    ramp_hi = ["#dcdad2", "#e6dcb4", "#e2c76a", "#fbd743"]
    hi = {}
    for y, x in lit:
        t = (y - y0) / max(1, y1 - y0) * 3
        i = int(t)
        k = min(3, i + (1 if t - i > bayer[y % 2][x % 2] else 0))
        hi.setdefault(ramp_hi[k], []).append((y + P, x + P))
    # and the outer edge of the silhouette turns lemon. The lines are already one pixel wide,
    # so a rim drawn outside them read as a doubled, two-pixel frame and clogged the antennas
    shape = {(y, x) for y in range(N) for x in range(N) if g[y][x] != "."}
    edge = {(y + P, x + P) for (y, x) in lit
            if (y, x) not in shape or any((y + dy, x + dx) not in shape for dy in (-1, 0, 1) for dx in (-1, 0, 1))}
    for c in hi:
        hi[c] = [p_ for p_ in hi[c] if p_ not in edge]
    hi.setdefault("#fbd743", []).extend(edge)
    body += '<g class="px__hl">' + "".join(f'<path fill="{c}" d="{runs(pts)}"/>' for c, pts in hi.items()) + "</g>"
    return (f'<svg class="px px--hd" viewBox="0 0 {size} {size}" width="{size * 2}" height="{size * 2}" '
            f'aria-hidden="true" focusable="false" shape-rendering="crispEdges">{body}</svg>')



def main():
    import sys
    global GRADIENT, OUT, LIGHT
    GRADIENT = "--flat" not in sys.argv
    if "--light" in sys.argv:
        LIGHT = sys.argv[sys.argv.index("--light") + 1]
    if "--out" in sys.argv:
        OUT = Path(sys.argv[sys.argv.index("--out") + 1])
    GRIDS.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    only = sys.argv[sys.argv.index("--only") + 1].split(",") if "--only" in sys.argv else None
    for name, cfg in ICONS.items():
        if only and name not in only:
            continue
        if "--from-grids" in sys.argv or cfg.get("hand_grid"):
            # redraw from the saved pixel classes (no Edge or ImageMagick needed)
            g = [list(r) for r in (GRIDS / f"{name}.txt").read_text("utf-8").splitlines()]
            (OUT / f"{name}.html").write_text(to_svg(cfg, g), "utf-8")
            night = OUT.parent / (OUT.name + "-night")
            (night / f"{name}.html").write_text(to_mono_svg(cfg, g), "utf-8")
            print("ok", name)
            continue
        g = classify(coverage(cfg), cfg["kind"])
        if "mirror_rows" in cfg:
            g = mirror(g, cfg["mirror_rows"])
        for y, x in cfg.get("add_holes", ()):
            g[y][x] = "H"
        if cfg.get("close_circle"):
            # GitHub's cat runs out through the bottom of the circle; close the rim so the
            # badge stays a full disc (the cat keeps its neck inside)
            c = (N - 1) / 2
            for y in range(N):
                for x in range(N):
                    d = ((x - c) ** 2 + (y - c) ** 2) ** 0.5
                    if 10.3 <= d <= 11.6 and g[y][x] in ".AH":
                        g[y][x] = "M"
            # and give the lower half the same outline as the upper half
            for y in range(N // 2, N):
                for x in range(N):
                    top = g[N - 1 - y][x]
                    if top == "." and g[y][x] in "MA":
                        g[y][x] = "."
                    elif top != "." and g[y][x] in ".A":
                        g[y][x] = "M"
        g = tidy(g)
        (GRIDS / f"{name}.txt").write_text("\n".join("".join(r) for r in g) + "\n", "utf-8")
        (OUT / f"{name}.html").write_text(to_svg(cfg, g), "utf-8")
        night = OUT.parent / (OUT.name + "-night")
        night.mkdir(parents=True, exist_ok=True)
        (night / f"{name}.html").write_text(to_mono_svg(cfg, g), "utf-8")
        print("ok", name)


if __name__ == "__main__":
    main()

"""Link banners for the LINKS window on the top page (decision 0033).

Made after the personal-site banners of the late 90s and 2000s (the 200x40 and 88x31 collections
shown by @memoriesofhp): a Mini Tobokegao face cut close and the name laid over the ground.
The wear is TRACKMENTO's (onet5.py): the picture is put together at 4x, shrunk with LANCZOS to
2x and then NEAREST to 1x so the outlines go jagged, every colour cut to 5 bits a channel (a 90s
Mac's "thousands of colours"), and each frame gets its own 22-colour palette with Floyd-Steinberg
dither. The lettering is placed dot by dot (scripts/link_letters.py) and painted at 1x (or a whole
multiple) with no in-between colours, so it stays sharp.

Three sizes (468x60, 200x40, 88x31) x two pictures (face: drawn faces; dot: the 32x32 pixel art,
enlarged by a whole number) x two colour sets (day: the site's; night: TRACKMENTO's). Each is
written to static/img/banners/ as tobokegao-<large|medium|small>-<face|dot>-<day|night>.gif (3 frames, 1.5 s each)
and ...-still.gif (the first frame alone: for sites that want it still, and for reduced motion).

    python scripts/link_banners.py [--zoom DIR]   # --zoom also writes each frame at 4x, to check by eye
"""

from __future__ import annotations

import argparse
import sys
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
from link_letters import MID, SMALL, lettering  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "static" / "img" / "minitobo"
OUT = ROOT / "static" / "img" / "banners"

BLUE = (0, 101, 153)      # the drawings' blue, --accent by day
YEL = (255, 204, 0)       # the drawings' yellow, --mark by day
WHITE = (255, 255, 255)
GRAY = (221, 223, 223)    # the pixel art's light grey
COLOURS = {
    # ground, frame, name, rings around the name, small line, its ring, 88x31 ground, colours always in the palette
    "day": dict(ground=WHITE, frame=(13, 34, 51), name=BLUE, rings=(((128, 196, 228), 1), (WHITE, 2)),
                small=(13, 34, 51), small_ring=WHITE, g88=YEL, n88=BLUE, r88=WHITE,
                fixed=[(228, 233, 239), (128, 196, 228), (196, 204, 212), (236, 228, 196), (179, 38, 30)]),
    "night": dict(ground=(27, 32, 37), frame=(166, 171, 177), name=(251, 215, 67), rings=(((18, 23, 27), 1),),
                  small=(239, 238, 235), small_ring=(18, 23, 27), g88=(27, 32, 37), n88=(251, 215, 67), r88=(18, 23, 27),
                  fixed=[(18, 23, 27), (72, 70, 59), (135, 212, 255)]),
}
NCOL = 22

# Drawn faces, other ones by day and by night so no drawing shows twice: (diary, crop box in the 240px picture).
# faces: the 200x40 and 88x31; yheads / bheads: whole heads for 468x60, side by side (one face cut to
# that band lost too much above and below), each frame yellow, blue, yellow by the drawings' own grounds,
# six yellow and three blue so that no drawing shows twice in a round
COLOURS["day"].update(
    faces=[("134", (45, 72, 205, 165)), ("147", (50, 40, 220, 140)), ("017", (35, 80, 215, 185))],
    yheads=[("134", (10, 35, 215, 185)), ("147", (20, 5, 230, 155)), ("105", (10, 20, 235, 235)),
            ("137", (10, 30, 235, 235)), ("152", (0, 0, 240, 200)), ("072", (60, 5, 185, 150))],
    bheads=[("017", (5, 25, 240, 185)), ("059", (10, 25, 230, 200)), ("026", (5, 20, 235, 200))])
COLOURS["night"].update(
    faces=[("039", (30, 75, 210, 180)), ("112", (20, 115, 220, 225)), ("045", (25, 80, 205, 180))],
    yheads=[("045", (20, 50, 215, 180)), ("039", (10, 35, 235, 215)), ("143", (25, 10, 225, 165)),
            ("144", (55, 10, 230, 170)), ("149", (25, 25, 220, 200)), ("054", (10, 0, 230, 230))],
    bheads=[("112", (5, 20, 235, 230)), ("056", (10, 15, 230, 230)), ("020", (30, 45, 235, 235))])
# pixel art (32x32): (diary, the row the face is centred on)
DOTS = [("129", 15), ("128", 15), ("130", 13)]
# 468x60: three side by side, each playing its own animation (139, 64x64, turns its head left and right),
# on one clock of STEP ms going round in LOOP ms (a whole number of rounds of 129 and 139; 128 skips its last frames)
# (diary, the row the face is centred on, the size of its grid)
ROW = [("129", 15, 32), ("128", 15, 32), ("139", 30, 64)]
STEP, LOOP = 20, 4800


def mac15(v: int) -> int:
    v5 = round(v * 31 / 255)
    return (v5 << 3) | (v5 >> 2)


LUT = [mac15(v) for v in range(256)]


def snap(c: tuple) -> tuple:
    return tuple(LUT[v] for v in c)


def quant(f: Image.Image, c: dict, src: Image.Image | None = None, dither: bool = True) -> Image.Image:
    """22 colours: the fixed ones and the rest by median cut of src (the frame itself unless given).
    Floyd-Steinberg keeps the drawings' screen tone as a texture; the pixel art (4 inks) looks the same without it."""
    fixed = [snap(x) for x in [c["frame"], BLUE, YEL, WHITE, GRAY, c["ground"], c["name"], c["small"]] + c["fixed"]]
    fixed = list(dict.fromkeys(fixed))
    n = NCOL - len(fixed)
    pal = (src or f).quantize(colors=n, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    p = [LUT[v] for v in pal.getpalette()[:n * 3]] + [v for x in fixed for v in x]
    pal.putpalette(p + [0] * (768 - len(p)))
    q = f.quantize(palette=pal, dither=Image.Dither.FLOYDSTEINBERG if dither else Image.Dither.NONE)
    g = n + fixed.index(snap(c["ground"]))
    for r in f.info.get("air", []):
        ImageDraw.Draw(q).rectangle(r, fill=g)
    return q


def letter(img: Image.Image, xy: tuple, s: str, face: dict, col, rings, k: int = 1) -> None:
    """No shadow; rings from the inside out, then the letters. k enlarges the letters by a whole number."""
    m = lettering(s, face)
    if k > 1:
        m = m.resize((m.width * k, m.height * k), Image.NEAREST)
    pad = sum(r for _, r in rings)
    core = Image.new("L", (m.width + pad * 2, m.height + pad * 2), 0)
    core.paste(m, (pad, pad))
    layers, grow = [], core
    for c, r in rings:
        for _ in range(r):
            grow = grow.filter(ImageFilter.MaxFilter(3))
        layers.append((c, grow))
    x, y = xy[0] - pad, xy[1] - pad
    for c, g in reversed(layers):
        img.paste(snap(c), (x, y), g)
    img.paste(snap(col), (x, y), core)


def fit(box: tuple, aspect: float) -> tuple:
    """A crop around the face box's centre with the given width/height: as tall as the box,
    or a lower band around the eyes when the 240px picture is not wide enough."""
    cx, cy, bh = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2, box[3] - box[1]
    bh = min(bh, 240 / aspect)
    bw = bh * aspect
    x0 = max(0, min(240 - bw, cx - bw / 2))
    y0 = max(0, min(240 - bh, cy - bh / 2))
    return tuple(round(v) for v in (x0, y0, x0 + bw, y0 + bh))


@lru_cache(maxsize=None)
def frames32(diary: str, n: int = 32) -> tuple:
    """The n x n pixel art, every frame with its length in ms, colours snapped back to the four inks."""
    im = Image.open(ART / f"{diary}.webp")
    out = []
    for k in range(getattr(im, "n_frames", 1)):
        im.seek(k)
        im.load()
        f = im.convert("RGB")
        cell = f.width // n
        g = Image.new("RGB", (n, n))
        for y in range(n):
            for x in range(n):
                p = f.getpixel((x * cell + cell // 2, y * cell + cell // 2))
                g.putpixel((x, y), min((BLUE, YEL, WHITE, GRAY), key=lambda q: sum((a - b) ** 2 for a, b in zip(p, q))))
        out.append((g, im.info.get("duration") or 100))
    return tuple(out)


def grid32(diary: str, t: int = 0, n: int = 32) -> Image.Image:
    """The frame showing at t ms (the first frame at 0), the animation looping."""
    fr = frames32(diary, n)
    t %= sum(d for _, d in fr)
    for g, d in fr:
        if t < d:
            return g
        t -= d
    return fr[0][0]


def art(kind: str, i: int, w: int, h: int, c: dict, many: bool = False) -> Image.Image:
    """The picture for a w x h box, at 4x. Drawn faces are cut to the box; pixel art is enlarged
    by a whole number (2 when the box is 32 rows or more) and set on its own yellow.
    i is the frame; for the pixel art in a row (many) it is the step of the clock."""
    if kind == "face" and many:   # three heads in a row: yellow, blue, yellow
        slot = w // 3
        out = Image.new("RGBA", (w * 4, h * 4), YEL)
        for j, (d, box) in enumerate([c["yheads"][2 * i], c["bheads"][i], c["yheads"][2 * i + 1]]):
            im = Image.open(ART / f"{d}.webp").convert("RGBA").crop(fit(box, slot / h))
            ws = slot if j < 2 else w - 2 * slot
            out.paste(im.resize((ws * 4, h * 4), Image.LANCZOS), (j * slot * 4, 0))
        return out
    if kind == "face":
        d, box = c["faces"][i]
        im = Image.open(ART / f"{d}.webp").convert("RGBA").crop(fit(box, w / h))
        return im.resize((w * 4, h * 4), Image.LANCZOS)
    big = 2 if h >= 32 else 1   # how much a 32x32 drawing is enlarged; a 64x64 one by half that
    picks = ROW if many else [DOTS[i] + (32,)]   # many: all three in a row, each playing its own animation
    slot = w // len(picks)
    out = Image.new("RGBA", (w * 4, h * 4), YEL)
    x = (w - slot * len(picks)) // 2
    for d, row, size in picks:
        k = max(1, big * 32 // size)
        n, cols = min(size, h // k), min(size, slot // k)
        top = max(0, min(size - n, row - n // 2))
        left = (size - cols) // 2
        g = grid32(d, i * STEP if many else 0, size).crop((left, top, left + cols, top + n))
        g = g.resize((cols * k * 4, n * k * 4), Image.NEAREST)
        out.paste(g, ((x + (slot - cols * k) // 2) * 4, (h - n * k) // 2 * 4))
        x += slot
    return out


def picture(W: int, H: int, a: Image.Image, xy: tuple, ground) -> Image.Image:
    """Put together at 4x, then LANCZOS to 2x and NEAREST to 1x so the outlines go jagged."""
    c = Image.new("RGB", (W * 4, H * 4), ground)
    c.paste(a, (xy[0] * 4, xy[1] * 4), a)
    return c.resize((W * 2, H * 2), Image.LANCZOS).resize((W, H), Image.NEAREST).point(LUT * 3)


def fade(f: Image.Image, x0: int, y0: int, y1: int, ground, step: int = 4) -> None:
    """The picture's left edge (from x0) melts into the ground in checker steps (no gradient):
    1/4, 1/2, 3/4 of the dots kept, then all."""
    px, g = f.load(), snap(ground)
    for k, keep in enumerate((1, 2, 3)):
        for dx in range(step):
            x = x0 + k * step + dx
            for y in range(y0, y1 + 1):
                on = (x + y) % 2 == 0 if keep == 2 else (x % 2 == 0 and y % 2 == 0) if keep == 1 else not (x % 2 and y % 2)
                if not on:
                    px[x, y] = g


def framed(f: Image.Image, c: dict) -> Image.Image:
    ImageDraw.Draw(f).rectangle((0, 0, f.width - 1, f.height - 1), outline=snap(c["frame"]))
    return f


def named(W: int, H: int, kind: str, i: int, c: dict, mx: int, top: int, bottom: int, title: tuple, sub: tuple) -> Image.Image:
    """The name on the left, the picture on the right. The picture takes the rows of the letters
    (top to bottom), starts mx dots after the end of the letters (the air left of them), and keeps
    the same air from the right frame as from the top one. title / sub: (x, y, k) of the big name and the small line."""
    tw = max(title[0] + lettering("Tobokegao", MID).width * title[2], sub[0] + lettering("Tobokegao's homepage", SMALL).width)
    x0, x1 = tw + mx, W - top
    a = art(kind, i, x1 - x0, bottom - top + 1, c, many=W >= 468)
    f = picture(W, H, a, (x0, top), c["ground"])
    # shrinking (and later the dither) smears the picture's edge a dot or two into the air around it:
    # wipe that back to the ground now, and again after the colours are cut (see quant)
    f.info["air"] = [(x0, 1, W - 2, top - 1), (x0, bottom + 1, W - 2, H - 2), (x1, 1, W - 2, H - 2)]
    d = ImageDraw.Draw(f)
    for r in f.info["air"]:
        d.rectangle(r, fill=snap(c["ground"]))
    fade(f, x0, top, bottom, c["ground"])
    letter(f, title[:2], "Tobokegao", MID, c["name"], c["rings"], title[2])
    letter(f, sub[:2], "Tobokegao's homepage", SMALL, c["small"], ((c["small_ring"], 1),))   # over the big ring, so its feet stay whole
    return framed(f, c)


def b468(kind: str, i: int, c: dict) -> Image.Image:
    # the 200x40 name twice as large: 38 rows; 3 dots above the small line, 3 below the g
    return named(468, 60, kind, i, c, 13, 4, 55, (14, 18, 2), (16, 4))


def b200(kind: str, i: int, c: dict) -> Image.Image:
    # 2 dots above the small line, 3 below the g
    return named(200, 40, kind, i, c, 7, 3, 36, (8, 17, 1), (8, 3))   # the picture: 2 dots of air on three sides


def b88(kind: str, i: int, c: dict) -> Image.Image:
    """A plain ground, the name, a small face at the right (no room for air around it)."""
    aw = 24   # the name takes 55 dots with its ring, 3 dots of air each side
    if kind == "face":
        d, box = c["faces"][i]
        a = Image.open(ART / f"{d}.webp").convert("RGBA").crop(box)
        a = a.resize((round(a.width * 29 * 4 / a.height), 29 * 4), Image.LANCZOS)
    else:
        d, row = DOTS[i]
        top = max(0, min(3, row - 14))
        a = grid32(d).crop((0, top, 32, top + 29)).resize((32 * 4, 29 * 4), Image.NEAREST).convert("RGBA")
    f = picture(88, 31, a, (87 - aw, 1), c["g88"])
    ImageDraw.Draw(f).rectangle((1, 1, 86 - aw, 29), fill=snap(c["g88"]))
    letter(f, (5, 10), "Tobokegao", SMALL, c["n88"], ((c["r88"], 1),))
    return framed(f, c)


# file names say large / medium / small, not 468x60: ad blockers stop any image named for the old ad size
SIZES = {(468, 60, "large"): b468, (200, 40, "medium"): b200, (88, 31, "small"): b88}


def save(name: str, frames: list, c: dict, zoom: Path | None, ms: int = 1500, dither: bool = True) -> None:
    if len(frames) > 3:   # a long animation: one palette for all, so each frame only stores what moved
        strip = Image.new("RGB", (frames[0].width, frames[0].height * len(frames)))
        for k, f in enumerate(frames):
            strip.paste(f, (0, k * f.height))
        q = [quant(f, c, strip, dither) for f in frames]
    else:   # three frames: each its own palette, as the 90s GIF tools did
        q = [quant(f, c, dither=dither) for f in frames]
    q[0].save(OUT / f"{name}.gif", save_all=True, append_images=q[1:], duration=ms, loop=0, optimize=False, disposal=1)
    q[0].save(OUT / f"{name}-still.gif")
    if zoom:
        for i, f in enumerate(q):
            f.convert("RGB").resize((f.width * 4, f.height * 4), Image.NEAREST).save(zoom / f"{name}-{i}@4x.png")
    print(f"{name}.gif {(OUT / f'{name}.gif').stat().st_size // 1024 + 1}KB")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--zoom", type=Path)
    a = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("tobokegao-*"):
        old.unlink()
    if a.zoom:
        a.zoom.mkdir(parents=True, exist_ok=True)
    for (W, H, size), make in SIZES.items():
        for kind in ("face", "dot"):
            for cname, c in COLOURS.items():
                if W == 468 and kind == "dot":
                    frames = [make(kind, t, c) for t in range(LOOP // STEP)]
                    save(f"tobokegao-{size}-{kind}-{cname}", frames, c, a.zoom, STEP, dither=False)
                else:
                    frames = [make(kind, i, c) for i in range(3)]
                    save(f"tobokegao-{size}-{kind}-{cname}", frames, c, a.zoom, dither=kind == "face")


if __name__ == "__main__":
    main()

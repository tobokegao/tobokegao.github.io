"""Cut the dot fonts down to the characters the site actually uses.

The full Japanese dot fonts are 1.5-1.7 MB each. Every character that can reach a
page comes from content/, data/, layouts/, i18n or the config, so collecting those
and subsetting gives files of a few hundred KB. Run before `hugo`:

    python scripts/subset_fonts.py

Fonts (same pairing as TRACKMENTO):
- phones: JF Dot M+ 12 at 12px            -> static/fonts/gen/dot12.woff2
- PC:     "TM Dot PC" at 15px = Galmuri14 (Japanese, lowered 2 dots)
          + JF Dot Shinonome 14 (ASCII)   -> static/fonts/gen/pc-ja.woff2, pc-latin.woff2
"""

from __future__ import annotations

from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "fonts-src"
OUT = ROOT / "static" / "fonts" / "gen"
TEXT_DIRS = ["content", "data", "layouts", "i18n"]
TEXT_FILES = ["hugo.toml"]

ASCII = set(range(0x20, 0x7F))
# Always include kana and common punctuation so new titles from feeds rarely miss.
BASE = ASCII | set(range(0x3000, 0x3100)) | set(range(0xFF01, 0xFF5F)) | {0x2192, 0x2190, 0x2026, 0x2014, 0x301C}


def site_codepoints() -> set[int]:
    cps = set(BASE)
    paths = [ROOT / f for f in TEXT_FILES]
    for d in TEXT_DIRS:
        paths += [p for p in (ROOT / d).rglob("*") if p.is_file() and p.suffix in {".md", ".json", ".toml", ".html", ".yaml"}]
    for p in paths:
        cps |= {ord(c) for c in p.read_text("utf-8", errors="ignore")}
    return {c for c in cps if c >= 0x20}


def snap_grid(font: TTFont, dots: int, upm_out: int) -> None:
    """Put every outline point exactly on the font's dot grid.

    JF Dot fonts use 1024 units per em, so one dot of a 14-dot font is 73.14 units and
    the points are rounded near, not on, the pixel grid; browsers then blur the edges.
    Here each coordinate is rounded to whole dots and one dot becomes exactly 100 units.
    upm_out sets the size the font is used at: 1500 draws a 14-dot font at 15px on a
    1px-per-dot grid (the PC pairing with Galmuri14), 1200 a 12-dot font at 12px."""
    k = 100
    q = lambda v: round(v * dots / 1024) * k
    glyf = font["glyf"]
    for name in font.getGlyphOrder():
        g = glyf[name]
        if g.numberOfContours > 0:
            g.coordinates = type(g.coordinates)([(q(x), q(y)) for x, y in g.coordinates])
        elif g.isComposite():
            for c in g.components:
                c.x, c.y = q(c.x), q(c.y)
    hmtx = font["hmtx"]
    for name, (adv, lsb) in list(hmtx.metrics.items()):
        hmtx.metrics[name] = (q(adv), q(lsb))
    if "vmtx" in font:
        for name, (adv, tsb) in list(font["vmtx"].metrics.items()):
            font["vmtx"].metrics[name] = (q(adv), q(tsb))
    font["head"].unitsPerEm = upm_out
    hhea = font["hhea"]
    hhea.ascent, hhea.descent, hhea.lineGap = q(hhea.ascent), q(hhea.descent), q(hhea.lineGap)
    os2 = font["OS/2"]
    for a in ("sTypoAscender", "sTypoDescender", "sTypoLineGap", "usWinAscent", "usWinDescent",
              "sxHeight", "sCapHeight", "xAvgCharWidth"):
        if hasattr(os2, a):
            v = getattr(os2, a)
            setattr(os2, a, abs(q(v)) if a.startswith("us") else q(v))
    font.recalcBBoxes = True


def set_vmetrics(font: TTFont, ascent: int, descent: int) -> None:
    """Give the font the same line metrics as another face of its family. Browsers take
    the line box of "TM Dot PC" from the Japanese face, whose taller ascent (15 dots,
    plus a line gap) put every PC line 2-3px below the middle of its box."""
    hhea, os2 = font["hhea"], font["OS/2"]
    hhea.ascent, hhea.descent, hhea.lineGap = ascent, -descent, 0
    os2.sTypoAscender, os2.sTypoDescender, os2.sTypoLineGap = ascent, -descent, 0
    os2.usWinAscent, os2.usWinDescent = ascent, descent


def make(src: str, out: str, cps: set[int], grid: tuple[int, int] | None = None,
         vmetrics: tuple[int, int] | None = None) -> None:
    font = TTFont(SRC / src)
    available = set(font.getBestCmap())
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["*"]
    opts.hinting = False
    opts.notdef_outline = True
    sub = subset.Subsetter(options=opts)
    sub.populate(unicodes=sorted(cps & available))
    sub.subset(font)
    if grid:
        snap_grid(font, *grid)
    if vmetrics:
        set_vmetrics(font, *vmetrics)
    OUT.mkdir(parents=True, exist_ok=True)
    font.flavor = "woff2"
    font.save(OUT / out)
    print(f"{out}: {len(cps & available)} chars, {(OUT / out).stat().st_size / 1024:.0f} KB")


def make_blocks(out: str) -> None:
    """A tiny font with the CP437 block characters used for the ANSI-art banner.
    The dot fonts lack them, and a fallback font would break the monospaced grid, so each
    glyph here is exactly half an em wide and fills the full line height:
    full block, upper and lower halves, and the three shades drawn as dot screens."""
    from fontTools.fontBuilder import FontBuilder
    from fontTools.pens.ttGlyphPen import TTGlyphPen

    upm, w, asc, desc = 1000, 500, 800, 200
    cell = 125  # the shades are drawn on a 4 x 8 grid of 125-unit dots

    def rects(boxes):
        pen = TTGlyphPen(None)
        for x0, y0, x1, y1 in boxes:
            pen.moveTo((x0, y0)); pen.lineTo((x0, y1)); pen.lineTo((x1, y1)); pen.lineTo((x1, y0)); pen.closePath()
        return pen.glyph()

    def shade(density):
        boxes = []
        for r in range(8):
            for c in range(4):
                on = {1: r % 2 == 0 and c % 2 == (r // 2) % 2,       # light shade, 1 in 4
                      2: (r + c) % 2 == 0,                            # medium, checkerboard
                      3: not (r % 2 == 0 and c % 2 == (r // 2) % 2)}[density]  # dark, 3 in 4
                if on:
                    boxes.append((c * cell, -desc + r * cell, (c + 1) * cell, -desc + (r + 1) * cell))
        return rects(boxes)

    glyphs = {
        ".notdef": rects([]),
        "space": rects([]),
        # solid blocks overlap their cell by a hair so no seam shows between neighbours
        "full": rects([(-6, -desc - 6, w + 6, asc + 6)]),
        "upper": rects([(-6, (asc - desc) // 2, w + 6, asc + 6)]),
        "lower": rects([(-6, -desc - 6, w + 6, (asc - desc) // 2)]),
        "light": shade(1), "medium": shade(2), "dark": shade(3),
    }
    cmap = {0x20: "space", 0x2588: "full", 0x2580: "upper", 0x2584: "lower",
            0x2591: "light", 0x2592: "medium", 0x2593: "dark"}
    fb = FontBuilder(upm, isTTF=True)
    fb.setupGlyphOrder(list(glyphs))
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(glyphs)
    fb.setupHorizontalMetrics({g: (w, 0) for g in glyphs})
    fb.setupHorizontalHeader(ascent=asc, descent=-desc)
    fb.setupNameTable({"familyName": "TBK Blocks", "styleName": "Regular"})
    fb.setupOS2(sTypoAscender=asc, sTypoDescender=-desc, usWinAscent=asc, usWinDescent=desc)
    fb.setupPost()
    fb.font.flavor = "woff2"
    OUT.mkdir(parents=True, exist_ok=True)
    fb.save(str(OUT / out))
    print(f"{out}: block characters, {(OUT / out).stat().st_size} bytes")


def main() -> None:
    cps = site_codepoints()
    make("JF-Dot-MPlus12.ttf", "dot12.woff2", cps, grid=(12, 1200))
    make("Galmuri14-Down2.ttf", "pc-ja.woff2", cps - ASCII,          # already 100 units per dot
         vmetrics=(1200, 200))                                        # = pc-latin: 12 dots up, 2 down
    make("JF-Dot-Shinonome14.ttf", "pc-latin.woff2", ASCII, grid=(14, 1500))
    make_blocks("blocks.woff2")


if __name__ == "__main__":
    main()

"""Lettering for the link banners (scripts/link_banners.py): every dot placed by hand, no font.
Each glyph is (ascender rows, x-height rows, descender rows); missing parts are blank.
"#" is a stroke, "@" a dakuten (drawn the same; kept apart so it can be told apart when editing)."""
from PIL import Image

# Mid: stems 3 dots, bars 2, x-height 10, ascender 5, descender 4 (the name in 200x40, with room around it)
MID = dict(asc=5, x=10, desc=4, gap=2, glyphs={
    "T": (["###########"] * 2 + ["....###...."] * 3, ["....###...."] * 10, []),
    "o": ([], ["..######..", ".########."] + ["###....###"] * 6 + [".########.", "..######.."], []),
    "b": (["###......."] * 5,
          ["########..", "#########."] + ["###....###"] * 6 + ["#########.", "########.."], []),
    "k": (["###......."] * 5,
          ["###...###.", "###..###..", "###.###...", "######....", "#####.....", "######....",
           "###.###...", "###..###..", "###...###.", "###....###"], []),
    "e": ([], ["..######..", ".########.", "###....###", "###....###", "##########", "##########",
               "###.......", "###....###", ".########.", "..######.."], []),
    "a": ([], ["..######..", ".########.", ".......###", "..########", ".#########", "###....###",
               "###....###", "###....###", ".#########", "..########"], []),
    "g": ([], ["..########", ".#########"] + ["###....###"] * 6 + [".#########", "..########"],
          [".......###", "###....###", ".########.", "..######.."]),
})

def _kana(rows):
    """A kana glyph: every one fills the same 20 x 15 box (no ascender or descender)."""
    assert len(rows) == 15 and all(len(r) == 20 for r in rows)
    return ([], rows, [])


# Kana for the name, after Dela Gothic One (SIL Open Font License; used as a guide, not shipped).
# Every glyph sits in the same box, the font's full width by the height of と, drawn 20 x 15 so the
# name is a little flatter than square; stems 4 dots, bars 3. Edited dot by dot by Tobokegao (2026-10-20).
KANA = dict(asc=0, x=15, desc=0, gap=1, glyphs={
    "と": _kana([
        "..####..............",
        "..####..............",
        "..####........####..",
        "...####....#######..",
        "...###############..",
        "....###########.....",
        "...#########........",
        "..######............",
        ".#####..............",
        ".####...............",
        ".####...............",
        ".####...............",
        ".#################..",
        "..################..",
        "....##############..",
    ]),
    "ぼ": _kana([
        "..............@@.@@.",
        "####..#######..@@.@@",
        "####..#############.",
        "####..#############.",
        "####......####......",
        "####.############...",
        "####.#############..",
        "####.#############..",
        "####......####......",
        "####....########....",
        "####..###########...",
        "####.####..#######..",
        "####.###..#########.",
        "####.########..####.",
        ".###..######....###.",
    ]),
    "け": _kana([
        "....................",
        ".####.......####....",
        ".####.......####....",
        ".####..############.",
        ".####..############.",
        ".####..############.",
        ".####.......####..#.",
        ".####.......####....",
        ".####.......####....",
        ".####.......####....",
        ".####.......####....",
        ".####......#####....",
        ".####......#####....",
        ".#####....#####.....",
        "..####....####......",
    ]),
    "が": _kana([
        "..............@@.@@.",
        "....####.....@@@@@@.",
        "....####.....@@.@@..",
        "############........",
        "##############.####.",
        "##############.####.",
        "...####...####.####.",
        "...####...####.####.",
        "...####...####.####.",
        "..#####...####....#.",
        "..####....####......",
        ".#####....####......",
        ".####..#######......",
        "#####..######.......",
        "####...#####........",
    ]),
    "お": _kana([
        "....................",
        ".....####.......###.",
        ".....####.......###.",
        ".##############.###.",
        ".##############.###.",
        ".##############...#.",
        ".....####...........",
        ".....##########.....",
        "..##############....",
        ".################...",
        "####.####.....###...",
        "###..####.....###...",
        "#########..######...",
        ".########..######...",
        "..######....####....",
    ]),
})

# Small: stems 2 dots, bars 1, x-height 7, ascender 3, descender 2
SMALL = dict(asc=3, x=7, desc=2, gap=1, glyphs={
    "T": (["######", "..##..", "..##.."], ["..##.."] * 7, []),   # bar 1 dot, like the other bars
    "o": ([], [".###."] + ["##.##"] * 5 + [".###."], []),
    "b": (["##..."] * 3, ["####."] + ["##.##"] * 5 + ["####."], []),
    "k": (["##..."] * 3, ["##.##", "##.##", "####.", "###..", "####.", "##.##", "##.##"], []),
    "e": ([], [".###.", "##.##", "##.##", "#####", "##...", "##...", ".####"], []),
    "a": ([], [".###.", "...##", ".####", "##.##", "##.##", "##.##", ".####"], []),
    "g": ([], [".####"] + ["##.##"] * 5 + [".####"], ["...##", ".###."]),
    "'": (["##", "##", ".#"], [".."] * 7, []),
    "s": ([], [".####", "##...", "##...", ".###.", "...##", "...##", "####."], []),
    "h": (["##..."] * 3, ["####."] + ["##.##"] * 6, []),
    "m": ([], ["######."] + ["##.#.##"] * 6, []),
    "p": ([], ["####."] + ["##.##"] * 5 + ["####."], ["##...", "##..."]),
    " ": ([], ["..."] * 7, []),
})


# Tiny: stems 1 dot, x-height 5, ascender 2, descender 2 (the small line of 200x40, under a name 104 dots wide)
TINY = dict(asc=2, x=5, desc=2, gap=1, glyphs={
    "T": (["###", ".#."], [".#."] * 5, []),
    "o": ([], [".#.", "#.#", "#.#", "#.#", ".#."], []),
    "b": (["#..", "#.."], ["##.", "#.#", "#.#", "#.#", "##."], []),
    "k": (["#..", "#.."], ["#.#", "#.#", "##.", "#.#", "#.#"], []),
    "e": ([], [".#.", "#.#", "###", "#..", ".##"], []),
    "g": ([], [".##", "#.#", "#.#", "#.#", ".##"], ["..#", "##."]),
    "a": ([], ["##.", "..#", ".##", "#.#", ".##"], []),
    "'": (["#", "#"], ["."] * 5, []),
    "s": ([], [".##", "#..", ".#.", "..#", "##."], []),
    "h": (["#..", "#.."], ["##.", "#.#", "#.#", "#.#", "#.#"], []),
    "m": ([], ["####.", "#.#.#", "#.#.#", "#.#.#", "#.#.#"], []),
    "p": ([], ["##.", "#.#", "#.#", "#.#", "##."], ["#..", "#.."]),
    " ": ([], [".."] * 5, []),
})
TINY["sb"] = {"T": (0, 0), " ": (0, 0)}
TINY["kern"] = {}   # T's stem is a single dot in the middle: o already sits a dot away

# Spacing (the HOHOH idea): stems get the most room, rounds less, diagonals and open sides least.
# These rounds are boxes with a dot off each corner, so they space like stems here; what is left
# is the open side of T, whose arm reaches over the next letter, so that pair is kerned.
MID["sb"] = {"T": (0, 0)}
MID["kern"] = {"To": -2, "ke": -1}   # o sits 2 dots from the stem, under the arm; k opens to the right, so e comes a dot closer
SMALL["sb"] = {"T": (0, 0), " ": (0, 0)}
SMALL["kern"] = {"To": -1}


def lettering(text, face, even=None):
    """A 1-bit mask ('L', 0/255) of the text, all glyphs on one baseline.
    even=n spaces every pair by n dots (the old way, for comparing)."""
    a, x, d, gl = face["asc"], face["x"], face["desc"], face["glyphs"]
    sb, kern = face.get("sb", {}), face.get("kern", {})
    def gap(p, q):
        if even is not None:
            return even
        none = (0, face["gap"])   # a glyph with no entry keeps the plain gap
        return sb.get(p, none)[1] + sb.get(q, none)[0] + kern.get(p + q, 0)
    H = a + x + d
    cols = []
    for i, ch in enumerate(text):
        asc, xr, desc = gl[ch]
        w = len(xr[0])
        rows = ["." * w] * (a - len(asc)) + asc + xr + desc + ["." * w] * (d - len(desc))
        assert len(rows) == H and all(len(r) == w for r in rows), ch
        cols.append(rows)
    xs, ox = [], 0
    for i, rows in enumerate(cols):
        if i:
            ox += len(cols[i - 1][0]) + gap(text[i - 1], text[i])
        xs.append(ox)
    W = max(xo + len(r[0]) for xo, r in zip(xs, cols))
    m = Image.new("L", (W, H), 0)
    px = m.load()
    for ox, rows in zip(xs, cols):
        for y, r in enumerate(rows):
            for cx, c in enumerate(r):
                if c in "#@":   # "@" marks a dakuten; it is drawn like any stroke (the air around it is set by hand)
                    px[ox + cx, y] = 255
    return m

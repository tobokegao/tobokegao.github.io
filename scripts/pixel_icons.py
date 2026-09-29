"""Generate the site's 16x16 pixel-art icons as Hugo partials (inline SVG).

Edit a bitmap below and run:  python scripts/pixel_icons.py
Output: layouts/_partials/icons/<name>.html

Drawing rules followed here (the usual pixel-art guidance, e.g. Lospec's line
and jaggies tutorials):
- one pixel per stroke, no doubled corners; diagonals keep one slope (1:1)
- curves step through even segment lengths (4-2-1-1-2-4...), never zig-zag
- flat brand color + one detail color, no gradients or anti-aliasing
- each icon reads by silhouette alone at 16px (rounded tile, circle, TV...)

Twitter and GitHub start from the official marks rendered small in a browser, then
are corrected by hand (GitHub's ears vanish when simply downscaled).

Bitmap characters: "." transparent, "#" = currentColor, other letters = PALETTE.
"""

from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "layouts" / "_partials" / "icons"

PALETTE = {
    "k": "#000000",
    "t": "#1d9bf0",  # Twitter blue
    "y": "#1185fe",  # Bluesky
    "w": "#ffffff",
    "r": "#ff0033",  # YouTube
    "o": "#ff5500",  # SoundCloud
    "b": "#1da0c3",  # Bandcamp
    "g": "#1ed760",  # Spotify
    "p": "#fa2d48",  # Apple Music
    "h": "#24292f",  # GitHub
    "n": "#252525",  # niconico
}

# A 16x16 tile with its corners cut by one pixel: the shared silhouette of app icons.
TILE = [".xxxxxxxxxxxxxx."] + ["x" * 16] * 14 + [".xxxxxxxxxxxxxx."]
DISC = [
    ".....xxxxxx.....",
    "...xxxxxxxxxx...",
    "..xxxxxxxxxxxx..",
    ".xxxxxxxxxxxxxx.",
    ".xxxxxxxxxxxxxx.",
    "xxxxxxxxxxxxxxxx",
    "xxxxxxxxxxxxxxxx",
    "xxxxxxxxxxxxxxxx",
    "xxxxxxxxxxxxxxxx",
    "xxxxxxxxxxxxxxxx",
    "xxxxxxxxxxxxxxxx",
    ".xxxxxxxxxxxxxx.",
    ".xxxxxxxxxxxxxx.",
    "..xxxxxxxxxxxx..",
    "...xxxxxxxxxx...",
    ".....xxxxxx.....",
]


def on(base, color, overlay):
    """Fill a base silhouette with a color, then paint the overlay's non-dot pixels."""
    rows = []
    for brow, orow in zip(base, overlay):
        rows.append("".join(o if o != "." else (color if b == "x" else ".") for b, o in zip(brow, orow)))
    return rows


def grid(text):
    return [r for r in text.strip("\n").split("\n")]



# Icons that turn round on hover: frames of the artist's own pixel figure ("diary 135",
# https://x.com/to6okegao/status/1534502173144678400), read off its 16x16 grid. "#" is the
# hair, eyes and body (currentColor), "+" the face, drawn in a dimmer currentColor so the
# figure still reads in one color from every side. Frame 0 faces front and is shown at rest.
SPIN = {"tab-about": [
    [
        "................",
        "....########....",
        ".##.########.##.",
        ".##.#+#+#+#+.##.",
        "#..+##+++++##..#",
        "...+##+++++##...",
        "...+##+..++##...",
        "...+++#++#+++...",
        "....+++##+++....",
        "................",
        "....#.####.#....",
        "...#..####..#...",
        ".....######.....",
        "................",
        "......#..#......",
        "................",
    ],
    [
        "................",
        "....########....",
        "..##.#########..",
        "..##.##++#+###..",
        ".#..##+##+++#.#.",
        "...##++##+++#...",
        "...+#++##+..#...",
        "...++++++#+++...",
        "....++++++##....",
        "................",
        ".....######.....",
        "....#.####.#....",
        ".....######.....",
        "................",
        "......#.#.......",
        "................",
    ],
    [
        "................",
        "....########....",
        "...##.#######...",
        "...##.##++###...",
        "..#..##+##++#...",
        "...####+##+++...",
        "...##+#+##+.....",
        "...#++++++#++...",
        ".....+++++##....",
        "................",
        ".......###......",
        ".......###......",
        "......#####.....",
        "................",
        ".......##.......",
        "................",
    ],
    [
        "................",
        ".....#######....",
        "....###.#####...",
        "....###.#++##...",
        "...###.#++#+#...",
        "...#####++#++...",
        "...###+#++#+....",
        "....#++++++++...",
        ".....++++++#....",
        "................",
        "......#####.....",
        "......####.#....",
        ".....######.....",
        "................",
        ".......##.......",
        "................",
    ],
    [
        "................",
        "....########....",
        "..#######.###...",
        "..#######.###...",
        ".#.#####.##+#...",
        "...#######++#...",
        "...#######++#...",
        "...+#####++++...",
        "....+++++++#....",
        "................",
        ".....######.....",
        "....#.####.#....",
        ".....######.....",
        "................",
        "......#.#.......",
        "................",
    ],
    [
        "................",
        "....########....",
        ".##.########.##.",
        ".##.########.##.",
        "#..##########..#",
        "...##########...",
        "...##########...",
        "...++######++...",
        "....++++++++....",
        "................",
        "....#.####.#....",
        "...#..####..#...",
        ".....######.....",
        "................",
        "......#..#......",
        "................",
    ],
    [
        "................",
        "....########....",
        "...###.#######..",
        "...###.#######..",
        "...+###.#####.#.",
        "...+#+#######...",
        "...+#+#######...",
        "...++++#####+...",
        "....#+++++++....",
        "................",
        ".....######.....",
        "....#.####.#....",
        ".....######.....",
        "................",
        ".......#.#......",
        "................",
    ],
    [
        "................",
        "....#######.....",
        "...#####.###....",
        "...##++#.###....",
        "...+++#+#.###...",
        "...+++#+#####...",
        "....++#+#+###...",
        "...++++++++#....",
        "....#++++++.....",
        "................",
        ".....######.....",
        "....#.####.#....",
        ".....######.....",
        "................",
        ".......##.......",
        "................",
    ],
    [
        "................",
        "....########....",
        "...#######.##...",
        "...###++##.##...",
        "...#+++####..#..",
        "...++++######...",
        ".....++###+##...",
        "...++#++++++#...",
        "....##+++++.....",
        "................",
        "......###.......",
        "......###.......",
        ".....#####......",
        "................",
        ".......##.......",
        "................",
    ],
    [
        "................",
        "....########....",
        "..#########.##..",
        "..###+#++##.##..",
        ".#.+#+++####..#.",
        "...+#+++##+##...",
        "...+..++##+#+...",
        "...+++#++++++...",
        "....##++++++....",
        "................",
        ".....######.....",
        "....#.####.#....",
        ".....######.....",
        "................",
        ".......#.#......",
        "................",
    ],
  ]}

ICONS = {
    "x": grid("""
................
................
................
.........tt.....
...t....tttttt..
...tt...ttttt...
...tttttttttt...
...ttttttttt....
....tttttttt....
....tttttttt....
.....tttttt.....
.....ttttt......
....tttt........
................
................
................
"""),
    "bluesky": grid("""
................
................
.yy..........yy.
.yyy........yyy.
.yyyy......yyyy.
.yyyyy....yyyyy.
..yyyyy..yyyyy..
..yyyyyyyyyyyy..
...yyyyyyyyyy...
....yyyyyyyy....
...yyyy..yyyy...
..yyyyy..yyyyy..
..yyyy....yyyy..
...yy......yy...
................
................
"""),
    "youtube": grid("""
................
................
..rrrrrrrrrrrr..
.rrrrrrrrrrrrrr.
rrrrrrrrrrrrrrrr
rrrrrrrwrrrrrrrr
rrrrrrrwwrrrrrrr
rrrrrrrwwwrrrrrr
rrrrrrrwwwrrrrrr
rrrrrrrwwrrrrrrr
rrrrrrrwrrrrrrrr
rrrrrrrrrrrrrrrr
.rrrrrrrrrrrrrr.
..rrrrrrrrrrrr..
................
................
"""),
    "niconico": grid("""
....k......k....
.....k....k.....
......k..k......
kkkkkkkkkkkkkkkk
kwwwwwwwwwwwwwwk
kwkkkkkkkkkkkkwk
kwkwwwwwwwwwwkwk
kwkwwwwwwwkkwkwk
kwkwkkwwwwkkwkwk
kwkwkkwwwwwwwkwk
kwkwwwwkkwwwwkwk
kwkwwwkkkkwwwkwk
kwkwwwwwwwwwwkwk
kwkkkkkkkkkkkkwk
kwwwwwwwwwwwwwwk
kkkkkkkkkkkkkkkk
"""),
    "soundcloud": on(TILE, "o", grid("""
................
................
................
................
................
.........wwww...
......w.wwwwww..
....w.w.wwwwww..
..w.w.w.wwwwww..
..w.w.w.wwwwww..
..w.w.w.wwwwww..
................
................
................
................
................
""")),
    "bandcamp": on(TILE, "b", grid("""
................
................
................
................
................
........wwwww...
.......wwwww....
......wwwww.....
.....wwwww......
....wwwww.......
...wwwww........
................
................
................
................
................
""")),
    # three thin, flat arches, symmetric, shrinking downward (12, 10, 8 wide)
    "spotify": on(DISC, "g", grid("""
................
................
................
................
....kkkkkkkk....
..kk........kk..
................
.....kkkkkk.....
...kk......kk...
................
......kkkk......
....kk....kk....
................
................
................
................
""")),
    "apple": on(TILE, "p", grid("""
................
................
................
......wwwwwww...
......wwwwwww...
......w.....w...
......w.....w...
......w.....w...
......w.....w...
......w.....w...
....www...www...
...wwww..wwww...
...www...www....
................
................
................
""")),
    "github": grid("""
......hhhh......
....hhhhhhhh....
..hhhhhhhhhhhh..
.hhhwhhhhhhwhhh.
.hhhwwhhhhwwhhh.
hhhwwwwwwwwwwhhh
hhhwwwwwwwwwwhhh
hhhwwwwwwwwwwhhh
hhhwwwwwwwwwwhhh
hhhhwwwwwwwwhhhh
.hhhhwwwwwwhhhh.
.hhwhhwwwwhhhhh.
..hhwwwwwwhhhh..
...hhhwwwwhhh...
....hhwwwwhh....
................
"""),
    # any other site (the activity log links): a globe, drawn in the text color
    "web": grid("""
.....######.....
...##..##..##...
..#...#..#...#..
.#...#....#...#.
.#...#....#...#.
################
#....#....#....#
#....#....#....#
#....#....#....#
#....#....#....#
################
.#...#....#...#.
.#...#....#...#.
..#...#..#...#..
...##..##..##...
.....######.....
"""),
    "play": grid("""
................
................
................
......#.........
......##........
......###.......
......####......
......#####.....
......#####.....
......####......
......###.......
......##........
......#.........
................
................
................
"""),
    # menubar items (Releases / Videos / News / About), drawn yellow by CSS; each
    # drawing is centred vertically so the four line up with each other and the text
    "tab-releases": grid("""
................
................
.....######.....
...##########...
..############..
.##############.
.##############.
.######..######.
.######..######.
.##############.
.##############.
..############..
...##########...
.....######.....
................
................
"""),
    "tab-videos": grid("""
................
................
................
.##############.
.##############.
.#####.########.
.#####..#######.
.#####...######.
.#####....#####.
.#####...######.
.#####..#######.
.#####.########.
.##############.
.##############.
................
................
"""),
    "tab-designs": grid("""
................
................
.##############.
.##############.
.##########..##.
.##########..##.
.##############.
.#####.########.
.####...#######.
.###.....###.##.
.##.......#...#.
.#............#.
.##############.
.##############.
................
................
"""),  # a framed picture: sun and mountains knocked out
    "tab-news": grid("""
................
................
................
.##############.
.##############.
.##..#.......##.
.##############.
.##############.
.##..#.......##.
.##############.
.##############.
.##..#....#####.
.##############.
.##############.
................
................
"""),  # the log: bullet rows knocked out
    "tab-post": grid("""
................
................
..#########.....
..##########....
..########.##...
..########..##..
..############..
..##.......###..
..############..
..##.......###..
..############..
..##.....#####..
..############..
..############..
................
................
"""),
    "tab-about": SPIN["tab-about"][0],   # still: facing front (the frames are below)
    "sun": grid("""
................
.......##.......
......####......
...##......##...
...##......##...
......####......
..#..######..#..
.##..######..##.
.##..######..##.
..#..######..#..
......####......
...##......##...
...##......##...
......####......
.......##.......
................
"""),  # diagonal rays are 2x2 blocks: single dots were hard to see
    "moon": grid("""
................
.....###........
...####.........
..####..........
..###...........
.####...........
.####...........
.####...........
.####.........#.
.#####.......##.
..#####.....###.
..############..
...###########..
....#########...
......#####.....
................
"""),
}


NO_OUTLINE = {"sun", "moon", "play", "web", "tab-releases", "tab-videos", "tab-designs", "tab-news", "tab-post", "tab-about"}  # line icons; a ring would fill the gaps between rays


def to_svg(rows, outline=True):
    """16x16 bitmap -> 18x18 SVG with a one-pixel outline ring (8-neighbour),
    so icons stay readable on dark and light grounds. The ring's color comes from
    CSS (--px-outline) and follows the day/night scheme."""
    assert len(rows) == 16 and all(len(r) == 16 for r in rows), "icons must be 16x16"
    size = 18
    cells = [["."] * size for _ in range(size)]
    for y, row in enumerate(rows):
        for x, c in enumerate(row):
            cells[y + 1][x + 1] = c
    for y in range(size):
        for x in range(size):
            if not outline or cells[y][x] != ".":
                continue
            if any(0 <= y + dy < size and 0 <= x + dx < size and cells[y + dy][x + dx] not in (".", "@")
                   for dy in (-1, 0, 1) for dx in (-1, 0, 1)):
                cells[y][x] = "@"
    paths = {}
    for y, row in enumerate(cells):
        x = 0
        while x < size:
            c = row[x]
            if c == ".":
                x += 1
                continue
            start = x
            while x < size and row[x] == c:
                x += 1
            paths.setdefault(c, []).append(f"M{start} {y}h{x - start}v1h-{x - start}z")

    def fill(c):
        return {"#": 'fill="currentColor"', "@": 'class="px__o"'}.get(c) or f'fill="{PALETTE[c]}"'

    body = "".join(f'<path {fill(c)} d="{"".join(d)}"/>' for c, d in sorted(paths.items(), key=lambda kv: kv[0] != "@"))
    return (f'<svg class="px" viewBox="0 0 {size} {size}" width="{size}" height="{size}" aria-hidden="true" '
            f'focusable="false" shape-rendering="crispEdges">{body}</svg>')


def to_spin_svg(frames):
    """Frames -> one 18x18 SVG with a <g> per frame. Only frame 0 shows until the link is
    hovered; then CSS (.px--spin) steps through them."""
    size = 18
    groups = []
    for n, rows in enumerate(frames):
        assert len(rows) == 16 and all(len(r) == 16 for r in rows), "frames must be 16x16"
        paths = {}
        for y, row in enumerate(rows):
            x = 0
            while x < 16:
                c = row[x]
                if c == ".":
                    x += 1
                    continue
                start = x
                while x < 16 and row[x] == c:
                    x += 1
                paths.setdefault(c, []).append(f"M{start + 1} {y + 1}h{x - start}v1h-{x - start}z")
        body = "".join(f'<path {"class=\"px__dim\" " if c == "+" else ""}fill="currentColor" d="{"".join(d)}"/>'
                       for c, d in sorted(paths.items()))
        groups.append(f'<g class="spin__f" style="--i:{n}">{body}</g>')
    return (f'<svg class="px px--spin" viewBox="0 0 {size} {size}" width="{size}" height="{size}" aria-hidden="true" '
            f'focusable="false" shape-rendering="crispEdges" style="--n:{len(frames)}">{"".join(groups)}</svg>')


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.html"):
        old.unlink()
    for name, rows in ICONS.items():
        svg = to_spin_svg(SPIN[name]) if name in SPIN else to_svg(rows, name not in NO_OUTLINE)
        (OUT / f"{name}.html").write_text(svg, "utf-8")
    print(f"{len(ICONS)} icons -> {OUT}")


if __name__ == "__main__":
    main()

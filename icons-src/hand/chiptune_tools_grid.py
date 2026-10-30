"""The mark of the chiptune tools post: a thick dictionary lying open, after the old
desktop dictionary icons (a dark leather binding, gilt page edges): a sound chip on the
left page, entry lines on the right, and the stacked page edges below showing its
thickness. Drawn straight onto the 24x24 grid for scripts/hd_icons.py.
Writes icons-src/hd/chiptune-tools.txt (M = leather and ink, H = paper and gold); then run
    python scripts/hd_icons.py --only chiptune-tools
"""
from pathlib import Path

N = 24
PAGE_H = 10
BOARD = 2                           # the boards show two pixels thick below (one at the sides)
# the top edge of the left page, from the outer edge to the spine: the paper bows up from
# the outer edge and curves down into the gutter (1-1-5-1-1); the right page mirrors it
TOP = [6, 5, 4, 4, 4, 4, 4, 5, 6]
# the bottom edge rests flat on the board and only dips into the gutter
BOTTOM = [b + PAGE_H for b in (4, 4, 4, 4, 4, 4, 5, 5, 6)]
LEFT = 2                            # the left page runs x 2..10; the spine is x 11..12
CHIP = [                            # a black DIP chip seen from above: legs top and bottom,
    ".#.#.",                        # the pin-one dot in its corner
    ".#.#.",
    "#####",
    "#.###",
    "#####",
    "#####",
    ".#.#.",
    ".#.#.",
]
LINES = [(0, 3), (2, 6), (4, 5), (6, 6)]           # entry lines on the right page: (row, length)

rows = [["."] * N for _ in range(N)]


def put(y, x, c):
    if 0 <= y < N and 0 <= x < N:
        rows[y][x] = c


for i, top in enumerate(TOP):
    for x in (LEFT + i, N - 1 - LEFT - i):
        bottom = BOTTOM[i]
        put(top - 1, x, "M")                       # the page's edge against the sky
        for y in range(top, bottom + 1):
            put(y, x, "H")
        # below the page: the stacked page edges (gold, a dark line between) and the board
        for d, c in enumerate("MHMH" + "M" * BOARD, 1):
            put(bottom + d, x, c)
# the binding: the spine in the gutter and the boards' outer edges
for y in range(TOP[-1] - 1, TOP[-1] + PAGE_H + 5 + BOARD):
    put(y, LEFT + len(TOP), "M")
    put(y, LEFT + len(TOP) + 1, "M")
for y in range(TOP[0] - 1, BOTTOM[0] + 5 + BOARD):
    put(y, LEFT - 1, "M")
    put(y, N - LEFT, "M")
# the gutter's shade: the paper next to the spine dithered dark as it turns away
for y in range(N):
    for x in (LEFT + len(TOP) - 1, N - LEFT - len(TOP)):
        if rows[y][x] == "H" and y % 2 == 0 and rows[y - 1][x] == "H" and rows[y + 1][x] == "H":
            rows[y][x] = "M"
# the chip on the left page and the entry lines on the right
top = min(TOP) + 2 + (PAGE_H - 2 - len(CHIP)) // 2
for j, line in enumerate(CHIP):
    for i, c in enumerate(line):
        if c == "#":
            put(top + j, LEFT + 2 + i, "M")
for dy, n in LINES:
    for i in range(n):
        put(min(TOP) + 3 + dy, N - 1 - LEFT - 6 + i, "M")
out = Path(__file__).resolve().parent.parent / "hd" / "chiptune-tools.txt"
out.write_text("\n".join("".join(r) for r in rows) + "\n", "utf-8")
print(out.read_text("utf-8"))

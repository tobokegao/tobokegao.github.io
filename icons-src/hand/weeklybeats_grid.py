"""The Weeklybeats mark: "WB" in the favicon's own 5x5 pixel letters, drawn straight onto
the 24x24 grid for scripts/hd_icons.py at two pixels per dot.
Writes icons-src/hd/weeklybeats.txt (T = tile, M = mark); then run
    python scripts/hd_icons.py --only weeklybeats
"""
from pathlib import Path

N = 24
# the favicon's own letters: a 5x5 pixel font at two pixels per dot
W = ["#.#.#",
     "#.#.#",
     "#.#.#",
     "#.#.#",
     "#####"]
B = ["####.",
     "#...#",
     "#####",
     "#...#",
     "#####"]
letters = []
for y in range(5):
    line = "".join(c * 2 for c in W[y] + "." + B[y])          # 22 wide
    letters += [line, line]                                   # 10 tall
top, left = 7, 1                                          # centred on the tile
rows = [["T"] * N for _ in range(N)]
for y, line in enumerate(letters):
    for x, c in enumerate(line):
        if c == "#":
            rows[top + y][left + x] = "M"
for y, x in ((0, 0), (0, N - 1), (N - 1, 0), (N - 1, N - 1)):
    rows[y][x] = "."
out = Path(__file__).resolve().parent.parent / "hd" / "weeklybeats.txt"
out.write_text("\n".join("".join(r) for r in rows) + "\n", "utf-8")
print("\n".join("".join(r) for r in rows))

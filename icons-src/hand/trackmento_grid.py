"""The TRACKMENTO mark: the favicon's three-by-three color swatches with the last place
empty, drawn straight onto the 24x24 grid for scripts/hd_icons.py. Squares of six pixels
with gaps of three (the outlines run in the gaps with a pixel of air between; at night
the frames do); the checkered swatch keeps its pattern at
two pixels per check.
Writes icons-src/hd/trackmento.txt (letters = the swatch colors in ICONS["trackmento"],
k/w = the checks); then run
    python scripts/hd_icons.py --only trackmento
"""
from pathlib import Path

N = 24
S, GAP, LEFT = 6, 3, 0
ORDER = ["ybr", "lmp", "?g."]        # as on the favicon, reading left to right
rows = [["."] * N for _ in range(N)]
for j, line in enumerate(ORDER):
    for i, c in enumerate(line):
        if c == ".":
            continue
        y0, x0 = LEFT + j * (S + GAP), LEFT + i * (S + GAP)
        for y in range(S):
            for x in range(S):
                rows[y0 + y][x0 + x] = ("k" if (x // 2 + y // 2) % 2 == 0 else "w") if c == "?" else c
out = Path(__file__).resolve().parent.parent / "hd" / "trackmento.txt"
out.write_text("\n".join("".join(r) for r in rows) + "\n", "utf-8")
print(out.read_text("utf-8"))

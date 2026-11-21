"""The Tobo Exciter mark: the pedal seen from above, as on the plug-in's panel. A dark body
14 pixels wide, four knobs (3x3) in the lettering's peach, the red lamp, the blue name plate
and the silver foot switch. Drawn straight onto the 24x24 grid for scripts/hd_icons.py.
Writes icons-src/hd/toboexciter.txt (letters = the colors in ICONS["toboexciter"]); then run
    python scripts/hd_icons.py --only toboexciter
"""
from pathlib import Path

N = 24
X0, X1 = 5, 19                      # the body: columns 5..18
rows = [["d" if X0 <= x < X1 else "." for x in range(N)] for _ in range(N)]


def box(c, x0, y0, w, h):
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            rows[y][x] = c


for ky in (2, 7):                   # the knobs, two rows of two
    for kx in (7, 14):
        box("p", kx, ky, 3, 3)
box("r", 11, 12, 2, 2)              # the lamp
box("b", 6, 15, 12, 3)              # the name plate
box("s", 9, 20, 6, 4)               # the foot switch, down to the lower edge
out = Path(__file__).resolve().parent.parent / "hd" / "toboexciter.txt"
out.write_text("\n".join("".join(r) for r in rows) + "\n", "utf-8")
print(out.read_text("utf-8"))

"""The old Mixcloud mark (the cloud with two sound waves, used until 2020), drawn straight
onto the 24x24 grid for scripts/hd_icons.py: two-pixel lines so it holds up at icon size,
the waves as stepped pixel brackets.
Writes icons-src/hd/mixcloud.txt (T = tile, M = mark); then run
    python scripts/hd_icons.py --from-grids --only mixcloud
"""
import math
from pathlib import Path

N, SS = 24, 8
W = 1.8                                   # line width in grid pixels
bumps = [((5.3, 14.2), 2.9), ((9.8, 11.2), 4.3), ((13.9, 13.9), 2.9)]
base_y = 17.1                             # the flat bottom


def in_cloud(x, y, shrink):
    if any(math.hypot(x - cx, y - cy) <= r - shrink for (cx, cy), r in bumps):
        return True
    # the body between the bumps; filled up to the bumps so no inner seams show
    return 5.3 <= x <= 13.9 and (12.0 if shrink else 14.2) <= y <= base_y - shrink


def in_mark(x, y):
    if in_cloud(x, y, 0) and not in_cloud(x, y, W):
        return True
    return False


# the two sound waves as blocky pixel brackets, ")" shapes in steps (by request: the
# smooth arcs broke up at this size); {row: (first column, last column)}
WAVES = [
    {10: (17, 18), 11: (18, 19), 12: (18, 19), 13: (18, 19), 14: (18, 19), 15: (18, 19), 16: (17, 18)},
    {8: (19, 20), 9: (20, 21), 10: (21, 22), 11: (21, 22), 12: (21, 22), 13: (21, 22), 14: (21, 22),
     15: (21, 22), 16: (21, 22), 17: (20, 21), 18: (19, 20)},
]


def in_wave(X, Y):
    return any(Y in w and w[Y][0] <= X <= w[Y][1] for w in WAVES)



rows = []
for Y in range(N):
    row = ""
    for X in range(N):
        if in_wave(X, Y):
            row += "M"
            continue
        hit = sum(in_mark(X + (i + .5) / SS, Y + (j + .5) / SS) for i in range(SS) for j in range(SS))
        row += "M" if hit >= SS * SS * 0.5 else "T"
    rows.append(row)
rows[0] = "." + rows[0][1:-1] + "."
rows[-1] = "." + rows[-1][1:-1] + "."
out = Path(__file__).resolve().parent.parent / "hd" / "mixcloud.txt"
out.write_text("\n".join(rows) + "\n", "utf-8")
print("\n".join(rows))

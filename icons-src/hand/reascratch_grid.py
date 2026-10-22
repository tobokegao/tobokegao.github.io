"""The ReaScratch mark: the record of the kit's favicon (a black disc, a yellow label and
the spindle hole), drawn straight onto the 24x24 grid for scripts/hd_icons.py.
Writes icons-src/hd/reascratch.txt (M = disc, H = label); then run
    python scripts/hd_icons.py --only reascratch
"""
from pathlib import Path

N = 24
C = (N - 1) / 2          # the centre falls between pixels, so the spindle hole is 2x2
# the disc: the same round silhouette as the Spotify icon (22 pixels across)
DISC = (Path(__file__).resolve().parent.parent / "hd" / "spotify.txt").read_text("utf-8").split()
rows = [["M" if c != "." else "." for c in r] for r in DISC]
# the label: a disc of ten pixels across, with the spindle hole in the middle
for y in range(N):
    for x in range(N):
        d2 = (x - C) ** 2 + (y - C) ** 2
        if d2 <= 5.1 ** 2:
            rows[y][x] = "H"
        if d2 <= 1:
            rows[y][x] = "M"
out = Path(__file__).resolve().parent.parent / "hd" / "reascratch.txt"
out.write_text("\n".join("".join(r) for r in rows) + "\n", "utf-8")
print(out.read_text("utf-8"))

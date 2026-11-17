"""The Tobo Imager mark: its four bands stacked from LOW at the bottom to HIGH at the top,
each wider than the one below about the centre line (the stereo width set per band), in the
band colors of the plug-in's panel. Drawn straight onto the 24x24 grid for scripts/hd_icons.py.
Bars of three pixels with gaps of three (the outlines run in the gaps with a pixel of air
between, as on the TRACKMENTO swatches).
Writes icons-src/hd/toboimager.txt (letters = the band colors in ICONS["toboimager"]); then run
    python scripts/hd_icons.py --only toboimager
"""
from pathlib import Path

N = 24
H, GAP, TOP = 3, 3, 1
BANDS = [("o", 12), ("y", 9), ("b", 6), ("n", 3)]     # from the top: (color, half width)
rows = [["."] * N for _ in range(N)]
for j, (c, half) in enumerate(BANDS):
    y0 = TOP + j * (H + GAP)
    for y in range(y0, y0 + H):
        for x in range(N // 2 - half, N // 2 + half):
            rows[y][x] = c
out = Path(__file__).resolve().parent.parent / "hd" / "toboimager.txt"
out.write_text("\n".join("".join(r) for r in rows) + "\n", "utf-8")
print(out.read_text("utf-8"))

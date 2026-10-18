"""The Bluesky butterfly as a white mark on its tile, drawn straight onto the 24x24 grid for
scripts/hd_icons.py (shrunk from the official outline, the wings ran together into a blob):
a V between the upper wings, a two-pixel notch between the upper and lower wings, and a
gap between the lower wings.
Writes icons-src/hd/bluesky.txt (T = tile, M = mark); then run
    python scripts/hd_icons.py --only bluesky
"""
from pathlib import Path

N = 24
HALF = [            # the left half, columns 0-11; the right half mirrors it
    "",
    "",
    "",
    "",
    "...MM",
    "...MMM",
    "...MMMM",
    "...MMMMM",
    "...MMMMMM",
    "...MMMMMMM",
    "...MMMMMMMM",
    "....MMMMMMMM",
    "....MMMMMMMM",
    ".....MMMMMMM",
    ".......MMMMM",
    ".....MMMMMMM",
    "....MMMMMMMM",
    "....MMMMMMM",
    ".....MMMMM",
    "......MMM",
]

rows = []
for y in range(N):
    left = (HALF[y] if y < len(HALF) else "").ljust(N // 2, ".")
    row = (left + left[::-1]).replace(".", "T")
    if y in (0, N - 1):                     # the tile's cut corners
        row = "." + row[1:-1] + "."
    rows.append(row)
out = Path(__file__).resolve().parent.parent / "hd" / "bluesky.txt"
out.write_text("\n".join(rows) + "\n", "utf-8", newline="\n")
print("\n".join(rows))

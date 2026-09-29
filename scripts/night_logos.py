"""Night versions of the two logos, lit from below by the site's yellow light.

    python scripts/night_logos.py

Takes the white line logos in icons-src/logos/ and repaints them with the same ramp as
the night link icons: a light grey at the top warming to a soft Tobokegao yellow at the
bottom. Output: static/img/tobokegao-logo-night.png, static/img/tbkgao-logo-night.png.
Needs ImageMagick.
"""

import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "icons-src" / "logos"
OUT = ROOT / "static" / "img"
RAMP = ["#c9ccd1", "#d4d5d2", "#dcd9c8", "#e0d4a6"]   # same as the night icons at rest

LOGOS = {"tobokegao-white.png": "tobokegao-logo-night.png", "tbkgao-white.png": "tbkgao-logo-night.png"}


def main():
    for src, out in LOGOS.items():
        path = SRC / src
        w, h = subprocess.run(["magick", "identify", "-format", "%w %h", str(path)],
                              check=True, capture_output=True, text=True).stdout.split()
        # a 1x4 strip of the ramp, stretched to the logo's size, then cut by the logo's alpha
        subprocess.run([
            "magick", str(path),
            "(", "-size", "1x1", *[f"xc:{c}" for c in RAMP], "-append",
            "-filter", "Triangle", "-resize", f"1x{h}!", "-scale", f"{w}x{h}!", ")",
            "+swap", "-compose", "CopyOpacity", "-composite", "+repage", "-depth", "8",
            "-define", "png:color-type=6", str(OUT / out)], check=True)
        print("ok", out)


if __name__ == "__main__":
    main()

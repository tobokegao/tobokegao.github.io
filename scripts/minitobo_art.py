"""The pictures of mini Tobokegao on the MEMO page: Tobokegao-chan from the "diary NNN" posts.

data/minitobo.json lists the chosen posts ("art": post id, diary number, the picture's path on
pbs.twimg.com and p(hoto) / g(if)). This script fetches each original (pictures from pbs.twimg.com,
GIFs as X's mp4 from video.twimg.com; cached in work/minitobo/raw), finds how many times the
pixel art was enlarged before posting, and writes static/img/minitobo/<diary>.webp at the size
it is shown (decision 0032):

- small pixel art (native size up to half the box): enlarged by a whole number to fit BOX
- large drawings (many are 1080 or 1600 px drawn dot by dot): shrunk to fit BOX
- GIFs become animated WebP, with <diary>-still.webp (the first frame) for reduced motion

It then writes the sizes back into data/minitobo.json ("img").

    python scripts/minitobo_art.py
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import urllib.request
from pathlib import Path

from PIL import Image, ImageChops, ImageStat

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "minitobo.json"
RAW = ROOT / "work" / "minitobo" / "raw"
OUT = ROOT / "static" / "img" / "minitobo"
BOX = 240
UA = {"User-Agent": "tobokegao-site/1.0 (+https://tobokegao.github.io/)"}


def get(url: str, path: Path) -> Path:
    if not path.exists():
        data = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()
        path.write_bytes(data)
    return path


def enlarged(im: Image.Image) -> int:
    """How many times the picture was enlarged: the largest k for which shrinking by k and
    enlarging again gives back the picture (allowing for video compression)."""
    im = im.convert("RGB")
    w, h = im.size
    for k in range(32, 1, -1):
        if w % k or h % k:
            continue
        back = im.resize((w // k, h // k), Image.NEAREST).resize((w, h), Image.NEAREST)
        if sum(ImageStat.Stat(ImageChops.difference(im, back)).mean) / 3 < 2.0:
            return k
    return 1


def plan(w: int, h: int) -> tuple[int, int, bool]:
    """Shown width and height, and whether the dots stay hard (a whole-number enlargement)."""
    n = max(w, h)
    if n * 2 <= BOX:
        k = BOX // n
        return w * k, h * k, True
    s = BOX / n
    return max(1, round(w * s)), max(1, round(h * s)), n <= BOX


def main() -> int:
    data = json.loads(DATA.read_text(encoding="utf-8"))
    RAW.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    for a in data["art"]:
        path, kind = a["media"]
        name = path.split("/")[-1]
        dest = OUT / f"{a['diary']}.webp"
        if kind == "p":
            src = None
            for q in ("format=png&name=orig", "format=jpg&name=orig", "format=png&name=large"):
                try:
                    src = get(f"https://pbs.twimg.com/{path}?{q}", RAW / f"{name}.png")
                    break
                except Exception:  # noqa: BLE001 - the next size or format
                    continue
            if src is None:
                print(f"fail {a['diary']}: {path}")
                continue
            im = Image.open(src).convert("RGBA")
            k = enlarged(im)
            im = im.resize((im.width // k, im.height // k), Image.NEAREST)
            w, h, hard = plan(*im.size)
            im.resize((w, h), Image.NEAREST if hard else Image.BOX).save(dest, "WEBP", lossless=True)
            a["img"] = {"w": w, "h": h}
        else:
            mp4 = get(f"https://video.twimg.com/tweet_video/{name}.mp4", RAW / f"{name}.mp4")
            first = RAW / f"{name}_f0.png"
            if not first.exists():
                subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(mp4), "-frames:v", "1", str(first)], check=True)
            im = Image.open(first)
            k = enlarged(im)
            nw, nh = im.width // k, im.height // k
            w, h, hard = plan(nw, nh)
            # the frames as PNG (RGB), put together by Pillow: ffmpeg's own WebP encoder shifted
            # the colours of every frame after the first
            frames_dir = RAW / f"{name}_frames"
            if not frames_dir.exists():
                frames_dir.mkdir()
                subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(mp4), "-pix_fmt", "rgb24",
                                str(frames_dir / "f%04d.png")], check=True)
            rate = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                                   "stream=r_frame_rate", "-of", "csv=p=0", str(mp4)],
                                  capture_output=True, text=True, check=True).stdout.strip()
            num, den = (int(x) for x in rate.split("/"))
            frames = [Image.open(f).convert("RGB").resize((nw, nh), Image.NEAREST).resize((w, h), Image.NEAREST if hard else Image.BOX)
                      for f in sorted(frames_dir.glob("f*.png"))]
            frames[0].save(dest, "WEBP", save_all=True, append_images=frames[1:], duration=round(1000 * den / num),
                           loop=0, lossless=True)
            still = OUT / f"{a['diary']}-still.webp"
            im.convert("RGB").resize((nw, nh), Image.NEAREST).resize((w, h), Image.NEAREST if hard else Image.BOX).save(still, "WEBP", lossless=True)
            a["img"] = {"w": w, "h": h, "still": 1}
        print(f"{a['diary']} {kind} x{k} -> {a['img']['w']}x{a['img']['h']} {dest.stat().st_size // 1024}KB")
    DATA.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    total = sum(f.stat().st_size for f in OUT.glob("*.webp"))
    print(f"{len(data['art'])} pictures, {total / 1e6:.1f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())

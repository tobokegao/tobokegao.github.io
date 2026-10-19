"""The pictures of mini Tobokegao on the MEMO page: Tobokegao-chan from the "diary NNN" posts.

data/minitobo.json lists the chosen posts ("art": post id, diary number, the picture's path on
pbs.twimg.com and p(hoto) / g(if)). This script fetches each original (pictures from pbs.twimg.com,
GIFs as X's mp4 from video.twimg.com; cached in work/minitobo/raw), finds how many times the
pixel art was enlarged before posting, and writes static/img/minitobo/<diary>.webp at the size
it is shown (decision 0032):

- small pixel art (native size up to half the box): enlarged by a whole number to fit BOX
- large drawings (many are 1080 or 1600 px drawn dot by dot): shrunk to fit BOX
- GIFs become animated WebP, with <diary>-still.webp (the first frame) for reduced motion

Shrunk drawings also get <diary>@2x.webp and @3x.webp for fine screens. It then writes the
sizes back into data/minitobo.json ("img": w, h, hard = whole-number enlargement, x = the
extra scales written, as "2x" and "3x", still = a GIF).

    python scripts/minitobo_art.py
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageFilter, ImageStat

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
    # 121 px and up: fitted to the box and drawn smooth (as 1:1 hard dots they looked coarse on phones)
    return max(1, round(w * s)), max(1, round(h * s)), False


def scales(nw: int, nh: int, w: int, h: int, hard: bool) -> list[tuple[int, int, str]]:
    """(width, height, file suffix) to write: 1x, and for a shrunk drawing also up to 2x and 3x,
    made from the original without blur (see shrink), so phones with fine screens get a sharp picture instead of a
    blown-up 240px one."""
    if hard:
        return [(w, h, "")]
    return [(w, h, ""), (w * 2, h * 2, "@2x"), (w * 3, h * 3, "@3x")]


def scale2x(im: Image.Image) -> Image.Image:
    """Scale2x (EPX): twice the size, filling the steps of diagonal lines with the colours that
    are already there, so a line drawn dot by dot comes out smooth without blur."""
    a = np.asarray(im)
    p = np.pad(a, ((1, 1), (1, 1), (0, 0)), mode="edge")
    c, up, down, left, right = p[1:-1, 1:-1], p[:-2, 1:-1], p[2:, 1:-1], p[1:-1, :-2], p[1:-1, 2:]
    same = lambda x, y: np.all(x == y, axis=-1)[..., None]  # noqa: E731
    e0 = np.where(same(left, up) & ~same(left, down) & ~same(up, right), up, c)
    e1 = np.where(same(up, right) & ~same(up, left) & ~same(right, down), right, c)
    e2 = np.where(same(down, left) & ~same(down, right) & ~same(left, up), left, c)
    e3 = np.where(same(right, down) & ~same(right, up) & ~same(down, left), down, c)
    h, w, ch = a.shape
    out = np.empty((h * 2, w * 2, ch), dtype=a.dtype)
    out[0::2, 0::2], out[0::2, 1::2], out[1::2, 0::2], out[1::2, 1::2] = e0, e1, e2, e3
    return Image.fromarray(out, im.mode)


def toned(im: Image.Image) -> float:
    """The period, in dots, of the drawing's screen tone when it would turn into moire noise on
    a phone; 0 when there is none, or when it is coarse enough to show as it is. The tone is the
    strongest repeat in the picture's spectrum (periods up to 16 dots, at least 120 times the
    median); it is noise when it comes out under 6 screen pixels on the 3x picture shown on a
    2.25x screen (540 px). Thresholds set by measuring all 148 pictures (2026-10-19)."""
    a = np.asarray(im.convert("L")).astype(np.float32)
    H, W = a.shape
    n = min(512, H, W)
    a = a[(H - n) // 2:(H - n) // 2 + n, (W - n) // 2:(W - n) // 2 + n]
    f = np.abs(np.fft.fft2(a - a.mean()))
    fy, fx = np.fft.fftfreq(n)[:, None], np.fft.fftfreq(n)[None, :]
    band = np.maximum(np.abs(fx), np.abs(fy)) >= 1 / 16
    i = np.argmax(np.where(band, f, 0))
    py, px = np.unravel_index(i, f.shape)
    period = 1 / max(abs(fx[0, px]), abs(fy[py, 0]))
    if f.flat[i] / (np.median(f[band]) + 1e-6) < 120 or period > 16:
        return 0
    return period if period * 540 / max(H, W) < 6 else 0


def shrink(im: Image.Image, size: tuple[int, int], tone: float = 0) -> Image.Image:
    """A drawing drawn dot by dot, to any size. Without tone: enlarged with Scale2x until it is
    at least as large (smooth lines, no blur), then averaged down to the size. With tone: first
    softened just enough that nothing finer than a phone's screen pixel is left (the 3x
    picture shown at 540 px), so tone finer than that becomes its flat colour and coarser tone
    stays as clean dots; then scaled smoothly, without Scale2x, which turns tone into noise."""
    if tone:
        sigma = 0.5 * max(im.size) / 540
        if sigma >= 0.3:
            im = im.filter(ImageFilter.GaussianBlur(sigma))
        return im.resize(size, Image.LANCZOS)
    while im.width < size[0] or im.height < size[1]:
        im = scale2x(im)
    return im.resize(size, Image.BOX)


def save(im: Image.Image, path: Path, hard: bool, **kw) -> None:
    # dots kept hard: lossless; shrunk drawings: lossy, which a drawing's flat colours take well
    im.save(path, "WEBP", **({"lossless": True} if hard else {"quality": 88, "method": 6}), **kw)


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
            ks = scales(*im.size, w, h, hard)
            tone = toned(im)
            for sw, sh, sfx in ks:
                save(im.resize((sw, sh), Image.NEAREST) if hard else shrink(im, (sw, sh), tone), OUT / f"{a['diary']}{sfx}.webp", hard)
            a["img"] = {"w": w, "h": h, "hard": int(hard), "x": [k[2][1:] for k in ks[1:]]}
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
            native = [Image.open(f).convert("RGB").resize((nw, nh), Image.NEAREST) for f in sorted(frames_dir.glob("f*.png"))]
            ks = scales(nw, nh, w, h, hard)
            tone = toned(native[0])
            for sw, sh, sfx in ks:
                frames = [f.resize((sw, sh), Image.NEAREST) if hard else shrink(f, (sw, sh), tone) for f in native]
                save(frames[0], OUT / f"{a['diary']}{sfx}.webp", hard, save_all=True, append_images=frames[1:],
                     duration=round(1000 * den / num), loop=0)
                save(frames[0], OUT / f"{a['diary']}-still{sfx}.webp", hard)
            a["img"] = {"w": w, "h": h, "still": 1, "hard": int(hard), "x": [k[2][1:] for k in ks[1:]]}
        print(f"{a['diary']} {kind} x{k}{f' tone{tone:.1f}' if not hard and tone else ''} -> {a['img']['w']}x{a['img']['h']} {dest.stat().st_size // 1024}KB")
    DATA.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    total = sum(f.stat().st_size for f in OUT.glob("*.webp"))
    print(f"{len(data['art'])} pictures, {total / 1e6:.1f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())

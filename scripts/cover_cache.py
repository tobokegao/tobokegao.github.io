"""Keep a copy of every card picture on the site, as a WebP of the size the card shows.

The release cards and the video cards used to load their covers and thumbnails from the
hosts the feeds point at (SoundCloud, Bandcamp, YouTube, niconico, Apple). That meant a
new connection to each of them, and a picture could change or disappear under us. This
writes the pictures into static/img/covers/ and records which file stands in for which
remote URL in data/covers.json:

    {"jackets": {"<remote url>": "/img/covers/<name>.webp"},    300x300, releases
     "thumbs":  {"<remote url>": "/img/covers/<name>.webp"}}    320x180, videos

release-card.html and video-card.html use the local file when the map has one and the
remote URL otherwise, so a run that fails for one picture costs nothing. Pictures already
in the map are not fetched again; --refresh fetches them all; --prune deletes files no
longer referenced by data/.

    python scripts/cover_cache.py [--refresh] [--prune]

Run after fetch_feeds.py (the update workflow does). Only https images from the hosts
fetch_feeds.py accepts are fetched. Needs Pillow.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import sys
import urllib.parse
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch_feeds import ALLOWED_HOSTS, get, host_ok  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUT = ROOT / "static" / "img" / "covers"
MAP = DATA / "covers.json"
WEB = "/img/covers/"
JACKET = (300, 300)   # release cards (release-card.html: width=300 height=300)
THUMB = (320, 180)    # video cards (video-card.html: width=320 height=180)
QUALITY = 82
HOSTS = {h for _, images in ALLOWED_HOSTS.values() for h in images}


def source_url(url: str) -> str:
    """The size variant worth downloading: the card sizes the hosts already offer."""
    url = url.replace("-t500x500.", "-t300x300.")                    # SoundCloud
    url = re.sub(r"(bcbits\.com/img/\w+)_16\.jpg$", r"\1_2.jpg", url)  # Bandcamp 350px
    return url


def name_for(url: str) -> str:
    host = urllib.parse.urlsplit(url).hostname or ""
    short = host.split(".")[-2] if "." in host else host
    return f"{short}-{hashlib.sha1(url.encode()).hexdigest()[:12]}.webp"


def fit(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    """Scale to cover size, then crop the middle (what object-fit: cover shows)."""
    img = img.convert("RGB")
    scale = max(size[0] / img.width, size[1] / img.height)
    w, h = round(img.width * scale), round(img.height * scale)
    if (w, h) != img.size:
        img = img.resize((max(w, 1), max(h, 1)), Image.Resampling.LANCZOS)
    left, top = (img.width - size[0]) // 2, (img.height - size[1]) // 2
    return img.crop((left, top, left + size[0], top + size[1]))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", action="store_true", help="fetch every picture again")
    ap.add_argument("--prune", action="store_true", help="delete files no data refers to")
    args = ap.parse_args()

    releases = json.loads((DATA / "releases.json").read_text("utf-8"))
    items = json.loads((DATA / "items.json").read_text("utf-8"))
    wanted = {
        "jackets": (JACKET, [r["image"] for r in releases if r.get("image")]),
        "thumbs": (THUMB, [it["image"] for it in items if it["type"] == "video" and it.get("image")]),
    }
    old = json.loads(MAP.read_text("utf-8")) if MAP.exists() and not args.refresh else {}
    new: dict[str, dict[str, str]] = {"jackets": {}, "thumbs": {}}
    OUT.mkdir(parents=True, exist_ok=True)
    fetched = failed = 0
    for kind, (size, urls) in wanted.items():
        for url in dict.fromkeys(urls):
            kept = old.get(kind, {}).get(url)
            if kept and (ROOT / "static" / kept.lstrip("/")).exists():
                new[kind][url] = kept
                continue
            if not host_ok(url, HOSTS):
                print(f"skip (host): {url}", file=sys.stderr)
                continue
            path = OUT / f"{kind[:-1]}-{name_for(url)}"
            try:
                img = Image.open(io.BytesIO(get(source_url(url))))
                fit(img, size).save(path, "WEBP", quality=QUALITY, method=6)
            except Exception as e:  # one dead picture must not stop the rest
                print(f"failed: {url}: {e}", file=sys.stderr)
                failed += 1
                continue
            new[kind][url] = WEB + path.name
            fetched += 1
            print(kind, url.split("/")[-1][:40], "->", path.name, path.stat().st_size // 1024, "KB")
    MAP.write_text(json.dumps(new, ensure_ascii=False, indent=1, sort_keys=True) + "\n", "utf-8", newline="\n")

    used = {Path(p).name for m in new.values() for p in m.values()}
    orphans = sorted(p for p in OUT.glob("*.webp") if p.name not in used)
    if args.prune:
        for p in orphans:
            p.unlink()
    total = sum(p.stat().st_size for p in OUT.glob("*.webp"))
    print(f"{fetched} fetched, {failed} failed, {sum(len(m) for m in new.values())} in the map, "
          f"{len(orphans)} orphan files{' deleted' if args.prune else ''}, {total / 1e6:.1f} MB in {OUT.relative_to(ROOT)}")
    return 1 if failed and not fetched else 0


if __name__ == "__main__":
    sys.exit(main())

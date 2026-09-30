"""Give activity-log rows a picture when the page would otherwise have none.

A row's page (layouts/news/page.html) shows its flyer, a linked design, or the cover of
a linked video or release from data/items.json / releases.json. Rows that only link to
other people's pages (a compilation on Bandcamp, an album on Apple Music or Spotify, a
video on someone else's channel) get their cover art here, stored as "pic" in
data/timeline.json. Existing "pic" values are kept; run with --refresh to fetch again.

    python scripts/row_pics.py [--refresh]

Only https images from the hosts the site's CSP allows are kept (see head.html).
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.parse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch_feeds import get, host_ok  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
TIMELINE = ROOT / "data" / "timeline.json"
PIC_HOSTS = {"i.ytimg.com", ".sndcdn.com", ".bcbits.com", ".nimg.jp", ".mzstatic.com", "i.scdn.co"}


def og_image(url: str) -> str | None:
    page = get(url).decode("utf-8", "replace")
    m = re.search(r'<meta[^>]+property="og:image"[^>]+content="([^"]+)"', page) or \
        re.search(r'<meta[^>]+content="([^"]+)"[^>]+property="og:image"', page)
    return m.group(1).replace("&amp;", "&") if m else None


def pic_for(link: dict) -> str | None:
    u = link["url"]
    if m := re.search(r"(?:youtube\.com/watch\?v=|youtu\.be/)([\w-]{11})", u):
        return f"https://i.ytimg.com/vi/{m.group(1)}/mqdefault.jpg"
    if m := re.search(r"nicovideo\.jp/watch/(sm\d+)", u):
        info = get(f"https://ext.nicovideo.jp/api/getthumbinfo/{m.group(1)}").decode("utf-8", "replace")
        t = re.search(r"<thumbnail_url>([^<]+)</thumbnail_url>", info)
        return t.group(1).replace("http://", "https://") + ".M" if t else None
    if link["source"] == "apple" and (ids := re.findall(r"\d{6,}", u)):
        data = json.loads(get(f"https://itunes.apple.com/lookup?id={ids[0]}&country=jp"))
        r = (data.get("results") or [{}])[0]
        art = r.get("artworkUrl100")
        return art.replace("100x100bb", "600x600bb") if art else None
    if link["source"] == "spotify":
        data = json.loads(get("https://open.spotify.com/oembed?url=" + urllib.parse.quote(u, safe="")))
        return data.get("thumbnail_url")
    if link["source"] in ("bandcamp", "soundcloud"):
        return og_image(u)
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", action="store_true")
    args = ap.parse_args()
    rows = json.loads(TIMELINE.read_text("utf-8"))
    order = {"bandcamp": 0, "apple": 1, "spotify": 2, "soundcloud": 3, "youtube": 4, "niconico": 5}
    added = 0
    for r in rows:
        if r.get("images") or (r.get("pic") and not args.refresh) or r.get("kind") == "release":
            continue
        for link in sorted(r.get("links", []), key=lambda l: order.get(l["source"], 9)):
            if link["source"] not in order:
                continue
            try:
                pic = pic_for(link)
            except Exception as e:  # one dead page must not stop the rest
                print(f"{r['date']} {link['url']}: {e}", file=sys.stderr)
                continue
            if pic and host_ok(pic, PIC_HOSTS):
                r["pic"] = pic
                added += 1
                print(r["date"], r["ja"][:30], "->", pic)
                break
    TIMELINE.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", "utf-8", newline="\n")
    print(added, "rows got a picture")
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""Add X posts by URL to the same candidates as the archive, for posts made after it.

When an event or release is announced, put the post's URL on a line of work/x/inbox.txt
(not committed). This script reads each post through the public fxtwitter API (no API key,
no login), scores it like scripts/import_x_archive.py does, saves its images to work/x/media
and adds it to work/x/candidates.json. From there the steps are the same as for the
archive: scripts/review_x.py to pick, then scripts/x_to_timeline.py draft / merge.

    python scripts/x_urls.py            # read work/x/inbox.txt
    python scripts/x_urls.py URL ...    # or give URLs directly

A post already in candidates.json is not added again, so the inbox can keep old lines.
A self-reply is added as part of its thread, with the posts above it.
If fxtwitter cannot be reached, the post's text can be written under its URL in the inbox,
each line starting with "> "; it is then used as the post's text (without images):

    https://x.com/tobokegao/status/1234567890
    > 10/12(土) 渋谷で出演します
    > OPEN 18:00 / 前売 2000円
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from import_x_archive import JST, MEDIA_PATH, OUT_PATH, OWN, WORK, event_date, score  # noqa: E402

INBOX = WORK / "inbox.txt"
API = "https://api.fxtwitter.com/i/status/{}"
POST_URL = re.compile(r"https?://(?:www\.|mobile\.)?(?:x|twitter|fxtwitter|vxtwitter|fixupx)\.com/(\w+)/status/(\d+)")
UA = "tobokegao-site/1.0 (+https://tobokegao.github.io/)"


def read_inbox(path: Path) -> list[tuple[str, str, str]]:
    """(handle, post id, text written by hand) for every post URL in the inbox."""
    out = []
    if not path.exists():
        return out
    for line in path.read_text(encoding="utf-8").splitlines():
        m = POST_URL.search(line)
        if m:
            out.append([m[1], m[2], ""])
        elif line.startswith(">") and out:
            out[-1][2] += line[1:].removeprefix(" ") + "\n"
    return [tuple(x) for x in out]


def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def fetch(pid: str) -> dict:
    return json.loads(get(API.format(pid)))["tweet"]


def as_post(t: dict) -> dict:
    """A post in the same shape as the archive's: text with links expanded, links, images."""
    urls = [f["replacement"] for f in t.get("raw_text", {}).get("facets", []) if f.get("type") == "url"]
    photos = [p["url"] for p in (t.get("media") or {}).get("photos", [])]
    when = datetime.fromtimestamp(t["created_timestamp"], timezone.utc).astimezone(JST)
    return {"id": t["id"], "date": when.strftime("%Y-%m-%d %H:%M"), "text": t.get("text", ""),
            "urls": urls, "media": photos}


def thread(pid: str) -> tuple[str, list[dict]]:
    """The post and the artist's own posts it replies to, oldest first."""
    t = fetch(pid)
    handle = t["author"]["screen_name"]
    posts = [t]
    while (parent := posts[0].get("replying_to_status")) and (posts[0].get("replying_to") or "").lower() == handle.lower():
        time.sleep(1)
        posts.insert(0, fetch(parent))
    return handle, [as_post(p) for p in posts]


def save_images(posts: list[dict]) -> int:
    """Images go to work/x/media as <post id>-<n>.jpg, the names scripts/review_x.py reads."""
    MEDIA_PATH.mkdir(parents=True, exist_ok=True)
    n = 0
    for p in posts:
        for i, u in enumerate(p["media"], 1):
            ext = re.search(r"\.(jpe?g|png|webp)(?:\?|$)", u)
            dest = MEDIA_PATH / f"{p['id']}-{i}.{ext[1] if ext else 'jpg'}"
            if not dest.exists():
                dest.write_bytes(get(u))
                n += 1
    return n


def candidate(handle: str, posts: list[dict]) -> dict:
    rid = posts[0]["id"]
    best, hits = 0, set()
    for p in posts:
        s, h = score(p["text"], p["urls"], bool(p["media"]), notes=False)
        best, hits = max(best, s), hits | set(h)
    return {
        "id": "x:" + rid,
        "source": "x-url",
        "url": f"https://x.com/{handle}/status/{rid}",
        "date": posts[0]["date"][:10],
        "event_date": next((e for p in posts if (e := event_date(p["text"], p["date"]))), ""),
        "score": best,
        "hits": sorted(hits),
        "posts": posts,
        "status": "new",
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("urls", nargs="*", help="post URLs (default: the lines of work/x/inbox.txt)")
    args = ap.parse_args()

    if args.urls:
        todo = [(m[1], m[2], "") for u in args.urls if (m := POST_URL.search(u))]
    else:
        todo = read_inbox(INBOX)
        if not todo:
            print(f"no post URLs in {INBOX.relative_to(WORK.parent.parent)}")
            return 0

    cands = json.loads(OUT_PATH.read_text(encoding="utf-8")) if OUT_PATH.exists() else []
    have = {p["id"] for c in cands for p in c["posts"]}
    added, failed = 0, 0
    for handle, pid, typed in todo:
        if pid in have:
            continue
        try:
            handle, posts = thread(pid)
            images = save_images(posts)
        except Exception as e:  # noqa: BLE001 - a network or API change; the typed text is the fallback
            if not typed.strip():
                print(f"fail {pid}: {e} (write the text under the URL with '> ' to add it by hand)")
                failed += 1
                continue
            posts, images = [{"id": pid, "date": datetime.now(JST).strftime("%Y-%m-%d %H:%M"),
                              "text": typed.strip(), "urls": re.findall(r"https?://\S+", typed), "media": []}], 0
            print(f"hand {pid}: fxtwitter failed ({e}); using the text from the inbox, the date is today")
        if not OWN.search(handle):
            print(f"note {pid}: posted by @{handle}, not Tobokegao")
        old = next((c for c in cands if c["id"] == "x:" + posts[0]["id"]), None)
        if old:  # a later post in a thread already picked: the thread grows
            known = {p["id"] for p in old["posts"]}
            old["posts"] += [p for p in posts if p["id"] not in known]
            have |= {p["id"] for p in posts}
            print(f"add  {pid} to the thread {old['id']}")
            continue
        c = candidate(handle, posts)
        cands.append(c)
        have |= {p["id"] for p in posts}
        added += 1
        print(f"add  {c['id']} {c['date']} score {c['score']} event {c['event_date'] or '?'} "
              f"({images} images): {posts[-1]['text'][:40]!r}")
        time.sleep(1)

    cands.sort(key=lambda c: c["date"])
    WORK.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(cands, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{added} added, {failed} failed; next: python scripts/review_x.py")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())

"""Read in full the retweets that the X archive cut off.

The archive keeps a retweet's text up to 140 characters ("RT @name: " included) and ends a
longer one with "…"; scripts/x_notes.py marks those "cut": 1. Asked for a retweet's id, the
public fxtwitter API (no API key, no login) answers with the retweeted post: its whole text
and its own id. This script asks for every cut retweet once and keeps the answers in
work/x/rt_full.json (not committed):

    {"<retweet id>": {"t": "<whole text>", "src": "<the post's id>"}}   read
    {"<retweet id>": {}}                                               gone (deleted, private)
    {"<retweet id>": {"other": "<name>"}}                              another post came back: left as it is

scripts/x_notes.py then shows the whole text, links the name to the post and drops the mark.

    python scripts/x_rt_full.py --limit 200   # the next 200 (one request a second)
    python scripts/x_rt_full.py               # all that are left (about 80,000: a day)
    python scripts/x_rt_full.py --count       # only say how many are read, gone and left

It can be stopped and run again: what is already in rt_full.json is not asked for twice.
A post fxtwitter answers with an error other than "gone" is left for a later run; five such
answers in a row stop the run. Run scripts/x_notes.py afterwards.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import unicodedata
import urllib.error
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from x_urls import fetch  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "work" / "x" / "all_posts.json"
FULL = ROOT / "work" / "x" / "rt_full.json"


def norm(s: str) -> str:
    return "".join(unicodedata.normalize("NFKC", s).replace("​", "").split()).lower()


def same_post(p: dict, t: dict) -> bool:
    """Is the answer the post this retweet repeats? The same account, or the same first words
    (an account can have been renamed since)."""
    if (t.get("author") or {}).get("screen_name", "").lower() == p["u"].lower():
        return True
    return norm(t.get("text", ""))[:20] == norm(p["t"])[:20]


def save(full: dict) -> None:
    tmp = FULL.with_suffix(".tmp")
    tmp.write_text(json.dumps(full, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, FULL)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, help="ask for this many at most")
    ap.add_argument("--count", action="store_true", help="only count")
    args = ap.parse_args()

    if not CACHE.exists():
        print("no cache yet: run scripts/x_notes.py --archive <folder of the zip parts> once")
        return 1
    posts = json.loads(CACHE.read_text(encoding="utf-8"))["posts"]
    cut = [p for p in posts if p.get("k") == "rt" and p.get("cut")]
    full = json.loads(FULL.read_text(encoding="utf-8")) if FULL.exists() else {}
    todo = [p for p in cut if p["id"] not in full]
    done = [full[p["id"]] for p in cut if p["id"] in full]
    print(f"cut {len(cut)}: read {sum(1 for f in done if f.get('t'))}, gone {sum(1 for f in done if not f)}, "
          f"other {sum(1 for f in done if f.get('other'))}, left {len(todo)}")
    if args.count:
        return 0

    todo.sort(key=lambda p: -int(p["id"]))   # the newest first: the most likely to be there still
    if args.limit:
        todo = todo[:args.limit]
    failed = 0
    try:
        for n, p in enumerate(todo, 1):
            try:
                t = fetch(p["id"])
            except urllib.error.HTTPError as e:
                if e.code not in (401, 403, 404):
                    # fxtwitter fails on some posts every time (HTTP 500) though it is up: such a
                    # post is left for a later run, and only five failures in a row stop the run
                    failed += 1
                    print(f"left {p['id']}: HTTP {e.code}", flush=True)
                    if failed >= 5:
                        print("stopped: five failures in a row")
                        return 2
                    time.sleep(5)
                    continue
                full[p["id"]] = {}
                failed = 0
            else:
                failed = 0
                if same_post(p, t):
                    full[p["id"]] = {"t": t.get("text", ""), "src": t["id"]}
                else:
                    full[p["id"]] = {"other": (t.get("author") or {}).get("screen_name", "")}
            if n % 50 == 0:
                save(full)
            if n % 500 == 0:
                print(f"{n} / {len(todo)}", flush=True)
            time.sleep(1)
    except (urllib.error.URLError, TimeoutError, KeyError, json.JSONDecodeError) as e:
        print(f"stopped: {e!r}")
        return 2
    finally:
        save(full)
    print(f"asked {len(todo)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

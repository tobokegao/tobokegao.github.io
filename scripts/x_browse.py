"""Add posts made after the X archive to the memo's post cache, from lists of post ids.

The ids are read off the profile in a browser (Claude in Chrome, the account's own login, read
only): the Posts and Replies tabs for one's own posts, the Reposts tab for reposts, newest
first. Each list goes in a file under work/x/browse/ (not committed), ids separated by spaces:

    own_ids.txt / posts_ids.txt   own posts and replies (any order)
    rt_ids.txt                    the reposted posts' ids, in the Reposts tab's order

Each post is read through the public fxtwitter API (no key, no login; answers are kept in
work/x/browse/fx/ so a second run reads nothing again) and added to work/x/all_posts.json in
the archive's shape, marked "via": "browse". Then run scripts/x_notes.py to rebuild the memo.

A repost's own id and time are not shown anywhere. Its time is estimated from the order: a
repost was made after every post that was reposted before it, so it gets the newest creation
time among the posts at or after it in the list (never earlier than the archive's last post).
Its id is made from that time like an X id (so it sorts with the rest) and it is marked
"est": 1; the memo shows the time as an estimate. Reading a new archive with
`x_notes.py --archive` rewrites the cache and replaces all of these with the real posts.

    python scripts/x_browse.py            # fetch what is missing and add it
    python scripts/x_browse.py --dry-run  # fetch, then only count what would be added
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.error
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from x_urls import fetch  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "work" / "x" / "all_posts.json"
BROWSE = ROOT / "work" / "x" / "browse"
FX = BROWSE / "fx"
JST = timezone(timedelta(hours=9))
X_EPOCH = 1288834974657   # ms; X ids are (ms since this) << 22
TAG = re.compile(r"(?<![\w#])#(\w+)")


def ids(name: str) -> list[str]:
    p = BROWSE / name
    return p.read_text(encoding="utf-8").split() if p.exists() else []


def get(pid: str) -> dict | None:
    """The post from fxtwitter, or None when it is gone (deleted, private)."""
    path = FX / f"{pid}.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8")) or None
    try:
        t = fetch(pid)
    except urllib.error.HTTPError as e:
        if e.code not in (401, 403, 404):
            raise
        t = {}
    FX.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(t, ensure_ascii=False), encoding="utf-8")
    time.sleep(1)
    return t or None


def when(t: dict) -> datetime:
    return datetime.fromtimestamp(t["created_timestamp"], timezone.utc).astimezone(JST)


def pics(t: dict) -> list[list[str]]:
    """Thumbnails as the archive keeps them: the path on pbs.twimg.com without its extension,
    and p(hoto) / v(ideo) / g(if). Posts marked sensitive keep none."""
    if t.get("possibly_sensitive"):
        return []
    out = []
    for m in (t.get("media") or {}).get("all", []):
        u = m.get("url") if m.get("type") == "photo" else m.get("thumbnail_url")
        if u and (p := re.match(r"https://pbs\.twimg\.com/(.+?)\.(?:jpg|jpeg|png|webp)", u)):
            out.append([p.group(1), {"video": "v", "gif": "g"}.get(m.get("type"), "p")])
    return out


def base(t: dict, d: datetime) -> dict:
    rec = {"id": t["id"], "d": d.strftime("%Y-%m-%d %H:%M"), "tags": TAG.findall(t.get("text", ""))}
    n = len((t.get("media") or {}).get("all", []))
    if n:
        rec["m"] = n
        if mx := pics(t):
            rec["mx"] = mx
    return rec


def own_post(t: dict, handle: str) -> dict:
    rec = base(t, when(t)) | {"t": t.get("text", ""), "via": "browse"}
    to, ts = t.get("replying_to") or "", t.get("replying_to_status") or ""
    if to and to.lower() != handle.lower():
        rec.update(k="reply", to=to, ts=ts)
    else:
        rec["k"] = "own"
        if ts:
            rec["re"] = ts
    return rec


def make_id(d: datetime, seq: int) -> str:
    return str(((int(d.timestamp() * 1000) - X_EPOCH) << 22) | (seq & 0x3FFFFF))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="count what would be added, change nothing")
    args = ap.parse_args()

    cache = json.loads(CACHE.read_text(encoding="utf-8"))
    handle, posts = cache["handle"], cache["posts"]
    posts = [p for p in posts if p.get("via") != "browse"]   # added by an earlier run: made again
    archive_end = max(datetime.strptime(p["d"], "%Y-%m-%d %H:%M").replace(tzinfo=JST) for p in posts)
    have = {p["id"] for p in posts}
    have_src = {p["src"] for p in posts if p.get("src")}

    own_ids = list(dict.fromkeys(ids("own_ids.txt") + ids("posts_ids.txt")))
    rt_ids = list(dict.fromkeys(ids("rt_ids.txt")))
    todo = [i for i in own_ids if i not in have] + [i for i in rt_ids if i not in have_src]
    print(f"{len(own_ids)} own, {len(rt_ids)} reposts listed; reading {len(todo)} through fxtwitter")
    got, gone = {}, []
    for n, pid in enumerate(todo, 1):
        t = get(pid)
        if t:
            got[pid] = t
        else:
            gone.append(pid)
        if n % 100 == 0:
            print(f"  {n}/{len(todo)}")

    added = [own_post(got[i], handle) for i in own_ids if i in got]

    # reposts: newest first in the list, so walk from the oldest end keeping the newest
    # creation time seen; that is the earliest the repost can have been made
    floor = archive_end + timedelta(minutes=1)
    rts = []
    for seq, pid in enumerate(reversed(rt_ids)):
        if pid in have_src:
            continue
        t = got.get(pid)
        if t:
            floor = max(floor, when(t).replace(second=0, microsecond=0))
            rec = base(t, floor) | {"id": make_id(floor, seq), "k": "rt", "u": t["author"]["screen_name"],
                                    "t": t.get("text", ""), "src": pid, "est": 1, "via": "browse"}
            rts.append(rec)
    added += rts

    print(f"{len(added) - len(rts)} own posts and replies, {len(rts)} reposts to add; "
          f"{len(gone)} gone (deleted or private): {' '.join(gone[:10])}{' …' if len(gone) > 10 else ''}")
    by_month: dict[str, list[int]] = {}
    for r in added:
        by_month.setdefault(r["d"][:7], [0, 0])[r["k"] == "rt"] += 1
    for m, (o, r) in sorted(by_month.items()):
        print(f"  {m}: {o} posts, {r} reposts")
    if args.dry_run:
        return 0
    posts += added
    posts.sort(key=lambda r: int(r["id"]))
    CACHE.write_text(json.dumps({"handle": handle, "posts": posts}, ensure_ascii=False), encoding="utf-8")
    print("next: python scripts/x_notes.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())

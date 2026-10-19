"""The daily X update (decision 0030): the steps around the browser part, in one place.

    python scripts/x_daily.py known own   # ids already listed, newest first, for the profile
    python scripts/x_daily.py known rt    #   and replies tabs (own) or the reposts tab (rt)
    python scripts/x_daily.py merge       # add the new ids, fetch, rebuild the memo

The browser part (scripts/x_profile_collect.js) writes the new ids to work/x/browse/new_own.txt
and new_rt.txt. merge puts them in the lists x_browse.py reads (new reposts go in front: the
list stays newest first), runs x_browse.py and x_notes.py, and sends the new own posts to
x_urls.py so they become log candidates. scripts/x_daily_prompt.md is the whole routine.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BROWSE = ROOT / "work" / "x" / "browse"
CACHE = ROOT / "work" / "x" / "all_posts.json"
OWN, RT = BROWSE / "own_ids.txt", BROWSE / "rt_ids.txt"
NEW_OWN, NEW_RT = BROWSE / "new_own.txt", BROWSE / "new_rt.txt"


def read(p: Path) -> list[str]:
    return p.read_text(encoding="utf-8").split() if p.exists() else []


def write(p: Path, ids: list[str]) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text("\n".join(" ".join(ids[i:i + 20]) for i in range(0, len(ids), 20)) + "\n", encoding="utf-8")


def known(kind: str) -> list[str]:
    if kind == "rt":
        ids = read(RT)
        if not ids:  # nothing read off the profile yet: the archive's last reposts
            posts = json.loads(CACHE.read_text(encoding="utf-8"))["posts"]
            ids = [p["src"] for p in reversed(posts) if p["k"] == "rt" and p.get("src")]
        return ids[:60]
    posts = json.loads(CACHE.read_text(encoding="utf-8"))["posts"]
    ids = {p["id"] for p in posts if p["k"] != "rt"} | set(read(OWN)) | set(read(BROWSE / "posts_ids.txt"))
    return sorted(ids, key=int, reverse=True)[:60]


def run(*args: str, check: bool = True) -> None:
    print("$", " ".join(args), flush=True)
    subprocess.run([sys.executable, *args], cwd=ROOT, check=check)


def merge() -> int:
    new_own = [i for i in read(NEW_OWN) if i not in set(read(OWN)) | set(read(BROWSE / "posts_ids.txt"))]
    rt = read(RT)
    new_rt = [i for i in read(NEW_RT) if i not in set(rt)]
    write(OWN, read(OWN) + new_own)
    write(RT, new_rt + rt)
    for p in (NEW_OWN, NEW_RT):
        p.unlink(missing_ok=True)
    print(f"new: {len(new_own)} own posts and replies, {len(new_rt)} reposts")
    if not new_own and not new_rt:
        return 0
    run("scripts/x_browse.py")
    run("scripts/x_notes.py")
    if new_own:  # log candidates; x_urls.py skips the posts it already has
        run("scripts/x_urls.py", *[f"https://x.com/i/status/{i}" for i in new_own], check=False)
    return 0


def main() -> int:
    if sys.argv[1:2] == ["known"] and sys.argv[2:3] in (["own"], ["rt"]):
        print(" ".join(known(sys.argv[2])))
        return 0
    if sys.argv[1:2] == ["merge"]:
        return merge()
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main())

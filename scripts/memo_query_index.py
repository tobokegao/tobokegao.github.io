"""A small index of who each memo post is from and to, for from: and to: in the search.

Pagefind indexes whole pages (a month, a topic), so a search with only from:someone and no
words cannot be answered from it. This index lists, for every account, the posts reposted
from it (from:) and the replies sent to it (to:), as month and id, so the search box can
find them in every year and then load each post from its month page.

It is built from data/memo after Hugo, in the Actions build (not committed: it would change
with every daily update), into 256 files chosen by a hash of the account name:

    python scripts/memo_query_index.py public/memo/q

Each file is {"f": {account: posts}, "t": {account: posts}}, with the account in lower case
and posts as "2026-10:id,id*;2026-09:id" (newest month first, newest post first; * marks a
post with pictures or a video). The hash is FNV-1a (32 bit) of the name, & 255, as two hex
digits; assets/js/notes.js computes the same.

Next to it, m/YYYY-MM.json lists the pictures of each of the month's own posts that has any
(m/rt-YYYY-MM.json those of the reposts), as {id: [[path, kind], ...]} (the same as "mx" in data/memo), so mini Tobokegao can show
a post's pictures without loading its whole month or topic page:

    python scripts/memo_query_index.py public/memo/q public/memo/m
"""

from __future__ import annotations

import collections
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MEMO = ROOT / "data" / "memo"


def bucket(name: str) -> str:
    h = 0x811C9DC5
    for b in name.encode("utf-8"):
        h = ((h ^ b) * 0x01000193) & 0xFFFFFFFF
    return f"{h & 255:02x}"


def main() -> int:
    if len(sys.argv) not in (2, 3):
        print(__doc__)
        return 2
    out = Path(sys.argv[1])
    pics_out = Path(sys.argv[2]) if len(sys.argv) == 3 else None
    pics: dict[str, dict] = collections.defaultdict(dict)
    # account -> month -> [(id, media)]
    index = {"f": collections.defaultdict(lambda: collections.defaultdict(list)),
             "t": collections.defaultdict(lambda: collections.defaultdict(list))}
    for kind, key, field in (("rt", "f", "u"), ("posts", "t", "to")):
        for path in sorted((MEMO / kind).glob("*.json")):
            month = path.stem
            for p in json.loads(path.read_text(encoding="utf-8")).values():
                if p.get("mx"):
                    pics[("rt-" if kind == "rt" else "") + month][p["id"]] = p["mx"]
                if p.get(field) and (kind == "rt" or p.get("k") == "reply"):
                    index[key][p[field].lower()][month].append((p["id"], bool(p.get("m"))))
    files: dict[str, dict] = collections.defaultdict(lambda: {"f": {}, "t": {}})
    for key, accounts in index.items():
        for name, months in accounts.items():
            files[bucket(name)][key][name] = ";".join(
                m + ":" + ",".join(i + ("*" if media else "") for i, media in sorted(posts, key=lambda x: -int(x[0])))
                for m, posts in sorted(months.items(), reverse=True))
    out.mkdir(parents=True, exist_ok=True)
    for b in (f"{i:02x}" for i in range(256)):
        (out / f"{b}.json").write_text(json.dumps(files.get(b, {"f": {}, "t": {}}), ensure_ascii=False,
                                                  separators=(",", ":")), encoding="utf-8")
    if pics_out:
        pics_out.mkdir(parents=True, exist_ok=True)
        for month, posts in pics.items():
            (pics_out / f"{month}.json").write_text(json.dumps(posts, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"pictures of {sum(len(v) for v in pics.values())} posts in {len(pics)} month files")
    size = sum(p.stat().st_size for p in out.glob("*.json"))
    print(f"{sum(len(a) for a in index.values())} accounts in 256 files, {size / 1e6:.1f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())

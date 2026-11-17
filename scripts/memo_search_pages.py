"""Cut the built month pages of the memo into a small page per day, for the search index.

Pagefind indexes a page as one piece and, for each hit, cuts its excerpts out of the page's
whole text in the browser. A month of posts as one page made every search slow (decision
0048), so the index is built from a page per day instead. These pages are only read by
Pagefind and are not published: they go to <site>/memo/_d/ and are removed once the index
is made.

    python scripts/memo_search_pages.py public          # write public/memo/_d/
    pagefind --site public                              # the index (settings in pagefind.yml)
    python scripts/memo_search_pages.py public --clean  # remove public/memo/_d/

A day's page holds its posts as they are on the month's page (the same HTML, so the search
and mini Tobokegao read them the same way), with:
  - the month (data-pagefind-meta m, and the filter month) and, for reposts, rt
  - the filter kind: own or rt
The month pages themselves are no longer indexed (layouts/memo/page.html).
"""

from __future__ import annotations

import argparse
import collections
import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POST = re.compile(r'<article class="?np[ "].*?</article>', re.S)
DAY = re.compile(r'<time datetime="?(\d{4}-\d{2}-\d{2})')
PAGE = ('<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>{title}</title></head><body>'
        '<main data-pagefind-body><h1>{title}</h1>'
        '<span data-pagefind-meta="m:{month}" hidden></span>{rt}'
        '<span data-pagefind-filter="month:{month}" hidden></span>'
        '<span data-pagefind-filter="kind:{kind}" hidden></span>'
        '{posts}</main></body></html>')


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("site", type=Path, help="the built site (public)")
    ap.add_argument("--clean", action="store_true", help="remove the pages (after the index is made)")
    args = ap.parse_args()
    memo = args.site / "memo"
    out = memo / "_d"
    if out.exists():
        shutil.rmtree(out)
    if args.clean:
        return 0

    months = json.loads((ROOT / "data" / "memo" / "graph.json").read_text(encoding="utf-8"))["months"]
    pages = posts = 0
    for mo in months:
        for kind, folder, want in (("own", memo / mo["m"], mo["n"]), ("rt", memo / "rt" / mo["m"], mo.get("nr", 0))):
            if not want:
                continue
            html = (folder / "index.html").read_text(encoding="utf-8")
            days = collections.defaultdict(list)
            for a in POST.findall(html):
                d = DAY.search(a)
                if d:
                    days[d.group(1)].append(a)
            found = sum(len(v) for v in days.values())
            # every post of the month must be found, or the search would silently lose posts
            if found != want:
                print(f"NG {folder}: {found} posts found, {want} in data/memo/graph.json")
                return 1
            posts += found
            for day, arts in days.items():
                d = out / ("rt" if kind == "rt" else "own")
                d.mkdir(parents=True, exist_ok=True)
                (d / f"{day}.html").write_text(PAGE.format(
                    title=day.replace("-", ".") + (" RT" if kind == "rt" else ""), month=mo["m"], kind=kind,
                    rt='<span data-pagefind-meta="rt:1" hidden></span>' if kind == "rt" else "",
                    posts="".join(arts)), encoding="utf-8")
                pages += 1
    print(f"{posts} posts on {pages} pages for the search index")
    return 0


if __name__ == "__main__":
    sys.exit(main())

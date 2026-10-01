"""Turn the X posts picked in scripts/review_x.py into activity-log rows.

Two steps, with the wording written by hand (or by Claude in a session) in between:

    python scripts/x_to_timeline.py draft   # picked posts -> work/x/drafts.json
    (fill in "ja" and "en", check "date" and "kind", drop links that do not belong)
    python scripts/x_to_timeline.py merge   # finished drafts -> data/timeline.json

draft fills in what it can: the event day guessed from the post, a kind guessed from the
words, the post and its links as the row's links, and the chosen flyers. Running it again
keeps what was already written in drafts.json.

merge adds every draft whose "ja" and "en" are filled in. A draft is left out as a
duplicate when data/timeline.json already has a row on the same day that shares a link, or
is also a live show. Flyers become WebP at 1800px on the long side in static/img/news/ and
are listed in the row's "images" (shown on the row's own page). Merged candidates are
marked "merged" in work/x/candidates.json so they are not drafted again.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import unicodedata
import sys
from pathlib import Path
from urllib.parse import urlparse

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / "work" / "x"
CANDIDATES = WORK / "candidates.json"
DRAFTS = WORK / "drafts.json"
MEDIA = WORK / "media"
TIMELINE = ROOT / "data" / "timeline.json"
IMG_DIR = ROOT / "static" / "img" / "news"
KINDS = ("live", "release", "feature", "other")
FLYER_LONG_SIDE = 1800

HOSTS = [
    ("bandcamp.com", "bandcamp"), ("music.apple.com", "apple"), ("soundcloud.com", "soundcloud"),
    ("youtube.com", "youtube"), ("youtu.be", "youtube"), ("nicovideo.jp", "niconico"),
    ("nico.ms", "niconico"), ("spotify.com", "spotify"), ("x.com", "x"), ("twitter.com", "x"),
    ("bsky.app", "bluesky"),
]


def read(path: Path, default):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default


def write(path: Path, rows, indent: int = 1) -> None:
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(rows, ensure_ascii=False, indent=indent) + "\n", encoding="utf-8")
    os.replace(tmp, path)


def source_of(url: str) -> str:
    host = urlparse(url).netloc.lower()
    return next((s for h, s in HOSTS if host == h or host.endswith("." + h)), "web")


def guess_kind(text: str) -> str:
    if re.search(r"出演|ライブ|LIVE|Live|DJ|VJ|演奏|タイムテーブル|OPEN|START", text):
        return "live"
    if re.search(r"リリース|release|Release|配信開始|発売|頒布|新譜", text):
        return "release"
    if re.search(r"参加|提供|寄稿|コンピ|remix|Remix|リミックス|feat\.|掲載|インタビュー", text):
        return "feature"
    return "other"


def event_key(note: str) -> str:
    """The event a review note names, so that posts about one event become one row:
    "To Be Kontinued vol.14を開催のログに合体" and "#ToBeKontinued vol.14を開催" give the same
    key. Empty for a post with no note."""
    k = unicodedata.normalize("NFKC", note).replace("​", "").strip()
    for _ in range(4):
        k2 = re.sub(r"(の?ログに(合体|追加|併合)|に(合体|追加|併合)|のログ|を開催|開催|、出演|をリリース|リリース"
                    r"|に参加|[をが]?TBKgao.*|に(ライブ|DJ-?mix|DJ|音MAD-mix|VRChat)?で?(ビデオ)?出演.*|[、,]\s*)$",
                    "", k, flags=re.I).strip()
        if k2 == k:
            break
        k = k2
    k = re.sub(r"^(コンピレーションアルバム|album|1st Live album)\s*", "", k, flags=re.I)
    k = re.sub(r"to ?be ?kontinued?", "to be kontinued", k, flags=re.I)
    k = re.sub(r"vol\.?\s*0*(\d+)", r"vol.\1", k, flags=re.I)
    return re.sub(r"[\s「」『』\"]", "", k).lower()


def clean_url(u: str) -> str:
    """A link worth keeping in a log row, without share-tracking parameters; "" for X
    posts, t.co and X's own pages."""
    p = urlparse(u)
    host = p.netloc.lower().removeprefix("www.").removeprefix("mobile.")
    if host in ("x.com", "twitter.com", "t.co", "pic.twitter.com") or not host:
        return ""
    keep = [q for q in p.query.split("&") if q and not re.match(r"(t|s|si|feature|utm_\w+|ref|ref_src|fbclid|igshid)=", q)]
    return p._replace(query="&".join(keep), fragment="").geturl()


def logged_as(key: str, timeline: list[dict]) -> dict | None:
    """The row already in the log for an event key, if its text names the event; of
    several, the one that says least besides the name (「X」に参加 before a live album of X)."""
    if len(key) < 4:
        return None
    hits = []
    for r in timeline:
        text = re.sub(r"[\s「」『』\"]", "", unicodedata.normalize("NFKC", r.get("ja", "")).replace("​", "")).lower()
        if key in text:
            hits.append((len(text), r))
    return min(hits, key=lambda h: h[0])[1] if hits else None


def draft() -> int:
    """One draft per event: posts whose review notes name the same event (and exact
    reposts) are drawn together, with every post's links and flyers. An event that the
    log already has gets "into" (that row's date and ja); merge then only adds the links."""
    cands = read(CANDIDATES, [])
    timeline = read(TIMELINE, [])
    drafts = {d["id"]: d for d in read(DRAFTS, [])}
    drafted = {i for d in drafts.values() for i in d.get("ids", [d["id"]])}
    groups: dict[str, list[dict]] = {}
    for c in cands:
        if c.get("status") != "log" or c.get("merged") or c["id"] in drafted:
            continue
        k = event_key(c.get("note", "")) or c["id"]
        groups.setdefault(k, []).append(c)
    added = 0
    for k, cs in groups.items():
        cs.sort(key=lambda c: c["date"])
        # the post the note does not call an addition is the event's own announcement
        main = next((c for c in cs if not re.search(r"合体|追加|併合", c.get("note", ""))), cs[0])
        # the announcement's own post, then the pages the posts point to; other X posts
        # (quotes, the artist's earlier posts) are left out, as the log is not a thread
        links, seen, flyers, texts = [{"source": "x", "url": main["url"]}], {main["url"]}, [], []
        for c in [main] + [c for c in cs if c is not main]:
            for u in (clean_url(u) for u in c["posts"][0]["urls"]):
                if u and u not in seen:
                    links.append({"source": source_of(u), "url": u})
                    seen.add(u)
            flyers += [f for f in c.get("flyers", []) if f not in flyers]
            text = "\n".join(p["text"] for p in c["posts"])
            if text not in texts:  # a repost of the same words adds nothing
                texts.append(text)
        into = logged_as(k, timeline) if k != main["id"] else None
        drafts[main["id"]] = {
            "id": main["id"],
            "ids": [c["id"] for c in cs],
            "date": main.get("event_date") or main["date"],
            "posted": main["date"],
            "kind": guess_kind("\n".join(texts)),
            "ja": "",
            "en": "",
            "note": " / ".join(dict.fromkeys(c.get("note", "") for c in cs if c.get("note"))),
            "links": links,
            "flyers": flyers,
            "context": "\n---\n".join(texts),
        } | ({"into": {"date": into["date"], "ja": into["ja"]}} if into else {})
        added += 1
    rows = sorted(drafts.values(), key=lambda d: d["date"])
    WORK.mkdir(parents=True, exist_ok=True)
    write(DRAFTS, rows)
    todo = sum(1 for d in rows if not (d["ja"] and d["en"]) and not d.get("into"))
    print(f"{added} new drafts, {len(rows)} in {DRAFTS.relative_to(ROOT)} "
          f"({sum(1 for d in rows if d.get('into'))} add links to rows already logged, {todo} still need ja/en)")
    return 0


def duplicate_of(d: dict, timeline: list[dict]) -> dict | None:
    urls = {l["url"] for l in d["links"]}
    for r in timeline:
        if r["date"] != d["date"]:
            continue
        if urls & {l["url"] for l in r.get("links", [])}:
            return r
        if d["kind"] == "live" and r.get("kind") == "live":
            return r
    return None


def flyer(name: str, d: dict, n: int) -> dict:
    src = MEDIA / name
    im = Image.open(src)
    im = im.convert("RGBA" if im.mode in ("RGBA", "LA", "P") else "RGB")
    scale = min(1.0, FLYER_LONG_SIDE / max(im.size))
    if scale < 1:
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    out = IMG_DIR / f"{d['date'].replace('-', '')}-{d['id'].split(':', 1)[1]}-{n}.webp"
    im.save(out, "WEBP", quality=82, method=6)
    return {"src": "/img/news/" + out.name, "w": im.width, "h": im.height}


def merge() -> int:
    drafts = read(DRAFTS, [])
    timeline = read(TIMELINE, [])
    cands = read(CANDIDATES, [])
    done, left, errors = [], [], []
    for d in drafts:
        if d.get("into"):
            row = next((r for r in timeline if r["date"] == d["into"]["date"] and r.get("ja") == d["into"]["ja"]), None)
            if row is None:
                errors.append(f"{d['id']}: the row it adds to ({d['into']['date']} {d['into']['ja']}) is gone")
                left.append(d)
                continue
            # the row already has its own sources; only pages it lacks are added, no X posts
            same = lambda u: re.sub(r"^https?://(www\.)?", "", clean_url(u) or u).rstrip("/").lower()
            have = {same(l["url"]) for l in row.setdefault("links", [])}
            new = [l for l in d["links"] if l["source"] != "x" and same(l["url"]) not in have]
            row["links"] += new
            done.append((d, "merged"))
            print(f"link {d['id']} -> {row['date']} {row['ja']} (+{len(new)} links)")
            continue
        if not (d.get("ja") and d.get("en")):
            left.append(d)
            continue
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", d["date"]) or d["kind"] not in KINDS:
            errors.append(f"{d['id']}: date {d['date']!r} or kind {d['kind']!r} is wrong")
            left.append(d)
            continue
        dup = duplicate_of(d, timeline)
        if dup:
            print(f"skip {d['id']} ({d['date']}): already logged as {dup['ja']!r}")
            done.append((d, "duplicate"))
            continue
        # the page id is fixed here, so later rewording does not move the row's page (decision 0019)
        rid = d["date"].replace("-", "") + "-" + hashlib.md5(d["ja"].encode()).hexdigest()[:6]
        row = {"date": d["date"], "id": rid, "kind": d["kind"], "ja": d["ja"], "en": d["en"],
               "source": "x", "links": d["links"]}
        if d.get("flyers"):
            row["images"] = [flyer(f, d, i + 1) for i, f in enumerate(d["flyers"])]
        timeline.append(row)
        done.append((d, "merged"))
        print(f"add  {d['id']} ({d['date']}): {d['ja']}")
    for e in errors:
        print("fix", e)
    if not done:
        print(f"nothing to merge ({len(left)} drafts still need ja/en)")
        return 1 if errors else 0
    timeline.sort(key=lambda r: r["date"], reverse=True)  # stable: same-day rows keep their order
    write(TIMELINE, timeline, indent=2)
    outcome = {i: how for d, how in done for i in d.get("ids", [d["id"]])}
    for c in cands:
        if c["id"] in outcome:
            c["merged"] = outcome[c["id"]]
    write(CANDIDATES, cands)
    write(DRAFTS, left)
    print(f"{sum(1 for _, h in done if h == 'merged')} rows added, {len(left)} drafts left")
    return 1 if errors else 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("step", choices=["draft", "merge"])
    args = ap.parse_args()
    return draft() if args.step == "draft" else merge()


if __name__ == "__main__":
    sys.exit(main())

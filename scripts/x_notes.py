"""Build the NOTES pages (a Cosense-like web of topics) from the X archive and content/memo.

Every post in the archive goes in: own posts, replies to other people and retweets. Pages
are made per topic, not per post (55k post pages would come close to GitHub Pages' 1GB):

- a topic is a note (content/memo/*.md, written by hand) or a hashtag used MIN_TAG times
- a post belongs to every note whose name it contains, and to its hashtags' topics
- a note links to other topics with [name] in its text, and by type in its front matter:
  up / down (上位 / 下位) and src / inf (源流 / 影響先); the other side is filled in here
- a note with `major = true` is a large genre: it and everything below it (down links)
- other names: `also` (looked for in the text too) and `tags` (hashtags only); with
  `match = "tags"` none of the note's names is looked for in the text
- `unverified = true` (not `draft`, which Hugo leaves unbuilt): written by Claude from general knowledge (year, links) and not yet
  checked by Tobokegao; the page and the timeline say so

Outputs (all read by Hugo; content/memo/_content.gotmpl makes the pages):
  data/memo/graph.json         topics, links, months
  data/memo/posts/YYYY-MM.json own posts and replies, by id
  data/memo/rt/YYYY-MM.json    retweets, by id (their pages are kept out of search engines)

Reading the zips takes a few minutes, so the posts are kept in work/x/all_posts.json:

    python scripts/x_notes.py --archive "D:/Twitter Archives"   # read the zips again
    python scripts/x_notes.py                                   # rebuild from the cache
    python scripts/x_notes.py --year 2019                       # one year only (trial)

Run it again after adding or renaming a note, so the links and post lists follow.
"""

from __future__ import annotations

import argparse
import collections
import json
import re
import sys
import tomllib
import unicodedata
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import import_x_archive as archive  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "work" / "x" / "all_posts.json"
NOTES = ROOT / "content" / "memo"
OUT = ROOT / "data" / "memo"
JST = timezone(timedelta(hours=9))
MIN_TAG = 3          # a hashtag becomes a topic once it is used this often
MAX_LIST = 300       # posts listed on a topic page (the rest are found by search)
REL = {"up": "down", "down": "up", "src": "inf", "inf": "src"}
RESERVED = {"timeline", "rt"}   # pages of the NOTES section that are not topics
LINK = re.compile(r"(?<!\\)\[([^\[\]\n]+)\](?!\()")


def norm(s: str) -> str:
    return unicodedata.normalize("NFKC", s).replace("\u200b", "").strip().lower()


def slug(title: str) -> str:
    s = re.sub(r"[^\w]+", "-", norm(title)).strip("-")
    return s or "topic"


# ---------- reading the archive ----------

def read_archive(folder: Path) -> list[dict]:
    tweets, account, handle = archive.read_tweets(archive.archives(folder), folder)
    out = []
    for t in tweets:
        text, urls = archive.expand(t)
        when = datetime.strptime(t["created_at"], "%a %b %d %H:%M:%S %z %Y").astimezone(JST)
        ent = t.get("entities", {})
        media = t.get("extended_entities", ent).get("media", [])
        rec = {"id": t["id_str"], "d": when.strftime("%Y-%m-%d %H:%M"),
               "tags": [h["text"] for h in ent.get("hashtags", [])]}
        if media:
            rec["m"] = len(media)
            # Thumbnails are shown from X's own server (nothing is copied here): the path
            # on pbs.twimg.com without its extension, and p(hoto) / v(ideo) / g(if).
            # Posts marked sensitive keep only the count.
            if t.get("possibly_sensitive") not in (True, "true"):
                pics = []
                for x in media:
                    u = re.match(r"https://pbs\.twimg\.com/(.+?)\.(?:jpg|jpeg|png|webp)$", x.get("media_url_https", ""))
                    if u:
                        pics.append([u.group(1), {"video": "v", "animated_gif": "g"}.get(x.get("type"), "p")])
                if pics:
                    rec["mx"] = pics
        m = re.match(r"RT @(\w+): ?", text)
        if m:
            rec.update(k="rt", u=m.group(1), t=text[m.end():])
            src = next((x.get("source_status_id_str") for x in media if x.get("source_status_id_str")), None)
            if src:
                rec["src"] = src
            if text.rstrip().endswith("…"):
                rec["cut"] = 1
        else:
            reply = t.get("in_reply_to_user_id_str")
            rec["t"] = text
            if reply and reply != account:
                rec.update(k="reply", to=t.get("in_reply_to_screen_name") or "",
                           ts=t.get("in_reply_to_status_id_str") or "")
            else:
                rec["k"] = "own"
                if reply:
                    rec["re"] = t.get("in_reply_to_status_id_str") or ""
        out.append(rec)
    out.sort(key=lambda r: int(r["id"]))
    return out, handle


# ---------- notes ----------

def read_notes() -> list[dict]:
    notes = []
    for p in sorted(NOTES.glob("*.md")):
        if p.name.startswith("_"):
            continue
        text = p.read_text(encoding="utf-8")
        m = re.match(r"\+\+\+\n(.*?)\n\+\+\+\n?(.*)", text, re.S)
        if not m:
            raise SystemExit(f"{p}: front matter must be TOML between +++ lines")
        fm, body = tomllib.loads(m.group(1)), m.group(2)
        # links inside code are not links
        plain = re.sub(r"`[^`]*`", "", body)
        notes.append({"file": p.stem, "fm": fm, "links": LINK.findall(plain)})
    return notes


# ---------- matching ----------

def term_pattern(terms: list[str]) -> re.Pattern:
    """One pattern for every topic name; a name that starts or ends with a Latin letter or
    digit must not be part of a longer word (\\b counts Japanese letters as word letters)."""
    parts = []
    for t in sorted(terms, key=len, reverse=True):
        p = re.escape(t)
        if re.match(r"[a-z0-9]", t):
            p = r"(?<![a-z0-9])" + p
        if re.search(r"[a-z0-9]$", t):
            p += r"(?![a-z0-9])"
        parts.append(p)
    return re.compile("|".join(parts))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--archive", type=Path, help="folder of the archive's zip parts (reads them again)")
    ap.add_argument("--year", type=int, help="only this year (for trying things out)")
    args = ap.parse_args()

    if args.archive:
        posts, handle = read_archive(args.archive)
        CACHE.parent.mkdir(parents=True, exist_ok=True)
        CACHE.write_text(json.dumps({"handle": handle, "posts": posts}, ensure_ascii=False), encoding="utf-8")
    elif CACHE.exists():
        c = json.loads(CACHE.read_text(encoding="utf-8"))
        posts, handle = c["posts"], c["handle"]
    else:
        print("no cache yet: run with --archive <folder of the zip parts> once")
        return 1
    if args.year:
        posts = [p for p in posts if p["d"].startswith(str(args.year))]

    # Retweets of one's own posts are not repeated: they count on the post itself.
    own = {norm(p["t"])[:60]: p for p in posts if p["k"] == "own"}
    kept = []
    for p in posts:
        if p["k"] == "rt" and norm(p["u"]) == norm(handle):
            if (orig := own.get(norm(p["t"]).rstrip("…")[:60])) is not None:
                orig["rt"] = orig.get("rt", 0) + 1
            continue
        kept.append(p)
    posts = kept

    # Topics: notes first (their names win), then hashtags used often enough.
    notes = read_notes()
    topics: dict[str, dict] = {}
    alias: dict[str, str] = {}
    used_slugs: set[str] = set(RESERVED)

    def add(title: str, note: dict | None = None) -> str:
        key = norm(title)
        if key in alias:
            return alias[key]
        base = slug(note["file"] if note else title)
        s, i = base, 2
        while s in used_slugs:
            s, i = f"{base}-{i}", i + 1
        used_slugs.add(s)
        topics[key] = {"title": title, "url": f"/memo/{s}/", "slug": s, "note": note["file"] if note else "",
                       "posts": [], "rts": [], "out": [], "back": [],
                       "rel": {k: [] for k in REL}, "years": collections.Counter()}
        alias[key] = key
        return key

    # Names looked for only as hashtags: a note's `tags`, and every name of a note with
    # `match = "tags"` (common words such as "house" or "glitch" would take in too much).
    tag_only: set[str] = set()
    for n in notes:
        fm = n["fm"]
        if "title" not in fm:
            raise SystemExit(f"content/memo/{n['file']}.md: no title")
        key = add(fm["title"], n)
        t = topics[key]
        for a in fm.get("also", []):
            alias.setdefault(norm(a), key)
        for a in fm.get("tags", []):
            alias.setdefault(norm(a), key)
            tag_only.add(norm(a))
        if fm.get("match") == "tags":
            tag_only.update([key] + [norm(a) for a in fm.get("also", [])])
        if fm.get("unverified"):
            t["draft"] = 1
        if "born" in fm:
            t["born"] = int(fm["born"])
        if fm.get("major"):
            t["major"] = int(fm.get("color", 1))
        if fm.get("credit"):
            t["credit"] = fm["credit"]
    # links and typed relations may name pages that have no note yet: they become topics
    for n in notes:
        key = alias[norm(n["fm"]["title"])]
        for name in n["links"]:
            k = add(name)
            # the words as written, so the page can turn each [word] into its link
            topics[key].setdefault("names", {})[name] = k
            if k != key and k not in topics[key]["out"]:
                topics[key]["out"].append(k)
        for r, other in REL.items():
            for name in n["fm"].get(r, []):
                k = add(name)
                if k == key:
                    continue
                if k not in topics[key]["rel"][r]:
                    topics[key]["rel"][r].append(k)
                if key not in topics[k]["rel"][other]:
                    topics[k]["rel"][other].append(key)

    # Names written in a note are looked for in the text; a hashtag topic only by its tag
    # (a tag such as #music would otherwise take in every post that says "music").
    text_terms = [a for a in alias if len(a) >= 2 and a not in tag_only]
    tag_count = collections.Counter(norm(t) for p in posts for t in p["tags"])
    for tag, n in tag_count.items():
        if n >= MIN_TAG and len(tag) >= 2 and tag not in alias:
            add(next(t for p in posts for t in p["tags"] if norm(t) == tag))

    pattern = term_pattern(text_terms)
    months: dict[str, dict] = collections.defaultdict(lambda: {"posts": {}, "rt": {}})
    for p in posts:
        hit = {alias[m.group(0)] for m in pattern.finditer(norm(p["t"]))}
        hit |= {alias[norm(t)] for t in p["tags"] if norm(t) in alias}
        month, year = p["d"][:7], p["d"][:4]
        rec = {k: v for k, v in p.items() if k != "tags"}
        if hit:
            rec["tp"] = sorted(hit)
        for k in hit:
            t = topics[k]
            (t["rts"] if p["k"] == "rt" else t["posts"]).append(p["id"])
            t["years"][year] += 1
            t["first"] = min(t.get("first", p["d"]), p["d"])
        months[month]["rt" if p["k"] == "rt" else "posts"][p["id"]] = rec

    for k, t in topics.items():
        for o in t["out"]:
            if k not in topics[o]["back"]:
                topics[o]["back"].append(k)

    # Large genres take in everything below them.
    for k, t in topics.items():
        if "major" not in t:
            continue
        seen, todo = {k}, [k]
        while todo:
            for d in topics[todo.pop()]["rel"]["down"]:
                if d not in seen:
                    seen.add(d)
                    todo.append(d)
        for m in seen:
            topics[m].setdefault("majors", []).append(k)

    # Nothing to show: a hashtag topic whose posts all fell outside --year.
    topics = {k: t for k, t in topics.items()
              if t["note"] or t["posts"] or t["rts"] or t["back"] or any(t["rel"].values())}

    out_topics = {}
    for k, t in topics.items():
        posts_desc = sorted(t["posts"], key=int, reverse=True)
        rts_desc = sorted(t["rts"], key=int, reverse=True)
        o = {"title": t["title"], "url": t["url"], "slug": t["slug"], "note": t["note"],
             "n": len(posts_desc), "nr": len(rts_desc),
             # each id with its month, so the page can find the post's file
             "posts": [[i, month_of(i, months)] for i in posts_desc[:MAX_LIST]],
             "rts": [[i, month_of(i, months)] for i in rts_desc[:MAX_LIST]],
             "out": [x for x in t["out"] if x in topics], "back": [x for x in t["back"] if x in topics],
             "rel": {r: [x for x in v if x in topics] for r, v in t["rel"].items()},
             "years": dict(sorted(t["years"].items()))}
        if "names" in t:
            o["names"] = {w: topics[x]["url"] for w, x in t["names"].items() if x in topics}
        for f in ("born", "first", "major", "majors", "credit", "draft"):
            if f in t:
                o[f] = t[f]
        out_topics[k] = o

    if OUT.exists():
        for old in list(OUT.glob("posts/*.json")) + list(OUT.glob("rt/*.json")):
            old.unlink()
    (OUT / "posts").mkdir(parents=True, exist_ok=True)
    (OUT / "rt").mkdir(parents=True, exist_ok=True)
    month_list = []
    for m in sorted(months):
        for kind in ("posts", "rt"):
            if months[m][kind]:
                write(OUT / kind / f"{m}.json", months[m][kind])
        month_list.append({"m": m, "n": len(months[m]["posts"]), "nr": len(months[m]["rt"])})
    files = {t["note"]: k for k, t in out_topics.items() if t["note"]}
    write(OUT / "graph.json", {"handle": handle, "topics": out_topics, "files": files, "months": month_list})
    print(f"{len(posts)} posts, {len(out_topics)} topics ({len(files)} notes), {len(month_list)} months")
    return 0


_where: dict[str, str] = {}


def month_of(pid: str, months: dict) -> str:
    if not _where:
        for m, v in months.items():
            for kind in ("posts", "rt"):
                for i in v[kind]:
                    _where[i] = m
    return _where[pid]


def write(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


if __name__ == "__main__":
    sys.exit(main())

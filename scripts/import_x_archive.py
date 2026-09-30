"""Pick event and release posts out of an X (Twitter) archive.

The archive comes as one or more zip parts (hundreds of GB with media), so nothing is
unpacked: the tweet files are read straight out of the zips, and media is copied only
for the posts that were picked. Only tweet files are read; DMs and the rest are ignored.

Own posts are kept (retweets and replies to other people are dropped; replies to
oneself are kept as threads). Each post gets a score from event / release keywords,
date-and-time patterns and ticket links; posts at or above --min-score go to
work/x/candidates.json (not committed), grouped by thread. scripts/review_x.py is the
page for picking them; scripts/x_to_timeline.py turns the picks into activity-log rows.

    python scripts/import_x_archive.py D:/x-archive            # folder of zip parts
    python scripts/import_x_archive.py D:/x-archive --media    # also copy picked images
    python scripts/import_x_archive.py D:/x-archive --stats    # per-year counts only
"""

from __future__ import annotations

import argparse
import collections
import json
import re
import sys
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / "work" / "x"
OUT_PATH = WORK / "candidates.json"
MEDIA_PATH = WORK / "media"
JST = timezone(timedelta(hours=9))

TWEET_FILE = re.compile(r"(^|/)data/(tweets|tweets-part\d+|note-tweet)\.js$")
MEDIA_DIR = re.compile(r"(^|/)data/tweets_media/(\d+)-[^/]+$")

# (pattern, weight). Tuned on ~190 of the artist's own posts found through X search
# (2017-2026): announcements and after-show posts often score only 4-6 on the generic
# words, while chatter about other people's shows scores the same, so first-person
# phrasing, the artist's own event series and names already in the log weigh the most.
# Checked again on 75 otoMAD posts (2015-2026) for mixes, collabs and video appearances,
# and on the Musabi festival (MAD DRIFT, 2025-10) and 音TOUCH (2026-05) posts.
SIGNALS = [
    # the artist's own series and events they played
    (r"ToBeKontinued|To Be Kontinued|音TOUCH|主催|自主企画|Square Sounds|SST ?20\d\d|ROMFEST|[Cc]hipfest|CHIPFEST|[Mm]8 ?[Ff]est|ボカロDJ", 5),
    # first person: playing, joining, having played
    (r"出演します|出演しました|出演させて|出演決定|に出演し|出ます|出させて|やります|やりました|DJします|ライブします|"
     # 参加してた / 参加してる / 参加してほしい / 参加してくれて are about other people
     r"参加します|参加しました|参加して(?!た|る|ほし|欲し|くれ|な)|歌います|歌いました|演奏します|お邪魔します|遠隔参加|"
     r"提供することに|映像出演|出番|僕の出|自分の出|流します|流しました|かけます|回します|出演被り", 4),
    # school festivals and the otoMAD DJ nights held at them (Musabi's MAD DRIFT)
    (r"武蔵美|ムサビ|芸術祭|芸祭|学祭|文化祭|大学祭|MAD ?DRIFT", 3),
    # otoMAD: mixes and collabs are how the artist appears in that scene, but the word
    # itself is everyday chatter, so it only counts much in these forms
    (r"音MAD[-‐ ]?[Mm]ix|OTOMAD[-‐ ]?[Mm]ix|音MAD ?DJ|合作|一緒に作|北大祭|otogroove|OTGR", 3),
    (r"音MAD|otoMAD|OTOMAD|YTPMV|ytpmv", 1),
    # after the show
    (r"お疲れさまでした|お疲れ様でした|ありがとうございました|ご来場|来てくれ|来てくださ", 3),
    (r"セトリ|セットリスト|setlist|DJ ?[Mm]ix|再現[Mm]ix|ライブ版|ライブ映像|[Ll]ive [Vv]ideo|アーカイブ", 3),
    (r"予定\s?[\(（][^)）]{0,12}更新|出演者紹介|出演者", 3),
    (r"タイムテーブル|タイテ|(?<![A-Za-z])TT(?![A-Za-z])|timetable|lineup|line up|LINE UP|出演陣", 3),
    (r"前売|当日券|予約|チケット|ticket|Ticket|TICKET|入場|[¥￥]\s?\d|\d{3,5}\s?円|\d\s?[dD]rink|1D|ドリンク", 3),
    # generic words: other people's shows use them just as often
    (r"出演|ライブ|LIVE|Live|ギグ|DJ|VJ|演奏|パフォーマンス", 2),
    (r"イベント|開催|企画|フェス|festival|Festival|party|Party|PARTY|showcase", 1),
    (r"OPEN|START|開場|開演|door|DOOR", 2),
    (r"会場|venue|Venue|PLASTIC THEATER|渋谷|下北沢|新宿|秋葉原|高円寺|吉祥寺|池袋|中野|札幌|すすきの|大阪|心斎橋|名古屋|京都|福岡|仙台|千葉", 1),
    (r"フライヤー|flyer|Flyer|告知|お知らせ|解禁|announce", 2),
    (r"リリース|release|Release|RELEASE|配信開始|発売|頒布|新譜|コンピ|compilation|Compilation", 2),
    (r"楽曲提供|提供しました|寄稿|remix|Remix|リミックス|feat\.|ft\.", 2),
    (r"M3|コミケ|コミックマーケット|(?<![A-Za-z0-9])C\d{2,3}(?![0-9])|ボーマス|BOOTH|booth", 2),
    (r"生放送|ニコ生|ツイキャス|Twitch|YouTube Live|REALITY|ラジオ|radio|Radio|インタビュー|interview|掲載", 1),
]
SIGNALS = [(re.compile(p), w) for p, w in SIGNALS]

DATE_TIME = re.compile(
    r"\d{1,2}\s?[/月]\s?\d{1,2}\s?日?\s?[\(（]?\s?[月火水木金土日祝]"   # 10/12(土), 10月12日(土)
    r"|\d{4}[./]\d{1,2}[./]\d{1,2}"                                     # 2019.3.3
    r"|\d{1,2}:\d{2}\s?[~〜～-]"                                          # 18:00~
)
TICKET_HOSTS = re.compile(
    r"livepocket|twipla|tiget|peatix|eventbrite|eplus|e\+|t\.pia|ticketpay|teket|zaiko|"
    r"iflyer|clubberia|bandcamp|booth\.pm|tunecore|linkco|big-up|ototoy|soundcloud|nicovideo|youtu",
    re.I,
)


EVENT_DAY = re.compile(
    r"(?:(?P<y>20\d\d)\s?[./年]\s?)?(?P<m>\d{1,2})\s?[/月.]\s?(?P<d>\d{1,2})\s?日?\s?"
    r"(?=[\(（]\s?[月火水木金土日祝]|\s|$)"
)


def event_date(text: str, posted: str) -> str:
    """The first day-of-week date in an announcement, e.g. 10/12(土). Without a year it
    is the next such day on or after the post (a week of slack for late reports)."""
    base = datetime.strptime(posted[:10], "%Y-%m-%d")
    for m in EVENT_DAY.finditer(text):
        y, mo, d = int(m["y"] or base.year), int(m["m"]), int(m["d"])
        try:
            when = datetime(y, mo, d)
        except ValueError:
            continue
        if not m["y"] and when < base - timedelta(days=7):
            when = when.replace(year=y + 1)
        return when.strftime("%Y-%m-%d")
    return ""


def known_names() -> list[str]:
    """Event and release names already in the log (「...」 in data/timeline.json, and the
    designs), six characters or more so that short words like TOBOX do not match chatter."""
    names = set()
    for f in ("timeline.json", "designs.json"):
        p = ROOT / "data" / f
        if p.exists():
            for r in json.loads(p.read_text(encoding="utf-8")):
                names.update(re.findall(r"「([^」]+)」", r.get("ja", "")))
                names.add(r.get("title", ""))
    names = {n.replace("​", "").strip() for n in names}  # Bandcamp titles carry zero-width spaces
    return sorted({n for n in names if len(n) >= 6}, key=len, reverse=True)


KNOWN = re.compile("|".join(re.escape(n) for n in known_names()) or "(?!)", re.I)


def load_js(raw: bytes) -> list:
    """X's archive files are JavaScript: `window.YTD.tweets.part0 = [ ... ]`."""
    text = raw.decode("utf-8-sig")
    return json.loads(text[text.index("=") + 1:])


def archives(path: Path) -> list[Path]:
    if path.is_file():
        return [path]
    return sorted(path.glob("*.zip"))


def read_tweets(zips: list[Path], folder: Path) -> tuple[list[dict], str, str]:
    tweets, notes, account, handle = [], {}, "", "i"
    sources = []
    for z in zips:
        with zipfile.ZipFile(z) as zf:
            for name in zf.namelist():
                if TWEET_FILE.search(name) or name.endswith("data/account.js"):
                    sources.append((name, zf.read(name)))
    if folder.is_dir():  # an already unpacked archive works too
        for p in folder.rglob("*.js"):
            rel = p.relative_to(folder).as_posix()
            if TWEET_FILE.search(rel) or rel.endswith("data/account.js"):
                sources.append((rel, p.read_bytes()))
    for name, raw in sources:
        rows = load_js(raw)
        if name.endswith("account.js"):
            account = rows[0]["account"]["accountId"]
            handle = rows[0]["account"].get("username") or handle
        elif name.endswith("note-tweet.js"):
            for r in rows:
                n = r["noteTweet"]
                notes[n["createdAt"][:19]] = n["core"]["text"]
        else:
            tweets += [r.get("tweet", r) for r in rows]
    # Long posts (over 280 chars) keep their full text in note-tweet.js, matched by the
    # second they were posted and the start of the text.
    for t in tweets:
        when = datetime.strptime(t["created_at"], "%a %b %d %H:%M:%S %z %Y").astimezone(timezone.utc)
        note = notes.get(when.strftime("%Y-%m-%dT%H:%M:%S"))
        if note and note[:20] == (t.get("full_text") or "")[:20]:
            t["full_text"] = note
    return tweets, account, handle


def expand(t: dict) -> tuple[str, list[str]]:
    text = t.get("full_text") or t.get("text") or ""
    urls = []
    for u in t.get("entities", {}).get("urls", []):
        text = text.replace(u["url"], u.get("expanded_url") or u["url"])
        urls.append(u.get("expanded_url") or u["url"])
    for m in t.get("entities", {}).get("media", []):
        text = text.replace(m["url"], "").strip()
    return re.sub(r"&amp;", "&", re.sub(r"&lt;", "<", re.sub(r"&gt;", ">", text))), urls


SERIES = SIGNALS[0][0]
SERIES_TAG = re.compile(r"#\S*(?:" + SERIES.pattern + ")")


def floor_post(text: str) -> bool:
    """A series named only as a hashtag (#SST2018, #ToBeKontinued) with nothing else about
    playing, thanks, setlists, dates or logged names: a post sent live from the floor."""
    plain = SERIES_TAG.sub("", text)
    if plain == text or SERIES.search(plain):
        return False
    return not (any(rx.search(plain) for rx, w in SIGNALS[1:] if w >= 3)
                or KNOWN.search(plain) or DATE_TIME.search(plain))


OWN = re.compile(r"tobokegao|tbkgao|とぼけがお|to6okegao", re.I)
# links to other people's pages; X posts (quoting an organiser's announcement) and
# ticket and event pages are left out, as the artist links those for their own shows
OTHER_LINK = re.compile(
    r"https?://(?!(?:\S*\.)?(?:x|twitter)\.com/|t\.co/|(?:\S*\.)?(?:twipla|livepocket|tiget|peatix|"
    r"eventbrite|eplus|t\.pia|ticketpay|teket|zaiko|iflyer|clubberia)\.)\S+", re.I)
# share-button text, whose track titles are full of Remix / Live / DJ Mix
SHARED = re.compile(
    r"\"[^\"\n]+\" ?を ?YouTube ?で見る"
    r"|[‘\"][^’\"\n]+[’\"] by @?\S+(?: on #?SoundCloud)?"
    r"|Listen to [^\n]+? (?:by|from) @?\S+ on #?SoundCloud"
    r"|(?:A new favorite:|Have you heard) [^\n]+? by @?\S+"
)
# the artist's own part
MINE = re.compile(r"自分|僕|参加しました|参加する|するぞ|お疲れ[さ様]までした|" + SIGNALS[1][0].pattern)
# wishes about other people's sets: 〜やってほしすぎる, 見たすぎる, 聴いてみたすぎる
WISH = re.compile(r"(?:ほし|欲し|見た|聴きた|聞きた|行きた|てみた)(?:すぎ|過ぎ)")
# Bandcamp Friday posts: releases timed to the day are kept, sales on the catalogue are not
BANDCAMP_FRIDAY = re.compile(r"b?bandcamp ?friday|バンドキャンプ ?フライデー", re.I)
SALE = re.compile(r"セール|安く|まとめ買い|お得|\d+ ?% ?off|投げ銭|NYP", re.I)
# X Spaces: talk and work streams; a thread that opens with one is chatter along the stream
SPACE = re.compile(r"(?:x|twitter)\.com/i/spaces/", re.I)


def listening_note(text: str, urls: list[str]) -> str | None:
    """A link to someone else's track, album or page with nothing about the artist's own
    part: a note about something they listened to or read. Returns the text with the
    links and share-button titles cut, or None for any other post."""
    links = [u for u in urls if OTHER_LINK.match(u)]
    if not links or OWN.search(text) or any(OWN.search(u) for u in links):
        return None
    plain = SHARED.sub(" ", OTHER_LINK.sub(" ", text))
    return None if MINE.search(plain) else plain


def score(text: str, urls: list[str], has_media: bool, notes: bool = True) -> tuple[int, list[str]]:
    if WISH.search(text) and not MINE.search(text) and not OWN.search(text):
        return 0, []
    if BANDCAMP_FRIDAY.search(text) and SALE.search(text):
        return 0, []  # a sale on the catalogue, not a release
    if SPACE.search(text) or any(SPACE.search(u) for u in urls):
        return 0, []
    if floor_post(text):
        text = SERIES_TAG.sub("", text)  # the hashtag alone does not count
    note = listening_note(text, urls) if notes else None
    if note is not None:  # only strong signals count; generic words and the link do not
        text, urls, has_media = note, [], False
    s, hits = 0, []
    for rx, w in SIGNALS:
        if note is not None and w < 3:
            continue
        m = rx.search(text)
        if m:
            s += w
            hits.append(m.group(0))
    m = KNOWN.search(text)
    if m:
        s += 3
        hits.append(m.group(0))
    if DATE_TIME.search(text):
        s += 3
        hits.append("date")
    if any(TICKET_HOSTS.search(u) for u in urls):
        s += 2
        hits.append("link")
    if has_media and s:
        s += 1  # flyers ride along with announcements
    return s, hits


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("archive", type=Path, help="zip, folder of zip parts, or unpacked folder")
    ap.add_argument("--min-score", type=int, default=6)
    ap.add_argument("--media", action="store_true", help="copy images of picked posts")
    ap.add_argument("--media-dir", type=Path, default=MEDIA_PATH)
    ap.add_argument("--stats", action="store_true")
    args = ap.parse_args()

    zips = archives(args.archive)
    tweets, account, handle = read_tweets(zips, args.archive)
    if not tweets:
        print("no tweet files found in", args.archive)
        return 1

    posts = {}
    for t in tweets:
        text, urls = expand(t)
        if text.startswith("RT @"):
            continue
        reply_to = t.get("in_reply_to_user_id_str") or t.get("in_reply_to_user_id")
        if reply_to and account and reply_to != account:
            continue
        when = datetime.strptime(t["created_at"], "%a %b %d %H:%M:%S %z %Y").astimezone(JST)
        media = t.get("extended_entities", t.get("entities", {})).get("media", [])
        s, hits = score(text, urls, bool(media))
        posts[t["id_str"]] = {
            "id": t["id_str"],
            "date": when.strftime("%Y-%m-%d %H:%M"),
            "text": text,
            "urls": urls,
            "media": [m.get("media_url_https", "") for m in media],
            "parent": t.get("in_reply_to_status_id_str") if reply_to == account else None,
            "score": s,
            "hits": hits,
        }

    # Threads: a self-reply joins its root, and the thread scores as its best post.
    def root(pid):
        seen = set()
        while posts.get(pid, {}).get("parent") in posts and pid not in seen:
            seen.add(pid)
            pid = posts[pid]["parent"]
        return pid

    threads = collections.defaultdict(list)
    for p in posts.values():
        threads[root(p["id"])].append(p)

    picked = []
    for rid, ps in threads.items():
        ps.sort(key=lambda p: p["date"])
        if SPACE.search(ps[0]["text"]) or any(SPACE.search(u) for u in ps[0]["urls"]):
            continue
        # a thread that tells of the artist's own part anywhere is not a listening note,
        # even where its other posts only link someone else's page
        if len(ps) > 1 and any(MINE.search(p["text"]) for p in ps):
            for p in ps:
                p["score"], p["hits"] = score(p["text"], p["urls"], bool(p["media"]), notes=False)
        best = max(p["score"] for p in ps)
        if best >= args.min_score:
            picked.append({
                "id": "x:" + rid,
                "source": "x",
                "url": f"https://x.com/{handle}/status/{rid}",
                "date": ps[0]["date"][:10],
                "event_date": next((e for p in ps if (e := event_date(p["text"], p["date"]))), ""),
                "score": best,
                "hits": sorted({h for p in ps for h in p["hits"]}),
                "posts": [{k: p[k] for k in ("id", "date", "text", "urls", "media")} for p in ps],
                "status": "new",
            })
    picked.sort(key=lambda c: c["date"])

    years = collections.Counter(p["date"][:4] for p in posts.values())
    kept = collections.Counter(c["date"][:4] for c in picked)
    print(f"{len(tweets)} tweets, {len(posts)} own posts, {len(picked)} candidates (min score {args.min_score})")
    for y in sorted(years):
        print(f"  {y}: {years[y]:6d} posts  {kept[y]:4d} candidates")
    if args.stats:
        return 0

    # Keep review decisions from an earlier run.
    WORK.mkdir(parents=True, exist_ok=True)
    old = {}
    if OUT_PATH.exists():
        old = {c["id"]: c for c in json.loads(OUT_PATH.read_text(encoding="utf-8"))}
    for c in picked:
        if c["id"] in old:
            for k in ("status", "flyers", "note"):
                if k in old[c["id"]]:
                    c[k] = old[c["id"]][k]
    OUT_PATH.write_text(json.dumps(picked, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print("wrote", OUT_PATH.relative_to(ROOT))

    if args.media:
        want = {p["id"] for c in picked for p in c["posts"] if p["media"]}
        dest = args.media_dir
        dest.mkdir(parents=True, exist_ok=True)
        n = 0
        for z in zips:
            with zipfile.ZipFile(z) as zf:
                for name in zf.namelist():
                    m = MEDIA_DIR.search(name)
                    if m and m.group(2) in want and not name.endswith(".mp4"):
                        (dest / Path(name).name).write_bytes(zf.read(name))
                        n += 1
        print(f"copied {n} images to {dest}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

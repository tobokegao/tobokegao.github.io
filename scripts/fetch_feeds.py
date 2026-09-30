"""Collect Tobokegao's releases and videos from public feeds into data/items.json.

Sources: YouTube RSS plus the full upload list (fetch_youtube_all), SoundCloud RSS plus every track (fetch_soundcloud_all), niconico (nvapi), Bandcamp (TBKgao label page),
Apple Music (iTunes lookup). Standard library only so it runs anywhere without setup.

Items are merged into the existing file and never dropped, because RSS feeds only
expose the latest entries. data/releases.json is rebuilt from the merged items,
grouping the same release across platforms.
"""

from __future__ import annotations

import html
import json
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
ITEMS_PATH = DATA / "items.json"
RELEASES_PATH = DATA / "releases.json"
AUTOLOG_PATH = DATA / "autolog.json"
OVERRIDES_PATH = DATA / "overrides.json"
TITLES_EN_PATH = DATA / "titles_en.json"

YOUTUBE_CHANNEL_ID = "UCgO3CHcym4ehQ4Gw3lWlOew"
SOUNDCLOUD_USER_ID = "107800754"
NICONICO_USER_ID = "12289597"
BANDCAMP_LABEL = "https://tbkgao.bandcamp.com"
APPLE_ARTIST_ID = "1532385760"

UA = "Mozilla/5.0 (compatible; tobokegao.github.io feed bot)"
NS = {
    "atom": "http://www.w3.org/2005/Atom",
    "media": "http://search.yahoo.com/mrss/",
    "yt": "http://www.youtube.com/xml/schemas/2015",
    "itunes": "http://www.itunes.com/dtds/podcast-1.0.dtd",
}


def get(url: str, headers: dict | None = None) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
    # YouTube's feed endpoint intermittently answers 404 for a valid channel; retry.
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as res:
                return res.read()
        except urllib.error.HTTPError as e:
            if attempt == 2 or e.code not in (404, 429, 500, 502, 503):
                raise
            time.sleep(3 * (attempt + 1))


def iso_date(value: str) -> str:
    """Normalize any feed date to YYYY-MM-DD in JST, the artist's timezone."""
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        dt = parsedate_to_datetime(value)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone(timedelta(hours=9))).strftime("%Y-%m-%d")


def fetch_youtube() -> list[dict]:
    url = f"https://www.youtube.com/feeds/videos.xml?channel_id={YOUTUBE_CHANNEL_ID}"
    root = ET.fromstring(get(url))
    items = []
    for e in root.findall("atom:entry", NS):
        vid = e.findtext("yt:videoId", namespaces=NS)
        items.append({
            "id": f"youtube:{vid}",
            "source": "youtube",
            "type": "video",
            "title": e.findtext("atom:title", namespaces=NS),
            "artist": "Tobokegao",
            "date": iso_date(e.findtext("atom:published", namespaces=NS)),
            "url": f"https://www.youtube.com/watch?v={vid}",
            # mqdefault is 16:9 without the letterbox bars of the feed's hqdefault
            "image": f"https://i.ytimg.com/vi/{vid}/mqdefault.jpg",
        })
    return items


def fetch_youtube_all(known: dict[str, dict]) -> list[dict]:
    """Every upload, not just the feed's latest 15: the channel's Videos and Shorts tabs,
    paged through YouTube's own web endpoint (no API key). A list entry has no date, so
    only videos not yet in data/items.json get their watch page fetched for it."""
    ua = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                        "(KHTML, like Gecko) Chrome/130 Safari/537.36", "Accept-Language": "ja"}
    found: dict[str, str] = {}

    def walk(o, conts):
        if isinstance(o, dict):
            lock = o.get("lockupViewModel")
            if lock and lock.get("contentType") == "LOCKUP_CONTENT_TYPE_VIDEO":
                found.setdefault(lock["contentId"], lock["metadata"]["lockupMetadataViewModel"]["title"]["content"])
            short = o.get("shortsLockupViewModel")
            if short and short.get("onTap"):
                vid = short["onTap"]["innertubeCommand"].get("reelWatchEndpoint", {}).get("videoId")
                if vid:
                    found.setdefault(vid, short.get("overlayMetadata", {}).get("primaryText", {}).get("content", ""))
            for k, v in o.items():
                if k == "continuationCommand":
                    conts.append(v["token"])
                walk(v, conts)
        elif isinstance(o, list):
            for v in o:
                walk(v, conts)

    for tab in ("videos", "shorts"):
        page = get(f"https://www.youtube.com/channel/{YOUTUBE_CHANNEL_ID}/{tab}", ua).decode("utf-8")
        key = re.search(r'"INNERTUBE_API_KEY":"([^"]+)"', page).group(1)
        ver = re.search(r'"INNERTUBE_CLIENT_VERSION":"([^"]+)"', page).group(1)
        conts: list[str] = []
        walk(json.loads(re.search(r"var ytInitialData = (\{.*?\});</script>", page, re.S).group(1)), conts)
        seen = set()
        while conts:
            tok = conts.pop()
            if tok in seen:
                continue
            seen.add(tok)
            body = json.dumps({"context": {"client": {"clientName": "WEB", "clientVersion": ver, "hl": "ja"}},
                               "continuation": tok}).encode()
            req = urllib.request.Request(f"https://www.youtube.com/youtubei/v1/browse?key={key}", data=body,
                                         headers={**ua, "Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=30) as res:
                walk(json.loads(res.read()), conts)

    items = []
    for vid, title in found.items():
        old = known.get(f"youtube:{vid}")
        if old:
            items.append(old)
            continue
        watch = get(f"https://www.youtube.com/watch?v={vid}", ua).decode("utf-8")
        m = re.search(r'itemprop="(?:datePublished|uploadDate)" content="([^"]+)"', watch) \
            or re.search(r'"(?:publishDate|uploadDate)":"([^"]+)"', watch)
        if not m:
            continue
        if not title:
            t = re.search(r'<meta name="title" content="([^"]*)"', watch)
            title = html.unescape(t.group(1)) if t else vid
        items.append({
            "id": f"youtube:{vid}",
            "source": "youtube",
            "type": "video",
            "title": title,
            "artist": "Tobokegao",
            "date": iso_date(m.group(1)),
            "url": f"https://www.youtube.com/watch?v={vid}",
            "image": f"https://i.ytimg.com/vi/{vid}/mqdefault.jpg",
        })
        time.sleep(0.3)
    return items


def fetch_soundcloud() -> list[dict]:
    url = f"https://feeds.soundcloud.com/users/soundcloud:users:{SOUNDCLOUD_USER_ID}/sounds.rss"
    root = ET.fromstring(get(url))
    items = []
    for e in root.findall("channel/item"):
        guid = e.findtext("guid") or e.findtext("link")
        img = e.find("itunes:image", NS)
        items.append({
            "id": f"soundcloud:{guid.rsplit('/', 1)[-1]}",
            "source": "soundcloud",
            "type": "track",
            "title": e.findtext("title"),
            "artist": "Tobokegao",
            "date": iso_date(e.findtext("pubDate")),
            "url": e.findtext("link"),
            "image": img.get("href") if img is not None else None,
        })
    return items


def fetch_soundcloud_all() -> list[dict]:
    """Every track, not just the RSS feed's latest few: SoundCloud's own web API, with the
    public client id its web player carries in one of its script files."""
    ua = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                        "(KHTML, like Gecko) Chrome/130 Safari/537.36"}
    page = get(f"https://soundcloud.com/tobokegao", ua).decode("utf-8", "replace")
    cid = None
    for js in reversed(re.findall(r'<script crossorigin src="(https://a-v2\.sndcdn\.com/assets/[^"]+\.js)"', page)):
        m = re.search(r'client_id:"([A-Za-z0-9]{32})"', get(js, ua).decode("utf-8", "replace"))
        if m:
            cid = m.group(1)
            break
    if not cid:
        raise RuntimeError("no SoundCloud client id found")
    url = (f"https://api-v2.soundcloud.com/users/{SOUNDCLOUD_USER_ID}/tracks"
           f"?limit=200&linked_partitioning=1&client_id={cid}")
    items = []
    while url:
        data = json.loads(get(url, ua))
        for t in data["collection"]:
            art = t.get("artwork_url") or (t.get("user") or {}).get("avatar_url")
            items.append({
                "id": f"soundcloud:{t['id']}",
                "source": "soundcloud",
                "type": "track",
                "title": t["title"],
                "artist": "Tobokegao",
                "date": iso_date(t["created_at"]),
                "url": t["permalink_url"],
                "image": art.replace("-large.", "-t500x500.") if art else None,
            })
        url = data.get("next_href")
        if url:
            url += f"&client_id={cid}"
    return items


def fetch_niconico() -> list[dict]:
    items, page = [], 1
    while True:
        url = (f"https://nvapi.nicovideo.jp/v3/users/{NICONICO_USER_ID}/videos"
               f"?sortKey=registeredAt&sortOrder=desc&pageSize=100&page={page}")
        data = json.loads(get(url, {"X-Frontend-Id": "6", "X-Frontend-Version": "0"}))["data"]
        for it in data["items"]:
            v = it["essential"]
            items.append({
                "id": f"niconico:{v['id']}",
                "source": "niconico",
                "type": "video",
                "title": v["title"],
                "artist": "Tobokegao",
                "date": iso_date(v["registeredAt"]),
                "url": f"https://www.nicovideo.jp/watch/{v['id']}",
                "image": v["thumbnail"].get("largeUrl") or v["thumbnail"].get("url"),
            })
        if page * 100 >= data["totalCount"]:
            return items
        page += 1


def fetch_bandcamp(known: dict[str, dict]) -> list[dict]:
    page = get(f"{BANDCAMP_LABEL}/music").decode("utf-8")
    entries = []
    # The first grid items are rendered as HTML, the rest live in data-client-items.
    for m in re.finditer(r'<li[^>]*music-grid-item.*?</li>', page, re.S):
        li = m.group(0)
        href = re.search(r'href="([^"]+)"', li).group(1)
        artist = re.search(r'<span class="artist-override">\s*(.*?)\s*</span>', li, re.S)
        entries.append({"page_url": href, "artist": html.unescape(artist.group(1)) if artist else None})
    m = re.search(r'data-client-items="([^"]*)"', page)
    if m:
        entries += json.loads(html.unescape(m.group(1)))

    items, seen = [], set()
    for ent in entries:
        path = ent["page_url"].split("?")[0]
        url = path if path.startswith("http") else BANDCAMP_LABEL + path
        item_id = "bandcamp:" + url.split("bandcamp.com", 1)[-1]
        if item_id in seen:
            continue
        seen.add(item_id)
        if item_id in known:
            items.append(known[item_id])
            continue
        # Only new releases need their page fetched, for the date and full metadata.
        time.sleep(1)
        detail = get(url).decode("utf-8")
        ld = json.loads(re.search(r'<script type="application/ld\+json">(.*?)</script>', detail, re.S).group(1))
        by = ld.get("byArtist") or {}
        items.append({
            "id": item_id,
            "source": "bandcamp",
            "type": "album" if "/album/" in url else "single",
            "title": html.unescape(ld["name"]),
            "artist": html.unescape(by.get("name") or ent.get("artist") or "TBKgao"),
            "date": iso_date(ld["datePublished"]),
            "url": url,
            "image": re.sub(r"_\d+\.jpg$", "_16.jpg", ld.get("image") or "") or None,
        })
    return items


def fetch_apple() -> list[dict]:
    url = (f"https://itunes.apple.com/lookup?id={APPLE_ARTIST_ID}"
           "&entity=album&limit=200&country=jp")
    results = json.loads(get(url))["results"]
    items = []
    for r in results:
        if r.get("wrapperType") != "collection":
            continue
        name = r["collectionName"]
        kind = "single" if name.endswith(" - Single") else "ep" if name.endswith(" - EP") else "album"
        items.append({
            "id": f"apple:{r['collectionId']}",
            "source": "apple",
            "type": kind,
            "title": re.sub(r" - (Single|EP)$", "", name),
            "artist": r["artistName"],
            "date": r["releaseDate"][:10],
            "url": r["collectionViewUrl"].split("?")[0],
            "image": r["artworkUrl100"].replace("100x100bb", "600x600bb"),
        })
    return items


def title_key(title: str) -> str:
    """Loose title used to match one release across platforms."""
    t = unicodedata.normalize("NFKC", title).lower()
    t = re.sub(r"^tobokegao\s*-\s*", "", t)
    t = re.sub(r"#\S+", "", t)
    t = re.sub(r"\((feat|ft)\.?[^)]*\)|\[(feat|ft)\.?[^\]]*\]|\bfeat\..*$", "", t)
    t = re.sub(r"\b(single|ep|preview|deluxe edition|short version)\b", "", t)
    return re.sub(r"[\W_]+", "", t)


SONG_HINT = re.compile(r"feat\.|remix|cover|\bmv\b|アレンジ|^tobokegao\s*-\s", re.I)
NOT_SONG = re.compile(r"(?<!re)mix\b|xfd|short version|#shorts|練習|告知|作る|息抜き|demo", re.I)


def is_song_video(it: dict, overrides: dict) -> bool:
    """Whether a video is a song release (MV, cover, remix) rather than a mix or a vlog."""
    if it["id"] in overrides.get("song", []):
        return True
    if it["id"] in overrides.get("not_song", []):
        return False
    return bool(SONG_HINT.search(it["title"])) and not NOT_SONG.search(it["title"])


LINK_ORDER = {"bandcamp": 0, "apple": 1, "spotify": 2}  # anything else keeps its order after these

# One word for what a single upload is, whatever site it went to: a SoundCloud track and a
# song video are both a "song"; mixes, previews (XFD, trailers) and sketches say so; overrides "kind"
# ({item id: kind}) settles the ones the words get wrong. Albums, EPs and singles keep the
# type their store gives them.
MIX_HINT = re.compile(r"(?<!re)mix\b|\bdj\b|mash-?up|\blive\b|ライブ|\bset\b", re.I)
DEMO_HINT = re.compile(r"demo|\btest\b|\bwip\b|jingle|練習|息抜き", re.I)
PREVIEW_HINT = re.compile(r"\bxfd\b|trailer|preview|tester|試聴", re.I)


def kind_of(title: str, type_: str) -> str:
    if type_ not in ("track", "song"):
        return type_
    if PREVIEW_HINT.search(title):
        return "preview"
    if DEMO_HINT.search(title):
        return "demo"
    if MIX_HINT.search(title):
        return "mix"
    return "song"


def build_releases(items: list[dict], overrides: dict) -> list[dict]:
    """Group music releases (Bandcamp, Apple Music, SoundCloud, song videos) by title."""
    def day(d: str) -> int:
        return datetime.fromisoformat(d).toordinal()

    order = {"bandcamp": 0, "apple": 1, "soundcloud": 2, "niconico": 3, "youtube": 4}
    # overrides "same_release": uploads of one work under different titles (e.g. an English
    # title on SoundCloud); the first id's title names the release
    same = {i: n for n, ids in enumerate(overrides.get("same_release", [])) for i in ids}
    by_id = {it["id"]: it for it in items}
    groups: dict[str, dict] = {}
    for it in sorted(items, key=lambda x: order.get(x["source"], 9)):
        if it["source"] not in order or it["id"] in overrides.get("hide", []):
            continue
        if it["type"] == "video" and not is_song_video(it, overrides):
            continue
        key = title_key(it["title"]) or it["id"]
        if it["id"] in same:
            ids = overrides["same_release"][same[it["id"]]]
            key = title_key(by_id[ids[0]]["title"]) if ids[0] in by_id else f"same:{same[it['id']]}"
        # The same title half a year apart is a new version (e.g. a 2025 vocal remake of
        # a 2020 song), not another link to the old release. A same_release group is kept
        # together whatever the dates (a store release can come months after the upload).
        if it["id"] not in same and key in groups and abs(day(groups[key]["date"]) - day(it["date"])) > 180:
            key = f"{key}@{it['date'][:7]}"
        g = groups.get(key)
        if g is None:
            src = by_id.get(overrides["same_release"][same[it["id"]]][0], it) if it["id"] in same else it
            title = re.sub(r"^Tobokegao\s*-\s*", "", src["title"]) if src["type"] == "video" else src["title"]
            g = groups[key] = {
                "key": key, "title": title, "artist": it["artist"],
                "type": "song" if it["type"] == "video" else it["type"],
                "date": it["date"], "image": it["image"], "links": [],
            }
        g["date"] = min(g["date"], it["date"])
        # YouTube's mqdefault is a clean 16:9 frame; niconico thumbnails carry letterbox bars.
        if it["source"] == "youtube" and g["type"] == "song" and it["image"]:
            g["image"] = it["image"]
        g["image"] = g["image"] or it["image"]
        if not any(l["source"] == it["source"] for l in g["links"]):
            g["links"].append({"source": it["source"], "url": it["url"]})
        g.setdefault("ids", []).append(it["id"])

    # Apple Music often romanizes or shortens titles ("Skip" vs the Japanese title on
    # Bandcamp). An Apple-only entry by the same artist within a few days of a Bandcamp
    # release is the same work.
    for key, g in list(groups.items()):
        if [l["source"] for l in g["links"]] != ["apple"]:
            continue
        match = next((o for o in groups.values()
                      if o is not g and "apple" not in {l["source"] for l in o["links"]}
                      and "bandcamp" in {l["source"] for l in o["links"]}
                      and o["artist"].lower() == g["artist"].lower()
                      and abs(day(o["date"]) - day(g["date"])) <= 3), None)
        if match:
            match["links"] += g["links"]
            del groups[key]
    # Where to buy or stream a release comes before where to hear a preview of it: the
    # first link is the one the card and the log row open.
    for g in groups.values():
        g["links"].sort(key=lambda l: LINK_ORDER.get(l["source"], len(LINK_ORDER)))
        fixed = [overrides.get("kind", {}).get(i) for i in g.pop("ids", [])]
        g["type"] = next((k for k in fixed if k), None) or kind_of(g["title"], g["type"])
    return sorted(groups.values(), key=lambda g: g["date"], reverse=True)


def build_autolog(releases: list[dict]) -> list[dict]:
    """Activity-log rows generated from releases, so news keeps flowing without manual posts."""
    names = {"bandcamp": "Bandcamp", "apple": "Apple Music", "soundcloud": "SoundCloud",
             "niconico": "niconico", "youtube": "YouTube"}
    # English titles and names for the en text, kept by hand in data/titles_en.json
    en = json.loads(TITLES_EN_PATH.read_text("utf-8")) if TITLES_EN_PATH.exists() else {}
    titles_en, artists_en = en.get("titles", {}), en.get("artists", {})
    rows = []
    for g in releases:
        # Label releases by other artists belong on the release page, not in this log.
        if not re.search(r"tobokegao|とぼけがお|various", g["artist"], re.I):
            continue
        where = " / ".join(names[l["source"]] for l in g["links"])
        own = re.search(r"tobokegao|とぼけがお", g["artist"], re.I)
        who = "" if own else f"{g['artist']} "
        who_en = "" if own else f"{artists_en.get(g['artist'], g['artist'])} "
        rows.append({
            "date": g["date"],
            "kind": "release",
            "ja": f"{who}「{g['title']}」を{where}で公開",
            "en": f"{who_en}\"{titles_en.get(g['title'], g['title'])}\" released on {where}",
            "url": g["links"][0]["url"],
            "source": "feed",
            "own": bool(own),
        })
    return rows


# Where each source's links and cover images may point. Anything else coming back from a
# feed (another host, http://, javascript:) is dropped before it reaches data/.
ALLOWED_HOSTS = {
    "youtube": ({"www.youtube.com"}, {"i.ytimg.com"}),
    "soundcloud": ({"soundcloud.com"}, {".sndcdn.com"}),
    "niconico": ({"www.nicovideo.jp"}, {".nimg.jp"}),
    "bandcamp": ({".bandcamp.com"}, {".bcbits.com"}),
    "apple": ({"music.apple.com"}, {".mzstatic.com"}),
}


def host_ok(url: str | None, hosts: set[str]) -> bool:
    """https only, and the host is one of hosts (".example.com" also allows subdomains)."""
    if not url:
        return False
    p = urllib.parse.urlsplit(url)
    host = (p.hostname or "").lower()
    return p.scheme == "https" and not p.username and any(
        host == h or (h.startswith(".") and host.endswith(h)) for h in hosts)


def checked(it: dict) -> dict | None:
    """The item with a link and image it is allowed to have; None if the link itself is off."""
    pages, images = ALLOWED_HOSTS[it["source"]]
    if not host_ok(it.get("url"), pages):
        print(f"[{it['source']}] dropped {it.get('id')}: unexpected link {it.get('url')!r}", file=sys.stderr)
        return None
    if it.get("image") and not host_ok(it["image"], images):
        print(f"[{it['source']}] no cover for {it.get('id')}: unexpected image {it['image']!r}", file=sys.stderr)
        it = {**it, "image": None}
    return it


def main() -> int:
    existing = json.loads(ITEMS_PATH.read_text("utf-8")) if ITEMS_PATH.exists() else []
    known = {it["id"]: it for it in existing}

    fetchers = {
        "youtube": fetch_youtube,
        "youtube-all": lambda: fetch_youtube_all(known),
        "soundcloud": fetch_soundcloud,
        "soundcloud-all": fetch_soundcloud_all,
        "niconico": fetch_niconico,
        "bandcamp": lambda: fetch_bandcamp(known),
        "apple": fetch_apple,
    }
    failed = []
    for name, fn in fetchers.items():
        try:
            fetched = fn()
        except Exception as e:  # one broken source must not block the others
            print(f"[{name}] failed: {e}", file=sys.stderr)
            failed.append(name)
            continue
        fetched = [c for c in map(checked, fetched) if c]
        new = [it for it in fetched if it["id"] not in known]
        for it in fetched:
            known[it["id"]] = {**known.get(it["id"], {}), **it}
        print(f"[{name}] {len(fetched)} items, {len(new)} new")

    items = sorted(known.values(), key=lambda x: (x["date"], x["id"]), reverse=True)
    DATA.mkdir(exist_ok=True)
    ITEMS_PATH.write_text(json.dumps(items, ensure_ascii=False, indent=1) + "\n", "utf-8")
    overrides = json.loads(OVERRIDES_PATH.read_text("utf-8")) if OVERRIDES_PATH.exists() else {}
    releases = build_releases(items, overrides)
    RELEASES_PATH.write_text(json.dumps(releases, ensure_ascii=False, indent=1) + "\n", "utf-8")
    AUTOLOG_PATH.write_text(json.dumps(build_autolog(releases), ensure_ascii=False, indent=1) + "\n", "utf-8")
    return 1 if len(failed) == len(fetchers) else 0


if __name__ == "__main__":
    sys.exit(main())

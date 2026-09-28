"""Gather news candidates about Tobokegao into data/news_candidates.json.

This step only collects raw text; scripts/classify_news.py decides what is news.
Sources (all free, no API keys):
- Bluesky profile RSS
- Google Alerts RSS feeds listed in data/news_sources.json
- LivePocket event search (performer name)
- MusicBrainz credits (remixes, features, arrangements on other people's releases)
- Video descriptions: YouTube feed descriptions and niconico getthumbinfo
Candidates are keyed by id and never re-added, so each is classified once.
"""

from __future__ import annotations

import html
import json
import re
import sys
import time
import urllib.parse
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch_feeds import NS, YOUTUBE_CHANNEL_ID, get, iso_date  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
CANDIDATES_PATH = DATA / "news_candidates.json"
SOURCES_PATH = DATA / "news_sources.json"
ITEMS_PATH = DATA / "items.json"

NAMES = ["とぼけがお", "Tobokegao", "tobokegao", "to6okegao"]
BLUESKY_RSS = "https://bsky.app/profile/tobokegao.bsky.social/rss"
MUSICBRAINZ_ARTIST = "a0d77da9-c09f-4fbf-aca7-ce900c8e3cff"
MB_UA = "tobokegao.github.io/1.0 (https://tobokegao.github.io/)"


def clean(text: str, limit: int = 1500) -> str:
    text = html.unescape(re.sub(r"<[^>]+>", " ", text or ""))
    return re.sub(r"\s+", " ", text).strip()[:limit]


def mentions_artist(text: str) -> bool:
    return any(n.lower() in text.lower() for n in NAMES)


def from_bluesky() -> list[dict]:
    root = ET.fromstring(get(BLUESKY_RSS))
    out = []
    for it in root.findall("channel/item"):
        link = it.findtext("link")
        out.append({
            "id": "bluesky:" + link.rsplit("/", 1)[-1],
            "source": "bluesky",
            "url": link,
            "date": iso_date(it.findtext("pubDate")),
            "title": "",
            "text": clean(it.findtext("description")),
        })
    return out


def from_google_alerts(feeds: list[str]) -> list[dict]:
    out = []
    for feed in feeds:
        root = ET.fromstring(get(feed))
        for e in root.findall("atom:entry", NS):
            link = e.find("atom:link", NS).get("href")
            # Alert links go through a google.com redirect; keep the real target.
            real = urllib.parse.parse_qs(urllib.parse.urlparse(link).query).get("url", [link])[0]
            out.append({
                "id": "alert:" + real,
                "source": "google_alerts",
                "url": real,
                "date": iso_date(e.findtext("atom:published", namespaces=NS)),
                "title": clean(e.findtext("atom:title", namespaces=NS)),
                "text": clean(e.findtext("atom:content", namespaces=NS)),
            })
    return out


def from_livepocket(known: set[str]) -> list[dict]:
    out = []
    for name in ["とぼけがお", "Tobokegao"]:
        page = get("https://livepocket.jp/event/search?word=" + urllib.parse.quote(name)).decode("utf-8", "ignore")
        for slug in sorted(set(re.findall(r'href="/e/([A-Za-z0-9_-]+)"', page))):
            cid = f"livepocket:{slug}"
            if cid in known or any(c["id"] == cid for c in out):
                continue
            time.sleep(1)
            url = f"https://t.livepocket.jp/e/{slug}"
            body = get(url).decode("utf-8", "ignore")
            text = clean(body, 4000)
            if not mentions_artist(text):
                continue  # the search also lists unrelated events
            title = clean(re.search(r"<title>(.*?)</title>", body, re.S).group(1)) if "<title>" in body else ""
            out.append({"id": cid, "source": "livepocket", "url": url, "date": "", "title": title, "text": text})
    return out


def from_musicbrainz() -> list[dict]:
    url = (f"https://musicbrainz.org/ws/2/artist/{MUSICBRAINZ_ARTIST}"
           "?inc=recording-rels+release-rels+release-group-rels&fmt=json")
    data = json.loads(get(url, {"User-Agent": MB_UA}))
    out = []
    for rel in data.get("relations", []):
        target = rel.get("recording") or rel.get("release") or rel.get("release_group") or rel.get("release-group")
        if not target:
            continue
        date = target.get("date") or target.get("first-release-date") or rel.get("begin") or ""
        out.append({
            "id": f"musicbrainz:{rel['type']}:{target['id']}",
            "source": "musicbrainz",
            "url": f"https://musicbrainz.org/{rel.get('target-type', 'recording').replace('_', '-')}/{target['id']}",
            "date": date[:10] if len(date) >= 10 else "",
            "title": target.get("title", ""),
            "text": f"Credit: {rel['type']} on \"{target.get('title', '')}\"" + (f" ({date})" if date else ""),
        })
    return out


def from_video_descriptions(known: set[str]) -> list[dict]:
    out = []
    feed = ET.fromstring(get(f"https://www.youtube.com/feeds/videos.xml?channel_id={YOUTUBE_CHANNEL_ID}"))
    for e in feed.findall("atom:entry", NS):
        vid = e.findtext("yt:videoId", namespaces=NS)
        desc = e.findtext("media:group/media:description", namespaces=NS) or ""
        out.append({
            "id": f"youtube-desc:{vid}",
            "source": "youtube",
            "url": f"https://www.youtube.com/watch?v={vid}",
            "date": iso_date(e.findtext("atom:published", namespaces=NS)),
            "title": e.findtext("atom:title", namespaces=NS),
            "text": clean(desc),
        })
    items = json.loads(ITEMS_PATH.read_text("utf-8")) if ITEMS_PATH.exists() else []
    for it in items:
        if it["source"] != "niconico":
            continue
        sm = it["id"].split(":", 1)[1]
        cid = f"niconico-desc:{sm}"
        if cid in known:
            continue
        time.sleep(0.5)
        info = ET.fromstring(get(f"https://ext.nicovideo.jp/api/getthumbinfo/{sm}"))
        out.append({
            "id": cid,
            "source": "niconico",
            "url": it["url"],
            "date": it["date"],
            "title": it["title"],
            "text": clean(info.findtext("thumb/description") or ""),
        })
    return [c for c in out if c["text"]]


def main() -> int:
    existing = json.loads(CANDIDATES_PATH.read_text("utf-8")) if CANDIDATES_PATH.exists() else []
    known = {c["id"] for c in existing}
    sources = json.loads(SOURCES_PATH.read_text("utf-8")) if SOURCES_PATH.exists() else {}

    collectors = {
        "bluesky": from_bluesky,
        "google_alerts": lambda: from_google_alerts(sources.get("google_alerts", [])),
        "livepocket": lambda: from_livepocket(known),
        "musicbrainz": from_musicbrainz,
        "videos": lambda: from_video_descriptions(known),
    }
    added = []
    for name, fn in collectors.items():
        try:
            found = fn()
        except Exception as e:  # one broken source must not block the others
            print(f"[{name}] failed: {e}", file=sys.stderr)
            continue
        new = [dict(c, status="new") for c in found if c["id"] not in known]
        known |= {c["id"] for c in new}
        added += new
        print(f"[{name}] {len(found)} found, {len(new)} new")

    CANDIDATES_PATH.write_text(json.dumps(existing + added, ensure_ascii=False, indent=1) + "\n", "utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())

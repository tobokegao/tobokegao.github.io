"""Turn news candidates into activity-log rows with Claude.

Reads data/news_candidates.json (from collect_news.py), sends the unclassified ones
to Claude in batches, and appends the ones that are real news about Tobokegao to
data/news.json as bilingual log rows. Without ANTHROPIC_API_KEY it does nothing,
so the site keeps building before a key is set up.

    python scripts/classify_news.py            # classify new candidates
    python scripts/classify_news.py --dry-run  # show what would be sent
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
CANDIDATES_PATH = DATA / "news_candidates.json"
NEWS_PATH = DATA / "news.json"

MODEL = os.environ.get("TBK_NEWS_MODEL", "claude-opus-5")
BATCH = 20

SYSTEM = """You maintain the activity log on the official website of Tobokegao (とぼけがお), \
a Japanese musician: chiptune (Game Boy / LSDj, M8 Tracker), VOCALOID and other voice \
synthesis, OTO-MAD, Pure MIDI. Tobokegao also runs the label TBKgao.

You get raw items from Bluesky posts, web alerts, event ticket pages, MusicBrainz credits \
and video descriptions. For each item decide whether it tells a site visitor something \
worth a line in the log: a release, a live show or DJ set, a contribution to someone \
else's work (remix, feature, compilation track, game music), a media appearance or an \
announcement. Everyday chatter, replies, jokes, retweets of others without Tobokegao's \
involvement, and pages that only mention the name in passing are not news.

For news items write one short line in Japanese and one in English, in the style \
「〜に参加」「〜をリリース」 / "Joined ...", "Released ...". Use the event or release \
date when the text gives one, otherwise the item's own date. Never invent details that \
are not in the item."""

SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "is_news": {"type": "boolean"},
                    "kind": {"type": "string", "enum": ["release", "live", "feature", "news", "other"]},
                    "date": {"type": "string", "description": "YYYY-MM-DD"},
                    "ja": {"type": "string"},
                    "en": {"type": "string"},
                },
                "required": ["id", "is_news", "kind", "date", "ja", "en"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["items"],
    "additionalProperties": False,
}


def classify(client, batch: list[dict]) -> list[dict]:
    payload = [{k: c.get(k, "") for k in ("id", "source", "url", "date", "title", "text")} for c in batch]
    response = client.beta.messages.create(
        model=MODEL,
        max_tokens=16000,
        system=SYSTEM,
        messages=[{"role": "user", "content": "Classify these items. Return one entry per id.\n\n"
                   + json.dumps(payload, ensure_ascii=False)}],
        output_config={"effort": "medium", "format": {"type": "json_schema", "schema": SCHEMA}},
        # If the model declines, the API retries the same request on a fallback model.
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
    )
    if response.stop_reason == "refusal":
        raise RuntimeError(f"refused: {response.stop_details}")
    text = next(b.text for b in response.content if b.type == "text")
    return json.loads(text)["items"]


def main() -> int:
    dry = "--dry-run" in sys.argv
    candidates = json.loads(CANDIDATES_PATH.read_text("utf-8")) if CANDIDATES_PATH.exists() else []
    pending = [c for c in candidates if c.get("status") == "new"]
    if not pending:
        print("no new candidates")
        return 0
    if dry:
        print(f"{len(pending)} candidates would be sent to {MODEL} in {-(-len(pending) // BATCH)} requests")
        return 0
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("ANTHROPIC_API_KEY not set; skipping classification")
        return 0

    import anthropic

    client = anthropic.Anthropic()
    news = json.loads(NEWS_PATH.read_text("utf-8")) if NEWS_PATH.exists() else []
    by_id = {c["id"]: c for c in candidates}
    for i in range(0, len(pending), BATCH):
        batch = pending[i:i + BATCH]
        try:
            results = classify(client, batch)
        except (anthropic.APIStatusError, anthropic.APIConnectionError, RuntimeError) as e:
            print(f"batch {i // BATCH + 1} failed, will retry next run: {e}", file=sys.stderr)
            continue
        for r in results:
            c = by_id.get(r["id"])
            if not c:
                continue
            c["status"] = "news" if r["is_news"] else "skip"
            if r["is_news"]:
                news.append({"date": r["date"] or c["date"], "kind": r["kind"], "ja": r["ja"], "en": r["en"],
                             "url": c["url"], "source": c["source"], "id": c["id"]})
        print(f"batch {i // BATCH + 1}: {sum(r['is_news'] for r in results)} news of {len(batch)}")

    news.sort(key=lambda n: n["date"], reverse=True)
    NEWS_PATH.write_text(json.dumps(news, ensure_ascii=False, indent=1) + "\n", "utf-8")
    CANDIDATES_PATH.write_text(json.dumps(candidates, ensure_ascii=False, indent=1) + "\n", "utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())

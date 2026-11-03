"""Search words for each own post and reply in the memo, from Claude (decision 0045).

Mini Tobokegao and the memo search find posts with Pagefind, which only knows the words
in a post. This script asks Claude, once per post, for the words someone might search
with to find it: what it is about, other ways to say it, related names, in Japanese and
English. The words go to data/memo/topics/YYYY-MM.json ({id: "word word ..."}), and
layouts/_partials/notes-post.html puts them in each post as text the search reads but
the page does not show. The answer shown is still the post itself (decision 0032).

It runs on this PC only, with the key in TBK_ANTHROPIC_API_KEY (never in Actions). Not in
ANTHROPIC_API_KEY: Claude Code takes that one and would bill its own work to the key.
Posts that already have words are skipped, so after the daily update (0030) it sends
only the new ones.

    python scripts/post_topics.py --estimate          # count what would be sent, and the cost
    python scripts/post_topics.py --limit 40          # try on the 40 newest posts without words
    python scripts/post_topics.py --batch             # send all the rest as one batch (half price)
    python scripts/post_topics.py --collect           # take in the batch's results when it is done

TBK_TOPICS_MODEL chooses the model (default claude-opus-5-5).
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MEMO = ROOT / "data" / "memo"
POSTS = MEMO / "posts"
TOPICS = MEMO / "topics"
PENDING = ROOT / "work" / "post_topics_batch.json"   # the batch being processed (work/ is not in Git)

MODEL = os.environ.get("TBK_TOPICS_MODEL", "claude-opus-5-5")
BATCH = 40   # posts in one request
# $ per million tokens (input, output), for --estimate; the batch is half of this
PRICES = {"claude-opus-5-5": (4.00, 20.00), "claude-sonnet-5-5": (2.00, 10.00), "claude-haiku-5-5": (0.10, 0.50)}

SYSTEM = """You help people search the posts on X of Tobokegao (とぼけがお), a Japanese \
musician: chiptune (GAMEBOY / LSDj, M8 Tracker), VOCALOID and other voice synthesis, \
OTO-MAD, Pure MIDI, and the label TBKgao. The posts are mostly casual Japanese.

For each post, list the words someone might type into a search box to find it: what the \
post is about, other ways to say the words in it (kana and kanji forms, abbreviations, \
the full names of things it shortens), the names of the tools, games, events, people or \
works it is about, and a few English words for the same. Keep to what the post is really \
about; do not guess at what it might mean, add opinions, or describe its tone. A post \
with nothing to search for (a lone emoji, "おはよう") gets an empty list. Give at most \
12 Japanese and 8 English words, each one to three words long."""

SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "ja": {"type": "array", "items": {"type": "string"}},
                    "en": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["id", "ja", "en"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["items"],
    "additionalProperties": False,
}


def load_posts() -> dict[str, dict]:
    """Own posts and replies by id (reposts are other people's words and are left out)."""
    posts = {}
    for path in sorted(POSTS.glob("*.json")):
        for p in json.loads(path.read_text("utf-8")).values():
            if p["k"] in ("own", "reply"):
                # the month of its date, as the page looks it up
                posts[p["id"]] = {**p, "month": p["d"][:7]}
    return posts


def load_topics() -> dict[str, dict[str, str]]:
    return {path.stem: json.loads(path.read_text("utf-8")) for path in sorted(TOPICS.glob("*.json"))}


def todo(posts: dict[str, dict], topics: dict[str, dict[str, str]]) -> list[dict]:
    """The posts without words yet, newest first."""
    done = {i for month in topics.values() for i in month}
    return sorted((p for i, p in posts.items() if i not in done), key=lambda p: p["d"], reverse=True)


def params(batch: list[dict]) -> dict:
    payload = [{"id": p["id"], "date": p["d"][:10], **({"to": p["to"]} if p.get("to") else {}), "text": p["t"]}
               for p in batch]
    return {
        "model": MODEL,
        "max_tokens": 16000,
        "system": SYSTEM,
        "messages": [{"role": "user", "content": "Give the search words for these posts. Return one entry per id.\n\n"
                      + json.dumps(payload, ensure_ascii=False)}],
        "output_config": {"effort": "low", "format": {"type": "json_schema", "schema": SCHEMA}},
    }


def words(r: dict) -> str:
    seen, out = set(), []
    for w in r["ja"] + r["en"]:
        w = " ".join(w.split())
        if w and w.lower() not in seen:
            seen.add(w.lower())
            out.append(w)
    return " ".join(out)


def merge(results: list[dict], posts: dict[str, dict], topics: dict[str, dict[str, str]]) -> int:
    """Puts the words into the month files; returns how many posts got them."""
    n = 0
    for r in results:
        p = posts.get(r["id"])
        if not p:
            continue
        topics.setdefault(p["month"], {})[p["id"]] = words(r)
        n += 1
    TOPICS.mkdir(exist_ok=True)
    for month, entries in topics.items():
        (TOPICS / f"{month}.json").write_text(
            json.dumps(dict(sorted(entries.items())), ensure_ascii=False, indent=0) + "\n", "utf-8")
    return n


def parse(message) -> list[dict]:
    if message.stop_reason == "refusal":
        raise RuntimeError("refused")
    if message.stop_reason == "max_tokens":
        raise RuntimeError("cut off at max_tokens")
    return json.loads(next(b.text for b in message.content if b.type == "text"))["items"]


def estimate(pending: list[dict]) -> None:
    # Japanese runs about one token a character; the words come to about 60 tokens a post
    chars = sum(len(p["t"]) + 40 for p in pending)
    requests = -(-len(pending) // BATCH)
    tokens_in = chars + requests * (len(SYSTEM) // 4 + 300)
    tokens_out = len(pending) * 60
    print(f"{len(pending)} posts in {requests} requests, about {tokens_in / 1e6:.1f}M tokens in, "
          f"{tokens_out / 1e6:.1f}M out (more with thinking)")
    for model, (pin, pout) in PRICES.items():
        cost = tokens_in / 1e6 * pin + tokens_out / 1e6 * pout
        print(f"  {model}: about ${cost:.2f} one by one, ${cost / 2:.2f} as a batch")


def main() -> int:
    args = sys.argv[1:]
    posts = load_posts()
    topics = load_topics()
    pending = todo(posts, topics)
    if "--estimate" in args:
        estimate(pending)
        return 0
    key = os.environ.get("TBK_ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        print("TBK_ANTHROPIC_API_KEY not set; nothing sent")
        return 1

    import anthropic

    client = anthropic.Anthropic(api_key=key)

    if "--collect" in args:
        if not PENDING.exists():
            print("no batch waiting")
            return 0
        batch_id = json.loads(PENDING.read_text("utf-8"))["id"]
        batch = client.messages.batches.retrieve(batch_id)
        if batch.processing_status != "ended":
            c = batch.request_counts
            print(f"{batch_id}: {batch.processing_status}, {c.processing} requests left")
            return 0
        results, failed = [], 0
        for r in client.messages.batches.results(batch_id):
            try:
                if r.result.type != "succeeded":
                    raise RuntimeError(r.result.type)
                results += parse(r.result.message)
            except (RuntimeError, ValueError) as e:
                failed += 1
                print(f"{r.custom_id} failed, left for the next run: {e}", file=sys.stderr)
        print(f"{merge(results, posts, topics)} posts got words; {failed} requests failed")
        PENDING.unlink()
        return 0

    if "--batch" in args:
        if PENDING.exists():
            print("a batch is already waiting; run --collect first")
            return 1
        from anthropic.types.message_create_params import MessageCreateParamsNonStreaming
        from anthropic.types.messages.batch_create_params import Request

        requests = [Request(custom_id=f"t{i // BATCH}", params=MessageCreateParamsNonStreaming(**params(pending[i:i + BATCH])))
                    for i in range(0, len(pending), BATCH)]
        if not requests:
            print("every post has words")
            return 0
        batch = client.messages.batches.create(requests=requests)
        PENDING.parent.mkdir(exist_ok=True)
        PENDING.write_text(json.dumps({"id": batch.id, "model": MODEL}) + "\n", "utf-8")
        print(f"sent {len(pending)} posts in {len(requests)} requests as {batch.id}; run --collect later")
        return 0

    limit = int(args[args.index("--limit") + 1]) if "--limit" in args else len(pending)
    pending = pending[:limit]
    got = 0
    for i in range(0, len(pending), BATCH):
        try:
            message = client.messages.create(**params(pending[i:i + BATCH]))
            results = parse(message)
        except (anthropic.APIStatusError, anthropic.APIConnectionError, RuntimeError, ValueError) as e:
            print(f"request {i // BATCH + 1} failed, left for the next run: {e}", file=sys.stderr)
            continue
        got += merge(results, posts, topics)
        u = message.usage
        print(f"request {i // BATCH + 1}: {len(results)} posts, {u.input_tokens} tokens in, {u.output_tokens} out")
    print(f"{got} posts got words")
    return 0


if __name__ == "__main__":
    sys.exit(main())

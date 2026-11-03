"""Search words and kinds for each own post and reply in the memo, from Claude (decision 0045).

Mini Tobokegao and the memo search find posts with Pagefind, which only knows the words
in a post. This script asks Claude, once per post, for two things:

- words: the words someone might search with to find it: what it is about, other ways to
  say it, related names, in Japanese and English. They go to data/memo/topics/YYYY-MM.json
  ({id: "word word ..."}).
- kinds (--kinds): what kind of question the post answers, from a short fixed list (it
  recommends something, tells how to do something, says what Tobokegao likes, ...). They go
  to data/memo/kinds/YYYY-MM.json ({id: "rec howto"}), so mini Tobokegao can answer "おすすめは？"
  with a post that recommends something.

layouts/_partials/notes-post.html puts both in each post as text the search reads but the
page does not show. The answer shown is still the post itself (decision 0032).

It runs on this PC only, with the key in TBK_ANTHROPIC_API_KEY (never in Actions). Not in
ANTHROPIC_API_KEY: Claude Code takes that one and would bill its own work to the key.
Posts that already have them are skipped, so after the daily update (0030) it sends only
the new ones.

    python scripts/post_topics.py --estimate          # count what would be sent, and the cost
    python scripts/post_topics.py --limit 40          # try on the 40 newest posts without words
    python scripts/post_topics.py --batch             # send all the rest as one batch (half price)
    python scripts/post_topics.py --collect           # take in the batch's results when it is done

Add --kinds to any of them for the kinds instead of the words.
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

MODEL = os.environ.get("TBK_TOPICS_MODEL", "claude-opus-5-5")
BATCH = 40   # posts in one request
# $ per million tokens (input, output), for --estimate; the batch is half of this
PRICES = {"claude-opus-5-5": (4.00, 20.00), "claude-sonnet-5-5": (2.00, 10.00), "claude-haiku-5-5": (0.10, 0.50)}

ABOUT = """You help people search the posts on X of Tobokegao (とぼけがお), a Japanese \
musician: chiptune (GAMEBOY / LSDj, M8 Tracker), VOCALOID and other voice synthesis, \
OTO-MAD, Pure MIDI, and the label TBKgao. The posts are mostly casual Japanese.

"""

# the kinds, as the tokens put in the page; assets/js/notes.js (initMini) has the same list
KINDS = {
    "rec": "recommends or introduces something to others: a tool, plugin, song, album, artist, game, video, "
           "article, product, shop or food that the post says is good or worth trying",
    "howto": "tells how to do something: a technique, a setting, a tip, a workaround, steps",
    "like": "says what Tobokegao likes, loves or is into, or their favorite of something",
    "think": "gives Tobokegao's own opinion or view on something (not only liking it)",
    "news": "announces Tobokegao's own release, live show, event, work, article or video",
    "life": "about Tobokegao's day: weather, food, health, travel, things that happened",
}

JOBS = {
    "words": {
        "dir": MEMO / "topics",
        "pending": ROOT / "work" / "post_topics_batch.json",   # the batch being processed (work/ is not in Git)
        "ask": "Give the search words for these posts. Return one entry per id.",
        "system": ABOUT + """For each post, list the words someone might type into a search box \
to find it: what the post is about, other ways to say the words in it (kana and kanji forms, \
abbreviations, the full names of things it shortens), the names of the tools, games, events, \
people or works it is about, and a few English words for the same. Keep to what the post is \
really about; do not guess at what it might mean, add opinions, or describe its tone. A post \
with nothing to search for (a lone emoji, "おはよう") gets an empty list. Give at most 12 \
Japanese and 8 English words, each one to three words long.""",
        "fields": {"ja": {"type": "array", "items": {"type": "string"}},
                   "en": {"type": "array", "items": {"type": "string"}}},
        "out": 60,   # tokens a post, for --estimate
    },
    "kinds": {
        "dir": MEMO / "kinds",
        "pending": ROOT / "work" / "post_kinds_batch.json",
        "ask": "Give the kinds of these posts. Return one entry per id.",
        "system": ABOUT + "For each post, choose which of these kinds it is, if any. Choose only "
        "what the post itself clearly does; most posts are none or one, a few are two. A reply "
        "counts too (a reply that answers someone's question with a tip is howto).\n\n"
        + "\n".join(f"- {k}: {v}" for k, v in KINDS.items()),
        "fields": {"kinds": {"type": "array", "items": {"type": "string", "enum": list(KINDS)}}},
        "out": 15,
    },
}


def schema(job: dict) -> dict:
    return {
        "type": "object",
        "properties": {
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {"id": {"type": "string"}, **job["fields"]},
                    "required": ["id", *job["fields"]],
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


def load_done(job: dict) -> dict[str, dict[str, str]]:
    return {path.stem: json.loads(path.read_text("utf-8")) for path in sorted(job["dir"].glob("*.json"))}


def todo(posts: dict[str, dict], done: dict[str, dict[str, str]]) -> list[dict]:
    """The posts without an answer yet, newest first."""
    have = {i for month in done.values() for i in month}
    return sorted((p for i, p in posts.items() if i not in have), key=lambda p: p["d"], reverse=True)


def params(job: dict, batch: list[dict]) -> dict:
    payload = [{"id": p["id"], "date": p["d"][:10], **({"to": p["to"]} if p.get("to") else {}), "text": p["t"]}
               for p in batch]
    return {
        "model": MODEL,
        "max_tokens": 16000,
        "system": job["system"],
        "messages": [{"role": "user", "content": job["ask"] + "\n\n" + json.dumps(payload, ensure_ascii=False)}],
        "output_config": {"effort": "low", "format": {"type": "json_schema", "schema": schema(job)}},
    }


def value(r: dict) -> str:
    """One post's answer as the text put in the page."""
    if "kinds" in r:
        return " ".join(k for k in KINDS if k in r["kinds"])
    seen, out = set(), []
    for w in r["ja"] + r["en"]:
        w = " ".join(w.split())
        if w and w.lower() not in seen:
            seen.add(w.lower())
            out.append(w)
    return " ".join(out)


def merge(job: dict, results: list[dict], posts: dict[str, dict], done: dict[str, dict[str, str]]) -> int:
    """Puts the answers into the month files; returns how many posts got them."""
    n = 0
    for r in results:
        p = posts.get(r["id"])
        if not p:
            continue
        done.setdefault(p["month"], {})[p["id"]] = value(r)
        n += 1
    job["dir"].mkdir(exist_ok=True)
    for month, entries in done.items():
        (job["dir"] / f"{month}.json").write_text(
            json.dumps(dict(sorted(entries.items())), ensure_ascii=False, indent=0) + "\n", "utf-8")
    return n


def parse(message) -> list[dict]:
    if message.stop_reason == "refusal":
        raise RuntimeError("refused")
    if message.stop_reason == "max_tokens":
        raise RuntimeError("cut off at max_tokens")
    return json.loads(next(b.text for b in message.content if b.type == "text"))["items"]


def estimate(job: dict, pending: list[dict]) -> None:
    # Japanese runs about one token a character
    chars = sum(len(p["t"]) + 40 for p in pending)
    requests = -(-len(pending) // BATCH)
    tokens_in = chars + requests * (len(job["system"]) // 4 + 300)
    tokens_out = len(pending) * job["out"]
    print(f"{len(pending)} posts in {requests} requests, about {tokens_in / 1e6:.1f}M tokens in, "
          f"{tokens_out / 1e6:.1f}M out (more with thinking)")
    for model, (pin, pout) in PRICES.items():
        cost = tokens_in / 1e6 * pin + tokens_out / 1e6 * pout
        print(f"  {model}: about ${cost:.2f} one by one, ${cost / 2:.2f} as a batch")


def main() -> int:
    args = sys.argv[1:]
    job = JOBS["kinds" if "--kinds" in args else "words"]
    pending_file = job["pending"]
    posts = load_posts()
    done = load_done(job)
    pending = todo(posts, done)
    if "--estimate" in args:
        estimate(job, pending)
        return 0
    key = os.environ.get("TBK_ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        print("TBK_ANTHROPIC_API_KEY not set; nothing sent")
        return 1

    import anthropic

    client = anthropic.Anthropic(api_key=key)

    if "--collect" in args:
        if not pending_file.exists():
            print("no batch waiting")
            return 0
        batch_id = json.loads(pending_file.read_text("utf-8"))["id"]
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
        print(f"{merge(job, results, posts, done)} posts done; {failed} requests failed")
        pending_file.unlink()
        return 0

    if "--batch" in args:
        if pending_file.exists():
            print("a batch is already waiting; run --collect first")
            return 1
        from anthropic.types.message_create_params import MessageCreateParamsNonStreaming
        from anthropic.types.messages.batch_create_params import Request

        requests = [Request(custom_id=f"t{i // BATCH}",
                            params=MessageCreateParamsNonStreaming(**params(job, pending[i:i + BATCH])))
                    for i in range(0, len(pending), BATCH)]
        if not requests:
            print("every post is done")
            return 0
        batch = client.messages.batches.create(requests=requests)
        pending_file.parent.mkdir(exist_ok=True)
        pending_file.write_text(json.dumps({"id": batch.id, "model": MODEL}) + "\n", "utf-8")
        print(f"sent {len(pending)} posts in {len(requests)} requests as {batch.id}; run --collect later")
        return 0

    limit = int(args[args.index("--limit") + 1]) if "--limit" in args else len(pending)
    pending = pending[:limit]
    got = 0
    for i in range(0, len(pending), BATCH):
        try:
            message = client.messages.create(**params(job, pending[i:i + BATCH]))
            results = parse(message)
        except (anthropic.APIStatusError, anthropic.APIConnectionError, RuntimeError, ValueError) as e:
            print(f"request {i // BATCH + 1} failed, left for the next run: {e}", file=sys.stderr)
            continue
        got += merge(job, results, posts, done)
        u = message.usage
        print(f"request {i // BATCH + 1}: {len(results)} posts, {u.input_tokens} tokens in, {u.output_tokens} out")
    print(f"{got} posts done")
    return 0


if __name__ == "__main__":
    sys.exit(main())

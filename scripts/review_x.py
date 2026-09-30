"""A local page for picking activity-log rows out of the X archive candidates.

Reads work/x/candidates.json (from scripts/import_x_archive.py) and the images copied to
work/x/media, and writes every choice straight back to candidates.json:
  status  "log" (goes to the log), "skip", or "new" (not decided yet)
  flyers  image file names to use as the event's flyer
  note    a free memo (the event's name, a correction to the date, ...)
Rows already in data/timeline.json within ten days are shown beside each candidate, so an
event that is logged already can be skipped.

    python scripts/review_x.py            # then open http://127.0.0.1:8765/
    python scripts/review_x.py --export DIR   # data files for the artifact version
    python scripts/review_x.py --export DIR --picks PICKS  # ... with a guess learnt from its choices
    python scripts/review_x.py --apply picks.json  # choices made on the artifact
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import sys
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / "work" / "x"
CANDIDATES = WORK / "candidates.json"
MEDIA = WORK / "media"
TIMELINE = ROOT / "data" / "timeline.json"
NEWS = ROOT / "data" / "news.json"


def load() -> list[dict]:
    return json.loads(CANDIDATES.read_text(encoding="utf-8"))


def save(rows: list[dict]) -> None:
    tmp = CANDIDATES.with_suffix(".tmp")
    tmp.write_text(json.dumps(rows, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    os.replace(tmp, CANDIDATES)


def media_index() -> dict[str, list[str]]:
    """Image files by the post id they belong to (files are named <post id>-<key>.jpg)."""
    out: dict[str, list[str]] = {}
    if MEDIA.is_dir():
        for f in sorted(MEDIA.iterdir()):
            out.setdefault(f.name.split("-", 1)[0], []).append(f.name)
    return out


def logged() -> list[dict]:
    rows = []
    for p in (TIMELINE, NEWS):
        if p.exists():
            rows += [{"date": r["date"], "kind": r.get("kind", ""), "ja": r.get("ja", "")}
                     for r in json.loads(p.read_text(encoding="utf-8"))]
    return rows


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):  # keep the console quiet
        pass

    def send(self, code: int, body: bytes, ctype: str) -> None:
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path == "/":
            self.send(200, PAGE.encode(), "text/html; charset=utf-8")
        elif path == "/api/data":
            data = {"candidates": load(), "media": media_index(), "logged": logged()}
            self.send(200, json.dumps(data, ensure_ascii=False).encode(), "application/json")
        elif path.startswith("/media/"):
            name = urllib.parse.unquote(path[len("/media/"):])
            f = (MEDIA / name).resolve()
            if f.parent != MEDIA.resolve() or not f.is_file():
                self.send(404, b"not found", "text/plain")
                return
            self.send(200, f.read_bytes(), mimetypes.guess_type(f.name)[0] or "application/octet-stream")
        else:
            self.send(404, b"not found", "text/plain")

    def do_POST(self):
        if urllib.parse.urlparse(self.path).path != "/api/save":
            self.send(404, b"not found", "text/plain")
            return
        change = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        rows = load()
        for r in rows:
            if r["id"] == change["id"]:
                if change.get("status") in ("new", "log", "skip"):
                    r["status"] = change["status"]
                if isinstance(change.get("flyers"), list):
                    r["flyers"] = [str(x) for x in change["flyers"]]
                if isinstance(change.get("note"), str):
                    r["note"] = change["note"]
                break
        else:
            self.send(404, b"unknown id", "text/plain")
            return
        save(rows)
        self.send(200, b'{"ok":true}', "application/json")


PAGE = r"""<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>X候補の選別</title>
<style>
:root {
  --desk: #e4e9ef; --win: #ffffff; --ink: #0d2233; --ink-dim: #4a5a68; --frame: #0d2233;
  --bar: #006599; --bar-ink: #ffffff; --mark: #ffcc00; --log: #d9f0d3; --skip: #eceff2;
  --f-body: "IBM Plex Sans JP", system-ui, sans-serif; --f-mono: ui-monospace, Consolas, monospace;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--desk); color: var(--ink); font: 14px/1.6 var(--f-body); }
header { position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center;
  padding: 8px 16px; background: var(--bar); color: var(--bar-ink); border-bottom: 3px double var(--frame); }
header h1 { margin: 0; font: 700 15px/1.4 var(--f-mono); }
header label { display: flex; gap: 6px; align-items: center; }
header select, header input { font: inherit; border: 1px solid var(--frame); background: var(--win); color: var(--ink); padding: 2px 4px; }
header .count { margin-left: auto; font-family: var(--f-mono); }
main { max-width: 980px; margin: 0 auto; padding: 16px; }
.card { background: var(--win); border: 3px double var(--frame); margin: 0 0 16px; }
.card.is-log { background: var(--log); }
.card.is-skip { background: var(--skip); opacity: .7; }
.card.is-focus { outline: 3px solid var(--mark); outline-offset: 2px; }
.card__head { display: flex; flex-wrap: wrap; gap: 4px 14px; padding: 6px 12px; border-bottom: 1px solid var(--frame); font-family: var(--f-mono); font-size: 13px; }
.card__head a { color: inherit; }
.card__event { font-weight: 700; }
.card__hits { color: var(--ink-dim); }
.card__body { padding: 10px 12px; }
.post { margin: 0 0 10px; }
.post + .post { border-top: 1px dashed var(--ink-dim); padding-top: 8px; }
.post__date { font: 12px var(--f-mono); color: var(--ink-dim); }
.post__text { white-space: pre-wrap; overflow-wrap: anywhere; margin: 2px 0 0; }
.post__text a { color: var(--bar); }
.imgs { display: flex; flex-wrap: wrap; gap: 8px; margin: 6px 0 0; }
.imgs button { padding: 0; border: 3px solid transparent; background: none; cursor: pointer; }
.imgs button[aria-pressed="true"] { border-color: var(--mark); }
.imgs img { display: block; height: 160px; width: auto; }
.near { margin: 6px 0 0; padding: 6px 8px; border: 1px solid var(--frame); background: var(--desk); font-size: 13px; }
.near b { font-family: var(--f-mono); }
.card__foot { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 8px 12px; border-top: 1px solid var(--frame); }
.card__foot button { font: inherit; padding: 2px 12px; border: 2px solid var(--frame); background: var(--win); color: var(--ink); cursor: pointer; }
.card__foot button[aria-pressed="true"] { background: var(--frame); color: var(--win); }
.card__foot input { flex: 1 1 240px; font: inherit; padding: 2px 6px; border: 1px solid var(--frame); }
.keys { font: 12px var(--f-mono); color: var(--ink-dim); margin: 0 0 12px; }
.empty { padding: 24px; text-align: center; }
</style>
</head>
<body>
<header>
  <h1>X候補の選別</h1>
  <label>年 <select id="year"><option value="">すべて</option></select></label>
  <label>状態 <select id="status">
    <option value="new">未定</option><option value="log">載せる</option><option value="skip">載せない</option><option value="">すべて</option>
  </select></label>
  <label>点数 <input id="score" type="number" min="0" value="0" style="width:4em"></label>
  <label>並び <select id="sort"><option value="date">日付順</option><option value="score">点数順</option></select></label>
  <label>フライヤーあり <input id="hasimg" type="checkbox"></label>
  <span class="count" id="count"></span>
</header>
<main>
  <p class="keys">j / k: 次・前　1: 載せる　2: 載せない　0: 未定に戻す　画像を押す: フライヤーに使う・使わない</p>
  <div id="list"></div>
</main>
<script>
let data, focus = 0, shown = [];
const $ = s => document.querySelector(s);
const esc = s => s.replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const linkify = s => esc(s).replace(/https?:\/\/[^\s<]+/g, u => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
const LABEL = {new: "未定", log: "載せる", skip: "載せない"};

async function init() {
  data = await (await fetch("/api/data")).json();
  const years = [...new Set(data.candidates.map(c => c.date.slice(0, 4)))].sort();
  $("#year").insertAdjacentHTML("beforeend", years.map(y => `<option>${y}</option>`).join(""));
  for (const id of ["#year", "#status", "#score", "#sort", "#hasimg"]) $(id).addEventListener("input", render);
  render();
}

function images(c) {
  return c.posts.flatMap(p => data.media[p.id] || []);
}

function near(c) {
  const day = d => Date.parse(d) / 864e5;
  const t = day(c.event_date || c.date);
  return data.logged.filter(r => Math.abs(day(r.date) - t) <= 10);
}

function render() {
  const y = $("#year").value, st = $("#status").value, min = +$("#score").value || 0, img = $("#hasimg").checked;
  shown = data.candidates.filter(c => (!y || c.date.startsWith(y)) && (!st || (c.status || "new") === st)
    && c.score >= min && (!img || images(c).length));
  if ($("#sort").value === "score") shown = [...shown].sort((a, b) => b.score - a.score || a.date.localeCompare(b.date));
  count();
  $("#list").innerHTML = shown.length ? shown.map(card).join("") : `<p class="empty">条件に合う候補はありません</p>`;
  focus = Math.min(focus, Math.max(shown.length - 1, 0));
  mark();
}

function count() {
  const done = data.candidates.filter(c => c.status && c.status !== "new").length;
  $("#count").textContent = `表示 ${shown.length}件 / 選別済み ${done}件 / 全${data.candidates.length}件`;
}

function card(c, i) {
  const st = c.status || "new", fl = c.flyers || [];
  const posts = c.posts.map(p => `<div class="post"><div class="post__date">${p.date}</div>
    <p class="post__text">${linkify(p.text)}</p>
    ${(data.media[p.id] || []).length ? `<div class="imgs">${data.media[p.id].map(f =>
      `<button type="button" data-flyer="${esc(f)}" aria-pressed="${fl.includes(f)}" title="フライヤーに使う"><img src="/media/${encodeURIComponent(f)}" alt="" loading="lazy"></button>`).join("")}</div>` : ""}
  </div>`).join("");
  const nb = near(c);
  return `<article class="card is-${st}" data-i="${i}">
    <div class="card__head">
      <span class="card__event">${c.event_date ? "当日? " + c.event_date : "当日不明"}</span>
      <span>投稿 ${c.date}</span><span>点数 ${c.score}</span>
      <span class="card__hits">${esc(c.hits.join(" / "))}</span>
      <a href="${c.url}" target="_blank" rel="noopener">Xで開く</a>
    </div>
    <div class="card__body">${posts}
      ${nb.length ? `<div class="near">近い日付の既存ログ: ${nb.map(r => `<b>${r.date}</b> ${esc(r.ja)}`).join("　")}</div>` : ""}
    </div>
    <div class="card__foot">
      ${["log", "skip", "new"].map(s => `<button type="button" data-status="${s}" aria-pressed="${st === s}">${LABEL[s]}</button>`).join("")}
      <input type="text" data-note placeholder="メモ（イベント名、日付の訂正など）" value="${esc(c.note || "")}">
    </div>
  </article>`;
}

async function update(c, change) {
  Object.assign(c, change);
  count();
  await fetch("/api/save", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({id: c.id, ...change})});
}

function mark() {
  document.querySelectorAll(".card").forEach((el, i) => el.classList.toggle("is-focus", i === focus));
}

function redraw(i) {
  const el = document.querySelector(`.card[data-i="${i}"]`);
  el.outerHTML = card(shown[i], i);
  mark();
}

$("#list").addEventListener("click", e => {
  const el = e.target.closest(".card"); if (!el) return;
  const i = +el.dataset.i, c = shown[i];
  focus = i;
  const s = e.target.closest("[data-status]");
  const f = e.target.closest("[data-flyer]");
  if (s) { update(c, {status: s.dataset.status}); redraw(i); }
  else if (f) {
    const fl = new Set(c.flyers || []);
    fl.has(f.dataset.flyer) ? fl.delete(f.dataset.flyer) : fl.add(f.dataset.flyer);
    update(c, {flyers: [...fl]}); redraw(i);
  } else mark();
});

$("#list").addEventListener("change", e => {
  if (!e.target.matches("[data-note]")) return;
  const i = +e.target.closest(".card").dataset.i;
  update(shown[i], {note: e.target.value});
});

document.addEventListener("keydown", e => {
  if (e.target.matches("input, select") || e.ctrlKey || e.metaKey || e.altKey || !shown.length) return;
  const go = d => { focus = Math.max(0, Math.min(shown.length - 1, focus + d)); mark();
    document.querySelector(".card.is-focus")?.scrollIntoView({block: "start"}); };
  const set = s => { update(shown[focus], {status: s}); redraw(focus); go(1); };
  if (e.key === "j") go(1);
  else if (e.key === "k") go(-1);
  else if (e.key === "1") set("log");
  else if (e.key === "2") set("skip");
  else if (e.key === "0") set("new");
});

init();
</script>
</body>
</html>
"""


def read_picks(path: Path | None) -> dict[str, dict]:
    """Choices saved from the artifact (its db "picks" collection as a JSON list of
    {id, data}, or a folder of one JSON file per document), by candidate id."""
    if not path:
        return {}
    docs = ([{"id": f.stem, "data": json.loads(f.read_text(encoding="utf-8"))} for f in sorted(path.glob("*.json"))]
            if path.is_dir() else json.loads(path.read_text(encoding="utf-8")))
    out = {}
    for d in docs:
        pid = d.get("id") or ""
        out["x:" + pid.removeprefix("x-")] = d.get("data", d)
    return out


# Share of the undecided candidates, lowest guess first, marked "probably skip". Tested on
# the first 369 choices (five folds), the lowest 20% held no log picks. The undecided ones
# are mostly later posts than the choices learnt from, so this is a mark, not a choice,
# and posts naming the artist's own part (出ます, やります, 自分, ...) are never marked.
GUESS_SHARE = 0.2


def guess(rows: list[dict], status: dict[str, str]) -> dict[str, float]:
    """How likely each candidate is to go to the log, learnt from the choices made so far:
    naive Bayes over character pairs and triples, the scoring hits, the thread length and
    whether the log already has a row within ten days."""
    import math
    import re
    from datetime import date

    days = [date.fromisoformat(r["date"][:10]) for r in logged() if len(r["date"]) >= 10]

    def grams(r):
        t = re.sub(r"https?://\S+", " URL ", " ".join(p["text"] for p in r["posts"]))
        g = {t[i:i + n] for n in (2, 3) for i in range(len(t) - n + 1)}
        g |= {"H:" + h for h in r.get("hits", [])}
        d = date.fromisoformat((r.get("event_date") or r["date"])[:10])
        g.add("NEAR" if any(abs((d - x).days) <= 10 for x in days) else "FAR")
        g.add("S%d" % min(r["score"], 14))
        g.add("T%d" % min(len(r["posts"]), 4))
        return g

    def train(items):
        cnt, n = {True: {}, False: {}}, {True: 0, False: 0}
        for g, y in items:
            n[y] += 1
            for k in g:
                cnt[y][k] = cnt[y].get(k, 0) + 1
        return cnt, n

    def prob(model, g):
        cnt, n = model
        lp = math.log(n[True] / n[False])
        for k in g:
            a, b = cnt[True].get(k, 0), cnt[False].get(k, 0)
            if a + b >= 2:
                lp += math.log((a + 1) / (n[True] + 2)) - math.log((b + 1) / (n[False] + 2))
        return 1 / (1 + math.exp(-max(-30.0, min(30.0, lp / 8))))

    G = {r["id"]: grams(r) for r in rows}
    done = [(G[i], s == "log") for i, s in status.items() if i in G and s in ("log", "skip")]
    if sum(y for _, y in done) < 5 or sum(not y for _, y in done) < 5:
        return {}
    model = train(done)
    return {i: prob(model, g) for i, g in G.items()}


def maybe_skip(rows: list[dict], status: dict[str, str], likely: dict[str, float]) -> set[str]:
    """The undecided candidates to mark "probably skip" (see GUESS_SHARE)."""
    from import_x_archive import MINE, OWN

    undecided = sorted((r for r in rows if status[r["id"]] == "new" and r["id"] in likely),
                       key=lambda r: likely[r["id"]])
    low = undecided[:int(len(undecided) * GUESS_SHARE)]
    return {r["id"] for r in low
            if not any(MINE.search(p["text"]) or OWN.search(p["text"]) for p in r["posts"])}


THUMB_EDGE = 480           # long side of the thumbnails sent to the artifact
THUMB_FILE_LIMIT = 12_000_000


def export(dest: Path, sample: bool = False, picks_path: Path | None = None) -> None:
    """Data files for the artifact version of this page (published by Claude):
    candidates.json (posts, earlier choices, nearby log rows, the guess learnt from the
    choices so far) and thumbs-N.json (small WebP thumbnails as data URIs, split to stay
    under the artifact's file size)."""
    import base64
    import io

    from PIL import Image

    dest.mkdir(parents=True, exist_ok=True)
    media = media_index()
    source = [c for c in load() if not c.get("merged")]
    picks = read_picks(picks_path)
    status = {c["id"]: (picks.get(c["id"]) or {}).get("status") or c.get("status", "new") for c in source}
    likely = guess(source, status)
    marked = maybe_skip(source, status, likely)
    rows = []
    for c in source:
        lk = likely.get(c["id"])
        rows.append({k: c.get(k) for k in ("id", "url", "date", "event_date", "score", "hits", "status", "flyers", "note")}
                    | {"likely": None if lk is None else round(lk, 3),
                       "maybe_skip": c["id"] in marked,
                       "posts": [{"id": p["id"], "date": p["date"], "text": p["text"],
                                  "media": media.get(p["id"], [])} for p in c["posts"]]})
    parts, part, size = [], {}, 0
    for name in sorted({f for r in rows for p in r["posts"] for f in p["media"]}):
        im = Image.open(MEDIA / name)
        im.thumbnail((THUMB_EDGE, THUMB_EDGE))
        buf = io.BytesIO()
        im.convert("RGB").save(buf, "WEBP", quality=70)
        uri = "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()
        if size + len(uri) > THUMB_FILE_LIMIT and part:
            parts.append(part)
            part, size = {}, 0
        part[name] = uri
        size += len(uri)
    if part:
        parts.append(part)
    for i, p in enumerate(parts, 1):
        (dest / f"thumbs-{i}.json").write_text(json.dumps(p), encoding="utf-8")
    (dest / "candidates.json").write_text(json.dumps(
        {"sample": sample, "thumbs": len(parts), "candidates": rows, "logged": logged()},
        ensure_ascii=False), encoding="utf-8")
    print(f"{len(rows)} candidates, {sum(map(len, parts))} thumbnails in {len(parts)} file(s) -> {dest}")
    if likely:
        print(f"guess from {sum(s in ('log', 'skip') for s in status.values())} choices: "
              f"{len(marked)} of {sum(s == 'new' for s in status.values())} undecided marked probably skip")


def apply(picks_path: Path) -> None:
    """Copy the choices made on the artifact (its db "picks" collection, saved by Claude
    as a JSON list of {id, data}) into candidates.json."""
    picks = read_picks(picks_path)
    rows = load()
    n = 0
    for r in rows:
        p = picks.get(r["id"])
        if p:
            for k in ("status", "flyers", "note"):
                if k in p:
                    r[k] = p[k]
            n += 1
    save(rows)
    print(f"applied {n} of {len(picks)} choices")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--export", type=Path, help="write the artifact's data files here")
    ap.add_argument("--apply", type=Path, help="merge choices saved from the artifact")
    ap.add_argument("--sample", action="store_true", help="mark exported data as example data")
    ap.add_argument("--picks", type=Path, help="with --export: the artifact's choices, to learn the guess from")
    args = ap.parse_args()
    if not CANDIDATES.exists():
        print("no", CANDIDATES.relative_to(ROOT), "yet; run scripts/import_x_archive.py first")
        return 1
    if args.export:
        export(args.export, args.sample, args.picks)
        return 0
    if args.apply:
        apply(args.apply)
        return 0
    print(f"http://127.0.0.1:{args.port}/  (Ctrl+C to stop)")
    ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()
    return 0


if __name__ == "__main__":
    sys.exit(main())

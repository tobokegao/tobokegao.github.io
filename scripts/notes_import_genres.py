"""Turn a genre-wiki JSON (zatto's genre wiki, "JSONに書き出す") into notes in content/memo.

Each genre becomes a note with its year; each link is written once, on the lower /
later side (up = 上位, src = 源流), and x_notes.py fills in the other side. A note that
already exists is left as it is, so notes written by hand are never overwritten.

    python scripts/notes_import_genres.py genre-wiki.json
    python scripts/x_notes.py
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from x_notes import NOTES, slug  # noqa: E402

CREDIT = "zatto"


def toml_str(s: str) -> str:
    return json.dumps(s, ensure_ascii=False)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("json", type=Path)
    args = ap.parse_args()
    db = json.loads(args.json.read_text(encoding="utf-8"))
    names = {g["id"]: g["name"] for g in db["genres"]}
    rel = {g["id"]: {"up": [], "src": []} for g in db["genres"]}
    for e in db["edges"]:
        if e["a"] in names and e["b"] in names:
            rel[e["b"]]["up" if e["t"] == "h" else "src"].append(names[e["a"]])
    NOTES.mkdir(parents=True, exist_ok=True)
    made = 0
    for g in db["genres"]:
        path = NOTES / f"{slug(g['name'])}.md"
        if path.exists():
            continue
        lines = ["+++", f"title = {toml_str(g['name'])}", f"born = {int(g['born'])}"]
        for k in ("up", "src"):
            if rel[g["id"]][k]:
                lines.append(f"{k} = [{', '.join(toml_str(n) for n in rel[g['id']][k])}]")
        lines += [f"credit = {toml_str(CREDIT)}", "+++", ""]
        if g.get("desc"):
            lines += [g["desc"], ""]
        path.write_text("\n".join(lines), encoding="utf-8")
        made += 1
    print(f"{made} notes written to {NOTES.relative_to(NOTES.parents[1])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

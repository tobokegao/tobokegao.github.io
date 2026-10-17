"""Write the roots page's genres in the format of zatto's music genre wiki, to share back.

The roots page started from zatto's genre data (decision 0021). This writes ours as a file
that the genre wiki's "JSONを読み込む" takes: genres, their links, the large genres and
zatto's works.

- A genre keeps zatto's id when zatto has it (by name, or by its name before a rename here),
  so the works and anything else that points to it still find it.
- `up` becomes a "h" edge (a = parent, b = child) and `src` an "i" edge (a = root, b = what
  grew from it). A year known only as a part of a decade (`era`) becomes zatto's precision
  (x, x2, x3, x4: the decade, its early, middle and late part).
- Zatto's genres that are not here (not added yet, or left out) are kept as they are, with
  their links, so nothing of zatto's is lost.
- Zatto's large genres are kept; the six that the roots page also has take its colours
  (TRACKMENTO's "riso" colours, as hex).
- Zatto's works are kept.

    python scripts/genre_wiki_export.py <zatto's genre-wiki.json> [out.json]

The output goes to work/genre-wiki.json by default (work/ is not in Git). Loading it in the
genre wiki replaces what is there, so zatto may want to save theirs first.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from x_notes import OUT, ROOT  # noqa: E402

# names zatto's list uses for genres renamed or merged here
RENAMED = {
    "techno music": "techno", "disco music": "disco", "rock music": "rock", "house music": "house",
    "noise music": "noise", "oldskool hiphop": "hip hop", "hiphop": "hip hop", "drum'n'bass": "drum & bass",
    "2-step garage": "2-step", "electronica/idm": "electronica", "oldskool happy hardcore": "happy hardcore",
    "comtemporary r&b": "contemporary r&b", "lo-fi hiphop": "lo-fi hip hop", "jesusclub": "#jesusclub",
    "juke/footwork": "juke", "liquid funk": "liquid drum & bass", "funkey jazz": "soul jazz",
    "comtemporary jazz": "contemporary jazz", "ealry jazz": "new orleans jazz", "kraut rock": "krautrock",
    "music concrete": "musique concrète", "night core": "nightcore", "gypsy swing": "gypsy jazz",
    "rock'n'roll": "rock and roll", "bossanova": "bossa nova", "jerseyclub": "jersey club",
    "swing jazz": "swing", "big band jazz": "big band", "vgm": "ゲーム音楽", "dixieland jazz": "dixieland",
    "m-base派": "m-base", "野郎歌舞伎": "歌舞伎",
}
# the roots page's six large genres by day (TRACKMENTO's "riso" colours, as hex)
COLORS = {1: "#e6b731", 2: "#008bc7", 3: "#e5462c", 4: "#af9ee4", 5: "#80e2b9", 6: "#f594c3"}


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    theirs = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    out_path = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "work" / "genre-wiki.json"
    topics = json.loads((OUT / "graph.json").read_text(encoding="utf-8"))["topics"]
    genres = {k: t for k, t in topics.items() if "born" in t}

    # the same name first, then the old names (Early Jazz is New Orleans Jazz here, but zatto
    # has a New Orleans Jazz too)
    ids = {}
    for renamed in (False, True):
        for g in theirs["genres"]:
            name = g["name"].strip().lower()
            k = RENAMED.get(name, name) if renamed else name
            if k in genres and k not in ids and g["id"] not in ids.values():
                ids[k] = g["id"]
    new = 0
    for k in sorted(genres):
        if k not in ids:
            new += 1
            ids[k] = f"tbk{new:03d}"

    old = {g["id"]: g for g in theirs["genres"]}
    out_genres = []
    for k, t in sorted(genres.items(), key=lambda kv: (kv[1]["born"], kv[1]["title"])):
        o = old.get(ids[k], {})
        out_genres.append({
            "id": ids[k], "name": t["title"], "born": t["born"], "desc": o.get("desc", ""),
            "weight": o.get("weight"), "bm": o.get("bm"), "bd": o.get("bd"),
            "bp": t.get("era") or o.get("bp"),
        })
    edges = []
    for k, t in genres.items():
        for p in t["rel"]["up"]:
            if p in genres:
                edges.append({"t": "h", "a": ids[p], "b": ids[k]})
        for p in t["rel"]["src"]:
            if p in genres:
                edges.append({"t": "i", "a": ids[p], "b": ids[k]})
    have = set(ids.values())
    # zatto's genres that are not here, and their links that touch them
    only = [g for g in theirs["genres"] if g["id"] not in have]
    out_genres += only
    only_ids = {g["id"] for g in only}
    edges += [e for e in theirs["edges"] if e["a"] in only_ids or e["b"] in only_ids]
    # zatto's large genres, the ones the roots page has in its colours
    ours = {ids[k]: t["major"] for k, t in genres.items() if t.get("major")}
    majors = []
    for m in theirs.get("majors", []):
        if not m.get("roots"):
            continue
        name = m["name"].strip().lower()
        k = RENAMED.get(name, name)
        if k in genres and genres[k].get("major"):
            m = dict(m, color=COLORS[genres[k]["major"]])
            ours.pop(ids[k], None)
        majors.append(m)
    for gid, c in ours.items():
        majors.append({"id": f"tbkm{c}", "name": next(t["title"] for k, t in genres.items() if ids[k] == gid),
                       "color": COLORS[c], "roots": [gid], "subs": []})
    works = theirs.get("works", [])

    out_path.parent.mkdir(parents=True, exist_ok=True)
    data = {"genres": out_genres, "edges": edges, "majors": majors, "works": works}
    out_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(genres)} genres from here ({len(genres) - new} with zatto's id, {new} new), "
          f"{len(only)} of zatto's kept as they were, {len(edges)} links, {len(majors)} large genres, "
          f"{len(works)} works -> {out_path}")


if __name__ == "__main__":
    main()

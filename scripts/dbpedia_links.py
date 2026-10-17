"""Fetch how the genre notes are linked in DBpedia (Wikipedia's infoboxes as data).

Each genre note may name its DBpedia resource in the front matter (`dbpedia = "Jazz"`).
This script reads those resources from dbpedia.org and keeps the links between notes
only (a link to a genre without a note is left out):

  X stylisticOrigin Y   ->  X src Y   (Y is a root of X)
  X derivative Y        ->  Y src X
  X musicFusionGenre Y  ->  Y src X
  X musicSubgenre Y     ->  Y up X    (X is the larger genre)

The result goes to data/memo/dbpedia.json; scripts/x_notes.py merges it with the notes'
own links, and DBpedia wins where the two disagree about a pair (decision 0024). The
data is CC BY-SA (from Wikipedia), so the roots page names DBpedia as a source.

    python scripts/dbpedia_links.py
    python scripts/x_notes.py

Run it by hand when notes are added or after a while; it is not run on a schedule.
"""

from __future__ import annotations

import json
import sys
import time
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from x_notes import OUT, read_notes  # noqa: E402

UA = "tobokegao-site/1.0 (+https://tobokegao.github.io/)"
RES = "http://dbpedia.org/resource/"
ONT = "http://dbpedia.org/ontology/"
SPARQL = "https://dbpedia.org/sparql"
# (property, which side is the child, kind of link)
PROPS = [("stylisticOrigin", "self", "src"), ("derivative", "other", "src"),
         ("musicFusionGenre", "other", "src"), ("musicSubgenre", "other", "up")]


def sparql(query: str) -> list[dict]:
    """Ask the public SPARQL endpoint (the per-resource pages of large genres are slow).
    Sent as a POST: with 150 genres the query is too long for a URL (400 Bad Request)."""
    body = urllib.parse.urlencode({"query": query, "format": "application/sparql-results+json"}).encode()
    req = urllib.request.Request(SPARQL, data=body, headers={
        "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)["results"]["bindings"]


def iri(name: str) -> str:
    return "<" + RES + urllib.parse.quote(name, safe="()_,'-&") + ">"


def main() -> None:
    notes = [n for n in read_notes() if n["fm"].get("dbpedia")]
    given = {n["fm"]["dbpedia"]: n["fm"]["title"] for n in notes}
    values = " ".join(iri(r) for r in given)

    # follow redirects (e.g. Hip_hop -> Hip_hop_music), then check every resource exists
    names = {RES + r: t for r, t in given.items()}   # resource IRI -> note title
    moved = {}   # a page may list more than one redirect; the first one is kept
    for b in sparql(f"SELECT ?s ?t WHERE {{ VALUES ?s {{ {values} }} ?s <{ONT}wikiPageRedirects> ?t }}"):
        moved.setdefault(b["s"]["value"], b["t"]["value"])
    for s, t in moved.items():
        title = names.pop(s)
        if t in names:
            # a section of another note's page (Brostep -> Dubstep): no links of its own
            print(f"  {title}: {s[len(RES):]} is part of {names[t]}'s page, left out")
        else:
            print(f"  {title}: {s[len(RES):]} -> {t[len(RES):]}")
            names[t] = title
    time.sleep(1)
    targets = " ".join("<" + i + ">" for i in names)

    props: dict[str, dict[str, list[dict]]] = {}
    preds = " ".join(f"<{ONT}{p}>" for p, _, _ in PROPS)
    for b in sparql(f"SELECT ?s ?p ?o WHERE {{ VALUES ?s {{ {targets} }} VALUES ?p {{ {preds} }} ?s ?p ?o }}"):
        props.setdefault(names[b["s"]["value"]], {}).setdefault(b["p"]["value"], []).append(b["o"])
    for i, t in names.items():
        if t not in props:
            print(f"  {t}: no genre links on {i[len(RES):]}")
    names = {i[len(RES):]: t for i, t in names.items()}

    links: dict[str, dict[str, list[str]]] = {}

    def add(child: str, kind: str, parent: str) -> None:
        if child == parent:
            return
        lst = links.setdefault(child, {"up": [], "src": []})[kind]
        if parent not in lst:
            lst.append(parent)

    for title, p in props.items():
        for prop, child_side, kind in PROPS:
            for v in p.get(ONT + prop, []):
                other = names.get(v.get("value", "")[len(RES):])
                if not other:
                    continue
                if child_side == "self":
                    add(title, kind, other)
                else:
                    add(other, kind, title)

    # a pair linked both as up and as src keeps only up (the closer tie)
    for rel in links.values():
        rel["src"] = [x for x in rel["src"] if x not in rel["up"]]
        rel["up"].sort()
        rel["src"].sort()
    out = {"fetched": date.today().isoformat(), "source": "https://dbpedia.org/",
           "resources": {t: n["fm"]["dbpedia"] for t, n in ((n["fm"]["title"], n) for n in notes)},
           "links": dict(sorted(links.items()))}
    (OUT / "dbpedia.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    count = sum(len(v["up"]) + len(v["src"]) for v in links.values())
    print(f"{len(props)} resources read, {count} links between notes -> data/memo/dbpedia.json")


if __name__ == "__main__":
    main()

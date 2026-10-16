"""Fetch the first sentences of the Wikipedia article for each genre note (decision 0025).

A genre note names its DBpedia resource (`dbpedia = "Hardcore_techno"`), which is the
title of its English Wikipedia article. This script asks English Wikipedia for that
article's Japanese counterpart (its language link) and takes the opening sentences of
both. The roots page shows them in the box that opens when a genre is chosen.

Both articles are kept, so the box shows the one in the language the page is shown
in. An article carrying a warning about its sources as a whole (no citations, original
research, ...) is in doubt and its summary is marked "doubt" and not shown. When only one
language has a usable summary, the other shows a translation of it, kept by hand in
data/memo/summary_translations.json ({"title": {"ja": {"from": source, "text": ...}}});
the script lists the translations that are missing or whose source text has changed. The script lists
those genres, so they can be checked against other sources by hand. A warning on one
statement or one section only is kept in "part" and the text is shown.

The result goes to data/memo/summaries.json. The text is CC BY-SA (from Wikipedia), so
the box names Wikipedia as its source.

    python scripts/wiki_summaries.py

Run it by hand when genre notes are added or after a while; it is not run on a schedule.
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
BATCH = 20   # the most titles the extracts module answers for at once
# hidden categories that mark an article whose sources as a whole are in doubt
DOUBT = {
    "en": ("articles lacking sources", "articles needing additional references",
           "articles that may contain original research", "articles lacking reliable references",
           "articles lacking in-text citations"),
    "ja": ("出典を必要とする記事/", "独自研究の除去が必要な記事/", "出典皆無", "信頼性要検証"),
}
# and those that mark one statement or one section only
PART = {
    "en": ("unsourced statements", "sections needing additional references",
           "sections that may contain original research"),
    "ja": ("出典を必要とする記述", "出典を必要とする節", "独自研究の除去が必要な節", "要出典"),
}
SENTENCES = 2


def api(lang: str, **params) -> dict:
    params.update(format="json", formatversion="2")
    url = f"https://{lang}.wikipedia.org/w/api.php?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def pages(lang: str, titles: list[str], **params) -> dict[str, dict]:
    """Query titles in batches; the result is keyed by the title asked for."""
    out = {}
    for i in range(0, len(titles), BATCH):
        part = titles[i:i + BATCH]
        # a long answer comes in pieces; "continue" asks for the rest
        q, more = {}, {}
        while True:
            r = api(lang, action="query", titles="|".join(part), redirects=1, **params, **more)
            for k, v in r["query"].items():
                if k != "pages":
                    q[k] = v
                    continue
                seen = {p["title"]: p for p in q.setdefault("pages", [])}
                for p in v:
                    if p["title"] in seen:
                        for f, x in p.items():
                            if isinstance(x, list):
                                seen[p["title"]].setdefault(f, []).extend(x)
                            elif x or f not in seen[p["title"]]:
                                seen[p["title"]][f] = x
                    else:
                        q["pages"].append(p)
            if "continue" not in r:
                break
            more = r["continue"]
            time.sleep(1)
        # asked title -> final title, through normalisation and redirects (two titles may
        # end on one page: Brostep -> Dubstep)
        final = {t: t for t in part}
        for step in ("normalized", "redirects"):
            for m in q.get(step, []):
                for k, v in final.items():
                    if v == m["from"]:
                        final[k] = m["to"]
        by = {p["title"]: p for p in q.get("pages", [])}
        for asked, f in final.items():
            if f in by:
                out[asked] = by[f]
        time.sleep(1)
    return out


def warnings(lang: str, page: dict, words: dict) -> list[str]:
    cats = [c["title"].split(":", 1)[-1] for c in page.get("categories", [])]
    return [c for c in cats if any(w.lower() in c.lower() for w in words[lang])]


def main() -> None:
    notes = [n for n in read_notes() if n["fm"].get("dbpedia") and n["fm"].get("born") is not None]
    en_titles = {n["fm"]["title"]: n["fm"]["dbpedia"].replace("_", " ") for n in notes}

    # the English article, its Japanese language link and its warnings
    en = pages("en", sorted(set(en_titles.values())), prop="langlinks|categories",
               lllang="ja", lllimit="max", clshow="hidden", cllimit="max")
    # a title sent on to another note's article (Brostep -> Dubstep) has no text of its own
    mine = {e: t for t, e in en_titles.items()}
    for t, e in list(en_titles.items()):
        f = en.get(e, {}).get("title", e)
        if f != e and f in mine and mine[f] != t:
            print(f"  {t}: {e} is part of {mine[f]}'s article, left out")
            del en_titles[t]
    ja_titles = {}
    for t, e in en_titles.items():
        p = en.get(e, {})
        if p.get("langlinks"):
            ja_titles[t] = p["langlinks"][0]["title"]
    ja = pages("ja", sorted(set(ja_titles.values())), prop="categories", clshow="hidden", cllimit="max")

    # the opening sentences of both articles
    text = {}
    for lang, titles in (("ja", sorted(set(ja_titles.values()))), ("en", sorted(set(en_titles.values())))):
        got = pages(lang, titles, prop="extracts", exintro=1, explaintext=1,
                    exsentences=SENTENCES, exlimit="max")
        for t, p in got.items():
            text[(lang, t)] = " ".join((p.get("extract") or "").split())

    # the hand-made translations, for a genre with a usable summary in one language only
    tr_path = OUT / "summary_translations.json"
    tr = json.loads(tr_path.read_text(encoding="utf-8")) if tr_path.exists() else {}

    out, doubted, missing, need = {}, [], [], []
    for title in sorted(en_titles):
        item = {}
        for lang, page_title, pages_ in (("ja", ja_titles.get(title), ja), ("en", en_titles[title], en)):
            body = page_title and text.get((lang, page_title), "")
            if not body:
                continue
            page = pages_.get(page_title, {})
            one = {"title": page_title, "text": body,
                   "url": f"https://{lang}.wikipedia.org/wiki/" + urllib.parse.quote(page_title.replace(" ", "_"))}
            warn, part = warnings(lang, page, DOUBT), warnings(lang, page, PART)
            if warn:
                one["doubt"] = warn
                doubted.append(f"{title} ({lang}: {', '.join(warn)})")
            if part:
                one["part"] = part
            item[lang] = one
        ok = {l for l, v in item.items() if not v.get("doubt")}
        if not ok:
            missing.append(title)
        # one language only: the other shows a translation of it, kept by hand
        for lang, other in (("ja", "en"), ("en", "ja")):
            if lang in ok or other not in ok:
                continue
            t = tr.get(title, {}).get(lang)
            if t and t.get("from") == item[other]["text"]:
                item[lang + "_tr"] = {"text": t["text"], "url": item[other]["url"]}
            else:
                need.append(f"{title} -> {lang}" + (" (source changed)" if t else ""))
        if item:
            out[title] = item

    data = {"fetched": date.today().isoformat(), "source": "https://www.wikipedia.org/", "summaries": out}
    (OUT / "summaries.json").write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    shown = {l: sum(1 for v in out.values() if l in v and not v[l].get("doubt")) for l in ("ja", "en")}
    print(f"{len(out)} genres -> data/memo/summaries.json ({shown['ja']} ja, {shown['en']} en usable)")
    if doubted:
        print("sources in doubt (not shown; check by hand):")
        for d in doubted:
            print("  " + d)
    if missing:
        print("no usable summary: " + ", ".join(missing))
    if need:
        print("translations to write in data/memo/summary_translations.json:")
        for n in need:
            print("  " + n)


if __name__ == "__main__":
    main()

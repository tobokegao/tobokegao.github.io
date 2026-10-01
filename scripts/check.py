"""The gate: checks the site's rules (CLAUDE.md) that a machine can decide.

    python scripts/check.py              the files staged for this commit (pre-commit hook)
    python scripts/check.py --all        everything, plus a Hugo build and its links (pre-push, CI)
    python scripts/check.py --all --site public
                                         ...checking a site already built into public/ (CI)

Two kinds of result:
- NG stops the commit or push. Pass on purpose with `git commit --no-verify`.
- 知らせ only reminds: things only a person (or a browser, or Gemini) can check, shown
  when a file they depend on changed.

A CSS line may opt out of one rule with a comment holding "check-ok: <reason>".
Hooks live in .githooks/ (git config core.hooksPath .githooks). Hugo is looked up as
$HUGO, then on PATH. Pillow is optional (image sizes are skipped without it).
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import tomllib
import urllib.parse
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSS = "assets/css/site.css"
SITE_HOST = "tobokegao.github.io"

# Pictures that were on the site before the WebP rule; anything added since must be WebP.
LEGACY_IMAGES = {
    "60millionreserve.jpg", "hosotake.png", "katsushikasyussin.png", "og-icon.png", "rei8bit.png",
    "sdhizumi.png", "shiroshibins.png", "tbkgao-logo-night.png", "tbkgao-logo.png",
    "tobokegao-logo-color.png", "tobokegao-logo-night.png", "tobokegao.png", "toyohirakumin.png",
    "uminohiyake.jpg", "yagishiro.png",
}
MAX_IMAGE_SIDE = 1800
# Pages whose <em> Tobokegao has looked at and kept (English work titles; "couldn't *not*")
ITALIC_OK = {"/about/index.html", "/post/tobox-release-party/index.html"}   # flyers are 1800px on the long side; nothing on the site shows larger

# Things that are written twice and must agree (the list of "double implementations").
SAME_LINE = [
    ("ログの行の id", re.compile(r"\$id := .*?(?=\s*-?\}\})"),
     ["layouts/_partials/timeline.html", "content/news/_content.gotmpl"]),
]
SAME_LIST = [
    ("夜のアイコンとロゴの光の段階色", [("scripts/hd_icons.py", r"ramp_n = (\[[^\]]*\])"),
                               ("scripts/night_logos.py", r"RAMP = (\[[^\]]*\])")]),
]

# Built so that this file does not match itself.
SECRETS = re.compile("|".join([
    "sk" + r"-ant-[A-Za-z0-9_-]{20,}", "gh" + r"[pousr]_[A-Za-z0-9]{30,}", "github" + r"_pat_[A-Za-z0-9_]{30,}",
    "AI" + r"za[0-9A-Za-z_-]{35}", "-----BEGIN [A-Z ]*" + "PRIVATE KEY-----", "xox" + r"[abpr]-[A-Za-z0-9-]{10,}",
]))

# What to run by hand after changing a path: (pattern, reminder).
REMINDERS = [
    (r"^(content/|assets/news/|data/(timeline|strings|titles_en|designs)\.|i18n/)",
     "公開する文章が変わった。lint（natural-japanese と ai-words-ja）→ Gemini の添削を済ませたか確かめる"),
    (r"^(assets/css/|assets/js/|layouts/)",
     "見た目や動きが変わった。確認用ページ（git push preview renewal:main）をスマホの実機で確かめる"),
    (r"^(assets/css/|assets/js/|layouts/|hugo\.toml|\.github/workflows/)",
     "設計を変えたなら docs/decisions/ に記録を 1 つ足す"),
    (r"^data/(releases|items)\.json$", "リリースや動画が変わった。scripts/cover_cache.py を回してジャケットを置く"),
    (r"^icons-src/", "アイコンの元が変わった。scripts/hd_icons.py --from-grids（または pixel_icons.py）を回す"),
    (r"^scripts/banner\.py$", "ANSI のタイトルの作り方が変わった。scripts/banner.py を回す"),
    (r"^(fonts-src/|scripts/subset_fonts\.py$)", "フォントが変わった。scripts/subset_fonts.py を回し、字がにじまないか拡大して確かめる"),
    (r"^scripts/(hd_icons|night_logos)\.py$", "夜の光の段階色を変えたなら、hd_icons.py と night_logos.py の両方を回す"),
]


@dataclass
class Result:
    ng: list[str] = field(default_factory=list)
    info: list[str] = field(default_factory=list)


def git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, encoding="utf-8").stdout


def read(path: str | Path) -> str:
    return (ROOT / path).read_text("utf-8")


# ---------- CSS ----------

@dataclass
class Rule:
    selector: str
    media: list[str]
    decls: list[tuple[str, str, int]]   # (property, value, line)


def parse_css(text: str) -> tuple[list[Rule], set[int]]:
    """A small CSS reader: rules with their @media context and declaration lines.
    Also returns the lines that carry a "check-ok" comment."""
    ok_lines: set[int] = set()
    out = []
    i = 0
    while i < len(text):
        if text.startswith("/*", i):
            j = text.find("*/", i + 2)
            j = len(text) if j < 0 else j + 2
            comment = text[i:j]
            if "check-ok" in comment:
                ok_lines.add(text.count("\n", 0, i) + 1)
            out.append(re.sub(r"[^\n]", " ", comment))
            i = j
        else:
            out.append(text[i])
            i += 1
    text = "".join(out)

    rules: list[Rule] = []
    stack: list[str] = []
    start = 0
    for m in re.finditer(r"[{}]", text):
        chunk = text[start:m.start()]
        if m.group() == "{":
            # declarations before a nested block cannot happen in this file; the chunk is the prelude
            stack.append(" ".join(chunk.split()))
        else:
            prelude = stack.pop() if stack else ""
            if not prelude.startswith("@"):
                decls = []
                offset = start
                for part in chunk.split(";"):
                    if ":" in part:
                        prop, value = part.split(":", 1)
                        line = text.count("\n", 0, offset + len(part) - len(part.lstrip())) + 1
                        decls.append((prop.strip().lower(), " ".join(value.split()), line))
                    offset += len(part) + 1
                rules.append(Rule(prelude, [s for s in stack if s.startswith("@")], decls))
        start = m.end()
    return rules, ok_lines


COLOR = re.compile(r"#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?|oklch|oklab|lab|lch)\(")
NAMED = re.compile(r"\b(white|black|red|blue|yellow|green|gray|grey|orange|purple|navy|silver)\b")
COLOR_PROPS = re.compile(r"^(color|background.*|border.*|outline.*|fill|stroke|box-shadow|text-shadow|caret-color|accent-color|text-decoration.*)$")
SPACING = re.compile(r"^(margin|padding|gap|row-gap|column-gap|inset|top|right|bottom|left|outline-offset|text-indent|border(-\w+)?-width)(-\w+)*$")
DOT_SIZE = re.compile(r"^(var\(--dot\)|calc\(var\(--dot\) \* \d+\)|calc\(\d+ \* var\(--dot\)\))$")


def font_size_of(value: str) -> str | None:
    """The size in a `font:` shorthand (the token before "/" or before the family)."""
    value = re.split(r"\s(?=var\(--f-|\")", value)[0]
    value = value.split("/")[0]
    tokens = re.findall(r"\w+\((?:[^()]|\([^()]*\))*\)|\S+", value)
    return tokens[-1] if tokens else None


def check_css(r: Result) -> None:
    rules, ok = parse_css(read(CSS))
    where = lambda line: f"{CSS}:{line}"   # noqa: E731
    dots = set()
    reduced = set()      # selectors stopped under prefers-reduced-motion
    animated = []        # (selector, line) that animate outside it
    for rule in rules:
        is_root = re.fullmatch(r":root(\[[^\]]*\]|:not\([^)]*\))*", rule.selector) is not None
        in_reduced = any("prefers-reduced-motion" in m for m in rule.media)
        uses_dot = any(p in ("font", "font-family") and ("--f-dot" in v or "Dot" in v) for p, v, _ in rule.decls)
        for prop, value, line in rule.decls:
            if line in ok:
                continue
            if prop == "--dot":
                dots.add(value)
            if not is_root and not prop.startswith("--"):
                if COLOR.search(value) or (COLOR_PROPS.match(prop) and NAMED.search(value)):
                    r.ng.append(f"色の直接指定 {where(line)}: {prop}: {value}（:root の変数を通す）")
            if prop.endswith("radius") and not re.fullmatch(r"0(px)?", value):
                r.ng.append(f"角丸 {where(line)}: {prop}: {value}")
            if prop in ("box-shadow", "text-shadow") and value != "none":
                for shadow in re.split(r",(?![^(]*\))", value):
                    lengths = re.findall(r"-?[\d.]+(?:px|em|rem)?(?![\w%])", re.sub(r"var\([^)]*\)|\w+\([^)]*\)", "", shadow))
                    if len(lengths) >= 3 and float(re.sub(r"[a-z]+", "", lengths[2])) != 0:
                        r.ng.append(f"ぼかした影 {where(line)}: {prop}: {value}")
            if "gradient(" in value:
                r.ng.append(f"グラデーション {where(line)}: {value}（網点の模様なら、行に check-ok: と理由を書く）")
            if prop == "backdrop-filter" or (prop == "filter" and "blur(" in value):
                r.ng.append(f"ぼかし・ガラス風 {where(line)}: {prop}: {value}")
            if prop in ("font", "font-style") and "italic" in value:
                r.ng.append(f"斜体 {where(line)}: {prop}: {value}")
            if prop.startswith("transition"):
                r.ng.append(f"ふわっと動く切り替え {where(line)}: {prop}: {value}")
            if ":hover" in rule.selector and prop in ("transform", "translate", "scale", "box-shadow"):
                r.ng.append(f"ホバーで浮く動き {where(line)}: {rule.selector} {{ {prop}: {value} }}")
            if SPACING.match(prop):
                if re.search(r"[\d.]ch\b", value):
                    r.ng.append(f"ch 単位の余白 {where(line)}: {prop}: {value}（整数の px にする）")
                if re.search(r"\d*\.\d+px\b", value):
                    r.ng.append(f"半端な px の余白 {where(line)}: {prop}: {value}（整数の px にする）")
            if uses_dot and prop in ("font", "font-size"):
                size = font_size_of(value) if prop == "font" else value
                if size and size not in ("inherit",) and not DOT_SIZE.match(size):
                    r.ng.append(f"ドットフォントの大きさ {where(line)}: {prop}: {value}（var(--dot) かその整数倍にする）")
            if prop in ("animation", "animation-name") and not value.startswith("none"):
                if not in_reduced:
                    animated.append((rule.selector, line))
            if in_reduced and prop in ("animation", "animation-name") and value.startswith("none"):
                reduced.update(s.strip() for s in rule.selector.split(","))
    if dots - {"12px", "15px"}:
        r.ng.append(f"ドットフォントの升目 {CSS}: --dot は 12px（スマホ）と 15px（PC）だけ。今は {sorted(dots)}")
    for selector, line in animated:
        if line in ok:
            continue
        parts = [s.strip() for s in selector.split(",")]
        if not all(p in reduced for p in parts):
            r.ng.append(f"「視差効果を減らす」で止まらない動き {where(line)}: {selector}")


# ---------- layouts ----------

def check_layouts(r: Result) -> None:
    for p in sorted((ROOT / "layouts").rglob("*.html")):
        rel = p.relative_to(ROOT).as_posix()
        if re.search(r"_partials/(icons|icons-hd|icons-hd-night|banners)/", rel):
            continue   # generated pixel art draws its own colors
        for n, line in enumerate(p.read_text("utf-8").splitlines(), 1):
            for style in re.findall(r'style="([^"]*)"', line):
                if COLOR.search(style):
                    r.ng.append(f"色の直接指定 {rel}:{n}: style=\"{style}\"")
            if re.search(r"<(em|i)[\s>]", line):
                r.ng.append(f"斜体 {rel}:{n}: <em>/<i> を使っている")


# ---------- text: both languages and Markdown pitfalls ----------

def front_matter(text: str) -> tuple[str, str]:
    m = re.match(r"---\r?\n(.*?)\r?\n---\r?\n?(.*)", text, re.S)
    return (m.group(1), m.group(2)) if m else ("", text)


def check_languages(r: Result) -> None:
    news = ROOT / "assets/news"
    names = {}
    for p in news.glob("*.md"):
        m = re.match(r"(.+)\.(ja|en)\.md$", p.name)
        if m:
            names.setdefault(m.group(1), set()).add(m.group(2))
    for name, langs in sorted(names.items()):
        if langs != {"ja", "en"}:
            r.ng.append(f"片方の言語だけ assets/news/{name}: {', '.join(sorted(langs))} しかない")
    ids = set()
    for i, row in enumerate(json.loads(read("data/timeline.json"))):
        label = f"data/timeline.json の {row.get('date', '?')} の行"
        if not (row.get("ja") or "").strip() or not (row.get("en") or "").strip():
            r.ng.append(f"片方の言語だけ {label}: ja と en の両方を書く")
        if not re.fullmatch(r"\d{8}-[0-9a-f]{6}", row.get("id", "")):
            r.ng.append(f"ページの id がない {label}: 行を足したら id を付ける（日付8桁-英数字6字。文を変えてもページが動かないように）")
        elif row["id"] in ids:
            r.ng.append(f"ページの id が重なっている {label}: {row['id']}")
        ids.add(row.get("id"))
        if row.get("article") and names.get(row["article"]) != {"ja", "en"}:
            r.ng.append(f"記事がない {label}: assets/news/{row['article']}.ja.md / .en.md")
    strings = tomllib.loads(read("data/strings.toml"))
    for key, val in strings.items():
        if isinstance(val, dict) and not ({"ja", "en"} <= val.keys()):
            r.ng.append(f"片方の言語だけ data/strings.toml の [{key}]: ja と en の両方を書く")
    for p in sorted((ROOT / "content").rglob("*.md")):
        rel = p.relative_to(ROOT).as_posix()
        fm, body = front_matter(p.read_text("utf-8"))
        if re.search(r"^title:", fm, re.M) and not re.search(r"^title_en:", fm, re.M):
            r.ng.append(f"英語の題がない {rel}: title_en を書く")
        ja, en = body.count("{{< lang ja >}}"), body.count("{{< lang en >}}")
        if ja != en:
            r.ng.append(f"片方の言語だけ {rel}: lang ja が {ja} 個、lang en が {en} 個")


JA = r"぀-ヿ一-鿿"
SPACED = re.compile(rf"[A-Za-z0-9](?:\]\([^)\s]*\))?(?:\*\*)? +(?:\*\*|\[)?[{JA}]|[{JA}](?:\*\*)? +(?:\*\*|\[)?[A-Za-z0-9]")
# Titles in 「」『』, code, links' targets and tags are written as they are named
AS_NAMED = re.compile(r"「[^「」]*」|『[^『』]*』|`[^`]*`|\{\{[<%].*?[>%]\}\}|<[^>]+>|https?://\S+")


def check_spacing(r: Result, changed: list[str]) -> None:
    """Japanese text closes the space between Latin letters/digits and Japanese (decision 0019).
    Only a reminder: names (DJ さうすまうぅん), track lists and timetables keep theirs."""
    hits = []
    for rel in changed:
        if not re.search(r"^(assets/news/.*\.ja\.md|content/.*\.md)$", rel) or not (ROOT / rel).exists():
            continue
        text = read(rel)
        if rel.startswith("content/"):
            text = "\n".join(re.findall(r"\{\{< lang ja >\}\}(.*?)\{\{< /lang >\}\}", text, re.S))
        for n, line in enumerate(text.splitlines(), 1):
            if re.match(r"\s*(\d+\.\s|([-*]\s*)?\d{1,2}:\d{2}[\d:〜~／/ -]*\s)", line):   # track lists, timetables
                continue
            if SPACED.search(AS_NAMED.sub("「」", line)):
                hits.append(f"{rel}: {line.strip()[:40]}")
    if hits:
        r.info.append(f"英字・数字と日本語のあいだに半角スペースが {len(hits)} 行（名前なら、そのままでよい）: " + " / ".join(hits[:3]))


def check_markdown(r: Result) -> None:
    files = sorted((ROOT / "content").rglob("*.md")) + sorted((ROOT / "assets/news").glob("*.md"))
    for p in files:
        rel = p.relative_to(ROOT).as_posix()
        fm, body = front_matter(p.read_text("utf-8"))
        first = (fm.count("\n") + 3) if fm else 1
        fence = False
        for n, line in enumerate(body.splitlines(), first):
            if line.lstrip().startswith("```"):
                fence = not fence
            if fence:
                continue
            bare = re.sub(r"`[^`]*`", "", line)
            if re.search(r"\S　\*\*(?!\S)|\S　\*\*$", bare) or re.search(r"\*\*[^*]+　\*\*", bare):
                r.ng.append(f"太字にならない {rel}:{n}: 閉じる ** の直前に全角スペースがある（外に出す）")
            if re.match(r"# ", line):
                r.ng.append(f"本文の見出しが h1 {rel}:{n}: ## から始める")
            if re.search(r"(?<![\w`])__\w+__(?![\w`])", bare):
                r.ng.append(f"記号に化ける名前 {rel}:{n}: __…__ はバッククォートで囲む")


# ---------- data, images, doubles, secrets ----------

def check_json(r: Result) -> None:
    for p in sorted((ROOT / "data").glob("*.json")):
        try:
            json.loads(p.read_text("utf-8"))
        except ValueError as e:
            r.ng.append(f"JSON が読めない data/{p.name}: {e}")


def check_images(r: Result, added: set[str] | None) -> None:
    try:
        from PIL import Image
    except ImportError:
        Image = None
        r.info.append("Pillow がないので、画像の大きさは確かめなかった")
    base = ROOT / "static/img"
    for p in sorted(base.rglob("*")):
        rel = p.relative_to(ROOT).as_posix()
        if not p.is_file() or (added is not None and rel not in added):
            continue
        if p.suffix.lower() != ".webp" and p.name not in LEGACY_IMAGES:
            r.ng.append(f"WebP でない画像 {rel}: 表示する大きさの WebP にする")
        elif p.suffix.lower() == ".webp" and Image:
            with Image.open(p) as im:
                if max(im.size) > MAX_IMAGE_SIDE:
                    r.ng.append(f"大きすぎる画像 {rel}: {im.size[0]}x{im.size[1]}（表示する大きさにする。長い辺 {MAX_IMAGE_SIDE}px まで）")


def check_doubles(r: Result) -> None:
    for label, pattern, paths in SAME_LINE:
        found = {p: (pattern.search(read(p)) or [None])[0] for p in paths}
        if None in found.values() or len({v.strip() for v in found.values()}) != 1:
            r.ng.append(f"二重実装がずれた（{label}）: " + " / ".join(f"{p}: {v}" for p, v in found.items()))
    for label, places in SAME_LIST:
        found = {}
        for p, pattern in places:
            m = re.search(pattern, read(p))
            found[p] = re.findall(r"#[0-9a-fA-F]{6}", m.group(1).lower()) if m else None
        if len({json.dumps(v) for v in found.values()}) != 1:
            r.ng.append(f"二重実装がずれた（{label}）: " + " / ".join(f"{p}: {v}" for p, v in found.items()))


def check_covers(r: Result) -> None:
    covers = json.loads(read("data/covers.json"))
    for kind, mapping in covers.items():
        for url, local in mapping.items():
            if not (ROOT / "static" / local.lstrip("/")).exists():
                r.ng.append(f"ジャケットのファイルがない data/covers.json ({kind}): {local}")
    releases = json.loads(read("data/releases.json"))
    items = json.loads(read("data/items.json"))
    missing = [x["image"] for x in releases if x.get("image") and x["image"] not in covers.get("jackets", {})]
    missing += [x["image"] for x in items if x.get("type") == "video" and x.get("image") and x["image"] not in covers.get("thumbs", {})]
    if missing:
        r.info.append(f"サイトに置いていないジャケット・サムネイルが {len(missing)} 枚（scripts/cover_cache.py を回す。取れなかった分は元のサイトから出る）")


def check_secrets(r: Result, paths: list[str]) -> None:
    for rel in paths:
        name = Path(rel).name
        if name == ".env" or (name.startswith(".env.") and name != ".env.example") or name.endswith(".for-gemini.txt"):
            r.ng.append(f"入れてはいけないファイル {rel}")
            continue
        p = ROOT / rel
        if not p.is_file() or p.stat().st_size > 2_000_000:
            continue
        try:
            text = p.read_text("utf-8")
        except UnicodeDecodeError:
            continue
        for n, line in enumerate(text.splitlines(), 1):
            if SECRETS.search(line):
                r.ng.append(f"鍵やトークンらしき文字列 {rel}:{n}（.env か GitHub Secrets に置く）")


# ---------- the built site ----------

def find_hugo() -> str | None:
    return os.environ.get("HUGO") or shutil.which("hugo")


def check_site(r: Result, site: Path | None) -> None:
    tmp = None
    if site is None:
        hugo = find_hugo()
        if not hugo:
            r.info.append("hugo が見つからないので、組み立てとリンクの点検は CI に任せた（環境変数 HUGO で場所を教えられる）")
            return
        tmp = tempfile.mkdtemp(prefix="tbk-check-")
        site = Path(tmp)
        p = subprocess.run([hugo, "--minify", "--quiet", "-d", str(site)], cwd=ROOT, capture_output=True, text=True, encoding="utf-8")
        if p.returncode:
            tail = "\n    ".join((p.stdout + p.stderr).strip().splitlines()[-15:])
            r.ng.append(f"hugo の組み立てに失敗した:\n    {tail}")
            shutil.rmtree(tmp, ignore_errors=True)
            return
    try:
        check_built(r, site)
    finally:
        if tmp:
            shutil.rmtree(tmp, ignore_errors=True)


ATTR = re.compile(r"""\b(href|src|srcset)=(?:"([^"]*)"|'([^']*)'|([^\s>]+))""")


def check_built(r: Result, site: Path) -> None:
    if not (site / "index.html").is_file():
        r.ng.append(f"組み立てたサイトが見つからない: {site}")
        return
    broken: dict[str, list[str]] = {}
    italics = []
    bad_titles = set()

    def exists(page_url: str, link: str) -> bool:
        url = urllib.parse.urljoin("https://" + SITE_HOST + page_url, link)
        parts = urllib.parse.urlsplit(url)
        if parts.scheme not in ("http", "https") or parts.hostname != SITE_HOST:
            return True
        path = urllib.parse.unquote(parts.path)
        target = site / path.lstrip("/")
        return (target / "index.html").is_file() if path.endswith("/") else (target.is_file() or (target / "index.html").is_file())

    for p in site.rglob("*.html"):
        page_url = "/" + p.relative_to(site).as_posix()
        html = p.read_text("utf-8", errors="ignore")
        for attr, *vals in ATTR.findall(html):
            val = next((v for v in vals if v), "")
            links = [s.strip().split(" ")[0] for s in val.split(",")] if attr == "srcset" else [val]
            for link in links:
                link = link.replace("&amp;", "&")
                if not link or link.startswith(("#", "mailto:", "tel:", "data:", "javascript:")):
                    continue
                if not exists(page_url, link):
                    broken.setdefault(link, []).append(page_url)
        for title in re.findall(r"class=\"?win__title\"?[^>]*><span>([^<]*)", html):
            if not re.search(r"(\.[A-Z0-9]{2,4}|\\)$", title):
                bad_titles.add(title)
        if re.search(r"<(em|i)>", html) and page_url not in ITALIC_OK:
            italics.append(page_url)
    for p in site.rglob("*.css"):
        page_url = "/" + p.relative_to(site).as_posix()
        for link in re.findall(r"url\(\"?([^\")]+)\"?\)", p.read_text("utf-8", errors="ignore")):
            if not link.startswith("data:") and not exists(page_url, link):
                broken.setdefault(link, []).append(page_url)
    for link, pages in sorted(broken.items()):
        more = f" ほか {len(pages) - 1} ページ" if len(pages) > 1 else ""
        r.ng.append(f"行き先のないリンク {link}（{pages[0]}{more}）")
    for title in sorted(bad_titles):
        r.ng.append(f"窓のタイトルに拡張子がない: {title}")
    if italics:
        r.info.append(f"斜体（<em>）のあるページが {len(italics)} つ: {', '.join(sorted(italics)[:5])}。作品名の慣習ならよいが、強調のための斜体なら外す")


# ---------- main ----------

def main() -> int:
    ap = argparse.ArgumentParser(description="Check the site's rules.")
    ap.add_argument("--all", action="store_true", help="check everything and build the site")
    ap.add_argument("--site", type=Path, help="with --all: check this built site instead of building one")
    args = ap.parse_args()

    if args.all:
        changed = None
        added = None
        tracked = git("ls-files").splitlines()
    else:
        changed = git("diff", "--cached", "--name-only", "--diff-filter=ACMR").splitlines()
        added = set(git("diff", "--cached", "--name-only", "--diff-filter=A").splitlines())
        tracked = changed
        if not changed:
            print("check: 点検するファイルなし")
            return 0

    def touched(pattern: str) -> bool:
        return changed is None or any(re.search(pattern, c) for c in changed)

    jobs = []
    if touched(r"^assets/css/"):
        jobs.append(("CSS", check_css))
    if touched(r"^layouts/"):
        jobs.append(("レイアウト", check_layouts))
    if touched(r"^(assets/news/|content/|data/(timeline\.json|strings\.toml))"):
        jobs.append(("両方の言語", check_languages))
    if touched(r"^(assets/news/|content/).*\.md$"):
        jobs.append(("Markdown", check_markdown))
        if changed is not None:
            jobs.append(("スペース", lambda r: check_spacing(r, changed)))
    if touched(r"^data/.*\.json$"):
        jobs.append(("JSON", check_json))
    if touched(r"^static/img/"):
        jobs.append(("画像", lambda r: check_images(r, added)))
    doubles = [p for _, _, ps in SAME_LINE for p in ps] + [p for _, ps in SAME_LIST for p, _ in ps]
    if changed is None or set(changed) & set(doubles):
        jobs.append(("二重実装", check_doubles))
    if touched(r"^(data/(covers|releases|items)\.json|static/img/covers/)"):
        jobs.append(("ジャケット", check_covers))
    jobs.append(("鍵", lambda r: check_secrets(r, tracked)))
    if args.all:
        jobs.append(("組み立てとリンク", lambda r: check_site(r, args.site)))

    def run(job):
        name, fn = job
        r = Result()
        try:
            fn(r)
        except Exception as e:   # a broken check must not pass silently
            r.ng.append(f"点検そのものが落ちた: {type(e).__name__}: {e}")
        return name, r

    with ThreadPoolExecutor() as pool:
        results = list(pool.map(run, jobs))

    infos = []
    if changed is not None:
        infos += [msg for pat, msg in REMINDERS if any(re.search(pat, c) for c in changed)]
    ng = 0
    for name, r in results:
        for msg in r.ng:
            print(f"NG    [{name}] {msg}")
            ng += 1
        infos += r.info
    for msg in infos:
        print(f"知らせ {msg}")
    scope = "全部" if changed is None else f"変えたファイル {len(changed)} 個"
    print(f"check: {scope}、点検 {len(jobs)} 種類 → NG {ng} 件、知らせ {len(infos)} 件")
    if ng:
        print("  わざと通すときは --no-verify を付ける")
    return 1 if ng else 0


if __name__ == "__main__":
    sys.exit(main())

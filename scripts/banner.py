"""The ANSI-art banners: "TOBOKEGAO" at the top of README.TXT and the page titles.

    python scripts/banner.py      # -> layouts/_partials/banner.html, banner-mini.html,
                                  #    banners/<section>.html

Drawn with CP437 block characters, as in DOS-era BBS screens and .NFO files. Letters are
5 rows of full blocks, 4 columns wide (W is 5); lit from below like the rest of the site,
a row of light-shade shadow sits on top of the letters. The characters are rendered by the
tiny "TBK Blocks" font from scripts/subset_fonts.py so the grid stays exactly monospaced.

banner-mini.html is the same art as a small SVG for the menu bar logo on the other pages:
each character cell is 2 x 4 pixels (the 1:2 shape of a text-mode cell), 88 x 24 in all,
the rows colored by CSS (.bm0-.bm4, lit from below like the rest of the site) and the
light-shade shadow drawn as a sparse dot screen (.bms).

banners/<section>.html are the page titles (RELEASES, VIDEOS, ...) in the same style,
set smaller by the .ansi--title class.
"""

from pathlib import Path

PARTIALS = Path(__file__).resolve().parent.parent / "layouts" / "_partials"
OUT = PARTIALS / "banner.html"
MINI = PARTIALS / "banner-mini.html"
TITLES = PARTIALS / "banners"
CW, CH = 2, 4          # mini cell size in pixels

FONT = {
    "A": [" ## ", "#  #", "####", "#  #", "#  #"],
    "B": ["### ", "#  #", "### ", "#  #", "### "],
    "D": ["### ", "#  #", "#  #", "#  #", "### "],
    "E": ["####", "#   ", "### ", "#   ", "####"],
    "G": [" ###", "#   ", "# ##", "#  #", " ###"],
    "I": ["####", " ## ", " ## ", " ## ", "####"],
    "K": ["#  #", "# # ", "##  ", "# # ", "#  #"],
    "L": ["#   ", "#   ", "#   ", "#   ", "####"],
    "N": ["#  #", "## #", "# ##", "#  #", "#  #"],
    "O": [" ## ", "#  #", "#  #", "#  #", " ## "],
    "P": ["### ", "#  #", "### ", "#   ", "#   "],
    "R": ["### ", "#  #", "### ", "# # ", "#  #"],
    "S": [" ###", "#   ", " ## ", "   #", "### "],
    "T": ["####", " ## ", " ## ", " ## ", " ## "],
    "U": ["#  #", "#  #", "#  #", "#  #", " ## "],
    "V": ["#  #", "#  #", "#  #", " ## ", " ## "],
    "W": ["#   #", "#   #", "# # #", "## ##", "#   #"],
}
WORD = "TOBOKEGAO"
# page titles: section -> word (the words of the menu bar)
TITLE_WORDS = {"releases": "RELEASES", "videos": "VIDEOS", "designs": "DESIGNS",
               "news": "NEWS", "post": "POSTS"}


def grid_of(word):
    rows = [" ".join(FONT[c][r] for c in word) for r in range(5)]
    return [" " * len(rows[0])] + rows            # one empty row on top for the shadow


def ansi(word, label, cls="ansi"):
    grid = grid_of(word)
    out = []
    for y, row in enumerate(grid):
        line = ""
        for x, ch in enumerate(row):
            if ch == "#":
                line += "█"                  # full block
            elif y == 0 and grid[1][x] == "#":
                line += "░"                  # light shade: the shadow cast upward
            else:
                line += " "
        out.append(f'<span class="ansi__row">{line}</span>')
    # rows are block spans, so no newlines between them (inside <pre> they would add blank lines)
    return f'<pre class="{cls}" role="img" aria-label="{label}">' + "".join(out) + "</pre>\n"


def main():
    OUT.write_text(ansi(WORD, "Tobokegao"), "utf-8")
    TITLES.mkdir(exist_ok=True)
    for key, word in TITLE_WORDS.items():
        (TITLES / f"{key}.html").write_text(ansi(word, word.title(), "ansi ansi--title"), "utf-8")

    # the mini logo: one path per row color, plus the shadow dots
    grid = grid_of(WORD)
    paths = {}
    for y, row in enumerate(grid):
        for x, ch in enumerate(row):
            if ch == "#":
                paths.setdefault(f"bm{y - 1}", []).append(f"M{x * CW} {y * CH}h{CW}v{CH}h-{CW}z")
            elif y == 0 and grid[1][x] == "#":
                # light shade: one dot in four, like the ░ glyph
                for dy in (0, 2):
                    paths.setdefault("bms", []).append(f"M{x * CW + (dy // 2)} {dy}h1v1h-1z")
    w, h = len(grid[0]) * CW, len(grid) * CH
    body = "".join(f'<path class="{c}" d="{"".join(d)}"/>' for c, d in paths.items())
    MINI.write_text(f'<svg class="bmini" viewBox="0 0 {w} {h}" width="{w}" height="{h}" aria-hidden="true" '
                    f'focusable="false" shape-rendering="crispEdges">{body}</svg>\n', "utf-8")
    for word in [WORD, *TITLE_WORDS.values()]:
        print("\n".join(r.replace("#", "█") for r in grid_of(word)[1:]), end="\n\n")


if __name__ == "__main__":
    main()

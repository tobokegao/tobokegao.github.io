// Read post ids off the X profile, for scripts/x_browse.py (decision 0029). Run in the
// profile's tab (Claude in Chrome's javascript tool), once per tab:
//   https://x.com/to6okegao            own posts
//   https://x.com/to6okegao/with_replies  own replies
//   https://x.com/to6okegao/reposts    reposts (the reposted posts' ids, newest first)
// Paste this file, then: await __xc.run(KNOWN, 40000) with KNOWN = the ids already listed
// (python scripts/x_daily.py known prints them). It scrolls until it meets 5 known posts in
// a row, or the time is up; run it again to go on. Then __xc.chunk(0), __xc.chunk(1), ...
// give the new ids 45 at a time (a tool answer longer than about 1000 letters is cut).
// Only ids leave the page: text often holds links whose query strings the tool refuses.
window.__xc = window.__xc || (() => {
  const HANDLE = "to6okegao";
  const seen = new Set(), found = [];
  let knownRun = 0, done = false;
  const reposts = () => location.pathname.endsWith("/reposts");
  function harvest(known) {
    document.querySelectorAll('article[data-testid="tweet"]').forEach((a) => {
      const ctx = (a.querySelector('[data-testid="socialContext"]') || {}).innerText || "";
      if (/固定|Pinned/.test(ctx)) return;
      const link = [...a.querySelectorAll('a[href*="/status/"]')].find((l) => l.querySelector("time"));
      const m = link && link.getAttribute("href").match(/^\/(\w+)\/status\/(\d+)/);
      if (!m || seen.has(m[2])) return;
      seen.add(m[2]);
      // the replies tab also shows the posts being replied to: only one's own count there
      if (!reposts() && m[1].toLowerCase() !== HANDLE) return;
      if (known.has(m[2])) { knownRun++; if (knownRun >= 5) done = true; return; }
      knownRun = 0;
      found.push(m[2]);
    });
  }
  async function run(knownIds, ms) {
    const known = new Set(knownIds), t0 = Date.now();
    let stuck = 0, last = -1;
    harvest(known);
    while (!done && Date.now() - t0 < ms) {
      scrollBy(0, 450);   // less than a screen, so no post is skipped
      await new Promise((r) => setTimeout(r, 600));
      harvest(known);
      if (scrollY === last) { if (++stuck > 10) break; } else { stuck = 0; last = scrollY; }
    }
    return { done, found: found.length, chunks: Math.ceil(found.length / 45) };
  }
  return { run, chunk: (i) => found.slice(i * 45, i * 45 + 45).join(" "), reset: () => { seen.clear(); found.length = 0; knownRun = 0; done = false; } };
})();

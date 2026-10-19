// NOTES: the search box (Pagefind, built after Hugo) and the timeline. Loaded by site.js
// on the pages that have [data-notes-js]; init() runs again after every page change.
(function () {
  "use strict";
  var root = document.documentElement;
  // Links in the timeline data start at "/" (relativeURLs leaves JSON alone), so they are
  // put under the site's top, found from where this script sits (<top>/js/), as in site.js.
  var me = document.currentScript;
  var siteTop = me && me.src ? me.src.replace(/js\/[^\/]*$/, "") : "/";
  var sitePath = function (p) { return p && p.charAt(0) === "/" ? siteTop + p.slice(1) : p; };
  var en = function () { return root.dataset.lang === "en"; };
  var esc = function (s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  };

  // ---------- search ----------
  var pagefind = null;
  function loadPagefind(base) {
    if (!pagefind) {
      pagefind = import(base + "pagefind.js").then(function (pf) {
        // the index is at <site>/memo/pagefind/ and its links start at the site's root
        // (the preview lives under /tbk-preview/)
        return pf.options({ baseUrl: base.replace(/memo\/pagefind\/$/, "") }).then(function () { return pf; });
      });
      pagefind.catch(function () { pagefind = null; });
    }
    return pagefind;
  }

  // Search words as on X: from:name (reposts from that account; from: oneself is one's own
  // posts), to:name (replies to it), since:2025-01-01, until:2025-12-31, filter:media,
  // filter:retweets, filter:replies, and the same with "-" to leave those out. The rest goes
  // to Pagefind. Decision 0031.
  function parseQuery(q) {
    var o = { words: [], from: "", to: "", since: "", until: "", media: 0, kinds: null, notKinds: {} };
    q.split(/\s+/).forEach(function (w) {
      var m = w.match(/^(-?)(from|to|since|until|filter):(.+)$/i);
      if (!m) { if (w) o.words.push(w); return; }
      var not = m[1] === "-", key = m[2].toLowerCase(), v = m[3].replace(/^@/, "");
      if (key === "from" || key === "to") o[key] = v.toLowerCase();
      else if (key === "since" || key === "until") o[key] = v.replace(/\//g, "-");
      else {
        var kind = { media: "media", images: "media", videos: "media", retweets: "rt", nativeretweets: "rt", replies: "reply" }[v.toLowerCase()];
        if (kind === "media") o.media = not ? -1 : 1;
        else if (kind && not) o.notKinds[kind] = 1;
        else if (kind) (o.kinds = o.kinds || {})[kind] = 1;
      }
    });
    return o;
  }
  var dayOf = function (s) { var m = s.match(/(\d{4})[.\-](\d{2})[.\-](\d{2})/); return m ? m[1] + "-" + m[2] + "-" + m[3] : ""; };
  // since: is the first day kept, until: the first day left out (as on X)
  var inRange = function (o, day) { return (!o.since || day >= o.since) && (!o.until || day < o.until); };
  // the day (in Japan) an X id was made: ids carry their time (ms since 2010-11-04, << 22)
  var dayOfId = function (id) { return new Date(Number(BigInt(id) >> 22n) + 1288834974657 + 9 * 3600e3).toISOString().slice(0, 10); };

  // the account index (scripts/memo_query_index.py): 256 files by a hash of the name
  var bucket = function (name) {
    var h = 0x811c9dc5;
    for (var i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 0x01000193) >>> 0;
    return ("0" + (h & 255).toString(16)).slice(-2);
  };
  var shards = {};
  function accountPosts(memoTop, key, name) {
    var b = bucket(name);
    shards[b] = shards[b] || fetch(memoTop + "q/" + b + ".json").then(function (r) { if (!r.ok) throw r; return r.json(); });
    return shards[b].then(function (d) {
      var list = [];
      (d[key][name] || "").split(";").forEach(function (part) {
        var mi = part.indexOf(":");
        if (mi < 0) return;
        var month = part.slice(0, mi);
        part.slice(mi + 1).split(",").forEach(function (x) {
          list.push({ month: month, id: x.replace("*", ""), media: x.slice(-1) === "*", kind: key === "f" ? "rt" : "reply" });
        });
      });
      return list;
    });
  }
  // a post found in the account index is shown as it is on its month page (fetched once a month)
  var monthPages = {};
  function loadPost(memoTop, p) {
    var url = memoTop + (p.kind === "rt" ? "rt/" : "") + p.month + "/";
    monthPages[url] = monthPages[url] || fetch(url).then(function (r) { return r.text(); }).then(function (html) {
      return new DOMParser().parseFromString(html, "text/html");
    });
    return monthPages[url].then(function (doc) {
      var h = doc.getElementById("p" + p.id);
      var a = h && h.closest("article");
      if (!a) return "";
      // links on the fetched page are relative to it
      a.querySelectorAll("a[href], img[src]").forEach(function (el) {
        var attr = el.hasAttribute("href") ? "href" : "src";
        el.setAttribute(attr, new URL(el.getAttribute(attr), url).href);
      });
      return a.outerHTML;
    });
  }

  function initSearch(box) {
    var input = box.querySelector("input");
    var count = document.getElementById("notes-count");
    var list = document.getElementById("notes-results");
    var empty = document.getElementById("notes-empty");
    var memoTop = new URL(box.dataset.pagefind.replace(/pagefind\/$/, ""), location.href).href;
    var me = (box.dataset.handle || "").toLowerCase();
    var asked = 0, timer = 0;
    var say = function (ja, enText) { count.textContent = en() ? enText : ja; };
    var showPosts = function (posts, id) {
      var shown = 0;
      var more = function () {
        var next = posts.slice(shown, shown + 20);
        shown += next.length;
        Promise.all(next.map(function (p) { return loadPost(memoTop, p); })).then(function (html) {
          if (id !== asked) return;
          var old = list.querySelector(".notes__more");
          if (old) old.remove();
          list.insertAdjacentHTML("beforeend", html.map(function (h) { return '<li class="notes__hit">' + h + "</li>"; }).join(""));
          if (shown < posts.length) {
            list.insertAdjacentHTML("beforeend", '<li class="notes__more"><button type="button" class="btn">' + (en() ? "Load more" : "続きを読み込む") + "</button></li>");
            list.querySelector(".notes__more button").addEventListener("click", more);
          }
        });
      };
      more();
    };
    var run = function () {
      var q = input.value.trim();
      var id = ++asked;
      clearTimeout(timer);
      list.innerHTML = ""; empty.hidden = true;
      if (!q) { count.textContent = ""; return; }
      var o = parseQuery(q);
      var kindOk = function (k) { return (!o.kinds || o.kinds[k]) && !o.notKinds[k]; };
      // from: / to: another account without words: the account index
      if (!o.words.length && ((o.from && o.from !== me) || o.to)) {
        timer = setTimeout(function () {
          accountPosts(memoTop, o.to ? "t" : "f", o.to || o.from).then(function (posts) {
            if (id !== asked) return;
            posts = posts.filter(function (p) {
              return inRange(o, dayOfId(p.id)) && (o.media === 0 || (o.media > 0) === p.media) && kindOk(p.kind);
            });
            say(posts.length + " 件", posts.length + " posts");
            empty.hidden = posts.length !== 0;
            showPosts(posts, id);
          }).catch(function () { say("ここでは検索を使えません", "Search is not available here"); });
        }, 250);
        return;
      }
      if (!o.words.length) {
        say("言葉か、from:・to:を入れてください（since:などは、それと一緒に使えます）",
          "Add a word, or from: / to: (since: and the rest work with them)");
        return;
      }
      var filtered = o.from || o.to || o.since || o.until || o.kinds || Object.keys(o.notKinds).length;
      timer = setTimeout(function () {
        loadPagefind(box.dataset.pagefind).then(function (pf) {
          return pf.search(o.words.join(" "));
        }).then(function (found) {
          if (!found || id !== asked) return null;
          return Promise.all(found.results.slice(0, filtered ? 60 : 20).map(function (r) { return r.data(); }));
        }).then(function (pages) {
          if (!pages || id !== asked) return;
          var keep = function (s) {
            // the sub-result's title is the post's date line: "2025.01.02 03:04 RT @name" etc.
            var rt = s.title.match(/RT @(\w+)/), to = !rt && s.title.match(/@(\w+)/);
            var kind = rt ? "rt" : to ? "reply" : "own";
            var from = rt ? rt[1].toLowerCase() : me;
            return inRange(o, dayOf(s.title)) && kindOk(kind) &&
              (!o.from || o.from === from) && (!o.to || (to && to[1].toLowerCase() === o.to));
          };
          var shown = 0;
          list.innerHTML = pages.map(function (p) {
            // the page's own title (#page-t) is already the result's heading
            var subs = (p.sub_results || []).filter(function (s) { return !/#page-t$/.test(s.url); });
            if (filtered) subs = subs.filter(function (s) { return dayOf(s.title) && keep(s); });
            if (filtered && !subs.length) return "";
            shown++;
            return '<li class="notes__hit"><a class="notes__hit-t" href="' + esc(p.url) + '">' + esc(p.meta.title) + "</a>" +
              (subs.length ? subs.slice(0, filtered ? 20 : 4).map(function (s) {
                // Pagefind marks the hits with <mark> in an excerpt it has already escaped;
                // the excerpt starts with the post's date line, which is the link already
                var text = s.excerpt.indexOf(s.title) === 0 ? s.excerpt.slice(s.title.length).replace(/^\.\s*/, "") : s.excerpt;
                return '<p class="notes__hit-s"><a href="' + esc(s.url) + '">' + esc(s.title) + "</a> " + text + "</p>";
              }).join("") : '<p class="notes__hit-s">' + p.excerpt + "</p>") + "</li>";
          }).join("");
          say(shown + " ページ" + (o.media ? "（絵の有無は、from:かto:と一緒のときだけ絞れます）" : ""),
            shown + " pages" + (o.media ? " (pictures can be told apart only with from: or to:)" : ""));
          empty.hidden = shown !== 0;
        }).catch(function () {
          // no index: `hugo server` alone does not run Pagefind
          say("ここでは検索を使えません", "Search is not available here");
        });
      }, 250);
    };
    input.addEventListener("input", run);
  }

  // ---------- timeline ----------
  // When a genre was born: a year, or a part of a decade when only that is known (`era` in
  // the note: x the decade, x2 early, x3 the middle, x4 late; the year it is drawn at is the
  // decade + 0, 2, 5 or 7).
  var ERA = {
    ja: { x: "", x2: "前半", x3: "半ば", x4: "後半" },
    en: { x: "the {}s", x2: "the early {}s", x3: "the mid-{}s", x4: "the late {}s" }
  };
  var when = function (n, l) {
    if (!n.e || !ERA.ja.hasOwnProperty(n.e)) return l === "ja" ? n.y + "年" : String(n.y);
    var d = Math.floor(n.y / 10) * 10;
    return l === "ja" ? d + "年代" + ERA.ja[n.e] : ERA.en[n.e].replace("{}", d);
  };
  var born = function (n) { return "born in " + when(n, "en"); };
  // Pages with a year, left to right; solid lines from parent to child, dashed from roots
  // to what they influenced. Nodes are links (HTML), the lines an SVG behind them.
  function initTimeline(el) {
    var all = JSON.parse(document.getElementById("tl-data").textContent);
    // A page in a large genre takes its colour (in more than one: the newest of them, which
    // is the nearer family as a rule); the large genre itself has its own.
    var majorOf = {};
    all.forEach(function (n) { if (n.c) majorOf[n.k] = n; });
    all.forEach(function (n) {
      var best = null;
      (n.mj || []).forEach(function (k) { var m = majorOf[k]; if (m && (!best || m.y > best.y)) best = m; });
      n.g = n.c || (best ? best.c : 0);
    });
    var buttons = document.querySelectorAll("[data-tl]");
    var mode = "born";
    var PAD = 24, GAP = 24, FLAG = 0, GAP_YEARS = 40, BREAK = 48, TURN = 20, DENSE = 3;
    // Across: px a year; two fingers apart sideways (or Ctrl + wheel) change it, `want` keeps
    // the fraction between steps.
    var scale = 3, want = 3, MIN = 2, MAX = 24;
    // Down: the nodes drop lines instead of shrinking the dot font (lod 2 = name, year and
    // posts; 1 = name and year; 0 = name only), and the gap between rows narrows with them.
    // Two fingers apart up and down (or Ctrl + Shift + wheel) change it.
    var lod = 0;
    // a row's height: a node of lod + 1 lines (dot + 6 px each, 8 px of padding and border)
    // and the gap under it
    var rowH = function (l) {
      var dot = parseInt(getComputedStyle(root).getPropertyValue("--dot"), 10) || 12;
      return (l + 1) * (dot + 6) + 8 + [8, 16, 24][l];
    };

    var sbar = 0;   // the panel's sideways scrollbar, gone while the drawing is cleared
    var draw = function (keep) {
      if (el.firstChild) {
        var cs = getComputedStyle(el);
        sbar = Math.max(0, el.offsetHeight - el.clientHeight - parseInt(cs.borderTopWidth, 10) - parseInt(cs.borderBottomWidth, 10));
      }
      var VGAP = [8, 16, 24][lod];
      var nodes = all.filter(function (n) { return mode === "all" || n.b; });
      nodes.sort(function (a, b) { return a.y - b.y || a.t.localeCompare(b.t); });
      el.innerHTML = "";
      if (!nodes.length) return;
      // The axis in stretches: years more than GAP_YEARS apart are drawn closer, with a
      // break between (the genres reach back to the year 0, the posts start in 2014).
      var years = nodes.map(function (n) { return n.y; }).filter(function (y, i, a) { return a.indexOf(y) === i; }).sort(function (a, b) { return a - b; });
      var segs = [], from = years[0];
      years.forEach(function (y, i) {
        if (i && y - years[i - 1] > GAP_YEARS) { segs.push([from, years[i - 1]]); from = y; }
      });
      segs.push([from, years[years.length - 1]]);
      // Within a stretch, each decade is as wide as its pages need: scale px a year, plus
      // DENSE x scale px for each page in it, so busy decades get room and quiet ones stay short.
      var perDecade = {};
      nodes.forEach(function (n) { var d = Math.floor(n.y / 10) * 10; perDecade[d] = (perDecade[d] || 0) + 1; });
      var left = PAD;
      segs = segs.map(function (g) {
        var a = Math.floor(g[0] / 10) * 10 - 10, b = Math.floor(g[1] / 10) * 10 + 10;
        var seg = { a: a, b: b, x: left, decs: [] };
        for (var d = a; d < b; d += 10) {
          var w = scale * 10 + DENSE * scale * (perDecade[d] || 0);
          seg.decs.push({ d: d, x: left, w: w });
          left += w;
        }
        left += BREAK;
        return seg;
      });
      var X = function (y) {
        var g = segs.filter(function (s) { return y >= s.a; }).pop() || segs[0];
        if (y >= g.b) { var z = g.decs[g.decs.length - 1]; return z.x + z.w; }
        var dec = g.decs[Math.max(0, Math.floor((y - g.a) / 10))];
        return Math.round(dec.x + (y - dec.d) * dec.w / 10);
      };
      var maxX = left - BREAK;

      var canvas = document.createElement("div");
      canvas.className = "tl__canvas";
      el.appendChild(canvas);
      var byKey = {};
      nodes.forEach(function (n) {
        var a = document.createElement("a");
        a.className = "tl__node" + (n.b ? "" : " tl__node--posts") + (n.g ? (n.c ? " tl__node--major" : " tl__node--member") + " tl__grp--" + n.g : "") + (n.d ? " tl__node--draft" : "");
        a.href = sitePath(n.u);
        var posts = lod > 1 && n.n;
        a.innerHTML = '<span class="tl__name">' + esc(n.t) + "</span>" + (lod ? '<span class="tl__year">' +
          // a genre's year is when it was born; a topic without one shows its first post's year.
          // The year and the count take a line each: narrow nodes need fewer rows.
          '<span data-l="ja">' + (n.b ? when(n, "ja") + "生まれ" : n.y + "年から") + (posts ? "<br>ポスト" + n.n + "件" : "") + "</span>" +
          '<span data-l="en">' + (n.b ? born(n) : "since " + n.y) + (posts ? "<br>" + n.n + (n.n === 1 ? " post" : " posts") : "") + "</span></span>" : "");
        canvas.appendChild(a);
        byKey[n.k] = { n: n, el: a };
      });

      // Large genres: a line down from their own year, with the name on top (not from their
      // earliest member: New Orleans Jazz is dated before Jazz, and the flag stood apart from
      // the Jazz node)
      var majors = nodes.filter(function (n) { return n.c; });
      var flags = majors.map(function (m) { return { m: m, x: X(m.y) }; });
      var dot = parseInt(getComputedStyle(root).getPropertyValue("--dot"), 10) || 12;
      var row = dot * 2;
      // the names on top share a row when they do not run into each other (the widest of the
      // two languages' names). Each is a flag on the line, its right end cut in a swallowtail
      // of 2 px steps, so it does not read as one more genre's box; pressing it opens the large
      // genre's box as its node would.
      var flagEnd = [];
      flags.sort(function (a, b) { return a.x - b.x; }).forEach(function (f) {
        var t = document.createElement("button");
        t.type = "button";
        t.className = "tl__flag-t tl__grp--" + f.m.c;
        t.textContent = f.m.t;
        canvas.appendChild(t);
        var half = Math.floor(t.offsetHeight / 2);
        t.style.paddingRight = (half + 6) + "px";
        var w = t.offsetWidth, h = t.offsetHeight, pts = ["0 0"], cx = w, y;
        for (y = 0; y < half; y += 2) { pts.push(cx + "px " + y + "px", cx + "px " + Math.min(y + 2, half) + "px"); cx -= 2; }
        for (y = h - half; y < h; y += 2) { cx += 2; pts.push(cx + "px " + y + "px", cx + "px " + Math.min(y + 2, h) + "px"); }
        pts.push("0 " + h + "px");
        t.style.clipPath = "polygon(" + pts.join(",") + ")";
        t.addEventListener("click", function (e) { e.stopPropagation(); choose(f.m.k, true); });
        f.el = t;
        var r = flagEnd.findIndex(function (end) { return end + 8 <= f.x; });
        if (r < 0) { r = flagEnd.length; flagEnd.push(0); }
        flagEnd[r] = f.x + t.offsetWidth;
        f.r = r;
      });
      FLAG = flagEnd.length ? flagEnd.length * row + GAP : 0;
      var TOP = row + GAP + FLAG;

      // Widths in both languages (the labels differ), so a switch does not make nodes overlap.
      var h = 0, lang = root.dataset.lang;
      ["ja", "en"].forEach(function (l) {
        root.dataset.lang = l;
        nodes.forEach(function (n) {
          var it = byKey[n.k];
          it.w = Math.max(it.w || 0, it.el.offsetWidth);
          h = Math.max(h, it.el.offsetHeight);
        });
      });
      root.dataset.lang = lang;

      // Lanes: each node takes the free row nearest the rows of the pages it is linked to
      // (the barycentre step of layered graph drawing), so parents and children sit close
      // and fewer lines cross. The first pass knows only the pages placed before; the later
      // passes also use where the rest landed last time.
      var links = {};
      nodes.forEach(function (n) { links[n.k] = []; });
      nodes.forEach(function (n) {
        (n.up || []).concat(n.src || []).forEach(function (p) {
          if (byKey[p] && p !== n.k) { links[n.k].push(p); links[p].push(n.k); }
        });
      });
      // As many rows as the panel shows: past that, a node that finds no free row is set a
      // little right of its year in the row that frees up first, rather than opening a row
      // (genres born in the same year stacked up and made the drawing tall). It moves at
      // most three years' width, so its place still reads as its year.
      var cap = Math.max(1, Math.floor((el.clientHeight - sbar - TOP - PAD) / (h + VGAP)));
      var lanes;
      for (var pass = 0; pass < 3; pass++) {
        lanes = [];
        nodes.forEach(function (n) { byKey[n.k].now = false; });
        nodes.forEach(function (n) {
          var it = byKey[n.k], x = X(n.y), sum = 0, cnt = 0;
          links[n.k].forEach(function (k) {
            var o = byKey[k];
            if (o.now || pass) { sum += o.l; cnt++; }
          });
          // a new row only when none is free: the rows stay as few as the overlaps need
          var t = cnt ? sum / cnt : 0, best = lanes.length;
          for (var l = 0; l < lanes.length; l++) {
            if (lanes[l] + GAP >= x) continue;
            if (best === lanes.length || Math.abs(l - t) < Math.abs(best - t)) best = l;
          }
          if (best === lanes.length && lanes.length >= cap) {
            var e = 0;
            for (var f = 1; f < lanes.length; f++) if (lanes[f] < lanes[e]) e = f;
            var nx = lanes[e] + GAP + 1, reach = Math.max(4 * dot, 3 * (X(n.y + 1) - X(n.y)));
            if (nx - x <= reach) { x = nx; best = e; }
          }
          lanes[best] = x + it.w;
          it.x = x; it.l = best; it.now = true;
        });
      }
      var LH = h + VGAP;
      var W = Math.max(maxX + PAD, Math.max.apply(null, lanes) + PAD);
      var H = TOP + lanes.length * LH + PAD;
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      Object.keys(byKey).forEach(function (k) {
        var it = byKey[k];
        it.y = TOP + it.l * LH;
        it.el.style.width = it.w + "px";
        it.el.style.left = it.x + "px";
        it.el.style.top = it.y + "px";
      });

      var svg = '<svg class="tl__svg" width="' + W + '" height="' + H + '" aria-hidden="true"><defs>' +
        '<marker id="tl-mu" markerUnits="userSpaceOnUse" viewBox="0 0 8 14" refX="8" refY="7" markerWidth="8" markerHeight="14" orient="auto"><path class="tl__arrow--up" d="M0 0h2v2h2v2h2v2h2v2h-2v2h-2v2h-2v2h-2z"/></marker>' +
        '<marker id="tl-ms" markerUnits="userSpaceOnUse" viewBox="0 0 8 14" refX="8" refY="7" markerWidth="8" markerHeight="14" orient="auto"><path class="tl__arrow--src" d="M0 0h2v2h2v2h2v2h2v2h-2v2h-2v2h-2v2h-2z"/></marker></defs>';
      // a line at each decade, and at its middle when the decade is wide enough to label it;
      // zoomed out, a year without room after the last one keeps its line but not its number
      var said = -1e9, stop = 1e9, LABEL = 5 * Math.round(dot * 2 / 3);
      // the year labels go in a strip that stays at the top of the panel when it scrolls down
      var axis = "";
      var tick = function (y) {
        var x = X(y);
        svg += '<line class="tl__grid" x1="' + x + '" x2="' + x + '" y1="' + row + '" y2="' + H + '"/>';
        if (x < said + LABEL || x + LABEL > stop) return;
        said = x;
        axis += '<span class="tl__tick" style="left:' + (x + 4) + 'px">' + y + "</span>";
      };
      segs.forEach(function (g, i) {
        if (i) {
          var bx = g.x - BREAK + 12;
          axis += '<span class="tl__tick" style="left:' + bx + 'px">≈</span>';
          said = bx + dot - LABEL;
        }
        // and none runs into the next break mark
        stop = i + 1 < segs.length ? segs[i + 1].x - BREAK + 12 : 1e9;
        g.decs.forEach(function (dec) {
          tick(dec.d);
          if (dec.w >= 128) tick(dec.d + 5);
        });
      });
      flags.forEach(function (f) {
        var y = row + GAP + f.r * row;
        svg += '<line class="tl__flag tl__grp--' + f.m.c + '" x1="' + (f.x + 1) + '" x2="' + (f.x + 1) + '" y1="' + y + '" y2="' + H + '"/>';
        f.el.style.left = f.x + "px";
        f.el.style.top = y + "px";
      });
      // Lines in right angles only, like box-drawing characters: out to the right, along
      // the gap TURN px before the child (so a straight run is left before the arrow), then
      // in. Lines into different children (or of the other kind) that would turn at the
      // same x are moved 4 px apart, so they do not run on top of each other. When the child starts left of the parent's end, the line runs back along the
      // gap above (or below) the child's row. Roots -> influenced is drawn twice: a solid
      // line with yellow dots on it, the site's yellow light.
      var chans = {};
      var edge = function (kind, from, to) {
        var A = byKey[from], B = byKey[to];
        if (!A || !B) return "";
        var mid = Math.round(h / 2), half = Math.round(GAP / 2), vhalf = Math.round(VGAP / 2);
        var sx = A.x + A.w, sy = A.y + mid, ex = B.x, ey = B.y + mid, cx = ex - TURN;
        var ch = chans[cx] || (chans[cx] = []), lane = to + " " + kind;
        if (ch.indexOf(lane) < 0) ch.push(lane);
        cx -= ch.indexOf(lane) * 4;
        var d = "M" + sx + " " + sy;
        // down at once when there is room (just past the parent when the turn would be behind
        // it but the arrow still fits); back round the child's row (a coat-hanger shape) only
        // when the child starts left of the parent's end
        var vx = cx >= sx + 4 ? cx : ex - 8 >= sx + 4 ? sx + 4 : null;
        // a run along the parent's row that would pass behind another node there (and look
        // as if it came out of it) goes along the gap below (or above) the row instead
        var cross = vx !== null && Object.keys(byKey).some(function (k) {
          var C = byKey[k];
          return C !== A && C !== B && C.l === A.l && C.x < vx && C.x + C.w > sx;
        });
        if (cross) {
          var ry = ey >= sy ? A.y + h + vhalf : A.y - vhalf;
          d += "H" + (sx + half) + "V" + ry + "H" + vx + "V" + ey;
        } else if (vx !== null) d += "H" + vx + "V" + ey;
        else {
          var gy = ey > sy ? B.y - vhalf : B.y + h + vhalf;
          d += "H" + (sx + half) + "V" + gy + "H" + cx + "V" + ey;
        }
        d += "H" + ex;
        var data = '" data-a="' + esc(from) + '" data-b="' + esc(to) + '" d="' + d + '"/>';
        var line = '<path class="tl__e tl__e--' + kind + '" marker-end="url(#tl-m' + (kind === "up" ? "u" : "s") + ')' + data;
        return kind === "up" ? line : line + '<path class="tl__e tl__e--lit' + data;
      };
      nodes.forEach(function (n) {
        (n.up || []).forEach(function (p) { svg += edge("up", p, n.k); });
        (n.src || []).forEach(function (p) { svg += edge("src", p, n.k); });
      });
      canvas.insertAdjacentHTML("afterbegin", svg + "</svg>");
      canvas.insertAdjacentHTML("afterbegin", '<div class="tl__axis" style="width:' + W + "px;height:" + row + 'px" aria-hidden="true">' + axis + "</div>");
      // open at the newest end
      // (the newest node, not the axis's end: with every topic the last decade is far wider than its nodes)
      if (keep !== true) {
        var right = 0;
        Object.keys(byKey).forEach(function (k) { right = Math.max(right, byKey[k].x + byKey[k].w); });
        el.scrollLeft = Math.max(0, right + PAD - el.clientWidth);
      }

      // Pointing at a node brings its own lines and neighbours forward.
      var paths = canvas.querySelectorAll(".tl__e");
      var focus = function (k) {
        canvas.classList.toggle("is-focus", !!k);
        var near = {};
        if (k) near[k] = 1;
        paths.forEach(function (p) {
          var on = k && (p.dataset.a === k || p.dataset.b === k);
          p.classList.toggle("is-on", !!on);
          if (on) { near[p.dataset.a] = 1; near[p.dataset.b] = 1; }
        });
        Object.keys(byKey).forEach(function (x) {
          byKey[x].el.classList.toggle("is-near", !!near[x]);
          byKey[x].el.classList.toggle("is-self", x === k);
        });
      };
      // Choosing a node (a click, a tap or Enter) keeps it forward and opens its box; the
      // box has the link to the page. Pointing elsewhere goes back to the chosen one.
      light = focus;
      nodeEl = function (k) { return byKey[k] && byKey[k].el; };
      Object.keys(byKey).forEach(function (k) {
        var a = byKey[k].el;
        a.addEventListener("mouseenter", function () { focus(k); });
        a.addEventListener("focus", function () { focus(k); });
        a.addEventListener("mouseleave", function () { focus(sel); });
        a.addEventListener("blur", function () { focus(sel); });
        a.addEventListener("click", function (e) { e.preventDefault(); choose(k); });
      });
      if (sel && byKey[sel]) focus(sel);
    };

    // ---------- the box for a chosen genre ----------
    var pop = document.getElementById("tl-pop"), sel = null;
    var light = function () {}, nodeEl = function () { return null; };
    var byK = {};
    all.forEach(function (n) { byK[n.k] = n; });
    var names = function (keys) {
      return keys.filter(function (k) { return byK[k]; }).map(function (k) {
        return '<button type="button" class="tl__pop-g" data-k="' + esc(k) + '">' + esc(byK[k].t) + "</button>";
      }).join(" ");
    };
    var choose = function (k, move) {
      var n = byK[k];
      if (!n) return;
      sel = k;
      light(k);
      pop.querySelector(".tl__pop-t").textContent = n.t;
      pop.querySelector(".tl__pop-y").innerHTML =
        '<span data-l="ja">' + (n.b ? when(n, "ja") + "生まれ" : n.y + "年から") + (n.n ? "・ポスト" + n.n + "件" : "") + "</span>" +
        '<span data-l="en" lang="en">' + (n.b ? born(n) : "since " + n.y) + (n.n ? " · " + n.n + (n.n === 1 ? " post" : " posts") : "") + "</span>";
      // the summary in each language (one of them may be a translation of the other)
      var sum = n.s || {}, any = false;
      pop.querySelectorAll("[data-sum]").forEach(function (b) {
        var v = sum[b.dataset.sum];
        b.hidden = !v;
        if (!v) return;
        any = true;
        b.querySelector(".tl__pop-x").textContent = v.x;
        b.querySelector(".tl__pop-wiki").href = v.u;
        b.querySelector(".tl__pop-tr").hidden = !v.tr;
        // a summary written from other sources names them instead of Wikipedia
        b.querySelector(".tl__pop-src:not(.tl__pop-ref)").hidden = !!v.ref;
        b.querySelector(".tl__pop-ref").hidden = !v.ref;
        if (v.ref) {
          var r = b.querySelector(".tl__pop-refa");
          r.textContent = v.ref;
          r.href = v.u;
        }
      });
      pop.querySelector(".tl__pop-s").hidden = !any;
      var np = pop.querySelector("[data-np]");
      np.parentNode.hidden = !n.np;
      if (n.np) np.href = "https://dic.nicovideo.jp/a/" + encodeURIComponent(n.np);
      var rel = {
        up: n.up || [], src: n.src || [],
        down: all.filter(function (m) { return (m.up || []).indexOf(k) !== -1; }).map(function (m) { return m.k; }),
        inf: all.filter(function (m) { return (m.src || []).indexOf(k) !== -1; }).map(function (m) { return m.k; })
      };
      pop.querySelectorAll("[data-rel]").forEach(function (row) {
        var html = names(rel[row.dataset.rel]);
        row.hidden = !html;
        row.querySelector("dd").innerHTML = html;
      });
      pop.querySelector("[data-go]").href = sitePath(n.u);
      pop.hidden = false;
      pop.scrollTop = 0;
      // once a genre has been chosen the scale is not chosen again by itself: when the box
      // closes, the panel (and the window around it) changes height, and choosing again
      // redrew the drawing at its newest end, losing the place the reader was at
      touched = true;
      fit();
      // the chosen genre is kept in view in the (maybe lower) panel
      var a = nodeEl(k);
      if (a && (move || a.offsetLeft < el.scrollLeft || a.offsetLeft + a.offsetWidth > el.scrollLeft + el.clientWidth ||
                a.offsetTop < el.scrollTop || a.offsetTop + a.offsetHeight > el.scrollTop + el.clientHeight)) {
        el.scrollLeft = Math.max(0, a.offsetLeft - Math.round((el.clientWidth - a.offsetWidth) / 2));
        el.scrollTop = Math.max(0, a.offsetTop - GAP);
      }
      // on a PC the page moves to show the box under the panel
      if (!tabBar()) pop.scrollIntoView({ block: "nearest" });
    };
    var close = function () {
      sel = null;
      pop.hidden = true;
      light(null);
      fit();
    };
    pop.addEventListener("click", function (e) {
      var g = e.target.closest("[data-k]");
      if (g) choose(g.dataset.k, true);
      if (e.target.closest("[data-close]")) close();
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && sel) close(); });
    // a tap on the drawing but off the nodes closes the box
    el.addEventListener("click", function (e) { if (sel && !e.target.closest(".tl__node")) close(); });

    var setMode = function (m) {
      mode = m;
      buttons.forEach(function (x) { x.setAttribute("aria-pressed", String(x.dataset.tl === m)); });
      draw();
    };
    buttons.forEach(function (b) {
      b.addEventListener("click", function () {
        setMode(b.dataset.tl);
      });
    });
    // Zoom: redraw at the new scale and lod, and keep the place under the fingers (or the
    // pointer) still.
    var zoom = function (next, l, px, py) {
      touched = true;
      want = Math.max(MIN, Math.min(MAX, next));
      var s = Math.round(want), c = el.firstChild;
      l = Math.max(0, Math.min(2, l));
      if ((s === scale && l === lod) || !c) return;
      if (px === undefined) px = Math.round(el.clientWidth / 2);
      if (py === undefined) py = Math.round(el.clientHeight / 2);
      var at = (el.scrollLeft + px) / c.offsetWidth, atY = (el.scrollTop + py) / c.offsetHeight;
      scale = s;
      lod = l;
      draw(true);
      el.scrollLeft = Math.round(at * el.firstChild.offsetWidth - px);
      el.scrollTop = Math.round(atY * el.firstChild.offsetHeight - py);
    };
    var left = function (x) { return x - el.getBoundingClientRect().left; };
    var down = function (y) { return y - el.getBoundingClientRect().top; };
    // Two fingers: how far apart they move sideways changes the years, up and down the rows;
    // fingers that start less than AXIS px apart on one axis leave that axis alone. The drawing
    // is redrawn step by step as they move (stretching it instead pulled the dot font out of
    // shape). A redraw takes the touched node out of the page, and the browser then sends the
    // gesture to that node alone, so the moves are heard on the touched nodes themselves.
    var pinch = null, AXIS = 48, frame = 0;
    var gap = function (t, k) { return Math.abs(t[0][k] - t[1][k]); };
    // the lod whose rows come nearest to the stretched height
    var nearest = function (h) {
      var best = 0;
      for (var l = 1; l < 3; l++) if (Math.abs(rowH(l) - h) < Math.abs(rowH(best) - h)) best = l;
      return best;
    };
    var move = function (e) {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      var t = e.touches, p = pinch;
      p.px = left((t[0].clientX + t[1].clientX) / 2);
      p.py = down((t[0].clientY + t[1].clientY) / 2);
      if (p.dx >= AXIS) p.s = p.s0 * gap(t, "clientX") / p.dx;
      if (p.dy >= AXIS) p.l = nearest(Math.max(rowH(0), Math.min(rowH(2), p.h0 * gap(t, "clientY") / p.dy)));
      if (!frame) frame = requestAnimationFrame(function () { frame = 0; if (pinch) zoom(pinch.s, pinch.l, pinch.px, pinch.py); });
    };
    var lift = function (e) {
      if (!pinch || (e && e.touches && e.touches.length >= 2)) return;
      pinch.on.forEach(function (n) {
        n.removeEventListener("touchmove", move);
        n.removeEventListener("touchend", lift);
        n.removeEventListener("touchcancel", lift);
      });
      pinch = null;
    };
    el.addEventListener("touchstart", function (e) {
      if (e.touches.length !== 2) return;
      var t = e.touches;
      pinch = { dx: gap(t, "clientX"), dy: gap(t, "clientY"), s0: want, s: want, h0: rowH(lod), l: lod, on: [] };
      [t[0].target, t[1].target, el].forEach(function (n) {
        if (pinch.on.indexOf(n) !== -1) return;
        pinch.on.push(n);
        n.addEventListener("touchmove", move, { passive: false });
        n.addEventListener("touchend", lift);
        n.addEventListener("touchcancel", lift);
      });
    }, { passive: true });
    // Ctrl + wheel, which is also what a touchpad's pinch sends; with Shift, the rows
    var wheel = 0, rows = 0;
    el.addEventListener("wheel", function (e) {
      if (!e.ctrlKey) return;
      e.preventDefault();
      var px = left(e.clientX), py = down(e.clientY);
      // some systems turn a wheel with Shift into a sideways one
      var d = e.deltaY || e.deltaX;
      if (e.shiftKey) {
        rows -= d;
        if (Math.abs(rows) < 100) return;
        var l = lod + (rows > 0 ? 1 : -1);
        rows = 0;
        zoom(want, l, px, py);
        return;
      }
      var next = want * Math.exp(-d / 300);
      if (!wheel) wheel = requestAnimationFrame(function () { wheel = 0; zoom(next, lod, px, py); });
      else want = Math.max(MIN, Math.min(MAX, next));
    }, { passive: false });
    // a mouse moves the drawing by dragging it (the panel has no scrollbars); a drag that moved
    // does not count as a click, so it neither opens a box nor closes one
    var drag = null, dragged = false;
    el.addEventListener("pointerdown", function (e) {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, l: el.scrollLeft, t: el.scrollTop };
      dragged = false;
    });
    window.addEventListener("pointermove", function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!dragged && Math.abs(dx) + Math.abs(dy) < 6) return;
      dragged = true;
      el.classList.add("is-dragging");
      el.scrollLeft = drag.l - dx;
      el.scrollTop = drag.t - dy;
    });
    window.addEventListener("pointerup", function () {
      drag = null;
      el.classList.remove("is-dragging");
    });
    el.addEventListener("click", function (e) {
      if (dragged) { e.preventDefault(); e.stopPropagation(); dragged = false; }
    }, true);
    // Finding a genre by name: the matches open in a column under the box, from the topics in
    // view only (the genres, or every topic when those are shown), so a search never changes the
    // view. Whole names first, then names that start with the words, then the rest. A match is
    // chosen as if tapped.
    var find = document.getElementById("tl-find"), none = document.getElementById("tl-find-none");
    if (find) {
      var list = document.getElementById("tl-names"), hits = [], at = -1;
      // the hint inside the box in the language shown (an attribute cannot be switched by CSS)
      var hint = function () { find.placeholder = find.dataset[root.dataset.lang === "en" ? "phEn" : "phJa"]; };
      hint();
      new MutationObserver(hint).observe(root, { attributes: true, attributeFilter: ["data-lang"] });
      var shut = function () {
        list.hidden = true;
        find.setAttribute("aria-expanded", "false");
        find.removeAttribute("aria-activedescendant");
        at = -1;
      };
      var mark = function (i) {
        at = i;
        list.querySelectorAll("li").forEach(function (li, j) { li.setAttribute("aria-selected", j === i ? "true" : "false"); });
        var li = list.children[i];
        if (li) { find.setAttribute("aria-activedescendant", li.id); li.scrollIntoView({ block: "nearest" }); }
      };
      var search = function () {
        var q = find.value.trim().toLowerCase();
        none.hidden = true;
        hits = [];
        if (q) {
          var rank = function (n) { var t = n.t.toLowerCase(); return t === q ? 0 : t.indexOf(q) === 0 ? 1 : t.indexOf(q) !== -1 ? 2 : 3; };
          hits = all.filter(function (n) { return (mode === "all" || n.b) && rank(n) < 3; })
            .sort(function (a, b) { return rank(a) - rank(b) || a.t.localeCompare(b.t); }).slice(0, 30);
        }
        list.textContent = "";
        hits.forEach(function (n, i) {
          var li = document.createElement("li");
          li.id = "tl-name-" + i;
          li.setAttribute("role", "option");
          li.dataset.k = n.k;
          li.textContent = n.t;
          var y = document.createElement("span");
          y.className = "tl-find-y";
          y.textContent = n.e ? Math.floor(n.y / 10) * 10 + "s" : n.y;
          li.appendChild(y);
          list.appendChild(li);
        });
        if (!hits.length) { shut(); none.hidden = !q; return; }
        list.hidden = false;
        find.setAttribute("aria-expanded", "true");
        mark(-1);
      };
      var pick = function (n) {
        if (!n) return;
        find.value = n.t;
        shut();
        choose(n.k, true);
      };
      find.addEventListener("input", search);
      find.addEventListener("focus", function () { if (find.value.trim()) search(); });
      find.addEventListener("keydown", function (e) {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          if (list.hidden) search();
          if (!hits.length) return;
          e.preventDefault();
          mark(e.key === "ArrowDown" ? (at + 1) % hits.length : (at <= 0 ? hits.length : at) - 1);
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (list.hidden) search();
          pick(hits[at < 0 ? 0 : at]);
        } else if (e.key === "Escape") shut();
      });
      // pressed, not clicked: the box keeps the focus, so the list is still there to be tapped
      list.addEventListener("pointerdown", function (e) { e.preventDefault(); });
      list.addEventListener("click", function (e) {
        var li = e.target.closest("li");
        if (li) pick(byK[li.dataset.k]);
      });
      find.addEventListener("blur", shut);
    }
    // the buttons for a mouse: a step wider or narrower, a line taller or shorter
    document.querySelectorAll("[data-z]").forEach(function (b) {
      b.addEventListener("click", function () {
        var z = b.dataset.z, d = z.charAt(1) === "+" ? 1 : -1;
        if (z.charAt(0) === "x") zoom(scale + d, lod); else zoom(want, lod + d);
      });
    });
    // and + / - on the keyboard when the panel has the focus
    el.addEventListener("keydown", function (e) {
      var d = e.key === "+" || e.key === "=" ? 1 : e.key === "-" ? -1 : 0;
      if (d) { e.preventDefault(); zoom(scale + d, lod); }
    });
    // The panel has a set height, so a drawing made low (rows at their smallest) does not
    // shrink the window with it. On phones the window ends at the bottom of the screen (above
    // the tab bar) when the page is at its top, so the drawing is moved inside the panel and
    // the page itself does not scroll; what is under the panel (the credits, the window's
    // edge) is kept in view too. On a PC that would leave the panel too low: 3/4 of the screen.
    // With the box open on a phone, the panel and the box share that room (the panel a bit
    // under half), so the drawing stays in view above the box.
    var tabBar = function () {
      var bar = document.querySelector(".statusbar__keys");
      return bar && getComputedStyle(bar).position === "fixed" ? bar.offsetHeight : 0;
    };
    var fit = function () {
      var under = tabBar();
      var h = Math.round(window.innerHeight * 3 / 4);
      if (under) {
        var box = el.getBoundingClientRect(), win = el.closest(".win");
        var below = win ? Math.max(0, win.getBoundingClientRect().bottom - box.bottom) : 0;
        if (!pop.hidden) below -= pop.offsetHeight + GAP / 2;
        var room = Math.floor(window.innerHeight - (box.top + window.scrollY) - below - under - GAP);
        h = room;
        if (!pop.hidden) {
          h = Math.max(120, Math.round(room * 0.45));
          pop.style.maxHeight = Math.max(120, room - h - GAP / 2) + "px";
        }
      }
      h = Math.max(pop.hidden ? 240 : 120, h) + "px";
      if (el.style.height !== h) {
        el.style.height = h;
        // the panel settled lower or higher (a late font, a turned phone): choose the
        // starting scale again, unless the reader has already zoomed or chosen a genre
        if (started && !touched && pop.hidden && !again) again = setTimeout(function () { again = 0; autoScale(); }, 0);
      }
      el.style.maxHeight = "none";
    };
    window.addEventListener("resize", fit);
    // and again when the window's parts change size (a title font coming in late, the other
    // language); the panel's own height does not move its top, so this settles at once
    var win = el.closest(".win");
    if (win && window.ResizeObserver) new ResizeObserver(function () { fit(); }).observe(win);
    // the dot font has to be in before the nodes are measured (and the panel placed)
    // At the start the years are as narrow as they can be while every row fits in the panel
    // (wider years need fewer rows), so the drawing needs no scrolling up and down; the
    // heights are measured by drawing (a halving search). When even the widest years leave
    // more rows than fit (many genres born in one year stack up, as on a phone), the years
    // widen only until it stops paying: the first scale where five steps wider would save
    // no more than one row.
    var started = false, touched = false, again = 0;
    var autoScale = function () {
      started = true;
      draw(true);   // once first, so the scrollbar is known
      var seen = {};
      var tall = function (s) {
        if (!(s in seen)) { scale = want = s; draw(true); seen[s] = el.firstChild.offsetHeight; }
        return seen[s];
      };
      var room = el.clientHeight, pick = null;
      if (tall(MAX) <= room) {
        var lo = MIN, hi = MAX;
        while (lo <= hi) {
          var m = (lo + hi) >> 1;
          if (tall(m) <= room) { pick = m; hi = m - 1; } else lo = m + 1;
        }
      } else {
        for (var t = MIN; t < MAX && pick === null; t++) {
          if (tall(t) - tall(Math.min(MAX, t + 5)) <= rowH(lod)) pick = t;
        }
      }
      scale = want = pick || MAX;
      draw();
    };
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(function () { fit(); autoScale(); });
  }

  window.tbkNotes = {
    init: function () {
      var box = document.querySelector(".search[data-pagefind]");
      if (box) initSearch(box);
      var tl = document.getElementById("tl");
      if (tl) initTimeline(tl);
    }
  };
})();

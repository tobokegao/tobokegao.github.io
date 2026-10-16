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

  function initSearch(box) {
    var input = box.querySelector("input");
    var count = document.getElementById("notes-count");
    var list = document.getElementById("notes-results");
    var empty = document.getElementById("notes-empty");
    var asked = 0;
    var run = function () {
      var q = input.value.trim();
      var id = ++asked;
      if (!q) { list.innerHTML = ""; count.textContent = ""; empty.hidden = true; return; }
      loadPagefind(box.dataset.pagefind).then(function (pf) {
        return pf.debouncedSearch(q, {}, 250);
      }).then(function (found) {
        if (!found || id !== asked) return null;   // a newer search is on its way
        count.textContent = found.results.length + (en() ? " pages" : " ページ");
        empty.hidden = found.results.length !== 0;
        return Promise.all(found.results.slice(0, 20).map(function (r) { return r.data(); }));
      }).then(function (pages) {
        if (!pages || id !== asked) return;
        list.innerHTML = pages.map(function (p) {
          // the page's own title (#page-t) is already the result's heading
          var subs = (p.sub_results || []).filter(function (s) { return !/#page-t$/.test(s.url); }).slice(0, 4);
          return '<li class="notes__hit"><a class="notes__hit-t" href="' + esc(p.url) + '">' + esc(p.meta.title) + "</a>" +
            (subs.length ? subs.map(function (s) {
              // Pagefind marks the hits with <mark> in an excerpt it has already escaped
              // the excerpt starts with the post's date line, which is the link already
              var text = s.excerpt.indexOf(s.title) === 0 ? s.excerpt.slice(s.title.length).replace(/^\.\s*/, "") : s.excerpt;
              return '<p class="notes__hit-s"><a href="' + esc(s.url) + '">' + esc(s.title) + "</a> " + text + "</p>";
            }).join("") : '<p class="notes__hit-s">' + p.excerpt + "</p>") + "</li>";
        }).join("");
      }).catch(function () {
        // no index: `hugo server` alone does not run Pagefind
        count.textContent = en() ? "Search is not available here" : "ここでは検索を使えません";
      });
    };
    input.addEventListener("input", run);
  }

  // ---------- timeline ----------
  // Pages with a year, left to right; solid lines from parent to child, dashed from roots
  // to what they influenced. Nodes are links (HTML), the lines an SVG behind them.
  function initTimeline(el) {
    var all = JSON.parse(document.getElementById("tl-data").textContent);
    var buttons = document.querySelectorAll("[data-tl]");
    var mode = "born";
    var PAD = 24, GAP = 24, FLAG = 0, GAP_YEARS = 40, BREAK = 48, TURN = 20, DENSE = 3;
    // px a year; two fingers (or Ctrl + wheel) change it, `want` keeps the fraction between steps
    var scale = 8, want = 8, MIN = 2, MAX = 24;

    var draw = function (keep) {
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
        var a = Math.floor(g[0] / 10) * 10 - 10, b = Math.floor(g[1] / 10) * 10 + 20;
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
        a.className = "tl__node" + (n.b ? "" : " tl__node--posts") + (n.c ? " tl__node--major tl__grp--" + n.c : "") + (n.d ? " tl__node--draft" : "");
        a.href = sitePath(n.u);
        a.innerHTML = '<span class="tl__name">' + esc(n.t) + '</span><span class="tl__year">' +
          // a genre's year is when it was born; a topic without one shows its first post's year.
          // The year and the count take a line each: narrow nodes need fewer rows.
          '<span data-l="ja">' + n.y + (n.b ? "年生まれ" : "年から") + (n.n ? "<br>ポスト" + n.n + "件" : "") + "</span>" +
          '<span data-l="en">' + (n.b ? "born in " : "since ") + n.y + (n.n ? "<br>" + n.n + (n.n === 1 ? " post" : " posts") : "") + "</span></span>";
        canvas.appendChild(a);
        byKey[n.k] = { n: n, el: a };
      });

      // Large genres: a line down from the earliest year of their members, with the name on top.
      var majors = nodes.filter(function (n) { return n.c; });
      var flags = [];
      majors.forEach(function (m) {
        var ys = nodes.filter(function (n) { return n.mj.indexOf(m.k) !== -1; }).map(function (n) { return n.y; });
        if (ys.length) flags.push({ m: m, x: X(Math.min.apply(null, ys)) });
      });
      var dot = parseInt(getComputedStyle(root).getPropertyValue("--dot"), 10) || 12;
      var row = dot * 2;
      FLAG = flags.length ? flags.length * row + GAP : 0;
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
          lanes[best] = x + it.w;
          it.x = x; it.l = best; it.now = true;
        });
      }
      var LH = h + GAP;
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
      // a line at each decade, and at its middle when the decade is wide enough to label it
      var tick = function (y) {
        svg += '<line class="tl__grid" x1="' + X(y) + '" x2="' + X(y) + '" y1="' + row + '" y2="' + H + '"/>' +
          '<text class="tl__label" x="' + (X(y) + 4) + '" y="' + (row - 6) + '">' + y + "</text>";
      };
      segs.forEach(function (g, i) {
        g.decs.forEach(function (dec) {
          tick(dec.d);
          if (dec.w >= 128) tick(dec.d + 5);
        });
        if (i) svg += '<text class="tl__label tl__break" x="' + (g.x - BREAK + 12) + '" y="' + (row - 6) + '">≈</text>';
      });
      flags.forEach(function (f, i) {
        svg += '<line class="tl__flag tl__grp--' + f.m.c + '" x1="' + f.x + '" x2="' + f.x + '" y1="' + (row + GAP + i * row) + '" y2="' + H + '"/>' +
          '<text class="tl__flag-t tl__grp--' + f.m.c + '" x="' + (f.x + 6) + '" y="' + (row + GAP + i * row + dot) + '">' + esc(f.m.t) + "</text>";
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
        var mid = Math.round(h / 2), half = Math.round(GAP / 2);
        var sx = A.x + A.w, sy = A.y + mid, ex = B.x, ey = B.y + mid, cx = ex - TURN;
        var ch = chans[cx] || (chans[cx] = []), lane = to + " " + kind;
        if (ch.indexOf(lane) < 0) ch.push(lane);
        cx -= ch.indexOf(lane) * 4;
        var d = "M" + sx + " " + sy;
        if (cx >= sx + half) d += "H" + cx + "V" + ey;
        else {
          var gy = ey > sy ? B.y - half : B.y + h + half;
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
      // open at the busiest decade (the middle of the pages, by year)
      var mid = nodes[Math.floor(nodes.length / 2)];
      if (keep !== true) el.scrollLeft = Math.max(0, X(mid.y) - Math.round(el.clientWidth / 2));

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
        Object.keys(byKey).forEach(function (x) { byKey[x].el.classList.toggle("is-near", !!near[x]); });
      };
      Object.keys(byKey).forEach(function (k) {
        var a = byKey[k].el;
        a.addEventListener("mouseenter", function () { focus(k); });
        a.addEventListener("focus", function () { focus(k); });
        a.addEventListener("mouseleave", function () { focus(null); });
        a.addEventListener("blur", function () { focus(null); });
      });
    };

    buttons.forEach(function (b) {
      b.addEventListener("click", function () {
        mode = b.dataset.tl;
        buttons.forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        draw();
      });
    });
    // Zoom: redraw at the new scale and keep the place under the fingers (or the pointer) still.
    var zoom = function (next, px) {
      want = Math.max(MIN, Math.min(MAX, next));
      var s = Math.round(want), c = el.firstChild;
      if (s === scale || !c) return;
      var at = (el.scrollLeft + px) / c.offsetWidth, top = el.scrollTop;
      scale = s;
      draw(true);
      el.scrollLeft = Math.round(at * el.firstChild.offsetWidth - px);
      el.scrollTop = top;
    };
    var left = function (x) { return x - el.getBoundingClientRect().left; };
    // Two fingers: while they move, the drawing is only stretched (a redraw would take the
    // touched node out from under them and the gesture would stop); it is redrawn when they lift.
    var pinch = null;
    var span = function (t) { return Math.abs(t[0].clientX - t[1].clientX) || 1; };
    el.addEventListener("touchstart", function (e) {
      if (e.touches.length !== 2) return;
      var t = e.touches, px = left((t[0].clientX + t[1].clientX) / 2);
      pinch = { d: span(t), px: px, k: 1, c: el.firstChild };
      pinch.c.style.transformOrigin = el.scrollLeft + px + "px 0";
    }, { passive: true });
    el.addEventListener("touchmove", function (e) {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      pinch.k = Math.max(MIN / scale, Math.min(MAX / scale, span(e.touches) / pinch.d));
      pinch.c.style.transform = "scaleX(" + pinch.k + ")";
    }, { passive: false });
    var lift = function () {
      if (!pinch) return;
      var p = pinch;
      pinch = null;
      p.c.style.transform = "";
      zoom(scale * p.k, p.px);
    };
    el.addEventListener("touchend", function (e) { if (e.touches.length < 2) lift(); });
    el.addEventListener("touchcancel", lift);
    // Ctrl + wheel, which is also what a touchpad's pinch sends
    var wheel = 0;
    el.addEventListener("wheel", function (e) {
      if (!e.ctrlKey) return;
      e.preventDefault();
      var px = left(e.clientX), next = want * Math.exp(-e.deltaY / 300);
      if (!wheel) wheel = requestAnimationFrame(function () { wheel = 0; zoom(next, px); });
      else want = Math.max(MIN, Math.min(MAX, next));
    }, { passive: false });
    // and + / - on the keyboard when the panel has the focus
    el.addEventListener("keydown", function (e) {
      var d = e.key === "+" || e.key === "=" ? 1 : e.key === "-" ? -1 : 0;
      if (d) { e.preventDefault(); zoom(scale + d, Math.round(el.clientWidth / 2)); }
    });
    // the dot font has to be in before the nodes are measured
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(draw);
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

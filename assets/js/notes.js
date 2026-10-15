// NOTES: the search box (Pagefind, built after Hugo) and the timeline. Loaded by site.js
// on the pages that have [data-notes-js]; init() runs again after every page change.
(function () {
  "use strict";
  var root = document.documentElement;
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
        count.textContent = en() ? "search is not built here" : "ここでは検索を使えません";
      });
    };
    input.addEventListener("input", run);
  }

  // ---------- timeline ----------
  // Pages with a year, left to right; solid lines from parent to child, dashed from roots
  // to what they influenced. Nodes are links (HTML), the lines an SVG behind them.
  function initTimeline(el) {
    var all = JSON.parse(document.getElementById("tl-data").textContent);
    var scaleInput = document.getElementById("tl-scale");
    var buttons = document.querySelectorAll("[data-tl]");
    var mode = "born";
    var PAD = 24, GAP = 12, FLAG = 0, GAP_YEARS = 40, BREAK = 48;

    var draw = function () {
      var scale = parseInt(scaleInput.value, 10);
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
      var left = PAD;
      segs = segs.map(function (g) {
        var a = Math.floor(g[0] / 10) * 10 - 10, b = Math.ceil(g[1] / 10) * 10 + 10;
        var seg = { a: a, b: b, x: left };
        left += (b - a) * scale + BREAK;
        return seg;
      });
      var X = function (y) {
        var g = segs.filter(function (s) { return y >= s.a; }).pop() || segs[0];
        return g.x + (Math.min(y, g.b) - g.a) * scale;
      };
      var maxX = left - BREAK;

      var canvas = document.createElement("div");
      canvas.className = "tl__canvas";
      el.appendChild(canvas);
      var byKey = {};
      nodes.forEach(function (n) {
        var a = document.createElement("a");
        a.className = "tl__node" + (n.b ? "" : " tl__node--posts") + (n.c ? " tl__node--major tl__grp--" + n.c : "") + (n.d ? " tl__node--draft" : "");
        a.href = n.u;
        a.innerHTML = '<span class="tl__name">' + esc(n.t) + '</span><span class="tl__year">' + n.y + (n.n ? " / " + n.n : "") + "</span>";
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

      // Lanes: each node takes the first row that is free at its year.
      var lanes = [], h = 0;
      nodes.forEach(function (n) {
        var it = byKey[n.k], x = X(n.y), w = it.el.offsetWidth;
        h = Math.max(h, it.el.offsetHeight);
        var l = lanes.findIndex(function (end) { return end + GAP < x; });
        if (l < 0) { l = lanes.length; lanes.push(0); }
        lanes[l] = x + w;
        it.x = x; it.w = w; it.l = l;
      });
      var LH = h + GAP;
      var W = Math.max(maxX + PAD, Math.max.apply(null, lanes) + PAD);
      var H = TOP + lanes.length * LH + PAD;
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      Object.keys(byKey).forEach(function (k) {
        var it = byKey[k];
        it.y = TOP + it.l * LH;
        it.el.style.left = it.x + "px";
        it.el.style.top = it.y + "px";
      });

      var step = [1, 5, 10, 25, 50, 100, 250].find(function (s) { return s * scale >= 64; }) || 250;
      var svg = '<svg class="tl__svg" width="' + W + '" height="' + H + '" aria-hidden="true"><defs>' +
        '<marker id="tl-mu" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path class="tl__arrow--up" d="M0 0L8 4L0 8z"/></marker>' +
        '<marker id="tl-ms" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path class="tl__arrow--src" d="M0 0L8 4L0 8z"/></marker></defs>';
      segs.forEach(function (g, i) {
        for (var y = Math.ceil(g.a / step) * step; y <= g.b; y += step) {
          svg += '<line class="tl__grid" x1="' + X(y) + '" x2="' + X(y) + '" y1="' + row + '" y2="' + H + '"/>' +
            '<text class="tl__label" x="' + (X(y) + 4) + '" y="' + (row - 6) + '">' + y + "</text>";
        }
        if (i) svg += '<text class="tl__label tl__break" x="' + (g.x - BREAK + 12) + '" y="' + (row - 6) + '">≈</text>';
      });
      flags.forEach(function (f, i) {
        svg += '<line class="tl__flag tl__grp--' + f.m.c + '" x1="' + f.x + '" x2="' + f.x + '" y1="' + (row + GAP + i * row) + '" y2="' + H + '"/>' +
          '<text class="tl__flag-t tl__grp--' + f.m.c + '" x="' + (f.x + 6) + '" y="' + (row + GAP + i * row + dot) + '">' + esc(f.m.t) + "</text>";
      });
      var edge = function (kind, from, to) {
        var A = byKey[from], B = byKey[to];
        if (!A || !B) return "";
        var sx = A.x + A.w, sy = A.y + Math.round(h / 2), ex = B.x, ey = B.y + Math.round(h / 2);
        var d = Math.max(40, Math.round(Math.abs(ex - sx) / 2));
        return '<path class="tl__e tl__e--' + kind + '" data-a="' + esc(from) + '" data-b="' + esc(to) + '" marker-end="url(#tl-m' + (kind === "up" ? "u" : "s") + ')" d="M' + sx + " " + sy + " C" + (sx + d) + " " + sy + "," + (ex - d) + " " + ey + "," + ex + " " + ey + '"/>';
      };
      nodes.forEach(function (n) {
        (n.up || []).forEach(function (p) { svg += edge("up", p, n.k); });
        (n.src || []).forEach(function (p) { svg += edge("src", p, n.k); });
      });
      canvas.insertAdjacentHTML("afterbegin", svg + "</svg>");
      // open at the busiest decade (the middle of the pages, by year)
      var mid = nodes[Math.floor(nodes.length / 2)];
      el.scrollLeft = Math.max(0, X(mid.y) - Math.round(el.clientWidth / 2));

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
    scaleInput.addEventListener("input", draw);
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

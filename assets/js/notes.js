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

    var draw = function (keep) {
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
        a.className = "tl__node" + (n.b ? "" : " tl__node--posts") + (n.c ? " tl__node--major tl__grp--" + n.c : "") + (n.d ? " tl__node--draft" : "");
        a.href = sitePath(n.u);
        var posts = lod > 1 && n.n;
        a.innerHTML = '<span class="tl__name">' + esc(n.t) + "</span>" + (lod ? '<span class="tl__year">' +
          // a genre's year is when it was born; a topic without one shows its first post's year.
          // The year and the count take a line each: narrow nodes need fewer rows.
          '<span data-l="ja">' + n.y + (n.b ? "年生まれ" : "年から") + (posts ? "<br>ポスト" + n.n + "件" : "") + "</span>" +
          '<span data-l="en">' + (n.b ? "born in " : "since ") + n.y + (posts ? "<br>" + n.n + (n.n === 1 ? " post" : " posts") : "") + "</span></span>" : "");
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
      var tick = function (y) {
        var x = X(y);
        svg += '<line class="tl__grid" x1="' + x + '" x2="' + x + '" y1="' + row + '" y2="' + H + '"/>';
        if (x < said + LABEL || x + LABEL > stop) return;
        said = x;
        svg += '<text class="tl__label" x="' + (x + 4) + '" y="' + (row - 6) + '">' + y + "</text>";
      };
      segs.forEach(function (g, i) {
        if (i) {
          var bx = g.x - BREAK + 12;
          svg += '<text class="tl__label tl__break" x="' + bx + '" y="' + (row - 6) + '">≈</text>';
          said = bx + dot - LABEL;
        }
        // and none runs into the next break mark
        stop = i + 1 < segs.length ? segs[i + 1].x - BREAK + 12 : 1e9;
        g.decs.forEach(function (dec) {
          tick(dec.d);
          if (dec.w >= 128) tick(dec.d + 5);
        });
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
      // open at the newest end
      if (keep !== true) el.scrollLeft = el.scrollWidth;

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
        '<span data-l="ja">' + n.y + (n.b ? "年生まれ" : "年から") + (n.n ? "・ポスト" + n.n + "件" : "") + "</span>" +
        '<span data-l="en" lang="en">' + (n.b ? "born in " : "since ") + n.y + (n.n ? " · " + n.n + (n.n === 1 ? " post" : " posts") : "") + "</span>";
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

    buttons.forEach(function (b) {
      b.addEventListener("click", function () {
        mode = b.dataset.tl;
        buttons.forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        draw();
      });
    });
    // Zoom: redraw at the new scale and lod, and keep the place under the fingers (or the
    // pointer) still.
    var zoom = function (next, l, px, py) {
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
      if (el.style.height !== h) el.style.height = h;
      el.style.maxHeight = "none";
    };
    window.addEventListener("resize", fit);
    // and again when the window's parts change size (a title font coming in late, the other
    // language); the panel's own height does not move its top, so this settles at once
    var win = el.closest(".win");
    if (win && window.ResizeObserver) new ResizeObserver(function () { fit(); }).observe(win);
    // the dot font has to be in before the nodes are measured (and the panel placed)
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(function () { fit(); draw(); });
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

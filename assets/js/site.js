(function () {
  "use strict";
  var root = document.documentElement;

  // Always open a page at the top (some viewers carry the previous page's scroll
  // position over); links to an #anchor still land on it.
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  var toTop = function () {
    var target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) target.scrollIntoView(); else window.scrollTo(0, 0);
  };
  toTop();
  window.addEventListener("pageshow", toTop);

  // Page changes: when the next page takes more than 0.3 s, a small LOAD.EXE window
  // shows a block meter on the old page. The meter only guesses (the browser does not
  // report progress). Its timing lives in CSS (site.css, .loading): the window is put on
  // the page at once but only appears after 0.3 s, so it also shows, and keeps moving,
  // while this script is busy putting a heavy page together. With reduced motion it stays still.
  var loading = document.getElementById("loading");
  function hideLoading() {
    if (loading) loading.hidden = true;
  }
  function showLoading() {
    if (!loading) return;
    loading.hidden = true;
    void loading.offsetWidth;   // restart the CSS animations from the first frame
    loading.hidden = false;
  }
  // Wait until the meter is on screen before the heavy work, so the browser has it in hand.
  function afterPaint(value) {
    // a hidden tab draws no frames, so do not wait more than 0.1 s for one
    return new Promise(function (done) {
      var next = function () { clearTimeout(cap); setTimeout(function () { done(value); }, 0); };
      var cap = setTimeout(next, 100);
      requestAnimationFrame(next);
    });
  }
  // coming back with the Back button can restore this page as it was, meter and all
  window.addEventListener("pageshow", hideLoading);

  function store(key, value) { try { localStorage.setItem(key, value); } catch (e) {} }

  // The language and day/night pairs are one button each; the lit half shows the state.
  // Clicks are caught on the document, so the buttons keep working after the menu bar
  // is swapped in by a page change (see below).
  function mark(group, value) {
    document.querySelectorAll('[data-toggle="' + group + '"] .seg__opt').forEach(function (o) {
      o.classList.toggle("is-on", o.dataset.opt === value);
    });
  }
  var langHooks = [];   // page parts that redraw on a language switch (set by initPage)

  // Language: both languages are already on the page, so switching is instant.
  function setLang(l) {
    root.dataset.lang = l;
    root.lang = l;
    mark("lang", l);
    setTitle();
    langHooks.forEach(function (fn) { fn(); });
  }
  // The tab title in the active language (both are on <title> as data-ja / data-en).
  function setTitle() {
    var t = document.querySelector("title");
    var s = t && t.dataset[root.dataset.lang === "en" ? "en" : "ja"];
    if (s) document.title = s;
  }
  // Day (Tobokegao colors) is the default; night is remembered per browser.
  function setScheme(s) {
    if (s === "night") root.dataset.scheme = "night"; else delete root.dataset.scheme;
    mark("scheme", s);
  }
  function markToggles() {
    mark("lang", root.dataset.lang === "en" ? "en" : "ja");
    mark("scheme", root.dataset.scheme === "night" ? "night" : "day");
  }
  setLang(root.dataset.lang === "en" ? "en" : "ja");
  setScheme(root.dataset.scheme === "night" ? "night" : "day");
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-toggle]");
    if (!b) return;
    if (b.dataset.toggle === "lang") {
      var l = root.dataset.lang === "en" ? "ja" : "en";
      setLang(l); store("tbk-lang", l);
    } else if (b.dataset.toggle === "scheme") {
      var s = root.dataset.scheme === "night" ? "day" : "night";
      setScheme(s); store("tbk-scheme", s);
    }
  });

  // DOS menu keys: holding Alt lights up the hotkey letters (Alt+letter itself is the
  // links' accesskey), F10 puts the focus on the first menu item.
  var menubar = function () { return document.querySelector(".menubar"); };
  document.addEventListener("keydown", function (e) {
    var bar = menubar();
    if (!bar) return;
    if (e.key === "Alt") bar.classList.add("is-alt");
    if (e.key === "F10") {
      e.preventDefault();
      var first = bar.querySelector(".menubar__nav a");
      if (first) first.focus();
    }
  });
  document.addEventListener("keyup", function (e) { var bar = menubar(); if (bar && e.key === "Alt") bar.classList.remove("is-alt"); });
  window.addEventListener("blur", function () { var bar = menubar(); if (bar) bar.classList.remove("is-alt"); });

  // F1-F6 jump between sections, like the DOS status bar says.
  document.addEventListener("keydown", function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    var link = document.querySelector('.statusbar a[data-key="' + e.key + '"]');
    if (link) { e.preventDefault(); go(link.href, true); }
  });

  // Pictures at full size: a link with data-zoom opens its picture in the ZOOM window over
  // the page (a native <dialog>, so Esc and the focus work as usual). Clicking outside the
  // picture or the [■] box closes it. Without the dialog element the link opens the file.
  var zoom = document.getElementById("zoom");
  if (zoom && zoom.showModal) {
    var zoomImg = document.getElementById("zoom-img");
    document.addEventListener("click", function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      var a = e.target.closest && e.target.closest("a[data-zoom]");
      if (!a) return;
      e.preventDefault();
      var name = decodeURIComponent(a.pathname.split("/").pop() || "PICTURE");
      document.getElementById("zoom-t").textContent = name.toUpperCase();
      var img = a.querySelector("img");
      zoomImg.alt = img ? img.alt : "";
      zoomImg.src = a.href;
      zoom.showModal();
    });
    zoom.addEventListener("click", function (e) {
      if (e.target === zoom || e.target.closest("[data-zoom-close]")) zoom.close();
    });
    zoom.addEventListener("close", function () { zoomImg.removeAttribute("src"); });
  }

  // Page changes without reloading: a link to another page of this site fetches that
  // page and swaps in its <main>, menu bar and status bar, so the screen is never
  // redrawn from blank. The page starts loading as soon as a finger or the pointer
  // touches the link, and the menu pages are fetched ahead when the browser is idle.
  // Anything unusual (another site, a file, an error, an old browser) falls back to a
  // normal page load. See docs/decisions/0011.
  var cache = {};       // url -> promise of the page's HTML
  var current = 0;      // the latest change, so a slow one cannot overwrite a newer one
  var shown = location.href.split("#")[0];   // the page now on screen
  function pageUrl(a) {
    if (!a || !a.href || a.target || a.hasAttribute("download") || a.origin !== location.origin) return null;
    if (!/(\/|\.html)$/.test(a.pathname)) return null;      // files: feeds, images, fonts
    return a.href.split("#")[0];
  }
  var ready = {};        // url -> the page's HTML once it has arrived, to swap without waiting
  // The first few pictures of a fetched page are requested right away, so they are in the
  // browser's cache by the time the page is shown. The logo of the other scheme is skipped.
  var PICTURES = 6;
  function warmPictures(html, url) {
    var other = root.dataset.scheme === "night" ? "logo--day" : "logo--night";
    var re = /<img\b[^>]*>/g, m, n = 0;
    while ((m = re.exec(html)) && n < PICTURES) {
      if (m[0].indexOf(other) >= 0) continue;
      var src = /\ssrc=(?:"([^"]*)"|([^\s>]+))/.exec(m[0]);
      if (!src) continue;
      new Image().src = new URL(src[1] || src[2], url).href;
      n++;
    }
  }
  function fetchPage(url) {
    if (!cache[url]) {
      cache[url] = fetch(url, { credentials: "same-origin" }).then(function (r) {
        if (!r.ok || !/text\/html/.test(r.headers.get("content-type") || "")) throw new Error("not a page");
        return r.text();
      }).then(function (html) { ready[url] = html; warmPictures(html, url); return html; });
      cache[url].catch(function () { delete cache[url]; });
    }
    return cache[url];
  }
  // Puts the next page's parts on screen. The address changes only afterwards (see go), so
  // links and pictures written relative to the next page (the preview build) are made absolute
  // first. Returns a function that updates the tab title and description, to run once the
  // address has changed (the title belongs to the new history entry, not the one being left).
  function swap(html, url, hash, y) {
    var doc = new DOMParser().parseFromString(html, "text/html");
    var main = doc.getElementById("main");
    if (!main) throw new Error("no main");
    doc.querySelectorAll("[href], [src]").forEach(function (el) {
      ["href", "src"].forEach(function (k) {
        var v = el.getAttribute(k);
        if (v && !/^([a-z][a-z0-9+.-]*:|\/|#)/i.test(v)) el.setAttribute(k, new URL(v, url).href);
      });
    });
    // the first pictures load and decode with the page instead of popping in after it
    var other = root.dataset.scheme === "night" ? "logo--day" : "logo--night";
    var n = 0;
    main.querySelectorAll("img").forEach(function (img) {
      if (n >= PICTURES || img.classList.contains(other) || !img.getAttribute("src")) return;
      img.loading = "eager"; img.decoding = "sync"; n++;
    });
    document.getElementById("main").replaceWith(document.importNode(main, true));
    // The menu bar and the tab bar stay the same elements (only the parts that differ change),
    // so the link just tapped keeps its hover state: the About figure turns while it is held.
    [".menubar", ".statusbar"].forEach(function (sel) {
      var from = doc.querySelector(sel), to = document.querySelector(sel);
      if (!from || !to) return;
      var a = to.querySelectorAll("nav a"), b = from.querySelectorAll("nav a");
      if (a.length !== b.length) { to.replaceWith(document.importNode(from, true)); return; }
      a.forEach(function (link, i) {
        if (b[i].hasAttribute("aria-current")) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
      });
      // the brand (a banner on every page but the top) and the contact link differ by page
      [".menubar__brand", ".seg--link", ".statusbar__meta"].forEach(function (part) {
        var x = from.querySelector(part), y = to.querySelector(part);
        if (x && y && x.outerHTML !== y.outerHTML) y.replaceWith(document.importNode(x, true));
      });
    });
    var title = doc.querySelector("title"), docTitle = doc.title;
    var desc = doc.querySelector('meta[name="description"]');
    markToggles();
    initPage();
    var target = hash && document.getElementById(decodeURIComponent(hash.slice(1)));
    if (target) target.scrollIntoView(); else window.scrollTo(0, y || 0);
    var m = document.getElementById("main");
    m.setAttribute("tabindex", "-1");
    m.focus({ preventScroll: true });   // screen readers start reading the new page
    return function () {
      var myTitle = document.querySelector("title");
      if (title && myTitle) { myTitle.dataset.ja = title.dataset.ja || title.textContent; myTitle.dataset.en = title.dataset.en || ""; }
      document.title = docTitle;
      setTitle();
      var mine = document.querySelector('meta[name="description"]');
      if (desc && mine) mine.setAttribute("content", desc.getAttribute("content"));
    };
  }
  // after the next frame has been drawn (a hidden tab draws none, so 0.2 s at most)
  function afterFrame(fn) {
    var done = false, run = function () { if (!done) { done = true; fn(); } };
    setTimeout(run, 200);
    requestAnimationFrame(function () { requestAnimationFrame(run); });
  }
  // The scroll position is kept in each history entry and put back by hand on Back/Forward,
  // since the page is only swapped in after the browser would have restored it.
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  function go(href, push) {
    var a = document.createElement("a"); a.href = href;
    var url = pageUrl(a);
    if (!url || !window.fetch || !window.DOMParser || !history.pushState) { location.href = href; return; }
    var id = ++current;
    var y = push ? 0 : (history.state && history.state.y) || 0;
    if (push) history.replaceState({ tbk: 1, y: window.scrollY }, "");   // where this page was left
    var show = function (html) {
      var head = swap(html, url, a.hash, y);
      shown = url;
      hideLoading();
      if (!push) { head(); return; }
      // A new history entry makes Chrome on Android hold the screen for about 0.4 s (measured
      // on Tobokegao's phone; not in incognito), so the entry is added once the new page is
      // already showing. See docs/decisions/0014.
      afterFrame(function () {
        history.pushState({ tbk: 1, y: 0 }, "", href);
        head();
      });
    };
    // a page already here (seen before, or fetched ahead) goes on screen at once, with no meter
    if (ready[url]) {
      try { show(ready[url]); } catch (e) { location.href = href; }
      return;
    }
    showLoading();
    fetchPage(url).then(afterPaint).then(function (html) {
      if (id === current) show(html);
    }).catch(function () {
      if (id === current) location.href = href;   // let the browser show whatever it is
    });
  }
  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest("a[href]");
    var url = pageUrl(a);
    if (!url) return;
    if (a.pathname === location.pathname && a.search === location.search && a.hash) return;  // #anchor on this page
    e.preventDefault();
    go(a.href, true);
  });
  var early = function (e) {
    var url = pageUrl(e.target.closest && e.target.closest("a[href]"));
    if (url && url !== shown) fetchPage(url);
  };
  var hover = 0;   // the pointer has to rest on a link a moment, so sweeping over the log fetches nothing
  document.addEventListener("pointerdown", early, { passive: true });
  document.addEventListener("mouseover", function (e) { clearTimeout(hover); hover = setTimeout(function () { early(e); }, 80); }, { passive: true });
  document.addEventListener("mouseout", function () { clearTimeout(hover); }, { passive: true });
  window.addEventListener("popstate", function () {
    if (location.href.split("#")[0] === shown) { toTop(); return; }   // only the #anchor changed
    go(location.href, false);
  });
  var ahead = function () {
    // the menu pages, the top page (the brand), and this page itself, for Back
    document.querySelectorAll(".menubar__nav a, .menubar__brand, .statusbar a").forEach(function (a) {
      var url = pageUrl(a);
      if (url && url !== shown) fetchPage(url);
    });
    fetchPage(shown).catch(function () {});
  };
  window.addEventListener("load", function () {
    (window.requestIdleCallback || function (fn) { setTimeout(fn, 1500); })(ahead);
  });

  // Everything that belongs to the page in <main>; run again after each page change.
  function initPage() {
    langHooks = [];

    // News log: kind buttons and a text search, combined.
    var logRows = document.querySelectorAll(".log__row[data-kind]");
    var kindButtons = document.querySelectorAll(".filters--log .chip[data-kind]");
    var search = document.getElementById("log-search");
    var count = document.getElementById("log-count");
    var empty = document.getElementById("log-empty");
    if (search && logRows.length) {
      var kind = "all";
      var applyLog = function () {
        var q = search.value.trim().toLowerCase();
        var shown = 0;
        logRows.forEach(function (row) {
          var ok = (kind === "all" || row.dataset.kind === kind) && (!q || row.textContent.toLowerCase().indexOf(q) !== -1);
          row.hidden = !ok;
          if (ok) shown++;
        });
        var unit = root.dataset.lang === "en" ? " items" : " 件";
        count.textContent = shown + unit;
        empty.hidden = shown !== 0;
      };
      kindButtons.forEach(function (b) {
        b.addEventListener("click", function () {
          kind = b.dataset.kind;
          kindButtons.forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
          applyLog();
        });
      });
      search.addEventListener("input", applyLog);
      langHooks.push(applyLog);
      applyLog();
    }

    // Home windows fold up with the [-] / [+] box on their border; each one is remembered
    // per browser.
    document.querySelectorAll(".win__toggle").forEach(function (b) {
      var win = b.closest(".win");
      var key = "tbk-fold-" + b.dataset.win;
      var fold = function (on) {
        win.classList.toggle("is-folded", on);
        b.setAttribute("aria-expanded", String(!on));
      };
      try { fold(localStorage.getItem(key) === "1"); } catch (e) {}
      b.hidden = false;
      b.addEventListener("click", function () {
        var on = !win.classList.contains("is-folded");
        fold(on);
        store(key, on ? "1" : "0");
      });
    });

    // Release filter: all / own / label.
    var grid = document.getElementById("release-grid");
    var chips = document.querySelectorAll(".chip[data-filter]");
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        var f = chip.dataset.filter;
        chips.forEach(function (c) { c.setAttribute("aria-pressed", String(c === chip)); });
        if (!grid) return;
        grid.querySelectorAll(".jacket").forEach(function (j) {
          j.hidden = f !== "all" && j.dataset.owner !== f;
        });
      });
    });
  }
  initPage();
})();

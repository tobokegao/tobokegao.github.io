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
  // report progress): it fills fast (0.04 s a cell), then slows down near the end. With reduced motion
  // it stays still.
  var loading = document.getElementById("loading");
  var loadWait = 0, loadStep = 0;
  function hideLoading() {
    clearTimeout(loadWait); clearTimeout(loadStep);
    if (loading) loading.hidden = true;
  }
  function showLoading() {
    if (!loading) return;
    hideLoading();
    var bar = loading.querySelector(".loading__bar"), cells = 20, n = 0;
    var draw = function () { bar.textContent = "█".repeat(n) + "░".repeat(cells - n); };
    var still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    loadWait = setTimeout(function () {
      n = still ? 0 : 1; draw(); loading.hidden = false;
      if (still) return;
      (function next() {
        if (n >= cells - 1) return;
        loadStep = setTimeout(function () { n++; draw(); next(); }, n < 14 ? 40 : 300);
      })();
    }, 300);
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
    langHooks.forEach(function (fn) { fn(); });
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
  function fetchPage(url) {
    if (!cache[url]) {
      cache[url] = fetch(url, { credentials: "same-origin" }).then(function (r) {
        if (!r.ok || !/text\/html/.test(r.headers.get("content-type") || "")) throw new Error("not a page");
        return r.text();
      });
      cache[url].catch(function () { delete cache[url]; });
    }
    return cache[url];
  }
  function swap(html, url, hash) {
    var doc = new DOMParser().parseFromString(html, "text/html");
    var main = doc.getElementById("main");
    if (!main) throw new Error("no main");
    ["main", ".menubar", ".statusbar"].forEach(function (sel) {
      var from = doc.querySelector(sel), to = document.querySelector(sel);
      if (from && to) to.replaceWith(document.importNode(from, true));
    });
    document.title = doc.title;
    var desc = doc.querySelector('meta[name="description"]'), mine = document.querySelector('meta[name="description"]');
    if (desc && mine) mine.setAttribute("content", desc.getAttribute("content"));
    markToggles();
    initPage();
    var target = hash && document.getElementById(decodeURIComponent(hash.slice(1)));
    if (target) target.scrollIntoView(); else window.scrollTo(0, 0);
    var m = document.getElementById("main");
    m.setAttribute("tabindex", "-1");
    m.focus({ preventScroll: true });   // screen readers start reading the new page
  }
  function go(href, push) {
    var a = document.createElement("a"); a.href = href;
    var url = pageUrl(a);
    if (!url || !window.fetch || !window.DOMParser || !history.pushState) { location.href = href; return; }
    var id = ++current;
    showLoading();
    fetchPage(url).then(function (html) {
      if (id !== current) return;
      if (push) history.pushState({ tbk: 1 }, "", href);
      swap(html, url, a.hash);
      shown = url;
      hideLoading();
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
    if (url && url !== location.href.split("#")[0]) fetchPage(url);
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
    document.querySelectorAll(".menubar__nav a, .statusbar a").forEach(function (a) {
      var url = pageUrl(a);
      if (url && url !== location.href.split("#")[0]) fetchPage(url);
    });
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

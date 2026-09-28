(function () {
  "use strict";
  var root = document.documentElement;

  // Always open a page at the top (some viewers carry the previous page's scroll
  // position over); links to an #anchor still land on it.
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  var toTop = function () { if (!location.hash) window.scrollTo(0, 0); };
  toTop();
  window.addEventListener("pageshow", toTop);

  function store(key, value) { try { localStorage.setItem(key, value); } catch (e) {} }
  // The language and day/night pairs are one button each; the lit half shows the state.
  function mark(group, value) {
    document.querySelectorAll('[data-toggle="' + group + '"] .seg__opt').forEach(function (o) {
      o.classList.toggle("is-on", o.dataset.opt === value);
    });
  }
  function onToggle(group, fn) {
    document.querySelectorAll('[data-toggle="' + group + '"]').forEach(function (b) { b.addEventListener("click", fn); });
  }

  // Language: both languages are already on the page, so switching is instant.
  function setLang(l) {
    root.dataset.lang = l;
    root.lang = l;
    mark("lang", l);
  }
  setLang(root.dataset.lang === "en" ? "en" : "ja");
  onToggle("lang", function () {
    var l = root.dataset.lang === "en" ? "ja" : "en";
    setLang(l);
    store("tbk-lang", l);
  });

  // Day (Tobokegao colors) is the default; night is remembered per browser.
  function setScheme(s) {
    if (s === "night") root.dataset.scheme = "night"; else delete root.dataset.scheme;
    mark("scheme", s);
  }
  setScheme(root.dataset.scheme === "night" ? "night" : "day");
  onToggle("scheme", function () {
    var s = root.dataset.scheme === "night" ? "day" : "night";
    setScheme(s);
    store("tbk-scheme", s);
  });

  // DOS menu keys: holding Alt lights up the hotkey letters (Alt+letter itself is the
  // links' accesskey), F10 puts the focus on the first menu item.
  var bar = document.querySelector(".menubar");
  if (bar) {
    document.addEventListener("keydown", function (e) {
      if (e.key === "Alt") bar.classList.add("is-alt");
      if (e.key === "F10") {
        e.preventDefault();
        var first = bar.querySelector(".menubar__nav a");
        if (first) first.focus();
      }
    });
    document.addEventListener("keyup", function (e) { if (e.key === "Alt") bar.classList.remove("is-alt"); });
    window.addEventListener("blur", function () { bar.classList.remove("is-alt"); });
  }

  // F1-F6 jump between sections, like the DOS status bar says.
  document.addEventListener("keydown", function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    var link = document.querySelector('.statusbar a[data-key="' + e.key + '"]');
    if (link) { e.preventDefault(); location.href = link.href; }
  });

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
    onToggle("lang", applyLog);
    applyLog();
  }

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
})();

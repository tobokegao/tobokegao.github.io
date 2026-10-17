/* Language and color scheme are applied before the first paint, so switching never reloads the page. */
(function () {
  var d = document.documentElement, l, s;
  try { l = localStorage.getItem("tbk-lang"); s = localStorage.getItem("tbk-scheme"); } catch (e) {}
  if (l !== "ja" && l !== "en") l = /^ja\b/i.test(navigator.language || "ja") ? "ja" : "en";
  d.dataset.lang = l; d.lang = l;
  if (s === "night") d.dataset.scheme = "night";
  // a pixel-art dot (--u) as a whole number of screen pixels: on a 2.625x phone 1px would be
  // 2.625 pixels and equal lines would come out 2 and 3 pixels thick (TRACKMENTO's setDotUnit)
  (function dot() {
    var r = window.devicePixelRatio || 1;
    d.style.setProperty("--u", Math.max(1, Math.round(r)) / r + "px");
    try { matchMedia("(resolution: " + r + "dppx)").addEventListener("change", dot, { once: true }); } catch (e) {}
  })();
  // the body font from Google Fonts, added here so it does not block the first paint (see head.html)
  var f = document.createElement("link");
  f.rel = "stylesheet";
  f.href = "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+JP:wght@400;700&display=swap";
  document.head.appendChild(f);
})();

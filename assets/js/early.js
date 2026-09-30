/* Language and color scheme are applied before the first paint, so switching never reloads the page. */
(function () {
  var d = document.documentElement, l, s;
  try { l = localStorage.getItem("tbk-lang"); s = localStorage.getItem("tbk-scheme"); } catch (e) {}
  if (l !== "ja" && l !== "en") l = /^ja\b/i.test(navigator.language || "ja") ? "ja" : "en";
  d.dataset.lang = l; d.lang = l;
  if (s === "night") d.dataset.scheme = "night";
  // the body font from Google Fonts, added here so it does not block the first paint (see head.html)
  var f = document.createElement("link");
  f.rel = "stylesheet";
  f.href = "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+JP:wght@400;700&display=swap";
  document.head.appendChild(f);
})();

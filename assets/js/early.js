/* Language and color scheme are applied before the first paint, so switching never reloads the page. */
(function () {
  var d = document.documentElement, l, s;
  try { l = localStorage.getItem("tbk-lang"); s = localStorage.getItem("tbk-scheme"); } catch (e) {}
  if (l !== "ja" && l !== "en") l = /^ja\b/i.test(navigator.language || "ja") ? "ja" : "en";
  d.dataset.lang = l; d.lang = l;
  if (s === "night") d.dataset.scheme = "night";
})();

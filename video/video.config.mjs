// 撮るサイトの設定。場面（scenes/*.mjs）はここの値を k.config で読める。
export default {
  // 開くサイト。環境変数 BASE_URL で差し替えられる（手元で配るときの形は README）
  baseUrl: process.env.BASE_URL || "https://tobokegao.github.io",

  // ページの読み込みが済んだと見なす条件（ページの中で動く関数）。画像まで待つなら img.complete も見る
  ready: () => document.readyState === "complete" && [...document.images].every((i) => i.complete),

  // 撮るあいだだけ足す見た目（スクロールバーを隠す、など）
  css: "html { scrollbar-width: none; } ::-webkit-scrollbar { display: none; }",

  // 画面の大きさ。PC は 16:9 を倍率 2 で撮る（Remotion のカメラが 2 倍まで寄ってもぼやけない）
  pc: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 },
  // スマホの場面（場面に phone: true）
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },

  // 縦 9:16 の動画の頭に出す名前と、窓の題名バーに出す文字
  brand: "Tobokegao",
  windowLabel: "tobokegao.github.io",
};

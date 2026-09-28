// 場面の見本（tobokegao.github.io のトップ）。1 場面 = 1 本の動画。
// 形: { id, what, title?, url?, phone?, ctx?, setup?(k), run(k) }
// - url は video.config.mjs の baseUrl からの道筋（省くと "/"。null で何も開かない）
// - setup は撮る前の準備（最初の構図・カーソルの位置）。run から先がコマになる
// - title は縦 9:16 の動画の頭に出る見出し

export default [
  {
    id: "top",
    what: "トップページを下へ送って、記事の一覧に寄り、All posts を押して記事の一覧のページへ移る",
    title: "トップから記事の一覧へ",
    url: "/",
    async setup(k) {
      k.wide(0);
      await k.park(900, 500);
    },
    async run(k) {
      await k.hold(1.2);
      await k.look(["#content h1"], 0.8);                           // ページの題に寄る
      await k.hold(1.0);
      await k.scrollEase(await k.yFor("#content h1 ~ ul, .span9 ul", 160), 1.2);
      await k.look([".span9 ul"], 0.6);                             // 記事の一覧に寄る
      await k.hold(1.2);
      k.wide(0.6);
      await k.pressNav('a[href$="/post/"]');                        // 上のメニューの All posts
      await k.hold(1.5);
    },
  },
  {
    id: "top-sp",
    what: "スマホでトップを開き、指で下へ送る",
    title: "スマホで見たトップ",
    phone: true,
    async setup(k) {
      await k.park(300, 600);
    },
    async run(k) {
      await k.hold(1.0);
      await k.swipe(500, 1.2);
      await k.hold(1.0);
      await k.swipe(-500, 0.8);
      await k.hold(0.8);
    },
  },
];

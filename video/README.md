# site-video-kit

サイトの動きを **1 コマずつ撮って**、カメラの寄り・カーソル・押した合図を付けた短い動画にする道具。
TRACKMENTO（musicgrid-local の `promo/`）で X 向けの短い動画を作っていた仕組みを、ほかのサイトでも使えるように取り出したもの（2026-09-29）。
TRACKMENTO 側とはつながっていない（写して分けた）。こちらを直しても向こうには伝わらない。

## 流れ

```
scenes/*.mjs（台本）
  │  node capture.mjs        … Playwright でページを開き、時計を止めて 1/30 秒ずつ撮る
  ▼
public/clips/<id>/take.mp4 + events.json（カメラ・カーソル・押した印）
  │  node render.mjs         … Remotion（src/Clip.tsx）が寄り・カーソル・輪を描いて書き出す
  ▼
out/wide/<id>.mp4（1280x720）  /  out/tall/<id>.mp4（1080x1920、--tall）
```

## はじめて動かす

Node 20 以上。

```bash
git fetch && git switch video-kit
cd video            # このフォルダ
npm install
npx playwright install chromium
node capture.mjs --list     # 場面の一覧
node capture.mjs            # 全部撮る（scenes/example.mjs の見本は本番の tobokegao.github.io を開く）
node render.mjs             # 横 16:9 で書き出す
node render.mjs all --tall  # 縦 9:16
node render.mjs top --gif   # GIF も
```

公開前の変更を撮るときは、手元でサイトを配ってから `BASE_URL` を向ける。
Hugo の元ファイルがある所なら `hugo server` → `BASE_URL=http://localhost:1313 node capture.mjs`。
このリポジトリ（書き出し済み）をそのまま配るなら、リポジトリの直下で `npx serve -l 5000 .` → `BASE_URL=http://localhost:5000 node capture.mjs`
（ページの中のリンクが `https://tobokegao.github.io/...` の絶対 URL だと、押した先は本番に飛ぶ）。

`public/clips/`・`out/`・`node_modules/` は `.gitignore` に入れてある。

### GitHub Pages のリポジトリに置く場合

tobokegao.github.io のリポジトリは **Hugo の書き出し済みのサイトそのもの**で、GitHub Pages が main の直下を公開している
（2026-09-29 時点。build_type は legacy ＝ Jekyll を通す）。
今は `video-kit` ブランチにだけ置いてあり、ブランチは公開されないので、サイトには出ていない。

**main に入れると `/video/` 以下も公開される**（README が HTML になって見えるなど）。main に入れるなら、先にリポジトリの直下に
`_config.yml` を置いて `exclude: [video]` を書く。または、この道具だけ別のリポジトリに移す。

## 設定（video.config.mjs）

- `baseUrl` … 開くサイト。`BASE_URL` で差し替えられる
- `ready` … 読み込みが済んだと見なす条件（ページの中で動く関数）。ページが移るたびにこれを待つ
- `css` … 撮るあいだだけ足す見た目（スクロールバーを隠すなど）
- `pc` / `phone` … 画面の大きさ。PC は 1280x720 を倍率 2 で撮る（2 倍まで寄ってもぼやけない）
- `brand` / `windowLabel` … 縦の動画の頭の名前と、窓の題名バーの字

## 台本（scenes/*.mjs）

1 ファイルに場面の配列を `export default` する。1 場面 = 1 本の動画。ファイルはいくつに分けてもよい（id は全体で重ならないこと）。

```js
export default [
  {
    id: "top",                 // 出力のファイル名になる
    what: "何を見せる場面か",   // --list に出る
    title: "縦の動画の見出し",  // 任意
    url: "/",                  // baseUrl からの道筋。省くと "/"
    phone: false,              // true でスマホの画面で撮る
    async setup(k) {           // 撮る前の準備（ここはコマにならない）
      k.wide(0);               // 最初の構図
      await k.park(900, 500);  // カーソルの最初の位置
    },
    async run(k) {             // ここから先がコマになる
      await k.hold(1.0);
      await k.look(["h1"], 0.8);
      await k.pressNav('a[href$="/post/"]');
      await k.hold(1.5);
    },
  },
];
```

### k の道具

撮る:
- `hold(秒)` … その秒数ぶん撮る
- `until(fn, label)` … 撮らずに待つ（fn が真になるまで。時計は進める）
- `live(fn, {min, timeout})` … 撮りながら待つ（読み込みの様子を見せたいとき）

カメラ（印を残すだけ。寄るのは Remotion）:
- `look([セレクタ…], 秒)` … 要素をまとめた四角に寄る
- `lookPart(セレクタ, fx, fy, fw, fh, 秒)` … 要素の一部に寄る（割合で指定）
- `lookRect({x, y, w, h}, 秒)` … 画面の四角に寄る
- `wide(秒)` … 引いて画面ぜんぶ

カーソル・マウス:
- `park(x, y)` … カーソルをその場に置く
- `glide(セレクタ, 秒)` … 要素まで運ぶ
- `press(セレクタ)` … 運んで押す（押した所に赤い輪）
- `pressNav(セレクタ)` … 押してページが移るのを待つ（リンク）
- `drag(from, to, 秒)` … 掴んで運ぶ（to は要素か `{dx, dy}`）
- `dragThumb(セレクタ, dx, 秒, つまみの幅)` … スライダーを動かす
- `hideCursor()` … カーソルを消す（キーボードの場面）

スマホ:
- `tap(セレクタ)` / `tapAt(x, y)` … 指で押す（指の丸と輪）
- `swipe(dy, 秒)` … 指で送る
- `pinch(cx, cy, d0, d1, 秒)` … 2 本指で広げる・すぼめる

キーボード:
- `key("Control+Z")` … 押す（画面の下にキーの絵が出る）
- `type(セレクタ, 文字, 1 字の秒)` … 1 字ずつ打つ

ページ:
- `scrollEase(y, 秒)` … なめらかに送る。行き先は `yFor(セレクタ, 画面の上からの位置)` で出す
- `scrollTo(セレクタ, y)` … 撮る前に送る（撮りながら送るとカメラと二重に動く）
- `goto(url)` … 別のページを開く
- `stage(css)` … 見た目を足す
- `stepVideo(セレクタ)` … ページの `<video>` をコマ送りで撮る
- `k.page` … Playwright のページそのもの

## 気をつけること（TRACKMENTO で一度つまずいたこと）

- **時計は止まっている**。`setTimeout` もアニメーションも、`hold` や `until` で時計を進めない限り動かない。
  `page.waitForTimeout` で待っても何も進まないので、`until` を使う
- **ページの `<video>` は時計に従わない**。そのまま撮ると早回しに見える。`stepVideo()` でコマ送りにする
- **スマホの縮小表示**（幅の広いページを縮めて見せる）では CSS の座標と画面の座標が違う。`look` と `tap` は倍率を掛けてあるが、
  自分で座標を計算するときは `visualViewport.scale` を掛ける
- **押したあとにボタンが動いたら矢印もついて行く**（`press` がする）。ページが移るときは `pressNav` を使う
  （移った先で同じセレクタが別の要素に当たり、矢印がそこへ飛ぶため）
- **マウスを乗せたままだと `:hover` が残る**。キーボードの場面は `hideCursor()` で外へ出す
- 実在の人の顔・他人の作品が映るページは、載せる前に扱いを考える（TRACKMENTO では動画に実在のジャケットを映さないため、架空の絵に差し替えていた）

## 仕組みを直すとき

- 撮り方: `kit.mjs`（コマの進め方・印の種類）
- 描き方: `src/Clip.tsx`（寄り方の上限 `MAX_ZOOM`・余白 `PAD`・つなぎ `LOOP`・色 `COLOR`・字 `SANS`）
- 印の種類（`cam` / `cursor` / `down` / `hide` / `key` / `touches`）を足すときは、`kit.mjs` と `src/Clip.tsx` の `Ev` の型を両方直す
- 見た目の確認は `npm run studio`（Remotion Studio）でもできる

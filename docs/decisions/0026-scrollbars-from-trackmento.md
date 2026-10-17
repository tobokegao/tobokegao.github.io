# 0026 スクロールバーはTRACKMENTOの作りを流用する

- **日付**: 2026-10-17
- **決めたこと**: サイト全体のスクロールバーを、TRACKMENTO（tobokegao/trackmento-public の `frontend/index.html`、`docs/ui.md`）と同じ作りで描く。
  - WebKit系（Chrome、Edge、Safari）は `::-webkit-scrollbar` で描く。つまみの外枠と面取りは5×5の絵を `border-image` で9つに割って伸ばし、握りの縞は真ん中に置く1枚の絵。両端に矢印のボタン、縦と横が交わる角は無地。指で操作する画面では24pxに太くする。
  - 絵の1マスは `--u`（端末の画素のちょうど整数倍。`early.js` が画素密度から入れる）。
  - Firefoxは疑似要素がないので、`@supports not selector(::-webkit-scrollbar)` の中で色だけ寄せる。
  - 色はサイトのものに差し替える（昼は淡い灰青、夜はグラファイト）。サイトは下から照らされているので、面取りと縞の明暗はTRACKMENTOと上下を逆にし、上と左を暗く、下と右を明るくする。
- **理由**: ブラウザの既定のスクロールバーが、DOSの画面の見た目に合っていなかった。TRACKMENTOで、画素へのずれ（縞の太さのばらつき、枠のずれ）を直してきた作りがすでにある。
- **守り方**:
  - `scrollbar-color` / `scrollbar-width` を `@supports` の外に書かない（Chromeが `::-webkit-scrollbar` を丸ごと無視する）。
  - スクロールバーの部品に、外へ出る `box-shadow` を使わない（WebKitが描き直さず、線が溝に残る）。
  - 色を変えるときは、絵（`--sb-frame`、`--sb-grip-v/h`、`--sb-arrow-*`）の中の色も昼と夜の両方で直す（SVGの中からはCSS変数が読めない）。
  - TRACKMENTOのスマホ用の自前のスクロールバー（`attachTouchScrollbar`）は、まだ移していない。

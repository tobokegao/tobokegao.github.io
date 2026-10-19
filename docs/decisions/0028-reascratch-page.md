# 0028 ReaScratchの紹介ページは、このサイトの中に置く

- **日付**: 2026-10-08
- **決めたこと**: ReaScratch（REAPERのスクラッチ用キット）の紹介とダウンロードのページを、このサイトの`content/reascratch.md`（`/reascratch/`）に置く。配布物のzipは、別のリポジトリ`tobokegao/ReaScratch`のReleasesに置き、ページからはそこへリンクする。公開の日までは`draft: true`にして、手元のブランチ`reascratch`だけで準備する。
- **理由**: リポジトリ側のGitHub Pagesにすると、DOSの見た目、日本語と英語の切り替え、昼と夜の配色を、別にもう一度作ることになる。このサイトの中なら、今の窓と決まりがそのまま使え、`check.py`の点検も通る。
- **守り方**:
  - `tobokegao/ReaScratch`ではGitHub Pagesを有効にしない（`/ReaScratch/`が同じドメインにでき、どちらのページか紛らわしくなる）。
  - 公開するまで、ブランチ`reascratch`をpushしない（このリポジトリは公開されているので、pushするだけで中身が見える）。
  - 2026-10-19に公開した（キットは10/17のバージョン0.7.2）。REAPERフォーラムには投稿しないことにしたので、試した結果の送り先はGitHubのIssuesだけにする。デモ動画はXのポストにリンクする。ReaScratch側にURLを知らせる（キットの画面の文字を直すため）。

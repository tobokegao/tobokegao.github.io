# tobokegao.github.io

とぼけがお（Tobokegao）のオフィシャルサイト。Hugo 製、DOS 風デザイン。

## 構成

- `content/` — プロフィールと記事。日英は同じファイルに `{{< lang ja >}}` / `{{< lang en >}}` で書く
- `data/strings.toml` — 画面の文言（日英）。JP/EN ボタンは表示を切り替えるだけでページは読み直さない
- `data/items.json` — YouTube / SoundCloud / niconico / Bandcamp / Apple Music から自動取得した全項目
- `data/releases.json` — 上記をプラットフォーム横断でまとめたリリース一覧（動画で出した曲も含む）
- `data/overrides.json` — 動画を曲として数える／数えない、の手動指定
- `data/timeline.json` — 活動ログ（手書き分）
- `data/autolog.json` — 新しいリリースから自動で作るログ
- `data/news_candidates.json` / `data/news.json` — ニュース候補と、Claude が選んだニュース
- `data/news_sources.json` — Google アラートの RSS URL
- `fonts-src/` — ドットフォントの元（JF Dot M+ 12、Galmuri14、東雲 14）。ビルド時に使う字だけ切り出す

## スクリプト

- `scripts/fetch_feeds.py` — リリースと動画を取得
- `scripts/collect_news.py` — Bluesky、Google アラート、LivePocket、MusicBrainz、動画説明文からニュース候補を集める
- `scripts/classify_news.py` — 候補を Claude で分類して日英のログにする（`ANTHROPIC_API_KEY` が必要）
- `scripts/subset_fonts.py` — ドットフォントをサイトで使う字だけに切り出す
- `scripts/pixel_icons.py` — 16x16 のドット絵アイコンを生成（図を直して再実行）

## 更新の流れ（半自動）

リリース・動画・ニュースは、取得したいときだけ実行する。どちらかで:

- GitHub の Actions → Update releases and news → Run workflow。結果はプルリクエストで届くので、
  `data/releases.json` と `data/news.json` を確認してマージすれば公開、閉じれば破棄
- ローカルで `fetch_feeds.py` → `collect_news.py` → `classify_news.py` を実行し、`data/` の差分を
  確認してからコミット

main への push で `.github/workflows/site.yml` がビルドして GitHub Pages に公開する。

## ローカル

```sh
pip install fonttools brotli anthropic
python scripts/fetch_feeds.py
python scripts/subset_fonts.py
hugo server                     # http://localhost:1313/
```

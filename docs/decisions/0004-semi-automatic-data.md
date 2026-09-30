# 0004 データの更新は半自動

- **日付**: 2026-09-28
- **決めたこと**: リリース、動画、ニュースのデータは、頼まれたときか、手動で動かす GitHub Actions のワークフロー（PR を作る）でだけ更新する。定期実行はしない。
- **理由**: 定期的に自動で動かす仕組みにすると、費用がかさみそうだったため。
- **守り方**: YouTube と SoundCloud は全件を取る（`fetch_feeds.py` の `fetch_youtube_all` と `fetch_soundcloud_all`）。YouTube の曲の動画と SoundCloud の曲は、すべてリリースとして載せる。

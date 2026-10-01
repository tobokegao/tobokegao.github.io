# 0004 データの更新は半自動

- **日付**: 2026-09-28
- **決めたこと**: リリース、動画、ニュースのデータは、頼まれたときか、手動で動かすGitHub Actionsのワークフロー（PRを作る）でだけ更新する。定期実行はしない。
- **理由**: 定期的に自動で動かす仕組みにすると、費用がかさみそうだったため。
- **守り方**: YouTubeとSoundCloudは全件を取る（`fetch_feeds.py`の`fetch_youtube_all`と`fetch_soundcloud_all`）。YouTubeの曲の動画とSoundCloudの曲は、すべてリリースとして載せる。

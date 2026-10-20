# 0034 プレビューにだけ出すものは、previewリポジトリの別の枝に置く

- **日付**: 2026-10-21
- **決めたこと**: 本番には出さずプレビューでだけ見せるもの（いまはWeb版ReaScratch、`/reascratch/web/`）は、`tobokegao/tbk-preview`の枝`extras`に置く。previewのビルド（`build.yml`の`part: all`）は、点検のあとに`extras`の中身をできあがったサイトに重ねる。
- **理由**: 作業用の枝をpreviewの`main`にpushすると、次の`git push preview renewal:main`が「push先のほうが先に進んでいる」と断られ、強制pushで消すことになる。別の枝なら`main`の履歴に入らないので、いつものpushがそのまま通る。サイトの点検（`check.py`）は、ほかで作ったページを相手にしないよう、重ねる前に回す。
- **守り方**:
  - `extras`を更新したあとは、`gh workflow run site.yml -R tobokegao/tbk-preview`で組み立て直す（`extras`へのpushでは動かない）。
  - previewは公開のリポジトリなので、`extras`に置いたものも誰でも見られる。秘密の語（イベント名、作業フォルダー名など）がないか確かめてから置く。
  - 本番に出すときは、`extras`から外してこのリポジトリの`static/`か`content/`に入れる。

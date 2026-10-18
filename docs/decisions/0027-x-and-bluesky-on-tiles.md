# 0027 XとBlueskyのアイコンを、四角い色地に白抜きにする

- **日付**: 2026-10-18
- **決めたこと**: ホームのリンクのドット絵アイコン（`layouts/_partials/icons-hd/`）で、XとBlueskyを、InstagramやSoundCloudと同じ「四角い色地に白抜き」（`scripts/hd_icons.py`の`kind="tile"`）にする。
  - Xは公式の鳥の形を、ほかの白抜きと同じ4〜20の枠に縮めて使う（`icons-src/hand/twitter-tile.svg`）。
  - Blueskyの蝶は升目に直接描く（`icons-src/hand/bluesky_grid.py`）。上の羽のあいだにV字、上と下の羽のあいだに2マスの切れ込み、下の羽のあいだにすき間を入れる。
- **理由**: 名刺の裏にSNSのアイコンを並べたとき、この2つだけが色の形のままで、四角い地のアイコンの列の中で浮いていた。名刺とサイトで同じアイコンを使うため、サイトの側をそろえた。蝶は公式の形を縮めると羽がくっついて塊に見えたので、升目に描き直した。
- **守り方**:
  - 蝶を直すときは`bluesky_grid.py`を直して回し、続けて`hd_icons.py --only bluesky`を回す（升目のファイル`icons-src/hd/bluesky.txt`は、このスクリプトが書く）。
  - 白抜きの形は、まわりに4マスずつ地を残す（ほかのアイコンと大きさをそろえる）。

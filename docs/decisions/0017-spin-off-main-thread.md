# 0017 About の人形は、ページを組み立てているあいだも回す

- **日付**: 2026-10-01
- **決めたこと**:
  - About の人形（`icons/tab-about.html`、`scripts/pixel_icons.py` の `to_spin_svg`）は、1 つの SVG の中の 10 個の `<g>` ではなく、1 コマ 1 つの `<svg>` を `<span class="px px--spin">` に重ねて置く。
  - 回す CSS は `visibility` ではなく `opacity` を切り替え、各コマに `will-change: opacity` を付ける。
  - 回り始めは、指が触れた時点で `site.js` が付ける `is-held`（離れて 1.5 秒残る）か、`:hover` / `:focus-visible`。
- **理由**:
  - ページを移るとき、新しい中身を組み立てるあいだはブラウザの手がふさがる。`visibility` の切り替えや、SVG の中の要素のアニメーションは、その手で動かすので、そのあいだ止まって見えた（とぼけがおのスマホで、どのページへ移るときも一瞬止まった）。
  - HTML の要素ごとの `opacity` のアニメーションは、`will-change` があると別の手（コンポジタ）で進むので、組み立て中も止まりにくい。コマは 18px の絵が 10 枚なので、重さは気にならない。
- **守り方**:
  - `pixel_icons.py` を動かすと `tab-about.html` が作り直される。構造を変えるときは、台本と `site.css` の `.px--spin` を一緒に直す。
  - 「視差効果を減らす」の設定の人には、1 コマ目で止めたまま出す。

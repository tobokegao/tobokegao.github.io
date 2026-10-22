# 0040 トップのリンクの下に、TRACKMENTOとReaScratchのアイコンを別の列で置く

- **日付**: 2026-10-22
- **決めたこと**: トップのREADME.TXTの窓で、SNSなどのリンクの列の下に溝の線を引き、TRACKMENTO（trackmento.com）とReaScratch（`/reascratch/`）のアイコンを別の列に置く。並びは`hugo.toml`の`params.projects`。アイコンはそれぞれのファビコンをもとに、リンクのアイコンと同じ`hd_icons.py`で作る（ReaScratchはレコード、TRACKMENTOは色見本の四角。四角の色ごとに塗る`swatch`の種類を足した）。
- **理由**:
  - よそのサービスへのリンクと、自分の作ったものを分けて見せたい。
  - 同じ作りのアイコンにすると、窓の中でなじむ。
- **守り方**:
  - 作ったものを足すときは`params.projects`に1つ足し、絵は`icons-src/hand/<名前>_grid.py`で升目に描いてから`hd_icons.py --only <名前>`を回す。
  - TRACKMENTOのアイコンは、押すとまず小さな窓（TRACKMENTO.URL）を開き、サイトの説明と「サイトを開く」のボタンを出す（2026-10-22、名前だけでは何のサイトか分かりにくいため）。窓は`<dialog>`で、外を押すか[■]かEscで閉じる。スクリプトがないときは、そのままサイトへ移る。窓を出すものは`params.projects`に`about`（`data/strings.toml`の名前）と`file`（窓の題）を書く。
  - 夜の線は、ほかのアイコンと同じく形の外側に引く（内側に引くと小さく見えた）。

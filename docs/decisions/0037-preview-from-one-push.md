# 0037 確認用ページは、このリポジトリに`renewal`をpushするだけで組み立て直す

- **日付**: 2026-10-22
- **決めたこと**:
  - `tobokegao/tbk-preview`には、ワークフローのファイル（`.github/workflows/deploy.yml`）しか置かない。その元は`.github/preview-repo/deploy.yml`。サイトのソースは、このリポジトリから組み立てる（0022のmemoと同じ形）。
  - このリポジトリに`renewal`をpushすると、`preview.yml`が同じコミットでtbk-previewの組み立てを始める（シークレット`PREVIEW_DISPATCH_TOKEN`）。`git push preview renewal:main`は使わない。
  - プレビューにだけ出すものは、このリポジトリの`preview-extras/`に、サイトと同じ並びで置く。previewの組み立て（`build.yml`の`part: all`）は、点検のあとにこれを重ねる。0034の枝`extras`は使わない。
  - 公開の場所は、GitHub Pagesのまま変えない。
- **理由**:
  - pushする先が2つあり、previewの`main`に毎日の取り込み（0030）のコミットが積まれるため、手元とpreviewのどちらが先か気にする必要があった。extrasの枝も、更新のたびに手で組み立て直していた。
  - Cloudflare Workersに移す案も比べた。確認用ページは枝ごとに自動で作られるが、名刺のQRコードやよそのサイトが読むバナーのため`tobokegao.github.io`を残す必要があり、公開にNode.js（wrangler）とCloudflareのトークンも増える。そこでGitHubのまま、pushの先を1つにした。
  - previewのソースをこのリポジトリから読むので、previewの`main`は増えず、pushが断られることもない。
  - `preview-extras/`はこのリポジトリに入るが、previewも公開なので、見られる範囲は前と変わらない。
- **守り方**:
  - `PREVIEW_DISPATCH_TOKEN`は、`tobokegao/tbk-preview`のActionsを動かす権限だけを持つトークンにする（fine-grained、そのリポジトリだけ、Actions: Read and write）。期限が切れたら作り直す。ないときは警告を出して止まる。
  - tbk-previewは`build.yml`を`renewal`の枝から読む。作業の枝の名前を変えるときは、`.github/preview-repo/deploy.yml`と`preview.yml`も直す。
  - `.github/preview-repo/deploy.yml`を変えたら、tbk-previewの`deploy.yml`も同じにする。
  - `preview-extras/`に置く前に、秘密の語（イベント名、作業フォルダー名など）がないか確かめる。本番に出すときは、`preview-extras/`から`static/`か`content/`に移す。
  - 手で組み立て直すときは`gh workflow run deploy.yml -R tobokegao/tbk-preview`。

# 0022 /memo/は別のリポジトリ（tobokegao/memo）で公開する

- **日付**: 2026-10-15
- **決めたこと**: `/memo/`（0021）は、`tobokegao/memo`のGitHub Pagesで公開する。サイトのリポジトリは`/memo/`を除いた残りを公開する。ソースとデータはサイトのリポジトリに置いたままにする。
  - 組み立ては`.github/workflows/build.yml`の1か所にまとめた。サイトの`site.yml`と、`tobokegao/memo`の`deploy.yml`の両方がこれを呼ぶ。どちらも同じソースを組み立て、`part`で自分の受け持ち（`site`か`memo`）だけを残す。確認用ページ（tbk-preview）は全部を残す（`all`）。
  - サイトを公開したら、`site.yml`が同じコミットで`tobokegao/memo`の組み立てを始める（シークレット`MEMO_DISPATCH_TOKEN`）。
  - `tobokegao/memo`にはワークフローのファイルしか置かない。その元は`.github/memo-repo/deploy.yml`。
  - 検索の索引は`/memo/pagefind/`に作る（`pagefind.yml`の`output_subdir`）。
- **理由**:
  - GitHub Pagesの公開サイズの上限（1GB）はリポジトリごと。全部の年のメモはページと索引で約500MBあり、サイトと合わせると上限に近い。リポジトリを分ければ、それぞれに余裕ができる。
  - 年ごとにリポジトリを分ける案はやめた。話題のページは年をまたぎ、検索も1つの索引のほうがよいため。画像と動画は、分けてもGitHubには入りきらない。そこで、置き直さずにXのサムネイルを読む（0021）。
  - `/memo/`のページは、サイトの指紋付きのCSSとJS（`/css/…`）を使う。サイトだけが新しくなると、メモのページの見た目が崩れる。だから、サイトを出すたびに同じコミットでメモも出し直す。
  - メモのページをGitにコミットして送る方法は、とらなかった。CSSが変わるたびに全ページが変わり、リポジトリが1回に数百MBずつふくらむため。Actionsの成果物として出せば、履歴は残らない。
- **守り方**:
  - `MEMO_DISPATCH_TOKEN`は、`tobokegao/memo`のActionsを動かす権限だけを持つトークンにする（fine-grained、そのリポジトリだけ、Actions: Read and write）。期限が切れたら作り直す。ないときは警告を出して止まる（サイトの公開は止めない）。
  - 2つの公開のあいだの数分は、メモのページの見た目が崩れることがある。
  - `tobokegao/memo`の`deploy.yml`を変えたら、`.github/memo-repo/deploy.yml`も同じにする。

# 0038 メモの検索の索引は、Node.jsを通さずPagefindの配布物で作る

- **日付**: 2026-10-22
- **決めたこと**: 組み立て（`build.yml`）で、Pagefindを`npx`ではなく、公式の配布物（`pagefind_extended`のLinux版）を取ってきて動かす。版（`PAGEFIND_VERSION`）とハッシュ（`PAGEFIND_SHA256`）は`build.yml`に書く。
- **理由**:
  - Node.jsとnpmの部品を、組み立てに入れたくない。2026-10-21のNode.jsのセキュリティ更新のような話を、気にしなくてよくなる。これで組み立てにNode.jsを使うところがなくなる。
  - `npx pagefind`の中身は、`pagefind_extended`があればそれを選んで動かすだけだった（npmの`pagefind@1.3.0`の`lib/runner/bin.cjs`）。extendedは日本語を語に分けるので、同じ版のextendedを使えば索引は変わらない。
  - ハッシュは配布物の`.sha256`から読まずに書いておく。配布物と`.sha256`が両方差し替えられても、組み立てが止まる。
- **守り方**:
  - Pagefindの版を上げるときは、`PAGEFIND_VERSION`と`PAGEFIND_SHA256`を両方直す。ハッシュは、配布物を取ってきて手元で`sha256sum`で計算し、配布物の`.sha256`と同じか確かめる。
  - 検索のページが読む`/memo/pagefind/pagefind.js`も索引といっしょに作られるので、版を上げたら確認用ページで検索を試す。

---
title: チップチューンづくりのおすすめツール（2026年10月版）
title_en: Recommended Chiptune Tools (October 2026)
date: 2026-10-30
description: プラグイン、トラッカー、ハードウェア、ブラウザのソフト、サンプルパックまで、最新バージョンでまとめ直しました
description_en: A fresh roundup of chiptune plugins, trackers, hardware, browser tools, and sample packs, all updated with their latest versions.
---

{{< lang ja >}}
梅干茶漬けさんのブログ「あじたまのーと」の2021年の記事「[ピコピコ音楽の制作に役立つ音源10選](https://blog.ajitama-note.com/entry/2021/03/06/215656)」と、thetaさんの[ソフトウェアのページ](https://ss1.xrea.com/theta.s57.xrea.com/software/)をもとに、ほかのツールも足して、最新のバージョンに合わせてまとめ直しました。

## まずは無料のプラグインから

いつものDAWに入れて、ふつうの音源と同じように使えます。

- [**Magical 8bit Plug 2**](https://ymck.net/app/magical-8bit-plug)（YMCK）：ファミコン風の矩形波（メロディ向きのピコピコ音）、三角波（ベース向きの丸い音）、ノイズ（ドラム向きのザーッという音）が出せます。迷ったらまずこれ。無料、Windows・Mac（VST3・AU）
  <img src="/img/chiptune-tools/magical-8bit-plug-2.webp" alt="Magical 8bit Plug 2の画面" width="560" height="308" loading="lazy" />

- [**Magical FDS Plug**](https://ymck.net/app/magical-fds-plug/)（YMCK）：ファミコンディスクシステムの音源を再現したもの。2026年6月に出たばかり。無料、Windows（VST3）・Mac（VST3・AU）
  <img src="/img/chiptune-tools/magical-fds-plug.webp" alt="Magical FDS Plugの画面" width="560" height="309" loading="lazy" />

  - YMCKのシンセは、高い音を鳴らすとエイリアスノイズ（元の音にはない、ジリジリとした濁り）が出やすいので気をつけてみてください。

- [**New DoReFAMI**](https://ss1.xrea.com/theta.s57.xrea.com/software/#newdorefami)（theta）v1.7.1：ファミコンの音源を再現したもので、音づくりが細かくできます。無料、Windows 64bit（VST3）。BOOTHでサンプル曲付きのバージョン（500円）もあります
  <img src="/img/chiptune-tools/new-dorefami.webp" alt="New DoReFAMIの画面" width="560" height="302" loading="lazy" />

- [**Twin DoReFAMI**](https://ss1.xrea.com/theta.s57.xrea.com/software/#twindorefami)（theta）v1.0.1：短い波の形を自分で描いて、オリジナルの音色を作れる音源（GAMEBOYなどで使われた「波形メモリ音源」）を再現したもの。無料、Windows 64bit（VST3）。波形づくりには同じ作者の[DWMEditor](https://ss1.xrea.com/theta.s57.xrea.com/software/#dwmeditor)が使えます
  <img src="/img/chiptune-tools/twin-dorefami.webp" alt="Twin DoReFAMIの画面" width="560" height="350" loading="lazy" />

- [**Soraboy**](https://shadowsora211.itch.io/soraboy)（ShadowSora）v1.1.1：GAMEBOYの音源から着想したもの。無料（投げ銭可）、Windows 64bit・Mac（VST3）
  <img src="/img/chiptune-tools/soraboy.webp" alt="Soraboyの画面" width="560" height="420" loading="lazy" />

- [**C700**](https://github.com/osoumen/C700)（osoumen）ver20211031：スーパーファミコンの音源を再現したサンプラー。自分で用意した波形や音を読み込んで鳴らします。作った曲を、スーパーファミコンの音楽ファイル（.spc）に書き出すこともできます。無料、Windows（VST2）・Mac（VST2・AU）
  <img src="/img/chiptune-tools/c700.webp" alt="C700の画面" width="513" height="420" loading="lazy" />

## 音にかけるエフェクト

- [**Deltanizer**](https://ss1.xrea.com/theta.s57.xrea.com/software/#deltanizer)（theta）v2.0.0：自分で打ち込んだ音を、ファミコンのDPCM（ドラムや声に使われた、ザラザラした粗い音）の質感に変える。無料、Windows 64bit（VST3）
  <img src="/img/chiptune-tools/deltanizer.webp" alt="Deltanizerの画面" width="292" height="313" loading="lazy" />

- [**Interruptor**](https://ss1.xrea.com/theta.s57.xrea.com/software/#interruptor)（theta）v0.0.2：メロディのすき間に高速で効果音やドラムを挟み込む、昔のゲーム特有の鳴らし方（割り込み）を再現する。無料、Windows 64bit（VST3）
  <img src="/img/chiptune-tools/interruptor.webp" alt="Interruptorの画面" width="291" height="310" loading="lazy" />

- [**chipcrusher**](https://www.plogue.com/products/chipcrusher.html)（Plogue）：ファミコンの少しざらざらした声・ドラムの音や、スーパーファミコン独特の粗さとエコーなど、昔のゲーム機らしい音の質感をあとから加えられるエフェクト。39ドル
  <img src="/img/chiptune-tools/chipcrusher.webp" alt="chipcrusherの画面" width="560" height="189" loading="lazy" />

## トラッカー・専用ソフト（PICO-8とRenoise以外は無料）

ゲーム機の音源の制限どおりに打ち込めるので、「本物っぽさ」が出やすい方法です。

- [**FamiStudio**](https://famistudio.org/) 4.5.3：ファミコン用。ピアノロールで打ち込めるので、トラッカーが初めてでもとっつきやすい。Windows・Mac・Linux
  <img src="/img/chiptune-tools/famistudio.webp" alt="FamiStudioの画面" width="560" height="245" loading="lazy" />

- [**KiraStudio**](https://kirastudio.org/) 1.1.2：FamiStudioと同じ作者（BleuBleu）が2026年に公開した新作ソフト。ピアノロールで打ち込めて、ファミコン、GAMEBOY、ヤマハのFM音源などが使えます。実機の音の正確さよりも、作りやすさを大事にしているそうです。Windows版は無料。Mac・iPhone・iPad・Android版もあります
  <img src="/img/chiptune-tools/kirastudio.webp" alt="KiraStudioの画面" width="560" height="294" loading="lazy" />

- [**Dn-FamiTracker**](https://github.com/Dn-Programming-Core-Management/Dn-FamiTracker) Dn0.5.3：ファミコン用のトラッカー。FamiTrackerの流れをくむバージョン。Windowsのみ
  <img src="/img/chiptune-tools/dn-famitracker.webp" alt="Dn-FamiTrackerの画面" width="560" height="316" loading="lazy" />

- [**Furnace**](https://github.com/tildearrow/furnace) 0.6.8.3：ファミコン、GAMEBOY、メガドライブなど、たくさんの音源に対応したトラッカー。Windows・Mac・Linux
  <img src="/img/chiptune-tools/furnace.webp" alt="Furnaceの画面" width="560" height="350" loading="lazy" />

- [**OpenMPT**](https://openmpt.org/) 1.32.11.00：特定のゲーム機に縛られない、昔からあるトラッカー。Windows
  <img src="/img/chiptune-tools/openmpt.webp" alt="OpenMPTの画面" width="300" height="202" loading="lazy" />

- [**Renoise**](https://www.renoise.com/) 3.5.4：録音した音（サンプル）を使った曲づくりに強い、DAWのように使えるトラッカー。音色や効果を追加する機能（VSTなどのプラグイン）も使えます。76ユーロ、Windows・Mac・Linux
  <img src="/img/chiptune-tools/renoise.webp" alt="Renoiseの画面" width="560" height="397" loading="lazy" />

- [**PICO-8**](https://www.lexaloffle.com/pico-8.php) v0.2.7：レトロなドット絵ゲームをまるごと作れる「架空のゲーム機」ソフトです。ソフトの中に、チップチューンを作るための音楽・効果音エディターがあらかじめ入っています。15ドル、Windows・Mac・Linux・Raspberry Pi
  <img src="/img/chiptune-tools/pico-8.webp" alt="PICO-8の画面" width="560" height="242" loading="lazy" />

- [**ピストンコラージュ**](https://pxtone.org/downloads/) ver.0.9.4.56：自分で描いた波形や、読み込んだWAVに音程を付けて並べていく作曲ソフト。単体で曲が作れて、操作もかんたん。いまもこのソフトで作った曲を集めたコンピが出ています（2026年10月に出た「[PXTUNES 10th Anniversary: THE FUTURE OF PXTONE](https://pxtunes.bandcamp.com/album/pxtunes-10th-anniversary-the-future-of-pxtone)」など）。無料（Windows対応）
  <img src="/img/chiptune-tools/piston-collage.webp" alt="ピストンコラージュの画面" width="472" height="296" loading="lazy" />

## LSDjと、LSDjから生まれたトラッカー（無料）

GAMEBOY用のLSDjと、その操作感を受け継いでほかのゲーム機や機材向けに作られたトラッカーを集めました。LSDj、Risa、little-scaleさん作の4つは、ゲーム機の実機かエミュレーターで動きます（PocketTrackerとChipNomadは、スマホやパソコン、携帯ゲーム機で動くアプリです）。

- [**LSDj**](https://www.littlesounddj.com/) v9.4.2：GAMEBOYの実機（またはPCなどのエミュレーター）で動く音楽制作ソフト。2020年から無料でダウンロードできます（寄付も受け付けています）
  <img src="/img/chiptune-tools/lsdj.webp" alt="LSDjの画面" width="320" height="288" loading="lazy" />

- [**Risa**](https://risa.laamaa.fi/)（laamaa）：ファミコン用の作曲ソフト（トラッカー）。名作「LSDj」に近い感覚で画面に直接打ち込めます。本体の音に加えて、カセット側の拡張音源（MMC5）によるピコピコ音（矩形波）が2音多く使えます。エミュレーター「Mesen」や、実機カートリッジ「EverDrive N8 Pro」での動作が推奨されています
  <img src="/img/chiptune-tools/risa.webp" alt="Risaの画面" width="256" height="240" loading="lazy" />

- [**genmddj**](https://github.com/little-scale/genmddj)（little-scale）v0.25：メガドライブ用
  <img src="/img/chiptune-tools/genmddj.webp" alt="genmddjの画面" width="560" height="420" loading="lazy" />

- [**smsggdj**](https://github.com/little-scale/smsggdj)（little-scale）v0.48：セガ・マスターシステムとゲームギア用
  <img src="/img/chiptune-tools/smsggdj.webp" alt="smsggdjのカートリッジ" width="525" height="420" loading="lazy" />

- [**sndj**](https://github.com/little-scale/sndj)（little-scale）v0.15：スーパーファミコン用
  <img src="/img/chiptune-tools/sndj.webp" alt="sndjを実機で動かしているところ" width="560" height="420" loading="lazy" />

- [**alynxdj**](https://github.com/little-scale/alynxdj)（little-scale）v0.60：Atari Lynx用
  <img src="/img/chiptune-tools/alynxdj.webp" alt="alynxdjを実機で動かしているところ" width="560" height="315" loading="lazy" />

- [**PocketTracker**](https://conanizer.github.io/pockettracker/)（conanizer）v0.9.9.1：携帯型トラッカーの名機（LSDj、LGPT、M8）の使い心地を受け継いだ、Android用の作曲ソフト（トラッカー）です。自分で用意した音声素材（サンプル）やSF2（音色ファイル）を読み込めるため、音MADやYTPMVの素材を刻んで鳴らすのにも向いています（最大8トラック）。スマホでも、ボタン付きのAndroid携帯ゲーム機でも動きます
  <img src="/img/chiptune-tools/pockettracker.webp" alt="PocketTrackerの画面" width="560" height="294" loading="lazy" />

- [**ChipNomad**](https://chipnomad.org/)（Megus）v1.0.5：LSDjや人気の携帯型機「M8」に影響を受けたトラッカー。いまはAY-3-8910（MSXなどに載っていた音源）のみに対応。Windows・macOS・Linux・Android、携帯ゲーム機（RG35XX、Miyoo）で動きます
  <img src="/img/chiptune-tools/chipnomad.webp" alt="ChipNomadの画面" width="525" height="420" loading="lazy" />

## M8（ハードウェアのトラッカー）

GAMEBOYのLSDjに影響を受けた、持ち運べるトラッカー。チップチューン向けの音源のほか、FM音源やサンプラーも入っています。

- [**M8 Tracker Model:02**](https://dirtywave.com/)：本体。699ドル（Dirtywave公式ストア）
  <img src="/img/chiptune-tools/m8.webp" alt="M8 Tracker Model:02の画面" width="560" height="344" loading="lazy" />

- [**M8 Headless**](https://github.com/Dirtywave/M8HeadlessFirmware)：「Teensy 4.1」という市販の小さな基板に書き込み、パソコンにつないで使う無料版。画面と操作はパソコン側のソフト（m8cなど）で行います
  <img src="/img/chiptune-tools/m8gd.webp" alt="M8 Headlessをm8gdで表示した画面" width="560" height="315" loading="lazy" />

  - パソコン側の表示ソフトは、[**m8gd**](https://github.com/octoocto/m8gd)（無料、Windows・Mac・Linux）がおすすめです。M8の画面を3Dの本体のような見た目で表示できます（自分も使っています）。

- [**M8 Music Tracker**](https://apps.apple.com/jp/app/m8-music-tracker/id6806721202)（iPhone・iPad）1.2.2：本体の機能をそのまま再現したアプリ版です（2026年9月リリース／App Storeで5,000円）。曲データは実機本体と相互にやりとりできます
  <img src="/img/chiptune-tools/m8-music-tracker.webp" alt="M8 Music Trackerの画面" width="560" height="420" loading="lazy" />

## picoTracker（ハードウェアのトラッカー）

- [**picoTracker**](https://xiphonics.com/)（Xiphonics）v2.4.0：名作トラッカー「LGPT」を小さなマイコン基板（Raspberry Pi Pico）に移植し、単体で動くようにしたハードウェアです。8トラックで、サンプラーやFM音源などが入っています。組み立てキット（基板と画面）は99ドル、完成品の「picoTracker Advance」は449ドル（公式ストア）。ソフトは[GitHub](https://github.com/xiphonics/picoTracker)で公開されています
  <img src="/img/chiptune-tools/picotracker.webp" alt="picoTrackerの画面" width="560" height="373" loading="lazy" />

## ブラウザで使えるソフト（無料）

インストールなしで、ブラウザを開くだけで作れます。曲はURLに保存されるので、URLを送るだけで共有できます。WAVやMIDIへの書き出しもできます。

- [**BeepBox**](https://www.beepbox.co/) 4.2.2：画面のマス目に音を置いていくだけで曲が作れる、いちばんシンプルな作曲ソフト。オフライン版もあります
  <img src="/img/chiptune-tools/beepbox.webp" alt="BeepBoxの画面" width="515" height="420" loading="lazy" />

- [**JummBox**](https://jummb.us/) 2.6：BeepBoxをもとに、ピッチベンドや細かい音量の調整などを足した派生版
  <img src="/img/chiptune-tools/jummbox.webp" alt="JummBoxの画面" width="515" height="420" loading="lazy" />

- [**UltraBox**](https://ultraabox.github.io/)：さまざまなBeepBox派生版の便利機能をひとまとめにしたバージョン。現在もっとも人気のある派生版の一つです
  <img src="/img/chiptune-tools/ultrabox.webp" alt="UltraBoxの画面" width="515" height="420" loading="lazy" />

- [**Slarmoo's Box**](https://slarmoo.github.io/slarmoosbox/) 1.4.11：UltraBoxをもとに、エフェクトや音量変化（エンベロープ）の設定などを増やした派生版
  <img src="/img/chiptune-tools/slarmoos-box.webp" alt="Slarmoo's Boxの画面" width="515" height="420" loading="lazy" />

## 有料のプラグイン

- [**Plogueの音源**](https://www.plogue.com/products/)：実機の音源チップを、とても細かく再現しています。どれもWindows・Mac・Linux（VST3・CLAP、MacはAUも）。値段は2026年10月30日の公式ストアのもの

  - chipsynth C64（49.95ドル）：コモドール64の音源（SID）
    <img src="/img/chiptune-tools/chipsynth-c64.webp" alt="chipsynth C64の画面" width="560" height="259" loading="lazy" />

  - chipsynth MD（49.95ドル）：メガドライブの音源（金属的で鋭いFM音源と、ピコピコしたPSG音源の両方を再現）
    <img src="/img/chiptune-tools/chipsynth-md.webp" alt="chipsynth MDの画面" width="560" height="319" loading="lazy" />

  - chipsynth SFC（39.95ドル）：スーパーファミコンの音源
    <img src="/img/chiptune-tools/chipsynth-sfc.webp" alt="chipsynth SFCの画面" width="560" height="344" loading="lazy" />

  - chipsynth OPMZ（49.95ドル）：80〜90年代のゲームセンターや昔のパソコン（X68000など）で広く使われた、本格的なFM音源。2026年9月に出たばかり
    <img src="/img/chiptune-tools/chipsynth-opmz.webp" alt="chipsynth OPMZの画面" width="560" height="341" loading="lazy" />

  - chipsynth PortaFM（29.95ドル）：80年代のヤマハの小型キーボード（PSSシリーズ）や、パソコンのサウンドカード（AdLib・Sound Blaster）で使われた、素朴なFM音源
    <img src="/img/chiptune-tools/chipsynth-portafm.webp" alt="chipsynth PortaFMの画面" width="560" height="264" loading="lazy" />

  - chipsounds（75ドル）：ファミコンやコモドール64など、8bit時代の15種類の音源をまとめて再現。2009年に出た古い製品で、いまはchipsynthシリーズが後継です
    <img src="/img/chiptune-tools/chipsounds.webp" alt="chipsoundsの画面" width="560" height="297" loading="lazy" />

  - chipspeech（75ドル）：アーケードゲームや昔のパソコンで使われた、80年代の音声合成チップで歌わせる音源
    <img src="/img/chiptune-tools/chipspeech.webp" alt="chipspeechの画面" width="341" height="420" loading="lazy" />

- [**my2151**](https://booth.pm/ja/items/8292567)：YM2151を再現したFM音源。VOPMの音色ファイル（.opm）が読めます。Windows 64bit（VST3）、BOOTHで販売（体験版あり）
  <img src="/img/chiptune-tools/my2151.webp" alt="my2151の画面" width="560" height="374" loading="lazy" />

## サンプルパック

- [**Bitkits**](https://www.uppercussion.com/products/bitkits)（Uppercussion）：8bitのドラムキット10種類。キックやスネア、ハイハットのほか、ピコピコした効果音もたくさん入っています。無料

- [**Shirobon Presents: Chiptune for Serum**](https://shirobon.bandcamp.com/album/shirobon-presents-chiptune-for-serum)（Shirobon）：定番シンセ「Serum」用のプリセット100種類と、GAMEBOYの実機から録音した波形・ノイズが入っています。15ポンドから（Serum 1.107以降が必要）

- [**Super Audio Cart 2**](https://impactsoundworks.com/product/super-audio-cart/)（Impact Soundworks）：Atari 2600からゲームボーイアドバンスまで、様々なレトロゲーム機の音を集めた定番の音源集（初代の音もすべて収録）。199ドル（無料の「Kontakt Player」を導入すれば、普段お使いのDAWですぐに鳴らせます）
  <img src="/img/chiptune-tools/super-audio-cart-2.webp" alt="Super Audio Cart 2の画面" width="560" height="373" loading="lazy" />

## もっと知りたい人へ

ここに載せていない、よりマニアックなトラッカーやツールは、チップチューンの投稿コミュニティ「Battle of the Bits」の解説ページ（英語）にまとまっています。

- [トラッカーの一覧](https://battleofthebits.com/lyceum/View/List+of+Trackers)

- [音源・ハード別（ゲーム機・音源チップごと）の形式一覧](https://battleofthebits.com/lyceum/View/Format)

- [便利なツールの一覧](https://battleofthebits.com/lyceum/View/Tools)

## 2021年のまとめから変わったこと

- **SANA 8BIT VST**、**VOPM**：どちらも古い32bitのプラグインで、いまのDAWではそのままでは使えないことが多いです。ファミコン系はMagical 8bit Plug 2やNew DoReFAMI、YM2151はmy2151かchipsynth OPMZが代わりになります

バージョンや値段は、2026年10月30日に各ツールの配布ページで確かめたものです。画面の画像は各ツールの公式ページから引用しました（BeepBox、JummBox、UltraBox、Slarmoo's Boxは、実際にサイトを開いて撮影したもの、little-scaleさんのトラッカーはlittle-scaleさんのXの投稿から、Dn-FamiTrackerはRei8bitさんの許可を得て[Rei8bitさんのXの投稿](https://x.com/Rei8bit/status/2114188303566352817)から引用したものです）。
{{< /lang >}}

{{< lang en >}}
This is an updated roundup based on Umeboshi Chazuke's 2021 article on their blog Ajitama Note, "[10 Sound Sources for Making Bleepy Music](https://blog.ajitama-note.com/entry/2021/03/06/215656)" (in Japanese) and theta's [software page](https://ss1.xrea.com/theta.s57.xrea.com/software/), with more tools added.

## Start with free plugins

These load in your usual DAW and play like any other instrument.

- [**Magical 8bit Plug 2**](https://ymck.net/app/magical-8bit-plug) (YMCK): NES-style pulse waves (bleepy, good for melodies), triangle (round, good for bass) and noise (hissy, good for drums). If you're not sure where to start, start here. Free, Windows and Mac (VST3, AU)
  <img src="/img/chiptune-tools/magical-8bit-plug-2.webp" alt="Magical 8bit Plug 2 screenshot" width="560" height="308" loading="lazy" />

- [**Magical FDS Plug**](https://ymck.net/app/magical-fds-plug/) (YMCK): recreates the Famicom Disk System sound chip. Just released in June 2026. Free, Windows (VST3) and Mac (VST3, AU)
  <img src="/img/chiptune-tools/magical-fds-plug.webp" alt="Magical FDS Plug screenshot" width="560" height="309" loading="lazy" />

  - YMCK's synths tend to produce aliasing (a gritty buzz that isn't in the original sound) on high notes, so keep that in mind.

- [**New DoReFAMI**](https://ss1.xrea.com/theta.s57.xrea.com/software/#newdorefami) (theta) v1.7.1: recreates the NES sound chip, with detailed sound design. Free, Windows 64-bit (VST3). A version with sample songs is also sold on BOOTH (500 yen)
  <img src="/img/chiptune-tools/new-dorefami.webp" alt="New DoReFAMI screenshot" width="560" height="302" loading="lazy" />

- [**Twin DoReFAMI**](https://ss1.xrea.com/theta.s57.xrea.com/software/#twindorefami) (theta) v1.0.1: recreates wavetable sound chips (the kind used in the GAMEBOY and others), where you draw a short waveform yourself to make your own sound. Free, Windows 64-bit (VST3). The same author's [DWMEditor](https://ss1.xrea.com/theta.s57.xrea.com/software/#dwmeditor) helps with drawing waveforms
  <img src="/img/chiptune-tools/twin-dorefami.webp" alt="Twin DoReFAMI screenshot" width="560" height="350" loading="lazy" />

- [**Soraboy**](https://shadowsora211.itch.io/soraboy) (ShadowSora) v1.1.1: inspired by the GAMEBOY sound chip. Free (tips welcome), Windows 64-bit and Mac (VST3)
  <img src="/img/chiptune-tools/soraboy.webp" alt="Soraboy screenshot" width="560" height="420" loading="lazy" />

- [**C700**](https://github.com/osoumen/C700) (osoumen) ver20211031: a sampler that recreates the SNES sound chip. You load your own waveforms and sounds into it. It can also export your song as an SNES music file (.spc). Free, Windows (VST2) and Mac (VST2, AU)
  <img src="/img/chiptune-tools/c700.webp" alt="C700 screenshot" width="513" height="420" loading="lazy" />

## Effects

- [**Deltanizer**](https://ss1.xrea.com/theta.s57.xrea.com/software/#deltanizer) (theta) v2.0.0: gives sounds you've programmed the texture of the NES's DPCM channel (the gritty, rough sound used for drums and voices). Free, Windows 64-bit (VST3)
  <img src="/img/chiptune-tools/deltanizer.webp" alt="Deltanizer screenshot" width="292" height="313" loading="lazy" />

- [**Interruptor**](https://ss1.xrea.com/theta.s57.xrea.com/software/#interruptor) (theta) v0.0.2: recreates "interrupts," the old game-music trick of slipping quick sound effects or drums into the gaps of a melody. Free, Windows 64-bit (VST3)
  <img src="/img/chiptune-tools/interruptor.webp" alt="Interruptor screenshot" width="291" height="310" loading="lazy" />

- [**chipcrusher**](https://www.plogue.com/products/chipcrusher.html) (Plogue): adds the texture of old consoles after the fact, such as the slightly gritty voices and drums of the NES or the SNES's distinctive roughness and echo. $39
  <img src="/img/chiptune-tools/chipcrusher.webp" alt="chipcrusher screenshot" width="560" height="189" loading="lazy" />

## Trackers and dedicated software (all free except PICO-8 and Renoise)

You program within the limits of the console's sound chip, which makes it easier to sound like the real thing.

- [**FamiStudio**](https://famistudio.org/) 4.5.3: for the NES. It has a piano roll, so it's approachable even if you've never used a tracker. Windows, Mac, Linux
  <img src="/img/chiptune-tools/famistudio.webp" alt="FamiStudio screenshot" width="560" height="245" loading="lazy" />

- [**KiraStudio**](https://kirastudio.org/) 1.1.2: a new program released in 2026 by FamiStudio's author (BleuBleu). It has a piano roll and offers NES, GAMEBOY and Yamaha FM sound chips, among others. It values ease of use over hardware accuracy. The Windows version is free, and there are also Mac, iPhone, iPad and Android versions
  <img src="/img/chiptune-tools/kirastudio.webp" alt="KiraStudio screenshot" width="560" height="294" loading="lazy" />

- [**Dn-FamiTracker**](https://github.com/Dn-Programming-Core-Management/Dn-FamiTracker) Dn0.5.3: an NES tracker, descended from FamiTracker. Windows only
  <img src="/img/chiptune-tools/dn-famitracker.webp" alt="Dn-FamiTracker screenshot" width="560" height="316" loading="lazy" />

- [**Furnace**](https://github.com/tildearrow/furnace) 0.6.8.3: a tracker that supports many sound chips, including the NES, GAMEBOY and Mega Drive. Windows, Mac, Linux
  <img src="/img/chiptune-tools/furnace.webp" alt="Furnace screenshot" width="560" height="350" loading="lazy" />

- [**OpenMPT**](https://openmpt.org/) 1.32.11.00: a long-standing tracker that isn't tied to any one console. Windows
  <img src="/img/chiptune-tools/openmpt.webp" alt="OpenMPT screenshot" width="300" height="202" loading="lazy" />

- [**Renoise**](https://www.renoise.com/) 3.5.4: a tracker that works like a DAW, great for making music with samples. It also supports plugins like VSTs. 76 EUR, Windows, Mac, Linux
  <img src="/img/chiptune-tools/renoise.webp" alt="Renoise screenshot" width="560" height="397" loading="lazy" />

- [**PICO-8**](https://www.lexaloffle.com/pico-8.php) v0.2.7: a "fantasy console" for making whole retro pixel-art games. It comes with built-in music and sound effect editors for making chiptunes. $15, Windows, Mac, Linux, Raspberry Pi
  <img src="/img/chiptune-tools/pico-8.webp" alt="PICO-8 screenshot" width="560" height="242" loading="lazy" />

- [**Piston Collage**](https://pxtone.org/downloads/) (pxtone) ver.0.9.4.56: a music program where you put pitches on waveforms you've drawn or WAVs you've loaded and arrange them. You can make a whole song in it alone, and it's easy to use. Compilations of songs made with it still come out, such as "[PXTUNES 10th Anniversary: THE FUTURE OF PXTONE](https://pxtunes.bandcamp.com/album/pxtunes-10th-anniversary-the-future-of-pxtone)" from October 2026. Free (Windows)
  <img src="/img/chiptune-tools/piston-collage.webp" alt="Piston Collage screenshot" width="472" height="296" loading="lazy" />

## LSDj and trackers inspired by it (free)

LSDj for the GAMEBOY, along with trackers that bring its workflow to other consoles and devices. LSDj, Risa, and four trackers by little-scale run on original hardware or an emulator (PocketTracker and ChipNomad are apps for smartphones, computers, and handheld consoles).

- [**LSDj**](https://www.littlesounddj.com/) v9.4.2: music software that runs on a real GAMEBOY (or an emulator on a PC and so on). Free to download since 2020 (donations welcome)
  <img src="/img/chiptune-tools/lsdj.webp" alt="LSDj screenshot" width="320" height="288" loading="lazy" />

- [**Risa**](https://risa.laamaa.fi/) (laamaa): a music program (tracker) for the NES. You type notes straight onto the screen, much like the classic LSDj. On top of the console's own sound, it gives you two more pulse channels (bleepy square waves) from the cartridge's expansion chip (MMC5). Both the Mesen emulator and the EverDrive N8 Pro cartridge on real hardware are recommended
  <img src="/img/chiptune-tools/risa.webp" alt="Risa screenshot" width="256" height="240" loading="lazy" />

- [**genmddj**](https://github.com/little-scale/genmddj) (little-scale) v0.25: for the Mega Drive
  <img src="/img/chiptune-tools/genmddj.webp" alt="genmddj screenshot" width="560" height="420" loading="lazy" />

- [**smsggdj**](https://github.com/little-scale/smsggdj) (little-scale) v0.48: for the Sega Master System and Game Gear
  <img src="/img/chiptune-tools/smsggdj.webp" alt="smsggdj cartridge" width="525" height="420" loading="lazy" />

- [**sndj**](https://github.com/little-scale/sndj) (little-scale) v0.15: for the SNES
  <img src="/img/chiptune-tools/sndj.webp" alt="sndj running on real hardware" width="560" height="420" loading="lazy" />

- [**alynxdj**](https://github.com/little-scale/alynxdj) (little-scale) v0.60: for the Atari Lynx
  <img src="/img/chiptune-tools/alynxdj.webp" alt="alynxdj running on real hardware" width="560" height="315" loading="lazy" />

- [**PocketTracker**](https://conanizer.github.io/pockettracker/) (conanizer) v0.9.9.1: an Android music program (tracker) that carries over the feel of the classic handheld trackers (LSDj, LGPT, M8). It loads your own audio (samples) and SF2 sound files, so it's also good for chopping up and playing otoMAD or YTPMV source material (up to 8 tracks). Runs on phones and on Android handhelds with physical buttons
  <img src="/img/chiptune-tools/pockettracker.webp" alt="PocketTracker screenshot" width="560" height="294" loading="lazy" />

- [**ChipNomad**](https://chipnomad.org/) (Megus) v1.0.5: a tracker influenced by LSDj and the popular handheld M8. For now it supports only the AY-3-8910 (the sound chip in the MSX and others). Runs on Windows, macOS, Linux, Android and handhelds (RG35XX, Miyoo)
  <img src="/img/chiptune-tools/chipnomad.webp" alt="ChipNomad screenshot" width="525" height="420" loading="lazy" />

## M8 (hardware tracker)

A portable tracker influenced by the GAMEBOY's LSDj. Besides chiptune-style sound engines, it has FM synths and a sampler.

- [**M8 Tracker Model:02**](https://dirtywave.com/): the hardware. $699 (Dirtywave's official store)
  <img src="/img/chiptune-tools/m8.webp" alt="M8 Tracker Model:02 screenshot" width="560" height="344" loading="lazy" />

- [**M8 Headless**](https://github.com/Dirtywave/M8HeadlessFirmware): a free version you flash onto a small off-the-shelf board called the Teensy 4.1 and connect to a computer. The screen and controls are handled by software on the computer (m8c and others)
  <img src="/img/chiptune-tools/m8gd.webp" alt="M8 Headless shown in m8gd" width="560" height="315" loading="lazy" />

  - For the computer side, I recommend [**m8gd**](https://github.com/octoocto/m8gd) (free, Windows, Mac, Linux). It shows the M8's screen on a 3D model of the hardware (I use it myself).

- [**M8 Music Tracker**](https://apps.apple.com/jp/app/m8-music-tracker/id6806721202) (iPhone, iPad) 1.2.2: an app version with the same features as the hardware (released September 2026, 5,000 yen on the Japanese App Store). Songs can be moved back and forth between the app and the hardware
  <img src="/img/chiptune-tools/m8-music-tracker.webp" alt="M8 Music Tracker screenshot" width="560" height="420" loading="lazy" />

## picoTracker (hardware tracker)

- [**picoTracker**](https://xiphonics.com/) (Xiphonics) v2.4.0: hardware that runs a port of the classic tracker LGPT on its own, on a small microcontroller board (Raspberry Pi Pico). It has 8 tracks, with a sampler, FM synths and more. The DIY kit (board and display) is $99, and the finished picoTracker Advance is $449 (official store). The software is on [GitHub](https://github.com/xiphonics/picoTracker)
  <img src="/img/chiptune-tools/picotracker.webp" alt="picoTracker screenshot" width="560" height="373" loading="lazy" />

## Browser apps (free)

Nothing to install: just open a browser and start. Songs are saved in the URL, so sharing a song is as easy as sending its URL. You can also export to WAV or MIDI.

- [**BeepBox**](https://www.beepbox.co/) 4.2.2: the simplest of them all. You make a song just by placing notes on a grid. There's an offline version too
  <img src="/img/chiptune-tools/beepbox.webp" alt="BeepBox screenshot" width="515" height="420" loading="lazy" />

- [**JummBox**](https://jummb.us/) 2.6: a mod of BeepBox that adds pitch bends, finer volume control and more
  <img src="/img/chiptune-tools/jummbox.webp" alt="JummBox screenshot" width="515" height="420" loading="lazy" />

- [**UltraBox**](https://ultraabox.github.io/): gathers handy features from many BeepBox mods into one. One of the most popular mods right now
  <img src="/img/chiptune-tools/ultrabox.webp" alt="UltraBox screenshot" width="515" height="420" loading="lazy" />

- [**Slarmoo's Box**](https://slarmoo.github.io/slarmoosbox/) 1.4.11: a mod of UltraBox with more effects, envelope settings and more
  <img src="/img/chiptune-tools/slarmoos-box.webp" alt="Slarmoo's Box screenshot" width="515" height="420" loading="lazy" />

## Paid plugins

- [**Plogue's instruments**](https://www.plogue.com/products/): very detailed recreations of real sound chips. All run on Windows, Mac and Linux (VST3, CLAP, plus AU on Mac). Prices are from the official store on October 30, 2026

  - chipsynth C64 ($49.95): the Commodore 64 sound chip (SID)
    <img src="/img/chiptune-tools/chipsynth-c64.webp" alt="chipsynth C64 screenshot" width="560" height="259" loading="lazy" />

  - chipsynth MD ($49.95): the Mega Drive sound (recreating both the sharp, metallic FM sound and the bleepy PSG)
    <img src="/img/chiptune-tools/chipsynth-md.webp" alt="chipsynth MD screenshot" width="560" height="319" loading="lazy" />

  - chipsynth SFC ($39.95): the SNES sound chip
    <img src="/img/chiptune-tools/chipsynth-sfc.webp" alt="chipsynth SFC screenshot" width="560" height="344" loading="lazy" />

  - chipsynth OPMZ ($49.95): a full-featured FM chip widely used in 80s and 90s arcade games and old computers (such as the X68000). Just released in September 2026
    <img src="/img/chiptune-tools/chipsynth-opmz.webp" alt="chipsynth OPMZ screenshot" width="560" height="341" loading="lazy" />

  - chipsynth PortaFM ($29.95): simple FM chips used in Yamaha's small 80s keyboards (the PSS series) and in PC sound cards (AdLib, Sound Blaster)
    <img src="/img/chiptune-tools/chipsynth-portafm.webp" alt="chipsynth PortaFM screenshot" width="560" height="264" loading="lazy" />

  - chipsounds ($75): 15 sound chips from the 8-bit era, such as the NES and Commodore 64, in one instrument. An older product from 2009, now succeeded by the chipsynth series
    <img src="/img/chiptune-tools/chipsounds.webp" alt="chipsounds screenshot" width="560" height="297" loading="lazy" />

  - chipspeech ($75): sings with 80s speech synthesis chips used in arcade games and old computers
    <img src="/img/chiptune-tools/chipspeech.webp" alt="chipspeech screenshot" width="341" height="420" loading="lazy" />

- [**my2151**](https://booth.pm/ja/items/8292567): an FM synth that recreates the YM2151. It can load VOPM patch files (.opm). Windows 64-bit (VST3), sold on BOOTH (demo available)
  <img src="/img/chiptune-tools/my2151.webp" alt="my2151 screenshot" width="560" height="374" loading="lazy" />

## Sample packs

- [**Bitkits**](https://www.uppercussion.com/products/bitkits) (Uppercussion): ten 8-bit drum kits. Besides kicks, snares and hi-hats, there are lots of bleepy sound effects. Free

- [**Shirobon Presents: Chiptune for Serum**](https://shirobon.bandcamp.com/album/shirobon-presents-chiptune-for-serum) (Shirobon): 100 presets for the popular synth Serum, plus waveforms and noise recorded from a real GAMEBOY. From £15 (needs Serum 1.107 or later)

- [**Super Audio Cart 2**](https://impactsoundworks.com/product/super-audio-cart/) (Impact Soundworks): a well-known library of sounds from many retro consoles, from the Atari 2600 to the Game Boy Advance (includes all the sounds from the first version). $199 (runs in the free Kontakt Player, so you can play it right away in your usual DAW)
  <img src="/img/chiptune-tools/super-audio-cart-2.webp" alt="Super Audio Cart 2 screenshot" width="560" height="373" loading="lazy" />

## To dig deeper

For more obscure trackers and tools not covered here, see the wiki pages of the chiptune community Battle of the Bits.

- [List of trackers](https://battleofthebits.com/lyceum/View/List+of+Trackers)

- [Formats by sound chip and hardware (consoles and chips)](https://battleofthebits.com/lyceum/View/Format)

- [Helper tools](https://battleofthebits.com/lyceum/View/Tools)

## What changed since the 2021 roundup

- **SANA 8BIT VST** and **VOPM**: both are old 32-bit plugins and often won't run as is in today's DAWs. For NES sounds, Magical 8bit Plug 2 or New DoReFAMI can take their place, and for the YM2151, my2151 or chipsynth OPMZ

Versions and prices were checked on each tool's download page on October 30, 2026. Screenshots are sourced from each tool's official page (for BeepBox, JummBox, UltraBox, and Slarmoo's Box, I captured them directly from the sites; little-scale's trackers come from little-scale's posts on X, and Dn-FamiTracker from [Rei8bit's post on X](https://x.com/Rei8bit/status/2114188303566352817), with Rei8bit's permission).
{{< /lang >}}

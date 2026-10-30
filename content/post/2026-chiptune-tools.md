---
title: チップチューンづくりのおすすめツール（2026年10月版）
title_en: Recommended Chiptune Tools (October 2026)
date: 2026-10-30
description: プラグイン、トラッカー、ハードウェア、ブラウザのソフト、サンプルパックまで、最新バージョンでまとめ直しました
description_en: A fresh roundup of chiptune plugins, trackers, hardware, browser tools, and sample packs, all updated with their latest versions.
---

{{< lang ja >}}
梅干茶漬けさんのブログ「あじたまのーと」の2021年の記事「[ピコピコ音楽の制作に役立つ音源10選](https://blog.ajitama-note.com/entry/2021/03/06/215656)」と、thetaさんの[ソフトウェアのページ](https://ss1.xrea.com/theta.s57.xrea.com/software/)をもとに、ほかのツールも足して、最新のバージョンに合わせてまとめ直しました。

<nav class="toc">

**目次**

- [まずは無料のプラグインから](#ja-free-plugins)
- [音にかけるエフェクト](#ja-effects)
- [トラッカー・専用ソフト（値段の書いていないものは無料）](#ja-trackers)
- [LSDjと、LSDjから生まれたトラッカー（無料）](#ja-lsdj)
- [M8（ハードウェアのトラッカー）](#ja-m8)
- [picoTracker（ハードウェアのトラッカー）](#ja-picotracker)
- [そのほかのハードウェア](#ja-hardware)
- [スマホ・携帯ゲーム機で使えるソフト](#ja-handheld)
- [ゲーム機・昔のパソコンの実機で動くソフト](#ja-consoles)
- [昔の日本のパソコン（X68000・PC-98・MSX）のツール](#ja-japanese-pcs)
- [ブラウザで使えるソフト（無料）](#ja-browser)
- [MMLで書くソフト](#ja-mml)
- [有料のプラグイン](#ja-paid-plugins)
- [サンプルパック](#ja-sample-packs)
- [効果音を作るソフト](#ja-sfx)
- [再生・変換・そのほか](#ja-players)
- [Shiruさんのツール（無料）](#ja-shiru)
- [機種別のトラッカーとツール](#ja-botb)
- [もっと知りたい人へ](#ja-more)
- [2021年のまとめから変わったこと](#ja-changes)

</nav>

## まずは無料のプラグインから {#ja-free-plugins}

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

- [**OPNA FM Synth**](https://trpico.booth.pm/items/8351023) v1.0.1：とるぴさんの、YM2608（OPNA）のFM音源を再現したプラグイン。無料（支援つきは600円）、Windows（VST3）
  <img src="/img/chiptune-tools/opnafm.webp" alt="OPNA FM Synthの画面" width="560" height="382" loading="lazy" />

## 音にかけるエフェクト {#ja-effects}

- [**Deltanizer**](https://ss1.xrea.com/theta.s57.xrea.com/software/#deltanizer)（theta）v2.0.0：自分で打ち込んだ音を、ファミコンのDPCM（ドラムや声に使われた、ザラザラした粗い音）の質感に変える。無料、Windows 64bit（VST3）
  <img src="/img/chiptune-tools/deltanizer.webp" alt="Deltanizerの画面" width="292" height="313" loading="lazy" />

- [**Interruptor**](https://ss1.xrea.com/theta.s57.xrea.com/software/#interruptor)（theta）v0.0.2：メロディのすき間に高速で効果音やドラムを挟み込む、昔のゲーム特有の鳴らし方（割り込み）を再現する。無料、Windows 64bit（VST3）
  <img src="/img/chiptune-tools/interruptor.webp" alt="Interruptorの画面" width="291" height="310" loading="lazy" />

- [**chipcrusher**](https://www.plogue.com/products/chipcrusher.html)（Plogue）：ファミコンの少しざらざらした声・ドラムの音や、スーパーファミコン独特の粗さとエコーなど、昔のゲーム機らしい音の質感をあとから加えられるエフェクト。39ドル
  <img src="/img/chiptune-tools/chipcrusher.webp" alt="chipcrusherの画面" width="560" height="189" loading="lazy" />

## トラッカー・専用ソフト（値段の書いていないものは無料） {#ja-trackers}

ゲーム機の音源の制限どおりに打ち込めるので、「本物っぽさ」が出やすい方法です。

- [**FamiStudio**](https://famistudio.org/) 4.5.3：ファミコン用。ピアノロールで打ち込めるので、トラッカーが初めてでもとっつきやすい。Windows・Mac・Linux
  <img src="/img/chiptune-tools/famistudio.webp" alt="FamiStudioの画面" width="560" height="307" loading="lazy" />
  <small>画像：Rei8bitさん提供</small>

- [**KiraStudio**](https://kirastudio.org/) 1.1.2：FamiStudioと同じ作者（BleuBleu）が2026年に公開した新作ソフト。ピアノロールで打ち込めて、ファミコン、GAMEBOY、ヤマハのFM音源などが使えます。実機の音の正確さよりも、作りやすさを大事にしているそうです。Windows版は無料。Mac・iPhone・iPad・Android版もあります
  <img src="/img/chiptune-tools/kirastudio.webp" alt="KiraStudioの画面" width="560" height="307" loading="lazy" />
  <small>画像：Rei8bitさん提供</small>

- [**Dn-FamiTracker**](https://github.com/Dn-Programming-Core-Management/Dn-FamiTracker) Dn0.5.3：ファミコン用のトラッカー。FamiTrackerの流れをくむバージョン。Windowsのみ
  <img src="/img/chiptune-tools/dn-famitracker.webp" alt="Dn-FamiTrackerの画面" width="560" height="315" loading="lazy" />
  <small>画像：Rei8bitさん提供</small>
  - [**Ruikajさんの改造版**](https://github.com/Ruikaj/Dn-FamiTracker)：NSFに書き出すときに音色のデータがあふれにくくなるよう改造したもの。無料、Windowsのみ

- [**Furnace**](https://github.com/tildearrow/furnace) 0.6.8.3：ファミコン、GAMEBOY、メガドライブなど、たくさんの音源に対応したトラッカー。Windows・Mac・Linux
  <img src="/img/chiptune-tools/furnace.webp" alt="Furnaceの画面" width="560" height="307" loading="lazy" />
  <small>画像：Rei8bitさん提供</small>
  - [**furnace-piano-roll**](https://github.com/rednoobmusic/furnace-piano-roll) v14：Furnaceにピアノロールなどを足した派生版。無料、Windows・Linux
    <img src="/img/chiptune-tools/furnace-piano-roll.webp" alt="furnace-piano-rollの画面" width="560" height="307" loading="lazy" />
    <small>画像：Rei8bitさん提供</small>

- [**OpenMPT**](https://openmpt.org/) 1.32.11.00：特定のゲーム機に縛られない、昔からあるトラッカー。Windows
  <img src="/img/chiptune-tools/openmpt.webp" alt="OpenMPTの画面" width="560" height="315" loading="lazy" />
  <small>画像：Rei8bitさん提供</small>

- [**Renoise**](https://www.renoise.com/) 3.5.4：録音した音（サンプル）を使った曲づくりに強い、DAWのように使えるトラッカー。音色や効果を追加する機能（VSTなどのプラグイン）も使えます。76ユーロ、Windows・Mac・Linux
  <img src="/img/chiptune-tools/renoise.webp" alt="Renoiseの画面" width="560" height="397" loading="lazy" />

- [**PICO-8**](https://www.lexaloffle.com/pico-8.php) v0.2.7：レトロなドット絵ゲームをまるごと作れる「架空のゲーム機」ソフトです。ソフトの中に、チップチューンを作るための音楽・効果音エディターがあらかじめ入っています。15ドル、Windows・Mac・Linux・Raspberry Pi
  <img src="/img/chiptune-tools/pico-8.webp" alt="PICO-8の画面" width="560" height="242" loading="lazy" />

- [**TIC-80**](https://tic80.com/) v1.4.1：小さなゲームを作るための「架空のゲーム機」ソフト。4チャンネルの音楽と効果音のエディターが入っています。無料（機能が増えるPRO版は10ドル）、Windows・Mac・Linux・Android・ブラウザ。TIC-80で波形メモリのシンセを試した自分の動画も、[Xに載せています](https://x.com/to6okegao/status/1244441165102854145)
  <img src="/img/chiptune-tools/tic80.webp" alt="TIC-80の画面" width="560" height="317" loading="lazy" />

- [**ピストンコラージュ**](https://pxtone.org/downloads/) ver.0.9.4.56：自分で描いた波形や、読み込んだWAVに音程を付けて並べていく作曲ソフト。単体で曲が作れて、操作もかんたん。いまもこのソフトで作った曲を集めたコンピが出ています（2026年10月に出た「[PXTUNES 10th Anniversary: THE FUTURE OF PXTONE](https://pxtunes.bandcamp.com/album/pxtunes-10th-anniversary-the-future-of-pxtone)」など）。無料（Windows対応）
  <img src="/img/chiptune-tools/piston-collage.webp" alt="ピストンコラージュの画面" width="472" height="296" loading="lazy" />

- [**ptcollab**](https://yuxshao.github.io/ptcollab/) v0.6.4.11：ピストンコラージュの音のしくみをもとにした作曲ソフト。友だちとネットでつないで、一緒に1曲を作れます。MIDIでも打ち込めます。無料、Windows・Mac・Linux
  <img src="/img/chiptune-tools/ptcollab.webp" alt="ptcollabの画面" width="560" height="315" loading="lazy" />

- [**Bamboo Tracker**](https://bambootracker.github.io/BambooTracker/) v0.6.5：PC-8801やPC-9801で使われたFM音源（YM2608）用のトラッカー。無料、Windows・Mac・Linux
  <img src="/img/chiptune-tools/bambootracker.webp" alt="Bamboo Trackerの画面" width="560" height="307" loading="lazy" />
  <small>画像：Rei8bitさん提供</small>

- [**Arkos Tracker 3**](https://www.julien-nevo.com/arkostracker/) 3.7：MSXやZX Spectrum、Atari STなどのPSG音源（AY-3-8910・YM2149）用のトラッカー。無料、Windows・Mac・Linux
  <img src="/img/chiptune-tools/arkos.webp" alt="Arkos Tracker 3の画面" width="560" height="350" loading="lazy" />

- [**Vortex Tracker**](https://github.com/benbaker76/VortexTracker) 3.0.0：PSG音源（AY-3-8910・YM2149）用の、昔からあるトラッカーを作り直したバージョン。無料、Windows
  <img src="/img/chiptune-tools/vortex.webp" alt="Vortex Trackerの画面" width="277" height="420" loading="lazy" />

- [**Osctet**](https://jangle.dev/osctet/) 1.4.1：シンセとサンプラーを使うトラッカー。めずらしい音律やリズムも扱えます。無料、Windows・Linux
  <img src="/img/chiptune-tools/osctet.webp" alt="Osctetの画面" width="560" height="419" loading="lazy" />

- [**WaveTracker**](https://wavetracker.org) v1.1.2：自分で描いた波形（波形メモリ）とサンプルで鳴らすトラッカー。無料（投げ銭可）、Windowsのみ
  <img src="/img/chiptune-tools/wavetracker.webp" alt="WaveTrackerの画面" width="560" height="307" loading="lazy" />
  <small>画像：Rei8bitさん提供</small>

- [**DefleMask**](https://www.deflemask.com/)：メガドライブ、マスターシステム、GAMEBOY、PCエンジン、ファミコンなど、たくさんの音源に対応したトラッカー。Steam版は1,700円、スマホ版もあります（iOS・Android）。古い無料版もありますが、サポートは終わっています
  <img src="/img/chiptune-tools/deflemask.webp" alt="DefleMask（v1）の画面" width="560" height="307" loading="lazy" />
  <small>画像：Rei8bitさん提供</small>
  <img src="/img/chiptune-tools/deflemask-legacy.webp" alt="DefleMask Legacyの画面" width="560" height="307" loading="lazy" />
  <small>画像：Rei8bitさん提供</small>

- [**MilkyTracker**](https://milkytracker.org/) v1.05.01：FastTracker IIと互換の、サンプルを使うトラッカー（XM・MOD形式）。無料、Windows・Mac・Linux
  <img src="/img/chiptune-tools/milkytracker.webp" alt="MilkyTrackerの画面" width="544" height="420" loading="lazy" />
  <small>画像：[Lospec](https://lospec.com/software/milkytracker/screenshots)より</small>

- [**Schism Tracker**](https://schismtracker.org/) 20260524：Impulse Trackerを今のパソコン向けに作り直した、サンプルを使うトラッカー。無料、Windows・Mac・Linux
  <img src="/img/chiptune-tools/schism.webp" alt="Schism Trackerの画面" width="560" height="360" loading="lazy" />
  <small>画像：[Lospec](https://lospec.com/software/schism-tracker/screenshots)より</small>

- [**SunVox**](https://warmplace.ru/soft/sunvox/) 2.1.4d：モジュールをつないで音を作るシンセと、トラッカーを合わせた作曲ソフト。軽くて古いパソコンでも動きます。パソコン版は無料、iOS版は1,000円（Android版もあります）
  <img src="/img/chiptune-tools/sunvox.webp" alt="SunVoxの画面" width="560" height="315" loading="lazy" />
  <small>画像：[Lospec](https://lospec.com/software/sunvox/screenshots)より</small>

- [**Bosca Ceoil Blue**](https://yurisizov.itch.io/boscaceoil-blue) 3.1.2：1画面で曲が作れる、初心者向けの作曲ソフト。無料（投げ銭可）、Windows・Mac・Linux、ブラウザ版もあります
  <img src="/img/chiptune-tools/bosca.webp" alt="Bosca Ceoil Blueの画面" width="560" height="315" loading="lazy" />
  <small>画像：[Lospec](https://lospec.com/software/bosca-ceoil-blue/screenshots)より</small>

- [**hUGETracker**](https://superdisk.github.io/hUGETracker/) v1.0.11：GAMEBOY用のトラッカー。作った曲を、自作のGAMEBOYゲームに組みこめます。無料、Windows・Mac・Linux
  <img src="/img/chiptune-tools/hugetracker.webp" alt="hUGETrackerの画面" width="560" height="311" loading="lazy" />
  <small>画像：[Lospec](https://lospec.com/software/hugetracker/screenshots)より</small>

- [**GTUltra**](https://github.com/jpage8580/GTUltra) v1.5.8：GoatTracker 2（ステレオ版）を大きく改造して、機能を増やしたコモドール64（SID）のトラッカー。特別なこだわりがなければ、GoatTracker 2よりこちらがおすすめです（Rei8bitさんのおすすめ）。無料、Windows・Mac・Linux
  <img src="/img/chiptune-tools/gtultra.webp" alt="GTUltraの画面" width="559" height="420" loading="lazy" />
  <small>画像：Rei8bitさん提供</small>

- [**GoatTracker 2**](https://sourceforge.net/projects/goattracker2/) 2.77：コモドール64（SID）用のトラッカー。作った曲を実機で鳴らせます。今から使うなら、上のGTUltraがおすすめです。無料、Windows・Mac・Linux
  <img src="/img/chiptune-tools/goattracker.webp" alt="GoatTracker 2の画面" width="534" height="420" loading="lazy" />
  <small>画像：[Lospec](https://lospec.com/software/goattracker-2/screenshots)より</small>

- [**SID Factory II**](https://github.com/Chordian/sidfactory2) release-20260314：コモドール64の実機で鳴る音楽を作れる、SID音源用のエディター。現在はオープンベータ版です。無料、Windows・Mac・Linux
  <img src="/img/chiptune-tools/sidfactory2.webp" alt="SID Factory IIの画面" width="560" height="285" loading="lazy" />
  <small>画像：Rei8bitさん提供</small>

- [**PIRORO**](https://store.steampowered.com/app/2905900/PIRORO/) ver.3.4.0：ピアノロールで打ち込むチップチューン作曲ソフト。GAMEBOYやGBAの実機で鳴らせるROMに書き出せて、MIDIも読みこめます。1,300円（Steam）、Windows
  <img src="/img/chiptune-tools/piroro.webp" alt="PIROROの画面" width="560" height="315" loading="lazy" />

- [**メキメキボーイ**](https://amuru9.wixsite.com/my-site/mekimeki-chip)：PIROROと同じ作者の、ピアノロールで打ち込む作曲ソフト。GAMEBOYで鳴らせるROMに書き出せます。無料、Windows
  <img src="/img/chiptune-tools/mekimeki.webp" alt="メキメキボーイの画面" width="560" height="298" loading="lazy" />

- [**Lovely Composer**](https://booth.pm/ja/items/3006558)：家庭用ゲーム機の作曲ソフトの流れをくむ、かわいい作曲ソフト。レトロゲームのような曲や効果音を作って、WAVやMIDIに書き出せます。990円（BOOTH）、Windows（一部のLinuxも）
  <img src="/img/chiptune-tools/lovelycomposer.webp" alt="Lovely Composerの画面" width="560" height="364" loading="lazy" />

- [**DR-00M**](https://uniko-art.itch.io/dr-00m) 1.1：PICO-8で作られた、16ステップのドラムマシン。無料（投げ銭可）、PICO-8・Windows・Mac・Linux
  <img src="/img/chiptune-tools/dr00m.webp" alt="DR-00Mの画面" width="320" height="410" loading="lazy" />

## LSDjと、LSDjから生まれたトラッカー（無料） {#ja-lsdj}

GAMEBOY用のLSDjと、その操作感を受け継いでほかのゲーム機や機材向けに作られたトラッカーを集めました。LSDj、Risa、little-scaleさん作の4つは、ゲーム機の実機かエミュレーターで動きます（PocketTrackerとChipNomadは、スマホやパソコン、携帯ゲーム機で動くアプリです）。

- [**LSDj**](https://www.littlesounddj.com/) v9.4.2：GAMEBOYの実機（またはPCなどのエミュレーター）で動く音楽制作ソフト。2020年から無料でダウンロードできます（寄付も受け付けています）
  <img src="/img/chiptune-tools/lsdj.webp" alt="LSDjの画面" width="320" height="288" loading="lazy" />

- [**Risa**](https://risa.laamaa.fi/)（laamaa）：ファミコン用の作曲ソフト（トラッカー）。名作「LSDj」に近い感覚で画面に直接打ち込めます。本体の音に加えて、カセット側の拡張音源（MMC5）によるピコピコ音（矩形波）が2音多く使えます。エミュレーター「Mesen」や、実機カートリッジ「EverDrive N8 Pro」での動作が推奨されています
  <img src="/img/chiptune-tools/risa.webp" alt="Risaの画面" width="256" height="240" loading="lazy" />

- [**genmddj**](https://github.com/little-scale/genmddj)（little-scale）v0.25：メガドライブ用
  <img src="/img/chiptune-tools/genmddj.webp" alt="genmddjの画面" width="560" height="420" loading="lazy" />
  <small>画像：[Xの投稿](https://x.com/littlescale/status/2112682597327528396)より</small>

- [**smsggdj**](https://github.com/little-scale/smsggdj)（little-scale）v0.48：セガ・マスターシステムとゲームギア用
  <img src="/img/chiptune-tools/smsggdj.webp" alt="smsggdjのカートリッジ" width="525" height="420" loading="lazy" />
  <small>画像：[Xの投稿](https://x.com/littlescale/status/2082773452164084107)より</small>

- [**sndj**](https://github.com/little-scale/sndj)（little-scale）v0.15：スーパーファミコン用
  <img src="/img/chiptune-tools/sndj.webp" alt="sndjを実機で動かしているところ" width="560" height="420" loading="lazy" />
  <small>画像：[Xの投稿](https://x.com/littlescale/status/2076465778753507804)より</small>

- [**alynxdj**](https://github.com/little-scale/alynxdj)（little-scale）v0.60：Atari Lynx用
  <img src="/img/chiptune-tools/alynxdj.webp" alt="alynxdjを実機で動かしているところ" width="560" height="315" loading="lazy" />
  <small>画像：[Xの投稿](https://x.com/littlescale/status/2083711247678365936)より</small>

- [**PocketTracker**](https://conanizer.github.io/pockettracker/)（conanizer）v0.9.9.1：携帯型トラッカーの名機（LSDj、LGPT、M8）の使い心地を受け継いだ、Android用の作曲ソフト（トラッカー）です。自分で用意した音声素材（サンプル）やSF2（音色ファイル）を読み込めるため、音MADやYTPMVの素材を刻んで鳴らすのにも向いています（最大8トラック）。スマホでも、ボタン付きのAndroid携帯ゲーム機でも動きます
  <img src="/img/chiptune-tools/pockettracker.webp" alt="PocketTrackerの画面" width="560" height="294" loading="lazy" />

- [**ChipNomad**](https://chipnomad.org/)（Megus）v1.0.5：LSDjや人気の携帯型機「M8」に影響を受けたトラッカー。いまはAY-3-8910（MSXなどに載っていた音源）のみに対応。Windows・macOS・Linux・Android、携帯ゲーム機（RG35XX、Miyoo）で動きます
  <img src="/img/chiptune-tools/chipnomad.webp" alt="ChipNomadの画面" width="525" height="420" loading="lazy" />

## M8（ハードウェアのトラッカー） {#ja-m8}

GAMEBOYのLSDjに影響を受けた、持ち運べるトラッカー。チップチューン向けの音源のほか、FM音源やサンプラーも入っています。

- [**M8 Tracker Model:02**](https://dirtywave.com/)：本体。699ドル（Dirtywave公式ストア）
  <img src="/img/chiptune-tools/m8.webp" alt="M8 Tracker Model:02の画面" width="560" height="344" loading="lazy" />

- [**M8 Headless**](https://github.com/Dirtywave/M8HeadlessFirmware)：「Teensy 4.1」という市販の小さな基板に書き込み、パソコンにつないで使う無料版。画面と操作はパソコン側のソフト（m8cなど）で行います
  <img src="/img/chiptune-tools/m8gd.webp" alt="M8 Headlessをm8gdで表示した画面" width="560" height="315" loading="lazy" />

  - パソコン側の表示ソフトは、[**m8gd**](https://github.com/octoocto/m8gd)（無料、Windows・Mac・Linux）がおすすめです。M8の画面を3Dの本体のような見た目で表示できます（自分も使っています）。

- [**M8 Music Tracker**](https://apps.apple.com/jp/app/m8-music-tracker/id6806721202)（iPhone・iPad）1.2.2：本体の機能をそのまま再現したアプリ版です（2026年9月リリース／App Storeで5,000円）。曲データは実機本体と相互にやりとりできます
  <img src="/img/chiptune-tools/m8-music-tracker.webp" alt="M8 Music Trackerの画面" width="560" height="420" loading="lazy" />

## picoTracker（ハードウェアのトラッカー） {#ja-picotracker}

- [**picoTracker**](https://xiphonics.com/)（Xiphonics）v2.4.0：名作トラッカー「LGPT」を小さなマイコン基板（Raspberry Pi Pico）に移植し、単体で動くようにしたハードウェアです。8トラックで、サンプラーやFM音源などが入っています。組み立てキット（基板と画面）は99ドル、完成品の「picoTracker Advance」は449ドル（公式ストア）。ソフトは[GitHub](https://github.com/xiphonics/picoTracker)で公開されています
  <img src="/img/chiptune-tools/picotracker.webp" alt="picoTrackerの画面" width="560" height="373" loading="lazy" />

## そのほかのハードウェア {#ja-hardware}

- [**MIDISID**](https://peacockmedia.software/midisid/)：SIDの互換チップを2つ積んだ、MIDIで鳴らすシンセ。125ポンド
  <img src="/img/chiptune-tools/midisid.webp" alt="MIDISIDの画面" width="500" height="267" loading="lazy" />

- [**LIVEN MEGA SYNTHESIS**](https://ja.sonicware.jp/pages/liven-mega-synthesis)：16ビットのゲーム機のFM音源を再現した、6トラックのシーケンサー付きのグルーヴボックス。49,800円（ACアダプター付きは54,800円）
  <img src="/img/chiptune-tools/megasyn.webp" alt="LIVEN MEGA SYNTHESISの画面" width="420" height="420" loading="lazy" />

- [**NullPerator**](https://203.io/products/operator-deposit)：picoTrackerをもとにしたソフトで動く、小さな携帯型トラッカー。249ドルから（予約）。iPhone・iPad用の無料アプリもあります
  <img src="/img/chiptune-tools/nullperator.webp" alt="NullPeratorの画面" width="420" height="420" loading="lazy" />

- [**LAVIOR AURA**](https://hmfactory.jp/aura/)：HMFACTORYの、PSGや波形メモリ、SID、PCMなどの音を最大32チャンネルで鳴らす小さな音源ボード。Windowsのアプリ「AURA HOST」で操作します。2026年10月から先行配布
  <img src="/img/chiptune-tools/aura.webp" alt="LAVIOR AURAのAURA HOSTの画面" width="560" height="332" loading="lazy" />

## スマホ・携帯ゲーム機で使えるソフト {#ja-handheld}

スマホや携帯ゲーム機で、どこでも曲が作れます。

- [**nanoloop**](https://nanoloop.com/)：4×4のマス目で打ち込むシーケンサー兼シンセ。GAMEBOY用・GBA用のカートリッジ、専用の機械（nanoloop q）、スマホ版があります。スマホ版はiOS 600円・Android 390円
  <img src="/img/chiptune-tools/nanoloop.webp" alt="nanoloopの画面" width="560" height="229" loading="lazy" />

- [**naive tracker**](https://nanoloop.com/naive/index.html) 1.0.6：nanoloopの作者による、タッチ画面向けの4トラックのサンプラー兼トラッカー。600円、iPhone・iPad（Android版は準備中）
  <img src="/img/chiptune-tools/naive.webp" alt="naive trackerの画面" width="194" height="420" loading="lazy" />
  <small>画像：[App Store](https://apps.apple.com/jp/app/naive-tracker/id6758921004)より</small>

- [**snibbetracker**](https://apps.apple.com/jp/app/snibbetracker/id1065797528)：シンプルな音源を持った、チップチューン風のトラッカー。無料、iPhone・iPad（Windows・Mac版もあります）
  <img src="/img/chiptune-tools/snibbe.webp" alt="snibbetrackerの画面" width="315" height="420" loading="lazy" />

- [**SidTracker64**](https://apps.apple.com/jp/app/sidtracker64/id955421205) 1.0.5：コモドール64の音源（SID）を再現した、iPad用のトラッカー。1,800円
  <img src="/img/chiptune-tools/sidtracker64.webp" alt="SidTracker64の画面" width="315" height="420" loading="lazy" />

- [**GTMobile**](https://github.com/2bt/GTMobile) 1.0.19：GoatTracker 2をもとにした、Android用のコモドール64（SID）トラッカー。ピアノロールでも打ち込めます。無料
  <img src="/img/chiptune-tools/gtmobile.webp" alt="GTMobileの画面" width="226" height="420" loading="lazy" />

- [**Pocket Acid**](https://github.com/boomlinde/pocketacid) v1.11.0：アシッド（TB-303風）の曲を作るためのソフト。ゲームパッドで操作し、安い携帯ゲーム機（R36Sなど）でも動きます。無料、Linuxの携帯ゲーム機・Windows
  <img src="/img/chiptune-tools/pocketacid.webp" alt="Pocket Acidの画面" width="315" height="420" loading="lazy" />

- [**4TRKmini**](https://jasonbmusic.itch.io/4trk-mini)：ドラム1つとシンセ3つの4トラックで作る、携帯ゲーム機向けの作曲ソフト。Amiga版の4TRK-500もあります。無料（投げ銭可）、携帯ゲーム機・Windows・Mac・Linux
  <img src="/img/chiptune-tools/4trk.webp" alt="4TRKminiの画面" width="531" height="420" loading="lazy" />

- [**ESPboy Tracker**](http://shiru.nedopc.com/software.shtml) v1.2：Shiruさんの、小さな携帯機ESPboy用の、LSDjに影響を受けたトラッカー。パソコン版もあります。無料
  <img src="/img/chiptune-tools/espboy.webp" alt="ESPboy Trackerの画面" width="315" height="420" loading="lazy" />

## ゲーム機・昔のパソコンの実機で動くソフト {#ja-consoles}

GAMEBOYやGBA、ファミコン、コモドール64などの実機（またはエミュレーター）で動くソフトです。

- [**FMS**](https://lobit-club.itch.io/fms) 1.31：GBA用のグルーヴボックス。2オペレーターのFM音源4トラックと、GAMEBOYのノイズで鳴らします。10ドルから（無料の体験版あり）。カートリッジ版や、パソコン用のプラグイン（ベータ版）もあります
  <img src="/img/chiptune-tools/fms.webp" alt="FMSの画面" width="560" height="324" loading="lazy" />

- [**STEPPER**](https://badd10de.itch.io/stepper-gba) 1.9：GBAで動く16ステップのシーケンサー。GAMEBOYの4つの音を鳴らします。無料（投げ銭可）、GBA・3DS
  <img src="/img/chiptune-tools/stepper.webp" alt="STEPPERの画面" width="560" height="373" loading="lazy" />

- [**GB303 MIDI**](https://zerabosk.itch.io/gb303midi)：GAMEBOYで鳴らすTB-303風のベースシンセ。Arduinoboyを使ってMIDIで操作できます。ROMは10ドルから、カートリッジは26.50ドル（HobbyChop）
  <img src="/img/chiptune-tools/gb303.webp" alt="GB303 MIDIの画面" width="467" height="420" loading="lazy" />

- [**STUTTER**](https://stutter.hobbychop.com/)：GAMEBOY用の、MIDIで操作できる4音のステップシーケンサー。演奏中にかけられるグリッチのエフェクト付き。ROMは10ドル、カートリッジは26ドル（HobbyChop）
  <img src="/img/chiptune-tools/stutter.webp" alt="STUTTERの画面" width="466" height="420" loading="lazy" />

- [**Merzboy**](https://github.com/purefunktion/Merzboy)：GAMEBOYでノイズを鳴らすためのソフト。無料
  <img src="/img/chiptune-tools/merzboy.webp" alt="Merzboyの画面" width="320" height="288" loading="lazy" />

- [**Droneboy**](https://github.com/purefunktion/Droneboy) v1.09：GAMEBOYでドローンを鳴らすシンセ。和音やシーケンスも使え、MIDIでも操作できます。無料、カートリッジは26.50ドル（HobbyChop）

- [**DMGo!**](https://audiowanderer.com/AW/drum-machina-go-or/) v1：GAMEBOYの4チャンネルで鳴らすドラムマシン。2026年9月に出たばかり。無料（寄付可）
  <img src="/img/chiptune-tools/dmgo.webp" alt="DMGo!の画面" width="467" height="420" loading="lazy" />

- [**Neil BaldwinさんのNESのツール**](https://neilbaldwin.codeberg.page/nes-audio/index.html)：LSDjに近いトラッカー「Pulsar」、トラッカー「NTRQ」、ドラムマシン「PR8」など、ファミコンの実機で動く作曲ソフトのまとめ。無料
  <img src="/img/chiptune-tools/neil.webp" alt="Neil BaldwinさんのNESのツールの画面" width="280" height="262" loading="lazy" />

- [**SID-Wizard**](https://csdb.dk/release/?id=262561) 1.97：コモドール64の実機で動くトラッカー。無料
  <img src="/img/chiptune-tools/sidwizard.webp" alt="SID-Wizardの画面" width="544" height="420" loading="lazy" />
  <small>画像：[CSDb](https://csdb.dk/release/?id=262561)より</small>

- [**MiniSEQ**](https://4mat.itch.io/miniseq)：4matさんの、コモドール64の画面の文字を書きかえて音を鳴らすシーケンサー。無料
  <img src="/img/chiptune-tools/miniseq.webp" alt="MiniSEQの画面" width="560" height="397" loading="lazy" />

- [**Patchwork**](https://4mat.itch.io/patchwork)：4matさんの、録音したSIDの曲の一部を楽器にして使う、コモドール64用のシーケンサー。無料
  <img src="/img/chiptune-tools/patchwork.webp" alt="Patchworkの画面" width="560" height="397" loading="lazy" />

- [**SIDLab**](https://4mat.itch.io/sidlab)：4matさんの、コモドール64でSIDの曲をDJのようにリミックスできるツール。無料
  <img src="/img/chiptune-tools/sidlab.webp" alt="SIDLabの画面" width="384" height="272" loading="lazy" />

- [**SID SYNTH**](https://lukhash.bandcamp.com/album/neon-airlines)：LukHashさんの、コモドール64を演奏用のシンセにするソフト。単体では売っておらず、アルバム「Neon Airlines」（Bandcamp、7ポンドから、2026年11月6日発売）の特典です

- [**Realfun 3**](https://www.msx.org/node/60323)：MSXのSCC・PSGと、コレコビジョンの音源に対応したトラッカー。2020年に体験版が出て、いまも開発中のようです

- [**QuadTrack**](https://pinkparrotstudio.itch.io/quadtrack)：Amigaのしくみで動く、4トラックのサンプル演奏用シーケンサー。25ユーロから（無料の体験版あり）、Windows・Mac・Amiga

## 昔の日本のパソコン（X68000・PC-98・MSX）のツール {#ja-japanese-pcs}

X68000やPC-9801、PC-8801、MSXの音楽を作る・鳴らすためのツールです。

- [**FMSound**](https://uraraworks.github.io/FMSound/)：PC-9801の「PMD」とPC-8801の「MUCOM88」のMMLを、ブラウザで書いて鳴らせるプレイヤー兼エディター。パートごとの演奏のようすも見られます。まだ開発中のため、鳴らない曲もあります。無料
  <img src="/img/chiptune-tools/fmsound.webp" alt="FMSoundの画面" width="560" height="350" loading="lazy" />

- [**WebX68k**](https://uraraworks.github.io/WebX68k/)：ブラウザで動くX68000のエミュレーター。URLを開くだけで起動します。無料
  <img src="/img/chiptune-tools/webx68k.webp" alt="WebX68kの画面" width="507" height="420" loading="lazy" />
  <small>画像：[Xの投稿](https://x.com/haruuraran/status/2084989176400031951)より</small>

- [**NOTE MDX Workbench**](https://github.com/ickaze/NOTE-MDX-Workbench) v2.10.0：ickazeさんの、X68000の音楽（MDX）を作る統合環境。note.x互換のMMLで書けて、FM音源の音色やPCM（PDX）も作れ、WAVやVGMにも書き出せます。無料、Windows
  <img src="/img/chiptune-tools/notemdxwb.webp" alt="NOTE MDX Workbenchの画面" width="560" height="315" loading="lazy" />
  <small>画像：[Xの投稿](https://x.com/ickaze/status/2114383336525484527)より</small>

- [**PDXEditor**](https://github.com/ickaze/PDXEditor) v1.1.1：ickazeさんの、X68000のPCM（PDX）を作る・直すツール。無料、Windows

- [**NoteMDX**](https://github.com/ickaze/noteMDX) 0.8 rev5：ickazeさんの、note.x互換のMMLをMDXに変えるコンバーター。無料、Windows

- [**IndependentMDX**](https://github.com/ickaze/IndependentMDX) 0.33.5：ickazeさんの、MDXやYM2151のVGMを再生するプレイヤー。無料、Windows

- [**OPMChord**](https://github.com/ickaze/OPMChord) 1.2.3：ickazeさんの、YM2151の1チャンネルで和音を鳴らす楽器。MIDIで弾けます。無料、Windows

- [**mxv2**](https://github.com/gorry/mxv2) 2026.1015.2：X68000の音楽（MDX）を再生して、演奏のようすも見られるプレイヤー。無料、Windows・Android
  <img src="/img/chiptune-tools/mxv2.webp" alt="mxv2の画面" width="303" height="420" loading="lazy" />

- [**VGMDRV**](https://sites.google.com/site/waveknife7/vgmdrv) 1.39：X68000の実機でVGMを鳴らすドライバー。追加の機器があれば、OPNやセガのPCMなどの曲も鳴らせます。無料

- [**NDP**](https://ndp.squares.net/web/) 1.51：MSX用のPSGドライバーと、そのMMLを書くためのエディター。ブラウザで使える「[NDP Online](https://ndp.squares.net/online/)」もあります。無料、Windows・ブラウザ
  <img src="/img/chiptune-tools/ndp.webp" alt="NDPの画面" width="560" height="403" loading="lazy" />

- [**MSXPLAYer**](https://msxplayer.net/wp/)：MSXアソシエーション公式のMSXエミュレーター。いまの版は、技術評論社の本「MSX-BASICでゲームを作ろう」を持っている人が使えます。Windows

## ブラウザで使えるソフト（無料） {#ja-browser}

インストールなしで、ブラウザを開くだけで作れます。曲はURLに保存されるので、URLを送るだけで共有できます。WAVやMIDIへの書き出しもできます。

- [**BeepBox**](https://www.beepbox.co/) 4.2.2：画面のマス目に音を置いていくだけで曲が作れる、いちばんシンプルな作曲ソフト。オフライン版もあります
  <img src="/img/chiptune-tools/beepbox.webp" alt="BeepBoxの画面" width="515" height="420" loading="lazy" />

- [**JummBox**](https://jummb.us/) 2.6：BeepBoxをもとに、ピッチベンドや細かい音量の調整などを足した派生版
  <img src="/img/chiptune-tools/jummbox.webp" alt="JummBoxの画面" width="515" height="420" loading="lazy" />

- [**UltraBox**](https://ultraabox.github.io/)：さまざまなBeepBox派生版の便利機能をひとまとめにしたバージョン。現在もっとも人気のある派生版の一つです
  <img src="/img/chiptune-tools/ultrabox.webp" alt="UltraBoxの画面" width="515" height="420" loading="lazy" />

- [**Slarmoo's Box**](https://slarmoo.github.io/slarmoosbox/) 1.4.11：UltraBoxをもとに、エフェクトや音量変化（エンベロープ）の設定などを増やした派生版
  <img src="/img/chiptune-tools/slarmoos-box.webp" alt="Slarmoo's Boxの画面" width="515" height="420" loading="lazy" />

- [**Efflux**](https://www.igorski.nl/application/efflux/) 3.1.1：ブラウザで動くトラッカー。ピアノロールでも打ち込めます。無料

- [**Bitphase**](https://bitphase.app/)：ブラウザで動く、PSG音源（AY-3-8910・YM2149）とファミコン用のトラッカー。無料
  <img src="/img/chiptune-tools/bitphase.webp" alt="Bitphaseの画面" width="560" height="366" loading="lazy" />
  <small>画像：[GitHub](https://github.com/paator/bitphase)より</small>

## MMLで書くソフト {#ja-mml}

曲を文字（MML）で書いて鳴らす方法です。

- [**FlMML on HTML5**](https://github.com/argentum384/flmml-on-html5) v2.0.3：Flashで動いていたMMLプレイヤー「FlMML」をブラウザで動くようにしたもの。WAVにも書き出せます。無料
  <img src="/img/chiptune-tools/flmml.webp" alt="FlMML on HTML5の画面" width="560" height="350" loading="lazy" />

- [**FAMIC on USB MML Playground**](https://famic.prioris.jp/mml/)：ブラウザでMMLを書いて鳴らせるページ。電子楽器「FAMIC on USB」に曲を書きこむこともできます。無料
  <img src="/img/chiptune-tools/famicmml.webp" alt="FAMIC on USB MML Playgroundの画面" width="560" height="294" loading="lazy" />

- [**NSF2MML**](https://famic.prioris.jp/mml/labo/nsf2mml)：ファミコンの音楽ファイル（NSF）をMMLに変えるブラウザのツール。無料
  <img src="/img/chiptune-tools/nsf2mml.webp" alt="NSF2MMLの画面" width="560" height="350" loading="lazy" />

- [**GameBoy Music Compiler（GBMC）**](http://mydocuments.g2.xrea.com/html/gb/sounddriver.html) 2025.07.31版：文字（MML）で曲を書いてGAMEBOYの音源で鳴らすソフト。曲データ（GBSファイル）やエミュレーター・実機で動くROMのほか、演奏のようすが見られるプレイヤー「GBDSP」としても書き出せます。無料、Windows
  <img src="/img/chiptune-tools/gbmc.webp" alt="GBMCで書き出したGBDSPの画面" width="336" height="342" loading="lazy" />

- [**browser-mml-player**](https://github.com/t-sin/browser-mml-player)：ブラウザで動くMMLプレイヤー。シンセのしくみを学ぶ記事のために作られたものです。無料
  <img src="/img/chiptune-tools/bmml.webp" alt="browser-mml-playerの画面" width="560" height="350" loading="lazy" />

- [**SiON**](https://github.com/keim/SiON)：MMLで鳴らすFlash用のソフトシンセ。今はGodot用（GDSiON）などに移されています。無料

- [**PMD**](http://www5.airnet.ne.jp/kajapon/tool.html) Ver.4.8s：PC-9801などのFM音源で鳴らすMMLのドライバー。WindowsではFMPMD2000などで再生できます。無料（ソースも公開）

- [**OFGS2tm**](https://x.com/EightbitMays/status/2086505645629718736) Ver0.93：ファミコン用のMMLのドライバー「OFGSv2」を、Maysさんが改造したもの。無料（Xの投稿から配布）

## 有料のプラグイン {#ja-paid-plugins}

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

- [**Junior**](https://fors.fm/junior)（Fors）：GAMEBOYの音源をもとにした、4bitの波形メモリのシンセ。自分で描いた32個の値の波形とノイズを、LSDjやM8のテーブルのようなモジュレーションで動かせます。実機をそのまま再現するのではなく、今のシンセとして使いやすく広げています。39ドル（機能をしぼった無料の「Junior-Lite」もあります）、Windows・Linux（VST3・CLAP）、Mac（VST3・CLAP・AUv2）
  <img src="/img/chiptune-tools/junior.webp" alt="Juniorの画面" width="420" height="420" loading="lazy" />

- [**inSIDious**](https://impactsoundworks.com/product/insidious/)：Impact Soundworksの、コモドール64の音源（SID）を再現した音源。64ドル（無料のReaktor Playerで動きます）
  <img src="/img/chiptune-tools/insidious.webp" alt="inSIDiousの画面" width="560" height="320" loading="lazy" />
  <small>画像：[Lospec](https://lospec.com/software/insidious/screenshots)より</small>

## サンプルパック {#ja-sample-packs}

- [**Bitkits**](https://www.uppercussion.com/products/bitkits)（Uppercussion）：8bitのドラムキット10種類。キックやスネア、ハイハットのほか、ピコピコした効果音もたくさん入っています。無料

- [**Shirobon Presents: Chiptune for Serum**](https://shirobon.bandcamp.com/album/shirobon-presents-chiptune-for-serum)（Shirobon）：定番シンセ「Serum」用のプリセット100種類と、GAMEBOYの実機から録音した波形・ノイズが入っています。15ポンドから（Serum 1.107以降が必要）

- [**Super Audio Cart 2**](https://impactsoundworks.com/product/super-audio-cart/)（Impact Soundworks）：Atari 2600からゲームボーイアドバンスまで、様々なレトロゲーム機の音を集めた定番の音源集（初代の音もすべて収録）。199ドル（無料の「Kontakt Player」を導入すれば、普段お使いのDAWですぐに鳴らせます）
  <img src="/img/chiptune-tools/super-audio-cart-2.webp" alt="Super Audio Cart 2の画面" width="560" height="373" loading="lazy" />

## 効果音を作るソフト {#ja-sfx}

ゲームの効果音のような短い音を、すぐに作れます。

- [**sfxr**](https://www.drpetter.se/project_sfxr.html)：ボタンひとつでレトロな効果音を作れる、元祖の効果音ソフト。無料、Windows（ブラウザ版もあります）
  <img src="/img/chiptune-tools/sfxr.webp" alt="sfxrの画面" width="541" height="420" loading="lazy" />
  <small>画像：[Lospec](https://lospec.com/software/sfxr/screenshots)より</small>

- [**Bfxr**](https://www.bfxr.net/)：sfxrに波形やフィルターを足したもの。ブラウザで動きます。無料
  <img src="/img/chiptune-tools/bfxr.webp" alt="Bfxrの画面" width="560" height="318" loading="lazy" />
  <small>画像：[Lospec](https://lospec.com/software/bfxr/screenshots)より</small>

- [**ChipTone**](https://sfbgames.itch.io/chiptone)：音を重ねて効果音を作るソフト。作った音は自由に使えます。無料（投げ銭可）、ブラウザ・Windows・Mac
  <img src="/img/chiptune-tools/chiptone.webp" alt="ChipToneの画面" width="560" height="315" loading="lazy" />

- [**LabChirp**](https://labbed.net/software/labchirp/) v1.75：最大8つの音を重ねて、音の波や強弱の変化（エンベロープ）、エフェクトを組み合わせて効果音を作るソフト。自動でランダム生成する機能もあります。「効果音制作だとこれが好き」とRei8bitさんもおすすめしています。無料、Windows（Mono経由でMac・Linuxも）
  <img src="/img/chiptune-tools/labchirp.webp" alt="LabChirpの画面" width="503" height="420" loading="lazy" />
  <small>画像：Rei8bitさん提供</small>

## 再生・変換・そのほか {#ja-players}

- [**LSDJ Converter**](https://defensemech.com/lsdj-to-midi)：LSDjの曲のファイルを、ブラウザでMIDIに変えるツール。DAWと一緒に使うときに便利です。無料
  <img src="/img/chiptune-tools/lsdj2midi.webp" alt="LSDJ Converterの画面" width="560" height="350" loading="lazy" />

- [**rePlayer**](https://github.com/arnaud-neny/rePlayer) v0.22.16：トラッカーの曲やチップチューンのファイルをたくさんの形式で再生できるプレイヤー。無料、Windows
  <img src="/img/chiptune-tools/replayer.webp" alt="rePlayerの画面" width="317" height="191" loading="lazy" />

- [**Open Cubic Player**](https://stian.cubic.org/project-ocp.php) v3.5.0：トラッカーの曲やチップチューンを、文字の画面で見ながら再生できるプレイヤー。無料、Windows・Mac・Linux
  <img src="/img/chiptune-tools/ocp.webp" alt="Open Cubic Playerの画面" width="539" height="420" loading="lazy" />
  <small>画像：[GitHub](https://github.com/mywave82/opencubicplayer)より</small>

- [**SNDH Player**](https://sndh.oxygenedemos.com/)：Atari STの音楽（SNDH）をブラウザで聴けるプレイヤー。無料
  <img src="/img/chiptune-tools/sndh.webp" alt="SNDH Playerの画面" width="560" height="350" loading="lazy" />

- [**Rustico**](https://rustico.reploid.cafe/)：音の正確さにこだわった、ファミコンのエミュレーター。鳴っている音をピアノロールのように見られます。ブラウザで動きます。無料

- [**Keitai World Launcher**](https://keitaiarchive.org/downloads.html)：日本のガラケー（iアプリ）のゲームをパソコンで動かすためのランチャー。iアプリを動かすソフト（openDoJaなどのエミュレーター）と、[Keitai Archive](https://keitaiarchive.org/)に保存されたゲームをまとめて管理できます。ガラケーのゲームの音楽を聴くのにも使えます。無料、Windows

## Shiruさんのツール（無料） {#ja-shiru}

Shiruさんが公開している音楽のツールです。どれも[Shiruさんのソフトウェアのページ](http://shiru.nedopc.com/software.shtml)からダウンロードできます。

- **1tracker** v0.47：ZX Spectrumのビーパー（1bit音）を中心に、さまざまな発音方式（エンジン）に対応した実験的なトラッカー。Windows
  <img src="/img/chiptune-tools/shiru-1tracker.webp" alt="1trackerの画面" width="560" height="361" loading="lazy" />

- **SNES Game Sound System** v1.42：スーパーファミコンの自作ゲーム用に、曲と効果音を作るためのトラッカーとドライバーのセット。Windows
  <img src="/img/chiptune-tools/shiru-snesgss.webp" alt="SNES Game Sound Systemの画面" width="560" height="383" loading="lazy" />

- **SnevenTracker mod**：スーパーファミコン用のトラッカー「SnevenTracker」を改造したもの

- **0CC-LLTracker**：0CC-FamiTrackerをもとに、FM音源チップ「YM2413（OPLL）」の音を鳴らせるようにしたもの

- **Yach*PMS** v1.02：昔の音楽機器「MuzCell」用のトラッカー。音を再現したWindows版もあります
  <img src="/img/chiptune-tools/shiru-yachpms.webp" alt="Yach*PMSの画面" width="560" height="361" loading="lazy" />

- **AYFX Editor** v0.7：PSG音源（AY-3-8910・YM2149）用の効果音エディター
  <img src="/img/chiptune-tools/shiru-ayfx.webp" alt="AYFX Editorの画面" width="560" height="414" loading="lazy" />

- **BeepFX** v1.2：ZX Spectrumのビーパー用の効果音エディター
  <img src="/img/chiptune-tools/shiru-beepfx.webp" alt="BeepFXの画面" width="519" height="420" loading="lazy" />

- **NSF2VGM** v1.1：FamiTrackerで作ったNSFを、VGMに変えるコマンドラインのツール

- **SuBoard**：キーボード付きのファミコン互換機（Subor互換機）を、ライブで弾けるチップチューンの楽器にするソフト

- **VSTプラグイン**：1bitの音を作る「1bitstudio」、昔の音源の特徴を混ぜたシンセ「ChipWave」とドラムシンセ「ChipDrum」、ファミコンの音源を再現してFamiTrackerの音色が使える「FTplug」、PSG音源を再現してVortex Tracker IIの音色が使える「VT2i」、ファミコンのDPCMの歪みを再現する「CrushDMC」、PCのスピーカーの音楽を作る「PCSPE」、フロッピードライブで鳴らす音楽を再現する「Flopster」など

- **SoundFont**：ZX Spectrumのビーパーの音（wtbeepなど）や、中国のおもちゃのピアノの音（BF-630、TX-5488Aなど）。レトロでチープな機器独特の響きを再現できるデータ（インパルス応答）もあります

## 機種別のトラッカーとツール {#ja-botb}

チップチューンの投稿コミュニティ「[Battle of the Bits](https://battleofthebits.com/)」の解説ページ（見るにはログインが必要）と、Atariのソフトのデータベース「[Atarimania](https://www.atarimania.com/)」に載っているトラッカーとツールのうち、ここまでに出てこなかったものを機種ごとにまとめました。「今なら○○」と書いてあるものは、いまはもっと使いやすいツールがあるものです。

### AdLib・OPL（パソコンのFM音源）

- [**Adlib Tracker II**](https://adlibtracker.net/downloads.php)：OPL3のFM音源（4オペレーター）用の、文字の画面のトラッカー。無料、DOS・Windows・Linux
  <img src="/img/chiptune-tools/botb-at2.webp" alt="Adlib Tracker IIの画面" width="400" height="266" loading="lazy" />
  <small>画像：[pouet.net](https://www.pouet.net/prod.php?which=63439)より</small>

- [**Reality Adlib Tracker (RAD 2)**](https://www.pouet.net/prod.php?which=75963)：小さな曲データ向けのOPLトラッカー。v2でOPL3に対応しました。無料、DOS・Windows・Mac
  <img src="/img/chiptune-tools/botb-rad.webp" alt="Reality Adlib Tracker (RAD 2)の画面" width="400" height="249" loading="lazy" />
  <small>画像：[pouet.net](https://www.pouet.net/prod.php?which=75963)より</small>

- [**Faust Music Creator**](https://www.pouet.net/prod.php?which=55235)：AdLib（OPL2）用の、キーボードだけで操作するDOSのトラッカー。今ならAdlib Tracker IIかFurnace
  <img src="/img/chiptune-tools/botb-fmc.webp" alt="Faust Music Creatorの画面" width="400" height="250" loading="lazy" />
  <small>画像：[pouet.net](https://www.pouet.net/prod.php?which=55235)より</small>

- [**Scream Tracker 3**](https://www.pouet.net/prod.php?which=13351)：1994年のDOSのトラッカー。S3M形式を生みました。今ならSchism TrackerかOpenMPT
  <img src="/img/chiptune-tools/botb-st3.webp" alt="Scream Tracker 3の画面" width="400" height="250" loading="lazy" />
  <small>画像：[pouet.net](https://www.pouet.net/prod.php?which=13351)より</small>

- **AMusic**（AdLib）

### Amiga

- [**ProTracker 2 clone (pt2-clone)**](https://16-bits.org/pt.php)：Amigaの「ProTracker 2」を、今のパソコンでそのまま使えるように作り直したもの。無料、Windows・Mac・Linux
  <img src="/img/chiptune-tools/botb-pt2clone.webp" alt="ProTracker 2 clone (pt2-clone)の画面" width="491" height="420" loading="lazy" />
  <small>画像：[GitHub](https://github.com/8bitbubsy/pt2-clone)より</small>

- [**HivelyTracker**](https://github.com/pete-gordon/hivelytracker)：AHXをもとにした、4〜16チャンネルのチップチューン用トラッカー。無料、Windows・Mac・Linuxなど
  <img src="/img/chiptune-tools/botb-hively.webp" alt="HivelyTrackerの画面" width="400" height="300" loading="lazy" />
  <small>画像：[pouet.net](https://www.pouet.net/prod.php?which=27777)より</small>

- [**ProTracker**](https://en.wikipedia.org/wiki/Protracker)：MOD形式のもとになった、Amigaの4チャンネルのトラッカー。今ならProTracker 2のクローンかOpenMPT
  <img src="/img/chiptune-tools/botb-protracker.webp" alt="ProTrackerの画面" width="525" height="420" loading="lazy" />
  <small>画像：[Wikipedia](https://en.wikipedia.org/wiki/Protracker)より</small>

- [**AHX Tracker**](http://amigascne.org/abyss/ahx/)：コモドール64のSIDのような音を、Amigaで合成して鳴らすトラッカー。今ならHivelyTracker
  <img src="/img/chiptune-tools/botb-ahx.webp" alt="AHX Trackerの画面" width="320" height="256" loading="lazy" />
  <small>画像：[pouet.net](https://www.pouet.net/prod.php?which=13329)より</small>

- [**DigiBooster 3**](http://www.digibooster.de/en/)：チャンネル数の多いAmigaのトラッカー。今ならOpenMPT
  <img src="/img/chiptune-tools/botb-digibooster.webp" alt="DigiBooster 3の画面" width="324" height="259" loading="lazy" />
  <small>画像：[pouet.net](https://www.pouet.net/prod.php?which=52297)より</small>

- [**OctaMED**](https://en.wikipedia.org/wiki/OctaMED)：8チャンネルを鳴らせるAmigaのトラッカー。今ならOpenMPTかProTracker 2のクローン
  <img src="/img/chiptune-tools/botb-octamed.webp" alt="OctaMEDの画面" width="480" height="360" loading="lazy" />
  <small>画像：[YouTubeの動画](https://www.youtube.com/watch?v=5drbU51Ag6A)より</small>

### Atari 2600

- [**TIATracker**](https://bitbucket.org/kylearan/tiatracker) 1.3.1：Atari 2600の音源（TIA）で曲を作るためのトラッカーと再生ルーチン。無料、Windows・Mac・Linux
  <img src="/img/chiptune-tools/botb-tiatracker.webp" alt="TIATrackerの画面" width="391" height="300" loading="lazy" />
  <small>画像：[pouet.net](https://www.pouet.net/prod.php?which=67648)より</small>

- [**LoopCart**](https://www.qotile.net/loopcart.html)：Atari 2600の実機で動く、作りかけのループシーケンサー。今ならTIATrackerかFurnace
  <img src="/img/chiptune-tools/botb-loopcart.webp" alt="LoopCartの画面" width="320" height="240" loading="lazy" />
  <small>画像：[Internet Archiveに残るページ](https://web.archive.org/web/20071022100656/http://qotile.net/loopcart.html)より</small>

### Atari ST（YM2149・サンプル）

- [**maxYMiser**](https://www.preromanbritain.com/maxymiser/)：Atari STの実機で動く、YM2149用のトラッカー。MIDIにも対応。無料、Atari ST（実機またはエミュレーター）
  <img src="/img/chiptune-tools/botb-maxymiser.webp" alt="maxYMiserの画面" width="320" height="200" loading="lazy" />
  <small>画像：[pouet.net](https://www.pouet.net/prod.php?which=85078)より</small>

- [**MusicMon**](https://dhs.nu/files.php?t=single&ID=52)：Atari STの実機で動くトラッカー。今ならmaxYMiser
  <img src="/img/chiptune-tools/botb-musicmon.webp" alt="MusicMonの画面" width="320" height="200" loading="lazy" />
  <small>画像：[pouet.net](https://www.pouet.net/prod.php?which=18929)より</small>

- [**PSG Tracker**](https://www.atarimania.com/games/atari-st-utilities-psg-tracker-22030)：YM2149用の、フィンランドで作られたトラッカー（1992年）。今ならmaxYMiser
  <img src="/img/chiptune-tools/atari-psg-tracker.webp" alt="PSG Trackerの画面" width="560" height="350" loading="lazy" />
  <small>画像：[Atarimania](https://www.atarimania.com/games/atari-st-utilities-psg-tracker-22030)より</small>

- [**The Music Studio**](https://www.atarimania.com/games/atari-st-utilities-music-studio-the-36357)：Activisionの楽譜の作曲ソフトのST版。STの音源かMIDIで鳴らします（1986年）。今ならmaxYMiserかFurnace
  <img src="/img/chiptune-tools/atari-music-studio-st.webp" alt="The Music Studioの画面" width="560" height="350" loading="lazy" />
  <small>画像：[Atarimania](https://www.atarimania.com/games/atari-st-utilities-music-studio-the-36357)より</small>

- [**Quartet**](https://www.atarimania.com/games/atari-st-utilities-quartet-29599)：サンプルの楽器4音を、楽譜で打ち込んで鳴らすソフト（1990年）。今ならFurnaceやOpenMPT（STの実機ならmaxYMiser）
  <img src="/img/chiptune-tools/atari-quartet.webp" alt="Quartetの画面" width="320" height="200" loading="lazy" />
  <small>画像：[Atarimania](https://www.atarimania.com/games/atari-st-utilities-quartet-29599)より</small>

- [**Audio Sculpture**](https://www.atarimania.com/games/atari-st-utilities-audio-sculpture-25173)：AmigaのMOD風の、4チャンネルのサンプルのトラッカー（1990年）。今ならFurnaceやOpenMPT（STの実機ならmaxYMiser）
  <img src="/img/chiptune-tools/atari-audio-sculpture.webp" alt="Audio Sculptureの画面" width="560" height="317" loading="lazy" />
  <small>画像：[Atarimania](https://www.atarimania.com/games/atari-st-utilities-audio-sculpture-25173)より</small>

- [**TCB Tracker**](https://www.atarimania.com/games/atari-st-utilities-tcb-tracker-31405)：デモグループThe Carebearsの、4チャンネルのサンプルのトラッカー（1990年）。今ならFurnaceやOpenMPT（STの実機ならmaxYMiser）
  <img src="/img/chiptune-tools/atari-tcb-tracker.webp" alt="TCB Trackerの画面" width="320" height="200" loading="lazy" />
  <small>画像：[Atarimania](https://www.atarimania.com/games/atari-st-utilities-tcb-tracker-31405)より</small>

- [**ProTracker ST**](https://www.atarimania.com/games/atari-st-utilities-protracker-st-30690)：ProTrackerのST版。4チャンネルのMOD曲を作れるソフト。今ならFurnaceやOpenMPT（STの実機ならmaxYMiser）
  <img src="/img/chiptune-tools/atari-protracker-st.webp" alt="ProTracker STの画面" width="320" height="200" loading="lazy" />
  <small>画像：[Atarimania](https://www.atarimania.com/games/atari-st-utilities-protracker-st-30690)より</small>

- [**The Empire Noisetracker (ST-NoiseTracker)**](https://www.atarimania.com/games/atari-st-utilities-empire-noisetracker-the-30689)：AmigaのSoundtrackerやNoisetrackerをもとにした、STのトラッカー。今ならFurnaceやOpenMPT（STの実機ならmaxYMiser）
  <img src="/img/chiptune-tools/atari-empire-noisetracker.webp" alt="The Empire Noisetracker (ST-NoiseTracker)の画面" width="320" height="200" loading="lazy" />
  <small>画像：[Atarimania](https://www.atarimania.com/games/atari-st-utilities-empire-noisetracker-the-30689)より</small>

- [**The HMS Soundtracker**](https://www.atarimania.com/games/atari-st-utilities-hms-soundtracker-the-23807)：フランスで売られていた、MIDIにも対応したサンプルのトラッカー。今ならFurnaceやOpenMPT（STの実機ならmaxYMiser）
  <img src="/img/chiptune-tools/atari-hms-soundtracker.webp" alt="The HMS Soundtrackerの画面" width="320" height="200" loading="lazy" />
  <small>画像：[Atarimania](https://www.atarimania.com/games/atari-st-utilities-hms-soundtracker-the-23807)より</small>

- [**Hyper Sound Digital**](https://www.atarimania.com/games/atari-st-utilities-hyper-sound-digital-27492)：Delphine Softwareの、3チャンネルのトラッカー。今ならFurnaceやOpenMPT（STの実機ならmaxYMiser）
  <img src="/img/chiptune-tools/atari-hyper-sound-digital.webp" alt="Hyper Sound Digitalの画面" width="320" height="200" loading="lazy" />
  <small>画像：[Atarimania](https://www.atarimania.com/games/atari-st-utilities-hyper-sound-digital-27492)より</small>

### Atari 8bit（POKEY）

- [**Raster Music Tracker**](http://raster.infos.cz/atari/rmt/rmt.htm)：Atari 8bitの音源（POKEY）用の、Windowsのトラッカー。無料、Windows
  <img src="/img/chiptune-tools/botb-rmt.webp" alt="Raster Music Trackerの画面" width="400" height="300" loading="lazy" />

- [**Chaos Music Composer**](https://atariki.krap.pl/index.php/Chaos_Music_Composer)：Atari 8bitの実機で動く、ポーランドで人気だった作曲ソフト。今ならRaster Music TrackerかFurnace
  <img src="/img/chiptune-tools/atari-chaos-music-composer.webp" alt="Chaos Music Composerの画面" width="336" height="240" loading="lazy" />
  <small>画像：[Atarimania](https://www.atarimania.com/games/atari-400-800-xl-xe-utilities-chaos-music-composer-37606)より</small>
  <img src="/img/chiptune-tools/botb-cmc.webp" alt="Chaos Music Composerの画面" width="336" height="240" loading="lazy" />
  <small>画像：[Atariki](https://atariki.krap.pl/index.php/Chaos_Music_Composer)より</small>

- [**Delta Music Composer**](https://atariki.krap.pl/index.php/Delta_Music_Composer)：1990年代半ばのAtari 8bitの作曲ソフト。今ならRaster Music TrackerかFurnace
  <img src="/img/chiptune-tools/botb-dmc-atari.webp" alt="Delta Music Composerの画面" width="336" height="240" loading="lazy" />
  <small>画像：[Atariki](https://atariki.krap.pl/index.php/Delta_Music_Composer)より</small>

- [**Music ProTracker**](https://atariki.krap.pl/index.php/Music_ProTracker)：サンプルも使える、Atari 8bitの作曲ソフト。今ならRaster Music TrackerかFurnace
  <img src="/img/chiptune-tools/botb-mpt.webp" alt="Music ProTrackerの画面" width="336" height="241" loading="lazy" />
  <small>画像：[Atariki](https://atariki.krap.pl/index.php/Music_ProTracker)より</small>

- [**Theta Music Composer**](https://atariki.krap.pl/index.php/Theta_Music_Composer)：Atari 8bitで、はじめて8チャンネルの曲を作れた作曲ソフト。今ならRaster Music TrackerかFurnace
  <img src="/img/chiptune-tools/botb-tmc.webp" alt="Theta Music Composerの画面" width="336" height="240" loading="lazy" />
  <small>画像：[Atariki](https://atariki.krap.pl/index.php/Theta_Music_Composer)より</small>

- [**Music Composer**](https://www.atarimania.com/games/atari-400-800-xl-xe-utilities-music-composer-15784)：Atari純正の、4音の曲を打ち込んで鳴らすカートリッジ（1979年）。今ならRaster Music TrackerかFurnace
  <img src="/img/chiptune-tools/atari-music-composer.webp" alt="Music Composerの画面" width="384" height="240" loading="lazy" />
  <small>画像：[Atarimania](https://www.atarimania.com/games/atari-400-800-xl-xe-utilities-music-composer-15784)より</small>

- [**Advanced MusicSystem**](https://www.atarimania.com/games/atari-400-800-xl-xe-utilities-advanced-musicsystem-27136)：POKEYの曲を小節ごとに打ち込める、APXの作曲ソフト（1982年）。今ならRaster Music TrackerかFurnace
  <img src="/img/chiptune-tools/atari-advanced-musicsystem.webp" alt="Advanced MusicSystemの画面" width="384" height="240" loading="lazy" />
  <small>画像：[Atarimania](https://www.atarimania.com/games/atari-400-800-xl-xe-utilities-advanced-musicsystem-27136)より</small>

- [**Sound Editor**](https://www.atarimania.com/games/atari-400-800-xl-xe-utilities-sound-editor-29817)：POKEYの効果音を作る、APXのソフト（1981年）。今ならRaster Music TrackerかFurnace
  <img src="/img/chiptune-tools/atari-sound-editor.webp" alt="Sound Editorの画面" width="336" height="224" loading="lazy" />
  <small>画像：[Atarimania](https://www.atarimania.com/games/atari-400-800-xl-xe-utilities-sound-editor-29817)より</small>

- [**Music Construction Set**](https://www.atarimania.com/games/atari-400-800-xl-xe-utilities-music-construction-set-14317)：五線譜に音符を置いて作曲する、Electronic Artsのソフト（1984年）。今ならRaster Music TrackerかFurnace
  <img src="/img/chiptune-tools/atari-music-construction-set-8bit.webp" alt="Music Construction Setの画面" width="336" height="240" loading="lazy" />
  <small>画像：[Atarimania](https://www.atarimania.com/games/atari-400-800-xl-xe-utilities-music-construction-set-14317)より</small>

- [**Bank Street MusicWriter**](https://www.atarimania.com/games/atari-400-800-xl-xe-utilities-bank-street-musicwriter-29755)：五線譜で作曲して、印刷もできるソフト（1984年）。今ならRaster Music TrackerかFurnace
  <img src="/img/chiptune-tools/atari-bank-street-musicwriter.webp" alt="Bank Street MusicWriterの画面" width="384" height="240" loading="lazy" />
  <small>画像：[Atarimania](https://www.atarimania.com/games/atari-400-800-xl-xe-utilities-bank-street-musicwriter-29755)より</small>

- [**The Music Studio**](https://www.atarimania.com/games/atari-400-800-xl-xe-utilities-music-studio-the-14318)：Activisionの、楽譜で作曲するソフト（1986年）。今ならRaster Music TrackerかFurnace
  <img src="/img/chiptune-tools/atari-music-studio-8bit.webp" alt="The Music Studioの画面" width="336" height="224" loading="lazy" />
  <small>画像：[Atarimania](https://www.atarimania.com/games/atari-400-800-xl-xe-utilities-music-studio-the-14318)より</small>

- [**The Rhythm Composer**](https://www.atarimania.com/games/atari-400-800-xl-xe-utilities-rhythm-composer-the-30576)：バスドラム、スネア、ハイハット、手拍子でリズムを組むソフト（1986年）。今ならRaster Music TrackerかFurnace
  <img src="/img/chiptune-tools/atari-rhythm-composer.webp" alt="The Rhythm Composerの画面" width="384" height="240" loading="lazy" />
  <small>画像：[Atarimania](https://www.atarimania.com/games/atari-400-800-xl-xe-utilities-rhythm-composer-the-30576)より</small>

- [**Sound Tracker**](https://www.atarimania.com/games/atari-400-800-xl-xe-utilities-sound-tracker-30280)：ポーランドで作られた、パターンで打ち込むPOKEYのトラッカー（1992年）。今ならRaster Music TrackerかFurnace
  <img src="/img/chiptune-tools/atari-sound-tracker-asf.webp" alt="Sound Trackerの画面" width="336" height="240" loading="lazy" />
  <small>画像：[Atarimania](https://www.atarimania.com/games/atari-400-800-xl-xe-utilities-sound-tracker-30280)より</small>

### DOSのモジュール（MOD・S3M・XM・IT）

- [**FT2 clone (ft2-clone)**](https://16-bits.org/ft2.php)：XM形式を生んだ「FastTracker II」を、今のパソコンでそのまま使えるように作り直したもの。無料、Windows・Mac・Linux
  <img src="/img/chiptune-tools/botb-ft2clone.webp" alt="FT2 clone (ft2-clone)の画面" width="560" height="371" loading="lazy" />
  <small>画像：[GitHub](https://github.com/8bitbubsy/ft2-clone)より</small>

- [**FastTracker II**](https://www.pouet.net/prod.php?which=13350)：1994年のDOSのトラッカー。XM形式を生みました。今ならFT2 cloneかMilkyTracker
  <img src="/img/chiptune-tools/botb-ft2.webp" alt="FastTracker IIの画面" width="400" height="253" loading="lazy" />
  <small>画像：[pouet.net](https://www.pouet.net/prod.php?which=13350)より</small>

- [**Impulse Tracker**](https://en.wikipedia.org/wiki/Impulse_Tracker)：IT形式を生んだDOSのトラッカー。最後の版は1999年です。今ならSchism Tracker
  <img src="/img/chiptune-tools/botb-it.webp" alt="Impulse Trackerの画面" width="560" height="350" loading="lazy" />
  <small>画像：[Wikipedia](https://en.wikipedia.org/wiki/Impulse_Tracker)より</small>

- [**ChibiTracker**](https://sourceforge.net/projects/chibitracker.berlios/files)：Impulse Trackerに似た、オープンソースのトラッカー。今ならSchism TrackerかOpenMPT
  <img src="/img/chiptune-tools/botb-chibi.webp" alt="ChibiTrackerの画面" width="400" height="292" loading="lazy" />
  <small>画像：[pouet.net](https://www.pouet.net/prod.php?which=27385)より</small>

- [**Composer 669**](https://www.pouet.net/prod.php?which=63357)：1992年の、8チャンネルのDOSのトラッカー。今ならOpenMPTかSchism Tracker
  <img src="/img/chiptune-tools/botb-c669.webp" alt="Composer 669の画面" width="400" height="250" loading="lazy" />
  <small>画像：[pouet.net](https://www.pouet.net/prod.php?which=63357)より</small>

### コモドール64

- [**CheeseCutter**](https://github.com/theyamo/CheeseCutter)：作った曲をコモドール64の実機で鳴らせる、SIDのトラッカー。無料、Windows・Linux
  <img src="/img/chiptune-tools/botb-cheesecutter.webp" alt="CheeseCutterの画面" width="381" height="300" loading="lazy" />
  <small>画像：[pouet.net](https://www.pouet.net/prod.php?which=58650)より</small>

- [**DMC (Demo Music Creator)**](http://tnd64.unikat.sk/music_scene.html)：1990年からある、コモドール64の実機で動く作曲ソフト。今ならGTUltraかCheeseCutter
  <img src="/img/chiptune-tools/botb-dmc.webp" alt="DMC (Demo Music Creator)の画面" width="384" height="271" loading="lazy" />
  <small>画像：[pouet.net](https://www.pouet.net/prod.php?which=13452)より</small>

### GAMEBOY・GBA

- [**Carillon Editor**](http://gbdev.gg8.se/files/musictools/Aleksi%20Eeben/Carillon%20Editor.zip)：GAMEBOYの実機で動く作曲ソフトと再生エンジン。今ならLSDjかhUGETracker
  <img src="/img/chiptune-tools/botb-carillon.webp" alt="Carillon Editorの画面" width="320" height="288" loading="lazy" />
  <small>画像：[pouet.net](https://www.pouet.net/prod.php?which=17337)より</small>

- [**Paragon5**](http://www.nullsleep.com/programs/p5_tracker.zip)：GAMEBOYの音源用の、Windowsのトラッカー。今ならhUGETrackerかFurnace
  <img src="/img/chiptune-tools/botb-paragon5.webp" alt="Paragon5の画面" width="480" height="360" loading="lazy" />
  <small>画像：[YouTubeの動画](https://www.youtube.com/watch?v=oiy5dEgV9-s)より</small>

- [**BoyScout**](https://www.gbadev.org/tools.php?showinfo=187)：GAMEBOYの4チャンネル用の、Windowsのトラッカー。今ならhUGETrackerかFurnace

- [**Fatass Tracker**](http://jeremyevers.com/fatass/)：GAMEBOYカラーの実機で動く、FastTracker II風のトラッカー。今ならLSDj
  <img src="/img/chiptune-tools/botb-fatass.webp" alt="Fatass Trackerの画面" width="320" height="288" loading="lazy" />
  <small>画像：[Internet Archiveに残るページ](https://web.archive.org/web/20110203021118/http://jeremyevers.com/fatass/)より</small>

- [**Furious Advance Tracker**](https://github.com/cbrouillard/furiousadvancetracker)：GBAで動く、LSDjに似たトラッカー。今ならLSDjかFurnace
  <img src="/img/chiptune-tools/botb-fat.webp" alt="Furious Advance Trackerの画面" width="480" height="320" loading="lazy" />

- [**M4G Tracker**](http://web.archive.org/web/20160524034134/http://m4gtracker.stereoboom.com:80/)：GBAで動くFastTracker II風のトラッカー。ベータ版のまま開発が止まりました。今ならFurnace
  <img src="/img/chiptune-tools/botb-m4g.webp" alt="M4G Trackerの画面" width="480" height="360" loading="lazy" />
  <small>画像：[YouTubeの動画](https://www.youtube.com/watch?v=ginsOUNahxw)より</small>

- **Ditty Editor**（GBA）

### ファミコン

- [**j0CC-FamiTracker**](https://github.com/nyanpasu64/j0CC-FamiTracker)：0CC-FamiTrackerの不具合を直した派生版。今ならその後継のDn-FamiTracker
  <img src="/img/chiptune-tools/botb-j0cc.webp" alt="j0CC-FamiTrackerの画面" width="480" height="360" loading="lazy" />
  <small>画像：[YouTubeの動画](https://www.youtube.com/watch?v=899ZnSlLk3Q)より</small>

- [**NerdTracker II**](https://www.nesdev.org/nt2/)：昔のNSFの多くを生んだ、DOSのファミコンのトラッカー。今ならDn-FamiTrackerかFurnace
  <img src="/img/chiptune-tools/botb-nt2.webp" alt="NerdTracker IIの画面" width="474" height="402" loading="lazy" />
  <small>画像：[pouet.net](https://www.pouet.net/prod.php?which=17650)より</small>

- [**NesTracker**](https://www.pouet.net/prod.php?which=56165)：NSFを書き出せる、ファミコンの音源用のトラッカー。今ならDn-FamiTrackerかFurnace
  <img src="/img/chiptune-tools/botb-nestracker.webp" alt="NesTrackerの画面" width="358" height="300" loading="lazy" />
  <small>画像：[pouet.net](https://www.pouet.net/prod.php?which=56165)より</small>

- [**Musetracker**](https://files.scene.org/view/resources/music/trackers/musetracker-v15.zip)：PCMに強い、ファミコンの音源用のトラッカー。今ならDn-FamiTrackerかFurnace
  <img src="/img/chiptune-tools/botb-musetracker.webp" alt="Musetrackerの画面" width="530" height="418" loading="lazy" />
  <small>画像：[pouet.net](https://www.pouet.net/prod.php?which=56336)より</small>

### セガ（マスターシステム・メガドライブ）

- [**Genny**](https://github.com/superjoebob/genny) v1.54 Beta：メガドライブ（YM2612・SN76489）の音源を再現したVSTプラグイン。VGMにも書き出せます。無料、Windows
  <img src="/img/chiptune-tools/botb-genny.webp" alt="Gennyの画面" width="560" height="324" loading="lazy" />

- [**Mod2PSG2**](https://www.smspower.org/Music/Mod2PSG2)：マスターシステム・ゲームギアの音源（SN76489）用のトラッカー。今ならFurnaceかDefleMask
  <img src="/img/chiptune-tools/botb-mod2psg2.webp" alt="Mod2PSG2の画面" width="480" height="360" loading="lazy" />
  <small>画像：[YouTubeの動画](https://www.youtube.com/watch?v=1f7JuZaTqXg)より</small>

- [**SnevenTracker**](https://github.com/HertzDevil/SnevenTracker)：FamiTrackerを改造して、SN76489の音源を鳴らせるようにしたもの。今ならFurnace
  <img src="/img/chiptune-tools/botb-sneven.webp" alt="SnevenTrackerの画面" width="480" height="360" loading="lazy" />
  <small>画像：[YouTubeの動画](https://www.youtube.com/watch?v=5N7ym-jQNUg)より</small>

- [**VGM Music Maker**](http://shiru.untergrund.net/)：メガドライブのFM音源とPSG用の、VGMを書き出せるトラッカー。今ならFurnaceかDefleMask
  <img src="/img/chiptune-tools/botb-vgmmm.webp" alt="VGM Music Makerの画面" width="480" height="360" loading="lazy" />
  <small>画像：[YouTubeの動画](https://www.youtube.com/watch?v=InvoZSQp_gg)より</small>

- [**TFM Music Maker**](http://shiru.untergrund.net/)：メガドライブのFM音源（YM2612）用の、VGMを書き出せるトラッカー。今ならFurnaceかDefleMask
  <img src="/img/chiptune-tools/botb-tfmmm.webp" alt="TFM Music Makerの画面" width="300" height="300" loading="lazy" />
  <small>画像：[pouet.net](https://www.pouet.net/prod.php?which=53467)より</small>

### ZX Spectrum

- [**Beepola**](https://freestuff.grok.co.uk/beepola/) v1.08.01：ZX Spectrumのビーパー用のトラッカー。無料、Windows
  <img src="/img/chiptune-tools/botb-beepola.webp" alt="Beepolaの画面" width="560" height="386" loading="lazy" />

- [**Sound-Tracker (ZX)**](https://spectrumcomputing.co.uk/alt/25080/ZX-Spectrum/Soundtracker)：1990年ごろの、ZX Spectrumの実機で動くAY音源の作曲ソフト。今ならVortex Tracker
  <img src="/img/chiptune-tools/botb-zx-soundtracker.webp" alt="Sound-Tracker (ZX)の画面" width="512" height="384" loading="lazy" />

- [**SQ-Tracker**](https://worldofspectrum.org/archive/software/utilities/sq-tracker-proxima-software)：1993年の、ZX Spectrum 128Kの実機で動くAY音源のトラッカー。今ならVortex Tracker
  <img src="/img/chiptune-tools/botb-sqtracker.webp" alt="SQ-Trackerの画面" width="512" height="384" loading="lazy" />

### VIC-20

- [**baby-k (vixxen20)**](https://langel.github.io/vixxen20/) v0.8.2：ブラウザで動く、VIC-20用のトラッカー。無料
  <img src="/img/chiptune-tools/botb-babyk.webp" alt="baby-k (vixxen20)の画面" width="480" height="360" loading="lazy" />
  <small>画像：[YouTubeの動画](https://www.youtube.com/watch?v=BBclnLIG3aI)より</small>

- [**VIC-TRACKER**](http://www.kahlin.net/daniel/victracker/)：VIC-20の実機で動くトラッカー。今ならbaby-kかFurnace
  <img src="/img/chiptune-tools/botb-victracker.webp" alt="VIC-TRACKERの画面" width="400" height="333" loading="lazy" />

### ニンテンドーDS

- [**NitroTracker**](https://github.com/0xtob/nitrotracker)：ニンテンドーDSで動く、FastTracker II風のトラッカー。タッチペンで操作します。今なら、3DSではcitratracker、パソコンではFurnaceかMilkyTracker
  <img src="/img/chiptune-tools/botb-nitro.webp" alt="NitroTrackerの画面" width="200" height="300" loading="lazy" />
  <small>画像：[pouet.net](https://www.pouet.net/prod.php?which=24323)より</small>

- [**KORG DS-10**](https://en.wikipedia.org/wiki/KORG_DS-10)：ニンテンドーDSで動く、KORGのシンセ（MS-20風）とドラムのソフト。今ならiPhone・iPad用のKORG iDS-10
  <img src="/img/chiptune-tools/botb-ds10.webp" alt="KORG DS-10の画面" width="434" height="420" loading="lazy" />
  <small>画像：[Wikimedia Commons](https://commons.wikimedia.org/wiki/File:KORG_DS-10.jpg)より</small>

- [**Mario Paint Composer DS**](https://github.com/DerrickGold/MarioPaintComposer-NDS)：ニンテンドーDSで動く、マリオペイント風の作曲ソフト。今ならパソコン用のSuper Mario Paint
  <img src="/img/chiptune-tools/botb-mpcds.webp" alt="Mario Paint Composer DSの画面" width="256" height="384" loading="lazy" />

- **ProteinDS**（ニンテンドーDS）

- **Seno DS**（ニンテンドーDS）

### Channel F

- [**Sleizsa Trio**](https://github.com/utz82/SleizsaTrio) v0.1：Fairchild Channel Fで3チャンネルを鳴らせる音楽ルーチン。XMのトラッカーやブラウザで作曲できます。無料

- [**Sleizsa**](https://web.archive.org/web/20170926123546/http://average.truechiptilldeath.com/channelf/sleizsa_v0_31.zip)：Channel F用の、1音だけのシーケンサー（2008年）。今ならSleizsa Trio

- [**Sleizsa Duo**](https://github.com/utz82/SleizsaDuo)：Channel Fで2チャンネルを鳴らせる音楽ルーチン（2015年）。今ならSleizsa Trio

### Mario Paint

- [**Mario Sequencer**](https://github.com/minghai/MarioSequencer)：マリオペイント風の作曲ソフト。Windows版とブラウザ版があります。今ならパソコン用のSuper Mario Paint
  <img src="/img/chiptune-tools/botb-mariosequencer.webp" alt="Mario Sequencerの画面" width="413" height="420" loading="lazy" />

### 携帯型・そのほかのトラッカー

- [**LittleGPTracker (Little Piggy Tracker)**](https://github.com/djdiskmachine/LittleGPTracker) 1.5.0：LSDjに似た、8チャンネルのサンプルのトラッカー。picoTrackerのもとになったソフトです。無料、Windows・Mac・Linux・携帯ゲーム機など
  <img src="/img/chiptune-tools/botb-lgpt.webp" alt="LittleGPTracker (Little Piggy Tracker)の画面" width="560" height="420" loading="lazy" />
  <small>画像：[Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Little_Game_Park_Tracker_(LGPT,_aka_Piggy_Tracker)より</small>

- [**ProTrekkr**](https://github.com/hitchhikr/protrekkr) v2.8.3_PRE_2：デモやイントロのための、データの小さな曲を作るトラッカー兼シンセ。無料、Windows・Mac・Linux
  <img src="/img/chiptune-tools/botb-protrekkr.webp" alt="ProTrekkrの画面" width="400" height="298" loading="lazy" />

- [**klystrack**](https://kometbomb.github.io/klystrack/)：SIDやファミコン風の音を合成できる、チップチューン用のトラッカー。無料、Windows・Mac・Linux
  <img src="/img/chiptune-tools/botb-klystrack.webp" alt="klystrackの画面" width="560" height="420" loading="lazy" />

- [**Radium**](https://radium.dog/) 8.2.55：音符やオートメーションを画面上で描ける、トラッカー風の作曲ソフト。体験版は無料、Windows・Mac・Linux
  <img src="/img/chiptune-tools/botb-radium.webp" alt="Radiumの画面" width="560" height="315" loading="lazy" />

- [**Polyend Tracker**](https://polyend.com/tracker/)：単体で動くハードウェアのトラッカー。いまはTracker+とTracker Miniもあります
  <img src="/img/chiptune-tools/botb-polyend.webp" alt="Polyend Trackerの画面" width="420" height="420" loading="lazy" />
  <small>画像：[Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Polyend_Tracker_Standalone_Audio_Workstation.jpg)より</small>

### MML・スクリプト

- [**HuSIC**](https://github.com/BouKiCHi/HuSIC)：PCエンジン用のMMLのドライバー。無料

- [**XPMCK**](http://jiggawatt.org/muzak/xpmck/)：コモドール64、GAMEBOY、PCエンジン、マスターシステム、メガドライブなどに対応したMMLのコンパイラー。今ならFurnaceか、機種ごとのMMLのドライバー

- [**athtune**](http://ftp.modland.com/pub/software/trackers/Windows/Athtune/)：C#で音を定義する、MMLに近いスクリプトの作曲ツール。今ならFurnaceかMMLのコンパイラー

- **NDS BGMFILER**（ニンテンドーDS）

### 携帯電話の着メロ

- [**Nite (Nokia Internal Tune Editor)**](http://onj3.andrelouis.com/phonetones/Software%20and%20Soundbanks/Software/Nokia/Nokia%20Internal%20Tune%20Editor.zip)：Nokiaの社内で使われていた、単音の着メロを作るツール

- **Nokia PC Composer**（Windows）

- **CMX Studio**（Windows）

- **ATS-MA SMAF tools**（Windows）

### 補助ツール・プレイヤー

- [**LSDPatch**](https://github.com/jkotlinski/lsdpatch) v1.13.3：LSDjの曲の管理と、ROMのカスタマイズ（ドラムキット、フォント、色）ができるツール。無料、Windows・Mac・Linux
  <img src="/img/chiptune-tools/botb-lsdpatch.webp" alt="LSDPatchの画面" width="480" height="360" loading="lazy" />
  <small>画像：[YouTubeの動画](https://www.youtube.com/watch?v=rXWofyfodG8)より</small>

- [**GBT Player**](https://github.com/AntonioND/gbt-player) v4.4.1：GAMEBOYやGBAの自作ゲームで曲を鳴らすためのライブラリと変換ツール。無料

- [**SNESMOD**](https://github.com/mukunda-/snesmod)：ITの曲を、スーパーファミコンで鳴らせるデータ（SPC）に変えるツール。無料
  <img src="/img/chiptune-tools/botb-snesmod.webp" alt="SNESMODの画面" width="480" height="360" loading="lazy" />
  <small>画像：[YouTubeの動画](https://www.youtube.com/watch?v=d_ZII9GdDBQ)より</small>

- [**Maxmod**](https://maxmod.org/) v2.1.0：GBAやDSの自作ゲームで、MOD・XM・ITなどの曲を鳴らすライブラリ。無料
  <img src="/img/chiptune-tools/botb-maxmod.webp" alt="Maxmodの画面" width="512" height="384" loading="lazy" />

- [**NSFPlay**](https://bbbradsmith.github.io/nsfplay/) 2.6：ファミコンの音楽ファイル（NSF）を正確に鳴らすプレイヤー。無料、Windows
  <img src="/img/chiptune-tools/botb-nsfplay.webp" alt="NSFPlayの画面" width="373" height="115" loading="lazy" />
  <small>画像：[GitHub](https://github.com/bbbradsmith/nsfplay)より</small>

- [**FMPMD2000**](http://c60.la.coocan.jp/fmpmd.html)：PC-88・PC-98のPMDの曲を、Windowsで鳴らすプレイヤー。無料

- [**it2nsf**](https://github.com/mukunda-/it2nsf)：ITの曲をNSFに変えるツール。今ならDn-FamiTrackerかFurnace

- [**s3m2nsf**](https://github.com/mukunda-/s3m2nsf)：S3Mの曲をNSFに変えるツール。今ならDn-FamiTrackerかFurnace

- [**it2vgm.py**](http://web.archive.org/web/20101123045821/http://pubacc.wilcox-tech.com/~greaser/stuff/it2vgm.py.txt)：ITの曲を、SN76489用のVGMに変えるPythonのスクリプト。今ならFurnace

- [**FTM2GBMC**](https://github.com/Savestate2A03/FTM2GBMC)：FamiTrackerの曲を、GBMCのMMLに変えるツール。今ならFurnaceかhUGETracker

- [**VirtuaNSF**](http://virtuanes.s1.xrea.com/)：エミュレーター「VirtuaNES」をもとにした、NSFのプレイヤー。今ならNSFPlay

- [**hoot**](http://dmpsoft.s17.xrea.com/hoot/)：日本のパソコンやゲーム機の音楽を、音源を再現して鳴らすプレイヤー。Windows
  <img src="/img/chiptune-tools/botb-hoot.webp" alt="hootの画面" width="525" height="420" loading="lazy" />

- **Mumml**（Windows）

- **OpenSPC**（DOS・Windows）

## もっと知りたい人へ {#ja-more}

ここに載せていない、よりマニアックなトラッカーやツールは、チップチューンの投稿コミュニティ「Battle of the Bits」の解説ページ（英語）にまとまっています。

- [トラッカーの一覧](https://battleofthebits.com/lyceum/View/List+of+Trackers)

- [音源・ハード別（ゲーム機・音源チップごと）の形式一覧](https://battleofthebits.com/lyceum/View/Format)

- [便利なツールの一覧](https://battleofthebits.com/lyceum/View/Tools)

## 2021年のまとめから変わったこと {#ja-changes}

- **SANA 8BIT VST**、**VOPM**：どちらも古い32bitのプラグインで、いまのDAWではそのままでは使えないことが多いです。ファミコン系はMagical 8bit Plug 2やNew DoReFAMI、YM2151はmy2151かchipsynth OPMZが代わりになります

各ツールのバージョンや価格は、2026年10月30日時点の各配布ページの情報に基づいています。掲載している画像の多くは、各ツールの公式ページ（App Storeを含む）や[Lospec](https://lospec.com/software/)から引用しました。なお、BeepBox、JummBox、UltraBox、Slarmoo's Box、FlMML on HTML5、browser-mml-player、NSF2MML、LSDJ Converter、SNDH Playerは実際にサイトを開いて撮影したものです。little-scaleさんのトラッカー、WebX68k、NOTE MDX Workbenchは各作者のX（旧Twitter）の投稿から引用し、Dn-FamiTracker、Furnace、furnace-piano-roll、FamiStudio、KiraStudio、OpenMPT、WaveTracker、GTUltra、SID Factory II、Bamboo Tracker、DefleMask、LabChirpの画像はRei8bitさんからご提供いただきました。機種別の欄の画像は、各ツールのページのほか、Battle of the Bits、Atarimania、pouet.net、Wikipedia、YouTubeの動画のサムネイルなどから引用しました。
{{< /lang >}}

{{< lang en >}}
This is an updated roundup based on Umeboshi Chazuke's 2021 article on their blog Ajitama Note, "[10 Sound Sources for Making Bleepy Music](https://blog.ajitama-note.com/entry/2021/03/06/215656)" (in Japanese) and theta's [software page](https://ss1.xrea.com/theta.s57.xrea.com/software/), with more tools added.

<nav class="toc">

**Contents**

- [Start with free plugins](#en-free-plugins)
- [Effects](#en-effects)
- [Trackers and dedicated software (free unless a price is given)](#en-trackers)
- [LSDj and trackers inspired by it (free)](#en-lsdj)
- [M8 (hardware tracker)](#en-m8)
- [picoTracker (hardware tracker)](#en-picotracker)
- [Other hardware](#en-hardware)
- [Apps for phones and handhelds](#en-handheld)
- [Software for real consoles and old computers](#en-consoles)
- [Tools for old Japanese computers (X68000, PC-98, MSX)](#en-japanese-pcs)
- [Browser apps (free)](#en-browser)
- [Writing music in MML](#en-mml)
- [Paid plugins](#en-paid-plugins)
- [Sample packs](#en-sample-packs)
- [Sound effect makers](#en-sfx)
- [Players, converters and more](#en-players)
- [Shiru's tools (free)](#en-shiru)
- [Trackers and tools by system](#en-botb)
- [To dig deeper](#en-more)
- [What changed since the 2021 roundup](#en-changes)

</nav>

## Start with free plugins {#en-free-plugins}

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

- [**OPNA FM Synth**](https://trpico.booth.pm/items/8351023) v1.0.1: torupi's plugin recreating the YM2608 (OPNA) FM chip. Free (600 yen support option), Windows (VST3)
  <img src="/img/chiptune-tools/opnafm.webp" alt="OPNA FM Synth screenshot" width="560" height="382" loading="lazy" />

## Effects {#en-effects}

- [**Deltanizer**](https://ss1.xrea.com/theta.s57.xrea.com/software/#deltanizer) (theta) v2.0.0: gives sounds you've programmed the texture of the NES's DPCM channel (the gritty, rough sound used for drums and voices). Free, Windows 64-bit (VST3)
  <img src="/img/chiptune-tools/deltanizer.webp" alt="Deltanizer screenshot" width="292" height="313" loading="lazy" />

- [**Interruptor**](https://ss1.xrea.com/theta.s57.xrea.com/software/#interruptor) (theta) v0.0.2: recreates "interrupts," the old game-music trick of slipping quick sound effects or drums into the gaps of a melody. Free, Windows 64-bit (VST3)
  <img src="/img/chiptune-tools/interruptor.webp" alt="Interruptor screenshot" width="291" height="310" loading="lazy" />

- [**chipcrusher**](https://www.plogue.com/products/chipcrusher.html) (Plogue): adds the texture of old consoles after the fact, such as the slightly gritty voices and drums of the NES or the SNES's distinctive roughness and echo. $39
  <img src="/img/chiptune-tools/chipcrusher.webp" alt="chipcrusher screenshot" width="560" height="189" loading="lazy" />

## Trackers and dedicated software (free unless a price is given) {#en-trackers}

You program within the limits of the console's sound chip, which makes it easier to sound like the real thing.

- [**FamiStudio**](https://famistudio.org/) 4.5.3: for the NES. It has a piano roll, so it's approachable even if you've never used a tracker. Windows, Mac, Linux
  <img src="/img/chiptune-tools/famistudio.webp" alt="FamiStudio screenshot" width="560" height="307" loading="lazy" />
  <small>Image: provided by Rei8bit</small>

- [**KiraStudio**](https://kirastudio.org/) 1.1.2: a new program released in 2026 by FamiStudio's author (BleuBleu). It has a piano roll and offers NES, GAMEBOY and Yamaha FM sound chips, among others. It values ease of use over hardware accuracy. The Windows version is free, and there are also Mac, iPhone, iPad and Android versions
  <img src="/img/chiptune-tools/kirastudio.webp" alt="KiraStudio screenshot" width="560" height="307" loading="lazy" />
  <small>Image: provided by Rei8bit</small>

- [**Dn-FamiTracker**](https://github.com/Dn-Programming-Core-Management/Dn-FamiTracker) Dn0.5.3: an NES tracker, descended from FamiTracker. Windows only
  <img src="/img/chiptune-tools/dn-famitracker.webp" alt="Dn-FamiTracker screenshot" width="560" height="315" loading="lazy" />
  <small>Image: provided by Rei8bit</small>
  - [**Ruikaj's fork**](https://github.com/Ruikaj/Dn-FamiTracker): modified so instrument data is less likely to overflow when exporting NSF. Free, Windows only

- [**Furnace**](https://github.com/tildearrow/furnace) 0.6.8.3: a tracker that supports many sound chips, including the NES, GAMEBOY and Mega Drive. Windows, Mac, Linux
  <img src="/img/chiptune-tools/furnace.webp" alt="Furnace screenshot" width="560" height="307" loading="lazy" />
  <small>Image: provided by Rei8bit</small>
  - [**furnace-piano-roll**](https://github.com/rednoobmusic/furnace-piano-roll) v14: a fork of Furnace that adds a piano roll and more. Free, Windows, Linux
    <img src="/img/chiptune-tools/furnace-piano-roll.webp" alt="furnace-piano-roll screenshot" width="560" height="307" loading="lazy" />
    <small>Image: provided by Rei8bit</small>

- [**OpenMPT**](https://openmpt.org/) 1.32.11.00: a long-standing tracker that isn't tied to any one console. Windows
  <img src="/img/chiptune-tools/openmpt.webp" alt="OpenMPT screenshot" width="560" height="315" loading="lazy" />
  <small>Image: provided by Rei8bit</small>

- [**Renoise**](https://www.renoise.com/) 3.5.4: a tracker that works like a DAW, great for making music with samples. It also supports plugins like VSTs. 76 EUR, Windows, Mac, Linux
  <img src="/img/chiptune-tools/renoise.webp" alt="Renoise screenshot" width="560" height="397" loading="lazy" />

- [**PICO-8**](https://www.lexaloffle.com/pico-8.php) v0.2.7: a "fantasy console" for making whole retro pixel-art games. It comes with built-in music and sound effect editors for making chiptunes. $15, Windows, Mac, Linux, Raspberry Pi
  <img src="/img/chiptune-tools/pico-8.webp" alt="PICO-8 screenshot" width="560" height="242" loading="lazy" />

- [**TIC-80**](https://tic80.com/) v1.4.1: a "fantasy computer" for making tiny games, with built-in 4-channel music and sound effect editors. Free (PRO version with extra features is $10), Windows, Mac, Linux, Android, browser. I also [posted a video on X](https://x.com/to6okegao/status/1244441165102854145) of a wavetable synth I tried in TIC-80
  <img src="/img/chiptune-tools/tic80.webp" alt="TIC-80 screenshot" width="560" height="317" loading="lazy" />

- [**Piston Collage**](https://pxtone.org/downloads/) (pxtone) ver.0.9.4.56: a music program where you put pitches on waveforms you've drawn or WAVs you've loaded and arrange them. You can make a whole song in it alone, and it's easy to use. Compilations of songs made with it still come out, such as "[PXTUNES 10th Anniversary: THE FUTURE OF PXTONE](https://pxtunes.bandcamp.com/album/pxtunes-10th-anniversary-the-future-of-pxtone)" from October 2026. Free (Windows)
  <img src="/img/chiptune-tools/piston-collage.webp" alt="Piston Collage screenshot" width="472" height="296" loading="lazy" />

- [**ptcollab**](https://yuxshao.github.io/ptcollab/) v0.6.4.11: a music editor built on the pxtone (Piston Collage) engine that lets you make a song together with friends over the network, with MIDI input support. Free, Windows, Mac, Linux
  <img src="/img/chiptune-tools/ptcollab.webp" alt="ptcollab screenshot" width="560" height="315" loading="lazy" />

- [**Bamboo Tracker**](https://bambootracker.github.io/BambooTracker/) v0.6.5: a tracker for the YM2608 FM chip used in the PC-8801 and PC-9801. Free, Windows, Mac, Linux
  <img src="/img/chiptune-tools/bambootracker.webp" alt="Bamboo Tracker screenshot" width="560" height="307" loading="lazy" />
  <small>Image: provided by Rei8bit</small>

- [**Arkos Tracker 3**](https://www.julien-nevo.com/arkostracker/) 3.7: a tracker for PSG chips (AY-3-8910, YM2149) used in the MSX, ZX Spectrum, Atari ST and more. Free, Windows, Mac, Linux
  <img src="/img/chiptune-tools/arkos.webp" alt="Arkos Tracker 3 screenshot" width="560" height="350" loading="lazy" />

- [**Vortex Tracker**](https://github.com/benbaker76/VortexTracker) 3.0.0: a rebuilt version of the long-standing tracker for PSG chips (AY-3-8910, YM2149). Free, Windows
  <img src="/img/chiptune-tools/vortex.webp" alt="Vortex Tracker screenshot" width="277" height="420" loading="lazy" />

- [**Osctet**](https://jangle.dev/osctet/) 1.4.1: a synth-and-sampler tracker that also handles unusual tunings and rhythms. Free, Windows, Linux
  <img src="/img/chiptune-tools/osctet.webp" alt="Osctet screenshot" width="560" height="419" loading="lazy" />

- [**WaveTracker**](https://wavetracker.org) v1.1.2: a tracker that plays waveforms you draw yourself (wavetables) and samples. Free (tips welcome), Windows only
  <img src="/img/chiptune-tools/wavetracker.webp" alt="WaveTracker screenshot" width="560" height="307" loading="lazy" />
  <small>Image: provided by Rei8bit</small>

- [**DefleMask**](https://www.deflemask.com/): a tracker for many sound chips, including the Mega Drive, Master System, GAMEBOY, PC Engine and NES. 1,700 yen on Steam, with mobile versions too (iOS, Android). An old free version exists but is no longer supported
  <img src="/img/chiptune-tools/deflemask.webp" alt="DefleMask (v1) screenshot" width="560" height="307" loading="lazy" />
  <small>Image: provided by Rei8bit</small>
  <img src="/img/chiptune-tools/deflemask-legacy.webp" alt="DefleMask Legacy screenshot" width="560" height="307" loading="lazy" />
  <small>Image: provided by Rei8bit</small>

- [**MilkyTracker**](https://milkytracker.org/) v1.05.01: a FastTracker II-compatible sample tracker (XM and MOD). Free, Windows, Mac, Linux
  <img src="/img/chiptune-tools/milkytracker.webp" alt="MilkyTracker screenshot" width="544" height="420" loading="lazy" />
  <small>Image: from [Lospec](https://lospec.com/software/milkytracker/screenshots)</small>

- [**Schism Tracker**](https://schismtracker.org/) 20260524: a remake of Impulse Tracker for today's computers, using samples. Free, Windows, Mac, Linux
  <img src="/img/chiptune-tools/schism.webp" alt="Schism Tracker screenshot" width="560" height="360" loading="lazy" />
  <small>Image: from [Lospec](https://lospec.com/software/schism-tracker/screenshots)</small>

- [**SunVox**](https://warmplace.ru/soft/sunvox/) 2.1.4d: a modular synth combined with a tracker-style sequencer, light enough for old computers. Free on desktop, 1,000 yen on iOS (also on Android)
  <img src="/img/chiptune-tools/sunvox.webp" alt="SunVox screenshot" width="560" height="315" loading="lazy" />
  <small>Image: from [Lospec](https://lospec.com/software/sunvox/screenshots)</small>

- [**Bosca Ceoil Blue**](https://yurisizov.itch.io/boscaceoil-blue) 3.1.2: a beginner-friendly music maker where everything fits on one screen. Free (tips welcome), Windows, Mac, Linux, plus a browser version
  <img src="/img/chiptune-tools/bosca.webp" alt="Bosca Ceoil Blue screenshot" width="560" height="315" loading="lazy" />
  <small>Image: from [Lospec](https://lospec.com/software/bosca-ceoil-blue/screenshots)</small>

- [**hUGETracker**](https://superdisk.github.io/hUGETracker/) v1.0.11: a GAMEBOY tracker whose songs can be built into your own GAMEBOY homebrew games. Free, Windows, Mac, Linux
  <img src="/img/chiptune-tools/hugetracker.webp" alt="hUGETracker screenshot" width="560" height="311" loading="lazy" />
  <small>Image: from [Lospec](https://lospec.com/software/hugetracker/screenshots)</small>

- [**GTUltra**](https://github.com/jpage8580/GTUltra) v1.5.8: a heavily extended version of GoatTracker 2 (Stereo) for the Commodore 64 (SID). Rei8bit recommends this over GoatTracker 2 unless you have a specific reason to use the original. Free, Windows, Mac, Linux
  <img src="/img/chiptune-tools/gtultra.webp" alt="GTUltra screenshot" width="559" height="420" loading="lazy" />
  <small>Image: provided by Rei8bit</small>

- [**GoatTracker 2**](https://sourceforge.net/projects/goattracker2/) 2.77: a Commodore 64 (SID) tracker whose songs play on the real machine. If you're just starting out, GTUltra above is the better pick. Free, Windows, Mac, Linux
  <img src="/img/chiptune-tools/goattracker.webp" alt="GoatTracker 2 screenshot" width="534" height="420" loading="lazy" />
  <small>Image: from [Lospec](https://lospec.com/software/goattracker-2/screenshots)</small>

- [**SID Factory II**](https://github.com/Chordian/sidfactory2) release-20260314: an editor for composing SID music that runs on real Commodore 64 hardware, currently in open beta. Free, Windows, Mac, Linux
  <img src="/img/chiptune-tools/sidfactory2.webp" alt="SID Factory II screenshot" width="560" height="285" loading="lazy" />
  <small>Image: provided by Rei8bit</small>

- [**PIRORO**](https://store.steampowered.com/app/2905900/PIRORO/) ver.3.4.0: a piano-roll chiptune composer that exports ROMs for real GAMEBOY and GBA hardware and imports MIDI. 1,300 yen on Steam, Windows
  <img src="/img/chiptune-tools/piroro.webp" alt="PIRORO screenshot" width="560" height="315" loading="lazy" />

- [**MEKIMEKI BOY (メキメキボーイ)**](https://amuru9.wixsite.com/my-site/mekimeki-chip): a piano-roll composer by the author of PIRORO that exports GAMEBOY ROMs. Free, Windows
  <img src="/img/chiptune-tools/mekimeki.webp" alt="MEKIMEKI BOY screenshot" width="560" height="298" loading="lazy" />

- [**Lovely Composer**](https://booth.pm/ja/items/3006558): a cute music maker in the spirit of console music-making software. Make retro game-style songs and sound effects and export to WAV or MIDI. 990 yen (BOOTH), Windows (and some Linux)
  <img src="/img/chiptune-tools/lovelycomposer.webp" alt="Lovely Composer screenshot" width="560" height="364" loading="lazy" />

- [**DR-00M**](https://uniko-art.itch.io/dr-00m) 1.1: a 16-step drum machine made in PICO-8. Free (tips welcome), PICO-8, Windows, Mac, Linux
  <img src="/img/chiptune-tools/dr00m.webp" alt="DR-00M screenshot" width="320" height="410" loading="lazy" />

## LSDj and trackers inspired by it (free) {#en-lsdj}

LSDj for the GAMEBOY, along with trackers that bring its workflow to other consoles and devices. LSDj, Risa, and four trackers by little-scale run on original hardware or an emulator (PocketTracker and ChipNomad are apps for smartphones, computers, and handheld consoles).

- [**LSDj**](https://www.littlesounddj.com/) v9.4.2: music software that runs on a real GAMEBOY (or an emulator on a PC and so on). Free to download since 2020 (donations welcome)
  <img src="/img/chiptune-tools/lsdj.webp" alt="LSDj screenshot" width="320" height="288" loading="lazy" />

- [**Risa**](https://risa.laamaa.fi/) (laamaa): a music program (tracker) for the NES. You type notes straight onto the screen, much like the classic LSDj. On top of the console's own sound, it gives you two more pulse channels (bleepy square waves) from the cartridge's expansion chip (MMC5). Both the Mesen emulator and the EverDrive N8 Pro cartridge on real hardware are recommended
  <img src="/img/chiptune-tools/risa.webp" alt="Risa screenshot" width="256" height="240" loading="lazy" />

- [**genmddj**](https://github.com/little-scale/genmddj) (little-scale) v0.25: for the Mega Drive
  <img src="/img/chiptune-tools/genmddj.webp" alt="genmddj screenshot" width="560" height="420" loading="lazy" />
  <small>Image: from [a post on X](https://x.com/littlescale/status/2112682597327528396)</small>

- [**smsggdj**](https://github.com/little-scale/smsggdj) (little-scale) v0.48: for the Sega Master System and Game Gear
  <img src="/img/chiptune-tools/smsggdj.webp" alt="smsggdj cartridge" width="525" height="420" loading="lazy" />
  <small>Image: from [a post on X](https://x.com/littlescale/status/2082773452164084107)</small>

- [**sndj**](https://github.com/little-scale/sndj) (little-scale) v0.15: for the SNES
  <img src="/img/chiptune-tools/sndj.webp" alt="sndj running on real hardware" width="560" height="420" loading="lazy" />
  <small>Image: from [a post on X](https://x.com/littlescale/status/2076465778753507804)</small>

- [**alynxdj**](https://github.com/little-scale/alynxdj) (little-scale) v0.60: for the Atari Lynx
  <img src="/img/chiptune-tools/alynxdj.webp" alt="alynxdj running on real hardware" width="560" height="315" loading="lazy" />
  <small>Image: from [a post on X](https://x.com/littlescale/status/2083711247678365936)</small>

- [**PocketTracker**](https://conanizer.github.io/pockettracker/) (conanizer) v0.9.9.1: an Android music program (tracker) that carries over the feel of the classic handheld trackers (LSDj, LGPT, M8). It loads your own audio (samples) and SF2 sound files, so it's also good for chopping up and playing otoMAD or YTPMV source material (up to 8 tracks). Runs on phones and on Android handhelds with physical buttons
  <img src="/img/chiptune-tools/pockettracker.webp" alt="PocketTracker screenshot" width="560" height="294" loading="lazy" />

- [**ChipNomad**](https://chipnomad.org/) (Megus) v1.0.5: a tracker influenced by LSDj and the popular handheld M8. For now it supports only the AY-3-8910 (the sound chip in the MSX and others). Runs on Windows, macOS, Linux, Android and handhelds (RG35XX, Miyoo)
  <img src="/img/chiptune-tools/chipnomad.webp" alt="ChipNomad screenshot" width="525" height="420" loading="lazy" />

## M8 (hardware tracker) {#en-m8}

A portable tracker influenced by the GAMEBOY's LSDj. Besides chiptune-style sound engines, it has FM synths and a sampler.

- [**M8 Tracker Model:02**](https://dirtywave.com/): the hardware. $699 (Dirtywave's official store)
  <img src="/img/chiptune-tools/m8.webp" alt="M8 Tracker Model:02 screenshot" width="560" height="344" loading="lazy" />

- [**M8 Headless**](https://github.com/Dirtywave/M8HeadlessFirmware): a free version you flash onto a small off-the-shelf board called the Teensy 4.1 and connect to a computer. The screen and controls are handled by software on the computer (m8c and others)
  <img src="/img/chiptune-tools/m8gd.webp" alt="M8 Headless shown in m8gd" width="560" height="315" loading="lazy" />

  - For the computer side, I recommend [**m8gd**](https://github.com/octoocto/m8gd) (free, Windows, Mac, Linux). It shows the M8's screen on a 3D model of the hardware (I use it myself).

- [**M8 Music Tracker**](https://apps.apple.com/jp/app/m8-music-tracker/id6806721202) (iPhone, iPad) 1.2.2: an app version with the same features as the hardware (released September 2026, 5,000 yen on the Japanese App Store). Songs can be moved back and forth between the app and the hardware
  <img src="/img/chiptune-tools/m8-music-tracker.webp" alt="M8 Music Tracker screenshot" width="560" height="420" loading="lazy" />

## picoTracker (hardware tracker) {#en-picotracker}

- [**picoTracker**](https://xiphonics.com/) (Xiphonics) v2.4.0: hardware that runs a port of the classic tracker LGPT on its own, on a small microcontroller board (Raspberry Pi Pico). It has 8 tracks, with a sampler, FM synths and more. The DIY kit (board and display) is $99, and the finished picoTracker Advance is $449 (official store). The software is on [GitHub](https://github.com/xiphonics/picoTracker)
  <img src="/img/chiptune-tools/picotracker.webp" alt="picoTracker screenshot" width="560" height="373" loading="lazy" />

## Other hardware {#en-hardware}

- [**MIDISID**](https://peacockmedia.software/midisid/): a MIDI synth with two SID-compatible chips. £125
  <img src="/img/chiptune-tools/midisid.webp" alt="MIDISID screenshot" width="500" height="267" loading="lazy" />

- [**LIVEN MEGA SYNTHESIS**](https://ja.sonicware.jp/pages/liven-mega-synthesis): a groovebox with a 6-track sequencer that recreates the FM sound of 16-bit consoles. 49,800 yen (54,800 yen with AC adapter)
  <img src="/img/chiptune-tools/megasyn.webp" alt="LIVEN MEGA SYNTHESIS screenshot" width="420" height="420" loading="lazy" />

- [**NullPerator**](https://203.io/products/operator-deposit): a small handheld tracker running heavily modified picoTracker software. From $249 (pre-order), with a free iPhone and iPad app
  <img src="/img/chiptune-tools/nullperator.webp" alt="NullPerator screenshot" width="420" height="420" loading="lazy" />

- [**LAVIOR AURA**](https://hmfactory.jp/aura/): HMFACTORY's small sound board that plays PSG, wavetable, SID, PCM and other sounds in up to 32 channels, controlled from the Windows app AURA HOST. Early distribution started in October 2026
  <img src="/img/chiptune-tools/aura.webp" alt="AURA HOST for LAVIOR AURA screenshot" width="560" height="332" loading="lazy" />

## Apps for phones and handhelds {#en-handheld}

Make music anywhere on a phone or a handheld.

- [**nanoloop**](https://nanoloop.com/): a step sequencer and synth on a 4×4 grid, available as GAMEBOY and GBA cartridges, a standalone device (nanoloop q) and a phone app. The app is 600 yen on iOS and 390 yen on Android
  <img src="/img/chiptune-tools/nanoloop.webp" alt="nanoloop screenshot" width="560" height="229" loading="lazy" />

- [**naive tracker**](https://nanoloop.com/naive/index.html) 1.0.6: a 4-track sampler-tracker for touch screens from the maker of nanoloop. 600 yen, iPhone and iPad (Android coming)
  <img src="/img/chiptune-tools/naive.webp" alt="naive tracker screenshot" width="194" height="420" loading="lazy" />
  <small>Image: from [the App Store](https://apps.apple.com/jp/app/naive-tracker/id6758921004)</small>

- [**snibbetracker**](https://apps.apple.com/jp/app/snibbetracker/id1065797528): a chiptune-style tracker with its own simple synth. Free, iPhone and iPad (also Windows and Mac)
  <img src="/img/chiptune-tools/snibbe.webp" alt="snibbetracker screenshot" width="315" height="420" loading="lazy" />

- [**SidTracker64**](https://apps.apple.com/jp/app/sidtracker64/id955421205) 1.0.5: an iPad tracker that recreates the Commodore 64 sound chip (SID). 1,800 yen
  <img src="/img/chiptune-tools/sidtracker64.webp" alt="SidTracker64 screenshot" width="315" height="420" loading="lazy" />

- [**GTMobile**](https://github.com/2bt/GTMobile) 1.0.19: an Android Commodore 64 (SID) tracker based on GoatTracker 2, with a piano roll too. Free
  <img src="/img/chiptune-tools/gtmobile.webp" alt="GTMobile screenshot" width="226" height="420" loading="lazy" />

- [**Pocket Acid**](https://github.com/boomlinde/pocketacid) v1.11.0: a studio for acid (TB-303-style) music, played with a game controller and running on cheap Linux handhelds such as the R36S. Free, Linux handhelds and Windows
  <img src="/img/chiptune-tools/pocketacid.webp" alt="Pocket Acid screenshot" width="315" height="420" loading="lazy" />

- [**4TRKmini**](https://jasonbmusic.itch.io/4trk-mini): a 4-track workstation (one drum and three synth tracks) for retro handhelds, with an Amiga version called 4TRK-500. Free (tips welcome), handhelds, Windows, Mac, Linux
  <img src="/img/chiptune-tools/4trk.webp" alt="4TRKmini screenshot" width="531" height="420" loading="lazy" />

- [**ESPboy Tracker**](http://shiru.nedopc.com/software.shtml) v1.2: Shiru's LSDj-inspired tracker for the tiny ESPboy handheld, with a desktop version. Free
  <img src="/img/chiptune-tools/espboy.webp" alt="ESPboy Tracker screenshot" width="315" height="420" loading="lazy" />

## Software for real consoles and old computers {#en-consoles}

These run on real GAMEBOY, GBA, NES, Commodore 64 and other hardware (or an emulator).

- [**FMS**](https://lobit-club.itch.io/fms) 1.31: a GBA groovebox with four tracks of 2-operator FM synthesis plus the GAMEBOY noise channel. From $10 (free demo available), with a cartridge version and a desktop plugin (beta)
  <img src="/img/chiptune-tools/fms.webp" alt="FMS screenshot" width="560" height="324" loading="lazy" />

- [**STEPPER**](https://badd10de.itch.io/stepper-gba) 1.9: a 16-step sequencer for the GBA that plays the four GAMEBOY sound channels. Free (tips welcome), GBA, 3DS
  <img src="/img/chiptune-tools/stepper.webp" alt="STEPPER screenshot" width="560" height="373" loading="lazy" />

- [**GB303 MIDI**](https://zerabosk.itch.io/gb303midi): a TB-303-style bass synth for the GAMEBOY, MIDI-controlled through an Arduinoboy. ROM from $10, cartridge $26.50 (HobbyChop)
  <img src="/img/chiptune-tools/gb303.webp" alt="GB303 MIDI screenshot" width="467" height="420" loading="lazy" />

- [**STUTTER**](https://stutter.hobbychop.com/): a 4-voice MIDI step sequencer for the GAMEBOY with live glitch effects. ROM $10, cartridge $26 (HobbyChop)
  <img src="/img/chiptune-tools/stutter.webp" alt="STUTTER screenshot" width="466" height="420" loading="lazy" />

- [**Merzboy**](https://github.com/purefunktion/Merzboy): a noise generator for the GAMEBOY. Free
  <img src="/img/chiptune-tools/merzboy.webp" alt="Merzboy screenshot" width="320" height="288" loading="lazy" />

- [**Droneboy**](https://github.com/purefunktion/Droneboy) v1.09: a drone synth for the GAMEBOY with chords, sequencing and MIDI control. Free, cartridge $26.50 (HobbyChop)

- [**DMGo!**](https://audiowanderer.com/AW/drum-machina-go-or/) v1: a drum machine using all four GAMEBOY channels, released in September 2026. Free (donations welcome)
  <img src="/img/chiptune-tools/dmgo.webp" alt="DMGo! screenshot" width="467" height="420" loading="lazy" />

- [**Neil Baldwin's NES tools**](https://neilbaldwin.codeberg.page/nes-audio/index.html): a collection of NES music software that runs on real hardware, including the LSDj-like tracker Pulsar, the tracker NTRQ and the drum machine PR8. Free
  <img src="/img/chiptune-tools/neil.webp" alt="Neil Baldwin's NES tools screenshot" width="280" height="262" loading="lazy" />

- [**SID-Wizard**](https://csdb.dk/release/?id=262561) 1.97: a tracker that runs on a real Commodore 64. Free
  <img src="/img/chiptune-tools/sidwizard.webp" alt="SID-Wizard screenshot" width="544" height="420" loading="lazy" />
  <small>Image: from [CSDb](https://csdb.dk/release/?id=262561)</small>

- [**MiniSEQ**](https://4mat.itch.io/miniseq): 4mat's Commodore 64 sequencer where you make sound by editing the text on screen. Free
  <img src="/img/chiptune-tools/miniseq.webp" alt="MiniSEQ screenshot" width="560" height="397" loading="lazy" />

- [**Patchwork**](https://4mat.itch.io/patchwork): 4mat's Commodore 64 sequencer that uses parts of recorded SID songs as instruments. Free
  <img src="/img/chiptune-tools/patchwork.webp" alt="Patchwork screenshot" width="560" height="397" loading="lazy" />

- [**SIDLab**](https://4mat.itch.io/sidlab): 4mat's tool for remixing SID music live on the Commodore 64, like a DJ. Free
  <img src="/img/chiptune-tools/sidlab.webp" alt="SIDLab screenshot" width="384" height="272" loading="lazy" />

- [**SID SYNTH**](https://lukhash.bandcamp.com/album/neon-airlines): LukHash's software that turns a Commodore 64 into a live synthesizer. Not sold on its own: it comes as a bonus with the album "Neon Airlines" (Bandcamp, from £7, out November 6, 2026)

- [**Realfun 3**](https://www.msx.org/node/60323): a tracker for the MSX SCC and PSG and the ColecoVision sound chips. A trial came out in 2020, and it seems to still be in development

- [**QuadTrack**](https://pinkparrotstudio.itch.io/quadtrack): a 4-track sample performance sequencer built on the Amiga's architecture. From 25 EUR (free demo), Windows, Mac, Amiga

## Tools for old Japanese computers (X68000, PC-98, MSX) {#en-japanese-pcs}

Tools for making and playing music for the X68000, PC-9801, PC-8801 and MSX.

- [**FMSound**](https://uraraworks.github.io/FMSound/): a browser-based MML player and editor for PMD (PC-9801) and MUCOM88 (PC-8801), with a live display of each part. Still a work in progress, so some songs don't play yet. Free
  <img src="/img/chiptune-tools/fmsound.webp" alt="FMSound screenshot" width="560" height="350" loading="lazy" />

- [**WebX68k**](https://uraraworks.github.io/WebX68k/): an X68000 emulator that runs in the browser and boots as soon as you open the URL. Free
  <img src="/img/chiptune-tools/webx68k.webp" alt="WebX68k screenshot" width="507" height="420" loading="lazy" />
  <small>Image: from [a post on X](https://x.com/haruuraran/status/2084989176400031951)</small>

- [**NOTE MDX Workbench**](https://github.com/ickaze/NOTE-MDX-Workbench) v2.10.0: ickaze's all-in-one environment for X68000 music (MDX). Write note.x-compatible MML, make FM voices and PCM banks (PDX), and export to WAV or VGM. Free, Windows
  <img src="/img/chiptune-tools/notemdxwb.webp" alt="NOTE MDX Workbench screenshot" width="560" height="315" loading="lazy" />
  <small>Image: from [a post on X](https://x.com/ickaze/status/2114383336525484527)</small>

- [**PDXEditor**](https://github.com/ickaze/PDXEditor) v1.1.1: ickaze's tool for making and editing X68000 PCM banks (PDX). Free, Windows

- [**NoteMDX**](https://github.com/ickaze/noteMDX) 0.8 rev5: ickaze's converter from note.x-compatible MML to MDX. Free, Windows

- [**IndependentMDX**](https://github.com/ickaze/IndependentMDX) 0.33.5: ickaze's player for MDX and YM2151 VGM files. Free, Windows

- [**OPMChord**](https://github.com/ickaze/OPMChord) 1.2.3: ickaze's instrument that plays chords on a single YM2151 channel, playable over MIDI. Free, Windows

- [**mxv2**](https://github.com/gorry/mxv2) 2026.1015.2: a player and visualizer for X68000 music (MDX). Free, Windows, Android
  <img src="/img/chiptune-tools/mxv2.webp" alt="mxv2 screenshot" width="303" height="420" loading="lazy" />

- [**VGMDRV**](https://sites.google.com/site/waveknife7/vgmdrv) 1.39: a driver that plays VGM files on a real X68000; with add-on hardware it can also play OPN, SEGA PCM and more. Free

- [**NDP**](https://ndp.squares.net/web/) 1.51: a PSG sound driver for the MSX and an MML editor for it, with a browser version, [NDP Online](https://ndp.squares.net/online/). Free, Windows, browser
  <img src="/img/chiptune-tools/ndp.webp" alt="NDP screenshot" width="560" height="403" loading="lazy" />

- [**MSXPLAYer**](https://msxplayer.net/wp/): the official MSX emulator from the MSX Association. The current build is available to owners of the Gijutsu-Hyoron book "MSX-BASICでゲームを作ろう". Windows

## Browser apps (free) {#en-browser}

Nothing to install: just open a browser and start. Songs are saved in the URL, so sharing a song is as easy as sending its URL. You can also export to WAV or MIDI.

- [**BeepBox**](https://www.beepbox.co/) 4.2.2: the simplest of them all. You make a song just by placing notes on a grid. There's an offline version too
  <img src="/img/chiptune-tools/beepbox.webp" alt="BeepBox screenshot" width="515" height="420" loading="lazy" />

- [**JummBox**](https://jummb.us/) 2.6: a mod of BeepBox that adds pitch bends, finer volume control and more
  <img src="/img/chiptune-tools/jummbox.webp" alt="JummBox screenshot" width="515" height="420" loading="lazy" />

- [**UltraBox**](https://ultraabox.github.io/): gathers handy features from many BeepBox mods into one. One of the most popular mods right now
  <img src="/img/chiptune-tools/ultrabox.webp" alt="UltraBox screenshot" width="515" height="420" loading="lazy" />

- [**Slarmoo's Box**](https://slarmoo.github.io/slarmoosbox/) 1.4.11: a mod of UltraBox with more effects, envelope settings and more
  <img src="/img/chiptune-tools/slarmoos-box.webp" alt="Slarmoo's Box screenshot" width="515" height="420" loading="lazy" />

- [**Efflux**](https://www.igorski.nl/application/efflux/) 3.1.1: a tracker that runs in the browser, with a piano roll as well. Free

- [**Bitphase**](https://bitphase.app/): a browser tracker for PSG chips (AY-3-8910, YM2149) and the NES. Free
  <img src="/img/chiptune-tools/bitphase.webp" alt="Bitphase screenshot" width="560" height="366" loading="lazy" />
  <small>Image: from [GitHub](https://github.com/paator/bitphase)</small>

## Writing music in MML {#en-mml}

Write songs as text (MML) and play them.

- [**FlMML on HTML5**](https://github.com/argentum384/flmml-on-html5) v2.0.3: the Flash MML player FlMML, brought to the browser, with WAV export. Free
  <img src="/img/chiptune-tools/flmml.webp" alt="FlMML on HTML5 screenshot" width="560" height="350" loading="lazy" />

- [**FAMIC on USB MML Playground**](https://famic.prioris.jp/mml/): a page for writing and playing MML in the browser, which can also send songs to the FAMIC on USB device. Free
  <img src="/img/chiptune-tools/famicmml.webp" alt="FAMIC on USB MML Playground screenshot" width="560" height="294" loading="lazy" />

- [**NSF2MML**](https://famic.prioris.jp/mml/labo/nsf2mml): a browser tool that converts NES music files (NSF) to MML. Free
  <img src="/img/chiptune-tools/nsf2mml.webp" alt="NSF2MML screenshot" width="560" height="350" loading="lazy" />

- [**GameBoy Music Compiler (GBMC)**](http://mydocuments.g2.xrea.com/html/gb/sounddriver.html) 2025.07.31: an MML compiler for the GAMEBOY sound chip that exports GBS files, ROMs for emulators and real hardware, as well as the visual player "GBDSP". Free, Windows
  <img src="/img/chiptune-tools/gbmc.webp" alt="GBDSP screen exported from GBMC" width="336" height="342" loading="lazy" />

- [**browser-mml-player**](https://github.com/t-sin/browser-mml-player): a browser MML player made for an article introducing how synthesizers work. Free
  <img src="/img/chiptune-tools/bmml.webp" alt="browser-mml-player screenshot" width="560" height="350" loading="lazy" />

- [**SiON**](https://github.com/keim/SiON): a Flash software synth driven by MML, now ported to Godot (GDSiON) and others. Free

- [**PMD**](http://www5.airnet.ne.jp/kajapon/tool.html) Ver.4.8s: an MML driver for the FM sound of the PC-9801 and others, playable on Windows with FMPMD2000 and similar. Free (source available)

- [**OFGS2tm**](https://x.com/EightbitMays/status/2086505645629718736) Ver0.93: Mays's modified version of OFGSv2, an MML sound driver for the NES. Free (shared via an X post)

## Paid plugins {#en-paid-plugins}

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

- [**Junior**](https://fors.fm/junior) (Fors): a 4-bit wavetable synth based on the GAMEBOY sound chip. Draw a 32-step waveform, add noise, and move them with table modulators like those in LSDj and M8. Rather than a strict emulation, it expands the original into a modern synth. $39 (a free, pared-down Junior-Lite is also available), Windows and Linux (VST3, CLAP), Mac (VST3, CLAP, AUv2)
  <img src="/img/chiptune-tools/junior.webp" alt="Junior screenshot" width="420" height="420" loading="lazy" />

- [**inSIDious**](https://impactsoundworks.com/product/insidious/): Impact Soundworks' Commodore 64 (SID) instrument. $64 (runs in the free Reaktor Player)
  <img src="/img/chiptune-tools/insidious.webp" alt="inSIDious screenshot" width="560" height="320" loading="lazy" />
  <small>Image: from [Lospec](https://lospec.com/software/insidious/screenshots)</small>

## Sample packs {#en-sample-packs}

- [**Bitkits**](https://www.uppercussion.com/products/bitkits) (Uppercussion): ten 8-bit drum kits. Besides kicks, snares and hi-hats, there are lots of bleepy sound effects. Free

- [**Shirobon Presents: Chiptune for Serum**](https://shirobon.bandcamp.com/album/shirobon-presents-chiptune-for-serum) (Shirobon): 100 presets for the popular synth Serum, plus waveforms and noise recorded from a real GAMEBOY. From £15 (needs Serum 1.107 or later)

- [**Super Audio Cart 2**](https://impactsoundworks.com/product/super-audio-cart/) (Impact Soundworks): a well-known library of sounds from many retro consoles, from the Atari 2600 to the Game Boy Advance (includes all the sounds from the first version). $199 (runs in the free Kontakt Player, so you can play it right away in your usual DAW)
  <img src="/img/chiptune-tools/super-audio-cart-2.webp" alt="Super Audio Cart 2 screenshot" width="560" height="373" loading="lazy" />

## Sound effect makers {#en-sfx}

Quickly make short game-style sound effects.

- [**sfxr**](https://www.drpetter.se/project_sfxr.html): the original one-click retro sound effect generator. Free, Windows (browser versions exist too)
  <img src="/img/chiptune-tools/sfxr.webp" alt="sfxr screenshot" width="541" height="420" loading="lazy" />
  <small>Image: from [Lospec](https://lospec.com/software/sfxr/screenshots)</small>

- [**Bfxr**](https://www.bfxr.net/): sfxr with more waveforms and filters, running in the browser. Free
  <img src="/img/chiptune-tools/bfxr.webp" alt="Bfxr screenshot" width="560" height="318" loading="lazy" />
  <small>Image: from [Lospec](https://lospec.com/software/bfxr/screenshots)</small>

- [**ChipTone**](https://sfbgames.itch.io/chiptone): a sound effect maker built from layered sounds; what you make is free to use. Free (tips welcome), browser, Windows, Mac
  <img src="/img/chiptune-tools/chiptone.webp" alt="ChipTone screenshot" width="560" height="315" loading="lazy" />

- [**LabChirp**](https://labbed.net/software/labchirp/) v1.75: a sound effect generator that lets you layer up to eight channels using waveforms, envelopes, and effects, complete with a handy randomizer. Recommended by Rei8bit as a go-to tool for sound design. Free, Windows (Mac and Linux via Mono)
  <img src="/img/chiptune-tools/labchirp.webp" alt="LabChirp screenshot" width="503" height="420" loading="lazy" />
  <small>Image: provided by Rei8bit</small>

## Players, converters and more {#en-players}

- [**LSDJ Converter**](https://defensemech.com/lsdj-to-midi): a browser tool that converts LSDj song files to MIDI, handy alongside a DAW. Free
  <img src="/img/chiptune-tools/lsdj2midi.webp" alt="LSDJ Converter screenshot" width="560" height="350" loading="lazy" />

- [**rePlayer**](https://github.com/arnaud-neny/rePlayer) v0.22.16: a player for many tracker and chiptune formats. Free, Windows
  <img src="/img/chiptune-tools/replayer.webp" alt="rePlayer screenshot" width="317" height="191" loading="lazy" />

- [**Open Cubic Player**](https://stian.cubic.org/project-ocp.php) v3.5.0: a text-mode player and visualizer for tracker and chiptune music. Free, Windows, Mac, Linux
  <img src="/img/chiptune-tools/ocp.webp" alt="Open Cubic Player screenshot" width="539" height="420" loading="lazy" />
  <small>Image: from [GitHub](https://github.com/mywave82/opencubicplayer)</small>

- [**SNDH Player**](https://sndh.oxygenedemos.com/): a browser player for Atari ST music (SNDH). Free
  <img src="/img/chiptune-tools/sndh.webp" alt="SNDH Player screenshot" width="560" height="350" loading="lazy" />

- [**Rustico**](https://rustico.reploid.cafe/): an NES emulator focused on accurate sound, with a piano-roll-style audio visualizer, running in the browser. Free

- [**Keitai World Launcher**](https://keitaiarchive.org/downloads.html): a launcher for running Japanese feature phone (i-appli) games on PC, bringing together emulators (like openDoJa) and games preserved on [Keitai Archive](https://keitaiarchive.org/). Also great for listening to game soundtracks. Free, Windows

## Shiru's tools (free) {#en-shiru}

Music tools released by Shiru, all downloadable from [Shiru's software page](http://shiru.nedopc.com/software.shtml).

- **1tracker** v0.47: an experimental multi-engine tracker focused on ZX Spectrum beeper (1-bit) routines, with support for a few other systems. Windows
  <img src="/img/chiptune-tools/shiru-1tracker.webp" alt="1tracker screenshot" width="560" height="361" loading="lazy" />

- **SNES Game Sound System** v1.42: a tracker and sound driver set for making music and sound effects for SNES homebrew games. Windows
  <img src="/img/chiptune-tools/shiru-snesgss.webp" alt="SNES Game Sound System screenshot" width="560" height="383" loading="lazy" />

- **SnevenTracker mod**: a modified version of the SNES tracker SnevenTracker

- **0CC-LLTracker**: 0CC-FamiTracker retargeted to the YM2413 (OPLL) FM chip

- **Yach*PMS** v1.02: a tracker for the old music device MuzCell, with a Windows version that emulates its sound
  <img src="/img/chiptune-tools/shiru-yachpms.webp" alt="Yach*PMS screenshot" width="560" height="361" loading="lazy" />

- **AYFX Editor** v0.7: a sound effect editor for PSG chips (AY-3-8910, YM2149)
  <img src="/img/chiptune-tools/shiru-ayfx.webp" alt="AYFX Editor screenshot" width="560" height="414" loading="lazy" />

- **BeepFX** v1.2: a sound effect editor for the ZX Spectrum beeper
  <img src="/img/chiptune-tools/shiru-beepfx.webp" alt="BeepFX screenshot" width="519" height="420" loading="lazy" />

- **NSF2VGM** v1.1: a command-line tool that converts NSF files made with FamiTracker to VGM

- **SuBoard**: turns Famiclones with a keyboard (Subor-compatible) into a chiptune instrument for live playing

- **VST plugins**: a variety of plugins, including 1bitstudio (1-bit sound), ChipWave and ChipDrum (synth and drum synth blending vintage chip traits), FTplug (NES sound using FamiTracker instruments), VT2i (PSG sound using Vortex Tracker II instruments), CrushDMC (NES DPCM-style distortion), PCSPE (PC speaker sound) and Flopster (floppy drive music)

- **SoundFonts**: ZX Spectrum beeper sounds (wtbeep and more) and Chinese toy pianos (BF-630, TX-5488A and more), plus a pack of lo-fi device impulse responses

## Trackers and tools by system {#en-botb}

Trackers and tools listed on the wiki of the chiptune community [Battle of the Bits](https://battleofthebits.com/) (login required to view) and the Atari software database [Atarimania](https://www.atarimania.com/) that are not covered above, grouped by system. Entries that say "Today, use..." have a better option available now.

### AdLib and OPL (PC FM sound)

- [**Adlib Tracker II**](https://adlibtracker.net/downloads.php): a text-mode tracker for the OPL3 FM chip with 4-op instruments. Free, DOS, Windows, Linux
  <img src="/img/chiptune-tools/botb-at2.webp" alt="Adlib Tracker II screenshot" width="400" height="266" loading="lazy" />
  <small>Image: from [pouet.net](https://www.pouet.net/prod.php?which=63439)</small>

- [**Reality Adlib Tracker (RAD 2)**](https://www.pouet.net/prod.php?which=75963): an OPL tracker for tiny module sizes; v2 added OPL3 support. Free, DOS, Windows, Mac
  <img src="/img/chiptune-tools/botb-rad.webp" alt="Reality Adlib Tracker (RAD 2) screenshot" width="400" height="249" loading="lazy" />
  <small>Image: from [pouet.net](https://www.pouet.net/prod.php?which=75963)</small>

- [**Faust Music Creator**](https://www.pouet.net/prod.php?which=55235): a keyboard-only DOS tracker for the AdLib (OPL2). Today, use Adlib Tracker II or Furnace
  <img src="/img/chiptune-tools/botb-fmc.webp" alt="Faust Music Creator screenshot" width="400" height="250" loading="lazy" />
  <small>Image: from [pouet.net](https://www.pouet.net/prod.php?which=55235)</small>

- [**Scream Tracker 3**](https://www.pouet.net/prod.php?which=13351): a 1994 DOS tracker that gave us the S3M format. Today, use Schism Tracker or OpenMPT
  <img src="/img/chiptune-tools/botb-st3.webp" alt="Scream Tracker 3 screenshot" width="400" height="250" loading="lazy" />
  <small>Image: from [pouet.net](https://www.pouet.net/prod.php?which=13351)</small>

- **AMusic** (AdLib)

### Amiga

- [**ProTracker 2 clone (pt2-clone)**](https://16-bits.org/pt.php): an accurate remake of ProTracker 2 for today's computers. Free, Windows, Mac, Linux
  <img src="/img/chiptune-tools/botb-pt2clone.webp" alt="ProTracker 2 clone (pt2-clone) screenshot" width="491" height="420" loading="lazy" />
  <small>Image: from [GitHub](https://github.com/8bitbubsy/pt2-clone)</small>

- [**HivelyTracker**](https://github.com/pete-gordon/hivelytracker): a 4-16 channel chip tracker based on AHX. Free, Windows, Mac, Linux and more
  <img src="/img/chiptune-tools/botb-hively.webp" alt="HivelyTracker screenshot" width="400" height="300" loading="lazy" />
  <small>Image: from [pouet.net](https://www.pouet.net/prod.php?which=27777)</small>

- [**ProTracker**](https://en.wikipedia.org/wiki/Protracker): the classic 4-channel Amiga tracker behind the MOD format. Today, use the ProTracker 2 clone or OpenMPT
  <img src="/img/chiptune-tools/botb-protracker.webp" alt="ProTracker screenshot" width="525" height="420" loading="lazy" />
  <small>Image: from [Wikipedia](https://en.wikipedia.org/wiki/Protracker)</small>

- [**AHX Tracker**](http://amigascne.org/abyss/ahx/): an Amiga tracker that synthesizes C64 SID-like sounds. Today, use HivelyTracker
  <img src="/img/chiptune-tools/botb-ahx.webp" alt="AHX Tracker screenshot" width="320" height="256" loading="lazy" />
  <small>Image: from [pouet.net](https://www.pouet.net/prod.php?which=13329)</small>

- [**DigiBooster 3**](http://www.digibooster.de/en/): a multichannel Amiga tracker. Today, use OpenMPT
  <img src="/img/chiptune-tools/botb-digibooster.webp" alt="DigiBooster 3 screenshot" width="324" height="259" loading="lazy" />
  <small>Image: from [pouet.net](https://www.pouet.net/prod.php?which=52297)</small>

- [**OctaMED**](https://en.wikipedia.org/wiki/OctaMED): an 8-channel Amiga tracker. Today, use OpenMPT or the ProTracker 2 clone
  <img src="/img/chiptune-tools/botb-octamed.webp" alt="OctaMED screenshot" width="480" height="360" loading="lazy" />
  <small>Image: from [a YouTube video](https://www.youtube.com/watch?v=5drbU51Ag6A)</small>

### Atari 2600

- [**TIATracker**](https://bitbucket.org/kylearan/tiatracker) 1.3.1: a tracker and replay routine for Atari 2600 (TIA) music. Free, Windows, Mac, Linux
  <img src="/img/chiptune-tools/botb-tiatracker.webp" alt="TIATracker screenshot" width="391" height="300" loading="lazy" />
  <small>Image: from [pouet.net](https://www.pouet.net/prod.php?which=67648)</small>

- [**LoopCart**](https://www.qotile.net/loopcart.html): an unfinished loop sequencer running on a real Atari 2600. Today, use TIATracker or Furnace
  <img src="/img/chiptune-tools/botb-loopcart.webp" alt="LoopCart screenshot" width="320" height="240" loading="lazy" />
  <small>Image: from [an archived page on the Internet Archive](https://web.archive.org/web/20071022100656/http://qotile.net/loopcart.html)</small>

### Atari ST (YM2149 and samples)

- [**maxYMiser**](https://www.preromanbritain.com/maxymiser/): a YM2149 tracker running on a real Atari ST, with MIDI support. Free, Atari ST (hardware or emulator)
  <img src="/img/chiptune-tools/botb-maxymiser.webp" alt="maxYMiser screenshot" width="320" height="200" loading="lazy" />
  <small>Image: from [pouet.net](https://www.pouet.net/prod.php?which=85078)</small>

- [**MusicMon**](https://dhs.nu/files.php?t=single&ID=52): a tracker running on a real Atari ST. Today, use maxYMiser
  <img src="/img/chiptune-tools/botb-musicmon.webp" alt="MusicMon screenshot" width="320" height="200" loading="lazy" />
  <small>Image: from [pouet.net](https://www.pouet.net/prod.php?which=18929)</small>

- [**PSG Tracker**](https://www.atarimania.com/games/atari-st-utilities-psg-tracker-22030): a Finnish tracker for the YM2149 (1992). Today, use maxYMiser
  <img src="/img/chiptune-tools/atari-psg-tracker.webp" alt="PSG Tracker screenshot" width="560" height="350" loading="lazy" />
  <small>Image: from [Atarimania](https://www.atarimania.com/games/atari-st-utilities-psg-tracker-22030)</small>

- [**The Music Studio**](https://www.atarimania.com/games/atari-st-utilities-music-studio-the-36357): the ST version of Activision's notation music editor, playing through the ST sound chip or MIDI (1986). Today, use maxYMiser or Furnace
  <img src="/img/chiptune-tools/atari-music-studio-st.webp" alt="The Music Studio screenshot" width="560" height="350" loading="lazy" />
  <small>Image: from [Atarimania](https://www.atarimania.com/games/atari-st-utilities-music-studio-the-36357)</small>

- [**Quartet**](https://www.atarimania.com/games/atari-st-utilities-quartet-29599): a four-voice sample music editor in staff notation (1990). Today, use Furnace or OpenMPT (or maxYMiser on a real ST)
  <img src="/img/chiptune-tools/atari-quartet.webp" alt="Quartet screenshot" width="320" height="200" loading="lazy" />
  <small>Image: from [Atarimania](https://www.atarimania.com/games/atari-st-utilities-quartet-29599)</small>

- [**Audio Sculpture**](https://www.atarimania.com/games/atari-st-utilities-audio-sculpture-25173): a 4-channel Amiga MOD-style sample tracker (1990). Today, use Furnace or OpenMPT (or maxYMiser on a real ST)
  <img src="/img/chiptune-tools/atari-audio-sculpture.webp" alt="Audio Sculpture screenshot" width="560" height="317" loading="lazy" />
  <small>Image: from [Atarimania](https://www.atarimania.com/games/atari-st-utilities-audio-sculpture-25173)</small>

- [**TCB Tracker**](https://www.atarimania.com/games/atari-st-utilities-tcb-tracker-31405): a 4-channel sample tracker from the demo group The Carebears (1990). Today, use Furnace or OpenMPT (or maxYMiser on a real ST)
  <img src="/img/chiptune-tools/atari-tcb-tracker.webp" alt="TCB Tracker screenshot" width="320" height="200" loading="lazy" />
  <small>Image: from [Atarimania](https://www.atarimania.com/games/atari-st-utilities-tcb-tracker-31405)</small>

- [**ProTracker ST**](https://www.atarimania.com/games/atari-st-utilities-protracker-st-30690): the ST version of ProTracker for 4-channel MOD music. Today, use Furnace or OpenMPT (or maxYMiser on a real ST)
  <img src="/img/chiptune-tools/atari-protracker-st.webp" alt="ProTracker ST screenshot" width="320" height="200" loading="lazy" />
  <small>Image: from [Atarimania](https://www.atarimania.com/games/atari-st-utilities-protracker-st-30690)</small>

- [**The Empire Noisetracker (ST-NoiseTracker)**](https://www.atarimania.com/games/atari-st-utilities-empire-noisetracker-the-30689): an ST tracker based on the Amiga Soundtracker and Noisetracker. Today, use Furnace or OpenMPT (or maxYMiser on a real ST)
  <img src="/img/chiptune-tools/atari-empire-noisetracker.webp" alt="The Empire Noisetracker (ST-NoiseTracker) screenshot" width="320" height="200" loading="lazy" />
  <small>Image: from [Atarimania](https://www.atarimania.com/games/atari-st-utilities-empire-noisetracker-the-30689)</small>

- [**The HMS Soundtracker**](https://www.atarimania.com/games/atari-st-utilities-hms-soundtracker-the-23807): a French commercial sample tracker with MIDI support. Today, use Furnace or OpenMPT (or maxYMiser on a real ST)
  <img src="/img/chiptune-tools/atari-hms-soundtracker.webp" alt="The HMS Soundtracker screenshot" width="320" height="200" loading="lazy" />
  <small>Image: from [Atarimania](https://www.atarimania.com/games/atari-st-utilities-hms-soundtracker-the-23807)</small>

- [**Hyper Sound Digital**](https://www.atarimania.com/games/atari-st-utilities-hyper-sound-digital-27492): a three-channel tracker from Delphine Software. Today, use Furnace or OpenMPT (or maxYMiser on a real ST)
  <img src="/img/chiptune-tools/atari-hyper-sound-digital.webp" alt="Hyper Sound Digital screenshot" width="320" height="200" loading="lazy" />
  <small>Image: from [Atarimania](https://www.atarimania.com/games/atari-st-utilities-hyper-sound-digital-27492)</small>

### Atari 8-bit (POKEY)

- [**Raster Music Tracker**](http://raster.infos.cz/atari/rmt/rmt.htm): a Windows tracker for the Atari 8-bit POKEY chip. Free, Windows
  <img src="/img/chiptune-tools/botb-rmt.webp" alt="Raster Music Tracker screenshot" width="400" height="300" loading="lazy" />

- [**Chaos Music Composer**](https://atariki.krap.pl/index.php/Chaos_Music_Composer): a popular Polish music editor running on the Atari 8-bit. Today, use Raster Music Tracker or Furnace
  <img src="/img/chiptune-tools/atari-chaos-music-composer.webp" alt="Chaos Music Composer screenshot" width="336" height="240" loading="lazy" />
  <small>Image: from [Atarimania](https://www.atarimania.com/games/atari-400-800-xl-xe-utilities-chaos-music-composer-37606)</small>
  <img src="/img/chiptune-tools/botb-cmc.webp" alt="Chaos Music Composer screenshot" width="336" height="240" loading="lazy" />
  <small>Image: from [Atariki](https://atariki.krap.pl/index.php/Chaos_Music_Composer)</small>

- [**Delta Music Composer**](https://atariki.krap.pl/index.php/Delta_Music_Composer): a mid-1990s Atari 8-bit music editor. Today, use Raster Music Tracker or Furnace
  <img src="/img/chiptune-tools/botb-dmc-atari.webp" alt="Delta Music Composer screenshot" width="336" height="240" loading="lazy" />
  <small>Image: from [Atariki](https://atariki.krap.pl/index.php/Delta_Music_Composer)</small>

- [**Music ProTracker**](https://atariki.krap.pl/index.php/Music_ProTracker): an Atari 8-bit music tool with sample support. Today, use Raster Music Tracker or Furnace
  <img src="/img/chiptune-tools/botb-mpt.webp" alt="Music ProTracker screenshot" width="336" height="241" loading="lazy" />
  <small>Image: from [Atariki](https://atariki.krap.pl/index.php/Music_ProTracker)</small>

- [**Theta Music Composer**](https://atariki.krap.pl/index.php/Theta_Music_Composer): the first Atari 8-bit editor to allow 8-channel songs. Today, use Raster Music Tracker or Furnace
  <img src="/img/chiptune-tools/botb-tmc.webp" alt="Theta Music Composer screenshot" width="336" height="240" loading="lazy" />
  <small>Image: from [Atariki](https://atariki.krap.pl/index.php/Theta_Music_Composer)</small>

- [**Music Composer**](https://www.atarimania.com/games/atari-400-800-xl-xe-utilities-music-composer-15784): Atari's own cartridge for entering and playing 4-voice music (1979). Today, use Raster Music Tracker or Furnace
  <img src="/img/chiptune-tools/atari-music-composer.webp" alt="Music Composer screenshot" width="384" height="240" loading="lazy" />
  <small>Image: from [Atarimania](https://www.atarimania.com/games/atari-400-800-xl-xe-utilities-music-composer-15784)</small>

- [**Advanced MusicSystem**](https://www.atarimania.com/games/atari-400-800-xl-xe-utilities-advanced-musicsystem-27136): an APX music editor for entering POKEY music measure by measure (1982). Today, use Raster Music Tracker or Furnace
  <img src="/img/chiptune-tools/atari-advanced-musicsystem.webp" alt="Advanced MusicSystem screenshot" width="384" height="240" loading="lazy" />
  <small>Image: from [Atarimania](https://www.atarimania.com/games/atari-400-800-xl-xe-utilities-advanced-musicsystem-27136)</small>

- [**Sound Editor**](https://www.atarimania.com/games/atari-400-800-xl-xe-utilities-sound-editor-29817): an APX sound effect editor for the POKEY (1981). Today, use Raster Music Tracker or Furnace
  <img src="/img/chiptune-tools/atari-sound-editor.webp" alt="Sound Editor screenshot" width="336" height="224" loading="lazy" />
  <small>Image: from [Atarimania](https://www.atarimania.com/games/atari-400-800-xl-xe-utilities-sound-editor-29817)</small>

- [**Music Construction Set**](https://www.atarimania.com/games/atari-400-800-xl-xe-utilities-music-construction-set-14317): Electronic Arts' notation editor where you place notes on a staff (1984). Today, use Raster Music Tracker or Furnace
  <img src="/img/chiptune-tools/atari-music-construction-set-8bit.webp" alt="Music Construction Set screenshot" width="336" height="240" loading="lazy" />
  <small>Image: from [Atarimania](https://www.atarimania.com/games/atari-400-800-xl-xe-utilities-music-construction-set-14317)</small>

- [**Bank Street MusicWriter**](https://www.atarimania.com/games/atari-400-800-xl-xe-utilities-bank-street-musicwriter-29755): a notation-based music editor that can also print scores (1984). Today, use Raster Music Tracker or Furnace
  <img src="/img/chiptune-tools/atari-bank-street-musicwriter.webp" alt="Bank Street MusicWriter screenshot" width="384" height="240" loading="lazy" />
  <small>Image: from [Atarimania](https://www.atarimania.com/games/atari-400-800-xl-xe-utilities-bank-street-musicwriter-29755)</small>

- [**The Music Studio**](https://www.atarimania.com/games/atari-400-800-xl-xe-utilities-music-studio-the-14318): Activision's notation-based music editor (1986). Today, use Raster Music Tracker or Furnace
  <img src="/img/chiptune-tools/atari-music-studio-8bit.webp" alt="The Music Studio screenshot" width="336" height="224" loading="lazy" />
  <small>Image: from [Atarimania](https://www.atarimania.com/games/atari-400-800-xl-xe-utilities-music-studio-the-14318)</small>

- [**The Rhythm Composer**](https://www.atarimania.com/games/atari-400-800-xl-xe-utilities-rhythm-composer-the-30576): a drum sequencer with bass drum, snare, hi-hat and handclap sounds (1986). Today, use Raster Music Tracker or Furnace
  <img src="/img/chiptune-tools/atari-rhythm-composer.webp" alt="The Rhythm Composer screenshot" width="384" height="240" loading="lazy" />
  <small>Image: from [Atarimania](https://www.atarimania.com/games/atari-400-800-xl-xe-utilities-rhythm-composer-the-30576)</small>

- [**Sound Tracker**](https://www.atarimania.com/games/atari-400-800-xl-xe-utilities-sound-tracker-30280): a Polish pattern-based POKEY tracker (1992). Today, use Raster Music Tracker or Furnace
  <img src="/img/chiptune-tools/atari-sound-tracker-asf.webp" alt="Sound Tracker screenshot" width="336" height="240" loading="lazy" />
  <small>Image: from [Atarimania](https://www.atarimania.com/games/atari-400-800-xl-xe-utilities-sound-tracker-30280)</small>

### DOS modules (MOD, S3M, XM, IT)

- [**FT2 clone (ft2-clone)**](https://16-bits.org/ft2.php): a faithful remake of FastTracker II, the tracker behind the XM format, for today's computers. Free, Windows, Mac, Linux
  <img src="/img/chiptune-tools/botb-ft2clone.webp" alt="FT2 clone (ft2-clone) screenshot" width="560" height="371" loading="lazy" />
  <small>Image: from [GitHub](https://github.com/8bitbubsy/ft2-clone)</small>

- [**FastTracker II**](https://www.pouet.net/prod.php?which=13350): a 1994 DOS tracker that defined the XM format. Today, use the FT2 clone or MilkyTracker
  <img src="/img/chiptune-tools/botb-ft2.webp" alt="FastTracker II screenshot" width="400" height="253" loading="lazy" />
  <small>Image: from [pouet.net](https://www.pouet.net/prod.php?which=13350)</small>

- [**Impulse Tracker**](https://en.wikipedia.org/wiki/Impulse_Tracker): the DOS tracker that introduced the IT format; last released in 1999. Today, use Schism Tracker
  <img src="/img/chiptune-tools/botb-it.webp" alt="Impulse Tracker screenshot" width="560" height="350" loading="lazy" />
  <small>Image: from [Wikipedia](https://en.wikipedia.org/wiki/Impulse_Tracker)</small>

- [**ChibiTracker**](https://sourceforge.net/projects/chibitracker.berlios/files): an open-source Impulse Tracker-style clone. Today, use Schism Tracker or OpenMPT
  <img src="/img/chiptune-tools/botb-chibi.webp" alt="ChibiTracker screenshot" width="400" height="292" loading="lazy" />
  <small>Image: from [pouet.net](https://www.pouet.net/prod.php?which=27385)</small>

- [**Composer 669**](https://www.pouet.net/prod.php?which=63357): an early 8-channel DOS tracker from 1992. Today, use OpenMPT or Schism Tracker
  <img src="/img/chiptune-tools/botb-c669.webp" alt="Composer 669 screenshot" width="400" height="250" loading="lazy" />
  <small>Image: from [pouet.net](https://www.pouet.net/prod.php?which=63357)</small>

### Commodore 64

- [**CheeseCutter**](https://github.com/theyamo/CheeseCutter): a SID tracker whose packed tunes play on a real Commodore 64. Free, Windows, Linux
  <img src="/img/chiptune-tools/botb-cheesecutter.webp" alt="CheeseCutter screenshot" width="381" height="300" loading="lazy" />
  <small>Image: from [pouet.net](https://www.pouet.net/prod.php?which=58650)</small>

- [**DMC (Demo Music Creator)**](http://tnd64.unikat.sk/music_scene.html): a native C64 music editor since 1990. Today, use GTUltra or CheeseCutter
  <img src="/img/chiptune-tools/botb-dmc.webp" alt="DMC (Demo Music Creator) screenshot" width="384" height="271" loading="lazy" />
  <small>Image: from [pouet.net](https://www.pouet.net/prod.php?which=13452)</small>

### GAMEBOY and GBA

- [**Carillon Editor**](http://gbdev.gg8.se/files/musictools/Aleksi%20Eeben/Carillon%20Editor.zip): a music editor and player engine running on a real GAMEBOY. Today, use LSDj or hUGETracker
  <img src="/img/chiptune-tools/botb-carillon.webp" alt="Carillon Editor screenshot" width="320" height="288" loading="lazy" />
  <small>Image: from [pouet.net](https://www.pouet.net/prod.php?which=17337)</small>

- [**Paragon5**](http://www.nullsleep.com/programs/p5_tracker.zip): a Windows tracker for the GAMEBOY sound chip. Today, use hUGETracker or Furnace
  <img src="/img/chiptune-tools/botb-paragon5.webp" alt="Paragon5 screenshot" width="480" height="360" loading="lazy" />
  <small>Image: from [a YouTube video](https://www.youtube.com/watch?v=oiy5dEgV9-s)</small>

- [**BoyScout**](https://www.gbadev.org/tools.php?showinfo=187): a Windows tracker for the four GAMEBOY channels. Today, use hUGETracker or Furnace

- [**Fatass Tracker**](http://jeremyevers.com/fatass/): an FT2-style tracker running on a real GAMEBOY COLOR. Today, use LSDj
  <img src="/img/chiptune-tools/botb-fatass.webp" alt="Fatass Tracker screenshot" width="320" height="288" loading="lazy" />
  <small>Image: from [an archived page on the Internet Archive](https://web.archive.org/web/20110203021118/http://jeremyevers.com/fatass/)</small>

- [**Furious Advance Tracker**](https://github.com/cbrouillard/furiousadvancetracker): an LSDj-like tracker for the GBA. Today, use LSDj or Furnace
  <img src="/img/chiptune-tools/botb-fat.webp" alt="Furious Advance Tracker screenshot" width="480" height="320" loading="lazy" />

- [**M4G Tracker**](http://web.archive.org/web/20160524034134/http://m4gtracker.stereoboom.com:80/): an FT2-style GBA tracker that stopped in early beta. Today, use Furnace
  <img src="/img/chiptune-tools/botb-m4g.webp" alt="M4G Tracker screenshot" width="480" height="360" loading="lazy" />
  <small>Image: from [a YouTube video](https://www.youtube.com/watch?v=ginsOUNahxw)</small>

- **Ditty Editor** (GBA)

### NES

- [**j0CC-FamiTracker**](https://github.com/nyanpasu64/j0CC-FamiTracker): a bug-fixed fork of 0CC-FamiTracker. Today, use its successor, Dn-FamiTracker
  <img src="/img/chiptune-tools/botb-j0cc.webp" alt="j0CC-FamiTracker screenshot" width="480" height="360" loading="lazy" />
  <small>Image: from [a YouTube video](https://www.youtube.com/watch?v=899ZnSlLk3Q)</small>

- [**NerdTracker II**](https://www.nesdev.org/nt2/): an early DOS NES tracker behind many old NSFs. Today, use Dn-FamiTracker or Furnace
  <img src="/img/chiptune-tools/botb-nt2.webp" alt="NerdTracker II screenshot" width="474" height="402" loading="lazy" />
  <small>Image: from [pouet.net](https://www.pouet.net/prod.php?which=17650)</small>

- [**NesTracker**](https://www.pouet.net/prod.php?which=56165): an NES tracker that can save NSF. Today, use Dn-FamiTracker or Furnace
  <img src="/img/chiptune-tools/botb-nestracker.webp" alt="NesTracker screenshot" width="358" height="300" loading="lazy" />
  <small>Image: from [pouet.net](https://www.pouet.net/prod.php?which=56165)</small>

- [**Musetracker**](https://files.scene.org/view/resources/music/trackers/musetracker-v15.zip): a PCM-focused NES tracker. Today, use Dn-FamiTracker or Furnace
  <img src="/img/chiptune-tools/botb-musetracker.webp" alt="Musetracker screenshot" width="530" height="418" loading="lazy" />
  <small>Image: from [pouet.net](https://www.pouet.net/prod.php?which=56336)</small>

### Sega (Master System, Mega Drive)

- [**Genny**](https://github.com/superjoebob/genny) v1.54 Beta: a VST instrument recreating the Mega Drive sound (YM2612, SN76489) that can log VGM. Free, Windows
  <img src="/img/chiptune-tools/botb-genny.webp" alt="Genny screenshot" width="560" height="324" loading="lazy" />

- [**Mod2PSG2**](https://www.smspower.org/Music/Mod2PSG2): a tracker for the Master System and Game Gear PSG (SN76489). Today, use Furnace or DefleMask
  <img src="/img/chiptune-tools/botb-mod2psg2.webp" alt="Mod2PSG2 screenshot" width="480" height="360" loading="lazy" />
  <small>Image: from [a YouTube video](https://www.youtube.com/watch?v=1f7JuZaTqXg)</small>

- [**SnevenTracker**](https://github.com/HertzDevil/SnevenTracker): a FamiTracker mod that emulates the SN76489. Today, use Furnace
  <img src="/img/chiptune-tools/botb-sneven.webp" alt="SnevenTracker screenshot" width="480" height="360" loading="lazy" />
  <small>Image: from [a YouTube video](https://www.youtube.com/watch?v=5N7ym-jQNUg)</small>

- [**VGM Music Maker**](http://shiru.untergrund.net/): a tracker for the Mega Drive FM and PSG that exports VGM. Today, use Furnace or DefleMask
  <img src="/img/chiptune-tools/botb-vgmmm.webp" alt="VGM Music Maker screenshot" width="480" height="360" loading="lazy" />
  <small>Image: from [a YouTube video](https://www.youtube.com/watch?v=InvoZSQp_gg)</small>

- [**TFM Music Maker**](http://shiru.untergrund.net/): a tracker for the Mega Drive FM chip (YM2612) that exports VGM. Today, use Furnace or DefleMask
  <img src="/img/chiptune-tools/botb-tfmmm.webp" alt="TFM Music Maker screenshot" width="300" height="300" loading="lazy" />
  <small>Image: from [pouet.net](https://www.pouet.net/prod.php?which=53467)</small>

### ZX Spectrum

- [**Beepola**](https://freestuff.grok.co.uk/beepola/) v1.08.01: a tracker for ZX Spectrum beeper engines. Free, Windows
  <img src="/img/chiptune-tools/botb-beepola.webp" alt="Beepola screenshot" width="560" height="386" loading="lazy" />

- [**Sound-Tracker (ZX)**](https://spectrumcomputing.co.uk/alt/25080/ZX-Spectrum/Soundtracker): an early AY music editor running on the ZX Spectrum (c. 1990). Today, use Vortex Tracker
  <img src="/img/chiptune-tools/botb-zx-soundtracker.webp" alt="Sound-Tracker (ZX) screenshot" width="512" height="384" loading="lazy" />

- [**SQ-Tracker**](https://worldofspectrum.org/archive/software/utilities/sq-tracker-proxima-software): a 1993 AY tracker for the ZX Spectrum 128K. Today, use Vortex Tracker
  <img src="/img/chiptune-tools/botb-sqtracker.webp" alt="SQ-Tracker screenshot" width="512" height="384" loading="lazy" />

### VIC-20

- [**baby-k (vixxen20)**](https://langel.github.io/vixxen20/) v0.8.2: a browser-based VIC-20 tracker. Free
  <img src="/img/chiptune-tools/botb-babyk.webp" alt="baby-k (vixxen20) screenshot" width="480" height="360" loading="lazy" />
  <small>Image: from [a YouTube video](https://www.youtube.com/watch?v=BBclnLIG3aI)</small>

- [**VIC-TRACKER**](http://www.kahlin.net/daniel/victracker/): a tracker running on a real VIC-20. Today, use baby-k or Furnace
  <img src="/img/chiptune-tools/botb-victracker.webp" alt="VIC-TRACKER screenshot" width="400" height="333" loading="lazy" />

### Nintendo DS

- [**NitroTracker**](https://github.com/0xtob/nitrotracker): an FT2-style tracker for the Nintendo DS, operated with a stylus. Today, use citratracker on 3DS, or Furnace or MilkyTracker on a PC
  <img src="/img/chiptune-tools/botb-nitro.webp" alt="NitroTracker screenshot" width="200" height="300" loading="lazy" />
  <small>Image: from [pouet.net](https://www.pouet.net/prod.php?which=24323)</small>

- [**KORG DS-10**](https://en.wikipedia.org/wiki/KORG_DS-10): a KORG synth (MS-20 style) and drum app for the Nintendo DS. Today, use KORG iDS-10 on iPhone and iPad
  <img src="/img/chiptune-tools/botb-ds10.webp" alt="KORG DS-10 screenshot" width="434" height="420" loading="lazy" />
  <small>Image: from [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:KORG_DS-10.jpg)</small>

- [**Mario Paint Composer DS**](https://github.com/DerrickGold/MarioPaintComposer-NDS): a Mario Paint-style composer for the Nintendo DS. Today, use Super Mario Paint on a PC
  <img src="/img/chiptune-tools/botb-mpcds.webp" alt="Mario Paint Composer DS screenshot" width="256" height="384" loading="lazy" />

- **ProteinDS** (Nintendo DS)

- **Seno DS** (Nintendo DS)

### Channel F

- [**Sleizsa Trio**](https://github.com/utz82/SleizsaTrio) v0.1: a three-channel music routine for the Fairchild Channel F, composed in an XM tracker or the browser. Free

- [**Sleizsa**](https://web.archive.org/web/20170926123546/http://average.truechiptilldeath.com/channelf/sleizsa_v0_31.zip): a monophonic sequencer for the Channel F (2008). Today, use Sleizsa Trio

- [**Sleizsa Duo**](https://github.com/utz82/SleizsaDuo): a two-channel Channel F music routine (2015). Today, use Sleizsa Trio

### Mario Paint

- [**Mario Sequencer**](https://github.com/minghai/MarioSequencer): a Mario Paint-style composer for Windows and the browser. Today, use Super Mario Paint on a PC
  <img src="/img/chiptune-tools/botb-mariosequencer.webp" alt="Mario Sequencer screenshot" width="413" height="420" loading="lazy" />

### Portable and other trackers

- [**LittleGPTracker (Little Piggy Tracker)**](https://github.com/djdiskmachine/LittleGPTracker) 1.5.0: an LSDj-like 8-channel sample tracker, the basis of picoTracker. Free, Windows, Mac, Linux, handhelds and more
  <img src="/img/chiptune-tools/botb-lgpt.webp" alt="LittleGPTracker (Little Piggy Tracker) screenshot" width="560" height="420" loading="lazy" />
  <small>Image: from [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Little_Game_Park_Tracker_(LGPT,_aka_Piggy_Tracker)</small>

- [**ProTrekkr**](https://github.com/hitchhikr/protrekkr) v2.8.3_PRE_2: a tracker and synth for small-size demo and intro music. Free, Windows, Mac, Linux
  <img src="/img/chiptune-tools/botb-protrekkr.webp" alt="ProTrekkr screenshot" width="400" height="298" loading="lazy" />

- [**klystrack**](https://kometbomb.github.io/klystrack/): a chiptune tracker with SID and NES-style synthesis. Free, Windows, Mac, Linux
  <img src="/img/chiptune-tools/botb-klystrack.webp" alt="klystrack screenshot" width="560" height="420" loading="lazy" />

- [**Radium**](https://radium.dog/) 8.2.55: a tracker-like music editor with graphical editing of notes and automation. Free demo, Windows, Mac, Linux
  <img src="/img/chiptune-tools/botb-radium.webp" alt="Radium screenshot" width="560" height="315" loading="lazy" />

- [**Polyend Tracker**](https://polyend.com/tracker/): a standalone hardware tracker groovebox, now also available as Tracker+ and Tracker Mini
  <img src="/img/chiptune-tools/botb-polyend.webp" alt="Polyend Tracker screenshot" width="420" height="420" loading="lazy" />
  <small>Image: from [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Polyend_Tracker_Standalone_Audio_Workstation.jpg)</small>

### MML and scripts

- [**HuSIC**](https://github.com/BouKiCHi/HuSIC): an MML sound driver for the PC Engine. Free

- [**XPMCK**](http://jiggawatt.org/muzak/xpmck/): an MML compiler kit for the C64, GAMEBOY, PC Engine, Master System, Mega Drive and more. Today, use Furnace or a chip-specific MML driver

- [**athtune**](http://ftp.modland.com/pub/software/trackers/Windows/Athtune/): a script-based, MML-like tool where sounds are defined in C#. Today, use Furnace or an MML compiler

- **NDS BGMFILER** (Nintendo DS)

### Phone ringtones

- [**Nite (Nokia Internal Tune Editor)**](http://onj3.andrelouis.com/phonetones/Software%20and%20Soundbanks/Software/Nokia/Nokia%20Internal%20Tune%20Editor.zip): Nokia's leaked internal editor for monophonic ringtones

- **Nokia PC Composer** (Windows)

- **CMX Studio** (Windows)

- **ATS-MA SMAF tools** (Windows)

### Helper tools and players

- [**LSDPatch**](https://github.com/jkotlinski/lsdpatch) v1.13.3: manage LSDj songs and customize LSDj ROMs (kits, fonts, palettes). Free, Windows, Mac, Linux
  <img src="/img/chiptune-tools/botb-lsdpatch.webp" alt="LSDPatch screenshot" width="480" height="360" loading="lazy" />
  <small>Image: from [a YouTube video](https://www.youtube.com/watch?v=rXWofyfodG8)</small>

- [**GBT Player**](https://github.com/AntonioND/gbt-player) v4.4.1: libraries and converters for music in GAMEBOY and GBA homebrew. Free

- [**SNESMOD**](https://github.com/mukunda-/snesmod): converts IT modules to SNES sound (SPC). Free
  <img src="/img/chiptune-tools/botb-snesmod.webp" alt="SNESMOD screenshot" width="480" height="360" loading="lazy" />
  <small>Image: from [a YouTube video](https://www.youtube.com/watch?v=d_ZII9GdDBQ)</small>

- [**Maxmod**](https://maxmod.org/) v2.1.0: a library for playing MOD, XM, IT and more in GBA and DS homebrew. Free
  <img src="/img/chiptune-tools/botb-maxmod.webp" alt="Maxmod screenshot" width="512" height="384" loading="lazy" />

- [**NSFPlay**](https://bbbradsmith.github.io/nsfplay/) 2.6: an accurate player for NES music files (NSF). Free, Windows
  <img src="/img/chiptune-tools/botb-nsfplay.webp" alt="NSFPlay screenshot" width="373" height="115" loading="lazy" />
  <small>Image: from [GitHub](https://github.com/bbbradsmith/nsfplay)</small>

- [**FMPMD2000**](http://c60.la.coocan.jp/fmpmd.html): a Windows player for PC-88 and PC-98 PMD music. Free

- [**it2nsf**](https://github.com/mukunda-/it2nsf): converts specially made IT files into NSF. Today, use Dn-FamiTracker or Furnace

- [**s3m2nsf**](https://github.com/mukunda-/s3m2nsf): converts specially made S3M files into NSF. Today, use Dn-FamiTracker or Furnace

- [**it2vgm.py**](http://web.archive.org/web/20101123045821/http://pubacc.wilcox-tech.com/~greaser/stuff/it2vgm.py.txt): a Python script that converts IT files into SN76489 VGM. Today, use Furnace

- [**FTM2GBMC**](https://github.com/Savestate2A03/FTM2GBMC): converts FamiTracker text exports into GBMC MML. Today, use Furnace or hUGETracker

- [**VirtuaNSF**](http://virtuanes.s1.xrea.com/): an NSF player based on the VirtuaNES emulator. Today, use NSFPlay

- [**hoot**](http://dmpsoft.s17.xrea.com/hoot/): a player that emulates sound hardware for Japanese computer and console music. Windows
  <img src="/img/chiptune-tools/botb-hoot.webp" alt="hoot screenshot" width="525" height="420" loading="lazy" />

- **Mumml** (Windows)

- **OpenSPC** (DOS, Windows)

## To dig deeper {#en-more}

For more obscure trackers and tools not covered here, see the wiki pages of the chiptune community Battle of the Bits.

- [List of trackers](https://battleofthebits.com/lyceum/View/List+of+Trackers)

- [Formats by sound chip and hardware (consoles and chips)](https://battleofthebits.com/lyceum/View/Format)

- [Helper tools](https://battleofthebits.com/lyceum/View/Tools)

## What changed since the 2021 roundup {#en-changes}

- **SANA 8BIT VST** and **VOPM**: both are old 32-bit plugins and often won't run as is in today's DAWs. For NES sounds, Magical 8bit Plug 2 or New DoReFAMI can take their place, and for the YM2151, my2151 or chipsynth OPMZ

Tool versions and prices are as of October 30, 2026, based on each tool's download page. Most screenshots are sourced from official sites (including the App Store) and [Lospec](https://lospec.com/software/). The screenshots for BeepBox, JummBox, UltraBox, Slarmoo's Box, FlMML on HTML5, browser-mml-player, NSF2MML, LSDJ Converter, and SNDH Player were captured directly by me. Screenshots for little-scale's trackers, WebX68k, and NOTE MDX Workbench were sourced from the creators' posts on X, and those for Dn-FamiTracker, Furnace, furnace-piano-roll, FamiStudio, KiraStudio, OpenMPT, WaveTracker, GTUltra, SID Factory II, Bamboo Tracker, DefleMask, and LabChirp were kindly provided by Rei8bit. Images in the by-system section come from each tool's page as well as Battle of the Bits, Atarimania, pouet.net, Wikipedia, and YouTube video thumbnails.
{{< /lang >}}

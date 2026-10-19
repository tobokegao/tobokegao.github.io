---
title: ReaScratch
title_en: ReaScratch
description: REAPERで音と映像をスクラッチする無料のキット
description_en: A free kit for scratching audio and video in REAPER
---

{{< lang ja >}}
ReaScratchは、REAPERを音と映像の2デッキのスクラッチ環境にする、無料のJSFXとLuaスクリプトのキットです。DJコントローラーのジョグを回すと、音の高さを保ったままスクラッチでき、REAPERのビデオ画面の映像もコマ単位でついてきます。

<p class="win__more"><a class="btn" href="https://github.com/tobokegao/ReaScratch/releases/latest">ダウンロード</a></p>

GitHubのReleasesから、最新版のzipファイルをダウンロードできます。ReaPackでも入れられ、新しいバージョンもReaPackで受け取れます（手順は説明書の「セットアップ手順」にあります）。

動いているところは、[Xの動画](https://x.com/to6okegao/status/2111040461242847714)で見られます。

## できること

- 2デッキ、クロスフェーダー、ホットキューとメモリーキュー、SLIP、BEAT SYNC、ループ、フィルター
- スクラッチしているあいだも、映像が音についてくる
- DJコントローラーのプリセット（MIDI）と、NI Traktor Kontrol S2/S3/S4のためのHIDブリッジ
- プリセットを手元の機材と照らし合わせたり、新しく作ったりできる画面（setupの`Learn`タブ）

## 動作環境

- REAPER 7.x（WindowsとmacOS）。macOSで動作を確かめたのは初期のバージョンだけで、そのあとに足した機能はまだ確かめていません。
- 基本の機能は、REAPERだけで動きます。FFmpeg、js_ReaScriptAPI、SWSは、なくても動きます（あると使える機能が増えます）。

## 対応機材

122個のプリセットがあります。実機で確かめたのはAkai APC40 mkIIとReloop Buddyだけで、ほかの機種には⚠が付いています。これらはメーカーのMIDI一覧や有志の割り当てをもとに作っており、実機での確認はまだできていません。

## 試してくれる人の募集

⚠の付いた機種をお持ちの方は、次の手順で試していただけると助かります。

1. キットを入れて、setupで自分の機種のプリセットを選ぶ
2. `Learn`タブを開き、案内どおりにつまみやボタンを触る
3. 結果（✓/✗の一覧、または保存した`.reascratch-preset`ファイル）と、気になったところ（ジョグの向きや速さ、テンポフェーダーの向き、ボタンの反応など）を、[GitHubのIssues](https://github.com/tobokegao/ReaScratch/issues)に送る

## 説明書

説明書はキットに入っています（Releasesのzipにも入っています）。

- 日本語: [ReaScratch_manual.pdf](https://github.com/tobokegao/ReaScratch/blob/main/ReaScratch_manual.pdf)、[README.md](https://github.com/tobokegao/ReaScratch/blob/main/README.md)
- 英語: [ReaScratch_manual_en.pdf](https://github.com/tobokegao/ReaScratch/blob/main/ReaScratch_manual_en.pdf)、[README_en.md](https://github.com/tobokegao/ReaScratch/blob/main/README_en.md)

## ライセンスとクレジット

ライセンスはGPL-3.0-or-laterです。フィルターはSaikeのJSFX（MITライセンス）から、映像のVHSのエフェクトはzhukerのntsc（Apache License 2.0）から移植しました。コントローラーの情報は、Mixxxの割り当て、メーカーのMIDI一覧、SuperXtremeMapper、有志の割り当てをもとにしています。スクラッチをJSFXの中で行うアイデアは、tilrのTIME-1から得ました。くわしくは[CREDITS.md](https://github.com/tobokegao/ReaScratch/blob/main/CREDITS.md)にあります。

ReaScratchは、Claudeに手伝ってもらって作りました。
{{< /lang >}}

{{< lang en >}}
ReaScratch is a free JSFX and Lua kit that turns REAPER into a two-deck scratch setup for audio and video. You can scratch with a DJ controller's jog wheel while maintaining the sound's pitch, and REAPER's video window follows frame by frame.

<p class="win__more"><a class="btn" href="https://github.com/tobokegao/ReaScratch/releases/latest">Download</a></p>

Download the latest zip from GitHub Releases. You can also install it with ReaPack and get new versions there (see "Setup" in the manual).

See it in action in [the video on X](https://x.com/to6okegao/status/2111040461242847714).

## What it does

- Two decks, crossfader, hot cues and memory cues, SLIP, BEAT SYNC, loops, filters
- The video follows the audio while you scratch
- Presets for DJ controllers (MIDI), plus an HID bridge for NI Traktor Kontrol S2/S3/S4
- A screen to check a preset against your controller or make a new one (the `Learn` tab in setup)

## Requirements

- REAPER 7.x on Windows or macOS. On macOS, only an early version has been tested; features added since have not been tried there yet.
- The basic features need nothing but REAPER. FFmpeg, js_ReaScriptAPI and SWS are optional (they unlock additional features).

## Controllers

There are 122 presets. Only the Akai APC40 mkII and the Reloop Buddy have been tested on real hardware. All other presets are marked with ⚠: they were built from manufacturers' MIDI lists and community mappings, and have not been tested on actual hardware yet.

## Testers wanted

If you own a controller marked ⚠, I'd be grateful if you could:

1. Install the kit and pick your controller's preset in setup
2. Open the `Learn` tab and operate the controls as prompted
3. Send the results (the ✓/✗ list or the saved `.reascratch-preset` file) and anything that feels off (jog direction or speed, tempo fader direction, button behavior) to [GitHub Issues](https://github.com/tobokegao/ReaScratch/issues)

## Manuals

The manuals come with the kit (and are in the Releases zip).

- English: [ReaScratch_manual_en.pdf](https://github.com/tobokegao/ReaScratch/blob/main/ReaScratch_manual_en.pdf), [README_en.md](https://github.com/tobokegao/ReaScratch/blob/main/README_en.md)
- Japanese: [ReaScratch_manual.pdf](https://github.com/tobokegao/ReaScratch/blob/main/ReaScratch_manual.pdf), [README.md](https://github.com/tobokegao/ReaScratch/blob/main/README.md)

## License and credits

ReaScratch is licensed under GPL-3.0-or-later. The filters are ported from Saike's JSFX (MIT License), and the VHS video effect from zhuker's ntsc (Apache License 2.0). Controller data comes from Mixxx mappings, manufacturers' MIDI lists, SuperXtremeMapper and community mappings. The idea of scratching inside a JSFX came from tilr's TIME-1. See [CREDITS.md](https://github.com/tobokegao/ReaScratch/blob/main/CREDITS.md) for details.

Built with extensive AI assistance (Claude).
{{< /lang >}}

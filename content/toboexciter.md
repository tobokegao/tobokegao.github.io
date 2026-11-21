---
title: Tobo Exciter
title_en: Tobo Exciter
description: 1980年代のエキサイターペダルを再現した、無料のVST3プラグイン
description_en: A free VST3 plug-in that models a 1980s exciter pedal
---

{{< lang ja >}}
Tobo Exciter（TE-02）は、Windows用の無料のVST3エフェクトです。1980年代のエキサイターペダルを、実機の計測をもとに再現しています。弾いた音の上に、明るく刺さるような倍音が加わります。ノブを上げると、弾いた音とは別に、一定の音程でペダルが歌うように鳴ります。東京事変の「群青日和」のギターソロの音も出せます。

<p class="win__more win__more--center"><a class="btn" href="https://github.com/tobokegao/ToboExciter/releases/latest">ダウンロード</a></p>

GitHubのReleasesから、最新版のZIPファイルをダウンロードできます。

{{< video "toboexciter/tobo_exciter_demo.mp4" "img/toboexciter/demo.webp" "デモ動画: ファズを通したギターの前段にTobo Exciterを置き、ノブを動かしています。" >}}

このプラグインは独立した作品です。どのハードウェアメーカーとも提携しておらず、公認・協賛も受けていません。

## できること

- ペダルと同じ4つのノブ（FREQUENCY・COLOR・BALANCE・MULTIPEAK）。効き方のカーブは、計測した実機に合わせている
- フットスイッチをクリックすると、音をなめらかにつないでオンとオフが切り替わる。プチッというノイズは出ない
- INPUTで歪みの強さを決め、OUTPUTで音量を戻す。どちらにもメーターがつく
- オーバーサンプリングは2x・4x・8x。高い設定ほど音のにごり（折り返しノイズ）が減る
- 内蔵のプリセットが8つ。設定をプリセットファイル（`.tepreset`）に保存し、読み込むこともできる
- 画面の大きさは60〜200%
- 画面は、このプラグインのためにBlenderで作った3Dモデルの画像

## 使いかた

1. ギターのトラックで、アンプや歪みエフェクトの前に入れる
2. BALANCEを右に回すと、フィルターを通った音が増え、元の音が減る
3. COLORを右に回すと、フィルターのピークが鋭くなる。ピークの位置はFREQUENCYで決める
4. MULTIPEAKを右に回すと、固定された6つのピークが加わる
5. INPUTで歪みの強さを好みに合わせ、OUTPUTで音量を戻す
6. フットスイッチをクリックして、エフェクトなしの音と聴き比べる

一定の音程で鳴り続ける音は、プリセットのOne NoteとThin Screamで試せます。

<p class="doc__pic te__parts"><a href="/img/toboexciter/parts-full.webp" target="_blank" rel="noopener" data-zoom><img src="/img/toboexciter/parts.webp" width="929" height="773" alt="画面の各部の名前" loading="lazy" decoding="async"></a></p>

## 入れかた

1. ZIPファイルを展開する
2. `Tobo Exciter.vst3`フォルダーを、フォルダーごと`C:\Program Files\Common Files\VST3\`にコピーする
3. DAWでプラグインを再スキャンする

インストーラーも追加のランタイムも要りません。コード署名はしていません。

## 動作環境

- Windows（64ビット）、VST3、モノラルまたはステレオ
- 確かめたのは、Windows 11とREAPER 7.86、48kHzの組み合わせだけです。ほかのDAWで動いたかどうか、[GitHubのIssues](https://github.com/tobokegao/ToboExciter/issues)で教えてもらえると助かります。
- ステレオでは、左右のチャンネルが別々のペダルとして働きます。
- モデルは1台の実機に合わせています。実機のノイズは再現していません。

## 説明書

説明書（PDF）がZIPファイルに入っています（日本語は`ToboExciter_manual.pdf`、英語は`ToboExciter_manual_en.pdf`）。GitHubでも読めます。

- 日本語: [README_ja.md](https://github.com/tobokegao/ToboExciter/blob/main/README_ja.md)
- 英語: [README.md](https://github.com/tobokegao/ToboExciter/blob/main/README.md)

## ライセンスとクレジット

ライセンスはAGPL-3.0-or-laterで、ソースコードは[GitHub](https://github.com/tobokegao/ToboExciter)にあります。JUCEとVST 3 SDKを使っています。VSTはSteinberg Media Technologies GmbHの登録商標です。使っているライブラリは、[CREDITS.md](https://github.com/tobokegao/ToboExciter/blob/main/CREDITS.md)にあります。

このプラグインは独立した作品です。どのハードウェアメーカーとも提携しておらず、公認・協賛も受けていません。

Tobo Exciterは、Claudeに手伝ってもらって作りました。
{{< /lang >}}

{{< lang en >}}
Tobo Exciter (TE-02) is a free VST3 effect for Windows. It models a 1980s exciter pedal, based on measurements of a real unit. It adds a bright, biting edge to the notes you play. With the knobs turned up, the pedal sings at a single pitch of its own on top of what you play. It can also make the sound of the guitar solo in "Gunjo Biyori" by Tokyo Jihen.

<p class="win__more win__more--center"><a class="btn" href="https://github.com/tobokegao/ToboExciter/releases/latest">Download</a></p>

Download the latest ZIP from GitHub Releases.

{{< video "toboexciter/tobo_exciter_demo.mp4" "img/toboexciter/demo.webp" "Demo video: a guitar through a fuzz, with Tobo Exciter in front of it and its knobs moved." >}}

This plug-in is an independent work. It is not affiliated with, endorsed by, or sponsored by any hardware manufacturer.

## What it does

- Four knobs, just like on the original pedal (FREQUENCY, COLOR, BALANCE and MULTIPEAK); their tapers follow the measured unit
- Clicking the foot switch turns the effect on and off with a short crossfade, so there is no pop
- INPUT sets how hard the pedal is driven, and OUTPUT brings the level back; each has a meter
- Oversampling at 2x, 4x or 8x; a higher setting gives less aliasing
- Eight built-in presets, and preset files (`.tepreset`) that you can save and load
- A panel that scales from 60% to 200%
- The panel is a render of a 3D model made for this plug-in with Blender

## How to use it

1. Put it on a guitar track, before your amp or distortion
2. Turn BALANCE clockwise for more of the filtered sound and less of the direct sound
3. Turn COLOR clockwise to sharpen the filter's peak, and turn FREQUENCY to choose where the peak sits
4. Turn MULTIPEAK clockwise to add the six fixed peaks
5. Set INPUT so that the pedal is driven as hard as you like, then bring the level back with OUTPUT
6. Click the foot switch to compare it with the bypassed sound

To hear a sound that stays on one pitch, try the presets One Note and Thin Scream.

<p class="doc__pic te__parts"><a href="/img/toboexciter/parts-full.webp" target="_blank" rel="noopener" data-zoom><img src="/img/toboexciter/parts.webp" width="929" height="773" alt="The names of the parts of the panel" loading="lazy" decoding="async"></a></p>

## Install

1. Extract the ZIP file
2. Copy the entire `Tobo Exciter.vst3` folder to `C:\Program Files\Common Files\VST3\`
3. Have your DAW rescan for plug-ins

No installer or extra runtime is needed. The plug-in is not code-signed.

## Requirements

- 64-bit Windows, VST3, mono or stereo
- Tested only on Windows 11 with REAPER 7.86 at 48 kHz. If you try it in another DAW, I'd appreciate it if you could let me know on [GitHub Issues](https://github.com/tobokegao/ToboExciter/issues) how it worked.
- In stereo, the two channels work as two separate pedals.
- The model is based on a single unit. The noise of the hardware is not modeled.

## Manuals

The manuals are in the ZIP file as PDFs (`ToboExciter_manual_en.pdf` in English, `ToboExciter_manual.pdf` in Japanese). You can also read them on GitHub.

- English: [README.md](https://github.com/tobokegao/ToboExciter/blob/main/README.md)
- Japanese: [README_ja.md](https://github.com/tobokegao/ToboExciter/blob/main/README_ja.md)

## License and credits

Tobo Exciter is licensed under AGPL-3.0-or-later, and the source code is on [GitHub](https://github.com/tobokegao/ToboExciter). It is built with JUCE and the VST 3 SDK. VST is a registered trademark of Steinberg Media Technologies GmbH. The libraries it uses are listed in [CREDITS.md](https://github.com/tobokegao/ToboExciter/blob/main/CREDITS.md).

This plug-in is an independent work. It is not affiliated with, endorsed by, or sponsored by any hardware manufacturer.

Made with help from Claude.
{{< /lang >}}

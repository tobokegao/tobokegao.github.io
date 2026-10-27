---
title: 「Instant Color」のLSDjカバーで使った打ち込み
title_en: Programming Tricks from My LSDj Cover of "Instant Color"
date: 2026-10-27
description: 4chしかないGAMEBOYにバンドの曲を収めるためにやったこと（LSDjの設定値つき）
description_en: What I did to fit a band song into the GAMEBOY's four channels, with the LSDj settings
---

{{< yt "8K-__gzokdk" >}}

{{< lang ja >}}
syrup16gの「Instant Color」を、LSDjでカバーしました。GAMEBOYで鳴らせるのはPU1・PU2・WAV・NOISEの4chで、どれも単音しか出せません。バンドの音を収めるためにいろいろ工夫したので、そのとき使った技を、実際の設定値と一緒にまとめておきます。DAWのピアノロールやSerum 2で同じことをするときの置き換えも書いておきます。

LSDjの画面やコマンドの説明は省いています。LSDjを触ったことがない人向けの版は、[note](https://note.com/tobokegao/n/n046641cf7e0c)に書きました。

## テンポとグルーヴ

テンポは252にして、1拍を48tickに分けています。1拍4ステップのtick数の合計が48になるようにグルーヴを組むと、実際の速さは126BPMになります。1tickは約9.9msです。

- グルーヴ00 `14/14/10/10`：歌の部分。裏の8分が48tick中28tick目に来る、軽いシャッフル
- グルーヴ01 `16/16/8/8`：ギターリフの部分。1〜3ステップ目が8分3連の位置に来る
- グルーヴ02 `5/23/5/15`：歌の部分のWAV
- グルーヴ03 `5/27/5/11`：リフの部分のWAV

グルーヴ02と03は、8分の位置がそれぞれ00・01と同じで、そのあいだの5tick目にもう1ステップ入ります。ここにベースを置いています（次の項目）。セクションが変わる小節の頭で、全chに`G`を置いて切り替えています。

- DAW：スウィングをクリップごとに分けます。歌の部分は8分スウィング約58%、リフの部分は約67%（3連）です。

## WAVでキックとベースを交互に鳴らす

WAVでは、キック・スネアとベースを1chで交互に鳴らしています。キックとスネアの位置では音色をWKICK・WSNRに替えて、5tick後（グルーヴ02・03の2つ目のステップ）に、ベースの音色（SLAP）で打ち直します。単音なので、キックの瞬間はベースが必ず切れて、サイドチェインをかけたのと同じ形になります。

WKICKはテーブルで、トランスポーズ`03`と、`PB8`→`PD0`のピッチベンドで音程を一気に下げて、6行目の`K00`で切っています。WSNRも`PD0`→`PD8`で下げています。

さらに、WAVのキック・スネアは、NOISEのキック（NKICK）・スネア（SNR01）と同じ位置に重ねてレイヤーしています。WAVで低い胴鳴り、NOISEでアタックを足すイメージです。NKICKはテーブルのトランスポーズを`BF`→`B5`→`75`→`27`と下げて、ノイズの音程を落としています。

- DAW：キックの位置だけ、ベースの頭を50msくらい遅らせます。または、そこだけベースを切って直後に打ち直します。ドラムは、胴鳴り担当とアタック担当の2トラックを同じ位置に打ち込みます。
- Serum 2：1つのパッチで兼ねることもできます。Mono・Legatoオフで毎回リトリガーにして、Env2をピッチに短く+24〜36半音かけると、叩いた瞬間だけキックっぽくなります。波形の切り替えは、Env2をWavetable Positionにもかけると近くなります。NOISEのレイヤーは、Noiseオシレーターを短いエンベロープで足します。

## 和音アルペジオ

コードは、3和音のテーブルを4tickずつ回して鳴らしています。テーブル0C（M）・0D（m）・0E（sus）で、トランスポーズを4行ずつ並べて（`00`→`04`→`07`、`00`→`03`→`07`、`00`→`05`→`07`）、12行目の`H00`で頭に戻します。

M7やm7も、ぶつからないように7thを抜いて3和音で回しています。音域は、歌メロより下の1オクターブ内に収めています。

イントロのあとのカッティングでは、別のテーブル（15〜17）で、構成音が変わるたびに`O01`→`O02`→`O01`とパンも切り替えています。1つの和音の中で、構成音ごとに左右へ振れます。

強弱は音符の横の`E`で付けています。

- Aメロのカッティング：小節頭`E63`、裏拍`E95`
- サビの8分ストローク：表`EA5`、裏`E74`
- サビ前の連打：`E53`→`E73`→`E93`→`EB3`→`ED3`で、だんだん大きく

ブリッジの隙間では、`E0D`で音量0から膨らませた和音を、6ステップ後の`K00`で切っています。2回目のサビ終わりのキメは、全chで12ステップ目を叩いて、14ステップ目の`K00`で無音にしています。

- DAW：和音を書くときも、7thは抜いて歌メロの下に収めると濁りにくいです。強弱はベロシティで付けます。
- Serum 2：Arpを使います。Rate 1/48くらい（3連32分あたり）、パターンはUpかOrder、Gate長めです。チップ感がほしいときはMono＋Glideなし。マトリクスでVelocity→Env1 Levelに加えて、Velocity→Env1 Decayも少しかけると、強い音ほど長く伸びて近くなります。

## ハモリを1chにまとめる

PU1の歌メロには、ハモリ用の音色（HRM+7・HRM+8・HRM+9）を使っています。中身は歌メロと同じ音色にテーブルを付けたもので、テーブルの中で元の音とハモリの音を入れ替えています。

テーブルは`G1D`（1行2tick）で回していて、元の音を数行鳴らしたあと、ハモリを2行（4tick）挟む並びです。ハモリの行にだけ`O01`と`O02`を交互に入れているので、元の音は真ん中、ハモリは左右に振れます。最後の行の`H06`で途中に戻ってループします。

音色名の数字は、歌メロから見た上の音程です。原曲のコーラスはメロの下にいるので、実際はオクターブ下げて鳴らしています（+7は`FB`、+8は`FC`、+9は`FD`）。

ハモリの音程は、原曲のコーラスが鳴っているところはその音程をそのまま使いました。それ以外は、フレーズごとに3度と6度のどっちがコードトーンに多く当たるかで選んで、ぶつかる音だけもう片方に差し替えています。音程ごとに音色を分けたので、コマンド欄は`D`用に空けておけます。

- DAW：ハモリを別ノートで書くときも、この選び方はそのまま使えます。
- Serum 2：チップっぽく交互に鳴らしたいときは、Arpに2音だけ入れます。

## 歌メロの置き方

歌は、ステップの位置から`D04`や`D0A`のようにtick単位で遅らせて置いています。3半音以内で続けて歌う音は打ち直さずに`L04`で滑らせ、長く伸ばす一部の音には、3ステップ後に`V01`をかけています。フレーズの終わりは、`K04`や`K05`のようにtickまで指定して切っています。

- DAW：スナップを切るか細かいグリッドにして、歌のタイミングどおりに前後させます。
- Serum 2：PortamentoをLegatoにすると、重なったノートだけ滑ります。ビブラートは、LFOのDelayを約3/16拍にしてOsc Fineにかけます。

## 打ち込みのディレイ

ディレイはエフェクトではなく、打ち込んでいます。やり方は2つです。

1つ目は1chだけでやる方法です。同じchで、元の音のあとに、音量を下げた音色で同じ音を打ち直して反復させます。

2つ目は、PU1の歌をPU2にコピーする方法です。エコー用の音色は、中央（ECHOL）と左右（ECHLL・ECHOR）の3つで、パンだけが違います。エンベロープは`66`で、歌メロ（`E7`）より小さくしています。

- ブリッジ：PU1の24tick（8分）後に、エコーを左右交互に置いています
- 3:22あたり：8分後と1拍後（こちらは`E45`でさらに小さく）の2回
- 2番のAメロ：歌の1ステップ後にコピーを置いて、`O01`と`O02`で1音ずつ左右に振ります。伴奏は、戻る2ステップ前から`E1B`で膨らませて入ります

どの場合も、次の歌が来る1ステップ前に`K00`でエコーを止めています。

エコー用の音色には、テーブル1Dで`F05`をかけて、元の音より少し（約+13セント）高くしています。`H01`で2行目に止まるので、ずれたまま鳴り続けます。重なったときに少しうねって、コーラスのように広がります。

- DAW：1つ目は、同じトラックにベロシティを下げた同じ音を書き足します。2つ目は、歌メロのMIDIを別トラックに複製して、遅らせてベロシティを下げ、左右に振ります。次のフレーズと重なるところは手で消します。
- Serum 2：1つ目はMonoにしておくと、次の音が来た瞬間にエコーが切れてLSDjっぽくなります。2つ目は複製トラックのFilterを少し下げて暗めにして、Osc Fineを+10〜15セントくらいずらします。どちらも、普通のディレイとダッキングより、休符にだけエコーがはっきり残るのが良いところです。

## ギターの音色

ギターの音色（GTR）は、テーブルの1行目だけ`W02`（デューティ比50%）にして、すぐ`W01`（25%）に戻しています。ピックが当たる最初の1tickだけ、音が太くなります。`F03`で少しずらしてもいます。

オクターブを行き来するギター（GTROC）は、同じ形のテーブルで、トランスポーズ`0C`を4行ずつ挟み、`H04`でループさせています。4tickごとに1オクターブ上と行き来します。

イントロと最後のアルペジオは、音を1つずつPU1とPU2に振り分けています（GTR-L・GTR-R）。前の音が、次の音の下で鳴り続けます。

- Serum 2：Polyを2ボイスにしてノートを長めに重ねると、3音目で一番古い音が切れて、同じような響きになります。

## パン

アルペジオと、NOISEのハイハット（OPHI・POKES）は、`O01`と`O02`で1音ずつ左右に振っています。GAMEBOYのパンは、左・右・両方の3つです。

- DAW：ノート単位でパンを設定できるDAWなら、そのままできます。
- Serum 2：LFOをステップの形にして、1/8に同期させてPanにかけます。

曲の最後は、いつもどおり`HFF`で止めています。

Serum 2の数値は目安です。
{{< /lang >}}

{{< lang en >}}
I covered syrup16g's "Instant Color" in LSDj. The GAMEBOY has four channels, PU1, PU2, WAV and NOISE, and each one plays only one note at a time. Fitting a band song into that took a lot of tricks, so here they are, together with the actual settings I used. For each one I've also added how to do the same thing in a DAW piano roll or in Serum 2.

I don't explain the LSDj screens or commands here. I've written a version on [note](https://note.com/tobokegao/n/n046641cf7e0c) for people who have never used LSDj.

## Tempo and grooves

The tempo is 252, and one beat is split into 48 ticks. If the four steps of a beat add up to 48 ticks in the groove, the song actually runs at 126 BPM. One tick is about 9.9 ms.

- Groove 00 `14/14/10/10`: the vocal sections. A light shuffle, with the off-beat 8th on tick 28 of 48
- Groove 01 `16/16/8/8`: the guitar-riff sections. Steps 1 to 3 land on 8th-note triplets
- Groove 02 `5/23/5/15`: WAV in the vocal sections
- Groove 03 `5/27/5/11`: WAV in the riff sections

Grooves 02 and 03 put their 8ths in the same places as 00 and 01, with one more step on tick 5 in between. That is where the bass goes (see the next section). A `G` on every channel at the first bar of each section switches the groove.

- DAW: use a different swing per clip. About 58% 8th-note swing for the vocal sections, about 67% (triplets) for the riffs.

## Kick and bass taking turns on WAV

On WAV, the kick and snare take turns with the bass on a single channel. On a kick or snare hit, the instrument switches to WKICK or WSNR, and 5 ticks later (the second step of groove 02 or 03) the bass instrument (SLAP) strikes again. Since the channel is monophonic, the bass always drops out at the kick, which works just like sidechain compression.

WKICK's table drops the pitch fast, with a transpose of `03` and pitch bends of `PB8` then `PD0`, and cuts at row 6 with `K00`. WSNR also bends down with `PD0` then `PD8`.

On top of that, the WAV kick and snare are layered with the NOISE kick (NKICK) and snare (SNR01) at the same positions. WAV gives the low body, NOISE gives the attack. NKICK's table steps its transpose down `BF`, `B5`, `75`, `27`, so the noise pitch falls.

- DAW: delay the start of the bass by about 50 ms only where the kick hits, or cut the bass there and strike it again right after. For the drums, program a body track and an attack track at the same positions.
- Serum 2: one patch can do both. Turn on Mono with Legato off so every note retriggers, and send a short Env2 to pitch by +24 to 36 semitones; only the moment of the hit turns into a kick. For the waveform switch, send Env2 to Wavetable Position too. For the NOISE layer, add the Noise oscillator with a short envelope.

## Chord arpeggios

Chords are played using three-note tables that cycle every 4 ticks. Tables 0C (major), 0D (minor) and 0E (sus) hold each transpose for four rows (`00`, `04`, `07` / `00`, `03`, `07` / `00`, `05`, `07`), and `H00` on row 12 jumps back to the top.

Even M7 and m7 chords drop the 7th and cycle as triads, so the tones don't clash. The voicing stays within one octave below the vocal melody.

For the strumming after the intro, other tables (15 to 17) also switch the pan, `O01`, `O02`, `O01`, with each chord tone. Within one chord, each tone goes to a different side.

Dynamics come from `E` next to the notes.

- Verse strums: `E63` on the downbeat, `E95` on the off-beats
- Chorus 8th-note strums: `EA5` on the beats, `E74` in between
- Hits before the chorus: `E53`, `E73`, `E93`, `EB3`, `ED3`, getting louder

In the gaps of the bridge, a chord swells up from zero with `E0D` and is cut by `K00` six steps later. The stop at the end of the second chorus hits on step 12 on every channel and goes silent with `K00` on step 14.

- DAW: when you write chords, dropping the 7th and keeping them under the vocal keeps them clean. Use velocity for dynamics.
- Serum 2: use the Arp. Rate around 1/48 (near 1/32 triplets), pattern Up or Order, a long gate. For more of a chip feel, Mono with no glide. In the matrix, send Velocity to Env1 Level and a little to Env1 Decay too, so harder notes ring longer.

## Harmony on one channel

The vocal melody on PU1 uses harmony instruments (HRM+7, HRM+8, HRM+9). Each is the melody instrument with a table, and the table switches between the melody note and the harmony note.

The table runs on `G1D` (2 ticks per row): a few rows of the melody note, then two rows (4 ticks) of the harmony. Only the harmony rows have `O01` and `O02` in turn, so the melody stays in the center and the harmony moves left and right. `H06` on the last row loops back to the middle.

The number in each name is the interval above the melody. The record's backing vocals sit below the melody, though, so they actually sound an octave lower (`FB` for +7, `FC` for +8, `FD` for +9).

Where the record has a backing vocal, I used its interval as is. Everywhere else, I picked a 3rd or a 6th per phrase, whichever lands on more chord tones, and swapped single notes to the other one when they clashed. Because each interval has its own instrument, the command column stays free for `D`.

- DAW: the same way of choosing works when you write harmony as separate notes.
- Serum 2: for chip-style alternating harmony, put just two notes into the Arp.

## Placing the vocal melody

The vocal is placed tick by tick, delayed from the step with things like `D04` and `D0A`. Notes sung within three semitones of each other glide with `L04` instead of restriking, and some of the long held notes get `V01` three steps in. Phrase ends are cut with the tick specified, like `K04` or `K05`.

- DAW: turn snap off or use a fine grid, and move notes to match the sung timing.
- Serum 2: Portamento in Legato mode glides only between overlapping notes. For vibrato, send an LFO with a Delay of about 3/16 of a beat to Osc Fine.

## Programmed delay

The delay isn't an effect. It's programmed. There are two ways.

The first uses one channel. On the same channel, after the original note, strike the same note again with a quieter instrument, and repeat.

The second copies the PU1 vocal onto PU2. There are three echo instruments, center (ECHOL) and the two sides (ECHLL, ECHOR), which differ only in pan. Their envelope is `66`, quieter than the melody's `E7`.

- Bridge: echoes 24 ticks (an 8th) after PU1, alternating left and right
- Around 3:22: two echoes, one an 8th later and one a beat later (quieter still, with `E45`)
- Second verse: a copy of the vocal one step later, panned left and right note by note with `O01` and `O02`. The backing comes back swelling with `E1B` from two steps before it enters

In every case, `K00` stops the echo one step before the next vocal line.

The echo instruments use table 1D with `F05`, so they sound slightly (about +13 cents) higher than the original. `H01` parks the table on row 2, so they stay detuned. When the echo overlaps the original, it wobbles a little and spreads out like a chorus.

- DAW: for the first way, add the same note at a lower velocity on the same track. For the second, copy the vocal MIDI to another track, delay it, lower the velocity and pan it left and right. Delete the parts that overlap the next phrase by hand.
- Serum 2: for the first way, Mono cuts the echo the moment the next note comes, the way LSDj does. For the second, lower the Filter a bit on the copied track and detune Osc Fine by about +10 to 15 cents. Either way, compared to a normal delay with ducking, the echo stays clear in the rests only.

## Guitar sound

The guitar instrument (GTR) plays `W02` (50% duty) on the first table row only and goes right back to `W01` (25%), so the sound is fatter for just the first tick of the pick attack. It's also detuned a little with `F03`.

The octave-jumping guitar (GTROC) uses the same kind of table, with a transpose of `0C` on every other four rows and an `H04` loop, so it moves up an octave and back every 4 ticks.

In the intro and the final arpeggio, the notes alternate between PU1 and PU2 (GTR-L, GTR-R), so each note keeps ringing under the next.

- Serum 2: set Poly to 2 voices and overlap the notes a bit; the third note cuts the oldest one, for a similar sound.

## Pan

The arpeggios and the NOISE hi-hats (OPHI, POKES) go left and right note by note with `O01` and `O02`. The GAMEBOY's pan has three settings: left, right and both.

- DAW: if your DAW has per-note pan, use that.
- Serum 2: make an LFO with a stepped shape, sync it to 1/8 and send it to Pan.

As usual, the song ends with `HFF`.

The Serum 2 numbers are rough guides.
{{< /lang >}}

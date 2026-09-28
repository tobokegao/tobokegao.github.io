// 1 場面 1 本の短い動画。素材は capture.mjs が撮った public/clips/<id>/take.mp4（画面ぜんぶ、30 コマ/秒、倍率 2）と
// events.json（カメラ・カーソル・押した印）。TRACKMENTO の promo/src/XClip.tsx から取り出したもの（2026-09-29）。
//
// ここでするのは画面の外側の演出だけ（画面そのものは本物の録画）:
// - カメラ … 印の四角に寄る（2 倍まで。録画の外は映さない）。移るときは加速・減速する
// - カーソル … 印の点から点へなめらかに運ぶ（白黒の矢印）。スマホの場面は指の丸
// - 押した合図 … 押した所に輪が 1 回広がる
// - 押したキー … 画面の下にキーの絵で出す（キーボードの操作は画面に跡が残らず、ひとりでに動いたように見えるため）
// - 終わり … 最後の絵に最初の絵を溶かし込んで、繰り返し再生のつなぎ目を消す
import React from "react";
import { AbsoluteFill, CalculateMetadataFunction, Easing, Freeze, OffthreadVideo, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

// 字はパソコンに入っているものを使う。決まった書体にしたいときは @remotion/fonts の loadFont で public/fonts/ から読む
const SANS = `"Noto Sans JP", "Yu Gothic UI", "Meiryo", "Hiragino Sans", sans-serif`;
const MONO = `"Consolas", "Menlo", monospace`;

type Rect = { x: number; y: number; w: number; h: number };
type Ev =
  | { f: number; type: "cam"; rect: Rect; dur: number }
  | { f: number; type: "cursor"; x: number; y: number; dur: number }
  | { f: number; type: "down"; x: number; y: number; ring?: boolean }
  | { f: number; type: "hide" }
  | { f: number; type: "key"; key: string }
  | { f: number; type: "touches"; pts: { x: number; y: number }[] };   // 2 本指（kit の pinch）。空の配列で指を離す
export type Take = { id: string; fps: number; frames: number; vw: number; vh: number; dpr: number; events: Ev[] };
type Titles = { brand?: string; windowLabel?: string; titles?: Record<string, string> };
export type ClipProps = { id: string; take?: Take; title?: string; brand?: string; windowLabel?: string };

const LOOP = 15;      // 終わりに最初の絵を溶かし込むコマ数（0.5 秒）
const MAX_ZOOM = 2;   // 録画は倍率 2 なので、2 倍まではぼやけない
const PAD = 28;       // 寄る四角のまわりに残す余白（画面の CSS px）
const ease = Easing.bezier(0.45, 0, 0.2, 1);
const COLOR = { ink: "#1b1d24", desk: "#e9e8e3", ring: "#e5462c" };

/** 印の四角を、映す箱と同じ縦横比 A の「映す範囲」にする */
function fit(r: Rect, vw: number, vh: number, A = vw / vh): Rect {
  let w = r.w + PAD * 2, h = r.h + PAD * 2;
  if (w / h < A) w = h * A; else h = w / A;
  if (w < vw / MAX_ZOOM) { w = vw / MAX_ZOOM; h = w / A; }
  const maxW = Math.min(vw, vh * A);   // 録画の外は映さない
  if (w > maxW) { w = maxW; h = w / A; }
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  return { x: Math.min(Math.max(cx - w / 2, 0), vw - w), y: Math.min(Math.max(cy - h / 2, 0), vh - h), w, h };
}
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** 縦の動画の「映す範囲」。箱（正方形）に横長の四角を丸ごと入れると字が読めないので、横は KEEP の割合まで削って寄り、
 *  削った分はカーソルを追って動かす（rx0〜rx1 がカメラの左端の動ける範囲）。寄るのは録画の倍率で字がぼやけない所（minW）まで */
type CamR = Rect & { rx0: number; rx1: number };
const KEEP = 0.75;
function fitFollow(r: Rect, vw: number, vh: number, A: number, minW: number): CamR {
  const w0 = r.w + PAD * 2, h0 = r.h + PAD * 2;
  let h = Math.max(h0, (w0 * KEEP) / A), w = h * A;
  if (w < minW) { w = minW; h = w / A; }
  const maxW = Math.min(vw, vh * A);
  if (w > maxW) { w = maxW; h = w / A; }
  const clampX = (x: number) => Math.min(Math.max(x, 0), vw - w);
  const y = Math.min(Math.max(r.y + r.h / 2 - h / 2, 0), vh - h);
  if (w >= w0) { const x = clampX(r.x + r.w / 2 - w / 2); return { x, y, w, h, rx0: x, rx1: x }; }
  const rx0 = clampX(r.x - PAD), rx1 = clampX(r.x + r.w + PAD - w);
  return { x: (rx0 + rx1) / 2, y, w, h, rx0, rx1 };
}

/** 「from から to へ dur コマで移る」を印の順に重ねて、f コマ目の値を出す（移る途中で次の印が来たら、その時点の値から移り直す） */
function track<T>(marks: { f: number; to: T; dur: number }[], f: number, lerp: (a: T, b: T, t: number) => T): T {
  let seg = { from: marks[0].to, to: marks[0].to, f0: 0, dur: 0 };
  const at = (s: typeof seg, x: number) => s.dur <= 0 ? s.to : lerp(s.from, s.to, ease(Math.min(1, Math.max(0, (x - s.f0) / s.dur))));
  for (const m of marks.slice(1)) {
    if (m.f > f) break;
    seg = { from: at(seg, m.f), to: m.to, f0: m.f, dur: m.dur };
  }
  return at(seg, f);
}

const Arrow: React.FC<{ size: number; tilt: boolean }> = ({ size, tilt }) => (
  <svg width={22 * size} height={30 * size} viewBox="0 0 22 30"
       style={{ position: "absolute", left: -2 * size, top: -1 * size, transformOrigin: `${2 * size}px ${1 * size}px`,
                transform: tilt ? "rotate(-12deg)" : undefined, filter: `drop-shadow(${size}px ${2 * size}px 0 rgba(0,0,0,.35))` }}>
    <path d="M2 1 L2 22 L7.5 17 L11 25.5 L15 24 L11.5 15.5 L19 15 Z" fill="#fff" stroke="#111" strokeWidth={2} strokeLinejoin="round" />
  </svg>
);

/** Playwright のキーの名前 → キーの絵に書く字 */
const KEY_LABEL: Record<string, string> = { Control: "Ctrl", Alt: "Alt", Shift: "Shift", Meta: "⌘", ArrowRight: "→", ArrowLeft: "←", ArrowUp: "↑", ArrowDown: "↓", Enter: "Enter", Escape: "Esc", Tab: "Tab" };
const KEY_SHOW = 20;   // キーの絵を出しておくコマ数

/** 押したキーの絵（画面の下の真ん中）。次のキーが来たら入れ替わる。押した直後の数コマは沈んで見せる */
const Keys: React.FC<{ events: Ev[]; f: number; unit: number }> = ({ events, f, unit }) => {
  const e = [...events].reverse().find((x): x is Extract<Ev, { type: "key" }> => x.type === "key" && x.f <= f);
  if (!e || f >= e.f + KEY_SHOW) return null;
  const age = f - e.f, down = age < 4;
  const opacity = interpolate(age, [KEY_SHOW - 5, KEY_SHOW], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const u = unit, sh = down ? 1 : 4;
  return (
    // 白い台に載せる（画面の上にじかに置くと、後ろの字と重なって読めない）
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 32 * u, display: "flex", justifyContent: "center", opacity }}>
      <div style={{ display: "flex", gap: 12 * u, alignItems: "center", background: "#fff", border: `${2 * u}px solid #111`,
                    boxShadow: `${5 * u}px ${5 * u}px 0 #111`, padding: `${12 * u}px ${16 * u}px` }}>
        {e.key.split("+").map((k, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span style={{ fontFamily: MONO, fontSize: 40 * u, color: "#111" }}>+</span>}
            <span style={{ fontFamily: MONO, fontSize: 40 * u, lineHeight: 1, color: "#111", background: "#e4e4e4", border: `${2 * u}px solid #111`,
                           padding: `${10 * u}px ${18 * u}px`, minWidth: 72 * u, textAlign: "center",
                           boxShadow: `${sh * u}px ${sh * u}px 0 #111`, transform: `translate(${(4 - sh) * u}px, ${(4 - sh) * u}px)` }}>
              {KEY_LABEL[k] ?? k.toUpperCase()}
            </span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

/** 指の印（スマホの場面。矢印の代わりに半透明の丸。押している間は濃く・小さく） */
const Finger: React.FC<{ r: number; pressing: boolean }> = ({ r, pressing }) => {
  const rr = pressing ? r * 0.85 : r;
  return <div style={{ position: "absolute", left: -rr, top: -rr, width: rr * 2, height: rr * 2, borderRadius: "50%",
                       background: pressing ? "rgba(20,20,20,.45)" : "rgba(20,20,20,.25)", border: "2px solid rgba(255,255,255,.85)", boxSizing: "border-box" }} />;
};

/** スマホの枠（角の丸い黒） */
const Phone: React.FC<{ x: number; y: number; W: number; H: number; bez: number; children: React.ReactNode }> = ({ x, y, W, H, bez, children }) => (
  <>
    <div style={{ position: "absolute", left: x - bez, top: y - bez * 2, width: W + bez * 2, height: H + bez * 4, background: "#16181b",
                  borderRadius: bez * 3.2, boxShadow: `${bez}px ${bez}px 0 rgba(0,0,0,.18)` }} />
    <div style={{ position: "absolute", left: x, top: y, width: W, height: H, overflow: "hidden", borderRadius: bez * 1.2, background: "#fff" }}>{children}</div>
  </>
);

/** 1 コマぶんの絵。横 16:9 はそのまま、スマホの録画（縦長）は真ん中にスマホの枠を置いてその中に映す */
const Scene: React.FC<{ id: string; take: Take; title?: string; brand?: string; windowLabel?: string }> = (p) => {
  const { id, take } = p;
  const { width, height } = useVideoConfig();
  const f = useCurrentFrame();
  if (height > width) return <TallScene {...p} />;
  if (take.vh <= take.vw) {
    return (
      <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>
        <View id={id} take={take} w={width} h={height} touch={false} />
        <Keys events={take.events} f={f} unit={width / 1280} />
      </AbsoluteFill>
    );
  }
  const H = Math.round(height * 0.88), W = Math.round(H * take.vw / take.vh), bez = Math.round(H * 0.022);
  return (
    <AbsoluteFill style={{ backgroundColor: COLOR.desk }}>
      <Phone x={Math.round((width - W) / 2)} y={Math.round((height - H) / 2)} W={W} H={H} bez={bez}>
        <View id={id} take={take} w={W} h={H} touch />
      </Phone>
    </AbsoluteFill>
  );
};

/** 縦 9:16（リール・ショート向け）。上に名前と見出し、真ん中に窓で録画。
 *  PC の録画は 16:9 のまま縦に置くと字が読めないので、窓の中身を正方形にして印の四角に寄る。スマホの録画は枠ごと大きく置く。
 *  下の 2 割と右端はアプリの字幕・ボタンが重なるので、大事なものを置かない */
const TallScene: React.FC<{ id: string; take: Take; title?: string; brand?: string; windowLabel?: string }> = ({ id, take, title, brand, windowLabel }) => {
  const { width } = useVideoConfig();
  const f = useCurrentFrame();
  const head = (
    <div style={{ position: "absolute", left: 80, right: 80, top: 250 }}>
      {brand && <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 34, letterSpacing: "0.06em", color: COLOR.ink, lineHeight: 1 }}>{brand}</div>}
      {title && <div lang="ja" style={{ wordBreak: "auto-phrase" as React.CSSProperties["wordBreak"], marginTop: 28, fontFamily: SANS, fontWeight: 700, fontSize: 62, lineHeight: 1.36, color: COLOR.ink }}>{title}</div>}
    </div>
  );
  if (take.vh > take.vw) {
    const H = 1100, W = Math.round(H * take.vw / take.vh);
    return (
      <AbsoluteFill style={{ backgroundColor: COLOR.desk }}>
        {head}
        <Phone x={Math.round((width - W) / 2)} y={610} W={W} H={H} bez={22}>
          <View id={id} take={take} w={W} h={H} touch />
        </Phone>
      </AbsoluteFill>
    );
  }
  // 窓の中身は正方形。横長の場面は fitFollow で寄ってカーソルを追う
  const S = 920, bar = 44, x = (width - S) / 2, y = 600;
  return (
    <AbsoluteFill style={{ backgroundColor: COLOR.desk }}>
      {head}
      <div style={{ position: "absolute", left: x - 4, top: y - 4, width: S + 8, height: bar + S + 8, background: COLOR.ink, boxShadow: `12px 12px 0 ${COLOR.ink}` }} />
      <div style={{ position: "absolute", left: x, top: y, width: S, height: bar, background: "#dcdcdc", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {windowLabel && <span style={{ fontFamily: MONO, fontSize: 24, color: COLOR.ink, lineHeight: 1 }}>{windowLabel}</span>}
      </div>
      <div style={{ position: "absolute", left: x, top: y + bar, width: S, height: S, overflow: "hidden", background: "#fff" }}>
        <View id={id} take={take} w={S} h={S} touch={false} follow />
        <Keys events={take.events} f={f} unit={S / 1280 * 1.15} />
      </div>
    </AbsoluteFill>
  );
};

/** 録画＋カメラ＋カーソル（指）＋輪を w×h の箱に描く */
const View: React.FC<{ id: string; take: Take; w: number; h: number; touch: boolean; follow?: boolean }> = ({ id, take, w: width, h: height, touch, follow = false }) => {
  const f = useCurrentFrame();
  const { vw, vh, events } = take;
  const k = width / vw;   // 出力の px ÷ 画面の CSS px（引いたとき）
  const A = width / height;

  const curs = events.filter((e): e is Extract<Ev, { type: "cursor" }> => e.type === "cursor").map((e) => ({ f: e.f, to: { x: e.x, y: e.y }, dur: e.dur }));
  const camEvs = events.filter((e): e is Extract<Ev, { type: "cam" }> => e.type === "cam");
  const lerpCam = (a: CamR, b: CamR, t: number): CamR => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t), w: mix(a.w, b.w, t), h: mix(a.h, b.h, t), rx0: mix(a.rx0, b.rx0, t), rx1: mix(a.rx1, b.rx1, t) });
  const place = (r: Rect): CamR => follow ? fitFollow(r, vw, vh, A, width / take.dpr) : { ...fit(r, vw, vh, A), rx0: NaN, rx1: NaN };
  const cams = camEvs.map((e) => ({ f: e.f, to: place(e.rect), dur: e.dur }));
  const cam = cams.length ? track(cams, f, lerpCam) : place({ x: 0, y: 0, w: vw, h: vh });
  const lerpPt = (a: { x: number; y: number }, b: { x: number; y: number }, t: number) => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t) });
  if (follow && cam.rx1 > cam.rx0 && curs.length) {
    // 横はカーソルを追う（前後 0.5 秒の平均。少し先を見て動き出すので、押す前に押す所が映る）
    let sx = 0, n = 0;
    for (let d = -15; d <= 15; d += 3) { sx += track(curs, Math.max(0, f + d), lerpPt).x; n++; }
    cam.x = Math.min(Math.max(sx / n - cam.w / 2, cam.rx0), cam.rx1);
  }
  const s = (vw / cam.w) * k;   // 画面の CSS px → 出力の px
  const toScreen = (x: number, y: number) => ({ x: (x - cam.x) * s, y: (y - cam.y) * s });

  const lastVis = [...events].reverse().find((e) => e.f <= f && (e.type === "cursor" || e.type === "hide"));
  const showCursor = curs.length > 0 && lastVis?.type === "cursor";
  const cp = showCursor ? track(curs, f, lerpPt) : null;
  const downs = events.filter((e): e is Extract<Ev, { type: "down" }> => e.type === "down");
  const pressing = downs.some((d) => f >= d.f && f < d.f + 6);
  // 矢印の大きさは寄った倍率に合わせる（引いたときでも小さくなりすぎないよう下限あり）
  const size = Math.max(1.3, s * 0.9);

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <OffthreadVideo src={staticFile(`clips/${id}/take.mp4`)} muted
        style={{ position: "absolute", left: 0, top: 0, width: vw * k, height: vh * k, transformOrigin: "0 0",
                 transform: `translate(${-cam.x * s}px, ${-cam.y * s}px) scale(${vw / cam.w})` }} />
      {downs.filter((d) => d.ring !== false && f >= d.f && f < d.f + 14).map((d, i) => {
        const p = toScreen(d.x, d.y), age = (f - d.f) / 14;
        const r = interpolate(age, [0, 1], [6, 30]) * Math.max(1, s * 0.8);
        return <div key={i} style={{ position: "absolute", left: p.x - r, top: p.y - r, width: r * 2, height: r * 2, borderRadius: "50%",
                                     border: `${3 * Math.max(1, s * 0.7)}px solid ${COLOR.ring}`, opacity: 1 - age, boxSizing: "border-box" }} />;
      })}
      {(() => {
        // 2 本指（pinch）。いちばん新しい印の位置に指の丸を置き、指を置いたときに赤い輪を広げる
        const tv = events.filter((e): e is Extract<Ev, { type: "touches" }> => e.type === "touches" && e.f <= f);
        const t = tv[tv.length - 1];
        if (!t?.pts.length) return null;
        let i0 = tv.length - 1;
        while (i0 > 0 && tv[i0 - 1].pts.length) i0--;
        const start = tv[i0], age = (f - start.f) / 14;
        const R = 24 * s, bw = 3 * Math.max(1, s * 0.7);
        return <>
          {t.pts.map((q, i) => { const p = toScreen(q.x, q.y);
            return <div key={`t${i}`} style={{ position: "absolute", left: p.x - R, top: p.y - R, width: R * 2, height: R * 2, borderRadius: "50%",
                                              background: "rgba(20,20,20,.6)", border: `${bw}px solid #fff`, boxShadow: "0 0 0 2px rgba(20,20,20,.7)", boxSizing: "border-box" }} />; })}
          {age < 1 && start.pts.map((q, i) => { const p = toScreen(q.x, q.y), r = interpolate(age, [0, 1], [R, R * 2.2]);
            return <div key={`ring${i}`} style={{ position: "absolute", left: p.x - r, top: p.y - r, width: r * 2, height: r * 2, borderRadius: "50%",
                                                 border: `${bw}px solid ${COLOR.ring}`, opacity: 1 - age, boxSizing: "border-box" }} />; })}
        </>;
      })()}
      {cp && (() => { const p = toScreen(cp.x, cp.y); return <div style={{ position: "absolute", left: p.x, top: p.y }}>
        {touch ? <Finger r={18 * s} pressing={pressing} /> : <Arrow size={size} tilt={pressing} />}</div>; })()}
    </AbsoluteFill>
  );
};

export const Clip: React.FC<ClipProps> = (props) => {
  const f = useCurrentFrame();
  const { take } = props;
  if (!take) return null;
  const N = take.frames;
  const scene = <Scene id={props.id} take={take} title={props.title} brand={props.brand} windowLabel={props.windowLabel} />;
  const fade = interpolate(f, [N, N + LOOP], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  return (
    <AbsoluteFill>
      <Freeze frame={N - 1} active={f >= N}>{scene}</Freeze>
      {f >= N && <AbsoluteFill style={{ opacity: fade }}><Freeze frame={0}>{scene}</Freeze></AbsoluteFill>}
    </AbsoluteFill>
  );
};

/** 長さは素材のコマ数＋つなぎ。events.json と titles.json を読んで props に入れる（描くたびに読み直さないように） */
export const clipMetadata: CalculateMetadataFunction<ClipProps> = async ({ props }) => {
  const take: Take = await (await fetch(staticFile(`clips/${props.id}/events.json`))).json();
  const t: Titles = await fetch(staticFile("titles.json")).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  return {
    durationInFrames: take.frames + LOOP, fps: take.fps,
    props: { ...props, take, title: props.title ?? t.titles?.[props.id], brand: props.brand ?? t.brand, windowLabel: props.windowLabel ?? t.windowLabel },
  };
};

// サイトの動きを 1 コマずつ撮る道具箱。`capture.mjs` が使う（TRACKMENTO の promo/clip_kit.mjs から取り出したもの、2026-09-29）。
//
// 撮り方:
// - **ページの時計を止め**（Playwright の clock）、1/30 秒ずつ進めては画面ぜんぶを 1 枚撮る。CSS のアニメーションも同じ時刻に合わせる。
//   実時間で録画しないので、コマ落ちが無く、撮り直しても同じ絵になる
// - **カーソル・押した合図・カメラの行き先は描かずに、印（events.json）だけ残す**。描くのは Remotion（src/Clip.tsx）
// - 撮ったコマは take.mp4 にまとめ、public/clips/<id>/ に置く（Remotion が staticFile で読む）
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const FPS = 30;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const START_TIME = new Date("2026-01-01T12:00:00+09:00");   // 止めた時計の時刻（ページに日付が出るなら変える）
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** ffmpeg の場所。Remotion が入れた ffmpeg を使う（FFMPEG で差し替えられる） */
function ffmpegPath() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  const base = path.join(HERE, "node_modules/@remotion");
  const dir = fs.existsSync(base) ? fs.readdirSync(base).find((d) => d.startsWith("compositor-")) : null;
  if (dir) for (const name of ["ffmpeg.exe", "ffmpeg"]) { const p = path.join(base, dir, name); if (fs.existsSync(p)) return p; }
  return "ffmpeg";
}

/** 読み込みが落ち着くまで待つ（時計は止めてあるので、進めながら待つ）。ready はページの中で真になる条件（関数）。 */
export async function settle(page, ready = null, timeout = 30000) {
  const t0 = Date.now();
  for (let i = 0; i < 20; i++) { await page.clock.runFor(50); await sleep(30); }
  for (;;) {
    const ok = await page.evaluate(ready ? ready : () => document.readyState === "complete").catch(() => false);
    if (ok) break;
    if (Date.now() - t0 > timeout) throw new Error("ページの読み込みを待ちきれない");
    await page.clock.runFor(50); await sleep(50);
  }
  await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
}

/** 画面を 1 つ開く（時計を止めた状態で）。opts.url を開き、opts.ready まで待つ。opts.css は撮るあいだだけ足す見た目 */
export async function openPage(browser, { url, ready, css, ctx } = {}) {
  const c = await browser.newContext({ locale: "ja-JP", ...ctx });
  const p = await c.newPage();
  await p.clock.install({ time: START_TIME });
  if (url) {
    await p.goto(url, { waitUntil: "domcontentloaded" });
    await settle(p, ready);
  }
  if (css) await p.addStyleTag({ content: css });
  return p;
}

/** ページ 1 枚ぶんの道具。コマの数・印・カーソルの位置はここで持つ */
export function makeKit(page, config = {}) {
  let frames = 0, frameDir = null, events = [];
  let onFrame = null;   // コマごとに撮る直前に呼ぶ（setOnFrame。ページの中の動画をコマ送りするときなど）
  const vp = page.viewportSize();
  const nFrames = (sec) => Math.max(1, Math.round(sec * FPS));
  const ev = (type, extra = {}) => events.push({ f: frames, type, ...extra });
  const easeIO3 = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeIO2 = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  /** 1 コマ進めて撮る。撮影前（frameDir が無い間）は時計だけ進める */
  async function frame() {
    const dt = Math.round((frames + 1) * 1000 / FPS) - Math.round(frames * 1000 / FPS);
    await page.clock.runFor(dt);
    if (!frameDir) return;
    if (onFrame) await onFrame();
    await page.evaluate(() => {
      const now = performance.now();
      for (const a of document.getAnimations()) {
        if (a.__t0 === undefined) a.__t0 = now - (Number(a.currentTime) || 0);
        a.pause(); a.currentTime = now - a.__t0;
      }
    }).catch(() => {});
    frames++;
    fs.writeFileSync(path.join(frameDir, `${String(frames).padStart(5, "0")}.jpg`), await page.screenshot({ type: "jpeg", quality: 92 }));
  }
  /** sec 秒ぶんのコマを撮る */
  async function hold(sec) { for (let i = 0, n = nFrames(sec); i < n; i++) await frame(); }
  /** 撮らずに待つ（時計は進める。タイマー待ちの処理が止まらないように） */
  async function until(fn, label = "", timeout = 60000) {
    const t0 = Date.now();
    for (;;) {
      if (await fn().catch(() => false)) return true;
      if (Date.now() - t0 > timeout) throw new Error(`待ちきれない: ${label}`);
      await page.clock.runFor(50); await sleep(50);
    }
  }
  /** 撮りながら待つ（待つ様子を見せたいとき）。実時間とコマをおおよそ合わせる。min 秒は必ず撮る */
  async function live(fn, { timeout = 30, min = 0 } = {}) {
    const t0 = Date.now();
    for (let i = 0; ; i++) {
      const a = Date.now();
      await frame();
      if (i / FPS >= min && await fn().catch(() => false)) return true;
      if (Date.now() - t0 > timeout * 1000) return false;
      const rest = 1000 / FPS - (Date.now() - a); if (rest > 0) await sleep(rest);
    }
  }

  /** 要素をまとめた四角（画面の座標）。見えていない要素（大きさ 0）は数えない。
      スマホの縮小表示では CSS の座標と画面の座標が違うので、visualViewport の倍率を掛ける */
  const rectOf = (sels) => page.evaluate((sels) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const s of sels) for (const el of document.querySelectorAll(s)) {
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
      x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom);
    }
    const v = window.visualViewport, sc = v ? v.scale : 1, ox = v ? v.offsetLeft : 0, oy = v ? v.offsetTop : 0;
    return x1 > x0 ? { x: (x0 - ox) * sc, y: (y0 - oy) * sc, w: (x1 - x0) * sc, h: (y1 - y0) * sc } : null;
  }, sels);

  /** カメラの行き先を決める（sels の要素をまとめた四角に寄る）。sec 秒かけて移る。撮影前なら最初の構図になる */
  async function look(sels, sec = 0.6) {
    const list = Array.isArray(sels) ? sels : [sels];
    const rect = await rectOf(list);
    if (!rect) throw new Error(`look: ${list.join(", ")} が見えていない`);
    ev("cam", { rect, dur: frameDir ? nFrames(sec) : 0 });
  }
  /** 要素の一部に寄る（fx, fy, fw, fh は要素の幅・高さに対する割合） */
  async function lookPart(sel, fx, fy, fw, fh, sec = 0.6) {
    const r = await rectOf([sel]);
    if (!r) throw new Error(`lookPart: ${sel} が見えていない`);
    ev("cam", { rect: { x: r.x + r.w * fx, y: r.y + r.h * fy, w: r.w * fw, h: r.h * fh }, dur: frameDir ? nFrames(sec) : 0 });
  }
  /** 画面の四角（{x, y, w, h}）に寄る。要素に当たらない構図のとき */
  const lookRect = (rect, sec = 0.6) => ev("cam", { rect, dur: frameDir ? nFrames(sec) : 0 });
  /** カメラを引く（画面ぜんぶ） */
  const wide = (sec = 0.6) => ev("cam", { rect: { x: 0, y: 0, w: vp.width, h: vp.height }, dur: frameDir ? nFrames(sec) : 0 });

  /** カーソルを置く（動かさずにその場へ。撮影前に最初の位置を決めるのに使う） */
  async function park(x, y) { ev("cursor", { x, y, dur: 0 }); await page.mouse.move(x, y); }
  /** カーソルを出さない（キーボードの場面）。ページのマウスも画面の外へ出す（乗せたままだと :hover が残る） */
  async function hideCursor() { ev("hide"); await page.mouse.move(-10, -10); }
  /** 要素の真ん中の座標 */
  async function centerOf(sel) {
    const b = await page.locator(sel).first().boundingBox();
    if (!b) throw new Error(`見えていない: ${sel}`);
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  }
  /** 印に使う座標（画面の座標）。縮小表示のときは倍率を掛ける（rectOf と同じ） */
  async function screenCenterOf(sel) {
    const r = await rectOf([sel]);
    if (!r) throw new Error(`見えていない: ${sel}`);
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  }
  /** カーソルを要素まで運ぶ（動きは Remotion が描く。ページのマウスは着く直前に動かして、:hover を出す） */
  async function glide(sel, sec = 0.45) {
    const to = await centerOf(sel);
    const n = nFrames(sec);
    ev("cursor", { x: to.x, y: to.y, dur: n });
    for (let i = 0; i < n; i++) {
      if (i === n - 2) await page.mouse.move(to.x, to.y);
      await frame();
    }
  }
  /** 運んで押す。押した瞬間が印の時刻（Remotion が輪を描く）。押したあとに要素がずれたら矢印もついて行く */
  async function press(sel, { sec = 0.45, follow = true } = {}) {
    await glide(sel, sec);
    await hold(0.12);
    const { x, y } = await centerOf(sel);
    ev("down", { x, y });
    await page.mouse.down(); await frame();
    await page.mouse.up(); await frame();
    if (!follow) return;
    const el = page.locator(sel).first();
    const b = (await el.count().catch(() => 0)) && await el.boundingBox().catch(() => null);
    if (b) {
      const to = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
      if (Math.hypot(to.x - x, to.y - y) > 2) { ev("cursor", { ...to, dur: nFrames(0.15) }); await page.mouse.move(to.x, to.y); }
    }
  }
  /** 押してページが移るのを待つ（リンクを押す場面）。待つあいだは撮らない。移った後の読み込みは config.ready で判断 */
  async function pressNav(sel, opts = {}) {
    const nav = page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => null);
    await press(sel, { ...opts, follow: false });   // 移った先のページで同じセレクタが別の要素に当たるので、矢印は追わせない
    await until(async () => { await nav; return true; }, "ページ移動");
    await settle(page, config.ready);
    if (config.css) await page.addStyleTag({ content: config.css });
  }
  /** 撮りながらページを移る（リンクを押さずに URL で。場面の途中で別ページを見せるとき） */
  async function goto(url) {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await settle(page, config.ready);
    if (config.css) await page.addStyleTag({ content: config.css });
  }
  /** 指で押す（スマホの場面。印は press と同じなので、Clip は指の丸と輪を描く） */
  async function tap(sel, { sec = 0.4 } = {}) {
    const s = await screenCenterOf(sel);
    ev("cursor", { x: s.x, y: s.y, dur: nFrames(sec) }); await hold(sec);
    await hold(0.1);
    ev("down", { x: s.x, y: s.y });
    // 縮小表示のページでは Playwright の tap が「画面の外」と判断して押せないことがあるので、そのときはページの中から押す
    await page.locator(sel).first().tap({ timeout: 2000 }).catch(() => page.$eval(sel, (el) => el.click()));
    await frame(); await frame();
  }
  /** 指で座標を押す（要素の真ん中でない所を押すとき） */
  async function tapAt(x, y, sec = 0.4) {
    ev("cursor", { x, y, dur: nFrames(sec) }); await hold(sec);
    ev("down", { x, y });
    await page.touchscreen.tap(x, y); await frame(); await frame();
  }
  /** 画面を送る（撮りながら。出だしと終わりをゆるめる）。y1 は行き先の scrollY、sel を渡すとその要素の中を送る */
  async function scrollEase(y1, sec = 1.2, sel = null) {
    const y0 = await page.evaluate((sel) => (sel ? document.querySelector(sel).scrollTop : window.scrollY), sel);
    const n = nFrames(sec);
    for (let i = 1; i <= n; i++) {
      const y = y0 + (y1 - y0) * easeIO3(i / n);
      await page.evaluate(({ y, sel }) => (sel ? document.querySelector(sel) : window).scrollTo(0, y), { y, sel });
      await frame();
    }
  }
  /** 要素を画面の縦の位置 top に置くときの scrollY（scrollEase に渡す） */
  const yFor = (sel, top = 80) => page.evaluate(({ sel, top }) =>
    window.scrollY + document.querySelector(sel).getBoundingClientRect().top - top, { sel, top });
  /** 要素を画面の縦の位置 y へ送る（撮る前に。撮りながら送るとカメラと二重に動く） */
  const scrollTo = (sel, y = 80) => page.evaluate(({ sel, y }) => {
    window.scrollBy(0, document.querySelector(sel).getBoundingClientRect().top - y);
  }, { sel, y });
  /** 画面を指で送る（スマホの場面。dy だけ等速で送る） */
  async function swipe(dy, sec = 0.6, sel = null) {
    const n = nFrames(sec);
    for (let i = 0; i < n; i++) {
      await page.evaluate(({ d, sel }) => (sel ? document.querySelector(sel) : window).scrollBy(0, d), { d: dy / n, sel });
      await frame();
    }
  }
  /** 2 本指で広げる・すぼめる（スマホの場面）。CDP で指 2 本の touch を送り、指の位置をコマごとに印（touches）に残す。
      cx, cy は 2 本の真ん中、d0 → d1 は指の間の距離、dir は指を並べる向き（[1, 0] で横、[1, 1] で斜め） */
  async function pinch(cx, cy, d0, d1, sec = 0.9, dir = [1, 0]) {
    const L = Math.hypot(dir[0], dir[1]) || 1, ux = dir[0] / L, uy = dir[1] / L;
    const pts = (d) => [{ x: cx - ux * d / 2, y: cy - uy * d / 2 }, { x: cx + ux * d / 2, y: cy + uy * d / 2 }];
    const cdp = await page.context().newCDPSession(page);
    ev("hide"); await page.mouse.move(-10, -10);
    ev("touches", { pts: pts(d0) }); await hold(0.25);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pts(d0).map((p, id) => ({ ...p, id })) });
    await frame();
    const n = nFrames(sec);
    for (let i = 1; i <= n; i++) {
      const d = d0 + (d1 - d0) * easeIO2(i / n);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pts(d).map((p, id) => ({ ...p, id })) });
      ev("touches", { pts: pts(d) });
      await frame();
    }
    await hold(0.15);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    ev("touches", { pts: [] });
    await frame();
    await cdp.detach().catch(() => {});
  }
  /** キーを押す（押した印も残す。Remotion が画面の下にキーの絵を出す）。"Control+Z" のように + でつなげる */
  async function key(k) { ev("key", { key: k }); await page.keyboard.press(k); await frame(); }
  /** 1 字ずつ打つ */
  async function type(sel, text, perChar = 0.06) {
    await page.locator(sel).first().click();
    for (const ch of text) { await page.keyboard.insertText(ch); await hold(perChar); }
  }
  /** 掴んで運ぶ。from は掴む要素、to は運ぶ先の要素か {dx, dy}。grab は掴む位置（要素の幅・高さに対する割合 [fx, fy]） */
  async function drag(from, to, sec = 0.8, grab = null) {
    const a = grab ? await (async () => { const b = await page.locator(from).first().boundingBox(); return { x: b.x + b.width * grab[0], y: b.y + b.height * grab[1] }; })() : await centerOf(from);
    const b = typeof to === "string" ? await centerOf(to) : { x: a.x + to.dx, y: a.y + to.dy };
    ev("cursor", { x: a.x, y: a.y, dur: nFrames(0.35) }); await hold(0.35);
    await page.mouse.move(a.x, a.y);
    ev("down", { x: a.x, y: a.y, ring: false });
    await page.mouse.down(); await frame();
    const n = nFrames(sec);
    for (let i = 1; i <= n; i++) {
      const e = easeIO2(i / n);
      const x = a.x + (b.x - a.x) * e, y = a.y + (b.y - a.y) * e;
      ev("cursor", { x, y, dur: 1 });
      await page.mouse.move(x, y); await frame();
    }
    await page.mouse.up(); await frame();
  }
  /** スライダー（input[type=range]）のつまみを掴んで動かす。thumb はつまみの幅（px。サイトの CSS に合わせる） */
  async function dragThumb(sel, dx, sec = 0.5, thumb = 16) {
    const c = await page.evaluate(({ sel, T }) => {
      const el = document.querySelector(sel), r = el.getBoundingClientRect();
      const min = +el.min || 0, max = +el.max || 100, t = max > min ? (+el.value - min) / (max - min) : 0;
      return { x: r.left + T / 2 + t * (r.width - T), y: r.top + r.height / 2 };
    }, { sel, T: thumb });
    ev("cursor", { x: c.x, y: c.y, dur: nFrames(0.3) }); await hold(0.3);
    ev("down", { x: c.x, y: c.y, ring: false });
    await page.mouse.move(c.x, c.y); await page.mouse.down();
    const n = nFrames(sec);
    for (let i = 1; i <= n; i++) {
      const x = c.x + dx * easeIO3(i / n);   // 等速だと機械っぽいので、ゆっくり動き出して止まる前に減速する
      ev("cursor", { x, y: c.y, dur: 1 });
      await page.mouse.move(x, c.y); await frame();
    }
    await page.mouse.up();
  }
  /** Ctrl＋ホイール（トラックパッドの 2 本指と同じ）。Playwright の mouse.wheel は Ctrl を押していても ctrlKey が付かないので、ページの中で送る */
  const ctrlWheel = (x, y, dy) => page.evaluate(({ x, y, dy }) => {
    document.elementFromPoint(x, y)?.dispatchEvent(new WheelEvent("wheel", { deltaY: dy, clientX: x, clientY: y, ctrlKey: true, bubbles: true, cancelable: true }));
  }, { x, y, dy });

  /** 撮るあいだだけ見た目を足す（場面に関係のない部品を隠すなど） */
  const stage = (css) => page.addStyleTag({ content: css });
  /** コマごとの手当て。止めた時計ではページの <video> が実時間で流れてしまうので、撮る直前に 1 コマぶん送る、など */
  const setOnFrame = (fn) => { onFrame = fn; };
  /** ページの <video> をコマ送りで撮る（止めた時計のままだと <video> だけ実時間で流れ、早回しに見える）。操作の帯は外す */
  async function stepVideo(sel = "video") {
    await until(() => page.evaluate((sel) => { const v = document.querySelector(sel); return v && v.readyState >= 2 && v.duration > 0; }, sel), "動画", 30000);
    await page.evaluate((sel) => { const v = document.querySelector(sel); v.removeAttribute("controls"); v.pause(); v.__t = v.currentTime || 0; }, sel);
    setOnFrame(() => page.evaluate((sel) => new Promise((res) => {
      const v = document.querySelector(sel);
      v.pause();
      v.__t = (v.__t + 1 / 30) % v.duration;
      v.addEventListener("seeked", () => res(), { once: true });
      v.currentTime = v.__t;
    }), sel));
  }

  /** 撮り始める（ここから先の印とコマが動画になる）。撮影前に置いた印（最初の構図・カーソル）は 0 コマ目に寄せる */
  function start(dir) {
    fs.rmSync(dir, { recursive: true, force: true });
    frameDir = path.join(dir, "frames");
    fs.mkdirSync(frameDir, { recursive: true });
    for (const e of events) e.f = 0;
    frames = 0;
  }
  /** 撮り終える。take.mp4 と events.json を書く */
  async function finish(dir, meta) {
    execFileSync(ffmpegPath(), ["-y", "-v", "error", "-framerate", String(FPS), "-i", path.join(frameDir, "%05d.jpg"),
      "-c:v", "libx264", "-preset", "medium", "-crf", "14", "-pix_fmt", "yuv420p", "-g", "15", "-movflags", "+faststart", path.join(dir, "take.mp4")]);
    fs.rmSync(frameDir, { recursive: true, force: true });
    const dpr = await page.evaluate(() => devicePixelRatio);
    fs.writeFileSync(path.join(dir, "events.json"), JSON.stringify({ ...meta, fps: FPS, frames, vw: vp.width, vh: vp.height, dpr, events }, null, 1));
    return frames;
  }

  return { page, config, frame, hold, until, live, look, lookPart, lookRect, wide, park, hideCursor, centerOf, glide, press, pressNav, goto, tap, tapAt,
           scrollEase, yFor, scrollTo, swipe, pinch, key, type, drag, dragThumb, ctrlWheel, stage, setOnFrame, stepVideo, start, finish };
}

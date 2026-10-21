// ReaScratch Web — ?diag=1: the delays as numbers on top of the page, for a phone that feels slow and cannot be
// plugged in for measuring (user's report 2026-10-20: about 0.5 s always on a phone, where a Pixel 4a measured 50 ms).
// The sound's output (base + output latency, and the browser's own output timestamp), the worklet's messages (interval,
// how late they arrive), the frame rate, the finger's moves a second, how far the engine trails the hand (uiLag at the
// finger's speed) and the move interval it assumes (uiAvg). A screenshot of it says where the time goes.
let media = null;
import('./media.js').then((m) => { media = m; });
export function startDiag(app) {
  const box = document.createElement('pre');
  box.style.cssText = 'position:fixed;left:4px;top:4px;z-index:9;margin:0;padding:4px 6px;font:11px/1.35 Consolas,monospace;'
    + 'color:#fbd743;background:rgba(0,0,0,.78);border:1px solid #585e6b;pointer-events:none;white-space:pre';
  document.body.appendChild(box);
  const frames = [], msgs = [], lates = [], moves = [];
  let lastF = performance.now(), lastM = 0;
  const loop = () => { const n = performance.now(); frames.push(n - lastF); lastF = n; if (frames.length > 120) frames.shift(); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  // the worklet's messages: hooked on deck A's pushState (main.js calls it once a message for each deck)
  const hook = () => {
    const u = app.decks[0];
    if (!u || u.__diag) return;
    const orig = u.pushState.bind(u); u.__diag = 1;
    u.pushState = (s, sT) => {
      const n = performance.now();
      if (lastM) { msgs.push(n - lastM); if (msgs.length > 120) msgs.shift(); }
      lastM = n; lates.push(n - sT); if (lates.length > 120) lates.shift();
      orig(s, sT);
    };
  };
  const evName = 'onpointerrawupdate' in window ? 'pointerrawupdate' : 'pointermove';
  const gaps = []; let lastMove = 0;
  window.addEventListener(evName, (e) => {
    if (!(e.buttons || e.pointerType === 'touch')) return;
    const n = performance.now(); moves.push(n);
    if (lastMove && n - lastMove < 200) { gaps.push(n - lastMove); if (gaps.length > 120) gaps.shift(); }
    lastMove = n;
  }, true);
  const med = (x) => { if (!x.length) return 0; const y = [...x].sort((a, b) => a - b); return y[y.length >> 1]; };
  const max = (x) => (x.length ? Math.max(...x) : 0);
  const f1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
  // once the sound is started (a tap was made): what output delay each way of asking gives on this phone. A Motorola
  // edge 60s pro gave base 128 + out 256 ms with 'interactive' (Pixel 4a: 2.7 + 24)
  const hints = [];
  let hinted = false;
  const tryHints = async () => {
    hinted = true;
    // (0 gave the Motorola a 2.7 ms buffer it could not keep up with: the values between, in seconds)
    for (const [label, opt] of [['interactive', { latencyHint: 'interactive' }], ['0', { latencyHint: 0 }], ['0.01 s', { latencyHint: 0.01 }],
      ['0.02 s', { latencyHint: 0.02 }], ['0.04 s', { latencyHint: 0.04 }], ['0.08 s', { latencyHint: 0.08 }],
      ['balanced', { latencyHint: 'balanced' }]]) {
      try {
        const c = new AudioContext(opt); await c.resume(); await new Promise((r) => setTimeout(r, 300));
        hints.push(`  ${label.padEnd(18)} ${c.sampleRate} Hz  base ${f1(c.baseLatency * 1000)}  out ${f1((c.outputLatency || 0) * 1000)} ms`);
        await c.close();
      } catch (e) { hints.push(`  ${label}: ${e.message}`); }
    }
  };
  setInterval(() => {
    hook();
    const c = app.ctx, now = performance.now();
    while (moves.length && now - moves[0] > 1000) moves.shift();
    const lines = [`${navigator.userAgent.replace(/^.*?\(([^)]*)\).*$/, '$1').slice(0, 48)}  dpr ${f1(window.devicePixelRatio)}`];
    if (c) {
      const ts = c.getOutputTimestamp ? c.getOutputTimestamp() : null;
      lines.push(`audio ${c.state} ${c.sampleRate} Hz  base ${f1(c.baseLatency * 1000)} ms  out ${f1((c.outputLatency || 0) * 1000)} ms`);
      if (ts && ts.contextTime) lines.push(`  now - heard ${f1((c.currentTime - ts.contextTime) * 1000)} ms (the browser's output timestamp)`);
    } else lines.push('audio: not started');
    lines.push(`worklet messages ${f1(med(msgs))} ms apart (max ${f1(max(msgs))})  arrive ${f1(med(lates))} ms late (max ${f1(max(lates))})  gaps over 60 ms: ${msgs.filter((x) => x > 60).length}`);
    { const u0 = app.decks[app.active], s0 = u0 && u0.s;
      lines.push(`finger: ${evName}  moves ${f1(med(gaps))} ms apart (max ${f1(max(gaps))})  let go at: engine ${f1(s0 ? s0.relV : 0)}x  finger ${f1(u0 && u0.relFinger || 0)}x`); }
    if (app.load) lines.push(`worklet load: deck A ${f1(app.load[0] * 100)} %  deck B ${f1(app.load[1] * 100)} % of the real time`);
    lines.push(`frames ${f1(1000 / Math.max(1, med(frames)))} /s  (slowest ${f1(max(frames))} ms)  finger moves ${moves.length} /s`);
    const u = app.decks[app.active], s = u && u.s;
    if (s) {
      const sp = Math.abs(s.speed) > 0.05 ? Math.abs(s.uiLag || 0) / Math.abs(s.speed) * 1000 : 0;
      lines.push(`deck ${app.active ? 'B' : 'A'}: touch ${s.tch}  speed ${f1(s.speed)}x  hand ahead ${f1((s.uiLag || 0) * 1000)} ms of sample${sp ? ` (≈${f1(sp)} ms)` : ''}  move interval ${f1(s.uiAvg || 0)} ms`);
    }
    // (only with ?diag=2: opening and closing 7 audio contexts may itself have broken up the page's sound on a phone)
    if (c && c.state === 'running' && !hinted && /[?&]diag=2/.test(location.search)) tryHints();
    // the frames of the active deck's sample: the way they are made, how many are done, what went wrong
    const fs = app.frames && app.frames[app.active] && app.frames[app.active][u && u.s ? u.s.cur : 0];
    if (fs) { let k = 0; for (const b of fs.f.blobs) if (b) k++; lines.push(`frames of the sample: ${fs.f.how || '?'} ${k}/${fs.f.n}  ${fs.f.w}x${fs.f.h}`); }
    else lines.push('frames of the sample: none');
    if (media) for (const m of media.frameNotes) lines.push(`  ${m}`);
    if (hints.length) lines.push('other ways of asking (each a new audio context):', ...hints);
    box.textContent = lines.join('\n');
  }, 250);
}

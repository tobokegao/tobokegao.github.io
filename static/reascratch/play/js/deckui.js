// ReaScratch Web — one deck's screen: the same 744×340 picture as the JSFX's @gfx (spec/ui_spec.md §1), drawn on a canvas
// with the kit's PNG parts. Mouse actions are sent to the audio worklet through `send`.
// The drawing is a literal port of the JSFX's front page (reascratch.jsfx @gfx: g_well, g_block, g_switch, g_knob, g_wave,
// g_readout_h, g_sm_btns, g_button, the sticker, the crossfader, g_fittext): the same coordinates, order, colours
// (g_grey truncates: v * 255 rounded down) and alphas, on whole pixels.
import { t } from './i18n.js';

const W = 744, H = 340, MW = 360, MH = 440;
const HEAD_DELAY = 40;   // ms the drawn head runs behind the worklet's (headNow): a message interval and its spread   // the deck; the phone's short deck
const LAMP = { yellow: '#fbd743', blue: '#4fb3e0' };
const HC_COL = ['#ff6b6b', '#ffb43d', '#3ddc97', '#b18cff', '#52b6ff', '#ff6fc8', '#cfe04a', '#d9945a'];

// Fonts as REAPER's gfx_setfont makes them (GDI, the height = the cell height): the advance of each character 32-126
// (GetCharWidth32 at that size, stored as chr(48 + px)), the ascent, and gfx_measurestr's height. The text is laid out
// with these whole-pixel advances (as gfx_drawstr), so every width and centre matches the JSFX's; the canvas font is the
// same face at its em size (cell height - internal leading).
// one = gfx_measurestr of each character alone in REAPER (the advance + how far its ink goes past it); a string measures
// the advances + the last character's (one - advance): tape 19 + 1 (e) = 20, pitch 22 + 0 (h). Measured with Lua gfx in
// REAPER 7 on this PC (228 strings in 6 fonts all fit, 2026-10-20); the plain advances left "tape" and "play" 1 px short
function mkFont(css, asc, h, adv, one) {
  const a = Array.from(adv, (c) => c.charCodeAt(0) - 48);
  return { css, asc, h, adv: a, over: Array.from(one, (c, i) => c.charCodeAt(0) - 48 - a[i]) };
}
const FONTS = {
  F1: mkFont('10px Tahoma, Verdana, sans-serif', 10, 12, '32476:7244673434555555555544777597677667744658786866676:666454755565653662362866664436685645457', '32476:8244673434555565565544777597687677744768786876777:767454765566664662362866665546686755457'),
  F4: mkFont('bold 10px Tahoma, Verdana, sans-serif', 10, 12, '33487<82556834367777777777338886:8778667855769787876777:776565865665664663473966665546696657678', '33487<93556835367777777777338886:9778677855879787887778;8775658756666656634839677666567:7757688'),
  F5: mkFont('10px Consolas, "Courier New", monospace', 9, 12, '66666666666666666666666666666666666666666666666666666666666666666666666666666666666666666666666', '66666666666666666666666666666666666666666666666666666666666666666666666666666666666666666666666'),
  F6: mkFont('bold 12px Tahoma, Verdana, sans-serif', 12, 15, '45698>93558:4547888888888844:::7:988976895687;898998788<877575:87786875883473;888856687;776777:', '456:8>:3558:4547888888888844:::7::88977896698;8989:9889<988575:97787886883483;888867788<887777:'),
  F7: mkFont('9px Tahoma, Verdana, sans-serif', 9, 11, '32476:62336733335555555555337774876776677446487868666778565353755554553552352855553435684644447', '32476:72436734345555655555337775876876777447587868766779666453765565564552352855654545685754457'),
  F9: mkFont('bold 16px Tahoma, Verdana, sans-serif', 17, 20, '557=:C=477:=5759::::::::::66===9?<;;<:9<<78;9><<;<<:;<;@;;:797=:9::8::6::56:5?::::787:9>:99:::=', '557=:C>477:=5759::::;:::::66===9?=;;<:9<<88<:><<;<=:;<<@<<:797=;9::9::7::56;5?::::898::?;:9:::='),
};
const F1 = FONTS.F1, F4 = FONTS.F4, F5 = FONTS.F5, F6 = FONTS.F6, F9 = FONTS.F9;
for (const k in FONTS) FONTS[k].key = k;
// the glyphs as REAPER draws them (assets/glyphs.png: each character drawn white on black by REAPER 7's own text with
// Lua gfx, the same LICE text as the JSFX's gfx_drawstr; grey levels = coverage). Drawn tinted, so the letters are
// REAPER's on any browser (Chrome's own text had shorter descenders: "play", "pitch" looked cut, user's report
// 2026-10-20). glyphs.json: per font the atlas row y, height, the drawing origin x0 and [x, w] of characters 32-126
let GLYPH = null;
const tinted = new Map();   // colour -> the atlas in that colour
function glyphAtlas(col) {
  let c = tinted.get(col);
  if (!c) {
    const im = IMG.glyphs;
    c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height);
    if (tinted.size > 64) tinted.clear();
    tinted.set(col, c);
  }
  return c;
}
const grey = (v) => { const c = Math.floor(v * 255); return `rgb(${c},${c},${c})`; };   // g_grey
const hex = (h) => `rgb(${(h >> 16) & 255},${(h >> 8) & 255},${h & 255})`;

// g_ramps: 6 tone ramps of 8 (0 silver, 1 frame, 2 dark panel, 3 lamp off, 4 lamp yellow, 5 lamp blue)
const ANC = [
  [0x262a38, 0x4a5263, 0x7a8494, 0xa9b1bb, 0xd8d9d1, 0xfff2cf], [0x585e6b, 0x787f8b, 0x979ea8, 0xb4b9bf, 0xcfd1cf, 0xe7e4d9],
  [0x06080a, 0x0b0e12, 0x10141a, 0x161b21, 0x1c2229, 0x242b33], [0x040506, 0x0c0f13, 0x171c22, 0x242a31, 0x353d46, 0x59636e],
  [0x4f3500, 0x8f6200, 0xd29c00, 0xfbd743, 0xffe98a, 0xfffbea], [0x06223a, 0x0e4266, 0x1d6c9c, 0x4fb3e0, 0x8fd3f2, 0xe6f7ff]];
const RAMP = ANC.map((a) => Array.from({ length: 8 }, (_, k) => {
  let f = k * 5 / 7; const i = Math.min(4, Math.floor(f)); f -= i;
  const mix = (sh) => Math.floor(((a[i] >> sh) & 255) * (1 - f) + ((a[i + 1] >> sh) & 255) * f + 0.5);
  return (mix(16) << 16) | (mix(8) << 8) | mix(0);
}));
const tone = (r, k) => RAMP[r][Math.max(0, Math.min(7, k))];
const bayer = (ix, iy) => ((iy & 1) ? ((ix & 1) ? 0.375 : 0.875) : ((ix & 1) ? 0.625 : 0.125));
const dk = (v, ix, iy) => { const f = Math.max(0, Math.min(1, v)) * 7, i = Math.floor(f); return Math.min(7, i + ((f - i) > bayer(ix, iy) ? 1 : 0)); };

const IMG_NAMES = ['tex_front_wide', 'reascratch_logo', 'knob_big', 'knob_small', 'lamp_off', 'lamp_touch', 'lamp_midi',
  'lamp_play', 'lamp_loop', 'lever', 'slip_on', 'slip_off', 'hotcue_pads8', 'memcue_joined', 'quant_buttons',
  'sync_buttons', 'label_hotcue', 'label_cueloop', 'platter', 'fader_cap', 'tbk_mark', 'key_well', 'key_badge', 'glyphs'];
export const IMG = {};
export function loadImages(base) {
  const json = fetch(`${base}/glyphs.json`).then((r) => r.json()).then((j) => { GLYPH = j; }, () => {});
  return Promise.all([json, ...IMG_NAMES.map((n) => new Promise((res) => {
    const im = new Image(); im.onload = () => { IMG[n] = im; res(); }; im.onerror = res; im.src = `${base}/${n}.png`;
  }))]);
}

// knob ranges (slider defaults from the JSFX)
const KNOBS = {
  glenMs: [10, 200, 50], jitMs: [0, 40, 8], jitOff: [0.01, 1, 0.15], wsolaMs: [0, 20, 10], smooth: [0.1, 100, 15],
};

// g_block (g_flat = 1: no brush dabs) as a picture, kept per size and shade
const BLOCKS = new Map();
function blockImg(w, h, ramp, lo, hi, inset) {
  const key = `${w},${h},${ramp},${lo},${hi},${inset}`;
  let c = BLOCKS.get(key);
  if (c) return c;
  c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'), id = g.createImageData(w, h), d = id.data;
  const put = (x, y, col) => { const o = (y * w + x) * 4; d[o] = (col >> 16) & 255; d[o + 1] = (col >> 8) & 255; d[o + 2] = col & 255; d[o + 3] = 255; };
  for (let cy = 0; cy < h; cy++) {
    const v = lo + (hi - lo) * (1 - cy / Math.max(1, h - 1));
    for (let cx = 0; cx < w; cx++) put(cx, cy, tone(ramp, dk(v, cx, cy)));
  }
  for (let x = 0; x < w; x++) for (let y = 0; y < 2; y++) { put(x, y, tone(ramp, inset ? 0 : 7)); put(x, h - 2 + y, tone(ramp, inset ? 7 : 0)); }
  g.putImageData(id, 0, 0);
  BLOCKS.set(key, c);
  return c;
}

export class DeckUI {
  // mode 'mobile' = the short version for a phone (360 x 380, drawMobile): only what a finger can use
  constructor(canvas, deckIndex, app, mode = 'full') {
    this.cv = canvas; this.g = canvas.getContext('2d');
    this.d = deckIndex; this.app = app;
    this.mobile = mode === 'mobile';
    this.W = this.mobile ? MW : W; this.H = this.mobile ? MH : H;
    canvas.width = this.W; canvas.height = this.H;
    this.s = null;              // last state from the worklet
    this.sT = 0;                // when it came (performance.now)
    this.slotAudio = new Array(8).fill(null);   // per sample: { audio: {ch, rate}, peaks, name }
    this.p = {};                // this deck's parameters (mirror)
    this.hits = [];
    this.drags = new Map();     // per pointer (fingers: a hot cue while scratching)
    this.hands = 0;             // pointers holding the record or the waveform (handDown)
    this.midiT = -1;
    this.msg = ''; this.msgT = 0;
    this.lamp = LAMP.yellow;
    this.mq = { s: '', t0: 0, k: 0 };   // the bottom bar's moving text (g_fittext)
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    // a drag's moves as they come (pointerrawupdate, where there is one), not lined up with the next frame: a frame
    // late is 16-33 ms of scratching late. The mouse's hover stays on pointermove (raw updates come up to 1000 a second)
    const raw = 'onpointerrawupdate' in window;
    if (raw) canvas.addEventListener('pointerrawupdate', (e) => { if (this.drags.has(e.pointerId)) this.move(e); });
    canvas.addEventListener('pointermove', (e) => { if (!raw || !this.drags.has(e.pointerId)) this.move(e); });
    canvas.addEventListener('pointerup', (e) => this.up(e));
    // a touch taken away (the browser's own gesture, the canvas hidden by the phone's deck tabs) only lets go: it does
    // not press PLAY, SYNC, delete or a sample button as a lift would
    canvas.addEventListener('pointercancel', (e) => this.up(e, true));
    canvas.addEventListener('lostpointercapture', (e) => this.up(e, true));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => this.wheel(e), { passive: false });
  }

  send(m) { this.app.send({ d: this.d, ...m }); }
  call(f, ...a) { this.send({ t: 'call', f, a }); }
  set(p) { Object.assign(this.p, p); this.send({ t: 'set', p }); }

  get cur() { return this.s ? this.s.cur : 0; }
  get audio() { const x = this.slotAudio[this.cur]; return x && x.audio; }
  get peaks() { const x = this.slotAudio[this.cur]; return x && x.peaks; }
  get name() { const x = this.slotAudio[this.cur]; return x ? x.name : ''; }
  setAudio(ch, rate, name, k = 0) {
    // (as many as the overview is wide: 448, the phone's 304; the phone drew only the first 68 % of the sample)
    const a = ch[0], n = this.mobile ? MW - 48 - 8 : 448, step = a.length / n, stride = Math.max(1, Math.floor(step / 400));
    const peaks = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let m = 0; const e = Math.min(a.length, Math.floor((i + 1) * step));
      for (let j = Math.floor(i * step); j < e; j += stride) { const v = Math.abs(a[j]); if (v > m) m = v; }
      peaks[i] = m;
    }
    this.slotAudio[k] = { audio: { ch, rate }, peaks, name };
  }

  // a state from the worklet and when it was made (main.js stateTime); the last few kept for headNow
  pushState(s, sT) {
    this.s = s; this.sT = sT;
    const h = this.hist || (this.hist = []);
    // a jump (hot cue, cue, a loop going round, a seek, another sample): drawn at once, not swept across in 40 ms; a
    // hand on the record moves with it
    const p = h[h.length - 1];
    if (p) {
      const dt = (sT - p.t) / 1000, jump = s.pos - (p.pos + (p.speed + s.speed) / 2 * dt);
      if (s.cur !== p.cur) { h.length = 0; if (this.hand) Object.assign(this.hand, { base: s.pos, sum: 0, off: 0 }); }
      else if (Math.abs(jump) > 0.06 + 0.5 * Math.max(Math.abs(s.speed), Math.abs(p.speed)) * Math.max(0, dt)) {
        h.length = 0; if (this.hand) this.hand.base += jump;
      }
    }
    if (h.length && sT <= h[h.length - 1].t) h.length = 0;
    h.push({ t: sT, pos: s.pos, speed: s.speed, cur: s.cur }); if (h.length > 8) h.shift();
    // the picture's own record, long enough for the sound's delay (posAt)
    const q = this.ph || (this.ph = []);
    if (q.length && (s.cur !== q[q.length - 1].cur || sT <= q[q.length - 1].t)) q.length = 0;
    q.push({ t: sT, pos: s.pos, speed: s.speed, cur: s.cur });
    while (q.length > 2 && sT - q[0].t > 1500) q.shift();
  }
  // the head at time t (performance.now() ms) from the states as they came. The picture is shown a sound's delay back
  // with it: going back from the last state with its speed swung the picture far both ways while scratching (about
  // 0.4 s delay on a Motorola edge 60s pro's Chrome, user's check 2026-10-21). A jump between two states (a loop going
  // round, a hot cue) is not swept across
  posAt(t) {
    const q = this.ph, s = this.s;
    if (!q || !q.length) return s ? s.pos : 0;
    if (t <= q[0].t) return q[0].pos;
    for (let i = q.length - 1; i > 0; i--) {
      const a = q[i - 1], b = q[i];
      if (t < a.t) continue;
      if (t >= b.t) return b.pos + b.speed * (t - b.t) / 1000;
      const dt = (b.t - a.t) / 1000, jump = b.pos - (a.pos + (a.speed + b.speed) / 2 * dt);
      if (Math.abs(jump) > 0.06 + 0.5 * Math.max(Math.abs(a.speed), Math.abs(b.speed)) * dt) return a.pos + a.speed * (t - a.t) / 1000;
      return a.pos + (b.pos - a.pos) * (t - a.t) / (b.t - a.t);
    }
    return q[0].pos;
  }
  // head now (s) as drawn: HEAD_DELAY ms back, on the line between the two states around then. Going on from the last
  // state with its speed overshot whenever a scratch turned or changed speed, and the next state pulled it back: the
  // waveform jumped 50-80 px on a phone (user's screen recording 2026-10-20). The sound itself is heard later still
  // (the output's delay, 27 ms on a Pixel 4a, 66 ms on this PC's Chrome)
  headNow() {
    if (this.hand) return this.handPos();
    const v = this.headDrawn(), r = this.handRel;
    if (r) { const k = (performance.now() - r.t) / 150; if (k < 1) return r.pos + (v - r.pos) * k; this.handRel = null; }
    return v;
  }
  // the worklet's head now (its newest state, gone on with its speed): for setting a cue, where the drawn one (40 ms
  // back, or the finger's) would put it early
  headLive() { const s = this.s; return s ? s.pos + (s.playing || s.tch ? s.speed * (performance.now() - this.sT) / 1000 : 0) : 0; }
  // the hand: while a finger (or the mouse) holds the record or the lower waveform, the head is drawn where the hand
  // put it (the head when it went down + the moves sent), not where the worklet's states say 60-80 ms later (its
  // smoothing, the message interval, HEAD_DELAY): the record turns under the finger (user's report 2026-10-20: the
  // picture did not keep up with the finger). Let go: 150 ms from there back to the worklet's head
  // (two hands at once, the record and the waveform: one hold, from the first down to the last up)
  handDown() {
    if (this.hands++ > 0) return;
    this.call('uiDown');
    const s = this.s; this.handRel = null;
    this.hand = s && this.audio ? { base: s.pos, sum: 0, off: this.headDrawn() - s.pos, t0: performance.now() } : null;
  }
  handMove(frames) {
    this.call('uiMove', frames);
    // the moves as they came (?diag=1: the finger's own speed when it lets go, the time between the moves)
    const lg = this.handLog || (this.handLog = []), now = performance.now();
    lg.push([now, frames]); while (lg.length > 2 && now - lg[0][0] > 300) lg.shift();
    const h = this.hand; if (!h || !this.audio) return;
    h.sum = clamp(h.base + h.sum + frames / this.audio.rate, 0, this.s.len) - h.base;
  }
  handUp() {
    if (this.hands > 0 && --this.hands > 0) return;
    // the finger's speed over its last 60 ms (x), as the page saw the moves: the spin on release starts from it
    // (engine/deck.js uiUp). Held still (no move in 60 ms): 0
    const lg = this.handLog || [], now = performance.now(), last = lg.filter(([t]) => now - t <= 60);
    const span = lg.length > last.length ? 60 : last.length ? Math.max(16, now - last[0][0]) : 60;
    this.relFinger = this.audio ? last.reduce((a, [, f]) => a + f, 0) / this.audio.rate / (span / 1000) : 0;
    this.handLog = [];
    this.call('uiUp', this.relFinger);
    if (this.hand) { this.handRel = { pos: this.handPos(), t: performance.now() }; this.hand = null; }
  }
  // (the head when the hand went down was drawn HEAD_DELAY back: that gap closes over 80 ms, no jump)
  handPos() { const h = this.hand; return h.base + h.sum + h.off * Math.max(0, 1 - (performance.now() - h.t0) / 80); }
  headDrawn() {
    // (no shortcut for a stopped deck: it skipped the 40 ms, and the head jumped forward when the deck stopped)
    const s = this.s; if (!s) return 0;
    const h = this.hist, t = performance.now() - HEAD_DELAY;
    if (!h || !h.length) return s.pos;
    if (t <= h[0].t) return h[0].pos;
    for (let i = h.length - 1; i > 0; i--) {
      const a = h[i - 1], b = h[i];
      if (t >= a.t) return t >= b.t ? b.pos + b.speed * (t - b.t) / 1000 : a.pos + (b.pos - a.pos) * (t - a.t) / (b.t - a.t);
    }
    return h[0].pos;
  }

  status(m) { this.msg = m; this.msgT = performance.now(); }

  // ---------- drawing primitives (as the JSFX's) ----------
  // gfx_drawstr from (x, y) = the top of the cell; characters on whole-pixel advances
  text(str, x, y, f, col) {
    if (this.fm) return this.box(x, this.tw(str, f), () => this.text(str, x, y, f, col));
    const g = this.g; g.font = f.css; g.fillStyle = col; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    let cx = Math.floor(x); const by = Math.floor(y) + f.asc;
    const G = GLYPH && IMG.glyphs && GLYPH[f.key];
    if (G) {   // REAPER's glyphs
      const at = glyphAtlas(col), y0 = Math.floor(y);
      for (const ch of String(str)) {
        const c = ch.codePointAt(0);
        if (c >= 33 && c <= 126) { const [ax, aw] = G.cells[c - 32]; g.drawImage(at, ax, G.y, aw, G.h, cx - G.x0, y0, aw, G.h); }
        else if (c > 126) g.fillText(ch, cx, by);
        cx += this.cw(ch, f);
      }
      return cx;
    }
    for (const ch of String(str)) {
      if (ch !== ' ') g.fillText(ch, cx, by);
      cx += this.cw(ch, f);
    }
    return cx;
  }
  cw(ch, f) {
    const c = ch.codePointAt(0);
    if (c >= 32 && c <= 126) return f.adv[c - 32];
    this.g.font = f.css; return Math.round(this.g.measureText(ch).width);
  }
  tw(str, f) {   // gfx_measurestr: the advances + the last character's ink past its advance
    let w = 0, last = -1;
    for (const ch of String(str)) { w += this.cw(ch, f); last = ch.codePointAt(0); }
    return last >= 32 && last <= 126 ? w + f.over[last - 32] : w;
  }
  ctext(str, cx, y, f, col) { this.text(str, Math.floor(cx - this.tw(str, f) / 2), y, f, col); }
  rtext(str, xr, y, f, col) { this.text(str, xr - this.tw(str, f), y, f, col); }
  rect(x, y, w, h, col, a = 1) { if (this.fm) x = W - x - w; const g = this.g; g.globalAlpha = a; g.fillStyle = col; g.fillRect(x, y, w, h); g.globalAlpha = 1; }
  // gfx_line, horizontal or vertical, ends included
  line(x1, y1, x2, y2, col, a = 1) { this.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1) + 1, Math.abs(y2 - y1) + 1, col, a); }
  blit(name, x, y, sx, sy, sw, sh) {
    const im = IMG[name]; if (!im) return false;
    if (this.fm) x = W - x - (sw === undefined ? im.width : sw);
    if (sw === undefined) this.g.drawImage(im, x, y); else this.g.drawImage(im, sx, sy, sw, sh, x, y, sw, sh);
    return true;
  }
  block(x, y, w, h, ramp, lo, hi, inset) { if (this.fm) x = W - x - w; this.g.drawImage(blockImg(w, h, ramp, lo, hi, inset), x, y); }
  hit(x, y, w, h, o) {
    if (this.fm) x = W - x - w;   // (mirrored: the area moved; such an area's handlers use only how far the pointer went)
    const ox = this.hx || 0; this.hits.push({ x: x + ox, y, w, h, ox, ...o });
  }
  // the JSFX's left-handed layout (slider 81, g_mr / g_fl; user's request 2026-10-21: as the REAPER version's): the
  // desktop front laid out as usual, each drawing call's box moved to the other side (fm on: rect, blit, block, text,
  // hit, dline). A group that keeps its own order inside (the hot cues 1-8, sync and tempo, a readout, a switch, a knob's
  // body, the waveform, the record) is drawn whole in box(x, w): moved, not turned round
  box(x, w, fn) {
    if (!this.fm) return fn();
    this.fm = false;
    try { return this.shift(W - 2 * x - w, fn); } finally { this.fm = true; }
  }
  // a block of the front drawn moved sideways by dx (the mirrored layout): drawing, touch areas and the points handed
  // to them all moved with it
  shift(dx, fn) {
    if (!dx) return fn();
    const g = this.g, was = this.hx || 0;
    g.save(); g.translate(dx, 0); this.hx = was + dx;
    try { return fn(); } finally { this.hx = was; g.restore(); }
  }
  // the record on the left or the right (user's request 2026-10-21, as the JSFX's left-handed layout, slider 81):
  // setup's 'recSide' = left / right, or auto = on the outer side when the two decks are side by side (A left, B right),
  // else where this deck has it (the desktop's on the right, the phone's on the left). true = drawn mirrored
  mirrored() {
    const pref = this.p.recSide || 'auto', home = this.mobile ? 'left' : 'right';
    const side = pref !== 'auto' ? pref : this.app.sideBySide ? (this.d === 0 ? 'left' : 'right') : home;
    return side !== home;
  }
  heldBy(f) { for (const d of this.drags.values()) if (f(d)) return d; return null; }
  pressed(key) { return !!this.heldBy((d) => d.press === key); }

  // g_well: recessed dark well with the bevel around it
  well(x, y, w, h) {
    if (this.fm) return this.box(x - 1, w + 2, () => this.well(x, y, w, h));
    this.rect(x, y, w, h, grey(0.03));
    let d = Math.min(12, Math.floor(h * 0.45));
    for (let i = 0; i < d; i++) this.rect(x, y + i, w, 1, '#000', (1 - i / d) ** 2 * 0.75);
    d = Math.min(6, Math.floor(w * 0.1));
    for (let i = 0; i < d; i++) { const a = (1 - i / d) ** 2 * 0.45; this.rect(x + i, y, 1, h, '#000', a); this.rect(x + w - 1 - i, y, 1, h, '#000', a); }
    for (let i = 0; i < 3; i++) this.rect(x, y + h - 1 - i, w, 1, '#8fb4cc', (1 - i / 3) * 0.10);
    // g_bevel(x - 1, y - 1, w + 2, h + 2, inset, 0.55, 0)
    const x0 = x - 1, y0 = y - 1, x1 = x + w, y1 = y + h;
    this.line(x0, y0, x1, y0, '#000'); this.line(x0, y0, x0, y1, '#000');
    this.line(x0, y1, x1, y1, grey(0.55)); this.line(x1, y0, x1, y1, grey(0.55));
  }
  // g_readout_h
  readout(x, y, w, h, label, val, lit) {
    if (this.fm) return this.box(x - 1, w + 2, () => this.readout(x, y, w, h, label, val, lit));
    this.well(x, y, w, h);
    const ty = y + Math.floor((h - 13) / 2);
    this.text(label, x + 5, ty, F5, grey(0.55));
    this.rtext(val, x + w - 5, ty, F5, lit ? this.lamp : grey(0.75));
  }
  // engraved divider on the frame
  divider(x) { this.line(x, 17, x, 33, grey(0.47)); this.line(x + 1, 17, x + 1, 33, grey(0.97)); }
  // g_dline: dotted wire, a pixel wherever (x + y) is even
  dline(x1, y1, x2, y2) {
    if (this.fm) { x1 = W - 1 - x1; x2 = W - 1 - x2; }   // (g_dl)
    let x = Math.min(x1, x2), y = Math.min(y1, y2);
    const g = this.g; g.globalAlpha = 0.9; g.fillStyle = grey(0.5);
    if (y1 === y2) { x += (x + y) & 1; for (; x <= Math.max(x1, x2); x += 2) g.fillRect(x, y, 1, 1); }
    else { y += (x + y) & 1; for (; y <= Math.max(y1, y2); y += 2) g.fillRect(x, y, 1, 1); }
    g.globalAlpha = 1;
  }

  // ---------- drawing ----------
  draw(frame) {
    const g = this.g, s = this.s || { pos: 0, len: 0, playing: 0, cue: 0, hot: new Array(8).fill(-1), speed: 0, tch: 0, tempo: 0, bpm: 0, slip: 0, xfGain: 1 };
    this.hits = [];
    g.imageSmoothingEnabled = false;
    if (this.mobile) { this.drawMobile(s, frame); return; }
    if (!this.blit('tex_front_wide', 0, 0)) { this.rect(0, 0, W, H, '#b4b9bf'); this.rect(16, 44, 712, 260, '#10141a'); }
    this.mr = this.fm = this.mirrored();   // (the background as it is; the rest mirrored when left-handed)
    try {
      if (IMG.reascratch_logo) this.blit('reascratch_logo', 24, Math.max(1, Math.floor((44 - IMG.reascratch_logo.height) / 2)));
      this.drawTop(s);
      this.drawLamps(s);
      this.drawReadouts(s);
      this.box(32, 456, () => this.drawWave(s));
      this.drawControls(s);
      this.drawPlatter(s, frame);
      this.drawBottom(s);
    } finally { this.fm = false; }
    // web only: the deck the keys go to has a thin lamp-coloured edge
    if (this.app.active === this.d) { g.strokeStyle = this.lamp; g.globalAlpha = 0.9; g.lineWidth = 2; g.strokeRect(1, 1, W - 2, H - 2); g.globalAlpha = 1; g.lineWidth = 1; }
  }

  // frame buttons: bezel top G_BY = 16, height G_BH = 18
  drawTop(s) {
    const p = this.p, BY = 16, BH = 18;
    // slip: bezel x 676 .. 720 (the picture's bezel starts 12 px in)
    const tgx = W - 24 - 56, bbx = tgx + 12;
    this.blit(p.slip ? 'slip_on' : 'slip_off', bbx - 12, BY - 14);
    this.hit(bbx, BY, 44, BH, { up: () => this.set({ slip: p.slip ? 0 : 1 }), help: 'slip' });
    // hot cue pads 1-8, 14 wide, 3 apart (with their label one group: 1-8 left to right also mirrored)
    const hb0 = tgx + 12 - 16 - 133;
    this.divider(tgx + 12 - 8);
    this.box(hb0 - 14, 7 * 17 + 42, () => {
    let hbx = hb0;
    for (let n = 0; n < 8; n++, hbx += 17) {
      const set = s.hot[n] >= 0, held = !!this.heldBy((d) => d.hc === n);
      this.blit('hotcue_pads8', hbx - 14, BY - 14, n * 42, (!set ? 0 : held ? 2 : 1) * 50, 42, 50);
      this.hit(hbx, BY, 14, BH, {
        // (⚪205) another pad mode chosen on the setup page: main.js onPad takes the pad (SHIFT / Shift+click = its SHIFT layer)
        down: (e) => { if (this.onPad && e.button !== 2 && this.onPad(n, 1, e.shiftKey)) return { hc: n }; if (e.button === 2 || e.shiftKey) { this.call('hcDelete', n); return { none: 1 }; } this.call('hcPress', n); return { hc: n }; },
        up: () => { if (!(this.onPad && this.onPad(n, 0, false))) this.call('hcRelease', n); }, release: 1, help: 'hotcue',
      });
    }
    const lab = p.cueLoop && IMG.label_cueloop ? 'label_cueloop' : 'label_hotcue';
    if (IMG[lab]) {
      const lw = IMG[lab].width, lh = IMG[lab].height, lx = tgx + 12 - 16 - Math.floor((133 + lw) / 2);
      this.blit(lab, lx, BY - 3 - lh);
      this.hit(lx - 4, BY - 7 - lh, lw + 8, lh + 6, { up: () => this.set({ cueLoop: p.cueLoop ? 0 : 1 }), help: 'cueLoop' });
    }
    });
    // memory cues: back 26 | memory 54 | next 26 (one joined bar; picture columns 0..40, 40..94, 94..134)
    const mdx = tgx + 12 - 16 - 133 - 8;
    this.divider(mdx);
    const mc = s.mc || [], hd = this.headNow(), held = (this.heldBy((d) => d.mem) || {}).mem;
    const lit = [mc.some((m) => m < hd - 0.005), false, mc.some((m) => m > hd + 0.005)];
    let mbx = mdx - 8 - 106;
    const mb0 = mbx;
    this.box(mb0 - 14, 134, () => {
    for (let i = 0; i < 3; i++) {
      const mw = i === 1 ? 54 : 26;
      const row = i === 1 && mc.length >= 32 && held !== 2 ? 4 : (held === i + 1 ? 2 : 0) + (lit[i] ? 1 : 0);
      this.blit('memcue_joined', i === 0 ? mbx - 14 : mbx, BY - 14, i === 0 ? 0 : i === 1 ? 40 : 94, row * 50, i === 1 ? 54 : 40, 50);
      mbx += mw;
    }
    this.hit(mb0, BY, 26, BH, { down: () => ({ mem: 1 }), up: () => this.call('mcCall', -1), help: 'mcBack' });
    this.hit(mb0 + 26, BY, 54, BH, {
      down: (e) => { if (e.button === 2 || e.shiftKey) { this.call('mcDelete'); return { none: 1 }; } return { mem: 2 }; },
      up: () => this.call('mcAdd'), help: 'mcAdd',
    });
    this.hit(mb0 + 80, BY, 26, BH, { down: () => ({ mem: 3 }), up: () => this.call('mcCall', 1), help: 'mcNext' });
    });
    // quantize and the bpm readout, past another divider
    const qdx = mdx - 8 - 106 - 9;
    this.divider(qdx);
    const qw = this.tw('bpm 000.00', F5) + 10, qrx = qdx - 8 - qw;
    const bpmShown = p.bpm > 0 ? (p.bpm * (1 + (s.tempo || 0) / 100)).toFixed(2) : '-';
    const typing = this.bpmTyping != null, qbx = qrx - 14 - 26;
    this.box(qbx - 14, qrx + qw - qbx + 14, () => {   // (Q and the bpm readout one group)
    this.readout(qrx, BY + 1, qw, BH - 2, typing ? 'set' : 'bpm', typing ? this.bpmTyping + (Math.floor(performance.now() / 500) % 2 ? ' ' : '_') : bpmShown, p.bpm > 0 || typing);
    this.hit(qrx, BY + 1, qw, BH - 2, { up: () => this.app.askBpm(this.d), help: 'bpm' });
    this.blit('quant_buttons', qbx - 14, BY - 14, 0, (this.pressed('q') ? 2 : p.quant ? 1 : 0) * 50, 54, 50);
    this.hit(qbx, BY, 26, BH, { down: () => ({ press: 'q' }), up: () => this.set({ quant: p.quant ? 0 : 1 }), help: 'quant' });
    });
    // tempo readout and sync, left of Q
    const tdx = qdx - 8 - qw - 14 - 26;
    const tew = this.tw('+50.00%', F5) + 10, terx = tdx - 14 - tew, sbx = terx - 8 - 40;
    const te = s.tempo || 0;
    this.box(sbx - 14, terx + tew - sbx + 14, () => {
    this.readout(terx, BY + 1, tew, BH - 2, '', `${te >= 0 ? '+' : ''}${te.toFixed(2)}%`, te !== 0);
    this.hit(terx, BY, tew, BH, {
      down: () => ({ tempo0: this.p.tempo || 0 }),
      drag: (dx, dy, e, st) => this.set({ tempo: clamp(st.tempo0 + dx / 200 * 2 * (this.p.range || 16) * (e.shiftKey ? 0.1 : 1), -50, 50) }),
      reset: () => this.set({ tempo: 0 }), wheel: (k) => this.set({ tempo: clamp((this.p.tempo || 0) + k * 0.1, -50, 50) }), help: 'tempo',
    });
    this.blit('sync_buttons', sbx - 14, BY - 14, 0, (this.pressed('sync') ? 2 : s.sync ? 1 : 0) * 50, 68, 50);
    this.hit(sbx, BY, 40, BH, { down: () => ({ press: 'sync' }), up: () => this.app.toggleSync(this.d), help: 'sync' });
    });
  }

  // lamps along the top edge of the content box (g_t = 60): touch, midi, play, phones (g_lamp)
  drawLamps(s) {
    const cy = 66;
    const lamps = [['touch', s.tch, 'lamp_touch'], ['midi', performance.now() - this.midiT < 120, 'lamp_midi'], ['play', s.playing, 'lamp_play'],
      ['phones', s.pfl, 'lamp_loop']];   // (the headphone cue, ⚪205: click = on / off, as the H key)
    let x = 32 + 6;
    const lw = lamps.reduce((a, [label]) => a + 11 + this.tw(label, F1) + 12 + 6, 0);
    this.box(x - 14, lw + 8, () => {
    for (const [label, on, img] of lamps) {
      this.blit(on ? img : 'lamp_off', x - 14, cy - 14);
      this.text(label, x + 11, cy - 7, F1, grey(on ? 0.95 : 0.60));
      if (label === 'play') this.hit(x - 9, cy - 9, 20 + this.tw(label, F1), 18, { up: () => this.call('playBtn'), help: 'play' });
      if (label === 'phones') this.hit(x - 9, cy - 9, 20 + this.tw(label, F1), 18, { up: () => this.set({ pfl: s.pfl ? 0 : 1 }), help: 'phones' });
      x += 11 + this.tw(label, F1) + 12 + 6;
    }
    });
  }

  // readout windows at the top right, the last one ends at g_r = 488
  drawReadouts(s) {
    const y = 59, h = 15;
    const w3 = this.tw('+ 00.00x', F5) + 10, w2 = this.tw('head 000.000', F5) + 10, w1 = this.tw('cue 000.000', F5) + 10;
    const x3 = 488 - w3, x2 = x3 - 8 - w2, x1 = x2 - 8 - w1;
    this.box(x1 - 1, 488 - x1 + 2, () => {
    this.readout(x3, y, w3, h, s.speed < 0 ? '-' : '+', Math.abs(s.speed || 0).toFixed(2) + 'x', true);
    this.readout(x2, y, w2, h, 'head', this.headNow().toFixed(3), true);
    this.readout(x1, y, w1, h, 'cue', (s.cue || 0).toFixed(3), false);
    });
  }

  // g_wave: mirrored hills, a 30 % fill, then the outline (inner edge on whole rows) with its glow; steps of more than
  // one row joined with anti-aliased lines
  wave(x0, y, h, peaks, hx, n) {
    const g = this.g, mid = y + Math.floor(h / 2), half = Math.floor((h - 2) / 2);
    g.globalAlpha = 0.30;
    for (let i = 0; i < n; i++) {
      const a = Math.floor(Math.min(1, peaks[i]) * half), cx = x0 + i;
      g.fillStyle = cx < hx ? '#e6b731' : '#808690'; g.fillRect(cx, mid - a, 1, 2 * a + 1);
    }
    let rp = -1, rbp = -1;
    for (let i = 0; i < n; i++) {
      const a = Math.floor(Math.min(1, peaks[i]) * half), r = mid - a, rb = mid + a, cx = x0 + i;
      g.fillStyle = cx < hx ? '#e6b731' : '#aab2ba';
      g.globalAlpha = 1; g.fillRect(cx, r, 1, 1); g.fillRect(cx, rb, 1, 1);
      g.globalAlpha = 0.5; g.fillRect(cx, r - 1, 1, 1); g.fillRect(cx, rb + 1, 1, 1);
      g.globalAlpha = 0.25; g.fillRect(cx, r - 2, 1, 1); g.fillRect(cx, rb + 2, 1, 1);
      g.globalAlpha = 0.12; g.fillRect(cx, r - 3, 1, 1); g.fillRect(cx, rb + 3, 1, 1);
      if (rp >= 0 && Math.abs(r - rp) > 1) {
        this.aaLine(cx - 0.5, rp + 0.5, cx + 0.5, r + 0.5, 1); this.aaLine(cx - 0.5, rbp + 0.5, cx + 0.5, rb + 0.5, 1);
        this.aaLine(cx - 0.5, rp - 0.5, cx + 0.5, r - 0.5, 0.5); this.aaLine(cx - 0.5, rbp + 1.5, cx + 0.5, rb + 1.5, 0.5);
        this.aaLine(cx - 0.5, rp - 1.5, cx + 0.5, r - 1.5, 0.25); this.aaLine(cx - 0.5, rbp + 2.5, cx + 0.5, rb + 2.5, 0.25);
      }
      rp = r; rbp = rb;
    }
    g.globalAlpha = 1;
  }
  // a steep anti-aliased line (gfx_line with aa): each row's coverage split between its two columns (fillStyle as set)
  aaLine(x1, y1, x2, y2, a) {
    const g = this.g;
    if (y2 < y1) { [x1, x2] = [x2, x1]; [y1, y2] = [y2, y1]; }
    const ya = Math.round(y1), yb = Math.round(y2), k = (x2 - x1) / Math.max(1e-9, y2 - y1);
    for (let y = ya; y <= yb; y++) {
      const x = x1 + (y - y1) * k, xi = Math.floor(x), f = x - xi;
      if (1 - f > 0.004) { g.globalAlpha = a * (1 - f); g.fillRect(xi, y, 1, 1); }
      if (f > 0.004) { g.globalAlpha = a * f; g.fillRect(xi + 1, y, 1, 1); }
    }
  }
  mcTri(x, y) { this.rect(x - 2, y, 5, 1, '#f2f0ec'); this.rect(x - 1, y + 1, 3, 1, '#f2f0ec'); this.rect(x, y + 2, 1, 1, '#f2f0ec'); }   // g_mc_tri

  drawWave(s, lx = 32, ly = 86, lw = 456, lh = 70) {
    const x0 = lx + 4, wn = lw - 8;
    this.well(lx, ly, lw, lh);
    const head = this.headNow(), a = this.audio;
    if (!this.peaks || !s.len || !a) {
      this.text(this.app.loading[this.d] || t(this.mobile ? 'loadHere' : 'dropHere'), lx + 10, ly + Math.floor(lh / 2) - 7, F5, grey(0.55));
      return;
    }
    const p = this.p, len = s.len, sr = a.rate, spp = 0.002;   // the zoom: 2 ms of the sample per picture pixel
    // the overview 18 high (the JSFX's), more in a taller well (the phone's: a finger needs room)
    const ovy = ly + 3, ovh = lh >= 90 ? Math.floor(lh * 0.3) : 18, sep = ovh + 5, zy = ly + sep + 2, zh = ly + lh - 3 - zy, zc = x0 + Math.floor(wn / 2);
    const ovx = (tt) => x0 + Math.floor(Math.min(tt, len - 1 / sr) / len * wn);
    const zx = (tt) => zc + Math.floor((tt - head) / spp);
    const inZ = (x) => x > lx + 3 && x < lx + lw - 4;
    // overview: played part in mustard, the rest grey
    const hx = x0 + Math.floor(head / len * wn);
    this.wave(x0, ovy, ovh, this.peaks, hx, wn);
    const zi = Math.max(0, Math.floor((head - wn / 2 * spp) / len * wn)), za = Math.min(wn, Math.floor((head + wn / 2 * spp) / len * wn));
    this.rect(x0 + zi, ovy - 1, Math.max(2, za - zi), ovh + 2, grey(0.80), 0.18);
    this.line(ovx(s.cue || 0), ovy - 1, ovx(s.cue || 0), ovy + ovh, grey(0.60));
    s.hot.forEach((hc, i) => { if (hc >= 0) { const x = ovx(hc); this.line(x, ovy - 1, x, ovy + ovh, HC_COL[i]); this.rect(x, ovy - 1, 3, 3, HC_COL[i]); } });
    for (const m of s.mc || []) this.mcTri(ovx(m), ovy - 1);
    if (s.slip) { const x = x0 + Math.floor(s.slipPos / len * wn); this.line(x, ovy - 1, x, ovy + ovh, '#d8d9d1', 0.8); }
    if (s.bl) {   // (web) the beat loop on the overview
      const ba = ovx(s.bl[0]), bb = ovx(s.bl[1]);
      this.rect(ba, ovy - 1, Math.max(1, bb - ba), 2, this.lamp, 0.5);
    }
    this.rect(hx - 1, ovy - 1, 2, ovh + 2, this.lamp);
    this.line(x0, ly + sep, lx + lw - 5, ly + sep, grey(0.22));
    // zoom: peaks around the head, a few samples per column
    const zp = this.zp && this.zp.length === wn ? this.zp : (this.zp = new Float32Array(wn)), ch = a.ch[0], n = ch.length, hf = head * sr, fpp = spp * sr, st = Math.max(1, Math.floor(fpp / 24));
    for (let i = 0; i < wn; i++) {
      const t0 = hf + (i - Math.floor(wn / 2)) * fpp; let m = 0;
      if (t0 >= 0 && t0 < n - 1) for (let j = 0; j < fpp && t0 + j < n; j += st) { const v = Math.abs(ch[Math.floor(t0 + j)]); if (v > m) m = v; }
      zp[i] = m;
    }
    this.wave(x0, zy, zh, zp, zc, wn);
    // beats: every beat a line, a bar's first beat stronger and 2 px; the loop's ends and a waiting jump in the lamp colour
    if (p.bpm > 0) {
      const spb = 60 / p.bpm, gr = p.grid || 0;
      let b = Math.ceil((head - Math.floor(wn / 2) * spp - gr) / spb);
      for (let k = 0; k < 64; k++, b++) {
        const x = zx(gr + b * spb), bar = ((b % 4) + 4) % 4 === 0;
        if (inZ(x)) this.rect(x, zy, bar ? 2 : 1, zh, '#fff', bar ? 0.75 : 0.32);
      }
      if (s.lp && p.loop) {
        let x = zx(s.lp[0]); if (inZ(x)) this.rect(x, zy, 2, zh, this.lamp, 0.85);
        x = zx(s.lp[1]); if (inZ(x)) this.rect(x - 1, zy, 2, zh, this.lamp, 0.85);
      }
      if (s.qAt >= 0) { const x = zx(s.qAt); if (inZ(x)) this.rect(x, zy, 1, zh, this.lamp, 0.75); }
    }
    if (s.bl) {   // (web) the beat loop on the zoom
      const xa = Math.max(x0, zx(s.bl[0])), xb = Math.min(x0 + wn, zx(s.bl[1]));
      if (xb > xa) this.rect(xa, zy, xb - xa, zh, this.lamp, 0.12);
      for (const tt of s.bl) { const x = zx(tt); if (inZ(x)) this.rect(x, zy, 2, zh, this.lamp); }
    }
    const gw = Math.max(2, Math.floor((p.glenMs || 50) / 1000 / spp));
    this.rect(zc - Math.floor(gw / 2), zy, gw, zh, this.lamp, 0.22);
    let x = zx(s.cue || 0);
    if (inZ(x)) this.line(x, zy, x, zy + zh - 1, grey(0.60));
    s.hot.forEach((hc, i) => {
      const xh = zx(hc);
      if (hc >= 0 && xh > lx + 3 && xh < lx + lw - 12) { this.line(xh, zy, xh, zy + zh - 1, HC_COL[i]); this.text(String(i + 1), xh + 2, zy, F5, HC_COL[i]); }
    });
    for (const m of s.mc || []) {
      const xm = zx(m);
      if (xm > lx + 5 && xm < lx + lw - 6) { this.mcTri(xm, zy); this.line(xm, zy + 3, xm, zy + zh - 1, '#f2f0ec', 0.45); }
    }
    x = zx(s.slipPos);
    if (s.slip && inZ(x)) this.line(x, zy, x, zy + zh - 1, '#d8d9d1', 0.8);
    this.rect(zc - 1, zy, 2, zh, this.lamp);
    // mouse: overview = needle search, zoom = scratch
    const toPos = (mx) => clamp((mx - x0) / wn, 0, 1) * len;
    this.hit(lx, ly, lw, sep + 1, {
      down: (e, mx) => { if (e.button === 2) { this.set({ cue: toPos(mx) }); return { none: 1 }; } this.call('seekStart', toPos(mx) * sr); return { seek: 1 }; },
      dragAbs: (mx) => this.call('seekMove', toPos(mx) * sr), up: () => this.call('seekEnd'), release: 1, help: 'search',
    });
    this.hit(lx, ly + sep + 1, lw, lh - sep - 1, {
      down: (e, mx) => {
        if (e.button === 2) { this.set({ cue: clamp(head + (mx - zc) * spp, 0, len) }); return { none: 1 }; }
        this.handDown(); return { scratch: 1 };
      },
      dragPx: (dxWin, e) => this.handMove(-dxWin * spp * sr * (e.shiftKey ? 0.25 : 1)), up: () => this.handUp(), release: 1, help: 'scratch',
    });
  }

  // g_knob: c = the grain knob (C-shaped LED ring, name on its right); side = where a helper knob's name goes (6 upper
  // left, 7 below right-aligned)
  knob(cx, cy, r, key, c, label, side) {
    // the body (its dots, picture, pointer, touch area) as it is, moved; the name to the mirrored side (JSFX 6597-6604)
    this.box(cx - r - 14, 2 * r + 28, () => this.knobBody(cx, cy, r, key, c));
    const hh = Math.max(2, Math.floor(r * 0.12)), fy = Math.floor(cy - hh / 2);
    if (c) this.text(label, cx + r + 22, fy + hh - Math.floor(F6.h / 2), F6, grey(0.92));
    else if (side === 6) this.text(label, cx - r - 4 - this.tw(label, F1), fy + hh - F1.h - 1, F1, grey(0.92));
    else this.text(label, cx + r - this.tw(label, F1), fy + hh + r + 2, F1, grey(0.92));
  }
  knobBody(cx, cy, r, key, c) {
    const [lo, hi] = KNOBS[key], v = this.p[key] ?? KNOBS[key][2], f = (v - lo) / (hi - lo);
    const hh = Math.max(2, Math.floor(r * 0.12)), fy = Math.floor(cy - hh / 2), a0 = c ? 0.75 * Math.PI : -0.75 * Math.PI;
    if (c) {
      const col = this.lamp === LAMP.blue ? 5 : 4;
      for (let i = 0; i < 13; i++) {
        const a = a0 + i / 12 * 1.5 * Math.PI, px = Math.floor(cx + Math.sin(a) * (r + 11)) - 3, py = Math.floor(fy + hh - Math.cos(a) * (r + 11)) - 3;
        if (i / 12 <= f + 0.0001) {
          this.rect(px - 1, py, 8, 6, hex(tone(col, 3)), 0.35); this.rect(px, py - 1, 6, 8, hex(tone(col, 3)), 0.35);
          this.rect(px + 1, py, 4, 1, hex(tone(col, 7))); this.rect(px, py + 1, 6, 1, hex(tone(col, 6)));
          this.rect(px, py + 2, 6, 2, hex(tone(col, 5))); this.rect(px, py + 4, 6, 1, hex(tone(col, 3))); this.rect(px + 1, py + 5, 4, 1, hex(tone(col, 2)));
        } else {
          this.rect(px + 1, py, 4, 1, hex(tone(3, 7))); this.rect(px, py + 1, 6, 4, hex(tone(3, 4))); this.rect(px + 1, py + 5, 4, 1, hex(tone(3, 2)));
        }
      }
    }
    this.blit(c ? 'knob_big' : 'knob_small', cx - r - 4, fy - r - 4);
    const a = a0 + f * 1.5 * Math.PI, groove = hex(tone(0, 0));
    for (let i = 0.20; i <= 0.70; i += 1 / r) {   // the pointer: a groove on the flat top face
      this.rect(Math.floor(cx + Math.sin(a) * r * i) - 1, Math.floor(cy - hh / 2 - Math.cos(a) * r * i) - 1, 3, 3, groove);
    }
    this.hit(cx - r - 14, cy - r - 14, 2 * r + 28, 2 * r + 28, {
      down: () => ({ v0: this.p[key] ?? KNOBS[key][2] }),
      drag: (dx, dy, e, st) => this.set({ [key]: clamp(st.v0 - dy / 160 * (hi - lo) * (e.shiftKey ? 0.1 : 1), lo, hi) }),
      reset: () => this.set({ [key]: KNOBS[key][2] }), help: key,
    });
  }

  // g_switch: slide switch, cy = its centre line
  switch(x, cy, lab0, lab1, on, act) {
    if (this.fm) { const t0 = this.tw(lab0, F1); return this.box(x - t0 - 8, t0 + 8 + 48 + this.tw(lab1, F1) + 2, () => this.switch(x, cy, lab0, lab1, on, act)); }
    const y = cy - 7, tw = this.tw(lab0, F1);
    this.text(lab0, x - tw - 6, y + 1, F1, grey(on ? 0.50 : 0.95));
    this.text(lab1, x + 48, y + 1, F1, grey(on ? 0.95 : 0.50));
    this.well(x + 1, y + 1, 41, 14);
    this.blit('lever', x + (on ? 24 : 1), y + 1);
    for (const k of [6, 10, 14]) this.line(x + (on ? k + 23 : k), y + 4, x + (on ? k + 23 : k), y + 11, grey(0.55));
    this.hit(x - tw - 8, y - 2, tw + 8 + 42 + 50, 19, { up: act, help: lab0 });
  }

  drawControls(s) {
    const p = this.p;
    const l = 32, r = 488, b = 288, ct = 86 + 70 + 12;   // content box, controls top (under the waveform)
    // switch column
    const lw0 = Math.max(...['stop', 'end', 'fwd', 'x2'].map((x) => this.tw(x, F1))), sx = l + lw0 + 6;
    const swr = sx + 48 + Math.max(...['play', 'loop', 'x4', 'rev'].map((x) => this.tw(x, F1)));
    const s0 = ct + 7 + 4, pitch = (b - 8 - 4 - s0) / 3;
    this.switch(sx, s0, 'stop', 'play', !!s.playing, () => this.call('playBtn'));
    this.switch(sx, s0 + Math.floor(pitch + 0.5), 'end', 'loop', !!(p.loop ?? 1), () => this.set({ loop: (p.loop ?? 1) ? 0 : 1 }));
    this.switch(sx, s0 + Math.floor(2 * pitch + 0.5), 'x2', 'x4', (p.overlap ?? 4) === 4, () => this.set({ overlap: (p.overlap ?? 4) === 4 ? 2 : 4 }));
    this.switch(sx, s0 + Math.floor(3 * pitch + 0.5), 'fwd', 'rev', !!p.dirFollow, () => this.set({ dirFollow: p.dirFollow ? 0 : 1 }));
    // helper knobs (a parallelogram) and the grain knob between them and the switches
    const kr = 16, hhs = Math.max(2, Math.floor(kr * 0.12)), x2 = r - kr, x1 = x2 - 74, rz = 30;
    const ya = ct + kr + hhs, yb = b - kr - rz, bus = x1 - kr - 4 - 28 - 6;
    const gr = 34, gB = Math.floor((ct + b) / 2), gcy = gB - Math.max(2, Math.floor(gr * 0.12)) / 2;
    const tw = this.tw('grain', F6);
    const gx = bus - 30 - (gr + 8 + tw + 6), glo = gr + 22, gap = gx - (gr + 14) - swr;
    this.knob(gx, gcy, gr, 'glenMs', true, 'grain');
    if (IMG.tbk_mark) this.blit('tbk_mark', swr + Math.floor((gap - IMG.tbk_mark.width) / 2), gB - Math.floor(IMG.tbk_mark.height / 2));
    this.dline(gx + glo + tw + 6, gB, bus, gB); this.dline(bus, ya + rz, bus, yb + rz);
    this.dline(bus, ya + rz, x1 - kr - 2, ya + rz); this.dline(bus, yb + rz, x1 - kr - 2, yb + rz);
    const iy = ya + rz - hhs - kr - 2;
    this.dline(x1, iy, x1, ya); this.dline(x1, ya, x2 - kr - 2, ya);
    this.knob(x1, ya + rz - hhs / 2, kr, 'jitMs', false, 'jitter', 6);
    this.knob(x2, ya - hhs / 2, kr, 'jitOff', false, 'jitter off', 6);
    this.knob(x1, yb + rz - hhs / 2, kr, 'wsolaMs', false, 'wsola', 6);
    this.knob(x2, yb - hhs / 2, kr, 'smooth', false, 'smooth', 7);
    // the key as it sounds, in its black well over 'grain' (only with a sample)
    if (this.audio) {
      const krx = gx + glo - 22, kry = ct - 4, key = p.key || 0;
      const kn = (this.slotAudio[this.cur] && this.slotAudio[this.cur].key) || '-';
      // (mirrored: the well's mirrored picture, the key and its shift on the other sides; JSFX 8148-8154)
      const mr = this.mr;
      this.box(krx, 126, () => {
        this.blit('key_well', krx, kry, mr ? 126 : 0, 0, 126, 48);
        let kf = F9; if (this.tw(kn, kf) > 38) kf = F6;
        this.text(kn, Math.floor(krx + (mr ? 126 - 52 : 52) - this.tw(kn, kf) / 2), kry + 18 - Math.floor(kf.h / 2) + 1, kf, kn === '-' ? grey(0.50) : key ? this.lamp : grey(0.92));
        const kd = key && kn !== '-' ? (key > 0 ? '+' : '') + key : 'key';
        this.text(kd, Math.floor(krx + (mr ? 126 - 92 : 92) - this.tw(kd, F5) / 2), kry + 10, F5, kd === 'key' ? grey(0.55) : this.lamp);
        this.hit(krx, kry, 126, 48, { reset: () => this.set({ key: 0 }), wheel: (k) => this.set({ key: clamp((p.key || 0) + k, -12, 12) }), help: 'key' });
      });
    }
  }

  drawPlatter(s, frame, cx = 488 + 16 + 4 + 100, cy = 60 + 100, short = false) {
    const R = 100;
    this.box(cx - R - 6, 2 * R + 12, () => {
      if (!short) this.drawPitchBar(cx, R);
      this.drawRecord(s, frame, cx, cy, R, short);
    });
  }
  drawPitchBar(cx, R, fy = 288 - 8) {
    // pitch ─ tape bar under the record (drawn first: the record's picture comes over it)
    const w1 = this.tw('pitch', F1), w2 = this.tw('tape', F1), th = F1.h;
    const bx0 = cx - R + w1 + 8, bx1 = cx + R - w2 - 8, v = this.p.pitchBar || 0;
    this.text('pitch', cx - R - 1, fy - Math.floor(th / 2), F1, grey(0.92)); this.text('tape', cx + R - w2 + 1, fy - Math.floor(th / 2), F1, grey(0.92));
    this.rect(bx0, fy - 2, bx1 - bx0 + 1, 5, grey(0.05)); this.line(bx0, fy + 3, bx1, fy + 3, grey(0.45));
    for (let i = 0; i <= 10; i++) { const x = Math.floor(bx0 + (bx1 - bx0) * i / 10 + 0.5); this.line(x, fy - 13, x, fy - 10, grey(0.36)); }
    const fc = Math.floor(bx0 + (bx1 - bx0) * v + 0.5);
    if (!this.blit('fader_cap', fc - 5, fy - 9)) this.rect(fc - 5, fy - 4, 11, 9, grey(0.8));
    this.hit(bx0 - 8, fy - 13, bx1 - bx0 + 16, 21, {
      down: () => ({ v0: this.p.pitchBar || 0 }),
      drag: (dx, dy, e, st) => this.set({ pitchBar: clamp(st.v0 + dx / (bx1 - bx0) * (e.shiftKey ? 0.1 : 1), 0, 1) }),
      reset: () => this.set({ pitchBar: 0 }), help: 'pitchBar',
    });
  }
  drawRecord(s, frame, cx, cy, R, short) {
    const g = this.g;
    if (!this.blit('platter', cx - R - 6, cy - R - 6)) { g.fillStyle = '#222'; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill(); }
    // the deck's picture in the label: a 64 × 64 grid of the middle square, as the JSFX's (squares wholly inside the
    // circle as one rect, those across its edge pixel by pixel with a 1 px soft edge)
    const PV = 62, pvOn = !!frame;
    if (pvOn) {
      const sq = this.pvC || (this.pvC = Object.assign(document.createElement('canvas'), { width: 64, height: 64 }));
      const sg = sq.getContext('2d', { willReadFrequently: !this.mobile }), fw = frame.width, fh = frame.height, m = Math.min(fw, fh);
      sg.imageSmoothingEnabled = true; sg.imageSmoothingQuality = 'high';
      sg.drawImage(frame, (fw - m) / 2, (fh - m) / 2, m, m, 0, 0, 64, 64);
      if (this.mobile) {   // the phone: the 64 x 64 picture in one go inside a round clip (the square by square way
        // below took 6 of the 9 ms a frame on a Pixel 4a, and a slow frame holds back the finger's moves too)
        g.save(); g.beginPath(); g.arc(cx, cy, PV, 0, 2 * Math.PI); g.clip();
        g.drawImage(sq, cx - PV, cy - PV, 2 * PV, 2 * PV); g.restore();
      }
      const px = this.mobile ? null : sg.getImageData(0, 0, 64, 64).data, d = 2 * PV / 64;
      for (let j = 0; px && j < 64; j++) {
        const y0 = Math.floor(cy - PV + j * d), y1 = Math.floor(cy - PV + (j + 1) * d);
        for (let i = 0; i < 64; i++) {
          const x0 = Math.floor(cx - PV + i * d), x1 = Math.floor(cx - PV + (i + 1) * d);
          const ddx = Math.max(Math.abs(x0 - cx), Math.abs(x1 - cx)), ddy = Math.max(Math.abs(y0 - cy), Math.abs(y1 - cy));
          const inside = ddx * ddx + ddy * ddy <= (PV - 1) ** 2;
          const ox = Math.max(0, x0 - cx, cx - x1), oy = Math.max(0, y0 - cy, cy - y1);
          if (ox * ox + oy * oy >= (PV + 1) ** 2) continue;
          const o = (j * 64 + i) * 4; g.fillStyle = `rgb(${px[o]},${px[o + 1]},${px[o + 2]})`;
          if (inside) { g.fillRect(x0, y0, x1 - x0, y1 - y0); continue; }
          for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
            const al = Math.max(0, Math.min(1, PV - Math.hypot(x + 0.5 - cx, y + 0.5 - cy) + 0.5));
            if (al > 0) { g.globalAlpha = al; g.fillRect(x, y, 1, 1); }
          }
          g.globalAlpha = 1;
        }
      }
    }
    this.sticker(cx, cy, R, pvOn ? PV : -1e9);
    // the metronome badge above the record (the web version has no metronome: never lit)
    if (!short) { if (this.mr) this.blit('key_badge', cx - 48 - 58, cy - 102, 58, 0, 58, 64); else this.blit('key_badge', cx + 48, cy - 102, 0, 0, 58, 64); }
    this.hit(cx - R, cy - R, 2 * R, 2 * R, {
      down: (e, mx, my) => {
        if ((mx - cx) ** 2 + (my - cy) ** 2 > R * R) return null;
        this.handDown(); return { platter: 1, ang: Math.atan2(my - cy, mx - cx) };
      },
      dragAbs: (mx, my, e, st) => {
        const d = Math.hypot(mx - cx, my - cy); if (d < 0.12 * R) return;
        const an = Math.atan2(my - cy, mx - cx); let da = an - st.ang; st.ang = an;
        da -= 2 * Math.PI * Math.round(da / (2 * Math.PI));
        if (this.audio) this.handMove(da / (2 * Math.PI) * 1.8 * this.audio.rate * (e.shiftKey ? 0.25 : 1));
      },
      up: () => this.handUp(), release: 1, help: 'platter',
    });
  }

  // the sticker: four white-painted triangle dents along the radius, pointing clockwise; the direction snaps to a slope
  // whose steps repeat evenly; lit like the record (bright in its highlight band through the top and the bottom)
  sticker(cx, cy, R, pvR) {
    const g = this.g, ang = -0.5 * Math.PI + 2 * Math.PI * (this.audio ? this.headNow() : 0) / 1.8;
    const c = Math.cos(ang), s = Math.sin(ang), xm = Math.abs(c) >= Math.abs(s);
    const sl = Math.atan(xm ? Math.abs(s) / Math.abs(c) : Math.abs(c) / Math.abs(s));
    let be = 9, n = 0, dn = 1;
    for (let k = 0; k < 7; k++) {
      const m = k === 0 ? 0 : k === 5 ? 2 : 1, e = [1, 5, 4, 3, 2, 3, 1][k];
      if (Math.abs(Math.atan(m / e) - sl) < be) { be = Math.abs(Math.atan(m / e) - sl); n = m; dn = e; }
    }
    let ux = (xm ? dn : n) * (c >= 0 ? 1 : -1), uy = (xm ? n : dn) * (s >= 0 ? 1 : -1);
    const ul = Math.sqrt(ux * ux + uy * uy); ux /= ul; uy /= ul;
    const M = new Uint8Array(17 * 17);
    for (let k = 0; k < 4; k++) {
      const q = R * (0.45 + 0.14 * k);
      if (q < pvR + 6) continue;
      const lit = Math.min(0.95, 0.38 + 0.55 * Math.abs(uy) ** 14 * Math.sqrt((q - 34) / 61) - 0.06 * uy);
      const mx = Math.floor(cx + q * ux) - 8, my = Math.floor(cy + q * uy) - 8;
      M.fill(0);
      for (let j = -3, jn = 0; jn < 13; jn++, j += 0.5) {
        for (let o = -1.5; o <= 2.5 - Math.abs(j) * 1.34; o += 0.5) {
          const px = Math.floor(cx + (q + j + 0.25) * ux - (o + 0.25) * uy) - mx, py = Math.floor(cy + (q + j + 0.25) * uy + (o + 0.25) * ux) - my;
          if (px >= 0 && px < 17 && py >= 0 && py < 17) M[py * 17 + px] = 1;
        }
      }
      for (let py = 0; py < 17; py++) for (let px = 0; px < 17; px++) {
        if (!M[py * 17 + px]) continue;
        const up = py > 0 ? M[(py - 1) * 17 + px] : 0, dw = py < 16 ? M[(py + 1) * 17 + px] : 0;
        const ex = (px < 16 ? !M[py * 17 + px + 1] : 1) - (px > 0 ? !M[py * 17 + px - 1] : 1), ey = !dw - !up;
        const sh = ey ? ey / Math.sqrt(ex * ex + ey * ey) : 0;
        g.fillStyle = '#fff'; g.globalAlpha = lit; g.fillRect(mx + px, my + py, 1, 1);
        if (sh < 0) { g.fillStyle = '#000'; g.globalAlpha = -0.55 * sh; g.fillRect(mx + px, my + py, 1, 1); }
        if (sh > 0) { g.fillStyle = '#fff'; g.globalAlpha = 0.35 * sh; g.fillRect(mx + px, my + py, 1, 1); }
      }
    }
    g.globalAlpha = 1;
  }

  // g_button: silver push button of the bottom bar
  button(x, y, w, h, label, act, help) {
    const dn = this.pressed('b:' + help);
    this.block(x, y, w, h, 1, dn ? 0.15 : 0.45, dn ? 0.5 : 1.0, dn);
    this.ctext(label, x + w / 2, y + 2, F1, grey(0.10));
    this.hit(x, y, w, h, { down: () => ({ press: 'b:' + help }), up: act, help });
  }

  drawBottom(s) {
    const y = H - 27, smN = 8;
    this.button(W - 24 - 56, y, 56, 20, t('setup'), () => this.app.showSetup(this.d), 'setup');
    this.button(W - 24 - 56 - 6 - 48, y, 48, 20, t('help'), () => this.app.showHelp(), 'help');
    // sample buttons 1-8 (g_sm_btns): the one in use pressed in with its number lit; an empty one's number faint.
    // Click = switch (empty = load a file there); right-click = empty it
    const smx = W - 24 - 56 - 6 - 48 - 10 - (smN * 22 - 2);
    this.box(smx, smN * 22 - 2, () => {
    for (let k = 0; k < smN; k++) {
      const bx = smx + k * 22, has = !!this.slotAudio[k], on = k === this.cur, dn = on || this.pressed('sm' + k);
      this.block(bx, y, 20, 20, 1, dn ? 0.15 : 0.45, dn ? 0.5 : 1.0, dn);
      this.ctext(String(k + 1), bx + 10, y + 3, F4, on ? this.lamp : grey(has ? 0.10 : 0.55));
      this.hit(bx, y, 20, 20, {
        down: (e) => {
          if (e.button === 2 && has) { this.slotAudio[k] = null; this.app.unloadSlot(this.d, k); return { none: 1 }; }
          return { press: 'sm' + k };
        },
        up: () => (has ? this.call('switchSlot', k) : this.app.openFile(this.d, k)), help: has ? 'slot' : 'load',
      });
    }
    });
    // crossfader (shown only): "A" slot "B"; the slot glows as loud as this deck's crossfader gain
    const xfw = 100, xfx = smx - 10 - xfw, xfy = H - 17, side = this.d === 0 ? 1 : 2;
    const xs0 = xfx + 12, xs1 = xfx + xfw - 12;
    this.box(xfx, xfw, () => {
    this.text('A', xfx, H - 24, F1, grey(side === 1 ? 0.10 : 0.55));
    this.rtext('B', xfx + xfw, H - 24, F1, grey(side === 2 ? 0.10 : 0.55));
    this.rect(xs0, xfy - 2, xs1 - xs0 + 1, 5, grey(0.05)); this.line(xs0, xfy + 3, xs1, xfy + 3, grey(0.97));
    this.rect(xs0 + 1, xfy - 1, xs1 - xs0 - 1, 3, this.lamp, 0.15 + 0.85 * clamp(s.xfGoal ?? s.xfGain ?? 1, 0, 1));
    const xm = Math.floor((xs0 + xs1) / 2); this.line(xm, xfy - 7, xm, xfy - 4, grey(0.45));
    const xc = Math.floor(xs0 + (xs1 - xs0) * this.app.xf + 0.5);
    this.block(xc - 4, xfy - 7, 8, 14, 0, 0.30, 0.95, 0);
    this.line(xc, xfy - 5, xc, xfy + 4, grey(0.15));
    });
    // status text: a message, the hover help, or the deck's line; too long = it moves (g_fittext)
    const now = performance.now();
    const st = now - this.msgT < 2000 ? this.msg : this.hover ? t('h_' + this.hover)
      : `${t('deck')} ${side === 1 ? 'A' : 'B'}   |   ${this.name || t('noSample')}   |   ${t('keysHint')}`;
    const fw = smx - 8 - 24 - xfw - 10;
    this.box(24, fw, () => this.fittext(st, 24, H - 24, fw, grey(0.15)));
  }

  // g_fittext: a text too long for maxw waits 1 s, moves left a character every 0.08 s until its end shows, waits 1.5 s
  fittext(str, x, y, maxw, col) {
    const chars = Array.from(str), n0 = chars.length, mq = this.mq;
    if (this.tw(str, F1) <= maxw) { this.text(str, x, y, F1, col); return; }
    const now = performance.now() / 1000;
    if (mq.s !== str) {
      mq.s = str; mq.t0 = now; mq.k = 0;
      while (mq.k < n0 && this.tw(chars.slice(mq.k).join(''), F1) > maxw) mq.k++;
    }
    let tt = now - mq.t0;
    if (tt > 1 + mq.k * 0.08 + 1.5) { mq.t0 = now; tt = 0; }
    const k = tt < 1 ? 0 : Math.min(mq.k, Math.floor((tt - 1) / 0.08));
    let n = n0 - k;
    while (n > 0 && this.tw(chars.slice(k, k + n).join(''), F1) > maxw) n--;
    this.text(chars.slice(k, k + n).join(''), x, y, F1, col);
  }

  // ---------- the phone's short deck (MW x MH): the frame from the wide picture's four corners, tempo and sync on the
  // top bar, the waveform, the record, hot cues 1-8, CUE and PLAY, the sample's name on the bottom bar. Left out: the
  // knobs, the lamps and readouts, memory cues, Q, slip, the sample buttons, help and setup (user's choice 2026-10-20:
  // one deck at a time, A / B tabs above it)
  drawMobile(s, frame) {
    const g = this.g, hw = MW / 2, hh = MH / 2, tex = IMG.tex_front_wide;
    if (tex) {
      const tw = tex.width, th = tex.height;
      g.drawImage(tex, 0, 0, hw, hh, 0, 0, hw, hh); g.drawImage(tex, tw - hw, 0, hw, hh, hw, 0, hw, hh);
      g.drawImage(tex, 0, th - hh, hw, hh, 0, hh, hw, hh); g.drawImage(tex, tw - hw, th - hh, hw, hh, hw, hh, hw, hh);
    } else { this.rect(0, 0, MW, MH, '#b4b9bf'); this.rect(16, 44, MW - 32, MH - 80, '#10141a'); }
    if (IMG.reascratch_logo) this.blit('reascratch_logo', 24, Math.max(1, Math.floor((44 - IMG.reascratch_logo.height) / 2)));
    // top bar: tempo (drag sideways, double-tap = 0) and sync; their touch areas taller than the picture
    const BY = 16, BH = 18, sbx = MW - 24 - 40, te = s.tempo || 0, tew = this.tw('+50.00%', F5) + 10, terx = sbx - 8 - tew;
    this.readout(terx, BY + 1, tew, BH - 2, '', `${te >= 0 ? '+' : ''}${te.toFixed(2)}%`, te !== 0);
    this.hit(terx, BY - 8, tew, BH + 16, {
      down: () => ({ tempo0: this.p.tempo || 0 }),
      drag: (dx, dy, e, st) => this.set({ tempo: clamp(st.tempo0 + dx / 200 * 2 * (this.p.range || 16), -50, 50) }),
      reset: () => this.set({ tempo: 0 }), help: 'tempo',
    });
    this.blit('sync_buttons', sbx - 14, BY - 14, 0, (this.pressed('sync') ? 2 : s.sync ? 1 : 0) * 50, 68, 50);
    this.hit(sbx, BY - 8, 40, BH + 16, { down: () => ({ press: 'sync' }), up: () => this.app.toggleSync(this.d), help: 'sync' });
    // Q and slip between the logo and tempo, the desktop's pictures (asked for on the phone, user 2026-10-20)
    const p = this.p, qbx = 150, slx = qbx + 26 + 6;
    this.blit('quant_buttons', qbx - 14, BY - 14, 0, (this.pressed('q') ? 2 : p.quant ? 1 : 0) * 50, 54, 50);
    this.hit(qbx - 3, BY - 8, 32, BH + 16, { down: () => ({ press: 'q' }), up: () => this.set({ quant: p.quant ? 0 : 1 }), help: 'quant' });
    this.blit(p.slip ? 'slip_on' : 'slip_off', slx - 12, BY - 14);
    this.hit(slx - 3, BY - 8, 50, BH + 16, { up: () => this.set({ slip: p.slip ? 0 : 1 }), help: 'slip' });
    // the waveform (overview = needle search, zoom = scratch) and the record
    this.drawWave(s, 24, 52, MW - 48, 100);
    // mirrored: the record (x 24..224) to the right, the pads (x 238..336) to the left
    const mr = this.mirrored(); this.mr = false;   // (the record's own pictures as they are)
    this.shift(mr ? 112 : 0, () => {
      this.drawPlatter(s, frame, 124, 264, true);
      // pitch ─ tape under the record (asked for on the phone, user 2026-10-20: the deck is 22 px taller for it)
      this.drawPitchBar(124, 100, 394);
    });
    this.shift(mr ? -214 : 0, () => {
    // right of the record: hot cues 1-8 (two columns), CUE (CDJ style), PLAY
    const bx = 238, bw = MW - 24 - bx, cw = Math.floor((bw - 6) / 2);
    for (let n = 0; n < 8; n++) {
      const x = bx + (n % 2) * (cw + 6), y = 160 + Math.floor(n / 2) * 34, set = s.hot[n] >= 0, held = !!this.heldBy((d) => d.hc === n);
      this.pad(x, y, cw, 28, String(n + 1), F6, grey(set ? 0.10 : 0.55), held, set ? HC_COL[n] : null);
      this.hit(x, y, cw, 28, {
        down: () => {
          if (this.onPad && this.onPad(n, 1, false)) return { hc: n };
          if (this.hcDel) { if (set) { this.call('hcDelete', n); this.hcDel = false; } return { none: 1 }; }
          this.call('hcPress', n); return { hc: n };
        },
        up: () => { if (!(this.onPad && this.onPad(n, 0, false))) this.call('hcRelease', n); }, release: 1, help: 'hotcue',
      });
    }
    this.pad(bx, 298, bw, 34, 'CUE', F6, grey(0.10), this.pressed('cue'), null);
    this.hit(bx, 298, bw, 34, { down: () => { this.call('cuePress'); return { press: 'cue' }; }, up: () => this.call('cueRelease'), release: 1, help: 'cue' });
    this.pad(bx, 338, bw, 38, 'PLAY', F6, grey(0.10), this.pressed('play'), s.playing ? this.lamp : null);
    this.hit(bx, 338, bw, 38, { down: () => ({ press: 'play' }), up: () => this.call('playBtn'), help: 'play' });
    });
    // bottom bar: delete (lit = the next hot cue tapped is cleared: the phone has no right-click or Shift; user's
    // report 2026-10-20), then a message, the delete hint, or the deck and its sample
    const dx = MW - 24 - 56, dy = MH - 27, on = !!this.hcDel;
    this.block(dx, dy, 56, 20, 1, on ? 0.15 : 0.45, on ? 0.5 : 1.0, on);
    this.ctext('delete', dx + 28, dy + 2 + (on ? 1 : 0), F1, on ? '#c0392b' : grey(0.10));
    this.hit(dx, dy - 6, 56, 32, { up: () => { this.hcDel = !this.hcDel; }, help: 'hcDel' });
    // loop (the desktop's end / loop switch; the phone had no way to stop at the end, user's question 2026-10-20)
    const lx = dx - 6 - 44, lp = !!(this.p.loop ?? 1);
    this.pad(lx, dy, 44, 20, 'loop', F1, grey(0.10), lp, lp ? this.lamp : null);
    this.hit(lx, dy - 6, 44, 32, { up: () => this.set({ loop: lp ? 0 : 1 }), help: 'end' });
    const st = on ? t('hcDelHint') : performance.now() - this.msgT < 2000 ? this.msg
      : `${t('deck')} ${this.d ? 'B' : 'A'}   |   ${this.app.loading[this.d] || this.name || t('noSample')}${this.latText()}`;
    this.fittext(st, 24, MH - 24, lx - 8 - 24, grey(0.15));
  }
  // the sound's output delay on the phone's bottom bar, always (the 2 s message at the start was missed on a phone)
  latText() {
    const c = this.app.ctx; if (!c) return '';
    return `   |   ${Math.round(((c.outputLatency || 0) + (c.baseLatency || 0)) * 1000)} ms`;
  }
  // a silver push button with a label, tinted (a hot cue's colour, PLAY's lamp) when lit
  pad(x, y, w, h, label, f, col, dn, tint) {
    this.block(x, y, w, h, 1, dn ? 0.15 : 0.45, dn ? 0.5 : 1.0, dn);
    if (tint) this.rect(x + 2, y + 2, w - 4, h - 4, tint, dn ? 0.75 : 0.6);
    this.ctext(label, x + w / 2, y + Math.floor((h - f.h) / 2) + (dn ? 1 : 0), f, col);
  }

  // ---------- mouse ----------
  pt(e) {
    const r = this.cv.getBoundingClientRect();
    return [(e.clientX - r.left) * this.W / r.width, (e.clientY - r.top) * this.H / r.height, r.width / this.W];
  }
  find(mx, my) { for (let i = this.hits.length - 1; i >= 0; i--) { const h = this.hits[i]; if (mx >= h.x && mx < h.x + h.w && my >= h.y && my < h.y + h.h) return h; } return null; }
  down(e) {
    this.app.setActive(this.d);
    const [mx, my] = this.pt(e), h = this.find(mx, my);
    if (!h) return;
    e.preventDefault();
    const now = performance.now();
    if (h.reset && (e.button === 2 || (this.lastDown && this.lastDown.h === h.help && now - this.lastDown.t < 300))) { h.reset(); this.lastDown = null; return; }
    this.lastDown = { h: h.help, t: now };
    const st = h.down ? h.down(e, mx - (h.ox || 0), my) : {};
    if (st === null) return;
    if (st && st.none) return;
    try { this.cv.setPointerCapture(e.pointerId); } catch (err) { /* a pointer already gone */ }
    this.drags.set(e.pointerId, { h, x: e.clientX, y: e.clientY, mx, my, lx: e.clientX, ...(st || {}) });
  }
  move(e) {
    const [mx, my, sc] = this.pt(e);
    const d = this.drags.get(e.pointerId);
    if (!d) { if (e.pointerType === 'mouse') { const h = this.find(mx, my); this.hover = h ? h.help : null; this.cv.style.cursor = h ? 'pointer' : 'default'; } return; }
    const h = d.h;
    if (h.drag) h.drag(e.clientX - d.x, e.clientY - d.y, e, d);
    if (h.dragAbs) h.dragAbs(mx - (h.ox || 0), my, e, d);
    // (in canvas pixels: the deck is often shown at another size than 744, 496 CSS px at 150 %)
    if (h.dragPx) { h.dragPx((e.clientX - d.lx) / sc, e); d.lx = e.clientX; }
  }
  up(e, cancel = false) {
    const d = this.drags.get(e.pointerId);
    if (!d) return;
    const h = d.h; this.drags.delete(e.pointerId);
    if (h.up && (!cancel || h.release)) h.up(e);
  }
  wheel(e) {
    const [mx, my] = this.pt(e), h = this.find(mx, my);
    if (h && h.wheel) { e.preventDefault(); h.wheel(e.deltaY < 0 ? (e.shiftKey ? 10 : 1) : (e.shiftKey ? -10 : -1)); }
  }
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// ReaScratch Web — one deck's audio engine, ported from kit/Effects/ReaScratch/reascratch.jsfx (@sample/@block).
// Runs inside the AudioWorklet (worklet/processor.js) and under node for the tests (web/test/).
// Units as in the JSFX: "frames" = file frames at fsr, "samples" = output samples at srate.
// Line numbers (Lnnnn) point at reascratch.jsfx so the two can be compared.

import { DeckFX, FX_DEFAULTS } from './fx.js';
import { PATTERNS, PAD_DEFAULT, PT_POS, PT_FAD } from './patterns.js';

export const NSLOT = 8;
const PS_NONE = -1000000000;          // L812: "no WSOLA reference"
const NB_AMT = 0.1, NB_COAST = 0.15;  // L932: untouched rim bend amount, ticks dropped after release
const SEEK_SNIP = 0.08;               // needle search: jump every 80 ms
const Q_LATE = 0.03;                  // quantize: a press up to 30 ms late fires at once
const GB_MAX = 2040;                  // L1430: a beat map's anchors at most

export const DEFAULTS = {
  smooth: 15,      // s11 head smoothing (ms)
  glenMs: 50,      // s18 grain length (ms)
  overlap: 4,      // s19
  dirFollow: 0,    // s20 grain direction follows motion (only at pitchBar 0)
  wsolaMs: 10,     // s21
  jitMs: 8,        // s22 freeze jitter
  jitOff: 0.15,    // s23
  loop: 1,         // s5 at end: 0 stop / 1 loop
  pitchBar: 0,     // s52 0 pitch-locked .. 1 tape
  spinRel: 0.25,   // s53 spin on release (s to lose 1.8x)
  slip: 0,         // s54
  brake: 0,        // s57 brake on stop (s)
  brakeBeats: 0,   // s232 "Brake (beats):" 0-4 step 0.25: the brake in beats of this deck's BPM at the speed it plays; 0 = brake (s)
  pzQ: 0,          // s233 "PAUSE quantize:" 0 Off / 1 1 beat / 2 1/2 beat (8th) / 3 1/4 beat (16th): with Quantize on, PLAY to stop waits for it
  swing: 50,       // s109 "Swing (16th, %):" 50-75: the off-beat 16th lands late while playing (50 = straight, 67 = triplet)
  startT: 0,       // s58 start on play (s)
  sbSpeed: 3,      // s59 spinback speed (x)
  sbTime: 1,       // s60 spinback time (s)
  bpm: 0,          // s63
  grid: 0,         // s64 a beat (s)
  tempo: 0,        // s89 (%)
  key: 0,          // s217 (semitones)
  holdMs: 300,     // s49 hot cue hold
  quant: 0,        // Quantize on (the JSFX's s40 is inverted; here 1 = on)
  spt: 400,        // CV[9] jog ticks per second at 1x
  xfSide: 0,       // s33 0 off / 1 left / 2 right
  cutIn: 2,        // s36 (%)
  fadeW: 30,       // s37 (%)
  xfCurve: 1,      // s77 0 linear / 1 equal power
  mute: 0,        // s196 the mute (main sound off; the page takes the picture off too)
  vol: 1,          // channel fader (already squared)
  // the metronome (L1530-L1556, setup More > Metronome rows 320-324). mtMode / mtHold / mtVol and (modes 0 / 1) mtOn are
  // deck A's (id 0), as the JSFX keeps them in deck A (gmem [390..394]); deck B's own mtOn counts only in mode 2.
  mtOn: 0,         // row 320 "Metronome:" off / on (N key, the METRONOME button CV[259])
  mtMode: 0,       // row 321 "Metronome follows:" 0 the playing deck / 1 the SYNC base deck / 2 each deck
  mtHold: 0,       // row 323 "Stopped / in hand:" 0 keeps time at its BPM / 1 silent
  mtVol: -12,      // row 324 "Metronome volume:" -30..0 dB
  // row 322 "Metronome out:" 0 the headphones only (the cue output, processor.js outputs[1]) / 1 the headphones and the
  // main (mt_out L1535, mt_main L5319; deck A's). The JSFX's default is 0; here 1, so a page with one output (no cue
  // output) still hears the click on the main as before
  mtOut: 1,
  pfl: 0,          // s116 "Cue (headphones)": 0 off / 1 on: this deck's sound before the crossfader and the channel fader goes to the cue output (L5974-L5977)
};

export class Deck {
  constructor(srate, id = 0) {
    this.id = id;
    this.srate = srate;
    this.p = { ...DEFAULTS };
    this.ch = [new Float32Array(0), new Float32Array(0)];
    this.len = 0;
    this.fsr = srate;
    // grain voices (L616-L618)
    this.vRp = new Float64Array(NSLOT);   // vp[0] read position
    this.vAge = new Float64Array(NSLOT);  // vp[8]
    this.vDir = new Float64Array(NSLOT);  // vp[16]
    this.vAct = new Uint8Array(NSLOT);    // vp[24]
    this.vLen = new Float64Array(NSLOT);  // vp[32]
    this.vFol = new Uint8Array(NSLOT);    // vp[40]
    this.vFade = new Float64Array(NSLOT); // vp[48]
    this.vStep = new Float64Array(NSLOT); // vp[56]
    this.nextv = 0;
    this.playing = 0;          // slider3
    this.cue = 0;              // slider4 (s)
    this.hot = new Float64Array(8).fill(-1);   // s42-45, s110-113 (s)
    this.touched = 0; this.uiTouch = 0; this.kbTouch = 0; this.tch = 0;
    this.autoTouch = 0; this.jogIdle = 0; this.autoRel = 0.15;
    this.jq = [];              // relative jog moves this block (frames)
    this.nbRem = 0; this.nbFree = 1e9;
    this.uiGoal = 0; this.uiGen = 0; this.uiSeen = 0; this.uiPos = 0; this.uiRate = 0; this.uiCnt = 0; this.uiAvg = 1600; this.uiWas = 0;
    this.seek = 0; this.seekGoal = 0; this.seekCnt = 0; this.seekFirst = 0;
    this.xfPos = 0.5; this.xfGain = 1; this.kbCut = 0;
    this.gain = 0; this.ended = 0;
    this.slipOn = 0; this.slipPos = 0; this.slipTch = 0;
    this.cueHeld = 0; this.cuePrev = 0; this.cueKeep = 0;
    this.hcHeld = 0; this.hcT = 0; this.hcKeep = 0; this.hcRet = 0; this.hcRetPlay = 0;
    this.qAct = 0; this.qAt = 0; this.qN = 0;
    this.kshift = 1;
    this.lpA = 0; this.lpB = 0; this.lpL = 0; this.lpNeg = 0;
    this.other = null;         // the other deck (SYNC, quantized play)
    this.syncOn = 0; this.teK = 1; this.nudgeDir = 0;
    this.fx = new DeckFX(srate);   // sound effects and DJ filter (fx.js)
    this.slots = new Array(8).fill(null); this.cur = 0; this.smJump = 0;
    this.jspV = 0; this.jrgV = 0; this.jrgT = 1e9;   // CDJ jog top speed / ring (mode 5, L937)
    this.vSlot = new Int8Array(NSLOT);   // vp[64]: the sample each grain reads
    this.mc = [];              // memory cues (s), sorted (MC, L1881)
    this.blOn = 0; this.blA = 0; this.blB = 0; this.blBeats = 4; this.blHas = 0; this.blRoll = 0;
    this.rvOn = 0; this.rvF = 1; this.clock = 0; this.tt = []; this.ttLast = -1e9;
    // pad modes (midi.js): the BOUNCE / roll pad held (bl_pad), the SLICER pad held and its bar (sl_held, sl_d, sl_fix,
    // sl_s0, sl_idle; L1376), PITCH PLAY's key (pp_k, L945), the held move pads (apc_mv: apc_fwh / mvp / mvq / mvs, the
    // slowing down after one and the way back, apc_spd / apc_ret; L955), the mode in use (pdm_mode, for sl_idle L5527)
    // quantized PAUSE (L323, L1945-L1965): waiting, the place in the step seen last, samples left to it in this block
    this.pzWait = 0; this.pzLast = 0; this.pzCnt = 0; this.pzSrc = 0; this.pzF = 0; this.pzSps = 0;
    this.vmvLast = 0; this.moved = 0;   // the head moved this block (gmem[vfx_b + 6], L5299: the other deck "plays")
    // the metronome (L1541): its beat clock, the click's envelope / phase / pitch, active, the deck that clicks (deck A's)
    this.mtB = 0; this.mtEnv = 0; this.mtPh = 0; this.mtF = 0; this.mtAct = 0; this.mtSrc = 1; this.mtGt = -1e9;
    this.mtBps = 0; this.mtAmp = 0; this.mtHd = 0;
    this.blPad = -1; this.slHeld = -1; this.slD = 0; this.slFix = 0; this.slS0 = 0; this.slIdle = 0; this.ppK = 1;
    this.apcFwh = 0; this.apcMvp = -1; this.apcMvq = 0; this.apcMvs = 0; this.apcSpd = 0; this.apcRet = 0; this.padMode = 1;
    // the beat map of the slot in use (⚪176, L1421-L1466): {t, b} anchors (s, beats), null = one grid (bpm / grid);
    // the segment found last (gb_ci / gb_cj)
    this.gbm = null; this.gbCi = -1; this.gbCj = -1;
    // quantized PLAY from stop (pq_wait / pq_last, L322, L1956-L1964)
    this.pqWait = 0; this.pqLast = 0;
    // PATTERN pads (pt_*, L1729-L1795): the pads' patterns (an index into PATTERNS, or a pattern object), the one
    // playing / waiting for its beat, its clock (frames), anchor, fader, the beat it was pressed in, its swing
    this.ptPads = PAD_DEFAULT.slice(); this.ptOn = 0; this.ptReq = -1; this.ptK = 0; this.ptClk = 0; this.ptAt = 0; this.ptFval = 1;
    this.ptB0 = 0; this.ptSws = 0.5; this.ptPh = 0; this.ptPhw = 0; this.evBs = 0;
    this.pflG = 0;   // the cue's gain, fading 5 ms (pfl_g L5976)
    this.mtMain = 1;
    this.reset();
    this.srCalc();
  }

  reset() {
    this.target = 0; this.headMid = 0; this.headMid2 = 0; this.head = 0;
    this.hdV = 0; this.hdPrev = 0; this.hdTch = 0; this.spAvg = 0; this.spT = 0;
    this.pfPrev = 0; this.pfV = 0; this.pfA = this.p.pitchBar; this.pfR = 1; this.pfRk = 1;
    this.spinOn = 0; this.spinV = 0; this.spinR = 0;
    this.headGrain = 0; this.headLast = 0; this.hopcnt = 0;
    this.prevStart = PS_NONE; this.prevDir = 1; this.prevV = 0;
    this.vAct.fill(0);
    this.tpVs = 0; this.tpN = 0; this.tpC1 = [0, 0]; this.tpC2 = [0, 0];
    this.tpA1 = 1; this.tpA2 = 0; this.tpA3 = 0;
  }

  // time constants (apply_sliders L3406-L3412, grain_calc L2050-L2067)
  srCalc() {
    const sr = this.srate, p = this.p, fsr = this.fsr;
    this.smoothK = 1 - Math.exp(-1 / (Math.max(p.smooth, 0.1) * 0.0005 * sr));
    this.tpK = 1 - Math.exp(-1 / (0.01 * sr));
    this.tpVk = 1 - Math.exp(-1 / (0.005 * sr));
    this.spK = 1 - Math.exp(-1 / (0.08 * sr));   // (2026-10-22) the hand's speed before it lets go, over 80 ms (JSFX sp_k)
    this.tpXs = 1 / (0.005 * sr);
    this.nbK = 1 - Math.exp(-1 / (0.03 * sr));
    this.xfK = 1 - Math.exp(-1 / (0.001 * sr));
    this.spinA = p.spinRel > 0 ? 1.8 * fsr / sr / (p.spinRel * sr) : 0;
    this.brkA = p.brake > 0 ? fsr / sr / (p.brake * sr) : 0;
    this.stA = p.startT > 0 ? fsr / sr / (p.startT * sr) : 0;
    this.mtDk = Math.exp(-1 / (0.015 * sr));   // (L5320)
    this.pflSt = 1 / (0.005 * sr);              // (L4349)
    this.tpJump = 64 * fsr / sr;
    this.spt = fsr / Math.max(p.spt, 1);
    this.grainCalc();
  }

  grainCalc() {
    const p = this.p, fsr = this.fsr, sr = this.srate;
    this.glen = Math.max(16, Math.floor(p.glenMs * fsr / 1000));
    this.overlap = p.overlap >= 3 ? 4 : 2;
    this.hop = Math.max(4, Math.floor(this.glen / this.overlap * sr / fsr));
    this.hopF = this.hop * fsr / sr;
    this.outscale = 2 / this.overlap;
    this.srch = Math.floor(p.wsolaMs * fsr / 1000);
    this.jit = p.jitMs * fsr / 1000;
    this.jitFade = Math.max(p.jitOff, 0.01);
    this.glenSk = Math.max(16, Math.floor(0.08 * fsr));
    this.hopSk = Math.max(4, Math.floor(this.glenSk / this.overlap * sr / fsr));
  }

  set(params) {
    const fx = {};
    for (const k in params) if (k in FX_DEFAULTS) fx[k] = params[k];
    if (Object.keys(fx).length) this.fx.set(fx);
    // a BPM / grid changed by hand (typed, the setup page) drops the slot's beat map: one tempo again (L4586-L4591)
    if (this.gbm && (('bpm' in params && params.bpm !== this.p.bpm) || ('grid' in params && params.grid !== this.p.grid))) this.gbClear();
    Object.assign(this.p, params);
    if ('cue' in params) { this.cue = params.cue; }
    if ('tempo' in params) this.syncOn = 0;
    this.srCalc();
  }

  // ---- samples: up to 8 per deck (SM, L1983-L2160) ----
  // load a decoded sample (channels: Float32Array[], rate) into slot k; the slot in use (or the first load) is put on at once
  load(channels, rate, k = 0) {
    const sl = {
      ch: [channels[0], channels[1] || channels[0]], len: channels[0].length, fsr: rate,
      cue: 0, hot: new Float64Array(8).fill(-1), mc: [], bpm: 0, grid: 0, head: -1, gbm: null,
    };
    this.slots[k] = sl;
    if (k === this.cur || !this.slots[this.cur]) {
      this.cur = k;
      this.playing = 0;
      this.useSlot(k);
      this.reset();
      this.srCalc();
      this.cue = sl.cue = this.onset();
      this.hot.fill(-1); this.mc = []; this.p.bpm = 0; this.p.grid = 0; this.gbm = null; this.gbCi = this.gbCj = -1;
      this.jumpTo(this.cue * this.fsr);
      this.lpCalc();
    } else {
      // the onset of a slot not in use: computed on its own channels
      const n = Math.min(sl.len, 30 * rate), a = sl.ch[0], b = sl.ch[1];
      for (let i = 0; i < n; i++) if (Math.abs(a[i]) > 0.0056 || Math.abs(b[i]) > 0.0056) { sl.cue = Math.max(0, i / rate - 0.005); break; }
    }
  }
  useSlot(k) {   // sm_use (L2092): buffer, length and rate of slot k; grain sizes follow its rate (the ⚪97 bug)
    const sl = this.slots[k];
    this.ch = sl.ch; this.len = sl.len; this.fsr = sl.fsr;
    this.prevStart = PS_NONE;
    this.srCalc();
  }
  // the analysis of slot k came back (BPM, a beat, loudness): into the slot, and onto the deck if it is in use
  slotMeta(k, bpm, grid, lufs) {
    const sl = this.slots[k];
    if (!sl) return;
    sl.bpm = bpm; sl.grid = grid; sl.lufs = lufs;
    if (k === this.cur) { this.p.bpm = bpm; this.p.grid = grid; this.lpCalc(); this.fx.set({ lufs: lufs || 0 }); }
  }
  slotSave() {
    const sl = this.slots[this.cur];
    if (!sl) return;
    sl.cue = this.cue; sl.hot = Float64Array.from(this.hot); sl.mc = this.mc.slice();
    sl.bpm = this.p.bpm; sl.grid = this.p.grid; sl.head = this.head / this.fsr; sl.gbm = this.gbm;
  }
  // sm_switch (L2339-L2362): keep where each slot was left; old grains go on reading the old sample until they fade
  switchSlot(k) {
    if (k === this.cur || !this.slots[k]) return;
    this.slotSave();
    this.qAct = 0; this.slipOn = 0; this.hcHeld = 0; this.cueHeld = 0; this.spinOn = 0; this.seek = 0; this.blOn = 0; this.blRoll = 0; this.blPad = -1;
    this.ptOn = 0; this.ptReq = -1;
    const sl = this.slots[k];
    this.cur = k;
    this.useSlot(k);
    this.cue = sl.cue; this.hot = Float64Array.from(sl.hot); this.mc = sl.mc.slice();
    this.p.bpm = sl.bpm; this.p.grid = sl.grid; this.gbm = sl.gbm || null; this.gbCi = this.gbCj = -1;
    this.fx.set({ lufs: sl.lufs || 0 });
    this.lpCalc();
    this.jumpTo((sl.head >= 0 ? sl.head : sl.cue) * this.fsr);
    this.runAt(this.playing ? this.te1x() : 0);
    this.smJump = 1;
  }
  unloadSlot(k) {
    this.slots[k] = null;
    if (k === this.cur) {
      const other = this.slots.findIndex((x) => x);
      if (other >= 0) { this.cur = -1; this.switchSlotFrom(other); } else { this.len = 0; this.playing = 0; this.cur = 0; }
    }
  }
  switchSlotFrom(k) { this.cur = k; this.useSlot(k); const sl = this.slots[k]; this.cue = sl.cue; this.hot = Float64Array.from(sl.hot); this.mc = sl.mc.slice(); this.p.bpm = sl.bpm; this.p.grid = sl.grid; this.gbm = sl.gbm || null; this.gbCi = this.gbCj = -1; this.lpCalc(); this.jumpTo((sl.head >= 0 ? sl.head : sl.cue) * this.fsr); }

  // L2087: first sample over -45 dB within 30 s, less 5 ms
  onset() {
    const n = Math.min(this.len, 30 * this.fsr), a = this.ch[0], b = this.ch[1];
    for (let i = 0; i < n; i++) if (Math.abs(a[i]) > 0.0056 || Math.abs(b[i]) > 0.0056) return Math.max(0, i / this.fsr - 0.005);
    return 0;
  }

  te1x() { return (1 + this.p.tempo / 100) * this.fsr / this.srate; }   // L1421

  // beat grid (L1421-L1466): the slot's beat map when it has one (2 or more anchors (time s, beat), both rising: the
  // beats straight between anchors and on the end segments' slopes outside them), else one tempo (bpm, a beat at grid).
  // gbB(p) = beats at file frame p, gbP(b) its inverse (frames), bpmAt() = the BPM where the head is (before the tempo)
  gbSeg(ts) {   // gb_seg L1435: the segment i (anchors i, i + 1) for time ts
    const T = this.gbm.t, n = T.length, c = this.gbCi;
    if (c >= 0 && c < n - 1 && T[c] <= ts && ts < T[c + 1]) return c;
    let lo = 0, hi = n - 1;
    if (ts >= T[hi]) lo = n - 2;
    else while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T[m] <= ts) lo = m; else hi = m; }
    return (this.gbCi = lo);
  }
  gbSegB(b) {   // gb_segb L1443: the same by beats
    const B = this.gbm.b, n = B.length, c = this.gbCj;
    if (c >= 0 && c < n - 1 && B[c] <= b && b < B[c + 1]) return c;
    let lo = 0, hi = n - 1;
    if (b >= B[hi]) lo = n - 2;
    else while (hi - lo > 1) { const m = (lo + hi) >> 1; if (B[m] <= b) lo = m; else hi = m; }
    return (this.gbCj = lo);
  }
  gbBt(ts) {   // gb_bt L1451
    const m = this.gbm;
    if (!m) return (ts - this.p.grid) * this.p.bpm / 60;
    const i = this.gbSeg(ts), T = m.t, B = m.b;
    return B[i] + (ts - T[i]) * (B[i + 1] - B[i]) / (T[i + 1] - T[i]);
  }
  gbTb(b) {   // gb_tb L1456
    const m = this.gbm;
    if (!m) return this.p.grid + b * 60 / Math.max(0.0001, this.p.bpm);
    const i = this.gbSegB(b), T = m.t, B = m.b;
    return T[i] + (b - B[i]) * (T[i + 1] - T[i]) / (B[i + 1] - B[i]);
  }
  gbB(pos) { return this.gbBt(pos / Math.max(1, this.fsr)); }
  gbP(b) { return this.gbTb(b) * this.fsr; }
  bpmAt() {   // gb_bpm L1462
    const m = this.gbm;
    if (!m) return this.p.bpm;
    const i = this.gbSeg(this.head / Math.max(1, this.fsr));
    return 60 * (m.b[i + 1] - m.b[i]) / (m.t[i + 1] - m.t[i]);
  }
  // a beat map from the page (GBQ, L4593-L4601; reascratch_lib.lua gb_send): analysis.js's beatMap [[t, beat], ...], or
  // the beat times alone [t0, t1, ..] (beat i at ti; beat 0, 4, 8 .. start bars). Kept only while both rise; at most
  // GB_MAX anchors (more are cut off, as the JSFX reads them)
  static gbMake(map) {
    if (!map || !map.length) return null;
    const T = [], B = [];
    for (let i = 0; i < map.length && T.length < GB_MAX; i++) {
      const a = map[i], pair = a && typeof a === 'object' && a.length >= 2;
      const t = Number(pair ? a[0] : a), b = Number(pair ? a[1] : i);
      if (!Number.isFinite(t) || !Number.isFinite(b)) continue;
      if (T.length && (t <= T[T.length - 1] || b <= B[B.length - 1])) continue;
      T.push(t); B.push(b);
    }
    return T.length >= 2 ? { t: Float64Array.from(T), b: Float64Array.from(B) } : null;
  }
  // slot k's beat map (null / [] = one grid again); returns its anchors (0 = none). bpm / grid stay as slotMeta set them
  slotBeatMap(k, map) {
    const sl = this.slots[k];
    if (!sl) return 0;
    sl.gbm = Deck.gbMake(map);
    if (k === this.cur) { this.gbm = sl.gbm; this.gbCi = this.gbCj = -1; this.lpCalc(); }
    return sl.gbm ? sl.gbm.t.length : 0;
  }
  gbClear() { this.gbm = null; this.gbCi = this.gbCj = -1; if (this.slots[this.cur]) this.slots[this.cur].gbm = null; }   // gb_clear L2214
  // Shift+T with a map (gb_fix L2224-L2235): a beat is here (the nearest beat moves to the head; past either end of the
  // map one beat beyond it too); the one-tempo values follow (the BPM where the fix is, grid = the first bar from 0)
  gbFix() {
    const t = this.head / this.fsr, b = Math.floor(this.gbB(this.head) + 0.5), bl = 60 / Math.max(1, this.bpmAt());
    const T = this.gbm ? Array.from(this.gbm.t) : [], B = this.gbm ? Array.from(this.gbm.b) : [];
    const ins = (tt, bb) => {   // gb_ins L2215
      let i = 0;
      while (i < B.length && B[i] < bb - 0.001) i++;
      if (i < B.length && Math.abs(B[i] - bb) <= 0.001) { T[i] = tt; B[i] = bb; } else if (B.length < GB_MAX) { T.splice(i, 0, tt); B.splice(i, 0, bb); }
      while (i > 0 && T[i - 1] >= tt) { T.splice(i - 1, 1); B.splice(i - 1, 1); i--; }
      while (i < T.length - 1 && T[i + 1] <= tt) { T.splice(i + 1, 1); B.splice(i + 1, 1); }
    };
    if (!T.length) { T.push(t, t + bl); B.push(b, b + 1); }
    else { if (b > B[B.length - 1]) ins(t + bl, b + 1); else if (b < B[0]) ins(t - bl, b - 1); ins(t, b); }
    this.gbm = { t: Float64Array.from(T), b: Float64Array.from(B) }; this.gbCi = this.gbCj = -1;
    if (this.slots[this.cur]) this.slots[this.cur].gbm = this.gbm;
    this.p.bpm = Math.max(1, Math.min(300, this.bpmAt())); this.p.grid = this.gbTb(4 * Math.ceil(this.gbBt(0) / 4));
    this.lpCalc();
    return T.length;
  }
  // swing (s109, sw_k L1467): the speed factor at file frame pos (the half of the eighth it is in, on the beat grid)
  swK(pos) {
    const sw = this.p.swing;
    if (!(sw > 50 && this.p.bpm > 0 && this.fsr > 0)) return 1;
    let q = this.gbB(pos) * 2; q -= Math.floor(q);
    return q < 0.5 ? 0.5 / (sw / 100) : 0.5 / (1 - sw / 100);
  }
  // the position the picture shows (sw_vpos L1476): the swing taken back out, so the picture moves on evenly
  swVpos(pos) {
    const sw = this.p.swing;
    if (!(sw > 50 && this.p.bpm > 0 && this.fsr > 0)) return pos;
    const s = sw / 100;
    let q = this.gbB(pos) * 2; const f = q - Math.floor(q);
    q = Math.floor(q) + (f < 0.5 ? f * 2 * s : s + (f - 0.5) * 2 * (1 - s));
    return this.gbP(q / 2);
  }

  lpCalc() {   // L2075
    this.lpA = 0; this.lpB = Math.max(0, this.len - 1);
    if (this.p.loop && this.p.bpm > 0 && this.len > 2) {
      this.lpA = Math.max(0, Math.min(this.len - 2, this.cue * this.fsr));
      const b = this.gbB(this.lpA);
      const n = Math.max(1, Math.ceil((this.gbB(this.len - 1) - b) / 4 - 0.005));
      this.lpB = this.gbP(b + 4 * n);
    }
    this.lpL = this.lpB - this.lpA;
  }
  hdMax() { return this.p.loop && this.lpL > 1 ? Math.max(this.len - 1, this.lpB) : this.len - 1; }   // L2084

  lpWrap(p) {   // L2412
    if (this.p.loop && this.len > 2 && this.lpL > 1 && (p >= this.lpB || (p < this.lpA && this.lpNeg)))
      return this.lpA + (p - this.lpA) - Math.floor((p - this.lpA) / this.lpL) * this.lpL;
    return p;
  }
  rd(p, c) {
    p = this.lpWrap(p);
    if (p < 0 || p >= this.len - 1) return 0;
    const ip = Math.floor(p), fr = p - ip, b = this.ch[c];
    return b[ip] + (b[ip + 1] - b[ip]) * fr;
  }
  rd6(p, c) {   // 6-point Lagrange (L2432)
    p = this.lpWrap(p);
    if (p < 2 || p >= this.len - 4) return this.rd(p, c);
    const ip = Math.floor(p), d = p - ip, b = this.ch[c], o = ip - 2;
    const a = (d + 1) * d * (d - 1) * (d - 2) * (d - 3), bb = (d + 2) * d * (d - 1) * (d - 2) * (d - 3);
    const e = (d + 2) * (d + 1) * (d - 1) * (d - 2) * (d - 3), f = (d + 2) * (d + 1) * d * (d - 2) * (d - 3);
    const g = (d + 2) * (d + 1) * d * (d - 1) * (d - 3), h = (d + 2) * (d + 1) * d * (d - 1) * (d - 2);
    return -a / 120 * b[o] + bb / 24 * b[o + 1] - e / 12 * b[o + 2] + f / 12 * b[o + 3] - g / 24 * b[o + 4] + h / 120 * b[o + 5];
  }
  rdi(ip) { ip = this.lpWrap(ip); return ip < 0 || ip >= this.len ? 0 : this.ch[0][ip]; }

  // WSOLA (L2444-L2477). The same numbers as the JSFX's, read faster: the natural part once (not again for each
  // candidate), no function made per call, the sample read straight when no loop wraps it. It runs within one sample
  // when a grain starts: 5x a usual block on this PC, and Firefox on a phone dropped the sound now and then (user's
  // screen recording 2026-10-21)
  align(nominal, ndir, natural, pdir, wl, srch) {
    let best = nominal, bestc = -1e9;
    const n = Math.floor(wl / 8);
    if (!this.alR || this.alR.length < n) this.alR = new Float64Array(n + 64);
    const R = this.alR;
    for (let j = 0, i = 0; j < n; j++, i += 8) R[j] = this.rdi(Math.floor(natural + pdir * i));
    // nominal first, the others only when better: on silence every place scores 0 and the first of the scan (nominal -
    // srch) won, after which each grain followed its neighbour there; the sound settled 10 ms behind the head and a PLAY
    // (whose first grains sit on the head) came in that much early against the other deck (2026-10-21, user's report)
    bestc = this.alScore(nominal, ndir, n);
    for (let c = nominal - srch; c <= nominal + srch; c += 8) { const s = this.alScore(c, ndir, n); if (s > bestc) { bestc = s; best = c; } }
    const k = best;
    for (let c = k - 7; c <= k + 7; c += 1) { const s = this.alScore(c, ndir, n); if (s > bestc) { bestc = s; best = c; } }
    return best;
  }
  alScore(c, ndir, n) {
    const R = this.alR, ch = this.ch[0], len = this.len, wrap = this.p.loop && len > 2 && this.lpL > 1;
    let s = 0, e = 1e-9;
    for (let j = 0, i = 0; j < n; j++, i += 8) {
      const ip = Math.floor(c + ndir * i);
      const k = wrap ? this.rdi(ip) : ip < 0 || ip >= len ? 0 : ch[ip];
      s += R[j] * k;
      e += k * k;
    }
    return s / Math.sqrt(e);
  }

  // ---- jumps that keep the speed (L1384-L1415) ----
  headShift(d) {
    this.target += d; this.head += d; this.headMid += d; this.headMid2 += d; this.hdPrev += d; this.headGrain += d;
    this.uiPos += d; this.uiGoal += d; this.pfPrev += d;
  }
  jumpTo(p) {
    p = Math.max(0, Math.min(Math.max(this.len - 1, 0), p));
    const off = p - this.head;
    this.target += off; this.headMid += off; this.headMid2 += off; this.head = p; this.hdPrev += off;
    this.headGrain = this.headLast = this.head; this.uiGoal = this.uiPos = this.target; this.uiRate = 0;
    this.spinOn = 0; this.prevStart = PS_NONE; this.lpNeg = 0;
    this.slD = 0; this.slFix = 0;   // (SLICER: see blSlice; L1392)
  }
  runAt(v) {
    if (this.tch) return;
    const d = v / this.smoothK;
    this.headMid2 = this.head + d; this.headMid = this.head + 2 * d; this.target = this.head + 3 * d;
    this.hdPrev = this.head - v; this.uiGoal = this.uiPos = this.target; this.uiRate = 0;
  }

  // ---- transport (L1615-L1631, L1938-L1965) ----
  playOn(on) { this.playing = on ? 1 : 0; this.spinOn = 0; this.runAt(on ? this.te1x() : 0); }
  spinTo(on, a) {
    if (a > 0 && !this.tch && !this.seek && this.len > 0) {
      this.playing = on ? 1 : 0;
      if (!this.spinOn) this.spinV = this.hdV;
      this.spinOn = 1; this.spinR = a;
    } else this.playOn(on);
  }
  // the brake's rate (brk_now L1939): in beats of this deck's BPM at the speed it plays (a = BPM v^2 / (60 fsr beats)), else s57
  brkNow() {
    const v = Math.abs(this.hdV);
    return this.p.brakeBeats > 0 && this.p.bpm > 0 && v > 0 ? this.bpmAt() * v * v / (60 * this.fsr * this.p.brakeBeats) : this.brkA;
  }
  playGo() { if (!this.playing && this.syncOn) this.syncBeat(); this.pzWait = 0; this.pzCnt = 0; this.spinTo(!this.playing, this.playing ? this.brkNow() : this.stA); }
  // PAUSE quantize (pz_grid L1946): the step (beats), the place in it (0-1) and its length in s, from the other deck's beat
  // while it plays, else from this deck's grid by the head at the speed it plays (pzSrc 1 / 2; 0 = no grid)
  pzGrid() {
    const st = this.p.pzQ === 1 ? 1 : this.p.pzQ === 2 ? 0.5 : 0.25, o = this.other;
    const obpm = this.oBpm(), tk = this.teK || 1;
    let b;
    if (obpm > 0 && o.moved) { this.pzSrc = 1; b = o.gbB(o.head) * tk / st; this.pzSps = st * 60 / (obpm * tk); }
    else if (this.p.bpm > 0 && Math.abs(this.hdV) > 0) {
      const r = Math.abs(this.hdV) * this.srate / this.fsr;
      this.pzSrc = 2; b = this.gbB(this.head) / st; this.pzSps = st * 60 / this.bpmAt() / r;
    } else { this.pzSrc = 0; b = 0; this.pzSps = 0; }
    this.pzF = b - Math.floor(b);
  }
  // te_obpm (L4609, the other deck's ax_bpm L5239): its BPM where its head is, at its tempo; 0 = none
  oBpm() { const o = this.other; return o && o.p.bpm > 0 && o.len > 0 ? o.bpmAt() * (1 + o.p.tempo / 100) : 0; }
  // pq_frac (L1959): the place in the other deck's bar (0-1; 4 beats from its grid, as the metronome counts)
  pqFrac() { const b = this.other.gbB(this.other.head) / 4; return b - Math.floor(b); }
  pzReady() { return this.p.quant && this.p.pzQ > 0 && this.playing && !this.tch && !this.seek && this.len > 0 && !this.spinOn; }   // L1955
  // play_btn L1960. Quantized PLAY (⚪36, pq_wait): from stop with Quantize on and a BPM, while the other deck plays (moves)
  // with a BPM, the start waits for its next bar (a press up to Q_LATE s after its bar = at once; the block then
  // starts it, see block()). PLAY again while waiting = never mind. No setting of its own: Quantize (quant)
  playBtn() {
    if (this.hcHeld) { this.hcKeep = 1; return; }
    if (this.cueHeld) { this.cueKeep = 1; return; }
    if (this.qAct) { this.qAct = 0; return; }
    if (this.pqWait) { this.pqWait = 0; return; }
    if (this.pzWait) { this.pzWait = 0; this.pzCnt = 0; return; }   // PLAY again while waiting = never mind
    if (this.pzReady()) { this.pzGrid(); if (this.pzSrc > 0 && this.pzF * this.pzSps > Q_LATE) { this.pzWait = 1; this.pzLast = this.pzF; return; } }
    const ob = this.oBpm();
    if (!this.playing && this.p.quant && this.p.bpm > 0 && this.len > 0 && ob > 0 && this.other.moved && this.pqFrac() * 240 / ob > Q_LATE) {
      this.pqWait = 1; this.pqLast = this.pqFrac(); return;
    }
    this.playGo();
  }
  spinback() {
    if (this.tch || this.seek || this.len <= 0) return;
    this.playing = 0; this.slipOn = 0;
    const fs = this.fsr / this.srate;
    this.spinV = -this.p.sbSpeed * fs; this.spinR = this.p.sbSpeed * fs / (Math.max(this.p.sbTime, 0.01) * this.srate); this.spinOn = 1;
  }

  // ---- CUE, CDJ style (L1966-L1981) ----
  cuePress() {
    this.cueHeld = 1; this.slipOn = 0;
    if (this.playing) {
      if (this.qReady()) this.qSet(4, 0); else { this.jumpTo(this.cue * this.fsr); this.playOn(0); }
      this.cuePrev = 0;
    } else if (this.len > 0) {
      if (Math.abs(this.head - this.cue * this.fsr) > 0.002 * this.fsr) { this.cue = this.head / this.fsr; this.lpCalc(); }
      this.cuePrev = 1; this.cueKeep = 0; this.playOn(1);
    }
  }
  cueRelease() {
    if (!this.cueHeld) return;
    this.cueHeld = 0;
    if (this.cuePrev && !this.cueKeep) { this.jumpTo(this.cue * this.fsr); this.playOn(0); }
    this.cuePrev = 0;
  }
  cueBack() { this.jumpTo(this.cue * this.fsr); this.runAt(this.playing ? this.te1x() : 0); }

  // ---- slip (L1656-L1657) ----
  slipStart() { if (this.p.slip && this.playing && !this.slipOn && this.len > 0) { this.slipPos = this.head; this.slipOn = 1; } }
  slipBack() { this.jumpTo(this.slipPos); this.slipOn = 0; this.runAt(this.playing ? this.te1x() : 0); }

  // ---- hot cues (L1808-L1879) ----
  hcPress(n) {
    if (this.len <= 0) return;
    if (this.hot[n] < 0) {
      let p = this.head;
      if (this.p.quant && this.p.bpm > 0) p = this.gbP(Math.round(this.gbB(p)));
      this.hot[n] = Math.max(0, p / this.fsr);
      return 'set';
    }
    this.hcHeld = n + 1; this.hcT = 0; this.hcKeep = 0;
    if (this.qReady()) this.qSet(1, n); else this.hcGo(n);
  }
  hcGo(n, off = 0) {
    this.hcRet = this.head; this.hcRetPlay = this.playing;
    this.slipStart();
    this.jumpTo(this.hot[n] * this.fsr + off);
    this.playOn(1);
    if (this.p.cueLoop) {   // CUE LOOP (s179): the hot cue starts a loop of the current length from the cue
      this.blA = this.hot[n] * this.fsr;
      this.blB = Math.min(this.len - 1, this.p.bpm > 0 ? this.gbP(this.gbB(this.blA) + this.blBeats) : this.blA + this.blBeats * this.blBeat());
      this.blOn = 1; this.blHas = 1; this.blRoll = 0;
    }
  }
  hcRelease(n) {
    if (this.hcHeld !== n + 1) return;
    this.hcHeld = 0;
    if (this.hcT * 1000 >= this.p.holdMs && !this.hcKeep) {
      if (this.slipOn) this.slipBack();
      else { this.jumpTo(this.hcRet); this.playOn(this.hcRetPlay); }
    }
  }
  hcDelete(n) { this.hot[n] = -1; }

  // ---- quantize (L1721-L1837) ----
  qReady() { return this.p.quant && this.p.bpm > 0 && this.playing && !this.tch && !this.seek && this.len > 0; }
  qSet(act, n) {
    const bf = Math.floor(this.gbB(this.head)), b = this.gbP(bf);
    this.qAct = act; this.qN = n;
    if (this.head - b < Q_LATE * this.fsr) { this.qAt = b; this.qFire(1); }
    else { this.qAt = this.gbP(bf + 1); if (this.qAt >= this.len - 1) this.qFire(0); }
  }
  qFire(onBeat) {
    const act = this.qAct, off = onBeat ? this.head - this.qAt : 0;
    this.qAct = 0;
    if (act === 1) this.hcGo(this.qN, off);
    else if (act === 2) this.jumpTo(this.cue * this.fsr + off);
    else if (act === 4) { this.jumpTo(this.cue * this.fsr + off); this.playOn(0); }
  }

  // ---- SYNC (L1499-L1529) ----
  syncTempo() {
    const o = this.other;
    if (!o || o.len <= 0 || o.p.bpm <= 0 || this.p.bpm <= 0) return;
    const ob = o.bpmAt() * (1 + o.p.tempo / 100), r = ob / this.bpmAt();   // ((⚪176) the BPMs where the heads are, sy_bpm L1501)
    this.teK = r < 0.70710678 ? 2 : r > 1.41421356 ? 0.5 : 1;
    this.p.tempo = Math.max(-50, Math.min(50, (r * this.teK - 1) * 100));
  }
  syncBeat() {
    const o = this.other;
    if (!o || o.p.bpm <= 0 || this.p.bpm <= 0) return;
    let d = o.gbB(o.head) * (this.teK || 1) - this.gbB(this.head);
    d -= Math.floor(d + 0.5);
    if (Math.abs(d) > 0.002) this.jumpTo(this.gbP(this.gbB(this.head) + d));
  }

  // ---- memory cues (L1881-L1924) ----
  mcFind(t, tol) { let r = -1; this.mc.forEach((m, i) => { if (Math.abs(m - t) <= tol) r = i; }); return r; }
  mcAdd() {
    const t = Math.round(this.head / this.fsr * 1000) / 1000;
    if (this.len <= 0) return '';
    if (this.mc.length >= 32) return 'full';
    if (this.mcFind(t, 0.01) < 0) { this.mc.push(t); this.mc.sort((a, b) => a - b); }
    return '';
  }
  mcDelete() {
    let i = this.mcFind(this.cue, 0.002);
    if (i < 0) i = this.mcFind(this.head / this.fsr, 0.05);
    if (i >= 0) this.mc.splice(i, 1);
  }
  mcPick(dir) {
    const t = this.head / this.fsr;
    let r = -1;
    if (dir > 0) { for (let i = this.mc.length - 1; i >= 0; i--) if (this.mc[i] > t + 0.005) r = i; }
    else for (let i = 0; i < this.mc.length; i++) if (this.mc[i] < t - (this.playing ? 0.5 : 0.005)) r = i;
    return this.len > 0 ? r : -1;
  }
  mcCall(dir) {
    if (this.hcHeld || this.cueHeld) return;
    const r = this.mcPick(dir);
    if (r < 0) return;
    this.slipOn = 0;
    this.cue = Math.min(this.mc[r], (this.len - 1) / this.fsr); this.lpCalc();
    if (this.qReady()) this.qSet(2, 0); else this.jumpTo(this.cue * this.fsr);
  }

  // ---- beat loops (L1658-L1705); without a BPM a beat is 0.5 s ----
  blBeat() { return 60 / (this.p.bpm > 0 ? this.bpmAt() : 120) * this.fsr; }   // ((⚪176) a beat where the head is, L1660
  blSnap(p) { return this.p.bpm > 0 ? this.gbP(Math.floor(this.gbB(p) + 0.5)) : p; }
  blSet(beats, roll = 0) {
    if (this.len <= 0) return;
    this.blBeats = beats;
    let a = roll || !this.p.quant ? this.head : this.blSnap(this.head);
    a = Math.max(0, Math.min(this.len - 2, a));
    this.blA = a;
    this.blB = Math.min(this.len - 1, this.p.bpm > 0 ? this.gbP(this.gbB(a) + beats) : a + beats * this.blBeat());
    this.blOn = 1; this.blHas = !roll || this.blHas; this.blRoll = roll;
    if (this.p.slip && this.playing && !this.slipOn) { this.slipPos = this.head; this.slipOn = 1; }
  }
  blOff() { if (this.blOn) { this.blOn = 0; if (this.slipOn && this.p.slip) this.slipBack(); this.blRoll = 0; this.blPad = -1; } }
  blToggle() { if (this.blOn) this.blOff(); else this.blSet(this.blBeats, 0); }
  blFit() {
    const w = this.blB - this.blA;
    if (this.blOn && w > 0 && this.head >= this.blB) this.jumpTo(this.blA + (this.head - this.blA) - Math.floor((this.head - this.blA) / w) * w);
  }
  blSize(dir) {
    this.blBeats = Math.max(1 / 32, Math.min(32, dir > 0 ? this.blBeats * 2 : this.blBeats / 2));
    if (this.blOn) { this.blB = Math.min(this.len - 1, this.blA + this.blBeats * this.blBeat()); this.blFit(); }
    return this.blBeats;
  }
  blMove(dir) {
    if (this.len <= 0) return;
    const d = dir * this.blBeat();
    if (this.blOn) { this.blA = Math.max(0, Math.min(this.len - 2, this.blA + d)); this.blB = Math.min(this.len - 1, this.blA + this.blBeats * this.blBeat()); }
    this.jumpTo(Math.max(0, Math.min(this.len - 1, this.head + d)));
  }
  blReloop() {
    if (!this.blHas || this.len <= 0) return;
    this.blOn = 1; this.blRoll = 0;
    if (this.p.slip && this.playing && !this.slipOn) { this.slipPos = this.head; this.slipOn = 1; }
    this.jumpTo(this.blA);
  }
  blJump(beats) { if (this.len > 0) this.jumpTo(Math.max(0, Math.min(this.len - 1, this.head + beats * this.blBeat()))); }

  // ---- pad modes (the MIDI pads; midi.js picks the mode) ----
  // AUTO LOOP pad (bl_auto, L1696): its length; the same pad again = off; a loop running keeps its start
  blAuto(beats) {
    if (this.blOn && !this.blRoll) {
      if (this.blBeats === beats) this.blOff();
      else { this.blBeats = beats; this.blB = Math.min(this.len - 1, this.blA + beats * this.blBeat()); this.blFit(); }
    } else this.blSet(beats, 0);
  }
  // a loop while pad k is held (BOUNCE LOOP, L4858; AUTO LOOP + SHIFT, pm_shift L3774): a roll, let go = where the song got to
  blHold(beats, k) { this.blSet(beats, 1); this.blPad = k; }
  blLetGo(k) { if (this.blRoll && k === this.blPad) this.blOff(); }
  // SLICER (bl_slice, L1706-L1720): the bar (4 beats on the grid) where the song would be, in 8 slices; pad k jumps to its
  // slice at the same place inside the slice. Without a BPM the bar is 4 beats at 120 BPM from the grid
  blSlice(k) {
    if (this.len <= 0) return;
    const bar = 4 * this.blBeat(), sl = bar / 8, slip = this.p.slip;
    const base = this.slipOn ? this.slipPos : slip ? this.head + this.slD : this.head;
    const s0 = !slip && this.slFix ? this.slS0 : this.p.bpm > 0 ? this.gbP(Math.floor(this.gbB(base) / 4) * 4)
      : this.p.grid * this.fsr + Math.floor((base - this.p.grid * this.fsr) / bar) * bar;
    let off = base - s0; off -= Math.floor(off / sl) * sl;
    this.jumpTo(Math.max(0, Math.min(this.len - 1, s0 + k * sl + off)));
    this.slD = this.slipOn || !slip ? 0 : base - this.head;
    if (!slip) { this.slS0 = s0; this.slFix = 1; }
  }
  // a SLICER pad (L4855-L4856): down = slip starts and the slice; up (the pad held last) = back where the song got to (slip)
  slicePad(k, dn) {
    if (dn) { this.slipStart(); this.slHeld = k; this.blSlice(k); }
    else if (k === this.slHeld) { this.slHeld = -1; if (this.slipOn && this.p.slip && !this.hcHeld && !this.blOn) this.slipBack(); }
  }
  // SLICER + SHIFT (pm_shift, L3776): the slice, half a beat looped while held
  sliceRoll(k) { this.slipStart(); this.blSlice(k); this.blSet(1 / 2, 1); this.blPad = k; }
  // a new pad mode (L4794-L4796, L4825): a held roll ends, the key back (out of PITCH PLAY), no SLICER pad held
  setPadMode(m) {
    if (this.blRoll) this.blOff();
    if (m !== 12) this.ppK = 1;
    this.slHeld = -1; this.padMode = m;
  }
  // PITCH PLAY (L4870): hot cue 1 at the pad's key (semitones); let go as a hot cue pad (hcRelease(0))
  ppPress(semi) { this.ppK = Math.pow(2, semi / 12); return this.hcPress(0); }
  // a held reverse / freeze / half speed (apc_rev, L3656): only while playing; let go only the one that was held
  revHold(on, f) {
    if (on) { if (this.playing && this.len > 0 && !this.rvOn) { this.rvOn = 1; this.rvF = f; if (!this.slipOn && this.p.slip) { this.slipPos = this.head; this.slipOn = 1; } } }
    else if (this.rvOn && this.rvF === f) { this.rvOn = 0; this.rvF = 1; if (this.slipOn) this.slipBack(); }
  }
  // a held move pad (apc_mv, L3669-L3690): the head runs at v (file frames / output sample) while held; let go: back to 1x
  // and on (stop 0), or to rest (stop 1; also from a stopped deck), in half the spinback time, or at once (quick)
  apcMv(on, v, stop, quick, pad) {
    if (on) {
      if (this.touched || this.uiTouch || this.kbTouch || this.seek || this.len <= 0) return;
      if (!this.playing) stop = 1;
      if (stop) { this.playing = 0; this.slipOn = 0; } else if (!this.slipOn && this.p.slip) { this.slipPos = this.head; this.slipOn = 1; }
      this.rvOn = 0; this.spinOn = 1; this.spinV = v; this.spinR = 0;
      this.apcFwh = 1; this.apcMvp = pad; this.apcMvq = quick; this.apcMvs = stop;
    } else if (this.apcFwh && this.apcMvp === pad) {
      this.apcFwh = 0; this.apcMvp = -1;
      if (!this.apcMvs && this.apcMvq) { this.spinOn = 0; if (this.slipOn) this.slipBack(); }
      else if (this.spinOn) {
        if (this.apcMvq && !this.playing) this.spinOn = 0;
        else {
          this.spinR = Math.abs(this.spinV - (this.playing ? this.te1x() : 0)) / (Math.max(this.p.sbTime * 0.5, 0.01) * this.srate);
          this.apcSpd = 1; this.apcRet = this.apcMvs ? 0 : 1;
        }
      }
    }
  }
  // the held moves k 0-3 (mv_hold, L3692-L3699): fast spinback, reverse 1x, half speed, fast forward spin (the Buddy's
  // NEURAL MIX pads 5-8, the APC40's bottom row)
  mvHold(k, dn) {
    const sb = 2 * this.p.sbSpeed * this.fsr / this.srate;
    if (dn) {
      if (k === 0) this.apcMv(1, -sb, 0, 0, 4);
      else if (k === 1) { if (this.playing) this.revHold(1, -1); else this.apcMv(1, -this.te1x(), 1, 1, 5); }
      else if (k === 2) { if (this.playing) this.revHold(1, 0.5); else this.apcMv(1, 0.5 * this.te1x(), 1, 1, 6); }
      else this.apcMv(1, sb, 0, 0, 7);
    } else if (k === 0) this.apcMv(0, 0, 0, 0, 4);
    else if (k === 1) { this.revHold(0, -1); this.apcMv(0, 0, 0, 0, 5); }
    else if (k === 2) { this.revHold(0, 0.5); this.apcMv(0, 0, 0, 0, 6); }
    else this.apcMv(0, 0, 0, 0, 7);
  }
  // NEURAL MIX + SHIFT pads 5-8 (L4885-L4889): the same moves ending at rest, also from a stopped deck
  mvStop(k, dn) {
    const sb = 2 * this.p.sbSpeed * this.fsr / this.srate, on = dn ? 1 : 0;
    if (k === 0) this.apcMv(on, -sb, 1, 0, 4); else if (k === 1) this.apcMv(on, -this.te1x(), 1, 1, 5);
    else if (k === 2) this.apcMv(on, 0.5 * this.te1x(), 1, 1, 6); else this.apcMv(on, sb, 1, 0, 7);
  }

  // ---- PATTERN pads (pad mode 13, ⚪115 / ⚪182; pt_* L1729-L1795, L5368-L5379, L5566-L5567) ----
  // Pad k plays its scratch pattern as the scratch envelope plays its lane: the head = where it went on + the pattern's
  // position (beats of the sample) on its own 1x clock (at the tempo), the crossfader by its fader points, as a hand
  // (slip, the spin on release). It starts on the next beat with Quantize on and a BPM (else at once); a hand, a stop or
  // a search ends it; at its end it lets go
  ptPat(k) { const x = this.ptPads[k]; return typeof x === 'number' ? PATTERNS[x] || null : x && x.pos ? x : null; }
  // pad k's pattern: an index into PATTERNS (patterns.js), a pattern object ({name, beats, pos, fader}), or -1 = none
  patSet(k, x) {
    if (!(k >= 0 && k < 8)) return;
    this.ptPads[k] = typeof x === 'number' ? (PATTERNS[x] ? x : -1) : x && x.pos && x.beats > 0 ? x : -1;
    if (this.ptOn && this.ptK === k) this.ptOn = 0;
    if (this.ptReq === k) this.ptReq = -1;
  }
  // a PATTERN pad (L4872: only its press; let go does nothing); returns the JSFX's message (pt_press L1789)
  patPad(k, down) {
    if (!down || !(k >= 0 && k < 8)) return '';
    const pt = this.ptPat(k);
    if (pt && pt.pos.length > 0 && this.playing && this.len > 0) {
      this.ptReq = k; this.ptB0 = this.p.bpm > 0 ? Math.floor(this.gbB(this.head) + 0.0001) : 0;
      return `pattern ${k + 1}: ${pt.name}`;
    }
    return !this.playing ? 'pattern pads: play the deck first' : 'pattern pads: this pad has no pattern';
  }
  // the pattern that plays (an index into PATTERNS; -2 a pattern given as an object), -1 none
  patNow() { if (!this.ptOn) return -1; const x = this.ptPads[this.ptK]; return typeof x === 'number' ? x : -2; }
  // (⚪182) the pad's swing: a point at beat t sits at beat ptW(t) of the pad's clock (16ths, the deck's Swing taken when
  // the pad starts: ptSws, 0.5 = straight), counted from the sample's beat ptPh; ptUw = back
  ptSw(x) { const e = Math.floor(x * 2) / 2, u = (x - e) * 2, s = this.ptSws; return e + 0.5 * (u < 0.5 ? u * 2 * s : s + (u - 0.5) * 2 * (1 - s)); }
  ptW(t) { return this.ptSws === 0.5 ? t : this.ptSw(this.ptPh + t) - this.ptPhw; }
  ptUw(b) {
    if (this.ptSws === 0.5) return b;
    const s = this.ptSws, x = b + this.ptPhw, e = Math.floor(x * 2) / 2, u = (x - e) * 2;
    return e + 0.5 * (u < s ? u / (2 * s) : 0.5 + (u - s) / (2 * (1 - s))) - this.ptPh;
  }
  // pt_pv L1759: the value at beat b (of the pad's clock) of the points P (at most n; smooth 1 = the segment after the
  // point eases in and out, else straight)
  ptPv(P, n, b) {
    n = Math.min(n, P.length);
    const bu = this.ptUw(b);
    if (n <= 0) return 0;
    if (bu <= P[0][0]) return P[0][1];
    let i = 0;
    while (i < n - 1 && P[i + 1][0] <= bu) i++;
    if (i >= n - 1) return P[n - 1][1];
    const t0 = this.ptW(P[i][0]), t1 = this.ptW(P[i + 1][0]), v0 = P[i][1], v1 = P[i + 1][1];
    let u = t1 > t0 ? (b - t0) / (t1 - t0) : 1;
    if (P[i][2]) u = u * u * (3 - 2 * u);
    return v0 + (v1 - v0) * u;
  }
  // per block (L5366-L5379): the beat in frames; a pad waiting for its beat starts; a hand, a stop or a search ends it;
  // its fader for this block
  ptBlock() {
    this.evBs = 60 / (this.p.bpm > 0 ? this.bpmAt() : 120) * this.fsr;   // (no BPM: the JSFX takes REAPER's tempo; here 120)
    if (this.ptReq >= 0) {
      if (!this.playing || this.len <= 0 || this.touched || this.uiTouch || this.kbTouch || this.seek) this.ptReq = -1;
      else if (!(this.p.quant && this.p.bpm > 0) || Math.floor(this.gbB(this.head) + 0.0001) !== this.ptB0) {
        this.ptK = this.ptReq; this.ptReq = -1; this.ptOn = 1; this.ptClk = 0;
        // (⚪182) its swing: the deck's, from the beat it waited for (Quantize), else from where it is
        this.ptSws = this.p.swing > 50 && this.p.bpm > 0 && this.fsr > 0 ? this.p.swing / 100 : 0.5;
        this.ptPh = this.ptSws === 0.5 ? 0 : this.p.quant ? Math.floor(this.gbB(this.head) + 0.0001) : this.gbB(this.head); this.ptPhw = this.ptSw(this.ptPh);
        const pt = this.ptPat(this.ptK);
        if (pt) this.ptAt = this.target - this.ptPv(pt.pos, PT_POS, 0) * this.evBs; else this.ptOn = 0;
      }
    }
    if (this.ptOn && (this.touched || this.uiTouch || this.kbTouch || !this.playing || this.seek || this.len <= 0)) this.ptOn = 0;
    const pt = this.ptOn ? this.ptPat(this.ptK) : null;
    this.ptFval = pt && pt.fader && pt.fader.length > 0 ? Math.max(0, Math.min(1, this.ptPv(pt.fader, PT_FAD, this.ptClk / this.evBs))) : 1;
  }

  // ---- the metronome (L1530-L1556, L5302-L5320, L5979-L5997) ----
  mtA() { return this.id === 0 || !this.other || this.other.id !== 0 ? this : this.other; }   // deck A: the settings' owner
  mtMe() { const a = this.mtA(); return a.p.mtMode === 2 ? this.p.mtOn : a.p.mtOn; }        // this deck's on / off (mt_me)
  // mt_put / mt_set (L1544-L1551): one setting, kept by deck A (its on / off by this deck in mode 2), clamped as the JSFX
  mtPut(k, v) {
    const a = this.mtA(), mine = k === 'mtOn' && a.p.mtMode === 2;
    v = Number(v);
    const x = k === 'mtOn' || k === 'mtHold' || k === 'mtOut' ? (v > 0.5 ? 1 : 0) : k === 'mtMode' ? (v === v ? Math.max(0, Math.min(2, Math.floor(v + 0.5))) : 0)
      : k === 'mtVol' ? (v === v ? Math.max(-30, Math.min(0, Math.floor(v + 0.5))) : -12) : null;
    if (x === null) return;
    (mine ? this : a).p[k] = x;
  }
  // N / METRONOME (mt_toggle L1552): on / off; returns the JSFX's message
  mtToggle() {
    const v = this.mtMe() ? 0 : 1, a = this.mtA(), m = a.p.mtMode;
    this.mtPut('mtOn', v);
    let msg = !v ? 'metronome off' : m === 2 ? "metronome on (this deck's beats)" : m === 1 ? "metronome on (the SYNC base deck's beats)" : "metronome on (the playing deck's beats)";
    if (v && this.p.bpm <= 0 && (m === 2 || this.len <= 0 || a.mtSrc === this.id + 1)) msg += ' - no BPM for this sample yet: tap T on the beat, or set it on the setup page';
    return msg;
  }
  // the deck that clicks in modes 0 / 1 (L5303-L5315; 1 = deck A, 2 = deck B), kept in deck A. State bits: 1 plays,
  // 2 SYNC on, 4 has a BPM. The SYNC base = the deck whose SYNC is off while the other's is on (and has a BPM); else the
  // deck that plays alone; both or none playing: the same deck as before; a deck without a BPM gives way to one with
  mtPick() {
    const a = this.mtA(), b = a === this ? this.other : this;
    const st = (d) => (d ? (d.playing ? 1 : 0) + (d.syncOn ? 2 : 0) + (d.p.bpm > 0 && d.len > 0 ? 4 : 0) : 0);
    const sa = st(a), sb = b && b !== a ? st(b) : 0, md = a.p.mtMode;
    const n = md === 1 && (sb & 2) && !(sa & 2) && (sa & 4) ? 1 : md === 1 && (sa & 2) && !(sb & 2) && (sb & 4) ? 2
      : (sa & 5) === 5 && (sb & 5) !== 5 ? 1 : (sb & 5) === 5 && (sa & 5) !== 5 ? 2 : 0;
    if (n) a.mtSrc = n;
    if (a.mtSrc === 2 && !(sb & 4) && (sa & 4)) a.mtSrc = 1; else if (a.mtSrc === 1 && !(sa & 4) && (sb & 4)) a.mtSrc = 2;
    return a.mtSrc;
  }
  // mt_act (L5317): this deck clicks
  mtNow() {
    const a = this.mtA(), src = this.mtPick();
    return this.mtMe() && this.p.bpm > 0 && this.len > 0 && (a.p.mtMode === 2 || src === this.id + 1) ? 1 : 0;
  }
  // the worklet keeps a deck awake while it would click (stopped with 'keeps time': it clicks at its BPM)
  mtAwake() { return this.mtNow() && (!this.mtA().p.mtHold || (this.playing && !this.tch && !this.seek)) ? 1 : 0; }

  // ---- tap tempo (L4269-L4287): a line through the tapped head positions, from the 4th tap; a 2 s gap starts over ----
  ttTap() {
    if (!this.playing || this.len <= 0) return 0;
    if (this.clock - this.ttLast > 2 * this.srate) this.tt = [];
    this.ttLast = this.clock;
    this.tt.push(this.head / this.fsr);
    if (this.tt.length > 16) this.tt.shift();
    const n = this.tt.length;
    if (n < 4) return 0;
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    this.tt.forEach((y, x) => { sx += x; sy += y; sxx += x * x; sxy += x * y; });
    const k = (n * sxy - sx * sy) / (n * sxx - sx * sx), b = (sy - k * sx) / n;
    if (!(k > 0.15 && k < 2)) return 0;
    this.gbClear();   // (the BPM changed other than by the map: one tempo again, L4586-L4591)
    this.p.bpm = Math.round(60 / k * 100) / 100; this.p.grid = ((b % k) + k) % k; this.lpCalc();
    return this.p.bpm;
  }
  gridHere() {   // Shift+T: this place is a beat (with a beat map: gb_fix, L7664)
    if (this.p.bpm <= 0) return;
    if (this.gbm) return this.gbFix();
    const spb = 60 / this.p.bpm, t = this.head / this.fsr;
    this.p.grid = ((t % spb) + spb) % spb; this.lpCalc();
  }
  rev(on, f = -1) {   // held reverse / freeze / half speed (apc_rev, L3654)
    if (on) { this.rvOn = 1; this.rvF = f; this.slipStart(); }
    else { this.rvOn = 0; if (this.slipOn) this.slipBack(); else this.runAt(this.playing ? this.te1x() : 0); }
  }
  // NEEDLE SEARCH (JSFX:4680): while stopped, a place in the sample 0 .. 1 (⚪205)
  needle(frac) { if (!this.playing && this.len > 1) this.jumpTo(Math.max(0, Math.min(1, frac)) * (this.len - 1)); }
  seekAbs(frac) { if (this.len > 0) this.target = Math.max(0, Math.min(1, frac)) * (this.len - 1); }

  // ---- inputs ----
  jogTicks(t) {   // jog_feed L2393 (relative ticks)
    if (!this.autoTouch && !this.touched && this.nbFree < NB_COAST * this.srate) return;
    if (!this.autoTouch && !this.touched && this.playing && !this.uiTouch && !this.kbTouch) { this.nbRem += t * this.spt * NB_AMT; return; }
    this.jq.push(t * this.spt);
  }
  jogAuto(t) { this.autoTouch = 1; this.touched = 1; this.jogIdle = 0; this.jogTicks(t); }   // no touch sensor
  // (⚪209) DVS: the record moved sec seconds (at 1x): the head goes with it, touched as long as it comes (every block)
  jogSec(sec) { this.autoTouch = 1; this.touched = 1; this.jogIdle = 0; this.jq.push(sec * this.fsr); }
  setTouch(on) { if (this.touched && !on) this.nbFree = 0; this.touched = on ? 1 : 0; this.autoTouch = 0; }
  jogFine(t) { this.jq.push(t * this.spt); }   // a fine ring tick goes straight to the head (L4718)
  jogSpeed(x) { this.jspV = x * this.fsr / this.srate; }   // CDJ jog top: x times speed while touched (L4696)
  jogRing(x) { this.jrgV = x; this.jrgT = 0; }            // CDJ ring: held 0.3 s (L4717)
  jumpBy(sec) { if (this.len > 0) this.jumpTo(Math.max(0, Math.min(this.len - 1, this.head + sec * this.fsr))); }   // SHIFT + jog (L4712)
  nudge(dir, n) { this.nbRem += dir * (this.playing ? 0.04 : 0.25) * this.te1x() * n; }
  uiDown() { this.uiGoal = this.target; this.uiTouch = 1; this.uiRelV = null; }
  // with the loop on the hand goes on past either end of the loop (the loop step at (2) carries it round); kept inside
  // the sample, a scratch near the end stuck there (user's check 2026-10-21)
  uiMove(dFrames) {
    const g = this.uiGoal + dFrames;
    this.uiGoal = this.p.loop && this.lpL > 1 ? g : Math.max(0, Math.min(this.len - 2, g)); this.uiGen++;
  }
  // v: the finger's own speed (x) over its last moves, from the page. The spin on release starts from it: the head's
  // speed here was far below it where the browser runs the worklet in bursts (Chrome on a Motorola edge 60s pro: -0.8x
  // for a -6.8x flick, so the record stopped at once; Firefox -18.8x for -16.5x), user's choice 2026-10-21.
  // relV: the speed the spin starts from (x), for ?diag=1
  uiUp(v) {
    this.uiTouch = 0;
    this.uiRelV = Number.isFinite(v) ? v * this.fsr / this.srate : null;
    this.relV = (this.uiRelV ?? this.hdV) * this.srate / this.fsr;
  }
  seekStart(pos) { this.seek = 1; this.seekGoal = pos; this.seekFirst = 1; this.seekCnt = 0; this.slipOn = 0; }
  seekMove(pos) { this.seekGoal = pos; }
  seekEnd() {
    if (!this.seek) return;
    this.jumpTo(this.seekGoal); this.seek = 0; this.runAt(this.playing ? this.te1x() : 0);
  }

  // ---- per block (the parts of @block this port needs) ----
  block(n) {
    if (this.autoTouch && this.touched) { this.jogIdle += n / this.srate; if (this.jogIdle > this.autoRel) { this.touched = 0; this.autoTouch = 0; this.nbFree = 0; } }
    if (!this.touched) this.nbFree += n;
    if (this.hcHeld) this.hcT += n / this.srate;
    // SLICER's bar kept only while its pads go on (L5526-L5527); a held move's slowing down ended some other way (L5062)
    if (this.slHeld >= 0) this.slIdle = 0; else this.slIdle += n;
    if (this.slHeld < 0 && (this.p.slip || this.tch || !this.playing || this.padMode !== 6 || this.slIdle > 4 * 60 / (this.p.bpm > 0 ? this.p.bpm : 120) * this.srate)) { this.slD = 0; this.slFix = 0; }
    if (!this.spinOn) { this.apcSpd = 0; this.apcRet = 0; }
    if (this.nudgeDir) this.nudge(this.nudgeDir, n);
    // CDJ speed mode: the top's speed ends with the touch; the ring untouched: playing = a bend, stopped = moves (L5070-L5078)
    if (!this.touched) this.jspV = 0;
    this.jrgT += n;
    if (this.jrgT > 0.3 * this.srate) this.jrgV = 0;
    if (this.jrgV && !this.touched && this.nbFree >= NB_COAST * this.srate && !this.uiTouch && !this.kbTouch && this.len > 0) {
      const f = this.jrgV * this.fsr / this.srate * n;
      if (this.playing) this.nbRem += f * NB_AMT; else this.jq.push(f);
    }
    // a PATTERN pad (L5368-L5379) is a hand on the record while no loop or held pad effect rules the head (L5398)
    this.ptBlock();
    this.tch = this.touched || this.uiTouch || this.kbTouch || (this.ptOn && !this.blOn && !this.rvOn && !this.apcFwh && !this.apcSpd) ? 1 : 0;
    const pp = this.p;
    this.fx.block(n, { bpm: pp.bpm > 0 ? this.bpmAt() * (1 + pp.tempo / 100) : 0, beat: pp.bpm > 0 ? this.gbB(this.head) : 0, pitchBar: pp.pitchBar, key: pp.key, rate: this.tpVs, playing: this.playing });
    this.kshift = this.ppK * Math.pow(2, pp.key / 12) * this.fx.kshiftWobble();   // (L5206: PITCH PLAY's pp_k too)
    // crossfader goal (L5082-L5101)
    const p = this.p;
    const d = p.xfSide === 1 ? 1 - this.xfPos : this.xfPos;
    let g = p.xfSide === 0 ? 1 : p.fadeW <= 0 ? (d * 100 > p.cutIn ? 1 : 0) : Math.max(0, Math.min(1, (d * 100 - p.cutIn) / p.fadeW));
    if (p.xfCurve === 1) g = Math.sin(g * Math.PI * 0.5);
    g *= p.vol;
    if (this.kbCut) g = 0;
    if (p.mute) g = 0;   // (the mute, JSFX slider196: the main sound off, ⚪205)
    g *= this.ptFval;   // (a pattern pad's fader, L5100)
    this.xfGoal = g;
    if (this.syncOn) this.syncTempo();
    this.moved = Math.abs(this.head - this.vmvLast) > 0.5 ? 1 : 0; this.vmvLast = this.head;   // (L5299)
    // the metronome (L5317-L5320); not on: its clock from where the head is
    this.mtAct = this.mtNow();
    if (!this.mtAct) this.mtB = this.p.bpm > 0 && this.len > 0 ? this.gbB(this.head) : 0;
    const ma = this.mtA();
    this.mtBps = (this.p.bpm > 0 ? this.bpmAt() * (1 + this.p.tempo / 100) : 0) / 60 / this.srate;
    this.mtAmp = Math.pow(10, ma.p.mtVol / 20); this.mtHd = ma.p.mtHold ? 1 : 0; this.mtMain = ma.p.mtOut ? 1 : 0;
    // a waiting quantized PLAY (L5326-L5329): start when the other deck's bar comes round (the place in its bar went
    // back), or at once if it stopped / has no BPM / Quantize went off; dropped if this deck started some other way
    if (this.pqWait) {
      const o = this.other;
      if (!(this.oBpm() > 0 && o.moved) || !this.p.quant || this.playing) { this.pqWait = 0; if (!this.playing) this.playGo(); }
      else { const f = this.pqFrac(); if (f < this.pqLast - 0.5) { this.pqWait = 0; this.playGo(); } else this.pqLast = f; }
    }
    // a waiting quantized PAUSE (L5331-L5344): when its step comes round in this block, count the samples to it (the
    // sample loop stops there); the place going back (the step went round, a loop wrapped) = now. Dropped by a touch /
    // search / a stop some other way; Quantize off = stop now
    if (this.pzWait && !this.pzCnt) {
      if (!this.playing || this.tch || this.seek || this.len <= 0) this.pzWait = 0;
      else if (!this.p.quant || !this.p.pzQ) this.playGo();
      else {
        this.pzGrid();
        if (this.pzSrc === 0 || this.pzF < this.pzLast - 0.000001) this.playGo();
        else {
          const r = (1 - this.pzF) * this.pzSps * this.srate;
          if (r < n) this.pzCnt = Math.max(1, Math.floor(r + 0.5));
          this.pzLast = this.pzF;
        }
      }
    }
  }

  // ---- per sample (L5506-L5978), writes into outL/outR from index 0..n-1 (adds) ----
  // cue (optional, processor.js when the page takes the cue output): {l, r, m} Float32Arrays of n, added into: l / r =
  // this deck's sound before the crossfader and the channel fader while its cue (pfl) is on (channels 5/6, L5974-L5977),
  // m = its metronome click (channels 7/8, L5995)
  process(outL, outR, n, cue = null) {
    this.block(n);
    if (this.len <= 0) { this.jq.length = 0; return; }
    const fsr = this.fsr, sr = this.srate, p = this.p, fs = fsr / sr;
    let jqi = 0;
    this.clock += n;
    for (let s = 0; s < n; s++) {
      // the quantized PAUSE's step (L5507)
      if (this.pzCnt > 0 && --this.pzCnt <= 0) { this.pzCnt = 0; if (this.pzWait && this.playing && !this.tch) this.playGo(); else this.pzWait = 0; }
      // slip background (L5512-L5524)
      if (!p.slip || this.seek) this.slipOn = 0;
      if (this.tch && !this.slipTch) this.slipStart();
      if (this.slipOn) {
        if (this.playing) this.slipPos += this.te1x() * this.swK(this.slipPos);
        if (p.loop && this.lpL > 1 && this.slipPos >= this.lpB) this.slipPos -= this.lpL * (1 + Math.floor((this.slipPos - this.lpB) / this.lpL));
        else if (this.slipPos >= this.hdMax()) this.slipPos = this.hdMax();
        if (!this.tch && !this.hcHeld && this.qAct !== 3 && !this.blOn && !this.rvOn && !this.apcFwh && !this.apcRet && this.slHeld < 0) { if (this.slipTch) { this.slipBack(); this.hdTch = 0; } else this.slipOn = 0; }
      }
      this.slipTch = this.tch;
      // quantized action (L5511)
      if (this.qAct) { if (!this.qReady()) this.qFire(0); else if (this.head >= this.qAt || this.head < this.qAt - 2 * 60 / this.bpmAt() * fsr) this.qFire(1); }
      // (1) motion sources into target
      if (this.seek) {
        if (this.seekFirst) { this.jumpTo(this.seekGoal); this.runAt(fs); this.seekFirst = 0; this.seekCnt = 0; }
        else if (++this.seekCnt >= SEEK_SNIP * sr) { this.seekCnt = 0; if (Math.abs(this.seekGoal - this.head) > 1) this.jumpTo(this.seekGoal); }
        this.target += fs;
      } else {
        const spinGoal = this.playing ? this.te1x() : 0;
        const relV = this.uiRelV ?? this.spAvg;   // (a hand let go: the finger's speed, uiUp)
        if (this.hdTch && !this.tch && this.spinA > 0 && !this.apcFwh && !this.apcSpd && Math.abs(relV - spinGoal) / fs >= 1) { this.spinOn = 1; this.spinV = relV; this.spinR = this.spinA; }
        if (this.hdTch && !this.tch) this.uiRelV = null;
        if (this.tch) this.spinOn = 0;
        if (this.spinOn) {
          this.spinV = this.spinV > spinGoal ? Math.max(spinGoal, this.spinV - this.spinR) : Math.min(spinGoal, this.spinV + this.spinR);
          if (this.spinV === spinGoal) { this.spinOn = 0; this.apcSpd = 0; if (this.apcRet) { this.apcRet = 0; if (this.slipOn) this.slipBack(); } }
          this.target += this.spinV;
        } else if (!this.tch && this.playing) this.target += (this.rvOn ? this.rvF : 1) * this.te1x() * this.swK(this.target);   // (L5545: swing)
        this.hdTch = this.tch;
        if (this.nbRem !== 0) {
          if (this.tch) this.nbRem = 0;
          else { const d = this.nbRem * this.nbK; this.target += d; this.nbRem -= d; if (Math.abs(this.nbRem) < 0.001) { this.target += this.nbRem; this.nbRem = 0; } }
        }
        if (this.jspV && this.touched) this.target += this.jspV;
        if (s === 0) while (jqi < this.jq.length) this.target += this.jq[jqi++];
        if (this.uiTouch) {   // mouse goal reached at a constant rate over one GUI frame (L5553-L5563)
          if (!this.uiWas) { this.uiPos = this.target; this.uiRate = 0; this.uiSeen = this.uiGen; this.uiCnt = 0; }
          this.uiCnt++;
          if (this.uiGen !== this.uiSeen) {
            // (a gap longer than 50 ms is the hand holding still, not the time between moves: averaged in, the first
            // move after it crept over up to 100 ms, 332 ms to half way on a Pixel 4a; web, 2026-10-20)
            this.uiSeen = this.uiGen; if (this.uiCnt <= sr * 0.05) this.uiAvg += (this.uiCnt - this.uiAvg) * 0.3;
            this.uiRate = (this.uiGoal - this.uiPos) / Math.max(this.uiAvg, 32); this.uiCnt = 0;
          }
          this.uiPos += this.uiRate;
          if ((this.uiRate > 0 && this.uiPos > this.uiGoal) || (this.uiRate < 0 && this.uiPos < this.uiGoal)) { this.uiPos = this.uiGoal; this.uiRate = 0; }
          this.target = this.uiPos;
        }
        this.uiWas = this.uiTouch;
        // a PATTERN pad (L5566-L5567): its clock at the tempo; at its end it lets go
        if (this.ptOn) {
          const pt = this.ptPat(this.ptK);
          this.ptClk += this.te1x();
          if (!pt || this.ptClk >= this.ptW(pt.beats) * this.evBs) this.ptOn = 0;
          else if (!this.blOn && !this.rvOn && !this.apcFwh && !this.apcSpd) this.target = this.ptAt + this.ptPv(pt.pos, PT_POS, this.ptClk / this.evBs) * this.evBs;
        }
      }
      this.hdV += (this.head - this.hdPrev - this.hdV) * this.tpVk; this.hdPrev = this.head;
      if (this.tch) { if (this.spT) this.spAvg += (this.hdV - this.spAvg) * this.spK; else this.spAvg = this.hdV; } this.spT = this.tch;   // (JSFX sp_avg)
      this.ended = 0;
      // (2) loop / end (L5574-L5595)
      const len = this.len;
      if (p.loop && this.lpL > 1 && this.target >= this.lpB) { const d = this.lpL * (1 + Math.floor((this.target - this.lpB) / this.lpL)); this.headShift(-d); this.lpNeg = 1; }
      if (this.target >= len - 1 && !(p.loop && this.lpL > 1 && this.lpB > len - 1)) {
        if (p.loop) { this.headShift(-(len - 1)); this.lpNeg = 1; } else { this.target = len - 1; this.ended = this.tch ? 0 : 1; }
      }
      if (this.blOn && !this.tch && !this.seek && this.blB > this.blA && this.target >= this.blB) this.jumpTo(this.head - (this.blB - this.blA));
      if (p.loop && len > 2 && this.lpL > 1 && this.target < this.lpA && this.head >= this.lpA) this.headShift(this.lpL);
      if (this.lpNeg && this.head > this.lpA + 0.5 * fsr) this.lpNeg = 0;
      this.target = Math.max(0, Math.min(this.hdMax(), this.target));
      // (3) three-stage smoothing
      const k = this.smoothK;
      this.headMid += (this.target - this.headMid) * k; this.headMid2 += (this.headMid - this.headMid2) * k; this.head += (this.headMid2 - this.head) * k;

      // pitch follow (L5602-L5608)
      this.pfA += (p.pitchBar - this.pfA) * this.tpK; if (Math.abs(p.pitchBar - this.pfA) < 0.0001) this.pfA = p.pitchBar;
      const pfD = this.head - this.pfPrev; this.pfPrev = this.head;
      const pfJmp = Math.abs(pfD) > this.tpJump;
      if (!pfJmp) this.pfV = pfD;
      const pfN = this.pfV / fs / (1 + p.tempo / 100);
      this.pfR = (pfN < 0 ? -1 : 1) * (this.pfA === 0 ? 1 : Math.pow(Math.abs(pfN), this.pfA)) * fs;
      this.pfRk = this.pfR * this.kshift;
      // jump cross-fade (L5609-L5623)
      if (((pfJmp && this.pfA > 0) || this.smJump) && !this.seek) { this.reseed(); this.smJump = 0; }
      // grain spawn (L5625-L5660)
      // PLAY from silence, pitch-locked (ss_go, 2026-10-21): grains as if the deck had been playing (see startSeed)
      if (this.gain < 0.00001 && this.pfA === 0 && (this.playing || this.spinOn) && !this.tch && !this.seek && !this.ended && this.len > 0) this.startSeed();
      if (this.hopcnt <= 0) this.spawn();
      this.hopcnt--;
      // render (L5662-L5706)
      const gt = (this.tch || this.playing || this.seek || this.spinOn) && !this.ended ? 1 : 0;
      this.gain += (gt - this.gain) * 0.002;
      let ol = 0, or = 0;
      // the deck's gain on the sound going into the effects, not on what comes out: stopping (PLAY) faded the echo's
      // tail out with the sound (web version, user's report 2026-10-21). The effects run on while the echo rings out
      const live = !(this.gain < 0.00001 && gt === 0);
      if (live || this.fx.tail()) {
        if (live) {
        for (let i = 0; i < NSLOT; i++) {
          if (!this.vAct[i]) continue;
          const old = this.vSlot[i] !== this.cur && this.slots[this.vSlot[i]];
          let keep;
          if (old) { keep = [this.ch, this.len, this.lpL]; this.ch = old.ch; this.len = old.len; this.lpL = 0; }
          const w = (0.5 - 0.5 * Math.cos(2 * Math.PI * this.vAge[i] / this.vLen[i])) * this.vFade[i];
          const rp = this.vRp[i];
          if (this.vFol[i]) { ol += this.rd6(rp, 0) * w; or += this.rd6(rp, 1) * w; this.vRp[i] += this.pfRk; }
          else if (Math.abs(this.kshift - 1) > 0.00001) { ol += this.rd6(rp, 0) * w; or += this.rd6(rp, 1) * w; this.vRp[i] += this.vDir[i] * fs * this.kshift; }
          else { ol += this.rd(rp, 0) * w; or += this.rd(rp, 1) * w; this.vRp[i] += this.vDir[i] * fs * this.kshift; }
          this.vAge[i] += fs;
          if (this.vStep[i]) { this.vFade[i] += this.vStep[i]; if (this.vFade[i] >= 1) { this.vFade[i] = 1; this.vStep[i] = 0; } else if (this.vFade[i] <= 0) this.vAct[i] = 0; }
          if (this.vAge[i] >= this.vLen[i]) this.vAct[i] = 0;
          if (old) { this.ch = keep[0]; this.len = keep[1]; this.lpL = keep[2]; }
          else if (this.vSlot[i] !== this.cur) this.vAct[i] = 0;
        }
        ol *= this.outscale; or *= this.outscale;
        // rate-following low cut (L5707-L5722)
        this.tpVs += (Math.abs(this.pfR) / fs - this.tpVs) * this.tpVk;
        if (--this.tpN <= 0) {
          this.tpN = 16;
          const g = Math.tan(Math.PI * Math.min(0.45 * sr, 5 + 45 * Math.max(0, 1 - this.tpVs)) / sr);
          this.tpA1 = 1 / (1 + g * (g + 1.41421356)); this.tpA2 = g * this.tpA1; this.tpA3 = g * this.tpA2;
        }
        const pfB = Math.min(1, this.pfA * 20);
        ol = this.lowcut(ol, 0, pfB) * this.gain; or = this.lowcut(or, 1, pfB) * this.gain;
        }
        this.fx.sample(ol, or, p.bpm > 0 ? this.gbB(this.head) : 0); ol = this.fx.l; or = this.fx.r;
        if (this.fx.nanHit) { this.fx.nanHit = 0; this.tpC1[0] = this.tpC1[1] = this.tpC2[0] = this.tpC2[1] = 0; }
      } else this.fx.idle();
      // output stage (L5943-L5978)
      this.xfGain += (this.xfGoal - this.xfGain) * this.xfK;
      let l = ol * this.xfGain, r = or * this.xfGain;
      if (!(l === l)) l = 0; if (!(r === r)) r = 0;
      l = Math.max(-1, Math.min(1, l)); r = Math.max(-1, Math.min(1, r));
      // the cue: spl2 / spl3 (limited to 0 dBFS) x the cue's gain, which fades in / out in 5 ms (L5945-L5977)
      if (cue && (p.pfl || this.pflG > 0)) {
        this.pflG += Math.min(Math.max((p.pfl ? 1 : 0) - this.pflG, -this.pflSt), this.pflSt);
        const cl = ol === ol ? Math.max(-1, Math.min(1, ol)) : 0, cr = or === or ? Math.max(-1, Math.min(1, or)) : 0;
        cue.l[s] += cl * this.pflG; cue.r[s] += cr * this.pflG;
      }
      // the metronome (L5984-L5997): the clock follows the head while it plays untouched; stopped, held or searched it
      // goes on at the deck's BPM (mtHold 0) or follows the head silently (1). A click when the clock comes into a beat (in
      // its first 5 %); the bar's first beat 1500 Hz, the others 1000 Hz, falling away in about 15 ms. On the cue output
      // (channels 7/8) and, with 'Metronome out' = the headphones and the main (mtOut 1), on the main
      if (this.mtAct) {
        const lk = this.playing && !this.tch && !this.seek;
        const nb = lk || this.mtHd ? this.gbB(this.head) : this.mtB + this.mtBps, fb = Math.floor(nb);
        if ((lk || !this.mtHd) && fb !== Math.floor(this.mtB) && nb - fb < 0.05) {
          this.mtEnv = 1; this.mtPh = 0; this.mtF = ((fb % 4) + 4) % 4 === 0 ? 1500 / sr : 1000 / sr; this.mtGt = this.clock - n + s;
        }
        this.mtB = nb;
      }
      if (this.mtEnv > 0.0003) {
        const c = Math.sin(2 * Math.PI * this.mtPh) * this.mtEnv * this.mtAmp;
        this.mtPh += this.mtF; if (this.mtPh >= 1) this.mtPh -= 1; this.mtEnv *= this.mtDk;
        if (this.mtMain) { l = Math.max(-1, Math.min(1, l + c)); r = Math.max(-1, Math.min(1, r + c)); }
        if (cue) cue.m[s] += c;
      } else this.mtEnv = 0;
      outL[s] += l; outR[s] += r;
    }
    this.jq.length = 0;
  }

  lowcut(x, c, mix) {
    const c1 = this.tpC1, c2 = this.tpC2;
    const v3 = x - c2[c], v1 = this.tpA1 * c1[c] + this.tpA2 * v3, v2 = c2[c] + this.tpA2 * c1[c] + this.tpA3 * v3;
    c1[c] = 2 * v1 - c1[c]; c2[c] = 2 * v2 - c2[c];
    const y = x - 1.41421356 * v1 - v2;
    return x + (y - x) * mix;
  }

  pickV() {   // L621
    if (this.vAct[this.nextv]) {
      let b = -1, g = 2;
      for (let k = 0; k < NSLOT; k++) {
        if (b < 0 || g > 0) { if (!this.vAct[k]) { b = k; g = -1; } else if (this.vFade[k] < g) { b = k; g = this.vFade[k]; } }
      }
      this.nextv = b;
    }
    return this.nextv;
  }

  spawn() {
    const p = this.p, fs = this.fsr / this.srate, glen = this.glen;
    let v, start, dir, fol = 0, gl;
    if (this.seek) {
      this.hopcnt = this.hopSk; dir = 1; start = this.head - this.glenSk * 0.5; gl = this.glenSk;
      v = this.pickV();
    } else {
      this.hopcnt = this.hop;
      fol = this.pfA > 0 ? 1 : 0;
      dir = fol ? (this.pfR < 0 ? -1 : 1) : (p.dirFollow && this.head < this.headGrain) ? -1 : 1;
      let nominal = fol ? this.head - glen * 0.5 * (this.pfRk - this.pfA * this.pfV) / fs : this.head - dir * glen * 0.5 * this.kshift;
      const spd = Math.abs(this.head - this.headGrain) / this.hopF;
      const jamt = this.jit * Math.max(0, 1 - spd / this.jitFade) * (1 - this.pfA);
      if (jamt > 0) nominal += (Math.random() * 2 - 1) * jamt;
      start = nominal;
      const pfSr = fol ? this.pfRk / fs : dir * this.kshift;
      const pfS = Math.floor(this.srch * Math.max(1 - this.pfA, Math.min(1, Math.abs(p.tempo) * 0.5)));
      if (pfS > 0 && this.prevStart > PS_NONE && Math.abs(pfSr) > 0.1) {
        const natural = fol ? this.vRp[this.prevV] : this.prevStart + this.prevDir * this.hopF * this.kshift;
        start = this.align(nominal, pfSr, natural, fol ? pfSr : this.prevDir, Math.min(this.hopF, glen * 0.5), pfS);
      }
      gl = glen;
      v = this.pickV();
    }
    this.vLen[v] = gl; this.vRp[v] = start; this.vAge[v] = 0; this.vDir[v] = dir; this.vAct[v] = 1;
    this.vFol[v] = fol; this.vFade[v] = 1; this.vStep[v] = 0; this.vSlot[v] = this.cur;
    this.prevStart = this.seek ? PS_NONE : start; this.prevDir = dir; this.prevV = this.nextv;
    this.headGrain = this.head;
    this.nextv = (this.nextv + 1) % NSLOT;
  }

  // ss_go (2026-10-21): the grains left from the stop sat at jittered / searched places, so the first ~20 ms of a PLAY
  // sounded ahead of where the playing sound is (a quantized PLAY came in before the other deck's bar, user's report).
  // A full set of grains instead, each as far into its life as if the deck had been playing at its speed
  startSeed() {
    const fs = this.fsr / this.srate, glen = this.glen, k = this.kshift, v1 = this.te1x();
    this.vAct.fill(0);
    for (let g = this.overlap - 1; g >= 0; g--) {
      const t = g * this.hop, v = this.pickV();
      this.vRp[v] = this.head - t * v1 - glen * 0.5 * k + t * fs * k;
      this.vAge[v] = t * fs; this.vDir[v] = 1; this.vAct[v] = 1; this.vLen[v] = glen; this.vFol[v] = 0;
      this.vFade[v] = 1; this.vStep[v] = 0; this.vSlot[v] = this.cur;
      if (g === 0) { this.prevStart = this.vRp[v]; this.prevDir = 1; this.prevV = this.nextv; }
      this.nextv = (this.nextv + 1) % NSLOT;
    }
    this.hopcnt = this.hop; this.headGrain = this.head;
  }

  reseed() {   // L5609-L5623
    const fs = this.fsr / this.srate, glen = this.glen;
    for (let i = 0; i < NSLOT; i++) if (this.vAct[i]) this.vStep[i] = -this.tpXs;
    for (let g = this.overlap - 1; g >= 0; g--) {
      const t = g * this.hop, v = this.pickV();
      this.vRp[v] = this.head - glen * 0.5 * (this.pfRk - this.pfA * this.pfV) / fs + (this.pfRk - this.pfV) * t;
      this.vAge[v] = t * fs; this.vDir[v] = this.pfR < 0 ? -1 : 1; this.vAct[v] = 1; this.vLen[v] = glen; this.vFol[v] = 1;
      this.vFade[v] = 0; this.vStep[v] = this.tpXs; this.vSlot[v] = this.cur;
      if (g === 0) { this.prevStart = this.vRp[v]; this.prevDir = this.vDir[v]; this.prevV = this.nextv; }
      this.nextv = (this.nextv + 1) % NSLOT;
    }
    this.hopcnt = this.hop; this.headGrain = this.head;
  }

  // the picture's position (s): where the sound is, the swing taken back out (L5960, sw_vpos)
  videoPos() { return this.swVpos(this.head) / this.fsr; }
  // seconds since this deck's last click (the record's corner glows brighter, L8344)
  mtAge() { return (this.clock - this.mtGt) / this.srate; }
  audioLag() { return (1 - this.p.pitchBar) * this.p.glenMs / 2000; }   // L5474: the sound sits this far behind the head
}

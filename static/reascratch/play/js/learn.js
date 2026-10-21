// ReaScratch Web — the Learn steps (a port of the JSFX's Learn tab, reascratch.jsfx wz_* L7008-L7384, ⚪68 / ⚪149): the
// owner of a controller touches its controls one at a time; the MIDI it sends is read here, compared with the preset in
// use (✓ same / ✗ differs), put into the deck (apply: a user preset) and written to a .reascratch-preset file (the same
// text as the JSFX's Save, so the file works in REAPER too: Data/ReaScratch_controllers).
// Pure (no DOM, no Web MIDI): feed(bytes, t) for each message, tick(t) every frame; t in seconds.
// Steps: 0 PLAY, 1 CUE, 2 SHIFT, 3 touch (rock), 4 one turn, 5 side, 6 tempo, 7 volume, 8 crossfader, 9 headphone CUE,
// 10 hot cue pads, 11 SHIFT + pad 1, 12 sampler pads, 13 FX ON, 14 FX knob, 15 FX <, 16 FX >.
// A step's result: {st: 0 not yet / 1 measured / 2 skipped / 3 measured but not usable, ch, status, num, a, b, c (the
// step's own: wz_r [4]-[6]), rem (wz_r [7]: 1 absolute jog, 2 type guessed from one direction, 3 a CC button, 4 another
// channel than the deck's, 5 cannot count, 6 pads not in a row, 7 the preset reads the jog as speed / position, 8 the FX
// knob on another channel than FX ON's), pairs: [[slider, value], ...], raw: the first 24 messages}

export const STEPS = 17;
// the settings a file holds (the JSFX's WZ_CTL, L979: the presets' settings and sliders 33, 84, 85)
export const CTL = [6, 7, 8, 9, 10, 12, 13, 14, 15, 16, 17, 33, 34, 35, 46, 47, 48, 55, 56, 61, 62, 73, 74, 84, 85, 88, 92, 93,
  100, 101, 102, 103, 104, 105, 106, 107, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132,
  133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 155, 156, 157, 158, 159, 160, 161,
  162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 178, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192,
  193, 194, 208, 210, 211, 212, 213, 214, 215, 216, 222, 225, 226, 227, 228, 229, 234, 235, 236, 237, 238, 239, 240, 241,
  242, 243, 244, 245, 246, 247, 248, 257, 258, 259, 260, 261];

// wz_def (L7030): the step's kind, name and what to do
export function stepDef(k) {
  const kind = k <= 2 || k === 9 || k === 13 || k >= 15 ? 1 : k === 3 ? 2 : k === 4 ? 3 : k === 5 ? 4 : k === 6 ? 5 : k <= 8 || k === 14 ? 6 : k === 11 ? 9 : 8;
  const lab = ['PLAY', 'CUE', 'SHIFT', 'Touch', 'One turn', 'Side of the jog', 'Tempo fader', 'Volume fader', 'Crossfader',
    'Headphone CUE', 'Pads: HOT CUE', 'SHIFT + pad 1', 'Pads: SAMPLER', 'FX ON', 'FX knob', 'FX <', 'FX >'][k];
  return { kind, lab };
}
// wz_sname (L7054)
const SNAME = { 6: 'MIDI channel', 7: 'jog CC', 8: 'jog type', 9: 'jog ticks/s', 12: 'touch note', 14: 'side CC', 15: 'PLAY note',
  16: 'CUE note', 33: 'crossfader side', 34: 'crossfader ch', 35: 'crossfader CC', 46: 'pad channel', 47: 'pad 1 note',
  48: 'SHIFT pad channel', 73: 'sampler channel', 74: 'sampler pad 1', 92: 'tempo CC', 100: 'tempo bits', 105: 'SHIFT pad offset',
  106: 'volume CC', 117: 'cue note', 118: 'pad order', 119: 'tempo direction', 120: 'hot cue pads', 121: 'sampler pads',
  122: 'mixer channel', 180: 'hot cues 5-8 row', 181: 'SHIFT note', 84: 'FX channel', 107: 'FX ON note', 225: 'SHIFT + FX ON',
  85: 'FX knob CC', 163: 'FX knob CC (master type)', 159: 'FX < button', 160: 'FX > button' };
export const sname = (s) => SNAME[s] || 'setting';
// wz_vs (L7064): a value as words
export function vs(s, v) {
  if (s === 8) return ['64-centre', "two's compl.", 'sign bit', 'absolute 7-bit', 'absolute 14-bit', 'CDJ speed', 'platter position'][v] || 'knob turned';
  if (s === 92 && v === 128) return 'pitch bend';
  if ([92, 106, 117, 85, 107, 163, 159, 160, 225].includes(s) && v < 0) return 'none';
  if (s === 84 && v === 0) return 'none';
  if (s === 159 || s === 160 || s === 225) return `ch ${Math.floor(v / 128) + 1} note ${v % 128}`;
  if ((s === 12 || s === 14) && v === 0) return 'none';
  if (s === 100) return v ? '10-bit' : '14-bit';
  if (s === 119) return v ? 'Reversed (+ = high)' : 'Normal (+ = low)';
  if (s === 118) return v ? 'CDJ' : 'straight';
  if (s === 33) return v === 1 ? 'left' : v === 2 ? 'right' : 'off';
  if (s === 122 && v === 0) return "the deck's";
  return String(v);
}
const same = (s, a, b) => (s === 9 ? Math.abs(a - b) <= 0.15 * Math.max(a, 1) : Math.abs(a - b) < 0.001);   // wz_same
const sgn = (v, mode) => (mode === 0 ? v - 64 : mode === 2 ? (v < 64 ? v : 64 - v) : (v < 64 ? v : v - 128));   // wz_sgn
const newRes = () => ({ st: 0, ch: 0, status: 0, num: 0, a: 0, b: 0, c: 0, rem: 0, pairs: [], raw: [] });

export class Learn {
  // snap: the compared preset's settings by slider number (cv and its sliders 33 / 84 / 85); cdeck: the controller's deck 1 / 2
  constructor(snap, cdeck = 1) {
    this.snap = { ...snap };
    this.cdeck = cdeck;
    this.res = Array.from({ length: STEPS }, newRes);
    this.on = true; this.sum = false;
    this.go(0);
  }
  go(k) { this.k = k; Object.assign(this, stepDef(k)); this.reset(); }   // wz_go
  reset() {   // wz_reset
    this.buf = []; this.nl = []; this.H = new Map(); this.T = new Map(); this.V = new Map(); this.L = new Map();
    this.best = -1; this.bestN = 0; this.tch = -1; this.tchOff = 0; this.finT = 0; this.last = null;
    this.res[this.k].raw = [];
  }
  dch() { const r = this.res[0]; return r.st === 1 ? r.ch : this.snap[6]; }   // wz_dch: the deck's channel
  skipNote(h) { const r = this.res[2]; return this.k >= 10 && r.st === 1 && h === (r.ch - 1) * 128 + r.num; }   // SHIFT's own note
  pair(s, v) { const r = this.res[this.k]; if (r.pairs.length < 7) r.pairs.push([s, v]); }
  // a message (wz_feed, L7131, done at once)
  feed(bytes, t) {
    const [m1, m2 = 0, m3 = 0] = bytes;
    if (!this.on || m1 === undefined || m1 >= 0xf0 || this.buf.length >= 1000) return;
    this.buf.push([m1, m2, m3, t]); this.last = [m1, m2, m3];
    const raw = this.res[this.k].raw;
    if (raw.length < 24) raw.push([m1, m2, m3]);
    if (this.finT > 0) return;   // (the step is done: kept for the raw list only)
    const st = m1 & 0xf0;
    if (st === 0xb0 || st === 0xe0) {
      const h = st === 0xe0 ? 2048 + (m1 & 15) : (m1 & 15) * 128 + m2;
      this.H.set(h, (this.H.get(h) || 0) + 1); this.T.set(h, t); this.V.set(h, st === 0xe0 ? (m3 << 7) | m2 : m3);
      if (st === 0xb0 && m3 > 0) this.L.set(h, 1);   // a CC that went above 0 (a CC button)
      if (this.H.get(h) > this.bestN) { this.bestN = this.H.get(h); this.best = h; }
    } else if (st === 0x90 && m3 > 0) {
      const h = (m1 & 15) * 128 + m2;
      if (this.kind === 2 && this.tch < 0) this.tch = h;
      if (!this.skipNote(h) && !this.nl.includes(h) && this.nl.length < 16) this.nl.push(h);
    } else if (st === 0x80 || st === 0x90) {
      if (this.kind === 2 && (m1 & 15) * 128 + m2 === this.tch) this.tchOff = t;
    }
  }
  // the values one CC (h) sent, as a relative jog: the type (-1 = not relative); gOne = only one direction (wz_guess)
  guess(h) {
    let n = 0, a64 = 0, a2c = 0, asb = 0, lo = 0;
    const D = new Uint8Array(128);
    for (const [m1, m2, v] of this.buf) {
      if (m1 !== 0xb0 + Math.floor(h / 128) || m2 !== h % 128) continue;
      n++; D[v] = 1;
      if (v >= 40 && v <= 88 && v !== 64) a64++;
      if ((v >= 1 && v <= 24) || v >= 104) a2c++;
      if ((v >= 1 && v <= 24) || (v >= 65 && v <= 88)) asb++;
      if (v >= 1 && v <= 24) lo++;
    }
    const nd = D.reduce((a, b) => a + b, 0);
    this.gOne = 0; this.gAbs = nd > 40;
    if (this.gAbs) return -1;
    if (a64 === n && D[63] + D[62] + D[61] + D[60] > 0 && D[65] + D[66] + D[67] + D[68] > 0) return 0;
    if (a2c === n && lo > 0 && lo < n) return 1;
    if (asb === n && lo > 0 && lo < n) return 2;
    if (lo === n || a2c === n) { this.gOne = 1; return 1; }
    if (a64 === n) { this.gOne = 1; return 0; }
    return -1;
  }
  // a fader: the CC that moved most, its LSB CC folded in (14-bit: n + 32, 10-bit Reloop: n + 54) (wz_fader)
  fader() {
    const h = this.best, H = (x) => this.H.get(x) || 0, V = (x) => this.V.get(x) || 0;
    if (h >= 2048) return { fc: 128, fch: h - 2048 + 1, fres: 0, fv: V(h) / 16383 };
    const c = Math.floor(h / 128);
    let n = h % 128;
    if (n >= 32 && H(c * 128 + n - 32) > 0) n -= 32; else if (n >= 54 && H(c * 128 + n - 54) > 0) n -= 54;
    const r10 = n < 74 && H(c * 128 + n + 54) > 0 && !(n < 96 && H(c * 128 + n + 32) > 0);
    const fv = r10 ? ((V(c * 128 + n) << 7) | V(c * 128 + n + 54)) / 1023
      : n < 96 && H(c * 128 + n + 32) > 0 ? ((V(c * 128 + n) << 7) | V(c * 128 + n + 32)) / 16383 : V(c * 128 + n) / 127;
    return { fc: n, fch: c + 1, fres: r10 ? 1 : 0, fv };
  }
  // pads: from the d-th note, how many follow in a row (straight) or in the CDJ order (pad 1 = base + 4 .. pad 5 = base)
  run(d) {
    const NL = this.nl, b = NL[d];
    let s = 1;
    while (d + s < NL.length && NL[d + s] === b + s && s < 8) s++;
    let c = 0;
    if (this.k === 10 && b % 128 >= 4) {
      c = 1;
      while (d + c < NL.length && c < 8 && NL[d + c] === (c < 4 ? b + c : b - 4 + c - 4)) c++;
      if (c < 5) c = 0;
    }
    this.rord = c > s ? 1 : 0;
    return Math.max(s, c);
  }
  padsBest() {   // the start (a mode button pressed first is left out) with the longest run
    this.pd = 0; this.pl = 0; this.po = 0;
    for (let d = 0; d < this.nl.length; d++) { const n = this.run(d); if (n > this.pl) { this.pl = n; this.pd = d; this.po = this.rord; } }
  }
  // a step ends: its result (wz_finish, L7210)
  finish(st, t) {
    const raw = this.res[this.k].raw, r = newRes();
    r.raw = raw; r.st = st; this.res[this.k] = r;
    const snap = this.snap, k = this.k, best = this.best;
    if (st === 1) {
      if (this.kind === 1 || this.kind === 9) {
        if (this.nl.length > 0) {
          const h = this.nl[0];
          r.ch = Math.floor(h / 128) + 1; r.status = 0x90; r.num = h % 128;
          if (k === 0) { this.pair(6, r.ch); this.pair(15, r.num); }
          else if (k === 1) { if (r.ch !== this.dch()) r.rem = 4; this.pair(16, r.num); }
          else if (k === 9) { this.pair(117, r.num); this.pair(122, r.ch === this.dch() ? 0 : r.ch); }
          else if (k === 11) {
            const k3 = this.res[10], n = k3.st === 1 ? k3.a : snap[47] + (snap[118] ? 4 : 0);   // the note pad 1 sends
            this.pair(48, r.ch); this.pair(105, Math.max(-64, Math.min(64, r.num - n)));
          } else if (k === 13) {   // FX ON: the video FX channel and note; SHIFT + FX ON keeps its note on the new channel
            this.pair(84, r.ch); this.pair(107, r.num);
            if (snap[225] >= 0) this.pair(225, (r.ch - 1) * 128 + (snap[225] % 128));
          } else if (k === 15) this.pair(159, (r.ch - 1) * 128 + r.num);
          else if (k === 16) this.pair(160, (r.ch - 1) * 128 + r.num);
        } else { r.st = 3; r.rem = 3; r.status = 0xb0; r.num = best % 128; r.ch = Math.floor(best / 128) + 1; }
      } else if (this.kind === 2) {
        if (this.tch >= 0) { r.ch = Math.floor(this.tch / 128) + 1; r.num = this.tch % 128; if (r.ch !== this.dch()) r.rem = 4; } else r.num = 0;
        this.pair(12, r.num);
        if (this.bestN >= 4 && best < 2048) {
          r.a = best % 128; r.c = Math.floor(best / 128) + 1;
          if (r.c !== this.dch()) r.rem = 4;
          const mode = this.guess(best); r.b = mode;
          this.pair(7, r.a);
          if (snap[8] >= 5) { /* a CDJ / Denon preset: its jog is not a relative encoder, the type is not compared */ }
          else if (mode >= 0) { this.pair(8, mode); if (this.gOne && r.rem === 0) r.rem = 2; } else if (this.gAbs && r.rem === 0) r.rem = 1;
        } else r.b = -2;
      } else if (this.kind === 3) {
        const k3 = this.res[3];
        const h = k3.st === 1 && k3.b >= -1 && (this.H.get((k3.c - 1) * 128 + k3.a) || 0) > 0 ? (k3.c - 1) * 128 + k3.a : best;
        const mode = k3.st === 1 && k3.b >= 0 ? k3.b : this.guess(h);
        r.ch = Math.floor(h / 128) + 1; r.status = 0xb0; r.num = h % 128; if (r.ch !== this.dch()) r.rem = 4;
        if (snap[8] >= 5) { r.a = this.H.get(h) || 0; r.rem = 7; }
        else if (mode < 0) { r.st = 3; r.rem = 5; }
        else {
          let tt = 0;
          for (const [m1, m2, v] of this.buf) if (m1 === 0xb0 + Math.floor(h / 128) && m2 === h % 128) tt += sgn(v, mode);
          r.a = Math.abs(tt); r.b = Math.floor(Math.abs(tt) * 100 / 3 / 60 + 0.5);   // ticks per turn x 33 1/3 rpm / 60
          if (!(k3.st === 1 && k3.b >= 0)) { this.pair(7, r.num); this.pair(8, mode); if (this.gOne && r.rem === 0) r.rem = 2; }
          this.pair(9, Math.max(10, Math.min(8000, r.b)));
        }
      } else if (this.kind === 4) {
        r.ch = Math.floor(best / 128) + 1; r.status = 0xb0; r.num = best % 128; if (r.ch !== this.dch()) r.rem = 4;
        const k3 = this.res[3], n = k3.st === 1 && k3.b >= -1 ? k3.a : snap[7];
        this.pair(14, r.num === n ? 0 : r.num);
      } else if (this.kind === 5 || this.kind === 6) {
        const f = this.fader();
        r.ch = f.fch; r.status = f.fc === 128 ? 0xe0 : 0xb0; r.num = f.fc; r.a = f.fres; r.c = f.fv;
        if (k === 6) { if (r.ch !== this.dch()) r.rem = 4; this.pair(92, f.fc); this.pair(100, f.fres); this.pair(119, f.fv > 0.5 ? 1 : 0); }
        else if (k === 7) { this.pair(106, f.fc); this.pair(122, f.fch === this.dch() ? 0 : f.fch); }
        else if (k === 14) {   // the FX knob, on the video FX channel (FX ON's when measured, else the preset's; none = the knob's)
          const k3 = this.res[13], c = k3.st === 1 ? k3.ch : snap[84];
          if (f.fc === 128) r.st = 3;
          else if (c > 0 && c !== f.fch) { r.st = 3; r.rem = 8; r.a = c; }
          else { if (c <= 0) this.pair(84, f.fch); this.pair(snap[85] < 0 && snap[163] >= 0 ? 163 : 85, f.fc); }
        } else { this.pair(34, f.fch); this.pair(35, f.fc); this.pair(33, this.cdeck === 2 ? 2 : 1); }
      } else if (this.kind === 8) {
        this.padsBest();
        if (this.pl === 0) r.st = 3;
        else {
          const h = this.nl[this.pd];
          r.ch = Math.floor(h / 128) + 1; r.status = 0x90; r.a = h % 128; r.b = this.pl;
          r.num = this.po ? r.a - 4 : r.a;   // the base note (CDJ order: pad 1 = base + 4)
          if (this.pl < 2 && this.nl.length > 1) { r.st = 3; r.rem = 6; }
          else if (k === 10) { this.pair(46, r.ch); this.pair(47, r.num); this.pair(120, this.pl); this.pair(118, this.po); }
          else { this.pair(73, r.ch); this.pair(74, r.num); this.pair(121, this.pl); }
        }
      }
    }
    this.finT = t;
  }
  // every frame while a step is open: end the step when its control has been left alone (wz_tick, L7297)
  tick(now) {
    if (!this.on) return;
    const idle = this.bestN > 0 ? now - this.T.get(this.best) : 0;
    if (this.finT > 0) {
      if (now - this.finT > 1.2) { if (this.k + 1 < STEPS) this.go(this.k + 1); else { this.on = false; this.sum = true; } }
      return;
    }
    const kd = this.kind;
    if (kd === 1 || kd === 9) {
      if (this.nl.length > 0 || (this.best >= 0 && this.L.get(this.best) && idle > 0.6 && this.best < 2048)) this.finish(1, now);
    } else if (kd === 2) {
      if ((this.tch >= 0 && this.tchOff > 0 && now - this.tchOff > 1.0 && (this.bestN === 0 || idle > 1.0)) || (this.tch < 0 && this.bestN >= 8 && idle > 1.5)) this.finish(1, now);
    } else if (kd === 3) { if (this.bestN >= 8 && idle > 1.5) this.finish(1, now); }
    else if (kd === 4 || kd === 6) { if (this.bestN >= 4 && idle > 1.0) this.finish(1, now); }
    else if (kd === 5) { if (this.bestN >= 4 && idle > 1.2) this.finish(1, now); }
    else if (kd === 8) { this.padsBest(); if (this.pl >= 8) this.finish(1, now); }
  }
  // the buttons of a step
  back() { this.go(Math.max(0, this.k - 1)); }
  again() { this.go(this.k); }
  skip(now) { this.finish(2, now); this.finT = now - 1.2; }
  done(now) { this.padsBest(); this.finish(this.pl ? 1 : 3, now); }
  stop() { this.on = false; this.sum = true; }

  // the value a step measured for slider s (undefined = none), the last step wins (wz_meas)
  meas(s) {
    let v;
    for (const r of this.res) if (r.st === 1) for (const [a, b] of r.pairs) if (a === s) v = b;
    return v;
  }
  // a step's check: 1 = the same as the preset, 0 = differs or not usable, -1 = nothing to compare (wz_ok)
  ok(k) {
    const r = this.res[k];
    if (r.st === 1 && (r.pairs.length === 0 || r.rem === 7)) return -1;
    if (r.st === 1) return r.rem !== 4 && r.pairs.every(([s, v]) => same(s, this.snap[s], v)) ? 1 : 0;
    return r.st === 3 ? 0 : -1;
  }
  // the remark of a step, or its first difference ("" when all are the same) (wz_why)
  why(k) {
    const r = this.res[k];
    if (r.st === 0) return 'not done';
    if (r.st === 2) return 'skipped';
    if (r.rem === 3) return `sends CC ${r.num}, not a note: not usable here`;
    if (r.rem === 4) return `on MIDI ch ${r.ch}; the deck (PLAY) is on ch ${this.dch()}: not usable`;
    if (r.rem === 5) return 'not a relative jog: the ticks cannot be counted';
    if (r.rem === 6) return "the pads' notes are not in a row: not usable";
    if (r.rem === 1 && k === 3) return 'the jog sends absolute values: type unknown';
    if (r.rem === 7) return `${r.a} jog messages; the preset reads this jog as speed / position: not counted`;
    if (r.rem === 8) return `on MIDI ch ${r.ch}; FX ON is on ch ${r.a}: not usable`;
    if (k === 2 && r.st === 1) return `heard: ch ${r.ch} note ${r.num} (no setting of its own)`;
    if (r.st === 3) return 'nothing usable heard';
    const diff = r.pairs.filter(([s, v]) => !same(s, this.snap[s], v));
    if (diff.length) {
      const [s, v] = diff[0];
      return `${sname(s)}: preset ${vs(s, this.snap[s])}, here ${vs(s, v)}${diff.length > 1 ? ` (+${diff.length - 1} more)` : ''}`;
    }
    return r.rem === 2 ? 'same as the preset (jog type guessed from one direction)' : '';
  }
  // the measured settings to put into the deck (wz_apply: not the steps on another channel)
  applied() {
    const out = {};
    for (const r of this.res) if (r.st === 1 && r.rem !== 4) for (const [s, v] of r.pairs) out[s] = v;
    return out;
  }
  // the deck's section of a .reascratch-preset file (wz_save, L7331)
  text(comparedWith) {
    const L = [`[deck ${this.cdeck}]`, `compared_with = ${comparedWith}`, '# controller settings: measured on the Learn tab, the rest from the preset compared with'];
    for (const s of CTL) {
      const m = this.meas(s), v = m !== undefined ? m : this.snap[s] ?? 0;
      L.push(`slider${s} = ${v === Math.floor(v) ? v : v.toFixed(4)}${m !== undefined ? `    # ${sname(s)} (measured)` : ''}`);
    }
    L.push('# checks against the preset');
    for (let k = 0; k < STEPS; k++) {
      const r = this.res[k], n = this.ok(k), lab = stepDef(k).lab;
      let line = `check ${lab} = ${n === 1 ? 'same' : n === 0 ? 'differs: ' : ''}${n === 1 ? (r.rem === 2 ? ' (jog type guessed)' : '') : this.why(k)}`;
      if (k === 4 && r.st === 1 && r.rem !== 7) line += ` (${r.a} ticks in the turn)`;
      L.push(line);
    }
    L.push('# MIDI heard (the first messages of each step, hex)');
    const hx = (x) => x.toString(16).toUpperCase().padStart(2, '0');
    for (let k = 0; k < STEPS; k++) {
      const raw = this.res[k].raw;
      L.push(`midi ${stepDef(k).lab} =${raw.map((m, j) => `${j ? ',' : ''} ${m.map(hx).join(' ')}`).join('')}`);
    }
    return L.join('\n') + '\n';
  }
}

// a .reascratch-preset file: its name line and each deck's settings (the parser of reascratch_ctl_presets.lua)
export function parsePresetFile(text, fileName = '') {
  let name = fileName.replace(/\.reascratch-preset$/i, ''), cur = 0;
  const decks = {};
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '');
    const d = /^\[deck (\d)\]/.exec(line);
    if (d) { cur = +d[1]; decks[cur] = {}; continue; }
    if (!cur) { const m = /^name\s*=\s*(.*?)\s*$/.exec(line); if (m && m[1]) name = m[1]; continue; }
    const m = /^slider(\d+)\s*=\s*(-?[\d.]+)/.exec(line);
    if (m) decks[cur][+m[1]] = +m[2];
  }
  return { name, decks };
}

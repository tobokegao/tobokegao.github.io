// ReaScratch Web — NI Traktor Kontrol S4 / S3 / S2 through WebHID: a port of the HID bridge (tools/hid_bridge.py).
// The bridge reads the unit's HID input reports and sends MIDI with the DDJ-FLX4's numbers, read by the preset
// "HID bridge (NI S2/S3/S4) deck 1 / deck 2"; here the same MIDI goes to onMidi(bytes, HID_MIDI_NAME + ': ' + model),
// a name matchPresets (midi.js) maps to that preset pair. ReaScratch's lights (light type "Reloop RGB", MIDI from the
// page) come back through unit.lights(bytes) and go out as the unit's LED output reports, as the bridge does.
// Report layouts / LED positions are Mixxx's (as in the bridge); not tried on any unit.
// The parsing (createUnit / unit.handle / unit.leds) is pure: no WebHID needed (web/test/hid_test.mjs).

export const NI = 0x17cc;
export const OUT_TPR = 2880;   // ticks per turn sent to ReaScratch (its preset: 2880 x 33.33 / 60 = 1600 ticks/s)
// the name the MIDI is given: its normalized form "hidbridgenis2s3s4" is the preset's own name (matchPresets)
export const HID_MIDI_NAME = 'HID bridge (NI S2/S3/S4)';

// FLX4 numbers (deck channel = 0 / 1 as MIDI channel index)
export const N_TOUCH = 0x36, N_PLAY = 0x0b, N_CUE = 0x0c, N_SYNC = 0x58, N_RANGE = 0x60, N_SHIFT = 0x3f, N_PFL = 0x54;
export const CC_JOG = 0x22, CC_TEMPO = 0x00, CC_VOL = 0x13;
export const XF_CH = 6, CC_XF = 0x1f;
export const PAD_CH = [7, 9], PAD_SHIFT_CH = [8, 10], SAMPLE_NOTE = 0x30;

// the bridge's defaults (its command-line options)
export const DEFAULT_OPTS = { tempoInvert: false, noMotorOff: false, s4Ticks: 2880, s2Ticks: 600, s3Ticks: 768, mk2Ticks: 1024 };

const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const bit = (b, o, k) => (o < b.length ? (b[o] >> k) & 1 : 0);
const mb = (b, o, mask) => (o < b.length && b[o] & mask ? 1 : 0);   // 1 when any bit of mask is set in byte o
// the step of an 8-bit jog counter (the older units: the lowest byte of the 32-bit field), -128..127
const d8 = (prev, cur) => ((cur - prev + 128) & 255) - 128;
// Python's round() (half to even), for the same LED values as the bridge
const pyRound = (x) => { const f = Math.floor(x), r = x - f; return r > 0.5 ? f + 1 : r < 0.5 ? f : f % 2 === 0 ? f : f + 1; };

// a light value from ReaScratch ("Reloop RGB": 0 = off, bit 6 = bright, RR GG BB; a one-colour button's on = 127)
// -> [r, g, b] 0..1, the dark shade at a third
export function ltRgb(v) {
  if (!v) return [0, 0, 0];
  const k = v & 0x40 ? 1.0 : 1 / 3;
  return [((v >> 4) & 3) / 3 * k, ((v >> 2) & 3) / 3 * k, (v & 3) / 3 * k];
}

// what ReaScratch lights: (channel, note) -> value, from its MIDI out (note on / off)
export class Lights {
  constructor() { this.v = new Map(); }
  midi(data) {
    if (data.length >= 3 && (data[0] & 0xe0) === 0x80) this.v.set((data[0] & 15) * 128 + data[1], data[0] & 0x10 ? data[2] : 0);
  }
  get(ch, n) { return this.v.get(ch * 128 + n) || 0; }
  // deck d's lights as the unit shows them now: the pad mode and SHIFT pick hot cues / their SHIFT layer / samples
  deck(d) {
    const ch = d.ch;
    const smp = [...Array(8)].map((_, i) => this.get(PAD_CH[ch], SAMPLE_NOTE + i));
    const pc = (d.shift ? PAD_SHIFT_CH : PAD_CH)[ch];
    const pads = d.padMode === 'samples' ? smp.slice() : [...Array(8)].map((_, i) => this.get(pc, i));
    return { play: this.get(ch, N_PLAY), cue: this.get(ch, N_CUE), sync: this.get(ch, N_SYNC), pfl: this.get(ch, N_PFL), pads, samples: smp };
  }
}

// the S4 MK3's / S3's colours (Mixxx's S4MK3.js colour map): a hue's value, + a brightness 0..3
const HUES = [[0xcc0000, 4], [0xcc5e00, 8], [0xcc7800, 12], [0xcc9200, 16], [0xcccc00, 20], [0x81cc00, 24], [0x00cc00, 28],
  [0x00cc49, 32], [0x00cccc, 36], [0x0091cc, 40], [0x0000cc, 44], [0xcc00cc, 48], [0xad65ff, 52], [0xcc0079, 56],
  [0xcc477e, 60], [0xcc4761, 64], [0xcccccc, 68]];
// the S2 MK3's pad palette (S2MK3.js PadColorMap): the bright value of each hue (the dark one = 2 below)
const S2_PADS = [[0xff2916, 0x06], [0xfd5921, 0x0a], [0xfd7bab, 0x0e], [0xf8ab36, 0x12], [0xe9ba3d, 0x16], [0xb6b959, 0x1a],
  [0x2ccf68, 0x1e], [0x3fd2b0, 0x22], [0x0de1ff, 0x26], [0x00c3ff, 0x2a], [0x00a1ff, 0x2e], [0xe298fe, 0x32],
  [0xf263e3, 0x36], [0xfc4dc0, 0x3a], [0xfb359f, 0x3e], [0xfb3672, 0x42]];

// the table's value whose colour is the nearest to rgb by hue (both scaled to their brightest part)
function nearest(rgb, table) {
  const m = Math.max(...rgb) || 1;
  const c = rgb.map((x) => x / m);
  let best = null, bv = 9.0;
  for (const [col, val] of table) {
    const t = [(col >> 16) & 255, (col >> 8) & 255, col & 255];
    const tm = Math.max(...t);
    let d = 0;
    for (let i = 0; i < 3; i++) d += (c[i] - t[i] / tm) ** 2;
    if (d < bv) { best = val; bv = d; }
  }
  return best;
}

const isWhite = (v) => !!v && ((v >> 4) & 3) === ((v >> 2) & 3) && ((v >> 2) & 3) === (v & 3);
// the older units' faders reach 16..4080 (Mixxx's ends): stretch to 0..4095
const stretch12 = (v) => Math.max(0, Math.min(4095, Math.floor((v - 16) * 4095 / 4064)));

class Deck {
  constructor(send, ch) {
    this.send = send; this.ch = ch;
    this.btn = {}; this.shift = 0; this.padMode = 'hotcue'; this.heldPads = new Map();
    this.tempo = null; this.vol = null; this.jogAcc = 0.0;
  }
  note(n, on, ch = this.ch) { this.send((on ? 0x90 : 0x80) | ch, n, on ? 127 : 0); }
  // true / false on a change of a button, null when unchanged
  edge(name, v) {
    const old = this.btn[name] || 0;
    this.btn[name] = v;
    return v === old ? null : !!v;
  }
  // touch null = sent apart (touch()); smpToggle: one SAMPLES button flips hot cue / samples (S2 MK1 / MK2);
  // smpPads: pads that always pick a sample (the S4 MK2's REMIX row)
  buttons(play, cue, sync, shift, touch, pfl, modeHot, modeSmp, pads, smpToggle = false, smpPads = []) {
    let e = this.edge('shift', shift);
    if (e !== null) { this.shift = e ? 1 : 0; this.note(N_SHIFT, e); }
    for (const [name, v, n] of [['play', play, N_PLAY], ['cue', cue, N_CUE], ['touch', touch, N_TOUCH], ['pfl', pfl, N_PFL]]) {
      if (v === null) continue;
      e = this.edge(name, v);
      if (e !== null) this.note(n, e);
    }
    e = this.edge('sync', sync);
    if (e !== null) this.note(this.shift ? N_RANGE : N_SYNC, e);
    if (this.edge('mode_hot', modeHot)) this.padMode = 'hotcue';
    if (this.edge('mode_smp', modeSmp)) this.padMode = smpToggle && this.padMode === 'samples' ? 'hotcue' : 'samples';
    pads.forEach((v, i) => {
      const e2 = this.edge(`pad${i}`, v);
      if (e2 === true) {
        const cn = this.padMode === 'samples' ? [PAD_CH[this.ch], SAMPLE_NOTE + i] : [(this.shift ? PAD_SHIFT_CH : PAD_CH)[this.ch], i];
        this.heldPads.set(i, cn);
        this.note(cn[1], true, cn[0]);
      } else if (e2 === false && this.heldPads.has(i)) {
        const [ch, n] = this.heldPads.get(i);
        this.heldPads.delete(i);
        this.note(n, false, ch);
      }
    });
    smpPads.forEach((v, i) => {
      const e2 = this.edge(`spad${i}`, v);
      if (e2 !== null) this.note(SAMPLE_NOTE + i, e2, PAD_CH[this.ch]);
    });
  }
  touch(v) { const e = this.edge('touch', v); if (e !== null) this.note(N_TOUCH, e); }
  // ticks of the unit -> OUT_TPR ticks, 64-centre steps of at most 63
  jog(ticks, tpr) {
    this.jogAcc += ticks * OUT_TPR / tpr;
    let t = Math.trunc(this.jogAcc);
    this.jogAcc -= t;
    while (t) {
      const s = Math.max(-63, Math.min(63, t));
      this.send(0xb0 | this.ch, CC_JOG, 64 + s);
      t -= s;
    }
  }
  tempo12(v, invert) {
    v = invert ? 4095 - v : v;
    const v14 = Math.min(16383, v * 4 + (v >> 10));
    if (v14 !== this.tempo) {
      this.tempo = v14;
      this.send(0xb0 | this.ch, CC_TEMPO, v14 >> 7);
      this.send(0xb0 | this.ch, CC_TEMPO + 32, v14 & 127);
    }
  }
  volume12(v) {
    const v7 = Math.floor(v * 127 / 4095);
    if (v7 !== this.vol) { this.vol = v7; this.send(0xb0 | this.ch, CC_VOL, v7); }
  }
}

class Mixer {
  constructor(send) { this.send = send; this.xf = null; }
  crossfader12(v) {
    const v14 = Math.min(16383, v * 4 + (v >> 10));
    if (v14 !== this.xf) {
      this.xf = v14;
      this.send(0xb0 | XF_CH, CC_XF, v14 >> 7);
      this.send(0xb0 | XF_CH, CC_XF + 32, v14 & 127);
    }
  }
}

class Unit {
  constructor(send, opts) {
    this.decks = [new Deck(send, 0), new Deck(send, 1)];
    this.mix = new Mixer(send);
    this.opts = { ...DEFAULT_OPTS, ...opts };
  }
  // reports to write once at start: [[reportId, Uint8Array without the ID]]
  startReports() { return []; }
}

class S4MK3 extends Unit {
  static PADS_L = [[4, 5], [4, 4], [4, 7], [4, 6], [4, 3], [4, 2], [4, 1], [4, 0]];
  static PADS_R = [[14, 5], [14, 4], [14, 7], [14, 6], [14, 3], [14, 2], [14, 1], [14, 0]];
  constructor(send, opts) { super(send, opts); this.pos = [null, null]; }
  handle(b) {
    const rid = b[0];
    if (rid === 1 && b.length >= 19) {
      const [L, R] = this.decks;
      L.buttons(bit(b, 5, 0), bit(b, 5, 1), bit(b, 6, 7), bit(b, 6, 1), bit(b, 17, 4), bit(b, 8, 3),
        bit(b, 5, 2), bit(b, 5, 4), S4MK3.PADS_L.map(([o, k]) => bit(b, o, k)));
      R.buttons(bit(b, 13, 0), bit(b, 15, 5), bit(b, 15, 4), bit(b, 15, 1), bit(b, 17, 5), bit(b, 8, 6),
        bit(b, 13, 2), bit(b, 13, 4), S4MK3.PADS_R.map(([o, k]) => bit(b, o, k)));
    } else if (rid === 2 && b.length >= 15) {
      const inv = !this.opts.tempoInvert;
      this.mix.crossfader12(u16(b, 1));
      this.decks[0].volume12(u16(b, 3));
      this.decks[1].volume12(u16(b, 5));
      this.decks[0].tempo12(u16(b, 13), inv);
      this.decks[1].tempo12(u16(b, 11), inv);
    } else if (rid === 3 && b.length >= 44) {
      [[0, 12], [1, 40]].forEach(([i, off]) => {
        const p = u32(b, off);
        if (this.pos[i] !== null) {
          let d = (p - this.pos[i]) >>> 0;
          if (d >= 2 ** 31) d -= 2 ** 32;
          if (d) this.decks[i].jog(d, this.opts.s4Ticks);
        }
        this.pos[i] = p;
      });
    }
  }
  // jog motors: torque 0 (as Mixxx does)
  startReports() { return this.opts.noMotorOff ? [] : [[49, Uint8Array.from([1, 0x20, 1, 0, 0, 1, 0x20, 1, 0, 0])]]; }
}
Object.assign(S4MK3, { pid: 0x1720, model: 'Traktor Kontrol S4 MK3', upage: 0xff01 });

class S2MK3 extends Unit {
  static PADS_L = [[2, 0x10], [2, 0x20], [2, 0x40], [2, 0x80], [3, 0x01], [3, 0x02], [3, 0x04], [3, 0x08]];
  static PADS_R = [[5, 0x40], [5, 0x80], [6, 0x01], [6, 0x02], [6, 0x04], [6, 0x08], [6, 0x10], [6, 0x20]];
  constructor(send, opts) { super(send, opts); this.tick = [null, null]; }
  handle(b) {
    const rid = b[0], m = mb;
    if (rid === 1 && b.length >= 20) {
      const [L, R] = this.decks;
      L.buttons(m(b, 2, 8), m(b, 2, 4), m(b, 2, 1), m(b, 1, 0x20), m(b, 8, 0x40), m(b, 4, 1),
        m(b, 1, 0x40), m(b, 1, 0x80), S2MK3.PADS_L.map(([o, k]) => m(b, o, k)));
      R.buttons(m(b, 5, 0x20), m(b, 5, 0x10), m(b, 5, 4), m(b, 4, 0x80), m(b, 8, 0x80), m(b, 4, 2),
        m(b, 5, 1), m(b, 5, 2), S2MK3.PADS_R.map(([o, k]) => m(b, o, k)));
      [[0, 0x0c], [1, 0x10]].forEach(([i, off]) => {
        const t = u32(b, off) & 0x3ff;
        if (this.tick[i] !== null) {
          let d = t - this.tick[i];
          d = d > 512 ? d - 1024 : d < -512 ? d + 1024 : d;
          if (d) this.decks[i].jog(d, this.opts.s2Ticks);
        }
        this.tick[i] = t;
      });
    } else if (rid === 2 && b.length >= 11) {
      const inv = !this.opts.tempoInvert;
      this.decks[0].tempo12(u16(b, 1), inv);
      this.decks[1].tempo12(u16(b, 9), inv);
      this.decks[0].volume12(u16(b, 3));
      this.decks[1].volume12(u16(b, 7));
      this.mix.crossfader12(u16(b, 5));
    }
  }
}
Object.assign(S2MK3, { pid: 0x1710, model: 'Traktor Kontrol S2 MK3', upage: 0xff01 });

// the older units: report 1 = buttons + jogs (the lowest byte of 32-bit fields counts the jog's steps), report 2 =
// faders (16..4080). Per class: JOG (offsets), TPR (the ticks-per-turn option), FADERS (offsets in report 2)
class Old8 extends Unit {
  constructor(send, opts) { super(send, opts); this.tick = [null, null]; }
  jogs(b) {
    const C = this.constructor;
    C.JOG.forEach((off, i) => {
      const t = b[off];
      if (this.tick[i] !== null) {
        const d = d8(this.tick[i], t);
        if (d) this.decks[i].jog(d, this.opts[C.TPR]);
      }
      this.tick[i] = t;
    });
  }
  faders(b) {
    const f = this.constructor.FADERS, inv = !this.opts.tempoInvert;
    this.decks[0].tempo12(stretch12(u16(b, f.tempo[0])), inv);
    this.decks[1].tempo12(stretch12(u16(b, f.tempo[1])), inv);
    this.decks[0].volume12(stretch12(u16(b, f.vol[0])));
    this.decks[1].volume12(stretch12(u16(b, f.vol[1])));
    this.mix.crossfader12(stretch12(u16(b, f.xf)));
  }
}
Object.assign(Old8, { JOG: [0x01, 0x05], TPR: 'mk2Ticks', FADERS: {} });
const ROW = [0x80, 0x40, 0x20, 0x10];

class S3 extends Old8 {
  static PADS_L = [[3, 0x02], [3, 0x04], [3, 0x08], [3, 0x10], [3, 0x20], [3, 0x40], [3, 0x80], [4, 0x01]];
  static PADS_R = [[6, 0x04], [6, 0x08], [6, 0x10], [6, 0x20], [6, 0x40], [6, 0x80], [7, 0x01], [7, 0x02]];
  handle(b) {
    if (b[0] === 1 && b.length >= 0x16) {
      const [L, R] = this.decks;
      L.buttons(mb(b, 3, 0x01), mb(b, 2, 0x80), mb(b, 2, 0x08), mb(b, 1, 0x01), mb(b, 0x0a, 0x10), mb(b, 8, 0x01),
        mb(b, 2, 0x20), mb(b, 2, 0x40), S3.PADS_L.map(([o, k]) => mb(b, o, k)));
      R.buttons(mb(b, 6, 0x02), mb(b, 6, 0x01), mb(b, 5, 0x10), mb(b, 4, 0x02), mb(b, 0x0a, 0x20), mb(b, 8, 0x02),
        mb(b, 5, 0x40), mb(b, 5, 0x80), S3.PADS_R.map(([o, k]) => mb(b, o, k)));
      this.jogs(b);
    } else if (b[0] === 2 && b.length >= 0x0f) this.faders(b);
  }
}
Object.assign(S3, { pid: 0x1900, model: 'Traktor Kontrol S3', upage: 0xff01, JOG: [0x0e, 0x12], TPR: 's3Ticks',
  FADERS: { tempo: [0x01, 0x0d], vol: [0x05, 0x07], xf: 0x0b } });

class S2MK2 extends Old8 {
  handle(b) {
    if (b[0] === 1 && b.length >= 0x0d) {
      const [L, R] = this.decks;
      L.buttons(mb(b, 0x0b, 1), mb(b, 0x0b, 2), mb(b, 0x0b, 4), mb(b, 0x0b, 8), mb(b, 0x0a, 1), mb(b, 0x0c, 0x10),
        0, mb(b, 0x0c, 0x02), ROW.map((k) => mb(b, 0x0b, k)), true);
      R.buttons(mb(b, 9, 1), mb(b, 9, 2), mb(b, 9, 4), mb(b, 9, 8), mb(b, 0x0a, 2), mb(b, 0x0a, 0x10),
        0, mb(b, 0x0c, 0x01), ROW.map((k) => mb(b, 9, k)), true);
      this.jogs(b);
    } else if (b[0] === 2 && b.length >= 0x17) this.faders(b);
  }
}
Object.assign(S2MK2, { pid: 0x1320, model: 'Traktor Kontrol S2 MK2', upage: null,
  FADERS: { tempo: [0x07, 0x09], vol: [0x13, 0x15], xf: 0x05 } });

class S4MK2 extends Old8 {
  // by length, as Mixxx does: 21 = report 1; report 2 = 79 bytes (Windows) or 64 bytes + a 15-byte rest without an ID
  // (macOS / Linux hidapi). Every fader read is within the first 64 bytes; the 15-byte rest is dropped
  handle(b) {
    const n = b.length;
    if (n === 15) return;
    if (b[0] === 1 && n === 21) {
      const [L, R] = this.decks;
      L.buttons(mb(b, 0x0d, 1), mb(b, 0x0d, 2), mb(b, 0x0d, 4), mb(b, 0x0d, 8), mb(b, 0x11, 1), mb(b, 0x0f, 0x40),
        0, 0, ROW.map((k) => mb(b, 0x0d, k)), false, ROW.map((k) => mb(b, 0x0e, k)));
      R.buttons(mb(b, 0x0c, 1), mb(b, 0x0c, 2), mb(b, 0x0c, 4), mb(b, 0x0c, 8), mb(b, 0x11, 2), mb(b, 0x0a, 0x40),
        0, 0, ROW.map((k) => mb(b, 0x0c, k)), false, ROW.map((k) => mb(b, 0x0b, k)));
      this.jogs(b);
    } else if (b[0] === 2 && (n === 64 || n === 79)) this.faders(b);
  }
}
Object.assign(S4MK2, { pid: 0x1310, model: 'Traktor Kontrol S4 MK2', upage: 0xff01,
  FADERS: { tempo: [0x09, 0x0b], vol: [0x37, 0x39], xf: 0x07 } });

// the top touch is a pressure value (report 2): touched above the unit's calibration (feature report 0xD4: idle /
// pressed, big-endian, left then right), with a little hysteresis; without it the first value = idle, touch = +150
class S2MK1 extends Old8 {
  constructor(send, opts) { super(send, opts); this.cal = [null, null]; }
  // rep = the feature report 0xD4 with its ID as byte 0
  calibrate(rep) {
    if (rep && rep.length >= 9) {
      const be = (o) => (rep[o] << 8) | rep[o + 1];
      this.cal = [[be(1), be(3)], [be(5), be(7)]];
    }
  }
  handle(b) {
    if (b[0] === 1 && b.length >= 0x0e) {
      const [L, R] = this.decks;
      L.buttons(mb(b, 0x0d, 0x10), mb(b, 0x0d, 0x20), mb(b, 0x0d, 0x40), mb(b, 0x0d, 0x80), null, mb(b, 9, 0x80),
        0, mb(b, 0x0b, 0x02), [0x08, 0x04, 0x02, 0x01].map((k) => mb(b, 0x0d, k)), true);
      R.buttons(mb(b, 0x0c, 0x10), mb(b, 0x0c, 0x20), mb(b, 0x0c, 0x40), mb(b, 0x0c, 0x80), null, mb(b, 0x0b, 0x80),
        0, mb(b, 0x0b, 0x01), [0x08, 0x04, 0x02, 0x01].map((k) => mb(b, 0x0c, k)), true);
      this.jogs(b);
    } else if (b[0] === 2 && b.length >= 0x31) {
      this.faders(b);
      [0x0d, 0x1d].forEach((off, i) => {
        const v = u16(b, off);
        if (this.cal[i] === null) this.cal[i] = [v, v + S2MK1.JOG_GUESS];
        const [idle, pressed] = this.cal[i];
        const span = Math.max(1, pressed - idle);
        const was = this.decks[i].btn.touch || 0;
        this.decks[i].touch(v > idle + span * (was ? 0.4 : 0.6) ? 1 : 0);   // on at 60 % of the way, off below 40 %
      });
    }
  }
}
Object.assign(S2MK1, { pid: 0x1101, model: 'Traktor Kontrol S2 MK1', upage: null, JOG_GUESS: 150,
  FADERS: { tempo: [0x0f, 0x1f], vol: [0x2b, 0x2d], xf: 0x2f } });

// ---- lights: the whole LED reports ({id: Uint8Array with the ID as byte 0}), from Mixxx's mappings (as the bridge).
// The pad mode / SHIFT buttons show the unit's own state (the units keep none)
function palPad(v, bright, dim, white = 68) {   // S4 MK3 / S3: a hue + a brightness; 0 = off
  if (!v) return 0;
  return (isWhite(v) ? white : nearest(ltRgb(v), HUES)) + (v & 0x40 ? bright : dim);
}
const rgbOf = (v, top) => ltRgb(v).map((x) => pyRound(x * top));
const one127 = (v, dim) => (!v ? 0 : v & 0x40 ? 0x7f : dim);
const rep = (n, id) => { const r = new Uint8Array(n); r[0] = id; return r; };

S4MK3.prototype.leds = function (L) {
  const r = rep(95, 0x80);
  const one = (v) => (!v ? 0 : v & 0x40 ? 70 : 68);   // white + 2 (Mixxx's on) / + 0
  [[56, 9, 15, 60, 10, 58, 1, 78], [67, 32, 38, 71, 33, 69, 24, 82]].forEach(([play, cue, sync, shift, hot, smp, pad0, pfl], k) => {
    const d = this.decks[k], s = L.deck(d);
    r[play] = one(s.play); r[cue] = one(s.cue); r[sync] = one(s.sync); r[pfl] = one(s.pfl);
    r[shift] = d.shift ? 70 : 0;
    r[hot] = d.padMode === 'hotcue' ? 70 : 0;
    r[smp] = d.padMode === 'samples' ? 70 : 0;
    s.pads.forEach((v, i) => { r[pad0 + i] = palPad(v, 2, 0); });
  });
  return { 0x80: r };
};

S2MK3.prototype.leds = function (L) {
  const r = rep(62, 0x80);
  const one = (v) => (!v ? 0 : v & 0x40 ? 0x7e : 0x7c);
  const pad = (v) => {
    if (!v) return 0x02;   // Mixxx's "completely off" for the pads
    if (isWhite(v)) return v & 0x40 ? 0x7e : 0x7c;
    const b = nearest(ltRgb(v), S2_PADS);
    return v & 0x40 ? b : b - 2;
  };
  [[0x0c, 0x0b, 0x09, 0x1a, 0x06, 0x07, 0x08, 0x0d], [0x33, 0x32, 0x30, 0x1b, 0x2d, 0x2e, 0x2f, 0x34]].forEach(([play, cue, sync, pfl, shift, hot, smp, pad0], k) => {
    const d = this.decks[k], s = L.deck(d);
    r[play] = one(s.play); r[cue] = one(s.cue); r[sync] = one(s.sync); r[pfl] = one(s.pfl);
    r[shift] = d.shift ? 0x7e : 0;
    r[hot] = d.padMode === 'hotcue' ? 0x7e : 0;
    r[smp] = d.padMode === 'samples' ? 0x7e : 0;
    s.pads.forEach((v, i) => { r[pad0 + i] = pad(v); });
  });
  return { 0x80: r };
};

S3.prototype.leds = function (L) {
  const r = rep(83, 0x80);
  const one = (v) => (!v ? 0 : v & 0x40 ? 0x47 : 0x45);   // white + 3 / + 1
  [[0x11, 0x10, 0x0c, 0x39, 0x01, 0x0e, 0x0f, 0x12], [0x2a, 0x29, 0x25, 0x3a, 0x1a, 0x27, 0x28, 0x2b]].forEach(([play, cue, sync, pfl, shift, hot, smp, pad0], k) => {
    const d = this.decks[k], s = L.deck(d);
    r[play] = s.play ? 0x77 : 0x20;   // PLAY / SHIFT / PFL: one colour (Mixxx's values)
    r[pfl] = s.pfl ? 0xff : 0x04;
    r[shift] = d.shift ? 0x77 : 0x20;
    r[cue] = one(s.cue); r[sync] = one(s.sync);
    r[hot] = d.padMode === 'hotcue' ? 0x47 : 0;
    r[smp] = d.padMode === 'samples' ? 0x47 : 0;
    s.pads.forEach((v, i) => { r[pad0 + i] = palPad(v, 3, 1, 0x44); });
  });
  return { 0x80: r };
};

S4MK2.prototype.leds = function (L) {
  const a = rep(63, 0x81), b = rep(61, 0x82);
  [[0x20, 0x1f, 0x1e, 0x1d, 0x01, 0x19, 0x18], [0x28, 0x27, 0x26, 0x25, 0x0d, 0x21, 0x19]].forEach(([play, cue, sync, shift, hot0, remix0, pfl], k) => {
    const d = this.decks[k], s = L.deck(d);
    a[play] = one127(s.play, 9); a[cue] = one127(s.cue, 9); a[sync] = one127(s.sync, 9);
    a[shift] = d.shift ? 0x7f : 0;
    b[pfl] = one127(s.pfl, 9);
    for (let i = 0; i < 4; i++) {
      a.set(rgbOf(s.pads[i], 0x7f), hot0 + 3 * i);
      a[remix0 + i] = one127(s.samples[i], 9);
    }
  });
  return { 0x81: a, 0x82: b };
};

S2MK2.prototype.leds = function (L) {
  const top = rep(39, 0x80), bot = rep(34, 0x81);
  [[0x1c, 0x1b, 0x1a, 0x19, 0x01, 0x1b], [0x20, 0x1f, 0x1e, 0x1d, 0x0d, 0x1f]].forEach(([play, cue, sync, shift, pad0, pfl], k) => {
    const d = this.decks[k], s = L.deck(d);
    bot[play] = one127(s.play, 1); bot[cue] = one127(s.cue, 1); bot[sync] = one127(s.sync, 1);
    bot[shift] = d.shift ? 0x7f : 0;
    top[pfl] = one127(s.pfl, 1);
    for (let i = 0; i < 4; i++) bot.set(rgbOf(s.pads[i], 0x7f), pad0 + 3 * i);
  });
  return { 0x80: top, 0x81: bot };
};

// values 0..0x1F; the pads have green and blue only (no red in Mixxx's mapping): red is shown as blue
S2MK1.prototype.leds = function (L) {
  const r = rep(62, 0x80);
  const one = (v) => (!v ? 0 : v & 0x40 ? 0x1f : 0x08);
  [[0x03, 0x07, 0x04, 0x08, 0x20, 0x35, [[0x0c, 0x10], [0x0b, 0x0f], [0x0a, 0x0e], [0x09, 0x0d]]],
    [0x23, 0x27, 0x24, 0x28, 0x1d, 0x34, [[0x2c, 0x30], [0x2b, 0x2f], [0x2a, 0x2e], [0x29, 0x2d]]]].forEach(([play, cue, sync, shift, pfl, smp, pads], k) => {
    const d = this.decks[k], s = L.deck(d);
    r[play] = one(s.play); r[cue] = one(s.cue); r[sync] = one(s.sync); r[pfl] = one(s.pfl);
    r[shift] = d.shift ? 0x1f : 0;
    r[smp] = d.padMode === 'samples' ? 0x1f : 0;
    pads.forEach(([go, bo], i) => { const [rr, g, bb] = rgbOf(s.pads[i], 0x1f); r[go] = g; r[bo] = Math.max(bb, rr); });
  });
  return { 0x80: r };
};

export const MODELS = [S4MK3, S2MK3, S3, S4MK2, S2MK2, S2MK1];

// the units the page may ask for (requestDevice): by the vendor-defined usage page where the bridge picks one
export const HID_FILTERS = MODELS.map((c) => (c.upage ? { vendorId: NI, productId: c.pid, usagePage: c.upage } : { vendorId: NI, productId: c.pid }));

// the model class for a product id, or null
export const modelFor = (productId) => MODELS.find((c) => c.pid === productId) || null;

// a unit's parser without WebHID: send(status, d1, d2) gets each MIDI message the bridge would send.
// unit.handle(bytes: report ID as byte 0, then the report's data, as hidapi reads it)
// unit.leds(lights) -> {reportId: Uint8Array (ID as byte 0)}; unit.startReports() -> [[id, data]]
export function createUnit(modelOrPid, send, opts = {}) {
  const C = typeof modelOrPid === 'number' ? modelFor(modelOrPid) : MODELS.find((c) => c === modelOrPid || c.model === modelOrPid);
  if (!C) throw new Error(`not a supported unit: ${modelOrPid}`);
  return new C((st, d1, d2) => send(st, d1 & 127, d2 & 127), opts);
}

// ---- WebHID ----
// Asks for a unit (call from a user gesture), opens it, and sends its MIDI to onMidi([status, d1, d2], deviceName).
// onStatus(text) tells what happens. Returns {name, model, device, lights(bytes), close()} or null (nothing chosen).
// lights(bytes): ReaScratch's light MIDI (note on / off, "Reloop RGB" values) for this unit; the LEDs are left alone
// until it is first called (as the bridge without its "ReaScratch LED" port). close() turns them off.
export async function connectHid(onMidi, onStatus = () => {}, opts = {}) {
  if (!navigator.hid) { onStatus('WebHID is not available in this browser (use Chrome or Edge on a desktop)'); return null; }
  let devs;
  try {
    devs = await navigator.hid.requestDevice({ filters: HID_FILTERS });
  } catch (e) { onStatus(`could not ask for a HID device: ${e.message}`); return null; }
  // one HIDDevice per collection: take one whose collections have the bridge's usage page
  const pick = devs.find((d) => {
    const C = modelFor(d.productId);
    return C && d.vendorId === NI && (!C.upage || d.collections.some((c) => c.usagePage === C.upage));
  });
  if (!pick) { onStatus(devs.length ? 'not a supported unit' : 'no unit chosen'); return null; }
  const C = modelFor(pick.productId);
  const name = `${HID_MIDI_NAME}: ${C.model}`;
  try {
    if (!pick.opened) await pick.open();
  } catch (e) { onStatus(`could not open ${C.model}: ${e.message} (another program may hold it, e.g. Traktor on macOS)`); return null; }
  const unit = createUnit(C, (st, d1, d2) => onMidi([st, d1, d2], name), opts);
  let lights = null, closed = false;
  const sent = new Map();   // report id -> the bytes written last
  let busy = false, again = false;
  // write the LED reports that changed (one write at a time; a request during a write is done after it)
  const flush = async () => {
    if (!lights || closed) return;
    if (busy) { again = true; return; }
    busy = true;
    try {
      do {
        again = false;
        for (const [id, r] of Object.entries(unit.leds(lights))) {
          const prev = sent.get(+id);
          if (prev && prev.length === r.length && prev.every((x, i) => x === r[i])) continue;
          await pick.sendReport(+id, r.subarray(1));
          sent.set(+id, r);
        }
      } while (again && !closed);
    } catch (e) { onStatus(`lights: ${e.message}`); } finally { busy = false; }
  };
  const onReport = (ev) => {
    const b = new Uint8Array(ev.data.byteLength + 1);
    b[0] = ev.reportId;
    b.set(new Uint8Array(ev.data.buffer, ev.data.byteOffset, ev.data.byteLength), 1);
    unit.handle(b);
    if (lights) flush();   // SHIFT / the pad mode change what the pads show
  };
  pick.addEventListener('inputreport', onReport);
  const onGone = (ev) => {
    if (ev.device !== pick) return;
    closed = true;
    pick.removeEventListener('inputreport', onReport);
    navigator.hid.removeEventListener('disconnect', onGone);
    onStatus(`lost: ${C.model}`);
  };
  navigator.hid.addEventListener('disconnect', onGone);
  try {
    for (const [id, data] of unit.startReports()) await pick.sendReport(id, data);
    if (C === S2MK1) {
      try {
        const v = await pick.receiveFeatureReport(0xd4);
        let r = new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
        if (r[0] !== 0xd4 || r.length < 9) r = Uint8Array.from([0xd4, ...r]);   // with or without its ID (by platform)
        unit.calibrate(r);
      } catch { /* a guess from the first values, as the bridge */ }
      onStatus(`jog touch calibration: ${unit.cal[0] ? JSON.stringify(unit.cal) : 'not read (a guess from the first values)'}`);
    }
  } catch (e) { onStatus(`start: ${e.message}`); }
  onStatus(`connected: ${C.model}`);
  return {
    name, model: C.model, device: pick, unit,
    lights(bytes) { if (closed) return; if (!lights) lights = new Lights(); lights.midi(bytes); flush(); },
    async close() {
      if (closed) return;
      if (lights) {   // every LED report as zeros (as the bridge on Ctrl+C)
        try { for (const [id, r] of Object.entries(unit.leds(new Lights()))) await pick.sendReport(+id, new Uint8Array(r.length - 1)); } catch { /* gone */ }
      }
      closed = true;
      pick.removeEventListener('inputreport', onReport);
      navigator.hid.removeEventListener('disconnect', onGone);
      try { await pick.close(); } catch { /* already closed */ }
      onStatus(`closed: ${C.model}`);
    },
  };
}

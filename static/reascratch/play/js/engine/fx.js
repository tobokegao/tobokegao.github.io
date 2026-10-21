// ReaScratch Web — one deck's sound effects and DJ filter, ported from kit/Effects/ReaScratch/reascratch.jsfx.
// Per block: L4523-L4537 (DJ filter knobs), L4579-L4585 (auto gain), L5174-L5248 (the FX amounts and coefficients).
// Per sample: L5723-L5941 (after the rate-following low cut, before the output stage), in the JSFX's order.
// Helpers: L645-L803 (Mirror's taps, Disc's phono EQ, nan_reset, the vocoder's YIN / analysis), L1085-L1365 (DJ filter).
// Line numbers (Lnnnn) point at reascratch.jsfx so the two can be compared. Units as in deck.js.
//
// The DJ filter's models are ported from Saike FM Filter 2 (Saike_Yutani_filters.jsfx-inc) and the elliptic half-band of
// Saike's protosynth: MIT License, Copyright (c) 2022 Joep Vanlier. The full licence text:
// kit/Effects/ReaScratch/LICENSE_Saike_filters.txt. The Moog model after S. D'Angelo and V. Valimaki, "Generalized Moog
// Ladder Filter: Part II", IEEE TASLP 22(12), 2014. Changes as in the JSFX (L1101-L1104): cutoff in Hz from one knob,
// Moog / Ladder's output sign flipped, the Steiner state curve written as s/(1+|s|), a DC blocker after, NaN -> reset.
//
// Use (see the report / deck.js): fx.set(params) from the page; fx.block(n, ctx) once per block; per sample, when the
// deck is not idle, fx.sample(l, r, beat) then read fx.l / fx.r; when idle (the JSFX's sl_lite) fx.idle().

const PI = Math.PI, TAU = 2 * Math.PI;
// delay line sizes (L629-L662; all powers of two, so `& (N - 1)` is the JSFX's `% N`)
const ED_N = 262144, CHN = 8192, HSN = 8192, VTN = 1024, VXN = 16384, VPN = 16384, FLN = 2048, MRN = 8192, HGN = 16384;

export const FX_DEFAULTS = {
  // video FX (their sounds): this deck's and the master's (s82 / s83, s86 / s87). Types: 1 Tint, 2 Hue rotate, 3 Invert,
  // 4 Threshold, 5 Mirror, 6 Kaleidoscope, 7 LoRez, 8 Shift RGB, 9 Strobe, 10 Trails, 11 VHS, 12 Disc, 13 Line art,
  // 14 Halftone, 15 Zoom blur
  vfxType: 0, vfxAmt: 0,
  mfxType: 0, mfxAmt: 0,
  // knob / pad amounts by type (tk_*, tf_a / tfb_a / fk_amt; L5183-L5189): index 1..15 as above, 16 = vibrato
  touch: null,
  // each type's own sound amount (fxs(i) = 1 - gmem[150 + i], L3745): index 1..16, default 1
  fxs: null,
  echo: 0,        // s197 echo fader (picture: Trails)
  crush: 0,       // s198 bitcrusher fader (picture: LoRez)
  vib: 0,         // s199 vibrato fader (pitch end of s52: vocoder, tape end: moving delay)
  strobeKnob: 0,  // s207 Strobe knob (0.05 dead zone, fxk_dz L3566)
  fxSound: 1,     // s209 how much the video FX / faders sound (ax_lk)
  boost: 0,       // ax_gb (helper APC40 crossfader: an effect that is on pushed toward full, L3728)
  kill: 0,        // fx_kill (BANK held: every effect off)
  echoLen: 2,     // s218 {1/8, 1/4, 1/2, 3/4, 1, 2} beats (no BPM: x 0.5 s)
  echoFb: -1,     // s219 feedback (-1 = by the echo amount)
  vibStep: 3,     // s220 {1, 1/2, 1/3, 1/4, 1/6, 1/8} beat a step
  gateStep: -1,   // s221 (-1 = by the amount; 0..4 = 1, 2, 4, 8, 16 a beat)
  vibWidth: 5,    // vb_iv (x 48 cents each way)
  lfoShape: 2, lfoRate: 2, lfoDepth: 0,   // the video FX LFO on the vibrato (lf_*, L600)
  discTone: 0,    // dk_tone (0 dark, 1 bright)
  // DJ filter (s152 cutoff -1..1, 0 = off; s150 morph -0.5..0.5; s153 type; s154 resonance)
  fltCut: 0, fltMorph: 0, fltType: 0, fltRes: 0.4,
  // auto gain (L1997-L2001): on, target LUFS, the slot's measured loudness (0 = not measured) and peak (dBFS)
  agOn: 1, agTarget: -12, lufs: 0, peakDb: 0,
};

// ---------------------------------------------------------------------------------------------------------------------
// DJ filter (L1105-L1365)
const mgTh = (x) => 2 / (1 + Math.exp(-2 * x)) - 1;
const mgGh = (s) => s / (1 + Math.abs(0.25 * s));
const mgDgh = (s) => 1 / (1 + 0.5 * Math.abs(s) + 0.0625 * s * s);
const mgC = (x) => 1.25 * x + 3.75 * x * x / (1 + Math.abs(5 * x));
const mgDc = (x) => { const ax = 1 / (5 * Math.abs(x) + 1); return 7.5 * x * ax - 18.75 * x * x * Math.sign(x) * ax * ax + 1.25; };
const mgF = (s) => 2.4 * s / (1 + Math.abs(6 * s)) + 0.6 * s;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const dkG = (tz, tp, hz) => Math.sqrt((1 + (2 * PI * hz * tz) ** 2) / (1 + (2 * PI * hz * tp) ** 2));   // dk_g (L670)

// Rect's linear SVF (L1232-L1246)
class MgLsv {
  constructor() { this.k = 0; this.a1 = 1; this.a2 = 0; this.a3 = 0; this.m0 = 0; this.m1 = 0; this.m2 = 1; this.ic1eq = 0; this.ic2eq = 0; }
  init(fc, res, m, sr) {
    const g = Math.tan(PI * fc / (2 * sr)); this.k = 2 - 2 * res;
    this.a1 = 1 / (1 + g * (g + this.k)); this.a2 = g * this.a1; this.a3 = g * this.a2;
    m *= 4; const fr = m - Math.floor(m), k = this.k;
    if (m < 1) { this.m0 = 0; this.m1 = fr; this.m2 = 1 - fr; }
    else if (m < 2) { this.m0 = fr; this.m1 = (1 - fr) - k * fr; this.m2 = -fr; }
    else if (m < 3) { this.m0 = 1; this.m1 = -k * (1 - fr) - fr; this.m2 = -(1 - fr); }
    else { this.m0 = 1 - fr; this.m1 = -(1 - fr); this.m2 = fr; }
  }
  run(v0) {
    const v3 = v0 - this.ic2eq, v1 = this.a1 * this.ic1eq + this.a2 * v3, v2 = this.ic2eq + this.a2 * this.ic1eq + this.a3 * v3;
    this.ic1eq = 2 * v1 - this.ic1eq; this.ic2eq = 2 * v2 - this.ic2eq;
    return this.m0 * v0 + this.m1 * v1 + this.m2 * v2;
  }
  reset() { this.ic1eq = this.ic2eq = 0; }
}

// Shriek stage (L1186-L1229)
class MgSh {
  constructor() { this.wc = 0; this.kk = 0; this.kd = 0; this.mo0 = 0; this.mo1 = 0; this.mo2 = 0; this.v0n = 0; this.v1 = 0; this.v2 = 0; this.g1 = 0; }
  init(fc, res, m, sr) {
    this.wc = Math.tan(PI * fc / (2 * sr)); this.kk = 0.999 - res + 0.01; this.kd = this.kk - (1 + (1 - this.kk) * 0.2);
    let r;
    if (m < 0.25) { this.mo0 = 0; this.mo1 = 8 * m; this.mo2 = 1 - 4 * m; }
    else if (m < 0.5) { r = m - 0.25; this.mo0 = r * 4; this.mo1 = 2 - r * 8; this.mo2 = -r * 4; }
    else if (m < 0.75) { r = m - 0.5; this.mo0 = 1; this.mo1 = -r * 8; this.mo2 = -1 + r * 4; }
    else { r = m - 0.75; this.mo0 = 1 - r * 4; this.mo1 = r * 8 - 2; this.mo2 = r * 4; }
  }
  run(v0, b) {
    const wc = this.wc, kk = this.kk, kd = this.kd;
    v0 *= 3;
    const f1c = wc * mgC(this.v0n - this.v2 - 2 * (this.v1 + (b ? this.g1 * kd : mgF(this.g1 * kd)))) + this.v1;
    const f2c = wc * this.g1 + this.v2;
    this.v0n = v0;
    let it = 0, dg, ct, a, r;
    do {
      it++;
      const v1 = this.v1;
      if (b) {
        const s3 = v1 * v1 * v1; this.g1 = (s3 + v1) / (1 + Math.abs(s3 + 5 * v1));
        const dn = Math.abs(s3 + 5 * v1) + 1;
        dg = (3 * v1 * v1 + 1) / dn - (3 * v1 * v1 + 5) * (s3 + v1) * Math.sign(s3 + 5 * v1) / ((dn + 1) * (dn + 1));
        ct = v0 - this.v2 - 2 * (v1 + this.g1 * kd);
        a = -2 * wc * ((kk - 1) * dg * kd * this.g1 + 1) * mgDc(ct) - 1;
      } else {
        this.g1 = v1 / (1 + Math.abs(v1)); dg = 1 / ((1 + Math.abs(v1)) * (1 + Math.abs(v1)));
        ct = v0 - this.v2 - 2 * (v1 + mgF(this.g1 * kd));
        const t = 3 * kd * this.g1;
        a = -2 * wc * ((kk - 1) * dg * (0.8 / (4 * t * t + 4 * Math.abs(t) + 1) + 0.2) + 1) * mgDc(ct) - 1;
      }
      const f1 = wc * mgC(ct) - v1 + f1c, f2 = wc * this.g1 - this.v2 + f2c;
      const c = wc * dg;
      r = Math.abs(f1) + Math.abs(f2);
      const nm = 1 / (-a + wc * c);
      this.v1 -= (-f1 + wc * f2) * nm; this.v2 -= (a * f2 - c * f1) * nm;
    } while (r > 0.00000001 && it < 26);
    return 0.33333 * (this.mo0 * v0 + this.mo1 * this.v1 + this.mo2 * this.v2);
  }
  reset() { this.v0n = this.v1 = this.v2 = this.g1 = 0; }
}

// MS-20, one of its four filters (L1260-L1288)
class MgMs {
  constructor() { this.y1 = 0; this.y2 = 0; this.d1 = 0; this.d2 = 0; this.hh = 0; this.k = 0; }
  init(fc, res, sr) {
    const sf = 2 * sr / 44100; this.hh = 0.5 * Math.tan(2 * PI * fc / (2 * sr) / (2.1 * sf)) * 2.1 * sf; this.k = 2 * res;
  }
  run(x, mode) {
    const hh = this.hh, k = this.k;
    const kc = mode === 1 ? 0.95 * k : mode === 2 ? 0.85 * k : k;
    let gd, t1, t2;
    if (mode === 2) { gd = clamp(kc * (this.d2 + x), -1, 1); t1 = mgTh(-this.d1 - gd); t2 = mgTh(this.d1 - this.d2 - x + gd); }
    else {
      gd = clamp(this.d2 * kc, -1, 1);
      if (mode === 0) { t1 = mgTh(-this.d1 + x - gd); t2 = mgTh(this.d1 - this.d2 + gd); }
      else { t1 = mgTh(-this.d1 - x - gd); t2 = mgTh(this.d1 - this.d2 + x + gd); }
    }
    let it = 0, r;
    do {
      it++;
      const y1 = this.y1, y2 = this.y2;
      const kx = mode === 2 ? kc * (x + y2) : kc * y2, g = clamp(kx, -1, 1), dg = Math.abs(kx) > 1 ? 0 : 1;
      let s1, s2;
      if (mode === 0) { s1 = x - y1 - g; s2 = y1 - y2 + g; }
      else if (mode === 2) { s1 = -y1 - g; s2 = -x + y1 - y2 + g; }
      else { s1 = -x - y1 - g; s2 = x + y1 - y2 + g; }
      const a1 = mgTh(s1), a2 = mgTh(s2);
      const m1 = (a1 * a1 - 1) * (mode === 2 ? 1 : hh), m2 = (a2 * a2 - 1) * (mode === 2 ? 1 : hh);
      const f1 = y1 - this.d1 - hh * (t1 + a1), f2 = y2 - this.d2 - hh * (t2 + a2); r = Math.abs(f1) + Math.abs(f2);
      const a = 1 - m1, b = -kc * m1 * dg, c = m2, d = (kc * dg - 1) * m2 + 1;
      const nm = 1 / (a * d - b * c); this.y1 -= (d * f1 - b * f2) * nm; this.y2 -= (a * f2 - c * f1) * nm;
    } while (r > 0.00000001 && it < 6);
    this.d1 = this.y1; this.d2 = this.y2;
    return mode === 3 ? x - this.y2 : mode === 2 ? this.y2 + x : this.y2;
  }
  reset() { this.y1 = this.y2 = this.d1 = this.d2 = 0; }
}

// nlSVF (L1293-L1325)
class MgNl {
  constructor() { this.d0 = 0; this.d1 = 0; this.d2 = 0; this.h = 0; this.k = 0; this.hh = 0; this.h2 = 0; this.k2h = 0; this.den = 1; this.mo0 = 0; this.mo1 = 0; this.mo2 = 0; }
  init(fc, res, m, sr) {
    const h = Math.tan(PI * fc / (2 * sr)), k = 0.999 - res + 0.01;
    this.h = h; this.k = k; this.hh = h * h; this.h2 = 2 * h; this.k2h = this.h2 * k; this.den = 1 / (this.hh + this.k2h + 1);
    if (m < 0.25) { this.mo0 = 0; this.mo1 = 16 * m; this.mo2 = 4 - 16 * m; }
    else if (m < 0.5) { this.mo0 = 16 * m - 4; this.mo1 = 4 * (2 * k - 1) * (4 * m - 1) + 4; this.mo2 = 4 - 16 * m; }
    else if (m < 0.75) { this.mo0 = 4; this.mo1 = 8 * k - 4 * (2 * k + 1) * (4 * m - 2); this.mo2 = 16 * m - 12; }
    else { this.mo0 = 16 - 16 * m; this.mo1 = 16 * m - 16; this.mo2 = 16 * m - 12; }
  }
  run(x) {
    const h = this.h, k = this.k, hh = this.hh, h2 = this.h2, k2h = this.k2h, den = this.den, d0 = this.d0, d1 = this.d1, d2 = this.d2;
    x *= 0.05;
    let y1 = (d0 * h - d1 * hh - d1 * k2h + d1 - d2 * h2 + h * x) * den;
    let y2 = (d0 * hh + d1 * h2 - d2 * hh + d2 * k2h + d2 + hh * x) * den;
    let it = 0, r;
    do {
      it++;
      const yd = y1 + d1, fb = 2 * k * yd;
      const c1 = x + d0 - (y2 + d2) - (fb > 0 ? Math.min(1, fb) : Math.max(-1, fb * 0.25));
      const mul = c1 < 0 ? 1.01 : 0.96;
      const a1 = mgTh(mul * c1), a2 = mgTh(yd);
      const f1 = y1 - d1 - h * a1, f2 = y2 - d2 - h * a2; r = Math.abs(f1) + Math.abs(f2);
      const da1 = mul * (1 - a1 * a1);
      const a = 1 + k2h * da1 * (fb > 0 ? (fb > 1 ? 0 : 1) : (fb < -4 ? 0 : 0.25));
      const b = h * da1, c = -h * (1 - a2 * a2);
      const nm = 1 / (a - b * c); y1 -= (f1 - b * f2) * nm; y2 -= (a * f2 - c * f1) * nm;
    } while (r > 0.00000001 && it < 26);
    this.d0 = x; this.d1 = y1; this.d2 = y2;
    return (this.mo0 * x + this.mo1 * y1 + this.mo2 * y2) * 5;
  }
  reset() { this.d0 = this.d1 = this.d2 = 0; }
}

// one channel's filter: the EEL2 namespace mgl / mgr with its sub-instances (sa, sb, ml, mb, mh, mr, nl, ra, rb, rn, ro)
class MgFilter {
  constructor(sr) {
    this.sr = sr;
    // Moog / Ladder (L1113-L1158)
    this.rg1 = this.rg2 = this.rg3 = this.rg4 = this.qg1 = this.qg2 = this.qg3 = this.qg4 = 0;
    this.k0g = this.k0s = this.q0s = this.r1s = this.k = 0;
    // Steiner / Pillow (L1160-L1183)
    this.h = 0; this.kk = 0; this.nc = 1; this.lp = 1; this.bp = 0; this.hpm = 0;
    this.sa = new MgSh(); this.sb = new MgSh();
    this.ml = new MgMs(); this.mb = new MgMs(); this.mh = new MgMs(); this.mr = new MgMs();
    this.nl = new MgNl();
    this.ra = new MgLsv(); this.rb = new MgLsv(); this.rn = new MgLsv(); this.ro = new MgLsv();
    this.reset();
  }

  ladInit(fc, res, four) {   // L1113
    const sr = this.sr;
    let g, k;
    if (four) { k = res * 3.9999999999999987; g = Math.tan(PI * fc / (2 * sr)) / Math.sqrt(1 + Math.sqrt(k) - 2 * Math.pow(k, 0.25) * 0.7071067811865476); }
    else { k = res * 120; g = Math.tan(PI * fc / (2 * sr)) / Math.sqrt(1 + k); }
    this.k = k;
    const p0s = 1 / (1 + g); this.q0s = 1 - g; this.r1s = -g; this.k0s = 0.052 * g * p0s;
    const nmp = 1 - p0s, gn = four ? (nmp * nmp) * (nmp * nmp) : nmp * nmp;
    const kgn = k * gn, p0g = 1 / (1 + kgn); this.k0g = -19.23076923076923 * p0g;
    const tmp = p0s * (g - 1); let acc = tmp;
    if (four) {
      this.rg1 = this.rg3 = -4 * kgn; this.rg2 = -6 * kgn; this.rg4 = -kgn;
      this.qg1 = -4 * (kgn + acc); acc *= tmp; this.qg2 = -6 * (kgn + acc); acc *= tmp; this.qg3 = -4 * (kgn + acc); acc *= tmp; this.qg4 = -(kgn + acc);
    } else {
      this.rg1 = -2 * kgn; this.rg2 = -kgn; this.qg1 = -2 * (kgn + acc); acc *= tmp; this.qg2 = -(kgn + acc);
    }
  }
  lad(x, four, ch, fr) {   // L1132
    const K = 19.23076923076923, k0s = this.k0s, r1s = this.r1s, q0s = this.q0s, k = this.k;
    let yi, yd, y, yo, a, b, c, d = 0, lp, bp, hp, br, f1, f2;
    x *= 0.052;
    yo = mgTh(this.k0g * (x + this.sg1)); a = yo;
    yi = yo; yd = k0s * (yi + this.sf1); y = yd + this.si1; yo = mgTh(K * y); b = yo; this.si1 = yd + y; this.sf1 = r1s * yi - q0s * yo;
    yi = yo; yd = k0s * (yi + this.sf2); y = yd + this.si2; yo = mgTh(K * y); c = yo; this.si2 = yd + y; this.sf2 = r1s * yi - q0s * yo;
    if (four) {
      yi = yo; yd = k0s * (yi + this.sf3); y = yd + this.si3; yo = mgTh(K * y); d = yo; this.si3 = yd + y; this.sf3 = r1s * yi - q0s * yo;
      yi = yo; yd = k0s * (yi + this.sf4); y = yd + this.si4; yo = mgTh(K * y); this.si4 = yd + y; this.sf4 = r1s * yi - q0s * yo;
      this.sg1 = this.rg1 * x + this.qg1 * k * y + this.sg2; this.sg2 = this.rg2 * x + this.qg2 * k * y + this.sg3;
      this.sg3 = this.rg3 * x + this.qg3 * k * y + this.sg4; this.sg4 = this.rg4 * x + this.qg4 * k * y;
      lp = y * (1 + k) * K; bp = 2 * c - 2 * b; hp = a - 4 * b + 6 * c - 4 * d + yo; br = a - 4 * b + 6 * c - 4 * d;
    } else {
      this.sg1 = this.rg1 * x + this.qg1 * k * y + this.sg2; this.sg2 = this.rg2 * x + this.qg2 * k * y;
      lp = y * (1 + k) * K; bp = (2 * b - 2 * yo) * 8; hp = a - b; br = -(2 * b - yo * (2 + k) - a);
    }
    if (ch === 0) { f1 = lp; f2 = bp; } else if (ch === 1) { f1 = bp; f2 = hp; } else if (ch === 2) { fr = (fr * fr) * (fr * fr); f1 = hp; f2 = br; } else { f1 = br; f2 = lp; }
    return -(f2 * fr + f1 * (1 - fr));
  }

  stInit(fc, res, m) {   // L1160
    const h = Math.tan(PI * fc / (2 * this.sr)), kk = 3.98 * res;
    this.h = h; this.kk = kk; this.nc = 1 / (-kk * h + h * h + 2 * h + 1);
    if (m < 0.25) { this.lp = 1 - m * 4; this.bp = m * 4; this.hpm = 0; }
    else if (m < 0.5) { this.hpm = (m - 0.25) * 4; this.bp = 1 - (m - 0.25) * 4; this.lp = 0; }
    else if (m < 0.75) { this.hpm = 1; this.bp = -2 * (m - 0.5) * 4; this.lp = (m - 0.5) * 4; }
    else { this.hpm = 1 - (m - 0.75) * 4; this.bp = -2 * (1 - (m - 0.75) * 4); this.lp = 1; }
  }
  st(xn, rav) {   // L1167
    const h = this.h, kk = this.kk, nc = this.nc, lp = this.lp, bp = this.bp, hpm = this.hpm, x = this.stx, v1 = this.v1, v2 = this.v2;
    const kp1 = kk + 1;
    let v1n, v2n, fb, s1f, s2f;
    if (rav) {
      v1n = v1; v2n = v2;
      fb = mgGh(kp1 * (hpm * x + v1));
      s1f = 2 * bp * x - hpm * x - v1 + v2 + fb - hpm * xn;
      s2f = -4 * bp * x + hpm * x - 2 * (v2 + fb) + v1 + lp * x + hpm * xn + lp * xn;
    } else {
      const xx = x + xn;
      v1n = (-kk * h * v1 + (bp - hpm) * h * xx + h * h * ((lp - hpm) * xx - v1) + 2 * h * v2 + v1) * nc;
      v2n = (kk * h * ((bp - hpm) * xx + v2 - 2 * v1) + (lp - bp) * h * h * xx + (lp - bp) * h * xx - h * h * v2 + v2) * nc;
      fb = clamp(kp1 * (hpm * x + v1), -1, 1);
      s1f = 2 * bp * x - hpm * x - v1 + v2 + fb;
      s2f = -4 * bp * x + hpm * x - 2 * (v2 + fb) + v1 + lp * x;
    }
    let it = 0, f1, f2;
    do {
      it++;
      const fs1 = kp1 * (hpm * xn + v1n);
      let s1, s2, a, b, c, d, fc;
      if (rav) {
        fc = mgGh(fs1);
        s1 = s1f - v1n + v2n + fc; s2 = s2f + v1n - 2 * (v2n + fc);
        const ds1 = 1 / ((1 + Math.abs(s1)) * (1 + Math.abs(s1))), ds2 = 1 / ((1 + Math.abs(s2)) * (1 + Math.abs(s2)));
        s1 = s1 / (1 + Math.abs(s1)); s2 = s2 / (1 + Math.abs(s2));
        d = mgDgh(fs1);
        a = h * (kp1 * d - 1) * ds1 - 1; b = h * ds1; c = h * (1 - 2 * kp1 * d) * ds2; d = -2 * h * ds2 - 1;
      } else {
        fc = clamp(fs1, -1, 1);
        s1 = s1f - hpm * xn - v1n + v2n + fc; s2 = s2f + hpm * xn + lp * xn + v1n - 2 * (v2n + fc);
        d = Math.abs(fs1) > 1 ? 0 : 1;
        a = h * (kp1 * d - 1) - 1; b = h; c = h * (1 - 2 * kp1 * d); d = -2 * h - 1;
      }
      f1 = v1 - v1n + h * s1; f2 = v2 - v2n + h * s2;
      const nm = 1 / (a * d - b * c);
      v1n -= (d * f1 - b * f2) * nm; v2n -= (a * f2 - c * f1) * nm;
    } while (Math.abs(f1) + Math.abs(f2) > 0.00000001 && it < 26);
    this.stx = xn; this.v1 = v1n; this.v2 = v2n;
    return v1n + hpm * xn;
  }

  rectInit(fc, res, m) {   // L1250
    const fl = Math.max(20, fc / 2), sr = this.sr; res = clamp(res, 0, 0.92);
    this.ra.init(fl, res, m, sr); this.rb.init(fl, res, m, sr); this.rn.init(fl, res, m, sr); this.ro.init(fc, 0, m, sr);
  }
  rect(x) {   // L1254
    const base = this.rn.run(x), peak = this.rb.run(this.ra.run(x));
    return this.ro.run(base + mgTh(Math.abs(peak - base)));
  }
  ms4(x, mode) { return mode === 0 ? this.ml.run(x, 0) : mode === 1 ? this.mb.run(x, 1) : mode === 2 ? this.mh.run(x, 2) : this.mr.run(x, 3); }

  ell(x) {   // L1327 elliptic half-band (decimator)
    const ey = 0.03851260969347568 * x + this.e1;
    this.e1 = 0.07917433005447011 * x + 1.8465480149702582 * ey + this.e2;
    this.e2 = 0.1448318280102846 * x - 3.085415375328384 * ey + this.e3;
    this.e3 = 0.15947402363472882 * x + 2.9173159325651126 * ey + this.e4;
    this.e4 = 0.14483182801028455 * x - 2.1600701985167765 * ey + this.e5;
    this.e5 = 0.07917433005447012 * x + 0.9894349416880517 * ey + this.e6;
    this.e6 = 0.038512609693475676 * x - 0.27584791692890615 * ey;
    return ey;
  }

  // mg_set (L1340): t 0 Moog, 1 Ladder, 2 Steiner, 3 Pillow, 4 Rect, 5 Shriek4p, 6 MS-20, 7 nlSVF; m = morph 0..1
  set(fc, res, t, m) {
    const sr = this.sr;
    if (t <= 1) this.ladInit(fc, res, t === 0);
    else if (t <= 3) this.stInit(fc, t === 3 ? res / 2 : res, m);
    else if (t === 4) this.rectInit(fc, res, m);
    else if (t === 5) { this.sa.init(fc, 0, m, sr); this.sb.init(fc, res, m, sr); }
    else if (t === 6) { this.ml.init(fc, res, sr); this.mb.init(fc, res, sr); this.mh.init(fc, res, sr); this.mr.init(fc, res, sr); }
    else this.nl.init(fc, res, m, sr);
  }
  run(x, t, m) {   // mg_run (L1347)
    const ch = Math.min(3, Math.floor(m * 4)), fr = m * 4 - ch;
    if (t === 0) return this.lad(x, 1, ch, fr);
    if (t === 1) return this.lad(x, 0, ch, fr);
    if (t === 2) return this.st(x, 0);
    if (t === 3) return this.st(x, 1);
    if (t === 4) return this.rect(x);
    if (t === 5) return this.sb.run(this.sa.run(x, 0), 1);
    if (t === 6) { let y = this.ms4(x, ch) * (1 - fr); if (fr > 0.00000001) y += this.ms4(x, (ch + 1) % 4) * fr; return y; }
    return this.nl.run(x);
  }
  // mg_proc (L1354): two steps at 2x (the input interpolated), the half-band down, a 10 Hz DC blocker
  proc(x, t, m) {
    this.ell(this.run((this.xp + x) * 0.5, t, m));
    const y = this.ell(this.run(x, t, m));
    this.xp = x;
    this.dy = y - this.dx + (1 - 2 * PI * 10 / this.sr) * this.dy; this.dx = y;
    return this.dy;
  }
  reset() {   // mg_reset (L1361)
    this.xp = this.dx = this.dy = 0;
    this.si1 = this.si2 = this.si3 = this.si4 = this.sf1 = this.sf2 = this.sf3 = this.sf4 = this.sg1 = this.sg2 = this.sg3 = this.sg4 = 0;
    this.stx = this.v1 = this.v2 = 0;
    this.e1 = this.e2 = this.e3 = this.e4 = this.e5 = this.e6 = 0;
    this.sa.reset(); this.sb.reset();
    this.ml.reset(); this.mb.reset(); this.mh.reset(); this.mr.reset(); this.nl.reset();
    this.ra.reset(); this.rb.reset(); this.rn.reset(); this.ro.reset();
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// FFT: radix 2, in place on interleaved (re, im) Float64Array, natural order in and out; forward e^-i, unnormalised both
// ways (as EEL2's fft / ifft with fft_permute / fft_ipermute around them)
class FFT {
  constructor(n) {
    this.n = n;
    this.cs = new Float64Array(n / 2); this.sn = new Float64Array(n / 2);
    for (let i = 0; i < n / 2; i++) { this.cs[i] = Math.cos(TAU * i / n); this.sn[i] = Math.sin(TAU * i / n); }
    this.rev = new Uint32Array(n);
    const bits = Math.round(Math.log2(n));
    for (let i = 0; i < n; i++) { let r = 0; for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b); this.rev[i] = r; }
  }
  run(a, inv) {
    const n = this.n, rev = this.rev, cs = this.cs, sn = this.sn, sg = inv ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) { let t = a[2 * i]; a[2 * i] = a[2 * j]; a[2 * j] = t; t = a[2 * i + 1]; a[2 * i + 1] = a[2 * j + 1]; a[2 * j + 1] = t; }
    }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1, step = n / size;
      for (let i = 0; i < n; i += size) {
        for (let j = 0, k = 0; j < half; j++, k += step) {
          const wr = cs[k], wi = sg * sn[k];
          const p = 2 * (i + j), q = 2 * (i + j + half);
          const xr = a[q] * wr - a[q + 1] * wi, xi = a[q] * wi + a[q + 1] * wr;
          a[q] = a[p] - xr; a[q + 1] = a[p + 1] - xi; a[p] += xr; a[p + 1] += xi;
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------------
export class DeckFX {
  constructor(srate) {
    this.srate = srate;
    this.p = { ...FX_DEFAULTS };
    this.touch = new Float64Array(17);
    this.fxsA = new Float64Array(17).fill(1);
    // delay lines (AFX, L629-L662)
    this.EDL = new Float32Array(ED_N); this.EDR = new Float32Array(ED_N);
    this.CHL = new Float32Array(CHN); this.CHR = new Float32Array(CHN); this.HSB = new Float32Array(HSN);
    this.PSL = new Float32Array(CHN); this.PSR = new Float32Array(CHN);
    this.FLL = new Float32Array(FLN); this.FLR = new Float32Array(FLN);
    this.MRL = new Float32Array(MRN); this.MRR = new Float32Array(MRN);
    this.HGL = new Float32Array(HGN); this.HGR = new Float32Array(HGN); this.HGV = new Float64Array(16);
    // the vocoder (L640-L645): work buffers in double (as EEL2), the rings in float
    this.VTD = new Float32Array(VTN); this.VTY = new Float64Array(520);
    this.XIN = new Float32Array(VXN); this.VPO = new Float32Array(VPN); this.VNO = new Float32Array(VPN);
    this.VHP = new Float64Array(4096); this.VHQ = new Float64Array(4096);
    this.VLM = new Float64Array(4100); this.VXB = new Float64Array(15);
    this.VZA = new Float64Array(8192); this.VZB = new Float64Array(8192); this.VZC = new Float64Array(8192); this.VCS = new Float64Array(4100);
    this.YA = new Float64Array(2048); this.YB = new Float64Array(2048); this.YC = new Float64Array(1100);
    this.fft1k = new FFT(1024);
    this.mgl = new MgFilter(srate); this.mgr = new MgFilter(srate);
    this.l = 0; this.r = 0; this.nanHit = 0;
    this.ew = 0;               // ax_ew: the rings' write index
    this.clock = 0;            // output samples (vb_lfk's clock without a grid; time_precise() in the JSFX)
    this.bpm = 0; this.beat = 0; this.pitchBar = 0; this.key = 0; this.rate = 1;
    // L946-L952 (@init)
    this.nx_dw = 0; this.nx_hk = 0; this.nx_tc = 0; this.nx_fz = 0; this.nx_fd = this.nx_fd2 = this.nx_fds = this.nx_fd2s = 20;
    this.nx_l1 = this.nx_r1 = this.nx_l2 = this.nx_r2 = 0; this.nx_lw = this.nx_hts = this.nx_zbs = 0;
    this.ax_dsc = this.ax_lna = this.ax_htn = this.ax_zbl = 0; this.dk_w = 0; this.dk_live = 0;
    this.ax_vp = 0; this.ax_vs = 0; this.ax_hds = 0; this.ax_hn = 0; this.ax_rp = 0; this.ax_tk = 0;
    this.ax_tw = this.ax_rs = this.ax_cs = this.ax_crs = this.ax_ms = this.ax_chs = this.ax_es = this.ax_gts = this.ax_ewg = 0;
    this.ax_vhs = 0; this.ax_wow = 0; this.ax_lfo = 0; this.ax_gg = 1; this.ax_tc = 0;
    this.ax_tint = this.ax_ring = this.ax_clip = this.ax_mir = this.ax_cho = this.ax_haas = this.ax_gate = this.ax_crush = this.ax_echo = this.ax_vib = 0;
    this.ax_een = 0; this.ax_etail = 0; this.ax_elast = 0;
    this.ax_hd = 0; this.ax_ed = 1; this.ax_fb = 0.25; this.ax_q = 65536; this.ax_hold = 1; this.ax_gs = 1; this.ax_bpm = 0;
    this.vt_ms = this.vt_l1 = this.vt_l2 = this.vt_dc = this.vt_pw = this.vt_f0 = this.vt_fr = 0; this.vt_uv = 1; this.vt_ad = 1; this.vt_st = 0.25;
    this.vx_ap = 1; this.vx_hc = this.vx_pc = 0; this.vx_cs = -99999; this.vx_g = this.vx_gt = 1; this.vx_pi = this.vx_po = 0; this.vx_on = 0; this.vx_to = 0;
    this.lm_pi = this.lm_po = 0; this.fl_pi = this.fl_po = 0; this.ac_pi = this.ac_po = 0;
    this.ax_tpi = this.ax_tpo = this.ax_tki = this.ax_tko = 0; this.ax_tg = 1;
    this.mrc_p1 = 0; this.mrc_p2 = 0; this.mrc_p3 = 0.25; this.mrc_g4 = 0; this.mrc_w = 1440; this.mrc_r = 0; this.mrc_4 = 0; this.hg_j = 0;
    this.mg_fv = 0; this.mg_mv = 0; this.mg_w = 0; this.mg_on = 0; this.mg_t = -1; this.mg_m = 0;
    this.ag_t = 1; this.ag_g = 1;
    this.kw = 1;
    this.dkL = new Float64Array(8); this.dkR = new Float64Array(8);   // dkl1..4 / dkr1..4 (x1, y1 pairs)
    this.dk_a0 = this.dk_a1 = this.dk_a2 = this.dk_b0 = this.dk_b1 = this.dk_b2 = 0;
    this.dk_d0 = this.dk_d1 = this.dk_d2 = this.dk_e0 = this.dk_e1 = this.dk_e2 = 0; this.dk_np = this.dk_nd = 1; this.dk_dr = 0.3;
    this.reset();
    this.VXB.fill(1, 0, 5);   // memset(VXB, 1, 5) (L947)
    this.srCalc();
  }

  // the sample rate's constants (L947, L952, sr_calc L4347-L4356)
  srCalc() {
    const sr = this.srate;
    this.ax_sk = 1 - Math.exp(-1 / (0.03 * sr)); this.ac_k = this.ax_sk; this.ax_fk = 1 - Math.exp(-1 / (0.005 * sr));
    this.lm_k = 1 - Math.exp(-1 / (0.2 * sr)); this.lm_gk = 1 - Math.exp(-1 / (0.05 * sr));
    this.ax_tks = 1 - Math.exp(-1 / (0.3 * sr)); this.ax_tkd = Math.exp(-1 / (0.3 * sr)); this.ax_tgk = 1 - Math.exp(-1 / (0.01 * sr));
    this.mg_ws = 1 / (0.01 * sr);
    this.nx_d1 = Math.floor(Math.min(CHN - 2, 0.019 * sr)); this.nx_d2 = Math.floor(Math.min(CHN - 2, 0.029 * sr));
    this.nx_d3 = Math.floor(Math.min(CHN - 2, 0.041 * sr)); this.nx_d4 = Math.floor(Math.min(CHN - 2, 0.059 * sr));
    this.vt_dn = Math.max(1, Math.floor(sr / 11025 + 0.5)); this.vt_sr = sr / this.vt_dn; this.vt_lk = 1 - Math.exp(-2 * PI * 1000 / sr);
    this.VN = sr > 60000 ? 4096 : 2048; this.VH = this.VN / 8; this.VRL = this.VN / 4;
    this.fftV = new FFT(this.VN);
    this.vx_ck = 1 - Math.exp(-1 / (0.03 * sr)); this.vx_pk = 1 - Math.exp(-1 / (0.3 * sr)); this.vx_gk = 1 - Math.exp(-1 / (0.1 * sr));
  }

  set(params) {
    for (const k in params) {
      if (k === 'touch' || k === 'fxs') {
        const dst = k === 'touch' ? this.touch : this.fxsA, src = params[k] || [];
        for (let i = 0; i < 17; i++) dst[i] = src[i] !== undefined ? +src[i] : (k === 'touch' ? 0 : 1);
      } else this.p[k] = params[k];
    }
  }

  // nan_reset (L678): every effect's state cleared (the DJ filter resets itself; the deck's low cut is the deck's)
  reset() {
    for (const a of [this.EDL, this.EDR, this.CHL, this.CHR, this.HSB, this.PSL, this.PSR, this.FLL, this.FLR, this.MRL, this.MRR,
      this.HGL, this.HGR, this.HGV, this.VTD, this.VTY, this.XIN, this.VPO, this.VNO, this.VHP, this.VHQ, this.VLM, this.VXB]) a.fill(0);
    this.ax_tl = this.ax_tr = 0; this.nx_t2l = this.nx_t2r = 0;
    this.dkL.fill(0); this.dkR.fill(0); this.dk_ck = 0;
    this.ax_hl = this.ax_hr = 0; this.lm_g = this.lm_gt = 1; this.l = this.r = 0;
  }

  am(i) {   // ax_am (L3714): this deck's video FX or the master's when type i
    const p = this.p, t = p.vfxAmt > 0.001 ? p.vfxType : 0;
    return Math.max(t === i ? p.vfxAmt : 0, p.mfxType === i ? p.mfxAmt : 0);
  }
  bst(a) { return a > 0.001 ? a + this.p.boost * (1 - a) : a; }   // ax_bst (L3728)
  vbLfk() {   // L3718
    const p = this.p, dp = clamp(p.lfoDepth, 0, 1);
    if (dp <= 0.001) return 1;
    const ph = this.bpm > 0 ? this.beat : this.clock / this.srate * 2;
    const cb = Math.pow(2, clamp(p.lfoRate | 0, 0, 5) - 2), x = ph / cb, f = x - Math.floor(x), s = p.lfoShape;
    return 1 - dp * (1 - (s === 0 ? 0.5 + 0.5 * Math.cos(2 * PI * f) : s === 1 ? Math.abs(2 * f - 1) : s === 2 ? (f < 0.5 ? 1 : 0) : s === 3 ? 1 - f : f));
  }
  // dk_cf (L668): (1 + s tz) / (1 + s tp) by the bilinear transform
  dkCf(tz, tp) {
    const k = 2 * this.srate;
    this.dk_c0 = (1 + k * tz) / (1 + k * tp); this.dk_c1 = (1 - k * tz) / (1 + k * tp); this.dk_c2 = (1 - k * tp) / (1 + k * tp);
  }

  // the factor for the grains' key (kshift, L5206-L5218 without pp_k and s217): Hue rotate, VHS wow, Disc wow
  kshiftWobble() { return this.kw; }

  // ---- per block (L4523-L4537, L4579-L4585, L5174-L5248) ----
  // ctx: { bpm: BPM at the tempo where the head is (0 = no BPM / grid), beat: the head's beat position gb_b(head),
  //        pitchBar: s52, key: s217 (semitones), rate: the deck's read rate in x (tp_vs, for Disc's crackle) }
  block(n, ctx) {
    const p = this.p, sr = this.srate, T = this.touch, S = this.fxsA;
    this.bpm = ctx.bpm > 0 ? ctx.bpm : 0; this.beat = ctx.beat || 0; this.pitchBar = clamp(ctx.pitchBar || 0, 0, 1);
    this.key = ctx.key || 0; this.rate = ctx.rate === undefined ? 1 : ctx.rate;
    this.clock += n;
    const kill = p.kill ? 1 : 0, nk = 1 - kill, lk = clamp(p.fxSound, 0, 1);
    // L5186-L5189
    const fe_e = Math.max(p.echo, T[10]), fe_c = Math.max(p.crush, T[7]), fe_v = Math.max(p.vib, T[16]);
    const tk_stb = Math.max(p.strobeKnob < 0.05 ? 0 : (p.strobeKnob - 0.05) / 0.95, T[9]);
    // L5197-L5203
    this.ax_tint = this.bst(Math.max(this.am(1), T[1])) * lk * S[1];
    this.ax_ring = this.bst(Math.max(this.am(3), T[3])) * lk * S[3];
    this.ax_clip = this.bst(Math.max(this.am(4), T[4])) * lk * S[4];
    this.ax_mir = this.bst(Math.max(this.am(5), T[5])) * lk * S[5];
    this.ax_cho = this.bst(Math.max(this.am(6), T[6])) * lk * S[6];
    this.ax_haas = this.bst(Math.max(this.am(8), T[8])) * lk * S[8];
    const mrc_k = Math.max(this.am(5), T[5]);
    this.mrc_4 = mrc_k >= 0.5 ? 1 : 0; this.mrc_r = Math.pow(2, (2 + 28 * mrc_k) / 1200) - 1; this.mrc_w = Math.min(MRN - 8, Math.floor(0.03 * sr));
    this.ax_gate = Math.max(this.am(9), tk_stb) * lk * S[9];
    this.ax_crush = this.bst(Math.max(this.am(7), fe_c)) * lk * S[7];
    this.ax_echo = this.bst(Math.max(this.am(10), fe_e)) * lk * S[10];
    // the echo's tail (web version, user's choice 2026-10-21): the echo taken off stops feeding it, and what is in it
    // rings out at the last amount (wet and feedback) until it has died away (it was cut at once: the phone's pad lets
    // go of the echo with the finger)
    if (this.ax_echo > 0.001) { this.ax_elast = this.ax_echo; this.ax_etail = 1; } else if (this.ax_etail && this.ax_een < 1e-9) this.ax_etail = 0;
    this.ax_vhs = this.bst(Math.max(this.am(11), T[11])) * lk * S[11] * nk;
    this.ax_tint = Math.max(this.ax_tint, 0.6 * this.ax_vhs);
    if (this.ax_tint > 0.001) this.ax_tk = 1 - Math.exp(-2 * PI * 16000 * Math.pow(500 / 16000, this.ax_tint) / sr);
    this.ax_wow += n / sr * 0.7; if (this.ax_wow > 1) this.ax_wow -= 1;
    // kshift's FX part (L5208-L5209, L5218)
    let kw = Math.pow(2, this.bst(Math.max(this.am(2), T[2])) * lk * S[2] * nk);
    kw *= 1 + 0.006 * this.ax_vhs * Math.sin(2 * PI * this.ax_wow);
    this.ax_dsc = this.bst(Math.max(this.am(12), T[12])) * lk * S[12] * nk;
    this.ax_lna = this.bst(Math.max(this.am(13), T[13])) * lk * S[13] * nk;
    this.ax_htn = this.bst(Math.max(this.am(14), T[14])) * lk * S[14] * nk;
    this.ax_zbl = this.bst(Math.max(this.am(15), T[15])) * lk * S[15] * nk;
    this.nx_dw += n / sr * 0.55; if (this.nx_dw > 1) this.nx_dw -= 1;
    const dsc = this.ax_dsc;
    kw *= 1 + dsc * dsc * (0.03 * Math.sin(2 * PI * this.nx_dw) + 0.009 * Math.sin(4 * PI * this.nx_dw + 1));
    this.kw = kw;
    // Disc's phono EQ (L5223-L5232)
    this.dkCf(0.00318, 0.000318); this.dk_a0 = this.dk_c0; this.dk_a1 = this.dk_c1; this.dk_a2 = this.dk_c2;
    this.dkCf(0.000075, 0.00000318); this.dk_b0 = this.dk_c0; this.dk_b1 = this.dk_c1; this.dk_b2 = this.dk_c2;
    const dk_tt = 1 + (p.discTone - 1) * dsc, dk_ts = Math.min(1, 8 * dsc);
    const dk_t1 = 0.00318 * (1 + (0.6 - 0.9 * dk_tt) * dk_ts), dk_t2 = 0.000318 * (1 + (0.3 - 0.1 * dk_tt) * dk_ts), dk_t3 = 0.000075 * (1 + (2 - 2.4 * dk_tt) * dk_ts);
    this.dkCf(dk_t2, dk_t1); this.dk_d0 = this.dk_c0; this.dk_d1 = this.dk_c1; this.dk_d2 = this.dk_c2;
    this.dkCf(0, dk_t3); this.dk_e0 = this.dk_c0; this.dk_e1 = this.dk_c1; this.dk_e2 = this.dk_c2;
    this.dk_np = 1 / (dkG(0.00318, 0.000318, 1000) * dkG(0.000075, 0.00000318, 1000)); this.dk_nd = 1 / (dkG(dk_t2, dk_t1, 1000) * dkG(0, dk_t3, 1000));
    this.dk_dr = 0.3 + 1.2 * dsc;
    if (this.ax_lna > 0.001) this.nx_hk = 1 - Math.exp(-2 * PI * 20 * Math.pow(1500 / 20, this.ax_lna) / sr);
    this.hg_j = Math.min(HGN - 8, Math.floor((0.005 + 0.12 * this.ax_htn) * sr));
    if (this.bpm > 0) this.nx_fz = this.beat / 2; else { this.nx_fz += n / sr; this.nx_fz -= Math.floor(this.nx_fz); }
    this.nx_fd = (0.0005 + 0.0045 * (0.5 - 0.5 * Math.cos(2 * PI * this.nx_fz))) * sr;
    this.nx_fd2 = (0.0005 + 0.0045 * (0.5 - 0.5 * Math.cos(2 * PI * (this.nx_fz + 0.25)))) * sr;
    // L5236-L5245
    this.ax_vib = this.bst(fe_v * this.vbLfk()) * lk * S[16];
    this.ax_bpm = this.bpm;
    const el = p.echoLen, ax_eb = el === 0 ? 0.125 : el === 1 ? 0.25 : el === 3 ? 0.75 : el === 4 ? 1 : el === 5 ? 2 : 0.5;
    this.ax_ed = Math.min(ED_N - 2, Math.floor((this.bpm > 0 ? 60 / this.bpm : 0.5) * ax_eb * sr));
    this.ax_fb = p.echoFb >= 0 ? Math.min(0.95, p.echoFb) : 0.25 + 0.5 * this.echoLevel();
    this.ax_q = Math.pow(2, 16 - 13 * this.ax_crush); this.ax_hold = 1 + Math.floor(this.ax_crush * 24);
    this.ax_hd = this.ax_haas * 0.02 * sr;
    this.ax_gs = Math.pow(2, p.gateStep >= 0 ? p.gateStep : Math.floor(this.ax_gate * 4.99));
    const vs = p.vibStep;
    this.vt_st = vs < 0.5 ? 1 : vs < 1.5 ? 0.5 : vs < 2.5 ? 1 / 3 : vs < 3.5 ? 0.25 : vs < 4.5 ? 1 / 6 : 0.125;
    if (kill) { this.ax_tint = this.ax_ring = this.ax_clip = this.ax_mir = this.ax_cho = this.ax_haas = this.ax_gate = this.ax_crush = this.ax_echo = this.ax_vib = 0; this.ax_hd = 0; this.ax_etail = 0; }
    // DJ filter (L4523-L4537)
    const fl_c = p.fltCut, fl_r = p.fltRes, fl_m = clamp(p.fltMorph, -0.5, 0.5);
    const mg_k = 1 - Math.exp(-n / (0.03 * sr));
    this.mg_fv += (fl_c - this.mg_fv) * mg_k; if (Math.abs(fl_c - this.mg_fv) < 0.0005) this.mg_fv = fl_c;
    this.mg_mv += (fl_m - this.mg_mv) * mg_k; if (Math.abs(fl_m - this.mg_mv) < 0.0005) this.mg_mv = fl_m;
    this.mg_on = Math.abs(this.mg_fv) > 0.05 ? 1 : 0;
    if (this.mg_on) {
      const mg_a = (Math.abs(this.mg_fv) - 0.05) / 0.95, mg_top = Math.min(12000, 0.24 * sr);
      const fc = this.mg_fv > 0 ? 25 * Math.pow(6000 / 25, mg_a) : mg_top * Math.pow(100 / mg_top, mg_a);
      let m = (this.mg_fv > 0 ? 0.5 : 0) + this.mg_mv; m -= Math.floor(m); this.mg_m = m;
      const t = clamp(p.fltType | 0, 0, 7);
      if (this.mg_t !== t || this.mg_w <= 0) { this.mg_t = t; this.mgl.reset(); this.mgr.reset(); }
      this.mgl.set(fc, fl_r, this.mg_t, m); this.mgr.set(fc, fl_r, this.mg_t, m);
    }
    // auto gain (L4583-L4585)
    let ag_d = p.agOn && p.lufs < -0.5 ? p.agTarget - p.lufs : 0;
    if (ag_d > 0) ag_d = Math.min(ag_d, Math.max(0, -p.peakDb - 1));
    this.ag_t = Math.pow(10, clamp(ag_d, -24, 12) / 20);
  }

  // ---- the idle path (sl_lite, L5666-L5670): the delay lines get silence, the write index goes on ----
  // the echo's amount now: the fader's, or the last one while the tail rings out; tail(): something still to ring out
  echoLevel() { return this.ax_echo > 0.001 ? this.ax_echo : this.ax_etail ? this.ax_elast : 0; }
  tail() { return this.ax_etail && this.ax_een > 1e-9; }
  idle() {
    const e = this.ew;
    this.HGL[e & (HGN - 1)] = this.HGR[e & (HGN - 1)] = 0; this.MRL[e & (MRN - 1)] = this.MRR[e & (MRN - 1)] = 0; this.HSB[e & (HSN - 1)] = 0;
    this.CHL[e & (CHN - 1)] = this.CHR[e & (CHN - 1)] = 0; this.FLL[e & (FLN - 1)] = this.FLR[e & (FLN - 1)] = 0; this.XIN[e & (VXN - 1)] = 0;
    this.PSL[e & (CHN - 1)] = this.PSR[e & (CHN - 1)] = 0; this.EDL[e & (ED_N - 1)] = this.EDR[e & (ED_N - 1)] = 0;
    this.l = this.r = 0;
    this.ew = e + 1 >= 1073741824 ? 0 : e + 1;
  }

  // ---- per sample (L5723-L5941). beat = gb_b(head) at this sample (needed with a BPM by Halftone, the vibrato, Strobe) ----
  sample(dq_l, dq_r, beat = this.beat) {
    const sr = this.srate, fk = this.ax_fk, sk = this.ax_sk, ew = this.ew, s52 = this.pitchBar;
    // auto gain (L5723)
    this.ag_g += (this.ag_t - this.ag_g) * fk; dq_l *= this.ag_g; dq_r *= this.ag_g;
    // the amounts smoothed (L5726-L5728)
    this.ax_tw += ((this.ax_tint > 0.001 ? 1 : 0) - this.ax_tw) * fk; this.ax_rs += (this.ax_ring - this.ax_rs) * fk; this.ax_cs += (this.ax_clip - this.ax_cs) * fk;
    this.ax_crs += (this.ax_crush - this.ax_crs) * fk; this.ax_ms += (this.ax_mir - this.ax_ms) * fk; this.ax_chs += (this.ax_cho - this.ax_chs) * fk;
    this.ax_es += (this.echoLevel() - this.ax_es) * fk; this.ax_gts += (this.ax_gate - this.ax_gts) * fk;
    // Tint: two one-pole low passes, the level brought back (L5729-L5736)
    if (this.ax_tw > 0.0005) {
      const tk = this.ax_tk;
      this.ax_tl += (dq_l - this.ax_tl) * tk; this.ax_tr += (dq_r - this.ax_tr) * tk;
      this.nx_t2l += (this.ax_tl - this.nx_t2l) * tk; this.nx_t2r += (this.ax_tr - this.nx_t2r) * tk;
      this.ax_tpi += (dq_l * dq_l + dq_r * dq_r - this.ax_tpi) * this.ax_tks; this.ax_tpo += (this.nx_t2l * this.nx_t2l + this.nx_t2r * this.nx_t2r - this.ax_tpo) * this.ax_tks;
      this.ax_tki = Math.max(Math.max(Math.abs(dq_l), Math.abs(dq_r)), this.ax_tki * this.ax_tkd);
      this.ax_tko = Math.max(Math.max(Math.abs(this.nx_t2l), Math.abs(this.nx_t2r)), this.ax_tko * this.ax_tkd);
      this.ax_tg += (Math.max(1, Math.min(4, Math.min(Math.sqrt((this.ax_tpi + 1e-12) / (this.ax_tpo + 1e-12)), (this.ax_tki + 1e-9) / (this.ax_tko + 1e-9)))) - this.ax_tg) * this.ax_tgk;
      dq_l += (this.nx_t2l * this.ax_tg - dq_l) * this.ax_tw; dq_r += (this.nx_t2r * this.ax_tg - dq_r) * this.ax_tw;
    } else { this.ax_tl = this.nx_t2l = dq_l; this.ax_tr = this.nx_t2r = dq_r; this.ax_tpi = this.ax_tpo = this.ax_tki = this.ax_tko = 0; this.ax_tg = 1; }
    // ring mod 220 Hz (Invert, L5737)
    if (this.ax_rs > 0.0005) {
      this.ax_rp += 2 * PI * 220 / sr; if (this.ax_rp > 2 * PI) this.ax_rp -= 2 * PI;
      const m = 1 - this.ax_rs + Math.sin(this.ax_rp) * this.ax_rs; dq_l *= m; dq_r *= m;
    }
    // hard clip 0.22, power matched (Threshold, L5741-L5746)
    if (this.ax_cs > 0.0005) {
      const cs = this.ax_cs;
      this.ac_pi += (dq_l * dq_l + dq_r * dq_r - this.ac_pi) * this.ac_k;
      const g = 1 + 24 * cs; dq_l += (clamp(dq_l * g, -0.22, 0.22) - dq_l) * cs; dq_r += (clamp(dq_r * g, -0.22, 0.22) - dq_r) * cs;
      this.ac_po += (dq_l * dq_l + dq_r * dq_r - this.ac_po) * this.ac_k;
      const m = this.ac_po > 0.000000001 ? Math.min(1, Math.sqrt(this.ac_pi * (1 - 0.3 * cs) / this.ac_po)) : 1; dq_l *= m; dq_r *= m;
    } else this.ac_pi = this.ac_po = 0;
    this.lm_pi += (dq_l * dq_l + dq_r * dq_r - this.lm_pi) * this.lm_k;   // L5748
    // Disc: RIAA mismatch phono EQ + the groove's saturation (L5751-L5757; dk_f L669, dk_sat L671)
    this.dk_w += ((this.ax_dsc > 0.001 ? 1 : 0) - this.dk_w) * fk;
    if (this.dk_w > 0.0005 || this.ax_dsc > 0.001) {
      this.dk_live = 1;
      const yl = this.dkChain(this.dkL, dq_l), yr = this.dkChain(this.dkR, dq_r);
      dq_l += (yl - dq_l) * this.dk_w; dq_r += (yr - dq_r) * this.dk_w;
    } else if (this.dk_live) { this.dkL.fill(0); this.dkR.fill(0); this.dk_live = 0; }
    // Line art: two high passes 20 Hz .. 1.5 kHz (L5758-L5762)
    this.nx_lw += ((this.ax_lna > 0.001 ? 1 : 0) - this.nx_lw) * fk; this.nx_hts += (this.ax_htn - this.nx_hts) * fk; this.nx_zbs += (this.ax_zbl - this.nx_zbs) * fk;
    if (this.nx_lw > 0.0005) {
      const hk = this.nx_hk;
      this.nx_l1 += (dq_l - this.nx_l1) * hk; this.nx_r1 += (dq_r - this.nx_r1) * hk;
      const hl = dq_l - this.nx_l1, hr = dq_r - this.nx_r1;
      this.nx_l2 += (hl - this.nx_l2) * hk; this.nx_r2 += (hr - this.nx_r2) * hk;
      dq_l += (hl - this.nx_l2 - dq_l) * this.nx_lw; dq_r += (hr - this.nx_r2 - dq_r) * this.nx_lw;
    } else { this.nx_l1 = dq_l; this.nx_r1 = dq_r; this.nx_l2 = this.nx_r2 = 0; }
    // Halftone: 2..8 granular voices from a ring (L5765-L5779)
    const HGL = this.HGL, HGR = this.HGR, HGV = this.HGV;
    HGL[ew & (HGN - 1)] = dq_l; HGR[ew & (HGN - 1)] = dq_r;
    if (this.nx_hts > 0.0005) {
      let tp;
      if (this.ax_bpm > 0) tp = beat * 8; else { this.nx_tc += 16 / sr; if (this.nx_tc >= 1024) this.nx_tc -= 1024; tp = this.nx_tc; }
      const mv = 2 + 6 * this.nx_hts; let sl = 0, sr2 = 0, s2 = 0;
      for (let i = 0; i < 8; i++) {
        let ph = tp + i / 8; const q = Math.floor(ph); ph -= q;
        if (q !== HGV[i]) { HGV[i] = q; HGV[8 + i] = Math.floor(Math.random() * this.hg_j); }
        const g = clamp(mv - (((i & 1) << 2) | (i & 2) | ((i & 4) >> 2)), 0, 1);
        if (g > 0) { const sp = Math.sin(PI * ph), w = sp * sp * g, a = (ew - HGV[8 + i]) & (HGN - 1); sl += HGL[a] * w; sr2 += HGR[a] * w; s2 += g * g; }
      }
      const hn = Math.sqrt(2 / s2), hm = Math.min(1, 2 * this.nx_hts);
      dq_l += (sl * hn - dq_l) * hm; dq_r += (sr2 * hn - dq_r) * hm;
    }
    // bitcrusher (LoRez, L5780-L5783)
    if (this.ax_crs > 0.0005) {
      if ((this.ax_hn -= 1) <= 0) { this.ax_hn = this.ax_hold; this.ax_hl = Math.floor(dq_l * this.ax_q + 0.5) / this.ax_q; this.ax_hr = Math.floor(dq_r * this.ax_q + 0.5) / this.ax_q; }
      const m = Math.min(1, this.ax_crs * 3); dq_l += (this.ax_hl - dq_l) * m; dq_r += (this.ax_hr - dq_r) * m;
    }
    // Mirror: rotating-tape pitch-shift chorus (L5787-L5800; mrc_tap / mrc_sh L645-L652)
    this.MRL[ew & (MRN - 1)] = dq_l; this.MRR[ew & (MRN - 1)] = dq_r;
    this.mrc_g4 += (this.mrc_4 - this.mrc_g4) * sk;
    if (this.ax_ms > 0.0005) {
      const st = this.mrc_r / this.mrc_w;
      this.mrc_p1 -= st; if (this.mrc_p1 < 0) this.mrc_p1 += 1;
      const lv = Math.min(1, this.ax_ms * 8);
      let ml = this.mrcSh(this.MRR, this.mrc_p1), mr = this.mrcSh(this.MRL, this.mrc_p1);
      if (this.mrc_g4 > 0.0005) {
        this.mrc_p2 += st; if (this.mrc_p2 >= 1) this.mrc_p2 -= 1;
        this.mrc_p3 += st; if (this.mrc_p3 >= 1) this.mrc_p3 -= 1;
        ml += (this.mrcSh(this.MRL, this.mrc_p2) + this.mrcSh(this.MRR, this.mrc_p3)) * this.mrc_g4;
        mr += (this.mrcSh(this.MRR, this.mrc_p2) + this.mrcSh(this.MRL, this.mrc_p3)) * this.mrc_g4;
      }
      const nn = 1 / Math.sqrt(1 + lv * lv * (1 + 2 * this.mrc_g4));
      dq_l = (dq_l + ml * lv) * nn; dq_r = (dq_r + mr * lv) * nn;
    }
    // Zoom blur: 4 reflections + flanger (L5803-L5814)
    const CHL = this.CHL, CHR = this.CHR, CM = CHN - 1;
    this.HSB[ew & (HSN - 1)] = dq_r; CHL[ew & CM] = dq_l; CHR[ew & CM] = dq_r;
    if (this.nx_zbs > 0.0005) {
      const a1 = (ew - this.nx_d1) & CM, a2 = (ew - this.nx_d2) & CM, a3 = (ew - this.nx_d3) & CM, a4 = (ew - this.nx_d4) & CM;
      const zl = 0.5 * CHL[a1] + 0.38 * CHR[a2] + 0.28 * CHL[a3] + 0.2 * CHR[a4];
      const zr = 0.5 * CHR[a1] + 0.38 * CHL[a2] + 0.28 * CHR[a3] + 0.2 * CHL[a4];
      dq_l += zl * this.nx_zbs; dq_r += zr * this.nx_zbs;
    }
    this.nx_fds += (this.nx_fd - this.nx_fds) * sk; this.nx_fd2s += (this.nx_fd2 - this.nx_fd2s) * sk;
    const FM = FLN - 1;
    if (this.nx_zbs > 0.0005) {
      let i = Math.floor(this.nx_fds), f = this.nx_fds - i;
      const fl = this.FLL[(ew - i) & FM] * (1 - f) + this.FLL[(ew - i - 1) & FM] * f;
      i = Math.floor(this.nx_fd2s); f = this.nx_fd2s - i;
      const fr = this.FLR[(ew - i) & FM] * (1 - f) + this.FLR[(ew - i - 1) & FM] * f;
      this.FLL[ew & FM] = dq_l + fl * 0.6; this.FLR[ew & FM] = dq_r + fr * 0.6;
      dq_l += fl * 0.7 * this.nx_zbs; dq_r += fr * 0.7 * this.nx_zbs;
    } else { this.FLL[ew & FM] = dq_l; this.FLR[ew & FM] = dq_r; }
    // Shift RGB: the right channel later (Haas), Kaleidoscope: chorus (L5817-L5830)
    this.ax_hds += (this.ax_hd - this.ax_hds) * sk;
    if (this.ax_hds > 0.001 || this.ax_chs > 0.0005) {
      if (this.ax_hds > 0.001) {
        const i = Math.floor(this.ax_hds), f = this.ax_hds - i, HM = HSN - 1;
        dq_r = this.HSB[(ew - i) & HM] * (1 - f) + this.HSB[(ew - i - 1) & HM] * f;
      }
      if (this.ax_chs > 0.0005) {
        this.ax_lfo += 0.8 / sr; if (this.ax_lfo > 1) this.ax_lfo -= 1;
        let d = (0.012 + 0.004 * Math.sin(2 * PI * this.ax_lfo)) * sr, i = Math.floor(d), f = d - i;
        const cl = CHL[(ew - i) & CM] * (1 - f) + CHL[(ew - i - 1) & CM] * f;
        d = (0.017 + 0.004 * Math.sin(2 * PI * this.ax_lfo + 2)) * sr; i = Math.floor(d); f = d - i;
        const cr = CHR[(ew - i) & CM] * (1 - f) + CHR[(ew - i - 1) & CM] * f;
        const c = this.ax_chs;
        dq_l = dq_l * (1 - 0.4 * c) + cl * 0.6 * c; dq_r = dq_r * (1 - 0.4 * c) + cr * 0.6 * c;
      }
    }
    // vibrato, pitch end: the vocoder (YIN + an FFT envelope, pulses at the new pitch; L5835-L5888)
    this.ax_vs += (this.ax_vib - this.ax_vs) * sk;
    this.XIN[ew & (VXN - 1)] = (dq_l + dq_r) * 0.5;
    const vt_m = this.ax_vs > 0.0005 ? (1 - s52) * Math.min(1, this.ax_vs * 2) : 0;
    this.vt_ms += (vt_m - this.vt_ms) * sk;
    if (this.vt_ms > 0.001) {
      const y = this.vocoder(dq_l, dq_r, beat), m = Math.min(1, this.vt_ms * 4);
      dq_l += (y - dq_l) * m; dq_r += (y - dq_r) * m;
    } else {
      this.vt_f0 = 0; this.vt_uv = 1; this.vx_cs = -99999; this.vx_pc = 0;
      if (this.vx_on) { this.VPO.fill(0); this.VNO.fill(0); this.vx_on = 0; }
    }
    // vibrato, tape end: a moving delay (L5891-L5898)
    const PM = CHN - 1;
    this.PSL[ew & PM] = dq_l; this.PSR[ew & PM] = dq_r;
    if (this.ax_vs > 0.0005 && s52 > 0.001) {
      this.ax_vp += (this.ax_bpm > 0 ? this.ax_bpm / 60 / (2 * this.vt_st) : 5) / sr; if (this.ax_vp > 1) this.ax_vp -= 1;
      const d = (0.006 + 0.005 * this.ax_vs * s52 * Math.sin(2 * PI * this.ax_vp)) * sr, i = Math.floor(d), f = d - i;
      const cl = this.PSL[(ew - i) & PM] * (1 - f) + this.PSL[(ew - i - 1) & PM] * f;
      const cr = this.PSR[(ew - i) & PM] * (1 - f) + this.PSR[(ew - i - 1) & PM] * f;
      const m = Math.min(1, this.ax_vs * 4) * Math.min(1, s52 * 4); dq_l += (cl - dq_l) * m; dq_r += (cr - dq_r) * m;
    }
    // DJ filter (L5903-L5911)
    this.fl_pi += (dq_l * dq_l + dq_r * dq_r - this.fl_pi) * this.lm_k;
    this.mg_w = clamp(this.mg_w + (this.mg_on ? this.mg_ws : -this.mg_ws), 0, 1);
    if (this.mg_w > 0) {
      let yl = this.mgl.proc(dq_l, this.mg_t, this.mg_m), yr = this.mgr.proc(dq_r, this.mg_t, this.mg_m);
      if (yl !== yl || Math.abs(yl) > 100) { this.mgl.reset(); yl = 0; }
      if (yr !== yr || Math.abs(yr) > 100) { this.mgr.reset(); yr = 0; }
      dq_l += (yl - dq_l) * this.mg_w; dq_r += (yr - dq_r) * this.mg_w;
    }
    this.fl_po += (dq_l * dq_l + dq_r * dq_r - this.fl_po) * this.lm_k;
    // echo (Trails): ping-pong, half a beat by default (L5914-L5919)
    this.ax_ewg += ((this.ax_echo > 0.001 ? 1 : 0) - this.ax_ewg) * fk;
    const EM = ED_N - 1;
    if (this.ax_es > 0.0005 || this.ax_ewg > 0.0005) {
      const ra = (ew - this.ax_ed) & EM, el = this.EDL[ra], er = this.EDR[ra];
      this.EDL[ew & EM] = dq_l * this.ax_ewg + er * this.ax_fb; this.EDR[ew & EM] = dq_r * this.ax_ewg + el * this.ax_fb;
      dq_l += el * this.ax_es; dq_r += er * this.ax_es;
      this.ax_een += (el * el + er * er - this.ax_een) * 0.0005;   // (the tail's energy)
    } else { this.EDL[ew & EM] = 0; this.EDR[ew & EM] = 0; this.ax_een = 0; }
    // level match after the FX, -12 .. +6 dB, less what the filter took (L5923-L5929)
    this.lm_po += (dq_l * dq_l + dq_r * dq_r - this.lm_po) * this.lm_k;
    const lm_on = Math.min(1, 4 * Math.max(
      Math.max(Math.max(this.ax_es, this.ax_crs), Math.max(Math.max(this.nx_lw * this.ax_lna, this.dk_w * this.ax_dsc), Math.max(this.nx_hts, this.nx_zbs))),
      Math.max(Math.max(this.ax_ms, this.ax_chs), Math.max(this.ax_vs * s52, Math.min(1, this.ax_hds / (0.02 * sr))))));
    if (lm_on > 0.001) {
      if (this.lm_pi > 0.0000001 && this.lm_po > 0.0000001)
        this.lm_gt = clamp(Math.sqrt(this.lm_pi * (this.fl_pi > 0.0000001 ? Math.min(4, this.fl_po / this.fl_pi) : 1) / this.lm_po), 0.25, 2);
      this.lm_g += (this.lm_gt - this.lm_g) * this.lm_gk;
      const g = 1 + (this.lm_g - 1) * lm_on; dq_l *= g; dq_r *= g;
    } else this.lm_g = this.lm_gt = 1;
    // VHS hiss (L5930)
    if (this.ax_vhs > 0.001) { const hs = (Math.random() * 2 - 1) * 0.004 * this.ax_vhs; dq_l += hs; dq_r += hs; }
    // Disc crackle (L5933-L5936)
    if (this.ax_dsc > 0.001) {
      const d = this.ax_dsc;
      if (Math.random() < (3 + 57 * d * d) * Math.min(2, this.rate) / sr) this.dk_ck = (Math.random() * 2 - 1) * (0.02 + 0.16 * Math.pow(Math.random(), 6)) * d;
      dq_l += this.dk_ck; dq_r += this.dk_ck * 0.75; this.dk_ck *= 0.7;
    } else this.dk_ck = 0;
    // gate / Strobe on the beat (L5937-L5941)
    if (this.ax_gts > 0.0005) {
      let ph;
      if (this.ax_bpm > 0) ph = beat * this.ax_gs; else { this.ax_tc += (2 + this.ax_gts * 14) / sr; ph = this.ax_tc; }
      this.ax_gg += ((ph - Math.floor(ph) >= 0.5 ? 1 - this.ax_gts : 1) - this.ax_gg) * 0.01;
      dq_l *= this.ax_gg; dq_r *= this.ax_gg;
    } else this.ax_gg = 1;
    this.ew = ew + 1 >= 1073741824 ? 0 : ew + 1;   // L5943
    // L5944 nan_reset; nanHit tells the deck to clear its low cut too (tp_c1l.. in the JSFX's nan_reset)
    if (dq_l !== dq_l || dq_r !== dq_r) { this.reset(); dq_l = dq_r = 0; this.nanHit = 1; }
    this.l = dq_l; this.r = dq_r;
  }

  // Disc's chain for one channel (L5753): record cut (a, b), saturation, playback (d, e); s = [x1, y1] x 4 sections
  dkChain(s, x) {
    let y = this.dk_a0 * x + this.dk_a1 * s[0] - this.dk_a2 * s[1]; s[0] = x; s[1] = y; x = y;
    y = this.dk_b0 * x + this.dk_b1 * s[2] - this.dk_b2 * s[3]; s[2] = x; s[3] = y;
    const dr = this.dk_dr; let t = clamp(y * this.dk_np * dr, -3, 3); x = t * (27 + t * t) / (27 + 9 * t * t) / dr;   // dk_sat (L671)
    y = this.dk_d0 * x + this.dk_d1 * s[4] - this.dk_d2 * s[5]; s[4] = x; s[5] = y; x = y;
    y = this.dk_e0 * x + this.dk_e1 * s[6] - this.dk_e2 * s[7]; s[6] = x; s[7] = y;
    return y * this.dk_nd;
  }

  // Mirror's taps (L651-L652): ring b at phase p (0..1) of the 30 ms; two taps half a turn apart, sin^2 faded
  mrcTap(b, p) {
    const d = 4 + p * this.mrc_w, i = Math.floor(d), f = d - i, q = (this.ew - i) & (MRN - 1);
    return b[q] * (1 - f) + b[(q - 1) & (MRN - 1)] * f;
  }
  mrcSh(b, p) {
    let q = p + 0.5; if (q >= 1) q -= 1;
    const sp = Math.sin(PI * p), sq = Math.sin(PI * q);
    return this.mrcTap(b, p) * sp * sp + this.mrcTap(b, q) * sq * sq;
  }

  // ---- the vocoder's per-sample part (L5844-L5886); returns its output (mono) ----
  vocoder(dq_l, dq_r, beat) {
    const sr = this.srate, ew = this.ew, VH = this.VH, VRL = this.VRL;
    this.vx_on = 1;
    this.vt_l1 += ((dq_l + dq_r) * 0.5 - this.vt_l1) * this.vt_lk; this.vt_l2 += (this.vt_l1 - this.vt_l2) * this.vt_lk;
    if ((this.vt_dc += 1) >= this.vt_dn) {
      this.vt_dc = 0; this.VTD[this.vt_pw & (VTN - 1)] = this.vt_l2; this.vt_pw += 1;
      if (this.vt_pw % 64 === 0) {
        const f = this.yin();
        if (f > 0) { this.vt_f0 = f; this.vt_uv = 0; } else this.vt_uv += 64 * this.vt_dn / sr;
      }
    }
    let bt;
    if (this.ax_bpm > 0) bt = beat / this.vt_st; else { this.vt_fr += 10 / sr; bt = this.vt_fr; }
    const vo = this.vt_f0 > 0 && this.vt_uv < 0.04;
    if (vo) {
      const ci = 1200 * Math.log(this.vt_f0 / 261.63) / Math.log(2);
      if (this.vx_cs < -9999) this.vx_cs = ci;
      this.vx_cs += (ci - this.vx_cs) * this.vx_ck;
      const ct = 100 * this.key + this.p.vibWidth * 48 * Math.cos(PI * bt);
      const co = this.vx_cs + (ct - this.vx_cs) * Math.min(1, this.vt_ms * 2);
      this.vx_to = sr / (261.63 * Math.pow(2, co / 1200));
    }
    if ((this.vx_hc += 1) >= VH) { this.vx_hc = 0; this.analyse(); }
    // a pulse when its time comes (split between two samples for the fraction)
    this.vx_pc -= 1;
    const VPO = this.VPO, VNO = this.VNO, PM = VPN - 1;
    if (this.vx_pc <= 1) {
      if (vo) {
        const a = Math.sqrt(this.vx_to), f = Math.max(0, this.vx_pc), al = this.vx_hc / VH, VHP = this.VHP, VHQ = this.VHQ;
        for (let i = 0; i < VRL; i++) {
          const k = (ew + i) & PM, x = a * (VHQ[i] + (VHP[i] - VHQ[i]) * al);
          VPO[k] += x * (1 - f); VPO[(k + 1) & PM] += x * f;
        }
      }
      this.vx_pc += vo ? this.vx_to : sr / 200;
    }
    const k = ew & PM; let y = VPO[k] + VNO[k]; VPO[k] = VNO[k] = 0;
    // the level: the output's power brought to the input's (VN / 2 back), over about 0.3 s
    const x = this.XIN[(ew - this.VN / 2) & (VXN - 1)];
    this.vx_pi += (x * x - this.vx_pi) * this.vx_pk; this.vx_po += (y * y - this.vx_po) * this.vx_pk;
    if (this.vx_pi > 0.0000001 && this.vx_po > 0.000000001) this.vx_gt = clamp(Math.sqrt(this.vx_pi / this.vx_po), 0.1, 10);
    this.vx_g += (this.vx_gt - this.vx_g) * this.vx_gk;
    return clamp(y * this.vx_g, -1, 1);
  }

  // vt_yin (L687-L719): the pitch (Hz, 0 = none) over the last 25 ms of VTD (about 11 kHz), 65 .. 700 Hz
  yin() {
    const vsr = this.vt_sr, W = Math.floor(0.025 * vsr), t0 = Math.floor(vsr / 700), t1 = Math.floor(vsr / 65);
    const o = this.vt_pw - W - t1 - 1 + VTN * 4, M = W + t1 + 1, NF = 1024, A = this.YA, B = this.YB, C = this.YC, Y = this.VTY, D = this.VTD;
    A.fill(0); B.fill(0);
    C[0] = 0;
    for (let j = 0; j < M; j++) { const x = D[(o + j) & (VTN - 1)]; B[2 * j] = x; if (j < W) A[2 * j] = x; C[j + 1] = C[j] + x * x; }
    this.fft1k.run(A, false); this.fft1k.run(B, false);
    for (let j = 0; j < NF; j++) {
      const ar = A[2 * j], ai = A[2 * j + 1], br = B[2 * j], bi = B[2 * j + 1];
      A[2 * j] = ar * br + ai * bi; A[2 * j + 1] = ar * bi - ai * br;
    }
    this.fft1k.run(A, true);
    const e0 = C[W];
    let cum = 0; Y[0] = 1;
    for (let t = 1; t <= t1 + 1; t++) {
      const d = Math.max(0, e0 + C[t + W] - C[t] - 2 * A[2 * t] / NF);
      cum += d; Y[t] = cum > 0 ? d * t / cum : 1;
    }
    let bt = 0, t = t0, mn = t0;
    while (t < t1 && !bt) { if (Y[t] < Y[mn]) mn = t; if (Y[t] < 0.15 && Y[t] <= Y[t + 1]) bt = t; t++; }
    if (!bt && Y[mn] < 0.3) bt = mn;
    if (bt > 0) {
      const a = Y[bt - 1], b = Y[bt], c = Y[bt + 1], x = a - 2 * b + c;
      let btf = bt;
      if (x > 0) btf += clamp(0.5 * (a - c) / x, -0.5, 0.5);
      this.vt_ad = b; return vsr / btf;
    }
    this.vt_ad = 1; return 0;
  }

  // vx_analyse (L725-L803): the envelope (CheapTrick-like smoothing, cepstral lifter, minimum phase) -> one pulse's
  // response (VHP), and a frame of noise shaped by the aperiodicity overlap-added into VNO
  analyse() {
    const sr = this.srate, VN = this.VN, VH = this.VH, VRL = this.VRL, ew = this.ew, f0 = this.vt_f0;
    const A = this.VZA, B = this.VZB, C = this.VZC, P = this.VCS, L = this.VLM, X = this.VXB, XIN = this.XIN, fft = this.fftV;
    const voiced = f0 > 0 && this.vt_uv < 0.04;
    const t0 = voiced ? sr / f0 : sr / 200, lw = Math.min(VN, Math.floor(3 * t0));
    A.fill(0, 0, 2 * VN);
    let sd = Math.sin(2 * PI / lw), cd = Math.cos(2 * PI / lw), sk = Math.sin(PI / lw), ck = Math.cos(PI / lw), t;
    const base = ew - VN / 2 - Math.floor(lw / 2);
    for (let i = 0; i < lw; i++) {
      A[2 * i] = XIN[(base + i) & (VXN - 1)] * (0.5 - 0.5 * ck);
      t = ck * cd - sk * sd; sk = sk * cd + ck * sd; ck = t;
    }
    fft.run(A, false);
    // power and its running sum (P: power, B: sum, real)
    const sw = 0.375 * lw; let c = 0;
    for (let k = 0; k <= VN / 2; k++) { const v = (A[2 * k] * A[2 * k] + A[2 * k + 1] * A[2 * k + 1]) / sw; P[k] = v; c += v; B[k] = c; }
    // the aperiodicity of 5 bands (500, 1500, 3000, 5000, 8000 Hz)
    X.fill(0, 5, 15);
    if (voiced) {
      let k = 1, f = f0;
      while (f < sr / 2 - f0) {
        let lo = Math.floor(f * VN / sr + 0.5); const a = Math.max(P[lo - 1], Math.max(P[lo], P[lo + 1]));
        let hi = Math.floor((f + f0 / 2) * VN / sr + 0.5); const ph = Math.min(P[hi - 1], Math.min(P[hi], P[hi + 1]));
        const i = f < 1000 ? 0 : f < 2000 ? 1 : f < 4000 ? 2 : f < 6000 ? 3 : 4;
        X[5 + i] += a; X[10 + i] += ph;
        k++; f = k * f0;
      }
      for (let i = 0; i < 5; i++) {
        const v = X[5 + i] > 0 ? clamp((Math.sqrt(X[10 + i] / X[5 + i]) - 0.3) / 0.6, 0, 1) : 1;
        X[i] += (v - X[i]) * (v > X[i] ? 0.7 : 0.35);
      }
    } else for (let i = 0; i < 5; i++) X[i] += (1 - X[i]) * 0.7;
    // the power smoothed over one f0 -> log magnitude
    const hb = Math.max(1, Math.floor(VN / t0 / 2 + 0.5));
    for (let k = 0; k <= VN / 2; k++) {
      const lo = Math.max(0, k - hb - 1), hi = Math.min(VN / 2, k + hb), has = k - hb - 1 >= 0;
      const v = (B[hi] - (has ? B[lo] : 0)) / (hi - (has ? lo : -1));
      L[k] = 0.5 * Math.log(v + 0.0000000001);
    }
    // cepstrum
    for (let k = 0; k < VN; k++) { B[2 * k] = L[k <= VN / 2 ? k : VN - k]; B[2 * k + 1] = 0; }
    fft.run(B, true);
    // CheapTrick's lifter (q1 = -0.15), then minimum phase
    C.fill(0, 0, 2 * VN);
    C[0] = B[0] / VN; const q1 = -0.15;
    sd = Math.sin(PI / t0); cd = Math.cos(PI / t0); sk = sd; ck = cd;
    for (let k = 1; k <= VN / 2; k++) {
      const x = PI * k / t0;
      C[2 * k] = (k < VN / 2 ? 2 : 1) * B[2 * k] / VN * sk / x * ((1 - 2 * q1) + 2 * q1 * (1 - 2 * sk * sk));
      t = ck * cd - sk * sd; sk = sk * cd + ck * sd; ck = t;
    }
    fft.run(C, false);
    // the periodic and the noise spectra (half; the rest mirrored)
    const ap0 = voiced ? clamp((this.vt_ad - 0.05) / 0.35, 0, 1) : 1;
    this.vx_ap += (ap0 - this.vx_ap) * (ap0 > this.vx_ap ? 0.7 : 0.35);
    for (let k = 0; k <= VN / 2; k++) {
      const f = k * sr / VN;
      let apk = f < 500 ? X[0] : f < 1500 ? X[0] + (X[1] - X[0]) * (f - 500) / 1000 : f < 3000 ? X[1] + (X[2] - X[1]) * (f - 1500) / 1500
        : f < 5000 ? X[2] + (X[3] - X[2]) * (f - 3000) / 2000 : f < 8000 ? X[3] + (X[4] - X[3]) * (f - 5000) / 3000 : X[4];
      apk = clamp(apk, 0.02, 1);
      const gp = Math.sqrt(1 - apk * apk), a = Math.exp(C[2 * k]), ph = C[2 * k + 1];
      A[2 * k] = a * gp * Math.cos(ph); A[2 * k + 1] = a * gp * Math.sin(ph);
      B[2 * k] = a * apk * (Math.random() * 2 - 1); B[2 * k + 1] = a * apk * (Math.random() * 2 - 1);
      if (k > 0 && k < VN / 2) {
        A[2 * (VN - k)] = A[2 * k]; A[2 * (VN - k) + 1] = -A[2 * k + 1];
        B[2 * (VN - k)] = B[2 * k]; B[2 * (VN - k) + 1] = -B[2 * k + 1];
      }
    }
    A[1] = A[VN + 1] = B[1] = B[VN + 1] = 0;
    fft.run(A, true);
    this.VHQ.set(this.VHP.subarray(0, VRL));
    for (let i = 0; i < VRL; i++) this.VHP[i] = A[2 * i] / VN * (i < VRL * 0.75 ? 1 : 0.5 + 0.5 * Math.cos(PI * (i - VRL * 0.75) / (VRL * 0.25)));
    fft.run(B, true);
    const nn = Math.sqrt(1.5 * VN) / VN;
    sd = Math.sin(2 * PI / (2 * VH)); cd = Math.cos(2 * PI / (2 * VH)); sk = Math.sin(PI / (2 * VH)); ck = Math.cos(PI / (2 * VH));
    const VNO = this.VNO;
    for (let i = 0; i < 2 * VH; i++) {
      VNO[(ew + i) & (VPN - 1)] += B[2 * i] * nn * (0.5 - 0.5 * ck);
      t = ck * cd - sk * sd; sk = sk * cd + ck * sd; ck = t;
    }
  }
}

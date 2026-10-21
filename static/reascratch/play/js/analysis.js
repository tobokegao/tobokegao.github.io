// ReaScratch Web — a new sample's tempo, beat grid, beat map, key and loudness: the kit's Lua analysis
// (kit/Scripts/ReaScratch/reascratch_lib.lua, "LIB:nnnn" below) re-written in JS, same steps, constants and thresholds.
// Pure JS (no DOM): runs in node and in a Web Worker (analysis_worker.js).
//
// Where the Lua reads the file through a REAPER audio accessor at the analysis rate (11025 / 4410 / 24000 Hz), this
// file resamples the decoded samples itself (windowed sinc, resample()). REAPER's own resampler is not the same one, so
// the values can differ in the last digits (see web/test/analysis_test.mjs).
//
// estimate_key is a port of libKeyFinder (github.com/mixxxdj/libkeyfinder, Ibrahim Sha'ath, GPL-3.0-or-later like
// this kit). estimate_loudness follows ITU-R BS.1770 / EBU R128 as libebur128 (MIT) does it.

// ---------------------------------------------------------------- helpers

// Lua 5.4's float a % b (floored: the result has the sign of b)
function lmod(a, b) {
  let m = a % b;
  if (m !== 0 && (m < 0) !== (b < 0)) m += b;
  return m;
}
const round = (x) => Math.floor(x + 0.5);   // Lua's math.floor(x + 0.5)

// windowed-sinc resampler (Blackman, 8 zero crossings, cutoff 0.9 x the lower Nyquist), polyphase table.
// x: input samples, nOut: how many output samples (past the input's end = 0). Returns Float32Array.
export function resample(x, inRate, outRate, nOut) {
  const out = new Float32Array(nOut);
  if (inRate === outRate) { out.set(x.subarray(0, Math.min(nOut, x.length))); return out; }
  const ratio = inRate / outRate;
  const fc = Math.min(1, outRate / inRate) * 0.9;          // of the input's Nyquist
  const ZC = 8;
  const L = Math.ceil(ZC / fc);                             // half the taps (input samples)
  const T = 2 * L, PH = 512;
  const tab = new Float32Array((PH + 1) * T);
  for (let p = 0; p <= PH; p++) {
    const frac = p / PH;
    let sum = 0;
    for (let k = 0; k < T; k++) {
      const u = (k - L + 1) - frac;                         // tap position minus the output position (input samples)
      let v = 0;
      if (Math.abs(u) < L) {
        const a = Math.PI * fc * u;
        const s = u === 0 ? 1 : Math.sin(a) / a;
        const w = 0.42 + 0.5 * Math.cos(Math.PI * u / L) + 0.08 * Math.cos(2 * Math.PI * u / L);
        v = s * w;
      }
      tab[p * T + k] = v; sum += v;
    }
    for (let k = 0; k < T; k++) tab[p * T + k] /= sum;     // DC gain 1
  }
  const n = x.length;
  for (let j = 0; j < nOut; j++) {
    const pos = j * ratio;
    const base = Math.floor(pos);
    const p = Math.round((pos - base) * PH);
    const o = p * T;
    const i0 = base - L + 1;
    let s = 0;
    if (i0 >= 0 && i0 + T <= n) {
      for (let k = 0; k < T; k++) s += x[i0 + k] * tab[o + k];
    } else {
      for (let k = 0; k < T; k++) { const i = i0 + k; if (i >= 0 && i < n) s += x[i] * tab[o + k]; }
    }
    out[j] = s;
  }
  return out;
}

// in-place radix-2 FFT of n complex values (re, im: 0-based typed arrays), forward (LIB:1436-1459 ky_fft)
export function makeFft(n) {
  const cs = new Float64Array(n / 2), sn = new Float64Array(n / 2), rev = new Uint32Array(n);
  for (let k = 0; k < n / 2; k++) { cs[k] = Math.cos(-2 * Math.PI * k / n); sn[k] = Math.sin(-2 * Math.PI * k / n); }
  let bits = 0;
  while ((1 << bits) < n) bits++;
  for (let i = 0; i < n; i++) {
    let r = 0, x = i;
    for (let b = 0; b < bits; b++) { r = (r << 1) | (x & 1); x >>= 1; }
    rev[i] = r;
  }
  return function fft(re, im) {
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for (let len = 2; len <= n; len *= 2) {
      const half = len >> 1, step = n / len;
      for (let s = 0; s < n; s += len) {
        for (let j = 0, k = 0; j < half; j++, k += step) {
          const a = s + j, b = a + half;
          const wr = cs[k], wi = sn[k];
          const xr = re[b], xi = im[b];
          const tr = xr * wr - xi * wi, ti = xr * wi + xi * wr;
          re[b] = re[a] - tr; im[b] = im[a] - ti;
          re[a] += tr; im[a] += ti;
        }
      }
    }
  };
}

// mono (average of the first 2 channels) of the first `frames` samples
function monoOf(channels, frames) {
  const a = channels[0];
  const y = new Float32Array(frames);
  if (channels.length >= 2) { const b = channels[1]; for (let i = 0; i < frames; i++) y[i] = 0.5 * (a[i] + b[i]); }
  else y.set(a.subarray(0, frames));
  return y;
}

// ---------------------------------------------------------------- tempo / beat grid (LIB:896-1295)
const BT_SR = 11025, BT_HOP = 64, BT_NB = 96;   // LIB:905
const BT_FR = BT_SR / BT_HOP;
const BT_MAX_S = 600;                            // LIB:909 only the first 10 minutes
export { BT_SR, BT_HOP, BT_FR, BT_MAX_S };

// LIB:914-973 energy per 64-sample frame in 3 bands of the mono signal at 11025 Hz (y), first `total` samples.
// Arrays are 1-based like the Lua (index 0 unused). Returns { E1, E2, E3, s1, s2, s3, nf }
export function bandEnergy(y, total) {
  total -= total % BT_HOP;                       // LIB:937 whole frames only
  const a1 = Math.exp(-2 * Math.PI * 200 / BT_SR), a2 = Math.exp(-2 * Math.PI * 2000 / BT_SR);
  const c1 = 1 - a1, c2 = 1 - a2;
  let l1 = 0, l2 = 0, m1 = 0, m2 = 0;
  const nfr = total / BT_HOP;
  const E1 = new Float64Array(nfr + 1), E2 = new Float64Array(nfr + 1), E3 = new Float64Array(nfr + 1);
  let s1 = 0, s2 = 0, s3 = 0, nf = 0, i = 0;
  for (let f = 0; f < nfr; f++) {
    let e1 = 0, e2 = 0, e3 = 0;
    for (let q = 0; q < BT_HOP; q++) {
      const x = i < y.length ? y[i] : 0; i++;
      l1 = c1 * x + a1 * l1; l2 = c1 * l1 + a1 * l2;
      m1 = c2 * x + a2 * m1; m2 = c2 * m1 + a2 * m2;
      const lo = l2, mid = m2 - l2, hi = x - m2;
      e1 += lo * lo; e2 += mid * mid; e3 += hi * hi;
    }
    nf++;
    E1[nf] = e1; E2[nf] = e2; E3[nf] = e3;
    s1 += e1; s2 += e2; s3 += e3;
  }
  return { E1, E2, E3, s1, s2, s3, nf };
}

// LIB:976-999 onset strength (1-based Float64Array), minus its 1 s moving mean, clipped at 0
function bt_onsets(E) {
  const nf = E.nf;
  const o = new Float64Array(nf + 1);
  for (const [Eb, sb] of [[E.E1, E.s1], [E.E2, E.s2], [E.E3, E.s3]]) {
    const ref = 0.01 * sb / nf + 1e-12;
    let prev = Math.log(1 + Eb[1] / ref);
    for (let f = 2; f <= nf; f++) {
      const L = Math.log(1 + Eb[f] / ref);
      if (L > prev) o[f] += L - prev;
      prev = L;
    }
  }
  const h = Math.floor(round(BT_FR) / 2);        // LIB:989
  const cum = new Float64Array(nf + 1);
  for (let f = 1; f <= nf; f++) cum[f] = cum[f - 1] + o[f];
  const out = new Float64Array(nf + 1);
  for (let f = 1; f <= nf; f++) {
    const lo = Math.max(0, f - 1 - h), hi = Math.min(nf, f + h);
    const v = o[f] - (cum[hi] - cum[lo]) / (hi - lo);
    out[f] = v > 0 ? v : 0;
  }
  return out;
}

// LIB:1001-1025 rough tempo by autocorrelation (60..200 BPM, weighted toward 120); null when none
function bt_rough_tempo(o, nf) {
  const lag_lo = Math.floor(60 * BT_FR / 200), lag_hi = Math.ceil(60 * BT_FR / 60);
  let mean = 0;
  for (let f = 1; f <= nf; f++) mean += o[f];
  mean /= nf;
  const z = new Float64Array(nf + 1);
  for (let f = 1; f <= nf; f++) z[f] = o[f] - mean;
  const r = [];                                  // r[L - lag_lo]
  for (let L = lag_lo; L <= lag_hi; L++) {
    let s = 0;
    for (let f = 1; f <= nf - L; f++) s += z[f] * z[f + L];
    r.push(s / (nf - L));
  }
  let best = -Infinity, best_lag = null;
  for (let k = 1; k < r.length - 1; k++) {
    const L = lag_lo + k;
    const bpm = 60 * BT_FR / L;
    const s = r[k] * Math.exp(-0.5 * (Math.log2(bpm / 120) / 0.6) ** 2);
    if (r[k] >= r[k - 1] && r[k] >= r[k + 1] && s > best) {
      const den = r[k - 1] - 2 * r[k] + r[k + 1];
      best = s; best_lag = L + (den < 0 ? 0.5 * (r[k - 1] - r[k + 1]) / den : 0);
    }
  }
  return best_lag !== null ? 60 * BT_FR / best_lag : null;
}

// LIB:1027-1048 onset peaks: t (s), v (height), 1-based arrays (index 0 unused)
function bt_peaks(o, nf) {
  const pos = [];
  for (let f = 1; f <= nf; f++) if (o[f] > 0) pos.push(o[f]);
  let thr = 0;
  if (pos.length > 0) {                          // 0.1 x 99th percentile (numpy's linear interpolation)
    const ps = Float64Array.from(pos).sort();
    const q = 0.99 * (ps.length - 1);
    const i = Math.floor(q);
    thr = 0.1 * (ps[i] + (q - i) * ((i + 1 < ps.length ? ps[i + 1] : ps[i]) - ps[i]));
  }
  const t = [0], v = [0];
  for (let f = 2; f <= nf - 1; f++) {
    const a = o[f - 1], b = o[f], c = o[f + 1];
    if (b > thr && b > a && b >= c) {
      const den = a - 2 * b + c;
      const off = den < 0 ? 0.5 * (a - c) / den : 0;
      t.push((f - 1 + off + 0.5) * BT_HOP / BT_SR);
      v.push(b);
    }
  }
  return [t, v];
}

// LIB:1051-1068 onset weight over the beat phase: BT_NB bins (1-based), linear split, circular [1 2 1] smoothing
function bt_fold(t, v, period, from, to) {
  const h = new Float64Array(BT_NB + 1);
  const i1 = to === undefined ? t.length - 1 : to;
  for (let i = from === undefined ? 1 : from; i <= i1; i++) {
    const ph = lmod(t[i] / period, 1.0) * BT_NB;
    const i0 = Math.floor(ph);
    const fr = ph - i0;
    const k0 = lmod(i0, BT_NB) + 1;
    const k1 = lmod(k0, BT_NB) + 1;
    h[k0] += v[i] * (1 - fr);
    h[k1] += v[i] * fr;
  }
  const s = new Float64Array(BT_NB + 1);
  for (let k = 1; k <= BT_NB; k++) {
    s[k] = 0.25 * h[lmod(k - 2, BT_NB) + 1] + 0.5 * h[k] + 0.25 * h[lmod(k, BT_NB) + 1];
  }
  return s;
}

// LIB:1072-1077 how peaked the fold is; returns [score, h]
function bt_score(t, v, bpm) {
  const h = bt_fold(t, v, 60 / bpm);
  let sum = 0, sq = 0;
  for (let k = 1; k <= BT_NB; k++) { sum += h[k]; sq += h[k] * h[k]; }
  return [sq / Math.max(sum, 1e-12) - sum / BT_NB, h];
}

// LIB:1079-1086 phase 0..1 of the highest bin (parabola), and that bin (1-based)
function bt_peak_phase(h) {
  let k = 1;
  for (let j = 2; j <= BT_NB; j++) if (h[j] > h[k]) k = j;
  const a = h[lmod(k - 2, BT_NB) + 1], b = h[k], c = h[lmod(k, BT_NB) + 1];
  const den = a - 2 * b + c;
  const off = den < 0 ? 0.5 * (a - c) / den : 0;
  return [lmod((k - 1 + off) / BT_NB, 1.0), k];
}

const BT_SNAP_S = 0.010;   // LIB:1088 whole-number snap: most drift allowed over the material (s)
function bt_refine(t, v, bpm) {   // LIB:1089-1104
  const search = (center, half, step) => {
    let best = -Infinity, bb = center;
    const k = round(half / step);
    for (let j = -k; j <= k; j++) {
      const b = center + j * step;
      const s = bt_score(t, v, b)[0];
      if (s > best) { best = s; bb = b; }
    }
    return bb;
  };
  let b = search(bpm, bpm * 0.04, 0.05);
  b = search(b, 0.1, 0.005);
  b = search(round(b * 100) / 100, 0.02, 0.01);
  return round(b * 100) / 100;
}

// LIB:1106-1166 a song: [bpm, grid, conf] or null
function bt_song(E) {
  const nf = E.nf;
  if (nf * BT_HOP < BT_SR * 4) return null;
  const o = bt_onsets(E);
  let omax = 0;
  for (let f = 1; f <= nf; f++) if (o[f] > omax) omax = o[f];
  if (omax <= 0) return null;
  const bpm0 = bt_rough_tempo(o, nf);
  if (!bpm0) return null;
  const [t, v] = bt_peaks(o, nf);
  const nt = t.length - 1;
  if (nt < 8) return null;
  let bpm = bt_refine(t, v, bpm0);
  // LIB:1117-1122 half / double, then into 70..180
  let [, h] = bt_score(t, v, bpm);
  let [, k] = bt_peak_phase(h);
  if (h[lmod(k - 1 + BT_NB / 2, BT_NB) + 1] >= 0.7 * h[k] && bpm * 2 <= 185) bpm = bt_refine(t, v, bpm * 2);
  while (bpm < 70) bpm = bt_refine(t, v, bpm * 2);
  while (bpm > 180) bpm = bt_refine(t, v, bpm / 2);
  // LIB:1123-1127 whole-number BPM
  const bi = round(bpm);
  if (bi !== bpm && t[nt] * Math.abs(bpm - bi) / bpm <= BT_SNAP_S && bt_score(t, v, bi)[0] >= 0.9 * bt_score(t, v, bpm)[0]) bpm = bi;
  const T = 60 / bpm;
  let sc;
  [sc, h] = bt_score(t, v, bpm);
  let ph;
  [ph, k] = bt_peak_phase(h);
  let vmax = 0, first = 0;
  for (let i = 1; i <= nt; i++) if (v[i] > vmax) vmax = v[i];
  for (let i = 1; i <= nt; i++) if (v[i] >= 0.3 * vmax) { first = t[i]; break; }
  // LIB:1136-1140 beat or off-beat
  if (h[lmod(k - 1 + BT_NB / 2, BT_NB) + 1] >= 0.6 * h[k]) {
    if (Math.abs(lmod((first / T - ph) + 0.5, 1.0) - 0.5) > 0.25) ph = lmod(ph + 0.5, 1.0);
  }
  // LIB:1141-1144 the first beat at or after the first strong onset
  let grid = ph * T;
  grid = grid + Math.ceil((first - grid) / T - 0.25) * T;
  if (grid < 0) grid = grid + T * Math.ceil(-grid / T);
  // LIB:1145-1164 confidence
  const near = [];
  for (let j = -10; j <= 10; j++) if (j !== 0) near.push(bt_score(t, v, bpm * (1 + j * 0.004))[0]);
  near.sort((a, b) => a - b);
  const med = 0.5 * (near[near.length / 2 - 1] + near[near.length / 2]);
  const ca = Math.min(1, Math.max(0, (sc / Math.max(med, 1e-12) - 2) / 4));
  let agree = 0, nw = 0;
  let i = 1;
  while (i <= nt) {
    const w = Math.floor((t[i] - t[1]) / 8);
    let j = i;
    while (j < nt && Math.floor((t[j + 1] - t[1]) / 8) === w) j++;
    if (j - i + 1 >= 6) {
      const pp = bt_peak_phase(bt_fold(t, v, T, i, j))[0];
      nw++;
      if (Math.abs(lmod((pp - ph) * 2 + 0.5, 1.0) - 0.5) <= 0.16) agree++;
    }
    i = j + 1;
  }
  const conf = ca * (nw > 0 ? agree / nw : 0);
  return [bpm, grid, conf];
}

// LIB:1168-1265 short loops (<= BT_LOOP_S): the BPM stays as the clip's length makes it
const BT_LOOP_S = 20;
export { BT_LOOP_S };

function bt_loop_onsets(E) {   // LIB:1181-1194 circular onsets: all bands (o) and low + mid (olm), 1-based
  const nf = E.nf;
  const o = new Float64Array(nf + 1), olm = new Float64Array(nf + 1);
  const B = [[E.E1, E.s1], [E.E2, E.s2], [E.E3, E.s3]];
  for (let b = 1; b <= 3; b++) {
    const [Eb, sb] = B[b - 1];
    const ref = 0.01 * sb / nf + 1e-12;
    let prev = Math.log(1 + Eb[nf] / ref);       // (circular: frame 1 rises from the last one)
    for (let f = 1; f <= nf; f++) {
      const L = Math.log(1 + Eb[f] / ref);
      if (L > prev) { o[f] += L - prev; if (b < 3) olm[f] += L - prev; }
      prev = L;
    }
  }
  return [o, olm];
}
function bt_loop_at(o, nf, x) {   // LIB:1195-1200
  const i = round(x);
  let m = 0;
  for (let d = -2; d <= 2; d++) { const w = o[lmod(i + d, nf) + 1]; if (w > m) m = w; }
  return m;
}
function bt_loop_train(o, nf, P, n) {   // LIB:1201-1215
  const sc = (k) => {
    let b = 0, h = 0;
    for (let j = 0; j < n; j++) { b += bt_loop_at(o, nf, k + j * P); h += bt_loop_at(o, nf, k + (j + 0.5) * P); }
    return [(b + 0.5 * h) / n, b / n, h / n];
  };
  let best = -1, bb = 0, bh = 0, bph = 0;
  for (let k = 0; k <= Math.ceil(P) - 1; k++) {
    const [v, b, h] = sc(k);
    if (v > best) { best = v; bb = b; bh = h; bph = k; }
  }
  const [v0, b0, h0] = sc(0);
  if (v0 >= 0.8 * best) { bb = b0; bh = h0; bph = 0; }
  return [bb, bh, bph];
}
function bt_loop(E, dur) {   // LIB:1216-1265: [bpm, grid, conf] or null
  const nf = E.nf;
  if (nf < 16 || dur <= 0) return null;
  const [o, olm] = bt_loop_onsets(E);
  let m = 0;
  for (let f = 1; f <= nf; f++) m += o[f];
  m /= nf;
  if (m <= 0) return null;
  const fr = dur * BT_SR / BT_HOP;
  const fams = [];
  for (const [base, wt] of [[1, 1.0], [3, 0.8]]) {
    let n = base;
    while (n <= 64 && 60 * n / dur < 70) n *= 2;
    if (n <= 64 && 60 * n / dur < 180) {
      for (;;) {
        const [b, h] = bt_loop_train(olm, nf, fr / n, n);
        if (2 * n > 64 || 120 * n / dur >= 180 || h < 0.5 * b) break;
        n *= 2;
      }
      const [b, h, ph] = bt_loop_train(o, nf, fr / n, n);
      fams.push([(b + 0.5 * h) / m * wt, 60 * n / dur, ph * BT_HOP / BT_SR, n]);
    }
  }
  if (fams.length === 0) return null;
  fams.sort((a, b) => b[0] - a[0]);
  const val = fams[0][0];
  let bpm = fams[0][1], grid = fams[0][2];
  const [t, v] = bt_peaks(o, nf);
  if (t.length - 1 < 3) return null;
  // Font & Serra's measure with the onsets' own tempo
  let best = -Infinity, bo = bpm;
  for (let j = -60; j <= 60; j++) {
    const b = bpm * (1 + j * 0.001);
    const sc = bt_score(t, v, b)[0];
    if (sc > best) { best = sc; bo = b; }
  }
  const lb = 60 / bo;
  const k = Math.max(1, round(dur / lb));
  const cl = Math.max(0, 1 - Math.abs(k * lb - dur) / (0.5 * lb));
  const ca = Math.min(1, Math.max(0, (val - 1.5) / 1.5));
  const cb = Math.min(1, Math.max(0, (cl - 0.8) / 0.15));
  // LIB:1255-1263 no whole-number snap (only within 0.005); a beat within 20 ms of the start is put on it
  if (Math.abs(bpm - round(bpm)) <= 0.005) bpm = round(bpm);
  const T = 60 / bpm;
  grid = lmod(grid, T);
  if (grid < 0.02 || grid > T - 0.02) grid = 0;
  return [bpm, grid, ca * cb];
}

// LIB:1270-1275 a BPM that puts a whole number of beats (1..64, within 0.01) into a clip of 20 s or less
export function bpmFits(bpm, dur) {
  if (!(bpm && dur) || bpm <= 0 || dur <= 0 || dur > BT_LOOP_S) return false;
  const nb = bpm * dur / 60;
  const k = round(nb);
  return k >= 1 && k <= 64 && Math.abs(nb - k) <= 0.01;
}
// LIB:1276-1280 whether the "decimals" note is shown (the text itself is the UI's)
export function bpmSuspect(bpm, dur) {
  return !!bpm && bpm > 0 && Math.abs(bpm - round(bpm)) > 0.005 && !bpmFits(bpm, dur);
}

// LIB:1282-1295 from the band energies E (bandEnergy) and the length dur (s, at most BT_MAX_S):
// { bpm, grid, conf } or null
export function estimateBeat(E, dur) {
  if (!E || E.nf < 1) return null;
  const s = bt_song(E);
  const pack = (r) => (r ? { bpm: r[0], grid: r[1], conf: r[2] } : null);
  if (dur > BT_LOOP_S) return pack(s);
  const l = bt_loop(E, dur);
  if (l && l[2] >= 0.35) return pack(l);
  if (s && (!l || s[2] >= l[2])) return pack(s);
  return pack(l);
}

// ---------------------------------------------------------------- tempo that moves (LIB:1297-1412)
const BM_TIGHT = 60, BM_SPREAD = 0.04, BM_MOVE = 1.04;   // LIB:1306

function bm_median(a, i0, i1) {   // LIB:1308-1316 median of a[i0 .. i1] (1-based, inclusive)
  const n = i1 - i0 + 1;
  if (n <= 0) return null;
  const t = new Float64Array(n);
  for (let i = i0; i <= i1; i++) t[i - i0] = a[i];
  t.sort();
  if (n % 2 === 1) return t[(n - 1) / 2];
  return 0.5 * (t[n / 2 - 1] + t[n / 2]);
}
function bm_pct(a, q) {   // LIB:1317-1325 numpy's linear percentile (a 1-based)
  const t = Float64Array.from(a.slice(1)).sort();
  const x = (t.length - 1) * q / 100;
  const lo = Math.floor(x);
  const hi = Math.min(t.length - 1, lo + 1);
  return t[lo] + (t[hi] - t[lo]) * (x - lo);
}

// LIB:1327-1354 DP beat tracker; o 1-based, returns beat frames (0-based)
function bm_dp(o, n, sd, period_at) {
  const score = new Float64Array(n), back = new Int32Array(n);
  for (let t = 0; t < n; t++) {
    const P = period_at(t);
    let lo = Math.floor(t - 2 * P + 0.5);
    const hi = Math.floor(t - P / 2 + 0.5);
    let best = 0, bi = -1;
    if (hi >= 0) {
      lo = Math.max(0, lo);
      let cb = -Infinity, cp = -1;
      for (let p = lo; p <= hi; p++) {
        const lg = Math.log((t - p) / P);
        const c = score[p] - BM_TIGHT * lg * lg;
        if (c > cb) { cb = c; cp = p; }
      }
      if (cp >= 0 && cb > 0) { best = cb; bi = cp; }
    }
    score[t] = o[t + 1] / sd + best;
    back[t] = bi;
  }
  const P = period_at(n - 1);
  const s0 = Math.max(0, n - Math.floor(P));
  let t = s0, bs = -Infinity;
  for (let f = s0; f < n; f++) if (score[f] > bs) { bs = score[f]; t = f; }
  const rev = [];
  while (t >= 0) { rev.push(t); t = back[t]; }
  return rev.reverse();
}

// LIB:1356-1412 beats one by one for a song whose tempo moves: { map: [[t, beat], ...], info, bpm } with map null when
// one tempo is right (info says why). bpm / grid: estimateBeat's (may be unsure / null)
export function estimateBeatMap(E, bpm, grid) {
  const o = bt_onsets(E);
  const n = E.nf;
  let mean = 0, sd = 0;
  for (let f = 1; f <= n; f++) mean += o[f];
  mean /= n;
  for (let f = 1; f <= n; f++) sd += (o[f] - mean) ** 2;
  sd = Math.sqrt(sd / n);
  if (sd <= 0) sd = 1;
  const rough = bpm && bpm > 0 ? bpm : bt_rough_tempo(o, n);
  if (!rough) return { map: null, info: 'no tempo' };
  const P0 = 60 * BT_FR / rough;
  let b = bm_dp(o, n, sd, () => P0);
  if (b.length >= 8) {
    const ibi = [0], mids = [0];                       // 1-based
    for (let i = 0; i < b.length - 1; i++) { ibi.push(b[i + 1] - b[i]); mids.push((b[i + 1] + b[i]) / 2); }
    const nI = ibi.length - 1;
    b = bm_dp(o, n, sd, (t) => {
      let lo = 1, hi = nI + 1;                       // searchsorted (left): the count of mids below t
      while (lo < hi) { const m = (lo + hi) >> 1; if (mids[m] < t) lo = m + 1; else hi = m; }
      const i = lo - 1;
      const med = bm_median(ibi, Math.max(0, i - 4) + 1, Math.min(nI, i + 4));
      const P = med !== null ? med : P0;
      return Math.min(Math.max(P, P0 / 1.6), P0 * 1.6);
    });
  }
  if (b.length < 16) return { map: null, info: 'too few tracked beats' };
  const ts = [0];                                    // 1-based
  for (let i = 0; i < b.length; i++) ts.push(b[i] / BT_FR);
  const nts = ts.length - 1;
  const ibi = [0];
  for (let i = 1; i < nts; i++) ibi.push(ts[i + 1] - ts[i]);
  const nI = ibi.length - 1;
  const sp = [0];
  for (let i = 0; i <= Math.max(1, nI - 15) - 1; i++) {
    let m = 0, v = 0, c = 0;
    for (let j = i + 1; j <= Math.min(nI, i + 16); j++) { m += ibi[j]; c++; }
    m /= c;
    for (let j = i + 1; j <= Math.min(nI, i + 16); j++) v += (ibi[j] - m) ** 2;
    sp.push(Math.sqrt(v / c) / m);
  }
  const spread = bm_median(sp, 1, sp.length - 1);
  const lb = [0];
  for (let i = 0; i < nI; i++) lb.push(60 / bm_median(ibi, Math.max(0, i - 4) + 1, Math.min(nI, i + 4)));
  const p10 = bm_pct(lb, 10), p90 = bm_pct(lb, 90);
  const info = `${nts} tracked beats, ${p10.toFixed(1)} .. ${p90.toFixed(1)} BPM, spread ${spread.toFixed(3)}`;
  if (spread >= BM_SPREAD) return { map: null, info: 'one tempo (tracked beats not steady: ' + info + ')' };
  if (p90 / p10 <= BM_MOVE) return { map: null, info: 'one tempo (it does not move: ' + info + ')' };
  let k0 = 0;
  if (bpm && bpm > 0 && grid !== null && grid !== undefined) k0 = lmod(round((ts[1] - grid) * bpm / 60), 4);
  const map = [];
  for (let i = 1; i <= nts; i++) {
    if (lmod(k0 + i - 1, 4) === 0 || i === nts) map.push([ts[i], k0 + i - 1]);
  }
  return { map: gbThin(map), info, bpm: (p10 + p90) / 2 };
}

// LIB:2117-2125 a beat map of at most GB_MAX anchors: every m-th kept, the last too
export const GB_MAX = 2040;
export function gbThin(map) {
  if (map.length <= GB_MAX) return map;
  const m = Math.ceil(map.length / (GB_MAX - 1)), out = [];
  for (let i = 0; i < map.length; i += m) out.push(map[i]);
  if (out[out.length - 1] !== map[map.length - 1]) out.push(map[map.length - 1]);
  return out;
}

// ---------------------------------------------------------------- musical key (LIB:1414-1582)
// libKeyFinder (github.com/mixxxdj/libkeyfinder, Ibrahim Sha'ath, GPL-3.0-or-later like this kit) re-written:
//   4410 Hz mono -> Blackman frames of 16384 (hop 8192) -> |FFT| -> 72 bands C1..B6, each a (1 - cos) kernel over the
//   bins 0.8 semitone wide, normalised by its sum x the band's frequency -> mean over the frames -> cosine similarity
//   with the tone profiles (Sha'ath's major / minor x octave weights) for the 24 keys.
const KY_SR = 4410, KY_N = 16384, KY_HOP = 8192;   // LIB:1424
const KY_MAJ = [7.23900502618145225142, 3.50351166725158691406, 3.58445177536649417505, 2.84511816478676315967,
  5.81898892118549859731, 4.55865057415321039969, 2.44778850545506543313, 6.99473192146829525484,
  3.39106613673504853068, 4.55614256655143456953, 4.07392666663523606019, 4.45932757378886890365];
const KY_MIN = [7.00255045060284420089, 3.14360279015996679775, 4.35904319714962529275, 5.40418120718934069657,
  3.67234420879306133756, 4.08971184917797891956, 3.90791435991553992579, 6.19960288562316463867,
  3.63424625625277419871, 2.87241191079875557435, 5.35467999794542670600, 3.83242038595048351013];
const KY_OCT = [0.39997267549999998559, 0.55634425248300645173, 0.52496636345143543600,
  0.60847548384277727607, 0.59898115679999996974, 0.49072435317960994006];
export const KEY_UNSURE = 0.002;   // LIB:1433
export const KEY_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
export { KY_SR };

// LIB:1461-1582 y: mono at 4410 Hz, first `total` samples (at most BT_MAX_S s). { key 0-23, lead } or null
export function estimateKey(y, total) {
  if (total === undefined) total = y.length;
  if (total < 4 * KY_SR) return null;           // LIB:1466 shorter than 4 s
  const N = KY_N, H = KY_N / 2;
  const fft = makeFft(H);
  const win = new Float64Array(N);
  for (let n = 0; n < N; n++) win[n] = 0.42 - 0.5 * Math.cos(2 * Math.PI * n / (N - 1)) + 0.08 * Math.cos(4 * Math.PI * n / (N - 1));
  const wc = new Float64Array(H), ws = new Float64Array(H);   // e^(-2 pi i k / N) for the split
  for (let k = 0; k < H; k++) { wc[k] = Math.cos(-2 * Math.PI * k / N); ws[k] = Math.sin(-2 * Math.PI * k / N); }
  // LIB:1518-1533 the band kernels
  const q = 0.8 * (2 ** (1 / 12) - 1);
  const kb = [], kc = [];
  let top = 0;
  for (let b = 0; b < 72; b++) {
    const f = 440 * 2 ** ((b + 24 - 69) / 12);
    const c = f * N / KY_SR;
    const w = c * q;
    const beg = c - w / 2;
    const first = Math.ceil(beg), last = Math.floor(beg + w);
    const co = [];
    let sum = 0;
    for (let bin = first; bin <= last; bin++) { const v = 1 - Math.cos(2 * Math.PI * (bin - beg) / w); co.push(v); sum += v; }
    for (let j = 0; j < co.length; j++) co[j] = co[j] / sum * f;
    kb.push(first); kc.push(Float64Array.from(co));
    if (last > top) top = last;
  }
  // LIB:1534-1563 frames (zero padded at the end)
  const hops = Math.max(1, Math.ceil(total / KY_HOP));
  const acc72 = new Float64Array(72);
  const re = new Float64Array(H), im = new Float64Array(H), mag = new Float64Array(top + 1);
  const yat = (i) => (i < total && i < y.length ? y[i] : 0);
  for (let h = 0; h < hops; h++) {
    const o = h * KY_HOP;
    for (let n = 0; n < H; n++) {
      re[n] = yat(o + 2 * n) * win[2 * n];
      im[n] = yat(o + 2 * n + 1) * win[2 * n + 1];
    }
    fft(re, im);
    for (let k = 0; k <= top; k++) {
      const k1 = k % H, k2 = (H - k) % H;
      const zr = re[k1], zi = im[k1], cr = re[k2], ci = -im[k2];   // Z[k], conj(Z[H - k])
      const er = 0.5 * (zr + cr), ei = 0.5 * (zi + ci);            // even part
      const orr = 0.5 * (zi - ci), oi = -0.5 * (zr - cr);           // odd part = (Z - conj) / 2i
      let tc, tsn;
      if (k < H) { tc = wc[k]; tsn = ws[k]; } else { tc = -wc[k - H]; tsn = -ws[k - H]; }
      const xr = er + orr * tc - oi * tsn, xi = ei + orr * tsn + oi * tc;
      mag[k] = Math.sqrt(xr * xr + xi * xi);
    }
    for (let b = 0; b < 72; b++) {
      const first = kb[b], co = kc[b];
      let s = 0;
      for (let j = 0; j < co.length; j++) s += mag[first + j] * co[j];
      acc72[b] += s;
    }
  }
  for (let b = 0; b < 72; b++) acc72[b] /= hops;
  // LIB:1564-1581 the 24 keys
  let cn = 0;
  for (let b = 0; b < 72; b++) cn += acc72[b] * acc72[b];
  if (cn <= 0) return null;
  let best = -1, bk = null, second = -1;
  for (let k = 0; k < 24; k++) {
    const prof = k < 12 ? KY_MAJ : KY_MIN;
    const t = k % 12;
    let dot = 0, pn = 0;
    for (let b = 0; b < 72; b++) {
      const p = KY_OCT[Math.floor(b / 12)] * prof[lmod(b % 12 - t, 12)];
      dot += acc72[b] * p; pn += p * p;
    }
    const s = dot / (Math.sqrt(cn) * Math.sqrt(pn));
    if (s > best) { second = best; best = s; bk = k; } else if (s > second) second = s;
  }
  return { key: bk, lead: best - second, chroma: acc72, score: best };
}

// LIB:1585-1588 the deck's key value: 0 unknown, 1-12 C..B major, 13-24 C..B minor, +24 unsure
export function keyCode(k, lead) {
  if (k === null || k === undefined) return 0;
  return k + 1 + (lead < KEY_UNSURE ? 24 : 0);
}
// LIB:1602-1607 "Am", "F#" (with "?" when unsure); "" for 0
export function keyName(code) {
  code = Math.floor(code || 0);
  if (code < 1 || code > 48) return '';
  const k = (code - 1) % 24;
  return KEY_NAMES[k % 12] + (k >= 12 ? 'm' : '') + (code > 24 ? '?' : '');
}

// ---------------------------------------------------------------- auto gain (LIB:1609-1692)
// ITU-R BS.1770 / EBU R128 integrated loudness as libebur128 (MIT) does it: K-weighting, mean square of 400 ms blocks
// every 100 ms, gated at -70 LUFS and at 10 LU under the mean of those. Measured at LD_SR, the first BT_MAX_S s.
export const LD_SR = 24000, LD_PK_MARGIN = 1;   // LIB:1618-1619

// channels: Float32Array[] (the first 2 used) at `rate`. { lufs, peakDb } or null (silent / shorter than 0.5 s)
export function estimateLoudness(channels, rate) {
  const nch = Math.max(1, Math.min(2, channels.length));
  const len = channels[0].length / rate;
  if (!(len >= 0.5)) return null;
  const sr = LD_SR;
  // LIB:1638-1646 K-weighting for sr
  let f0 = 1681.974450955533, Q = 0.7071752369554196;
  const G = 3.999843853973347;
  let K = Math.tan(Math.PI * f0 / sr); const Vh = 10 ** (G / 20); const Vb = Vh ** 0.4996667741545416;
  let a0 = 1 + K / Q + K * K;
  const b10 = (Vh + Vb * K / Q + K * K) / a0, b11 = 2 * (K * K - Vh) / a0, b12 = (Vh - Vb * K / Q + K * K) / a0;
  const a11 = 2 * (K * K - 1) / a0, a12 = (1 - K / Q + K * K) / a0;
  f0 = 38.13547087602444; Q = 0.5003270373238773;
  K = Math.tan(Math.PI * f0 / sr); a0 = 1 + K / Q + K * K;
  const a21 = 2 * (K * K - 1) / a0, a22 = (1 - K / Q + K * K) / a0;
  const total = Math.floor(Math.min(len, BT_MAX_S) * sr);
  const inN = Math.min(channels[0].length, Math.ceil(Math.min(len, BT_MAX_S) * rate) + 64);
  const xs = [];
  for (let c = 0; c < nch; c++) xs.push(resample(channels[c].subarray(0, inN), rate, sr, total));
  const st = [];
  for (let c = 0; c < nch; c++) st.push(new Float64Array(8));   // x1 x2 y1 y2 of stage 1, then stage 2's
  const sub = Math.floor(sr / 10);                               // 100 ms
  const subs = [];
  let acc_sq = 0, n_sub = 0, peak = 0;
  for (let i = 0; i < total; i++) {
    for (let c = 0; c < nch; c++) {
      const x = xs[c][i];
      const ax = x < 0 ? -x : x;
      if (ax > peak) peak = ax;
      const s = st[c];
      const y = b10 * x + b11 * s[0] + b12 * s[1] - a11 * s[2] - a12 * s[3];
      s[1] = s[0]; s[0] = x; s[3] = s[2]; s[2] = y;
      const z = y - 2 * s[4] + s[5] - a21 * s[6] - a22 * s[7];
      s[5] = s[4]; s[4] = y; s[7] = s[6]; s[6] = z;
      acc_sq += z * z;
    }
    n_sub++;
    if (n_sub === sub) { subs.push(acc_sq / sub); acc_sq = 0; n_sub = 0; }
  }
  // LIB:1680-1691 400 ms blocks every 100 ms, the gates
  const blocks = [];
  for (let i = 3; i < subs.length; i++) blocks.push((subs[i] + subs[i - 1] + subs[i - 2] + subs[i - 3]) / 4);
  const lufs = (z) => -0.691 + 10 * Math.log10(z);
  let sum = 0, n = 0;
  for (const z of blocks) if (z > 0 && lufs(z) > -70) { sum += z; n++; }
  if (n === 0 || peak <= 0) return null;
  const rel = lufs(sum / n) - 10;
  let sum2 = 0, n2 = 0;
  for (const z of blocks) if (z > 0 && lufs(z) > -70 && lufs(z) > rel) { sum2 += z; n2++; }
  if (n2 === 0) return null;
  return { lufs: lufs(sum2 / n2), peakDb: 20 * Math.log10(peak) };
}

// ---------------------------------------------------------------- a new sample (LIB:2155-2184 analyse_sample)
export const BEAT_MIN_CONF = 0.35;   // LIB:2162

// channels: Float32Array[] (decoded, any rate; the first 2 used), rate: Hz.
// Returns { bpm, grid, beatMap, confidence, key, keyUnsure, lufs, peakDb, ... } with bpm / grid 0 when unknown (as
// the JSFX gets them); est / estGrid = the estimate even when unsure, keyCode = the deck's value, times in ms.
// (rekordbox / Traktor / VirtualDJ XML, which wins over the estimate in the Lua, is not looked at here.)
export function analyze(channels, rate) {
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const r = { bpm: 0, grid: 0, beatMap: null, confidence: 0, key: '', keyUnsure: false, lufs: null, peakDb: null };
  const ch = channels.slice(0, 2);
  const frames = ch[0] ? ch[0].length : 0;
  const len = frames / rate;
  if (!(frames > 0)) return r;
  const dur = Math.min(len, BT_MAX_S);
  r.dur = dur;
  const inN = Math.min(frames, Math.ceil(dur * rate) + 64);
  let t0 = now();
  const mono = monoOf(ch, inN);
  // tempo / beats: 11025 Hz mono (LIB:936-937 the first BT_MAX_S s, whole frames)
  const n11 = Math.floor(dur * BT_SR);
  const y11 = resample(mono, rate, BT_SR, n11);
  const E = bandEnergy(y11, n11);
  const est = E.nf >= 1 ? estimateBeat(E, dur) : null;
  r.est = est ? est.bpm : null; r.estGrid = est ? est.grid : null; r.confidence = est ? est.conf : 0;
  r.sure = !!est && est.conf >= BEAT_MIN_CONF;
  if (r.sure) { r.bpm = est.bpm; r.grid = est.grid; }
  r.tBeat = now() - t0;
  // key: 4410 Hz (from the 11025 Hz mono: already band-limited well under 2205 Hz's need)
  t0 = now();
  if (len >= 4) {
    const nk = Math.floor(dur * KY_SR);
    const y4 = resample(y11, BT_SR, KY_SR, nk);
    const k = estimateKey(y4, nk);
    if (k) { r.keyIndex = k.key; r.keyLead = k.lead; r.keyCode = keyCode(k.key, k.lead); r.key = keyName(k.key + 1); r.keyUnsure = k.lead < KEY_UNSURE; }
  }
  r.tKey = now() - t0;
  // beat map (LIB:2174-2178: tried with the estimate even when unsure)
  t0 = now();
  if (E.nf >= 1) {
    const m = estimateBeatMap(E, r.est, r.estGrid);
    r.mapInfo = m.info;
    if (m.map) { r.beatMap = m.map; r.mapBpm = m.bpm; r.bpm = round(m.bpm * 100) / 100; r.grid = m.map[0][0]; }
  }
  r.tMap = now() - t0;
  r.unsure = r.est !== null && r.bpm === 0;
  t0 = now();
  const ld = estimateLoudness(ch, rate);
  if (ld) { r.lufs = ld.lufs; r.peakDb = ld.peakDb; }
  r.tLoud = now() - t0;
  return r;
}

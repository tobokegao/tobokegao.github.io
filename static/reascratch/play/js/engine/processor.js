// ReaScratch Web — the AudioWorklet: two decks summed into one stereo output (outputs[0], the main), and when the page
// made the node with a second output (numberOfOutputs: 2, outputChannelCount: [2, 2]) the headphones' cue mix on it
// (outputs[1]; the kit's reascratch_cue.jsfx on the "Cue" track).
// Messages from the page: {t: 'load', d, ch: [Float32Array..], rate} / {t: 'call', d, f, a: [...]} / {t: 'set', d, p: {...}}
// / {t: 'xf', v} / {t: 'cueMix', v} (0 = the cue only .. 1 = the main only) / {t: 'cueMixRel', v} (encoder ticks, 1 % each). It posts the decks' state back about 60 times a second for the screen and the picture (the numbers
// in a Float64Array, state_keys.js; the lists now and then).
import { Deck } from './deck.js';
import { FAST } from './state_keys.js';
import { DvsDecoder } from './dvs.js';

// (in the order of FAST)
function fastGet(d, f, o) {
  f[o] = d.videoPos(); f[o + 1] = d.len / d.fsr; f[o + 2] = d.playing; f[o + 3] = d.cue; f[o + 4] = d.hdV * d.srate / d.fsr;
  f[o + 5] = d.gain * d.xfGain; f[o + 6] = d.xfGain; f[o + 7] = d.xfGoal; f[o + 8] = d.tch; f[o + 9] = d.slipOn;
  f[o + 10] = d.slipPos / d.fsr; f[o + 11] = d.p.tempo; f[o + 12] = d.p.bpm; f[o + 13] = d.p.grid;
  f[o + 14] = d.p.bpm > 0 ? d.gbB(d.head) : -1; f[o + 15] = d.audioLag(); f[o + 16] = d.qAct; f[o + 17] = d.syncOn ? 1 : 0;
  f[o + 18] = d.blBeats; f[o + 19] = d.cur; f[o + 20] = d.qAct ? d.qAt / d.fsr : -1; f[o + 21] = d.rvOn;
  f[o + 22] = d.uiTouch ? (d.uiGoal - d.head) / d.fsr : 0; f[o + 23] = d.uiAvg / d.srate * 1000;
  f[o + 24] = d.blRoll; f[o + 25] = d.blPad; f[o + 26] = d.rvF; f[o + 27] = d.apcMvp; f[o + 28] = d.ppK; f[o + 29] = d.relV || 0;
  f[o + 30] = d.pzWait; f[o + 31] = d.mtMe(); f[o + 32] = d.mtAct; f[o + 33] = Math.min(d.mtAge(), 1e6);
  f[o + 34] = d.p.pfl ? 1 : 0; f[o + 35] = d.patNow(); f[o + 36] = d.ptOn ? d.ptK : d.ptReq; f[o + 37] = d.pqWait;
  f[o + 38] = d.gbm ? d.gbm.t.length : 0;
}

// the cue mix (reascratch_cue.jsfx): cue x (1 - m) + main x m (linear: cueing the deck on air keeps its level), the
// metronome added whatever the mix (with 'Metronome out' on the main too, the main brings it by m already: then only
// 1 - m), the mix smoothed over 10 ms; peaks over -1 dBFS turned down at once and back in 0.1 s, then a hard limit
const LM_THR = Math.pow(10, -1 / 20);
const MX_K = 1 - Math.exp(-1 / (0.01 * sampleRate)), LM_K = 1 - Math.exp(-1 / (0.1 * sampleRate));

class ReaScratchProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.decks = [new Deck(sampleRate, 0), new Deck(sampleRate, 1)];
    this.decks[0].other = this.decks[1]; this.decks[1].other = this.decks[0];
    this.post = 0; this.slow = 0; this.dirty = 1; this.ldMs = [0, 0]; this.ldN = 0; this.load = [0, 0];
    this.bL = new Float32Array(128); this.bR = new Float32Array(128); this.quiet = [0, 0]; this.asleep = [0, 0];
    // the cue mix: its value (slider1 of reascratch_cue.jsfx, default 0.5), smoothed gains, limiter gain and its least
    // gain since the last state; the cue / metronome buses the decks add into
    this.cueMix = 0.5; this.mxGc = 0.5; this.mxGm = 0.5; this.lmG = 1; this.lmMin = 1;
    this.cue = { l: new Float32Array(128), r: new Float32Array(128), m: new Float32Array(128) };
    // (⚪209) DVS: the node's inputs 0 / 1 (deck A / B) = a timecode signal, read while its deck's DVS is on; its speed
    // and level posted 10 times a second ({t: 'dvs', s: [[speed, level dB] A, B]})
    this.dvs = [new DvsDecoder(sampleRate), new DvsDecoder(sampleRate)]; this.dvsPost = 0;
    this.port.onmessage = (e) => {
      const m = e.data;
      // any message wakes the deck it is for (the crossfader both)
      if (m.t === 'xf' || m.d === undefined) this.asleep = [0, 0]; else this.asleep[m.d | 0] = 0;
      this.onMsg(m); this.dirty = 1;
    };
  }

  onMsg(m) {
    // {t: 'bypass'}: the decks are not run (silence, the state still posted): ?bypass=1, to tell whether a phone's
    // sound breaks up from the decks' work or by itself (a Motorola with the 2.7 ms buffer of latencyHint 0)
    if (m.t === 'bypass') { this.bypass = !!m.v; return; }
    // the headphones' cue mix: absolute, or by a relative encoder (CV[130] / the SHIFT browse knob: +-1 % a tick, L4693)
    if (m.t === 'cueMix') { const v = Number(m.v); if (v === v) this.cueMix = Math.max(0, Math.min(1, v)); return; }
    if (m.t === 'cueMixRel') { const v = Number(m.v); if (v === v) this.cueMix = Math.max(0, Math.min(1, this.cueMix + v / 100)); return; }
    if (m.t === 'dvs') { this.dvs[m.d | 0].set(m.p || {}); return; }
    const d = this.decks[m.d | 0];
    if (m.t === 'load') d.load(m.ch, m.rate, m.k | 0);
    else if (m.t === 'unload') { d.len = 0; d.playing = 0; }
    else if (m.t === 'set') { d.set(m.p); if ('bpm' in m.p || 'grid' in m.p || 'loop' in m.p || 'cue' in m.p) d.lpCalc(); }
    else if (m.t === 'call' && typeof d[m.f] === 'function') {
      const r = d[m.f](...(m.a || []));
      if (m.id) this.port.postMessage({ t: 'ret', id: m.id, d: m.d | 0, r, p: { bpm: d.p.bpm, grid: d.p.grid } });
    }
    else if (m.t === 'field') d[m.k] = m.v;
    else if (m.t === 'xf') for (const x of this.decks) x.xfPos = m.v;
  }

  process(inputs, outputs) {
    const out = outputs[0], L = out[0], R = out[1] || out[0], n = L.length;
    L.fill(0); if (R !== L) R.fill(0);
    // (⚪209) the records first: a deck on DVS follows its record (touched all the time, as a held jog; every block, 0 =
    // the record stands)
    for (let i = 0; i < 2; i++) {
      const dv = this.dvs[i];
      if (!dv.on) continue;
      const inp = inputs && inputs[i];
      this.decks[i].jogSec(dv.run(inp && inp[0], inp && (inp[1] || inp[0]), n));
      this.asleep[i] = 0;
    }
    this.dvsPost += n;
    if (this.dvsPost >= sampleRate / 10) {
      this.dvsPost = 0;
      if (this.dvs[0].on || this.dvs[1].on) this.port.postMessage({ t: 'dvs', s: this.dvs.map((x) => [x.on ? x.spd : 0, x.on ? x.level() : -150]) });
    }
    // the cue output, when the page has one: the decks add their cue and clicks into this.cue
    const co = outputs[1], cL = co && co[0], cR = co && (co[1] || co[0]);
    let cue = null;
    if (cL) {
      if (this.cue.l.length < n) this.cue = { l: new Float32Array(n), r: new Float32Array(n), m: new Float32Array(n) };
      cue = this.cue; cue.l.fill(0, 0, n); cue.r.fill(0, 0, n); cue.m.fill(0, 0, n);
    }
    // how much of the real time each deck's work takes (Date.now: whole ms, summed over a second it averages out; the
    // worklet has no finer clock), shown by ?diag=1 (Firefox on a phone dropped the sound, user's recordings 2026-10-21)
    // a deck stopped, untouched, still and silent for half a second sleeps (not run) until a message for it comes: a
    // third of the work on a Motorola's Firefox was the stopped deck (user's choice 2026-10-21)
    if (!this.bypass) for (let i = 0; i < 2; i++) {
      const d = this.decks[i];
      // (a deck that would click now wakes: the metronome may have moved to it while it slept)
      if (this.asleep[i] && !d.mtAwake()) continue;
      this.asleep[i] = 0;
      const t0 = Date.now(), bL = this.bL.length >= n ? this.bL : (this.bL = new Float32Array(n)), bR = this.bR.length >= n ? this.bR : (this.bR = new Float32Array(n));
      bL.fill(0, 0, n); bR.fill(0, 0, n);
      d.process(bL, bR, n, cue);
      let pk = 0;
      for (let j = 0; j < n; j++) { L[j] += bL[j]; R[j] += bR[j]; pk = Math.max(pk, Math.abs(bL[j]), Math.abs(bR[j])); }
      this.ldMs[i] += Date.now() - t0;
      const idle = !d.playing && !d.tch && !d.touched && !d.uiTouch && !d.kbTouch && !d.seek && !d.qAct && !d.spinOn &&
        !d.hcHeld && !d.cueHeld && !d.pqWait && Math.abs(d.hdV) < 1e-9 && pk < 1e-5 && !d.mtAwake();
      this.quiet[i] = idle ? this.quiet[i] + n : 0;
      if (this.quiet[i] >= sampleRate / 2) { this.asleep[i] = 1; this.quiet[i] = 0; }
    }
    if (cL) {
      const cu = this.cue, mt = this.decks[0].p.mtOut;   // ('Metronome out' is deck A's, gmem[392])
      for (let j = 0; j < n; j++) {
        this.mxGc += (1 - this.cueMix - this.mxGc) * MX_K; this.mxGm += (this.cueMix - this.mxGm) * MX_K;
        const k = mt ? 1 - this.mxGm : 1;
        let l = cu.l[j] * this.mxGc + L[j] * this.mxGm + cu.m[j] * k, r = cu.r[j] * this.mxGc + R[j] * this.mxGm + cu.m[j] * k;
        if (!(l === l)) l = 0; if (!(r === r)) r = 0;
        const pk = Math.max(Math.abs(l), Math.abs(r)), t = pk > LM_THR ? LM_THR / pk : 1;
        if (t < this.lmG) this.lmG = t; else this.lmG += (t - this.lmG) * LM_K;
        if (this.lmG < this.lmMin) this.lmMin = this.lmG;
        cL[j] = Math.max(-1, Math.min(1, l * this.lmG));
        if (cR !== cL) cR[j] = Math.max(-1, Math.min(1, r * this.lmG));
      }
    }
    this.ldN += n;
    if (this.ldN >= sampleRate) { const T = this.ldN / sampleRate * 1000; this.load = [this.ldMs[0] / T, this.ldMs[1] / T]; this.ldMs = [0, 0]; this.ldN = 0; }
    this.post += n;
    if (this.post >= sampleRate / 60) {
      this.post = 0;
      // the numbers in one Float64Array each time (FAST, per deck); the lists (hot cues, memory cues, the loops) as
      // objects only 4 times a second and after each message from the page. A new object with arrays 60 times a
      // second crackled Firefox on a phone (its worklet's garbage collection; a bare tone with the same messages
      // crackled too, without them it did not, user's check 2026-10-21)
      // (after the decks: their load, then the cue mix and the cue limiter's most gain reduction since the last state, dB)
      const k = FAST.length, f = new Float64Array(5 + 2 * k);
      f[0] = currentTime;
      for (let i = 0; i < 2; i++) fastGet(this.decks[i], f, 1 + i * k);
      f[1 + 2 * k] = this.load[0]; f[2 + 2 * k] = this.load[1];
      f[3 + 2 * k] = this.cueMix; f[4 + 2 * k] = -20 * Math.log10(Math.max(this.lmMin, 0.000001)); this.lmMin = 1;
      this.slow += 1;
      const lists = this.dirty || this.slow >= 15 ? this.decks.map((d) => ({
        hot: Array.from(d.hot), mc: d.mc.slice(), bl: d.blOn ? [d.blA / d.fsr, d.blB / d.fsr] : null,
        slots: d.slots.map((x) => (x ? 1 : 0)), lp: [d.lpA / d.fsr, d.lpB / d.fsr],
        pats: d.ptPads.map((x) => (typeof x === 'number' ? x : -2)),
      })) : null;
      if (lists) { this.slow = 0; this.dirty = 0; }
      this.port.postMessage(lists ? { t: 'state', f, lists } : { t: 'state', f });
    }
    return true;
  }
}

registerProcessor('reascratch', ReaScratchProcessor);

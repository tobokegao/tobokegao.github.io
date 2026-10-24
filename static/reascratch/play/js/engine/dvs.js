// ReaScratch Web — DVS (⚪209): reads a timecode vinyl / CD (or the Pioneer DJ PLX-CRSS12's control tone) from an audio
// input and tells how far the record moved, as kit/Effects/ReaScratch/reascratch_dvs.jsfx does for REAPER. Runs inside
// the AudioWorklet (processor.js: the node's inputs 0 / 1 = deck A / B) and under the tests (web/test/dvs_test.mjs).
// Relative only: the carrier is a quadrature tone (1 kHz at 33 1/3 rpm for Serato and rekordbox, 2 kHz Traktor, 1.3 kHz
// MixVibes), its phase atan2(L, R) turns once a cycle, one way forward, the other backward; the amplitude (the bits of
// the absolute place) drops out of atan2. Below the threshold the phase is noise: the record stands (or the needle is up).

export const DVS_F0 = [1000, 2000, 1300];   // the timecode choices: Serato / rekordbox, Traktor, MixVibes

export class DvsDecoder {
  constructor(srate) {
    this.srate = srate;
    this.on = 0; this.tc = 0; this.rpm45 = 0; this.rev = 0; this.thrDb = -50;
    this.pl = 0; this.pr = 0; this.xl = 0; this.xr = 0; this.ph = 0; this.env = 0; this.spd = 0;
    this.hp = Math.exp(-2 * Math.PI * 5 / srate);          // 5 Hz: rumble and DC, below a slow scratch's carrier
    this.ea = 1 - Math.exp(-1 / (0.02 * srate));           // level, 20 ms
    this.sa = 1 - Math.exp(-1 / (0.05 * srate));           // shown speed, 50 ms
    this.set({});
  }
  // p: {on, tc (0..2), rpm45, rev, thrDb}
  set(p) {
    for (const k of ['on', 'tc', 'rpm45', 'rev', 'thrDb']) if (k in p) { const v = Number(p[k]); if (v === v) this[k] = v; }
    this.f0 = (DVS_F0[this.tc | 0] || 1000) * (this.rpm45 ? 1.35 : 1);
    this.thr = Math.pow(10, this.thrDb / 20);
  }
  // one block of the input (L, R may be missing: no input yet = silence); returns the record's movement in seconds of
  // the record at 1x (+ forward)
  run(L, R, n) {
    let cyc = 0;
    for (let i = 0; i < n; i++) {
      const l = L ? L[i] || 0 : 0, r = R ? R[i] || 0 : 0;
      this.xl = l - this.pl + this.hp * this.xl; this.pl = l;
      this.xr = r - this.pr + this.hp * this.xr; this.pr = r;
      const a = Math.sqrt(this.xl * this.xl + this.xr * this.xr);
      this.env += (a - this.env) * this.ea;
      // (⚪214) MixVibes goes forward the other way (xwax's SWITCH_PHASE; Serato, rekordbox, Traktor: atan2(L, R) grows)
      const p = (this.rev ? 1 : 0) !== (this.tc === 2 ? 1 : 0) ? Math.atan2(this.xr, this.xl) : Math.atan2(this.xl, this.xr);
      let d = p - this.ph; this.ph = p;
      if (d > Math.PI) d -= 2 * Math.PI; else if (d < -Math.PI) d += 2 * Math.PI;
      const m = a > this.thr && this.env > this.thr ? d / (2 * Math.PI) : 0;
      cyc += m;
      this.spd += (m * this.srate / this.f0 - this.spd) * this.sa;
    }
    return cyc / this.f0;
  }
  level() { return this.env > 0 ? Math.max(-150, 20 * Math.log10(this.env)) : -150; }
}

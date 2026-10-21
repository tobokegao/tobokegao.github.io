// ReaScratch Web — DJ controllers through Web MIDI. The presets are the JSFX's 124 (presets.json, made from preset_run by
// tools/extract_presets.mjs); the decoding follows the JSFX's MIDI loop (spec/ui_spec.md §3.4, JSFX:4612-5063).
// decode() is pure (no DOM, no Web MIDI): it turns one message into a list of actions, and initMidi() carries them out.
// Channels in the presets are 1-16 (0 = none); "packed" settings are (channel - 1) * 128 + note.
import { t } from './i18n.js';
import { BLENDS } from './fxpanel.js';

// ---------- the decoder ----------
// actions: {t:'lamp'} (a message on the deck channel), {t:'call', f, a} (a deck engine method), {t:'field', k, v},
// {t:'tempo', v} (tempo %, SYNC off), {t:'sync'} (toggle), {t:'range'} (next tempo range), {t:'xf', v} (0-1),
// {t:'vol', v} (fader 0-1, before squaring), {t:'toggle', k} (a deck setting on / off: 'slip', 'quant', 'cueLoop'),
// {t:'out', bytes} (MIDI back to the unit), {t:'set', p} (deck settings / sound FX: fltCut, fltType, touch, vfxType ...),
// {t:'blend', v} (the video blend, both decks), {t:'msg', v} (a note for the deck's bottom bar), {t:'tap'} (tap tempo),
// {t:'mix', p} (app.mix: mfxType, mfxAmt, keyThresh, keySoft, camBlur / camOver / camShake, blendUnder, cueMix, boost, level,
// blackout, fadeA / fadeB), {t:'deck', d, a} (an action for the other deck), {t:'syncTo', from} (SYNC as deck `from`'s),
// {t:'ret', f} (an engine method whose answer the page wants: app.callRet), {t:'both'} (both decks play / stop)
// The page puts into the state before each message: s.p = the deck's settings (DeckUI.p), s.e = the engine's state
// (DeckUI.s), s.blend = the video blend; decode reads them (the filter's pick-up, VIDEO FX, the blend) and does not write them
// aux (decode's 5th argument): {ax: this unit is the helper APC40, cx: a helper APC40 is there (two controllers)}. As the
// JSFX's second controller (slider 230, cx_on) with an APC40 mkII (ax_on, JSFX:3369): with an APC40 mkII and another
// controller both connected, the APC40 is the other's helper

// state per deck; `shared` is one object for both decks (the APC40's deck select). The page keeps tempo / range current
export function newState(deck, shared = { sel: -1 }) {
  return {
    deck, shared, tempo: 0, range: 16,
    touched: 0, teMsb: 64, teLw: -1, teTk: 1, teMval: -1000, teMlast: -1000,
    xfMsb: 0, xfLw: -1, absMsb: 0, absLsb: 0, dnMsb: 0, dnPrev: 0, dnHave: 0, jkLast: -1,
    hcSh: 0, pdmHold: 0, cdjRev: 0,
    // pad modes (pdm_mode 1 = HOT CUE; JSFX:3450-3590), the SHIFT layer each pad went down on (pm_shm), the DDJ mode button
    // held (pb_hbn / pb_hmd, pv_hold), the filter knobs' SHIFT and pick-ups (fk_sh, fpk / fsk / fsl, JSFX:3629-3655)
    pdm: 1, pmShm: 0, pbHbn: -1, pbHmd: 0, pvHold: 0,
    fkSh: 0, fpk: [0, 0, 0], fsk: [0, 0, 0], fsl: [-1, -1, -1],
    // TOUCH FX rows 1 / 2 (TF / TFB: held, kept on, amount, last tap; JSFX:3712-3760), the FX knobs (sliders 200-206, 151
    // VHS, 207 Strobe), the video FX amount kept while off (vfxk_amt)
    tf: newTf(), tfb: newTf(), fxk: new Array(8).fill(0), strobe: 0, vfxkAmt: 0,
    // APC40: the knob page (kp_page / kp_eff), the sample pads' scroll (sm_off), nudge buttons held (apc_nm / apc_np);
    // ledGen counts what makes every light go again (a page, JSFX:3604 memset APR)
    kpPage: 0, kpEff: 0, smOff: 0, nm: 0, np: 0, ledGen: 0,
    // the video FX channel (slider 84): the FX ON bar on (vfx_bar, JSFX:5021), BANK / SHIFT + FX ON held (fx_kill /
    // fx_kill_d), the faders' effects switched off and their faders' places (fe_off0-2, JSFX:4771)
    vfxBar: 0, killA: 0, killD: 0, feOff: [0, 0, 0], feV: [0, 0, 0],
    // the helper APC40 (JSFX:3942-3963): the DEVICE knobs' effects switched off (axo0-7) / held by CLIP STOP (axh0-7), the
    // faders' pick-ups (apk_m master, apk_s the picture; pku JSFX:3934)
    axo: new Array(8).fill(0), axh: new Array(8).fill(0), apkM: { sv: -1, sl: -1 }, apkS: { sv: -1, sl: -1 },
    // the BROWSE knob's pushes held and turned while held (bs_push / bs_turn, bs_psh / bs_trn2; JSFX:4949-5005)
    bsPush: 0, bsTurn: 0, bsPsh: 0, bsTrn2: 0,
    p: {}, e: {}, blend: 0, mix: {},
  };
}
// what the JSFX keeps in gmem for both decks, in `shared` (made on first use, so a page's own { sel: -1 } works): each
// deck's state (st: the other deck's TOUCH FX pads, mode button, FX ON bar; gmem [104]/[105], [117]/[118], [130]), deck A's
// video FX channel and FX PARAM notes this message (a: gmem [253], [258]-[261]), MASTER held (both, gmem [262]), the mode
// button used while held (pbUsed, gmem [254]), the FX knob's pick-up (kp: kp_id / kp_v / kp_lid / kp_lk, JSFX:3764), the
// blend kept under a transition (blKeep, bl_keep), the blend with the transitions on (blCombo, bl_combo), FX PARAM held =
// the transitions repeat (rp: {d, t} = rp_d / rp_t, JSFX:3855 / 5264), the helper APC40's page (axPg, gmem [238]) and the
// page before this message (axPrev, ax_prevpg), its SHIFT (axSh), the last transition / master FX type for SCENE LAUNCH
// again (axTrl / axMtl)
function shInit(sh) {
  if (!sh.st) {
    Object.assign(sh, { st: [null, null], a: { now: -1, vch: 0, fb: [], mt: -1 }, both: 0, pbUsed: 0, kp: { id: -1, v: 0, lid: -1, lk: 0 }, blKeep: 0,
      blCombo: 0, rp: null, axPg: 1, axPrev: 1, axSh: 0, axTrl: 9, axMtl: 1 });
  }
  return sh;
}
// the video FX types in the order the controls step through them (vfx_ord / vfx_pos, JSFX:3789; vfx_n = 15)
const VFX_N = 15, BLD_N = 37;
const vfxOrd = (i) => (i <= 8 ? i : i <= VFX_N - 3 ? i + 3 : i === VFX_N - 2 ? 11 : i === VFX_N - 1 ? 10 : 9);
const vfxPos = (t) => (t <= 8 ? t : t >= 12 ? t - 3 : t === 11 ? VFX_N - 2 : t === 10 ? VFX_N - 1 : VFX_N);
const VFX_NM = ['Off', 'Tint', 'Hue rotate', 'Invert', 'Threshold', 'Mirror', 'Kaleidoscope', 'LoRez', 'Shift RGB', 'Strobe', 'Trails', 'VHS', 'Disc', 'Line art', 'Halftone', 'Zoom blur'];
const tfFlags = (x) => {   // tf_flags (JSFX:3730): 2 = a TOUCH FX pad held, 1 = one kept on (either row)
  let f = 0;
  if (x) for (let k = 0; k < 8; k++) { if (x.tf.held[k] || x.tfb.held[k]) f |= 2; if (x.tf.keep[k] || x.tfb.keep[k]) f |= 1; }
  return f;
};
const tfCur = (x) => { for (let k = 0; k < 8; k++) { if (x.tf.held[k]) return x.tf.amt[k]; if (x.tfb.held[k]) return x.tfb.amt[k]; } return -1; };   // JSFX:3771
const pct = (v) => Math.floor(v * 100 + 0.5);
const newTf = () => ({ held: new Array(8).fill(0), keep: new Array(8).fill(0), amt: new Array(8).fill(1), tap: new Array(8).fill(-1e9) });

const cdjSpeed = (v, lo) => (v > 64 ? lo + (v - 65) * (4 - lo) / 62 : v < 64 ? -(lo + (63 - v) * (4 - lo) / 62) : 0);   // JSFX:938

// pad k of a row of n from channel c (1-16) and note: in a row = notes on one channel; across channels (CV134) = the same
// note on channels c..c+n-1 (apc_pad, JSFX:3435). ch is 0-based here, as in the JSFX
function apcPad(cv, c, note, n, ch, nt) {
  if (c <= 0) return -1;
  if (cv[134]) return nt === note && ch >= c - 1 && ch < c - 1 + n ? ch - (c - 1) : -1;
  return ch === c - 1 && nt >= note && nt < note + n ? nt - note : -1;
}
// a hot cue pad's index 0-7: the row from the pad 1 note, then the hot cues 5-8 row (CV180) (hc_pk, JSFX:3441)
function hcPk(cv, ch, nt) {
  let k = apcPad(cv, cv[46], cv[47], cv[120], ch, nt);
  if (k < 0 && cv[180] && cv[120] <= 4) { k = apcPad(cv, cv[46], cv[47] + cv[180], cv[120], ch, nt); if (k >= 0) k += cv[120]; }
  return k;
}
const hcPadn = (cv, k) => (cv[118] ? (k >= 4 ? k - 3 : k + 5) : k + 1);   // JSFX:1879 (1-based; CDJ order)

// ---------- pad modes (JSFX:3450-3590) ----------
// pdm_mode: 1 HOT CUE (CUE LOOP with p.cueLoop), 2 SAMPLER (the samples on the pads), 3 off, 4 AUTO LOOP, 5 TOUCH FX,
// 6 SLICER, 7 BOUNCE LOOP, 8 NEURAL MIX (memory cues and held moves; APC40: the video blend), 9 VIDEO FX, 10 FILTER TYPE,
// 12 PITCH PLAY, 13 PATTERN (pad k plays pattern k: the engine's patPad)
export const pdmOn = (cv) => cv[102] >= 0 || cv[182] >= 0 || cv[234] > 0;   // JSFX:3450
export const pdmBtn = (k) => [1, 4, 5, 10, 6, 7, 12, 8][k];                 // JSFX:3581 (the APC40 DEVICE buttons 1-8)
const pdmTg = (s, m) => (m === 10 && s.pdm === 10 ? 13 : m === 10 && s.pdm === 13 ? 10 : m);   // JSFX:1797
export function pdmName(cv, m, cueLoop) {   // JSFX:3582
  return m === 1 ? (cueLoop ? 'pads: CUE LOOP' : 'pads: HOT CUE') : m === 4 ? 'pads: AUTO LOOP' : m === 5 ? 'pads: TOUCH FX' : m === 10 ? 'pads: FILTER TYPE'
    : m === 6 ? 'pads: SLICER' : m === 7 ? 'pads: BOUNCE LOOP' : m === 12 ? 'pads: PITCH PLAY'
      : m === 8 ? (cv[182] >= 0 ? 'pads: VIDEO BLEND (Add .. Chroma key; again = Mix)' : 'pads: NEURAL MIX (memory cues, held moves)')
        : m === 9 ? 'pads: VIDEO FX' : m === 2 ? 'pads: SAMPLER' : m === 13 ? 'pads: PATTERN' : 'pads: off';
}
export const ppSemi = (k) => (k < 4 ? k + 1 : k - 7);                      // JSFX:3589
export const mgPad = (k) => (k === 0 ? 7 : k === 7 ? 0 : k);               // JSFX:1335
const blBnc = (k) => [1 / 8, 1 / 6, 1 / 4, 1 / 3, 1 / 2, 2 / 3, 1, 2][k];   // JSFX:1695
export const vfxPad = (k) => (k < 6 ? k + 1 : k === 6 ? 8 : 9);            // JSFX:3797
// the DDJ / Hercules / Reloop / Numark / Denon layouts (CV234, pb_get JSFX:3505-3539): printed mode k (0-7) -> its button
// note bn (b2 a second one), its pads' first note base, the ReaScratch mode md; bc = the buttons on the pad channel,
// pg = a second page at + 8, tb = the pads the same in every mode
const P8 = (k, ...a) => a[k];
export function pbGet(cv, k) {
  const l = cv[234], r = { bn: -1, b2: -1, base: -1, md: 0 };
  r.bc = l === 14 || l === 15 || l === 16 || l >= 23; r.pg = l === 1 || l === 6; r.tb = (l >= 15 && l <= 18) || l >= 23;
  const T = (bn, base, md) => { r.bn = bn; r.base = base; r.md = md; };
  if (l >= 1 && l <= 6) {
    r.base = k * 16;
    r.bn = l === 5 ? 0x22 + k : l === 6 ? (k < 4 ? 0x40 + k : 0x4c + k) : P8(k, 0x1b, 0x1e, 0x20, 0x22, 0x69, 0x6b, 0x6d, l === 3 || l === 4 ? 0x6e : 0x6f);
    if (l === 4 && k === 7) r.b2 = 0x6f;
    r.md = l === 1 ? P8(k, 1, 5, 6, 2, 12, 7, 4, 8) : l === 2 ? P8(k, 1, 4, 12, 2, 6, 7, 5, 8) : l === 3 ? P8(k, 1, 10, 8, 2, 4, 7, 6, 5)
      : l === 4 ? P8(k, 1, 7, 6, 2, 4, 8, 5, 12) : l === 5 ? P8(k, 1, 4, 7, 6, 5, 12, 8, 10) : P8(k, 1, 7, 4, 2, 12, 6, 5, 8);
  } else if (l === 7) T(0x0f + k, 16 * k, P8(k, 1, 7, 6, 2, 12, 5, 4, 8));
  else if (l === 8) T(0x0f + k, 16 * k, P8(k, 1, 4, 6, 2, 12, 7, 5, 8));
  else if (l === 9) T(0x16 + k, 8 * k, P8(k, 1, 7, 2, 6, 4, 8, 12, 5));
  else if (l === 10) T(k < 4 ? 0x11 + k : 0x4d + k, 8 * k, P8(k, 1, 4, 2, 6, 7, 5, 12, 8));
  else if (l === 11) T(0x48 + k, 8 * k, P8(k, 1, 4, 5, 6, 2, 7, 8, 12));
  else if (l === 12) { if (k < 4) T(-1, 16 * k + 1, P8(k, 1, 4, 7, 2)); }
  else if (l === 13) { if (k < 3) T(-1, P8(k, 0x1b, 0x17, 0x20), P8(k, 1, 4, 2)); }
  else if (l === 14) { if (k < 2) T(k ? 0x06 : 0x0b, k ? 0x14 : 0x18, k ? 4 : 1); }
  else if (l === 15) { if (k < 5) T(P8(k, 0x00, 0x0d, 0x0b, 0x02, 0x0f), -1, P8(k, 1, 4, 2, 6, 5)); }
  else if (l === 16) { if (k < 4) T(P8(k, 0x00, 0x0e, 0x0b, 0x0f), -1, P8(k, 1, 4, 2, 5)); }
  else if (l === 17) { if (k < 4) T(0x0b + k, -1, P8(k, 1, 4, 7, 6)); }
  else if (l === 18) { if (k < 4) T(0x1b + k, -1, P8(k, 1, 7, 6, 4)); }
  else if (l === 19) { if (k < 4) T(0x48 + k, 0x4c + 4 * k, P8(k, 1, 4, 5, 2)); }
  else if (l === 20) { if (k < 4) T(-1, 16 * k, P8(k, 1, 4, 5, 2)); }
  else if (l === 21) { if (k < 4) T(-1, 16 * k, P8(k, 1, 2, 5, 4)); }
  else if (l === 22) { if (k < 2) T(-1, k ? 0x20 : 0x10, k ? 2 : 1); }
  else if (l === 23) { if (k < 4) T(P8(k, 0x00, 0x0b, 0x0e, 0x18), -1, P8(k, 1, 4, 2, 5)); }
  else if (l === 24) T(P8(k, 0x00, 0x08, 0x09, 0x0b, 0x0d, 0x0f, 0x24, 0x02), -1, P8(k, 1, 7, 6, 2, 4, 12, 8, 5));
  return r;
}
const pbShared = (cv) => pbGet(cv, 0).tb;   // JSFX:3540
// a pad's note -> {md, k, sh} (its mode, the pad 0-7, it came on the SHIFT side) or null (pb_find, JSFX:3542-3561)
export function pbFind(cv, ch, nt) {
  const c2 = cv[48] > 0 && cv[48] !== cv[46] && ch === cv[48] - 1;
  if (!(cv[234] > 0 && ((cv[46] > 0 && ch === cv[46] - 1) || c2))) return null;
  for (let p = 0; p < 3; p++) {   // 0 = a plain note, 1 = SHIFT at + CV105 on the same channel, 2 = a second page at + 8
    for (let k = 0; k < 8; k++) {
      const g = pbGet(cv, k), o = nt - g.base - (p === 1 ? cv[105] : p === 2 ? 8 : 0);
      if (g.base >= 0 && (p === 0 || (p === 1 && cv[105] !== 0 && !c2) || (p === 2 && g.pg)) && o >= 0 && o < cv[120]) return { md: g.md, k: o, sh: p === 1 || c2 };
    }
  }
  return null;
}
const pbBaseOf = (cv, m) => { for (let k = 0; k < 8; k++) { const g = pbGet(cv, k); if (g.md === m) return g.base; } return -1; };   // JSFX:3562

// TOUCH FX (JSFX:3712-3760): a pad of row 1 / 2 down / up; a double tap (0.3 s) = kept on / off
function tfTap(r, k, dn, now) {
  r.held[k] = dn ? 1 : 0;
  if (dn) { if (now - r.tap[k] < 300) { r.keep[k] = r.keep[k] ? 0 : 1; r.tap[k] = -1e9; } else r.tap[k] = now; }
}
const TF_NM = ['echo', 'bitcrusher', 'vibrato', 'Invert', 'Threshold', 'Mirror', 'Kaleidoscope', 'Shift RGB'];
const TFB_NM = ['Tint', 'Hue rotate', 'Strobe', 'Disc', 'Line art', 'Halftone', 'Zoom blur', 'VHS'];
const fxkDz = (v) => (v < 0.05 ? 0 : (v - 0.05) / 0.95);   // JSFX:3566
const FK_TY = [1, 2, 3, 4, 5, 6, 8, 11];                  // the FX knobs' types (Tint .. Shift RGB, VHS; fk_ty defaults)
// the amounts by video FX type 1..16 for fx.js's touch[] (JSFX:5181-5187: tk_*, tf_a, tfb_a, fk_amt; 16 = the vibrato)
export function touchArr(s) {
  const a = (r, k) => (r.held[k] || r.keep[k] ? r.amt[k] : 0), T = new Array(17).fill(0);
  // (fk_amt, JSFX:3966: the helper APC40's DEVICE button switches knob i's effect off, CLIP STOP i holds it at the deck's
  // amount for the type (ax_dvamt JSFX:3963; the per-type amounts of gmem [190 + type] are not in the web version: 100 %))
  const P = s.p || {}, axo = s.axo || [], axh = s.axh || [];
  const dvAmt = (ty) => (ty === P.vfxType ? (P.vfxAmt > 0 ? P.vfxAmt : s.vfxkAmt > 0 ? s.vfxkAmt : 1) : 1);
  FK_TY.forEach((ty, i) => { T[ty] = Math.max(T[ty], fxkDz(s.fxk[i]) * (axo[i] ? 0 : 1), axh[i] ? dvAmt(ty) : 0); });
  const mx = (ty, v) => { T[ty] = Math.max(T[ty], v); };
  mx(10, a(s.tf, 0)); mx(7, a(s.tf, 1)); mx(16, a(s.tf, 2));
  for (let k = 3; k <= 6; k++) mx(k, a(s.tf, k));
  mx(8, a(s.tf, 7));
  mx(1, a(s.tfb, 0)); mx(2, a(s.tfb, 1)); mx(9, a(s.tfb, 2)); mx(11, a(s.tfb, 7));
  for (let k = 3; k <= 6; k++) mx(k + 9, a(s.tfb, k));
  return T;
}
const apcRel = (v) => (v < 64 ? v : v - 128);   // JSFX:3430
const knobRel = (cv, v) => (cv[246] ? v - 64 : apcRel(v));   // knob_rel (JSFX:3431): slider 246 = 64-centre
const clamp01 = (v) => Math.max(0, Math.min(1, v));
// tr_step (JSFX:3820): the transition a step (none = back to the blend); x = the deck state that holds the blend
function trStepX(sh, x, d, out) {
  const b = x.blend | 0, n = BLD_N - 7;
  if (b < 9) sh.blKeep = b;
  let q = b >= 9 ? b - 8 : 0; q = (q + (d > 0 ? 1 : n - 1)) % n;
  const v = q === 0 ? sh.blKeep : q + 8;
  out.push({ t: 'blend', v }); x.blend = v;
  out.push({ t: 'msg', v: q === 0 ? `transition: none (blend ${BLENDS[sh.blKeep]})` : `transition: ${BLENDS[v]}` });
}
// FX PARAM / BEAT < > held (the Buddy, deck A): the transitions go on after 0.4 s, 14 a second; the mode button, a TOUCH FX
// pad, an FX ON bar or the filter knobs' SHIFT stops it (JSFX:5264-5265). Run by the page's timer; returns deck A's actions
export function rpTick(sh, now) {
  const out = [];
  if (!sh || !sh.rp) return out;
  const A = sh.st[0], B = sh.st[1];
  if (!A || A.pdmHold || (B && B.pdmHold) || (tfFlags(A) & 2) || A.vfxBar || (B && B.vfxBar) || A.fkSh) { sh.rp = null; return out; }
  if (now >= sh.rp.t) {
    trStepX(sh, A, sh.rp.d, out);
    sh.rp.t = Math.max(sh.rp.t + 70, now - 500);   // (a page that slept does not catch up with a burst)
  }
  return out;
}
// the blend that comes in under a transition (gmem [188], JSFX:5266): only with the blend with transitions on
export const blendUnder = (sh, blend) => ((blend | 0) >= 9 && sh && sh.blCombo ? sh.blKeep | 0 : 0);
// the helper APC40's clip grid (JSFX:3912-3914): index 0 = top left, 8 a row, 40 -> its note (the bottom row is 0-7) and back
const axNote = (i) => { const r = Math.floor(i / 8); return (4 - r) * 8 + i - r * 8; };
const axIdx = (nt) => { const r = 4 - Math.floor(nt / 8); return r * 8 + nt - Math.floor(nt / 8) * 8; };
const axTcol = (t) => (t <= 0 ? 10 : (t - 1) % 12 + 1);   // a video FX type's colour on the pages 3-5
// a fader that picks up (pku, JSFX:3934): within 3 % or crossed since the last place; o = {sv, sl}
function pku(o, v, k) {
  const okk = Math.abs(v - o.sv) < 0.002 || Math.abs(k - v) <= 0.03 || (o.sl >= 0 && (o.sl - v) * (k - v) <= 0);
  o.sl = k; if (okk) o.sv = k;
  return okk;
}

// presetEntry: an entry of presets.json; bytes: [status, data1, data2]; now: ms
export function decode(pe, s, bytes, now, aux = {}) {
  const cv = pe.cv, out = [];
  const [m1, , m3 = 0] = bytes;
  let m2 = bytes[1] || 0;   // (a DDJ mode's pad is read as its hot cue pad's note, JSFX:4818)
  if (m1 === undefined || m1 >= 0xf0) return out;
  const P = s.p || {}, E = s.e || {}, setP = {}, now2 = now;
  const st = m1 & 0xf0, ch = m1 & 0x0f;
  // the video FX channel and its knob (sliders 84 / 85; 0 / -1 = none)
  const SL = pe.sliders || {}, vch = SL[84] > 0 ? SL[84] : 0, vcc = SL[85] ?? -1;
  const sh = shInit(s.shared), od = 1 - s.deck;
  sh.st[s.deck] = s;
  if (s.deck === 0) sh.a = { now, vch, fb: [cv[159], cv[160], cv[161], cv[162]], mt: cv[259] };   // (mt: gmem [399])
  const aHere = sh.a.now === now;   // deck A read this message too (the page reads deck A first)
  const call = (f, ...a) => out.push({ t: 'call', f, a });
  const on = st === 0x90 && m3 > 0, off = st === 0x80 || (st === 0x90 && m3 === 0), note = st === 0x90 || st === 0x80;
  const autoTouch = cv[12] === 0;
  const range = s.range > 0 ? s.range : 16;
  const relTicks = (v) => (cv[8] === 1 ? (v < 64 ? v : v - 128) : cv[8] === 2 ? (v < 64 ? v : 64 - v) : v - 64);   // JSFX:2400
  const jog = (ticks) => (autoTouch ? call('jogAuto', ticks) : call('jogTicks', ticks));
  const touchNow = () => { if (autoTouch) { s.touched = 1; call('jogAuto', 0); } };

  // the tempo changed other than by the fader (SYNC, keys, mouse): the fader must reach it first (JSFX:4612)
  if (Math.abs(s.tempo - s.teMval) > 0.00001) { s.teTk = 1; s.teMlast = -1000; s.teMval = s.tempo; }
  const teIn = (raw) => {   // te_in / te_zone / te_cc (JSFX:1594-1614)
    if (cv[119]) raw = 16383 - raw;
    const z = cv[137] / 100 * 8192, d = raw - 8192;
    if (z > 0) raw = Math.abs(d) <= z ? 8192 : 8192 + Math.sign(d) * (Math.abs(d) - z) * (d > 0 ? 8191 : 8192) / ((d > 0 ? 8191 : 8192) - z);
    const p = (1 - raw / 8192) * range, tc = Math.max(-range, Math.min(range, s.tempo));
    if (s.teTk) {
      if (Math.abs(p - tc) < range * 0.05 || (s.teMlast > -999 && (p - tc) * (s.teMlast - tc) <= 0)) s.teTk = 0;
      s.teMlast = p;
    }
    if (!s.teTk) {
      const v = Math.max(-50, Math.min(50, p));
      s.tempo = s.teMval = v;
      out.push({ t: 'tempo', v });
    }
  };

  // the knob page in use: SHIFT held = page 2 for the moment (APC40; cx_pre JSFX:3598-3603); back on page 1 the jog knob to 64
  const kpUpd = () => {
    const kn = cv[214] >= 0 && cv[181] >= 0 && s.hcSh ? 1 : s.kpPage;
    if (kn !== s.kpEff) {
      s.kpEff = kn; s.ledGen++;
      if (!kn && cv[8] === 7 && cv[214] >= 0 && !aux.ax) { out.push({ t: 'out', bytes: [0xb0 | (cv[6] - 1), cv[7], 64] }); s.jkLast = 64; }
    }
  };
  kpUpd();
  const msg = (v) => out.push({ t: 'msg', v });
  // the filter knobs (flt_cc / flt_pk / flt_sh, JSFX:3600-3655): morph (CV155, centre = 0), resonance (CV156), cutoff (CV157,
  // centre = off); with the filter knobs' SHIFT (CV226): echo length, echo feedback, key, each picking up where it is
  const cur = (k, d) => (k in setP ? setP[k] : P[k] !== undefined ? P[k] : d);
  const fltCc = (cc, v) => {
    if (cv[155] >= 0 && cc === cv[155]) setP.fltMorph = Math.abs(v - 64) <= 1 ? 0 : Math.max(-0.5, Math.min(0.5, (v - 64) / 126));
    if (cv[156] >= 0 && cc === cv[156]) setP.fltRes = v / 127;
    if (cv[157] >= 0 && cc === cv[157]) setP.fltCut = Math.abs(v - 64) <= 1 ? 0 : Math.max(-1, Math.min(1, (v - 64) / 63));
  };
  const fltPk = (cc, v) => {
    const i = cc === cv[155] ? 0 : cc === cv[156] ? 1 : cc === cv[157] ? 2 : -1;
    if (i >= 0) { s.fsk[i] = 1; s.fsl[i] = -1; }
    if (cv[155] >= 0 && cc === cv[155] && s.fpk[0]) { if (Math.abs(v - (64 + cur('fltMorph', 0) * 126)) <= 4) s.fpk[0] = 0; }
    else if (cv[156] >= 0 && cc === cv[156] && s.fpk[1]) { if (Math.abs(v - cur('fltRes', 0.4) * 127) <= 4) s.fpk[1] = 0; }
    else if (cv[157] >= 0 && cc === cv[157] && s.fpk[2]) { if (Math.abs(v - (64 + cur('fltCut', 0) * 63)) <= 4) s.fpk[2] = 0; }
    else fltCc(cc, v);
  };
  const fltSh = (cc, v) => {
    const pick = (i, ok, apply, nm) => {
      if (!s.fsk[i] || ok) { s.fsk[i] = 0; apply(); } else msg(`${nm}: turn the knob to its place to pick up`);
      s.fsl[i] = v; s.fpk[i] = 1;
    };
    if (cv[155] >= 0 && cc === cv[155]) {
      const k = Math.min(5, Math.floor(v * 6 / 128)), e = cur('echoLen', 2), q = (e + 0.5) * 128 / 6;
      pick(0, k === e || (s.fsl[0] >= 0 && (s.fsl[0] - q) * (v - q) <= 0), () => { setP.echoLen = k; }, 'echo length');
    } else if (cv[156] >= 0 && cc === cv[156]) {
      const q = cur('echoFb', -1) / 0.95 * 127;
      pick(1, Math.abs(v - q) <= 4 || (s.fsl[1] >= 0 && (s.fsl[1] - q) * (v - q) <= 0), () => { setP.echoFb = v / 127 * 0.95; }, 'echo feedback');
    } else if (cv[157] >= 0 && cc === cv[157]) {
      const k = Math.abs(v - 64) <= 2 ? 0 : Math.max(-12, Math.min(12, Math.floor((v - 64) / 63 * 12 + (v > 64 ? 0.5 : -0.5)))), e = cur('key', 0), q = 64 + e / 12 * 63;
      pick(2, k === e || (s.fsl[2] >= 0 && (s.fsl[2] - q) * (v - q) <= 0), () => { setP.key = k; }, 'key');
    }
  };
  const touchSet = () => { setP.touch = touchArr(s); };
  const vfxToggle = () => {   // apc_vfx (JSFX:3866): the video FX on / off keeping its amount
    const a = cur('vfxAmt', 0), ty = cur('vfxType', 0);
    if (ty > 0 && a > 0) { s.vfxkAmt = a; setP.vfxAmt = 0; } else { setP.vfxAmt = s.vfxkAmt > 0 ? s.vfxkAmt : 1; if (!ty) setP.vfxType = 1; }
  };

  // ---- the video FX controls for both decks (JSFX:3700-3870, 4292-4340): the master video FX (slider 86 / 87), the key
  // (79 / 80) and the blend (78) are the page's app.mix (s.mix) and s.blend; another deck's settings go out as {t:'deck'} ----
  const M = s.mix || {}, setM = {};
  const curM = (k, d) => (k in setM ? setM[k] : M[k] !== undefined ? M[k] : d);
  const setD = (d, p) => { if (d === s.deck) Object.assign(setP, p); else out.push({ t: 'deck', d, a: { t: 'set', p } }); };
  const dSt = (d) => sh.st[d];
  const dAmt = (d) => (d === s.deck ? cur('vfxAmt', 0) : ((dSt(d) || {}).p || {}).vfxAmt || 0);
  const blendTo = (v) => { out.push({ t: 'blend', v }); s.blend = v; };
  const kpick = (id, v, k) => {   // kpick (JSFX:3764): the knob moves a value only once it has reached it
    const kp = sh.kp;
    const okk = (kp.id === id && Math.abs(v - kp.v) < 0.002) || Math.abs(k - v) <= 0.03 || (kp.lid === id && (kp.lk - v) * (k - v) <= 0);
    kp.lid = id; kp.lk = k;
    if (okk) { kp.id = id; kp.v = k; } else msg(`FX knob ${pct(k)} %: turn it to ${pct(v)} % to pick up`);
    return okk;
  };
  const vfxStep = (d) => {   // vfx_step (JSFX:3702): the amount (on) or the one FX ON will bring (off), 0.1 .. 1
    const a = cur('vfxAmt', 0), onV = a > 0 && cur('vfxType', 0) > 0, q = (x) => Math.max(0.1, Math.min(1, Math.round(x * 10) / 10 + d));
    if (onV) setP.vfxAmt = q(a); else s.vfxkAmt = q(s.vfxkAmt > 0 ? s.vfxkAmt : 1);
    msg(`video FX amount ${pct(onV ? setP.vfxAmt : s.vfxkAmt)} %`);
  };
  const vfxTstep = (d) => {   // vfx_tstep (JSFX:3791): this deck's type a step
    const t0 = cur('vfxType', 0);
    const ty = vfxOrd(t0 < 1 ? (d > 0 ? 1 : VFX_N) : (vfxPos(t0) - 1 + (d > 0 ? 1 : VFX_N - 1)) % VFX_N + 1);
    setP.vfxType = ty; msg(`deck ${s.deck ? 'B' : 'A'} video FX: ${VFX_NM[ty]}`);
  };
  const mtStep = (d) => {   // mt_step (JSFX:3806): the master's type a step (Off at the ends)
    const t0 = curM('mfxType', 0);
    let q = t0 < 1 ? 0 : vfxPos(t0); q = (q + (d > 0 ? 1 : VFX_N)) % (VFX_N + 1);
    setM.mfxType = q === 0 ? 0 : vfxOrd(q); msg(`master video FX: ${VFX_NM[setM.mfxType]}`);
  };
  const blStep = (d) => {   // bl_step (JSFX:3815): the blend a step (Mix .. Chroma key); under a transition only the kept one
    const b = s.blend | 0;
    sh.blKeep = ((b < 9 ? b : sh.blKeep) + (d > 0 ? 1 : 8)) % 9;
    if (b < 9) blendTo(sh.blKeep);
    msg(b >= 9 ? `video blend: ${BLENDS[sh.blKeep]} (with ${BLENDS[b]})` : `video blend: ${BLENDS[sh.blKeep]}`);
  };
  const trStep = (d) => trStepX(sh, s, d, out);   // tr_step (JSFX:3820)
  const tfKnob = (d, v) => {   // tf_knob (JSFX:3753): the FX knob on deck d's held TOUCH FX pads
    const x = dSt(d); if (!x) return;
    for (let k = 0; k < 8; k++) {
      if (x.tf.held[k]) { x.tf.amt[k] = v; msg(`${TF_NM[k]} ${pct(v)} %`); }
      if (x.tfb.held[k]) { x.tfb.amt[k] = v; msg(`${TFB_NM[k]} ${pct(v)} %`); }
    }
    setD(d, { touch: touchArr(x) });
  };
  const fbFw = (vfk) => s.deck === 1 && !!cv[247] && (!aHere || !sh.a.fb.includes(vfk));   // a button deck A does not have (fb_fw)
  const tfStep = (d, fw) => {   // tf_step (JSFX:3845): the held pads' amounts, else the kept ones', else the bar's type, else ...
    const f = tfFlags(s), o = tfFlags(dSt(od)), b = cv[247] && (s.vfxBar || 0), ob = cv[247] && dSt(od) && dSt(od).vfxBar;
    const w = f & 2 ? 0 : o & 2 ? -1 : b ? -3 : ob ? -1 : f & 1 ? 8 : o & 1 ? -1 : -2;
    if (w >= 0) {
      for (let k = 0; k < 8; k++) {
        const q = (x) => Math.max(0.1, Math.min(1, Math.round(x * 10) / 10 + d));
        if (w ? s.tf.keep[k] : s.tf.held[k]) { s.tf.amt[k] = q(s.tf.amt[k]); msg(`${TF_NM[k]} ${pct(s.tf.amt[k])} %`); }
        if (w ? s.tfb.keep[k] : s.tfb.held[k]) { s.tfb.amt[k] = q(s.tfb.amt[k]); msg(`${TFB_NM[k]} ${pct(s.tfb.amt[k])} %`); }
      }
      touchSet();
    } else if (w === -3) vfxTstep(d);
    // (the Buddy: the transition; deck A's held = repeats, rp_d: see rpTick)
    else if (w === -2) {
      if (!cv[247]) vfxStep(d);
      else if (s.deck === 0) { trStep(d); sh.rp = { d: d > 0 ? 1 : -1, t: now + 400 }; } else if (fw) trStep(d);
    }
  };
  // the FX knob (fx_knob, JSFX:4298): sh = its SHIFT side; what is held = what it works on (a TOUCH FX pad, the mode button,
  // a deck's FX ON bar; with slider 247, the Buddy), else the master's type (SHIFT: the blend)
  const fxKnob = (shf, v) => {
    const A = dSt(0), B = dSt(1), fA = tfFlags(A), fB = tfFlags(B), pd = !!((A && A.pdmHold) || (B && B.pdmHold));
    const barA = !!(A && A.vfxBar), barB = !!(B && B.vfxBar), k = v / 127;
    const barSet = () => {
      if (barA) setD(0, { vfxAmt: k }); if (barB) setD(1, { vfxAmt: k });
      msg(`${barA && barB ? 'decks A and B:' : barA ? 'deck A:' : 'deck B:'} video FX ${pct(k)} %`);
    };
    if (!shf && ((fA & 2) || (fB & 2))) {
      const d = fA & 2 ? 0 : 1;
      if (!cv[247] || kpick(3, tfCur(dSt(d)), k)) tfKnob(d, k);
    } else if (!shf && pd) {
      sh.pbUsed = 1;
      if (cv[247]) { if (kpick(4, curM('keyThresh', 0.3), k)) { setM.keyThresh = k; msg(`key threshold ${pct(k)} %`); } }
      else {
        const ty = v === 0 ? sh.blKeep : 9 + Math.min(BLD_N - 9, Math.floor((v - 1) * (BLD_N - 8) / 127));
        if (ty !== (s.blend | 0)) { if ((s.blend | 0) < 9) sh.blKeep = s.blend | 0; blendTo(ty); msg(`transition: ${ty >= 9 ? BLENDS[ty] : 'none'}`); }
      }
    } else if (!shf) {
      if (cv[247] && (barA || barB)) { if (kpick(2, barA ? dAmt(0) : dAmt(1), k)) barSet(); }
      else if (cv[247]) { if (kpick(5, curM('keySoft', 0.1), k)) { setM.keySoft = k; msg(`transition softness ${pct(k)} %`); } }
      else {
        const ty = v === 0 ? 0 : vfxOrd(1 + Math.min(VFX_N - 1, Math.floor((v - 1) * VFX_N / 127)));
        if (ty !== curM('mfxType', 0)) { setM.mfxType = ty; msg(`master video FX: ${VFX_NM[ty]}`); }
      }
    }
    if (shf && cv[247] && pd) { sh.pbUsed = 1; if (kpick(5, curM('keySoft', 0.1), k)) setM.keySoft = k; msg(`key softness ${pct(curM('keySoft', 0.1))} %`); }
    else if (shf && cv[247] && (barA || barB)) { if (kpick(2, barA ? dAmt(0) : dAmt(1), k)) barSet(); }
    else if (shf && cv[247]) { if (kpick(1, curM('mfxAmt', 0), k)) { setM.mfxAmt = k; msg(`master video FX ${pct(k)} %`); } }
    else if (shf) {
      const ty = v === 0 ? 0 : 1 + Math.min(7, Math.floor((v - 1) * 8 / 127));
      if (ty !== (s.blend | 0)) { blendTo(ty); msg(`video blend: ${BLENDS[ty]}`); }
    }
  };
  const newMode = (m) => {   // L4794-L4796 / L4825: the deck's side in setPadMode
    s.pdm = m; call('setPadMode', m); s.ledGen++;
    msg(pdmName(cv, m, m === 1 ? cur('cueLoop', 0) : 0));
  };

  const fin = () => {   // the settings this message changed, and the blend under a transition (gmem [188], JSFX:5266)
    kpUpd();
    const bu = blendUnder(sh, s.blend);
    if (bu !== curM('blendUnder', 0)) setM.blendUnder = bu;
    if (Object.keys(setP).length) out.push({ t: 'set', p: setP });
    if (Object.keys(setM).length) out.push({ t: 'mix', p: setM });
    return out;
  };
  const callD = (d, f, ...a) => { if (d === s.deck) call(f, ...a); else out.push({ t: 'deck', d, a: { t: 'call', f, a } }); };
  const cueMixBy = (dv) => {   // the headphones' cue mix (gmem [44]: 0 = the cue only .. 1 = the main; 0.5 at first)
    setM.cueMix = clamp01(curM('cueMix', 0.5) + dv);
    const c = pct(setM.cueMix); msg(`headphones: cue ${100 - c} % / master ${c} %`);
  };

  // ---- the helper APC40 (apc_aux, JSFX:4033-4100; user's choices 2026-10-13): taken here, the rest of the loop leaves it.
  // SCENE LAUNCH 1-5 = the clip grid's page (1 as before, 2 the blends and transitions, 3 / 4 deck A's / B's video FX type,
  // 5 the master's; the page's button again = its effect on / off), DEVICE 1-8 = the FX knobs' effects on / off, CLIP STOP
  // 1-8 = those effects while held, TRACK KNOBs on the pages 2-5 = the page's settings, MASTER held = both decks (SHIFT:
  // the blackout), METRONOME, STOP ALL CLIPS = both decks stop, the crossfader = the FX boost, TRACK KNOB 1 / 5 on page 1 =
  // the sound of deck A's / B's video FX, the master fader = the whole level, track fader 1 / 5 = the deck's picture.
  // Deck A decides what both share (deck B: page 4's and its own DEVICE / CLIP STOP / knobs) ----
  const isA = s.deck === 0;
  const axDeck = isA ? 'deck A' : 'deck B';
  const axPick2 = (i) => {   // ax_pick2 (JSFX:3917): 0-8 the blends, 9 no transition, 10-38 the transitions, 39 bl_combo
    if (i <= 8) { sh.blKeep = i; if ((s.blend | 0) < 9) blendTo(i); msg(`video blend: ${BLENDS[i]}`); }
    else if (i === 9) { blendTo(sh.blKeep); msg(`transition: none (blend ${BLENDS[sh.blKeep]})`); }
    else if (i <= 38) { blendTo(i - 1); msg(`transition: ${BLENDS[i - 1]}`); }
    else { sh.blCombo = sh.blCombo ? 0 : 1; msg(`blend with transitions: ${sh.blCombo ? 'on' : 'off'}`); }
  };
  const axPickD = (ty) => {   // ax_pickd (JSFX:3925): this deck's type (the one chosen again = on / off)
    if (ty === cur('vfxType', 0) && ty > 0) vfxToggle();
    else { setP.vfxType = ty; if (ty > 0 && cur('vfxAmt', 0) <= 0) vfxToggle(); }
    msg(`${axDeck} video FX: ${VFX_NM[cur('vfxType', 0)]}${cur('vfxAmt', 0) > 0 ? '' : ' (off)'}`);
  };
  const axLfPick = (i) => {   // ax_lfpick (JSFX:3980): row 3 the LFO's shape, row 4 its rate, row 5 its depth
    const r = Math.floor(i / 8), c = i - r * 8;
    if (r === 2 && c <= 4) setP.lfoShape = c; else if (r === 3 && c <= 5) setP.lfoRate = c; else if (r === 4) setP.lfoDepth = c / 7;
    const sp = cur('lfoShape', 2), rt = cur('lfoRate', 2);
    msg(`${axDeck} video FX LFO: ${['Sine', 'Triangle', 'Square', 'Saw down', 'Saw up'][sp]}, ${['1/4 beat', '1/2 beat', '1 beat', '2 beats', '4 beats', '8 beats'][rt]}, depth ${pct(cur('lfoDepth', 0))} %`);
  };
  const axKnob = (pg, k, v) => {   // ax_knob (JSFX:4003): the page's settings
    if (pg === 2) {
      const K = [['keySoft', 'edge softness'], ['keyThresh', 'key threshold'], ['camBlur', 'camera move blur'], ['camOver', 'camera move overshoot'], ['camShake', 'camera move shake']][k];
      if (!K) return;
      setM[K[0]] = k === 3 ? v * 2 : v;
      msg(k === 3 ? `${K[1]} ${(v * 2).toFixed(2)}` : `${K[1]} ${pct(v)} %`);
      return;
    }
    const ty = pg === 5 ? curM('mfxType', 0) : cur('vfxType', 0);
    if (k === 0) {
      if (pg === 5) setM.mfxAmt = v; else if (cur('vfxAmt', 0) > 0) setP.vfxAmt = Math.max(0.01, v); else s.vfxkAmt = Math.max(0.01, v);
      msg(`${pg === 5 ? 'master' : axDeck} ${VFX_NM[ty]} amount ${pct(v)} %`);
    } else if (k === 1) {   // (the type's own sound, gmem [150 + type]: the web version has the deck's video FX sound only)
      if (pg === 5) msg('master video FX sound: not in the web version'); else if (ty > 0) { setP.fxSound = v; msg(`${axDeck} video FX sound ${pct(v)} %`); }
    } else if (k === 2) { setP.lfoDepth = v; msg(`video FX LFO depth ${pct(v)} %`); }
    else if (k === 3) {
      if (ty === 1) { setP.tintDark = Math.floor(v * 14 + 0.5); msg('Tint dark colour'); }
      else if (ty === 9) { setP.gateStep = Math.min(4, Math.floor(v * 6) - 1); msg(`Strobe step ${setP.gateStep < 0 ? 'by the amount' : 'set'}`); }
    } else if (k === 4 && ty === 1) { setP.tintLight = Math.floor(v * 14 + 0.5); msg('Tint light colour'); }
  };
  const axPgTog = (pg) => {   // ax_pgtog (JSFX:4024): the page's button again = its effect on / off
    if (pg === 2 && isA) {
      const b = s.blend | 0;
      if (b >= 9) { sh.axTrl = b; blendTo(sh.blKeep); } else blendTo(sh.axTrl >= 9 ? sh.axTrl : 9);
      msg(`transition: ${(s.blend | 0) >= 9 ? BLENDS[s.blend | 0] : 'none'}`);
    }
    if (((pg === 3 && isA) || (pg === 4 && !isA)) && cur('vfxType', 0) > 0) { vfxToggle(); msg(`${axDeck} video FX ${cur('vfxAmt', 0) > 0 ? 'on' : 'off'}`); }
    if (pg === 5 && isA) {
      const t0 = curM('mfxType', 0);
      if (t0 > 0) { sh.axMtl = t0; setM.mfxType = 0; } else setM.mfxType = sh.axMtl > 0 ? sh.axMtl : 1;
      msg(`master video FX: ${VFX_NM[setM.mfxType]}`);
    }
  };
  const axSel = cv[123] < 0 || (s.shared.sel >= 0 ? s.shared.sel === s.deck : s.deck === 0);   // apc_sel
  const apcAux = () => {
    const nt = st === 0x90 || st === 0x80, pg = sh.axPg;
    if (nt && ch === 0 && m2 === 98) sh.axSh = on ? 1 : 0;   // (SHIFT: not taken, the rest still reads it)
    if (nt && ch === 0 && m2 >= 82 && m2 <= 86) {
      if (isA) {   // (deck A decides; page 4's button again = deck B's turn: deck B reads the page before deck A's)
        sh.axPrev = pg;
        if (on && m2 > 82 && pg === m2 - 81) { if (m2 !== 85) axPgTog(m2 - 81); }
        else if (on) {
          sh.axPg = m2 - 81; s.ledGen++;
          msg(`APC40 page ${m2 - 81}: ${['pads', 'blends and transitions', 'deck A video FX', 'deck B video FX', 'master video FX'][m2 - 82]}`);
        }
      } else if (on && m2 === 85 && (aHere ? sh.axPrev : pg) === 4) axPgTog(4);
      return 1;
    }
    if (nt && ch === 0 && m2 <= 39 && pg > 1) {
      const i = axIdx(m2);
      if (on) {
        if (pg === 2 && isA) axPick2(i);
        if (((pg === 3 || pg === 5) && isA) || (pg === 4 && !isA)) {
          if (i <= 15) {
            if (pg === 5) { setM.mfxType = i === curM('mfxType', 0) ? 0 : i; msg(`master video FX: ${VFX_NM[setM.mfxType]}`); } else axPickD(i);
          } else if (sh.axSh) axLfPick(i); else msg('video FX LFO: hold SHIFT and press the pad');
        }
      }
      return 1;
    }
    if (nt && cv[182] >= 0 && m2 >= cv[182] && m2 < cv[182] + 8) {   // DEVICE buttons: the knobs' effects on / off
      if (on && axSel) {
        const i = m2 - cv[182]; s.axo[i] = s.axo[i] ? 0 : 1; touchSet();
        msg(`${axDeck} ${VFX_NM[FK_TY[i]]}: ${s.axo[i] ? 'off' : 'on'}`);
      }
      return 1;
    }
    if (nt && cv[183] >= 0 && m2 === cv[183] && ch <= 7) {   // CLIP STOP 1-8: those effects while held
      if (axSel) { s.axh[ch] = on ? 1 : 0; touchSet(); if (on) msg(`${axDeck} ${VFX_NM[FK_TY[ch]]} (held)`); }
      return 1;
    }
    if (st === 0xb0 && ch === 0 && m2 >= 48 && m2 <= 55 && pg > 1) {   // TRACK KNOBs on the pages 2-5 (the page's owner deck)
      if (pg === 4 ? !isA : isA) axKnob(pg, m2 - 48, m3 / 127);
      return 1;
    }
    if (nt && ch === 0 && (m2 === 80 || m2 === 102)) {   // MASTER held = both decks, SHIFT + MASTER = the blackout; SESSION
      if (m2 === 80 && isA && !(on && s.hcSh)) sh.both = on ? 1 : 0;
      if (on && isA) {
        if (m2 === 80) { if (s.hcSh) { setM.blackout = curM('blackout', 0) ? 0 : 1; msg(setM.blackout ? 'blackout' : 'blackout off'); } }
        else out.push({ t: 'files' });   // (SESSION: REAPER saves the project; here the file list shows / hides, ⚪205)
      }
      return 1;
    }
    if (nt && ch === 0 && (m2 === 93 || m2 === 90 || m2 === 81)) {   // RECORD, METRONOME, STOP ALL CLIPS
      if (on && isA && m2 === 93) out.push({ t: 'rec' });   // (RECORD: REAPER records; here the take, takerec.js, ⚪205)
      if (on && isA && m2 === 81) for (const d of [0, 1]) { const x = dSt(d); if (x && x.e && x.e.playing) callD(d, 'playBtn'); }
      if (on && m2 === 90 && (isA || ((dSt(0) || {}).p || {}).mtMode === 2)) out.push({ t: 'ret', f: 'mtToggle' });   // (mt_toggle)
      return 1;
    }
    if (st === 0xb0 && ch === 0 && m2 === 15) {   // the crossfader: the FX boost (the main controller's crossfader mixes)
      if (isA) { setM.boost = m3 / 127; msg(`FX boost ${pct(m3 / 127)} %`); }
      return 1;
    }
    if (st === 0xb0 && ch === 0 && (m2 === 48 || m2 === 52) && !s.kpEff && pg === 1) {
      // TRACK KNOB 1 / 5: the sound of deck A's / B's video FX (the type's own, gmem [150 + type], in the JSFX; the web
      // version has the deck's video FX sound)
      if (isA) {
        const d = m2 === 48 ? 0 : 1, ty = d === 0 ? cur('vfxType', 0) : (((dSt(1) || {}).p || {}).vfxType || 0);
        if (ty > 0) { setD(d, { fxSound: m3 / 127 }); msg(`deck ${d ? 'B' : 'A'}: video FX sound ${pct(m3 / 127)} %`); }
        else msg(`deck ${d ? 'B' : 'A'}: no video FX chosen`);
      }
      return 1;
    }
    if (st === 0xb0 && ch === 0 && cv[88] >= 0 && m2 === cv[88]) {   // the master fader: the whole level (sound and picture)
      if (isA) {
        const k = m3 / 127, v = 1 - curM('level', 0);
        if (pku(s.apkM, v, k)) { setM.level = 1 - k; msg(`master level ${pct(k)} %`); } else msg(`master fader ${pct(k)} %: move it to ${pct(v)} % to pick up`);
      }
      return 1;
    }
    if (st === 0xb0 && cv[210] >= 0 && ch * 128 + m2 === cv[210]) {   // track fader 1 / 5: the deck's picture (Video opacity)
      const k = m3 / 127, fk = isA ? 'fadeA' : 'fadeB', v = 1 - curM(fk, 0);
      if (pku(s.apkS, v, k)) { setM[fk] = 1 - k; msg(`${axDeck} picture ${pct(k)} %`); } else msg(`sound fader ${pct(k)} %: move it to ${pct(v)} % to pick up`);
      return 1;
    }
    return 0;
  };
  if (aux.ax && cv[135] === 1 && m1 < 0xf0 && apcAux()) return fin();

  // ---- the deck channel (JSFX:4616-4724) ----
  if (ch === cv[6] - 1) {
    out.push({ t: 'lamp' });
    if (!autoTouch && on && m2 === cv[12]) { s.touched = 1; call('setTouch', 1); }
    else if (!autoTouch && off && m2 === cv[12]) { s.touched = 0; call('setTouch', 0); }
    const sel = cv[123] < 0 || (s.shared.sel >= 0 ? s.shared.sel === s.deck : s.deck === 0);   // apc_sel (JSFX:3424)
    // SHIFT + PLAY with a SHIFT note: both decks together (either playing = both stop, else both play) (JSFX:4622-4630)
    // the APC40's MASTER held (CV215, apc_both JSFX:3429): PLAY, CUE and SYNC on both decks (deck A asks both to play / stop)
    // (apc_both: with the helper APC40 the main controller's too, aux.cx; its CUE / SYNC go to the other deck as well, gmem
    // [263]-[268], JSFX:4631-4640 / 5192)
    const both = (cv[215] >= 0 || !!aux.cx) && sh.both, hand = cv[123] < 0 && both;
    // (SHIFT + PLAY: deck A asks for both when both decks hear it, as the JSFX's; a deck read alone asks itself)
    if (on && m2 === cv[15]) {
      if ((cv[181] >= 0 && s.hcSh) || both) { if (cv[123] < 0 ? sel : s.deck === 0 || !aHere) out.push({ t: 'both' }); }
      else if (sel) call(s.hcSh ? 'cueBack' : 'playBtn');
    }
    if ((sel || both) && on && m2 === cv[16]) { call('cuePress'); if (hand) callD(od, 'cuePress'); }
    if ((sel || both) && off && m2 === cv[16]) { call('cueRelease'); if (hand) callD(od, 'cueRelease'); }
    if (sel && cv[17] > 0 && on && m2 === cv[17]) { s.touched = 0; call('setTouch', 0); }   // release button (hold mode)
    // tempo fader: MSB alone = 7-bit; the LSB right after (CC+32, or CC+54 10-bit) refines it; 128 = pitch bend
    if (cv[92] >= 0 && st === 0xb0 && m2 === cv[92]) { s.teMsb = m3; if (!cv[100]) teIn(m3 << 7); }
    const lsbOk = s.teLw > 0 && now - s.teLw < 50 && st === 0xb0;
    if (cv[92] >= 0 && !cv[100] && cv[92] < 96 && lsbOk && m2 === cv[92] + 32) teIn((s.teMsb << 7) | m3);
    if (cv[92] >= 0 && cv[100] && cv[92] < 74 && lsbOk && m2 === cv[92] + 54) teIn(Math.min(16383, ((s.teMsb << 7) | m3) * 16383 / 1023));
    if (cv[92] === 128 && st === 0xe0) teIn((m3 << 7) | m2);
    if ((sel || both) && cv[93] > 0 && on && m2 === cv[93]) { out.push({ t: 'sync' }); if (hand) out.push({ t: 'deck', d: od, a: { t: 'syncTo', from: s.deck } }); }
    if (sel && on && (cv[101] < 0 ? cv[93] > 0 && m2 === cv[93] + 8 : cv[101] > 0 && m2 === cv[101])) {
      out.push({ t: 'range' }); s.teTk = 1; s.teMlast = -1000;
    }
    if (cv[102] >= 0 && m2 === cv[102] && note) s.pdmHold = on ? 1 : 0;   // pad mode button held (Buddy)
    if (cv[181] >= 0 && m2 === cv[181] && note) s.hcSh = on ? 1 : 0;      // SHIFT held
    if (sel) {   // the CDJ's buttons (JSFX:4672-4676)
      if (cv[237] >= 0 && on && m2 === cv[237]) out.push({ t: 'toggle', k: 'slip' });
      if (cv[238] >= 0 && on && m2 === cv[238]) out.push({ t: 'toggle', k: 'quant' });
      if (cv[239] >= 0 && on && m2 === cv[239]) { s.cdjRev = s.cdjRev ? 0 : 1; call('rev', s.cdjRev, -1); }
      if (cv[240] >= 0 && note && m2 === cv[240]) { s.cdjRev = 0; call('rev', on ? 1 : 0, -1); }
      // TRACK SEARCH / UP DOWN = the slot after / before with a file (sm_step JSFX:3591), RELOOP/EXIT, TOUCH/BRAKE and
      // RELEASE/START = the brake / start times (0-3 s) (JSFX:4676-4682). (NEEDLE SEARCH, CV244, a jump to a place of the
      // sample: left out, the engine has no jump to a fraction)
      const smStep = (d) => {
        const sl = E.slots || [];
        let k = (E.cur | 0) + d;
        while (k >= 0 && k < 8 && !sl[k]) k += d;
        if (k >= 0 && k < 8) call('switchSlot', k);
      };
      if (cv[241] >= 0 && on && (m2 === cv[241] || m2 === cv[241] + 1)) smStep(m2 === cv[241] ? 1 : -1);
      if (cv[192] >= 0 && on && (m2 === cv[192] || m2 === cv[192] + 1)) smStep(m2 === cv[192] ? -1 : 1);
      if (cv[245] >= 0 && on && m2 === cv[245]) call(E.bl ? 'blOff' : 'blReloop');
      if (cv[242] >= 0 && st === 0xb0 && m2 === cv[242]) setP.brake = Math.floor(m3 / 127 * 300 + 0.5) / 100;
      if (cv[243] >= 0 && st === 0xb0 && m2 === cv[243]) setP.startT = Math.floor(m3 / 127 * 300 + 0.5) / 100;
      // APC40 (JSFX:4652-4672): the FX knobs (DEVICE 1-8: Tint .. Shift RGB, VHS; SHIFT + 8 = Strobe), the tempo encoder (0.05 %
      // a step, SYNC off), nudge held, tap tempo, loop half / double (SHIFT: the loop a beat back / on), the sample pads
      // scrolled (LEFT / RIGHT), auto loop 1 / 2 / 4 / 8 beats (SCENE LAUNCH 1-4; SHIFT: beat jumps), 5 = out of / back into the loop
      if (cv[208] >= 0 && st === 0xb0 && m2 >= cv[208] && m2 < cv[208] + 8) {
        const k = m2 - cv[208];
        if (k === 7 && s.hcSh) { s.strobe = m3 / 127; setP.strobeKnob = s.strobe; } else s.fxk[k] = m3 / 127;
        touchSet();
      }
      if (cv[124] >= 0 && st === 0xb0 && m2 === cv[124]) {
        const v = Math.max(-range, Math.min(range, s.tempo + apcRel(m3) * 0.05));
        s.tempo = v; out.push({ t: 'tempo', v });
      }
      if (cv[125] >= 0 && m2 === cv[125] && note) { s.nm = on ? 1 : 0; out.push({ t: 'field', k: 'nudgeDir', v: s.nm ? -1 : s.np ? 1 : 0 }); }
      if (cv[126] >= 0 && m2 === cv[126] && note) { s.np = on ? 1 : 0; out.push({ t: 'field', k: 'nudgeDir', v: s.np ? 1 : s.nm ? -1 : 0 }); }
      if (cv[127] >= 0 && on && m2 === cv[127]) out.push({ t: 'tap' });
      if (cv[128] >= 0 && on && m2 === cv[128] && E.playing) call('playBtn');
      if (cv[129] >= 0 && on && m2 >= cv[129] && m2 < cv[129] + 4) call('switchSlot', 4 + m2 - cv[129]);
      if (cv[184] >= 0 && on && m2 === cv[184]) call(s.hcSh ? 'blMove' : 'blSize', -1);
      if (cv[185] >= 0 && on && m2 === cv[185]) call(s.hcSh ? 'blMove' : 'blSize', 1);
      if (cv[211] >= 0 && on && m2 === cv[211]) { s.smOff = Math.max(0, s.smOff - 1); s.ledGen++; }
      if (cv[212] >= 0 && on && m2 === cv[212]) { s.smOff = Math.min(8 - Math.min(8, cv[121]), s.smOff + 1); s.ledGen++; }
      if (cv[213] >= 0 && on && m2 >= cv[213] && m2 < cv[213] + 4) {
        const i = m2 - cv[213];
        if (s.hcSh) call('blJump', [-4, -1, 1, 4][i]); else call('blAuto', 2 ** i);
      }
      if (cv[213] >= 0 && on && m2 === cv[213] + 4) call(E.bl && !E.blRoll ? 'blOff' : 'blReloop');
    }
    // the jog (JSFX:4695-4718), by its mode CV8
    if (st === 0xb0 && m2 === cv[7] && !s.kpEff) {   // (on the knob pages 2 / 3 the jog knob is another knob)
      const mode = cv[8];
      if (mode === 5) {
        call('jogSpeed', s.touched || autoTouch ? cdjSpeed(m3, 0.06) : 0);
        if (autoTouch) s.touched = 1;
      } else if (mode === 3) { touchNow(); call('seekAbs', m3 / 127); }
      else if (mode === 4) { s.absMsb = m3; touchNow(); call('seekAbs', ((m3 << 7) | s.absLsb) / 16383); }
      else if (mode === 6) s.dnMsb = m3;   // the LSB at CC+22 moves it
      else if (mode === 7) {   // an absolute knob turned (APC40 TRACK KNOB): the change; sent back to 64 near the ends
        if (s.jkLast >= 0 && Math.abs(m3 - s.jkLast) < 24) jog(m3 - s.jkLast);
        else touchNow();
        s.jkLast = m3;
        if (m3 < 20 || m3 > 107) { out.push({ t: 'out', bytes: [0xb0 | (cv[6] - 1), cv[7], 64] }); s.jkLast = 64; }
      } else jog(relTicks(m3));
    }
    if (cv[8] === 6 && st === 0xb0 && m2 === cv[7] + 22) {   // Denon platter position (dn_ticks, JSFX:2384)
      const p = (s.dnMsb << 7) | m3;
      let d = s.dnHave ? p - s.dnPrev : 0;
      if (d > 8192) d -= 16384; else if (d < -8192) d += 16384;
      s.dnPrev = p; s.dnHave = 1;
      jog(d);
    }
    if (cv[8] === 4 && st === 0xb0 && m2 === cv[7] + 32) { s.absLsb = m3; touchNow(); call('seekAbs', ((s.absMsb << 7) | m3) / 16383); }
    if (cv[228] >= 0 && st === 0xb0 && m2 === cv[228]) call('jumpBy', relTicks(m3) * 0.05);   // SHIFT + jog: big jumps (s)
    // NEEDLE SEARCH (CV244, CDJ 0x1C; JSFX:4680): while stopped, 1 .. 127 = the place in the sample
    if (cv[244] >= 0 && st === 0xb0 && m2 === cv[244] && m3 > 0 && !E.playing) call('needle', (m3 - 1) / 126);
    if (cv[14] > 0 && st === 0xb0 && m2 === cv[14] && cv[8] === 5) call('jogRing', cdjSpeed(m3, 0.5));
    if (cv[14] > 0 && st === 0xb0 && m2 === cv[14] && cv[8] < 3) call('jogFine', relTicks(m3) * 0.25);   // fine ring
    // the headphones' cue mix encoder (APC40 CUE LEVEL, relative; JSFX:4692)
    if (cv[130] >= 0 && st === 0xb0 && m2 === cv[130]) cueMixBy(apcRel(m3) / 100);
    // the loop knob's move / reloop on the deck channel (CV147 / CV148 below 128; Buddy SHIFT side CC 33 / note 34), SHIFT +
    // PLAY's own note = both decks play / stop (CV149, Buddy; JSFX:4894-4900)
    if (cv[147] >= 0 && cv[147] < 128 && st === 0xb0 && m2 === cv[147] && knobRel(cv, m3) !== 0) call('blMove', knobRel(cv, m3) > 0 ? 1 : -1);
    if (cv[148] >= 0 && cv[148] < 128 && on && m2 === cv[148]) call('blReloop');
    if (cv[149] >= 0 && on && m2 === cv[149]) out.push({ t: 'both' });
    s.teLw = cv[92] >= 0 && st === 0xb0 && m2 === cv[92] ? now : -1;
  }

  // ---- crossfader: its own channel (JSFX:4726-4731) ----
  if (st === 0xb0 && ch === cv[34] - 1) {
    const end = Math.max(64, cv[178]);
    if (m2 === cv[35]) { s.xfMsb = m3; out.push({ t: 'xf', v: Math.min(1, m3 / end) }); }
    else if (cv[35] < 96 && m2 === cv[35] + 32 && s.xfLw > 0 && now - s.xfLw < 50) out.push({ t: 'xf', v: Math.min(1, ((s.xfMsb << 7) | m3) / (end * 128 + 127)) });
    s.xfLw = m2 === cv[35] ? now : -1;
  }

  // ---- the mixer channel (JSFX:4737-4766): volume fader, filter knobs, the headphone cue (each press on / off: the
  // engine's pfl), deck select, freeze, crossfader side, the mute (ACTIVATOR CV191: sound and picture, with SHIFT the
  // picture only; the Buddy's SHIFT + CUE CV229: the picture only; JSFX:4751-4752) ----
  if (ch === (cv[122] > 0 ? cv[122] : cv[6]) - 1) {
    if (cv[106] >= 0 && st === 0xb0 && m2 === cv[106]) out.push({ t: 'vol', v: m3 / 127 });
    if (!cv[186] && st === 0xb0 && !(cv[235] > 0 && m2 === cv[157])) { if (cv[226] >= 0 && s.fkSh) fltSh(m2, m3); else fltPk(m2, m3); }
    if (cv[191] >= 0 && on && m2 === cv[191]) { const k = s.hcSh ? 'vmute' : 'mute'; out.push({ t: 'toggle', k }); msg(`deck ${s.deck ? 'B' : 'A'} ${k === 'mute' ? '' : 'picture '}${cur(k, 0) ? 'on' : 'muted'}`); }
    if (cv[229] >= 0 && on && m2 === cv[229]) { out.push({ t: 'toggle', k: 'vmute' }); msg(`deck ${s.deck ? 'B' : 'A'} picture ${cur('vmute', 0) ? 'on' : 'muted'}`); }
    if (cv[117] >= 0 && on && m2 === cv[117]) { out.push({ t: 'toggle', k: 'pfl' }); msg(`deck ${s.deck ? 'B' : 'A'} headphone cue ${cur('pfl', 0) ? 'off' : 'on'}`); }
    if (cv[123] >= 0 && on && m2 === cv[123]) { s.shared.sel = s.deck; s.ledGen++; }
    // the freeze (APC40 CLIP STOP 1 / 5) while held; SHIFT = the video FX on / off
    if (cv[183] >= 0 && on && m2 === cv[183]) { if (s.hcSh) vfxToggle(); else call('revHold', 1, 0); }
    if (cv[183] >= 0 && off && m2 === cv[183]) call('revHold', 0, 0);
    if (cv[190] >= 0 && on && m2 === cv[190]) { const x = cur('xfSide', s.deck ? 2 : 1); setP.xfSide = x === 1 ? 2 : x === 2 ? 0 : 1; }   // A, B, off
  }
  // the cutoff knob on a channel of its own (CV235; DDJ-FLX4 CFX on ch 7, JSFX:4767)
  if (cv[235] > 0 && cv[157] >= 0 && st === 0xb0 && ch === cv[235] - 1 && m2 === cv[157]) { if (cv[226] >= 0 && s.fkSh) fltSh(m2, m3); else fltPk(m2, m3); }
  // the filter knobs on the deck channel (APC40 TRACK KNOBs 2-4 / 6-8 on ch 1, JSFX:4769), no pick-up; the knob pages 2 / 3
  if (cv[186] && !s.kpEff && st === 0xb0 && ch === cv[6] - 1) fltCc(m2, m3);
  if (cv[214] >= 0 && s.kpEff && st === 0xb0 && ch === cv[6] - 1 && m2 >= cv[7] && m2 < cv[7] + 4) {   // kp_set (JSFX:3609-3627)
    const k = m2 - cv[7], v = m3;
    if (s.kpEff === 1) {
      if (k === 0) setP.echoLen = Math.min(5, Math.floor(v * 6 / 128));
      else if (k === 1) setP.echoFb = v / 127 * 0.95;
      else if (k === 2) { if (s.hcSh) setP.vibWidth = Math.min(12, Math.floor(v * 13 / 128)); else setP.vibStep = Math.min(5, Math.floor(v * 6 / 128)); }
      else setP.gateStep = Math.min(4, Math.floor(v * 5 / 128));
    } else if (k === 0) out.push({ t: 'vol', v: v / 127 });
    else if (k === 2) setP.glenMs = Math.floor(10 + v / 127 * 190 + 0.5);
    else if (k === 3) setP.key = Math.abs(v - 64) <= 2 ? 0 : Math.max(-12, Math.min(12, Math.floor((v - 64) / 63 * 12 + (v > 64 ? 0.5 : -0.5))));
    else if (k === 1) setM[s.deck ? 'fadeB' : 'fadeA'] = 1 - v / 127;   // the picture's opacity (slider 195): app.mix fade
  }
  // the deck's faders (JSFX:4772-4778; APC40 TRACK FADER 2-4 / 6-8): echo, bitcrusher, vibrato; the sound of the video FX
  if (st === 0xb0) {
    const fdk = ch * 128 + m2;
    const fe = (i, k) => { s.feV[i] = m3 / 127; setP[k] = s.feOff[i] ? 0 : s.feV[i]; };   // (switched off: 0 until on again)
    if (cv[187] >= 0 && fdk === cv[187]) fe(0, 'echo');
    if (cv[188] >= 0 && fdk === cv[188]) fe(1, 'crush');
    if (cv[189] >= 0 && fdk === cv[189]) fe(2, 'vib');
    if (cv[210] >= 0 && fdk === cv[210]) setP.fxSound = m3 / 127;
  }
  // the faders' effects on / off (CV222: the freeze note on this channel and the next 2; APC40 CLIP STOP 2-4 / 6-8,
  // JSFX:4771): switched off, the fader's effect does nothing until switched on again (the fader's place is kept)
  if (cv[222] > 0 && cv[183] >= 0 && on && m2 === cv[183] && ch >= cv[222] - 1 && ch <= cv[222] + 1) {
    const i = ch - (cv[222] - 1), k = ['echo', 'crush', 'vib'][i];
    if (!s.feOff[i]) { s.feV[i] = cur(k, 0); s.feOff[i] = 1; setP[k] = 0; } else { s.feOff[i] = 0; setP[k] = s.feV[i]; }
    msg(`${['echo', 'bitcrusher', 'vibrato'][i]} ${s.feOff[i] ? 'off' : 'on'}`);
  }
  // the knob page (PAN / SENDS / USER), BANK held = every effect off, the video blend a step (METRONOME; deck A) (JSFX:4785-4797)
  if (cv[214] >= 0 && on && m2 >= cv[214] && m2 < cv[214] + 3) {
    s.kpPage = m2 - cv[214]; s.kpEff = s.kpPage; s.ledGen++;
    if (!s.kpPage && cv[8] === 7) { out.push({ t: 'out', bytes: [0xb0 | (cv[6] - 1), cv[7], 64] }); s.jkLast = 64; }
  }
  // every effect off while held: BANK (CV216, fx_kill) and this deck's (CV225, packed: Buddy SHIFT + FX ON, fx_kill_d;
  // JSFX:4782 / 4788); MASTER held = both decks (CV215, deck A's; JSFX:4781)
  if (cv[216] >= 0 && m2 === cv[216] && note) { s.killA = on ? 1 : 0; setP.kill = s.killA || s.killD ? 1 : 0; }
  if (cv[225] >= 0 && ch * 128 + m2 === cv[225] && note) { s.killD = on ? 1 : 0; setP.kill = s.killA || s.killD ? 1 : 0; }
  if (cv[215] >= 0 && s.deck === 0 && note && m2 === cv[215]) sh.both = on ? 1 : 0;
  if (cv[227] >= 0 && s.deck === 0 && on && m2 === cv[227]) {
    const v = ((s.blend | 0) + (s.hcSh ? 37 : 1)) % 38;
    out.push({ t: 'blend', v }); s.blend = v;
  }
  if (cv[226] >= 0 && ch * 128 + m2 === cv[226] && note) s.fkSh = on ? 1 : 0;   // the filter knobs' SHIFT (Buddy)

  // ---- pad modes by their own buttons (APC40 DEVICE 1-8, any channel, the selected deck; JSFX:4799-4807). HOT CUE while
  // in HOT CUE = CUE LOOP on / off; FILTER TYPE again = PATTERN ----
  const apcSel = cv[123] < 0 || (s.shared.sel >= 0 ? s.shared.sel === s.deck : s.deck === 0);
  if (cv[182] >= 0 && on && m2 >= cv[182] && m2 < cv[182] + 8 && apcSel) {
    const k = m2 - cv[182];
    if (k === 0 && s.pdm === 1) { out.push({ t: 'toggle', k: 'cueLoop' }); msg(pdmName(cv, 1, cur('cueLoop', 0) ? 0 : 1)); }
    else newMode(pdmTg(s, pdmBtn(k)));
  }
  // ---- the modes the unit switches itself (CV234: DDJ, Hercules, Reloop, Numark, Denon; JSFX:4813-4830). A mode button
  // picks its mode (with CV247 / CV258: at its release); a pad of a mode's notes picks it too and is read as the hot cue
  // pad's note (the SHIFT side's), so the modes below work as the Buddy's. The samples' pads (mode 2) stay as they are ----
  let pbNew = 0;
  const pbAct = (md) => { if (md === 1 && s.pdm === 1) out.push({ t: 'toggle', k: 'cueLoop' }); else if (md === 10 && (s.pdm === 10 || s.pdm === 13)) pbNew = pdmTg(s, 10); else if (md !== s.pdm) pbNew = md; };
  if (cv[234] > 0 && note) {
    const g0 = pbGet(cv, 0), chOk = ch === (g0.bc ? cv[46] : cv[6]) - 1;
    if (on && chOk) {
      for (let i = 0; i < 8; i++) {
        const g = pbGet(cv, i);
        if (m2 !== g.bn && m2 !== g.b2) continue;
        if (cv[247]) { s.pdmHold = 1; sh.pbUsed = 0; s.pbHbn = m2; s.pbHmd = g.md; } else if (cv[258]) { s.pvHold = 1; s.pbHbn = m2; s.pbHmd = g.md; } else pbAct(g.md);
      }
    }
    if (off && chOk && s.pbHbn >= 0 && m2 === s.pbHbn) {
      if (cv[247]) s.pdmHold = 0; else s.pvHold = 0;
      s.pbHbn = -1;
      if (!(cv[247] && sh.pbUsed)) pbAct(s.pbHmd);   // (with slider 247: only when nothing was done while held, gmem [254])
    }
    const f = pbFind(cv, ch, m2);
    if (f && f.md > 0) {
      if (on && f.md !== s.pdm && !(f.md === 10 && s.pdm === 13)) pbNew = f.md;
      if (f.md !== 2) m2 = cv[47] + (f.sh ? cv[105] : 0) + f.k;
    }
  }
  if (pbNew) newMode(pbNew);
  // ---- pad modes (Buddy): with the mode button held a note on the pad channel picks the mode and does nothing else
  // (JSFX:4832-4840): HOT CUE (again = CUE LOOP), FILTER TYPE (again = PATTERN), AUTO LOOP, TOUCH FX, SLICER, BOUNCE LOOP,
  // PITCH PLAY, VIDEO FX, NEURAL MIX; another pad = off ----
  const pdmPick = cv[102] >= 0 && s.pdmHold && on && cv[46] > 0 && ch === cv[46] - 1;
  if (pdmPick) {
    if (s.pdm === 1 && m2 === cv[103]) { const v = cur('cueLoop', 0) ? 0 : 1; out.push({ t: 'toggle', k: 'cueLoop' }); msg(pdmName(cv, 1, v)); }
    else {
      newMode(pdmTg(s, m2 === cv[103] ? 1 : m2 === cv[104] ? 10 : m2 === cv[138] ? 4 : m2 === cv[139] ? 5 : m2 === cv[140] ? 6
        : m2 === cv[141] ? 7 : m2 === cv[142] ? 12 : m2 === cv[143] ? 9 : m2 === cv[158] ? 8 : 3));
    }
  }
  const pdmOk = !pdmPick && !(cv[102] >= 0 && s.pdmHold);

  // ---- hot cue pads (HOT CUE mode, or no modes; JSFX:4841-4844): note on = press (SHIFT held: clear), off = release;
  // the SHIFT row clears ----
  if (pdmOk && (!pdmOn(cv) || s.pdm === 1) && note) {
    const k = hcPk(cv, ch, m2);
    if (k >= 0) {
      const n = hcPadn(cv, k) - 1;
      if (on) call(s.hcSh ? 'hcDelete' : 'hcPress', n); else call('hcRelease', n);
    }
    if (on) {
      const k2 = apcPad(cv, cv[48], cv[47] + cv[105], cv[120], ch, m2);   // SHIFT + pad: clear
      if (k2 >= 0) call('hcDelete', hcPadn(cv, k2) - 1);
    }
  }
  // ---- the other pad modes on the hot cue pads' notes (JSFX:4846-4876) ----
  const pmShift = (k, dn) => {   // pm_shift (JSFX:3773-3778): AUTO LOOP = a roll while held, TOUCH FX row 2, SLICER = the slice looped, PITCH PLAY = the filter type
    if (s.pdm === 4) { if (dn) call('blHold', 2 ** (k - 3), k); else call('blLetGo', k); }
    else if (s.pdm === 5) { tfTap(s.tfb, k, dn, now2); touchSet(); if (dn) msg(`TOUCH FX 2: ${TFB_NM[k]}${s.tfb.keep[k] ? ' (kept on)' : ''}`); }
    else if (s.pdm === 6) { if (dn) call('sliceRoll', k); else call('blLetGo', k); }
    else if (s.pdm === 12) { if (dn) setP.fltType = mgPad(k); }
  };
  if (pdmOk && pdmOn(cv) && s.pdm >= 4 && note) {
    const k = hcPk(cv, ch, m2);
    if (k >= 0) {
      const dn = on;
      let sl;
      if (dn) { sl = s.hcSh; s.pmShm = (s.pmShm | (1 << k)) - (sl ? 0 : 1 << k); } else sl = (s.pmShm >> k) & 1;
      const m = s.pdm;
      if (sl && ((m >= 4 && m <= 6) || m === 12)) pmShift(k, dn);
      else if (m === 4) { if (dn) call('blAuto', 2 ** (k - 3)); }   // AUTO LOOP 1/8 .. 16 beats
      else if (m === 5) { tfTap(s.tf, k, dn, now2); touchSet(); if (dn) msg(`TOUCH FX: ${TF_NM[k]}${s.tf.keep[k] ? ' (kept on)' : ''}`); }
      else if (m === 6) call('slicePad', k, dn ? 1 : 0);
      else if (m === 7) { if (dn) call('blHold', blBnc(k), k); else call('blLetGo', k); }   // BOUNCE LOOP
      else if (m === 8 && cv[182] >= 0) {   // APC40: the video blend Add .. Chroma key (the one in use again = Mix)
        if (dn) { const v = (s.blend | 0) === k + 1 ? 0 : k + 1; out.push({ t: 'blend', v }); s.blend = v; }
      } else if (m === 8) {   // NEURAL MIX: MEMORY, CALL back, CALL next, DELETE; held moves
        if (k < 4) { if (dn) { if (k === 0) call('mcAdd'); else if (k === 1) call('mcCall', -1); else if (k === 2) call('mcCall', 1); else call('mcDelete'); } }
        else call('mvHold', k - 4, dn ? 1 : 0);
      } else if (m === 9) {   // VIDEO FX: pads 1-8 = the FX kept on; the lit one again = off
        if (dn) {
          const ty = vfxPad(k), a = cur('vfxAmt', 0);
          if (a > 0 && cur('vfxType', 0) === ty) { s.vfxkAmt = a; setP.vfxAmt = 0; } else { setP.vfxType = ty; setP.vfxAmt = s.vfxkAmt > 0 ? s.vfxkAmt : 1; }
        }
      } else if (m === 12) {   // PITCH PLAY: hot cue 1 at the pad's key (the key stays)
        if (dn) { const semi = ppSemi(k); call('ppPress', semi); msg(`key ${semi > 0 ? '+' : ''}${semi}`); } else call('hcRelease', 0);
      } else if (m === 10) { if (dn) setP.fltType = mgPad(k); }   // FILTER TYPE: the 8 filters
      else if (m === 13) call('patPad', k, dn ? 1 : 0);   // PATTERN: pad k plays pattern k (pt_press, JSFX:4872)
    }
  }
  // AUTO LOOP / TOUCH FX / SLICER / PITCH PLAY with SHIFT: the pads' SHIFT notes (Buddy, JSFX:4878-4880)
  if (pdmOk && (cv[102] >= 0 || cv[234] > 0) && ((s.pdm >= 4 && s.pdm <= 6) || s.pdm === 12) && note) {
    const k = apcPad(cv, cv[48], cv[47] + cv[105], cv[120], ch, m2);
    if (k >= 0) pmShift(k, on);
  }
  // NEURAL MIX with SHIFT: pads 5-8 = the held moves ending at rest (JSFX:4883-4889)
  if (pdmOk && (cv[102] >= 0 || cv[234] > 0) && s.pdm === 8 && note) {
    const k = apcPad(cv, cv[48], cv[47] + cv[105], cv[120], ch, m2);
    if (k >= 4) call('mvStop', k - 4, on ? 1 : 0);
  }
  // ---- the loop knob (CV144 its channel; JSFX:4887-4894): turn = the loop half / double (CV145), push = loop on / off
  // (CV146); 128 + the number = the loop move / reloop on this channel (CV147 / CV148; else on the deck channel, above) ----
  if (cv[144] > 0 && ch === cv[144] - 1) {
    const kr = knobRel(cv, m3);
    if (cv[145] >= 0 && st === 0xb0 && m2 === cv[145] && kr !== 0) call('blSize', kr > 0 ? 1 : -1);
    if (cv[146] >= 0 && on && m2 === cv[146]) call('blToggle');
    if (cv[147] >= 128 && st === 0xb0 && m2 === cv[147] - 128 && kr !== 0) call('blMove', kr > 0 ? 1 : -1);
    if (cv[148] >= 128 && on && m2 === cv[148] - 128) call('blReloop');
  }
  // ---- the video FX channel (slider 84; JSFX:4902-4915): this deck's FX knob (slider 85; CV131 = 0..127, else the distance
  // from the centre), the master's amount (CV88), the FX knob (CV163; its SHIFT side CV164): run by deck A, or by deck B for
  // a channel deck A does not hear (with slider 247) ----
  if (st === 0xb0 && vch > 0 && ch === vch - 1) {
    if (vcc >= 0 && m2 === vcc) setP.vfxAmt = cv[131] ? m3 / 127 : Math.min(1, Math.abs(m3 - 64) / 63);
    if (cv[88] >= 0 && m2 === cv[88]) setM.mfxAmt = m3 / 127;
    const run = s.deck === 0 || (cv[247] && (!aHere || sh.a.vch !== vch));
    if (run && cv[163] >= 0 && m2 === cv[163]) fxKnob(cv[164] < 0 && (s.hcSh || s.fkSh) ? 1 : 0, m3);
    if (run && cv[164] >= 0 && m2 === cv[164]) fxKnob(1, m3);
  }
  // ---- FX PARAM / BEAT < > (CV159 / CV160, packed; their SHIFT side CV161 / CV162; JSFX:4916-4943): the TOUCH FX pads'
  // amounts, the FX ON bar's type, else (slider 247) the transition / (else) this deck's amount; the mode button held = the
  // blend (+ SHIFT: the blend with transitions); SHIFT = the master's type (slider 247) / its amount ----
  // (let go: no repeat, JSFX:4916)
  if (off && s.deck === 0 && ((cv[159] >= 0 && ch * 128 + m2 === cv[159]) || (cv[160] >= 0 && ch * 128 + m2 === cv[160]))) sh.rp = null;
  if (on) {
    const vfk = ch * 128 + m2, isB = (n) => n >= 0 && vfk === n;
    let fbSh = !!cv[247] && cv[161] < 0 && !!(s.hcSh || s.fkSh) && (isB(cv[159]) || isB(cv[160]));
    const fbUp = fbSh ? vfk === cv[160] : vfk === cv[162];
    fbSh = fbSh || (cv[161] >= 0 && (vfk === cv[161] || vfk === cv[162]));
    const fw = fbFw(vfk), mixRun = s.deck === 0 || fw;
    const pd = !!(s.pdmHold || (dSt(1) && dSt(1).pdmHold));   // (pdm_hold || gmem [130]: deck B's)
    if (cv[247] && pd && !fbSh && (isB(cv[159]) || isB(cv[160]))) { if (mixRun) blStep(vfk === cv[160] ? 1 : -1); sh.pbUsed = 1; }
    else if (!fbSh && isB(cv[159])) tfStep(-0.1, fw);
    else if (!fbSh && isB(cv[160])) tfStep(0.1, fw);
    // the mode button + SHIFT + FX PARAM = the blend with the transitions on / off (bl_combo, fx_btn 4 JSFX:4294; off: a
    // transition brings in B as it is): app.mix.blendUnder (see fin)
    if (fbSh && cv[247] && pd) {
      if (mixRun) { sh.blCombo = sh.blCombo ? 0 : 1; msg(`blend with transitions: ${sh.blCombo ? 'on' : 'off'}`); }
      sh.pbUsed = 1;
    }
    else if (fbSh && cv[247]) { if (mixRun) mtStep(fbUp ? 1 : -1); }
    else if (s.deck === 0 && fbSh) { setM.mfxAmt = Math.max(0, Math.min(1, Math.round(curM('mfxAmt', 0) * 10) / 10 + (fbUp ? 0.1 : -0.1))); msg(`master video FX ${pct(setM.mfxAmt)} %`); }
  }
  // ---- the browser section (CV165 its channel; JSFX:4949-5005): the BROWSE knob (CV166) = the video FX sound of the deck
  // it works (5 % a click); with the Buddy's FX section (CV247) the key knob (CV248) = the headphones' cue mix (a TOUCH FX
  // pad or an FX ON bar held: the type's own sound, not in the web version), else with its push held the key threshold;
  // SHIFT (CV168): its push held = the key softness, an FX ON bar on = that deck's video FX sound, else the cue mix; the
  // pushes (CV167 / CV169) = the deck the knob works (with the key knob: at the release, if not turned). LOAD (CV170 /
  // CV171, REAPER's Media Explorer): left out ----
  if (cv[165] > 0 && ch === cv[165] - 1) {
    const bsMe = (cv[165] === cv[6] && cv[167] < 0) || (s.shared.sel === 1 ? 1 : 0) === s.deck, kr = knobRel(cv, m3);
    const selOther = () => { s.shared.sel = s.shared.sel === 1 ? 0 : 1; s.ledGen++; msg(`browse knob: deck ${s.shared.sel ? 'B' : 'A'}`); };
    const A = dSt(0), B = dSt(1), barA = !!(A && A.vfxBar), barB = !!(B && B.vfxBar);
    const fxsTurn = () => msg('video FX sound by its type: not in the web version');   // (fxs_turn, JSFX:3833)
    // (⚪205) the file list open (main.js files): the browse knob (or the key knob) moves its choice, its push loads it
    if (s.files && st === 0xb0 && kr !== 0 && isA && ((cv[166] >= 0 && m2 === cv[166]) || (cv[248] >= 0 && m2 === cv[248]))) { out.push({ t: 'browse', v: kr }); return out; }
    if (s.files && on && isA && cv[167] >= 0 && m2 === cv[167]) { out.push({ t: 'deck', d: s.shared.sel === 1 ? 1 : 0, a: { t: 'load', replace: 0 } }); return out; }
    if (on && ((cv[170] >= 0 && m2 === cv[170]) || (cv[171] >= 0 && m2 === cv[171]))) out.push(s.pvHold && cv[258] ? { t: 'preview' } : { t: 'load', replace: m2 === cv[171] ? 1 : 0 });
    if (st === 0xb0 && kr !== 0) {
      if (bsMe && cv[166] >= 0 && m2 === cv[166]) {
        setP.fxSound = clamp01(Math.round(cur('fxSound', 1) * 20) / 20 + kr * 0.05);
        msg(`deck ${s.deck ? 'B' : 'A'}: video FX sound ${pct(setP.fxSound)} %`);
      }
      if (isA && cv[248] >= 0 && m2 === cv[248]) {
        if (cv[247] && ((tfFlags(A) & 2) || (tfFlags(B) & 2) || barA || barB)) fxsTurn();
        else if (cv[247]) cueMixBy(kr / 100);
        else if (s.bsPush) {
          setM.keyThresh = clamp01(Math.round(curM('keyThresh', 0.3) * 50) / 50 + kr * 0.02); s.bsTurn = 1;
          msg(`key threshold ${pct(setM.keyThresh)} %`);
        } else fxsTurn();
      }
      if (isA && cv[168] >= 0 && m2 === cv[168]) {
        if (s.bsPsh && !cv[247]) {
          setM.keySoft = clamp01(Math.round(curM('keySoft', 0.1) * 50) / 50 + kr * 0.02); s.bsTrn2 = 1;
          msg(`key softness ${pct(setM.keySoft)} %`);
        } else if (cv[247] && (barA || barB)) {
          const step = (d) => clamp01(Math.round((d === s.deck ? cur('fxSound', 1) : (((dSt(d) || {}).p || {}).fxSound ?? 1)) * 20) / 20 + kr * 0.05);
          const vA = barA ? step(0) : -1, vB = barB ? step(1) : -1;
          if (barA) setD(0, { fxSound: vA }); if (barB) setD(1, { fxSound: vB });
          msg(`${barA && barB ? 'decks A and B:' : barA ? 'deck A:' : 'deck B:'} video FX sound (all) ${pct(barA ? vA : vB)} %`);
        } else if (cv[247]) fxsTurn();
        else cueMixBy(kr / 100);
      }
    }
    if (on && isA) {
      if (cv[167] >= 0 && m2 === cv[167]) { if (cv[248] >= 0) { s.bsPush = 1; s.bsTurn = 0; } else selOther(); }
      if (cv[169] >= 0 && m2 === cv[169]) { if (cv[248] >= 0) { s.bsPsh = 1; s.bsTrn2 = 0; } else selOther(); }
    }
    if (off && isA && s.bsPush && m2 === cv[167]) { s.bsPush = 0; if (!s.bsTurn && !cv[247]) selOther(); }
    if (off && isA && s.bsPsh && m2 === cv[169]) { s.bsPsh = 0; if (!s.bsTrn2 && !cv[247]) selOther(); }
  }
  // ---- METRONOME (CV259, packed; JSFX:5010): on / off, as the N key; with one switch for both decks deck B leaves deck A's
  // button to deck A ----
  // LOAD / PREVIEW on any channel (CV260 / CV261 / CV257, packed; the mode button held + LOAD = preview, CV258)
  if (on && cv[260] >= 0 && ch * 128 + m2 === cv[260]) out.push(s.pvHold && cv[258] ? { t: 'preview' } : { t: 'load', replace: 0 });
  if (on && cv[261] >= 0 && ch * 128 + m2 === cv[261]) out.push({ t: 'load', replace: 1 });
  if (on && cv[257] >= 0 && ch * 128 + m2 === cv[257]) out.push({ t: 'preview' });
  if (cv[259] >= 0 && on && ch * 128 + m2 === cv[259]) {
    const mode = ((dSt(0) || {}).p || {}).mtMode || 0;
    if (isA || mode === 2 || !aHere || sh.a.mt !== cv[259]) out.push({ t: 'ret', f: 'mtToggle' });
  }
  // ---- FX ON (CV107 on the video FX channel; JSFX:5021-5031): the Buddy's bar = on while its note is on; a DDJ's button =
  // on / off each press (with slider 247 the bar's state, which the FX knob and FX PARAM read) ----
  if (cv[107] >= 0 && note && vch > 0 && ch === vch - 1 && m2 === cv[107]) {
    const isOn = cur('vfxAmt', 0) > 0 && cur('vfxType', 0) > 0;
    const fxOn = () => { setP.vfxAmt = s.vfxkAmt > 0 ? s.vfxkAmt : 1; if (!cur('vfxType', 0)) setP.vfxType = 1; };
    const fxOff = () => { s.vfxkAmt = cur('vfxAmt', 0); setP.vfxAmt = 0; };
    if (cv[234] > 0 && cv[247]) { if (on) { s.vfxBar = s.vfxBar ? 0 : 1; if (s.vfxBar) fxOn(); else fxOff(); } }
    else if (cv[234] > 0) { if (on) { if (isOn) fxOff(); else fxOn(); } }
    else if (on) { if (!isOn) fxOn(); } else if (isOn) fxOff();
    if (!(cv[234] > 0)) s.vfxBar = on ? 1 : 0;
    msg(`deck ${s.deck ? 'B' : 'A'} video FX ${cur('vfxAmt', 0) > 0 ? 'on' : 'off'}`);
  }
  // ---- spinback, memory cues (JSFX:5043-5048) ----
  if (cv[61] > 0 && on && ch === cv[61] - 1 && m2 === cv[62]) call('spinback');
  if (on) {
    let k = apcPad(cv, cv[55], cv[56], 4, ch, m2);
    if (k >= 0) {
      if (cv[236] && (k === 1 || k === 2)) k = 3 - k;   // CDJ: CALL next before CALL back
      if (k === 0) call('mcAdd'); else if (k === 1) call('mcCall', -1); else if (k === 2) call('mcCall', 1); else call('mcDelete');
    }
  }
  // ---- the APC40's bottom row (JSFX:5034-5041): held = fast spinback, reverse, half speed, fast forward; with SHIFT = loop
  // on / off, SYNC, Q, SLIP ----
  if (note) {
    const k = apcPad(cv, cv[132], cv[133], 4, ch, m2);
    if (k >= 0) {
      if (on && s.hcSh) {
        if (k === 0) call('blToggle'); else if (k === 1) out.push({ t: 'sync' });
        else out.push({ t: 'toggle', k: k === 2 ? 'quant' : 'slip' });
      } else call('mvHold', k, on ? 1 : 0);
    }
  }
  // ---- the sample pads (JSFX:5056-5059; SHIFT + pad = LOAD into the slot is REAPER's Media Explorer: left out) ----
  if (pdmOk && on && !(cv[102] < 0 && s.hcSh && cv[211] >= 0) && ((cv[102] < 0 && !pbShared(cv)) || s.pdm === 2)) {
    const k = apcPad(cv, cv[73], cv[74], Math.min(8, cv[121]), ch, m2);
    if (k >= 0) call('switchSlot', cv[211] >= 0 ? Math.min(7, s.smOff + k) : k);
  }
  return fin();
}

// ---------- the lights (apc_led, JSFX:3870-3920 / 4121-4240) ----------
// light type CV135: 0 none, 1 APC40 mkII (RGB palette), 2 APC40 mkI (1 green, 3 red, 5 amber), 3 one colour (CV136 = on),
// 4 Reloop RGB (bit 6 bright, RR GG BB), 5 Mixon 4 (+64 dim), 6 Pioneer palette, 7 Inpulse 500, 8 Prime 4, 9 SC5000.
// Colour index ci: 1-8 the hot cues' colours (red, orange, green, violet, sky, pink, lime, copper), 10 white, 11 blue,
// 12 yellow, 13 magenta; dim = the darker shade where the type has one
const ltR = (ci) => ([1, 2, 6, 10, 12, 13].includes(ci) ? 3 : [4, 7, 8].includes(ci) ? 2 : 0);
const ltG = (ci) => ([3, 7, 10, 12].includes(ci) ? 3 : ci === 5 ? 2 : ci === 2 || ci === 8 ? 1 : 0);
const ltB = (ci) => ([4, 5, 10, 11, 13].includes(ci) ? 3 : ci === 6 ? 2 : 0);
const ltPal = (ci, t) => (ci >= 1 && ci <= 8 ? t[ci - 1] : ci === 10 ? t[8] : ci === 11 ? t[9] : ci === 12 ? t[10] : t[11]);
export function ltVal(ty, onV, ci, dim) {   // lt_val (JSFX:3885)
  const r = ltR(ci), g = ltG(ci), b = ltB(ci);
  return ty === 1 ? ltPal(ci, [5, 9, 21, 49, 37, 53, 17, 61, 3, 45, 13, 53]) + (dim ? (ci === 10 ? -2 : 2) : 0)
    : ty === 2 ? ltPal(ci, [3, 5, 1, 3, 1, 3, 1, 5, 5, 1, 5, 3])
      : ty === 3 ? onV
        : ty === 4 ? (dim ? 0 : 0x40) | (r << 4) | (g << 2) | b
          : ty === 5 ? r * 16 + g * 4 + b + (dim ? 64 : 0)
            : ty === 6 ? ltPal(ci, [41, 37, 21, 61, 9, 53, 25, 33, 127, 1, 29, 57])
              : ty === 7 ? (r << 5) | (Math.floor(g * 7 / 3 + 0.5) << 2) | b
                : ty === 8 ? (dim ? ((r >> 1) << 4) | ((g >> 1) << 2) | (b >> 1) : (r << 4) | (g << 2) | b)
                  : ty === 9 ? ltPal(ci, [1, 9, 33, 57, 13, 41, 25, 9, 45, 17, 25, 41]) : 0;
}
const ltDim = (ty) => ty === 1 || ty === 4 || ty === 5 || ty === 8;   // JSFX:3899
export const RING = 2048;   // a key from RING on = a knob's ring (CC), below = a light (note on): (channel 0-15) * 128 + number

// the lights deck s wants (a Map key -> value), from its preset pe, its state s (s.e = the engine's state, s.p = the deck's
// settings, s.blend). Only what the web version does is lit: the mute (ACTIVATOR), REAPER's metronome / record (CV193 /
// CV194, the helper's RECORD) and PREVIEW (CV257) are left dark
// aux = {ax: this unit is the helper APC40 (its pages, JSFX:4102-4120 / 4157 / 4246 / 4260-4263), now: ms (blinking)}
export function ledWant(pe, s, aux = {}) {
  const cv = pe.cv, ty = cv[135], L = new Map();
  if (!(ty > 0)) return L;
  const E = s.e || {}, P = s.p || {}, sh = shInit(s.shared), ax = !!aux.ax && ty === 1, axPg = sh.axPg || 1;
  const ld = (c, note, v) => { if (c >= 1 && c <= 16 && note >= 0 && note < 128) L.set((c - 1) * 128 + note, v | 0); };
  const rg = (c, cc, v) => { if (c >= 1 && c <= 16 && cc >= 0 && cc < 128) L.set(RING + (c - 1) * 128 + cc, Math.max(0, Math.min(127, Math.floor(v + 0.5)))); };
  const val = (ci, dim) => ltVal(ty, cv[136], ci, dim);
  const lst = (ci, dim) => (dim && !ltDim(ty) ? 0 : val(ci, dim));   // lt_st: a state shade (no darker shade: dark)
  const lon = ty === 1 || ty === 2 ? 1 : cv[136];
  const at = (c, note, k) => (cv[134] ? [c + k, note] : [c, note + k]);   // apc_at
  const sel = cv[123] < 0 || (s.shared.sel >= 0 ? s.shared.sel === s.deck : s.deck === 0);
  // (the helper's pages 2-5: the grid shows them, deck A draws it, no pad lights; pm -1)
  const pm = ax && axPg > 1 ? -1 : pdmOn(cv) ? s.pdm : 0;
  const hot = E.hot || [], blOn = !!E.bl, blRoll = !!E.blRoll, mcN = (E.mc || []).length, slots = E.slots || [], cur = E.cur | 0;
  const mvp = E.mvp ?? -1, rv = !!E.rev, rvF = E.rvF ?? 1;
  const mvLt = (k) => (k === 0 ? val(1, mvp !== 4) : k === 1 ? val(2, !(rv && rvF < 0) && mvp !== 5)   // mv_lt (JSFX:3902)
    : k === 2 ? val(12, !(rv && rvF > 0) && mvp !== 6) : val(11, mvp !== 7));
  const tfOn = (k) => s.tf.held[k] || s.tf.keep[k];
  // the other pad modes on the hot cue pads (JSFX:4157-4176); the SHIFT row dark
  if (pm >= 4) {
    const pbB = cv[234] > 0 ? pbBaseOf(cv, pm === 13 ? 10 : pm) : -1;
    const np = cv[180] && cv[120] <= 4 ? 2 * cv[120] : cv[120];
    for (let i = 0; i < np; i++) {
      let [c, n] = i < cv[120] ? at(cv[46], cv[47], i) : at(cv[46], cv[47] + cv[180], i - cv[120]);
      if (pbB >= 0) n = pbB + i;
      const semi = ppSemi(i);
      ld(c, n,
        pm === 4 ? (blOn && !blRoll && E.blBeats === 2 ** (i - 3) ? val(3, 0) : lst(3, 1))
          : pm === 5 ? lst(i === 0 ? 10 : i === 1 ? 7 : i === 2 ? 12 : i === 7 ? 8 : i, !tfOn(i))
            : pm === 6 ? val(5, 1)
              : pm === 7 ? (blRoll && E.blPad === i ? val(11, 0) : lst(11, 1))
                : pm === 8 && cv[182] >= 0 ? val(i + 1, (s.blend | 0) !== i + 1)
                  : pm === 8 ? (i === 0 ? val(10, 0) : i <= 2 ? (mcN ? val(2, 0) : 0) : i === 3 ? (mcN ? val(1, 1) : 0) : mvLt(i - 4))
                    : pm === 9 ? lst(vfxPad(i), !((P.vfxAmt || 0) > 0 && P.vfxType === vfxPad(i)))
                      : pm === 12 ? lst(semi === 0 ? 10 : semi > 0 ? 3 : 2, Math.abs((E.ppK ?? 1) - 2 ** (semi / 12)) > 0.0001)
                        // PATTERN (JSFX:4170): the pads with a pattern, the one playing (or asked) bright. The engine's state:
                        // patPads[i] (pad i has a pattern; all when not given), patK (the pad playing / asked, -1 none)
                        : pm === 13 ? (!E.patPads || E.patPads[i] ? lst(13, (E.patK ?? -1) !== i) : 0)
                          : pm === 10 ? lst(12, (P.fltType | 0) !== mgPad(i)) : 0);
      if (cv[48] > 0 && i < cv[120]) { let [c2, n2] = at(cv[48], cv[47] + cv[105], i); if (pbB >= 0) n2 = pbB + cv[105] + i; ld(c2, n2, 0); }
    }
  }
  // hot cues: their colour; the SHIFT row the dark shade; nothing where empty (HOT CUE mode or no modes; mode 3 = all dark)
  if (pm >= 0 && pm !== 2 && pm < 4) {
    for (let i = 0; i < cv[120]; i++) {
      const n = hcPadn(cv, i), has = pm !== 3 && hot[n - 1] >= 0;
      if (cv[46] > 0) ld(...at(cv[46], cv[47], i), has ? val(n, 0) : 0);
      if (cv[48] > 0) ld(...at(cv[48], cv[47] + cv[105], i), has ? val(n, 1) : 0);
      if (cv[46] > 0 && cv[180] && cv[120] <= 4) {   // the hot cues 5-8 row
        const n2 = hcPadn(cv, i + cv[120]);
        ld(...at(cv[46], cv[47] + cv[180], i), pm !== 3 && n2 <= 8 && hot[n2 - 1] >= 0 ? val(n2, 0) : 0);
      }
    }
  }
  // samples: the one in use green, the others with a file dim white (scrolled by sm_off)
  if (pm >= 0 && cv[73] > 0 && ((cv[102] < 0 && !pbShared(cv)) || pm === 2)) {
    for (let i = 0; i < Math.min(8, cv[121]); i++) {
      const n = cv[211] >= 0 ? Math.min(7, s.smOff + i) : i;
      ld(...at(cv[73], cv[74], i), n === cur ? val(3, 0) : slots[n] ? val(10, 1) : 0);
    }
  }
  if (cv[234] > 0) for (let i = 0; i < 8; i++) { const g = pbGet(cv, i); ld(g.bc ? cv[46] : cv[6], g.bn, g.md && g.md === s.pdm ? lon : 0); }   // the mode buttons
  if (cv[55] > 0 && pm >= 0) {   // memory cues: MEMORY always, CALL back / next and DELETE while there are some
    ld(...at(cv[55], cv[56], 0), val(10, 0));
    ld(...at(cv[55], cv[56], 1), mcN ? val(2, 0) : 0);
    ld(...at(cv[55], cv[56], 2), mcN ? val(2, 0) : 0);
    ld(...at(cv[55], cv[56], 3), mcN ? val(1, 1) : 0);
  }
  if (cv[132] > 0 && pm >= 0) {   // the bottom row: the held moves; while SHIFT is held loop / SYNC / Q / SLIP
    for (let i = 0; i < 4; i++) {
      ld(...at(cv[132], cv[133], i), !s.hcSh ? mvLt(i) : i === 0 ? val(3, !blOn) : i === 1 ? val(10, !E.sync) : i === 2 ? val(6, !P.quant) : val(11, !P.slip));
    }
  }
  const mx = cv[122] > 0 ? cv[122] : cv[6];   // the mixer channel
  if (cv[117] >= 0) ld(mx, cv[117], P.pfl ? lon : 0);   // the headphone cue (JSFX:4212)
  if (cv[191] >= 0) ld(mx, cv[191], P.mute ? 0 : lon);   // ACTIVATOR lit = sounding (JSFX:4221)
  if (cv[123] >= 0) ld(mx, cv[123], sel ? lon : 0);
  if (cv[183] >= 0 && !ax) ld(mx, cv[183], rv && rvF === 0 ? lon : 0);   // lit while frozen
  if (cv[222] > 0 && cv[183] >= 0 && !ax) {   // the faders' effects: lit = on and its fader up (JSFX:4215)
    ['echo', 'crush', 'vib'].forEach((k, i) => ld(cv[222] + i, cv[183], !(s.feOff && s.feOff[i]) && (P[k] || 0) > 0.001 ? lon : 0));
  }
  if (cv[190] >= 0) ld(mx, cv[190], P.xfSide ?? (s.deck ? 2 : 1));   // the crossfader side: 1 A yellow, 2 B orange (mkII)
  if (cv[259] >= 0) ld((cv[259] >> 7) + 1, cv[259] & 127, E.mtOn ? lon : 0);   // METRONOME lit while on (JSFX:4223)
  if (s.deck === 0) {   // deck A: the knob pages, BANK, the blend (METRONOME)
    if (cv[214] >= 0) for (let i = 0; i < 3; i++) ld(1, cv[214] + i, s.kpPage === i ? lon : 0);
    if (cv[215] >= 0 && !ax) ld(1, cv[215], s.shared.both ? lon : 0);   // MASTER: lit = both decks (JSFX:4232)
    if (cv[216] >= 0) ld(1, cv[216], s.killA ? lon : 0);
    if (cv[227] >= 0 && !ax) ld(1, cv[227], (s.blend | 0) > 0 ? lon : 0);
  }
  // the deck knobs' rings on the page in use (page 1's jog knob is left alone: it is sent back to 64; kp_ring JSFX:3648)
  if (cv[214] >= 0 && cv[8] === 7 && !(ax && axPg > 1)) {
    const ring = (k) => (s.kpEff === 0 ? (k === 1 ? 64 + (P.fltMorph || 0) * 126 : k === 2 ? (P.fltRes ?? 0.4) * 127 : k === 3 ? 64 + (P.fltCut || 0) * 63 : 64)
      : s.kpEff === 1 ? (k === 0 ? ((P.echoLen ?? 2) + 0.5) * 128 / 6 : k === 1 ? ((P.echoFb ?? -1) < 0 ? 0.5 : P.echoFb / 0.95) * 127
        : k === 2 ? (s.hcSh ? ((P.vibWidth ?? 5) + 0.5) * 128 / 13 : ((P.vibStep ?? 3) + 0.5) * 128 / 6) : (P.gateStep ?? -1) < 0 ? 64 : (P.gateStep + 0.5) * 128 / 5)
        : (k === 0 ? (P.vol ?? 1) ** 0.5 * 127 : k === 1 ? (1 - ((s.mix || {})[s.deck ? 'fadeB' : 'fadeA'] || 0)) * 127 : k === 2 ? ((P.glenMs ?? 50) - 10) / 190 * 127 : 64 + (P.key || 0) / 12 * 63));
    for (let i = s.kpEff ? 0 : 1; i < 4; i++) rg(cv[6], cv[7] + i, ring(i));
  }
  if (sel) {   // the (selected) deck's PLAY, CUE (lit while stopped), SYNC; mode buttons, FX knobs' rings, samples 5-8, scroll, auto loop
    ld(cv[6], cv[15], E.playing ? lon : 0);
    if (ty > 2) {
      if (cv[16] >= 0 && !ax) ld(cv[6], cv[16], E.playing ? 0 : lon);
      if (cv[93] > 0) ld(cv[6], cv[93], E.sync ? lon : 0);
    }
    if (cv[182] >= 0 && ax) {   // the helper: DEVICE lit = the knob's effect on, CLIP STOP lit while held (JSFX:4246)
      for (let i = 0; i < 8; i++) ld(1, cv[182] + i, s.axh[i] || (!s.axo[i] && s.fxk[i] > 0.05) ? lon : 0);
      if (cv[183] >= 0) for (let i = 0; i < 8; i++) ld(i + 1, cv[183], s.axh[i] ? lon : 0);
    } else if (cv[182] >= 0) for (let i = 0; i < 8; i++) ld(1, cv[182] + i, pdmBtn(i) === s.pdm ? lon : 0);
    if (cv[208] >= 0) for (let i = 0; i < 8; i++) rg(cv[6], cv[208] + i, (i === 7 && s.hcSh ? s.strobe : s.fxk[i]) * 127);
    if (cv[129] >= 0) for (let i = 0; i < 4; i++) ld(cv[6], cv[129] + i, 4 + i === cur ? val(3, 0) : slots[4 + i] ? val(10, 1) : 0);
    if (cv[211] >= 0) ld(1, cv[211], s.smOff > 0 ? lon : 0);
    if (cv[212] >= 0) ld(1, cv[212], s.smOff < 8 - Math.min(8, cv[121]) ? lon : 0);
    if (cv[213] >= 0 && !ax) {
      for (let i = 0; i < 4; i++) ld(cv[6], cv[213] + i, blOn && !blRoll && E.blBeats === 2 ** i ? lon : 0);
      ld(cv[6], cv[213] + 4, blOn && !blRoll ? lon : 0);
    }
  }
  if (ax) {
    const isA = s.deck === 0, dp = (d) => ((sh.st[d] || {}).p || {}), M = s.mix || {}, blend = s.blend | 0;
    if (isA && axPg > 1) {   // the grid on the pages 2-5 (ax_draw, JSFX:4102)
      for (let i = 0; i < 40; i++) {
        let v;
        if (axPg === 2) {
          const on = i <= 8 ? (blend < 9 ? blend : sh.blKeep) === i : i === 9 ? blend < 9 : i <= 38 ? blend === i - 1 : !!sh.blCombo;
          v = val(i <= 8 ? 6 : i === 9 ? 10 : i <= 38 ? (i - 1 < 24 ? 3 : i - 1 < 33 ? 2 : 12) : 11, !on);
        } else {
          const q = axPg === 4 ? dp(1) : dp(0);
          const t = axPg === 5 ? M.mfxType || 0 : q.vfxType || 0, onn = axPg === 5 ? t > 0 : (q.vfxAmt || 0) > 0;
          if (i <= 15) v = i === t ? (onn || i === 0 ? val(axTcol(i), 0) : val(10, 1)) : val(axTcol(i), 1);
          else {   // the LFO: row 3 its shape, row 4 its rate, row 5 its depth (blinking while on, about 1.5 times a second)
            const lsh = q.lfoShape ?? 2, lrt = q.lfoRate ?? 2, ldp = Math.floor((q.lfoDepth || 0) * 7 + 0.5), r = Math.floor(i / 8), c = i - r * 8;
            v = r === 2 ? (c <= 4 ? val(9, lsh !== c) : 0) : r === 3 ? (c <= 5 ? val(5, lrt !== c) : 0)
              : val(4, c > ldp || (ldp === 0 && c > 0) || (ldp > 0 && Math.floor((aux.now || 0) / 1000 * 3) % 2 === 1));
          }
        }
        ld(1, axNote(i), v);
      }
    }
    if (isA) {   // SCENE LAUNCH 1-5 = the page; METRONOME, RECORD (dark: REAPER's), MASTER = both decks or the blackout
      for (let i = 0; i < 5; i++) ld(1, 82 + i, axPg === i + 1 ? lon : 0);
      if (axPg === 1 && !s.kpEff) { rg(1, 48, (dp(0).fxSound ?? 1) * 127); rg(1, 52, (dp(1).fxSound ?? 1) * 127); }
      ld(1, 90, E.mtOn ? lon : 0); ld(1, 93, s.rec ? lon : 0); ld(1, 80, M.blackout || sh.both ? lon : 0);
    }
    if (axPg > 1 && (axPg === 4 ? !isA : isA)) {   // the TRACK KNOBs' rings = the page's settings (ax_kv, JSFX:3994)
      const ty = axPg === 5 ? M.mfxType || 0 : P.vfxType || 0;
      const kv = (k) => (axPg === 2 ? [M.keySoft ?? 0.1, M.keyThresh ?? 0.3, M.camBlur ?? 0.6, (M.camOver ?? 1) / 2, M.camShake ?? 0.7][k] ?? -1
        : k === 0 ? (axPg === 5 ? M.mfxAmt || 0 : P.vfxAmt > 0 ? P.vfxAmt : s.vfxkAmt > 0 ? s.vfxkAmt : 1)
          : k === 1 ? (ty > 0 && axPg !== 5 ? P.fxSound ?? 1 : -1) : k === 2 ? P.lfoDepth || 0
            : k === 3 ? (ty === 1 ? (P.tintDark ?? 11) / 14 : ty === 9 ? ((P.gateStep ?? -1) + 1) / 5 : -1) : k === 4 && ty === 1 ? (P.tintLight ?? 14) / 14 : -1);
      for (let i = 0; i < 8; i++) { const n = kv(i); rg(1, 48 + i, n < 0 ? 0 : n * 127); }
    }
  }
  return L;
}
// the messages that bring a unit from what was sent (shadow, updated) to what is wanted; only the changes (apc_ld / apc_rg)
export function ledDiff(shadow, want) {
  const out = [];
  for (const [k, v] of want) {
    if (shadow.get(k) === v) continue;
    shadow.set(k, v);
    const r = k >= RING, c = ((r ? k - RING : k) >> 7) & 15, n = k & 127;
    out.push([(r ? 0xb0 : 0x90) | c, n, v]);
  }
  return out;
}
// every light and ring that was lit, off (leaving the page)
export function ledOff(shadow) {
  const out = [];
  for (const [k, v] of shadow) if (v) { const r = k >= RING; out.push([(r ? 0xb0 : 0x90) | (((r ? k - RING : k) >> 7) & 15), k & 127, 0]); }
  shadow.clear();
  return out;
}
// the APC40 at start (JSFX:4126-4149): Ableton Live mode (sysex, when the page may send it), the knobs' ring type Single,
// and every light off once (what an earlier session lit)
export function apcInit(ty, sysex) {
  const out = [];
  if (sysex) out.push([0xf0, 0x47, 0x7f, ty === 1 ? 0x29 : 0x73, 0x60, 0x00, 0x04, 0x41, 0x09, 0x07, 0x01, 0xf7]);
  for (let i = 0; i < 8; i++) { for (let n = 24; n < 32; n++) out.push([0xb0 | i, n, 1]); out.push([0xb0, 56 + i, 1]); }
  const off = (c, a, b) => { for (let n = a; n <= b; n++) out.push([0x90 | c, n, 0]); };
  off(0, 0, 39); off(0, 82, 86); off(0, 87, 103); off(0, 80, 81);
  for (let i = 0; i < 8; i++) { off(i, 48, 52); off(i, 58, 66); off(i, 53, 57); }
  return out;
}

// ---------- choosing a preset ----------
const norm = (x) => x.toLowerCase().replace(/[^a-z0-9]/g, '');
// [deck A menu, deck B menu] for the connected devices' names (the longest model name found in them), or null
export function matchPresets(names, presets) {
  const dev = names.map(norm);
  let best = null, bestLen = 0;
  for (const p of presets) {
    if (p.menu === 0 || p.deck !== 1 || /emu/i.test(p.name)) continue;
    const base = p.name.replace(/ deck 1$| \(ch 1\)$/, '');
    const maker = (p.maker || '').split(/[ /]/)[0];
    const bare = base.startsWith(maker + ' ') ? base.slice(maker.length + 1) : base;
    const cands = new Set([base, bare, ...bare.split('/'), bare.split(' ')[0]].map(norm).filter((c) => c.length >= 4 && /\d|buddy|ready|touch|mixage|beatpad/.test(c)));
    for (const c of cands) if (c.length > bestLen && dev.some((d) => d.includes(c))) { best = p; bestLen = c.length; }
  }
  if (!best) return null;
  const pair = presets.find((q) => q.pid === best.pid + 1 && q.deck === 2);
  return [best.menu, pair ? pair.menu : best.menu];
}

export function optionLabel(p) {
  return p.menu === 0 ? 'Custom (JSFX defaults)' : (p.tested ? '' : '⚠ ') + p.name;
}

// ---------- the page ----------
const LS_KEY = 'rsw_midi_presets2';   // (2: -1 = automatic, by the device's name)
// the user presets (made on the Learn page or read from a .reascratch-preset file, ⚪205): [{menu, name, deck, cv, sliders}]
const LS_USER = 'rsw_midi_user';
export const USER_MENU = 1000;   // their menu values: 1000, 1001 ...
const RANGES = [8, 16, 50];

export async function loadPresets() {
  const r = await fetch(new URL('./presets.json', import.meta.url));
  return (await r.json()).presets;
}

// an input and an output of one unit: Windows / Chrome may name them apart ("MIDIIN2 (APC40 mkII)" / "MIDIOUT2 (APC40 mkII)",
// "... In" / "... Out")
export const portKey = (n) => norm(n).replace(/midi(in|out)\d*/g, '').replace(/(input|output|in|out)\d*$/, '');

export function initMidi(app, status) {
  const sels = [document.querySelector('#midiA'), document.querySelector('#midiB')];
  const shared = { sel: -1 };
  const st = [newState(0, shared), newState(1, shared)];
  let presets = null, byMenu = new Map(), outputs = [], inNames = [];
  const hidIns = [], hidOuts = [];
  const teSetT = [-1e9, -1e9];
  // each deck's preset: a menu value chosen by hand (used for every device, as the JSFX reads all MIDI inputs), or -1 =
  // automatic: each device's messages are read with the preset its name matches (several controllers at once)
  app.midiPreset = [-1, -1];
  const autoBy = new Map();   // device name -> [menu deck 1, menu deck 2] or null
  const autoFor = (name) => {
    if (!autoBy.has(name)) autoBy.set(name, presets ? matchPresets([name], presets) : null);
    return autoBy.get(name);
  };
  const used = [-2, -2];      // the preset whose engine settings were sent last, per deck
  let saved = null, user = [];
  try { saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) { /* storage blocked */ }
  try { user = JSON.parse(localStorage.getItem(LS_USER) || '[]'); if (!Array.isArray(user)) user = []; } catch (e) { /* storage blocked */ }
  let lastSrc = '';   // the device heard last (the preset the Learn page compares with)

  const apply = (d, menu = app.midiPreset[d]) => {   // the engine's settings that come from the preset
    const p = byMenu.get(menu); if (!p) return;
    used[d] = menu;
    app.send({ d, t: 'set', p: { spt: p.cv[9] } });
    app.send({ d, t: 'field', k: 'autoRel', v: p.cv[13] > 0 ? p.cv[13] / 1000 : 1e9 });   // 0 = held until the release note
    st[d].touched = 0; st[d].teTk = 1; st[d].teMlast = -1000;
  };
  const choose = (d, menu, remember) => {
    if (menu !== -1 && !byMenu.has(menu)) return;
    app.midiPreset[d] = menu; sels[d].value = String(menu);
    if (menu >= 0) apply(d);
    if (remember) { try { localStorage.setItem(LS_KEY, JSON.stringify(app.midiPreset)); } catch (e) { /* storage blocked */ } saved = app.midiPreset.slice(); }
  };
  // the outputs of the unit a message came from (its port name, else the same automatic preset)
  const pairOut = (srcName) => outputs.filter((o) => portKey(o.name) === portKey(srcName)
    || (autoFor(o.name) && autoFor(srcName) && autoFor(o.name)[0] === autoFor(srcName)[0]));

  const act = (d, a, srcName) => {
    const ui = app.decks[d];
    switch (a.t) {
      case 'lamp': ui.midiT = performance.now(); break;
      case 'call': app.send({ d, t: 'call', f: a.f, a: a.a }); break;
      case 'field': app.send({ d, t: 'field', k: a.k, v: a.v }); break;
      case 'tempo': ui.set({ tempo: a.v }); ui.p.sync = 0; teSetT[d] = performance.now(); break;
      case 'sync': app.toggleSync(d); break;
      case 'syncTo': {   // SYNC as deck a.from's (the helper APC40's MASTER held: the main controller's SYNC on both decks)
        const v = !!app.decks[a.from].p.sync;
        if (!!(ui.s && ui.s.sync) !== v) app.toggleSync(d);
        break;
      }
      case 'ret': if (app.callRet) app.callRet(d, a.f); break;
      case 'both': app.bothPlay(); break;
      case 'range': { const i = RANGES.indexOf(ui.p.range || 16); ui.p.range = RANGES[(i + 1) % RANGES.length]; break; }   // (page-side, as the setup's range)
      case 'xf': app.setXf(a.v); break;
      case 'vol': app.setVol(d, a.v); break;
      case 'toggle': ui.set({ [a.k]: ui.p[a.k] ? 0 : 1 }); break;
      case 'set': ui.set(a.p); if (app.fxSync) app.fxSync(d); break;
      case 'mix':   // the master video FX (its sound on both decks), the key: as the setup's (main.js setupSet)
        // (cueMix, the headphones' cue mix: the worklet's one value, {t:'cueMix'} in engine/processor.js)
        if (app.mix) for (const [k, v] of Object.entries(a.p)) {
          app.mix[k] = v;
          if (k === 'mfxType' || k === 'mfxAmt' || k === 'boost') for (const u of app.decks) u.set({ [k]: v });
          if (k === 'cueMix') { app.cueMixV = v; app.send({ t: 'cueMix', v }); }
        }
        if (app.fxSync) app.fxSync(d); break;
      case 'deck': act(a.d, a.a, srcName); break;   // the other deck's settings (the FX knob / FX PARAM on both decks)
      case 'blend': if (app.mix) app.mix.blend = a.v; if (app.fxSync) app.fxSync(d); ui.status(`video blend: ${BLENDS[a.v] || a.v}`); break;
      case 'msg': ui.status(a.v); break;
      case 'files': if (app.filesToggle) app.filesToggle(); break;   // (⚪205 main.js: the file list, LOAD / PREVIEW)
      case 'rec': if (app.toggleTake) app.toggleTake(); break;
      case 'browse': if (app.filesMove) app.filesMove(a.v); break;
      case 'load': if (app.filesLoad) app.filesLoad(d, a.replace); break;
      case 'preview': if (app.filesPreview) app.filesPreview(d); break;
      case 'tap': if (app.callRet) app.callRet(d, 'ttTap'); break;
      case 'out': for (const o of srcName ? pairOut(srcName) : outputs) try { o.send(a.bytes); } catch (e) { /* port gone */ } break;
    }
  };
  // the page's side of the state the decoder and the lights read
  const feed = (d) => {
    const ui = app.decks[d], e = ui.s || {};
    st[d].files = !!(app.filesOpen && app.filesOpen()); st[d].rec = !!app.taking;
    st[d].p = ui.p; st[d].e = e.pats ? { ...e, patK: e.patPad ?? -1, patPads: e.pats.map((x) => x !== -1) } : e; st[d].blend = app.mix ? app.mix.blend : 0; st[d].mix = app.mix || {};
  };
  // ports that send back what they are sent (loopMIDI and other virtual cables): the lights sent there came back as
  // presses (a Buddy preset chosen by hand: its CUE light read as CUE, so the deck started by itself and would not stop;
  // user's report 2026-10-20). Each output that has an input of its name gets a probe (note off, ch 16, note 127) once;
  // one that comes back marks the port, and it gets no lights
  const loopback = new Set(), probeT = new Map();
  const PROBE = [0x9f, 0x7f, 0x00];
  // the helper APC40 (ax_on, JSFX:3369): an APC40 mkII read with its own preset while another controller is there (a unit
  // read with a preset that is not an APC40 mkII: known by its name, or heard and read with the preset chosen by hand). Its
  // port key, or '' (none)
  const heard = new Set();
  const menuOf = (name, d) => { const a = autoFor(name); return app.midiPreset[d] >= USER_MENU || !a ? app.midiPreset[d] : a[d]; };
  const isApc2 = (name) => { const p = byMenu.get(menuOf(name, 0)); return !!p && p.cv[135] === 1; };
  const helperKey = () => {
    if (!presets) return '';
    const apc = inNames.find((n) => isApc2(n));
    if (!apc) return '';
    const k = portKey(apc);
    const other = inNames.some((n) => portKey(n) !== k && (autoFor(n) || heard.has(portKey(n))) && byMenu.get(menuOf(n, 0)) && !isApc2(n));
    return other ? k : '';
  };
  const onMsg = (data, srcName) => {
    const key = portKey(srcName);
    if (data[0] === PROBE[0] && data[1] === PROBE[1] && data[2] === PROBE[2]) { if (probeT.has(key)) loopback.add(key); return; }
    if (data[0] < 0xf0) { lastSrc = srcName; heard.add(key); }
    // the setup's MIDI monitor; the Learn page takes the messages for itself while a step waits (as the JSFX's wz_cap)
    if (app.midiHeard) app.midiHeard(data, srcName);
    if (app.learnCap && app.learnCap(data)) return;
    if (!presets) return;
    const now = performance.now(), hk = helperKey(), aux = { ax: !!hk && hk === key, cx: !!hk };
    for (const d of [0, 1]) {
      // a unit known by its name is always read with its own preset; the one chosen by hand is for the other units
      // (chosen by hand for every unit, the APC40 was read and lit as a Buddy: user's photo 2026-10-20)
      // (a user preset chosen by hand reads every unit: it was made for the unit in hand, ⚪205)
      const a = autoFor(srcName);
      let menu = app.midiPreset[d] >= USER_MENU || !a ? app.midiPreset[d] : a[d];
      if (menu < 0) continue;
      const p = byMenu.get(menu); if (!p) continue;
      if (used[d] !== menu) apply(d, menu);
      const ui = app.decks[d];
      // the engine's tempo (SYNC, keys), but the one just set by the fader until the engine's state has caught up with it
      const eng = ui.s && typeof ui.s.tempo === 'number' && (!ui.sT || ui.sT > teSetT[d] + 50);
      st[d].tempo = eng ? ui.s.tempo : (ui.p.tempo || 0);
      st[d].range = ui.p.range || 16;
      feed(d);
      for (const a of decode(p, st[d], data, now, aux)) act(d, a, srcName);
    }
  };

  // ---- the lights: each output gets the lights of the presets that read its unit (automatic: by its name; chosen by hand:
  // an output named as an input), only the changes (a shadow per output), all again every 3 s, when a page / deck / mode
  // changes and when the unit comes (JSFX:4150-4153); off when the page goes ----
  const shadows = new Map();   // output id -> {m: Map (what was sent), gen, full (ms), init}
  let sysexOk = false;
  const outMenus = (o) => {
    const k = portKey(o.name);
    if (loopback.has(k)) return null;
    if (probeT.has(k) && performance.now() - probeT.get(k) < 500) return null;   // its probe may still come back
    // lights only to a unit known by its name (not to an audio interface or a port of unknown kind)
    const a = autoFor(o.name);
    return a && inNames.some((n) => portKey(n) === portKey(o.name)) ? a : null;
  };
  // sent at once, no Web MIDI timestamps (200 in a row through loopMIDI all arrived). With timestamps and the lights-off
  // at pagehide, Chrome crashed on every reload of the page (user's report 2026-10-20; the cause not proved: both are
  // out until it is)
  const send = (o, list) => { for (const b of list) try { o.send(b); } catch (e) { /* port gone, or sysex not allowed */ } };
  const ledTick = () => {
    if (!presets) return;
    const now = performance.now(), hk = helperKey();
    for (const o of outputs) {
      const menus = outMenus(o);
      if (!menus) continue;
      let sh = shadows.get(o.id);
      if (!sh) { sh = { m: new Map(), gen: '', full: 0, init: 0 }; shadows.set(o.id, sh); }
      const pes = menus.map((m) => byMenu.get(m));
      if (!sh.init) {   // the APC40's mode and every light off, once a connection
        sh.init = 1;
        const ty = pes.map((p) => p && p.cv[135]).find((x) => x === 1 || x === 2);
        if (ty) send(o, apcInit(ty, sysexOk));
        sh.m.clear();
      }
      const gen = `${st[0].ledGen},${st[1].ledGen},${shared.sel},${menus},${shared.axPg},${hk}`;   // (the helper's page: all again, JSFX:4152)
      if (gen !== sh.gen || now - sh.full > 3000) { sh.m.clear(); sh.gen = gen; sh.full = now; }
      const want = new Map();
      for (const d of [0, 1]) {
        if (!pes[d]) continue;
        feed(d);
        for (const [k, v] of ledWant(pes[d], st[d], { ax: !!hk && hk === portKey(o.name), now })) want.set(k, v);
      }
      send(o, ledDiff(sh.m, want));
    }
  };
  // FX PARAM held = the transitions repeat (rpTick, deck A's); the blend under a transition kept in step with a blend
  // changed on the page while the blend with transitions is on (gmem [188], JSFX:5264-5266)
  const fxTick = () => {
    if (!shared.st) return;
    feed(0);
    for (const a of rpTick(shared, performance.now())) act(0, a, '');
    if (app.mix && shared.blCombo) {
      const bu = blendUnder(shared, app.mix.blend);
      if (app.mix.blendUnder !== bu) { app.mix.blendUnder = bu; if (app.fxSync) app.fxSync(0); }
    }
  };
  setInterval(() => { ledTick(); fxTick(); }, 40);
  const allOff = () => { for (const o of outputs) { const sh = shadows.get(o.id); if (sh) { send(o, ledOff(sh.m)); sh.init = 0; } } };
  // (the lights-off when the page goes is not called: see send above)
  app.midiLightsOff = allOff;

  const menus = () => {
    byMenu = new Map([...presets, ...user].map((p) => [p.menu, p]));
    const groups = new Map();
    for (const p of presets) { const g = p.menu === 0 ? '' : p.maker || 'Other'; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(p); }
    const esc = (x) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    let html = [...groups].map(([g, ps]) => {
      const opts = ps.map((p) => `<option value="${p.menu}">${esc(optionLabel(p))}</option>`).join('');
      return g ? `<optgroup label="${esc(g)}">${opts}</optgroup>` : opts;
    }).join('');
    if (user.length) html = `<optgroup label="${esc(t('userPresets'))}">${user.map((p) => `<option value="${p.menu}">${esc(`${p.name} (deck ${p.deck})`)}</option>`).join('')}</optgroup>` + html;
    html = `<option value="-1">${esc(t('midiAuto'))}</option>` + html;
    sels.forEach((sel, d) => { sel.innerHTML = html; sel.value = String(app.midiPreset[d]); });
  };
  // the Learn page's side (⚪205): the preset deck d is read with now (chosen by hand, else the one of the unit heard last,
  // else Custom), and a user preset put into deck d
  app.midiPresetOf = (d) => {
    if (!presets) return null;
    if (d < 0) return byMenu.get(0);
    const a = lastSrc ? autoFor(lastSrc) : null;
    return byMenu.get(app.midiPreset[d] >= USER_MENU || !a ? app.midiPreset[d] : a[d]) || byMenu.get(0);
  };
  app.midiUserAdd = (d, name, deck, cv, sliders) => {
    let p = user.find((q) => q.name === name && q.deck === deck);
    if (!p) { p = { menu: USER_MENU + user.reduce((m, q) => Math.max(m, q.menu - USER_MENU + 1), 0), name, deck }; user.push(p); }
    Object.assign(p, { cv: { ...cv }, sliders: { ...sliders }, tested: true, maker: 'user' });
    try { localStorage.setItem(LS_USER, JSON.stringify(user)); } catch (e) { /* storage blocked: for this page only */ }
    menus(); if (d >= 0) { used[d] = -2; choose(d, p.menu, true); }
    return p;
  };
  app.midiUserDel = (menu) => {
    user = user.filter((q) => q.menu !== menu);
    try { localStorage.setItem(LS_USER, JSON.stringify(user)); } catch (e) { /* storage blocked */ }
    for (const d of [0, 1]) if (app.midiPreset[d] === menu) choose(d, -1, true);
    menus();
  };
  app.midiUserList = () => user.slice();

  loadPresets().then((list) => {
    presets = list;
    menus();
    sels.forEach((sel, d) => sel.addEventListener('change', () => choose(d, +sel.value, true)));
    if (Array.isArray(saved) && saved.length === 2) saved.forEach((m, d) => choose(d, +m, false));
    else [-1, -1].forEach((m, d) => choose(d, m, false));
    startMidi();
  }, () => status(t('midiOff')));

  // a HID unit (hid.js connectHid): its messages go the way of a MIDI input of its name, the lights it is sent go to it
  app.midiFeed = (bytes, name) => onMsg(bytes, name);
  app.hidAdd = (name, send) => {
    if (!hidIns.includes(name)) { hidIns.push(name); hidOuts.push({ id: `hid:${name}`, name, send }); }
    inNames = [...new Set([...inNames, name])]; outputs = [...new Set([...outputs, ...hidOuts])];
  };
  app.hidRemove = (name) => {
    const i = hidIns.indexOf(name);
    if (i < 0) return;
    hidIns.splice(i, 1); const o = hidOuts.splice(i, 1)[0];
    inNames = inNames.filter((n) => n !== name); outputs = outputs.filter((x) => x !== o); shadows.delete(o.id);
  };

  let curAcc = null, sysexAsked = false;
  function hookAcc(acc) {
    if (curAcc && curAcc !== acc) { for (const inp of curAcc.inputs.values()) inp.onmidimessage = null; curAcc.onstatechange = null; }
    curAcc = acc;
    const hook = () => {
      const names = [];
      for (const inp of acc.inputs.values()) { inp.onmidimessage = (e) => onMsg(e.data, inp.name); names.push(inp.name); }
      inNames = names.concat(hidIns);
      for (const o of acc.outputs.values()) {
        const k = portKey(o.name);
        if (!probeT.has(k) && names.some((n) => portKey(n) === k)) { probeT.set(k, performance.now()); try { o.send(PROBE); } catch (e) { /* port gone */ } }
      }
      outputs = [...acc.outputs.values(), ...hidOuts];
      for (const id of [...shadows.keys()]) if (!outputs.some((o) => o.id === id)) shadows.delete(id);   // a unit gone: all again when it comes back
      // each device and the preset it is read with (automatic), so a device left out is plain to see
      const label = (n) => { const a = autoFor(n); return a ? `${n} → ${byMenu.get(a[0]).name.replace(/^⚠ /, '').replace(/ deck 1$| \(ch 1\)$/, '')}` : `${n} (${t('midiNoPreset')})`; };
      status(names.length ? `${t('midi')}: ${names.map(label).join(', ')}` : t('midiNone'));
      // an APC40 (its lights need its Ableton Live mode, a sysex message): ask for sysex once, only then
      const apc = outputs.some((o) => { const m = outMenus(o); return m && m.some((x) => x >= 0 && [1, 2].includes(byMenu.get(x).cv[135])); });
      if (apc && !sysexOk && !sysexAsked) {
        sysexAsked = true;
        navigator.requestMIDIAccess({ sysex: true }).then((acc2) => { sysexOk = true; for (const sh of shadows.values()) sh.init = 0; hookAcc(acc2); }, () => { /* refused: the lights as the unit's mode allows */ });
      }
    };
    hook();
    acc.onstatechange = hook;
  }
  function startMidi() {
    if (!navigator.requestMIDIAccess) { status(t('midiOff')); return; }
    navigator.requestMIDIAccess().then(hookAcc, () => {   // permission refused: clicking the status asks again
      status(t('midiDenied'));
      const el = document.querySelector('#midiStatus');
      if (el) el.onclick = () => { el.onclick = null; startMidi(); };
    });
  }
}

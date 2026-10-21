// ReaScratch Web — the page: audio worklet, two deck screens, the picture output, keys, files.
import { DeckUI, loadImages } from './deckui.js';
import { decodeAudio, isVideo, readFrames, FrameSource, frameLog } from './media.js';
import { FAST } from './engine/state_keys.js';
import { isAvi, readAvi } from './avi.js';
import { writeAvi } from './aviwrite.js';
import { t, getLang, setLang } from './i18n.js';
import { initMidi } from './midi.js';
import { initFxPanel, EFFECTS } from './fxpanel.js';
import { initLearn, midiWords } from './learnui.js';
import { initMore } from './moreui.js';
import { canRecordTake, startTake } from './takerec.js';
import { connectHid } from './hid.js';
import { initFiles, droppedFiles } from './files.js';
import { mgPad, ppSemi, vfxPad } from './midi.js';
import { Mixer } from './video/mixer.js';
import { canCapture } from './capture.js';
import { captureDialog } from './captureui.js';

const $ = (s) => document.querySelector(s);
const app = {
  ctx: null, node: null, xf: 0.5, active: 0, loading: ['', ''], vol: [1, 1], range: [16, 16],
  frames: [new Array(8).fill(null), new Array(8).fill(null)], loopRate: [new Array(8).fill(0), new Array(8).fill(0)], speaker: null, decks: [], params: [{}, {}], queue: [],
};
window.reascratch = app;   // for tests from the console

app.send = (m) => { if (app.node) app.node.port.postMessage(m); else app.queue.push(m); };
app.setActive = (d) => { const was = app.active; app.active = d; if (MOBILE && was !== d) showDeck(); };
// the phone's page (?m=1 / ?m=0 to force it on or off): a coarse pointer on a small screen
const MOBILE = (() => {
  const q = new URLSearchParams(location.search).get('m');
  if (q) return q === '1';
  return window.matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 600;
})();
let retId = 0;
app.callRet = (d, f, ...a) => app.send({ d, t: 'call', f, a, id: ++retId });   // the worklet answers with its bpm / grid
app.openFile = (d, k) => { app.fileDeck = d; app.fileSlot = k; $('#file').click(); };
// each slot's loads are numbered: a load that is no longer the latest one for its slot (another file loaded there, or
// the slot emptied, while its frames were still being made) leaves the slot alone. Found 2026-10-20: the demo's frames,
// done late, replaced the spinning speaker of a WAV loaded into the same slot meanwhile
let loadSeq = 0;
const slotGen = [new Array(8).fill(0), new Array(8).fill(0)];
app.unloadSlot = (d, k) => {
  slotGen[d][k] = ++loadSeq;
  if (app.frames[d][k]) app.frames[d][k].close();
  app.frames[d][k] = null; app.loopRate[d][k] = 0;
  app.send({ d, t: 'call', f: 'unloadSlot', a: [k] });
};
const curSlot = (d) => (app.decks[d] && app.decks[d].s ? app.decks[d].s.cur : 0);
// where a file without a chosen slot goes: the slot in use if it is empty, else the next empty one, else the slot in use
function slotFor(d) {
  const ui = app.decks[d], c = curSlot(d);
  if (!ui.slotAudio[c]) return c;
  for (let i = 1; i < 8; i++) { const k = (c + i) % 8; if (!ui.slotAudio[k]) return k; }
  return c;
}
app.showHelp = () => showHelp();
app.showSetup = (d) => showSetup(d);
app.askBpm = (d) => showSetup(d, 'bpm');
app.toggleSync = (d) => {
  const on = !(app.decks[d].s && app.decks[d].s.sync);
  app.send({ d, t: 'field', k: 'syncOn', v: on ? 1 : 0 });
  if (on) app.send({ d, t: 'call', f: 'syncTempo' }), app.send({ d, t: 'call', f: 'syncBeat' });
  app.decks[d].p.sync = on ? 1 : 0;
};
let bothT = 0;
app.bothPlay = () => {   // SHIFT + PLAY: both decks start or stop together; one press may arrive at both decks
  if (performance.now() - bothT < 80) return;
  bothT = performance.now();
  const anyOn = app.decks.some((u) => u.s && u.s.playing);
  app.decks.forEach((u, d) => { if (u.s && u.s.len > 0 && !!u.s.playing === anyOn) app.send({ d, t: 'call', f: 'playBtn' }); });
};
app.setXf = (v) => { app.xf = Math.max(0, Math.min(1, v)); app.send({ t: 'xf', v: app.xf }); $('#xf').value = Math.round(app.xf * 1000); };
app.setVol = (d, v) => { app.vol[d] = Math.max(0, Math.min(1, v)); app.decks[d].set({ vol: app.vol[d] * app.vol[d] }); };

// when a state was made, on the page's clock: its audio time plus the smallest delay of the last 12 messages (0.2 s).
// The messages leave the audio thread in uneven bunches (18-39 ms apart on a phone), so their arrival is no clock (the
// drawn head jumped up to 28 ms, user's report 2026-10-20). The window is short because the audio thread stalls now and
// then (147 ms on a Pixel when a finger went down) and its clock, counting samples, falls behind for good: a 90-message
// window kept the old offset for 1.7 s with the head drawn 130 ms ahead. getOutputTimestamp would map the clocks, but
// on Android Chrome its contextTime ran 840 ms behind currentTime (with a 27 ms output), so it is not used
const clk = [];
function stateTime(t) {
  clk.push(performance.now() - t * 1000); if (clk.length > 12) clk.shift();
  return t * 1000 + Math.min(...clk);
}

async function startAudio() {
  if (app.ctx) { if (app.ctx.state !== 'running') await app.ctx.resume(); return; }
  // 'interactive', also on the phone: 0 cut a Motorola edge 60s pro's output delay from 424 to 131 ms but the worklet
  // could not keep up with the small buffer, the sound and the picture broke up (user's recording 2026-10-20).
  // ?lat=interactive|balanced|playback|<seconds> to try another (?diag=1 lists what each gives)
  const lq = new URLSearchParams(location.search).get('lat');
  // Firefox on a phone: 'balanced' (with 'interactive' its about 10 ms output crackled now and then on a Motorola edge
  // 60s pro; 'balanced' took the noise away and still felt immediate, user's check 2026-10-20)
  const ffPhone = MOBILE && /Firefox\//.test(navigator.userAgent);
  const hint = lq ? (isNaN(+lq) ? lq : +lq) : ffPhone ? 'balanced' : 'interactive';
  app.ctx = new AudioContext({ latencyHint: hint });
  app.ctx.addEventListener('statechange', () => { clk.length = 0; });
  await app.ctx.audioWorklet.addModule(new URL('./engine/processor.js', import.meta.url));
  // (output 1: the headphone cue, ⚪205 routeCue)
  app.node = new AudioWorkletNode(app.ctx, 'reascratch', { numberOfInputs: 0, numberOfOutputs: 2, outputChannelCount: [2, 2] });
  // ?mute=1: automated tests run the engine without sound
  const out = new GainNode(app.ctx, { gain: /[?&]mute=1/.test(location.search) ? 0 : 1 });
  app.node.connect(out, 0).connect(app.ctx.destination);
  app.mainOut = out;
  if (app.cueOut !== 'off') routeCue(app.cueOut);
  if (/[?&]bypass=1/.test(location.search)) app.node.port.postMessage({ t: 'bypass', v: 1 });   // (engine/processor.js)
  // the sound's own delay as the browser reports it (the output, Bluetooth included where the phone counts it), shown
  // once: on a phone it tells whether a lag felt comes from the output (user's report 2026-10-20)
  setTimeout(() => {
    const ms = Math.round(((app.ctx.outputLatency || 0) + (app.ctx.baseLatency || 0)) * 1000);
    app.decks[app.active].status(`${t('latency')} ${ms} ms`);
    // Chrome on Android: the Firefox tip only when the delay is big (about 400 ms on a Motorola edge 60s pro, 27 ms on a
    // Pixel 4a, where the tip would only send someone to a needless AVI; user's choice 2026-10-21)
    if (MOBILE && /Android/.test(navigator.userAgent) && !/Firefox\//.test(navigator.userAgent) && ms > 100) showTip('tipAndroid');
  }, 700);
  app.node.port.onmessage = (e) => {
    const m = e.data;
    if (m.t === 'ret') { const ui = app.decks[m.d]; Object.assign(ui.p, m.p); if (m.r) ui.status(typeof m.r === 'string' ? m.r : `bpm ${m.r}`); }
    if (m.t === 'state') {
      // the numbers come in a Float64Array each time, the lists only now and then (engine/processor.js): the last
      // lists are kept and each state is a new object of both
      if (m.lists) app.lists = m.lists;
      const k = FAST.length;
      m.time = m.f[0]; app.load = [m.f[1 + 2 * k], m.f[2 + 2 * k]];
      m.decks = [0, 1].map((i) => { const s = { ...app.lists[i] }; for (let j = 0; j < k; j++) s[FAST[j]] = m.f[1 + i * k + j]; return s; });
      m.decks.forEach((s, i) => { const ui = app.decks[i]; if (ui.s && ui.s.cur !== s.cur) Object.assign(ui.p, { bpm: s.bpm, grid: s.grid }); }); const sT = stateTime(m.time); m.decks.forEach((s, i) => app.decks[i].pushState(s, sT)); }
  };
  for (const m of app.queue) app.node.port.postMessage(m);
  app.queue = [];
  await app.ctx.resume();
}

app.loadFile = (d, file, k) => loadFile(d, file, k);
async function loadFile(d, file, k) {
  const ui = app.decks[d];
  if (k == null) k = slotFor(d);
  await startAudio();
  app.loading[d] = `${t('reading')}: ${file.name}`;
  try {
    if (isAvi(file)) {   // an MJPEG AVI: its JPEGs are the frames, its PCM the sound (js/avi.js)
      const { a, fr, note } = await readAvi(file);
      await loadDecoded(d, k, a, file.name, async (early) => { early(fr); return fr; });
      if (note) ui.status(t(note));
      return;
    }
    const a = await decodeAudio(app.ctx, file);
    await loadDecoded(d, k, a, file.name, isVideo(file) ? async (early) => readFrames(file, (f) => ui.status(`${t('reading')} ${t('frames')}: ${Math.round(f * 100)}%`), early) : null);
  } catch (e) {
    console.error(e);
    app.loading[d] = '';
    ui.status(e && e.code === 'nopicture' ? t('noPicture') : `${t('readFail')}: ${e.message || e}`);
  }
}

// a sample whose sound is decoded (a) and whose picture frames come from getFrames(early) (null: sound only); early(frames)
// puts frames still being made on the deck at once
async function loadDecoded(d, k, a, name, getFrames, beat = null) {
  const ui = app.decks[d], gen = slotGen[d][k] = ++loadSeq, mine = () => slotGen[d][k] === gen;
  ui.setAudio(a.ch, a.rate, name, k);
  // a beat given with the sample (the demo's): set at once and kept over the analysis' (it was set only after all the
  // frames were made, and the analysis could come later still and overwrite it)
  if (beat) ui.slotAudio[k].beat = beat;
  app.send({ d, t: 'load', k, ch: a.ch.map((c) => c.slice()), rate: a.rate });
  if (k === curSlot(d)) { ui.p.bpm = beat ? beat.bpm : 0; ui.p.grid = beat ? beat.grid : 0; }
  if (beat) app.send({ d, t: 'call', f: 'slotMeta', a: [k, beat.bpm, beat.grid, 0] });
  if (app.frames[d][k]) { app.frames[d][k].close(); app.frames[d][k] = null; }
  app.loading[d] = '';
  analyse(d, k, a);
  app.loopRate[d][k] = 0;
  if (getFrames) {
    ui.status(`${t('reading')} ${t('frames')}…`);
    const show = (fr) => {
      if (!mine()) return;
      const old = app.frames[d][k]; if (old && old.f === fr) return;
      if (old) old.close();
      app.frames[d][k] = new FrameSource(fr);
    };
    let fr;
    try { fr = await getFrames(show); } catch (e) {
      // (no picture: the frames made so far, black ones in a browser that hides the video's picture, taken off)
      if (mine() && app.frames[d][k]) { app.frames[d][k].close(); app.frames[d][k] = null; }
      throw e;
    }
    if (!mine()) return;
    show(fr);
    ui.status(`${fr.n} ${t('frames')}, ${fr.fps.toFixed(2)} fps, ${fr.w}×${fr.h}`);
  } else {
    // a sound-only file shows the spinning speaker, one turn per platter turn (spec/video_spec.md §5.1)
    if (!app.speaker) {
      const blob = await (await fetch(new URL('../assets/audio_only.mp4', import.meta.url))).blob();
      app.speaker = await readFrames(new File([blob], 'audio_only.mp4', { type: 'video/mp4' }), () => {});
    }
    if (!mine()) return;
    if (app.frames[d][k]) app.frames[d][k].close();
    app.frames[d][k] = new FrameSource(app.speaker);
    app.loopRate[d][k] = app.speaker.dur / 1.8;
  }
}

// ---------- taking in a video playing in another tab (capture.js / captureui.js) ----------
async function captureTab(d) {
  await startAudio();
  const k = slotFor(d), ui = app.decks[d];
  await captureDialog(app.ctx, `${t('deck')} ${d ? 'B' : 'A'} / ${k + 1}`,
    (tk, name) => loadDecoded(d, k, tk.a, name, async () => tk.fr), (m) => ui.status(m));
}

// ---------- the analysis (BPM, beat, key, loudness; web/js/analysis.js = reascratch_lib.lua) in a worker ----------
let anaWorker = null, anaId = 0;
const anaWait = new Map(); let anaJobs = new WeakMap();   // id -> its answer; decoded sound -> its analysis
function analyse(d, k, a) {
  if (!anaWorker) {
    anaWorker = new Worker(new URL('./analysis_worker.js', import.meta.url), { type: 'module' });
    anaWorker.onmessage = (e) => { const f = anaWait.get(e.data.id); anaWait.delete(e.data.id); if (f) f(e.data.result); };
    // a job that throws: its waiters get null instead of waiting for ever (and the next load starts a fresh job)
    anaWorker.onerror = () => { for (const f of anaWait.values()) f(null); anaWait.clear(); anaJobs = new WeakMap(); };
  }
  const ui = app.decks[d], name = ui.slotAudio[k] && ui.slotAudio[k].name;
  // the same decoded sound on two decks (the demo) is analysed once
  let job = anaJobs.get(a);
  if (!job) {
    const id = ++anaId;
    job = new Promise((res) => anaWait.set(id, res));
    anaJobs.set(a, job);
    anaWorker.postMessage({ id, ch: a.ch, rate: a.rate });
  }
  job.then((r) => {
    // (the same sound, not only the same name: two files called video.mp4 one after the other)
    if (!r || !ui.slotAudio[k] || ui.slotAudio[k].name !== name || ui.slotAudio[k].audio.ch !== a.ch) return;
    const beat = ui.slotAudio[k].beat;
    if (beat) r = { ...r, bpm: beat.bpm, grid: beat.grid };
    ui.slotAudio[k].key = r.key ? r.key + (r.keyUnsure ? '?' : '') : '';
    ui.slotAudio[k].lufs = r.lufs;
    app.send({ d, t: 'call', f: 'slotMeta', a: [k, r.bpm || 0, r.grid || 0, r.lufs] });
    // a song whose tempo moves: its beats one by one (engine deck.js slotBeatMap, ⚪205); not over a beat given with the sample
    if (!beat && r.beatMap) app.send({ d, t: 'call', f: 'slotBeatMap', a: [k, r.beatMap] });
    if (k === curSlot(d)) Object.assign(ui.p, { bpm: r.bpm || 0, grid: r.grid || 0 });
    ui.status(r.bpm ? `bpm ${r.bpm.toFixed(2)}  key ${ui.slotAudio[k].key || '-'}` : `bpm ? (${t('bpmUnsure')})  key ${ui.slotAudio[k].key || '-'}`);
  });
}

// ---------- the picture: deck A and B mixed by the crossfader (Mix; spec/video_spec.md §2.1-2.2) ----------
// WebGL2 mixer (web/js/video/mixer.js = reascratch_deck_mix.eel); without WebGL2 a plain Canvas2D crossfade
const stage = $('#stage');
let mixer = null, sg = null;
try { mixer = new Mixer(stage); } catch (e) { console.warn('WebGL2 mixer not available, plain crossfade', e); sg = stage.getContext('2d'); }
let lastEnd = 0;
const slotClip = [0, 0], slotSeen = [-1, -1];
function mixState() {
  const c = 0.02, place = Math.max(0, Math.min(1, (app.xf - c) / (1 - 2 * c)));
  if (place <= 1e-4) lastEnd = 0; else if (place >= 0.9999) lastEnd = 1;
  const fx = [0, 1].map((d) => {
    const ui = app.decks[d], s = ui.s || {}, p = ui.p;
    if (s.cur !== slotSeen[d]) { slotSeen[d] = s.cur; slotClip[d]++; }
    // the controller's FX knobs and TOUCH FX pads (p.touch: amounts by type 1..16, midi.js touchArr) on the picture too
    const T = p.touch || [], sk = p.strobeKnob > 0.05 ? (p.strobeKnob - 0.05) / 0.95 : 0;
    return {
      type: p.vfxType || 0, amount: p.vfxType ? p.vfxAmt ?? 0.5 : 0, beat: s.beat ?? -1, bpm: s.bpm > 0 ? s.bpm * (1 + (s.tempo || 0) / 100) : 0,
      knobs: [T[1], T[2], T[3], T[4], T[5], T[6], T[8], Math.max(T[9] || 0, sk)], vhs: T[11] || 0, touch: [T[12], T[13], T[14], T[15]],
      lamp: d, echo: Math.max(p.echo || 0, T[10] || 0), crush: Math.max(p.crush || 0, T[7] || 0), vib: Math.max(p.vib || 0, T[16] || 0), turns: ui.headNow() / 1.8,
      moving: !!(s.playing || s.tch || Math.abs(s.speed || 0) > 0.01), clip: slotClip[d],
      // (⚪205) the setup's: the LFO, the Tint colours, VHS, the gate / strobe step
      lfo: { shape: p.lfoShape ?? 2, rate: p.lfoRate ?? 2, depth: p.lfoDepth ?? 0 }, tintDark: p.tintDark ?? 11, tintLight: p.tintLight ?? 14,
      vhsColor: p.vhsColor ?? 1, osd: p.vhsOsd ?? 0, strobeStep: p.gateStep ?? -1,
    };
  });
  const tilt = [0, 1].map((d) => { const v = app.decks[d].p.fltCut || 0; return Math.abs(v) <= 0.05 ? 0 : v; });
  const M = app.mix || {};
  return { xfPlace: place, lastEnd, blend: M.blend || 0, blendUnder: M.blendUnder || 0, boost: M.boost || 0, level: M.level || 0,
    blackout: M.blackout || 0, fade: [M.fadeA || 0, M.fadeB || 0], fx, tilt, keyThresh: M.keyThresh ?? 0.3, keySoft: M.keySoft ?? 0.1,
    masterFx: { type: M.mfxType || 0, amount: M.mfxAmt || 0 }, cam: { blur: M.camBlur ?? 0.6, overshoot: M.camOver ?? 1, shake: M.camShake ?? 0.7 } };
}
function pictureTime(d) {
  const ui = app.decks[d], s = ui.s;
  if (!s) return 0;
  const lat = app.ctx ? (app.ctx.outputLatency || 0) + (app.ctx.baseLatency || 0) : 0;
  const tt = ui.posAt(performance.now() - (s.lag + lat) * 1000);   // (deckui.js posAt)
  const r = app.loopRate[d][curSlot(d)], L = app.speaker ? app.speaker.dur : 4;
  return r ? (((tt * r) % L) + L) % L : tt;
}
function xpW(d) {   // picture share between the cut-ins (JS:5106-5124)
  const c = Math.max(0, Math.min(0.45, 0.02)), s = 0.25 + 0.5 * Math.max(0, Math.min(1, (app.xf - c) / (1 - 2 * c)));
  return d === 0 ? (1 - s) / Math.max(s, 1 - s) : s / Math.max(s, 1 - s);
}
function drawStage(bm) {
  if (mixer) {
    const st = mixState();
    [st.gA, st.gB] = [0, 1].map((d) => (bm[d] && app.decks[d].s && !app.decks[d].p.mute && !app.decks[d].p.vmute ? Math.max(0, Math.min(1, app.decks[d].s.xfGoal ?? 1)) * xpW(d) : 0));
    mixer.render(bm, st);
    // the helper APC40's master level and blackout on the sound too (the JSFX's ax_mlv; midi.js sets app.mix)
    if (app.mainOut && !/[?&]mute=1/.test(location.search)) { const g = st.blackout ? 0 : 1 - st.level; if (Math.abs(app.mainOut.gain.value - g) > 1e-4) app.mainOut.gain.value = g; }
    return;
  }
  const W = stage.width, H = stage.height;
  sg.globalCompositeOperation = 'source-over'; sg.globalAlpha = 1; sg.fillStyle = '#000'; sg.fillRect(0, 0, W, H);
  const g = [0, 1].map((d) => (bm[d] && app.decks[d].s && !app.decks[d].p.mute && !app.decks[d].p.vmute ? Math.max(0, Math.min(1, app.decks[d].s.xfGoal ?? app.decks[d].s.xfGain)) * xpW(d) : 0));
  const sum = g[0] + g[1];
  if (sum < 1e-4) return;
  const xf = g[1] / sum, vis = Math.min(1, sum);
  const w = [(1 - xf) * vis, xf * vis];
  sg.globalCompositeOperation = 'lighter';
  for (const d of [0, 1]) {
    if (!bm[d] || w[d] <= 0.002) continue;
    const b = bm[d], k = Math.min(W / b.width, H / b.height), dw = b.width * k, dh = b.height * k;
    sg.globalAlpha = w[d];
    sg.drawImage(b, (W - dw) / 2, (H - dh) / 2, dw, dh);
  }
  sg.globalAlpha = 1; sg.globalCompositeOperation = 'source-over';
}

// ?nodraw=1: nothing drawn while a deck plays (the sound alone; the screen stays as it was); ?nodraw=2: the decks
// drawn, not the picture. To tell whether the drawing breaks up the sound (Firefox on a phone, user's recordings
// 2026-10-21)
const NODRAW = +(/[?&]nodraw=(\d)/.exec(location.search) || [])[1] || 0;
// the phone's picture as a pad (user's request 2026-10-21): a finger on it, up and down = the DJ filter (top: high
// pass, bottom: low pass, the middle off), left to right = echo (0 to full), on the deck shown; let go = both back to
// 0. A dot marks the finger
function stagePad() {
  const dot = document.createElement('div'); dot.className = 'paddot'; dot.hidden = true;
  stage.parentElement.appendChild(dot);
  let id = null, d = 0;
  const at = (e) => {
    const r = stage.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    let f = (0.5 - y) * 2; f = Math.abs(f) < 0.06 ? 0 : f;   // (a little room in the middle: no filter)
    app.decks[d].set({ fltCut: Math.max(-1, Math.min(1, f)), echo: x });
    if (app.fxSync) app.fxSync(d);
    dot.hidden = false;
    dot.style.left = `${e.clientX - stage.parentElement.getBoundingClientRect().left}px`;
    dot.style.top = `${e.clientY - stage.parentElement.getBoundingClientRect().top}px`;
  };
  stage.addEventListener('pointerdown', (e) => { if (id !== null) return; id = e.pointerId; d = app.active; stage.setPointerCapture(id); at(e); });
  stage.addEventListener('pointermove', (e) => { if (e.pointerId === id) at(e); });
  const up = (e) => {
    if (e.pointerId !== id) return;
    id = null; dot.hidden = true;
    app.decks[d].set({ fltCut: 0, echo: 0 }); if (app.fxSync) app.fxSync(d);
  };
  stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
}

function frameLoop() {
  const off = NODRAW && app.decks.some((u) => u.s && u.s.playing);
  const bm = off ? [null, null] : [0, 1].map((d) => { const f = app.frames[d][curSlot(d)]; return f ? f.get(pictureTime(d)) : null; });
  if (!off) drawStage(bm);
  const both = !MOBILE || document.body.classList.contains('land');
  if (!off || NODRAW === 2) app.decks.forEach((ui, d) => { if (both || d === app.active) ui.draw(bm[d]); });   // (the phone's hidden deck: not drawn)
  requestAnimationFrame(frameLoop);
}

// ---------- keys (spec/ui_spec.md §2) ----------
const held = new Set();
function onKey(e, down) {
  if (e.target.closest && e.target.closest('input, select, textarea, dialog[open]')) { if (down && e.key === 'Escape') closeDialogs(); return; }
  const d = app.active, ui = app.decks[d], code = e.code, shift = e.shiftKey;
  const call = (f, ...a) => app.send({ d, t: 'call', f, a }), field = (k, v) => app.send({ d, t: 'field', k, v });
  const digit = /^Digit([1-8])$/.exec(code);
  if (!down) {
    held.delete(code);
    if (code === 'KeyC') call('cueRelease');
    else if (digit) { if (!screenPad(d, +digit[1] - 1, 0, false)) call('hcRelease', +digit[1] - 1); }
    else if (code === 'KeyX') field('kbTouch', 0);
    else if (code === 'KeyZ') field('kbCut', 0);
    else if (code === 'Comma' || code === 'Period') field('nudgeDir', 0);
    return;
  }
  if (e.repeat && ['KeyC', 'KeyX', 'KeyZ', 'Comma', 'Period', 'Space'].includes(code)) { e.preventDefault(); return; }
  if (digit && e.repeat) return;
  held.add(code);
  let used = true;
  if (code === 'Space') { startAudio(); call('playBtn'); }
  else if (code === 'KeyC') { if (shift) ui.set({ cue: ui.headLive() }); else call('cuePress'); }
  else if (digit) { if (screenPad(d, +digit[1] - 1, 1, shift)) { /* (another pad mode) */ } else if (shift) call('hcDelete', +digit[1] - 1); else call('hcPress', +digit[1] - 1); }
  else if (code === 'KeyX') field('kbTouch', 1);
  else if (code === 'KeyZ') field('kbCut', 1);
  else if (code === 'Comma') field('nudgeDir', -1);
  else if (code === 'Period') field('nudgeDir', 1);
  else if (code === 'ArrowUp' || code === 'ArrowDown') ui.set({ tempo: clampT((ui.s?.tempo || 0) + (code === 'ArrowUp' ? 0.1 : -0.1)) });
  else if (code === 'PageUp' || code === 'PageDown') ui.set({ tempo: clampT((ui.s?.tempo || 0) + (code === 'PageUp' ? 1 : -1)) });
  else if (/^F[1-8]$/.test(code)) call('switchSlot', +code.slice(1) - 1);
  else if (code === 'KeyY') app.toggleSync(d);
  else if (code === 'KeyV') app.vfxKey(d, shift);
  else if (code === 'KeyM') call(shift ? 'mcDelete' : 'mcAdd');
  else if (code === 'ArrowLeft' || code === 'ArrowRight') call('mcCall', code === 'ArrowLeft' ? -1 : 1);
  else if (code === 'KeyL') { if (shift) call('blToggle'); else ui.set({ cueLoop: ui.p.cueLoop ? 0 : 1 }); }
  else if (code === 'KeyJ' || code === 'KeyK') { call('blSize', code === 'KeyK' ? 1 : -1); }
  else if (code === 'KeyT') { if (shift) app.callRet(d, 'gridHere'); else app.callRet(d, 'ttTap'); }
  else if (code === 'KeyS') ui.set({ slip: ui.p.slip ? 0 : 1 });
  else if (code === 'KeyB') call('spinback');
  else if (code === 'KeyQ') ui.set({ quant: ui.p.quant ? 0 : 1 });
  else if (code === 'KeyN') app.callRet(d, 'mtToggle');
  else if (code === 'KeyP') app.filesPreview(d);   // the file list's choice in the headphones (⚪205)
  else if (code === 'KeyH') ui.set({ pfl: ui.s && ui.s.pfl ? 0 : 1 });   // the headphone cue (⚪205)   // the metronome (⚪205)
  else if (code === 'BracketLeft') app.setXf(shift ? 0 : app.xf - 0.05);
  else if (code === 'BracketRight') app.setXf(shift ? 1 : app.xf + 0.05);
  else if (code === 'Digit9') app.setVol(d, app.vol[d] - 0.1);
  else if (code === 'Digit0') app.setVol(d, app.vol[d] + 0.1);
  else if (code === 'Tab') app.setActive(1 - d);
  else if (e.key === '?' || code === 'Slash') showHelp();
  else if (code === 'Escape') closeDialogs();
  else used = false;
  if (used) e.preventDefault();
}
const clampT = (v) => Math.max(-50, Math.min(50, Math.round(v * 100) / 100));

// ---------- the deck's pads on the screen in another pad mode (⚪205; the setup's Pads group): the pads (mouse, touch, keys
// 1-8) act as a controller's pads in that mode (midi.js decode, JSFX:4846-4876); HOT CUE = the deck's own. SHIFT (Shift +
// click / key) = the mode's SHIFT layer (AUTO LOOP: a roll while held, SLICER: the slice looped, PITCH PLAY: the filter)
const PAD_MODES = [1, 2, 4, 6, 7, 8, 9, 10, 12, 13];
const PAD_NAMES = ['HOT CUE', 'SAMPLER', 'AUTO LOOP', 'SLICER', 'BOUNCE LOOP', 'NEURAL MIX (memory cues, held moves)', 'VIDEO FX', 'FILTER TYPE', 'PITCH PLAY', 'PATTERN (scratch patterns)'];
const BL_BNC = [1 / 8, 1 / 6, 1 / 4, 1 / 3, 1 / 2, 2 / 3, 1, 2];   // (midi.js blBnc, JSFX:1695)
const padShift = [new Set(), new Set()];   // the pads that went down with SHIFT (pm_shm)
function screenPad(d, k, dn, sh) {
  const ui = app.decks[d], m = PAD_MODES[ui.p.padSel || 0];
  if (m === 1) return false;
  const call = (f, ...a) => app.send({ d, t: 'call', f, a });
  if (dn) { if (sh) padShift[d].add(k); else padShift[d].delete(k); }
  const sl = padShift[d].has(k);
  if (sl && m === 4) { if (dn) call('blHold', 2 ** (k - 3), k); else call('blLetGo', k); }
  else if (sl && m === 6) { if (dn) call('sliceRoll', k); else call('blLetGo', k); }
  else if (sl && m === 12) { if (dn) ui.set({ fltType: mgPad(k) }); }
  else if (m === 2) { if (dn) call('switchSlot', k); }
  else if (m === 4) { if (dn) call('blAuto', 2 ** (k - 3)); }   // 1/8 .. 16 beats
  else if (m === 6) call('slicePad', k, dn ? 1 : 0);
  else if (m === 7) { if (dn) call('blHold', BL_BNC[k], k); else call('blLetGo', k); }
  else if (m === 8) {
    if (k < 4) { if (dn) { if (k === 0) call('mcAdd'); else if (k === 1) call('mcCall', -1); else if (k === 2) call('mcCall', 1); else call('mcDelete'); } }
    else call(sl ? 'mvStop' : 'mvHold', k - 4, dn ? 1 : 0);
  } else if (m === 9) {
    if (dn) {
      const ty = vfxPad(k), p = ui.p;
      if ((p.vfxAmt || 0) > 0 && p.vfxType === ty) { ui.vfxKeep = p.vfxAmt; ui.set({ vfxAmt: 0 }); } else ui.set({ vfxType: ty, vfxAmt: ui.vfxKeep > 0 ? ui.vfxKeep : 1 });
      if (app.fxSync) app.fxSync(d);
    }
  } else if (m === 10) { if (dn) { ui.set({ fltType: mgPad(k) }); if (app.fxSync) app.fxSync(d); } }
  else if (m === 13) { if (dn) app.callRet(d, 'patPad', k, 1); }   // (engine patterns.js; the answer names the pattern)
  else if (m === 12) { if (dn) { const semi = ppSemi(k); call('ppPress', semi); ui.status(`key ${semi > 0 ? '+' : ''}${semi}`); } else call('hcRelease', 0); }
  return true;
}

// ---------- dialogs ----------
function closeDialogs() { document.querySelectorAll('dialog[open]').forEach((x) => x.close()); }
function showHelp() {
  const rows = (list) => list.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('');
  $('#helpBody').innerHTML = `<h3>${t('keysTitle')}</h3><table>${rows(t('keys'))}</table><h3>${t('mouseTitle')}</h3><table>${rows(t('mouse'))}</table><p class="note">${t('notInTrial')}</p>`;
  $('#help').showModal();
}
// the setup's rows: [key, lo, hi, step] a number; [key, [options]] a choice of words (t('o_' + option)); [key, [labels], 'n']
// a choice by number (0, 1 ... ; labels as in the JSFX). ⚪205: the sound FX, the video FX's LFO / colours and the
// picture's settings of the JSFX's setup (More > Filter & effects, Video FX)
const PALETTE = ['Black', 'White', 'Lamp colour', 'Red', 'Orange', 'Yellow', 'Lime', 'Green', 'Cyan', 'Sky', 'Blue', 'Navy', 'Purple', 'Magenta', 'Pink'];
const SETUP = [['recSide', ['auto', 'left', 'right']], ['bpm', 0, 300, 0.01], ['grid', 0, 60, 0.001], ['range', 1, 50, 1], ['brake', 0, 5, 0.05], ['startT', 0, 5, 0.05],
  ['spinRel', 0, 5, 0.05], ['sbSpeed', 0.5, 10, 0.1], ['sbTime', 0.05, 5, 0.05], ['holdMs', 0, 2000, 10], ['cutIn', 0, 45, 1],
  ['fadeW', 0, 100, 1], ['xfCurve', 0, 1, 1], ['spt', 50, 4000, 1],
  ['xfSide', ['Off', 'Left (deck A side)', 'Right (deck B side)'], 'n'], ['padSel', PAD_NAMES, 'n'],
  ['swing', 50, 75, 1], ['pzQ', ['Off', '1 beat', '1/2 beat (8th)', '1/4 beat (16th)'], 'n'], ['brakeBeats', 0, 4, 0.25],
  ['mtOn', ['Off', 'On'], 'n'], ['mtMode', ['the playing deck', 'the SYNC master', 'each deck (its own on / off)'], 'n'],
  ['mtHold', ['keeps the beat', 'silent'], 'n'], ['mtVol', -30, 0, 1],
  ['mute', ['Off', 'On'], 'n'], ['vmute', ['Off', 'On'], 'n'], ['pfl', ['Off', 'On'], 'n'], ['cueMix', 0, 1, 0.01], ['mtOut', ['headphones only', 'headphones and main'], 'n'],
  ['agOn', ['Off', 'On'], 'n'], ['agTarget', -24, -6, 1], ['fxSound', 0, 1, 0.01],
  ['echoLen', ['1/8', '1/4', '1/2', '3/4', '1', '2'], 'n'], ['echoFb', -1, 0.95, 0.01],
  ['vibStep', ['1 beat', '1/2 beat (8th)', '1/3 beat (8th triplet)', '1/4 beat (16th)', '1/6 beat (16th triplet)', '1/8 beat (32nd)'], 'n'],
  ['vibWidth', 0, 12, 1], ['gateStep', -1, 4, 1], ['fltRes', 0, 1, 0.01], ['fltMorph', -0.5, 0.5, 0.001], ['discTone', 0, 1, 0.01],
  ['lfoShape', ['Sine', 'Triangle', 'Square', 'Saw down', 'Saw up'], 'n'], ['lfoRate', ['1/4 beat', '1/2 beat', '1 beat', '2 beats', '4 beats', '8 beats'], 'n'],
  ['lfoDepth', 0, 1, 0.01], ['tintDark', PALETTE, 'n'], ['tintLight', PALETTE, 'n'], ['vhsColor', ['Pink fringes', 'Blue-white'], 'n'], ['vhsOsd', ['Off', 'On'], 'n'],
  ['mfxType', EFFECTS, 'n'], ['mfxAmt', 0, 1, 0.01], ['keyThresh', 0, 1, 0.01], ['keySoft', 0, 1, 0.01],
  ['camBlur', 0, 1, 0.01], ['camOver', 0, 2, 0.01], ['camShake', 0, 1, 0.01]];
// the JSFX's defaults (Tint: dark Navy, light Pink as its sliders 249 / 250; the mixer's own 0 / 2 were older)
const SETUP_DEF = { recSide: 'auto', bpm: 0, grid: 0, range: 16, brake: 0, startT: 0, spinRel: 0.25, sbSpeed: 3, sbTime: 1, holdMs: 300, cutIn: 2, fadeW: 30, xfCurve: 1, spt: 400,
  agOn: 1, agTarget: -12, fxSound: 1, echoLen: 2, echoFb: -1, vibStep: 3, vibWidth: 5, gateStep: -1, fltRes: 0.4, fltMorph: 0, discTone: 0,
  lfoShape: 2, lfoRate: 2, lfoDepth: 0, tintDark: 11, tintLight: 14, vhsColor: 1, vhsOsd: 0,
  mute: 0, vmute: 0, pfl: 0, cueMix: 0.5, mtOut: 1, swing: 50, pzQ: 0, brakeBeats: 0, mtOn: 0, mtMode: 0, mtHold: 0, mtVol: -12,
  mfxType: 0, mfxAmt: 0, keyThresh: 0.3, keySoft: 0.1, camBlur: 0.6, camOver: 1, camShake: 0.7 };
// where a row's value lives: the page only (the record's side, the tempo range, the picture's colours: deckui.js /
// mixState), the mix (both decks: the JSFX takes deck A's), else the deck's engine (ui.set)
const PAGE_KEYS = ['recSide', 'range', 'padSel', 'vmute', 'tintDark', 'tintLight', 'vhsColor', 'vhsOsd'];
const MIX_KEYS = ['mfxType', 'mfxAmt', 'keyThresh', 'keySoft', 'camBlur', 'camOver', 'camShake'];
const MT_KEYS = ['mtOn', 'mtMode', 'mtHold', 'mtVol', 'mtOut'];
const setupVal = (d, k) => (k === 'pfl' ? (app.decks[d].s || {}).pfl : k === 'cueMix' ? app.cueMixV : k === 'mtOn' ? (app.decks[d].s || {}).mtOn : MT_KEYS.includes(k) ? app.decks[0].p[k] : MIX_KEYS.includes(k) ? app.mix && app.mix[k] : app.decks[d].p[k])
  ?? (k === 'xfSide' ? d + 1 : SETUP_DEF[k]);
function setupSet(d, k, v) {
  const ui = app.decks[d];
  if (k === 'cueMix') { app.cueMixV = v; if (app.node) app.node.port.postMessage({ t: 'cueMix', v }); return; }
  if (k === 'cueDev' && v === 'ask') {
    navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => { s.getTracks().forEach((tr) => tr.stop()); showSetup(d, 'cueMix'); }, () => ui.status(t('cueFail')));
    return;
  }
  if (k === 'cueDev') { routeCue(v); return; }
  if (MT_KEYS.includes(k)) {   // (the metronome's settings are deck A's, as in the JSFX; each deck's on / off in mode 2)
    if (k === 'mtOn' && (app.decks[0].p.mtMode || 0) === 2) ui.set({ mtOn: v });
    else { app.decks[0].p[k] = v; app.send({ d: 0, t: 'call', f: 'mtPut', a: [k, v] }); }
  } else if (MIX_KEYS.includes(k)) {
    app.mix[k] = v;
    if (k === 'mfxType' || k === 'mfxAmt') for (const u of app.decks) u.set({ [k]: v });   // (its sound on both decks)
  } else if (PAGE_KEYS.includes(k)) ui.p[k] = v;
  else ui.set({ [k]: v });
  if (k === 'padSel') { app.send({ d, t: 'call', f: 'setPadMode', a: [PAD_MODES[v]] }); padShift[d].clear(); ui.status(`pads: ${PAD_NAMES[v]}`); }
  if (app.fxSync) app.fxSync(d);
}
// the setup's numbers in groups that fold up (user's request 2026-10-21). One open at a time (with the phone's effects
// panel in the same dialog): opening one folds the others. On opening: the effects (phone) or the first group, or the
// group of the number asked for (user's choice 2026-10-21)
const SETUP_GROUPS = [['g_tempo', ['bpm', 'grid', 'range', 'swing', 'pzQ']], ['g_platter', ['recSide', 'brake', 'brakeBeats', 'startT', 'spinRel', 'sbSpeed', 'sbTime']],
  ['g_xf', ['xfSide', 'cutIn', 'fadeW', 'xfCurve', 'mute', 'vmute']], ['g_pads', ['padSel', 'holdMs', 'spt']],
  ['g_sound', ['agOn', 'agTarget', 'fxSound', 'echoLen', 'echoFb', 'vibStep', 'vibWidth', 'gateStep', 'fltRes', 'fltMorph', 'discTone']],
  ['g_video', ['lfoShape', 'lfoRate', 'lfoDepth', 'tintDark', 'tintLight', 'vhsColor', 'vhsOsd']],
  ['g_mix', ['mfxType', 'mfxAmt', 'keyThresh', 'keySoft', 'camBlur', 'camOver', 'camShake']],
  ['g_metro', ['mtOn', 'mtMode', 'mtHold', 'mtVol']], ['g_cue', ['cueDev', 'pfl', 'cueMix', 'mtOut']], ['g_midi', []]];
// the MIDI that came last (the setup's MIDI group shows it; ⚪205)
const heard = [];
app.midiHeard = (data, src) => {
  if (data[0] >= 0xf0) return;
  heard.unshift(`${midiWords(data)}   ${src}`);
  if (heard.length > 8) heard.length = 8;
  const el = document.querySelector('#midiMon');
  if (el) el.textContent = heard.join('\n');
};
const escH = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;');
function midiGroup(d) {
  const p = app.midiPresetOf ? app.midiPresetOf(d) : null;
  return `<p class="note">${app.midiPresetOf ? `${t('midiUsed')}: <b>${p ? escH(p.name) : '—'}</b>` : t('lnNoMidi')}</p>
    <pre id="midiMon" class="mono">${heard.length ? escH(heard.join('\n')) : t('midiMonEmpty')}</pre>
    <div class="lnrow"><button id="sLearn">Learn</button><button id="sMore">More</button><button id="sLoadPreset">Load preset file</button>${p && p.maker === 'user' ? '<button id="sDelPreset">Delete user preset</button>' : ''}</div>
    <p class="note">${t('midiLearnHint')}</p><p id="sMidiMsg" class="note"></p>`;
}
function showSetup(d, focus) {
  $('#setupTitle').textContent = `${t('setupTitle')} ${d ? 'B' : 'A'}`;
  const row = ([k, lo, hi, st]) => (hi === 'n'
    ? `<label><span>${t('s_' + k)}</span><select data-k="${k}" data-n="1">${lo.map((o, i) => `<option value="${i}"${+setupVal(d, k) === i ? ' selected' : ''}>${o}</option>`).join('')}</select></label>`
    : Array.isArray(lo)   // (a choice: a select)
    ? `<label><span>${t('s_' + k)}</span><select data-k="${k}">${lo.map((o) => `<option value="${o}"${setupVal(d, k) === o ? ' selected' : ''}>${t('o_' + o)}</option>`).join('')}</select></label>`
    : `<label><span>${t('s_' + k)}</span><input type="number" data-k="${k}" min="${lo}" max="${hi}" step="${st}" value="${setupVal(d, k)}"></label>`);
  const fxp = $('#setup .fxpanel');
  const grp = (f) => (SETUP_GROUPS.find(([g, ks]) => g === f || ks.includes(f)) || SETUP_GROUPS[0])[0];
  const first = focus ? grp(focus) : fxp ? null : SETUP_GROUPS[0][0];
  $('#setupBody').innerHTML = SETUP_GROUPS.map(([g, ks]) => `<details class="sgroup" data-g="${g}"${g === first ? ' open' : ''}>
    <summary>${t(g)}</summary><div class="form">${g === 'g_midi' ? midiGroup(d) : ks.map((k) => (k === 'cueDev' ? `<label><span>${t('s_cueDev')}</span><select data-k="cueDev" id="cueDev"></select></label>` : row(SETUP.find((x) => x[0] === k)))).join('')}</div></details>`).join('');
  cueChoices().then((list) => { const el = $('#cueDev'); if (el) { el.innerHTML = list.map(([v, n]) => `<option value="${escH(v)}"${v === app.cueOut ? ' selected' : ''}>${escH(n)}</option>`).join(''); } });
  if (fxp) fxp.open = !first;
  const all = [...$('#setup').querySelectorAll('.sgroup, .fxpanel')];
  all.forEach((el) => { el.ontoggle = () => { if (el.open) all.forEach((o) => { if (o !== el) o.open = false; }); }; });
  $('#setupBody').querySelectorAll('input[data-k]').forEach((inp) => inp.addEventListener('change', () => {
    const k = inp.dataset.k, v = Math.max(+inp.min, Math.min(+inp.max, +inp.value || 0));
    inp.value = v;
    setupSet(d, k, v);
  }));
  // (the record's side is the page's alone: deckui.js mirrored)
  $('#setupBody').querySelectorAll('select').forEach((sel) => sel.addEventListener('change', () => setupSet(d, sel.dataset.k, sel.dataset.n ? +sel.value : sel.value)));
  const on = (id, f) => { const el = $(`#setupBody ${id}`); if (el) el.addEventListener('click', f); };
  on('#sLearn', () => { $('#setup').close(); app.openLearn(d); });
  on('#sMore', () => { $('#setup').close(); app.openMore(d); });
  on('#sLoadPreset', () => { const f = $('#presetFile'); f.dataset.d = d; f.click(); });
  on('#sDelPreset', () => { app.midiUserDel(app.midiPreset[d]); showSetup(d, 'g_midi'); });
  $('#setup').showModal();
  if (focus) { const f = $(`#setupBody input[data-k="${focus}"]`); if (f) { f.focus(); f.select(); } }
}

function applyLang() {
  document.documentElement.lang = getLang();
  document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t(el.dataset.t); });
  document.title = t('title');
}

// the decks at whole device pixels per deck pixel: a deck shown a little smaller than 744 (738 in two columns on a
// 1920 screen) lost whole rows and columns to the pixelated scaling, and the 2-row descenders of "play" and "pitch"
// looked cut (user's report 2026-10-20). Narrower than 744 device px: smooth scaling. No translate to put it on the
// pixel grid: Chrome already paints it there, and a half-pixel translate made the nearest pixel flip between rows by
// area ("jitter" read "jittar", "wsola" "wsula", user's screenshot 2026-10-20)
function fitDecks() {
  if (MOBILE) { fitMobile(); return; }
  const dpr = window.devicePixelRatio || 1, decks = document.querySelectorAll('canvas.deck');
  // the grid's column as wide as a deck of whole device pixels, two side by side when they fit: at 125 % and 150 %
  // the column asked for 744 CSS px and the decks went one under the other (found 2026-10-20)
  const main = $('main'), mcs = getComputedStyle(main);
  const inner = main.clientWidth - parseFloat(mcs.paddingLeft) - parseFloat(mcs.paddingRight);
  const kTwo = Math.floor((inner - 12) / 2 * dpr / 744 + 1e-6), kOne = Math.floor(inner * dpr / 744 + 1e-6);
  const kWant = Math.min(Math.max(1, Math.round(dpr)), kTwo >= 1 ? kTwo : kOne);
  const dw = `${kWant >= 1 ? 744 * kWant / dpr : 744}px`;
  if (main.style.getPropertyValue('--deckw') !== dw) main.style.setProperty('--deckw', dw);
  app.sideBySide = kTwo >= 1;   // (the two decks in one row: each record on its outer side, deckui.js mirrored)
  const col = parseFloat(getComputedStyle(decks[0].parentElement).gridTemplateColumns) || 744;   // the grid column (CSS px)
  const k = Math.min(Math.max(1, Math.round(dpr)), Math.floor(col * dpr / 744 + 1e-6));
  for (const cv of decks) {
    const w = k >= 1 ? `${744 * k / dpr}px` : '100%', ir = k >= 1 ? 'pixelated' : 'auto';
    if (cv.style.width !== w) cv.style.width = w;
    if (cv.style.imageRendering !== ir) cv.style.imageRendering = ir;
  }
  // the picture as large as leaves the first row of decks on the screen, 16:9 between 640 x 360 and 960 x 540
  // (at 960 x 540 the decks' bottom went past the window's: user's report 2026-10-20)
  const wrap = $('.stage-wrap'), sh = stage.getBoundingClientRect().height, dk = decks[0].getBoundingClientRect();
  const rest = dk.bottom + window.scrollY - sh;   // what is above the decks' bottom besides the picture
  const h = Math.max(360, Math.min(540, window.innerHeight - rest - 8));
  const mw = `${Math.floor(h / 9) * 16}px`;   // (a multiple of 16: the height a whole number)
  if (wrap.style.maxWidth !== mw) wrap.style.maxWidth = mw;
}

// the phone: the short deck as wide as fits in whole device pixels per deck pixel (or nearly the width, unevenly
// doubled rows hardly show at 2x and more; below 1x smooth), then the picture gets the height that is left
function fitMobile() {
  // on its side the column was 390 high: the deck shrank to 160 wide and still ran off the screen. Then: the picture and
  // the crossfader on the left, the tabs and the deck as high as the screen allows on the right (css body.mobile.land)
  const land = window.innerWidth > window.innerHeight * 1.2;
  document.body.classList.toggle('land', land); app.sideBySide = land;
  showDeck();
  if (land) { fitMobileLand(); return; }
  stage.style.width = '';
  const dpr = window.devicePixelRatio || 1, main = $('main'), cs = getComputedStyle(main);
  const availW = main.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const deckW = app.decks[0].W, deckH = app.decks[0].H, r = availW * dpr / deckW, k = Math.floor(r);
  let w = availW, ir = 'pixelated';
  if (k >= 1 && k * deckW / dpr >= availW * 0.85) w = k * deckW / dpr;
  else if (r < 1) ir = 'auto';
  w = Math.min(w, deckW * 3);
  for (const cv of document.querySelectorAll('canvas.deck')) { cv.style.width = `${w}px`; cv.style.imageRendering = ir; }
  const gap = parseFloat(cs.rowGap) || 0, tip = $('#mobileTip'), others = [$('header'), $('.decktabs'), $('.xf-row'), $('.privacy'), tip];
  const used = others.reduce((a, el) => a + el.offsetHeight, 0) + w * deckH / deckW + gap * (tip.offsetHeight ? 5 : 4) + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  const h = Math.max(90, Math.min(availW * 9 / 16, window.innerHeight - used - 2));
  stage.style.height = `${Math.floor(h)}px`;
  let over = document.documentElement.scrollHeight - window.innerHeight;   // (what the sum missed: margins, rounding)
  if (over > 0) { const h2 = Math.max(90, Math.floor(h - over)); over -= Math.floor(h) - h2; stage.style.height = `${h2}px`; }
  if (over > 0) {   // a short screen: the deck smaller too
    w = Math.max(160, w - over * deckW / deckH);
    for (const cv of document.querySelectorAll('canvas.deck')) { cv.style.width = `${w}px`; cv.style.imageRendering = w * dpr >= deckW * 1.5 ? 'pixelated' : 'auto'; }
  }
}
function fitMobileLand() {
  // the two decks as high as the screen allows (each at most 32 % of the width), the picture in what is left between
  const dpr = window.devicePixelRatio || 1, main = $('main'), cs = getComputedStyle(main);
  const deckW = app.decks[0].W, deckH = app.decks[0].H, gap = parseFloat(cs.columnGap) || 0;
  const pads = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom), availW = main.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const top = $('header').offsetHeight + pads;
  let h = Math.max(120, window.innerHeight - top - 2), w = Math.min(h * deckW / deckH, availW * 0.32);
  const k = Math.floor(w * dpr / deckW); if (k >= 1 && k * deckW / dpr >= w * 0.85) w = k * deckW / dpr;
  for (const cv of document.querySelectorAll('canvas.deck')) { cv.style.width = `${w}px`; cv.style.imageRendering = w * dpr >= deckW ? 'pixelated' : 'auto'; }
  const mid = availW - 2 * (w + gap), sh = Math.max(90, Math.min(mid * 9 / 16, window.innerHeight - top - $('.xf-row').offsetHeight - gap - 2));
  stage.style.height = `${Math.floor(sh)}px`; stage.style.width = `${Math.floor(Math.min(mid, sh * 16 / 9))}px`;
}

// the phone: only the active deck shows, its tab lit; on its side both (the one touched last is the active one)
function showDeck() {
  const both = document.body.classList.contains('land');
  document.querySelectorAll('canvas.deck').forEach((cv, i) => { cv.style.display = both || i === app.active ? 'block' : 'none'; });
  document.querySelectorAll('.decktabs [data-deck]').forEach((b) => b.classList.toggle('on', +b.dataset.deck === app.active));
}

// the active deck's sample saved as an MJPEG AVI (js/aviwrite.js): the JPEG frames made here and the sound, for a
// browser that cannot read a video's picture (Firefox on Android) or for loading it again at once (user's request 2026-10-21)
app.saveAvi = (d = app.active) => {
  const ui = app.decks[d], k = ui.cur, x = ui.slotAudio[k], fs = app.frames[d][k];
  if (!x || !fs || fs.f === app.speaker) { ui.status(t('aviNoVideo')); return null; }
  const fr = fs.f;
  for (let i = 0; i < fr.n; i++) if (!fr.blobs[i]) { ui.status(t('aviNotReady')); return null; }
  let blob;
  try { blob = writeAvi(fr, x.audio); } catch (e) { ui.status(e.code === 'avitoobig' ? t('aviTooBig') : `${t('readFail')}: ${e.message || e}`); return null; }
  const name = `${x.name.replace(/\.[^.]*$/, '').replace(/_mjpeg$/, '')}_mjpeg.avi`;
  const a = document.createElement('a'), url = URL.createObjectURL(blob);
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  ui.status(`${t('aviSaved')}: ${name} (${Math.round(blob.size / 1048576)} MB)`);
  return blob;
};


// ---------- the headphone cue (⚪205): the worklet's second output (engine/processor.js: the decks with pfl on, mixed
// with the main by cueMix) to a second output device (an <audio> on a MediaStream, setSinkId) or to channels 3/4 .. of
// the main device when it has them (UCX II: phones = 7/8). The setup's Headphones group chooses; kept in this browser
const CUE_LS = 'rsw_cue_out';
let cueEl = null, cueDest = null, cueMerge = null, cueIn = null;
const cueInNode = () => { if (!cueIn) { cueIn = new GainNode(app.ctx); app.node.connect(cueIn, 1); } return cueIn; };
// where the file list's preview goes: the cue when one is chosen, else the main (files.js)
app.cueInput = () => (app.cueOut === 'off' ? app.mainOut : cueInNode());
app.cueOut = (() => { try { return localStorage.getItem(CUE_LS) || 'off'; } catch (e) { return 'off'; } })();
async function routeCue(v) {
  app.cueOut = v;
  try { localStorage.setItem(CUE_LS, v); } catch (e) { /* storage blocked */ }
  if (!app.ctx) return;
  const cin = cueInNode();
  try { cin.disconnect(); } catch (e) { /* not connected */ }
  if (cueMerge) { cueMerge.disconnect(); cueMerge = null; }
  if (cueEl) { cueEl.pause(); cueEl.srcObject = null; }
  const dst = app.ctx.destination;
  if (v === 'off') { dst.channelCount = 2; app.mainOut.connect(dst); return; }
  const ch = /^ch(\d+)$/.exec(v);
  if (ch) {   // the main device's channels: main 1/2, the cue at ch / ch + 1
    const n = Math.min(dst.maxChannelCount, 32), c = +ch[1] - 1;
    dst.channelCount = n; dst.channelCountMode = 'explicit'; dst.channelInterpretation = 'discrete';
    cueMerge = new ChannelMergerNode(app.ctx, { numberOfInputs: n });
    const sm = new ChannelSplitterNode(app.ctx, { numberOfOutputs: 2 }), sc = new ChannelSplitterNode(app.ctx, { numberOfOutputs: 2 });
    try { app.mainOut.disconnect(dst); } catch (e) { /* not connected */ }
    app.mainOut.connect(sm); sm.connect(cueMerge, 0, 0); sm.connect(cueMerge, 1, 1);
    cin.connect(sc); sc.connect(cueMerge, 0, c); sc.connect(cueMerge, 1, c + 1);
    cueMerge.connect(dst);
    return;
  }
  dst.channelCount = 2; app.mainOut.connect(dst);
  if (!cueDest) cueDest = app.ctx.createMediaStreamDestination();
  cin.connect(cueDest);
  if (!cueEl) { cueEl = new Audio(); cueEl.autoplay = true; }
  cueEl.srcObject = cueDest.stream;
  try { if (cueEl.setSinkId) await cueEl.setSinkId(v); await cueEl.play(); } catch (e) { app.decks[app.active].status(`${t('cueFail')}: ${e.message || e}`); }
}
app.routeCue = routeCue;
// the choices: off, the main device's channel pairs past 1/2, the other output devices (names when the browser gives them)
async function cueChoices() {
  const out = [['off', t('cueOff')]];
  const max = app.ctx ? app.ctx.destination.maxChannelCount : 2;
  for (let c = 3; c + 1 <= max && c <= 15; c += 2) out.push([`ch${c}`, `${t('cueMainDev')} ${c}/${c + 1}`]);
  try {
    const devs = (await navigator.mediaDevices.enumerateDevices()).filter((x) => x.kind === 'audiooutput' && x.deviceId !== 'default' && x.deviceId !== 'communications');
    devs.forEach((x, i) => out.push([x.deviceId, x.label || `${t('cueDevice')} ${i + 1}`]));
    // Chrome lists the other outputs only to a page allowed the microphone: a choice that asks once (nothing is recorded)
    if (!devs.length || !devs[0].label) out.push(['ask', t('cueAsk')]);
  } catch (e) { /* no device list */ }
  return out;
}

// ---------- recording a take (⚪205, takerec.js): the stage and the main sound into a video file ----------
let take = null, takeTimer = 0;
app.toggleTake = async () => {
  const b = $('#recTake'), ui = app.decks[app.active];
  if (!take) {
    await startAudio();
    try { take = startTake(stage, app.ctx, app.node); app.taking = true; } catch (e) { ui.status(`${t('takeFail')}: ${e.message || e}`); return; }
    b.classList.add('rec');
    const tick = () => { const s = Math.floor(take.sec()); b.textContent = `■ ${t('takeStop')} ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
    tick(); takeTimer = setInterval(tick, 500);
    return;
  }
  clearInterval(takeTimer);
  const tk = take; take = null; app.taking = false;
  b.classList.remove('rec'); b.textContent = t('takeRec');
  const { blob, ext, sec } = await tk.stop();
  const d = new Date(), z = (n) => String(n).padStart(2, '0');
  const name = `reascratch_take_${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}_${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}.${ext}`;
  const a = document.createElement('a'), url = URL.createObjectURL(blob);
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  ui.status(`${t('aviSaved')}: ${name} (${sec.toFixed(1)} s, ${Math.round(blob.size / 1048576)} MB)`);
};

// ---------- start ----------
function showTip(key) {
  const tip = $('#mobileTip');
  tip.dataset.t = key;
  tip.textContent = t(key);   // (the language was put on the page before; switching it later follows data-t)
}

async function main() {
  applyLang();
  $('#langBtn').addEventListener('click', () => { setLang(getLang() === 'ja' ? 'en' : 'ja'); applyLang(); });
  $('#saveAvi').addEventListener('click', () => app.saveAvi());
  // NI Traktor Kontrol S2 / S3 / S4 through WebHID (hid.js = the kit's HID bridge, ⚪205): read as the bridge's MIDI
  if (navigator.hid && !MOBILE) $('#hidBtn').hidden = false;
  $('#hidBtn').addEventListener('click', async () => {
    const ui = app.decks[app.active];
    if (!app.midiFeed) { ui.status(t('lnNoMidi')); return; }
    try {
      const dev = await connectHid((bytes, name) => app.midiFeed(bytes, name), (m) => ui.status(`HID: ${m}`));
      if (!dev) return;
      app.hidAdd(dev.name, (bytes) => dev.lights(bytes));
      navigator.hid.addEventListener('disconnect', (e) => { if (e.device === dev.device) app.hidRemove(dev.name); });
      ui.status(`HID: ${dev.name}`);
    } catch (e) { ui.status(`HID: ${e.message || e}`); }
  });
  if (canRecordTake()) $('#recTake').addEventListener('click', () => app.toggleTake()); else $('#recTake').remove();
  await loadImages(new URL('../assets', import.meta.url).href);
  document.body.classList.toggle('mobile', MOBILE);
  const mode = MOBILE ? 'mobile' : 'full';
  app.decks = [new DeckUI($('#deckA'), 0, app, mode), new DeckUI($('#deckB'), 1, app, mode)];
  if (MOBILE) {
    showDeck();
    document.querySelectorAll('.decktabs [data-deck]').forEach((b) => b.addEventListener('click', () => app.setActive(+b.dataset.deck)));
    $('#loadActive').addEventListener('click', () => app.openFile(app.active));
    // setup on the phone (user's request 2026-10-21: to change the blend): the active deck's setup, with the effects
    // panel (blend / transition, each deck's video FX and sound) moved into the same dialog, at its top (the first
    // thing to take the focus: a number box there brought up the phone's keyboard)
    $('#setup').insertBefore(document.querySelector('.fxpanel'), $('#setupBody'));
    $('#mSetup').addEventListener('click', () => app.showSetup(app.active));
    stagePad();
    // a tip on Android (user's request 2026-10-20): Firefox shows a video's picture only from an MJPEG AVI. Chrome's tip
    // (open in Firefox) waits for the sound's delay (startAudio)
    if (/Android/.test(navigator.userAgent) && /Firefox\//.test(navigator.userAgent)) showTip('tipFirefox');
    // MIDI on the phone (a USB controller through an OTG adapter, Android Chrome): asked for only when this button is
    // pressed; each device by its name with its own preset. No Web MIDI (iPhone): no button
    const mb = $('#midiBtn');
    if (!navigator.requestMIDIAccess || /[?&]nomidi=1/.test(location.search)) mb.remove();
    else mb.addEventListener('click', () => {
      if (mb.classList.contains('on')) return;
      mb.classList.add('on');
      initMidi(app, (msg) => { mb.title = msg; app.decks[app.active].status(msg); });
    });
  }
  fitDecks(); window.addEventListener('resize', fitDecks); new ResizeObserver(() => fitDecks()).observe($('header'));
  // the window moved to a screen of another scale without a resize: fit again (and watch the new scale)
  const watchDpr = () => window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener('change', () => { fitDecks(); watchDpr(); }, { once: true });
  watchDpr();
  // the phone: the visible height changes with the address bar and the browser's own bars, not always with a resize
  // (a band left empty under the crossfader, user's screenshot 2026-10-20): fit again then, and every second
  if (MOBILE) { if (window.visualViewport) window.visualViewport.addEventListener('resize', fitDecks); setInterval(fitDecks, 1000); }
  app.decks[0].set({ xfSide: 1 }); app.decks[1].set({ xfSide: 2 });
  app.decks[1].lamp = '#4fb3e0';
  initFxPanel(app, $('#fxPanel'));
  initLearn(app);
  initFiles(app, { loadFile, curSlot, emptySlot: (d) => { const ui = app.decks[d]; for (let k = 0; k < 8; k++) if (!ui.slotAudio[k]) return k; return curSlot(d); } });
  initMore(app);
  for (const d of [0, 1]) app.decks[d].onPad = (k, dn, sh) => screenPad(d, k, dn, sh);
  // a .reascratch-preset file chosen on the setup's MIDI group (⚪205)
  $('#presetFile').addEventListener('change', async (e) => {
    const f = e.target.files[0], d = +e.target.dataset.d || 0;
    e.target.value = '';
    if (!f) return;
    let m;
    try { m = await app.loadPresetFile(f, d); } catch (err) { m = t('lnBadFile'); }
    app.decks[d].status(m);
    if ($('#setup').open) { showSetup(d, 'g_midi'); const el = $('#sMidiMsg'); if (el) el.textContent = m; }
  });
  $('#xf').addEventListener('input', (e) => app.setXf(e.target.value / 1000));
  // two taps (or a double-click) on the crossfader within 350 ms: back to the middle (user's request 2026-10-21). Set
  // once the second tap's own move has come. Only short touches count (a drag is not a tap)
  let xfTap = 0, xfDown = 0;
  $('#xf').addEventListener('pointerdown', () => { xfDown = performance.now(); });
  $('#xf').addEventListener('pointerup', () => {
    const now = performance.now();
    if (now - xfDown > 250) { xfTap = 0; return; }
    if (now - xfTap < 350) { xfTap = 0; setTimeout(() => app.setXf(0.5), 0); } else xfTap = now;
  });
  $('#file').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) loadFile(app.fileDeck || 0, f, app.fileSlot); e.target.value = ''; });
  for (const [sel, d] of [['#deckA', 0], ['#deckB', 1]]) {
    const el = $(sel);
    el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('drop'); });
    el.addEventListener('dragleave', () => el.classList.remove('drop'));
    el.addEventListener('drop', async (e) => {
      e.preventDefault(); el.classList.remove('drop');
      const fs = await droppedFiles(e.dataTransfer);
      if (!fs.length) return;
      app.setActive(d); loadFile(d, fs[0]);
      if (fs.length > 1) app.filesAdd(fs);   // (a folder or several files: the rest in the file list, ⚪205)
    });
  }
  document.querySelectorAll('[data-load]').forEach((b) => b.addEventListener('click', () => app.openFile(+b.dataset.load)));
  if (canCapture()) $('#capGrp').hidden = false;
  if (canCapture()) document.querySelectorAll('[data-capture]').forEach((b) => { b.addEventListener('click', () => captureTab(+b.dataset.capture)); });
  document.querySelectorAll('dialog .close').forEach((b) => b.addEventListener('click', closeDialogs));
  window.addEventListener('keydown', (e) => onKey(e, true));
  window.addEventListener('keyup', (e) => onKey(e, false));
  window.addEventListener('blur', () => { for (const c of held) onKey({ code: c, target: document.body, preventDefault() {} }, false); });
  $('#startBtn').addEventListener('click', async () => { await startAudio(); $('#startOverlay').hidden = true; });
  document.addEventListener('pointerdown', () => startAudio().then(() => { $('#startOverlay').hidden = true; }), { once: true });
  // the overlay covers the whole page: a first press on a button under it (Load the demo, Load a file ...) reached only the
  // overlay, and the button did nothing (found by the preview session, 2026-10-21). The press that takes the overlay away
  // also presses the button, link or control under it (in the same click: a file chooser still opens)
  // (the overlay may already be gone when the button is let go: the click then lands on what holds both, so the press is
  // marked when it starts on the overlay and the click that follows is passed on)
  let ovPress = false;
  document.addEventListener('pointerdown', (e) => { ovPress = !!(e.target.closest && e.target.closest('#startOverlay') && !e.target.closest('#startBtn')); }, { capture: true, once: true });
  document.addEventListener('click', (e) => {
    if (!ovPress) return;
    ovPress = false;
    $('#startOverlay').hidden = true;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const c = el && el.closest('button, a, summary, label, select, input');
    if (c && !c.contains(e.target)) c.click();
  }, { capture: true });
  // ?nomidi=1: automated tests leave the MIDI devices alone; the phone has no MIDI row (no permission asked)
  if (!MOBILE && !/[?&]nomidi=1/.test(location.search)) initMidi(app, (msg) => { $('#midiStatus').textContent = msg; });
  try {
    const r = await fetch(new URL('../demo/demo.json', import.meta.url), { cache: 'no-store' });
    if (r.ok) {
      const demo = await r.json();
      const b = $('#demoBtn'); b.hidden = false;
      // both decks at once; a file on both decks is fetched, decoded and made into frames once (the two decks share
      // the frames; the demo took 8 s on a phone, two times 3.7 s of frames one after the other, user's report 2026-10-20)
      b.addEventListener('click', async () => {
        await startAudio();
        // the demo's two pictures are made to be added (the stars over the turbines' black sky): blend Add
        // (user's choice 2026-10-21)
        if (app.mix) { app.mix.blend = 1; if (app.fxSync) app.fxSync(0); }
        // how long each step took (?diag=1 shows it: the demo took about 6 s on a phone, user's report 2026-10-21)
        const t0 = performance.now(), ms = () => Math.round(performance.now() - t0);
        const files = new Map();
        const one = (name) => {
          if (!files.has(name)) {
            const x = { uis: [], hooks: [], early: null };
            x.ready = (async () => {
              const blob = await (await fetch(new URL(`../demo/${name}`, import.meta.url))).blob();
              frameLog(`demo ${name}: fetched ${ms()} ms`);
              const file = new File([blob], name, { type: blob.type });
              if (isAvi(file)) {   // (an MJPEG AVI: frames and sound straight from the file, js/avi.js)
                const r = await readAvi(file);
                frameLog(`demo ${name}: read ${ms()} ms`);
                x.a = r.a; x.early = r.fr; x.frames = Promise.resolve(r.fr);
              } else x.a = await decodeAudio(app.ctx, file);
              if (!x.frames && isVideo(file)) {
                x.frames = readFrames(file, (p) => x.uis.forEach((u) => u.status(`${t('reading')} ${t('frames')}: ${Math.round(p * 100)}%`)),
                  (fr) => { x.early = fr; x.hooks.forEach((h) => h(fr)); });   // (kept: a fallback to seeking sends another)
              }
            })();
            files.set(name, x);
          }
          return files.get(name);
        };
        await Promise.all(demo.decks.map(async (f, d) => {
          const x = one(f.file), ui = app.decks[d];
          x.uis.push(ui);
          app.loading[d] = `${t('reading')}: ${f.file}`;
          try {
            await x.ready;
            await loadDecoded(d, slotFor(d), x.a, f.file, x.frames ? async (early) => { x.hooks.push(early); if (x.early) early(x.early); return x.frames; } : null,
              f.bpm ? { bpm: f.bpm, grid: f.grid || 0 } : null);
            frameLog(`demo deck ${'AB'[d]}: ready ${ms()} ms`);
          } catch (e) { console.error(e); app.loading[d] = ''; ui.status(e && e.code === 'nopicture' ? t('noPicture') : `${t('readFail')}: ${e.message || e}`); }
        }));
      });
    }
  } catch (e) { /* no demo */ }
  requestAnimationFrame(frameLoop);
  // ?diag=1: the delays as numbers on top of the page (js/diag.js)
  if (/[?&]diag=[12]/.test(location.search)) import('./diag.js').then((m) => m.startDiag(app));
}
main();

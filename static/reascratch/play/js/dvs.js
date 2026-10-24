// ReaScratch Web — DVS on the page (⚪209): each deck's timecode input (an audio input of the computer: an audio
// interface's stereo pair where the turntable / CDJ, or the Pioneer DJ PLX-CRSS12's PHONO OUT, comes in) goes into the
// engine node's input 0 / 1; the reading itself is engine/dvs.js in the worklet. The choices are kept in the browser.

const KEY = 'rsDvs';
const DEF = { dev: 'off', tc: 0, rpm45: 0, rev: 0, thrDb: -50 };
let cfg = [{ ...DEF }, { ...DEF }];
try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (Array.isArray(v)) cfg = [0, 1].map((i) => ({ ...DEF, ...(v[i] || {}) })); } catch (e) { /* none kept */ }
const live = [null, null];      // {stream, src} while a deck reads
export const dvsState = [[0, -150], [0, -150]];   // [speed, level dB] from the worklet

function keep() { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) { /* not kept */ } }
export function dvsCfg(d) { return cfg[d]; }

// the audio inputs: [value, name]; 'off' first; 'ask' while the browser hides the names (before the microphone is allowed)
export async function dvsChoices(t) {
  const out = [['off', t('dvsOff')]];
  try {
    const devs = (await navigator.mediaDevices.enumerateDevices()).filter((x) => x.kind === 'audioinput' && x.deviceId !== 'communications');
    devs.forEach((x, i) => out.push([x.deviceId, x.label || `${t('dvsInput')} ${i + 1}`]));
    if (!devs.length || !devs[0].label) out.push(['ask', t('dvsAsk')]);
  } catch (e) { /* no device list */ }
  return out;
}

function post(app, d) {
  const c = cfg[d];
  const m = { t: 'dvs', d, p: { on: live[d] ? 1 : 0, tc: c.tc, rpm45: c.rpm45, rev: c.rev, thrDb: c.thrDb } };
  if (app.node) app.node.port.postMessage(m); else app.queue.push(m);
}

async function stop(app, d) {
  const l = live[d]; live[d] = null;
  if (l) { try { l.src.disconnect(); } catch (e) { /* gone */ } l.stream.getTracks().forEach((x) => x.stop()); }
  post(app, d);
}

// start (or restart) deck d's input from its kept choice; returns '' or a message why not
async function start(app, d) {
  await stop(app, d);
  const dev = cfg[d].dev;
  if (dev === 'off' || !app.ctx || !app.node) return '';
  let stream;
  try {
    // the browser's voice processing would bend the tone: all off, two channels
    stream = await navigator.mediaDevices.getUserMedia({ audio: {
      deviceId: dev && dev !== 'default' ? { exact: dev } : undefined, channelCount: { ideal: 2 },
      echoCancellation: false, noiseSuppression: false, autoGainControl: false, latency: 0 } });
  } catch (e) { return 'fail'; }
  const src = new MediaStreamAudioSourceNode(app.ctx, { mediaStream: stream });
  src.connect(app.node, 0, d);
  live[d] = { stream, src };
  post(app, d);
  const s = stream.getAudioTracks()[0] && stream.getAudioTracks()[0].getSettings();
  return s && s.channelCount === 1 ? 'mono' : '';
}

// a setting changed (k in DEF): kept, and the worklet / the input follow. Returns a promise of '' or 'fail' / 'mono'
export async function dvsSet(app, d, k, v) {
  if (k === 'dev' && v === 'ask') {   // (lists the inputs' names: the permission once, nothing recorded)
    try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach((x) => x.stop()); } catch (e) { return 'fail'; }
    return 'asked';
  }
  cfg[d][k] = k === 'dev' ? v : Number(v);
  keep();
  if (k === 'dev') return start(app, d);
  post(app, d);
  return '';
}

// after the sound starts (the node exists): the kept inputs come back (the browser may ask for the microphone again)
export async function dvsResume(app) {
  for (const d of [0, 1]) if (cfg[d].dev !== 'off') await start(app, d);
}
export function dvsOn(d) { return !!live[d]; }

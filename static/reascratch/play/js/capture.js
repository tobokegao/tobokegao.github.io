// ReaScratch Web — taking in a video playing in another tab (YouTube, niconico ...) through Chrome's tab sharing (the
// screen-recording API): the shared tab is shown live, the video area is cut out (found by its motion, or dragged), the
// part played between "record" and "stop" is kept (picture frames as small JPEGs like a loaded file's, the sound
// recorded), then trimmed and loaded into a deck. Nothing is saved as a file; what is taken in is the user's to answer for.
import { JpegSink, sizeFor } from './media.js';

const FPS = 30, MAX_S = 600;

export const canCapture = () => !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia && window.MediaStreamTrackProcessor);

export async function openCapture(ctx) {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: FPS },
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    preferCurrentTab: false, selfBrowserSurface: 'exclude', surfaceSwitching: 'exclude', systemAudio: 'exclude',
  });
  const vt = stream.getVideoTracks()[0], at = stream.getAudioTracks()[0];
  if (!vt) { stream.getTracks().forEach((t) => t.stop()); throw new Error('no picture'); }
  const video = document.createElement('video');
  video.muted = true; video.playsInline = true; video.srcObject = new MediaStream([vt]);
  await video.play();
  const ended = new Promise((res) => { vt.addEventListener('ended', res); });
  const S = {
    video, ended, hasAudio: !!at,
    crop: null,   // [x, y, w, h] in the tab's pixels; null = all
    recording: false, t00: 0, last: -1,
    srcSize: () => [video.videoWidth || 1280, video.videoHeight || 720],
  };

  // the video area (findVideoArea below); nearly the whole tab (a video in full screen) = the whole tab
  S.autoCrop = async () => {
    const [W, H] = S.srcSize(), r = await findVideoArea(video, W, H);
    if (!r) return null;
    if (r[0] < W * 0.02 && r[1] < H * 0.02 && r[0] + r[2] > W * 0.98 && r[1] + r[3] > H * 0.98) { S.crop = null; return [0, 0, W, H]; }
    S.crop = r;
    return r;
  };

  // recording: the frames of the track by their time (cut to the crop), the sound through a recorder worklet
  let sink = null, blobs = [], reader = null, pump = null, rec = null, src = null, mute = null, chunks = [], aStart = -1, vStart = -1;
  S.record = async () => {
    const [W, H] = S.srcSize(), cr = S.crop || [0, 0, W, H];
    const [w, h] = sizeFor(cr[2], cr[3]);
    // the crop as parts of the frame: the shared tab's size can change (a window resized) after it was chosen
    sink = new JpegSink(w, h, S.crop ? [cr[0] / W, cr[1] / H, cr[2] / W, cr[3] / H] : null); blobs = []; S.size = [w, h];
    if (at) {
      await ctx.audioWorklet.addModule(new URL('./engine/recorder.js', import.meta.url));
      src = ctx.createMediaStreamSource(new MediaStream([at]));
      rec = new AudioWorkletNode(ctx, 'rs-recorder', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] });
      mute = new GainNode(ctx, { gain: 0 });
      src.connect(rec).connect(mute).connect(ctx.destination);
      rec.port.onmessage = (e) => { chunks.push(e.data); };
      aStart = performance.now();
    }
    S.recTrack = vt.clone();   // a copy of the track for the frames, the original keeps the live view going
    reader = new MediaStreamTrackProcessor({ track: S.recTrack }).readable.getReader();
    S.recording = true; S.t00 = performance.now();
    let t0 = -1;
    pump = (async () => {
      for (;;) {
        const { value: f, done } = await reader.read();
        if (done || !S.recording) { if (f) f.close(); break; }
        if (t0 < 0) { t0 = f.timestamp; vStart = performance.now(); }
        const i = Math.round((f.timestamp - t0) / 1e6 * FPS);
        if (i >= 0 && i < MAX_S * FPS && i >= S.last) { sink.put(f, blobs, i); S.last = i; }
        f.close();
        if (i >= MAX_S * FPS) break;
      }
    })();
  };
  S.elapsed = () => (S.recording ? (performance.now() - S.t00) / 1000 : 0);

  // stop recording: the take {a: {ch, rate, dur}, fr: {fps, n, w, h, dur, blobs}}
  S.stop = async () => {
    S.recording = false;
    try { await reader.cancel(); } catch (e) { /* already closed */ }
    await pump;
    S.recTrack.stop();
    if (rec) { rec.port.postMessage('stop'); await new Promise((r) => setTimeout(r, 150)); src.disconnect(); rec.disconnect(); mute.disconnect(); }
    await sink.chain; sink.done();
    const n = S.last + 1;
    for (let i = 1; i < n; i++) if (!blobs[i]) blobs[i] = blobs[i - 1];
    if (n < 1 || !blobs[0]) throw new Error('no picture frames');
    const dur = n / FPS, sr = ctx.sampleRate, total = chunks.reduce((s2, c) => s2 + c.l.length, 0);
    let L = new Float32Array(total), R = new Float32Array(total), o = 0;
    for (const c of chunks) { L.set(c.l, o); R.set(c.r, o); o += c.l.length; }
    if (aStart >= 0 && vStart >= 0) {   // line the sound up with the first frame
      const off = Math.round((vStart - aStart) / 1000 * sr);
      if (off > 0) { L = L.subarray(off); R = R.subarray(off); }
      else if (off < 0) { const pad = (x) => { const y = new Float32Array(x.length - off); y.set(x, -off); return y; }; L = pad(L); R = pad(R); }
    }
    const want = Math.round(dur * sr);
    const fit = (x) => { const y = new Float32Array(want); y.set(x.subarray(0, want)); return y; };
    const ch = at ? [fit(L), fit(R)] : [new Float32Array(want), new Float32Array(want)];
    sink = null; rec = null;
    return { a: { ch, rate: sr, dur }, fr: { fps: FPS, n, w: S.size[0], h: S.size[1], dur, blobs } };
  };
  // closing while recording (Cancel) stops the recording too: the copy of the track, the frame workers and the
  // recorder kept going for up to 10 minutes (found 2026-10-20)
  S.close = () => {
    if (S.recording || sink) {
      S.recording = false;
      if (reader) reader.cancel().catch(() => {});
      if (S.recTrack) S.recTrack.stop();
      if (rec) { try { src.disconnect(); rec.disconnect(); mute.disconnect(); } catch (e) { /* already apart */ } rec = null; }
      if (sink) { sink.done(); sink = null; }
    }
    stream.getTracks().forEach((t) => t.stop()); video.srcObject = null;
  };
  return S;
}

// the take from a to b seconds
export function trimTake(take, a, b) {
  const { fr } = take, sr = take.a.rate;
  const i0 = Math.max(0, Math.min(fr.n - 1, Math.floor(a * fr.fps))), i1 = Math.max(i0 + 1, Math.min(fr.n, Math.ceil(b * fr.fps)));
  const n = i1 - i0, dur = n / fr.fps, s0 = Math.round(i0 / fr.fps * sr), s1 = s0 + Math.round(dur * sr);
  const cut = (x) => { const y = new Float32Array(s1 - s0); y.set(x.subarray(s0, Math.min(s1, x.length))); return y; };
  return { a: { ch: take.a.ch.map(cut), rate: sr, dur }, fr: { ...fr, n, dur, blobs: fr.blobs.slice(i0, i1) } };
}

// the video area of a tab (W x H) shown in a <video>: watches 1.5 s, takes the box around what moved, then the rectangle
// around it of a usual video shape (16:9, 4:3 ...) with a straight edge on all four sides (the video's border against
// the page or the player's bars). Only the moving part was cut out before, and an anime's still background was left
// out (user's report 2026-10-20); with no such rectangle, each side of the box goes out to the strongest edge nearby
const ASPECTS = [16 / 9, 4 / 3, 1.85, 2, 2.39, 3 / 2, 1, 4 / 5, 3 / 4, 9 / 16];
export async function findVideoArea(video, W, H) {
  const cw = 200, ch = Math.max(2, Math.round(cw * H / W));
  const c = new OffscreenCanvas(cw, ch), g = c.getContext('2d', { willReadFrequently: true });
  const mov = new Float32Array(cw * ch); let prev = null;
  for (let n = 0; n < 16; n++) {
    g.drawImage(video, 0, 0, cw, ch);
    const d = g.getImageData(0, 0, cw, ch).data;
    if (prev) for (let i = 0; i < cw * ch; i++) {
      const k = i * 4, v = Math.abs(d[k] - prev[k]) + Math.abs(d[k + 1] - prev[k + 1]) + Math.abs(d[k + 2] - prev[k + 2]);
      if (v > 30) mov[i] += 1;
    }
    prev = d;
    await new Promise((r) => setTimeout(r, 100));
  }
  // the box around every point that moved (twice or more): columns mx0..mx1, rows my0..my1
  let mx0 = cw, my0 = ch, mx1 = -1, my1 = -1;
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) if (mov[y * cw + x] >= 2) { mx0 = Math.min(mx0, x); mx1 = Math.max(mx1, x); my0 = Math.min(my0, y); my1 = Math.max(my1, y); }
  if (mx1 - mx0 < 6 || my1 - my0 < 6) return null;
  const lum = (x, y) => { const k = (y * cw + x) * 4; return prev[k] + prev[k + 1] + prev[k + 2]; };
  const kx = W / cw, ky = H / ch;

  // edge strength 0-1 between neighbours (a step of 60 of the RGB sum or more = 1; the tab's own border 0.6),
  // summed along each line: PV = between columns x-1 and x, rows from the top; PH = between rows y-1 and y
  const es = (a, b) => Math.min(1, Math.abs(a - b) / 60);
  const PV = new Float32Array((cw + 1) * (ch + 1)), PH = new Float32Array((ch + 1) * (cw + 1));
  for (let x = 0; x <= cw; x++) for (let y = 0; y < ch; y++) PV[x * (ch + 1) + y + 1] = PV[x * (ch + 1) + y] + (x === 0 || x === cw ? 0.6 : es(lum(x, y), lum(x - 1, y)));
  for (let y = 0; y <= ch; y++) for (let x = 0; x < cw; x++) PH[y * (cw + 1) + x + 1] = PH[y * (cw + 1) + x] + (y === 0 || y === ch ? 0.6 : es(lum(x, y), lum(x, y - 1)));
  const sv = (x, a, b) => (PV[x * (ch + 1) + b] - PV[x * (ch + 1) + a]) / (b - a);
  const sh = (y, a, b) => (PH[y * (cw + 1) + b] - PH[y * (cw + 1) + a]) / (b - a);
  // the rectangle [x0, x1) x [y0, y1) holding the moving box, of a usual shape, with the strongest weakest side
  // (ties: the smaller one, e.g. a 4:3 picture inside the black bars of a 16:9 player)
  let best = null, bs = 0.45;
  const colEdge = Array.from({ length: cw + 1 }, (_, x) => sv(x, 0, ch) > 0.05);   // (a column with no edge anywhere: skipped)
  for (const R of ASPECTS) for (let x0 = 0; x0 <= mx0; x0++) if (colEdge[x0]) for (let x1 = mx1 + 1; x1 <= cw; x1++) {
    const hi = Math.round((x1 - x0) * kx / R / ky);
    if (!colEdge[x1] || hi < my1 + 1 - my0 || hi > ch) continue;
    for (let y0 = Math.max(0, my1 + 1 - hi); y0 <= Math.min(my0, ch - hi); y0++) {
      const y1 = y0 + hi;
      const m = Math.min(sv(x0, y0, y1), sv(x1, y0, y1), sh(y0, x0, x1), sh(y1, x0, x1));
      if (m > bs + 0.02 || (m > bs - 0.02 && best && (x1 - x0) * hi < best[4])) { if (m > bs) bs = m; best = [x0, y0, x1, y1, (x1 - x0) * hi]; }
    }
  }
  let x0, y0, x1, y1;
  if (best) [x0, y0, x1, y1] = best;
  else {   // each side of the moving box out to the strongest edge nearby
    const colEdge = (x) => { let sm = 0; for (let y = my0; y <= my1; y++) sm += Math.abs(lum(x, y) - lum(x - 1, y)); return sm / (my1 - my0 + 1); };
    const rowEdge = (y) => { let sm = 0; for (let x = mx0; x <= mx1; x++) sm += Math.abs(lum(x, y) - lum(x, y - 1)); return sm / (mx1 - mx0 + 1); };
    const reach = Math.round(cw * 0.12);
    const near1 = (from, to, f) => { let b = from, bv = -1; for (let i = from; i !== to; i += Math.sign(to - from)) { const v = f(i); if (v > bv * 1.15) { bv = v; b = i; } } return bv > 24 ? b : from; };
    x0 = near1(mx0, Math.max(0, mx0 - reach), (x) => (x >= 1 ? colEdge(x) : 0));
    x1 = near1(mx1 + 1, Math.min(cw, mx1 + 1 + reach), (x) => (x < cw ? colEdge(x) : 0));
    y0 = near1(my0, Math.max(0, my0 - reach), (y) => (y >= 1 ? rowEdge(y) : 0));
    y1 = near1(my1 + 1, Math.min(ch, my1 + 1 + reach), (y) => (y < ch ? rowEdge(y) : 0));
  }
  // each side again at the tab's own size: the strongest edge within a coarse pixel and a half of it
  const F = new OffscreenCanvas(W, H), fg = F.getContext('2d', { willReadFrequently: true });
  fg.drawImage(video, 0, 0, W, H);
  const fd = fg.getImageData(0, 0, W, H).data, L2 = (x, y) => { const k = (y * W + x) * 4; return fd[k] + fd[k + 1] + fd[k + 2]; };
  let X0 = Math.round(x0 * kx), X1 = Math.round(x1 * kx), Y0 = Math.round(y0 * ky), Y1 = Math.round(y1 * ky);
  const ya = Math.max(1, Y0 + 4), yb = Math.min(H - 1, Y1 - 4), xa = Math.max(1, X0 + 4), xb = Math.min(W - 1, X1 - 4);
  const vEdge = (x) => { let sm = 0; for (let y = ya; y < yb; y += 2) sm += Math.abs(L2(x, y) - L2(x - 1, y)); return sm; };
  const hEdge = (y) => { let sm = 0; for (let x = xa; x < xb; x += 2) sm += Math.abs(L2(x, y) - L2(x, y - 1)); return sm; };
  const near = (c, r, lim, f) => {   // (the tab's border when the side is on it)
    if (c <= 0 || c >= lim) return Math.max(0, Math.min(lim, c));
    let b = c, bv = -1; for (let i = Math.max(1, c - r); i <= Math.min(lim - 1, c + r); i++) { const v = f(i); if (v > bv) { bv = v; b = i; } } return b;
  };
  const rx = Math.ceil(kx * 1.5), ry = Math.ceil(ky * 1.5);
  X0 = near(X0, rx, W, vEdge); X1 = near(X1, rx, W, vEdge); Y0 = near(Y0, ry, H, hEdge); Y1 = near(Y1, ry, H, hEdge);
  if (X1 - X0 < 16 || Y1 - Y0 < 16) return null;
  return [X0, Y0, X1 - X0, Y1 - Y0];
}

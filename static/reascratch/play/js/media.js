// ReaScratch Web — reading a dropped file: the sound (decodeAudioData) and every picture frame, made small and kept as
// JPEG (like the all-keyframe MJPEG the REAPER kit converts to), so any frame can be shown at once while scratching.
// mp4/mov/m4v go through mp4box.js + WebCodecs (fast); other videos are read by seeking a <video> (slow).

const MAX_W = 640, JPEG_Q = 0.8;

export async function decodeAudio(ctx, file) {
  const buf = await file.arrayBuffer();
  const ab = await ctx.decodeAudioData(buf);
  const ch = [];
  for (let c = 0; c < Math.min(2, ab.numberOfChannels); c++) ch.push(ab.getChannelData(c).slice());
  return { ch, rate: ab.sampleRate, dur: ab.duration };
}

export function isVideo(file) {
  return /^video\//.test(file.type) || /\.(mp4|m4v|mov|webm|mkv|avi|ogv)$/i.test(file.name);
}

// frames = { fps, n, w, h, blobs: Blob[] }; progress(fraction). early(frames), if given, gets the same object as soon as
// its size is known, its blobs filling in as they are made: a deck can show the frames done so far (FrameSource takes
// the nearest one before a missing frame) instead of waiting for all of them (3.7 s for 480 frames on a Pixel 4a)
export async function readFrames(file, progress, early) {
  if (/\.(mp4|m4v|mov)$/i.test(file.name) && 'VideoDecoder' in window && window.MP4Box) {
    try { return await framesWebCodecs(file, progress, early); } catch (e) { console.warn('WebCodecs path failed, seeking instead', e); frameLog(`WebCodecs failed: ${e && e.message || e}`); }
  }
  return framesBySeeking(file, progress, early);
}

export function sizeFor(w, h) {
  const k = Math.min(1, MAX_W / w);
  return [Math.max(2, Math.round(w * k / 2) * 2), Math.max(2, Math.round(h * k / 2) * 2)];
}

// JPEG encoding spread over a few workers (one canvas encodes only about 30 frames a second)
export class JpegSink {
  constructor(w, h, crop = null) {
    this.w = w; this.h = h; this.crop = crop;
    this.pending = 0;
    this.n = Math.max(2, Math.min(6, (navigator.hardwareConcurrency || 4) - 2));
    this.workers = [];
    this.next = 0;
    this.waiters = [];
    this.cv = null;
  }
  worker() {
    if (this.workers.length < this.n) {
      const wk = new Worker(new URL('./jpeg_worker.js', import.meta.url));
      wk.onmessage = (e) => {
        if (e.data.err) { frameLog(`jpeg worker: ${e.data.err}`); this.here = true; }   // (from now on: drawn on the page)
        else this.store[e.data.i] = e.data.blob;
        this.done1();
      };
      wk.onerror = (e) => { frameLog(`jpeg worker error: ${e.message}`); };
      this.workers.push(wk);
    }
    return this.workers[this.next++ % this.workers.length];
  }
  done1() { this.pending--; if (!this.pending) this.waiters.splice(0).forEach((r) => r()); }
  // a VideoFrame goes to a worker; anything else (a <video>) is copied into a VideoFrame first (an ImageBitmap without
  // WebCodecs). A <video> whose copy comes out broken (Firefox on Android: "Passed-in video frame is broken", no picture
  // at all, user's report 2026-10-20) is drawn on a canvas on the page instead, from then on
  put(src, store, i) {
    this.store = store;
    const isFrame = typeof VideoFrame !== 'undefined' && src instanceof VideoFrame;
    if (!isFrame && this.here) { this.putHere(src, store, i); return; }
    if (!isFrame && typeof VideoFrame === 'undefined') {
      this.pending++;
      createImageBitmap(src).then((bm) => {
        this.worker().postMessage({ i, frame: bm, w: this.w, h: this.h, q: JPEG_Q, crop: this.crop }, [bm]);
      }, (e) => { frameLog(`createImageBitmap: ${e && e.message || e}`); this.here = true; this.done1(); });
      return;
    }
    const frame = src instanceof VideoFrame ? src.clone() : new VideoFrame(src, { timestamp: 0 });
    this.pending++;
    this.worker().postMessage({ i, frame, w: this.w, h: this.h, q: JPEG_Q, crop: this.crop }, [frame]);
  }
  putHere(src, store, i) {
    if (!this.cv) {
      this.cv = document.createElement('canvas'); this.cv.width = this.w; this.cv.height = this.h;
      this.cg = this.cv.getContext('2d', { willReadFrequently: true });
    }
    const c = this.crop, sw = src.videoWidth || src.width, sh = src.videoHeight || src.height;
    try {
      if (c) this.cg.drawImage(src, c[0] * sw, c[1] * sh, c[2] * sw, c[3] * sh, 0, 0, this.w, this.h);
      else this.cg.drawImage(src, 0, 0, this.w, this.h);
    } catch (e) { frameLog(`page canvas: ${e && e.message || e}`); return; }
    if ((this.checked || 0) < 12) {   // (the first 12: all black = the browser hides the video's picture; a video may start black)
      const d = this.cg.getImageData(0, 0, this.w, this.h).data; let sum = 0;
      for (let k = 0; k < d.length; k += 4 * 97) sum += d[k] + d[k + 1] + d[k + 2];
      if (sum > 0) this.seen = true;
      if (++this.checked === 12) { this.black = !this.seen; frameLog(`page canvas: ${this.seen ? 'picture' : 'all black'}`); }
    }
    this.pending++;
    this.cv.toBlob((b) => { if (b) store[i] = b; this.done1(); }, 'image/jpeg', JPEG_Q);
  }
  get chain() { return this.pending ? new Promise((r) => this.waiters.push(r)) : Promise.resolve(); }
  done() { this.workers.forEach((w) => w.terminate()); }
}

function description(mp4, track) {
  const entry = mp4.getTrackById(track.id).mdia.minf.stbl.stsd.entries[0];
  const box = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C;
  if (!box) return undefined;
  const s = new window.DataStream(undefined, 0, window.DataStream.BIG_ENDIAN);
  box.write(s);
  return new Uint8Array(s.buffer, 8);   // without the box header
}

// what the frame making did, for ?diag=1 (js/diag.js): the way taken and what went wrong (a phone's browser without
// WebCodecs showed no picture, user's report 2026-10-20)
export const frameNotes = [];
export function frameLog(m) { frameNotes.push(m); if (frameNotes.length > 6) frameNotes.shift(); }

async function framesWebCodecs(file, progress, early) {
  const data = await file.arrayBuffer();
  const mp4 = window.MP4Box.createFile();
  const ready = new Promise((res, rej) => { mp4.onReady = res; mp4.onError = rej; });
  data.fileStart = 0;
  mp4.appendBuffer(data);
  mp4.flush();
  const info = await ready;
  const track = info.videoTracks[0];
  if (!track) throw new Error('no video track');
  const dur = track.movie_duration ? track.movie_duration / info.timescale : track.duration / track.timescale;
  const fps = track.nb_samples / (track.duration / track.timescale);
  const [w, h] = sizeFor(track.video.width, track.video.height);
  const n = track.nb_samples;
  const blobs = new Array(n), fr = { fps, n, w, h, dur, blobs, how: 'webcodecs' };
  const sink = new JpegSink(w, h);
  frameLog(`webcodecs: ${track.codec} ${n} frames`);
  let t0 = null, done = 0, err = null;
  const dec = new VideoDecoder({
    output: (f) => {
      if (t0 === null) t0 = f.timestamp;
      const i = Math.max(0, Math.min(n - 1, Math.round((f.timestamp - t0) / 1e6 * fps)));
      sink.put(f, blobs, i);
      f.close();
      done++;
      if (done % 30 === 0) progress(done / n);
    },
    error: (e) => { err = e; },
  });
  const config = { codec: track.codec, codedWidth: track.video.width, codedHeight: track.video.height, description: description(mp4, track) };
  // a failure on the way stops the workers and the decoder (they went on after a fallback to seeking, found 2026-10-20)
  try {
    const sup = await VideoDecoder.isConfigSupported(config);
    if (!sup.supported) throw new Error('codec not supported: ' + track.codec);
    dec.configure(config);
    if (early) early(fr);   // (only once the codec is known to work: a fallback gives the decks another object)
    const samples = await new Promise((res) => {
      const all = [];
      mp4.onSamples = (id, user, ss) => { all.push(...ss); if (all.length >= n) res(all); };
      mp4.setExtractionOptions(track.id, null, { nbSamples: n });
      mp4.start();
      mp4.flush();
      setTimeout(() => res(all), 3000);
    });
    for (const s of samples) {
      if (err) throw err;
      while (dec.decodeQueueSize > 24 || sink.pending > 24) await new Promise((r) => setTimeout(r, 2));
      dec.decode(new EncodedVideoChunk({ type: s.is_sync ? 'key' : 'delta', timestamp: 1e6 * s.cts / s.timescale, duration: 1e6 * s.duration / s.timescale, data: s.data }));
    }
    await dec.flush();
    dec.close();
    await sink.chain;
  } catch (e) { sink.done(); if (dec.state !== 'closed') dec.close(); throw e; }
  sink.done();
  if (err) throw err;
  // a frame the decoder skipped shows its neighbour
  for (let i = 1; i < n; i++) if (!blobs[i]) blobs[i] = blobs[i - 1];
  for (let i = n - 2; i >= 0; i--) if (!blobs[i]) blobs[i] = blobs[i + 1];
  progress(1);
  return fr;
}

async function framesBySeeking(file, progress, early) {
  const url = URL.createObjectURL(file);
  const v = document.createElement('video');
  v.muted = true; v.preload = 'auto'; v.src = url;
  await new Promise((res, rej) => { v.onloadedmetadata = res; v.onerror = () => rej(new Error('cannot read this video')); });
  const fps = 30, dur = v.duration, n = Math.max(1, Math.floor(dur * fps));
  const [w, h] = sizeFor(v.videoWidth, v.videoHeight);
  const blobs = new Array(n), fr = { fps, n, w, h, dur, blobs, how: 'video' };
  const sink = new JpegSink(w, h);
  if (early) early(fr);
  frameLog(`video: ${v.videoWidth}x${v.videoHeight} ${n} frames, rVFC ${'requestVideoFrameCallback' in v}, VideoFrame ${typeof VideoFrame !== 'undefined'}`);
  try {
    if ('requestVideoFrameCallback' in v) {
      // no WebCodecs (Firefox on Android): played silently at 2x, each frame shown copied, then the frames that were
      // not shown copied by seeking (a seek for every frame took 28.6 s for 480; at 2x about half of them came by)
      const got = new Uint8Array(n);
      v.playbackRate = 2;
      await new Promise((res, rej) => {
        let k = 0;
        const grab = (now, meta) => {
          const i = Math.max(0, Math.min(n - 1, Math.round(meta.mediaTime * fps)));
          if (!got[i]) { got[i] = 1; sink.put(v, blobs, i); if (++k % 15 === 0) progress(0.5 * i / n); }
          if (!v.ended) v.requestVideoFrameCallback(grab);
        };
        v.requestVideoFrameCallback(grab);
        v.onended = res; v.onerror = () => rej(new Error('cannot read this video'));
        v.play().catch(rej);
      });
      v.pause();
      await sink.chain;
      // Firefox on Android: not even the page's canvas gets the picture. No frames then (the sound plays on): an MJPEG
      // AVI (js/avi.js) or another browser shows it
      if (sink.black) throw Object.assign(new Error('this browser does not give out the video\'s picture'), { code: 'nopicture' });
      for (let i = 0; i < n; i++) {
        if (blobs[i]) continue;   // (also the ones whose copy failed in the first pass)
        v.currentTime = (i + 0.5) / fps;
        await new Promise((res) => { v.onseeked = res; });
        sink.put(v, blobs, i);
        if (i % 15 === 0) progress(0.5 + 0.5 * i / n);
      }
      await sink.chain;
    } else {
      for (let i = 0; i < n; i++) {
        v.currentTime = (i + 0.5) / fps;
        await new Promise((res) => { v.onseeked = res; });
        sink.put(v, blobs, i);
        if (i % 15 === 0) progress(i / n);
      }
      await sink.chain;
    }
  } finally { sink.done(); URL.revokeObjectURL(url); }
  progress(1);
  return fr;
}

// picks frames out of a deck's store as ImageBitmaps, keeping a small cache; holds the last good one (BKEEP)
export class FrameSource {
  constructor(frames) {
    this.f = frames;
    this.cache = new Map();
    this.want = -1;
    this.last = null;
    this.busy = 0;
  }
  frameAt(t) {
    const f = this.f;
    return Math.max(0, Math.min(f.n - 1, Math.floor(Math.max(0.5 / f.fps, Math.min(f.dur - 0.5 / f.fps, t)) * f.fps)));
  }
  // returns the best bitmap for time t now, and starts decoding the wanted frame
  get(t) {
    let i = this.frameAt(t);
    // still being made (readFrames' early): the nearest frame before it that is done
    if (!this.f.blobs[i]) { let j = i; while (j > 0 && !this.f.blobs[j]) j--; if (this.f.blobs[j]) i = j; }
    this.want = i;
    const hit = this.cache.get(i);
    if (hit) { this.last = hit; this.cache.delete(i); this.cache.set(i, hit); return hit; }
    if (this.busy < 3 && !this.cache.has(i) && this.f.blobs[i]) {
      this.busy++;
      this.cache.set(i, null);
      createImageBitmap(this.f.blobs[i]).then((b) => {
        this.busy--;
        if (this.closed) { b.close(); return; }   // (the source was replaced while this one was decoding)
        this.cache.set(i, b);
        // the picture moved on while this one was decoding: still better than the old one if it is close
        if (!this.last || Math.abs(i - this.want) <= 3) this.last = b;
        while (this.cache.size > 90) {
          const k = this.cache.keys().next().value, old = this.cache.get(k);
          if (old && old !== this.last) old.close();
          this.cache.delete(k);
        }
      }, () => { this.busy--; this.cache.delete(i); });
    } else if (this.cache.get(i) === null) { /* on its way */ }
    return this.last;
  }
  close() { this.closed = true; for (const b of this.cache.values()) if (b && b !== this.last) b.close(); this.cache.clear(); }
}

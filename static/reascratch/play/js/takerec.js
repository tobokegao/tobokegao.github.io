// ReaScratch Web — recording a take (⚪205): the picture (the stage canvas) and the main sound as the audience hears it,
// into one video file saved to the computer. REAPER records a take as lanes and renders it (reascratch_take.lua); in the
// browser the closest is MediaRecorder on the canvas and the worklet's output. MP4 (H.264 / AAC) where the browser has it
// (Chrome 126 and up), else WebM.
const TYPES = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];

export function canRecordTake() {
  return typeof MediaRecorder !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream;
}

// start: canvas = the stage, ctx / node = the AudioContext and the node whose output is the main mix (before the page's
// mute). Returns {stop(): Promise<{blob, ext, sec}>}
export function startTake(canvas, ctx, node, fps = 30) {
  const dest = ctx.createMediaStreamDestination();
  node.connect(dest, 0);
  const vs = canvas.captureStream(fps);
  const stream = new MediaStream([...vs.getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const mimeType = TYPES.find((m) => MediaRecorder.isTypeSupported(m)) || '';
  const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8e6, audioBitsPerSecond: 256e3 });
  const parts = [], t0 = performance.now();
  rec.ondataavailable = (e) => { if (e.data && e.data.size) parts.push(e.data); };
  rec.start(1000);
  return {
    mimeType: rec.mimeType,
    sec: () => (performance.now() - t0) / 1000,
    stop: () => new Promise((res) => {
      rec.onstop = () => {
        try { node.disconnect(dest); } catch (e) { /* already gone */ }
        vs.getTracks().forEach((tr) => tr.stop());
        const type = rec.mimeType || 'video/webm';
        res({ blob: new Blob(parts, { type }), ext: /mp4/.test(type) ? 'mp4' : 'webm', sec: (performance.now() - t0) / 1000 });
      };
      rec.stop();
    }),
  };
}

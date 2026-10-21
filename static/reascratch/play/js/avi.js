// ReaScratch Web — an MJPEG AVI read as it is: each video chunk is already a JPEG, so the frames need no video decoder
// (the same idea as the REAPER version's MJPEG). The way for a browser that cannot hand out a video's picture at all
// (Firefox on Android: VideoFrame, ImageBitmap and canvas all broken or black, user's choice 2026-10-20). The sound:
// the AVI's own PCM (8/16/24/32-bit or float); none (the REAPER kit's MJPEG AVIs keep the sound in a WAV) = silence.
// RIFF 'AVI ' and the OpenDML 'AVIX' parts are walked in order; a zero-length frame repeats the one before.

const fourcc = (u8, o) => String.fromCharCode(u8[o], u8[o + 1], u8[o + 2], u8[o + 3]);

export const isAvi = (file) => /\.avi$/i.test(file.name);

// { a: { ch: Float32Array[], rate }, fr: { fps, n, w, h, dur, blobs, how }, note: '' | 'aviNoSound' | 'aviSoundKind' }
export async function readAvi(file) {
  const buf = await file.arrayBuffer(), dv = new DataView(buf), u8 = new Uint8Array(buf);
  const streams = [], frames = [], sound = [];
  let usPerFrame = 0, aw = 0, ah = 0;
  const walk = (start, end, inMovi) => {
    let o = start;
    while (o + 8 <= end) {
      const id = fourcc(u8, o), size = dv.getUint32(o + 4, true), body = o + 8;
      if (id === 'RIFF' || id === 'LIST') {
        const type = fourcc(u8, body);
        walk(body + 4, Math.min(end, body + size), type === 'movi' || (inMovi && type === 'rec '));
      } else if (id === 'avih') {
        usPerFrame = dv.getUint32(body, true); aw = dv.getUint32(body + 32, true); ah = dv.getUint32(body + 36, true);
      } else if (id === 'strh') {
        streams.push({ type: fourcc(u8, body), scale: dv.getUint32(body + 20, true), rate: dv.getUint32(body + 24, true) });
      } else if (id === 'strf' && streams.length) {
        const st = streams[streams.length - 1];
        if (st.type === 'vids') { st.w = dv.getInt32(body + 4, true); st.h = Math.abs(dv.getInt32(body + 8, true)); }
        if (st.type === 'auds') {
          st.fmt = dv.getUint16(body, true); st.ch = dv.getUint16(body + 2, true); st.sr = dv.getUint32(body + 4, true);
          st.bits = dv.getUint16(body + 14, true);
          if (st.fmt === 0xFFFE && size >= 40) st.fmt = dv.getUint16(body + 24, true);   // WAVE_FORMAT_EXTENSIBLE: the subformat
        }
      } else if (inMovi) {
        const st = streams[parseInt(id.slice(0, 2), 10)], kind = id.slice(2);
        if (st && st.type === 'vids' && (kind === 'dc' || kind === 'db')) frames.push([body, size]);
        else if (st && st.type === 'auds' && kind === 'wb' && size > 0) sound.push([body, size]);
      }
      o = body + size + (size & 1);
    }
  };
  walk(0, buf.byteLength, false);
  const vs = streams.find((s) => s.type === 'vids');
  if (!vs || !frames.length) throw new Error('no MJPEG frames in this AVI');
  const fps = vs.scale && vs.rate ? vs.rate / vs.scale : usPerFrame ? 1e6 / usPerFrame : 30;
  const blobs = [];
  for (const [o, s] of frames) blobs.push(s > 0 ? file.slice(o, o + s, 'image/jpeg') : blobs[blobs.length - 1] || null);
  for (let i = blobs.length - 2; i >= 0; i--) if (!blobs[i]) blobs[i] = blobs[i + 1];
  const n = blobs.length, w = vs.w || aw, h = vs.h || ah;
  const fr = { fps, n, w, h, dur: n / fps, blobs, how: 'mjpeg' };

  // the sound
  const as = streams.find((s) => s.type === 'auds');
  const pcm = as && (as.fmt === 1 || as.fmt === 3) && as.ch > 0 && [8, 16, 24, 32].includes(as.bits);
  if (!pcm) {
    const rate = 48000, len = Math.max(1, Math.round(fr.dur * rate));
    return { a: { ch: [new Float32Array(len), new Float32Array(len)], rate }, fr, note: as ? 'aviSoundKind' : 'aviNoSound' };
  }
  const bps = as.bits / 8, step = bps * as.ch;
  let total = 0; for (const [, s] of sound) total += Math.floor(s / step);
  const ch = Array.from({ length: Math.min(2, as.ch) }, () => new Float32Array(total));
  let k = 0;
  for (const [o, s] of sound) {
    const m = Math.floor(s / step);
    for (let i = 0; i < m; i++, k++) {
      for (let c = 0; c < ch.length; c++) {
        const p = o + i * step + c * bps;
        let v;
        if (as.fmt === 3) v = bps === 4 ? dv.getFloat32(p, true) : 0;
        else if (bps === 1) v = (u8[p] - 128) / 128;
        else if (bps === 2) v = dv.getInt16(p, true) / 32768;
        else if (bps === 3) v = ((u8[p] | (u8[p + 1] << 8) | (u8[p + 2] << 16)) << 8 >> 8) / 8388608;
        else v = dv.getInt32(p, true) / 2147483648;
        ch[c][k] = v;
      }
    }
  }
  if (ch.length === 1) ch.push(ch[0]);
  return { a: { ch, rate: as.sr }, fr, note: '' };
}

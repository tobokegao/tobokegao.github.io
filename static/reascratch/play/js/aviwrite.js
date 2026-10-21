// ReaScratch Web — a deck's sample saved as an MJPEG AVI: the JPEG frames the page already made (WebCodecs in Chrome)
// as the video chunks, the decoded sound as 16-bit PCM. Opened again it needs no video decoder (js/avi.js), so a
// browser that cannot hand out a video's picture (Firefox on Android) shows it, and Chrome loads it at once
// (user's request 2026-10-20: convert in Chrome, save, open in Firefox). AVI 1.0 (RIFF 'AVI ', LIST hdrl / movi, idx1):
// up to 1 GB, the size other programs (REAPER, ffmpeg) read without the OpenDML parts.

export const AVI_MAX = 1024 * 1024 * 1024;

const tag = (s) => [s.charCodeAt(0), s.charCodeAt(1), s.charCodeAt(2), s.charCodeAt(3)];

class Bytes {
  constructor(n) { this.b = new ArrayBuffer(n); this.v = new DataView(this.b); this.o = 0; }
  four(s) { for (const c of tag(s)) this.v.setUint8(this.o++, c); return this; }
  u32(x) { this.v.setUint32(this.o, x >>> 0, true); this.o += 4; return this; }
  i32(x) { this.v.setInt32(this.o, x | 0, true); this.o += 4; return this; }
  u16(x) { this.v.setUint16(this.o, x, true); this.o += 2; return this; }
}

// fr = { fps, n, w, h, blobs: Blob[] (JPEGs) }, a = { ch: Float32Array[] (1 or 2), rate } or null (no sound chunks)
// returns a Blob (video/x-msvideo), or throws when over AVI_MAX
export function writeAvi(fr, a) {
  const n = fr.n, fps = fr.fps, scale = 1000, rate = Math.round(fps * scale);
  const chs = a ? Math.min(2, a.ch.length) : 0, sr = a ? a.rate : 0, frames = a ? a.ch[0].length : 0;
  // the movi chunks: frame i, then the sound up to the end of frame i (so the two stay together in the file)
  const parts = [], index = [];
  let movi = 4, maxChunk = 0;   // (from the 'movi' fourcc, as idx1 counts)
  const chunk = (id, data, size, key) => {
    const h = new Bytes(8).four(id).u32(size);
    parts.push(h.b, data);
    if (size & 1) parts.push(new Uint8Array(1));
    index.push([id, key ? 0x10 : 0, movi, size]);
    movi += 8 + size + (size & 1); maxChunk = Math.max(maxChunk, size);
  };
  let done = 0;
  for (let i = 0; i < n; i++) {
    const b = fr.blobs[i] || fr.blobs[i - 1];
    chunk('00dc', b, b.size, true);
    if (chs) {
      const to = Math.min(frames, Math.round((i + 1) / fps * sr));
      if (to > done) {
        const pcm = new Int16Array((to - done) * chs);
        for (let s = done, k = 0; s < to; s++) for (let c = 0; c < chs; c++, k++) {
          const v = Math.max(-1, Math.min(1, a.ch[c][s] || 0));
          pcm[k] = v < 0 ? v * 32768 : v * 32767;
        }
        chunk('01wb', pcm.buffer, pcm.byteLength, true);
        done = to;
      }
    }
  }
  const idxSize = index.length * 16;
  // the headers
  const strlV = 4 + (8 + 56) + (8 + 40), strlA = chs ? 4 + (8 + 56) + (8 + 18) : 0;
  const hdrl = 4 + (8 + 56) + (8 + strlV) + (chs ? 8 + strlA : 0);
  const riff = 4 + (8 + hdrl) + (8 + movi) + (8 + idxSize);
  if (riff + 8 > AVI_MAX) throw Object.assign(new Error('too large for one AVI'), { code: 'avitoobig' });
  const H = new Bytes(12 + 8 + hdrl + 12);
  H.four('RIFF').u32(riff).four('AVI ');
  H.four('LIST').u32(hdrl).four('hdrl');
  H.four('avih').u32(56).u32(Math.round(1e6 / fps)).u32(0).u32(0).u32(0x10)   // AVIF_HASINDEX
    .u32(n).u32(0).u32(chs ? 2 : 1).u32(maxChunk).u32(fr.w).u32(fr.h).u32(0).u32(0).u32(0).u32(0);
  H.four('LIST').u32(strlV).four('strl');
  H.four('strh').u32(56).four('vids').four('MJPG').u32(0).u16(0).u16(0).u32(0).u32(scale).u32(rate).u32(0).u32(n)
    .u32(maxChunk).i32(-1).u32(0).u16(0).u16(0).u16(fr.w).u16(fr.h);
  H.four('strf').u32(40).u32(40).i32(fr.w).i32(fr.h).u16(1).u16(24).four('MJPG').u32(fr.w * fr.h * 3).i32(0).i32(0).u32(0).u32(0);
  if (chs) {
    H.four('LIST').u32(strlA).four('strl');
    H.four('strh').u32(56).four('auds').u32(0).u32(0).u16(0).u16(0).u32(0).u32(chs * 2).u32(sr * chs * 2).u32(0).u32(frames)
      .u32(sr * chs * 2).i32(-1).u32(chs * 2).u16(0).u16(0).u16(0).u16(0);
    H.four('strf').u32(18).u16(1).u16(chs).u32(sr).u32(sr * chs * 2).u16(chs * 2).u16(16).u16(0);
  }
  H.four('LIST').u32(movi).four('movi');
  const I = new Bytes(8 + idxSize).four('idx1').u32(idxSize);
  for (const [id, flags, off, size] of index) I.four(id).u32(flags).u32(off).u32(size);
  return new Blob([H.b, ...parts, I.b], { type: 'video/x-msvideo' });
}

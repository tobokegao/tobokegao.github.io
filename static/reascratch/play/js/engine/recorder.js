// ReaScratch Web — records what comes in (a shared tab's sound) and posts it in chunks to the page (capture.js).
class RsRecorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.on = true;
    this.buf = [[], []];
    this.n = 0;
    this.port.onmessage = (e) => { if (e.data === 'stop') { this.flush(); this.on = false; } };
  }
  flush() {
    if (!this.n) return;
    const cat = (parts) => { const a = new Float32Array(this.n); let o = 0; for (const p of parts) { a.set(p, o); o += p.length; } return a; };
    const l = cat(this.buf[0]), r = cat(this.buf[1]);
    this.port.postMessage({ l, r, t: currentTime }, [l.buffer, r.buffer]);
    this.buf = [[], []]; this.n = 0;
  }
  process(inputs) {
    if (!this.on) return false;
    const inp = inputs[0];
    if (inp && inp.length) {
      this.buf[0].push(inp[0].slice()); this.buf[1].push((inp[1] || inp[0]).slice());
      this.n += inp[0].length;
      if (this.n >= 16384) this.flush();
    }
    return true;
  }
}
registerProcessor('rs-recorder', RsRecorder);

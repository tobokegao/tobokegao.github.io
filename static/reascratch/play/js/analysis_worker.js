// ReaScratch Web — the sample analysis (analysis.js) off the main thread. A module worker:
//   const wk = new Worker(new URL('./analysis_worker.js', import.meta.url), { type: 'module' });
//   wk.postMessage({ id, ch: [Float32Array, ...], rate }, ch.map((a) => a.buffer));   // (transfer copies, not the deck's)
//   wk.onmessage = (e) => { e.data.id, e.data.result }   // result as analyze(); { id, error } when it failed
import { analyze } from './analysis.js';

self.onmessage = (e) => {
  const { id, ch, rate } = e.data;
  try {
    const result = analyze(ch, rate);
    self.postMessage({ id, result });
  } catch (err) {
    self.postMessage({ id, result: null, error: String(err && err.stack || err) });
  }
};

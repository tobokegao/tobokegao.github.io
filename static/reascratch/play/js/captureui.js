// ReaScratch Web — the dialog for taking in a tab: live view with the cut-out area, record / stop, then trim and load.
import { openCapture, trimTake } from './capture.js';
import { t } from './i18n.js';

const $ = (s) => document.querySelector(s);

// load(take, name) puts the take into the deck; status(msg) shows a message on the deck
export async function captureDialog(ctx, deckLabel, load, status) {
  let S;
  try { S = await openCapture(ctx); } catch (e) { if (e && e.name !== 'NotAllowedError') status(`${t('capFail')}: ${e.message || e}`); return; }
  const dlg = $('#capture'), cv = $('#capView'), g = cv.getContext('2d'), msg = $('#captureMsg');
  const btn = { auto: $('#capAuto'), all: $('#capAll'), rec: $('#capRec'), stop: $('#capStop'), load: $('#capLoad'), cancel: $('#capCancel') };
  const trim = $('#capTrim'), tA = $('#capTrimA'), tB = $('#capTrimB'), tTxt = $('#capTrimTxt');
  $('#captureDeck').textContent = deckLabel;
  $('#captureWarn').hidden = S.hasAudio;
  let phase = 'setup', take = null, shown = null, shownI = -1, drag = null, raf = 0, closed = false;
  const show = (p) => {
    phase = p;
    btn.auto.hidden = btn.all.hidden = btn.rec.hidden = p !== 'setup';
    btn.stop.hidden = p !== 'rec';
    btn.load.hidden = trim.hidden = p !== 'trim';
    $('#captureHint').textContent = t(p === 'setup' ? 'capHowSetup' : p === 'rec' ? 'capHowRec' : 'capHowTrim');
  };
  // where the tab's picture sits in the view (letterboxed), and back
  const fit = (W, H) => { const k = Math.min(cv.width / W, cv.height / H); return { k, ox: (cv.width - W * k) / 2, oy: (cv.height - H * k) / 2 }; };
  const draw = () => {
    if (closed) return;
    raf = requestAnimationFrame(draw);
    g.fillStyle = '#000'; g.fillRect(0, 0, cv.width, cv.height);
    if (phase === 'trim') {
      if (shown) { const f = fit(shown.width, shown.height); g.drawImage(shown, f.ox, f.oy, shown.width * f.k, shown.height * f.k); }
      return;
    }
    const [W, H] = S.srcSize(), f = fit(W, H);
    g.drawImage(S.video, f.ox, f.oy, W * f.k, H * f.k);
    const c = S.crop;
    if (c) {   // dim what is left out, outline the area
      g.fillStyle = 'rgba(0,0,0,0.6)';
      const x = f.ox + c[0] * f.k, y = f.oy + c[1] * f.k, w = c[2] * f.k, h = c[3] * f.k;
      g.fillRect(0, 0, cv.width, y); g.fillRect(0, y + h, cv.width, cv.height - y - h); g.fillRect(0, y, x, h); g.fillRect(x + w, y, cv.width - x - w, h);
      g.strokeStyle = '#fbd743'; g.lineWidth = 2; g.strokeRect(x, y, w, h);
    }
    if (phase === 'rec') {
      g.fillStyle = '#ff3b30'; g.beginPath(); g.arc(18, 18, 7, 0, 7); g.fill();
      const e = S.elapsed();
      msg.textContent = `${Math.floor(e / 60)}:${String(Math.floor(e % 60)).padStart(2, '0')}  (${S.last + 1} ${t('frames')})`;
    }
  };
  // drag on the view = a new area (in the tab's pixels)
  const toSrc = (ev) => {
    const r = cv.getBoundingClientRect(), [W, H] = S.srcSize(), f = fit(W, H);
    const px = (ev.clientX - r.left) * cv.width / r.width, py = (ev.clientY - r.top) * cv.height / r.height;
    return [Math.max(0, Math.min(W, (px - f.ox) / f.k)), Math.max(0, Math.min(H, (py - f.oy) / f.k))];
  };
  cv.onpointerdown = (ev) => { if (phase !== 'setup') return; cv.setPointerCapture(ev.pointerId); drag = toSrc(ev); };
  cv.onpointermove = (ev) => {
    if (!drag) return;
    const [x, y] = toSrc(ev), x0 = Math.min(x, drag[0]), y0 = Math.min(y, drag[1]);
    const w = Math.abs(x - drag[0]), h = Math.abs(y - drag[1]);
    if (w > 8 && h > 8) S.crop = [Math.round(x0), Math.round(y0), Math.round(w), Math.round(h)];
  };
  cv.onpointerup = () => { drag = null; };

  // the trim: two sliders; the view shows the frame of the one moved last
  const showFrame = async (sec) => {
    const i = Math.max(0, Math.min(take.fr.n - 1, Math.floor(sec * take.fr.fps)));
    if (i === shownI) return;
    shownI = i;
    const b = await createImageBitmap(take.fr.blobs[i]);
    if (shownI === i) { if (shown) shown.close(); shown = b; } else b.close();
  };
  const trimText = () => {
    let a = +tA.value, b = +tB.value;
    if (b - a < 0.1) { if (document.activeElement === tA) a = +(tA.value = Math.max(0, b - 0.1)); else b = +(tB.value = Math.min(take.a.dur, a + 0.1)); }
    tTxt.textContent = `${a.toFixed(2)} s – ${b.toFixed(2)} s  (${(b - a).toFixed(2)} s)`;
  };
  tA.oninput = () => { trimText(); showFrame(+tA.value); };
  tB.oninput = () => { trimText(); showFrame(Math.max(0, +tB.value - 1 / 30)); };

  const finish = (loadIt) => {
    if (closed) return;
    closed = true; cancelAnimationFrame(raf); S.close(); dlg.close();
    if (shown) shown.close();
    if (loadIt && take) {
      const tk = trimTake(take, +tA.value, +tB.value);
      load(tk, `${t('capName')} ${new Date().toLocaleTimeString()}`).then(() => status(`${t('capDone')}: ${tk.fr.n} ${t('frames')}, ${tk.a.dur.toFixed(1)} s`),
        (e) => status(`${t('capFail')}: ${e.message || e}`));
    }
  };
  btn.auto.onclick = async () => { btn.auto.disabled = true; msg.textContent = t('capFinding'); const c = await S.autoCrop(); msg.textContent = c ? '' : t('capNoMotion'); btn.auto.disabled = false; };
  btn.all.onclick = () => { S.crop = null; };
  btn.rec.onclick = async () => { await S.record(); show('rec'); };
  btn.stop.onclick = async () => {
    btn.stop.disabled = true; msg.textContent = t('capSaving');
    try { take = await S.stop(); } catch (e) { status(`${t('capFail')}: ${e.message || e}`); finish(false); return; }
    btn.stop.disabled = false; msg.textContent = '';
    tA.max = tB.max = take.a.dur; tA.step = tB.step = 1 / take.fr.fps; tA.value = 0; tB.value = take.a.dur;
    trimText(); show('trim'); showFrame(0);
  };
  btn.load.onclick = () => finish(true);
  btn.cancel.onclick = () => finish(false);
  dlg.oncancel = (e) => { e.preventDefault(); if (phase === 'rec') btn.stop.click(); else finish(false); };
  S.ended.then(() => { if (phase === 'rec') btn.stop.click(); else if (phase === 'setup') finish(false); });
  msg.textContent = '';
  show('setup');
  dlg.showModal();
  draw();
}

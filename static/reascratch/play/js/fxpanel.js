// ReaScratch Web — the effect controls a controller would give (the JSFX has them on the setup page's FX / Video tabs and on
// the controller's knobs): per deck the video FX and its sound, the echo / bitcrusher / vibrato faders and the DJ filter;
// for both decks the blend or transition the crossfader runs. Names and numbers as in the JSFX (sliders 78, 82, 153).
import { t } from './i18n.js';

export const EFFECTS = ['off', 'Tint', 'Hue rotate', 'Invert', 'Threshold', 'Mirror', 'Kaleidoscope', 'LoRez', 'Shift RGB',
  'Strobe', 'Trails', 'VHS', 'Disc', 'Line art', 'Halftone', 'Zoom blur'];
export const BLENDS = ['Mix', 'Add', 'Subtract', 'Multiply', 'Overlay', 'Soft light', 'Hard light', 'Luma key', 'Chroma key',
  'Wipe right', 'Wipe down', 'Wipe diagonal', 'Split', 'Slide', 'Blinds', 'Iris box', 'Iris diamond', 'Iris circle', 'Clock',
  'Blocks', 'Dip to black', 'Dip to white', 'Pixelate', 'Zoom', 'Punch zoom', 'Whip right', 'Whip up', 'Whip down',
  'Shake cut', 'Spin zoom', 'Drop bounce', 'Tilt right', 'Tilt down', 'Brush wipe', 'Defocus', 'Picture in picture',
  'Shatter', 'PiP to corner'];
export const FILTERS = ['Moog', 'Ladder', 'Steiner', 'Pillow', 'Rect', 'Shriek4p', 'MS-20', 'nlSVF'];

export function initFxPanel(app, root) {
  app.mix = { blend: 0 };
  const opt = (list, from = 0) => list.map((n, i) => `<option value="${i + from}">${n}</option>`).join('');
  const blendOpts = `<optgroup label="${t('blends')}">${opt(BLENDS.slice(0, 9))}</optgroup><optgroup label="${t('transitions')}">${BLENDS.slice(9).map((n, i) => `<option value="${i + 9}">${n}</option>`).join('')}</optgroup>`;
  const deckHtml = (d) => `
    <fieldset class="fxdeck" data-d="${d}"><legend>${t('deck')} ${d ? 'B' : 'A'}</legend>
      <label>${t('videoFx')} <select data-k="vfxType">${opt(EFFECTS)}</select></label>
      <label>${t('amount')} <input type="range" data-k="vfxAmt" min="0" max="1" step="0.01" value="0.5"></label>
      <label>${t('filter')} <input type="range" data-k="fltCut" min="-1" max="1" step="0.01" value="0"></label>
      <label>${t('filterType')} <select data-k="fltType">${opt(FILTERS)}</select></label>
      <label>echo <input type="range" data-k="echo" min="0" max="1" step="0.01" value="0"></label>
      <label>bitcrusher <input type="range" data-k="crush" min="0" max="1" step="0.01" value="0"></label>
      <label>vibrato <input type="range" data-k="vib" min="0" max="1" step="0.01" value="0"></label>
    </fieldset>`;
  root.innerHTML = `
    <label class="blend">${t('blend')} <select id="blendSel">${blendOpts}</select></label>
    <div class="fxdecks">${deckHtml(0)}${deckHtml(1)}</div>`;
  root.querySelector('#blendSel').addEventListener('change', (e) => { app.mix.blend = +e.target.value; });
  root.querySelectorAll('.fxdeck').forEach((fs) => {
    const d = +fs.dataset.d, ui = app.decks[d];
    fs.querySelectorAll('[data-k]').forEach((el) => {
      const send = () => {
        const k = el.dataset.k, v = +el.value;
        if (k === 'vfxType') ui.set({ vfxType: v, vfxAmt: v ? +fs.querySelector('[data-k="vfxAmt"]').value : 0 });
        else if (k === 'vfxAmt') ui.set({ vfxAmt: ui.p.vfxType ? v : 0 });
        else ui.set({ [k]: v });
      };
      el.addEventListener('input', send);
      // double-click a fader = back to its rest place
      if (el.type === 'range') el.addEventListener('dblclick', () => { el.value = el.dataset.k === 'vfxAmt' ? 0.5 : 0; send(); });
    });
  });
  // a controller changed deck d's settings (midi.js): the controls show them again
  app.fxSync = (d) => {
    const fs = root.querySelector(`.fxdeck[data-d="${d}"]`), p = app.decks[d].p;
    for (const el of fs.querySelectorAll('[data-k]')) {
      const k = el.dataset.k;
      if (k === 'vfxAmt') { if (p.vfxType && p.vfxAmt > 0) el.value = p.vfxAmt; } else if (p[k] !== undefined) el.value = p[k];
    }
    root.querySelector('#blendSel').value = app.mix.blend;
  };
  // the V key: effect on / off keeping the amount; Shift+V: amount 25 → 50 → 75 → 100 %
  app.vfxKey = (d, shift) => {
    const fs = root.querySelector(`.fxdeck[data-d="${d}"]`), sel = fs.querySelector('[data-k="vfxType"]'), amt = fs.querySelector('[data-k="vfxAmt"]');
    if (shift) { const a = +amt.value; amt.value = a >= 0.99 ? 0.25 : Math.min(1, Math.round((a + 0.25) * 4) / 4); amt.dispatchEvent(new Event('input')); return; }
    if (+sel.value) { fs.dataset.last = sel.value; sel.value = 0; } else sel.value = fs.dataset.last || 1;
    sel.dispatchEvent(new Event('input'));
  };
}

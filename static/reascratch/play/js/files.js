// ReaScratch Web — the file list (⚪205, user's request 2026-10-21): in REAPER a controller's BROWSE / LOAD / PREVIEW use
// the Media Explorer; here the files and folders dropped on the page (or added with the buttons) make a list, the
// controller's browse knob moves its choice (while the list is shown), LOAD puts the chosen file into the deck (an empty
// sample button, LOAD replace: the one in use), PREVIEW plays it in the headphones (the cue output when one is chosen).
// Nothing leaves the browser.
import { t } from './i18n.js';

const MEDIA = /\.(mp4|m4v|mov|webm|mkv|avi|wav|mp3|flac|ogg|oga|m4a|aac|aif|aiff)$/i;
const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;');

// the files under a drop (folders opened, as far as the browser lets: webkitGetAsEntry)
export async function droppedFiles(dt) {
  const out = [], items = dt.items ? [...dt.items] : [];
  const entries = items.map((it) => (it.webkitGetAsEntry ? it.webkitGetAsEntry() : null)).filter(Boolean);
  if (!entries.length) return [...(dt.files || [])].filter((f) => MEDIA.test(f.name));
  const walk = async (e, path) => {
    if (e.isFile) { const f = await new Promise((res) => e.file(res, () => res(null))); if (f && MEDIA.test(f.name)) out.push({ f, path: path + f.name }); return; }
    if (!e.isDirectory) return;
    const rd = e.createReader();
    for (;;) {
      const batch = await new Promise((res) => rd.readEntries(res, () => res([])));
      if (!batch.length) break;
      for (const c of batch) await walk(c, `${path}${e.name}/`);
    }
  };
  for (const e of entries) await walk(e, '');
  out.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
  return out.map((x) => Object.assign(x.f, { relPath: x.path }));
}

export function initFiles(app, { loadFile, curSlot, emptySlot }) {
  const box = document.querySelector('#files'), list = document.querySelector('#fileList');
  const files = [];
  let sel = -1, pvEl = null, pvSrc = null, pvGain = null, pvDeck = -1;
  const render = () => {
    list.innerHTML = files.length ? files.map((f, i) => `<li data-i="${i}"${i === sel ? ' class="sel"' : ''}>${esc(f.relPath || f.name)}</li>`).join('')
      : `<li class="note">${esc(t('filesEmpty'))}</li>`;
    const el = list.querySelector('.sel');
    if (el) el.scrollIntoView({ block: 'nearest' });
    document.querySelector('#filesInfo').textContent = files.length ? `${sel + 1} / ${files.length}` : '';
  };
  const show = (on) => { box.hidden = !on; document.querySelector('#filesBtn').classList.toggle('on', on); if (on) render(); };
  app.filesOpen = () => !box.hidden;
  app.filesToggle = () => show(box.hidden);
  app.filesAdd = (fs) => {
    const had = files.length;
    for (const f of fs) if (!files.some((g) => g.name === f.name && g.size === f.size && (g.relPath || '') === (f.relPath || ''))) files.push(f);
    if (sel < 0 && files.length) sel = had < files.length ? had : 0;
    show(true);
  };
  app.filesMove = (n) => {
    if (!files.length) return;
    if (box.hidden) show(true);
    sel = Math.max(0, Math.min(files.length - 1, (sel < 0 ? 0 : sel) + Math.sign(n) * Math.max(1, Math.round(Math.abs(n)))));
    render();
  };
  app.filesLoad = (d, replace) => {
    const f = files[sel];
    if (!f) { app.decks[d].status(t('filesNone')); return; }
    loadFile(d, f, replace ? curSlot(d) : emptySlot(d));
  };
  // PREVIEW: the chosen file from its start, again = stop; into the cue output (main.js app.cueInput) or the main
  app.filesPreview = async (d) => {
    const f = files[sel], ui = app.decks[d];
    if (pvEl && !pvEl.paused && pvDeck === d) { pvEl.pause(); ui.status(t('previewStop')); return; }
    if (!f || !app.ctx) { ui.status(t('filesNone')); return; }
    if (!pvEl) {
      pvEl = new Audio(); pvSrc = app.ctx.createMediaElementSource(pvEl); pvGain = new GainNode(app.ctx); pvSrc.connect(pvGain);
    }
    try { pvGain.disconnect(); } catch (e) { /* not connected */ }
    pvGain.connect(app.cueInput ? app.cueInput() : app.ctx.destination);
    if (pvEl.src) URL.revokeObjectURL(pvEl.src);
    pvEl.src = URL.createObjectURL(f); pvDeck = d;
    try { await pvEl.play(); ui.status(`${t('preview')}: ${f.name}`); } catch (e) { ui.status(`${t('readFail')}: ${f.name}`); }
  };
  list.addEventListener('click', (e) => { const li = e.target.closest('li[data-i]'); if (li) { sel = +li.dataset.i; render(); } });
  list.addEventListener('dblclick', (e) => { const li = e.target.closest('li[data-i]'); if (li) { sel = +li.dataset.i; app.filesLoad(app.active, 0); } });
  const pick = document.querySelector('#filesPick'), pickDir = document.querySelector('#filesPickDir');
  document.querySelector('#filesAdd').addEventListener('click', () => pick.click());
  document.querySelector('#filesAddDir').addEventListener('click', () => pickDir.click());
  for (const inp of [pick, pickDir]) inp.addEventListener('change', () => {
    const fs = [...inp.files].filter((f) => MEDIA.test(f.name)).map((f) => Object.assign(f, { relPath: f.webkitRelativePath || f.name }));
    fs.sort((a, b) => a.relPath.localeCompare(b.relPath, undefined, { numeric: true }));
    app.filesAdd(fs); inp.value = '';
  });
  document.querySelector('#filesClear').addEventListener('click', () => { files.length = 0; sel = -1; render(); });
  document.querySelector('#filesLoadA').addEventListener('click', () => app.filesLoad(0, 0));
  document.querySelector('#filesLoadB').addEventListener('click', () => app.filesLoad(1, 0));
  document.querySelector('#filesPreview').addEventListener('click', () => app.filesPreview(app.active));
  document.querySelector('#filesBtn').addEventListener('click', () => app.filesToggle());
  // files dropped anywhere but on a deck: into the list
  document.addEventListener('dragover', (e) => { if (!e.target.closest('canvas.deck')) e.preventDefault(); });
  document.addEventListener('drop', async (e) => {
    if (e.target.closest('canvas.deck')) return;
    e.preventDefault();
    const fs = await droppedFiles(e.dataTransfer);
    if (fs.length) app.filesAdd(fs);
  });
}

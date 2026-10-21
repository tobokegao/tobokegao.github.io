// ReaScratch Web — the setup's More page (⚪205, after the JSFX's setup More tab, cvd() L484-L584 / LSG L585-L593): every
// MIDI setting of the preset deck d is read with, by hand, in the JSFX's groups (web/js/more.json, made by
// tools/extract_more.mjs). The edited settings go into the deck as a user preset (as Learn's Apply) or into a
// .reascratch-preset file.
import { t } from './i18n.js';
import { CTL } from './learn.js';

const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
let MORE = null;
const loadMore = async () => MORE || (MORE = await (await fetch(new URL('./more.json', import.meta.url))).json());

// a deck's section of a .reascratch-preset file (the JSFX's Save: every setting of the file, by slider number)
export function presetText(name, deck, base, vals) {
  const L = [`name = ${name}`, `[deck ${deck}]`, `compared_with = ${base}`, '# controller settings: set on the web version\'s setup (More)'];
  for (const s of CTL) { const v = vals[s] ?? 0; L.push(`slider${s} = ${v === Math.floor(v) ? v : (+v).toFixed(4)}`); }
  return L.join('\n') + '\n';
}
export function download(text, fileName) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  a.download = fileName.replace(/[\\/:*?"<>|]/g, '_');
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return a.download;
}

export function initMore(app) {
  const dlg = document.querySelector('#more'), body = document.querySelector('#moreBody');
  app.openMore = async (d) => {
    const J = await loadMore();
    const base = app.midiPresetOf ? app.midiPresetOf(d) : null;
    if (!base) { app.decks[d].status(t('lnNoMidi')); return; }
    const vals = { ...base.cv, ...base.sliders };
    const deckNo = base.deck || d + 1, isUser = base.maker === 'user';
    let name = isUser ? base.name : `${base.name.replace(/ deck \d$| \(ch \d+\)$/, '')} (edited)`, changed = 0;
    const row = (s) => {
      const f = J.defs[s], v = vals[s] ?? f.def;
      const ctl = f.menu
        ? `<select data-s="${s}">${f.menu.map((o, i) => `<option value="${f.lo + i}"${v === f.lo + i ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`
        : `<input type="number" data-s="${s}" min="${f.lo}" max="${f.hi}" step="${f.st}" value="${v}">`;
      return `<label title="${esc(f.hl)}"><span>${esc(f.lb)}</span>${ctl}</label>`;
    };
    body.innerHTML = `<p class="note">${t('moreIntro')} <b>${esc(base.name)}</b> — ${t('deck')} ${d ? 'B' : 'A'}</p>
      ${J.groups.map((g, i) => `<details class="sgroup"${i === 0 ? ' open' : ''}><summary>${esc(g.name)}</summary><div class="form">${g.rows.map(row).join('')}</div></details>`).join('')}
      <div class="lnrow"><label>${t('lnName')} <input id="moreName" type="text" value="${esc(name)}"></label></div>
      <div class="lnrow"><button id="moreApply">Apply</button><button id="moreSave">Save</button></div>
      <p class="note">${t('moreHint')}</p><p id="moreMsg" class="big"></p>`;
    const all = [...body.querySelectorAll('.sgroup')];
    all.forEach((el) => { el.ontoggle = () => { if (el.open) all.forEach((o) => { if (o !== el) o.open = false; }); }; });
    const msg = (m) => { body.querySelector('#moreMsg').textContent = m; };
    body.querySelectorAll('[data-s]').forEach((el) => el.addEventListener('change', () => {
      const s = el.dataset.s, f = J.defs[s];
      let v = Math.round((+el.value || 0) / f.st) * f.st;
      v = Math.max(f.lo, Math.min(f.hi, v)); el.value = v;
      vals[s] = v; changed++; msg('');
    }));
    body.querySelector('#moreName').addEventListener('input', (e) => { name = e.target.value.trim(); });
    body.querySelector('#moreApply').addEventListener('click', () => {
      if (!name) { msg(t('lnNameFirst')); return; }
      const cv = {}, sl = {};
      for (const [s, v] of Object.entries(vals)) { if (J.defs[s] && J.defs[s].slider) sl[s] = v; else cv[s] = v; }
      app.midiUserAdd(d, name, deckNo, cv, sl);
      msg(`${t('lnApplied')} ${name} (deck ${deckNo})${changed ? '' : ` — ${t('moreNoChange')}`}`);
    });
    body.querySelector('#moreSave').addEventListener('click', () => {
      if (!name) { msg(t('lnNameFirst')); return; }
      msg(`${t('lnSaved')} ${download(presetText(name, deckNo, base.name, vals), `${name}.reascratch-preset`)}`);
    });
    dlg.showModal();
  };
}

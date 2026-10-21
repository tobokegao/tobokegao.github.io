// ReaScratch Web — the Learn page (⚪205, after the JSFX's setup Learn tab): a dialog that walks through the 17 steps of
// learn.js with the controller's MIDI, shows what came and the checks against the preset, puts the result into the deck
// (a user preset, kept in this browser), saves it as a .reascratch-preset file (REAPER's ReaScratch reads it too) and reads
// such a file back.
import { t } from './i18n.js';
import { Learn, STEPS, stepDef, sname, vs, parsePresetFile } from './learn.js';

const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;');
// a message in words (the Learn tab's "heard:" line)
export function midiWords(m) {
  const [m1, m2 = 0, m3 = 0] = m, st = m1 & 0xf0, ch = (m1 & 15) + 1;
  if (st === 0xb0) return `ch ${ch} CC ${m2} = ${m3}`;
  if (st === 0xe0) return `ch ${ch} pitch bend ${(m3 << 7) | m2}`;
  if (st === 0x90 && m3 > 0) return `ch ${ch} note ${m2} on (${m3})`;
  if (st === 0x90 || st === 0x80) return `ch ${ch} note ${m2} off`;
  return [...m].map((x) => x.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}
const MARK = { 1: '<b class="ok">✓</b>', 0: '<b class="ng">✗</b>', '-1': '<b class="na">–</b>' };
const now = () => performance.now() / 1000;

export function initLearn(app) {
  const dlg = document.querySelector('#learn'), body = document.querySelector('#learnBody');
  let L = null, d = 0, phase = '', base = null, timer = 0, cdeck = 1, name = '', msg = '';
  // the MIDI while a step waits is Learn's alone (the decks do not act on it, as in the JSFX)
  app.learnCap = (data) => {
    if (!L || !L.on || !dlg.open) return false;
    L.feed(data, now());
    return true;
  };
  const baseName = () => (base ? base.name : 'Custom');
  const snapOf = (p) => ({ ...(p ? p.cv : {}), ...(p ? p.sliders : {}) });

  function render() {
    const ph = !L || (!L.on && !L.sum) ? 'start' : L.on ? `step${L.k}` : 'sum';
    if (ph !== phase) { phase = ph; build(); }
    update();
  }
  function build() {
    const deckSel = `<label>${t('lnCdeck')} <select id="lnCdeck"><option value="1"${cdeck === 1 ? ' selected' : ''}>deck 1</option><option value="2"${cdeck === 2 ? ' selected' : ''}>deck 2</option></select></label>`;
    if (phase === 'start') {
      if (!L || !L.sum) base = app.midiPresetOf ? app.midiPresetOf(d) : null;   // (what Start will compare with)
      body.innerHTML = `<p>${t('lnIntro')}</p>
        <p class="note">${t('lnCompared')}: <b>${esc(baseName())}</b> — ${t('deck')} ${d ? 'B' : 'A'}</p>
        <p class="note">${t('lnSteps')}</p>
        <div class="lnrow">${deckSel}</div>
        <div class="lnrow"><button id="lnStart">Start</button>${L ? '<button id="lnLast">last result</button>' : ''}</div>`;
    } else if (phase === 'sum') {
      const rows = Array.from({ length: STEPS }, (_, k) => {
        const n = L.ok(k);
        return `<tr><td>${MARK[n]}</td><th>${esc(stepDef(k).lab)}</th><td>${esc(n === 1 ? 'same' : L.why(k))}</td></tr>`;
      }).join('');
      body.innerHTML = `<p class="note">${t('lnCompared')}: <b>${esc(baseName())}</b></p>
        <table class="lnsum">${rows}</table>
        <div class="lnrow"><label>${t('lnName')} <input id="lnName" type="text" value="${esc(name)}" placeholder="controller name"></label>${deckSel}</div>
        <div class="lnrow"><button id="lnApply">Apply</button><button id="lnSave">Save</button><button id="lnAgain">Again</button></div>
        <p class="note">${t('lnApplyHint')}</p><p id="lnMsg" class="big"></p>`;
    } else {
      const k = L.k;
      body.innerHTML = `<h3>${k + 1} / ${STEPS}&nbsp;&nbsp;${esc(L.lab)}</h3>
        <p class="lnins">${t('lnIns' + k)}</p>
        <p id="lnHeard" class="mono"></p><div id="lnRes"></div>
        <div class="lnrow"><button id="lnBack" title="${esc(t('lnBackHint'))}">Back</button><button id="lnRe" title="${esc(t('lnAgainHint'))}">Again</button>
        <button id="lnSkip" title="${esc(t('lnSkipHint'))}">Skip</button>${L.kind === 8 ? '<button id="lnDone">Done</button>' : ''}<button id="lnStop">Stop</button></div>`;
    }
    const on = (id, f) => { const el = body.querySelector(id); if (el) el.addEventListener('click', f); };
    const cd = body.querySelector('#lnCdeck');
    if (cd) cd.addEventListener('change', () => { cdeck = +cd.value; if (L) L.cdeck = cdeck; });
    const nm = body.querySelector('#lnName');
    if (nm) nm.addEventListener('input', () => { name = nm.value.trim(); });
    on('#lnStart', start);
    on('#lnLast', () => { L.sum = true; render(); });
    on('#lnBack', () => { L.back(); phase = ''; render(); });
    on('#lnRe', () => { L.again(); phase = ''; render(); });
    on('#lnSkip', () => { L.skip(now()); render(); });
    on('#lnDone', () => { L.done(now()); render(); });
    on('#lnStop', () => { L.stop(); render(); });
    on('#lnAgain', start);
    on('#lnApply', apply);
    on('#lnSave', save);
  }
  function update() {
    if (phase === 'sum') { const m = body.querySelector('#lnMsg'); if (m) m.textContent = msg; return; }
    if (!L || !L.on) return;
    const h = body.querySelector('#lnHeard'), r = body.querySelector('#lnRes');
    if (!h) return;
    let s = L.last ? `heard: ${midiWords(L.last)}   (${L.buf.length} messages)` : 'waiting for MIDI ...';
    if (L.last && L.kind === 8) { L.padsBest(); s += `  pads in a row: ${L.pl}`; }
    if (L.last && L.kind === 3 && L.bestN > 0) s += `  jog messages: ${L.bestN}`;
    h.textContent = s;
    if (L.finT > 0) {
      const res = L.res[L.k], n = L.ok(L.k);
      const why = n === 1 ? (res.rem === 2 ? 'same as the preset (jog type guessed from one direction)' : 'same as the preset') : L.why(L.k);
      const pairs = res.pairs.slice(0, 4).map(([a, b]) => `${esc(sname(a))} = ${esc(vs(a, b))}`).join('　');
      const html = `<p>${MARK[n]} ${esc(why)}</p><p class="note">${pairs}${L.k === 4 && res.st === 1 ? `　${res.a} ticks in the turn` : ''}</p>`;
      if (r.dataset.h !== html) { r.innerHTML = html; r.dataset.h = html; }
    } else if (r.dataset.h) { r.innerHTML = ''; r.dataset.h = ''; }
  }
  function start() {
    base = app.midiPresetOf ? app.midiPresetOf(d) : null;
    L = new Learn(snapOf(base), cdeck);
    msg = ''; phase = ''; render();
  }
  // Apply: the compared preset with the measured settings, as a user preset of this deck (the JSFX: Preset = Custom)
  function apply() {
    if (!app.midiUserAdd) { msg = t('lnNoMidi'); render(); return; }
    const m = L.applied(), cv = { ...(base ? base.cv : {}) }, sl = { ...(base ? base.sliders : {}) };
    for (const [s, v] of Object.entries(m)) { if (['33', '84', '85'].includes(s)) sl[s] = v; else cv[s] = v; }
    const nm = name || `Learn ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
    app.midiUserAdd(d, nm, cdeck, cv, sl);
    msg = `${t('lnApplied')} ${nm} (deck ${cdeck})`; render();
  }
  function save() {
    if (!name) { msg = t('lnNameFirst'); render(); const nm = body.querySelector('#lnName'); if (nm) nm.focus(); return; }
    const text = `name = ${name}\n${L.text(baseName())}`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    a.download = `${name.replace(/[\\/:*?"<>|]/g, '_')}.reascratch-preset`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    msg = `${t('lnSaved')} ${a.download}`; render();
  }

  app.openLearn = (deck) => {
    d = deck; cdeck = deck + 1;
    if (L && !L.on) L.sum = false;   // (the start page; its 'last result' shows the summary again)
    phase = ''; render();
    dlg.showModal();
    clearInterval(timer);
    timer = setInterval(() => { if (!dlg.open) { clearInterval(timer); return; } if (L) L.tick(now()); render(); }, 50);
  };
  // a .reascratch-preset file: each deck section a user preset; deck A gets its deck 1, deck B its deck 2 (a file of one
  // section: the deck whose setup is open)
  app.loadPresetFile = async (file, deck) => {
    if (!app.midiUserAdd) return t('lnNoMidi');
    const { name: nm, decks } = parsePresetFile(await file.text(), file.name);
    const secs = Object.keys(decks).map(Number).filter((k) => Object.keys(decks[k]).length);
    if (!secs.length) return t('lnBadFile');
    const custom = app.midiPresetOf ? app.midiPresetOf(-1) : null;
    for (const k of secs) {
      const cv = { ...(custom ? custom.cv : {}) }, sl = { ...(custom ? custom.sliders : {}) };
      for (const [s, v] of Object.entries(decks[k])) { if (['33', '84', '85'].includes(s)) sl[s] = v; else cv[s] = v; }
      app.midiUserAdd(secs.length === 1 ? deck : k - 1, nm, k, cv, sl);
    }
    return `${t('lnLoaded')} ${nm} (${secs.map((k) => `deck ${k}`).join(', ')})`;
  };
}

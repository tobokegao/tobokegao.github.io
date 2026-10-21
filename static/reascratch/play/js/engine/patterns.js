// ReaScratch Web — the built-in scratch patterns (⚪38), converted from kit/Scripts/ReaScratch/reascratch_patterns.lua
// (same names, menu groups, lengths and points; keep the two in step). A pattern: name, cat (menu group), beats
// (length), pos = record position points, fader = crossfader points (optional; none = open). A point = [beat, value,
// smooth]: pos value in beats of the sample from where the pattern went on (0 = there, 0.5 = half a beat further), fader
// value 0 (closed) .. 1 (open); smooth 1 = a curve through the point (eases in and out), 0 = a corner (straight lines).
// The PATTERN pads (pad mode 13, ⚪115) play them: deck.js patPad / patSet, as the JSFX's pt_* (L1729-L1795).

// the fader closed between a and b (beats), short ramps so it clicks without a pop; rest open (cuts() in the Lua)
function cuts(list) {
  const f = [], r = 0.01;
  list.forEach((c, i) => {
    if (c[0] <= 0) f.push([0, 0, 0]);                 // closed from the start
    else {
      if (i === 0) f.push([0, 1, 0]);
      f.push([c[0], 1, 0]); f.push([c[0] + r, 0, 0]);
    }
    f.push([c[1] - r, 0, 0]); f.push([c[1], 1, 0]);
  });
  return f;
}

export const PATTERNS = [];
const add = (p) => PATTERNS.push(p);

add({ name: 'Baby', cat: 'Basic', beats: 1, pos: [[0, 0, 1], [0.5, 0.5, 1], [1, 0, 1]] });
add({ name: 'Baby x2', cat: 'Basic', beats: 1, pos: [[0, 0, 1], [0.25, 0.25, 1], [0.5, 0, 1], [0.75, 0.25, 1], [1, 0, 1]] });
add({ name: 'Drag (slow)', cat: 'Basic', beats: 2, pos: [[0, 0, 1], [1.5, 0.5, 1], [2, 0, 1]] });
add({ name: 'Stab', cat: 'Basic', beats: 1, pos: [[0, 0, 0], [0.2, 0.5, 1], [0.5, 0.5, 1], [1, 0, 1]], fader: cuts([[0.25, 1]]) });
add({ name: 'Forward', cat: 'Basic', beats: 1, pos: [[0, 0, 1], [0.5, 0.5, 1], [1, 0, 1]], fader: cuts([[0.5, 1]]) });
add({ name: 'Backward', cat: 'Basic', beats: 1, pos: [[0, 0, 1], [0.5, 0.5, 1], [1, 0, 1]], fader: cuts([[0, 0.5]]) });
{   // scribble: small fast wiggles
  const pos = [[0, 0, 1]];
  for (let i = 1; i <= 16; i++) pos.push([i / 16, i % 2 === 1 ? 0.06 : 0, 1]);
  add({ name: 'Scribble', cat: 'Basic', beats: 1, pos });
}
add({ name: 'Chirp', cat: 'Chirp', beats: 1, pos: [[0, 0, 1], [0.5, 0.4, 1], [1, 0, 1]], fader: cuts([[0.42, 0.58], [0.92, 1]]) });
add({ name: 'Chirp x2', cat: 'Chirp', beats: 1, pos: [[0, 0, 1], [0.25, 0.25, 1], [0.5, 0, 1], [0.75, 0.25, 1], [1, 0, 1]],
  fader: cuts([[0.2, 0.3], [0.45, 0.55], [0.7, 0.8], [0.95, 1]]) });
add({ name: 'Tear', cat: 'Tear', beats: 1, pos: [[0, 0, 1], [0.4, 0.5, 1], [0.55, 0.25, 1], [0.65, 0.25, 0], [0.95, 0, 1], [1, 0, 0]] });
add({ name: 'Tear (3 steps)', cat: 'Tear', beats: 1, pos: [[0, 0, 1], [0.3, 0.45, 1], [0.42, 0.3, 1], [0.5, 0.3, 0], [0.62, 0.15, 1], [0.7, 0.15, 0], [0.85, 0, 1], [1, 0, 0]] });
add({ name: 'Flare (1 click)', cat: 'Flare', beats: 1, pos: [[0, 0, 1], [0.5, 0.5, 1], [1, 0, 1]], fader: cuts([[0.23, 0.28], [0.73, 0.78]]) });
add({ name: 'Flare (2 clicks)', cat: 'Flare', beats: 1, pos: [[0, 0, 1], [0.5, 0.5, 1], [1, 0, 1]],
  fader: cuts([[0.15, 0.2], [0.32, 0.37], [0.65, 0.7], [0.82, 0.87]]) });
add({ name: 'Crab', cat: 'Flare', beats: 1, pos: [[0, 0, 1], [0.5, 0.5, 1], [1, 0, 1]],
  fader: cuts([[0.06, 0.1], [0.16, 0.2], [0.26, 0.3], [0.36, 0.4], [0.56, 0.6], [0.66, 0.7], [0.76, 0.8], [0.86, 0.9]]) });
{   // transformer: a slow drag, the fader on the 16ths
  const c = [];
  for (let i = 0; i <= 15; i++) if (i % 2 === 1) c.push([i / 8, (i + 1) / 8]);
  add({ name: 'Transformer', cat: 'Transform', beats: 2, pos: [[0, 0, 1], [1, 0.75, 1], [2, 0, 1]], fader: cuts(c) });
}
add({ name: 'Hold (freeze 1 beat)', cat: 'Stutter', beats: 1, pos: [[0, 0, 0], [1, 0, 0]] });
// freeze and stutter (⚪45): a freeze keeps the grain where the pattern went on; a stutter plays the first `step` beats
// at 1x and jumps back, `n` times, with a short fader cut over each jump (the jump itself would be a fast rewind)
add({ name: 'Freeze (2 beats)', cat: 'Stutter', beats: 2, pos: [[0, 0, 0], [2, 0, 0]] });
function stutter(name, step, n) {
  const pos = [], c = [];
  for (let i = 0; i < n; i++) {
    const t = i * step;
    pos.push([t, 0, 0]);
    pos.push([t + step - 0.002, step - 0.002, 0]);
    if (i > 0) c.push([t - 0.02, t + 0.02]);
  }
  pos.push([n * step, step, 0]);
  add({ name, cat: 'Stutter', beats: n * step, pos, fader: cuts(c) });
}
stutter('Stutter 16th', 0.25, 4);
stutter('Stutter 8th', 0.5, 4);
stutter('Stutter 32nd roll', 0.125, 8);
stutter('Stutter 8th (1 beat)', 0.5, 2);

// the pads' patterns by default (reascratch_lib.lua M.PAD_PATTERNS; reascratch_pattern.lua's menu changes them)
export const PAD_PATTERNS = ['Baby', 'Baby x2', 'Chirp', 'Tear', 'Flare (1 click)', 'Crab', 'Transformer', 'Stutter 16th'];
export const PAD_DEFAULT = PAD_PATTERNS.map((n) => PATTERNS.findIndex((p) => p.name === n));
// the room the JSFX's layout has for a pattern's points (reascratch_lib.lua PT_POS / PT_FAD): more are not read
export const PT_POS = 80, PT_FAD = 40;

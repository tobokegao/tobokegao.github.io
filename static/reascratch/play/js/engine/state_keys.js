// ReaScratch Web — the state's numbers the worklet posts (processor.js), in this order in each deck's part of the
// Float64Array; main.js turns them back into fields. For the controller lights (midi.js ledWant): the roll and its
// pad, the held reverse's speed, the held move pad, PITCH PLAY's key; uiLag / uiAvg: the hand's goal ahead of the head
// (s) and the engine's idea of the time between the hand's moves (ms), how far a scratch trails the finger; relV: the
// speed (x) the last hand let go at; pzWait: a quantized PAUSE waits for its step (PLAY blinks); mtOn: this deck's metronome
// on / off as it counts (the N lamp), mtAct: this deck clicks now, mtAge: s since its last click (the glow, L8344)
// pfl: this deck's headphone cue on / off; pat: the PATTERN pad's pattern playing (an index into patterns.js PATTERNS,
// -2 a pattern given as an object, -1 none); patPad: the pad (0-7) playing or waiting for its beat (-1 none; the bright
// pad, L4173); pqWait: a quantized PLAY waits for the other deck's beat (⚪36); gbN: the anchors of the slot's beat map
// (0 = one grid by bpm / grid). After both decks' numbers: the two loads, the cue mix (0-1) and the cue limiter (dB)
export const FAST = ['pos', 'len', 'playing', 'cue', 'speed', 'gain', 'xfGain', 'xfGoal', 'tch', 'slip', 'slipPos', 'tempo',
  'bpm', 'grid', 'beat', 'lag', 'q', 'sync', 'blBeats', 'cur', 'qAt', 'rev', 'uiLag', 'uiAvg', 'blRoll', 'blPad', 'rvF', 'mvp', 'ppK', 'relV',
  'pzWait', 'mtOn', 'mtAct', 'mtAge', 'pfl', 'pat', 'patPad', 'pqWait', 'gbN'];

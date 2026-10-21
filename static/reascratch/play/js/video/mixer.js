// ReaScratch Web — the video mixer: deck A and B mixed by the crossfader (blends, transitions, camera moves), each
// deck's video FX, the master FX, the filter look and the output, in WebGL2.
// A port of kit/Scripts/ReaScratch/reascratch_deck_mix.eel (cited DM:nnn) after spec/video_spec.md (cited §n).
// JS:nnn = kit/Effects/ReaScratch/reascratch.jsfx.
//
// Usage:
//   const mx = new Mixer(canvas);            // throws when WebGL2 (or a shader) is not available: keep Canvas2D then
//   mx.render([bitmapA, bitmapB], st);       // once per drawn frame (rAF). A frame may be null: the deck's last one is kept
//
// st (all optional; REAPER's gmem index in brackets):
//   gA, gB          deck picture gains 0..1 (crossfader goal x xp_w, JS:5081-5124)            [0] [1]
//   flip            [{n, g}, {n, g}] crossfader flip counter and its gain (held 2 frames, DM:78-83)  [7]/[8] [27]/[28]
//   xfPlace         crossfader place 0 (A end) .. 1 (B end), -1 = none                         [142]
//   lastEnd         last end reached (0 / 1)                                                    [143]
//   blend           JSFX blend index 0..37 (§2.3; Mixer.BLENDS then Mixer.TRANSITIONS)          [2]
//   blendUnder      0 none, 1..8 the blend that comes in under a transition                     [188]
//   keyThresh, keySoft   luma / chroma key threshold (0.30) and softness (0.10)                 [3] [4]
//   fx[d]           per deck: {type, amount, beat (-1 = no BPM), bpm, lamp (0 yellow, 1 blue), knobs[8] (types 1,2,3,4,5,6,8,9),
//                   echo, crush, vib (fader amounts -> Trails, LoRez, raster wave), vhs (VHS knob), touch[4] (types 12..15),
//                   lfo {shape 0..4, rate 0..5, depth 0..1}, tintDark, tintLight (palette 0..14, defaults 0 / 2),
//                   strobeStep (-1 by amount, 0..4), turns (platter turns, Disc), vhsColor (1 blue-white / 0 pink), osd (0/1),
//                   moving (head moved this block, default true), clip (a counter: a change resets trails / history)}
//   masterFx        {type, amount} on the mix (deck A's beat / lamp / LFO / colours)                [5] [6]
//   time            seconds (clock-driven effects); default performance.now()/1000
//   fade            [fadeA, fadeB] picture fade 1 - opacity                                      [32] [33]
//   tilt            [tiltA, tiltB] filter tilt -1 lows .. +1 highs (the look, §2.6)             [34] [35]
//   cam             {blur 0.6, overshoot 1, shake 0.7} camera moves (deck A's setup)           [131] [132] [133]
//   boost           helper FX boost 0..1                                                         [241]
//   level           master level cut 0..1 (black over)                                           [242]
//   blackout        0 / 1                                                                         [243]

// ---------------------------------------------------------------------------------------------------------------------
// names (index = the JSFX's slider78 value for BLENDS / TRANSITIONS: TRANSITIONS[i] has JSFX index 9 + i; EFFECTS[t])
const BLENDS = ['Mix', 'Add', 'Subtract', 'Multiply', 'Overlay', 'Soft light', 'Hard light', 'Luma key', 'Chroma key'];
const TRANSITIONS = ['Wipe right', 'Wipe down', 'Wipe diagonal', 'Split', 'Slide', 'Blinds', 'Iris box', 'Iris diamond',
  'Iris circle', 'Clock', 'Blocks', 'Dip to black', 'Dip to white', 'Pixelate', 'Zoom', 'Punch zoom', 'Whip right', 'Whip up',
  'Whip down', 'Shake cut', 'Spin zoom', 'Drop bounce', 'Tilt right', 'Tilt down', 'Brush wipe', 'Defocus',
  'Picture in picture', 'Shatter', 'PiP to corner'];
const EFFECTS = ['Off', 'Tint', 'Hue rotate', 'Invert', 'Threshold', 'Mirror', 'Kaleidoscope', 'LoRez', 'Shift RGB', 'Strobe',
  'Trails', 'VHS', 'Disc', 'Line art', 'Halftone', 'Zoom blur'];

// JSFX index -> internal m (DM:89, §2.3)
export function blendIndex(i) {
  const m = Math.max(0, Math.min(37, i | 0));
  return m <= 12 ? m : m <= 25 ? m + 1 : m <= 30 ? m + 2 : m === 31 ? 33 : m === 32 ? 36 : m + 4;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clamp01 = (v) => clamp(v, 0, 1);
const hash = (x) => { const v = Math.sin(x) * 43758.5453; return v - Math.floor(v); };   // DM:126 (double, as EEL2)
const sstep = (c) => c * c * (3 - 2 * c);
// the Tint palette (DM:324-335)
function tpal(i, col) {
  switch (i | 0) {
    case 1: return [1, 1, 1];
    case 2: return col ? [0.31, 0.70, 0.88] : [0.98, 0.84, 0.26];
    case 3: return [0.95, 0.15, 0.15]; case 4: return [1, 0.55, 0.1]; case 5: return [1, 0.9, 0.15];
    case 6: return [0.65, 0.95, 0.2]; case 7: return [0.1, 0.75, 0.3]; case 8: return [0.1, 0.9, 0.95];
    case 9: return [0.45, 0.75, 1]; case 10: return [0.15, 0.35, 1]; case 11: return [0.05, 0.08, 0.35];
    case 12: return [0.55, 0.2, 0.9]; case 13: return [1, 0.15, 0.85]; case 14: return [1, 0.55, 0.75];
    default: return [0, 0, 0];
  }
}
// VHS filter coefficient (DM:498)
const vnAl = (cut) => (1 / 14318181.8) / (1 / (2 * Math.PI * cut) + 1 / 14318181.8);

// ---------------------------------------------------------------------------------------------------------------------
// shaders. Convention: a texture's row 0 is the picture's top row; gl_FragCoord.xy is the pixel position with y DOWN in
// picture space (FBO row 0 = texture row 0). Only the present pass flips to the canvas. Pixel centres are at i + 0.5,
// as the EEL's (i + 0.5) * scale in its evalrect mask builders.
const VS = `#version 300 es
void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;

const HEAD = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D;
uniform vec2 uRes;
out vec4 fragColor;
const float PI = 3.14159265358979;
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float hash(float x) { return fract(sin(x) * 43758.5453); }
float sstep(float c) { return c * c * (3.0 - 2.0 * c); }
vec2 tsz(sampler2D s) { return vec2(textureSize(s, 0)); }
vec4 at(sampler2D s, vec2 p) { return texture(s, p / tsz(s)); }
vec4 px(sampler2D s, ivec2 i) { return texelFetch(s, clamp(i, ivec2(0), textureSize(s, 0) - 1), 0); }
uint pcg(uint v) { uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
`;

const FS = {
  // a deck frame fitted into W x H keeping its aspect (gfx_blit(in, 1), filtered: DM:109, §5.2)
  fit: `uniform sampler2D uS;
void main() {
  vec2 z = tsz(uS), fc = gl_FragCoord.xy; float k = min(uRes.x / z.x, uRes.y / z.y); vec2 d = z * k, o = (uRes - d) * 0.5;
  vec2 cv = clamp(min(fc - o, o + d - fc) + 0.5, 0.0, 1.0);
  fragColor = vec4(texture(uS, clamp((fc - o) / d, 0.0, 1.0)).rgb * cv.x * cv.y, 1.0);
}`,
  // sum of up to three pictures (additive blits / alpha-over as weights), clamped; bit n of uNear = texture n nearest
  comp: `uniform sampler2D u0, u1, u2; uniform float k0, k1, k2; uniform int uNear;
vec3 s(sampler2D t, bool nr) {
  vec2 uv = gl_FragCoord.xy / uRes;
  if (nr) { ivec2 z = textureSize(t, 0); return texelFetch(t, clamp(ivec2(floor(uv * vec2(z))), ivec2(0), z - 1), 0).rgb; }
  return texture(t, uv).rgb;
}
void main() {
  vec3 c = vec3(0.0);
  if (k0 != 0.0) c += s(u0, (uNear & 1) != 0) * k0;
  if (k1 != 0.0) c += s(u1, (uNear & 2) != 0) * k1;
  if (k2 != 0.0) c += s(u2, (uNear & 4) != 0) * k2;
  fragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`,
  // box-filtered downscale: uN x uN bilinear taps over each destination pixel's footprint (a 2x2 mean per tap)
  down: `uniform sampler2D uS; uniform int uN;
void main() {
  vec2 z = tsz(uS), f = z / uRes, c = gl_FragCoord.xy * f; vec3 a = vec3(0.0);
  for (int j = 0; j < 8; j++) { if (j >= uN) break;
    for (int i = 0; i < 8; i++) { if (i >= uN) break;
      a += texture(uS, (c + ((vec2(i, j) + 0.5) / float(uN) - 0.5) * f) / z).rgb; } }
  fragColor = vec4(a / float(uN * uN), 1.0);
}`,
  // 3 x 3 box (la_box, DM:402)
  box3: `uniform sampler2D uS;
void main() {
  ivec2 ip = ivec2(gl_FragCoord.xy); vec3 a = vec3(0.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) a += px(uS, ip + ivec2(i, j)).rgb;
  fragColor = vec4(a / 9.0, 1.0);
}`,
  // Line art's edges (DM:418): r = the edge, g = the inverted luma (body)
  laedge: `uniform sampler2D uS;
void main() {
  ivec2 ip = ivec2(gl_FragCoord.xy);
  float L = luma(px(uS, ip).rgb) * 255.0, Lr = luma(px(uS, ip + ivec2(1, 0)).rgb) * 255.0, Ld = luma(px(uS, ip + ivec2(0, 1)).rgb) * 255.0;
  float e = clamp((abs(L - Lr) + abs(L - Ld) - 3.0) * (7.0 / 255.0), 0.0, 1.0);
  fragColor = vec4(pow(e, 0.8), 1.0 - L / 255.0, 0.0, 1.0);
}`,
  // Line art's result at full size (DM:424-434)
  lafinal: `uniform sampler2D uE, uG; uniform float uD;
void main() {
  vec2 uv = gl_FragCoord.xy / uRes; vec2 eb = texture(uE, uv).rg; float g = texture(uG, uv).r; float v;
  if (uD < 3.0) v = eb.r + 0.7 * g + 0.3 * eb.g;
  else v = clamp((eb.r - 110.0 / 255.0) * uD * 0.5 + 110.0 / 255.0, 0.0, 1.0) + clamp(0.7 * g + 0.3 * eb.g, 0.0, 1.0);
  fragColor = vec4(vec3(clamp(v, 0.0, 1.0)), 1.0);
}`,
  // the blends 1..8 (bl_draw, DM:1266-1285, §2.4)
  blend: `uniform sampler2D uA, uB; uniform int uM; uniform float uTh, uSoft;
float ov(float a, float b) { return a * 255.0 < 128.0 ? 2.0 * a * b : 1.0 - 2.0 * (1.0 - a) * (1.0 - b); }
void main() {
  vec2 uv = gl_FragCoord.xy / uRes; vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb, c = a;
  if (uM == 1) c = min(vec3(1.0), a + b);
  else if (uM == 2) c = max(vec3(0.0), a - b);
  else if (uM == 3) c = a * b;
  else if (uM == 4) c = vec3(ov(a.r, b.r), ov(a.g, b.g), ov(a.b, b.b));
  else if (uM == 5) c = (1.0 - 2.0 * b) * a * a + 2.0 * a * b;
  else if (uM == 6) c = vec3(ov(b.r, a.r), ov(b.g, a.g), ov(b.b, a.b));
  else if (uM == 7) { float k = clamp((luma(b) - uTh) / max(uSoft, 0.001), 0.0, 1.0); c = mix(a, b, k); }
  else if (uM == 8) {
    // APPROXIMATION: REAPER's gfx_keyedblit(B, kv1 5.7, kv2 -3, kv3 (th - 0.3) * 4, kv4 1) in RGBA has no published formula
    // (§2.4). A green key: the greenness over the stronger of red / blue against a threshold moved by the key threshold,
    // 5.7 x as steep; the green spill of the kept part pulled down. Needs a visual match against REAPER's screenshots.
    float gk = b.g - max(b.r, b.b), thr = 0.12 + (uTh - 0.3) * 0.4;
    float key = clamp((gk - thr) * 5.7, 0.0, 1.0);
    vec3 bs = vec3(b.r, min(b.g, max(b.r, b.b) + max(thr, 0.0)), b.b);
    c = mix(bs, a, key);
  }
  fragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`,
  // the mask and picture transitions (tr_draw, DM:165-222, §2.5) and the PiPs (nt_pip, DM:1101)
  trans: `uniform sampler2D uA, uB; uniform int uM, uMr; uniform float uP, uSoft; uniform vec4 uRect; uniform vec4 uBlk[36];
void main() {
  float W = uRes.x, H = uRes.y, p = uP; vec2 fc = gl_FragCoord.xy; vec2 uv = fc / uRes;
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb, T = A;
  if (uM == 14) {   // Slide: B in from the left (mirrored going back)
    float ox = uMr == 1 ? W - p * W : p * W - W; float x = fc.x - ox;
    if (x >= 0.0 && x < W) T = texture(uB, vec2(x, fc.y) / uRes).rgb;
  } else if (uM == 21 || uM == 22) {   // Dip to black / white
    vec3 s = p < 0.5 ? A : B; float qa = p < 0.5 ? 2.0 * p : 2.0 - 2.0 * p;
    T = mix(s, vec3(uM == 22 ? 1.0 : 0.0), qa);
  } else if (uM == 23) {   // Pixelate: filtered down, nearest up
    float qf = 1.0 + 31.0 * (1.0 - abs(2.0 * p - 1.0)); vec2 q = max(vec2(1.0), floor(uRes / qf));
    vec2 cell = floor(fc * q / uRes); vec2 suv = (cell + 0.5) / q;
    T = p < 0.5 ? texture(uA, suv).rgb : texture(uB, suv).rgb;
  } else if (uM == 24) {   // Zoom: A grown 1 + p, B from 2 - p over it at alpha p
    vec2 C = uRes * 0.5;
    T = mix(texture(uA, (C + (fc - C) / (1.0 + p)) / uRes).rgb, texture(uB, (C + (fc - C) / (2.0 - p)) / uRes).rgb, p);
  } else if (uM == 39 || uM == 41) {   // PiP: B behind, A in the window (rect computed in JS)
    T = B;
    if (uRect.z >= 1.0) { vec2 l = (fc - uRect.xy) / uRect.zw; if (l.x >= 0.0 && l.y >= 0.0 && l.x < 1.0 && l.y < 1.0) T = texture(uA, l).rgb; }
  } else {
    float x = fc.x, y = fc.y, mask;
    if (uMr == 1) x = W - x;
    float cx = W * 0.5, cy = H * 0.5, qf = 1.0 + clamp(uSoft, 0.0, 1.0) * 40.0, qmg = qf + 2.0, d = 0.0, e;
    if (uM == 20) {   // Blocks: hard 16 x 9 cells (the per-cell hashes come from JS in double precision, as EEL2)
      int i = int(clamp(floor(fc.x / (W / 16.0)), 0.0, 15.0)), j = int(clamp(floor(fc.y / (H / 9.0)), 0.0, 8.0));
      int bi = j * 16 + i; mask = uBlk[bi / 4][bi % 4] < p ? 1.0 : 0.0;
    } else {
      if (uM == 9) { e = -qmg + p * (W + 2.0 * qmg); d = e - x; }
      else if (uM == 10) { e = -qmg + p * (H + 2.0 * qmg); d = e - y; }
      else if (uM == 11) { e = -qmg - H * 0.6 + p * (W + H * 0.6 + 2.0 * qmg); d = (e + (1.0 - y / H) * 0.6 * H - x) / sqrt(1.36); }
      else if (uM == 12) { e = -qmg + p * (W * 0.5 + qmg); d = e - abs(x - cx); }
      else if (uM == 15) { float bh = H / 8.0; e = p * (bh + qmg) - qmg * 0.5; d = e - (y - floor(y / bh) * bh); }
      else if (uM == 16) { float w2 = -qmg * 0.5 + p * (W * 0.5 + qmg), h2 = w2 * H / W; d = min(w2 - abs(x - cx), h2 - abs(y - cy)); }
      else if (uM == 17) { float ax = 2.0 / W, ay = 2.0 / H, n = 1.0 / sqrt(ax * ax + ay * ay), qa = qmg / n; e = -qa * 0.5 + p * (2.0 + qa);
                           d = (e - abs(x - cx) * ax - abs(y - cy) * ay) * n; }
      else if (uM == 18) { e = -qmg * 0.5 + p * (sqrt(cx * cx + cy * cy) + qmg); d = e - length(vec2(x - cx, y - cy)); }
      else {   // 19 Clock: from 12, clockwise
        e = p * 2.0 * PI; float dx = x - cx, dy = y - cy, th = atan(dx, -dy); if (th < 0.0) th += 2.0 * PI; float r = length(vec2(dx, dy));
        d = e >= 2.0 * PI - 0.0001 ? 1000.0 : th < e ? min(th, e - th) * r : -min(th - e, 2.0 * PI - th) * r;
      }
      mask = clamp(0.5 + d / qf, 0.0, 1.0);
    }
    T = A * (1.0 - mask) + B * mask;
  }
  fragColor = vec4(T, 1.0);
}`,
  // a camera move's picture (cm_put, DM:920-938): centre uC, zoom uSc, turn uR; black outside (antialiased edge)
  cmput: `uniform sampler2D uS; uniform vec2 uPic, uC; uniform float uSc, uR;
void main() {
  vec2 d = gl_FragCoord.xy - uC; float c = cos(uR), s = sin(uR), sc = max(0.05, uSc);
  vec2 l = uPic * 0.5 + vec2(c * d.x + s * d.y, -s * d.x + c * d.y) / sc;
  vec2 cv = clamp(min(l, uPic - l) * sc + 0.5, 0.0, 1.0);
  fragColor = vec4(texture(uS, clamp(l / uPic, 0.0, 1.0)).rgb * cv.x * cv.y, 1.0);
}`,
  // the camera moves' motion blur (cm_mb, DM:950-978): REAPER 4 passes x 3 taps = 81 even steps of f in [-0.5, 0.5]
  // along the move; here one pass of 33 taps over the same range (each tap moved, turned, zoomed round uQc)
  cmblur: `uniform sampler2D uS; uniform float uM, uDr, uDs; uniform vec2 uQc, uD;
void main() {
  vec2 p = gl_FragCoord.xy + uM, z = tsz(uS); vec3 a = vec3(0.0);
  for (int i = 0; i < 33; i++) {
    float f = float(i) / 32.0 - 0.5, k = exp(-uDs * f), c = cos(uDr * f), s = sin(uDr * f);
    vec2 q = p - uQc - uD * f, src = uQc + k * vec2(c * q.x + s * q.y, -s * q.x + c * q.y);
    a += (src.x < 0.0 || src.y < 0.0 || src.x > z.x || src.y > z.y) ? vec3(0.0) : texture(uS, src / z).rgb;
  }
  fragColor = vec4(a / 33.0, 1.0);
}`,
  // Brush wipe card (br_draw, DM:1022-1071): the card's mask worked out analytically from the knot list
  brush: `uniform sampler2D uTop, uBot; uniform vec2 uXY0; uniform float uC, uSn, uXa, uXb, uAm, uFi; uniform int uRv, uNk;
uniform float uKy[32]; uniform float uKx[32];
void main() {
  vec2 fc = gl_FragCoord.xy; float W = uRes.x, H = uRes.y; vec3 bot = texture(uBot, fc / uRes).rgb, top;
  float X = uXY0.x + uC * fc.x + uSn * fc.y, Y = uXY0.y - uSn * fc.x + uC * fc.y, mask = 1.0;
  if (fc.x >= uXa && fc.x < uXb) {
    int n = 0; for (int i = 0; i < 31; i++) { if (i + 1 >= uNk) break; if (Y > uKy[i + 1]) n = i + 1; }
    n = min(n, max(0, uNk - 2));
    float y0 = uKy[n], y1 = uKy[n + 1], x0 = uKx[n], x1 = uKx[n + 1], dy = max(1.0, y1 - y0);
    float z = uAm + (x0 + (x1 - x0) * (Y - y0) / dy) * uAm, sl = (x1 - x0) * uAm / dy;
    float Xm = uRv == 1 ? W - X : X;
    mask = clamp(0.5 + (z - Xm) / sqrt(1.0 + sl * sl) * uFi, 0.0, 1.0);
  }
  top = texture(uTop, clamp(vec2(X, Y), vec2(0.5), uRes - 0.5) / uRes).rgb;   // the card's edges padded (pad_cp)
  fragColor = vec4(mix(top, bot, mask), 1.0);
}`,
  // the per-pixel video FX (vfx, DM:528-745, §3.2): 1 Tint, 2 Hue, 3 Invert, 4 Threshold, 5 Mirror, 6 Kaleidoscope,
  // 7 LoRez, 8 Shift RGB, 9 black (Strobe), 12 Disc, 14 Halftone, 15 Zoom blur
  fx: `uniform sampler2D uS; uniform int uT, uN; uniform float uK, uA, uSp, uD; uniform vec2 uO; uniform vec3 uDark, uLight; uniform mat3 uHue;
void main() {
  vec2 fc = gl_FragCoord.xy; float W = uRes.x, H = uRes.y; ivec2 ip = ivec2(fc); vec3 c = at(uS, fc).rgb;
  if (uT == 1) { float L = luma(c); c = c + (uDark + L * uLight - c) * uK; }
  else if (uT == 2) c = uHue * c;
  else if (uT == 3) c = c + (1.0 - 2.0 * c) * uK;
  else if (uT == 4) { float b = luma(c) * 255.0 > 127.0 ? 1.0 : 0.0; c += (b - c) * uK; }
  else if (uT == 5) {   // Mirror (DM:559-567)
    int d = int(floor(W * 0.5)); if (ip.x >= d) ip.x = 2 * d - 1 - ip.x;
    if (uK >= 0.5) { int e = int(floor(H * 0.5)); if (ip.y >= e) ip.y = 2 * e - 1 - ip.y; }
    c = px(uS, ip).rgb;
  } else if (uT == 6) {   // Kaleidoscope (DM:568-591; per pixel instead of the 49 x 29 grid)
    float seg = 2.0 * PI / float(uN); vec2 v = fc - uRes * 0.5; float r = length(v) * 0.85, a = atan(v.y, v.x) + uA;
    a -= floor(a / seg) * seg; if (a > seg * 0.5) a = seg - a;
    vec2 s = vec2(W * 0.5, H * 0.62) + r * vec2(cos(a - seg * 0.25 - PI * 0.5), sin(a - seg * 0.25 - PI * 0.5));
    if (s.x < 0.0) s.x = -s.x; if (s.x > W - 1.0) s.x = 2.0 * (W - 1.0) - s.x;
    if (s.y < 0.0) s.y = -s.y; if (s.y > H - 1.0) s.y = 2.0 * (H - 1.0) - s.y;
    c = at(uS, clamp(s, vec2(0.0), uRes - 1.0) + 0.5).rgb;
  } else if (uT == 7) {   // LoRez (DM:592-605): blocks from the centre, each read at its middle (bilinear: a 2x2 mean)
    vec2 b = floor((floor(fc) + uO) / uD); c = at(uS, clamp((b + 0.5) * uD - uO, vec2(0.5), uRes - 0.5)).rgb;
  } else if (uT == 8) {   // Shift RGB (DM:606-621): red from x + d, blue from x - d, the vacated strips keep their own
    int d = int(uD), w = int(W);
    if (d >= 1) c = vec3(px(uS, ivec2(ip.x < w - d - 3 ? ip.x + d : ip.x, ip.y)).r, c.g, px(uS, ivec2(ip.x >= d + 3 ? ip.x - d : ip.x, ip.y)).b);
  } else if (uT == 9) c = vec3(0.0);
  else if (uT == 12) {   // Disc (DM:346-383): the record mask, the picture turned (and blurred along the arc)
    float R = H * 0.47, hole = H * 0.012, rr = R - H * 0.012, ri = 1.0 / max(1.0, H * 0.006), r1 = R * 0.62, r2 = R * 0.8, ti = 1.0 / max(1.0, H * 0.003);
    vec2 C = uRes * 0.5, dv = fc - C; float dd = length(dv);
    float m = clamp(R - dd + 0.5, 0.0, 1.0) * clamp(dd - hole + 0.5, 0.0, 1.0);
    m *= (1.0 - 0.5 * max(0.0, 1.0 - abs(dd - rr) * ri)) * (1.0 - 0.3 * (max(0.0, 1.0 - abs(dd - r1) * ti) + max(0.0, 1.0 - abs(dd - r2) * ti)));
    vec3 a = vec3(0.0);
    for (int i = 0; i < 24; i++) { if (i >= uN) break;
      float aa = uA - (uN > 1 ? uSp * float(i) / float(uN - 1) : 0.0), cs = cos(aa), sn = sin(aa);
      a += at(uS, C + vec2(cs * dv.x + sn * dv.y, -sn * dv.x + cs * dv.y)).rgb; }
    c = a / float(uN) * m;
  } else if (uT == 14) {   // Halftone (DM:446-468): black dots on white, as large as the cell is dark
    float cc = uD; vec2 q = floor(fc) + uO, cell = floor(q / cc), ctr = (cell + 0.5) * cc - uO, o = vec2(cc * 0.25);
    vec3 m4 = at(uS, clamp(ctr + vec2(-o.x, -o.y), vec2(0.5), uRes - 0.5)).rgb + at(uS, clamp(ctr + vec2(o.x, -o.y), vec2(0.5), uRes - 0.5)).rgb
            + at(uS, clamp(ctr + vec2(-o.x, o.y), vec2(0.5), uRes - 0.5)).rgb + at(uS, clamp(ctr + o, vec2(0.5), uRes - 0.5)).rgb;
    float L = clamp(luma(m4 * 0.25), 0.0, 1.0), rad = sqrt(1.0 - L) * 0.74;
    vec2 l = (q + 0.5) / cc; l -= floor(l) + 0.5; float dist = min(0.75, length(l));
    c = vec3(1.0 - clamp((rad - dist) * cc + 0.5, 0.0, 1.0));
  } else if (uT == 15) {   // Zoom blur (DM:473-485): REAPER 256 steps from 4 x 4 blits at half size; here 48 taps at full size
    vec2 C = uRes * 0.5; vec3 a = vec3(0.0);
    for (int i = 0; i < 48; i++) a += at(uS, C + (fc - C) / pow(1.0 + 0.35 * uK, float(i) / 47.0)).rgb;
    c = a / 48.0;
  }
  fragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`,
  // the vibrato fader's raster wave (DM:225-287, §3.2): columns moved up and down, the picture shrunk by the wave's height
  raster: `uniform sampler2D uS; uniform float uL, uN;
float rw(float ph) { return 0.7 * cos(ph) + 0.3 * (1.0 - 2.0 * abs(sin(ph * 0.5))); }
void main() {
  float W = uRes.x, H = uRes.y; vec2 fc = gl_FragCoord.xy; float a0 = uL * 0.016 * H, f = (H - 1.0 + 2.0 * a0) / (H - 1.0);
  float sy = uL * 0.016 * H * rw(fc.x / W * uN * 2.0 * PI);
  float y = (fc.y - 0.5) * f + sy - a0 + 0.5;   // the picture's row (centres at + 0.5)
  float cv = clamp(y + 0.5, 0.0, 1.0) * clamp(H - y + 0.5, 0.0, 1.0);
  fragColor = vec4(at(uS, vec2(fc.x, clamp(y, 0.5, H - 0.5))).rgb * cv, 1.0);
}`,
  // VHS 1-3 (DM:686-695): down to vh_w x vh_h, the ghost (+2 px at 0.25k), the edge wave (each line its own random offset,
  // low-passed line to line; worked out per row from the 14 lines above: 0.487^14 < 1e-4)
  vhsprep: `uniform sampler2D uS; uniform float uK; uniform uint uSeed;
float rn(int x, int y, uint s) { return float(pcg(uint(x) + pcg(uint(y) + pcg(uSeed + s)))) * (1.0 / 4294967296.0); }
void main() {
  vec2 fc = gl_FragCoord.xy; int y = int(fc.y); float j = 1.0 + 7.0 * uK * uK, a = 0.0;
  for (int n = max(0, y - 14); n <= y; n++) a += (rn(0, n, 11u) * j - a) * 0.513;
  vec2 sc = tsz(uS) / uRes; float xs = fc.x + a;   // (the EEL's grid reads x + a: the line moves left by a)
  vec3 d0 = at(uS, vec2(xs, fc.y) * sc).rgb, d1 = at(uS, vec2(xs - 2.0, fc.y) * sc).rgb;
  fragColor = vec4(xs >= 2.0 ? mix(d0, d1, 0.25 * uK) : d0, 1.0);
}`,
  // VHS 4a (vh_ntsc, DM:499-506, §4): the composite signal along each line up to the tape. Each pixel runs the line's IIR
  // filters from 64 samples to its left (the slowest, the tape chroma 3-pole at ~0.11, has decayed below 2e-3 by then);
  // the random numbers are a hash of (x, y, frame) so the warm-ups of neighbouring pixels agree. Out: Y (tape LP +
  // overshoot), the tape chroma I, Q before the line average (float, or packed into RGBA8 when float targets are missing)
  vhs1: `uniform sampler2D uS; uniform float aI, aQ, aP, aY, aC, uPre, uVno, uCno, uPhn; uniform uint uSeed; uniform int uEnc;
float rn(int x, int y, uint s) { return float(pcg(uint(x) + pcg(uint(y) + pcg(uSeed + s)))) * (1.0 / 4294967296.0); }
void main() {
  ivec2 ip = ivec2(gl_FragCoord.xy); int x = ip.x, y = ip.y, ph = y & 2;
  float pn = 0.0; for (int n = max(0, y - 24); n <= y; n++) pn = (pn + (rn(0, n, 7u) * 2.0 - 1.0) * uPhn) * 0.5;   // the line's hue wander
  float cs = cos(pn * 0.0314159), sn = sin(pn * 0.0314159);
  int x0 = max(0, x - 64);
  float i1 = 0.0, i2 = 0.0, i3 = 0.0, q1 = 0.0, q2 = 0.0, q3 = 0.0, pp = 16.0, c0 = 0.0, c1 = 0.0, c2 = 0.0, c3 = 0.0, di = 0.0, dq = 0.0;
  float y1 = 16.0, y2 = 16.0, y3 = 16.0, yh = 16.0, k1 = 0.0, k2 = 0.0, k3 = 0.0, m1 = 0.0, m2 = 0.0, m3 = 0.0, nz = 0.0, ni = 0.0, nq = 0.0;
  if (x0 > 0) {   // mid-line: the filters started at the signal's level there
    vec3 g = px(uS, ivec2(x0, y)).rgb * 255.0; float Y0 = dot(g, vec3(0.30, 0.59, 0.11));
    float I0 = -0.27 * (g.b - Y0) + 0.74 * (g.r - Y0), Q0 = 0.41 * (g.b - Y0) + 0.48 * (g.r - Y0);
    i1 = i2 = i3 = I0; q1 = q2 = q3 = Q0; pp = Y0; c0 = c1 = c2 = c3 = Y0; y1 = y2 = y3 = yh = Y0;
  }
  for (int j = x0; j <= x; j++) {
    vec3 g = px(uS, ivec2(j, y)).rgb * 255.0; float Yv = dot(g, vec3(0.30, 0.59, 0.11));
    float Iv = -0.27 * (g.b - Yv) + 0.74 * (g.r - Yv), Qv = 0.41 * (g.b - Yv) + 0.48 * (g.r - Yv);
    i1 += (Iv - i1) * aI; i2 += (i1 - i2) * aI; i3 += (i2 - i3) * aI;
    q1 += (Qv - q1) * aQ; q2 += (q1 - q2) * aQ; q3 += (q2 - q3) * aQ;
    int f4 = (j + ph) & 3; float s = Yv + (f4 == 0 ? i3 : f4 == 1 ? q3 : f4 == 2 ? -i3 : -q3);
    pp += (s - pp) * aP; s += (s - pp) * uPre;
    s += nz; nz = (nz + (rn(j, y, 1u) * 2.0 - 1.0) * uVno) * 0.5;
    c3 = c2; c2 = c1; c1 = c0; c0 = s; float yy = (c0 + c1 + c2 + c3) * 0.25, dd = c1 - yy;
    int f8 = (j + 3 + ph) & 3; if (f8 == 0) di = dd; else if (f8 == 1) dq = dd; else if (f8 == 2) di = -dd; else dq = -dd;
    float I = di + ni; ni = (ni + (rn(j, y, 2u) * 2.0 - 1.0) * uCno) * 0.5;
    float Q = dq + nq; nq = (nq + (rn(j, y, 3u) * 2.0 - 1.0) * uCno) * 0.5;
    float I2 = I * cs - Q * sn; Q = I * sn + Q * cs; I = I2;
    y1 += (yy - y1) * aY; y2 += (y1 - y2) * aY; y3 += (y2 - y3) * aY; yh += (y3 - yh) * aY;
    k1 += (I - k1) * aC; k2 += (k1 - k2) * aC; k3 += (k2 - k3) * aC;
    m1 += (Q - m1) * aC; m2 += (m1 - m2) * aC; m3 += (m2 - m3) * aC;
  }
  float Yt = y3 + (y3 - yh) * 1.6;
  fragColor = uEnc == 1 ? vec4((Yt + 256.0) / 1024.0, (k3 + 512.0) / 1024.0, (m3 + 512.0) / 1024.0, 1.0) : vec4(Yt, k3, m3, 1.0);
}`,
  // VHS 4b: the chroma averaged with the line above (row 0: with 0, as VNB starts cleared), sharpening, colour loss,
  // the TV's chroma lowpass (warm-up 16 samples: the fastest filters), back to RGB
  vhs2: `uniform sampler2D uS; uniform float aS, aT, uShp, uClp; uniform uint uSeed; uniform int uEnc;
float rn(int x, int y, uint s) { return float(pcg(uint(x) + pcg(uint(y) + pcg(uSeed + s)))) * (1.0 / 4294967296.0); }
vec3 rd(int x, int y) { if (y < 0) return vec3(0.0); vec3 v = px(uS, ivec2(x, y)).xyz; return uEnc == 1 ? vec3(v.x * 1024.0 - 256.0, v.y * 1024.0 - 512.0, v.z * 1024.0 - 512.0) : v; }
void main() {
  ivec2 ip = ivec2(gl_FragCoord.xy); int x = ip.x, y = ip.y, x0 = max(0, x - 16); bool lost = rn(0, y, 9u) < uClp;
  float s1 = 16.0, s2 = 16.0, s3 = 16.0, t1 = 0.0, t2 = 0.0, t3 = 0.0, u1 = 0.0, u2 = 0.0, u3 = 0.0, Yo = 0.0;
  if (x0 > 0) { vec3 v = rd(x0, y), w = rd(x0, y - 1); s1 = s2 = s3 = v.x; if (!lost) { t1 = t2 = t3 = (v.y + w.y) * 0.5; u1 = u2 = u3 = (v.z + w.z) * 0.5; } }
  for (int j = x0; j <= x; j++) {
    vec3 v = rd(j, y), w = rd(j, y - 1); float I = (v.y + w.y) * 0.5, Q = (v.z + w.z) * 0.5, Yv = v.x;
    s1 += (Yv - s1) * aS; s2 += (s1 - s2) * aS; s3 += (s2 - s3) * aS; Yv += (Yv - s3) * uShp;
    if (lost) { I = 0.0; Q = 0.0; }
    t1 += (I - t1) * aT; t2 += (t1 - t2) * aT; t3 += (t2 - t3) * aT;
    u1 += (Q - u1) * aT; u2 += (u1 - u2) * aT; u3 += (u2 - u3) * aT;
    Yo = Yv;
  }
  vec3 c = vec3(Yo + 0.956 * t3 + 0.621 * u3, Yo - 0.272 * t3 - 0.647 * u3, Yo - 1.106 * t3 + 1.703 * u3);
  fragColor = vec4(clamp(c / 255.0, 0.0, 1.0), 1.0);
}`,
  // VHS 6-7 (DM:698-706): less colour, the cast
  vhs3: `uniform sampler2D uS; uniform float uDs, uDr, uM; uniform int uCol;
void main() {
  vec3 c = at(uS, gl_FragCoord.xy).rgb; float L = luma(c);
  c.r += (L - c.r) * (uDs + uDr); c.g += (L - c.g) * uDs; c.b += (L - c.b) * uDs; c = clamp(c, 0.0, 1.0);
  c = uCol == 1 ? vec3(c.r * (1.0 - 0.12 * uM) + 0.03 * uM * (1.0 - c.r), c.g * (1.0 - 0.04 * uM) + 0.05 * uM * (1.0 - c.g), c.b + 0.14 * uM * (1.0 - c.b))
                : vec3(c.r + 0.06 * uM * (1.0 - c.r), c.g * (1.0 - 0.05 * uM), c.b + 0.05 * uM * (1.0 - c.b));
  fragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`,
  // VHS overlays (vh_over, DM:510-527): scan lines, then the on-screen text (a canvas texture)
  vhsover: `uniform sampler2D uS, uOsd; uniform float uSl, uSp; uniform int uOsdOn;
void main() {
  vec2 fc = gl_FragCoord.xy; vec3 c = at(uS, fc).rgb; float Y = floor(fc.y), n = floor(Y / uSp);
  if (uSl > 0.002 && n < floor(uRes.y / uSp) && Y - n * uSp < max(1.0, floor(uSp * 0.5))) c *= 1.0 - uSl;
  if (uOsdOn == 1) { vec4 t = texture(uOsd, fc / uRes); c = mix(c, t.rgb, t.a); }
  fragColor = vec4(c, 1.0);
}`,
  // the filter look (look, DM:755-839, §2.6), by stage
  look: `uniform sampler2D u0, u1, u2; uniform int uSt; uniform float uB, uT, uA, uPost, uGa;
void main() {
  vec2 fc = gl_FragCoord.xy, uv = fc / uRes; float W = uRes.x, H = uRes.y, b = uB; vec3 c;
  if (uSt == 0) {   // night: the slow wave (per pixel instead of the 25 x 15 grid)
    float gx = (fc.x - 0.5) / W * 24.0, gy = (fc.y - 0.5) / H * 14.0, a = 0.015 * b;
    vec2 s = vec2(fc.x + a * W * sin(gy * 0.8 + uT * 1.9 + gx * 0.35), fc.y + a * H * sin(gx * 0.6 + uT * 1.6 + gy * 0.4));
    c = at(u0, clamp(s, vec2(0.5), uRes - 0.5)).rgb;
  } else if (uSt == 1) {   // night: blurred (u1 small), the dark curve, cold, breathing, the vignette
    c = texture(u1, uv).rgb;
    float lth = 0.22 * b, ga = 1.0 + 1.3 * b, br = (1.0 - 0.05 * b) * (1.0 - 0.1 * b * (0.5 + 0.5 * sin(uT * 2.3)));
    c = pow(max(vec3(0.0), (c - lth) / (1.0 - lth)), vec3(ga)) * br;
    c = min(vec3(1.0), c * vec3(1.0 - 0.3 * b, 1.0 - 0.15 * b, 1.0 + 0.1 * b));
    float bw = 0.35, a = 0.65 * b, x = fc.x, y = fc.y;
    float v = (1.0 - a * max(0.0, 1.0 - x / (W * bw))) * (1.0 - a * max(0.0, (x - W * (1.0 - bw)) / (W * bw)))
            * (1.0 - a * max(0.0, 1.0 - y / (H * bw))) * (1.0 - a * max(0.0, (y - H * (1.0 - bw)) / (H * bw)));
    c *= v;
  } else if (uSt == 2) {   // morning: the bright parts (quarter size)
    float lth = 0.5 - 0.2 * b; c = texture(u0, uv).rgb; c = max(vec3(0.0), (c - lth) / (1.0 - lth)); c.b *= 1.05; c = min(c, vec3(1.0));
  } else if (uSt == 3) {   // morning: 8 rays round (0.5, 0.3)
    vec2 L = vec2(0.5, 0.3); c = vec3(0.0);
    for (int i = 0; i < 8; i++) { float s = 1.0 + 0.1 * float(i); c += texture(u0, L + (uv - L) / s).rgb * 0.45 * (1.0 - float(i) / 8.0); }
  } else if (uSt == 4) {   // morning: in shadow, then the glow and the rays added
    c = texture(u0, uv).rgb * (1.0 - 0.45 * b);
    c = min(vec3(1.0), c + 1.3 * b * texture(u1, uv).rgb); c = min(vec3(1.0), c + 1.4 * b * min(vec3(1.0), texture(u2, uv).rgb));
  } else if (uSt == 5) {   // morning: JPEG ringing (the blur taken off first, then the picture added)
    vec3 I = texture(u0, uv).rgb; c = clamp(max(vec3(0.0), I - 0.5 * b * texture(u1, uv).rgb) + 0.5 * b * I, 0.0, 1.0);
  } else {   // morning: blocks laid over (nearest), then (uPost) the colours in steps and the exposure
    ivec2 z = textureSize(u1, 0);
    c = mix(texture(u0, uv).rgb, texelFetch(u1, clamp(ivec2(floor(uv * vec2(z))), ivec2(0), z - 1), 0).rgb, uA);
    if (uPost > 0.0) c = min(vec3(1.0), floor(c * uPost + 0.5) / uPost * uGa);
  }
  fragColor = vec4(c, 1.0);
}`,
  // the output: the mix fitted into the canvas keeping its aspect (§2.6 3), flipped to the screen, master level / blackout
  present: `uniform sampler2D uS; uniform float uBo;
void main() {
  vec2 z = tsz(uS), fc = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y); float k = min(uRes.x / z.x, uRes.y / z.y);
  vec2 d = z * k, o = (uRes - d) * 0.5, q = (fc - o) / d;
  vec3 c = (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0) ? vec3(0.0) : texture(uS, q).rgb;
  fragColor = vec4(c * (1.0 - uBo), 1.0);
}`,
  shatter: `in vec2 vSrc; flat in float vAl; uniform sampler2D uL;
void main() { fragColor = vec4(texture(uL, vSrc / tsz(uL)).rgb * vAl, 1.0); }`,
};
// Shatter's pieces as 84 instanced quads (nt_shatter, DM:1121-1153): per piece (centre x, y, turn, scale) and (alpha,
// source x, y), worked out in JS; drawn additively
const VS_SHATTER = `#version 300 es
uniform vec2 uRes, uTile; uniform vec4 uT0[84]; uniform vec4 uT1[84];
out vec2 vSrc; flat out float vAl;
void main() {
  vec4 a = uT0[gl_InstanceID], b = uT1[gl_InstanceID];
  vec2 cr = vec2(float(gl_VertexID & 1), float((gl_VertexID >> 1) & 1)), l = (cr - 0.5) * uTile;
  float c = cos(a.z), s = sin(a.z); vec2 p = a.xy + a.w * vec2(c * l.x - s * l.y, s * l.x + c * l.y);
  gl_Position = vec4(p / uRes * 2.0 - 1.0, 0.0, 1.0); vSrc = b.yz + cr * uTile; vAl = b.x;
}`;

// ---------------------------------------------------------------------------------------------------------------------
export class Mixer {
  static BLENDS = BLENDS;
  static TRANSITIONS = TRANSITIONS;
  static EFFECTS = EFFECTS;

  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.opts = opts;
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: !!opts.preserve });
    if (!gl) throw new Error('mixer: WebGL2 is not available');
    this.gl = gl;
    this.floatRT = !!gl.getExtension('EXT_color_buffer_float');
    this.P = {};
    for (const k of Object.keys(FS)) this.P[k] = this._prog(k, FS[k], k === 'shatter' ? VS_SHATTER : VS);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    this.dummy = this._texRaw(1, 1, new Uint8Array([0, 0, 0, 255]));
    this.pool = new Map(); this.live = 0;
    this.src = [null, null]; this.srcF = [null, null]; this.has = [false, false];
    this.vmx = [0, 0]; this.W = 0; this.H = 0; this.fr = 0;
    this.ftS = 0; this.ftLast = 0;                                  // the frame time, smoothed (STB[20]/[21], DM:298)
    this.fn = [null, null]; this.fk = [0, 0]; this.fg = [0, 0];     // flip hold (DM:81-83)
    this.clip = [undefined, undefined];
    this.trFrom = 0;
    this.hs = [0, 1, 2].map(() => ({ tex: null, sd: 0, mv: 0, tm: -1e9, lc: -1e9 }));   // histories (HPIC/HSD/HMV/HTM/HLC)
    this.tr = [0, 1, 2].map(() => ({ tex: null, f: -10, k: 0, t: 0 }));                  // trails (TPIC/TRF/TRK/TRT)
    this.vhp = [null, null, null]; this.vhf = [-10, -10, -10];                          // VHS afterglow (VHP/VHF)
    this.dsl = [0, 0, 0];                                                                // Disc last turns (DSL)
    this.stb = [0, 1, 2].map(() => ({ beat: 0, f0: 0, sp: 0, half: 2, fpb: 0, bp: { p: -1e9, t: 0, rate: 0, mv: false } }));
    this.lfs = [0, 1].map(() => ({ p: -1e9, t: 0, rate: 0, mv: false }));
    this.cm = { pl: 0, pp: 0, tc: -1e9, ov: 1, sh: 0.7, bl: 0.6, t: 0 };
    this.lkn = 32; this.osd = null;
    this.blk = new Float32Array(144);   // Blocks' per-cell hashes (DM:181)
    for (let j = 0; j < 9; j++) for (let i = 0; i < 16; i++) this.blk[j * 16 + i] = hash(i * 12.9898 + j * 78.233);
  }

  // ---------- GL plumbing ----------
  _prog(name, fs, vs) {
    const gl = this.gl;
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`mixer: shader "${name}": ${gl.getShaderInfoLog(s)}`);
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, HEAD + fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`mixer: program "${name}": ${gl.getProgramInfoLog(p)}`);
    const u = {}; let unit = 0;
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      u[info.name.replace(/\[0\]$/, '')] = { loc: gl.getUniformLocation(p, info.name), type: info.type, size: info.size, unit: info.type === gl.SAMPLER_2D ? unit++ : -1 };
    }
    return { p, u, name };
  }
  _texRaw(w, h, data) {
    const gl = this.gl, tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data || null);
    this._params();
    return { tex, fb: null, w, h };
  }
  _params() {
    const gl = this.gl;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  // a render target from the pool (fmt 'f' = float for VHS's signal, when the browser can render to float)
  get(w, h, fmt = 'u8') {
    w = Math.max(1, w | 0); h = Math.max(1, h | 0);
    const key = `${w}x${h}${fmt}`, list = this.pool.get(key);
    this.live++;
    if (list && list.length) return list.pop();
    const gl = this.gl, tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (fmt === 'f') gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    this._params();
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fb, w, h, key };
  }
  put(t) {
    if (!t || !t.key) return;
    this.live--;
    let list = this.pool.get(t.key);
    if (!list) this.pool.set(t.key, (list = []));
    list.push(t);
  }
  _flushPool() {   // the size changed: let the free targets of the old size go
    const gl = this.gl;
    for (const list of this.pool.values()) for (const t of list) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); }
    this.pool.clear();
  }
  // one full-screen pass of program `name` into dst (null = the canvas)
  draw(name, dst, uni = {}) {
    const gl = this.gl, pr = this.P[name];
    gl.useProgram(pr.p);
    const w = dst ? dst.w : this.canvas.width, h = dst ? dst.h : this.canvas.height;
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst ? dst.fb : null);
    gl.viewport(0, 0, w, h);
    uni.uRes = [w, h];
    for (const k in pr.u) {
      const u = pr.u[k], v = uni[k];
      if (u.unit >= 0) {   // every sampler gets a texture (an unbound one could be the target: a feedback loop)
        gl.activeTexture(gl.TEXTURE0 + u.unit); gl.bindTexture(gl.TEXTURE_2D, v ? v.tex : this.dummy.tex); gl.uniform1i(u.loc, u.unit);
        continue;
      }
      if (v === undefined) continue;
      switch (u.type) {
        case gl.FLOAT: if (u.size > 1) gl.uniform1fv(u.loc, v); else gl.uniform1f(u.loc, v); break;
        case gl.FLOAT_VEC2: gl.uniform2fv(u.loc, v); break;
        case gl.FLOAT_VEC3: gl.uniform3fv(u.loc, v); break;
        case gl.FLOAT_VEC4: gl.uniform4fv(u.loc, v); break;
        case gl.FLOAT_MAT3: gl.uniformMatrix3fv(u.loc, false, v); break;
        case gl.UNSIGNED_INT: gl.uniform1ui(u.loc, v >>> 0); break;
        default: gl.uniform1i(u.loc, v | 0);
      }
    }
    if (name === 'shatter') {
      gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, 84);
      gl.disable(gl.BLEND);
    } else gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  // helpers: a new target of size (w, h) from comp / down
  _comp(w, h, t0, k0, t1, k1, t2, k2, near = 0) {
    const o = this.get(w, h);
    this.draw('comp', o, { u0: t0, k0: t0 ? k0 : 0, u1: t1, k1: t1 ? (k1 || 0) : 0, u2: t2, k2: t2 ? (k2 || 0) : 0, uNear: near });
    return o;
  }
  _down(src, w, h) {
    const o = this.get(w, h), f = Math.max(src.w / o.w, src.h / o.h);
    this.draw('down', o, { uS: src, uN: clamp(Math.ceil(f / 2), 1, 8) });
    return o;
  }
  _pass(name, img, uni) {   // a W x H pass that consumes img
    const o = this.get(this.W, this.H);
    this.draw(name, o, Object.assign({ uS: img }, uni));
    this.put(img);
    return o;
  }

  // ---------- one frame ----------
  render(frames, st = {}) {
    const gl = this.gl;
    this.now = typeof st.time === 'number' ? st.time : performance.now() / 1000;
    this.fr++;
    const ft = performance.now() / 1000, dt = ft - this.ftLast;   // DM:298
    if (dt > 0.001 && dt < 0.2) this.ftS += (dt - this.ftS) * (this.ftS > 0 ? 0.05 : 1);
    this.ftLast = ft;
    const fx = [st.fx && st.fx[0] || {}, st.fx && st.fx[1] || {}];
    this.cmBlur = st.cam && st.cam.blur !== undefined ? st.cam.blur : 0.6;   // [131]: the Disc's blur too

    // the decks' frames: a missing one keeps the last good one (BKEEP, DM:1174-1191, §1.4a)
    for (const d of [0, 1]) {
      const f = frames && frames[d];
      if (fx[d].clip !== undefined && fx[d].clip !== this.clip[d]) {   // clip change: trails and history afresh (DM:303-304)
        if (this.clip[d] !== undefined) { this._picReset(d); this._picReset(2); if (!f) this.has[d] = false; }
        this.clip[d] = fx[d].clip;
      }
      if (!f) continue;
      const w = f.displayWidth || f.videoWidth || f.width, h = f.displayHeight || f.videoHeight || f.height;
      if (!w || !h) continue;
      if (f !== this.srcF[d] || !this.src[d] || this.src[d].w !== w || this.src[d].h !== h) {
        if (!this.src[d] || this.src[d].w !== w || this.src[d].h !== h) { if (this.src[d]) gl.deleteTexture(this.src[d].tex); this.src[d] = this._texRaw(w, h); }
        gl.bindTexture(gl.TEXTURE_2D, this.src[d].tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, f); this.srcF[d] = f; this.has[d] = true; } catch (e) { /* a closed bitmap: keep the last */ }
      }
      if (w * h > this.vmx[0] * this.vmx[1]) this.vmx = [w, h];   // the largest frame seen (DM:36-37)
    }

    // the working size (DM:65-75, §5.2)
    const pw = this.opts.width || this.vmx[0] || 1280, ph = this.opts.height || this.vmx[1] || 720;
    let sc = Math.min(1, 1280 / pw, 720 / ph);
    if (sc >= 1) sc = Math.max(1, Math.min(960 / pw, 720 / ph));
    const W = Math.max(2, Math.floor(pw * sc / 2) * 2), H = Math.max(2, Math.floor(ph * sc / 2) * 2);
    if (W !== this.W || H !== this.H) {   // sz_ch: everything kept at the old size goes (DM:302)
      this.W = W; this.H = H;
      for (const s of [0, 1, 2]) this._picReset(s, true);
      this.vhp.forEach((t) => this.put(t)); this.vhp = [null, null, null];
      this._flushPool(); this.osd = null;
    }
    const OW = this.opts.outWidth || W, OH = this.opts.outHeight || H;
    if (this.opts.autoSize !== false && (this.canvas.width !== OW || this.canvas.height !== OH)) { this.canvas.width = OW; this.canvas.height = OH; }

    // the mixer front-end (DM:77-106, §2.2)
    const g = [clamp01(st.gA || 0), clamp01(st.gB || 0)];
    if (st.flip) for (const d of [0, 1]) {
      const fl = st.flip[d];
      if (fl && fl.n !== this.fn[d]) { if (this.fn[d] !== null) { this.fk[d] = 2; this.fg[d] = fl.g; } this.fn[d] = fl.n; }
      if (this.fk[d] > 0) { g[d] = clamp01(this.fg[d]); this.fk[d]--; }
    }
    const tl = st.tilt || [0, 0], fd = st.fade || [0, 0];
    const tw = g[0] + g[1];
    let tlt = tw > 0.0001 ? clamp((g[0] * (tl[0] || 0) + g[1] * (tl[1] || 0)) / tw, -1, 1) : 0;
    if (Math.abs(tlt) < 0.02) tlt = 0;
    g[0] *= 1 - clamp01(fd[0] || 0); g[1] *= 1 - clamp01(fd[1] || 0);
    const m = blendIndex(st.blend || 0);
    const s = g[0] + g[1], xfP = st.xfPlace === undefined ? -1 : st.xfPlace;
    let xf = s > 0.0001 ? g[1] / s : 0.5;
    if (m >= 9 && xfP >= 0) xf = clamp01(xfP);
    const vis = Math.min(1, s);
    let cA = (xf < 0.5 ? 1 - 2 * xf : 0) * vis, cY = (xf < 0.5 ? 2 * xf : 2 - 2 * xf) * vis, cB = (xf < 0.5 ? 0 : 2 * xf - 1) * vis;
    if (m === 0) { cA += cY * 0.5; cB += cY * 0.5; cY = 0; }
    if (m >= 9) { cY = xf > 0.0001 && xf < 0.9999 ? vis : 0; cA = xf <= 0.0001 ? vis : 0; cB = xf >= 0.9999 ? vis : 0; }
    this.state = { W, H, m, xf, cA, cY, cB, tlt };

    // the decks' pictures and their FX, only while they show (DM:1171-1247)
    const shA = cA > 0 || cY > 0, shB = cB > 0 || cY > 0;
    const mv = [fx[0].moving !== false, fx[1].moving !== false];
    const im = [null, null];
    for (const d of [0, 1]) {
      if (!(d ? shB : shA)) continue;
      im[d] = this.get(W, H);
      if (this.has[d]) this.draw('fit', im[d], { uS: this.src[d] });
      else this.draw('comp', im[d], { k0: 0, k1: 0, k2: 0 });
      this._histUpd(im[d], d, mv[d], this.has[d]);
      im[d] = this._deckFx(im[d], d, fx[d], st);
    }

    // the blend / transition picture T (DM:1286-1316)
    if (xf <= 0.0001) this.trFrom = 0; else if (xf >= 0.9999) this.trFrom = 1;
    if (m >= 9 && xfP >= 0) this.trFrom = (st.lastEnd || 0) >= 0.5 ? 1 : 0;
    let T = null;
    if (cY > 0) T = m >= 9 ? this._transition(m, xf, im[0], im[1], st) : this._blend(im[0], im[1], m, st);

    // the mix (DM:1323-1326)
    let O = this._comp(W, H, im[0], cA, T, cY, im[1], cB);
    this.put(im[0]); this.put(im[1]); this.put(T);

    // the master FX, on the mix with deck A's beat, lamp, LFO and colours (DM:1318-1328, §2.6 1)
    const mfx = st.masterFx ? (st.masterFx.type | 0) : 0, boost = st.boost || 0;
    if (mfx >= 1 && mfx <= 15) {
      let mk = st.masterFx.amount || 0;
      if (mfx !== 9) mk *= this._lfo(0, fx[0].lfo, fx[0].beat === undefined ? -1 : fx[0].beat);
      if (mfx !== 9 && mk > 0.001) mk += boost * (1 - mk);
      if (mk > 0.001) {
        this._histUpd(O, 2, mv[0] || mv[1], this.has[0] || this.has[1]);
        O = this._vfx(O, mfx, mk, fx[0].beat === undefined ? -1 : fx[0].beat, fx[0].lamp | 0, 2, fx[0], this.has[0] || this.has[1]);
        if (mfx === 11) O = this._vhOver(O, mk, 2, fx[0]);
      }
    }
    if (tlt !== 0) O = this._look(O, tlt);   // §2.6 2

    // the output (§2.6 3-4)
    const bo = st.blackout ? 1 : clamp01(st.level || 0);
    this.draw('present', null, { uS: O, uBo: bo > 0.001 ? bo : 0 });
    this.put(O);
    for (const sl of [0, 1, 2]) if (this.vhp[sl] && this.vhf[sl] !== this.fr) { this.put(this.vhp[sl]); this.vhp[sl] = null; }   // DM:1342
    return this.state;
  }

  // ---------- trails / history (DM:301-321, 717-742) ----------
  _picReset(slot, drop) {
    this.hs[slot].sd = 0; this.tr[slot].f = -10;
    if (drop) { this.put(this.hs[slot].tex); this.hs[slot].tex = null; this.put(this.tr[slot].tex); this.tr[slot].tex = null; }
  }
  _histUpd(img, slot, mv, vok) {
    const t = this.now, S = this.hs[slot];
    if (t - S.lc > 1) S.sd = 0;
    S.lc = t;
    if (!S.tex) S.sd = 0;
    if (mv && vok && (t - S.tm >= 0.03 || !S.mv)) {
      const n = (!S.mv || !S.sd) ? this._comp(this.W, this.H, img, 1) : this._comp(this.W, this.H, S.tex, 0.93, img, 0.07);
      this.put(S.tex); S.tex = n; S.sd = 1; S.tm = t;
    }
    S.mv = mv;
  }
  _trails(img, k, slot, vok) {
    const W = this.W, H = this.H, HS = this.hs[slot], R = this.tr[slot];
    if (HS.mv || !HS.sd) {
      const tn = this.now;
      if (R.f !== this.fr - 1 || !R.tex) { this.put(R.tex); R.tex = this._comp(W, H, img, 1); R.k = vok; R.t = tn; }   // not drawn last frame: afresh
      let out;
      if (vok && R.k && tn - R.t < 0.03) out = this._comp(W, H, img, 1 - 0.93 * k, R.tex, 0.93 * k);
      else {
        if (vok) {
          const n = !R.k ? this._comp(W, H, img, 1) : this._comp(W, H, R.tex, 0.93 * k, img, 1 - 0.93 * k);
          this.put(R.tex); R.tex = n; R.k = 1; R.t = tn;
        }
        out = this._comp(W, H, R.tex, 1);
      }
      R.f = this.fr;
      this.put(img);
      return out;
    }
    if (!HS.tex) return img;   // standing: the history of the last move over the picture
    const out = this._comp(W, H, img, 1 - 0.93 * k, HS.tex, 0.93 * k);
    this.put(img);
    return out;
  }

  // ---------- beat position extrapolation (bp_est, DM:142-151, §1.3) and the LFO (DM:1208-1217, §3.1) ----------
  _bpEst(o, ph) {
    const t = this.now;
    if (ph !== o.p) {
      const d = ph - o.p, dt = t - o.t;
      if (d > 0 && d < 1 && dt > 0.001 && dt < 0.25) o.rate += (d / dt - o.rate) * (o.rate > 0 ? 0.15 : 1); else o.rate = 0;
      o.p = ph; o.t = t;
    }
    o.mv = o.rate > 0 && t - o.t < 0.25;
    return o.mv ? ph + o.rate * (t - o.t) : ph;
  }
  _lfo(d, cfg, ph) {
    const dp = clamp01(cfg && cfg.depth || 0);
    if (dp <= 0.001) return 1;
    const L = this.lfs[d];
    if (ph >= 0) ph = this._bpEst(L, ph);
    const sh = cfg.shape | 0;
    let cb = 2 ** (clamp(cfg.rate | 0, 0, 5) - 2);
    if (sh === 2 && this.ftS > 0) for (let i = 0; i < 6; i++) if (cb * 0.5 / (ph >= 0 ? (L.rate > 0 ? L.rate : 2) : 2) < 2 * this.ftS) cb *= 2;
    const x = (ph >= 0 ? ph : this.now * 2) / cb, f = x - Math.floor(x);
    const w = sh === 0 ? 0.5 + 0.5 * Math.cos(2 * Math.PI * f) : sh === 1 ? Math.abs(2 * f - 1) : sh === 2 ? (f < 0.5 ? 1 : 0) : sh === 3 ? 1 - f : f;
    return 1 - dp * (1 - w);
  }

  // ---------- a deck's FX (deck_fx, DM:1219-1245, §3.1) ----------
  _deckFx(img, d, f, st) {
    const A = new Float32Array(16), boost = st.boost || 0, ph = f.beat === undefined ? -1 : f.beat;
    const t0 = f.type | 0;
    if (t0 >= 1 && t0 <= 15) A[t0] = f.amount || 0;
    A[10] = Math.max(A[10], f.echo || 0); A[7] = Math.max(A[7], f.crush || 0);
    const kn = f.knobs || [];
    for (let i = 0; i < 8; i++) { const t = i < 6 ? i + 1 : i + 2; A[t] = Math.max(A[t], kn[i] || 0); }
    A[11] = Math.max(A[11], f.vhs || 0);
    const tc = f.touch || [];
    for (let i = 0; i < 4; i++) A[12 + i] = Math.max(A[12 + i], tc[i] || 0);
    const lf = this._lfo(d, f.lfo, ph);
    if (lf < 1) for (let t = 1; t <= 15; t++) if (t !== 9) A[t] *= lf;
    if (boost > 0.001) for (let t = 1; t <= 15; t++) if (t !== 9 && A[t] > 0.001) A[t] += boost * (1 - A[t]);
    let l = (f.vib || 0) * lf;
    l = l > 0.001 ? l + boost * (1 - l) : 0;
    if (l > 0 && (A[7] > 0.001 || A[8] > 0.001 || A[11] > 0.001 || A[12] > 0.001 || A[13] > 0.001 || A[14] > 0.001 || A[15] > 0.001)) { img = this._raster(img, l); l = 0; }
    for (const t of [13, 14, 15, 1, 2, 3, 4, 5, 6, 7, 8, 10, 9, 11, 12]) if (A[t] > 0.001) img = this._vfx(img, t, A[t], ph, f.lamp | 0, d, f, this.has[d]);
    if (l > 0) img = this._raster(img, l);
    if (A[11] > 0.001) img = this._vhOver(img, A[11], d, f);
    return img;
  }
  _raster(img, k) {
    const W = this.W, H = this.H;
    return this._pass('raster', img, { uL: k, uN: Math.max(4, Math.floor(W / (H / 17) * 0.25 + 0.5) * 4) });
  }

  // ---------- one video FX on one picture (vfx, DM:528-745, §3.2); consumes img ----------
  _vfx(img, t, k, ph, col, slot, f = {}, vok = true) {
    const W = this.W, H = this.H;
    switch (t) {
      case 1: {
        const dk = tpal(f.tintDark === undefined ? 0 : f.tintDark, col), lt = tpal(f.tintLight === undefined ? 2 : f.tintLight, col);
        return this._pass('fx', img, { uT: 1, uK: k, uDark: dk, uLight: [lt[0] * 1.3 - dk[0], lt[1] * 1.3 - dk[1], lt[2] * 1.3 - dk[2]] });
      }
      case 2: {
        const a = k * 2 * Math.PI, c = Math.cos(a), s = Math.sin(a);
        const h = [0.213 + 0.787 * c - 0.213 * s, 0.715 - 0.715 * c - 0.715 * s, 0.072 - 0.072 * c + 0.928 * s,
          0.213 - 0.213 * c + 0.143 * s, 0.715 + 0.285 * c + 0.140 * s, 0.072 - 0.072 * c - 0.283 * s,
          0.213 - 0.213 * c - 0.787 * s, 0.715 - 0.715 * c + 0.715 * s, 0.072 + 0.928 * c + 0.072 * s];
        return this._pass('fx', img, { uT: 2, uHue: [h[0], h[3], h[6], h[1], h[4], h[7], h[2], h[5], h[8]] });   // column-major
      }
      case 3: case 4: case 5: return this._pass('fx', img, { uT: t, uK: k });
      case 6: return this._pass('fx', img, { uT: 6, uN: 2 * (2 + Math.floor(k * 5.99)), uA: ph >= 0 ? ph * Math.PI / 16 : this.now * 0.3 });
      case 7: case 14: {
        const d = t === 7 ? Math.max(2, Math.floor((2 + k * 30) * H / 480 + 0.5)) : Math.max(4, Math.floor(H / (12 * 8 ** clamp01(k)) + 0.5));
        const sw = 2 * Math.ceil((W / d - 1) / 2) + 1, sh = 2 * Math.ceil((H / d - 1) / 2) + 1;
        return this._pass('fx', img, { uT: t, uK: k, uD: d, uO: [Math.floor((sw * d - W) / 2), Math.floor((sh * d - H) / 2)] });
      }
      case 8: return this._pass('fx', img, { uT: 8, uD: Math.floor(k * W * 0.03 + 0.5) });
      case 9: return this._strobe(k, ph, slot, f) ? this._pass('fx', img, { uT: 9 }) : img;
      case 10: return this._trails(img, k, slot, vok);
      case 11: return this._vhs(img, k, slot, f);
      case 12: {   // the picture always full: the amount is for the sound (DM:663-665)
        const turns = f.turns || 0, a = 2 * Math.PI * turns, bl = clamp01(this.cmBlur === undefined ? 0.6 : this.cmBlur);
        let sp = Math.abs(turns - this.dsl[slot]) < 0.4 ? 2 * Math.PI * (turns - this.dsl[slot]) * bl : 0;
        this.dsl[slot] = turns; sp = clamp(sp, -1.6, 1.6);
        const n = Math.abs(sp) > 0.012 ? Math.min(24, Math.ceil(Math.abs(sp) / 0.006) + 1) : 1;
        return this._pass('fx', img, { uT: 12, uA: a, uSp: sp, uN: n });
      }
      case 13: { const L = this._lineArt(img, 2 + 6 * k); this.put(img); return L; }
      case 15: return this._pass('fx', img, { uT: 15, uK: k });
      default: return img;
    }
  }
  // Strobe (DM:622-653): true = black this frame
  _strobe(k, ph, slot, f) {
    const stp = f && f.strobeStep !== undefined ? f.strobeStep : -1, sp = 2 ** (stp >= 0 ? stp : Math.floor(k * 4.99));
    let a = ph >= 0 ? ph * sp : this.now * (2 + k * 14);
    if (ph >= 0) {
      const S = this.stb[slot], ps = this._bpEst(S.bp, ph);
      if (S.bp.mv && this.ftS > 0) {
        if (Math.floor(ps) > S.beat || ps < S.beat - 0.5 || sp !== S.sp) {
          if (Math.floor(ps) === S.beat + 1 && sp === S.sp && this.fr - S.f0 > 0) S.fpb += (this.fr - S.f0 - S.fpb) * (S.fpb > 0 ? 0.3 : 1);
          S.beat = Math.floor(ps); S.f0 = this.fr; S.sp = sp;
          S.half = Math.max(2, Math.floor((S.fpb > 0 ? S.fpb / (2 * sp) : 0.5 / sp / S.bp.rate / this.ftS) + 0.5));
        }
        a = Math.floor((this.fr - S.f0) / S.half) * 0.5;
      }
    }
    return a - Math.floor(a) >= 0.5;
  }
  // Line art (la_lines, DM:402-436): a new W x H picture (img kept)
  _lineArt(img, d) {
    const W = this.W, H = this.H;
    d = clamp(d, 2, 8);
    const sw = Math.max(4, Math.floor(W / d)), sh = Math.max(4, Math.floor(H / d)), gw = Math.max(2, Math.floor(sw / 2)), gh = Math.max(2, Math.floor(sh / 2));
    const L0 = this._down(img, sw, sh), L1 = this.get(sw, sh);
    this.draw('box3', L1, { uS: L0 });
    const E = L0; this.draw('laedge', E, { uS: L1 });
    const G0 = this._down(E, gw, gh), G1 = this.get(gw, gh);
    this.draw('box3', G1, { uS: G0 }); this.draw('box3', G0, { uS: G1 });
    const F = this.get(W, H);
    this.draw('lafinal', F, { uE: E, uG: G0, uD: d });
    this.put(L0); this.put(L1); this.put(G0); this.put(G1);
    return F;
  }

  // ---------- VHS (DM:666-716, §4) ----------
  // Differences from REAPER: the line IIRs run per pixel from a 64-sample (pass 1) / 16-sample (pass 2) warm-up instead of
  // from the line start (errors below 1 %); random numbers are hashes of (x, y, frame) instead of one sequential rand();
  // the edge wave's per-line offset is built from the 14 lines above (a decaying recurrence, as REAPER's); without
  // EXT_color_buffer_float the signal is packed in 8 bits (steps of about 1 / 255 of the luma range).
  _vhs(img, k, slot, f) {
    const W = this.W, H = this.H, vw = Math.max(2, Math.min(W, 640, Math.floor(270 * W / Math.max(1, H)))), vh = Math.max(2, Math.floor(H * vw / W));
    const g2 = Math.max(0, (k - 0.6) / 0.4), col = (f.vhsColor === undefined ? 1 : f.vhsColor) > 0.5 ? 1 : 0;
    const seed = (this.fr * 2654435761 + slot * 97) >>> 0;
    let a = this.get(vw, vh);
    this.draw('vhsprep', a, { uS: img, uK: k, uSeed: seed });
    a = this._ntsc(a, k, seed + 1);
    if (g2 > 0.01) a = this._ntsc(a, 0.5 * g2, seed + 2);   // dubbing (generation loss)
    const b = this.get(vw, vh);
    this.draw('vhs3', b, { uS: a, uDs: 0.2 * k + 0.15 * g2, uDr: col ? 0.25 * (0.5 + 0.5 * k) : 0, uM: 0.5 + 0.5 * k, uCol: col });
    this.put(a);
    let out = this._comp(W, H, b, 1);
    this.put(b);
    if (this.vhp[slot] && this.vhf[slot] === this.fr - 1) {   // the afterglow (the last frame of this picture)
      const al = 0.05 + 0.1 * k, o2 = this._comp(W, H, out, 1 - al, this.vhp[slot], al);
      this.put(out); out = o2;
    }
    this.put(this.vhp[slot]); this.vhp[slot] = this._comp(W, H, out, 1); this.vhf[slot] = this.fr;
    this.put(img);
    return out;
  }
  _ntsc(a, k, seed) {
    const enc = this.floatRT ? 0 : 1, t1 = this.get(a.w, a.h, enc ? 'u8' : 'f');
    this.draw('vhs1', t1, {
      uS: a, aI: vnAl(1300000), aQ: vnAl(600000), aP: vnAl(1000000), aY: vnAl(2400000 - 1000000 * k), aC: vnAl(320000 - 40000 * k),
      uPre: 1.5 * k, uVno: 16 * k * Math.sqrt(k) + 0.5, uCno: 30 * k * Math.sqrt(k), uPhn: 2 + 38 * k, uSeed: seed, uEnc: enc,
    });
    const t2 = this.get(a.w, a.h);
    this.draw('vhs2', t2, { uS: t1, aS: vnAl(4 * (2400000 - 1000000 * k)), aT: vnAl(2600000), uShp: 1 + 2 * k, uClp: 0.05 * k * k, uSeed: seed, uEnc: enc });
    this.put(t1); this.put(a);
    return t2;
  }
  _vhOver(img, k, slot, f) {
    const W = this.W, H = this.H, sl = (k - 0.3) / 0.7 * 0.1, on = (f && f.osd) ? 1 : 0;
    if (sl <= 0.002 && !on) return img;
    if (on && !this.osd) {   // "PLAY ▶" / "SP" in Courier New (DM:520-526)
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const c = cv.getContext('2d'), fs = Math.max(10, Math.floor(H / 16)), x = Math.floor(W * 0.06), y = Math.floor(H * 0.07);
      c.font = `${fs}px "Courier New", monospace`; c.textBaseline = 'top';
      c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillText('PLAY ▶', x + 2, y + 2); c.fillText('SP', W - x - fs * 1.3 + 2, y + 2);
      c.fillStyle = 'rgba(255,255,255,0.92)'; c.fillText('PLAY ▶', x, y); c.fillText('SP', W - x - fs * 1.3, y);
      const gl = this.gl;
      this.osd = this._texRaw(W, H);
      gl.bindTexture(gl.TEXTURE_2D, this.osd.tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    }
    return this._pass('vhsover', img, { uOsd: on ? this.osd : null, uOsdOn: on, uSl: Math.max(0, sl), uSp: Math.max(2, Math.floor(H / 240 + 0.5)) });
  }

  // ---------- blends (bl_draw, DM:1266-1285) ----------
  _blend(A, B, bm, st) {
    const o = this.get(this.W, this.H);
    this.draw('blend', o, { uA: A, uB: B, uM: bm, uTh: st.keyThresh === undefined ? 0.3 : st.keyThresh, uSoft: st.keySoft === undefined ? 0.1 : st.keySoft });
    return o;
  }

  // ---------- transitions (DM:1286-1312, §2.5) ----------
  _transition(m, xf, A, B, st) {
    const tb = st.blendUnder | 0, tbl = tb >= 1 && tb <= 8 ? this._blend(A, B, tb, st) : null;
    const cam = st.cam || {};
    let T;
    if (m === 37) T = this._brush(xf, A, B, tbl, this.trFrom);
    else {
      let a = A, b = B, p = xf;
      if (this.trFrom) { a = B; b = A; p = 1 - xf; }
      if (tbl) b = tbl;
      const mx = this.trFrom && (m === 26 || m === 33 || m === 36) ? -1 : 1;
      const mr = this.trFrom && (m === 9 || m === 11 || m === 14 || m === 19 || m === 41) ? 1 : 0;
      if (m >= 38) T = m === 38 ? this._defocus(p, a, b) : m === 40 ? this._shatter(p, a, b) : this._pip(p, a, b, m, mr);
      else if (m >= 25 && m <= 36) T = this._cmDraw(m, p, a, b, mx, 1, cam);
      else { T = this.get(this.W, this.H); this.draw('trans', T, { uA: a, uB: b, uM: m, uMr: mr, uP: p, uSoft: st.keySoft === undefined ? 0.1 : st.keySoft, uBlk: this.blk }); }
    }
    this.put(tbl);
    return T;
  }
  _pip(p, A, B, m, mr) {   // nt_pip (DM:1101-1114)
    const W = this.W, H = this.H, corner = m === 41;
    let e = Math.min(1, p / 0.6); e = e < 0.5 ? 4 * e * e * e : 1 - (2 - 2 * e) ** 3 / 2;
    let q = Math.max(0, (p - 0.6) / 0.4); q *= q;
    const qs = (1 - 0.68 * e) * (corner ? 1 : 1 - q), qw = W * qs, qh = H * qs;
    let cx = W / 2, cy = H / 2;
    if (corner) {
      cx += (W / 2 - H * 0.04 - W * 0.16) * e; cy += (H / 2 - H * 0.04 - H * 0.16) * e;
      cx += (W * 0.32 + H * 0.04 + 2) * q; cy += (H * 0.32 + H * 0.04 + 2) * q;
      if (mr) cx = W - cx;
    }
    const T = this.get(W, H);
    this.draw('trans', T, { uA: A, uB: B, uM: m, uP: p, uRect: [cx - qw / 2, cy - qh / 2, qw, qh] });
    return T;
  }
  _defocus(p, A, B) {   // nt_defocus (DM:1080-1095): a mip chain by 2x2 means, two levels mixed, grown back by doubles
    const W = this.W, H = this.H, c = sstep(clamp01((p - 0.4) / 0.2));
    const lev = 6 * (1 - Math.abs(2 * p - 1)) ** 0.8, n = Math.floor(lev), f = lev - n;
    const L = [this._comp(W, H, A, 1 - c, B, c)];
    for (let i = 1; i <= Math.min(7, n + 1); i++) L[i] = this._down(L[i - 1], Math.max(2, Math.floor(W / 2 ** i)), Math.max(2, Math.floor(H / 2 ** i)));
    if (n + 1 <= 7 && f > 0.001) { const x = this._comp(L[n].w, L[n].h, L[n], 1 - f, L[n + 1], f); this.put(L[n]); L[n] = x; }
    for (let i = n - 1; i >= 0; i--) this.draw('comp', L[i], { u0: L[i + 1], k0: 1, k1: 0, k2: 0, uNear: 0 });
    for (let i = 1; i < L.length; i++) this.put(L[i]);
    return L[0];
  }
  _shatter(p, A, B) {   // nt_shatter (DM:1121-1153)
    const W = this.W, H = this.H, LAF = this._lineArt(A, 2);
    const c1 = sstep(Math.min(1, p / 0.35)), u = Math.max(0, (p - 0.3) / 0.7), cb = sstep(clamp01((p - 0.35) / 0.45));
    let T = this._comp(W, H, A, (1 - c1) * (1 - cb), B, cb);
    if (u <= 0) { const x = this._comp(W, H, T, 1, LAF, c1); this.put(T); T = x; }
    else {
      const tw = W / 12, th = H / 7, t0 = new Float32Array(336), t1 = new Float32Array(336);
      for (let j = 0; j < 7; j++) for (let i = 0; i < 12; i++) {
        const k = j * 12 + i, r1 = hash((k * 3) * 12.9898 + 4.1), r2 = hash((k * 3 + 1) * 12.9898 + 4.1), r3 = hash((k * 3 + 2) * 12.9898 + 4.1);
        const uu = clamp01((u - r3 * 0.3) / 0.7), al = 1 - uu ** 1.5;
        const tcx = (i + 0.5) * tw, tcy = (j + 0.5) * th;
        const dx = tcx - W / 2 + (r1 - 0.5) * tw, dy = tcy - H / 2 + (r2 - 0.5) * th, dl = Math.sqrt(dx * dx + dy * dy) + 1, dist = uu * uu * (0.5 + r3) * W * 0.8;
        t0.set([tcx + dx / dl * dist, tcy + dy / dl * dist + uu * uu * H * 0.3, uu * (r1 - 0.5) * 7, 1 - 0.5 * uu], k * 4);
        t1.set([al > 0.01 ? al : 0, i * tw, j * th, 0], k * 4);
      }
      this.draw('shatter', T, { uL: LAF, uTile: [tw, th], uT0: t0, uT1: t1 });
    }
    this.put(LAF);
    return T;
  }
  // Brush wipe (br_draw, DM:1022-1071)
  _brush(qp, A, B, tbl, rv) {
    const W = this.W, H = this.H;
    if (!this.bk || this.bk.W !== W || this.bk.H !== H) {   // the knots, once a size (as the EEL's mask builder walks them)
      const sw = Math.max(2, Math.floor(W / 2)), mh = Math.ceil(0.03 * Math.max(W, H)), mo = mh * (W / sw);
      const ky = [], kx = [];
      let ky0 = -mo - 1, ky1 = ky0 + H * (0.1 + 0.25 * hash(2.71)), kx0 = 2 * hash(5.13) - 1, kx1 = 2 * hash(12.9898 + 5.13) - 1, kn = 0;
      ky.push(ky0); kx.push(kx0); ky.push(ky1); kx.push(kx1);
      while (ky1 < H + mo + 2 && ky.length < 32) {
        kn += 1; ky0 = ky1; kx0 = kx1;
        ky1 = ky0 + H * (0.1 + 0.25 * hash(kn * 12.9898 + 2.71)); kx1 = 2 * hash(kn * 12.9898 + 5.13) - 1;
        ky.push(ky1); kx.push(kx1);
      }
      const KY = new Float32Array(32), KX = new Float32Array(32); KY.set(ky); KX.set(kx);
      this.bk = { W, H, am: W * 0.07, mo, fi: 1 / (1 + 2 * H / 720), KY, KX, nk: ky.length };
    }
    const bk = this.bk, u = rv ? 1 - qp : qp, top = rv ? B : A, bot = tbl || (rv ? A : B), dsg = rv ? -1 : 1;
    const qq = Math.floor(u * 12 + 0.5) / 12, qi = Math.floor(qq * 12 + 0.5) + (rv ? 50 : 0), dx = qq * (W + 2 * bk.am + 4);
    const qa = (hash(qi * 91.7 + 1.3) - 0.5) * 0.1, qy = hash(qi * 47.3 + 2.9) * H;
    const qw = (hash(qi * 13.1 + 4.7) - 0.5) * 0.01 * W, qh = (hash(qi * 71.9 + 6.1) - 0.5) * 0.01 * H;
    const c = Math.cos(qa), sn = Math.sin(qa), qcx = rv ? W - dx - bk.am : dx + bk.am;
    const x0 = qcx + c * (-qcx - qw) + sn * (-qy - qh) - dsg * dx, y0 = qy - sn * (-qcx - qw) + c * (-qy - qh);
    const qr = H * Math.abs(sn) + Math.abs(qw) + 2;
    const xa = rv ? 0 : Math.max(0, Math.floor(dx - bk.mo + qr)), xb = rv ? Math.min(W, Math.ceil(W - dx + bk.mo - qr)) : W;
    const T = this.get(W, H);
    this.draw('brush', T, { uTop: top, uBot: bot, uXY0: [x0, y0], uC: c, uSn: sn, uXa: xa, uXb: xb, uAm: bk.am, uFi: bk.fi, uRv: rv ? 1 : 0, uNk: bk.nk, uKy: bk.KY, uKx: bk.KX });
    return T;
  }

  // ---------- camera moves (DM:841-1011, §2.5) ----------
  _cmState(qm, p) {
    const W = this.W, H = this.H, cm = this.cm, S = { b: p >= 0.5, x: 0, y: 0, r: 0, c: 0, s: 1 };
    const q = S.b ? (p - 0.5) * 2 : p * 2, c1 = 1.70158 * cm.ov;
    const inback = (x, c) => (c + 1) * x * x * x - c * x * x, outback = (x, c) => { const y = x - 1; return 1 + (c + 1) * y * y * y + c * y * y; };
    const bounce = (x) => x < 1 / 2.75 ? 7.5625 * x * x : x < 2 / 2.75 ? (x -= 1.5 / 2.75, 7.5625 * x * x + 0.75)
      : x < 2.5 / 2.75 ? (x -= 2.25 / 2.75, 7.5625 * x * x + 0.9375) : (x -= 2.625 / 2.75, 7.5625 * x * x + 0.984375);
    const noise = (x, sd) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f), a = hash(i * 127.1 + sd * 311.7) * 2 - 1, b = hash((i + 1) * 127.1 + sd * 311.7) * 2 - 1; return a + (b - a) * u; };
    const shake = (env) => { const tr = env * env * cm.sh, k = cm.t * 18; return { kx: tr * 0.05 * noise(k, 1), ky: tr * 0.05 * noise(k, 2), kr: tr * 0.07 * noise(k, 3), ks: tr * 0.14, kc: tr * 0.018 }; };
    const cov = (r) => Math.abs(Math.cos(r)) + (Math.max(W, H) / Math.max(1, Math.min(W, H)) + 0.03) * Math.abs(Math.sin(r));
    const dx = qm === 26 || qm === 33 ? 1 : 0, dy = qm === 28 ? -1 : qm === 29 || qm === 36 ? 1 : 0;
    if (qm === 25) S.s = Math.max(0.55, S.b ? 1 + 2.5 * (1 - outback(q, c1)) : 1 + 2.5 * inback(q, c1));
    else if (qm <= 29) { const d = S.b ? -(1 - outback(q, c1 * 0.6)) * 1.15 : q * q * q * 1.15; S.x = dx * d; S.y = dy * d; }
    else if (qm === 30) {
      const k = shake(Math.max(0, 1 - Math.abs(p - 0.5) * 2));
      S.x = k.kx * 1.8; S.y = k.ky * 1.8; S.r = k.kr * 1.8; S.c = k.kc * 1.5;
      S.s = 1 + k.ks + 0.18 * Math.exp(-Math.abs(p - 0.5) * 28) * (0.4 + cm.sh);
      S.s = Math.max(S.s, cov(S.r) + 2 * Math.max(Math.abs(S.x), Math.abs(S.y)));
    } else if (qm === 31) {
      if (S.b) { const e = 1 - q; S.r = -0.8 * Math.PI * (1 - outback(q, c1 * 0.7)); S.s = 1 + e * e * e * 2; } else { const e = q * q * q; S.r = e * 0.8 * Math.PI; S.s = 1 + e * 2; }
      S.s = Math.max(S.s, cov(S.r));
    } else if (qm === 32) {
      if (S.b) {
        S.y = -1.1 * (1 - bounce(q)); const land = 1 / 2.75;
        if (q > land) { const k = shake(Math.exp(-(q - land) * 6) * (0.6 + 0.2 * cm.ov)); S.x = k.kx * 0.6; S.y += k.ky; S.r = k.kr * 0.5; S.s = 1 + k.ks * 0.5; S.c = k.kc * 0.7; }
      } else S.y = inback(q, c1 * 0.5) * 1.1;
    } else {
      const px = dx !== 0 ? dx : 0.45 * dy, py = dy !== 0 ? dy : -0.5 * dx;
      const e = S.b ? -(1 - outback(q, c1 * 0.7)) : inback(q, c1 * 0.7);
      S.x = px * 0.95 * e; S.y = py * 0.95 * e; S.r = 0.38 * e * (dx !== 0 ? dx : -dy);
      S.s = cov(S.r) + 2 * (dx !== 0 ? Math.abs(S.y) : Math.abs(S.x));
    }
    S.x *= cm.mx; S.y *= cm.my; S.r *= cm.mx * cm.my;
    return S;
  }
  _cmDraw(qm, p, A, B, mx, my, cam) {
    const W = this.W, H = this.H, cm = this.cm, t = this.now;
    cm.t = t; cm.bl = clamp01(cam.blur === undefined ? 0.6 : cam.blur); cm.ov = clamp(cam.overshoot === undefined ? 1 : cam.overshoot, 0, 2);
    cm.sh = clamp01(cam.shake === undefined ? 0.7 : cam.shake); cm.mx = mx; cm.my = my;
    const mul = qm === 25 ? 1 : qm <= 29 ? 2.2 : qm === 32 ? 0.8 : 1;
    if (t - cm.tc > 0.2) { cm.pl = cm.pp = p; cm.tc = t; }   // the shutter (DM:988-994)
    if (p !== cm.pl) { cm.pp = cm.pl; cm.pl = p; cm.tc = t; }
    const dp = t - cm.tc < 0.1 && Math.abs(p - cm.pp) < 0.5 ? p - cm.pp : 0;
    const win = Math.min(0.25, Math.abs(dp) * cm.bl * mul), lo = p < 0.5 ? 0 : 0.5, hi = p < 0.5 ? 0.4999 : 1;
    const pa = Math.max(lo, dp >= 0 ? p - win : p), pb = Math.min(hi, dp >= 0 ? p : p + win), sc = pb - pa > 0.0001 ? win / (pb - pa) : 0;
    const Sa = this._cmState(qm, pa), Sb = this._cmState(qm, pb), S = this._cmState(qm, p);
    const blur = cm.bl > 0 && Math.abs(Sb.x - Sa.x) + Math.abs(Sb.y - Sa.y) + Math.abs(Sb.r - Sa.r) + Math.abs(Sb.s - Sa.s) > 0.002;
    let cs = S.c, T;
    const pic = S.b ? B : A;
    if (blur) {   // the state at p at half size with a margin, smeared along the move (cm_mb), grown back
      const cw = Math.max(2, Math.floor(W / 4) * 2), ch = Math.max(2, Math.floor(H / 4) * 2), om = Math.ceil(Math.max(cw, ch) / 8);
      const M = this.get(cw + 2 * om, ch + 2 * om), qc = [cw / 2 + S.x * cw + om, ch / 2 + S.y * ch + om];
      this.draw('cmput', M, { uS: pic, uPic: [cw, ch], uC: qc, uSc: S.s, uR: S.r });
      cs = Math.max(cs, Sb.c);
      const Tm = this.get(cw, ch);
      this.draw('cmblur', Tm, { uS: M, uM: om, uQc: qc, uD: [(Sb.x - Sa.x) * cw * sc, (Sb.y - Sa.y) * ch * sc], uDr: (Sb.r - Sa.r) * sc, uDs: Math.log(Math.max(0.05, Sb.s) / Math.max(0.05, Sa.s)) * sc });
      T = this._comp(W, H, Tm, 1);
      this.put(M); this.put(Tm);
    } else {
      T = this.get(W, H);
      this.draw('cmput', T, { uS: pic, uPic: [W, H], uC: [W / 2 + S.x * W, H / 2 + S.y * H], uSc: S.s, uR: S.r });
    }
    if (cs > 0.0005) T = this._vfx(T, 8, Math.min(1, cs / 0.03), -1, 0, 2);   // the colour split (DM:1008)
    return T;
  }

  // ---------- the filter look (look, DM:755-839, §2.6 2); consumes img ----------
  _look(img, v) {
    const W = this.W, H = this.H, t = this.now;
    if (v < 0) {
      const b = -v, w1 = this.get(W, H);
      this.draw('look', w1, { u0: img, uSt: 0, uB: b, uT: t });
      this.put(img);
      // (the blur: REAPER shrinks with one filtered sample a pixel; a box here, smoother at large b)
      const s = this._down(w1, Math.max(1, Math.floor(W / (1 + b * 12))), Math.max(1, Math.floor(H / (1 + b * 12))));
      this.put(w1);
      const o = this.get(W, H);
      this.draw('look', o, { u1: s, uSt: 1, uB: b, uT: t });
      this.put(s);
      return o;
    }
    const b = v, sw = Math.max(2, Math.floor(W / 4)), sh = Math.max(2, Math.floor(H / 4));
    const lk = this._down(img, sw, sh), M = this.get(sw, sh), R = this.get(sw, sh);
    this.draw('look', M, { u0: lk, uSt: 2, uB: b });
    this.draw('look', R, { u0: M, uSt: 3, uB: b });
    const m1 = this.get(W, H);
    this.draw('look', m1, { u0: img, u1: M, u2: R, uSt: 4, uB: b });
    this.put(img); this.put(lk); this.put(M); this.put(R);
    const s3 = this._down(m1, Math.max(1, Math.floor(W / 3)), Math.max(1, Math.floor(H / 3))), m2 = this.get(W, H);
    this.draw('look', m2, { u0: m1, u1: s3, uSt: 5, uB: b });
    this.put(m1); this.put(s3);
    const s8 = this._down(m2, Math.max(1, Math.floor(W / 8)), Math.max(1, Math.floor(H / 8))), m3 = this.get(W, H);
    this.draw('look', m3, { u0: m2, u1: s8, uSt: 6, uA: 0.15 * b, uPost: 0 });
    this.put(m2); this.put(s8);
    if (Math.abs(32 - 24 * b - this.lkn) > 0.8) this.lkn = Math.floor(32 - 24 * b + 0.5);   // (hysteresis, DM:832)
    const s4 = this._down(m3, sw, sh), m4 = this.get(W, H);
    this.draw('look', m4, { u0: m3, u1: s4, uSt: 6, uA: 0.3 * b, uPost: Math.max(8, this.lkn), uGa: 1 + b * (0.5 + 1.5 * 0.2) });
    this.put(m3); this.put(s4);
    return m4;
  }

  dispose() {
    const gl = this.gl;
    this._flushPool();
    for (const t of [...this.src, this.dummy, this.osd]) if (t) gl.deleteTexture(t.tex);
    for (const k in this.P) gl.deleteProgram(this.P[k].p);
  }
}

// Core: timing, easing, wobbly hand-drawn primitives, text.
const W = 1920, H = 1080, FPS = 30;
// blog: drawn on a white page
const PAL = {
  bg: '#FFFFFF', paper: '#F8F7F3', ink: '#2E2B28', soft: '#8C877E', faint: '#C9C4BA',
  peri: '#8184DC', periDark: '#5B5EC2', pink: '#EEB4CB', pinkLine: '#E294B5',
  orange: '#EE9A3A', red: '#D9483B', grey: '#B5AD9E', tan: '#DCCDB4', teal: '#3F8A80',
  green: '#4E9A6B', claude: '#D97757', yellow: '#EBCB68', brown: '#9B6B43', blue: '#6C8FD8',
};
let ctx, TL, TIME = 0, RAW = 0;
let SC_ = 1, DPR_ = 1;   // blog: canvas backing scale (CSS px -> 1920 space) and device pixel ratio
const STEP = 12; // animation on twos: poses change 12x per second (stop-motion feel)

// ---------- timing ----------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const E = {
  out: t => 1 - Math.pow(1 - t, 3),
  in: t => t * t * t,
  io: t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  back: t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  smooth: t => t * t * (3 - 2 * t),
};
const norm = s => s.toLowerCase().replace(/[^a-z0-9']/g, '');
const LINE = id => TL.lines.find(l => l.id === id);
// Start time of the nth occurrence of `word` in line `id`.
function T(id, word, nth = 0, end = false) {
  let k = 0;
  for (const w of LINE(id).words) if (norm(w.w) === norm(word)) { if (k === nth) return end ? w.e : w.s; k++; }
  throw new Error(`word "${word}" not in ${id}`);
}
const TE = (id, word, nth = 0) => T(id, word, nth, true);
// Pop-in scale: 0 before t0, overshoot, settle; reverse fade with out.
function pop(t, t0, d = .45) { return t < t0 ? 0 : E.back(seg(t, t0, t0 + d)); }
function fade(t, t0, t1, d = .3) { return Math.min(seg(t, t0, t0 + d), 1 - seg(t, t1 - d, t1)); }

// ---------- noise ----------
function n1(i, s) { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return (x - Math.floor(x)) * 2 - 1; }
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const boil = () => Math.floor(TIME * 8);   // line boil at 8 drawings/s
function jit(pts, amp, seed) { const b = boil(); return pts.map((p, i) => [p[0] + n1(i * 2, seed + b * 13.1) * amp, p[1] + n1(i * 2 + 1, seed + b * 13.1) * amp]); }

// ---------- point sets ----------
function ellPts(cx, cy, rx, ry, n = 18, a0 = 0, a1 = Math.PI * 2) {
  const p = []; for (let i = 0; i < n; i++) { const a = a0 + (a1 - a0) * i / n; p.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return p;
}
function rrPts(x, y, w, h, r, step = 26) {
  r = Math.min(r, w / 2, h / 2); const p = [];
  const arc = (cx, cy, a0) => { for (let i = 0; i <= 4; i++) { const a = a0 + Math.PI / 2 * i / 4; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } };
  const edge = (x0, y0, x1, y1) => { const n = Math.max(1, Math.floor(Math.hypot(x1 - x0, y1 - y0) / step)); for (let i = 1; i < n; i++) p.push([lerp(x0, x1, i / n), lerp(y0, y1, i / n)]); };
  arc(x + w - r, y + r, -Math.PI / 2); edge(x + w, y + r, x + w, y + h - r);
  arc(x + w - r, y + h - r, 0); edge(x + w - r, y + h, x + r, y + h);
  arc(x + r, y + h - r, Math.PI / 2); edge(x, y + h - r, x, y + r);
  arc(x + r, y + r, Math.PI); edge(x + r, y, x + w - r, y);
  return p;
}
function resample(pts, step = 6) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let k = 1; k <= n; k++) out.push([lerp(x0, x1, k / n), lerp(y0, y1, k / n)]);
  }
  return out;
}

// ---------- crayon texture ----------
// Lines and letters are not solid: an alpha mask of grain + short diagonal streaks, like crayon on
// paper. The mask is re-offset every pose so the texture boils with the line work.
const TEXM = {}, TEXP = new WeakMap();   // blog: patterns cached per canvas context (several canvases share this renderer)
function texMask(kind) {
  if (TEXM[kind]) return TEXM[kind];
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'), id = g.createImageData(N, N), r = rng(kind === 'line' ? 91 : 93);
  const streak = new Float32Array(N * N);
  for (let k = 0; k < (kind === 'line' ? 900 : 500); k++) {          // short crayon drag marks
    const x = r() * N, y = r() * N, len = 6 + r() * 18, a = -.5 + r() * .25, depth = .4 + r() * .6;
    for (let j = 0; j < len; j++) { const xi = (((x + Math.cos(a) * j) | 0) % N + N) % N, yi = (((y + Math.sin(a) * j) | 0) % N + N) % N; streak[yi * N + xi] = Math.max(streak[yi * N + xi], depth); }
  }
  for (let i = 0; i < N * N; i++) {
    const grain = r(), hole = kind === 'line' ? Math.max(streak[i] * .55, grain < .1 ? .75 : grain < .32 ? .28 : 0) : Math.max(streak[i] * .18, grain < .1 ? .2 : 0);
    id.data[i * 4 + 3] = 255 * (1 - hole);
  }
  g.putImageData(id, 0, 0);
  return (TEXM[kind] = c);
}
function tex(color, kind = 'line') {
  if (typeof color !== 'string') return color;
  const key = color + kind;
  let cache = TEXP.get(ctx); if (!cache) TEXP.set(ctx, cache = {});
  let p = cache[key];
  if (!p) {
    const m = texMask(kind), c = document.createElement('canvas'); c.width = c.height = m.width;
    const g = c.getContext('2d'); g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'destination-in'; g.drawImage(m, 0, 0);
    p = cache[key] = ctx.createPattern(c, 'repeat');
  }
  const T = ctx.getTransform(), sc = (Math.hypot(T.a, T.b) || 1) / DPR_, b = boil();
  p.setTransform(new DOMMatrix([1 / sc, 0, 0, 1 / sc, n1(b, 1) * 128, n1(b, 2) * 128]));
  return p;
}

// ---------- path drawing ----------
function cr(pts, closed) {
  const n = pts.length; if (n < 2) return;
  const g = i => closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)];
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
  if (closed) ctx.closePath();
}
function fillP(pts, color, o = {}) {
  ctx.beginPath(); cr(jit(pts, o.amp ?? 1.6, o.seed ?? 1), true);
  ctx.fillStyle = o.solid ? color : tex(color, 'fill'); ctx.fill();
  if (o.stroke) { ctx.strokeStyle = tex(o.stroke); ctx.lineWidth = o.lw ?? 2.6; ctx.lineCap = ctx.lineJoin = 'round'; ctx.stroke(); }
}
// Open or closed stroke with optional draw-on progress.
function strokeP(pts, color, lw = 3, o = {}) {
  let p = o.dense ? pts : resample(o.closed ? [...pts, pts[0]] : pts, o.step ?? 10);
  if ((o.prog ?? 1) <= 0) return;
  if (o.prog !== undefined && o.prog < 1) p = p.slice(0, Math.max(2, Math.ceil(p.length * o.prog)));
  ctx.beginPath(); cr(jit(p, o.amp ?? 1.1, o.seed ?? 7), false);
  ctx.strokeStyle = o.solid ? color : tex(color); ctx.lineWidth = lw; ctx.lineCap = ctx.lineJoin = 'round'; ctx.stroke();
}
const line = (x0, y0, x1, y1, color = PAL.ink, lw = 3, o = {}) => strokeP([[x0, y0], [x1, y1]], color, lw, o);
function dashed(pts, color, lw, dash, o = {}) { ctx.save(); ctx.setLineDash(dash); strokeP(pts, color, lw, o); ctx.restore(); }

// ---------- transforms ----------
function push(x = 0, y = 0, s = 1, r = 0, a = 1) { ctx.save(); ctx.translate(x, y); if (r) ctx.rotate(r); if (s !== 1) ctx.scale(s, s); if (a !== 1) ctx.globalAlpha *= a; }
const pop_ = () => ctx.restore();

// ---------- text ----------
const FONT = { hand: 'Gaegu', marker: 'Covered By Your Grace', tall: 'Gaegu', script: 'Reenie Beanie', pen: 'Waiting for the Sunrise' };
// School-of-Life lettering: hand-printed capitals, widely spaced. App-screen text stays mixed case.
let NOCAPS = false;
const isCaps = (font, o) => font === 'hand' && !NOCAPS && o.caps !== false;
const spacing = (font, size, o) => isCaps(font, o) ? size * .12 : 0;
function noCaps(fn) { const p = NOCAPS; NOCAPS = true; try { fn(); } finally { NOCAPS = p; } }
const fontStr = (size, font, weight) => `${weight ?? (font === 'hand' || font === 'tall' ? 700 : 400)} ${size}px "${FONT[font] ?? font}"`;
// Hand-lettered text: each glyph jitters and boils; o.write in [0,1] writes it on glyph by glyph.
function text(str, x, y, o = {}) {
  const size = o.size ?? 40, font = o.font ?? 'hand';
  ctx.save();
  ctx.font = fontStr(size, font, o.weight);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  ctx.fillStyle = tex(o.color ?? PAL.ink);
  if (isCaps(font, o)) str = str.toUpperCase();
  const sp = spacing(font, size, o);
  const w = ctx.measureText(str).width + sp * Math.max(0, str.length - 1);
  if (o.rot) { ctx.translate(x, y); ctx.rotate(o.rot); x = 0; y = 0; }
  const x0 = (o.align ?? 'center') === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
  const prog = o.write ?? o.typed ?? 1, n = str.length, shown = prog * n;
  const b = boil(), seed = o.seed ?? (str.length * 7.3 + size);
  const amp = (o.jitter ?? 1) * Math.max(.6, size / 40);
  if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = o.strokeW ?? 6; ctx.lineJoin = 'round'; }
  for (let i = 0; i < n && i < shown; i++) {
    const ch = str[i]; if (ch === ' ') continue;
    const cx = x0 + ctx.measureText(str.slice(0, i)).width + sp * i;
    const part = clamp(shown - i);
    ctx.save();
    ctx.translate(cx, y + n1(i, seed + b * 3.1) * 1.1 * amp);
    ctx.rotate(n1(i + 50, seed + b * 3.1) * .035 * (o.jitter ?? 1));
    if (part < 1) { const cw = ctx.measureText(ch).width; ctx.beginPath(); ctx.rect(-4, -size * 1.4, (cw + 8) * part, size * 2); ctx.clip(); }
    if (o.stroke) ctx.strokeText(ch, 0, 0);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  }
  ctx.restore();
  return w;
}
function measure(str, size, font = 'hand', weight) { ctx.save(); ctx.font = fontStr(size, font, weight); const o = {}; const s2 = isCaps(font, o) ? str.toUpperCase() : str; const w = ctx.measureText(s2).width + spacing(font, size, o) * Math.max(0, s2.length - 1); ctx.restore(); return w; }
// Plain (fast) text for tiny/numerous labels.
function ptext(str, x, y, size, color = PAL.ink, align = 'left', font = 'hand') { ctx.font = fontStr(size, font); ctx.textAlign = align; ctx.fillStyle = color; ctx.fillText(str, x, y); ctx.textAlign = 'left'; }
// Word-wrap into lines no wider than maxW.
function wrap(str, size, maxW, font = 'hand') {
  const words = str.split(' '), out = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (measure(t, size, font) > maxW && cur) { out.push(cur); cur = w; } else cur = t; }
  if (cur) out.push(cur); return out;
}

// Characters and props in the blob-figure style. Local coords: feet at (0,0).

function bodyPts(w = 120, h = 140) {
  const p = [[-w / 2, 0], [-w / 2 - 1, -h * .3]];
  for (let i = 0; i <= 10; i++) { const a = Math.PI + Math.PI * i / 10; p.push([Math.cos(a) * (w / 2 - 2), -h * .57 + Math.sin(a) * h * .43]); }
  p.push([w / 2 + 1, -h * .3], [w / 2, 0], [w / 4, 1], [0, 1], [-w / 4, 1]);
  return p;
}

function face(o, cx, cy, seed) {
  const lx = (o.look ?? 0) * 6, ly = (o.lookY ?? 0) * 4, m = o.mood ?? 'neutral';
  const ex = 10, ey = cy + 1 + ly;
  ctx.fillStyle = PAL.ink;
  const blink = o.blink ?? (((TIME * 1000 + seed * 977) % 4200) < 120);
  const st = Math.floor(TIME * STEP);
  if (m === 'happy' || m === 'proud') {
    for (const sx of [-1, 1]) strokeP([[cx + sx * ex - 5 + lx, ey + 2], [cx + sx * ex + lx, ey - 3], [cx + sx * ex + 5 + lx, ey + 2]], PAL.ink, 2.4, { amp: .3, seed });
  } else if (m === 'focus') {
    for (const sx of [-1, 1]) line(cx + sx * ex - 5 + lx, ey + 1, cx + sx * ex + 5 + lx, ey + 1, PAL.ink, 2.8, { amp: .2 });
    for (const sx of [-1, 1]) line(cx + sx * 4 + lx, ey - 8, cx + sx * 15 + lx, ey - 5, PAL.ink, 2.2, { amp: .3, seed });
  } else if (blink) {
    for (const sx of [-1, 1]) line(cx + sx * ex - 4 + lx, ey, cx + sx * ex + 4 + lx, ey, PAL.ink, 2.2, { amp: .2 });
  } else {
    const r = m === 'surprised' || m === 'delight' ? 3.8 : 2.9;
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + sx * ex + lx, ey, r, 0, 7); ctx.fill(); }
  }
  if (m === 'sad' || m === 'worried') for (const sx of [-1, 1]) line(cx + sx * 6 + lx, ey - 9, cx + sx * 15 + lx, ey - 6, PAL.ink, 2, { amp: .3, seed });
  if (m === 'angry') for (const sx of [-1, 1]) line(cx + sx * 5 + lx, ey - 6, cx + sx * 15 + lx, ey - 11, PAL.ink, 2.4, { amp: .3, seed });
  // nose
  strokeP([[cx + 2 + lx, ey + 2], [cx - 1 + lx, ey + 11], [cx + 3 + lx, ey + 12]], PAL.ink, 2, { amp: .3, seed });
  const my = ey + 20;
  if (m === 'proud' || m === 'delight') { ctx.beginPath(); ctx.moveTo(cx - 9 + lx, my - 3); ctx.quadraticCurveTo(cx + lx, my + 9, cx + 9 + lx, my - 3); ctx.closePath(); ctx.fillStyle = PAL.ink; ctx.fill(); }
  else if (m === 'talk') { if (st % 2) { ctx.beginPath(); ctx.ellipse(cx + lx, my + 1, 4.5, 5.5, 0, 0, 7); ctx.fillStyle = PAL.ink; ctx.fill(); } else line(cx - 5 + lx, my, cx + 5 + lx, my, PAL.ink, 2.2, { amp: .2 }); }
  else if (m === 'focus') { line(cx - 5 + lx, my, cx + 3 + lx, my, PAL.ink, 2.2, { amp: .2 }); fillP(ellPts(cx + 5 + lx, my + 3, 3, 3.5, 8), PAL.pinkLine, { amp: .2 }); }
  else if (m === 'happy') strokeP([[cx - 7 + lx, my - 2], [cx + lx, my + 3], [cx + 7 + lx, my - 2]], PAL.ink, 2.2, { amp: .3, seed });
  else if (m === 'sad' || m === 'angry') strokeP([[cx - 6 + lx, my + 3], [cx + lx, my - 1], [cx + 6 + lx, my + 3]], PAL.ink, 2.2, { amp: .3, seed });
  else if (m === 'surprised') { ctx.beginPath(); ctx.ellipse(cx + lx, my + 1, 3.5, 4.5, 0, 0, 7); ctx.strokeStyle = PAL.ink; ctx.lineWidth = 2; ctx.stroke(); }
  else line(cx - 4 + lx, my, cx + 4 + lx, my, PAL.ink, 2.2, { amp: .2 });
}

function hair(style, color, cx, cy, seed) {
  const lw = 2.8;
  if (style === 'bob') {
    const p = [];
    for (let i = 0; i <= 14; i++) { const a = Math.PI * (1.06 + .88 * i / 14); const r = 44 + Math.sin(i * 1.9) * 3; p.push([cx + Math.cos(a) * r, cy + 4 + Math.sin(a) * (r + 2)]); }
    p.push([cx + 44, cy + 18], [cx + 40, cy + 34], [cx + 26, cy + 30], [cx + 24, cy - 6], [cx + 4, cy - 16], [cx - 20, cy - 10], [cx - 26, cy + 30], [cx - 40, cy + 34], [cx - 44, cy + 18]);
    strokeP(p, color, lw, { closed: true, seed });
  } else if (style === 'tuft') {
    const p = []; for (let i = 0; i <= 40; i++) { const u = i / 40; p.push([cx - 18 + 36 * u + 8 * Math.cos(u * Math.PI * 6), cy - 44 + 9 * Math.sin(u * Math.PI * 6)]); }
    strokeP(p, color, lw, { dense: true, seed, amp: .6 });
  } else if (style === 'bun') {
    strokeP(ellPts(cx, cy - 50, 12, 11, 12), color, lw, { closed: true, seed });
    const p = []; for (let i = 0; i <= 16; i++) { const a = Math.PI * (1.1 + .8 * i / 16); p.push([cx + Math.cos(a) * 37, cy + Math.sin(a) * 40 + Math.sin(i * 2.4) * 3]); }
    strokeP(p, color, lw, { seed });
  } else if (style === 'spiky') {
    for (let i = 0; i < 6; i++) { const a = Math.PI * (1.18 + .64 * i / 5); line(cx + Math.cos(a) * 34, cy + Math.sin(a) * 36, cx + Math.cos(a) * 50, cy + Math.sin(a) * 52, color, lw, { seed: seed + i }); }
  } else if (style === 'long') {
    for (const s of [-1, 1]) strokeP([[cx, cy - 38], [cx + s * 30, cy - 30], [cx + s * 40, cy], [cx + s * 42, cy + 30], [cx + s * 46, cy + 52]], color, lw, { seed: seed + s });
  } else if (style === 'cap') {
    const p = []; for (let i = 0; i <= 12; i++) { const a = Math.PI * (1 + i / 12); p.push([cx + Math.cos(a) * 34, cy - 10 + Math.sin(a) * 32]); }
    fillP(p, color, { seed }); line(cx - 38, cy - 9, cx + 38, cy - 9, PAL.ink, 2.4, { seed });
  } else if (style === 'curly') {
    for (let i = 0; i < 7; i++) { const a = Math.PI * (1.08 + .84 * i / 6); strokeP(ellPts(cx + Math.cos(a) * 36, cy + Math.sin(a) * 38, 8, 8, 8), color, 2.4, { closed: true, seed: seed + i }); }
  }
}

// o: {body, hair, hairColor, mood, look, device, screen(w,h), arms, glasses, tap:[x,y,phase]}
function person(x, y, s, o = {}) {
  const seed = o.seed ?? 3;
  push(x, y + (o.bob ?? 0), s, o.rot ?? 0, o.alpha ?? 1);
  const bw = o.w ?? 120, bh = o.h ?? 140, hy = -bh - 30;
  fillP(bodyPts(bw, bh), o.body ?? PAL.peri, { seed });
  if (o.dots) { ctx.fillStyle = o.dots; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(i * 9, -bh + 22 + Math.abs(i) * -3 + 6, 3.4, 0, 7); ctx.fill(); } }
  // head
  fillP(ellPts(0, hy, 29, 33, 16), PAL.bg, { seed: seed + 1, stroke: PAL.ink, lw: 2.4, amp: .9 });
  hair(o.hair ?? 'bob', o.hairColor ?? PAL.pinkLine, 0, hy, seed);
  face(o, 0, hy, seed);
  if (o.glasses) for (const sx of [-1, 1]) strokeP(ellPts(sx * 10, hy + 1, 9, 8, 10), PAL.ink, 1.8, { closed: true, amp: .3 });
  // arms + device
  const dev = o.device;
  if (dev) {
    const d = DEV[dev], dx = o.devX ?? 0, dy = -bh * .5 + (d.oy ?? 0);
    device(dev, dx, dy, o.screen, o.tap);
    for (const sx of [-1, 1]) strokeP([[sx * (bw * .4), -bh * .78], [sx * (bw * .36 + 6), -bh * .5], [dx + sx * (d.w / 2 - 2), dy + d.h * .2]], PAL.ink, 2.6, { seed: seed + sx * 3 });
  } else if (o.arms === 'down') {
    for (const sx of [-1, 1]) strokeP([[sx * bw * .38, -bh * .8], [sx * bw * .44, -bh * .45], [sx * bw * .4, -bh * .2]], PAL.ink, 2.6, { seed: seed + sx });
  } else if (o.arms === 'wave') {
    strokeP([[-bw * .4, -bh * .8], [-bw * .45, -bh * .45], [-bw * .38, -bh * .22]], PAL.ink, 2.6, { seed });
    const w = Math.sin(TIME * 9) * 10;
    strokeP([[bw * .4, -bh * .8], [bw * .62, -bh * 1.0], [bw * .66 + w, -bh * 1.3]], PAL.ink, 2.6, { seed });
  } else if (o.arms !== 'none') {
    strokeP([[-bw * .42, -bh * .82], [-bw * .2, -bh * .5], [bw * .18, -bh * .42]], PAL.ink, 2.6, { seed });
    strokeP([[bw * .42, -bh * .82], [bw * .2, -bh * .52], [-bw * .16, -bh * .46]], PAL.ink, 2.6, { seed: seed + 5 });
  }
  pop_();
}

function claude(x, y, s, o = {}) {
  const seed = o.seed ?? 11;
  push(x, y + (o.bob ?? 0), s, o.rot ?? 0, o.alpha ?? 1);
  const bp = []; for (let i = 0; i < 18; i++) { const a = Math.PI * 2 * i / 18; bp.push([Math.cos(a) * 64, -62 + Math.sin(a) * 60 + (Math.sin(a) > 0 ? 2 : 0)]); }
  fillP(bp, o.body ?? PAL.claude, { seed });
  const hy = -150;
  fillP(ellPts(0, hy, 28, 31, 16), PAL.bg, { seed: seed + 1, stroke: PAL.ink, lw: 2.4, amp: .9 });
  // the Claude mark above the head (or a plain antenna for other agents)
  if (o.mark && o.mark !== 'claude' && o.mark !== true) {
    const ms = o.markScale ?? 1;
    line(0, hy - 31, 0, hy - 40, PAL.ink, 2.2, { seed });
    hdLogo(o.mark, 0, hy - 40 - 20 * ms, 20 * ms, 0, seed);
  } else if (o.mark === false) {
    line(0, hy - 31, 2, hy - 54, PAL.ink, 2.4, { seed });
    fillP(ellPts(2, hy - 58, 6, 6, 10), o.body ?? PAL.grey, { stroke: PAL.ink, lw: 2, amp: .5, seed });
  } else claudeMark(0, hy - 56, 21 * (o.spark ?? 1), TIME * .35, seed);
  face({ mood: o.mood ?? 'neutral', look: o.look, lookY: o.lookY }, 0, hy, seed);
  const dev = o.device;
  if (dev) {
    const d = DEV[dev], dy = -66;
    device(dev, 0, dy, o.screen, o.tap);
    for (const sx of [-1, 1]) strokeP([[sx * 52, -96], [sx * 50, -70], [sx * (d.w / 2 - 2), dy + d.h * .2]], PAL.ink, 2.6, { seed: seed + sx });
  } else if (o.work) {
    const st = Math.floor(TIME * STEP), up = st % 2;
    for (const sx of [-1, 1]) strokeP([[sx * 52, -96], [sx * (58 + up * 6), -130 - up * 14], [sx * (40 + up * 10), -168 - up * 10]], PAL.ink, 2.6, { seed: seed + sx + up });
    for (const sx of [-1, 1]) for (let k = 0; k < 2; k++) strokeP(ellPts(sx * 52, -150, 22 + k * 9, 30 + k * 9, 10, sx > 0 ? -1.4 : 1.8, sx > 0 ? -.4 : 2.8), PAL.faint, 1.8, { seed: seed + k });
  } else if (o.tool) {
    strokeP([[-50, -92], [-40, -60], [-10, -46]], PAL.ink, 2.6, { seed });
    strokeP([[50, -92], [62, -76], [76, -86]], PAL.ink, 2.6, { seed });
  }
  pop_();
}

const DEV = { phone: { w: 54, h: 92, r: 9 }, tablet: { w: 120, h: 88, r: 9, oy: -4 }, laptop: { w: 120, h: 80, r: 6 } };
// Device centered at (cx,cy), screen callback draws in a (w,h) box at top-left origin.
function device(kind, cx, cy, screen, tap) {
  const d = DEV[kind];
  fillP(rrPts(cx - d.w / 2, cy - d.h / 2, d.w, d.h, d.r, 14), PAL.paper, { stroke: PAL.ink, lw: 2.4, amp: .7, seed: 21 });
  if (screen) {
    const pad = 5, sw = d.w - pad * 2, sh = d.h - pad * 2;
    ctx.save(); ctx.beginPath(); ctx.rect(cx - sw / 2, cy - sh / 2, sw, sh); ctx.clip();
    push(cx - sw / 2, cy - sh / 2); noCaps(() => screen(sw, sh)); pop_();
    ctx.restore();
  }
  if (tap) ripple(cx - d.w / 2 + tap[0] * d.w, cy - d.h / 2 + tap[1] * d.h, tap[2]);
}
// Tap ripple; ph in [0,1).
function ripple(x, y, ph, r = 16, color = PAL.periDark) {
  if (ph < 0 || ph > 1) return;
  ctx.save(); ctx.globalAlpha *= (1 - ph) * .9; ctx.strokeStyle = color; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.arc(x, y, 3 + r * E.out(ph), 0, 7); ctx.stroke();
  ctx.globalAlpha *= 1.2; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 3.5 * (1 - ph), 0, 7); ctx.fill();
  ctx.restore();
}

function rug(x, y, rx = 110, ry = 24, a = 1) {
  push(x, y, 1, 0, a);
  fillP(ellPts(0, 0, rx, ry, 20), PAL.tan, { seed: 31, amp: 1.2 });
  strokeP(ellPts(0, 0, rx * .72, ry * .62, 20), '#F2E3CF', 2.2, { closed: true, seed: 32 });
  pop_();
}

// Speech bubble: box centered at (x,y); tail tip at (tx,ty).
function bubble(x, y, w, h, tx, ty, o = {}) {
  const p = rrPts(x - w / 2, y - h / 2, w, h, Math.min(h / 2, 40), 22);
  const pr = o.prog ?? 1;
  if (pr <= 0) return;
  if (pr < 1) { // being drawn: outline first, then the paper fill settles in
    push(0, 0, 1, 0, (o.alpha ?? 1));
    ctx.save(); ctx.globalAlpha *= seg(pr, .55, 1); fillP(p, o.fill ?? PAL.paper, { amp: .9, seed: 42 }); ctx.restore();
    strokeP(p, o.stroke ?? PAL.ink, 2.2, { closed: true, prog: seg(pr, 0, .75), seed: 42, amp: .9 });
    if (tx !== undefined && pr > .7) { const bx = clamp(tx, x - w / 2 + 40, x + w / 2 - 40), by = ty > y ? y + h / 2 : y - h / 2; strokeP([[bx - 16, by], [tx, ty], [bx + 16, by]], o.stroke ?? PAL.ink, 2.2, { prog: seg(pr, .7, 1), seed: 41, amp: .5 }); }
    pop_(); return;
  }
  push(0, 0, 1, 0, o.alpha ?? 1);
  if (tx !== undefined) {
    const bx = clamp(tx, x - w / 2 + 40, x + w / 2 - 40), by = ty > y ? y + h / 2 - 2 : y - h / 2 + 2;
    fillP([[bx - 18, by], [tx, ty], [bx + 18, by]], o.fill ?? PAL.paper, { stroke: o.stroke ?? PAL.ink, lw: 2.2, amp: .6, seed: 41 });
  }
  fillP(p, o.fill ?? PAL.paper, { stroke: o.stroke ?? PAL.ink, lw: 2.2, amp: .9, seed: 42 });
  if (tx !== undefined) { const bx = clamp(tx, x - w / 2 + 40, x + w / 2 - 40), by = ty > y ? y + h / 2 - 2 : y - h / 2 + 2; line(bx - 15, by, bx + 15, by, o.fill ?? PAL.paper, 5, { amp: .3 }); }
  pop_();
}
function thought(x, y, w, h, tx, ty, a = 1) {
  push(0, 0, 1, 0, a);
  const p = []; const n = 14; for (let i = 0; i < n; i++) { const ang = Math.PI * 2 * i / n; const r = 1 + .08 * Math.sin(i * 2.7); p.push([x + Math.cos(ang) * w / 2 * r, y + Math.sin(ang) * h / 2 * r]); }
  fillP(p, PAL.paper, { stroke: PAL.ink, lw: 2.2, seed: 51 });
  if (tx !== undefined) for (let k = 0; k < 2; k++) { const u = .45 + k * .3; const cx = lerp(x, tx, u), cy = lerp(y + h / 2, ty, u); fillP(ellPts(cx, cy, 9 - k * 3, 7 - k * 2, 10), PAL.paper, { stroke: PAL.ink, lw: 2, seed: 52 + k }); }
  pop_();
}
// Frustration scribble above a head.
function scribble(x, y, s, color, seed, prog = 1) {
  const r = rng(seed), p = [];
  let a = 0; for (let i = 0; i < 26; i++) { a += 1.1 + r() * 1.4; p.push([x + Math.cos(a) * (14 + r() * 16) * s + (i - 13) * 1.6 * s, y + Math.sin(a) * (8 + r() * 10) * s]); }
  strokeP(p, color, 2.4, { prog, seed, amp: 1.2 });
}
function heart(x, y, s = 1, color = PAL.red, a = 1) {
  push(x, y, s, 0, a);
  const p = []; for (let i = 0; i < 24; i++) { const t = Math.PI * 2 * i / 24; p.push([16 * Math.pow(Math.sin(t), 3) * .9, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * .9]); }
  fillP(p, color, { seed: 61, amp: .5 });
  pop_();
}
function check(x, y, s = 1, color = PAL.green, prog = 1, lw = 6) { push(x, y, s); strokeP([[-18, 0], [-6, 13], [20, -16]], color, lw, { prog, seed: 71 }); pop_(); }
function cross(x, y, s = 1, color = PAL.red, prog = 1, lw = 6) {
  push(x, y, s); strokeP([[-14, -14], [14, 14]], color, lw, { prog: clamp(prog * 2), seed: 72 }); strokeP([[14, -14], [-14, 14]], color, lw, { prog: clamp(prog * 2 - 1), seed: 73 }); pop_();
}
function circleMark(x, y, rx, ry, color = PAL.red, prog = 1, lw = 4) {
  const p = []; for (let i = 0; i <= 26; i++) { const a = -2.2 + Math.PI * 2.15 * i / 26; p.push([x + Math.cos(a) * rx * (1 + .05 * Math.sin(i)), y + Math.sin(a) * ry]); }
  strokeP(p, color, lw, { prog, seed: 74 });
}
function bug(x, y, s = 1, rot = 0, o = {}) {
  push(x, y, s, rot, o.alpha ?? 1);
  const wig = Math.sin(TIME * 30 + x) * (o.walk ? 4 : 0);
  for (const sx of [-1, 1]) for (let k = -1; k <= 1; k++) line(sx * 8, k * 7, sx * 19, k * 9 + (k === 0 ? wig * sx : -wig * sx) , PAL.ink, 2.2, { amp: .3 });
  line(-4, -14, -9, -24, PAL.ink, 2, { amp: .3 }); line(4, -14, 9, -24, PAL.ink, 2, { amp: .3 });
  fillP(ellPts(0, 2, 11, 14, 12), o.color ?? '#3B3632', { amp: .5, seed: 81 });
  fillP(ellPts(0, -12, 7, 6, 10), o.color ?? '#3B3632', { amp: .3, seed: 82 });
  line(0, -6, 0, 15, '#6E655B', 1.6, { amp: .2 });
  ctx.fillStyle = PAL.paper; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * 3, -13, 1.6, 0, 7); ctx.fill(); }
  pop_();
}
function broom(x, y, s = 1, rot = 0) {
  push(x, y, s, rot);
  line(0, -260, 0, -40, PAL.brown, 9, { amp: .6, seed: 91 });
  fillP([[-14, -46], [14, -46], [46, 30], [-46, 30]], PAL.yellow, { amp: 1, seed: 92 });
  for (let i = -3; i <= 3; i++) line(i * 4, -40, i * 13, 26, '#C99A3B', 1.8, { amp: .6, seed: 93 + i });
  fillP(rrPts(-16, -54, 32, 12, 4, 10), '#B4583C', { amp: .4, seed: 99 });
  pop_();
}
function magnifier(x, y, s = 1, rot = 0) {
  push(x, y, s, rot);
  line(22, 22, 52, 52, PAL.brown, 9, { amp: .4 });
  fillP(ellPts(0, 0, 30, 30, 16), 'rgba(255,255,255,.55)', { stroke: PAL.ink, lw: 4, amp: .6, seed: 101 });
  pop_();
}
function wrench(x, y, s = 1, rot = 0) {
  push(x, y, s, rot);
  fillP(rrPts(-7, -10, 14, 70, 7, 12), PAL.grey, { stroke: PAL.ink, lw: 2.4, amp: .5, seed: 111 });
  fillP([[-20, -34], [-8, -10], [8, -10], [20, -34], [10, -40], [6, -24], [-6, -24], [-10, -40]], PAL.grey, { stroke: PAL.ink, lw: 2.4, amp: .5, seed: 112 });
  pop_();
}
function cursor(x, y, s = 1, a = 1) {
  push(x, y, s, -.08, a);
  fillP([[0, 0], [0, 34], [9, 26], [16, 40], [22, 37], [15, 23], [27, 22]], PAL.paper, { stroke: PAL.ink, lw: 2.6, amp: .4, seed: 121 });
  pop_();
}
function clock(x, y, r, t, a = 1) {
  push(x, y, 1, 0, a);
  fillP(ellPts(0, 0, r, r, 22), PAL.paper, { stroke: PAL.ink, lw: 3, seed: 131 });
  for (let i = 0; i < 12; i++) { const an = Math.PI * 2 * i / 12; line(Math.cos(an) * r * .78, Math.sin(an) * r * .78, Math.cos(an) * r * .88, Math.sin(an) * r * .88, PAL.ink, 2.4, { amp: .2 }); }
  const h = t * .5, m = t * 6;
  line(0, 0, Math.sin(h) * r * .45, -Math.cos(h) * r * .45, PAL.ink, 4, { amp: .2 });
  line(0, 0, Math.sin(m) * r * .7, -Math.cos(m) * r * .7, PAL.red, 3, { amp: .2 });
  pop_();
}
function snail(x, y, s = 1) {
  push(x, y, s);
  fillP([[-50, 0], [-40, -14], [30, -12], [44, -20], [50, -30], [56, -26], [52, -6], [40, 0]], PAL.tan, { stroke: PAL.ink, lw: 2.4, seed: 141 });
  line(48, -28, 52, -48, PAL.ink, 2); line(54, -28, 64, -44, PAL.ink, 2);
  fillP(ellPts(-6, -30, 30, 28, 18), PAL.pink, { stroke: PAL.ink, lw: 2.4, seed: 142 });
  const p = []; for (let i = 0; i < 40; i++) { const a = i * .42, r = 24 * (1 - i / 44); p.push([-6 + Math.cos(a) * r, -30 + Math.sin(a) * r * .95]); }
  strokeP(p, PAL.pinkLine, 2.2, { dense: true, amp: .4 });
  pop_();
}
function wifi(x, y, s, level, color = PAL.ink) {
  push(x, y, s);
  for (let i = 0; i < 3; i++) { const p = []; const r = 14 + i * 14; for (let k = 0; k <= 8; k++) { const a = -Math.PI * .75 + Math.PI * .5 * k / 8; p.push([Math.cos(a) * r, Math.sin(a) * r]); } strokeP(p, i < level ? color : PAL.faint, 4, { seed: 151 + i }); }
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, 4, 0, 7); ctx.fill();
  pop_();
}
function globe(x, y, r) {
  fillP(ellPts(x, y, r, r, 18), '#CFE0E6', { stroke: PAL.ink, lw: 2.4, seed: 161 });
  fillP([[x - r * .5, y - r * .4], [x - r * .1, y - r * .55], [x + r * .1, y - r * .1], [x - r * .3, y + r * .3], [x - r * .55, y]], PAL.green, { amp: .8, seed: 162 });
  fillP([[x + r * .3, y + r * .1], [x + r * .65, y - r * .05], [x + r * .5, y + r * .5], [x + r * .25, y + r * .45]], PAL.green, { amp: .8, seed: 163 });
}
function plane(x, y, s = 1, rot = 0) {
  push(x, y, s, rot);
  fillP([[-30, 0], [26, -4], [34, 0], [26, 4]], PAL.paper, { stroke: PAL.ink, lw: 2.2, amp: .4, seed: 171 });
  fillP([[-2, -2], [8, -24], [14, -24], [10, -2]], PAL.paper, { stroke: PAL.ink, lw: 2.2, amp: .4, seed: 172 });
  fillP([[-2, 2], [8, 22], [14, 22], [10, 2]], PAL.paper, { stroke: PAL.ink, lw: 2.2, amp: .4, seed: 173 });
  pop_();
}
function envelope(x, y, s = 1, rot = 0, a = 1) {
  push(x, y, s, rot, a);
  fillP(rrPts(-26, -17, 52, 34, 4, 12), PAL.paper, { stroke: PAL.ink, lw: 2.2, amp: .5, seed: 181 });
  strokeP([[-24, -14], [0, 4], [24, -14]], PAL.ink, 2.2, { seed: 182 });
  pop_();
}
function sparkles(x, y, r, t, n = 6, color = PAL.orange) {
  for (let i = 0; i < n; i++) {
    const a = Math.PI * 2 * i / n + .4, ph = (t * 1.5 + i * .17) % 1; const rr = r * (.6 + .5 * ph);
    const cx = x + Math.cos(a) * rr, cy = y + Math.sin(a) * rr, k = 7 * Math.sin(ph * Math.PI);
    line(cx - k, cy, cx + k, cy, color, 2.6, { amp: .2 }); line(cx, cy - k, cx, cy + k, color, 2.6, { amp: .2 });
  }
}
// Curved arrow along points with arrowhead at end.
function arrow(pts, color = PAL.ink, lw = 3, prog = 1, head = 14) {
  const p = resample(pts, 8); strokeP(p, color, lw, { prog, dense: true });
  if (prog < .98) return;
  const [x1, y1] = p[p.length - 1], [x0, y0] = p[Math.max(0, p.length - 4)]; const a = Math.atan2(y1 - y0, x1 - x0);
  strokeP([[x1 - Math.cos(a - .5) * head, y1 - Math.sin(a - .5) * head], [x1, y1], [x1 - Math.cos(a + .5) * head, y1 - Math.sin(a + .5) * head]], color, lw, { amp: .4 });
}

// ---------- the wedding RSVP app ----------
// state: ok | big | tz | vanish | double | sent | error
function rsvp(w, h, state = 'ok', o = {}) {
  ctx.fillStyle = '#FFFDF8'; ctx.fillRect(0, 0, w, h);
  const k = h / 100, big = state === 'big', pc = o.pieces ?? 9;
  const z = big ? (o.zoom ?? 2.0) : 1;
  if (pc < 1) return;
  text('Lia & Tom', w / 2, 16 * k * z, { font: 'marker', size: 13 * k * z, color: PAL.periDark, jitter: .5 });
  heart(w / 2, 23 * k * z, .18 * k * z, PAL.red);
  if (pc < 2) return;
  const tz = state === 'tz';
  text(tz ? 'Fri · June 13' : 'Sat · June 14', w / 2, 34 * k * z, { size: 7.5 * k * z, color: tz ? PAL.red : PAL.soft });
  if (tz) circleMark(w / 2, 31.5 * k, w * .36, 6 * k, PAL.red, o.mark ?? 1, 2.2);
  if (state === 'vanish' || state === 'double') {
    text('guests coming', w / 2, 47 * k, { size: 6.5 * k, color: PAL.soft });
    const names = state === 'double' ? ['Mia', 'Sam', 'Sam'] : ['Mia', o.name ?? 'Leo'];
    names.forEach((n, i) => {
      const yy = 58 * k + i * 11 * k, gone = state === 'vanish' && i === 1;
      fillP(rrPts(w * .14, yy - 7 * k, w * .72, 9.5 * k, 3 * k, 12), gone ? 'rgba(0,0,0,0)' : '#F1EFE8', { amp: .4, seed: 191 + i });
      if (gone) dashed(rrPts(w * .14, yy - 7 * k, w * .72, 9.5 * k, 3 * k, 12), PAL.red, 1.6, [4, 4], { closed: true, amp: .3 });
      text(gone ? '?' : n, w * .2, yy, { size: 7 * k, align: 'left', color: gone ? PAL.red : PAL.ink, alpha: gone ? 1 : 1 });
      if (!gone) check(w * .76, yy - 2.5 * k, .16 * k, PAL.green, 1, 2.4);
    });
    if (state === 'double') strokeP([[w * .9, 58 * k], [w * .94, 63 * k], [w * .94, 74 * k], [w * .9, 79 * k]], PAL.red, 2, {});
    return;
  }
  if (state === 'sent') {
    check(w / 2, 58 * k, .55 * k, PAL.green, o.mark ?? 1, 3);
    text('see you there!', w / 2, 80 * k, { size: 8 * k, color: PAL.green });
    return;
  }
  // form
  if (pc < 3) return;
  const fy = 44 * k * z;
  text('your name', w * .14, fy, { size: 6 * k * z, align: 'left', color: PAL.soft });
  fillP(rrPts(w * .12, fy + 2 * k, w * .76, 10 * k * z, 2.5 * k, 12), '#F1EFE8', { amp: .4, seed: 201 });
  if (pc < 4) return;
  const py = fy + 21 * k * z;
  ['fish', 'veggie'].forEach((m, i) => { fillP(rrPts(w * (.12 + i * .4), py, w * .34, 9 * k * z, 4 * k, 12), i ? PAL.pink : '#F1EFE8', { amp: .4, seed: 202 + i }); text(m, w * (.29 + i * .4), py + 6.8 * k * z, { size: 6 * k * z }); });
  if (pc < 5) return;
  const by = py + 17 * k * z;
  fillP(rrPts(w * .12, by, w * .76, 12 * k * z, 6 * k, 12), PAL.peri, { amp: .4, seed: 205 });
  text('Send RSVP', w / 2, by + 8.6 * k * z, { size: 7.5 * k * z, color: '#fff' });
  if (state === 'error') cross(w / 2, h / 2, .1 * k, PAL.red, 1, 4);
}

// ---------- new props ----------
// Tokyo Tower: splayed lattice legs with an arch, the big main deck, a slimmer upper
// section in international orange and white bands, the small top deck, and the antenna.
function tokyo(x, y, s = 1) {
  const OR = '#E5532E', WH = '#F4F1EA';
  push(x, y, s);
  const body = [[-46, 0], [-34, -40], [-22, -78], [-17, -92], [-12, -150], [-7, -205], [-4, -225], [4, -225], [7, -205], [12, -150], [17, -92], [22, -78], [34, -40], [46, 0], [26, 0], [16, -22], [0, -32], [-16, -22], [-26, 0]];
  fillP(body, OR, { amp: .6, seed: 1001 });
  ctx.save(); ctx.beginPath(); body.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); ctx.clip();
  ctx.fillStyle = WH; for (const [y0, y1] of [[-56, -66], [-118, -128], [-170, -178], [-196, -202]]) ctx.fillRect(-60, y1, 120, y0 - y1);
  ctx.strokeStyle = 'rgba(80,30,20,.35)'; ctx.lineWidth = 1.4;
  for (let yy = 0; yy > -225; yy -= 14) { ctx.beginPath(); ctx.moveTo(-50, yy); ctx.lineTo(50, yy - 14); ctx.moveTo(50, yy); ctx.lineTo(-50, yy - 14); ctx.stroke(); }
  ctx.restore();
  strokeP(body, PAL.ink, 1.8, { closed: true, amp: .5, seed: 1002 });
  // main deck and top deck
  fillP(rrPts(-27, -100, 54, 16, 3, 10), WH, { stroke: PAL.ink, lw: 1.8, amp: .4, seed: 1003 });
  line(-22, -92, 22, -92, PAL.ink, 1.2, { amp: .2 });
  fillP(rrPts(-10, -214, 20, 10, 2, 8), WH, { stroke: PAL.ink, lw: 1.6, amp: .3, seed: 1004 });
  line(0, -225, 0, -262, OR, 3, { amp: .3, seed: 1005 }); line(0, -246, 0, -252, WH, 3, { amp: .1 });
  // crescent moon
  ctx.fillStyle = PAL.yellow; ctx.beginPath(); ctx.arc(80, -200, 20, 0, 7); ctx.fill();
  ctx.fillStyle = PAL.bg; ctx.beginPath(); ctx.arc(90, -206, 18, 0, 7); ctx.fill();
  pop_();
}
// Dust-puff swap (stop-motion style): ph in [0,1].
function puff(x, y, s, ph, seed = 1) {
  if (ph <= 0 || ph >= 1) return;
  const r = rng(seed + Math.floor(ph * 6));
  push(x, y, s * (0.7 + ph * .6), 0, 1 - ph * .6);
  for (let i = 0; i < 7; i++) { const a = r() * 6.28, d = 20 + r() * 40; fillP(ellPts(Math.cos(a) * d, -90 + Math.sin(a) * d * .8, 22 + r() * 16, 18 + r() * 12, 10), '#E2DCCF', { amp: 2, seed: seed + i }); }
  pop_();
}
function armchair(x, y, s = 1) {
  push(x, y, s);
  fillP(rrPts(-120, -170, 240, 190, 50, 20), '#C9A97E', { seed: 1011 });
  fillP(rrPts(-150, -90, 60, 110, 26, 16), '#B8936A', { seed: 1012 });
  fillP(rrPts(90, -90, 60, 110, 26, 16), '#B8936A', { seed: 1013 });
  line(-110, 22, -116, 48, PAL.ink, 4); line(110, 22, 116, 48, PAL.ink, 4);
  pop_();
}
function lamp(x, y, s = 1, on = 1) {
  push(x, y, s);
  line(0, 0, 0, -260, PAL.ink, 3.4, { seed: 1021 });
  fillP(ellPts(0, 0, 40, 9, 12), PAL.ink, { amp: .5 });
  if (on > 0) { ctx.save(); ctx.globalAlpha *= .22 * on; fillP([[-40, -250], [40, -250], [150, 40], [-150, 40]], '#F6E3A0', { amp: 2, seed: 1022 }); ctx.restore(); }
  fillP([[-46, -230], [46, -230], [30, -290], [-30, -290]], PAL.yellow, { stroke: PAL.ink, lw: 2.4, seed: 1023 });
  pop_();
}
function sticky(x, y, w, h, str, o = {}) {
  push(x, y, 1, o.rot ?? -.04, o.alpha ?? 1);
  fillP(rrPts(-w / 2, -h / 2, w, h, 4, 20), '#F7E7A1', { amp: .8, seed: 1031 });
  ctx.save(); ctx.globalAlpha *= .5; fillP(rrPts(-24, -h / 2 - 10, 48, 18, 2, 10), '#E8DCC0', { amp: .4, seed: 1032 }); ctx.restore();
  const lines = str.split('\n');
  lines.forEach((ln, i) => text(ln, -w / 2 + 16, -h / 2 + 40 + i * (o.size ?? 28) * 1.15, { size: o.size ?? 28, align: 'left', write: clamp((o.write ?? 1) * lines.length - i) }));
  pop_();
}

// The Claude mark, redrawn by hand: the real outline, wobbled and filled with crayon.
let CLAUDE_PTS = null;
function claudeMark(x, y, R, rot = 0, seed = 1) {
  if (!CLAUDE_PTS) return;
  push(x, y, R, rot);
  fillP(CLAUDE_PTS, '#D97757', { amp: .011, seed: seed + 7 });
  pop_();
}

// Any provider logo, redrawn by hand: real outline pieces, wobbled, crayon-filled, boiling.
const LOGOS = {};
function hdLogo(name, x, y, R, rot = 0, seed = 1, alpha = 1) {
  const L = LOGOS[name]; if (!L) return;
  push(x, y, R / 12, rot, alpha); ctx.translate(-12, -12);
  ctx.beginPath(); for (const pc of L.pieces) cr(jit(pc, .1, seed + 3), true);
  ctx.fillStyle = tex(L.color, 'fill'); ctx.fill(L.rule);
  pop_();
}

// A speech bubble with no words: wiggling squiggle lines, re-drawn each pose.
function talkBubble(x, y, w, h, tx, ty, prog = 1) {
  bubble(x, y, w, h, tx, ty, { prog });
  if (prog < .8) return;
  const st = Math.floor(TIME * STEP);
  for (let r = 0; r < 2; r++) {
    const p = [], y0 = y - h * .14 + r * h * .3, len = (w - 70) * (r ? .62 : 1);
    for (let i = 0; i <= 26; i++) p.push([x - (w - 70) / 2 + len * i / 26, y0 + Math.sin(i * 1.3 + st * 1.7 + r) * 6]);
    strokeP(p, PAL.soft, 3, { dense: true, seed: st + r, amp: .8 });
  }
}

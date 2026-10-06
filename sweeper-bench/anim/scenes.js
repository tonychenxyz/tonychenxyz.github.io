// Scenes v2: one continuous sheet of paper. The camera travels between areas;
// things are drawn on, walk in, or puff into place rather than scaling up.
let TASKS = [], IMG = {}, GRAIN, K = {}, CAPS = [], WRAPS = [], ORDER;

// ---------- camera ----------
function camAt(keys, t) {
  if (t <= keys[0][0]) return keys[0].slice(1);
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (t < b[0]) {
      const u = E.io(seg(t, a[0], b[0]));
      const s = Math.exp(lerp(Math.log(a[3]), Math.log(b[3]), u));
      const w = Math.abs(a[3] - b[3]) / Math.max(a[3], b[3]) > .08 ? (1 / s - 1 / a[3]) / (1 / b[3] - 1 / a[3]) : u;
      return [lerp(a[1], b[1], w), lerp(a[2], b[2], w), s];
    }
  }
  return keys[keys.length - 1].slice(1);
}
function applyCam([cx, cy, s]) { ctx.translate(W / 2, H / 2); ctx.scale(s, s); ctx.translate(-cx, -cy); }

// ---------- world layout ----------
const GC = 20, GR = 10, CW = 300, CH = 200, GAP = 24, HERO = 4 * GC + 9;
const cardXY = i => [-(GC * CW + (GC - 1) * GAP) / 2 + (i % GC) * (CW + GAP), -(GR * CH + (GR - 1) * GAP) / 2 + Math.floor(i / GC) * (CH + GAP)];
const P1 = [2400, 0];                          // title page, scale 1
const HERO_PG = [1440, 790];                    // hero card top-left on the title page
const HW = [P1[0] + HERO_PG[0], P1[1] + HERO_PG[1]];
const G = [HW[0] - cardXY(HERO)[0], HW[1] - cardXY(HERO)[1]];   // grid origin (world)
const PK = 3.7;                                 // later pages are drawn at this scale
const P2 = [G[0] + 3228 + 900, G[1] - 540 * PK];
const P3 = [P2[0], P2[1] + 1080 * PK + 800];
const P4 = [P3[0] + 1920 * PK + 800, P3[1]];
const P5 = [P4[0] + 1920 * PK + 800, P4[1]];
const view = (P, k, dx = 0, dy = 0, z = 1) => [P[0] + (960 + dx) * k, P[1] + (540 + dy) * k, z / k];
function page(P, k, fn) { push(P[0], P[1], k); fn(); pop_(); }

// ---------- init ----------
function initScenes() {
  K.l03 = LINE('l03').start; K.l04 = LINE('l04').start; K.l05 = LINE('l05').start; K.l06 = LINE('l06').start;
  K.l07 = LINE('l07').start; K.l08 = LINE('l08').start; K.l09 = LINE('l09').start; K.l10 = LINE('l10').start;
  K.l11 = LINE('l11').start; K.l12 = LINE('l12').start; K.end = TL.duration;
  K.flip1 = LINE('l01').start - .7; K.flip0 = K.flip1 - .75;
  K.done = T('l02', 'done.'); K.off = T('l02', 'off');
  K.issues = [0, 1, 2, 3].map(i => T('l04', 'finds') - .2 + i * .33);
  K.frus = T('l04', 'different.') + .2; K.back = T('l04', 'comes'); K.pass = LINE('u02').start; K.waits = T('l04b', 'everyone');
  K.what = T('l05', 'what'); K.say = LINE('u03').start - .3; K.find = LINE('u03').start; K.page = LINE('u03').end;
  K.swap = T('l05b', 'goes'); K.click = T('l05b', 'Clicking,'); K.brk = T('l05b', 'breaking,'); K.fix = T('l05b', 'fixing...');
  K.swapBack = T('l06', 'whatever'); K.works = T('l06', 'works.');
  K.storyEnd = LINE('l06').end + .9;
  K.dive = T('l07', 'with') + 1.75;
  K.zoomOut = T('l08', 'apps.') + .3;
  // captions: clauses split at punctuation, long clauses split evenly
  for (const l of TL.lines) {
    const clauses = [[]];
    l.words.forEach(w => { clauses[clauses.length - 1].push(w); if (/[.,:?!]$/.test(w.w)) clauses.push([]); });
    const merged = [];
    for (const c of clauses.filter(c => c.length)) {
      const last = merged[merged.length - 1];
      if (last && (c.length < 3 || last.length < 3) && last.length + c.length <= 9 && !/[.?!]$/.test(last[last.length - 1].w)) last.push(...c); else merged.push(c);
    }
    for (const c of merged) { const n = Math.ceil(c.length / 8), per = Math.ceil(c.length / n); for (let i = 0; i < c.length; i += per) CAPS.push({ words: c.slice(i, i + per), who: l.who }); }
    CAPS[CAPS.length - 1].lineEnd = true;
  }
  CAPS.forEach((c, i) => {
    c.s = c.words[0].s - .1;
    const nxt = CAPS[i + 1];
    c.e = c.lineEnd || !nxt ? c.words[c.words.length - 1].e + .4 : nxt.words[0].s - .1;
    c.text = c.words.map(w => w.w).join(' ').replace(/Grok four point six/, 'Grok 4.6').replace(/fifty-nine percent/, '59%')
      .replace(/[Tt]wo hundred/g, '200').replace(/fifteen/, '15').replace(/four in ten/, '4 in 10').replace(/Sweeper Bench/, 'SWEeper-Bench').replace(/\.\.\./g, '…');
  });
  WRAPS = TASKS.map(tk => wrap(tk.bug, 19, 268));
  ORDER = TASKS.map((_, i) => i); const hi = TASKS.findIndex(tk => tk.product === 'Sylius'); [ORDER[HERO], ORDER[hi]] = [ORDER[hi], ORDER[HERO]];
  // paper grain (larger than the frame so it can shift between "shots")
  GRAIN = document.createElement('canvas'); GRAIN.width = W + 40; GRAIN.height = H + 40;
  const g = GRAIN.getContext('2d'), id = g.createImageData(GRAIN.width, GRAIN.height), r = rng(7);
  for (let i = 0; i < GRAIN.width * GRAIN.height; i++) { const v = 236 + r() * 19; id.data[i * 4] = v; id.data[i * 4 + 1] = v - 1; id.data[i * 4 + 2] = v - 3; id.data[i * 4 + 3] = 255; }
  g.putImageData(id, 0, 0);
  g.globalAlpha = .06; g.strokeStyle = '#8a7f70';
  for (let i = 0; i < 1100; i++) { const x = r() * GRAIN.width, y = r() * GRAIN.height, a = r() * 6.28, l = 6 + r() * 22; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * .5 + 3, y + Math.sin(a) * l * .5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
}

function camera(t) {
  const hc = [HW[0] + CW / 2 - 55, HW[1] + CH / 2 + 4];
  return camAt([
    [K.flip0, 440, 640, 1.45], [K.flip0 + 3.8, 440, 630, 1.55],
    [K.off - .1, 440, 630, 1.55], [T('l02', 'guest') + .2, 960, 540, 1.0],
    [T('l03', 'Grandma,') - .5, 960, 545, 1.03], [T('l03', 'Grandma,') + .3, 985, 455, 1.9],
    [T('l03', 'cousin') - .3, 1000, 450, 1.95], [T('l03', 'cousin') + .35, 1275, 420, 1.95],
    [T('l03', 'Two') - .2, 1285, 425, 1.95], [T('l03', 'Two') + .4, 1590, 455, 1.9],
    [T('l03', 'Someone') - .25, 1600, 460, 1.92], [T('l03', 'Someone') + .45, 1255, 800, 1.9],
    [K.l04 - .2, 1255, 805, 1.92], [K.l04 + .7, 960, 540, 1.0],
    [K.l05 - .2, 960, 540, 1.02], [K.l05 + .5, 960, 540, 1.0], [K.swapBack, 960, 545, 1.04], [K.storyEnd - .6, 960, 540, 1.0],
    [K.storyEnd + .3, P1[0] + 960, 540, 1.0], [K.dive - .3, P1[0] + 960, 548, 1.04],
    [K.dive + 1.0, hc[0], hc[1], 3.6], [K.zoomOut, hc[0] + 6, hc[1] + 2, 3.66],
    [K.l09 - .4, G[0], G[1] + 60, .27],
    [K.l09 + .5, ...view(P2, PK)], [K.l10 - .3, ...view(P2, PK, 0, 0, 1.04)],
    [K.l10 + .4, ...view(P3, PK)], [K.l11 - .3, ...view(P3, PK, 0, 0, 1.04)],
    [K.l11 + .3, ...view(P4, PK)], [K.l12 - .5, ...view(P4, PK, 0, 0, 1.03)],
    [K.l12 + .3, ...view(P5, PK, 0, 20, 1.12)], [LINE('l12').end, ...view(P5, PK, 0, 30, 1.2)],
    [K.end, ...view(P5, PK, 40, 10, .92)],
  ], t);
}

// Waddle from x0 to x1 over [t0,t1] (stop-motion bob + rock).
function walk(t, t0, t1, x0, x1) {
  const u = E.io(seg(t, t0, t1)), moving = t > t0 && t < t1, st = Math.floor(t * STEP);
  return { x: lerp(x0, x1, u), bob: moving ? -Math.abs(Math.sin(st * Math.PI / 2)) * 8 : 0, rot: moving ? (st % 2 ? .05 : -.05) : 0 };
}

// =====================================================================
// STORY (page 0): ask -> built -> the wild -> waiting -> what if -> works
// =====================================================================
const CROWD = [
  { id: 'gma', x: 985, y: 575, s: 1.05, body: PAL.grey, hair: 'bun', hairColor: '#8F897F', glasses: true, device: 'tablet', feat: 0 },
  { id: 'cousin', x: 1255, y: 575, s: 1.05, body: PAL.orange, hair: 'tuft', hairColor: PAL.teal, device: 'phone', feat: 1 },
  { id: 'f1', x: 1515, y: 575, s: 1.0, body: PAL.pink, hair: 'long', hairColor: PAL.orange, device: 'phone', feat: 2 },
  { id: 'f2', x: 1655, y: 575, s: 1.0, body: PAL.red, hair: 'curly', hairColor: '#7A5A48', device: 'phone', feat: 2 },
  { id: 'train', x: 1240, y: 935, s: 1.0, body: PAL.peri, hair: 'cap', hairColor: PAL.teal, device: 'phone', feat: 3 },
  { id: 'e1', x: 935, y: 935, s: .8, body: PAL.red, hair: 'spiky', hairColor: PAL.ink, device: 'phone' },
  { id: 'e2', x: 1490, y: 935, s: .8, body: PAL.pink, hair: 'bob', hairColor: PAL.periDark, device: 'tablet' },
  { id: 'e3', x: 1645, y: 935, s: .8, body: PAL.orange, hair: 'spiky', hairColor: PAL.brown, device: 'phone' },
  { id: 'e4', x: 1800, y: 935, s: .8, body: '#7DB3A8', hair: 'long', hairColor: PAL.ink, device: 'phone' },
  { id: 'e5', x: 1810, y: 575, s: .85, body: PAL.peri, hair: 'curly', hairColor: PAL.pinkLine, device: 'phone' },
];
const ISSUES = [
  { who: 'gma', text: "where's the Send button?", bx: 925, by: 252 },
  { who: 'cousin', text: "wait, it's on FRIDAY?", bx: 1235, by: 172 },
  { who: 'f2', text: 'my RSVP vanished!', bx: 1700, by: 252 },
  { who: 'train', text: "I'm coming… twice?", bx: 1460, by: 690 },
];
const devPos = p => [p.x, p.y - (70 + (DEV[p.device].oy ?? 0)) * p.s];
const YOU = [290, 830, 1.25], CL = [590, 830, 1.25], APP = [440, 470];
const youHead = [YOU[0], YOU[1] - 205 * YOU[2]];

function story(t) {
  if (t > K.storyEnd + 1.2) return;
  const arrive = i => K.off + .55 + i * .13;           // when guest i is in place
  const swapT = i => K.swap + .05 + i * .08, backT = i => K.swapBack + i * .07;

  // --- you + Claude
  const U1 = LINE('u01'), U2 = LINE('u02'), U3 = LINE('u03'), speaking = [U1, U2, U3].some(u => t > u.start - .05 && t < u.end + .05);
  const youMood = speaking ? 'talk' : t > K.works - .3 ? 'delight' : t > K.back + .6 && t < K.what ? 'worried' : 'neutral';
  rug(YOU[0], YOU[1] + 6, 100 * YOU[2], 22 * YOU[2]); rug(CL[0], CL[1] + 6, 100 * CL[2], 22 * CL[2]);
  const typing = t > U1.start - .3 && t < U1.end + .2;
  // while she asks, she holds her phone: a little chat with Claude
  const chat = (w, h) => {
    ctx.fillStyle = '#FFFDF8'; ctx.fillRect(0, 0, w, h);
    claudeMark(w / 2, h * .16, w * .13, 0, 33);
    fillP(rrPts(w * .1, h * .32, w * .6, h * .09, h * .04, 8), '#EEEAE2', { amp: .3, seed: 34 });
    fillP(rrPts(w * .3, h * .47, w * .6, h * .12, h * .05, 8), PAL.pink, { amp: .3, seed: 35 });
    const k = Math.floor(t * 4) % 3;
    for (let d = 0; d < 3; d++) { ctx.fillStyle = d === k ? PAL.ink : PAL.faint; ctx.beginPath(); ctx.arc(w * (.38 + d * .12), h * .78, w * .045, 0, 7); ctx.fill(); }
  };
  const tp = typing ? (t * 2.6) % 1 : 0, tk = Math.floor(t * 2.6);
  person(YOU[0], YOU[1], YOU[2], { body: PAL.peri, hair: 'bob', hairColor: PAL.pinkLine, dots: PAL.periDark, mood: youMood, look: t < K.off ? .7 : .4, lookY: typing ? .6 : 0, seed: 5,
    device: typing ? 'phone' : null, screen: chat, tap: typing ? [.3 + .4 * (n1(tk, 5) * .5 + .5), .8, tp] : null });
  const st = Math.floor(t * STEP), perk = t > K.what && t < K.what + 1.4;
  const bStart = U1.end + .05, building = t > bStart && t < K.done, looping = false;
  claude(CL[0], CL[1] + (looping ? (st % 2 ? -6 : 0) : 0), CL[2], {
    mood: building || looping ? 'focus' : t > K.done && t < K.l03 ? 'proud' : t > K.works - .3 ? 'proud' : perk ? 'surprised' : t > K.pass + .6 && t < K.what ? 'worried' : 'neutral',
    look: -.7, lookY: looping ? -.8 : 0, work: building, tool: looping, rot: building || looping ? (st % 2 ? .03 : -.03) : perk ? Math.sin(st) * .04 : 0 });

  // --- the request
  const rq = clamp(1 - seg(t, K.done - .5, K.done - .1));
  if (t > U1.start - .5 && rq > 0) {
    push(0, 0, 1, 0, rq); wishBubble(t, U1.start - .5, 'app'); pop_();
  }
  // --- the app is drawn into being, then planes carry it to every guest
  const appA = 1 - seg(t, K.l03 - .2, K.l03 + .3);
  if (t > bStart && appA > 0) {
    const d = DEV.phone, pr = seg(t, bStart, bStart + .4), pieceT = k => bStart + .5 + k * (K.done - bStart - .5) / 5;
    const n = [0, 1, 2, 3, 4].filter(k => t > pieceT(k)).length;
    push(APP[0], APP[1], 2.3, 0, appA);
    strokeP(rrPts(-d.w / 2, -d.h / 2, d.w, d.h, d.r, 10), PAL.ink, 2.4, { closed: true, prog: pr, seed: 21, amp: .6 });
    if (pr >= 1) device('phone', 0, 0, (w, h) => rsvp(w, h, 'ok', { pieces: n }));
    pop_();
    for (let k = 0; k < 5; k++) if (t > pieceT(k) && t < pieceT(k) + .35) sparkles(APP[0], APP[1] - 60 + k * 30, 70, t - pieceT(k), 5, PAL.orange);
    if (t > K.done && t < K.done + 1.2) sparkles(APP[0], APP[1], 170, t - K.done, 8, PAL.orange);
  }
  // divider: us | the world
  strokeP([[800, 110], [804, 400], [798, 700], [802, 990]], PAL.faint, 3.2, { prog: seg(t, K.off, K.off + .7), seed: 301, amp: 1.5 });

  // --- planes deliver the app to each guest
  CROWD.forEach((p, i) => {
    const ta = arrive(i), launch = ta - .75;
    if (t > launch && t < ta) {
      const u = E.io(seg(t, launch, ta)), [dx, dy] = devPos(p);
      plane(lerp(APP[0], dx, u), lerp(APP[1], dy, u) - Math.sin(u * Math.PI) * 160, .9, -.2 + u * .4);
    }
  });
  // train window + weak wifi
  const tr = CROWD[4];
  if (t > arrive(4) - 1.2) {
    push(tr.x, tr.y - 150, 1, 0, seg(t, arrive(4) - 1.2, arrive(4) - .7));
    fillP(rrPts(-125, -140, 250, 225, 22, 18), '#DCE8EA', { stroke: PAL.ink, lw: 2.6, seed: 311 });
    for (let k = 0; k < 4; k++) { const xx = ((k * 90 - t * 260) % 360 + 360) % 360 - 180; if (xx > -110 && xx < 110) { fillP(ellPts(xx, 30, 16, 26, 10), '#9CC3A8', { seed: 312 + k, amp: .8 }); line(xx, 52, xx, 78, PAL.brown, 3); } }
    line(-125, 80, 125, 80, PAL.ink, 2.4);
    pop_();
    wifi(tr.x + 92, tr.y - 258, .8, (Math.floor(t * 2) % 3 === 0) ? 1 : 0, PAL.red);
  }
  // scenario doodles, drawn on when each guest is introduced
  const propsA = 1 - seg(t, K.what, K.what + .5);
  const tTok = T('l03', 'Tokyo.');
  if (t > tTok - .3 && propsA > 0) { push(0, 0, 1, 0, propsA * seg(t, tTok - .3, tTok + .1)); tokyo(1400, 440, .8); pop_(); }
  const tTurn = T('l03', 'turned');
  if (t > tTurn && propsA > 0) { push(865, 330, 1, 0, propsA); text('A', 0, 0, { font: 'marker', size: 36, color: PAL.soft, write: seg(t, tTurn, tTurn + .2) }); text('A', 40, 0, { font: 'marker', size: 70, write: seg(t, T('l03', 'way'), T('l03', 'up.')) }); arrow([[-12, 14], [56, 14]], PAL.soft, 2.4, seg(t, tTurn, T('l03', 'up.')), 8); pop_(); }

  CROWD.forEach((p, i) => {
    const ta = arrive(i);
    if (t < ta - 1.5) return;
    const wk = walk(t, ta - 1.5, ta - .1, p.x + 1150, p.x);
    const tapping = t > ta && t < K.frus;
    const rate = .9 + (i % 3) * .17, ph = (t - ta) * rate + i * .37, k = Math.floor(ph);
    let tap = tapping ? [.25 + .5 * (n1(k, i) * .5 + .5), .45 + .4 * (n1(k + 7, i) * .5 + .5), ph - k] : null;
    const send = T('l03', 'send');
    if ((p.id === 'f1' || p.id === 'f2') && t > send - .1 && t < send + .7) tap = [.5, .8, seg(t, send, send + .6)];
    const tw = T('l03', 'twice.'), tp = T('l03', 'tapping');
    if (p.id === 'train' && t > tp - .1 && t < tw + .7) tap = t < tw ? [.5, .8, seg(t, tp - .1, tw - .1)] : [.5, .8, seg(t, tw, tw + .6)];
    let st = 'ok';
    const iss = ISSUES.findIndex(q => q.who === p.id);
    if (p.id === 'gma' && t > tTurn) st = 'big';
    if (iss >= 0 && t > K.issues[iss]) st = ['big', 'tz', 'vanish', 'double'][iss];
    if (p.feat === undefined && t > K.issues[0] + i * .1 && t < K.what) st = 'error';
    const bk = backT(i);
    if (t > bk + .25) st = 'sent';
    const zoom = p.id === 'gma' ? lerp(1, 2, E.io(seg(t, tTurn, T('l03', 'up.') + .2))) : 2;
    const hit = (iss >= 0 && t > K.issues[iss]) || (p.feat === undefined && t > K.issues[0] + i * .1);
    const stp = Math.floor(t * STEP);
    const tHit = (iss >= 0 ? K.issues[iss] : K.issues[0] + i * .1), happy = t > bk;
    const angry = hit && !happy && t > tHit + .3 && t < K.waits, waiting = !happy && t >= K.waits;
    const mood = happy ? 'delight' : angry ? 'angry' : waiting ? 'sad' : hit ? 'surprised' : 'neutral';
    const shake = angry ? n1(stp, i) * 5 : 0, sw = swapT(i), asClaude = t > sw + .2 && t < bk + .2;
    if (!asClaude) {
      person(wk.x + shake, p.y, p.s, { ...p, mood, look: p.x > 1500 ? -.4 : .3, lookY: angry ? 0 : .6, seed: 40 + i, rot: wk.rot,
        bob: wk.bob || (tapping ? -Math.abs(Math.sin(stp + i)) * 2 : angry ? -Math.abs(n1(stp + 3, i)) * 6 : waiting && t < K.what ? 6 : 0),
        device: t > ta - .05 ? p.device : null, arms: t > ta - .05 ? undefined : 'down',
        screen: (w, h) => rsvp(w, h, st, { zoom, mark: seg(t, tHit, tHit + .4) }), tap: angry ? null : tap });
    } else {                                           // a Claude in their place: click, break, fix, again
      const tq = testerPhase(t, i), kk = Math.floor(tq), f = tq - kk, hasBug = n1(kk, i * 3) > .1;
      claude(p.x, p.y, p.s * .85, {
        device: p.device, seed: 60 + i, look: -.3, lookY: .7,
        screen: (w, h) => { rsvp(w, h, 'ok'); if (hasBug && f > .25 && f < .7) bug(w / 2, h * .45, w / 60); if (hasBug && f >= .7) check(w / 2, h * .45, w / 90, PAL.green, seg(f, .7, .85)); },
        tap: [.3 + .4 * (n1(kk, i) * .5 + .5), .4 + .4 * (n1(kk + 3, i) * .5 + .5), Math.min(f * 3, 1)],
      });
    }
    puff(p.x, p.y, p.s, seg(t, sw, sw + .5), 70 + i);
    puff(p.x, p.y, p.s, seg(t, bk, bk + .5), 90 + i);
    if (hit && !happy && t < K.what) {                 // the bug itself crawls out of the screen
      const [dx, dy] = devPos(p), ang = -2.4 + (i * 1.7) % 4.8, u = E.out(seg(t, tHit, tHit + 1.1));
      bug(dx + Math.cos(ang) * 110 * u, dy + Math.sin(ang) * 60 * u - 10, .8 * p.s, ang + Math.PI / 2, { walk: true, alpha: 1 - seg(t, K.what - .4, K.what) });
    }
    if (angry) {                                       // fuming: scribble cloud + puffs of steam
      scribble(p.x, p.y - 232 * p.s, p.s, PAL.red, 900 + i, seg(t, tHit + .3, tHit + .7));
      for (let k = 0; k < 2; k++) { const u = ((t * 1.6 + k * .5 + i * .23) % 1); fillP(ellPts(p.x + (k ? 26 : -26) * p.s + u * (k ? 14 : -14), p.y - 215 * p.s - u * 50, 11 + u * 8, 9 + u * 6, 8), 'rgba(170,165,155,.7)', { amp: 1.2, seed: 950 + i + k }); }
    }
    // hearts drift up when it finally works
    const th = bk + .15;
    if (t > th) { const u = seg(t, th, th + 1.8); heart(p.x + Math.sin(u * 6 + i) * 8, p.y - 240 * p.s - u * 90, .9 * clamp(u * 5), PAL.red, 1 - seg(u, .7, 1)); }
  });

  // --- it all comes back to you, then to Claude
  [0, 1, 2, 3, 5, 6].forEach((ci, k) => {
    const p = CROWD[ci], t0 = K.back - .3 + k * .1, u = seg(t, t0, t0 + .8);
    if (u <= 0 || u >= 1) return;
    const e = E.io(u), [dx, dy] = devPos(p);
    plane(lerp(dx, youHead[0] + 30, e), lerp(dy, youHead[1] - 30, e) - Math.sin(e * Math.PI) * 140, .9, Math.PI + .2 - e * .4);
  });
  const pA = 1 - seg(t, U2.end + .3, U2.end + .7);
  if (t > U2.start - .3 && pA > 0) {
    push(0, 0, 1, 0, pA); wishBubble(t, U2.start - .3, 'bug'); pop_();
  }
  // --- waiting: a clock, a snail
  const wA = Math.min(seg(t, K.waits - .4, K.waits), 1 - seg(t, K.what, K.what + .5));
  if (wA > 0) {
    push(800, 210, 1, 0, wA);
    strokeP(ellPts(0, 0, 62, 62, 24), PAL.ink, 3, { closed: true, prog: seg(t, K.waits - .4, K.waits), seed: 131 });
    if (t > K.waits) clock(0, 0, 62, (t - K.waits) * 7 + 1);
    pop_();
    push(0, 0, 1, 0, wA); snail(110 + (t - K.waits + .4) * 30, 1000, .75); pop_();
  }
  // --- what if: the request
  const rA = 1 - seg(t, K.click - .2, K.click + .3);
  if (t > K.say - .2 && rA > 0) {
    push(0, 0, 1, 0, rA);
    const s2 = 'find and fix issues in the RSVP page', bw = measure(s2, 26) + 80;
    bubble(Math.max(bw / 2 + 20, 440), 470, bw, 100, 330, 560, { prog: seg(t, K.say - .2, K.say + .25) });
    text(s2, Math.max(bw / 2 + 20, 440), 481, { size: 26, write: seg(t, K.find - .05, K.page) });
    pop_();
  }
  // --- the test loop
  const lA = Math.min(seg(t, K.click - .6, K.click - .3), 1 - seg(t, K.swapBack, K.swapBack + .5));
  if (lA > 0) racetrack(t, lA);
}

// Her wordless speech bubble: squiggles plus a little picture of what she means.
function wishBubble(t, t0, icon) {
  const st = Math.floor(t * STEP), bp = seg(t, t0, t0 + .4);
  bubble(215, 455, 250, 150, 290, 560, { prog: bp });
  if (bp < 1) return;
  const p = []; for (let i = 0; i <= 14; i++) p.push([125 + i * 6, 430 + Math.sin(i * 1.3 + st * 1.7) * 5]);
  strokeP(p, PAL.soft, 3, { dense: true, seed: st, amp: .8 });
  const p2 = []; for (let i = 0; i <= 10; i++) p2.push([125 + i * 6, 462 + Math.sin(i * 1.3 + st * 1.7 + 1) * 5]);
  strokeP(p2, PAL.soft, 3, { dense: true, seed: st + 1, amp: .8 });
  fillP(rrPts(232, 400, 62, 108, 10, 12), PAL.paper, { stroke: PAL.ink, lw: 2.4, seed: 2101 });
  if (icon === 'app') { heart(263, 440, .9, PAL.red); fillP(rrPts(244, 470, 38, 12, 5, 8), PAL.peri, { amp: .3, seed: 2102 }); }
  else bug(263, 452, .95, Math.sin(st) * .4, { walk: true });
}
function testerPhase(t, i) {
  const t0 = K.click, r0 = .9, k = .45, off = i * .29;
  if (t < t0) return (t - K.swap) * r0 + off;
  return (t0 - K.swap) * r0 + r0 / k * (Math.exp(k * (t - t0)) - 1) + off;
}
function loopTheta(t) { const t0 = K.click, w0 = Math.PI * 2 / 2.2, k = .5; return t < t0 ? 0 : w0 / k * (Math.exp(k * (t - t0)) - 1); }
function racetrack(t, a) {
  const cx = 1000, cy = 235, rx = 600, ry = 90;
  push(0, 0, 1, 0, a);
  const pts = ellPts(cx, cy, rx, ry, 48, Math.PI, Math.PI * 3);
  dashed([...pts, pts[0]], PAL.soft, 3, [14, 12], { prog: seg(t, K.click - .6, K.click + .2) });
  [[K.click, cx, cy - ry, 'click'], [K.brk, cx + rx, cy, 'break'], [K.fix, cx - rx, cy, 'fix']].forEach(([ts, x, y, lab], i) => {
    if (t < ts - .2) return;
    push(x, y);
    const pr = seg(t, ts - .2, ts + .15);
    ctx.save(); ctx.globalAlpha *= seg(pr, .5, 1); fillP(ellPts(0, 0, 44, 44, 16), PAL.paper, { seed: 400 + i }); ctx.restore();
    strokeP(ellPts(0, 0, 44, 44, 16), PAL.ink, 2.6, { closed: true, prog: pr, seed: 400 + i });
    if (pr > .6) { if (lab === 'click') cursor(-8, -16, .9); else if (lab === 'break') bug(-4, 2, .8); else wrench(0, 10, .62, .6); }
    text(lab, 0, lab === 'click' ? -60 : 84, { size: 32, color: PAL.periDark, write: seg(t, ts, ts + .35) });
    pop_();
  });
  const th = loopTheta(t);
  if (t > K.click) {
    for (let k = 7; k >= 0; k--) {
      const tt = th - k * .045 * (1 + th * .03), x = cx - Math.cos(tt) * rx, y = cy - Math.sin(tt) * ry;
      ctx.save(); ctx.globalAlpha *= (1 - k / 8) * .9; ctx.fillStyle = PAL.orange; ctx.beginPath(); ctx.arc(x, y, 13 - k * 1.1, 0, 7); ctx.fill(); ctx.restore();
    }
    text('round ' + (Math.floor(th / (Math.PI * 2)) + 1), cx, cy + 18, { font: 'marker', size: 54 });
  }
  pop_();
}

// =====================================================================
// TITLE (page 1, scale 1): the name is written; a broom; bugs run into a card
// =====================================================================
function logo(cx, base, s, o = {}) {
  const size = 250, wS = measure('SWE', size, 'marker'), wE = measure('eper', size * 1.05, 'script'), wB = measure('-Bench', size, 'marker');
  const tot = wS + wE + wB + 10, x0 = -tot / 2;
  push(cx, base, s, 0, o.alpha ?? 1);
  text('SWE', x0, 0, { font: 'marker', size, align: 'left', write: o.swe ?? 1, jitter: .6 });
  text('eper', x0 + wS + 2, 6, { font: 'script', size: size * 1.05, align: 'left', color: PAL.peri, write: o.eper ?? 1, jitter: .6 });
  text('-Bench', x0 + wS + wE + 10, 0, { font: 'marker', size, align: 'left', write: o.bench ?? 1, jitter: .6 });
  pop_();
  return { x0, wS, wE, wB };
}
function title(t) {
  if (t < K.storyEnd - 1 || t > K.zoomOut + .5) return;
  page(P1, 1, () => {
    const tSw = T('l07', 'Sweeper'), tB = T('l07', 'Bench.'), tSE = T('l07', 'Software'), tW = T('l07', 'with'), tBr = T('l07', 'broom.');
    // blog: the name and its labels are page text above this drawing; only the sweep is drawn here
    const [hx, hy] = HERO_PG;
    // blog: the page's hero holds on the title, so no dive into the Sylius card
    // Claude walks in, then sweeps right-to-left across the page
    const sw0 = tW - .1, sw1 = tW + 1.9;
    const walkIn = walk(t, tSE - .4, sw0, 2150, 1300);
    const sweepX = lerp(1300, 660, E.io(seg(t, sw0, sw1)));   // blog: ends nearer the middle of the hero
    const cx = t < sw0 ? walkIn.x : sweepX, sweeping = t > sw0 && t < sw1;
    const st = Math.floor(t * STEP), swing = sweeping ? (st % 2 ? .45 : -.35) : 0;
    const bx = cx - 95 - (sweeping ? (st % 2 ? 30 : -10) : 0);           // bristles position
    // dust kicked up behind the broom
    if (sweeping) for (let k = 0; k < 6; k++) { const r = rng(st * 7 + k); fillP(ellPts(bx - 30 - r() * 120, 900 - r() * 70, 14 + r() * 22, 10 + r() * 14, 10), 'rgba(196,186,168,.55)', { amp: 2, seed: st + k }); }
    // a little crowd of bugs under the name; the broom flings them away, one sneaks into the card
    const bugs = [[700, 915], [760, 895], [840, 930], [910, 900], [980, 928], [1040, 898], [1110, 920]];   // blog: a few more to sweep
    bugs.forEach(([x0, y0], k) => {
      if (t < tSw) return;
      const sneak = false;
      const hitT = sneak ? sw0 + .2 : sw0 + (1300 - x0) / 640 * (sw1 - sw0) - .05;
      if (t < hitT) { bug(x0, y0, 1.1, Math.sin(st + k) * .3, { walk: true }); return; }
      const u = seg(t, hitT, hitT + (sneak ? 1.6 : .8));
      if (u >= 1) return;
      if (sneak) { const e = E.io(u); bug(lerp(x0, hx + 150, e), lerp(y0, hy + 110, e) - Math.sin(u * Math.PI) * 60, 1.1 * (1 - e * .3), .9, { walk: true }); return; }
      const e = E.out(u); // tumbling away to the left, off the page
      bug(lerp(x0, x0 - 1100 - k * 90, e), y0 - Math.sin(u * Math.PI) * (170 + k * 25), 1.15, u * 14 + k, { alpha: 1 - seg(u, .75, 1) });
    });
    if (t > tSE - .4) {
      // blog: a happier Claude, beaming once the sweep is done
      claude(cx, 880 + (t < sw0 ? walkIn.bob : sweeping ? (st % 2 ? -6 : 0) : 0), .95, { mood: t > sw1 ? 'proud' : 'delight', look: -1, rot: t < sw0 ? walkIn.rot : sweeping ? (st % 2 ? -.06 : .04) : 0, tool: true, seed: 501 });
      broom(cx - 84, 905, .66, -.75 + swing);
    }
  });
}

// =====================================================================
// GRID (world): the Sylius card first, then all 200 drawn around it
// =====================================================================
const DOMC = {
  'Content & knowledge': '#EEB4CB', 'IT, security & developer tools': '#BDBFEF', 'Collaboration & communication': '#F3C58C',
  'Files, media & sharing': '#A9D2C6', 'Finance & business operations': '#E6D58F', 'Personal productivity & lifestyle': '#D9C3A5', 'Commerce & payments': '#F2A79C',
};
function card(i, t, tk, wl, a, pos) {
  const [x, y] = pos ?? cardXY(i);
  if (a < .45) { strokeP(rrPts(x, y, CW, CH, 16, 40), PAL.ink, 2.4, { closed: true, prog: seg(a, 0, .45), seed: i, amp: 1 }); return; }
  ctx.save(); ctx.globalAlpha *= seg(a, .45, 1);
  fillP(rrPts(x, y, CW, CH, 16, 40), PAL.paper, { stroke: PAL.ink, lw: 2.4, amp: 1, seed: i });
  fillP(rrPts(x + 6, y + 6, CW - 12, 30, 10, 40), DOMC[tk.domain] ?? PAL.tan, { amp: .5, seed: i + 3 });
  ptext(tk.product, x + 18, y + 29, 24);
  ctx.fillStyle = '#E2DED4'; for (let k = 0; k < 3; k++) ctx.fillRect(x + 20, y + 54 + k * 16, 160 - (k * 37 + i * 13) % 90, 7);
  ctx.fillStyle = '#EFEBE3'; ctx.fillRect(x + 20, y + 108, 170, 22);
  fillP(rrPts(x + 200, y + 106, 80, 26, 10, 20), PAL.peri, { amp: .3, seed: i + 5 });
  ctx.fillStyle = '#D6D1C6'; ctx.fillRect(x + 20, y + 150, 120, 26); ctx.fillRect(x + 150, y + 150, 120, 26);
  // once the camera has pulled back, every card settles on its failure
  const settle = seg(TIME, K.zoomOut + .4 + (i % 7) * .06, K.zoomOut + .9 + (i % 7) * .06);
  const P = 3.0 + (i * 37 % 17) / 10, ph = settle > 0 ? .8 : ((t + i * .53) % P) / P;
  const pts = [[x + 100, y + 119], [x + 238, y + 119], [x + 210, y + 163]], sq = [[.1, .22], [.3, .42], [.5, .6]];
  let cx = x + 260, cy = y + 60;
  for (let k = 0; k < 3; k++) { const [a0, b0] = sq[k]; if (ph > a0) { const prev = k ? pts[k - 1] : [x + 260, y + 60]; const u = E.io(seg(ph, a0, b0 - .04)); cx = lerp(prev[0], pts[k][0], u); cy = lerp(prev[1], pts[k][1], u); } if (ph > b0 - .04 && ph < b0 + .12) ripple(pts[k][0], pts[k][1], seg(ph, b0 - .04, b0 + .12), 18); }
  if (ph > .64) {
    ctx.save(); ctx.globalAlpha *= seg(ph, .64, .7);
    fillP(rrPts(x + 8, y + 44, CW - 16, CH - 52, 10, 40), '#FBEDEA', { amp: .5, seed: i + 9 });
    strokeP(rrPts(x, y, CW, CH, 16, 40), PAL.red, 4, { closed: true, seed: i + 11, amp: 1 });
    wl.slice(0, 4).forEach((ln, k) => ptext(ln, x + 22, y + 72 + k * 24, 19, PAL.red));
    ctx.restore();
    if (settle > 0) { const st = Math.floor(TIME * STEP); bug(x + CW / 2 + n1(st, i) * 6, y + CH / 2 + 18, 3.4 * E.back(settle), Math.sin(st * 1.3 + i) * .35, { walk: true }); }
    else cross(x + 270, y + 170, .8, PAL.red, seg(ph, .66, .74), 5);
  } else cursor(cx, cy, .9);
  ctx.restore();
}
function heroCard(t) { noCaps(() => heroCard_(t)); }
function heroCard_(t) {
  const [x, y] = cardXY(HERO), t0 = T('l08', 'Two'), tD = K.dive + .1;
  const a = seg(t, tD, tD + .6);
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a;
  fillP(rrPts(x, y, CW, CH, 16, 40), PAL.paper, { stroke: PAL.ink, lw: 2.4, amp: .5, seed: 1 });
  fillP(rrPts(x + 6, y + 6, CW - 12, 30, 10, 40), DOMC['Commerce & payments'], { amp: .3, seed: 2 });
  text('Sylius · an online shop', x + 18, y + 29, { size: 22, align: 'left', jitter: .4 });
  text('Cart · 2 items · $48', x + 20, y + 66, { size: 21, align: 'left', jitter: .4 });
  const c1 = t0 + 1.3, c2 = t0 + 2.0, c3 = t0 + 2.7;
  ctx.fillStyle = '#EFEBE3'; ctx.fillRect(x + 20, y + 80, 150, 26); text('SAVE10', x + 30, y + 99, { size: 20, align: 'left', jitter: .4 });
  fillP(rrPts(x + 180, y + 80, 100, 26, 10, 20), PAL.peri, { amp: .3, seed: 3 }); text('Apply', x + 230, y + 99, { size: 20, color: '#fff', jitter: .4 });
  if (t > c1 + .15 && t < c3) { text('coupon applied', x + 20, y + 132, { size: 20, align: 'left', color: PAL.green, jitter: .4 }); check(x + 160, y + 126, .4, PAL.green, seg(t, c1 + .15, c1 + .4), 4); }
  fillP(rrPts(x + 160, y + 152, 120, 30, 12, 20), PAL.orange, { amp: .3, seed: 4 }); text('Checkout', x + 220, y + 173, { size: 20, color: '#fff', jitter: .4 });
  [[x + 230, y + 93, c1], [x + 220, y + 167, c2]].forEach(([sx, sy, tc], k) => { if (t > tc - .05 && t < tc + .5) ripple(sx, sy, seg(t, tc - .05, tc + .4), 18); if (t > tc) { fillP(ellPts(sx + 32, sy - 22, 11, 11, 10), PAL.ink, { amp: .3 }); ptext(String(k + 1), sx + 32, sy - 16, 17, '#fff', 'center'); } });
  let cx = x + 270, cy = y + 50;
  if (t > t0 + .2) { const u1 = E.io(seg(t, t0 + .2, c1 - .05)), u2 = E.io(seg(t, c1 + .3, c2 - .05)); cx = lerp(lerp(x + 270, x + 230, u1), x + 220, u2); cy = lerp(lerp(y + 50, y + 93, u1), y + 167, u2); }
  if (t > c3) {
    ctx.save(); ctx.globalAlpha *= seg(t, c3, c3 + .15);
    fillP(rrPts(x + 8, y + 114, CW - 16, 32, 8, 30), '#FBEDEA', { amp: .3, seed: 5 });
    text('This coupon is not valid.', x + 20, y + 137, { size: 21, align: 'left', color: PAL.red, jitter: .4 });
    strokeP(rrPts(x, y, CW, CH, 16, 40), PAL.red, 3, { closed: true, seed: 6, amp: .6 });
    ctx.restore();
  }
  const hs = seg(TIME, K.zoomOut + .4, K.zoomOut + .9);
  if (hs > 0) { const st = Math.floor(TIME * STEP); bug(x + CW / 2, y + CH / 2 + 18, 3.4 * E.back(hs), Math.sin(st * 1.3) * .35, { walk: true }); }
  else if (t > t0 - .6) cursor(cx, cy, .7);
  // the one-sentence request, on a sticky note
  ctx.restore();
  if (t > t0 - .8) { NOCAPS = false; sticky(x - 95, y + 52, 160, 84, 'find and fix\nissues in\nSylius coupons', { size: 14, write: seg(t, t0 - .8, t0 + .5), rot: -.07 }); NOCAPS = true; }
}
function grid(t) {
  if (t < T('l07', 'Software') || t > K.l10) return;
  push(G[0], G[1]);
  const v = camera(RAW), vw = W / 2 / v[2] + CW, vh = H / 2 / v[2] + CH;
  const [hx, hy] = cardXY(HERO);
  ORDER.forEach((ti, i) => {
    if (i === HERO) return;
    const [x, y] = cardXY(i);
    if (Math.abs(x + CW / 2 - (v[0] - G[0])) > vw || Math.abs(y + CH / 2 - (v[1] - G[1])) > vh) return;
    const d = Math.hypot((x - hx) / (CW + GAP), (y - hy) / (CH + GAP));
    const ta = K.zoomOut - .5 + d * .2, a = seg(t, ta, ta + .5);
    if (a > 0) card(i, t - K.l08 + 1.5, TASKS[ti], WRAPS[ti], a);
  });
  heroCard(t);
  pop_();
  const nA = seg(t, K.l09 - 1.6, K.l09 - .8);
  if (nA > 0 && t < K.l09 + 1) text('200 real bugs  ·  200 open-source web apps', G[0], G[1] - 1108 - 120, { size: 150, write: nA, color: '#55504A' });
}

// =====================================================================
// RESULTS (page 2)
// =====================================================================
const LOGO_OF = nm => /^Grok/.test(nm) ? 'grok' : /^Qwen/.test(nm) ? 'qwen' : /^Claude/.test(nm) ? 'claude' : /^GPT/.test(nm) ? 'openai' : /^DeepSeek/.test(nm) ? 'deepseek' : /^Kimi/.test(nm) ? 'kimi' : /^Muse/.test(nm) ? 'meta' : 'zai';
const BOARD = [['Grok 4.6', 59.0], ['Qwen 3.8 Flash', 57.5], ['Claude Fable 5.1', 56.5], ['Claude Opus 5', 56.5], ['GPT-6 Astra', 56.5], ['DeepSeek V4.1 Flash', 51.5], ['Kimi K3', 48.5], ['DeepSeek V4 Pro', 47.0], ['GPT-5.6 Sol', 47.0], ['Muse Spark 1.3', 47.0], ['GLM 5.3', 43.5], ['GPT-5.6 Luna', 42.0], ['GLM 5.3 Flash', 39.5], ['GPT-5.6 Terra', 35.0], ['Qwen 3.8 Max', 28.0]];
function results(t) {
  if (t < K.l09 - 1.2 || t > K.l10 + 1) return;
  page(P2, PK, () => {
    const x0 = 660, sc = 10, y0 = 150, dy = 52, tG = T('l09', 'Grok'), tF = T('l09', 'fifty-nine'), tA = T('l09', 'agents.') - .3;
    text('share of the 200 bugs each agent fixed', 960, 82, { size: 34, color: PAL.soft, write: seg(t, K.l09 - .6, K.l09 + .4) });
    BOARD.forEach(([nm, v], i) => {
      const y = y0 + i * dy, t0 = tA + (14 - i) * .07, g = E.out(seg(t, t0, t0 + .6));
      text(nm, x0 - 24, y + 11, { size: 28, align: 'right', color: i === 0 && t > tG ? PAL.ink : '#55504A', write: seg(t, t0 - .2, t0 + .3) });
      const lw = measure(nm, 28); if (t > t0 - .25) hdLogo(LOGO_OF(nm), x0 - 24 - lw - 26, y + 1, 15, 0, 620 + i, seg(t, t0 - .25, t0));
      if (g <= 0) return;
      const w = v * sc * g;
      fillP(rrPts(x0, y - 16, Math.max(w, 20), 32, 10, 30), '#CFC8BA', { amp: .8, seed: 600 + i });
      if (i === 0 && t > tG) { ctx.save(); ctx.beginPath(); ctx.rect(x0 - 5, y - 30, (w + 10) * seg(t, tG, tG + .4), 60); ctx.clip(); fillP(rrPts(x0, y - 16, w, 32, 10, 30), PAL.orange, { amp: .8, seed: 600 }); ctx.restore(); }
      text(v.toFixed(1), x0 + w + 16, y + 11, { size: 32, align: 'left', color: i === 0 ? PAL.ink : PAL.soft, alpha: seg(g, .8, 1) });
    });
    if (t > tG) {
      push(x0 - 24 - measure('Grok 4.6', 28) - 70, y0 - 2, 1, -.2);
      strokeP([[-18, 10], [-20, -12], [-9, -2], [0, -18], [9, -2], [20, -12], [18, 10], [-18, 10]], PAL.orange, 3.4, { prog: seg(t, tG, tG + .4), seed: 640 });
      pop_();
    }
    const gp = seg(t, tF - .1, tF + .5);
    if (gp > 0) {
      circleMark(x0 + 632, y0 + 2, 50, 26, PAL.ink, gp, 3);
      dashed([[x0 + 1000, y0 - 30], [x0 + 1000, y0 + 14 * dy + 24]], PAL.soft, 3, [10, 10], { prog: seg(t, tF + .2, tF + .9) });
      text('100%', x0 + 1000, y0 + 14 * dy + 66, { size: 34, color: PAL.soft, write: seg(t, tF + .7, tF + 1) });
      // the gap to 100%, hatched in red crayon
      const gU = seg(t, tF + .5, tF + 1.1);
      for (let k = 0; k < 18 * gU; k++) line(x0 + 600 + k * 22, y0 + 14, x0 + 616 + k * 22, y0 - 14, PAL.red, 3, { seed: 660 + k });
    }
  });
}

// =====================================================================
// NOTICING (page 3): the agent walks right past the bug
// =====================================================================
const STAGES = [['reached the', 'feature', 75.4], ['noticed', 'the bug', 50.0], ['found the', 'cause', 43.8], ['fixed', 'it', 41.0], ['broke', 'nothing else', 40.8]];
function noticing(t) {
  if (t < K.l10 - 1.2 || t > K.l11 + 1) return;
  page(P3, PK, () => {
    const tFix = T('l10', 'fixing.'), tThree = T('l10', 'Three'), tHalf = T('l10', 'half'), tEnd = TE('l10', 'broken.');
    const X0 = 300, Y0 = 820, xs = STAGES.map((_, i) => 430 + i * 300), yv = v => Y0 - v / 100 * 640;
    const pts = STAGES.map((s, i) => [xs[i], yv(s[2])]);
    // axes, gridlines and labels are sketched in as we arrive
    const ax = seg(t, K.l10 - .6, K.l10 + .3);
    strokeP([[X0, yv(100) - 20], [X0, Y0], [1700, Y0]], PAL.ink, 3.5, { prog: ax, seed: 730 });
    [25, 50, 75, 100].forEach((v, k) => {
      dashed([[X0, yv(v)], [1680, yv(v)]], PAL.faint, 2, [6, 10], { prog: seg(t, K.l10 - .3 + k * .08, K.l10 + .4 + k * .08) });
      text(v + '%', X0 - 20, yv(v) + 12, { size: 34, align: 'right', color: PAL.soft, write: seg(t, K.l10 + k * .08, K.l10 + .3 + k * .08) });
    });
    text('share of runs that get this far', 1000, 105, { size: 38, color: PAL.soft, write: seg(t, K.l10, K.l10 + .7) });
    // each stage label pops (quick zoom in and out) as the narrator names it
    const tPop = [T('l10', 'find'), T('l10', 'notice'), T('l10', 'fixing'), T('l10', 'fixing') + .15, T('l10', 'fixing') + .3];
    STAGES.forEach(([a, b], i) => {
      const t0 = K.l10 + .2 + i * .12, pop = Math.sin(Math.PI * seg(t, tPop[i] - .05, tPop[i] + .5)), sz = 30 * (1 + .45 * pop);
      text(a, xs[i], Y0 + 50 + 6 * pop, { size: sz, color: '#55504A', write: seg(t, t0, t0 + .4) });
      text(b, xs[i], Y0 + 86 + 18 * pop, { size: sz, color: '#55504A', write: seg(t, t0 + .2, t0 + .6) });
    });
    // the line itself
    const tOnce = T('l10', 'Once'), p1 = seg(t, tThree - .2, tThree + .2), p2 = seg(t, tHalf - .1, tHalf + .5), p3 = seg(t, tOnce - .1, tFix + .5);
    const dot = (i, a) => { if (a <= 0) return; ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = i === 1 ? PAL.red : PAL.ink; ctx.beginPath(); ctx.arc(pts[i][0], pts[i][1], 11, 0, 7); ctx.fill(); ctx.restore(); const lp = i === 0 ? [24, -24] : i === 1 ? [26, 70] : [-12, -26];
      text(STAGES[i][2].toFixed(1) + '%', pts[i][0] + lp[0], pts[i][1] + lp[1], { font: 'tall', size: i < 2 ? 62 : 46, color: i === 1 ? PAL.red : PAL.ink, write: a, align: 'left' }); };
    if (p2 > 0) strokeP([pts[0], pts[1]], PAL.red, 6, { prog: p2, seed: 741 });
    if (p3 > 0) strokeP(pts.slice(1), PAL.ink, 5, { prog: p3, seed: 742 });
    dot(0, p1); dot(1, seg(p2, .8, 1)); [2, 3, 4].forEach(i => dot(i, seg(p3, (i - 1) / 4, (i - .5) / 4)));
    if (p2 >= 1) {
      text('the biggest drop', pts[1][0] + 30, pts[1][1] + 125, { size: 36, color: PAL.red, align: 'left', write: seg(t, tHalf + .4, tHalf + 1) });
    }
    // a little explorer stands on the line, then tumbles down the drop
    if (t > tThree - .4) {
      const roll = seg(t, tHalf, tHalf + .9), e = E.in(roll);
      const x = lerp(pts[0][0] + 10, pts[1][0] - 40, e), y = lerp(pts[0][1], pts[1][1], e) - 6;
      const enter = walk(t, tThree - .4, tThree + .2, pts[0][0] - 220, pts[0][0] - 40);
      claude(roll > 0 ? x : enter.x, (roll > 0 ? y : pts[0][1] - 6) + (roll > 0 ? 0 : enter.bob), .42, { body: '#8FA3A8', mark: false, mood: roll >= 1 ? 'surprised' : 'neutral', look: roll >= 1 ? -1 : .6, rot: roll > 0 && roll < 1 ? e * Math.PI * 2.2 : enter.rot, seed: 760 });
      if (roll <= 0) magnifier(enter.x + 52, pts[0][1] - 55, .55, .4);
      if (roll >= 1) text('?', pts[1][0] - 40, pts[1][1] - 120, { font: 'marker', size: 64, color: PAL.red, write: seg(t, tHalf + .9, tHalf + 1.1) });
    }
  });
}

// =====================================================================
// FOCALBOARD (page 4)
// =====================================================================
function shot(x, y, s, mark) {
  const img = IMG.focal, sw = 760, sh = 260;
  push(x, y, s);
  fillP(rrPts(-sw / 2 - 16, -sh / 2 - 16, sw + 32, sh + 32, 8, 30), PAL.paper, { stroke: PAL.ink, lw: 2.6, amp: 1, seed: 801 });
  ctx.drawImage(img, 0, 44, sw, sh, -sw / 2, -sh / 2, sw, sh);
  for (const [tx, ty, r] of [[-sw / 2 + 10, -sh / 2 - 12, -.5], [sw / 2 - 10, -sh / 2 - 12, .5]]) { push(tx, ty, 1, r); ctx.globalAlpha *= .75; fillP(rrPts(-40, -12, 80, 24, 3, 20), '#E8DCC0', { amp: .5, seed: 802 }); pop_(); }
  if (mark > 0) circleMark(-sw / 2 + 72, -sh / 2 + 175, 82, 24, PAL.red, mark, 4);
  pop_();
}
const AGENTS = [['Claude Fable 5.1', PAL.claude, 'bug', "that's a bug!", 'claude'], ['GLM 5.3', PAL.blue, 'bug', "that's a bug!", 'zai'], ['Claude Opus 5', PAL.claude, 'fine', 'tests say it’s fine', 'claude'], ['GPT-6 Astra', '#7DB3A8', 'away', 'other bugs…', 'openai']];
function focal(t) {
  if (t < K.l11 - 1.2 || t > K.l12 + 1) return;
  page(P4, PK, () => {
    const tSh = T('l11', 'share'), tNev = T('l11', 'never'), tFour = T('l11', 'Four'), tLook = T('l11', 'looked'), tOnly = T('l11', 'Only'), tTwo = T('l11', 'two');
    text('Focalboard', 960, 90, { size: 42, write: seg(t, K.l11 - .5, K.l11 + .3) });
    const st = Math.floor((t - K.l11 + .6) * STEP), settle = st < 0 ? null : st < 1 ? [.06, 1.04] : st < 2 ? [-.02, 1.01] : [0, 1];
    if (settle) { push(960, 330, 1, settle[0]); shot(0, 0, 1.08 * settle[1], seg(t, tNev, tNev + .6)); pop_(); }
    const leave = seg(t, tFour - .7, tFour + .2), oA = 1 - seg(t, tFour - .4, tFour);
    if (oA > 0) {
      const lw = walk(t, tFour - .7, tFour + .2, 0, 1);
      push(0, 0, 1, 0, oA);
      person(250 - leave * 300, 720, 1.1, { body: PAL.peri, hair: 'bob', hairColor: PAL.pinkLine, dots: PAL.periDark, mood: 'happy', look: .8, arms: 'wave', seed: 830, rot: lw.rot });
      person(1680 + leave * 300, 720, 1.1, { body: PAL.orange, hair: 'tuft', hairColor: PAL.teal, mood: t > tNev + .3 ? 'surprised' : 'neutral', look: -.8, lookY: -.6, seed: 831, rot: lw.rot });
      if (t > tNev + .3) text('?', 1740, 430, { font: 'marker', size: 90, color: PAL.red, write: seg(t, tNev + .3, tNev + .5) });
      pop_();
    }
    const u = seg(t, tSh - .3, tSh + .7);
    if (u > 0 && u < 1) plane(lerp(330, 1600, E.io(u)), 520 - Math.sin(u * Math.PI) * 200, 1.3, -.1 + u * .2);
    AGENTS.forEach(([nm, col, kind, say, lg], i) => {
      const x = 390 + i * 380, y = 895, t0w = tFour - .4 + i * .1;
      if (t < t0w) return;
      const wk = walk(t, t0w, tFour + .5 + i * .1, x + (i < 2 ? -1100 : 1100), x);
      const decide = t > tOnly - .1 + i * .15, away = kind === 'away' && decide;
      claude(wk.x, y + wk.bob, .95, { body: col, mark: lg, mood: decide ? (kind === 'bug' ? 'surprised' : kind === 'fine' ? 'proud' : 'neutral') : 'neutral', look: away ? 1 : (960 - x) / 900, lookY: away ? 0 : -1, seed: 850 + i, rot: wk.rot });
      text(nm, wk.x, y + 48, { size: 26, color: '#55504A' });
      if (t > tLook && !away) { ctx.save(); ctx.globalAlpha *= .5 * (1 - seg(t, tOnly, tOnly + .4)); dashed([[x, y - 160], [lerp(x, 560, .9), 400]], PAL.soft, 2, [6, 8], { prog: seg(t, tLook, tLook + .5) }); ctx.restore(); }
      if (decide) {
        const t0 = tOnly - .1 + i * .15, w = measure(say, 24) + 46;
        bubble(x, y - 300, w, 60, x - 10, y - 240, { stroke: kind === 'bug' ? PAL.green : PAL.ink, prog: seg(t, t0, t0 + .3) });
        text(say, x, y - 291, { size: 24, color: kind === 'bug' ? PAL.green : '#55504A', write: seg(t, t0 + .2, t0 + .6) });
        if (kind === 'bug') check(x + 90, y - 170, 1.3, PAL.green, seg(t, tTwo, tTwo + .4), 6);
      }
    });
  });
}

// =====================================================================
// ENDING (page 5): grandma, an iPad, and someone noticing first
// =====================================================================
function ending(t) {
  if (t < K.l12 - 1.2) return;
  page(P5, PK, () => {
    const tNot = T('l12', 'notice'), tBef = T('l12', 'before'), tHave = T('l12', 'have');
    lamp(500, 860, 1.3, 1);
    armchair(900, 860, 1.25);
    const sent = t > tHave;
    person(900, 830, 1.25, {
      body: PAL.grey, hair: 'bun', hairColor: '#8F897F', glasses: true, device: 'tablet', seed: 40,
      mood: sent ? 'happy' : 'neutral', lookY: .7, look: .2,
      screen: (w, h) => rsvp(w, h, sent ? 'sent' : 'big', { zoom: 1.35, mark: seg(t, tHave, tHave + .4) }),
      tap: sent ? null : t > tBef ? [.5, .85, seg(t, tBef + .2, tHave)] : [.35 + .3 * (Math.floor(t * .7) % 2), .5, (t * .7) % 1],
    });
    const lean = seg(t, tNot - .4, tNot + .2) * (1 - seg(t, tHave + .5, tHave + 1.2));
    claude(1170, 860, .8, { mood: t > tHave ? 'happy' : 'neutral', look: -1, lookY: .4, rot: -.12 * lean, seed: 901 });
    if (t > tNot - .6) {
      const run = seg(t, tBef, tBef + 2.5), appear = seg(t, tNot - .6, tNot - .2);
      const bx = run < .35 ? lerp(830, 650, run / .35) : lerp(650, -260, (run - .35) / .65), by = run < .35 ? lerp(700, 985, run / .35) : 985;
      bug(bx, by, .9, run < .35 ? -2.4 : -Math.PI / 2, { walk: true, alpha: appear * (1 - seg(run, .8, 1)) });
      if (t > tNot) text('!', 1185, 610, { font: 'marker', size: 60, color: PAL.orange, write: seg(t, tNot, tNot + .2), alpha: 1 - seg(t, tHave, tHave + .5) });
    }
    if (t > tHave) { const v = seg(t, tHave + .2, tHave + 2.2); heart(900 + Math.sin(v * 5) * 6, 520 - v * 80, 1.1 * clamp(v * 5), PAL.red, 1 - seg(v, .8, 1)); }
    const sg = LINE('l12').end + 1.6;
    if (t > sg) {
      text('SWEeper-Bench', 1530, 925, { font: 'marker', size: 58, write: seg(t, sg, sg + 1.1), color: '#55504A' });
      text('200 real bugs, waiting to be noticed', 1530, 972, { size: 26, write: seg(t, sg + .9, sg + 2), color: PAL.soft });
    }
  });
}

// ---------- captions ----------
function captions(t) {
  if (t > LINE('l12').end + .6) return;
  if (t < K.flip1) return;
  const c = CAPS.find(c => t >= c.s && t < c.e);
  if (!c) return;
  const a = Math.min(seg(t, c.s, c.s + .1), 1 - seg(t, c.e - .1, c.e));
  text(c.text, 960, 1046, { size: 44, color: c.who === 'W' ? PAL.periDark : '#2F3B38', alpha: a, stroke: 'rgba(236,235,230,.92)', strokeW: 10, jitter: .35 });
}

// =====================================================================
// HOOK (its own sheet): build fast -> users find the bugs -> grandma -> 59%
// =====================================================================
// The 200-app grid for the hook's last beat, off to the right of the hook page.
const HG = [960 + 4900, 560];
const HOOK_MISS = (() => {          // Grok 4.6 missed 82 of 200: about 4 per column of 10
  const r = rng(4242), miss = new Set();
  for (let c = 0; c < 20; c++) {
    const rows = [...Array(10).keys()].sort(() => r() - .5).slice(0, c === 6 || c === 13 ? 5 : 4);
    rows.forEach(rw => miss.add(rw * 20 + c));
  }
  return miss;
})();
const hgXY = i => [HG[0] - 3228 + (i % 20) * (CW + GAP), HG[1] - 1108 + Math.floor(i / 20) * (CH + GAP)];
function hookCam(t) {
  return camAt([
    [0, 520, 560, 1.3], [T('h01', 'software.'), 520, 555, 1.36],
    [T('h01', 'But') - .2, 520, 555, 1.36], [T('h01', 'run') - .4, 960, 560, 1.0], [T('h02', 'Even') - .3, 960, 565, 1.03],
    [T('h02', 'Grok') - .1, HG[0], HG[1] + 200, .245], [K.flip1, HG[0], HG[1] + 200, .238],
  ], t);
}
function hookCard(i, t, a, scanX) {
  const [x, y] = hgXY(i), tk = TASKS[ORDER[i]];
  if (a < .45) { strokeP(rrPts(x, y, CW, CH, 16, 30), PAL.ink, 2.4, { closed: true, prog: seg(a, 0, .45), seed: i, amp: 1 }); return; }
  const done = scanX > x + CW / 2, miss = HOOK_MISS.has(i);
  // once the sweep is over, the fixed apps step back and the missed ones jump forward
  const emph = seg(t, T('h02', 'missed') - .1, T('h02', 'missed') + .4), st = Math.floor(t * STEP);
  ctx.save(); ctx.globalAlpha *= seg(a, .45, 1) * (done && !miss ? 1 - .65 * emph : 1);
  if (done && miss && emph > 0) { ctx.translate(x + CW / 2, y + CH / 2 - Math.abs(n1(st, i)) * 26 * emph); ctx.rotate(n1(st + 9, i) * .07 * emph); ctx.scale(1 + .08 * emph, 1 + .08 * emph); ctx.translate(-x - CW / 2, -y - CH / 2); }
  fillP(rrPts(x, y, CW, CH, 16, 30), done ? (miss ? '#F6DCD6' : '#E2EEDF') : PAL.paper, { stroke: done && miss ? PAL.red : PAL.ink, lw: done ? 4 : 2.4, amp: 1, seed: i });
  fillP(rrPts(x + 6, y + 6, CW - 12, 30, 10, 30), DOMC[tk.domain] ?? PAL.tan, { amp: .5, seed: i + 3 });
  ptext(tk.product, x + 18, y + 29, 24);
  ctx.fillStyle = '#DDD7CB'; for (let k = 0; k < 3; k++) ctx.fillRect(x + 20, y + 54 + k * 18, 150 - (k * 37 + i * 13) % 80, 8);
  if (!done || miss) { const bs = 1.5 + (miss ? 1.1 * emph : 0), wx = miss ? n1(st, i + 3) * 40 * emph : 0; bug(x + 220 - 60 * emph * (miss ? 1 : 0) + wx, y + 130 - 20 * emph * (miss ? 1 : 0), bs, Math.sin(st * 1.3 + i) * (.4 + emph), { walk: true }); }
  if (done && !miss) check(x + 220, y + 128, 2.2, PAL.green, 1, 7);
  ctx.restore();
}
function hook(t) {
  const tAI = T('h01', 'AI'), tB = T('h01', 'building'), tSw = TE('h01', 'software.'), tBut = T('h01', 'But'), tRun = T('h01', 'run'), tBugs = T('h01', 'bugs.');
  const tCould = T('h02', 'Can'), tDo = T('h02', 'do?'), tEven = T('h02', 'Even'), tGrok = T('h02', 'Grok'), tMissed = T('h02', 'missed'), tTen = TE('h02', 'ten.');
  // --- beat 1: she asks (no words needed), Claude builds it in a blink
  if (t < tGrok + .2) hookPage(t);
  // --- beat 4: two hundred real apps; the best agent sweeps through, and four in ten stay broken
  hookGrid(t);
}
function hookPage(t) {
  const tAI = T('h01', 'AI'), tB = T('h01', 'building'), tSw = TE('h01', 'software.'), tBut = T('h01', 'But'), tRun = T('h01', 'run'), tBugs = T('h01', 'bugs.');
  const tCould = T('h02', 'Can'), tDo = T('h02', 'do?'), tEven = T('h02', 'Even');
  const st = Math.floor(t * STEP);
  // --- beat 1: she asks (her bubble shows the app she wants), Claude builds it in a blink
  rug(YOU[0], YOU[1] + 6, 100 * YOU[2], 22 * YOU[2]); rug(CL[0], CL[1] + 6, 100 * CL[2], 22 * CL[2]);
  const talking = t < tB - .1, built = t > tSw;
  person(YOU[0], YOU[1], YOU[2], { body: PAL.peri, hair: 'bob', hairColor: PAL.pinkLine, dots: PAL.periDark, seed: 5, look: .6,
    mood: talking ? 'talk' : built && t < tRun ? 'delight' : t > tBugs && t < tDo ? 'worried' : t > tDo ? 'happy' : 'neutral', arms: talking ? 'wave' : undefined });
  const buildOn = t > tAI + .4 && t < tSw, sweepU = seg(t, tCould + .2, tDo - .9), sweeping = sweepU > 0 && sweepU < 1;
  const sweepPose = t > tCould - .1 && t < tDo - .6;
  claude(CL[0], CL[1] + (sweeping ? (st % 2 ? -8 : 0) : 0), CL[2], { mood: buildOn || sweepPose ? 'focus' : built && t < tRun ? 'proud' : t > tBugs && t < tCould ? 'worried' : t > tDo - .6 ? 'proud' : 'neutral',
    look: -.7, lookY: sweepPose ? -.8 : 0, work: buildOn, tool: sweepPose, rot: buildOn || sweeping ? (st % 2 ? .03 : -.03) : 0 });
  const tbA = 1 - seg(t, tB - .1, tB + .3);
  if (t > tAI - .4 && tbA > 0) {
    push(0, 0, 1, 0, tbA);
    const bp = seg(t, tAI - .4, tAI);
    bubble(215, 455, 250, 150, 290, 560, { prog: bp });
    if (bp >= 1) {
      const p = []; for (let i = 0; i <= 14; i++) p.push([125 + i * 6, 430 + Math.sin(i * 1.3 + st * 1.7) * 5]);
      strokeP(p, PAL.soft, 3, { dense: true, seed: st, amp: .8 });
      const p2 = []; for (let i = 0; i <= 10; i++) p2.push([125 + i * 6, 462 + Math.sin(i * 1.3 + st * 1.7 + 1) * 5]);
      strokeP(p2, PAL.soft, 3, { dense: true, seed: st + 1, amp: .8 });
      fillP(rrPts(232, 400, 62, 108, 10, 12), PAL.paper, { stroke: PAL.ink, lw: 2.4, seed: 2101 });
      heart(263, 440, .9, PAL.red); fillP(rrPts(244, 470, 38, 12, 5, 8), PAL.peri, { amp: .3, seed: 2102 });
    }
    pop_();
  }
  const appA = 1 - seg(t, tBut + .2, tBut + .7);
  if (t > tAI + .5 && appA > 0) {
    const d = DEV.phone, pr = seg(t, tAI + .5, tAI + .9);
    const pieceT = k => tAI + 1.0 + k * (tSw - tAI - 1.0) / 5, n = [0, 1, 2, 3, 4].filter(k => t > pieceT(k)).length;
    push(APP[0] + 60, APP[1], 2.3, 0, appA);
    strokeP(rrPts(-d.w / 2, -d.h / 2, d.w, d.h, d.r, 10), PAL.ink, 2.4, { closed: true, prog: pr, seed: 21, amp: .6 });
    if (pr >= 1) device('phone', 0, 0, (w, h) => rsvp(w, h, 'ok', { pieces: n }));
    pop_();
    for (let k = 0; k < 5; k++) if (t > pieceT(k) && t < pieceT(k) + .35) sparkles(APP[0] + 60, APP[1] - 60 + k * 30, 70, t - pieceT(k), 5, PAL.orange);
    if (built && t < tSw + 1.2) sparkles(APP[0] + 60, APP[1], 190, t - tSw, 8, PAL.orange);
  }
  strokeP([[800, 110], [804, 400], [798, 700], [802, 990]], PAL.faint, 3.2, { prog: seg(t, tBut, tBut + .5), seed: 301, amp: 1.5 });
  // --- beat 2: people use it and hit bugs, and they are clearly not happy about it
  // --- beat 3: what if the bugs were swept away first? then the app reaches people, and they're happy
  const away = i => tCould - .15 + i * .03, back = i => tDo - .7 + i * .06;
  const PH = [APP[0] + 60, APP[1]];
  CROWD.forEach((p, i) => {
    const ta = tBut + .55 + i * .07, [px, py] = devPos(p);
    if (t > ta - .6 && t < ta + .1) { const u = E.io(seg(t, ta - .6, ta)); plane(lerp(APP[0] + 60, px, u), lerp(APP[1], py, u) - Math.sin(u * Math.PI) * 140, .9, -.2 + u * .4); }
    const tb = back(i);
    if (t > tb - .55 && t < tb + .1) { const u = E.io(seg(t, tb - .55, tb)); plane(lerp(PH[0], px, u), lerp(PH[1] - 80, py, u) - Math.sin(u * Math.PI) * 160, .9, -.2 + u * .4); }
    if (t < ta) return;
    puff(p.x, p.y, p.s, seg(t, ta, ta + .45), 300 + i);
    if (t < ta + .2) return;
    // nudged a bit to the side while the agent works, then back again
    const p0 = away(i), pushU = E.io(seg(t, p0, p0 + .5)), backU = E.io(seg(t, tb - .5, tb));
    const off = 0, moving = false;
    const wob = moving ? (st % 2 ? .05 : -.05) : 0, hopY = moving ? -Math.abs(Math.sin(st * Math.PI / 2)) * 8 : 0;
    const iss = ISSUES.findIndex(q => q.who === p.id), ti = tRun - .2 + Math.max(iss, i % 4) * .2;
    const happyAgain = t >= tb;
    const st2 = happyAgain ? 'sent' : t > ti ? (iss >= 0 ? ['big', 'tz', 'vanish', 'double'][iss] : 'error') : 'ok';
    const ph = (t - ta) * 1.3 + i * .37, k = Math.floor(ph);
    const tap = !happyAgain && t < ti ? [.3 + .4 * (n1(k, i) * .5 + .5), .5 + .3 * (n1(k + 7, i) * .5 + .5), ph - k] : null;
    const pushed = false;
    const angry = !happyAgain && !pushed && t > ti + .25;
    const mood = happyAgain ? 'delight' : pushed ? 'surprised' : angry ? 'angry' : t > ti ? 'surprised' : 'happy';
    const shake = angry ? n1(st, i) * 5 : 0;
    person(p.x + shake + off, p.y, p.s, { ...p, seed: 40 + i, mood, look: pushed ? -.8 : p.x > 1500 ? -.4 : .3, lookY: angry ? 0 : .6, screen: (w, h) => rsvp(w, h, st2, { zoom: 2, mark: 1 }), tap: pushed ? null : tap,
      rot: wob, bob: moving ? hopY : t > ti && t < ti + .3 ? -10 : angry ? -Math.abs(n1(st + 3, i)) * 6 : 0 });
    if (!happyAgain && t > ti && t < away(i)) {      // the bug itself escapes the screen
      const [dx, dy] = devPos(p), ang = -2.4 + (i * 1.7) % 4.8, u = E.out(seg(t, ti, ti + 1.1));
      bug(dx + Math.cos(ang) * 110 * u, dy + Math.sin(ang) * 60 * u - 10, .8 * p.s, ang + Math.PI / 2, { walk: true });
    }
    if (angry) {                                       // fuming: scribble cloud + puffs of steam
      scribble(p.x, p.y - 232 * p.s, p.s, PAL.red, 900 + i, seg(t, ti + .25, ti + .6));
      for (let k = 0; k < 2; k++) { const u = ((t * 1.6 + k * .5 + i * .23) % 1); fillP(ellPts(p.x + (k ? 26 : -26) * p.s + u * (k ? 14 : -14), p.y - 215 * p.s - u * 50, 11 + u * 8, 9 + u * 6, 8), 'rgba(170,165,155,.7)', { amp: 1.2, seed: 950 + i + k }); }
    }
    if (happyAgain) { const u = seg(t, tb + .2, tb + 1.6); heart(p.x + off + Math.sin(u * 6 + i) * 8, p.y - 240 * p.s - u * 80, .9 * clamp(u * 5), PAL.red, 1 - seg(u, .75, 1)); }
  });
  // the sweep: the app comes back where it was built; Claude sweeps its bugs away before anyone sees them
  if (t > tCould - .3 && t < tDo + .2) {
    const pa = Math.min(seg(t, tCould - .3, tCould + .1), 1 - seg(t, tDo - .7, tDo - .35));
    if (pa > 0) {
      push(PH[0], PH[1], 2.3, 0, pa); device('phone', 0, 0, (w, h) => rsvp(w, h, 'ok')); pop_();
      for (let k = 0; k < 5; k++) {
        const bx0 = PH[0] - 40 + (k % 3) * 38, by0 = PH[1] - 70 + Math.floor(k / 2) * 55, hit = (k / 5) * .8;
        if (sweepU < hit) { bug(bx0, by0, .85, Math.sin(st + k) * .5, { walk: true, alpha: pa }); continue; }
        const v = seg(sweepU, hit, hit + .35);
        if (v < 1) bug(bx0 - v * (420 + k * 50), by0 - Math.sin(v * Math.PI) * (150 + k * 30), .85, v * 12 + k, { alpha: 1 - v });
      }
      if (t > tCould - .1 && t < tDo - .6) {
        // the broom reaches up from Claude's hand and brushes the screen, right to left
        const bx = lerp(PH[0] + 40, PH[0] - 40, E.io(sweepU)), by = PH[1] - 20 + Math.sin(sweepU * Math.PI * 4) * 60;
        broom(bx, by, .95, 2.5 + (sweeping ? (st % 2 ? .18 : -.1) : 0));
        if (sweeping) for (let k = 0; k < 4; k++) { const r = rng(st * 5 + k); fillP(ellPts(bx - 60 - r() * 140, by - 30 - r() * 90, 12 + r() * 16, 9 + r() * 10, 9), 'rgba(196,186,168,.55)', { amp: 2, seed: st + k }); }
      }
    }
  }
}
function hookGrid(t) {
  const tEven = T('h02', 'Even'), tGrok = T('h02', 'Grok'), tMissed = T('h02', 'missed'), tTen = TE('h02', 'ten.');
  if (t > tEven - .4) {
    const scanX = lerp(HG[0] - 3500, HG[0] + 3500, E.io(seg(t, tGrok - .1, tMissed + .5)));
    for (let i = 0; i < 200; i++) {
      const [x, y] = hgXY(i), ta = tEven - .3 + (i % 20) * .025 + Math.floor(i / 20) * .02, a = seg(t, ta, ta + .35);
      if (a > 0) hookCard(i, t, a, scanX);
    }
    if (t > tGrok - .1) {
      const ay = HG[1] + 1108 + 720, wob = Math.floor(t * STEP) % 2 ? -20 : 0;
      claude(clamp(scanX, HG[0] - 3200, HG[0] + 3200), ay + wob, 3.3, { body: '#A9B0B6', mark: 'grok', markScale: 2.4, mood: 'focus', look: 1, seed: 1401, rot: wob ? .05 : -.05 });
    }
    if (t > tMissed - .1) {
    }
  }
}
function hookNote(t) {
  // [line id, first word, line-break word, end word (exclusive), emphasis by word index, merges]
  const OR = '#E8901F', RD = PAL.red, IN = '#25302D';
  const SENT = [
    ['h01', 0, 5, 8, { 6: OR, 7: OR }, []],
    ['h01', 8, 17, 24, { 14: IN, 15: IN, 16: IN, 23: RD }, []],
    ['h02', 0, 6, 10, { 0: OR, 1: OR, 2: OR, 3: OR, 4: OR, 5: OR }, []],
    ['h02', 10, 18, 24, { 12: IN, 13: IN, 14: IN, 19: RD, 21: RD, 22: RD, 23: RD }, [[14, 17, 'Grok 4.6,'], [21, 21, '4'], [23, 23, '10.']]],
  ];
  SENT.forEach(([id, i0, brk, i1, emph, merges], si) => {
    const all = LINE(id).words, nxt = SENT[si + 1];
    const toks = [];
    for (let i = i0; i < i1; i++) {
      const m = merges.find(m => m[0] === i);
      const tk = { w: m ? m[2] : all[i].w, s: all[i].s, i, col: emph[i] };
      tk.size = tk.col ? 70 : 50;
      toks.push(tk);
      if (m) i = m[1];
    }
    const tS = all[i0].s - .2, tE = nxt ? LINE(nxt[0]).words[nxt[1]].s - .25 : K.flip0 - .05;
    if (t < tS || t > tE) return;
    const a = Math.min(seg(t, tS, tS + .15), 1 - seg(t, tE - .2, tE));
    const lines = [toks.filter(k => k.i < brk), toks.filter(k => k.i >= brk)];
    ctx.save(); ctx.globalAlpha = a;
    lines.forEach((lw, li) => {
      const sp = 22, tot = lw.reduce((s2, k) => s2 + measure(k.w, k.size), 0) + sp * (lw.length - 1);
      let x = 960 - tot / 2; const y = 112 + li * 92;
      lw.forEach((k, j) => {
        const ww = measure(k.w, k.size), wr = seg(t, k.s - .06, k.s + .16);
        // emphasized words land with a little stop-motion hop as they're written
        const hop = k.col && wr > 0 && wr < 1 ? -8 : 0;
        text(k.w, x, y + hop, { size: k.size, align: 'left', color: k.col ?? '#6B716E', write: wr, stroke: 'rgba(236,235,230,.9)', strokeW: 10, jitter: k.col ? .7 : .4 });
        x += ww + sp;
      });
    });
    ctx.restore();
  });
}

function hookCues(add) {
  const tAI = T('h01', 'AI'), tSw = TE('h01', 'software.');
  add(tAI - .3, 'pen', .3); add(tAI + .4, 'type', .45);
  for (let k = 0; k < 5; k++) add(tAI + 1.0 + k * (tSw - tAI - 1.0) / 5, 'pop', .35);
  add(tSw, 'chime', .4); add(tSw + .05, 'sparkle', .35);
  add(T('h01', 'But') - .05, 'whoosh', .4); CROWD.forEach((p, i) => { if (i % 2 === 0) add(T('h01', 'But') + .55 + i * .07, 'pop2', .25); });
  [0, 1, 2, 3].forEach(i => add(T('h01', 'run') - .2 + i * .2, 'bonk', .35));
  add(T('h01', 'run'), 'bugs', .4); add(T('h01', 'bugs.'), 'scribble', .3);
  add(T('h02', 'Can') - .1, 'whoosh', .35); add(T('h02', 'Can') + .4, 'bugs', .3); add(T('h02', 'do?'), 'pen', .45);
  add(T('h02', 'Even') - .2, 'whoosh', .45); add(T('h02', 'Grok') - .1, 'swish', .55); add(T('h02', 'Grok'), 'pen', .35);
  for (let k = 0; k < 10; k++) add(T('h02', 'Grok') + .1 + k * .3, 'click', .22);
  add(T('h02', 'missed'), 'bugs', .55); add(T('h02', 'missed') + .3, 'bonk', .3); add(T('h02', 'four', 1) - .3, 'pen', .45);
  add(K.flip0, 'flip', .7);
}

// ---------- frame ----------
function drawMain(t, st) {
  ctx.save();
  ctx.translate(n1(st, 5) * .7, n1(st, 9) * .7);   // re-shot frame: a hair of jitter each pose
  applyCam(camera(RAW));
  story(t); title(t); grid(t); results(t); noticing(t); focal(t); ending(t);
  ctx.restore();
}
function drawHook(t, st, raw) {
  ctx.save();
  ctx.translate(n1(st, 5) * .7, n1(st, 9) * .7);
  applyCam(hookCam(raw));
  hook(t);
  ctx.restore();
  hookNote(t);
}
function renderAt(t, opts = {}) {
  RAW = t; TIME = Math.floor(t * STEP + 1e-6) / STEP;
  const st = Math.floor(t * STEP + 1e-6);
  ctx.setTransform(SC_, 0, 0, SC_, 0, 0);
  ctx.fillStyle = PAL.bg; ctx.fillRect(0, 0, W, H);
  if (t < K.flip0) drawHook(TIME, st, RAW);
  else {
    drawMain(TIME, st);
    if (t < K.flip1) {
      // stop-motion page turn: the old sheet peels away right-to-left
      const u = E.io(seg(TIME, K.flip0, K.flip1)), xe = lerp(W + 200, -260, u), fw = 60 + 200 * Math.sin(u * Math.PI);
      ctx.save(); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(xe + 70, 0); ctx.lineTo(xe - 70, H); ctx.lineTo(0, H); ctx.closePath(); ctx.clip();
      ctx.fillStyle = PAL.bg; ctx.fillRect(0, 0, W, H);
      drawHook(K.flip0 - .01, st, K.flip0 - .01);
      ctx.restore();
      ctx.save(); ctx.globalAlpha = .18; ctx.fillStyle = '#5A5040';
      ctx.beginPath(); ctx.moveTo(xe + 70, 0); ctx.lineTo(xe + 70 + fw + 50, 0); ctx.lineTo(xe - 70 + fw + 50, H); ctx.lineTo(xe - 70, H); ctx.fill(); ctx.restore();
      fillP([[xe + 70, 0], [xe + 70 + fw, 8], [xe - 70 + fw, H - 8], [xe - 70, H]], '#E2DED4', { stroke: PAL.ink, lw: 2.4, amp: 1.5, seed: 1301 });
    }
  }
  if (opts.captions !== false) captions(TIME);
  // blog: no paper grain or exposure flicker, so the drawing sits on the white page
}

// ---------- sound cues (time, name, gain) ----------
function buildCues() {
  const c = [], add = (t, n, g = 1) => c.push([+t.toFixed(3), n, g]);
  add(LINE('u01').start - .5, 'pen', .3); add(LINE('u01').start, 'tap', .3);
  hookCues(add);
  add(K.done - .8, 'pen', .35); add(K.done - .2, 'sparkle', .5); add(K.done, 'chime', .3);
  CROWD.forEach((p, i) => { if (i % 2 === 0) add(K.off + .55 + i * .13 - .75, 'whoosh', .25); });
  add(K.l03, 'murmur', .2);
  add(T('l03', 'send'), 'tap', .7); add(T('l03', 'tapping') - .1, 'tap', .7); add(T('l03', 'twice.'), 'tap', .7);
  K.issues.forEach(ti => add(ti, 'bonk', .45));
  add(K.frus, 'scribble', .35);
  add(K.back - .3, 'whoosh', .4); add(K.pass - .1, 'message', .4);
  add(K.waits - .4, 'tick', .4);
  add(K.say - .2, 'pen', .3); add(K.find, 'type', .35);

  CROWD.forEach((p, i) => { if (i % 2 === 0) add(K.swap + .05 + i * .08, 'pop2', .3); });
  add(K.click - .6, 'pen', .3);
  for (let lap = 1; lap < 60; lap++) {
    const w0 = Math.PI * 2 / 2.2, k = .5, tl = K.click + Math.log(lap * Math.PI * 2 * k / w0 + 1) / k;
    if (tl > K.swapBack) break;
    add(tl, 'click', .3 + Math.min(.3, lap * .02));
  }
  CROWD.forEach((p, i) => { if (i % 2 === 1) add(K.swapBack + i * .07, 'pop2', .3); });
  add(K.works - .2, 'chime', .45); add(K.works, 'heart', .25);
  add(K.storyEnd - .6, 'whoosh', .4);
  add(T('l07', 'Sweeper') - .15, 'pen', .45); add(T('l07', 'Software'), 'pen', .35);
  add(T('l07', 'with') - .1, 'swish', .6); add(T('l07', 'with') + .1, 'bugs', .4);
  add(K.dive - .1, 'whoosh', .4);
  add(T('l08', 'Two') - .8, 'pen', .3);
  add(T('l08', 'Two') + 1.3, 'click', .55); add(T('l08', 'Two') + 2.0, 'click', .55); add(T('l08', 'Two') + 2.7, 'bonk', .45);
  add(K.zoomOut, 'whoosh', .35);
  add(K.l09 - .2, 'whoosh', .35); add(T('l09', 'Grok'), 'pen', .45); add(T('l09', 'fifty-nine'), 'pen', .35);
  add(K.l10 - .1, 'whoosh', .3); add(T('l10', 'Three'), 'pen', .3); add(T('l10', 'half'), 'swish', .3); add(T('l10', 'Once'), 'pen', .3);
  add(K.l11 - .3, 'whoosh', .3); add(K.l11 + .1, 'pop2', .35); add(T('l11', 'share') - .3, 'whoosh', .4); add(T('l11', 'never'), 'scribble', .35);
  [0, 1, 2, 3].forEach(i => add(T('l11', 'Four') - .2 + i * .1, 'tap', .25));
  [0, 1, 2, 3].forEach(i => add(T('l11', 'Only') - .1 + i * .15, 'pen', .25));
  add(K.l12 - .3, 'whoosh', .3); add(T('l12', 'notice'), 'sparkle', .3); add(T('l12', 'have'), 'tap', .5); add(T('l12', 'have') + .2, 'heart', .35);
  add(LINE('l12').end + 1.6, 'pen', .3);
  return c.sort((a, b) => a[0] - b[0]);
}

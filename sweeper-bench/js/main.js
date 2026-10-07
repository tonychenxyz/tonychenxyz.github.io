// SWEeper-Bench page. Everything here draws into the DOM: inline SVG figures and charts, HTML
// tables and cards, and canvases for the hand-drawn animations (no rasterised diagrams).
// lib.js / chars.js are classic scripts that own globals such as ctx, TIME, W, H, PAL, E, T, seg;
// everything here lives inside one function scope and declares none of those names, so it can
// assign the shared ones. Data and figures come from the data/*.js and figs/*.js script files
// (SB_DATA, SB_FIGS) rather than fetch(), so the page also works opened straight from disk.
(async () => {

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
};
const html = (tag, cls, inner) => { const n = document.createElement(tag); if (cls) n.className = cls; if (inner != null) n.innerHTML = inner; return n; };
const LOGO = name => asset(`anim/art/logos/${name}.svg`);
const fmt1 = x => x.toFixed(1);

const DATA = SB_DATA.results;
const MODELS = DATA.models;
const byKey = Object.fromEntries(MODELS.map(m => [m.key, m]));

// ---------------------------------------------------------------- paper figures
for (const fig of $$('[data-svg]')) fig.insertAdjacentHTML('afterbegin', SB_FIGS[fig.dataset.svg]);
for (const fig of $$('[data-frame]')) {
  const natW = +fig.dataset.width, box = html('div', 'frame-box');
  const ifr = document.createElement('iframe');
  ifr.srcdoc = SB_FIGS[fig.dataset.frame]; ifr.title = 'Figure'; ifr.style.width = natW + 'px'; ifr.setAttribute('scrolling', 'no'); ifr.tabIndex = -1;
  box.appendChild(ifr); fig.prepend(box);
  const fit = () => {
    const doc = ifr.contentDocument; if (!doc?.body) return;
    const natH = Math.max(doc.body.scrollHeight, doc.querySelector('main')?.getBoundingClientRect().bottom ?? 0);
    const s = box.clientWidth / natW;
    ifr.style.height = natH + 'px'; ifr.style.transform = `scale(${s})`; box.style.height = natH * s + 'px';
  };
  ifr.addEventListener('load', () => { fit(); setTimeout(fit, 400); });
  new ResizeObserver(fit).observe(box);
}

// ---------------------------------------------------------------- chart helpers (paper style)
function chartFrame(host, w, h, m) {
  const svg = el('svg', { viewBox: `0 0 ${w} ${h}`, role: 'img' }, host);
  const tip = html('div', 'tip'); host.appendChild(tip);
  return { svg, tip, x0: m.l, x1: w - m.r, y0: h - m.b, y1: m.t };
}
const scale = (d0, d1, r0, r1) => v => r0 + (v - d0) / (d1 - d0) * (r1 - r0);
function yAxis(svg, f, ticks, y, fmt, label) {
  for (const t of ticks) {
    el('line', { x1: f.x0, x2: f.x1, y1: y(t), y2: y(t), stroke: '#e5e8ed', 'stroke-width': .8 }, svg);
    el('text', { x: f.x0 - 8, y: y(t) + 4, 'text-anchor': 'end', 'font-size': 12 }, svg).textContent = fmt(t);
  }
  el('line', { x1: f.x0, x2: f.x0, y1: f.y0, y2: f.y1, stroke: '#000', 'stroke-width': 1 }, svg);
  if (label) el('text', { x: 0, y: 0, transform: `translate(${f.x0 - 46},${(f.y0 + f.y1) / 2}) rotate(-90)`, 'text-anchor': 'middle', 'font-size': 13 }, svg).textContent = label;
}
function showTip(host, tip, x, y, inner) {
  tip.innerHTML = inner; tip.style.opacity = 1;
  const r = host.getBoundingClientRect(), tw = tip.offsetWidth;
  tip.style.left = Math.min(Math.max(x + 14, 0), r.width - tw) + 'px'; tip.style.top = (y - 44) + 'px';
}
const svgPoint = (svg, ev) => { const p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); };
const hostPoint = (host, ev) => { const r = host.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };

// ---------------------------------------------------------------- where agents stumble
{
  const host = $('#chart-stages'), W_ = 560, H_ = 420;
  const f = chartFrame(host, W_, H_, { l: 64, r: 58, t: 14, b: 74 });
  const STAGES = [['Identified', 'target', 'feature'], ['Identified', 'buggy', 'behavior'], ['Diagnosed', 'root', 'cause'], ['Fixed the', 'buggy', 'behavior'], ['Maintained', 'existing', 'behaviors']];
  const x = i => f.x0 + 24 + i * (f.x1 - f.x0 - 48) / 4, y = scale(0, 100, f.y0, f.y1);
  yAxis(f.svg, f, [0, 20, 40, 60, 80, 100], y, String, '% of cases reaching stage');
  el('line', { x1: f.x0, x2: f.x1, y1: f.y0, y2: f.y0, stroke: '#000' }, f.svg);
  STAGES.forEach((s, i) => s.forEach((t, k) => { el('text', { x: x(i), y: f.y0 + 20 + k * 15, 'text-anchor': 'middle', 'font-size': 12.5 }, f.svg).textContent = t; }));
  const g = el('g', {}, f.svg), lines = {};
  for (const [k, v] of Object.entries(DATA.stages)) {
    const gg = el('g', { class: 'm' }, g);
    el('polyline', { points: v.map((p, i) => `${x(i)},${y(p)}`).join(' '), fill: 'none', stroke: '#BDBDBD', 'stroke-width': 1.5 }, gg);
    v.forEach((p, i) => el('circle', { cx: x(i), cy: y(p), r: 3.2, fill: '#BDBDBD' }, gg));
    lines[k] = gg;
  }
  const avg = DATA.stage_avg, ga = el('g', {}, f.svg);
  el('polyline', { points: avg.map((p, i) => `${x(i)},${y(p)}`).join(' '), fill: 'none', stroke: '#000', 'stroke-width': 2.8 }, ga);
  avg.forEach((p, i) => {
    el('circle', { cx: x(i), cy: y(p), r: 4.6, fill: '#000' }, ga);
    const lab = el('text', { x: x(i) + 9, y: y(p) + (i === 1 ? 19 : -10), 'font-size': 12.5, 'font-weight': 700, stroke: '#fff', 'stroke-width': 4, 'paint-order': 'stroke' }, ga);
    lab.textContent = fmt1(p) + '%';
  });
  // legend (paper position: top right)
  const lg = el('g', { transform: `translate(${f.x1 - 150},${f.y1 + 6})` }, f.svg);
  el('rect', { x: -10, y: -10, width: 166, height: 52, fill: '#fff' }, lg);
  el('line', { x1: 0, x2: 24, y1: 6, y2: 6, stroke: '#BDBDBD', 'stroke-width': 1.5 }, lg); el('circle', { cx: 12, cy: 6, r: 3.2, fill: '#BDBDBD' }, lg);
  el('text', { x: 32, y: 10, 'font-size': 12.5 }, lg).textContent = 'Individual model';
  el('line', { x1: 0, x2: 24, y1: 28, y2: 28, stroke: '#000', 'stroke-width': 2.8 }, lg); el('circle', { cx: 12, cy: 28, r: 4.6, fill: '#000' }, lg);
  el('text', { x: 32, y: 32, 'font-size': 12.5 }, lg).textContent = 'Average';
  // hover: nearest model line
  let cur = null;
  const set = k => {
    if (cur === k) return; cur = k;
    for (const [kk, gg] of Object.entries(lines)) {
      const on = kk === k;
      gg.querySelectorAll('polyline').forEach(p => { p.setAttribute('stroke', on ? '#5B5EC2' : '#BDBDBD'); p.setAttribute('stroke-width', on ? 2.4 : 1.5); });
      gg.querySelectorAll('circle').forEach(c => c.setAttribute('fill', on ? '#5B5EC2' : '#BDBDBD'));
      if (on) g.appendChild(gg);
    }
  };
  f.svg.addEventListener('mousemove', ev => {
    const p = svgPoint(f.svg, ev); if (p.x < f.x0 || p.x > x(4) + 20) { set(null); f.tip.style.opacity = 0; return; }
    const fi = Math.max(0, Math.min(3.999, (p.x - x(0)) / (x(1) - x(0)))), i0 = Math.floor(fi), u = fi - i0;
    let best = null, bd = 14;
    for (const [k, v] of Object.entries(DATA.stages)) { const yy = y(v[i0] + (v[i0 + 1] - v[i0]) * u), d = Math.abs(yy - p.y); if (d < bd) { bd = d; best = k; } }
    set(best);
    if (best) {
      const v = DATA.stages[best], [hx, hy] = hostPoint(host, ev);
      showTip(host, f.tip, hx, hy, `<b>${byKey[best].name}</b><br><span class="t-sub">${v.map(fmt1).join(' → ')}</span>`);
    } else f.tip.style.opacity = 0;
  });
  f.svg.addEventListener('mouseleave', () => { set(null); f.tip.style.opacity = 0; });
}

// ---------------------------------------------------------------- open-ended vs detailed prompt
{
  const rows = [['DeepSeek V4.1 Flash', 'deepseek-color', 51.5, 96.5], ['GPT-5.6 Sol', 'openai', 47.0, 96.5], ['GLM 5.3', 'zai', 43.5, 96.0], ['GPT-5.6 Luna', 'openai', 42.0, 96.0], ['GPT-5.6 Terra', 'openai', 35.0, 96.0]];
  const host = $('#chart-detailed'), W_ = 560, H_ = 46 + rows.length * 34;
  const f = chartFrame(host, W_, H_, { l: 168, r: 22, t: 30, b: 30 });
  const x = scale(30, 100, f.x0, f.x1);
  for (const t of [30, 50, 70, 90]) {
    el('line', { x1: x(t), x2: x(t), y1: f.y1 - 8, y2: f.y0, stroke: '#e5e8ed' }, f.svg);
    el('text', { x: x(t), y: f.y0 + 18, 'text-anchor': 'middle', 'font-size': 12 }, f.svg).textContent = t + '%';
  }
  el('text', { x: x(44), y: 14, 'text-anchor': 'middle', 'font-size': 12 }, f.svg).textContent = 'open-ended prompt';
  el('text', { x: x(96), y: 14, 'text-anchor': 'end', 'font-size': 12, 'font-weight': 700 }, f.svg).textContent = 'with a bug report';
  rows.forEach(([n, logo, a, b], i) => {
    const yy = f.y1 + 10 + i * 34;
    el('image', { href: LOGO(logo), x: 4, y: yy - 8, width: 16, height: 16 }, f.svg);
    el('text', { x: 28, y: yy + 4.5, 'font-size': 13, 'font-weight': 600 }, f.svg).textContent = n;
    el('line', { x1: x(a), x2: x(b) - 6, y1: yy, y2: yy, stroke: '#BDBDBD', 'stroke-width': 2.4 }, f.svg);
    el('circle', { cx: x(a), cy: yy, r: 6, fill: '#fff', stroke: '#888', 'stroke-width': 2 }, f.svg);
    el('circle', { cx: x(b), cy: yy, r: 6.5, fill: '#000' }, f.svg);
    el('text', { x: x(a) - 11, y: yy + 4.5, 'text-anchor': 'end', 'font-size': 12 }, f.svg).textContent = fmt1(a);
    el('text', { x: x(b) - 12, y: yy - 9, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 700 }, f.svg).textContent = fmt1(b);
  });
}

// ---------------------------------------------------------------- work time vs pass rate
function logoDot(svg, m, cx, cy, r = 11) {
  const g = el('g', { class: 'dot', style: 'cursor:default' }, svg);
  el('circle', { cx, cy, r: r + 6, fill: 'transparent' }, g);   // generous hit target
  el('circle', { cx, cy, r, fill: '#fff', stroke: '#222', 'stroke-width': 1.1 }, g);
  el('image', { href: LOGO(m.logo), x: cx - r * .62, y: cy - r * .62, width: r * 1.24, height: r * 1.24 }, g);
  return g;
}
{
  const host = $('#chart-duration'), W_ = 440, H_ = 380;
  const f = chartFrame(host, W_, H_, { l: 62, r: 16, t: 14, b: 52 });
  const x = scale(0, 110, f.x0, f.x1), y = scale(25, 62, f.y0, f.y1);
  yAxis(f.svg, f, [30, 40, 50, 60], y, t => t + '%', 'Pass rate');
  el('line', { x1: f.x0, x2: f.x1, y1: f.y0, y2: f.y0, stroke: '#000' }, f.svg);
  for (const t of [0, 20, 40, 60, 80, 100]) el('text', { x: x(t), y: f.y0 + 18, 'text-anchor': 'middle', 'font-size': 12 }, f.svg).textContent = t;
  el('text', { x: (f.x0 + f.x1) / 2, y: H_ - 8, 'text-anchor': 'middle', 'font-size': 13 }, f.svg).textContent = 'Mean work time per task (min)';
  for (const m of [...MODELS].reverse()) {
    const g = logoDot(f.svg, m, x(m.time_exact), y(m.pass), 10);
    g.addEventListener('mousemove', ev => { const [hx, hy] = hostPoint(host, ev); showTip(host, f.tip, hx, hy, `<b>${m.name}</b> · ${m.harness}<br><span class="t-sub">${fmt1(m.pass)}% pass · ${fmt1(m.time)} min/task</span>`); });
    g.addEventListener('mouseleave', () => f.tip.style.opacity = 0);
  }
}

// ---------------------------------------------------------------- time budget ablation
{
  const SER = [['gpt-5.6-luna', 'GPT-5.6 Luna', '#000', 'circle'], ['gpt-5.6-terra', 'GPT-5.6 Terra', '#7a7a7a', 'square'], ['glm-5.3', 'GLM 5.3', '#b8b8b8', 'tri']];
  const host = $('#chart-budget'), W_ = 440, H_ = 380;
  const f = chartFrame(host, W_, H_, { l: 62, r: 20, t: 14, b: 52 });
  const MIN = [20, 40, 60, 80], x = scale(14, 86, f.x0, f.x1), y = scale(30, 66, f.y0, f.y1);
  yAxis(f.svg, f, [30, 40, 50, 60], y, t => t + '%', 'Pass rate');
  el('line', { x1: f.x0, x2: f.x1, y1: f.y0, y2: f.y0, stroke: '#000' }, f.svg);
  for (const t of MIN) el('text', { x: x(t), y: f.y0 + 18, 'text-anchor': 'middle', 'font-size': 12 }, f.svg).textContent = t;
  el('text', { x: (f.x0 + f.x1) / 2, y: H_ - 8, 'text-anchor': 'middle', 'font-size': 13 }, f.svg).textContent = 'Time budget (minutes)';
  const mark = (shape, cx, cy, c, g) => shape === 'circle' ? el('circle', { cx, cy, r: 5, fill: c }, g)
    : shape === 'square' ? el('rect', { x: cx - 4.6, y: cy - 4.6, width: 9.2, height: 9.2, fill: c }, g)
    : el('path', { d: `M${cx} ${cy - 6}L${cx + 5.8} ${cy + 4.4}H${cx - 5.8}Z`, fill: c }, g);
  for (const [k, , c, shape] of [...SER].reverse()) {
    const v = MIN.map(t => DATA.budget[k][t]);
    el('polyline', { points: v.map((p, i) => `${x(MIN[i])},${y(p)}`).join(' '), fill: 'none', stroke: c, 'stroke-width': 2.2 }, f.svg);
    v.forEach((p, i) => mark(shape, x(MIN[i]), y(p), c, f.svg));
  }
  const lg = el('g', { transform: `translate(${f.x1 - 128},${f.y0 - 70})` }, f.svg);
  SER.forEach(([, n, c, shape], i) => { el('line', { x1: 0, x2: 22, y1: i * 20, y2: i * 20, stroke: c, 'stroke-width': 2.2 }, lg); mark(shape, 11, i * 20, c, lg); el('text', { x: 30, y: i * 20 + 4, 'font-size': 12.5 }, lg).textContent = n; });
  const cross = el('line', { y1: f.y1, y2: f.y0, stroke: '#999', 'stroke-dasharray': '3 3', opacity: 0 }, f.svg);
  f.svg.addEventListener('mousemove', ev => {
    const p = svgPoint(f.svg, ev), t = MIN.reduce((a, b) => Math.abs(x(b) - p.x) < Math.abs(x(a) - p.x) ? b : a);
    cross.setAttribute('x1', x(t)); cross.setAttribute('x2', x(t)); cross.setAttribute('opacity', 1);
    const [hx, hy] = hostPoint(host, ev);
    showTip(host, f.tip, hx, hy, `<b>${t} minutes</b><br>` + SER.map(([k, n]) => `<span class="t-sub">${n}</span> ${fmt1(DATA.budget[k][t])}%`).join('<br>'));
  });
  f.svg.addEventListener('mouseleave', () => { cross.setAttribute('opacity', 0); f.tip.style.opacity = 0; });
}

// ---------------------------------------------------------------- full results table
{
  const t = $('#results-table');
  const COLS = [
    ['rank', '#', m => m.rank, m => m.rank, 'rank'],
    ['name', 'Model', m => `<img class="logo" src="${LOGO(m.logo)}" alt="">${m.name}`, m => m.name, 'model'],
    ['harness', 'Harness', m => m.harness, m => m.harness, 'dim'],
    ['reasoning', 'Reasoning', m => m.reasoning, m => m.reasoning, 'dim'],
    ['pass', 'Pass ↑', m => `${fmt1(m.pass)}<span class="bar" style="width:${m.pass * 1.2}px"></span>`, m => m.pass, 'pass'],
    ['target', 'Target ↑', m => fmt1(m.target), m => m.target, ''],
    ['pres', 'Preserv. ↑', m => fmt1(m.pres), m => m.pres, ''],
    ['time', 'Time (min)', m => `${fmt1(m.time)} ± ${fmt1(m.time_sd)}`, m => m.time, ''],
    ['cost', 'Cost ($)', m => m.cost.toFixed(2), m => m.cost, ''],
  ];
  let key = 'pass', asc = false;
  const draw = () => {
    const col = COLS.find(c => c[0] === key), rows = [...MODELS].sort((a, b) => {
      const va = col[3](a), vb = col[3](b), d = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
      return (asc ? d : -d) || a.rank - b.rank;
    });
    t.innerHTML = '<thead><tr>' + COLS.map(c => `<th data-k="${c[0]}" class="${c[0] === key ? 'sorted' + (asc ? ' asc' : '') : ''}">${c[1]}</th>`).join('') + '</tr></thead><tbody>' +
      rows.map(m => `<tr class="${m.rank === 1 ? 'top' : ''}">` + COLS.map(c => `<td class="${c[4]}">${c[2](m)}</td>`).join('') + '</tr>').join('') + '</tbody>';
    $$('th', t).forEach(th => th.onclick = () => { const k = th.dataset.k; if (k === key) asc = !asc; else { key = k; asc = ['rank', 'name', 'harness', 'reasoning', 'time', 'cost'].includes(k); } draw(); });
  };
  draw();
}

// ---------------------------------------------------------------- dialog
const dlg = $('#dlg');
function openModal(title, body) { $('.dlg-title', dlg).textContent = title; const b = $('.dlg-body', dlg); b.innerHTML = ''; b.append(body); dlg.showModal(); }
$('.dlg-close').onclick = () => dlg.close();
dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
dlg.addEventListener('close', () => $$('video', dlg).forEach(v => v.pause()));

// ---------------------------------------------------------------- Focalboard walkthrough
{
  const SH = 1920, SV = 1200, F = n => asset(`media/focal/${n}.webp`);
  const STEPS = [
    { img: '01-login', who: 'owner', title: 'Log in as miraDunn', text: 'Log in as the board owner, miraDunn.', r: [730, 145, 465, 410], pt: [960, 360] },
    { img: '03-empty', who: 'owner', title: 'Create an empty board', text: 'Click <i>+ Add board</i>, then <i>Create empty board</i>.', r: [1150, 600, 380, 140], pt: [1335, 667] },
    { img: '05-owner-sidebar', who: 'owner', title: 'Name it', text: 'Name it <i>Q3 Launch Desk</i>. It appears in miraDunn’s own sidebar.', r: [0, 40, 700, 200] },
    { img: '06-share', who: 'owner', title: 'Open Share', text: 'Click <i>Share</i> to open the sharing dialog.', r: [655, 318, 610, 170], pt: [1840, 96] },
    { img: '08-select', who: 'owner', title: 'Add kadeRue', text: 'Search for <i>kadeRue</i> and add them.', r: [680, 380, 555, 160], pt: [835, 455] },
    { img: '09-member', who: 'owner', title: 'Confirm the member', text: 'kadeRue is now a member. From the owner’s side, sharing worked.', r: [660, 500, 600, 130] },
    { img: '12-logout', who: 'owner', title: 'Log out', text: 'Close the dialog and log out.', r: [0, 50, 245, 265], pt: [70, 218] },
    { img: '13-recipient-login', who: 'recip', title: 'Log in as kadeRue', text: 'Log in as the teammate, kadeRue, and refresh.', r: [730, 145, 465, 410], pt: [960, 360] },
    { verdict: true, who: 'recip', title: 'Check the sidebar', text: 'Check kadeRue’s sidebar. With the bug it says <i>No boards inside</i>; with the fix, the shared board is there.' },
  ];
  const walk = $('#walk'), list = $('.walk-steps', walk), view = $('.browser-view', walk), who = $('.who', walk), txt = $('.walk-text', walk);
  STEPS.forEach((s, i) => {
    const li = html('li', s.verdict ? 'verdict' : '');
    const b = html('button', '', `<span class="n">${s.verdict ? '?' : i + 1}</span>${s.title}`);
    b.setAttribute('role', 'tab'); b.onclick = () => go(i); li.append(b); list.append(li);
  });
  let cur = 0;
  const pct = (v, of) => (v / of * 100) + '%';
  function go(i) {
    cur = Math.max(0, Math.min(STEPS.length - 1, i));
    const s = STEPS[cur];
    $$('button', list).forEach((b, k) => b.setAttribute('aria-selected', k === cur));
    who.textContent = s.who === 'owner' ? 'miraDunn' : 'kadeRue'; who.className = 'who ' + s.who;
    txt.innerHTML = s.text;
    $('.walk-prev', walk).disabled = cur === 0; $('.walk-next', walk).disabled = cur === STEPS.length - 1;
    view.innerHTML = ''; $('.verdict-lenses', walk)?.remove();
    if (s.verdict) return verdict();
    shot(s.img, s.title, s.r, s.pt);
  }
  // a screenshot with a magnifier: the region, enlarged, centred on itself and kept inside the window
  function shot(name, alt, [rx, ry, rw, rh], pt) {
    $$('img.shot, .lens, .cur', view).forEach(n => n.remove());
    const img = html('img', 'shot'); img.src = F(name); img.alt = alt; view.prepend(img);
    const vw = view.clientWidth, vh = view.clientHeight, k0 = vw / SH;
    const z = Math.min(1.05, .66 * vw / rw, .6 * vh / rh);   // css px per screenshot px inside the lens
    const lw = rw * z, lh = rh * z;
    let lx = (rx + rw / 2) * k0 - lw / 2, ly = (ry + rh / 2) * k0 - lh / 2;
    lx = Math.max(10, Math.min(vw - lw - 10, lx)); ly = Math.max(10, Math.min(vh - lh - 10, ly));
    const lens = html('div', 'lens');
    Object.assign(lens.style, { left: lx + 'px', top: ly + 'px', width: lw + 'px', height: lh + 'px', backgroundImage: `url(${F(name)})`, backgroundSize: `${SH * z}px ${SV * z}px`, backgroundPosition: `${-rx * z}px ${-ry * z}px` });
    view.append(lens);
    if (pt) {
      const [px, py] = pt, inside = px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
      const c = html('img', 'cur'); c.src = asset('media/browser-agent-cursor.png'); c.alt = '';
      Object.assign(c.style, inside ? { left: lx + (px - rx) * z + 'px', top: ly + (py - ry) * z + 'px' } : { left: px * k0 + 'px', top: py * k0 + 'px' });
      view.append(c);
    }
  }
  let side = 'f';
  function verdict() {
    // the sidebar under a magnifier, with a toggle between the buggy build and the fixed one
    const seg = html('div', 'seg');
    const show = k => {
      side = k; $$('button', seg).forEach(b => b.classList.toggle('on', b.dataset.k === k));
      shot(k === 'f' ? '15-fail' : '16-pass', k === 'f' ? 'With the bug: the sidebar says No boards inside' : 'With the fix: Q3 Launch Desk is listed', [0, 150, 330, 150]);
    };
    for (const [k, label] of [['f', '✕ with the bug'], ['p', '✓ with the fix']]) {
      const b = html('button', k, label); b.type = 'button'; b.dataset.k = k; b.onclick = () => show(k); seg.append(b);
    }
    view.append(seg); show(side);
    const lenses = html('div', 'verdict-lenses');
    for (const [kind, img, label] of [['f', '15-fail', '<b>Fail.</b> kadeRue is a member, but the board never lands in the sidebar.'], ['p', '16-pass', '<b>Pass.</b> After the fix, the shared board is listed.']]) {
      const card = html('div', 'vlens ' + kind), crop = html('div', 'crop');
      card.append(crop, html('p', '', label));
      const rec = html('button', 'rec-btn ' + kind, '▶ watch the verifier’s run'); rec.type = 'button';
      rec.onclick = () => { const v = document.createElement('video'); v.src = asset(`media/focal/${kind === 'f' ? 'fail' : 'pass'}-recording.mp4`); v.controls = v.autoplay = v.muted = true; v.playsInline = true; openModal(kind === 'f' ? 'Verifier run on the buggy version (FAIL)' : 'Verifier run on the fixed version (PASS)', v); };
      card.append(rec); lenses.append(card);
      requestAnimationFrame(() => { const w = crop.clientWidth, z = w / 240; Object.assign(crop.style, { backgroundImage: `url(${F(img)})`, backgroundSize: `${SH * z}px ${SV * z}px`, backgroundPosition: `0px ${-171 * z}px` }); });
    }
    $('.walk-stage', walk).append(lenses);
  }
  $('.walk-prev', walk).onclick = () => go(cur - 1);
  $('.walk-next', walk).onclick = () => go(cur + 1);
  walk.addEventListener('keydown', e => { if (e.key === 'ArrowRight') go(cur + 1); if (e.key === 'ArrowLeft') go(cur - 1); });
  new ResizeObserver(() => go(cur)).observe(view);
  // fetch the other frames only once the walkthrough is close
  new IntersectionObserver(([e], o) => { if (!e.isIntersecting) return; o.disconnect(); for (const n of ['03-empty', '05-owner-sidebar', '06-share', '08-select', '09-member', '12-logout', '13-recipient-login', '15-fail', '16-pass']) new Image().src = F(n); }, { rootMargin: '400px 0px' }).observe(walk);
}

// ---------------------------------------------------------------- four agents, one empty sidebar
{
  const EVID = SB_DATA.focal_evidence;
  // what each excerpt is, marked with the paper figure's icons (and a legend under the four rows)
  const ICON = {
    act: '<path d="M4 2.5l8.5 5.2-3.9.9-1.9 3.7z"/>',
    out: '<rect x="1.5" y="2.5" width="13" height="11" rx="1.5"/><path d="M4.5 6l2.2 2-2.2 2M8.5 10.5h3"/>',
    say: '<path d="M2.5 3h11v7.5H7.5L4.5 13v-2.5h-2z"/>',
    edit: '<path d="M10.5 2.5l3 3-7.8 7.8H2.7v-3z"/>',
  };
  const KIND = { act: 'Browser action (Playwright code)', out: 'Browser output (page text in terminal)', say: 'Agent message or reasoning', edit: 'Code-edit tool call' };
  const icon = k => `<svg class="src" viewBox="0 0 16 16" aria-hidden="true">${ICON[k]}</svg>`;
  const AG = [
    { k: 'Fable', name: 'Claude Fable 5.1', logo: 'claude-color', ok: true, head: 'treated the empty sidebar as a bug and fixed it.', cards: [
      ['Joins an open board as Carol', '// carol: non-member visits open board URL', 'act'], ['Carol’s sidebar is empty', 'BOARDS No boards inside', 'out'],
      ['Learns the sidebar only lists boards in a category', '“the user’s default "Boards" category had an empty board list”', 'say'],
      ['Sees that joining a board never adds it to one', '“saved the membership but never filed the board into the member’s default category”', 'say'],
      ['Decides to fix it', '// the new member needs the board in their sidebar, so we add it … to their default category.', 'edit']] },
    { k: 'GLM', name: 'GLM 5.3', logo: 'zai', ok: true, head: 'flagged the empty sidebar as a bug right away and fixed it.', cards: [
      ['Opens board as the invited user', '“Try direct link.”', 'say'], ['Board opens, but sidebar is empty', 'No boards inside', 'out'],
      ['Immediately flags it as a bug', '“Sidebar no boards likely bug!”', 'say'], ['Traces it to AddMemberToBoard', '“AddMemberToBoard should add board to new user’s default category.”', 'say'],
      ['Decides to fix it', '“invited users are omitted from their sidebar category … I’m patching these”', 'say']] },
    { k: 'Opus', name: 'Claude Opus 5', logo: 'claude-color', ok: false, head: 'saw the empty sidebar but trusted the unit tests, so it left it unfixed.', cards: [
      ['Joins an open board as Carol', '// Step 2: carol (not a member) opens the board URL', 'act'], ['Sidebar still empty after joining', 'carol sidebar after: … BOARDS | No boards inside', 'out'],
      ['Trusts unit tests that never check the sidebar', '“unit tests use strict gomock expectations with no category call”', 'say'],
      ['So concludes the empty sidebar is intended', '“this is the intended behaviour of this version rather than a regression”', 'say'],
      ['Decides not to fix it', '“changing it would be a product decision, not a bug fix.”', 'say']] },
    { k: 'Astra', name: 'GPT-6 Astra', logo: 'openai', ok: false, head: 'saw the empty sidebar but pursued other bugs, so it left it unfixed.', cards: [
      ['Opens board as invited member', 'await memberPage.goto(boardUrl);', 'act'], ['Sidebar is empty; moves on without comment', 'No boards inside', 'out'],
      ['Focuses on the Share-dialog list instead', '“Adding a member currently leaves the sharing list unchanged”', 'say'],
      ['Finds a role-permissions bug', '“I confirmed a permissions bug”', 'say'], ['Decides to fix other bugs instead', '“I’ll isolate membership updates by board and make the UI honor the roles”', 'say']] },
  ];
  const host = $('#traj');
  for (const a of AG) {
    const row = html('div', 'traj-row');
    row.append(html('p', 'traj-head', `<img src="${LOGO(a.logo)}" alt=""><b>${a.name}</b> ${a.head} <span class="verdict ${a.ok ? 'ok' : 'no'}">${a.ok ? '✓ fixed' : '✗ unfixed'}</span>`));
    const flow = html('div', 'traj-flow');
    a.cards.forEach(([sum, quote, kind], i) => {
      const c = html('button', 'tcard' + (i === 1 ? ' seen' : '') + (i === 4 ? (a.ok ? ' ok' : ' no') : ''));
      c.type = 'button';
      c.innerHTML = `${sum}<span class="q${kind === 'act' || kind === 'out' || kind === 'edit' ? ' code' : ''}">${quote}${icon(kind)}</span>`;
      c.title = KIND[kind];
      c.onclick = () => { const e = EVID[`${a.k}-${i}`], pre = document.createElement('pre'); pre.textContent = e.text; openModal(`${a.name} · ${e.moment} · trajectory event ${e.event}`, pre); };
      flow.append(c);
    });
    row.append(flow); host.append(row);
  }
  host.append(html('p', 'traj-legend', Object.keys(KIND).map(k => `<span>${icon(k)}${KIND[k]}</span>`).join('')));
  // one band behind the second column: every agent got here
  const band = html('div', 'traj-band', '<span>all four saw this</span>'); host.prepend(band);
  const place = () => {
    const cards = $$('.traj-flow .tcard:nth-child(2)', host); if (!cards.length) return;
    const hr = host.getBoundingClientRect(), r0 = cards[0].getBoundingClientRect(), r1 = cards[cards.length - 1].getBoundingClientRect();
    Object.assign(band.style, { left: r0.left - hr.left - 8 + 'px', width: r0.width + 16 + 'px', top: r0.top - hr.top - 8 + 'px', height: r1.bottom - r0.top + 16 + 'px' });
  };
  place(); new ResizeObserver(place).observe(host);
  $$('.traj-flow', host).forEach(f => f.addEventListener('scroll', place));
}

// ---------------------------------------------------------------- animations
// Shots from the explainer video, drawn by its own renderer onto canvases in the page. Each shot
// stays inside one scene and loops while on screen: it plays, holds its last frame for a moment,
// dips softly to white and starts again (from the top each time it scrolls back into view).
// data-segs lists [from, to, speed, warpLine] stretches of video time played back to back (so idle
// gaps left for the narration can be skipped); warpLine squeezes that narration line's beats
// together (T_WARP in lib.js). data-wide-from holds the story's wide view from that video time on,
// instead of following the video's camera into close-ups.
// To keep scrolling smooth, only the most visible shot draws, at 15 fps, and never mid-scroll.
await bootAnim({ scenes: true });
// The sweep from the video's title scene, from a fixed camera, cropped to a strip around Claude and
// the bugs (closer on phones; the canvas aspect in style.css matches: 1920:380 wide, 1920:560 narrow).
// The name itself is page text; its two labels appear the first time the scene reaches those words.
const heroFrame = (t, narrow) => {
  RAW = t; TIME = Math.floor(t * STEP + 1e-6) / STEP;
  ctx.setTransform(SC_, 0, 0, SC_, 0, 0); ctx.fillStyle = PAL.bg; ctx.fillRect(0, 0, W, H);
  ctx.save(); applyCam(narrow ? [P1[0] + 950, 1017, 1.6] : [P1[0] + 960, 1180, 1]); title(TIME); ctx.restore();
  const h1 = $('h1.title');
  if (t >= T('l07', 'Software')) h1.classList.add('show-swe');   // the labels write in once and stay while the sweep loops
  if (t >= T('l07', 'with')) h1.classList.add('show-broom');
};
const SHOTS = $$('.anim').map(el => {
  const cv = document.createElement('canvas'); el.append(cv);
  const hero = el.dataset.shot === 'hero';
  const segs = (hero ? [[T('l07', 'Sweeper'), T('l07', 'with') + 2.6]] : JSON.parse(el.dataset.segs))
    .map(([f, t, sp = 1, warp]) => ({ f, t, sp, len: (t - f) / sp,
      warp: warp && { id: warp, at: f + .3, from: LINE(warp).start, k: .12 } }));
  return { el, cv, g: cv.getContext('2d'), hero, ratio: 0, t: 0, drawn: -1, segs, len: segs.reduce((n, s) => n + s.len, 0),
    wide: el.dataset.wideFrom === undefined ? Infinity : +el.dataset.wideFrom };
});
const HOLD = 1.2, FADE = .35;   // seconds on the last frame before looping, and the dip at the seam
const drawShot = a => {
  ctx = a.g; DPR_ = a.cv.width / Math.max(1, a.cv.clientWidth); SC_ = a.cv.width / W;
  const cyc = a.len + HOLD, local = a.t % cyc;
  let rest = Math.min(local, a.len), s = a.segs[0];
  for (s of a.segs) { if (rest <= s.len) break; rest -= s.len; }
  const vt = s.f + Math.min(rest, s.len) * s.sp;
  T_WARP = s.warp;
  if (a.hero) heroFrame(vt, a.cv.clientWidth < 560); else renderAt(vt, { captions: false, cam: vt >= a.wide ? [960, 540, 1] : undefined });
  T_WARP = null;
  const dip = Math.max(a.t >= cyc ? 1 - local / FADE : 0, (local - (cyc - FADE)) / FADE, 0);   // no fade-in on the first play
  if (dip > 0) { ctx.setTransform(SC_, 0, 0, SC_, 0, 0); ctx.fillStyle = `rgba(255,255,255,${dip})`; ctx.fillRect(0, 0, W, H); }
  a.drawn = a.t;
};
const sizeShot = a => {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  a.cv.width = Math.round(a.cv.clientWidth * dpr); a.cv.height = Math.round(a.cv.clientHeight * dpr);
  if (a.cv.width) drawShot(a);
};
const shotIO = new IntersectionObserver(es => {
  for (const e of es) {
    const a = SHOTS.find(x => x.el === e.target);
    a.ratio = e.isIntersecting ? e.intersectionRatio : 0;
    if (!e.isIntersecting && a.t > 0) { a.t = 0; a.drawn = -1; }   // replay from the top next time
  }
}, { threshold: [0, .2, .4, .6, .8, 1] });
SHOTS.forEach(a => { new ResizeObserver(() => sizeShot(a)).observe(a.el); shotIO.observe(a.el); });
let lastScroll = 0, prev = performance.now();
addEventListener('scroll', () => { lastScroll = performance.now(); }, { passive: true });
const shotTick = now => {
  requestAnimationFrame(shotTick);
  const dt = Math.min(.1, (now - prev) / 1000); prev = now;
  if (document.hidden || now - lastScroll < 150) return;
  const a = SHOTS.reduce((best, x) => (x.ratio >= .4 && x.ratio > (best?.ratio ?? 0)) ? x : best, null);
  if (!a || !a.cv.width) return;
  a.t += dt;
  if (a.drawn < 0 || Math.floor(a.t * 15) !== Math.floor(a.drawn * 15)) drawShot(a);
};
requestAnimationFrame(shotTick);

// ---------------------------------------------------------------- small things
$('.bib .copy').onclick = async e => { await navigator.clipboard.writeText($('.bib code').textContent); e.target.textContent = 'copied ✓'; setTimeout(() => e.target.textContent = 'copy', 1600); };
$$('[data-todo]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); a.title = 'coming soon'; }));
})();

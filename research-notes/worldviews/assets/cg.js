'use strict';

// Worldviews: do language models see the world the way these people do?
//   #/            overview: example question, overall results, results by area, people directory
//   #/p/<id>[/q]  one person: model scores, questions with each model's answer and per-idea verdicts
//   #/about       method and caveats
(() => {
  const main = document.getElementById('main');
  const tip = document.getElementById('tip');
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const rate = s => s && s.total ? 100 * s.passed / s.total : 0;
  const pct = v => `${v.toFixed(1)}%`;
  const plural = (n, w, pl) => `${fmt(n)} ${n === 1 ? w : pl || `${w}s`}`;
  const short = name => name.replace(/\s*\(.*\)/, '');
  const build = document.documentElement.dataset.build || '';
  const cache = new Map();
  const fetchJSON = path => {
    const url = build ? `${path}?v=${build}` : path;
    if (!cache.has(url)) cache.set(url, fetch(url).then(r => {
      if (!r.ok) throw Error(`Could not load ${path} (${r.status}).`);
      return r.json();
    }).catch(e => {cache.delete(url); throw e;}));
    return cache.get(url);
  };
  const PAGE = 25;
  let D, byId, catName;
  const dir = {query: '', cat: 'all', sort: 'category'};
  let person = null;  // {meta, data, query, topic, outcome, order, shown}
  let example = 0;

  // ---- small shared pieces ------------------------------------------------------------------
  const initials = name => short(name).split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('');
  const photo = (p, size, cls = '') => p.image
    ? `<img class="ph ${cls}" src="${esc(p.image)}" alt="" width="${size}" height="${size}" loading="lazy" decoding="async">`
    : `<span class="ph initials ${cls}" style="width:${size}px;height:${size}px;font-size:${Math.round(size * .38)}px" aria-hidden="true">${esc(initials(p.name))}</span>`;
  const color = m => D.providers[m.provider].color;
  const latest = p => p.episodes.reduce((a, e) => (e.date || '') > a ? e.date : a, '');
  const best = p => Math.max(0, ...Object.values(p.scores || {}));
  const modelsOf = () => (person && person.data.models) || D.models;
  const dot = m => `<i class="dot" style="--c:${color(m)}"></i>`;
  const tipAttr = html => `data-tip="${esc(html)}"`;

  // Four thin bars, one per model, in the fixed model order: a compact "how each model did" glyph.
  function minibars(scores, label) {
    return `<span class="minibars" role="img" aria-label="${esc(label)}: ${D.models.map(m => `${m.name} ${(scores[m.id] ?? 0).toFixed(0)}%`).join(', ')}">${
      D.models.map(m => `<span class="mb" style="--c:${color(m)}"><span style="width:${Math.max(scores[m.id] ?? 0, 1.5)}%"></span></span>`).join('')}</span>`;
  }

  function board(models, stats, note) {
    const rows = [...models].filter(m => stats[m.id]?.total).sort((a, b) => rate(stats[b.id]) - rate(stats[a.id]));
    return `<ol class="board">${rows.map((m, i) => {
      const s = stats[m.id];
      return `<li class="brow" ${tipAttr(`<b>${esc(m.name)}</b> · ${esc(D.providers[m.provider].name)}, ${esc(m.effort)} effort<br>${fmt(s.passed)} of ${fmt(s.total)} ideas matched`)}>
        <span class="rank">${i + 1}</span>
        <span class="bname">${dot(m)}${esc(m.name)}<small>${esc(D.providers[m.provider].name)} · ${esc(m.effort)} effort</small></span>
        <span class="bar" aria-hidden="true"><span style="width:${rate(s)}%;--c:${color(m)}"></span></span>
        <span class="bval">${pct(rate(s))}</span></li>`;
    }).join('')}</ol>${note ? `<p class="fine">${note}</p>` : ''}`;
  }

  // ---- overview -------------------------------------------------------------------------------
  function renderHome() {
    document.title = 'Worldviews · Do language models see the world the way these people do?';
    const T = D.totals;
    const top = [...D.models].sort((a, b) => rate(D.overall[b.id]) - rate(D.overall[a.id]))[0];
    main.innerHTML = `
      <section class="hero">
        <p class="kicker">Research note · Updated November 2026</p>
        <h1>Do language models see the world the way <em>these ${fmt(T.people)} people</em> do?</h1>
        <p class="lede">We turned long-form podcast interviews into ${fmt(T.questions)} standalone questions about how each person sees a person, paper, method or event, answered in their own words. Each answer is broken into the specific ideas a model would need to come up with to answer the way they did. Even the best model, ${esc(top.name)}, matches only ${pct(rate(D.overall[top.id]))} of them.</p>
        <dl class="stats">
          <div><dt>people</dt><dd>${fmt(T.people)}</dd></div>
          <div><dt>questions</dt><dd>${fmt(T.questions)}</dd></div>
          <div><dt>ideas to match</dt><dd>${fmt(T.rubrics)}</dd></div>
          <div><dt>models tested</dt><dd>${D.models.length}</dd></div>
        </dl>
      </section>
      <section class="example" id="example" aria-label="An example question"></section>
      <section class="section results" aria-labelledby="results-h">
        <div class="two">
          <div>
            <div class="section-head"><h2 id="results-h">How the models did</h2>
              <p>Share of all ${fmt(D.overall[top.id].total)} ideas each model came up with when asked the question as the person, with only a one-line introduction.</p></div>
            ${board(D.models, D.overall, `Judge: ${esc(D.judge.name)}, which never sees the person's real answer. ${D.excluded} questions a model refused are left out for every model. <a href="#/about">Method</a>`)}
          </div>
          <div>
            <div class="section-head"><h2>By area</h2><p>Which kinds of people are easiest and hardest to match.</p></div>
            ${areaTable()}
          </div>
        </div>
      </section>
      <section class="section people" aria-labelledby="people-h">
        <div class="section-head"><h2 id="people-h">People</h2><p>Pick anyone to see their questions, their own answers, and how each model did.</p></div>
        <div class="toolbar">
          <div class="tool-row">
            <label class="field"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>
              <input id="dq" type="search" placeholder="Search by name, title or show" aria-label="Search people" value="${esc(dir.query)}"></label>
            <label class="select"><span>Sort</span><select id="dsort" aria-label="Sort people">
              ${[['category', 'By area'], ['name', 'Name A–Z'], ['hardest', 'Hardest to match'], ['easiest', 'Easiest to match'], ['questions', 'Most questions'], ['recent', 'Most recent episode']]
                .map(([v, l]) => `<option value="${v}" ${dir.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          </div>
          <div class="chips" role="group" aria-label="Area">
            <button class="chip" data-cat="all" aria-pressed="${dir.cat === 'all'}">All<span>${fmt(T.people)}</span></button>
            ${D.categories.map(c => `<button class="chip" data-cat="${c.id}" aria-pressed="${dir.cat === c.id}">${esc(c.name)}<span>${c.count}</span></button>`).join('')}
          </div>
          <div class="legend-line">${D.models.map(m => `<span>${dot(m)}${esc(m.name)}</span>`).join('')}<span class="muted">bars show each model's match rate for that person</span></div>
        </div>
        <div id="dcount" class="count-line" aria-live="polite"></div>
        <div id="dgrid"></div>
      </section>`;
    renderExample();
    renderGrid();
    const q = document.getElementById('dq');
    q.addEventListener('input', () => {dir.query = q.value; renderGrid();});
    document.getElementById('dsort').addEventListener('change', e => {dir.sort = e.target.value; renderGrid();});
    main.querySelectorAll('[data-cat]').forEach(b => b.addEventListener('click', () => {
      dir.cat = b.dataset.cat;
      main.querySelectorAll('[data-cat]').forEach(x => x.setAttribute('aria-pressed', x === b));
      renderGrid();
    }));
    window.scrollTo(0, 0);
  }

  function areaTable() {
    const rows = D.categories.filter(c => D.byArea[c.id]);
    const vals = rows.flatMap(c => D.models.map(m => rate(D.byArea[c.id][m.id])));
    const lo = Math.min(...vals), hi = Math.max(...vals);
    // Sequential single-hue ramp (light -> dark forest); every cell also prints its value.
    const shade = v => {
      const t = hi > lo ? (v - lo) / (hi - lo) : .5;
      const l = 95 - t * 52;
      return `background:hsl(140 22% ${l}%);color:${l < 62 ? '#f6f4ee' : '#22352d'}`;
    };
    return `<div class="heat" role="table" aria-label="Match rate by area and model">
      <div class="hrow head" role="row"><span role="columnheader">Area</span>${D.models.map(m => `<span role="columnheader">${dot(m)}${esc(m.name)}</span>`).join('')}</div>
      ${rows.map(c => `<button class="hrow" role="row" data-area="${c.id}" ${tipAttr(`${esc(c.name)} · ${c.count} people`)}>
        <span role="rowheader">${esc(c.name)}</span>${D.models.map(m => {
          const v = rate(D.byArea[c.id][m.id]);
          return `<span role="cell" class="hc" style="${shade(v)}">${v.toFixed(0)}%</span>`;
        }).join('')}</button>`).join('')}</div>
      <p class="fine">Click an area to list its people.</p>`;
  }

  function renderExample() {
    const el = document.getElementById('example');
    if (!el || !D.featured.length) return;
    const f = D.featured[example % D.featured.length], p = byId.get(f.person);
    el.innerHTML = `<div class="ex-card">
      <div class="ex-head"><span class="kicker">Random example · one question, one person, four models</span>
        <button class="ghost dice-btn" id="ex-next" aria-label="Show a random example"><svg class="dice" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.5" cy="8.5" r="1.4"/><circle cx="15.5" cy="8.5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="8.5" cy="15.5" r="1.4"/><circle cx="15.5" cy="15.5" r="1.4"/></svg>Random example</button></div>
      <div class="ex-grid">
        <div class="ex-left">
          <a class="who" href="#/p/${encodeURIComponent(p.id)}">${photo(p, 44)}<span><b>${esc(p.name)}</b><small>${esc(p.description)}</small></span></a>
          <p class="ex-q">${esc(f.question)}</p>
          <blockquote class="ex-a">${esc(f.answer)}</blockquote>
        </div>
        <div class="ex-right">
          <p class="label">The ideas in ${esc(short(p.name))}'s answer, and which models came up with them</p>
          ${matrix(f.rubrics, D.models)}
          <a class="more-link" href="#/p/${encodeURIComponent(p.id)}/${encodeURIComponent(f.id)}">Read every model's answer →</a>
        </div>
      </div></div>`;
    document.getElementById('ex-next').addEventListener('click', e => {
      const n = D.featured.length;  // a different random example each roll
      if (n > 1) example = (example + 1 + Math.floor(Math.random() * (n - 1))) % n;
      e.currentTarget.querySelector('.dice').classList.remove('roll');
      renderExample();
      document.querySelector('#ex-next .dice')?.classList.add('roll');
    });
  }

  // Ideas x models grid: a check where the judge said the model's answer contains the idea.
  function matrix(rubrics, models) {
    return `<table class="matrix"><thead><tr><th scope="col"><span class="sr">Idea</span></th>${models.map(m => `<th scope="col" ${tipAttr(esc(m.name))}><span class="mh" style="--c:${color(m)}">${esc(m.name.split(' ')[0])}</span></th>`).join('')}</tr></thead>
      <tbody>${rubrics.map((r, i) => `<tr><th scope="row"><span class="n">${i + 1}</span>${esc(r.text.replace(/^The response /, ''))}</th>${models.map(m => {
        const v = r.passes?.[m.id];
        return `<td class="${v ? 'yes' : 'no'}" aria-label="${esc(m.name)}: ${v ? 'matched' : 'missed'}">${v ? '<span class="tick">✓</span>' : '<span class="miss">–</span>'}</td>`;
      }).join('')}</tr>`).join('')}</tbody></table>`;
  }

  function matchesDir(p) {
    const q = dir.query.trim().toLowerCase();
    if (dir.cat !== 'all' && p.category !== dir.cat) return false;
    return !q || `${p.name} ${p.description} ${catName[p.category] || ''} ${p.episodes.map(e => e.show).join(' ')}`.toLowerCase().includes(q);
  }

  function card(p) {
    return `<a class="pcard" href="#/p/${encodeURIComponent(p.id)}">${photo(p, 52)}
      <span class="pbody"><span class="pname">${esc(p.name)}</span><span class="pdesc">${esc(p.description)}</span>
      <span class="pmeta">${minibars(p.scores || {}, `${p.name}, match rate by model`)}<span>${plural(p.questions, 'question')}</span></span></span></a>`;
  }

  function renderGrid() {
    const list = D.people.filter(matchesDir);
    const byName = (a, b) => a.name.localeCompare(b.name);
    const sorters = {name: byName, questions: (a, b) => b.questions - a.questions || byName(a, b),
                     hardest: (a, b) => best(a) - best(b) || byName(a, b), easiest: (a, b) => best(b) - best(a) || byName(a, b),
                     recent: (a, b) => latest(b).localeCompare(latest(a)) || byName(a, b)};
    let html;
    if (dir.sort === 'category') {
      html = D.categories.map(c => {
        const members = list.filter(p => p.category === c.id).sort(byName);
        return members.length ? `<div class="group-head"><h3>${esc(c.name)}</h3><span>${plural(members.length, 'person', 'people')}</span></div>
          <div class="grid">${members.map(card).join('')}</div>` : '';
      }).join('');
    } else {
      html = `<div class="grid">${[...list].sort(sorters[dir.sort]).map(card).join('')}</div>`;
    }
    document.getElementById('dgrid').innerHTML = list.length ? html : '<div class="empty">No one matches. Try another name or area.</div>';
    document.getElementById('dcount').textContent = list.length === D.people.length ? '' :
      `${list.length} of ${D.people.length} people · ${fmt(list.reduce((n, p) => n + p.questions, 0))} questions`;
  }

  // ---- person ---------------------------------------------------------------------------------
  async function renderPerson(id, focus) {
    const meta = byId.get(id);
    if (!meta) {main.innerHTML = '<div class="empty">Person not found. <a href="#/">See everyone</a></div>'; return;}
    document.title = `${short(meta.name)} · Worldviews`;
    if (!person || person.meta.id !== id) {
      main.innerHTML = `<a class="back" href="#/">← All people</a><div class="loading">Loading ${esc(meta.name)}…</div>`;
      let data;
      try {data = await fetchJSON(`data/people/${encodeURIComponent(id)}.json`);}
      catch (e) {main.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return;}
      person = {meta, data, query: '', topic: 'all', outcome: 'all', order: 'interview', shown: PAGE};
    }
    const p = person.meta, data = person.data, models = modelsOf();
    const name = short(p.name);
    main.innerHTML = `
      <a class="back" href="#/">← All people</a>
      <section class="profile">
        ${photo(p, 120, 'big')}
        <div class="pinfo">
          <p class="kicker">${esc(catName[p.category] || '')}</p>
          <h1>${esc(p.name)}</h1><p class="role">${esc(p.description)}</p>
          <p class="facts">${plural(p.questions, 'question')} · ${plural(p.rubrics, 'idea')} · from ${p.episodes.map(e => `<a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.show)}${e.date ? `, ${esc(e.date.slice(0, 4))}` : ''} ↗</a>`).join(', ')}</p>
        </div>
        <div class="scorebox"><div class="scorecard" id="scorecard" aria-live="polite" aria-label="Match rate by model"></div><p class="sc-note" id="sc-note"></p></div>
      </section>
      <section class="section" aria-labelledby="q-h">
        <div class="section-head"><h2 id="q-h">Questions</h2>
          <p>Each answer is ${esc(name)}'s own reply in the interview, lightly cleaned. Open a question to see which of its ideas each model came up with, and read every model's answer.</p></div>
        <div class="qtools">
          <label class="field"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>
            <input id="qq" type="search" placeholder="Search questions, answers and ideas" aria-label="Search questions"></label>
          <label class="select"><span>Show</span><select id="qout">
            <option value="all">All questions</option><option value="none">No model matched anything</option>
            <option value="split">Models disagree</option><option value="all-pass">Every model matched everything</option></select></label>
          <label class="select"><span>Order</span><select id="qord">
            <option value="interview">Interview order</option><option value="hardest">Hardest first</option><option value="easiest">Easiest first</option></select></label>
        </div>
        ${data.topics ? `<div class="topicbar"><span class="label">Topics</span><div class="chips topics" role="group" aria-label="Topic"><button class="chip" data-topic="all" aria-pressed="true">All<span>${data.items.length}</span></button>${data.topics.filter(t => t.count).map(t => `<button class="chip" data-topic="${esc(t.id)}" aria-pressed="false" ${t.description ? tipAttr(esc(t.description)) : ''}>${esc(t.name)}<span>${t.count}</span></button>`).join('')}</div></div>` : ''}
        <p class="count-line" id="qcount" aria-live="polite"></p>
        <div class="qlist" id="qlist"></div>
      </section>`;
    renderQuestions();
    const on = (id, ev, fn) => document.getElementById(id).addEventListener(ev, fn);
    on('qq', 'input', e => {person.query = e.target.value; person.shown = PAGE; renderQuestions();});
    on('qout', 'change', e => {person.outcome = e.target.value; person.shown = PAGE; renderQuestions();});
    on('qord', 'change', e => {person.order = e.target.value; person.shown = PAGE; renderQuestions();});
    main.querySelectorAll('[data-topic]').forEach(b => b.addEventListener('click', () => {
      person.topic = b.dataset.topic; person.shown = PAGE;
      main.querySelectorAll('[data-topic]').forEach(x => x.setAttribute('aria-pressed', x === b));
      renderQuestions();
    }));
    window.scrollTo(0, 0);
    if (focus) openItem(focus);
  }

  const itemScores = it => Object.fromEntries(modelsOf().map(m =>
    [m.id, 100 * it.rubrics.filter(r => r.passes?.[m.id]).length / Math.max(1, it.rubrics.length)]));
  const itemMean = it => {const s = Object.values(itemScores(it)); return s.reduce((a, b) => a + b, 0) / s.length;};

  function itemMatches(it) {
    if (person.topic !== 'all' && it.topic !== person.topic) return false;
    const s = Object.values(itemScores(it));
    if (person.outcome === 'none' && s.some(v => v > 0)) return false;
    if (person.outcome === 'all-pass' && s.some(v => v < 100)) return false;
    if (person.outcome === 'split' && Math.max(...s) - Math.min(...s) < 1) return false;
    const q = person.query.trim().toLowerCase();
    return !q || [it.question, it.object, it.answer, ...it.rubrics.map(r => r.text)].join(' ').toLowerCase().includes(q);
  }

  // Score cards follow the filters: match rate over the questions currently shown.
  function renderScores(list) {
    const el = document.getElementById('scorecard');
    if (!el) return;
    const models = modelsOf(), filtered = list.length !== person.data.items.length;
    const stats = Object.fromEntries(models.map(m => [m.id, {
      passed: list.reduce((n, it) => n + it.rubrics.filter(r => r.passes?.[m.id]).length, 0),
      total: list.reduce((n, it) => n + it.rubrics.length, 0)}]));
    el.innerHTML = [...models].sort((a, b) => rate(stats[b.id]) - rate(stats[a.id])).map(m => `<div class="sc" ${tipAttr(`${esc(m.name)}: ${fmt(stats[m.id].passed)} of ${fmt(stats[m.id].total)} ideas`)}>
      <span class="sc-v">${stats[m.id].total ? rate(stats[m.id]).toFixed(0) : '–'}<small>%</small></span><span class="sc-n">${dot(m)}${esc(m.name)}</span></div>`).join('');
    const topic = person.data.topics?.find(t => t.id === person.topic);
    document.getElementById('sc-note').innerHTML = filtered
      ? `Match rate on the <b>${fmt(list.length)}</b> question${list.length === 1 ? '' : 's'} shown${topic ? ` in <b>${esc(topic.name)}</b>` : ''}`
      : `Match rate on all ${fmt(list.length)} questions`;
  }

  function renderQuestions() {
    let list = person.data.items.filter(itemMatches);
    renderScores(list);
    if (person.order !== 'interview') {
      const sign = person.order === 'hardest' ? 1 : -1;
      list = [...list].sort((a, b) => sign * (itemMean(a) - itemMean(b)));
    }
    const shown = list.slice(0, person.shown);
    document.getElementById('qlist').innerHTML = shown.map(it => `<details class="q" id="q-${esc(it.id)}" data-item="${esc(it.id)}">
        <summary><span class="qmain"><span class="qtext">${esc(it.question)}</span><span class="qobj">${esc(it.object)}</span></span>
          <span class="qside">${minibars(itemScores(it), 'Ideas matched by model')}<span class="qcount">${plural(it.rubrics.length, 'idea')}</span>
          <span class="chev" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m6 9 6 6 6-6"/></svg></span></span></summary>
        <div class="qbody"></div></details>`).join('')
      + (list.length > shown.length ? `<button class="more-btn" id="qmore">Show ${Math.min(PAGE, list.length - shown.length)} more <span>of ${fmt(list.length - shown.length)}</span></button>` : '')
      || '<div class="empty">No questions match.</div>';
    document.getElementById('qcount').textContent = `${fmt(list.length)} of ${fmt(person.data.items.length)} questions`;
    document.getElementById('qmore')?.addEventListener('click', () => {person.shown += PAGE; renderQuestions();});
    document.querySelectorAll('#qlist details.q').forEach(d => d.addEventListener('toggle', () => {
      if (d.open) fillItem(d);
      history.replaceState(null, '', `#/p/${encodeURIComponent(person.meta.id)}${d.open ? `/${encodeURIComponent(d.dataset.item)}` : ''}`);
    }));
  }

  function fillItem(d) {
    const body = d.querySelector('.qbody');
    if (body.dataset.filled) return;
    body.dataset.filled = '1';
    const it = person.data.items.find(x => x.id === d.dataset.item), models = modelsOf();
    const name = short(person.meta.name);
    body.innerHTML = `<div class="qgrid">
        <div><p class="label">${esc(name)}'s answer</p><blockquote class="answer">${esc(it.answer)}</blockquote>
          <details class="sub"><summary>Supporting quotes from the transcript (${it.quotes.length})</summary><ul class="quotes">${it.quotes.map(q => `<li>“${esc(q)}”</li>`).join('')}</ul></details></div>
        <div><p class="label">Ideas, and which models came up with them</p>${matrix(it.rubrics, models)}</div>
      </div>
      <div class="answers"><p class="label">What each model answered</p>
        <div class="tabs" role="tablist">${models.map((m, i) => {
          const n = it.rubrics.filter(r => r.passes?.[m.id]).length;
          return `<button role="tab" class="tab" data-model="${m.id}" aria-selected="${i === 0}">${dot(m)}${esc(m.name)}<span>${n}/${it.rubrics.length}</span></button>`;
        }).join('')}</div>
        <div class="tabpanel" role="tabpanel"><div class="loading">Loading answers…</div></div></div>`;
    loadAnswers(body, it);
  }

  async function loadAnswers(body, it) {
    const panel = body.querySelector('.tabpanel');
    let detail;
    try {detail = await fetchJSON(`data/answers/${encodeURIComponent(it.id)}.json`);}
    catch (e) {panel.innerHTML = `<div class="loading">${esc(e.message)}</div>`; return;}
    const show = mid => {
      const a = detail.models[mid], m = modelsOf().find(x => x.id === mid);
      body.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', t.dataset.model === mid));
      panel.innerHTML = !a ? '<p class="fine">Not run.</p>' : `
        <div class="mans">${esc(a.text)}</div>
        <ol class="verdicts">${it.rubrics.map((r, i) => {
          const j = a.judgments[r.id];
          return j ? `<li class="${j.pass ? 'yes' : 'no'}"><span class="vb">${j.pass ? '✓ matched' : '– missed'}</span><span><b>Idea ${i + 1}.</b> ${esc(j.rationale)}</span></li>` : '';
        }).join('')}</ol>
        <p class="fine">${esc(m.name)} saw only a one-line host introduction and this question, and answered as ${esc(short(person.meta.name))} at ${esc(m.effort)} effort with no tools. The judge's notes explain each verdict.</p>`;
    };
    body.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => show(t.dataset.model)));
    show(modelsOf()[0].id);
  }

  function openItem(itemId) {
    const idx = person.data.items.findIndex(x => x.id === itemId);
    if (idx < 0) return;
    if (idx >= person.shown) {person.shown = idx + 1; renderQuestions();}
    const d = document.getElementById(`q-${itemId}`);
    if (d) {d.open = true; d.scrollIntoView({block: 'start'});}
  }

  // ---- method ---------------------------------------------------------------------------------
  function renderAbout() {
    document.title = 'Method · Worldviews';
    const steps = ['Pick each person\'s best recent long-form interview', 'Clean the transcript, keeping their words',
                   'Write standalone questions answered in their own words', 'Break each answer into the ideas that make it theirs',
                   'Ask models the question as that person', 'Judge which ideas each model came up with'];
    main.innerHTML = `<a class="back" href="#/">← All people</a><section class="about"><p class="kicker">Method</p><h1>How Worldviews works</h1>
      <ol class="steps">${steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
      ${D.about.map(p => `<p>${esc(p)}</p>`).join('')}</section>`;
    window.scrollTo(0, 0);
  }

  // ---- find-a-person typeahead (press / anywhere) ---------------------------------------------
  function setupJump() {
    const input = document.getElementById('jump'), list = document.getElementById('jump-list');
    let hits = [], sel = 0;
    const close = () => {list.hidden = true; input.setAttribute('aria-expanded', 'false');};
    const draw = () => {
      list.innerHTML = hits.map((p, i) => `<li role="option" id="jo-${i}" aria-selected="${i === sel}" data-id="${esc(p.id)}">${photo(p, 30)}<span>${esc(p.name)}<small>${esc(p.description)}</small></span></li>`).join('');
      list.hidden = !hits.length; input.setAttribute('aria-expanded', String(!!hits.length));
      if (hits.length) input.setAttribute('aria-activedescendant', `jo-${sel}`);
    };
    const go = id => {close(); input.value = ''; input.blur(); location.hash = `#/p/${encodeURIComponent(id)}`;};
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      hits = q ? D.people.filter(p => `${p.name} ${p.description}`.toLowerCase().includes(q))
        .sort((a, b) => (b.name.toLowerCase().startsWith(q) - a.name.toLowerCase().startsWith(q)) || a.name.localeCompare(b.name)).slice(0, 8) : [];
      sel = 0; draw();
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') {sel = Math.min(sel + 1, hits.length - 1); draw(); e.preventDefault();}
      else if (e.key === 'ArrowUp') {sel = Math.max(sel - 1, 0); draw(); e.preventDefault();}
      else if (e.key === 'Enter' && hits[sel]) go(hits[sel].id);
      else if (e.key === 'Escape') {close(); input.blur();}
    });
    list.addEventListener('mousedown', e => {const li = e.target.closest('li'); if (li) go(li.dataset.id);});
    input.addEventListener('blur', () => setTimeout(close, 120));
    document.addEventListener('keydown', e => {
      if (e.key === '/' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) {e.preventDefault(); input.focus();}
    });
  }

  // ---- tooltip and area shortcut ---------------------------------------------------------------
  document.addEventListener('mousemove', e => {
    const el = e.target.closest?.('[data-tip]');
    if (!el) {tip.hidden = true; return;}
    tip.innerHTML = el.dataset.tip; tip.hidden = false;
    tip.style.left = `${Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8)}px`;
    tip.style.top = `${e.clientY + 16}px`;
  });
  document.addEventListener('click', e => {
    const row = e.target.closest?.('[data-area]');
    if (!row) return;
    dir.cat = row.dataset.area; dir.sort = 'name';
    renderHome();
    document.querySelector('.people')?.scrollIntoView({block: 'start'});
  });

  // ---- routing ---------------------------------------------------------------------------------
  function route() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
    if (parts[0] === 'p' && parts[1]) return renderPerson(parts[1], parts[2]);
    if (parts[0] === 'about') return renderAbout();
    person = null;
    renderHome();
  }

  fetchJSON('data/index.json').then(index => {
    D = index;
    byId = new Map(D.people.map(p => [p.id, p]));
    catName = Object.fromEntries(D.categories.map(c => [c.id, c.name]));
    example = Math.floor(Math.random() * Math.max(1, D.featured.length));
    setupJump();
    window.addEventListener('hashchange', () => {
      const parts = location.hash.replace(/^#\/?/, '').split('/');
      if (parts[0] === 'p' && person && decodeURIComponent(parts[1]) === person.meta.id && document.getElementById('qlist')) {
        if (parts[2]) openItem(decodeURIComponent(parts[2]));
        return;
      }
      route();
    });
    route();
  }).catch(e => {main.innerHTML = `<div class="empty">${esc(e.message)}</div>`;});
})();

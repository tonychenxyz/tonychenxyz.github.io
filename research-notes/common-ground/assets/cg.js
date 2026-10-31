'use strict';

// Common Ground: standalone questions about how people see the world, answered in their own words.
//   #/            directory of people (search, category, sort)
//   #/p/<id>      one person's questions; evaluated people also show model results
//   #/about       method and caveats
(() => {
  const main = document.getElementById('main');
  const tip = document.getElementById('tip');
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const fmt = n => n.toLocaleString('en-US');
  const rate = s => s && s.total ? 100 * s.passed / s.total : 0;
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
  const PAGE = 30;
  let D, byId, catName;
  const dir = {query: '', cat: 'all', sort: 'category', evalOnly: false};
  let person = null;  // {meta, data, query, topic, shown}

  const initials = name => name.replace(/\(.*\)/, '').split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('');
  const photo = (p, size) => p.image
    ? `<img class="ph" src="${esc(p.image)}" alt="" width="${size}" height="${size}" loading="lazy" decoding="async">`
    : `<span class="ph initials" style="width:${size}px;height:${size}px" aria-hidden="true">${esc(initials(p.name))}</span>`;
  const latest = p => p.episodes.reduce((a, e) => (e.date || '') > a ? e.date : a, '');
  const plural = (n, w) => `${fmt(n)} ${w}${n === 1 ? '' : 's'}`;

  // ---- directory ------------------------------------------------------------------------------
  function matchesDir(p) {
    const q = dir.query.trim().toLowerCase();
    if (dir.cat !== 'all' && p.category !== dir.cat) return false;
    if (dir.evalOnly && !p.evaluated) return false;
    return !q || `${p.name} ${p.description} ${catName[p.category] || ''} ${p.episodes.map(e => e.show).join(' ')}`.toLowerCase().includes(q);
  }

  function card(p) {
    return `<a class="pcard" href="#/p/${encodeURIComponent(p.id)}">${photo(p, 56)}
      <span class="pbody"><span class="pname">${esc(p.name)}</span><span class="pdesc">${esc(p.description)}</span>
      <span class="pmeta">${plural(p.questions, 'question')}${p.evaluated ? '<span class="evalbadge">Model results</span>' : ''}</span></span></a>`;
  }

  function renderDirectory() {
    document.title = 'Common Ground · How do these people see the world?';
    const T = D.totals;
    main.innerHTML = `
      <section class="hero">
        <div><p class="kicker">Research note · October 2026</p>
          <h1>How do these <em>${fmt(T.people)}</em> people see the world?</h1>
          <p class="lede">Each question asks how one person sees a person, paper, method or event, and is answered in their own words from a long-form podcast interview. Every answer comes with rubrics: the specific ideas a language model would need to come up with to think like them.</p></div>
        <div class="stats" aria-label="Totals">
          <div class="stat"><b>${fmt(T.people)}</b><span>people</span></div>
          <div class="stat"><b>${fmt(T.questions)}</b><span>questions</span></div>
          <div class="stat"><b>${fmt(T.rubrics)}</b><span>rubric ideas</span></div>
          <div class="stat"><b>${fmt(T.evaluated)}</b><span>with model results</span></div>
        </div>
      </section>
      <section class="toolbar" aria-label="Find people">
        <div class="tool-row">
          <label class="field"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>
            <input id="dq" type="search" placeholder="Search by name, title or show" aria-label="Search people" value="${esc(dir.query)}"></label>
          <label class="select">Sort<select id="dsort" aria-label="Sort people">
            ${[['category', 'By area'], ['name', 'Name A–Z'], ['questions', 'Most questions'], ['recent', 'Most recent episode']]
              .map(([v, l]) => `<option value="${v}" ${dir.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <button class="toggle" id="deval" aria-pressed="${dir.evalOnly}">With model results</button>
        </div>
        <div class="chips" role="group" aria-label="Area">
          <button class="chip" data-cat="all" aria-pressed="${dir.cat === 'all'}">All<span>${fmt(T.people)}</span></button>
          ${D.categories.map(c => `<button class="chip" data-cat="${c.id}" aria-pressed="${dir.cat === c.id}">${esc(c.name)}<span>${c.count}</span></button>`).join('')}
        </div>
      </section>
      <div id="dcount" class="count-line" aria-live="polite"></div>
      <div id="dgrid"></div>`;
    renderGrid();
    const q = document.getElementById('dq');
    q.addEventListener('input', () => {dir.query = q.value; renderGrid();});
    document.getElementById('dsort').addEventListener('change', e => {dir.sort = e.target.value; renderGrid();});
    document.getElementById('deval').addEventListener('click', e => {
      dir.evalOnly = !dir.evalOnly; e.currentTarget.setAttribute('aria-pressed', dir.evalOnly); renderGrid();
    });
    main.querySelectorAll('[data-cat]').forEach(b => b.addEventListener('click', () => {
      dir.cat = b.dataset.cat;
      main.querySelectorAll('[data-cat]').forEach(x => x.setAttribute('aria-pressed', x === b));
      renderGrid();
    }));
  }

  function renderGrid() {
    const list = D.people.filter(matchesDir);
    const sorters = {name: (a, b) => a.name.localeCompare(b.name), questions: (a, b) => b.questions - a.questions || a.name.localeCompare(b.name),
                     recent: (a, b) => latest(b).localeCompare(latest(a)) || a.name.localeCompare(b.name)};
    let html;
    if (dir.sort === 'category') {
      html = D.categories.map(c => {
        const members = list.filter(p => p.category === c.id).sort(sorters.name);
        return members.length ? `<div class="group-head"><h2>${esc(c.name)}</h2><span>${plural(members.length, 'person').replace('persons', 'people')}</span></div>
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
    document.title = `${meta.name} · Common Ground`;
    if (!person || person.meta.id !== id) {
      main.innerHTML = `<a class="back" href="#/">← All people</a><div class="loading">Loading ${esc(meta.name)}…</div>`;
      let data;
      try {data = await fetchJSON(`data/people/${encodeURIComponent(id)}.json`);}
      catch (e) {main.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return;}
      person = {meta, data, query: '', topic: 'all', shown: PAGE};
    }
    const p = person.meta, data = person.data;
    const episodes = p.episodes.map(e => `<span>${esc(e.show)}${e.date ? `, ${esc(e.date.slice(0, 7))}` : ''}${e.url ? ` · <a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.title || 'Watch')} ↗</a>` : ''}</span>`).join('');
    main.innerHTML = `
      <a class="back" href="#/">← All people</a>
      <section class="profile">${photo(p, 112)}
        <div><h1>${esc(p.name)}</h1><p class="role">${esc(p.description)}</p>
          <div class="facts"><span class="cat">${esc(catName[p.category] || '')}</span><span>${plural(p.questions, 'question')} · ${plural(p.rubrics, 'rubric idea')}</span></div>
          <div class="facts">${episodes}</div></div>
      </section>
      ${p.evaluated ? '<section class="section" id="results"></section>' : ''}
      <section class="section" id="questions">
        <div class="section-head"><div><h2>Questions</h2>
          <p>Each answer is ${esc(p.name.replace(/\s*\(.*\)/, ''))}'s own reply in the interview, lightly cleaned. Open a question to see the answer, the rubric ideas, and the supporting quotes${p.evaluated ? ', plus how each model answered' : ''}.</p></div></div>
        <div class="qtools">
          <label class="field"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>
            <input id="qq" type="search" placeholder="Search questions, answers and ideas" aria-label="Search questions"></label>
          <span class="count-line" id="qcount" style="margin:0" aria-live="polite"></span>
        </div>
        ${data.topics ? `<div class="topics" role="group" aria-label="Topic"><button class="chip" data-topic="all" aria-pressed="true">All topics<span>${data.items.length}</span></button>${data.topics.map(t => `<button class="chip" data-topic="${esc(t.id)}" aria-pressed="false">${esc(t.name)}<span>${t.count}</span></button>`).join('')}</div>` : ''}
        <div class="qlist" id="qlist"></div>
      </section>`;
    if (p.evaluated) renderBoard();
    renderQuestions();
    const q = document.getElementById('qq');
    q.addEventListener('input', () => {person.query = q.value; person.shown = PAGE; renderQuestions();});
    main.querySelectorAll('[data-topic]').forEach(b => b.addEventListener('click', () => {
      person.topic = b.dataset.topic; person.shown = PAGE;
      main.querySelectorAll('[data-topic]').forEach(x => x.setAttribute('aria-pressed', x === b));
      renderBoard(); renderQuestions();
    }));
    window.scrollTo(0, 0);
    if (focus) openItem(focus);
  }

  function renderBoard() {
    const el = document.getElementById('results');
    if (!el) return;
    const data = person.data, topic = data.topics?.find(t => t.id === person.topic);
    const stats = topic ? topic.stats : data.stats;
    const rows = [...D.models].filter(m => stats[m.id]?.total).sort((a, b) => rate(stats[b.id]) - rate(stats[a.id]));
    const providers = [...new Set(rows.map(m => m.provider))];
    el.innerHTML = `<div class="section-head"><div><h2>How the models did</h2>
        <p>Share of the rubric ideas in ${esc(person.meta.name)}'s real answers that each model came up with when asked the same question${topic ? `, for <strong>${esc(topic.name)}</strong> only` : ''}.</p></div></div>
      <div class="legend" aria-label="Providers">${providers.map(p => `<span><i style="--c:${D.providers[p].color}"></i>${esc(D.providers[p].name)}</span>`).join('')}</div>
      <ol class="board">${rows.map((m, i) => {
        const s = stats[m.id];
        return `<li class="brow" data-tip="${esc(`${m.name} (${D.providers[m.provider].name}, ${m.effort})<br>${fmt(s.passed)} of ${fmt(s.total)} ideas · ${rate(s).toFixed(1)}%`)}">
          <span class="rank">${i + 1}</span><span class="bname">${esc(m.name)}<small>${esc(D.providers[m.provider].name)}</small></span>
          <span class="bar" aria-hidden="true"><span style="width:${rate(s)}%;--c:${D.providers[m.provider].color}"></span></span>
          <span class="bval">${rate(s).toFixed(1)}%</span></li>`;
      }).join('')}</ol>
      <p class="fine">Judge: ${esc(D.judge.name)}, which never sees the guest's answer. Scores measure coverage of the guest's ideas, not overall answer quality. <a href="#/about">How it works</a></p>`;
  }

  function itemMatches(it) {
    if (person.topic !== 'all' && it.topic !== person.topic) return false;
    const q = person.query.trim().toLowerCase();
    return !q || [it.question, it.object, it.answer, ...it.rubrics.map(r => r.text)].join(' ').toLowerCase().includes(q);
  }

  function renderQuestions() {
    const list = person.data.items.filter(itemMatches);
    const shown = list.slice(0, person.shown);
    const models = D.models.length;
    document.getElementById('qlist').innerHTML = shown.map(it => {
      const passMeta = it.rubrics.length && it.rubrics[0].passes
        ? ` · ${(100 * it.rubrics.reduce((n, r) => n + Object.values(r.passes).filter(Boolean).length, 0) / (it.rubrics.length * models)).toFixed(0)}% matched`
        : '';
      return `<details class="q" id="q-${esc(it.id)}" data-item="${esc(it.id)}">
        <summary><span><span class="qtext">${esc(it.question)}</span><span class="qobj">${esc(it.object)}</span></span>
          <span class="qside"><span class="chev" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m6 9 6 6 6-6"/></svg></span>
          <span class="qcount">${plural(it.rubrics.length, 'idea')}${passMeta}</span></span></summary>
        <div class="qbody"></div></details>`;
    }).join('') + (list.length > shown.length ? `<button class="more-btn" id="qmore">Show ${Math.min(PAGE, list.length - shown.length)} more of ${fmt(list.length - shown.length)}</button>` : '')
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
    const it = person.data.items.find(x => x.id === d.dataset.item);
    const models = D.models.length;
    const ideas = it.rubrics.length ? `<ol class="ideas">${it.rubrics.map(r => {
      const n = r.passes ? Object.values(r.passes).filter(Boolean).length : null;
      return `<li>${esc(r.text)}${n === null ? '' : `<span class="score">${n}/${models} models</span>`}</li>`;
    }).join('')}</ol>` : '<p class="fine">No rubric ideas for this answer.</p>';
    body.innerHTML = `<div class="cols">
        <div><p class="label">${esc(person.meta.name.replace(/\s*\(.*\)/, ''))}'s answer</p><div class="answer">${esc(it.answer)}</div>
          <details class="sub"><summary>Supporting quotes from the transcript (${it.quotes.length})</summary><ul class="quotes">${it.quotes.map(q => `<li>“${esc(q)}”</li>`).join('')}</ul></details></div>
        <div><p class="label">Rubric ideas</p>${ideas}</div>
      </div>
      ${it.answers ? `<details class="sub models"><summary>How each model answered</summary><div class="answers-body"><div class="loading">Loading answers…</div></div></details>` : ''}`;
    const md = body.querySelector('.models');
    md?.addEventListener('toggle', () => md.open && loadAnswers(md, it));
  }

  async function loadAnswers(el, it) {
    if (el.dataset.loaded) return;
    el.dataset.loaded = '1';
    const box = el.querySelector('.answers-body');
    try {
      const detail = await fetchJSON(`data/answers/${encodeURIComponent(it.id)}.json`);
      box.innerHTML = `<p class="fine" style="margin:4px 0 8px">Each model saw only a one-line host introduction and this question.</p>
        <div class="answer-grid">${D.models.map(m => {
          const a = detail.models[m.id];
          const head = `<b><span class="dot" style="--c:${D.providers[m.provider].color}"></span>${esc(m.name)}</b>`;
          if (!a) return `<div class="mans"><div class="mans-head">${head}<span>Not run</span></div></div>`;
          const passed = it.rubrics.filter(r => a.judgments[r.id]?.pass).length;
          return `<div class="mans"><div class="mans-head">${head}<span>${passed} / ${it.rubrics.length} idea${it.rubrics.length === 1 ? '' : 's'}</span></div>
            <div class="mans-text">${esc(a.text)}</div><button class="link more-text" hidden>Read all</button>
            <details class="sub judge"><summary>Judge's notes</summary>${it.rubrics.map(r => {
              const j = a.judgments[r.id];
              return j ? `<p><b class="${j.pass ? 'pass' : 'fail'}">${j.pass ? '✓' : '×'}</b> ${esc(j.rationale)}</p>` : '';
            }).join('')}</details></div>`;
        }).join('')}</div>`;
      box.querySelectorAll('.mans-text').forEach(t => {
        const b = t.nextElementSibling;
        if (t.scrollHeight > t.clientHeight + 2) {
          b.hidden = false;
          b.onclick = () => {b.textContent = t.classList.toggle('open') ? 'Show less' : 'Read all';};
        }
      });
    } catch (e) {box.innerHTML = `<div class="loading">${esc(e.message)}</div>`; delete el.dataset.loaded;}
  }

  function openItem(itemId) {
    const idx = person.data.items.findIndex(x => x.id === itemId);
    if (idx < 0) return;
    if (idx >= person.shown) {person.shown = idx + 1; renderQuestions();}
    const d = document.getElementById(`q-${itemId}`);
    if (d) {d.open = true; d.scrollIntoView({block: 'start'});}
  }

  // ---- about ----------------------------------------------------------------------------------
  function renderAbout() {
    document.title = 'How it works · Common Ground';
    main.innerHTML = `<a class="back" href="#/">← All people</a><section class="about"><p class="kicker">Method</p><h1>How it works</h1>
      ${D.about.map(p => `<p>${esc(p)}</p>`).join('')}</section>`;
    window.scrollTo(0, 0);
  }

  // ---- jump-to-person typeahead -----------------------------------------------------------------
  function setupJump() {
    const input = document.getElementById('jump'), list = document.getElementById('jump-list');
    let hits = [], sel = 0;
    const close = () => {list.hidden = true; input.setAttribute('aria-expanded', 'false');};
    const draw = () => {
      list.innerHTML = hits.map((p, i) => `<li role="option" id="jo-${i}" aria-selected="${i === sel}" data-id="${esc(p.id)}">${photo(p, 30)}<span>${esc(p.name)}<small>${esc(p.description)}</small></span></li>`).join('');
      list.hidden = !hits.length; input.setAttribute('aria-expanded', String(!!hits.length));
      if (hits.length) input.setAttribute('aria-activedescendant', `jo-${sel}`);
    };
    const go = id => {close(); input.value = ''; location.hash = `#/p/${encodeURIComponent(id)}`;};
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      hits = q ? D.people.filter(p => `${p.name} ${p.description}`.toLowerCase().includes(q))
        .sort((a, b) => a.name.toLowerCase().startsWith(q) ? -1 : b.name.toLowerCase().startsWith(q) ? 1 : 0).slice(0, 8) : [];
      sel = 0; draw();
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') {sel = Math.min(sel + 1, hits.length - 1); draw(); e.preventDefault();}
      else if (e.key === 'ArrowUp') {sel = Math.max(sel - 1, 0); draw(); e.preventDefault();}
      else if (e.key === 'Enter' && hits[sel]) go(hits[sel].id);
      else if (e.key === 'Escape') close();
    });
    list.addEventListener('mousedown', e => {const li = e.target.closest('li'); if (li) go(li.dataset.id);});
    input.addEventListener('blur', () => setTimeout(close, 120));
    document.addEventListener('keydown', e => {
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {e.preventDefault(); input.focus();}
    });
  }

  // ---- tooltip for leaderboard rows -------------------------------------------------------------
  document.addEventListener('mousemove', e => {
    const row = e.target.closest?.('[data-tip]');
    if (!row) {tip.hidden = true; return;}
    tip.innerHTML = row.dataset.tip; tip.hidden = false;
    const x = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8), y = e.clientY + 16;
    tip.style.left = `${x}px`; tip.style.top = `${y}px`;
  });

  // ---- routing --------------------------------------------------------------------------------
  function route() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
    if (parts[0] === 'p' && parts[1]) return renderPerson(parts[1], parts[2]);
    if (parts[0] === 'about') return renderAbout();
    person = null;
    renderDirectory();
  }

  fetchJSON('data/index.json').then(index => {
    D = index;
    byId = new Map(D.people.map(p => [p.id, p]));
    catName = Object.fromEntries(D.categories.map(c => [c.id, c.name]));
    setupJump();
    window.addEventListener('hashchange', () => {
      const parts = location.hash.replace(/^#\/?/, '').split('/');
      if (parts[0] === 'p' && person && decodeURIComponent(parts[1]) === person.meta.id && document.getElementById('qlist')) return;
      route();
    });
    route();
  }).catch(e => {main.innerHTML = `<div class="empty">${esc(e.message)}</div>`;});
})();

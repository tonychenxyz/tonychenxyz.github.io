'use strict';

// Common Ground: two tests of whether language models answer like two podcast guests.
//   turns     - models continue the real conversation (data/raw)
//   questions - models answer standalone questions about how the guest sees things (data/world)
(() => {
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const rate = s => s && s.total ? 100 * s.passed / s.total : 0;
  const pct = s => s && s.total ? `${rate(s).toFixed(1)}%` : '—';
  const clock = s => Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '';
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

  const TESTS = {
    turns: {title: 'Continue the conversation', blurb: 'Models read the episode up to a guest turn and write what the guest says next.',
            unit: 'scored turns', topicLabel: 'Thinking pattern'},
    questions: {title: 'Answer standalone questions', blurb: 'Models get one question, with no transcript, and answer as the guest.',
                unit: 'questions', topicLabel: 'Topic'},
  };
  const S = {guest: null, test: 'turns', topic: 'all', outcome: 'all', follow: '', query: ''};
  let RAW, WORLD, transcript = null, version = 0;

  // ---- data access shared by both tests --------------------------------------------------------
  function ctx() {
    const meta = RAW.speakers.find(s => s.id === S.guest);
    if (S.test === 'turns') {
      const counts = {};
      meta.rubrics.forEach(r => {counts[r.category] = (counts[r.category] || 0) + 1;});
      return {meta, data: RAW, models: RAW.models, stats: meta.stats, units: meta.caseCount,
              topics: meta.categories.map(c => ({...c, count: counts[c.id] || 0})).filter(c => c.count),
              rubrics: meta.rubrics.map(r => ({...r, topic: r.category}))};
    }
    const w = WORLD.speakers[S.guest];
    return {meta, data: WORLD, models: WORLD.models, stats: w.stats, units: w.items.length, items: w.items,
            topics: w.categories, rubrics: w.items.flatMap(i => i.rubrics.map(r => ({...r, topic: i.category, item: i.id})))};
  }
  const color = (c, m) => c.data.providers[m.provider].color;
  const followed = c => c.models.find(m => m.id === S.follow);

  function rubricMatches(c, r) {
    if (S.topic !== 'all' && r.topic !== S.topic) return false;
    const n = c.models.filter(m => r.passes[m.id]).length;
    switch (S.outcome) {
      case 'mixed': return n > 0 && n < c.models.length;
      case 'all-pass': return n === c.models.length;
      case 'all-fail': return n === 0;
      case 'follow-pass': return !!r.passes[S.follow];
      case 'follow-miss': return !r.passes[S.follow];
      default: return true;
    }
  }
  const filtering = () => S.topic !== 'all' || S.outcome !== 'all' || S.query.trim() !== '';

  // ---- URL state ------------------------------------------------------------------------------
  function writeURL(push = false, anchor = null) {
    const p = new URLSearchParams({guest: S.guest, test: S.test});
    if (S.topic !== 'all') p.set('topic', S.topic);
    if (S.follow) p.set('follow', S.follow);
    if (anchor) p.set(anchor[0], anchor[1]);
    history[push ? 'pushState' : 'replaceState'](null, '', `${location.pathname}#${p}`);
  }

  function readURL() {
    const p = new URLSearchParams(location.hash.slice(1));
    const guest = p.get('guest') || p.get('speaker');
    S.guest = RAW.speakers.some(s => s.id === guest) ? guest : RAW.speakers[0].id;
    S.test = p.get('test') === 'questions' || p.get('view') === 'world' ? 'questions' : 'turns';
    const c = ctx();
    S.topic = c.topics.some(t => t.id === p.get('topic')) ? p.get('topic') : 'all';
    S.follow = c.models.some(m => m.id === p.get('follow')) ? p.get('follow') : '';
    S.outcome = 'all'; S.query = '';
    return {turn: p.has('turn') ? Number(p.get('turn')) : null, item: p.get('q')};
  }

  // ---- chooser --------------------------------------------------------------------------------
  function renderChooser() {
    $('guests').innerHTML = RAW.speakers.map(s => {
      const w = WORLD.speakers[s.id];
      return `<button class="option guest-option ${S.guest === s.id ? 'active' : ''}" data-guest="${s.id}" aria-pressed="${S.guest === s.id}">
        <span class="avatar" aria-hidden="true">${esc(s.initials)}</span>
        <span class="option-body"><strong>${esc(s.name)}</strong><small>${esc(s.episode)}</small>
        <span class="meta">${s.caseCount} scored turns · ${w.items.length} questions</span></span></button>`;
    }).join('');
    const meta = RAW.speakers.find(s => s.id === S.guest);
    const counts = {turns: [RAW.models.length, meta.caseCount, 'full transcript with audio'],
                    questions: [WORLD.models.length, WORLD.speakers[S.guest].items.length, 'guest\'s answer and quotes']};
    $('tests').innerHTML = Object.entries(TESTS).map(([id, t]) => `<button class="option test-option ${S.test === id ? 'active' : ''}" data-test="${id}" aria-pressed="${S.test === id}">
        <span class="option-body"><strong>${t.title}</strong><small>${t.blurb}</small>
        <span class="meta">${counts[id][0]} models · ${counts[id][1]} ${t.unit} · ${counts[id][2]}</span></span></button>`).join('');
  }

  // ---- results: one ranked bar chart ----------------------------------------------------------
  function renderResults() {
    const c = ctx(), t = TESTS[S.test];
    const topic = c.topics.find(x => x.id === S.topic);
    const stats = topic ? topic.stats : c.stats;
    const rows = [...c.models].sort((a, b) => rate(stats[b.id]) - rate(stats[a.id]) || stats[b.id].passed - stats[a.id].passed);
    const providers = [...new Set(c.models.map(m => m.provider))];
    $('results').innerHTML = `
      <div class="block-head"><h2>How the models did</h2>
        <p>Share of the ideas in ${esc(c.meta.name)}'s real ${S.test === 'turns' ? 'turns' : 'answers'} that each model came up with, across ${c.units} ${t.unit}${topic ? ` (only <strong>${esc(topic.name)}</strong>)` : ''}. <span class="hint">Click a model to follow it through the examples below.</span></p></div>
      <div class="legend" aria-label="Providers">${providers.map(p => `<span><i style="--c:${c.data.providers[p].color}"></i>${esc(c.data.providers[p].name)}</span>`).join('')}</div>
      <ol class="board">${rows.map((m, i) => {
        const s = stats[m.id], on = S.follow === m.id;
        return `<li><button class="board-row ${on ? 'active' : ''}" data-follow="${m.id}" aria-pressed="${on}" title="${on ? 'Stop following' : 'Follow'} ${esc(m.name)}">
          <span class="rank">${i + 1}</span>
          <span class="bname">${esc(m.name)}<small>${esc(c.data.providers[m.provider].name)} · ${esc(m.effort)}</small></span>
          <span class="bar" aria-hidden="true"><span style="width:${rate(s)}%;--c:${color(c, m)}"></span></span>
          <span class="bval">${pct(s)}</span><span class="bfrac">${s.passed} / ${s.total}</span></button></li>`;
      }).join('')}</ol>
      <p class="fine">Judge: ${esc(c.data.judge.name)}. Every model is scored on the same ideas. Scores show coverage of the guest's ideas, not overall answer quality. <a href="#how">How it works</a></p>`;
  }

  // ---- explore: filters + examples ------------------------------------------------------------
  function renderExploreShell() {
    const c = ctx(), t = TESTS[S.test];
    const intro = S.test === 'turns'
      ? `The whole episode. In each <span class="tag scored">scored turn</span>, models had to write what ${esc(c.meta.name)} says next. Under the real turn you can see which of its ideas each model came up with, and open every model's answer. Press <b>▶ Listen</b> to hear the original audio.`
      : `One card per question. Each card lists the ideas from ${esc(c.meta.name)}'s real answer and which models came up with them. Open a card's sections to read the guest's answer, the transcript quotes behind it, and every model's answer.`;
    $('explore').innerHTML = `
      <div class="block-head"><h2>${S.test === 'turns' ? 'Read the conversation' : 'Browse the questions'}</h2><p>${intro}</p></div>
      <div class="topic-row"><span class="f-label">${t.topicLabel}</span><div class="topics" id="topics"></div></div>
      <div class="filters" id="filters" role="search">
        <div class="f-row">
          <label class="search"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><input id="query" type="search" placeholder="${S.test === 'turns' ? 'Search the transcript and ideas' : 'Search questions and ideas'}" aria-label="Search"></label>
          <label class="select"><span>Show</span><select id="outcome" aria-label="Show"></select></label>
          <label class="select"><span>Follow</span><select id="follow" aria-label="Follow a model"></select></label>
        </div>
        <div class="f-status"><span id="count" role="status" aria-live="polite"></span><button id="clear" class="link" hidden>Clear filters</button></div>
      </div>
      <div id="list"></div>`;
    $('query').oninput = e => {S.query = e.target.value; renderList();};
    $('outcome').onchange = e => {S.outcome = e.target.value; renderList();};
    $('follow').onchange = e => setFollow(e.target.value);
  }

  function renderFilters(c) {
    const all = {id: 'all', name: 'All', count: S.test === 'turns' ? c.rubrics.length : c.units};
    $('topics').innerHTML = [all, ...c.topics].map(x => `<button class="chip ${S.topic === x.id ? 'active' : ''}" data-topic="${x.id}" aria-pressed="${S.topic === x.id}" ${x.description ? `title="${esc(x.description)}"` : ''}>${esc(x.name)} <span>${x.count}</span></button>`).join('');
    const f = followed(c);
    if (!f && S.outcome.startsWith('follow-')) S.outcome = 'all';
    const outcomes = [['all', 'Everything'], ['mixed', 'Ideas models disagree on'], ['all-pass', 'Ideas every model got'], ['all-fail', 'Ideas no model got'],
      ...(f ? [['follow-pass', `Ideas ${f.name} got`], ['follow-miss', `Ideas ${f.name} missed`]] : [])];
    $('outcome').innerHTML = outcomes.map(([id, label]) => `<option value="${id}" ${S.outcome === id ? 'selected' : ''}>${esc(label)}</option>`).join('');
    $('follow').innerHTML = `<option value="">No model</option>` + c.models.map(m => `<option value="${m.id}" ${S.follow === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('');
    $('clear').hidden = !filtering();
  }

  function chip(c, m) {
    return `<span class="mchip ${S.follow === m.id ? 'on' : ''}"><i style="--c:${color(c, m)}"></i>${esc(m.name)}</span>`;
  }

  function ideaHTML(c, r, showTopic) {
    const got = c.models.filter(m => r.passes[m.id]), missed = c.models.filter(m => !r.passes[m.id]);
    const f = followed(c);
    const fv = f ? `<span class="fverdict ${r.passes[f.id] ? 'pass' : 'fail'}">${r.passes[f.id] ? '✓' : '×'} ${esc(f.name)}</span>` : '';
    const topic = showTopic ? c.topics.find(t => t.id === r.topic) : null;
    return `<div class="idea">
      <p class="idea-text">${fv}${esc(r.text)}${topic ? ` <button class="tag" data-topic="${topic.id}" title="Show only ${esc(topic.name)}">${esc(topic.name)}</button>` : ''}</p>
      <div class="who"><span class="who-label pass">✓ Got it <b>${got.length}</b></span><span class="chips">${got.map(m => chip(c, m)).join('') || '<span class="none">no model</span>'}</span></div>
      <div class="who"><span class="who-label fail">× Missed <b>${missed.length}</b></span><span class="chips">${missed.map(m => chip(c, m)).join('') || '<span class="none">no model</span>'}</span></div>
    </div>`;
  }

  function ideasBlock(c, rubrics, total, label, showTopic) {
    const hidden = total - rubrics.length;
    return `<div class="ideas"><div class="ideas-label">${label}</div>${rubrics.map(r => ideaHTML(c, r, showTopic)).join('')}${hidden ? `<p class="fine">${hidden} more idea${hidden === 1 ? '' : 's'} hidden by the filters.</p>` : ''}</div>`;
  }

  const answersToggle = (key, n, attrs) => `<details class="answers" ${attrs}><summary>All ${n} model answers</summary><div class="answers-body"><div class="loading">Loading answers…</div></div></details>`;

  // Questions test
  function questionCard(c, item, rubrics) {
    const topic = c.topics.find(t => t.id === item.category);
    return `<article class="card" id="q-${item.id}">
      <div class="card-top"><button class="tag" data-topic="${topic.id}" title="Show only ${esc(topic.name)}">${esc(topic.name)}</button>
        <button class="link" data-goto-turn="${item.start}" title="Open this part of the transcript">From the episode at ${clock(item.startTime)} ↗</button></div>
      <h3 class="question">${esc(item.question)}</h3>
      <p class="object">About: ${esc(item.object)}</p>
      ${item.rubrics.length ? ideasBlock(c, rubrics, item.rubrics.length, `Ideas from ${esc(c.meta.name)}'s real answer`, false) : '<p class="fine">No ideas were selected from this answer, so it is not scored.</p>'}
      <div class="more">
        <details><summary>${esc(c.meta.name)}'s answer <span class="badge">Synthesized</span></summary><p class="note">Not a verbatim quote. ${esc(WORLD.synthesis)}</p><div class="prose">${esc(item.reference)}</div></details>
        <details><summary>Transcript quotes (${item.quotes.length})</summary><ul class="quotes">${item.quotes.map(q => `<li>“${esc(q)}”</li>`).join('')}</ul></details>
        ${answersToggle(item.id, c.models.length, `data-item="${item.id}"`)}
      </div>
    </article>`;
  }

  // Transcript test
  function turnCard(c, turn, rubrics, contextual) {
    const scored = turn.caseId && turn.status !== 'preview';
    const all = c.rubrics.filter(r => r.turn === turn.turn);
    const status = {preview: 'Preview clip · not scored', excluded: 'Not scored', no_rubrics: 'No ideas selected · not scored'}[turn.status];
    const listen = turn.audio ? `<button class="listen" data-audio="${esc(turn.audio)}" data-audio-name="${esc(turn.name)}, turn ${turn.turn}" aria-pressed="false"><span data-audio-icon aria-hidden="true">▶</span><span data-audio-label>Listen</span></button>` : '';
    return `<article class="transcript-turn turn ${turn.role === 'guest' ? 'guest' : 'host'} ${scored && !contextual ? 'scored' : ''} ${contextual ? 'context' : ''}" id="turn-${turn.turn}">
      <header class="turn-head"><span class="turn-name">${esc(turn.name)}${scored && !contextual ? ' <span class="tag scored">scored turn</span>' : ''}</span>
        <span class="turn-meta">${listen}<span>${clock(turn.start)}</span><button class="link" data-copy-turn="${turn.turn}" title="Copy a link to this turn">#${turn.turn}</button></span></header>
      <div class="turn-audio-slot" hidden><div class="turn-audio-status" role="status"></div></div>
      <div class="turn-text">${esc(turn.text)}</div>
      ${turn.originalText && turn.originalText !== turn.text ? `<details class="orig"><summary>Original wording${turn.sourceTurns?.length > 1 ? ` · ${turn.sourceTurns.length} source turns` : ''}</summary><div>${esc(turn.originalText)}</div></details>` : ''}
      ${status && !contextual ? `<p class="fine">${status}</p>` : ''}
      ${scored && !contextual && all.length ? ideasBlock(c, rubrics, all.length, 'Ideas in this turn', true) + `<div class="more">${answersToggle(turn.caseId, c.models.length, `data-case="${turn.caseId}"`)}</div>` : ''}
    </article>`;
  }

  function renderList() {
    const c = ctx();
    renderFilters(c);
    const q = S.query.trim().toLowerCase();
    const parts = [];
    let shown = 0, ideas = 0;
    if (S.test === 'questions') {
      for (const item of c.items) {
        const rubrics = c.rubrics.filter(r => r.item === item.id && rubricMatches(c, r));
        const text = [item.question, item.object, item.reference, ...item.rubrics.map(r => r.text)].join(' ').toLowerCase();
        if (q && !text.includes(q)) continue;
        if ((S.topic !== 'all' && item.category !== S.topic) || (S.outcome !== 'all' && !rubrics.length)) continue;
        parts.push(questionCard(c, item, rubrics)); shown++; ideas += rubrics.length;
      }
      $('count').textContent = `${shown} of ${c.items.length} questions · ${ideas} ideas`;
    } else if (!transcript) {
      parts.push('<div class="loading">Loading transcript…</div>');
    } else {
      const matching = new Map();
      c.rubrics.filter(r => rubricMatches(c, r)).forEach(r => matching.set(r.turn, [...(matching.get(r.turn) || []), r]));
      const ruleFilter = S.topic !== 'all' || S.outcome !== 'all';
      const targets = transcript.turns.filter(t => {
        if (!filtering()) return true;
        if (ruleFilter && !matching.has(t.turn)) return false;
        return !q || [t.text, ...c.rubrics.filter(r => r.turn === t.turn).map(r => r.text)].join(' ').toLowerCase().includes(q);
      }).map(t => t.turn);
      const targetSet = new Set(targets), show = new Set();
      transcript.turns.forEach((t, i) => {
        if (!filtering()) show.add(i);
        else if (targetSet.has(t.turn)) for (let j = Math.max(0, i - (t.role === 'guest' ? 2 : 0)); j <= i; j++) show.add(j);
      });
      let prev = -1;
      for (const i of [...show].sort((a, b) => a - b)) {
        const t = transcript.turns[i];
        if (i > prev + 1) parts.push(`<div class="gap">${i - prev - 1} turns hidden by the filters</div>`);
        const ctxTurn = filtering() && !targetSet.has(t.turn);
        parts.push(turnCard(c, t, matching.get(t.turn) || [], ctxTurn));
        prev = i;
      }
      if (filtering() && prev < transcript.turns.length - 1) parts.push(`<div class="gap">${transcript.turns.length - prev - 1} later turns hidden by the filters</div>`);
      const scoredShown = targets.filter(n => matching.has(n)).length;
      ideas = targets.reduce((n, t) => n + (matching.get(t)?.length || 0), 0);
      $('count').textContent = filtering() ? `${targets.length} matching turns · ${ideas} ideas · nearby context shown faded` : `${transcript.turns.length} turns · ${scoredShown} scored turns · ${ideas} ideas`;
    }
    window.turnAudio?.reset();
    $('list').innerHTML = parts.join('') || '<div class="empty">Nothing matches these filters. <button class="link" id="clear2">Clear filters</button></div>';
  }

  // ---- model answers (lazy) -------------------------------------------------------------------
  async function loadAnswers(el) {
    if (el.dataset.loaded || el.dataset.loading) return;
    el.dataset.loading = '1';
    const c = ctx(), body = el.querySelector('.answers-body');
    try {
      const detail = el.dataset.item ? await fetchJSON(`data/world/items/${encodeURIComponent(el.dataset.item)}.json`)
                                     : await fetchJSON(`data/raw/turns/${encodeURIComponent(el.dataset.case)}.json`);
      const rubrics = el.dataset.item ? c.items.find(i => i.id === el.dataset.item).rubrics : detail.rubrics;
      const order = [...c.models].sort((a, b) => (b.id === S.follow) - (a.id === S.follow));
      body.innerHTML = `<p class="note">${el.dataset.item ? 'Each model saw only a one-line host introduction and this question.' : 'Each model saw the conversation up to this turn.'} ${S.follow ? 'The model you follow is first.' : ''}</p>
        <div class="answer-grid">${order.map(m => {
          const a = detail.models[m.id];
          if (!a || a.status === 'not_run') return `<div class="answer muted"><div class="answer-head">${chip(c, m)}<span>Not run</span></div></div>`;
          const passed = rubrics.filter(r => a.judgments[r.rubricId]?.pass).length;
          return `<div class="answer ${m.id === S.follow ? 'on' : ''}"><div class="answer-head">${chip(c, m)}<span>${rubrics.length ? `${passed} / ${rubrics.length} idea${rubrics.length === 1 ? '' : 's'}` : 'unscored'}</span></div>
            <div class="answer-text">${esc(a.text)}</div><button class="link more-text" hidden>Read all</button>
            ${rubrics.length ? `<details class="judge"><summary>Judge's notes</summary>${rubrics.map(r => {
              const j = a.judgments[r.rubricId];
              return `<p><b class="${j.pass ? 'pass' : 'fail'}">${j.pass ? '✓' : '×'}</b> ${esc(j.rationale)}</p>`;
            }).join('')}</details>` : ''}</div>`;
        }).join('')}</div>`;
      body.querySelectorAll('.answer-text').forEach(t => {
        const b = t.nextElementSibling;
        if (t.scrollHeight > t.clientHeight + 2) {
          b.hidden = false;
          b.onclick = () => {const open = t.classList.toggle('open'); b.textContent = open ? 'Show less' : 'Read all';};
        }
      });
      el.dataset.loaded = '1';
    } catch (e) {
      body.innerHTML = `<div class="loading">${esc(e.message)}</div>`;
    } finally {delete el.dataset.loading;}
  }

  // ---- how it works ---------------------------------------------------------------------------
  function renderHow() {
    const col = (id, about) => `<div><h3>${TESTS[id].title}</h3><p>${esc(about[0])}</p><details><summary>Method and caveats</summary>${about.slice(1).map(p => `<p>${esc(p)}</p>`).join('')}</details></div>`;
    $('how').innerHTML = `<div class="block-head"><h2>How it works</h2><p>Both tests use rubrics: short, one-idea statements written from the guest's real words. A judge model checks each model's answer against each idea.</p></div>
      <div class="how-grid">${col('turns', RAW.about)}${col('questions', WORLD.about)}</div>`;
  }

  // ---- navigation -----------------------------------------------------------------------------
  function setFollow(id) {
    S.follow = S.follow === id ? '' : id;
    writeURL();
    renderResults(); renderList();
  }

  async function loadTranscript() {
    const v = ++version;
    transcript = null;
    const t = await fetchJSON(`data/raw/transcripts/${S.guest}.json`);
    if (v === version) transcript = t;
  }

  async function show({push = false, anchor = null} = {}) {
    renderChooser(); renderResults(); renderExploreShell(); renderList();
    writeURL(push, anchor);
    if (S.test === 'turns') {
      try {await loadTranscript(); renderList();} catch (e) {$('list').innerHTML = `<div class="loading">${esc(e.message)}</div>`;}
    }
  }

  function scrollToEl(el) {
    if (!el) return;
    const bar = $('filters');
    const offset = bar && getComputedStyle(bar).position === 'sticky' ? bar.offsetHeight + 12 : 12;
    window.scrollTo({top: el.getBoundingClientRect().top + window.scrollY - offset});
  }

  function nearestTurn(n) {
    if (!transcript || n === null) return n;
    const exact = transcript.turns.find(t => t.turn === n || t.sourceTurns?.includes(n));
    return (exact || transcript.turns.find(t => Math.min(...(t.sourceTurns || [t.turn])) >= n))?.turn ?? n;
  }

  async function jump({turn, item}) {
    if (turn !== null && S.test === 'turns') {
      const n = nearestTurn(turn);
      scrollToEl($(`turn-${n}`));
    } else if (item) scrollToEl($(`q-${item}`));
  }

  document.addEventListener('click', async e => {
    const b = e.target.closest('button');
    if (!b || !RAW) return;
    if (b.dataset.guest && b.dataset.guest !== S.guest) {
      S.guest = b.dataset.guest; S.topic = 'all'; S.outcome = 'all'; S.query = ''; S.follow = '';
      await show({push: true});
    } else if (b.dataset.test && b.dataset.test !== S.test) {
      S.test = b.dataset.test; S.topic = 'all'; S.outcome = 'all'; S.query = '';
      if (!ctx().models.some(m => m.id === S.follow)) S.follow = '';
      await show({push: true});
      $('results').scrollIntoView({block: 'start'});
    } else if (b.dataset.follow !== undefined && b.classList.contains('board-row')) {
      setFollow(b.dataset.follow);
    } else if (b.dataset.topic) {
      S.topic = S.topic === b.dataset.topic && b.dataset.topic !== 'all' ? 'all' : b.dataset.topic;
      writeURL(); renderResults(); renderList();
      $('explore').scrollIntoView({block: 'start'});
    } else if (b.id === 'clear' || b.id === 'clear2') {
      S.topic = 'all'; S.outcome = 'all'; S.query = ''; $('query').value = '';
      writeURL(); renderResults(); renderList();
    } else if (b.dataset.gotoTurn) {
      S.test = 'turns'; S.topic = 'all'; S.outcome = 'all'; S.query = '';
      if (!ctx().models.some(m => m.id === S.follow)) S.follow = '';
      await show({push: true});
      const n = nearestTurn(Number(b.dataset.gotoTurn));
      writeURL(false, ['turn', n]);
      scrollToEl($(`turn-${n}`));
    } else if (b.dataset.copyTurn) {
      writeURL(false, ['turn', b.dataset.copyTurn]);
      try {await navigator.clipboard.writeText(location.href); b.textContent = 'Copied';} catch {b.textContent = 'In URL';}
      setTimeout(() => {if (b.isConnected) b.textContent = `#${b.dataset.copyTurn}`;}, 1600);
    }
  });
  document.addEventListener('toggle', e => {
    if (e.target.matches?.('details.answers') && e.target.open) loadAnswers(e.target);
  }, true);

  async function boot() {
    try {
      [RAW, WORLD] = await Promise.all([fetchJSON('data/raw/index.json'), fetchJSON('data/world/index.json')]);
      const target = readURL();
      renderHow();
      await show();
      await jump(target);
      window.addEventListener('popstate', async () => {const t = readURL(); await show(); await jump(t);});
    } catch (e) {
      $('error').hidden = false; $('error').textContent = e.message;
      $('results').innerHTML = '';
    }
  }
  boot();
})();

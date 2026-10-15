'use strict';

// World-understanding view: interview-style questions about a guest's understanding of
// an object, answered by each model from the question alone and judged against v10 rubrics.
(() => {
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pct = s => s.total ? (100 * s.passed / s.total).toFixed(1) : '—';
  const cache = new Map();
  let data = null, speaker = null, query = '', outcome = 'all', category = 'all', focus = null;

  const build = document.documentElement.dataset.build || '';
  function fetchJSON(path) {
    path = build ? `${path}?v=${build}` : path;
    if (!cache.has(path)) cache.set(path, fetch(path).then(r => {
      if (!r.ok) throw Error(`Unable to load results (${r.status}).`);
      return r.json();
    }).catch(error => {cache.delete(path); throw error;}));
    return cache.get(path);
  }

  const color = m => data.providers[m.provider].color;
  const time = s => Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '';

  const focused = () => data.models.find(m => m.id === focus);

  function chip(m) {
    return `<span class="model-chip ${focus === m.id ? 'focused' : ''}"><span class="model-dot" style="--model:${color(m)}"></span>${esc(m.name)}</span>`;
  }

  // Each rubric lists the models that passed and missed it by name, instead of a 13-column grid.
  function verdictRows(r) {
    const passed = data.models.filter(m => r.passes[m.id]), missed = data.models.filter(m => !r.passes[m.id]);
    const row = (kind, icon, label, models) => `<div class="verdict-row ${kind}"><span class="verdict-label"><span aria-hidden="true">${icon}</span> ${label} <b>${models.length}</b></span><span class="model-chips">${models.length ? models.map(chip).join('') : '<span class="none">none</span>'}</span></div>`;
    return row('pass', '✓', 'Passed', passed) + row('fail', '×', 'Missed', missed);
  }

  const currentStats = owner => category === 'all' ? owner.stats : owner.categories.find(c => c.id === category).stats;
  const categoryOf = id => speaker.categories.find(c => c.id === id);

  function categoryButtons(owner) {
    const all = {id: 'all', name: 'All questions', count: owner.items.length};
    return [all, ...owner.categories].map(c => `<button class="category-button ${category === c.id ? 'active' : ''}" data-world-category="${c.id}" aria-pressed="${category === c.id}" ${c.description ? `title="${esc(c.description)}"` : ''}><span class="category-top"><span class="category-name">${esc(c.name)}</span><span class="category-rate">${c.count}</span></span></button>`).join('');
  }

  function scoreCards(owner) {
    const stats = currentStats(owner);
    return Object.entries(data.providers).map(([pid, p]) => {
      const models = data.models.filter(m => m.provider === pid);
      return `<div class="world-provider"><div class="world-provider-label"><span class="model-dot" style="--model:${p.color}"></span>${esc(p.name)} <span>· ${esc(p.harness)}</span></div><div class="scores world-scores" style="--world-cols:${models.length}">${models.map(m => {
        const s = stats[m.id];
        return `<button class="score-card world-score ${focus === m.id ? 'active' : ''}" style="--model:${p.color}" data-world-model="${m.id}" aria-pressed="${focus === m.id}" aria-label="${esc(m.name)}: ${pct(s)}% pass rate. ${focus === m.id ? 'Focused; click to clear.' : 'Click to focus this model.'}"><span class="score-name"><span class="model-dot"></span>${esc(m.name)}<small class="model-effort">${esc(m.effort)}</small></span><span class="score-number">${pct(s)}<em>%</em></span><span class="score-fraction">${s.passed} / ${s.total} passed</span><span class="score-bar" aria-hidden="true"><span style="width:${pct(s)}%"></span></span></button>`;
      }).join('')}</div></div>`;
    }).join('');
  }

  function matches(item) {
    if (category !== 'all' && item.category !== category) return false;
    const q = query.trim().toLowerCase();
    const text = [item.question, item.object, item.reference, ...item.rubrics.map(r => r.text)].join(' ').toLowerCase();
    if (q && !text.includes(q)) return false;
    if (outcome === 'all') return true;
    if (outcome === 'focus-pass' || outcome === 'focus-miss') return item.rubrics.some(r => !!r.passes[focus] === (outcome === 'focus-pass'));
    return item.rubrics.some(r => {
      const n = data.models.filter(m => r.passes[m.id]).length;
      return (outcome === 'mixed' && n > 0 && n < data.models.length) || (outcome === 'all-pass' && n === data.models.length) || (outcome === 'all-fail' && n === 0);
    });
  }

  function itemHTML(item) {
    const f = focused();
    const header = `<div class="turn-rubric-heading"><span>Rubrics</span>${f && item.rubrics.length ? `<span class="focus-score">${chip(f)} ${item.rubrics.filter(r => r.passes[f.id]).length} / ${item.rubrics.length} passed</span>` : ''}</div>`;
    const rubrics = item.rubrics.length
      ? `<div class="turn-rubrics">${header}${item.rubrics.map(r => `<div class="world-rubric"><button class="rubric-open" data-world-open="${item.id}" data-rubric-focus="${r.rubricId}"><span class="rubric-code">${r.rubricId}</span><span>${esc(r.text)}</span></button>${verdictRows(r)}</div>`).join('')}</div>`
      : '<div class="turn-status">No rubrics for this answer · unscored</div>';
    return `<article class="world-item" id="q-${item.id}">
      <header class="turn-head"><span class="turn-name">Question</span><span class="turn-time">${time(item.startTime)} <span aria-hidden="true">·</span> <button class="turn-link" data-world-turn="${item.start}" title="Show the source turns in the transcript">Turns ${item.start}–${item.end} ↗</button></span></header>
      <h3 class="world-question">${esc(item.question)}</h3>
      <div class="world-object"><span>Object</span>${esc(item.object)}<button class="world-chip" data-world-category="${item.category}" title="Show only ${esc(categoryOf(item.category).name)}">${esc(categoryOf(item.category).name)}</button></div>
      <details class="original-wording world-reference"><summary>${esc(speaker.name)}'s answer <span class="synth-badge">Synthesized</span> · ${item.reference.split(/\s+/).length} words</summary><p class="synth-note">Not a verbatim quote. ${esc(data.synthesis)} Source: turns ${item.start}–${item.end}.</p><div>${esc(item.reference)}</div></details>
      <details class="original-wording world-quotes"><summary>Transcript quotes · ${item.quotes.length} verbatim</summary><ul>${item.quotes.map(q => `<li>“${esc(q)}”</li>`).join('')}</ul></details>
      ${rubrics}
      <details class="turn-comparison" data-world-item="${item.id}" id="wcompare-${item.id}"><summary><span class="comparison-icon" aria-hidden="true">+</span>Compare model responses<span class="comparison-arrow" aria-hidden="true">↗</span></summary><div class="comparison-body"><div class="loading" role="status">Loading model responses…</div></div></details>
    </article>`;
  }

  function comparisonHTML(item, detail) {
    return `<div class="comparison-meta">${item.rubrics.length ? `Scores cover all ${item.rubrics.length} rubric${item.rubrics.length === 1 ? '' : 's'} above.` : 'No rubrics for this answer. Responses are unscored.'} Each model saw only a one-line host introduction and this question.</div><div class="all-models">${[...data.models].sort((a, b) => (b.id === focus) - (a.id === focus)).map(m => {
      const c = detail.models[m.id];
      if (!c) return `<article class="model-answer not-run" style="--model:${color(m)}"><header class="model-answer-head"><h3><span class="model-dot"></span>${esc(m.name)}</h3><span class="model-turn-score">Not run</span></header></article>`;
      const passed = Object.values(c.judgments).filter(j => j.pass).length;
      return `<article class="model-answer ${m.id === focus ? 'focused-answer' : ''}" style="--model:${color(m)}"><header class="model-answer-head"><h3><span class="model-dot"></span>${esc(m.name)}</h3><span class="model-turn-score">${item.rubrics.length ? `${passed} / ${item.rubrics.length} passed` : 'N/A'}</span></header><div class="answer-content"><div class="block-label">Response</div><div class="candidate-text" id="wanswer-${item.id}-${m.id}">${esc(c.text)}</div><button class="read-response" aria-expanded="false" aria-controls="wanswer-${item.id}-${m.id}">Read full response</button>${item.rubrics.length ? `<div class="block-label judge-heading">${esc(data.judge.name)} judgments</div>` : ''}${item.rubrics.map(r => {
        const j = c.judgments[r.rubricId];
        return `<section class="model-judgment ${j.pass ? 'passed' : 'missed'}" data-judged-rubric="${r.rubricId}"><div class="judge-meta"><span>${r.rubricId}</span><span class="judge-verdict">${j.pass ? 'PASS' : 'FAIL'}</span></div><p class="judged-criterion">${esc(r.text)}</p><p class="judge-rationale">${esc(j.rationale)}</p></section>`;
      }).join('')}</div></article>`;
    }).join('')}</div>`;
  }

  async function loadComparison(el, focus) {
    if (el.dataset.loading) return;
    const item = speaker.items.find(i => i.id === el.dataset.worldItem);
    const body = el.querySelector('.comparison-body');
    if (!el.dataset.loaded) {
      el.dataset.loading = 'true';
      try {
        const detail = await fetchJSON(`data/world/items/${encodeURIComponent(item.id)}.json`);
        if (!el.isConnected) return;
        body.innerHTML = comparisonHTML(item, detail);
        body.querySelectorAll('.read-response').forEach(button => {
          const text = button.previousElementSibling;
          if (text.scrollHeight <= text.clientHeight + 2) button.hidden = true;
          button.onclick = () => {
            const expanded = button.getAttribute('aria-expanded') === 'true';
            text.classList.toggle('expanded', !expanded);
            button.setAttribute('aria-expanded', String(!expanded));
            button.textContent = expanded ? 'Read full response' : 'Collapse response';
          };
        });
        el.dataset.loaded = 'true';
      } catch (error) {
        body.innerHTML = `<div class="loading" role="alert">${esc(error.message)}<button class="retry">Try again</button></div>`;
        body.querySelector('.retry').onclick = () => loadComparison(el, focus);
        return;
      } finally {delete el.dataset.loading;}
    }
    if (focus) el.querySelectorAll('.model-judgment').forEach(j => j.classList.toggle('focused-judgment', j.dataset.judgedRubric === focus));
  }

  function renderItems() {
    const c = category === 'all' ? null : categoryOf(category);
    $('world-scores').innerHTML = scoreCards(speaker);
    $('world-categories').innerHTML = categoryButtons(speaker);
    const f = focused();
    $('world-caption').textContent = `Rubric pass rate on ${c ? `${c.name.toLowerCase()} questions: ${c.description.charAt(0).toLowerCase() + c.description.slice(1).replace(/\.$/, '')}` : 'all of this guest\'s questions'} · same rubrics for every model · ${data.judge.name} judge · no browsing or tools`;
    $('world-focus').innerHTML = f ? `Focused on ${chip(f)} · highlighted in every rubric below · <button data-world-model="${f.id}">Clear</button>` : 'Click a model to focus it: its verdicts are highlighted and you can filter to what it passed or missed.';
    if (!f && outcome.startsWith('focus-')) outcome = 'all';
    const outcomes = [['all', 'All outcomes'], ['mixed', 'Models disagree'], ['all-pass', 'All pass'], ['all-fail', 'All miss'],
      ...(f ? [['focus-pass', `${f.name} passed`], ['focus-miss', `${f.name} missed`]] : [])];
    $('world-outcomes').innerHTML = outcomes.map(([id, label]) => `<button class="outcome-button" data-world-outcome="${id}">${esc(label)}</button>`).join('');
    document.querySelectorAll('[data-world-outcome]').forEach(b => {
      const active = b.dataset.worldOutcome === outcome;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', String(active));
    });
    const shown = speaker.items.filter(matches);
    const rubrics = shown.reduce((n, i) => n + i.rubrics.length, 0);
    $('world-count').textContent = `${shown.length} of ${speaker.items.length} questions · ${rubrics} rubrics`;
    $('world-items').innerHTML = shown.length ? shown.map(itemHTML).join('') : '<div class="empty">No questions match this view.</div>';
    document.querySelectorAll('[data-world-item]').forEach(el => el.addEventListener('toggle', () => {if (el.open) loadComparison(el);}));
  }

  function renderSpeaker() {
    const owner = speaker;
    const total = owner.items.reduce((n, i) => n + i.rubrics.length, 0);
    $('world-view').innerHTML = `
      <div class="section-heading"><div><div class="eyebrow">WORLD UNDERSTANDING</div><h2>How ${esc(owner.name)} sees things</h2><p>Each question asks ${esc(owner.name)} about an entity or event in the conversation, written so it stands alone. The answer is synthesized from ${esc(owner.name)}'s reply in the episode, with verbatim quotes alongside. Each model answered as the guest from the question alone. Rubrics capture the ideas in the guest's actual answer.</p></div><span class="count-tag">${owner.items.length} questions · ${total} rubrics</span></div>
      <div id="world-scores">${scoreCards(owner)}</div>
      <div class="score-caption" id="world-caption"></div>
      <div class="world-focus" id="world-focus" role="status" aria-live="polite"></div>
      <section class="category-nav transcript-filters" aria-label="Question categories"><div class="nav-label category-label">CATEGORIES</div><nav id="world-categories">${categoryButtons(owner)}</nav></section>
      <div class="toolbar"><label class="search"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><input id="world-search" type="search" placeholder="Find a question or rubric…" aria-label="Search questions and rubrics" value="${esc(query)}"></label><div class="outcome-filters" id="world-outcomes" role="group" aria-label="Filter by model verdict"></div></div>
      <div class="transcript-heading"><span id="world-count" role="status" aria-live="polite"></span></div>
      <div id="world-items"></div>
      <footer class="world-foot">${data.about.map(p => `<p>${esc(p)}</p>`).join('')}</footer>`;
    $('world-search').oninput = e => {query = e.target.value; renderItems();};
    renderItems();
  }

  document.addEventListener('click', event => {
    const b = event.target.closest('button');
    if (!b || !data || $('world-view').hidden) return;
    if (b.dataset.worldOutcome) {outcome = b.dataset.worldOutcome; renderItems();}
    if (b.dataset.worldModel) {focus = focus === b.dataset.worldModel ? null : b.dataset.worldModel; renderItems();}
    if (b.dataset.worldCategory) {category = b.dataset.worldCategory; renderItems(); $('world-categories').scrollIntoView({block: 'nearest'});}
    if (b.dataset.worldTurn) window.commonGround.openTurn(Number(b.dataset.worldTurn));
    if (b.dataset.worldOpen) {
      const el = $(`wcompare-${b.dataset.worldOpen}`);
      el.open = true;
      loadComparison(el, b.dataset.rubricFocus);
      el.scrollIntoView({block: 'start'});
    }
  });

  window.worldView = {
    async render(owner) {
      const view = $('world-view');
      try {
        if (!data) {view.innerHTML = '<div class="loading" role="status">Loading questions…</div>'; data = await fetchJSON('data/world/index.json');}
        const next = data.speakers[owner.id];
        if (speaker?.id !== owner.id) {query = ''; outcome = 'all'; category = 'all';}
        speaker = {...next, id: owner.id, name: owner.name};
        renderSpeaker();
      } catch (error) {
        view.innerHTML = `<div id="world-error" role="alert">${esc(error.message)}</div>`;
      }
    },
  };
})();

'use strict';

// World-understanding view: interview-style questions about a guest's understanding of
// an object, answered by each model from the question alone and judged against v10 rubrics.
(() => {
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pct = s => s.total ? (100 * s.passed / s.total).toFixed(1) : '—';
  const cache = new Map();
  let data = null, speaker = null, query = '', outcome = 'all';

  function fetchJSON(path) {
    if (!cache.has(path)) cache.set(path, fetch(path).then(r => {
      if (!r.ok) throw Error(`Unable to load results (${r.status}).`);
      return r.json();
    }).catch(error => {cache.delete(path); throw error;}));
    return cache.get(path);
  }

  const color = m => data.providers[m.provider].color;
  const time = s => Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '';

  function mark(pass, m) {
    return `<span class="verdict-mark ${pass ? 'pass' : 'fail'}" title="${esc(m.name)}: ${pass ? 'Pass' : 'Fail'}" aria-label="${esc(m.name)}: ${pass ? 'Pass' : 'Fail'}"><span aria-hidden="true">${pass ? '✓' : '×'}</span><span class="mobile-label" aria-hidden="true">${esc(m.name)}</span></span>`;
  }

  function scoreCards(owner) {
    return Object.entries(data.providers).map(([pid, p]) => {
      const models = data.models.filter(m => m.provider === pid);
      return `<div class="world-provider"><div class="world-provider-label"><span class="model-dot" style="--model:${p.color}"></span>${esc(p.name)} <span>· ${esc(p.harness)}</span></div><div class="scores world-scores" style="--world-cols:${models.length}">${models.map(m => {
        const s = owner.stats[m.id];
        return `<article class="score-card" style="--model:${p.color}" aria-label="${esc(m.name)}: ${pct(s)}% pass rate"><span class="score-name"><span class="model-dot"></span>${esc(m.name)}<small class="model-effort">${esc(m.effort)}</small></span><span class="score-number">${pct(s)}<em>%</em></span><span class="score-fraction">${s.passed} / ${s.total} passed</span><span class="score-bar" aria-hidden="true"><span style="width:${pct(s)}%"></span></span></article>`;
      }).join('')}</div></div>`;
    }).join('');
  }

  function matches(item) {
    const q = query.trim().toLowerCase();
    const text = [item.question, item.object, item.reference, ...item.rubrics.map(r => r.text)].join(' ').toLowerCase();
    if (q && !text.includes(q)) return false;
    if (outcome === 'all') return true;
    return item.rubrics.some(r => {
      const n = data.models.filter(m => r.passes[m.id]).length;
      return (outcome === 'mixed' && n > 0 && n < data.models.length) || (outcome === 'all-pass' && n === data.models.length) || (outcome === 'all-fail' && n === 0);
    });
  }

  function itemHTML(item) {
    const header = `<div class="turn-rubric-heading"><span>Rubrics</span><span class="model-columns">${data.models.map(m => `<span title="${esc(m.name)}">${esc(m.family)}<br>${esc(m.version)}</span>`).join('')}</span></div>`;
    const rubrics = item.rubrics.length
      ? `<div class="turn-rubrics">${header}${item.rubrics.map(r => `<div class="transcript-rubric"><div class="rubric-copy"><button class="rubric-open" data-world-open="${item.id}" data-rubric-focus="${r.rubricId}"><span class="rubric-code">${r.rubricId}</span><span>${esc(r.text)}</span></button></div><div class="verdicts">${data.models.map(m => mark(r.passes[m.id], m)).join('')}</div></div>`).join('')}</div>`
      : '<div class="turn-status">No rubrics for this answer · unscored</div>';
    return `<article class="world-item" id="q-${item.id}">
      <header class="turn-head"><span class="turn-name">Question</span><span class="turn-time">${time(item.startTime)} <span aria-hidden="true">·</span> <button class="turn-link" data-world-turn="${item.start}" title="Show the source turns in the transcript">Turns ${item.start}–${item.end} ↗</button></span></header>
      <h3 class="world-question">${esc(item.question)}</h3>
      <div class="world-object"><span>Object</span>${esc(item.object)}</div>
      <details class="original-wording world-reference"><summary>${esc(speaker.name)}'s answer · ${item.reference.split(/\s+/).length} words</summary><div>${esc(item.reference)}</div></details>
      ${rubrics}
      <details class="turn-comparison" data-world-item="${item.id}" id="wcompare-${item.id}"><summary><span class="comparison-icon" aria-hidden="true">+</span>Compare model responses<span class="comparison-arrow" aria-hidden="true">↗</span></summary><div class="comparison-body"><div class="loading" role="status">Loading model responses…</div></div></details>
    </article>`;
  }

  function comparisonHTML(item, detail) {
    return `<div class="comparison-meta">${item.rubrics.length ? `Scores cover all ${item.rubrics.length} rubric${item.rubrics.length === 1 ? '' : 's'} above.` : 'No rubrics for this answer. Responses are unscored.'} Each model saw only a one-line host introduction and this question.</div><div class="all-models">${data.models.map(m => {
      const c = detail.models[m.id];
      if (!c) return `<article class="model-answer not-run" style="--model:${color(m)}"><header class="model-answer-head"><h3><span class="model-dot"></span>${esc(m.name)}</h3><span class="model-turn-score">Not run</span></header></article>`;
      const passed = Object.values(c.judgments).filter(j => j.pass).length;
      return `<article class="model-answer" style="--model:${color(m)}"><header class="model-answer-head"><h3><span class="model-dot"></span>${esc(m.name)}</h3><span class="model-turn-score">${item.rubrics.length ? `${passed} / ${item.rubrics.length} passed` : 'N/A'}</span></header><div class="answer-content"><div class="block-label">Response</div><div class="candidate-text" id="wanswer-${item.id}-${m.id}">${esc(c.text)}</div><button class="read-response" aria-expanded="false" aria-controls="wanswer-${item.id}-${m.id}">Read full response</button>${item.rubrics.length ? `<div class="block-label judge-heading">${esc(data.judge.name)} judgments</div>` : ''}${item.rubrics.map(r => {
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
      <div class="section-heading"><div><div class="eyebrow">WORLD UNDERSTANDING</div><h2>How ${esc(owner.name)} sees things</h2><p>Each question asks ${esc(owner.name)} about an entity or event in the conversation, written so it stands alone. The answer is ${esc(owner.name)}'s own reply from the episode, lightly cleaned. Each model answered as the guest from the question alone. Rubrics capture the ideas in the guest's actual answer.</p></div><span class="count-tag">${owner.items.length} questions · ${total} rubrics</span></div>
      ${scoreCards(owner)}
      <div class="score-caption">Rubric pass rate on this guest's questions · same rubrics for every model · ${esc(data.judge.name)} judge · no browsing or tools</div>
      <div class="toolbar"><label class="search"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><input id="world-search" type="search" placeholder="Find a question or rubric…" aria-label="Search questions and rubrics" value="${esc(query)}"></label><div class="outcome-filters" role="group" aria-label="Filter by model verdict"><button class="outcome-button" data-world-outcome="all">All outcomes</button><button class="outcome-button" data-world-outcome="mixed">Models disagree</button><button class="outcome-button" data-world-outcome="all-pass">All pass</button><button class="outcome-button" data-world-outcome="all-fail">All miss</button></div></div>
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
        if (speaker?.id !== owner.id) {query = ''; outcome = 'all';}
        speaker = {...next, id: owner.id, name: owner.name};
        renderSpeaker();
      } catch (error) {
        view.innerHTML = `<div id="world-error" role="alert">${esc(error.message)}</div>`;
      }
    },
  };
})();

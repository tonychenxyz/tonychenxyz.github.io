'use strict';

const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct = s => s.total ? (100 * s.passed / s.total).toFixed(1) : '—';
const cache = new Map();
let data, speaker, category = 'all', query = '', outcome = 'all', view = 'raw';
let transcript = null, loadVersion = 0;

async function fetchJSON(path) {
  if (!cache.has(path)) cache.set(path, fetch(path).then(r => {
    if (!r.ok) throw Error(`Unable to load results (${r.status}).`);
    return r.json();
  }).catch(error => {cache.delete(path); throw error;}));
  return cache.get(path);
}

function info() {
  return category === 'all'
    ? {id:'all', name:'Full transcript', description:`The conversation, with all ${data.models.length} models evaluated on the selected rubrics.`, stats:speaker.stats}
    : speaker.categories.find(c => c.id === category);
}

function categoryName(id) {return speaker.categories.find(c => c.id === id)?.name || id;}

function time(seconds) {
  if (!Number.isFinite(seconds)) return '';
  const s = Math.floor(seconds);
  return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
}

function mark(pass, model, mobile = false) {
  return `<span class="verdict-mark ${pass?'pass':'fail'}" title="${esc(model.name)}: ${pass?'Pass':'Fail'}" aria-label="${esc(model.name)}: ${pass?'Pass':'Fail'}"><span aria-hidden="true">${pass?'✓':'×'}</span>${mobile?`<span class="mobile-label" aria-hidden="true">${esc(model.shortName||model.name)}</span>`:''}</span>`;
}

function setURL(turn = null, rubric = null, push = false) {
  const p = new URLSearchParams();
  p.set('speaker', speaker.id);
  if (view !== 'raw') p.set('view', view);
  if (category !== 'all') p.set('category', category);
  if (turn !== null) p.set('turn', String(turn));
  if (rubric) p.set('rubric', rubric);
  history[push?'pushState':'replaceState'](null, '', `${location.pathname}#${p}`);
}

function renderHeader() {
  document.documentElement.style.setProperty('--model-count', data.models.length);
  document.documentElement.style.setProperty('--score-columns', data.models.length > 6 ? 4 : 3);
  document.querySelector('.sidebar-foot details p:first-of-type').textContent = `Luna xhigh wrote the rubrics. Luna high judged all ${data.models.length} models. ${data.models.map(m=>`${m.name}: ${m.effort}`).join('; ')}. No model browsed or used tools.`;
  $('speakers').innerHTML = data.speakers.map(s => `<a class="speaker-button ${speaker.id===s.id?'active':''}" href="#speaker=${s.id}${view==='raw'?'':'&view='+view}" data-speaker="${s.id}" ${speaker.id===s.id?'aria-current="page"':''}><span class="avatar" aria-hidden="true">${s.initials}</span><span><strong>${esc(s.name)}</strong><small>${s.transcriptTurnCount} turns · ${s.rubrics.length} rubrics</small></span></a>`).join('');
  const categories = [{id:'all', name:'Full transcript', stats:speaker.stats}, ...speaker.categories];
  $('categories').innerHTML = categories.map(c => `<button class="category-button ${category===c.id?'active':''}" data-category="${c.id}" aria-pressed="${category===c.id}"><span class="category-top"><span class="category-name">${esc(c.name)}</span><span class="category-rate">${c.stats.astra.total}</span></span></button>`).join('');
  $('episode').textContent = speaker.episode;
  $('speaker-name').textContent = speaker.name;
  $('speaker-subtitle').textContent = speaker.subtitle;
  $('speaker-seal').textContent = speaker.initials;
  $('category-title').textContent = info().name;
  $('category-description').textContent = info().description;
  $('category-count').textContent = `${info().stats.astra.total} rubrics`;
  $('section-eyebrow').textContent = category==='all'?'THE CONVERSATION':'THINKING PATTERN';
  $('scores').innerHTML = data.models.map(m => {
    const s = info().stats[m.id];
    return `<article class="score-card" style="--model:${m.color}" aria-label="${esc(m.name)}: ${pct(s)}% pass rate"><span class="score-name"><span class="model-dot"></span>${esc(m.name)}<small class="model-effort">${esc(m.effort)}</small></span><span class="score-number">${pct(s)}<em>%</em></span><span class="score-fraction">${s.passed} / ${s.total} passed</span><span class="score-bar" aria-hidden="true"><span style="width:${pct(s)}%"></span></span></article>`;
  }).join('');
  $('score-caption').textContent = `${category==='all'?'Episode':'Category'} rubric pass rates · Same rubrics · Luna high judge`;
  $('results-foot').textContent = 'Full source transcript. Preview clips and unscored turns remain visible but do not enter pass rates. ASR and speaker labels may contain errors.';
  if (data.revision === 'clean-v11') {
    $('results-foot').textContent = 'Lightly edited by Luna xhigh. Original wording is expandable; audio preserves the original recording, including interjections. Previews and unscored turns do not enter pass rates. ASR and speaker labels may contain errors.';
    document.querySelector('.sidebar-foot').childNodes.forEach(node => {
      if(node.nodeType === Node.TEXT_NODE && node.textContent.includes('Full-history')) node.textContent = ' Full-history · clean v11';
    });
    document.querySelector('.sidebar-foot details p:last-child').textContent = 'Luna xhigh removed non-meaningful host interjections and merged guest continuations, preserving original words as much as possible. All models answered the cleaned preceding history afresh. Predictions were skipped on turns without rubrics. Original v10 criteria and categories are unchanged.';
  }
}

function matches(rubric) {
  if (category !== 'all' && rubric.category !== category) return false;
  if (query.trim() && !rubric.text.toLowerCase().includes(query.trim().toLowerCase())) return false;
  const n = Object.values(rubric.passes).filter(Boolean).length;
  return outcome==='all' || (outcome==='mixed' && n>0 && n<data.models.length) || (outcome==='all-pass' && n===data.models.length) || (outcome==='all-fail' && n===0);
}

function rubricRows(rubrics, turn) {
  return `<div class="turn-rubrics"><div class="turn-rubric-heading"><span>Rubrics</span><span class="model-columns">${data.models.map(m=>`<span>${esc(m.name)}</span>`).join('')}</span></div>${rubrics.map(r => `<div class="transcript-rubric" id="${r.id}" data-rubric="${r.id}"><div class="rubric-copy"><button class="rubric-open" data-open-turn="${turn.id}" data-rubric-focus="${r.rubricId}"><span class="rubric-code">${r.rubricId}</span><span>${esc(r.text)}</span></button><button class="category-chip" data-category="${r.category}" data-anchor="${turn.turn}" title="Filter to ${esc(categoryName(r.category))}">${esc(categoryName(r.category))}</button></div><div class="verdicts">${data.models.map(m=>mark(r.passes[m.id],m,true)).join('')}</div></div>`).join('')}</div>`;
}

function turnHTML(turn, rubrics, contextual = false) {
  const label = contextual ? 'Context' : turn.status==='preview' ? 'Preview · not evaluated' : turn.status==='excluded' ? 'Not evaluated' : turn.status==='no_rubrics' ? 'No selected rubrics · N/A' : '';
  const comparable = !contextual && turn.caseId && turn.status !== 'preview';
  const audioName = `${turn.name}, turn ${turn.turn}`;
  const listen = turn.audio ? `<button class="turn-listen" data-audio="${esc(turn.audio)}" data-audio-name="${esc(audioName)}" aria-label="Play audio for ${esc(audioName)}" aria-pressed="false" aria-controls="audio-${turn.id}"><span data-audio-icon aria-hidden="true">▶</span><span data-audio-label>Listen</span></button>` : '';
return `<article class="transcript-turn ${turn.role==='guest'?'guest-turn':'host-turn'} ${contextual?'context-turn':''}" id="turn-${turn.turn}" data-turn="${turn.turn}" data-turn-id="${turn.id}"><header class="turn-head"><span class="turn-name">${esc(turn.name)}</span><span class="turn-time">${listen} ${time(turn.start)} <span aria-hidden="true">·</span> <button class="turn-link" data-copy-turn="${turn.turn}" title="Copy link to turn ${turn.turn}">#${turn.turn}</button></span></header><div class="turn-audio-slot" id="audio-${turn.id}" hidden><div class="turn-audio-status" role="status"></div>${turn.audioBounds?.approximate?'<p class="turn-audio-note">Nearby audio · this brief turn has no duration in the source timestamps.</p>':''}</div><div class="turn-text">${esc(turn.text)}</div>${turn.originalText&&turn.originalText!==turn.text?`<details class="original-wording"><summary>Original wording${turn.sourceTurns?.length>1?` · ${turn.sourceTurns.length} source turns`:''}</summary><div>${esc(turn.originalText)}</div></details>`:''}${label?`<div class="turn-status">${label}</div>`:''}${rubrics.length&&!contextual?rubricRows(rubrics,turn):''}${comparable?`<details class="turn-comparison" data-case="${turn.caseId}" data-turn="${turn.turn}" id="compare-${turn.id}"><summary><span class="comparison-icon" aria-hidden="true">+</span>Compare model responses<span class="comparison-arrow" aria-hidden="true">↗</span></summary><div class="comparison-body"><div class="loading" role="status">Loading model responses…</div></div></details>`:''}</article>`;
}

function renderTranscript() {
  window.turnAudio.reset();
  document.querySelectorAll('[data-outcome]').forEach(button => {
    const active = button.dataset.outcome === outcome;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  if (!transcript) {$('transcript').innerHTML='<div class="loading" role="status">Loading transcript…</div>'; return;}
  const filtered = category !== 'all' || query.trim() || outcome !== 'all';
  const rubricMap = new Map();
  speaker.rubrics.filter(matches).forEach(r=>{
    if(!rubricMap.has(r.turn))rubricMap.set(r.turn,[]);
    rubricMap.get(r.turn).push(r);
  });
  const targets = new Set(rubricMap.keys());
  const shown = new Set();
  transcript.turns.forEach((t,i)=>{
    if (!filtered) shown.add(i);
    else if (targets.has(t.turn)) for(let j=Math.max(0,i-4);j<=i;j++)shown.add(j);
  });
  $('reset-view').hidden = !filtered;
  const count = [...rubricMap.values()].reduce((n,rs)=>n+rs.length,0);
  $('visible-count').textContent = filtered ? `${targets.size} matching guest turns · ${count} rubrics · nearby context included` : `${transcript.turns.length} transcript turns · ${count} rubrics`;
  if (!shown.size) {
    $('transcript').innerHTML='<div class="empty">No rubrics match this view.<button id="clear-filters">Show full transcript</button></div>';
    return;
  }
  let previous=-1;
  const parts=[];
  for (const i of [...shown].sort((a,b)=>a-b)) {
    const turn=transcript.turns[i];
    if (i>previous+1) parts.push(`<div class="transcript-gap">${i-previous-1} turns omitted <button data-reset-anchor="${turn.turn}">Show full transcript</button></div>`);
    parts.push(turnHTML(turn,rubricMap.get(turn.turn)||[],!!filtered&&!targets.has(turn.turn)));
    previous=i;
  }
  if (filtered && previous < transcript.turns.length-1) parts.push(`<div class="transcript-gap">${transcript.turns.length-previous-1} later turns omitted <button data-reset-anchor="${transcript.turns[previous].turn}">Show full transcript</button></div>`);
  $('transcript').innerHTML=parts.join('');
  document.querySelectorAll('.turn-comparison').forEach(el=>el.addEventListener('toggle',()=>{
    if (el.open && !el.dataset.loaded) loadComparison(el);
  }));
}

function comparisonHTML(detail, owner) {
  return `<div class="comparison-meta">${detail.rubrics.length?`Turn scores cover all ${detail.rubrics.length} rubric${detail.rubrics.length===1?'':'s'} below.`:'No selected rubric for this turn. Responses are unscored.'}</div><div class="all-models">${data.models.map(model=>{
    const candidate=detail.models[model.id];
    if(candidate.status==='not_run')return `<article class="model-answer not-run" data-answer-model="${model.id}" style="--model:${model.color}"><header class="model-answer-head"><h3><span class="model-dot"></span>${esc(model.name)}</h3><span class="model-turn-score">Not run</span></header><div class="answer-content"><p class="not-run-note">No rubrics selected for this turn. Prediction skipped.</p></div></article>`;
    const passed=Object.values(candidate.judgments).filter(j=>j.pass).length;
    const score=detail.rubrics.length?`${passed} / ${detail.rubrics.length} passed`:'N/A';
    return `<article class="model-answer" data-answer-model="${model.id}" style="--model:${model.color}"><header class="model-answer-head"><h3><span class="model-dot"></span>${esc(model.name)}</h3><span class="model-turn-score">${score}</span></header><div class="answer-content"><div class="block-label">Response</div><div class="candidate-text" id="answer-${detail.id}-${model.id}">${esc(candidate.text)}</div><button class="read-response" aria-expanded="false" aria-controls="answer-${detail.id}-${model.id}">Read full response</button>${detail.rubrics.length?'<div class="block-label judge-heading">Luna high judgments</div>':''}${detail.rubrics.map(r=>{
      const judgment=candidate.judgments[r.rubricId];
      const cat=owner.categories.find(c=>c.id===r.category).name;
      return `<section class="model-judgment ${judgment.pass?'passed':'missed'}" data-judged-rubric="${r.rubricId}"><div class="judge-meta"><span>${r.rubricId}</span><span class="judge-verdict">${judgment.pass?'PASS':'FAIL'}</span></div><div class="judged-category">${esc(cat)}</div><p class="judged-criterion">${esc(r.text)}</p><p class="judge-rationale">${esc(judgment.rationale)}</p></section>`;
    }).join('')}</div></article>`;
  }).join('')}</div>`;
}

async function loadComparison(el) {
  if(el.dataset.loading || el.dataset.loaded)return;
  el.dataset.loading='true';
  const owner=speaker;
  const body=el.querySelector('.comparison-body');
  try {
    const detail=await fetchJSON(`data/raw/turns/${encodeURIComponent(el.dataset.case)}.json`);
    if(!el.isConnected)return;
    body.innerHTML=comparisonHTML(detail,owner);
    body.querySelectorAll('.read-response').forEach(button=>{
      const text=button.previousElementSibling;
      if(text.scrollHeight <= text.clientHeight+2)button.hidden=true;
      button.onclick=()=>{
        const expanded=button.getAttribute('aria-expanded')==='true';
        text.classList.toggle('expanded',!expanded);
        button.setAttribute('aria-expanded',String(!expanded));
        button.textContent=expanded?'Read full response':'Collapse response';
      };
    });
    el.dataset.loaded='true';
    if(el.dataset.focusRubric)highlightJudgment(el,el.dataset.focusRubric);
  } catch(error) {
    body.innerHTML=`<div class="loading" role="alert">${esc(error.message)}<button class="retry">Try again</button></div>`;
    body.querySelector('.retry').onclick=()=>loadComparison(el);
  } finally {delete el.dataset.loading;}
}

function highlightJudgment(el,rid) {
  el.querySelectorAll('.model-judgment').forEach(j=>j.classList.toggle('focused-judgment',j.dataset.judgedRubric===rid));
}

function resetFilters() {category='all';query='';outcome='all';$('search').value='';}
function render() {
  renderHeader();
  document.querySelectorAll('[data-view]').forEach(b => {b.classList.toggle('active', b.dataset.view === view); b.setAttribute('aria-selected', String(b.dataset.view === view));});
  $('raw-view').hidden = view !== 'raw';
  $('world-view').hidden = view !== 'world';
  if (view === 'world') {window.turnAudio.reset(); window.worldView.render(speaker);}
  else renderTranscript();
}

function nearestTurn(requested) {
  if (requested === null || !transcript) return requested;
  const exact = transcript.turns.find(t => t.turn === requested || t.sourceTurns?.includes(requested));
  if (exact) return exact.turn;
  return transcript.turns.find(t => Math.min(...(t.sourceTurns || [t.turn])) >= requested)?.turn ?? requested;
}

// Called by the world-understanding view to show an item's source turns.
window.commonGround = {
  async openTurn(requested) {
    view = 'raw'; resetFilters();
    if (!transcript) await chooseSpeaker(speaker.id, false);
    const turn = nearestTurn(requested);
    setURL(turn, null, true); render();
    $(`turn-${turn}`)?.scrollIntoView({block: 'start'});
  },
};

function filterCategory(id,anchor=null) {
  category=id;query='';outcome='all';$('search').value='';
  setURL(anchor,null,true);render();
  if(anchor!==null)$(`turn-${anchor}`)?.scrollIntoView({block:'start'});
}

async function chooseSpeaker(id,push=true) {
  const version=++loadVersion;
  speaker=data.speakers.find(s=>s.id===id)||data.speakers[0];
  transcript=null;resetFilters();$('error').hidden=true;
  if(push)setURL(null,null,true);
  render();
  try {
    const loaded=await fetchJSON(`data/raw/transcripts/${speaker.id}.json`);
    if(version!==loadVersion)return false;
    transcript=loaded;renderTranscript();return true;
  }catch(error){if(version===loadVersion){$('error').hidden=false;$('error').textContent=error.message;$('transcript').innerHTML='<button class="retry" id="reload-transcript">Try again</button>';}}
}

async function applyLocation({restoreFilters = true} = {}) {
  const params=new URLSearchParams(location.hash.slice(1));
  const fromPath=location.pathname.match(/\/speakers\/([^/]+)\/?$/)?.[1];
  const id=fromPath||params.get('speaker')||data.speakers[0].id;
  view=params.get('view')==='world'?'world':'raw';
  if(!await chooseSpeaker(id,false))return;
  category=restoreFilters && speaker.categories.some(c=>c.id===params.get('category'))?params.get('category'):'all';
  const rubric=speaker.rubrics.find(r=>r.id===params.get('rubric'));
  const requestedTurn=rubric?.turn ?? (params.has('turn')?Number(params.get('turn')):null);
  const turn=nearestTurn(requestedTurn);
  if(rubric && category!=='all' && rubric.category!==category)category=rubric.category;
  render();setURL(turn,rubric?.id);
  if(turn!==null){
    const article=$(`turn-${turn}`);
    article?.scrollIntoView({block:'start'});
    const detail=article?.querySelector('.turn-comparison');
    if(detail){if(rubric)detail.dataset.focusRubric=rubric.rubricId;detail.open=true;}
  }
}

document.addEventListener('click',async event=>{
  const link=event.target.closest('[data-speaker]');
  if(link && !event.metaKey && !event.ctrlKey && !event.shiftKey && event.button===0){event.preventDefault();await chooseSpeaker(link.dataset.speaker);window.scrollTo(0,0);return;}
  const b=event.target.closest('button');
  if(!b||!data)return;
  if(b.dataset.view){view=b.dataset.view;setURL(null,null,true);render();window.scrollTo(0,0);return;}
  if(b.dataset.category)filterCategory(b.dataset.category,b.dataset.anchor??null);
  if(b.dataset.outcome){outcome=b.dataset.outcome;renderTranscript();}
  if(b.id==='reset-view'||b.id==='clear-filters'||b.hasAttribute('data-reset-anchor')){
    const anchor=b.dataset.resetAnchor;resetFilters();setURL(anchor??null,null,true);render();if(anchor)$(`turn-${anchor}`)?.scrollIntoView({block:'start'});
  }
  if(b.id==='reload-transcript')await chooseSpeaker(speaker.id,false);
  if(b.dataset.openTurn){
    const el=$(`compare-${b.dataset.openTurn}`);
    if(el){el.dataset.focusRubric=b.dataset.rubricFocus;el.open=true;highlightJudgment(el,b.dataset.rubricFocus);el.scrollIntoView({block:'start'});}
  }
  if(b.hasAttribute('data-copy-turn')){
    setURL(b.dataset.copyTurn);
    try{await navigator.clipboard.writeText(location.href);b.textContent='Copied';}catch{b.textContent='Link in URL';}
    setTimeout(()=>{if(b.isConnected)b.textContent=`#${b.dataset.copyTurn}`;},1800);
  }
});
$('search').oninput=event=>{query=event.target.value;renderTranscript();};

async function boot(){
  try {
    data=await fetchJSON('data/raw/index.json');
    // Fresh visits and reloads always start unfiltered, including old category URLs.
    // Back/forward navigation still restores filters chosen during this visit.
    await applyLocation({restoreFilters:false});
    window.addEventListener('popstate',applyLocation);
  }catch(error){$('error').hidden=false;$('error').textContent=error.message;$('speaker-subtitle').textContent='Unable to load the conversation.';}
}
boot();
